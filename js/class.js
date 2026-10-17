/* 班级事务 v3.9.0（成员墙容错多班查询） */
(function () {
  'use strict';
  const db = window.supabaseClient;
  if (!db) return;

  const $ = (id) => document.getElementById(id);
  const U = window.Utils;
  const SK = window.Skeleton || { members: () => '<div class="member-wall-empty">加载中…</div>' };

  let currentUserGlobal = null;
  let classIdGlobal = null;
  let isAdminGlobal = false;
  let allMembers = [];

  window.addEventListener('user-ready', (e) => {
    currentUserGlobal = e.detail;
    classIdGlobal = window.currentClassId || currentUserGlobal.class_id;
    isAdminGlobal = U.isAdminRole(currentUserGlobal.role);
    initClassPage();
  });

  function initClassPage() {
    const classId = classIdGlobal;
    const isAdmin = isAdminGlobal;
    const classInfo = SITE_CONFIG.classes.find(c => c.id === classId);
    const className = classInfo ? classInfo.name : classId;

    $('class-name').textContent = className + ' · 班级事务';
    document.title = className + ' · 班级事务';

    if (!isAdmin) {
      document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }

    let activities = [];
    let signupsByKey = {};
    let realtimeChannel = null;
    let signupChannel = null;

    function ensureId(a) {
      if (!a.id) { a.id = 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); return true; }
      return false;
    }

    function normalize(a) {
      if (!Array.isArray(a.weeks)) { a.weeks = a.week ? [a.week] : []; delete a.week; }
      a.weeks = a.weeks.map(Number).filter(w => w >= 1 && w <= SITE_CONFIG.totalWeeks).sort((x, y) => x - y);
      if (!Array.isArray(a.mainOwners)) a.mainOwners = [];
      if (!Array.isArray(a.subOwners)) a.subOwners = [];
      if (typeof a.needsSignup !== 'boolean') a.needsSignup = false;
      return a;
    }

    async function loadActivities() {
      try {
        const { data, error } = await db.from('class_activities').select('activities').eq('class_id', classId).single();
        if (error && error.code !== 'PGRST116') throw error;
        if (data && data.activities) {
          const list = data.activities.map(normalize);
          let needSave = false;
          list.forEach(a => { if (ensureId(a)) needSave = true; });
          if (needSave && isAdmin) { activities = list; await saveActivities(); }
          return list;
        }
        if (isAdmin) {
          const defaults = (DEFAULT_ACTIVITIES[classId] || []).map(normalize);
          defaults.forEach(a => ensureId(a));
          await db.from('class_activities').insert({ class_id: classId, activities: defaults });
          return defaults;
        }
        return [];
      } catch (e) { console.error('读取失败', e); return []; }
    }

    async function saveActivities() {
      try {
        const { error } = await db.from('class_activities').upsert({ class_id: classId, activities }, { onConflict: 'class_id' });
        if (error) throw error;
      } catch (e) { console.error('保存失败', e); alert('保存失败：' + e.message); }
    }

    async function loadSignups() {
      const { data, error } = await db.from('activity_signups').select('*').eq('class_id', classId);
      if (error) { signupsByKey = {}; return; }
      signupsByKey = {};
      (data || []).forEach(s => { (signupsByKey[s.activity_key] = signupsByKey[s.activity_key] || []).push(s); });
    }

    function startRealtimeSync() {
      realtimeChannel = db.channel('class_' + classId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'class_activities', filter: `class_id=eq.${classId}` },
          (payload) => { if (payload.new && payload.new.activities) { activities = payload.new.activities.map(normalize); activities.forEach(ensureId); renderAll(); } })
        .subscribe();

      signupChannel = db.channel('signups_' + classId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_signups', filter: `class_id=eq.${classId}` },
          () => { loadSignups().then(renderAll); })
        .subscribe();
    }

    function weekDateRange(week) {
      const start = new Date(SITE_CONFIG.semesterStart + 'T00:00:00');
      start.setDate(start.getDate() + (week - 1) * 7);
      const end = new Date(start); end.setDate(end.getDate() + 6);
      const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
      return `${fmt(start)} - ${fmt(end)}`;
    }

    function currentWeek() {
      const start = new Date(SITE_CONFIG.semesterStart + 'T00:00:00');
      const diffDays = Math.floor((Date.now() - start.getTime()) / 86400000);
      const week = Math.floor(diffDays / 7) + 1;
      return week >= 1 && week <= SITE_CONFIG.totalWeeks ? week : null;
    }

    function formatOwners(owners) {
      if (!owners || owners.length === 0) return '—';
      return owners.filter(o => o.position || o.name).map(o => `${o.position || ''} ${o.name || ''}`.trim()).join('<br>');
    }

    function byStartWeek(a, b) {
      return (a.weeks[0] || 99) - (b.weeks[0] || 99) || (a.weeks[a.weeks.length - 1] || 0) - (b.weeks[b.weeks.length - 1] || 0);
    }

    function getMyStatus(activityKey) {
      const list = signupsByKey[activityKey] || [];
      const mine = list.find(s => s.user_id === currentUserGlobal.id);
      return mine ? mine.status : null;
    }

    function getStats(activityKey) {
      const list = signupsByKey[activityKey] || [];
      const stats = { yes: 0, no: 0, maybe: 0, total: list.length };
      list.forEach(s => { stats[s.status] = (stats[s.status] || 0) + 1; });
      return stats;
    }

    async function setMyStatus(activityKey, status) {
      const existing = (signupsByKey[activityKey] || []).find(s => s.user_id === currentUserGlobal.id);
      try {
        if (existing) {
          const { error } = await db.from('activity_signups').update({ status, updated_at: new Date().toISOString() }).eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await db.from('activity_signups').insert({ class_id: classId, activity_key: activityKey, user_id: currentUserGlobal.id, user_name: currentUserGlobal.nickname, status });
          if (error) throw error;
        }
        await loadSignups(); renderAll();
      } catch (e) { alert('操作失败：' + e.message); }
    }

    const positionFilter = $('position-filter');
    const nameFilter = $('name-filter');

    SITE_CONFIG.positions.forEach(p => {
      const opt = document.createElement('option'); opt.value = p; opt.textContent = p; positionFilter.appendChild(opt);
    });

    function getFilter() { return { position: positionFilter.value, name: nameFilter.value.trim() }; }
    function matchOwner(owner, filter) {
      if (owner.position !== filter.position) return false;
      if (filter.name && owner.name !== filter.name) return false;
      return true;
    }

    function applyFilter(list) {
      const filter = getFilter();
      if (!filter.position) return list;
      return list.filter(a => (a.mainOwners || []).some(o => matchOwner(o, filter)) || (a.subOwners || []).some(o => matchOwner(o, filter)));
    }

    positionFilter.addEventListener('change', renderAll);
    nameFilter.addEventListener('input', renderAll);
    $('filter-clear').addEventListener('click', () => { positionFilter.value = ''; nameFilter.value = ''; renderAll(); });

    function signupCell(a) {
      if (!a.needsSignup) return '<span class="signup-none">—</span>';
      const stats = getStats(a.id);
      const mine = getMyStatus(a.id);
      const label = mine === 'yes' ? '✅ 参与' : mine === 'no' ? '❌ 不参与' : mine === 'maybe' ? '🤔 待定' : '❓ 未表态';
      const cls = mine ? 'signup-btn signup-' + mine : 'signup-btn signup-none';
      const summary = `<span class="signup-summary">✅${stats.yes} ❌${stats.no} ❓${stats.maybe}</span>`;
      return `<button class="${cls}" data-signup="${a.id}" title="点击切换">${label}</button>${summary}`;
    }

    function activityRow(a, index) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${U.formatWeeks(a.weeks)}</td>
        <td><span class="act-title-text">${U.escapeHtml(a.title)}</span> <button class="btn-cal-add" title="加入个人日程">📅</button></td>
        <td>${U.escapeHtml(a.time)}</td>
        <td>${U.escapeHtml(a.location)}</td>
        <td>${U.escapeHtml(a.requirement)}</td>
        <td class="owner-cell">${formatOwners(a.mainOwners)}</td>
        <td class="owner-cell">${formatOwners(a.subOwners)}</td>
        <td>${U.escapeHtml(a.remark)}</td>
        <td class="signup-cell">${signupCell(a)}</td>
        <td class="op-cell admin-only">
          <button class="btn btn-ghost btn-small" data-edit="${index}">编辑</button>
          <button class="btn btn-danger btn-small" data-del="${index}">删除</button>
        </td>`;
      if (!isAdmin) tr.querySelector('.op-cell').style.display = 'none';
      
      tr.querySelector('.btn-cal-add').addEventListener('click', () => openAddScheduleModal(a));
      
      return tr;
    }

    function emptyRow(colspan, text) {
      const tr = document.createElement('tr'); tr.className = 'empty-row'; tr.innerHTML = `<td colspan="${colspan}">${text}</td>`; return tr;
    }

    function renderRecent(list) {
      const tbody = document.querySelector('#recent-table tbody'); tbody.innerHTML = '';
      const cw = currentWeek();
      let recent;
      if (cw === null) {
        const weeks = [...new Set(list.flatMap(a => a.weeks))].sort((x, y) => x - y);
        const firstTwo = weeks.slice(0, 2);
        recent = list.filter(a => a.weeks.some(w => firstTwo.includes(w)));
      } else {
        recent = list.filter(a => a.weeks.some(w => w === cw || w === cw + 1));
      }
      recent.sort(byStartWeek);
      if (recent.length === 0) { tbody.appendChild(emptyRow(10, '近期暂无工作安排')); return; }
      recent.forEach(a => tbody.appendChild(activityRow(a, activities.indexOf(a))));
    }

    function renderTimeline(list) {
      const box = $('view-timeline'); box.innerHTML = '';
      if (list.length === 0) { box.innerHTML = '<div class="timeline-empty">本学期暂无工作安排</div>'; return; }
      const byWeek = {};
      list.forEach(a => { a.weeks.forEach(w => { (byWeek[w] = byWeek[w] || []).push(a); }); });
      Object.keys(byWeek).map(Number).sort((a, b) => a - b).forEach(week => {
        const item = document.createElement('div'); item.className = 'timeline-item';
        const events = byWeek[week].map(a => {
          const spanBadge = a.weeks.length > 1 ? `<span class="event-span">${U.formatWeeks(a.weeks)}</span>` : '';
          return `<div><span class="event-title">${U.escapeHtml(a.title)}</span>${spanBadge}` +
            `<span class="event-meta">　${U.escapeHtml(a.time || '')} ${U.escapeHtml(a.location || '')}</span></div>`;
        }).join('');
        item.innerHTML = `<span class="timeline-week">第${week}周</span><span class="timeline-date">${weekDateRange(week)}</span><div class="timeline-events">${events}</div>`;
        box.appendChild(item);
      });
    }

    function renderSchedule(list) {
      const table = $('schedule-table'); const thead = table.querySelector('thead'); const tbody = table.querySelector('tbody');
      thead.innerHTML = ''; tbody.innerHTML = '';
      const total = SITE_CONFIG.totalWeeks; const cw = currentWeek();
      const headRow = document.createElement('tr');
      headRow.innerHTML = '<th class="schedule-title-col">活动</th>' + Array.from({ length: total }, (_, i) => `<th title="${weekDateRange(i + 1)}">${i + 1}</th>`).join('');
      thead.appendChild(headRow);
      if (list.length === 0) { tbody.appendChild(emptyRow(total + 1, '本学期暂无工作安排')); return; }
      [...list].sort(byStartWeek).forEach(a => {
        const tr = document.createElement('tr'); const weekSet = new Set(a.weeks);
        let cells = `<td class="schedule-title-col" title="${U.escapeHtml(a.title)}">${U.escapeHtml(a.title)}</td>`;
        for (let w = 1; w <= total; w++) {
          const classes = [];
          if (weekSet.has(w)) { classes.push('bar'); if (!weekSet.has(w - 1)) classes.push('bar-start'); if (!weekSet.has(w + 1)) classes.push('bar-end'); }
          if (w === cw) classes.push('col-current');
          cells += `<td class="${classes.join(' ')}">${weekSet.has(w) ? '<div class="bar-fill"></div>' : ''}</td>`;
        }
        tr.innerHTML = cells; tbody.appendChild(tr);
      });
    }

    function renderSemester(list) {
      const tbody = document.querySelector('#semester-table tbody'); tbody.innerHTML = '';
      const sorted = [...list].sort(byStartWeek);
      if (sorted.length === 0) { tbody.appendChild(emptyRow(10, '暂无活动')); return; }
      sorted.forEach(a => tbody.appendChild(activityRow(a, activities.indexOf(a))));
    }

    function renderAll() {
      const filtered = applyFilter(activities);
      renderRecent(filtered); renderTimeline(filtered); renderSchedule(filtered); renderSemester(filtered); bindSignupButtons();
    }

    function bindSignupButtons() {
      document.querySelectorAll('[data-signup]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const key = btn.dataset.signup;
          const cur = getMyStatus(key);
          const next = cur === null ? 'yes' : cur === 'yes' ? 'no' : cur === 'no' ? 'maybe' : null;
          if (next === null) {
            const existing = (signupsByKey[key] || []).find(s => s.user_id === currentUserGlobal.id);
            if (existing) { db.from('activity_signups').delete().eq('id', existing.id).then(() => loadSignups().then(renderAll)); }
          } else { setMyStatus(key, next); }
        });
      });
    }

    /* ============ 一键加入日程 ============ */
    function openAddScheduleModal(activity) {
      let defaultDate = new Date(SITE_CONFIG.semesterStart + 'T00:00:00');
      if (activity.weeks && activity.weeks.length > 0) {
        defaultDate.setDate(defaultDate.getDate() + (activity.weeks[0] - 1) * 7);
      }
      const dateStr = `${defaultDate.getFullYear()}-${String(defaultDate.getMonth() + 1).padStart(2, '0')}-${String(defaultDate.getDate()).padStart(2, '0')}`;
      
      const input = prompt('确认加入日程的日期（格式：YYYY-MM-DD）\n默认是该活动第一周的周一：', dateStr);
      if (!input) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return alert('日期格式错误');

      db.from('personal_events').insert({
        user_id: currentUserGlobal.id,
        title: `[班级活动] ${activity.title}`,
        event_date: input,
        event_time: activity.time || null,
        location: activity.location || null,
        remark: `要求：${activity.requirement || '无'}`,
        type: 'event'
      }).then(({ error }) => {
        if (error) return alert('添加失败：' + error.message);
        alert('已成功加入你的个人日程！去“个人管理”查看吧。');
      });
    }

    /* ============ 头像墙 + 名片（容错处理） ============ */
    async function loadMemberWall() {
      const wall = document.getElementById('member-wall');
      if (!wall) return;
      
      try {
        wall.innerHTML = SK.members(8);
      } catch (e) {}

      try {
        const targetClassId = classId;

        // 👇 直接查表，并用 or 语法包容户口和活跃班级，防止 RPC 报错卡死
        const { data, error } = await db
          .from('profiles')
          .select('id, nickname, role, avatar_url, created_at, wechat, phone')
          .or(`class_id.eq.${targetClassId},active_class_id.eq.${targetClassId}`)
          .order('created_at', { ascending: true });

        if (error) throw error;
        
        allMembers = data || [];
        if (!allMembers.length) { 
          wall.innerHTML = '<div class="member-wall-empty">暂无成员</div>'; 
          return; 
        }
        
        wall.innerHTML = allMembers.map(m => {
          const initial = (m.nickname || '?').charAt(0).toUpperCase();
          const roleTag = m.role !== 'student' ? `<span class="member-wall-role member-wall-role-${m.role}">${U.roleName(m.role)}</span>` : '';
          const avatarHtml = m.avatar_url ? `<img src="${m.avatar_url}" class="member-wall-avatar" alt="" />` : `<span class="member-wall-avatar member-wall-avatar-default">${U.escapeHtml(initial)}</span>`;
          return `
            <div class="member-wall-item" data-id="${m.id}" title="点击查看名片">
              ${avatarHtml}
              <div class="member-wall-name">${U.escapeHtml(m.nickname)}</div>
              ${roleTag}
            </div>`;
        }).join('');

        wall.querySelectorAll('.member-wall-item').forEach(item => {
          item.addEventListener('click', () => {
            const m = allMembers.find(x => x.id === item.dataset.id);
            if (m) showMemberCard(m);
          });
        });
      } catch (err) {
        console.error('成员加载失败:', err);
        wall.innerHTML = `<div class="member-wall-empty" style="color:#e53935;">加载失败: ${U.escapeHtml(err.message || '网络异常')}</div>`; 
      }
    }

    function showMemberCard(m) {
      const cardModal = document.getElementById('card-modal');
      const avEl = document.getElementById('card-avatar');
      if (m.avatar_url) {
        avEl.innerHTML = `<img src="${m.avatar_url}" style="width:100%; height:100%; object-fit:cover;" />`;
      } else {
        avEl.innerHTML = U.escapeHtml((m.nickname||'?').charAt(0).toUpperCase());
      }
      
      document.getElementById('card-name').textContent = m.nickname;
      document.getElementById('card-role').textContent = U.roleName(m.role);
      document.getElementById('card-wechat').textContent = m.wechat || '未填写';
      document.getElementById('card-phone').textContent = m.phone || '未填写';
      
      cardModal.style.display = 'flex';
    }

    document.getElementById('card-close').onclick = () => { document.getElementById('card-modal').style.display = 'none'; };
    document.getElementById('card-modal').onclick = (e) => { if (e.target.id === 'card-modal') e.target.style.display = 'none'; };

    const viewBtns = document.querySelectorAll('.view-btn');
    const viewPanels = { timeline: $('view-timeline'), schedule: $('view-schedule'), list: $('view-list') };
    viewBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        viewBtns.forEach(b => b.classList.toggle('active', b === btn));
        Object.entries(viewPanels).forEach(([name, el]) => { el.style.display = name === btn.dataset.view ? '' : 'none'; });
      });
    });

    const weeksBox = $('f-weeks');
    const selectedWeeks = new Set();
    for (let w = 1; w <= SITE_CONFIG.totalWeeks; w++) {
      const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'week-chip'; chip.textContent = w;
      chip.title = `第${w}周（${weekDateRange(w)}）`; chip.dataset.week = w;
      chip.addEventListener('click', () => {
        const n = Number(chip.dataset.week);
        if (selectedWeeks.has(n)) { selectedWeeks.delete(n); chip.classList.remove('selected'); }
        else { selectedWeeks.add(n); chip.classList.add('selected'); }
      });
      weeksBox.appendChild(chip);
    }
    $('weeks-clear').addEventListener('click', () => {
      selectedWeeks.clear(); weeksBox.querySelectorAll('.week-chip').forEach(c => c.classList.remove('selected'));
    });
    function setSelectedWeeks(weeks) {
      selectedWeeks.clear(); weeksBox.querySelectorAll('.week-chip').forEach(c => c.classList.remove('selected'));
      (weeks || []).forEach(w => { selectedWeeks.add(w); const chip = weeksBox.querySelector(`[data-week="${w}"]`); if (chip) chip.classList.add('selected'); });
    }

    const modal = $('edit-modal');
    let editingIndex = null;

    function ownerRowHTML(container, owner, removable) {
      const row = document.createElement('div'); row.className = 'owner-row';
      const select = document.createElement('select');
      SITE_CONFIG.positions.forEach(p => { const opt = document.createElement('option'); opt.value = p; opt.textContent = p; select.appendChild(opt); });
      select.value = owner.position || SITE_CONFIG.positions[0];
      const input = document.createElement('input'); input.type = 'text'; input.placeholder = '姓名'; input.value = owner.name || '';
      row.appendChild(select); row.appendChild(input);
      if (removable) {
        const del = document.createElement('button'); del.type = 'button'; del.className = 'remove-owner'; del.textContent = '×';
        del.addEventListener('click', () => row.remove()); row.appendChild(del);
      }
      container.appendChild(row);
    }

    function setupOwnerList(containerId, owners, maxCount) {
      const container = $(containerId); const removable = maxCount > 1; container.innerHTML = '';
      (owners || []).slice(0, maxCount).forEach(o => ownerRowHTML(container, o, removable));
      if (container.querySelectorAll('.owner-row').length === 0) ownerRowHTML(container, {}, removable);
      if (maxCount > 1) {
        const addBtn = document.createElement('button'); addBtn.type = 'button'; addBtn.className = 'add-owner'; addBtn.textContent = '＋ 添加负责人';
        addBtn.addEventListener('click', () => { if (container.querySelectorAll('.owner-row').length >= maxCount) return; ownerRowHTML(container, {}, removable); container.appendChild(addBtn); });
        container.appendChild(addBtn);
      }
    }

    function readOwnerList(containerId) {
      const rows = document.querySelectorAll(`#${containerId} .owner-row`); const owners = [];
      rows.forEach(r => { const position = r.querySelector('select').value; const name = r.querySelector('input').value.trim(); if (position || name) owners.push({ position, name }); });
      return owners;
    }

    function openModal(index) {
      editingIndex = index; const a = index === null ? null : activities[index];
      $('modal-title').textContent = a ? '编辑活动' : '添加活动';
      setSelectedWeeks(a ? a.weeks : []); $('f-title').value = a ? a.title : ''; $('f-time').value = a ? a.time : '';
      $('f-location').value = a ? a.location : ''; $('f-requirement').value = a ? a.requirement : ''; $('f-remark').value = a ? a.remark : '';
      $('f-needs-signup').checked = a ? !!a.needsSignup : false;
      setupOwnerList('f-main-owner', a ? a.mainOwners : [], 1); setupOwnerList('f-sub-owners', a ? a.subOwners : [], 5);
      modal.style.display = 'flex';
    }

    function closeModal() { modal.style.display = 'none'; editingIndex = null; }
    $('modal-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    $('modal-save').addEventListener('click', () => {
      const weeks = [...selectedWeeks].sort((a, b) => a - b); const title = $('f-title').value.trim();
      if (weeks.length === 0) return alert('请选择至少一个周次'); if (!title) return alert('请填写活动标题');
      const oldId = editingIndex !== null ? activities[editingIndex].id : null;
      const data = {
        id: oldId || ('act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)),
        weeks, title, time: $('f-time').value.trim(), location: $('f-location').value.trim(), requirement: $('f-requirement').value.trim(),
        mainOwners: readOwnerList('f-main-owner').slice(0, 1), subOwners: readOwnerList('f-sub-owners'), remark: $('f-remark').value.trim(),
        needsSignup: $('f-needs-signup').checked
      };
      if (editingIndex === null) activities.push(data); else activities[editingIndex] = data;
      saveActivities(); closeModal(); renderAll();
    });

    document.querySelector('.class-main').addEventListener('click', (e) => {
      const editIdx = e.target.getAttribute('data-edit'); const delIdx = e.target.getAttribute('data-del');
      if (editIdx !== null) openModal(Number(editIdx));
      else if (delIdx !== null) {
        const a = activities[Number(delIdx)];
        if (confirm(`确定删除活动「${a.title}」吗？`)) { activities.splice(Number(delIdx), 1); saveActivities(); renderAll(); }
      }
    });

    $('add-activity').addEventListener('click', () => openModal(null));

    loadMemberWall();
    Promise.all([loadActivities(), loadSignups()]).then(([loaded]) => {
      activities = loaded; renderAll(); startRealtimeSync();
    });
  }
})();
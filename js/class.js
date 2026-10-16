/* 班级事务 v1.0.0 */
(function () {
  'use strict';
  const db = window.supabaseClient;
  if (!db) return;

  const $ = (id) => document.getElementById(id);
  const U = window.Utils;

  window.addEventListener('user-ready', (e) => {
    const user = e.detail;
    initClassPage(user);
  });

  function initClassPage(user) {
    const classId = user.class_id;
    const isAdmin = user.role === 'admin';
    const classInfo = SITE_CONFIG.classes.find(c => c.id === classId);
    const className = classInfo ? classInfo.name : classId;

    $('class-name').textContent = className + ' · 班级事务';
    document.title = className + ' · 班级事务';

    if (!isAdmin) {
      document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }

    let activities = [];
    let realtimeChannel = null;

    function normalize(a) {
      if (!Array.isArray(a.weeks)) {
        a.weeks = a.week ? [a.week] : [];
        delete a.week;
      }
      a.weeks = a.weeks.map(Number)
        .filter(w => w >= 1 && w <= SITE_CONFIG.totalWeeks)
        .sort((x, y) => x - y);
      if (!Array.isArray(a.mainOwners)) a.mainOwners = [];
      if (!Array.isArray(a.subOwners)) a.subOwners = [];
      return a;
    }

    async function loadActivities() {
      try {
        const { data, error } = await db
          .from('class_activities')
          .select('activities')
          .eq('class_id', classId)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        if (data && data.activities) return data.activities.map(normalize);

        if (isAdmin) {
          const defaults = (DEFAULT_ACTIVITIES[classId] || []).map(normalize);
          await db.from('class_activities').insert({ class_id: classId, activities: defaults });
          return defaults;
        }
        return [];
      } catch (e) {
        console.error('读取失败', e);
        return [];
      }
    }

    async function saveActivities() {
      try {
        const { error } = await db
          .from('class_activities')
          .upsert({ class_id: classId, activities }, { onConflict: 'class_id' });
        if (error) throw error;
      } catch (e) {
        console.error('保存失败', e);
        alert('保存失败：' + e.message);
      }
    }

    function startRealtimeSync() {
      realtimeChannel = db
        .channel('class_' + classId)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'class_activities', filter: `class_id=eq.${classId}` },
          (payload) => {
            if (payload.new && payload.new.activities) {
              activities = payload.new.activities.map(normalize);
              renderAll();
            }
          })
        .subscribe();
    }

    function weekDateRange(week) {
      const start = new Date(SITE_CONFIG.semesterStart + 'T00:00:00');
      start.setDate(start.getDate() + (week - 1) * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
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
      return owners
        .filter(o => o.position || o.name)
        .map(o => `${o.position || ''} ${o.name || ''}`.trim())
        .join('<br>');
    }

    function byStartWeek(a, b) {
      return (a.weeks[0] || 99) - (b.weeks[0] || 99)
        || (a.weeks[a.weeks.length - 1] || 0) - (b.weeks[b.weeks.length - 1] || 0);
    }

    const positionFilter = $('position-filter');
    const nameFilter = $('name-filter');

    SITE_CONFIG.positions.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      positionFilter.appendChild(opt);
    });

    function getFilter() {
      return { position: positionFilter.value, name: nameFilter.value.trim() };
    }

    function matchOwner(owner, filter) {
      if (owner.position !== filter.position) return false;
      if (filter.name && owner.name !== filter.name) return false;
      return true;
    }

    function applyFilter(list) {
      const filter = getFilter();
      if (!filter.position) return list;
      return list.filter(a =>
        (a.mainOwners || []).some(o => matchOwner(o, filter)) ||
        (a.subOwners || []).some(o => matchOwner(o, filter))
      );
    }

    positionFilter.addEventListener('change', renderAll);
    nameFilter.addEventListener('input', renderAll);
    $('filter-clear').addEventListener('click', () => {
      positionFilter.value = '';
      nameFilter.value = '';
      renderAll();
    });

    function activityRow(a, index) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${U.formatWeeks(a.weeks)}</td>
        <td>${U.escapeHtml(a.title)}</td>
        <td>${U.escapeHtml(a.time)}</td>
        <td>${U.escapeHtml(a.location)}</td>
        <td>${U.escapeHtml(a.requirement)}</td>
        <td class="owner-cell">${formatOwners(a.mainOwners)}</td>
        <td class="owner-cell">${formatOwners(a.subOwners)}</td>
        <td>${U.escapeHtml(a.remark)}</td>
        <td class="op-cell admin-only">
          <button class="btn btn-ghost btn-small" data-edit="${index}">编辑</button>
          <button class="btn btn-danger btn-small" data-del="${index}">删除</button>
        </td>`;
      if (!isAdmin) tr.querySelector('.op-cell').style.display = 'none';
      return tr;
    }

    function emptyRow(colspan, text) {
      const tr = document.createElement('tr');
      tr.className = 'empty-row';
      tr.innerHTML = `<td colspan="${colspan}">${text}</td>`;
      return tr;
    }

    function renderRecent(list) {
      const tbody = document.querySelector('#recent-table tbody');
      tbody.innerHTML = '';
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
      if (recent.length === 0) {
        tbody.appendChild(emptyRow(9, '近期暂无工作安排'));
        return;
      }
      recent.forEach(a => tbody.appendChild(activityRow(a, activities.indexOf(a))));
    }

    function renderTimeline(list) {
      const box = $('view-timeline');
      box.innerHTML = '';
      if (list.length === 0) {
        box.innerHTML = '<div class="timeline-empty">本学期暂无工作安排</div>';
        return;
      }
      const byWeek = {};
      list.forEach(a => {
        a.weeks.forEach(w => { (byWeek[w] = byWeek[w] || []).push(a); });
      });
      Object.keys(byWeek).map(Number).sort((a, b) => a - b).forEach(week => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        const events = byWeek[week].map(a => {
          const spanBadge = a.weeks.length > 1
            ? `<span class="event-span">${U.formatWeeks(a.weeks)}</span>` : '';
          return `<div><span class="event-title">${U.escapeHtml(a.title)}</span>${spanBadge}` +
            `<span class="event-meta">　${U.escapeHtml(a.time || '')} ${U.escapeHtml(a.location || '')}</span></div>`;
        }).join('');
        item.innerHTML = `
          <span class="timeline-week">第${week}周</span>
          <span class="timeline-date">${weekDateRange(week)}</span>
          <div class="timeline-events">${events}</div>`;
        box.appendChild(item);
      });
    }

    function renderSchedule(list) {
      const table = $('schedule-table');
      const thead = table.querySelector('thead');
      const tbody = table.querySelector('tbody');
      thead.innerHTML = '';
      tbody.innerHTML = '';
      const total = SITE_CONFIG.totalWeeks;
      const cw = currentWeek();

      const headRow = document.createElement('tr');
      headRow.innerHTML = '<th class="schedule-title-col">活动</th>' +
        Array.from({ length: total }, (_, i) => `<th title="${weekDateRange(i + 1)}">${i + 1}</th>`).join('');
      thead.appendChild(headRow);

      if (list.length === 0) {
        tbody.appendChild(emptyRow(total + 1, '本学期暂无工作安排'));
        return;
      }

      [...list].sort(byStartWeek).forEach(a => {
        const tr = document.createElement('tr');
        const weekSet = new Set(a.weeks);
        let cells = `<td class="schedule-title-col" title="${U.escapeHtml(a.title)}">${U.escapeHtml(a.title)}</td>`;
        for (let w = 1; w <= total; w++) {
          const classes = [];
          if (weekSet.has(w)) {
            classes.push('bar');
            if (!weekSet.has(w - 1)) classes.push('bar-start');
            if (!weekSet.has(w + 1)) classes.push('bar-end');
          }
          if (w === cw) classes.push('col-current');
          const title = weekSet.has(w) ? ` title="${U.escapeHtml(a.title)} · 第${w}周"` : '';
          cells += `<td class="${classes.join(' ')}"${title}>${weekSet.has(w) ? '<div class="bar-fill"></div>' : ''}</td>`;
        }
        tr.innerHTML = cells;
        tbody.appendChild(tr);
      });
    }

    function renderSemester(list) {
      const tbody = document.querySelector('#semester-table tbody');
      tbody.innerHTML = '';
      const sorted = [...list].sort(byStartWeek);
      if (sorted.length === 0) {
        tbody.appendChild(emptyRow(9, '暂无活动'));
        return;
      }
      sorted.forEach(a => tbody.appendChild(activityRow(a, activities.indexOf(a))));
    }

    function renderAll() {
      const filtered = applyFilter(activities);
      renderRecent(filtered);
      renderTimeline(filtered);
      renderSchedule(filtered);
      renderSemester(filtered);
    }

    const viewBtns = document.querySelectorAll('.view-btn');
    const viewPanels = {
      timeline: $('view-timeline'),
      schedule: $('view-schedule'),
      list: $('view-list')
    };
    viewBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        viewBtns.forEach(b => b.classList.toggle('active', b === btn));
        Object.entries(viewPanels).forEach(([name, el]) => {
          el.style.display = name === btn.dataset.view ? '' : 'none';
        });
      });
    });

    const weeksBox = $('f-weeks');
    const selectedWeeks = new Set();
    for (let w = 1; w <= SITE_CONFIG.totalWeeks; w++) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'week-chip';
      chip.textContent = w;
      chip.title = `第${w}周（${weekDateRange(w)}）`;
      chip.dataset.week = w;
      chip.addEventListener('click', () => {
        const n = Number(chip.dataset.week);
        if (selectedWeeks.has(n)) {
          selectedWeeks.delete(n);
          chip.classList.remove('selected');
        } else {
          selectedWeeks.add(n);
          chip.classList.add('selected');
        }
      });
      weeksBox.appendChild(chip);
    }
    $('weeks-clear').addEventListener('click', () => {
      selectedWeeks.clear();
      weeksBox.querySelectorAll('.week-chip').forEach(c => c.classList.remove('selected'));
    });
    function setSelectedWeeks(weeks) {
      selectedWeeks.clear();
      weeksBox.querySelectorAll('.week-chip').forEach(c => c.classList.remove('selected'));
      (weeks || []).forEach(w => {
        selectedWeeks.add(w);
        const chip = weeksBox.querySelector(`[data-week="${w}"]`);
        if (chip) chip.classList.add('selected');
      });
    }

    const modal = $('edit-modal');
    let editingIndex = null;

    function ownerRowHTML(container, owner, removable) {
      const row = document.createElement('div');
      row.className = 'owner-row';
      const select = document.createElement('select');
      SITE_CONFIG.positions.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        select.appendChild(opt);
      });
      select.value = owner.position || SITE_CONFIG.positions[0];
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = '姓名';
      input.value = owner.name || '';
      row.appendChild(select);
      row.appendChild(input);
      if (removable) {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'remove-owner';
        del.textContent = '×';
        del.addEventListener('click', () => row.remove());
        row.appendChild(del);
      }
      container.appendChild(row);
    }

    function setupOwnerList(containerId, owners, maxCount) {
      const container = $(containerId);
      const removable = maxCount > 1;
      container.innerHTML = '';
      (owners || []).slice(0, maxCount).forEach(o => ownerRowHTML(container, o, removable));
      if (container.querySelectorAll('.owner-row').length === 0) {
        ownerRowHTML(container, {}, removable);
      }
      if (maxCount > 1) {
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'add-owner';
        addBtn.textContent = '＋ 添加负责人';
        addBtn.addEventListener('click', () => {
          if (container.querySelectorAll('.owner-row').length >= maxCount) return;
          ownerRowHTML(container, {}, removable);
          container.appendChild(addBtn);
        });
        container.appendChild(addBtn);
      }
    }

    function readOwnerList(containerId) {
      const rows = document.querySelectorAll(`#${containerId} .owner-row`);
      const owners = [];
      rows.forEach(r => {
        const position = r.querySelector('select').value;
        const name = r.querySelector('input').value.trim();
        if (position || name) owners.push({ position, name });
      });
      return owners;
    }

    function openModal(index) {
      editingIndex = index;
      const a = index === null ? null : activities[index];
      $('modal-title').textContent = a ? '编辑活动' : '添加活动';
      setSelectedWeeks(a ? a.weeks : []);
      $('f-title').value = a ? a.title : '';
      $('f-time').value = a ? a.time : '';
      $('f-location').value = a ? a.location : '';
      $('f-requirement').value = a ? a.requirement : '';
      $('f-remark').value = a ? a.remark : '';
      setupOwnerList('f-main-owner', a ? a.mainOwners : [], 1);
      setupOwnerList('f-sub-owners', a ? a.subOwners : [], 5);
      modal.style.display = 'flex';
    }

    function closeModal() {
      modal.style.display = 'none';
      editingIndex = null;
    }

    $('modal-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    $('modal-save').addEventListener('click', () => {
      const weeks = [...selectedWeeks].sort((a, b) => a - b);
      const title = $('f-title').value.trim();
      if (weeks.length === 0) return alert('请选择至少一个周次');
      if (!title) return alert('请填写活动标题');
      const data = {
        weeks, title,
        time: $('f-time').value.trim(),
        location: $('f-location').value.trim(),
        requirement: $('f-requirement').value.trim(),
        mainOwners: readOwnerList('f-main-owner').slice(0, 1),
        subOwners: readOwnerList('f-sub-owners'),
        remark: $('f-remark').value.trim()
      };
      if (editingIndex === null) activities.push(data);
      else activities[editingIndex] = data;
      saveActivities();
      closeModal();
      renderAll();
    });

    document.querySelector('.class-main').addEventListener('click', (e) => {
      const editIdx = e.target.getAttribute('data-edit');
      const delIdx = e.target.getAttribute('data-del');
      if (editIdx !== null) {
        openModal(Number(editIdx));
      } else if (delIdx !== null) {
        const a = activities[Number(delIdx)];
        if (confirm(`确定删除活动「${a.title}」（${U.formatWeeks(a.weeks)}）吗？`)) {
          activities.splice(Number(delIdx), 1);
          saveActivities();
          renderAll();
        }
      }
    });

    $('add-activity').addEventListener('click', () => openModal(null));

    loadActivities().then(loaded => {
      activities = loaded;
      renderAll();
      startRealtimeSync();
    });
  }
})();
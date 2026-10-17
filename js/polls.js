/* 活动统计 v3.0.1：时间网格投票 + 接龙 */
(function () {
  'use strict';
  const db = window.supabaseClient;
  if (!db) return;
  const U = window.Utils;

  let currentUser = null;
  let activeTab = 'poll';

  let polls = [];
  let myPollVotes = {};
  let allPollVotes = {};

  let chains = [];
  let myChainEntries = {};
  let allChainEntries = {};

  /* ============ 初始化 ============ */
  window.addEventListener('user-ready', (e) => {
    currentUser = e.detail;
    initPage();
  });

  function initPage() {
    const listEl = document.getElementById('act-list');
    if (!listEl) return;

    const addBtn = document.getElementById('act-add-btn');
    const tabBtns = document.querySelectorAll('.pe-tab');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.toggle('active', b === btn));
        activeTab = btn.dataset.tab;
        updateAddBtn();
        render();
      });
    });

    addBtn.addEventListener('click', () => {
      if (activeTab === 'poll') window.openPollModal();
      else window.openChainModal();
    });

    setupPollModal();
    setupChainModal();
    setupJoinModal();

    updateAddBtn();
    loadAll();
    subscribeRealtime();
  }

  function updateAddBtn() {
    const addBtn = document.getElementById('act-add-btn');
    if (addBtn) {
      addBtn.textContent = activeTab === 'poll' ? '＋ 发起时间投票' : '＋ 发起接龙';
    }
  }

  /* ============ 加载 ============ */
  async function loadAll() {
    await Promise.all([loadPolls(), loadChains()]);
    render();
  }

  async function loadPolls() {
    const { data, error } = await db
      .from('time_polls')
      .select('*')
      .eq('class_id', window.currentClassId)
      .order('created_at', { ascending: false });

    if (error) { console.error(error); polls = []; allPollVotes = {}; myPollVotes = {}; return; }
    polls = data || [];
    if (polls.length === 0) return;

    const pollIds = polls.map(p => p.id);
    const { data: votes } = await db
      .from('time_poll_votes')
      .select('*')
      .in('poll_id', pollIds);

    allPollVotes = {};
    myPollVotes = {};
    (votes || []).forEach(v => {
      (allPollVotes[v.poll_id] = allPollVotes[v.poll_id] || []).push(v);
      if (v.user_id === currentUser.id) {
        myPollVotes[v.poll_id] = new Set(Array.isArray(v.slot_ids) ? v.slot_ids : []);
      }
    });
  }

  async function loadChains() {
    const { data, error } = await db
      .from('signup_chains')
      .select('*')
      .eq('class_id', window.currentClassId)
      .order('created_at', { ascending: false });

    if (error) { console.error(error); chains = []; allChainEntries = {}; myChainEntries = {}; return; }
    chains = data || [];
    if (chains.length === 0) return;

    const chainIds = chains.map(c => c.id);
    const { data: entries } = await db
      .from('signup_chain_entries')
      .select('*')
      .in('chain_id', chainIds)
      .order('joined_at', { ascending: true });

    allChainEntries = {};
    myChainEntries = {};
    (entries || []).forEach(e => {
      (allChainEntries[e.chain_id] = allChainEntries[e.chain_id] || []).push(e);
      if (e.user_id === currentUser.id) myChainEntries[e.chain_id] = e;
    });
  }

  /* ============ 实时 ============ */
  function subscribeRealtime() {
    const cid = window.currentClassId;
    db.channel('polls-' + cid)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'time_polls', filter: `class_id=eq.${cid}` },
        () => loadPolls().then(render))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'time_poll_votes' },
        () => loadPolls().then(render))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'signup_chains', filter: `class_id=eq.${cid}` },
        () => loadChains().then(render))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'signup_chain_entries' },
        () => loadChains().then(render))
      .subscribe();
  }

  /* ============ 渲染 ============ */
  function render() {
    const listEl = document.getElementById('act-list');
    if (activeTab === 'poll') {
      if (!polls.length) {
        listEl.innerHTML = '<div class="act-empty">还没有时间投票 🗳️</div>';
        return;
      }
      listEl.innerHTML = polls.map(renderPollCard).join('');
      bindGridInteractions();
      bindPollActions();
    } else {
      if (!chains.length) {
        listEl.innerHTML = '<div class="act-empty">还没有接龙 🔗</div>';
        return;
      }
      listEl.innerHTML = chains.map(renderChainCard).join('');
      bindChainActions();
    }
  }

  function isClosed(item) {
    if (item.closed) return true;
    if (item.deadline && new Date(item.deadline) < new Date()) return true;
    return false;
  }

  function canManage(item) {
    return currentUser.role === 'admin' || item.creator_id === currentUser.id;
  }

  const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  /* ============ 时间投票卡片 ============ */
  function renderPollCard(p) {
    const closed = isClosed(p);
    const days = Array.isArray(p.days) && p.days.length ? p.days : [1, 2, 3, 4, 5];
    const startH = Number(p.start_hour ?? 8);
    const endH = Number(p.end_hour ?? 23);

    const votes = allPollVotes[p.id] || [];
    const mySet = myPollVotes[p.id] || new Set();

    const counts = {};
    votes.forEach(v => {
      (v.slot_ids || []).forEach(key => {
        counts[key] = (counts[key] || 0) + 1;
      });
    });
    const maxCount = Math.max(1, ...Object.values(counts));

    const headCells = days.map(d => `<th class="grid-day-head">${DAY_NAMES[d]}</th>`).join('');

    let rowsHtml = '';
    for (let h = startH; h < endH; h++) {
      let cells = '';
      days.forEach(d => {
        const key = `${d}-${h}`;
        const cnt = counts[key] || 0;
        const mine = mySet.has(key);
        const intensity = cnt / maxCount;
        const bg = cnt > 0
          ? `background: rgba(102,8,116,${(0.08 + intensity * 0.55).toFixed(2)});`
          : '';
        const classes = ['grid-cell'];
        if (mine) classes.push('grid-mine');
        cells += `<td class="${classes.join(' ')}" data-poll="${p.id}" data-key="${key}" style="${bg}" title="${cnt > 0 ? cnt + ' 人空闲' : '点击选择'}"><span class="grid-count">${cnt || ''}</span></td>`;
      });
      rowsHtml += `<tr><th class="grid-hour">${String(h).padStart(2, '0')}:00</th>${cells}</tr>`;
    }

    const deadlineHtml = p.deadline
      ? `<span class="deadline-tag${closed ? ' deadline-passed' : ''}">
           ${closed ? '已截止' : '⏰ ' + U.formatDeadline(p.deadline)}
         </span>`
      : '';
    const closeTag = p.closed ? '<span class="closed-tag">已关闭</span>' : '';

    const myCount = mySet.size;

    const hint = closed
      ? '<div class="grid-hint">投票已结束，无法再修改</div>'
      : (myCount > 0
          ? `<div class="grid-hint grid-hint-mine">你已选择 ${myCount} 个时间段</div>`
          : '<div class="grid-hint">点击格子选择你有空的时间段（可拖动）</div>');

    const manageBtns = canManage(p)
      ? `<button class="pe-btn" data-toggle-close-poll="${p.id}" title="${p.closed ? '重新开放' : '提前关闭'}">${p.closed ? '↺' : '🔒'}</button>
         <button class="pe-btn pe-btn-danger" data-del-poll="${p.id}" title="删除">🗑️</button>`
      : '';

    const votersHtml = votes.length
      ? `<div class="voters-line"><span class="voters-label">已投票：</span>${votes.map(v => U.escapeHtml(v.user_name)).join('、')}</div>`
      : '<div class="voters-line voters-empty">还没有人投票</div>';

    return `
      <div class="act-card${closed ? ' act-closed' : ''}">
        <div class="act-card-head">
          <div class="act-card-title">
            📊 ${U.escapeHtml(p.title)}
            ${deadlineHtml}
            ${closeTag}
          </div>
          <div class="pe-actions">${manageBtns}</div>
        </div>
        ${p.description ? `<div class="act-card-desc">${U.escapeHtml(p.description)}</div>` : ''}
        <div class="grid-wrap">
          <table class="time-grid">
            <thead><tr><th class="grid-hour-head"></th>${headCells}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        ${hint}
        <div class="act-card-footer">
          <div class="act-creator">由 ${U.escapeHtml(p.creator_name)} 发起 · ${U.formatTime(p.created_at)}</div>
          <div class="act-footer-right">${votersHtml}</div>
        </div>
      </div>`;
  }

  /* ============ 时间网格交互 ============ */
  let dragState = null;

  function bindGridInteractions() {
    const tables = document.querySelectorAll('.time-grid');
    tables.forEach(table => {
      table.addEventListener('mousedown', onGridMouseDown);
      table.addEventListener('mousemove', onGridMouseMove);
    });
  }

  document.addEventListener('mouseup', async () => {
    if (!dragState) return;
    const { pollId, changed } = dragState;
    dragState = null;

    if (!changed || changed.size === 0) return;

    const set = myPollVotes[pollId] || new Set();
    const poll = polls.find(p => p.id === pollId);
    if (!poll) return;

    try {
      const myVote = (allPollVotes[pollId] || []).find(v => v.user_id === currentUser.id);
      const newSlots = [...set];

      if (myVote) {
        if (newSlots.length === 0) {
          await db.from('time_poll_votes').delete().eq('id', myVote.id);
        } else {
          await db.from('time_poll_votes').update({
            slot_ids: newSlots,
            updated_at: new Date().toISOString()
          }).eq('id', myVote.id);
        }
      } else if (newSlots.length > 0) {
        await db.from('time_poll_votes').insert({
          poll_id: pollId,
          user_id: currentUser.id,
          user_name: currentUser.nickname,
          slot_ids: newSlots
        });
      }

      await loadPolls();
      render();
    } catch (e) {
      console.error(e);
      alert('保存失败：' + e.message);
      await loadPolls();
      render();
    }
  });

  function onGridMouseDown(e) {
    const cell = e.target.closest('.grid-cell');
    if (!cell) return;
    const pollId = Number(cell.dataset.poll);
    const poll = polls.find(p => p.id === pollId);
    if (!poll || isClosed(poll)) return;

    e.preventDefault();
    const key = cell.dataset.key;
    const set = myPollVotes[pollId] || new Set();
    myPollVotes[pollId] = set;

    const mode = set.has(key) ? 'remove' : 'add';
    const changed = new Set();

    applyCellChange(cell, mode, set, changed);

    dragState = { pollId, mode, set, changed };
  }

  function onGridMouseMove(e) {
    if (!dragState) return;
    const cell = e.target.closest('.grid-cell');
    if (!cell) return;
    if (Number(cell.dataset.poll) !== dragState.pollId) return;
    const key = cell.dataset.key;
    if (dragState.changed.has(key)) return;
    applyCellChange(cell, dragState.mode, dragState.set, dragState.changed);
  }

  function applyCellChange(cell, mode, set, changed) {
    const key = cell.dataset.key;
    if (mode === 'add') {
      if (!set.has(key)) {
        set.add(key);
        cell.classList.add('grid-mine');
        changed.add(key);
      }
    } else {
      if (set.has(key)) {
        set.delete(key);
        cell.classList.remove('grid-mine');
        changed.add(key);
      }
    }
  }

  /* ============ 时间投票管理 ============ */
  function bindPollActions() {
    document.querySelectorAll('[data-del-poll]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('确定删除这个时间投票？')) return;
        const { error } = await db.from('time_polls').delete().eq('id', btn.dataset.delPoll);
        if (error) return alert('删除失败：' + error.message);
        await loadPolls();
        render();
      });
    });
    document.querySelectorAll('[data-toggle-close-poll]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const p = polls.find(x => String(x.id) === btn.dataset.toggleClosePoll);
        if (!p) return;
        const { error } = await db.from('time_polls').update({ closed: !p.closed }).eq('id', p.id);
        if (error) return alert('操作失败：' + error.message);
        await loadPolls();
        render();
      });
    });
  }

  /* ============ 接龙卡片 ============ */
  function renderChainCard(c) {
    const closed = isClosed(c);
    const entries = allChainEntries[c.id] || [];
    const my = myChainEntries[c.id];
    const full = c.max_count && entries.length >= c.max_count;
    const canJoin = !closed && (!full || my);

    const deadlineHtml = c.deadline
      ? `<span class="deadline-tag${closed ? ' deadline-passed' : ''}">
           ${closed ? '已截止' : '⏰ ' + U.formatDeadline(c.deadline)}
         </span>`
      : '';
    const closeTag = c.closed ? '<span class="closed-tag">已关闭</span>' : '';
    const fullTag = (full && !closed) ? '<span class="full-tag">已满员</span>' : '';

    const listHtml = entries.length
      ? entries.map((e, i) => `
          <div class="chain-entry">
            <span class="chain-index">${i + 1}.</span>
            <span class="chain-name">${U.escapeHtml(e.user_name)}</span>
            ${e.remark ? `<span class="chain-remark">— ${U.escapeHtml(e.remark)}</span>` : ''}
            <span class="chain-time">${U.formatTime(e.joined_at)}</span>
          </div>`).join('')
      : '<div class="chain-empty">还没有人接龙，快来抢第一 👆</div>';

    const manageBtns = canManage(c)
      ? `<button class="pe-btn" data-copy-chain="${c.id}" title="复制名单">📋</button>
         <button class="pe-btn" data-export-chain="${c.id}" title="导出 CSV">📥</button>
         <button class="pe-btn" data-toggle-close-chain="${c.id}" title="${c.closed ? '重新开放' : '提前关闭'}">${c.closed ? '↺' : '🔒'}</button>
         <button class="pe-btn pe-btn-danger" data-del-chain="${c.id}" title="删除">🗑️</button>`
      : '';

    let actionBtn = '';
    if (my) {
      actionBtn = `<button class="btn btn-danger btn-small" data-quit-chain="${c.id}">取消接龙</button>`;
    } else if (canJoin) {
      actionBtn = `<button class="btn btn-primary btn-small" data-join-chain="${c.id}">✅ 我要接龙</button>`;
    } else if (full) {
      actionBtn = '<span class="act-hint">已满员</span>';
    } else if (closed) {
      actionBtn = '<span class="act-hint">已截止</span>';
    }

    const countHtml = c.max_count
      ? `<span class="chain-count">${entries.length} / ${c.max_count}</span>`
      : `<span class="chain-count">${entries.length} 人</span>`;

    return `
      <div class="act-card${closed ? ' act-closed' : ''}">
        <div class="act-card-head">
          <div class="act-card-title">
            🔗 ${U.escapeHtml(c.title)}
            ${deadlineHtml}
            ${closeTag}
            ${fullTag}
          </div>
          <div class="pe-actions">${manageBtns}</div>
        </div>
        ${c.description ? `<div class="act-card-desc">${U.escapeHtml(c.description)}</div>` : ''}
        <div class="chain-list">${listHtml}</div>
        <div class="act-card-footer">
          <div class="act-creator">由 ${U.escapeHtml(c.creator_name)} 发起 · ${countHtml}</div>
          <div class="act-footer-right">${actionBtn}</div>
        </div>
      </div>`;
  }

  function bindChainActions() {
    document.querySelectorAll('[data-join-chain]').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = chains.find(x => String(x.id) === btn.dataset.joinChain);
        if (c) window.openJoinModal(c);
      });
    });
    document.querySelectorAll('[data-quit-chain]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('确定取消接龙吗？')) return;
        const { error } = await db.from('signup_chain_entries')
          .delete().eq('chain_id', btn.dataset.quitChain).eq('user_id', currentUser.id);
        if (error) return alert('操作失败：' + error.message);
        await loadChains();
        render();
      });
    });
    document.querySelectorAll('[data-copy-chain]').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = chains.find(x => String(x.id) === btn.dataset.copyChain);
        if (!c) return;
        const entries = allChainEntries[c.id] || [];
        if (!entries.length) return alert('还没有人接龙');
        const text = `【${c.title}】接龙名单（共 ${entries.length} 人）\n` +
          entries.map((e, i) => `${i + 1}. ${e.user_name}${e.remark ? ' — ' + e.remark : ''}`).join('\n');
        navigator.clipboard.writeText(text).then(
          () => alert('已复制到剪贴板'),
          () => alert('复制失败，请手动截图')
        );
      });
    });

    document.querySelectorAll('[data-export-chain]').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = chains.find(x => String(x.id) === btn.dataset.exportChain);
        if (!c) return;
        const entries = allChainEntries[c.id] || [];
        if (!entries.length) return alert('还没有人接龙');

        const headers = ['序号', '姓名', c.remark_label || '备注', '接龙时间'];
        const rows = entries.map((e, i) => [
          i + 1,
          e.user_name,
          e.remark || '',
          U.formatTime(e.joined_at)
        ]);
        
        U.exportCSV(`【${c.title}】接龙名单.csv`, headers, rows);
      });
    });
    document.querySelectorAll('[data-del-chain]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('确定删除这个接龙？所有接龙记录会一并删除。')) return;
        const { error } = await db.from('signup_chains').delete().eq('id', btn.dataset.delChain);
        if (error) return alert('删除失败：' + error.message);
        await loadChains();
        render();
      });
    });
    document.querySelectorAll('[data-toggle-close-chain]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const c = chains.find(x => String(x.id) === btn.dataset.toggleCloseChain);
        if (!c) return;
        const { error } = await db.from('signup_chains').update({ closed: !c.closed }).eq('id', c.id);
        if (error) return alert('操作失败：' + error.message);
        await loadChains();
        render();
      });
    });
  }

  /* ============ 时间投票发布弹窗 ============ */
  function setupPollModal() {
    const modal = document.getElementById('poll-modal');
    const daysBox = document.getElementById('poll-days');
    if (!modal || !daysBox) return;

    let selectedDays = new Set([1, 2, 3, 4, 5]);

    function refreshDayChips() {
      daysBox.querySelectorAll('.day-chip').forEach(chip => {
        chip.classList.toggle('active', selectedDays.has(Number(chip.dataset.day)));
      });
    }

    daysBox.querySelectorAll('.day-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const d = Number(chip.dataset.day);
        if (selectedDays.has(d)) selectedDays.delete(d);
        else selectedDays.add(d);
        refreshDayChips();
      });
    });
    refreshDayChips();

    function reset() {
      selectedDays = new Set([1, 2, 3, 4, 5]);
      refreshDayChips();
      document.getElementById('poll-f-title').value = '';
      document.getElementById('poll-f-desc').value = '';
      document.getElementById('poll-f-deadline').value = '';
      document.getElementById('poll-start-hour').value = '8';
      document.getElementById('poll-end-hour').value = '23';
      document.getElementById('poll-msg').textContent = '';
    }

    window.openPollModal = function () {
      reset();
      modal.style.display = 'flex';
      document.getElementById('poll-f-title').focus();
    };

    document.getElementById('poll-cancel').addEventListener('click', () => {
      modal.style.display = 'none';
    });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    document.getElementById('poll-save').addEventListener('click', async () => {
      const title = document.getElementById('poll-f-title').value.trim();
      const desc = document.getElementById('poll-f-desc').value.trim();
      const deadlineVal = document.getElementById('poll-f-deadline').value;
      const startH = Number(document.getElementById('poll-start-hour').value);
      const endH = Number(document.getElementById('poll-end-hour').value);
      const msgEl = document.getElementById('poll-msg');
      const saveBtn = document.getElementById('poll-save');

      if (!title) { msgEl.textContent = '请填写标题'; msgEl.className = 'form-msg error'; return; }
      if (selectedDays.size === 0) { msgEl.textContent = '请至少选择一天'; msgEl.className = 'form-msg error'; return; }
      if (endH - startH < 1) { msgEl.textContent = '时间范围至少要包含 1 小时'; msgEl.className = 'form-msg error'; return; }

      saveBtn.disabled = true;
      saveBtn.textContent = '发布中…';

      const dayOrder = [1, 2, 3, 4, 5, 6, 0];
      const daysFinal = dayOrder.filter(d => selectedDays.has(d));

      try {
        const { error } = await db.from('time_polls').insert({
          class_id: window.currentClassId,
          creator_id: currentUser.id,
          creator_name: currentUser.nickname,
          title,
          description: desc || null,
          days: daysFinal,
          start_hour: startH,
          end_hour: endH,
          slots: [],
          deadline: deadlineVal ? new Date(deadlineVal).toISOString() : null,
          closed: false
        });
        if (error) throw error;
        modal.style.display = 'none';
        await loadPolls();
        render();
      } catch (e) {
        msgEl.textContent = e.message || '发布失败';
        msgEl.className = 'form-msg error';
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '发布';
      }
    });
  }

  /* ============ 接龙发布弹窗 ============ */
  function setupChainModal() {
    const modal = document.getElementById('chain-modal');
    if (!modal) return;

    function reset() {
      document.getElementById('chain-f-title').value = '';
      document.getElementById('chain-f-desc').value = '';
      document.getElementById('chain-f-deadline').value = '';
      document.getElementById('chain-f-max').value = '';
      document.getElementById('chain-f-needremark').checked = false;
      document.getElementById('chain-f-remarklabel').value = '备注';
      document.getElementById('chain-msg').textContent = '';
    }

    window.openChainModal = function () {
      reset();
      modal.style.display = 'flex';
      document.getElementById('chain-f-title').focus();
    };

    document.getElementById('chain-cancel').addEventListener('click', () => {
      modal.style.display = 'none';
    });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    document.getElementById('chain-save').addEventListener('click', async () => {
      const title = document.getElementById('chain-f-title').value.trim();
      const desc = document.getElementById('chain-f-desc').value.trim();
      const deadlineVal = document.getElementById('chain-f-deadline').value;
      const maxVal = document.getElementById('chain-f-max').value.trim();
      const needRemark = document.getElementById('chain-f-needremark').checked;
      const remarkLabel = document.getElementById('chain-f-remarklabel').value.trim() || '备注';
      const msgEl = document.getElementById('chain-msg');
      const saveBtn = document.getElementById('chain-save');

      if (!title) { msgEl.textContent = '请填写标题'; msgEl.className = 'form-msg error'; return; }

      saveBtn.disabled = true;
      saveBtn.textContent = '发布中…';

      try {
        const { error } = await db.from('signup_chains').insert({
          class_id: window.currentClassId,
          creator_id: currentUser.id,
          creator_name: currentUser.nickname,
          title,
          description: desc || null,
          deadline: deadlineVal ? new Date(deadlineVal).toISOString() : null,
          max_count: maxVal ? Number(maxVal) : null,
          need_remark: needRemark,
          remark_label: remarkLabel,
          closed: false
        });
        if (error) throw error;
        modal.style.display = 'none';
        await loadChains();
        render();
      } catch (e) {
        msgEl.textContent = e.message || '发布失败';
        msgEl.className = 'form-msg error';
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '发布';
      }
    });
  }

  /* ============ 参与接龙弹窗 ============ */
  function setupJoinModal() {
    const modal = document.getElementById('join-modal');
    if (!modal) return;
    let joiningChain = null;

    window.openJoinModal = function (c) {
      joiningChain = c;
      document.getElementById('join-chain-title').textContent = '【' + c.title + '】';
      const label = document.getElementById('join-remark-label');
      const input = document.getElementById('join-remark');
      if (c.need_remark) {
        label.style.display = 'block';
        input.style.display = 'block';
        input.placeholder = c.remark_label || '备注';
        input.value = '';
      } else {
        label.style.display = 'none';
        input.style.display = 'none';
        input.value = '';
      }
      document.getElementById('join-msg').textContent = '';
      modal.style.display = 'flex';
      if (c.need_remark) setTimeout(() => input.focus(), 100);
    };

    document.getElementById('join-cancel').addEventListener('click', () => {
      modal.style.display = 'none';
    });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    document.getElementById('join-confirm').addEventListener('click', async () => {
      if (!joiningChain) return;
      const remark = document.getElementById('join-remark').value.trim();
      const msgEl = document.getElementById('join-msg');
      const btn = document.getElementById('join-confirm');

      if (joiningChain.need_remark && !remark) {
        msgEl.textContent = '请填写' + (joiningChain.remark_label || '备注');
        msgEl.className = 'form-msg error';
        return;
      }

      btn.disabled = true;
      btn.textContent = '提交中…';

      try {
        const { error } = await db.from('signup_chain_entries').insert({
          chain_id: joiningChain.id,
          user_id: currentUser.id,
          user_name: currentUser.nickname,
          remark: remark || null
        });
        if (error) throw error;
        modal.style.display = 'none';
        await loadChains();
        render();
      } catch (e) {
        msgEl.textContent = e.message || '参与失败';
        msgEl.className = 'form-msg error';
      } finally {
        btn.disabled = false;
        btn.textContent = '确认参与';
      }
    });
  }
})();
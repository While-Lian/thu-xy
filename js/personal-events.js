/* 个人日程 + DDL v2.0.0 */
(function () {
  'use strict';
  const db = window.supabaseClient;
  if (!db) return;
  const U = window.Utils;

  let currentUser = null;
  let items = [];        // 全部（event + ddl）
  let activeTab = 'event'; // 'event' | 'ddl'

  window.addEventListener('user-ready', (e) => {
    currentUser = e.detail;
    init();
  });

  function init() {
    const listEl = document.getElementById('pe-list');
    if (!listEl) return;

    const addBtn = document.getElementById('pe-add-btn');
    const tabBtns = document.querySelectorAll('.pe-tab');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.toggle('active', b === btn));
        activeTab = btn.dataset.tab;
        updateAddBtnLabel();
        render();
      });
    });

    addBtn.addEventListener('click', () => openModal(null));

    updateAddBtnLabel();
    loadItems();
  }

  function updateAddBtnLabel() {
    const addBtn = document.getElementById('pe-add-btn');
    if (addBtn) {
      addBtn.textContent = activeTab === 'event' ? '＋ 添加日程' : '＋ 添加 DDL';
    }
  }

  /* ============ 加载 ============ */
  async function loadItems() {
    const listEl = document.getElementById('pe-list');
    listEl.innerHTML = '<div class="pe-empty">加载中…</div>';

    const { data, error } = await db
      .from('personal_events')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('event_date', { ascending: true });

    if (error) {
      listEl.innerHTML = '<div class="pe-empty">加载失败：' + U.escapeHtml(error.message) + '</div>';
      return;
    }
    items = data || [];
    render();
  }

  /* ============ 渲染 ============ */
  function render() {
    const listEl = document.getElementById('pe-list');
    const filtered = items.filter(i => i.type === activeTab);

    if (!filtered.length) {
      listEl.innerHTML = activeTab === 'event'
        ? '<div class="pe-empty">还没有日程，点击右上角添加 ✨</div>'
        : '<div class="pe-empty">还没有 DDL，点击右上角添加 ✨</div>';
      return;
    }

    const today = todayStr();

    if (activeTab === 'event') {
      // 日程：分为即将到来 / 已过去
      const upcoming = filtered.filter(i => i.event_date >= today);
      const past = filtered.filter(i => i.event_date < today);
      let html = '';
      if (upcoming.length) {
        html += '<div class="pe-group-title">即将到来</div>';
        html += upcoming.map(renderEventItem).join('');
      }
      if (past.length) {
        html += '<div class="pe-group-title pe-past-title">已过去</div>';
        html += past.slice().reverse().map(i => renderEventItem(i, true)).join('');
      }
      listEl.innerHTML = html;
    } else {
      // DDL：未完成在上，已完成折叠
      const undone = filtered.filter(i => !i.completed);
      const done = filtered.filter(i => i.completed);
      let html = '';
      if (undone.length) {
        html += undone.map(renderDdlItem).join('');
      } else {
        html += '<div class="pe-empty">没有待完成的 DDL 🎉</div>';
      }
      if (done.length) {
        html += `<div class="pe-group-title pe-past-title">已完成（${done.length}）</div>`;
        html += done.slice().reverse().map(i => renderDdlItem(i, true)).join('');
      }
      listEl.innerHTML = html;
    }

    bindItemActions();
  }

  function renderEventItem(e, isPast) {
    const dateObj = new Date(e.event_date + 'T00:00:00');
    const monthDay = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
    const weekday = ['周日','周一','周二','周三','周四','周五','周六'][dateObj.getDay()];
    const timeStr = e.event_time ? ' · ' + U.escapeHtml(e.event_time) : '';
    const locStr = e.location ? ' · ' + U.escapeHtml(e.location) : '';
    return `
      <div class="pe-item${isPast ? ' pe-item-past' : ''}">
        <div class="pe-date">
          <div class="pe-date-md">${monthDay}</div>
          <div class="pe-date-wd">${weekday}</div>
        </div>
        <div class="pe-body">
          <div class="pe-title">${U.escapeHtml(e.title)}</div>
          <div class="pe-meta">${timeStr}${locStr}</div>
          ${e.remark ? `<div class="pe-remark">${U.escapeHtml(e.remark)}</div>` : ''}
        </div>
        <div class="pe-actions">
          <button class="pe-btn" data-edit="${e.id}" title="编辑">✏️</button>
          <button class="pe-btn pe-btn-danger" data-del="${e.id}" title="删除">🗑️</button>
        </div>
      </div>`;
  }

  function renderDdlItem(e, isDone) {
    const dateObj = new Date(e.event_date + 'T00:00:00');
    const monthDay = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
    const weekday = ['周日','周一','周二','周三','周四','周五','周六'][dateObj.getDay()];
    const diffDays = daysUntil(e.event_date);
    const timeStr = e.event_time ? ' ' + U.escapeHtml(e.event_time) : '';

    let urgencyClass = '';
    let urgencyLabel = '';
    if (!isDone) {
      if (diffDays < 0) { urgencyClass = 'ddl-overdue'; urgencyLabel = `已逾期 ${-diffDays} 天`; }
      else if (diffDays === 0) { urgencyClass = 'ddl-today'; urgencyLabel = '今天到期'; }
      else if (diffDays <= 3) { urgencyClass = 'ddl-soon'; urgencyLabel = `${diffDays} 天后`; }
      else if (diffDays <= 7) { urgencyClass = 'ddl-week'; urgencyLabel = `${diffDays} 天后`; }
      else { urgencyClass = 'ddl-far'; urgencyLabel = `${diffDays} 天后`; }
    }

    return `
      <div class="pe-item pe-item-ddl ${urgencyClass}${isDone ? ' pe-item-past' : ''}">
        <div class="pe-date">
          <div class="pe-date-md">${monthDay}</div>
          <div class="pe-date-wd">${weekday}</div>
        </div>
        <div class="pe-body">
          <div class="pe-title">
            ${U.escapeHtml(e.title)}
            ${!isDone ? `<span class="ddl-label ${urgencyClass}">${urgencyLabel}</span>` : ''}
          </div>
          <div class="pe-meta">${timeStr.trim() ? '截止 ' + U.escapeHtml(e.event_time) : '全天截止'}</div>
          ${e.remark ? `<div class="pe-remark">${U.escapeHtml(e.remark)}</div>` : ''}
        </div>
        <div class="pe-actions">
          ${!isDone ? `<button class="pe-btn pe-btn-done" data-done="${e.id}" title="标记为已完成">✓ 已完成</button>` : ''}
          ${isDone ? `<button class="pe-btn" data-undo="${e.id}" title="撤销完成">↺</button>` : ''}
          <button class="pe-btn" data-edit="${e.id}" title="编辑">✏️</button>
          <button class="pe-btn pe-btn-danger" data-del="${e.id}" title="删除">🗑️</button>
        </div>
      </div>`;
  }

  function bindItemActions() {
    document.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = items.find(x => String(x.id) === btn.dataset.edit);
        if (item) openModal(item);
      });
    });
    document.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('确定删除？')) return;
        const { error } = await db.from('personal_events').delete().eq('id', btn.dataset.del);
        if (error) return alert('删除失败：' + error.message);
        await loadItems();
      });
    });
    document.querySelectorAll('[data-done]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { error } = await db.from('personal_events')
          .update({ completed: true }).eq('id', btn.dataset.done);
        if (error) return alert('操作失败：' + error.message);
        await loadItems();
      });
    });
    document.querySelectorAll('[data-undo]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { error } = await db.from('personal_events')
          .update({ completed: false }).eq('id', btn.dataset.undo);
        if (error) return alert('操作失败：' + error.message);
        await loadItems();
      });
    });
  }

  /* ============ 弹窗 ============ */
  let editingId = null;

  function openModal(item) {
    const modal = document.getElementById('pe-modal');
    editingId = item ? item.id : null;
    document.getElementById('pe-modal-title').textContent = item
      ? '编辑' + (item.type === 'event' ? '日程' : ' DDL')
      : '添加' + (activeTab === 'event' ? '日程' : ' DDL');

    const type = item ? item.type : activeTab;
    document.getElementById('pe-f-type').value = type;
    document.getElementById('pe-f-title').value = item ? item.title : '';
    document.getElementById('pe-f-date').value = item ? item.event_date : todayStr();
    document.getElementById('pe-f-time').value = item ? (item.event_time || '') : '';
    document.getElementById('pe-f-location').value = item ? (item.location || '') : '';
    document.getElementById('pe-f-remark').value = item ? (item.remark || '') : '';

    // 根据类型调整文案
    const dateLabel = document.querySelector('label[for="pe-f-date"]');
    const timeLabel = document.querySelector('label[for="pe-f-time"]');
    if (dateLabel) dateLabel.textContent = type === 'ddl' ? '截止日期' : '日期';
    if (timeLabel) timeLabel.textContent = type === 'ddl' ? '截止时间' : '时间';

    document.getElementById('pe-msg').textContent = '';
    document.getElementById('pe-msg').className = 'form-msg';
    modal.style.display = 'flex';

    document.getElementById('pe-f-title').focus();
  }

  function closeModal() {
    document.getElementById('pe-modal').style.display = 'none';
    editingId = null;
  }

  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  function daysUntil(dateStr) {
    const today = new Date(todayStr() + 'T00:00:00');
    const target = new Date(dateStr + 'T00:00:00');
    return Math.round((target - today) / 86400000);
  }

  /* ============ 事件绑定（全局一次） ============ */
  document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('pe-modal');
    if (!modal) return;

    document.getElementById('pe-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    document.getElementById('pe-save').addEventListener('click', async () => {
      const msgEl = document.getElementById('pe-msg');
      const saveBtn = document.getElementById('pe-save');

      const type = document.getElementById('pe-f-type').value || 'event';
      const title = document.getElementById('pe-f-title').value.trim();
      const date = document.getElementById('pe-f-date').value;
      const time = document.getElementById('pe-f-time').value.trim();
      const location = document.getElementById('pe-f-location').value.trim();
      const remark = document.getElementById('pe-f-remark').value.trim();

      if (!title) { msgEl.textContent = '请填写标题'; msgEl.className = 'form-msg error'; return; }
      if (!date) { msgEl.textContent = '请选择日期'; msgEl.className = 'form-msg error'; return; }

      saveBtn.disabled = true;
      saveBtn.textContent = '保存中…';

      try {
        const payload = {
          type,
          title,
          event_date: date,
          event_time: time,
          location,
          remark
        };
        if (editingId) {
          const { error } = await db.from('personal_events').update(payload).eq('id', editingId);
          if (error) throw error;
        } else {
          const { error } = await db.from('personal_events')
            .insert({ ...payload, user_id: currentUser.id, completed: false });
          if (error) throw error;
        }
        closeModal();
        activeTab = type; // 切换 tab 到刚保存的类型
        document.querySelectorAll('.pe-tab').forEach(b => {
          b.classList.toggle('active', b.dataset.tab === type);
        });
        updateAddBtnLabel();
        await loadItems();
      } catch (err) {
        msgEl.textContent = err.message || '保存失败';
        msgEl.className = 'form-msg error';
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '保存';
      }
    });
  });
})();
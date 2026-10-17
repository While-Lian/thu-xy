/* 班费账本 v5.0 */
(function () {
  'use strict';
  const db = window.supabaseClient;
  if (!db) return;
  const U = window.Utils;

  let currentUser = null;
  let finances = [];

  window.addEventListener('user-ready', (e) => {
    currentUser = e.detail;
    if (U.isAdminRole(currentUser.role)) {
      document.getElementById('add-finance-btn').style.display = 'block';
    }
    init();
  });

  function init() {
    const modal = document.getElementById('finance-modal');
    document.getElementById('add-finance-btn').addEventListener('click', () => {
      document.getElementById('fin-amount').value = '';
      document.getElementById('fin-title').value = '';
      document.getElementById('fin-msg').textContent = '';
      modal.style.display = 'flex';
    });
    document.getElementById('fin-cancel').addEventListener('click', () => modal.style.display = 'none');
    
    document.getElementById('fin-save').addEventListener('click', async () => {
      const type = document.getElementById('fin-type').value;
      const amount = Number(document.getElementById('fin-amount').value);
      const title = document.getElementById('fin-title').value.trim();
      const msgEl = document.getElementById('fin-msg');
      const btn = document.getElementById('fin-save');

      if (!amount || amount <= 0) return msgEl.textContent = '请输入有效金额';
      if (!title) return msgEl.textContent = '请输入事项';

      btn.disabled = true; btn.textContent = '保存中…';
      try {
        const { error } = await db.from('class_finances').insert({
          class_id: window.currentClassId, type, amount, title,
          creator_id: currentUser.id, creator_name: currentUser.nickname
        });
        if (error) throw error;
        modal.style.display = 'none';
        loadFinances();
      } catch (e) {
        msgEl.textContent = e.message; msgEl.className = 'form-msg error';
      } finally {
        btn.disabled = false; btn.textContent = '保存';
      }
    });

    loadFinances();
  }

  async function loadFinances() {
    const list = document.getElementById('finance-list');
    const { data, error } = await db.from('class_finances').select('*').eq('class_id', window.currentClassId).order('created_at', { ascending: false });
    if (error) { list.innerHTML = '<div class="announce-empty" style="color:red">加载失败</div>'; return; }
    
    finances = data || [];
    let balance = 0;
    finances.forEach(f => {
      if (f.type === 'income') balance += Number(f.amount);
      else balance -= Number(f.amount);
    });

    document.getElementById('balance-display').textContent = `¥ ${balance.toFixed(2)}`;

    if (!finances.length) {
      list.innerHTML = '<div class="announce-empty">还没有收支记录</div>';
      return;
    }

    list.innerHTML = finances.map(f => {
      const isIncome = f.type === 'income';
      const color = isIncome ? '#2e7d32' : '#e53935';
      const sign = isIncome ? '+' : '-';
      const dateStr = U.formatTime(f.created_at);
      
      const delBtn = U.isAdminRole(currentUser.role) ? `<button class="pe-btn pe-btn-danger" onclick="deleteFinance(${f.id})">🗑️</button>` : '';

      return `
        <div class="finance-item">
          <div class="fin-info">
            <div class="fin-title">${U.escapeHtml(f.title)}</div>
            <div class="fin-meta">${U.escapeHtml(f.creator_name)} · ${dateStr}</div>
          </div>
          <div class="fin-amount" style="color: ${color};">${sign} ¥${Number(f.amount).toFixed(2)}</div>
          ${delBtn}
        </div>`;
    }).join('');
  }

  window.deleteFinance = async (id) => {
    if (!confirm('确定删除这条记录？')) return;
    await db.from('class_finances').delete().eq('id', id);
    loadFinances();
  };
})();
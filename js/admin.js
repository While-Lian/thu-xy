/* 用户管理 v1.0.0 */
(function () {
  'use strict';
  const db = window.supabaseClient;
  if (!db) return;
  const U = window.Utils;

  let currentUser = null;
  let members = [];
  let resettingUserId = null;

  window.addEventListener('user-ready', (e) => {
    currentUser = e.detail;
    if (currentUser.role !== 'admin') {
      alert('无权限访问此页面');
      location.href = 'index.html';
      return;
    }
    initAdminPage();
  });

  function initAdminPage() {
    const listEl = document.getElementById('member-list');
    const modal = document.getElementById('reset-modal');
    const targetNameEl = document.getElementById('reset-target-name');
    const pwd1 = document.getElementById('reset-pwd1');
    const pwd2 = document.getElementById('reset-pwd2');
    const msgEl = document.getElementById('reset-msg');
    const confirmBtn = document.getElementById('reset-confirm');
    const cancelBtn = document.getElementById('reset-cancel');

    loadMembers();

    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    pwd2.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirmBtn.click();
    });

    confirmBtn.addEventListener('click', async () => {
      const p1 = pwd1.value;
      const p2 = pwd2.value;

      msgEl.textContent = '';
      msgEl.className = 'form-msg';

      if (!p1 || !p2) {
        msgEl.textContent = '请填写两次新密码';
        msgEl.className = 'form-msg error';
        return;
      }
      if (p1.length < 6) {
        msgEl.textContent = '密码至少 6 位';
        msgEl.className = 'form-msg error';
        return;
      }
      if (p1 !== p2) {
        msgEl.textContent = '两次输入不一致';
        msgEl.className = 'form-msg error';
        return;
      }

      confirmBtn.disabled = true;
      confirmBtn.textContent = '重置中…';

      try {
        const { data, error } = await db.rpc('admin_reset_password', {
          p_user_id: resettingUserId,
          p_new_password: p1
        });
        if (error) throw error;
        if (data !== true) throw new Error('重置失败');

        msgEl.textContent = '密码已重置，请通知对方使用新密码登录';
        msgEl.className = 'form-msg success';
        setTimeout(closeModal, 1500);
      } catch (err) {
        msgEl.textContent = err.message || '重置失败';
        msgEl.className = 'form-msg error';
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = '确认重置';
      }
    });

    function openModal(userId, nickname) {
      resettingUserId = userId;
      targetNameEl.textContent = nickname;
      pwd1.value = '';
      pwd2.value = '';
      msgEl.textContent = '';
      msgEl.className = 'form-msg';
      modal.style.display = 'flex';
      setTimeout(() => pwd1.focus(), 100);
    }

    function closeModal() {
      modal.style.display = 'none';
      resettingUserId = null;
    }

    async function loadMembers() {
      listEl.innerHTML = '<div class="member-empty">加载中…</div>';
      const { data, error } = await db.rpc('list_class_members');

      if (error) {
        listEl.innerHTML = '<div class="member-empty">加载失败：' + U.escapeHtml(error.message) + '</div>';
        return;
      }
      members = data || [];
      render();
    }

    function render() {
      if (!members.length) {
        listEl.innerHTML = '<div class="member-empty">暂无成员</div>';
        return;
      }

      listEl.innerHTML = members.map(m => {
        const initial = (m.nickname || '?').charAt(0).toUpperCase();
        const avatarHtml = m.avatar_url
          ? `<img src="${m.avatar_url}" class="member-avatar" alt="" />`
          : `<span class="member-avatar member-avatar-default">${U.escapeHtml(initial)}</span>`;
        const roleTag = m.role === 'admin'
          ? '<span class="member-role member-role-admin">管理员</span>'
          : '<span class="member-role member-role-user">同学</span>';
        const isSelf = m.id === currentUser.id;
        const selfMark = isSelf ? '<span class="member-self">（我）</span>' : '';

        return `
          <div class="member-item">
            ${avatarHtml}
            <div class="member-info">
              <div class="member-name">${U.escapeHtml(m.nickname)}${selfMark} ${roleTag}</div>
              <div class="member-email">${U.escapeHtml(m.email || '')}</div>
              <div class="member-time">注册于 ${U.formatTime(m.created_at)}</div>
            </div>
            <div class="member-actions">
              <button class="btn btn-ghost btn-small" data-reset="${m.id}" data-name="${U.escapeHtml(m.nickname)}">重置密码</button>
            </div>
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('[data-reset]').forEach(btn => {
        btn.addEventListener('click', () => {
          openModal(btn.dataset.reset, btn.dataset.name);
        });
      });
    }
  }
})();
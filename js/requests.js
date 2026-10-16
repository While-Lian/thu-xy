/* 申请审批 v2.3.0 */
(function () {
  'use strict';
  const db = window.supabaseClient;
  if (!db) return;
  const U = window.Utils;

  let currentUser = null;
  let requests = [];
  let rejectingId = null;

  window.addEventListener('user-ready', (e) => {
    currentUser = e.detail;
    if (!U.isAdminRole(currentUser.role)) {
      alert('无权限');
      location.href = 'index.html';
      return;
    }
    init();
  });

  function init() {
    document.getElementById('reject-cancel').addEventListener('click', closeRejectModal);
    document.getElementById('reject-confirm').addEventListener('click', submitReject);
    loadAll();
  }

  async function loadAll() {
    const { data, error } = await db.rpc('list_class_join_requests');
    if (error) {
      console.error(error);
      document.getElementById('pending-list').innerHTML = '<div class="request-empty">加载失败</div>';
      return;
    }
    requests = data || [];
    render();
  }

  function render() {
    const pending = requests.filter(r => r.status === 'pending');
    const history = requests.filter(r => r.status !== 'pending');

    const pendingEl = document.getElementById('pending-list');
    const historyEl = document.getElementById('history-list');

    if (!pending.length) {
      pendingEl.innerHTML = '<div class="request-empty">暂无待审批申请</div>';
    } else {
      pendingEl.innerHTML = pending.map(r => renderRequestCard(r, true)).join('');
      bindPendingActions();
    }

    if (!history.length) {
      historyEl.innerHTML = '<div class="request-empty">暂无历史记录</div>';
    } else {
      historyEl.innerHTML = history.map(r => renderRequestCard(r, false)).join('');
    }
  }

  function renderRequestCard(r, isPending) {
    const roleName = U.roleName(r.requested_role);
    const roleCls = `req-role-${r.requested_role}`;
    const statusMap = {
      pending: '<span class="req-status req-status-pending">待审批</span>',
      approved: '<span class="req-status req-status-approved">✓ 已批准</span>',
      rejected: '<span class="req-status req-status-rejected">✕ 已拒绝</span>'
    };

    // 班委只能处理学生申请
    const canHandle = isPending && (
      currentUser.role === 'teacher' || r.requested_role === 'student'
    );

    const actionsHtml = canHandle ? `
      <div class="req-actions">
        <button class="btn btn-primary btn-small" data-approve="${r.id}">批准</button>
        <button class="btn btn-danger btn-small" data-reject="${r.id}" data-name="${U.escapeHtml(r.user_name)}">拒绝</button>
      </div>` : '';

    const reviewHtml = !isPending && r.reviewed_by_name
      ? `<div class="req-review">${r.reviewed_by_name} 于 ${U.formatTime(r.reviewed_at)} ${r.status === 'approved' ? '批准' : '拒绝'}${r.reject_reason ? '（' + U.escapeHtml(r.reject_reason) + '）' : ''}</div>` : '';

    return `
      <div class="request-item">
        <div class="req-avatar">${U.escapeHtml((r.user_name || '?').charAt(0))}</div>
        <div class="req-info">
          <div class="req-title">
            <span class="req-name">${U.escapeHtml(r.user_name)}</span>
            <span class="req-role ${roleCls}">${roleName}</span>
            ${statusMap[r.status]}
          </div>
          <div class="req-email">${U.escapeHtml(r.user_email || '')}</div>
          ${r.message ? `<div class="req-message">📝 ${U.escapeHtml(r.message)}</div>` : ''}
          <div class="req-time">申请于 ${U.formatTime(r.created_at)}</div>
          ${reviewHtml}
        </div>
        ${actionsHtml}
      </div>`;
  }

  function bindPendingActions() {
    document.querySelectorAll('[data-approve]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.approve;
        if (!confirm('确定批准这条申请吗？')) return;
        btn.disabled = true;
        try {
          const { error } = await db.rpc('approve_join_request', { p_request_id: Number(id) });
          if (error) throw error;
          alert('已批准');
          await loadAll();
        } catch (e) {
          alert('操作失败：' + e.message);
          btn.disabled = false;
        }
      });
    });
    document.querySelectorAll('[data-reject]').forEach(btn => {
      btn.addEventListener('click', () => {
        rejectingId = btn.dataset.reject;
        document.getElementById('reject-user-name').textContent = btn.dataset.name;
        document.getElementById('reject-reason').value = '';
        document.getElementById('reject-msg').textContent = '';
        document.getElementById('reject-modal').style.display = 'flex';
      });
    });
  }

  function closeRejectModal() {
    document.getElementById('reject-modal').style.display = 'none';
    rejectingId = null;
  }

  async function submitReject() {
    if (!rejectingId) return;
    const reason = document.getElementById('reject-reason').value.trim();
    const msgEl = document.getElementById('reject-msg');
    const btn = document.getElementById('reject-confirm');

    btn.disabled = true;
    btn.textContent = '处理中…';

    try {
      const { error } = await db.rpc('reject_join_request', {
        p_request_id: Number(rejectingId),
        p_reason: reason || null
      });
      if (error) throw error;
      closeRejectModal();
      await loadAll();
    } catch (e) {
      msgEl.textContent = e.message || '操作失败';
      msgEl.className = 'form-msg error';
    } finally {
      btn.disabled = false;
      btn.textContent = '确认拒绝';
    }
  }
})();
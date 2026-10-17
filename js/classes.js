/* 班级广场 v3.8.1 */
(function () {
  'use strict';
  const db = window.supabaseClient;
  if (!db) return;
  const U = window.Utils;

  let currentUser = null;
  let classes = [];
  let myRequests = [];
  let myManagedClasses = []; 
  let applyingClassId = null;
  let deletingClassId = null;
  let deletingClassName = '';

  window.addEventListener('user-ready', async (e) => {
    currentUser = e.detail;
    await init();
  });

  async function init() {
    document.getElementById('create-class-btn').addEventListener('click', openCreateModal);
    document.getElementById('apply-cancel').addEventListener('click', closeApplyModal);
    document.getElementById('apply-save').addEventListener('click', submitApply);
    document.getElementById('create-cancel').addEventListener('click', closeCreateModal);
    document.getElementById('create-save').addEventListener('click', submitCreate);
    document.getElementById('delete-class-cancel').addEventListener('click', closeDeleteModal);
    document.getElementById('delete-class-confirm').addEventListener('click', submitDelete);
    document.getElementById('delete-class-confirm-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitDelete();
    });

    if (currentUser.role === 'teacher') {
      document.getElementById('create-class-btn').style.display = '';
    }

    const myActiveId = currentUser.active_class_id || currentUser.class_id;
    if (!myActiveId) {
      document.getElementById('no-class-notice').style.display = '';
    }

    loadAll();
  }

  async function loadAll() {
    await Promise.all([loadClasses(), loadMyRequests()]);
    if (currentUser.role === 'teacher') {
      const { data } = await db.rpc('get_my_managed_classes');
      myManagedClasses = data || [];
    }
    render();
  }

  async function loadClasses() {
    const { data, error } = await db.rpc('list_all_classes');
    if (error) { console.error(error); classes = []; return; }
    classes = data || [];
  }

  async function loadMyRequests() {
    const { data, error } = await db.rpc('my_join_requests');
    if (error) { console.error(error); myRequests = []; return; }
    myRequests = data || [];
  }

  function render() {
    renderMyRequests();
    renderClasses();
  }

  function renderMyRequests() {
    const block = document.getElementById('my-requests-block');
    const list = document.getElementById('my-requests-list');

    const showList = myRequests.filter(r => r.status !== 'approved');
    if (showList.length === 0) { block.style.display = 'none'; return; }
    block.style.display = '';
    list.innerHTML = showList.map(r => {
      const roleName = U.roleName(r.requested_role);
      const statusMap = { pending: '<span class="req-status req-status-pending">等待审批</span>', rejected: '<span class="req-status req-status-rejected">已拒绝</span>' };
      const rejectHtml = r.reject_reason ? `<div class="req-reject-reason">拒绝理由：${U.escapeHtml(r.reject_reason)}</div>` : '';
      return `
        <div class="request-item">
          <div class="req-info">
            <div class="req-title">${U.escapeHtml(r.class_name || r.class_id)} <span class="req-role">${roleName}</span></div>
            <div class="req-time">申请于 ${U.formatTime(r.created_at)}</div>
            ${rejectHtml}
          </div>
          <div class="req-status-wrap">${statusMap[r.status] || ''}</div>
        </div>`;
    }).join('');
  }

  function renderClasses() {
    const listEl = document.getElementById('classes-list');
    if (!classes.length) { listEl.innerHTML = '<div class="class-empty">暂无班级，等待老师创建</div>'; return; }

    const myReqMap = {};
    myRequests.forEach(r => { myReqMap[r.class_id] = r; });
    const managedMap = {};
    myManagedClasses.forEach(c => { managedMap[c.id] = true; });
    
    // 👇 核心修复：使用 active_class_id 判断当前
    const myActiveId = currentUser.active_class_id || currentUser.class_id;

    listEl.innerHTML = classes.map(c => {
      const isManaged = managedMap[c.id];
      const isCurrent = myActiveId === c.id;
      const isMyClass = isManaged || isCurrent; 
      
      const myReq = myReqMap[c.id];
      const isCreator = currentUser.id === c.creator_id;

      let actionHtml = '';
      
      if (isMyClass) {
        if (isCurrent) {
          actionHtml = `<span class="class-tag class-tag-mine">✓ 当前所在班级</span>`;
          if (isCreator) {
            actionHtml += ` <button class="btn btn-danger btn-small" data-delete-class="${c.id}" data-name="${U.escapeHtml(c.name)}" style="margin-left:6px;">删除</button>`;
          }
        } else {
          actionHtml = `
            <span class="class-tag class-tag-mine" style="background:#e3f2fd; color:#1565c0; border-color:#bbdefb;">✓ 我管理的班级</span>
            <button class="btn btn-primary btn-small" data-switch-class="${c.id}" style="margin-left:6px;">切换至此</button>
          `;
        }
      } else if (myReq && myReq.status === 'pending') {
        actionHtml = `<span class="class-tag class-tag-pending">⏳ 等待审批</span>`;
      } else {
        const canApply = currentUser.role === 'teacher' || !myActiveId;
        if (canApply) {
          actionHtml = `<button class="btn btn-primary btn-small" data-apply="${c.id}" data-name="${U.escapeHtml(c.name)}">申请加入</button>`;
        } else {
          actionHtml = `<span class="class-tag">已在其他班级</span>`;
        }
      }

      return `
        <div class="class-card">
          <div class="class-card-head">
            <div class="class-card-title">${U.escapeHtml(c.name)}</div>
            <div class="class-card-grade">${U.escapeHtml(c.grade || '未指定年级')}</div>
          </div>
          ${c.description ? `<div class="class-card-desc">${U.escapeHtml(c.description)}</div>` : ''}
          <div class="class-card-meta">
            <span>👥 ${c.member_count} 人</span>
            <span>创建者：${U.escapeHtml(c.creator_name)}</span>
          </div>
          <div class="class-card-actions">${actionHtml}</div>
        </div>`;
    }).join('');

    listEl.querySelectorAll('[data-apply]').forEach(btn => {
      btn.addEventListener('click', () => openApplyModal(btn.dataset.apply, btn.dataset.name));
    });
    listEl.querySelectorAll('[data-delete-class]').forEach(btn => {
      btn.addEventListener('click', () => openDeleteModal(btn.dataset.deleteClass, btn.dataset.name));
    });
    listEl.querySelectorAll('[data-switch-class]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const targetId = btn.dataset.switchClass;
        btn.disabled = true; btn.textContent = '切换中…';
        const { error } = await db.rpc('switch_teacher_class', { p_class_id: targetId });
        if (error) {
          alert('切换失败：' + error.message); btn.disabled = false; btn.textContent = '切换至此';
        } else {
          location.href = 'index.html'; 
        }
      });
    });
  }

  function openApplyModal(classId, className) {
    applyingClassId = classId;
    document.getElementById('apply-class-name').textContent = className;
    document.getElementById('apply-role').value = currentUser.role === 'teacher' ? 'teacher' : 'student';
    document.getElementById('apply-message').value = '';
    document.getElementById('apply-msg').textContent = '';
    document.getElementById('apply-modal').style.display = 'flex';
  }

  function closeApplyModal() {
    document.getElementById('apply-modal').style.display = 'none';
    applyingClassId = null;
  }

  async function submitApply() {
    if (!applyingClassId) return;
    const role = document.getElementById('apply-role').value;
    const message = document.getElementById('apply-message').value.trim();
    const msgEl = document.getElementById('apply-msg');
    const btn = document.getElementById('apply-save');

    btn.disabled = true; btn.textContent = '提交中…'; msgEl.textContent = '';

    try {
      const { error } = await db.rpc('apply_join_class', { p_class_id: applyingClassId, p_role: role, p_message: message || null });
      if (error) throw error;
      closeApplyModal(); alert('申请已提交，请等待审批'); await loadMyRequests(); render();
    } catch (e) {
      msgEl.textContent = e.message || '申请失败'; msgEl.className = 'form-msg error';
    } finally {
      btn.disabled = false; btn.textContent = '提交申请';
    }
  }

  function openCreateModal() {
    document.getElementById('create-id').value = ''; document.getElementById('create-name').value = '';
    document.getElementById('create-grade').value = 'xingjian2026'; document.getElementById('create-desc').value = '';
    document.getElementById('create-msg').textContent = ''; document.getElementById('create-modal').style.display = 'flex';
    document.getElementById('create-id').focus();
  }

  function closeCreateModal() { document.getElementById('create-modal').style.display = 'none'; }

  async function submitCreate() {
    const id = document.getElementById('create-id').value.trim();
    const name = document.getElementById('create-name').value.trim();
    const grade = document.getElementById('create-grade').value.trim();
    const desc = document.getElementById('create-desc').value.trim();
    const msgEl = document.getElementById('create-msg');
    const btn = document.getElementById('create-save');

    if (!id || !name) { msgEl.textContent = '请填写班级 ID 和班级名'; msgEl.className = 'form-msg error'; return; }

    btn.disabled = true; btn.textContent = '创建中…';

    try {
      const { error } = await db.rpc('create_class', { p_id: id, p_name: name, p_grade: grade || null, p_description: desc || null });
      if (error) throw error;
      closeCreateModal(); alert('班级创建成功！当前页面将刷新'); location.href = 'index.html';
    } catch (e) {
      msgEl.textContent = e.message || '创建失败'; msgEl.className = 'form-msg error'; btn.disabled = false; btn.textContent = '创建';
    }
  }

  function openDeleteModal(classId, className) {
    deletingClassId = classId; deletingClassName = className;
    document.getElementById('delete-class-name').textContent = className; document.getElementById('delete-class-confirm-input').value = '';
    document.getElementById('delete-class-msg').textContent = ''; document.getElementById('delete-class-msg').className = 'form-msg';
    document.getElementById('delete-class-modal').style.display = 'flex'; document.getElementById('delete-class-confirm-input').focus();
  }

  function closeDeleteModal() { document.getElementById('delete-class-modal').style.display = 'none'; deletingClassId = null; deletingClassName = ''; }

  async function submitDelete() {
    if (!deletingClassId) return;
    const input = document.getElementById('delete-class-confirm-input').value.trim();
    const msgEl = document.getElementById('delete-class-msg');
    const btn = document.getElementById('delete-class-confirm');

    if (input !== deletingClassName) { msgEl.textContent = '输入的班级名不匹配'; msgEl.className = 'form-msg error'; return; }

    btn.disabled = true; btn.textContent = '删除中…'; msgEl.textContent = '';

    try {
      const { error } = await db.rpc('delete_class', { p_class_id: deletingClassId });
      if (error) throw error;
      closeDeleteModal(); alert('班级已删除'); location.href = 'classes.html';
    } catch (e) {
      msgEl.textContent = e.message || '删除失败'; msgEl.className = 'form-msg error'; btn.disabled = false; btn.textContent = '确认删除';
    }
  }
})();
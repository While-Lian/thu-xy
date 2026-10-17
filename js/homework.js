/* 作业收集箱 v5.1 */
(function () {
  'use strict';
  const db = window.supabaseClient;
  if (!db) return;
  const U = window.Utils;

  let currentUser = null;
  let tasks = [];
  let currentTask = null;
  let classMembers = []; // 用于统计未交名单

  window.addEventListener('user-ready', async (e) => {
    currentUser = e.detail;
    if (U.isAdminRole(currentUser.role)) {
      document.getElementById('hw-add-btn').style.display = 'block';
    }
    await loadClassMembers();
    initPage();
  });

  async function loadClassMembers() {
    const { data } = await db.from('profiles').select('id, nickname').or(`class_id.eq.${window.currentClassId},active_class_id.eq.${window.currentClassId}`);
    classMembers = data || [];
  }

  function initPage() {
    // 发布任务
    document.getElementById('hw-add-btn').addEventListener('click', () => {
      document.getElementById('hw-task-title').value = '';
      document.getElementById('hw-task-desc').value = '';
      document.getElementById('hw-task-deadline').value = '';
      document.getElementById('hw-task-msg').textContent = '';
      document.getElementById('hw-task-modal').style.display = 'flex';
    });
    document.getElementById('hw-task-cancel').addEventListener('click', () => document.getElementById('hw-task-modal').style.display = 'none');
    
    document.getElementById('hw-task-save').addEventListener('click', async () => {
      const title = document.getElementById('hw-task-title').value.trim();
      const desc = document.getElementById('hw-task-desc').value.trim();
      const deadline = document.getElementById('hw-task-deadline').value;
      const msgEl = document.getElementById('hw-task-msg');
      const btn = document.getElementById('hw-task-save');

      if (!title) return msgEl.textContent = '请输入标题';
      btn.disabled = true; btn.textContent = '发布中…';
      try {
        const { error } = await db.from('homework_tasks').insert({
          class_id: window.currentClassId, title, description: desc || null,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          creator_id: currentUser.id, creator_name: currentUser.nickname
        });
        if (error) throw error;
        document.getElementById('hw-task-modal').style.display = 'none';
        loadTasks();
      } catch (e) {
        msgEl.textContent = e.message; msgEl.className = 'form-msg error';
      } finally { btn.disabled = false; btn.textContent = '发布'; }
    });

    // 详情弹窗关闭
    document.getElementById('hw-detail-close').addEventListener('click', () => document.getElementById('hw-detail-modal').style.display = 'none');

    loadTasks();
  }

  async function loadTasks() {
    const list = document.getElementById('hw-list');
    const { data, error } = await db.from('homework_tasks').select('*').eq('class_id', window.currentClassId).order('created_at', { ascending: false });
    if (error) { list.innerHTML = '<div class="announce-empty">加载失败</div>'; return; }
    tasks = data || [];
    renderTasks();
  }

  function renderTasks() {
    const list = document.getElementById('hw-list');
    if (!tasks.length) { list.innerHTML = '<div class="announce-empty">暂无收集任务</div>'; return; }

    list.innerHTML = tasks.map(t => {
      const isClosed = t.deadline && new Date(t.deadline) < new Date();
      const statusCls = isClosed ? 'hw-closed' : 'hw-open';
      const statusText = isClosed ? '已截止' : '进行中';
      const delBtn = U.isAdminRole(currentUser.role) ? `<button class="pe-btn pe-btn-danger" onclick="event.stopPropagation();deleteTask(${t.id})">🗑️</button>` : '';
      
      const deadlineStr = t.deadline ? U.formatDeadline(t.deadline) : '未设置截止';
      
      return `
        <div class="hw-card ${statusCls}" onclick="openTaskDetail(${t.id})">
          <div style="flex:1;">
            <div class="hw-title">${U.escapeHtml(t.title)} <span class="hw-badge ${statusCls}">${statusText}</span></div>
            <div class="hw-meta">由 ${U.escapeHtml(t.creator_name)} 发布 · ${deadlineStr}</div>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <button class="btn btn-ghost btn-small">查看详情 →</button>
            ${delBtn}
          </div>
        </div>`;
    }).join('');
  }

  window.deleteTask = async (id) => {
    if (!confirm('确定删除这个收集任务？所有人的提交记录也会一并删除。')) return;
    await db.from('homework_tasks').delete().eq('id', id);
    loadTasks();
  };

  window.openTaskDetail = async (taskId) => {
    currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) return;

    document.getElementById('hw-detail-title').textContent = currentTask.title;
    document.getElementById('hw-detail-desc').textContent = currentTask.description || '无详细说明';
    document.getElementById('hw-detail-modal').style.display = 'flex';
    
    document.getElementById('hw-submissions').innerHTML = '<div class="announce-empty">加载中…</div>';
    await loadSubmissions();
  };

  async function loadSubmissions() {
    const { data: submissions, error } = await db.from('homework_submissions').select('*').eq('task_id', currentTask.id).order('created_at', { ascending: true });
    
    const subList = document.getElementById('hw-submissions');
    if (error) { subList.innerHTML = '<div class="announce-empty">加载失败</div>'; return; }

    const subs = submissions || [];
    const total = classMembers.length || 1;
    document.getElementById('hw-progress').textContent = `${subs.length} / ${total}`;

    // 我的状态
    const mySub = subs.find(s => s.user_id === currentUser.id);
    const myStatusEl = document.getElementById('hw-my-status');
    const delMineBtn = document.getElementById('hw-del-mine-btn');
    const uploadBtn = document.getElementById('hw-upload-btn');
    
    // 截止时间判断
    const isClosed = currentTask.deadline && new Date(currentTask.deadline) < new Date();
    if (isClosed) {
      uploadBtn.style.display = 'none';
      delMineBtn.style.display = 'none';
      myStatusEl.innerHTML = '<span style="color:var(--text-tertiary);">任务已截止，无法再提交或修改。</span>';
    } else {
      uploadBtn.style.display = 'block';
      if (mySub) {
        myStatusEl.innerHTML = `✅ 你已提交文件：<b style="color:var(--primary);">${U.escapeHtml(mySub.file_name)}</b>`;
        delMineBtn.style.display = 'block';
        delMineBtn.onclick = () => deleteMySubmission(mySub.id, mySub.file_path);
      } else {
        myStatusEl.innerHTML = `❓ 你还未提交此任务。`;
        delMineBtn.style.display = 'none';
      }
    }

    // 上传按钮逻辑
    uploadBtn.onclick = () => document.getElementById('hw-file-input').click();
    document.getElementById('hw-file-input').onchange = (e) => {
      if (e.target.files.length) uploadSubmission(e.target.files[0], mySub);
      e.target.value = '';
    };

    // 渲染已交名单
    if (!subs.length) {
      subList.innerHTML = '<div class="announce-empty">暂无提交</div>';
    } else {
      subList.innerHTML = subs.map(s => {
        const { data: urlData } = db.storage.from('homework-files').getPublicUrl(s.file_path);
        const url = urlData.publicUrl;
        const isAdmin = U.isAdminRole(currentUser.role);
        const delBtn = (isAdmin || s.user_id === currentUser.id) ? `<button class="pe-btn pe-btn-danger" style="padding:2px 6px;" onclick="deleteSubmission(${s.id}, '${s.file_path}')">🗑️</button>` : '';
        return `
          <div class="hw-sub-row">
            <div style="flex:1;">
              <span style="font-weight:600; font-size:14px;">${U.escapeHtml(s.user_name)}</span>
              <span style="font-size:12px; color:var(--text-tertiary); margin-left:8px;">${U.formatTime(s.created_at)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <a href="${url}" target="_blank" class="btn btn-ghost btn-small" style="padding:2px 10px;">下载</a>
              ${delBtn}
            </div>
          </div>`;
      }).join('');
    }

    // 导出未交名单（仅班委）
    const exportBtn = document.getElementById('hw-export-unsubmitted');
    if (U.isAdminRole(currentUser.role)) {
      exportBtn.style.display = 'block';
      exportBtn.onclick = () => {
        const submittedUserIds = subs.map(s => s.user_id);
        const unsubmitted = classMembers.filter(m => !submittedUserIds.includes(m.id));
        if (!unsubmitted.length) return alert('全班都已提交！');
        
        const headers = ['昵称', '状态'];
        const rows = unsubmitted.map(m => [m.nickname, '未交']);
        U.exportCSV(`【${currentTask.title}】未交名单.csv`, headers, rows);
      };
    } else {
      exportBtn.style.display = 'none';
    }
  }

  async function uploadSubmission(file, existingSub) {
    const msgEl = document.getElementById('hw-upload-msg');
    const btn = document.getElementById('hw-upload-btn');
    
    if (file.size > 20 * 1024 * 1024) return alert('文件不能超过 20MB');
    
    msgEl.textContent = '上传中…';
    btn.disabled = true;

    try {
      let finalFile = file;
      if (file.type.startsWith('image/')) {
        try { finalFile = await U.resizeImage(file, 1024, 1024, 0.85); } catch(e){}
      }

      const ext = (finalFile.name.split('.').pop() || 'file').toLowerCase();
      const path = `${window.currentClassId}/${currentTask.id}/${currentUser.id}-${Date.now()}.${ext}`;

      // 如果是重新提交，先删旧的
      if (existingSub && existingSub.file_path) {
        await db.storage.from('homework-files').remove([existingSub.file_path]);
      }

      const { error: upErr } = await db.storage.from('homework-files').upload(path, finalFile);
      if (upErr) throw upErr;

      if (existingSub) {
        const { error: dbErr } = await db.from('homework_submissions').update({
          file_name: finalFile.name, file_path: path, file_size: finalFile.size, created_at: new Date().toISOString()
        }).eq('id', existingSub.id);
        if (dbErr) throw dbErr;
      } else {
        const { error: dbErr } = await db.from('homework_submissions').insert({
          task_id: currentTask.id, user_id: currentUser.id, user_name: currentUser.nickname,
          file_name: finalFile.name, file_path: path, file_size: finalFile.size
        });
        if (dbErr) throw dbErr;
      }

      msgEl.textContent = '上传成功！';
      msgEl.style.color = 'var(--success)';
      setTimeout(() => { msgEl.textContent = ''; }, 3000);
      await loadSubmissions();
    } catch (e) {
      msgEl.textContent = '失败：' + e.message;
      msgEl.style.color = 'var(--danger)';
    } finally {
      btn.disabled = false;
    }
  }

  async function deleteMySubmission(id, path) {
    if (!confirm('确定撤销提交？')) return;
    await db.storage.from('homework-files').remove([path]);
    await db.from('homework_submissions').delete().eq('id', id);
    await loadSubmissions();
  }

  window.deleteSubmission = async (id, path) => {
    if (!confirm('确定删除这条提交记录？')) return;
    await db.storage.from('homework-files').remove([path]);
    await db.from('homework_submissions').delete().eq('id', id);
    await loadSubmissions();
  };
})();
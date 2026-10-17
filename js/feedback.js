/* 匿名意见箱 v5.0 */
(function () {
  'use strict';
  const db = window.supabaseClient;
  if (!db) return;
  const U = window.Utils;

  let currentUser = null;

  window.addEventListener('user-ready', (e) => {
    currentUser = e.detail;
    init();
  });

  function init() {
    const contentInput = document.getElementById('fb-content');
    const submitBtn = document.getElementById('fb-submit');
    const msgEl = document.getElementById('fb-msg');

    submitBtn.addEventListener('click', async () => {
      const content = contentInput.value.trim();
      if (!content) return alert('请输入内容');
      submitBtn.disabled = true; submitBtn.textContent = '发送中…';
      try {
        const { error } = await db.from('anonymous_feedbacks').insert({
          class_id: window.currentClassId, content
        });
        if (error) throw error;
        contentInput.value = '';
        msgEl.textContent = '发送成功，感谢你的反馈！';
        msgEl.className = 'form-msg success';
        setTimeout(() => { msgEl.textContent = ''; }, 3000);
        if (U.isAdminRole(currentUser.role)) loadAdminFeedbacks();
      } catch (e) {
        msgEl.textContent = '发送失败：' + e.message;
        msgEl.className = 'form-msg error';
      } finally {
        submitBtn.disabled = false; submitBtn.textContent = '匿名发送';
      }
    });

    if (U.isAdminRole(currentUser.role)) {
      document.getElementById('admin-block').style.display = 'block';
      loadAdminFeedbacks();
    }
  }

  async function loadAdminFeedbacks() {
    const list = document.getElementById('fb-list');
    const { data, error } = await db.from('anonymous_feedbacks').select('*').eq('class_id', window.currentClassId).order('created_at', { ascending: false });
    if (error) { list.innerHTML = '<div class="announce-empty">加载失败</div>'; return; }
    
    if (!data || !data.length) {
      list.innerHTML = '<div class="announce-empty">目前还没有收到匿名反馈</div>';
      return;
    }

    list.innerHTML = data.map(f => `
      <div class="feedback-item ${f.is_handled ? 'fb-handled' : ''}">
        <div class="fb-head">
          <span class="fb-status ${f.is_handled ? 'handled' : 'pending'}">${f.is_handled ? '已处理' : '待处理'}</span>
          <span class="fb-time">${U.formatTime(f.created_at)}</span>
        </div>
        <div class="fb-content-text">${U.escapeHtml(f.content).replace(/\n/g, '<br>')}</div>
        <div class="fb-actions">
          ${!f.is_handled ? `<button class="btn btn-ghost btn-small" onclick="markHandled(${f.id})">标记为已处理</button>` : ''}
          <button class="btn btn-danger btn-small" onclick="deleteFeedback(${f.id})">删除</button>
        </div>
      </div>
    `).join('');
  }

  window.markHandled = async (id) => {
    await db.from('anonymous_feedbacks').update({ is_handled: true }).eq('id', id);
    loadAdminFeedbacks();
  };

  window.deleteFeedback = async (id) => {
    if (!confirm('确定删除这条匿名意见？')) return;
    await db.from('anonymous_feedbacks').delete().eq('id', id);
    loadAdminFeedbacks();
  };
})();
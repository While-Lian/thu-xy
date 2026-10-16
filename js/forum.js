/* 班级论坛 v1.0.0 */
(function () {
  'use strict';
  const db = window.supabaseClient;
  if (!db) return;

  const U = window.Utils;
  const TABLE = 'class_posts';
  const REPLY_TABLE = 'class_replies';
  const LIKE_TABLE = 'post_likes';

  let currentUser = null;
  let currentPosts = [];
  let currentReplies = [];
  let myLikes = new Set();

  window.addEventListener('user-ready', (e) => {
    currentUser = e.detail;
    initForum();
  });

  function initForum() {
    const contentInput = document.getElementById('post-content');
    const submitBtn = document.getElementById('post-submit');
    const charCount = document.getElementById('post-char-count');
    const postList = document.getElementById('post-list');
    const forumStatus = document.getElementById('forum-status');
    const forumClassName = document.getElementById('forum-class-name');

    if (!contentInput || !postList) return;

    const classInfo = SITE_CONFIG.classes.find(c => c.id === window.currentClassId);
    if (forumClassName) forumClassName.textContent = classInfo ? classInfo.name : window.currentClassId;

    contentInput.addEventListener('input', () => {
      charCount.textContent = `${contentInput.value.length} / 500`;
    });
    submitBtn.addEventListener('click', handleSubmit);
    contentInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    });

    loadAll();
    subscribeRealtime();

    async function handleSubmit() {
      const content = contentInput.value.trim();
      if (!content) return alert('请输入内容');
      submitBtn.disabled = true;
      submitBtn.textContent = '发布中…';
      try {
        const { error } = await db.from(TABLE).insert({
          class_id: window.currentClassId,
          user_id: currentUser.id,
          author: currentUser.nickname,
          content
        });
        if (error) throw error;
        contentInput.value = '';
        charCount.textContent = '0 / 500';
        await loadAll();
      } catch (err) {
        alert('发布失败：' + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '发布';
      }
    }

    async function loadAll() {
      const { data: posts, error: err1 } = await db
        .from(TABLE).select('*')
        .eq('class_id', window.currentClassId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (err1) {
        postList.innerHTML = '<div class="post-empty">加载失败</div>';
        return;
      }
      currentPosts = posts || [];

      const authorIds = [...new Set(currentPosts.map(p => p.user_id).filter(Boolean))];
      let profileMap = {};
      if (authorIds.length) {
        const { data: profiles } = await db.from('profiles').select('id, avatar_url').in('id', authorIds);
        (profiles || []).forEach(p => { profileMap[p.id] = p; });
      }
      currentPosts.forEach(p => { p._avatar = profileMap[p.user_id]?.avatar_url || null; });

      const { data: likes } = await db.from(LIKE_TABLE)
        .select('post_id').eq('user_id', currentUser.id);
      myLikes = new Set((likes || []).map(l => String(l.post_id)));

      if (currentPosts.length) {
        const ids = currentPosts.map(p => p.id);
        const { data: replies } = await db.from(REPLY_TABLE)
          .select('*').in('post_id', ids).order('created_at', { ascending: true });
        currentReplies = replies || [];

        const replyUserIds = [...new Set(currentReplies.map(r => r.user_id).filter(Boolean))];
        const allIds = [...new Set([...authorIds, ...replyUserIds])];
        if (allIds.length > authorIds.length) {
          const { data: moreProfiles } = await db.from('profiles').select('id, avatar_url').in('id', allIds);
          const newMap = {};
          (moreProfiles || []).forEach(p => { newMap[p.id] = p; });
          currentReplies.forEach(r => { r._avatar = newMap[r.user_id]?.avatar_url || null; });
        } else {
          currentReplies.forEach(r => { r._avatar = profileMap[r.user_id]?.avatar_url || null; });
        }
      } else currentReplies = [];

      renderAll();
    }

    function avatarHtml(url, name, size) {
      const cls = size === 'sm' ? 'avatar-sm' : 'avatar-md';
      if (url) return `<img src="${url}" class="${cls}" alt="" />`;
      const initial = (name || '?').charAt(0).toUpperCase();
      return `<span class="${cls} ${cls}-default">${U.escapeHtml(initial)}</span>`;
    }

    function renderAll() {
      if (!currentPosts.length) {
        postList.innerHTML = '<div class="post-empty">还没有人发言，来抢沙发吧 🛋️</div>';
        return;
      }
      postList.innerHTML = currentPosts.map(renderPost).join('');

      postList.querySelectorAll('.post-delete').forEach(b =>
        b.addEventListener('click', () => deletePost(b.dataset.id)));
      postList.querySelectorAll('.action-like').forEach(b =>
        b.addEventListener('click', () => toggleLike(b.dataset.id)));
      postList.querySelectorAll('.action-reply').forEach(b =>
        b.addEventListener('click', () => toggleReplyForm(b.dataset.id)));
      postList.querySelectorAll('.reply-delete').forEach(b =>
        b.addEventListener('click', () => deleteReply(b.dataset.id)));
    }

    function canDelete(ownerUserId) {
      return currentUser.role === 'admin' || currentUser.id === ownerUserId;
    }

    function renderPost(post) {
      const replies = currentReplies.filter(r => r.post_id === post.id);
      const liked = myLikes.has(String(post.id));
      const showDelete = canDelete(post.user_id);

      const repliesHtml = replies.length
        ? `<div class="replies">${replies.map(renderReply).join('')}</div>` : '';

      return `
        <div class="post-item" data-id="${post.id}">
          <div class="post-head">
            ${avatarHtml(post._avatar, post.author, 'md')}
            <div class="post-author-info">
              <span class="post-author">${U.escapeHtml(post.author)}</span>
              <span class="post-time">${U.formatTime(post.created_at)}</span>
            </div>
            ${showDelete ? `<button class="post-delete" data-id="${post.id}" title="删除">×</button>` : ''}
          </div>
          <div class="post-content">${U.escapeHtml(post.content)}</div>
          <div class="post-actions">
            <button class="action-like ${liked ? 'liked' : ''}" data-id="${post.id}">
              👍 <span class="like-count">${post.likes || 0}</span>
            </button>
            <button class="action-reply" data-id="${post.id}">
              💬 回复 ${replies.length ? `(${replies.length})` : ''}
            </button>
          </div>
          ${repliesHtml}
          <div class="reply-form" data-post-id="${post.id}" style="display:none;">
            <textarea class="reply-content-input" placeholder="写下你的回复……" maxlength="300"></textarea>
            <div class="reply-form-actions">
              <button class="btn-cancel">取消</button>
              <button class="btn-send">发送</button>
            </div>
          </div>
        </div>`;
    }

    function renderReply(reply) {
      const showDelete = canDelete(reply.user_id);
      return `
        <div class="reply-item" data-id="${reply.id}">
          ${avatarHtml(reply._avatar, reply.author, 'sm')}
          <div class="reply-body">
            <div class="reply-meta">
              <span class="reply-author">${U.escapeHtml(reply.author)}</span>
              <span class="reply-time">${U.formatTime(reply.created_at)}</span>
              ${showDelete ? `<button class="reply-delete" data-id="${reply.id}" title="删除">×</button>` : ''}
            </div>
            <div class="reply-content">${U.escapeHtml(reply.content)}</div>
          </div>
        </div>`;
    }

    async function deletePost(id) {
      if (!confirm('确定删除这条帖子？')) return;
      const { error } = await db.from(TABLE).delete().eq('id', id);
      if (error) return alert('删除失败：' + error.message);
      await loadAll();
    }

    async function deleteReply(id) {
      if (!confirm('确定删除这条回复？')) return;
      const { error } = await db.from(REPLY_TABLE).delete().eq('id', id);
      if (error) return alert('删除失败：' + error.message);
      await loadAll();
    }

    async function toggleLike(postId) {
      const { error } = await db.rpc('toggle_post_like', { p_post_id: Number(postId) });
      if (error) return alert('操作失败：' + error.message);
      await loadAll();
    }

    function toggleReplyForm(postId) {
      const form = postList.querySelector(`.reply-form[data-post-id="${postId}"]`);
      if (!form) return;
      const hidden = form.style.display === 'none';
      if (hidden) {
        postList.querySelectorAll('.reply-form').forEach(f => f.style.display = 'none');
        form.style.display = 'flex';
        form.querySelector('.reply-content-input').focus();
        form.querySelector('.btn-cancel').onclick = () => { form.style.display = 'none'; };
        form.querySelector('.btn-send').onclick = () => submitReply(postId, form);
      } else form.style.display = 'none';
    }

    async function submitReply(postId, form) {
      const content = form.querySelector('.reply-content-input').value.trim();
      if (!content) return alert('请输入回复内容');
      const sendBtn = form.querySelector('.btn-send');
      sendBtn.disabled = true;
      try {
        const { error } = await db.from(REPLY_TABLE).insert({
          post_id: Number(postId),
          class_id: window.currentClassId,
          user_id: currentUser.id,
          author: currentUser.nickname,
          content
        });
        if (error) throw error;
        form.querySelector('.reply-content-input').value = '';
        form.style.display = 'none';
        await loadAll();
      } catch (err) {
        alert('回复失败：' + err.message);
      } finally {
        sendBtn.disabled = false;
      }
    }

    function subscribeRealtime() {
      const cid = window.currentClassId;
      db.channel('forum-posts-' + cid)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: TABLE, filter: `class_id=eq.${cid}` },
          () => { loadAll(); flashStatus(); })
        .subscribe(s => {
          if (s === 'SUBSCRIBED') {
            forumStatus.classList.add('online');
            forumStatus.textContent = '实时同步已连接';
          }
        });

      db.channel('forum-replies-' + cid)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: REPLY_TABLE, filter: `class_id=eq.${cid}` },
          () => { loadAll(); flashStatus(); })
        .subscribe();
    }

    function flashStatus() {
      forumStatus.classList.add('online');
      forumStatus.textContent = '有更新 · 已同步';
      clearTimeout(flashStatus._t);
      flashStatus._t = setTimeout(() => {
        forumStatus.textContent = '实时同步已连接';
      }, 2000);
    }
  }
})();
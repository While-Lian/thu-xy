/* 论坛 v3.2.0：三级 scope + 嵌套回复 + 搜索 + 图片 + @提及 + 分页 */
(function () {
  'use strict';
  const db = window.supabaseClient;
  if (!db) return;
  const U = window.Utils;
  const SK = window.Skeleton;

  const TABLE = 'class_posts';
  const REPLY_TABLE = 'class_replies';
  const LIKE_TABLE = 'post_likes';
  const PAGE_SIZE = 20;

  let currentUser = null;
  let activeScope = 'class';
  let searchKeyword = '';

  let currentPosts = [];
  let currentReplies = [];
  let myLikes = new Set();
  let pendingImages = [];
  let mentionPool = [];

  let currentPage = 0;
  let hasMore = true;
  let isLoading = false;

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
    const scopeTabs = document.querySelectorAll('.scope-tab');
    const postScope = document.getElementById('post-scope');
    const postScopeHint = document.getElementById('post-scope-hint');
    const searchInput = document.getElementById('forum-search');
    const imageInput = document.getElementById('post-image-input');
    const imagePreview = document.getElementById('post-image-preview');
    const loadMoreWrap = document.getElementById('load-more-wrap');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const noMoreHint = document.getElementById('no-more-hint');

    if (!contentInput || !postList) return;

    /* ============ Scope 切换 ============ */
    scopeTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        if (isLoading) return;
        scopeTabs.forEach(b => b.classList.toggle('active', b === btn));
        activeScope = btn.dataset.scope;
        postScope.value = activeScope;
        updateScopeHint();
        loadAll(true);
      });
    });

    postScope.addEventListener('change', updateScopeHint);

    function updateScopeHint() {
      const s = postScope.value;
      const hints = {
        class: '仅本班同学可见',
        grade: '本年级所有班级可见',
        public: '所有登录用户可见'
      };
      if (postScopeHint) postScopeHint.textContent = hints[s] || '';
    }
    updateScopeHint();

    /* ============ 搜索 ============ */
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        searchKeyword = searchInput.value.trim().toLowerCase();
        renderAll();
      });
    }

    /* ============ 字数 ============ */
    contentInput.addEventListener('input', () => {
      charCount.textContent = `${contentInput.value.length} / 500`;
    });

    /* ============ 图片选择 ============ */
    imageInput.addEventListener('change', () => {
      Array.from(imageInput.files).forEach(addPendingImage);
      imageInput.value = '';
    });

    function addPendingImage(file) {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 5 * 1024 * 1024) return alert(`「${file.name}」超过 5MB`);
      if (pendingImages.length >= 9) return alert('最多 9 张图片');
      const reader = new FileReader();
      reader.onload = (e) => {
        pendingImages.push({ file, dataUrl: e.target.result });
        renderImagePreview();
      };
      reader.readAsDataURL(file);
    }

    function renderImagePreview() {
      if (!pendingImages.length) {
        imagePreview.innerHTML = '';
        imagePreview.style.display = 'none';
        return;
      }
      imagePreview.style.display = 'flex';
      imagePreview.innerHTML = pendingImages.map((p, i) => `
        <div class="post-image-thumb">
          <img src="${p.dataUrl}" alt="" />
          <button type="button" class="post-image-remove" data-idx="${i}">×</button>
        </div>
      `).join('');
      imagePreview.querySelectorAll('.post-image-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          pendingImages.splice(Number(btn.dataset.idx), 1);
          renderImagePreview();
        });
      });
    }

    async function uploadPendingImages() {
      const urls = [];
      for (const p of pendingImages) {
        const ext = (p.file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${window.currentClassId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await db.storage.from('forum-images').upload(path, p.file);
        if (error) throw error;
        const { data } = db.storage.from('forum-images').getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      return urls;
    }

    /* ============ 发帖 ============ */
    submitBtn.addEventListener('click', handleSubmit);
    contentInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    });

    async function handleSubmit() {
      const content = contentInput.value.trim();
      if (!content && !pendingImages.length) return alert('请输入内容或添加图片');
      const scope = postScope.value;

      if (scope === 'grade' && !currentUser.grade) {
        return alert('你没有年级信息，无法发布到年级论坛');
      }

      submitBtn.disabled = true;
      submitBtn.textContent = '发布中…';

      try {
        let imageUrls = [];
        if (pendingImages.length) {
          submitBtn.textContent = '上传图片中…';
          imageUrls = await uploadPendingImages();
        }

        const payload = {
          class_id: currentUser.class_id,
          user_id: currentUser.id,
          author: currentUser.nickname,
          content: content || '（图片）',
          scope,
          image_urls: imageUrls
        };
        if (scope === 'grade') payload.grade = currentUser.grade;

        const { data: inserted, error } = await db.from(TABLE).insert(payload).select().single();
        if (error) throw error;

        if (content) notifyMentions(content, inserted.id);

        contentInput.value = '';
        charCount.textContent = '0 / 500';
        pendingImages = [];
        renderImagePreview();

        if (scope !== activeScope) {
          scopeTabs.forEach(b => b.classList.toggle('active', b.dataset.scope === scope));
          activeScope = scope;
        }
        await loadAll(true);
      } catch (err) {
        alert('发布失败：' + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '发布';
      }
    }

    /* ============ @提及 ============ */
    async function ensureMentionPool() {
      if (mentionPool.length) return mentionPool;
      const { data } = await db
        .from('profiles')
        .select('id, nickname, avatar_url')
        .eq('class_id', currentUser.class_id);
      mentionPool = (data || []).filter(m => m.id !== currentUser.id);
      return mentionPool;
    }

    function extractMentions(text) {
      const regex = /@([^\s@#，。！？,.!?]{1,20})/g;
      const set = new Set();
      let m;
      while ((m = regex.exec(text)) !== null) set.add(m[1]);
      return [...set];
    }

    async function notifyMentions(text, postId) {
      const mentions = extractMentions(text);
      if (!mentions.length) return;
      await ensureMentionPool();
      const matched = mentionPool.filter(m => mentions.includes(m.nickname));
      if (!matched.length) return;

      const link = `forum.html#post-${postId}`;
      const body = `${currentUser.nickname} 在帖子中提到你：${text.slice(0, 50)}${text.length > 50 ? '…' : ''}`;

      const notifs = matched.map(p => ({
        user_id: p.id,
        type: 'mention',
        title: '💬 有人 @ 了你',
        body, link,
        related_id: postId
      }));
      try { await db.from('notifications').insert(notifs); } catch (e) { console.warn(e); }
    }

    const mentionPopup = document.getElementById('mention-popup');
    let mentionStart = -1;

    contentInput.addEventListener('input', async () => {
      const val = contentInput.value;
      const pos = contentInput.selectionStart;
      const before = val.slice(0, pos);
      const match = before.match(/@([^\s@#，。！？,.!?]{0,20})$/);
      if (match) {
        mentionStart = pos - match[0].length;
        await ensureMentionPool();
        showMentionPopup(match[1]);
      } else hideMentionPopup();
    });

    contentInput.addEventListener('keydown', (e) => {
      if (mentionPopup.style.display !== 'none' && e.key === 'Escape') hideMentionPopup();
    });
    contentInput.addEventListener('blur', () => setTimeout(hideMentionPopup, 200));

    async function showMentionPopup(keyword) {
      await ensureMentionPool();
      const kw = keyword.toLowerCase();
      const filtered = mentionPool.filter(m => !kw || m.nickname.toLowerCase().includes(kw)).slice(0, 8);
      if (!filtered.length) { hideMentionPopup(); return; }

      mentionPopup.innerHTML = filtered.map(m => {
        const initial = (m.nickname || '?').charAt(0).toUpperCase();
        const av = m.avatar_url
          ? `<img src="${m.avatar_url}" class="mention-avatar" alt="" />`
          : `<span class="mention-avatar mention-avatar-default">${U.escapeHtml(initial)}</span>`;
        return `<div class="mention-item" data-name="${U.escapeHtml(m.nickname)}">${av}<span>${U.escapeHtml(m.nickname)}</span></div>`;
      }).join('');

      mentionPopup.style.display = 'block';
      mentionPopup.querySelectorAll('.mention-item').forEach(item => {
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          insertMention(item.dataset.name);
        });
      });
    }

    function insertMention(name) {
      const val = contentInput.value;
      const pos = contentInput.selectionStart;
      const before = val.slice(0, mentionStart);
      const after = val.slice(pos);
      const insert = `@${name} `;
      contentInput.value = before + insert + after;
      const newPos = before.length + insert.length;
      contentInput.setSelectionRange(newPos, newPos);
      contentInput.focus();
      hideMentionPopup();
      charCount.textContent = `${contentInput.value.length} / 500`;
    }

    function hideMentionPopup() {
      mentionPopup.style.display = 'none';
      mentionStart = -1;
    }

    /* ============ 加载（分页） ============ */
    async function loadAll(reset = true) {
      if (isLoading) return;
      isLoading = true;

      if (reset) {
        currentPage = 0;
        hasMore = true;
        currentPosts = [];
        currentReplies = [];
        postList.innerHTML = SK.posts(3);
        loadMoreWrap.style.display = 'none';
      }

      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = db.from(TABLE).select('*').range(from, to);
      if (activeScope === 'class') {
        query = query.eq('scope', 'class').eq('class_id', currentUser.class_id);
      } else if (activeScope === 'grade') {
        query = query.eq('scope', 'grade').eq('grade', currentUser.grade || '__none__');
      } else {
        query = query.eq('scope', 'public');
      }

      const { data: posts, error } = await query
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        postList.innerHTML = '<div class="post-empty">加载失败</div>';
        isLoading = false;
        return;
      }

      const newPosts = posts || [];
      if (reset) currentPosts = newPosts;
      else currentPosts = [...currentPosts, ...newPosts];

      hasMore = newPosts.length === PAGE_SIZE;
      currentPage++;

      // 拉头像
      const authorIds = [...new Set(currentPosts.map(p => p.user_id).filter(Boolean))];
      let profileMap = {};
      if (authorIds.length) {
        const { data: profiles } = await db.from('profiles').select('id, avatar_url').in('id', authorIds);
        (profiles || []).forEach(p => { profileMap[p.id] = p; });
      }
      currentPosts.forEach(p => { p._avatar = profileMap[p.user_id]?.avatar_url || null; });

      // 我的点赞
      const { data: likes } = await db.from(LIKE_TABLE)
        .select('post_id').eq('user_id', currentUser.id);
      myLikes = new Set((likes || []).map(l => String(l.post_id)));

      // 回复
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
      updateLoadMoreUI();
      isLoading = false;
    }

    function updateLoadMoreUI() {
      if (currentPosts.length === 0) {
        loadMoreWrap.style.display = 'none';
        return;
      }
      loadMoreWrap.style.display = 'block';
      if (hasMore) {
        loadMoreBtn.style.display = '';
        noMoreHint.style.display = 'none';
      } else {
        loadMoreBtn.style.display = 'none';
        noMoreHint.style.display = currentPosts.length >= PAGE_SIZE ? 'block' : 'none';
      }
    }

    loadMoreBtn.addEventListener('click', async () => {
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = '加载中…';
      await loadAll(false);
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = '加载更多';
    });

    function avatarHtml(url, name, size) {
      const cls = size === 'sm' ? 'avatar-sm' : 'avatar-md';
      if (url) return `<img src="${url}" class="${cls}" alt="" />`;
      const initial = (name || '?').charAt(0).toUpperCase();
      return `<span class="${cls} ${cls}-default">${U.escapeHtml(initial)}</span>`;
    }

    function scopeBadge(scope) {
      const map = {
        class: { label: '本班', cls: 'scope-badge-class' },
        grade: { label: '年级', cls: 'scope-badge-grade' },
        public: { label: '公共', cls: 'scope-badge-public' }
      };
      const m = map[scope] || map.class;
      return `<span class="scope-badge ${m.cls}">${m.label}</span>`;
    }

    function classTag(post) {
      if (post.scope === 'class') return '';
      const info = SITE_CONFIG.classes.find(c => c.id === post.class_id);
      return `<span class="post-class-tag">${U.escapeHtml(info ? info.name : post.class_id)}</span>`;
    }

    function highlight(text, keyword) {
      if (!keyword) return U.escapeHtml(text);
      const safe = U.escapeHtml(text);
      const regex = new RegExp('(' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      return safe.replace(regex, '<mark>$1</mark>');
    }

    function renderAll() {
      let posts = currentPosts;
      if (searchKeyword) {
        posts = posts.filter(p =>
          (p.content || '').toLowerCase().includes(searchKeyword) ||
          (p.author || '').toLowerCase().includes(searchKeyword)
        );
      }

      if (!posts.length) {
        const tips = {
          class: '本班还没有帖子，来发第一帖吧 🛋️',
          grade: '年级论坛还没有帖子',
          public: '公共论坛还没有帖子'
        };
        const msg = searchKeyword ? '没有匹配的帖子' : (tips[activeScope] || '暂无帖子');
        postList.innerHTML = `<div class="post-empty">${msg}</div>`;
        return;
      }
      postList.innerHTML = posts.map(renderPost).join('');
      bindEvents();
    }

    function canDelete(ownerUserId) {
      return U.isAdminRole(currentUser.role) || currentUser.id === ownerUserId;
    }

    function renderImages(urls) {
      if (!urls || !urls.length) return '';
      const list = Array.isArray(urls) ? urls : [];
      const gridCls = list.length === 1 ? 'post-images-single'
        : list.length === 2 ? 'post-images-two'
        : 'post-images-grid';
      return `<div class="post-images ${gridCls}">
        ${list.map(u => `<img src="${u}" class="post-image" loading="lazy" alt="" />`).join('')}
      </div>`;
    }

    function renderPost(post) {
      const topReplies = currentReplies.filter(r => r.post_id === post.id && !r.parent_id);
      const liked = myLikes.has(String(post.id));
      const showDelete = canDelete(post.user_id);
      const showScopeBadge = activeScope === 'public' || activeScope === 'grade';

      const repliesHtml = topReplies.length
        ? `<div class="replies">${topReplies.map(r => renderReplyTree(r, 0)).join('')}</div>` : '';

      return `
        <div class="post-item" id="post-${post.id}" data-id="${post.id}">
          <div class="post-head">
            ${avatarHtml(post._avatar, post.author, 'md')}
            <div class="post-author-info">
              <span class="post-author">
                ${highlight(post.author, searchKeyword)}
                ${showScopeBadge ? scopeBadge(post.scope) : ''}
                ${classTag(post)}
              </span>
              <span class="post-time">${U.formatTime(post.created_at)}</span>
            </div>
            ${showDelete ? `<button class="post-delete" data-id="${post.id}" title="删除">×</button>` : ''}
          </div>
          <div class="post-content">${highlight(post.content, searchKeyword)}</div>
          ${renderImages(post.image_urls)}
          <div class="post-actions">
            <button class="action-like ${liked ? 'liked' : ''}" data-id="${post.id}">
              👍 <span class="like-count">${post.likes || 0}</span>
            </button>
            <button class="action-reply" data-id="${post.id}">
              💬 回复 ${topReplies.length ? `(${topReplies.length})` : ''}
            </button>
          </div>
          ${repliesHtml}
          <div class="reply-form" data-post-id="${post.id}" data-parent-id="" style="display:none;">
            <textarea class="reply-content-input" placeholder="写下你的回复……（输入 @ 可提及同学）" maxlength="300"></textarea>
            <div class="reply-form-actions">
              <button class="btn-cancel">取消</button>
              <button class="btn-send">发送</button>
            </div>
          </div>
        </div>`;
    }

    function renderReplyTree(reply, depth) {
      const showDelete = canDelete(reply.user_id);
      const children = currentReplies.filter(r => r.parent_id === reply.id);
      const maxDepth = 3;
      const actualDepth = Math.min(depth, maxDepth);

      const childrenHtml = children.length
        ? `<div class="reply-children">${children.map(c => renderReplyTree(c, depth + 1)).join('')}</div>`
        : '';

      let replyToHtml = '';
      if (reply.parent_id) {
        const parent = currentReplies.find(r => r.id === reply.parent_id);
        if (parent) replyToHtml = `<span class="reply-to">回复 @${U.escapeHtml(parent.author)}</span> `;
      }

      return `
        <div class="reply-item depth-${actualDepth}" data-id="${reply.id}">
          ${avatarHtml(reply._avatar, reply.author, 'sm')}
          <div class="reply-body">
            <div class="reply-meta">
              <span class="reply-author">${U.escapeHtml(reply.author)}</span>
              <span class="reply-time">${U.formatTime(reply.created_at)}</span>
              ${showDelete ? `<button class="reply-delete" data-id="${reply.id}" title="删除">×</button>` : ''}
            </div>
            <div class="reply-content">${replyToHtml}${U.escapeHtml(reply.content)}</div>
            <div class="reply-actions-inline">
              <button class="reply-to-btn" data-reply-to="${reply.id}" data-post-id="${reply.post_id}">回复</button>
            </div>
            ${childrenHtml}
            <div class="reply-form nested" data-post-id="${reply.post_id}" data-parent-id="${reply.id}" style="display:none;">
              <textarea class="reply-content-input" placeholder="回复 @${U.escapeHtml(reply.author)}……" maxlength="300"></textarea>
              <div class="reply-form-actions">
                <button class="btn-cancel">取消</button>
                <button class="btn-send">发送</button>
              </div>
            </div>
          </div>
        </div>`;
    }

    function bindEvents() {
      postList.querySelectorAll('.post-delete').forEach(b =>
        b.addEventListener('click', () => deletePost(b.dataset.id)));
      postList.querySelectorAll('.action-like').forEach(b =>
        b.addEventListener('click', () => toggleLike(b.dataset.id)));
      postList.querySelectorAll('.action-reply').forEach(b =>
        b.addEventListener('click', () => toggleReplyForm(b.dataset.id, '')));
      postList.querySelectorAll('.reply-to-btn').forEach(b =>
        b.addEventListener('click', () => toggleReplyForm(b.dataset.postId, b.dataset.replyTo)));
      postList.querySelectorAll('.reply-delete').forEach(b =>
        b.addEventListener('click', () => deleteReply(b.dataset.id)));
      postList.querySelectorAll('.post-image').forEach(img =>
        img.addEventListener('click', () => openImage(img.src)));
    }

    function openImage(src) {
      const viewer = document.getElementById('image-viewer');
      document.getElementById('image-viewer-img').src = src;
      viewer.style.display = 'flex';
    }

    const viewer = document.getElementById('image-viewer');
    document.getElementById('image-viewer-close').addEventListener('click', () => {
      viewer.style.display = 'none';
    });
    viewer.addEventListener('click', (e) => { if (e.target === viewer) viewer.style.display = 'none'; });

    async function deletePost(id) {
      if (!confirm('确定删除这条帖子？所有回复也会一并删除。')) return;
      const { error } = await db.from(TABLE).delete().eq('id', id);
      if (error) return alert('删除失败：' + error.message);
      await loadAll(true);
    }

    async function deleteReply(id) {
      if (!confirm('确定删除这条回复？其下的所有子回复也会被删除。')) return;
      const { error } = await db.from(REPLY_TABLE).delete().eq('id', id);
      if (error) return alert('删除失败：' + error.message);
      await loadAll(true);
    }

    async function toggleLike(postId) {
      const { error } = await db.rpc('toggle_post_like', { p_post_id: Number(postId) });
      if (error) return alert('操作失败：' + error.message);
      await loadAll(true);
    }

    function toggleReplyForm(postId, parentId) {
      const selector = parentId
        ? `.reply-form[data-post-id="${postId}"][data-parent-id="${parentId}"]`
        : `.reply-form[data-post-id="${postId}"][data-parent-id=""]`;
      const form = postList.querySelector(selector);
      if (!form) return;

      const hidden = form.style.display === 'none';
      postList.querySelectorAll('.reply-form').forEach(f => f.style.display = 'none');
      if (hidden) {
        form.style.display = 'flex';
        form.querySelector('.reply-content-input').focus();
        form.querySelector('.btn-cancel').onclick = () => { form.style.display = 'none'; };
        form.querySelector('.btn-send').onclick = () => submitReply(postId, parentId, form);
      }
    }

    async function submitReply(postId, parentId, form) {
      const content = form.querySelector('.reply-content-input').value.trim();
      if (!content) return alert('请输入回复内容');
      const post = currentPosts.find(p => String(p.id) === String(postId));
      if (!post) return alert('帖子不存在');

      const sendBtn = form.querySelector('.btn-send');
      sendBtn.disabled = true;
      sendBtn.textContent = '发送中…';

      try {
        const payload = {
          post_id: Number(postId),
          class_id: post.class_id,
          user_id: currentUser.id,
          author: currentUser.nickname,
          content
        };
        if (parentId) payload.parent_id = Number(parentId);

        const { error } = await db.from(REPLY_TABLE).insert(payload);
        if (error) throw error;

        notifyMentions(content, postId);

        form.querySelector('.reply-content-input').value = '';
        form.style.display = 'none';
        await loadAll(true);
      } catch (err) {
        alert('回复失败：' + err.message);
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = '发送';
      }
    }

    function subscribeRealtime() {
      const cid = currentUser.class_id;
      db.channel('forum-posts-' + cid + '-' + activeScope)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: TABLE },
          () => { loadAll(true); flashStatus(); })
        .on('postgres_changes',
          { event: '*', schema: 'public', table: REPLY_TABLE },
          () => { loadAll(true); flashStatus(); })
        .subscribe(s => {
          if (s === 'SUBSCRIBED') {
            forumStatus.classList.add('online');
            forumStatus.textContent = '实时同步已连接';
          }
        });
    }

    function flashStatus() {
      forumStatus.classList.add('online');
      forumStatus.textContent = '有更新 · 已同步';
      clearTimeout(flashStatus._t);
      flashStatus._t = setTimeout(() => {
        forumStatus.textContent = '实时同步已连接';
      }, 2000);
    }

    loadAll(true);
    subscribeRealtime();
  }
})();
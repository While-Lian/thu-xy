/**
 * 班级论坛
 * 支持：分班隔离、发帖、删帖、回复、点赞、实时同步
 */
(function () {
  'use strict';

  const TABLE = 'class_posts';
  const REPLY_TABLE = 'class_replies';
  const AUTHOR_KEY = 'thu-xy-forum-author';
  const LIKED_KEY = 'thu-xy-forum-liked'; // 本机已点赞帖子 ID

  // 兼容不同的 Supabase 客户端变量名
  const db = window.supabaseClient;
  if (!db || typeof db.from !== 'function') {
    console.error('❌ 未找到 Supabase 客户端，请检查 supabase-client.js');
    return;
  }

  const authorInput = document.getElementById('post-author');
  const contentInput = document.getElementById('post-content');
  const submitBtn = document.getElementById('post-submit');
  const charCount = document.getElementById('post-char-count');
  const postList = document.getElementById('post-list');
  const forumStatus = document.getElementById('forum-status');
  const forumClassName = document.getElementById('forum-class-name');

  if (!authorInput || !contentInput || !postList) return;

  // ===== 获取当前班级 ID =====
  function getClassId() {
    if (window.currentClassId) return window.currentClassId;
    const params = new URLSearchParams(location.search);
    return params.get('class') || params.get('classId') || 'default';
  }
  const CLASS_ID = getClassId();

  // 显示班级名（如果 window.currentClassName 存在的话）
  if (window.currentClassName && forumClassName) {
    forumClassName.textContent = window.currentClassName;
  }

  // ===== 已点赞帖子 =====
  function getLikedPosts() {
    try { return JSON.parse(localStorage.getItem(LIKED_KEY) || '[]'); }
    catch { return []; }
  }
  function markLiked(postId) {
    const list = getLikedPosts();
    if (!list.includes(postId)) {
      list.push(postId);
      localStorage.setItem(LIKED_KEY, JSON.stringify(list));
    }
  }
  function isLiked(postId) {
    return getLikedPosts().includes(postId);
  }

  // ===== 数据缓存 =====
  let currentPosts = [];
  let currentReplies = [];

  // ===== 初始化 =====
  function init() {
    const saved = localStorage.getItem(AUTHOR_KEY);
    if (saved) authorInput.value = saved;

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
  }

  // ===== 加载帖子 + 回复 =====
  async function loadAll() {
    // 1. 加载帖子
    const { data: posts, error: err1 } = await db
      .from(TABLE)
      .select('*')
      .eq('class_id', CLASS_ID)
      .order('created_at', { ascending: false })
      .limit(100);

    if (err1) {
      console.error(err1);
      postList.innerHTML = '<div class="post-empty">加载失败</div>';
      return;
    }

    currentPosts = posts || [];

    // 2. 加载这些帖子的回复
    if (currentPosts.length > 0) {
      const postIds = currentPosts.map(p => p.id);
      const { data: replies, error: err2 } = await db
        .from(REPLY_TABLE)
        .select('*')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });

      if (err2) {
        console.error(err2);
        currentReplies = [];
      } else {
        currentReplies = replies || [];
      }
    } else {
      currentReplies = [];
    }

    renderAll();
  }

  // ===== 渲染帖子列表 =====
  function renderAll() {
    if (!currentPosts.length) {
      postList.innerHTML = '<div class="post-empty">还没有人发言，来抢沙发吧 🛋️</div>';
      return;
    }

    postList.innerHTML = currentPosts.map(renderPost).join('');

    // 绑定事件
    postList.querySelectorAll('.post-delete').forEach(btn => {
      btn.addEventListener('click', () => handleDeletePost(btn.dataset.id));
    });
    postList.querySelectorAll('.action-like').forEach(btn => {
      btn.addEventListener('click', () => handleLike(btn.dataset.id));
    });
    postList.querySelectorAll('.action-reply').forEach(btn => {
      btn.addEventListener('click', () => toggleReplyForm(btn.dataset.id));
    });
    postList.querySelectorAll('.reply-delete').forEach(btn => {
      btn.addEventListener('click', () => handleDeleteReply(btn.dataset.id));
    });
  }

  // ===== 渲染单个帖子（含回复） =====
  function renderPost(post) {
    const replies = currentReplies.filter(r => r.post_id === post.id);
    const liked = isLiked(post.id);

    const repliesHtml = replies.length
      ? `<div class="replies">${replies.map(renderReply).join('')}</div>`
      : '';

    return `
      <div class="post-item" data-id="${post.id}">
        <button class="post-delete" data-id="${post.id}" title="删除帖子">✕</button>
        <div class="post-meta">
          <span class="post-author">${esc(post.author)}</span>
          <span class="post-time">${fmt(post.created_at)}</span>
        </div>
        <div class="post-content">${esc(post.content)}</div>
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
      </div>
    `;
  }

  // ===== 渲染单条回复 =====
  function renderReply(reply) {
    return `
      <div class="reply-item" data-id="${reply.id}">
        <button class="reply-delete" data-id="${reply.id}" title="删除回复">✕</button>
        <div class="reply-meta">
          <span class="reply-author">${esc(reply.author)}</span>
          <span class="reply-time">${fmt(reply.created_at)}</span>
        </div>
        <div class="reply-content">${esc(reply.content)}</div>
      </div>
    `;
  }

  // ===== 发帖 =====
  async function handleSubmit() {
    const author = authorInput.value.trim();
    const content = contentInput.value.trim();
    if (!author) return alert('请输入名字或昵称');
    if (!content) return alert('请输入内容');

    submitBtn.disabled = true;
    submitBtn.textContent = '发布中…';
    try {
      const { error } = await db.from(TABLE).insert({
        class_id: CLASS_ID,
        author,
        content,
      });
      if (error) throw error;
      localStorage.setItem(AUTHOR_KEY, author);
      contentInput.value = '';
      charCount.textContent = '0 / 500';
      await loadAll();
    } catch (err) {
      console.error(err);
      alert('发布失败：' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '发布';
    }
  }

  // ===== 删帖 =====
  async function handleDeletePost(id) {
    if (!confirm('确定删除这条帖子？此操作不可恢复，回复也会一并删除。')) return;
    const { error } = await db.from(TABLE).delete().eq('id', id);
    if (error) return alert('删除失败：' + error.message);
    await loadAll();
  }

  // ===== 点赞 =====
  async function handleLike(postId) {
    if (isLiked(postId)) {
      return alert('你已经点过赞了');
    }
    // 调用原子自增函数
    const { error } = await db.rpc('increment_post_likes', { p_post_id: Number(postId) });
    if (error) {
      console.error(error);
      return alert('点赞失败：' + error.message);
    }
    markLiked(postId);
    // 本地更新 UI，避免重新加载
    const post = currentPosts.find(p => String(p.id) === String(postId));
    if (post) post.likes = (post.likes || 0) + 1;
    renderAll();
  }

  // ===== 展开/收起回复框 =====
  function toggleReplyForm(postId) {
    const form = postList.querySelector(`.reply-form[data-post-id="${postId}"]`);
    if (!form) return;

    const isHidden = form.style.display === 'none';
    if (isHidden) {
      // 收起其他已打开的
      postList.querySelectorAll('.reply-form').forEach(f => f.style.display = 'none');
      form.style.display = 'flex';
      form.querySelector('.reply-content-input').focus();

      // 绑定按钮事件（每次打开都重新绑定，避免重复）
      const cancelBtn = form.querySelector('.btn-cancel');
      const sendBtn = form.querySelector('.btn-send');
      cancelBtn.onclick = () => { form.style.display = 'none'; };
      sendBtn.onclick = () => submitReply(postId, form);
    } else {
      form.style.display = 'none';
    }
  }

  // ===== 提交回复 =====
  async function submitReply(postId, form) {
    const author = authorInput.value.trim();
    const content = form.querySelector('.reply-content-input').value.trim();

    if (!author) {
      form.style.display = 'none';
      authorInput.focus();
      return alert('请先在上方填写你的名字或昵称');
    }
    if (!content) return alert('请输入回复内容');

    const sendBtn = form.querySelector('.btn-send');
    sendBtn.disabled = true;
    sendBtn.textContent = '发送中…';

    try {
      const { error } = await db.from(REPLY_TABLE).insert({
        post_id: Number(postId),
        class_id: CLASS_ID,
        author,
        content,
      });
      if (error) throw error;
      localStorage.setItem(AUTHOR_KEY, author);
      form.querySelector('.reply-content-input').value = '';
      form.style.display = 'none';
      await loadAll();
    } catch (err) {
      console.error(err);
      alert('回复失败：' + err.message);
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = '发送';
    }
  }

  // ===== 删除回复 =====
  async function handleDeleteReply(id) {
    if (!confirm('确定删除这条回复？')) return;
    const { error } = await db.from(REPLY_TABLE).delete().eq('id', id);
    if (error) return alert('删除失败：' + error.message);
    await loadAll();
  }

  // ===== 实时同步 =====
  function subscribeRealtime() {
    // 订阅帖子变化
    db.channel('forum-posts-' + CLASS_ID)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: TABLE, filter: `class_id=eq.${CLASS_ID}` },
        () => { loadAll(); flashStatus(); }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          forumStatus.classList.add('online');
          forumStatus.textContent = '实时同步已连接';
        }
      });

    // 订阅回复变化
    db.channel('forum-replies-' + CLASS_ID)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: REPLY_TABLE, filter: `class_id=eq.${CLASS_ID}` },
        () => { loadAll(); flashStatus(); }
      )
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

  // ===== 工具函数 =====
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function fmt(iso) {
    const d = new Date(iso), now = new Date();
    const m = Math.floor((now - d) / 60000);
    if (m < 1) return '刚刚';
    if (m < 60) return `${m} 分钟前`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} 小时前`;
    const day = Math.floor(h / 24);
    if (day < 7) return `${day} 天前`;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
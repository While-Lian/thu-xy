(function () {
  'use strict';

  const TABLE = 'class_posts';
  const AUTHOR_KEY = 'thu-xy-forum-author';

  // 兼容不同的 Supabase 客户端变量名
  const db = window.supabaseClient || window.supabase;
  if (!db) {
    console.error('找不到 Supabase 客户端，请检查 supabase-client.js 是否引入');
    return;
  }

  const authorInput = document.getElementById('post-author');
  const contentInput = document.getElementById('post-content');
  const submitBtn = document.getElementById('post-submit');
  const charCount = document.getElementById('post-char-count');
  const postList = document.getElementById('post-list');
  const forumStatus = document.getElementById('forum-status');

  if (!authorInput || !contentInput || !postList) return;

  // 获取当前班级 ID：优先 window.currentClassId，其次 URL ?class=xxx
  function getClassId() {
    if (window.currentClassId) return window.currentClassId;
    const params = new URLSearchParams(location.search);
    return params.get('class') || params.get('classId') || 'default';
  }
  const CLASS_ID = getClassId();

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

    loadPosts();
    subscribeRealtime();
  }

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
    } catch (err) {
      console.error(err);
      alert('发布失败：' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '发布';
    }
  }

  async function loadPosts() {
    const { data, error } = await db
      .from(TABLE)
      .select('*')
      .eq('class_id', CLASS_ID)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error(error);
      postList.innerHTML = '<div class="post-empty">加载失败</div>';
      return;
    }
    renderPosts(data || []);
  }

  function renderPosts(posts) {
    if (!posts.length) {
      postList.innerHTML = '<div class="post-empty">还没有人发言，来抢沙发吧 🛋️</div>';
      return;
    }
    postList.innerHTML = posts.map((p) => `
      <div class="post-item" data-id="${p.id}">
        <button class="post-delete" data-id="${p.id}" title="删除">✕</button>
        <div class="post-meta">
          <span class="post-author">${esc(p.author)}</span>
          <span class="post-time">${fmt(p.created_at)}</span>
        </div>
        <div class="post-content">${esc(p.content)}</div>
      </div>
    `).join('');

    postList.querySelectorAll('.post-delete').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (!confirm('确定删除这条帖子？')) return;
        const { error } = await db.from(TABLE).delete().eq('id', id);
        if (error) alert('删除失败：' + error.message);
      });
    });
  }

  function subscribeRealtime() {
    db.channel('forum-posts')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: TABLE, filter: `class_id=eq.${CLASS_ID}` },
        () => { loadPosts(); flashStatus(); }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
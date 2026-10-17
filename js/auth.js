/**
 * 认证模块 v3.4.0
 */
(function () {
  'use strict';

  const db = window.supabaseClient;
  if (!db) { console.error('未找到 Supabase 客户端'); return; }

  const $ = (id) => document.getElementById(id);
  const isLoginPage = !!document.getElementById('login-view');
  const currentPage = location.pathname.split('/').pop() || 'index.html';
  const FREE_PAGES = ['login.html', 'classes.html', 'requests.html'];

  if (isLoginPage) initLoginPage();
  else guardPage();

  function initLoginPage() {
    db.auth.getSession().then(({ data }) => {
      if (data.session) location.href = 'index.html';
    });

    const views = {
      login: $('login-view'),
      register: $('register-view'),
      forgot: $('forgot-view')
    };
    function showView(name) {
      Object.keys(views).forEach(k => {
        views[k].style.display = k === name ? 'block' : 'none';
      });
      setMsg('');
    }

    $('to-register').addEventListener('click', (e) => { e.preventDefault(); showView('register'); });
    $('to-login').addEventListener('click', (e) => { e.preventDefault(); showView('login'); });
    $('forgot-link').addEventListener('click', (e) => { e.preventDefault(); showView('forgot'); });
    $('forgot-back').addEventListener('click', (e) => { e.preventDefault(); showView('login'); });

    $('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      setMsg('登录中…');
      const email = $('login-email').value.trim();
      const password = $('login-password').value;
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) return setMsg('登录失败：' + error.message, 'error');
      location.href = 'index.html';
    });

    $('register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      setMsg('');

      const email = $('reg-email').value.trim();
      const password = $('reg-password').value;
      const nickname = $('reg-nickname').value.trim();
      const inviteCode = ($('reg-invite-code')?.value || '').trim();

      if (!email || !password || !nickname) return setMsg('请填写完整信息', 'error');
      if (password.length < 6) return setMsg('密码至少 6 位', 'error');

      setMsg('检查中…');
      try {
        const { data: nicknameOk } = await db.rpc('check_nickname_available', { p_nickname: nickname });
        if (nicknameOk === false) return setMsg('昵称已被使用，请换一个', 'error');
        const { data: emailOk } = await db.rpc('check_email_available', { p_email: email });
        if (emailOk === false) return setMsg('该邮箱已被注册，请直接登录', 'error');
      } catch (err) { console.warn(err); }

      setMsg('注册中…');
      const metaData = { nickname };
      if (inviteCode) metaData.invite_code = inviteCode;

      try {
        const { data, error } = await db.auth.signUp({ email, password, options: { data: metaData } });
        if (error) throw error;

        if (data.user && data.user.identities && data.user.identities.length === 0) {
          return setMsg('该邮箱已被注册，请直接登录', 'error');
        }

        if (data.session) {
          setMsg('注册成功，正在进入…', 'success');
          setTimeout(() => { location.href = 'classes.html'; }, 800);
        } else {
          setMsg('注册成功！请登录', 'success');
          setTimeout(() => { showView('login'); $('login-email').value = email; }, 1200);
        }
      } catch (err) {
        setMsg('注册失败：' + err.message, 'error');
      }
    });
  }

  function setMsg(text, type) {
    const el = $('auth-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'auth-msg' + (type ? ' ' + type : '');
  }

  async function guardPage() {
    document.documentElement.style.visibility = 'hidden';

    const { data } = await db.auth.getSession();
    if (!data.session) {
      location.href = 'login.html';
      return;
    }

    await loadUserProfile(data.session.user);

    window.currentClassId = window.currentUser.class_id;
    document.documentElement.style.visibility = 'visible';

    if (!window.currentUser.class_id && !FREE_PAGES.includes(currentPage)) {
      location.href = 'classes.html';
      return;
    }

    if (window.Topbar) window.Topbar.render();
    window.dispatchEvent(new CustomEvent('user-ready', { detail: window.currentUser }));
  }

  async function loadUserProfile(user) {
    const { data, error } = await db.from('profiles').select('*').eq('id', user.id).single();

    if (error || !data) {
      window.currentUser = {
        id: user.id,
        email: user.email,
        nickname: user.user_metadata?.nickname || '同学',
        class_id: null, grade: null, role: 'student', avatar_url: null,
        wechat: null, phone: null
      };
    } else {
      window.currentUser = {
        id: user.id,
        email: user.email,
        nickname: data.nickname,
        class_id: data.class_id || null,
        grade: data.grade || null,
        role: data.role,
        avatar_url: data.avatar_url || null,
        wechat: data.wechat || null,
        phone: data.phone || null
      };
    }
  }

  db.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' && !isLoginPage) location.href = 'login.html';
  });
})();
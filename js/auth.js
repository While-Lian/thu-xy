/**
 * 认证模块 v1.0.2
 */
(function () {
  'use strict';

  const db = window.supabaseClient;
  if (!db) { console.error('未找到 Supabase 客户端'); return; }

  const $ = (id) => document.getElementById(id);
  const isLoginPage = !!document.getElementById('login-view');

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
      const classId = $('reg-class').value;
      const adminCode = $('reg-admin-code').value.trim();

      if (!email || !password || !nickname || !classId) {
        return setMsg('请填写完整信息', 'error');
      }
      if (password.length < 6) return setMsg('密码至少 6 位', 'error');
      if (nickname.length < 1 || nickname.length > 20) return setMsg('昵称长度 1-20 字', 'error');

      setMsg('检查中…');
      try {
        const { data: nicknameOk, error: nickErr } = await db.rpc(
          'check_nickname_available', { p_nickname: nickname }
        );
        if (!nickErr && nicknameOk === false) {
          return setMsg('昵称「' + nickname + '」已被使用，请换一个', 'error');
        }
      } catch (err) { console.warn('昵称检查异常', err); }

      try {
        const { data: emailOk, error: emailErr } = await db.rpc(
          'check_email_available', { p_email: email }
        );
        if (!emailErr && emailOk === false) {
          return setMsg('该邮箱已被注册，请直接登录或换一个邮箱', 'error');
        }
      } catch (err) { console.warn('邮箱检查异常', err); }

      setMsg('注册中…');

      if (adminCode) {
        localStorage.setItem('pending_admin_code', adminCode);
        localStorage.setItem('pending_admin_class', classId);
      }

      let signUpResult;
      try {
        signUpResult = await db.auth.signUp({
          email, password,
          options: { data: { nickname, class_id: classId } }
        });
      } catch (err) {
        clearPending();
        return setMsg('注册失败：' + (err.message || '未知错误'), 'error');
      }

      const { data, error } = signUpResult;

      if (error) {
        clearPending();
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
          return setMsg('该邮箱已被注册，请直接登录或换一个邮箱', 'error');
        }
        if (msg.includes('rate limit')) {
          return setMsg('注册过于频繁，请稍后再试', 'error');
        }
        return setMsg('注册失败：' + error.message, 'error');
      }

      if (
        data && data.user &&
        Array.isArray(data.user.identities) &&
        data.user.identities.length === 0
      ) {
        clearPending();
        return setMsg('该邮箱已被注册，请直接登录或换一个邮箱', 'error');
      }

      if (data && data.session) {
        setMsg('注册成功，正在进入…', 'success');
        setTimeout(() => { location.href = 'index.html'; }, 800);
      } else {
        setMsg('注册成功！请用刚填的邮箱和密码登录', 'success');
        setTimeout(() => {
          showView('login');
          $('login-email').value = email;
        }, 1200);
      }

      function clearPending() {
        localStorage.removeItem('pending_admin_code');
        localStorage.removeItem('pending_admin_class');
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
    await processPendingAdminCode();

    window.currentClassId = window.currentUser.class_id;
    document.documentElement.style.visibility = 'visible';

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
        class_id: user.user_metadata?.class_id || 'default',
        role: 'user',
        avatar_url: null
      };
    } else {
      window.currentUser = {
        id: user.id,
        email: user.email,
        nickname: data.nickname,
        class_id: data.class_id,
        role: data.role,
        avatar_url: data.avatar_url || null
      };
    }
  }

  async function processPendingAdminCode() {
    const code = localStorage.getItem('pending_admin_code');
    const cls = localStorage.getItem('pending_admin_class');
    if (!code || !cls) return;

    const { data, error } = await db.rpc('register_as_admin', {
      p_class_id: cls, p_code: code
    });
    if (!error && data === true) {
      window.currentUser.role = 'admin';
    }
    localStorage.removeItem('pending_admin_code');
    localStorage.removeItem('pending_admin_class');
  }

  db.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' && !isLoginPage) location.href = 'login.html';
  });
})();
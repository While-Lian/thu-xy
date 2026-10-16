/* 个人中心 v3.2.1 */
(function () {
  'use strict';
  const db = window.supabaseClient;
  if (!db) return;
  const U = window.Utils;

  let currentUser = null;

  window.addEventListener('user-ready', (e) => {
    currentUser = e.detail;
    initProfile();
  });

  function initProfile() {
    const nameEl = document.getElementById('profile-nickname');
    const emailEl = document.getElementById('profile-email');
    const roleEl = document.getElementById('profile-role');
    const classEl = document.getElementById('profile-class');
    const avatarPreview = document.getElementById('avatar-preview');
    const avatarInput = document.getElementById('avatar-input');
    const avatarBtn = document.getElementById('avatar-change-btn');

    const classInfo = SITE_CONFIG.classes.find(c => c.id === currentUser.class_id);

    nameEl.textContent = currentUser.nickname;
    emailEl.textContent = currentUser.email;
    roleEl.textContent = U.roleName(currentUser.role);
    roleEl.className = 'profile-value role-' + currentUser.role;
    classEl.textContent = classInfo ? classInfo.name : (currentUser.class_id || '未加入班级');

    // 未加入班级 → 隐藏退出班级按钮
    if (!currentUser.class_id) {
      const leaveBtn = document.getElementById('leave-class-btn');
      if (leaveBtn) {
        leaveBtn.disabled = true;
        leaveBtn.textContent = '未加入班级';
        leaveBtn.style.opacity = '0.5';
        leaveBtn.style.cursor = 'not-allowed';
      }
    }

    renderAvatar();

    avatarBtn.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', () => {
      if (avatarInput.files.length) uploadAvatar(avatarInput.files[0]);
      avatarInput.value = '';
    });

    function renderAvatar() {
      const initial = (currentUser.nickname || '?').charAt(0).toUpperCase();
      if (currentUser.avatar_url) {
        avatarPreview.innerHTML = `<img src="${currentUser.avatar_url}" alt="" />`;
      } else {
        avatarPreview.innerHTML = `<span>${U.escapeHtml(initial)}</span>`;
      }
    }

    async function uploadAvatar(file) {
      if (!file.type.startsWith('image/')) return alert('请上传图片文件');
      if (file.size > 5 * 1024 * 1024) return alert('图片不能超过 5MB');

      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${currentUser.id}/avatar-${Date.now()}.${ext}`;

      avatarBtn.disabled = true;
      avatarBtn.textContent = '上传中…';

      try {
        // 1. 上传到 Storage
        const { error: upErr } = await db.storage
          .from('avatars')
          .upload(path, file, { upsert: true });
        if (upErr) throw upErr;

        // 2. 拿公共 URL
        const { data: urlData } = db.storage.from('avatars').getPublicUrl(path);
        const url = urlData.publicUrl;

        // 3. 更新 profiles
        const { error: dbErr } = await db.from('profiles')
          .update({ avatar_url: url })
          .eq('id', currentUser.id);
        if (dbErr) throw dbErr;

        // 4. 更新本地状态
        currentUser.avatar_url = url;
        window.currentUser.avatar_url = url;
        renderAvatar();
        if (window.Topbar) window.Topbar.render();
      } catch (err) {
        alert('上传失败：' + (err.message || err));
      } finally {
        avatarBtn.disabled = false;
        avatarBtn.textContent = '更换头像';
      }
    }

    /* ---------- 修改昵称 ---------- */
    document.getElementById('save-nickname').addEventListener('click', async () => {
      const v = document.getElementById('nickname-input').value.trim();
      if (!v) return alert('昵称不能为空');
      try {
        const { error } = await db.from('profiles').update({ nickname: v }).eq('id', currentUser.id);
        if (error) throw error;
        currentUser.nickname = v;
        window.currentUser.nickname = v;
        nameEl.textContent = v;
        if (window.Topbar) window.Topbar.render();
        alert('昵称已更新');
      } catch (e) {
        alert('更新失败：' + e.message);
      }
    });

    /* ---------- 修改密码 ---------- */
    document.getElementById('save-password').addEventListener('click', async () => {
      const oldP = document.getElementById('pwd-old').value;
      const newP = document.getElementById('pwd-new').value;
      const newP2 = document.getElementById('pwd-new2').value;
      const msgEl = document.getElementById('pwd-msg');

      if (!oldP || !newP || !newP2) { msgEl.textContent = '请填写完整'; msgEl.className = 'form-msg error'; return; }
      if (newP.length < 6) { msgEl.textContent = '新密码至少 6 位'; msgEl.className = 'form-msg error'; return; }
      if (newP !== newP2) { msgEl.textContent = '两次输入的新密码不一致'; msgEl.className = 'form-msg error'; return; }

      try {
        const { error: signErr } = await db.auth.signInWithPassword({
          email: currentUser.email, password: oldP
        });
        if (signErr) throw new Error('原密码错误');

        const { error: updErr } = await db.auth.updateUser({ password: newP });
        if (updErr) throw updErr;

        msgEl.textContent = '密码已更新';
        msgEl.className = 'form-msg success';
        document.getElementById('pwd-old').value = '';
        document.getElementById('pwd-new').value = '';
        document.getElementById('pwd-new2').value = '';
      } catch (e) {
        msgEl.textContent = e.message;
        msgEl.className = 'form-msg error';
      }
    });

    /* ---------- 退出班级 ---------- */
    const leaveBtn = document.getElementById('leave-class-btn');
    if (leaveBtn && currentUser.class_id) {
      leaveBtn.addEventListener('click', async () => {
        if (!confirm('确定退出当前班级吗？\n退出后需要重新申请加入。')) return;
        leaveBtn.disabled = true;
        leaveBtn.textContent = '处理中…';
        try {
          const { error } = await db.rpc('leave_class');
          if (error) throw error;
          alert('已退出班级');
          location.href = 'classes.html';
        } catch (e) {
          alert('退出失败：' + e.message);
          leaveBtn.disabled = false;
          leaveBtn.textContent = '退出班级';
        }
      });
    }

    /* ---------- 注销账号 ---------- */
    const deleteModal = document.getElementById('delete-modal');
    const deletePassword = document.getElementById('delete-password');
    const deleteMsg = document.getElementById('delete-msg');

    document.getElementById('delete-account-btn').addEventListener('click', () => {
      deletePassword.value = '';
      deleteMsg.textContent = '';
      deleteMsg.className = 'form-msg';
      deleteModal.style.display = 'flex';
      setTimeout(() => deletePassword.focus(), 100);
    });

    document.getElementById('delete-cancel').addEventListener('click', () => {
      deleteModal.style.display = 'none';
    });

    deleteModal.addEventListener('click', (e) => {
      if (e.target === deleteModal) deleteModal.style.display = 'none';
    });

    deletePassword.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('delete-confirm').click();
    });

    document.getElementById('delete-confirm').addEventListener('click', async () => {
      const pwd = deletePassword.value;
      if (!pwd) {
        deleteMsg.textContent = '请输入密码';
        deleteMsg.className = 'form-msg error';
        return;
      }

      const confirmBtn = document.getElementById('delete-confirm');
      confirmBtn.disabled = true;
      confirmBtn.textContent = '注销中…';
      deleteMsg.textContent = '';

      try {
        const { error: signErr } = await db.auth.signInWithPassword({
          email: currentUser.email, password: pwd
        });
        if (signErr) throw new Error('密码错误');

        const { delErr } = await db.rpc('delete_own_account');
        if (delErr) throw delErr;

        await db.auth.signOut();
        alert('账号已注销，感谢你的使用。');
        location.href = 'login.html';
      } catch (e) {
        deleteMsg.textContent = e.message || '注销失败';
        deleteMsg.className = 'form-msg error';
        confirmBtn.disabled = false;
        confirmBtn.textContent = '确认注销';
      }
    });
  }
})();

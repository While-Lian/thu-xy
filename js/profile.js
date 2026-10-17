/* 个人中心 v5.0 */
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
    const wechatInput = document.getElementById('wechat-input');
    const phoneInput = document.getElementById('phone-input');

    const classInfo = SITE_CONFIG.classes.find(c => c.id === currentUser.class_id);

    nameEl.textContent = currentUser.nickname;
    emailEl.textContent = currentUser.email;
    roleEl.textContent = U.roleName(currentUser.role);
    roleEl.className = 'profile-value role-' + currentUser.role;
    classEl.textContent = classInfo ? classInfo.name : (currentUser.class_id || '未加入班级');

    // 👇 渲染成就进度条
    const exp = currentUser.exp || 0;
    const levelInfo = U.getLevelInfo(exp);
    const prevExp = [0, 50, 200, 500].filter(x => x <= exp).pop(); // 计算当前等级的起始值
    const nextExp = levelInfo.next;
    const percent = nextExp === 9999 ? 100 : ((exp - prevExp) / (nextExp - prevExp) * 100).toFixed(1);
    
    document.getElementById('exp-level').innerHTML = `<span style="color:${levelInfo.color};">${levelInfo.icon} ${levelInfo.name}</span>`;
    document.getElementById('exp-text').textContent = nextExp === 9999 ? `EXP ${exp}` : `EXP ${exp} / ${nextExp}`;
    document.getElementById('exp-bar').style.width = `${percent}%`;

    if (wechatInput) wechatInput.value = currentUser.wechat || '';
    if (phoneInput) phoneInput.value = currentUser.phone || '';

    if (!currentUser.class_id) {
      const leaveBtn = document.getElementById('leave-class-btn');
      if (leaveBtn) { leaveBtn.disabled = true; leaveBtn.textContent = '未加入班级'; leaveBtn.style.opacity = '0.5'; }
    }

    renderAvatar();

    avatarBtn.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', () => {
      if (avatarInput.files.length) uploadAvatar(avatarInput.files[0]);
      avatarInput.value = '';
    });

    function renderAvatar() {
      const initial = (currentUser.nickname || '?').charAt(0).toUpperCase();
      if (currentUser.avatar_url) avatarPreview.innerHTML = `<img src="${currentUser.avatar_url}" alt="" />`;
      else avatarPreview.innerHTML = `<span>${U.escapeHtml(initial)}</span>`;
    }

    async function uploadAvatar(file) {
      if (!file.type.startsWith('image/')) return alert('请上传图片文件');
      if (file.size > 5 * 1024 * 1024) return alert('图片不能超过 5MB');
      avatarBtn.disabled = true; avatarBtn.textContent = '压缩中…';
      try { file = await U.resizeImage(file, 512, 512, 0.85); } catch (e) { console.error('压缩失败', e); }

      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${currentUser.id}/avatar-${Date.now()}.${ext}`;
      avatarBtn.textContent = '上传中…';

      try {
        if (currentUser.avatar_url) {
          const oldPathMatch = currentUser.avatar_url.split('/avatars/');
          if (oldPathMatch.length > 1) await db.storage.from('avatars').remove([oldPathMatch[1]]);
        }
        const { error: upErr } = await db.storage.from('avatars').upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = db.storage.from('avatars').getPublicUrl(path);
        const url = urlData.publicUrl;
        const { error: dbErr } = await db.from('profiles').update({ avatar_url: url }).eq('id', currentUser.id);
        if (dbErr) throw dbErr;
        currentUser.avatar_url = url; window.currentUser.avatar_url = url;
        renderAvatar(); if (window.Topbar) window.Topbar.render();
      } catch (err) {
        alert('上传失败：' + (err.message || err));
      } finally {
        avatarBtn.disabled = false; avatarBtn.textContent = '更换头像';
      }
    }

    const saveContactBtn = document.getElementById('save-contact');
    if (saveContactBtn) {
      saveContactBtn.addEventListener('click', async () => {
        const wechat = wechatInput.value.trim(), phone = phoneInput.value.trim();
        try {
          const { error } = await db.from('profiles').update({ wechat: wechat || null, phone: phone || null }).eq('id', currentUser.id);
          if (error) throw error;
          currentUser.wechat = wechat; currentUser.phone = phone;
          window.currentUser.wechat = wechat; window.currentUser.phone = phone;
          alert('名片已更新');
        } catch (e) { alert('更新失败：' + e.message); }
      });
    }

    document.getElementById('save-nickname').addEventListener('click', async () => {
      const v = document.getElementById('nickname-input').value.trim();
      if (!v) return alert('昵称不能为空');
      try {
        const { error } = await db.from('profiles').update({ nickname: v }).eq('id', currentUser.id);
        if (error) throw error;
        currentUser.nickname = v; window.currentUser.nickname = v; nameEl.textContent = v;
        if (window.Topbar) window.Topbar.render(); alert('昵称已更新');
      } catch (e) { alert('更新失败：' + e.message); }
    });

    document.getElementById('save-password').addEventListener('click', async () => {
      const oldP = document.getElementById('pwd-old').value, newP = document.getElementById('pwd-new').value, newP2 = document.getElementById('pwd-new2').value;
      const msgEl = document.getElementById('pwd-msg');
      if (!oldP || !newP || !newP2) { msgEl.textContent = '请填写完整'; msgEl.className = 'form-msg error'; return; }
      if (newP.length < 6) { msgEl.textContent = '新密码至少 6 位'; msgEl.className = 'form-msg error'; return; }
      if (newP !== newP2) { msgEl.textContent = '两次输入不一致'; msgEl.className = 'form-msg error'; return; }
      try {
        const { error: signErr } = await db.auth.signInWithPassword({ email: currentUser.email, password: oldP });
        if (signErr) throw new Error('原密码错误');
        const { error: updErr } = await db.auth.updateUser({ password: newP });
        if (updErr) throw updErr;
        msgEl.textContent = '密码已更新'; msgEl.className = 'form-msg success';
        document.getElementById('pwd-old').value = ''; document.getElementById('pwd-new').value = ''; document.getElementById('pwd-new2').value = '';
      } catch (e) { msgEl.textContent = e.message; msgEl.className = 'form-msg error'; }
    });

    const leaveBtn = document.getElementById('leave-class-btn');
    if (leaveBtn && currentUser.class_id) {
      leaveBtn.addEventListener('click', async () => {
        if (!confirm('确定退出当前班级吗？')) return;
        leaveBtn.disabled = true; leaveBtn.textContent = '处理中…';
        try {
          const { error } = await db.rpc('leave_class');
          if (error) throw error;
          alert('已退出班级'); location.href = 'classes.html';
        } catch (e) { alert('退出失败：' + e.message); leaveBtn.disabled = false; leaveBtn.textContent = '退出班级'; }
      });
    }

    const deleteModal = document.getElementById('delete-modal');
    const deletePassword = document.getElementById('delete-password');
    const deleteMsg = document.getElementById('delete-msg');
    document.getElementById('delete-account-btn').addEventListener('click', () => {
      deletePassword.value = ''; deleteMsg.textContent = ''; deleteModal.style.display = 'flex'; setTimeout(() => deletePassword.focus(), 100);
    });
    document.getElementById('delete-cancel').addEventListener('click', () => { deleteModal.style.display = 'none'; });
    deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) deleteModal.style.display = 'none'; });
    deletePassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('delete-confirm').click(); });
    document.getElementById('delete-confirm').addEventListener('click', async () => {
      const pwd = deletePassword.value;
      if (!pwd) { deleteMsg.textContent = '请输入密码'; deleteMsg.className = 'form-msg error'; return; }
      const confirmBtn = document.getElementById('delete-confirm');
      confirmBtn.disabled = true; confirmBtn.textContent = '注销中…'; deleteMsg.textContent = '';
      try {
        const { error: signErr } = await db.auth.signInWithPassword({ email: currentUser.email, password: pwd });
        if (signErr) throw new Error('密码错误');
        const { error: delErr } = await db.rpc('delete_own_account');
        if (delErr) throw delErr;
        await db.auth.signOut(); alert('账号已注销，感谢你的使用。'); location.href = 'login.html';
      } catch (e) { deleteMsg.textContent = e.message || '注销失败'; deleteMsg.className = 'form-msg error'; confirmBtn.disabled = false; confirmBtn.textContent = '确认注销'; }
    });
  }
})();
/* 通用工具 & 顶栏 v3.8.0（含多班切换、CSV导出、移动端适配） */
(function() {
  const originalAddEventListener = window.addEventListener;
  window.addEventListener = function(type, listener, options) {
    if (type === 'user-ready' && window.currentUser) {
      setTimeout(() => { try { listener({ detail: window.currentUser }); } catch (e) { console.error(e); } }, 0); return; 
    }
    return originalAddEventListener.call(window, type, listener, options);
  };
})();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

window.Utils = {
  escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  },
  formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso), now = new Date();
    const m = Math.floor((now - d) / 60000);
    if (m < 1) return '刚刚';
    if (m < 60) return `${m} 分钟前`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} 小时前`;
    const day = Math.floor(h / 24);
    if (day < 7) return `${day} 天前`;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
  formatSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  },
  formatWeeks(weeks) {
    if (!weeks || weeks.length === 0) return '—';
    const isContinuous = weeks.every((w, i) => i === 0 || w === weeks[i - 1] + 1);
    if (weeks.length === 1) return `第${weeks[0]}周`;
    if (isContinuous) return `第${weeks[0]}-${weeks[weeks.length - 1]}周`;
    return '第' + weeks.join('、') + '周';
  },
  formatDeadline(iso) {
    if (!iso) return '';
    const d = new Date(iso), now = new Date(), diff = d - now;
    if (diff < 0) return '已截止';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `还有 ${mins} 分钟`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `还有 ${hours} 小时`;
    return `还有 ${Math.floor(hours / 24)} 天`;
  },
  roleName(role) {
    return { student: '学生', committee: '班委', teacher: '老师' }[role] || role;
  },
  isAdminRole(role) {
    return role === 'committee' || role === 'teacher';
  },
  resizeImage(file, maxWidth = 512, maxHeight = 512, quality = 0.8) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) return resolve(file);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image(); img.src = e.target.result;
        img.onload = () => {
          let width = img.width, height = img.height;
          if (width <= maxWidth && height <= maxHeight) return resolve(file);
          if (width > height) { if (width > maxWidth) { height = Math.round(height * (maxWidth / width)); width = maxWidth; } }
          else { if (height > maxHeight) { width = Math.round(width * (maxHeight / height)); height = maxHeight; } }
          const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (!blob) return resolve(file);
            resolve(new File([blob], file.name, { type: file.type, lastModified: Date.now() }));
          }, file.type, quality);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  },
  exportCSV(filename, headers, rows) {
    let csvContent = "\uFEFF"; // 添加 BOM 防止 Excel 中文乱码
    csvContent += headers.join(",") + "\n";
    rows.forEach(row => {
      const rowText = row.map(cell => {
        let text = String(cell == null ? '' : cell);
        text = text.replace(/"/g, '""'); // 转义双引号
        return `"${text}"`;
      }).join(",");
      csvContent += rowText + "\n";
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }
};

window.Skeleton = {
  posts(count = 3) { return Array.from({ length: count }).map(() => `<div class="sk-post"><div class="sk-row"><div class="sk-avatar"></div><div class="sk-info"><div class="sk-line sk-line-md"></div><div class="sk-line sk-line-sm"></div></div></div><div class="sk-line sk-line-full" style="margin-top:14px;"></div><div class="sk-line sk-line-full" style="width:75%; margin-top:8px;"></div></div>`).join(''); },
  files(count = 4) { return Array.from({ length: count }).map(() => `<div class="sk-file"><div class="sk-icon"></div><div class="sk-info"><div class="sk-line sk-line-md"></div><div class="sk-line sk-line-sm"></div></div></div>`).join(''); },
  members(count = 8) { return Array.from({ length: count }).map(() => `<div class="sk-member"><div class="sk-avatar-lg"></div><div class="sk-line sk-line-sm" style="margin-top:8px;"></div></div>`).join(''); }
};

window.Topbar = {
  async render() {
    const u = window.currentUser;
    if (!u) return;
    const bar = document.getElementById('topbar');
    if (!bar) return;

    const U = window.Utils;
    const currentPage = location.pathname.split('/').pop() || 'index.html';

    if (!u.class_id) {
      bar.innerHTML = `
        <div class="topbar-inner">
          <a href="classes.html" class="topbar-brand">
            <span class="topbar-brand-icon">清</span>
            <span class="topbar-brand-text">清华大学 · 行健书院</span>
          </a>
          <nav class="topbar-nav"><a href="classes.html" class="topbar-link active">班级广场</a></nav>
          <div class="topbar-right">
            <div class="topbar-user" id="topbar-user">
              ${this.avatarHtml(u)}
              <span class="topbar-username">${U.escapeHtml(u.nickname)}</span>
              <span class="topbar-caret">▾</span>
              <div class="topbar-dropdown" id="topbar-dropdown">
                <a href="profile.html">个人中心</a>
                <a href="#" id="topbar-logout">退出登录</a>
              </div>
            </div>
            <button class="mobile-menu-btn" id="mobile-menu-btn">☰</button>
          </div>
        </div>
      `;
      this.bindUserEvents(); this.renderBottomNav(); this.renderMobileDrawer(); return;
    }

    const mainLinks = [
      { href: 'class.html',      label: '班级事务', page: 'class.html' },
      { href: 'forum.html',      label: '班级论坛', page: 'forum.html' },
      { href: 'activities.html', label: '活动统计', page: 'activities.html' },
      { href: 'files.html',      label: '班级文件', page: 'files.html' },
      { href: 'photos.html',     label: '班级相册', page: 'photos.html' },
      { href: 'personal.html',   label: '个人管理', page: 'personal.html' }
    ];

    let pendingCount = 0, managedClasses = [];
    if (U.isAdminRole(u.role)) {
      try {
        const { count } = await window.supabaseClient.from('class_join_requests').select('id', { count: 'exact', head: true }).eq('class_id', u.class_id).eq('status', 'pending');
        pendingCount = count || 0;
      } catch (e) { }
    }
    
    // 👇 如果是老师，获取管理的班级列表
    if (u.role === 'teacher') {
      const { data } = await window.supabaseClient.rpc('get_my_managed_classes');
      managedClasses = data || [];
    }

    const isAdminPage = ['admin.html', 'requests.html', 'stats.html'].includes(currentPage);
    const roleTagHtml = u.role !== 'student' ? `<span class="topbar-role topbar-role-${u.role}">${U.roleName(u.role)}</span>` : '';
    
    // 👇 生成切换班级的 HTML
    let switchClassHtml = '';
    if (u.role === 'teacher' && managedClasses.length > 1) {
      const classInfo = SITE_CONFIG.classes.find(c => c.id === u.class_id);
      const curName = classInfo ? classInfo.name : u.class_id;
      switchClassHtml = `
        <div class="topbar-manage" id="topbar-switch" style="margin-right: 8px;">
          <button class="topbar-link topbar-switch-btn" type="button" style="background:var(--primary-light); color:var(--primary);">
            🏫 ${U.escapeHtml(curName)} <span class="topbar-caret">▾</span>
          </button>
          <div class="topbar-dropdown topbar-manage-dropdown" id="topbar-switch-dropdown" style="min-width: 160px;">
            <div style="padding: 6px 12px; font-size: 11px; color: #999;">切换管理班级</div>
            ${managedClasses.map(c => `
              <a href="#" class="switch-class-item${c.id === u.class_id ? ' active' : ''}" data-id="${c.id}" style="${c.id === u.class_id ? 'background:var(--primary-lighter); color:var(--primary); font-weight:600;' : ''}">
                ${U.escapeHtml(c.name)} ${c.id === u.class_id ? ' ✓' : ''}
              </a>
            `).join('')}
          </div>
        </div>
      `;
    }

    const adminMenuHtml = U.isAdminRole(u.role) ? `
      <div class="topbar-manage" id="topbar-manage">
        <button class="topbar-link topbar-manage-btn${isAdminPage ? ' active' : ''}" type="button">
          管理 ${pendingCount > 0 ? `<span class="topbar-badge">${pendingCount}</span>` : ''} <span class="topbar-caret">▾</span>
        </button>
        <div class="topbar-dropdown topbar-manage-dropdown" id="topbar-manage-dropdown">
          <a href="admin.html">👥 用户管理</a>
          <a href="requests.html">📨 申请审批 ${pendingCount > 0 ? `<span class="topbar-badge-inline">${pendingCount}</span>` : ''}</a>
          <a href="stats.html">📊 数据统计</a>
        </div>
      </div>
    ` : '';

    bar.innerHTML = `
      <div class="topbar-inner">
        <a href="index.html" class="topbar-brand">
          <span class="topbar-brand-icon">清</span>
          <span class="topbar-brand-text">清华大学 · 行健书院</span>
        </a>
        <nav class="topbar-nav">
          ${mainLinks.map(l => `<a href="${l.href}" class="topbar-link${currentPage === l.page ? ' active' : ''}">${U.escapeHtml(l.label)}</a>`).join('')}
        </nav>
        <div class="topbar-right">
          ${switchClassHtml}
          ${adminMenuHtml}
          <div class="topbar-user" id="topbar-user">
            ${this.avatarHtml(u)}
            <span class="topbar-username">${U.escapeHtml(u.nickname)}${roleTagHtml}</span>
            <span class="topbar-caret">▾</span>
            <div class="topbar-dropdown" id="topbar-dropdown">
              <a href="profile.html">👤 个人中心</a>
              <a href="classes.html">🏫 班级广场</a>
              <a href="#" id="topbar-logout">🚪 退出登录</a>
            </div>
          </div>
          <button class="mobile-menu-btn" id="mobile-menu-btn">☰</button>
        </div>
      </div>
    `;

    this.bindUserEvents(); this.bindManageEvents(); this.bindSwitchEvents();
    this.renderBottomNav(); this.renderMobileDrawer(managedClasses); this.bindMobileMenu();
  },

  avatarHtml(u) {
    const initial = (u.nickname || '?').charAt(0).toUpperCase();
    return u.avatar_url ? `<img src="${u.avatar_url}" class="topbar-avatar" alt="" />` : `<span class="topbar-avatar topbar-avatar-default">${window.Utils.escapeHtml(initial)}</span>`;
  },

  bindUserEvents() {
    const userEl = document.getElementById('topbar-user'), dropdown = document.getElementById('topbar-dropdown');
    if (!userEl || !dropdown) return;
    userEl.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.topbar-dropdown').forEach(d => { if (d !== dropdown) d.classList.remove('show'); });
      dropdown.classList.toggle('show');
    });
    document.addEventListener('click', () => dropdown.classList.remove('show'));
    document.getElementById('topbar-logout').addEventListener('click', async (e) => { e.preventDefault(); await window.supabaseClient.auth.signOut(); location.href = 'login.html'; });
  },

  bindManageEvents() {
    const manageEl = document.getElementById('topbar-manage'), dropdown = document.getElementById('topbar-manage-dropdown');
    if (!manageEl || !dropdown) return;
    manageEl.querySelector('.topbar-manage-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.topbar-dropdown').forEach(d => { if (d !== dropdown) d.classList.remove('show'); });
      dropdown.classList.toggle('show');
    });
    document.addEventListener('click', () => dropdown.classList.remove('show'));
  },

  // 👇 绑定多班切换事件
  bindSwitchEvents() {
    const switchEl = document.getElementById('topbar-switch'), dropdown = document.getElementById('topbar-switch-dropdown');
    if (!switchEl || !dropdown) return;
    switchEl.querySelector('.topbar-switch-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.topbar-dropdown').forEach(d => { if (d !== dropdown) d.classList.remove('show'); });
      dropdown.classList.toggle('show');
    });
    document.addEventListener('click', () => dropdown.classList.remove('show'));

    document.querySelectorAll('.switch-class-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.preventDefault();
        const targetId = item.dataset.id;
        if (targetId === window.currentUser.class_id) return;
        if (!confirm('确定切换到该班级吗？页面将自动刷新。')) return;
        
        item.textContent = '切换中...';
        const { error } = await window.supabaseClient.rpc('switch_teacher_class', { p_class_id: targetId });
        if (error) { alert('切换失败：' + error.message); }
        else { location.reload(); }
      });
    });
  },

  renderBottomNav() {
    const u = window.currentUser; if (!u) return;
    const exist = document.getElementById('mobile-bottom-nav'); if (exist) exist.remove();
    const nav = document.createElement('nav'); nav.id = 'mobile-bottom-nav'; nav.className = 'mobile-bottom-nav';
    const p = location.pathname.split('/').pop() || 'index.html';
    if (!u.class_id) {
      nav.innerHTML = `<a href="classes.html" class="mbn-item${p === 'classes.html' ? ' active' : ''}"><span class="mbn-icon">🏫</span><span class="mbn-label">广场</span></a><a href="profile.html" class="mbn-item${p === 'profile.html' ? ' active' : ''}"><span class="mbn-icon">👤</span><span class="mbn-label">我的</span></a>`;
    } else {
      nav.innerHTML = `<a href="class.html" class="mbn-item${p === 'class.html' ? ' active' : ''}"><span class="mbn-icon">📅</span><span class="mbn-label">事务</span></a><a href="forum.html" class="mbn-item${p === 'forum.html' ? ' active' : ''}"><span class="mbn-icon">💬</span><span class="mbn-label">论坛</span></a><a href="activities.html" class="mbn-item${p === 'activities.html' ? ' active' : ''}"><span class="mbn-icon">📊</span><span class="mbn-label">活动</span></a><a href="profile.html" class="mbn-item${['profile.html', 'personal.html', 'files.html', 'photos.html', 'admin.html', 'requests.html', 'stats.html'].includes(p) ? ' active' : ''}"><span class="mbn-icon">👤</span><span class="mbn-label">我的</span></a>`;
    }
    document.body.appendChild(nav);
  },

  renderMobileDrawer(managedClasses = []) {
    const u = window.currentUser; if (!u) return;
    const exist = document.getElementById('mobile-drawer'); if (exist) exist.remove();
    const U = window.Utils, p = location.pathname.split('/').pop() || 'index.html';
    const isAdmin = U.isAdminRole(u.role), links = [];
    
    if (u.class_id) {
      links.push(
        { href: 'class.html', label: '📅 班级事务', page: 'class.html' }, { href: 'forum.html', label: '💬 班级论坛', page: 'forum.html' },
        { href: 'activities.html', label: '📊 活动统计', page: 'activities.html' }, { href: 'files.html', label: '📁 班级文件', page: 'files.html' },
        { href: 'photos.html', label: '📸 班级相册', page: 'photos.html' }, { href: 'personal.html', label: '📝 个人管理', page: 'personal.html' },
        { href: 'profile.html', label: '👤 个人中心', page: 'profile.html' }, { href: 'classes.html', label: '🏫 班级广场', page: 'classes.html' }
      );
      if (isAdmin) links.push({ href: 'admin.html', label: '👥 用户管理', page: 'admin.html' }, { href: 'requests.html', label: '📨 申请审批', page: 'requests.html' }, { href: 'stats.html', label: '📊 数据统计', page: 'stats.html' });
    } else {
      links.push({ href: 'classes.html', label: '🏫 班级广场', page: 'classes.html' }, { href: 'profile.html', label: '👤 个人中心', page: 'profile.html' });
    }

    const drawer = document.createElement('div'); drawer.id = 'mobile-drawer'; drawer.className = 'mobile-drawer';
    const overlay = document.createElement('div'); overlay.className = 'mobile-drawer-overlay'; overlay.id = 'mobile-drawer-overlay'; drawer.appendChild(overlay);
    const panel = document.createElement('div'); panel.className = 'mobile-drawer-panel';
    
    const initial = (u.nickname || '?').charAt(0).toUpperCase();
    const avatarHtml = u.avatar_url ? `<img src="${u.avatar_url}" alt="" />` : `<span class="mdb-avatar-default">${U.escapeHtml(initial)}</span>`;

    let switchClassMobile = '';
    if (u.role === 'teacher' && managedClasses.length > 1) {
      switchClassMobile = `
        <div style="padding: 12px 24px; border-bottom: 1px solid var(--border-light);">
          <div style="font-size: 12px; color: #999; margin-bottom: 8px;">切换管理班级</div>
          <select id="mobile-switch-select" style="width:100%; padding:8px; border-radius:6px; border:1px solid #ccc; font-family:inherit; outline:none;">
            ${managedClasses.map(c => `<option value="${c.id}" ${c.id === u.class_id ? 'selected' : ''}>${U.escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
      `;
    }

    panel.innerHTML = `
      <div class="mobile-drawer-header">
        <div class="mdb-avatar">${avatarHtml}</div>
        <div class="mdb-info"><div class="mdb-name">${U.escapeHtml(u.nickname)}</div><div class="mdb-role">${U.roleName(u.role)}</div></div>
      </div>
      ${switchClassMobile}
      <div class="mobile-drawer-links">${links.map(l => `<a href="${l.href}" class="mdb-link${p === l.page ? ' active' : ''}">${l.label}</a>`).join('')}</div>
      <div class="mobile-drawer-footer"><button id="mobile-drawer-logout" class="mdb-logout-btn">退出登录</button></div>`;
    drawer.appendChild(panel); document.body.appendChild(drawer);

    document.getElementById('mobile-drawer-logout').addEventListener('click', async () => { await window.supabaseClient.auth.signOut(); location.href = 'login.html'; });
    
    const sel = document.getElementById('mobile-switch-select');
    if (sel) {
      sel.addEventListener('change', async (e) => {
        const targetId = e.target.value;
        if (targetId === u.class_id) return;
        if (!confirm('确定切换到该班级吗？')) { e.target.value = u.class_id; return; }
        sel.disabled = true;
        const { error } = await window.supabaseClient.rpc('switch_teacher_class', { p_class_id: targetId });
        if (error) { alert('切换失败：' + error.message); sel.disabled = false; }
        else { location.reload(); }
      });
    }
  },

  bindMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn'), drawer = document.getElementById('mobile-drawer'), overlay = document.getElementById('mobile-drawer-overlay');
    if (!btn || !drawer || !overlay) return;
    btn.addEventListener('click', () => drawer.classList.add('open'));
    overlay.addEventListener('click', () => drawer.classList.remove('open'));
  }
};
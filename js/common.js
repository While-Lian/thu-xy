/* 通用工具 & 顶栏 v3.4.1 */

window.Utils = {
  escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${dd}`;
  },
  formatSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
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
    const d = new Date(iso);
    const now = new Date();
    const diff = d - now;
    if (diff < 0) return '已截止';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `还有 ${mins} 分钟`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `还有 ${hours} 小时`;
    const days = Math.floor(hours / 24);
    return `还有 ${days} 天`;
  },
  roleName(role) {
    return { student: '学生', committee: '班委', teacher: '老师' }[role] || role;
  },
  isAdminRole(role) {
    return role === 'committee' || role === 'teacher';
  }
};

window.Skeleton = {
  posts(count = 3) {
    return Array.from({ length: count }).map(() => `
      <div class="sk-post">
        <div class="sk-row">
          <div class="sk-avatar"></div>
          <div class="sk-info">
            <div class="sk-line sk-line-md"></div>
            <div class="sk-line sk-line-sm"></div>
          </div>
        </div>
        <div class="sk-line sk-line-full" style="margin-top:14px;"></div>
        <div class="sk-line sk-line-full" style="width:75%; margin-top:8px;"></div>
      </div>
    `).join('');
  },
  files(count = 4) {
    return Array.from({ length: count }).map(() => `
      <div class="sk-file">
        <div class="sk-icon"></div>
        <div class="sk-info">
          <div class="sk-line sk-line-md"></div>
          <div class="sk-line sk-line-sm"></div>
        </div>
      </div>
    `).join('');
  },
  cards(count = 6) {
    return Array.from({ length: count }).map(() => `
      <div class="sk-card">
        <div class="sk-line sk-line-full" style="width:40%;"></div>
        <div class="sk-line sk-line-full" style="margin-top:10px;"></div>
        <div class="sk-line sk-line-full" style="width:60%; margin-top:6px;"></div>
      </div>
    `).join('');
  },
  members(count = 8) {
    return Array.from({ length: count }).map(() => `
      <div class="sk-member">
        <div class="sk-avatar-lg"></div>
        <div class="sk-line sk-line-sm" style="margin-top:8px;"></div>
      </div>
    `).join('');
  },
  photos(count = 8) {
    return Array.from({ length: count }).map(() => `
      <div class="sk-photo"></div>
    `).join('');
  }
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
          <nav class="topbar-nav">
            <a href="classes.html" class="topbar-link active">班级广场</a>
          </nav>
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
      this.bindUserEvents();
      this.renderBottomNav();
      this.renderMobileDrawer();
      return;
    }

    const mainLinks = [
      { href: 'class.html',      label: '班级事务', page: 'class.html' },
      { href: 'forum.html',      label: '班级论坛', page: 'forum.html' },
      { href: 'activities.html', label: '活动统计', page: 'activities.html' },
      { href: 'files.html',      label: '班级文件', page: 'files.html' },
      { href: 'photos.html',     label: '班级相册', page: 'photos.html' },
      { href: 'personal.html',   label: '个人管理', page: 'personal.html' }
    ];

    let pendingCount = 0;
    if (U.isAdminRole(u.role)) {
      try {
        const { count } = await window.supabaseClient
          .from('class_join_requests')
          .select('id', { count: 'exact', head: true })
          .eq('class_id', u.class_id)
          .eq('status', 'pending');
        pendingCount = count || 0;
      } catch (e) { /* 忽略 */ }
    }

    const isAdminPage = ['admin.html', 'requests.html', 'stats.html'].includes(currentPage);
    const roleTagHtml = u.role !== 'student'
      ? `<span class="topbar-role topbar-role-${u.role}">${U.roleName(u.role)}</span>`
      : '';

    const adminMenuHtml = U.isAdminRole(u.role) ? `
      <div class="topbar-manage" id="topbar-manage">
        <button class="topbar-link topbar-manage-btn${isAdminPage ? ' active' : ''}" type="button">
          管理
          ${pendingCount > 0 ? `<span class="topbar-badge">${pendingCount}</span>` : ''}
          <span class="topbar-caret">▾</span>
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
          ${mainLinks.map(l => {
            const cls = `topbar-link${currentPage === l.page ? ' active' : ''}`;
            return `<a href="${l.href}" class="${cls}">${U.escapeHtml(l.label)}</a>`;
          }).join('')}
        </nav>
        <div class="topbar-right">
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

    this.bindUserEvents();
    this.bindManageEvents();
    this.renderBottomNav();
    this.renderMobileDrawer();
    this.bindMobileMenu();
  },

  avatarHtml(u) {
    const initial = (u.nickname || '?').charAt(0).toUpperCase();
    return u.avatar_url
      ? `<img src="${u.avatar_url}" class="topbar-avatar" alt="" />`
      : `<span class="topbar-avatar topbar-avatar-default">${window.Utils.escapeHtml(initial)}</span>`;
  },

  bindUserEvents() {
    const userEl = document.getElementById('topbar-user');
    const dropdown = document.getElementById('topbar-dropdown');
    if (!userEl || !dropdown) return;
    userEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const manageDropdown = document.getElementById('topbar-manage-dropdown');
      if (manageDropdown) manageDropdown.classList.remove('show');
      dropdown.classList.toggle('show');
    });
    document.addEventListener('click', () => dropdown.classList.remove('show'));
    document.getElementById('topbar-logout').addEventListener('click', async (e) => {
      e.preventDefault();
      await window.supabaseClient.auth.signOut();
      location.href = 'login.html';
    });
  },

  bindManageEvents() {
    const manageEl = document.getElementById('topbar-manage');
    const dropdown = document.getElementById('topbar-manage-dropdown');
    if (!manageEl || !dropdown) return;
    const btn = manageEl.querySelector('.topbar-manage-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const userDropdown = document.getElementById('topbar-dropdown');
      if (userDropdown) userDropdown.classList.remove('show');
      dropdown.classList.toggle('show');
    });
    document.addEventListener('click', () => dropdown.classList.remove('show'));
  },

  renderBottomNav() {
    const u = window.currentUser;
    if (!u) return;
    const exist = document.getElementById('mobile-bottom-nav');
    if (exist) exist.remove();

    const nav = document.createElement('nav');
    nav.id = 'mobile-bottom-nav';
    nav.className = 'mobile-bottom-nav';
    const currentPage = location.pathname.split('/').pop() || 'index.html';

    if (!u.class_id) {
      nav.innerHTML = `
        <a href="classes.html" class="mbn-item${currentPage === 'classes.html' ? ' active' : ''}"><span class="mbn-icon">🏫</span><span class="mbn-label">广场</span></a>
        <a href="profile.html" class="mbn-item${currentPage === 'profile.html' ? ' active' : ''}"><span class="mbn-icon">👤</span><span class="mbn-label">我的</span></a>
      `;
    } else {
      nav.innerHTML = `
        <a href="class.html" class="mbn-item${currentPage === 'class.html' ? ' active' : ''}"><span class="mbn-icon">📅</span><span class="mbn-label">事务</span></a>
        <a href="forum.html" class="mbn-item${currentPage === 'forum.html' ? ' active' : ''}"><span class="mbn-icon">💬</span><span class="mbn-label">论坛</span></a>
        <a href="activities.html" class="mbn-item${currentPage === 'activities.html' ? ' active' : ''}"><span class="mbn-icon">📊</span><span class="mbn-label">活动</span></a>
        <a href="profile.html" class="mbn-item${['profile.html', 'personal.html', 'files.html', 'photos.html', 'admin.html', 'requests.html', 'stats.html'].includes(currentPage) ? ' active' : ''}"><span class="mbn-icon">👤</span><span class="mbn-label">我的</span></a>
      `;
    }
    document.body.appendChild(nav);
  },

  renderMobileDrawer() {
    const u = window.currentUser;
    if (!u) return;
    const exist = document.getElementById('mobile-drawer');
    if (exist) exist.remove();

    const U = window.Utils;
    const currentPage = location.pathname.split('/').pop() || 'index.html';
    const isAdmin = U.isAdminRole(u.role);
    
    const links = [];
    if (u.class_id) {
      links.push(
        { href: 'class.html',      label: '📅 班级事务', page: 'class.html' },
        { href: 'forum.html',      label: '💬 班级论坛', page: 'forum.html' },
        { href: 'activities.html', label: '📊 活动统计', page: 'activities.html' },
        { href: 'files.html',      label: '📁 班级文件', page: 'files.html' },
        { href: 'photos.html',     label: '📸 班级相册', page: 'photos.html' },
        { href: 'personal.html',   label: '📝 个人管理', page: 'personal.html' },
        { href: 'profile.html',    label: '👤 个人中心', page: 'profile.html' },
        { href: 'classes.html',    label: '🏫 班级广场', page: 'classes.html' }
      );
      if (isAdmin) {
        links.push(
          { href: 'admin.html',    label: '👥 用户管理', page: 'admin.html' },
          { href: 'requests.html', label: '📨 申请审批', page: 'requests.html' },
          { href: 'stats.html',    label: '📊 数据统计', page: 'stats.html' }
        );
      }
    } else {
      links.push(
        { href: 'classes.html', label: '🏫 班级广场', page: 'classes.html' },
        { href: 'profile.html', label: '👤 个人中心', page: 'profile.html' }
      );
    }

    const drawer = document.createElement('div');
    drawer.id = 'mobile-drawer';
    drawer.className = 'mobile-drawer';
    
    const overlay = document.createElement('div');
    overlay.className = 'mobile-drawer-overlay';
    overlay.id = 'mobile-drawer-overlay';
    drawer.appendChild(overlay);

    const panel = document.createElement('div');
    panel.className = 'mobile-drawer-panel';
    
    const roleName = U.roleName(u.role);
    const initial = (u.nickname || '?').charAt(0).toUpperCase();
    const avatarHtml = u.avatar_url ? `<img src="${u.avatar_url}" alt="" />` : `<span class="mdb-avatar-default">${U.escapeHtml(initial)}</span>`;

    panel.innerHTML = `
      <div class="mobile-drawer-header">
        <div class="mdb-avatar">${avatarHtml}</div>
        <div class="mdb-info">
          <div class="mdb-name">${U.escapeHtml(u.nickname)}</div>
          <div class="mdb-role">${roleName}</div>
        </div>
      </div>
      <div class="mobile-drawer-links">
        ${links.map(l => `<a href="${l.href}" class="mdb-link${currentPage === l.page ? ' active' : ''}">${l.label}</a>`).join('')}
      </div>
      <div class="mobile-drawer-footer">
        <button id="mobile-drawer-logout" class="mdb-logout-btn">退出登录</button>
      </div>
    `;
    
    drawer.appendChild(panel);
    document.body.appendChild(drawer);

    document.getElementById('mobile-drawer-logout').addEventListener('click', async () => {
      await window.supabaseClient.auth.signOut();
      location.href = 'login.html';
    });
  },

  bindMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    const drawer = document.getElementById('mobile-drawer');
    const overlay = document.getElementById('mobile-drawer-overlay');
    if (!btn || !drawer || !overlay) return;
    btn.addEventListener('click', () => drawer.classList.add('open'));
    overlay.addEventListener('click', () => drawer.classList.remove('open'));
  }
};
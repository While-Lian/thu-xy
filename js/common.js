/* 通用工具 & 顶栏 v1.0.0 */

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
  }
};

window.Topbar = {
  render() {
    const u = window.currentUser;
    if (!u) return;
    const bar = document.getElementById('topbar');
    if (!bar) return;

    const currentPage = location.pathname.split('/').pop() || 'index.html';
    const links = [
      { href: 'class.html', label: '班级事务', page: 'class.html' },
      { href: 'forum.html', label: '班级论坛', page: 'forum.html' },
      { href: 'files.html', label: '班级文件', page: 'files.html' }
    ];
    if (u.role === 'admin') {
      links.push({ href: 'admin.html', label: '用户管理', page: 'admin.html' });
    }

    const initial = (u.nickname || '?').charAt(0).toUpperCase();
    const avatarHtml = u.avatar_url
      ? `<img src="${u.avatar_url}" class="topbar-avatar" alt="" />`
      : `<span class="topbar-avatar topbar-avatar-default">${window.Utils.escapeHtml(initial)}</span>`;

    bar.innerHTML = `
      <div class="topbar-inner">
        <a href="index.html" class="topbar-brand">
          <span class="topbar-brand-icon">清</span>
          <span class="topbar-brand-text">清华大学 · 行健书院</span>
        </a>
        <nav class="topbar-nav">
          ${links.map(l => `<a href="${l.href}" class="topbar-link${currentPage === l.page ? ' active' : ''}">${l.label}</a>`).join('')}
        </nav>
        <div class="topbar-user" id="topbar-user">
          ${avatarHtml}
          <span class="topbar-username">${window.Utils.escapeHtml(u.nickname)}</span>
          <span class="topbar-caret">▾</span>
          <div class="topbar-dropdown" id="topbar-dropdown">
            <a href="profile.html">个人中心</a>
            <a href="#" id="topbar-logout">退出登录</a>
          </div>
        </div>
      </div>
    `;

    const userEl = document.getElementById('topbar-user');
    const dropdown = document.getElementById('topbar-dropdown');
    userEl.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });
    document.addEventListener('click', () => dropdown.classList.remove('show'));

    document.getElementById('topbar-logout').addEventListener('click', async (e) => {
      e.preventDefault();
      await window.supabaseClient.auth.signOut();
      location.href = 'login.html';
    });
  }
};
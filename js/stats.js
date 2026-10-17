/* 数据统计 v3.1.0 */
(function () {
  'use strict';
  const db = window.supabaseClient;
  if (!db) return;
  const U = window.Utils;

  let currentUser = null;

  window.addEventListener('user-ready', (e) => {
    currentUser = e.detail;
    // 只对班委/老师开放
    if (!U.isAdminRole(currentUser.role)) {
      alert('无权限查看数据统计');
      location.href = 'index.html';
      return;
    }
    init();
  });

  function init() {
    // 绑定导出成员名单
    document.getElementById('export-members-btn').addEventListener('click', async () => {
      const btn = document.getElementById('export-members-btn');
      btn.disabled = true; btn.textContent = '导出中…';
      try {
        const { data, error } = await db.rpc('list_class_members');
        if (error) throw error;
        if (!data || !data.length) throw new Error('暂无成员数据');

        const headers = ['昵称', '身份', '邮箱', '注册时间'];
        const rows = data.map(m => [
          m.nickname,
          U.roleName(m.role),
          m.email || '',
          U.formatTime(m.created_at)
        ]);
        
        U.exportCSV('班级成员名单.csv', headers, rows);
      } catch (err) {
        alert('导出失败：' + err.message);
      } finally {
        btn.disabled = false; btn.textContent = '📥 导出成员名单';
      }
    });

    Promise.all([
      loadOverview(),
      // ...
  /* ============ 整体概览 ============ */
  async function loadOverview() {
    const el = document.getElementById('stats-cards');
    const { data, error } = await db.rpc('get_class_stats');
    if (error) {
      el.innerHTML = '<div class="stats-empty">加载失败：' + U.escapeHtml(error.message) + '</div>';
      return;
    }

    const cards = [
      { icon: '👥', label: '成员', value: data.member_count, cls: 'primary' },
      { icon: '💬', label: '帖子', value: data.post_count, cls: 'blue' },
      { icon: '💭', label: '回复', value: data.reply_count, cls: 'purple' },
      { icon: '📁', label: '文件', value: data.file_count, cls: 'green' },
      { icon: '📸', label: '照片', value: data.photo_count, cls: 'pink' },
      { icon: '📣', label: '公告', value: data.announcement_count, cls: 'orange' },
      { icon: '📅', label: '活动', value: data.activity_count, cls: 'teal' }
    ];

    el.innerHTML = cards.map(c => `
      <div class="stat-card stat-card-${c.cls}">
        <div class="stat-icon">${c.icon}</div>
        <div class="stat-value">${c.value}</div>
        <div class="stat-label">${c.label}</div>
      </div>
    `).join('');
  }

  /* ============ 最近 7 天发帖 ============ */
  async function loadDailyChart() {
    const el = document.getElementById('daily-chart');
    const { data, error } = await db.rpc('get_daily_posts');

    if (error) {
      el.innerHTML = '<div class="stats-empty">加载失败</div>';
      return;
    }

    // 构造 7 天完整数据（包括没发帖的日子）
    const map = {};
    (data || []).forEach(d => { map[d.day] = Number(d.post_count); });

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({
        date: key,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        weekday: ['日','一','二','三','四','五','六'][d.getDay()],
        count: map[key] || 0
      });
    }

    const maxCount = Math.max(1, ...days.map(d => d.count));

    el.innerHTML = days.map(d => {
      const pct = d.count / maxCount * 100;
      const isToday = d.date === days[days.length - 1].date;
      return `
        <div class="daily-bar-wrap">
          <div class="daily-count">${d.count}</div>
          <div class="daily-bar-track">
            <div class="daily-bar${isToday ? ' daily-bar-today' : ''}" style="height: ${Math.max(pct, 4)}%;"></div>
          </div>
          <div class="daily-label">${d.label}</div>
          <div class="daily-weekday">周${d.weekday}</div>
        </div>
      `;
    }).join('');
  }

  /* ============ 发帖排行 ============ */
  async function loadPostRanking() {
    const el = document.getElementById('post-ranking');
    const { data, error } = await db.rpc('get_post_ranking', { p_limit: 10 });

    if (error) {
      el.innerHTML = '<div class="stats-empty">加载失败</div>';
      return;
    }
    if (!data || !data.length) {
      el.innerHTML = '<div class="stats-empty">还没有人发帖</div>';
      return;
    }

    const maxCount = Math.max(...data.map(d => Number(d.post_count)));
    const medalIcon = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;

    el.innerHTML = data.map((d, i) => {
      const initial = (d.nickname || '?').charAt(0).toUpperCase();
      const av = d.avatar_url
        ? `<img src="${d.avatar_url}" class="rank-avatar" alt="" />`
        : `<span class="rank-avatar rank-avatar-default">${U.escapeHtml(initial)}</span>`;
      const pct = Number(d.post_count) / maxCount * 100;
      return `
        <div class="rank-item">
          <div class="rank-index ${i < 3 ? 'rank-top' : ''}">${medalIcon(i)}</div>
          ${av}
          <div class="rank-body">
            <div class="rank-name">${U.escapeHtml(d.nickname || '未知')}</div>
            <div class="rank-bar-track">
              <div class="rank-bar" style="width: ${pct}%;"></div>
            </div>
          </div>
          <div class="rank-count">${d.post_count}</div>
        </div>
      `;
    }).join('');
  }

  /* ============ 文件上传排行 ============ */
  async function loadFileRanking() {
    const el = document.getElementById('file-ranking');
    const { data, error } = await db.rpc('get_file_ranking');

    if (error) {
      el.innerHTML = '<div class="stats-empty">加载失败</div>';
      return;
    }
    if (!data || !data.length) {
      el.innerHTML = '<div class="stats-empty">还没有文件上传记录</div>';
      return;
    }

    const maxCount = Math.max(...data.map(d => Number(d.file_count)));
    const medalIcon = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;

    el.innerHTML = data.map((d, i) => {
      const pct = Number(d.file_count) / maxCount * 100;
      return `
        <div class="rank-item">
          <div class="rank-index ${i < 3 ? 'rank-top' : ''}">${medalIcon(i)}</div>
          <div class="rank-body">
            <div class="rank-name">${U.escapeHtml(d.nickname || '未知')}</div>
            <div class="rank-bar-track">
              <div class="rank-bar rank-bar-file" style="width: ${pct}%;"></div>
            </div>
          </div>
          <div class="rank-count">${d.file_count}</div>
        </div>
      `;
    }).join('');
  }

  /* ============ 活动参与统计 ============ */
  async function loadActivityStats() {
    const el = document.getElementById('activity-stats');
    const { data, error } = await db.rpc('get_activity_stats');

    if (error) {
      el.innerHTML = '<div class="stats-empty">加载失败</div>';
      return;
    }
    if (!data || !data.length) {
      el.innerHTML = '<div class="stats-empty">还没有活动报名数据</div>';
      return;
    }

    el.innerHTML = data.map(a => {
      const total = Number(a.total_count) || 1;
      const yes = Number(a.yes_count) || 0;
      const no = Number(a.no_count) || 0;
      const maybe = Number(a.maybe_count) || 0;
      const yesPct = (yes / total * 100).toFixed(0);
      const noPct = (no / total * 100).toFixed(0);
      const maybePct = (maybe / total * 100).toFixed(0);

      return `
        <div class="activity-stat-item">
          <div class="activity-stat-head">
            <div class="activity-stat-title">${U.escapeHtml(a.activity_title)}</div>
            <div class="activity-stat-total">${total} 人表态</div>
          </div>
          <div class="activity-stat-bar">
            ${yes > 0 ? `<div class="activity-bar-seg activity-bar-yes" style="width:${yesPct}%" title="参与 ${yes}"></div>` : ''}
            ${maybe > 0 ? `<div class="activity-bar-seg activity-bar-maybe" style="width:${maybePct}%" title="待定 ${maybe}"></div>` : ''}
            ${no > 0 ? `<div class="activity-bar-seg activity-bar-no" style="width:${noPct}%" title="不参与 ${no}"></div>` : ''}
          </div>
          <div class="activity-stat-legend">
            <span class="legend-item"><span class="legend-dot legend-yes"></span>参与 ${yes}</span>
            <span class="legend-item"><span class="legend-dot legend-maybe"></span>待定 ${maybe}</span>
            <span class="legend-item"><span class="legend-dot legend-no"></span>不参与 ${no}</span>
          </div>
        </div>
      `;
    }).join('');
  }
})();
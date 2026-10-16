/* 通知中心 v2.4.0 */
(function () {
  'use strict';
  const db = window.supabaseClient;
  if (!db) return;
  const U = window.Utils;

  // 顶栏铃铛：定时轮询 + 实时订阅
  let pollTimer = null;
  let notifChannel = null;
  let currentUser = null;

  window.addEventListener('user-ready', (e) => {
    currentUser = e.detail;
    if (!currentUser.class_id) return;
    initBell();
  });

  function initBell() {
    injectBellButton();
    updateBadge();
    subscribeRealtime();

    // 兜底：每 60 秒轮询一次
    pollTimer = setInterval(updateBadge, 60000);
  }

  function injectBellButton() {
    const userEl = document.getElementById('topbar-user');
    if (!userEl) return;
    if (document.getElementById('notif-bell')) return;

    const bell = document.createElement('button');
    bell.id = 'notif-bell';
    bell.className = 'notif-bell';
    bell.title = '通知';
    bell.innerHTML = '🔔<span class="notif-badge" id="notif-badge" style="display:none;">0</span>';
    bell.addEventListener('click', (e) => {
      e.stopPropagation(); // 防止展开 dropdown
      location.href = 'notifications.html';
    });

    // 关键：插入到 topbar-user 内部最前面
    userEl.insertBefore(bell, userEl.firstChild);
  }

  async function updateBadge() {
    if (!currentUser || !currentUser.class_id) return;
    const { count } = await db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)
      .eq('is_read', false);

    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    if (count && count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  function subscribeRealtime() {
    if (notifChannel) {
      try { db.removeChannel(notifChannel); } catch (e) {}
    }
    notifChannel = db
      .channel('notifications-' + currentUser.id)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`
        },
        () => { updateBadge(); })
      .subscribe();
  }

  // 对外暴露，供 notifications.html 使用
  window.NotificationsAPI = {
    markAllRead: async () => {
      if (!currentUser) return;
      await db.from('notifications')
        .update({ is_read: true })
        .eq('user_id', currentUser.id)
        .eq('is_read', false);
      updateBadge();
    },
    markRead: async (id) => {
      await db.from('notifications').update({ is_read: true }).eq('id', id);
      updateBadge();
    },
    deleteOne: async (id) => {
      await db.from('notifications').delete().eq('id', id);
      updateBadge();
    },
    deleteAll: async () => {
      if (!currentUser) return;
      await db.from('notifications').delete().eq('user_id', currentUser.id);
      updateBadge();
    },
    refresh: updateBadge
  };
})();
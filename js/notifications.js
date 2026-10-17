/* 通知中心 v4.0.0（带桌面系统通知） */
(function () {
  'use strict';
  const db = window.supabaseClient;
  if (!db) return;
  const U = window.Utils;

  let pollTimer = null;
  let notifChannel = null;
  let currentUser = null;

  window.addEventListener('user-ready', (e) => {
    currentUser = e.detail;
    if (!currentUser.class_id) return;
    
    // 首次进入时，尝试请求桌面通知权限
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    initBell();
  });

  function initBell() {
    injectBellButton();
    updateBadge();
    subscribeRealtime();
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
      e.stopPropagation();
      location.href = 'notifications.html';
    });

    userEl.insertBefore(bell, userEl.firstChild);
  }

  async function updateBadge(showDesktopNotif = false) {
    if (!currentUser || !currentUser.class_id) return;
    const { count } = await db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)
      .eq('is_read', false);

    const badge = document.getElementById('notif-badge');
    if (badge) {
      if (count && count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }

    // 👇 如果收到了实时新消息，且页面被切到后台了，弹出系统通知
    if (showDesktopNotif && 'Notification' in window && Notification.permission === 'granted') {
      if (document.hidden) {
        try {
          // 优先通过 Service Worker 发送（兼容手机端）
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification('THU-XY 班级共建', {
            body: '你收到了一条新的班级消息，点击查看！',
            icon: '/thu-xy/icon-192.png',
            badge: '/thu-xy/icon-192.png',
            vibrate: [200, 100, 200]
          });
        } catch (e) {
          // 降级到普通浏览器通知
          new Notification('THU-XY 班级共建', { body: '你收到了一条新的班级消息，点击查看！' });
        }
      }
    }
  }

  function subscribeRealtime() {
    if (notifChannel) {
      try { db.removeChannel(notifChannel); } catch (e) {}
    }
    notifChannel = db
      .channel('notifications-' + currentUser.id)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` },
        () => { updateBadge(true); }) // 收到新通知，传 true
      .subscribe();
  }

  window.NotificationsAPI = {
    markAllRead: async () => {
      if (!currentUser) return;
      await db.from('notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false);
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
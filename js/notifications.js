/* 通知中心 v4.1.0（修复管理员端不显示 + 适配新通知） */
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
    
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    initBell();
  });

  function initBell() {
    // 👇 核心修复：使用重试机制，确保在顶栏渲染完成后再插入铃铛
    let retries = 0;
    const tryInject = () => {
      const userEl = document.getElementById('topbar-user');
      if (userEl && !document.getElementById('notif-bell')) {
        const bell = document.createElement('button');
        bell.id = 'notif-bell';
        bell.className = 'notif-bell';
        bell.title = '通知中心';
        bell.innerHTML = '🔔<span class="notif-badge" id="notif-badge" style="display:none;">0</span>';
        bell.addEventListener('click', (e) => {
          e.stopPropagation();
          location.href = 'notifications.html';
        });
        userEl.insertBefore(bell, userEl.firstChild);
        
        updateBadge();
        subscribeRealtime();
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(updateBadge, 60000);
      } else if (retries < 20) {
        retries++;
        setTimeout(tryInject, 100);
      }
    };
    tryInject();
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

    if (showDesktopNotif && 'Notification' in window && Notification.permission === 'granted') {
      if (document.hidden) {
        try {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification('THU-XY 班级共建', {
            body: '你收到了一条新的消息，点击查看！',
            icon: '/thu-xy/icon-192.png',
            badge: '/thu-xy/icon-192.png',
            vibrate: [200, 100, 200]
          });
        } catch (e) {
          new Notification('THU-XY 班级共建', { body: '你收到了一条新的消息，点击查看！' });
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
        () => { updateBadge(true); })
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

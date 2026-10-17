// 简单的 Service Worker，满足 PWA 安装条件
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // 保持空即可，PWA 要求必须有 fetch 监听
});
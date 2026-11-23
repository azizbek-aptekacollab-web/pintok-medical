// Service Worker для мобильного приложения сети аптек «Пинток Медикал»
const CACHE_NAME = 'pintok-medical-pwa-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './jarvis.html',
  './jarvis.css',
  './jarvis.js',
  './jarvis-manifest.json',
  './logo-apteka.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => console.log('Кэширование частичных ассетов', err));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const reqUrl = new URL(e.request.url);
  if (e.request.method !== 'GET' || reqUrl.pathname.startsWith('/api/')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).catch(() => {
        if (e.request.destination === 'document') {
          return caches.match(reqUrl.pathname.includes('jarvis') ? './jarvis.html' : './index.html');
        }
      });
    })
  );
});

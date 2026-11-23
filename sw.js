// Service Worker для сети аптек «Пинток Медикал» и J.A.R.V.I.S. AI
const CACHE_NAME = 'pintok-medical-pwa-v3';
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
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null)))
    ).then(() => self.clients.claim())
  );
});

// Network-First so UI updates always appear immediately
self.addEventListener('fetch', (e) => {
  const reqUrl = new URL(e.request.url);
  if (e.request.method !== 'GET' || reqUrl.pathname.startsWith('/api/') || reqUrl.pathname === '/health') {
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200 && reqUrl.origin === self.location.origin) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone)).catch(() => {});
        }
        return networkRes;
      })
      .catch(() =>
        caches.match(e.request).then((cached) => {
          if (cached) return cached;
          if (e.request.destination === 'document') {
            return caches.match(reqUrl.pathname.includes('jarvis') ? './jarvis.html' : './index.html');
          }
        })
      )
  );
});

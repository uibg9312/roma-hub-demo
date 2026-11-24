/* App shell cache only; persistent user PDFs and IndexedDB data are not removed. */
const SHELL_CACHE = 'coro-hub-shell-ios12-v5';
const PDF_CACHE = 'choir-downloaded-pdf-v1';
const SHELL = [
  '/ios12/', '/ios12/index.html', '/ios12/styles.css', '/ios12/app.js', '/ios12/search.js', '/ios12/study.js', '/ios12/study.css',
  '/ios12/offline.js', '/ios12/auto-offline.js', '/ios12/install.js', '/ios12/install.css', '/ios12/compact-home.css', '/ios12/ios12-compat.js', '/ios12/ios12.css', '/ios12/auth-google.js', '/ios12/vendor/pdf.min.js',
  '/ios12/vendor/pdf.worker.min.js', '/ios12/config.js', '/catalog.json',
  '/ios12/icon.svg', '/ios12/icons/icon-192.png', '/ios12/icons/icon-512.png',
  '/ios12/icons/icon-maskable-512.png', '/ios12/icons/apple-touch-icon-180.png',
  '/ios12/manifest.webmanifest'
];
const SHELL_PATHS = new Set(SHELL);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => (
        key !== SHELL_CACHE &&
        key !== PDF_CACHE &&
        (/^coro-hub-shell-ios12-v[0-9]+$/.test(key))
      )).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});
// El shell versionado se sirve del dispositivo en relanzamientos de la PWA.
// Un nuevo sw.js instala una nueva versión y renueva estos archivos sin bloquear Inicio.
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(SHELL_CACHE).then(cache =>
        cache.match('/ios12/index.html').then(hit => hit || cache.match('/ios12/')).then(hit =>
          hit || fetch(request).then(response => {
            if (response.ok) event.waitUntil(cache.put('/ios12/', response.clone()));
            return response;
          })
        )
      ).catch(() => caches.match('/ios12/index.html').then(hit => hit || Response.error()))
    );
    return;
  }

  if (SHELL_PATHS.has(url.pathname)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(cache =>
        cache.match(request).then(hit => hit || cache.match(url.pathname)).then(hit =>
          hit || fetch(request).then(response => {
            if (response.ok && response.type !== 'opaque') {
              event.waitUntil(cache.put(request, response.clone()));
            }
            return response;
          })
        )
      ).catch(() => fetch(request))
    );
  }
});

/* App shell cache only; persistent user PDFs and IndexedDB data are not removed. */
const SHELL_CACHE = 'coro-hub-shell-v106';
const PDF_CACHE = 'choir-downloaded-pdf-v1';
const SHELL = [
  '/director-tones.js',
  '/roma-fragment.js',
  '/roma-v2.css', '/roma-theme.js', '/brand-luce.svg', '/brand-notte.svg',
  '/', '/index.html', '/ios12-redirect.js', '/styles.css', '/app.js', '/search.js', '/study.js', '/study-media.js', '/study.css', '/note-touch.js', '/note-touch.css', '/pdf-gestures.js', '/notes-first10.json', '/director.js', '/director.css',
  '/offline.js', '/auto-offline.js', '/install.js', '/install.css', '/compact-home.css', '/auth-google.js', '/vendor/pdf.min.js',
  '/vendor/pdf.worker.min.js', '/config.js', '/catalog.json',
  '/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png',
  '/icons/icon-maskable-512.png', '/icons/apple-touch-icon-180.png',
  '/manifest.webmanifest'
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
        (/^coro-hub-(?:v[0-9]+|shell-v[0-9]+)$/.test(key))
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
  if (url.origin !== self.location.origin || url.pathname.startsWith('/ios12/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(SHELL_CACHE).then(cache =>
        cache.match('/index.html').then(hit => hit || cache.match('/')).then(hit =>
          hit || fetch(request).then(response => {
            if (response.ok) event.waitUntil(cache.put('/', response.clone()));
            return response;
          })
        )
      ).catch(() => caches.match('/index.html').then(hit => hit || Response.error()))
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

const CACHE_NAME = 'defis-collegues-v1';
const APP_SHELL = ['./', './index.html', './style.css', './app.js', './manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Cache-first pour les fichiers de l'app (permet un chargement quasi
// instantané / hors-ligne partiel). Les requêtes vers un autre domaine
// (Firebase Auth/Firestore, Google Fonts) ne sont jamais interceptées : les
// données de l'équipe doivent toujours venir du réseau en direct.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

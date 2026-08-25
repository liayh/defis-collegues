const CACHE_PREFIX = 'defis-collegues-';
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const APP_SHELL = ['./', './index.html', './style.css', './app.js', './manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(async keys => {
      const oldKeys = keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME);
      await Promise.all(oldKeys.map(k => caches.delete(k)));
      await self.clients.claim();

      if(oldKeys.length){
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        await Promise.all(clients.map(client => {
          if(new URL(client.url).origin !== self.location.origin) return null;
          return client.navigate(client.url).catch(() => null);
        }));
      }
    })
  );
});

// Network-first pour les fichiers de l'app : les corrections (dont le chat)
// arrivent tout de suite en ligne, avec repli cache quand l'app est hors-ligne.
// Les requêtes vers un autre domaine (Firebase Auth/Firestore, Google Fonts)
// ne sont jamais interceptées : les données de l'équipe doivent toujours venir
// du réseau en direct.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin || event.request.method !== 'GET') return;
  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      try{
        const fresh = await fetch(event.request);
        if(fresh && fresh.ok) cache.put(event.request, fresh.clone());
        return fresh;
      }catch(e){
        const cached = await caches.match(event.request);
        if(cached) return cached;
        throw e;
      }
    })
  );
});

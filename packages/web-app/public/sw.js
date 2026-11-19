const CACHE = 'kombinat-offline-v1';
const OFFLINE_URL = '/offline.html';

const cacheOfflinePage = () =>
  caches.open(CACHE).then(cache => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })));

self.addEventListener('install', event => {
  event.waitUntil(cacheOfflinePage());
  void self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter(name => name !== CACHE).map(name => caches.delete(name)));
      await self.registration.navigationPreload?.enable();
      await self.clients.claim();
    })(),
  );
});

// Only page loads go through here: the dashboard and the API always come from the daemon.
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    (async () => {
      try {
        const response = (await event.preloadResponse) ?? (await fetch(event.request));
        // An update of Kombinat may change the page while this worker stays the same.
        event.waitUntil(cacheOfflinePage().catch(() => undefined));
        return response;
      } catch {
        return (await caches.match(OFFLINE_URL)) ?? Response.error();
      }
    })(),
  );
});

// Keeps the app and its models available offline after the first load. Server calls are never cached.
const CACHE = 'voai-v2';
// Large files that do not change between builds. The app's own bundles are not among them.
const UNCHANGING = /^\/vendor\/(models|ort)\//;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(
  caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()),
));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) return;
  const keep = (response) => {
    if (response.ok && response.status === 200) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
    }
    return response;
  };
  // Those come from the cache; everything else comes from the network when there is one.
  event.respondWith(UNCHANGING.test(url.pathname)
    ? caches.match(event.request).then((hit) => hit ?? fetch(event.request).then(keep))
    : fetch(event.request).then(keep).catch(() => caches.match(event.request).then((hit) => hit ?? Response.error())));
});

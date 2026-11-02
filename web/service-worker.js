/* Generated build configuration contains only public app asset URLs. */
const CONFIG = __CONFIG__;
const PREFIX = `personal-control-shell:${CONFIG.base}:`;
const CACHE = PREFIX + CONFIG.version;
const INDEX = CONFIG.base + 'index.html';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // Unversioned HTML and registration scripts must not come from a previous
    // HTTP cache/CDN response while hashed bundles come from the new build.
    const cache = await caches.open(CACHE);
    try {
      await Promise.all(CONFIG.urls.map(async path => {
        const url = new URL(path, self.location.origin);
        url.searchParams.set('__build', CONFIG.version);
        const response = await fetch(url.href, { cache: 'no-store' });
        if (!response.ok) throw new Error('Incomplete application download');
        await cache.put(path, response);
      }));
      const html = await (await cache.match(INDEX)).text();
      for (const match of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) {
        const script = new URL(match[1], self.location.origin + INDEX);
        if (script.origin !== self.location.origin || !CONFIG.urls.includes(script.pathname)) {
          throw new Error('Application HTML and assets do not match');
        }
      }
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // The previous worker waits until old windows close, unless the sole open
    // window explicitly requests an update. Records in localStorage are untouched.
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') {
    event.waitUntil((async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const ownWindows = windows.filter(client => new URL(client.url).pathname.startsWith(CONFIG.base));
      if (ownWindows.length > 1) {
        event.source?.postMessage({ type: 'UPDATE_BLOCKED' });
        return;
      }
      await self.skipWaiting();
    })());
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(CONFIG.base)) return;
  const navigation = request.mode === 'navigate' && [CONFIG.base, INDEX].includes(url.pathname);
  if (!navigation && !CONFIG.urls.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = navigation ? INDEX : url.pathname;
    return (await cache.match(key)) || fetch(request);
  })());
});

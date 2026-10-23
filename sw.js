// Consulta de Motores — funciona offline; online busca sempre a versão mais nova.
const CACHE = 'motores-rrp-v5';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'favicon.ico',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];
const CACHEABLE_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.map(u => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin && !CACHEABLE_HOSTS.includes(url.hostname)) return;
  const isPage = req.mode === 'navigate';
  const isIndex = isPage || url.pathname.endsWith('/index.html');
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      // rede primeiro; nas páginas há limite de tempo para não travar com sinal fraco
      const net = fetch(req, isPage ? { cache: 'no-store' } : undefined);
      const res = await (isPage
        ? Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))])
        : net);
      if (res.ok || res.type === 'opaque') cache.put(isIndex ? 'index.html' : req, res.clone());
      return res;
    } catch (e) {
      const cached = isIndex ? await cache.match('index.html') : await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      throw e;
    }
  })());
});

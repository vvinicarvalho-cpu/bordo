// Service worker: guarda o app no aparelho para abrir rápido e funcionar sem internet.
const CACHE = 'bordo-v2.0.0';
const ARQUIVOS = ['./', './index.html', './styles.css', './app.js', './config.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Mesmo domínio: responde do cache e atualiza em segundo plano. A API (Google) passa direto.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const salvo = await c.match(e.request, { ignoreSearch: true });
    const rede = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    if (salvo) { e.waitUntil(rede); return salvo; }
    const r = await rede;
    return r || (e.request.mode === 'navigate' ? c.match('./index.html') : Response.error());
  }));
});

// porteo: el service worker de la versión web (empaquetar.py --sitio). Guarda la página para que
// arranque sin red. Los bloques no pasan por acá: arranque.js los busca en Cache Storage antes de
// pedirlos y los guarda ahí al bajarlos (llevan el hash del contenido en el nombre, así que nunca
// cambian); así cada pedido sale a la red con su prioridad (lo que el motor espera, alta).
const PAGINA = 'porteo-pagina';
const LO_DE_LA_PAGINA = ['./', 'index.html', 'manifest.webmanifest', 'icono-192.png', 'icono-512.png'];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(PAGINA).then((c) => c.addAll(LO_DE_LA_PAGINA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => ev.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  const url = new URL(req.url);
  // los bloques y las descargas grandes (cloudflare/descargas.py) van directo: no son "la página"
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/b/') || url.pathname.includes('/descargas/')) return;
  // la página y lo suyo: de la red si hay (por si hay una versión nueva) y, sin red, lo guardado
  ev.respondWith(fetch(req).then((r) => {
    if (r.ok) { const copia = r.clone(); caches.open(PAGINA).then((c) => c.put(req, copia)); }
    return r;
  }).catch(() => caches.open(PAGINA).then((c) => c.match(req, { ignoreSearch: true }).then((r) => r || c.match('index.html')))));
});

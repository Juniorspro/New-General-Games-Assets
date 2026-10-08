// porteo: el service worker de la versión web (empaquetar.py --sitio). Guarda la página para que
// arranque sin red y contesta los bloques desde Cache Storage (arranque.js los guarda ahí al
// bajarlos; llevan el hash del contenido en el nombre, así que nunca cambian).
const PAGINA = 'porteo-pagina';
const BLOQUES = 'porteo-bloques';
const LO_DE_LA_PAGINA = ['./', 'index.html', 'manifest.webmanifest', 'icono-192.png', 'icono-512.png'];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(PAGINA).then((c) => c.addAll(LO_DE_LA_PAGINA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => ev.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.includes('/b/')) {
    // un bloque: el guardado si está; si no, de la red
    ev.respondWith(caches.open(BLOQUES).then((c) => c.match(req)).then((r) => r || fetch(req)));
    return;
  }
  // la página y lo suyo: de la red si hay (por si hay una versión nueva) y, sin red, lo guardado
  ev.respondWith(fetch(req).then((r) => {
    if (r.ok) { const copia = r.clone(); caches.open(PAGINA).then((c) => c.put(req, copia)); }
    return r;
  }).catch(() => caches.open(PAGINA).then((c) => c.match(req, { ignoreSearch: true }).then((r) => r || c.match('index.html')))));
});

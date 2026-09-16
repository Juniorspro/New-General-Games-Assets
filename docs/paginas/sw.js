/* Service worker del panel.

   Guarda en caché sólo el armazón de la app —el HTML, que ya trae el CSS y el JS
   adentro— y nada de la API: las publicaciones tienen que verse siempre frescas,
   y una respuesta vieja de `/api/...` sería peor que un error.

   La estrategia es «red primero, caché de respaldo»: si hay internet se usa lo de
   la red y se guarda una copia; si no hay, se abre la copia guardada. Así el
   dueño abre la app en la puerta del boliche sin señal y al menos la ve, aunque
   no pueda publicar hasta que vuelva. */

const CACHE = "iblo-panel-v2";
/* la URL real no lleva .html: Pages se lo saca con un 308 */
const ARMAZON = ["/iblo-app", "/icono-192.png", "/icono-512.png"];

self.addEventListener("install", (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARMAZON)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;   // la API nunca se cachea

  ev.respondWith(
    fetch(ev.request)
      .then((r) => {
        if (r && r.ok) {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put(ev.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(ev.request).then((c) => c || caches.match("/iblo-app")))
  );
});

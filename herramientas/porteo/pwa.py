#!/usr/bin/env python3
"""Convierte una carpeta HTML5 en una app instalable que anda sin internet.

    python3 pwa.py CARPETA --nombre "Bus Stop Simulator" --corto "Bus Stop" \
        --orientacion landscape --icono icono.png [--color "#02040a"] [--inicio index.html] \
        [--perezosos 'datos/mapas/*'] [--espera]

Escribe en CARPETA:
  manifest.webmanifest   nombre, ícono, pantalla completa, orientación
  icono-192.png / 512    los que pide Chrome para ofrecer "Instalar"
  sw.js                  service worker: guarda TODOS los archivos en la
                         primera visita y después los sirve sin red (los que
                         coinciden con --perezosos, recién la primera vez que
                         el juego los pide: así un juego de cientos de MB no se
                         baja entero al abrirlo)
  porteo-web.js          copia de herramientas/porteo/web.js
y en el <head> del inicio, entre marcas <!-- porteo:pwa -->, los <link>/<meta>.

Es idempotente: correrlo de nuevo reemplaza el bloque y recalcula la versión.

Cada archivo se guarda con su huella (tamaño y CRC-32): una versión nueva baja
sólo lo que cambió y lo demás lo reusa, también lo que se guardó al jugar. Lo
bajado se verifica contra la huella: si justo se publicó otra versión, no se
mezcla con esta. Sin --espera, la versión nueva reemplaza a la vieja apenas
termina de instalarse, aunque la página esté abierta; con --espera queda
esperando hasta que la página la deja pasar (Porteo.actualizar de web.js, antes
de arrancar el juego) o hasta que se cierra: así un juego que baja datos
mientras se juega nunca mezcla los de dos versiones.
"""
import argparse
import hashlib
import json
import re
import shutil
import zlib
from pathlib import Path

AQUI = Path(__file__).resolve().parent
GENERADOS = {"sw.js"}  # no se precachea a sí mismo

SW = """// Generado por herramientas/porteo/pwa.py — no editar a mano.
const VERSION = '__VERSION__';   // el hash de todo: si cambia un archivo, cambia este archivo
// ruta → huella ("tamaño-crc32"). ARCHIVOS se guardan al instalar; PEREZOSOS, la primera vez
// que el juego los pide. './' es index.html.
const ARCHIVOS = __ARCHIVOS__;
const PEREZOSOS = __PEREZOSOS__;
// true: la versión nueva espera a que la página la deje pasar (Porteo.actualizar) o se cierre
const ESPERA = __ESPERA__;
const AMBITO = self.registration.scope;
const CACHE = 'porteo ' + AMBITO;   // una sola por juego: lo guardado se busca por ruta y huella

const url = (ruta) => ruta === './' ? ruta : ruta.split('/').map(encodeURIComponent).join('/');
const clave = (ruta, h) => url(ruta) + '?porteo=' + h;

const TABLA = new Int32Array(256).map((_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n;
});
// la misma cuenta que hace pwa.py, leyendo de a pedazos (sin juntar todo en memoria)
async function huella(cuerpo, alLeer) {
  const lector = cuerpo.getReader();
  let crc = -1, n = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    for (let i = 0; i < value.length; i++) crc = TABLA[(crc ^ value[i]) & 255] ^ (crc >>> 8);
    n += value.length;
    if (alLeer) alLeer(value.length);
  }
  return n + '-' + ((crc ^ -1) >>> 0).toString(16).padStart(8, '0');
}

// Guarda lo bajado (o lo de una caché vieja) si es lo que se esperaba: si en el medio se publicó
// otra versión, no se mezcla. El inicio se acepta igual (hay hostings que retocan el HTML).
async function guardar(c, ruta, resp, h, alLeer) {
  const [a, b] = (resp.body || new Blob([]).stream()).tee();
  const hs = new Headers(resp.headers);
  for (const k of ['content-encoding', 'content-length', 'vary']) hs.delete(k);
  const [real] = await Promise.all([huella(b, alLeer),
    c.put(clave(ruta, h), new Response(a, { status: 200, statusText: 'OK', headers: hs }))]);
  if (real === h || ruta === './') return true;
  await c.delete(clave(ruta, h));
  return false;
}

// las cachés del formato de antes (una por versión: porteo-<hash>) que son de este juego
async function viejas() {
  const r = [];
  for (const k of await caches.keys())
    if (/^porteo-[0-9a-f]{12}$/.test(k) && await (await caches.open(k)).match(AMBITO)) r.push(k);
  return r;
}

self.addEventListener('install', (e) => e.waitUntil((async () => {
  const c = await caches.open(CACHE);
  // lo que guardó el formato de antes se aprovecha si coincide con su huella (si no, se bajaría
  // todo de nuevo, también lo de las partidas)
  const anteriores = await Promise.all((await viejas()).map((k) => caches.open(k)));
  const deAntes = async (ruta, h) => {
    if (ruta === './') return false;   // (el inicio no se verifica: ése se baja siempre)
    for (const v of anteriores) {
      const r = await v.match(url(ruta));
      if (r && r.status === 200 && await guardar(c, ruta, r, h)) return true;
    }
    return false;
  };
  for (const [ruta, h] of Object.entries(PEREZOSOS)) if (!(await c.match(clave(ruta, h)))) await deAntes(ruta, h);
  // Todo o nada: si falta un archivo, no se instala un juego roto. Lo que ya está (de otra
  // versión, o de un intento que se cortó) no se baja de nuevo.
  const lista = [];
  for (const [ruta, h] of Object.entries(ARCHIVOS)) if (!(await c.match(clave(ruta, h))) && !(await deAntes(ruta, h))) lista.push([ruta, h]);
  let total = 0, hechos = 0, antes = 0;
  for (const [, h] of lista) total += +h.split('-')[0];
  const avisar = (ya) => {
    if (!ya && Date.now() - antes < 250) return;
    antes = Date.now();
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((cs) => cs.forEach((cl) =>
      cl.postMessage({ porteo: 'instalando', ambito: AMBITO, hechos, total })));
  };
  let i = 0;
  const obrero = async () => {
    while (i < lista.length) {
      const [ruta, h] = lista[i++];
      const r = await fetch(url(ruta), { cache: 'no-cache' });
      if (!r.ok) throw new Error(ruta + ': ' + r.status);
      if (!(await guardar(c, ruta, r, h, (n) => { hechos += n; avisar(); }))) throw new Error(ruta + ': cambió en el servidor');
    }
  };
  await Promise.all([obrero(), obrero(), obrero(), obrero()]);
  avisar(true);
  // la página de una versión del formato de antes no sabe dejarla pasar
  if (!ESPERA || anteriores.length) await self.skipWaiting();
})()));

self.addEventListener('message', (e) => { if (e.data === 'porteo-ahora') e.waitUntil(self.skipWaiting()); });

self.addEventListener('activate', (e) => e.waitUntil((async () => {
  // lo que guardó una versión vieja de este juego y ésta no usa
  for (const k of await viejas()) await caches.delete(k);
  const c = await caches.open(CACHE);
  const vale = new Set([...Object.entries(ARCHIVOS), ...Object.entries(PEREZOSOS)]
    .map(([ruta, h]) => new URL(clave(ruta, h), location).href));
  for (const q of await c.keys()) if (!vale.has(q.url)) await c.delete(q);
  await self.clients.claim();
})()));

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || !r.url.startsWith(AMBITO)) return;
  let ruta;
  try { ruta = decodeURIComponent(new URL(r.url).pathname.slice(new URL(AMBITO).pathname.length)); } catch (_) { return; }
  if (ruta === '' || ruta === 'index.html') ruta = './';
  const h = ARCHIVOS[ruta] || PEREZOSOS[ruta];
  if (!h) return;   // no es del juego: va a la red como siempre
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(clave(ruta, h));
    if (hit) return hit;
    const resp = await fetch(r);
    if (resp.status === 200) e.waitUntil(guardar(c, ruta, resp.clone(), h).catch(() => {}));
    return resp;
  })());
});
"""


def huella(p):
    """Tamaño y CRC-32 del archivo: la misma cuenta que hace sw.js con lo que baja."""
    crc = 0
    with open(p, "rb") as f:
        while True:
            b = f.read(1 << 20)
            if not b:
                break
            crc = zlib.crc32(b, crc)
    return f"{p.stat().st_size}-{crc & 0xffffffff:08x}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("carpeta", type=Path)
    ap.add_argument("--nombre", required=True)
    ap.add_argument("--corto")
    ap.add_argument("--orientacion", default="any", help="landscape, portrait o any")
    ap.add_argument("--icono", type=Path, required=True)
    ap.add_argument("--color", default="#000000")
    ap.add_argument("--inicio", default="index.html")
    ap.add_argument("--sin-web-js", action="store_true", help="no copiar porteo-web.js")
    ap.add_argument("--perezosos", action="append", default=[], metavar="PATRON",
                    help="archivos (glob relativo a la carpeta, p. ej. 'datos/mapas/*') que no se bajan "
                         "al instalar: se guardan la primera vez que el juego los pide")
    ap.add_argument("--espera", action="store_true",
                    help="la versión nueva no reemplaza a la vieja con la página abierta: espera a que "
                         "la página la deje pasar (Porteo.actualizar, antes de arrancar el juego)")
    a = ap.parse_args()

    from PIL import Image
    d = a.carpeta.resolve()
    inicio = d / a.inicio
    if not inicio.exists():
        raise SystemExit(f"no está {inicio}")

    ico = Image.open(a.icono).convert("RGBA")
    for lado in (192, 512):
        # Chrome exige 512 para la pantalla de bienvenida; si el original es más
        # chico se agranda con LANCZOS (mejor un ícono un poco blando que ninguno).
        ico.resize((lado, lado), Image.LANCZOS).save(d / f"icono-{lado}.png", optimize=True)

    if not a.sin_web_js:
        shutil.copy2(AQUI / "web.js", d / "porteo-web.js")

    man = {
        "name": a.nombre, "short_name": a.corto or a.nombre,
        "start_url": f"./{a.inicio}", "scope": "./", "display": "fullscreen",
        "orientation": a.orientacion, "background_color": a.color, "theme_color": a.color,
        "icons": [{"src": f"icono-{n}.png", "sizes": f"{n}x{n}", "type": "image/png", "purpose": "any"}
                  for n in (192, 512)],
    }
    (d / "manifest.webmanifest").write_text(json.dumps(man, ensure_ascii=False, indent=2), "utf-8")

    bloque = (
        "<!-- porteo:pwa -->\n"
        '<link rel="manifest" href="manifest.webmanifest">\n'
        '<link rel="icon" type="image/png" href="icono-192.png">\n'
        '<link rel="apple-touch-icon" href="icono-192.png">\n'
        '<meta name="mobile-web-app-capable" content="yes">\n'
        '<meta name="apple-mobile-web-app-capable" content="yes">\n'
        '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
        "<!-- /porteo:pwa -->\n"
    )
    html = inicio.read_text("utf-8")
    html = re.sub(r"<!-- porteo:pwa -->.*?<!-- /porteo:pwa -->\n?", "", html, flags=re.S)
    # El ícono vacío de algunos juegos (href="data:,") le gana al nuestro.
    html = re.sub(r'<link rel="icon" href="data:,">\n?', "", html)
    html = html.replace("</head>", bloque + "</head>", 1)
    inicio.write_text(html, "utf-8")

    archivos = sorted(p for p in d.rglob("*") if p.is_file() and p.name not in GENERADOS)
    h = hashlib.sha256()
    for p in archivos:
        h.update(str(p.relative_to(d)).encode())
        h.update(p.read_bytes())
    perezosos = {q.relative_to(d).as_posix() for pat in a.perezosos for q in d.glob(pat) if q.is_file()}
    lista, vagos = {}, {}
    for p in archivos:
        ruta = p.relative_to(d).as_posix()
        # index.html va como './': es lo que sirve el hosting en la carpeta (Cloudflare Pages
        # redirige index.html a ./, y una redirección guardada no se puede usar para abrir la página)
        (vagos if ruta in perezosos else lista)["./" if ruta == "index.html" else ruta] = huella(p)
    sw = (SW.replace("__VERSION__", "porteo-" + h.hexdigest()[:12])
            .replace("__ARCHIVOS__", json.dumps(lista, ensure_ascii=False))
            .replace("__PEREZOSOS__", json.dumps(vagos, ensure_ascii=False))
            .replace("__ESPERA__", "true" if a.espera else "false"))
    (d / "sw.js").write_text(sw, "utf-8")
    peso = sum(int(v.split("-")[0]) for v in lista.values())
    print(f"PWA: {len(lista)} entradas, {peso / 1048576:.2f} MB en caché, versión {h.hexdigest()[:12]}"
          + (f"; {len(vagos)} perezosos, al usarlos" if vagos else "")
          + ("; la versión nueva espera a la página" if a.espera else ""))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Convierte una carpeta HTML5 en una app instalable que anda sin internet.

    python3 pwa.py CARPETA --nombre "Bus Stop Simulator" --corto "Bus Stop" \
        --orientacion landscape --icono icono.png [--color "#02040a"] [--inicio index.html]

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
La versión del caché es el hash de todos los archivos, así que cualquier cambio
en el juego invalida el caché viejo solo (sin eso, el que ya lo abrió una vez
queda jugando la versión vieja para siempre).
"""
import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

AQUI = Path(__file__).resolve().parent
GENERADOS = {"sw.js"}  # no se precachea a sí mismo

SW = """// Generado por herramientas/porteo/pwa.py — no editar a mano.
const VERSION = '__VERSION__';
const ARCHIVOS = __ARCHIVOS__;
const PEREZOSOS = __PEREZOSOS__;   // se guardan al usarlos por primera vez
self.addEventListener('install', (e) => {
  // Todo o nada: si falta un archivo, no se instala un juego roto.
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then((c) =>
    c.match(r, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      if (r.mode === 'navigate') return c.match('__INICIO__').then((i) => i || fetch(r));
      const ruta = new URL(r.url).pathname.slice(new URL(self.registration.scope).pathname.length);
      if (!PEREZOSOS.includes(ruta)) return fetch(r);
      return fetch(r).then((resp) => {
        if (resp.ok && resp.status === 200) c.put(r, resp.clone()).catch(() => {});
        return resp;
      });
    })));
});
"""


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
    perezosos = sorted({q.relative_to(d).as_posix() for pat in a.perezosos for q in d.glob(pat) if q.is_file()})
    lista = ["./"] + [p.relative_to(d).as_posix() for p in archivos if p.relative_to(d).as_posix() not in perezosos]
    sw = (SW.replace("__VERSION__", "porteo-" + h.hexdigest()[:12])
            .replace("__ARCHIVOS__", json.dumps(lista, ensure_ascii=False))
            .replace("__PEREZOSOS__", json.dumps(perezosos, ensure_ascii=False))
            .replace("__INICIO__", a.inicio))
    (d / "sw.js").write_text(sw, "utf-8")
    peso = sum(p.stat().st_size for p in archivos if p.relative_to(d).as_posix() not in perezosos)
    print(f"PWA: {len(lista)} entradas, {peso / 1048576:.2f} MB en caché, versión {h.hexdigest()[:12]}"
          + (f"; {len(perezosos)} perezosos, al usarlos" if perezosos else ""))


if __name__ == "__main__":
    main()

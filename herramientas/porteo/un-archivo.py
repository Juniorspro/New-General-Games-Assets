#!/usr/bin/env python3
"""Mete un juego HTML5 entero en UN solo .html que se abre con doble clic.

    python3 un-archivo.py CARPETA [--inicio index.html] [--salida juego.html]

Por qué hace falta y no alcanza con copiar la carpeta: abierto desde el disco
(file:// o content:// en Android), el navegador no deja hacer fetch() ni XHR a
los archivos de al lado. Casi todos los juegos cargan sus datos así.

Cómo:
  - CSS y <script src> se meten en el HTML; los url() del CSS, como data: URI.
  - El resto de los archivos viaja en bloques <script type="porteo/archivo">
    en base64, comprimidos con gzip cuando conviene (los .bin y .json bajan
    mucho; los .ogg/.webp ya vienen comprimidos y se dejan).
  - Al abrir, un arranque los descomprime (DecompressionStream), arma Blob URLs
    y parcha fetch, XMLHttpRequest, los src de img/audio/video y FontFace para
    que cada pedido a "datos/x.bin" reciba su blob. Recién ahí corre el código
    del juego, en el mismo orden que tenía.

Límites conocidos: no cubre import() dinámico de módulos ES ni document.write;
DecompressionStream pide Chrome 80+, Safari 16.4+, Firefox 113+.
"""
import argparse
import base64
import gzip
import mimetypes
import re
from pathlib import Path

NO_EMBEBER = {"sw.js", "manifest.webmanifest", "icono-192.png", "icono-512.png"}  # los genera pwa.py
TIPOS = {".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm",
         ".json": "application/json", ".webp": "image/webp", ".ogg": "audio/ogg", ".opus": "audio/ogg",
         ".ttf": "font/ttf", ".otf": "font/otf", ".woff": "font/woff", ".woff2": "font/woff2",
         ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".bin": "application/octet-stream"}


def tipo(p: Path):
    return TIPOS.get(p.suffix.lower()) or mimetypes.guess_type(p.name)[0] or "application/octet-stream"


def b64(datos: bytes):
    return base64.b64encode(datos).decode("ascii")


def empacar(datos: bytes):
    """(base64, comprimido?) — gzip sólo si achica más de un 10%."""
    gz = gzip.compress(datos, 9, mtime=0)
    if len(gz) < len(datos) * 0.9:
        return b64(gz), True
    return b64(datos), False


def seguro_en_script(texto: str):
    # "</script" cerraría el bloque y "<!--" cambia cómo el HTML lee el script.
    # Con la barra o el signo escapados, el JS significa exactamente lo mismo.
    return texto.replace("</script", "<\\/script").replace("<!--", "<\\!--")


ARRANQUE = r"""<script>
/* porteo:un-archivo — arranque. Ver herramientas/porteo/un-archivo.py */
(function () {
  var A = {}, base = document.baseURI;
  function clave(u) {
    try { var h = new URL(u, document.baseURI).href; return h.split('#')[0].split('?')[0]; } catch (e) { return null; }
  }
  function buscar(u) {
    if (typeof u !== 'string' || /^(blob|data):/.test(u)) return null;
    var k = clave(u);
    return k && A[k] || null;
  }
  function bytes(s) {
    var b = atob(s), n = b.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = b.charCodeAt(i);
    return u;
  }
  function abrir(el) {
    var u = bytes(el.textContent);
    el.textContent = '';  // que el base64 no quede ocupando memoria dos veces
    if (el.dataset.gz !== '1') return Promise.resolve(u.buffer);
    return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }

  // ---- los parches: cada pedido a un archivo del juego recibe su blob ----
  var f0 = window.fetch;
  window.fetch = function (input, init) {
    var a = buscar(typeof input === 'string' ? input : input && input.url);
    if (a) return Promise.resolve(new Response(a.blob, { status: 200, headers: { 'Content-Type': a.tipo } }));
    return f0.apply(this, arguments);
  };
  var x0 = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) {
    var a = buscar(u);
    if (a) { arguments[1] = a.url; }
    return x0.apply(this, arguments);
  };
  function parchar(C, prop) {
    if (!C) return;
    var d = Object.getOwnPropertyDescriptor(C.prototype, prop);
    if (!d || !d.set) return;
    Object.defineProperty(C.prototype, prop, {
      configurable: true, enumerable: d.enumerable, get: d.get,
      set: function (v) { var a = buscar(v); d.set.call(this, a ? a.url : v); }
    });
  }
  parchar(window.HTMLImageElement, 'src');
  parchar(window.HTMLMediaElement, 'src');
  parchar(window.HTMLSourceElement, 'src');
  parchar(window.HTMLScriptElement, 'src');
  parchar(window.HTMLLinkElement, 'href');
  var sa = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (n, v) {
    if (n === 'src' || n === 'href') { var a = buscar(v); if (a) v = a.url; }
    return sa.call(this, n, v);
  };
  if (window.FontFace) {
    var FF = window.FontFace;
    var F2 = function (fam, src, d) {
      if (typeof src === 'string') src = src.replace(/url\((['"]?)([^'")]+)\1\)/g, function (m, q, u) {
        var a = buscar(u); return a ? 'url(' + a.url + ')' : m;
      });
      return new FF(fam, src, d);
    };
    F2.prototype = FF.prototype;
    window.FontFace = F2;
  }
  if (window.Worker) {
    var W = window.Worker;
    window.Worker = function (u, o) { var a = buscar(String(u)); return new W(a ? a.url : u, o); };
    window.Worker.prototype = W.prototype;
  }

  // load y DOMContentLoaded ya pasaron cuando el juego corre (esperó a
  // descomprimir): a quien se anote tarde se le avisa igual.
  var ae = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (t, fn, o) {
    var tarde = (t === 'DOMContentLoaded' && (this === document || this === window) && document.readyState !== 'loading') ||
                (t === 'load' && this === window && document.readyState === 'complete');
    if (tarde && fn) {
      var self = this;
      setTimeout(function () { var e = new Event(t); typeof fn === 'function' ? fn.call(self, e) : fn.handleEvent(e); }, 0);
      return;
    }
    return ae.call(this, t, fn, o);
  };

  window.__porteoUnArchivo = function () {
    var bloques = document.querySelectorAll('script[type="porteo/archivo"]');
    return Promise.all(Array.prototype.map.call(bloques, function (el) {
      var ruta = el.dataset.ruta, t = el.dataset.tipo;
      return abrir(el).then(function (buf) {
        var blob = new Blob([buf], { type: t });
        A[clave(ruta)] = { blob: blob, url: URL.createObjectURL(blob), tipo: t, texto: null, buf: buf };
      });
    })).then(function () {
      // lo que ya estaba en el HTML con src="datos/..." (antes de los parches)
      document.querySelectorAll('[src]').forEach(function (el) {
        var a = buscar(el.getAttribute('src')); if (a) el.src = a.url;
      });
      var cods = document.querySelectorAll('script[type="porteo/codigo"]');
      var dec = new TextDecoder();
      var corre = Promise.resolve();
      Array.prototype.forEach.call(cods, function (el) {
        corre = corre.then(function () {
          var p = el.dataset.gz === '1' ? abrir(el).then(function (b) { return dec.decode(b); })
                                        : Promise.resolve(el.textContent);
          return p.then(function (codigo) {
            var s = document.createElement('script');
            s.textContent = codigo + '\n//# sourceURL=' + el.dataset.src;
            document.body.appendChild(s);
          });
        });
      });
      return corre;
    }).then(function () {
      // window.onload = fn asignado por el juego después de que pasó el load
      if (typeof window.onload === 'function' && document.readyState === 'complete') {
        try { window.onload(new Event('load')); } catch (e) { console.error(e); }
      }
    });
  };
})();
</script>
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("carpeta", type=Path)
    ap.add_argument("--inicio", default="index.html")
    ap.add_argument("--salida", type=Path)
    a = ap.parse_args()

    d = a.carpeta.resolve()
    html = (d / a.inicio).read_text("utf-8")
    usados = {a.inicio}

    def dato_uri(ruta: Path):
        return f"data:{tipo(ruta)};base64,{b64(ruta.read_bytes())}"

    # 1. CSS adentro, con sus url() como data: URI
    def css(m):
        ruta = (d / m.group(1)).resolve()
        usados.add(ruta.relative_to(d).as_posix())
        txt = ruta.read_text("utf-8")

        def url(mu):
            u = mu.group(2)
            if re.match(r"^(data:|https?:|#)", u):
                return mu.group(0)
            f = (ruta.parent / u).resolve()
            return f"url('{dato_uri(f)}')" if f.exists() else mu.group(0)
        return "<style>\n" + re.sub(r"url\((['\"]?)([^'\")]+)\1\)", url, txt) + "\n</style>"
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, html)

    # 2. lo de PWA no tiene sentido abierto desde el disco
    html = re.sub(r"<!-- porteo:pwa -->.*?<!-- /porteo:pwa -->\n?", "", html, flags=re.S)
    ico = d / "icono-192.png"
    if ico.exists():
        html = html.replace("</head>", f'<link rel="icon" href="{dato_uri(ico)}">\n</head>', 1)

    # 3. scripts → bloques que corren después del arranque, en el mismo orden
    def script(m):
        attrs, src, inline = m.group(1) or "", m.group(2), m.group(3)
        if src:
            if re.match(r"^https?:", src):
                return m.group(0)
            ruta = (d / src).resolve()
            usados.add(ruta.relative_to(d).as_posix())
            datos, gz = empacar(ruta.read_bytes())
            return (f'<script type="porteo/codigo" data-src="{src}" data-gz="{1 if gz else 0}">'
                    f"{datos if gz else seguro_en_script(ruta.read_text('utf-8'))}</script>")
        if 'type="' in attrs and "javascript" not in attrs:
            return m.group(0)
        return (f'<script type="porteo/codigo" data-src="inline" data-gz="0">'
                f"{seguro_en_script(inline)}</script>")
    html = re.sub(r'<script((?:\s+(?!src=)[a-z-]+(?:="[^"]*")?)*)(?:\s+src="([^"]+)")?[^>]*>(.*?)</script>',
                  script, html, flags=re.S)

    # 4. el resto de los archivos, como bloques de datos
    bloques, crudo, emb = [], 0, 0
    for p in sorted(d.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(d).as_posix()
        if rel in usados or p.name in NO_EMBEBER:
            continue
        datos, gz = empacar(p.read_bytes())
        crudo += p.stat().st_size
        emb += len(datos)
        bloques.append(f'<script type="porteo/archivo" data-ruta="{rel}" data-tipo="{tipo(p)}" '
                       f'data-gz="{1 if gz else 0}">{datos}</script>')

    final = "\n".join(bloques) + "\n<script>window.__porteoUnArchivo().catch(function(e){" \
        "document.body.insertAdjacentHTML('beforeend','<pre style=\"color:#f66;position:fixed;inset:0;" \
        "padding:20px;white-space:pre-wrap\">No se pudo abrir el juego: '+e+'</pre>');});</script>\n"
    html = html.replace("<head>", "<head>\n" + ARRANQUE, 1)
    html = html.replace("</body>", final + "</body>", 1)

    salida = a.salida or d.parent / f"{d.name}-en-un-archivo.html"
    salida.write_text(html, "utf-8")
    tam = salida.stat().st_size
    print(f"{salida}: {tam:,} bytes ({tam / 1048576:.2f} MB) — {len(bloques)} archivos, "
          f"{crudo / 1048576:.2f} MB crudos → {emb / 1048576:.2f} MB en base64")


if __name__ == "__main__":
    main()

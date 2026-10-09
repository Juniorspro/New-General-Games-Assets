#!/usr/bin/env python3
"""Mete un juego HTML5 entero en UN solo .html que se abre con doble clic.

    python3 un-archivo.py CARPETA [--inicio index.html] [--salida juego.html] [--al-final RUTA ...] [--utf8]

Por qué hace falta y no alcanza con copiar la carpeta: abierto desde el disco
(file:// o content:// en Android), el navegador no deja hacer fetch() ni XHR a
los archivos de al lado. Casi todos los juegos cargan sus datos así.

Cómo:
  - El .html va en UTF-16 (con BOM, que manda por encima del charset que diga un
    servidor). Así cada carácter lleva dos bytes del archivo tal cual y sólo se
    escapan las unidades que el HTML no deja pasar (sustitutos sueltos, NUL, CR,
    "<"): ~3% más que el archivo, contra el 33% del base64. Medido en Chrome con
    PvZ (25 MB de datos): 27 MB de HTML en vez de 35, y la página se lee en 0,42 s
    en vez de 0,68 s (CPU ÷4: 2,0 s en vez de 3,2 s). El texto del juego no cambia.
  - CSS y <script src> se meten en el HTML; los url() del CSS, como data: URI.
  - El código y los datos viajan en bloques <script type="porteo/archivo">,
    con gzip cuando achica (DecompressionStream; el .wasm baja ~70%).
  - Al abrir, un arranque los decodifica y parcha fetch, XMLHttpRequest, los src
    de img/audio/video y FontFace para que cada pedido a "datos/x.bin" reciba lo
    suyo. Recién ahí corre el código del juego, en el mismo orden que tenía.
  - --al-final RUTA (para archivos grandes que el juego pide con fetch()): van al
    final, partidos, y el juego arranca sin esperarlos. Mientras el navegador
    sigue leyendo la página, un worker los decodifica y descomprime, y el motor ya
    compila su wasm; fetch() de esa ruta espera a que estén. El juego (o su
    carcasa) puede pedirlos sin copias y con progreso con
    window.__porteoArchivo(ruta, alAvanzar) → Promise<Uint8Array>.

  - --utf8: el .html en UTF-8 de verdad, con 7 bits de datos por carácter (un 14% más que los
    archivos, contra el 3% del UTF-16). Para cuando el .html no se sirve tal cual: una plataforma
    que lo lee como texto (para meterle algo, guardarlo en una base o pasarlo a srcdoc) rompe el
    UTF-16, que no es UTF-8 válido. Cada carácter ASCII lleva 7 bits; los valores que el HTML no deja
    pasar (NUL, CR y "<") van juntos con los 7 bits siguientes en un carácter de dos bytes
    (U+0100..U+027F; al final, solo, U+0280..U+0282).

Límites conocidos: no cubre import() dinámico de módulos ES ni document.write;
DecompressionStream pide Chrome 80+, Safari 16.4+, Firefox 113+.
"""
import argparse
import base64
import codecs
import gzip
import json
import mimetypes
import re
from pathlib import Path

NO_EMBEBER = {"sw.js", "manifest.webmanifest", "icono-192.png", "icono-512.png"}  # los genera pwa.py
TIPOS = {".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm",
         ".json": "application/json", ".webp": "image/webp", ".ogg": "audio/ogg", ".opus": "audio/ogg",
         ".ttf": "font/ttf", ".otf": "font/otf", ".woff": "font/woff", ".woff2": "font/woff2",
         ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".bin": "application/octet-stream"}
PARTE = 1 << 20          # bytes por parte de los archivos --al-final (cada una mueve la barra)
GZ_MINIMO = 0.04         # gzip sólo si achica al menos un 4%


def tipo(p: Path):
    return TIPOS.get(p.suffix.lower()) or mimetypes.guess_type(p.name)[0] or "application/octet-stream"


def b64(datos: bytes):
    return base64.b64encode(datos).decode("ascii")


def comprimir(datos: bytes):
    """(bytes, comprimido?)"""
    gz = gzip.compress(datos, 9, mtime=0)
    if len(gz) <= len(datos) * (1 - GZ_MINIMO):
        return gz, True
    return datos, False


# ── bytes → texto UTF-16 ───────────────────────────────────────────────────
# Cada dos bytes son una unidad de 16 bits que va como un carácter. No pasan intactas:
# 0x0000 (el parser la cambia por U+FFFD), 0x000D (se vuelve 0x000A), 0x003C ("<" podría
# cerrar el <script>) y los sustitutos sueltos (el decodificador UTF-16 los cambia por
# U+FFFD; un par alto+bajo válido sí pasa). Esas van como ESC + código:
#   sustituto s → s − 0xD700 (0x0100..0x08FF); 0x0000 → 0x0900; 0x000D → 0x0901;
#   0x003C → 0x0902; ESC → 0x0903. El arranque (deco) hace lo inverso.
CODIGOS = {0x0000: 0x0900, 0x000D: 0x0901, 0x003C: 0x0902}
CANDIDATOS = [chr(c) for c in range(0xF8FF, 0xF8BF, -1)]  # uso privado: casi nunca están


def a_utf16(datos: bytes):
    """bytes → (texto, ESC). Un número impar de bytes se completa con un 0 (data-n dice el largo)."""
    if len(datos) % 2:
        datos += b"\0"
    # surrogatepass: un par válido queda como un carácter astral (y se escribe igual);
    # los sustitutos sueltos quedan como tales, para escaparlos.
    s = datos.decode("utf-16-le", "surrogatepass")
    esc = min(CANDIDATOS, key=s.count)
    tabla = dict(CODIGOS)
    tabla[ord(esc)] = 0x0903

    def cambiar(m):
        c = ord(m.group())
        return esc + chr(tabla[c] if c in tabla else c - 0xD700)
    return re.sub("[\x00\r<" + esc + "\ud800-\udfff]", cambiar, s), ord(esc)


# ── bytes → texto de 7 bits (--utf8) ──────────────────────────────────────
ILEGALES = b"\x00\x0d\x3c"  # NUL (el parser lo cambia por U+FFFD), CR (se vuelve LF), "<" (cerraría el <script>)
ILEGAL_RE = re.compile(b"[\x00\x0d\x3c]")


def a_7bits(datos: bytes):
    """bytes → texto: cada carácter, 7 bits (ver --utf8). El arranque (deco) hace lo inverso."""
    n = len(datos)
    total = (n * 8 + 6) // 7
    b = datos + b"\0" * ((-n) % 7)
    g = bytearray(len(b) // 7 * 8)
    k, fb = 0, int.from_bytes
    for i in range(0, len(b), 7):
        x = fb(b[i:i + 7], "big")
        g[k:k + 8] = ((x >> 49) & 127, (x >> 42) & 127, (x >> 35) & 127, (x >> 28) & 127,
                      (x >> 21) & 127, (x >> 14) & 127, (x >> 7) & 127, x & 127)
        k += 8
    g = bytes(g[:total])
    partes, i = [], 0
    while True:
        m = ILEGAL_RE.search(g, i)
        if not m:
            partes.append(g[i:].decode("ascii"))
            return "".join(partes)
        j = m.start()
        partes.append(g[i:j].decode("ascii"))
        c = ILEGALES.index(g[j])
        if j + 1 < total:
            partes.append(chr(0x100 + (c << 7) + g[j + 1]))
            i = j + 2
        else:
            partes.append(chr(0x280 + c))
            i = j + 1


UTF8 = False  # --utf8


def bloque(etiqueta: str, datos: bytes, gz: bool, **attrs):
    texto, esc = (a_7bits(datos), 7) if UTF8 else a_utf16(datos)
    extra = "".join(f' data-{k}="{v}"' for k, v in attrs.items())
    return (f'<script type="{etiqueta}"{extra} data-gz="{1 if gz else 0}" data-n="{len(datos)}" '
            f'data-e="{esc}">{texto}</script>')


ARRANQUE = r"""<script>
/* porteo:un-archivo — arranque. Ver herramientas/porteo/un-archivo.py */
(function () {
  'use strict';
  var A = {};
  // Una página abierta desde una dirección blob: (otra página la armó con el texto del .html) no
  // resuelve direcciones relativas: ahí la clave es la ruta tal cual.
  function clave(u) {
    try { var h = new URL(u, document.baseURI).href; return h.split('#')[0].split('?')[0]; }
    catch (e) { return typeof u === 'string' ? u.replace(/^\.\//, '').split('#')[0].split('?')[0] : null; }
  }
  function buscar(u) {
    if (typeof u !== 'string' || /^(blob|data):/.test(u)) return null;
    var k = clave(u);
    return k && A[k] || null;
  }
  // El texto de un bloque → sus bytes (un-archivo.py: a_utf16, o a_7bits si E es 7). También corre
  // en el worker.
  function deco(s, E, n) {
    var L = s.length;
    if (E === 7) {
      var IL = [0, 13, 60], b7 = new Uint8Array(n), j7 = 0, acc = 0, bits = 0;
      for (var i7 = 0; i7 < L; i7++) {
        var c7 = s.charCodeAt(i7), v, w = -1;
        if (c7 < 0x80) v = c7;
        else if (c7 < 0x280) { c7 -= 0x100; v = IL[c7 >> 7]; w = c7 & 127; }
        else v = IL[c7 - 0x280];
        acc = (acc << 7) | v; bits += 7;
        if (bits >= 8) { bits -= 8; if (j7 < n) b7[j7++] = acc >> bits; acc &= (1 << bits) - 1; }
        if (w >= 0) {
          acc = (acc << 7) | w; bits += 7;
          if (bits >= 8) { bits -= 8; if (j7 < n) b7[j7++] = acc >> bits; acc &= (1 << bits) - 1; }
        }
      }
      if (j7 !== n) throw new Error('bloque dañado (' + j7 + ' de ' + n + ')');
      return b7;
    }
    var u = new Uint16Array((n + 1) >> 1), j = 0;
    for (var i = 0; i < L; i++) {
      var c = s.charCodeAt(i);
      if (c === E) { c = s.charCodeAt(++i); c = c < 0x900 ? c + 0xD700 : c === 0x900 ? 0 : c === 0x901 ? 13 : c === 0x902 ? 60 : E; }
      u[j++] = c;
    }
    if (j !== u.length) throw new Error('bloque dañado (' + j + ' de ' + u.length + ')');
    var b = new Uint8Array(u.buffer);
    if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) {  // procesador big-endian: los bytes al revés
      for (var k = 0; k < b.length; k += 2) { var t = b[k]; b[k] = b[k + 1]; b[k + 1] = t; }
    }
    return b.subarray(0, n);
  }
  function gunzip(u) {
    return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
      .then(function (b) { return new Uint8Array(b); });
  }
  function abrir(el) {
    var u = deco(el.textContent, +el.dataset.e, +el.dataset.n);
    el.textContent = '';  // que el texto no quede ocupando memoria dos veces
    return el.dataset.gz === '1' ? gunzip(u) : Promise.resolve(u);
  }
  // Lo que es texto lleva charset: un <script> o CSS sin charset se lee con la codificación de la
  // página, que acá es UTF-16 (un script agregado después con src daba "Invalid or unexpected token").
  function tipoDe(a) {
    return /^text\/|javascript|json|xml/.test(a.tipo) && !/charset=/i.test(a.tipo) ? a.tipo + ';charset=utf-8' : a.tipo;
  }
  function url(a) {
    if (!a.url) { a.blob = new Blob([a.datos], { type: tipoDe(a) }); a.url = URL.createObjectURL(a.blob); }
    return a.url;
  }
  function respuesta(a) {
    return new Response(a.datos, { status: 200, headers: { 'Content-Type': tipoDe(a), 'Content-Length': String(a.datos.length) } });
  }

  // ---- los parches: cada pedido a un archivo del juego recibe lo suyo ----
  var f0 = window.fetch;
  window.fetch = function (input, init) {
    var a = buscar(typeof input === 'string' ? input : input && input.url);
    if (!a) return f0.apply(this, arguments);
    return a.datos ? Promise.resolve(respuesta(a)) : a.listo.then(function () { return respuesta(a); });
  };
  var x0 = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) {
    var a = buscar(u);
    if (a && a.datos) arguments[1] = url(a);
    else if (a) console.warn('un-archivo: ' + u + ' todavía no está (va al final: pedirlo con fetch)');
    return x0.apply(this, arguments);
  };
  function parchar(C, prop) {
    if (!C) return;
    var d = Object.getOwnPropertyDescriptor(C.prototype, prop);
    if (!d || !d.set) return;
    Object.defineProperty(C.prototype, prop, {
      configurable: true, enumerable: d.enumerable, get: d.get,
      set: function (v) { var a = buscar(v); d.set.call(this, a && a.datos ? url(a) : v); }
    });
  }
  parchar(window.HTMLImageElement, 'src');
  parchar(window.HTMLMediaElement, 'src');
  parchar(window.HTMLSourceElement, 'src');
  parchar(window.HTMLScriptElement, 'src');
  parchar(window.HTMLLinkElement, 'href');
  var sa = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (n, v) {
    if (n === 'src' || n === 'href') { var a = buscar(v); if (a && a.datos) v = url(a); }
    return sa.call(this, n, v);
  };
  if (window.FontFace) {
    var FF = window.FontFace;
    var F2 = function (fam, src, d) {
      if (typeof src === 'string') src = src.replace(/url\((['"]?)([^'")]+)\1\)/g, function (m, q, u) {
        var a = buscar(u); return a && a.datos ? 'url(' + url(a) + ')' : m;
      });
      return new FF(fam, src, d);
    };
    F2.prototype = FF.prototype;
    window.FontFace = F2;
  }
  var W0 = window.Worker;
  if (W0) {
    window.Worker = function (u, o) { var a = buscar(String(u)); return new W0(a && a.datos ? url(a) : u, o); };
    window.Worker.prototype = W0.prototype;
  }

  // load y DOMContentLoaded pueden haber pasado cuando el juego corre (esperó a
  // decodificar): a quien se anote tarde se le avisa igual.
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

  // ---- los archivos que van al final (--al-final) ----
  // Cada parte la decodifica (y descomprime) un worker mientras el navegador sigue leyendo
  // la página; sin worker, se hace acá mismo con el mismo código. El resultado queda en un
  // solo buffer que pasa a la página sin copiarse.
  function TRABAJADOR(self) {
    var F = {};
    self.onmessage = function (m) {
      var d = m.data, f = F[d.ruta];
      if (!f) {
        f = F[d.ruta] = { u: new Uint8Array(d.total), van: 0 };
        if (d.gz) {
          var ds = new DecompressionStream('gzip'), r = ds.readable.getReader();
          f.w = ds.writable.getWriter();
          (function leer() {
            r.read().then(function (x) {
              if (x.done) return terminar(d.ruta);
              poner(d.ruta, x.value); leer();
            }).catch(function (e) { self.postMessage({ ruta: d.ruta, error: String(e) }); });
          })();
        }
      }
      var b;
      try { b = deco(d.s, d.e, d.n); } catch (e) { self.postMessage({ ruta: d.ruta, error: String(e) }); return; }
      self.postMessage({ ruta: d.ruta, recibida: d.i });
      if (f.w) { f.w.write(b).catch(function () {}); if (d.fin) f.w.close().catch(function () {}); }
      else { poner(d.ruta, b); if (d.fin) terminar(d.ruta); }
    };
    function poner(ruta, b) {
      var f = F[ruta];
      if (f.van + b.length > f.u.length) { self.postMessage({ ruta: ruta, error: 'más datos que los esperados' }); return; }
      f.u.set(b, f.van); f.van += b.length;
      self.postMessage({ ruta: ruta, van: f.van });
    }
    function terminar(ruta) {
      var f = F[ruta];
      if (f.van !== f.u.length) self.postMessage({ ruta: ruta, error: 'faltan datos (' + f.van + ' de ' + f.u.length + ')' });
      else self.postMessage({ ruta: ruta, listo: f.u }, [f.u.buffer]);
      delete F[ruta];
    }
  }
  var obrero, aqui = null, pendientes = {};
  function enUnHilo() {
    // sin worker (o se cayó al arrancar): lo mismo acá, y se reenvía lo que no llegó
    obrero = null;
    aqui = { postMessage: function (x) { setTimeout(function () { recibir(x); }, 0); } };
    TRABAJADOR(aqui);
    var p = pendientes; pendientes = {};
    Object.keys(p).sort(function (a, b) { return a - b; }).forEach(function (k) { aqui.onmessage({ data: p[k] }); });
  }
  function enviar(m) {
    if (obrero === undefined) {
      try {
        obrero = new W0(URL.createObjectURL(new Blob(['var deco = ' + deco + ';(' + TRABAJADOR + ')(self);'], { type: 'text/javascript' })));
        obrero.onmessage = function (e) { recibir(e.data); };
        obrero.onerror = function (e) { console.warn('un-archivo: sin worker (' + e.message + ')'); if (obrero) { obrero.terminate(); enUnHilo(); } };
      } catch (e) { enUnHilo(); }
    }
    if (obrero) { pendientes[m.i] = m; obrero.postMessage(m); } else aqui.onmessage({ data: m });
  }
  function recibir(d) {
    if (d.recibida != null) { delete pendientes[d.recibida]; return; }
    var a = A[clave(d.ruta)];
    if (!a) return;
    if (d.error) { a.fallar(new Error(d.ruta + ': ' + d.error)); return; }
    if (d.van != null) { a.van = d.van; a.oyentes.forEach(function (f) { try { f(a.van, a.total); } catch (e) {} }); }
    if (d.listo) { a.datos = d.listo; a.terminar(a.datos); }
  }
  // Cada parte se busca por su número: el elemento anterior al <script> que llama puede ser
  // código del juego, que se agrega al <body> mientras el navegador todavía lee la página.
  window.__porteoParte = function (i) {
    var el = document.querySelector('script[type="porteo/parte"][data-i="' + i + '"]');
    var m = { i: i, ruta: el.dataset.ruta, total: +el.dataset.total, gz: el.dataset.gz === '1', n: +el.dataset.n,
              e: +el.dataset.e, fin: el.dataset.fin === '1', s: el.textContent };
    el.textContent = '';
    enviar(m);
  };

  // El juego (o su carcasa) puede pedir un archivo sin pasar por fetch: sin copias y con progreso.
  window.__porteoArchivo = function (ruta, alAvanzar) {
    var a = buscar(ruta);
    if (!a) return null;
    if (a.datos) return Promise.resolve(a.datos);
    if (alAvanzar) a.oyentes.push(alAvanzar);
    return a.listo;
  };

  window.__porteoUnArchivo = function (tarde) {
    (tarde || []).forEach(function (t) {
      var a = A[clave(t.ruta)] = { tipo: t.tipo, total: t.total, van: 0, oyentes: [], datos: null };
      a.listo = new Promise(function (ok, mal) { a.terminar = ok; a.fallar = mal; });
      a.listo.catch(function (e) { console.error(e); });
    });
    var bloques = document.querySelectorAll('script[type="porteo/archivo"]');
    return Promise.all(Array.prototype.map.call(bloques, function (el) {
      var ruta = el.dataset.ruta, t = el.dataset.tipo;
      return abrir(el).then(function (u) { A[clave(ruta)] = { datos: u, tipo: t }; });
    })).then(function () {
      // lo que ya estaba en el HTML con src="datos/..." o href (el ícono), antes de los parches
      document.querySelectorAll('[src],link[href]').forEach(function (el) {
        var at = el.hasAttribute('src') ? 'src' : 'href', a = buscar(el.getAttribute(at));
        if (a && a.datos) sa.call(el, at, url(a));
      });
      var cods = document.querySelectorAll('script[type="porteo/codigo"]');
      var dec = new TextDecoder();
      var corre = Promise.resolve();
      Array.prototype.forEach.call(cods, function (el) {
        corre = corre.then(function () {
          return abrir(el).then(function (u) {
            var s = document.createElement('script');
            s.textContent = dec.decode(u) + '\n//# sourceURL=' + el.dataset.src;
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
    ap.add_argument("--al-final", action="append", default=[], metavar="RUTA",
                    help="archivo grande que el juego pide con fetch(): va al final y no se lo espera para arrancar")
    ap.add_argument("--utf8", action="store_true",
                    help="UTF-8 de verdad (7 bits por carácter, 14%% más grande): aguanta que lo lean como texto")
    a = ap.parse_args()
    global UTF8
    UTF8 = a.utf8

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

    # 2. lo de PWA no tiene sentido abierto desde el disco; el charset lo dice el BOM
    html = re.sub(r"<!-- porteo:pwa -->.*?<!-- /porteo:pwa -->\n?", "", html, flags=re.S)
    html = re.sub(r"<meta charset=[^>]*>\n?", "", html, flags=re.I)
    bloques = []
    ico = d / "icono-192.png"
    if ico.exists():
        html = html.replace("</head>", '<link rel="icon" href="icono-192.png">\n</head>', 1)
        bloques.append(bloque("porteo/archivo", ico.read_bytes(), False, ruta="icono-192.png", tipo="image/png"))

    # 3. scripts → bloques que corren después del arranque, en el mismo orden
    def script(m):
        attrs, src, inline = m.group(1) or "", m.group(2), m.group(3)
        if src:
            if re.match(r"^https?:", src):
                return m.group(0)
            ruta = (d / src).resolve()
            usados.add(ruta.relative_to(d).as_posix())
            return bloque("porteo/codigo", *comprimir(ruta.read_bytes()), src=src)
        if 'type="' in attrs and "javascript" not in attrs:
            return m.group(0)
        return bloque("porteo/codigo", *comprimir(inline.encode("utf-8")), src="inline")
    html = re.sub(r'<script((?:\s+(?!src=)[a-z-]+(?:="[^"]*")?)*)(?:\s+src="([^"]+)")?[^>]*>(.*?)</script>',
                  script, html, flags=re.S)

    # 4. el resto de los archivos, como bloques de datos; los --al-final, partidos y al final
    al_final = [Path(x).as_posix() for x in a.al_final]
    tarde, partes, crudo = [], [], 0
    for p in sorted(d.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(d).as_posix()
        if rel in usados or p.name in NO_EMBEBER:
            continue
        datos, gz = comprimir(p.read_bytes())
        crudo += p.stat().st_size
        if rel not in al_final:
            bloques.append(bloque("porteo/archivo", datos, gz, ruta=rel, tipo=tipo(p)))
            continue
        tarde.append({"ruta": rel, "tipo": tipo(p), "total": p.stat().st_size})
        for i in range(0, len(datos), PARTE):
            k = len(partes)
            partes.append(bloque("porteo/parte", datos[i:i + PARTE], gz, i=k, ruta=rel, total=p.stat().st_size,
                                 fin=1 if i + PARTE >= len(datos) else 0)
                          + f"<script>__porteoParte({k})</script>")
    faltan = set(al_final) - {t["ruta"] for t in tarde}
    if faltan:
        raise SystemExit(f"--al-final: no están en {d}: {', '.join(sorted(faltan))}")

    final = ("\n".join(bloques) + "\n<script>window.__porteoUnArchivo(" + json.dumps(tarde) + ").catch(function(e){"
             "document.body.insertAdjacentHTML('beforeend','<pre style=\"color:#f66;position:fixed;inset:0;"
             "padding:20px;white-space:pre-wrap;z-index:99\">No se pudo abrir el juego: '+e+'</pre>');});</script>\n"
             + "\n".join(partes) + "\n")
    html = html.replace("<head>", "<head>\n" + ARRANQUE, 1)
    html = html.replace("</body>", final + "</body>", 1)

    salida = a.salida or d.parent / f"{d.name}-en-un-archivo.html"
    if UTF8:
        # el BOM manda aunque el servidor diga otro charset; el <meta>, por si alguien saca el BOM
        html = html.replace("<head>", '<head>\n<meta charset="utf-8">', 1)
        salida.write_bytes(codecs.BOM_UTF8 + html.encode("utf-8"))
    else:
        salida.write_bytes(codecs.BOM_UTF16_LE + html.encode("utf-16-le"))
    tam = salida.stat().st_size
    print(f"{salida}: {tam:,} bytes ({tam / 1048576:.2f} MB) — {len(bloques)} bloques + {len(partes)} partes al final, "
          f"{crudo / 1048576:.2f} MB de archivos")


if __name__ == "__main__":
    main()

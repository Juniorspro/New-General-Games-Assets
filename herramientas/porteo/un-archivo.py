#!/usr/bin/env python3
"""Mete un juego HTML5 entero en UN solo .html que se abre con doble clic.

    python3 un-archivo.py CARPETA [--inicio index.html] [--salida juego.html] [--al-final RUTA ...]

Por qué hace falta y no alcanza con copiar la carpeta: abierto desde el disco
(file:// o content:// en Android), el navegador no deja hacer fetch() ni XHR a
los archivos de al lado. Casi todos los juegos cargan sus datos así.

Cómo:
  - El .html va en UTF-8 y los datos, de a 7 bits por carácter ASCII: 8/7 del
    archivo más un 2 %, contra el 33 % del base64. Los tres valores que no pueden ir
    sueltos dentro de un <script> van como U+00C0 + valor: el 0 (el parser lo cambia
    por U+FFFD), el 13 (lo vuelve salto de línea) y el 60, "<" (podría cerrar el
    script). Todo queda debajo de U+0100: el navegador guarda el texto con un byte
    por carácter.
    Antes iba en UTF-16 (~3 % más que el archivo), pero la plataforma donde se suben
    los juegos lee el archivo como UTF-8 y mostraba el código como texto. PvZ (25 MB
    de datos): UTF-16 26,0 MB, UTF-8 de 7 bits 29,4 MB, base64 33,7 MB.
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
  - Cada archivo se reconoce por el final de la ruta que se pida, sin resolverla
    contra la dirección de la página: una plataforma puede abrirla como blob:,
    data: o about:blank, y ahí new URL falla con las rutas relativas.
  - Si el HTML llega cortado (una plataforma que lo recorta, una descarga a medias),
    lo dice en pantalla en vez de quedarse cargando.

Límites conocidos: no cubre import() dinámico de módulos ES ni document.write;
DecompressionStream pide Chrome 80+, Safari 16.4+, Firefox 113+.
"""
import argparse
import base64
import gzip
import json
import mimetypes
import re
from pathlib import Path

try:
    import numpy as np   # sólo para que sea rápido: sin numpy da lo mismo, más lento
except ImportError:
    np = None

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


# ── bytes → texto de 7 bits ────────────────────────────────────────────────
# Los bits del archivo, de a 7 y del más alto al más bajo, cada grupo un carácter ASCII
# (el último se completa con ceros; data-n dice cuántos bytes son). 0, 13 y 60 no pasan
# intactos por el parser: van como U+00C0 + valor (À, Í, ü). El arranque (deco) hace lo
# inverso. Para el tamaño cuenta el UTF-8: el ASCII es un byte; esos tres, dos.
ESCAPE = 0xC0
PROHIBIDOS = (0, 13, 60)
_ESCAPAR = {p: chr(ESCAPE + p) for p in PROHIBIDOS}
_DESESCAPAR = bytes.maketrans(bytes(ESCAPE + p for p in PROHIBIDOS), bytes(PROHIBIDOS))


def largo_texto(n: int):
    """Cuántos caracteres ocupan n bytes."""
    return -(-n * 8 // 7)


def a_texto(datos: bytes):
    if np is not None:
        bits = np.unpackbits(np.frombuffer(datos, np.uint8))
        bits = np.concatenate([bits, np.zeros(-len(bits) % 7, np.uint8)])
        crudo = (np.packbits(bits.reshape(-1, 7), axis=1)[:, 0] >> 1).tobytes()
    else:
        relleno = datos + b"\0" * (-len(datos) % 7)
        crudo = bytearray()
        for i in range(0, len(relleno), 7):
            v = int.from_bytes(relleno[i:i + 7], "big")
            crudo += bytes((v >> d) & 127 for d in range(49, -1, -7))
        crudo = bytes(crudo[:largo_texto(len(datos))])
    return crudo.decode("ascii").translate(_ESCAPAR)


def de_texto(texto: str, n: int):
    """Lo mismo que deco() del arranque: para comprobar cada bloque antes de escribir."""
    crudo = texto.encode("latin-1").translate(_DESESCAPAR)
    if np is not None:
        siete = np.unpackbits(np.frombuffer(crudo, np.uint8)[:, None], axis=1)[:, 1:]
        return np.packbits(siete.ravel())[:n].tobytes()
    crudo += b"\0" * (-len(crudo) % 8)
    sal = bytearray()
    for i in range(0, len(crudo), 8):
        v = 0
        for x in crudo[i:i + 8]:
            v = v << 7 | x
        sal += v.to_bytes(7, "big")
    return bytes(sal[:n])


def bloque(etiqueta: str, datos: bytes, gz: bool, **attrs):
    texto = a_texto(datos)
    if len(texto) != largo_texto(len(datos)) or de_texto(texto, len(datos)) != datos:
        raise SystemExit(f"no vuelve igual: {etiqueta} {attrs}")
    extra = "".join(f' data-{k}="{v}"' for k, v in attrs.items())
    return f'<script type="{etiqueta}"{extra} data-gz="{1 if gz else 0}" data-n="{len(datos)}">{texto}</script>'


ARRANQUE = r"""<script>
/* porteo:un-archivo — arranque. Ver herramientas/porteo/un-archivo.py */
(function () {
  'use strict';
  // Cada archivo va anotado con su ruta dentro de la carpeta del juego ('main.pak',
  // 'datos/x.bin') y se lo reconoce por el final de lo que se pida. Sin new URL: si la
  // página se abre como blob:, data: o about:blank, falla con las rutas relativas y no
  // se encontraba nada (PvZ quedaba en "both async and sync fetching of the wasm failed").
  var A = {}, P = {};
  function anotar(ruta, a) {
    var k = ruta.slice(ruta.lastIndexOf('/') + 1);
    if (!A[ruta]) (P[k] = P[k] || []).push(ruta);
    return A[ruta] = a;
  }
  function buscar(u) {
    if (typeof u !== 'string') return null;
    var s = u.split('#')[0].split('?')[0];
    try { s = decodeURI(s); } catch (e) {}
    var c = P[s.slice(s.lastIndexOf('/') + 1)] || [];
    for (var i = 0; i < c.length; i++) {
      if (s === c[i] || s.slice(-c[i].length - 1) === '/' + c[i]) return A[c[i]];
    }
    return null;
  }
  // El texto de un bloque → sus bytes: 7 bits por carácter, y 0, 13 y 60 como U+00C0 +
  // valor (un-archivo.py: a_texto). También corre en el worker.
  function deco(s, n) {
    var b = new Uint8Array(n), acc = 0, bits = 0, j = 0, L = s.length;
    for (var i = 0; i < L; i++) {
      var c = s.charCodeAt(i);
      if (c > 127) c -= 0xC0;
      acc = (acc << 7 | c) & 0x7FFF; bits += 7;
      if (bits >= 8) { bits -= 8; b[j++] = acc >> bits; }  // pasado el final, el Uint8Array no escribe
    }
    if (j !== n) throw new Error('bloque dañado (' + j + ' de ' + n + ' bytes)');
    return b;
  }
  // Que se lea en un teléfono: es lo que se manda en una captura.
  function aviso(t) {
    var p = document.createElement('pre');
    p.style.cssText = 'position:fixed;inset:0;z-index:2147483647;margin:0;padding:20px;background:rgba(0,0,0,.88);' +
      'color:#ff8a80;font:16px/1.45 system-ui,sans-serif;white-space:pre-wrap';
    p.textContent = t;
    (document.body || document.documentElement).appendChild(p);
  }
  window.__porteoAviso = aviso;
  function gunzip(u) {
    return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
      .then(function (b) { return new Uint8Array(b); });
  }
  function abrir(el) {
    var u = deco(el.textContent, +el.dataset.n);
    el.textContent = '';  // que el texto no quede ocupando memoria dos veces
    return el.dataset.gz === '1' ? gunzip(u) : Promise.resolve(u);
  }
  function url(a) {
    if (!a.url) { a.blob = new Blob([a.datos], { type: a.tipo }); a.url = URL.createObjectURL(a.blob); }
    return a.url;
  }
  function respuesta(a) {
    return new Response(a.datos, { status: 200, headers: { 'Content-Type': a.tipo, 'Content-Length': String(a.datos.length) } });
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

  // Si el HTML llega cortado (una plataforma que lo recorta por tamaño, una descarga a
  // medias), las partes del final no están y el juego esperaría para siempre sin decir nada.
  var esperadas = null, llegadas = 0;
  ae.call(document, 'DOMContentLoaded', function () {
    if (esperadas !== null && llegadas >= esperadas) return;
    aviso('El archivo llegó cortado' + (esperadas ? ': llegaron ' + llegadas + ' de ' + esperadas + ' partes' : '') +
          '. No se guardó o no se descargó entero: hay que volver a subirlo o a bajarlo.');
  });

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
      try { b = deco(d.s, d.n); } catch (e) { self.postMessage({ ruta: d.ruta, error: String(e) }); return; }
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
    var a = A[d.ruta];
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
              fin: el.dataset.fin === '1', s: el.textContent };
    el.textContent = '';
    llegadas++;
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
    esperadas = 0;
    (tarde || []).forEach(function (t) {
      esperadas += t.partes;
      var a = anotar(t.ruta, { tipo: t.tipo, total: t.total, van: 0, oyentes: [], datos: null });
      a.listo = new Promise(function (ok, mal) { a.terminar = ok; a.fallar = mal; });
      a.listo.catch(function (e) { console.error(e); });
    });
    var bloques = document.querySelectorAll('script[type="porteo/archivo"]');
    return Promise.all(Array.prototype.map.call(bloques, function (el) {
      var ruta = el.dataset.ruta, t = el.dataset.tipo;
      return abrir(el).then(function (u) { anotar(ruta, { datos: u, tipo: t }); });
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

    # 2. lo de PWA no tiene sentido abierto desde el disco; el charset va primero (abajo),
    #    porque el navegador lo busca sólo en los primeros 1024 bytes
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

    # 4. el resto de los archivos, como bloques de datos; los --al-final, partidos y al final,
    #    en el orden en que se pidieron: llega primero lo que se va a usar primero (la música
    #    del primer nivel antes que la del último)
    al_final = [Path(x).as_posix() for x in a.al_final]
    tarde, partes, crudo, demorados = [], [], 0, {}
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
        else:
            demorados[rel] = (p, datos, gz)
    for rel in al_final:
        if rel not in demorados:
            continue
        p, datos, gz = demorados[rel]
        tarde.append({"ruta": rel, "tipo": tipo(p), "total": p.stat().st_size, "partes": -(-len(datos) // PARTE)})
        for i in range(0, len(datos), PARTE):
            k = len(partes)
            partes.append(bloque("porteo/parte", datos[i:i + PARTE], gz, i=k, ruta=rel, total=p.stat().st_size,
                                 fin=1 if i + PARTE >= len(datos) else 0)
                          + f"<script>__porteoParte({k})</script>")
    faltan = set(al_final) - {t["ruta"] for t in tarde}
    if faltan:
        raise SystemExit(f"--al-final: no están en {d}: {', '.join(sorted(faltan))}")

    final = ("\n".join(bloques) + "\n<script>window.__porteoUnArchivo(" + json.dumps(tarde) + ").catch(function(e){"
             "__porteoAviso('No se pudo abrir el juego: ' + e);});</script>\n" + "\n".join(partes) + "\n")
    html = html.replace("<head>", '<head>\n<meta charset="utf-8">\n' + ARRANQUE, 1)
    html = html.replace("</body>", final + "</body>", 1)

    salida = a.salida or d.parent / f"{d.name}-en-un-archivo.html"
    salida.write_bytes(html.encode("utf-8"))
    tam = salida.stat().st_size
    print(f"{salida}: {tam:,} bytes ({tam / 1048576:.2f} MB) — {len(bloques)} bloques + {len(partes)} partes al final, "
          f"{crudo / 1048576:.2f} MB de archivos")


if __name__ == "__main__":
    main()

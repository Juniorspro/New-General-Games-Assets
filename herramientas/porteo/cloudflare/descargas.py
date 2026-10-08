#!/usr/bin/env python3
"""Una página de descargas dentro del sitio, detrás de la misma puerta con clave: archivos grandes
(el APK, el HTML único) partidos en pedazos de 20 MB, porque Cloudflare Pages no sirve archivos de
más de 25 MiB, y una página que los baja, los une en el teléfono, comprueba que salieron iguales
(SHA-256) y los guarda con su nombre. Así se bajan con un toque desde el teléfono, sin unir partes.

    python3 -I descargas.py SITIO ARCHIVO [ARCHIVO...] [--titulo "Bad Parenting 1"]

Deja en SITIO/descargas/ la página (index.html) y los pedazos (<nombre>.parteN). El service worker
del sitio no los guarda (sw.js deja pasar /descargas/): ya quedan en Descargas.
"""
import argparse
import hashlib
import html
import json
from pathlib import Path

PEDAZO = 20 * 1024 * 1024
TIPOS = {".apk": "application/vnd.android.package-archive", ".html": "text/html", ".zip": "application/zip"}
AYUDA = {
    ".apk": "Para Android. Al abrirlo, el teléfono pide permiso para instalar apps del navegador: "
            "aceptalo una vez. Se juega sin internet.",
    ".html": "El juego entero en un archivo, para la computadora: se abre con Chrome o Edge, sin internet.",
}

PAGINA = """<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Descargas · TITULO</title>
<style>
  :root { --fondo: #101216; --tarjeta: #1a1d23; --texto: #eceef1; --suave: #a3aab5; --acento: #e8578b; --borde: #2b3038; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px 16px 40px; background: var(--fondo); color: var(--texto); font: 16px/1.5 system-ui, sans-serif; }
  main { max-width: 560px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: var(--suave); margin: 0 0 20px; }
  .item { background: var(--tarjeta); border: 1px solid var(--borde); border-radius: 14px; padding: 16px; margin: 14px 0; }
  .nombre { font-weight: 600; word-break: break-all; }
  .peso { color: var(--suave); font-size: 14px; }
  .ayuda { color: var(--suave); font-size: 14px; margin: 8px 0 12px; }
  button { width: 100%; padding: 13px; border: 0; border-radius: 10px; background: var(--acento); color: #fff; font: 600 16px system-ui, sans-serif; cursor: pointer; }
  button:disabled { opacity: .6; cursor: default; }
  .barra { height: 6px; background: var(--borde); border-radius: 3px; overflow: hidden; margin-top: 12px; display: none; }
  .barra > div { height: 100%; width: 0; background: var(--acento); transition: width .2s; }
  .estado { font-size: 14px; color: var(--suave); margin-top: 8px; min-height: 1.5em; }
  a { color: var(--acento); }
</style>
</head>
<body>
<main>
  <h1>TITULO</h1>
  <p class="sub">Descargas privadas. <a href="../">Jugar en el navegador</a></p>
  <div id="lista"></div>
</main>
<script>
const ARCHIVOS = /*ARCHIVOS*/[];
const mb = (n) => (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
const lista = document.getElementById('lista');
for (const a of ARCHIVOS) {
  const el = document.createElement('div');
  el.className = 'item';
  el.innerHTML = '<div class="nombre"></div><div class="peso"></div><div class="ayuda"></div>' +
    '<button>Bajar</button><div class="barra"><div></div></div><div class="estado"></div>';
  el.querySelector('.nombre').textContent = a.nombre;
  el.querySelector('.peso').textContent = mb(a.bytes);
  el.querySelector('.ayuda').textContent = a.ayuda || '';
  const boton = el.querySelector('button'), barra = el.querySelector('.barra'), relleno = barra.firstChild, estado = el.querySelector('.estado');
  boton.onclick = async () => {
    boton.disabled = true; barra.style.display = 'block'; estado.textContent = 'Bajando…';
    try {
      const partes = [];
      let llevo = 0;
      for (let i = 0; i < a.partes; i++) {
        const r = await fetch(encodeURIComponent(a.nombre) + '.parte' + i, { cache: 'no-store' });
        if (!r.ok) throw new Error('la parte ' + (i + 1) + ' no llegó (' + r.status + ')');
        const lector = r.body.getReader();
        for (;;) {
          const { done, value } = await lector.read();
          if (done) break;
          partes.push(value);
          llevo += value.length;
          relleno.style.width = (llevo * 100 / a.bytes).toFixed(1) + '%';
          estado.textContent = 'Bajando… ' + mb(llevo) + ' de ' + mb(a.bytes);
        }
      }
      const blob = new Blob(partes, { type: a.tipo });
      if (blob.size !== a.bytes) throw new Error('llegaron ' + blob.size + ' bytes en vez de ' + a.bytes);
      estado.textContent = 'Comprobando…';
      if (crypto.subtle) {
        const h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())))
          .map((b) => b.toString(16).padStart(2, '0')).join('');
        if (h !== a.sha256) throw new Error('el archivo llegó dañado: probá de nuevo');
      }
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url; enlace.download = a.nombre;
      document.body.appendChild(enlace); enlace.click(); enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      estado.textContent = 'Listo: quedó en Descargas.';
      boton.textContent = 'Bajar otra vez';
    } catch (e) {
      estado.textContent = 'No se pudo: ' + e.message;
    }
    boton.disabled = false;
  };
  lista.appendChild(el);
}
</script>
</body>
</html>
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("sitio", help="la salida de empaquetar.py --sitio")
    ap.add_argument("archivos", nargs="+")
    ap.add_argument("--titulo", default="Descargas")
    a = ap.parse_args()
    destino = Path(a.sitio) / "descargas"
    destino.mkdir(parents=True, exist_ok=True)
    for f in destino.iterdir():   # lo de una vez anterior
        f.unlink()
    datos = []
    for ruta in map(Path, a.archivos):
        b = ruta.read_bytes()
        partes = (len(b) + PEDAZO - 1) // PEDAZO
        for i in range(partes):
            (destino / f"{ruta.name}.parte{i}").write_bytes(b[i * PEDAZO:(i + 1) * PEDAZO])
        datos.append({"nombre": ruta.name, "bytes": len(b), "partes": partes, "sha256": hashlib.sha256(b).hexdigest(),
                      "tipo": TIPOS.get(ruta.suffix.lower(), "application/octet-stream"), "ayuda": AYUDA.get(ruta.suffix.lower(), "")})
        print(f"descargas: {ruta.name}: {len(b) / 1e6:.1f} MB en {partes} partes")
    pagina = PAGINA.replace("TITULO", html.escape(a.titulo)).replace("/*ARCHIVOS*/[]", json.dumps(datos, ensure_ascii=False))
    (destino / "index.html").write_text(pagina, encoding="utf-8")
    print(f"descargas: {destino / 'index.html'}")


if __name__ == "__main__":
    main()

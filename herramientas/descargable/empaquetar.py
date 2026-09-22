#!/usr/bin/env python3
"""Arma el HTML para descargar a partir de una página publicada como artifact.

    python3 herramientas/descargable/empaquetar.py termo/index.html salida.html

Hace falta porque la página de un artifact no es un HTML completo: la
plataforma la envuelve al publicar, así que el archivo fuente no trae
<!doctype>, ni <head>, ni `<meta charset>`. Abierto así desde el disco:

- sin `<meta charset="utf-8">` el navegador adivina la codificación, y los
  acentos y los "°C" pueden salir rotos;
- sin <!doctype> entra en modo quirks, y cambian las alturas y las cajas;
- sin el reset del envoltorio, el body trae 8 px de margen y `[hidden]` pierde
  contra cualquier `display` propio.

Además mete adentro los scripts de cdnjs y jsDelivr, para que el archivo ande
sin internet. Las fuentes de Google no se meten: pesan mucho y tienen
respaldo, así que sin conexión la página cambia de letra pero anda.

La descarga pasa por `curl`, no por urllib: acá sale por el proxy del agente y
curl ya confía en su certificado.
"""
import re
import subprocess
import sys

# Lo mismo que agrega el envoltorio de los artifacts, sin lo de las zonas
# seguras del teléfono, que fuera del visor no hace falta.
RESET = """<style>
  body { margin: 0; }
  img { max-width: 100%; }
  [hidden] { display: none !important; }
</style>"""

CDN = re.compile(
    r'<script\s+src="(https://(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)/[^"]+)"\s*>\s*</script>')

# Lo que va al <head>: el bloque de arriba de la página, antes del contenido.
CABEZA = re.compile(r'\s*(<title>.*?</title>|<meta\b[^>]*>|<link\b[^>]*>|<style\b[^>]*>.*?</style>)',
                    re.S | re.I)


def bajar(url):
    r = subprocess.run(["curl", "-sSfL", "--max-time", "90", url], capture_output=True)
    if r.returncode != 0:
        sys.exit(f"no se pudo bajar {url}: {r.stderr.decode().strip()}")
    return r.stdout.decode("utf-8")


def empaquetar(fuente):
    if re.match(r"\s*<!doctype", fuente, re.I):
        sys.exit("ya es un HTML completo: no hace falta empaquetarlo")

    cabeza, resto = [], fuente
    while (m := CABEZA.match(resto)):
        cabeza.append(m.group(1))
        resto = resto[m.end():]

    def meter(m):
        codigo = bajar(m.group(1))
        # Un "</script" adentro del código cerraría la etiqueta antes de tiempo.
        codigo = codigo.replace("</script", "<\\/script")
        return f"<script>/* {m.group(1)} */\n{codigo}\n</script>"

    resto, metidos = CDN.subn(meter, resto)
    html = ("<!doctype html>\n<html lang=\"es\">\n<head>\n"
            "<meta charset=\"utf-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
            + "\n".join(cabeza) + "\n" + RESET + "\n</head>\n<body>\n"
            + resto.strip() + "\n</body>\n</html>\n")
    return html, metidos


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    html, metidos = empaquetar(open(sys.argv[1], encoding="utf-8").read())
    open(sys.argv[2], "w", encoding="utf-8").write(html)
    print(f"{sys.argv[2]}: {len(html.encode()) / 1024:.0f} KB, {metidos} script(s) de CDN adentro")

import base64, json, os, re

J = "/home/user/General-Assets-Games/telarana/juego"
SALIDA = "/tmp/telarana-suelto.html"

html = open(J + "/index.html", encoding="utf8").read()
# fuera el import map y el módulo: acá va un script clásico, que es lo único
# que los navegadores dejan correr desde file://
html = re.sub(r'<script type="importmap">.*?</script>\s*', '', html, flags=re.S)
html = html.replace('<script type="module" src="./main.js"></script>', '__JUEGO__')

datos = json.load(open(J + "/ciudad.json"))
b64 = {k: base64.b64encode(open(J + "/" + f, "rb").read()).decode("ascii")
       for k, f in {"cielo":"cielo.hdr", "ciudad":"ciudad.glb",
                    "heroe":"heroe.glb", "orbe":"orbe.glb"}.items()}
paquete = open("/tmp/paquete/paquete.js", encoding="utf8").read()

bloque = ("<script>\n"
          "/* Todo el juego en un archivo: los datos primero, después three.js y\n"
          "   el juego ya empaquetados en un script clásico. Sin módulos, sin\n"
          "   fetch y sin CDN, así el .html anda hasta abriéndolo desde el disco. */\n"
          "window.__DATOS = " + json.dumps(datos, separators=(",", ":")) + ";\n"
          "window.__B64 = {\n"
          + ",\n".join('  %s: "%s"' % (k, v) for k, v in b64.items())
          + "\n};\n</script>\n<script>\n" + paquete + "\n</script>")

open(SALIDA, "w", encoding="utf8").write(html.replace("__JUEGO__", bloque))
print("%s  %.2f MB" % (SALIDA, os.path.getsize(SALIDA)/1024/1024))
t = open(SALIDA, encoding="utf8").read()
for m in ("__JUEGO__", "importmap", 'type="module"', "./vendor/", "cdn.jsdelivr"):
    assert m not in t, m
print("un solo archivo, sin módulos, sin CDN, sin fetch")

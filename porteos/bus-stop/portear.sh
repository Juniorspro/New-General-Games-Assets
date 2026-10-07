#!/usr/bin/env bash
# Bus Stop Simulator: del APK original al porteo completo, en un comando.
#
#   porteos/bus-stop/portear.sh RUTA/bus-stop-simulator.apk [CARPETA_DE_ENTREGA]
#
# Deja en CARPETA_DE_ENTREGA (default: ./entrega-bus-stop):
#   bus-stop/                     versión web (PWA: se instala y anda sin red)
#   bus-stop-simulator.html       todo en un solo archivo, se abre con doble clic
#   bus-stop-simulator.apk        APK nuevo (ar.juniors.busstop)
#   bus-stop-web.zip              la carpeta web comprimida, para subir a un hosting
#
# El juego NO está en el repo (es de terceros y el repo es público): esto lo
# rearma desde el APK que tiene el dueño. Lo único nuestro es porteo-web.html.
set -euo pipefail
APK=$(realpath "$1")
SALIDA=$(realpath -m "${2:-entrega-bus-stop}")
AQUI=$(cd "$(dirname "$0")" && pwd)
P="$AQUI/../../herramientas/porteo"

# El APK con el que se hizo y se probó este porteo:
ESPERADO=b64a463a849ab619dcea2f0d0fa344b4393874da99bdbe92aea2f6102e26f4a4
REAL=$(sha256sum "$APK" | cut -c1-64)
[[ "$REAL" == "$ESPERADO" ]] || echo "AVISO: este APK no es el que se probó ($REAL). Se sigue igual; revisar con prueba.mjs."

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
unzip -q "$APK" 'assets/*' 'res/mipmap-xxxhdpi-v4/icono.png' -d "$T"
W="$SALIDA/bus-stop"
rm -rf "$W"; mkdir -p "$W"
cp -r "$T/assets/." "$W/"

# Lo que hacía la parte Android, devuelto en el navegador (ver PORTEO.md §6).
python3 - "$W/index.html" "$AQUI/porteo-web.html" <<'EOF'
import sys
html, bloque = open(sys.argv[1], encoding="utf-8").read(), open(sys.argv[2], encoding="utf-8").read()
ancla = '<script src="juego.js"></script>'
assert ancla in html, "index.html cambió: no está " + ancla
if "porteo:web" not in html:
    html = html.replace(ancla, ancla + "\n" + bloque.rstrip("\n"), 1)
open(sys.argv[1], "w", encoding="utf-8").write(html)
EOF

python3 "$P/pwa.py" "$W" --nombre "Bus Stop Simulator" --corto "Bus Stop" \
    --orientacion landscape --icono "$T/res/mipmap-xxxhdpi-v4/icono.png" --color "#02040a"
python3 "$P/un-archivo.py" "$W" --salida "$SALIDA/bus-stop-simulator.html"
python3 "$P/apk/armar.py" "$W" --nombre "Bus Stop Simulator" --paquete ar.juniors.busstop \
    --orientacion horizontal --icono "$T/res/mipmap-xxxhdpi-v4/icono.png" --version 1.0.1 \
    --salida "$SALIDA/bus-stop-simulator.apk"
(cd "$SALIDA" && rm -f bus-stop-web.zip && zip -qr -9 bus-stop-web.zip bus-stop)
ls -l "$SALIDA"

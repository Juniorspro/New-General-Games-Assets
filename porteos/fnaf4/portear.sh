#!/usr/bin/env bash
# FNaF 4 (Android, com.scottgames.fnaf4 1.1): del APK al porteo completo, en un comando.
#
#   porteos/fnaf4/portear.sh RUTA/fnaf4.apk [CARPETA_DE_ENTREGA]
#
# Deja en CARPETA_DE_ENTREGA (default: ./entrega-fnaf4):
#   fnaf4/              versión web (PWA: se instala y anda sin red)
#   fnaf4.html          todo en un solo archivo, se abre con doble clic
#   fnaf4.apk           APK nuevo (ar.juniors.fnaf4)
#   fnaf4-web.zip       la carpeta web comprimida, para subir a un hosting
#
# El juego NO está en el repo (es de Scott Cawthon y el repo es público): esto
# lo rearma desde el APK del dueño. Lo nuestro es el extractor y el motor de
# herramientas/clickteam/ y porteo-web.html.
set -euo pipefail
APK=$(realpath "$1")
SALIDA=$(realpath -m "${2:-entrega-fnaf4}")
AQUI=$(cd "$(dirname "$0")" && pwd)
H="$AQUI/../../herramientas"

# El APK con el que se hizo y se probó este porteo:
ESPERADO=b3104e3ac3bbd65730dcbbd4412778979135c66354cf3eaec03d0f169545091e
REAL=$(sha256sum "$APK" | cut -c1-64)
[[ "$REAL" == "$ESPERADO" ]] || echo "AVISO: este APK no es el que se probó ($REAL). Se sigue igual; revisar con prueba.mjs."

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
unzip -q "$APK" 'res/raw/*' 'res/drawable-xxhdpi/launcher.png' -d "$T"

# 1. los datos originales: eventos, objetos, imágenes (WebP) y sonidos (Opus)
python3 -I "$H/clickteam/ccn.py" "$T/res/raw/application.ccn" "$T/extraido"
node "$H/clickteam/cobertura.mjs" "$T/extraido/datos/juego.json"

# 2. la carpeta web: motor + carcasa + datos
W="$SALIDA/fnaf4"
python3 "$H/clickteam/armar_web.py" "$T/extraido" "$W" --clave fnaf4 --titulo "Five Nights at Freddy's 4"

# 3. lo que hacía la parte Android (PORTEO.md §6)
cp "$H/porteo/web.js" "$W/porteo-web.js"
python3 - "$W/index.html" "$AQUI/porteo-web.html" <<'EOF'
import sys
html, bloque = open(sys.argv[1], encoding="utf-8").read(), open(sys.argv[2], encoding="utf-8").read()
ancla = '<script src="principal.js"></script>'
assert ancla in html, "la plantilla cambió: no está " + ancla
html = html.replace(ancla, ancla + "\n" + bloque.rstrip("\n"), 1)
open(sys.argv[1], "w", encoding="utf-8").write(html)
EOF

# 4. instalable y sin red, un solo archivo, APK, zip
ICONO="$T/res/drawable-xxhdpi/launcher.png"
python3 "$H/porteo/pwa.py" "$W" --nombre "Five Nights at Freddy's 4" --corto "FNaF 4" \
    --orientacion landscape --icono "$ICONO" --color "#000000"
python3 "$H/porteo/un-archivo.py" "$W" --salida "$SALIDA/fnaf4.html"
python3 "$H/porteo/apk/armar.py" "$W" --nombre "FNaF 4" --paquete ar.juniors.fnaf4 \
    --orientacion horizontal --icono "$ICONO" --version 1.1 --salida "$SALIDA/fnaf4.apk"
(cd "$SALIDA" && rm -f fnaf4-web.zip && zip -qr -9 fnaf4-web.zip fnaf4)
ls -l "$SALIDA"

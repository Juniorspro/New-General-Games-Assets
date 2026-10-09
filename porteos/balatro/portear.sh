#!/usr/bin/env bash
# porteo: Balatro (APK de Android) → versión web. Compila LÖVE para la web (motor/compilar.sh, si
# no está ya en TRABAJO/motor) y arma el sitio (empaquetar.py).
#
#   porteos/balatro/portear.sh balatro.apk RUTA/A/emsdk SALIDA [--registro __registro]
#
# Deja en SALIDA/sitio la versión para subir (herramientas/porteo/cloudflare/subir.py la sube
# privada), en SALIDA/Balatro.html el juego en un solo archivo y en SALIDA/motor el
# love.js/love.wasm compilados. Hace falta ffmpeg y optipng.
set -euo pipefail
APK=${1:?"uso: portear.sh balatro.apk RUTA/A/emsdk SALIDA [--registro __registro]"}
EMSDK=${2:?"falta la ruta a emsdk"}
SALIDA=${3:?"falta la carpeta de salida"}
shift 3
AQUI=$(cd "$(dirname "$0")" && pwd)
for p in ffmpeg optipng; do
  command -v "$p" >/dev/null || { echo "portear.sh: falta $p (apt install $p)" >&2; exit 1; }
done
mkdir -p "$SALIDA"
if [ ! -f "$SALIDA/motor/love.wasm" ]; then
  "$AQUI/motor/compilar.sh" "$EMSDK" "$SALIDA/motor" "$SALIDA/fuentes"
fi
python3 -I "$AQUI/empaquetar.py" "$APK" "$SALIDA/motor" "$SALIDA/sitio" "$@"
# el motor y el juego al final del .html: la intro aparece mientras el navegador lee el resto. En
# UTF-8 (--utf8): una plataforma que lo lee como texto (para meterle un script, guardarlo o pasarlo a
# srcdoc) rompía el de UTF-16
python3 -I "$AQUI/../../herramientas/porteo/un-archivo.py" "$SALIDA/sitio" --utf8 --salida "$SALIDA/Balatro.html" \
  --al-final "$(cd "$SALIDA/sitio" && ls b/*.wasm)" --al-final "$(cd "$SALIDA/sitio" && ls b/*.love)"

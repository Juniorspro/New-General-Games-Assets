#!/usr/bin/env bash
# porteo: Craftsman PTGI (APK de Android) → el juego en el navegador, en un solo .html.
#
#   porteos/craftsman/portear.sh Craftsman_PTGI.apk SALIDA
#
# Deja en SALIDA/sitio la versión en carpetas (index.html, juego.js, datos/) y en
# SALIDA/Craftsman-PTGI.html el juego entero en un solo archivo de texto ASCII (anda abierto desde el
# teléfono y adentro de Rezona). Hace falta Python 3 con Pillow y numpy, ffmpeg y opusenc.
set -euo pipefail
APK=${1:?"uso: portear.sh Craftsman_PTGI.apk SALIDA"}
SALIDA=${2:?"falta la carpeta de salida"}
AQUI=$(cd "$(dirname "$0")" && pwd)
for p in ffmpeg opusenc; do
  command -v "$p" >/dev/null || { echo "portear.sh: falta $p (apt install ffmpeg opus-tools)" >&2; exit 1; }
done
mkdir -p "$SALIDA/sitio"
python3 -I "$AQUI/empaquetar.py" "$APK" "$SALIDA/sitio"
python3 -I "$AQUI/armar.py" "$SALIDA/sitio"
python3 -I "$AQUI/../../herramientas/porteo/un-archivo.py" "$SALIDA/sitio" --texto --salida "$SALIDA/Craftsman-PTGI.html"

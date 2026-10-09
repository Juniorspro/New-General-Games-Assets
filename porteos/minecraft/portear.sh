#!/usr/bin/env bash
# porteo: Minecraft PE 1.2 (APK de Android) → el juego en el navegador, en un solo .html, con los
# shaders de Tito Crack 6000 (del APK de Craftsman PTGI) como opción al empezar.
#
#   porteos/minecraft/portear.sh Minecraft-1.2.apk Craftsman_PTGI.apk SALIDA
#
# Deja en SALIDA/sitio la versión en carpetas (index.html, juego.js, datos/) y en
# SALIDA/Minecraft-1.2.html el juego entero en un solo archivo de texto ASCII (anda abierto desde el
# teléfono y adentro de Rezona). Hace falta Python 3 con Pillow y numpy, ffmpeg y opusenc.
set -euo pipefail
APK=${1:?"uso: portear.sh Minecraft-1.2.apk Craftsman_PTGI.apk SALIDA"}
TITO=${2:?"falta el APK de Craftsman PTGI (los shaders de Tito)"}
SALIDA=${3:?"falta la carpeta de salida"}
AQUI=$(cd "$(dirname "$0")" && pwd)
for p in ffmpeg opusenc; do
  command -v "$p" >/dev/null || { echo "portear.sh: falta $p (apt install ffmpeg opus-tools)" >&2; exit 1; }
done
mkdir -p "$SALIDA/sitio"
python3 -I "$AQUI/empaquetar.py" "$APK" "$TITO" "$SALIDA/sitio"
python3 -I "$AQUI/armar.py" "$SALIDA/sitio"
python3 -I "$AQUI/../../herramientas/porteo/un-archivo.py" "$SALIDA/sitio" --texto --salida "$SALIDA/Minecraft-1.2.html"

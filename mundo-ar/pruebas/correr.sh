#!/bin/sh
# Prueba la página web en Chromium con una cámara falsa, parada y acostada.
# Baja a una caché FUERA del repo: three 0.186.1, AlvaAR (el mismo commit que
# pide la página) y su video de ejemplo, que se pasa a mjpeg con ffmpeg.
#
#   ./pruebas/correr.sh          (FFMPEG=/ruta/a/ffmpeg si no está en el PATH)
set -e
cd "$(dirname "$0")/.."
[ -e node_modules ] || ln -s /opt/node22/lib/node_modules node_modules
C=${CACHE_PRUEBAS:-$HOME/.cache/mundo-ar/pruebas}
FF=${FFMPEG:-ffmpeg}
ALVA=https://rawcdn.githack.com/alanross/AlvaAR/7796af500ee92001ac2a9888363ff64d7a3bee75/examples/public/assets
mkdir -p "$C"
for f in three.module.min.js three.core.min.js; do
  [ -f "$C/$f" ] || curl -sSfL -o "$C/$f" "https://cdn.jsdelivr.net/npm/three@0.186.1/build/$f"
done
[ -f "$C/alva_ar.js" ] || curl -sSfL -o "$C/alva_ar.js" "$ALVA/alva_ar.js"
if [ ! -f "$C/acostado.mjpeg" ]; then
  curl -sSfL -o "$C/video.mp4" "$ALVA/video.mp4"
  "$FF" -hide_banner -loglevel error -y -i "$C/video.mp4" -vf "scale=364:674,fps=30" -q:v 4 -f mjpeg "$C/parado.mjpeg"
  "$FF" -hide_banner -loglevel error -y -i "$C/video.mp4" -vf "transpose=2,scale=674:364,fps=30" -q:v 4 -f mjpeg "$C/acostado.mjpeg"
fi
echo "── parado (360×640) ──"
node pruebas/web.mjs "$C/parado.mjpeg" "$C/alva_ar.js" "$C" 360 640
echo
echo "── acostado (780×360) ──"
node pruebas/web.mjs "$C/acostado.mjpeg" "$C/alva_ar.js" "$C" 780 360

#!/bin/sh
# XRSLAM para Mundo AR. Nada del código de XRSLAM ni de sus dependencias vive
# en este repo: se baja fijado a un commit a una caché de afuera, se le aplican
# los parches de parches/ y se arma.
#
#   ./construir.sh nativo   → corredor y exportar (Linux, con OpenCV del sistema)
#   ./construir.sh web      → web/dist/xrslam.mjs + xrslam.wasm (pide emsdk activo)
#
# Caché: $CACHE_XRSLAM (por defecto ~/.cache/mundo-ar).
set -e
cd "$(dirname "$0")"
AQUI=$(pwd)
C=${CACHE_XRSLAM:-$HOME/.cache/mundo-ar}
XR_COMMIT=4beb1a942f33da9afbfae2d70e2c641cfc2bb675   # openxrlab/xrslam, 10-feb-2026
OPENCV_TAG=4.10.0
XR=$C/xrslam-src
mkdir -p "$C"

if [ ! -d "$XR/.git" ]; then
  echo "· bajando XRSLAM $XR_COMMIT…"
  git init -q "$XR"
  git -C "$XR" remote add origin https://github.com/openxrlab/xrslam
  git -C "$XR" fetch -q --depth 1 origin "$XR_COMMIT"
fi
# Siempre desde el commit limpio + los parches (así un parche nuevo se aplica
# sin arrastrar restos del anterior).
git -C "$XR" checkout -q -f "$XR_COMMIT"
git -C "$XR" clean -q -fd
for p in parches/*.patch; do git -C "$XR" apply "$AQUI/$p"; done
echo "· XRSLAM listo con $(ls parches/*.patch | wc -l) parches"

case "${1:-nativo}" in
nativo)
  cmake -S . -B "$C/xrslam-nativo" -DXRSLAM_SRC="$XR" >/dev/null
  cmake --build "$C/xrslam-nativo" -j"$(nproc)" --target corredor exportar
  echo "✓ $C/xrslam-nativo/corredor · $C/xrslam-nativo/exportar"
  ;;
web)
  command -v emcmake >/dev/null || { echo "✗ falta emsdk (source emsdk/emsdk_env.sh)"; exit 1; }
  OCV=$C/opencv-wasm
  if [ ! -f "$OCV/instalado/lib/libopencv_core.a" ]; then
    [ -d "$C/opencv-src" ] || git clone -q --depth 1 --branch "$OPENCV_TAG" https://github.com/opencv/opencv.git "$C/opencv-src"
    ./opencv-wasm.sh "$C/opencv-src" "$OCV"
  fi
  emcmake cmake -S . -B "$C/xrslam-web" -DXRSLAM_SRC="$XR" -DOPENCV_WASM="$OCV/instalado" \
    -DCMAKE_CXX_FLAGS="-msimd128" >/dev/null
  cmake --build "$C/xrslam-web" -j"$(nproc)" --target xrslam-web
  mkdir -p web/dist
  cp "$C/xrslam-web/xrslam.mjs" "$C/xrslam-web/xrslam.wasm" web/dist/
  echo "✓ web/dist/xrslam.mjs ($(du -k web/dist/xrslam.mjs | cut -f1) KB) + xrslam.wasm ($(du -k web/dist/xrslam.wasm | cut -f1) KB)"
  ;;
*) echo "uso: ./construir.sh [nativo|web]"; exit 1 ;;
esac

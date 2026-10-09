#!/usr/bin/env bash
# porteo: Balatro (APK de Android) → versión web. Compila LÖVE para la web (motor/compilar.sh, si
# no está ya en TRABAJO/motor) y arma el sitio (empaquetar.py).
#
#   porteos/balatro/portear.sh balatro.apk RUTA/A/emsdk SALIDA [--registro __registro]
#
# Deja en SALIDA/sitio la versión para subir (herramientas/porteo/cloudflare/subir.py la sube
# privada) y en SALIDA/motor el love.js/love.wasm compilados.
set -euo pipefail
APK=${1:?"uso: portear.sh balatro.apk RUTA/A/emsdk SALIDA [--registro __registro]"}
EMSDK=${2:?"falta la ruta a emsdk"}
SALIDA=${3:?"falta la carpeta de salida"}
shift 3
AQUI=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$SALIDA"
if [ ! -f "$SALIDA/motor/love.wasm" ]; then
  "$AQUI/motor/compilar.sh" "$EMSDK" "$SALIDA/motor" "$SALIDA/fuentes"
fi
python3 -I "$AQUI/empaquetar.py" "$APK" "$SALIDA/motor" "$SALIDA/sitio" "$@"

#!/bin/sh
# Todas las pruebas de Pique 3D.
set -e
cd "$(dirname "$0")/.."
[ -e node_modules ] || ln -s ../pique/node_modules node_modules
python3 -m http.server 8801 --bind 127.0.0.1 >/dev/null 2>&1 &
SERV=$!
trap 'kill $SERV 2>/dev/null' EXIT INT TERM
sleep 1
echo "── niveles: los 24, por los 3 colores, en el motor 3D ──────"
node pruebas/niveles3d.mjs
echo
echo "── celular: acostado y parado ─────────────────────────────"
node pruebas/movil3d.mjs
echo
echo "── el archivo unico, desde file:// ────────────────────────"
python3 empaquetar.py
node pruebas/un-archivo3d.mjs

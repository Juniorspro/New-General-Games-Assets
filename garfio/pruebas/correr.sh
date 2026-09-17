#!/bin/sh
set -e
cd "$(dirname "$0")/.."
[ -e node_modules ] || ln -s ../pique/node_modules node_modules
python3 -m http.server 8805 --bind 127.0.0.1 >/dev/null 2>&1 &
SERV=$!
trap 'kill $SERV 2>/dev/null' EXIT INT TERM
sleep 1
echo "── sintaxis de todos los módulos ─────────────────────────────"
node pruebas/sintaxis.mjs
echo
echo "── la torre: que se pueda subir, siempre ─────────────────────"
node pruebas/torre.mjs
echo
echo "── el teléfono: que el dedo llegue ───────────────────────────"
node pruebas/movil.mjs
echo
echo "── el archivo único, desde file:// ───────────────────────────"
python3 empaquetar.py
node pruebas/un-archivo.mjs
echo
echo "── los tres idiomas ──────────────────────────────────────────"
node pruebas/idiomas.mjs

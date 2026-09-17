#!/bin/sh
set -e
cd "$(dirname "$0")/.."
[ -e node_modules ] || ln -s ../pique/node_modules node_modules
python3 -m http.server 8804 --bind 127.0.0.1 >/dev/null 2>&1 &
SERV=$!
trap 'kill $SERV 2>/dev/null' EXIT INT TERM
sleep 1
echo "── sintaxis de todos los módulos ─────────────────────────────"
node pruebas/sintaxis.mjs
echo
echo "── el pozo: que se pueda bajar, siempre ──────────────────────"
node pruebas/pozo.mjs
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
echo
echo "── la música y los sonidos ───────────────────────────────────"
JUEGO=PARAGUAS ARCHIVO=paraguas-en-un-archivo.html JUGAR="#m-jugar" node pruebas/sonido.mjs

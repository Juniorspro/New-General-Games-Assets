#!/bin/sh
set -e
cd "$(dirname "$0")/.."
[ -e node_modules ] || ln -s ../pique/node_modules node_modules
python3 -m http.server 8803 --bind 127.0.0.1 >/dev/null 2>&1 &
SERV=$!
trap 'kill $SERV 2>/dev/null' EXIT INT TERM
sleep 1
echo "── sintaxis de todos los módulos ─────────────────────────────"
node pruebas/sintaxis.mjs
echo
echo "── la física: ragdoll, soga, ovillo y daño ───────────────────"
node pruebas/fisica.mjs
echo
echo "── las voces: que estén todas y duren lo que dura una frase ──"
node pruebas/voces.mjs
echo
echo "── el nivel: que se pueda terminar, jugado de verdad ─────────"
node pruebas/nivel.mjs
echo
echo "── portales: que los 15 niveles se puedan pasar ──────────────"
node pruebas/portales.mjs
echo
echo "── el teléfono: que entre y que el toque llegue ──────────────"
node pruebas/movil.mjs
echo
echo "── el archivo único, desde file:// ───────────────────────────"
python3 empaquetar.py
node pruebas/un-archivo.mjs

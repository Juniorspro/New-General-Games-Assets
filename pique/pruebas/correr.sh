#!/bin/sh
# Corre todas las pruebas. Levanta el servidor, prueba y lo baja.
#
# El servidor tiene que ser HTTP y no file://: el juego usa modulos de
# JavaScript, y un modulo cargado desde file:// lo bloquea CORS en todos los
# navegadores. Da un error que habla de origenes y parece un problema de red.
set -e
cd "$(dirname "$0")/.."
[ -d node_modules ] || npm install --no-audit --no-fund --silent playwright
python3 -m http.server 8799 --bind 127.0.0.1 >/dev/null 2>&1 &
SERV=$!
trap 'kill $SERV 2>/dev/null' EXIT INT TERM
sleep 1
echo "── niveles: los 24, por los 3 colores ──────────────────────"
node pruebas/niveles.mjs
echo
echo "── interfaz: que los botones se puedan tocar de verdad ─────"
node pruebas/interfaz.mjs
echo
echo "── el archivo unico, abierto desde file:// ─────────────────"
python3 empaquetar.py
node pruebas/un-archivo.mjs

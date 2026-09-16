#!/bin/sh
set -e
cd "$(dirname "$0")/.."
[ -e node_modules ] || ln -s ../pique/node_modules node_modules
python3 -m http.server 8802 --bind 127.0.0.1 >/dev/null 2>&1 &
SERV=$!
trap 'kill $SERV 2>/dev/null' EXIT INT TERM
sleep 1
echo "── las hojas de sprites ───────────────────────────────────"
python3 pruebas/assets.py
echo
echo "── sintaxis de todos los modulos ────────────────────────────"
node pruebas/sintaxis.mjs
echo
echo "── niveles: 24 x 3 colores, y que no quede una moneda fuera ──"
node pruebas/niveles.mjs
echo
echo "── el salto doble y el triple ────────────────────────────────"
node pruebas/salto.mjs
echo
echo "── hongos, tamanos y el gigante ──────────────────────────────"
node pruebas/hongos.mjs
echo
echo "── cuelgues: bucles sin fin, que no se atrapan con nada ──────"
node pruebas/cuelgues.mjs
echo
echo "── desbloqueo y recuperacion ante errores ────────────────"
node pruebas/progreso.mjs
echo
echo "── celular: acostado y parado ────────────────────────────────"
node pruebas/movil.mjs
echo
echo "── el archivo unico, desde file:// ───────────────────────────"
python3 empaquetar.py
node pruebas/un-archivo.mjs

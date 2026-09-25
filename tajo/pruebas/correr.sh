#!/bin/sh
# Todas las pruebas de Tajo. Se corren desde cualquier lado.
set -e
cd "$(dirname "$0")/.."
[ -e node_modules ] || ln -s /opt/node22/lib/node_modules node_modules
TMP=$(mktemp -d)
python3 -m http.server 8811 --bind 127.0.0.1 >/dev/null 2>&1 &
SERV=$!
trap 'kill $SERV 2>/dev/null; rm -rf "$TMP"' EXIT INT TERM
sleep 1
echo "── mapas: 3 canciones × 5 dificultades, validados (Node) ──"
node pruebas/mapas.mjs
echo
echo "── el bot juega los 15 mapas en tiempo simulado ──"
node pruebas/bot.mjs
echo
echo "── toques de verdad por CDP ──"
node pruebas/toques.mjs
echo
echo "── tu canción: pulso conocido, en Node y en el navegador ──"
node pruebas/pistas_prueba.mjs "$TMP"
node pruebas/tuya_node.mjs "$TMP/house128.wav" 128 0.5 "$TMP/hiphop92.wav" 92 0.5
node pruebas/tuya.mjs "$TMP/house128.wav" 128 0.5 | tail -1
echo
echo "── costo del cuadro en la placa ──"
node pruebas/costo.mjs
echo
echo "── el archivo único, desde file:// ──"
python3 empaquetar.py
node pruebas/un-archivo.mjs

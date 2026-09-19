#!/bin/sh
# Todas las comprobaciones. Necesitan Playwright (node_modules es un enlace a
# ../pique2d/node_modules) y levantan un servidor propio en el 8811: los modulos
# de JavaScript no se pueden cargar desde file:// por CORS.
cd "$(dirname "$0")/.." || exit 1
python3 -m http.server 8811 >/dev/null 2>&1 &
SRV=$!
sleep 2
mal=0
for p in terreno anima sonido; do
  echo "── $p"
  node "pruebas/$p.mjs" || mal=1
done
echo "── un-archivo"
python3 empaquetar.py >/dev/null && node pruebas/un-archivo.mjs "$PWD/campo-en-un-archivo.html" || mal=1
kill $SRV 2>/dev/null
exit $mal

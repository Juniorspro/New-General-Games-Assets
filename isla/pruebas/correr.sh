#!/bin/sh
# Todas las comprobaciones de la isla. Necesitan Playwright con Chromium y
# levantan un servidor propio en el 8812 sirviendo la raíz del repo: los
# módulos de JavaScript no se pueden cargar desde file:// (el navegador los
# bloquea). El archivo único, en cambio, se prueba justamente desde file://.
cd "$(dirname "$0")/.." || exit 1
python3 -m http.server 8812 --directory .. >/dev/null 2>&1 &
SRV=$!
sleep 2
mal=0
echo "── juego"
node pruebas/juego.mjs 8812 || mal=1
echo "── un archivo"
python3 empaquetar.py >/dev/null && node pruebas/un-archivo.mjs "$PWD/isla-en-un-archivo.html" || mal=1
kill $SRV 2>/dev/null
exit $mal

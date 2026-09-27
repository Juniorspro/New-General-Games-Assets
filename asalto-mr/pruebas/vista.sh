#!/bin/sh
# Vista previa en la PC: corre Figuras/Juego/Tsdf/Mallador de verdad (con un
# GLES20 de mentira que graba) y dibuja con los shaders de la app en Chromium.
#   ./pruebas/vista.sh   → salida/vista-juego.png, vista-escaneo.png, vista-sbs.png
set -e
cd "$(dirname "$0")/.."
OBRA=$(mktemp -d)
S=src/com/juniorspro/asaltomr
javac -nowarn -encoding UTF-8 -d "$OBRA" pruebas/vista/android/opengl/*.java pruebas/vista/android/util/Log.java \
  $S/Tsdf.java $S/Mallador.java $S/Mapa.java $S/Juego.java $S/Figuras.java $S/Gl.java pruebas/PruebaEscaneo.java \
  pruebas/vista/com/juniorspro/asaltomr/Vista.java 2>&1 | grep -v "^Picked up" || true
mkdir -p salida
java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -cp "$OBRA" com.juniorspro.asaltomr.Vista "$OBRA/datos.json" 2>&1 | grep -v "^Picked up"
node pruebas/vista.mjs "$OBRA/datos.json" salida
rm -rf "$OBRA"

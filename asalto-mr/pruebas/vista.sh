#!/bin/sh
# Vista previa en la PC: corre Figuras/Juego/Tsdf/Mallador de verdad (con un
# GLES20 de mentira que graba) y dibuja con los shaders de la app en Chromium.
#   ./pruebas/vista.sh   → salida/vista-juego.png, vista-escaneo.png, vista-sbs.png
set -e
cd "$(dirname "$0")/.."
OBRA=$(mktemp -d)
S=src/com/juniorspro/asaltomr
javac -nowarn -encoding UTF-8 -d "$OBRA" pruebas/vista/android/opengl/*.java pruebas/vista/android/util/Log.java \
  $S/Tsdf.java $S/Mallador.java $S/Mapa.java $S/Juego.java $S/Mano.java $S/FiltroMano.java $S/Figuras.java $S/Gl.java pruebas/PruebaEscaneo.java \
  pruebas/vista/com/juniorspro/asaltomr/Vista.java 2> "$OBRA/javac.txt" || { grep -v "^Picked up" "$OBRA/javac.txt"; echo "✗ no compila"; exit 1; }
mkdir -p salida
java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -cp "$OBRA" com.juniorspro.asaltomr.Vista "$OBRA/datos.json" 2>&1 | grep -v "^Picked up"
# las fotos de manos de prueba de MediaPipe (para dibujar la pistola en la mano)
mkdir -p "$OBRA/manos"
for f in pointing_up fist; do curl -sSL -o "$OBRA/manos/$f.jpg" "https://storage.googleapis.com/mediapipe-assets/$f.jpg" || true; done
node pruebas/vista.mjs "$OBRA/datos.json" salida "$OBRA/manos"
rm -rf "$OBRA"

#!/bin/sh
# Vista previa en la PC: los entornos y las ventanas con los shaders de la app (Chromium).
#   ./pruebas/vista.sh   → salida/vista-*.png
set -e
cd "$(dirname "$0")/.."
OBRA=$(mktemp -d)
S=src/com/juniorspro/nexoxr
javac -nowarn -encoding UTF-8 -d "$OBRA" pruebas/vista/android/opengl/*.java pruebas/vista/android/util/Log.java \
  $S/Gl.java $S/Entornos.java $S/VentanasGl.java $S/Ventana.java $S/Escritorio.java pruebas/vista/com/juniorspro/nexoxr/Fallo.java pruebas/vista/com/juniorspro/nexoxr/Vista.java 2> "$OBRA/javac.txt" \
  || { grep -v "^Picked up" "$OBRA/javac.txt"; echo "✗ no compila"; exit 1; }
mkdir -p salida
java -cp "$OBRA" com.juniorspro.nexoxr.Vista "$OBRA/datos.json" 2>&1 | grep -v "^Picked up"
node pruebas/vista.mjs "$OBRA/datos.json" salida
rm -rf "$OBRA"

#!/bin/sh
# Corre las pruebas de la PC (sin teléfono): el escaneo y el juego.
# Sólo compila las clases puras (sin Android): Tsdf, Mallador, Mapa, Juego, Mano.
set -e
cd "$(dirname "$0")/.."
OBRA=$(mktemp -d)
S=src/com/juniorspro/asaltomr
if ! javac -nowarn -encoding UTF-8 -d "$OBRA" $S/Tsdf.java $S/Mallador.java $S/Mapa.java $S/Juego.java $S/Mano.java $S/FiltroMano.java $S/AsociadorManos.java $S/Menu.java $S/Sellador.java $S/Control.java pruebas/Prueba*.java 2> "$OBRA/errores"; then
  grep -v "^Picked up" "$OBRA/errores"; echo "✗ no compila"; rm -rf "$OBRA"; exit 1
fi
r=0
for p in pruebas/Prueba*.java; do
  c=$(basename "$p" .java)
  echo "━━ $c ━━"
  java -Dstdout.encoding=UTF-8 -Dfile.encoding=UTF-8 -cp "$OBRA" "$c" > "$OBRA/salida" 2>&1 || r=1
  grep -v "^Picked up" "$OBRA/salida"
done
rm -rf "$OBRA"
exit $r

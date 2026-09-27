#!/bin/sh
# Corre las pruebas de la PC (sin teléfono): el escaneo y el juego.
# Sólo compila las clases puras (sin Android): Tsdf, Mallador, Juego.
set -e
cd "$(dirname "$0")/.."
OBRA=$(mktemp -d)
S=src/com/juniorspro/asaltomr
javac -nowarn -encoding UTF-8 -d "$OBRA" $S/Tsdf.java $S/Mallador.java $(ls $S/Juego.java 2>/dev/null) pruebas/Prueba*.java 2>&1 | grep -v "^Picked up" || true
r=0
for p in pruebas/Prueba*.java; do
  c=$(basename "$p" .java)
  echo "━━ $c ━━"
  java -Dstdout.encoding=UTF-8 -Dfile.encoding=UTF-8 -cp "$OBRA" "$c" 2>&1 | grep -v "^Picked up" || r=1
done
rm -rf "$OBRA"
exit $r

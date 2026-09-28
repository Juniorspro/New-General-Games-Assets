#!/bin/sh
# Corre las pruebas de la PC (sin teléfono): el escritorio, el puntero, las manos.
set -e
cd "$(dirname "$0")/.."
OBRA=$(mktemp -d)
S=src/com/juniorspro/nexoxr
if ! javac -nowarn -encoding UTF-8 -d "$OBRA" $S/Ventana.java $S/Escritorio.java $S/Puntero.java $S/Gestos.java $S/Mano.java $S/FiltroMano.java \
    $S/AsociadorManos.java $S/Control.java $S/Punteria.java $S/Seguimiento.java $S/Cuello.java pruebas/Prueba*.java 2> "$OBRA/errores"; then
  grep -v "^Picked up" "$OBRA/errores"; echo "✗ no compila"; rm -rf "$OBRA"; exit 1
fi
r=0
for p in pruebas/Prueba*.java; do
  c=$(basename "$p" .java)
  pk=$(sed -n 's/^package \(.*\);/\1./p' "$p")
  echo "━━ $c ━━"
  java -Dstdout.encoding=UTF-8 -Dfile.encoding=UTF-8 -cp "$OBRA" "$pk$c" > "$OBRA/salida" 2>&1 || r=1
  grep -v "^Picked up" "$OBRA/salida"
done
rm -rf "$OBRA"
exit $r

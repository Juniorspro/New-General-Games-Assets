#!/usr/bin/env bash
# Los 21 niveles con el bot. Cada nivel prueba estrategias de poda y anchos hasta que una lo
# termina: global, altura y mixta con 150; después las mismas con 700. De a 4 niveles a la vez.
#
#   GD_DATOS=entrega-gd/gd/datos porteos/gd/pruebas/todos.sh [CARPETA_RESULTADOS] [NIVELES...]
set -u
AQUI=$(cd "$(dirname "$0")" && pwd)
RES=$(realpath -m "${1:-/tmp/gd-bot}")
shift || true
NIVELES=${*:-$(seq 1 21)}
mkdir -p "$RES"
export AQUI RES
uno() {
  local n=$1 f
  for ancho in 150 700; do
    for e in global altura mixta; do
      f="$RES/$n-$e-$ancho.txt"
      ESTRATEGIA=$e ANCHO=$ancho LIMITE=2400 timeout 2500 node "$AQUI/bot.js" "$n" > "$f" 2>/dev/null
      if grep -q COMPLETO "$f"; then echo "$(head -1 "$f") [$e, $ancho]" > "$RES/$n.txt"; return; fi
    done
  done
  echo "$(head -1 "$RES/$n-mixta-700.txt") [ninguna estrategia lo terminó]" > "$RES/$n.txt"
}
export -f uno
printf '%s\n' $NIVELES | xargs -P 4 -I{} bash -c 'uno {}'
for n in $NIVELES; do cat "$RES/$n.txt"; done

#!/usr/bin/env bash
# Todas las pruebas de Ritmo, en orden de lo barato a lo caro.
# Las dos primeras no abren navegador: si la carta está rota, no tiene sentido
# gastar treinta segundos en abrir Chromium para confirmarlo.
set -u
cd "$(dirname "$0")/.."
python3 empaquetar.py || exit 1
fallas=0
for p in sintaxis cartas juez un-archivo reloj idiomas movil rendimiento; do
  echo ""
  echo "── $p ──────────────────────────────────────────────"
  node "pruebas/$p.mjs" || fallas=$((fallas + 1))
done
echo ""
if [ "$fallas" -eq 0 ]; then echo "  todo en verde"; else echo "  $fallas archivos con fallas"; fi
exit "$fallas"

#!/bin/sh
# Compila dxbc-glsl con HLSLcc (MIT, de Unity). La fuente de HLSLcc no va en el repo: se baja la
# versión probada a una carpeta de trabajo.
#
#   exportar/dxbc/compilar.sh [CARPETA_DE_TRABAJO]     → deja CARPETA/dxbc-glsl
#   HLSLCC=ruta/a/hlslcc exportar/dxbc/compilar.sh ...  (con una copia que ya está)
set -e
AQUI=$(cd "$(dirname "$0")" && pwd)
TRABAJO=${1:-${TMPDIR:-/tmp}/porteo-hlslcc}
VERSION=3ea1fcd6bd0ac445bc078de0bf32f0950188577b
mkdir -p "$TRABAJO"
H=${HLSLCC:-$TRABAJO/hlslcc}
if [ ! -d "$H/.git" ]; then
    git clone https://github.com/Unity-Technologies/HLSLcc "$H"
fi
git -C "$H" checkout -q "$VERSION" 2>/dev/null || {
    git -C "$H" fetch -q --depth 1 origin "$VERSION" && git -C "$H" checkout -q "$VERSION"
}
mkdir -p "$TRABAJO/obj"
for f in "$H"/src/*.cpp; do
    o="$TRABAJO/obj/$(basename "$f" .cpp).o"
    [ "$o" -nt "$f" ] || g++ -std=c++11 -O2 -w -c "$f" -o "$o" -I"$H/include" -I"$H/src" -I"$H/src/internal_includes" -I"$H/src/cbstring" -I"$H"
done
for f in "$H"/src/cbstring/*.c; do
    o="$TRABAJO/obj/$(basename "$f" .c).o"
    [ "$o" -nt "$f" ] || gcc -O2 -w -c "$f" -o "$o" -I"$H/src/cbstring"
done
g++ -std=c++11 -O2 "$AQUI/dxbc-glsl.cpp" "$TRABAJO"/obj/*.o -o "$TRABAJO/dxbc-glsl" -I"$H/include"
echo "$TRABAJO/dxbc-glsl"

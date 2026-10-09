#!/usr/bin/env bash
# porteo: LÖVE para la web, como lo usa la versión web de Balatro. Baja las fuentes de love.js
# (Davidobot: megasource y love, ramas emscripten, en los commits de abajo), les aplica parchar.py y
# compila con Emscripten (probado con 6.0.11) sin hilos, WebGL 2 y excepciones nativas de
# WebAssembly. Deja love.js y love.wasm en SALIDA.
#
#   porteos/balatro/motor/compilar.sh RUTA/A/emsdk SALIDA [TRABAJO]
#
# Hace falta cmake y git. Tarda ~15 min con 4 núcleos la primera vez (SDL2 y las librerías).
set -euo pipefail
EMSDK=${1:?"uso: compilar.sh RUTA/A/emsdk SALIDA [TRABAJO]"}
SALIDA=${2:?"falta la carpeta de salida"}
TRABAJO=${3:-$(mktemp -d /tmp/love-web.XXXXXX)}
AQUI=$(cd "$(dirname "$0")" && pwd)

MEGASOURCE=3bc0b46670a2912c02c54c6977b9510e64e89023   # Davidobot/megasource, rama emscripten
LOVE=32e0716b43a51686f5fa9ac04ca08b6410b698a5         # Davidobot/love, rama emscripten (11.4)

traer() {   # repo commit carpeta
  if [ ! -d "$3/.git" ]; then
    git init -q "$3"
    git -C "$3" remote add origin "$1"
  fi
  git -C "$3" fetch -q --depth 1 origin "$2"
  git -C "$3" checkout -q --force FETCH_HEAD
  git -C "$3" clean -qfdx
}

mkdir -p "$TRABAJO" "$SALIDA"
echo "compilar: fuentes en $TRABAJO"
traer https://github.com/Davidobot/megasource.git "$MEGASOURCE" "$TRABAJO/megasource"
traer https://github.com/Davidobot/love.git "$LOVE" "$TRABAJO/megasource/libs/love"
python3 -I "$AQUI/parchar.py" "$TRABAJO/megasource"

# shellcheck disable=SC1091
source "$EMSDK/emsdk_env.sh" > /dev/null
BANDERAS="-O3 -fwasm-exceptions -sSUPPORT_LONGJMP=wasm"
mkdir -p "$TRABAJO/compilado"
cd "$TRABAJO/compilado"
# sin mpg123 (Balatro es todo OGG; además se armaba como librería dinámica) ni PNG/BZip2/HarfBuzz en
# FreeType (el PNG del sistema de Emscripten no está compilado con el longjmp de WebAssembly)
emcmake cmake ../megasource -DLOVE_JIT=0 -DCMAKE_BUILD_TYPE=Release -DLOVEJS_COMPAT=1 -DLOVE_MPG123=OFF \
  -DCMAKE_DISABLE_FIND_PACKAGE_PNG=ON -DCMAKE_DISABLE_FIND_PACKAGE_BZip2=ON -DCMAKE_DISABLE_FIND_PACKAGE_HarfBuzz=ON \
  -DCMAKE_C_FLAGS="$BANDERAS" -DCMAKE_CXX_FLAGS="$BANDERAS" > cmake.log
emmake make -j"$(nproc)" love > make.log
cp love/love.js love/love.wasm "$SALIDA/"
ls -la "$SALIDA/love.js" "$SALIDA/love.wasm"

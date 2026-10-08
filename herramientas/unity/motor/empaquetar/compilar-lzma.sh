#!/bin/bash
# Compila lzma.c a un WebAssembly sin importaciones (lzma.wasm), con el clang de emscripten que
# trae el workload de .NET (o el que diga CLANG). Sin biblioteca de C: memoria propia exportada.
set -e
cd "$(dirname "$0")"
CLANG=${CLANG:-$(ls -d ${DOTNET_ROOT:-/tmp/claude-0/slime/dotnet}/packs/Microsoft.NET.Runtime.Emscripten.*.Sdk.*/*/tools/bin 2>/dev/null | head -1)/clang}
"$CLANG" --target=wasm32 -O3 -nostdlib -mbulk-memory -fno-builtin \
  -Wl,--no-entry -Wl,--export=lzma_decodificar -Wl,--export=lzma_tam_probabilidades -Wl,--export=__heap_base \
  -Wl,--strip-all -Wl,-z,stack-size=65536 -o lzma.wasm lzma.c
ls -la lzma.wasm

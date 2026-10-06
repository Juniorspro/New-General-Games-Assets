#!/bin/bash
# CUE4Parse por línea de comandos (herr/ue, compilado en herr/ue/bin): herr/ue.sh <comando> <salida> <rutas…>
# paks/ es un enlace a la carpeta Paks del juego (la ruta original tiene espacios).
T=$(cd "$(dirname "$0")/.." && pwd)
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 PATH=${DOTNET_DIR:-$T/../dotnet}:$PATH
exec dotnet "$T/herr/ue/bin/ue.dll" "$T/paks/" "$@"

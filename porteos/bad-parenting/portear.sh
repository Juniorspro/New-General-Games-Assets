#!/usr/bin/env bash
# Bad Parenting 1: Mr. Red Face (itch.io, Unity 2022.2 para Windows) → el juego en el navegador
# con el motor propio (herramientas/unity/motor): sitio para subir (PWA), HTML único y APK.
#
#   porteos/bad-parenting/portear.sh "Bad Parenting 1.zip" [CARPETA_DE_ENTREGA]
#
# Pasos (detalle en LEEME.md):
#   1. el zip del juego, en su carpeta (no se ejecuta nada de él);
#   2. HLSLcc (el traductor de Unity de DXBC a GLSL) compilado: los shaders del juego son de
#      Direct3D 11 y pasan a GLSL ES 3.00 (exportar/dxbc);
#   3. exportar.py: escenas y objetos a paquetes, texturas de PC a ETC2, sonido a Ogg, videos a WebM;
#   4. reparar: el IL del juego para .NET 10 (sin UI Toolkit ni Steam);
#   5. Web con el perfil bad-parenting (el esqueleto de la API de Unity 2022 que usa el juego),
#      compilado a WebAssembly con AOT y PhysX;
#   6. empaquetar: el sitio, el HTML único y el APK.
#
# Lo pesado va a $BP_TRABAJO (default ~/.porteo/bad-parenting). El juego es de 2OO2: nada de él
# entra al repo (§11 de PORTEO.md).
set -euo pipefail
ZIP=$(realpath "${1:?uso: portear.sh JUEGO.zip [SALIDA]}")
SALIDA=$(realpath -m "${2:-entrega-bad-parenting}")
AQUI=$(cd "$(dirname "$0")" && pwd)
M="$AQUI/../../herramientas/unity/motor"
TRABAJO=${BP_TRABAJO:-$HOME/.porteo/bad-parenting}
mkdir -p "$TRABAJO" "$SALIDA"

# ── .NET 10 (con wasm-tools para WebAssembly) ───────────────────────────────
DOTNET_DIR=${DOTNET_DIR:-$TRABAJO/dotnet}
if [[ ! -x "$DOTNET_DIR/dotnet" ]]; then
  curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 10.0 --install-dir "$DOTNET_DIR" >/dev/null
  "$DOTNET_DIR/dotnet" workload install wasm-tools >/dev/null
fi
export DOTNET_ROOT="$DOTNET_DIR" PATH="$DOTNET_DIR:$PATH" DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1

# ── 1. el juego ──────────────────────────────────────────────────────────────
X="$TRABAJO/juego"
rm -rf "$X"; mkdir -p "$X"
unzip -q "$ZIP" -d "$X"
DATA=$(find "$X" -maxdepth 3 -type d -name "*_Data" | head -1)
[[ -d "$DATA/Managed" ]] || { echo "no encuentro la carpeta *_Data con Managed/ en el zip"; exit 1; }
echo "juego: $DATA"

# ── 2. HLSLcc ───────────────────────────────────────────────────────────────
DXBC="$TRABAJO/hlslcc/dxbc-glsl"
[[ -x "$DXBC" ]] || TRABAJO="$TRABAJO/hlslcc" bash "$M/exportar/dxbc/compilar.sh"

# ── 3. los datos ─────────────────────────────────────────────────────────────
# UnityPy y compañía en un entorno aparte (python -I: los datos del juego no ejecutan nada)
VENV="$TRABAJO/venv"
[[ -x "$VENV/bin/python3" ]] || { python3 -m venv "$VENV"; "$VENV/bin/pip" -q install UnityPy==1.25.4 lz4 etcpak texture2ddecoder Pillow; }
DATOS="$TRABAJO/datos"
rm -rf "$DATOS"
"$VENV/bin/python3" -I "$M/exportar/exportar.py" "$DATA" "$DATOS" --dxbc-glsl "$DXBC"
dotnet run -c Release --project "$M/exportar/fsb-ogg" -- "$DATOS/recursos"

# ── 4. el IL ─────────────────────────────────────────────────────────────────
ENS="Assembly-CSharp.dll UnityEngine.UI.dll Unity.TextMeshPro.dll RTLTMPro.dll Unity.Timeline.dll Unity.Postprocessing.Runtime.dll com.rlabrecque.steamworks.net.dll"
REP="$TRABAJO/reparado"
rm -rf "$REP"
# shellcheck disable=SC2086
dotnet run -c Release --project "$M/reparar" -- "$DATA/Managed" "$DATA/Managed" "$REP" $ENS

# ── 5. la web (AOT) ──────────────────────────────────────────────────────────
FISICA="$TRABAJO/physx/libporteo_fisica.a"
[[ -f "$FISICA" ]] || python3 -I "$M/fisica/compilar-physx.py" "$TRABAJO/physx"
WEB="$TRABAJO/web"
rm -rf "$M/Web/bin" "$M/Web/obj" "$WEB"
dotnet publish "$M/Web" -c Release -p:PERFIL=bad-parenting -p:JUEGO="$REP" -p:FISICA="$FISICA" -o "$WEB"

# ── 6. el paquete ────────────────────────────────────────────────────────────
# La imagen de la pantalla de carga y el ícono salen de una captura del menú (carga.py)
python3 -I "$AQUI/carga.py" "$DATOS" "$TRABAJO/carga" || true
OPC=(--titulo "Bad Parenting 1" --carga "$AQUI/carga.json" --registro __registro)
[[ -f "$TRABAJO/carga/poster-256.webp" ]] && OPC+=(--imagen-carga "$TRABAJO/carga/poster-256.webp" --fondo-carga "$TRABAJO/carga/menu.png")
[[ -f "$AQUI/orden.json" ]] && OPC+=(--orden "$AQUI/orden.json")
python3 -I "$M/empaquetar/empaquetar.py" "$WEB/wwwroot" "$DATOS" "$SALIDA/sitio" --sitio --bloque 8 \
  ${TRABAJO:+--cache "$TRABAJO/cache-lzma"} ${OPC[@]+"${OPC[@]}"} \
  $([[ -f "$TRABAJO/carga/icono.png" ]] && echo --icono "$TRABAJO/carga/icono.png")
python3 -I "$M/empaquetar/empaquetar.py" "$WEB/wwwroot" "$DATOS" "$SALIDA/bad-parenting-1.html" \
  ${TRABAJO:+--cache "$TRABAJO/cache-lzma"} ${OPC[@]+"${OPC[@]}"}
echo "listo: $SALIDA"

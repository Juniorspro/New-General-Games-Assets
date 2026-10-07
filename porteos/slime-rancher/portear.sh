#!/usr/bin/env bash
# Slime Rancher (el APK no oficial "v1.2": Unity 2018.4.36f1 con Mono) → proyecto de Unity listo
# para WebGL y, si hay licencia de Unity, el juego compilado para el navegador.
#
#   porteos/slime-rancher/portear.sh "Slime Rancher v1.2.apk" [CARPETA_DE_ENTREGA]
#
# Deja en CARPETA_DE_ENTREGA (default ./entrega-slime):
#   proyecto/ExportedProject/  el proyecto de Unity, arreglado y verificado (compila sin errores).
#                Se abre con Unity 2018.4.36f1 (esa versión exacta) y se compila desde el menú
#                Porteo → Compilar WebGL.
#   web/         sólo si está UNITY_LICENSE (el contenido de un Unity_lic.ulf activado): el juego
#                compilado, para servir por http.
#
# Qué hace (detalle en LEEME.md):
#   1. saca del APK los datos (no se ejecuta nada de él);
#   2. AssetRipper (fijado) los exporta como proyecto de Unity, con los shaders en YAML: así
#      conservan sus programas GLES2/GLES3, que son los mismos que usa WebGL;
#   3. arreglar.py corrige lo que dejó roto el decompilador, saca los hilos y lo de Android, vuelve
#      a conectar teclado y mouse, y agrega lo nuestro (unity/);
#   4. compila los scripts contra las DLL de Unity 2018.4.36f1 (como WebGL y como el editor);
#   5. con licencia, compila para WebGL con Unity en modo consola.
#
# Lo pesado va a $SLIME_TRABAJO (default ~/.porteo/slime): .NET 10, AssetRipper y el editor de
# Unity (~3 GB). El juego es de Monomi Park: nada de él entra al repo (§11 de PORTEO.md).
set -euo pipefail
APK=$(realpath "${1:?uso: portear.sh JUEGO.apk [SALIDA]}")
SALIDA=$(realpath -m "${2:-entrega-slime}")
AQUI=$(cd "$(dirname "$0")" && pwd)
H="$AQUI/../../herramientas"
TRABAJO=${SLIME_TRABAJO:-$HOME/.porteo/slime}
ASSETRIPPER_GIT=https://github.com/AssetRipper/AssetRipper.git
ASSETRIPPER_COMMIT=813fed1597bac674def7256ce633a227e7b27497   # 2026-09-15, el probado
UNITY_VERSION=2018.4.36f1
UNITY_CAMBIO=6cd387d23174
UNITY_CDN="https://download.unity3d.com/download_unity/$UNITY_CAMBIO"
mkdir -p "$TRABAJO" "$SALIDA"

# ── 1. el APK ────────────────────────────────────────────────────────────────
# El que se analizó (MediaFire, espacioapk). Lo bajado es de terceros: se abre en su propia
# carpeta y no se ejecuta nada de él.
ESPERADO=bc7eab70551a2f23775bea6316b165138b66abe588b2129f79b85c88853757e0
[[ "$(sha256sum "$APK" | cut -c1-64)" != "$ESPERADO" ]] && \
  echo "AVISO: este APK no es el que se probó. Se sigue igual; arreglar.py avisa si algo no coincide."
D="$TRABAJO/apk"
rm -rf "$D"; mkdir -p "$D"
unzip -q "$APK" 'assets/*' 'lib/*' -d "$D"
echo "APK: $(find "$D/assets/bin/Data" -type f | wc -l) archivos de datos"

# ── 2. .NET 10 y AssetRipper ─────────────────────────────────────────────────
DOTNET="$TRABAJO/dotnet/dotnet"
if [[ ! -x "$DOTNET" ]]; then
  curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 10.0 --install-dir "$TRABAJO/dotnet" >/dev/null
fi
export DOTNET_ROOT="$TRABAJO/dotnet" DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1
AR="$TRABAJO/AssetRipper"
# Sólo ese commit, sin el historial (GitHub deja pedir un commit por su hash).
if ! git -C "$AR" rev-parse -q --verify "$ASSETRIPPER_COMMIT^{commit}" >/dev/null 2>&1; then
  rm -rf "$AR"; mkdir -p "$AR"; git -C "$AR" init -q
  git -C "$AR" remote add origin "$ASSETRIPPER_GIT"
  git -C "$AR" fetch -q --depth 1 origin "$ASSETRIPPER_COMMIT"
fi
git -C "$AR" checkout -q -f "$ASSETRIPPER_COMMIT"
"$DOTNET" build "$H/unity/ripear/Ripear.csproj" -c Release -p:ASSETRIPPER="$AR" -o "$TRABAJO/ripear" \
  > "$TRABAJO/ripear-compilar.log" 2>&1 || { tail -20 "$TRABAJO/ripear-compilar.log"; exit 1; }

# ── 3. el proyecto de Unity ──────────────────────────────────────────────────
"$DOTNET" "$TRABAJO/ripear/Ripear.dll" "$D" "$SALIDA/proyecto" yaml > "$TRABAJO/ripear.log" 2>&1 || \
  { tail -20 "$TRABAJO/ripear.log"; exit 1; }
P="$SALIDA/proyecto/ExportedProject"
echo "proyecto: $(find "$P/Assets/Scripts" -name '*.cs' | wc -l) scripts, $(du -sh "$P" | cut -f1)"
python3 -I "$AQUI/arreglar.py" "$P"

# ── 4. ¿compila? ─────────────────────────────────────────────────────────────
# Contra las DLL completas de Unity (las del APK vienen recortadas y dan errores falsos).
# Del editor (869 MB) alcanzan las DLL; entero se saca sólo para compilar (paso 5).
U="$TRABAJO/Unity-$UNITY_VERSION"
EDITOR="$TRABAJO/Unity-$UNITY_VERSION.tar.xz"
if [[ ! -f "$U/Editor/Data/Managed/UnityEditor.dll" ]]; then
  [[ -f "$EDITOR" ]] || curl -sSL -o "$EDITOR" "$UNITY_CDN/LinuxEditorInstaller/Unity.tar.xz"
  mkdir -p "$U"
  tar -xJf "$EDITOR" -C "$U" --wildcards 'Editor/Data/Managed/*' \
    'Editor/Data/MonoBleedingEdge/lib/mono/4.7.1-api/*' 'Editor/Data/UnityExtensions/Unity/GUISystem/*'
fi
V="$H/unity/verificar"
for extra in "" UNITY_EDITOR; do
  "$DOTNET" build "$V/juego/Juego.csproj" -c Release -p:PROYECTO="$P" -p:UNITY="$U/Editor/Data" -p:EXTRA_DEFINES="$extra" \
    -clp:ErrorsOnly > "$TRABAJO/verificar.log" 2>&1 || { grep -m20 "error" "$TRABAJO/verificar.log"; exit 1; }
done
"$DOTNET" build "$V/editor/Editor.csproj" -c Release -p:PROYECTO="$P" -p:UNITY="$U/Editor/Data" \
  -clp:ErrorsOnly > "$TRABAJO/verificar.log" 2>&1 || { grep -m20 "error" "$TRABAJO/verificar.log"; exit 1; }
echo "scripts: compilan sin errores (WebGL y editor)"

# ── 5. con licencia: el juego para el navegador ──────────────────────────────
# Unity no compila sin una licencia activada. La Personal es gratis pero se activa con la
# cuenta del dueño (Unity Hub): UNITY_LICENSE es el contenido de ese Unity_lic.ulf, como
# secreto del entorno. Sin ella, el proyecto se compila en la PC con Unity 2018.4.36f1.
if [[ -z "${UNITY_LICENSE:-}" ]]; then
  echo "Sin UNITY_LICENSE: abrir $P con Unity $UNITY_VERSION y Porteo → Compilar WebGL."
  exit 0
fi
[[ -x "$U/Editor/Unity" ]] || tar -xJf "$EDITOR" -C "$U"
if [[ ! -d "$U/Editor/Data/PlaybackEngines/WebGLSupport" ]]; then
  curl -sSL "$UNITY_CDN/LinuxEditorTargetInstaller/UnitySetup-WebGL-Support-for-Editor-$UNITY_VERSION.tar.xz" | tar -xJ -C "$U"
fi
LIC="$HOME/.local/share/unity3d/Unity"
mkdir -p "$LIC"
printf '%s' "$UNITY_LICENSE" > "$LIC/Unity_lic.ulf"
rm -rf "$SALIDA/web"
"$U/Editor/Unity" -batchmode -nographics -quit -projectPath "$P" -buildTarget WebGL \
  -executeMethod PorteoCompilar.WebGL -porteoSalida "$SALIDA/web" -logFile "$TRABAJO/unity.log" || \
  { grep -E "error|Error|porteo:" "$TRABAJO/unity.log" | tail -40; exit 1; }
grep "porteo:" "$TRABAJO/unity.log" || true
du -sh "$SALIDA/web"

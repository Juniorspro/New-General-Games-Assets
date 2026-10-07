#!/usr/bin/env bash
# Instala lo MÍNIMO de Android para armar APKs: build-tools 35 y la plataforma 35.
# ≈130 MB bajados, ≈300 MB en disco. No Android Studio, no Gradle, no emulador:
# armar.py sólo necesita aapt2, d8, zipalign, apksigner y android.jar.
# El contenedor se borra al cerrar la sesión: esto se corre una vez por sesión.
set -euo pipefail
SDK="${ANDROID_HOME:-/opt/android-sdk}"
BT="$SDK/build-tools/35.0.0"
PF="$SDK/platforms/android-35"
if [[ -x "$BT/aapt2" && -f "$PF/android.jar" ]]; then echo "SDK mínimo ya está en $SDK"; exit 0; fi
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
U=https://dl.google.com/android/repository
mkdir -p "$SDK/build-tools" "$SDK/platforms"
curl -fsSL "$U/build-tools_r35_linux.zip" -o "$T/bt.zip"
curl -fsSL "$U/platform-35_r02.zip" -o "$T/pf.zip"
unzip -q "$T/bt.zip" -d "$T/bt"; unzip -q "$T/pf.zip" -d "$T/pf"
rm -rf "$BT" "$PF"
mv "$T/bt/"* "$BT"     # el zip trae una carpeta "android-15": se renombra
mv "$T/pf/"* "$PF"
"$BT/aapt2" version
echo "SDK mínimo listo en $SDK"

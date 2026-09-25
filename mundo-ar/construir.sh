#!/bin/sh
# Arma Mundo AR (APK) sin Android Studio ni Gradle: sólo las piezas que hacen
# falta (~130 MB, no los 2-3 GB del SDK entero), bajadas una vez a una caché
# FUERA del repo. El APK sale en salida/ y tampoco se commitea.
#
#   ./construir.sh            → salida/mundo-ar.apk
#
# Pide: Java 17+ (javac, keytool), curl, unzip, python3.
set -e
cd "$(dirname "$0")"
AQUI=$(pwd)
CACHE=${CACHE_ANDROID:-$HOME/.cache/mundo-ar}
BT=$CACHE/build-tools
PLAT=$CACHE/android-34/android.jar
ARCORE_V=1.56.0
ARCORE=$CACHE/arcore-$ARCORE_V
mkdir -p "$CACHE"

if [ ! -x "$BT/aapt2" ]; then
  echo "· bajando build-tools 34…"
  curl -sSL -o "$CACHE/bt.zip" https://dl.google.com/android/repository/build-tools_r34-linux.zip
  unzip -q -o "$CACHE/bt.zip" -d "$CACHE" && mv "$CACHE/android-14" "$BT" && rm "$CACHE/bt.zip"
fi
if [ ! -f "$PLAT" ]; then
  echo "· bajando la plataforma android-34…"
  curl -sSL -o "$CACHE/pl.zip" https://dl.google.com/android/repository/platform-34-ext7_r03.zip
  unzip -q -o "$CACHE/pl.zip" -d "$CACHE" && rm "$CACHE/pl.zip"
fi
if [ ! -f "$ARCORE/classes.jar" ]; then
  echo "· bajando ARCore $ARCORE_V…"
  mkdir -p "$ARCORE"
  curl -sSL -o "$ARCORE/core.aar" "https://dl.google.com/android/maven2/com/google/ar/core/$ARCORE_V/core-$ARCORE_V.aar"
  (cd "$ARCORE" && unzip -q -o core.aar)
fi
LLAVE=$CACHE/prueba.keystore
if [ ! -f "$LLAVE" ]; then
  # Una llave de prueba, sólo para poder instalar. Nunca al repo (.gitignore: *.keystore).
  keytool -genkeypair -keystore "$LLAVE" -storepass mundoar -keypass mundoar -alias prueba \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Mundo AR prueba" >/dev/null 2>&1
fi

OBRA=$AQUI/.obra
rm -rf "$OBRA" && mkdir -p "$OBRA/gen" "$OBRA/clases" "$OBRA/dex" salida

echo "· recursos (los de la app + los del aar de ARCore)…"
"$BT/aapt2" compile --dir res -o "$OBRA/res.zip"
"$BT/aapt2" compile --dir "$ARCORE/res" -o "$OBRA/res-arcore.zip"
# --extra-packages: ARCore busca SUS recursos en com.google.ar.core.R; sin
# esa clase la pantalla de "instalá ARCore" revienta al abrirse.
"$BT/aapt2" link -I "$PLAT" --manifest AndroidManifest.xml --java "$OBRA/gen" \
  --extra-packages com.google.ar.core --auto-add-overlay \
  -R "$OBRA/res-arcore.zip" -R "$OBRA/res.zip" -o "$OBRA/base.apk"

echo "· compilando Java…"
javac -nowarn -Xlint:-options -source 8 -target 8 -encoding UTF-8 -bootclasspath "$PLAT:$BT/core-lambda-stubs.jar" \
  -classpath "$ARCORE/classes.jar" -d "$OBRA/clases" \
  $(find src "$OBRA/gen" -name "*.java") 2>&1 | grep -v "^Picked up" || true
[ -f "$OBRA/clases/com/juniorspro/mundoar/Principal.class" ] || { echo "✗ no compiló"; exit 1; }

echo "· dex…"
"$BT/d8" --release --min-api 24 --lib "$PLAT" --output "$OBRA/dex" \
  $(find "$OBRA/clases" -name "*.class") "$ARCORE/classes.jar" 2>&1 | grep -v -E "^Picked up|androidx/annotation|Type .* was not found|Warning in|Missing class" || true
[ -f "$OBRA/dex/classes.dex" ] || { echo "✗ no salió el dex"; exit 1; }

echo "· empaquetando…"
python3 - "$OBRA" "$ARCORE" <<'PY'
import sys, zipfile, shutil, os
obra, arcore = sys.argv[1], sys.argv[2]
salida = os.path.join(obra, "sin-alinear.apk")
shutil.copy(os.path.join(obra, "base.apk"), salida)
with zipfile.ZipFile(salida, "a") as z:
    z.write(os.path.join(obra, "dex", "classes.dex"), "classes.dex", compress_type=zipfile.ZIP_DEFLATED)
    for abi in os.listdir(os.path.join(arcore, "jni")):
        for so in os.listdir(os.path.join(arcore, "jni", abi)):
            z.write(os.path.join(arcore, "jni", abi, so), f"lib/{abi}/{so}", compress_type=zipfile.ZIP_DEFLATED)
PY
"$BT/zipalign" -f -p 4 "$OBRA/sin-alinear.apk" "$OBRA/alineado.apk"
"$BT/apksigner" sign --ks "$LLAVE" --ks-pass pass:mundoar --key-pass pass:mundoar \
  --out salida/mundo-ar.apk "$OBRA/alineado.apk" 2>&1 | grep -v "^Picked up" || true
# Ojo: verify no imprime nada si sale bien, y un `| grep` sin salida corta el
# script con set -e. Se mira el código de salida directo.
"$BT/apksigner" verify salida/mundo-ar.apk >/dev/null 2>&1 || { echo "✗ la firma no verifica"; exit 1; }
rm -rf "$OBRA"
echo "✓ salida/mundo-ar.apk ($(du -k salida/mundo-ar.apk | cut -f1) KB)"

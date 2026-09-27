#!/bin/sh
# Arma Mando 360 IR (APK) sin Android Studio ni Gradle: sólo las piezas que
# hacen falta, bajadas una vez a una caché FUERA del repo. El APK sale en
# salida/ y no se commitea.
#
#   ./construir.sh        → salida/mando-360.apk
#
# Pide: Java 17+ (javac, keytool), curl, unzip, python3. Comparte la caché de
# build-tools con mundo-ar (CACHE_ANDROID).
set -e
cd "$(dirname "$0")"
AQUI=$(pwd)
CACHE=${CACHE_ANDROID:-$HOME/.cache/mundo-ar}
BT=$CACHE/build-tools
PLAT=$CACHE/android-34/android.jar
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
LLAVE=$CACHE/prueba.keystore
if [ ! -f "$LLAVE" ]; then
  keytool -genkeypair -keystore "$LLAVE" -storepass mundoar -keypass mundoar -alias prueba \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Mando 360 prueba" >/dev/null 2>&1
fi

OBRA=$AQUI/.obra
rm -rf "$OBRA" && mkdir -p "$OBRA/gen" "$OBRA/clases" "$OBRA/dex" salida

echo "· recursos…"
"$BT/aapt2" compile --dir res -o "$OBRA/res.zip"
"$BT/aapt2" link -I "$PLAT" --manifest AndroidManifest.xml --java "$OBRA/gen" \
  -o "$OBRA/base.apk" "$OBRA/res.zip"

echo "· compilando Java…"
javac -nowarn -Xlint:-options -source 8 -target 8 -encoding UTF-8 \
  -bootclasspath "$PLAT:$BT/core-lambda-stubs.jar" -d "$OBRA/clases" \
  $(find src "$OBRA/gen" -name "*.java") 2>&1 | grep -v "^Picked up" || true
[ -f "$OBRA/clases/com/juniorspro/mando360/Principal.class" ] || { echo "✗ no compiló"; exit 1; }

echo "· dex…"
"$BT/d8" --release --min-api 21 --lib "$PLAT" --output "$OBRA/dex" \
  $(find "$OBRA/clases" -name "*.class") 2>&1 | grep -v "^Picked up" || true
[ -f "$OBRA/dex/classes.dex" ] || { echo "✗ no salió el dex"; exit 1; }

echo "· empaquetando…"
cp "$OBRA/base.apk" "$OBRA/sin-alinear.apk"
(cd "$OBRA/dex" && python3 -c "import zipfile; zipfile.ZipFile('../sin-alinear.apk','a').write('classes.dex','classes.dex',compress_type=zipfile.ZIP_DEFLATED)")
"$BT/zipalign" -f -p 4 "$OBRA/sin-alinear.apk" "$OBRA/alineado.apk"
"$BT/apksigner" sign --ks "$LLAVE" --ks-pass pass:mundoar --key-pass pass:mundoar \
  --out salida/mando-360.apk "$OBRA/alineado.apk" 2>&1 | grep -v "^Picked up" || true
"$BT/apksigner" verify salida/mando-360.apk >/dev/null 2>&1 || { echo "✗ la firma no verifica"; exit 1; }
rm -rf "$OBRA"
echo "✓ salida/mando-360.apk ($(du -k salida/mando-360.apk | cut -f1) KB)"

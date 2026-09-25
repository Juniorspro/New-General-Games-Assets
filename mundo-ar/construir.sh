#!/bin/sh
# Arma los APK de Mundo AR sin Android Studio ni Gradle: sólo las piezas que
# hacen falta (~130 MB, no los 2-3 GB del SDK entero), bajadas una vez a una
# caché FUERA del repo. Los APK salen en salida/ y tampoco se commitean.
#
#   ./construir.sh            → los dos
#   ./construir.sh nativo     → salida/mundo-ar.apk      (ARCore nativo, 6DoF del sistema)
#   ./construir.sh webview    → salida/mundo-ar-web.apk  (web/index.html en un WebView, 6DoF por SLAM)
#
# Pide: Java 17+ (javac, keytool), curl, unzip, python3.
set -e
cd "$(dirname "$0")"
AQUI=$(pwd)
QUE=${1:-todo}
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
if [ "$QUE" != webview ] && [ ! -f "$ARCORE/classes.jar" ]; then
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

limpiar_obra() { rm -rf "$OBRA" && mkdir -p "$OBRA/gen" "$OBRA/clases" "$OBRA/dex" "$OBRA/assets" salida; }

# compilar <carpeta src> <clase principal sin .class> [classpath]
compilar() {
  javac -nowarn -Xlint:-options -source 8 -target 8 -encoding UTF-8 -bootclasspath "$PLAT:$BT/core-lambda-stubs.jar" \
    -classpath "${3:-$PLAT}" -d "$OBRA/clases" \
    $(find "$1" "$OBRA/gen" -name "*.java") 2>&1 | grep -v "^Picked up" || true
  [ -f "$OBRA/clases/$2.class" ] || { echo "✗ no compiló"; exit 1; }
}

# empaquetar <salida.apk> [carpeta de ARCore]: base.apk + classes.dex (+ las .so de ARCore), alineado y firmado
empaquetar() {
  python3 -c '
import sys, zipfile, shutil, os
obra, arcore = sys.argv[1], sys.argv[2]
salida = os.path.join(obra, "sin-alinear.apk")
shutil.copy(os.path.join(obra, "base.apk"), salida)
with zipfile.ZipFile(salida, "a") as z:
    z.write(os.path.join(obra, "dex", "classes.dex"), "classes.dex", compress_type=zipfile.ZIP_DEFLATED)
    if arcore:
        for abi in os.listdir(os.path.join(arcore, "jni")):
            for so in os.listdir(os.path.join(arcore, "jni", abi)):
                z.write(os.path.join(arcore, "jni", abi, so), f"lib/{abi}/{so}", compress_type=zipfile.ZIP_DEFLATED)
' "$OBRA" "${2:-}"
  "$BT/zipalign" -f -p 4 "$OBRA/sin-alinear.apk" "$OBRA/alineado.apk"
  "$BT/apksigner" sign --ks "$LLAVE" --ks-pass pass:mundoar --key-pass pass:mundoar \
    --out "$1" "$OBRA/alineado.apk" 2>&1 | grep -v "^Picked up" || true
  # Ojo: verify no imprime nada si sale bien, y un `| grep` sin salida corta el
  # script con set -e. Se mira el código de salida directo.
  "$BT/apksigner" verify "$1" >/dev/null 2>&1 || { echo "✗ la firma de $1 no verifica"; exit 1; }
  echo "✓ $1 ($(du -k "$1" | cut -f1) KB)"
}

armar_nativo() {
  echo "━━ nativo (ARCore) ━━"
  limpiar_obra
  echo "· recursos (los de la app + los del aar de ARCore)…"
  "$BT/aapt2" compile --dir nativo/res -o "$OBRA/res.zip"
  "$BT/aapt2" compile --dir "$ARCORE/res" -o "$OBRA/res-arcore.zip"
  # --extra-packages: ARCore busca SUS recursos en com.google.ar.core.R; sin
  # esa clase la pantalla de "instalá ARCore" revienta al abrirse.
  "$BT/aapt2" link -I "$PLAT" --manifest nativo/AndroidManifest.xml --java "$OBRA/gen" \
    --extra-packages com.google.ar.core --auto-add-overlay \
    -R "$OBRA/res-arcore.zip" -R "$OBRA/res.zip" -o "$OBRA/base.apk"
  echo "· compilando Java…"
  compilar nativo/src com/juniorspro/mundoar/Principal "$ARCORE/classes.jar"
  echo "· dex…"
  "$BT/d8" --release --min-api 24 --lib "$PLAT" --output "$OBRA/dex" \
    $(find "$OBRA/clases" -name "*.class") "$ARCORE/classes.jar" 2>&1 | grep -v -E "^Picked up|androidx/annotation|Type .* was not found|Warning in|Missing class" || true
  [ -f "$OBRA/dex/classes.dex" ] || { echo "✗ no salió el dex"; exit 1; }
  echo "· empaquetando…"
  empaquetar salida/mundo-ar.apk "$ARCORE"
}

armar_webview() {
  echo "━━ webview ━━"
  limpiar_obra
  # La página va tal cual la que se hostea: una sola fuente, ninguna copia en el repo.
  cp web/index.html "$OBRA/assets/index.html"
  echo "· recursos y la página…"
  "$BT/aapt2" compile --dir webview/res -o "$OBRA/res.zip"
  "$BT/aapt2" compile nativo/res/drawable/icono.xml -o "$OBRA"
  "$BT/aapt2" link -I "$PLAT" --manifest webview/AndroidManifest.xml --java "$OBRA/gen" \
    -A "$OBRA/assets" -o "$OBRA/base.apk" "$OBRA/res.zip" "$OBRA/drawable_icono.xml.flat"
  echo "· compilando Java…"
  compilar webview/src com/juniorspro/mundoarweb/Principal
  echo "· dex…"
  "$BT/d8" --release --min-api 24 --lib "$PLAT" --output "$OBRA/dex" \
    $(find "$OBRA/clases" -name "*.class") 2>&1 | grep -v "^Picked up" || true
  [ -f "$OBRA/dex/classes.dex" ] || { echo "✗ no salió el dex"; exit 1; }
  echo "· empaquetando…"
  empaquetar salida/mundo-ar-web.apk
}

case "$QUE" in
  nativo) armar_nativo ;;
  webview) armar_webview ;;
  todo) armar_nativo; armar_webview ;;
  *) echo "uso: ./construir.sh [nativo|webview]"; exit 1 ;;
esac
rm -rf "$OBRA"

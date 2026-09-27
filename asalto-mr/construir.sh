#!/bin/sh
# Arma Asalto MR (APK) sin Android Studio ni Gradle: build-tools, android.jar
# y el aar de ARCore bajados una vez a una caché FUERA del repo (la misma que
# mundo-ar). El APK sale en salida/ y no se commitea.
#
#   ./construir.sh        → salida/asalto-mr.apk
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
# MediaPipe (hand tracking): las tareas de visión, su núcleo y sus dependencias, y el modelo de manos
MP=$CACHE/mediapipe
MP_V=1.0.0
mkdir -p "$MP"
bajar() { [ -s "$MP/$2" ] || { echo "· bajando $2…"; curl -sSL -o "$MP/$2" "$1"; }; }
bajar "https://dl.google.com/android/maven2/com/google/mediapipe/tasks-vision/$MP_V/tasks-vision-$MP_V.aar" tasks-vision.aar
bajar "https://dl.google.com/android/maven2/com/google/mediapipe/tasks-core/$MP_V/tasks-core-$MP_V.aar" tasks-core.aar
M2=https://repo1.maven.org/maven2
bajar "$M2/com/google/guava/guava/27.0.1-android/guava-27.0.1-android.jar" guava-27.0.1-android.jar
bajar "$M2/com/google/guava/failureaccess/1.0.1/failureaccess-1.0.1.jar" failureaccess-1.0.1.jar
bajar "$M2/com/google/protobuf/protobuf-javalite/4.26.1/protobuf-javalite-4.26.1.jar" protobuf-javalite-4.26.1.jar
bajar "$M2/com/google/flogger/flogger/0.6/flogger-0.6.jar" flogger-0.6.jar
bajar "$M2/com/google/flogger/flogger-system-backend/0.6/flogger-system-backend-0.6.jar" flogger-system-backend-0.6.jar
bajar "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task" hand_landmarker.task
for a in tasks-vision tasks-core; do [ -f "$MP/$a/classes.jar" ] || (mkdir -p "$MP/$a" && cd "$MP/$a" && unzip -q -o "../$a.aar"); done
# el núcleo sin la telemetría: se sacan las 3 clases que mandan estadísticas (usan "datatransport");
# mediapipe-parche/ trae una fábrica que da el logger vacío de la propia librería
if [ ! -f "$MP/tasks-core-sin-telemetria.jar" ]; then
  python3 - "$MP/tasks-core/classes.jar" "$MP/tasks-core-sin-telemetria.jar" <<'PY'
import sys, zipfile
fuera = {"com/google/mediapipe/tasks/core/logging/" + n + ".class" for n in ("TasksStatsLoggerFactory", "TasksStatsProtoLogger", "RemoteLoggingClient")}
with zipfile.ZipFile(sys.argv[1]) as a, zipfile.ZipFile(sys.argv[2], "w", zipfile.ZIP_DEFLATED) as b:
    for i in a.infolist():
        if i.filename not in fuera: b.writestr(i, a.read(i.filename))
PY
fi
MP_JARS="$MP/tasks-core-sin-telemetria.jar:$MP/tasks-vision/classes.jar"
MP_DEPS="$MP/guava-27.0.1-android.jar $MP/failureaccess-1.0.1.jar $MP/protobuf-javalite-4.26.1.jar $MP/flogger-0.6.jar $MP/flogger-system-backend-0.6.jar"

LLAVE=$CACHE/prueba.keystore
if [ ! -f "$LLAVE" ]; then
  # Una llave de prueba, sólo para poder instalar. Nunca al repo (.gitignore: *.keystore).
  keytool -genkeypair -keystore "$LLAVE" -storepass mundoar -keypass mundoar -alias prueba \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Asalto MR prueba" >/dev/null 2>&1
fi

OBRA=$AQUI/.obra
rm -rf "$OBRA" && mkdir -p "$OBRA/gen" "$OBRA/clases" "$OBRA/dex" salida

echo "· recursos (los de la app + los del aar de ARCore)…"
"$BT/aapt2" compile --dir res -o "$OBRA/res.zip"
"$BT/aapt2" compile --dir "$ARCORE/res" -o "$OBRA/res-arcore.zip"
# --extra-packages: ARCore busca SUS recursos en com.google.ar.core.R
"$BT/aapt2" link -I "$PLAT" --manifest AndroidManifest.xml --java "$OBRA/gen" \
  --extra-packages com.google.ar.core --auto-add-overlay \
  -R "$OBRA/res-arcore.zip" -R "$OBRA/res.zip" -o "$OBRA/base.apk"

echo "· compilando Java…"
# OJO: si javac falla, NO seguir. (Antes se miraba sólo si existía Principal.class: javac
# igual escribía las clases que sí compilaban, y salió un APK sin Hud que se cerraba al abrir.)
if ! javac -nowarn -Xlint:-options -source 8 -target 8 -encoding UTF-8 \
  -bootclasspath "$PLAT:$BT/core-lambda-stubs.jar" -classpath "$ARCORE/classes.jar:$MP_JARS" -d "$OBRA/clases" \
  $(find src mediapipe-parche "$OBRA/gen" -name "*.java") 2> "$OBRA/javac.txt"; then
  grep -v "^Picked up" "$OBRA/javac.txt"; echo "✗ no compiló"; exit 1
fi
# y cada .java tiene que haber dado su .class
for f in $(find src -name "*.java"); do
  c=$(echo "$f" | sed 's|^src/||; s|\.java$|.class|')
  [ -f "$OBRA/clases/$c" ] || { echo "✗ falta $c"; exit 1; }
done

echo "· dex…"
"$BT/d8" --release --min-api 24 --lib "$PLAT" --output "$OBRA/dex" \
  $(find "$OBRA/clases" -name "*.class") "$ARCORE/classes.jar" $(echo "$MP_JARS" | tr ':' ' ') $MP_DEPS > "$OBRA/d8.txt" 2>&1 || true
# clases que faltan = se cierra al usarlas. Se toleran sólo las de anotaciones (no existen en ejecución).
if grep -E "Missing class|was not found" "$OBRA/d8.txt" | grep -v -E "androidx[./]annotation|javax[./]annotation|org[./]checkerframework|com[./]google[./]errorprone[./]annotations|com[./]google[./]j2objc[./]annotations|org[./]codehaus[./]mojo[./]animal_sniffer|com[./]google[./]auto[./]value"; then
  echo "✗ d8: faltan clases"; exit 1
fi
[ -f "$OBRA/dex/classes.dex" ] || { echo "✗ no salió el dex"; exit 1; }

echo "· empaquetando…"
python3 -c '
import sys, zipfile, shutil, os
obra, arcore, mp = sys.argv[1], sys.argv[2], sys.argv[3]
salida = os.path.join(obra, "sin-alinear.apk")
shutil.copy(os.path.join(obra, "base.apk"), salida)
with zipfile.ZipFile(salida, "a") as z:
    for dex in sorted(os.listdir(os.path.join(obra, "dex"))):
        z.write(os.path.join(obra, "dex", dex), dex, compress_type=zipfile.ZIP_DEFLATED)
    for abi in os.listdir(os.path.join(arcore, "jni")):
        for so in os.listdir(os.path.join(arcore, "jni", abi)):
            z.write(os.path.join(arcore, "jni", abi, so), f"lib/{abi}/{so}", compress_type=zipfile.ZIP_DEFLATED)
    # MediaPipe: sólo ARM (los teléfonos); en x86 el hand tracking dice "no disponible" y el resto anda
    for abi in ("arm64-v8a", "armeabi-v7a"):
        so = os.path.join(mp, "tasks-core", "jni", abi, "libmediapipe_tasks_jni.so")
        z.write(so, f"lib/{abi}/libmediapipe_tasks_jni.so", compress_type=zipfile.ZIP_DEFLATED)
    # el modelo SIN comprimir: MediaPipe lo abre directo desde el APK
    z.write(os.path.join(mp, "hand_landmarker.task"), "assets/hand_landmarker.task", compress_type=zipfile.ZIP_STORED)
' "$OBRA" "$ARCORE" "$MP"
"$BT/zipalign" -f -p 4 "$OBRA/sin-alinear.apk" "$OBRA/alineado.apk"
"$BT/apksigner" sign --ks "$LLAVE" --ks-pass pass:mundoar --key-pass pass:mundoar \
  --out salida/asalto-mr.apk "$OBRA/alineado.apk" 2>&1 | grep -v "^Picked up" || true
"$BT/apksigner" verify salida/asalto-mr.apk >/dev/null 2>&1 || { echo "✗ la firma no verifica"; exit 1; }
rm -rf "$OBRA"
echo "✓ salida/asalto-mr.apk ($(du -k salida/asalto-mr.apk | cut -f1) KB)"

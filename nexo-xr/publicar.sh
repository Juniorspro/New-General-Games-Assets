#!/bin/sh
# Publica una versión nueva de Nexo XR para que el teléfono se actualice solo:
# sube el número de versión, arma el APK y deja en actualizacion/ el APK y el
# version.json que la app mira (después: commit y push de la rama).
#
#   ./publicar.sh "qué trae esta versión"
#
# Se niega si el APK sale firmado con otra llave que la versión publicada
# antes (el teléfono no la instalaría encima). FORZAR=1 para publicarla igual.
set -e
cd "$(dirname "$0")"
NOTAS=${1:?"uso: ./publicar.sh \"qué trae esta versión\""}
CACHE=${CACHE_ANDROID:-$HOME/.cache/mundo-ar}
BT=$CACHE/build-tools
PUB=actualizacion

ANTES=$(sed -n 's/.*android:versionCode="\([0-9]*\)".*/\1/p' AndroidManifest.xml)
CODIGO=$((ANTES + 1))
NOMBRE="1.$((CODIGO - 1))"
cp AndroidManifest.xml .manifiesto-antes
volver() { mv .manifiesto-antes AndroidManifest.xml; }
sed -i "s/android:versionCode=\"$ANTES\"/android:versionCode=\"$CODIGO\"/; s/android:versionName=\"[^\"]*\"/android:versionName=\"$NOMBRE\"/" AndroidManifest.xml
echo "· versión $NOMBRE ($CODIGO)"
./construir.sh || { volver; exit 1; }

FIRMA=$("$BT/apksigner" verify --print-certs salida/nexo-xr.apk 2>/dev/null | sed -n 's/.*certificate SHA-256 digest: *//p' | head -1)
[ -n "$FIRMA" ] || { volver; echo "✗ no se pudo leer la firma"; exit 1; }
if [ -f "$PUB/version.json" ]; then
  VIEJA=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("firma",""))' "$PUB/version.json")
  if [ -n "$VIEJA" ] && [ "$VIEJA" != "$FIRMA" ] && [ "$FORZAR" != "1" ]; then
    volver
    echo "✗ el APK salió firmado con OTRA llave que la versión publicada:"
    echo "    antes  $VIEJA"
    echo "    ahora  $FIRMA"
    echo "  El teléfono no la instalaría encima. Poné la llave de siempre en NEXO_LLAVE"
    echo "  (ver README → Actualizaciones), o FORZAR=1 si hay que reinstalar a mano igual."
    exit 1
  fi
fi
rm -f .manifiesto-antes

mkdir -p "$PUB"
# una sola versión en la carpeta (las viejas quedan en la historia de git)
if git rev-parse --git-dir >/dev/null 2>&1; then git rm -q --ignore-unmatch "$PUB"/nexo-xr-*.apk; fi
rm -f "$PUB"/nexo-xr-*.apk
APK=nexo-xr-$CODIGO.apk
cp salida/nexo-xr.apk "$PUB/$APK"
python3 - "$PUB" "$APK" "$CODIGO" "$NOMBRE" "$FIRMA" "$NOTAS" <<'PY'
import hashlib, json, os, sys, datetime
pub, apk, codigo, nombre, firma, notas = sys.argv[1:]
ruta = os.path.join(pub, apk)
datos = open(ruta, "rb").read()
v = {"versionCode": int(codigo), "versionName": nombre, "apk": apk, "bytes": len(datos),
     "sha256": hashlib.sha256(datos).hexdigest(), "firma": firma.lower(), "notas": notas,
     "fecha": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}
open(os.path.join(pub, "version.json"), "w").write(json.dumps(v, ensure_ascii=False, indent=2) + "\n")
PY
echo "✓ publicada la $NOMBRE en $PUB/ ($APK + version.json): falta commit y push"

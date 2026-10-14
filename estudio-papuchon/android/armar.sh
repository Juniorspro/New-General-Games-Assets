#!/usr/bin/env bash
# Arma el APK de Estudio Papuchón sin Gradle ni Android Studio:
# aapt2 (recursos) + javac + d8 (código) + zipalign + apksigner.
#
#   bash estudio-papuchon/android/armar.sh [salida.apk]
#
# Baja las herramientas de Android (build-tools 35 y la plataforma 34) la
# primera vez a ~/.cache/android-papuchon. La llave de firma vive FUERA del
# repo (~/.papuchon/); si se pierde, el celular no deja instalar la versión
# nueva encima de la vieja (hay que desinstalar primero).
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"; RAIZ="$(cd "$AQUI/../.." && pwd)"
SALIDA="${1:-$AQUI/estudio-papuchon.apk}"
SDK="${SDK_PAPUCHON:-$HOME/.cache/android-papuchon}"
# build-tools 35: el d8 de la 34 se cae con un NullPointerException interno.
BT="$SDK/android-15"; PLAT="$SDK/android-34/android.jar"
OBRA="$(mktemp -d)"; trap 'rm -rf "$OBRA"' EXIT

if [ ! -x "$BT/aapt2" ] || [ ! -f "$PLAT" ]; then
  mkdir -p "$SDK"; cd "$SDK"
  curl -sSfLo bt.zip https://dl.google.com/android/repository/build-tools_r35_linux.zip && unzip -qo bt.zip && rm bt.zip
  curl -sSfLo pl.zip https://dl.google.com/android/repository/platform-34-ext7_r03.zip && unzip -qo pl.zip && rm pl.zip
fi

# ── La página: el HTML de un solo archivo, con las letras adentro (sin internet
# los gráficos tienen que verse igual: Anton y Barlow Condensed son la marca).
mkdir -p "$OBRA/assets/fonts"
python3 "$RAIZ/herramientas/descargable/empaquetar.py" "$RAIZ/estudio-papuchon/index.html" "$OBRA/assets/index.html" >/dev/null
CSS_URL=$(grep -o 'https://fonts.googleapis.com/css2[^"]*' "$RAIZ/estudio-papuchon/index.html" | head -1 | sed 's/&amp;/\&/g')
UA="Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36"
curl -sSfL -A "$UA" "$CSS_URL" > "$OBRA/fuentes.css"
python3 - "$OBRA" <<'EOF'
import re, subprocess, sys, os
obra = sys.argv[1]; css = open(f"{obra}/fuentes.css").read()
# Solo los pedazos "latin" (castellano); los demás alfabetos no hacen falta.
bloques = re.findall(r"/\* ([\w-]+) \*/\s*(@font-face \{.*?\})", css, re.S)
salida = []
for i, (sub, b) in enumerate(bloques):
    if sub != "latin": continue
    url = re.search(r"url\((https://[^)]+)\)", b).group(1)
    nombre = f"f{i}.woff2"
    subprocess.run(["curl", "-sSfLo", f"{obra}/assets/fonts/{nombre}", url], check=True)
    salida.append(b.replace(url, nombre))
open(f"{obra}/assets/fonts/fuentes.css", "w").write("\n".join(salida))
h = open(f"{obra}/assets/index.html", encoding="utf-8").read()
h = re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^"]*">', '<link rel="stylesheet" href="fonts/fuentes.css">', h)
h = re.sub(r'<link rel="preconnect"[^>]*>\s*', "", h)
open(f"{obra}/assets/index.html", "w", encoding="utf-8").write(h)
print(f"letras: {len(salida)} archivos")
EOF

# ── Recursos y manifiesto
VERSION_NOMBRE=$(grep -o 'VERSION: "[^"]*"' "$RAIZ/estudio-papuchon/js/base.js" | cut -d'"' -f2)
VERSION_CODIGO=$(git -C "$RAIZ" rev-list --count HEAD)
"$BT/aapt2" compile --dir "$AQUI/res" -o "$OBRA/res.zip"
"$BT/aapt2" link -I "$PLAT" --manifest "$AQUI/AndroidManifest.xml" -A "$OBRA/assets" \
  --min-sdk-version 26 --target-sdk-version 34 --version-code "$VERSION_CODIGO" --version-name "$VERSION_NOMBRE" \
  -o "$OBRA/base.apk" "$OBRA/res.zip"

# ── Código
mkdir -p "$OBRA/clases" "$OBRA/dex"
javac -nowarn --release 8 -cp "$PLAT" -d "$OBRA/clases" $(find "$AQUI/src" -name '*.java') 2>&1 | grep -v "^Picked up" || true
"$BT/d8" --lib "$PLAT" --min-api 26 --release --output "$OBRA/dex" $(find "$OBRA/clases" -name '*.class')
(cd "$OBRA/dex" && zip -qj "$OBRA/base.apk" classes.dex)

# ── Alinear y firmar
LLAVES="$HOME/.papuchon"; mkdir -p "$LLAVES"; chmod 700 "$LLAVES"
if [ ! -f "$LLAVES/estudio.jks" ]; then
  head -c 24 /dev/urandom | base64 | tr -d '/+=' > "$LLAVES/clave"; chmod 600 "$LLAVES/clave"
  keytool -genkeypair -keystore "$LLAVES/estudio.jks" -alias papuchon -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$(cat "$LLAVES/clave")" -keypass "$(cat "$LLAVES/clave")" -dname "CN=Noticias El Papuchon, O=Papuchon, C=AR" 2>&1 | grep -v "^Picked up" || true
fi
"$BT/zipalign" -f -p 4 "$OBRA/base.apk" "$OBRA/alineado.apk"
"$BT/apksigner" sign --ks "$LLAVES/estudio.jks" --ks-pass "file:$LLAVES/clave" --ks-key-alias papuchon --out "$SALIDA" "$OBRA/alineado.apk"
"$BT/apksigner" verify "$SALIDA" && echo "listo: $SALIDA ($(du -h "$SALIDA" | cut -f1), versión $VERSION_NOMBRE / $VERSION_CODIGO)"

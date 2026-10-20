#!/usr/bin/env bash
# Arma el APK de Miniaturas Papuchón sin Gradle ni Android Studio:
# aapt2 (recursos) + javac + d8 (código) + zipalign + apksigner.
#
#   bash miniaturas/android/armar.sh [salida.apk]
#
# Rezona: si existe ~/.papuchon/rezona-miniaturas.json (una llave aparte, sacada
# con el login por dispositivo), la llave va adentro del APK, ofuscada, y la app
# usa Rezona sin que nadie haga nada. Si no existe, la app sale igual y se
# conecta desde Motores → "Conectar con Rezona". La llave NUNCA entra al repo:
# la clase LlaveRezona se genera acá, en una carpeta temporal.
# TOPE_REZONA (por defecto 40) es el máximo de imágenes de Rezona por día y teléfono.
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"; RAIZ="$(cd "$AQUI/../.." && pwd)"
SALIDA="${1:-$AQUI/miniaturas-papuchon.apk}"
SDK="${SDK_PAPUCHON:-$HOME/.cache/android-papuchon}"
# build-tools 35: el d8 de la 34 se cae con un NullPointerException interno.
BT="$SDK/android-15"; PLAT="$SDK/android-34/android.jar"
OBRA="$(mktemp -d)"; trap 'rm -rf "$OBRA"' EXIT
LLAVE="${LLAVE_REZONA:-$HOME/.papuchon/rezona-miniaturas.json}"

if [ ! -x "$BT/aapt2" ] || [ ! -f "$PLAT" ]; then
  mkdir -p "$SDK"; cd "$SDK"
  curl -sSfLo bt.zip https://dl.google.com/android/repository/build-tools_r35_linux.zip && unzip -qo bt.zip && rm bt.zip
  curl -sSfLo pl.zip https://dl.google.com/android/repository/platform-34-ext7_r03.zip && unzip -qo pl.zip && rm pl.zip
fi

# ── La página en un solo HTML, con las letras adentro (los títulos dependen de ellas).
mkdir -p "$OBRA/assets/fonts"
python3 "$RAIZ/herramientas/descargable/empaquetar.py" "$RAIZ/miniaturas/index.html" "$OBRA/assets/index.html" >/dev/null
CSS_URL=$(grep -o 'https://fonts.googleapis.com/css2[^"]*' "$RAIZ/miniaturas/index.html" | head -1 | sed 's/&amp;/\&/g')
UA="Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36"
curl -sSfL -A "$UA" "$CSS_URL" > "$OBRA/fuentes.css"
python3 - "$OBRA" <<'EOF'
import re, subprocess, sys
obra = sys.argv[1]; css = open(f"{obra}/fuentes.css").read()
bloques = re.findall(r"/\* ([\w-]+) \*/\s*(@font-face \{.*?\})", css, re.S)
salida = []
for i, (sub, b) in enumerate(bloques):
    if sub != "latin": continue   # el castellano entra entero en "latin"
    url = re.search(r"url\((https://[^)]+)\)", b).group(1)
    subprocess.run(["curl", "-sSfLo", f"{obra}/assets/fonts/f{i}.woff2", url], check=True)
    salida.append(b.replace(url, f"f{i}.woff2"))
open(f"{obra}/assets/fonts/fuentes.css", "w").write("\n".join(salida))
h = open(f"{obra}/assets/index.html", encoding="utf-8").read()
h = re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^"]*">', '<link rel="stylesheet" href="fonts/fuentes.css">', h)
h = re.sub(r'<link rel="preconnect"[^>]*>\s*', "", h)
open(f"{obra}/assets/index.html", "w", encoding="utf-8").write(h)
print(f"letras: {len(salida)} archivos")
EOF

# ── La llave de Rezona (si hay): a una clase generada, ofuscada con XOR (no es
# un candado, solo para que no aparezca a simple vista en el APK).
mkdir -p "$OBRA/gen/ar/papuchon/miniaturas"
python3 - "$LLAVE" "${TOPE_REZONA:-40}" "$OBRA/gen/ar/papuchon/miniaturas/LlaveRezona.java" <<'EOF'
import json, os, sys
ruta, tope, destino = sys.argv[1], int(sys.argv[2]), sys.argv[3]
tok = ""
if os.path.exists(ruta):
    tok = json.load(open(ruta)).get("token", "")
k = os.urandom(24); d = bytes(b ^ k[i % len(k)] for i, b in enumerate(tok.encode()))
lista = lambda bs: ",".join(str((x + 128) % 256 - 128) for x in bs)
open(destino, "w").write(f"""package ar.papuchon.miniaturas;
final class LlaveRezona {{
    static final int TOPE = {tope};
    private static final byte[] D = {{{lista(d)}}};
    private static final byte[] K = {{{lista(k)}}};
    static String token() {{
        byte[] o = new byte[D.length];
        for (int i = 0; i < D.length; i++) o[i] = (byte) (D[i] ^ K[i % K.length]);
        return new String(o, java.nio.charset.StandardCharsets.UTF_8);
    }}
}}
""")
print("Rezona:", "llave adentro" if tok else "sin llave (se conecta desde la app)", "· tope", tope, "por día")
EOF

# ── Recursos, manifiesto y código
VERSION_NOMBRE=$(grep -o 'VERSION: "[^"]*"' "$RAIZ/miniaturas/js/base.js" | cut -d'"' -f2)
VERSION_CODIGO=$(git -C "$RAIZ" rev-list --count HEAD)
"$BT/aapt2" compile --dir "$AQUI/res" -o "$OBRA/res.zip"
"$BT/aapt2" link -I "$PLAT" --manifest "$AQUI/AndroidManifest.xml" -A "$OBRA/assets" \
  --min-sdk-version 26 --target-sdk-version 34 --version-code "$VERSION_CODIGO" --version-name "$VERSION_NOMBRE" \
  -o "$OBRA/base.apk" "$OBRA/res.zip"
mkdir -p "$OBRA/clases" "$OBRA/dex"
javac -nowarn --release 8 -cp "$PLAT" -d "$OBRA/clases" $(find "$AQUI/src" "$OBRA/gen" -name '*.java') 2>&1 | grep -v "^Picked up\|^Note:" || true
"$BT/d8" --lib "$PLAT" --min-api 26 --release --output "$OBRA/dex" $(find "$OBRA/clases" -name '*.class')
(cd "$OBRA/dex" && zip -qj "$OBRA/base.apk" classes.dex)

# ── Alinear y firmar (misma llave de firma que Estudio Papuchón, fuera del repo)
LLAVES="$HOME/.papuchon"; mkdir -p "$LLAVES"; chmod 700 "$LLAVES"
if [ ! -f "$LLAVES/estudio.jks" ]; then
  head -c 24 /dev/urandom | base64 | tr -d '/+=' > "$LLAVES/clave"; chmod 600 "$LLAVES/clave"
  keytool -genkeypair -keystore "$LLAVES/estudio.jks" -alias papuchon -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$(cat "$LLAVES/clave")" -keypass "$(cat "$LLAVES/clave")" -dname "CN=Noticias El Papuchon, O=Papuchon, C=AR" 2>&1 | grep -v "^Picked up" || true
fi
"$BT/zipalign" -f -p 4 "$OBRA/base.apk" "$OBRA/alineado.apk"
"$BT/apksigner" sign --ks "$LLAVES/estudio.jks" --ks-pass "file:$LLAVES/clave" --ks-key-alias papuchon --out "$SALIDA" "$OBRA/alineado.apk"
"$BT/apksigner" verify "$SALIDA" && echo "listo: $SALIDA ($(du -h "$SALIDA" | cut -f1), versión $VERSION_NOMBRE / $VERSION_CODIGO)"

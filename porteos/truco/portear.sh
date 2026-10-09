#!/usr/bin/env bash
# Truco (Blyts, com.blyts.trucolite.activities 6.0.352): del APK de Google Play al porteo web y APK,
# en un comando.
#
#   porteos/truco/portear.sh TRUCO.apk [CARPETA_DE_ENTREGA] [--sin-apk] [--sin-un-archivo]
#
# El original es Unity con IL2CPP: el código es nativo de ARM y no se puede pasar a la web. Lo que sí
# se aprovecha es todo lo demás: armar-datos.py saca del APK los 6 mazos, las mesas, las caras y
# las frases de los personajes de la Gira Nacional, las 12 voces, los efectos, la música, los sprites
# de la interfaz, las letras y los textos en castellano. Las reglas (truco.js), la computadora
# (truco-ia.js) y las pantallas (juego.js, mesa.js, estilos.css) están rehechas acá, con las medidas
# de las escenas del original.
#
# Deja en CARPETA_DE_ENTREGA (default ./entrega-truco):
#   truco/           versión web (PWA): se instala desde Chrome y anda sin internet
#   truco-web.zip    la carpeta web comprimida, para subir a un hosting
#   truco.apk        APK nuevo (ar.juniors.truco), vertical, con todo adentro
#   truco.html       un solo archivo que se abre con doble clic (todo adentro)
#
# El juego no está en el repo (el repo es público): sale del APK del dueño. Lo pesado (el entorno
# de Python con UnityPy) se guarda en $TRUCO_TRABAJO (default ~/.porteo/truco).
set -euo pipefail
SIN_APK=0; SIN_UN_ARCHIVO=0
ARGS=()
for a in "$@"; do
  case "$a" in --sin-apk) SIN_APK=1 ;; --sin-un-archivo) SIN_UN_ARCHIVO=1 ;; *) ARGS+=("$a") ;; esac
done
USO='uso: portear.sh TRUCO.apk [SALIDA] [--sin-apk] [--sin-un-archivo]'
APK=$(realpath "${ARGS[0]:?$USO}")
SALIDA=$(realpath -m "${ARGS[1]:-entrega-truco}")
AQUI=$(cd "$(dirname "$0")" && pwd)
H="$AQUI/../../herramientas"
TRABAJO=${TRUCO_TRABAJO:-$HOME/.porteo/truco}
SHA_PROBADO=f20e334ca82d16fed0ee594cada82a410452da9775c9cbe773001fa2962a55e9

faltan=()
for p in python3 ffmpeg zip; do command -v "$p" >/dev/null || faltan+=("$p"); done
[[ ${#faltan[@]} == 0 ]] || { echo "faltan: ${faltan[*]}"; exit 1; }
case "$(sha256sum "$APK" | cut -c1-64)" in
  "$SHA_PROBADO") ;;
  *) echo "AVISO: $(basename "$APK") no es el que se probó (6.0.352 de Google Play). Se sigue igual; revisar con prueba.mjs." ;;
esac

# ── 1. el entorno: UnityPy lee los datos de Unity (FMOD decodifica el audio); numpy hace que los
#       sprites recortados de un atlas salgan en segundos y no en minutos ──────────────────────
mkdir -p "$TRABAJO" "$SALIDA"
PY="$TRABAJO/venv/bin/python"
if ! "$PY" -c 'import UnityPy, PIL, numpy' 2>/dev/null; then
  python3 -m venv "$TRABAJO/venv"
  "$TRABAJO/venv/bin/pip" install -q UnityPy==1.25.4 Pillow==12.3.0 numpy==2.5.3
fi

# ── 2. los datos del juego ─────────────────────────────────────────────────────────────────
W="$SALIDA/truco"
rm -rf "$W"
mkdir -p "$W"
"$PY" -I "$AQUI/armar-datos.py" "$APK" "$W/datos"

# ── 3. lo nuestro: la página, las reglas, la computadora y las herramientas de porteo ────────
cp "$AQUI"/{index.html,estilos.css,juego.js,mesa.js,truco.js,truco-ia.js} "$W/"
cp "$H/porteo/intro.js" "$W/porteo-intro.js"
cp "$H/porteo/web.js" "$W/porteo-web.js"
ICONO="$W/datos/icono.png"

# ── 4. el .html de un solo archivo (antes de pwa.py: no lleva service worker) ─────────────────
if [[ $SIN_UN_ARCHIVO == 0 ]]; then
  # la música y las voces van al final: el juego arranca sin esperarlas
  FINAL=()
  while IFS= read -r f; do FINAL+=(--al-final "${f#"$W"/}"); done < <(find "$W/datos/musica" -name '*.mp3' | sort)
  python3 "$H/porteo/un-archivo.py" "$W" --salida "$SALIDA/truco.html" "${FINAL[@]}"
fi

# ── 5. instalable, zip y APK ───────────────────────────────────────────────────────────────
# Se guarda todo al instalar (son 23 MB): así anda entero sin internet, con cualquier mazo, voz o
# región. --espera: una versión nueva no reemplaza a la vieja con un partido abierto.
python3 "$H/porteo/pwa.py" "$W" --nombre "Truco" --corto "Truco" --orientacion portrait \
    --icono "$ICONO" --color "#0d0706" --espera
(cd "$SALIDA" && rm -f truco-web.zip && zip -qr -X truco-web.zip truco)
if [[ $SIN_APK == 0 ]]; then
  python3 "$H/porteo/apk/armar.py" "$W" --nombre "Truco" --paquete ar.juniors.truco \
      --orientacion vertical --icono "$ICONO" --version 1.0.0 --salida "$SALIDA/truco.apk"
fi
ls -l "$SALIDA"

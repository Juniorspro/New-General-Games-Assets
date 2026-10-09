#!/usr/bin/env bash
# Anger of Stick 5 (J-PARK, AngerOfStick5jpark.AOS5 1.1.94): del APK al porteo web y APK, en un comando.
#
#   porteos/aos5/portear.sh AOS5.apk [CARPETA_DE_ENTREGA] [--sin-apk] [--sin-un-archivo]
#
# El original es cocos2d-x 3.17 y todo el juego es código nativo ARM64 (lib/arm64-v8a/libMyGame.so):
# no hay nada en JavaScript ni en Lua que aprovechar. Así que:
#   - recompilar.py traduce ese código a C, instrucción por instrucción (cada función ARM es una
#     función de C; la memoria del juego queda en las mismas direcciones);
#   - la capa (hle_libc.c, hle_cocos.c, hle_android.c, juego.c, dibujo.c, texto.c, tablas.c, mem.c)
#     hace lo que hacían cocos2d, Android y la libc, con lo mínimo;
#   - Emscripten lo compila a WebAssembly, y aos5.js lo hace andar al ritmo de cocos2d (una vuelta
#     cada 0,06 s, como el original) y lo dibuja con WebGL;
#   - armar-datos.py saca del APK las imágenes (WebP), los efectos (Opus), los datos y la letra.
#
# Deja en CARPETA_DE_ENTREGA (default ./entrega-aos5):
#   aos5/            versión web (PWA): se instala desde Chrome y anda sin internet
#   aos5-web.zip     la carpeta web comprimida, para subir a un hosting
#   aos5.apk         APK nuevo (ar.juniors.aos5), acostado, con todo adentro
#   aos5.html        un solo archivo que se abre con doble clic (todo adentro)
#
# El juego no está en el repo (el repo es público): sale del APK del dueño. Lo pesado se guarda en
# $AOS5_TRABAJO (default ~/.porteo/aos5): el entorno de Python, la traducción, los datos ya
# convertidos y los objetos compilados (la primera vez son unos minutos; después, segundos).
# Emscripten se comparte con los otros porteos si ya está (~/.porteo/cs16/emsdk).
set -euo pipefail
SIN_APK=0; SIN_UN_ARCHIVO=0
ARGS=()
for a in "$@"; do
  case "$a" in --sin-apk) SIN_APK=1 ;; --sin-un-archivo) SIN_UN_ARCHIVO=1 ;; *) ARGS+=("$a") ;; esac
done
USO='uso: portear.sh AOS5.apk [SALIDA] [--sin-apk] [--sin-un-archivo]'
APK=$(realpath "${ARGS[0]:?$USO}")
SALIDA=$(realpath -m "${ARGS[1]:-entrega-aos5}")
AQUI=$(cd "$(dirname "$0")" && pwd)
H="$AQUI/../../herramientas"
TRABAJO=${AOS5_TRABAJO:-$HOME/.porteo/aos5}
SHA_PROBADO=9bb2f4658d51e0b4dc2cf899269266e85903a4673059383dadb10e9f212eae59  # AngerOfStick5jpark.AOS5v1.1.94.apk, firmado por J-PARK
EMSDK_VERSION=6.0.11
mkdir -p "$TRABAJO" "$SALIDA"

faltan=()
for p in python3 ffmpeg zip; do command -v "$p" >/dev/null || faltan+=("$p"); done
[[ ${#faltan[@]} == 0 ]] || { echo "faltan: ${faltan[*]}"; exit 1; }
case "$(sha256sum "$APK" | cut -c1-64)" in
  "$SHA_PROBADO") ;;
  *) echo "AVISO: $(basename "$APK") no es el que se probó (1.1.94 de J-PARK). Se sigue igual; revisar con prueba.mjs." ;;
esac

# ── 1. herramientas: el desarmador con AArch64 (el de LLVM 18 es el probado; el de Emscripten sólo
#       trae WebAssembly), Python con Pillow y fontTools, y Emscripten ──────────────────────────
OBJDUMP=""
for od in llvm-objdump-18 llvm-objdump; do
  if command -v "$od" >/dev/null && "$od" --version 2>/dev/null | grep -q aarch64; then OBJDUMP=$(command -v "$od"); break; fi
done
if [[ -z "$OBJDUMP" ]]; then
  apt-get install -y llvm-18 >/dev/null 2>&1 || { apt-get update >/dev/null 2>&1; apt-get install -y llvm-18 >/dev/null; }
  OBJDUMP=$(command -v llvm-objdump-18 || echo /usr/lib/llvm-18/bin/llvm-objdump)
fi
"$OBJDUMP" --version | grep -q 'LLVM version 18' || echo "AVISO: $OBJDUMP no es el de LLVM 18 (el probado); revisar con prueba.mjs."
PY="$TRABAJO/venv/bin/python"
if ! "$PY" -c 'import PIL, fontTools' 2>/dev/null; then
  python3 -m venv "$TRABAJO/venv"
  "$TRABAJO/venv/bin/pip" install -q Pillow==12.3.0 fonttools==4.60.1
fi
EMSDK=${EMSDK_DIR:-$HOME/.porteo/cs16/emsdk}
[[ -x "$EMSDK/emsdk" ]] || EMSDK="$TRABAJO/emsdk"
if [[ ! -x "$EMSDK/emsdk" ]]; then
  git clone -q --depth 1 https://github.com/emscripten-core/emsdk.git "$EMSDK"
fi
"$EMSDK/emsdk" install "$EMSDK_VERSION" >/dev/null
"$EMSDK/emsdk" activate "$EMSDK_VERSION" >/dev/null
# shellcheck disable=SC1091
source "$EMSDK/emsdk_env.sh" >/dev/null 2>&1

# Lo bajado es de terceros: se abre en una carpeta propia y no se ejecuta nada de adentro.
huella() { cat "$@" | sha256sum | cut -c1-16; }
APKD="$TRABAJO/apk"
mkdir -p "$APKD"
SO="$APKD/libMyGame.so"
python3 -I -c '
import sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
open(sys.argv[2], "wb").write(z.read("lib/arm64-v8a/libMyGame.so"))' "$APK" "$SO"

# ── 2. la traducción: el código ARM64 del juego a C (si cambió el .so, el traductor o la capa) ──
GEN="$TRABAJO/gen"
H_GEN=$(huella "$SO" "$AQUI/recompilar.py" "$AQUI"/*.c "$AQUI"/*.h)
if [[ "$(cat "$GEN/.huella" 2>/dev/null)" != "$H_GEN" ]]; then
  echo "traduciendo el código del juego…"
  rm -rf "$GEN"
  OBJDUMP="$OBJDUMP" python3 -I "$AQUI/recompilar.py" "$SO" "$GEN" "$AQUI" 2>&1 | tail -3
  echo "$H_GEN" > "$GEN/.huella"
fi

# ── 3. los datos: imágenes, efectos, archivos de datos, la letra y el ícono ────────────────────
DAT="$TRABAJO/datos"
H_DAT=$(huella "$APK" "$AQUI/armar-datos.py")
if [[ "$(cat "$DAT/.huella" 2>/dev/null)" != "$H_DAT" ]]; then
  echo "convirtiendo imágenes y sonidos…"
  rm -rf "$DAT"
  mkdir -p "$DAT/web" "$DAT/gen"
  "$PY" -I "$AQUI/armar-datos.py" "$APK" "$DAT/web" "$DAT/gen"
  echo "$H_DAT" > "$DAT/.huella"
fi

# ── 4. a WebAssembly ───────────────────────────────────────────────────────────────────────
OBJ="$TRABAJO/obj"
mkdir -p "$OBJ"
OPCIONES="-O2 -mnontrapping-fptoint -fno-strict-aliasing -w"
H_OBJ=$(echo "$OPCIONES $(emcc --version | head -1) $H_GEN $H_DAT" | sha256sum | cut -c1-16)
[[ "$(cat "$OBJ/.huella" 2>/dev/null)" == "$H_OBJ" ]] || { rm -f "$OBJ"/*.o; echo "$H_OBJ" > "$OBJ/.huella"; }
FUENTES=("$GEN"/*.c "$DAT/gen/imagenes.c" "$DAT/gen/fuentes.c")
for f in mem hle_libc hle_cocos hle_android juego dibujo texto tablas web; do FUENTES+=("$AQUI/$f.c"); done
compilar() {   # compilar FUENTE: el .o sólo si falta o si la fuente (o un .h nuestro) es más nueva
  local f=$1 o
  o="$OBJ/$(basename "${f%.c}").o"
  if [[ ! -f "$o" || "$f" -nt "$o" || "$AQUI/aos.h" -nt "$o" || "$AQUI/capa.h" -nt "$o" || "$AQUI/juego.h" -nt "$o" ]]; then
    # shellcheck disable=SC2086
    emcc $OPCIONES -I"$AQUI" -I"$GEN" -c "$f" -o "$o"
  fi
}
export -f compilar
export OBJ AQUI GEN OPCIONES
printf '%s\n' "${FUENTES[@]}" | xargs -P "$(nproc)" -I{} bash -c 'compilar "$1"' _ {}
W="$SALIDA/aos5"
rm -rf "$W"
mkdir -p "$W"
EXP=_aos_atlas,_aos_reiniciar_atlas,_aos_escena_dir,_aos_iniciar,_aos_paso,_aos_armar,_aos_interpolar,_aos_fraccion
EXP=$EXP,_aos_movimiento,_aos_emparejados,_aos_verts_ptr,_aos_lotes_ptr,_aos_lotes_n
EXP=$EXP,_aos_toque,_aos_atras,_aos_fondo,_aos_politica,_aos_salir,_aos_blend,_aos_nblend,_aos_pantalla,_aos_reservar
EXP=$EXP,_aos_paquete,_aos_heap,_malloc,_free
# La memoria del juego va en las direcciones del .so (0..64 MB); lo de Emscripten, de 64 MB para arriba.
emcc -O2 "$OBJ"/*.o --js-library "$AQUI/host.js" -o "$W/aos5-wasm.js" -mnontrapping-fptoint \
  -sGLOBAL_BASE=67108864 -sINITIAL_MEMORY=134217728 -sALLOW_MEMORY_GROWTH=0 -sSTACK_SIZE=1048576 \
  -sMODULARIZE=1 -sEXPORT_NAME=AOS5 -sENVIRONMENT=web -sFILESYSTEM=0 -sEXIT_RUNTIME=0 \
  -sEXPORTED_FUNCTIONS="$EXP" -sEXPORTED_RUNTIME_METHODS=HEAPU8,HEAPU32,HEAPF32

# ── 5. la página ───────────────────────────────────────────────────────────────────────────
cp -r "$DAT/web/datos" "$W/datos"
cp "$GEN/imagen.bin" "$W/datos/imagen.bin"
cp "$AQUI"/{index.html,aos5.js} "$W/"
cp "$H/porteo/intro.js" "$W/porteo-intro.js"
cp "$H/porteo/web.js" "$W/porteo-web.js"
ICONO="$W/datos/icono.png"

# ── 6. el .html de un solo archivo (antes de pwa.py: no lleva service worker) ─────────────────
if [[ $SIN_UN_ARCHIVO == 0 ]]; then
  # los efectos van al final: el juego arranca sin esperarlos
  FINAL=()
  while IFS= read -r f; do FINAL+=(--al-final "${f#"$W"/}"); done < <(find "$W/datos/sonido" -name '*.ogg' | sort)
  python3 "$H/porteo/un-archivo.py" "$W" --salida "$SALIDA/aos5.html" "${FINAL[@]}"
fi

# ── 7. instalable, zip y APK ───────────────────────────────────────────────────────────────
python3 "$H/porteo/pwa.py" "$W" --nombre "Anger of Stick 5" --corto "AOS5" --orientacion landscape \
    --icono "$ICONO" --color "#000000" --espera
(cd "$SALIDA" && rm -f aos5-web.zip && zip -qr -X aos5-web.zip aos5)
if [[ $SIN_APK == 0 ]]; then
  python3 "$H/porteo/apk/armar.py" "$W" --nombre "Anger of Stick 5" --paquete ar.juniors.aos5 \
      --orientacion horizontal --icono "$ICONO" --version 1.1.94 --salida "$SALIDA/aos5.apk"
fi
ls -l "$SALIDA"

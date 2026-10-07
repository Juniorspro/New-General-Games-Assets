#!/usr/bin/env bash
# Plantas vs. Zombies (PC, PopCap): del juego de PC al porteo móvil completo, en un comando.
#
#   porteos/pvz/portear.sh JUEGO [CARPETA_DE_ENTREGA] [--un-archivo]
#
# JUEGO: el .rar/.zip/.7z del juego, o la carpeta donde están main.pak y properties/.
# Anda con el original de 2009 (1.0.0.1051, el probado) y con la GOTY.
#
# Deja en CARPETA_DE_ENTREGA (default: ./entrega-pvz):
#   pvz/          versión web (PWA: se instala y anda sin red)
#   pvz.apk       APK nuevo (ar.juniors.pvz)
#   pvz-web.zip   la carpeta web comprimida, para subir a un hosting
#   pvz.html      con --un-archivo: todo en un .html (~34 MB; pesado para un teléfono)
#   pvz-depuracion/  con --depuracion: el motor con los atajos de PopCap (-cheat), para
#                 recorrido.mjs y bailarin.mjs. NO se entrega.
#
# Ni el juego ni el motor están en el repo (el repo es público):
#   - los datos son de PopCap/EA: salen del juego del dueño;
#   - el motor es PvZ-Portable (LGPL-3.0, https://github.com/wszqkzqk/PvZ-Portable),
#     una reimplementación en C++ que compila a WebAssembly. Se baja en la versión
#     fijada abajo y se le aplica pvz-portable-1051.patch (lo nuestro: leer los datos
#     de 2009, el bailarín original, y el estado para las pruebas).
#
# Lo pesado se guarda en $PVZ_TRABAJO (default ~/.porteo/pvz): el SDK de Emscripten
# (~1 GB) y la compilación. La primera vez tarda ~15 min; después, segundos.
set -euo pipefail
UN_ARCHIVO=0; DEPURACION=0
ARGS=()
for a in "$@"; do
  case "$a" in --un-archivo) UN_ARCHIVO=1 ;; --depuracion) DEPURACION=1 ;; *) ARGS+=("$a") ;; esac
done
JUEGO=$(realpath "${ARGS[0]:?uso: portear.sh JUEGO [SALIDA] [--un-archivo] [--depuracion]}")
SALIDA=$(realpath -m "${ARGS[1]:-entrega-pvz}")
AQUI=$(cd "$(dirname "$0")" && pwd)
H="$AQUI/../../herramientas"
TRABAJO=${PVZ_TRABAJO:-$HOME/.porteo/pvz}
MOTOR_GIT=https://github.com/wszqkzqk/PvZ-Portable.git
MOTOR_COMMIT=2de842d6908023dd15ef9e9bd78a3601362226f8   # 2026-10-06, el probado
EMSDK_VERSION=6.0.11
mkdir -p "$TRABAJO" "$SALIDA"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT

# ── 1. el juego ──────────────────────────────────────────────────────────────
# Lo bajado es de terceros: se abre en una carpeta propia y no se ejecuta nada.
# RAR con unar: el 7z de Debian no trae el códec RAR y "extrae" archivos de 0 bytes.
if [[ -d "$JUEGO" ]]; then D="$JUEGO"; else
  mkdir "$T/juego"
  case "${JUEGO,,}" in
    *.rar) unar -q -f -o "$T/juego" "$JUEGO" ;;
    *)     7z x -y -bd -o"$T/juego" "$JUEGO" >/dev/null ;;
  esac
  D="$T/juego"
fi
PAK=$(find "$D" -maxdepth 3 -iname main.pak | head -1)
[[ -n "$PAK" ]] || { echo "no hay main.pak en $JUEGO"; exit 1; }
D=$(dirname "$PAK")
# El RAR con el que se hizo y se probó este porteo:
ESPERADO=f64917061ed6157564fb679816d23d821267f33e36c25f0608a615c7f540276e
[[ -f "$JUEGO" && "$(sha256sum "$JUEGO" | cut -c1-64)" != "$ESPERADO" ]] && \
  echo "AVISO: este archivo no es el que se probó. Se sigue igual; revisar con prueba.mjs."
python3 -I "$H/popcap/pak.py" listar "$PAK" > "$T/lista.txt"
echo "main.pak: $(wc -l < "$T/lista.txt") archivos"

# ── 2. Emscripten ────────────────────────────────────────────────────────────
if ! command -v emcc >/dev/null; then
  if [[ ! -x "$TRABAJO/emsdk/emsdk" ]]; then
    git clone -q --depth 1 https://github.com/emscripten-core/emsdk.git "$TRABAJO/emsdk"
  fi
  "$TRABAJO/emsdk/emsdk" install "$EMSDK_VERSION" >/dev/null
  "$TRABAJO/emsdk/emsdk" activate "$EMSDK_VERSION" >/dev/null
  # shellcheck disable=SC1091
  source "$TRABAJO/emsdk/emsdk_env.sh" >/dev/null 2>&1
fi
# Emscripten baja zlib y SDL2 como .tar.gz de GitHub. Detrás de un proxy que sólo
# deja pasar git (como el de estas máquinas) eso da 403: se clonan con git y se
# dejan en su caché con la marca que él mismo escribe al desempaquetar.
EMDIR=$(dirname "$(command -v emcc)")
python3 -I - "$EMDIR" <<'EOF' | while read -r NOMBRE SUB URL REPO TAG; do
import re, sys, pathlib
em = pathlib.Path(sys.argv[1]); p = em / 'tools' / 'ports'
z = (p / 'zlib.py').read_text(); s = (p / 'sdl2.py').read_text()
vz = re.search(r"VERSION = '([^']+)'", z).group(1)
ts = re.search(r"VERSION = '([^']+)'", s).group(1)
print('zlib', f'zlib-{vz}', f'https://github.com/madler/zlib/archive/refs/tags/v{vz}.tar.gz', 'https://github.com/madler/zlib.git', f'v{vz}')
print('sdl2', f'SDL-release-{ts}', f'https://github.com/libsdl-org/SDL/archive/release-{ts}.zip', 'https://github.com/libsdl-org/SDL.git', f'release-{ts}')
EOF
  CACHE="$EMDIR/cache/ports/$NOMBRE"
  if [[ "$(cat "$CACHE/.emscripten_url" 2>/dev/null)" != "$URL" ]]; then
    if ! curl -fsSL -o /dev/null "$URL" 2>/dev/null; then
      rm -rf "$CACHE"; mkdir -p "$CACHE"
      git -c advice.detachedHead=false clone -q --depth 1 --branch "$TAG" "$REPO" "$CACHE/$SUB"
      rm -rf "$CACHE/$SUB/.git"
      echo "$URL" > "$CACHE/.emscripten_url"
    fi
  fi
done

# ── 3. el motor: PvZ-Portable fijado + nuestro parche ────────────────────────
M="$TRABAJO/PvZ-Portable"
# Sólo ese commit, sin el historial: GitHub deja pedir un commit por su hash.
if ! git -C "$M" rev-parse -q --verify "$MOTOR_COMMIT^{commit}" >/dev/null 2>&1; then
  mkdir -p "$M"; git -C "$M" init -q
  git -C "$M" remote add origin "$MOTOR_GIT" 2>/dev/null || true
  git -C "$M" fetch -q --depth 1 origin "$MOTOR_COMMIT"
fi
git -C "$M" checkout -q -f "$MOTOR_COMMIT"
git -C "$M" checkout -q -- .
git -C "$M" apply "$AQUI/pvz-portable-1051.patch"
(cd "$M" && bash wasm/build-wasm.sh --deps) > "$TRABAJO/compilar.log" 2>&1 || { tail -30 "$TRABAJO/compilar.log"; exit 1; }
echo "motor: $(du -h "$M/build-wasm/pvz-portable.wasm" | cut -f1) de WebAssembly"

# ── 4. la carpeta web ────────────────────────────────────────────────────────
W="$SALIDA/pvz"
rm -rf "$W"; mkdir -p "$W/properties"
cp "$AQUI/index.html" "$W/"
cp "$M/build-wasm/pvz-portable.js" "$M/build-wasm/pvz-portable.wasm" "$W/"
# Sin pérdida y verificado píxel por píxel (~0,8 MB menos). oxipng y Pillow van en un
# entorno aparte; si no se pueden instalar, va el pak original tal cual.
PY="$TRABAJO/venv/bin/python"
[[ -x "$PY" ]] || { python3 -m venv "$TRABAJO/venv" && "$TRABAJO/venv/bin/pip" install -q pyoxipng pillow; } >/dev/null 2>&1 || PY=python3
"$PY" -I "$H/popcap/pak.py" achicar "$PAK" "$W/main.pak" 2>/dev/null || cp "$PAK" "$W/main.pak"
# properties/ suelto (el .sig no: el juego no lo usa en la web)
for f in partner.xml partner_logo.jpg; do
  [[ -f "$D/properties/$f" ]] && cp "$D/properties/$f" "$W/properties/"
done
# El ícono del .exe original (la flor con la mano de zombi); si no se puede, el de PvZ-Portable.
ICONO="$T/icono.png"
EXE=$(find "$D" -maxdepth 1 -iname '*.exe' | head -1)
if [[ -n "$EXE" ]] && command -v wrestool >/dev/null && command -v icotool >/dev/null && \
   wrestool -x --type=14 -o "$T" "$EXE" 2>/dev/null; then
  ICO=$(ls "$T"/*.ico | head -1)
  IDX=$(icotool -l "$ICO" | awk '/--width=256/ && /--bit-depth=32/ {sub("--index=","",$2); print $2; exit}')
  icotool -x --index="${IDX:-1}" -o "$ICONO" "$ICO"
else
  cp "$M/icon.png" "$ICONO"
fi

# ── 5. instalable y sin red, APK, zip (y un solo archivo si se pidió) ────────
python3 "$H/porteo/pwa.py" "$W" --nombre "Plantas vs. Zombies" --corto "PvZ" \
    --orientacion landscape --icono "$ICONO" --color "#000000"
python3 "$H/porteo/apk/armar.py" "$W" --nombre "Plantas vs. Zombies" --paquete ar.juniors.pvz \
    --orientacion horizontal --icono "$ICONO" --version 1.0.0.1051 --salida "$SALIDA/pvz.apk"
(cd "$SALIDA" && rm -f pvz-web.zip && zip -qr -9 pvz-web.zip pvz)
if [[ $UN_ARCHIVO == 1 ]]; then
  python3 "$H/porteo/un-archivo.py" "$W" --salida "$SALIDA/pvz.html"
fi
# La variante de depuración: PVZ_DEBUG (asserts y atajos: "l" salta de nivel, "m" trae
# un bailarín, "9" da sol) y arranca con -cheat. Sirve para probar todo el juego en
# minutos, no para jugar.
if [[ $DEPURACION == 1 ]]; then
  (cd "$M" && emcmake cmake -S . -B build-depuracion -DCMAKE_BUILD_TYPE=Release -DPVZ_DEBUG=ON \
      -DCMAKE_FIND_ROOT_PATH="$M/build-wasm/openmpt-prefix" -G Ninja && cmake --build build-depuracion) \
      >> "$TRABAJO/compilar.log" 2>&1 || { tail -30 "$TRABAJO/compilar.log"; exit 1; }
  WD="$SALIDA/pvz-depuracion"
  rm -rf "$WD"; mkdir -p "$WD"
  cp -r "$W/properties" "$W/main.pak" "$W/porteo-web.js" "$WD/"
  cp "$M/build-depuracion/pvz-portable.js" "$M/build-depuracion/pvz-portable.wasm" "$WD/"
  sed -e 's/Module.callMain(\[\]);/Module.callMain(["-cheat"]);/' \
      -e "s/Porteo.web({ orientacion/Porteo.web({ offline: false, orientacion/" "$AQUI/index.html" > "$WD/index.html"
  grep -q '"-cheat"' "$WD/index.html" || { echo "index.html cambió: no se pudo agregar -cheat"; exit 1; }
fi
ls -l "$SALIDA"

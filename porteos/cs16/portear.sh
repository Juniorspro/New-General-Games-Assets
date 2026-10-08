#!/usr/bin/env bash
# Counter-Strike 1.6 (la copia del dueño, "CS 1.6 dani vizcarra LOQUENDO.rar": No Steam v23b con
# el parche de idioma): del RAR al porteo web y APK, en un comando.
#
#   porteos/cs16/portear.sh JUEGO.rar [CARPETA_DE_ENTREGA] [--sin-apk] [--sin-un-archivo]
#
# JUEGO: el .rar con "COUNTER STRIKE 1.6.exe" (instalador Inno Setup) y "PARCHE IDIOMA.exe"
# (textos y voces en español), o una carpeta con valve/ y cstrike/ ya instalados.
#
# Deja en CARPETA_DE_ENTREGA (default ./entrega-cs16):
#   cs16/          versión web (PWA): con la intro se baja el motor y el menú; mientras se mira el
#                  menú, lo común a las partidas; cada mapa, al elegirlo (y queda guardado)
#   cs16-web.zip   la carpeta web comprimida, para subir a un hosting
#   cs16.apk       APK nuevo (ar.juniors.cs16), con todo adentro: anda sin internet
#   cs16.html      un solo archivo que se abre con doble clic, con 4 mapas ($UN_ARCHIVO_MAPAS):
#                  el juego entero son 171 MB
#
# Ni el juego ni el motor están en el repo (el repo es público):
#   - los datos son de Valve: salen del juego del dueño;
#   - el motor es Xash3D FWGS (GPL-3.0, https://github.com/FWGS/xash3d-fwgs), una
#     reimplementación abierta de GoldSrc; la lógica de CS es cs16-client (cliente y menú, de
#     https://github.com/Velaron/cs16-client) con ReGameDLL_CS (servidor y bots, MIT). Se bajan
#     en los commits fijados abajo y se les aplican los parches de parches/ (lo nuestro: la
#     plataforma "emscripten", el bucle por requestAnimationFrame, WebGL2, los mapas que se bajan
#     al elegirlos, las funciones para los controles y el teclado de la página, el menú de la web
#     y dos errores de cs16-client). Detalle en LEEME.md.
#
# Lo pesado se guarda en $CS16_TRABAJO (default ~/.porteo/cs16): Emscripten (~1 GB), los fuentes
# y la compilación. La primera vez baja Emscripten; con él instalado, todo tarda ~6 min (y si los
# fuentes ya están compilados, ~4: casi todo es armar los datos, el .html único y el APK).
set -euo pipefail
SIN_APK=0; SIN_UN_ARCHIVO=0
ARGS=()
for a in "$@"; do
  case "$a" in --sin-apk) SIN_APK=1 ;; --sin-un-archivo) SIN_UN_ARCHIVO=1 ;; *) ARGS+=("$a") ;; esac
done
UN_ARCHIVO_MAPAS=${UN_ARCHIVO_MAPAS:-de_dust2,cs_assault,fy_iceworld,awp_map}
JUEGO=$(realpath "${ARGS[0]:?uso: portear.sh JUEGO.rar [SALIDA] [--sin-apk] [--sin-un-archivo]}")
SALIDA=$(realpath -m "${ARGS[1]:-entrega-cs16}")
AQUI=$(cd "$(dirname "$0")" && pwd)
H="$AQUI/../../herramientas"
TRABAJO=${CS16_TRABAJO:-$HOME/.porteo/cs16}
XASH_GIT=https://github.com/FWGS/xash3d-fwgs.git
XASH_COMMIT=9137964147d8f749dbeddf1cb5482c3d16f86e4a   # 2026-10-04, el probado
CS16_GIT=https://github.com/Velaron/cs16-client.git
CS16_COMMIT=e30e27c3bd890f731ad7921d9c876d171aea4b32   # 2026-09-20, el probado
EMSDK_VERSION=6.0.11
mkdir -p "$TRABAJO" "$SALIDA"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT

faltan=()
for p in unar innoextract unrar zip; do command -v "$p" >/dev/null || faltan+=("$p"); done
if (( ${#faltan[@]} )); then apt-get install -y "${faltan[@]}" >/dev/null 2>&1 || { apt-get update >/dev/null 2>&1; apt-get install -y "${faltan[@]}" >/dev/null; }; fi

# ── 1. el juego ──────────────────────────────────────────────────────────────────────────
# Lo bajado es de terceros: se abre en carpetas propias y no se ejecuta nada (los .exe son
# instaladores: innoextract y unrar los abren sin correrlos).
J="$T/juego"
if [[ -d "$JUEGO" ]]; then
  mkdir -p "$J"; cp -a "$JUEGO"/valve "$JUEGO"/cstrike "$J"/
else
  ESPERADO=81b151db95df476b07cc056f6f594a4bca771ce7e700aa13445529089ea1ad18
  [[ "$(sha256sum "$JUEGO" | cut -c1-64)" != "$ESPERADO" ]] && \
    echo "AVISO: este archivo no es el que se probó. Se sigue igual; revisar con prueba.mjs."
  mkdir "$T/rar"; unar -q -o "$T/rar" "$JUEGO"
  INST=$(find "$T/rar" -iname 'COUNTER STRIKE*.exe' | head -1)
  PARCHE=$(find "$T/rar" -iname 'PARCHE*.exe' | head -1)
  [[ -n "$INST" ]] || { echo "no está el instalador de CS en $JUEGO"; exit 1; }
  mkdir "$T/inst"; innoextract -s -d "$T/inst" "$INST"
  mkdir -p "$J"; cp -a "$T/inst/app/valve" "$T/inst/app/cstrike" "$J/"
  cp -a "$T/inst/app/reslists" "$J/" 2>/dev/null || true
  if [[ -n "$PARCHE" ]]; then
    # el SFX del parche viene cortado al final (el último .wav, de Half-Life, no se usa en CS):
    # unrar avisa y sigue con el resto
    mkdir "$T/parche"; unrar x -o+ -idq "$PARCHE" "$T/parche/" || true
    python3 -I - "$T/parche" "$J" <<'EOF'
import os, sys, shutil
src, dst = sys.argv[1], sys.argv[2]
def real(base, rel):   # las mayúsculas de lo instalado (el parche escribe "Sound", el juego "sound")
    cur = base
    for parte in rel.split('/'):
        if os.path.isdir(cur):
            parte = {n.lower(): n for n in os.listdir(cur)}.get(parte.lower(), parte)
        cur = os.path.join(cur, parte)
    return cur
n = 0
for raiz, _, archivos in os.walk(src):
    for a in archivos:
        rel = os.path.relpath(os.path.join(raiz, a), src).replace(os.sep, '/')
        d = real(dst, rel)
        os.makedirs(os.path.dirname(d), exist_ok=True)
        shutil.copyfile(os.path.join(raiz, a), d); n += 1
print(f'parche de idioma: {n} archivos')
EOF
  fi
fi
echo "juego: $(du -sh "$J" | cut -f1)"

# ── 2. Emscripten ────────────────────────────────────────────────────────────────────────
if ! command -v emcc >/dev/null; then
  if [[ ! -x "$TRABAJO/emsdk/emsdk" ]]; then
    git clone -q --depth 1 https://github.com/emscripten-core/emsdk.git "$TRABAJO/emsdk"
  fi
  "$TRABAJO/emsdk/emsdk" install "$EMSDK_VERSION" >/dev/null
  "$TRABAJO/emsdk/emsdk" activate "$EMSDK_VERSION" >/dev/null
  # shellcheck disable=SC1091
  source "$TRABAJO/emsdk/emsdk_env.sh" >/dev/null 2>&1
fi
# Emscripten baja SDL2 como .zip de GitHub; detrás de un proxy que sólo deja pasar git eso da
# 403: se clona con git y se deja en su caché con la marca que él mismo escribe al desempaquetar.
EMDIR=$(dirname "$(command -v emcc)")
SDLV=$(python3 -I -c "import re,sys; print(re.search(r\"VERSION = '([^']+)'\", open(sys.argv[1]).read()).group(1))" "$EMDIR/tools/ports/sdl2.py")
SDLURL="https://github.com/libsdl-org/SDL/archive/release-$SDLV.zip"
CACHE="$EMDIR/cache/ports/sdl2"
if [[ "$(cat "$CACHE/.emscripten_url" 2>/dev/null)" != "$SDLURL" ]] && ! curl -fsSL -o /dev/null "$SDLURL" 2>/dev/null; then
  rm -rf "$CACHE"; mkdir -p "$CACHE"
  git -c advice.detachedHead=false clone -q --depth 1 --branch "release-$SDLV" https://github.com/libsdl-org/SDL.git "$CACHE/SDL-release-$SDLV"
  rm -rf "$CACHE/SDL-release-$SDLV/.git"
  echo "$SDLURL" > "$CACHE/.emscripten_url"
fi

# ── 3. el código fijado + nuestros parches ───────────────────────────────────────────────
traer() {   # traer DIR URL COMMIT: sólo ese commit y los submódulos que él fija, sin historial
  local d=$1 url=$2 c=$3
  if ! git -C "$d" rev-parse -q --verify "$c^{commit}" >/dev/null 2>&1; then
    mkdir -p "$d"; git -C "$d" init -q
    git -C "$d" remote add origin "$url" 2>/dev/null || true
    git -C "$d" fetch -q --depth 1 origin "$c"
  fi
  git -C "$d" checkout -q -f "$c"
  git -C "$d" submodule -q update --init --recursive --depth 1 --force
  git -C "$d" submodule -q foreach --recursive 'git checkout -q -- . && git clean -qfd' >/dev/null
  git -C "$d" checkout -q -- . && git -C "$d" clean -qfd -e build -e build-web
}
X="$TRABAJO/src/xash3d-fwgs"; C="$TRABAJO/src/cs16-client"
traer "$X" "$XASH_GIT" "$XASH_COMMIT"
traer "$C" "$CS16_GIT" "$CS16_COMMIT"
git -C "$X" apply "$AQUI/parches/xash3d-fwgs.patch"
git -C "$X/3rdparty/library_suffix" apply "$AQUI/parches/xash3d-fwgs-library_suffix.patch"
git -C "$X/3rdparty/mainui" apply "$AQUI/parches/xash3d-fwgs-mainui.patch"
git -C "$C" apply "$AQUI/parches/cs16-client.patch"
git -C "$C/3rdparty/ReGameDLL_CS" apply "$AQUI/parches/cs16-client-ReGameDLL_CS.patch"
git -C "$C/3rdparty/mainui_cpp" apply "$AQUI/parches/cs16-client-mainui_cpp.patch"

# ── 4. compilar: el motor (waf) y CS (cmake), todo a WebAssembly ─────────────────────────
# Reproducible: el mismo código da los mismos bytes en cualquier máquina y carpeta (sin la ruta de
# los fuentes en __FILE__ y con la fecha de cada commit fijado en __DATE__/__TIME__). Así una
# versión nueva publicada sólo les hace bajar a los jugadores lo que de verdad cambió (pwa.py).
LOG="$TRABAJO/compilar.log"; : > "$LOG"
( cd "$X" && export SOURCE_DATE_EPOCH=$(git log -1 --format=%ct) \
    && CC=emcc CXX=em++ AR=emar CFLAGS="-ffile-prefix-map=$X=." CXXFLAGS="-ffile-prefix-map=$X=." \
    ./waf configure -T release --disable-gl --enable-gles3compat --disable-werror \
    && ./waf build -j"$(nproc)" ) >> "$LOG" 2>&1 || { tail -30 "$LOG"; exit 1; }
# ReGameDLL anota su fecha de compilación con `date` (version/appversion.sh, que la guarda en un
# appversion.h fuera de git): un `date` que da la del commit, y el .h se rearma cada vez
mkdir -p "$T/fecha"
printf '#!/bin/sh\nexec %s -u -d "@$SOURCE_DATE_EPOCH" "$@"\n' "$(command -v date)" > "$T/fecha/date"
chmod +x "$T/fecha/date"
rm -f "$C/3rdparty/ReGameDLL_CS/regamedll/version/appversion.h"
# -fvisibility=hidden: en WebAssembly los módulos comparten los nombres globales, y sin esto el
# servidor leía el gpGlobals del cliente (y el nombre de cada modelo salía basura)
( cd "$C" && export SOURCE_DATE_EPOCH=$(git log -1 --format=%ct) PATH="$T/fecha:$PATH" \
    && emcmake cmake -S . -B build-web -G Ninja -DCMAKE_BUILD_TYPE=Release -DENABLE_YY_THUNKS=OFF -DMAINUI_USE_STB=TRUE \
    -DCMAKE_C_FLAGS="-fPIC -fvisibility=hidden -ffile-prefix-map=$C=." \
    -DCMAKE_CXX_FLAGS="-fPIC -fvisibility=hidden -fvisibility-inlines-hidden -ffile-prefix-map=$C=." \
    -DCMAKE_SHARED_LINKER_FLAGS="-sSIDE_MODULE=1 --profiling-funcs" -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
    && cmake --build build-web -j"$(nproc)" ) >> "$LOG" 2>&1 || { tail -30 "$LOG"; exit 1; }

# ── 5. la carpeta web ────────────────────────────────────────────────────────────────────
W="$SALIDA/cs16"
rm -rf "$W"; mkdir -p "$W/motor" "$W/datos"
cp "$AQUI/index.html" "$AQUI/controles.js" "$W/"
cp "$H/porteo/intro.js" "$W/porteo-intro.js"
B="$X/build"; BC="$C/build-web"
cp "$B/engine/xash" "$W/motor/xash.js"
cp "$B/engine/xash.wasm" "$W/motor/"
# los módulos (.so de Emscripten: WebAssembly) van como .wasm: así el hosting los manda comprimidos
# (Cloudflare no comprime application/octet-stream): 3,0 → 1,0 MB por la red
cp "$B/filesystem/filesystem_stdio.so" "$W/motor/filesystem_stdio.wasm"
cp "$B/ref/gl/libref_gles3compat.so" "$W/motor/libref_gles3compat.wasm"
# los botones y encabezados del menú vienen dibujados con texto en inglés: sin ellos, el menú
# escribe los textos del castellano del juego (y de mainui_castellano.txt). Se rearma con fecha
# fija (la del zip original es la de cada compilación).
python3 -I - "$B/3rdparty/extras/extras.pk3" "$W/motor/extras.pk3" <<'EOF'
import re, sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as a, zipfile.ZipFile(sys.argv[2], 'w') as b:
    for i in sorted(a.infolist(), key=lambda i: i.filename):
        if i.is_dir() or re.match(r'gfx/shell/(btns_main\.bmp|head_)', i.filename):
            continue
        n = zipfile.ZipInfo(i.filename, (2000, 1, 1, 0, 0, 0))
        n.compress_type, n.external_attr = i.compress_type, 0o644 << 16
        b.writestr(n, a.read(i), compresslevel=9)
EOF
cp "$BC/cl_dll/client_emscripten_wasm32.so" "$W/motor/client.wasm"
cp "$BC/3rdparty/mainui_cpp/menu_emscripten_wasm32.so" "$W/motor/menu.wasm"
cp "$BC/3rdparty/ReGameDLL_CS/regamedll/cs_emscripten_wasm32.so" "$W/motor/server.wasm"
python3 -I "$AQUI/armar-datos.py" "$J" "$W/datos" --extras-cs "$BC/extras.pk3" --relevamiento "$AQUI/relevamiento.json"
rm -f "$W/datos/fuera.txt"
# el ícono: el de Counter-Strike del juego (cstrike.ico)
ICONO="$T/icono.png"
python3 -I - "$J/cstrike/cstrike.ico" "$ICONO" <<'EOF'
import sys
from PIL import Image
im = Image.open(sys.argv[1])
im.size = max(im.info.get('sizes', [im.size]))
im.convert('RGBA').save(sys.argv[2])
EOF

# ── 6. el .html de un solo archivo: la misma carcasa con pocos mapas, lo grande al final ──
if [[ $SIN_UN_ARCHIVO == 0 ]]; then
  U="$T/un-archivo"
  mkdir -p "$U"
  cp -r "$W/motor" "$W/index.html" "$W/controles.js" "$W/porteo-intro.js" "$U/"
  cp "$H/porteo/web.js" "$U/porteo-web.js"
  python3 -I "$AQUI/armar-datos.py" "$J" "$U/datos" --extras-cs "$BC/extras.pk3" \
      --relevamiento "$AQUI/relevamiento.json" --mapas "$UN_ARCHIVO_MAPAS"
  rm -f "$U/datos/fuera.txt"
  FINAL=()
  for f in "$U"/datos/base-*.pk3.gz "$U"/datos/mapas/*.pk3.gz; do FINAL+=(--al-final "${f#"$U"/}"); done
  python3 "$H/porteo/un-archivo.py" "$U" --salida "$SALIDA/cs16.html" "${FINAL[@]}"
fi

# ── 7. instalable (sin bajar todo al abrir), zip y APK ───────────────────────────────────
# --espera: una versión nueva no reemplaza a la vieja con el juego abierto (los paquetes que se
# bajan jugando serían de otra versión); la página la deja pasar al abrir, antes de arrancar
python3 "$H/porteo/pwa.py" "$W" --nombre "Counter-Strike 1.6" --corto "CS 1.6" \
    --orientacion landscape --icono "$ICONO" --color "#000000" \
    --perezosos 'datos/base-*' --perezosos 'datos/mapas/*' --espera
(cd "$SALIDA" && rm -f cs16-web.zip && zip -qr cs16-web.zip cs16)
if [[ $SIN_APK == 0 ]]; then
  python3 "$H/porteo/apk/armar.py" "$W" --nombre "Counter-Strike 1.6" --paquete ar.juniors.cs16 \
      --orientacion horizontal --icono "$ICONO" --version 1.6.0 --salida "$SALIDA/cs16.apk"
fi
ls -l "$SALIDA"

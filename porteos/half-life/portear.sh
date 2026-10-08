#!/usr/bin/env bash
# Half-Life (las dos copias del dueño: "Half_Life_1_(Justhin).rar", en inglés, y "Half-Life.rar",
# con el doblaje y los textos en español latino): de los RAR al porteo web y APK, en un comando.
#
#   porteos/half-life/portear.sh COPIA1.rar COPIA2.rar [CARPETA_DE_ENTREGA] [--sin-apk] [--sin-un-archivo]
#
# COPIA1 y COPIA2: los dos .rar (en cualquier orden; el que trae resource/gameui_spanish.txt es el
# español), o carpetas con valve/ adentro. Las dos son Half-Life de Steam con la actualización del
# 25 aniversario: la inglesa es la base (valve/) y de la española va lo que cambia (valve_spanish/:
# las voces dobladas, los textos y los .wad con letras), que es como Xash monta un idioma.
#
# Deja en CARPETA_DE_ENTREGA (default ./entrega-half-life):
#   half-life/         versión web (PWA): con la intro se bajan el motor y el menú; mientras se mira
#                      el menú, lo del primer nivel; cada nivel, cuando hace falta (y el siguiente,
#                      mientras se juega). En inglés o en español latino, a elección en el menú.
#   half-life-web.zip  la carpeta web comprimida, para subir a un hosting
#   half-life.apk      APK nuevo (ar.juniors.halflife), con todo adentro: anda sin internet
#   half-life.html     un solo archivo que se abre con doble clic, con los primeros capítulos
#                      ($UN_ARCHIVO_CAPITULOS): el juego entero son 168 MB
#   jugar-half-life.html  un .html de 3 KB que abre el juego publicado (porteo-half-life.pages.dev):
#                      directo, o adentro de una plataforma que muestre el archivo en un cuadro
#
# Ni el juego ni el motor están en el repo (el repo es público):
#   - los datos son de Valve: salen de las copias del dueño;
#   - el motor es Xash3D FWGS (GPL-3.0, https://github.com/FWGS/xash3d-fwgs), una
#     reimplementación abierta de GoldSrc, con los parches del porteo de CS (../cs16/parches: la
#     plataforma "emscripten", el bucle por requestAnimationFrame, WebGL2, las funciones de los
#     controles y el teclado de la página) y los de acá (parches/: los niveles que se bajan cuando
#     hacen falta, el juego en pausa mientras tanto, las voces en Opus, guardar la partida con los
#     nombres de las funciones, el menú de la web); la
#     lógica del juego es hlsdk-portable (https://github.com/FWGS/hlsdk-portable), con un cambio de
#     arma de un toque. Se bajan en los commits fijados abajo. Detalle en LEEME.md.
#
# Lo pesado se guarda en $HL_TRABAJO (default ~/.porteo/half-life): Emscripten se comparte con el
# porteo de CS si ya está (~/.porteo/cs16/emsdk), los fuentes, la compilación y los sonidos ya
# pasados a Opus (la primera vez son unos minutos; después, segundos).
set -euo pipefail
SIN_APK=0; SIN_UN_ARCHIVO=0
ARGS=()
for a in "$@"; do
  case "$a" in --sin-apk) SIN_APK=1 ;; --sin-un-archivo) SIN_UN_ARCHIVO=1 ;; *) ARGS+=("$a") ;; esac
done
UN_ARCHIVO_CAPITULOS=${UN_ARCHIVO_CAPITULOS:-c0a0,c1a0,t0a0}
USO='uso: portear.sh COPIA1.rar COPIA2.rar [SALIDA] [--sin-apk] [--sin-un-archivo]'
COPIA1=$(realpath "${ARGS[0]:?$USO}")
COPIA2=$(realpath "${ARGS[1]:?$USO}")
SALIDA=$(realpath -m "${ARGS[2]:-entrega-half-life}")
AQUI=$(cd "$(dirname "$0")" && pwd)
CS="$AQUI/../cs16"
H="$AQUI/../../herramientas"
TRABAJO=${HL_TRABAJO:-$HOME/.porteo/half-life}
XASH_GIT=https://github.com/FWGS/xash3d-fwgs.git
XASH_COMMIT=9137964147d8f749dbeddf1cb5482c3d16f86e4a   # 2026-10-04, el probado (el mismo del porteo de CS)
HLSDK_GIT=https://github.com/FWGS/hlsdk-portable.git
HLSDK_COMMIT=6c168fc79d95c8ffb934fa37aaafbbd424e03c1a  # el probado
EMSDK_VERSION=6.0.11
mkdir -p "$TRABAJO" "$SALIDA"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT

faltan=()
for p in unrar zip ffmpeg; do command -v "$p" >/dev/null || faltan+=("$p"); done
if (( ${#faltan[@]} )); then apt-get install -y "${faltan[@]}" >/dev/null 2>&1 || { apt-get update >/dev/null 2>&1; apt-get install -y "${faltan[@]}" >/dev/null; }; fi

# ── 1. el juego: las dos copias, juntas ──────────────────────────────────────────────────
# Lo bajado es de terceros: se abre en carpetas propias y no se ejecuta nada. Los RAR son RAR5
# (unar no los abre; unrar sí).
abrir() {   # abrir COPIA DESTINO → deja en DESTINO la carpeta que tiene valve/liblist.gam
  local c=$1 d=$2
  mkdir -p "$d"
  if [[ -d "$c" ]]; then cp -a "$c"/. "$d"/; else unrar x -o+ -idq "$c" "$d/"; fi
  local lib
  lib=$(find "$d" -ipath '*/valve/liblist.gam' | head -1)
  [[ -n "$lib" ]] || { echo "no hay valve/liblist.gam en $c"; exit 1; }
  dirname "$(dirname "$lib")"
}
for c in "$COPIA1" "$COPIA2"; do
  [[ -f "$c" ]] || continue
  case "$(sha256sum "$c" | cut -c1-64)" in
    008616c30a92076a7464934c4b5f685cbbaa4d94319983e1ed7e73b1eb79beba|7c53c2ca39c58a70e594c2d7f3510f5dd1f52da301850c355c996537bbfdab44) ;;
    *) echo "AVISO: $(basename "$c") no es uno de los que se probaron. Se sigue igual; revisar con prueba.mjs." ;;
  esac
done
R1=$(abrir "$COPIA1" "$T/copia1"); R2=$(abrir "$COPIA2" "$T/copia2")
if [[ -n "$(find "$R1/valve/resource" -iname 'gameui_spanish.txt' 2>/dev/null)" ]]; then ES=$R1; EN=$R2; else ES=$R2; EN=$R1; fi
[[ -n "$(find "$ES/valve/resource" -iname 'gameui_spanish.txt' 2>/dev/null)" ]] || { echo "ninguna de las dos copias trae el español (resource/gameui_spanish.txt)"; exit 1; }
J="$T/juego"
python3 -I - "$EN/valve" "$ES/valve" "$J" <<'EOF'
# la inglesa entera en valve/; de la española, lo que no está o es distinto en valve_spanish/
import filecmp, os, shutil, sys
en, es, dst = sys.argv[1:4]
def lista(raiz):
    out = {}
    for r, _, fs in os.walk(raiz):
        for f in fs:
            p = os.path.relpath(os.path.join(r, f), raiz)
            out[p.replace(os.sep, '/').lower()] = p
    return out
men, mes = lista(en), lista(es)
shutil.copytree(en, os.path.join(dst, 'valve'))
n = 0
for k, p in sorted(mes.items()):
    if k not in men or not filecmp.cmp(os.path.join(en, men[k]), os.path.join(es, p), shallow=False):
        d = os.path.join(dst, 'valve_spanish', p)
        os.makedirs(os.path.dirname(d), exist_ok=True)
        shutil.copyfile(os.path.join(es, p), d)
        n += 1
print(f'juego: {len(men)} archivos en inglés y {n} que cambian en español')
EOF
rm -rf "$T/copia1" "$T/copia2"

# ── 2. Emscripten (el mismo del porteo de CS) ────────────────────────────────────────────
if ! command -v emcc >/dev/null; then
  EMSDK=${EMSDK_DIR:-$HOME/.porteo/cs16/emsdk}
  [[ -x "$EMSDK/emsdk" ]] || EMSDK="$TRABAJO/emsdk"
  if [[ ! -x "$EMSDK/emsdk" ]]; then
    git clone -q --depth 1 https://github.com/emscripten-core/emsdk.git "$EMSDK"
  fi
  "$EMSDK/emsdk" install "$EMSDK_VERSION" >/dev/null
  "$EMSDK/emsdk" activate "$EMSDK_VERSION" >/dev/null
  # shellcheck disable=SC1091
  source "$EMSDK/emsdk_env.sh" >/dev/null 2>&1
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

# ── 3. el código fijado + los parches de CS y los nuestros ───────────────────────────────
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
X="$TRABAJO/src/xash3d-fwgs"; C="$TRABAJO/src/hlsdk-portable"
traer "$X" "$XASH_GIT" "$XASH_COMMIT"
traer "$C" "$HLSDK_GIT" "$HLSDK_COMMIT"
git -C "$X" apply "$CS/parches/xash3d-fwgs.patch"
git -C "$X" apply "$AQUI/parches/xash3d-fwgs-hl.patch"
git -C "$X/3rdparty/library_suffix" apply "$CS/parches/xash3d-fwgs-library_suffix.patch"
git -C "$X/3rdparty/mainui" apply "$CS/parches/xash3d-fwgs-mainui.patch"
git -C "$X/3rdparty/mainui" apply "$AQUI/parches/xash3d-fwgs-mainui-hl.patch"
git -C "$C" apply "$AQUI/parches/hlsdk-portable.patch"

# ── 4. compilar: el motor y el menú (waf) y el juego (cmake), todo a WebAssembly ─────────
# Reproducible: el mismo código da los mismos bytes en cualquier máquina y carpeta (sin la ruta de
# los fuentes en __FILE__ y con la fecha de cada commit fijado en __DATE__/__TIME__). Así una
# versión nueva publicada sólo les hace bajar a los jugadores lo que de verdad cambió (pwa.py).
LOG="$TRABAJO/compilar.log"; : > "$LOG"
( cd "$X" && export SOURCE_DATE_EPOCH=$(git log -1 --format=%ct) \
    && CC=emcc CXX=em++ AR=emar CFLAGS="-ffile-prefix-map=$X=." CXXFLAGS="-ffile-prefix-map=$X=." \
    ./waf configure -T release --disable-gl --enable-gles3compat --disable-werror \
    && ./waf build -j"$(nproc)" ) >> "$LOG" 2>&1 || { tail -30 "$LOG"; exit 1; }
# -fvisibility=hidden: en WebAssembly los módulos comparten los nombres globales (ver el porteo de CS).
# -Bsymbolic: lo que el SDK marca EXPORT (las funciones de think/touch/use, para guardar la partida
# por nombre) queda visible, y sin esto cada módulo pide esas funciones al cargador por nombre
# (GOT.func). El servidor y el cliente comparten muchas (hl_baseentity.cpp del cliente las tiene
# vacías) y el cargador a veces le daba al servidor las del cliente: agarrar armas o balas fallaba
# de a ratos. Con -Bsymbolic cada módulo usa las suyas.
( cd "$C" && export SOURCE_DATE_EPOCH=$(git log -1 --format=%ct) \
    && emcmake cmake -S . -B build-web -G Ninja -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_C_FLAGS="-fPIC -fvisibility=hidden -ffile-prefix-map=$C=." \
    -DCMAKE_CXX_FLAGS="-fPIC -fvisibility=hidden -fvisibility-inlines-hidden -ffile-prefix-map=$C=." \
    -DCMAKE_SHARED_LINKER_FLAGS="-sSIDE_MODULE=1 --profiling-funcs -Wl,-Bsymbolic" -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
    && cmake --build build-web -j"$(nproc)" ) >> "$LOG" 2>&1 || { tail -30 "$LOG"; exit 1; }

# ── 5. la carpeta web ────────────────────────────────────────────────────────────────────
W="$SALIDA/half-life"
rm -rf "$W"; mkdir -p "$W/motor" "$W/datos"
cp "$AQUI/index.html" "$AQUI/controles.js" "$W/"
cp "$H/porteo/intro.js" "$W/porteo-intro.js"
B="$X/build"; BC="$C/build-web"
cp "$B/engine/xash" "$W/motor/xash.js"
cp "$B/engine/xash.wasm" "$W/motor/"
# los módulos (.so de Emscripten: WebAssembly) van como .wasm: así el hosting los manda comprimidos
cp "$B/filesystem/filesystem_stdio.so" "$W/motor/filesystem_stdio.wasm"
cp "$B/ref/gl/libref_gles3compat.so" "$W/motor/libref_gles3compat.wasm"
cp "$B/3rdparty/mainui/libmenu.so" "$W/motor/menu.wasm"
cp "$BC/cl_dll/client_emscripten_wasm32.so" "$W/motor/client.wasm"
cp "$BC/dlls/hl_emscripten_wasm32.so" "$W/motor/server.wasm"
# Los botones y encabezados del menú vienen dibujados con texto en inglés: en inglés van (es el
# menú de siempre); en español, sin ellos, el menú escribe los textos del español del juego y de
# mainui_spanish.txt. Se rearman con fecha fija (la del zip original es la de cada compilación).
python3 -I - "$B/3rdparty/extras/extras.pk3" "$W/motor" <<'EOF'
import re, sys, zipfile
src, dst = sys.argv[1], sys.argv[2]
for idioma, saca in (('en', None), ('es', r'gfx/shell/(btns_main\.bmp|head_)')):
    with zipfile.ZipFile(src) as a, zipfile.ZipFile(f'{dst}/extras-{idioma}.pk3', 'w') as b:
        for i in sorted(a.infolist(), key=lambda i: i.filename):
            if i.is_dir() or (saca and re.match(saca, i.filename)):
                continue
            n = zipfile.ZipInfo(i.filename, (2000, 1, 1, 0, 0, 0))
            n.compress_type, n.external_attr = i.compress_type, 0o644 << 16
            b.writestr(n, a.read(i), compresslevel=9)
EOF
DATOS=(--relevamiento "$AQUI/relevamiento.json" --menu-es "$AQUI/mainui_spanish.txt" --cache "$TRABAJO/opus")
python3 -I "$AQUI/armar-datos.py" "$J" "$W/datos" "${DATOS[@]}"
rm -f "$W/datos/fuera.txt"
# el ícono: el de Half-Life del juego (valve/game.ico)
ICONO="$T/icono.png"
python3 -I - "$(find "$J/valve" -maxdepth 1 -iname 'game.ico' | head -1)" "$ICONO" <<'EOF'
import sys
from PIL import Image
im = Image.open(sys.argv[1])
im.size = max(im.info.get('sizes', [im.size]))
im.convert('RGBA').save(sys.argv[2])
EOF

# ── 6. el .html de un solo archivo: la misma carcasa con los primeros capítulos ──────────
if [[ $SIN_UN_ARCHIVO == 0 ]]; then
  U="$T/un-archivo"
  mkdir -p "$U"
  cp -r "$W/motor" "$W/index.html" "$W/controles.js" "$W/porteo-intro.js" "$U/"
  cp "$H/porteo/web.js" "$U/porteo-web.js"
  MAPAS=$(find "$J/valve/maps" -maxdepth 1 -iname '*.bsp' -printf '%f\n' | sed 's/\.bsp$//I' \
          | grep -iE "^($(echo "$UN_ARCHIVO_CAPITULOS" | tr ',' '|'))" | paste -sd, -)
  python3 -I "$AQUI/armar-datos.py" "$J" "$U/datos" "${DATOS[@]}" --mapas "$MAPAS"
  rm -f "$U/datos/fuera.txt"
  FINAL=()
  # lo grande va al final y el juego arranca sin esperarlo (todo menos el menú y los idiomas)
  while IFS= read -r f; do FINAL+=(--al-final "${f#"$U"/}"); done \
    < <(find "$U/datos" -name '*.pk3.gz' ! -name 'menu-*' ! -name 'idioma-*' | sort)
  python3 "$H/porteo/un-archivo.py" "$U" --salida "$SALIDA/half-life.html" "${FINAL[@]}"
fi

# ── 7. instalable (sin bajar todo al abrir), zip y APK ───────────────────────────────────
# --espera: una versión nueva no reemplaza a la vieja con el juego abierto (los paquetes que se
# bajan jugando serían de otra versión); la página la deja pasar al abrir, antes de arrancar.
# Se guardan al instalar el motor, el menú y los textos de los dos idiomas; lo demás, la primera
# vez que se usa.
python3 "$H/porteo/pwa.py" "$W" --nombre "Half-Life" --corto "Half-Life" \
    --orientacion landscape --icono "$ICONO" --color "#000000" \
    --perezosos 'datos/base-*' --perezosos 'datos/sonidos-*' --perezosos 'datos/comun/*' \
    --perezosos 'datos/mapas/*' --perezosos 'datos/musica/*' --perezosos 'datos/voces-*' --perezosos 'datos/voces-*/*' --espera
(cd "$SALIDA" && rm -f half-life-web.zip && zip -qr half-life-web.zip half-life)
cp "$AQUI/jugar-half-life.html" "$SALIDA/"
if [[ $SIN_APK == 0 ]]; then
  python3 "$H/porteo/apk/armar.py" "$W" --nombre "Half-Life" --paquete ar.juniors.halflife \
      --orientacion horizontal --icono "$ICONO" --version 1.0.0 --salida "$SALIDA/half-life.apk"
fi
ls -l "$SALIDA"

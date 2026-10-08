#!/usr/bin/env bash
# Geometry Dash (Android, RobTop): del APK del dueño al juego web, en un comando.
#
#   porteos/gd/portear.sh JUEGO.apk [CARPETA_DE_ENTREGA] [--un-archivo]
#
# Deja en CARPETA_DE_ENTREGA (default: ./entrega-gd):
#   gd/        la versión web (index.html, el motor en src/ y los datos del juego en datos/)
#   gd.html    con --un-archivo: todo en un solo .html que se abre con doble clic
#
# El motor es nuestro (src/: física de la 2.2, triggers, dibujo con WebGL 2, menús). Del APK
# salen los niveles, las hojas de dibujos, los fondos, la música y los sonidos. Cómo se dibuja
# cada objeto sale de object.json de gdclone (MPL-2.0), bajado en el commit fijado abajo.
# Nada de eso entra al repo (es público): queda en la entrega.
set -euo pipefail
UN_ARCHIVO=0
ARGS=()
for a in "$@"; do
  case "$a" in --un-archivo) UN_ARCHIVO=1 ;; *) ARGS+=("$a") ;; esac
done
APK=$(realpath "${ARGS[0]:?uso: portear.sh JUEGO.apk [SALIDA] [--un-archivo]}")
SALIDA=$(realpath -m "${ARGS[1]:-entrega-gd}")
AQUI=$(cd "$(dirname "$0")" && pwd)
H="$AQUI/../../herramientas"
GDCLONE_COMMIT=9013e0d696bc4d4d0503edc638b16f5be63f5887    # 2024-06-19, el probado
OBJECT_JSON_SHA=8794a5c8862d83780b40384c0de9b3810f7a868bc36d4ebc3ca2eb389f74aaaa
mkdir -p "$SALIDA"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT

# ── 1. el APK ────────────────────────────────────────────────────────────────
# Lo bajado es de terceros: se abre en una carpeta propia y no se ejecuta nada.
ESPERADO=51a49f68c7b241031ee66c00121d9c2f8feb74ac583f12d4b5006c47b31947b0   # GD 2.2, el probado
[[ "$(sha256sum "$APK" | cut -c1-64)" != "$ESPERADO" ]] && \
  echo "AVISO: este APK no es el que se probó. Se sigue igual; revisar con prueba.mjs y el bot."
mkdir "$T/apk"
unzip -q "$APK" 'assets/*' -d "$T/apk"
[[ -f "$T/apk/assets/levels/1.txt" ]] || { echo "el APK no trae assets/levels: ¿es Geometry Dash?"; exit 1; }

# ── 2. cómo se dibuja cada objeto (gdclone, fijado y verificado) ─────────────
OJ="$T/object.json"
curl -fsSL -o "$OJ" "https://raw.githubusercontent.com/opstic/gdclone/$GDCLONE_COMMIT/assets/data/object.json" 2>/dev/null || {
  # detrás de un proxy que sólo deja pasar git
  git -c advice.detachedHead=false clone -q --filter=blob:none --no-checkout https://github.com/opstic/gdclone.git "$T/gdclone"
  git -C "$T/gdclone" show "$GDCLONE_COMMIT:assets/data/object.json" > "$OJ"
}
[[ "$(sha256sum "$OJ" | cut -c1-64)" == "$OBJECT_JSON_SHA" ]] || { echo "object.json no es el esperado"; exit 1; }

# ── 3. los datos del juego ───────────────────────────────────────────────────
W="$SALIDA/gd"
rm -rf "$W"; mkdir -p "$W"
python3 -I "$AQUI/armar-datos.py" "$T/apk/assets" "$OJ" "$W/datos"

# ── 4. la carpeta web ────────────────────────────────────────────────────────
cp "$AQUI/index.html" "$W/"
cp -r "$AQUI/src" "$W/src"
# la intro de la marca (la moneda de JXStudios) y lo nativo del APK hecho en el navegador
cp "$H/porteo/intro.js" "$W/porteo-intro.js"
cp "$H/porteo/web.js" "$W/porteo-web.js"

# ── 5. un solo archivo ───────────────────────────────────────────────────────
if [[ $UN_ARCHIVO == 1 ]]; then
  # La música de los niveles (~17 MB) va al final, en el orden de los niveles: el menú abre con
  # lo primero (~6 MB) y cada canción llega mientras se juega. La de práctica, temprano.
  ORDEN=$(python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1])); c=[n["cancion"] for n in d["niveles"]]; c.insert(2, "StayInsideMe"); print(" ".join(c))' "$W/datos/datos.json")
  FINAL=()
  for c in $ORDEN; do FINAL+=(--al-final "datos/musica/$c.ogg"); done
  python3 "$H/porteo/un-archivo.py" "$W" --salida "$SALIDA/gd.html" "${FINAL[@]}"
fi
ls -l "$SALIDA"

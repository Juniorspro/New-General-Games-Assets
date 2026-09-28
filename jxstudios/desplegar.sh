#!/usr/bin/env bash
# JXSTUDIOS: arma jxstudios/dist (la página, los juegos, la versión web de AEROPLAZA y su APK) y lo sube a
# Cloudflare Pages, al proyecto "jxstudios" (https://jxstudios.pages.dev).
#
# LA LLAVE NO VA EN EL REPO: se lee del entorno de la sesión (la configuración del entorno en claude.ai):
#   CLOUDFLARE_API_TOKEN   token con permiso "Cloudflare Pages: Edit" (y "Account Settings: Read")
#   CLOUDFLARE_ACCOUNT_ID  el id de la cuenta (el panel de Cloudflare lo muestra a la derecha)
#
#   jxstudios/desplegar.sh           arma y sube
#   jxstudios/desplegar.sh --armar   solo arma dist/ (para mirarla sin subir: python3 -m http.server -d jxstudios/dist)
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"; RAIZ="$(cd "$AQUI/.." && pwd)"; DIST="$AQUI/dist"
PROYECTO="${JX_PROYECTO:-jxstudios}"

echo "▸ armando $DIST"
rm -rf "$DIST"; mkdir -p "$DIST/juegos" "$DIST/app" "$DIST/aeroplaza"
cp "$AQUI/index.html" "$AQUI/_headers" "$DIST/"; cp -r "$AQUI/img" "$DIST/"
# los juegos: cada uno es un solo HTML que ya está en el repo (los "con canciones" NO: esas canciones son de otros)
cp "$RAIZ/brillo/brillo.html"                "$DIST/juegos/brillo.html"
cp "$RAIZ/kuntur/kuntur.html"                "$DIST/juegos/kuntur.html"
cp "$RAIZ/zonda/zonda.html"                  "$DIST/juegos/zonda.html"
cp "$RAIZ/luz-mala/luz-mala.html"            "$DIST/juegos/luz-mala.html"
cp "$RAIZ/ruta40/ruta40.html"                "$DIST/juegos/ruta40.html"
cp "$RAIZ/bosque/bosque-en-un-archivo.html"  "$DIST/juegos/bosque.html"
# la APK sin canciones (la --canciones es solo para el dueño). No va al repo. Se usa, en este orden:
#   1. la compilada en esta sesión (aeroplaza/pruebas/salida/aeroplaza.apk), si es más nueva que la fuente;
#   2. si hay ANDROID_HOME, se compila;
#   3. si no, la que ya está publicada (cada despliegue de Pages sube todo: si no se la pone, desaparece).
#   (se mira antes de armar el HTML, que lo reescribe y lo haría parecer más nuevo)
APK="$RAIZ/aeroplaza/pruebas/salida/aeroplaza.apk"
VIEJA=""
if [ ! -f "$APK" ] || [ -n "$(find "$RAIZ/aeroplaza/js" "$RAIZ/aeroplaza/css" "$RAIZ/aeroplaza/android/app/src" -type f -newer "$APK" -print -quit)" ]; then VIEJA=1; fi
# AEROPLAZA en el navegador: la versión web (sin canciones), armada de la fuente
( cd "$RAIZ/aeroplaza" && node herramientas/armar.mjs >/dev/null )
cp "$RAIZ/aeroplaza/dist/aeroplaza-web.html" "$DIST/aeroplaza/index.html"
# (el aviso de las actualizaciones de la APK: Actualizador.java también lo busca acá)
[ -f "$RAIZ/aeroplaza/actualizacion.json" ] && cp "$RAIZ/aeroplaza/actualizacion.json" "$DIST/aeroplaza/actualizacion.json"
if [ -n "$VIEJA" ] && [ -n "${ANDROID_HOME:-}" ]; then ( cd "$RAIZ/aeroplaza" && node herramientas/apk.mjs | tail -1 ); VIEJA=""; fi
if [ -z "$VIEJA" ]; then cp "$APK" "$DIST/app/aeroplaza.apk"
elif curl -sSfL -o "$DIST/app/aeroplaza.apk" "https://$PROYECTO.pages.dev/app/aeroplaza.apk" && [ "$(head -c 2 "$DIST/app/aeroplaza.apk")" = "PK" ]; then
  echo "  (la APK: la que ya estaba publicada; para una nueva, compilala con ANDROID_HOME)"
else echo "✗ no hay APK: ni compilada, ni ANDROID_HOME para compilarla, ni una publicada para reusar"; exit 1; fi
# (Pages no acepta archivos de más de 25 MiB)
GRANDE=$(find "$DIST" -type f -size +25M)
if [ -n "$GRANDE" ]; then echo "✗ más de 25 MiB (Pages no lo sube): $GRANDE"; exit 1; fi
# el tamaño de la APK que dice la página tiene que ser el de verdad
MB=$(python3 -c "import os;print(f'{os.path.getsize(\"$DIST/app/aeroplaza.apk\")/1048576:.1f}'.replace('.',','))")
grep -q "<small>$MB MB</small>" "$DIST/index.html" || { echo "✗ la página dice otro tamaño de APK (es $MB MB): cambialo en index.html"; exit 1; }
du -sh "$DIST" | awk '{print "  dist: " $1}'
[ "${1:-}" = "--armar" ] && exit 0

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "✗ falta CLOUDFLARE_API_TOKEN en el entorno. Se carga en la configuración del entorno de claude.ai (no en el chat ni en el repo)."
  exit 1
fi
cd "$DIST"
# (la primera vez el proyecto no existe: se crea con la rama main como producción)
if ! npx --yes wrangler pages project list 2>/dev/null | grep -q "\b$PROYECTO\b"; then
  npx --yes wrangler pages project create "$PROYECTO" --production-branch main
fi
npx --yes wrangler pages deploy . --project-name "$PROYECTO" --branch main --commit-dirty=true | tail -4
URL="https://$PROYECTO.pages.dev"
sleep 3
for p in "" "juegos/zonda.html" "aeroplaza/" "app/aeroplaza.apk"; do
  printf "  %-24s %s\n" "/$p" "$(curl -sS -o /dev/null -w '%{http_code} %{content_type}' "$URL/$p")"
done
echo "✓ $URL"

#!/bin/sh
# Avisa a los buscadores que el sitio cambio, por IndexNow.
#
# POR QUE EXISTE: el boton «Solicitar indexacion» de Google Search Console
# tiene un tope de unas diez URL por dia POR PROPIEDAD, se reinicia a
# medianoche y NO se puede comprar mas. IndexNow no tiene tope publicado y es
# un solo pedido. Lo respetan Bing, Yandex, Seznam y Naver —y con Bing entran
# tambien DuckDuckGo, Ecosia y los buscadores con IA que usan su indice—.
#
# GOOGLE NO USA INDEXNOW. Para Google la via sigue siendo el sitemap. Esto no
# lo reemplaza: lo complementa, y cubre a todos los demas.
#
# La clave no es un secreto: se publica en el propio sitio y esa publicacion ES
# la prueba de propiedad. Quien pueda escribir en el dominio puede avisar por
# el dominio, y nadie mas.
#
#   ./avisar-buscadores.sh
set -e
cd "$(dirname "$0")"

# `basename a.txt b.txt .txt` no hace lo que parece: con varios archivos toma
# el segundo como sufijo. Se listan los nombres y se filtra por la forma.
CLAVE=$(ls docs/paginas/ | sed -n 's/^\([0-9a-f]\{32\}\)\.txt$/\1/p' | head -1)
[ -n "$CLAVE" ] || { echo "no encuentro el archivo de clave en docs/paginas/"; exit 1; }
HOST=iblo-eventos.pages.dev

# 1. la clave tiene que estar publicada, si no el aviso se rechaza entero
COD=$(curl -s -o /tmp/clave-publicada -w '%{http_code}' "https://$HOST/$CLAVE.txt")
if [ "$COD" != "200" ] || [ "$(cat /tmp/clave-publicada)" != "$CLAVE" ]; then
  echo "la clave no esta publicada en https://$HOST/$CLAVE.txt (dio $COD)."
  echo "Hay que desplegar el sitio primero: ./armar-sitio.sh y wrangler."
  exit 1
fi
echo "clave publicada . $CLAVE"

# 2. las URL salen del sitemap, para que no haya dos listas que se desincronicen
URLS=$(curl -s "https://$HOST/sitemap.xml" \
  | grep -o '<loc>[^<]*</loc>' | sed 's|</\?loc>||g')
echo "$URLS" | sed 's/^/   /'

CUERPO=$(printf '%s\n' "$URLS" | python3 -c '
import json, sys
urls = [l.strip() for l in sys.stdin if l.strip()]
print(json.dumps({"host": "'"$HOST"'", "key": "'"$CLAVE"'",
                  "keyLocation": "https://'"$HOST"'/'"$CLAVE"'.txt",
                  "urlList": urls}))')

COD=$(curl -s -o /tmp/indexnow-resp -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json; charset=utf-8' \
  --data "$CUERPO" https://api.indexnow.org/IndexNow)

case "$COD" in
  200|202) echo "avisado . $COD (202 = en cola, es lo normal)" ;;
  400) echo "400 . el cuerpo esta mal armado"; cat /tmp/indexnow-resp; exit 1 ;;
  403) echo "403 . la clave no coincide con la publicada"; exit 1 ;;
  422) echo "422 . alguna URL no pertenece a $HOST"; cat /tmp/indexnow-resp; exit 1 ;;
  429) echo "429 . demasiados avisos seguidos, esperar" ; exit 1 ;;
  *)   echo "respuesta inesperada: $COD"; cat /tmp/indexnow-resp; exit 1 ;;
esac

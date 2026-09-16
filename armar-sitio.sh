#!/bin/sh
# Arma la carpeta que se sube a Cloudflare Pages, a partir de docs/paginas/.
#
# Existe porque estos tres pasos no son obvios y una vez ya se perdieron:
#
#   1. `docs/paginas/index.html` es el índice del REPO, no la portada del sitio.
#      Si se copia tal cual, iblo-eventos.pages.dev muestra «Páginas del repo».
#      La portada es `iblo.html`, que además detecta sola si el que entra está en
#      teléfono y lo manda a la versión de celular.
#   2. Las funciones de la API viven en `functions/api/`, no en `api/`.
#   3. `wrangler` sólo compila las funciones si se lo corre PARADO ADENTRO de la
#      carpeta. Si en la salida no dice «Compiled Worker successfully», las rutas
#      de la API van a contestar 405.
#
# Uso:  ./armar-sitio.sh  &&  cd sitio  &&  wrangler pages deploy . --project-name iblo-eventos --branch main
set -e
cd "$(dirname "$0")"

rm -rf sitio
mkdir -p sitio
cp -r docs/paginas/. sitio/

# la portada del sitio, no el índice del repo
cp docs/paginas/iblo.html sitio/index.html

# la API pasa a ser funciones de Pages
mkdir -p sitio/functions
mv sitio/api sitio/functions/api
rm -f sitio/functions/api/LEEME.md      # las notas no se publican

# funciones que no son de la API: hoy, la verificacion de Search Console, que
# necesita contestar 200 en una direccion terminada en .html —y Pages le saca
# la extension a los archivos, asi que como archivo no se puede
if [ -d sitio/_funciones ]; then
  cp sitio/_funciones/*.js sitio/functions/ 2>/dev/null || true
  rm -rf sitio/_funciones
fi

# LAS FECHAS DEL SITEMAP, sacadas de git y no escritas a mano.
#
# De todo lo que lleva un sitemap, Google mira una sola cosa: `lastmod`. Y si
# todas las direcciones dicen la misma fecha de hace meses, aprende que este
# sitemap no dice la verdad y le deja de creer; a partir de ahi publicar algo
# nuevo no le avisa a nadie. Asi que la fecha de cada pagina es la del ultimo
# commit que toco SU archivo. La otra mitad —cuando cambiaron los datos que la
# pagina muestra— la pregunta la funcion a la base, en cada pedido.
#
# El sitemap deja de ser un archivo: lo arma `functions/sitemap.xml.js`. Por eso
# se borra el estatico, para que no haya dos y se sirva el equivocado.
rm -f sitio/sitemap.xml
{
  echo "/* Generado por armar-sitio.sh. La fecha del ultimo commit que toco cada"
  echo "   pagina, en milisegundos. No editar a mano: se pisa al publicar. */"
  echo "export const FECHAS = {"
  for f in iblo iblo-publicaciones iblo-esteticas iblo-servicios iblo-archivo iblo-reels; do
    # `git log -1` da la fecha del ultimo cambio de ESE archivo; si el archivo
    # todavia no esta en git (recien creado), vale la fecha de ahora
    seg=$(git log -1 --format=%ct -- "docs/paginas/$f.html" 2>/dev/null || true)
    [ -n "$seg" ] || seg=$(date +%s)
    ruta=$f
    [ "$f" = "iblo" ] && ruta=""          # iblo.html es la portada, o sea «/»
    echo "  \"$ruta\": ${seg}000,"
  done
  echo "};"
} > sitio/functions/_fechas.js

echo "sitio/ armado. Portada: $(grep -o '<title>[^<]*</title>' sitio/index.html | head -1)"
echo "Ahora:  cd sitio && npx wrangler pages deploy . --project-name iblo-eventos --branch main --commit-dirty=true"

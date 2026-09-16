# Dónde vive cada cosa

## Cloudflare Pages

Cuenta `Holasoyjuniors365@gmail.com` · account id `65d82a1d3c6b280cf892511df2900a99`.

| Proyecto | URL |
|---|---|
| `iblo-eventos` | https://iblo-eventos.pages.dev |

Se despliega subiendo la carpeta ya armada, sin build. Con un comando:

```sh
export CLOUDFLARE_API_TOKEN=...        # token de cuenta, NUNCA al repo
export IBLO_CLAVE=...                  # la del panel, sólo la primera vez
./desplegar-iblo.sh
```

`desplegar-iblo.sh` arma la carpeta, despliega, **espera a que `/api/sitio`
conteste 200** —que es la única prueba de que las funciones compilaron: si
contestan 405 no compilaron— carga el contenido inicial la primera vez y
comprueba que las páginas sigan sirviendo. A mano son los mismos dos pasos:

```sh
./armar-sitio.sh                       # arma sitio/ desde docs/paginas/
cd sitio && npx wrangler pages deploy . --project-name=iblo-eventos --branch=main --commit-dirty=true
```

**Usá el script, no copies la carpeta a mano.** Tiene tres pasos que no se
adivinan y que ya se perdieron una vez, con la portada del sitio rota como
resultado:

- `docs/paginas/index.html` es el índice del **repo**, no la portada. Copiado tal
  cual, `iblo-eventos.pages.dev` muestra «Páginas del repo» en vez del sitio. La
  portada es `iblo.html`, que además detecta sola si el que entra está en teléfono
  y lo manda a `/m/iblo`.
- La API va en `functions/api/`, no en `api/`.
- `wrangler` compila las funciones sólo si se lo corre **parado adentro** de la
  carpeta. Si no dice «Compiled Worker successfully», la API contesta 405.

El token necesita la política **Account → Cloudflare Pages → Edit**. Con sólo *Read*
la creación del proyecto devuelve `Authentication error` (código 10000), que
despista porque no dice que falte un permiso.

### Detalles que costaron averiguar

- Pages **saca la extensión `.html`**: `/iblo.html` responde 308 a `/iblo`. Los
  enlaces internos con `.html` siguen andando, sólo suman un salto.
- Sirve los `.mp4` y `.webm` con su tipo correcto y acepta *range requests*, así que
  los videos se pueden adelantar. githack no: redirige a `raw.githubusercontent.com`,
  que los manda como `application/octet-stream` y el `<video>` no los reproduce.
- `_headers` en la raíz de la carpeta agrega CORS y caché a `/reels/*`.
- Plan gratis: despliegues y ancho de banda ilimitados, 500 builds al mes (no
  aplican cuando se sube la carpeta hecha), 25 MB por archivo, 20.000 archivos.

## Espejo en githack

Sirve cualquier ruta del repo como `text/html`, útil como respaldo:
`https://rawcdn.githack.com/Juniorspro/General-Assets-Games/<rama>/<ruta>`
(cachea 24 h; `raw.githack.com` en vez de `rawcdn.` para ver el último cambio).
Para videos no sirve, ver arriba.

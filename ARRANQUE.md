# Arranque — para una sesión nueva

Esto es lo que una sesión nueva necesita saber para no repetir las vueltas que
ya se dieron. Está escrito para que lo lea otra IA al empezar, pero se entiende
igual.

**Regla de oro de este repo: todo lo que se afirma acá está medido.** Si algo
dice "anda", es porque se corrió. Si no se pudo probar, lo dice.

> **Este documento dice CÓMO SE TRABAJA acá.** El de al lado, `ESTADO.md`, dice
> **QUÉ HAY CONSTRUIDO**: cada página, cada endpoint, cada tabla, cada decisión
> de los dos sitios. Una sesión nueva no los lee enteros: empieza por
> `memoria/INDICE.md`, que dice qué sección abrir.

---

## 1. La máquina (la "PC virtual")

Es un contenedor en la nube, no la computadora de nadie. Arranca con el repo ya
clonado y **se borra cuando termina la sesión**.

### Lo que eso implica (y muerde)

- **Lo que no se commitea, se pierde.** Archivos en `/tmp`, bases locales,
  paquetes instalados: todo. Si algo vale la pena, va al repo.
- **`npx wrangler` se reinstala en cada sesión** y tarda 1-2 minutos la primera
  vez. Si un comando parece colgado, es eso. Esperalo.
- **El disco es una cuota fija.** `df` miente: "Avail" en 0 con poco "Used"
  quiere decir que se acabó la cuota, no que la máquina esté rota. Borrar
  archivos grandes libera espacio al instante.
- **No hay SDK de Android** y no entra (pesa 2-3 GB, quedan ~2,4 GB). O sea:
  **acá no se puede compilar un APK.** Si hace falta una app, se hace web.

### Lo que sí está puesto

| cosa | dónde / cómo |
|---|---|
| Chromium para Playwright | `/opt/pw-browsers/chromium` |
| Node | v22 |
| Python 3 | Pillow **no** viene: `pip install pillow` |
| git | el repo ya está clonado y en su rama |
| docker | el binario está, `dockerd` hay que arrancarlo a mano |

**Nunca corras `npx playwright install`.** La versión que baja no coincide con
la que está y falla con *"Executable doesn't exist"*. Siempre:

```js
chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
```

### La red

Sale por un proxy. Dos consecuencias que cuestan una tarde si no se saben:

1. **`curl` llega a internet. Chromium NO llega a hosts externos.** O sea que
   las pruebas de navegador se corren contra `localhost`, nunca contra el sitio
   publicado. Para verificar producción se usa `curl`.
2. Si algo falla con TLS o da 403/407 del proxy, está documentado en
   `/root/.ccr/README.md`. **Nunca** desactivar la verificación de TLS ni sacar
   `HTTPS_PROXY`.

### Un detalle bobo que rompe comandos encadenados

```bash
pkill -f "pages dev"     # sale con código 144 y aborta el resto de la línea
```

Corrélo solo, nunca con `&&` detrás.

---

## 2. Qué hay en el repo

Dos sitios que andan, publicados en Cloudflare Pages:

| sitio | carpeta | dirección |
|---|---|---|
| **Frutiger Aero** | `frutiger-aero/` | frutiger-aero-86q.pages.dev |
| **IBLO Eventos** | `docs/paginas/` | iblo-eventos.pages.dev |

El resto de la raíz son assets (modelos 3D, texturas, audio). No hace falta
tocarlos.

---

## 3. Frutiger Aero

Un escritorio estilo Windows Vista adentro del navegador, con cuentas, muro
social, zona de donantes y tienda de apps.

### Cómo se despliega

```bash
cd frutiger-aero
export CLOUDFLARE_API_TOKEN=$(cat /root/.cloudflare-iblo)
npx wrangler pages deploy --branch main      # OJO: --branch main o va a preview
```

**Sin `--branch main` va a un despliegue de vista previa**, que además no tiene
los secretos cargados y contesta `{"error":"sin configurar"}` en todo. Si ves
eso, es esto.

### El sellado de archivos: `sellar.py`

Le pone el hash del contenido en el nombre a `aero.css`, `escritorio.js`,
`social.js` y `tema.mp3`, y arregla las referencias en el HTML.

```bash
python3 sellar.py     # correr SIEMPRE después de editar css o js
```

**La trampa:** los archivos en `sitio/js/` y `sitio/css/` **ya tienen el hash en
el nombre** (`escritorio.a1b2c3d4.js`). Se edita ese archivo, y después
`sellar.py` lo renombra al hash nuevo. Si escribís a `escritorio.js` (sin hash)
creás un archivo huérfano que no sirve nadie. Para saber cuál editar:

```bash
ls frutiger-aero/sitio/js/
```

### La base de datos (Cloudflare D1)

Se llama `frutiger-social`. El esquema son archivos numerados que se aplican
**en orden**: `esquema.sql`, `esquema2.sql`, … `esquema12.sql`.

```bash
# produccion
npx wrangler d1 execute frutiger-social --remote --file=esquema12.sql
# local (para probar)
npx wrangler d1 execute frutiger-social --local --file=esquema12.sql
```

Cada archivo tiene arriba un comentario que dice **por qué existe**. Leerlos es
la forma más rápida de entender el sistema.

Los esquemas nuevos van en un archivo nuevo, nunca editando uno viejo: los
viejos ya corrieron en producción.

### Los enlaces de `wrangler.toml`

```toml
[[d1_databases]]  binding = "DB"    # la base
[ai]              binding = "AI"    # Workers AI, para la fábrica de fondos
```

**Sin declararlos acá, `env.DB` y `env.AI` llegan vacíos** y las funciones
contestan 503 "sin configurar" — un error dificilísimo de adivinar mirando el
código, porque el código está bien.

Y ojo con este comentario que ya está en el toml: **con `wrangler.toml` puesto,
las funciones se buscan en `functions/` AL LADO del toml, no adentro de
`sitio/`.** Moverlas rompe toda la API sin avisar.

### Cómo está partido

```
frutiger-aero/
  wrangler.toml          enlaces: DB (D1) y AI (Workers AI)
  sellar.py              pone el hash en los nombres
  esquema*.sql           el esquema, en orden
  pruebas/               71 comprobaciones con navegador (ver §7)
  functions/
    api/
      _social.js         sesiones, validación, el helper json()
      _firma.js          pases firmados (HMAC), códigos
      _llave.js          llaves de acceso (WebAuthn)
      acceso.js          cobra el acceso: PayPal / Mercado Pago / código
      pagar.js           arma la orden de pago
      aeromas.js         la zona de donantes
      tienda.js          el catálogo de apps
      editor.js          la cuota mensual para publicar apps pagas
      fabrica.js         genera fondos con IA
      muro.js, avisos.js, cuenta.js, visitas.js, …
    apps/[[archivo]].js  la puerta de las descargas
  sitio/                 lo que se publica
    index.html           todo el escritorio en una página
    js/escritorio.*.js   el escritorio, ventanas, Aero+
    js/social.*.js       muro, perfil, avisos, llaves
    css/aero.*.css
```

### Quién puede qué

- `usuarios.acceso = 1` → donó, entra a Aero+, la fábrica y la tienda.
- `usuarios.jefe = 1` → el dueño. Entra a todo **sin donar**, carga la tienda,
  aprueba apps de la comunidad y da cuotas a mano.
- `usuarios.bloqueado = 1` → **le gana a todo**, incluso a ser jefe.

---

## 4. IBLO Eventos

Un sitio de eventos con panel de administración. Vive en `docs/paginas/`.

```bash
export CLOUDFLARE_API_TOKEN=$(cat /root/.cloudflare-iblo)
./desplegar-iblo.sh      # arma, despliega y verifica, en un comando
```

`armar-sitio.sh` hace tres cosas que **no se adivinan** (están explicadas arriba
del propio script):

1. La portada es `iblo.html`, no `index.html` — `index.html` es el índice del
   repo. Copiarlo tal cual publica "Páginas del repo" como portada.
2. Las funciones van en `functions/api/`, no en `api/`.
3. **`wrangler` sólo compila las funciones si se lo corre parado ADENTRO de la
   carpeta.** Si la salida no dice *"Compiled Worker successfully"*, no
   compilaron y toda la API va a dar 404.

---

## 5. Los secretos

**Regla dura: ningún secreto entra al repo. Nunca. Ni en un comentario, ni en un
mensaje de commit, ni en un archivo de ejemplo.**

Viven fuera del repo, con permisos 600:

| archivo | qué es |
|---|---|
| `/root/.cloudflare-iblo` | token de Cloudflare (despliegues y D1) |
| `/root/.paypal-frutiger-id` / `-secret` | PayPal **en vivo** |
| `/root/.discord-frutiger-id` / `-secret` | Discord OAuth |
| `~/.rezona/credentials.json` | Rezona Lab |
| `frutiger-aero/.dev.vars` | secretos de desarrollo local (gitignoreado) |

Los de producción están cargados como **secretos de Cloudflare Pages**: se
escriben, no se leen. Si necesitás uno, se vuelve a cargar, no se recupera.

**Después de cada commit, comprobalo:**

```bash
git grep -nI "cfat_\|sk-\|-----BEGIN"    # que no devuelva nada
```

Y si un secreto pasó por el chat alguna vez, **hay que rotarlo**: el chat no es
un lugar seguro para guardar nada.

---

## 6. Rezona Lab (generar assets)

Es un servidor MCP para generar imágenes, sprites, audio y modelos 3D.

### El ciclo

1. `create_project` (o `list_projects`) — **todo lo demás pide un id de
   proyecto**.
2. `submit_image_generation` / `submit_sprite_generation` / etc. — devuelve un
   `task_id` al instante. **Todavía no hay nada en disco.**
3. `check_generation_tasks` — consultar hasta que diga `ready` o `failed`. No
   consultar en bucle cerrado.
4. `fetch_generated_asset` — recién acá el archivo aparece en disco.

### Las trampas, que son cuatro y todas cuestan créditos

- **`fetch_generated_asset` hay que correrlo parado en una carpeta que tenga
  `.rezona/` adentro.** Si no, no sabe a qué proyecto pertenece.
- **El `output_path` que se usa es el de la RESPUESTA, no el que mandaste.** El
  servidor le agrega el número de generación: pediste `assets/heroe.png` y te
  devuelve `assets/heroe-g1.png`. Usar el que mandaste no encuentra nada.
- **`size` respeta la PROPORCIÓN, no el número.** Pedís 1536x672 y te da
  1376x768. Si necesitás una medida exacta, redimensionás vos después con
  Pillow.
- **Para fondo transparente de verdad hay que pedir `transparent: true`.** Sin
  eso viene con fondo aunque el prompt diga "sin fondo".

### Cómo pedir para que salga bien

- **Negá lo que no querés**, no sólo pidas lo que querés: "NOT dark",
  "no text, no watermark". Es lo que más mejora el resultado.
- Para generar a partir de algo ya generado (imagen a imagen, referencia 3D),
  se pasa el `public_url` que devolvió `fetch_generated_asset` como
  `source_url`. Esa URL **es pública**: tratala como compartible, no como
  secreta.
- Cada `submit_*` **gasta créditos**. Crear proyectos, consultar y descargar es
  gratis.

### Lo que puede no estar

El MCP de Rezona **puede no estar conectado** en una sesión. Si las herramientas
no aparecen, no hay forma de generar assets: decilo y seguí con lo que haya, no
lo simules.

---

## 7. Cómo se prueba acá

En `frutiger-aero/pruebas/` hay **71 comprobaciones** con navegador de verdad.

```bash
./pruebas/preparar.sh                          # base local, cuentas, pases
npx wrangler pages dev --port 8788 --local     # dejalo corriendo aparte
cd pruebas && node navegacion.mjs              # y las demás
```

Leé `pruebas/README.md`: tiene las cuatro lecciones que costaron encontrar.

### Lo que hay que entender de probar en el navegador

**Que un elemento exista no quiere decir que se pueda tocar.** Un botón puede
estar en el DOM, medir 44x21 y no recibir un solo toque porque otra capa lo
tapa. Así apareció el peor bug de este sitio: la cruz de cerrar las ventanas
estaba tapada por la barra de arriba, y tocarla abría el menú del perfil. Se
comprueba así:

```js
document.elementFromPoint(x, y)   // ¿devuelve TU elemento?
```

**No calcules coordenadas para hacer clic.** La página se sigue acomodando
después de cargar, así que el rect que mediste ya es viejo cuando llega el
mouse. Usá `locator.hover()` (espera a que esté quieto) o disparale los eventos
de puntero directo al elemento.

**Que cada prueba se arme su propio dato.** Dos veces pasó lo mismo: una prueba
daba por hecho algo que había dejado otra corrida, y entonces pasaba o fallaba
según el orden. Una prueba así miente en las dos direcciones.

**Y el aviso más importante: un resultado raro suele ser la prueba, no el
código.** Pasó con duraciones de 112 segundos que eran ids reusados entre
corridas. Antes de "arreglar" algo, comprobá que lo que medís sea lo que creés.

---

## 8. Trampas ya pagadas (no las vuelvas a pagar)

### Cloudflare Pages

- **Una Función en una ruta corre ANTES que el archivo estático de esa ruta.**
  `context.next()` trae el archivo. Así se pone una puerta de verdad delante de
  un archivo estático.
- **`_headers` NO se aplica a las respuestas de una Función**, sólo a archivos
  estáticos. Una cabecera de seguridad puesta ahí para la API se ve en el código
  y no existe en la respuesta: la peor clase de protección. Va en un
  `_middleware.js`.
- **Un archivo borrado sigue sirviéndose desde el caché del borde** (~23 h).
  Para comprobar de verdad, mirá la URL del despliegue específico.

### Base de datos (D1)

- Tope de **~1 MB por fila**. Por eso los fondos generados se guardan en JPEG y
  no en PNG.
- **Extender una suscripción NO es idempotente.** Si el efecto es "poner
  acceso = 1", da igual repetirlo. Si el efecto es "sumar 30 días", repetirlo
  regala un mes por cada recarga de página. Se resuelve con una columna `ref`
  **única** y sumando sólo si la inserción agregó una fila de verdad.
- El esquema local se desincroniza fácil y produce fallas que **no parecen lo
  que son**: falta una columna → 500 en `/api/cuenta` → la pantalla se queda sin
  sesión → una prueba falla con 401. Nada de eso menciona la columna.

### Navegador

- **Un `<img>` y un `<a>` no pueden mandar cabeceras.** Si la sesión va en
  `Authorization`, todas las imágenes dan 403 con la pantalla entera pintada.
  Solución: un pase firmado, corto y con marca propia, en la dirección.
- **`url()` adentro de una variable CSS se resuelve desde la hoja donde la
  variable SE USA**, no desde el documento. De ahí salen 404 en `/css/img/…`.
- **`background-attachment: scroll` dimensiona `cover` contra el alto del
  contenido**, no del viewport. Necesita `min-height: 100svh`.
- **Una var al final de un IIFE es `undefined`** para el código de arriba que ya
  corrió. Si una comprobación tiene que valer siempre, ponela adentro de la
  función.
- **El z-index no alcanza contra elementos `sticky` de otro contexto de
  apilamiento.** Si algo tapa a algo, muchas veces la respuesta correcta es
  correrlo, no subirle el número.
- **Las firmas ECDSA de WebAuthn vienen en DER y WebCrypto quiere r||s crudo.**
  Sin convertirlas no verifica nada y **no da ningún error**.

### PayPal

- Cobra un **fijo por operación** (unos 30 centavos) más un porcentaje. Abajo de
  US$ 1 estás poniendo plata para cobrar. El mínimo del sitio es US$ 1 por eso.
- Hay **modo sandbox** (`PAYPAL_MODO=sandbox`): plata falsa, cero costo. Es la
  forma de probar el cobro sin gastar.
- El servidor **captura** la orden con sus credenciales y comprueba tres cosas:
  que quede `COMPLETED`, que la plata haya ido a **nuestra** cuenta, y que
  llegue al mínimo. Creerle al navegador es regalar el acceso.

---

## 9. Cómo trabajar acá

- **Los comentarios explican POR QUÉ, no qué.** Casi todos los de este repo
  cuentan un bug real que pasó. Son la memoria del proyecto: escribilos igual.
- **Todo en castellano rioplatense**, código y comentarios incluidos.
- **Medí antes de afirmar.** "Anda" sin un número al lado no vale.
- **Decí lo que no se pudo hacer**, con el motivo concreto. Un límite dicho a
  tiempo vale más que una promesa.
- **Nunca pongas el identificador del modelo** en commits, código ni nada que
  vaya al repo.
- Rama de trabajo: la que da cada sesión, en el repo
  `Juniorspro/New-General-Games-Assets` (fueron
  `claude/repo-session-change-m7f12k` y después `claude/fijate-iszyer`).
  Commit, push, y desplegar.
- **El repo cambió.** El viejo era `Juniorspro/General-Assets-Games`, rama
  `claude/patron-2-93yeb9`: ahí quedaron los 487 MB de binarios sueltos y
  `splat-ciudad/`. Acá está el código y la documentación.

---

## 10. Lo que quedó pendiente

| pendiente | qué falta | quién |
|---|---|---|
| Revisión antivirus de las apps | una llave de VirusTotal (gratis, con email) | el dueño |
| Subir APKs al propio sitio | habilitar R2 en el panel de Cloudflare | el dueño |
| Probar el cobro de la cuota | credenciales de PayPal **sandbox** | el dueño |
| Entrar con Google | un proyecto de Google Cloud (pide ser mayor) | trabado |
| Rotar la clave de la app de IBLO | pasó por el chat | el dueño |
| IA de respaldo en IBLO | agregar Groq o Gemini como alternativa | se puede |
| Publicaciones duplicadas en IBLO | ids 21 y 22 se muestran dos veces | se puede |

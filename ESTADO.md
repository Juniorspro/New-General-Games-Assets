# Estado — todo lo que hay construido

Inventario completo de los dos sitios: qué existe, dónde vive, cómo funciona y
por qué está hecho así.

> **Este documento dice QUÉ HAY.** El de al lado, `ARRANQUE.md`, dice **CÓMO SE
> TRABAJA** acá: la máquina, las herramientas, Rezona Lab y las trampas que ya
> costaron una tarde cada una. Una sesión nueva no los lee enteros: empieza
> por `memoria/INDICE.md`, que dice qué sección abrir.

Todos los números de acá están medidos contra la base de producción, no
estimados.

---

## De un vistazo

| | Frutiger Aero | IBLO Eventos |
|---|---|---|
| qué es | un escritorio tipo Windows Vista adentro del navegador, con cuentas, red social, zona de donantes y tienda de apps | el sitio de una productora de eventos, con panel de administración propio |
| dirección | frutiger-aero-86q.pages.dev | iblo-eventos.pages.dev |
| carpeta | `frutiger-aero/` | `docs/paginas/` |
| base de datos | `frutiger-social` (D1) | `iblo` (D1) |
| páginas | 3 | 12 públicas + el panel |
| endpoints | 25 | 27 |
| tablas | 12 | 16 |

Los dos corren en **Cloudflare Pages**: archivos estáticos + Functions
(JavaScript en el borde) + D1 (SQLite). Plan gratuito.

---

# FRUTIGER AERO

Un escritorio completo adentro de una sola página. Estética "Frutiger Aero": el
vidrio, el agua y las burbujas con las que a principios de los 2000 se imaginaba
que iba a ser el futuro.

## Las pantallas

| archivo | qué es |
|---|---|
| `sitio/index.html` | **todo**: el ingreso, el escritorio, las ventanas, Aero+ |
| `sitio/solicitudes.html` | panel del dueño: aprobar accesos, generar códigos, ver visitas |
| `sitio/404.html` | "Acá no hay nada" |

`/admin` ya no existe: se borró y quedó una redirección a `/solicitudes`.

## El escritorio, por dentro

`sitio/js/escritorio.*.js` está partido en secciones numeradas:

1. **La sesión** — quién entró, el retrato, entrar y salir
2. **Las ventanas** — abrir, cerrar, **arrastrar**, y la pila de pantallas
3. **El panel de control** — tono, saturación, vidrio, fondo, burbujas
4. **El buscaminas** — un juego de verdad, no un cartel
5. **Reloj y burbujas** — el ambiente
6. **Colaborar** — la ventana de donación
7. **Zona de donantes** — la lista de quién colaboró
8. **Cobro automático** — PayPal y Mercado Pago adentro de la página
9. **Aero+** — la interfaz de donantes, a pantalla completa
10. **El escritorio en el teléfono** — íconos, muelle, apps a pantalla completa
11. **El latido** — cuánta gente hay adentro, ahora

`sitio/js/social.*.js` lleva el muro, el perfil, los avisos y las llaves de
acceso. `sitio/js/mascota.*.js` es el personaje.

### Las ventanas se mueven

Se agarran de la barra de título y quedan fijas donde las dejás, aunque sigas
bajando la página. Doble clic en la barra las devuelve a su lugar. La posición
se guarda.

**No pueden perderse ni quedar inalcanzables.** Están acotadas para que nunca
salgan de la pantalla ni se metan debajo de la barra de arriba (z-index 70) ni
de la de tareas (z-index 80), que le ganan a cualquier ventana. Sin eso,
arrastrar una contra un borde la dejaba con su cruz afuera o tapada: una ventana
que no se puede cerrar.

En el teléfono **no** se mueven —ocupan toda la pantalla— y al pasar a teléfono
se les limpia el estilo, porque un `left` puesto a mano le gana a la regla de la
media query.

### De todo lo que se abre, se sale

Ventanas, Aero+, el menú de inicio y la ventana de colaborar se anotan en una
**pila de pantallas**. El botón/gesto de atrás de Android cierra la de arriba, y
recién con la pila vacía se sale del sitio. Escape hace lo mismo.

En el teléfono, abrir una app **cierra la anterior**: como cada una tapa la
pantalla entera, tener cuatro abiertas eran cuatro pantallas idénticas
encimadas.

## Las cuatro puertas de entrada

| puerta | cómo anda | estado |
|---|---|---|
| **Cuenta propia** | usuario + contraseña, PBKDF2 con 100.000 vueltas | anda |
| **Llave de acceso** (WebAuthn) | huella o cara del aparato, sin contraseña | anda |
| **Discord** | OAuth2 | anda |
| **Google** | falta un proyecto de Google Cloud | **trabado** |

Quien no tiene contraseña —entró con llave o con Google— guarda un centinela en
la columna `clave` que ninguna contraseña puede igualar. No es "contraseña
vacía": es un valor que no puede salir de la función que las verifica.

## Aero+ — la zona de donantes

Se instala como una app: el ícono del escritorio dice "Instalar Aero+" y después
"Aero+". Es **otra interfaz a pantalla completa**, no la misma con un cartel.

Adentro hay cinco cosas:

| app | qué hace |
|---|---|
| **Estudio de temas** | 5 fondos que no están en el escritorio común, color del vidrio |
| **Perfil+** | marco del retrato, banda y lema — se ven en el muro |
| **Galería** | los fondos en grande, para bajar |
| **Fábrica de fondos** | pedís un fondo con palabras y una IA lo dibuja |
| **Tienda** | las apps, gratis por haber colaborado |

Todo lo que se elige se guarda **en la cuenta**, no en el navegador, así que te
sigue del teléfono a la compu.

### La Fábrica de fondos

Escribís una idea y sale un fondo en el estilo del sitio. **Dos modelos y no
uno**, por una razón concreta:

- El que dibuja mejor (`flux-1-schnell`) **no acepta medidas** — contesta 400 si
  se las mandás. Sirve para el cuadrado.
- `stable-diffusion-xl` sí acepta ancho y alto, que es todo el punto de un fondo
  de pantalla: un teléfono es 9:16, y recortar un cuadrado a 9:16 tira casi la
  mitad del dibujo.

**Dibuja el servidor, achica el navegador.** El PNG que sale pesa 1,4 MB y una
fila de D1 corta cerca de 1 MB. Recomprimir del lado del servidor pedía otro
enlace de Cloudflare y otra factura; el navegador ya sabe hacerlo con un canvas.

Topes: **10 dibujos por día por persona**, se guardan los últimos 8. Se cuenta
lo que se **pide**, no lo que queda guardado — si contara lo guardado, borrar uno
devolvería cuota y el límite no serviría de nada.

Consumo real medido: **172,8 neuronas por imagen** con flux. El plan gratuito da
10.000 por día.

## La tienda de apps

Partida en dos, y no es decorativo: quien baja algo tiene derecho a saber si lo
hizo el que mantiene el sitio o un desconocido.

- **Del sitio** — las del dueño.
- **De la comunidad** — las que propone la gente. Pasan por revisión.

### La huella, que es lo que hace posible revisar

Una app de la comunidad se publica con un **enlace a otro sitio**, o sea que el
sitio no tiene el archivo. Revisar el enlace es revisar una página de descarga,
no el APK que hay atrás. Mirar esa página y poner "sin virus" sería inventar
seguridad que no existe.

Por eso **el que propone elige el APK en su máquina y el navegador le saca el
sha256 ahí mismo**. No se sube nada; viajan 64 caracteres. Con eso:

1. se le puede preguntar a VirusTotal por **ese archivo exacto**;
2. cualquiera que lo baje puede sacarle el sha256 al suyo y comparar — si el
   enlace cambia por otro archivo, se nota.

**Sin huella no se publica**, y el formulario lo dice antes de que la persona
llene ocho campos.

Los tres resultados se guardan tal cual, **incluido "no lo conoce"**. Eso no es
"limpio": es que nadie lo analizó todavía, que es lo normal en una app recién
hecha. Falta la llave de VirusTotal para que el botón conteste.

### Las dos formas de poner el archivo

| | dónde vive | quién lo baja | qué cuesta |
|---|---|---|---|
| **archivo** | `/apps/` de este sitio | sólo con pase válido — sin pase da **403** | hay que subirlo al repo y desplegar |
| **enlace** | afuera (MediaFire, Drive) | **cualquiera con el link** | nada, se carga al momento |

Está dicho dos veces: en el formulario de quien publica y en la tarjeta de quien
baja.

### La cuota para publicar apps pagas

Subir apps **gratis** no cuesta nada. Para publicar una que **cobra**, hace falta
la cuota: **US$ 10 por mes** (`CUOTA_EDITOR_USD`).

**Lo que se cobra es publicar, no la venta.** La plata de las ventas va del que
compra al que hizo la app, por afuera del sitio. Intermediar plata ajena es otro
negocio: hay que devolver, hay que responder por lo que no llega, y las
pasarelas lo tratan como pagos a terceros.

**El detalle que más importa de todo el sistema:** extender una suscripción
**no es idempotente**. El cobro de acceso tolera que se pida dos veces la misma
orden porque su efecto es `acceso = 1`. Acá no: si alguien recarga después de
pagar, PayPal devuelve la misma orden ya capturada y un código ingenuo sumaría
otros 30 días. **Treinta días por cada F5.** Por eso cada cuota se anota con una
referencia **única** y los días se suman sólo si la inserción agregó una fila.

También hay **alta a mano** (sólo el dueño), para las transferencias en pesos,
que no le avisan a nadie. Acepta `@usuario`, devuelve a quién se la dio —escribir
mal un nombre le regala el mes a otro— y el mismo número de comprobante no suma
dos veces.

## El cobro

Tres caminos, y **ninguno le cree al navegador**:

1. **PayPal** — el servidor **captura** la orden con sus credenciales y comprueba
   tres cosas: que quede `COMPLETED`, que la plata haya ido a **nuestra** cuenta
   y que llegue al mínimo. Sin lo del medio, alguien pega la orden de un pago
   suyo a otro lado y entra.
2. **Mercado Pago** — se le pregunta a MP por ese pago: `approved`, en pesos, por
   el mínimo.
3. **Código** — para transferencias sueltas. Va firmado, y **vale lo mismo que un
   pago**: antes dejaba medio acceso y nadie se enteraba hasta abrir el celular.

Mínimo US$ 1. Abajo de eso, el fijo de PayPal (~30 centavos) se come todo: por
eso se subió desde los 10 centavos originales.

## La API

| ruta | qué hace |
|---|---|
| `POST /api/entrar` | entrar con cuenta o con Google |
| `POST /api/llave` | llaves de acceso: reto, empezar, guardar, entrar, borrar |
| `GET/POST /api/discord` | OAuth de Discord |
| `GET/POST /api/cuenta` | quién soy, editar perfil |
| `GET/POST /api/muro` | publicaciones, buscar, gente |
| `GET/POST /api/avisos` | notificaciones, marcar leída |
| `POST /api/pagar` | arma la orden de pago |
| `POST /api/acceso` | da el acceso: PayPal / MP / código |
| `POST /api/mp-aviso` | webhook de Mercado Pago |
| `POST /api/reclamo` | comprobante de transferencia |
| `POST /api/revisar` | aprobar accesos (dueño) |
| `POST /api/codigos` | generar códigos (dueño) |
| `GET/POST /api/aeromas` | la zona de donantes |
| `GET/POST /api/tienda` | catálogo, proponer, revisar, escanear |
| `GET/POST /api/editor` | la cuota mensual |
| `GET/POST /api/fabrica` | generar fondos |
| `GET/POST /api/visitas` | el latido |
| `GET /api/config` | qué está configurado |
| `GET /api/zona` | quiénes colaboraron |
| `GET /apps/<archivo>` | **la puerta**: sin pase válido, 403 |

Los que empiezan con `_` son ayudantes, no rutas: `_social` (sesiones y
validación), `_firma` (pases HMAC y códigos), `_llave` (WebAuthn), `_puertas`
(las vías de ingreso), `_avisar` (notificar).

## La base de datos

`frutiger-social`, 12 tablas. El esquema son archivos numerados que se aplican
**en orden**: `esquema.sql` … `esquema12.sql`. Cada uno explica arriba por qué
existe.

| tabla | qué guarda |
|---|---|
| `usuarios` | cuentas. `acceso`, `jefe`, `bloqueado`, `editor_hasta`, marco, banda, lema, tema |
| `publicaciones` | el muro |
| `avisos` | notificaciones |
| `llaves` | llaves de acceso (WebAuthn) |
| `pagos` | cada pago cobrado |
| `aportes` / `apoyos` | el histórico de colaboraciones |
| `tienda` | el catálogo de apps |
| `cuotas` | cada pago de cuota de editor — `ref` **única** |
| `fondos_ia` | los fondos generados (JPEG en base64) |
| `fondos_gasto` | cuántos hizo cada uno hoy |
| `visitas` | una fila por visita, **sin guardar la IP** |

**No se guarda la IP.** Distinguir a un desconocido por su IP es guardar un dato
personal (Ley 25.326 en Argentina) y no agrega nada que el número no diga.

## Los assets

- `sitio/img/zona/` — 14 imágenes hechas con Rezona: 5 fondos, 3 marcos, 5
  íconos de apps, el ícono del launcher
- `sitio/apps/aero-launcher-39.apk` — 2.298.804 bytes, el launcher de Android
- `sitio/audio/tema.*.mp3`, `sitio/fuentes/ss3.*.woff2`

---

# IBLO EVENTOS

El sitio de una productora de eventos, con panel de administración propio.

## Las páginas

| archivo | qué es |
|---|---|
| `iblo.html` | **la portada** (detecta teléfono y redirige) |
| `iblo-servicios.html` | los servicios |
| `iblo-publicaciones.html` | las publicaciones |
| `iblo-archivo.html` | el archivo |
| `iblo-esteticas.html` | las estéticas |
| `iblo-reels.html` | los reels |
| `iblo-app.html` | **el panel de administración** |
| `aquaviva.html`, `cuatro-tiempos.html`, `gabinete.html`, `humo-lento.html`, `kane.html` | páginas de proyectos |
| `index.html` | índice del **repo**, NO la portada del sitio |

⚠️ **`index.html` no es la portada.** Copiarlo tal cual publica "Páginas del
repo" como página principal del sitio. Ya pasó una vez.

## Cómo se despliega

```bash
export CLOUDFLARE_API_TOKEN=$(cat /root/.cloudflare-iblo)
./desplegar-iblo.sh          # arma, despliega y verifica, en un comando
```

`armar-sitio.sh` hace tres cosas que no se adivinan:

1. la portada es `iblo.html`, no `index.html`;
2. las funciones van en `functions/api/`, no en `api/`;
3. **wrangler sólo compila las funciones si se lo corre parado adentro de la
   carpeta.** Si la salida no dice *"Compiled Worker successfully"*, no
   compilaron y toda la API va a dar 404 — incluidas las de cobro.

## La API

27 endpoints: `publicaciones`, `archivo`, `entradas`, `equipo`, `destacado`,
`estilo`, `sitio`, `instagram`, `estado`, `login`, `clave`, `mias`, `prop`,
`sugerir`, `asistente`, `mejorar`, `visitas`. Ayudantes: `_comun`, `_pub`,
`_ia`, `_ig`, `_historias`, `_modelos`, `_middleware`.

Hay **IA adentro** (`_ia.js`, `_modelos.js`, `asistente.js`, `mejorar.js`): usa
Workers AI de Cloudflare. Está pendiente agregar Groq o Gemini como respaldo
gratuito.

## La indexación en Google — el problema que se resolvió

Google tenía indexado el texto **"No se pudieron cargar"**: las publicaciones se
pedían por JavaScript después de cargar, y el robot se llevaba la página vacía.
Se arregló de tres formas a la vez:

1. **`_funciones/iblo-publicaciones.js`** inyecta las publicaciones y los datos
   estructurados del evento **en el servidor**, con HTMLRewriter, antes de que la
   página salga.
2. **`_funciones/sitemap.xml.js`** calcula el sitemap con fechas reales, sacadas
   del historial de git ∪ la base de datos. Sin `changefreq` ni `priority`, que
   Google ignora.
3. **`robots.txt`** deja entrar a `/api/publicaciones` y bloquea el resto de la
   API.

Y una trampa que costó: **`_headers` no se aplica a las respuestas de una
Función.** El `X-Robots-Tag` puesto ahí se veía en el código y no existía en la
respuesta. Tuvo que ir en `api/_middleware.js`.

## La base de datos

`iblo`, 16 tablas: `publicaciones`, `archivo`, `entradas`, `equipo`,
`secciones`, `sitio`, `sitio_historial`, `destacado`, `adornos`, `usuarios`,
`ig`, `estado_ig`, `cache_ia`, `revisados`, `intentos`, `visitas`.

---

# Las reglas que atraviesan todo

Estas no son preferencias: cada una viene de un bug que pasó.

**La pantalla no decide nada.** Toda puerta se pregunta en el servidor. Se puede
poner `AM.jefe = true` desde la consola del navegador y lo único que pasa es que
se ve un formulario que después contesta 403.

**Los comentarios explican POR QUÉ, no qué.** Son la memoria del proyecto: casi
todos cuentan un error real y qué pasó cuando estaba mal.

**Decir lo que no se sabe.** "No lo conoce" no se pinta de verde. "Sin revisar"
se dice. Un tilde que no significa nada es peor que no poner nada, porque
aparece justo donde alguien decide instalar algo en su teléfono.

**Nombrar las cosas por lo que son.** La tabla se llama `visitas` y no
`personas`, y la pantalla dice "visitas": llamarlo distinto sería inventar una
precisión que el dato no tiene.

**Lo que se mide, se dice con el número.** "Anda" sin un número al lado no vale.

**Todo en castellano rioplatense**, código y comentarios incluidos.

---

# Cómo se prueba

`frutiger-aero/pruebas/` — **71 comprobaciones** con navegador de verdad.

```bash
./pruebas/preparar.sh                          # base local, cuentas, pases
npx wrangler pages dev --port 8788 --local     # dejalo corriendo aparte
cd pruebas && node navegacion.mjs              # y las demás
```

| batería | qué mira | cuántas |
|---|---|---|
| `navegacion.mjs` | que de todo lo que se abre se pueda salir | 22 |
| `ventanas.mjs` | arrastrar sin perderlas ni taparlas | 22 |
| `tienda.mjs` | las dos secciones, la huella, proponer | 11 |
| `cuota.mjs` | el panel de la cuota | 10 |
| `cuota-a-mano.mjs` | dar cuota y que no sume dos veces | 6 |

**Que un elemento exista no quiere decir que se pueda tocar.** Comprobalo con
`document.elementFromPoint(x, y)`. Así apareció el peor bug del sitio: la cruz
de cerrar estaba tapada por la barra de arriba y tocarla abría el menú del
perfil.

---

# Dónde está todo ahora

Medido contra producción:

| | |
|---|---|
| cuentas | 2 (1 dueño, 1 más) |
| publicaciones en el muro | 1 |
| apps en la tienda | 1 (el launcher) |
| fondos generados con IA | 1 |
| visitas registradas | 15 |
| cuotas de editor cobradas | 0 |

Es un sitio que **funciona y todavía no tiene gente**. Todo lo construido está
probado; lo que falta es que alguien lo use.

---

# Lo que falta

| pendiente | qué falta exactamente | quién |
|---|---|---|
| Revisión antivirus | llave de VirusTotal (gratis, con un email) | el dueño |
| Subir APKs al sitio | habilitar R2 en el panel de Cloudflare | el dueño |
| Probar el cobro de la cuota | credenciales de PayPal **sandbox** (plata falsa, gratis) | el dueño |
| Entrar con Google | proyecto de Google Cloud (pide ser mayor de edad) | **trabado** |
| Rotar la clave de IBLO | pasó por el chat | el dueño |
| IA de respaldo en IBLO | agregar Groq o Gemini | se puede |
| Publicaciones duplicadas | ids 21 y 22 se muestran dos veces | se puede |
| Compilar el APK | no hay SDK de Android y no entra en el disco | **trabado acá** |

## Lo que NO se puede hacer desde esta máquina

Dicho para que nadie lo prometa de nuevo:

- **Compilar un APK** — no hay SDK y no entra (2-3 GB, quedan ~2,4).
- **Subir a MediaFire** — haría falta la contraseña de la cuenta guardada en el
  servidor. Una clave guardada para que un programa la use es una clave que se
  puede filtrar entera.
- **Probar contra el sitio publicado con navegador** — Chromium no llega a hosts
  externos por el proxy. Las pruebas van contra `localhost`; producción se
  verifica con `curl`.

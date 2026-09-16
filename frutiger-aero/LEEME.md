# Frutiger Aero

Un escritorio de vidrio. Se entra por una pantalla de inicio de sesión de
Vista —como invitado o con Google—, y adentro hay ventanas de verdad: el
archivo de la estética, un buscaminas, un bloc que guarda, un reproductor con
visualizador y un panel de control que cambia el color del vidrio de toda la
interfaz. La mascota 3D vive en una de las ventanas.

    https://frutiger-aero-86q.pages.dev

## Cuatro formas de entrar, y una sola cuenta

Usuario y contraseña, **llave de acceso**, **Discord** y **Google**. Las cuatro
terminan en la misma cuenta de la base y en el mismo pase firmado: no son
sesiones distintas ni cuentas distintas. Quien entró por una puede pegarse las
otras después, y el que entró con Google y ya tenía cuenta con contraseña la
vincula en vez de quedarse con dos perfiles.

Todas se atan al **número de la cuenta del otro lado**, nunca al correo ni al
nombre de usuario. El correo de Google cambia, el nombre de Discord cambia, y
una dirección de escuela o de trabajo se le reasigna a otra persona cuando el
primero se va: atar el perfil a algo que cambia es dejar que el que herede ese
algo herede el perfil, las publicaciones y el acceso pagado.

### Llaves de acceso: la única que no le pide permiso a nadie

Las otras tres necesitan darse de alta en la consola de alguien, y la de Google
pide **mayoría de edad**. Las llaves de acceso no: la clave privada la guarda el
teléfono o la computadora de cada uno, acá queda la pública, y entrar es firmar
un número al azar con la huella, la cara o el PIN. No hay tercero, no hay
secreto que se pueda filtrar y no hay edad mínima que cumplirle a nadie. Andan
sin configurar nada: si el navegador las soporta, el botón aparece.

Tres cosas que salen gratis y con contraseñas no se pueden tener:

- **Lo guardado acá no sirve para entrar.** Es la mitad pública. Si alguien se
  lleva la base no se lleva con qué hacerse pasar por nadie. Con contraseñas,
  por mejor guardadas que estén, siempre queda algo contra lo que probar.
- **No se puede pescar.** La firma lleva adentro de qué sitio salió, así que una
  copia de esta página en otra dirección no puede usar estas llaves, aunque la
  persona caiga y apoye el dedo.
- **No hay nada que recordar ni que repetir en otro sitio.**

Dos detalles de implementación que importan:

- La clave pública la entrega el navegador con `getPublicKey()`, ya en el
  formato que entiende WebCrypto. El estándar la manda envuelta en CBOR dentro
  del `attestationObject`, y desarmar eso a mano es donde se cometen los
  errores. No es confiar en el navegador: una clave pública no es un secreto, y
  el que registra una que no controla sólo se perjudica a sí mismo. Lo que sí se
  comprueba, y es lo que importa, es **la firma de cada entrada**.
- Una firma ECDSA sale del autenticador envuelta en ASN.1 y WebCrypto la quiere
  pelada, los dos números pegados de 32 bytes cada uno. Sin esa traducción
  (`firmaPelada`, en `_llave.js`) **ninguna** entrada da, y el síntoma es de los
  que hacen perder una tarde: no hay error, simplemente nadie puede entrar.

La cuenta se crea **recién cuando la llave ya existe**, no antes: al revés
quedarían cuentas huérfanas a las que nadie puede entrar cada vez que alguien
cancela el diálogo del navegador.

### Discord: la puerta de afuera que sí está al alcance

El portal de desarrolladores de Discord se abre desde los 13 con la cuenta de
siempre. Una vez:

1. **discord.com/developers/applications** → *New Application*.
2. En **OAuth2**, en «Redirects», la dirección del sitio + `/api/discord`.
3. Cloudflare Pages → **Settings** → **Variables** → `DISCORD_CLIENT_ID` y
   `DISCORD_SECRET`. El secreto va **como secreto**, no como variable común.

Acá no llega un token firmado sino un **código** de un solo uso que hay que
cambiarle a Discord por un permiso, y ese cambio lleva el secreto de la
aplicación: por eso pasa entre servidores y no puede estar en el navegador.

**El `state` no es decoración**: sin él, cualquier página puede mandar a alguien
a la vuelta de este circuito con un código suyo y dejarlo con la sesión de otro
sin que se dé cuenta. Va firmado por este servidor y con fecha.

Y el pase vuelve en el pedacito de después del `#`, que **no se manda a ningún
servidor** —ni al nuestro ni al de en medio—; la página lo borra apenas lo lee.
En la parte de antes del `?` quedaría escrito en los registros de todo el camino.

### Google: qué falta y por qué no está en el código

Anda solo en cuanto exista un identificador de cliente. **No está escrito en el
código a propósito**: lo sirve `functions/api/config.js` desde la variable
`GOOGLE_CLIENT_ID`, así se cambia desde el panel de Cloudflare sin volver a
publicar. Una vez:

1. **console.cloud.google.com** → crear un proyecto.
2. **Plataforma de Auth de Google** → *Empezar* → tipo **Externo**.
3. **Clientes** → *Crear cliente* → **Aplicación web**. En «Orígenes autorizados
   de JavaScript», la dirección del sitio, entera y sin barra al final.
4. Cloudflare Pages → **Settings** → **Variables** → `GOOGLE_CLIENT_ID`.

El *secreto* del cliente no hace falta y no se pega en ningún lado.

**El token se verifica del lado del servidor y eso no es opcional.** Un JWT es
texto firmado: leerlo en el navegador sin comprobar la firma es leer lo que
quiso escribir el que lo mandó, y cualquiera podría entrar con el nombre y la
foto que se le antoje. `functions/api/entrar.js` se lo da a Google y comprueba
las tres cosas que casi siempre faltan: que la firma sea de Google, que el
`aud` sea **esta** aplicación y que no esté vencido.

### El número de un solo uso

Google, Discord y las llaves usan el mismo (`darNumero` en `_firma.js`). Sirve
para que algo robado en otro lado no entre acá: sólo vale el número que pidió
**esta** página hace un rato. No tiene tabla y no la necesita —la fecha y la
firma viajan adentro del propio número—, porque una tabla de números de un solo
uso hay que limpiarla, y una tabla que nadie limpia crece para siempre.

## Lo social: muro, perfiles y cuentas

Cada uno se hace una cuenta, arma su perfil y publica proyectos Frutiger Aero
pidiendo apoyo. Barra arriba con las tres rayitas, el muro, y el perfil.

### El dinero no pasa por acá, y es a propósito

Cada publicación lleva **el enlace de cobro de quien la escribió**, y el botón
va directo a esa cuenta. Si la plata pasara por la del sitio, esto sería un
intermediario de pagos —con todo lo que eso implica— y habría que responder por
proyectos ajenos. El sitio pone la vidriera y nada más.

Por lo mismo, **el contador de apoyos no es dinero**: dice cuánta gente fue a
apoyar, no cuánto se juntó. Este servidor no tiene forma de saber lo segundo, y
mostrarlo como plata recaudada sería inventar una cifra.

### La contraseña no se guarda

Se guarda el resultado de pasarla 100.000 veces por PBKDF2 con una sal distinta
por persona. Si alguien se lleva la base, no se lleva contraseñas: se lleva
ruido carísimo de revertir. Un `sha256` pelado no sirve —una placa de video
prueba miles de millones por segundo—; lo que la hace segura es que PBKDF2 es
**lenta a propósito**.

Al fallar el ingreso nunca se dice *cuál* de los dos datos estuvo mal, y la
comprobación se corre igual aunque el usuario no exista, contra un hash
inventado. Si no, la respuesta vuelve antes cuando el usuario no existe, y esa
diferencia de tiempo deja averiguar quién tiene cuenta acá.

### Todo lo que escribe otro se inserta como texto, nunca como HTML

Un muro donde cualquiera publica es exactamente donde alguien va a probar con
`<script>`. Las tarjetas se arman con `createElement` y `textContent`: no hay un
solo `innerHTML` con datos del servidor. Los enlaces de cobro se validan en el
servidor y sólo se aceptan `http(s)`, porque `javascript:` en el perfil de uno
es un agujero para todos los que lo miren.

### La trampa del wrangler.toml que dejó el sitio sin API

Al agregar la base de datos hizo falta `wrangler.toml` para declarar el enlace
a D1. **Con ese archivo puesto, las funciones se buscan en `functions/` AL LADO
del toml, no adentro de `sitio/`.** Dejarlas donde estaban hizo que wrangler
subiera el sitio sin compilar una sola función, y *todas* las rutas de `/api`
pasaron a contestar 404 — incluidas las de cobro, que ya andaban.

El despliegue no avisa. Simplemente deja de decir «Compiled Worker
successfully». Si falta esa línea, algo está mal.

## El piso, y por qué los aportes se juntan

El acceso anticipado arranca en **$ 100** (o **US$ 0,10**). Quien manda la mitad
**no entra en la cola** —sería hacer revisar algo que todavía no alcanza— pero
**tampoco pierde lo que mandó**: su aporte queda juntando, la pantalla le dice
cuánto le falta, y el día que completa, *todo lo suyo* pasa a la cola de una
vez y con todos los comprobantes juntos.

Por eso la cola llega **agrupada por persona y no por comprobante**: quien mandó
cincuenta dos veces es un solo pedido de cien con dos capturas, y hay que
mirarlas juntas para decidir. Aprobar resuelve a la persona entera.

Se acumula **por moneda y no se convierte nada**. Poner una cotización acá sería
inventar un número que cambia todos los días y del que este servidor no sabe
nada: cada moneda llega a su propio piso.

Y lo que se junta es lo **declarado**, que no es lo verificado. Por eso al final
hay una persona mirando los comprobantes: esto ordena la cola, no reemplaza la
revisión. Los pisos se cambian en `ACCESO_MINIMO_ARS` y `ACCESO_MINIMO_USD`.

## El circuito de acceso, de punta a punta

1. La persona transfiere y aprieta **«Ya transferí»**. Deja **su nombre y
   apellido**, el número de operación, cuánto mandó y **la captura del
   comprobante**. Eso no le da nada: pide turno.

   El nombre es obligatorio y es *el del que transfirió*, no el del perfil: en
   el comprobante figura el titular de la cuenta, y es lo único que se puede
   cruzar contra lo que entró —el `@usuario` del sitio no aparece en ningún
   banco. Si alguien manda dos tramos con nombres distintos, la cola lo avisa
   en la tarjeta en vez de dejarlo pasar callado.
2. En **`/solicitudes`** aparece el pedido con la imagen. Se compara con lo que
   entró.
3. **Aprobar** habilita la cuenta, **manda el aviso** y **borra la imagen**.
4. A la persona le aparece el punto rojo en la campanita, sin recargar.

### El administrador es una cuenta, no una clave compartida

Una clave suelta escrita en cada pantalla no dice quién entró, no se le puede
sacar a una sola persona, y si se filtra hay que cambiarla para todos. Ahora se
entra con **el mismo usuario y contraseña que cualquiera**, y la cuenta lleva
una marca que el servidor comprueba en cada llamada. La página no decide nada:
sólo muestra lo que el servidor le deja ver.

Para nombrar al primero se usa `CLAVE_ADMIN` una única vez, con la sesión
abierta. Después no se toca más.

### El comprobante se borra al resolver

Va como BLOB —base64 pesa un tercio más por nada— y se achica en el navegador
antes de subirlo: una foto de celular son 4 MB y lo único que hace falta es que
se lea un número. **Al aprobar o rechazar, la imagen se borra.** Sin eso la base
se llenaría de capturas de comprobantes ajenos, que es exactamente lo que no hay
que guardar.

El tamaño se vuelve a comprobar en el servidor: lo que valida el navegador no
vale, porque el pedido se puede armar a mano sin pasar por la página.

## En pesos la verificación es a mano, y no por vagancia

**Ninguna billetera que pueda usar un menor de edad en Argentina entrega
credenciales de cobro.** Mercado Pago abre cuentas desde los 13 con permiso de
un adulto y deja **recibir** transferencias, pero no vender: sin Checkout Pro no
hay token, no hay API, no hay aviso automático. Prex lo mismo. Así que alguien
tiene que mirar el comprobante, y eso no se arregla con código.

Lo que sí se arregla con código es que mirarlo cueste dos toques:

1. El que transfirió deja el **número de operación** en la pantalla de
   colaborar. Eso no le da nada: lo pone en una cola.
2. En `/solicitudes` aparece el pedido con el nombre, el número y cuánto dice haber
   mandado.
3. **Aprobar habilita la cuenta al instante.** No hay que mandarle un código ni
   escribirle por WhatsApp.

Un índice único parcial (`WHERE estado = 'espera'`) impide dos pedidos abiertos
de la misma persona: insistir no acelera nada y sólo llena la cola.

El acceso queda pegado a la **cuenta**, así que entrar después desde otro
teléfono ya lo trae.

## Ningún pago se pierde, aunque cierren la pestaña

Al principio el acceso se daba cuando el que pagaba **volvía** al sitio con el
identificador en la dirección. Si cerraba la pestaña, se le cortaba el 4G o
Mercado Pago tardaba en devolverlo: pagaba y no recibía nada. Y del lado de acá
no quedaba rastro de que había pagado, así que ni reclamando se podía comprobar.

Ahora hay tres redes debajo:

1. **La pasarela avisa sola** (`/api/mp-aviso`), apenas se acredita, sin
   depender de que el navegador siga vivo.
2. **Todo pago queda anotado** en la tabla `pagos`, con su identificador. El
   `UNIQUE(medio, ref)` hace que el aviso repetido no cuente dos veces —Mercado
   Pago reintenta, y lo hace bien.
3. **El acceso viaja con la cuenta, no con el navegador.** Quien pagó en la
   compu y después entra desde el teléfono ya lo tiene.

**Al aviso no se le cree.** Sólo trae un número de pago, y podría mandarlo
cualquiera: lo único que se hace con él es ir a preguntarle a Mercado Pago por
ese pago con nuestro token. La verdad sale de la consulta, nunca del cuerpo del
pedido.

Y al webhook se le contesta **200 aunque no se pueda procesar**: si contesta
error, Mercado Pago lo reintenta durante horas.

## Cobrar: qué variable hace qué

Nada de esto está en el código. Son variables del proyecto en Cloudflare
(Pages → Settings → Variables), así que se cambian sin volver a publicar.

| Variable | Para qué |
|---|---|
| `PAYPAL_CLIENT_ID` · `PAYPAL_SECRET` | Cobrar en dólares y verificar el pago |
| `PAYPAL_MERCHANT_ID` | Comprobar que el dinero fue **a esta** cuenta |
| `PAYPAL_MODO` | `sandbox` para probar; cualquier otra cosa es real |
| `MP_TOKEN` | Cobrar en pesos por Mercado Pago (todavía sin poner) |
| `PAGO_MP_ALIAS` · `PAGO_PAYPAL` | Los datos para pagar a mano, sin verificación |
| `ACCESO_MINIMO_USD` · `ACCESO_MINIMO_ARS` | El piso para dar acceso |
| `SECRETO` | Firma los pases y los códigos. Cambiarla los invalida a todos |
| `CLAVE_ADMIN` | Nombra al primer administrador, y genera códigos en `/solicitudes` |
| `ZONA_ITEMS` | La lista de la zona de donantes, en JSON |

### No adivines cuál credencial es cuál: probala

Se perdió un rato con esto. Lo esperable es que el Client ID de PayPal empiece
con `A` y el Secret con `E`. **En esta cuenta el Client ID de Live empieza con
`BAA`**, así que la forma no sirve para distinguirlos, y encima las primeras que
llegaron eran de Sandbox sin que nada lo dijera.

La única manera confiable es preguntarle a PayPal, que además dice si son de
prueba o de verdad: el mismo par contra los dos servidores, y el que conteste
200 es el bueno.

    curl -s -o /dev/null -w '%{http_code}\n' -u "ID:SECRET" \
      -d grant_type=client_credentials https://api-m.paypal.com/v1/oauth2/token
    # 200 = son de Live . 401 = probá contra api-m.sandbox.paypal.com

El `PAYPAL_MERCHANT_ID` no hace falta ir a buscarlo: viene en la respuesta de
la primera orden, en `purchase_units[0].payee.merchant_id`.

### En modo prueba el cartel rojo no es decorativo

Con `PAYPAL_MODO=sandbox` se cobra con plata que no existe. La pantalla lo
avisa arriba de todo y no se puede cerrar, porque el error caro de este montaje
es anunciar la tienda creyendo que entra dinero y regalar accesos a cambio de
nada.

## Nada se guarda en un servidor

El perfil que vuelve de Google, las notas del bloc, el color del vidrio y el
récord del buscaminas viven en el navegador de quien entró. No hay base de
datos y no hace falta: es un escritorio de adorno, no hay nada que proteger, y
pedirle la cuenta a alguien para después guardarle los datos sin necesidad
sería cobrarle de más.

Todo lo que toca `localStorage` pasa por un envoltorio con `try/catch`: en
pestaña privada tira excepción, y una página que se cae por no poder guardar
una preferencia es una página rota.

## El color del vidrio es una variable, no un valor

Vista dejaba cambiar el color del cromo desde el panel de control, y acá
también. Todo el cromo se arma con `hsl(var(--tono) var(--sat) ...)`, así que
mover un número retiñe la interfaz entera —barras de título, orbe, cartel,
aparatos, barra de tareas— sin tocar una regla más.

## La piel es Aero, y Aero no es «vidrio»

La primera versión era vidrio de Apple: desenfoque grande y bordes de 30 px.
Se parecía a 2021, no a 2007. Aero se hace distinto y hay tres cosas que lo
definen.

**El corte duro al 45 %.** Un botón Aero no tiene un degradado suave: tiene dos
degradados pegados, y el escalón entre los dos es el reflejo del plástico.

    linear-gradient(180deg, #f2f2f2 45%, #ebebeb 45%, #cfcfcf)
                                     ^^^^^^^^^^^^^^ acá

Sin ese escalón el botón queda de 2014. Está en los botones, en las pastillas,
en la barra de tareas y en el cartel de bienvenida, que es el mismo corte pero
de 130 px de alto.

**La barra de título son cuatro capas**, y hacen falta las cuatro:

1. y 2. dos diagonales claras que entran desde las esquinas de arriba — son el
   reflejo del marco, y es lo que más se extraña cuando falta;
3. el brillo vertical, con su propio corte al 46 %;
4. el azul translúcido, con `backdrop-filter` atrás.

Más el filo blanco de 1 px arriba y a los costados (`inset` box-shadow), que es
el canto del vidrio.

**Los valores no se adivinaron.** El azul `#4580c4`, los grises de los botones y
las posiciones de los cortes salen de [7.css](https://khang-nd.github.io/7.css/),
que los sacó de la interfaz real.

## Cerrar una ventana no rompe la página

Los tres botones de cada barra de título funcionan. Cerrar o minimizar no borra
la sección: la manda a la barra de tareas de abajo, y de ahí vuelve. Una cruz
que hace desaparecer contenido para siempre sería una broma, no una interfaz.

## La tipografía se sirve desde acá

`Segoe UI` primero, para quien esté en Windows y tenga la de verdad. Para el
resto, **Source Sans 3 servida desde el propio sitio**: un archivo variable de
28 KB que cubre de 200 a 900. No se pide a Google —un pedido menos afuera y
ningún salto de tipografía al cargar— y lleva el hash en el nombre como todo
lo demás.

Ojo con el CSS que devuelve Google Fonts: viene ordenado por subconjunto
(vietnamita, latin-ext, latin) y quedarse con el primer `.woff2` deja una
fuente **sin una sola letra del alfabeto**, que el navegador carga «bien» y
dibuja con la serif del sistema. Hay que buscar el bloque `/* latin */`.

La mascota es un **modelo 3D con rig**: 41 huesos, animación de reposo, salto
al tocarla, y una capa de movimiento hecha por código encima. Se arrastra para
girarla.

El sitio pesa 3,1 MB, de los cuales 2,4 MB son el modelo, three.js y
GLTFLoader. **Es mucho para una página que dice «próximamente»**, y se paga por
tener un 3D de verdad. La imagen de la mascota carga primero y el 3D la
reemplaza cuando termina de bajar, así que la página se ve completa desde el
primer momento.

## Todo lo que se cachea lleva el hash de su contenido en el nombre

`immutable` es una promesa: *esta URL nunca cambia de contenido*. Se rompió una
vez —se reemplazaron las imágenes de la mascota con el mismo nombre y el
navegador del dueño siguió mostrando las viejas durante un año, porque se lo
habíamos pedido—. Ahora cada archivo de `img/`, `js/`, `vendor/` y `modelos/`
lleva ocho dígitos de su propio hash: si el archivo cambia, cambia la URL, y no
hay caché que pueda quedarse con lo viejo. El mapa de nombres queda en
`nombres.json` y `nombres-js.json`.

Eso se hacía a mano y ahora lo hace `sellar.py`, que además **vuelve a calcular
el hash de los archivos que ya tienen nombre sellado**. Es el error que se cae
solo: si alguien edita `aero.4f317a9e.css` sin renombrarlo, el nombre miente y
`immutable` vuelve a ser una promesa rota. Correrlo dos veces no cambia nada.

    python3 sellar.py

## El modelo tiene rig, y encima una capa por código

`submit_rig3d_generation` sobre el `task_id` del modelo devolvió **41 huesos y
tres animaciones**: `preset:walk`, `preset:idle` y `preset:jump`. Se usan idle
como base y jump al tocarla; walk se sacó del GLB a mano porque para una mascota
parada eran ~260 KB que nunca se iban a reproducir.

Encima del esqueleto va una capa hecha por código, y **las dos cosas conviven
porque tocan lugares distintos**: el esqueleto mueve las partes por dentro y el
código mueve, gira y escala al muñeco entero, desde un envoltorio. Si el código
tocara los huesos, pisaría a la animación en cada cuadro.

La capa por código, en `sitio/js/mascota.js`:

- **flote** — un seno lento en Y, período 4 s;
- **respiración** — escala no uniforme (sube y se angosta lo mismo, para no
  cambiar de volumen), período 2 s;
- **bamboleo** — una inclinación mínima en Z, período 6 s;
- **te mira** — el cuerpo gira hacia el puntero con un resorte, no de golpe;
- **arrastrar** — gira libre y sigue girando al soltar, con roce;
- **tocarla** — un salto con aplastado antes y después.

Los tres períodos son 4, 2 y 6 a propósito: si fueran iguales, el conjunto se
repetiría cada cuatro segundos y el ojo engancharía el bucle.

Con `prefers-reduced-motion` se apaga esa capa, pero **el esqueleto sigue**:
quieto del todo sería un maniquí, no una mascota.

## La pixelación es del renderizador, no un filtro

El lienzo dibuja a **128 px de lado** y el CSS lo estira con
`image-rendering: pixelated`. No hay segundo pase ni shader. Y de paso resuelve
un problema real: la malla sale de reconstruir **una sola foto**, así que de
cerca se le ven los bultos y la textura estirada. A 128 px eso desaparece y
queda el mismo escalonado que el personaje ya tiene en el pelo y el visor.

Dos detalles que hay que respetar para que funcione:
`motor.setPixelRatio(1)` —si no, en una pantalla retina el buffer sale al doble
y se pierde la mitad del efecto— y `setSize(LADO, LADO, false)`: con `true`,
three le escribe el CSS al lienzo y anula todo.

## El encuadre se mide, no se elige

`Box3.setFromObject` sobre una malla con skin devuelve la caja de la **pose de
amarre**, que no es la que se ve: el muñeco quedaba chico y corrido hacia abajo.
Y medir una sola pose tampoco alcanza: **el salto lo levanta medio cuerpo y se
salía del cuadro**.

Así que se recorren *las dos* animaciones —quince muestras de cada una—, se
juntan las posiciones de todos los huesos en cada muestra, y de esa caja sale
todo: el centro, la escala y la distancia de la cámara, calculada como la
distancia a la que una esfera de ese radio entra justa en el campo de visión,
más margen para el flote y la respiración. Antes la cámara era un `3.9` puesto a
ojo, y por eso recortaba.

La escala va en un envoltorio y no en el nodo del skin: tocarle la escala a un
nodo con esqueleto desalinea los huesos de la malla.

## Dos cosas que hacían que el toque no hiciera nada

- **`getElapsedTime()` de three se come el delta.** Llama a `getDelta()` por
  dentro, así que pedir primero el tiempo y después el delta devuelve casi cero
  y *todo lo que depende del tiempo se queda clavado*: los resortes, la inercia
  y la mezcla entre reposo y salto. El reloj propio se lleva a mano y el delta
  se pide una sola vez.
- **`crossFadeTo` fundía al revés.** El salto se quedaba en peso 0 y su reloj no
  avanzaba nunca. La mezcla ahora es un número que se acerca solo en cada
  cuadro, se aplica con `setEffectiveWeight` y se puede leer desde
  `window.mascota.info()`. Un número que se puede comprobar vale más que el
  atajo de la biblioteca.

`window.mascota` es un asa chica y a propósito: `saltar()` dispara el salto e
`info()` devuelve el encuadre y los pesos. Es lo que permite que una prueba
demuestre que el salto salta, en vez de mirar una captura y creerle.

## GLTFLoader está copiado, no traído de un CDN

El lector de GLB hecho a mano no sabe de esqueletos ni de animaciones, y
escribirlo era medio día de trabajo para reinventar algo que ya existe.
`GLTFLoader` no está en cdnjs, pero sí en jsDelivr como parte del paquete de
three: se bajó junto con su dependencia `BufferGeometryUtils`, se les reescribió
el `from 'three'` a la ruta local, y quedaron en `sitio/vendor/`. Cero
dependencias de un CDN en tiempo de ejecución.

Si no hay WebGL o el modelo no baja, el guión saca el `<canvas>` y queda la
imagen que ya estaba en el HTML. Un cuadro vacío sería peor que una foto.

Lo que tuvo antes —siete secciones, seis personajes en 3D, dieciocho íconos,
ocho láminas de estéticas y cinco pantallas de error escritas en CSS— se sacó a
pedido y sigue en la historia de git (`git log -- frutiger-aero`).

## Dos trampas que costaron un rato, las dos silenciosas

- **`img{display:block}` le gana al `[hidden]` del navegador.** Es una regla de
  autor contra una de la hoja del agente, así que esconder el respaldo no lo
  escondía: se veían la foto y el modelo, uno arriba del otro. Hace falta
  `[hidden]{display:none !important}`.
- **Mover un módulo de carpeta rompe sus propios imports.** `visor.js` pasó a
  `js/` y siguió pidiendo `./vendor/three…`, que desde ahí es
  `/js/vendor/three…`. No hubo error visible: el módulo no cargó y la página se
  quedó con la foto, que es exactamente lo que tenía que hacer al fallar.

## El vidrio

Son tres capas y hacen falta las tres. Con sólo la primera queda un rectángulo
borroso, que es lo que hace todo el mundo y no es esto.

1. **El cuerpo** — `backdrop-filter: blur(30px) saturate(190%)` sobre un tinte
   oscuro. El tinte no es decoración: sobre una foto de cielo, el vidrio claro
   deja el texto blanco ilegible.
2. **`::before`, el filo** — un degradado diagonal recortado a 1 px con
   `mask-composite: exclude`, para que el borde parezca doblar la luz.
3. **`::after`, el brillo** de la mitad de arriba.

## El fondo

Dos imágenes, no una: `fondo.webp` (1536x864) para pantalla ancha y
`fondo-alto.webp` (864x1536) para el celular, cambiadas por
`@media (orientation: portrait)`. Con una sola, `cover` recorta tanto en un
teléfono que se pierde el cielo. En vertical va con
`background-attachment: scroll`: `fixed` se ancla al viewport visual en varios
navegadores móviles y el fondo salta con la barra de direcciones.

Las dos son azul de arriba abajo con apenas una franja de pasto: **las versiones
con nubes grandes no sirven**, porque a través del vidrio el blanco de las nubes
lava el texto y la página entera se ve descolorida.

## El ícono de la barra

Lo trajo el dueño: el monigote de vidrio con el globo terráqueo. Venía en PNG
**sin canal alfa**, sobre fondo blanco.

Sacarle el blanco por color —«todo lo que sea claro es fondo»— le comería los
brillos blancos que tiene *encima* del cuerpo azul, que son justamente lo que lo
hace parecer de vidrio. Así que el fondo se busca por **contigüidad**: se inunda
desde los cuatro bordes y sólo se borra lo que se toca con el borde.

El reflejo de abajo no caía por color —es gris azulado, no blanco—, así que
aparte se busca la última fila con un pixel saturado (esa es la figura de
verdad) y todo lo de abajo se declara fondo.

## La mascota

Ocho poses en `sitio/img/mascota/`, generadas con Rezona a partir de un
personaje que trajo el dueño: saludando, en una burbuja, sentada en una nube,
jugando, bajo el agua, surfeando, haciendo la V y dormida. Los prompts están en
`modelos.json`.

Son WebP de 760x760 **con canal alfa**, 44–54 KB cada una. `transparent: true`
devuelve PNG con alfa de verdad, y el canvas de Playwright lo conserva al pasar
a WebP.

**Salen de una imagen de referencia, no de una descripción.** La primera vuelta
se hizo describiendo al personaje con palabras y salió un cubito de voxels: el
cuerpo es **suave y redondeado** —mangas que caen, pantalón ancho, manos
redondas sin dedos— y sólo el pelo y el visor tienen el escalonado de píxeles.
Eso, en palabras, no se acierta.

`submit_image_generation` acepta `source_urls`, que son **URLs y no archivos**.
La referencia se publicó un rato en el propio sitio, bajo un nombre al azar, se
generaron las ocho, y se sacó en el despliegue siguiente. Con la referencia
salieron iguales a la primera.

En la página va `m-saludando`, con un flote de cinco segundos y medio que se
apaga con `prefers-reduced-motion`.

## Publicar

    npx wrangler pages deploy sitio --project-name frutiger-aero --branch main

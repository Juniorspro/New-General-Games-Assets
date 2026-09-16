# Electro Silver — Presidencia Roca, Chaco

    https://electro-silver.pages.dev

Publicada en Cloudflare Pages, **como demostración y con `noindex`**. Se sube la
carpeta entera:

    npx wrangler pages deploy electro-silver --project-name electro-silver --branch main

## Por qué va con `noindex`

La dirección, el teléfono y los precios son de ejemplo, y las tres reseñas están
inventadas para la demostración —con nombre y pueblo—. La página lo dice en cada
sección, pero un buscador no lee eso: indexarla sería dejar que alguien busque
«Electro Silver» y encuentre un teléfono que no existe. El `noindex` va en la
etiqueta Y en la cabecera `X-Robots-Tag`, y `robots.txt` deja crawlear a
propósito: con `Disallow`, Google no puede leer el `noindex` y la página igual
puede terminar en los resultados.

Al publicar en serio: reemplazar los datos de la tabla de abajo, sacar el
`noindex` de `index.html` y de `_headers`, y volver a poner el `sitemap.xml`
apuntando al dominio real.

## Estado

- [x] Carpeta `imagenes/` creada
- [x] `index.html` — página completa, 5,6 MB, todo embebido (no depende de internet
      salvo las fuentes de Google y three.js)
- [x] `<head>` con título, descripción, favicon, Open Graph y datos estructurados
      (`HomeGoodsStore` con dirección, horarios, coordenadas y las 6 localidades)
- [x] `sitemap.xml` y `robots.txt`
- [x] `admin.html` — panel para cargar publicaciones (foto + texto + precio + WhatsApp)
- [ ] `imagenes/logo.png` — cuadrado, mínimo 512×512, PNG con fondo
- [ ] Archivo de verificación de Google Search Console (mandame el nombre **y** la
      línea de adentro: si el archivo va vacío, la verificación falla)
- [ ] Reemplazar los datos de ejemplo (ver abajo)

## Qué hay que reemplazar antes de publicar

Están marcados en el pie de la página y en comentarios del HTML:

| dónde | qué dice ahora |
|---|---|
| JSON-LD y sección «El local» | Av. San Martín 480 · (3725) 00-0000 |
| JSON-LD `geo` | -26.1333, -59.6000 (centro del pueblo, no del local) |
| `canonical`, `og:url`, `og:image` | electrosilver.com.ar |
| Precios del catálogo | valores de ejemplo |
| Tarifas de instalación y de envío | valores de ejemplo |
| Las tres opiniones | inventadas para la demostración |
| Botón de WhatsApp | copia el mensaje al portapapeles; con `wa_link` cargado abre WhatsApp |

El `wa_link` se carga en el JSON de datos que está dentro del propio `index.html`
(buscá `"wa_link": ""` y poné `https://wa.me/549372500000`, con el número real).

## Datos del negocio que hacen falta

Sin esto el SEO local queda inventado, y eso a Google le sirve poco y a un cliente
que llama a un teléfono equivocado, menos:

1. Dirección exacta (calle y número, o la referencia que usen)
2. Teléfono y WhatsApp
3. Horario de atención
4. Qué venden y qué reparan
5. Si ya existe la ficha de Google (Perfil de Empresa) y con qué nombre
6. Redes: Facebook / Instagram, si tienen
7. Si hacen envíos y hasta dónde

## Datos de la localidad (verificados)

| dato | valor |
|---|---|
| Localidad | Presidencia Roca |
| Departamento | Libertador General San Martín |
| Provincia | Chaco, Argentina |
| Código postal | 3511 |
| Habitantes | ~4.987 en el municipio (censo 2001) |
| Accesos | Rutas Provinciales 3 y 3bis |
| Cerca | Pampa del Indio (41 km por RP 3), General José de San Martín |
| Coordenadas | -26.13, -59.60 (aprox., hay que afinarlas con la dirección real) |

## Los pasos manuales que quedan para vos

1. Guardar el logo como `imagenes/logo.png`
2. Arrastrar la carpeta `electro-silver` a Netlify
3. En Search Console, tocar "Verificar" (el archivo ya va a estar en su lugar)
4. Crear o reclamar el Perfil de Empresa de Google — para un local de barrio esto
   pesa más que cualquier etiqueta del HTML


## El panel de publicaciones (`admin.html`)

Se abre en `tudominio/admin.html`. Cargás una foto, título, descripción, precio,
cuotas y el WhatsApp, ves cómo va a quedar mientras escribís, y le das Publicar.
Aparece en la web arriba de todo, en «Novedades del local».

La foto se achica sola a 1200 px y se guarda en webp: una foto de celular de 4 MB
queda en 100-200 KB. Eso es lo que hace que el plan gratis alcance.

### Entrar

Si el proyecto ya está conectado, el panel abre directo en una pantalla de
**mail y contraseña**. Nada más. La sesión queda guardada, así que no lo pide
en cada visita.

Si abrís el panel en otra computadora o en otro navegador, esa misma pantalla
te pide una vez la dirección del proyecto y la clave anon (te dice dónde
encontrarlas). Para saltear eso para siempre, completá al principio del
archivo:

```js
var CFG_FIJA = { url:"https://xxxx.supabase.co", key:"eyJhbGciOi…" };
```

Con eso el panel arranca apuntado al proyecto en cualquier dispositivo y sólo
pide usuario y contraseña. La clave anon puede ir escrita ahí: es pública por
diseño y no deja escribir nada.

### Dos modos

**Sin configurar nada** guarda en el navegador. Sirve para probar todo el flujo,
pero las publicaciones sólo las ve quien usa esa computadora.

**Conectado a Supabase** las guarda en internet y las ve todo el mundo. El botón
«Configurar» abre un asistente que va paso por paso y verifica cada uno antes de
seguir. Es gratis y no pide tarjeta.

Lo que hace solo el asistente:

- abre la pantalla exacta de Supabase que hace falta en cada paso, con el enlace
  armado para *tu* proyecto (no el genérico)
- de un pegote cualquiera saca la dirección y la clave que sirve
- **rechaza la clave secreta** (service_role) si la pegás de más, y te avisa
- copia el SQL de un toque y después verifica que la tabla y el depósito existan
- crea tu usuario y te deja adentro, sin volver al panel de Supabase
- si la confirmación de mail está encendida, te dice exactamente dónde apagarla
- sube a internet las publicaciones que ya tenías guardadas en el navegador, con
  las fotos

Lo único que no puedo hacer por vos es crear la cuenta y el proyecto, y apretar
«Run» en el editor SQL: eso pide tu sesión de Supabase.

### Sobre la seguridad

La clave que se pega en el panel es la **anon public**, que es pública a propósito:
no da permiso de escribir. Escribir requiere iniciar sesión con el usuario que creás
en el paso 3, y eso lo controla el servidor, no la página. Así que aunque alguien
abra `admin.html`, sin tu usuario y contraseña no puede publicar nada.

La **service_role key** no va nunca en una página. Si la pegás ahí, cualquiera que
mire el código fuente puede borrar toda la base.

### Copias

«Bajar copia» te da un JSON con todas las publicaciones (y lo copia al portapapeles).
«Subir copia» las vuelve a cargar, sólo en modo demostración.


## El botón mágico de la descripción

Debajo del cuadro de descripción hay un botón con una chispa. Escribís las
palabras sueltas de siempre y te devuelve la descripción redactada, con un
«deshacer» al lado.

**No pide nada.** No hay clave, ni cuenta, ni internet: el redactor está dentro
de la propia página. Por eso no se puede romper ni quedar sin cuota.

Qué hace, con un ejemplo real:

    heladera grande 2 puertas no frost, la llevamos el mismo dia
    → Grande dos puertas No Frost. Con entrega el mismo día en Presidencia Roca.

- pone las tildes que se comen al escribir rápido (dia, garantia, automatico…)
- escribe bien el vocabulario del rubro (no frost → No Frost, 8kg → 8 kg,
  50 pulg → 50 pulgadas, 3000 fg → 3000 frigorías, 4k → 4K, s/interes → sin interés)
- pasa a letras los números que se cuentan (2 puertas → dos puertas) cuidando el
  género (1 año → un año, 1 puerta → una puerta)
- baja los gritos: MUY ECONOMICO!!! → Muy económico.
- saca del principio lo que ya dice el título, para no repetirlo, pero nunca se
  come un número (si no, «80 litros» quedaba en «litros»)
- arma aparte la frase de entrega o de instalación cuando la mencionás
- corta en 240 caracteres por palabra entera

### Si querés una IA de verdad además

El enlace «usar una IA en la nube» al lado del botón permite enchufar la API de
Google Gemini, que reescribe de cero con más vuelo. Es gratis pero hay que sacar
una clave en aistudio.google.com/apikey. Es **opcional**: sin eso el botón anda
igual. Y si la nube falla o se queda sin cuota, cae solo al redactor de la página.

Ojo con esa clave si la usás: al revés de la de Supabase, sirve desde cualquier
lado. Restringila por dominio en Google Cloud (Application restrictions →
Websites) cuando publiques.

El ícono está en `imagenes/chispa.png` (blanco sobre transparente, se usa como
máscara para que tome el color del botón) y en `imagenes/chispa-color.png`.


## Lo único que hay que vigilar de Supabase

El plan gratis **pausa el proyecto si pasa una semana sin actividad**. No lo borra:
queda dormido y hay que entrar al panel de Supabase y darle «Restore». Mientras
está dormido, la sección «Novedades del local» de la web queda vacía.

Cada visita a la web cuenta como actividad, porque la página consulta las
publicaciones al cargar. O sea: si el negocio tiene aunque sea una visita por
semana, no se pausa nunca. El riesgo es una semana muerta.

Para que no dependa de eso, el repo tiene `.github/workflows/despertar-supabase.yml`,
que le pega al proyecto cada 3 días. Se enciende cargando dos variables, una vez:

> Settings → Secrets and variables → Actions → pestaña **Variables** → New variable
> - `SUPABASE_URL` → `https://xxxxxxxx.supabase.co`
> - `SUPABASE_ANON_KEY` → la clave anon public

Van como *variables* y no como *secrets* porque la clave anon es pública.
Sin cargarlas el trabajo no falla: avisa y se va.

Un detalle de GitHub: si el repo pasa 60 días sin ningún commit, desactiva los
trabajos programados y manda un mail para reactivarlos.

### Los demás límites del plan gratis

| límite | cuánto | qué significa acá |
|---|---|---|
| Base de datos | 500 MB | Las publicaciones son texto: no se llena nunca |
| Fotos | 1 GB | A ~150 KB por foto comprimida, unas 6.500 publicaciones |
| Tráfico | 5 GB por mes | Unas 2.700 visitas mensuales cargando las novedades |
| Usuarios | 50.000 | Sobra: el único usuario sos vos |
| Proyectos activos | 2 | Ya usás uno |

**No hay copias de seguridad automáticas.** El botón «Bajar copia» del panel se
trae la lista de publicaciones (los textos y los enlaces a las fotos, no las
fotos). Conviene bajarla de vez en cuando.


## Un mismo proyecto de Supabase para varios locales

Sí se puede, y conviene: el plan gratis deja **2 proyectos activos**, pero un
proyecto solo aguanta muchos locales. Los separa la columna `negocio`.

Al principio de `admin.html` y dentro de `index.html` hay una línea igual:

```js
var NEGOCIO="electro-silver";
```

Para el próximo cliente: copiás los dos archivos a otra carpeta, cambiás esa
línea en los dos por ejemplo a `"ferreteria-lopez"`, y listo. Comparten el
proyecto, la clave y el usuario, pero:

- cada panel ve sólo sus publicaciones
- cada web muestra sólo las suyas
- las fotos van a carpetas separadas dentro del mismo depósito
- el SQL se corre una sola vez, nunca más

Probado con dos locales a la vez: ninguno ve al otro.

### Antes de sumar el segundo

Corré de nuevo el bloque de SQL del asistente. Es el mismo, se puede correr las
veces que quieras, y agrega la columna `negocio` a la tabla si no estaba.

### Un aviso sobre los permisos

Con las políticas actuales, cualquiera que **inicie sesión** puede escribir en
cualquier local. Mientras el único usuario seas vos, no hay problema. Si algún
día le das su propio usuario a cada cliente, hay que cambiar la política para
que cada uno toque nada más que lo suyo. Avisame y la escribo.

### Y lo que sí comparten

Los 500 MB de base, el 1 GB de fotos y los 5 GB de tráfico son del proyecto
entero, así que se reparten entre todos los locales. Y si el proyecto se pausa,
se apagan todas las webs juntas — por eso el despertador es más importante
cuantos más locales tengas.

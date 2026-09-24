# AEROPLAZA

Juego social 3D Frutiger Aero con multijugador por MQTT, sin servidor. Recrea
a @frutiger_space (TikTok) con otro nombre. Fuente: `aeroplaza/README.md` y los
comentarios de cada `js/`. Ver también: [rezona](rezona.md), [brillo](brillo.md)
(de ahí salen el sonido y las canciones), [maquina](maquina.md).

## Armarlo y probarlo

- `node aeroplaza/herramientas/armar.mjs` arma `aeroplaza.html` (2,3 MB, sin
  canciones: va al repo) y `aeroplaza-con-canciones.html` (4,2 MB, gitignorado,
  es el que se le entrega).
- El sonido es el de BRILLO: `../../brillo/js/sonido.js` y `canciones.js`.
  Menú = 'titulo' (Wii Party), plaza = 'colina' (Mii Maker). Los demás reinos
  usan los temas sintetizados: arrecife, aurora, cielo y ciudad.
- Las pruebas abren el HTML por `file://` con `?directo&pausa` y avanzan el
  juego a mano con `__A.paso(dt, dibujar)`:
  - se dibuja solo el último cuadro;
  - después un `readPixels` espera a SwiftShader. Si no, `screenshot` se
    cuelga 30 s esperando los cuadros encolados.
- Tiempos: `reinos.mjs` ~15 s por reino, `multijugador.mjs` ~3 min, `flujo.mjs` ~4 min.

## La red (lo que pidió, punto por punto)

- `js/red.js`:
  - NS `aeroplaza_v1_`;
  - sala `NS+reino-n` con /state, /chat y /action;
  - vestíbulo `NS+vestibulo`, con presencia cada 4 s, para contar las salas y
    elegir la más llena con lugar (máximo 14);
  - la casa, retenida en `NS+casa/<id>`.
- El estado va cada 100 ms si cambió, y un latido cada 1,5 s. Medido: quieto
  son 8 mensajes en 12 s.
- `js/remotos.js` guarda un Map por id. Interpola hacia targetX/Y/Z con
  `1-exp(-12·dt)` y borra a los 5 s sin noticias.
- Todo lo que llega se valida: colores `#rrggbb`, valores de las listas, daño
  de 0 a 30 y hasta 40 mensajes por segundo por id. El chat se pone con
  `textContent`.
- **El contenedor no llega al broker**: el proxy no pasa WebSocket ni el
  puerto 8084. Se prueba con `pruebas/broker.mjs`, un MQTT 3.1.1 sobre
  WebSocket en Node puro (CONNECT, SUB con + y #, retenidos, PING). Chromium
  carga mqtt.js de `pruebas/mqtt.min.js`, que no se commitea: `comun.mjs` lo
  baja con curl.
- Resultado: 16 de 16 pruebas bien.
  - Se ven y la interpolación es suave (-8,7 → -6,4 en 6 cuadros).
  - La apariencia viaja por hash y pedido.
  - Anda el chat, y el hit baja 10 de espuma solo a quien le toca.
  - A los 5 s se va el que no manda, y sin red queda "sin conexión" y se juega.
- **No se probó contra el broker público de verdad** (sin salida desde acá).

## Segunda vuelta: "no me deja jugar" + efectos pixel (24/09)

- No se supo la causa exacta: no hubo captura ni mensaje. Se arreglaron todas las causas probables.
  - **El bucle se pedía después de dibujar:** un error en un cuadro congelaba
    todo. Ahora primero va `requestAnimationFrame(bucle)` y después `try`, más
    un cartel de error con "calidad baja" y "recargar"
    (`pruebas/resiste.mjs`).
  - **En el celu arrancaba en alta**, con MSAA, doble de píxeles y sombras de
    2048. Ahora arranca en media. La automática mide 60 cuadros de tiempo real
    (no el dt recortado) y baja; en compu puede subir.
  - Hay un cartel de "cargando" en el HTML mismo, que se ve sin JavaScript. A
    los 7 s dice que se abra con Chrome o Safari. También hay `<noscript>`,
    aviso sin WebGL y aviso de contexto perdido.
  - Hay un botón grande "▶ Jugar" en el menú y un tutorial de 5 pasos.
- **Estilos retro** (`motor.js › ESTILOS`, botón 👾): Pixel 270p, PS1 200p
  con temblor, Tubo, Game Boy 144p, 8 bits (paleta Sweetie 16) y VHS.
  - Se dibuja de verdad a pocas líneas, con `image-rendering: pixelated`: por
    eso también son la calidad más liviana.
  - El temblor de PS1 es un `#define PS1` en `ShaderChunk.project_vertex`, que
    se agrega a los materiales recorriendo la escena.
  - Las líneas de TV son una capa CSS a la resolución de la pantalla.
- `dist/aeroplaza-web.html` es la versión para publicar como Artifact: sin
  `<html>`/`<head>`/`<body>` y sin canciones. Ahí el CSP bloquea los
  WebSocket, así que se juega solo; la red deja de insistir tras 4 fallos.

## Trampas que ya se pagaron

- **`addEventListener(…, true)` se saca con `removeEventListener(…, true)`.**
  Si no, la ventana cerrada deja su Escape en captura y se come la pausa.
- **`confirm()` no anda en todos lados:** en los Artifacts devuelve false y no
  se podía comprar. Se pregunta con `UI.confirmar`.
- **Game Boy y 8 bits:** la escena es clara y todo caía en los tonos de
  arriba. Se usa una curva `pow(l, 1.3)` y la paleta de emulador. La de
  consola de fantasía pintaba el pasto de violeta; la Sweetie 16 tiene los
  celestes y verdes del Aero.
- **La animación CSS pisa el centrado.** Un `@keyframes` con
  `transform: scale()` le borró el `translateX(-50%)` al diálogo, y el botón
  Aceptar quedó fuera de pantalla. Los centrados usan `apareceC`.
- **Cajas con `BackSide`.** El zócalo de la tienda era una caja de lado de
  adentro: su cara de abajo tapaba el piso. Van tiras sueltas.
- **Texturas seamless como color.** El pasto y la arena de Rezona dejaban el
  suelo lavado. Se usan solo como grano: se divide por el último mip
  (`texture2D(t, uv, 12.)`) y el color lo pone el vértice.
- **Luz ambiente doble.** El cielo como `environment` más la hemisférica
  pintaban de celeste la arena y los caminos. Env 0,3-0,7, hemi 0,18-0,5 y
  la gelatina con `envMapIntensity` 2,2.
- **El bloom con umbral 0,9** abría en niebla todo lo blanco al sol: se usa
  1,45.
- **El vidrio con clearcoat y env**, mirado de costado, era una pared blanca.
  Va con opacidad 0,12, env 0,7 y borde fresnel.
- **El pasto instanciado fijo** o era ralo o eran millones de matas. Es una
  grilla que se enrolla alrededor del muñeco, 2R = 52 m, y lee la altura de
  una textura float horneada.
- **Las flores con 5 esferas** eran 500 triángulos cada una, la mitad de la
  isla. Planas: ~40.
- **El delfín de Tripo miraba a -z**: giro fijo π, medido con
  `pruebas/delfin.mjs`. Montado, el lomo va a -0,08 del agua; si no, el agua
  lo tapa.
- **Rezona con `n: 3`** devolvió una sola nube (g2 y g3 dan 404). Las otras
  dos se sacan espejando y recortando.
- **`PCFSoftShadowMap` ya no existe** en three 0.186. Las sombras se apagan en caliente con `sol.castShadow = false` (three recompila solo).
- **La hora fija de un reino.** La Aurora es de noche siempre: `?hora=` no la
  pisa.

## Rendimiento (medido en 390×844)

| calidad | plaza | llamadas | CPU del juego |
|---|---|---|---|
| alta | 930 mil triángulos | 205 | 0,34 ms/cuadro |
| baja | 429 mil (sin sombras, pasto ×0,28) | 124 | 0,32 ms/cuadro |

La calidad automática mide 150 cuadros y baja un nivel si pasan 26 ms.
No se probó en un teléfono de verdad.

## Lo que falta o se podría

- Probarlo contra `broker.emqx.io` desde una computadora con internet.
- Las canciones de los otros reinos, si las manda. Se suman con
  `brillo/herramientas/canciones.py` y el nombre del tema del reino.

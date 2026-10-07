# NEBULOSA — fusioná el universo

Juego de fusionar con física (tipo Suika) en neón synthwave y vertical. Una nave suelta cuerpos en un frasco y
dos iguales que se tocan se fusionan en el que sigue: polvo estelar, cometa, Luna, Marte, Tierra, Saturno,
Júpiter, enana roja, Sol, gigante azul y agujero negro. Dos agujeros negros hacen una supernova. Si algo se queda
arriba de la línea de peligro 3 segundos, se terminó.

- Modos: clásico (se guarda solo), relámpago (2 minutos) y desafío del día (los mismos cuerpos para todos).
- Cadenas de fusiones (multiplican), poderes que se ganan con puntos (sacudón y rayo), catálogo de lo descubierto.
- Música synthwave sintetizada que se pone más intensa cuando el frasco se llena.
- Controles a gusto: apuntar al dedo o arrastrando (con sensibilidad), soltar al levantar o con botón, línea guía,
  tamaño de botones, zurdo y vibración (con zona para probar).
- Intro: la de JXSTUDIOS compartida (`motor2d/intro-jxs.js`) vestida de cartel de neón (`js/intro.js`).
- Un solo archivo `nebulosa.html` (unos 105 KB, sin internet). Armar: `node motor2d/armar.mjs nebulosa`.
- No es de píxeles: el lienzo va a la resolución real y se dibuja en unidades de 360 de ancho (`S`).

| archivo | qué tiene |
|---|---|
| `js/base.js` | tamaños, guardado, textos en es/en/pt, letra con brillo |
| `js/cuerpos.js` | los once cuerpos pintados, brillos, anillos, disco, cola |
| `js/fisica.js` | círculos con gravedad, separación, rebote, fusiones |
| `js/sonido.js` | synthwave y efectos |
| `js/intro.js` | el estilo neón de la intro |
| `js/juego.js` | escenas, apuntado, fusiones, peligro, el bucle |

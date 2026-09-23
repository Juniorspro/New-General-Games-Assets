## BRILLO: qué se lleva y qué se rehace

Es plataformas 2D en pixel art de 360 de alto, 6 mundos y 3 idiomas. El juego
armado pesa unos 210 KB: entra de sobra en los 4 MB del paquete principal.

**Se lleva tal cual (no toca el navegador):**
- `js/fisica.js`: la física, pura y determinista a 60 pasos por segundo.
- `js/niveles.js`: los 6 mundos.
- `js/historia.js`: los guiones de cada mundo, que solo le hablan al director.
- `js/textos.js`: español, inglés y portugués. `Idioma` guarda con
  `localStorage`: cambiar esas dos líneas.
- El dibujo, en canvas 2D:
  - `js/juego.js`;
  - `js/personajes.js`;
  - `js/objetos.js`;
  - `js/fondos.js`;
  - `js/efectos.js`;
  - `js/tiles.js`: crea lienzos con `document.createElement('canvas')` en
    `pintarNivel`;
  - `js/pixel.js`: `lienzo2d()` es el único lugar donde crea lienzos.
    Cambiando esas dos funciones por `tt.createCanvas()`, todo lo demás
    dibuja igual.

**Se adapta:**
- `js/post.js`: bloom, destello, rayos y color, en WebGL2. Si el runtime no
  da WebGL2, el juego ya sabe andar sin post: dibuja el lienzo escalado.
- `js/sonido.js`: el sintetizador (WebAudio) y los dos estilos de música, Aero
  y 16 bits. Si el runtime no tiene WebAudio completo, lo más simple es grabar
  cada tema con la página y llevarlo como archivo.
- `js/director.js`:
  - el bucle, que se queda como está;
  - el guardado (`localStorage`);
  - `visibilitychange`;
  - `window.__brillo`, que es solo para las pruebas.

**Se rehace en el canvas:**
- `js/ui.js` y `brillo.css`: la interfaz de vidrio entera:
  - las burbujas del idioma;
  - "Iniciando sesión";
  - el título;
  - las ventanas;
  - la charla;
  - los avisos;
  - lo de arriba;
  - el cartel del mundo;
  - la narración;
  - los créditos.
  Cada pantalla es una función chica: se pueden rehacer una por una con los
  mismos textos.
- `js/tactil.js` y `js/entrada.js`: el joystick y los botones son elementos
  HTML. En el runtime se dibujan en el canvas y los toques se reparten por
  zona:
  - la mitad izquierda es el joystick;
  - las burbujas de salto y zumbido van a la derecha.
  `Entrada.leer()` ya devuelve lo que la física necesita: solo cambia de
  dónde vienen los toques.
- `js/pantalla.js`: el giro de 90° y la escala. En TikTok la orientación
  horizontal va fija en el paquete; queda solo la cuenta de la escala.

**Para probar que no se rompió nada:**
`node --max-old-space-size=6144 brillo/pruebas/recorrido.mjs` recorre los 6
mundos con la física real (unos 15 minutos). Se puede correr después de
cada cambio a `fisica.js` o a `niveles.js`.

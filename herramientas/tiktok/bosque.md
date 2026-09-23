## BOSQUE: qué se lleva y qué se rehace

Es un juego en tercera persona en un bosque al atardecer, con filtro VHS y
cinco cintas para encontrar. Está hecho con three.js y tiene modelos GLB y
texturas webp.

**Lo más importante: el tamaño.**
- `assets/` pesa unos 9 MB, y el HTML de un archivo, unos 13 MB (con todo
  adentro en base64).
- El paquete principal de TikTok admite 4 MB: los modelos y las texturas
  tienen que ir en subpaquetes o bajarse de un servidor declarado.
- El total (30 MB) sí entra.
- `dist/` separa el código (`juego.js`) de los datos (`datos/`): ese armado es
  el punto de partida.

**Motor:** three.js no es uno de los motores que TikTok lista (Cocos Creator,
LayaAir, Unity). Hay dos caminos:
- adaptarlo, con canvas y contexto WebGL del runtime;
- rehacerlo en uno de esos motores, llevándose modelos, texturas y la lógica.

**Se lleva tal cual:**
- `js/terreno.js`, `js/colision.js`, `js/senderos.js` y `js/azar.js`: el
  terreno y los choques, puros.
- `js/config.js`.
- `js/arboles.js`, `js/flora.js`, `js/agua.js`, `js/cielo.js`, `js/fuego.js`,
  `js/props.js` y `js/motas.js`: arman la escena de three.js.

**Se adapta o se rehace:**
- `js/control.js`: mouse con puntero bloqueado y dedos en HTML. En TikTok,
  toques en el canvas.
- `js/osd.js`: lo que se ve encima (el texto del VHS) es HTML.
- `js/main.js`: el arranque, la carga y el DOM.
- `js/cargador.js`: carga los GLB y las texturas; ahí van las rutas de los
  subpaquetes.
- `js/audio.js`: WebAudio.
- `js/post.js`: el filtro VHS, un pase de three.js.

# Juegos

La receta visual completa está en `GUIA-JUEGOS.md`: abrila por sección, y la
`§ 11` son las trampas. Ver también: [rezona](rezona.md), [maquina](maquina.md)
(para probar), [higgsfield](higgsfield.md). El catálogo de carpetas está en el
[índice](INDICE.md).

## Cómo se hacen acá

- Web y para el teléfono primero: una mecánica pulida antes que muchas.
- Cuando piden HTML, un solo archivo que abre con doble clic y anda sin
  internet. Ya lo tienen `pique/`, `perro/`, `flores/` y `bosque/`
  (`*-en-un-archivo.html`).
- Para el HTML único, three.js se empaqueta con esbuild en un IIFE, y cada
  textura y modelo va como `data:` URI y sin `fetch`: los GLB con `atob` y
  `parse`, y las texturas como `<img>`. Receta: `bosque/herramientas/armar.mjs`.
- Los assets generados se buscan por nombre y tienen su reemplazo dibujado o
  sintetizado (`enjambre/`, `perro/`). Así Rezona puede estar caído sin trabar
  el juego.
- En `pique/`, `pique2d/` y `espejo/`, los niveles los comprueba una máquina
  antes de publicarse.

## El bosque (22/09/2026)

- Código en `bosque/js/`:
  - `main` es el lazo;
  - `cielo` hace la luz y la niebla;
  - `arboles` son procedurales, con tarjetas de foto y tres niveles de detalle;
  - `flora`, `terreno` y `agua`;
  - `personaje`, `camara` y `control`;
  - `post` es el VHS, `audio` es todo sintetizado y `cintas` es el objetivo.
- Herramientas en `bosque/herramientas/`:
  - `procesar_assets.py` (texturas, recortes, cielo);
  - `optimizar_modelos.mjs` (gltf-transform);
  - `armar.mjs`;
  - `higgsfield.json`.
- Armar: `cd bosque && npm ci && node herramientas/armar.mjs`. Deja `dist/`
  para Rezona, con los assets en `dist/datos/`, y `bosque-en-un-archivo.html`
  de 12,1 MB.
- Jugar: `rezona.ai/game/pgcserver/play/VvyVJutbOf` (v1) o el HTML único.
- Medido en calidad alta: de 310 a 760 mil triángulos y de 60 a 74 llamadas de
  dibujo por cuadro. **Los FPS en un teléfono de verdad no están medidos.**
- Pruebas: `pruebas/cintas.mjs` (la partida entera, 26 comprobaciones),
  `un-archivo.mjs` y `ver.mjs`.

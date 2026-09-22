# ZONDA

Plataformas de precisión a lo Celeste, en pixel art y para el teléfono parado.
Ayelén sube un cerro de los Andes detrás de las cartas que el viento Zonda se
llevó la noche que murió su abuela Rosa, la cartera del cerro.

- **Jugar:** `zonda.html`. Es un solo archivo, se abre con doble clic y anda
  sin internet.
- **Contenido:** 4 capítulos de 5 salas cada uno: quebrada, mina, glaciar y
  cumbre, más el final. Hay 19 cartas escondidas, diálogos con retratos,
  música y sonido sintetizados, y ayudas (velocidad, dash infinito,
  invencible, reloj).
- **Controles:**
  - Teclado: flechas o WASD, `C`/`K`/espacio salta, `X`/`J` dash y `Z`/`L`/Shift
    agarra.
  - Mando: A salta, X hace dash y los gatillos agarran.
  - Táctil: el pulgar izquierdo mueve y apunta; a la derecha van salto, dash y
    agarre.

## Cómo está hecho

- El motor compartido está en `../motor2d/` y el juego en `js/`:
  - `fisica`: la física de Celeste, pura y sin azar;
  - `salas`, `historia`, `arte`, `musica`, `dibujo`, `pantallas` y `juego`.
- Armar: `node motor2d/armar.mjs zonda` (desde la raíz). Junta
  `juego.json` e `index.html` en `zonda.html`.
- Cada sala se comprueba con la misma física del juego:
  - `node zonda/pruebas/resolver.mjs [sala] [--ver]` busca cómo pasarla y guarda
    `pruebas/soluciones.json`.
  - `--cartas` comprueba que cada carta se agarra y que, con ella, se sale.
- `node zonda/pruebas/partida.mjs` repite esas soluciones en el HTML de verdad,
  en Chromium. Así se comprueba que el resolvedor y el juego dan lo mismo.
- `node zonda/pruebas/manos.mjs` prueba los menús con el dedo y con el
  teclado, la palanca con dos dedos (CDP), el teclado y un mando simulado.
- `node zonda/pruebas/ver.mjs <carpeta>` saca capturas de teléfono.

# KUNTUR

Una nena, un pichón de cóndor y la montaña que lo espera. Juego 2.5D de papel
(recortes con pixel art sobre un diorama de cartón, como en Paper Mario) por
Purmamarca, los Siete Colores, las Salinas Grandes, el Tren a las Nubes, la
Puna y el Nevado de Chañi. En español, inglés y portugués.

**Jugar:** abrir `kuntur.html` con doble clic. Anda sin internet, con teclado,
mando o dedos.

- Flechas o A/D: caminar · Espacio o Z: saltar · X o E: hablar, agarrar la
  piedra y mandar a Apu · Abajo: agacharse · Esc: pausa.
- Apu va creciendo: en las Salinas aletea (doble salto), en la Puna planea y
  abre trabas.
- Las apachetas guardan el lugar. Hay 15 coplas escondidas.
- Controles de dedo a gusto (Opciones → Controles de dedo): cada botón se
  arrastra y se agranda, con palanca flotante, fija o en cruz, opacidad,
  modo zurdo y vibración.
- En el celular parado el juego se gira solo 90° para jugarse acostado (y
  pide pantalla completa horizontal si el teléfono lo deja).
- La gente y los animales se mueven todo el tiempo (tejen, cavan, saludan,
  pastan, huyen) y las escenas tienen cinemáticas con franjas y gestos.

**Armar:** `node kuntur/herramientas/armar.mjs` (usa three y esbuild de
`bosque/node_modules`). Los mapas salen de `herramientas/mapas.py`.

**Probar:** `node kuntur/pruebas/recorrido.mjs [capítulo] [--guardar]` busca
con la física de verdad un camino por cada tramo y cada copla, y comprueba que
lo cerrado esté cerrado; `node kuntur/pruebas/partida.mjs` juega la partida
entera en Chromium, de la granizada a los créditos.

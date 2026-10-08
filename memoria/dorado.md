# DORADO (07/10)

"Hacé el último juego" (después de "¿cuánto vamos?": 4 propios ese día). Pinball vertical en Art Déco, el Gran
Hotel de los años 20: `dorado/dorado.html`, **158 KB**. Qué archivo tiene qué: `dorado/README.md`.

## Lo que hay que saber

- **08/10: sin intro y en 13 idiomas** ([idiomas](idiomas.md)); la intro quedó en git: `git show 1f2f036:dorado/js/intro.js`. La letra Limelight trae ahora Ğ İ Ö Ş.

- Armar: `node motor2d/armar.mjs dorado`. La mesa es fija (360 × 600) y va abajo; `Y0 = H − 600` es la marquesina
  (con H 640 queda de 40 y la misión se muestra chica arriba de la mesa).
- **La letra déco sin pesar**: el TTF de Limelight pesaba 132 KB; `herramientas/glifos.py` saca solo los
  contornos de los caracteres pedidos a un objeto JS (28 KB) y `textoDeco` los dibuja con Path2D (oro con degradé,
  borde y sombra). Sirve para cualquier fuente OFL en otro juego.
- Física (`js/fisica.js`): 12 subpasos; paredes = cápsulas; el flipper empuja con la velocidad del punto donde pega
  (s·ω), por eso la punta tira más. La puerta del carril del resorte es de una sola mano (choca solo desde arriba).
- **Medir antes de ubicar**: los carriles de arriba no los tocaba nadie. Se midió dónde cae la bola según la fuerza
  del resorte (`__pasoMesa` en la página, sin dibujo): de 0,40 a 0,49 cae entre x 210 y 297; ahí van J·A·Z·Z (el
  último sin poste a la derecha: un poste ahí frenaba la salida del resorte). "TOCAR" lanza con 0,40 a 0,62.
- Probar: `__dorado.bot = true` (flippers y resorte solos), `__dorado.turbo = 8` (8 pasos por cuadro),
  `__dorado.trabas = []` junta dónde se quedó quieta una bola (búsqueda de bola a los 3 s). 5 min simulados por
  modo: sin trabas, sin bolas fuera, rango DUEÑO, jackpots, A RELOJ termina a los 150 s.
- Portada: Higgsfield `95a6115b…` + "DORADO" con el TTF de Limelight en PIL (oro) y la moneda.

## Quedó

- Entregado con portada. Sin probar en un celu de verdad (el toque de las mitades, el resorte con el dedo, el
  rendimiento del brillo).

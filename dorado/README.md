# DORADO

Pinball vertical en Art Déco (el Gran Hotel de los años 20). Un solo archivo: `dorado.html`
(se arma con `node motor2d/armar.mjs dorado`).

- `js/letra.js` — los contornos de Limelight (Eric Fischer, SIL OFL 1.1) para mayúsculas, números y acentos,
  sacados del TTF con `herramientas/glifos.py`.
- `js/base.js` — pantalla lógica de 360 de ancho (la mesa mide 360 × 600 y va abajo; arriba, la marquesina),
  guardado, textos en es/en/pt, la letra déco y la sans espaciada.
- `js/fisica.js` — la mesa (paredes, gomas, hongos, blancos, copa, órbita, carriles J·A·Z·Z, flippers) y su física
  en 12 subpasos.
- `js/mesa.js` — el dibujo de la mesa: lo quieto en caché y lo que se mueve (lámparas, hongos, flippers, bola).
- `js/sonido.js` — trío de jazz sintetizado (contrabajo, piano, platillo; trompeta en la multibola) y los efectos.
- `js/intro.js` — la intro de JXSTUDIOS en oro sobre abanico de rayos.
- `js/juego.js` — escenas, reglas (misiones y rangos, multibola, jackpots, tiro maestro, bola salvada, bonus),
  modos (clásico, a reloj, del día), controles (mitades o botones que se arrastran) y el bucle.

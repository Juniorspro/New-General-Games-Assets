# SALAMANCA — la cueva del Mandinga

Roguelite vertical en pixel art, para jugar con un dedo en el celu parado (o con teclado en la PC).
Te movés para esquivar y te quedás quieto para disparar con el farol. Cada nivel da a elegir entre
tres naipes (bastos: disparos; espadas: daño; copas: vida; oros: lo demás). Son 4 pisos de 8 salas:
la 4.ª es el fogón del Pombero (descansar o hacer un trato) y la 8.ª, el jefe (Sapo Rey, La Viuda,
Lobizón y el Mandinga). Después se puede seguir bajando sin fin. Las almas que juntás quedan para el
altar (mejoras para siempre). El desafío del día usa la misma semilla para todos ese día.

- Un solo archivo: `salamanca.html` (unos 180 KB, abre con doble clic, sin internet).
- Armar: `node motor2d/armar.mjs salamanca` (lee `juego.json`).
- Todo el arte está escrito como texto en `js/arte.js`; el sonido y la música (una chacarera con
  guitarra Karplus-Strong, bombo y quena) se sintetizan en `js/sonido.js`.
- Español, inglés y portugués (`js/base.js`, `js/cartas.js`).
- Controles de dedo a gusto (`js/entrada.js`): palanca flotante o fija, tamaños, transparencia, zurdo
  y vibración; se arrastran en la pantalla de Controles y se guardan.

| archivo | qué tiene |
|---|---|
| `js/base.js` | tamaños, azar con semilla, guardado, textos |
| `js/cartas.js` | las cartas y el altar |
| `js/arte.js` | sprites, íconos, luces, los cuatro pisos |
| `js/sonido.js` | efectos y música |
| `js/entrada.js` | dedos, mouse y teclado |
| `js/sala.js` | armar y pintar las salas |
| `js/mundo.js` | jugador, bichos, jefes, balas, lo que se junta |
| `js/dibujo.js` | la partida en pantalla, HUD y mandos |
| `js/juego.js` | escenas, menús y el bucle |

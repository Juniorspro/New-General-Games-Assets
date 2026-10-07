# TAJO (07/10)

Cortar fruta con el dedo (tipo Fruit Ninja) en tinta sumi-e: `tajo/tajo.html`, **127 KB**. Qué archivo tiene qué:
`tajo/README.md`. La primera entrega salió **incompleta** (frutas que caían de arriba, bombas y vidas que no hacían
nada, la intro con volumen 30) y se quejó: "ni te hiciste el juego". Se rehízo entero. **Antes de mandar un juego,
correr el bot que juega cada modo** (abajo) y mirar una hoja de capturas: si algo de las reglas no pasa, no está hecho.

## Lo que hay que saber

- Armar: `node motor2d/armar.mjs tajo`. Lienzo liso como NEBULOSA (360 de ancho, alto 600 a 800, `S` = píxeles por
  unidad); la intro de JXSTUDIOS con `ESTILO_SUMI` (`js/intro.js`): pantalla negra que abre un tajo de luz, monograma
  a pincel con `i.TRAZOS`, sello rojo que cae en el golpe. Lleva `motor2d/fuente.js` (la intro lo usa igual).
- Frutas (`js/frutas.js`): polígonos (no círculos) para que el contorno de pincel varíe el grosor y se corte; dos
  dibujos en caché por fruta: la piel y el corte (pulpa). Las **mitades** son el dibujo del corte recortado por la
  línea del tajo (`dibujarMitad`, `lado` 0/1, `off` = giro de la fruta menos el del tajo).
- El filo (`js/fisica.js` + `filoPaso`): muestras del dedo con `getCoalescedEvents` y su `timeStamp`; corta solo el
  tramo que supera la velocidad de la sensibilidad (950/600/340 u/s). El combo es por pasada (se cierra al soltar o
  a los 0,25 s sin cortar), +n puntos desde 3.
- Vuelo: `lanzamiento()` da la velocidad para llegar justo a una altura (√(2gh)); la dificultad acelera el tiempo de
  las frutas, no cambia la curva. Diario con `rngSemilla(hoy())` en el contenido de las olas.
- Sonido todo sintetizado en la escala "in": koto, shakuhachi, taiko; cada corte toca una nota que sube con el combo.
- Probar (`window.__tajo`): `empezar(modo)`, `irA`, `cortarTodo()`, `G`. Ojo: `irA` no hace nada durante otra
  transición (esperar ~1 s después de saltar la intro). El bot de la sesión: barre la fruta más alta con el mouse,
  prueba fallas (3 sin cortar → fin a los 9 s), un combo de 4 en fila (+4), bomba en clásico, hielo en tormenta,
  pausa, dojo y controles; sin errores.
- Portada: Higgsfield `4e52f759…` (tajo de tinta cruzando sandía, naranja y durazno; sol rojo; bambú) + "TAJO" en
  Liberation Serif Bold ≤540 px de ancho, cortado en diagonal con la línea bermellón como en el juego, y la moneda
  (`jxstudios/img/moneda.webp`) abajo con halo de papel. Queda en `tajo/portada-tajo.jpg`.

## Quedó

- Entregado el HTML y la portada. Sin probar en un celu de verdad (que el dedo corte cómodo con la sensibilidad
  media, la vibración, el rendimiento con muchas manchas).

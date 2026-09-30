# Morfi — lo que enseñó (30/09/2026)
El juego está en `morfi/` (README con "Lo medido"). Pedido, con dos capturas de Cut the Rope en Google Play: "haz otro juego sobre este, recrealo al 10, que sea tipo de cartón, paper, GOTY; hacete buenos modelos y animaciones". Ver también: [juegos](juegos.md), [probar](probar.md), [globo](globo.md).

## Decisiones
- Original del género (se le dijo): se corta el hilo con el dedo, el caramelo va a la boca del personaje, tres estrellas por nivel. Morfi es una caja de cartón cuya boca son las tapas; nada del original.
- Todo de papel: recortes con sombra suave hechos una vez (`papel.js › recorte`, la sombra con shadowBlur y la figura corrida 4000 px afuera: `ctx.filter` no está en todos los teléfonos) y pegados girados con `pegar`.
- Morfi en perspectiva con una proyección chiquita (`morfi.js › pr`): las tapas giran de verdad sobre las bisagras. Ánimos: espera (parpadea, mira, bosteza a los 9 s), ganas (abre, lengua), feliz, triste.
- La intro de papel: corcho, hoja con cinta, una tijera recorta el JXS en colores, letras de revista, "presenta" en birome; el corcho se vuelve el cartón del menú. → `morfi/js/intro.js`
- El menú tiene un caramelo que se corta ahí mismo (Morfi lo come y baja otro). En el menú la pantalla de HTML es `pasante` (pointer-events: none salvo los botones): el lienzo recibe el dedo directo.
- Acostado o en la compu (ancho > 1,2 × alto, la MISMA cuenta en CSS `min-aspect-ratio: 6/5` y en `main.js › acostado`): Morfi grande a la izquierda y el cartel arriba de los botones. Con la regla de CSS por altura (max-height 560) la compu quedaba mitad y mitad.

## La física de los hilos: lo que costó
- Verlet con largos corregidos 20 vueltas, paso fijo 1/120: determinista, así las soluciones guardadas se pueden repetir. → `cuerdas.js`
- Con el hilo pesado (partículas de masa 1, caramelo 6) un globo no levantaba un caramelo con un hilo de 150 (el hilo pesaba el doble). Hilo liviano (`IM_HILO` 12: el caramelo pesa 72 veces un pedacito).
- Con esa diferencia de masas las vueltas solas dejaban estirar el hilo como elástico: una correa del alfiler a la punta (no más lejos que el largo) lo deja exacto (150,00 de 150) y la hamaca da 2,05 s contra 2,11 del péndulo ideal.
- El pedazo cortado que cuelga del caramelo es de una sola mano (lo arrastra, no tira): si no, cortar más arriba o más abajo cambiaba el vuelo. Al pasar por un sobre se sueltan todos los hilos (`soltarDe`): los pedazos lo tiraban para atrás.
- El abanico sobre un caramelo en globo rendía de más: con el roce del globo (0,975 por paso) la deriva es v × 0,33, cruzaba el tablero (420 px). Rinde 0,6.
- La boca abre arriba: se come lo que no viene subiendo (vy > −30). Con "arriba del medio de la boca" el globo que subía por adentro de Morfi se comía.
- `cruzan` con los dos extremos abiertos no cortaba un tajo que terminaba justo sobre el hilo (con el mouse y un hilo parado pasa seguido): cada tramo cuenta con su punta del final.

## Diseñar niveles (así salieron los 30)
- La física no depende de Morfi: se juega la plantilla de acciones con cientos de tiempos al azar (Morfi afuera) y se cuenta, por lugar posible de la boca, cuántas partidas pasan bajando. Morfi va donde más perdona.
- Ese lugar no sirve si también llega una jugada a la que le falta una acción (la acción sobraría) o si el caramelo pasa antes del evento que enseña el nivel (`despues: 'boing'`).
- Con Morfi puesto se buscan los tiempos de mayor margen: una acción ±0,04 y ±0,08 s; quien juega mira el caramelo, así que vale mover esa sola o esa y las siguientes. → `morfi/pruebas/tiempos.mjs` (el mismo criterio)
- Las estrellas, donde también pasan los caminos vecinos (salen aunque no se corte justo), separadas, adentro del tablero y fuera del camino de no hacer nada (a lo sumo una "gratis").
- Controles que atajaron niveles malos: cada acción hace falta, cada cosa del tablero se usa, el camino no se sale de la pantalla, sin tocar no se come. Todos están en `pruebas/logica.mjs`.
- Ver un nivel: `morfi/pruebas/ver.html?nivel=2-4` (verde la solución, rojo sin hacer nada).
- Números (30/09/2026): margen promedio 99 %; 1-10 y 2-8 al 92 %, 3-9 al 75 %; el resto 100 %.

## Trampas pagadas
- `export const ANCHO = 320, ALTO = 480` en `partida.js`: el empaquetador lo frena (lección de Globo); separado.
- Los toques por CDP acá tardan ~250 ms cada uno: el rastro del dedo (vive 0,22 s) no se llega a ver en una captura. Para mirarlo se meten puntos con hora futura en `entrada.rastros`.
- La tarjeta del final entra girando (CSS): medida a mitad de la animación, sus cajas "se pisan". La prueba de pantallas mide con `reducedMotion: 'reduce'`.
- Los botones torcidos adentro de una tarjeta torcida se pisaban al medir: adentro de `.tarjeta` van derechos.

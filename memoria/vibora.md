# Víbora.io — lo que enseñó (30/09/2026)
El juego está en `vibora/` (README con "Lo medido"). Pedido: "portear" slither.io como juego propio de JXSTUDIOS, con intro. Ver también: [juegos](juegos.md), [probar](probar.md), [cripta](cripta.md) (el mismo logo JXS).

## Decisiones
- Original del género: reglas (seguir el dedo, turbo que gasta y deja comida, cabeza contra cuerpo), no nombre, logo, pieles ni dibujos. Sin red: bots en el mismo teléfono (en línea hace falta un servidor). Así se le dijo a quien pide.
- El mundo corre siempre: en el menú los bots juegan atrás y la cámara sigue a una; JUGAR hace nacer tu víbora en ese mismo mundo. → `vibora/js/main.js`
- Menús en HTML encima del lienzo (el apodo necesita un campo de verdad para el teclado del teléfono); el juego entero en el lienzo.

## La víbora y el mundo
- Cuerpo = anillo de puntos cada 4 unidades; crecer es dejar de cortar la cola, y la cola se acorta a lo sumo 4 puntos por paso (si no, el turbo pega saltos). → `vibora/js/vibora.js`
- Comida en arreglos con grilla de 128 y la celda de cada bolita guardada (`fcel`): el imán mueve las bolitas, y sacarlas por la posición nueva dejaba restos en la grilla que se comían una y otra vez (masa de 1,3e9). → `vibora/js/mundo.js › sacarComida`
- Choques: la cabeza contra muestras del cuerpo en otra grilla que se rearma cada paso. 0,1 ms por paso con 22 bots (Node).
- Bots: 9 rayos para no chocar, puntaje de comida, los picantes cortan el camino; piensan a 10 Hz. 90 s con 22 bots: ~110 muertes, ninguna en el borde. → `vibora/js/ia.js`
- El ángulo queda entre −π y π: dando vueltas crecía sin fin y la prueba comparaba 4,71 con −π/2. → `vibora/js/vibora.js › pasar`

## Pantalla y dibujo
- Bolitas y halos dibujados una vez en lienzos chicos (un `drawImage` por bolita); fondos como patrón con `setTransform(DOMMatrix)` que sigue a la cámara. Pintado por procesador: 3,6 ms a 412×892 y 9,4 ms a 824×1784. → `vibora/js/dibujo.js`, `fondos.js`
- Calidad auto: si los cuadros tardan más de 26 ms seguido (90 de saldo), la densidad baja medio punto, de 2 hasta 1. → `vibora/js/main.js › cuadro`
- Teléfono acostado (alto ≤ 540 px): el menú pasa a dos columnas con grid; `#menu:not(.oculto)` para no pisar el `display:none` de `.oculto`. → `vibora/css/estilo.css`
- Con el teléfono parado la tabla ocupa el medio de arriba: los carteles ("¡Te comiste a…!") van debajo de ella. → `vibora/js/hud.js`
- Para que los botones entren en una línea a 360 px: pt "CALMO / PICANTE" y "PELE", en "ARENA".

## Trampas pagadas (30/09/2026)
- La P que sacaba la pausa la volvía a poner: `entrada.js` marcaba la pausa en su keydown, que corre después del de `main.js`. Ahora la pausa por teclado la maneja solo `main.js`, con `!ev.repeat`.
- Enter en el botón enfocado llega dos veces (la tecla y el clic que dispara): `entrar()` mira el estado antes.
- Los ángulos se comparan con la diferencia envuelta (`atan2(sen d, cos d)`): la víbora nace mirando para cualquier lado y, con el ángulo entre −π y π, una prueba de "dobló a la izquierda" falló la vez que cruzó −π.
- El servidor de prueba (`http.server` en el 8123) se muere solo de vez en cuando: si TODAS las pruebas dicen `ERR_CONNECTION_REFUSED`, es eso; se levanta con `nohup`.

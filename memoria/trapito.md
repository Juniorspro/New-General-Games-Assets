# Trapito — lo que enseñó (06/10/2026)
Gimnasia de trapo en 3D: colgado de barras, juntar vaivén, soltarse, girar y volver a agarrarse (regrabs). Idea de NoomiClone (James West), con física, dibujo y sonido propios. **El juego no está en el repo**: lo pidió "pa mí nomás" y se le entregó el HTML. Ver también: [juegos-3d](juegos-3d.md), [probar](probar.md), [morfi](morfi.md) (Verlet).

## El pedido
- Pidió portear el APK "tal cual"; no se pudo (ver [diario](diario.md) del 06/10/2026). Dijo "hacé uno exacto, es una idea libre": se hizo la misma mecánica con todo propio, y el crédito de la idea va en el menú.
- A mitad de camino dijo "Pero 3D we": la física quedó en 2D (el muñeco se mueve en un plano, como en el original) y el dibujo pasó a three.js.

## El muñeco de trapo (Verlet en subpasos)
- 7 puntos de costado (los dos brazos y las dos piernas van juntos), huesos rígidos, 10 subpasos por cuadro de 1/60 s y 2 vueltas de huesos.
- Músculos que corrigen POSICIONES, o un codo al lado de la mano clavada en la barra, le meten energía de la nada: colgado y quieto pasó de 1 086 J a 139 000 J en 10 s.
- Lo que anda: músculos como torques por VELOCIDAD (un servo con amortiguación y torque máximo) entre los dos lados de cada articulación, iguales y contrarios, sin mover el centro de masa; brazo de una pieza; la mano clavada solo para los huesos.
- Topes como resortes duros (ω 40) en vez de cortar el ángulo.
- El roce del aire: velocidad × 0,9996 por subpaso. Con menos roce la energía sube sola (quieto, de 1 136 J a 1 489 J en 30 s con roce 1): queda algo de inyección numérica que el roce tapa.

## Jugabilidad medida (bots en node, sin navegador)
- El ritmo de la ayuda (Arco yendo adelante, Bolita yendo atrás) lleva el vaivén a ~100–120° en ~10 s. Solo Arco adelante no pasa de ~70°.
- Sin ayuda, soltándose abajo el centro de masa sale a ~1,9 m del piso y cae en 0,5 s: a la barra de al lado (1,9 m) solo llegaba con un vaivén de ~140° justo. Agrandar el radio de agarre no cambiaba nada.
- Lo que lo arregló: en el aire los brazos buscan solos la barra más cercana al hombro (hasta 1,6 m), dentro de los topes del hombro. Con vaivén normal (~100°) y soltando adelante subiendo: a 1,6 m llega casi siempre entre 30° y 60°; a 1,9 m entre 40° y 50°; a 2,2 m una de cada cinco.
- Alturas: 35 cm más abajo es fácil (20°–40°), 20 cm más arriba a 1,7 m se puede (50°–70°), 40 cm más arriba cuesta (~57 %).
- Para atrás (de espaldas) llega a 1,6 m con poco vaivén (60°–80°); a 1,9 m casi nunca. Por eso el mapa de dos barras va a 1,6 m: ida y vuelta.
- La barra que soltó no se puede volver a agarrar sin medio giro en el aire: si no, soltar y agarrarse ahí mismo era un regrab regalado.
- Un bot "normal" (ese ritmo, soltar a 40°–50°) hace de 0 a 8 regrabs según el mapa: se puede, pero hay que practicar.

## El 3D
- three.js r160 metido en el HTML: el módulo envuelto en una función que devuelve sus `export` (sin servidor ni `import`); 706 KB en total.
- Cámara de costado, 1,5 m más alta y 2,2 m corrida: a la altura de la barra, la que queda justo enfrente se ve de punta (un puntito).
- El parante de adelante queda entre la cámara y el muñeco: va casi transparente y sin tensores (los tensores eran una maraña de líneas).
- Muchos árboles, nubes y ventanas: `InstancedMesh` (una llamada de dibujo); los edificios, cajas juntadas en una sola geometría con las ventanas a escala por UV.
- En Chromium sin GPU (SwiftShader) un cuadro tarda ~0,4 s: no sirve para medir la velocidad en un celular (sin comprobar en un celular).

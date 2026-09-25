# AEROPLAZA — décima vuelta (26/09/2026): super optimización y el tráiler

Sigue de [aeroplaza-10](aeroplaza-10.md). Rama `claude/fijate-iszyer`.

## Lo que pidió

- "Optimizale aún más: quitá sombras, brillos, etc., hacé todo tipo de
  gráficos para todos los celulares. A mí me va bien, pero para otros no."
- "Un tráiler del juego como el de BRILLO pero mil veces mejor, con las
  músicas del juego, gameplay de fondo, todas las características y motion
  graphics."
- Antes había dicho "no carga": era la espera de 15-20 s en SwiftShader, y
  después confirmó que anda.

## Optimización (medida con SwiftShader, el peor celu posible)

- **Lo que pesaba era la geometría, no los materiales.** En baja, la plaza
  dibujaba 1,75 millones de triángulos en 459 llamadas:
  - los árboles de lejos solos eran 267 mil;
  - la terminal, 67 mil, porque cada caja redondeada tenía 588 triángulos;
  - las burbujas, 65 mil;
  - cada hotel, 49 mil.
  Con Basic en lugar de PBR solo bajaba un 30 %.
- **Mínima** (`motor.js › CALIDADES.minima`):
  - dibuja derecho a la pantalla, sin la cadena de efectos (sin brillo ni
    posproceso);
  - 0,6 de los píxeles;
  - sin pasto;
  - los materiales sin barniz, tornasol ni brillo de tela
    (`motor.simplificar`);
  - reflejos cada 60 s;
  - la niebla y el corte a 95 m;
  - cajas con 1 segmento y la mitad en cilindros y esferas.
- **Cada calidad tiene sus límites**: `lejos`, `arbolCerca`, `burbujas`,
  `refl`, `seg` y `curvas`. Baja corta a 170 m, media a 300 y alta no corta.
- **`detalle.js`** hace el corte por distancia:
  - las piezas de primer nivel se cortan detrás de la niebla. `visible` pasa
    a ser un getter "lo que quiere el juego Y no está cortado", así no se
    pisa lo que el juego esconde;
  - las instancias quietas se reordenan y se dibujan las de cerca.
  - Las que se mueven solas se detectan porque cambia su `instanceMatrix.
    version`, y se dejan.
- **Los ShaderMaterial propios** (cielo, mar, burbujas) escribían el color
  lineal. Al dibujar derecho les falta el sRGB: `motor.ajustarShaders` les
  agrega `tonemapping_fragment` y `colorspace_fragment`. Hacia un destino
  intermedio no hacen nada.
- **La carga**:
  - `renderer.debug.checkShaderErrors = false` (con `?depurar` sí se
    revisan). Eran 9 de los 14 s en SwiftShader: bajó de 13,5 s a 2,9 s;
  - los shaders se compilan con `compileAsync` mientras está la pantalla de
    carga o la del viaje. Con `?pausa` no, para no trabar las pruebas.
- **Otros ajustes**:
  - en baja y mínima, nada de `backdrop-filter` en la interfaz
    (`.calidadBaja *`);
  - la calidad automática baja de baja a mínima;
  - por software y en los aparatos más flojos se arranca en mínima;
  - si se pierde el contexto de WebGL, se pasa a mínima.
- **Resultado en la plaza (SwiftShader)**: mínima dibuja 580 mil triángulos y
  va a 3,3 cuadros por segundo, contra 1,8 de la baja de antes.
- Prueba: `pruebas/calidad.mjs` da 11 bien.

## El tráiler (`aeroplaza/trailer/`)

- **Cómo se corre** (dura 61 s, 9:16):
  ```
  node aeroplaza/herramientas/armar.mjs
  node aeroplaza/trailer/grabar.mjs tomas [--vista] [--solo=id,id] [--rehacer]
  node aeroplaza/trailer/grabar.mjs audio
  node aeroplaza/trailer/grabar.mjs video
  ```
- **Los archivos**:
  - `guion.js` tiene la música, las partes, los planos y los sonidos;
  - `tomas.js` tiene lo que hace el juego en cada toma (corre adentro de la
    página);
  - `sonidos.py` hace los efectos con numpy;
  - `remotion/src/` tiene el montaje. `remotion/node_modules` es un enlace al
    de BRILLO.
- **La música**: son 4 canciones del juego, cortadas en golpes medidos con
  flujo espectral y un peine.
  - bosque: 115,03 BPM, primer golpe a 0,217 s;
  - juegos: 83,09 BPM, fase 0,030 s. El bucle del juego (32,05 s) no cae en
    golpe;
  - runner: 174,99 BPM, fase 0,0857 s. El drop es el golpe 56 (19,29 s);
  - titulo: 62,86 BPM, primer golpe a 0,398 s.
  - Cada parte se lleva a su volumen con loudnorm y el total a -14 LUFS, con
    pico -1.
- **Las tomas son el juego de verdad**:
  - `?directo&pausa&calidad=alta`, sin MSAA (costaba 1,3 s más por cuadro);
  - 1080×1920, a unos 2,5 s por cuadro;
  - reloj propio (`performance.now`, timers y rAF) y sin sonido.
- **Cómo se guionan**:
  - los dedos salen de `A.J.ent.leer`;
  - la cámara de cine va después de `paso(dt, false)`, y después se dibuja;
  - los jugadores de mentira son `remotos.recibir` en cada cuadro (si no, a
    los 5 s se olvidan);
  - el runner lo juega el bot de `pruebas/bot-runner.mjs`, con
    `E.tiempo` = el segundo de la canción. Así lo roto y las palabras de
    delirio caen con la música.
- **`--vista`** graba a 270×480, un cuadro de cada 6, y arma hojas de
  contactos. Con eso se encuadró todo antes de las ~1,5 h de la grabación
  grande.
- **Estilo propio**, distinto de BRILLO: tarjetas blancas de Wii con rayas,
  el logo AERO/PLAZA azul y verde, avisos de Windows 7, el botón Frutiger con
  onda, la mano de Wii y ventanas de error de Aero.exe en cascada.

## Trampas de esta vuelta

- **En vertical, el campo horizontal es de ~35°**: con fov 58, una cámara
  "al costado mirando adelante" deja al muñeco afuera. Hay que mirar al
  muñeco.
- **Las alturas de la cámara tienen que ir desde el piso**
  (`mundo.altura`). Con valores fijos quedaban adentro del pasto.
- **Los minijuegos (tiro, parkour) arrancan con una cuenta de 3,4 s**: hay
  que saltearla.
- **Apuntar en primera persona**: `yaw = atan2(-dx, -dz)` y
  `pitch = 0,3 − atan2(dy, horiz)`, como `camara.js › actualizarFP`.
- **El material neón** (y el cromo) del muñeco satura la imagen con el
  brillo: en el tráiler no.
- **El bot en un hueco**: al poner al jugador antes de una compuerta, hay que
  usar el principio de su tramo. Si no, cae entre tramos.
- **Los géiseres del jardín soplan en un ciclo de 7 s** (2,5 s soplando,
  `G.s.activo`): se espera a que empiece.
- **Los hongos no tienen nombre**: se encuentran por sus sólidos con
  `rebote`.

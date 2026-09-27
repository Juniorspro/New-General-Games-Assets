# AEROPLAZA — trigesimotercera vuelta (27/09/2026): la malla del cuarto, como Asalto MR pero más fina

Pidió, con su APK `asalto-mr.apk` (`com.juniorspro.asaltomr`, suya): "este tipo de escaneo quiero, pero aún más
preciso, que llene zonas que no llega y que la parte ya escaneada no se reescanee". Antes:
[aeroplaza-29](aeroplaza-29.md) (tu espacio: planos y cubitos de 5 cm) y [aeroplaza-33](aeroplaza-33.md).

## Lo que hace Asalto MR (desarmado con `dexdump`, en el scratchpad)

- `Tsdf`: bloques de 16³, peso hasta 60. La profundidad de ARCore (mm y confianza) se funde con una banda de
  `trunc + 0,02·z²`, y "talla" el vacío en 1 de cada 5 píxeles.
- El cubito es de 5 cm (7 o 10 en menos detalle). `Mallador` arma la malla con 18³ muestras y peso mínimo 4.
- `MallaGl` la dibuja con líneas violeta y turquesa (según la normal), una ola que sale de uno y se apaga de 4 a
  9 m. También tiene la cámara reproyectada sobre la malla.

## Lo que quedó (`android/…/Malla.java`, sin Android)

- **TSDF de 3 cm** en bloques de 16³ (48 cm; la distancia en `short`, el peso en `byte`; hasta 2.600 bloques,
  ~31 MB).
  - Cada píxel de profundidad (160 × 120; uno de cada 2 × 2 si es más grande), de 0,2 a 5 m, con confianza ≥ 90.
  - La banda es de 6 cm + 1,2 cm·z². Pesa 2 si la confianza pasa de 200 y está a menos de 3 m; si no, 1. Más
    allá de 3,5 m entra la mitad de los píxeles.
- **Tallar** (1 de cada 3 píxeles): el vacío antes de la superficie pierde peso y va hacia +1. Lo que estaba
  "adentro" de algo y ahora se ve a través pierde el doble. Con peso 0 queda VACIO (visto vacío).
  - Solo hasta donde el rayo pasa a más de la banda de la superficie que toca: `banda·1,3/cos`, con la normal
    sacada de los píxeles vecinos. Sin eso, los rayos rasantes hundían el piso 1,2 cm.
- **La malla** (surface nets): un vértice por celda que cruza, en el promedio de los cruces; un cuadrado por
  arista.
  - Las muestras van de −1 a 16 (con los 26 vecinos) y cada bloque hace las aristas de 0 a 15: no hay costuras.
  - Cada vértice ocupa 16 bytes: x, y, z en float; la normal en 3 bytes; y las banderas (1 relleno, 2 hecho,
    esquina × 4).
- **Llenar**:
  - los huecos chicos: un cubito sin ver entre dos vistos firmes (peso ≥ 6, hasta 3 de cada lado, por un eje)
    toma el valor interpolado; lo VACIO no deja pasar;
  - los planos de ARCore (cada 2 s): lo que cubren y nadie vio se llena con RELLENO (±2 cubitos de la normal);
    lo que se vea de verdad lo reemplaza.
- **Hecho** (no se reescanea): cuando pasan cuatro cosas juntas, el bloque queda fijo (no tiembla, no gasta) y
  se ve verdoso.
  - Lleva 8 mallas.
  - Estuvo 4 mallas quieto: menos cambios grandes (>0,04) que 1/30 de su superficie, contando el tallado.
  - El 85 % de su superficie tiene peso ≥ 16.
  - Tiene al menos 24 cubitos de superficie.

## Por dónde pasa

- **`Espacio.java › profundidad`**: copia la profundidad y la confianza, y si la malla está libre se las da a su
  hilo (`fundir`).
- **`fundir`**:
  - integra, y llena con los planos cada 2 s;
  - malla lo cambiado: cada bloque a lo sumo cada 350 ms, 60 por vez;
  - guarda los bytes en `mallas` (clave `bx_by_bz`);
  - avisa `__nativo.malla([[clave, bx, by, bz, versión, bytes, hecho]…], total, hechos)`.
- **`MainActivity`** sirve `/malla/<clave>.bin`. Sin profundidad siguen los cubitos de la nube de puntos.
- **`espacio.js`**:
  - baja los bloques de a 4 y los junta en trozos de 3³ bloques (una malla de three por trozo);
  - la grilla va cada 12 cm sobre la superficie, del eje que más mira (con los cuadrados de 3 cm quedaba tupida);
  - los colores: piso celeste, pared lila, mesa amarilla (lo horizontal a más de 30 cm del piso), techo;
  - lo hecho, verdoso; lo relleno, tenue; con la ola.
  - Con malla no se dibujan los planos. La tarjeta dice los cuadrados y el "% listo", y al terminar se desvanece
    (`uVer`).

## Medido

- **`pruebas/malla.mjs`, 14/14.** La parte Java es `pruebas/malla/PruebaMalla.java`: un cuarto de 4 × 2,6 × 5 m
  con una mesa, un palo de 5 cm, ruido 2 mm + 4 mm·z², el 8 % de los píxeles que faltan, un parche del piso y lo
  alto de una pared que nunca se ven, y una persona que pasa y se va.
  - Error de los vértices: mediana 1,9 mm, promedio 2,8, el 95 % a menos de 7,5 mm.
  - Corrimiento de cada superficie: piso +0,1 mm, paredes +1 a +2, techo +6.
  - El piso, 1.785 de 1.785; el parche, 36 de 36; lo alto de la pared, 441 de 441 (con el plano).
  - La persona, 0 vértices.
  - Hechos 313 de 581 bloques, ninguno cambió después.
  - En la compu, 9,8 ms por foto y 0,26 ms por bloque (en un celu, ~4 veces).
- **Con cubitos de 5 cm** (el tamaño de Asalto, con este mismo código): en lo liso es igual (2,5 mm de promedio),
  pero el palo sale en 9 de 10 alturas (con 3 cm, 10 de 10) y hay 3,6 veces menos detalle.
- **En el juego**: los 366 bloques bajan y se juntan en 53 trozos; 87.149 cuadrados, los mismos que Java. Se ve
  (captura `pruebas/salida/malla-espacio.png`), la tarjeta dice 54 % listo, se va al terminar y "escanear de
  nuevo" la borra.

## Trampas

- **Tallar con rayos rasantes hunde las superficies**: el tallado tiene que respetar la banda de lo que el rayo toca.
- **"Quieto" contando cambios de signo no alcanza**: lo que el tallado va borrando de a poco no cambia de signo
  hasta el final, y se congelaba con la persona adentro.
- **El relleno de huecos resucitaba lo borrado**: por eso VACIO, y las anclas firmes.
- **La tanda en paralelo hace más lenta la prueba de Java**: el tope es 25 ms por foto.
- **Falta en el celu**: cuánto tarda de verdad (el hilo de la malla, ~40 ms por foto), y si con la profundidad de
  un celu real la malla sale tan limpia.

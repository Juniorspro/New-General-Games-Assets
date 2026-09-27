# AEROPLAZA — trigesimoquinta vuelta (27/09/2026): que escanee de verdad (la cámara antes de arrancar)

Pidió, después de [aeroplaza-35](aeroplaza-35.md): "no, pues no escanea el entorno". Sin celu para probar: se
arreglaron las tres causas posibles y la tarjeta ahora dice en qué paso se traba.

## Las tres causas (lo que había en la vuelta 35)

- **Cambiar la cámara en el hilo de GL**: `conProfundidad` pausaba y reanudaba la sesión dentro de `onDrawFrame`,
  antes de `update`. Eso puede dejar la sesión trabada o tirar un error que nadie veía.
- **Los pedidos llegaban antes que ARCore**: `arEscanear` y `arPasante` se perdían si `ar` todavía no existía
  (el primer `arIniciar` va a la cola del hilo de la interfaz, y el pedido de escanear llega por el puente antes).
- **La tarjeta no decía nada mientras buscaba**: la línea 📡 solo se dibujaba en la fase `escaneo`. Si ARCore no
  te seguía, se quedaba en `buscando` sin decir por qué.

## Lo que quedó

- **La cámara se elige antes de arrancar**: `Ar.java › iniciar`, con la sesión pausada (si ya corría, primero
  `gl.onPause()` y `sesion.pause()`).
  - `elegirParaProfundidad` prueba las de 30 fotos por segundo, primero la misma cámara con la foto más cerca de
    640 × 480, hasta una con `isDepthModeSupported(AUTOMATIC)`.
  - Se prueba una vez por pedido (`camaraDeProfundidad`): si el celu no tiene ninguna, no se pausa a cada rato.
  - Al volver a jugar, `elegirCamara` pone otra vez la de 60.
  - Le avisa al juego con `espacio camara ok · 30 · sin-profundidad · error: …`, que va a `Nativo.camaraEspacio`
    (aparte de `Nativo.espacio`, para no pisar `profundidad` o `puntos`).
- **El juego lo pide antes**: `J.entrarVR(sbs, manos, { conAR, escanear })` llama a `Nativo.arProfundidad(escanear)`
  antes de `vr.entrar` (que es el que llama a `arIniciar`). `entrarEspacio` pasa `escanear: true`; el VR normal,
  `false`.
- **Los pedidos se guardan**: `MainActivity` guarda `quiereEscanear`, `quierePasante` y `quiereProfundidad`, y los
  aplica cuando crea `Ar`.
- **Los errores de la profundidad se ven**: `Espacio.java › profundidad` solo calla `NotYetAvailableException`
  (las primeras fotos). Cualquier otro error va a la tarjeta como "⚠ malla: prof <error>".
- **La tarjeta dice el paso**, en las dos fases (`espacio.js › textoMalla`, arriba a la derecha, sin pisar el
  título), en este orden:
  1. ⚠ malla: el error del hilo de la malla o de la profundidad;
  2. ⚠ escaneo: ARCore con error, sin permiso o no soportado;
  3. ⚠ escaneo: `espacio error` o `camara error`;
  4. "ARCore no te sigue: mirá cosas con luz y movete despacio";
  5. "prendiendo el escaneo…" (todavía no llegó `espacio …`);
  6. "sin profundidad: la malla sale de los planos";
  7. "esperando la profundidad…";
  8. "profundidad: N fotos · ms".

  Del 4 en adelante suma "· N planos".

## Medido

- `pruebas/malla.mjs`, 18/18. Las 2 nuevas:
  - `arProfundidad(true)` llega antes que `arIniciar`, y `espacio camara 30` queda en `camaraEspacio`;
  - la tarjeta dice ARCore, la cámara, "prendiendo" y "sin profundidad".
- `nativo` 18/18, `espacio` 28/28, `camara` 13/13. La APK `--canciones` compila (23,9 MB).

## Trampas

- **`setCameraConfig` solo con la sesión pausada**, y mejor fuera del hilo de GL: se hace en `iniciar`, que corre
  en el hilo de la interfaz.
- **`isDepthModeSupported` depende de la cámara elegida**: hay que preguntarlo después de cada `setCameraConfig`.
- **Falta en el celu**: qué dice la línea 📡 (con eso se sabe cuál de las causas era).

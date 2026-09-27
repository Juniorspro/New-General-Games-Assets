# AEROPLAZA — trigesimosexta vuelta (27/09/2026): la linterna apagaba el escaneo

Mandó una captura de tu espacio con la APK de [aeroplaza-36](aeroplaza-36.md): "📡 esperando la profundidad…",
piso "—", 0 paredes, 0 objetos, 12/12 mirado, la cámara bien y la linterna prendida (punto verde). O sea: ARCore
seguía, pero no había ni un plano ni una foto de profundidad.

## La causa (la más probable, sin el celu)

- **`Ar.flash` hacía su `sesion.configure` desde el hilo de la interfaz**, con la config que leía en ese momento.
  El escaneo hace el suyo en el hilo de GL. Si la linterna automática (vuelta 33, se prende al entrar con poca
  luz) leía antes de que el del escaneo terminara, volvía a configurar con los planos y la profundidad apagados.
- Planos y profundidad apagados a la vez es justo lo de la captura: sin planos, y la profundidad que nunca sale.
- **Y la tarjeta no podía decirlo**: el estado de la malla solo se mandaba desde `fundir`, que corre cuando entra
  una foto de profundidad. Sin ninguna, "esperando" para siempre y el error guardado sin mandar.

## Lo que quedó

- **Toda la config en un lugar**: `Ar.aplicarConfig`, en el hilo de GL antes de `update`. Junta en un solo
  `configure` lo que pidió el juego (`Espacio.preparar`: planos y profundidad) y la linterna (`flash` solo marca
  `flashSucio`).
  - Si falla con la linterna, reintenta sin ella: el escaneo no depende de la linterna.
  - `Espacio.configurado` lee la config de vuelta: lo que quedó de verdad, no lo que se pidió.
- **Vigila cada 2 s** (`Espacio.cuadro`): si la sesión perdió los planos o la profundidad, `reconfigurar` y
  `aplicarConfig` la configura de nuevo (cuenta `reconfigs`).
- **Al cambiar de cámara** (`iniciar`), el escaneo y la linterna se configuran otra vez.
- **La profundidad**:
  - cuenta las que salieron (`okProf`), las "todavía no" (`esperaProf`) y el último error (`errProf`);
  - si la cruda nunca sale (60 "todavía no" o un error, sin ninguna buena), usa la suavizada
    (`acquireDepthImage16Bits`) con confianza 200 (`profSuave`);
  - mientras no llega ninguna, también los puntos de la nube: algo se ve.
- **Si `hiloMalla.execute` falla**, `ocupadoMalla` vuelve a false (antes quedaba trabada para siempre).
- **El diagnóstico cada 1 s**, desde el hilo de GL: `__nativo.diagEspacio({pl, plT, ok, espera, err, suave, cfgPl,
  cfgProf, cam, sigue, fotos, reconf})` va a `Nativo.diagEspacio`.
  - La tarjeta (`espacio.js › textoMalla`) dice "⚠ la sesión apagó el escaneo" o "⚠ escaneo: prof <error>".
  - Si faltan planos o fotos, un renglón chico abajo de todo (`textoDiag`), por ejemplo: "planos 0/0 · prof 0
    (esperando 57) · sesión: planos ✗ · prof ✓ · cam 0 640x480@30 · reconfigurada 1×".

## La foto de la cámara, "horrible, como zoomeada" al escanear

- **Pasaba a la mitad para siempre**: `Espacio.foto` convertía cada píxel a RGB en Java. Con el escaneo andando (la
  malla y la profundidad en otros hilos) tardaba más de `MITAD_SI` (28 ms) y quedaba en 320 × 240, estirada a los
  67° de la cámara: se ve pixelada, como zoom digital.
- **Ahora**, con el celu acostado (en el visor, giro 0 o 180): la foto entera en NV21 (girada 180° copiando, si
  hace falta) y el JPEG del sistema (`YuvImage.compressToJpeg`, en C, calidad 80). Unos pocos ms.
- **Parado (90/270)**: el camino de Java de antes. Si pasa a la mitad, vuelve a la entera cuando a la mitad sobra
  (4 × lo que tarda < 60 % de `MITAD_SI`, cada 5 s a lo sumo).
- **La cámara con profundidad puede ser otra lente**: `Ar.avisarCampo` manda su campo (y la orientación del sensor)
  también después de `elegirParaProfundidad`.
- **El diagnóstico** trae `foto` ("640x480 9ms") y `mitad`. El renglón chico sale también si la foto va a la mitad.

## Medido

- `malla.mjs` 19/19 (la nueva: los casos del diagnóstico y la foto a la mitad), `nativo` 18/18, `espacio` 28/28,
  `camara` 13/13. La APK compila. El NV21 y el JPEG del sistema no se pueden probar sin Android.
- **Falta en el celu**: si con esto escanea. Si no, el renglón chico dice cuál de las partes falta.

## Trampas

- **Un `configure` desde otro hilo pisa el de GL**: cualquier cosa que toque la sesión va en `aplicarConfig`.
- **Un estado que solo sale cuando las cosas andan no sirve para saber por qué no andan**: el diagnóstico va
  aparte y seguido.

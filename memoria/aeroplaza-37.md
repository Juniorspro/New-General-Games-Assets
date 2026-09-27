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

## Medido

- `malla.mjs` 19/19 (la nueva: los tres casos del diagnóstico), `nativo` 18/18, `espacio` 28/28. La APK compila.
- **Falta en el celu**: si con esto escanea. Si no, el renglón chico dice cuál de las partes falta.

## Trampas

- **Un `configure` desde otro hilo pisa el de GL**: cualquier cosa que toque la sesión va en `aplicarConfig`.
- **Un estado que solo sale cuando las cosas andan no sirve para saber por qué no andan**: el diagnóstico va
  aparte y seguido.

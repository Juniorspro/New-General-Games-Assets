# AEROPLAZA — trigesimoprimera vuelta (27/09/2026): la cámara de tu espacio, la linterna sola y el punto

Pidió, con una captura de tu espacio con visor: "que en VR, si detecta poca luz, se prenda la linterna"; "la
cámara no se vea así: veo todo con ojo de pescado, es horrible"; "al ajustar las lentes el punto del centro no se
mueve". Antes: [aeroplaza-29](aeroplaza-29.md) (tu espacio, § La cámara llena la vista),
[aeroplaza-30](aeroplaza-30.md) (las lentes) y [aeroplaza-31](aeroplaza-31.md).

## Por qué se veía así

- **El ojo de pescado era el aumento**: "Llenar la vista" (vuelta 31, prendido de entrada) estiraba la foto a
  toda la lente. La cámara ve ~67° (49° de alto, con la foto de prueba) y el ojo con la lente, ~115°.
  - Quedaba ×3,4 en el centro: las rectas curvas si el perfil no es el del visor, la foto borrosa (480 px
    abarcaban toda la lente) y el cuarto se movía 3,4 veces más rápido que la cabeza.
  - También el paralaje iba ×3,4: el punto de la mirada caía a ~140 px del centro de cada lente en su pantalla,
    y por eso parecía que "no se movía" con la lente.
- **Lo oscuro y contrastado era la gamma**: three dibuja a un lienzo (el de cada ojo con lentes) en lineal, y el
  pase de la lente (`lentes.js`) lo mandaba a la pantalla sin pasarlo a sRGB. Un gris 128 salía en 60.

## Lo que quedó

- **La foto en tamaño real, de entrada** (`espacio.js › FRAG_FOTO`): cada grado de la foto es un grado de la
  vista.
  - El plano es 7 veces lo que ve la cámara (`EXT_FOTO`). Afuera de la foto sigue su borde, proyectado desde el
    centro, cada vez más borroso (los mipmaps) y más oscuro (hasta el 35 %): la vista no termina en un marco.
  - Adentro, un poco más nítida (unsharp de 4 muestras, 0,35).
  - Con poca luz, más clara: ×(0,4 / luz)^2,2 en lineal, entre 1 y 3, con hombro.
- **"🔍 Cámara con aumento"** es el llenar de antes, apagado de entrada. La clave es nueva
  (`aeroplaza.camaraAumento`), para que no quede prendido de antes. Con aumento, los ojos se juntan en la misma
  medida (el paralaje sin aumentar).
- **La gamma**: el pase de la lente pasa a sRGB (`sRGBTransferOETF`). En el juego, `vr-dibujo.js ›
  REPROYECTA` pasa el mundo (que ya viene en sRGB del final de la cadena) a lineal cuando va al lienzo de la lente
  (`uLineal`). Así las manos, dibujadas encima en lineal, también salen bien (antes, más oscuras con lentes).
- **La grilla de las lentes** tiene un anillo rojo en el centro exacto de cada lente, para ajustar la separación
  y la altura.

## La linterna sola

- **Java mide la luz cada 0,4 s** y la manda con `__nativo.luz(y, ms, iso)`:
  - `y`, la luz media de la foto (una grilla de 24 × 18 del brillo, `CamaraManos.luzMedia`);
  - `ms` e `iso`, la exposición y la sensibilidad de esa foto: con ARCore, `Frame.getImageMetadata`; con la
    cámara de las manos, el `CaptureResult`.
- **Oscuro** (`main.js › oscuroNativo`): y < 0,12, o y / (s × iso/100) < 0,8. En un cuarto común da ~6; de noche
  con una lámpara lejos, ~0,3.
- **La cámara de la web** usa lo que mide `LUZ_JS` de la mano: media < 0,13 con ganancia ≥ 4.
- **Cómo se prende**: con 1,2 s de oscuro seguido, en el VR, `vr.linternaSola()` la prende y dice "🔦 Poca luz:
  prendí la linterna".
  - Una vez por entrada al VR, y no si se la tocó a mano: el botón del flash sin visor, o "🔦 Linterna" en la
    pantalla de tu espacio (`vr.linternaAMano`).
  - No se apaga sola: con la linterna, la foto ya no dice cuánta luz hay.

## Medido

- **`pruebas/camara.mjs`** (nueva, 12/12):
  - con lentes, el gris 128 da 133 (sin el arreglo, 60) y sin lentes también 133;
  - afuera de la foto, su borde (131, 106, 99);
  - el punto, a 0,6 y 0,8 px de donde tiene que estar (el paralaje de 1,2 m: 4 px). Al separar las lentes 0,1, se
    corre 14,1 y 14,0 px (tenía que 13,7);
  - con luz la linterna no se prende; con poca, sí, y la foto ×3; apagada a mano, no vuelve.
- **`lentes.mjs`** (14/14):
  - el punto del juego (el de la capa) sigue a las dos lentes, ∓19,5 px en x y −19,5 en y;
  - con y sin lentes, el mismo brillo en el centro en el mismo momento (395 y 383 con lentes, 375 sin).
- **La tanda de VR y manos** (vr, xr, vr120, manos, espacio, nativo, camara, manos-celu, menús, dedos): toda bien.
  `espacio.mjs` también con visor: 24/24.

## Trampas

- **Con lentes, lo de cada ojo va en lineal**, y el pase lo lleva a sRGB. Lo que se escriba al lienzo de la lente
  con un `ShaderMaterial` propio tiene que ir en lineal.
- **`pag.screenshot` agarra un cuadro viejo de tu espacio**: la captura sale de `toDataURL` en el mismo evaluate
  que `espacio.dibujar()`.
- **Una comparación de brillo entre dos momentos del juego no sirve** (el mundo cambia): se dibujan los dos
  perfiles seguidos, en el mismo evaluate.
- **Falta en el celu**: ver con el visor que la foto no se vea curva (depende del perfil de las lentes), cuánto
  da `y / (s × iso)` en su casa, y si ARCore da la exposición en su celu.

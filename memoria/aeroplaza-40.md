# AEROPLAZA — trigesimonovena vuelta (27/09/2026): el objeto en la mano como control

Pidió: "hacé más mejoras; también permití detectar un objeto en la mano como un control". Antes:
[aeroplaza-39](aeroplaza-39.md) (la cabeza 6DoF) y [aeroplaza-33](aeroplaza-33.md) (el menú de la palma y agarrar).

## Cómo se detecta (sin ver el objeto: por cómo se cierran los dedos, `js/manos.js › medirAgarre`)

- **Agarra** si al menos 3 de los 4 dedos (índice a meñique):
  - están doblados más de 1,9 rad (109°) en el segundo y el tercer nudillo (`MANDO.curva`);
  - y tienen la punta a entre 0,36 y 0,82 largos de palma (muñeca → nudillo del medio) de su nudillo (`MANDO.hueco`).
- **En la cuenta** (dedos doblados en sus tres nudillos):
  - rodeando un cilindro de ~4 cm (50/85/45°): 0,57, y cuenta;
  - el puño apretado (85/105/75°): 0,30, no cuenta;
  - la garra (20/60/30°) dobla solo 90°;
  - la mano abierta: ~1.
- **Tiene que agarrar 0,35 s seguidos** (`MANDO.entra`) y se suelta en 0,3 (`sale`), con un puntaje que sube y baja.
- **El eje del objeto**: la mitad es la normal del plano en que se dobla cada dedo (los dedos se doblan alrededor del
  objeto); la otra mitad, la línea de los nudillos (del meñique al índice, +0,1 hacia los dedos), que no tiembla porque
  la palma es un molde.
  - Va del lado del pulgar: se apunta como con una linterna o una varita.
  - Suavizado en 60 ms (`MANDO.suave`).
- **El centro**: el promedio de los dedos que lo rodean. La punta: el centro + 8 cm por el eje (`MANDO.largo` 16 cm).
- **El gatillo** (`Manos.medirMando`), cualquiera de los dos:
  - el índice que se dobla 0,5 rad más que su reposo (agarrado como pistola: tres dedos alrededor y el índice
    afuera);
  - o el pulgar que baja hacia el nudillo del índice 0,22 largos de palma (como una linterna).
  - Se suelta con 0,3 y 0,12 (histéresis).
  - El reposo sigue a la mano mientras no aprieta y se congela mientras aprieta: sostenido, sirve para arrastrar.

## Qué hace en el juego

- **El gatillo es el pellizco**: sirve para todo lo que ya se hacía (tocar botones, las ventanas, el menú, saltar con
  los dos, el teletransporte).
- **El rayo sale de la punta del control y va a lo largo del objeto**, sin el agrandado de la cámara (`RAYO_GANA`): se
  apunta con el objeto.
- **Lo que se toca con la yema** (burbujas, orbes) se toca con la punta.
- **Mientras es control**, las ventanas no se agarran con la yema ni la pinza (`main.js` y `espacio.js`, los
  punteros).
- **El dibujo** (`crearMando`, `FRAG_MANDO`):
  - una cápsula de vidrio azul Aero de 16 × 3,8 cm, más honda abajo y celeste arriba;
  - una franja de brillo blanco, el borde claro y un anillo oscuro antes de la punta;
  - la punta verde lima que late y se pone dorada al apretar;
  - aparece y se va en 80 ms.
  - Captura: `pruebas/salida/mando-vr.png`.
- **La primera vez avisa**: "🎮 Control en la mano: apuntá con el objeto y apretá con el índice o el pulgar".
- **El menú de la palma** tiene "🎮 Control ✓" arriba a la derecha (la caja 8). Se guarda en `G.opciones.vrMando`
  (prendido de entrada; en tu espacio, con `espacio.alMando`).
- **Web y APK igual**: es todo en `manos.js`, después de los filtros. En el visor (WebXR) también.

## Medido (`pruebas/mando.mjs`, 18/18, sin navegador)

- **Las manos inventadas** llegan como del visor: la forma de `manos-lento` con cada dedo doblado.
- **La cuenta**: agarrando, los 4 dedos rodean; con el puño, abierta o garra, ninguno. El eje queda a 7,3° del
  cilindro.
- **Abierta, puño apretado y garra**: nunca es control.
- **Agarrando**:
  - aparece a los 350 ms y avisa una vez;
  - el eje queda a 7,3° y el rayo sale de la punta (0 mm, 0°);
  - el dibujo va en el centro;
  - no aprieta solo.
- **Girada para tres lados**: lo peor, 7,3°.
- **Como pistola**: apretar el índice aprieta en el mismo cuadro, soltarlo suelta, y sostenido 1,5 s sigue apretado.
- **Como linterna**: bajar el pulgar aprieta.
- **Al abrir la mano** deja de ser control en 283 ms y el dibujo se va. Apagado, no se busca. El botón del menú lo
  apaga y avisa.

## Trampas

- **Falta con MediaPipe de verdad**: con un objeto en la mano, MediaPipe no ve bien los dedos tapados, y puede dar
  algo más parecido a un puño (la cuenta del puño no activa).
  - Si pasa, bajar `MANDO.hueco[0]`.
  - Un lápiz (1 cm) sale como puño (0,40, justo en el borde).
- **Es un control "linterna"**: el rayo va a lo largo del objeto.
  - Un control remoto apoyado en la palma, apuntando con los dedos, no es un agarre de cilindro.

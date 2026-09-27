# AEROPLAZA — trigésima vuelta (27/09/2026): la altura quieta y las manos de Android sin ARCore

Pidió: "optimizá eso de que en AR sube o baja sin estar yo subiendo y bajando; con ARCore el hand tracking es
mejor, hay que lograr ese resultado sin ARCore". Antes: [aeroplaza-27](aeroplaza-27.md) (la APK, ARCore y las
manos de Android) y [aeroplaza-29](aeroplaza-29.md) (tu espacio).

## La altura quieta (`vr.js › altura`, en el VR del juego con ARCore)

- **Por qué subía y bajaba**: con la cámara que ve poco (tapada en parte por el visor, poca luz, una pared lisa)
  ARCore se corre despacio en la altura, y la vista la seguía tal cual.
- **Ahora la vista va a la altura de ARCore más un corrimiento**:
  - quieto, el corrimiento absorbe lo que ARCore se corre, hasta 10 cm (`BANDA`); lo que pase de eso se sigue,
    desde el borde;
  - moviéndose, la vista sigue a ARCore uno a uno (sin atraso) y el corrimiento se va en ~0,4 s, escondido en el
    movimiento.
- **"Moviéndose"**: el acelerómetro, sin la gravedad, pasó de 0,5 m/s² (`ACELERA`) hace menos de 700 ms
  (`MOVIO`). Si el celu no da `acceleration`, sirve lo que la aceleración con la gravedad se aparta de 9,81.
- **La predicción del lugar va con una velocidad suavizada** (`nativo.js › VEL`, un 30 % por pose, hasta
  50 ms). Antes salía de las dos últimas fotos, y el ruido de ARCore, de milímetros, se multiplicaba hasta 4
  veces al adelantar.
- **Tu espacio no cambia**: ahí la cabeza es la pose de ARCore tal cual (las paredes tienen que coincidir).

## Las manos sin ARCore (`CamaraManos.java`)

- **Con ARCore andaban mejor por el camino de la foto, no por ARCore**: la foto va directo de la cámara a
  MediaPipe de Android en la GPU, sin la WebView, el worker ni WASM, con el campo de la calibración y la hora del
  sensor. Sin ARCore, la APK abre la cámara ella misma (Camera2) y le pasa las fotos a la misma `ManosNativas`.
- **La foto**: la cámara de atrás principal (la primera de atrás), en YUV, lo más cerca de 640 × 480 y 4:3.
- **Los cuadros por segundo**: los más altos hasta 60. Entre los que llegan igual, el que con poca luz puede
  bajar a la mitad, y no menos de 15 (con 7 por segundo la mano sale corrida).
- **La imagen**: sin estabilizar (ni la digital ni la óptica: corren la imagen y cambian el campo) y con el foco
  continuo.
- **La focal**: la de `LENS_INTRINSIC_CALIBRATION` si no se aparta más de un 30 % de la de la lente y el sensor;
  si no, la de la lente y el sensor. Se lleva a la foto: sale de lo más grande de su forma que entra en el sensor,
  centrado.
- **La hora**: la del sensor si su reloj es el de elapsedRealtime (`REALTIME`); si no, se suponen 25 ms.
- **Avisa al juego**: `manos-camara corre <fps>` · `parada` · `sin-permiso` · `error: …` (van a
  `Nativo.camaraManos` y `camaraFps`).
- **El puente**: `manosCamara(bool)`, con el permiso de la cámara. La cámara es de uno solo:
  - prenderla para las manos para ARCore;
  - prender ARCore apaga la cámara de las manos y espera hasta 600 ms a que quede libre;
  - al pausar la app se suelta, y al volver se abre de nuevo;
  - el flash va a quien la tenga.

## En el juego (`main.js › laCamara`)

- En la APK:
  - con ARCore (y elegido), las manos de ARCore;
  - si no (el VR sin ARCore, o un celu sin ARCore), las de Android con `manosCamara`;
  - si nada de eso arranca, las de la web.
- `ManosNativas` (la de `nativo.js`) tiene `sinAR`: se fija al prender y no cambia mientras está activa. El cartel
  de ⏱ dice `📷60 cam` en vez de `📷60 AR`.

## Medido (`pruebas/nativo.mjs`, 18/18)

- Quieto, ARCore corriéndose 6 cm para arriba en 2 s: la vista se movió 0,00 cm.
- Agachándose 30 cm con aceleración, la vista termina en −24,2 cm con ARCore en −24,0 cm.
- Sin ARCore: se llama a `manosCamara(true)`, no a `arIniciar`, y no se abre la cámara de la web. La mano
  aparece a 0,0 cm de donde está. El flash va a la cámara de la APK y al salir se apaga.
- La tanda de VR y manos (vr, xr, vr120, manos, espacio, lentes, manos-celu, menús, dedos): 9 de 9.

## Trampas

- **`esperar` mira un campo** (`estado` para ARCore, `camaraManos` para la cámara). Hay que poner `'abriendo'`
  antes de pedirla: si no, un error viejo resuelve la espera enseguida.
- **Falta en el celu**:
  - la cámara de las manos se probó con un Android de mentira;
  - falta ver en uno de verdad qué cuadros por segundo da, si la focal cuadra y si `acceleration` llega en la
    WebView.

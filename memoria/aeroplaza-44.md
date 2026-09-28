# AEROPLAZA — cuadragésima tercera vuelta (28/09/2026): el mando VR Box

Pidió: "hazlo compatible con el mando VR Box". Antes: [aeroplaza-43](aeroplaza-43.md) (todo el juego en el VR),
[aeroplaza-40](aeroplaza-40.md) (el objeto en la mano como control: es otra cosa, `mando.mjs`).

## Por dónde llega

- **En el navegador, por la Gamepad API** (`entrada.js › leer`, que ya existía).
- **En la APK, por Android**: la WebView no le pasa los mandos a la página (la Gamepad API de Chrome necesita que la
  actividad reenvíe los eventos).
  - `MainActivity.dispatchKeyEvent` y `dispatchGenericMotionEvent` → `MandoBox.java` → `__nativo.mandoBoton(i, abajo)` y
    `__nativo.mandoEje(x, y)`.
  - `Nativo.padMando()` los da con la forma de un mando de la Gamepad API y `entrada.js` lo lee como uno más
    (`ent.mandoExtra`).
  - `MandoBox.java` no tiene nada de Android: se prueba con javac (`pruebas/mando/PruebaMando.java`).
- **Los modos del VR Box**:
  - juego (@ + B): botones con nombre, los genéricos BUTTON_1..16, la palanca `AXIS_X/Y` o la cruz `AXIS_HAT_X/Y`;
  - música (@ + A): volumen +/− → botones 20/21 (caminan), tema anterior/siguiente → 22/23 (giran), play/pausa → 24
    (usa). Solo en el VR: la APK los toma con `mandoVR(true)` al entrar y los suelta al salir;
  - teclas y mouse: siguen a la WebView tal cual (las flechas caminan; el clic es un toque).
- **Nunca se toman** atrás (4), inicio (3) ni las letras. La repetición de una tecla sostenida no se manda.

## Qué hace en el VR (`mando-box.js`, `main.js › botonesVR`)

- **La palanca, la cruz o el volumen +** caminan para donde se mira (`entrada.js`, con `ent.enVR`).
- **Los botones son del VR**, no los del juego plano:
  - usar: es un toque. Aprieta el tablero que se mira, dispara en el tiro, usa lo que está cerca. Con palanca
    (movida en los últimos 30 s) no prende ni apaga el caminar (`vr.sinCaminar`).
  - saltar;
  - girar 45° a cada lado;
  - menú: la pausa, que se ve en el espejo. Otra vez, la cierra. En el VR su botón "Modo VR" pasa a "Salir del VR".
- **De fábrica** (`MAPA_BOX`): usar 0, 5, 7, 24, 25 · saltar 1, 4, 6 · izq 2, 22 · der 3, 23 · menú 8, 9. El gatillo del VR
  Box llega como A, R1 o R2 según el firmware (sin comprobar en uno de verdad).
- **La ventana del mando** (menú del VR › 🎮 Mando VR Box):
  - "Cambiar" y el próximo botón va a esa acción (`ent.alBoton`) y deja las otras. Se guarda en `G.opciones.vrBox`.
  - "Como venía" vuelve a lo de fábrica.
  - Muestra el mando conectado (`Nativo.mandos()`, o el id de la Gamepad API) y en vivo la palanca y el último botón.
- **Arreglo de paso**: con ARCore, "Girar ⟳" del menú de la palma no giraba, porque el giro se fijaba al entrar. Ahora
  `vr.giroAR()` suma lo que se giró después.

## Pruebas

- **`vrbox.mjs` 27/27** (nueva, en la tanda `--manos`):
  - 9 de Java;
  - la palanca afuera y en el VR (3,4 m en 1 s, derecho adonde se mira);
  - el volumen + sostenido camina 3,3 m y al soltar frena;
  - los temas giran ±45° y B salta 1,59 m;
  - el gatillo aprieta el botón mirado en el espejo sin caminar, y en el tiro dispara;
  - start abre y cierra la pausa en el espejo, y salir del VR suelta el volumen;
  - la ventana: Y pasa a saltar y girar ⟳ se queda con el tema siguiente;
  - por la Gamepad API, la palanca camina y el botón 0 usa y no salta.
- **`cabeza.mjs` 23/23**: con ARCore, girar 45° gira 45,0°.
- **Tanda del VR 16/16** (vr, vr-juego, manos, cabeza, nativo, espacio, lentes, malla, choque, ancha, xr, menus,
  multijugador, camara, mando, vrbox). La APK `--canciones` compila (23,9 MB).

## Lo que falta

- **Probarlo con un VR Box de verdad**:
  - qué botón es el gatillo en cada modo;
  - si la palanca llega por `AXIS_X` o por `AXIS_HAT`;
  - si Android le da el volumen a la actividad con la pantalla en VR.

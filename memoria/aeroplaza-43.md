# AEROPLAZA — cuadragésima segunda vuelta (28/09/2026): todo el juego en el VR, 3DoF con cuello y la pelotita

Pidió: "que en VR todo el juego sea funcional y usemos el ARCore en 3DoF solamente por su buen seguimiento de manos;
una opción 3DoF; un modo en el que los que están en VR sean pelotitas flotantes con manos visibles que otros pueden
ver; que puedas entrar a los edificios y jugar a los minijuegos". Antes: [aeroplaza-39](aeroplaza-39.md) (Fusion),
[aeroplaza-33](aeroplaza-33.md) (manos como Quest), [aeroplaza-42](aeroplaza-42.md) (la mira no aprieta).

## 3DoF de entrada, 6DoF como opción (`vr.js`)

- **`vr.seis`** (`G.opciones.vr6dof`, apagado de entrada): con 6DoF el lugar de ARCore mueve la vista, como antes.
- **En 3DoF el giro sale igual** (ARCore con Fusion, o el giroscopio) y el lugar no: caminar por el cuarto no mueve
  al muñeco. Se camina con un toque, con el menú o con las manos.
- **El cuello de Cardboard**: `CUELLO = (0; 7,5 cm; −8 cm)`, 11 cm de largo.
  - `cuello(q)` = R·v − R_rumbo·v: el rumbo no cuenta, porque el muñeco ya gira con la mirada.
  - Mirando derecho da 0; mirando 65° abajo, 11,8 cm (2·|v|·sen(ángulo/2)).
  - **Trampa**: con R·v − v, el rumbo de entrada (`vr.base`) corría los ojos hasta 16 cm mirando derecho.
- **Se cambia en vivo** con `ponerSeis(si)`: el menú de la palma (botón 9), o el menú del VR ("6DoF").

## El espejo (`espejo.js`): la interfaz plana adentro del VR

- **Antes, una ventana o una charla sacaban del VR.** Ahora se leen del DOM (`leerVentana`, `leerDialogo`) y se
  dibujan en un `PanelEspejo` (un `Tablero` de 1,3 × 0,84 m).
- **Qué muestra**:
  - el título, el texto (lo que no es botón) y el dibujo si hay un canvas;
  - los botones como mosaicos: 3 columnas, 12 por página, con `Más ▶` y `◀ Antes`; más la ✕.
- **Apretar un mosaico hace `el.click()` en el botón de verdad**: viajar, hablar, la tienda y los resultados andan
  igual que en la pantalla.
- **La charla**: quién habla y lo que dice; "▶ Seguir" aparece recién cuando termina de escribirse (hace click en el
  `.dialogo`).
- **Dónde va**:
  - a 1,5 m, 12 cm abajo de los ojos, sin `depthTest` (una pared no lo tapa);
  - sigue a la cabeza despacio y se acomoda si se mira más de 50° para otro lado;
  - se relee 4 veces por segundo y se repinta solo si cambió (`firma`).
- **La fuente** (`main.js`): `UI.ventanaAbierta` o el `.dialogo` si `enDialogo`. Nada en tu espacio ni con el probador.
- **La copia plana no tapa la vista**: con `html.en-vr` (lo pone `vr.js`), `.velo` y `.viaje` van con opacidad 0.
  - Antes, el velo (con su `backdrop-filter`) borroneaba toda la vista de los dos ojos: se vio recién en una captura
    dibujada.
  - Con opacidad y no con `visibility`: esa se hereda y el espejo (`visible()`) no vería ningún botón.
  - En tu espacio (`html.con-espacio`) no hay espejo y quedan como estaban.
- **Los avisos y la cuenta de 3** van al cartelito de cada ojo (`J.decirVR`; `UI.cuenta` también).
- **El probador y el telescopio sacan del VR**: son su propia escena.
  - El telescopio antes no sacaba, y con él abierto `paso` vuelve antes de `vr.orientar`: la vista no seguía a la
    cabeza.
- **Los cuadros de texto** (el chat, el nombre) no entran en el panel: se usan sin el visor.

## Cómo se aprieta (con manos o sin)

- **Con las manos**: el rayo y un pellizco, como las ventanas (`ventanasMundo.actualizar` con `punterosVR()`).
- **Sin manos a la vista**: la mirada.
  - Un toque en la pantalla, mirando un tablero, lo aprieta y no se pone a caminar (`clicMirada`).
  - Quedarse mirando 1,4 s también aprieta (`quieta` del mundo del juego; en tu espacio sigue en 0).

## Viajar, edificios y minijuegos

- **Viajar en el VR**:
  - `entrarReino` ponía `cam.fp = FP` y en la plaza la vista quedaba de atrás. Ahora `cam.fp = FP || vr.activo`, y
    `vr.fpAntes = FP` para la salida.
  - La pantalla del viaje no se ve en el visor. `tapaVR` funde a `#0b2a44` mientras dura (~1,3 s), `vr.decir` dice
    adónde, y al llegar hay parpadeo.
- **Los edificios**:
  - la puerta se apunta con el rayo (es interactiva) y el pellizco entra, sin salir del VR;
  - adentro se apuntan los `reino.accionables` (el centro de su caja, radio 0,35 m) y el pellizco los usa.
- **Sin arco en el tiro, el parkour y el runner** (`sinArcoVR`): saltar de lugar sería trampa.
  - El pellizco sostenido camina (`vr.caminaMano`) y dos pellizcos saltan.
  - En el tiro, el pellizco dispara por el rayo de la mano (`disparoMano`: sale de `o + d·0,12`, a 24 m/s).
  - Sin manos, en el tiro, el toque dispara para donde se mira (`vr.enTiro`).
- **Trampa de la prueba**: el parkour y el runner tienen la cuenta de 3 s, que sujeta al muñeco. La prueba pone
  `fase = 'corre'`.

## La pelotita (`pelotita.js`, `remotos.js`)

- **`G.opciones.vrPelotita`** (prendida de entrada; en el menú del VR y en el de la palma, botón 10).
- **Lo que se manda** (`armarVR`), 10 veces por segundo:
  - `vr: { h: [x, y, z, qx, qy, qz, qw], m: [63 enteros | 0, …] }`;
  - la cabeza respecto de los pies, y cada mano en cm respecto de la cabeza.
  - Se arma solo cuando se manda (`red.publicarEstado(s, ahora, extra)`), no en cada cuadro.
- **Lo que llega se revisa** (`leerVR`):
  - la cabeza: 7 números finitos, a 3 m o menos de los pies, con el giro normalizable (largo entre 0,5 y 1,5);
  - cada mano: 63 enteros de hasta 250 (2,5 m). Si no, esa mano no se dibuja.
- **Cómo se ve**:
  - una bola de gelatina de su color (radio 16 cm) con brillo, dos ojitos para donde mira y su nombre;
  - las manos: 21 juntas y 21 huesos en dos mallas instanciadas por mano;
  - todo se acerca con 1 − e^(−15·dt) y flota 1,5 cm;
  - el muñeco se esconde. Sin datos de VR en 1,5 s, vuelve.

## Las manos con la cabeza exacta de la foto

- **`Fusion.giroEn(t, q)`** (Java): el giro del giroscopio a la hora de la foto. Llega al juego por
  `cabezaAntes(msAtras)`, `Nativo.leerGiroAntes` y `vr.giroEn`.
- **`manos.cabezaEn` lo usa si hay** (`manos.giroExacto`).
- **Medido** (`PruebaFusion`, 249 lecturas a 45 ms atrás): 0,19° de media, p95 0,32°. Con la cabeza dibujada daba
  0,36° y 1,22°.

## Pruebas

- **`vr-juego.mjs` 21/21** (nueva, en la tanda `--manos`):
  - el cuello, el menú de 10 y el botón de 6DoF;
  - el espejo: el rayo aprieta "Dos", el toque "Uno", mirar 1,4 s "Tres" (a 1 s no), la ✕ cierra;
  - la charla del libro, y el mapa con 6 destinos: viajar a la Zona de Juegos sigue en el VR, con el fundido a 1;
  - la puerta del hotel y el ascensor adentro;
  - el tiro: por el rayo, 0° de la mano y 50° de la mirada; con el toque, 0,9° de la mirada;
  - el parkour: el pellizco camina más de 1 m y al soltar frena;
  - la pelotita entre Ana y Beto por el broker: la cabeza a 0,3 cm, la yema a 0,2 cm. Apagada, a 1,5 s vuelve el
    muñeco. Lo malo se ignora.
- **`MANO`** (la mano de mentira) pasó a `comun.mjs`: la usan `manos.mjs` y `vr-juego.mjs`.
- **Cambiadas por lo nuevo**:
  - `vr.mjs`: abrir una ventana ya no saca del VR;
  - `nativo.mjs` y `cabeza.mjs` prenden el 6DoF; `cabeza.mjs` suma el 3DoF, donde los ojos que se corren no mueven
    la vista;
  - `manos.mjs`: el mapa se abre sin salir del VR;
  - `menus.mjs` mide el menú del VR y ahora sale con error si una ventana se pasa (antes daba bien igual).
- **El menú del VR con 4 llaves se pasaba 83 px** en el celu acostado (844 × 390) y 5 px en la compu.
  - En `html.b460`: sin las explicaciones chicas, la ventana de 700 px y menos márgenes. Entra: 370 px de alto.
  - "6DoF" sin el paréntesis en el título (la explicación dice "caminás de verdad").
- **La prueba del giroscopio de mentira**: `gamma −60` no es 30° abajo sino 65°. Se compara con la inclinación real.
- La APK `--canciones` compila (23,9 MB) y `PruebaFusion` da 14/14.

## Lo que falta

- **Probarlo en el celu**:
  - que el espejo se lea bien en el visor;
  - la pelotita entre dos celulares;
  - que en 3DoF con ARCore las manos queden donde están.
- **Lo que tiene cuadros de texto** (el chat, el nombre, el código de sala) todavía se usa sin el visor.

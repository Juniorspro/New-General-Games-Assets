# AEROPLAZA — cuadragésima octava vuelta (29/09/2026): construir como en Sims Mobile

Pidió: "intentá arreglar la construcción, hacela bien, Sims Mobile, que sea cómoda". Antes:
[aeroplaza-48](aeroplaza-48.md) (las 54 piezas, la cámara de arriba y el panel viejo con modos).

## Qué cambió (todo en `js/obra.js`, nuevo; main.js solo entra y sale)

- **Sin modos.** Antes eran Poner, Mover, Pintar y Quitar. Ahora:
  - Se toca algo para elegirlo: queda con su huella celeste y arriba aparece la barrita.
  - La barrita tiene girar (la obra de a 90°, lo demás de a 45°), 🎨 color, copiar (a un lugar libre), quitar y ✓.
  - Lo elegido se arrastra: verde donde entra, rojo donde no. Si se suelta en rojo, queda en el último lugar donde
    entraba.
  - Apretar un rato sobre algo que no está elegido lo agarra de una.
- **La vista:**
  - Un dedo en el piso vacío la mueve, con el piso pegado al dedo (`pisoPlano` antes y después).
  - Dos dedos acercan, giran para el mismo lado que los dedos y mueven.
  - La inclinación va sola con la distancia: de cerca se ve más de costado.
  - ⟲ ⟳ la giran de a 45°. Arrastrando cerca del borde, se corre sola.
  - Mouse: arrastrar mueve, el botón derecho gira y la rueda acerca.
  - Teclas: WASD, Q/E, R, C (copiar), Supr, Ctrl+Z y Ctrl+Y.
- **El catálogo** (`casa-piezas.js › TABS`): 8 pestañas por lugar de la casa (paredes, pisos, living, dormitorio y
  baño, cocina, juegos, plantas, deco).
  - Tocar una carta pone la pieza en el lugar libre más cerca del medio de la vista (`libreCerca`, en espiral) y ya
    queda elegida.
  - La carta también se arrastra hasta el patio: vale para arriba o en cuanto el dedo sale del catálogo.
- **Las miniaturas 3D** (`hacerMini`): cada pieza se dibuja en la capa 7 con las luces de la escena, puestas de día
  mientras dura la miniatura (cambiar intensidades no recompila).
  - Sin la cadena de efectos: en un rincón del lienzo, y se copia con `drawImage`.
  - Con la cadena: en un render target, leído con `readRenderTargetPixels` y pasado a sRGB a mano.
  - Así no se compila ningún shader nuevo. Van de a una o dos por cuadro y quedan guardadas en la sesión.
- **Las herramientas de dibujo** (cartas con ✏️ ▦ 🏠 🧹):
  - Pared, media pared y baranda se tiran de corrido: tramos de 2 m desde donde empieza el dedo.
  - El cuarto va de esquina a esquina: paredes y piso. Si toca otro cuarto, no repite la pared del medio.
  - Los pisos y el techo cubren un rectángulo; el piso repinta el que había.
  - Demoler saca lo que tiene el centro adentro.
  - Un toque pone un tramo o un cuarto de 4 × 4. La ✕ de la pista deja la herramienta.
- **Las paredes** (`casa.js › cortar`):
  - Cortadas, de entrada: bajan (escala 0,14) las que miran a la cámara y están delante del punto que se mira.
  - Bajas o enteras (con los techos).
  - Lo colgado (cuadro, reloj) se esconde, se mueve y gira con su pared, y se va con ella (`colgadosDe`, `sacar`).
  - Una puerta, una ventana o una media pared soltadas sobre una pared la reemplazan. Dos iguales no, así mover una
    pared no se come a la de al lado.
  - Un cuadro sobre una puerta, tampoco.
  - Cada pared trae una columnita en cada punta: en las esquinas no queda la rendija de 10 cm.
- **Los choques** (`choca`, rectángulos girados que se pisan):
  - Los muebles chocan contra los muebles y las paredes. Los pisos finos, contra los pisos finos del mismo nivel.
  - Lo colgado, las alfombras, los techos y lo que flota van donde sea. Las columnas pueden ir en las esquinas.
  - Arriba de una plataforma o una tarima no se choca con ella.
- **Deshacer y rehacer:** son fotos del plano (hasta 80). Cada cambio rearma sin fundir, guarda y publica (a los
  0,4 s). "Listo" funde.
- **El HUD** se esconde entero mientras se construye (menos los avisos, más abajo). Los mensajes van en la pista.

## Lo que costó encontrar

- **El navegador se come el clic** de un toque que llega entre 0,1 y 0,3 s después de soltar un arrastre: lo toma
  como el freno de una inercia. Se veía como "el botón no anda".
  - Los botones de la construcción responden en el `pointerup` y no esperan el clic.
  - El clic queda para el teclado, sin hacer nada dos veces (`_tocado`).
- **El rayo no encontraba nada** si se tocaba antes del primer cuadro después de rearmar: las matrices todavía no
  estaban calculadas. `elegir` hace `updateMatrixWorld` antes.
- **El catálogo entra desde abajo en 0,3 s:** las pruebas esperan 450 ms antes de tocarlo.
- **`.ob-pista` con `left: 50%`** se partía en dos renglones: se arregla con `width: max-content`.
- **La huella quedaba tapada por el piso fino:** va arriba de `alturaEn`.

## Pruebas

- `pruebas/casa.mjs` (35), con toques de verdad por CDP en 844 × 390, y el mouse y las teclas en 1280 × 720. Prueba
  el catálogo y las miniaturas, elegir y arrastrar, soltar en rojo, la vista con uno y dos dedos, poner tocando y
  arrastrando la carta, la barrita, deshacer y rehacer.
  - Obra: la pared de corrido, los cuartos, la puerta que reemplaza, el cuadro colgado que va con su pared, el piso
    que repinta, demoler y la ✕.
  - Además: las paredes cortadas, bajas y enteras; la tarima, la puerta y la escalera; el tope de 200; Listo; la red.
  - Fotos: `casa-construir-celu.png`, `casa-cuarto.png`, `casa-terminada.png` y `casa-construir-compu.png`.
- Para ubicar toques: `construyendo.aPantalla(x, y, z)`. Para dejar la vista quieta: `cam.plano.centro`, `dist`,
  `cam.yaw` y `C.yawObj`. Un cuadro dibujado (`avanzar(P, 1)`) antes de la foto; si no, sale el último que se dibujó.
- La tanda entera (26 + las 18 de VR y manos): 42 de 44 a la primera; celu y actualizar, bien solas (la carga de la
  máquina, como en la 48). Publicada la n 6 (commit 00c0b374, APK 46: no hizo falta una nueva).

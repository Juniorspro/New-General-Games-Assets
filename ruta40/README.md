# RUTA 40

Autos tipo Hill Climb Racing por la Ruta 40, de la Puna al Glaciar. Don Tito
arregla gomas en La Quiaca; le llega una carta de su hermana Rosa desde
El Calafate y sale con la chata. Arte pintado (no pixel art) hecho con Rezona,
física propia, música sintetizada y todo en castellano, inglés y portugués.

**Para jugar:** `ruta40.html`. Es un solo archivo (3,2 MB): abre con doble
clic y anda sin internet.

## Cómo se juega

- **Acelerar**: pedal derecho, → o D. **Frenar y marcha atrás**: pedal
  izquierdo, ← o A. **Pausa**: el PARE, P o Esc. **R** reinicia.
- En el aire, acelerar gira para atrás y frenar gira para adelante.
- Se termina el viaje por tres cosas: si el conductor se da la cabeza (o el
  techo toca el piso), si queda volcado o si se queda sin nafta.
- Se juntan monedas, bidones de nafta y mojones (cada 500 m, de a 100, 200,
  300…).
- **Trucos**:
  - vuelo de más de 1,1 s;
  - vuelta atrás y vuelta adelante (300 × n²);
  - willy;
  - aterrizaje limpio;
  - "¡casi!" (una vuelta en la que la cabeza pasa a menos de 25 cm del piso);
  - combos, si los trucos vienen seguidos en menos de 3,5 s.
- **Picadas**: 1.200 m contra tres rivales fantasma, con semáforo y sin nafta
  que cuidar. Cada tramo tiene tres (del barrio, del pueblo, de la provincia);
  cada una se abre al ganar la anterior.
- **Para abrir un tramo** hay que llegar a 1.500 m en el anterior. Llegar a los
  5.000 m es "¡Llegaste!"; después del Glaciar viene el final de la historia.

## Los siete tramos

| tramo | cómo es |
|---|---|
| Puna | lomas largas de paja brava, vicuñas y llamas, un volcán nevado |
| Quebrada de Humahuaca | cerros de siete colores, cardones, cuestas empinadas |
| Salinas Grandes | plano y blanco, rampas cada 230 m, bidones lejos, flamencos |
| Valles Calchaquíes | cerros colorados, algarrobos, puentes de madera |
| Cuyo | el Aconcagua, viñedos, álamos y las lomas más altas (hasta 18 m) |
| Patagonia | estepa y viento de frente todo el tiempo (−2,4 m/s²) |
| Los Glaciares | nieve, lengas rojas y hielo que patina (agarre 0,62) |

Cada tramo se genera igual siempre (con semilla) y se pone difícil de a poco:
las lomas crecen, la pendiente máxima sube (de 23° a 48°) y los bidones se
separan.

## Los cinco vehículos

| vehículo | precio | cómo es |
|---|---|---|
| La Chata | — | la camioneta de campo, pareja en todo |
| El Fitito | $6.000 | livianito y gasolero: vuela en las rampas, sufre en las cuestas; el más rápido en las picadas |
| El Colectivo | $18.000 | largo, pesado, fileteado; tanque de viaje, no hay loma que lo vuelque |
| La 4x4 | $40.000 | tracción en las cuatro y cubiertas de barro |
| El Tractor | $75.000 | lento y terco; con la rueda grande trepa lo que sea |

Cada vehículo tiene cinco mejoras de 10 niveles: motor, cubiertas,
suspensión, tanque y vuelo (el control en el aire).

## Lo que lo hace mejor que BRILLO

- **Física de verdad** (`js/fisica.js`):
  - chasis rígido y dos ruedas con suspensión;
  - fricción con tope (μ·N), así que las ruedas patinan;
  - torque de reacción: al acelerar levanta la trompa;
  - 240 pasos por segundo, con el dibujo mezclando el paso de antes y el de
    ahora.
- **Los autos salen del dibujo**:
  - dónde van las ruedas y el contorno que choca se midieron sobre la imagen
    de Rezona (`herramientas/procesar_arte.py`);
  - el conductor se ve detrás del vidrio polarizado;
  - la cabeza se hamaca con un resorte.
- **Nada de pantallas quietas**: detrás del menú hay un viaje de verdad
  manejado por el piloto automático.
- **Interfaz propia de cartelería vial argentina**:
  - verde para ir, azul para los servicios y marrón para los lugares;
  - rombo amarillo para los avisos;
  - PARE para la pausa, patente Mercosur y mojón;
  - la letra es Overpass (de la familia de la Highway Gothic);
  - las transiciones son una polvareda.
- **Sonido sintetizado sin archivos**:
  - un motor con voz propia para cada vehículo: el Fitito zumba, el colectivo
    traquetea y el tractor hace put-put;
  - una chacarera original en mi menor con bombo legüero, guitarra y charango
    (Karplus-Strong) y quena;
  - en la ruta suena como radio, y tiene un modo 16 bits.
- **Un bot que comprueba los tramos** (`pruebas/bot.mjs`, con la misma física
  que el jugador):
  - con la chata sin mejoras se llega a 1.500 m en los siete tramos;
  - con nafta infinita no hay ningún lugar donde trabarse;
  - cada tramo lo terminan al menos dos vehículos con 6 niveles de mejoras;
  - cada una de las 21 picadas la gana algún vehículo con las mismas mejoras
    que los rivales.
- **Controles de dedo personalizables** (en Ajustes → Controles):
  - pedales o mitades de pantalla;
  - mover, agrandar y hacer transparente cada pedal;
  - cambiarlos de lado y elegir si vibran.
  - Arranca con pedales en el teléfono, y con el teléfono parado todo se gira
    90°.

## Cómo se arma

```
npm install      # en la carpeta de arriba: solo esbuild
node ruta40/herramientas/armar.mjs      # → ruta40/ruta40.html
```

En el repo toma el esbuild de `bosque/node_modules`. El arte de `arte/`
entra como data: URI por el módulo virtual `arte:todo`.

## Pruebas

```
node ruta40/pruebas/fisica.mjs      # la física en pisos de prueba
node ruta40/pruebas/tramos.mjs      # pendientes, rampas, puentes, bidones y monedas de cada tramo
node ruta40/pruebas/manejar.mjs todos --mej=0   # el piloto por cada tramo con cada vehículo
node ruta40/pruebas/bot.mjs         # lo que tiene que cumplirse (tarda ~5 min; --rapido, ~1 min)
node ruta40/pruebas/navegador.mjs [carpeta] [--telefono]   # todo el recorrido en Chromium, con capturas
node ruta40/pruebas/paisajes.mjs [carpeta] [metro]        # una captura de cada tramo
```

## El arte

Todo salió de Rezona (proyecto `biJbNhtEOI`). Los prompts están en
`herramientas/arte.json` y en `herramientas/rezona/estado.json`. Para volver a
procesarlo:

1. Bajar los png de
   `https://lab.rezona.ai/game/pgcserver/pv/biJbNhtEOI/assets/<nombre>-g1.png`.
2. Correr `python3 ruta40/herramientas/procesar_arte.py <carpeta>`.

El script:
- tiñe los vidrios;
- tapa los agujeros de las llantas;
- espeja el colectivo;
- saca el halo del recorte;
- hace las texturas sin costura;
- corta las hojas de adornos;
- escribe `js/medidas.js`.

Si falta alguna imagen, el dibujo la reemplaza con formas hechas en código.

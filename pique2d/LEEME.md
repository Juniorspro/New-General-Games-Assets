# Pique — corredor pixel art con sprites generados y niveles comprobados

Un juego de un botón: el personaje corre solo y lo único que hacés es saltar.
24 niveles en 6 mundos, **ninguno dibujado a mano**, **ninguno publicado sin
haberse jugado entero por dentro primero** y **ninguna moneda fuera de alcance**.

## Lo medido

Todo sale de `./pruebas/correr.sh`.

| | |
|---|---|
| niveles validados | **72/72** (24 × 3 colores) |
| caminos del validador rehechos en el juego real | **72/72** |
| **monedas fuera de alcance** | **0 de 5.262** |
| el archivo único, desde `file://` | **11/11** |
| las hojas de sprites | **17/17** con fondo limpio y grilla exacta |
| celular, acostado y parado | **22/22** |
| cuadros de la animación de correr | **16** |
| peor generación de nivel | 1136 ms · típico ~140 ms |
| archivo único | **2,0 MB** |

## El bug que había y que estaba bien reclamado

Había lugares inaccesibles, y era grave: **59 de 539 monedas (10,9%) no se
podían agarrar, y en el 5-3 era el 52%.** El validador probaba que EXISTE un
camino al mástil, y eso no es lo mismo que probar que se alcanza todo: la
búsqueda en haz se queda con los estados que llegaron más a la derecha, así que
nunca explora los rincones que el camino óptimo no pisa.

Dos arreglos fallaron antes del que anduvo, y los dos por resolverlo al revés
—poner monedas y después preguntarse si se alcanzan:

1. Un BFS cuadro a cuadro con dedup por estado. **Colapsó en catorce estados**:
   el jugador avanza 2,55 px por cuadro, el hijo cae en el mismo casillero que
   el padre y se descarta por repetido. Como el conjunto quedaba vacío, el paso
   siguiente **borró las 539 monedas de los 24 niveles** sin que nada avisara.
   Un arreglo que destruye contenido en silencio es peor que el bug.
2. Un haz por diversidad. Andaba, pero tardaba 2,7 s por nivel y todavía
   borraba 152 monedas.

**La vuelta correcta es al revés:** `validar` ya devuelve el conjunto de celdas
que ocuparon estados *realmente simulados*. Todo lo que está ahí es alcanzable
por construcción, y no cuesta nada porque ya se calculó. Las monedas se siembran
**solo ahí**. Es una subestimación del alcance real, que es la dirección segura.
Y queda mejor de jugar: las monedas siguen el recorrido, que es para lo que
sirven en un juego de correr.

## Los sprites

17 hojas generadas con IA, **todas 4×4 = 16 cuadros**, una hoja por movimiento.

**Por qué 4×4 y no 3×3:** el servidor que las genera **ignora el tamaño pedido y
entrega 1024×1024 siempre**. 1024 no divide en 3 —341,33 px por celda— así que
toda hoja de 3×3 sale con las celdas corridas. Se midió: de 17 hojas pedidas en
3×3, **16 fallaron por esto**. 1024/4 = 256 exacto, y de paso 16 cuadros son casi
el doble de suaves que 9.

Cada hoja pasa por un **control numérico** antes de entrar al juego
(`check_spritesheet.py`): mide poses repetidas y líneas de división dibujadas en
el borde de las celdas. Son las dos fallas que no se ven en una miniatura y
arruinan la animación. En la primera tanda **7 de 17 fallaron** —poses repetidas
o divisores dibujados— y se rehicieron reforzando las prohibiciones del prompt,
que es lo que los modelos obedecen mejor que las descripciones.

Las criaturas son **originales**: cumplen roles clásicos del género pero ninguna
copia a un personaje de nadie, y cada prompt niega el parecido explícitamente
(`NOT a plumber`, `no moustache`, `not a turtle`, `no cap`).

## Vertical, como se juega de verdad

El juego es **vertical**. Lo que se fija es el **ancho en tiles** —13 parado,
hasta 22 acostado— y el alto sale de la proporción real de la pantalla. Parado
eso da una vista muy alta, unos 28 tiles para un nivel de 24, y **está bien**:
son dos tercios de cielo, que es exactamente como se ve el género. Por eso los
fondos van en tres capas y valen la pena.

La cámara puede subir **por encima del nivel** para mostrar cielo. Clavarla en
cero dejaba el nivel pegado arriba y una franja vacía abajo.

## El progreso se abre nivel por nivel

Cada nivel abre **el siguiente**, no el mundo entero. Antes había que ganar el
cuarto nivel de un mundo para que se abriera el siguiente, así que los tres del
medio no abrían nada y el mapa parecía trabado. Los cerrados se ven —con
candado y "terminá el anterior"—, porque esconderlos deja al jugador sin saber
cuánto falta.

Se guarda **un número**, no un mapa de "cuál está abierto": con un número el
estado no puede quedar inconsistente — no existe un 3-2 abierto con el 3-1
cerrado.

## Guardia contra cuelgues

Si algo tira una excepción dentro del bucle, sin guardia se repite sesenta
veces por segundo: la pantalla queda quieta y el jugador **no puede hacer
nada**, ni volver al mapa. Envuelto, un error termina el nivel y muestra una
pantalla de la que se puede salir. Un juego que se recupera mal es mejor que
uno que no se recupera.

Y la burbuja ya no se traba: pasados cinco segundos busca un lugar seguro y,
si no encuentra ninguno, devuelve a la largada. **Reaparecer al principio es
malo; no reaparecer nunca es peor** — antes, si la burbuja quedaba donde
`libre()` nunca daba true, el jugador se quedaba ahí para siempre sin ningún
error que lo explicara.

## Menú y mapa

El menú lleva un **logo dibujado** y una escena de portada generada. El mapa
muestra, en cada nivel, la **postal de su tema**: la misma que ve el jugador
adentro, porque está **compuesta apilando las capas de fondo reales** más una
franja de la textura del terreno. `componer_postales.py` las arma en un
segundo y **no cuesta un crédito** — y, sobre todo, una postal generada aparte
sería parecida pero distinta, y la tarjeta prometería un nivel que no es.

Cada mundo tiene además una barra con cuántos de sus cuatro niveles están
hechos.

## Los fondos

Tres capas por tema, 24 imágenes generadas: cielo, lejos y cerca, cada una a su
velocidad. Una sola imagen de fondo se ve plana, y en vertical el cielo ocupa
dos tercios de la pantalla — ahí se decide si el juego se ve bien o se ve pobre.

Las dos bandas se anclan al **mundo** y no a la pantalla, y el paralaje vertical
se calcula **relativo a la cámara de reposo**. Con `ancla − camY × factor` la
banda se corre hacia abajo a medida que la cámara sube, y en vertical terminaba
tapando al jugador.

## Pantalla y HUD

El lienzo **llena la pantalla**. El alto es fijo —**9 tiles**, la medida del
Mario original— y el **ancho sale de la proporción real de la pantalla**: en un
teléfono acostado se ve más a los costados, en uno parado menos, y nunca hay
bandas negras ni deformación. Antes era un lienzo fijo dentro de una caja
centrada y en un teléfono eso dejaba media pantalla en negro.

El HUD copia la disposición del género: **pausa arriba a la izquierda**, el
número del nivel grande y centrado con contorno, **monedas arriba a la derecha**
con su icono, y el mundo y el nombre del nivel abajo a la derecha. Los iconos
son pixel art generado. Deja pasar el toque salvo en sus
propios botones: si capturara toda la franja de arriba, el jugador perdería el
salto justo cuando mira el reloj.

## Cómo se ve

El juego se dibuja en un lienzo de **320×180** y se estira a la pantalla con el
suavizado apagado: un píxel es un píxel. El héroe se dibuja a 30 px de alto
—casi dos tiles— sobre una caja de colisión de 11×15, que es la que validó los
niveles. El sprite más grande que la caja es lo que hacen todos los
plataformeros: la caja se siente justa y el personaje se ve grande.

## Correr

```sh
python3 -m http.server 8802 --bind 127.0.0.1
./pruebas/correr.sh
python3 empaquetar.py             # -> pique-en-un-archivo.html
python3 generar_sprites.py estado
```

## Trampas ya pagadas

1. **El tamaño pedido se ignora.** Ver arriba: 16 de 17 hojas al tacho.
2. **La textura del terreno a escala equivocada.** La imagen mide 256 y el tile
   16: usada tal cual, una copia cubre dieciséis tiles y el suelo se ve como
   cuatro franjas gigantes. Se achica a 32 y repite cada dos tiles.
3. **La textura viene en capas.** El tile de llanura es "pasto sobre tierra", y
   repetido pone una franja de pasto cada dos tiles, que se lee como sándwich.
   Se usa el tercio de abajo —el material puro— y el borde de pasto se dibuja
   aparte, solo donde hay cielo encima.
4. **`source-atop` tiñe todo el lienzo, no el sprite.** La moneda de color
   quedaba adentro de un cuadrado rosa opaco. Se tiñe en un lienzo aparte.
5. **El recorte del sprite se mide sobre TODOS los cuadros juntos.** Recortando
   cuadro a cuadro, el bicho se mueve un píxel para los costados en cada paso.
6. **Escritura concurrente sobre el mismo JSON.** Un proceso pidiendo y otro
   bajando: el que guarda último pisa lo del otro. Se perdieron nueve pedidos ya
   pagados. Se relee el archivo justo antes de escribir.
7. **El prompt corta a los 2000 caracteres.** Al reforzar el contrato de grilla,
   el del héroe se pasó y el pedido fue rechazado. Se recortó la descripción,
   **no las negaciones**: son las que evitan el parecido.
8. **`imageSmoothingEnabled` se reactiva al cambiar el tamaño del lienzo.** Hay
   que volver a apagarlo o los sprites salen lavados sin que nada avise.
9. **El lienzo adentro de la pantalla de juego se pinta ENCIMA del HUD.**
   `#p-juego` tiene `z-index: 2` y crea su propio contexto de apilamiento; el
   canvas, que va después en el DOM con `z-index: 0`, gana. El HUD existía, se
   podía tocar, tenía su fondo aplicado — y no se veía. El canvas va **fuera**
   de las pantallas y primero en el DOM.
10. **Un tubo mide dos tiles de ancho**, así que cada mitad dibuja la MITAD de
    la pieza. Dibujando la pieza entera en cada tile, la boca sale dos veces
    una al lado de la otra y se lee como dos cajitas.
11. **El recorte de fondo del servidor falla a veces.** De 17 hojas, tres
    salieron mal: una con 30,5% de magenta sin recortar y otra 93% opaca. En
    pantalla es un cuadrado de color alrededor del bicho. `despegar_fondo.py`
    lo resuelve en post —determinista y gratis— y `pruebas/assets.py` lo mide
    para que no vuelva.
12. **Un reemplazo masivo sobre el código fuente pisa las líneas de `import`.**
    Quedó `import { VISTA.ancho }`, que es un error de sintaxis: página en
    blanco y una sola pista en la consola. `pruebas/sintaxis.mjs` lo caza en un
    segundo.
13. **Los nombres de las criaturas no se renombraron al copiar el archivo.**
    `entidades.js` venía de la versión vieja con `koopa` y `planta`, y como cada
    nombre busca su hoja de sprites, los bichos salían como rectángulos
    naranjas. Ese rectángulo es el respaldo, y hacía bien en aparecer.

## Lo que falta

| pendiente | qué sería |
|---|---|
| Efectos de sonido grabados | los generados venían de 380 KB cada uno, clips largos donde hace falta un golpe de medio segundo; los efectos siguen sintetizados y la **música sí es grabada** (3 pistas) |
| Hojas extra | correr hacia atrás, aterrizaje, y una de daño |
| Generar en un *worker* | el peor caso de 1136 ms bloquea el hilo |

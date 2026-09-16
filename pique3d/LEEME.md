# Pique 3D — un corredor 2.5D con assets generados y niveles comprobados

Todo lo que ves es **3D de verdad**: el terreno tiene volumen, el sol proyecta
sombras que se mueven con vos, la cámara tiene perspectiva y hay niebla con
profundidad. La **dirección sigue siendo 2D**: corrés en X, saltás en Y, y nada
se mueve en Z. Eso es 2.5D, y es a propósito — la profundidad hace que se vea
bien; si además hubiera que apuntar en Z, el juego dejaría de ser de un botón.

24 niveles en 6 mundos. **Ninguno dibujado a mano y ninguno publicado sin
haberse jugado entero por dentro primero.**

## Lo medido

Todo sale de `./pruebas/correr.sh`, no de una estimación.

| | |
|---|---|
| niveles generados y validados | **72/72** (24 × 3 colores) |
| caminos del validador rehechos dentro del motor 3D | **72/72** |
| el archivo único, desde `file://` | **12/12** |
| celular, acostado y parado | **14/14** |
| llamadas de dibujo por cuadro | **8–9** |
| triángulos por cuadro | **12.100–14.400** |
| peor generación de nivel | 1038 ms · típico ~130 ms |
| archivo único | **3,6 MB** (5,2 con música grabada) |

## Los assets: generados, y originales

Los modelos 3D, las texturas y la música están **generados con IA** (Rezona
Lab), no comprados ni copiados. `generar_assets.py` tiene todos los prompts y
se puede volver a correr entero.

**Ninguna criatura copia a un personaje de nadie.** Cumplen roles clásicos del
género —el que camina, el del caparazón, el que no se puede pisar— y eso es un
rol de juego, que no se puede registrar. El diseño y el nombre son propios, y
cada prompt niega explícitamente los parecidos (`NOT a plumber`, `no moustache`,
`not a turtle`, `no cap`). Está todo en `assets/ESTILO.md`.

| en el código | qué es |
|---|---|
| `heroe` | **Pique** — corredor con antiparras y bufanda |
| `bolo` | piedra musgosa con patitas |
| `caracol` | caracol acorazado — se pisa y el caparazón barre |
| `aleta` | medusa con aletas |
| `erizo` | abrojo con púas — **no** se puede pisar |
| `fauces` | flor dentada en un conducto |
| `osario` | pila de huesos que se rearma |
| `vela` / `brasa` | llama fantasma / chispa de lava |
| `yunque` / `coloso` | los dos jefes |

Y el conducto es **teal con aro ámbar**, no un tubo verde.

## Lo que hace que esto no sea un generador más

Cada nivel se arma con 21 piezas parametrizadas desde una semilla que sale del
número del nivel —el 3-2 es siempre el 3-2— y después **se resuelve con una
búsqueda en haz sobre la física de verdad**: 96 estados, cada uno se abre en dos
por cuadro, se tiran los repetidos. Si no hay camino, o si el camino pide volver
sobre los propios pasos más de 2,2 veces el largo del nivel, se tira y se arma
otro. El tiempo límite sale de lo que tarda ese camino. Las cinco monedas de
color se ubican en celdas **que el camino probó que se alcanzan**.

**La física del 3D es exactamente la misma que valida los niveles** — el mismo
`fisica.js`, sin una línea distinta. `pruebas/niveles3d.mjs` lo comprueba de la
única forma que vale: le pide al validador el camino que encontró y lo rehace
cuadro por cuadro dentro de una partida 3D real, con su escena y sus modelos.
72 de 72. Si el 3D hubiera tocado la física sin querer, esto daría rojo.

**Lo que el validador NO comprueba: los enemigos.** Uno se esquiva, se pisa o se
vaultea; una pared de nueve tiles no.

## Correr

```sh
python3 -m http.server 8801 --bind 127.0.0.1    # el juego, en /pique3d/
./pruebas/correr.sh                              # todas las pruebas
python3 empaquetar.py [--musica]                 # -> pique3d-en-un-archivo.html
python3 generar_assets.py estado                 # qué assets hay
```

## Las trampas que ya se pagaron

1. **Los GLB de la IA vienen con 990.000 triángulos y 28 MB cada uno.** El
   propio kit dice que el techo en móvil son 50.000 por modelo héroe: vienen
   veinte veces por encima. `optimizar_modelos.sh` los baja a 1.700–13.500 y
   **299 MB pasan a 1,5 MB** — 300 veces menos, y siguen siendo reconocibles.
   Sin Draco ni meshopt a propósito: los dos necesitan un decodificador aparte
   y el juego tiene que entrar en un archivo.
2. **El tinte por vértice es un brillo, no un color.** La primera versión
   tintaba cada cara con el color del tema, lo que multiplica la textura: un
   marrón por una textura de pasto ámbar da barro rojo, y las ocho texturas
   —cada una con su color— terminaban todas del mismo tono sucio.
3. **Dos texturas por tema, no una.** Con una sola, el pasto de la cara de
   arriba trepa por el paredón y se ve como césped vertical. La de arriba es la
   superficie; la de los costados es el corte del terreno.
4. **El sol va de costado, no de frente.** De frente, cada sombra cae justo
   detrás del objeto que la tira: el nivel entero parece plano aunque el motor
   las esté calculando.
5. **`renderer.info.autoReset = false` sin llamar a `reset()`** hace que las
   cifras sean acumuladas. Medían 362 llamadas y 710.000 triángulos; las reales
   eran 17 y 24.000. Casi "optimizo" un problema que no existía.
6. **`preserveDrawingBuffer`**: sin eso, el navegador limpia el canvas entre
   dibujos y una captura de varios modelos sale con uno solo, el último.
7. **En un teléfono parado entran 54 tiles de alto.** El nivel mide 24: se veía
   el nivel entero y medio de vacío. Hay techo de cámara, y el juego avisa que
   gires — con un botón para jugar igual, porque hay teléfonos con el giro
   bloqueado.
8. **El empaquetador falló tres veces y cada una enseñó algo:** el `import` de
   GLTFLoader es multilínea y con comillas simples; `BufferGeometryUtils` usa
   `export function` **y** un `export{}` final; three.js minificado cierra con
   `}export{nt as ACESFilmicToneMapping,...}` **pegado en la misma línea**, así
   que una expresión anclada con `^` no lo ve — y el alias importa, porque
   devolver el nombre público apunta a una variable que no existe. Y
   `export async function` no entraba en el detector: el archivo se armaba
   "bien" y moría con `precargar is not a function` recién al abrirlo.
9. **`output_format` rompe la generación de música.** Con `kind: "music"` el
   servidor rechaza el pedido entero con un `VALIDATION_ERROR` que no dice cuál
   es el campo culpable. Se encontró probando de a un parámetro.
10. **Los efectos de sonido generados vinieron de 380 KB cada uno** — clips
    largos donde el juego necesita un golpe de medio segundo. Los efectos van
    sintetizados (suenan en el cuadro exacto y pesan cero); la música, grabada.

## Lo que falta

| pendiente | qué sería |
|---|---|
| Usar el rig del héroe | `heroe_rig.glb` está generado (esqueleto + correr/saltar) pero pesa 39 MB sin optimizar; hoy la animación es procedural |
| Generar en un *worker* | el peor caso de 1038 ms bloquea el hilo |
| Publicar en Rezona Lab | `upload_project` pide un `dist/index.html` con el formato del kit |
| Sombras en cascada | una sola caja de sombra limita el alcance en los niveles altos |

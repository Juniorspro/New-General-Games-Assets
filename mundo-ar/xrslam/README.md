# XRSLAM en la web: SLAM visual-inercial de código abierto en una página

[XRSLAM](https://github.com/openxrlab/xrslam) (OpenXRLab, **Apache-2.0**) es
un SLAM visual-inercial hecho para AR en teléfonos: funde la cámara con el
giróscopo y el acelerómetro, igual que ARCore. Acá está compilado a
WebAssembly, con arreglos propios, y metido en una página que anda en
cualquier navegador **y en un WebView**. No usa WebXR ni ARCore, y la escala
sale en metros.

```
https://raw.githack.com/Juniorspro/New-General-Games-Assets/claude/hola-80z86i/mundo-ar/xrslam/web/index.html
```

(githack muestra un aviso la primera vez: tocá **Open the page**.)

## Lo medido

Todo con [EuRoC](https://projects.asl.ethz.ch/datasets/euroc-mav/)
V1_01_easy: un dron que vuela 58,5 m en una sala, con la trayectoria real
medida por cámaras Vicon. El número es el **error de posición (ATE RMSE)**
después de alinear las dos trayectorias, la cuenta estándar de los papers.

| | error | por cuadro |
|---|---|---|
| XRSLAM nativo (Linux) | **0,052 m** | 21 ms |
| XRSLAM en WebAssembly | **0,049 m** | 34 ms (Node) |
| AlvaAR, el SLAM de `../web` (sólo visual, escala regalada) | 1,20 m | 13 ms |
| **la página en Chromium, a velocidad real** (Worker + wasm + dibujo) | **0,158 m** | 16 cuadros/s de SLAM, dibujo a 60 |

XRSLAM publica 0,056 m para esta secuencia: el armado de acá coincide.

### Sensores de navegador

Un navegador no da los sensores de un dron de laboratorio. Da la IMU a unos
60 Hz, con horas que tiemblan unos ms y con un desfase desconocido respecto
de la cámara. `herramientas/correr-wasm.mjs` simula eso sobre EuRoC:

| condición | error |
|---|---|
| EuRoC tal cual (IMU a 200 Hz, mismo reloj que la cámara) | 0,049 m |
| IMU a 60 Hz promediada, como un sensor de teléfono | 0,100 m |
| + horas con temblor de ±4 ms | 0,102 m |
| + imagen de 481×307 (22 ms por cuadro, la mitad) | 0,139 m |
| **cámara atrasada 30 ms** respecto de la IMU | 0,245 m |
| cámara atrasada 60 ms | 0,88 m |
| cámara atrasada 100 ms | 3,59 m |
| **todo lo anterior, con el desfase estimado solo** (0 a 100 ms) | **0,058 m** |

El que rompe todo es **el desfase entre cámara e IMU**, y XRSLAM no lo
estima: lo toma como dato fijo. `web/desfase.js` lo mide. Compara lo que se
corre la imagen entre cuadros (búsqueda de bloques a 1/8 de resolución) con
lo que predice el giróscopo, y busca el corrimiento de tiempo donde mejor
coinciden. La pendiente de esa misma comparación es **la focal de la
cámara**: la página se calibra sola, sin pedir el campo de visión del lente.
En el navegador, con EuRoC, dio **focal 286,8 px contra 286,7 reales** y
desfase 7,7 ms contra 0.

### La calibración en un teléfono

La página no confía en lo que supone. Mide:

- **el desfase** cámara-IMU;
- **la focal**;
- **cómo está montada la cámara respecto de la IMU**: ajusta una matriz
  que lleva el giro 3D del giróscopo al corrimiento 2D de la imagen, y la
  lleva a la escuadra más cercana;
- **los relojes**: si la hora de la cámara (`captureTime`) o la de los
  sensores está a más de 1 s de `performance.now()`, la corre a ese reloj.
  Con horas en otro reloj, las series nunca se cruzarían.

Si no alcanza, dice por qué: pocos cuadros, falta el giróscopo, relojes que
no se cruzan, poco giro en algún sentido, montaje dudoso o poca coincidencia.
Junta los últimos 8 s y reintenta cada segundo. **Sin calibrar** arranca
con la focal del control, desfase 0 y el montaje supuesto.

Probado en el navegador con EuRoC (`euroc-navegador.mjs … calibrar`):

| caso | focal (real 287 px) | desfase (real 0) | montaje |
|---|---|---|---|
| normal | 289,6 px | 12 ms | el supuesto, confirmado |
| cámara en otro reloj (5000 s corrida) | 289,8 px | 8,7 ms | ✓ |
| montaje supuesto equivocado | 304 px | −7,5 ms | medido, correcto |

Aceptar con poco rigor daba la focal +31 %. Por eso pide ≥ 0,25 rad/s de
giro y correlación ≥ 0,85. El dron de EuRoC gira menos que eso: las pruebas
bajan el mínimo con `?mingiro=`.

Trampas que aparecieron:

- **Bajar la IMU tirando muestras mete aliasing.** El dron vibra, y
  quedarse con una muestra de cada tres daba 2,8 m. Un sensor de teléfono
  filtra antes de bajar la frecuencia; promediando, 0,10 m. La primera
  simulación exageraba.
- **No sirve medir el desfase contra el giro que devuelve XRSLAM.** Ese giro
  ya está fundido con el giróscopo y alineado a sus horas: daba ~0 ms con
  cualquier desfase real.
- **La focal pesa:** con 3 % de error, 0,156 m; con 8 %, 0,41 m. Por eso se
  estima en vez de adivinarla por modelo de teléfono.

## Lo que se le cambió a XRSLAM (`parches/`)

1. `base64.h` usa `uint32_t` sin `<cstdint>`: no compila con GCC nuevos.
2. `XRSLAM.h` usa `std::vector` sin `<vector>`.
3. El log pasaba el mensaje como *formato* de spdlog: con llaves adentro se
   rompía, y los fmt nuevos no compilan eso.
4. **La IMU de cada cuadro empieza en la hora exacta del cuadro anterior.**
   Antes arrancaba en la primera muestra posterior y el pedazo previo no se
   integraba. En EuRoC no se nota (cámara e IMU comparten reloj); con un
   navegador, donde no coinciden, sí.

Y para la web, sin tocar XRSLAM:

- **OpenCV 4.10 mínimo** compilado a wasm con SIMD (`opencv-wasm.sh`).
- **Ceres sin hilos ni LAPACK** (`web/ceres-web.cmake`) y **spdlog 1.14**
  (`web/spdlog-web.cmake`). El 1.3.1 no compila con la libc++ de Emscripten.
- **El localizador reemplazado por uno vacío** (`web/sin-localizador`). El
  original se ubica contra un servidor de mapas por HTTP, cosa que no sirve
  en una página.
- **Pila de 8 MB.** Con los 64 KB de Emscripten, Ceres y Eigen pisaban la
  memoria: "memory access out of bounds" a mitad de la secuencia.

## La página (`web/`)

- `trabajador.js`: XRSLAM corre en un **Web Worker**, así el dibujo va a 60
  aunque el SLAM tarde. Cada cuadro se manda recién cuando terminó el
  anterior: si el SLAM viene atrasado, los cuadros de más se pierden, como
  con una cámara, y no se acumulan.
- **Sensores:** la API *Generic Sensor* si está (cada lectura trae la hora
  en que se midió). Si no, `devicemotion`, con las horas enderezadas por una
  recta. En iOS la aceleración viene con el signo al revés y se corrige.
- **Cámara:** la imagen entera achicada a 300 px de lado corto, con la hora
  de `requestVideoFrameCallback` (`captureTime` si el navegador la da).
- **Ejes:** la cámara trasera en el marco del teléfono según el giro de la
  pantalla. Con la pantalla a 90°, la rotación es la misma que trae la
  configuración de iPhone de XRSLAM.
- **Entre poses del SLAM, la cámara 3D se adelanta con el giróscopo:** el
  mundo no se retrasa aunque el SLAM vaya a 10-15 cuadros por segundo.
- **El piso** sale de los puntos del mapa: el mundo de XRSLAM tiene la
  gravedad hacia abajo, así que es la altura con más puntos por debajo de la
  cámara. Si todavía no hay piso, se usa uno a 1,3 m por debajo.
- **Calibración:** 4 s girando el teléfono la primera vez. Queda guardada
  por resolución y giro de pantalla; **Recalibrar** la repite.
- `?prueba=euroc&datos=<url>` reproduce una secuencia exportada en lugar de
  la cámara (así se probó todo acá).

## Cómo se arma y se prueba

```
./construir.sh nativo      # corredor + exportar (Linux, OpenCV del sistema)
./construir.sh web         # web/dist/xrslam.{mjs,wasm} (pide emsdk activo)

$C/xrslam-nativo/exportar <sensor.yaml> <EuRoC/mav0> <carpeta>    # EuRoC → binarios
node herramientas/correr-wasm.mjs web/dist/xrslam.mjs <slam.yaml> <sensor.yaml> <carpeta> salida.tum
python3 herramientas/ate.py salida.tum <mav0/state_groundtruth_estimate0/data.csv>
./herramientas/matriz.sh <carpeta> <groundtruth.csv> <salida>     # la tabla de sensores de navegador
node herramientas/euroc-navegador.mjs <carpeta> <salida> [segundos] [calibrar]   # la página en Chromium
node herramientas/correr-alva.mjs <alva_ar.js> <carpeta> salida.tum <fx>          # AlvaAR, para comparar
```

Todo lo que se baja (XRSLAM fijado a un commit, OpenCV, Ceres, spdlog,
Eigen) va a `~/.cache/mundo-ar`, fuera del repo. En el repo quedan sólo
nuestros archivos y los parches. `web/dist/` es lo compilado: está en el repo
para que la página se pueda hostear.

## Lo que NO se probó

- **En un teléfono.** Esta máquina no tiene uno. Está probado con EuRoC,
  también simulando sensores de navegador, y en Chromium con la cámara falsa
  (sin IMU avisa que no hay giróscopo). Lo que puede fallar en un teléfono:
  - **Velocidad.** En esta compu, un cuadro de 470×300 cuesta 13-22 ms; un
    teléfono de gama media puede tardar 3-4 veces más. Con `?corto=240` la
    imagen se achica.
  - **El ruido de la IMU.** Se usa el de EuRoC (el de iPhone en XRSLAM es
    igual). Los giróscopos de teléfono andan en el mismo orden, pero no está
    medido.
  - **Generic Sensor en un WebView.** Puede no estar. Entonces se usa
    `devicemotion`, que sí está.
- **El obturador rodante (rolling shutter)** de los teléfonos. EuRoC tiene
  obturador global. XRSLAM trae el parámetro, pero está en 0.

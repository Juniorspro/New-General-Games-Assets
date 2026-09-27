# AEROPLAZA — cuadragésima primera vuelta (27/09/2026): tu espacio como un Quest y la cámara 0,5x

Pidió: "que el espacio sea principalmente Meta Quest style; la mira (el puntito) no debería apretar, para algo las
manos; las pantallas deben aparecer alejadas; y sobre todo la cámara debe usarse en 0,5x". Mandó la APK de AngleCam
("exprime y te da acceso a la ultra angular"). Antes: [aeroplaza-33](aeroplaza-33.md) (manos como Quest),
[aeroplaza-29](aeroplaza-29.md) (tu espacio, el 0,5x que ARCore no deja) y [aeroplaza-39](aeroplaza-39.md) (Fusion).

## La mira no aprieta

- **`Ventanas({ quieta })`**: los segundos de mirada para apretar.
  - En tu espacio vale 0: quedarse mirando no aprieta ni llena la barra.
  - En el mundo del juego sigue en 1,4 s: sin manos es lo único que hay.
- **Con una mano a la vista, la mirada ni cuenta ni se ve**: el punto se apaga en 0,25 s y apunta y aprieta la
  mano (`espacio.conMano`).
- **Sin manos queda el toque** en la pantalla (el botón del visor), que es apretar a propósito.

## Las pantallas lejos (`espacio.js › LEJOS_Q`)

| Qué | Antes | Ahora |
| --- | --- | --- |
| La pantalla | arriba del borde de la mesa, a menos de 1 m, 1,1 m de ancho | 1,9 m, 18 cm abajo de los ojos, escala 1,45 (1,59 m de ancho) |
| Las ventanas nuevas | arco a 0,85 m | arco a 1,45 m, escala 1,7 (el mismo ángulo) |
| La tarjeta | 0,7 a 1,6 m | 1,3 a 2,2 m, escala 2 |
| Las lentes | 0,55 m | 1,1 m, escala 1,8 |

- **Por qué lejos**:
  - las lentes del visor enfocan lejos, y de cerca los dos ojos no juntan bien;
  - el temblor de la cabeza corre menos lo que se ve.
- **`Ventanas.hasta(o, d, lejos)`**: si hay una pared antes, 15 cm delante, y nunca a menos de 0,9 m.
- **`Tablero.escala`** agranda la malla (el crecer al nacer la multiplica). Las cuentas van en el vidrio y no
  cambian.
- **Se tocan con el rayo y el pellizco.** La yema ya no llega, como en un Quest lejos.
- **Trampa**:
  - `espacio.paredes()` usa `_a` de trabajo;
  - si la dirección está en `_a` y se llama a `hasta`, se pisa: la pantalla salía a 4 m y de costado;
  - la dirección va en un vector propio (`hasta` clona `d`).

## AngleCam (qué se aprendió de su APK; se miró el bytecode con `dexdump`, no se copió código)

- Usa CameraX y Camera2.
- `MainActivity` recorre `getCameraIdList()` y, de cada cámara, lee:
  - `LENS_FACING`;
  - `LENS_INFO_AVAILABLE_FOCAL_LENGTHS` y `SENSOR_INFO_PHYSICAL_SIZE`. Con eso saca el campo, `2·atan(lado / 2f)`, y
    la marca " (Ultra-wide)";
  - `CONTROL_ZOOM_RATIO_RANGE` (Android 11+), que guarda como `cameraXIDsMinZoom`.
- **Dos caminos oficiales, sin trucos**:
  - abrir la ultra ancha por su número, si el celu la da;
  - el zoom menor que 1 en la cámara lógica: el celu pasa solo a la lente ancha.
- El `setPhysicalCameraId` que aparece es de CameraX por dentro.

## La 0,5x en tu espacio

- **ARCore sigue dónde estás solo con la cámara que tiene calibrada** (la principal), y la cámara es de uno solo.
- **`Ancha.java`** (Java puro) elige el camino. Del mejor al peor:
  - `zoom`: la lógica con zoom < 0,95, si abre casi lo mismo que la otra (a 5° o menos);
  - `id`: otra cámara de atrás, al menos 15° más ancha, que se pueda abrir;
  - `fisica`: una lente física escondida. Se anota, no se usa.
  - Da `via id zoom campo principal`, por ejemplo `zoom 0 0.60 98 70`.
- **El modo 0,5x** (`MainActivity.espacioAncho`, `Ar.pasarAAncho`/`volverDeAncho`):
  - hace falta que Fusion ya esté alineada con ARCore (`listo`); si no, contesta `espera`;
  - ARCore queda en pausa con su mundo (`corriendo` sigue en true);
  - `Fusion.congelar` pone la velocidad del lugar en 0;
  - `CamaraManos` (`ancha`, `pasante`) abre la ultra ancha:
    - con `CONTROL_ZOOM_RATIO` si va por zoom, y la focal en píxeles × zoom;
    - con `DISTORTION_CORRECTION_MODE_FAST` si la cámara lo tiene;
  - la foto sale con `Fusion.camaraEn(t)`: la pose de la cámara en la hora de la foto, con el giro del giroscopio y
    el lugar quieto;
  - las manos siguen con su `ManosNativas`.
  - Girar la cabeza anda; caminar no. Para caminar se vuelve a 1x con el botón.
- **El juego**:
  - `Nativo.camaraAncha()` y `Nativo.ancho` (`corre` · `espera` · `no-ar` · `apagada`);
  - en la pantalla, "📷 Cámara 0,5x", prendido de entrada si el celu la tiene (`aeroplaza.ancha`);
  - `cuidarAncha` la pide cada 1 s mientras dice `espera`;
  - escanear de nuevo, medir las manos y salir la apagan;
  - con la 0,5x, tu espacio cuenta como vivo sin poses de ARCore.
- **Medido** (`PruebaFusion`, 6 s con ARCore y 6 sin él):
  - el giro sin ARCore: 0,34° de media, p95 0,74°;
  - el lugar se movió 0,00 mm;
  - la pose de la foto: 0,33°.

## Pruebas

- `espacio.mjs` 32/32. Las cuatro nuevas:
  - la ventana nace a 1,45 m, con escala 1,7;
  - frente a la pared de −1,5 queda en −1,35;
  - la X lejos se cierra con el rayo y el pellizco;
  - mirar 3 s no aprieta, y con una mano la mira se apaga.
- `ancha.mjs` 17/17:
  - PruebaAncha, 7 celus de mentira;
  - el botón y los pedidos con `espera`;
  - sin poses sigue vivo, y la foto de 98°;
  - volver a 1x se guarda; escanear y salir la apagan;
  - con una APK vieja, nada.
- `cabeza.mjs` 20/20, con los 3 de la 0,5x en Java.
- nativo 18, choque 22, vr 19, malla 19, camara 13, manos 20, lentes 14, mando 18: todas bien.
- La APK `--canciones` compila (23,9 MB).

## Lo que falta

- Probarlo en el celu:
  - qué camino elige (zoom o número) y si la foto ancha cae derecha (la pose de Fusion);
  - si al volver a 1x ARCore retoma su mundo.
- Una lente física junto con ARCore (Shared Camera) no se probó: casi ningún celu la deja.

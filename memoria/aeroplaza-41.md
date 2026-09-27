# AEROPLAZA — cuadragésima vuelta (27/09/2026): que no se cierre al entrar al ARCore, y si se cierra, que diga por qué

Pidió: "se me cierra la app al entrar al ARCore". No hay logcat (no lo puede mandar). Antes:
[aeroplaza-39](aeroplaza-39.md) (la cabeza con los sensores del celu, `Cabeza.java`) y [aeroplaza-37](aeroplaza-37.md)
(la configuración de ARCore en el hilo de GL).

## Lo que lo cerraba (leyendo el código; en el celu no se pudo ver)

- **La cabeza de la vuelta 39 pedía los sensores con `SENSOR_DELAY_FASTEST` (0 µs).**
  - Con targetSdk 31+ y una APK **depurable** (la nuestra: `assembleDebug`), Android tira `SecurityException` si se pide
    el giróscopo o el acelerómetro a menos de 5000 µs sin el permiso `HIGH_SAMPLING_RATE_SENSORS`.
  - El vector de rotación "de juego" no está en esa lista: se registraba y el giróscopo, después, tiraba.
  - La de la tienda (no depurable) no tira: la baja a 200 Hz callada.
  - Estaba dentro del `try` de `Ar.iniciar`: ARCore contestaba "error", pero la sesión quedaba **reanudada y con la cámara
    tomada**, sin dibujarse (`corriendo = false`), y las manos sin ARCore abrían la cámara encima.
- **Los avisos de los sensores (cientos por segundo) iban al hilo de la interfaz**, el mismo que arranca ARCore.
- **Si el proceso de la WebView se cae** (sin memoria, un error de Chrome o de la placa) y no hay `onRenderProcessGone`,
  Android cierra la app entera.
- `pausar()` (en `onPause`) y `cerrar()` no tenían `try`: si `sesion.pause()` tiraba, se cerraba al salir.

## Lo que se cambió

- `Cabeza.java`:
  - los sensores van a 5000 µs (200 Hz, lo más que deja Android 12+ sin el permiso);
  - van en su propio `HandlerThread("cabeza")`;
  - `prender`, `onSensorChanged` y `leer` nunca tiran;
  - si algo falla, queda en `falla` (se ve en `cabezaEstado`) y el juego sigue con la pose de ARCore.
- `Ar.java`:
  - `iniciar` y `reanudar` prenden la cabeza **después** del `try` de ARCore;
  - si el arranque falla, pausa la sesión y el GL, y suelta la cámara;
  - `pausar` y `cerrar` tienen un `try` por paso.
- `MainActivity.java`:
  - la WebView se arma en `crearWeb()`;
  - `onRenderProcessGone` suelta ARCore y la cámara, la destruye y arma otra con el juego;
  - `enviar` no rompe si todavía no hay WebView.

## El informe del cierre (sin logcat: se le saca captura al aviso)

- **Java**: `Thread.setDefaultUncaughtExceptionHandler` anota en `SharedPreferences("aeroplaza")` antes de morir (y deja
  morir igual):
  - el hilo, la clase y el mensaje;
  - la causa de abajo;
  - las 2 primeras líneas y hasta 2 nuestras (`Choque.java`).
- **Nativo, ANR, memoria**: al abrir, `ActivityManager.getHistoricalProcessExitReasons(null, 0, 6)` (Android 11+).
  - Toma el primer cierre de verdad, de hace menos de 12 h, más nuevo que `salidaVista`.
  - Cuentan CRASH, CRASH_NATIVE, ANR e INIT_FAILURE; LOW_MEMORY y SIGNALED solo con importancia ≤ 200 (a la vista).
    El usuario (10) y la app misma (1) no cuentan.
  - CRASH_NATIVE: el tombstone es protobuf (Android 12+). `Choque.tombstone` lo lee con un lector mínimo y saca:
    - la señal (campo 10);
    - la causa (15) y el abort (14);
    - del hilo que cayó (16, con clave = tid 6): su nombre y las primeras funciones, con las seguidas de la misma
      biblioteca juntas.
    - Si no se puede leer, saca las bibliotecas `.so` que nombra.
  - ANR: el "Subject:" y las 4 primeras líneas `at` del hilo "main".
- **ARCore prendido**: `arVivo` va a `true` (con `commit`) al arrancar y a `false` al pausar. Si la app muere sin pasar
  por `onPause`, la próxima vez el informe empieza con `[ARCore]`.
- **La WebView caída**: `WEBVIEW_CRASH` o `WEBVIEW_KILLED`.
- **El juego**:
  - lo pide una vez (`AeroplazaNativo.choque()` → `Nativo.choque()`) después de `UI.juego()`;
  - lo muestra en un aviso 💥 **fijo** (`notificar({ fija: true, dur: 30000 })`): otro aviso no lo saca, va abajo;
  - el aviso es largo (`.noti.larga`, hasta 9 renglones de 10,5 px);
  - el título está en los 3 idiomas (`noti_choque`); los nombres de Android (CRASH_NATIVE…) van tal cual.

## Pruebas

- `pruebas/choque.mjs` 22/22 (en la tanda `--manos`):
  - `PruebaChoque.java` con un tombstone de mentira hecho a mano en protobuf (3 hilos), uno con abort, bytes que no son
    protobuf, un ANR y una excepción envuelta;
  - el código: sin `SENSOR_DELAY_FASTEST`, 5000 µs y el hilo propio; la cabeza fuera del `try`; la pausa en el `catch`;
    `onRenderProcessGone`;
  - el juego: el aviso sale entero, dentro de la pantalla (76 px), otro no lo saca, sigue a los 7,5 s, se pide 1 vez,
    y el título está en 3 idiomas.
- nativo 18, cabeza 17, espacio 28, vr 19, malla 19, mando 18: todas bien a la primera.
- La tanda común (22 pruebas, `avisos` incluida: se tocó `notificar`) 22/22 a la primera, en 7,7 min.
- La APK `--canciones` compila (23,9 MB).
- Ojo: una variable local `java` tapa el paquete `java.nio…` (javac: "cannot find symbol"). Se llama `deJava`.
- `__A.textos = { t, ponerIdioma }`: la página de las pruebas es el IIFE armado, así que no se puede importar `js/textos.js`.

## Lo que falta

- Probar en el celu:
  - si sigue cerrándose, el aviso de la próxima apertura dice dónde;
  - un choque nativo antes de Android 12 solo dice `[ARCore]` (sin tombstone).

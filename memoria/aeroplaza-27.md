# AEROPLAZA — vigesimosexta vuelta (27/09/2026): la APK con ARCore

Sigue de [aeroplaza-26](aeroplaza-26.md). Rama `claude/fijate-iszyer`.

## Lo que pidió

- Mandó un TikTok (Abood Tech, "Meta cooked with their VR headsets", la app
  Spatial en un Quest 3S): "mirá esa estabilidad; sé que es de las 3 cámaras,
  pero hay que revolucionar". La próxima versión, compilada en APK "con la
  posibilidad de ARCore".

## Lo que es

- **La estabilidad del Quest es la cabeza en 6 ejes**: el visor sabe dónde está
  (no solo para dónde mira) y el mundo queda quieto. El VR del celu usaba solo
  el giroscopio (3 ejes): al asomarse o agacharse, el mundo se venía con uno.
  ARCore hace los 6 ejes con una cámara y los sensores.
- **ARCore no sigue manos**: se quedó MediaPipe, pero el de Android, sobre las
  fotos de ARCore (con ARCore la cámara es suya y la web no la puede abrir).

## Lo que quedó (`aeroplaza/android/`, Java)

- **`MainActivity`**: la WebView a pantalla completa, acostada, con
  `WebViewAssetLoader` (los assets por https: la web los ve como un sitio
  seguro); los permisos de cámara y micrófono de la web; atrás es Escape (dos
  seguidas, sale); `window.AeroplazaNativo` (`arEstado`, `arIniciar`, `arParar`,
  `arManos`, `flash`, `vibrar`).
- **`Ar`**: la sesión de ARCore con un GLSurfaceView de 1 × 1 atrás de la
  WebView (solo para la foto de la cámara); la cámara de 60 fps si hay
  (`CameraConfigFilter`), con la foto de la CPU más cerca de 640 × 480; cada
  foto, la pose orientada a la pantalla y su edad a `window.__nativo.pose`; el
  flash con `Config.FlashMode.TORCH`.
- **`ManosNativas`**: MediaPipe de Android (tasks-vision 0.10.35, GPU y si no
  CPU, `hand_landmarker.task` de los assets), la foto YUV copiada y pasada a RGB
  en otro hilo, girada derecha y con la luz de la web (hasta ×6); el campo sale
  de la calibración de ARCore (`getImageIntrinsics`), no supuesto.
- **`herramientas/apk.mjs`**: arma el juego, pone el HTML (con
  `AEROPLAZA_APK` y el modelo servido desde adentro) y `hand_landmarker.task`
  en `app/src/main/assets` (ignorado) y corre Gradle. 17,0 MB; con canciones,
  23,9 (esa solo para quien pide). Solo `arm64-v8a`. Con `--wasm` mete también
  el MediaPipe de la web (`vision_bundle.mjs` y los wasm): +23 MB, y las manos
  de la web (sin ARCore) andan sin internet.

## Del lado del juego

- **`js/nativo.js`**: `Nativo` (el estado de ARCore, la última pose y la
  anterior), `poseEn` (la pose adelantada a cuando se ve: el giro de la cámara
  y el lugar de los OJOS, 6 cm detrás del celu), `ManosNativas` (con la cara de
  ManosCamara, para main.js).
- **`vr.js › orientacion`**: con ARCore vivo (una pose de menos de 250 ms), la
  vista es su giro, con el rumbo alineado a donde iba; la cabeza se corre lo que
  se corrieron los ojos (hasta 1,2 m de costado, 1 m abajo y 0,6 arriba). El
  giroscopio queda alineado cada cuadro: si ARCore se pierde, sigue sin saltar.
- **`main.js › laCamara`**: en la APK con ARCore, las manos de Android; si no
  arrancan, se apaga ARCore y van las de la web.

## Medido

- **`pruebas/nativo.mjs`** (Android de mentira), 10/10: 30 cm de costado → la
  cabeza 31 cm; girar 30° → 30,0° y 0,0 cm; ARCore callado → el giroscopio sin
  salto; la mano de Android a 0,4 cm de donde tiene que estar.
- La tanda de manos con la nueva: `manos` 20/20, `manos-celu` 26/26, `nativo`
  10/10, `vr` 19/19, `xr` 10/10, `vr120` 12/12, `manos-directo` 10/10.
- **La APK compila** (Gradle 8.14.3, AGP 8.13.2, compileSdk 36, ARCore 1.56).
  **No se probó en un celu**: acá no hay ni celu ni emulador.

## Trampas

- **El SDK de Android está en el scratchpad** (se borra con la sesión). Para
  rearmarlo: `commandlinetools-linux-16111833_latest.zip` de
  dl.google.com/android/repository, `sdkmanager --licenses`,
  `"platforms;android-36" "build-tools;36.0.0"`, y `ANDROID_HOME` apuntando ahí.
- **SendUserFile no manda más de 30 MiB**: la primera APK (40,7) no salió. Se
  achicó con el MediaPipe de la web afuera (por defecto lo baja del CDN) y las
  `.so` comprimidas (`packaging.jniLibs.useLegacyPackaging`).
- **Maven Central corta con 429** si Gradle le pide mucho junto: primero el
  espejo de Google (`maven-central.storage-download.googleapis.com/maven2`) y
  `--max-workers=2` (`settings.gradle`, `apk.mjs`).
- **El juego armado acorta los nombres de las clases**: en las pruebas no se
  puede mirar `constructor.name` (`ManosNativas` tiene `nativa = true`).
- **La hora de la foto de ARCore** es la del sensor (`elapsedRealtimeNanos` en
  casi todos): si da cualquier cosa (menos de 0 o más de 500 ms), se suponen 30.
- **Falta en el celu**: que ARCore arranque (la primera vez pide instalar
  "Servicios de Google Play para RA"), que la foto de la CPU salga derecha con
  la pantalla acostada al revés (el giro sale de `SENSOR_ORIENTATION`), y lo
  que tarda MediaPipe en la GPU.

# Slime Rancher (APK "v1.2" de espacioapk) — ¿se puede llevar a HTML?

Archivo analizado: `Slime Rancher v1.2 - espacioapk.com.apk` (MediaFire), 382,7 MB,
sha256 `bc7eab70…57e0`. Analizado sin ejecutarlo, con
[`herramientas/unity/analizar-apk.py`](../../herramientas/unity/analizar-apk.py).
El juego es de Monomi Park: acá van sólo las notas, nada del juego (§11 de PORTEO.md).

## Qué es

**No es oficial.** Slime Rancher nunca salió para Android. Este APK es un port hecho
por alguien: los datos de **Slime Rancher 1.2.3 de PC** (la versión figura en el
código) reconstruidos y compilados con **Unity 2018.4.36f1** para Android. Lo firmó
un certificado "Android Debug" creado el **7 de enero de 2023**.

| | medido |
|---|---|
| tamaño | 382,7 MB el APK; 1,05 GB descomprimido |
| procesador | sólo `armeabi-v7a` (32 bits): **no instala en teléfonos sólo de 64 bits** (Pixel 7 en adelante, varios de 2023+) |
| código | **Mono**: el C# está en `Assembly-CSharp.dll` (2.385 tipos, 15.246 métodos) y se puede decompilar entero |
| controles | quien lo porteó agregó **TouchControlsKit** (joystick, botones, touchpad) y `FixedTouchField`; también declara mando |
| escenas | `CompanyLogoScene`, `StandaloneStart`, `MainMenu` y **`worldGenerated`: todo el mundo en una sola escena** |
| mundo | 357.169 objetos, 91.444 GameObjects, 61.202 MeshRenderer, 17.367 MeshCollider, 5.722 LODGroup |
| texturas | 1.704, **492 MB ya comprimidos para GPU de teléfono**: ETC2 326 MB, ETC1 117 MB, sin comprimir 49 MB |
| mallas | 1.445, 3,67 millones de vértices (208 MB) |
| audio | 635 clips, **162,5 min** (45 de más de un minuto: 136 min, la música). En el APK la música va en streaming (Vorbis, 63 MB). **Decodificado entero, como hace WebAudio: 3,0 GB** |

### ¿Trae algo raro?

No se encontró nada. Pide un solo permiso (`INTERNET`). El código Java es sólo el de
Unity (reproductor, FMOD, puente JNI): no tiene publicidad ni rastreadores. Las
únicas direcciones que aparecen en el C# son el foro de Monomi Park, la página de
Steam y el contacto de un proveedor de assets. Es un análisis sin ejecutarlo, no
una garantía.

## ¿Se puede llevar a HTML?

La única forma **fiel** (misma lógica, misma física, mismo mundo) es recompilarlo
con Unity para WebGL:

1. reconstruir el proyecto de Unity desde el APK (AssetRipper; al ser Mono, los
   scripts salen en C#);
2. abrirlo en **Unity 2018.4.36f1** (la misma versión, sin actualizar) y compilar
   para WebGL (IL2CPP → WebAssembly).

Lo que traba o pesa, de mayor a menor:

- **La licencia de Unity.** El editor (869 MB) y el módulo WebGL (225 MB) se bajan
  bien desde acá. Pero Unity no compila sin una licencia activada, y la Personal
  (gratis) se activa con tu cuenta. O lo compilás vos en tu PC con Unity Hub, o
  hace falta una licencia activada.
- **El audio.** Según cómo lo maneja Unity 2018 en WebGL, cada clip que se carga se
  decodifica entero con WebAudio, sin streaming. El mundo es una sola escena con toda
  la música: serían **3,0 GB** de audio y la pestaña se cierra, también en una PC.
  Hay que cambiar el sistema de música para que esos 52 temas suenen con un
  `<audio>` (un plugin de JS). Es código y no se pierde calidad.
- **La memoria en el teléfono.** Unity 2018 en WebGL carga todo el archivo de datos
  en memoria antes de arrancar (acá ~1 GB). Encima va la escena del mundo: mallas,
  colisionadores y 91 mil GameObjects. Una pestaña de un teléfono muere por encima
  de ~1–1,5 GB en iOS y de 1–2 GB en Android, según la RAM. **Así como está, no
  entra.**
- **Las texturas en el navegador del teléfono.** Unity 2018 comprime las texturas
  de WebGL sólo en DXT (formato de PC). Los teléfonos no lo soportan y Unity las
  descomprime a RGBA, que ocupa de 4 a 8 veces más (estimado: 2–3 GB). ETC2/ASTC
  en WebGL llegó con Unity 2021.2: habría que actualizar el proyecto tres versiones
  mayores, que es otro trabajo.
- **El tamaño.** Serían ~380 MB para bajar. **En un solo HTML, imposible** (ningún
  navegador abre un HTML de ese tamaño). Iría como carpeta web o PWA, con caché.

## Veredicto

| destino | ¿se puede? |
|---|---|
| **navegador de PC** | sí, con trabajo: AssetRipper, arreglar el C# decompilado, el plugin de audio, partidas en IndexedDB y sacar Steam/XInput. Días, y la compilación en tu PC |
| **navegador de teléfono** | el juego entero no entra en una pestaña con este Unity. Habría que: (a) partir el mundo en zonas que se carguen por separado (AssetBundles), que es rehacer cómo carga el juego; (b) subir a Unity 2021+ para tener ETC2/ASTC; o (c) una versión "lite" (el rancho) rehecha en Three.js con los modelos, texturas y sonidos originales y la lógica tomada del C# |
| **app de teléfono** | ya es un port de Android. Lo que vale la pena es compilarlo en **arm64**: hoy no instala en los teléfonos sólo de 64 bits. Lleva el mismo proyecto y la misma licencia que WebGL |

Comparado con lo que ya se porteó: FNaF 2, FNaF 4 y PvZ son juegos 2D de 20–35 MB.
Este es un mundo 3D de 1 GB en Unity.

## Plan

1. **Acá, sin licencia:** reconstruir el proyecto y compilar el C# decompilado
   contra las DLL de Unity 2018.4.36f1 (para eso alcanza el compilador, no hace
   falta el editor). Eso dice cuánto trabajo da el código.
2. **Vos, o una licencia activada:** Unity Hub + 2018.4.36f1 + módulo WebGL, abrir
   el proyecto y compilar.
3. Audio por `<audio>`, partidas en IndexedDB, medir memoria en Chrome; y para el
   teléfono, decidir entre zonas, subir de Unity o la versión lite, con los números
   en la mano.

## Reproducir

```bash
python3 -m venv ~/.porteo/unity && ~/.porteo/unity/bin/pip install dnfile UnityPy pyaxmlparser
~/.porteo/unity/bin/python -I herramientas/unity/analizar-apk.py "Slime Rancher v1.2 - espacioapk.com.apk"
```

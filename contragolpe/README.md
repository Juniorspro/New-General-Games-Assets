# CONTRAGOLPE

Tirador táctico por rondas al estilo Counter-Strike, en three.js r128. Tiene tres modos (desactivación 5 contra 5,
combate a muerte y carrera de armas), tres mapas, bots, compra y economía. La luz está horneada, con contornos de
tinta. Hay tres idiomas y los assets son de Rezona. El juego llegó hecho en un solo HTML de 18 MB; acá se separó,
se afinó para teléfonos flojos y se armó la APK.

## Armar

- `node herramientas/armar.mjs` arma `contragolpe.html`: un solo archivo que abre con doble clic, con los assets en
  base64 adentro. No se commitea.
- `node herramientas/armar.mjs --apk` arma la versión de la APK: 1,3 MB de HTML y los assets como archivos.
- `python3 herramientas/etc2.py` comprime las texturas a ETC2 en `.cache/etc2/`. La primera vez baja y compila
  etcpak en `.herramientas/`; hacen falta git, g++ y PIL. `node pruebas/etc2.mjs` compara cada textura con el webp.
- `node herramientas/apk.mjs` arma `pruebas/salida/contragolpe.apk` (22 MB). Necesita el SDK de Android en
  `ANDROID_HOME`, Java 17 o más nuevo y Gradle 8.13 o más nuevo. Firma con la llave de prueba.

## Qué hay

- `fuente/pagina.html` es la página; `fuente/js/NN-*.js` son los módulos en orden (el número es el orden en que
  se cargan). `fuente/assets.json` es el orden de `window.ARCH`, y `js/man.js` es lo medido de cada asset.
- `assets/` tiene lo generado con Rezona: texturas, cielos, arte, calcomanías, sonidos y mapas de luz.
- `android/` es la WebView afinada para jugar (`MainActivity.java`). No lleva librerías nativas.

## Lo que se afinó (medido en `pruebas/`)

- Las armas de los bots van fundidas: una malla por material, armada una vez por tipo. Las llamadas de dibujo
  bajaron de 191 a 127.
- Los huesos van en uniformes. Mandar el dibujo con el procesador 6 veces más lento pasó de 12,0 a 8 ms por cuadro.
- Los muñecos tienen los vértices compartidos: bajaron de 8.766 a 1.627 cada uno. Los muñecos y su sombra
  costaban 23,5 ms en SwiftShader y ahora 15,9.
- El cielo se dibuja después de lo opaco. El revelado se saltea la tinta de lo lejano y la trama de lo claro, con la
  misma imagen: bajó de 22 a 19 ms.
- La APK usa texturas ETC2: la placa pasa de 104 a 23 MB y la memoria de JS de 54 a 25 MB.
- Se cerraron cuatro pérdidas de memoria: cada cambio de arma, la bomba plantada, el cambio de lado y el arma en
  primera persona armaban todo de nuevo. En 8 rondas, las geometrías llegaban a 713; ahora quedan en 181.
- Todas las armas y sus programas se preparan en la carga (`precalentar`), así no hay tirones la primera vez que
  aparece cada una.
- AJUSTES › MANDOS permite mover y agrandar cada botón, cambiar la opacidad, ponerlo para zurdos, elegir la palanca
  fija o flotante y que vibre o no. Se guarda (`js/21b-mandos.js`).

## Pruebas

- `node pruebas/medir.mjs [apk=1]`: qué cuesta un cuadro y la memoria.
- `node pruebas/comparar.mjs <antes.html> [apk]`: si se ve igual. Contra el original da 55 dB; la APK da 37 dB
  por el ETC2.
- `node pruebas/partida.mjs [apk=1]`: una partida larga con piloto automático.
- `node pruebas/mandos.mjs`: el editor de mandos (12/12).

# AEROPLAZA — cuadragésima sexta vuelta (28/09/2026): que las actualizaciones lleguen de verdad

Dijo: "no le llegan las actualizaciones". Antes: [aeroplaza-45](aeroplaza-45.md) (cómo se publica: sigue igual),
[aeroplaza-46](aeroplaza-46.md) (el celu).

## Por qué no llegaban

- La APK 45 buscaba y usaba la versión nueva **solo al arrancar de cero** (`MainActivity › crearWeb`).
- Android casi nunca cierra la app: al abrirla otra vez, sigue la que estaba (`onResume`). Hacían falta **dos arranques
  de cero**: uno para bajarla y otro para usarla. En la práctica, días.
- Ninguna actualización del juego lo podía arreglar: lo que no buscaba era lo de Java. Hizo falta **una APK más (la
  46)**.

## Cómo anda ahora (APK 46)

- **Se busca** al arrancar (4 s después), al volver a la app y cada 20 min, como mucho cada 10 min salvo que se pida
  (`Actualizador.buscarSiToca`; `buscandoAhora` evita dos a la vez).
- **Se usa lo bajado sin cerrar la app** (`MainActivity.usarLoBajado`): lo bajado pasa a ser el que se usa
  (`alAbrir`, con candado contra la bajada), se sueltan ARCore y la cámara, y la WebView vuelve a cargar la misma
  dirección (lo guardado sigue). Pasa en tres casos:
  - al volver a la app después de más de 1 min afuera (no en el VR: `teclasVR`);
  - en el menú, en cuanto termina de bajar (`actualizar.js`, si `!J.enJuego`);
  - en el juego, tocando el aviso "Hay una versión nueva · Tocá acá para usarla ya".
- Puente nuevo: `aplicarActualizacion()`, `buscarActualizacion()`, y `juego()` trae `listo` y `aplicar`. Del lado del
  juego, `Nativo.puedeAplicar` separa la APK 46 de la 45 (a la 45 le queda el aviso de antes).
- El juego guarda al esconderse (`visibilitychange` en `actualizar.js`) y antes de recargar.
- En **Opciones › Datos**: "Versión del juego: 3 · APK 46 · al día" y "🔄 Buscar ahora" (`filaVersion`). Sirve para
  saber qué tiene el celu de quien pide, si vuelve a decir que no le llega.

## La firma de las APK

- Las APK de este contenedor se firman con `~/.android/debug.keystore` (creado el 27/09 a las 06:37). La huella del
  certificado es `8f9f80c5…f8cf6c0`: la 45 y la 46 tienen la misma y se instalan una encima de la otra.
- Un contenedor nuevo crea otra llave: su APK no se instala encima (hay que desinstalar, y se pierde lo guardado). Por
  eso, **mientras se pueda, que las APK nuevas salgan de este mismo contenedor**. La llave no va al repo (es un
  secreto y el repo es público). Para que dure, habría que guardarla como secreto del entorno.

## Pruebas

- `pruebas/actualizar.mjs` (16): suma la APK 46 de mentira. En el menú se usa ya; en el juego, el aviso se toca y la
  usa; en Opciones › Datos aparece la versión y anda "Buscar ahora".
- Lo de Java compila (`apk.mjs`), pero **no se probó en un teléfono**: volver a la app después de 1 min, recargar, y la
  búsqueda cada 20 min.

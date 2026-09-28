# AEROPLAZA — cuadragésima cuarta vuelta (28/09/2026): las actualizaciones llegan a la app

Pidió: "que las actualizaciones lleguen en la app, sin mandarme tantos APK". Antes: [aeroplaza-44](aeroplaza-44.md)
(el mando VR Box), [aeroplaza-27](aeroplaza-27.md) (la APK).

## Cómo se publica una versión (lo que hace cada sesión, en vez de mandar una APK)

1. Cambiar el juego, `node aeroplaza/herramientas/armar.mjs`, probar.
2. Commitear (con `aeroplaza/aeroplaza.html`) y hacer push.
3. `node aeroplaza/herramientas/publicar.mjs --notas "qué cambió"`: escribe `aeroplaza/actualizacion.json`, con `n` + 1
   y el juego fijado a ese commit.
4. Commitear `actualizacion.json` y hacer push a `claude/fijate-iszyer`, la rama que lee la APK.
- La app lo baja al abrirse y lo usa la vez siguiente. No hace falta mandar nada.
- **APK nueva solo si cambió lo de Java** (`android/…`): subir `versionCode` en `android/app/build.gradle`, compilar y
  mandarla. El aviso (`apk.codigo`) hace que el juego ofrezca bajarla.

## Cómo anda (`Actualizador.java`, `Actualizacion.java`)

- **El aviso**: `{ n, fecha, notas, apkMin, apk: { codigo }, html: { url, sha256, bytes }, fuentes }`.
  - Se busca en `raw.githubusercontent.com/…/refs/heads/claude/fijate-iszyer/aeroplaza/actualizacion.json` y en
    `jxstudios.pages.dev/aeroplaza/actualizacion.json`. Gana el `n` más alto.
  - `fuentes` se guarda para la próxima vez: el canal se puede mudar sin APK nueva.
- **`html.url` va fijado a un commit**: lo que se siga subiendo a la rama no cambia lo publicado.
  - La APK verifica los bytes y el sha256; si no coinciden, lo tira.
  - Solo baja de ese repo o de `jxstudios.pages.dev`, por https (`urlPermitida`).
- **Se baja 4 s después de abrir, en otro hilo**, y queda en `files/juego/nuevo.html`.
  - La próxima vez que se abre pasa a `files/juego/aeroplaza.html`.
  - Se sirve en la misma dirección (`https://appassets.androidplatform.net/assets/aeroplaza.html`): el localStorage,
    lo guardado, sigue.
  - Al bajado se le pone el mismo aviso que la APK le pone al suyo (`assets/aviso.txt`).
- **No se baja** si:
  - no es más nuevo que el que corre;
  - es el mismo (`assets/sha.txt`, el sha del juego de la APK sin el aviso);
  - pide una APK más nueva (`apkMin`).
  - Si se instala una APK más nueva que lo bajado (`assets/version.txt`), gana la APK y lo bajado se borra.
- **Las canciones van sueltas en la APK** (`assets/canciones/`, MP3 y `canciones.json`): el juego es el mismo del repo,
  sin canciones. Las pide al arrancar (`main.js › cancionesDeLaApp`, todas a la vez) y suena la que se había pedido.
  La APK `--canciones` quedó en 22,4 MB (antes 23,9: los MP3 ya no van en base64).
- **En el juego** (`actualizar.js`): "AEROPLAZA se actualizó · versión n", una vez por versión; "hay una versión
  nueva" cuando termina de bajar; y la ventana para bajar una APK nueva.
  - Esperan 6 s después de que haya juego, porque un aviso saca al anterior y al empezar está el regalo del día.
- **La primera**: n 1, commit c0d54e8f, 3,11 MB, sha 74380915b9d2. Se comprobó bajándola de GitHub: los mismos bytes y el
  mismo sha.

## Trampas

- **La firma**:
  - La APK se firma con la llave de prueba del contenedor (`~/.android/debug.keystore`).
  - Otra sesión tiene otra llave, y Android no instala una APK encima de otra firmada distinto: hay que desinstalar, y
    se pierde lo guardado.
  - Por eso conviene publicar actualizaciones y mandar APKs lo menos posible.
  - (Sin resolver: haría falta guardar una llave en los secretos del entorno.)
- **La rama**: si una sesión trabaja en otra rama, la APK no ve sus avisos. Hay que publicar en `claude/fijate-iszyer`
  (preguntando) o mudar el canal con `fuentes`.
- **`raw.githubusercontent.com` guarda en caché unos minutos**: el aviso nuevo puede tardar ~5 min en verse.

## Pruebas

- **`actualizar.mjs` 13/13** (en la tanda `--manos`):
  - 6 de Java: de dónde se puede bajar y de dónde no, cuándo conviene, lo bajado entero y el aviso;
  - las 7 canciones sueltas se registran, y la de nombre raro no;
  - los tres avisos.
- **Lo Android de verdad** (bajar y servir) no corre acá: compila en la APK, pero no se probó en un celu.
- Pasaron también vrbox, vr, nativo, cabeza, canciones, flujo, menus, multijugador y manos: 10/10.

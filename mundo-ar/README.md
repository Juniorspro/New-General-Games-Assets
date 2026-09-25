# Mundo AR: prueba de 6DoF en el teléfono

Es el mismo mundo 3D en tres formatos, para comparar cuál sigue mejor al
teléfono. Todos tienen la cámara de fondo, cubos anclados al cuarto para
tocar, una arena sobre el piso, botón de linterna y la pantalla acostada.

| | qué es | 6DoF | pesa |
|---|---|---|---|
| `web/index.html` | una página, para hostear o abrir en cualquier navegador | WebXR (ARCore) en Chrome de Android; si no hay, **SLAM por cámara** (AlvaAR) | 40 KB (+ three y AlvaAR de CDN) |
| `salida/mundo-ar-web.apk` | la misma página dentro de un WebView | SLAM por cámara (el WebView no trae WebXR) | 32 KB |
| `salida/mundo-ar.apk` | app nativa con ARCore | ARCore directo | 320 KB |

## La página

Hosteada en el repo (raw.githack sirve el HTML del repo con el tipo correcto;
`raw.githubusercontent.com` lo manda como texto plano y no abre):

```
https://raw.githack.com/Juniorspro/New-General-Games-Assets/claude/hola-80z86i/mundo-ar/web/index.html
```

Tiene que ir por **https**, porque sin eso el navegador no presta la cámara.
Al abrirla mira qué hay y ofrece los modos, del mejor al peor:

1. **AR nativo (WebXR)**: el 6DoF lo da ARCore y el piso sale de su hit-test.
   Anda en Chrome de Android con ARCore. Acá la linterna no se puede prender,
   porque la cámara la maneja ARCore y WebXR no la expone.
2. **AR por cámara (SLAM)**: el 6DoF se calcula en la página con AlvaAR
   (WebAssembly) y el giróscopo. Es el que anda dentro de un WebView y en
   iPhone. Tiene linterna si el teléfono la ofrece (`torch` en la pista de
   video).
3. **Sólo giróscopo (3DoF)**: girás y el mundo acompaña, pero caminar no lo
   mueve.
4. **Sin cámara**: el mundo solo. En la compu se mira arrastrando.

Cómo se prueba el 6DoF: al enganchar aparecen ocho cubos alrededor tuyo.
Caminá alrededor de uno. **Si se queda quieto en el cuarto, el 6DoF anda.**
Tocá el piso para poner la arena y tocá los cubos para sumar puntos (combo
hasta x5).

El control **Campo de la cámara** de la pantalla de inicio ajusta el ángulo
de visión de la cámara a lo largo (66° de base). Si los cubos "resbalan"
cuando girás, hay que moverlo, porque el SLAM necesita saber el campo real
del lente. **Giróscopo: sí/no** (sólo en modo SLAM) prende o apaga la fusión
con el giróscopo, para comparar.

### Cómo está hecho el SLAM, y lo que se midió

- **El SLAM late a 18 cuadros por segundo** y la cámara 3D se mueve a 60,
  acercándose a la última pose (LERP y SLERP con `1 - e^(-20·dt)`). Así no
  tiembla y el procesador descansa.
- **La imagen que ve el SLAM mide 320 px de lado corto, no 240.** Se probó
  con el video de ejemplo de AlvaAR (un recorrido real por un escritorio):

  | lado corto | engancha | poses buenas |
  |---|---|---|
  | 364 (original) | al 3.er cuadro | 99 % |
  | 320 | 1-2 s | 87-99 % |
  | 288 | 3 s | 84 % |
  | 260 · 240 · 180 | **nunca** | 0 % |

  Por debajo de ~280 px encuentra puntos pero no arranca el mapa. El 320×240
  de la receta original no engancharía.
- **El SLAM ve la imagen entera de la cámara** y la cámara 3D sólo el
  recorte que entra en pantalla. Los dos cuadros tienen el mismo centro
  óptico y salen de la misma focal, así el mundo queda pegado a la imagen.
- **La focal se le pasa a AlvaAR corregida.** Con la imagen acostada, AlvaAR
  calcula el campo horizontal multiplicando el vertical por el aspecto, en
  vez de usar tangentes, y se queda con esa focal. Si se le pasara el campo
  vertical real, la focal saldría un 12 % corta.
- **El giróscopo va girado con la pantalla.** Los sensores hablan en ejes
  del teléfono parado y la imagen está acostada, así que los ejes x e y se
  giran con el ángulo de la pantalla. Además van como mucho 30 muestras por
  cuadro: AlvaAR guarda la IMU en un búfer de 256 números y, si se pasa,
  escribe encima de su propia memoria sin avisar.
- **La escala se mide.** Un SLAM de una sola cámara no sabe de metros. El
  anillo se pone a media distancia de la primera superficie que encuentra y
  la arena mide 0,3 de su distancia (una arena de 30 cm vista a un metro).
- **El piso** es `findPlane()` de AlvaAR, un RANSAC sobre los puntos del
  mapa que a veces sale al segundo intento. Por eso se insiste 1,5 s después
  del toque.
- **Gama baja**: sin antialias, `pixelRatio` 1, sin luces ni sombras (la luz
  de cada cara está "horneada" en el color del vértice, con
  `MeshBasicMaterial`) y menos de mil triángulos.

`./pruebas/correr.sh` corre la página en Chromium con el video de AlvaAR como
cámara falsa, parado (360×640) y acostado (780×360):

| | parado | acostado |
|---|---|---|
| poses buenas en 22 s | 40/44 | 37-40/44 |
| la arena cae sobre el escritorio del video | sí | sí |
| cuadros por segundo del dibujo | 55-60 | 55-60 |
| costo de un paso de SLAM (esta máquina) | 8,6 ms | 9,1 ms |
| errores en la página | 0 | 0 |

También prueba el modo sin cámara (el anillo, tocar tres cubos, poner la
arena), el de giróscopo (abre la cámara), la detección del WebView (recomienda
el SLAM) y que un `requestFullscreen` que nunca contesta no trabe el arranque.

## El APK WebView

`salida/mundo-ar-web.apk` es `web/index.html` metido en un WebView
(`com.juniorspro.mundoarweb`). Lo que hace la app:

- Contesta la página desde sus assets en
  `https://appassets.androidplatform.net/`, el dominio que Android reserva
  para esto. Al ser https, la página tiene cámara, y recargar funciona.
- Pide el permiso de cámara a Android y se lo da al WebView
  (`onPermissionRequest`).
- Deja arrancar el video sin toque previo, se muestra en pantalla completa
  inmersiva y acostada (`sensorLandscape`), y deja la pantalla prendida.
- three y AlvaAR se bajan de su CDN la primera vez y después quedan en la
  caché del WebView.
- La depuración está prendida: con el teléfono enchufado,
  `chrome://inspect` muestra la consola de la página.
- "Atrás" durante el juego vuelve al menú; desde el menú, sale.

## El APK nativo

`salida/mundo-ar.apk` es una app de Android con ARCore directo. El
seguimiento lo hace el sistema, fundiendo cámara, giróscopo y acelerómetro, a
la frecuencia de la cámara y sin gastar JavaScript.

1. Instalalo (hay que permitir "instalar apps de origen desconocido"). Si el
   teléfono no tiene **Servicios de Google Play para RA**, la app ofrece
   instalarlos.
2. Aparecen ocho cubos alrededor tuyo. Apuntá al piso y aparece una grilla
   celeste con los planos que ve ARCore. Tocala para poner la arena; cada
   toque después suma un cubo.
3. Arriba a la izquierda: estado del seguimiento (si falla, dice por qué),
   cuadros por segundo, planos y **la posición en metros: si movés el
   teléfono 1 m, `pos` cambia ~1,0**.
4. **Linterna** usa `Config.FlashMode.TORCH`. Si el teléfono no lo deja, la
   app avisa.

## Cómo se arma

```
./construir.sh             # los dos APK
./construir.sh webview     # sólo salida/mundo-ar-web.apk
./construir.sh nativo      # sólo salida/mundo-ar.apk
./pruebas/correr.sh        # la página en Chromium con cámara falsa
```

No usa Android Studio ni Gradle. La primera vez baja unos 130 MB a
`~/.cache/mundo-ar`, fuera del repo: las build-tools 34, `android.jar` y el
aar de ARCore 1.56 (este último sólo para el nativo). Después arma a mano:
aapt2 → javac → d8 → zipalign → apksigner. La página va al WebView tal cual,
sin ninguna copia en el repo. La llave de firma es de prueba y vive en la
caché. Ni la llave ni los APK se commitean.

Dos trampas que tuvo el armado:

- **javac 21 y el d8 de build-tools 34 no se llevan con las clases
  anónimas**: javac les agrega un atributo `MethodParameters` y d8 se cae
  leyéndolo. Por eso los clientes del WebView son clases anidadas estáticas.
- **`LambdaMetafactory` no está en `android.jar`**. Hay que sumar
  `core-lambda-stubs.jar` al bootclasspath.

## Lo que no se probó

- **En un teléfono.** Esta máquina no tiene uno ni un emulador con cámara.
  Las cifras del SLAM salen de Chromium de escritorio con un video, que no
  tiene giróscopo, así que **la fusión con la IMU no se probó nunca**. Si en
  un teléfono los cubos se van con el modo SLAM, probá **Giróscopo: no**.
- **WebXR**: Chromium de escritorio no lo tiene. El código sigue el ejemplo
  de hit-test de three.
- **El costo del SLAM en gama baja**: acá un paso cuesta ~9 ms. En un
  teléfono barato puede ser 3-4 veces más, o sea 30-40 ms, 18 veces por
  segundo.
- De los APK está comprobado que compilan, que el manifiesto pide lo que
  tiene que pedir, que la firma verifica (v2 y v3) y que la página adentro
  del WebView es idéntica a `web/index.html`.

## Licencias

AlvaAR (github.com/alanross/AlvaAR) es **GPL-3.0**. No está copiado en el
repo ni en los APK: la página lo baja al arrancar del repo de su autor,
fijado a un commit. three.js es MIT y también se baja de su CDN.

## Archivos

| archivo | qué hace |
|---|---|
| `web/index.html` | la página: detección de modos, WebXR, SLAM, giróscopo, el mundo, HUD, linterna |
| `webview/src/.../Principal.java` | el WebView: assets por https, permisos de cámara, pantalla completa acostada |
| `nativo/src/.../Principal.java` | la actividad nativa: permisos, instalar ARCore, sesión, toques, linterna, HUD |
| `nativo/src/.../Mundo.java` | el anillo, la arena, los blancos y el rayo del toque |
| `nativo/src/.../Fondo.java` · `Cubo.java` · `Planos.java` | la imagen de la cámara, el cubo con luz horneada, la grilla de planos |
| `construir.sh` | arma los APK sin Gradle |
| `pruebas/web.mjs` · `correr.sh` | la página en Chromium con cámara falsa |

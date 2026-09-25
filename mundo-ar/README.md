# Mundo AR — prueba de 6DoF nativo con ARCore

Una app de Android chiquita (320 KB) para comprobar si el seguimiento en seis
grados de libertad de **ARCore** anda en un teléfono: cámara de fondo, un
mundo 3D anclado al cuarto, cubos para tocar, botón de linterna, pantalla
acostada.

## Cómo se prueba

1. Instalá `salida/mundo-ar.apk` (hay que permitir "instalar apps de origen
   desconocido"). Si el teléfono no tiene **Servicios de Google Play para RA**
   (ARCore), la app ofrece instalarlos.
2. Aceptá el permiso de cámara y mové el teléfono despacio.
3. **Apenas arranca** aparecen ocho cubos flotando alrededor tuyo (dorados y
   violetas). Caminá alrededor de uno, agachate, acercate: **si el 6DoF anda,
   se quedan quietos en el cuarto.** Si "nadan" con el teléfono, no anda.
4. Apuntá al piso: aparece una grilla celeste (los planos que ve ARCore).
   Tocala y aparece la arena: una plataforma con pilares, un tótem que gira y
   cubos encima. Cada toque en el piso después suma otro cubo.
5. Tocá los cubos: +10 puntos, con combo hasta x5 si vas rápido.

Arriba a la izquierda: puntos, estado del seguimiento (si falla dice por qué:
poca luz, mucho movimiento, superficie sin textura), cuadros por segundo,
cantidad de planos y la posición de la cámara en metros. **Si movés el
teléfono 1 m hacia adelante, `pos` tiene que cambiar ~1,0.** Es la prueba
más directa del 6DoF.

**LINTERNA** prende el flash con la cámara de ARCore andando
(`Config.FlashMode.TORCH`). Hay teléfonos que no lo dejan: la app lo avisa.

## Por qué nativo y no una página

El WebView de Android no trae WebXR: una página adentro de una app no puede
pedirle poses a ARCore, y un SLAM en JavaScript (AlvaAR) consume CPU que en
gama baja no sobra. Con ARCore directo el seguimiento lo hace el sistema.

Igual se respeta lo de gama baja: sin antialias, sin luces dinámicas ni
sombras (la luz está "horneada" en el shader con una dirección fija), unos
cientos de triángulos en total, y la imagen de la cámara la dibuja ARCore en
una textura sin copias.

## Cómo se arma

```
./construir.sh       # → salida/mundo-ar.apk
```

Sin Android Studio ni Gradle: baja una vez (~130 MB, a `~/.cache/mundo-ar`,
fuera del repo) las build-tools 34, `android.jar` y el aar de ARCore 1.56, y
arma el APK a mano: aapt2 → javac → d8 → zipalign → apksigner. La llave de
firma es de prueba y vive en la caché, nunca en el repo. El APK tampoco se
commitea.

## Lo que no se probó

**En un teléfono.** Esta máquina no tiene emulador con ARCore. Está
comprobado que compila, que el dex tiene las 220 clases (las de la app, las
de ARCore y su `R`), que el manifiesto pide cámara, ARCore y pantalla
acostada, y que la firma verifica (v2 y v3). Si algo falla al abrirlo, el
mensaje de abajo en pantalla dice qué (ARCore faltante, cámara ocupada,
teléfono no compatible).

## Archivos

| archivo | qué hace |
|---|---|
| `src/.../Principal.java` | la actividad: permisos, instalar ARCore, sesión, toques, linterna, HUD |
| `src/.../Mundo.java` | el anillo, la arena, los blancos y el rayo del toque |
| `src/.../Fondo.java` | la imagen de la cámara (textura externa de ARCore) |
| `src/.../Cubo.java` | el cubo con luz horneada |
| `src/.../Planos.java` | la grilla de los planos detectados |
| `construir.sh` | arma el APK sin Gradle |

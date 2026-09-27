# Mando 360 IR — control remoto de la Xbox 360 por infrarrojo

Una app de Android que usa el **emisor infrarrojo** del teléfono para manejar
la Xbox 360, como el control remoto multimedia oficial. Tu propio SmartGlass
por IR, a tu gusto.

```
./construir.sh      → salida/mando-360.apk   (~20 KB)
```

## Qué maneja y qué NO

El receptor infrarrojo de la 360 es el canal de **menús y multimedia**, y es
lo que usa esta app:

- moverse por el tablero (cruceta + OK), Atrás;
- A / B / X / Y **de los menús**;
- el botón de **Xbox (guía)**, encender;
- reproducir / pausa / detener / adelantar / retroceder / info.

**No sirve para jugar** (mover un personaje, apuntar, disparar). Eso no viaja
por infrarrojo: viaja por la radio propia de los joysticks inalámbricos, que
un teléfono no tiene, y por USB con una autenticación que esta app **no**
toca. Es un límite del canal IR, no de la app. Si ya probaste ZaZa Remote y
te movía los menús con ABXY, esto hace lo mismo, hecho por nosotros.

## Cómo funciona

La 360 responde al protocolo **RC6 modo 6A** (el de Media Center y del control
remoto de Xbox): 36 bits por botón, portadora de 36 kHz, un "bit de rastreo"
que se invierte en cada pulsación para que el receptor no ignore la
repetición. La app arma la señal en microsegundos y la manda con
`ConsumerIrManager.transmit`.

Los códigos de cada botón son datos públicos de las bases de IR (los mismos
que usan los controles universales). No hay nada de la seguridad de los
joysticks (XSM3) acá: es otro canal.

## Lo medido

`node pruebas/rc6.test.mjs` codifica cada botón a señal y la vuelve a
decodificar: si da el mismo número, la trama es una RC6 6A válida con los bits
correctos. **18/18 botones** dan la vuelta completa, la cabecera mide 6t/2t, y
el bit de rastreo cambia el valor enviado. El mismo codificador en Java
(`Rc6.java`) da idéntico resultado.

## Lo que NO se probó

- **Contra una consola de verdad.** Esta máquina no tiene una 360 ni un
  emisor infrarrojo. Está comprobado que el protocolo es correcto (ida y
  vuelta), que el APK compila y firma, y que declara el emisor IR. La primera
  prueba con la consola la hacés vos.
- Si algún botón no responde, casi seguro es que ese código difiere en tu
  región o modelo; se ajusta en `Rc6.java` (y en `pruebas/rc6.mjs`).

## Cómo se usa

1. Instalá `salida/mando-360.apk` (permitir orígenes desconocidos).
2. Abrí la app y **apuntá el teléfono al frente de la consola** (donde está el
   ojo del receptor, cerca del botón de encendido).
3. Tocá los botones. Si el teléfono no tiene emisor infrarrojo, la app lo
   avisa y no puede mandar nada.

## Cómo se arma

Sin Android Studio ni Gradle: baja una vez las build-tools 34 y `android.jar`
a `~/.cache/mundo-ar` (la misma caché que mundo-ar), y arma a mano
(aapt2 → javac → d8 → zipalign → apksigner). La llave de firma es de prueba y
vive en la caché, nunca en el repo. El APK tampoco se commitea.

## Archivos

| archivo | qué hace |
|---|---|
| `src/.../Rc6.java` | el protocolo RC6 6A y los códigos de cada botón |
| `src/.../Principal.java` | la app: la botonera táctil, vibración, el envío por IR |
| `pruebas/rc6.mjs` · `rc6.test.mjs` | el codificador de referencia y su prueba de ida y vuelta |
| `construir.sh` | arma el APK sin Gradle |

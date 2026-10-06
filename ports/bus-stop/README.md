# Bus Stop Simulator · port a Android

Port de *Bus Stop Simulator BETA 1.0.1*, un juego de **Sixten Kastalje** (@SixtenKastalje) y **Magnus
Jungersen** (@Sodakurt) publicado en GameJolt, hecho en Unity 4.5 y nunca terminado. El juego se rearma en
three.js desde sus propios archivos (la escena, los modelos, las texturas, los sonidos y la lógica de sus
scripts) y va en una APK con controles táctiles y 3 idiomas.

**Acá no hay nada del juego original**: ni el descargado, ni lo exportado, ni la APK. Todo eso es de sus
autores y sale de su zip cada vez (`.gitignore`).

## Armarlo

```
# 1. el juego original, en juego/ (Bus_Stop_Simulator_BETA_1.0.1.zip, de MediaFire / GameJolt)
# 2. exportar (un venv con UnityPy y dnfile; ffmpeg para los audios)
python -I herramientas/exportar.py "juego/Bus Stop Simulator BETA 1.0.1_Data" web/datos
#    (opcional) web/datos/tv.json: los textos de las teles en es/en/pt; sin él van los del original
# 3. armar y probar
node herramientas/armar.mjs            # → dist/ (index.html, juego.js, datos/)
node pruebas/recorrido.mjs             # el juego entero sin manos: tiene que dar "Todo bien"
node pruebas/pantallas.mjs             # idiomas, ajustes, editor de controles, atrás
# 4. la APK (firma de prueba, ~/.android/debug.keystore)
ANDROID_HOME=/ruta/al/sdk node herramientas/apk.mjs   # → pruebas/salida/bus-stop-simulator.apk
```

`herramientas/il.py` desensambla el `Assembly-CSharp.dll` (para leer la lógica de los scripts).

## Cómo se juega

Juntá las 10 mallas glitcheadas del colectivo que quedaron tiradas por la escena; cuidado con los KutteFucker:
si te acercás a menos de 10 m, te atacan. Con las 10, llega el colectivo: sentate y apretá E.

- Teléfono: joystick a la izquierda, el resto de la pantalla para mirar; CORRER, SALTAR, LINTERNA, E y pausa.
  Los botones se mueven, se agrandan y se hacen transparentes en CONTROLES.
- Compu: WASD o flechas, Shift corre, Espacio salta, F linterna, E agarra, Esc pausa; el mouse mira.

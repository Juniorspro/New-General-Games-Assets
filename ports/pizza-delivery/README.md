# Pizza Delivery v0.2 · port a Android

Port de *Pizza Delivery v0.2 – Interactive Fiction* (junio de 2013), de **Shahabaz Khan** (Shahabaz Khan
Productions), inspirado en la película tamil "Pizza", hecho en Unity 3.5. Se rearma en three.js desde sus
propios archivos: las seis escenas, los modelos y personajes con huesos, las animaciones, los sonidos, las
letras y la lógica de sus scripts (UnityScript); va en una APK con controles táctiles y 3 idiomas.

**Acá no hay nada del juego original**: ni el descargado, ni lo exportado (tampoco sus diálogos ni las
traducciones), ni la APK. Todo eso es de sus autores y sale de su archivo cada vez (`.gitignore`).

## Armarlo

```
# 1. el juego original en juego/ (pizza-delivery-v2.rar; RAR5: se abre con libarchive)
# 2. exportar (un venv con UnityPy, dnfile y pypdf; ffmpeg para audio y video)
D="juego/pizza-delivery-v2/PizzaDeliveryV0.2Win86/PizzaDelivery_Data"
python -I herramientas/exportar.py "$D" web/datos      # escenas, mallas, texturas, audio, prefabs (~5 min)
python -I herramientas/extras.py "$D" web/datos        # las letras y el video de la tele
python -I herramientas/textos.py "$D/Managed/Assembly-UnityScript.dll" web/datos/textos.json   # los diálogos
cp traduccion/subtitulos.json web/datos/               # (opcional) diálogos y textos en es/pt
# 3. armar y probar
node herramientas/armar.mjs           # → dist/
node pruebas/recorrido.mjs            # la historia de la casa entera, disparador por disparador
node pruebas/recorrido2.mjs           # morir, el bosque, la casa de muñecas, el final y el menú
node pruebas/pantallas.mjs            # idiomas, ajustes, editor de controles, atrás
# 4. la APK (firma de prueba)
ANDROID_HOME=/ruta/al/sdk node herramientas/apk.mjs   # → pruebas/salida/pizza-delivery.apk
```

`herramientas/campos.py` lee los campos guardados de cada script con los tipos de sus DLL;
`herramientas/il.py` desensambla el IL para leer la lógica.

## Cómo se juega

Sos el pibe del delivery y te queda la última casa. Entregá la pizza, cobrá y andate… La interacción es
automática: las cosas pasan al tocarlas.

- Teléfono: joystick a la izquierda, el resto de la pantalla para mirar, pausa arriba (se acomodan en CONTROLES).
- Compu: WASD o flechas y el mouse, como el original. Esc: pausa.

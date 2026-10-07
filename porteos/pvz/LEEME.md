# Plantas vs. Zombies (PC, 2009) → móvil

El juego de PopCap corre **con su lógica original y los datos del dueño** en el
navegador y en un APK. No se rehízo nada a mano: el motor es
[PvZ-Portable](https://github.com/wszqkzqk/PvZ-Portable) (reimplementación libre en
C++ con SDL2 + OpenGL ES 2, LGPL-3.0) compilado a WebAssembly, con un parche
nuestro para la versión que llegó.

| archivo | qué es |
|---|---|
| `portear.sh` | del `.rar` (o la carpeta con `main.pak`) a la entrega completa: web, APK, zip |
| `pvz-portable-1051.patch` | lo que se le cambia al motor (ver abajo) |
| `index.html` | la carcasa web: carga con progreso, partidas en IndexedDB, sonido en segundo plano, atrás, teclado del teléfono |
| `prueba.mjs` | la lista de PORTEO.md §9, con dedos de verdad (CDP) y midiendo el estado del juego |
| `recorrido.mjs` | con la variante de depuración: 31 niveles y minijuegos, cada uno hasta que se juega, sin errores ni recursos faltantes |
| `bailarin.mjs` | con la variante de depuración: el bailarín de 2009 en el 2-8, con coristas, brazos y cabezas |

```bash
porteos/pvz/portear.sh "plantas y zombies.rar" entrega-pvz [--un-archivo] [--depuracion]
python3 -m http.server 8831 --directory entrega-pvz/pvz &
node porteos/pvz/prueba.mjs http://127.0.0.1:8831/
# con --depuracion (el motor con los atajos de PopCap; no se entrega):
python3 -m http.server 8832 --directory entrega-pvz/pvz-depuracion &
node porteos/pvz/recorrido.mjs http://127.0.0.1:8832/
node porteos/pvz/bailarin.mjs http://127.0.0.1:8832/
```

## Por qué hizo falta un parche

PvZ-Portable está hecho para la **GOTY** (1.2.0.1073). Lo que llegó es el
**original de 2009** (`PlantsVsZombies.exe` 1.0.0.1051), y con esos datos el motor
se cerraba al arrancar. Las diferencias se midieron cruzando lo que pide el código
(`Resources.cpp`, la tabla de animaciones) con lo que trae el `main.pak`:

1. **Las animaciones vienen sólo compiladas.** El pak de 2009 no tiene los XML de
   `reanim/` ni de `particles/`: trae `compiled/*.compiled`, volcados de memoria de
   32 bits. El motor sólo leía compilados de su propio caché. En WebAssembly
   (32 bits) el formato es el mismo: el hash del esquema que guarda cada archivo
   (`0xb393b4c0` en los reanim) coincide con el que calcula el motor, así que se
   leen directo del pak (`Definition.cpp`).
2. **El bailarín es el de 2009.** PopCap cambió al Dancing Zombie en la GOTY
   ("disco"); el original es `Zombie_Jackson` (y sus coristas, `Zombie_dancer`),
   con otros nombres de pista y de imagen. Se traduce el archivo en la tabla de
   animaciones, las 4 pistas del brazo y las 4 imágenes del brazo caído
   (`Reanimator.cpp`, `Resources.cpp`).
3. **No hay logros, Zombatar ni "más formas de jugar"** (256 recursos que sumó la
   GOTY). No se inventa arte: con los datos de 2009 esas pantallas no existen, como
   en el juego original. El pedestal de logros y el cartel del Zombatar no aparecen
   en el menú, y los logros se anotan en silencio (sin cartel a mitad de partida).
   La pantalla de logros además se dibujaba fuera de cuadro: con la imagen vacía
   eran 15 700 llamadas por cuadro y colgaba el menú.
4. **`porteo_estado()`**: una función que devuelve el estado del juego en JSON
   (pantalla, sol, plantas, zombis, soles en el piso, diálogos, memoria) para que
   las pruebas midan lo que pasa en vez de mirar que no haya errores.
5. **Modo de poca memoria en la web.** El motor ya lo tenía para consolas
   (`LOW_MEMORY`: sonidos bajo demanda, sin la copia en RAM de las texturas ya
   subidas, el pak leído del archivo). Medido: 264 → 206 MB de memoria del módulo y
   "click to start" 0,8 s antes, con los mismos cuadros por segundo; el recorrido
   completo pasa igual. El parche lo prende siempre para la web.

Con datos GOTY, los puntos 1 a 3 no cambian nada: dependen de `gDatosOriginales`,
que se prende sólo si el `resources.xml` no declara el grupo del Zombatar.

## Lo que se verificó con el bailarín

Con una compilación de depuración (no se entrega: `-DPVZ_DEBUG=ON` y `-cheat`), en
el 2-8: entra caminando para atrás, señala, llama a sus cuatro coristas con el
reflector, bailan en formación, y con lanzaguisantes pierden brazo y cabeza. Sin
un solo "Can't find track" en el registro y sin asserts.

## Licencias

- El motor es LGPL-3.0: el parche (LGPL también) está acá y el código de base en el
  commit fijado de `portear.sh`. Quien reciba el APK puede rearmarlo con otro motor.
- Los datos (imágenes, sonidos, música, textos) son de PopCap/EA y salen del juego
  del dueño. **No entran al repo** (§11 de PORTEO.md).

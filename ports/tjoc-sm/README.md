# The Joy of Creation: Story Mode · port a Android

Port no oficial, para uso personal, de *The Joy of Creation: Story Mode* (2017), de **Nikson**, hecho en
Unreal Engine 4.16. *Five Nights at Freddy's* y sus personajes son de **Scott Cawthon**. No se rearma a mano:
un motor web propio (three.js) lee los niveles, las clases y el código Blueprint del juego tal como vienen en
su `.pak` y los ejecuta. Va en una APK con controles táctiles y 3 idiomas (es, en, pt).

**Acá no hay nada del juego original**: ni el `.pak`, ni lo exportado (mapas, mallas, texturas, sonidos,
textos, imágenes traducidas), ni la APK. Todo eso es de sus autores y sale de su archivo cada vez
(`.gitignore`).

## Cómo funciona

- `herr/ue` (C#, CUE4Parse): saca del `.pak` los paquetes en JSON, mallas, texturas, sonidos y animaciones.
  Las versiones cambian por tipo: mapas y Blueprints con UE 4.17, mallas con 4.17 (4.18 si falla),
  animaciones con 4.16 (`UEVER`).
- `herr/kismet.py`, `clases.py`: el bytecode Kismet de cada Blueprint a un código compacto por clase
  (variables, valores por defecto, funciones, timelines, widgets, animaciones de UMG).
- `herr/nivel.py`, `escenas.py`, `materiales.py`, `lightmaps.py`: cada nivel (actores, componentes,
  colisión, luces, Matinee, secuencias, lightmaps de 4.16, BSP).
- `herr/paquete.py` + `herr/optimizar.mjs`: todo junto en `web/datos` (webp, opus, mallas cuantizadas y
  simplificadas con meshoptimizer).
- `web/js/vm.js`: la máquina virtual de Kismet (pila de flujo, acciones latentes, contexto, parámetros de
  salida). `web/js/nat/*`: lo nativo de UE que usa el juego (actores, componentes, cámara, entrada, trazas,
  audio con SoundCues, animación, Matinee, timelines, UMG como DOM, LevelSequence, guardado).
- `web/js/post.js`: exposición automática como el histograma de 4.16, ACES, viñeta, grano y los efectos del
  juego (Chameleon) solo cuando están prendidos.

## Armarlo

```
# 1. el juego en juego/ y paks → su carpeta Content/Paks; .NET 10 en ../dotnet
dotnet publish herr/ue -c Release -o herr/ue/bin
# 2. exportar y empaquetar los niveles del capítulo 1
python3 -I herr/paquete.py SM_Warning SMMenu SM_Cutscene01 SM_NarrationsBM02 SM_Bedroom_Controls SM_Bedroom SM_Bedroom_DeathTips
node herr/optimizar.mjs web/datos
# 3. traducciones (traduccion/, fuera del repo): textos y las imágenes con texto (después de paquete.py)
python3 -I traduccion/textos.py web/datos/textos.json
python3 -I traduccion/tips.py
# 4. armar, probar y la APK
node armar.mjs                        # → dist/
node recorrido.mjs                    # aviso → menú → prólogo → narración → controles → dormitorio, en español
N=SM_Bedroom SEG=75 PASOS='[[1,"eval","__tjoc.J.acelerar=7"]]' node correr.mjs   # una noche a 8x
python3 -I herr/icono.py && node apk.mjs   # → salida/tjoc-sm.apk
```

# Ritmo — un juego de ritmo sin un solo archivo de audio

Tres carriles. Cae una nota, tocás su carril justo cuando toca la línea. Nueve
canciones, tres idiomas, vertical, un pulgar.

**No hay ni un mp3.** La música la escribe `compositor.js` y la toca un
sintetizador de osciladores. Por eso el juego entero pesa **85 KB** y suena
igual sin internet.

## Lo medido

Todo sale de `./pruebas/correr.sh`.

| | |
|---|---|
| pruebas | **137/137** en 8 archivos |
| cartas validadas por máquina | **9/9** |
| notas en total | **950** |
| densidad, de la 1 a la 9 | **1,01 → 2,90** notas por segundo, subiendo siempre |
| lo más juntas que quedan dos notas del mismo carril | **121 ms** (el piso es 115) |
| espera hasta la primera nota | **3,4 a 5,2 s** |
| desvío del reloj con el hilo trabado 700 ms | **−0,5 ms** |
| cuadros jugando la canción más densa | **60,0 · 59,8 · 59,2** por segundo (teléfono chico, grande, tablet) |
| costo de dibujar un cuadro | **4,2 · 6,8 · 9,5 ms** |
| archivo único | **85 KB**, 0 binarios |

## La carta no se deduce de la música: ES la música

Un juego de ritmo hecho sobre un mp3 tiene que **adivinar** dónde están los
golpes, y adivina mal. Acá la melodía la escribe el compositor, y las notas que
tocás son literalmente los mismos objetos que el sintetizador convierte en
sonido. No hay detección de nada, y no puede haber desfase entre lo que suena y
lo que hay que tocar.

El compositor no toca audio ni DOM a propósito: son funciones puras. Por eso las
nueve cartas se revisan **en Node, sin navegador y sin parlantes**, en
milisegundos.

## Qué revisa el validador

Son reglas de dedos, no de gusto:

- Dos notas del **mismo carril** nunca a menos de **115 ms**. Levantar y volver a
  apoyar el pulgar sobre el mismo punto lleva ese tiempo; más juntas no son
  difíciles, son imposibles, y se siente como que el juego no te lee.
- Dos notas cualesquiera, nunca a menos de 55 ms.
- Nunca más de dos al mismo tiempo: hay dos pulgares.
- Los **tres carriles** se usan.
- Ninguna nota fuera de la canción, ninguna de largo negativo.
- Y una que no es de dedos: **cada canción tiene que ser más densa que la
  anterior**. Nueve canciones numeradas que no se ponen más difíciles no son
  nueve niveles.

Cuando una nota no entra, **se corre el carril y no la nota**: el carril sale de
la altura del sonido, así que moverlo al vecino no cambia nada de lo que se
escucha. En las nueve canciones eso pasó 46 veces sobre 950 notas.

## El reloj es el del audio

`requestAnimationFrame` late lo que tarda el cuadro, y eso se mueve. Un reloj
contado con rAF se corre varios milisegundos por segundo en un teléfono que baja
a 40 cuadros, y a los treinta segundos la canción y las notas ya no coinciden:
se siente como que el juego "no toma" los toques. Acá la hora la lleva
`AudioContext.currentTime`, que va por hardware. rAF **sólo dibuja**.

Medido: se traba el hilo de JavaScript 700 ms a propósito, y la canción avanza
700 ms. Diferencia: **−0,5 ms**. Las notas que pasaron durante la traba cuentan
como error, que es lo honesto, en vez de desaparecer.

Y todo se agenda con 200 ms de anticipo. Un sonido disparado en el cuadro en que
toca llega tarde y desparejo; agendado con su hora exacta, el audio lo larga solo
aunque el dibujo se trabe.

## La calibración, y por qué hace falta

Entre que el navegador dice que un sonido salió y el oído lo recibe hay un camino
que nadie informa: **los auriculares Bluetooth agregan entre 100 y 300 ms** y
`outputLatency` no los ve. Sin corregirlo, el juego se siente roto y la culpa
parece del jugador. En Ajustes hay un metrónomo: tocás doce veces y se guarda la
**mediana** de tu desvío — mediana y no promedio, porque uno que se distrae y
toca medio segundo tarde corre el promedio entero.

## Dos cosas que encontraron las pruebas

**Un `undefined` que dependía del azar.** El perfil más difícil pedía el ritmo
número 8 de una lista de ocho (índices 0 a 7). No reventaba siempre: sólo cuando
el sorteo sacaba justo ese número, así que la canción 9 anduvo hasta que un
cambio en otra parte corrió la secuencia del generador. Ahora `hasta` es el
último índice permitido y además va con tope.

**Una línea que no hacía falta que funcionara se llevaba puesta la nota
entera.** `setPointerCapture` estaba antes de registrar el toque y tira excepción
si el puntero ya no está activo: la nota no se contaba y se marcaba como error.
Se veía exactamente como un juego que no responde.

## Y una que encontró el instrumento mintiendo

La primera medición de rendimiento decía **21 ms por cuadro en una tablet**
mientras el juego corría a 60 sostenidos. El número salía de llamar a `dibujar()`
noventa veces seguidas con un `getImageData` en cada vuelta: la lectura obliga a
rasterizar —que es lo único que hace que el número signifique algo— pero
encadenadas así frenan la cañería y el navegador no puede solapar nada. **Lo que
no miente es contar cuadros contra el reloj de pared mientras se juega**, y eso
es lo que exige la prueba ahora.

Con el instrumento arreglado sí apareció trabajo de verdad para sacar: el fondo
fijo se pintaba en el lienzo sesenta veces por segundo (3,1 millones de píxeles
por cuadro para que quedara igual) y el halo del pulso rellenaba la pantalla
entera. El fondo pasó al CSS, el halo pinta sólo donde llega, y en pantallas muy
grandes la resolución interna tiene tope. Resultado medido: el costo del cuadro
bajó de 22,3 a **9,5 ms** en la tablet y de 7,1 a **4,2 ms** en el teléfono
chico, y los cuadros subieron de 54,8 a **59,2** por segundo.

## Cómo se corre

```
python3 empaquetar.py      # arma ritmo-en-un-archivo.html
./pruebas/correr.sh        # las 137 pruebas
```

Para jugarlo mientras se trabaja hace falta un servidor (`python3 -m http.server`),
porque `file://` bloquea los módulos ES. El archivo único no lo necesita: se abre
con doble clic.

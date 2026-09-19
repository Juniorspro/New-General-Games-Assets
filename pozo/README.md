# POZO — lo que se le hizo

El juego llegó ya hecho y andando. Esto es lo que se cambió, con los números
que lo respaldan. Todo se mide con el analizador colgado del maestro de audio o
con el navegador de verdad, nunca a ojo.

## 1. La música: de 8 segundos a 35-38

El juego **ya tenía** sistema de música completo —tabla de muestras, cruce
entre pistas, buses medidos por pantalla— y las tres pistas sonaban. El
problema era otro: **duraban ocho segundos** y se repetían en bucle.

    m_menu    7,70 s  ->  38,03 s
    m_pelea   7,85 s  ->  35,24 s
    m_jefe    7,96 s  ->  37,38 s

El generador corta en ~10 s por más que se le pidan 30 (medido: 8,78 a 10,29 s
en los nueve pedidos). Así que cada pista se arma encadenando tres segmentos
distintos en orden **A-B-A-C**: con el mismo material, el oído tarda el
cuádruple en volver a oír lo mismo. Las juntas van con cruce de igual potencia
de 400 ms —pegadas de punta dan un chasquido— y la cola se funde sobre la
cabeza 700 ms para que el bucle cierre sin golpe.

`armar_pistas.py` hace eso. `igualar.py` y `hornear.py` completan el camino.

## 2. El volumen: lo que casi arruina la mezcla

Las pistas nuevas salieron del generador **masterizadas mucho más fuerte** que
las que había: en RMS sobre el bucle entero, menú ×4,5, jefe ×6,4 y pelea ×8,5.
Puestas tal cual, el disparo quedaba en **0,73× la música** — o sea la música
tapaba los tiros.

Se arregló **igualando la pista** al volumen de la que reemplaza, no bajando el
bus. Bajar el bus obliga a volver a medir la relación de la música con los
diecisiete efectos y con las dos pantallas; igualando la pista, todas las
constantes medidas por el autor siguen valiendo sin tocar una línea.

    disparo contra música:  0,73x  ->  7,54x
    (la regla del propio archivo pide al menos 2x)

## 3. La placa de los botones: un defecto que ya estaba

El horneado devuelve las placas centradas en un lienzo más ancho que ellas: la
dorada ocupaba el **50 %** del ancho y la común el **44 %**, medido sobre el
alfa. Como el CSS estira con `background-size:100% 100%`, lo que se estiraba
era el lienzo, así que la placa visible quedaba a media anchura del botón y el
texto se salía por los dos lados.

Ahora se recorta el transparente al vestir el menú. El número sale del alfa, no
de una tabla, así que vale también para la placa que se hornee mañana. Y la
proporción del cartel del título salía de un `.28` escrito a mano —la del
lienzo entero—; ahora sale del arte recortado (0,5339), que es justo lo que el
comentario de al lado advertía que no había que desincronizar.

## 4. El menú, animado

Todo en CSS y ninguna línea de JS: detrás del menú corre la demo, que es el
juego de verdad con el auto-jugador, y una animación hecha a mano en el bucle
le sacaría cuadro. Entrada escalonada de cada pieza, título que respira, brillo
que cruza el botón principal, polvo cayendo en dos capas (dos gradientes
repetidos, cero nodos) y un golpe para el cartel de fin de partida.

Dos cosas que salieron de probarlo y no de escribirlo:

- **El latido del botón es luz, no tamaño.** Con `transform:scale` el botón no
  se queda quieto nunca, y un blanco que se mueve bajo el pulgar se falla. De
  paso, un elemento en movimiento perpetuo es inclickeable para cualquier
  automatismo, o sea que el juego dejaba de ser comprobable.
- **El polvo va detrás con `z-index` negativo.** La primera versión apilaba
  poniendo `position:relative` en los hijos y eso le pisaba el `position:
  absolute` al pie, que se despegaba del fondo y aparecía pegado a los botones.

Y quien pide menos movimiento recibe menos movimiento: con
`prefers-reduced-motion` no queda **nada** animándose solo (comprobado, no
declarado).

## 5. El velo, re-medido

El velo del menú se cierra sobre la franja de texto y se abre arriba y abajo.
Sus cortes estaban medidos contra el título viejo; al destaparse el cartel el
título pasó a medir 141 px y a ir de 33,5 % a 49,3 %, así que la banda cerrada
pasó de 33-68 a 32-68,5. **Hay que volver a medirlo** si cambia el cartel o se
agrega una línea.

## Los controles: de 6 px de aire a 24

Los botones de acción se **tocaban**. Medido antes de cambiar nada, el par más
cerca (FUEGO y ESQ) tenía **6 px** entre borde y borde en vertical, y en
apaisado el joystick y FUEGO estaban a **0** — el mismo blanco para el pulgar.

La causa no era el espaciado: era **dónde vivían**. El marco mantiene la
proporción de teléfono (412:892) y se achica para entrar en la pantalla, así
que en apaisado queda de **175 px de ancho**. Adentro de esa franja no entran
un joystick de 132 y un botón de 104, y punto.

Ahora los controles se anclan a la **pantalla**, no al marco: en apaisado se van
a las bandas negras de los costados —que es donde está la mano— y en vertical
quedan igual que siempre, porque ahí el marco ocupa todo el ancho. La columna de
la derecha se apila hacia arriba en vez de abrirse en abanico: con 360 px de
ancho, un joystick más tres botones al costado piden 368 y no hay.

Y son botones dibujados, no círculos con texto: un aro de color por acción, el
símbolo en SVG (una mira para FUEGO, un cuerpo saliendo de costado para ESQ, una
mano para USAR) y la palabra abajo. El símbolo es el que se mira de reojo
jugando; la palabra es para la primera vez.

Medido después, en los tres formatos: **24 px de aire** entre los dos controles
más cercanos, y ninguno por debajo de los 44 px de blanco tocable.

### Dos cosas que aparecieron al medir

- **La pausa estaba en la columna del pulgar**, a 178 px del borde de abajo.
  Apretarla sin querer en el medio de una pelea es perder la partida por un
  botón que se usa una vez cada diez minutos. Se fue arriba, y en apaisado a la
  banda negra, porque arriba al medio es justo donde el HUD se amontona cuando
  el marco se angosta.
- **El HUD se pisaba a sí mismo en apaisado**: siete corazones de 17 px ya
  ocupan 140 de los 175 que mide el marco, y del otro lado va el piso, el arma
  y las monedas. En ese formato los corazones pasan a 11 px y los dos bloques
  entran con aire.

### Un bug que se veía como un icono mal hecho

`$('#bUsa').textContent = T('usar')` reemplaza **todo** el contenido del botón,
icono incluido. Como los otros dos botones no se traducían, sus íconos sí se
veían: el síntoma era "el de USAR quedó feo", no "le borré el dibujo". Ahora la
palabra se escribe en el `<span>` y de paso los tres botones se traducen, que
estaban en castellano fijo adentro de un juego que habla tres idiomas.

## Cómo se comprueba

    node pruebas/probar_pozo.mjs $PWD/pozo.html   # 7/7  audio y mezcla
    node pruebas/anim.mjs        $PWD/pozo.html   # 5/5  animaciones del menú
    node pruebas/controles.mjs   $PWD/pozo.html   # 9/9  separación de los controles
    node pruebas/auditar.mjs     $PWD/pozo.html   # sondas propias del juego

Lo último devuelve, sobre esta versión: 600 pisos generados y ninguno malo,
35/35 sprites decodificados, 0,158 ms por cuadro y 0 errores de JavaScript.

Las pruebas necesitan Playwright; buscan el Chromium en `/opt/pw-browsers`.

## La portada

`portada-pozo.jpg`, 1080×1920 (9:16). El arte es generado; **el título no**: es
el mismo cartel horneado que usa el menú, recortado igual que en el arreglo de
arriba, para que la portada y el juego digan lo mismo letra por letra.

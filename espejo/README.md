# Espejo

Cuarenta puzzles de espejos y rayos. Tocás un espejo y se da vuelta entre `/` y
`\`; ganás cuando están prendidos todos los objetivos a la vez. Sin tiempo, sin
reflejos, sin nada que se mueva por su cuenta.

Vertical, un dedo, tres idiomas (inglés, español y portugués; pregunta cuál la
primera vez). Todo el tablero es vectorial: el único arte generado es el
vestido de los menús.

    python3 -m http.server 8806      # y abrir http://127.0.0.1:8806
    node armar_niveles.mjs           # rehace los cuarenta niveles
    sh pruebas/correr.sh             # 80 comprobaciones
    python3 empaquetar.py            # espejo-en-un-archivo.html, 277 KB

## Ningún nivel se diseñó a ojo

**Un nivel de puzzle se rompe en silencio.** Uno imposible no falla, no tira
ningún error y no se ve distinto de uno difícil: el jugador toca veinte veces,
no pasa nada, y la conclusión que saca es sobre él, no sobre el nivel. Uno que
ya venía ganado es peor, porque se pasa sin darse cuenta de que había un puzzle.

Así que acá no se diseña: se tiran tableros al azar y se los somete a una
búsqueda por anchura sobre **todas** las combinaciones de espejos —con once
espejos son 2048 estados, se recorren en un parpadeo— y un tablero entra sólo si
tiene solución, si **no** viene ya ganado, si el par que dice tener es la
distancia mínima de verdad, y si ese par cae en el rango que le toca a ese
número de nivel. De **44.226 tableros tirados sobrevivieron 40**.

El par no es una estimación ni un número puesto a mano: es la distancia más
corta entre el estado inicial y algún estado ganador, y por eso la pista puede
ser **la solución de verdad** y no una sugerencia. Una pista que a veces te
aleja es peor que no tener pista: te enseña a desconfiar de la única ayuda que
hay.

## Lo que encontró el propio generador

**Un objetivo se come el rayo.** Ocho de los cuarenta niveles no salían nunca, y
los ocho eran justo los que pedían más objetivos que emisores. Un rayo prende un
objetivo y se termina ahí, así que con un emisor y dos objetivos **no hay
tablero posible**, ni difícil ni fácil. El generador tiró noventa mil y no
encontró ninguno, que es exactamente lo que tenía que pasar.

**El rayo se puede colgar.** Dos espejos enfrentados hacen un lazo cerrado.
Cortando por cantidad de pasos, el rayo se dibuja entrando y saliendo del lazo y
parpadea distinto según cuántos pasos se le pusieron; el corte es *haber estado
acá antes* —el conjunto de (celda, dirección) visitadas—, y así el lazo se
cierra siempre en el mismo lugar. Hay una prueba que traza las 104 combinaciones
de espejos de los ocho primeros niveles para comprobarlo.

**Y el error que costó una tarde:** `export const A = 0, B = 1;` es una sola
línea con dos exportaciones, y el empaquetador se quedaba con la primera. En el
archivo único, `ESPEJO` quedaba `undefined` en todos los módulos que lo
importaban — y eso **no falla al cargar**: falla la primera vez que alguien
compara contra él, o sea jugando, y comparar contra `undefined` no tira error,
simplemente nunca es verdad. En pantalla se veía así: tocar un espejo no hacía
nada, sin un solo mensaje en ninguna consola. Se arregló el empaquetador de los
tres juegos y hay una prueba que comprueba que **todos** los nombres que exporta
cada módulo llegan al archivo único.


## El sonido

**Dos cosas distintas, y a propósito.** En el menú suena un tema grabado; en el
juego la música **se toca sola** con osciladores y no se repite nunca.

El modelo de música da treinta segundos como techo y en la práctica devolvió
nueve, de donde sale un bucle de cinco o seis. Eso en un menú no molesta —nadie
se queda diez minutos mirando un menú— y da una atmósfera que un puñado de
osciladores no da. Abajo de una partida de tres minutos, en cambio, es una
tortura: se escucha la costura treinta y seis veces. Así que la música del juego
es un secuenciador: una progresión de acordes, un bajo, un arpegio y percusión
de ruido, con la densidad, el filtro y el bombo atados a **cómo venís jugando**.
La música no acompaña al juego, lo informa — igual que el viento. Y no pesa
nada: cero archivos.

**La música se apaga aparte de los efectos**, porque son dos molestias
distintas: la música cansa a la décima partida y los efectos no, y un efecto es
información mientras la música es decoración.

## Las pruebas

80. Las que más valen:

- Los cuarenta se ganan, ninguno viene ganado, y **el par de cada uno es la
  distancia mínima de verdad** — recalculada con el mismo trazador de rayos que
  usa el juego para dibujar. Si el generador y el juego trazaran el rayo con
  código distinto, el generador podría jurar que un nivel se resuelve y el
  jugador ver que no, que es el peor error posible en un puzzle: no se ve como
  un error, se ve como que sos tonto.
- Los cuarenta se ganan **siguiendo la pista**, y siempre en el par.
- El toque cae en la celda que se ve: se recorren las treinta celdas del tablero
  tocando su centro en tres tamaños de teléfono. Un error de medio píxel en la
  escala no se nota en el medio del tablero y sí en los bordes — y un toque que
  cae en la celda de al lado *sí hace algo*: da vuelta el espejo equivocado y
  gasta un toque del par.
- Ganar se congela, reiniciar deja el nivel como estaba, y volver a abrirlo lo
  arranca desde cero (el nivel es un objeto compartido: escribirle el estado
  adentro sería empezar el puzzle medio resuelto).
- Que no falte ninguna clave en ninguno de los tres idiomas y que no quede
  ningún nombre de clave a la vista en ninguna pantalla.

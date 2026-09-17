# Garfio

Una torre sin techo y un gancho. **Apoyás** el dedo en una argolla y el gancho
se clava. **Arrastrás** y te hamacás. **Soltás** y salís por la tangente.

Vertical, un dedo, tres idiomas (inglés, español y portugués; pregunta cuál la
primera vez). Todo vectorial menos el bicho y el vestido de los menús.

    python3 -m http.server 8805      # y abrir http://127.0.0.1:8805
    sh pruebas/correr.sh             # 79 comprobaciones
    python3 empaquetar.py            # garfio-en-un-archivo.html, 411 KB

## La mecánica, en una línea

Salís **por la tangente**, no hacia donde mirás. Abajo del arco salís rápido
pero de costado; arriba salís lento pero para arriba. No hay un momento
correcto: hay uno distinto para cada argolla que quieras alcanzar.

La altura no se gana esperando. La soga **no se acorta sola** —lo probé y era
peor: con soga corta el péndulo es chiquito, la velocidad que se junta en un
arco de 34 px alcanza para subir 34 px y las argollas están a 96, así que
"quedarse colgado para ganar altura" terminaba siendo la forma de no llegar
nunca a ninguna parte. Se gana hamacándose, que además es una decisión.

## Lo que estuvo difícil

**Un péndulo no arranca solo.** Enganchado justo abajo de la argolla y sin
velocidad de costado, el bicho sube y baja en línea recta para siempre. De ahí
salió el empuje del dedo: arrastrar hamaca, literalmente como estirar las
piernas en una hamaca. Sin eso el juego no existe.

**Dos argollas en la misma vertical no se encadenan.** El generador las ponía
todo el tiempo, porque el corrimiento de costado salía de un rango grande y se
recortaba contra la pared, dejando una escalera pegada al borde. No es "una
versión fácil" del salto: es otro problema, y uno que el juego no enseña a
resolver. Ahora hay un mínimo, y el lado se elige mirando la pared.

**Las púas de pared eran una pelea contra la mecánica.** Un péndulo *barre* de
pared a pared: poner el castigo en las paredes es castigar lo que el juego te
pide hacer. El robot moría dieciocho de veinte veces contra una púa. Se
reemplazaron por el piso que sube, que no pelea con nada — apura.

**El robot tartamudeaba.** Soltaba porque ya alcanzaba la siguiente argolla y al
cuadro siguiente, todavía por debajo de la que había soltado, "la próxima
argolla que tengo encima" volvía a ser esa misma. Sesenta veces por segundo
enganchando y soltando la misma argolla, subiendo cero. Ahora lleva cuenta de
la última usada.

**Y predecía con una física distinta de la que jugaba.** El robot simula su
propio vuelo para decidir cuándo soltar, y esa simulación no tenía paredes: un
vuelo que rebota pierde más de la mitad de la velocidad de costado. Soltaba
convencido de que llegaba, rebotaba, y caía al vacío con la argolla
cuatrocientos píxeles arriba. Predecir con otra física no es "una aproximación":
es validar otro juego.

**Acostado se veían 166 píxeles de alto** —menos que la distancia entre dos
argollas— porque la escala salía sólo del ancho. No era difícil: era imposible,
no se veía adónde saltar. Ahora hay un mínimo de torre a la vista y en
horizontal queda una tira angosta en el medio, que es lo que corresponde a un
juego vertical.


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

79, y la que más vale es `pruebas/salto.mjs`: **vuelve a medir cuánto se salta
de verdad**, armando una torre de dos argollas y poniendo al piloto a
hamacarse. `SALTO_MAX` es una constante en un archivo; alguien toca la gravedad
o el empuje y la constante se queda con el valor de ayer. El juego sigue
arrancando, sigue viéndose bien, y cada tantas argollas pide un salto que ya no
existe.

Las otras: que los 7879 saltos de ocho torres entren en ese número, que ninguna
argolla quede en la misma vertical que la anterior, que el piloto encadene más
de treinta argollas de mediana, que ninguna corrida sea eterna, que hamacarse
junte más envión que quedarse quieto, que enganchar no dé ningún tirón, que el
menú entre entero en tres tamaños de teléfono sin barra de desplazamiento, que
el toque de pantalla se convierta bien en un punto del mundo, que las cinco
imágenes del vestido vayan incrustadas como `data:` en el archivo único, y que
no falte ninguna clave en ninguno de los tres idiomas.

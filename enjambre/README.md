# Enjambre — cuatro etapas, un pulgar, nada de apuntar

Vos te movés; las armas disparan solas. Lo que decide la partida es **qué subís
y en qué orden**. El único botón es el envión.

**Ocho especies** con comportamientos distintos, **tres jefes**, **cuatro etapas**
con su propia paleta y su propia mezcla, **cinco armas con evolución**, cinco
pasivas, elites y cofres. Todo dibujado por código: **114 KB**, sin un binario.

## Lo medido

`node pruebas/balance.mjs` hace jugar **64 partidas enteras** sin abrir un
navegador: dos robots distintos × cuatro etapas × ocho semillas.

| | |
|---|---|
| pruebas de balance | **10/10** |
| el que elige **al azar** | gana **3 de 32** |
| el que **elige bien** | gana **12 de 32** |
| etapas terminables eligiendo bien | **4 / 4 / 2 / 2** (de 8 cada una) |
| evoluciones alcanzadas | **13** en 32 partidas |
| bichos en pantalla | **27–85 %** de los vivos (antes: **2 %**) |
| cuadro de simulación | mediana **0,68 ms**, p99 **1,67 ms** |
| archivo único | **114 KB**, 0 binarios |

Que el que elige bien gane cuatro veces más que el que elige al azar es la
prueba de que la pantalla de mejoras tiene decisiones adentro y no es una
pantalla de decisión decorativa.

## Por qué hay un simulador aparte

La simulación no toca dibujo ni audio. Eso deja hacer lo único que sirve para
balancear: que un robot juegue sesenta y cuatro partidas completas en un minuto
y medir. Un juego de supervivencia se rompe por el balance, y nada de eso se ve
mirando una captura.

Esto es lo que encontró, en orden.

### El juego no se podía ganar

Medido: el robot sobrevivía **318 segundos de una etapa de 300** y perdía igual.
La victoria pedía además que no quedara ningún jefe vivo, y nadie baja 1500
puntos de vida mientras huye. El jefe es una amenaza a esquivar, no un peaje.

### Lo que no se mueve, se acumula

El **acecho** se queda quieto hasta que te acercás. Un bicho quieto no se acerca
a que lo maten: a los dos minutos el mapa entero era un campo minado y la etapa
no la terminaba nadie, 0 de 8. Ahora tiene techo de cuántos pueden existir y el
que quedó lejísimos se levanta y se va.

### No era hambre, era desangre

La misma etapa seguía en 0 de 8 y la explicación obvia era que faltaban bichos
para matar. El robot dijo otra cosa: **mataba lo mismo que en la etapa fácil**
—174 contra 190— y llegaba al mismo nivel, pero terminaba con **48 de vida
contra 134**. El censo mostró **66 escupidores vivos**, uno cada 2,8 segundos:
veintitrés balas por segundo. Eso no se esquiva, se sufre. Techo de diez.

### El 2 %

El hallazgo más grande, y vino de medir algo que nadie mide: **cuántos bichos
hay realmente en pantalla**. A los sesenta segundos había 56 vivos y **uno**
visible. La mediana estaba a 446 píxeles, o sea afuera. La masa era más lenta
que el jugador, nunca cerraba la distancia, y se juntaba un anillo de bichos
lejísimos mientras la pantalla se veía vacía. **Un juego de hordas donde no se
ve la horda.**

Dos arreglos: que la masa corra lo bastante como para alcanzarte cuando frenás,
y que el que quedó demasiado lejos **se recicle** —vuelve a aparecer del otro
lado en vez de quedar perdido en un rincón—. De 2 % a 78 %.

### La velocidad va por peso

Subir la velocidad de todos por igual arregló la pantalla y rompió el juego: 0
de 8 en las dos últimas etapas incluso eligiendo bien. La culpa era del
caparazón, que corría casi tanto como el jugador siendo el que más aguanta. Un
muro que además te persigue no se rodea, sólo se sufre. Lo chico corre, lo
grande no.

### Más bichos quiere decir que cada uno pegue menos

Con la horda llegando de verdad, el daño de contacto de antes se volvió una
sentencia: rodeado eran veinte de daño por segundo y la barra entera en cinco
segundos. El peligro de una horda es que no te deja respirar, no que cada mota
pegue como un jefe.

## Y uno de estructura disfrazado de estilo

Las descripciones de las mejoras salían partidas en **una palabra por renglón**.
Parecía CSS: la tarjeta es una grilla de dos columnas y tenía **tres hijos**, así
que el tercero se iba a la fila de abajo y caía en la columna de 14 píxeles.
Medido: 14 px de ancho para un párrafo.

## Las imágenes, cuando lleguen

Todo está dibujado con formas y movimiento —patas que caminan, alas que baten,
cuerpos que se aplastan al golpear, ojos que te miran—. `assets.js` busca cada
imagen por nombre y, si no está, el dibujo la hace. Los assets generados no
existen todavía porque el servicio que los genera rechaza el cobro
(`CREDIT_RESERVE_FAILED`, comprobado con dos modelos, dos proyectos, audio e
imagen y seis reintentos). Cuando aparezcan se copian a `assets/`, se vuelve a
empaquetar y **no hay que tocar una línea de código**.

## Cómo se corre

```
python3 empaquetar.py        # arma enjambre-en-un-archivo.html
node pruebas/balance.mjs     # 64 partidas completas, sin navegador
node pruebas/perfil.mjs      # qué fase se come el cuadro
```

Desde el código fuente hace falta un servidor (`python3 -m http.server`), porque
`file://` bloquea los módulos ES. El archivo único no: doble clic y anda.

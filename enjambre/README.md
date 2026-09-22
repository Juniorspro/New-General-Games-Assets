# Enjambre — sobreviví seis minutos

Un pulgar y nada de apuntar. Vos te movés; las armas disparan solas. Lo que
decide la partida es **qué subís y en qué orden**.

Cinco armas, cinco pasivas, cuatro especies de bicho y dos jefes. Todo dibujado
por código: ni un png ni un mp3, y el archivo único pesa **78 KB**.

## Lo medido

Sale de `node pruebas/balance.mjs`, que hace jugar doce partidas enteras a un
robot sin abrir un navegador.

| | |
|---|---|
| el robot más tonto sobrevive | **9 de 12** — ni siempre ni nunca |
| nivel medio al que llega | **21,6** |
| techo de bichos vivos | **200** (pico medido 202) |
| cuadro de simulación | mediana **0,38 ms**, p99 **0,77 ms** |
| archivo único | **78 KB**, 0 binarios |

## Por qué hay un simulador aparte

La simulación no toca dibujo ni audio. Eso deja hacer lo único que sirve para
balancear: que un robot juegue doce partidas de seis minutos en un segundo y
medir. Un juego de supervivencia se rompe por el balance, no por el dibujo, y
nada de eso se ve mirando una captura.

Lo que encontró, en orden:

**La espiral de la muerte.** Sin techo de bichos, las doce partidas terminaban
en derrota y se llegaba a **560 bichos a la vez**. El problema no es que sea
difícil: es que si no alcanzás a matar al ritmo al que entran, cada segundo
entran más, y la partida ya está perdida dos minutos antes de que te toquen.
Con techo, quedarse atrás se paga caro pero se puede remontar.

**La velocidad es la variable que manda.** Subir la vida de los bichos y el daño
de contacto casi no movió la supervivencia: con el jugador a 140 y la masa a 46,
nunca lo alcanzaban, así que ni la vida ni el daño llegaban a aplicarse. Recién
subiendo las velocidades el balance se movió de 10/12 a 4/12.

**El máximo miente.** El primer informe decía **51,76 ms** de peor cuadro. El
perfil por fases mostró que la fase más cara costaba 6,83 ms y que el promedio
era 0,19: el pico era una pausa del recolector de basura. Se informa mediana y
percentil 99, que describen casi todos los cuadros, en vez del peor de veinte
mil.

## El agujero que el robot NO vio

A los veinte segundos: **21 bichos matados, 20 gemas tiradas en el piso, nivel
1**. El juego entero es subir de nivel, y no subía.

Tres cosas encadenadas, y ninguna se ve mirando:

1. Las gemas se atraían a 120 px/s mientras el jugador corre a 140. Huyendo
   —que es lo que uno hace todo el tiempo— la gema quedaba atrás.
2. Una vez fuera del radio del imán, la gema se frenaba para siempre. No hay
   ningún aviso de eso: simplemente subís más lento de lo que deberías.
3. Y la causa de fondo: **el alcance del arma y el del imán no se hablaban**.
   La chispa mataba a 520 px y la gema caía donde murió el bicho, a 179 px de
   un imán de 150. Ninguna entraba nunca.

La prueba de balance no lo vio porque en seis minutos uno termina pisando
gemas por casualidad, así que el nivel final igual subía y el número tapaba el
agujero. Apareció midiendo los primeros veinte segundos dentro del juego real.

Arreglado: el arma dispara a 290, el imán arranca en 150, la gema **siempre**
viene —lejos despacio, cerca rápido— y una vez atraída no te suelta.

## Y uno de estructura disfrazado de estilo

Las descripciones de las mejoras salían partidas en **una palabra por renglón**.
Parecía CSS y no lo era: la tarjeta es una grilla de dos columnas —el cuadradito
de color y el texto— y tenía **tres hijos**, así que el tercero se iba a la fila
de abajo y caía en la columna de 14 píxeles. Medido: 14 px de ancho para un
párrafo. Se arregló envolviendo los dos textos en un solo hijo.

## Las imágenes, cuando lleguen

El juego está entero dibujado con formas, y eso no es una limitación permanente:
`assets.js` busca una imagen por nombre y, si no está, el dibujo la hace. Los
assets generados todavía no existen porque el servicio que los genera está
rechazando el cobro (`CREDIT_RESERVE_FAILED`, comprobado con dos modelos, dos
proyectos y seis reintentos). Cuando aparezcan se copian a `assets/`, se vuelve
a empaquetar y **no hay que tocar una línea de código**.

## Cómo se corre

```
python3 empaquetar.py        # arma enjambre-en-un-archivo.html
node pruebas/balance.mjs     # doce partidas completas, sin navegador
node pruebas/perfil.mjs      # qué fase se come el cuadro
```

Para jugarlo desde el código fuente hace falta un servidor (`python3 -m http.server`),
porque `file://` bloquea los módulos ES. El archivo único no: doble clic y anda.

# Pique — un corredor 2D con niveles que se comprueban solos

Un juego de un botón, estilo *Super Mario Run*: el personaje corre solo y lo
único que hacés es saltar. **Cuándo** y **cuánto** apretás es todo el juego.

24 niveles, 6 mundos. **Ninguno está dibujado a mano** y **ninguno se publica
sin haberse jugado entero por dentro primero.**

```
pique/
  index.html            las 7 pantallas
  css/pique.css
  js/
    mundo.js            constantes: tiles, fisica, temas, los 24 niveles
    azar.js             azar con semilla (mulberry32)
    fisica.js           la fisica del jugador — funcion pura
    piezas.js           21 piezas parametrizadas del generador
    generador.js        armado + VALIDADOR (busqueda en haz)
    entidades.js        13 enemigos
    juego.js            una partida: camara, reloj, monedas, burbujas, jefes
    dibujo.js           todo dibujado por codigo, ni un PNG
    audio.js            todo sintetizado, ni un MP3
    interfaz.js         menus, mapa, HUD, resultados
    main.js             entrada y bucle
    guardado.js         localStorage
  pruebas/
    correr.sh           levanta el servidor y corre todo
    niveles.mjs         72 combinaciones nivel×color
    interfaz.mjs        43 comprobaciones de interfaz
    capturas.mjs        capturas de cada tema
```

## Lo medido

Todo esto sale de `./pruebas/correr.sh`, no de una estimación.

| | |
|---|---|
| niveles generados y validados | **72/72** (24 niveles × 3 colores) |
| caminos del validador rehechos dentro del juego real | **72/72** |
| comprobaciones de interfaz | **43/43** (compu y teléfono) |
| el archivo único, desde `file://` | **9/9** |
| peor tiempo de generación | **1075 ms** · típico ~100 ms |
| camino óptimo | 13,5 a 24 s según el nivel |
| tamaño total | ~170 KB, sin una sola dependencia |
| errores de JavaScript | ninguno |

## Lo que hace que esto no sea un generador más

Un generador procedural sin validador tarde o temprano escupe un pozo de nueve
tiles con una pared enfrente, y el jugador se come un nivel imposible con un
cartel que dice "listo". Acá cada nivel **se juega entero antes de salir**:

1. Se arma con 21 piezas parametrizadas a partir de una semilla que sale del
   número del nivel — el 3-2 es siempre el 3-2, en cualquier máquina.
2. Se resuelve con una **búsqueda en haz sobre la física de verdad**: 96
   estados, cada uno se abre en dos por cuadro (dedo apoyado o no), se tiran
   los repetidos y se queda con los que llegaron más lejos.
3. Si no hay camino, o si el camino pide volver sobre los propios pasos más de
   2,2 veces el largo del nivel, **se tira el nivel y se arma otro** con la
   dificultad un poco más baja. Hasta diez veces.
4. El **tiempo límite sale de lo que tarda ese camino**, no de un número
   escrito a mano: ×3,2 más doce segundos.
5. Las cinco monedas de color se ubican en celdas **que el camino probó que se
   alcanzan**. Las que quedan fuera se mueven hasta una que sí.

La física del validador y la del juego **son el mismo archivo**. `pruebas/
niveles.mjs` lo comprueba de la única forma que vale: le pide al validador el
camino que encontró y lo **rehace cuadro por cuadro dentro de una partida
real**. 72 de 72. Si fueran dos físicas distintas, "nivel validado" sería una
opinión.

**Lo que el validador NO comprueba: los enemigos.** Un enemigo se esquiva, se
pisa o se vaultea; una pared de nueve tiles no. Está dicho acá para que nadie
lo dé por hecho.

## Cómo se juega

Un botón. Tocar la pantalla o la barra espaciadora.

| movimiento | cómo |
|---|---|
| salto corto | toque seco — ~2,5 tiles |
| salto alto | mantenerlo — ~4,7 tiles, se corta al soltar |
| **vault** | **solo**: obstáculos de 1 tile y huecos de 1-2. De 3 hay que saltar |
| **vault con toque** | tocar *justo* al vaultear: más alto y mata al enemigo |
| trepada | **sola**: caer sobre el filo te sube en vez de rebotar |
| salto de pared | tocar pegado a una pared: rebota y **da vuelta la carrera** |
| giro en el aire | tocar sin salto: no sube, frena la caída. Uno por salto |
| tobogán | caer en una bajada: acelera y arrasa |
| salto largo / voltereta | bloques que cambian el arco: lejos y bajo, o muy alto |

**No hay vidas, hay burbujas.** Al morir entrás en una burbuja que vuelve para
atrás y perdés 5 monedas; tocás para pincharla donde quieras. Arrancás con dos.

**Cinco monedas de color por nivel.** Las cinco rosas en una corrida habilitan
las violetas, y esas las negras. Es el mismo nivel tres veces.

## Un solo archivo

```sh
python3 empaquetar.py      # -> pique-en-un-archivo.html
```

**129 KB** (39 comprimido) con todo adentro: se abre con doble clic, sin
servidor, sin internet y sin pedir un solo archivo suelto. Es lo que hay que
mandarle a alguien que quiere jugar y nada más.

No se pueden pegar los módulos uno atrás del otro: `crear` existe en
`entidades.js` **y** en `interfaz.js`, y `moneda`, `paso` y `tiles` también
chocan. Pegados, el último se come al primero y el juego rompe en un lugar que
no tiene nada que ver con la causa. `empaquetar.py` envuelve cada módulo en una
función que devuelve sus exportaciones y reescribe los `import` como lecturas
de ese objeto.

`pruebas/un-archivo.mjs` lo prueba **desde `file://`, no desde `http://`**: si
se probara por HTTP se estaría probando otra cosa, y el CORS de los módulos
—que es lo que el empaquetado viene a resolver— no aparecería nunca.

## Correr y probar

```sh
python3 -m http.server 8799 --bind 127.0.0.1    # el juego, en /pique/
./pruebas/correr.sh                              # todas las pruebas
node pruebas/capturas.mjs /tmp/tiro              # una captura por tema
```

**Tiene que ser HTTP, no `file://`.** El juego usa módulos de JavaScript, y un
módulo cargado desde `file://` lo bloquea CORS en todos los navegadores, con un
error que habla de orígenes y parece un problema de red.

## Las trampas que ya se pagaron

Cada una costó una vuelta entera y está comentada en el código donde vive.

1. **Un muro solo nunca sirve para avanzar.** El salto de pared manda al
   jugador *en contra* de la pared, así que una pared enfrente lo devuelve para
   atrás. Las dos primeras versiones de `pared` y `chimenea` levantaban el muro
   **encima del piso de aproximación**: el jugador chocaba, se daba vuelta y
   quedaba yendo y viniendo para siempre. El validador lo cazó como *"sin
   salida"* en el 5-4 y *"sin tiempo"* en el 4-1 — el mismo bug con dos
   nombres. Ahora son pozos con las dos paredes, que es como funcionan las
   torres del original.

2. **Un tile definido no es un tile implementado.** `V.LARGO` existía como
   bloque desde el principio y la pieza `saltoLargo` abría huecos de 9 tiles
   contando con él — pero el salto largo no estaba escrito en la física, así
   que el bloque era un ladrillo común y el hueco, imposible. El 6-4 tardaba
   **nueve intentos** en validar.

3. **Plataformas de un tile cada dos son imposibles.** A 2,55 px por cuadro el
   jugador pisa un tile durante seis cuadros. Encadenar cuatro saltos así no lo
   resuelve nadie, ni el validador. Van de a dos y cada tres.

4. **Un nivel completable puede ser un nivel horrible.** El 3-2 salió una vez
   con un camino óptimo de 4827 cuadros contra 1161 de línea recta: cuatro
   veces el largo del nivel yendo y viniendo. Se podía terminar. Se rechaza
   igual.

5. **El tiempo límite escrito a mano no quiere decir nada.** El 1-1 daba 80
   segundos para un recorrido de 14,6. Ahora sale de lo medido.

6. **`vh` en el teléfono mide la pantalla con la barra del navegador adentro**,
   así que el último renglón queda siempre tapado. Va `svh`.

7. **El flanco del toque se calcula por cuadro, no en el evento.** Calculado en
   el evento, dos toques dentro del mismo cuadro se comen uno — y a 60 Hz en
   una pantalla táctil eso pasa todo el tiempo.

8. **Perder el foco con el dedo apoyado** dejaba al jugador saltando para
   siempre. Va un `blur` que suelta.

9. **Paso fijo, no dt variable.** Con dt variable la física cambia según los
   hercios del monitor: en una pantalla de 144 Hz el salto sale distinto que en
   una de 60, y el nivel validado deja de ser el nivel que se juega.

10. **El contexto de audio no se puede crear al cargar la página.** Los
    navegadores lo dejan `suspended` hasta que hay un gesto, y todo sonido
    disparado antes se pierde **en silencio, sin ningún error**.

11. **Generar bloquea el hilo hasta un segundo.** Sin ceder dos cuadros antes,
    la pantalla "generando" no llega a pintarse nunca y el jugador ve un
    cuelgue en vez de un aviso.

12. **Los menús van en DOM, no en canvas.** Un botón dibujado en un canvas
    parece un botón y no lo es: hay que escribirle la detección de toque a
    mano, no lo lee un lector de pantalla y no se navega con el teclado.
    `pruebas/interfaz.mjs` comprueba cada botón con `document.elementFromPoint`
    en su propio centro — que exista no quiere decir que se pueda tocar.

## Lo que falta

| pendiente | qué sería |
|---|---|
| Generar en un *worker* | el peor caso de 1075 ms bloquea el hilo; en un worker la pantalla de carga podría animarse |
| El validador no sabe de enemigos | costaría mucho más y cambiaría poco: la geometría es lo que hace un nivel imposible |
| Casas fantasma con habitaciones | el original cambia cuartos según el color de moneda; acá son niveles normales con tema propio |
| Modo contrarreloj | los tiempos ya se guardan, falta la pantalla |

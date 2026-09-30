# LA ISLA — supervivencia en una isla pixelada

La isla de los videos de **Phoenix Baker (@vfx843)**, rehecha en HTML con
three.js a partir de lo que se ve en su perfil: una isla tropical en 3D con
pinta de pixel art. Se juntan ramas y piedras, se talan palmeras, se pican
rocas de a pedazos, se pesca en el muelle, se cava con la pala, se construye
con bloques y se baja a una mina a buscar gemas y cosas raras. El menú es el
de la otra idea que pasaste, la de **@brutu_scripts**: la cámara se mece con el
mouse y vuela a carteles que están en la isla. Mantuve su mecánica y cambié el
estilo, que en vez de metal y neón en la oscuridad es la playa del juego.

Encima de eso tiene **un propósito**: naufragaste, el faro de la isla está
apagado y ningún barco se acerca. Hay que arreglarlo, bajar hasta la sala más
honda de la mina a quitarle el corazón de cristal al guardián, encenderlo con
una estrella caída y esperar el barco. De noche salen esqueletos piratas.

Arranca con la **intro de JXSTUDIOS en 3D** (tres segundos, con su música):
- La puerta es "tocá para entrar", porque el teléfono no deja sonar nada antes
  de un toque.
- Una raya de luz se abre en lo negro, se prende la placa de fibra de carbono,
  entran las barras de la reja de metal y la cámara gira desde un costado.
- El monograma JXS se escribe en cromo: cuatro tubos que crecen con una luz y
  chispas en la punta.
- Golpea: salta hacia la cámara con destello, ondas y sacudida, y un brillo
  cruza el metal.
- Suben "JXStudios" y "presenta", y la cámara se mete en el logo hasta el
  blanco, del que aparece la playa.

Un toque la saltea. → `js/intro.js`, `js/logojxs.js`, `js/sonido.js › jingleJXS`

    python3 -m http.server 8123          # desde la raíz del repo, y abrir http://127.0.0.1:8123/isla/
    sh pruebas/correr.sh                 # 66 + 7 comprobaciones
    python3 empaquetar.py                # arma isla-en-un-archivo.html (1182 KB, abre con doble clic)

Texturas, modelos, íconos, música y sonidos salen todos del código: no hay ni
una imagen ni un audio de archivo. En español, inglés y portugués.

---

## Lo medido

29/09/2026, Chromium sin placa de video (SwiftShader), 960×540 salvo aclaración.

| qué | cuánto |
|---|---|
| comprobaciones | **66/66** en `pruebas/juego.mjs` y **7/7** en `pruebas/un-archivo.mjs` (30/09/2026, una corrida: las 60 de antes, más 6 de la intro y 1 de la intro en el archivo único) |
| carga hasta la sonda | 590-807 ms (módulos) · 798 ms (archivo único, desde `file://`) |
| lógica de un cuadro, sin dibujar | **0,26-0,32 ms** (el presupuesto de 60 cuadros es 16,7 ms) |
| en la playa | 804.528 triángulos, 219 llamadas de dibujo (con el reflejo del agua, que dibuja de nuevo palmeras, choza y nubes) |
| en la mina | 66.606 triángulos, 24 llamadas |
| partida guardada | 4,2 KB en `localStorage` (solo lo que cambió contra la semilla) |
| archivo único | 1182 KB: 41 módulos + three.js r160, ningún archivo suelto (la intro de JXSTUDIOS suma 44 KB) |
| la intro de JXSTUDIOS | 3 s; 4 tubos de cromo (18.864 triángulos), 800 chispas, reflejos de un estudio armado con PMREM una sola vez; todo se compila en la puerta y se libera al terminar |
| la pelea | una espada de piedra voltea un cangrejo en 2 golpes; un esqueleto de noche pega a los 1,4 s de verte; el peto de hierro baja un golpe de 12 a 7 |
| el guardián | 320 de vida: con la espada de amatista, unas 20 tandas de espadazos |
| la fogata | de 187 intentos de aparecer de noche, ninguno a menos de 15 m |
| talar una palmera con hacha de piedra | 5 golpes, 2,2 s |
| la pala | sube 1,4 m en 1,5 s y gasta 1 piedra cada 0,35 m³; bajar la devuelve |
| la mina | laberinto de 54×54 m a 60 m bajo la isla, 42 vetas (5 raras), 22 faroles y la sala del guardián |
| otras semillas | 1, 7, 42, 99999 y 123456 arman faro, naufragio, botella, tesoro y sala del jefe sin errores (sin mirarlas en pantalla) |

**Sin comprobar:** cuántos cuadros da en un teléfono de verdad. SwiftShader
dibuja con el procesador, así que sus tiempos de dibujo no dicen nada de una
placa. La calidad BAJA (sombra de 1024, la mitad de pasto, un píxel más grande
y sin reflejo en el agua) arranca sola en los aparatos táctiles.

## Cómo se juega

| | teclado y mouse | dedos |
|---|---|---|
| moverse, correr | WASD / flechas, Shift | palanca (a fondo corre) |
| mirar | mouse (clic para capturarlo) | arrastrar en la pantalla |
| pegar, talar, picar, cavar, pescar | clic izquierdo (mantener) | ⚒ |
| tensar el arco | mantener el clic y soltar | mantener ⚒ y soltar |
| poner un bloque, abrir mesa o cofre, ponerse el peto, leer una botella, cocinar al lado del fuego, plantar un coco | clic derecho | ▣ |
| juntar, mina, descansar, arreglar el faro, comerciar, subir al barco | E | E |
| saltar, subir nadando | Espacio | ▲ |
| mochila, mesa, colección | Tab / I | ☰ |
| mapa | M | ▦ |
| primera o tercera persona | V | ◉ |
| elegir en la barra | 1-9, rueda | tocar la ranura |
| tirar (la pila entera) | Q (Shift+Q) | — |
| comer o tomar | F | ▣ |
| pincel de la pala | R | los botones de colores |
| pausa | Esc | II |

Con el teléfono parado, el juego se gira solo 90° y se juega acostado (pide
pantalla completa y trabar la orientación donde el navegador deja).

## La historia

Seis capítulos, con un cartel al empezar cada uno y el objetivo siempre a la
vista. El objetivo de ahora es el que sigue al más adelantado que ya
cumpliste: lo que te salteaste queda atrás y la guía no se traba.

1. **El naufragio:** ramas y piedras, hacha, primera palmera, mesa de trabajo
   y la botella que dejó el mar al lado del barco roto (clic derecho la lee).
2. **La primera noche:** un arma, una fogata (espanta a los esqueletos, cura y
   cocina), vencer a tres enemigos y cocinar algo.
3. **El faro:** encontrarlo en la punta de la isla (el mapa lo marca), pico,
   farol, bajar a la mina y los dos primeros arreglos: la escalera (20 de
   madera, 4 de hierro) y la lente (3 de cuarzo, 1 de oro).
4. **El guardián:** pico de hierro y el gólem de la sala más honda. Avisa cada
   golpe levantando los brazos y marcando el piso en rojo; a media vida se
   enoja y tira rocas.
5. **La luz:** el corazón de cristal en el faro y, de noche, una estrella caída
   para encenderlo. Al amanecer viene un barco al muelle.
6. **La isla es tuya:** subir al barco muestra el final, con lo que hiciste, y
   se sigue jugando.

Hay cinco cartas en botellas (la primera en la playa, las otras se pescan) que
cuentan la historia y dan pistas.

## Qué hay (lo que muestran los videos)

- **La isla sale de una semilla:** terreno con cerro, laguna, playas y
  senderos; 230 palmeras, 420 matas redondas, 140 helechos, rocas oscuras y
  pasto denso que se mueve con el viento; la choza de paja, el muelle, la boca
  de la mina, el faro en la punta y el barco roto en la arena.
- **El look pixel en 3D:** cada fragmento busca el centro de su texel en el
  espacio del mundo (con derivadas) y ahí calcula textura, luz y sombra. Por
  eso las sombras de las hojas caen en la arena en cuadraditos, como en los
  videos, en vez de salir suaves (`js/material.js` › `hastaCentro`). El píxel
  de pantalla es de escala entera (`image-rendering: pixelated`).
- **Nubes de verdad:** 34 nubes 3D de bolas pegadas con la base chata y tres
  tonos (luz, medio y sombra), que se tiñen de naranja al atardecer y de azul
  de noche (`js/nubes.js`).
- **El agua** en turquesa, más oscura en lo hondo, con espuma en la orilla,
  destellos y **reflejo**: una cámara espejo abajo del agua dibuja el cielo, las
  nubes, las palmeras, la choza, el muelle y el faro, y el agua lo ondula
  (`js/agua.js` › `Reflejo`). Todo flota, "así no perdés cosas en el mar",
  como dice el autor.
- **Rocas de a pedazos:** cada roca es un racimo de 7 u 8 pedazos facetados que
  se sacan uno por golpe (dos con pico de piedra). Las vetas tienen cristales
  del color de su gema.
- **Gemas y raros con material propio:** el ópalo cambia de color según cómo
  lo mirás, el bismuto hace arcoíris, la pirita es metal, el fragmento de cielo
  muestra el cielo, la antimateria es un agujero al universo, la gravinita
  muestra la grilla del espacio-tiempo, el uranio larga chispas verdes y los
  quarks aparecen y desaparecen.
- **Inventario a lo Minecraft:** 9 + 27 ranuras, pilas de 64, clic levanta
  (derecho, la mitad), Shift+clic lo manda al otro lado. El cartel muestra el
  nombre, las estrellas de rareza y el precio en una pastilla verde.
- **67 ítems y 26 recetas**, 8 a mano y 18 con mesa de trabajo cerca.
- **Armas:** espadas de madera, piedra, hierro y amatista, lanza (llega más
  lejos) y arco con flechas; petos de caparazón (25 %) y de hierro (45 %).
  Uno de cada diez golpes es crítico.
- **Enemigos:** cangrejos en la playa (de día se hacen los tontos), esqueletos
  piratas que salen de la arena de noche y se queman al amanecer, murciélagos
  en la mina y el guardián. Un golpe los frena, los empuja y los pone blancos;
  el mundo se congela 50 ms cuando el arma toca y salta el número del daño.
- **Construir** en una grilla de 1 m con holograma cian (rojo si no entra):
  madera, piedra, tablones, mesa, cofre de 27 ranuras, farol de pie y fogata.
- **La fogata:** cocina carne de cangrejo y pescado, cura de a poco al lado y
  no deja aparecer nada a 15 m.
- **Plantar cocos:** el brote crece hasta palmera con cocos en un tercio de día.
- **El mercader:** desde el segundo día amarra su bote al lado del muelle.
  Compra lo que juntaste al 80 % y vende flechas, pociones, faroles, una espada
  y un peto de hierro, la caña dorada y el mapa de un tesoro.
- **El tesoro:** con el mapa aparece una X en una playa lejana; la pala la cava
  y sale un cofre con oro, monedas y gemas.
- **El mapa (M):** la isla vista de arriba con relieve, la choza, la mina, el
  faro, el mercader, las fogatas y la X; en la mina, solo lo que ya caminaste.
- **Tercera persona (V):** el náufrago de bloques camina, nada y pega con lo
  que tenga en la mano.
- **La pala** con seis pinceles (subir, bajar, aplanar, suavizar, arena y
  pasto) y un anillo que se pega al terreno; **la guadaña** corta el pasto y
  deja tierra.
- **Pescar** como en Minecraft: la boya se hunde y hay un segundo para tirar.
  De noche salen más peces abisales y con la caña dorada, más tesoros.
- **Día y noche** en 20 minutos, con estrellas que caen cerca de noche (dan luz
  propia; una de cada diez es un fragmento de cielo). En la choza se descansa
  hasta el amanecer.
- **Lo que se mueve:** gaviotas que planean sobre la playa, luciérnagas en el
  pasto de noche y peces que saltan en el mar.
- **La mina:** laberinto con vigas, rieles y faroles colgados; la niebla negra
  se come lo lejano y sin farol se ve poco. Lo raro está lejos de la escalera y
  pide pico de hierro. En la sala más honda, cristales gigantes y el guardián.
- **Sonido sintetizado:** golpes de piedra y de madera, metales, gemas que
  suenan a vidrio, espadazos, huesos, la bocina del barco, pasos distintos en
  arena, pasto, madera, piedra y agua, olas, pájaros de día, grillos de noche,
  gotas en la mina y una marimba sobre cuatro acordes fijos.
- **Guardado** automático cada 40 s, al pausar y al cerrar la pestaña, con la
  historia, la plata, el peto y las palmeras plantadas.

## El menú

- **La cámara se mece con el mouse.** Los números son los del tutorial:
  - inclinación máxima de 18°;
  - vaivén de 1,5° con seno y coseno;
  - velocidad 3: el vaivén usa t·3 y la inclinación se acerca al mouse con
    dt·3.
- **El texto se inclina con la cámara** (blanco, itálico y gordo) para que
  parezca parte de la escena.
- **AJUSTES vuela a un cartel de madera clavado en la arena.** Se toca con el
  mouse sobre el cartel mismo: un rayo hasta su cara y de ahí a la coordenada
  del lienzo que lo pinta. Tiene volumen, sensibilidad, calidad, tamaño de
  píxel e idioma. En la pausa, el mismo lienzo se muestra plano.
- **CRÉDITOS vuela al cartel de la punta del muelle.**
- **JUGAR vuela hasta los ojos del jugador:** el meneo se apaga en el vuelo,
  así la última imagen del menú es la primera del juego.
- **La toma se elige sola**, entre las que se decidieron mirando capturas: gana
  la primera con aire adelante. Con el teléfono parado, se mira más hacia la
  choza.

## Cómo está armado

`js/main.js` arranca y reparte cada cuadro entre menú, juego, ventana y pausa.
La física pregunta a un intermediario, `fisica`, que decide por la **altura**:
de y > −30 es la isla y de y < −30 es la mina. Por eso lo que quedó tirado en
la playa no se cae a la mina cuando bajás. Todo lo que hace el jugador (golpes,
flechas, la mano) sale de `J.ojos` y no de la cámara, que en tercera persona
está atrás.

| módulo | qué hace |
|---|---|
| `material.js` | la luz pixelada compartida (`LUZ`) y los materiales `uv`, `mundo`, `liso` y terreno |
| `terreno.js` | alturas, materiales (pasto/tierra), pincel de la pala, diferencias para guardar |
| `cielo.js`, `nubes.js`, `agua.js` | domo, sol y luna, sombra que sigue al jugador de a un texel; nubes 3D; el mar y su reflejo |
| `vegetacion.js`, `pasto.js`, `rocas.js` | palmeras (y las plantadas), matas, helechos, pasto por chunks, rocas de a pedazos |
| `estructuras.js`, `mundo.js` | choza, muelle, boca de mina; arma la isla desde la semilla |
| `mina.js` | el laberinto de abajo, la sala del guardián y su choque |
| `items.js`, `gemas.js` | los 67 ítems (datos, íconos 16×16 y modelos) y sus materiales especiales |
| `inventario.js`, `construir.js` | pilas y recetas; bloques, cofres, fogatas y holograma |
| `jugador.js`, `entrada.js`, `pantalla.js` | caminar, nadar, coyote y buffer de salto; teclado, mouse y dedos; la app girada |
| `acciones.js` | todo lo que hace la mano, la tecla E y las estrellas que caen |
| `combate.js`, `enemigos.js` | golpes, arco, daño recibido; los cuatro enemigos y su máquina de estados |
| `historia.js` | el faro, los barcos, las cartas y los capítulos |
| `mercader.js`, `mapa.js` | la tienda; el mapa y el tesoro |
| `personaje.js`, `paisaje.js` | el náufrago de la tercera persona; gaviotas, luciérnagas y peces |
| `mano.js`, `pesca.js`, `objetos.js` | lo que tenés en la mano; la boya; lo tirado en el piso |
| `particulas.js`, `luces.js`, `sonido.js` | astillas y destellos; las 4 luces más cercanas; todo el audio |
| `hud.js`, `menu.js`, `guardado.js`, `idioma.js` | la interfaz, el menú 3D, `localStorage`, es/en/pt |
| `intro.js`, `logojxs.js` | la intro de JXSTUDIOS en 3D, con escena y cámara propias, a resolución completa y liberada al terminar; el monograma son los mismos 4 trazos de Cripta Neón y Víbora.io, muestreados y hechos tubos |

Para probar sin menús: `?directo` entra a jugar, `?pausa` frena el bucle y
`window.__isla.paso(dt, dibujar)` avanza a mano. `?pausa`, `?cam` y `?sinintro`
saltean la intro de JXSTUDIOS, salvo que también vaya `?intro`. También están `?nueva`
(ignora lo guardado), `?idioma=en`, `?hora=0.9`, `?calidad=0-2`,
`?semilla=`, `?cam=x,y,z&mira=x,y,z` (cámara fija) y
`?menuToma=a,b,alto,ma,mb`, que prueba una toma del menú.

## Lo que falta

- Medirlo en un teléfono de verdad y ajustar las calidades con esos números
  (con el reflejo y el pasto nuevo son 800 mil triángulos en la playa).
- La isla que se juega es la semilla 20260929, la única mirada en detalle. En
  las semillas 1 y 7 el barco roto queda en una loma, a 2 m de altura, en vez
  de en la arena; en la 123456 queda medio en el agua y el jugador aparece con
  los pies en el agua.
- Los golpes no miran paredes: en la mina se le puede pegar a algo a través de
  una esquina (sin comprobar si se nota jugando).

# LA ISLA — supervivencia en una isla pixelada

La isla de los videos de **Phoenix Baker (@vfx843)**, rehecha en HTML con
three.js a partir de lo que se ve en su perfil: una isla tropical en 3D con
pinta de pixel art. Se juntan ramas y piedras, se talan palmeras, se pican
rocas de a pedazos, se pesca en el muelle, se cava con la pala, se construye
con bloques y se baja a una mina a buscar gemas y cosas raras. El menú es el
de la otra idea que pasaste, la de **@brutu_scripts**: la cámara se mece con el
mouse y vuela a carteles que están en la isla. Mantuve su mecánica y cambié el
estilo, que en vez de metal y neón en la oscuridad es la playa del juego.

    python3 -m http.server 8123          # desde la raíz del repo, y abrir http://127.0.0.1:8123/isla/
    sh pruebas/correr.sh                 # 32 + 6 comprobaciones
    python3 empaquetar.py                # arma isla-en-un-archivo.html (982 KB, abre con doble clic)

Texturas, modelos, íconos, música y sonidos salen todos del código: no hay ni
una imagen ni un audio de archivo. En español, inglés y portugués.

---

## Lo medido

29/09/2026, Chromium sin placa de video (SwiftShader), 960×540 salvo aclaración.

| qué | cuánto |
|---|---|
| comprobaciones | **32/32** en `pruebas/juego.mjs` y **6/6** en `pruebas/un-archivo.mjs` |
| carga hasta la sonda | 514-693 ms (módulos) · 427-453 ms (archivo único, desde `file://`) |
| lógica de un cuadro, sin dibujar | **0,23 ms** (el presupuesto de 60 cuadros es 16,7 ms) |
| en la playa | 349.846 triángulos, 124 llamadas de dibujo |
| en la mina | 64.588 triángulos, 17 llamadas |
| partida guardada | 3,0 KB en `localStorage` (solo lo que cambió contra la semilla) |
| archivo único | 982 KB: 30 módulos + three.js r160, ningún archivo suelto |
| talar una palmera con hacha de piedra | 5 golpes, 2,2 s |
| la pala | sube 1,3 m en 1,5 s y gasta 1 piedra cada 0,35 m³; bajar la devuelve |
| la mina | laberinto de 54×54 m a 60 m bajo la isla, 42 vetas (5 raras) y 22 faroles |

**Sin comprobar:** cuántos cuadros da en un teléfono de verdad. SwiftShader
dibuja con el procesador, así que sus tiempos de dibujo no dicen nada de una
placa. La calidad BAJA (sombra de 1024, la mitad de pasto y un píxel más
grande) arranca sola en los aparatos táctiles.

## Cómo se juega

| | teclado y mouse | dedos |
|---|---|---|
| moverse, correr | WASD / flechas, Shift | palanca (a fondo corre) |
| mirar | mouse (clic para capturarlo) | arrastrar en la pantalla |
| golpear, talar, picar, cavar, pescar | clic izquierdo (mantener) | ⚒ |
| poner un bloque, abrir mesa o cofre | clic derecho | ▣ |
| juntar, entrar a la mina, descansar | E | E |
| saltar, subir nadando | Espacio | ▲ |
| mochila, mesa, colección | Tab / I | ☰ |
| elegir en la barra | 1-9, rueda | tocar la ranura |
| tirar (la pila entera) | Q (Shift+Q) | — |
| comer | F | — |
| pincel de la pala | R | los botones de colores |
| pausa | Esc | II |

La primera partida se guía sola con objetivos: juntar ramas y piedras, hacha,
palmera, mesa, pico, hierro, farol, mina, pico de hierro y completar la
colección.

## Qué hay (lo que muestran los videos)

- **La isla sale de una semilla:** terreno con cerro, laguna, playas y
  senderos; 170 palmeras, 260 matas, 140 helechos, rocas y pasto denso que se
  mueve con el viento; la choza de paja, el muelle y la boca de la mina.
- **El look pixel en 3D:** cada fragmento busca el centro de su texel en el
  espacio del mundo (con derivadas) y ahí calcula textura, luz y sombra. Por
  eso las sombras de las hojas caen en la arena en cuadraditos, como en los
  videos, en vez de salir suaves (`js/material.js` › `hastaCentro`). El píxel
  de pantalla es de escala entera (`image-rendering: pixelated`).
- **El agua** en turquesa, más oscura en lo hondo, con espuma en la orilla y
  destellos. Todo flota, "así no perdés cosas en el mar", como dice el autor.
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
- **16 recetas**, 3 a mano y 13 con mesa de trabajo cerca.
- **Construir** en una grilla de 1 m con holograma cian (rojo si no entra):
  madera, piedra, tablones, mesa, cofre de 27 ranuras y farol de pie.
- **La pala** con seis pinceles (subir, bajar, aplanar, suavizar, arena y
  pasto) y un anillo que se pega al terreno; **la guadaña** corta el pasto y
  deja tierra.
- **Pescar** como en Minecraft: la boya se hunde y hay un segundo para tirar.
  De noche salen más peces abisales y con la caña dorada, más tesoros.
- **Día y noche** en 20 minutos, con estrellas que caen cerca de noche (dan luz
  propia; una de cada diez es un fragmento de cielo). En la choza se descansa
  hasta el amanecer.
- **La mina:** laberinto con vigas, rieles y faroles colgados; la niebla negra
  se come lo lejano y sin farol se ve poco. Lo raro está lejos de la escalera y
  pide pico de hierro.
- **Sonido sintetizado:** golpes de piedra y de madera, metales, gemas que
  suenan a vidrio, pasos distintos en arena, pasto, madera, piedra y agua,
  olas, pájaros de día, grillos de noche, gotas en la mina y una marimba sobre
  cuatro acordes fijos.
- **Guardado** automático cada 40 s, al pausar y al cerrar la pestaña.

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
la playa no se cae a la mina cuando bajás.

| módulo | qué hace |
|---|---|
| `material.js` | la luz pixelada compartida (`LUZ`) y los materiales `uv`, `mundo`, `liso` y terreno |
| `terreno.js` | alturas, materiales (pasto/tierra), pincel de la pala, diferencias para guardar |
| `cielo.js`, `agua.js` | domo, nubes, sol y luna, sombra que sigue al jugador de a un texel; el mar |
| `vegetacion.js`, `pasto.js`, `rocas.js` | palmeras, matas, helechos, pasto por chunks, rocas de a pedazos |
| `estructuras.js`, `mundo.js` | choza, muelle, boca de mina; arma la isla desde la semilla |
| `mina.js` | el laberinto de abajo y su choque |
| `items.js`, `gemas.js` | los 50 ítems (datos, íconos 16×16 y modelos) y sus materiales especiales |
| `inventario.js`, `construir.js` | pilas y recetas; bloques, cofres y holograma |
| `jugador.js`, `entrada.js` | caminar, nadar, coyote y buffer de salto; teclado, mouse y dedos |
| `acciones.js` | todo lo que hace la mano, la tecla E y las estrellas que caen |
| `mano.js`, `pesca.js`, `objetos.js` | lo que tenés en la mano; la boya; lo tirado en el piso |
| `particulas.js`, `luces.js`, `sonido.js` | astillas y destellos; las 4 luces más cercanas; todo el audio |
| `hud.js`, `menu.js`, `guardado.js`, `idioma.js` | la interfaz, el menú 3D, `localStorage`, es/en/pt |

Para probar sin menús: `?directo` entra a jugar, `?pausa` frena el bucle y
`window.__isla.paso(dt, dibujar)` avanza a mano. También están `?nueva`
(ignora lo guardado), `?idioma=en`, `?hora=0.9`, `?calidad=0-2`,
`?semilla=` y `?menuToma=a,b,alto,ma,mb`, que prueba una toma del menú.

## Lo que falta

- Medirlo en un teléfono de verdad y ajustar las calidades con esos números.
- Una tienda para vender lo juntado (tus últimos juegos la tienen; acá la plata
  por ahora solo mide el patrimonio).
- La isla que se juega es la semilla 20260929, la única mirada en detalle.
  Otras cinco (1, 7, 42, 99999 y 123456, con `?semilla=`) arman la isla sin
  errores, con choza, muelle, mina, 170 palmeras y 42 vetas abajo. En la
  123456, el jugador aparece con los pies en el agua. Ninguna de esas cinco se
  miró en pantalla.

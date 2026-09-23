# Juegos

La receta visual completa está en `GUIA-JUEGOS.md`: abrila por sección, y la
`§ 11` son las trampas. Ver también: [rezona](rezona.md), [maquina](maquina.md)
(para probar), [higgsfield](higgsfield.md). El catálogo de carpetas está en el
[índice](INDICE.md).

## Cómo se hacen acá

- **Pedidos fijos del dueño (23/09):**
  - Siempre una pantalla de idioma (español, inglés, portugués) antes del
    menú, y el juego entero traducido.
  - Cada juego con su propio estilo de menú, botones, orden y transiciones.
  - Cada juego nuevo, bastante mejor que el anterior en animaciones y efectos.
    Antes de empezar uno, mirá qué tenía el último y subí la vara.
- Web y para el teléfono primero: una mecánica pulida antes que muchas.
- Cuando piden HTML, un solo archivo que abre con doble clic y anda sin
  internet. Ya lo tienen `pique/`, `perro/`, `flores/` y `bosque/`
  (`*-en-un-archivo.html`).
- Para el HTML único, three.js se empaqueta con esbuild en un IIFE, y cada
  textura y modelo va como `data:` URI y sin `fetch`: los GLB con `atob` y
  `parse`, y las texturas como `<img>`. Receta: `bosque/herramientas/armar.mjs`.
- Los assets generados se buscan por nombre y tienen su reemplazo dibujado o
  sintetizado (`enjambre/`, `perro/`). Así Rezona puede estar caído sin trabar
  el juego.
- En `pique/`, `pique2d/` y `espejo/`, los niveles los comprueba una máquina
  antes de publicarse.

## El bosque (22/09/2026)

- Código en `bosque/js/`:
  - `main` es el lazo;
  - `cielo` hace la luz y la niebla;
  - `arboles` son procedurales, con tarjetas de foto y tres niveles de detalle;
  - `flora`, `terreno` y `agua`;
  - `personaje`, `camara` y `control`;
  - `post` es el VHS, `audio` es todo sintetizado y `cintas` es el objetivo.
- Herramientas en `bosque/herramientas/`:
  - `procesar_assets.py` (texturas, recortes, cielo);
  - `optimizar_modelos.mjs` (gltf-transform);
  - `armar.mjs`;
  - `higgsfield.json`.
- Armar: `cd bosque && npm ci && node herramientas/armar.mjs`. Deja `dist/`
  para Rezona, con los assets en `dist/datos/`, y `bosque-en-un-archivo.html`
  de 12,1 MB.
- Jugar: `rezona.ai/game/pgcserver/play/VvyVJutbOf` (v1) o el HTML único.
- Medido en calidad alta: de 310 a 760 mil triángulos y de 60 a 74 llamadas de
  dibujo por cuadro. **Los FPS en un teléfono de verdad no están medidos.**
- Pruebas: `pruebas/cintas.mjs` (la partida entera, 26 comprobaciones),
  `un-archivo.mjs` y `ver.mjs`.

## Los 2D en pixel: `motor2d/`, `zonda/`, `luz-mala/` (22/09/2026)

- `motor2d/` es el motor compartido. Son scripts sueltos: `base`, `idioma`,
  `pantalla` (escala entera), `entrada` (teclado, dedos, palanca y mando),
  `sonido` (sintetizado), `fuente`, `sprites`, `fx`, `bucle` (60 Hz fijos),
  `ui` y `ui.css`. `ui` y `ui.css` (botones de 16 bits) son de ZONDA: cada
  juego nuevo trae su propia interfaz.
- Armar un juego: `node motor2d/armar.mjs <juego>`. Lee `<juego>/juego.json` y
  `<juego>/index.html` (con `<!--CSS-->` y `<!--JS-->`), mete todo en un IIFE y
  revisa la sintaxis con `vm`. Si falla, dice el archivo y la línea.
- **ZONDA** está terminado: tipo Celeste, 20 salas y 19 cartas. Cómo se
  comprueba, en `zonda/README.md`.
- Lo aprendido con el resolvedor:
  - La física tiene que ser pura (nada de `Math.random`) para que Node use el
    mismo código que el juego.
  - La clave de "ya visto" lleva **todo** lo que cambia el futuro. Sin el
    estado de la carta, las cartas daban "inalcanzable" en falso.
  - La heurística es la distancia BFS por la grilla hasta la meta. Con la
    altura sola, se trababa en las salas que van de costado.
  - Nunca correr dos resolvedores a la vez: los dos escriben
    `soluciones.json` y gana el último.
  - Encontró dos errores de física que un humano tarda en ver:
    - el viento la empujaba contra las púas sin matarla (la dirección de la
      púa tiene que contar el viento);
    - la corriente para arriba la despegaba del piso al aterrizar.
- Pruebas en Chromium:
  - `partida.mjs` repite las soluciones cuadro por cuadro en el HTML.
  - `manos.mjs` toca con dos dedos por CDP (`Input.dispatchTouchEvent`).
  - El mando simulado (`navigator.getGamepads` pisado) se lee en cada
    `requestAnimationFrame`: hay que esperar tiempo real, `anda(n)` no alcanza.
- **LUZ MALA** está terminado: tipo Silksong, 9 salas en coordenadas del mundo y
  3 jefes. Cómo se comprueba, en `luz-mala/README.md`.
- Lo aprendido con LUZ MALA:
  - Un resolvedor de recorridos junta las salas vecinas en un solo mapa y
    comprueba cada tramo con las habilidades de ese momento. También comprueba
    lo contrario: sin el aleteo, el túnel no se cruza.
  - En el juego, cada sala tiene que ver un anillo de baldosas de sus vecinas.
    Si no, al cruzar un borde se atraviesan paredes que el resolvedor sí ve.
  - Nada de "empujones" al pasar de sala que el resolvedor no conozca: la
    física tiene que ser la misma de los dos lados.
  - Para repetir una solución en el HTML, empezar y cargar la repetición en
    UNA sola llamada a `evaluate`. Entre dos llamadas, el `requestAnimationFrame`
    corre cuadros sin la repetición y se desfasa.
  - Correr un tramo con `--guardar` pisaba los demás; ahora combina.
  - Para ver si un jefe se puede ganar sirve un bot con tácticas por jefe.
    Primero hay que depurar el bot: medía la distancia al centro del jefe sin
    contar el ancho y se metía adentro. Recién después se ajusta el jefe.
- Idiomas (23/09/2026):
  - `motor2d/idioma.js`: `Idioma.iniciar(clave, tablas)` toma el idioma del
    navegador la primera vez y después el último elegido; `tr(k, ...)` llena
    `{0}`, `{1}`.
  - La pantalla de idioma sale siempre, antes del menú, con el último marcado.
  - `motor2d/fuente.js` ya tiene Â Ã À Ê Ô Õ Ç.
  - Cada juego tiene `pruebas/idiomas.mjs`: pantalla primero, idioma del
    navegador, letras que faltan (`letrasQueFaltan`, sin los `{n}`) y textos.
- Lo que tiene LUZ MALA desde el 23/09 (el piso para el próximo juego, que
  tiene que superarlo sin copiarlo):
  - menús dibujados en el lienzo, sin botones: palabras que se prenden y dos
    luciérnagas de cursor (`luz-mala/js/menus.js`);
  - letra fina propia con minúsculas y halo (`letra.js`); los textos de los
    tres idiomas, en `textos.js` (`TX()`);
  - el idioma se elige con faroles colgados; portada con estero que refleja
    todo y juncos; la intro dibuja con luz una imagen por frase;
  - transición de iris de luz; oscuridad suave con degradés (no la trama de
    ZONDA) y brillo sumado; los ojos de los bichos brillan en lo oscuro;
  - Chispa: carrera de 6 cuadros, respira, se sacude las alas, golpe en 3
    tiempos con la espina, estela de la cola; congelado corto al pegar;
  - afuera de cada sala, 16 baldosas de madera con anillos: en el teléfono
    parado la sala no flota en negro.
- Lo aprendido al rehacer LUZ MALA (23/09):
  - Menús en el lienzo y pruebas: `__L.menu()` dice qué hay y `__L.donde(id)`
    dónde tocar, en píxeles de la ventana; se toca con `pag.touchscreen.tap`.
  - Lo que se apaga o crece mientras se dibuja usa `Reloj.d` y no `DT`: con
    `DT`, en una pantalla de 120 Hz va al doble y con `anda(n)` no avanza.
  - Nada de lógica en el dibujo: el farol elegido se confirmaba al dibujar y
    las pruebas perdían el toque siguiente. Ahora está en `Menu.pasar`.
  - `__L.empezar(id)` sin `en` pone a Chispa en (16,16), que en R1 es pared.

# Los Montes — survival horror 3D

"Estamos entrando en un lugar donde nadie debería estar."

Seis personas subieron a Los Montes hace nueve días. Un rescatista (ex marine) llega
de noche al valle: montañas nevadas, pinos, cascadas, un lago, cabañas con luz… y los
montañeses, que cazan, ponen trampas y se llevan gente a la mina, a la cueva y al
campamento. Hay que encontrar a los secuestrados, llevarlos al refugio, arreglar la
camioneta de la grúa, despejar la ruta y escapar por la tranquera del sur.

Jugar: `https://raw.githack.com/juniorspro/new-general-games-assets/claude/papa-del-patron-3cpe64/los-montes/index.html`
(githack muestra "One more step": tocar **Open the page**).

## Qué tiene

- Idioma (español, inglés, portugués) antes del menú; menú con partida, cooperativo,
  personaje (rol), diario de pistas, récords, opciones, ayuda y créditos.
- Intro: sobrevuelo del valle con viento y bosque, baja hasta las cabañas.
- Solo, con compañeros de la computadora (1 a 3) o cooperativo en red (sala de
  claude.ai o pestañas del mismo navegador). Roles: médico, explorador, combatiente,
  mecánico, superviviente.
- Montañeses: cazador, rápido, vigía (toca la campana), bruto, trampero (pone trampas
  de oso), líder (llama refuerzos). Algunos solo miran desde los árboles o apagan las
  luces de las cabañas. Un "director de miedo" administra la tensión: ramas, figuras,
  pasos, susurros, huellas, gritos lejos, puertas.
- Lugares: claro con cabañas, cabañas que por fuera parecen normales, lago con
  acantilado y cascadas, mina con túneles, cueva detrás de la cascada chica, aserradero
  con la jaula colgada, cementerio, campamento, torre caída, tranquera.
- Camionetas abandonadas: la de la grúa se arregla (herramientas + batería, rueda y
  bidón) y se maneja; la grúa saca los troncos de la ruta y baja la jaula colgada. Otra
  tiene el motor todavía caliente.
- Recursos: munición, botiquín, vendas, baterías de linterna, latas, herramientas,
  repuestos, armas (hacha, pistola, escopeta, rifle).
- 12 pistas que cuentan de dónde viene todo (1958 → hoy); el final cambia según a
  cuántos sacás y si las leíste todas.
- Celular: gira 90° solo si está vertical (sin pantalla completa), controles táctiles.
- Sonidos grabados (114, CC0 y CC-BY: `sonidos/los-montes/CREDITOS.md`).

## Controles (PC)

WASD mover · Shift correr · C agacharse · mouse mirar · clic derecho apuntar · clic
disparar · V golpe · E usar (mantener en las acciones largas) · F linterna · R recargar ·
Q curarse · 1–5 armas · Tab inventario · M mapa · Esc pausa. En la camioneta: WASD,
F faros, H bocina, G grúa (WASD gira y sube, Q/R cable, E engancha), X bajar.

## Cómo está hecho

three.js r160 + React 18 (UMD), archivos clásicos en `js/` (orden en `index.html`):
`base` (mapa, opciones, giro), `textos` (ES/EN/PT), `terreno`, `colision`, `modelos`,
`mundo` (cielo, niebla por altura, cordillera, agua, cascadas, bosque con impostores),
`lugares`, `personajes`, `sonido`, `enemigos`, `aliados`, `vehiculos`, `director`,
`red`, `juego`, `ui`.

Modelos 3D: Rezona (Tripo), 44 GLB en `js/datos.js` y `js/datos-personajes.js` (13 MB).
Rehacerlos: `herramientas/rezona/` (pedidos y `estado.json`, que evita pagar dos veces),
`herramientas/gltf/optimizar.mjs` → `herramientas/procesar.py` (texturas a JPEG) →
`herramientas/armar_datos.py`. Tamaños y giros medidos en tiras de 4 vistas: tabla
`AJUSTES` de `js/modelos.js`. Si falta un modelo, el juego arma su reemplazo por código.

## Pruebas

```sh
python3 herramientas/descargable/empaquetar.py los-montes/index.html $S/los-montes.html
PW=$(npm root -g)/playwright S=$S node los-montes/prueba.mjs pc|tel|vertical [es|en|pt]
PW=$(npm root -g)/playwright S=$S node los-montes/prueba-completa.mjs
```

`prueba.mjs` saca fotos de carga, idioma, menú, intro y juego; `prueba-completa.mjs`
juega la partida entera por la API (objetos, pistas, jaulas, refugio y guardado,
arreglo, manejo, grúa, mina, cueva, tranquera, fuga, continuar y muerte).

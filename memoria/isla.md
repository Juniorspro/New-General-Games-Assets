# La isla — supervivencia pixel en 3D
Qué quedó en `isla/`, cómo se hizo y lo que se pagó. Ver también: [juegos](juegos.md), [juegos-3d](juegos-3d.md), [probar](probar.md). Detalle: `isla/README.md`.

## El pedido (29/09/2026)
- "Recreá el juego de la isla, entrá al perfil y mirá todo": la isla de Phoenix Baker (@vfx843). Se vieron 30 videos del perfil (las hojas de contacto quedaron fuera del repo).
- "Un menú que me gustaría en los juegos nuevos": el de @brutu_scripts (Roblox), pero "no estilo metálico neón, sino como el de playa". Es para reusar en los juegos que vienen.

## Lo que sirve para otros juegos
- Pixel art en 3D sin post: cada fragmento se corre al centro de su texel en el mundo (derivadas) y ahí se calculan textura, luz y sombra; las sombras salen en cuadraditos. → `isla/js/material.js › hastaCentro`
- Menú con cámara que se mece: tope 18°, vaivén 1,5° con seno y coseno, velocidad 3; el texto DOM se inclina con la misma inclinación. → `isla/js/menu.js` (comentario de arriba)
- Pantallas en el mundo: carteles con `CanvasTexture`; un clic es un rayo a la cara → `uv` → coordenada del lienzo. En la pausa se muestra el MISMO lienzo plano. → `isla/js/menu.js › tocarCartel`
- La toma del menú: una lista elegida mirando capturas y gana la primera con "aire" (sin rocas ni palmeras en el cono); el teléfono parado tiene su lista. → `menu.js › ubicar`
- Vuelo del menú al juego: se apaga el meneo durante el vuelo y la última imagen del menú es la primera del juego. → `menu.js › entrar`
- Física por un intermediario que decide por la ALTURA del que pregunta (y < −30 es la mina), no por dónde está el jugador. → `isla/js/main.js › fisica`
- Guardar solo lo que cambió contra la semilla: 3,0 KB con terreno tocado, palmera talada, cofre y bloques. → `isla/js/guardado.js`
- Tres idiomas en una tabla; los nombres de ítems son getters; `t()` deja las marcas no pasadas (`+{n} Madera` la completa la notificación que va sumando). → `isla/js/idioma.js`
- Empaquetador con orden topológico sacado de los `import` (una lista a mano se desactualiza sola). → `isla/empaquetar.py`

## Trampas pagadas (29/09/2026)
- `null` como "nada pendiente" en la mano: `poner(null)` (mano vacía) no se armaba nunca. Se usa `undefined`. → `isla/js/mano.js`
- Una rama en el piso ganaba la mira y tapaba la celda de construcción: la celda sale del rayo de bloques y terreno aparte. → `acciones.js › apuntar`
- El color inline de un botón pisa la clase `.sel`: resaltar con borde y sombra.
- Llamar a una función que lee un `const` antes de declararlo revienta (zona muerta), aunque sea con `J && …`.
- Las rocas grandes de la orilla salían en todas las tomas del menú: se sacaron en 18 m alrededor de la choza. → `isla/js/mundo.js`
- Herramientas en primera persona: con el pivote en el ojo, el mango se ve como una tabla gigante. El pivote va en el puño, fuera de cuadro abajo a la derecha. → `isla/js/mano.js › POSE`

## Lo medido (29/09/2026, SwiftShader, 960×540)
- 32/32 (`isla/pruebas/juego.mjs`) + 6/6 (`un-archivo.mjs`); lógica 0,23 ms por cuadro; playa 349.846 triángulos y 124 llamadas; mina 64.588 y 17.
- Archivo único de 982 KB; carga en 427-453 ms desde `file://`. Otras 5 semillas sin errores (sin mirarlas en pantalla).

## Pendiente
- Medir en un teléfono de verdad; tienda para vender lo juntado; revisar otras semillas en pantalla.

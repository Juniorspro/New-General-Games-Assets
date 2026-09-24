# Estancia — La Ley del Monte

Simulador de estancia en el monte chaqueño, M+18, en three.js (r160). Se abre
`index.html` o el HTML empaquetado; anda desde el disco (`file://`) y sin
internet. Receta seguida: `GUIA-JUEGOS.md`.

## Controles

| tecla | qué hace |
|---|---|
| WASD / flechas, ratón | caminar o andar a caballo, mirar |
| Shift / C | galope / al paso (a caballo) |
| E | la acción de lo que se tiene cerca (montar, mate, catre, manga, tranquera…) |
| 1 o L | sacar el lazo |
| clic sostenido / soltar | revolear / tirar; clic derecho: cobrar |
| (revoleando, con una vaca adelante) | ojo de águila: todo gris y lento, la mira se cierra sobre la cabeza; soltá con la mira roja y el tiro va guiado |
| P | pialar (en la ventana de la aguja) |
| V | primera o tercera persona |
| H | silbarle al caballo |
| F | armarse un cigarro |
| G / X / J / B | perros: vengan / quietos (se echan) / junten la tropa / busquen la vaca que mirás |
| M | el mapa: tocá un lugar (casco, corral, comedero, aguada, estero, pueblo, el zaino, la agusanada) y aparece una columna de luz y la brújula; abajo a la derecha, el minimapa |
| Enter o / | el chat de comandos (/ayuda, /saludar, /perros junten, /mate, /comer, /caballo, /hacienda, /razas…) |
| 1–4 en la manga | aftosa, ivermectina, caravana, hierro |

En el celular: palanca a la izquierda, mirar a la derecha, botones en pantalla
(el de "Perros" va pasando de orden en orden; el globito de arriba abre el chat).

## La estancia

- **Hacienda**: 18 vacas de seis razas (Hereford, Aberdeen Angus, Angus
  colorada, Brahman, Braford, Criolla overa), 2 toros Angus y 6 terneros al pie
  de la madre. Las razas salen de la textura de la Hereford recoloreada en el
  shader (`modelos.js`, `conPelaje`); el toro es su propio modelo.
- **El rodeo grande** (`js/rodeo.js`): 500 vacas, 20 toros y 400 terneros en
  nueve rodeos por el campo. Todos se simulan (pastan, se echan a la siesta,
  huyen de uno y de los perros, el ternero sigue a la madre); se dibujan con un
  modelo liviano instanciado que camina por shader, y los de cerca toman el
  modelo de Rezona (4 a 20 según la calidad; en ultra baja, ninguno). No se
  enlazan ni cuentan en la plata: la hacienda de trabajo es la de abajo.
- **Perros**: Tigre, Negra y Chispa (`js/perros.js`). La hacienda se aparta de
  un perro como de uno: arrean empujando.
- **El puesto** (`js/puesto.js`): mates en la galería, guiso en el fogón, agua
  fría de la heladera. **El zaino** se ensucia andando; bañarlo en el tanque y
  darle forraje en el comedero. Si no, al otro día amanece flaco o con
  mataduras.
- **El encierre** (`js/comedero.js`): corral de tablas con un comedero de
  hormigón sobre pilares de ladrillo, silo de maíz picado y dos hilos de
  alambre, como en un feedlot. Adentro, 8 novillos de engorde: cargarles el
  comedero (desde la calle de carga, al lado de la silobolsa) todos los días o
  bajan de kilos. Con comida en la batea, la tropa de cerca también viene.
- **El pueblo**, Paraje El Quebrachal (`estancia.js`, `pueblo()`): afuera de la
  tranquera de entrada, al final del camino (se abre con E, también a
  caballo). Almacén de ramos generales (provisiones, un lazo), capilla,
  comisaría, casitas, tanque de agua, surtidor y palenque.
- **El mapa** (`js/mapa.js`): el terreno visto desde arriba se dibuja una vez al
  cargar; la hacienda, los perros y uno encima, en vivo. `/mapa` e `/ir corral`
  en el chat.
- **El lazo** se enrolla solo cuando no se usa: al cinto a pie, en el recado a
  caballo.

## Calidad gráfica

La primera vez que se abre, antes de la portada, el juego dibuja el rancho, el
corral, el monte y la tropa en calidad alta y mide los cuadros por segundo del
lugar más pesado (`js/calidad.js`). Antes del menú se puede tocar otro nivel;
**Ultra baja** (para equipos flojos) apaga las sombras, deja las plantas quietas,
casi saca el pasto y agrega luz de relleno para que no quede oscuro; el
escaneo la elige solo si ni en baja llega a 20 cuadros. Con 55 o más prueba ultra (se queda si da
50); con 40 queda en alta; entre 22 y 40 prueba media (35 para quedarse); si
no, baja. Cada nivel cambia la resolución interna, el techo de píxeles en
pantallas retina, el mapa de sombras y la densidad del pasto. Queda guardado;
en Opciones se cambia a mano o se vuelve a medir.

## De dónde sale cada cosa

| qué | de dónde | archivo |
|---|---|---|
| suelo, pasto, corteza (+ normales) | Higgsfield, hechas repetibles con `herramientas/procesar_texturas.py` | `js/datos.js` |
| vaca, caballo, guacho, chata, rollo (GLB) | Rezona: modelo 3D + esqueleto (`rig3d`), texturas bajadas a JPEG 1024 | `js/datos.js`, `rezona.json` |
| caminata de vaca y caballo; quieto, caminar y correr del guacho | Rezona `rig3d` (una animación por pedido) | idem |
| revoque, chapa, tablas, barro (+ normales) | Rezona, imagen → `herramientas/procesar_rezona.py` | idem |
| ramas de quebracho, algarrobo y vinal; matas de espartillo | Rezona con fondo transparente, recortadas y sangradas | idem |
| la voz del Guacho (61 frases, sin malas palabras) | Higgsfield `qwen_audio_tts`, voz Julian con instrucción de acento rioplatense; 24 kHz, 64 kbps, -18 LUFS | `voces.json` |
| perro, toro (con esqueleto), heladera, silla, pava | Rezona: imagen → modelo 3D → `rig3d` (`herramientas/rezona_perro_toro.py`); la mesa vino rota y quedó la de tablas | `js/datos.js` |
| el silbido del Guacho | sintetizado en `js/sonido.js` (dos notas de silbido humano, con aire y vibrato) | — |
| viento, chicharras, teros, mugidos, lazo, radio | sintetizado en `js/sonido.js` | — |

Lo que no está (música, efectos grabados): Rezona devolvió "servicio no
disponible" toda la noche del 23/9, sin cobrar; Higgsfield no deja usar sus
modelos de música y efectos fuera de su propio generador de juegos. Queda el
sonido sintetizado.

Cada modelo tiene su plan B: si un GLB no carga, el animal armado por código
aparece en su lugar. Ese animal de código sigue estando, invisible: es el
esqueleto lógico que usan el lazo, la manga y la cura.

La vaca y el caballo no usan la caminata de Rezona: se mueven con
`js/marcha.js` (paso, trote y galope por código, con IK en las patas, y las
posturas: pastar, echada, tumbada, muerta, tirando del lazo, en el cepo).
El Guacho sí usa sus clips (quieto, caminar, correr), sin avance de raíz y a
la velocidad medida del clip.

Pruebas cuadro a cuadro: `herramientas/pruebas/LEEME.md`.

## Rearmar

```sh
# 1. meter assets nuevos en js/datos.js (conserva lo que ya estaba)
python3 herramientas/armar_datos.py carpeta-con-assets/
# 2. el HTML de un solo archivo
python3 ../herramientas/descargable/empaquetar.py index.html estancia.html
```

`js/datos.js` pesa 13,5 MB (los GLB van comprimidos con gzip) y el HTML
empaquetado 14,4 MB (24/9/2026). El límite de un artifact es 16 MB.

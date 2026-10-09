# Truco (Blyts) → web y APK

El Truco de Blyts (`com.blyts.trucolite.activities` 6.0.352, el de Google Play) corre en el
navegador y en un APK nuevo, **sin internet y sin publicidad**, con sus dibujos, sus cartas, sus
voces, su música, sus textos y los personajes de la Gira Nacional.

El original es Unity con **IL2CPP**: el código del juego está compilado a ARM y no se puede pasar a
la web (PORTEO.md §4.2). Lo que sí se aprovecha es todo lo demás, que sale del APK del dueño con
`armar-datos.py`; las reglas, la computadora y las pantallas están rehechas acá, con las medidas de
las escenas del original (el escenario es de 1200 de ancho, como su `CanvasScaler`).

El juego no está en el repo (es público): `portear.sh` lo arma desde el APK.

| archivo | qué es |
|---|---|
| `portear.sh` | del APK a la entrega: web instalable, zip, `.html` único y APK, en un comando (~1 minuto) |
| `armar-datos.py` | saca del APK los 6 mazos, las mesas de las regiones, las caras de los 202 personajes, sus 12 voces, los efectos, la música, 146 sprites de la interfaz (con sus bordes de 9 partes), las letras, los textos en castellano (`lang_es.json`) y los personajes (`players_es`); WebP y MP3, el mismo APK da los mismos bytes |
| `truco.js` | las reglas del truco argentino (envido, flor, truco, pardas, mazo, falta, 1v1/2v2/3v3), sin pantalla: se prueban en Node |
| `truco-ia.js` | la computadora: ve lo mismo que vería un jugador sentado a la mesa, reparte al azar lo que no ve y juega cada reparto hasta el final; tiene la personalidad de cada personaje (mentiroso, pescador, de muy pasivo a muy agresivo) |
| `juego.js` | las pantallas: menú (Inicio, Jugar, Extras), Gira Nacional (mapa, regiones, personajes), anotador, ayuda, perfil, mazos, créditos y el panel de ajustes; el sonido |
| `mesa.js` | la mesa (GP1v1, GP2v2, GP3v3): el reparto, la mano con los dedos, las cartas a la mesa, los globos con las frases de cada personaje y su voz, el tanteador de palitos, las barras de cantos y las ventanas del envido, la flor y el fin del partido |
| `estilos.css`, `index.html` | la carcasa |
| `prueba-reglas.js`, `prueba-ia.js` | las reglas (46) y la computadora (9: nunca hace algo ilegal, le gana casi siempre a uno que juega al azar, contra sí misma va pareja, decide en milisegundos) |
| `prueba.mjs` | la lista de PORTEO.md §9 con dedos de verdad (CDP), midiendo en el motor de reglas (45 puntos) |

```bash
porteos/truco/portear.sh Truco_Blytscom.blyts.trucolite.activitiesv6.0.352.apk entrega-truco
python3 -m http.server 8872 --bind 127.0.0.1 --directory entrega-truco &
node porteos/truco/prueba.mjs http://127.0.0.1:8872/truco/ entrega-truco/truco.apk file://$PWD/entrega-truco/truco.html
node porteos/truco/prueba-reglas.js && node porteos/truco/prueba-ia.js
```

## Qué hay

- **Partida rápida** contra la computadora: solo, 2 contra 2 o 3 contra 3 (en parejas y de a tres,
  sin flor, como en el original). Los rivales y los compañeros son personajes de la Gira al azar.
- **Gira Nacional**: el mapa con las 6 regiones (Buenos Aires, Cuyo, Patagonia, Mesopotamia, Norte
  y Malvinas, con los ingleses), cada una con su mesa, su bebida y su lista de personajes con sus
  puntos; se desafía a los de abajo y a los tres que están justo arriba. Cada partido suma los
  puntos del original (los del partido, victoria, partido completo, engaños de envido y de truco,
  zapatero, mejor posición, duerme afuera) y las regiones se destraban con puntos.
- **Anotador** de palitos, a 15 o a 30.
- **Academia/Ayuda**: las reglas del original (con las cartas en orden) y cómo se suman los puntos.
- **Ajustes** (el panel del costado, como el original): flor, a 15 o a 30, modo rápido o lento (en
  el rápido la computadora no hace comentarios), mostrar las cartas al final de la mano, sexo (la
  mano que sostiene las cartas), mazo, voces y cuál, música y efectos. **Perfil** con nombre.
- **Los personajes hablan**: cada canto con alguna de sus frases del original ("Si con el cuco no
  te asusto, entonces te canto ¡TRUCO!") y su voz; comentan cuando están por ganar o perder, cuando
  tenés flor, cuando muestran su envido, cuando se lucen; los ingleses de Malvinas se burlan en
  inglés. En parejas, el compañero a veces pregunta antes de cantar ("¿Canto el envido?"), y se le
  contesta **Cantá** o **Callado**, como en el original.
- **Créditos** del original (Blyts y la música), sin tocar.

**No está** lo que en el original necesita servidor: online, salas, torneos, ranking, chat, tienda
y monedas (todos los mazos están a mano). Tampoco Cataratas y Fragata (modos aparte del mapa), Pica
Pica, el orejeo, la trivia ni las reacciones animadas (Spine).

## Cómo está hecho

- **Las medidas** salen de las escenas del original (`GP1v1`, `GP2v2`, `GP3v3`, `Menu`, `Map`,
  `Region`, `Counter`): anclas, tamaños, posiciones, letras y colores de cada elemento, leídos de los
  `RectTransform` y de los componentes de UGUI. Los sprites con bordes de 9 partes van con
  `border-image`; los que son rectángulos blancos semitransparentes (las cápsulas del menú), con
  `border-radius`, porque Chromium deja una rayita en cada corte al escalar.
- **Las voces**: el juego trae 12 (original, porteña, tanguera, gauchesca, cordobesa, mesopotámica,
  interior —"vieja" en el APK— y británica; de hombre y de mujer) con varias tomas de cada canto. La
  voz de cada personaje es la de `players_es` (el `enum` del juego, en el mismo orden que las
  carpetas de `Sfx/Voices`).
- **Un solo archivo**: `un-archivo.py` atiende `fetch`, `<img>` y `<audio>`, no las `url()` que se
  ponen en un `style`: los fondos y la música se piden por `fetch` y se usan como `blob:`.
- **El atrás** del teléfono cierra la ventana de arriba o vuelve una pantalla; en el menú, dos
  seguidos salen (`web.js`: si el `atras` del juego devuelve `true`, no cuenta para salir).
- **Lo que se guarda**: los ajustes, la Gira, el anotador y el partido que se estaba jugando (al
  empezar cada mano y cada vez que alguien suma): al volver a abrir se ofrece reanudarlo.

## Problemas conocidos

- No se probó en un teléfono de verdad ni en Safari.
- Las reglas de desbloqueo de las regiones y los puntos de la Gira son los que describe la ayuda del
  original, pero los números exactos (cuántos puntos destraban cada región, cuánto vale una mentira)
  estaban en el código nativo: son nuestros.
- La computadora está rehecha: juega con la personalidad de cada personaje y las reglas que dejó el
  original en sus registros, pero no es su código.
- Firmado con la clave de esta sesión (PORTEO.md §7).

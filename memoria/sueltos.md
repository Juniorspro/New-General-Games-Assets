# Los seis de un archivo (GLOBO, VÍBORA, GRUMO, MORFI, LA ISLA, CRIPTA)

Llegaron hechos el 30/09, cada uno un solo HTML que abre con doble clic
(`<juego>/<juego>.html`). Pidió pasarlos a vertical como a BRILLO, KUNTUR y
RUTA 40. Ninguno trae audio ni imágenes ajenas (todo sintetizado o dibujado).

## Qué tenía cada uno con el celu parado (medido con capturas, 360/390/412 de ancho)

| juego | qué es | parado |
|---|---|---|
| GLOBO LIBRE | subir un globo cuidándolo con un escudo | ya nació parado; la frase de ayuda se cortaba a los costados (ahora se parte por palabras) y en Ajustes "Alta" quedaba sola abajo |
| VÍBORA.IO | tipo slither.io | ya andaba parado; nada que tocar |
| GRUMO | plataformas por escenas (tomas de cine) | ya andaba parado: la escena se encaja en la pantalla y abajo flechas y salto |
| MORFI | tipo Cut the Rope | ya nació parado |
| CRIPTA NEÓN | tipo Tomb of the Mask, pixel | ya nació parado; **error real**: `dibujarMarco` pedía `S.ANTORCHA[k % 3]` con `k = −1` → `undefined` → `drawImage` tiraba y ese cuadro se cortaba a medias (parpadeo). Ahora `((n % 3) + 3) % 3` |
| LA ISLA | supervivencia 3D (three) | se jugaba **girada 90°** con el teléfono parado: esa sí se porteó |

## LA ISLA parada

- `M_pantalla.medirPantalla(tactil, girar)`: solo gira si el ajuste `girar`
  vale 1 (Ajustes › CELU PARADO › VERTICAL / GIRAR, en 3 idiomas, guardado
  en `isla_ajustes`). `html.vertical` = la app más alta que ancha.
  `pedirAcostado(girar)` traba acostado solo con "Girar"; si no, solo pantalla completa.
- La cámara ya abría el fov parado (unos 53° de costado) y la intro ya
  encajaba el logo de ancho: no hubo que tocarlas.
- CSS `html.vertical`: barra de objetos abajo con `--ranura` que entra en 360;
  vida y hambre **acostadas** encima de la barra (paradas al costado la pisaban;
  el JS pone `--lleno` y no `height`); palanca y botones 18–26 px más arriba;
  la fila de arriba más apretada y, si igual no entra (`$99999`, armadura y
  `Día 99` en 360), la armadura baja a otra fila a la derecha (`row-reverse` +
  `order`: la pausa sigue en la punta); los pinceles bajan para no chocarla;
  menú con título grande arriba y opciones abajo (donde llega el pulgar).
- El cartel de ajustes (3D) a 2,75 m no entraba de ancho: parado se mira a
  3,25 m. `data-modo` en `#menu`: en ajustes y créditos "volver" va arriba.
- Al cambiar "Girar" con el cartel delante, el `resize` vuelve a poner la
  cámara en la vista del cartel (antes quedaba la de la otra orientación).
- Prueba: `node isla/pruebas/vertical.mjs` (toques CDP; caminar, mirar, saltar,
  girar y volver, nada fuera de pantalla en 360/390/412 y acostado).

## Trampas

- En SwiftShader LA ISLA va a pocos cuadros: el vuelo de la cámara al cartel
  (1,6 s en un teléfono) tarda ~20 s de reloj. Esperar a `!J.menu.vuelo`, no
  un tiempo fijo; si no, parece que la cámara "se mete en la choza".
- Los botones de los carteles 3D se tocan proyectando el punto del lienzo del
  cartel con la cámara (`cara.localToWorld` + `project`).

## Sin la intro de JXSTUDIOS (01/10)

Pidió los seis sin la intro del logo. En cada uno `conIntro = q.has('intro')`
(LA ISLA: `!directo && url.has('intro')`): arrancan en la elección de idioma
(la primera vez) o en el menú. Ojo: el camino sin intro iba directo a
`aMenu()`; ahora pasa por `elegirIdioma()` si no hay idioma guardado, porque
la intro era la que lo llamaba al terminar. `?intro` la vuelve a mostrar.

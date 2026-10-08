# Bad Parenting 1: Mr. Red Face → navegador

El juego de 2OO2 (gratis en itch.io, Unity 2022.2 para Windows) corriendo en el navegador del
teléfono: su IL original sobre nuestro UnityEngine en C# ([`herramientas/unity/motor`](../../herramientas/unity/motor)),
en .NET 10 para WebAssembly (AOT), con WebGL 2 y PhysX. Es el primer juego de PC del motor: los
shaders vienen compilados para Direct3D 11 y pasan a GLSL ES con HLSLcc (ver "Juegos de PC" en el
LEEME del motor).

**Estado:** el logo de 2OO2 (video), el menú, las opciones (idioma, brillo, filtro), la primera
escena entera (los diálogos se pasan tocando; al final el jugador queda libre), caminar, correr,
mirar y usar las cosas andan, probados en Chromium emulando un teléfono en vertical; las 13
escenas cargan y corren en la prueba de consola sin miembros faltantes. Las habitaciones (el
empapelado claro, el techo con la mancha de la lámpara, la alfombra, el acolchado) y el filtro
verde salen como en las capturas de itch.io. Falta jugarlo entero en un teléfono de verdad
(rendimiento, el resto de las escenas).

Lo que hubo que arreglar en el motor:

- Las luces de los objetos enormes. Las paredes (y pisos y techos) de toda la casa son una sola
  malla; el motor les buscaba luces sólo en la celda del centro y les llegaba únicamente la de la
  cocina: los cuartos salían casi negros. Ahora las elige como Unity (todas las que tocan la caja,
  por importancia en el centro, la principal y las Important dentro de pixelLightCount, sin las que
  quedan fuera de cámara): la lámpara del cuarto ilumina las paredes por vértice, parejas.
- Los personajes. Sus mallas no son legibles y el motor soltaba los vértices de la CPU al subirlas a
  la GPU, pero la piel se hace en la CPU: mamá, papá y el chico se dibujaban crudos en el espacio de
  la cadera, acostados y flotando. Las mallas con piel se quedan con sus vértices.
- Las señales de Timeline (la del final no se disparaba porque la raíz del grafo no tenía el modo
  del director, y Resume rearrancaba un director parado: el jugador quedaba sin control o la escena
  volvía a empezar) y el ratón con el puntero trabado (un toque giraba la cámara).
- La lista de idiomas de la pausa (un lienzo que el motor conducía como raíz y después se muda
  adentro de otro volvía a su tamaño) y el idioma del teléfono como el del juego la primera vez.

## Controles

En el teléfono (siempre horizontal y 16:9; en vertical gira 90°):

| qué | cómo |
|---|---|
| caminar | joystick a la izquierda (aparece donde se apoya el dedo) |
| mirar | arrastrar en la mitad derecha |
| usar lo que se mira / pasar el diálogo | tocar la pantalla |
| correr | mantener **Correr** |
| usar | **Usar** (la E) |
| pausa (idioma, brillo, filtro) | **❚❚** |

Los controles aparecen sólo mientras se juega (el juego traba el puntero); en los menús los toques
van a los botones del juego. En la computadora: clic en el juego para trabar el puntero, WASD y el
mouse, Shift para correr, E o clic para usar, Esc para la pausa.

## Armarlo

```bash
porteos/bad-parenting/portear.sh "Bad Parenting 1.zip" entrega-bp1
```

Deja en `entrega-bp1/`: `sitio/` (la versión para subir: baja lo que hace falta, queda en caché y
se instala como app) y `bad-parenting-1.html` (el HTML único, se abre como archivo). El APK sale
del sitio con `herramientas/porteo/apk/armar.py ... --orientacion horizontal` (36 MB, sin permiso de
red). La subida privada: `herramientas/porteo/cloudflare/descargas.py` mete el APK y el HTML único
en `descargas/` (se bajan desde el teléfono con un toque) y `subir.py` pone la puerta con clave
delante de todo.

| archivo | qué es |
|---|---|
| `portear.sh` | del zip al sitio y al HTML único (HLSLcc, exportar, reparar, la web con AOT, empaquetar) |
| `carga.json` | el título, el aviso de la intro, los consejos de la pantalla de carga y la escena del menú (`Main`) |
| `carga.py` | la portada del menú (el sprite de `Cover`) → imagen de la pantalla de carga, fondo e ícono |
| `orden.json` | los recursos en el orden en que se usan; el `"|"` separa lo del menú (bloques propios) |

## La carga

En total son 37 MB. Con 5 Mbps (medido en Chromium con la red limitada) el menú aparece a los
~17 s; antes de esto eran ~24. El código (.NET compilado, 5,5 MB con LZMA) llega primero, el motor
arranca mientras llegan los paquetes, y el menú espera sólo lo suyo (7,7 MB). Lo que lo hizo más
chico:

- el corte de `orden.json`: lo del menú en bloques propios (de 13 MB a 7);
- los videos no se esperan (`VideoClip` es diferible: el `<video>` busca sus bytes al crearse);
  el del bosque (casi 1 MB) se esperaba desde el arranque;
- Steamworks.NET recortado (`perfiles/bad-parenting/juego.props`): Steam no está y entero eran
  3,4 MB de código compilado;
- mientras la pantalla de carga tapa el juego, lo de fondo baja de a un bloque: lo que el arranque
  pide enseguida no reparte la conexión.

El logo de 2OO2 (la primera escena) corre sin dibujar, un segundo de juego por cuadro, mientras la
pantalla de carga lo tapa, como el de Monomi Park en Slime Rancher.

El juego, sus personajes, imágenes y sonidos son de 2OO2: nada de eso entra al repo (sólo las
recetas, el motor y las herramientas).

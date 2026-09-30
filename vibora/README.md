# VÍBORA.IO

Comé bolitas de luz, crecé y hacé que las otras víboras choquen la cabeza
contra tu cuerpo. Si tu cabeza toca otro cuerpo (o el borde), te volvés
comida para las demás.

Es un juego **original** de JXSTUDIOS del mismo género que *slither.io*. Del
género se tomaron las reglas: la víbora sigue al dedo, el turbo gasta largo y
deja comida, se muere al chocar la cabeza contra un cuerpo y hay una tabla de
los más largos. De ese juego no hay nada: ni el nombre, ni el logo, ni las
pieles, ni los dibujos. El logo VÍBORA.IO, las 27 pieles, los 5 fondos, la
música y los sonidos están hechos con código acá. Se juega sin red, contra
bots que corren en el mismo teléfono: no hay partidas en línea.

Arranca con la intro de **JXSTUDIOS** en 2D desde el primer cuadro, sin tocar nada
(dos segundos y medio):
- Una raya de luz abre la fibra de carbono y la reja de metal entra desde los
  costados.
- El monograma JXS se escribe con luz: cuatro puntas que tiran chispas.
- Golpea con destello, onda y sacudida, y un brillo cruza el metal.
- Sube la palabra JXStudios y un empujón hacia adelante da paso al menú.

La música va agendada con el mismo reloj que la animación. Sobre el sonido:
si el navegador deja sonar sin un toque (casi nunca), el audio nace andando
y la música va en fase con el dibujo; si no, la intro va muda y el primer
toque la saltea y prende el sonido. Un toque la saltea. → `js/intro.js`,
`js/logojxs.js`, `js/sonido.js › jingleJXS`

**Para jugar:** abrir `vibora-en-un-archivo.html`. Anda sin red, con doble
clic o mandándolo al teléfono.
- **Con el dedo:** la víbora va hacia donde apoyás; en Ajustes se puede
  cambiar a joystick. El botón del rayo o un segundo dedo es turbo.
- **En la compu:** el mouse apunta y el clic o el espacio es turbo. ← → doblan,
  y P o Escape pausa.

## Lo medido (30/09/2026)
| qué | cuánto |
|---|---|
| Pruebas sin navegador (`pruebas/logica.mjs`) | 158 comprobaciones, todas bien (con los pasos a 60, 90 y 120 Hz) |
| Pruebas en Chromium (`pruebas/juego.mjs`) | 16 de 16: clics, teclas y dedos de verdad (CDP), y la intro con y sin permiso de sonar |
| Archivo único desde `file://` sin red (`pruebas/un-archivo.mjs`) | abre, la intro llega al menú y se juega |
| Peso del archivo único | 116 KB (16 módulos, sin binarios) |
| 90 s con 22 bots picantes, 3 semillas | 0,1 ms por paso de simulación; unas 110 muertes, ninguna contra el borde; la más larga llega a 1600–3400 |
| Un cuadro pintado por procesador, 26 bots | 2,4 ms a 412×892 y 6,3 ms a 618×1338, la densidad de 1,5 del teléfono (antes 2,9 y 9,3 a 824×1784; Chromium sin GPU en el servidor: del teléfono no dice nada) |
| Pantallas probadas | 412×892, 360×640, 320×568, 892×412 y 1280×720: nada se sale ni se pisa |

## Qué tiene
- **El mundo:** un círculo de radio 3000 con 1500 bolitas de luz, que se
  reponen solas. Al morir, el cuerpo se vuelve bolitas grandes de sus colores,
  con el 80 % de su masa.
- **La víbora:** cuanto más come, más gruesa, más larga y más lenta para
  doblar, así una chica siempre puede escaparse de una grande. El turbo va a
  470 en vez de 200 y gasta 4 de masa por segundo, que cae como comida por la
  cola. Con 12 o menos no hay turbo.
- **Bots con nombre:** 10, 18 o 26, según el nivel (Tranqui, Normal o
  Picante). Miran con 9 rayos para no chocar y buscan la mejor comida. Los
  picantes, además, cortan el camino a las otras.
- **Pieles y fondos:** 27 pieles (12 libres y 15 que se abren con tu mejor
  largo, de 150 a 5000) y 5 fondos (colmena, carbono JX, circuito, galaxia y
  magma).
- **Lo que se lee jugando:** la tabla de las 10 más largas con tu puesto, el
  minimapa y los carteles ("¡Te comiste a…!", "¡Largo 1.000!"). El récord
  queda guardado.
- **Ajustes:**
  - música, sonido, vibración y nombres;
  - control: seguir el dedo o joystick;
  - calidad: en *auto* baja la resolución sola si los cuadros tardan;
  - idioma: español, inglés o portugués.
- **Sonido:** dos temas (menú y juego) y los efectos, todo con WebAudio y sin
  archivos.

## Cómo está hecho
| archivo | qué hace |
|---|---|
| `js/vibora.js` | La víbora. La cabeza se mueve y el cuerpo es el camino que dejó: un anillo de puntos cada 4 unidades. Crecer es dejar de cortar la cola. |
| `js/mundo.js` | La comida va en arreglos con una grilla de 128. Cada bolita sabe en qué celda está, porque el imán la mueve. Los choques de cabeza contra cuerpo usan otra grilla. También las muertes y el renacer. |
| `js/ia.js` | Los bots; piensan 10 veces por segundo. |
| `js/dibujo.js` | Bolitas y halos dibujados una vez (después, un `drawImage` por bolita), la arena y las víboras con ojos. |
| `js/fondos.js` | Las baldosas de los fondos, que se mueven con la cámara (un patrón con `setTransform`). |
| `js/hud.js` | Tabla, minimapa, tu largo, carteles y los botones de turbo y pausa. |
| `js/logo.js` | El logo VÍBORA.IO con trazos, sin depender de las letras instaladas. |
| `js/entrada.js` | Dedo, joystick, mouse y teclado. |
| `js/intro.js`, `js/logojxs.js` | La intro de JXSTUDIOS. El monograma son 4 trazos vectoriales, los mismos que usa Cripta Neón. |
| `js/sonido.js` | La música por pasos, con agenda adelantada, y los efectos. |
| `js/idioma.js`, `js/guardado.js`, `js/pieles.js` | Los textos en tres idiomas, lo guardado (validado campo por campo) y las pieles. |
| `js/main.js` | Las pantallas, la cámara, el bucle (cada cuadro avanza su tiempo real en pasos de a lo sumo 1/60 s: parejo a 60, 90 o 120 Hz) y la calidad automática. |
| `empaquetar.py` | Arma el archivo único. |

## Probar
```
python3 -m http.server 8123 --bind 127.0.0.1 &     # desde la raíz del repo
node vibora/pruebas/logica.mjs
node vibora/pruebas/juego.mjs [--capturas carpeta]
python3 vibora/empaquetar.py && node vibora/pruebas/un-archivo.mjs
```
Parámetros para probar:
- `?sinintro`: directo al menú.
- `?directo=juego`: directo a jugar.
- `?pausa`: no avanza solo (se avanza con `__V.pasos(n)`) y saltea la intro,
  salvo que también vaya `?intro`.
- `?limpio`: sin lo guardado.
- `?idioma=en`: elige el idioma.

## De dónde salió
De las tres capturas de la ficha de Google Play que pasó el pedido: de ahí
salió el género, no los dibujos. El monograma JXS sale de las dos imágenes
del logo de JXSTUDIOS, redibujado con trazos.

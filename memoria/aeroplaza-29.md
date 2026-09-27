# AEROPLAZA — vigesimoctava vuelta (27/09/2026): tu espacio (el cuarto con ARCore, como el Space Setup de un Quest)

Pidió: "al tocar visor VR te pide si querés ARCore y al hacerlo te pide escanear no solo el suelo, sino paredes,
objetos, todo, para armar un entorno Meta Quest; después con tus manos tenés que ponerlas sobre una mesa para el
escáner de las manos y se abre una pantalla que podés tocar, jugar o abrir ventanas de prueba para probar el 6DoF;
si no querés el 6DoF, las ventanas en el mundo 3D del juego". Antes: [aeroplaza-27](aeroplaza-27.md) (la APK).

## Cómo va

- **La pregunta** (`ui.js › preguntarAR`, en la APK con ARCore): después de elegir con o sin visor, tres opciones:
  tu espacio, directo al juego (6 ejes, como antes) o sin ARCore (`J.entrarVR(sbs, …, { conAR: false })`: el VR no
  prende ARCore y las manos van con la cámara de la web, `main.js › sinAR`). En la web no hay pregunta.
- **Tu espacio** (`js/espacio.js`) va dentro del modo VR (la capa de toques, pantalla completa) y toma el cuadro como
  el telescopio (`main.js › paso`). Todo en las coordenadas de ARCore: la cabeza es la pose de ARCore tal cual.
  - Escaneo: la cámara de fondo, el piso con grilla celeste, paredes, mesas (amarillo), techo, y los objetos en
    cubitos que aparecen creciendo, con una ola que sale de la cabeza. La tarjeta que acompaña la mirada dice qué
    falta (piso, paredes, mesa, objetos, mirar alrededor en 12 porciones). "Listo" pide piso.
  - Las manos sobre la mesa (el contorno de dos manos dibujado en la mesa): abiertas, horizontales y quietas 1,2 s.
  - La pantalla (1,1 × 0,62 m) arriba del borde de la mesa: jugar, dónde estoy, reloj, pizarra, burbujas, ver el
    escaneo, escanear de nuevo, medir las manos, salir. "Jugar" apaga el escaneo y la cámara y sigue en el juego con
    ARCore y las manos (`vr.ar0 = null` alinea la vista de nuevo).
- **Sin ARCore**: en el menú de la palma hay "🪟 Ventanas" (`manos.js › Menu`, seis botones): la misma pantalla y
  las mismas ventanas, en el mundo del juego (`main.js › ventanasMundo`, en `manos.escena`, sin 6DoF).

## Las ventanas (`js/ventanas.js`)

- Tableros de vidrio Aero dibujados en un lienzo (`Tablero`, `Pantalla`, `Ventana`), con aparición con rebote.
- Se tocan con la yema (aprieta al cruzar el vidrio, 6 mm), con el rayo y un pellizco, o con la mirada: un toque en
  la pantalla, o 1,4 s encima de un botón (con visor no se ve el dedo). Un toque sin mirar nada aprieta el botón
  principal de la tarjeta.
- (Vuelta 34: también por una manija abajo y pellizcando con la mano, y cada una se abre en su lugar: ver
  [aeroplaza-33](aeroplaza-33.md).)
- Se agarran por la barra con un pellizco y siguen al rayo a la misma distancia; **apuntando a una pared mientras
  se lleva, va a la pared** (con el rayo solo no se la puede alejar). Al soltar a menos de 22 cm de una pared, se
  pega a 1,2 cm mirando para afuera.
- Tipos: reloj, pizarra (se dibuja con la yema o con el pellizco), burbujas (se revientan) y "dónde estoy" (a
  cuánto está, cuánto te moviste, a qué altura del piso, y una esferita adelante para ver el paralaje).

## Android (`Espacio.java`, `Ar.java`, `MainActivity.java`)

- `arEscanear(true)` configura la sesión en el hilo de GL (planos horizontales y verticales, profundidad AUTOMATIC
  si el celu puede; si no, la nube de puntos) y avisa `espacio profundidad|puntos`.
- Planos cada 400 ms (pose, extensión y contorno de hasta 48 vértices). Profundidad cruda con confianza ≥ 150 cada
  150 ms, uno de cada 3 × 3 píxeles, al mundo con la receta del codelab (intrínsecos de la textura, pose del
  sensor) y en cubitos de 5 cm que cuentan después de 3 vistas; salen de a 4.000 cada 250 ms (tope 90.000).
- La cámara para ver a través: la foto de la CPU a la mitad, derecha para la pantalla, JPEG 62, hasta 30 por
  segundo. El juego la pide por `https://appassets.androidplatform.net/camara/N.jpg` (`shouldInterceptRequest`,
  sin base64 por el puente) con la pose de esa foto, y la pone en el mundo a 9 m donde se sacó.
- La foto de la CPU se pide una vez por cuadro y la usan las manos y la cámara.

## Medido (pruebas/espacio.mjs, Android de mentira: 22/22, también con visor `SBS=1`)

- La mano apoyada que MediaPipe ve un 20 % más chica: la escala sale 1,229 (la de verdad, 1,25; 1,7 % abajo por
  los 2 cm de la palma sobre la mesa). Queda en `localStorage` (`aeroplaza.escalaMano`) y `manos.recibirCamara`
  agranda todo desde la cámara (en la imagen no se mueve nada, solo la distancia).
- Caminando 1 m, la ventana no se mueve nada (6DoF). La pizarra, 4.285 píxeles con un trazo.
- Capturas: `pruebas/salida/espacio-{escaneo,manos,pantalla}[-sbs].png` (no se suben).
- La tanda de manos y VR con la nueva (manos, manos-celu, nativo, espacio, vr, xr, vr120, dedos, menús,
  manos-directo): 9/10; `manos.mjs` buscaba "Salir" en la caja 4 del menú, que ahora es "Ventanas". Apunta al
  último botón: 20/20.

## La cámara llena la vista (vuelta 31, 27/09)

- Pidió que la cámara ocupe todo al escanear ("la idea es que andes por tu casa") y el 0.5x.
- **Con visor, la cámara del celu abarca ~60° y la lente más de 100°**: se veía una ventana en el medio. Con "Llenar
  la vista" (de entrada, se cambia en la pantalla, `aeroplaza.camaraLlena`) cada ojo se dibuja con el campo de la
  cámara (tan = el menor de los dos de la foto: el lienzo de la lente es cuadrado) y la lente lo abre a toda su
  vista. La cámara ocupa todo y lo dibujado sigue encima de lo que se ve (todo con el mismo aumento; con la foto de
  prueba, 49° en vez de 115°). Sin visor ya llenaba (`Espacio.campo`).
- **La foto entera** (640 × 480, JPEG 70) en vez de la mitad; si pasarla tarda más de 28 ms (promedio, después de
  10 fotos) queda a la mitad para siempre (`Espacio.java › aMitad`: si no, iba y venía).
- **El 0.5x**: ARCore sigue dónde estás con la cámara que tiene calibrada, casi siempre la principal. `Ar.java ›
  elegirCamara` elige la más abierta de las que ARCore acepta (el campo de su sensor y su lente) y le avisa al juego
  `camara <la elegida> <la más abierta del celu>`. La tarjeta y la pantalla dicen si quedó el 0,5x o si ARCore no lo
  deja (sin comprobar en un celu cuál deja).
- Con lentes, el punto de la capa va al centro de cada lente (`vr.js › ponerCentroLentes`); en tu espacio no va (el
  de la escena ya está). La tarjeta, con visor, ocupa el 40 % de la vista (con el aumento, al 55 % tapaba todo).
- `espacio.mjs`: 24/24, con y sin visor.
- **Desde la vuelta 33 va apagado de entrada** ("Cámara con aumento"): el aumento se veía como ojo de pescado.
  Ver [aeroplaza-32](aeroplaza-32.md).

## Trampas

- **Sin visor, el campo de la vista es el de la cámara** (`Espacio.campo`, que llene la pantalla: con el celu
  acostado da ~32° vertical). Lo que va con la cabeza se aleja según el campo; si no, la tarjeta tapaba todo.
- **Las cuentas con los tableros usan su matriz del mundo**: sin dibujar no se actualiza. `Ventanas.actualizar`
  hace `updateMatrixWorld` primero (en las pruebas, sin eso, la mirada no apretaba nada).
- **Crecen al aparecer**: en las pruebas hay que esperar ~0,3 s antes de apuntar un botón o agarrar la barra.
- **`createImageBitmap(…, { imageOrientation: 'flipY' })` y `flipY = false`** en la textura de la cámara (con
  ImageBitmap three no puede dar vuelta la imagen).
- **Falta en el celu**: todo lo de ARCore (planos, profundidad, la foto por https) se probó con un Android de
  mentira; en un celu de verdad falta ver cuánto tarda la foto y si la profundidad cruda arma bien los muebles.

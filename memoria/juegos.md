# Juegos en three.js con modelos de Rezona
Fuente: la pasada de bugs de `estancia/` (24/9/2026). Ver también: [rezona](rezona.md).

## Los rigs de Rezona: mirar el esqueleto, no los nombres

- **Los nombres mienten.** En la vaca, `tripo1_Left_Limb_*` es la cola y una pata
  delantera quedó como `bone_9..13`. Antes de usar un hueso: posición en el
  marco del modelo y cuántos vértices pesa (`estancia/herramientas/pruebas`,
  o el script de huesos del diario). Un hueso con 0 vértices mueve solo a sus
  hijos.
- **La caminata de cuadrúpedo (`preset:quadruped:walk`) no sirve** si el rig
  quedó mal etiquetado: en la vaca movía una sola pata delantera. Y no hay
  trote ni galope. Solución: `estancia/js/marcha.js` (paso/trote/galope por
  código con IK de dos tramos).
- **Los clips de bípedo traen avance de raíz** en la `y` de `Root` (viene
  girado): la cadera avanza ~1 m por vuelta y vuelve de golpe. Sacarlo y usar
  lo que avanzaba para la velocidad del clip (`modelos.js`, `quitarAvance`).
- Clips de rigs distintos del mismo modelo calzan (mismos largos de hueso): se
  pueden mezclar.

## Animar por código encima de un clip

- **Volver a la pose de reposo cada cuadro** antes de sumar giros. Los huesos
  que el clip no toca no se reescriben y el giro se acumula: cuellos que dan
  vueltas.
- Girar sobre ejes del modelo (x costado, y arriba, z frente) con
  `E.modelos.girar`, no sobre los ejes locales del hueso (cada rig los trae
  como quiere).
- Un hueso del que cuelgan otras cosas (el lomo del caballo lleva cuello y
  manos): girar y contra-girar a los hijos.
- La velocidad para las patas: del desplazamiento real entre cuadros, con
  signo. Si otro módulo mueve al animal (lazo, manga), igual camina.

## Mallas con esqueleto

- `frustumCulled = false` dibuja todo siempre (también en la pasada de
  sombras). Mejor: esfera medida en reposo ×1,6, una vez por modelo.
- Un rayo contra una malla con esqueleto recalcula todos sus vértices: para
  medir al cargar, copias quietas con los vértices ya deformados
  (`E.modelos.quietas`). La geometría cruda NO coincide si el modelo se escaló
  después de atar el esqueleto.

## Convenciones que muerden

- Rumbo: el caballo avanza hacia (sin, cos) y la cámara hacia (−sin, −cos).
  Mirar adonde va el caballo es rumbo + π (al montar se miraba para atrás).
- En el hemisferio sur el sol va por el norte: las caras al sur quedan a la
  sombra. Sin rebote del suelo la sombra de mediodía es negra.
- Rugosidad baja + sol bajo = espejo: el barro mojado a 0,35 era una mancha
  blanca.

## Probar

- Congelar el bucle y sacar las fotos a mano (`__juego.congelar`,
  `__juego.fotoDesde`): si no, el cuadro siguiente pisa la cámara.
- Tiras cuadro a cuadro de cada aire y postura, con modo prueba de velocidad
  (`estancia/herramientas/pruebas/LEEME.md`). Los bugs de rig solo se ven así.

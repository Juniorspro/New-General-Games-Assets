# AEROPLAZA — vigesimonovena vuelta (27/09/2026): las lentes del visor

Pidió: "agregá un menú para ajustar las lentes SBS; por ahora son solo un cubo y no da que sea así". Antes:
[aeroplaza-29](aeroplaza-29.md) (tu espacio) y [aeroplaza-13](aeroplaza-13.md) (el VR a 120, `vr-dibujo.js`).

## Lo que es

- **La lente del visor agranda más los bordes que el centro** (almohadón): con los dos rectángulos de antes, las
  rectas se veían curvadas para afuera y el borde, estirado. Se corrige dibujando cada ojo con barril.
- **El modelo es el de Cardboard**: el punto de la pantalla a r del centro de su lente (en medios altos del ojo)
  muestra la dirección tan = s·r·(1 + k1·(s·r)² + k2·(s·r)⁴) (`lentes.js › curva`, su inversa por Newton).

## Lo que quedó (`js/lentes.js`)

- Con SBS y lentes, cada ojo se dibuja en su lienzo cuadrado, con el campo que pide la lente para llegar a su
  borde (T, hasta 2,2 de tan). Después un pase lo lleva a la pantalla curvado, corrido al centro de su lente.
  - En `vr-dibujo.js › medir y cuadro`: el mundo del medio se dibuja con ese campo, cada ojo se reproyecta a su
    lienzo y lo de encima (las manos) va ahí, con su paralaje.
  - En `espacio.js › dibujar`: la escena del cuarto va al lienzo de cada ojo.
- El pase: cada color con su escala (la lente separa el rojo del azul en el borde) y negro afuera del borde,
  redondo. La grilla de prueba (amarilla) son rectas de la escena cada 0,4 de tan: a través de la lente tienen
  que verse rectas.
- El lado del lienzo: un píxel por píxel de pantalla en el centro (alto × T/s), sin pasar de 1,25 veces el alto
  del ojo, y el 80 % fuera de las calidades alta y media.
- Los perfiles (`PERFILES`): sin lentes (el dibujo de antes, sin el pase ni el lienzo de más), Cardboard 1
  (0,441 / 0,156), Cardboard 2 (0,34 / 0,55), genérico (0,22 / 0,24; el de entrada) y "a mi gusto" (lo último
  ajustado, guardado aparte). Todo va en `localStorage` (`aeroplaza.lentes`).
- Se ajustan siete cosas (`AJUSTES`): las dos curvas, el tamaño (s), la separación y la altura de las lentes, los
  colores y el borde.

## Dónde se ajusta

- **Afuera** (`ui.js › menuLentes`): "Lentes del visor", en el menú del VR, con los perfiles, siete deslizadores y
  la vista previa de las dos lentes (`vistaLentes`, la grilla llevada a la pantalla con la inversa). Entra en el celu
  acostado sin desplazar (384 de 390 px). "Probar con el visor" entra al VR con el panel abierto.
- **Adentro** (`lentes.js › PanelLentes`): con visor, el menú de la palma tiene "👓 Lentes" (siete botones ahora)
  y en tu espacio hay un botón en la pantalla. El panel se abre a 55 cm (a 75 cm, con el campo de la lente, quedaba
  chico), con − y + para cada cosa, ◀ ▶ para cambiar de perfil, la grilla y "Listo". Se toca con las manos, o con
  la mirada y un toque.

## Medido (`pruebas/lentes.mjs`, 12/12)

- Con lentes la esquina queda negra (0) y el centro de cada ojo se ve (584 y 595). Sin lentes no hay pase y la
  esquina es el mundo (475).
- La grilla: 1.104 píxeles amarillos. La inversa cierra a 5e-14. Con Cardboard 2, tan 1 cae a 0,903 del centro
  (sin lentes, 1,22): es barril.
- `vr120.mjs` va sin lentes (compara la reproyección contra el ojo dibujado derecho: con lentes daba 10 dB).
  Tu espacio con visor y lentes: 22/22.

## Trampas

- **Leer la pantalla en otro evaluate da todo negro**: el búfer se borra al mostrarse. Se dibuja (`paso(dt, true)`) y
  se lee en el mismo.
- **Los números de los perfiles son de partida** (sin comprobar en un visor de verdad): cada visor y cada celu
  cambian. Por eso están los ajustes y la grilla.

# Globo Libre — lo que enseñó (30/09/2026)
El juego está en `globo/` (README con "Lo medido"). Pedido, con una captura de Rise Up en Google Play: "recrea este juego también", con la intro de JXSTUDIOS "adaptada al juego, no siempre negro y blanco", y elegir el idioma después del logo. Ver también: [juegos](juegos.md), [probar](probar.md), [vibora](vibora.md), [cripta](cripta.md).

## Decisiones
- Original del género: el globo sube solo, el escudo se arrastra en cualquier lado (relativo, el dedo no tapa) y lo quieto espera en el aire hasta que lo tocan. Ni nombre, ni logo, ni niveles, ni dibujos del original; así se le dijo.
- La intro en el estilo del juego: plana y de colores. El ESCUDO escribe el JXS en blanco, un globo choca el logo y larga papel picado, y un círculo del color del cielo abre el menú. → `globo/js/intro.js`
- El motor de física es propio (método de Box2D-lite): el repo es público y el juego va en un archivo. → `globo/js/fisica.js`
- Menús en HTML; el cartel que se hamaca lo dibuja el lienzo (péndulo con resorte, como en Cripta). El menú de HTML tapa el lienzo entero: el empujón del dedo se escucha en `window`. → `globo/js/main.js`, `globo/js/menu.js`

## La física: lo que costó (Box2D-lite en JS)
- Una pila de 6 cajas no se quedaba quieta, y con MÁS vueltas del resolvedor era peor (30 vueltas: 106 u/s). Eso no es falta de ajuste: es un error. Se encontró cambiando de a una cosa desde los parámetros de la demo de Box2D-lite, a escala: solo el rebote rompía.
- La causa: el rebote se medía con la velocidad del contacto DESPUÉS de aplicar el arranque de los contactos anteriores, y veía golpes que no existían. Se mide todo primero (`preparar`) y el arranque va después, en otra vuelta (`arrancar`).
- Dormir de a uno tampoco sirve en una pila: la de abajo se dormía, la de arriba la despertaba, y ese paso quedaba sin el piso. Se duermen de a islas (union-find sobre los contactos) y un despertado se prueba en el mismo paso. → `fisica.js › dormir`, `detectar`
- La marca de "ya probado" no puede volver a cero en cada paso: una caja atravesaba el piso. Arranque del paso anterior por pareja y punto más cercano (2 u).
- Molinete = cuerpo con masa infinita para correrse y su inercia para girar (`pivote`); sin tope daba media vuelta y la otra punta bajaba sobre el globo: abre como tranquera (`tope`), con roce de giro propio.
- El péndulo con el roce del aire de todos (0,6/s) no llegaba a la columna: roce propio (`aire`) casi cero, y se suelta cuando al globo le faltan `tarda` segundos para el cruce. → `partida.js › armar`
- Números: 150 cuerpos amontonados, 0,8 ms por paso de 1/120 en Node; todo dormido a los 6 s.

## La dificultad: medir, no suponer
- Tres jugadores de prueba: nadie tocando, el escudo estacionado arriba del globo y un piloto automático (mira 1,3 s adelante con la forma real de cada cuerpo). → `globo/pruebas/piloto.mjs`
- Con el escudo redondo quieto arriba del globo, lo quieto se aparta solo (hace de cuña). Lo que lo arregló: el escudo arranca corrido, el globo se hamaca ±12, lo que llueve cae de a una pieza al asomar (de a bloque no se ataja) y los grupos (lo que se despierta junto) desde dificultad 0,3.
- Resultado (30/09/2026): sin tocar, 0 de 30; estacionado, 1; el piloto, 9 de 30 y 7 de los primeros 8.
- Un "gimnasio": cada formación sola, con el piloto y sin nadie, por dificultad, dice cuál es injusta; así salieron el molinete, el péndulo y la jaula angosta. → `globo/pruebas/logica.mjs`
- La regla de oro: nada fijo en la columna del globo (x 142 a 218, con el vaivén); la prueba la mira en los 30 niveles y en el infinito. → `niveles.js › fijoEnColumna`

## Trampas pagadas
- El empaquetador lee UN nombre por `export const A = 1, B = 2`: en el archivo único B valía undefined (la moneda se dibujaba en un lienzo de 0 × 0 y `drawImage` tiraba error). Un export por línea; `globo/empaquetar.py` ahora lo rechaza. En el servidor de prueba no se ve: por eso existe `un-archivo.mjs`.
- Probar una formación sola: `new Partida({ formaciones: [f] })`. Cambiar `pendientes` después del constructor dejaba cuerpos del nivel real en el mundo.
- Pintado por procesador: 1,4 ms a 412×892 y 2,5 ms a 618×1338 en el nivel 23; el menú, 3,3 ms.

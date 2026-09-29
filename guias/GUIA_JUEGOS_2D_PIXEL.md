# Guía para hacer juegos 2D pixel art estilo Dan The Man

Receta destilada de **EL TIPO** (`juegos-pc/ElTipo.html`): un beat'em up de plataformas en pixel art,
con 5 niveles procedurales, jefes, tienda y menús animados. Todo en **un solo HTML** que abre sin
red y se juega en el celular **en vertical (412×892)**.

Cada regla de esta guía salió de medir. Las que dicen **«trampa»** ya costaron una vuelta entera.

---

## 0. Las reglas que mandan

1. **Un archivo, cero red.** Canvas 2D, audio sintetizado con WebAudio, sprites como grillas de texto
   dentro del código. Sin CDN, sin fuentes externas, sin imágenes sueltas.
2. **Pixel art de verdad = escala entera.** El mundo se dibuja chico y se agranda ×2 o ×3, nunca ×1,94.
3. **Lo generado no reemplaza nada hasta que llega.** Si metés assets de IA, el juego arranca con lo
   dibujado por código y el asset lo pisa cuando decodifica.
4. **Verificar midiendo.** Un bot que juega los niveles, capturas a 412×892, toques reales por CDP y
   medición de ms por cuadro *con calentamiento*. Nada se da por bueno mirando el código.
5. **Una semilla = la misma partida.** Todo lo procedural sale de un rng con semilla; lo visual, de otro.

---

## 1. Esqueleto del archivo

Orden de secciones dentro del `<script>` (script clásico, `'use strict'`):

```
utilidades (lim, sig, rng con semilla)       → constantes de física
estado global J                              → canvas y medir()
entrada (IN / EDGE / SOLT, teclado y toque)  → audio sintetizado (SFX, música)
efectos (partículas, textos, ondas, impacto) → temas (paletas por nivel)
dibujo base (rectR, miembro, pose)           → sprites por piezas (héroe y kit de enemigos)
armas / colisiones / generador de niveles    → jugador → enemigos → jefes
mundo vivo (arenas, trampas, cámara)         → dibujo del mundo, fondos, HUD
ciclo (pasar / dibujar / bucle)              → arranque y cierre de nivel, progreso, tienda
fuente de píxeles y menús                    → sondas window.__T → arranque
```

### Bucle a paso fijo

La simulación corre a 60 Hz fijos, el dibujo va a lo que dé la pantalla:

```js
const CUADRO = 1000/60;
let acum = 0, ultimo = 0;
function bucle(ts){
  requestAnimationFrame(bucle);
  const dt = Math.min(100, ts - (ultimo||ts)); ultimo = ts; acum += dt;
  let pasos = 0;
  while(acum >= CUADRO && pasos < 4){
    acum -= CUADRO; pasos++;
    if(J.congelado > 0){ J.congelado--; J.t++; continue; }   // hit-stop: NO consume la entrada
    pasar();
  }
  dibujar();
}
```

- **Trampa:** consumir los flancos de entrada *antes* de procesar el cuadro. `pasarEntrada()` va **al
  final** de `pasar()`; si va al principio, `recien('B')` nunca da verdadero.
- **Trampa:** durante el hit-stop no se consume la entrada; así el golpe apretado en el congelado sale igual.
- **Trampa:** nada de `setTimeout` para lógica de juego (fin de nivel, muerte). Se disparan encima del
  nivel siguiente. Todo se cuenta en cuadros del nivel en curso (`J.finNivel = 84`).

### Sondas para el banco

Exponé `window.__X` con lo mínimo para probar sin tocar la interfaz:

```js
window.__T = {
  J, est(), anda(n), entrada(k,v), teletransportar(x), semilla(s),
  medirHuecos(), matarTodo(), dibujarYa(), pose(e), assets(), listo:true
};
```

`anda(n)` tiene que adelantar **todos** los relojes (congelado, lento), o mide un juego que no existe.

---

## 2. Render pixel art

### Dos lienzos, escala entera

```js
const cxP = lienzoVisible.getContext('2d', {alpha:false});   // pantalla: se ve
const cvM = document.createElement('canvas');                 // mundo: chico
const cxM = cvM.getContext('2d', {alpha:false});
const cvH = document.createElement('canvas');                 // HUD: chico, transparente
const cxH = cvH.getContext('2d');

function medir(){
  DPR = Math.min(devicePixelRatio||1, 1.5);
  ANCHO = lienzo.clientWidth; ALTO = lienzo.clientHeight;
  lienzo.width = ANCHO*DPR; lienzo.height = ALTO*DPR;
  cxP.setTransform(DPR,0,0,DPR,0,0); cxP.imageSmoothingEnabled = false;
  PX = Math.max(2, Math.round(ANCHO/212));                    // ENTERO: 2 en 412 de ancho
  ANCHO_M = Math.ceil(ANCHO/PX); ALTO_M = Math.ceil(ALTO/PX);
  cvM.width = cvH.width = ANCHO_M; cvM.height = cvH.height = ALTO_M;
  cxM.imageSmoothingEnabled = cxH.imageSmoothingEnabled = false;
}
```

Por cuadro: mundo en `cxM` a escala 1 → `cxP.drawImage(cvM, 0,0, ANCHO_M*PX, ALTO_M*PX)` →
oscuridad y tintes en `cxP` → HUD en `cxH` → blit del HUD encima.

- **Trampa:** con escala 1,94 los píxeles salen de distinto tamaño y todo tiembla al moverse.
- **Trampa:** el lienzo medido una sola vez, antes del layout, deja el juego aplastado. Usá
  `ResizeObserver` sobre el lienzo **y** una revisión cada 15 cuadros.
- **Trampa:** los `CanvasPattern` se crean con el contexto donde se van a usar (el del mundo).
- **Trampa:** `clip()` y `arc()` suavizan bordes. Para un retrato redondo, recortá píxel por píxel
  con `Math.hypot(x-cx, y-cy) <= r`.
- La cámara trabaja en coordenadas del mundo y se redondea: `translate(Math.round(-cam.x), …)`.
- Dibujar 4 veces menos píxeles bajó el costo de 6,4 a 2,6 ms por cuadro.

### Cámara en vertical

En vertical se ve más alto que ancho. Mostrá ~210 píxeles de mundo a lo ancho y seguí al jugador en Y.
Si los mandos flotan sobre el juego, encuadrá sobre lo que queda libre:

```js
const util = vistaH - ZONA_MANDOS;                   // ZONA_MANDOS = round(190/PX)
const objY = p.y - util*(p.enSuelo ? 0.74 : 0.62);
cam.y += (lim(objY, -10, MUNDO_ALTO + ZONA_MANDOS + 10 - vistaH) - cam.y) * 0.08;
```

Debajo del piso tiene que haber tierra hasta el borde de la pantalla (sólidos profundos), porque los
mandos flotan encima.

---

## 3. Personajes por piezas

El personaje **no** es una tira de cuadros. Es un conjunto de piezas pixel art que siguen a las
articulaciones de un esqueleto calculado. Una sola función `pose(e)` da todas las animaciones.

### 3.1 El esqueleto: `pose(e)`

Devuelve posiciones locales (x hacia adelante, y hacia arriba negativo, origen en los pies):

```js
{ cadX, cadY, homX, homY, cabX, cabY,    // cadera, hombros, cabeza
  mIx, mIy, mDx, mDy,                     // mano de atrás / de adelante
  pIx, pIy, pDx, pDy,                     // pie de atrás / de adelante
  incl }                                  // inclinación del cuerpo
```

Cada estado (`quieto`, `corre`, `aire`, `golpe` con variante, `guardia`, `dash`, `aturdido`,
`volando`, `muerto`) mueve esos puntos con senos y el avance del ataque `f = 1 - an/anMax`.
Por ejemplo, el directo: `s = sin(min(1, f*2.2)*π); mDx = 4 + s*19`.

### 3.2 Del sprite de referencia a la grilla

1. Tomá la imagen de referencia y **contá los colores** (moda por bloque, no a ojo) para sacar la paleta.
2. Reducila a la grilla del juego (≈28×46 para un héroe cabezón) eligiendo por bloque el color de
   paleta más frecuente, con el contorno negro favorecido.
3. **Limpiala a mano.** La conversión automática confunde colores vecinos (la vincha con la piel) y
   deja píxeles sueltos: sirve de calco, no de sprite.
4. **Trampa:** si la referencia viene suavizada no hay grilla que recuperar; el factor de ampliación
   no se puede deducir (el error crece parejo con el factor).

La grilla se guarda como texto, una letra por color:

```js
CABEZA = [
 "..............k.........",
 ".............kok....k...",
 "...kllllllllkggggkllllk.",   // k contorno · o pelo · l vincha · g gema · y piel · w ojo
 ...
];
```

### 3.3 Partir en piezas con anclas

Piezas: `CABEZA`, `TORSO`, `PUNO_D`, `PUNO_T`, `PIERNA_D`, `PIERNA_T`, `PIE` (y accesorios: colas
de vincha, escudo). Cada una lleva un **ancla**: dónde va su esquina en reposo, con origen en los pies.

```js
anclas: { CABEZA:[-9,-46], TORSO:[-7,-24], PUNO_D:[7,-21], PUNO_T:[-12,-21],
          PIERNA_T:[-13,-12], PIERNA_D:[0,-12] }
```

Las piezas se hornean **una vez** a canvas chicos y se cachean.

### 3.4 Que cada pieza siga a su articulación

Desplazamiento = (pose actual − pose de reposo) × factor. Así hereda todas las animaciones:

```js
const d  = (a,b)=> Math.round((a-b)*1.3);     // cuerpo
const dB = (a,b)=> Math.round((a-b)*1.35);    // brazos, un poco más
const md = [dB(p.mDx,R.mDx), dB(p.mDy,R.mDy)];
if(md[1] < 0) md[0] += Math.round(-md[1]*0.4);   // el puño que sube, avanza
topar(md, 17);                                    // tope de largo: brazo, no goma
```

Orden de dibujo: colas → piernas → brazo de atrás + puño → torso → cabeza → brazo de adelante + puño.

- Brazos y piernas estirados se completan con **cápsulas de píxeles duros** entre la articulación y
  la pieza (cuadrados redondeados a entero, contorno primero y color después, sin antialias).
- Cerca del reposo la pierna va como bitmap; muy estirada (patada), cápsula + pie.
- **Trampa:** con cabeza enorme, **el puño que sube tapa la cara**. Si el puño cae sobre la cara,
  el brazo va por detrás de la cabeza.
- **Trampa:** estirar brazos al 165 % los deja de goma. 135 % con tope de 17 px y grosor 3.
- **Trampa:** el lienzo donde se compone el personaje tiene que tener aire (104×84 para uno de 28×46);
  si no, el puño estirado se sale y parece que la animación no anda.
- **Trampa:** capturá el cuadro pico. El directo está estirado sólo los cuadros 2 y 3; una captura
  en el 4 muestra el puño volviendo.
- Espejo con `scale(dir,1)`; caído, rotación de 90°; lanzado, rotación por cuartos. Así se mantiene la grilla.

### 3.5 Kit de enemigos por roles

Para no dibujar a mano cada enemigo: piezas escritas con **letras de rol** y una **paleta por tipo**.

```
k contorno · p/P piel · a/A uniforme · b/B pantalón · c/C casco · d/D detalle
h/H barba · e ojo · r ojo rojo · g/G guante · z/Z bota
```

- 7 cabezas (casco, casco con nasal, gorra, pelado con barba, capucha, boina con bigote, corona)
  × 4 torsos (base, mandil, coraza, manto) → once personajes con la misma pinta de familia.
- Cabeza = cara base + capas (`sombrero`, `sobre`) que pisan donde no hay `_`.
- **Trampa:** si la barba comparte rol con el dorado, el rey sale con barba de oro. Cada cosa que
  pueda tener otro color en otro personaje necesita su propio rol.
- Jefes y grandotes se escalan por vecino más cercano; algún píxel queda doble, no se inventan medios tonos.

---

## 4. Fondos pixel art

Un **pintor por tema** que dibuja, una sola vez, dos tiras que se repiten (lejos y medio), a escala 1:

```js
const PINTORES = {
  calle(g, W, H, color, capa, rng, anim){ /* conventillos, ventanas, escaleras, faroles… */ },
  fabrica(...){ /* techo serrucho, chimeneas */ },
  subte(...){ /* azulejos, carteles, columnas */ },
  azotea(...){ /* rascacielos, antenas */ },
  torre(...){ /* almenas, montañas, banderas */ },
};
```

- El cielo es una capa fija (gradiente + luna/estrellas o lo que toque), cacheada por tema y tamaño.
- Parallax: `desp = ((-cam.x*p) % w + w) % w`; se dibuja la tira dos veces (`desp-w` y `desp`).
- Lo que se mueve (neones que parpadean, humo, tubos, balizas, nubes, banderas) **no** va en la tira:
  el pintor registra puntos con `anim({t:'neon', x, y})` y `animFondo()` los pinta por cuadro con el
  mismo parallax. Es barato.
- La tierra: un patrón de 96×96 por tema dibujado por código (asfalto, chapa, baldosa, grava, piedra).
- **Trampa:** crear gradientes 60 veces por segundo llevaba el dibujo a 9 ms. Todo lo fijo, cacheado.
- **Fundido estilo consola:** trama Bayer 4×4 como patrón que se va llenando de 0 a 16.

---

## 5. Texto e íconos en píxeles

### Fuente propia 5×7

Una tabla `FUENTE_PX` con A–Z, 0–9 y signos, más tildes, Ñ, Ü y ¡¿ como marcas encima de la letra
base (3 filas de aire arriba). Las mayúsculas alcanzan para todo lo que es juego.

```js
function lienzoTexto(str, {grad}){
  // 1 px de canvas = 1 px de fuente
  // sombra (abajo-derecha) → contorno 3×3 por píxel → relleno con degradé por fila
}
function pixelar(el, S, o){ /* reemplaza el texto del elemento por el lienzo a escala S,
                              guarda el texto en data-px para poder rehacerlo */ }
```

- Degradés por fila (7 colores): blanco, oro, rojo, verde, azul, gris, fuego.
- Cacheá cada texto dibujado; los números del HUD cambian mucho, pero el caché se vacía solo si pasa de 400.
- Los textos largos (instrucciones) en píxeles no se leen en el celu: monoespaciada común en negrita.

### Íconos por forma

```js
function lienzoForma(w, h, dentro, color){ /* sombra, contorno automático alrededor de "dentro",
                                               relleno con color(x,y) */ }
```

Con eso salen flechas, corazón, rayo, llama, escudo, moneda, pausa. **Trampa:** lo que es figura
reconocible (el puño) se dibuja **a mano** en grilla; con fórmulas se lee como una carita.

---

## 6. Menús vivos

### Portada

Nada de pantalla quieta. La portada es una escena en loop sobre el fondo de un nivel:

1. El héroe corre en el lugar mientras el fondo hace parallax.
2. Entra un matón; el héroe le mete el combo de tres con hit-stop, estrellas, números y **K.O.**
3. Lo manda a volar, fundido con trama al nivel y rival siguientes.

El nombre del juego se dibuja **en el mundo pixelado**, no en el DOM: cada letra cae al abrir,
ondula con un seno desfasado por letra, le corren bandas de color (`(fila + t/4 + letra) % 7`) y
cada tanto pasa un barrido de luz en diagonal. Destellos alrededor.

- El nombre grande va sólo en la portada; en tienda y ayuda se mete detrás del encabezado.
- En los menús los mandos se sacan del layout (`display:none`) y la escena ocupa todo.

### Botones y paneles de 16 bits (CSS)

```css
.boton{border-radius:0;border:none;background:#e2661a;
  box-shadow:inset -4px -4px 0 #9c3c08, inset 4px 4px 0 #ffb05a,
             0 0 0 3px #141018, 0 6px 0 3px #141018;
  animation:entrar .42s steps(5) both}
.boton:active{transform:translateY(4px)}
@keyframes entrar{from{transform:translateY(26px);opacity:0}to{transform:none;opacity:1}}
canvas.px{image-rendering:pixelated}
```

- Entradas escalonadas por `nth-of-type` con `animation-delay`; todo con `steps()`, nada suave.
- El rango del fin de nivel cicla colores con `filter:hue-rotate` en pasos y salta.
- Retratos de los jefes en la lista de niveles sacados **del mismo kit** que usa el juego.
- Música de menú propia y un blip al tocar.

---

## 7. Mandos táctiles tipo Dan The Man

Botones **flotando sobre la tierra**, sin panel negro, íconos en pixel art:

```
 ◀  ▶                        [escudo]   [furia]
(flechas grandes)             ( PUÑO )  ( ▲ salto )
```

Con dos botones de acción no se pierde ningún movimiento si se usan gestos:

| gesto | acción |
|---|---|
| tocar el puño | golpe (combo de tres) |
| puño deslizando **arriba** | gancho (cancela el directo recién tirado) |
| puño deslizando **abajo** en el aire | plancha |
| **doble toque** en una flecha (<270 ms) | dash |
| deslizar el dedo arriba/abajo sobre las flechas | ▲ / ▼ (bajar de una tabla: ▼ + salto) |

- Las flechas son **un solo pad** que sigue a cada dedo por `identifier`: lado por la x, ▲/▼ por el
  desplazamiento vertical desde donde empezó el toque (±30 px).
- Los gestos se entregan como pulsos de un cuadro (`EDGE.G`, `EDGE.S`), igual que un botón.
- **Trampa:** los botones responden a `touchstart`, no a `click`, con `{passive:false}` y `preventDefault`.
- **Trampa:** un botón que nada prende nunca aparece. El de furia sólo andaba con teclado.
- **Trampa:** en CSS, `#contenedor .bt` le gana en especificidad a `#bPausa`; el botón medía 70 px.
- Siempre teclado también (flechas/WASD, J golpe, K salto, L dash, I guardia, F furia).

### HUD

- Arriba a la izquierda: retrato redondo con la cara del héroe (recortada en círculo píxel por píxel)
  y aro verde/amarillo/rojo según la vida; barra con **rastro blanco** del último golpe que baja de a poco.
- Debajo: furia y ranura del arma con munición.
- Arriba a la derecha: moneda + contador de cuatro dígitos y pausa cuadrada.
- El HUD va en su propio lienzo chico, **encima** de oscuridad y tintes.

---

## 8. Combate que se siente

| mecánica | receta |
|---|---|
| Hit-stop | `congelar(3..8)` según el golpe; la simulación se para, el dibujo no |
| Sacudida | `cam.sx` que decae ×0,86 por cuadro |
| Impacto | estrella de 10 puntas con contorno negro en el punto del golpe |
| Combo de tres | directo, directo, patada que lanza. **Los dos primeros casi no empujan (0,7–0,9)** o el tercero no llega |
| Gancho | lanza hacia arriba (`vy -8,6`) → juggle con patada voladora |
| Plancha | caída a `vy 13` y onda en área al tocar el piso |
| Dash | 12 cuadros, invencible, **rompe escudos** |
| Guardia y parry | bloquear resta 78 %; en los primeros 9 cuadros de guardia es parry: cámara lenta, aturde y carga furia |
| Agarre | a un mareado se lo agarra y se lo tira contra los otros |
| Furia | se llena pegando; doble daño y golpes imparables 8 s |
| Jump-cancel | cortar un golpe con salto. **Sin esto uno queda clavado en una fosa pegando trompadas** |
| Jefes | superarmadura: los golpes cargan una barra de **quiebre**; llena, tambalean 140 cuadros. Tres fases por vida |

Enemigos con personalidad por reglas simples: escudo de frente, tirador que guarda distancia, pesado
con carga y superarmadura, ninja que esquiva, elite que bloquea y remata. Separación entre enemigos
para que no se apilen.

---

## 9. Niveles procedurales

```js
function mulberry(a){ return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
rnd = mulberry(semilla32(semillaTexto+'#'+nivel));
```

- Un nivel = entrada + secuencia de **segmentos** + antesala + arena de jefe. Tipos: `pasillo`,
  `plataformas`, `trampa`, `tesoro`, `arena` (rejas que se cierran, 2–3 oleadas), `jefe`.
- Cada tema aporta su trampa: barriles, cintas y prensas, trenes, plataformas que se caen y torretas,
  fuego y pisos quebradizos, lava que sube.
- **Alcanzabilidad por construcción:** salto simple ≈ 84 de alto y 94 de largo; con margen,
  `SALTO_DH = 82`, `SALTO_DV = 70`. Ningún hueco del piso obligatorio pasa de eso, y `validar()`
  tapa con una tabla lo que se escape.
- **Trampa:** huecos sin fondo que te devuelven al principio = bucle infinito. Fosas de 34 de hondo
  (se sale de un salto) y caerse del mapa devuelve al **último piso firme**.
- **Trampa:** la arena contaba enemigos dormidos de otros tramos y no se limpiaba nunca. Contá sólo
  los de la oleada y los que quedaron encerrados.
- **Trampa:** las partículas usaban el rng del nivel y corrían la secuencia: una misma semilla dejaba
  de dar la misma partida. **Azar visual con `Math.random`, azar del mundo con `rnd()`.**
- Fin de nivel con rango S/A/B/C/D (tiempo, daño recibido, combo máximo, golpes), guita para la
  tienda, progreso en `localStorage` dentro de `try/catch`.

---

## 10. Audio sin archivos

- SFX con osciladores y un búfer de ruido: golpe (ruido filtrado + cuadrada que cae), fuerte, dash,
  parry (dos tonos agudos), tiro, explosión, moneda (dos notas), vida.
- Música por pasos: bajo + arpegio sobre una escala por nivel, bombo cada 4, redoblante cada 8;
  más aguda y con diente de sierra en la pelea de jefe; triángulo lento en el menú.
- El `AudioContext` se crea en el primer toque (`touchstart` con `{once:true}`).

---

## 11. Rendimiento

- Todo lo fijo va cacheado: cielo, tiras de fondo, patrón de tierra, halos de luz, piezas de
  personajes, textos, íconos.
- Las piezas horneadas cuestan menos que los trazos vectoriales: pasar los enemigos a piezas bajó el
  dibujo de 2,46 a 1,51 ms por cuadro.
- Límite de partículas (~190) y descartar lo que queda fuera de cámara.
- **Trampa: medir sin calentar miente.** El mismo dibujo daba 2,7 o 5,6 ms. Siempre 200 cuadros de
  calentamiento y 300 de medición, y comparar **contra el commit anterior en el mismo banco**
  (`git show HEAD:archivo`).

---

## 12. Banco de pruebas

Playwright headless con el Chromium del contenedor, viewport 412×892, `hasTouch`.

1. **Sintaxis:** `new Function(script)` sobre el contenido del `<script>`.
2. **Completabilidad:** un bot que camina, salta, pega, alterna golpe/gancho/dash y baja de tablas,
   con vida sostenida, en **3 semillas × 5 niveles**. La meta es 15/15.
   - **Trampa del instrumento:** si el bot deja una tecla apretada no hay flanco y el salto nunca
     sale. Dos vueltas se fueron culpando al juego.
   - Si una arena se traba >2400 cuadros, `matarTodo()` y anotarlo: separa «nivel imposible» de
     «bot tonto».
3. **Jefes:** sin tocarlos, cada uno tiene que desplegar su repertorio y llegar a fase 3.
4. **Toques reales:** por CDP (`Input.dispatchTouchEvent` con varios `touchPoints`), no con eventos
   sintéticos, que no traen `changedTouches`. Probá cada gesto y dos dedos a la vez.
5. **Capturas** de cada nivel, de la entrada del jefe y de cada menú; en animaciones, el cuadro pico.
   Hojas de contacto con PIL para mirarlas juntas.
6. **Rendimiento** A/B con calentamiento.
7. **Sondas que no mienten:** una sonda que escribe el estado que mide aprueba cualquier cosa; un
   número demasiado redondo suele ser la sonda rota.

---

## 13. Lista de trampas (resumen)

- [ ] Flancos de entrada consumidos al final del cuadro, no al principio.
- [ ] Nada de `setTimeout` para lógica de juego.
- [ ] Lienzo remedido con `ResizeObserver` + revisión periódica.
- [ ] Escala de pixelado **entera**.
- [ ] Patrones creados en el contexto donde se usan; sin `clip()` en pixel art.
- [ ] Gradientes y fondos cacheados, nunca por cuadro.
- [ ] Combo: los primeros golpes empujan poco.
- [ ] Jump-cancel del golpe.
- [ ] Fosas con fondo; caer del mapa → último piso firme.
- [ ] La arena cuenta sólo a los suyos.
- [ ] rng del mundo y azar visual separados.
- [ ] Piezas: el puño no tapa la cara, brazos con tope, lienzo de composición con aire.
- [ ] Un rol de color por cada cosa que cambie entre personajes.
- [ ] Botones con `touchstart`, `passive:false`; ojo con la especificidad del CSS.
- [ ] Todo botón que aparece tiene quién lo prenda.
- [ ] Bot de pruebas que suelta las teclas.
- [ ] Medir con calentamiento y contra el commit anterior.

---

## 14. Arranque rápido

1. Copiá el esqueleto de la sección 1 y el render de la sección 2; dibujá un rectángulo que camine.
2. Escribí `pose(e)` con quieto, corre, aire y un golpe. Probalo con muñecos de palitos.
3. Hacé el calco del protagonista (sección 3.2), partilo en piezas y conectalo a `pose`.
4. Generador con dos segmentos (pasillo y arena) y un enemigo. Bot de completabilidad desde el día uno.
5. Sumá combate con feel (sección 8) de a una mecánica, midiendo cada vez.
6. Fondos por tema, kit de enemigos, jefes con quiebre.
7. Fuente de píxeles, HUD, mandos flotantes con gestos.
8. Portada viva, tienda, rangos.

Referencia completa y funcionando: `juegos-pc/ElTipo.html`. Kit de enemigos:
`herramientas/kit_enemigos.py` y `kit_enemigos_tipos.py`. Calco del héroe:
`herramientas/calco_protagonista.py`. Bitácora con cada vuelta: `CLAUDE.md`.

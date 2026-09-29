# AEROPLAZA — la receta, sacada del código

Esto es lo que hace que AEROPLAZA se vea y se sienta como se siente: una plaza
social 3D estilo Frutiger Aero / menú de Wii, en un solo HTML. Salió de leer su
código entero (29/09/2026) y de correrlo en Chromium. Complementa a las otras
dos guías: [`GUIA-JUEGOS.md`](GUIA-JUEGOS.md) (3D fotorrealista con assets de
Rezona) y [`GUIA_JUEGOS_2D_PIXEL.md`](GUIA_JUEGOS_2D_PIXEL.md) (2D pixel art).
Esta es la del **3D estilizado hecho casi todo por código**.

Cada número está leído en el código o medido en el banco. Lo que es una
deducción y no está escrito en el código dice **(inferido)**.

---

## 0. Qué es y de dónde sale

- **El archivo:** `aeroplaza-con-canciones-21.html`, 10,8 MB. Lo pasó quien pide en el chat del 29/09/2026 como material para aprender. **No está en este repo** (es pesado y el repo es público); si hace falta, se le pide.
- **Adentro:** three.js r186 + addons (EffectComposer, UnrealBloom, OutputPass, GLTFLoader) y el juego, empaquetados y minificados con esbuild (las variables acortadas, pero las propiedades y los textos en castellano); 7 canciones MP3 en base64 (~7,4 MB); `window.ARCHIVOS` con 15 webp (cielo, ciudad, pasto, arena, motivos del avatar, el susto…) y un GLB (el delfín). Todo lo demás —edificios, avatar, árboles, agua, cielo, sonidos— es código.
- **Qué tiene:** 7 reinos (plaza, aqua, aurora, jardín, tienda, casa, juegos) unidos por un monorriel; avatar con 8 materiales, motivos, 13 sombreros y 8 peinados; parkour (6 mapas cronometrados); minijuegos (tiro de burbujas, runner "Aero.exe" con sustos, básquet, bolos, fútbol, mesas con IA); modo construir con 54 piezas; 16 NPC (11 con misión); tienda con dos monedas; chat, gestos y amigos con mensajes cifrados; voz de proximidad; planetario con el cielo real; VR con cardboard y WebXR; manos por cámara; 7 estilos retro; tres idiomas (es, en, pt).
- **Menú:** una grilla de "canales" a lo Wii (Plaza, Probador, Salas, Zona de Juegos, Mi casa, Discos, Opciones, Controles, Créditos, Estilo retro) con reloj y fecha abajo.

### Cómo se desarma un HTML así para estudiarlo

1. Separar por líneas: `<style>` → CSS; `window.ARCHIVOS=` → inventario de assets (nombre, tipo y tamaño de cada `data:`); el `<script>` grande → JS.
2. Reemplazar las corridas de base64 (`[A-Za-z0-9+/=]{2000,}`) por `<<B64 n>>`: de 9,3 MB de JS quedan 1,9 MB.
3. Sacar las líneas `<script>` y `</script>` y formatear con esbuild (`npm install esbuild` en el scratchpad; `esbuild juego.js --outfile=juego.fmt.js`): 36.675 líneas legibles.
4. El `export` de three.js (una línea con `REVISION: () => …`) da la tabla nombre corto → clase (`$` = Mesh, `Lt` = MeshPhysicalMaterial…). El código propio empieza donde aparecen las palabras en castellano.
5. Listar las declaraciones de nivel superior (`^  (var|let|function|class) `) y repartir tramos de ~1.500 líneas para leer en paralelo.

### Cómo se corre para probarlo

- `aeroplaza.html?directo&idioma=es&reino=plaza` entra directo a un reino sin menús (`reino` = plaza, aqua, aurora, jardin, juegos, tienda, casa).
- `?pausa` no arranca el bucle: se avanza a mano con `window.__A.paso(1/60)`. `window.__A` expone todo (motor, jugador `yo`, cámara, reino, sonido, red, UI).
- Más parámetros: `?calidad=alta|media|baja|minima`, `?x=&y=&z=&yaw=&pitch=&dist=`, `?hora=`, `?nivel=`, `?sinInstanciar`, `?depurar`.
- En el banco (Chromium con SwiftShader, 892×412 táctil): los 7 reinos cargan en 1,6–9,7 s, **cero errores de consola**, y sin red pide solo el cliente MQTT a dos CDN y sigue en solitario.

## La regla que ordena todo el look

1. **Un cielo por shader que alimenta todo:** la niebla toma su horizonte, los reflejos (PMREM) se regeneran desde él cada 8–60 s, el agua copia sus colores. Cambia la hora y todo combina solo.
2. **HDR con intención:** el sol ×24, su reflejo en el agua ×7, las estrellas y los chorros por encima de 1; bloom con **umbral 1,45**: florece solo eso, no las paredes blancas.
3. **Borde fresnel emisivo + clearcoat en todo** (edificios, avatar, árboles) y vidrio con iridiscencia: plástico caramelo iluminado por detrás.
4. **Una pasada final** con saturación 1,12 y viñeta 0,22 ("el Aero es hipersaturado"), y ahí mismo destellos, fundidos, agua y glitch por uniform.
5. **Todo redondeado y hecho por código:** cajas redondeadas, superelipses, biseles que agarran el brillo; 44 edificios fusionados por material.
6. **Todo se mueve:** viento en una sola onda para árboles, palmeras, pasto y flores; mariposas, peces, medusas, burbujas; latidos con senos desfasados.
7. **Game feel de plataformero:** aceleración con tope, coyote 0,12 s, buffer 0,14 s, salto variable (gravedad ×2,1 al soltar), squash & stretch, cámara que se acerca al instante y se aleja despacio.
8. **Interfaz de vidrio:** brillo arriba, borde blanco, sombra azul, rebotes con `cubic-bezier` que pasan de 1, y un sonido para cada toque.

---
## 1. La luz y el cielo

### 1.1 El renderer

- `antialias: false`, `powerPreference: "high-performance"`, `stencil: false`, salida sRGB, **`NeutralToneMapping`** y `PCFShadowMap`.
- El antialias no lo da el lienzo: lo da el MSAA del render target del post (4 muestras en PC con calidad alta, 0 en celular).
- Cámara de 60° al crearla, planos 0,1–2.400. Después el campo se fija por orientación: **72° con el celu parado, 58° acostado**, +12° en primera persona.
- Los errores de shader solo se chequean con `?depurar` en la URL (`checkShaderErrors`): en producción cuestan tiempo de arranque.

### 1.2 Un día de 10 minutos, atado al reloj real

```js
const hora = (Date.now() / 1000 / 600 + 0.18) % 1;          // un día = 600 s
const ang = (hora - 0.25) * 2 * Math.PI;
sol.set(Math.cos(ang), Math.sin(ang) + 0.02, 0.42).normalize();
const dia = smoothstep(sol.y, -0.12, 0.28);
const atardecer = Math.max(0, 1 - Math.abs(sol.y - 0.06) / 0.2);
renderer.toneMappingExposure = 1 + (1 - dia) * 0.25;        // la noche no queda negra
```

- Como sale de `Date.now()`, **todos los jugadores ven la misma hora sin mandarse nada** (inferido).
- Cenit de `(0,018; 0,04; 0,13)` a `(0,05; 0,3; 0,95)` con `dia`; horizonte de `(0,05; 0,13; 0,32)` a `(0,55; 0,84; 1)`.
- Sol: `#fff2dc`, que vira a `#ff9a55` con `atardecer × 0,8`; intensidad `2,1 × smoothstep(sol.y, 0, 0,2)`. De noche la misma luz hace de luna (`#9fb8ff`, 0,55).
- Hemisférica `0,18 + 0,32 × dia`. **La niebla toma el color del horizonte**: el borde del mundo se funde con el cielo.
- La sombra sigue al jugador: la luz a 80 u, caja de ±28, near 1, far 160, `bias −4e-4`, `normalBias 0,03`.

### 1.3 El domo del cielo, todo por shader

- Esfera de radio 1.000, `BackSide`, `depthWrite: false`, `renderOrder −10`, pegada a la cámara. El vértice hace `gl_Position = p.xyww`: queda siempre en el plano lejano.
- Degradé `pow(1 − h, 3,2)`; el naranja del atardecer solo del lado del sol: `atardecer × (0,35 + 0,65 × haciaSol²)`.
- **El sol en HDR, a propósito, para que el bloom lo abra en destello:**

```glsl
float s = max(dot(d, uSol), 0.0);
col += vec3(1.0, 0.92, 0.75) * (smoothstep(0.9993, 0.9997, s) * 24.0   // disco ×24
     + pow(s, 280.0) * 2.2 + pow(s, 12.0) * 0.28);                     // halo cerca y lejos
```

- Cúmulos proyectados sobre un techo plano (`d.xz / (h + 0,08)`): *domain warp* de 3 octavas + fbm de 5, cobertura `0,53 + 0,05 × sin(0,01 t)`. La luz de la nube sale de restar la densidad corrida hacia el sol, más un borde plateado:

```glsl
float luz = clamp(0.55 + (den - fbm(pw + normalize(uSol.xz) * 0.09)) * 4.0, 0.0, 1.0);
vec3 nube = mix(panza, blanco * 1.06, luz)
          + vec3(1.0, 0.95, 0.82) * pow(max(dot(d, uSol), 0.0), 6.0) * borde * 1.2;
```

- Encima, una foto panorámica repetida 4 veces hasta ~52° (cuenta como nube lo poco saturado, `smoothstep(0,42, 0,85, min/max)`), estrellas en una grilla `d × 220` con hash > 0,985, luna, **arcoíris** en un anillo de 0,6 ± 0,075 rad con el truco de tono `clamp(abs(mod(x·4,6 + vec3(0,4,2), 6) − 3) − 1, 0, 1)` y **aurora** de 4 cortinas `exp(−y² × 9)` de verde a violeta.
- Cada reino pide su cielo con un preset (hora, arcoíris, aurora, fondo, estrellas, música): el mismo shader da siete climas.

### 1.4 Reflejos que siguen la hora

- Una mini-escena con una esfera de radio 10 que usa **el mismo material del cielo** + un disco verde `#5fb04a × (0,15 + 0,85 × dia)` como suelo.
- `PMREMGenerator.fromScene(mini, 0.02)` cada 8 / 12 / 20 / 60 s según la calidad, con `dispose()` del mapa viejo. `environmentIntensity = 0,3 + 0,4 × dia`.
- Así el clearcoat y el vidrio reflejan el cielo de ESE momento, sin cubemaps horneados.
- El probador usa `RoomEnvironment` (sigma 0,04, intensidad 0,55): luz de estudio para mirar el avatar.

### 1.5 Destellos de lente

- 7 sprites aditivos (`depthTest: false`, `renderOrder 999`) con texturas de canvas de 128²: disco, anillo (radio 40→62) y hexágono (r 58).
- Sobre la recta sol→centro de pantalla: `[u, forma, tamaño] = [0 disco 3,2] [0,22 hex 0,5] [0,38 anillo 0,9] [0,55 hex 0,35] [0,72 disco 0,25] [0,9 hex 0,7] [1,15 anillo 1,4]`.

```js
const p = cam.position.clone().addScaledVector(sol, 500).project(cam);
const dir = new Vector3(p.x * (1 - 2*u), p.y * (1 - 2*u), 0.5).unproject(cam).sub(cam.position).normalize();
sprite.position.copy(cam.position).addScaledVector(dir, 6);
sprite.scale.setScalar(tam * Math.tan(fovRad / 2) * 2 * 0.55);   // mismo tamaño con cualquier campo
```

- Fuerza `dia × (1 − smoothstep(max(|x|,|y|), 0,75, 1,15))`: se apaga cuando el sol sale de cuadro, en interiores y bajo el agua. No mira oclusión.

## 2. El post-proceso

### 2.1 La cadena

```
render target HalfFloat (MSAA) → RenderPass → UnrealBloom(256², fuerza 0,38, radio 0,55, UMBRAL 1,45) → OutputPass → pasada final propia
```

- **Umbral mayor que 1:** florece solo lo que está en HDR (el sol ×24, su reflejo en el agua ×7, estrellas), no las paredes blancas. Es la diferencia entre "glow Aero" y "todo lavado".
- El bloom corre a 1/4 de resolución. Para que las chispitas no titilen, reemplazan su filtro de brillo por 4 muestras a ±1 píxel:

```glsl
for (int i = 0; i < 4; i++) {
  vec4 t = texture2D(tDiffuse, vUv + uPaso * vec2(i == 0 || i == 2 ? -1.0 : 1.0, i < 2 ? -1.0 : 1.0));
  suma += mix(fondo, t, smoothstep(umbral, umbral + suave, luminance(t.rgb)));
}
gl_FragColor = suma * 0.25;
```

### 2.2 La pasada final: una sola, con todo por uniform

- Por defecto **saturación 1,12** ("el Aero es hipersaturado") y **viñeta 0,22**:

```glsl
float l = dot(col, vec3(0.299, 0.587, 0.114));
col = mix(vec3(l), col, uSat);
vec2 v = vUv - 0.5;  col *= 1.0 - dot(v, v) * uVineta;
col += uColorDestello * uDestello;              // #bfe4ff: el flash al juntar algo
col = mix(col, uColorFundido, uFundido);        // fundidos sin DOM (sirve en VR)
```

- Prendidos por uniform, sin cambiar de shader: bajo el agua (`uv += (sin(40y + 2t), cos(34x + 1,7t)) × 0,0022` + tinte `col × (0,55; 0,9; 1,1) + (0; 0,05; 0,1)`), velocidad (5 muestras hacia el centro, `0,012 × vel × r`, más rayas `pow(azar, 18)`), aberración cromática (`(uv − 0,5) × ab × 0,006`, con `ab = aberración + destello×3 + glitch×5`), glitch a 18 saltos por segundo, oscurecer al cargar un poder (`col × (0,42; 0,5; 0,78)`).
- Las líneas de TV NO van en el shader: son un `repeating-linear-gradient` de CSS (1 px cada 3, parpadeo de 0,12 s) prendido con una clase en `body`. Gratis.

### 2.3 Estilos retro (una opción del menú)

- **Pixel:** 270 líneas, tramado Bayer 4×4, 8 niveles por canal. **PS1:** 200 líneas, 32 niveles. **Game Boy** y **8 bits:** 144 líneas.
- La resolución baja de verdad: `dpr = min(dpr, líneas / alto)` + `image-rendering: pixelated`. Por eso el estilo Pixel además va más rápido.
- El temblor de vértices PS1 se agrega al chunk global, prendido por `define`:

```js
ShaderChunk.project_vertex += `#ifdef PS1
  vec2 g = vec2(160.0, 120.0);
  gl_Position.xy = floor(gl_Position.xy / gl_Position.w * g + 0.5) / g * gl_Position.w;
#endif`;   // en cada material: defines.PS1 = ""; needsUpdate = true
```

- Game Boy aplica `pow(l, 1,3) × 1,15` antes de cuantizar, "porque la escena es clara y todo caía en los dos verdes de arriba".

## 3. Los materiales: la firma Aero

### 3.1 Borde fresnel emisivo en todo

```js
function conBorde(mat, color = "#fff", fuerza = 0.5, pot = 3) {
  const antes = mat.onBeforeCompile, clave = mat.customProgramCacheKey();
  mat.customProgramCacheKey = () => clave + "|borde" + pot.toFixed(1);   // programa propio
  mat.onBeforeCompile = (sh, r) => {
    antes?.(sh, r);                                                         // encadena
    sh.uniforms.uBordeCol = { value: new Color(color) }; sh.uniforms.uBorde = { value: fuerza };
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "$&\nuniform vec3 uBordeCol; uniform float uBorde;")
      .replace("#include <emissivemap_fragment>", `$&
        totalEmissiveRadiance += uBordeCol * uBorde *
          pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), ${pot.toFixed(1)});`);
  };
  return mat;
}
```

- Fuerza 0,1–0,45, potencia 2,5–3. Es lo que hace que todo parezca de plástico caramelo iluminado por detrás.

### 3.2 Tres familias y una paleta cacheada

| familia | receta |
|---|---|
| cerámica | Standard, `roughness 0,22`, borde 0,3 |
| caramelo | Physical, `roughness 0,12`, `clearcoat 1`, `clearcoatRoughness 0,06`, borde |
| vidrio | Physical, `roughness 0,04`, `clearcoat 0,6`, `opacity 0,12`, `iridescence 0,35`, `envMapIntensity 0,7`, `depthWrite: false`, borde `#dff8ff` 0,18 a potencia 2,5 |

- El vidrio es transparencia común, **no `transmission`** (que obliga a otra pasada de dibujo).
- 76 materiales con nombre (`aqua #43d8cd`, `verde #2fbf45`, `celeste #6db8f2`, `cromo` con metal 1…) creados **una sola vez**: todos los edificios comparten programas.
- Ventanas con emisivo 0,22–0,4 y `envMapIntensity` 1,8–2,2: parecen iluminadas por dentro.
- Las copas de los árboles también llevan clearcoat 1 y borde `#f2ffd0` 0,38: hasta la vegetación brilla.

### 3.3 Burbuja tornasolada en un shader corto

```glsl
float c = 1.0 - abs(dot(n, vV)), f = pow(c, 2.2);
vec3 tor = 0.55 + 0.45 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + c * 5.0 + vF * 3.0 + uT * 0.6));
float brillo = pow(max(dot(reflect(-vV, n), normalize(vec3(0.4, 0.8, 0.3))), 0.0), 60.0);
gl_FragColor = vec4(tor * f * 1.4 + pow(c, 7.0) * 0.8 + brillo * 2.5,
                    clamp((f * 0.85 + brillo + 0.04) * uOp, 0.0, 1.0));
```

- Transparente en el centro, arcoíris en el borde y un punto de brillo duro: la burbuja de jabón que define el estilo.

### 3.4 Texturas de canvas

- Carteles con emoji, el tablero de salidas del tren traducido, el vidrio del hotel (128×256: degradé `#7fe6f4 → #1f8fb8` con parantes de 3 px cada 32, repetido 20×14). Siempre con `colorSpace = SRGBColorSpace`.
- Texturas blancas de 1×1 de respaldo y banderas `uHayTex`: todo compila aunque falte una imagen.

## 4. Geometría procedural: una ciudad sin un modelo 3D

- **Un constructor que fusiona por material:** `pon(geo, "material", x, y, z, {ry, s, mirar, nombre})` apila piezas; `cerrar()` hornea las matrices, deja solo `position/normal/uv/color` (rellena lo que falta) y arma **una malla por material**. Las transparentes quedan con `renderOrder 4` y sin sombra.
- Lo que tiene `nombre` queda aparte para animarlo: rotor del molino, agujas del reloj, puertas, el haz del faro.
- Cada modelo guarda `tam` y `medidas` (asiento, puerta, andén): el resto del juego sabe dónde sentarse o por dónde entrar.
- **44 modelos** hechos así (casa, estación, tienda, hotel, tren, fuente, banco, farol, árbol, palmera, terminal, molino…), cacheados; un clon comparte geometría y material y escala también sus medidas; lo repetido va en `InstancedMesh` con `[x, y, z, escala, giroY]` y tintes.
- Primitivas que dan el look redondeado:
  - **caja redondeada** (`RoundedBoxGeometry`) para casi todo;
  - **superelipse** con normal por diferencias (`x = a/2 × sgn(sen θ) × |sen θ|^(2/n)`): la casa es de 9 × 7,4 con n = 3,2;
  - **extrusión con bisel en 4 pasos**: el bisel agarra el brillo del borde;
  - cinta vertical sobre una polilínea para ventanales curvos; arbustos de esferas fusionadas; color por vértice (el toldo a rayas es `floor((atan2(z,x)/2π + 1) × 16) % 2`).
- El detalle obedece a la calidad: segmentos `min(seg, calidad.seg)`, curvas `round(n × calidad.curvas)` con un piso.
- Números que se ven: hotel de 14 pisos × 3 m; chorros de la fuente en la parábola `y = 3,9 + 1,1n − 4,35n²`; palmera con tronco `0,36 × (1 − 0,42u)` y 20 anillos.

## 5. Pasto, flores, árboles, piso y agua

### 5.1 Pasto que viaja con el jugador (16.000 matas, cero CPU)

- Cada instancia: una mata de 5 hojas de 0,13–0,26 m, color de `(0,076; 0,21; 0,03)` a `(0,45; 0,9; 0,08)`, **normales forzadas hacia arriba** (0, 1, 0): se ilumina parejo como un césped, no como papelitos.
- `InstancedBufferGeometry` + `MeshLambertMaterial`. Las matas se envuelven alrededor del jugador en el shader:

```glsl
vec2 base = uJugador.xz + mod(aInst.xy - uJugador.xz + uR, 2.0 * uR) - uR;   // toroidal
vec2 hm = mapa(base);                                   // r = altura, g = ¿acá hay pasto?
float esc = aInst.w * step(0.5, hm.y)
          * (1.0 - smoothstep(0.7, 1.0, length(base - uJugador.xz) / uR));   // se achica en el borde
```

- El mapa es un Float32 de 256² (512 si el área pasa de 340 m) con `NearestFilter` y bilineal hecho a mano, "porque no todas las placas filtran flotantes".
- Dos anillos: n/4 con R = 13 m y n/2 con R = 26 m desde los 11 m (hojas ×1,2).
- Se aparta del jugador a menos de 0,9 m (en el shader de viento).

### 5.2 Flores, árboles y piso

- Flor: pétalo de 5 lóbulos `r = 0,05 + 0,055 × |cos 2,5θ|^0,7`, ahuecado con `y = 4r²`; tres `InstancedMesh` (pétalo, centro, tallo) que comparten matrices; cada 0,5 s se compactan las que están a menos de 60 m. En la plaza, en manchones donde el ruido pasa 0,1.
- Árboles con dos niveles (cerca / lejos sin sombra y con menos esferas); cada 0,5 s se reparten según la distancia (50–75 m) y se ocultan más allá del corte. Giro de `i × 2,4` rad (casi el ángulo áureo) y 4 tintes (`#fff`, `#e4ffd8`, `#fff6d0`, `#d8fff0`).
- Piso de 260² con 220² segmentos, color por vértice y un atributo de arena; la textura solo pone el detalle, dividida por su propio promedio (el último mip):

```glsl
vec3 tp = texture2D(uPasto, vMundo * 0.11).rgb * 0.6 + texture2D(uPasto, vMundo * 0.023 + 0.37).rgb * 0.4;
vec3 prom = texture2D(uPasto, vec2(0.5), 12.0).rgb;
diffuseColor.rgb *= mix(vec3(1.0), tp / max(prom, vec3(0.04)), 0.75);   // detalle sin cambiar el color
```

### 5.3 Agua en dos triángulos

- Un plano de 3.000² con **1×1 segmentos**. La profundidad está precalculada en un `DataTexture` R8 (`byte = (nivel − altura) × 20`).

```glsl
vec3 n = normalize(vec3(-g.x, 1.0, -g.y));                 // g = derivada de 4 trenes de olas
float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
vec3 col = mix(uPlaya, uHondo, 1.0 - exp(-prof * 0.28));    // #3ff0dd → #0a4fb0
col += vec3(0.7, 1.0, 1.0) * pow(1.0 - min(c1, c2), 8.0)
     * (1.0 - smoothstep(0.2, 3.5, prof)) * 0.55;          // cáusticas solo en lo bajo
col = mix(col, mix(uHor, uCenit, clamp(R.y * 2.5 + 0.25, 0.0, 1.0)), fres * 0.6);
col += uSolCol * pow(max(dot(R, uSol), 0.0), 260.0) * 7.0; // el reflejo del sol, en HDR para el bloom
float alfa = max(mix(0.35, 0.93, smoothstep(0.0, 3.0, prof)), max(fres, espuma) * 0.9);
```

- Espuma de orilla `smoothstep(0,45, 0, prof + 0,08 × sin(1,3t + …))`. El sol y los colores del cielo se copian del domo en cada cuadro: el agua siempre combina con la hora.

### 5.4 Viento: una sola onda para todo

```glsl
float fase = dot(base.xz, vec2(0.13, 0.11));
float rafaga = 0.55 + 0.45 * sin(uT * 0.45 - dot(base.xz, vec2(0.018, 0.012)))   // ola lenta que cruza en diagonal
             * (0.7 + 0.3 * sin(uT * 0.17 + base.x * 0.01));
float s1 = sin(uT * 1.15 + fase) * 0.55 + sin(uT * 2.05 + fase * 1.7) * 0.28 + sin(uT * 3.3 + fase * 2.3) * 0.1;
vec2 w = vec2(0.82, 0.57) * (0.45 + s1) * rafaga * FUERZA * uViento * 0.075;
float k = clamp(position.y / ALTO, 0.0, 1.4);  k *= k;                          // la base no se mueve
transformed.xz += (transpose(giro) * vec3(w.x, 0.0, w.y)).xz * k * ALTO;       // viento del mundo, en local
transformed.y  -= dot(w, w) * k * ALTO * 0.8;                                   // al doblarse, baja la punta
```

- Árbol fuerza 0,55 / alto 5,7 (la copa además tiembla 0,035 sobre la normal); palmera 1 / 6,3 con aleteo 0,02; pasto y flores con tres senos ×0,09.
- Todo comparte `{uT, uJugador, uViento}`; `uT` se suma una vez por cuadro. En el "sueño" el viento sube a 3.
## 6. El avatar: cinco primitivas, cero archivos

### 6.1 El cuerpo

- Torso: `LatheGeometry` sobre un `SplineCurve` de 12 puntos (radio máx. 0,252, de y 0,38 a 0,85; 30 muestras × 36 lados). Cabeza: esfera de 0,215 en y 1,1. Brazos: cápsula 0,084 × 0,33. Piernas: cápsula 0,11 × 0,2.
- Hombros en ±0,292 a 0,79 m; caderas en ±0,128 a 0,42 m. Mide 1,32 m y es cabezón: un *meeple* (así se llama su programa de shader).
- **Pivote sin tocar vértices:** la geometría se arma ya en su lugar; el `Group` va en la articulación y la malla se corre al revés.

```js
const hombro = new THREE.Group();
hombro.position.set(lado * 0.292, 0.79, 0);
const brazo = new THREE.Mesh(geoBrazo, mat);   // geoBrazo ya está ubicada en el hombro
brazo.position.set(-lado * 0.292, -0.79, 0);
hombro.add(brazo);
```

- **Atributos horneados** para pintar sin UV hechas a mano: `aAlto` (la y), `aParte` (0→1 dentro de cada parte) y `aUvm` (UV cilíndrica: `u = (atan2(x − xc, z)/2π + 0,5) × 2`, `v = y × 2,2`).
- Ojos en 3 capas (aro oscuro 1,18×, iris, brillo blanco corrido arriba): esferas aplastadas apoyadas en la cabeza a ±0,35 rad.
- Accesorios (13 sombreros, 8 peinados, corona de 7 conos, alas de 2 béziers, capa = plano curvado `z = x² × 1,4`), todos con primitivas. El cartel del nombre sube según la caja de los accesorios: `max(1,52, tope − raíz + 0,12)`.
- Una sola geometría de cuerpo y **un solo programa de shader para todos los avatares**.

### 6.2 Un material con carácter

Un `MeshPhysicalMaterial` por tipo, con GLSL inyectado. Todos con clearcoat 1 salvo mate, y `sheenColor = color2`:

| tipo | rugosidad | metal | iridiscencia | env | borde | "adentro" |
|---|---|---|---|---|---|---|
| gelatina | 0,14 | 0 | 0,15 | 2,2 | 0,55 | 0,22 |
| vidrio (opacidad 0,62) | 0,14 | 0 | 0,4 | 2,2 | 0,8 | 0,12 |
| perla (sheen 1) | 0,14 | 0 | 1 | 2,2 | 0,25 | 0 |
| cromo | 0,08 | 1 | 0,15 | 3,2 | 0,25 | 0 |
| mate | 0,62 | 0 | 0,15 | 2,2 | 0,25 | 0 |
| neón | 0,14 | 0 | 0,15 | 2,2 | 1,6 | 0,55 |
| holo (IOR 1,9; 150–1100 nm) | 0,1 | 0,25 | 1 | 2,8 | 0,8 | 0,1 |
| diamante (flatShading, IOR 2,2) | 0,02 | 0,1 | 0,7 | 3,8 | 0,7 | 0,18 |

```glsl
diffuseColor.rgb = mix(uCol2, diffuseColor.rgb, mix(1.0, smoothstep(0.0, 0.85, vParte), uDegrade));
float ola   = sin(vUvm.x*6.2832*1.5)*0.045 + sin(vUvm.x*6.2832*3.3 + 1.7)*0.02;
float banda = 1.0 - smoothstep(uCubre - 0.03, uCubre + 0.03, vParte + ola);
diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(uTex, vUvm).rgb, banda);             // motivo hasta "cubre"
diffuseColor.rgb += 0.85 * (1.0 - smoothstep(0.0, 0.035, abs(vParte + ola - uCubre)));   // espuma en la línea
// en <emissivemap_fragment>:
float fres = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.6);
totalEmissiveRadiance += mix(diffuseColor.rgb, uCol2, 0.5) * fres * uBrillo + diffuseColor.rgb * uAdentro;
```

- El **motivo** (agua, nubes, galaxia, hojas…) llena el muñeco hasta `cubre` (0,42 por defecto) con una línea de flotación ondulada y espuma: parece un frasco con líquido adentro.
- `uAdentro` finge luz interna; el fresnel da el halo. Diamante: celdas `floor(uv × (22, 14))` con hash y destellos `pow(max(0, sin(h×60 + N·V×26)), 28)` que titilan al girar.
- Trampa anotada en el código: con `flatShading` no existe `vNormal`; hay que usar `normal`.

## 7. Animación procedural: poses como datos

### 7.1 Poses dispersas + espejo

- Cada pose guarda solo los canales que usa: cadera (`cx cy cz ry pz sy`), cabeza (`hx hy hz`), miembros (`bl br pl pr`, cada uno [x, y, z]) y `giro`.
- La mitad del ciclo sale del espejo:

```js
const inv = ([x, y, z]) => [x, -y, -z];
const espejo = p => ({ ...p, bl: inv(p.br), br: inv(p.bl), pl: inv(p.pr), pr: inv(p.pl),
                       ry: -p.ry, cz: -p.cz, hy: -p.hy });
const camina = { dur: 0.8, loop: true, k: [{ t: 0, ...contacto }, { t: 0.2, ...paso },
                 { t: 0.4, ...espejo(contacto) }, { t: 0.6, ...espejo(paso) }] };
```

- Duraciones (s): camina 0,8 · corre 0,6 · salta 0,42 · cae 0,5 · aterriza 0,3 · desliza 0,36 · rueda 0,56 · trepa 0,46 · valla 0,4 · sube pared 0,36 · pared 0,36.
- Interpolación con smoothstep; si hay `giro`, se corrige el pivote para rotar alrededor del centro del cuerpo (`cx += g; cy += 0,55 (1 − cos g); pz −= 0,55 sin g`). Correr por la pared = el clip de correr a 1,3× + rolido de 0,5 rad hacia la pared.

### 7.2 El carácter, en números

- Caminando: piernas −1,32 / +0,2 rad en el contacto, rebote +0,035 / −0,015, `sy` 1,01 / 0,99.
- Corriendo: torso inclinado 0,38–0,5 rad, sube +0,09 y baja −0,06, estira 1,05 / 0,95. **La cabeza contragira −0,3 / −0,38 para seguir mirando al frente.**
- Salto: brazos a −2,95 rad en 0,1 s. Deslizar: torso −1,02, cabeza +0,72. Aterrizar: `sy` 0,78.

### 7.3 El corazón del animador

```js
this.tPaso += dt * clamp(vel / (corre ? 7.2 : 3.4), 0.45, 1.5);   // la cadencia sigue a la velocidad real
const k = 1 - Math.exp(-dt * (hayClip ? 26 : 14));                 // suavizado exponencial POR CANAL
suave[c] = suave[c] === undefined ? obj[c] : lerp(suave[c], obj[c], k);
const g = aplasta * aplasta;
cadera.scale.y = sy * (1 - 0.26 * g + 0.12 * estira);              // squash & stretch
cadera.scale.x = cadera.scale.z = 1 + 0.14 * g - 0.05 * estira;
incl = lerp(incl, clamp(-velGiro * 0.07 * Math.min(1, vel / 3.5), -0.32, 0.32), 1 - Math.exp(-dt * 8)); // se inclina en la curva
```

- **El suavizado por canal funde cualquier cambio de estado: no hace falta una máquina de transiciones.**
- Al tocar el piso `aplasta = min(1, 0,5 + tAire × 0,8) × 0,6` y baja 3,2/s; al despegar `estira = 1` y baja 3,5/s. Con más de 0,3 s en el aire entra además el clip de aterrizaje con peso `1 − u²`.
- A 3,4 m/s salen ~1,36 m por paso: los pies no patinan (inferido).
- "Cae" arranca recién tras 0,12 s en el aire: bajar un escalón no hace parpadear la animación.
- Estados a puro seno: nadar (torso 1,25 rad, brazos `−2,4 ± 1,1 sin 5t`), flotar, sentado, hamaca, montado. Quieto: `sy = 1 + 0,012 sin 2,2t` y la cabeza pasea `0,25 sin 0,37t`; a los 9 s quieto, 2,6 s de "ocio" (se estira, mira) con envolvente `sin(π t / 2,6)`.
- 11 gestos (saludar, festejar, aplaudir, bailes, voltereta de 1,1 s, "poder" que carga 0,4 s y suelta 0,12 s) que se cancelan al moverse.
- Movimiento secundario: alas `0,5 ± 0,25 sin 4t` (18 rad/s al caer), molinete `2,5 + 2,2 × vel` rad/s, la capa se levanta `0,1 + min(0,95, 0,11 × vel)`, parpadeo de 0,12 s cada 2,5–6 s (20 % doble).
- **Estilo "chop"** (opción): el tiempo se cuantiza a 12 fps, curva en escalones y sin suavizado. Stop-motion con un switch.
- Primera persona: el cuerpo pasa a un material con `colorWrite: false, depthWrite: false`: no se ve pero sigue haciendo sombra.

### 7.4 Lo vivo alrededor

- **Mariposas:** un plano de 2 segmentos que el vertex shader pliega por el medio, con la fase sacada de la posición de la instancia:

```glsl
float fase = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 1.7;
float a = sin(uT * 16.0 + fase) + 0.2;
float d = abs(transformed.x);
transformed.x = sign(transformed.x) * d * cos(a);
transformed.y = d * sin(a);
```

- **Peces:** elipsoide + 2 conos de 4 lados fusionados, lomo al 85 % por color de vértice, cola `x += sin(9t + fase) × k² × 0,12`; cardúmenes de 26 en una órbita de 10 m.
- **Medusas:** los tentáculos ondean más cuanto más abajo; campana con fresnel que late `(1 − 0,08i; 1 + 0,1i)`.
- **Burbujas:** suben a 0,6–1,4 m/s, crecen al salir y revientan al tocarlas.
- **Agua que cae:** cilindro abierto de 48 columnas o cinta de 26; rayas con velocidad al azar por columna, espuma que late ±8 %, 80–90 partículas en parábola.
- **Piso de vidrio con cáusticas baratas:** `pow(abs(sin(p.x×1,3 + sin(p.y×1,1 + t)×1,5) × sin(p.y×1,2 + sin(p.x×0,9 − 0,8t)×1,4)), 6)`.
- **Vaivén con frecuencias que no se sincronizan** (velero: `y 0,12 sin 0,9t`, rolido `0,05 sin 0,7t`, cabeceo `0,03 sin(0,55t + 1)`).
- **"Boing" amortiguado** para todo lo que rebota: `s = sin(16t) × e^(−4t) × 0,3` durante 1 s, escala `(1 + s, 1 − s, 1 + s)`.
- **Latidos con senos desfasados:** el orbe `0,8 + 0,2 sin 5t + 0,08 sin 13t`; el neón parpadea con `sin(9t) > 0,93 ? −0,4 : 0`.
## 8. Moverse: física y game feel

### 8.1 Las constantes (y lo que midió el banco)

| qué | valor | medido con pasos fijos de 1/60 s |
|---|---|---|
| radio / alto | 0,32 m / 1,35 m (0,72 al deslizar o rodar) | |
| caminar | 3,4 m/s | 3,34 m/s de promedio en 2 s desde quieto |
| correr | 7,2 m/s | 6,89 m/s de promedio en 2 s desde quieto |
| salto | 8,6 m/s (doble ×0,85, de pared ×0,95) | pico 1,61 m sosteniendo; 1,02 m soltando a los 4 cuadros |
| gravedad | 24 m/s² (órbita 15; otro reino 21 con aire 26) | |
| nadar | 2,8 m/s (×1,5 corriendo) | |
| aceleración piso / aire | 38 / 9 m/s² (frena con la misma) | |
| coyote / buffer de salto | 0,12 s / 0,14 s | |
| escalón / pegado al piso | 0,45 m / 0,35 m | |
| rueda / deslizada / trepar | 0,56 s / 0,8 s / 0,46 s | |

- Con 8,6 m/s y g = 24 el salto sube 1,54 m; **al soltar el botón mientras subís, la gravedad pasa a 2,1×** y queda en ~0,73 m. El doble salto agrega 1,11 m.

### 8.2 Aceleración con tope (no hay fricción aparte)

```js
const acel = enPiso ? 38 : (mundo.acelAire || 9);
const dif = new Vector2(obj.x - v.x, obj.y - v.z);   // obj = (corre ? 7,2 : 3,4) × (agua baja ? 0,6 : 1) × (0,75 + 0,25 × escala)
if (dif.length() > acel * dt) dif.setLength(acel * dt);
v.x += dif.x; v.z += dif.y;
```

- En el piso llega a 3,4 m/s en 0,09 s y frena de 7,2 a 0 en 0,19 s: responde al toque. En el aire tarda 0,8 s: quedás atado al salto que elegiste.
- Los movimientos especiales cambian el objetivo y la aceleración (60 corriendo por pared, 80 deslizando, 2,5 tras un salto de pared).

### 8.3 El salto que se siente bien

```js
buffer = entrada.salta ? 0.14 : buffer - dt;
coyote = enPiso ? 0.12 : coyote - dt;
v.y -= g * dt;
if (!entrada.sostiene && v.y > 0 && !lanzado) v.y -= g * dt * 1.1;    // soltar = salto corto
if (buffer > 0) {
  if (coyote > 0) { v.y = 8.6; saltos = 1; }
  else if (pared?.t > 0) saltoDePared();                               // tangencial ×0,92 + normal × 6,8
  else if (saltos < 2) { v.y = 8.6 * 0.85; saltos = 2; }
}
```

- `lanzado` apaga el corte en géiseres, rebotes y saltos de pared: soltar el botón no te frena el géiser.

### 8.4 Choques 2,5D con subpasos

- Cada sólido es un cilindro o una caja rotada en XZ con un rango de altura `y0–y1`, en una grilla hash de 16 m (`clave = cx × 4096 + cz`) que se rehace solo al agregar o quitar.
- **Todo lo que mide menos de 0,45 m es piso y se sube solo** (`suelo()` toma los topes con `y1 ≤ y + 0,45`).
- Con una caja se pasa a su espacio local y se sale por el eje de menor penetración:

```js
let lx = dx * c - dz * s, lz = dx * s + dz * c;
const penX = hx + radio - Math.abs(lx), penZ = hz + radio - Math.abs(lz);
if (penX > 0 && penZ > 0) {
  if (penX < penZ) lx = Math.sign(lx || 1) * (hx + radio);
  else             lz = Math.sign(lz || 1) * (hz + radio);
  p.x = caja.x + lx * c + lz * s; p.z = caja.z - lx * s + lz * c;
}
```

- Orden: horizontal → vertical → techo (`v.y = min(0, v.y)` al pegar la cabeza) → piso. El piso se busca desde `y + max(0, −v.y × dt)`: cayendo rápido no atravesás un piso de 5 cm. Si venías en el piso y el desnivel es < 0,35 m, te pega al suelo: bajás escaleras sin "volar".
- **Subpasos de medio radio y la normal de la pared gratis:**

```js
const pasos = clamp(Math.ceil(velXZ * dt / (radio / 2)), 1, 8);   // nunca más de 16 cm sin chequear
let ex = 0, ez = 0;
for (let i = 0; i < pasos; i++) {
  p.x += v.x * dt / pasos; p.z += v.z * dt / pasos;
  const x0 = p.x, z0 = p.z; mundo.empujar(p, radio, alto);
  ex += p.x - x0; ez += p.z - z0;                 // lo que te corrió el choque
}
const e = Math.hypot(ex, ez);
if (!enPiso && e > 0.002) pared = { nx: ex / e, nz: ez / e, t: 0.22 };   // de acá salen salto y carrera por pared
```

### 8.5 Parkour como estados `mov {tipo, t, dur, dir, v0}`

- **Deslizada:** agacharse en el piso (o mantenerlo a más de 2,5 m/s); `v0 = max(vel × 1,12, 7,6)` (8,4 si ibas a más de 3,9); pierde 6 m/s² sin bajar de 2,4; bajo un techo se estira de a 0,1 s; enfriamiento 0,25 s.
- **Rueda:** aterrizar a más de 11,5 m/s (≈ 2,75 m de caída) moviéndote a más de 2,4 m/s → `v0 ≥ 6,2` durante 0,56 s.
- **Trepar un borde:** en el aire, 0,62 m adelante, un borde a 0,45–2 m sobre los pies, plano arriba y con 1,35 m libres; si está hasta 3,4 m, primero "sube la pared" a 5,5 m/s.

```js
const a = t / 0.46, sube = 1 - (1 - Math.min(1, a / 0.6)) ** 2;
const avanza = Math.max(0, (a - 0.45) / 0.55);                    // primero subir, después pasar
p.set(lerp(p0.x, p1.x, avanza), lerp(p0.y, p1.y, sube), lerp(p0.z, p1.z, avanza));
```

- **Valla:** a más de 3 m/s y con un obstáculo de 0,5–1,25 m; dura `0,3 + dist × 0,05` s, sube con seno hasta el tope + 0,3 y salís a `max(vel, 5,5)`.
- **Correr por la pared:** velocidad tangencial ≥ 3,5, a ≥ 0,7 m del piso, 450 ms desde la última; arranca con 2,2 m/s hacia arriba, objetivo `dir × max(v0, 6,5) − normal × 1,2` (te aprieta contra la pared para no perder la normal), gravedad al 20 %, se corta tras 0,12 s sin pared.
- Al terminar de trepar o de saltar la valla, `coyote = 0,12`: podés encadenar el salto.

### 8.6 Game feel sin acoplar sistemas

- **La física deja eventos en una cola** (`aterriza` > 4 m/s, `impacto` > 14, `chapuzon`, `brazada`, `salpica`, `caida`…); el sonido y la cámara los leen. El mundo no sabe nada de UI ni de audio.
- Agua: nadás con más de 0,95 × escala de profundidad y flotás con un resorte amortiguado `v.y += ((agua − 0,72 − y) × 5 − v.y) × min(1, 4dt)`; con más de 0,15 m de agua caminás al 60 %.
- Giro por el ángulo más corto: `a + normalizar(b − a) × min(1, k × dt)` con k = 12 a pie y 2,2 en delfín.
- Frutas con efectos de 45 s: grande ×1,7, chico ×0,55 (la escala cambia radio, alto, velocidad y salto), gravedad ×0,45…
- Flor-trampolín con squash `(1 + 0,25a, 1 − 0,4a, 1 + 0,25a)`; géiser con ciclo de 7 s (activo desde el 64 %, rampas de 0,35 s) cuya `fuerza` escala a la vez el chorro, el alfa y el empuje (17–23 m/s).
- Delfín montable: 9 o 13 m/s, nunca baja del 35 % aunque sueltes el stick, gravedad propia de 22, bucea hasta el fondo + 0,8.

### 8.7 El kit de parkour (6 mapas cronometrados)

- Piezas: plataforma, disco, móvil (ida y vuelta con smoothstep o lazo Catmull-Rom; **si estás parado encima te suma su desplazamiento de cada cuadro**), barra giratoria (el golpe se calcula en su marco local, empuje `6 + |vel| × dist × 0,9`: la punta pega más), rebote, frágil (tiembla 0,7 s, desaparece 2,9 s con 16 chispas y vuelve), cinta (la textura corre a la velocidad con que empuja), géiser, control, meta, línea de orbes, tubo, muro.
- Cuenta de 3,4 s con el jugador clavado; caer bajo el piso de muerte te devuelve al último control; control a 2 m (30 chispas), meta a 2,4 m (60 chispas).
- Estrellas por tiempo (3★/2★): nubes 50/70 s, acuario 65/90, jardín 70/100, ciudad 75/105, órbita 85/120, azoteas 45/70. 20 orbes la primera vez y 5 por cada estrella nueva.
- Ritmo del primer mapa: centros cada 5 m subiendo 0,8 m en zigzag de ±2–3 m, 3 orbes marcando los huecos largos, controles cada ~50 m.
- Orbes con caja generosa (±1,1 m, ±1,4 m) que reaparecen a los 90 s; flotan `0,15 sin(2t + n)` y laten ±6 %.

### 8.8 Lo que coincide sin red: horarios con `Date.now()`

- El monorriel (17 m/s de crucero, 1,5 m/s², 11 s por parada, 16 s en la terminal, vagones de 8,2 m) ubica sus dos trenes con `Date.now()/1000` módulo el período. Igual que el día de 10 minutos: **todos los clientes ven lo mismo sin mandarse nada**.

```js
const tarda = d => d >= VMAX * VMAX / ACEL ? d / VMAX + VMAX / ACEL : 2 * Math.sqrt(d / ACEL);  // trapecio o triángulo
const t = ((Date.now() / 1000) / periodo + tren.desfase) % 1 * periodo;
```

- La viga se extruye de un perfil de 16 vértices y se corta en mallas de 40 m para que funcione el recorte por pantalla; pilares cada 18 m corridos 0/±3/±6/±9 m hasta quedar fuera de los caminos.
## 9. Componer un mundo que se ve rico

### 9.1 La plaza: terreno como suma de funciones

- **Costa** que cierra sin costura (el ruido se toma sobre un círculo) y con una bahía cavada:
  `r(θ) = 222 + ruido(cos θ, sen θ) × 18 + 8 sin(3θ + 1) + 3,5 sin 7θ − 50 e^(−(Δθ/0,3)²)`.
- **Relieve:** colinas gaussianas, un monte `38 e^(−(r/46)²)` con la cima aplanada y una playa de 18 m. Cada lugar (fuente, estación, ciudad) se aplana con smoothstep.
- **Caminos que serpentean** con un seno que se anula en las puntas; los objetos se sacan del camino subiendo por el gradiente de la distancia (pasos de 0,4, máx. 40):

```js
const u = Math.sin(c * largo * 0.28 + ax) * 1.2 * Math.min(1, c * largo / 6, (1 - c) * largo / 6);
```

- **Color por vértice con reglas:** anillos cada 2,5 m alrededor de la fuente, grilla de 3,2 m en la ciudad, camino, arena, roca donde la pendiente pasa 0,3, pasto alpino arriba de 24 m, bosque más oscuro. La textura de detalle solo pone el grano (dividida por su promedio); el vértice pone el color.
- El terreno mide 580 m y concentra vértices al centro (`apretar 0,45`: 1,8× más denso donde se juega). Segmentos por calidad: 256 / 220 / 150.

### 9.2 Densidad con reglas de lugar

- 16.000 pastos × calidad, hasta 4.400 flores en manchas de ruido, ~420 árboles (4,2–9 m de separación mínima), 100 palmeras, 110 orbes, 40 mariposas, 66 peces, 90 burbujas, 8 medusas, 6 CD con su canción (cada uno en un mirador) y 8 NPC.
- Se siembra por rechazo (hasta N × 8 intentos) con un azar con semilla (xorshift32): **el mundo sale igual en todas las máquinas**, así no hay que mandarlo por la red.
- Reglas que hacen que no parezca tirado al azar:
  - corredores libres (los árboles a más de 6 m del monorriel; el parkour sin decorado en `|x| < 28`);
  - **todo mira a algo**: casas y bancos a la fuente, palmeras al mar, hoteles a la ciudad, con ±0,3–0,4 rad de desorden;
  - faroles cada 26 m, alternando de lado a 3,2 m del camino;
  - **orbes como migas de pan**: anillos por zona y una espiral de 16 que sube el monte (te dicen a dónde ir).
- De noche: faroles a `0,3 + 3,2 × noche`, haz del faro a `0,05 + 0,3 × noche`, carteles del hotel a `0,25 + (1 − día) × 1,2`, ventanas de los edificios con `emissiveMap` que se prende.
- **Brillo sin luces:** una bombita con `toneMapped: false` + un halo aditivo al 30 %. Un farol son dos mallas y ninguna luz.

### 9.3 Zonas con su música

- Círculos con radio: terminal 34, juegos 26, ciudad 58, bahía 74, pradera 70, bosque 66, monte 70 y, al final, plaza 90. Se busca la primera que contiene al jugador, así **la zona chica le gana a la grande**. Se evalúa cada 0,5 s, con histéresis (radio × 1,08 para salir).

### 9.4 Cada reino, una receta distinta con las mismas piezas

- Receta común: altura con `max` de formas + ruido con semilla; terreno con color por vértice (4.º canal = arena); mar con color de orilla y de fondo; cada malla con su colisionador puesto a mano; cerámica con borde + vidrio con iridiscencia.
- **Aqua:** isla con meseta de 1,4 m, costa `34 + ruido(ángulo) × 5`, orilla `#3ff5e6`, fondo `#0a5fd0`; hotel de 7 pisos de vidrio `#7fdcff` (clearcoat 1, opacidad 0,75); 60 corales emisivos; 10 aros de carrera; 5 delfines; medusas; 44 orbes. El paso por un aro no falla a ninguna velocidad:

```js
const antes = prev.clone().sub(aro.p).dot(aro.n), ahora = pos.clone().sub(aro.p).dot(aro.n);
if (Math.sign(antes) !== Math.sign(ahora) && pos.distanceTo(aro.p) < 3.2) pasó();   // cruzó el plano cerca del centro
```

- **Aurora:** de noche (hora 0,02, hemisférica `#9fb8ff`), rodeado de montañas `smoothstep(60, 110, r) × 14`, lago con `envMapIntensity 2`, hasta 46 cristales translúcidos, un octaedro con `iridescence 1`, circuito aéreo sobre una Catmull-Rom de 8 puntos y una estrella fugaz cada 5–9 s con estela de 200 puntos.
- **Jardín:** 7 islas, agua menta `#6ff0c8`, 12.000 pastos, 900 flores, nenúfares caminables, 9 géiseres, 8 flores-trampolín; los nenúfares gigantes por ángulo áureo (2,39996) descartando los que quedan a menos de 16 m. **Hay orbes al 75 % de la altura de cada chorro: el nivel enseña la mecánica.**
- **Tienda:** 22 × 16 m con piso damero de canvas; la sala es un `RoundedBox` de radio 1,2 con `BackSide` (esquinas curvas sin modelar), una sola `PointLight`, vitrinas con maniquíes que giran, espejo de metal 1 y ropa doblada fusionada en una malla.
- **Casa:** isla flotante (más allá de r 26 el terreno cae a −60) con un cono de roca abajo, patio de r 10,5 y la casa.

### 9.5 Construir: el catálogo es datos

- Cada pieza: `{cat, ico, color, paso, piso?, techo?, pared?, f(color) → [grupo, [ancho, fondo, alto], colisionadores?]}`. 12 de obra, 18 muebles, 24 de deco. La pared mide 2,6 m; la escalera tiene 4 escalones de 0,3 y termina en 1,2, justo el piso de la tarima.
- Encastre: grilla de 1 m para obra y 0,5 m para muebles; giro de 90° en obra y 45° en el resto; cuadros y relojes buscan la pared más cercana (< 1,3 m); para apilar, la altura es `max(y + piso)` de lo que hay abajo.
- Elegir qué tocaste: la pieza más cercana hasta 1,2 m, con huella mínima de 0,6 m (lo chico se puede tocar), −0,01 × y para preferir lo de arriba, muebles antes que pisos.
- Feedback: fantasma al 55 % (18 % fuera del patio), anillo de selección con `depthTest: false` que late `0,6 + 0,3 sin 6t`, techos que se ocultan, pantallas que ciclan el tono, el reloj con la hora real.
- 80 pasos de deshacer; un toque = menos de 6 px en menos de 500 ms (si no, se arrastra la cámara).
- **Guardado compacto:** `{k, x, z, r, y?, c?}` con `r` a 3 decimales y los campos opcionales solo si hacen falta; se escribe tras 250 ms sin cambios o al salir del modo obra. Al salir se rehace fusionando por material: 200 muebles quedan en pocas llamadas de dibujo.
## 10. El bucle, la cámara y los viajes

### 10.1 El bucle

```js
let ultimo = performance.now();
function bucle(ahora) {
  requestAnimationFrame(bucle);                  // primero: si el paso tira error, el bucle sigue
  const dt = (ahora - ultimo) / 1000; ultimo = ahora;
  if (window.__pausa || visorXR.activo) return;  // el XR tiene su propio bucle
  juego.dtReal = dt;                             // crudo: para la calidad automática
  try { paso(Math.min(0.05, dt)); } catch (e) { reportar(e); }
}
```

- **Dos dt:** el recortado a 0,05 s simula (bajo 20 fps el juego va en cámara lenta en vez de atravesar paredes); el crudo mide el rendimiento. En WebXR el paso se llama desde el bucle del visor, con el mismo tope y el mismo `try`.
- Tres pausas: `window.__pausa` congela todo (pruebas); una pausa blanda anula solo la entrada del jugador (el mundo, la red y las partículas siguen); el runner "congela" el dibujo 50–120 ms al azar como efecto de glitch.
- **Orden dentro del paso:** reloj de shaders (`uT += dt`, aunque no haya partida) → modos que se quedan con el cuadro → entrada → giro de cámara → jugador (antes, actualizar, paso; sus eventos disparan sonidos y partículas) → proyectiles, orbes, zonas, reino, minijuegos, NPC → qué hay para usar cerca → red → cielo y luces → **cámara** → lo que depende de la cámara (manos, paneles, fundido, voz espacial, efectos, campo) → recortes, agua, calidad automática → dibujar. La regla: **simular, después la cámara, después lo que mira a la cámara, y recién ahí dibujar**.
- Tareas espaciadas con acumuladores: HUD cada 0,25 s, zonas cada 0,5 s, limpieza de red cada 1 s, autoinstanciado a los 2 s de entrar y revisión cada 1 s. Al entrar a un reino el acumulador de zonas arranca lleno para evaluarlas en el primer cuadro.
- NPC: desaparecen a más de 110 m, modelo detallado a menos de 32 m, a menos de 5 m te miran (giro a `min(1, dt × 3)` con el ángulo envuelto a ±π).

### 10.2 La cámara

- **Suavizado que no depende de los fps:** posición `pos.lerp(deseada, 1 − exp(−dt × 14))`, mira `1 − exp(−dt × 18)`, distancia `min(1, dt × 6)`. `inicial = true` la pone de golpe (al entrar a un reino, teletransportarse o reaparecer).
- Límites: pitch −0,45…1,25 en tercera persona y −0,95…1,55 en primera; zoom multiplicativo 2,4–14 (5–30 construyendo).
- **Choque con 16 muestras, que se acerca al instante y se aleja despacio:**

```js
let libre = dist;
for (let i = 1; i <= 16; i++) {                          // del objetivo a la cámara
  const d = i / 16 * dist, p = objetivo.clone().addScaledVector(dir, d);
  if (p.y < mundo.altura(p.x, p.z) + 0.35 || (!montado && d > 0.6 && mundo.tapa(p))) {
    libre = Math.max(1.2, d - 0.45); break;
  }
}
this.libre = libre < this.libre ? libre : this.libre + (libre - this.libre) * Math.min(1, dt * 2.5);
pos = objetivo + dir * Math.min(libre + 0.8, this.libre);
```

- Nunca a menos de 0,4 m del suelo ni a menos de 0,25 m de la superficie del agua (no corta el agua por la mitad); en interiores no hay choque: se recorta a la caja del cuarto.
- **Autocámara:** tras 1,2 s sin tocarla, a más de 1,2 m/s y con desvío < 2,3 rad, gira detrás tuyo a `dt × 0,55` (0,9 montado) con una rampa de 0,5 s.
- **Sensación de velocidad:** a más de 5,5 m/s sube `kSprint = (v − 5,5)/1,8`: cabeceo `|sin| × 0,07`, vaivén 0,035, **campo +7°** e inclinación en las curvas hasta ±0,14 rad. Al aterrizar en primera persona (vy < −4) un hundimiento `min(0,22, −vy × 0,014)` con forma `sin(π x)`. En VR todo esto vale 0, por el mareo.
- El campo se acerca al objetivo con `lerp(dt × 5)` y se llama a `updateProjectionMatrix` solo si cambió más de 0,05°.
- **Plano de diálogo:** al hablar con un NPC, los dos se miran, el NPC saluda y la cámara va al punto medio + 1,05 m, de costado a `1,6 + 0,9 × separación`, del lado donde ya estaba.

### 10.3 Viajar entre reinos

```js
const velo = ui.pantallaViaje(nombre);              // velo DOM: fundido de entrada de 350 ms
pausa = true; sfx('entra');
await esperar(380);                                 // con el velo ya opaco, el tirón queda tapado
entrarReino(id, opciones);
await Promise.all([esperar(900), motor.precompilar(6000)]);   // mínimo 900 ms: se siente viaje
pausa = false; velo.cerrar();                       // fundido de salida de 450 ms
```

- `precompilar` = `Promise.race([renderer.compileAsync(escena, cam), tope])` dentro de un `try`: los shaders nuevos no traban el primer cuadro.
- `entrarReino` saca el grupo viejo, vacía remotos, proyectiles y efectos, **reusa los reinos grandes cacheados** (los minijuegos, la casa y los interiores se rearman), agrega el tone mapping y el espacio de color a los ShaderMaterial que no los tienen (todo sale con el mismo color), pone la cámara detrás del jugador de golpe y arranca la música del reino.
- En VR el velo del DOM no se ve: el fundido lo hace la pasada final (`mix(col, #0b2a44, uFundido)`) con un parpadeo `sin(min(1, t/0,22) × π)` al teletransportarse.
- Al arrancar la partida: pantalla de carga, `setTimeout(60)` para que se pinte antes del trabajo pesado; si falla, reintenta una vez en calidad mínima con la caché vacía; si falla otra vez, error y al menú.
- Se guarda el último reino, pero los minijuegos vuelven a juegos y la tienda o la casa vuelven a la plaza: nunca se reaparece en un lugar raro.

### 10.4 Arranque y errores

1. Cargar las texturas embebidas (cada promesa se resuelve aunque la imagen falle).
2. Leer el guardado y la URL (el nombre se corta a 16 caracteres).
3. Crear el motor dentro de un `try`: si falla, pantalla "sin WebGL".
4. Medir el aparato y arrancar el bucle.
5. Idioma (si no hay) → aviso ("Tocá la pantalla para seguir": es el primer gesto y prende el audio) → menú.

```js
const vistos = new Set();
function reportar(err) {
  const msg = String(err?.message || err?.reason?.message || err?.reason || err).slice(0, 180);
  console.error(err);
  if (vistos.has(msg) || vistos.size > 4) return;           // hasta 5 mensajes distintos
  vistos.add(msg);
  try { ui.error(msg, () => { ponerCalidad('baja'); guardar(); }); } catch {}
}
addEventListener('error', e => e.error && reportar(e.error));
addEventListener('unhandledrejection', e => reportar(e.reason));
lienzo.addEventListener('webglcontextlost', e => {
  e.preventDefault(); opciones.calidad = 'minima'; guardarYa();
  pantallaError(T('contexto_perdido'), () => location.reload());
});
```

- El cartel de error ofrece "Bajar calidad", "Recargar" y "Seguir".
- **Antes de que corra una línea de JS ya hay algo en pantalla:** un `#precarga` con el logo y un spinner en CSS puro; a los 7 s aparece "¿Sigue acá? Abrí el archivo con Chrome, Safari, Edge o Firefox (no desde una vista previa)" en tres idiomas, y un `<noscript>`.
- Parámetros para probar: `?directo`, `?reino`, `?nivel`, `?pausa`, `?x/y/z/yaw/pitch/dist`, `?calidad`, `?hora`, `?sinInstanciar`, `?broker`, `?depurar`; y `window.__A` expone todos los sistemas (motor, jugador, cámara, reino, sonido, red, UI, `paso`).
## 11. El sonido

### 11.1 Las canciones: MP3 con bucle musical exacto

- **7 canciones embebidas** (titulo, colina, arrecife, bosque, playa, juegos, runner; ~7,4 MB en base64), cada una con `bucle [inicio, fin]`, duración, `golpe` (el primer tiempo fuerte del archivo) y volumen. En las siete, **el fin del bucle queda 0,2 s antes del final del archivo** (margen para el relleno del MP3).
- Suena sin timers: el nodo hace el corte a la muestra exacta. La intro (0 → inicio) suena una vez y después se repite `[inicio, fin]` para siempre.

```js
const fuente = ctx.createBufferSource();
fuente.buffer = buf; fuente.loop = true;
fuente.loopStart = c.bucle[0]; fuente.loopEnd = c.bucle[1];
let cuando = ctx.currentTime + 0.4 - c.golpe, desde = 0;     // el primer tiempo fuerte cae a +0,4 s
const minimo = ctx.currentTime + 0.02;
if (cuando < minimo) { desde = minimo - cuando; cuando = minimo; }   // si no llega, arranca más adentro
fuente.start(cuando, desde);
ganancia.gain.setTargetAtTime(c.vol, cuando, 0.02);
vieja.gain.setTargetAtTime(1e-4, ctx.currentTime, 0.6);    // fundido cruzado con la anterior
setTimeout(() => vieja.fuente.stop(), 4000);
```

- `posicion()` lleva el tiempo transcurrido de vuelta al bucle (`n ≥ fin ? inicio + (n − inicio) % (fin − inicio) : n`): sirve para cambiar de versión (normal ↔ chip) en el mismo compás.
- Si una zona no tiene canción grabada, sigue una cadena de hasta 4 reemplazos (`aurora → arrecife → colina → titulo`); si la decodificación falla, cae a la música por código.
- **El motor de música generativa sigue en el código pero está apagado** en esta versión (`soloGrabadas = true`): es el plan B. Coincide con lo que dice `GUIA-JUEGOS.md § 7` (la música armada en código queda por debajo de una grabada).

### 11.2 El motor generativo (el plan B), por si hace falta

- Tema como datos: `bpm`, `reverb`, `filtro`, `acordes: [["Emaj9", 4], …]` y pistas; melodías como texto `"G#5:1.5 B5:.5 -:2"`. BPM: titulo 132, colina 112, ciudad 122, cielo 100, plano 90, arrecife 84, aurora 76. Una variación = el mismo tema con otro `bpm` y dos pistas más (un spread).
- **Acordes extendidos** (maj9, m9, 7sus4, 9sus4, maj7#11, 13, 6/9, add9): el color "Wii / city pop".
- **Voicing plegado** alrededor de un centro: la conducción de voces sale suave sola.

```js
const voces = (ac, centro = 62, n = 4) => ac.iv.slice(1, n + 1).map(iv => {
  let m = 48 + ac.raiz + iv;
  while (m < centro - 6) m += 12;
  while (m > centro + 7) m -= 12;
  return m;
}).sort((a, b) => a - b);
```

- **Scheduler con lookahead de 250 ms** en rebanadas de medio pulso, que salta si la pestaña se durmió (en vez de ametrallar todas las notas atrasadas):

```js
const seg = 60 / tema.bpm, horizonte = ctx.currentTime + 0.25, eps = 1e-6;
if (c.t0 + c.prox * seg < ctx.currentTime - 0.1)
  c.prox = Math.ceil((ctx.currentTime - c.t0) / seg * 2) / 2;
while (c.t0 + c.prox * seg < horizonte) {
  const pulso = c.prox % c.largo;
  const cuando = b => c.t0 + (c.prox - pulso + b) * seg;
  for (const p of tema.pistas) programar(p, pulso, cuando, b => b >= pulso - eps && b < pulso + 0.5 - eps);
  c.prox += 0.5;
}
```

- Capas adaptativas (0–4: pitido, bajo, piano eléctrico, vibráfono, batería) que se saltean según `capas`; **sidechain falso**: en cada pulso la ganancia baja a 0,6 (τ 0,01) y a los 50 ms vuelve (τ 0,12) — el bombeo house sin compresor.
- Modo chip: el mismo tema con pulsos (`PeriodicWave` con `re[k] = 2/(kπ) × sin(kπ × ciclo)`, 48 armónicos) y un bitcrusher (WaveShaper de 2.048 puntos `round(x × 28)/28` con `oversample: "none"`) → pasabajos 6.800 → eco 0,19 s.

### 11.3 Instrumentos sintetizados (sirven para efectos)

| voz | receta |
|---|---|
| piano eléctrico | FM: portadora + modulador 1:1 (índice 2,2f → 0,25f en 0,9 s) + 14:1 (0,8f → 1 en 60 ms) |
| marimba | seno f + seno 4f (0,3 → 0,001 en 70 ms); largo `0,35 + (84 − midi) × 0,012` s |
| vibráfono | seno f + 4f + trémolo 5,2 Hz ±0,3 |
| campana | FM inarmónica 3,5:1, índice 1,6f → 0,05f en 1,8 s |
| pad | 2 sierras ×1,004 / ×0,996 + triángulo 2f → pasabajos 1.300; ataque 0,7 s |
| coro | 3 sierras ±0,6 % con vibrato ~6 Hz → pasabandas 800 / 1.150 / 2.900 (formantes de "a") |
| flauta | seno + vibrato 5,4 Hz + soplo (ruido pasabanda en 2f, 0,06) |
| guitarra / arpa | Karplus-Strong calculado una vez por altura (promedio × 0,498 / 0,4996) |
| bombo | seno 140 → 48 Hz en 0,14 s |
| palma / hi-hat | 3 ráfagas de ruido a 11 ms (BP 1.400) / ruido HP 7.500, 40 ms |

- Envolventes desde `1e-4` (no 0: `exponentialRampToValueAtTime` no acepta 0) y cierre con τ 0,08. Paneo sacado de la altura o del tiempo (ancho estéreo sin azar).

### 11.4 Mezcla

- Bus de música (`vMusica × 0,5`) → pasabajos 9 kHz → compresor maestro (−16 dB, 3,5:1, knee 12). Los efectos (0,8) van directo al compresor. **Bajo el agua**, el pasabajos de la música baja a 1.400 Hz (τ 0,25): se apaga la música y no los efectos.
- **Reverb sin archivos:** una respuesta estéreo de 3 s generada al arrancar, compartida por dos convolvers (envío música 0,4, efectos 0,3):

```js
for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let y = 0;
  for (let i = 0; i < n; i++) { y += (Math.random() * 2 - 1 - y) * 0.6; d[i] = y * (1 - i / n) ** 3.2; } }
```

- Eco ping-pong de 0,36 s (realimentación 0,32, paneo ±0,7) para campana y caja de música.
- **Todo cambio con `setTargetAtTime`** (τ 0,5–0,6): nada salta.

### 11.5 Efectos y sonido de interfaz

- Primitivas: `tono(f0 → f1)` exponencial con ataque de 6 ms; `soplido` (ruido pasabanda con barrido); `pup` (seno 300 → 720 Hz en 50 ms + soplido = "bloop"). Salto 520 → 880 + 1.040 → 1.760; burbuja 300 → 1.200 + 900 → 1.600 a los 80 ms.
- **Juntar cosas seguidas sube una pentatónica:** `2 ** ([0, 2, 4, 7, 9, 12][k % 6] / 12)`.
- Los efectos pueden tocar con los instrumentos musicales (el orbe = vibráfono 64-68-71-76-80-83-88, una nota cada 70 ms).
- Interfaz: "mover" = seno 1.900 → 2.100 Hz de 30 ms a 0,014 (solo al entrar a un botón distinto del último); "elegir" = marimba 76 y 83 a 60 ms; notificaciones: bien = Do6-Mi6-Sol6 a 0/85/170 ms, error = Fa5 → Do5, info = 988 → 1.318 Hz, con antirrebote de 350 ms y un parcial de 2,76 × f que suena a vidrio.
- Diálogo: un bip cada 4 letras alternando 1.440 y 1.200 Hz.
- El `AudioContext` se crea o reanuda en el primer `pointerdown` o `keydown` (en captura, `once`); lo pedido antes queda pendiente y suena cuando arranca.
- `decodeAudioData` deja inservible el búfer que recibe: se le pasa una copia del tramo, y se atienden a la vez el callback y la promesa.
## 12. Multijugador sin servidor propio

### 12.1 MQTT sobre un broker público

- Cliente MQTT cargado `async` desde un CDN en el `<head>`: si no carga, el juego anda solo. Se revisa `window.mqtt` 25 veces cada 400 ms; a los 4 s se inyecta una copia de otro CDN; a los 10 s, "sin red" y se sigue en solitario. Si la conexión se cierra 4 veces sin haber conectado nunca, deja de intentar (redes que bloquean el puerto).
- Temas con la versión en el prefijo (`aeroplaza_v1_…`): `vestibulo` (presencia), `<sala>/state`, `<sala>/chat`, `<sala>/action`, y tres **retenidos** (el broker guarda el último): `casa/<id>`, `buzon/<para>/<de>`, `perfil/<id>`. Todo con QoS 0; la confiabilidad se arma encima.
- `keepalive 30`, `reconnectPeriod 4000`, `connectTimeout 9000`, `clean: true` → **en cada `connect` hay que volver a suscribirse a todo** y reenviar la presencia. `clientId = prefijo + id + "_" + 4 hex al azar`: dos pestañas no se echan.
- **Salas:** la más llena con menos de 14 de ese reino (junta gente); si no hay, la primera libre entre `reino-1` y `reino-98`.

### 12.2 El estado: poco, solo si cambió, con latido

```js
function publicarEstado(e, ahora = performance.now()) {
  if (ahora - tUltimo < 100) return;                              // máx. 10 Hz
  const u = ultimo;
  const cambio = !u || manhattan(u, e) > 0.02 || Math.abs(u.rumbo - e.rumbo) > 0.05
              || ["hp", "estado", "gesto", "av", "esc", "ef", "voz", "cel"].some(k => u[k] !== e[k]);
  if (!cambio && ahora - tLatido < 1500) return;                  // latido cada 1,5 s
  tUltimo = tLatido = ahora; ultimo = { ...e };
  publicar(PREF + sala + "/state", { id, nombre, ...e });
}
```

- Posición y rumbo con 2 decimales, velocidad con 1 (~230 B por mensaje). Presencia cada 4 s (se olvida a los 12 s); un remoto se borra a los 5 s sin estado (aguanta ~3 latidos perdidos); al irse se manda `chau` y los demás lo borran al instante.
- **La apariencia viaja como hash:** el estado lleva `av` (hash de 32 bits del JSON, `h = h × 31 + c | 0`); al entrar a una sala se manda una vez la apariencia completa, y quien ve un `av` que no conoce la pide (como mucho cada 3 s).
- **Gestos como `"nombre#contador"`:** repetir el mismo gesto es un valor nuevo. El gesto "poder" dispara en cada cliente la misma explosión calculada localmente: por la red viajan ~10 caracteres.
- Recibir: `JSON.parse` en `try`, descartar lo propio, ids de más de 40 caracteres y más de 40 mensajes por segundo por id.

### 12.3 Dibujar a los otros

```js
const k = 1 - Math.exp(-dt * 12);                   // cubre ~70 % del hueco entre paquetes a 10 Hz
if (dx*dx + dz*dz > 400) pos.set(objX, objY, objZ); // más de 20 m: teletransporta
else { pos.x += dx * k; pos.y += dy * k; pos.z += dz * k; }
rumbo = lerpAngulo(rumbo, rumboObj, dt * 12);       // por el camino corto
```

- Sin búfer ni extrapolación: alcanza para un mundo social. La animación usa la velocidad recibida (o la deduce del desplazamiento × 10). A más de 32 m, menos detalle.
- Quien juega en VR se ve como una "pelotita" (cabeza de r 0,16 con brillo falso) y sus manos: 21 puntos por mano como **63 enteros en centímetros** (±250), `0` si la confianza es ≤ 0,5. El receptor exige 7 números finitos, desplazamiento ≤ 3 m y cuaternión de norma 0,5–1,5 (lo renormaliza).
- Abrir el "celu" manda `cel: 1` y los demás te ven con el teléfono en la mano: presencia social gratis.

### 12.4 Amigos y mensajes cifrados, sin servidor

- **Identidad = hash de la clave pública:** par ECDH P-256; los primeros 12 hex del SHA-256 de la clave pública son el id y el código de amigo (`a1b2·c3d4·e5f6`). La privada se guarda como JWK y se reimporta **no extraíble**.

```js
const bits = await subtle.deriveBits({ name: "ECDH", public: suPub }, miPriv, 256);
const base = await subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
const clave = await subtle.deriveKey({ name: "HKDF", hash: "SHA-256",
    salt: enc.encode("aeroplaza-amigos-v1"), info: new Uint8Array() },
  base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
const iv = crypto.getRandomValues(new Uint8Array(12));
const c = await subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(miId + ">" + suId) },
                               clave, enc.encode(JSON.stringify(datos)));
```

- Al abrir: tamaños acotados, `sha256(pub)[:12]` tiene que dar el id del remitente, `de`/`para` de adentro tienen que coincidir. Las claves derivadas se cachean como **promesas** (y se borran si fallan).
- **Buzón con mensajes retenidos:** cada envío va retenido a `buzon/<para>/<de>` y lleva **los últimos 30 mensajes propios**: si uno se pierde, el siguiente lo repone. El receptor descarta todo `n ≤ último`.
- Números que solo crecen aunque el reloj retroceda: `seq() = max(Date.now(), último + 1)`, guardado en la partida.
- Colas por amigo (si ya hay un envío esperando, se devuelve la misma promesa); lo pendiente sale en el próximo `connect`.
- Límites: 100 amigos, 40 solicitudes, 80 mensajes por charla, 200 caracteres, 200 bloqueados; a las 400 fichas se borran las 50 más viejas sin relación. "Se conectó" solo para amigos y nunca en los primeros 10 s.
- Sin https no hay `crypto.subtle`: los amigos se apagan con un cartel y el id pasa a ser uno al azar.

### 12.5 Voz de proximidad por WebRTC

```js
if (!par && hablan && dist < 12 && miId < suId && !(espera.get(suId) > ahora)) {
  espera.set(suId, ahora + 15000); llamar(suId);       // solo llama el id menor: no chocan las ofertas
}
if (par && (!hablan || dist > 18)) { cerrar(suId); espera.set(suId, ahora + 3000); }   // histéresis 12/18 m
if (par && !par.conectada && ahora - par.t0 > 15000) cerrar(suId);
```

- Señalización por el mismo MQTT, sin trickle ICE (espera los candidatos, 2 s como máximo, y manda el SDP entero). Solo STUN, sin TURN.
- Audio: analizador (FFT 512, RMS) + ganancia que entra con τ 0,08 → `Panner` HRTF lineal de 2 a 14 m → bus de volumen. Sin micrófono, modo escucha (y dos que solo escuchan no se conectan).
- Un `<audio>` mudo con el stream hace que Chrome deje pasar el audio remoto por WebAudio (inferido).

### 12.6 Lo que enseña sobre seguridad

- En un broker público sin autenticación, **el id de cada mensaje es autodeclarado**: la posición, los golpes o el plano de una casa que llegan por la red pueden ser de cualquiera. El juego valida forma y rango de todo (colores con `/^#[0-9a-f]{6}$/i`, apariencia por listas blancas, casas de hasta 200 piezas en radio 12, chat a 120 caracteres, todo al DOM con `textContent`), pero forma no es autoría.
- Para lo que importa (mensajes entre amigos) la autoría sale de la criptografía: clave atada al id, AES-GCM con datos asociados, números que solo crecen.
- Limitar por id no alcanza si el id es gratis: hace falta un tope global de remotos y podar los mapas de límites.
- La clave privada en `localStorage` queda al alcance de cualquier XSS: por eso importa que nada del usuario entre como HTML.

## 13. El planetario: el cielo real de Buenos Aires

- 5.044 estrellas hasta magnitud 6, **ordenadas por brillo**, a 6 bytes cada una (AR `uint16/65535 × 360`, Dec `int16/32767 × 90`, magnitud `byte/25 − 2`, B−V `byte/80 − 0,5`): 30 KB. Más 528 nombres, 88 constelaciones, 89 rótulos y 32 objetos de cielo profundo.
- Días desde J2000 `ms/864e5 + 2440587,5 − 2451545`; hora sidérea `280,46061837 + 360,98564736629 d + lon`; planetas con elementos keplerianos y 8 iteraciones de Newton; Luna con la serie corta y su fase.
- **Todo el cielo en un grupo movido por una sola matriz** (`matrixAutoUpdate = false`) con la hora sidérea y la latitud.

```glsl
float flujo = pow(10.0, -0.4 * (aMag - uMagZoom));
float ext = mix(1.0, smoothstep(-0.02, 0.2, alt), uAtm);            // extinción cerca del horizonte
float tit = 1.0 - 0.28 * (1.0 - smoothstep(0.0, 0.6, alt)) * (0.5 + 0.5 * sin(uT * 9.0 + aFase)) * uAtm;
vAlfa = clamp(pow(flujo, 0.42) * 2.2, 0.16, 1.0) * uVis * ext * tit;
gl_PointSize = clamp(uBase * pow(flujo, 0.26), 2.6, 60.0) * uDpr;
```

- Núcleo `exp(−9r²)` + halo `0,45 exp(−3r²)` + cruz de difracción solo en las brillantes; `aFase = i × 2,399` (ángulo áureo: las fases no forman patrón); con zoom `uMagZoom = 2,2 log10(70/fov)` va mostrando las más débiles; color desde B−V con la fórmula de Ballesteros.
- Vía Láctea procedural en un canvas de 1024×512 en coordenadas galácticas reales (banda gaussiana, bulbo, Gran Grieta, Saco de Carbón) + `blur(1,5px)`.
- Como el catálogo está ordenado por brillo, el bucle de rótulos corta con `break` al pasar el límite de magnitud.
- Se arma recién la primera vez que se abre, y mientras está abierto no se dibuja el mundo.

## 14. Efectos: depósito fijo y coreografías

- **1.800 partículas en un solo `Points`**; las muertas con alfa 0 y tamaño 0. Física que no depende de los fps: `v *= exp(−arrastre × dt)`, gravedad, remolino `v += (−dz, dx) × remolino × dt`.

```glsl
gl_PointSize = aTam * uEscala / max(0.1, -mv.z);   // uEscala = altoPx × 0,5 / tan(fov/2): tamaño en METROS
float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard;
float a = pow(1.0 - d, 1.6);
gl_FragColor = vec4(mix(vCol.rgb, vec3(1.0), pow(1.0 - d, 6.0)) * a * vCol.a, 1.0);   // centro blanco, aditivo
```

- Cintas que miran a la cámara (`normalize(tangente × haciaCámara) × ancho × (0,4 + 0,6s)`), cola que se apaga con `smoothstep(0, 0,25, u)`, núcleo blanco; rayos de 14 puntos con tres senos cuya semilla cambia cada 0,05 s; grieta en el piso dibujada en canvas con ramas (9–12, probabilidad 0,28, profundidad 2) en dos capas (una oscura y una que brilla con `shadowBlur 14`); 80 escombros instanciados con gravedad 22 y rebote 0,35.
- **Coreografía del "poder" agendada con `luego(t, fn)`** que avanza con `dt`: 0–1,5 s se oscurece la pantalla a 0,75, espirales, 90 chispas que implotan y un rayo cada 0,15 s; a 1,55 s explota (destello 0,55, sacudida 0,55, dos ondas, grieta de 7 s, 120 chispas, 26 escombros); a 3,7 s suben 260 chispas. El destello y el oscurecido los pone la pasada final.
## 15. Minijuegos: diseño con números

### 15.1 Tiro de burbujas (60 s)

- Desde una plataforma de vidrio de r 5,2 m a 22 m sobre el mar (la baranda son 28 cilindros invisibles).

| blanco | puntos | radio | velocidad | en el pool |
|---|---|---|---|---|
| azul | 1 | 0,78 | 0,5 | 6 |
| rosa | 2 | 0,6 | 0,95 | 4 |
| oro | 5 | 0,46 | 1,5 | 2 |

- **Chico y rápido vale más:** riesgo/recompensa en una tabla. Cada blanco es una diana emisiva dentro de una burbuja iridiscente que te mira (`lookAt` a tu cabeza).

```js
intervalo -= dt;
const final = tiempo < 20;                                   // escalón de dificultad en los últimos 20 s
if (intervalo <= 0 && vivos() < (final ? 8 : 6)) {
  intervalo = final ? 0.35 : 0.6;
  const r = azar();
  const tipo = r < (final ? 0.22 : 0.10) ? "oro" : r < 0.45 ? "rosa" : "azul";
  const b = pool.find(b => !b.vivo && b.tipo === tipo) || pool.find(b => !b.vivo);
  if (b) aparecer(b);
}
pos.set(c.x + Math.sin(t*v + f1)*A,                          // Lissajous, A = 1,4–4
        c.y + Math.sin(t*v*1.3 + f2)*A*0.5 + fuga*4,
        c.z + Math.cos(t*v*0.7 + f1)*A*0.4);
```

- Aparecen hasta ±1,2 rad al frente, a 9–24 m, crecen en 0,25 s, viven 5,5–9 s y al vencer **se escapan hacia arriba sin penalizar**.
- Solo cuenta si el blanco ya creció (`esc ≥ 0,5`); acierto a menos de `r + 0,34`. **Racha:** `mult = min(4, 1 + floor(racha/4))`; una burbuja que muere sin pegar corta la racha.
- Feedback en capas: 24 chispas (40 si es oro), "pop" (+ "orbe" si es oro), al subir el multiplicador una nota que sube con él y un destello, vibración de 12 ms. Proyectil a 24 m/s cada 0,26 s con gravedad "de juguete" de 3 m/s².
- Cuenta de 3,4 s que muestra 3, 2, 1 y "¡Ya!"; al final, los resultados a los 700 ms (deja ver el festejo) con reintentar y salir. Estrellas a 30 / 60 / 95 puntos.

### 15.2 El runner "Aero.exe": la canción es el nivel

- Correr solo a 17 m/s hasta un portal antes de que termine la canción (67,1 s; límite 63,5 s). Vos controlás el lateral (±0,62), el doble salto y el deslizarte; **la velocidad se multiplica por `hypot(lateral, 1)`: esquivar no frena**.
- **Cada obstáculo es un verbo:** valla de 0,85 m = saltar; puerta de y+1 a y+3,8 = deslizarse (alto de 1,35 a 0,72); muro del 40 % al centro o 50 % de un lado = esquivar; cubos de 2,3 m que cambian de carril con el compás = timing; aro dorado = +7 m/s durante 1,7 s y campo +12°; trampolín = rebote 15,5; huecos de 7–22 m.
- **Castigo suave:**

```js
const alto = deslizando ? 0.72 : 1.35, m = 0.34;
for (const ob of obstaculos) {
  if (ob.tFantasma > 0) continue;
  if (Math.abs(p.z - ob.z) > ob.dz + m || p.x < ob.x0 - m || p.x > ob.x1 + m) continue;
  if (p.y + alto <= ob.y0 + 0.02 || p.y >= ob.y1 - 0.02) continue;
  ob.tFantasma = 1.3; golpes++; aturdido = 0.42; flash = 1;   // el obstáculo parpadea a 9 Hz y no vuelve a pegar
  jug.v.set(0, 5.5, -7.5); break;
}
```

- Caer 11 m bajo el control te devuelve al inicio de la última plataforma pisada; el control y el progreso solo avanzan.
- **Telegrafiar:** compás = 4 × 60/175 s; en el último 15 % del compás el cubo tiembla `1 + 0,06 sin(frac × 60)` y recién ahí se mueve.
- **Calibrado:** 903 m a 17 m/s = 53,1 s, o sea 10,4 s de holgura; 3★ si sobran ≥ 8 s, 2★ si ≥ 4 s. Para 3★ podés perder ~2,4 s, y los 3 aros devuelven ~2,1 s.
- El nivel es una lista acumulativa `[largo, {hueco, dy, dx, ancho = 13, estilo, cosas: [[tipo, offsetZ, lado]]}]` (20 tramos, 692 m de plataforma, 228 m de huecos), con UV escaladas por tamaño (`ancho/6,5 × largo/6,5`): la textura tiene siempre la misma densidad.

### 15.3 El susto: una escalada de terror sincronizada con la música

- **La canción está analizada de antemano y guardada como texto:** 1.342 dígitos a 20 por segundo (pulsos) y 671 a 10 por segundo (energía), "0"–"9" → 0–1. Sincroniza con el audio sin `AnalyserNode` y siempre igual.

```js
const muestra = (s, hz, def) => t => {
  const c = s.charCodeAt(Math.floor(t * hz));
  return c >= 48 && c <= 57 ? (c - 48) / 9 : def;             // fuera de rango: un valor por defecto, nunca NaN
};
const pulso = muestra(PULSOS, 20, 0.2), energia = muestra(ENERGIA, 10, 0.4);
golpe = e >= 0.85 && eAnt < 0.85 ? 2 : e >= 0.75 && eAnt < 0.75 ? 1 : 0;   // cruces de umbral cada 0,1 s
```

- **Guion de corrupción por tiempo:** 0 hasta los 16 s, 0,3 a los 21, 0,62 a los 43, 0,95 a los 58; modulado por la energía (`corr × (0,88 + 0,28 × energía)`). Capas que se suman por umbral: cielo roto (> 0,02), fantasma de alambre (> 0,2), overlay de "detección" (> 0,25), 22 ventanas de error estilo Vista (0,3 → 0,87), 5 siluetas negras de ~3 m que se desvanecen al acercarte (> 0,35), 140 cubitos (> 0,45), bamboleo de cámara (> 0,6). Sustos fijos a los 20,1 / 32,1 / 47,5 s (el segundo siempre dice "WAKE UP").
- **Un parche de shader "roto" que se le agrega a cualquier material** (`onBeforeCompile` encadenado + clave `|roto` + uniforms compartidos: cambiar un `.value` mueve todos): desplaza vértices por celdas, pinta damero magenta, posteriza (`mix(40, 3, uC²)` niveles), barre franjas y en los picos pasa a negativo.
- El dibujo del susto es un canvas 2D encima del WebGL (DPR ≤ 1,5): palabra en Impact 900 que entra de 1,18 a 1 en 80 ms, cortada en 7 franjas con hash que cambian a 15 Hz y aberración con `globalCompositeOperation = 'lighter'` (rojo `#ff0038` y cian `#00f0ff`); **desgarro** que copia una fila de 2 px del propio lienzo WebGL y la estira; **eco** en `difference`; consola que tipea `C:\AERO> iniciar sueño.exe`; jumpscare de 0,46 s (blanco 45 ms, negro al 90 %, la imagen crece en 11 franjas corridas) con plan B dibujado si falta la imagen; grito sintetizado (dos sierras 520 / 781 Hz con FM a 28 Hz + formantes, por `tanh(5x)`) + sacudida + vibración de 160 ms.
- Rompe la estética a propósito: Impact contra sans redondeada, rojo y cian puros contra pasteles, saltos a 15 Hz contra easings suaves. Resguardos: una opción "Sustos del runner" y el aviso "⚠ destellos y sustos" al entrar.

### 15.4 Zona de juegos y mesas

- 11 portales en un anillo de r 10,8 (un color por destino; shader `remo = 0,5 + 0,5 sin(3 ang + 10 r − 3,2t)` con borde `smoothstep(1, 0,86, r)`).
- **Básquet con error que crece con la distancia y con lo mal que mirás**, resuelto analíticamente:

```js
const T = 0.62 + dist * 0.07;
const err = (0.05 + dist * 0.028) * (Math.random()*2 - 1) + Math.abs(desvio) * 0.55 * Math.sign(Math.random() - 0.5);
const meta = aro.clone().add(new Vector3(err * 0.8, 0, err * 0.6 * (Math.random()*2 - 1)));
v = meta.sub(p0).sub(g.clone().multiplyScalar(0.5 * T * T)).divideScalar(T);   // g = (0, −18, 0)
```

  A menos de 0,14 m del centro es doble (triple desde más de 6,2 m); a menos de 0,38 "¡Uy, el aro!" con rebote.
- Bolos (efecto que pega fuerte a los 0,6 s, dominó con el 70 % de la velocidad, cada choque a 600–1.100 Hz al azar), fútbol (13,5 m/s + 4,2 arriba, rozamiento `exp(−0,9 dt)`), 7 trampolines con hitos a 5/10/20/30 rebotes, hamacas con péndulo real (`ω += (−9,8/L sin θ + bombeo − 0,12ω) dt`), pista de baile de 8×8 con un compás de 0,7222 s (el bucle del MP3 dura justo 64 compases).
- **IA con un defecto calibrado:** ta-te-ti minimax con 25 % de jugadas al azar; cuatro en línea: ganar > bloquear > no regalar > centro + ruido; memotest con memoria perfecta que aprovecha el par conocido solo el 85 % de las veces. La compu "piensa" 0,7–1,3 s.
- En red: la pelota la manda solo quien la tocó último (cada 0,1 s durante 1,2 s); las mesas comparten semilla, numeran las jugadas (si no coincide, se pide el estado), validan las jugadas remotas contra las legales, y el asiento 0 es la autoridad.

### 15.5 Premios que no se farmean

- Orbes: 15 la primera vez (tiro) o 30 (runner), más 5 **por cada estrella nueva** sobre tu mejor marca. Repetir no paga.
- Se guardan mejor puntaje o tiempo, estrellas y el % máximo alcanzado.

### 15.6 Interiores que se sienten habitados

- **Contenedor mate, objetos con brillo:** paredes `#f6fbff` rugosidad 0,6 y techo blanco 0,7 sin borde; zócalo turquesa `#43d8cd` de 0,3 m; ventanas de vidrio con parantes cada ~3,2 m.
- Por la ventana, un cilindro de r 130 con un skyline pintado en canvas (2048×512) y 30 edificios con ventanas en `emissiveMap`: `fondo = 0,35 + dia × 0,65`, `emisivo = (1 − dia) × 1,1`. De noche la ciudad se prende sola.
- Cosas que se mueven siempre: candelabro de 18 burbujas, peces, cortinas (`rot.z = 0,015 sin(0,8t + i)`), tele que cicla el tono, cartel de noticias que corre (texto duplicado = bucle sin costura).
- **Cada accionable responde triple: sonido + aviso + chispas** (el piano toca la escala mayor; la cafetera apila hasta 6 tazas; el telescopio tiene una caja invisible generosa para tocarlo fácil).
- El ascensor es una máquina de estados (abierta → cierra → viaja con smoothstep, `2,2 + Δy/14` s → abre) que corre **antes** de la física del jugador y lo arrastra; las puertas son colisiones "fantasma" según el estado.
- Pisos con agujeros armados con rectángulos y UV en coordenadas de mundo (la textura sigue entre pedazos). Al terminar de armar, si quedan más de 8 mallas estáticas opacas, se fusionan.
## 16. Entrada: dedos, teclas, mandos, manos y VR

### 16.1 Táctil, teclado y mando

- **El juego es acostado.** Con el celu parado (táctil y `alto > ancho × 1,05`) gira `#app` 90° por CSS en vez de pedir que lo gires; convierte los toques a coordenadas del juego, reemplaza `getBoundingClientRect` y elige el lado con `devicemotion` (|x| > 6,5 sostenido 350 ms, sin pedir permiso en iOS). Después de `orientationchange` espera 120 ms.
- **Palanca flotante** que nace donde apoyás el pulgar (espejada para zurdos), zona muerta del 12 % y curva `((r − 0,12)/0,88) ** 1,3`. Botones ubicados en % de pantalla, de `0,15 × min(ancho, alto)`: saltar, usar, correr (interruptor), disparar, agacharse. **El jugador puede reacomodarlos arrastrando.**
- Teclado por `code` (tecla física: anda con cualquier distribución), con `abajo` (sostenido) y `recien` (este cuadro, se vacía al final de `leer()`); ignora lo que se escribe en inputs; `preventDefault` en espacio y flechas; **en `blur` suelta todo** (no quedan teclas pegadas). WASD/flechas, Espacio, Shift, E, C/Q, F, T (chat), V (cámara), 1–5 (gestos), Esc/P, M (celu).
- Mando: zona muerta 0,16, flancos contra el estado anterior. Mapa de fábrica con varios botones por acción (`usar [0,5,7,24,25]`, `saltar [1,4,6]`…) para que ande sin configurar con controles baratos de VR. Remapeo: "Cambiar" captura el próximo botón y lo saca de las demás acciones; lo guardado se valida (enteros 0–31, hasta 5 por acción) y si no cumple vuelve el de fábrica.
- Los botones que manda la app nativa se presentan con forma de `Gamepad` y se suman a `navigator.getGamepads()`: el resto del juego lee un solo tipo de mando.

### 16.2 Manos por cámara (MediaPipe) sin trabar el juego

- **Tubería de hilos:** cámara → `MediaStreamTrackProcessor` → worker "lector" (achica cada `VideoFrame` a 480 px) → `MessageChannel` → worker de la red. El hilo principal recibe un `Float32Array` transferido de 128 números por mano. **Si no hay red libre, el cuadro se tira, nunca se encola** (latencia baja). Sin mano a la vista hace más de 1 s, procesa 1 de cada 2.
- Workers armados desde texto con `URL.createObjectURL(new Blob([código]))`: anda dentro de un HTML de un solo archivo.
- Modelo `hand_landmarker` float16 desde CDN, 2 manos, detección 0,5 y presencia/seguimiento 0,4 ("con 0,5 perdía la mano cuando se movía rápido, y reencontrarla cuesta una detección entera").
- **Carrera GPU contra CPU en vivo:** con una mano a la vista y 20 muestras de CPU, levanta una red en GPU y compara con la misma carga; gana la GPU si es 25 % más rápida, detecta al menos el 90 % y **no le baja más del 10 % los fps al juego** (en el celu la GPU la comparte three.js). La decisión se guarda 7 días.
- Luz: cada 4 cuadros mide la luminancia **solo dentro de la caja de la mano** y aplica una ganancia por software (objetivo 0,42, entre 1× y 6×, con `ctx.filter = 'brightness(g)'`); cada 600 ms además mueve la exposición del sensor. El software corrige rápido y el hardware lento.
- **Profundidad real con una sola cámara:** mínimos cuadrados entre los puntos de imagen (0–1) y los puntos "mundo" de MediaPipe (en metros, centrados en la mano) → distancia de la mano en metros.
- Filtro **One Euro** (corte 1,2 Hz, beta 10; separado en lateral y profundidad, que es más ruidosa), pellizco con histéresis (empieza < 0,30, termina > 0,46 del tamaño de la mano), el rayo se congela 0,14 s al empezar el pellizco para que el gesto no mueva la puntería, anclas cuando la mano queda quieta 0,26 s, predicción de latencia saturada (máx. 6,5 cm), descarte de cuadros raros contra la mediana de los últimos 4.

```js
const alfa = (fc, dt) => 1 / (1 + 1 / (2 * Math.PI * fc) / dt);
dx += alfa(corteD, dt) * ((x - xAnt) / dt - dx);
xAnt += alfa(corte + beta * Math.abs(dx), dt) * (x - xAnt);    // rápido = menos suavizado
```

- Manos dibujadas con 48 cápsulas instanciadas (de 2 cm en la muñeca a 7 mm en las puntas): primero un pase de profundidad (`colorWrite: false`) y después el vidrio, así no se ven las caras de adentro.

### 16.3 VR con el celular (cardboard)

- **Lente:** modelo radial `r' = s × r × (1 + k1 (sr)² + k2 (sr)⁴)` con perfiles (cardboard1 0,441 / 0,156 / 0,9), invertido con Newton; aberración cromática por canal en el shader; grilla de prueba para calibrar.
- **Reproyección casera (un "timewarp"):** el mundo se dibuja con 10 % de margen y la profundidad en el alfa; cada ojo (IPD 0,064 m) reproyecta el último cuadro terminado con el giro actual de la cabeza (3 correcciones de paralaje, lectura Catmull-Rom, borde que se funde a negro en vez de estirarse). Si el aparato no llega, pasa a "partido": un cuadro dibuja la mitad de arriba y el siguiente la de abajo, y los ojos se reproyectan siempre.
- Frecuencia de pantalla deducida del percentil 10 de 90 tiempos de cuadro, ajustada al más cercano de [60, 72, 90, 120, 144].
- Predicción del giróscopo hasta `min(30 ms, 1,5 × período)`; **modelo de cuello** (ojos 7,5 cm arriba y 8 cm adelante del pivote); en VR se apagan cabeceo, vaivén y sacudidas (mareo).
- Sin botones: un toque camina o frena, dos saltan; mirar abajo 2 s sale del VR (con una barra de progreso en CSS).
- **WebXR** cuando hay visor: `local-floor` y `hand-tracking` opcionales, foveación 0,3, la mayor tasa hasta 120 Hz; las manos de WebXR se pasan al mismo formato de 21 puntos que MediaPipe, así un solo código atiende las dos.

### 16.4 Puente con la app nativa

- Cada llamada: `try { window.AeroplazaNativo?.metodo?.(!!x) } catch {}` — el método puede faltar en una versión vieja de la app y una excepción del lado Java no voltea el juego; tipos forzados (`!!`, `|0`, `String`).
- Los datos vuelven como texto (`"qx,qy,qz,qw,px,py,pz"`) volcado en un `Float64Array(7)` reutilizado, con `Number.isFinite` por valor: cero basura por cuadro.
- `esperar(condición, 8000)` se resuelve cuando se cumple o a los 8 s con lo que haya: nunca cuelga.
- Actualizaciones: la web se aplica sola (en el menú, guardando antes; jugando, un aviso clicable de 14 s); la de la app pide reinstalar. "Se actualizó" se muestra una vez por versión.
## 17. Rendimiento: cuatro calidades y un juez que mide

### 17.1 Las calidades

Entre paréntesis, el valor en pantallas táctiles (`matchMedia("(pointer: coarse)")` u `ontouchstart`):

| | escala | dpr máx. | bloom | sombra | cada | MSAA | pasto | lejos (m) | árbol cerca | reflejo | seg / curvas |
|---|---|---|---|---|---|---|---|---|---|---|---|
| alta | 1 | 2 (1,5) | sí | 2048 | 1 (2) | 4 (0) | 1 | ∞ | ∞ | 8 s | 3 / 1 |
| media | 0,85 | 1,25 | sí | 1024 | 2 | 0 | 0,55 | 300 | 45 | 12 s | 3 / 1 |
| baja | 0,7 | 1 | no | – | – | 0 | 0,25 | 170 | 30 | 20 s | 2 / 0,75 |
| mínima | 0,6 | 1 | no | – | – | 0 | 0 | 95 | 18 | 60 s | 1 / 0,5 |

- Mínima además dibuja directo (sin cadena de post) y apaga clearcoat, iridiscencia, sheen y transmission en todos los materiales (guardando los valores para volver).
- Resolución: `dpr = min(devicePixelRatio, dprMax) × escala`. Sombras cada N cuadros: `autoUpdate = (N === 1)`, si no `needsUpdate = (++n % N === 0)`.

### 17.2 Elegir sola: puntaje del aparato + medición

- Al arrancar lee la placa con `WEBGL_debug_renderer_info` y suma puntos: NVIDIA / Radeon / Apple M +3; Intel Iris o Xe +2 (otra Intel +1); Adreno ≥ 640 +2, ≥ 610 +1, otras −1; Mali-G ≥ 76 +2, ≥ 57 +1, otras −1; memoria ≥ 8 GB +2, ≥ 4 GB +1, menos −1; ≥ 8 núcleos +1, ≤ 4 −1; táctil −1; más de 9 Mpx −1; `MAX_TEXTURE_SIZE` < 8192 −1. **≥ 4 → alta, ≥ 1 → media, ≥ −1 → baja, si no mínima. SwiftShader o llvmpipe → mínima directo** (comprobado en el banco: eligió "minima").
- Después mide 60 cuadros (ignorando el arranque) y decide una vez:

```js
if ((tAuto += dt) > 1.5) { n++; suma += Math.min(0.25, dtReal); }
if (n >= 60) {
  const ms = suma / n * 1000; n = suma = 0; tAuto = 0.5;
  if (ms > 30 && cal !== 'minima') bajarUnNivel();
  else if (ms > 45 && !pixel) { sugerirModoPixel(); auto = false; }      // último recurso
  else if (ms < 13 && cal !== 'alta' && !yaSubio && !software) { subirUnNivel(); yaSubio = true; }
  else auto = false;                                                     // decide y se queda quieta
}
```

- **Sube una sola vez**: así no oscila entre dos niveles.

### 17.3 Recortar, fusionar, instanciar

- **Corte por distancia cada 0,35 s** (oculta lo que está a `dist − radio > lejos`) y **la niebla atada al corte**: `far = min(950, lejos × 1,02)`, `near = min(140, lejos × 0,4)`. Lo que desaparece ya está 97 % en niebla.
- Para ocultar sin pelearse con el resto del código, redefinen `visible`:

```js
let propio = obj.visible; const corte = { cortado: false };
Object.defineProperty(obj, "visible", { configurable: true,
  get: () => propio && !corte.cortado, set: v => { propio = v; } });
```

- Los `InstancedMesh` de 12 o más copias se **compactan**: las instancias cercanas pasan al frente y baja `count`.
- **Autoinstanciado:** a los 2 s de entrar a un reino agrupa las mallas opacas estáticas por `geometría|material|sombras|renderOrder|frustumCulled`; con 3 o más copias arma un `InstancedMesh`. Las originales quedan en la escena (para los rayos) pero con `visible` redefinido a `false`; cada 1 s, si alguna se movió o se quiso ocultar, se deshace ese grupo.
- **Fusión por material** en todo lo estático: edificios, la casa construida, las 210 esferas de nubes del parkour (una sola malla), interiores con más de 8 mallas opacas.
- Cachés de materiales, geometrías y texturas por clave (`color + JSON.stringify(opciones)`, redondeando a 2 decimales para no generar variantes). **Un solo programa de shader para todos los avatares.**
- Distancias de detalle: avatares y NPC con menos detalle a más de 32 m; NPC fuera a más de 110 m; bancos y faroles con alcance de 90 / 160 m.
- Pools fijos con índice circular: 120 chispas (las muertas estacionadas en y = −999), 1.800 partículas, 12 blancos, 140 cubitos (ocultos con escala 1e-4). Para ocultar una instancia: matriz de escala 0.
- La viga del monorriel en tramos de 40 m y el terreno con `computeBoundingSphere()` después de ubicar: así funciona el recorte por pantalla; `frustumCulled = false` solo en lo que se aleja de su origen (pasto que viaja, cubitos).

### 17.4 Lo medido en el banco

- Plaza en Chromium con SwiftShader (892×412, táctil), sumando todas las pasadas (`renderer.info.autoReset = false`), promedio de 12 cuadros tras 140 de calentamiento: **alta 1,23 millones de triángulos y 460 llamadas** (424–496; los cuadros con pasada de sombras suben), media 1,27 M / 475 (las sombras cada 2 cuadros y a 1024 no bajan el conteo), baja 831 mil / 357, mínima 532 mil / 311. Es el doble de triángulos y seis veces más llamadas que el bosque de `GUIA-JUEGOS.md § 6.6` (310–760 mil, 60–74): el look Aero no depende del presupuesto, pero la calidad automática lo baja donde hace falta.
- Otros reinos en calidad mínima: aqua 191 mil triángulos / 182 llamadas, aurora 93 mil / 150, jardín 177 mil / 155, juegos 387 mil / 163, tienda 122 mil / 288, casa 117 mil / 106.
- Trampa que se volvió a pagar: sin `autoReset = false`, con el post prendido `renderer.info` dice "1 triángulo, 1 llamada" (cuenta solo la última pasada). → `GUIA-JUEGOS.md § 9`
- Los cuadros por segundo del banco (22–46 cuadros en 8 s) no dicen nada de un teléfono.
## 18. La interfaz: vidrio, brillo y rebote

### 18.1 El CSS del vidrio

- **Dos capas en la hoja de estilos:** una base "menú de consola de 2006" (blanco, gris y celeste, franjas finitas, plano) y encima, en cascada, el vidrio Aero para botones, ranuras, barra de ítems y controles táctiles.
- Tokens: `--azul #34bef0` (acento), `--azul2 #1aa0d8` (texto celeste), `--tinta #5b6168` (**no hay texto negro**), `--fondo #eceff2`, `--verde #56d05a`, `--rojo #ff5f7a`, `--radio 18px`, `--sombra: 0 3px 0 rgba(0,0,0,.06), 0 6px 18px rgba(40,60,80,.12)` (escalón seco + difusa). Las sombras grandes son azules translúcidas (`rgba(30,110,170,.18)`): todo se tiñe de cielo.
- Colores locales por variable: cada botón táctil cambia solo `--c1/--c2`; la tienda deriva todo de un `--c` con `color-mix(in srgb, var(--c) 45%, white)`.

**El botón de vidrio, en cinco capas:**

1. Degradé partido con **la línea de luz del medio** (el salto de 46 % a 50 %): `linear-gradient(180deg, #fff 0%, #f6fbff 46%, #e1f1fd 50%, #eef8ff 78%, #fff 100%)`.
2. Doble borde: `border: 2px solid #fff; outline: 1px solid rgba(120,170,210,.45)`.
3. Tres sombras: externa azul, filo de luz arriba, resplandor celeste que entra desde abajo (la luz atraviesa el vidrio).
4. Reflejo en `::before`: media píldora blanca (alto 46 %, `border-radius: 999px 999px 40% 40% / 999px 999px 30% 30%`) detrás del texto con `z-index: -1` + `isolation: isolate`.
5. Destello en `::after`: una franja del 40 % inclinada −20° que en hover cruza de −60 % a 130 % en 0,7 s.

- Estados: **hover = foco** (mismo selector con `:focus-visible`: borde azul, halo `0 0 0 4px rgba(52,190,240,.22)`, sube 1 px); active `scale(.95) translateY(1px)` con sombra hacia adentro y **resorte** `transform .14s cubic-bezier(.3,1.6,.5,1)`; los táctiles usan clases del JS (`.apretado { transform: scale(.88); filter: brightness(1.15) saturate(1.2) }`) porque `:active` no sirve con varios dedos; deshabilitado solo con opacidad; bloqueado `grayscale(.7)`.
- Controles táctiles como **canicas de vidrio**: `radial-gradient(circle at 50% 78%, var(--c1), transparent 55%), radial-gradient(circle, rgba(255,255,255,.35), rgba(255,255,255,.12) 62%, var(--c2))` + `blur(3px)` + reflejo al 42 %.
- El micrófono crece con el volumen: `box-shadow: 0 0 0 calc(var(--nivel, 0) * 7px) rgba(86,208,90,.45)` (el JS escribe `--nivel`).
- Panel de vidrio: `linear-gradient(160deg, rgba(255,255,255,.86), rgba(223,246,255,.78))`, borde blanco de 2 px, `0 10px 30px rgba(20,80,140,.22), inset 0 1px 0 #fff`, `backdrop-filter: blur(10px)`. Avisos a lo Windows 7 (radio 7 px, marco azul oscuro + anillo blanco interno, `blur(8px) saturate(1.35)`, "Segoe UI" 12,5 px, barrita `scaleX(1 → 0)` durante `--dur`).
- El "celu" es un solo elemento con marco y pantalla: `border: 11px solid transparent; background: var(--pantalla) padding-box, linear-gradient(145deg, #fff, #eef3f6 45%, #d9e1e7) border-box`.
- Canales del menú con **Ken Burns** en la miniatura (`scale(1.05) translateX(−2%)` → `scale(1.15) translateX(2%)`, 18 s alternado). Pestañas con `border: 3px solid transparent` que pasa a azul: como el borde ya estaba, nada salta.

**La firma de las animaciones: el resorte** (un `cubic-bezier` con un valor mayor que 1 que se pasa y vuelve):

| animación | duración y curva | uso |
|---|---|---|
| aparece | 0,45 s ease, desde `scale(1.03)` y opacidad 0 | pantallas |
| notiEntra | 0,4 s `cubic-bezier(.2,1.3,.35,1)`, desde `translateY(-16px) scale(.96)` | avisos |
| apareceDer | 0,3 s `cubic-bezier(.2,.9,.3,1.2)`, desde `translateX(30px) scale(.96)` | paneles |
| celuSube | 0,42 s `cubic-bezier(.2,.9,.25,1.12)`, desde `translateY(55%) rotate(7deg) scale(.92)` con pivote 70 % 100 % | el teléfono entra de la mano |
| cuentaPop | 0,95 s `cubic-bezier(.2,1.6,.4,1)`: `scale(2.2)` → 1 → 0,7 | "3, 2, 1" |
| estrellaPop | 0,5 s `cubic-bezier(.2,1.8,.4,1)` desde `scale(0) rotate(-40deg)`, a 0,2 / 0,45 / 0,7 s | estrellas del resultado |
| latido / latidoBoton | 1,6 s / 2,4 s infinito | "seguir" y el botón Jugar |

- **Entrar rebotando, salir seco:** el teclado entra con `cubic-bezier(.2,1.35,.4,1)` en 0,42 s y sale con `ease-in` en 0,25 s.
- Escalonado: burbujas con `animation-delay` de `r × 0,9 s`; las del teclado con delay **negativo** para que arranquen a mitad de camino. Todo se mueve con períodos distintos (1,6 / 2,4 / 3 / 4 / 8 / 18 s) que no se sincronizan nunca.
- Tipografía redonda sin descargar nada: `"Nunito", "Varela Round", "Arial Rounded MT Bold", "Trebuchet MS", "Segoe UI", system-ui` (usa la primera instalada: el archivo anda sin red); pesos 800 y 900 casi siempre; tamaños con `clamp()` sobre unidades del juego (`clamp(34px, calc(7 * var(--vw)), 64px)`); logo en relieve `0 2px 0 #fff, 0 4px 12px rgba(52,190,240,.35)`; números grandes con `-webkit-text-stroke: 5px #1d8fd8` + sombra dura + glow; `tabular-nums` en relojes.
- Íconos: emojis en los botones; lo demás dibujado en CSS (esferita `radial-gradient(circle at 35% 30%, #fff, #7ff6ff 45%, #1fb0ea)`, joya con `clip-path: polygon(…)`, burbuja de jabón con el borde más claro que el centro, nube clonada con `box-shadow`, íconos SVG como `mask` sobre `currentColor`, aro de progreso con `conic-gradient` + máscara radial).
- **El giro del celular parado:** `#app { position: fixed; inset: 0; transform-origin: 0 0 }` y el JS le pone `translateX(<innerWidth>px) rotate(90deg)` con ancho y alto cruzados. Un ancestro con `transform` es el bloque contenedor de sus `position: fixed`: todo gira junto. `--vw`/`--vh` las reescribe el JS con el 1 % del juego; clases (`angosta`, `a700`, `a560`, `b460`) en vez de `@media` porque las media queries miran la pantalla física. `env(safe-area-inset-*)` siempre dentro de `max(10px, …)` (ojo: con `#app` girado, `env()` sigue siendo físico).
- Lo que evita los problemas de siempre:

```css
html, body { margin: 0; height: 100%; overflow: hidden; touch-action: none;
  -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
button { font-family: inherit; color: inherit; cursor: pointer; appearance: none; }
```

  + `maximum-scale=1, user-scalable=no, viewport-fit=cover`; devolver lo justo (`touch-action: pan-y` en lo que se desplaza, `user-select: text` en el chat y el código de amigo); `#ui` y el HUD con `pointer-events: none` que devuelven `auto` solo a sus botones (el HUD "se comía los toques de la palanca"); pseudo-elementos y `span` internos también con `none` (el `target` es siempre el botón); `contextmenu` y `wheel` cancelados en el lienzo.
- Capas: lienzo → líneas de TV (3) → dedos (4) → UI (5) → error (20) → precarga (30) → VR (40) → teclado y anuncio (60).
- **`backdrop-filter` re-desenfoca el 3D en cada cuadro:** con calidad baja, `.calidadBaja * { backdrop-filter: none !important }`.
- Retro por CSS: `body.lineasTV` (`repeating-linear-gradient(0deg, rgba(0,0,0,.2) 0 1px, transparent 1px 3px)` con parpadeo de 0,12 s en `steps(2)`) y `body.tuboTV` (rejilla RGB de 3 px + viñeta), en `#app::before/::after` para que giren con el juego.

**La receta mínima (valores del juego):**

```css
:root { --azul: #34bef0; --azul2: #1aa0d8; --tinta: #5b6168;
  --letra: "Nunito", "Varela Round", "Arial Rounded MT Bold", "Trebuchet MS", "Segoe UI", system-ui, sans-serif; }
.boton { position: relative; overflow: hidden; isolation: isolate; padding: 14px 28px; border-radius: 999px;
  font: 800 20px var(--letra); color: var(--tinta); cursor: pointer; appearance: none;
  background: linear-gradient(180deg, #ffffff 0%, #f6fbff 46%, #e1f1fd 50%, #eef8ff 78%, #ffffff 100%);
  border: 2px solid #ffffff; outline: 1px solid rgba(120,170,210,0.45);
  box-shadow: 0 6px 16px rgba(30,110,170,0.18), 0 1px 0 rgba(255,255,255,0.9) inset, 0 -6px 12px rgba(120,200,255,0.18) inset;
  transition: transform 0.14s cubic-bezier(.3,1.6,.5,1), box-shadow 0.2s, color 0.15s; }
.boton::before { content: ''; position: absolute; left: 6%; right: 6%; top: 3%; height: 46%; z-index: -1; pointer-events: none;
  border-radius: 999px 999px 40% 40% / 999px 999px 30% 30%;
  background: linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.15)); }
.boton::after { content: ''; position: absolute; top: -20%; bottom: -20%; width: 40%; left: -60%; z-index: 1; pointer-events: none;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,0.75), transparent); transform: skewX(-20deg); }
.boton:hover, .boton:focus-visible { border-color: var(--azul); color: var(--azul2); outline-color: rgba(52,190,240,0.9);
  transform: translateY(-1px); box-shadow: 0 0 0 4px rgba(52,190,240,0.22), 0 8px 20px rgba(30,140,210,0.28),
  0 1px 0 #fff inset, 0 -8px 14px rgba(90,200,255,0.3) inset; }
.boton:hover::after, .boton:focus-visible::after { animation: destelloBoton 0.7s ease; }
.boton:active { transform: scale(0.95) translateY(1px); box-shadow: 0 2px 6px rgba(30,110,170,0.2), 0 3px 10px rgba(0,60,120,0.15) inset; }
.boton.primario { color: #fff; text-shadow: 0 1px 2px rgba(0,70,130,0.45); border-color: #c9f6ff; outline-color: rgba(10,120,190,0.6);
  background: linear-gradient(180deg, #a8f4ff 0%, #4fd6ff 46%, #13aee9 50%, #1cbcf5 78%, #6fe2ff 100%);
  box-shadow: 0 6px 18px rgba(10,150,220,0.4), 0 1px 0 rgba(255,255,255,0.8) inset, 0 -8px 14px rgba(0,120,200,0.35) inset; }
.onda { position: absolute; left: 50%; top: 50%; width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 50%;
  pointer-events: none; z-index: 2; animation: onda 0.55s ease-out forwards;
  background: radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(160,230,255,0.55) 45%, rgba(160,230,255,0) 70%); }
.panel { border-radius: 22px; padding: 10px; border: 2px solid rgba(255,255,255,0.95);
  background: linear-gradient(160deg, rgba(255,255,255,0.86), rgba(223,246,255,0.78));
  box-shadow: 0 10px 30px rgba(20,80,140,0.22), inset 0 1px 0 #fff;
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  animation: apareceDer 0.3s cubic-bezier(.2,.9,.3,1.2) both; }
@keyframes apareceDer { from { opacity: 0; transform: translateX(30px) scale(0.96); } to { opacity: 1; transform: none; } }
@keyframes destelloBoton { to { left: 130%; } }
@keyframes onda { from { transform: scale(0.2); opacity: 1; } to { transform: scale(7); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .onda, .boton::after { animation: none !important; } }
```

```js
// la onda: en captura, sobre cualquier botón nuevo, sin tocar cada uno
document.addEventListener("pointerdown", e => {
  const b = e.target.closest(".boton"); if (!b || b.disabled) return;
  const i = document.createElement("i"); i.className = "onda"; b.appendChild(i); setTimeout(() => i.remove(), 600);
}, true);
```

### 18.2 La interfaz DOM: pocas piezas, bien resueltas

- Dos ayudantes: `Se(sel)` para buscar y `bt(html)` que convierte una plantilla en su primer elemento. Cada pantalla es `limpiar()` + `poner(bt(…))` sobre un único `#ui`. **Lo variable entra siempre por `textContent`**; en las plantillas solo van textos traducidos y números.
- **Una sola ventana a la vez**, con velo, ancho `min(ancho, 94 × --vw)`, ✕ de 40×40, cierre con Escape (listener en captura con `stopPropagation`: no pausa el juego) o tocando el velo. "Atrás" por callbacks (`this.opciones(() => this.pausa())`).
- **Menú a lo Wii:** 10 canales + casillas vacías hasta 12; burbujas en 10/30/55/75/88 % del ancho, desfasadas 0,9 s; reloj que se reprograma cada 1 s y se corta solo cuando la pantalla ya no está (`isConnected`); fecha en es-AR / en-US / pt-BR; banderas dibujadas con gradientes CSS. Las miniaturas de los canales se dibujan en canvas y se pasan con `toDataURL`: cero imágenes.
- **El canal se abre desde su baldosa:**

```js
capa.animate([{ clipPath: `inset(${c.top}px ${W - c.right}px ${H - c.bottom}px ${c.left}px round 18px)` },
              { clipPath: 'inset(0 0 0 0 round 0)' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
```

- **Onda al tocar** en cualquier botón, gratis: un `pointerdown` global en captura mete un `<i class="onda">` y lo saca a los 600 ms (círculo de 30 px, radial blanco → celeste, `scale(.2)` → `scale(7)` y opacidad 1 → 0 en 0,55 s).
- Sonidos delegados: `pointerover` suena "mover" solo al entrar a un botón distinto del último; todo `click` en un botón suena "elegir".
- **Reiniciar una animación CSS sin recrear el nodo:** `el.style.animation = 'none'; el.offsetWidth; el.style.animation = ''` (o sacar la clase, leer `offsetWidth` y volver a ponerla).
- **Notificaciones** que duran lo que tarda leerlas (`min(6500, 3200 + largo × 35)` ms), que **suman "×n" en vez de apilarse**, una a la vez, con el ícono sacado del emoji con que empieza el mensaje (`\p{Extended_Pictographic}`) y un historial de 30; en VR van al visor.
- **Diálogo** que escribe 2 letras cada 22 ms (~90 por segundo) con un bip cada 4; un toque completa la frase y el siguiente avanza; modo cine con franjas de 9 vh y el resto del HUD a opacidad 0.
- **HUD que no recalcula estilos:** cada nodo guarda su último texto y solo se escribe si cambió (`if (el._t !== t) { el._t = t; el.textContent = t }`); los porcentajes se redondean a 0,1.
- La paginación del probador lee la grilla real del CSS (`gridTemplateColumns.split(' ').length`, `rowGap`, alto del primer ítem): la cantidad por página sigue al CSS responsivo.
- Teclado en los menús: a los 60 ms se enfoca el botón principal y las flechas rotan el foco entre los botones visibles y habilitados, con sonido. Accesibilidad: `role="status"` en las notificaciones, `aria-label` en los botones de solo ícono, `aria-hidden` en los dibujos, textos distintos para `pointer: coarse`.
- `prefers-reduced-motion` apaga la onda y los brillos; con calidad baja se sacan todos los `backdrop-filter` y el velo queda más opaco (0,85).
- El muñeco de los menús es un SVG de 60×100 con un `radialGradient` centrado en (0,35; 0,3) de blanco al color: el efecto caramelo sin 3D.

### 18.3 El "celu": una app dentro del juego

- Pila de pantallas de hasta 8, un solo `click` y un solo `submit` delegados con `data-*`. **Al repintar guarda el valor del campo, el foco y el `scrollTop` y los restaura**: no te rompe lo que estás escribiendo. No repinta con el teclado virtual abierto.
- Entrada de cada pantalla: `animate([{opacity: 0, transform: "translateY(8px) scale(.985)"}, {opacity: 1}], {duration: 200, easing: "cubic-bezier(.2,.9,.3,1.2)"})` — el 1,2 da el rebotito.
- Íconos "gelatina" en CSS puro:

```css
.cel-ico { border-radius:16px; background:linear-gradient(160deg,var(--c1),var(--c2));
  border:1.5px solid rgba(255,255,255,.85);
  box-shadow:0 4px 10px rgba(0,50,90,.28), inset 0 -3px 6px rgba(0,0,0,.12);
  transition:transform .15s cubic-bezier(.2,.9,.3,1.4); }
.cel-ico::before { content:""; position:absolute; left:3px; right:3px; top:2px; height:46%;
  border-radius:13px 13px 40% 40% / 13px 13px 12px 12px;
  background:linear-gradient(rgba(255,255,255,.85), rgba(255,255,255,.12)); }
```

- Fondo de cielo `#25acef → #6fd2ff 38% → #c9f2ff 68% → #eafbff 80%`, lomas con `radial-gradient` de borde duro, reflejo de vidrio `linear-gradient(118deg, rgba(255,255,255,.34), rgba(255,255,255,.06) 26%, transparent 27%)`.
- Teclado virtual propio en táctil (`readOnly`, `inputmode="none"`): capas de letras con ñ, símbolos y emojis; acentos con pulsación larga de 420 ms; borrado que repite a los 380 ms cada 55 ms; doble toque en ⇧ bloquea mayúsculas; `maxLength` contado con `[...valor]` (los emojis no se cortan); dispara eventos `input` para que el resto no note la diferencia.

### 18.4 Texto y paneles dentro del mundo 3D

- **Nombre sobre el avatar:** canvas de 48 px, fuente 800 al 66 %, contorno blanco del 16 % con `lineJoin round`, hasta 22 caracteres; `Sprite` a 0,0046 m/px con `depthWrite: false`.
- **Globo de chat:** 90 caracteres, 24 por renglón, esquinas de 18 y piquito; dura 6 s y se funde al final.
- **Cartel "gel":** canvas de 1024 px con degradé, borde de 14 px y **brillo 0,9 → 0 en el 42 % de arriba**; el `emissiveMap` es la misma textura a 0,25 para que se lea en la sombra. Las pantallas van con `toneMapped: false`: brillan igual de día y de noche.
- **Paneles 3D** (`CanvasTexture` de 1024 px, `MeshBasicMaterial` transparente, `depthWrite: false`, `toneMapped: false`): se repintan solo si están `sucio`; degradé `rgba(236,250,255,.94) → rgba(150,214,246,.9)`, sombra azul de blur 26, brillo arriba, borde blanco de 4 px; pastillas de radio `min(h/2, 30)` que al apretarse bajan 4 px.
- Para tocar un panel con el dedo, el clic es un **flanco**: la yema cruza de más de 6 mm a menos. Con la mirada: 1,4 s y 1,2 s de enfriamiento. Aparece con un easeOutBack de 0,32 s (`1 + 2,2 x³ + 1,2 x²`). Si lo soltás a menos de 22 cm de una pared, se pega.
- **La misma UI sirve en VR:** cada 0,25 s se lee la ventana abierta del DOM (el `h2`, el texto con un TreeWalker hasta 700 caracteres, los botones por `aria-label`/`title`/texto, el primer canvas visible de más de 60×60) y se pinta en un panel de 1,3 × 0,84 m (12 botones por página); al tocar en VR se llama a `el.click()` del botón real. Se repinta solo si cambió la firma `título#texto#botones`.

### 18.5 Tienda, editor y misiones

- **Dos monedas:** orbes (se juntan jugando) y joyas (se compran). Paquetes de 100, 500 + 50 ("el más elegido"), 1.000 + 200 y una bienvenida (300 💎 + 500 orbes) una sola vez; regalo diario de +10 💎 (aparece a los 1,8 s) y hasta 5 anuncios de 5 💎 por día.
- Ítems gratis, por orbes (12–90), por joyas (100–300) o **bloqueados por una misión de un NPC**. Te lo probás antes de pagar y el botón cambia según tu saldo: Comprar / Conseguir 💎 / 📺 +30 orbes / Te faltan N.
- La compra real la decide el servidor (orden → pago → consulta de entrega 20 veces cada 1,5 s); sin proveedor, modo prueba.
- **16 NPC** hechos con el mismo avatar que el jugador; 11 con misión `{tipo, meta, orbes 10–40}` y estados `nueva → activa → lista → hecha`; sus textos (oferta partida en burbujas con `|`, recordatorio `{n} de {m}`, premio y charla final) **enseñan otros sistemas** ("tecla F", "tecla 5"). `contar(tipo, n, id)` avanza todas las misiones de ese tipo; con `id`, solo cuenta cosas distintas.
- Paleta del editor: 13 tonos en rueda, 4 oscuros, 5 neutros y 2 pasteles, más un `<input type="color">`.
## 19. Resguardos: las lecciones ya pagadas

| lo que pasaba (o podía pasar) | el resguardo |
|---|---|
| el juego abierto desde una vista previa no corre y se ve una página en blanco | `#precarga` en HTML/CSS puro; a los 7 s "abrilo con Chrome, Safari, Edge o Firefox"; `<noscript>` |
| no hay WebGL o se pierde el contexto | el motor se crea en `try`; `webglcontextlost` → `preventDefault`, calidad mínima guardada y recarga |
| un error por cuadro llena la pantalla de carteles | dedupe por mensaje, hasta 5 distintos; el cartel ofrece bajar calidad |
| el primer material nuevo traba el juego | `compileAsync` en carrera con un tope (6–9 s), en `try`, detrás del velo del viaje |
| sin internet no carga la librería de red | se carga `async`, con un segundo CDN a los 4 s y "sin red" a los 10 s: se juega solo |
| una imagen embebida falla | cada promesa de carga se resuelve igual; texturas blancas de 1×1 y banderas `uHayTex` |
| dos `onBeforeCompile` comparten programa o se pisan | cada parche encadena el anterior y suma su parte a `customProgramCacheKey` (con sus parámetros literales) |
| los ShaderMaterial propios salen con otro color que el resto | se les agregan `tonemapping_fragment` y `colorspace_fragment` una sola vez (marca `_salida`) |
| cambiar `shadow.mapSize` no hace nada | `dispose()` y `map = null`; cambiar el MSAA exige rearmar la cadena |
| con `flatShading` el shader no compila | no existe `vNormal`: usar `normal` |
| el canvas pierde la fuente al redimensionarlo | volver a poner `font` después de cambiar el tamaño |
| `decodeAudioData` deja inservible el búfer | pasarle una copia; atender callback y promesa |
| `exponentialRampToValueAtTime(0)` tira error | rampas a `1e-4` |
| teclas pegadas al perder el foco | en `blur` se suelta todo |
| `localStorage` lleno, bloqueado o con basura | siempre en `try`; rangos validados al leer (`escalaMano` solo entre 0,6 y 1,6); defaults fusionados en profundidad con lo guardado (los campos nuevos no rompen partidas viejas) |
| guardar en cada cambio traba | debounce de 250 ms; inmediato después de una compra y al ocultarse la página |
| lo que llega por la red rompe el mundo | `JSON.parse` en `try`, `Number.isFinite`/`isInteger`, colores con `/^#[0-9a-f]{6}$/i`, listas blancas, topes (200 piezas, radio 12, 120 caracteres, 40 mensajes/s), texto al DOM con `textContent` |
| una pestaña dormida despierta y dispara todas las notas atrasadas | el scheduler de música salta al pulso actual si quedó más de 0,1 s atrás |
| bajo 20 fps el jugador atraviesa paredes | `dt` recortado a 0,05 s y subpasos de medio radio (máx. 8) |
| el animador parpadea al bajar un escalón | "cae" recién tras 0,12 s en el aire |
| una llamada al nativo tira una excepción de Java | `try` + `?.` + tipos forzados; esperas que se resuelven por tiempo |
| el diálogo se saltea las opciones por un toque apurado | las teclas no saltean las opciones y el diálogo escucha recién a los 50 ms |
| números del HUD que recalculan estilos en cada cuadro | cada nodo guarda su último texto y solo se escribe si cambió |
| la ventana se cierra con Escape pero el juego también pausa | el listener de Escape va en captura y hace `stopPropagation` |
| destellos y sustos para quien no los quiere | opción para apagar los sustos, aviso al entrar, `prefers-reduced-motion` apaga la onda y los brillos |

### Puntos flojos que conviene no copiar

- Una confirmación destructiva ("borrar todo") con el foco en "Sí" a los 50 ms: un Enter borra. En confirmaciones destructivas, el foco va en "No".
- Un límite de mensajes por id no sirve si el id es gratis (ver § 12.6): hace falta además un tope global.
- Una onda hecha con `RingGeometry` cuyo shader lee las UV como si cruzaran el anillo (las UV de `RingGeometry` son planas): usar `length(vUv − 0,5) × 2`.
- Parchear un shader de three con `.replace()` falla en silencio si el texto original cambia en otra versión: chequear que el reemplazo haya encontrado algo.
- En CSS: `translateX(-calc(…))` no es válido (va `calc(-60 * var(--vw))`); un `@keyframes` repetido lo gana el último; un `.sale { … !important }` le gana a `.noti.sale` y la animación de salida nunca corre; con `#app` girado, `vw`/`vh` crudos miden la pantalla física (usar las variables del juego).
## 20. Lo más valioso para copiar

**Look**
1. Cielo por shader que alimenta niebla, reflejos (PMREM cada 8–60 s) y agua (§ 1).
2. HDR selectivo + bloom con umbral 1,45 y fuerza 0,38 a 1/4 de resolución (§ 2.1).
3. Borde fresnel emisivo encadenado con su clave de programa, en todos los materiales (§ 3.1).
4. Pasada final única: saturación 1,12, viñeta 0,22, destello, fundido, agua y glitch por uniform (§ 2.2).
5. Pasto toroidal en GPU con mapa de alturas y agua en dos triángulos con textura de profundidad (§ 5).

**Personaje y movimiento**
6. Poses dispersas + espejo + suavizado exponencial por canal (26 y 14 por segundo): animación rica sin archivos ni máquina de transiciones (§ 7).
7. Cadencia atada a la velocidad, squash al aterrizar, stretch al despegar, inclinarse en la curva, contragirar la cabeza (§ 7.2–7.3).
8. Aceleración con tope + coyote 0,12 s + buffer 0,14 s + gravedad ×2,1 al soltar (§ 8.2–8.3).
9. Choques 2,5D con escalón de 0,45 m, subpasos de medio radio y la normal de la pared sacada del empuje (§ 8.4).

**Mundo y bucle**
10. Terreno como suma de funciones, siembra con semilla y reglas de lugar ("todo mira a algo", orbes como migas) (§ 9).
11. Horarios con `Date.now()`: día, trenes y mundo iguales para todos sin red (§ 1.2, § 8.8).
12. Orden del cuadro: simular → cámara → lo que mira a la cámara → dibujar; `dt` recortado a 0,05 y `dtReal` aparte (§ 10.1).
13. Cámara con `1 − exp(−dt·k)`, choque de 16 muestras que se acerca al instante y se aleja a `dt × 2,5` (§ 10.2).
14. Viaje con velo: fundido de 350 ms, armar, `Promise.all([900 ms, compileAsync con tope])`, fundido de 450 ms (§ 10.3).

**Sonido**
15. MP3 con `loopStart`/`loopEnd` exactos y el primer tiempo fuerte alineado a +0,4 s; fundidos con `setTargetAtTime` (§ 11.1).
16. Reverb con respuesta generada, bus de música filtrable (bajo el agua) separado de los efectos (§ 11.4).
17. La canción analizada de antemano como texto (pulsos y energía) para sincronizar eventos sin `AnalyserNode` (§ 15.3).

**Diseño**
18. Minijuego de 60 s: riesgo/recompensa, racha hasta ×4, escalón de dificultad en los últimos 20 s, estrellas con umbrales y premio solo por estrellas nuevas (§ 15.1, § 15.5).
19. Castigo suave: obstáculo fantasma 1,3 s + 0,42 s de aturdimiento + control que solo avanza, con holgura medida (§ 15.2).
20. IA con un defecto calibrado (25 % al azar, 85 % de memoria) y una compu que "piensa" 0,7–1,3 s (§ 15.4).

**Técnica**
21. Calidad en dos etapas: puntaje de la placa al arrancar y 60 cuadros medidos (bajar a más de 30 ms, subir una sola vez a menos de 13 ms) (§ 17.2).
22. Autoinstanciado y corte por distancia redefiniendo `visible`, con la niebla atada al corte (§ 17.3).
23. Estado de red a ≤ 10 Hz solo si cambió + latido de 1,5 s + vencimiento de 5 s; lo pesado viaja como hash y se pide (§ 12.2).
24. Mensajes retenidos como base de datos sin servidor, con los últimos 30 mensajes en cada envío y números que solo crecen (§ 12.4).
25. Una sola interfaz DOM que también se pinta en VR (se lee la ventana y se hace `click()` en el botón real) (§ 18).

## 21. Para arrancar un juego nuevo con este look

1. Renderer con `NeutralToneMapping`, HDR (HalfFloat) + MSAA en el target, bloom con umbral > 1 y una pasada final propia (§ 1.1, § 2).
2. Un domo de cielo por shader con `hora`, y que niebla, hemisférica y PMREM salgan de él (§ 1.2–1.4).
3. Dos o tres materiales base con borde fresnel (cerámica, caramelo, vidrio) y una paleta cacheada (§ 3).
4. Geometría por código con cajas redondeadas, fusionada por material; instancias para lo repetido (§ 4, § 17.3).
5. El personaje con primitivas, poses como datos y el animador de suavizado por canal (§ 6–7).
6. Controlador con las constantes de § 8.1 (probadas: se sienten bien) y eventos de física.
7. Viento, pasto, agua y cosas que se mueven (§ 5, § 7.4).
8. Interfaz de vidrio (§ 18) con sonido en cada toque (§ 11.5).
9. La tabla de calidades y el juez que mide (§ 17), `?directo` + `?pausa` + `window.__X` para el banco desde el día uno (§ 0).
10. Todo lo de § 19 antes de decir "listo".

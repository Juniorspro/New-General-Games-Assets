# Juegos que se ven bien — la receta, con Rezona

Esto es lo que hace falta para que un juego web se vea como el bosque de
`bosque/` y no como un demo de three.js: qué pedirle a Rezona, cómo procesar lo
que llega y qué hacer en el motor. Está escrito para dárselo a un agente
(Claude Code, Codex) conectado a Rezona Lab, pero se lee igual.

**Cómo se usa.** Copiá este archivo a la carpeta del juego, al lado del
`AGENTS.md` que deja `rezona init`, y decile al agente: *"Leé GUIA-JUEGOS.md
antes de generar nada y seguilo"*. Todo lo que dice acá salió de hacerlo: cada
número está medido y cada trampa costó una tarde.

**De dónde salen los números.** Los assets del bosque se generaron con
Higgsfield porque ese día Rezona no generaba (sección 1). Lo que se aprendió
procesándolos y en el motor vale igual para lo que llega de Rezona, que también
hace el 3D con Tripo. Los números propios de Rezona son de otros juegos de este
repo (`pique3d/`, `perro/`, `enjambre/`) y cada uno lo dice donde aparece.

---

## 0. La regla que ordena todo lo demás

**Un juego se ve bien por la luz, no por los polígonos.** El orden de lo que
más rinde, de mayor a menor:

1. **Una sola hora del día y un sol que manda.** Un atardecer con el sol
   rasante da sombras largas y contraste. La luz ambiente nunca puede sumar
   más que el sol sobre el suelo: si lo hace, todo sale plano y lechoso.
2. **Atmósfera.** Niebla del mismo color que el horizonte del cielo, más densa
   en lo bajo y dorada hacia el lado del sol. Es lo que da profundidad.
3. **Tono de película.** Dibujar en HDR (coma flotante) y aplicar AgX o ACES al
   final. Los valores por defecto de three.js dan "plástico gris".
4. **Materiales de foto.** Texturas generadas, repetibles y con mapa de
   normales, en vez de colores planos.
5. **Densidad antes que detalle.** Tres mil árboles simples con tres niveles de
   detalle se ven mejor que cincuenta árboles perfectos.
6. **Todo se mueve un poco.** Viento en las plantas, polvo en el aire, la
   cámara con mano, fuego y agua.
7. **Un post-proceso con identidad.** VHS, grano de película, lo que sea: borra
   lo que delata lo falso (bordes perfectos, texturas repetidas).
8. **Sonido con distancia.** Lo lejano con reverberación; si no, el mundo suena
   a una habitación.

Los pasos 1, 2, 3 y 7 no cuestan ni un crédito. Hacelos siempre, aunque Rezona
no genere nada.

---

## 1. Preparar Rezona

```bash
cd mi-juego
npx rezona@latest init              # login + registra el MCP + deja .rezona/
npx rezona@latest status            # quién sos, créditos, qué se alcanza
```

En una máquina sin navegador (contenedor, SSH):

```bash
npx rezona@latest login --no-browser
# imprime https://rezona.ai/api-keys?code=XXXX-XXXX-XXXX-XXXX
# se abre en el teléfono, se comprueba que el código coincida y se aprueba
```

- **El MCP se carga al arrancar la sesión del agente.** Si lo registraste con
  la sesión abierta, esa sesión no lo ve: reiniciala, o hablale por stdio
  (`npx rezona@latest mcp`; en este repo, `herramientas/rezona/rz.py`).
- **`fetch_generated_asset` y `upload_project` exigen la carpeta `.rezona/`**
  en el directorio donde escriben. Corré `init` una vez por proyecto.
- **Un proyecto por juego** (`create_project`, gratis). Guardá el
  `public_id` y, sobre todo, **cada pedido que salió bien con sus parámetros**
  en un archivo de estado (`estado.json`): repetir una tanda cuesta créditos, y
  lo más caro de averiguar son los parámetros que funcionan.

**Antes de una tanda, una imagen de prueba.** El 22/09/2026 los pedidos de
imagen y de audio volvían con `CREDIT_RESERVE_FAILED` ("el servicio de cobro no
está disponible") aunque la cuenta tenía 446 mil créditos: probado con dos
modelos, dos proyectos y seis reintentos (`enjambre/README.md`). Si la prueba
falla, no reintentes en bucle ni simules assets: pasá al plan B (sección 8) y
decilo.

### Las herramientas y lo que conviene saber de cada una

| herramienta | para qué | lo que no dice el nombre |
|---|---|---|
| `submit_image_generation` | cielo, texturas, recortes, arte de tapa | devuelve un `task_id` al instante: todavía no hay archivo |
| `submit_model3d_generation` | objetos y personajes | con `source_url` de una imagen propia sale mucho mejor que desde texto |
| `submit_rig3d_generation` | esqueleto + animaciones | `source_task_id` = el `gtask-…` de TU modelo 3D; cada animación se cobra aparte |
| `submit_retexture_generation` | cambiarle la piel a un modelo | `text_prompt` e `image_prompt_url` son excluyentes |
| `submit_audio_generation` | música, efectos, voz | `kind`: `music`, `sound`, `speech` (o `auto`, que cuesta una llamada más) |
| `submit_sprite_generation` | hojas de sprites 2D | una sola acción por hoja |
| `check_generation_tasks` | ver si terminó | pasale `project_id` y cada ítem listo trae su `public_url` |
| `fetch_generated_asset` | bajarlo a disco | usá el `output_path` de la RESPUESTA (ver abajo) |
| `upload_project` | subir el juego armado | gratis; necesita `dist/index.html`; devuelve el `play_url` |
| `publish_to_rezona_app` | publicarlo en la app | **irreversible**: solo si la persona lo pide |

**Las cuatro trampas de la generación, todas cuestan créditos:**

1. **El `output_path` que vale es el de la respuesta.** Pedís `assets/roca.png`
   y el servidor lo guarda como `assets/roca-g1.png`. Usar el que mandaste no
   encuentra nada.
2. **`size` respeta la proporción, no el número.** Pediste 1536x672 y llegó
   1376x768. Si necesitás una medida exacta, redimensionás vos después.
3. **Fondo transparente de verdad = `transparent: true`.** Sin eso viene con
   fondo aunque el pedido diga "sin fondo".
4. **El modelo de imagen por defecto saca solo PNG.** Con `.jpg` en
   `output_path` devuelve `GENERATION_OUTPUT_FORMAT_MISMATCH`, que es
   terminal: no reintentes, cambiá la extensión.

Las reglas de tamaño del kit de juegos de Rezona: los dos lados múltiplos de
16, al menos 655.360 pixeles en total, el lado largo hasta 3840, proporción
hasta 3:1. El tamaño por defecto es 1024x1024 en calidad baja: sirve para
piezas chicas, no para lo que carga el look del juego.

---

## 2. La lista de assets, antes de generar nada

**Primero, una frase de estilo** (lo dice también el kit de Rezona): medio +
paleta + luz, por ejemplo *"photoreal, golden hour, low warm sun, soft blue
haze, muted greens"*. Va **al final de cada pedido de imagen**, idéntica. La
deriva de estilo entre tandas es la razón número uno de que un juego parezca
un collage de fotos de stock.

**Segundo, la escala real y la hora.** Todo en metros: el personaje mide
1,75, un abeto grande 30, una roca 2. Y una sola hora del día para todo.

Para un juego 3D de exploración, esta lista alcanzó para el bosque:

| qué | cuántas | cómo se pide | dónde termina |
|---|---|---|---|
| cielo 360 | 1 | imagen 21:9 lo más grande posible | panorama equirectangular 4096x2048 |
| suelos (hojarasca, musgo, sendero, roca) | 4 | imagen 1:1 "seamless tileable" | 1024 color + 512 normales |
| cortezas | 1 o 2 | imagen 1:1 "seamless tileable" | 1024 + 512 |
| recortes de follaje (ramas, helecho, pasto, hojas, flores) | 5-8 | imagen sobre blanco, `transparent: true` | webp con alfa, 512-1024 |
| objetos (rocas, tronco caído, tocón, cabaña, fogata, el ítem a buscar) | 5-8 | imagen 3/4 sobre blanco → 3D | GLB de 2.500 a 20.000 triángulos |
| personaje | 1 | imagen en pose A → 3D → esqueleto con animaciones | GLB con 4 clips |
| música, ambiente, efectos | 5-10 | `submit_audio_generation` | mp3 |

Lo que **no** conviene generar: árboles enteros en 3D (sección 6.5), botones y
partículas (se dibujan con código, son más nítidos y no cuestan nada) y el
terreno (sale de ruido).

---

## 3. Pedidos que salieron bien al primer intento

La forma que anduvo en las 23 imágenes del bosque: **tipo de toma primero,
sujeto concreto, luz, y cerrar negando lo que no querés**. Negar ("no text, no
watermark, no shadow") es lo que más mejora el resultado.

**Cielo 360:**

```
Seamless 360-degree cylindrical panorama of the sky at golden hour over a
northern wilderness, photorealistic HDR photograph, wraps around horizontally
with matching left and right edges. The horizon line sits exactly at the
vertical middle of the image. Upper half: a warm low sun glowing close above
the horizon at the left third, soft scattered cumulus and thin cirrus clouds
lit gold and peach near the sun, the rest of the sky clean pale blue. Along
the horizon line all the way around: a faint distant range of blue hazy
mountains. Lower half below the horizon: uniform soft blue-grey atmospheric
mist, featureless. No trees, no foreground, no people, no birds, no text, no
watermark, no frame, no lens flare.
```

El modelo no respeta "el horizonte en la mitad" (le cae en el 54 %) ni cierra
los bordes: eso se arregla después (sección 5.3). Pedí "bruma pareja abajo":
esa franja es la que se ve detrás del terreno lejano, y tiene que ser del color
de la niebla.

**Textura repetible:**

```
Seamless tileable texture, orthographic top-down photograph of a coniferous
forest floor: fallen brown fir needles, small twigs, a few tiny cones,
scattered dry leaves and small patches of green moss. Perfectly even diffuse
overcast lighting, no cast shadows, no perspective, no vignette, uniform detail
and density across the whole frame, edges wrap seamlessly. Photoreal PBR albedo
texture. No text, no watermark, no border.
```

Para cortezas: *"flat orthographic front photograph of … bark, the bark fills
the entire frame edge to edge"*.

**Recorte de follaje** (con `transparent: true`):

```
A single flat branch of a noble fir tree photographed from directly above on a
pure white seamless background: one woody main stem running from the bottom
center up to the top, many side twigs densely covered in dark green needles,
the branch fills most of the frame. Studio product lighting, crisp focus, no
shadow on the background, nothing else in the image. No text, no watermark.
```

*"El tallo sale del centro de abajo"* no es un detalle: así la tarjeta se
engancha a la rama por el borde de abajo de la textura.

**Objeto para pasar a 3D:**

```
A single large rounded granite boulder partially covered with thick green moss
on top, three-quarter view, isolated on a pure white seamless background, the
whole object visible with margin. Photoreal PBR game asset, soft even studio
lighting, no ground, no cast shadow, nothing else. No text, no watermark.
```

**Personaje para pasar a 3D con esqueleto:**

```
Full-body 3D game character of a young adult hiker standing in a neutral
A-pose (arms straight and angled down about 45 degrees away from the body,
hands open, legs slightly apart), front view facing the camera, symmetrical.
[ropa concreta, con colores]. Realistic proportions, photoreal PBR game-asset
render, even soft studio lighting, pure white background, the entire body
visible from head to boots with margin, no shadow, nothing in the hands.
No text, no watermark.
```

Brazos separados del cuerpo y piernas abiertas: si se tocan, el esqueleto
automático pega el brazo a la cadera y se deforma al caminar. Nada en las
manos: el 3D lo funde con los dedos.

---

## 4. De la imagen al 3D, al esqueleto y a la web

### 4.1 Imagen → 3D

```
submit_model3d_generation {
  project_id, output_path: "assets/roca.glb", prompt: "mossy granite boulder",
  source_url: <public_url de la imagen>, texture: true, pbr: true,
  texture_quality: "detailed"      // solo para lo que la cámara ve de cerca
}
```

- Tarda **~155-185 s por modelo** (medido en Rezona con `texture`, `pbr` y
  `texture_quality: "detailed"`).
- **Sale pesadísimo:** 28-30 MB y 960-990 mil triángulos por modelo (medido en
  `pique3d/` y en las páginas de `herramientas/rezona/estado.json`). Tal cual
  no sirve en un teléfono: el kit de Rezona pone el tope en 50 mil triángulos
  por modelo principal.
- La cadena que funcionó, con `@gltf-transform`: `weld` → `simplify` →
  texturas a 1024 en webp → `quantize` → `prune`. Un objeto que se repite
  (rocas, troncos) va a ~2.500 triángulos; uno único y cercano (una cabaña)
  aguanta 20 mil.

```js
await doc.transform(weld(), dedup(),
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.33, error: 0.012 }));
await doc.transform(textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024], quality: 78 }));
await doc.transform(quantize(), prune());
```

**`error` es relativo al tamaño del modelo.** Con 0,001 el simplificador casi
no toca nada (de 7.674 a 7.236 triángulos); con 0,012 llega al ratio pedido.

### 4.2 La trampa del modelo cuantizado

El `quantize()` de la cadena de arriba guarda las posiciones en enteros de 16
bits entre -1 y 1, y la escala real la pone el nodo. **Si horneás la escala en
los vértices, todo lo que pasa de 1 se recorta sin aviso.** Una cabaña de 9,5 m quedó aplastada en
un cubo de 2 m y no aparecía en ningún lado. Antes de transformar, a coma
flotante:

```js
function aFlotante(g) {
  for (const [nombre, a] of Object.entries(g.attributes)) {
    if (a.array instanceof Float32Array && !a.normalized) continue;
    const n = a.count, k = a.itemSize, d = new Float32Array(n * k);
    for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) d[i * k + c] = a.getComponent(i, c);
    g.setAttribute(nombre, new THREE.BufferAttribute(d, k));
  }
  return g;
}
```

Los modelos llegan sin escala real (los del bosque, normalizados a un cubo de
1 m) y sin saber qué es "abajo": medí la caja, llevalo al tamaño real y apoyalo
un poco hundido.
Una roca apoyada justo en su punto más bajo parece una calcomanía.

### 4.3 El esqueleto y las animaciones

```
submit_rig3d_generation {
  project_id, output_path: "assets/caminante.glb",
  source_task_id: "<gtask-… de TU submit_model3d_generation>",
  animations: ["preset:idle", "preset:walk", "preset:run"]   // hasta 5; cada una se cobra
}
```

**Comprobá lo que llegó, no lo que pediste.** En `perro/` se pidieron
`walk`, `run` e `idle` para un perro y las tres volvieron con el mismo
`preset:quadruped:walk`. Con `gltf-transform inspect` se ven los clips y su
duración. Si falta un clip, o se arma un esqueleto propio por regiones de
vértices (así anda el perro de `perro/`) o se pide de nuevo.

Lo que hay que medir antes de programar el personaje:

- **Si viene "en el lugar".** Mirá el canal de traslación de la cadera
  (`Hips`): si se corre centímetros en todo el clip, el avance lo pone el
  código. Si avanza metros, sacale la traslación en x y z.
- **El ciclo de cada animación**, en segundos. Se mide con los cruces del muslo
  (`LeftUpLeg`, rotación). En el bosque: caminar 1,411 s por ciclo (el clip de
  4,233 s son tres ciclos justos) y correr 0,767 s.
- **La velocidad de reproducción sale de la zancada:**
  `timeScale = velocidad / (zancada / ciclo)`. Sin esto los pies patinan.
- **Caminar y correr van en la misma fase.** Al mezclarlos, poné el tiempo del
  clip de correr en la fase del de caminar. Si no, la pierna izquierda de uno
  se promedia con la derecha del otro y el personaje flota con las piernas
  juntas.
- **La velocidad que anima es la recorrida de verdad**, no la que pide el
  joystick: contra un tronco el personaje no avanza y no tiene que correr en
  el lugar.
- **El alto, por los huesos** (`head_end` menos `LeftToeBase`), no con
  `Box3.setFromObject`: sobre una malla con esqueleto esa caja es la de la
  pose de reposo.
- Revisá el material: en el bosque el color venía enchufado también como
  **emisivo**, y el personaje brillaba en la sombra como un cartel.
- `frustumCulled = false` en la malla con esqueleto: si no, desaparece en
  algunos cuadros.

Si Rezona devuelve cada animación en un GLB distinto (con su copia de la malla
y la textura), quedate con una malla y pasale los otros clips, **reenganchados
a los huesos por nombre** y copiando los números de los accessors, no la
referencia (ver `bosque/herramientas/optimizar_modelos.mjs`).

---

## 5. Procesar lo que llega (la mitad del "se ve bien")

Lo crudo no entra al repo ni al juego. Scripts de referencia:
`bosque/herramientas/procesar_assets.py` y `optimizar_modelos.mjs`.

### 5.1 Texturas repetibles

Pedir "seamless" no alcanza: salen casi repetibles y **con un degradé de luz
de lado a lado**, que repetido cada 3 m dibuja una cuadrícula en el piso que
se ve desde lejos. En este orden:

1. **Aplanar la luz grande:** dividir por la versión muy borroneada
   (sigma = 12 % del lado) y multiplicar por la media, al 85 %.
2. **Cerrar la costura:** fundir las últimas columnas sobre las primeras
   (12 % del ancho, con rampa suavizada) y descartarlas; lo mismo en vertical.
3. **Normales desde la luminancia**, con diferencias por `np.roll` para que
   también se repitan. En corteza, musgo y hojarasca acierta casi siempre
   porque lo oscuro ES lo hondo.
4. Color a 1024 en webp calidad ~76; normales a 512 (a 480 líneas no se
   distingue más, y cada una de 1024 pesaba 400 KB).

```python
def cerrar_costura_x(img, banda):
    t = np.arange(banda, dtype=np.float32) / banda
    t = (t * t * (3 - 2 * t)).reshape(1, -1, 1)
    w = img.shape[1]
    fuera = img[:, : w - banda].copy()
    fuera[:, :banda] = img[:, :banda] * t + img[:, w - banda:] * (1 - t)
    return fuera
```

Comprobación que propone el kit de Rezona: desplazar la imagen medio lado en
cada eje y mirar la cruz del centro. Si se ve una línea, no repite.

### 5.2 Recortes con alfa

El recorte deja **halos blancos en los bordes semitransparentes**, que en la
sombra brillan como si tuvieran luz propia:

1. **Descontaminar:** a cada pixel semitransparente restarle el blanco del
   fondo, `c = (C - (1 - a)) / a`.
2. **Sangrar el color** hacia los pixeles transparentes (48 pasadas de
   promedio de vecinos llenos): el mipmap promedia vecinos, y si son blancos
   el halo vuelve a aparecer de lejos.
3. Recortar al contenido **con la base pegada al borde de abajo**: si queda
   margen, la planta flota a esa altura en todo el mundo.

### 5.3 El cielo

- **Horizonte a la mitad:** reacomodar las filas por tramos (arriba del
  horizonte de la foto → 90°..0°, abajo → 0°..-90°). Sin esto el sol pintado
  queda a otra altura que la luz que lo imita.
- **Subirlo unos 5°:** con el sol a 7,8° quedaba escondido detrás de la línea
  de árboles (28 m de árbol a 120 m tapan 13°). A ~12° asoma sobre las copas,
  que es de donde salen los rayos.
- **Cerrar la costura** (7 % del ancho) y **sin mipmaps en el cielo**: el
  `atan` salta en la costura y con mipmaps se ve una raya vertical de un pixel.
- **Medir el sol** (el pixel más brillante, suavizado) y guardar su dirección
  en un JSON: **la luz sale del sol pintado, no al revés**.
- **Medir el color de la bruma** justo debajo del horizonte, del lado del sol y
  del lado opuesto: esos son los dos colores de la niebla.

### 5.4 Una sola paleta

La receta del kit de Rezona: sacar 5 colores dominantes del arte principal y
usarlos para la niebla, las luces, el menú y los pedidos siguientes
(*"palette of #1a2233, #facc15, …"*). Así lo generado y lo dibujado con código
son del mismo mundo.

---

## 6. El motor: lo que da el look (three.js)

### 6.1 El orden de las pasadas

```
escena → target HalfFloat con profundidad (HDR)
      → rayos de sol a 1/4 de resolución (desde la profundidad)
      → revelado: tono AgX + rayos + letreros → target de 8 bits
      → final: VHS (o grano + viñeta) → lienzo
```

- **HDR (`HalfFloatType`)** si la placa puede (`EXT_color_buffer_float` o
  `_half_float`); si no, 8 bits y el ruido del post disimula los escalones.
- **`renderer.toneMapping = NoToneMapping`**: el tono lo pone tu última
  pasada. Three aplica tono y sRGB solo al dibujar en pantalla.
- **Revelar una vez.** El VHS lee cada pixel ~19 veces (los borrones); si cada
  lectura aplicara el tono, serían 19 veces ese cálculo.
- **Resolución interna baja, estirada por CSS.** Con VHS, 480 líneas del lado
  corto: la cuarta parte de los pixeles de un teléfono, y además es lo que tiene
  una cinta.
- **Resolución que se adapta:** si durante 2 s el cuadro pasa de 40 ms, bajar
  0,1 (mínimo 0,6); si sobra, subir.
- **El lienzo se cambia de tamaño al EMPEZAR el cuadro.** Cambiarlo lo borra;
  hecho después de dibujar, el navegador muestra un cuadro negro.
- **`await renderer.compileAsync(escena, cam)` durante la carga**, con cada
  malla instanciada vacía en `count = 1` para que también compile. Si no, el
  primer material que entra en pantalla traba el juego.
- **El `dt` nunca negativo:** la marca de `requestAnimationFrame` puede ser
  anterior al `performance.now()` que se tomó al armar.
  `dt = Math.max(0, Math.min(0.05, real))`.

Rayos de sol (a 1/4 de resolución): desde cada pixel hacia el sol en pantalla,
30 muestras de la profundidad; donde vale 1 es cielo (el cielo no escribe
profundidad) y se suma su brillo. Se apagan de a poco cuando el sol sale de
cuadro o queda detrás.

### 6.2 La luz, con números

| | valor | por qué |
|---|---|---|
| sol (direccional) | color (1, 0,74, 0,5), intensidad 4,6 | manda sobre todo |
| cielo (hemisférica) | (0,5, 0,58, 0,74) / suelo (0,16, 0,13, 0,08), 0,5 | relleno azul de la sombra |
| reflejo del panorama (`environmentIntensity`) | 0,26 | solo para que lo PBR tenga vida |
| sombra | mapa 2048, caja ±34 m que sigue al personaje, `bias -0.0006`, `normalBias 0.05` | una caja de todo el mapa es un borrón |
| niebla | `FogExp2` 0,003 + bruma baja 0,0075 que cae cada 9 m | ver 6.3 |

**La primera versión tenía el ambiente más fuerte que el sol sobre el suelo:**
salió plana y lechosa. Lo que da forma al atardecer es el contraste.

**La caja de sombra avanza de a un texel.** Si sigue al personaje de forma
continua, cada cuadro el mapa cae medio pixel corrido y todos los bordes de
sombra titilan al caminar.

`PCFSoftShadowMap` ya no existe en three r18x: pedirlo cae a PCF con un aviso.

### 6.3 La niebla que hace la mitad del trabajo

Se reemplazan los trozos `fog_*` de three por una niebla con **bruma baja**
(integrada a lo largo del rayo) y **color de sol**:

```glsl
vec3 nieblaDe(vec3 col, vec3 posVista) {
  float dist = length(posVista);
  vec3 dirV = posVista / max(dist, 1e-4);
  float dy = (uVistaMundo * dirV).y;            // dirección del rayo en el mundo
  float k = uNieblaCaida * dy;
  float integ = abs(k) > 1e-4 ? (1.0 - exp(-k * dist)) / k : dist;
  float baja = uNieblaAlta * exp(-uNieblaCaida * (uCamY - uNieblaBase)) * integ;
  float cantidad = 1.0 - exp(-(fogDensity * dist + baja));
  float sol = pow(max(dot(dirV, uSolVista), 0.0), 6.0);
  return mix(col, mix(fogColor, uNieblaSol, sol * 0.9), clamp(cantidad, 0.0, 1.0));
}
```

`uVistaMundo` = la parte de rotación de `cam.matrixWorld`; `uSolVista` = la
dirección del sol pasada a espacio de vista, una vez por cuadro. **El color de
la niebla es el de la bruma medida en el panorama**: si no coincide, el
horizonte se ve como la línea donde termina el mundo.

**Cómo parchear sin que se pisen los parches** (dos trampas que no dan error):

1. `onBeforeCompile` es **uno** por material: el segundo parche borra al
   primero. Hay que encadenar.
2. Three **reutiliza programas** entre materiales con el mismo texto de
   `onBeforeCompile`: dos parches armados por la misma función con distintos
   valores comparten shader. Cada parche necesita su clave.

```js
export function parchear(mat, clave, fn) {
  const previo = mat.onBeforeCompile, clavePrevia = mat.customProgramCacheKey.call(mat);
  mat.onBeforeCompile = (sh, r) => { previo.call(mat, sh, r); fn(sh, r); };
  mat.customProgramCacheKey = () => clavePrevia + "|" + clave;
  mat.needsUpdate = true;
  return mat;
}
```

Y **una sola vez por material**: si el mismo material (una laja usada dos
veces) pasa dos veces por la niebla, el segundo parche ya no encuentra lo que
el primero reemplazó. Marcalo en `mat.userData`. Tampoco declares el mismo
`uniform` en dos parches del mismo shader: es un error de compilación
(`redefinition`).

### 6.4 El terreno

- **Una sola rejilla para la malla y para la física**, interpolada **por
  triángulo** como la dibuja la tarjeta (`PlaneGeometry` corta cada cuadro por
  la diagonal que va de (i, j+1) a (i+1, j)). Con una función de altura aparte,
  el personaje flota en las lomas y se hunde en los pozos.
- El hash del ruido con **`Math.imul`**, nunca con `*`: los números de
  JavaScript redondean los bits bajos y el terreno sale plano sin dar error.
- Máscaras por vértice (sendero, musgo, pasto, sombra de copa) y roca por
  pendiente en el shader.
- **Mezcla por altura** entre texturas: gana la que "sobresale" en cada pixel.
  Un degradé parejo parece pintura aguada.
- **Contra la repetición:** la textura base mezclada con ella misma girada y a
  otra escala según un ruido grande, más variación de tono cada decenas de
  metros.
- Debajo de las copas el suelo más oscuro; la orilla mojada más oscura y más
  lisa (brilla).

### 6.5 La vegetación (lo que más cuesta que se vea bien)

**No generes árboles enteros en 3D.** Un imagen-a-3D devuelve la copa como un
bloque de arcilla pintado: a dos metros, en tercera persona, es un repollo. Lo
que funciona: **el esqueleto por código y las fotos en tarjetas.**

- Tronco que se afina, con el pie ensanchado, raíces marcadas y que **empieza
  0,6 m bajo el suelo** (en una loma, si no, un lado queda en el aire).
- Pisos de ramas cada ~1 m, 4-6 por piso, cayendo con el largo.
- **Tarjetas del tamaño de una ramita de verdad** (~0,35 + 0,3 × largo, con
  un tope de 1,35 m), encimadas a lo largo de la rama. Una sola tarjeta estirada a 5 m deja
  cada aguja del tamaño de un lápiz: parece de cartón.
- Una tarjeta cruzada más vertical en una de cada dos: da cuerpo de costado.
- **Normales hacia afuera del tronco, no las del plano.** Con las del plano
  cada tarjeta se prende o se apaga según cómo quedó y la copa parece un
  montón de papelitos.
- **Oscuridad interior por color de vértice:** las ramas de abajo y de adentro
  reciben menos luz.
- **Contraluz:** sumar color × sol × `pow(dot(-vista, sol), 5)` como luz
  propia, tapado por el color del vértice. Es lo que más dice "atardecer".
- **Viento en el shader de vértices, igual para tronco y copa.** Si solo se
  mueve la copa, las ramas se despegan del tronco en cada racha.
- **Alfa nítido en todos los mips** (si no, de lejos el follaje se desvanece
  hasta dejar el tronco pelado):

```glsl
vec2 dx = dFdx(vMapUv * 1024.0), dy = dFdy(vMapUv * 1024.0);
float mip = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy))));
diffuseColor.a *= 1.0 + mip * 0.28;
```

- **La copa arranca arriba de la cámara** (5-6,5 m) y ninguna rama baja de
  3,2 m; el follaje a menos de ~2 m de la cámara se descarta con un tramado.
  Si no, la cámara vive adentro de las copas.
- **Tres niveles de detalle:** cerca el completo (~2.600 triángulos), a media
  distancia la mitad de pisos con tarjetas más grandes (~500), lejos **dos
  planos con una foto del mismo árbol, sacada al arrancar** con una cámara
  ortográfica (4 triángulos). Que sea el mismo árbol evita que el bosque cambie
  de color en el radio del cambio.
- La foto de lejos se saca con **fondo verde y alfa cero**, no negro: el mipmap
  promedia el fondo y cada árbol lejano tendría contorno de carbón.
- Para que desde el mirador se vea algo, **un abanico sin árboles** hacia la
  vista.

### 6.6 Presupuesto y recorte

Lo medido en el bosque, calidad alta: **310 a 760 mil triángulos y 60-74
llamadas de dibujo por cuadro.**

- **Todo lo repetido, instanciado y recortado** por distancia y pantalla.
  En la primera versión las 209 rocas, troncos y tocones se dibujaban siempre,
  y dos veces por la sombra: 564 mil triángulos por pasada.
- **La esfera de recorte crece con la distancia** (`radio + d × 0.16`): la
  lista se rehace cuando la cámara giró 0,12 rad, y sin margen los árboles del
  borde aparecen de golpe al girar.
- **A menos de 30 m entra aunque no se vea:** su sombra sí puede verse.
- **El detalle completo solo hasta el borde de la caja de sombra (34 m).** Más
  allá se dibuja dos veces y su sombra cae afuera del mapa.
- La flora se siembra **en todo el mundo una vez** (con semilla) y se dibuja por
  celdas de 12 m cercanas. Sembrarla alrededor del personaje es más barato pero
  al volver a un lugar las plantas están en otro lado.
- **Semilla fija para todo lo que ocupa lugar.** Con `Math.random` el ítem que
  ayer estaba al lado de un árbol hoy está adentro de uno.

### 6.7 Agua sin dibujar la escena dos veces

Reflejo del mismo panorama + **oscurecer abajo del horizonte reflejado**:
mirando un lago desde la orilla, la franja de abajo siempre refleja la línea de
árboles de enfrente. Fresnel, dos capas de olas que viajan distinto, **olas
aplanadas con la distancia** (si no, el reflejo titila en manchones blancos),
un lóbulo de brillo angosto y fuerte hacia el sol, y el alfa subiendo con la
profundidad para ver el fondo en la orilla.

### 6.8 Personaje, cámara y controles

- Choque por **empuje** (círculos, cápsulas y cajas en el plano, tres pasadas
  para los rincones): contra un tronco se desliza en vez de quedar pegado.
- **Cámara por encima del hombro** (3,7 m, corrida 0,42 a la derecha), que:
  - se acerca **instantánea** ante un choque (terreno o tronco) y se aleja
    **lenta**;
  - vuelve sola detrás del personaje **1,5 s después del último arrastre**, más
    rápido cuanto más rápido va, pero no si camina hacia la cámara;
  - tiene el **campo fijo en horizontal** (78°): con el vertical fijo, en un
    teléfono parado se ve una rodaja del mundo;
  - tiembla un poco como una mano (respiración + golpe de cada paso), apenas.
- **Joystick donde cae el pulgar** en la mitad izquierda; a fondo corre (un
  botón de correr es un dedo que no hay). La mitad derecha gira la cámara.
  **Cada dedo por su `pointerId`**: si no, girar mientras se camina suelta el
  joystick.
- `setPointerCapture` puede tirar si el puntero ya se fue: dentro de un
  `try`, y **después** de anotar el toque.
- Si la pestaña pierde el foco con una tecla apretada, el `keyup` no llega:
  soltar todo en `blur`.
- **El menú tiene que entrar en 360 px de alto** (un teléfono acostado). En el
  bosque el botón de empezar quedaba debajo del borde y no había forma de
  jugar.

### 6.9 Lo que llena el aire

- **Polvo:** ~420 puntos en un cubo que viaja con la cámara (módulo en el
  shader), casi invisibles de espaldas al sol y brillantes de frente. De
  espaldas, un punto blanco fijo parece nieve o un pixel muerto.
- **Fuego:** llamas de ruido que sube recortado con forma de gota y rampa de
  temperatura, con valores **por encima de 1** (satura como una cámara), más
  chispas, humo **oscuro** (un gris "de humo" en HDR brilla como algodón) y una
  luz puntual que tiembla, sin sombra.

### 6.10 Un post-proceso con identidad: el VHS

No es un filtro de color. Se pasa a YIQ y cada parte se degrada con su ancho
de banda:

- luminancia con ~330 puntos por línea (5 muestras); **color con ~45**, y
  corrido a la derecha (el color llega tarde);
- el **halo del afilado**: `y += (y - yLejos) * 0.55`;
- temblor de cada línea, la **franja de tracking** que sube, el **cabezal roto**
  en el 3 % de abajo, pérdidas blancas raras, grano;
- la **fecha estampada adentro de la imagen** (un canvas mezclado en el
  revelado, antes del VHS): viaja con la señal y se degrada con ella. Un texto
  HTML nítido encima de un video borroso se ve pegado.

Sirve también de mecánica: en el bosque, cerca de un ítem sin recoger la
imagen falla más y la estática sube. Es el radar.

---

## 7. El sonido

**Con Rezona** (reglas del kit de juegos de Rezona):

- **Música:** `kind: "music"`, 30-60 s, el pedido termina en *"seamless loop,
  consistent energy, no fade out"*. **No se compone música en código:** el
  agente no la oye, y la música armada nota por nota sale sin armonía.
- **Efectos:** `kind: "sound"`, hasta 2 s, describiendo material + acción
  (*"short metallic coin pickup, bright"* y no *"ding"*).
- **Ambiente** (viento, pájaros, agua): un `kind: "sound"` largo, que se pueda
  repetir sin corte.
- Un efecto por cada acción del juego; variá el tono de los que se repiten
  (±10 %) para que no cansen.

En `perro/` los efectos y la música de Rezona fallaron durante dos horas de
intentos (los pedidos se aceptaban y fallaban después) mientras la voz
(`kind: "speech"`) sí andaba. Por eso
**el cargador busca cada sonido por nombre y, si no está, sintetiza uno**: lo
generado pisa a lo sintetizado sin tocar código.

Lo que sí va sintetizado, porque lo da el cuadro: los pasos (distintos en el
sendero, en la hojarasca y en el agua, en la fase del pie de la animación), el
clic de la interfaz, la estática de la cercanía.

**Distancia:** una reverberación armada al arrancar (ruido que se apaga en
~2,6 s) para todo lo lejano, y el paneo según dónde está cada fuente. El audio
arranca recién después de un toque: los navegadores no dejan sonar nada antes.

---

## 8. Plan B: si Rezona no genera

Pasa (sección 1). No se simula ni se esconde. Se hace y se dice:

- **Terreno, árboles, pasto y cielo con código:** el terreno ya es ruido; las
  tarjetas de follaje se pueden dibujar en un canvas (agujas con trazos,
  hojas con elipses); el cielo, un degradé con el sol en HDR.
- **Sonido sintetizado** entero.
- **El look lo siguen dando las secciones 0, 6.1, 6.2, 6.3 y 6.10**, que no
  necesitan ni un asset. Se ve menos fotográfico, pero se ve intencional.
- El código queda preparado: **cada asset se busca por nombre y tiene su
  reemplazo por código**. Cuando Rezona vuelva, se genera, se copia y no se
  toca una línea.

---

## 9. Probar y medir

**Regla del repo: "anda" sin un número al lado no vale.**

- **Chromium de Playwright con SwiftShader**, sin placa de video:
  `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader
  --ignore-gpu-blocklist`. **Nunca `npx playwright install`**: usar
  `executablePath: '/opt/pw-browsers/chromium'`.
- **Dibuja por procesador: ~1,5 s por cuadro.** Los cuadros por segundo de
  acá no dicen nada de un teléfono y **no se informan como si dijeran**. Lo que
  sí vale: errores, triángulos, llamadas de dibujo, capturas.
- **Esperar tiempo de juego, no de reloj.** "Esperar 1,5 s" es esperar un
  cuadro. Exponé el reloj del juego (`window.__juego.t`) y esperá a que avance.
- Un parámetro (`?fijo`) que apague la resolución que se adapta: en ese
  navegador baja al mínimo a los 2 s.
- **`renderer.info.autoReset = false`** y reset a mano al empezar el cuadro:
  si no, `info` cuenta solo la última pasada (el triángulo del post) y dice
  "1 triángulo".
- **Capturas desde lugares fijos** (teletransportando al personaje), en una
  hoja de contactos, y mirarlas. Casi todos los bugs de este juego se vieron
  en una captura y en ningún número.
- **Probar la partida de punta a punta**: acercarse a cada ítem, que aparezca
  el botón, recogerlo, que salga su texto, que llegue el final.
- **Teléfono parado** (`devices["Pixel 7"]`): que el menú entre, que el
  joystick mueva y que un segundo dedo gire la cámara **sin soltar el
  joystick** (con `Input.dispatchTouchEvent` por CDP, dos toques a la vez).
- **Un resultado raro suele ser la prueba y no el código.** En el bosque, "la
  cinta 2 dice lo de la cinta 1" era la prueba leyendo el cartel anterior.

Si trabajás adentro del espacio de Rezona Lab, además corré sus puertas:
`validate_workspace.py`, `build_game.py` y `smoke_dist.py` (del kit).

---

## 10. Entregar

**En Rezona** (gratis):

- La carpeta que se sube necesita `.rezona/` y `dist/index.html`, con todo lo
  demás en rutas **relativas**.
- **Los assets en `dist/datos/` y no en `dist/assets/`: Rezona saltea la
  carpeta `assets/` al subir, sin avisar.** El juego subía, abría y se quedaba
  cargando para siempre.
- `upload_project { dir, project_id }` → `play_url`
  (`https://rezona.ai/game/pgcserver/play/<id>`, que redirige a
  `/pv/<id>/v<n>/dist/index.html`). Comprobá con `curl` que el código y un par
  de texturas contesten 200.
- **`publish_to_rezona_app` solo si la persona lo pide:** es irreversible y ata
  la cuenta para siempre.

**En un solo HTML** (para mandar por mensaje o abrir con doble clic):

- Cada textura y cada modelo como `data:` URI en `window.ARCHIVOS`, y el
  cargador busca ahí primero. El base64 engorda un tercio: en el bosque,
  8,6 MB de datos se vuelven 11,4 MB y el archivo entero pesa 12,1 MB.
- **Sin `fetch`.** Desde `file://`, o en una página con política de seguridad,
  un `fetch` a `data:` o `blob:` se bloquea en silencio:
  - los GLB se decodifican a mano (`atob` → `Uint8Array`) y van a
    `loader.parse(buffer, "", ok, error)`;
  - las texturas de adentro de cada GLB se leen como `<img>`, cambiando el
    cargador del parser desde un plugin (el `ImageBitmapLoader` de three hace
    `fetch`):

```js
gltfLoader.register((parser) => {
  parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
  return { name: "texturas_como_imagen" };
});
```

  Sin esto el personaje salía sin textura y sin ningún error.
- Escapar `</script` dentro del código embebido.
- Probarlo abriéndolo con `file://`: que cargue, que no haga **ningún** pedido
  afuera (`page.on("request")`) y que no tire errores.

Ojo: el espacio de trabajo propio de Rezona Lab sirve el `dist/` de Vite y su
contrato pide **no** convertir el proyecto en un solo archivo. El HTML único es
para entregar, no para subir ahí.

---

## 11. Trampas ya pagadas

| lo que se ve | la causa | el arreglo |
|---|---|---|
| la partida arranca con pantalla azul | el primer `dt` negativo prendía el efecto de "sin señal" | `dt = max(0, …)` |
| cuadros negros de a ratos | el lienzo cambiaba de tamaño después de dibujar | cambiarlo al empezar el cuadro |
| un objeto no aparece nunca | geometría cuantizada recortada al hornear la escala | pasar a coma flotante antes |
| 1,6 millones de triángulos | objetos repetidos dibujados siempre y dos veces | instanciar y recortar por distancia y pantalla |
| todo plano y lechoso | el ambiente le ganaba al sol | sol 4,6, ambiente 0,5, reflejo 0,26 |
| el pasto se ve blanco | la foto es paja con espigas; al sol, papel | teñirlo hacia el verde (`color: 0x8c9d5e`) |
| la cámara vive dentro de los árboles | ramas a la altura de los ojos | copa arriba de 5 m, ramas no bajo 3,2 m, tramado cerca |
| el follaje desaparece de lejos | el alfa se promedia en los mips | escalar el alfa por nivel de mip |
| halos blancos en las hojas | recorte con el fondo mezclado en el borde | descontaminar + sangrar |
| árboles lejanos con contorno negro | foto de lejos con fondo negro | fondo verde con alfa cero |
| raya vertical en el cielo | mipmaps + salto del `atan` en la costura | cielo sin mipmaps |
| el sol nunca se ve | a 7,8° queda detrás de los árboles | subir el panorama ~5° |
| las sombras titilan al caminar | la caja de sombra se mueve de a medio pixel | avanzar de a un texel |
| el viento o la niebla "no andan" | dos `onBeforeCompile` pisándose / programa compartido | encadenar con clave (`parchear`) |
| shader que no compila: `redefinition` | el mismo `uniform` declarado en dos parches | nombres distintos, mismo valor |
| la primera vez que aparece algo, se traba | el shader se compila en ese momento | `compileAsync` en la carga |
| texturas lavadas o suelo iluminado de costado | color sin sRGB / normales marcadas como sRGB | color `SRGBColorSpace`, normales `NoColorSpace` |
| el personaje brilla en la sombra | textura de color enchufada como emisiva | sacar la emisión |
| el personaje desaparece en algunos cuadros | recorte por la caja de reposo del esqueleto | `frustumCulled = false` |
| los pies patinan | la animación va a otra velocidad que el avance | `timeScale` desde zancada y ciclo |
| piernas juntas al pasar de caminar a correr | clips mezclados en fases distintas | sincronizar las fases |
| el menú no entra en el teléfono acostado | 360 px de alto | `@media (max-height: 460px)` compacto |
| el HTML único sale sin texturas | `fetch` bloqueado a `data:`/`blob:` | GLB a mano + texturas como `<img>` |
| el juego subido a Rezona no carga | Rezona saltea `assets/` | la carpeta se llama `datos/` |

---

## 12. Antes de decir "listo"

- [ ] Una imagen de prueba generó bien antes de la tanda (o se pasó al plan B
      y se dijo).
- [ ] Frase de estilo idéntica al final de cada pedido; paleta sacada del arte
      principal y usada en niebla, luces y menú.
- [ ] Texturas sin costura (desplazadas medio lado), recortes sin halo, cielo
      con horizonte en la mitad y sol medido.
- [ ] Modelos simplificados, texturas a 1024 webp, sin geometría recortada;
      tamaños reales en metros.
- [ ] Animaciones medidas (en el lugar, ciclo, zancada) y fases sincronizadas.
- [ ] HDR + AgX, sol que manda, niebla del color del horizonte, sombra que
      sigue de a un texel.
- [ ] Triángulos y llamadas por cuadro medidos con `renderer.info` sumando todas
      las pasadas; nada dibujado que esté detrás o en la niebla.
- [ ] Shaders compilados en la carga; `dt` nunca negativo; el lienzo se cambia
      al empezar el cuadro.
- [ ] Partida probada de punta a punta; teléfono parado y acostado probados;
      cero errores en la consola.
- [ ] Capturas desde lugares fijos, miradas una por una.
- [ ] Lo que no se pudo medir (los cuadros por segundo en un teléfono) está
      dicho con esas palabras.
- [ ] Subido con `upload_project` y el `play_url` comprobado con `curl`; el
      HTML único probado con `file://`.

---

El ejemplo completo, con todo esto funcionando, está en `bosque/`: el código
en `bosque/js/`, el procesado de assets en `bosque/herramientas/` y las
pruebas en `bosque/pruebas/`.

# Torre — de Blender al navegador

Un edificio de oficinas armado por script en Blender, con materiales PBR de
verdad y cielo HDRI, y un visor de three.js que lo muestra en el navegador con
oclusión ambiental, floración, sombras suaves y mapeo de tonos ACES.

| | |
|---|---|
| Altura | 111,6 m (podio + 21 pisos + mástil) |
| Geometría | 1.306 caras · **2.636 triángulos** |
| Materiales | 12 · 18 texturas (color, normal y metal-rugosidad) |
| `torre.glb` | **3,6 MB** con las texturas adentro |
| `cielo.hdr` | 622 KB (2K bajado a 1K) |
| Render de Cycles | 1200x1560, 200 muestras, ~5 min en 4 núcleos |

## Las piezas

- **`preparar-texturas.py`** — deja cada material en los tres mapas que entiende
  glTF: `col` (color con el AO multiplicado adentro), `nrm` (normal en convención
  OpenGL) y `mr` (un solo JPG con la rugosidad en el verde y el metal en el
  azul, que es exactamente el `metallicRoughnessTexture` del formato). Sale de
  las librerías que ya estaban en el repo: Concrete044D, Metal053C, Metal062C,
  Bricks076A, Road008A y OfficeCeiling002 de AmbientCG, StoneBricksSplitface001,
  y el cielo HdrSkyMorning004.
- **`torre.py`** — arma la escena, la renderiza con Cycles y exporta el `.glb`.
- **`visor/index.html`** — el visor. Sin dependencias externas: three.js 0.160
  y sus complementos están en `visor/vendor/`, resueltos con un *import map*,
  así que no hay que reescribir ningún `from 'three'`.

```sh
python3 preparar-texturas.py                       # las texturas para la web
blender --background --python torre.py             # arma, renderiza y exporta
python3 -m http.server -d visor 8095               # y se abre el visor
```

## Lo que costó descubrir

1. **`SSAOPass` no dibuja la escena.** En three 0.160 su modo `Default` toma el
   `readBuffer` y le multiplica la oclusión encima; si es el primer pase de la
   cadena ese buffer está vacío y **sale todo negro, sin un solo error en
   consola**. Necesita un `RenderPass` adelante. (Versiones viejas sí
   renderizaban solas, de ahí la confusión.)
2. **`minDistance` y `maxDistance` del SSAO son fracciones del rango
   `near`–`far`, no metros.** Con una cámara de 3 a 6000, 0,0004 y 0,012 son
   unos 2,4 m y 72 m.
3. **`Scene.environmentIntensity` recién existe desde r163.** En 0.160 la
   propiedad se puede escribir y no hace nada: subir y bajar el sol casi no se
   notaba porque la luz de ambiente seguía a tope. La perilla acá es
   `material.envMapIntensity`, material por material.
4. **El exportador de glTF de Blender 4.x sólo reconoce `ShaderNodeMix`**, no el
   viejo `ShaderNodeMixRGB`, para sacar el `baseColorFactor` de una textura
   multiplicada por un color. Con el nodo viejo el tinte se pierde en silencio y
   todo sale blanco.
5. **glTF no tiene fuerza de emisión** sin la extensión
   `KHR_materials_emissive_strength`: una emisión de 1,5 en Blender llega al
   `.glb` recortada a 1 y los pisos iluminados salen quemados.
6. **La franja negra del horizonte** no era el tamaño del piso sino el plano
   lejano de la cámara: con `far` en 900 el suelo se cortaba 2,9° por debajo del
   horizonte y por ahí asomaba el fondo del HDRI, que es casi negro. Se estira
   el `far` y se pone la niebla bastante antes.
7. **205 objetos son 205 llamadas de dibujo.** Antes de exportar se juntan por
   material y quedan 12. El `.blend` se guarda antes de juntar, así la escena
   editable no se toca.

## Rendimiento

Medido en el Neko, **sin GPU**, con Mesa llvmpipe por software:

| | |
|---|---|
| 1280x720, calidad media (con oclusión) | 4 fps |
| 1920x1080, calidad media | 2 fps |
| 1280x720, calidad baja (sin oclusión) | 8 fps |

Son los números de un rasterizador por software: 2.636 triángulos no son nada,
lo que cuesta es el relleno de píxeles de los pases de post. En cualquier
máquina con GPU esto va a 60 cuadros sin despeinarse. El visor trae tres niveles
de calidad justamente por eso: en *Baja* se saltea la oclusión, que es de lejos
el pase más caro.

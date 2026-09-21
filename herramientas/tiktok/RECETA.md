# RECETA — números medidos sobre 22 edits de TikTok

> Salida del §4 del playbook. Los videos se bajaron **para medir**, no para
> republicar: lo que queda acá son números, no clips.
> Reproducir: `python3 medir.py corpus/*.mp4` → `datos/_corpus.json`

---

## Lo primero: son dos formatos distintos, no uno

El corpus se parte solo en el ritmo de corte, y mezclarlos da medianas sin
sentido. El umbral está en **0,40 cortes/segundo**.

| | EDITS (n=5) | TUTORIALES (n=17) |
|---|---|---|
| cortes / segundo | **0,86** (0,41 – 1,43) | 0,09 (0,00 – 0,37) |
| plano mediano | **0,55 s** | 6,79 s |
| cortes sobre beat | 0,20 | 0,11 |
| saturación | **0,51** | 0,16 |
| clipping | 1,67 % | 0,45 % |
| nitidez | 758 | 873 |
| luminancia p5 / mediana / p95 | 49 / 113 / 205 | 14 / 61 / 176 |

Un edit corta **diez veces más seguido** que un tutorial y vive con los negros
levantados (p5 = 49 contra 14): no aplasta, **abre** la sombra y sube el medio.
Eso es lo contrario de lo que uno supone.

---

## Tu edit contra la mediana del nicho

| | tuyo | mediana edits | veredicto |
|---|---|---|---|
| cortes / segundo | 1,43 | 0,86 | el más rápido del corpus |
| **cortes sobre beat** | **0,42** | 0,20 | **el mejor del corpus** |
| saturación | 0,71 | 0,51 | +39 % |
| **clipping** | **7,77 %** | 1,67 % | **8× el objetivo** |
| nitidez | 758 | 758 | clavado en la mediana |

**Lo que hacés bien, y es lo difícil:** el 42 % de tus cortes cae sobre el
pulso. Nadie en el corpus llega a eso. El oído lo tenés.

**Lo que te está costando calidad:** 7,77 % de los píxeles están en blanco
puro. Ese detalle no se recupera con nada — está borrado en el archivo. El
objetivo del playbook es < 1 %, y la mediana del nicho es 1,67 %.

La saturación acompaña el problema: 0,71 contra 0,51. Subir saturación empuja
canales contra el techo y **fabrica** clipping.

---

## La receta, para aplicar

**Ritmo**
- Cortar a **0,6 – 0,9 cortes/segundo** (plano de 1,1 a 1,7 s).
- 1,43 funciona si el tema lo pide, pero a esa velocidad no se lee nada que no
  sea un primer plano.
- Apuntar a **más del 40 % de cortes sobre beat** — ya lo lográs, no lo pierdas.
- BPM del corpus: mediana 88, rango 75 – 195.

**Color** — el arreglo que más te cambia el resultado
- Clipping objetivo **< 1 %**. Medir SIEMPRE antes de publicar.
- Saturación **0,45 – 0,55**. Arriba de 0,6 empieza a quemar.
- Perfil: p5 ≈ 49, mediana ≈ 113, p95 ≈ 205. Negros **abiertos**, no aplastados.
- El p95 en 205 y no en 255 es la clave: los pros **dejan techo libre**.

**Nitidez**
- Varianza del laplaciano ≈ 760 – 960 con material de TikTok recomprimido.
- `unsharp=5:5:0.8` alcanza. Más marca los bloques del códec.

---

## Cómo no quemar el blanco

El clipping se fabrica en tres lugares:

1. **Saturación alta** sobre material ya contrastado.
2. **Destellos** con opacidad cerca de 1 sostenidos varios cuadros.
3. **Grades apilados** — contraste + curva + eq, cada uno empujando arriba.

La cuenta que conviene: bajar el punto blanco a ~235 antes de cualquier otra
cosa deja margen para todo lo que venga después.

```
eq=contrast=1.08:saturation=1.10, curves=preset=lighter  →  medir  →  ajustar
```

---

## Lo que falta del playbook

- **Corpus de 22, no de 100+.** El cuello es juntar links: el buscador devuelve
  páginas de categoría, no URLs sueltas, y la grilla de TikTok se arma con
  llamadas firmadas del lado del navegador. El navegador de la sesión no las
  puede hacer porque no confía en la CA del proxy.
  Con la lista en `corpus.txt`, `bajar_lote.py` + `medir.py` procesan cualquier
  cantidad sin tocar una línea.
- **Los 17 tutoriales sesgan el corpus.** Las consultas que dan volumen traen
  videos que *explican* edición, no videos *editados*. Las medianas de EDITS
  salen de 5 videos: sirven de orientación, no de ley.
- **Catálogo de transiciones (§3d)** sin hacer: detectar shake, RGB split o
  glass shatter automáticamente es otro medidor, no sale de estos números.

---

# Lo que se aprendió montando el edit de Patrick Jane (2026-09-21)

Todo lo de acá está medido contra un edit real: 20,667 s, 1080x1920, 15 cortes,
material crudo de `@catsconcept/7665423020801985822` (92 s de escenas de la
serie, sin texto ni efectos).

## La lección que vale por todas: medir Y MIRAR

El grade se armó con `curves`, mapeando los percentiles medidos del material
(p5 2,2 / mediana 38,7 / p95 106,0) a los de la RECETA (49 / 113 / 205). La
imagen salió **psicodélica**: magenta y verde flúor por todos lados.

Llevarle 0,0086 a 0,1922 le da al primer tramo una pendiente de 22. La spline
de `curves` se dispara arriba de 1 entre los puntos de control, el canal
desborda y **da la vuelta**.

Lo grave no es el error, es que **los números decían que estaba bien**:

| métrica | decía | por qué mentía |
|---|---|---|
| clipping 0,49 % | "en objetivo (<1 %)" | un píxel que da la vuelta cae a media escala, no a 255: no cuenta como clipping |
| nitidez 1089 | "por encima del objetivo" | el ruido del desborde dispara la varianza del laplaciano |
| saturación 0,475 | "en objetivo" | los colores flúor son saturación, técnicamente |

Tres tandas de calibración —24 combinaciones medidas— corrieron sobre una
imagen rota sin que un solo número lo delatara. **Ningún número reemplaza
abrir un fotograma.** El primer render de cualquier grade se mira.

Dato lateral que también lo delataba: el archivo pesaba 31 MB; con el grade
sano, el mismo edit pesa 10 MB. El ruido no comprime.

## Y tampoco alcanza con modelar: hay que medir la salida

Segundo intento: modelar `eq` y despejar los parámetros. Predecía p5=46 y se
medía 77. Dos motivos, los dos valen para cualquier ajuste futuro:

1. **`eq` aplica contraste → brillo → gamma**, en ese orden (`vf_eq.c`), no
   gamma primero.
2. Los percentiles del medidor son el **promedio de los percentiles de cada
   cuadro**. Una transformación no lineal aplicada cuadro a cuadro y después
   promediada no da lo mismo que aplicarla al promedio. Con planos que van de
   un interior oscuro a un exterior a pleno sol, la diferencia fue de 30
   niveles.

Lo que quedó: `buscar_grade.py`, búsqueda en grilla **midiendo la salida**.
`eq` es monótona y satura sin dar la vuelta, así que no puede romper la imagen.

Resultado: `eq=gamma=2.3:contrast=1.3:brightness=0.09:saturation=1.6` +
`unsharp=5:5:1.4` → p5 **49,0** / mediana 125 / p95 197 / clipping 0,67 %.

## Saturación y negros abiertos no se pueden tener juntos acá

El medidor calcula saturación como `(max-min)/max`. Abrir el negro de 2 a 49
sube el `min` de todos los píxeles, así que **baja la saturación por
definición**. En este material se llega a 0,20, no a los 0,45-0,55 de la
RECETA, y no es un error de grade: son dos objetivos que se pelean. Se elige
el negro abierto, que es lo que la RECETA marca como la diferencia entre un
edit y un tutorial.

## Trampas de ffmpeg que costaron una corrida cada una

- **Nunca un filtro `fps` DETRÁS de `zoompan`.** zoompan sella su propio fps y
  el filtro de atrás duplica cuadros sin freno: un plano de 1,333 s salió de
  **11 min 24 s**. El encuadre final se fija con `-r` a la salida.
- **`minterpolate` pierde ~3 cuadros al final** (no puede interpolar más allá
  del último cuadro de entrada), y los planos cortos redondean para arriba.
  Entre las dos cosas se acumularon 0,366 s en 16 planos y los cortes sobre
  beat cayeron de 1,00 a **0,06**. Solución: **mandar el conteo de cuadros**
  (`-frames:v`), no la duración, y darle material de sobra a minterpolate.
- **Este ffmpeg (imageio_ffmpeg 7.0.2) no trae `drawtext`** — sin libfreetype.
  Cualquier texto se arma con Pillow y se superpone como imagen.
- **`vibrance` topa en 2.0**; más arriba aborta con "Numerical result out of range".
- **`setsar=1` al final o el video sale con píxeles no cuadrados.** Recortar
  404 de 960 y escalar a 1080x1920 deja SAR 404:405 y DAR 101:180 en vez de
  9:16: el reproductor lo enmarca mal.

## El medidor tiene dos sesgos, y hay que saberlos

- **`cortes_sobre_beat` re-deduce el tempo por autocorrelación.** Sobre una
  pista de 90 BPM exactos le dio 89,4. Ese error de 0,6 BPM acumula 200 ms a
  los 20 s, así que marca fuera de pulso cortes que están a 0,0 ms. Si conocés
  el BPM real, medí contra él.
- **El umbral de corte 0,35 subdetecta en material con grade natural.** Dos
  planos del mismo actor en la misma sala no llegan a 0,35. Medido sobre este
  edit, que tiene 15 cortes de guion:

  | umbral | cortes que ve | cortes/s |
  |---|---|---|
  | 0,35 (por defecto) | 8 | 0,39 |
  | 0,25 | **15** | **0,73** |
  | 0,20 | 18 (3 falsos) | 0,87 |

  El 0,35 está bien para medir edits ajenos con color quemado; para medir los
  propios, 0,25.

## Recorte 9:16 desde 4:3: no recortes por el centro

El material bueno suele ser 4:3 (960x720). El 9:16 se lleva **404 px de 960**:
se tira el 58 % del ancho. Recortar por el centro le come la cara al actor en
la mitad de los planos. `encuadre.py` mide, plano por plano, el centroide
horizontal de los píxeles con tono de piel (o de la energía de bordes, si el
plano es en blanco y negro). Medido acá: los centros iban de 0,42 a 0,68.

Y una consecuencia que no se arregla con nitidez: 404 px estirados a 1080 son
404 px de detalle real. La nitidez medida queda en ~90 contra los 760-960 de
la RECETA, y subir el `unsharp` sólo agrega halos. **La nitidez se gana
eligiendo la fuente, no en el grade.**

## Elegir material: medir el ritmo no alcanza

El umbral de 0,40 cortes/s separa edits de material crudo, y funciona: de 4
candidatos descartó al toque uno de 1,08 cortes/s (un edit ajeno). Pero dejó
pasar uno de 0,14 cortes/s que tenía **subtítulos quemados** y barras negras.
El ritmo no ve el texto. Una hoja de contactos (`fps=1/8,tile=4x2`) lo resuelve
en un vistazo.

## Bajar: `calidad.py` antes que `bajar.py`

`bajar.py` (ssstik) devuelve una sola versión. `calidad.py` lee el JSON de
`__UNIVERSAL_DATA_FOR_REHYDRATION__` de la página y elige la variante de
bitrate más alto. Ojo con la conclusión fácil: que salga poca resolución no
siempre es culpa del bajador. Medido sobre `@tekno_edit_/7656541594300222727`,
la mejor variante que ofrece TikTok es 720x720 a 350 kb/s porque el video se
subió en 576x576.

Las grillas (búsqueda, hashtag, cuenta, `discover/`) **no traen los IDs en el
HTML**: se arman con llamadas firmadas del navegador. La página de un video
suelto sí responde entera a `requests`. Juntar links sigue siendo el cuello.

## La música

El proveedor de audio de Rezona falló 3 veces seguidas
(`PROVIDER_UNAVAILABLE`, reintentable). `pista.py` sintetiza una cama a BPM
exacto con numpy — y tiene una ventaja sobre la generada: al conocer el BPM,
los cortes caen en el pulso por construcción, no por suerte. Para publicar se
reemplaza por una pista de la biblioteca de TikTok.

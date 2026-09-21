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

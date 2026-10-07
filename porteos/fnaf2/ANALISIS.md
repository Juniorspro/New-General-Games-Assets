# FNaF 2 — análisis del port hecho en otra sesión

Archivo analizado: `fnaf2-1.html`, 20.777.571 bytes, un solo HTML. El juego no
está en este repo (es de Scott Cawthon y el repo es público). Acá queda lo que
se aprendió y el arreglo, que se aplica a la copia del dueño con `corregir.py`.

## Qué es

**Un intérprete de eventos de Clickteam Fusion en JavaScript** que corre los
datos originales del juego, no una reimplementación. Es el camino más fiel
posible: la lógica es la de Scott, evento por evento.

| pieza | qué tiene |
|---|---|
| `datos/juego.json` (510 KB) | 27 pantallas, 1.301 eventos, 452 objetos, sacados del juego original ("versión subida por SuperMiGamer003", según sus créditos) |
| imágenes | 804 WebP, 8,4 MB |
| sonido | 66 OGG, 6,3 MB |
| intérprete | ~33 KB minificado: eventos, expresiones, animaciones, movimientos (trayectoria, rebote, 8 direcciones), capas con paralaje, panorama de la oficina, contadores, textos, sonido por canales, INI en `localStorage` |
| empaquetado | todo en base64 dentro del HTML (`window.__EMBEBIDOS`), con blob URLs al arrancar |

## Cobertura, medida

Se cruzó todo lo que usa el juego contra lo que el intérprete implementa:

- **condiciones**: 2.981 usadas → **100 %** implementadas;
- **expresiones**: 3.866 tokens → **100 %**;
- **acciones**: 2.562 usadas → **todas menos una**. La que falta es la acción
  19 de un objeto activo, "forzar velocidad de animación", usada una vez en
  la pantalla `next day`: esa animación corre a su velocidad normal.

Que esté implementado no prueba que esté bien hecho. Lo que se midió jugando
está abajo.

## Lo que se midió (Chromium como teléfono, 844×390, toques reales por CDP)

| | resultado |
|---|---|
| arranque | 5,4–5,7 s hasta poder jugar (la intro de 4,3 s tapa la decodificación) |
| errores en consola | ninguno |
| título → noche 1 tocando "New Game" | 7 s |
| paneo de la oficina | arrastrar a un costado la mueve hasta el borde; al soltar se queda (bien) |
| linterna | dedo apoyado en una zona libre = CTRL apretado; al soltar se apaga (bien) |
| dibujar un cuadro de la oficina | 0,8 ms (con render por CPU) |
| heap de JS | 52 MB al cargar, 24 MB en la oficina |
| **reloj de la noche** | **2,13–2,17× más rápido**: hora de 33 s en vez de 70, noche de 3,3 min en vez de 7 |

## El problema grande: el reloj, y por qué

`juego.json` dice `"fps": 27`. El intérprete da **60 pasos por segundo**
(bucle fijo de 1000/60 ms), pero cada paso le suma al reloj del juego
`1000 / fps` = 37 ms. Resultado: 60 × 37 = 2.222 ms de juego por segundo real.
Afecta a todo lo que usa temporizadores, que en FNaF 2 es casi todo:

- el reloj de la noche: el evento #482 de la oficina suma un "segundo" cada
  1000 ms y cambia la hora a los 70;
- las oportunidades de movimiento de los animatrónicos (eventos "cada 1000 ms");
- los fundidos, las llamadas y la música.

O sea, el juego es más difícil y más corto que el original.

**La causa:** FNaF 2 tiene **exactamente 27 pantallas**. En la cabecera de
Clickteam, el campo "cantidad de pantallas" está justo antes de "cuadros por
segundo": el extractor leyó un campo antes de tiempo. FNaF 4, misma herramienta
y mismo autor, leído en el lugar correcto, dice 60.

**El arreglo** cambia un número: `fps` a 60 adentro de `juego.json`.
`corregir.py` lo hace sin tocar nada más. **Medido después del arreglo: reloj a
1,00×, hora de 70 s y noche de 7,0 minutos**, sin errores.

```bash
python3 porteos/fnaf2/corregir.py fnaf2-1.html fnaf2-corregido.html
```

## Otras cosas, de menor a mayor

- **Texto de PC en el teléfono:** la oficina dice "Press & hold CTRL to use
  flashlight". En el celular la linterna es dejar el dedo apoyado. El port
  trae la traducción "LINTERNA" pero no la usa.
- **Falta la acción 19** (ver Cobertura): cosmético, una sola animación.
- **Le falta lo de "juego de celular"** que pide `PORTEO.md` §5-6:
  - no pide pantalla completa;
  - no mantiene la pantalla prendida (Wake Lock);
  - el botón atrás no pausa;
  - no tiene PWA ni service worker;
  - en vertical rota toda la interfaz 90° con CSS en vez de pedir que se
    gire el teléfono. Funciona, pero las barras del sistema quedan de costado.

  Se arregla con `herramientas/porteo/web.js` sin tocar el juego.
- **Memoria (riesgo, no medido en un teléfono):** si se decodificaran las 804
  imágenes serían **1.058 MB de píxeles**. El intérprete guarda en un `Map`
  cada imagen que carga y nunca la suelta, y al entrar a una pantalla precarga
  todas las de sus objetos. Chrome puede descartar mapas de bits decodificados,
  pero en un teléfono de 2-3 GB la oficina (cámaras + animatrónicos) podría
  cerrar la pestaña. Habría que soltar las imágenes de la pantalla anterior al
  cambiar.
- **Arranque en teléfonos lentos:** decodifica los 871 archivos con
  `Uint8Array.from(atob(b), fn)` (un callback por byte, ~15 millones). En
  escritorio queda tapado por la intro; en un teléfono flojo puede sumar
  varios segundos. Un bucle `for` con `charCodeAt` es varias veces más rápido.
- **Colisiones por caja:** el intérprete compara rectángulos, y Clickteam usa
  máscaras de píxeles salvo que se le diga lo contrario. FNaF 2 usa colisiones
  entre animatrónicos y marcadores invisibles; si alguna forma no es
  rectangular, un evento podría dispararse donde el original no. No se
  encontró un caso, pero no se probó cada uno.
- **4:3 con franjas negras** en un teléfono 19,5:9. Es fiel al original.

## Veredicto

El enfoque es el correcto y la cobertura es completa. Con el reloj arreglado
queda un port muy fiel. Lo que lo separa de "terminado" según `PORTEO.md` es
lo de §5-6 (pantalla completa, atrás, pantalla prendida, PWA) y probarlo en un
teléfono real para ver la memoria.

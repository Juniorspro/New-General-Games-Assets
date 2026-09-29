# Hacer un juego: cómo encararlo
Lo que junta las tres guías de `guias/` y lo que se ve en los juegos de este repo. Ver también: [juegos-2d-pixel](juegos-2d-pixel.md), [juegos-3d](juegos-3d.md), [aeroplaza](aeroplaza.md), [probar](probar.md).

## Elegir el estilo antes de escribir una línea
| si el juego es… | receta | referencia |
|---|---|---|
| 2D de acción, pixel art, vertical | [juegos-2d-pixel](juegos-2d-pixel.md) | ElTipo (no está acá) |
| 3D que tiene que parecer real (bosque, exploración) | [juegos-3d](juegos-3d.md) | `bosque/` (no está acá); `pique3d/`, `perro/` |
| 3D estilizado, brillante, social, todo por código | [aeroplaza](aeroplaza.md) | aeroplaza (no está acá; la guía sí) |

## Cómo está armado un juego en este repo (visto en `enjambre/`, 29/09/2026)
- Carpeta propia con `index.html` + `js/` (módulos ES) + `css/` + `README.md` + `pruebas/`.
- `empaquetar.py` arma `<juego>-en-un-archivo.html`: un módulo ES desde `file://` lo bloquea CORS, y diez archivos sueltos no se mandan por mensaje. El orden de la lista de módulos importa. → `enjambre/empaquetar.py` (docstring)
- Mejor sacar ese orden de los `import` (orden topológico) que escribirlo a mano. → `isla/empaquetar.py` (29/09/2026)
- Los binarios son opcionales: si hay imágenes en `assets/` entran en base64; si no, el juego se dibuja con formas. → `enjambre/empaquetar.py`
- El README abre con una tabla "Lo medido" (pruebas, cuadros, ms por cuadro, peso del archivo). → `enjambre/README.md`, `ritmo/README.md`

## Lo que no puede faltar (las tres guías coinciden)
- Un archivo que abre sin red; lo generado por IA pisa a lo dibujado por código recién cuando llega.
- Celular primero: probar parado (412×892) y acostado (892×412); cada dedo por su id; el menú entra en 360 px de alto.
- El look sale de la luz, la atmósfera y el post (3D) o de la escala entera y la paleta (2D), no de los polígonos.
- Todo se mueve un poco: viento, partículas, cámara, latidos con senos desfasados.
- Game feel: coyote y buffer de salto, salto variable, squash & stretch, hit-stop y sacudida, y cada acción con respuesta triple (sonido + imagen + vibración).
- `dt` recortado (0,05 s) o paso fijo de 60 Hz; en 2D, nada de `setTimeout` para lógica de juego.
- Azar del mundo con semilla; azar visual aparte.
- Audio recién después del primer toque; cada sonido con un plan B sintetizado.
- Calidades con ajuste automático medido; nada de gradientes ni materiales creados por cuadro.
- `localStorage` en `try`, defaults fusionados con lo guardado, lo que llega por red validado.
- Sondas de prueba (`window.__X`), un parámetro para entrar directo a la escena y otro para pausar y avanzar a mano.

## Juegos de este repo que ya enseñan algo
| juego | la lección | dónde |
|---|---|---|
| `enjambre/` | simulación sin dibujo ni audio para que robots jueguen 64 partidas y balanceen | `enjambre/README.md § Por qué hay un simulador aparte` |
| `ritmo/` | la melodía ES la carta: sin mp3, sin desfase, validada en Node | `ritmo/README.md § La carta no se deduce de la música` |
| `ritmo/` | escala menor y 4 progresiones fijas: "una progresión al azar suena a nada" | `ritmo/js/compositor.js` (comentarios de arriba) |
| `perro/` | esqueleto propio por regiones de vértices cuando el rig generado no trae los clips | `guias/GUIA-JUEGOS.md § 4.3` |
| `isla/` | pixel art en 3D por texel de mundo; menú que se mece y vuela a carteles en el mundo (el que pidió para los juegos nuevos) | [isla](isla.md) |
| `pique2d/` | sprites generados y el bug de los lugares inaccesibles | `pique2d/LEEME.md` (sin leer) |
| `dimension-n/` | caída vertical con ragdolls de Verlet | `dimension-n/README.md` (sin leer) |
| `espejo/` | 40 puzzles de luz resueltos por una máquina | `espejo/README.md` (sin leer) |

## Música: lo que se sabe
- Mejor grabada (Rezona `kind: music`, "seamless loop") que compuesta nota por nota. → [juegos-3d](juegos-3d.md)
- Si va en código: desde tablas de acordes/escalas y progresiones fijas, con voicing plegado y scheduler con lookahead. → `guias/GUIA-AEROPLAZA.md § 11.2`
- Aeroplaza pasó del motor generativo a 7 MP3 con puntos de bucle ("con canciones"). → [aeroplaza](aeroplaza.md)

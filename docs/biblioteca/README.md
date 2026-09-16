# Biblioteca de Estilos

El "Paso 1" del flujo guardado en [`../Prompts/diseno-web-claude/`](../Prompts/diseno-web-claude/),
pero hecho de verdad: capturas reales de sitios en vivo, no miniaturas robadas
de una galería.

```
node capturar.mjs      # visita cada sitio y lo fotografía
node construir.mjs     # arma index.html
node construir.mjs --embebido   # arma galeria.html, un solo archivo autocontenido
```

## Qué guarda de cada sitio

| | |
|---|---|
| `img/<id>.webp` | Captura de escritorio, 1440×900 |
| `movil/<id>.webp` | Captura en Pixel 7 emulado, solo la familia móvil |
| `thumb/<id>.webp` | Miniatura de 560 px para la galería autocontenida |
| `catalogo.json` | Familia, URL, **tipografías y paleta leídas del CSS de la página** |

Lo de la paleta y las tipografías es la parte útil: no es un color sacado del
píxel, es lo que el navegador calculó de verdad para los `h1`, el `body` y los
botones. Eso es el *vocabulario* del que hablan tus capturas — lo que pegas
en el prompt de cuatro partes como *Estética* y *Referencia*.

## Familias

| Familia | Qué buscar ahí |
|---|---|
| `3d-webgl` | Geometría en tiempo real, cámaras, materiales |
| `animacion` | Scroll, transiciones, cursores, movimiento como argumento |
| `producto-saas` | La familia más copiada; mira qué separa a las buenas del montón |
| `dev-docs` | Densidad de información bien resuelta |
| `movil-android` | Con captura de escritorio **y** de teléfono |
| `marca-editorial` | Tipografía como estructura, no como relleno |
| `galerias` | De aquí sale la próxima tanda de referencias |

## Añadir sitios

Una línea en `sitios.json` y vuelves a correr `capturar.mjs`. Solo captura lo
que falta, así que es barato repetirlo. Para refrescar un sitio, borra su
`img/<id>.webp`.

## Detalles de la captura

- **Dos navegadores en paralelo.** El relay de esta sesión corta el handshake
  TLS 1.3 de Chromium, así que el navegador principal va capado a TLS 1.2 — pero
  hay sitios que solo hablan 1.3. Si uno falla, el sitio se reintenta en el otro.
- **Banners de cookies fuera** antes de disparar: primero buscando el botón de
  aceptar, y lo que quede fijo con pinta de banner se elimina del DOM.
- **Un empujón de scroll** antes de la foto para despertar animaciones de
  entrada e imágenes perezosas, y vuelta arriba.
- **Concurrencia 4** con reanudación: si lo cortas a medias, al relanzarlo
  sigue donde iba.

## Lo que no captura

Sitios detrás de login (Mobbin y Screenlane solo dan su portada), los que
bloquean centros de datos, y el movimiento: una captura fija no enseña una
animación. Para esos, la ficha te deja el enlace — ábrelo.

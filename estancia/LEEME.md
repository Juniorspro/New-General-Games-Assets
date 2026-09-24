# Estancia — La Ley del Monte

Simulador de estancia en el monte chaqueño, M+18, en three.js (r160). Se abre
`index.html` o el HTML empaquetado; anda desde el disco (`file://`) y sin
internet. Receta seguida: `GUIA-JUEGOS.md`.

## Controles

| tecla | qué hace |
|---|---|
| WASD / flechas, ratón | caminar o andar a caballo, mirar |
| Shift / C | galope / al paso (a caballo) |
| E | la acción de lo que se tiene cerca (montar, mate, catre, manga, tranquera…) |
| 1 o L | sacar el lazo |
| clic sostenido / soltar | revolear / tirar; clic derecho: cobrar |
| P | pialar (en la ventana de la aguja) |
| V | primera o tercera persona |
| H | silbarle al caballo |
| F | armarse un cigarro |
| 1–4 en la manga | aftosa, ivermectina, caravana, hierro |

En el celular: palanca a la izquierda, mirar a la derecha, botones en pantalla.

## De dónde sale cada cosa

| qué | de dónde | archivo |
|---|---|---|
| suelo, pasto, corteza (+ normales) | Higgsfield, hechas repetibles con `herramientas/procesar_texturas.py` | `js/datos.js` |
| vaca, caballo, guacho, chata, rollo (GLB) | Rezona: modelo 3D + esqueleto (`rig3d`), texturas bajadas a JPEG 1024 | `js/datos.js`, `rezona.json` |
| caminata de vaca y caballo; quieto, caminar y correr del guacho | Rezona `rig3d` (una animación por pedido) | idem |
| revoque, chapa, tablas, barro (+ normales) | Rezona, imagen → `herramientas/procesar_rezona.py` | idem |
| ramas de quebracho, algarrobo y vinal; matas de espartillo | Rezona con fondo transparente, recortadas y sangradas | idem |
| la voz del Guacho (38 frases) | Higgsfield `seed_audio`, voz Barrett | `voces.json` |
| viento, chicharras, teros, mugidos, lazo, radio | sintetizado en `js/sonido.js` | — |

Lo que no está (música, efectos grabados): Rezona devolvió "servicio no
disponible" toda la noche del 23/9, sin cobrar; Higgsfield no deja usar sus
modelos de música y efectos fuera de su propio generador de juegos. Queda el
sonido sintetizado.

Cada modelo tiene su plan B: si un GLB no carga, el animal armado por código
aparece en su lugar. Ese animal de código sigue estando, invisible: es el
esqueleto lógico que usan el lazo, la manga y la cura.

La vaca y el caballo no usan la caminata de Rezona: se mueven con
`js/marcha.js` (paso, trote y galope por código, con IK en las patas, y las
posturas: pastar, echada, tumbada, muerta, tirando del lazo, en el cepo).
El Guacho sí usa sus clips (quieto, caminar, correr), sin avance de raíz y a
la velocidad medida del clip.

Pruebas cuadro a cuadro: `herramientas/pruebas/LEEME.md`.

## Rearmar

```sh
# 1. meter assets nuevos en js/datos.js (conserva lo que ya estaba)
python3 herramientas/armar_datos.py carpeta-con-assets/
# 2. el HTML de un solo archivo
python3 ../herramientas/descargable/empaquetar.py index.html estancia.html
```

`js/datos.js` pesa 11,4 MB y el HTML empaquetado 12,2 MB (23/9/2026).

# BOMB RUNNER SIMULATOR — en construcción

Un simulador a lo Roblox, sacado del documento de diseño que pasó quien pide
(30/09/2026): arrancás en el patio de tu casa con una bomba de 3 segundos en
la mano, corrés por un camino infinito y, cuando llega a cero, se te cae, te
sorprendés y la explosión te manda a volar y rompe lo que hay cerca. Los
metros, el daño de la bomba y lo que destruiste se cobran en una
tragamonedas; con eso se compran bombas, calzado, mechas y huevos de
mascotas, se entrena el daño con clics y zonas AFK, y se renace para
multiplicar todo y abrir cinco mundos.

**Estado: se paró a pedido el 30/09/2026.** Todavía no se puede jugar.

## Lo que ya hay (`js/`)

| módulo | qué hace | ¿se miró en pantalla? |
|---|---|---|
| `util.js` | números a lo simulador (1.2K, 3.4M), azar con semilla, suavizados | — |
| `geo.js` | cajas redondeadas y el armador de modelos por piezas con color por vértice (se dibujan fusionados y se rompen pieza por pieza) | sí |
| `material.js` | plástico con borde de luz, piezas con luz propia, arcoíris que corre | sí |
| `texturas.js` | 9 caras (normal, decidido, sorpresa, miedo, mareado, feliz, esfuerzo, guiño y dos con los ojos cerrados para el parpadeo), suelos de los cinco mundos, fachadas, tejas, carteles | caras y pasto, sí |
| `motor.js` | render en HDR, bloom de dos escalas con umbral alto, tonos neutrales de Khronos, saturación, viñeta | sí |
| `cielo.js` | cielo, niebla y luz de los cinco mundos; nubes de bolas; sombra que sigue al jugador | patio, sí |
| `avatar.js` | el "noob" con codos y rodillas; poses: quieto, caminar, correr, correr con la bomba, sorpresa, salto, trampolín, pesas, festejo, sentado | sí (seis poses) |
| `equipo.js` | 5 bombas (agua, dinamita con reloj, C4, nuclear, cósmica), 3 mechas que se queman (hilo, pólvora, temporizador digital), 4 calzados (pantuflas, tenis, botas cohete con llama, sónicas) y las chispas | no |

`vendor/three.module.min.js` es three.js r160, el mismo que usaba La Isla (en el historial: `git show fbffdfb:isla/…`).

## Lo que falta, en el orden pensado

1. `ragdoll.js` (Verlet con 14 puntos; mueve las 10 mallas de `Avatar.partes()`), `explosion.js` (destello, bola de fuego con ruido, onda, humo, chispas; hongo para la nuclear, salpicadura para la de agua), `escombros.js`.
2. `blancos.js` (muñecos y estructuras de cada mundo, con vida y multiplicador: x2-x10 los que se mueven, x15-x1000 las estructuras), `mundos.js`, `camino.js` (tramos reciclados y origen que se corre).
3. `patio.js` (la casa, la tienda, los huevos, las zonas AFK, el altar de renacer, los portales y la puerta de salida), `mascotas.js` y la apertura de huevos.
4. `datos.js` y `progreso.js` (precios, fórmulas, renacer, mundos), `hud.js`, `tragamonedas.js`, `menu.js` (el que se mece, como el de La Isla: `git show fbffdfb:isla/js/menu.js`), `entrada.js`, `jugador.js`, `sonido.js`, `idioma.js` (es, en, pt), `guardado.js`, `main.js`, `index.html`, `css/`.
5. Pruebas en `pruebas/`, `empaquetar.py` (el de La Isla: `git show fbffdfb:isla/empaquetar.py`) y un solo HTML.

Números pensados (sin probar): correr a 3,2 m/s con la bomba (la mitad de 6,4); mechas de 3, 5 y 8 s; la ganancia = (metros × 2 + daño × multiplicador de la bomba × 0,25) × (1 + suma de los multiplicadores rotos) × mundo × suerte de la tragamonedas.

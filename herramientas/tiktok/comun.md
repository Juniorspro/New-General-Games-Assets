# Portar a TikTok (Mini Games, runtime nativo)

Lo que dice la documentación de TikTok for Developers (leída el 23/09/2026):

- **El runtime nativo no es un navegador.** Un juego "no puede depender del
  DOM completo, de CSS, de la navegación web ni de APIs del navegador
  cualesquiera".
  - Todo lo que en estos juegos es HTML/CSS (menús, botones, ventanas) hay que
    dibujarlo en el canvas.
- **El paquete** es una carpeta con:
  - `game.js`: la entrada;
  - `game.json`: la configuración del runtime y de los subpaquetes;
  - `project.config.json`: la configuración del DevTool.
- **Se dibuja en el canvas que da el runtime.** La primera llamada a
  `tt.createCanvas()` devuelve el de la pantalla, del tamaño de la pantalla.
  Las siguientes crean lienzos fuera de pantalla.
- **Las APIs de la plataforma** (login, compartir, pagos, opciones de arranque)
  llevan el prefijo `TTMinis.game`.
- **Tamaño**, para lo que no es Unity:
  - 30 MB en total;
  - 4 MB el paquete principal;
  - lo demás va en subpaquetes.
- **Qué se acepta:**
  - un build web común no se acepta como paquete nativo;
  - los motores con plugin oficial son Cocos Creator, LayaAir y Unity;
  - para el DevTool hace falta una cuenta con sesión iniciada.
- **Almacenamiento, sonido y toques** van por las APIs del runtime, no por las
  del navegador. Los nombres exactos están en la referencia de la API de Mini
  Games; esta guía no los inventa.

Fuentes:

- [Mini Games Technical Overview](https://developers.tiktok.com/docs/en/mini-games-technical-overview)
- [Develop Your Mini Game](https://developers.tiktok.com/docs/en/develop-your-mini-game)
- [Mini Games SDK Overview](https://developers.tiktok.com/doc/mini-games-sdk-overview)
- [Release Your Mini Game](https://developers.tiktok.com/docs/en/submit-your-app-for-review)

## Lo que tienen a favor estos juegos

- **No usan imágenes ni sonidos sueltos**: el arte se pinta con código y el
  sonido se sintetiza. La excepción es BOSQUE, que tiene modelos y texturas.
- **La física es código puro, sin DOM**: se lleva tal cual. Los niveles también
  los comprueba una máquina con esa misma física, en Node.
- **El texto** (español, inglés y portugués) está en un solo archivo por juego.

## Qué cambia en todos

| en el navegador | en TikTok nativo |
|---|---|
| el `<canvas>` de la página | el primer `tt.createCanvas()` |
| `document.createElement('canvas')` para dibujar aparte | los siguientes `tt.createCanvas()` |
| menús, ventanas y botones en HTML/CSS | dibujados en el canvas, con la prueba de "¿en qué botón cayó el dedo?" |
| `pointerdown`/`pointermove`/`pointerup` sobre elementos | los eventos de toque del runtime, en coordenadas de pantalla |
| `localStorage` | el almacenamiento del runtime |
| `AudioContext` (WebAudio) | lo que exponga el runtime; si no alcanza, grabar la música a archivos |
| `requestAnimationFrame` | el del runtime |
| pantalla completa y giro de 90° con el teléfono parado | la orientación horizontal fija del paquete |
| teclado y mando | no hacen falta: en TikTok se juega con el dedo |

El orden que conviene:

1. Canvas, física, dibujo y toques: el juego ya se puede jugar.
2. Los menús, en el canvas.
3. El sonido.
4. El guardado.
5. Login, compartir y lo demás de la plataforma.

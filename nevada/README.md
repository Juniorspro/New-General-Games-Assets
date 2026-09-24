# NEVADA

Un superdeportivo malva estacionado en un bosque nevado y un tigre blanco que
camina hacia la cámara, se echa al lado de la rueda y ruge. Después, el auto
se va por el camino. Es una cinemática de 18,5 s en 9:16, como un TikTok, pero
renderizada en vivo con three.js: nieve que cae, niebla, luz, cámara en mano,
cortes al ritmo de un phonk sintetizado y un desglose en arcilla al principio.

Recrea un video de @m4jor3d × @W-SE ("Did we cook⁉️"). Los modelos, las
texturas y el fondo se hicieron con Rezona. La música es propia: no es la del
video.

**Para verla:** `nevada-en-un-archivo.html`. Es un solo archivo (10 MB): abre
con doble clic y anda sin internet.

- Se elige el idioma (castellano, inglés o portugués) y después "Ver la
  cinemática".
- Al terminar queda la cámara libre alrededor del auto: se arrastra para girar
  y se acerca con la rueda o con dos dedos.
- **Modo arcilla** muestra la escena como en el desglose.
- **♪** apaga o prende el sonido.

## Los planos

| s | plano |
|---|---|
| 0–3 | el desglose en arcilla: piezas pastel sobre fondo oliva |
| 3–4,5 | el drop: el tigre camina hacia la cámara con el auto atrás |
| 4,5–5,25 | empujón a la trompa, con desenfoque de zoom |
| 5,25–7 | tres cuartos bajo, con el tigre echado junto a la rueda |
| 7–9 | barrido y la cola baja con las luces rojas |
| 9–11 | el rugido en primerísimo plano |
| 11–13 | la vuelta alrededor del auto |
| 13–16,5 | el auto se va por el camino |
| 16,5–18,5 | el título |

## Para tocarla

- `node herramientas/armar.mjs` arma `dist/` y el archivo único.
- `node herramientas/optimizar_modelos.mjs` hace `assets/*.glb` desde lo que
  bajó de Rezona a `crudo/`.
- `python3 herramientas/procesar_texturas.py` hace `assets/*.webp`.
- `pruebas/`:
  - `fotos.mjs` saca una foto por plano;
  - `depurar.mjs` muestra cada objeto solo;
  - `flujo.mjs` recorre el HTML como una persona;
  - `musica.mjs` renderiza el audio offline y lo mide.
- `?t=5.2` al final de la dirección deja la escena quieta en ese segundo.
- Las trampas que ya se pagaron están en `memoria/nevada.md`.

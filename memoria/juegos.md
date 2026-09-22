# Juegos
Fuente: `herramientas/juegos/GUIA-JUEGOS.md` (la receta completa), `herramientas/juegos/LEEME.md`. Ver también: [rezona](rezona.md).

- Plantillas: `plantilla-3d.html` (three 0.180, ACES, bloom, sombras) y `plantilla-2d.html` (canvas, sprites, paso fijo 1/120). Cero errores (22/09).
- Probar: `node herramientas/juegos/probar.mjs <html absoluto> captura.png` (sirve jsdelivr desde `/opt/gamekit`). FPS de acá no valen: SwiftShader.
- Orden de lo que rinde: luz → niebla del color del horizonte → tono (AgX/ACES) → materiales → densidad → movimiento → post con identidad → sonido. → `GUIA-JUEGOS.md § 0`
- `PCFSoftShadowMap` no existe en r18x: usar `PCFShadowMap`. `dt = max(0, min(…))`. → `GUIA-JUEGOS.md § 6.1, § 6.2`
- Árboles: esqueleto por código + tarjetas de foto, nunca imagen→3D. → `GUIA-JUEGOS.md § 6.5`
- Pendiente: pasar la plantilla 3D a HDR + AgX + niebla con bruma baja (§ 6.1–6.3).

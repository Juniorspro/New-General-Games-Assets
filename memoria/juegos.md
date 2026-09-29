# Juegos
Fuente: `guias/`. Ver también: [maquina](maquina.md).

## Qué guía seguir
- 2D pixel art (beat'em up, plataformas, celular en vertical 412×892, un HTML sin red): `guias/GUIA_JUEGOS_2D_PIXEL.md`.
  Lo más importante: escala entera (§2), personajes por piezas con `pose(e)` (§3), bucle a paso fijo con la entrada consumida al final (§1), bot que juega los niveles (§12), lista de trampas (§13).
- 3D que se vea bien (three.js, assets de Rezona): `guias/GUIA-JUEGOS-3D-REZONA.md`. La luz manda (§0), HDR + AgX, niebla del color del horizonte (§6), plan B si Rezona no genera (§8).
- Las guías citan `juegos-pc/ElTipo.html` y `bosque/` como referencia: NO están en este repo (29/09/2026). Estarán en el repo viejo `Juniorspro/General-Assets-Games` (sin comprobar).

## Lo que ya se sabe de este repo
- Rezona puede no estar conectado en la sesión, o fallar el cobro (`CREDIT_RESERVE_FAILED`, 22/09/2026): probar una imagen antes de una tanda. → `ARRANQUE.md § 6`
- Pruebas de juegos en Chromium: dibuja sin GPU (swiftshader), los fps de acá no dicen nada del teléfono. → [maquina](maquina.md)

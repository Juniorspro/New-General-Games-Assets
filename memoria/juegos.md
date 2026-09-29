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

## Shumio's Depths (`shumio/`, réplica de mecánicas de The Binding of Isaac: Repentance, arte propio)
- Armado: `node shumio/construir.mjs` junta `src/*.js` (en orden) en `index.html`. Pruebas: `node shumio/pruebas/menus.mjs [tactil]`, `jugar.mjs`, `hoja.mjs <grupo>`; capturas en `shumio/salida/` (ignorada).
- Sondas en `window.__SH`: `nueva()`, `irA(tipo)`, `vs()`, `matarTodo()`, `rotuloPrueba(tit, sub)`.
- **Nada de memoria para la estética del original: comparar con capturas.** La usuaria lo marcó dos veces.
  Referencias que se pueden bajar: capturas oficiales de Steam (`store.steampowered.com/api/appdetails?appids=250900` Rebirth, `1426300` Repentance) y la wiki (`bindingofisaacrebirth.wiki.gg/api.php`, archivos: HUD, RERUN_image, títulos, UnlockPaper). YouTube no deja bajar videos (pide login); sí la miniatura `i.ytimg.com/vi/<id>/maxresdefault.jpg`.
- Medido en el original (480×270): rótulo de objeto/piso = letra ancha de 10×10–12 px, blanca y limpia (sin mordidas), sobre franja NEGRA rasgada en bultos; subtítulo en mayúsculas y minúsculas ("Quad shot"), negrita de 8 px con contorno. El piso no lleva subtítulo. HUD: cifras gordas blancas con contorno. Menús: papel rasgado con chinches y letra de marcador. Acá (240 de alto) va todo ×0,89.
- Juega con dedo (joysticks flotantes, botones) y con teclado/mouse (hover y clic en los menús; con mouse no hay joysticks). Siempre probar los dos.

# Juegos 2D pixel art (estilo Dan The Man)
Fuente: `guias/GUIA_JUEGOS_2D_PIXEL.md` (488 líneas; abrí solo la sección). Ver también: [juegos](juegos.md), [probar](probar.md).
La referencia que cita (`juegos-pc/ElTipo.html`, `herramientas/kit_enemigos*.py`, `herramientas/calco_protagonista.py`) NO está en este repo (buscado el 29/09/2026). El 2D pixel que SÍ está: `cripta/` → [cripta](cripta.md).

## Reglas que mandan
- Un archivo, cero red: canvas 2D, WebAudio y sprites como grillas de texto en el código. → § 0
- Escala entera siempre: `PX = max(2, round(ANCHO/212))`; con ×1,94 los píxeles salen de distinto tamaño y todo tiembla. → § 2
- Azar del mundo con semilla (mulberry32) y azar visual con `Math.random`: si se mezclan, una semilla deja de dar la misma partida. → § 9
- Lo generado por IA pisa lo dibujado por código recién cuando decodifica. → § 0

## Bucle y entrada
- Simulación a 60 Hz fijos con acumulador (máx. 4 pasos por cuadro); el dibujo va a lo que dé la pantalla. → § 1
- Los flancos de entrada se consumen AL FINAL de `pasar()`; durante el hit-stop no se consumen. → § 1
- Nada de `setTimeout` para lógica: todo en cuadros del nivel (`J.finNivel = 84`). → § 1
- Sondas `window.__T` (est, anda(n), entrada, teletransportar, semilla, matarTodo); `anda(n)` adelanta TODOS los relojes. → § 1

## Render
- Tres lienzos: pantalla (DPR ≤ 1,5), mundo chico a escala 1, HUD chico transparente encima de todo. → § 2
- `ResizeObserver` + revisión cada 15 cuadros: medido una vez antes del layout, el juego sale aplastado. → § 2
- Sin `clip()` ni `arc()` (suavizan): círculos píxel por píxel con `Math.hypot`. → § 2
- Dibujar 4× menos píxeles bajó de 6,4 a 2,6 ms por cuadro. → § 2
- Vertical: ~210 px de mundo a lo ancho, encuadre sobre lo que dejan libre los mandos (`ZONA_MANDOS = round(190/PX)`). → § 2

## Personajes por piezas
- Un esqueleto `pose(e)` da todas las animaciones con senos y el avance `f = 1 - an/anMax`. → § 3.1
- Referencia → paleta por moda de bloque → grilla ~28×46 → limpieza a mano (la conversión sirve de calco). → § 3.2
- Piezas con ancla, horneadas una vez; desplazamiento = (pose − reposo) × 1,3 (brazos 1,35, tope 17 px). → § 3.4
- Trampas: el puño que sube tapa la cara; brazos al 165 % = goma; lienzo de composición con aire (104×84 para 28×46). → § 3.4
- Kit de enemigos: letras de rol + paleta por tipo; 7 cabezas × 4 torsos = 11 personajes; un rol por cada color que cambie. → § 3.5

## Fondos, texto y menús
- Un pintor por tema dibuja una vez dos tiras (lejos y medio); lo que se mueve se registra aparte con `anim({t,x,y})`. → § 4
- Gradientes creados por cuadro llevaban el dibujo a 9 ms: todo lo fijo, cacheado. Fundido con trama Bayer 4×4. → § 4
- Fuente propia 5×7 con tildes, Ñ, Ü y ¡¿; los textos largos van en monoespaciada común (en píxeles no se leen en el celu). → § 5
- Portada viva: el héroe pelea en loop sobre un nivel; el título se dibuja en el mundo pixelado, con ondas y barrido de luz. → § 6
- Botones de 16 bits en CSS: `border-radius:0`, dos `inset` de sombra + contorno, animaciones con `steps()`. → § 6

## Mandos y combate
- Dos botones + gestos: puño arriba = gancho, puño abajo en el aire = plancha, doble toque en flecha (< 270 ms) = dash. → § 7
- `touchstart` con `{passive:false}` + `preventDefault`; cada dedo por `identifier`; ojo con la especificidad del CSS. → § 7
- Hit-stop 3-8 cuadros, sacudida ×0,86 por cuadro, estrella de impacto, jump-cancel, parry en los primeros 9 cuadros de guardia. → § 8
- Combo de tres: los dos primeros empujan poco (0,7-0,9) o el tercero no llega. Jefes con barra de quiebre y 3 fases. → § 8

## Niveles procedurales
- Entrada + segmentos (pasillo, plataformas, trampa, tesoro, arena, jefe); alcanzable por construcción (`SALTO_DH 82`, `SALTO_DV 70`). → § 9
- Fosas con fondo (34 de hondo); caerse del mapa devuelve al último piso firme, no al principio. → § 9
- La arena cuenta solo a los enemigos de su oleada. Rango S-D al final y progreso en `localStorage` con `try/catch`. → § 9

## Audio y banco
- SFX con osciladores + búfer de ruido; música por pasos (bajo + arpegio, bombo cada 4, redoblante cada 8); `AudioContext` en el primer toque. → § 10
- Bot que completa 3 semillas × 5 niveles (15/15) y que SUELTA las teclas; toques reales por CDP; medir con 200 cuadros de calentamiento + 300. → § 12

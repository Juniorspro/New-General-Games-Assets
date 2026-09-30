# Juegos 3D que se ven bien (three.js + Rezona)
Fuente: `guias/GUIA-JUEGOS.md` (837 líneas; abrí solo la sección). Ver también: [juegos](juegos.md), [aeroplaza](aeroplaza.md), [probar](probar.md).
El ejemplo que cita, `bosque/`, NO está en este repo; `pique3d/`, `perro/` y `enjambre/` se borraron el 30/09/2026 (en el historial, `fbffdfb`); `herramientas/rezona/` sigue.

## Lo que más rinde, en orden
- Luz antes que polígonos: una hora del día y un sol que manda; el ambiente nunca suma más que el sol sobre el suelo (si no, sale plano y lechoso). → § 0
- Niebla del color del horizonte, más densa abajo y dorada hacia el sol. → § 6.3
- HDR (`HalfFloatType`) y AgX o ACES en la última pasada, con `renderer.toneMapping = NoToneMapping`. → § 6.1
- Un post-proceso con identidad (VHS, grano) borra lo que delata lo falso. → § 6.10
- Densidad antes que detalle; todo se mueve un poco (viento, polvo, cámara con mano). → § 0
- Luz, niebla, tono y post no cuestan créditos: se hacen siempre, aunque Rezona no genere. → § 0

## La luz, con números (bosque)
- Sol (1; 0,74; 0,5) × 4,6; hemisférica cielo (0,5; 0,58; 0,74) / suelo (0,16; 0,13; 0,08) × 0,5; `environmentIntensity` 0,26. → § 6.2
- Sombra 2048 en una caja de ±34 m que sigue al personaje de a un texel (si no, los bordes titilan). → § 6.2
- `FogExp2` 0,003 + bruma baja 0,0075 que cae cada 9 m; el color de la niebla es el de la bruma medida en el cielo. → § 6.3

## Rezona
- Antes de una tanda, una imagen de prueba; el 22/09/2026 daba `CREDIT_RESERVE_FAILED` con créditos de sobra → plan B (§ 8), sin reintentar en bucle. → § 1
- Vale el `output_path` de la RESPUESTA; `size` respeta proporción, no número; `transparent: true`; el modelo por defecto saca solo PNG. → § 1
- Frase de estilo idéntica al final de cada pedido; escala en metros; una sola hora del día. → § 2
- Forma del pedido: tipo de toma + sujeto concreto + luz + negaciones ("no text, no watermark"). → § 3
- Imagen→3D: 155-185 s y 28-30 MB / ~1 M de triángulos; weld → simplify (`error` 0,012) → webp 1024 → quantize → prune. → § 4.1
- Trampa: `quantize()` + escala horneada recorta sin aviso; pasar a coma flotante antes. → § 4.2
- Rig: comprobar los clips que llegaron; `timeScale = velocidad / (zancada / ciclo)`; caminar y correr en la misma fase. → § 4.3
- Árboles: NO en 3D generado; tronco por código + tarjetas de foto, 3 niveles de detalle con impostor del mismo árbol. → § 6.5

## Procesar lo que llega
- Texturas: aplanar la luz (sigma 12 % del lado), cerrar costura (12 %), normales desde luminancia; color 1024 webp ~76, normales 512. → § 5.1
- Recortes con alfa: descontaminar el blanco, sangrar el color 48 pasadas, base pegada al borde de abajo. → § 5.2
- Cielo: horizonte a la mitad, subirlo ~5°, sin mipmaps; medir el sol y la bruma: la luz sale del sol pintado. → § 5.3

## El motor
- `onBeforeCompile` encadenado y con clave propia (`parchear`), una vez por material, sin `uniform` repetidos. → § 6.3
- Terreno: una sola rejilla para la malla y la física, interpolada por triángulo; hash con `Math.imul`. → § 6.4
- Presupuesto medido: 310-760 mil triángulos y 60-74 llamadas por cuadro; instanciar y recortar por distancia y pantalla. → § 6.6
- `compileAsync` en la carga; el lienzo se redimensiona al EMPEZAR el cuadro; `dt = max(0, min(0.05, real))`. → § 6.1
- Cámara: se acerca instantánea ante un choque y se aleja lenta; campo horizontal fijo de 78°; joystick donde cae el pulgar, cada dedo por `pointerId`. → § 6.8
- El menú tiene que entrar en 360 px de alto (teléfono acostado). → § 6.8

- Un logo en 3D sin modelos: trazos 2D muestreados → `TubeGeometry` metálico con reflejos de PMREM; `setDrawRange` lo escribe y `onBeforeCompile` le suma brillos. → [isla](isla.md) § La intro 3D

## Sonido
- Rezona: `kind: music` 30-60 s terminado en "seamless loop, consistent energy, no fade out"; efectos `kind: sound` de hasta 2 s. → § 7
- La guía dice no componer música nota por nota en código. `ritmo/` (borrado, en el historial) la componía desde una escala menor y 4 progresiones fijas ("una progresión al azar suena a nada"); aeroplaza tiene un motor con acordes de 9/11/13, pero su versión "con canciones" lo apaga (`soloGrabadas = true`) y suena con 7 MP3 en bucle (ver [aeroplaza](aeroplaza.md)). → § 7
- Cada sonido se busca por nombre y, si falta, se sintetiza: lo generado pisa a lo sintetizado sin tocar código. → § 7

## Entregar
- En Rezona: `dist/index.html` + `.rezona/`, assets en `dist/datos/` (Rezona saltea `assets/` sin avisar); `publish_to_rezona_app` solo si lo piden. → § 10
- En un solo HTML: `data:` URIs en `window.ARCHIVOS`, sin `fetch` (GLB con `atob` + `parse`, texturas del GLB como `<img>`), escapar `</script`. → § 10
- Lista antes de decir "listo". → § 12

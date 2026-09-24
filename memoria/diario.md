# Diario

Una entrada por sesión: qué quedó y qué falta. La más nueva arriba.

## 22/9/2026 — rama `claude/papa-del-patron-3cpe64`

**Qué quedó**

- `PAPA-DEL-PATRON.md`: el traspaso al día, arriba de `ARRANQUE.md` y
  `ESTADO.md`. Donde se contradicen, manda el traspaso. El `README.md` ya lo
  dice.
- Sección 9 nueva ahí: la API de Rezona entera, medida por HTTP.
- La llave de Rezona quedó cargada y probada hasta donde se puede sin gastar:
  leer saldo y listar proyectos dan 200. Ver [rezona](rezona.md).
- Neko levantado y manejado desde la sesión. Ver [neko](neko.md).
- Dos imágenes generadas por Higgsfield (1 crédito cada una) y una convertida a
  sprite 64x64 de 16 colores. Ver [imagenes](imagenes.md).
- Este sistema de memoria, instalado con `MEMORIA.md`, `CLAUDE.md` y `memoria/`.
- `termo/index.html`: termo de mate en 3D, publicado como artifact
  (claude.ai/artifact/YbhriSa1FJU6gf78vfXjYY, privado). Se gira arrastrando,
  ceba sobre un mate, cuenta los 1.000 ml en cebadas de 45, y el agua se enfría
  por Newton (k 0,043/h, reloj ×120). Revisado con una captura: arreglados el
  cartel de "sin WebGL" que salía igual, la bombilla que tapaba el chorro y la
  escala partida en dos renglones. **La segunda versión no se volvió a mirar.**
- `herramientas/descargable/empaquetar.py`: arma el HTML completo de un
  artifact (doctype, charset, reset, scripts de CDN adentro). Medido con el
  termo: 686 KB, abierto desde el disco **con la red cortada**: three r160
  cargó desde adentro, modo estándar, acentos bien, cero errores. Lo único que
  quiso salir fueron las fuentes de Google, que tienen respaldo.
  El empaquetado **no se commitea**: es un resultado, se regenera en segundos.
- `zocalo/`: zócalo de stream con el título pedido, publicado
  (claude.ai/artifact/9XRuLCVN8x6tdYwfw8EZ8H, privado) y quemado en el video que
  mandó (clip de la Cámara, 992×576, 1:05). Tapa entero el zócalo oficial y
  deja libre a la intérprete de señas. Se corrigieron dos errores de tipeo del
  título pedido: LIBETARIO → LIBERTARIO e INFLAGANTI → IN FRAGANTI.
  **El video no se commitea**: es material de la Legislatura, y el repo es público.

## 23/9/2026 — misma rama

- `tiktok/`: el clip en 9:16 para TikTok, con logo de Higgsfield, intro animada
  (franjas, golpe del logo, rayos), titular en Anton + Playfair en cursiva,
  subtítulos en Montserrat palabra por palabra (Whisper medium). Publicado
  (claude.ai/artifact/3UkNUipQpvwZ3J8UNYsThT, privado) y entregado el MP4.
- **Pendiente de él:** revisar los subtítulos. Dos dudosos: "De fondo puede
  discutirse…" (0:10, falta la primera palabra, seguramente "Nada") y el "65…"
  del final, que el clip corta. El .srt va en `tiktok/`.
- De la cuenta @1.tomasgomez se vio el perfil pero **no los videos** (TikTok los
  pide con sesión): el estilo no se copió de ahí.

**Qué falta**

- **Rezona no cobra**: 9 intentos, 9 `CREDIT_RESERVE_FAILED`. Hay que
  preguntarle al soporte por qué una PAT válida con 446 mil créditos no puede
  reservar. Hasta entonces no se generan assets ahí.
- Habilitar, si se quiere ese camino, `npx rezona` (lo frena *Code from
  External*) y el gasto de créditos (*Real-World Transactions*).
- Traer a esta rama lo que el traspaso nombra y no está: `herramientas/kaggle/`,
  `herramientas/colab/`, `herramientas/vnc/`, `peakcode/`.
- Corregir en `ARRANQUE.md § 1` los dos datos viejos: el disco (son 30 GB, no
  2,4) y la conclusión de que no se puede compilar un APK.
- El bug de arranque de PeakCode 0.8 sigue sin cazar (`PAPA-DEL-PATRON.md § 5`).
- Decidir si el conversor de pixel art se commitea a `herramientas/`. Quedó sin
  respuesta y el script se pierde con el contenedor.
- Los proyectos de prueba `KCoKOXTfvP` y `xVuxCcKGut` quedaron colgados en
  Rezona; se borran desde la web o no se borran.

**Una cosa rara**

- En la cuenta de Rezona apareció el proyecto `luck-alien-descartable`
  (`HbCHYQfUXt`), creado el 22/9 a las 13:08:58, que **no lo hizo esta sesión**.
  Si no fue el dueño, algo más está usando esa cuenta.

## 23/9/2026 (noche) — Estancia, con assets de Rezona

- `estancia/`: el juego "Estancia — La Ley del Monte" (three.js, un solo HTML,
  12,2 MB). Qué es y de dónde sale cada asset: `estancia/LEEME.md`.
- Rezona volvió a cobrar. Se generaron 14 imágenes, 7 modelos 3D y 5 rigs
  (4.455 créditos); vaca, caballo, guacho, chata y rollos ya están en el juego,
  con el animal de código como plan B y como LOD de lejos.
- La voz del Guacho: 38 frases con Higgsfield (~4 créditos).
- Probado con Playwright desde `file://`: carga 3,4 s, sin errores,
  862 mil triángulos y 281 llamadas en el monte.

**Qué falta**

- Música y efectos grabados: el audio de Rezona estuvo caído toda la noche.
  Los pedidos (42) están en el scratchpad de esa sesión; `estancia/rezona.json`
  guarda los que salieron.
- Las copas de los árboles con las ramas de Rezona se ven algo borrosas de
  cerca; los animales de Rezona no se echan (se quedan parados).

## 24/9/2026 — Estancia: la pasada de bugs de animación y visuales

Pidió arreglar "los muchos bugs visuales y de rigs, uno por uno". Se
filmó todo cuadro a cuadro y salieron, entre otros: la vaca caminaba con una
sola pata delantera (rig mal etiquetado), cuellos que giraban solos (giros
acumulados), el guacho avanzaba y volvía de golpe (avance de raíz), a caballo
la cámara miraba para atrás, el recado flotaba o quedaba adentro, la vaca se
trababa en la manga, la mancha blanca del estero era el barro, la noche era
negra. Lo aprendido: [juegos](juegos.md). Commits en la rama.

**Qué falta**

- Música y efectos grabados (el audio de Rezona no volvió en 90 minutos).
- Las copas siguen siendo tarjetas: de muy cerca se nota.

## 24/9/2026 (tarde) — Estancia: ojo de águila, voz argentina, menús

- **Ojo de águila** al revolear con una vaca a 3,5–18 m: gris, cámara lenta,
  mira que se cierra en la cabeza; soltando con la mira roja el tiro va guiado
  y la cámara gira 90° para verlo de costado. Probado en tercera, primera y
  montado: engancha en los tres (`herramientas/pruebas/ojo-prueba.mjs`).
- **Sin malas palabras** y **voz rioplatense**: 41 frases nuevas con Qwen/Julian
  (0,82 créditos). **Silbido sintetizado** antes de "¡Vení, zaino!".
- **Menús**: portada con cámara que va y viene frente al Guacho al atardecer,
  Cómo se juega, Opciones (volumen, voz, sensibilidad, ojo de águila,
  subtítulos; se guardan en el navegador), pausa con las dos, parte con sello,
  barra de carga, animaciones del HUD y cartel de "girá el teléfono".
- El acento no se puede medir: se eligió por instrucción + ortografía, y
  whisper confirmó los 41 textos. **Que lo escuche alguien de acá.**

- **Escaneo de cuadros** al abrir por primera vez: elige baja/media/alta/ultra
  según los fps del lugar más pesado, lo guarda, y en Opciones se cambia o se
  vuelve a medir. Solo se probó en SwiftShader (1 fps → baja); **en una placa
  de verdad no se midió** (sin comprobar).

**Qué falta**

- Música y efectos grabados (el audio de Rezona sigue caído).
- Las copas siguen siendo tarjetas.

## 24/9/2026 (noche) — Estancia: chat, perros, razas, puesto, audio

- **Chat de comandos** estilo Roblox (Enter o /; globito en el celular), con
  sugerencias: /saludar, /perros, /mate, /comer, /caballo, /hacienda, /razas…
- **Audio**: medido grabando la salida; rebalanceado, voces recodificadas desde
  el original, reverb oscura, limitador. **No se escuchó con oídos**: los
  números están parejos (campo −36, mugidos −28, voz −24, silbido −21 dB).
- **Hacienda**: seis razas por shader, 2 toros (modelo Rezona con esqueleto),
  6 terneros. **Perros**: Tigre, Negra, Chispa (modelo Rezona), 4 órdenes.
- **Puesto**: sillas, heladera y pava de Rezona; mate, guiso, agua fría.
  **Zaino**: se ensucia, baño en el tanque, forraje en el comedero, y al otro
  día se nota. **Lazo** que se enrolla solo.
- Rezona: ~2.200 créditos (saldo 346.230). Higgsfield: 20 voces, 0,4 créditos.
- **Encierre con comedero** (pedido con dos fotos: feedlot y corral de tablas):
  batea de hormigón sobre ladrillos, silo, alambre; 8 novillos de engorde que
  ganan o pierden kilos según se les cargue el comedero; la tropa viene a comer.
- **Mapa** (M): lugares para ir, columna de luz, brújula, minimapa. **Pueblo**
  nuevo afuera de la tranquera de entrada (que ahora se abre).
- **Ultra baja**: sin sombras, plantas quietas, poco pasto, luz de relleno; se
  elige antes del menú (el escaneo la propone en equipos flojos).
- **Más claridad** (viñeta suave, menos niebla, más cielo, Brillo en Opciones) y
  **rodeo de 920** (500 vacas, 20 toros, 400 terneros) con niveles de detalle.

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
  **El video no se commitea**: es material de la Cámara, y el repo es público.

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

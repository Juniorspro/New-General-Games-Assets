# Higgsfield

Un MCP (`mcp__Higgsfield__*`). Se usó en `bosque/` el 22/09/2026 porque Rezona
no generaba, y gastó 203 créditos. El dueño prefiere Rezona: Higgsfield va solo
si lo pide, o si Rezona está caído y lo aprueba. Fuente:
`bosque/herramientas/higgsfield.json`, que tiene el job de cada asset. Ver
también: [rezona](rezona.md), [juegos](juegos.md).

- **Imágenes:** `nano_banana_2` a 2k cuesta 2 créditos y fue usable al primer
  intento en las 23 imágenes del bosque.
- **Cielo 360:** `nano_banana_2` a 4k y 21:9 (6336x2688) le ganó a `grok_image`
  2:1. Le deja el horizonte en el 54 % de la altura, así que se reacomoda
  después (`bosque/herramientas/procesar_assets.py`).
- **Recortes:** se pide sobre fondo blanco y se pasa por `remove_background`.
  Falló una vez de ocho y el reintento anduvo. Deja halos blancos: hay que
  descontaminar y sangrar (`GUIA-JUEGOS.md § 5.2`).
- **Objetos 3D:** `tripo_h3_1_image_to_3d` con texture, pbr y detailed cuesta 9
  créditos. Llegan en un cubo de 1 m, con texturas de 4096 y cuantizados.
- **Personaje:** `image_to_3d` (Meshy) en pose A y con simetría, sin esqueleto.
  Después, `3d_rigging` (8 créditos) una vez por animación, siempre desde la
  MISMA malla: así los huesos tienen los mismos nombres y los clips se juntan en
  un GLB. Las animaciones vienen en el lugar, sin avance de raíz.
- **Audio:** `sonilo_music` y `mirelo_text_to_audio` solo andan dentro de su
  constructor de juegos, no sueltos. Por eso el bosque suena sintetizado.
- **Voz (24/09):** `generate_audio` con `text2speech_v2`, variante
  `elevenlabs`, voz de catálogo "Andre" (`f1e8226e-2248-4d5f-b43c-0a79e9949dbf`).
  - Cuesta 0,8 créditos por línea y pronuncia bien el castellano con acento
    neutro.
  - `seed_audio` pronunciaba mal.
  - Se usó porque el audio de Rezona estaba caído. Ver [videos](videos.md).
- Herramientas que se usaron: `generate_image_batch`, `remove_background`,
  `generate_3d`, `jobs_wait` y `balance`.

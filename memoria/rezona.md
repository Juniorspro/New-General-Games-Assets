# Rezona Lab

Un MCP que genera imágenes, sprites, audio, modelos 3D y esqueletos, y que
además aloja juegos. Fuente: `ARRANQUE.md § 6`,
`herramientas/rezona/estado.json` y `GUIA-JUEGOS.md § 1-4, 7`. Ver también:
[desplegar](desplegar.md), [juegos](juegos.md), [higgsfield](higgsfield.md).

## Conectarlo

- `npx rezona@latest init` hace el login, registra el MCP y deja `.rezona/`.
- Sin navegador: `npx rezona@latest login --no-browser` da un código que se
  aprueba en el teléfono.
- `npx rezona@latest status` muestra la cuenta y los créditos.
- El MCP se carga al arrancar la sesión. Si se registró con la sesión abierta,
  no aparece: se le habla por stdio con `herramientas/rezona/rz.py` (`tools`,
  `esquema <herramienta>`, `call <herramienta> '<json>'`, `batch`).
- Si no está conectado, decilo y seguí con lo que haya: no simules assets.

## El ciclo

1. `create_project` (gratis).
2. `submit_*` cobra y devuelve un `task_id` al instante, sin archivo todavía.
3. `check_generation_tasks` con el `project_id`, sin consultar en bucle cerrado.
4. `fetch_generated_asset`, parado en una carpeta que tenga `.rezona/`.

## Trampas que cuestan créditos

- El `output_path` que vale es el de la respuesta: el servidor le agrega
  `-g1`, `-g2`.
- `size` respeta la proporción, no el número: 1536x672 volvió como 1376x768, y
  sin `size` sale 1024x1024. El kit de juegos dice que el lado largo llega a
  3840, pero lo medido es que 1920x1080 dio `VALIDATION_ERROR` terminal y 1536
  anduvo.
- Para fondo transparente de verdad hace falta `transparent: true`.
- El modelo por defecto solo saca PNG: con `.jpg` da
  `GENERATION_OUTPUT_FORMAT_MISMATCH`, que es terminal.
- `FILE_NOT_FOUND` en el fetch también es terminal: hay que reenviar la
  generación (de 17 pedidos, 5 nunca existieron).
- `submit_rig3d_generation` lleva como `source_task_id` el `gtask-…` del modelo
  3D. Cada animación (`preset:idle|walk|run|jump`, hasta 5) se cobra aparte, y
  hay que comprobar lo que llegó: en `perro/` las tres volvieron como
  `preset:quadruped:walk`.
- En `submit_retexture_generation`, `text_prompt` e `image_prompt_url` son
  excluyentes.

## Lo que anduvo: 79 lecciones en `estado.json › lo_que_funciono`

No abras el archivo (61 KB): buscá la clave con
`grep -n '"clave"' herramientas/rezona/estado.json`.

- **Pedir bien:** receta_de_prompt, negar_lo_que_no_va,
  cambiar_sujeto_no_insistir, mismo_personaje_ocho_veces,
  referencia_gana_a_la_descripcion, pedir_de_frente, texto_no_se_genera,
  receta_frutiger_aero, fondo_para_vidrio, objeto_blanco_sobre_fondo_oscuro,
  botellas_siluetas.
- **Imágenes:** modelo_por_defecto, tamano_de_salida, size_respeta_la_relacion,
  size_tiene_techo, imagenes_transparentes, iconos_transparentes, peso_para_web,
  fotos_de_producto_pesan_nada, lote_con_faltantes, generador_que_pisa,
  trampa_del_output_path, fetch_generated_asset, upload_project.
- **3D:** modelos_3d_generador (Tripo, 155-185 s), modelos_3d_peso (28-30 MB,
  ~960 mil triángulos), modelos_3d_cadena, modelos_3d_variante_web,
  modelos_3d_variante_web_v2, ratio_fijo_de_simplify_no_sirve,
  modelos_3d_de_uno_en_uno, modelos_3d_no_respeta_medidas,
  modelos_3d_no_miran_a_camara, modelos_3d_sin_transparencia,
  modelos_3d_retexturizar, retextura_se_va_al_naranja,
  imagen_a_3d_pierde_piezas_finas, pose_A_para_imagen_a_3d,
  rig3d_devuelve_tres_presets, pixelar_tapa_la_reconstruccion,
  botellas_solo_geometria.
- **three.js y visor:** gltfloader_no_esta_en_cdnjs, parser_glb_minimo,
  three_copiado_no_cdn, vista_previa_local, blobs_embebidos_como_data_uri,
  encuadre_del_visor, encuadrar_por_todas_las_poses,
  clock_de_three_come_el_delta, mezclar_animaciones_a_mano,
  fondo_animado_shader, cuidado_causticas.
- **CSS y páginas:** cristal_aero_legible, vidrio_de_tres_capas,
  spans_inline_en_las_tarjetas, panel_invisible_come_clics,
  capas_de_barrido_por_apilado, aspect_ratio_infla_min_content,
  rotulo_bajo_las_capas, atajo_padding_pisa_la_caja,
  boton_como_tarjeta_centra_solo, choque_de_nombres_de_clase,
  el_atributo_hidden_se_pisa_solo, posicion_absoluta_pisada,
  ids_duplicados_matan_el_script, meta_viewport, buscador_de_tienda,
  immutable_exige_hash.
- **Fotos, video y redes:** fotos_de_celular_al_navegador, instagram_sin_sesion,
  reels_de_instagram, ffmpeg, h264_en_playwright, capturas_falsas_de_chromium,
  clave_anon_de_supabase.

Los proyectos creados (id, `play_url`, versión) están en
`estado.json › proyectos`. **Anotá ahí cada proyecto nuevo y cada pedido que
salió bien, con sus parámetros:** repetir una tanda cuesta créditos.

- `fetch_generated_asset` no baja en una carpeta sin `.rezona/`: se baja
  con `curl` del `public_url` que da `check_generation_tasks` (con
  `project_id`), y no hace falta nada más.
- Para carrocerías de autos de juego: RUTA 40 (`ruta40.md § El arte`).

## Caídas conocidas

- **22/09/2026:** imagen y audio volvían con `CREDIT_RESERVE_FAILED` ("el
  servicio de cobro no está disponible"), con 446 mil créditos en la cuenta.
  Se probó con dos modelos, dos proyectos y seis reintentos; la subida sí
  andaba. Fuente: `enjambre/README.md`.
- **Antes, en `perro/`:** los efectos y la música aceptaban el pedido y fallaban
  después, durante dos horas de intentos, mientras `kind: "speech"` andaba.
  Fuente: `perro/README.md § El sonido`.
- Por eso, antes de cada tanda se genera una imagen de prueba. El código busca
  cada asset por nombre y tiene su reemplazo dibujado o sintetizado, así lo
  generado entra después sin tocar una línea.

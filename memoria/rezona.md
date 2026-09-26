# Rezona Lab
Fuente: `PAPA-DEL-PATRON.md § 9`. Ver también: [imagenes](imagenes.md).

## La llave

- La credencial es un PAT con prefijo `rz_live_`. Vive en
  `~/.rezona/credentials.json` (directorio 0700, archivo 0600) — **fuera del
  repo, siempre**. Override para CI: `REZONA_PAT`, `REZONA_API_BASE`.
- **La PAT no tiene scope: es la cuenta entera.** El único límite es una lista
  blanca de 9 endpoints del lado del servidor. Una PAT filtrada es la cuenta
  filtrada, no "un permiso de lectura".
- `npx rezona@latest login --no-browser` imprime una URL para aprobar desde otro
  lado, sin que la llave pase por el chat. **Es el camino recomendado.**

## La API (22/9/2026)

- Base de producción: `https://lab.rezona.ai/game/pgcserver`. Desarrollo:
  `devlab.rezona.ai`. Auth por header `Authorization: Bearer …`, **nunca por
  query**: la query cae en los logs del proxy.
- Endpoints, parámetros de generación y trampas: `PAPA-DEL-PATRON.md § 9`.
- Crear y listar proyectos es gratis; solo `POST …/generations` cobra.
- **No hay endpoint para borrar proyectos.** Lo que se crea de prueba, queda.
  Colgados de las pruebas del 22/9: `KCoKOXTfvP` y `xVuxCcKGut`.

## El estado, con fecha

- **23/9/2026: cobra y genera.** El `CREDIT_RESERVE_FAILED` del 22/9 se fue
  solo. Saldo al final del 23/9: **350.577** (otros gastaron ~92 mil ese día;
  esta sesión, 4.455 en Estancia).
- La llave nueva se sacó con el **login por dispositivo, a mano con curl**
  (`npx rezona` lo frena la sesión): `POST https://lab.rezona.ai/tln/biz/cli/authorizations`
  con `{client_name:"rezona-cli", device_name}` → `code`, `authorization_secret`,
  `verification_url`; él aprueba el link y se pollea
  `POST …/authorizations/poll` con `{code, authorization_secret}`.
- **La API no devuelve la URL pública del asset.** Se arma:
  `{base}/pv/{proyecto}/{output_path}` (200 sin llave). **`{proyecto}` es el
  `public_id`** (ej. `RTkRyBVlZq`), no el id numérico: con el número da 404 y
  el `model3d` sale desde texto sin avisar (26/9, Ruta 11: 8 pedidos rehechos).
- Tandas: `control-ruta11/herramientas/rezona/tanda.py pedidos.json` (dependencias
  `@clave`, retoma lo que quedó en vuelo). **No lo mates con
  `pkill -f "tanda.py pedidos.json"`**: el patrón matchea la propia shell (exit 144).
- **De a uno sale mejor** (lo pidió el usuario el 26/9): `control-ruta11/herramientas/rezona/uno.py`
  (imagen → mirarla → modelo → tira de 4 vistas contra el viejo → quedarse con el
  mejor). Prompts que ayudaron: "clean smooth body panels with crisp edges and no
  dents", vista 3/4 "from slightly above", y para árboles "five or six large
  chunky faceted clusters" (se reconstruyen limpios). La 1.ª imagen del
  patrullero salió una F-150 yanqui: se pidió "similar to a 2015 Toyota Hilux".
- Costos con `texture_quality: "detailed"`: imagen 54, modelo **360** (igual que
  standard; medido con el saldo quieto). **La cuenta la usan otros a la vez**
  (~150 créditos/min el 26/9): el "gastado" de una tanda puede incluir lo ajeno.
- `GENERATION_RATE_LIMITED` puede durar más de 3 min: `uno.py` reintenta 8 veces
  cada 120 s.
- Simplificar: el algarrobo (hojas sueltas) no baja con `simplify`; con
  `simplifySloppy` (firma: índices, posiciones, 3, **null**, meta, error) sí
  (7.614 → 2.360), pero de cerca se ve feo: solo de fondo. Sin eso, un
  `model3d` "desde imagen" sale **desde texto** sin avisar: me pasó con la
  vaca y el guacho (1.170 créditos tirados).
- Costos medidos: imagen 54; `model3d` desde texto 234, desde imagen 360;
  `rig3d` con una animación 315–375. `face_limit` se respeta (~19 mil).
- `rig3d`: cuadrúpedos solo `preset:quadruped:walk`. Si se piden varias
  animaciones de bípedo en un pedido, **vuelve solo la última**: una por pedido.
  La carrera del bípedo trae avance de raíz (5 m por vuelta): hay que sacarlo.
- Audio: duración 1–30 s. **El 23/9 a la noche el audio no anduvo nunca**
  ("生成服务暂时不可用", servicio no disponible, sin cobro) en 90 minutos de
  reintentos. Imágenes, 3D y rig sí.
- Los GLB llegan de 10–12 MB por las texturas en PNG 2048: se bajan a ~1 MB
  pasándolas a JPEG 1024 (`estancia/herramientas/procesar_rezona.py`).
- `CREDIT_RESERVE_FAILED` no es falta de saldo (eso es 402).
- El conector MCP de Rezona **puede no estar**: se le pega con `curl`.

## Mientras tanto

Para generar imágenes hay una vía que sí anda: [imagenes](imagenes.md).

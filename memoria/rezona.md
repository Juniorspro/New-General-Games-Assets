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
  `{base}/pv/{proyecto}/{output_path}` (200 sin llave). Sin eso, un
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

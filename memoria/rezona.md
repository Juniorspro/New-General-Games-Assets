# Rezona
Fuente: `herramientas/juegos/GUIA-JUEGOS.md § 1, § 3, § 10`. Ver también: [juegos](juegos.md).

## Acceso
- Login: `printf '%s\n' "$KEY" | npx rezona@latest login --paste --no-browser` → `~/.rezona/credentials.json` (0600, fuera del repo). La key NO se anota acá.
- `npx rezona@latest status` (22/09): 28 proyectos, 446.918 créditos (446.000 gastables).
- El MCP no está cargado en la sesión: se le habla con `python3 herramientas/rezona/rz.py call <tool> '<json>'`.
- Proyecto de la sesión en vivo: "Sesion en vivo", id `lmwlabycvv` (22/09). Los ids viejos de `herramientas/rezona/estado.json` dan `PROJECT_NOT_FOUND` con esta cuenta.

## Caídas
- 22/09/2026 21:38–21:54: `submit_image_generation` → `CREDIT_RESERVE_FAILED` (servicio de cobro caído), 9 intentos. No cobra.

- 23/09 03:39: la key da `PAT_INACTIVE` (rotada o revocada): hace falta una nueva con `login --paste`.

## Repo PGC
- `rezona-ai-pgc/HOLLOWMERE` (único repo de la org, público): juego Babylon hecho en el espacio PGC de Rezona. No trae nada sobre cobros ni `CREDIT_RESERVE_FAILED`; el error es del servidor. Sirve de referencia: `PLAN_ASSETS.md` (plan de assets del skill `rezona-pgc-game-plan-assets`) y `AGENT_CONTRACT.md`.

## Trampas
- `submit_audio_generation.kind` ∈ `auto|speech|music|sound` (no `sfx`).
- El `output_path` que vale es el de la respuesta (`-g1`). `.jpg` con el modelo por defecto es error terminal.
- `fetch_generated_asset`/`upload_project` exigen `.rezona/` en la carpeta. Subir en `dist/datos/`, nunca `dist/assets/`.

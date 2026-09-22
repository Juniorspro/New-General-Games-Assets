# Desplegar y credenciales

Fuente: `ARRANQUE.md § 3`, `§ 4`, `§ 5` y `§ 8`. Ver también:
[sitios](sitios.md), [rezona](rezona.md).

## Credenciales: acá va solo dónde viven, nunca el valor

| archivo | qué es | el 22/09 |
|---|---|---|
| `/root/.cloudflare-iblo` | token de Cloudflare (despliegues y D1) | **no estaba** |
| `/root/.paypal-frutiger-id` / `-secret` | PayPal en vivo | no estaba |
| `/root/.discord-frutiger-id` / `-secret` | Discord OAuth | no estaba |
| `~/.rezona/credentials.json` | Rezona Lab (lo deja `npx rezona@latest login`) | estaba |
| `frutiger-aero/.dev.vars` | secretos locales (gitignoreado) | — |

- Sin el token de Cloudflare no se despliega. Se carga desde la configuración
  del entorno (variables o script de arranque), nunca por el chat.
- Los secretos de producción son secretos de Cloudflare Pages: se escriben, no
  se leen. Un secreto que pasó por el chat se rota.

## Cloudflare Pages

- **Frutiger Aero:** `cd frutiger-aero && export
  CLOUDFLARE_API_TOKEN=$(cat /root/.cloudflare-iblo) && npx wrangler pages
  deploy --branch main`. Sin `--branch main` va a una vista previa sin secretos,
  que contesta `{"error":"sin configurar"}` en todo.
- Después de editar css o js: `python3 sellar.py`. Se edita el archivo que YA
  tiene el hash en el nombre (`ls frutiger-aero/sitio/js/`); escribir a
  `escritorio.js` deja un huérfano.
- D1 `frutiger-social`: esquemas numerados que se aplican en orden, uno nuevo
  por cambio y nunca editando uno viejo. `npx wrangler d1 execute
  frutiger-social --remote --file=…`.
- `wrangler.toml` declara `DB` y `AI`; sin eso llegan vacíos y la API contesta
  503. Las funciones van en `functions/`, al lado del toml.
- **IBLO:** `./desplegar-iblo.sh` arma, despliega y verifica. La portada es
  `iblo.html`, las funciones van en `functions/api/`, y wrangler solo compila
  parado adentro de la carpeta: sin "Compiled Worker successfully", la API da 404.
- Trampas de Pages:
  - una Función corre antes que el estático de su ruta (`context.next()`);
  - `_headers` no se aplica a las Funciones, así que va en `_middleware.js`;
  - un archivo borrado se sigue sirviendo del caché ~23 h: mirá la URL del
    despliegue.
- Trampas de D1:
  - ~1 MB por fila;
  - "sumar 30 días" no es idempotente: columna `ref` única;
  - un esquema local desincronizado da fallas que no parecen lo que son.

## Rezona (subir un juego o una página)

- `upload_project { dir, project_id }` es gratis y necesita `.rezona/` y
  `dist/index.html`. **Saltea la carpeta `assets/` sin avisar**: los assets van
  en `dist/datos/`. Devuelve el `play_url`, que se comprueba con `curl`.
- `publish_to_rezona_app` es irreversible: solo si el dueño lo pide.

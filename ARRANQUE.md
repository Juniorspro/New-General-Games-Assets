# Arranque — para una sesión nueva

Lo que una sesión nueva necesita saber para no repetir vueltas. **Regla de oro:
todo lo que se afirma acá está medido.** Si no se pudo probar, lo dice.

---

## 1. La máquina (la "PC virtual")

Es un contenedor en la nube, no la computadora de nadie. Arranca con el repo ya
clonado y **se borra cuando termina la sesión**.

- **Lo que no se commitea, se pierde.** Archivos en `/tmp`, paquetes
  instalados: todo. Si algo vale la pena, va al repo.
- **El disco es una cuota fija.** `df` miente: "Avail" en 0 con poco "Used"
  quiere decir que se acabó la cuota. Borrar archivos grandes libera al
  instante.
- **No hay SDK de Android** (pesa 2-3 GB): acá no se compila un APK.
- **Roblox Studio no corre acá.** Lo de Roblox se hace en la laptop de quien
  pide; desde acá se escribe el código (Luau) y se sube al repo.

| cosa | dónde / cómo |
|---|---|
| Chromium para Playwright | `/opt/pw-browsers/chromium` (**nunca** `npx playwright install`) |
| Node | v22 |
| Python 3 | Pillow **no** viene: `pip install pillow` |

### La red

Sale por un proxy. `curl` llega a internet; Chromium **no** llega a hosts
externos (las pruebas de navegador van contra `localhost`). Si algo falla con
TLS o da 403/407, mirá `/root/.ccr/README.md`. **Nunca** desactivar TLS ni
sacar `HTTPS_PROXY`.

`pkill -f algo` sale con código 144 si el patrón coincide con su propia línea
y aborta lo que venga detrás con `&&`: corrélo solo.

---

## 2. Qué hay en el repo

| carpeta | qué es |
|---|---|
| `bomba/` | **Bomb Runner Simulator** (el de Roblox), a medio hacer — ver `bomba/README.md` |
| `isla/` | **La Isla** (HTML, three.js) — ver `isla/README.md` |
| `cripta/` | **Cripta Neón** (HTML, pixel art) — ver `cripta/README.md` |
| `vibora/` | **Víbora.io** (HTML, contra bots) — ver `vibora/README.md` |
| `globo/` | **Globo Libre** (HTML, con física propia) — ver `globo/README.md` |
| `morfi/` | **Morfi** (HTML, de cartón y papel, física de hilos propia) — ver `morfi/README.md` |
| `grumo/` | **Grumo** (HTML, plataformas de plastilina en stop motion, trampas como datos y un resolvedor) — ver `grumo/README.md` |
| `guias/` | cómo hacer juegos que se vean bien (3D, 2D pixel art, aeroplaza) |
| `memoria/` | lo que ya se sabe, en notas cortas: se entra por `memoria/INDICE.md` |
| `herramientas/` | Blender sin GPU, Neko, Mint, Rezona, portadas de los juegos, audio |
| `edificio/` | torre de oficinas armada por script en Blender + visor three.js |
| `bot-whatsapp/` | motor de comandos con dos proveedores intercambiables |
| `Prompts/` | colecciones de prompts |

Lo que se borró el 30/09/2026 (juegos HTML viejos, los sitios de Frutiger Aero,
IBLO Eventos y Electro Silver) sigue en el historial de git: se recupera con
`git checkout fbffdfb -- <carpeta>`. Los sitios siguen publicados en Cloudflare.

---

## 3. Los secretos

**Regla dura: ningún secreto entra al repo. Nunca.** Ni en un comentario, ni en
un mensaje de commit, ni en un archivo de ejemplo. Viven fuera del repo, con
permisos 600 (por ejemplo `~/.rezona/credentials.json`).

**Después de cada commit:**

```bash
git grep -nI "cfat_\|sk-\|KGAT_[0-9a-f]\|-----BEGIN"    # que no devuelva nada
```

Si un secreto pasó por el chat alguna vez, **hay que rotarlo**.

**Kaggle (01/10/2026):** no hay conector. Kaggle da ahora un token `KGAT_…`
(kaggle.com → Settings → API), que se pone como variable del entorno de la
nube (menú del entorno en la barra de la sesión → Edit): `KAGGLE_API_TOKEN`.
La toma una sesión nueva. `kaggle.com` responde por el proxy (200); el CLI no
viene instalado: `pip install kaggle` (la 2.2.4 lee `KAGGLE_API_TOKEN`). El
`kaggle.json` con `KAGGLE_USERNAME` y `KAGGLE_KEY` es la forma vieja. En la
sesión del 01/10 quedó en `~/.kaggle/access_token` (600, fuera del repo): se
pierde con el contenedor; la variable del entorno no.

---

## 4. Rezona Lab (generar assets)

Servidor MCP para generar imágenes, sprites, audio y modelos 3D.

1. `create_project` (o `list_projects`): todo lo demás pide un id de proyecto.
2. `submit_*_generation` devuelve un `task_id`; todavía no hay nada en disco.
3. `check_generation_tasks` hasta `ready` o `failed` (no en bucle cerrado).
4. `fetch_generated_asset`: recién ahí aparece el archivo.

Trampas (todas cuestan créditos):
- `fetch_generated_asset` se corre parado en una carpeta con `.rezona/` adentro.
- Vale el `output_path` de la **respuesta** (le agrega `-g1`), no el que mandaste.
- `size` respeta la proporción, no el número: se redimensiona después.
- Fondo transparente de verdad: `transparent: true`.
- Negá lo que no querés ("no text, no watermark"). Cada `submit_*` gasta
  créditos; crear, consultar y bajar es gratis.
- El MCP puede no estar conectado: si no aparece, decilo y seguí sin él.

---

## 5. Cómo se prueba acá

Con Playwright y el Chromium de arriba, contra un servidor local
(`python3 -m http.server 8123` desde la raíz). Sin placa de video: los flags de
SwiftShader y cómo medir están en `memoria/probar.md`.

- **Que un elemento exista no quiere decir que se pueda tocar**: comprobalo con
  `document.elementFromPoint(x, y)`.
- **No calcules coordenadas para hacer clic**: `locator.hover()` o eventos
  directos al elemento.
- **Cada prueba se arma su propio dato**: si depende de otra corrida, miente en
  las dos direcciones.
- **Un resultado raro suele ser la prueba, no el código.**

---

## 6. Trampas del navegador ya pagadas

- `url()` adentro de una variable CSS se resuelve desde la hoja donde la
  variable **se usa**, no desde el documento.
- `background-attachment: scroll` dimensiona `cover` contra el alto del
  contenido: necesita `min-height: 100svh`.
- Una `var` al final de un IIFE es `undefined` para el código de arriba que ya
  corrió.
- El `z-index` no alcanza contra un `sticky` de otro contexto de apilamiento:
  muchas veces hay que correrlo, no subirle el número.

---

## 7. Cómo trabajar acá

- **Los comentarios explican POR QUÉ, no qué.**
- **Todo en castellano rioplatense**, código y comentarios incluidos.
- **Medí antes de afirmar.** "Anda" sin un número al lado no vale.
- **Decí lo que no se pudo hacer**, con el motivo.
- **Nunca pongas el identificador del modelo** en commits, código ni nada del
  repo.
- La rama de trabajo la da cada sesión; commit y push a esa rama.

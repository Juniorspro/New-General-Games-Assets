<!-- BEGIN rezona (managed; edits inside this block are overwritten) -->
## Rezona game assets (managed by `rezona init`)

This project is wired to Rezona Lab's MCP server. Use its tools instead of inventing your own
asset pipeline:

- `create_project` / `list_projects` — a project id is required by every other tool.
- `submit_image_generation` / `submit_video_generation` / `submit_audio_generation` /
  `submit_sprite_generation` / `submit_model3d_generation` / `submit_rig3d_generation` /
  `submit_retexture_generation` — each returns a `task_id` immediately; **nothing is on disk yet**.
- `check_generation_tasks` — poll until items are `ready` or `failed`. Do not busy-wait.
- `fetch_generated_asset` — writes a ready asset into this directory and returns its path.
  Pass the `output_path` **from the response**, not the one you submitted: the server appends a
  generation segment (`assets/hero.png` → `assets/hero-g1.png`).
  It also returns a `public_url`. **To generate from an asset you already made** (image-to-image,
  a video's first frame, a 3D reference), pass that `public_url` as `source_url` /
  `source_urls` — do not ask the user for a link, and do not upload it anywhere. That URL is
  public and unauthenticated, so treat it as shareable, not secret.

- `upload_project` — pack this directory and upload it as a playable version; needs a completed
  build (`dist/index.html`). `open_workbench` — show the user the project page.
- `publish_to_rezona_app` — put a built version in front of other people, under the user's real
  Rezona identity. **Only when the user asks for it.** It cannot be undone: the first publish also
  creates a permanent account binding that cannot be unbound or moved. Defaults to private — pass
  `public: true` only if they said so.

The shape of a finished game, so the loop is not left half-done: generate assets → reference them
in code → build to `dist/index.html` → `upload_project`, then hand the user the `play_url` it
returns. Building alone shows the game to no one; the upload is what produces a link they can open,
so treat "the game builds and runs" as the moment to offer it, not the end. This is a suggestion,
not a gate — do not upload half-built experiments or on every rebuild, and never publish without
being asked.

Build the game with whatever stack you like — plain canvas, Vite + React, Three.js, your own
engine. `upload_project` asks for exactly one thing, `dist/index.html`; there is no required
framework, no private package to install, and no manifest to write. Do not stop to ask the user
which engine to use, and do not report a missing dependency as a blocker: pick one and build.

Costs credits: every `submit_*` call. Free: creating/listing projects, polling, downloading,
uploading, opening the workbench.

If a tool says the API key is invalid or missing, ask the user to run `npx rezona@latest login`.
Do not retry terminal errors — the tool result says whether a retry can help.
<!-- END rezona -->

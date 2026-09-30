# New General Games Assets

Juegos y herramientas. Ahora mismo lo principal es **Bomb Runner Simulator**
(`bomba/`), el juego de Roblox que se está haciendo en Roblox Studio.

> Una sesión de Claude Code arranca por [`memoria/INDICE.md`](memoria/INDICE.md)
> (lo dice [`CLAUDE.md`](CLAUDE.md)); cómo se mantiene esa memoria está en
> [`MEMORIA.md`](MEMORIA.md). Cómo se trabaja en la máquina: [`ARRANQUE.md`](ARRANQUE.md).

## Qué hay

| carpeta | qué es |
|---|---|
| `bomba/` | Bomb Runner Simulator: correr con una bomba, explotar, mascotas y renacer (a medio hacer) |
| `cripta/` | CRIPTA NEÓN, de JXSTUDIOS: laberinto que se desliza en pixel art; se juega con `cripta-en-un-archivo.html` |
| `vibora/` | VÍBORA.IO, de JXSTUDIOS: víboras que comen y crecen contra bots, sin red; se juega con `vibora-en-un-archivo.html` |
| `guias/` | cómo hacer juegos que se vean bien: 3D con Rezona, 2D pixel art y la receta de AEROPLAZA |
| `memoria/` | lo que ya se sabe, en notas cortas para que cada sesión no relea el repo |
| `herramientas/` | Blender sin GPU, Neko, Mint, Rezona, audio |
| `edificio/` | una torre de oficinas armada por script en Blender + visor three.js |
| `bot-whatsapp/` | motor de comandos con dos proveedores intercambiables |
| `Prompts/` | colecciones de prompts (finanzas, diseño web, skills de UI) |

Lo que se sacó el 30/09/2026 (los juegos HTML viejos, entre ellos La Isla, y
el código de Frutiger Aero, IBLO Eventos y Electro Silver) queda en el
historial: `git checkout fbffdfb -- <carpeta>` lo trae de vuelta.

## Las reglas

- **Ningún secreto entra al repo.** Después de cada commit,
  `git grep -nI "cfat_\|-----BEGIN"` tiene que volver vacío.
- **Los comentarios explican POR QUÉ, no qué.**
- **Medí antes de afirmar.** "Anda" sin un número al lado no vale.
- **Decir lo que no se sabe.**
- **Todo en castellano rioplatense**, código y comentarios incluidos.

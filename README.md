# New General Games Assets

Continuación de `Juniorspro/General-Assets-Games`. Acá está **el código y la
documentación**: los sitios que andan, las herramientas y los proyectos 3D.

> **Empezá por acá:** [`ARRANQUE.md`](ARRANQUE.md) dice **cómo se trabaja**
> (la máquina, las trampas ya pagadas, cómo se despliega). [`ESTADO.md`](ESTADO.md)
> dice **qué hay construido** (cada página, cada endpoint, cada tabla).
> Una sesión nueva debería leer los dos, en ese orden.

## Qué hay

| carpeta | qué es | dónde vive |
|---|---|---|
| `frutiger-aero/` | un escritorio estilo Windows Vista en el navegador: cuentas, muro social, zona de donantes, tienda de apps | frutiger-aero-86q.pages.dev |
| `docs/paginas/` | **IBLO Eventos** — sitio de una productora, con panel de administración | iblo-eventos.pages.dev |
| `docs/biblioteca/` | la galería / biblioteca | — |
| `electro-silver/` | sitio de Electro Silver (Presidencia Roca, Chaco) | electro-silver.pages.dev |
| `telarana/` | juego de un botón: colgarse de un hilo y recorrer una ciudad | — |
| `tajo/` | juego de ritmo 3D: cortás bloques al ritmo dibujando el tajo con el dedo (dragón de neón, 3 canciones propias, "tu canción") | se arma con `python3 tajo/empaquetar.py` |
| `edificio/` | una torre de oficinas armada por script en Blender + visor three.js | — |
| `bot-whatsapp/` | motor de comandos con dos proveedores intercambiables | — |
| `iblo-eventos/` | material de IBLO: imágenes, publicaciones, investigación | — |
| `modelos-cdn/` | modelos GLB de IBLO, con el hash en el nombre | — |
| `herramientas/` | Blender sin GPU, Neko, Mint, Rezona, IBLO | — |
| `Prompts/` | colecciones de prompts (finanzas, diseño web, skills de UI) | — |

## Desplegar

```bash
export CLOUDFLARE_API_TOKEN=$(cat /root/.cloudflare-iblo)

# Frutiger Aero — el --branch main no es opcional: sin él va a vista previa
cd frutiger-aero && npx wrangler pages deploy --branch main

# IBLO — arma, despliega y verifica en un comando
./desplegar-iblo.sh
```

Las trampas de cada uno están explicadas en `ARRANQUE.md`, con el motivo.

## Las reglas

Ninguna es una preferencia: cada una viene de un bug que pasó.

- **Ningún secreto entra al repo.** Nunca. Después de cada commit:
  `git grep -nI "cfat_\|-----BEGIN"` tiene que volver vacío.
- **Los comentarios explican POR QUÉ, no qué.** Son la memoria del proyecto.
- **Medí antes de afirmar.** "Anda" sin un número al lado no vale.
- **La pantalla no decide nada.** Toda puerta se pregunta en el servidor.
- **Decir lo que no se sabe.** "No lo conoce" no se pinta de verde.
- **Todo en castellano rioplatense**, código y comentarios incluidos.

## Lo que quedó afuera de este repo

Del repo viejo **no** se trajo el material pesado, que sigue estando allá:

| qué | tamaño | por qué |
|---|---|---|
| 93 binarios sueltos en la raíz: texturas PBR, modelos GLB, ROMs, mp3 | 487 MB | assets, no código |
| `splat-ciudad/` — nube de puntos de una ciudad | 139 MB | idem |

Si hacen falta, se traen: están en
`Juniorspro/General-Assets-Games`, rama `claude/patron-2-93yeb9`.

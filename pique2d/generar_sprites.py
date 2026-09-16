#!/usr/bin/env python3
"""Genera las hojas de sprites pixel art de Pique.

    python3 generar_sprites.py pedir     # manda todas las hojas
    python3 generar_sprites.py bajar     # espera y descarga
    python3 generar_sprites.py estado

EL CONTRATO DE UNA HOJA, que es lo que la hace usable (sale del propio kit):

  * UNA hoja = UN movimiento. Nueve celdas del MISMO bicho, MISMO angulo,
    MISMA direccion, en nueve momentos seguidos. Mezclar caminar y saltar en
    una hoja la rompe sin importar como se la corte despues.
  * Los modelos obedecen las prohibiciones mucho mejor que las descripciones:
    "no two cells may hold the same pose" rinde mas que "que cambien".
  * `transparent: true` y que la plataforma recorte el fondo. Nada de elegir
    un color y recortarlo a mano.
  * Y despues se MIDE: cuadros repetidos y lineas de division dibujadas en el
    borde de las celdas son las dos fallas que no se ven en una miniatura y
    arruinan la animacion. Las mide comprobar_hojas.py.
"""
import json, pathlib, subprocess, sys, time

AQUI = pathlib.Path(__file__).parent
RZ = AQUI.parent / "herramientas" / "rezona" / "rz.py"
PROYECTO = "EUDERiogqd"
PEDIDOS = AQUI / "assets" / "hojas.json"

# Ancla de estilo: identica en TODOS los prompts, o cada hoja sale de otro juego.
ANCLA = ("16-bit pixel art sprite, chunky readable pixels, hard black outline, "
         "flat cel shading with two shade steps, limited palette of amber #ffb43a, "
         "deep teal #2a7f8f, cream #f4e4c1 and dark brown #3a2418, "
         "no anti-aliasing, no gradients, no blur, no text, no watermark")

# El contrato de grilla. Va al final de cada prompt, entero.
def grilla(cols, filas):
    n = cols * filas
    return f"""

Arrange as a uniform {cols}x{filas} grid spritesheet ({n} cells total), read row-major
(left-to-right, then top-to-bottom). Exactly {n} drawings, no more, no fewer.

CONSTANT across all {n} cells: the same character (same identity, proportions,
palette), the same camera angle, the same facing direction, the same scale and
placement inside the cell.

CHANGING across the {n} cells: the pose only — limb positions, body tilt, tail or
antenna angle — advancing in small increments so cells 1 to {n} read as one
continuous motion cycle that loops back from {n} to 1.

All {n} cells must be visually distinguishable at a glance. No two cells may hold
the same pose, a mirrored copy of the same pose, or a near-identical pose.
Repeating a pose is a failure of the sheet.

Equal-size cells arranged edge-to-edge. Do NOT draw grid lines, borders,
dividers or frames between cells — leave a generous EMPTY margin around the
subject inside each cell instead. No text labels, no cell numbers.

There is NO line, NO stroke and NO change of tone anywhere along the cell
boundaries: the cells touch invisibly. A drawn divider makes the sheet
unusable, because the slicer bakes it into every frame as a box around the
sprite.

Count the cells before finishing: exactly {n} poses, each one different from the
other {n - 1}. If two cells would look the same, change one of them."""

# Los personajes son ORIGINALES. Cada prompt niega el parecido.
SUJETO = {
 # Acortado: el servidor corta los prompts en 2000 caracteres, y con el
 # contrato de grilla reforzado el del heroe se pasaba. Se recorta la
 # descripcion, NO las negaciones: son las que evitan el parecido.
 "heroe":  ("a small original cartoon creature: stocky round body, big dome goggle over the upper "
            "face, long trailing scarf, chunky boots, no mouth; amber jacket, teal scarf, cream "
            "goggle. NOT a human, NOT a plumber, no moustache, no cap, no overalls"),
 "bolo":   ("a small round mossy boulder creature with two stubby stone legs and two round glowing "
            "eyes, grumpy. It is a ROCK, not a mushroom, not a chestnut, no cap, no stem"),
 "caracol":("an armoured snail creature with a thick faceted amber shell, short teal body and two eye "
            "stalks. It is a SNAIL, not a turtle, no beak, no shoes, no wings"),
 "aleta":  ("a floating jellyfish creature with two stubby side fins and a translucent teal bell and "
            "small round eyes. It is a JELLYFISH, not a turtle, no shell, no feathered wings"),
 "erizo":  ("a spiky burr creature, dark round body completely covered in sharp cream spikes, two "
            "angry eyes peeking between the spikes, four tiny legs. Not a hedgehog mascot, no shoes"),
 "fauces": ("a toothed carnivorous flower with thick amber petals and a ring of cream fangs on a short "
            "teal stalk. It is a PLANT, not a snake, no eyes, no leaves with faces"),
 "osario": ("a small stack of chunky cartoon bones assembled into a two-legged creature with a rounded "
            "skull and hollow eye sockets, friendly not gory, no blood, not scary"),
 "vela":   ("a floating ghostly flame wisp with a soft round teal-white glowing body, two dark simple "
            "eyes and a trailing tail of light. Not a sheet ghost, no arms, no tongue"),
 "perno":  ("a flying metal bolt projectile, blunt amber capsule with small fins at the back and a "
            "single glowing cream eye at the front. It is a BOLT, not a bullet, no flames"),
 "brasa":  ("a round blob of molten lava with a bright cream-hot core and a small mischievous face. "
            "Not a sun, no arms, no legs"),
 "yunque": ("an original armoured brute boss, heavy squat body plated in dark metal with amber rivets, "
            "two thick arms, blunt helmet with a narrow visor slit. Not a turtle, no shell, no horns"),
 "coloso": ("an original huge boss, broad stone-and-metal colossus with a cracked amber core glowing "
            "in its chest, heavy shoulders, short legs, glowing slit eyes. Not a dragon, not a turtle, "
            "no shell, no fire breath, no horns"),
}

# clave -> (sujeto, movimiento, cols, filas, tamano)
#
# TODAS en 4x4 = 16 cuadros, y la razon es medible: el servidor IGNORA el
# `size` que se le pide y entrega 1024x1024 siempre. 1024 no divide en 3
# (341,33 px por celda), asi que toda hoja de 3x3 sale con las celdas corridas
# y el control la rechaza — 16 de 17 fallaron por esto en la primera tanda.
# 1024/4 = 256 exacto. Ademas 16 cuadros son casi el doble de suaves que 9.
HOJAS = {
 "heroe_correr":  ("heroe", "running fast to the right, side view, scarf streaming behind, legs cycling, arms pumping", 4, 4, "2048x2048"),
 "heroe_saltar":  ("heroe", "one jump arc seen from the side facing right: crouch, launch, rise, apex, fall, land", 4, 4, "2048x2048"),
 "heroe_quieto":  ("heroe", "standing still facing right, breathing gently, scarf swaying, tiny idle bob", 4, 4, "2048x2048"),
 "bolo_caminar":  ("bolo", "waddling to the right, side view, stubby legs stepping", 4, 4, "2048x2048"),
 "caracol_caminar":("caracol","gliding to the right, side view, body rippling, eye stalks swaying", 4, 4, "2048x2048"),
 "caracol_concha":("caracol", "an empty amber shell spinning fast, side view, rotating a little more each cell", 4, 4, "2048x2048"),
 "aleta_volar":   ("aleta", "hovering and bobbing in place facing right, fins flapping", 4, 4, "2048x2048"),
 "erizo_caminar": ("erizo", "scuttling to the right, side view, tiny legs stepping, spikes quivering", 4, 4, "2048x2048"),
 "fauces_morder": ("fauces", "seen from the SIDE facing right, rising out of a pipe and snapping its "
                   "jaws open and shut once, stalk stretching up then down", 4, 4, "2048x2048"),
 "osario_caminar":("osario", "walking to the right, side view, bones clacking, arms swinging", 4, 4, "2048x2048"),
 "vela_flotar":   ("vela", "drifting and pulsing in place facing right, tail of light waving", 4, 4, "2048x2048"),
 "perno_volar":   ("perno", "flying left at speed, side view pointing left, fins vibrating, slight bob", 4, 4, "2048x2048"),
 "brasa_saltar":  ("brasa", "one leap arc: squash, launch, rise, apex, fall, splash", 4, 4, "2048x2048"),
 "yunque_caminar":("yunque", "stomping to the right, side view, heavy arms swinging", 4, 4, "2048x2048"),
 "coloso_caminar":("coloso", "stomping to the right, side view, core pulsing, shoulders rolling", 4, 4, "2048x2048"),
}

# Objetos sin personaje: misma mecanica, otro sujeto.
# Piezas sueltas, sin animacion: son una sola imagen cada una. Los tubos se
# dibujaban a mano con rectangulos y quedaban como mesas — un cuerpo teal con
# una tapa ambar flotando arriba. Un tubo es una pieza con boca y cuerpo, y
# tiene que dibujarse como tal.
PIEZAS = {
 "tubo_boca":   ("the TOP MOUTH of a thick industrial pipe seen from the side: a wide rectangular "
                 "rim with a raised lip, teal metal body with an amber rim band and two rivets, "
                 "dark round opening in the middle, flat side view, isolated, fills the image"),
 "tubo_cuerpo": ("the STRAIGHT BODY SEGMENT of a thick industrial pipe seen from the side: a plain "
                 "vertical teal metal column with a bright highlight stripe on the left and a dark "
                 "stripe on the right, no rim, no opening, tileable vertically, flat side view, "
                 "isolated, fills the image"),
 "icono_moneda": ("a single game coin icon, thick amber disc with cream bevel and a spiral emblem, "
                  "front view, isolated, fills the image"),
 "icono_burbuja":("a single soap bubble icon, pale cyan sphere with a white highlight, isolated, "
                  "fills the image"),
 "icono_reloj":  ("a single stopwatch icon, cream body with an amber rim and a dark needle, front "
                  "view, isolated, fills the image"),
}

def pedir_piezas():
    for k, desc in PIEZAS.items():
        if k in cargar(): print(f"  · {k}: ya pedido"); continue
        r = rz("submit_image_generation", {
            "project_id": PROYECTO, "output_path": f"assets/{k}.png",
            "size": "1024x1024", "transparent": True,
            "prompt": (f"{desc}. Single object, centred, generous empty margin, no grid, "
                       f"no borders, no other objects. {ANCLA}")})
        if "task_id" not in r: print(f"  ✗ {k}: {r}"); continue
        anotar(k, {"task_id": r["task_id"], "output_path": r["output_path"], "cols": 1, "filas": 1})
        print(f"  ✓ {k}")


OBJETOS = {
 "moneda_girar": ("a thick amber game coin with a bevelled cream edge and a spiral emblem, "
                  "spinning around its vertical axis, seen edge-on to fully face-on and back", 4, 4, "2048x2048"),
 "resorte_saltar": ("a jump pad: wide cream metal plate on a thick amber coil spring bolted to a dark "
                    "base, compressing and releasing once, side view", 4, 4, "2048x2048"),
}


# Tiles pixel art. Personajes pixelados sobre un mundo suave se ve peor que
# las dos cosas por separado: el ojo compara y el personaje parece pegoteado.
# Una hoja por tema con superficie y corte, en la MISMA paleta que los sprites.
TILES = {
 "llano":    "grass-topped earth: a strip of lush grass over dark soil with pebbles and roots",
 "subte":    "cut stone blocks, cool blue-grey, with mortar lines and damp mineral veins",
 "castillo": "dark volcanic brick, deep grey-violet blocks with thin glowing ember cracks",
 "desierto": "wind-carved sandstone, warm ochre and cream, layered and grainy",
 "cielo":    "soft white cloud-stone, pale cream with gentle blue shadow",
 "nave":     "weathered ship deck planks, warm brown wood with iron nail heads",
 "torre":    "polished violet tower stone, hexagonal blocks with faint glowing seams",
 "fantasma": "old haunted floorboards, dark violet wood with pale dust and cobwebs",
}

def pedir_tiles():
    for k, desc in TILES.items():
        clave = "tile_" + k
        if clave in cargar(): print(f"  · {clave}: ya pedido"); continue
        r = rz("submit_image_generation", {
            "project_id": PROYECTO, "output_path": f"assets/{clave}.png",
            "size": "1024x1024", "transparent": False,
            "prompt": (f"A seamless tileable pixel-art terrain texture: {desc}. "
                       f"Flat orthographic top-down view, even lighting, no shadows cast, "
                       f"no objects on top, no sky, no characters. "
                       f"Seamless tileable texture, no border vignette, edges continue "
                       f"perfectly, no grid lines, no borders. {ANCLA}")})
        if "task_id" not in r: print(f"  ✗ {clave}: {r}"); continue
        anotar(clave, {"task_id": r["task_id"], "output_path": r["output_path"], "cols": 1, "filas": 1})
        print(f"  ✓ {clave}")


def rz(nombre, args, timeout=900):
    r = subprocess.run([sys.executable, str(RZ), "call", nombre, json.dumps(args)],
                       cwd=AQUI, capture_output=True, text=True, timeout=timeout)
    s = r.stdout.strip()
    try: return json.loads(s[s.index("{"):])
    except Exception: return {"error": (s or r.stderr)[-400:]}


def cargar(): return json.loads(PEDIDOS.read_text()) if PEDIDOS.exists() else {}

def anotar(k, v):
    # Se RELEE el archivo justo antes de escribir. Sin esto, dos procesos a la
    # vez —uno pidiendo y otro bajando— pierden lo que escribio el otro: el que
    # guarda ultimo pisa el archivo con la version que leyo al empezar. Paso de
    # verdad y se perdieron nueve pedidos ya pagados.
    d = cargar(); d[k] = {**d.get(k, {}), **v}
    PEDIDOS.parent.mkdir(exist_ok=True)
    PEDIDOS.write_text(json.dumps(d, indent=2, ensure_ascii=False))


def pedir():
    todo = {}
    for k, (suj, mov, c, f, tam) in HOJAS.items():
        todo[k] = (f"{SUJETO[suj]}, {mov}. {ANCLA}{grilla(c, f)}", c, f, tam)
    for k, (desc, c, f, tam) in OBJETOS.items():
        todo[k] = (f"{desc}. {ANCLA}{grilla(c, f)}", c, f, tam)
    for k, (prompt, c, f, tam) in todo.items():
        if k in cargar(): print(f"  · {k}: ya pedido"); continue
        r = rz("submit_image_generation", {
            "project_id": PROYECTO, "output_path": f"assets/{k}.png",
            "prompt": prompt, "size": tam, "transparent": True})
        if "task_id" not in r: print(f"  ✗ {k}: {r}"); continue
        anotar(k, {"task_id": r["task_id"], "output_path": r["output_path"],
                   "cols": c, "filas": f})
        print(f"  ✓ {k}: {c}x{f} = {c*f} cuadros")


def bajar():
    d = cargar()
    for v in range(120):
        pend = [k for k, x in d.items() if x.get("estado") not in ("ready", "failed")]
        if not pend: break
        r = rz("check_generation_tasks", {"task_ids": [d[k]["task_id"] for k in pend][:100],
                                          "project_id": PROYECTO})
        for it in r.get("items", []):
            for k in pend:
                if d[k]["task_id"] == it["task_id"]:
                    d[k]["estado"] = it["status"]
                    if it.get("asset_path"): d[k]["output_path"] = it["asset_path"]
                    if it.get("error") or it.get("failure"): d[k]["error"] = it.get("error") or it.get("failure")
        for k2, v2 in d.items(): anotar(k2, v2)
        listos = sum(1 for x in d.values() if x.get("estado") == "ready")
        print(f"  vuelta {v+1}: {listos}/{len(d)} listos", flush=True)
        if listos == len(d): break
        time.sleep(12)
    for k, x in d.items():
        if x.get("estado") != "ready" or x.get("local"): continue
        r = rz("fetch_generated_asset", {"project_id": PROYECTO, "output_path": x["output_path"]})
        if "absolute_path" in r:
            x["local"] = r["absolute_path"]; x["public_url"] = r["public_url"]
            print(f"  ↓ {k}: {r['bytes']//1024} KB")
        else: print(f"  ✗ {k}: {r}")
        anotar(k, x)


modo = sys.argv[1] if len(sys.argv) > 1 else "estado"
if modo == "pedir": pedir()
elif modo == "tiles": pedir_tiles()
elif modo == "piezas": pedir_piezas()
elif modo == "bajar": bajar()
else:
    d = cargar()
    print(f"{len(d)} hojas · {sum(1 for x in d.values() if x.get('local'))} bajadas")
    for k, x in sorted(d.items()):
        print(f"  {'↓' if x.get('local') else '…'} {k:18} {x.get('cols')}x{x.get('filas')} "
              f"{x.get('estado','pendiente')} {x.get('error','')}")

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


# La misma ley, en un tercio del espacio. EXISTE POR UN LIMITE MEDIBLE: el
# servidor rechaza cualquier prompt de mas de 2000 caracteres, y el contrato
# largo se come 1341 — con una descripcion de movimiento detallada (el
# somersault, la flor abriendo de a poco) el pedido no entra y vuelve un
# VALIDATION_ERROR. No se saca NINGUNA regla: se saca la repeticion. Las dos
# que no se pueden tocar son "ninguna pose repetida" y "ninguna linea en el
# borde de la celda", que son las dos fallas que el control numerico mide.
def grilla_corta(cols, filas):
    n = cols * filas
    return f"""

Arrange as a uniform {cols}x{filas} grid spritesheet, {n} cells, read row-major. Exactly
{n} drawings. CONSTANT in all {n}: the same character, proportions, palette, camera
angle, facing direction, scale and placement inside the cell. CHANGING: the pose
only, advancing in small increments so cells 1 to {n} read as one continuous motion.
All {n} poses must differ at a glance — no cell may repeat, mirror or nearly repeat
another. Cells touch edge to edge with NO drawn line, stroke, border, divider,
frame, label or number anywhere near the cell boundaries: a drawn divider makes
the sheet unusable. Leave a generous empty margin around the subject inside each
cell."""

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
 "fauces": ("a tall carnivorous plant: one LONG straight vertical teal stalk that runs from the very "
            "bottom edge of the cell up to the top, with a big toothed head at the TOP whose jaws open "
            "UPWARD toward the sky; thick amber petals around the mouth, a ring of cream fangs, dark "
            "red gullet. It is a PLANT, not a snake, no eyes, no arms, no leaves with faces"),
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
 # Tres saltos, TRES HOJAS distintas. Repetir la hoja del primero y girarla
 # a mano se ve como lo que es: el mismo dibujo dando vueltas. Cada salto se
 # reconoce por su animacion antes que por la altura, que es lo que hace que
 # encadenar tres se sienta como tres cosas y no como una repetida.
 "heroe_doble":   ("heroe", "one full FORWARD SOMERSAULT in mid-air, side view facing right, the whole body "
                   "rotating a steady 360 degrees head-over-heels across the 16 cells (cell 1 upright, "
                   "cell 5 head down forward, cell 9 upside down, cell 13 head up backward, cell 16 almost "
                   "upright again), knees tucked to the chest, scarf whipping around the body", 4, 4, "2048x2048"),
 "heroe_triple":  ("heroe", "one showy BACKFLIP at the top of a very high jump, side view facing right, the "
                   "body rotating a steady 360 degrees BACKWARDS across the 16 cells, arms thrown out wide, "
                   "back arched, legs kicking out straight, the long scarf spiralling behind in a wide "
                   "ribbon. Clearly a backward rotation, the opposite way to a forward roll", 4, 4, "2048x2048"),
 "heroe_quieto":  ("heroe", "standing still facing right, breathing gently, scarf swaying, tiny idle bob", 4, 4, "2048x2048"),
 "bolo_caminar":  ("bolo", "waddling to the right, side view, stubby legs stepping", 4, 4, "2048x2048"),
 "caracol_caminar":("caracol","gliding to the right, side view, body rippling, eye stalks swaying", 4, 4, "2048x2048"),
 "caracol_concha":("caracol", "an empty amber shell spinning fast, side view, rotating a little more each cell", 4, 4, "2048x2048"),
 "aleta_volar":   ("aleta", "hovering and bobbing in place facing right, fins flapping", 4, 4, "2048x2048"),
 "erizo_caminar": ("erizo", "scuttling to the right, side view, tiny legs stepping, spikes quivering", 4, 4, "2048x2048"),
 # LA APERTURA ES MONOTONA, Y NO ES UN CAPRICHO. Un ciclo de abrir-y-cerrar
 # en dieciseis celdas tiene las poses repetidas de a pares —la boca a medio
 # abrir subiendo se dibuja igual que bajando— y el control numerico rechaza
 # la hoja por cuadros duplicados, con razon. Se pide abrir de cero a tope y
 # nada mas: dieciseis poses todas distintas. El cierre lo hace el juego
 # leyendo la hoja de ida y de vuelta.
 "fauces_morder": ("fauces", "seen from the SIDE facing right, the stalk perfectly still and vertical while "
                   "the jaws at the TOP open wider and wider: cell 1 has the mouth completely shut, each "
                   "cell opens it a little more, cell 16 has the jaws at their widest gape pointing up. "
                   "The stalk is IDENTICAL in every cell — same length, same thickness, same position. "
                   "Only the jaws move. Never close the mouth again", 4, 4, "2048x2048"),
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
# OJO CON EL "ENCIMA DE". Estas texturas se usan como PATRON CORRIDO: se
# repiten cada pocos tiles en las dos direcciones, asi que cualquier cosa que
# este arriba del todo reaparece cada dos tiles HACIA ABAJO. La primera version
# del llano decia "una franja de pasto sobre tierra oscura" y bajo tierra
# salian franjas de pasto cada dos tiles, como un pancho. La superficie la
# dibuja el codigo (el borde de 3 pixeles en tiles()); la textura tiene que ser
# el MATERIAL, parejo y sin arriba ni abajo.
TILES = {
 "llano":    "packed dark brown earth, uniform all over, with small pebbles, grit and bits of root "
             "scattered evenly in every direction, no grass, no surface layer, no horizon",
 "subte":    "cut stone blocks, cool blue-grey, with mortar lines and damp mineral veins",
 "castillo": "dark volcanic brick, deep grey-violet blocks with thin glowing ember cracks",
 # Estas dos salieron con formas GRANDES —lobulos de arenisca, nubes de piedra
 # del tamano de un tile— y repetidas cada cuatro tiles se leen como una
 # estampilla, no como material. Lo que funciona en una textura de terreno es
 # el grano chico y parejo: se repite y nadie lo nota.
 "desierto": "coarse desert sand and grit, warm ochre and cream, very fine even grain, tiny "
             "scattered pebbles, no dunes, no ripples, no large shapes, no layers",
 "cielo":    "dense packed white cloud material, pale cream with soft blue shadow, fine even "
             "puffy grain all over, small uniform tufts, no large clouds, no sky, no horizon",
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


# --- fondos en capas ------------------------------------------------------
# Tres capas por tema. Una sola imagen de fondo se ve plana; tres a distinta
# velocidad dan profundidad de verdad, y es lo que hace que el cielo —que en
# vertical ocupa dos tercios de la pantalla— valga la pena mirarlo.
#
# Las tres van SIN transparencia la de atras (es el cielo) y CON las otras dos.
FONDOS = {
 "llano":    ("a bright late-morning summer sky: deep blue at the top fading to warm pale cyan at the "
              "horizon, three big soft cumulus clouds with sunlit cream tops and cool blue undersides, "
              "thin wisps higher up, a flock of tiny birds",
              "a range of rolling green hills receding into haze, layered in three tones of green fading "
              "to blue-grey, dotted with tiny round trees, a windmill on one crest and a far church spire",
              "a dense band of forest treetops seen from the side: round leafy crowns in two greens, dark "
              "trunks, bushes and tall grass along the bottom"),
 "subte":    ("the black-blue void of a deep cavern, clusters of glowing cyan spores drifting, one dim "
              "shaft of pale light falling from far above",
              "distant cavern walls receding into blue darkness, long stalactites above and stalagmites "
              "below, glowing cyan and violet mineral veins, a still underground lake reflecting them",
              "a band of rough dark rock: jagged boulders, cracked columns, dripping wet stone and "
              "clusters of glowing crystals"),
 "cielo":    ("a luminous high-altitude sky, white at the horizon rising to soft blue, a warm sun flare "
              "and thin cirrus streaks",
              "a sea of thick white cloud banks below, distant snow mountain peaks poking through, small "
              "floating rocky islets trailing wisps of cloud",
              "a band of billowing cumulus cloud tops in cream and pale blue with a few floating stone "
              "platforms and hanging vines"),
 # El cielo del castillo salio con el tercio de abajo en BLANCO LISO: el
 # modelo dejo el area sin pintar. Se le pide explicitamente que llegue hasta
 # el borde de abajo, que es lo unico que no habia dicho.
 "castillo": ("a burning red-black sky filling the WHOLE frame from the very top edge to the very "
              "bottom edge, thick rolling smoke, drifting orange embers, a dark red sun low down, "
              "the glow getting hotter and brighter toward the bottom edge. No blank area, no white "
              "space, no empty band, every pixel painted",
              "distant volcanic mountains with rivers of glowing lava running down them, ash plumes and "
              "a jagged black fortress silhouette",
              "a band of dark stone battlements with iron spikes, hanging chains and braziers with small "
              "flames"),
 "fantasma": ("a deep violet night sky, a big pale moon behind thin clouds, faint stars, low ground mist",
              "distant bare dead trees, a crooked haunted mansion silhouette with two lit yellow windows, "
              "a rusted iron fence and rolling fog",
              "a band of gnarled dark branches, hanging moss, crooked gravestones and thick fog"),
 "desierto": ("a warm orange and pink sunset sky, a huge low sun, long thin stretched clouds, heat haze",
              "distant sand dunes and flat-topped mesas layered in ochre and violet, a ruined stone arch "
              "and a tiny cluster of palms",
              "a band of near dunes with dry shrubs, tall cactus silhouettes, bleached bones and "
              "wind-blown sand"),
 "nave":     ("a stormy blue-grey sky, heavy layered storm clouds, a distant fork of lightning, rain haze",
              "distant wooden airships with patched sails and balloons floating in the haze, spinning "
              "propellers, a far mountain ridge below",
              "a band of ship rigging and masts with furled sails, iron plating and hanging lanterns"),
 "torre":    ("a twilight violet sky with two small moons, a scatter of stars and faint aurora ribbons",
              "distant tall slender spires and towers fading into violet haze, joined by thin bridges, "
              "warm lit windows",
              "a band of carved stone tower walls with arched windows, hanging banners, buttresses and "
              "glowing runes"),
}

def pedir_fondos():
    capas = ["cielo", "lejos", "cerca"]
    for tema, tres in FONDOS.items():
        for i, desc in enumerate(tres):
            clave = f"fondo_{tema}_{capas[i]}"
            if clave in cargar(): print(f"  · {clave}: ya pedido"); continue
            # La capa del cielo es opaca y llena; las otras dos se recortan
            # para que se vea lo de atras.
            transp = i > 0
            extra = ("horizontally seamless, the left edge continues into the right edge, "
                     "no border, no vignette, nothing in the lower quarter, "
                     "one single parallax layer of a side-scrolling game background, "
                     "richly detailed and painterly within the pixel-art style, strong "
                     "atmospheric perspective, three or more depth planes fading with distance, "
                     "wide panoramic composition, no characters, no creatures, no ground in front")
            if transp:
                extra += ", isolated silhouette band on a clean empty background, "                          "only the scenery, no sky behind it"
            r = rz("submit_image_generation", {
                "project_id": PROYECTO, "output_path": f"assets/{clave}.png",
                "size": "2048x1152", "transparent": transp,
                "prompt": f"{desc}. {extra}. {ANCLA}"})
            if "task_id" not in r: print(f"  ✗ {clave}: {r}"); continue
            anotar(clave, {"task_id": r["task_id"], "output_path": r["output_path"],
                           "cols": 1, "filas": 1})
            print(f"  ✓ {clave}")


def pedir_portada():
    piezas = {
     "logo": ('The word "PIQUE" as a chunky pixel-art game logo, bold blocky letters with a thick '
              'dark outline and a soft inner highlight, amber and cream letters with a teal drop '
              'shadow, slight upward arc, isolated on an empty background, fills the image, '
              'no background scenery, no extra words, no tagline'),
     "titulo_fondo": ("Vertical title-screen scene for a pixel-art platformer, seen from the side: a "
                      "sunny grass-topped cliff on the right, distant green hills and a bright sky "
                      "with soft clouds filling the upper two thirds, a few floating stone platforms, "
                      "spinning coins, no characters, no text. Empty space in the middle for a logo"),
     "portada": ("Vertical key art for a pixel-art running platformer: the amber-jacketed goggled "
                 "runner creature dashing to the right across grass-topped stone blocks, spinning "
                 "coins trailing behind, a warm sunny sky with soft clouds, distant green hills, "
                 "a flag pole far ahead. Dynamic, joyful, sense of speed. No text, no logo"),
    }
    for k, desc in piezas.items():
        if k in cargar(): print(f"  · {k}: ya pedido"); continue
        r = rz("submit_image_generation", {
            "project_id": PROYECTO, "output_path": f"assets/{k}.png",
            "size": "1024x1024" if k == "logo" else "1152x2048",
            "transparent": k == "logo",
            "prompt": f"{desc}. {ANCLA}"})
        if "task_id" not in r: print(f"  ✗ {k}: {r}"); continue
        anotar(k, {"task_id": r["task_id"], "output_path": r["output_path"], "cols": 1, "filas": 1})
        print(f"  ✓ {k}")


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


TOPE = 2000        # el servidor rechaza cualquier prompt mas largo. Medido.

def armar(cuerpo, c, f):
    """Arma el prompt con el contrato largo, y con el corto si no entra.

    El corte se hace ACA y no recortando la descripcion: la descripcion es lo
    que distingue una hoja de otra, el contrato es el mismo texto en las
    dieciseis. Recortar lo que se repite cuesta menos que recortar lo unico.
    """
    largo = f"{cuerpo}. {ANCLA}{grilla(c, f)}"
    if len(largo) <= TOPE: return largo
    corto = f"{cuerpo}. {ANCLA}{grilla_corta(c, f)}"
    if len(corto) > TOPE:
        raise SystemExit(f"prompt de {len(corto)} caracteres: no entra ni con el contrato corto")
    return corto


def pedir():
    todo = {}
    for k, (suj, mov, c, f, tam) in HOJAS.items():
        todo[k] = (armar(f"{SUJETO[suj]}, {mov}", c, f), c, f, tam)
    for k, (desc, c, f, tam) in OBJETOS.items():
        todo[k] = (armar(desc, c, f), c, f, tam)
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


def rehacer(patrones):
    """Saca claves del registro para que la proxima pedida las vuelva a mandar.

    NO borra nada del disco. El servidor versiona la salida solo
    (`assets/x.png` -> `assets/x-g2.png`), asi que el archivo viejo sigue ahi
    y se puede volver a el si la tirada nueva sale peor. Borrar el PNG viejo
    al pedir el nuevo es quedarse sin nada si el nuevo falla.
    """
    import fnmatch
    d = cargar()
    fuera = [k for k in d if any(fnmatch.fnmatch(k, p) for p in patrones)]
    if not fuera: print("  nada que rehacer"); return
    guardado = AQUI / "assets" / "hojas.anterior.json"
    guardado.write_text(json.dumps(d, indent=2, ensure_ascii=False))
    for k in fuera:
        print(f"  ↻ {k}  (era {d[k].get('output_path')})")
        del d[k]
    PEDIDOS.write_text(json.dumps(d, indent=2, ensure_ascii=False))
    print(f"  {len(fuera)} claves fuera del registro · copia en {guardado.name}")


# Bajo `if __name__`, y no suelto, PORQUE OTRO ARCHIVO LO IMPORTA.
# preparar_assets.py necesita las tablas de aca (que clave es hoja, cual es
# fondo). Suelto, importarlo ejecutaba el modo que estuviera en sys.argv del
# OTRO programa: con suerte imprimia el estado, y con `pedir` en la linea de
# comandos habria mandado a generar todo de nuevo, pagando de nuevo.
def cli():
    modo = sys.argv[1] if len(sys.argv) > 1 else "estado"
    if modo == "rehacer": rehacer(sys.argv[2:])
    elif modo == "pedir": pedir()
    elif modo == "tiles": pedir_tiles()
    elif modo == "piezas": pedir_piezas()
    elif modo == "fondos": pedir_fondos()
    elif modo == "portada": pedir_portada()
    elif modo == "bajar": bajar()
    else:
        d = cargar()
        print(f"{len(d)} hojas · {sum(1 for x in d.values() if x.get('local'))} bajadas")
        for k, x in sorted(d.items()):
            print(f"  {'↓' if x.get('local') else '…'} {k:18} {x.get('cols')}x{x.get('filas')} "
                  f"{x.get('estado','pendiente')} {x.get('error','')}")


if __name__ == "__main__":
    cli()

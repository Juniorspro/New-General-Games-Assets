#!/usr/bin/env python3
"""Genera el paraguas —abierto y cerrado— y prepara las piezas del personaje.

    python3 generar_arte.py pedir
    python3 generar_arte.py bajar
    python3 generar_arte.py preparar

EL PARAGUAS ES EL JUEGO, así que es lo único que se genera nuevo: tiene que
leerse de un vistazo si está abierto o cerrado, porque de eso depende si vas a
entrar por el hueco que viene. Las dos imágenes se piden por separado y no como
una animación: entre medio el juego interpola el ANCHO, que es la caja de
choque, y dibuja la que corresponda.

El cuerpo de Rilo son las piezas que ya se cortaron para el otro juego. No se
vuelven a generar: son el mismo personaje.
"""
import json, pathlib, shutil, subprocess, sys, time

AQUI = pathlib.Path(__file__).parent
RZ = AQUI.parent / "herramientas" / "rezona" / "rz.py"
PROYECTO = "xVuxCcKGYO"
REG = AQUI / "assets" / "arte.json"
MODELO = "gemini-3-pro-image"

ESTILO = ("Flat 2D TV cartoon animation style, thin clean black outline of even weight, completely "
          "flat solid colours with no gradients and no shading. Isolated on a fully transparent "
          "background, the whole object inside the image with room to spare, nothing cropped. "
          "No drop shadow, no ground, no text, no frame, no hands, no person.")

# Las piezas del VESTIDO (menú, botones, marco) se piden aparte porque no se
# preparan igual: el marco y la chapa se usan con `border-image`, que corta la
# imagen en nueve pedazos por porcentaje, así que tienen que salir del tamaño
# exacto que espera el CSS y NO se les puede respetar la proporción.
ESTILO_UI = ("Flat 2D TV cartoon style with a thick black outline and completely flat solid "
             "colours, no gradients, no shading, no photorealism. Isolated on a fully "
             "transparent background. No drop shadow, no ground, no frame around the image.")

PIEZAS = {
  "paraguas_abierto": {
    "alto": 320,
    "prompt": ("A single OPEN umbrella seen straight from the front, perfectly symmetrical, "
               "in the style of a sci-fi cartoon gadget: the canopy is spread wide with six "
               "panels alternating ACID LIME GREEN and dark teal, a thin glowing lime rim "
               "along the bottom edge, and a small glowing green orb as the finial on top. "
               "A straight metallic grey shaft hangs down from the centre with a curved "
               "handle at the bottom. " + ESTILO)},
  "paraguas_cerrado": {
    "alto": 320,
    "prompt": ("A single CLOSED umbrella, furled tight, in the style of a sci-fi cartoon "
               "gadget: acid lime green and dark teal fabric wrapped narrow around a "
               "straight metallic grey shaft, a small glowing green orb on top and a curved "
               "handle at the bottom. Vertical, thin, seen from the front. " + ESTILO)},

  # EL FONDO DEL POZO. Se dibuja repetido hacia abajo y con parallax, y el juego
  # lo TIÑE con el color del tramo en vez de generar siete texturas distintas:
  # una imagen por tramo son siete veces el peso y además se desincroniza con
  # los colores del código apenas alguien toca un tramo.
  #
  # No se pide "que sea repetible": eso no lo cumple ningún generador. Se pide
  # que las cosas no lleguen a los bordes, y el juego la repite ESPEJADA —cada
  # copia dada vuelta— así que la costura siempre coincide consigo misma.
  "fondo_pozo": {
    "medida": (360, 512), "transparente": False, "recortar": False,
    "prompt": ("The far wall of a deep industrial shaft seen head on, filling the whole image: "
               "riveted metal plates, vertical pipes, bundles of cable, extractor grilles and "
               "grime. Flat 2D cartoon style with thick dark outlines, low contrast, very dark "
               "desaturated grey-blue, almost a silhouette. Even detail all over with nothing "
               "important near the edges. No characters, no text, no lighting effects.")},

  # LAS TRES SKINS PAGAS. Las otras treinta se hacen con código —tiñendo las
  # mismas piezas y agregando accesorios vectoriales— y por eso pesan cero. Estas
  # tres son las únicas con DIBUJO PROPIO, y esa es justamente la razón por la
  # que se pueden cobrar aparte: lo que se paga es algo que el juego no puede
  # generar solo, no un número más alto.
  #
  # Se genera el paraguas ABIERTO y la cabeza. El cerrado se tiñe a partir del
  # base: es una tira de quince píxeles que se ve medio segundo por vez, y no
  # justifica ni el peso ni la plata.
  "pro_cromo_paraguas": {
    "alto": 320,
    "prompt": ("A single OPEN umbrella seen straight from the front, perfectly symmetrical, made "
               "of polished liquid chrome: mirror-bright silver panels with sharp white highlights "
               "and cold blue reflections, a razor-thin rim, and a floating chrome sphere instead "
               "of a finial on top. A straight chrome shaft hangs down with a curved handle. "
               + ESTILO)},
  "pro_cromo_cabeza": {
    "alto": 120,
    "prompt": ("The head of a small cartoon character, seen from the front, made of polished "
               "liquid chrome: a featureless mirror-smooth face with a single horizontal glowing "
               "cyan visor across the eyes, and short swept-back chrome spikes for hair. Just the "
               "head and neck, nothing else. " + ESTILO)},
  "pro_magma_paraguas": {
    "alto": 320,
    "prompt": ("A single OPEN umbrella seen straight from the front, perfectly symmetrical, made "
               "of cooling volcanic rock: near-black cracked basalt panels with bright orange "
               "molten seams glowing between them, glowing embers along the bottom rim, and a "
               "burning ember as the finial on top. A dark iron shaft hangs down with a curved "
               "handle. " + ESTILO)},
  "pro_magma_cabeza": {
    "alto": 120,
    "prompt": ("The head of a small cartoon character, seen from the front, made of cracked black "
               "volcanic rock with bright orange molten light glowing out of the cracks, two "
               "burning orange eyes, and a crest of small flames instead of hair. Just the head "
               "and neck, nothing else. " + ESTILO)},
  "pro_vacio_paraguas": {
    "alto": 320,
    "prompt": ("A single OPEN umbrella seen straight from the front, perfectly symmetrical, whose "
               "canopy is a hole in space: deep black panels filled with tiny stars and faint "
               "violet nebula, ringed by a thin glowing violet edge, with a small collapsing "
               "purple star as the finial on top. A dark shaft hangs down with a curved handle. "
               + ESTILO)},
  "pro_vacio_cabeza": {
    "alto": 120,
    "prompt": ("The head of a small cartoon character, seen from the front, that is a silhouette "
               "filled with a starfield: deep black face with tiny white stars inside it, two "
               "glowing violet eyes, and a halo of faint violet dust instead of hair. Just the "
               "head and neck, nothing else. " + ESTILO)},

  # EL BOTON. Gira entero, así que tiene que ser REDONDO y estar centrado: si el
  # recorte lo deja descentrado un par de píxeles, al girar se bambolea.
  "ui_portal": {
    "medida": (352, 352),
    "prompt": ("A swirling green portal vortex seen face-on, perfectly circular and perfectly "
               "centred, filling the image edge to edge. Concentric spiral arms of acid lime "
               "green, bright yellow-green and dark forest green spinning around a bright "
               "pale-green glowing core in the exact centre. The outer rim is ragged and "
               "splashy with a few round green droplets flying off it. Cartoon sci-fi "
               "interdimensional portal. " + ESTILO_UI)},
  # El halo de atrás: se pone MAS GRANDE que el portal y gira al revés, y es lo
  # que hace que el botón parezca vivo sin que haya que animar el portal mismo.
  "ui_chispas": {
    "medida": (352, 352), "damero": True,
    "prompt": ("A ring of glowing acid-green energy splashes and round droplets arranged in a "
               "circle, like liquid flung outwards from a spinning portal. The very centre of "
               "the image is completely empty and transparent. Irregular, asymmetric, some "
               "splashes longer than others. Cartoon sci-fi. " + ESTILO_UI)},
  # El título. Es la única pieza con letras, así que va con otro estilo: pedirle
  # "no text" al resto es justamente lo que evita que aparezcan garabatos.
  "ui_logo": {
    "alto": 150,
    "prompt": ('A cartoon logo wordmark of the single word "PARAGUAS" in capital letters, one '
               'line, spelled exactly P-A-R-A-G-U-A-S. Chunky rounded hand-drawn letters with a '
               'thick black outline and a lime-green to pale-yellow fill, slightly tilted and '
               'bouncy like an adult cartoon title card, with a thin acid-green glow behind the '
               'letters. Nothing else in the image: no characters, no umbrella, no frame, no '
               'other words. Isolated on a fully transparent background, flat colours, no '
               'gradients other than the letter fill, no drop shadow.')},
  # El marco y la chapa se cortan con `border-image`: el centro tiene que quedar
  # VACIO de verdad, si no tapa el juego desenfocado que corre atrás.
  "ui_marco": {
    "medida": (320, 320),
    "prompt": ("A square picture frame made of dripping acid-green slime and riveted dark "
               "gunmetal panels, cartoon sci-fi laboratory style, with small glowing green "
               "lights at the four corners and slime drips running down the inner edge. The "
               "border is thick and even on all four sides; the entire middle of the square is "
               "completely empty and transparent — a hole, not a surface. " + ESTILO_UI)},
  "ui_chapa": {
    "medida": (192, 192),
    "prompt": ("A small horizontal rounded rectangular metal plate, cartoon sci-fi laboratory "
               "equipment: dark gunmetal blue-grey surface with four rivets, a thin bright "
               "acid-green light strip running along the bottom edge and a green outline. Blank "
               "surface with nothing written on it. Seen straight from the front. "
               + ESTILO_UI)},
}


def rz(nombre, args, timeout=1800):
    r = subprocess.run([sys.executable, str(RZ), "call", nombre, json.dumps(args)],
                       cwd=AQUI, capture_output=True, text=True, timeout=timeout)
    s = r.stdout.strip()
    try:
        return json.loads(s[s.index("{"):])
    except Exception:
        return {"error": (s or r.stderr)[-400:]}


def cargar():
    return json.loads(REG.read_text()) if REG.exists() else {}


def anotar(k, v):
    d = cargar(); d[k] = {**d.get(k, {}), **v}
    REG.parent.mkdir(parents=True, exist_ok=True)
    REG.write_text(json.dumps(d, indent=2, ensure_ascii=False))


def pedir(rehacer=False):
    # LOS RENOMBRES VAN TODOS JUNTOS Y ANTES DE PEDIR NADA.
    #
    # Intercalados, cada uno escribía el registro desde una copia en memoria
    # tomada al principio — o sea, sin lo que `anotar` había guardado en el
    # disco para la pieza anterior. La segunda pieza pisaba a la primera y el
    # pedido se perdía sin error: quedaba una pieza vieja y una nueva, y eso
    # recién se nota mirando el dibujo.
    if rehacer:
        d = cargar()
        for k in list(PIEZAS):
            if k in d:
                d[f"{k}.viejo{len([x for x in d if x.startswith(k + '.viejo')])}"] = d.pop(k)
        REG.write_text(json.dumps(d, indent=2, ensure_ascii=False))
    d = cargar()
    for k, cfg in PIEZAS.items():
        if d.get(k, {}).get("task_id"):
            print(f"  · {k} ya pedido"); continue
        r = rz("submit_image_generation", {
            "project_id": PROYECTO, "output_path": f"assets/{k}.png", "prompt": cfg["prompt"],
            # LOS FONDOS NO SE PIDEN RECORTADOS. `transparent` le dice al
            # servidor que borre el fondo de la imagen, que es justo lo que hace
            # falta para una pieza suelta y exactamente lo contrario de lo que
            # hace falta para una textura que ocupa la pantalla entera: le
            # abriría agujeros por donde se ve el vacío.
            "model": MODELO, "size": "1024x1024",
            "transparent": cfg.get("transparente", True)})
        if "task_id" not in r:
            print(f"  ✗ {k}: {r}"); continue
        anotar(k, {"task_id": r["task_id"], "output_path": r["output_path"]})
        print(f"  ✓ {k}")


def bajar():
    d = cargar()
    for vuelta in range(120):
        pend = [k for k, x in d.items() if x.get("estado") not in ("ready", "failed")]
        if not pend:
            break
        r = rz("check_generation_tasks", {"task_ids": [d[k]["task_id"] for k in pend],
                                          "project_id": PROYECTO})
        for it in r.get("items", []):
            for k in pend:
                if d[k]["task_id"] == it["task_id"]:
                    d[k]["estado"] = it["status"]
                    if it.get("asset_path"):
                        d[k]["output_path"] = it["asset_path"]
        for k2, v2 in d.items():
            anotar(k2, v2)
        if all(x.get("estado") in ("ready", "failed") for x in d.values()):
            break
        print(f"  vuelta {vuelta + 1}…", flush=True)
        time.sleep(12)
    for k, x in d.items():
        if x.get("estado") != "ready" or x.get("local"):
            continue
        r = rz("fetch_generated_asset", {"project_id": PROYECTO, "output_path": x["output_path"]})
        if "absolute_path" in r:
            x["local"] = r["absolute_path"]; print(f"  ↓ {k}: {r['bytes'] // 1024} KB")
        anotar(k, x)


def sin_damero(im):
    """Borra el damero gris que el generador DIBUJA cuando le pedís un agujero.

    Al pedir "el centro completamente transparente" el modelo entiende la
    convención de la interfaz y pinta el cuadriculado gris y blanco con el que
    los editores muestran la transparencia — píxeles opacos de verdad. Se
    reconocen porque no tienen color: el resto de la pieza es verde saturado o
    negro, así que un pixel claro y sin saturación sólo puede ser el damero.
    """
    from PIL import Image
    px = im.load()
    an, al = im.size
    for y in range(al):
        for x in range(an):
            r, g, b, a = px[x, y]
            if a and min(r, g, b) > 140 and max(r, g, b) - min(r, g, b) < 26:
                px[x, y] = (r, g, b, 0)
    return im


def preparar():
    """Recortar al contenido, achicar y pasar a WebP; traer las piezas del cuerpo."""
    from PIL import Image
    destino = AQUI / "assets" / "arte"
    destino.mkdir(parents=True, exist_ok=True)
    total = 0
    reg = cargar()
    for k, cfg in PIEZAS.items():
        # El archivo sale del REGISTRO, no de adivinar el sufijo. El servidor le
        # pone un número de generación al nombre, así que el segundo pedido de
        # una pieza cae en `-g2`: buscando `-g1` a mano, `preparar` seguía
        # preparando la versión vieja y el juego mostraba el dibujo anterior.
        local = reg.get(k, {}).get("local")
        f = pathlib.Path(local) if local else AQUI / "assets" / f"{k}-g1.png"
        if not f.exists():
            print(f"  · falta {f.name}"); continue
        im = Image.open(f).convert("RGBA")
        # El recorte se mide sobre el alfa UMBRALADO: el recorte de fondo del
        # generador deja un halo de alfa bajo por toda la imagen y getbbox()
        # sobre el alfa crudo devuelve la imagen entera.
        if cfg.get("recortar", True):
            m = im.getchannel("A").point(lambda v: 255 if v > 100 else 0)
            caja = m.getbbox()
            if caja:
                im = im.crop(caja)
        if cfg.get("damero"):
            im = sin_damero(im)
        # `medida` fuerza el tamaño exacto SIN respetar la proporción: las piezas
        # que se usan con `border-image` se parten en nueve por porcentaje, y el
        # CSS necesita saber de antemano dónde caen los cortes.
        if cfg.get("medida"):
            im = im.resize(cfg["medida"], Image.LANCZOS)
        else:
            alto = cfg.get("alto", 320)
            if im.height > alto:
                im = im.resize((max(1, round(im.width * alto / im.height)), alto), Image.LANCZOS)
        salida = destino / f"{k}.webp"
        im.save(salida, "WEBP", quality=90, method=6)
        kb = salida.stat().st_size / 1024; total += kb
        print(f"  {k:18} {im.size[0]}x{im.size[1]:<4} {kb:5.1f} KB")

    # Las piezas del cuerpo salen del otro juego: es el mismo personaje y
    # volver a generarlas daría otro dibujo.
    otro = AQUI.parent / "dimension-n" / "assets" / "partes"
    for n in ["cabeza", "torso", "brazo_alto", "brazo_bajo", "pierna_alta", "pierna_baja"]:
        o = otro / f"rilo_{n}.webp"
        if not o.exists():
            print(f"  · falta {o}"); continue
        shutil.copy(o, destino / f"rilo_{n}.webp")
        total += o.stat().st_size / 1024
    print(f"\n  {total:.0f} KB de arte")


if __name__ == "__main__":
    modo = sys.argv[1] if len(sys.argv) > 1 else "estado"
    if modo == "pedir": pedir()
    elif modo == "rehacer": pedir(True)
    elif modo == "bajar": bajar()
    elif modo == "preparar": preparar()
    else:
        for k, x in cargar().items():
            print(f"  {k}: {x.get('estado', 'pendiente')} {x.get('local', '')}")

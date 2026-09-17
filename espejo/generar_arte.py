#!/usr/bin/env python3
"""El arte de Espejo: el vestido de los menús de los menús.

    python3 generar_arte.py pedir
    python3 generar_arte.py bajar
    python3 generar_arte.py preparar

SE GENERA LO MINIMO. La torre entera es vectorial —argollas, paredes, tuercas,
soga— porque son formas que el código dibuja mejor y más nítidas que cualquier
imagen escalada, y porque así el juego sigue andando con cero archivos. Lo que
sí se dibuja es lo que el código haría feo: un personaje y el vestido de los
menús, que es donde una interfaz de líneas se ve como una maqueta.
"""
import json, pathlib, subprocess, sys, time

AQUI = pathlib.Path(__file__).parent
RZ = AQUI.parent / "herramientas" / "rezona" / "rz.py"
PROYECTO = "xVuxCcKGYO"
REG = AQUI / "assets" / "arte.json"
MODELO = "gemini-3-pro-image"

ESTILO = ("Flat 2D cartoon style with a thick black outline and completely flat solid colours, "
          "no gradients, no shading, no photorealism. Isolated on a fully transparent background. "
          "No drop shadow, no ground, no frame around the image, no text.")

PIEZAS = {
  # ACA NO HAY PERSONAJE NI TABLERO DIBUJADO: el tablero son rectángulos, líneas
  # y círculos, y el código los hace más nítidos que cualquier imagen escalada —
  # además de dejar que el juego ande con cero archivos. Lo único que se genera
  # es el vestido de los menús, que es donde una interfaz de líneas se ve como
  # una maqueta.
  "ui_logo": {
    "alto": 150,
    "prompt": ('A cartoon logo wordmark of the single word "ESPEJO" in capital letters, one line, '
               'spelled exactly E-S-P-E-J-O. Chunky rounded hand-drawn letters with a thick black '
               'outline and a pale mirror-silver to icy-cyan fill with a bright diagonal glint '
               'across them, slightly tilted, with a thin cyan glow behind the letters. Nothing '
               'else in the image: no characters, no mirrors, no frame, no other words. Isolated '
               'on a fully transparent background, flat colours, no drop shadow.')},
  "ui_prisma": {
    "medida": (300, 120),
    "prompt": ("A wide horizontal plate of dark polished glass with bevelled edges and a bright "
               "cyan light bar running across the middle, like a control panel button. Seen "
               "straight from the front, perfectly rectangular, filling the image edge to edge. "
               "Blank surface with nothing written on it. " + ESTILO)},
  "ui_marco": {
    "medida": (320, 320),
    "prompt": ("A square frame made of thin polished brass rods and small mirror shards held in "
               "brackets, with tiny cyan lamps at the four corners, like an optics bench. The "
               "border is thick and even on all four sides; the entire middle of the square is "
               "completely empty and transparent — a hole, not a surface. " + ESTILO)},
  "ui_chapa": {
    "medida": (192, 192),
    "prompt": ("A small horizontal rounded rectangular plate of dark smoked glass with a thin "
               "brass rim and a faint cyan reflection along the bottom edge. Blank surface with "
               "nothing written on it. Seen straight from the front. " + ESTILO)},
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
    # LOS RENOMBRES VAN TODOS JUNTOS Y ANTES DE PEDIR NADA: intercalados, cada
    # uno escribía el registro desde una copia en memoria tomada al principio y
    # la segunda pieza pisaba a la primera, perdiendo un pedido sin error.
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
            "model": MODELO, "size": "1024x1024", "transparent": True})
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
    reconocen porque no tienen color: el resto de la pieza es de colores
    saturados o negra, así que un pixel claro y sin saturación sólo puede ser
    el damero.
    """
    px = im.load()
    an, al = im.size
    for y in range(al):
        for x in range(an):
            r, g, b, a = px[x, y]
            if a and min(r, g, b) > 140 and max(r, g, b) - min(r, g, b) < 26:
                px[x, y] = (r, g, b, 0)
    return im


def preparar():
    from PIL import Image
    destino = AQUI / "assets" / "arte"
    destino.mkdir(parents=True, exist_ok=True)
    total = 0
    reg = cargar()
    for k, cfg in PIEZAS.items():
        # El archivo sale del REGISTRO, no de adivinar el sufijo: el servidor le
        # pone un número de generación al nombre, así que el segundo pedido de
        # una pieza cae en `-g2` y buscar `-g1` a mano prepara la versión vieja
        # —y el juego muestra el dibujo anterior sin que nada falle.
        local = reg.get(k, {}).get("local")
        f = pathlib.Path(local) if local else AQUI / "assets" / f"{k}-g1.png"
        if not f.exists():
            print(f"  · falta {f.name}"); continue
        im = Image.open(f).convert("RGBA")
        # El recorte se mide sobre el alfa UMBRALADO: el recorte de fondo del
        # generador deja un halo de alfa bajo por toda la imagen y getbbox()
        # sobre el alfa crudo devuelve la imagen entera.
        m = im.getchannel("A").point(lambda v: 255 if v > 100 else 0)
        caja = m.getbbox()
        if caja:
            im = im.crop(caja)
        if cfg.get("damero", k.startswith("ui_")):
            im = sin_damero(im)
        if cfg.get("medida"):
            im = im.resize(cfg["medida"], Image.LANCZOS)
        else:
            alto = cfg.get("alto", 256)
            if im.height > alto:
                im = im.resize((max(1, round(im.width * alto / im.height)), alto), Image.LANCZOS)
        salida = destino / f"{k}.webp"
        im.save(salida, "WEBP", quality=90, method=6)
        kb = salida.stat().st_size / 1024; total += kb
        print(f"  {k:12} {im.size[0]}x{im.size[1]:<4} {kb:5.1f} KB")
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

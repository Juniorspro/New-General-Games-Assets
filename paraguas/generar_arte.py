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

PIEZAS = {
  "paraguas_abierto": ("A single OPEN umbrella seen straight from the front, perfectly symmetrical, "
                       "in the style of a sci-fi cartoon gadget: the canopy is spread wide with six "
                       "panels alternating ACID LIME GREEN and dark teal, a thin glowing lime rim "
                       "along the bottom edge, and a small glowing green orb as the finial on top. "
                       "A straight metallic grey shaft hangs down from the centre with a curved "
                       "handle at the bottom. " + ESTILO),
  "paraguas_cerrado": ("A single CLOSED umbrella, furled tight, in the style of a sci-fi cartoon "
                       "gadget: acid lime green and dark teal fabric wrapped narrow around a "
                       "straight metallic grey shaft, a small glowing green orb on top and a curved "
                       "handle at the bottom. Vertical, thin, seen from the front. " + ESTILO),
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
    for k, prompt in PIEZAS.items():
        if d.get(k, {}).get("task_id"):
            print(f"  · {k} ya pedido"); continue
        r = rz("submit_image_generation", {
            "project_id": PROYECTO, "output_path": f"assets/{k}.png", "prompt": prompt,
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


def preparar():
    """Recortar al contenido, achicar y pasar a WebP; traer las piezas del cuerpo."""
    from PIL import Image
    destino = AQUI / "assets" / "arte"
    destino.mkdir(parents=True, exist_ok=True)
    total = 0
    reg = cargar()
    for k in PIEZAS:
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
        m = im.getchannel("A").point(lambda v: 255 if v > 100 else 0)
        caja = m.getbbox()
        if caja:
            im = im.crop(caja)
        alto = 320
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

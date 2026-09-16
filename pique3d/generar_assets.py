#!/usr/bin/env python3
"""Genera todos los assets de Pique 3D con Rezona Lab.

    python3 generar_assets.py conceptos    # imagenes de las criaturas y props
    python3 generar_assets.py texturas     # texturas repetibles del terreno
    python3 generar_assets.py portada
    python3 generar_assets.py modelos      # imagen -> 3D, usando los conceptos
    python3 generar_assets.py rig          # esqueleto + animaciones del heroe
    python3 generar_assets.py audio
    python3 generar_assets.py estado       # que hay pedido y que llego

LAS CUATRO TRAMPAS, que cuestan creditos cada una:

1. El `output_path` que sirve es el de la RESPUESTA, no el que se manda: el
   servidor le agrega el numero de generacion (`heroe.png` -> `heroe-g1.png`).
   Por eso todo lo pedido se anota en pedidos.json con el que volvio.
2. `fetch_generated_asset` hay que correrlo parado en una carpeta con
   `.rezona/` adentro, o no sabe a que proyecto pertenece.
3. Para fondo transparente de verdad hay que pedir `transparent: true`. Sin
   eso viene con fondo aunque el prompt diga "sin fondo".
4. El ancla de estilo va VERBATIM al final de cada prompt. Sin ancla repetida
   cada generacion sale de otro juego. Esta avisado en asset-pipeline.md del
   propio kit y es la falla numero uno.

Y una regla propia: las criaturas son ORIGINALES. Cada prompt niega
explicitamente los parecidos (`NOT a plumber`, `not a turtle`, `no moustache`).
Un rol de juego no se puede registrar; un personaje si.
"""
import json, os, subprocess, sys, time, pathlib

AQUI = pathlib.Path(__file__).parent
RZ = AQUI.parent / "herramientas" / "rezona" / "rz.py"
PROYECTO = "EUDERiogqd"
PEDIDOS = AQUI / "assets" / "pedidos.json"

ANCLA = ("chunky stylized low-poly game art, warm sunset palette of amber #ffb43a, "
         "deep teal #2a7f8f and cream #f4e4c1, soft rim light, clean flat shading, "
         "smooth matte surfaces, no outlines, no text, no watermark, not photorealistic")

# Lo que niega todo personaje. Se repite entero a proposito: acortarlo es
# justo donde se cuela el parecido.
LIMPIO = ("no logos, no letters, no numbers, no ground shadow, single subject only, "
          "not a known franchise character, not fan art")

CRIATURAS = {
    "heroe": ("Full-body character concept of an ORIGINAL cartoon runner creature, front view, "
              "standing straight, arms slightly out, centered, isolated on empty background. "
              "Stocky rounded body, large single dome goggle covering the upper face, long trailing "
              "scarf, chunky oversized boots, stubby three-finger hands, small rounded ears, no mouth. "
              "Amber jacket, deep teal scarf and gloves, cream goggle glass. It is a small fantasy "
              "creature, NOT a human, NOT a plumber, no moustache, no cap, no overalls."),
    "bolo": ("A small round mossy boulder creature with two stubby stone legs and two round glowing "
             "eyes, grumpy expression, front view, isolated. It is a ROCK, not a mushroom, not a "
             "chestnut, no cap, no stem, no face-shaped hat."),
    "caracol": ("An armoured snail creature with a thick faceted amber shell, short teal body and two "
                "eye stalks, side-three-quarter view, isolated. It is a SNAIL, not a turtle, not a "
                "tortoise, no beak, no shoes, no wings."),
    "aleta": ("A floating jellyfish creature with two stubby side fins and a translucent teal bell, "
              "small round eyes, drifting pose, isolated. It is a JELLYFISH, not a turtle, no shell, "
              "no feathered wings."),
    "erizo": ("A spiky burr creature, a dark round body completely covered in sharp cream spikes, "
              "two angry eyes peeking between the spikes, four tiny legs, front view, isolated. "
              "Its whole top is spikes, clearly dangerous to step on. Not a hedgehog mascot, "
              "no shoes, no ears."),
    "fauces": ("A toothed carnivorous flower with thick amber petals and a ring of cream fangs, on a "
               "short teal stalk emerging from a metal vent collar, front view, isolated. "
               "It is a PLANT, not a snake, no eyes, no leaves with faces."),
    "osario": ("A small stack of chunky cartoon bones assembled into a two-legged creature with a "
               "rounded skull, hollow eye sockets, front view, isolated. Stylized and friendly, "
               "not gory, no blood, not scary, not a human skeleton."),
    "vela": ("A floating ghostly flame wisp with a soft round teal-white body, two dark simple eyes "
             "and a trailing tail of light, isolated. Translucent and glowing. Not a sheet ghost, "
             "no arms, no tongue."),
    "perno": ("A flying metal bolt projectile, a blunt amber capsule with small fins at the back and "
              "a single glowing cream eye at the front, side view pointing left, isolated. "
              "It is a BOLT, not a bullet, not a missile, no flames."),
    "brasa": ("A round blob of molten lava with a bright cream-hot core and a small mischievous face, "
              "leaping upward, isolated. Glowing and hot. Not a sun, no arms, no legs."),
    "yunque": ("An ORIGINAL armoured brute boss creature, heavy squat body plated in dark metal with "
               "amber rivets, two thick arms, a blunt helmet with a narrow visor slit, standing "
               "front view, isolated. Imposing but cartoonish. Not a turtle, no shell, no horns, "
               "no spikes on the back."),
    "coloso": ("An ORIGINAL huge boss creature, a broad stone-and-metal colossus with a cracked amber "
               "core glowing in its chest, heavy shoulders, short legs, glowing slit eyes, standing "
               "front view, isolated. Not a dragon, not a turtle, no shell, no fire breath, no horns."),
    "conducto": ("A short thick industrial vent pipe standing upright, teal metal body with an amber "
                 "rim at the top and two bolts on the side, three-quarter view, isolated. "
                 "Clean simple game prop. Not a green plumbing pipe, no plants inside."),
    "moneda": ("A round game coin, thick amber disc with a bevelled cream edge and a simple spiral "
               "emblem embossed in the centre, front view, isolated. Not a real currency, no letters, "
               "no numbers, no country emblem."),
    "resorte": ("A game jump pad: a wide cream metal plate on a thick amber coil spring, bolted to a "
                "dark base, three-quarter view, isolated. Simple clean game prop."),
}

# Los costados van con OTRA textura. Con una sola, el pasto de la cara de
# arriba trepa por el paredon y se ve como cesped vertical: el ojo lo caza
# enseguida. La de arriba es la superficie; esta es el corte del terreno.
COSTADOS = {
    "llano":    "cross-section of packed earth seen from the side, dark brown soil with small embedded pebbles and thin root lines",
    "subte":    "cross-section of damp bedrock seen from the side, cool blue-grey strata with mineral veins",
    "castillo": "cross-section of dark volcanic rock seen from the side, deep grey-violet with thin ember veins",
    "desierto": "cross-section of layered desert rock seen from the side, warm ochre and cream horizontal strata",
    "cielo":    "cross-section of soft white cloud-stone seen from the side, pale cream with gentle blue banding",
    "nave":     "side view of a ship hull, dark brown planks with iron bands and rivets",
    "torre":    "cross-section of violet tower stone seen from the side, dense blocks with faint glowing seams",
    "fantasma": "side view of old haunted panelling, dark violet wood with vertical grain and cobwebs",
}

TEXTURAS = {
    "llano":     "lush short grass turf seen from directly above, soft green blades, small amber flecks",
    "subte":     "damp cut stone blocks seen from directly above, cool blue-grey, thin mortar lines",
    "castillo":  "dark volcanic brick wall seen from directly above, deep grey-violet blocks, ember cracks",
    "desierto":  "wind-carved sandstone seen from directly above, warm amber and ochre layered bands",
    "cielo":     "soft white cloud-stone seen from directly above, pale cream with gentle blue shadows",
    "nave":      "weathered ship deck planks seen from directly above, warm brown wood, iron nail heads",
    "torre":     "polished violet tower stone seen from directly above, hexagonal blocks, faint glow lines",
    "fantasma":  "old haunted floorboards seen from directly above, dark violet wood, pale dust",
}

SFX = {
    "salto":   ("sound", "short soft cloth-and-spring hop, light and bouncy, arcade platformer jump, dry"),
    "moneda":  ("sound", "short bright metallic coin pickup, two quick ascending chimes, arcade"),
    "pisada":  ("sound", "short muffled thud of stepping on something soft, low and punchy, cartoon"),
    "paredazo":("sound", "short scuffed kick off a stone wall, gritty, quick"),
    "muerte":  ("sound", "short descending cartoon failure warble, deflating, not harsh"),
    "mastil":  ("sound", "short triumphant four-note ascending fanfare, bright bells, arcade level clear"),
}
BGM = {
    "llano":    "upbeat playful chiptune-orchestral platformer theme, bright amber mood, light percussion, 120 bpm, seamless loop, consistent energy, no fade out",
    "subte":    "moody underground platformer theme, low pulsing bass, sparse bells, slight tension, 112 bpm, seamless loop, consistent energy, no fade out",
    "castillo": "dark driving fortress theme, minor key, heavy drums and low brass, urgent, 128 bpm, seamless loop, consistent energy, no fade out",
}


# ---------------------------------------------------------------------------
def rz(nombre, args, timeout=900):
    r = subprocess.run([sys.executable, str(RZ), "call", nombre, json.dumps(args)],
                       cwd=AQUI, capture_output=True, text=True, timeout=timeout)
    salida = r.stdout.strip()
    try:
        return json.loads(salida[salida.index("{"):])
    except Exception:
        return {"error": salida[-600:] or r.stderr[-600:]}


def lote(llamadas, timeout=1800):
    r = subprocess.run([sys.executable, str(RZ), "batch", json.dumps(llamadas)],
                       cwd=AQUI, capture_output=True, text=True, timeout=timeout)
    out, res = r.stdout, []
    for bloque in out.split("── ")[1:]:
        try:
            res.append(json.loads(bloque[bloque.index("{"):bloque.rindex("}") + 1]))
        except Exception:
            res.append({"error": bloque[:300]})
    return res


def cargar():
    return json.loads(PEDIDOS.read_text()) if PEDIDOS.exists() else {}


def anotar(clave, datos):
    d = cargar(); d[clave] = datos
    PEDIDOS.parent.mkdir(exist_ok=True)
    PEDIDOS.write_text(json.dumps(d, indent=2, ensure_ascii=False))


def pedir_imagenes(items, size="1024x1024", transparente=True, pref=""):
    """items: {clave: prompt}. Manda de a una y anota el output_path DEVUELTO."""
    for clave, prompt in items.items():
        k = pref + clave
        if k in cargar():
            print(f"  · {k}: ya pedido"); continue
        r = rz("submit_image_generation", {
            "project_id": PROYECTO, "output_path": f"assets/{k}.png",
            "prompt": f"{prompt} {LIMPIO}. {ANCLA}",
            "size": size, "transparent": transparente})
        if "task_id" not in r:
            print(f"  ✗ {k}: {r}"); continue
        anotar(k, {"task_id": r["task_id"], "output_path": r["output_path"], "tipo": "image"})
        print(f"  ✓ {k}: {r['task_id']} -> {r['output_path']}")


def esperar(claves=None, vueltas=90):
    d = cargar()
    claves = claves or list(d)
    for v in range(vueltas):
        pend = [k for k in claves if d.get(k, {}).get("estado") not in ("ready", "failed")]
        if not pend:
            break
        ids = [d[k]["task_id"] for k in pend]
        r = rz("check_generation_tasks", {"task_ids": ids[:100], "project_id": PROYECTO})
        for it in r.get("items", []):
            for k in pend:
                if d[k]["task_id"] == it["task_id"]:
                    d[k]["estado"] = it["status"]
                    if it.get("asset_path"): d[k]["output_path"] = it["asset_path"]
                    if it.get("error") or it.get("failure"):
                        d[k]["error"] = it.get("error") or it.get("failure")
        PEDIDOS.write_text(json.dumps(d, indent=2, ensure_ascii=False))
        listos = sum(1 for k in claves if d.get(k, {}).get("estado") == "ready")
        print(f"  vuelta {v + 1}: {listos}/{len(claves)} listos", flush=True)
        if listos == len(claves):
            break
        time.sleep(12)
    return d


def bajar(claves=None):
    d = cargar()
    claves = claves or list(d)
    for k in claves:
        it = d.get(k, {})
        if it.get("estado") != "ready" or it.get("local"):
            continue
        r = rz("fetch_generated_asset", {"project_id": PROYECTO, "output_path": it["output_path"]})
        if "absolute_path" in r:
            it["local"] = r["absolute_path"]; it["public_url"] = r["public_url"]
            print(f"  ↓ {k}: {os.path.basename(r['absolute_path'])} ({r['bytes']//1024} KB)")
        else:
            print(f"  ✗ {k}: {r}")
        PEDIDOS.write_text(json.dumps(d, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
def main():
    modo = sys.argv[1] if len(sys.argv) > 1 else "estado"

    if modo == "conceptos":
        pedir_imagenes(CRIATURAS)
        esperar([k for k in cargar() if k in CRIATURAS]); bajar()

    elif modo == "costados":
        items = {k: (f"{v}, seamless tileable texture, no border vignette, edges continue "
                     f"perfectly, flat orthographic, even lighting, no shadows cast, "
                     f"no objects on top, no sky, no grass on top") for k, v in COSTADOS.items()}
        pedir_imagenes(items, transparente=False, pref="lat_")
        esperar([k for k in cargar() if k.startswith("lat_")]); bajar()

    elif modo == "texturas":
        items = {k: (f"{v}, seamless tileable texture, no border vignette, edges continue "
                     f"perfectly, flat orthographic top-down, even lighting, no shadows cast, "
                     f"no objects on top") for k, v in TEXTURAS.items()}
        pedir_imagenes(items, transparente=False, pref="tex_")
        esperar([k for k in cargar() if k.startswith("tex_")]); bajar()

    elif modo == "portada":
        pedir_imagenes({"portada": (
            "Wide key art for a 2.5D running platformer: the amber-jacketed goggled runner creature "
            "dashing to the right across floating grass-topped stone blocks, spinning coins trailing "
            "behind, a warm sunset sky with soft clouds, distant hills, a tall flag pole far ahead. "
            "Dynamic, joyful, sense of speed.")}, size="2048x1152", transparente=False)
        esperar(["portada"]); bajar(["portada"])

    elif modo == "modelos":
        d = cargar()
        # Imagen -> 3D: mucho mas dirigible que texto -> 3D, y ya pagamos el
        # concepto. Solo los que la camara ve de cerca.
        quiero = ["heroe", "bolo", "caracol", "aleta", "erizo", "fauces",
                  "conducto", "yunque", "coloso", "moneda", "resorte", "osario", "perno"]
        for k in quiero:
            m = "m3d_" + k
            if m in d: print(f"  · {m}: ya pedido"); continue
            if not d.get(k, {}).get("public_url"):
                print(f"  ! {m}: falta el concepto {k}"); continue
            r = rz("submit_model3d_generation", {
                "project_id": PROYECTO, "output_path": f"assets/{m}.glb",
                "prompt": f"{CRIATURAS[k].split('.')[0]}. {ANCLA}",
                "source_url": d[k]["public_url"],
                "texture": True, "pbr": True,
                "texture_quality": "detailed" if k in ("heroe", "yunque", "coloso") else "standard"})
            if "task_id" not in r: print(f"  ✗ {m}: {r}"); continue
            anotar(m, {"task_id": r["task_id"], "output_path": r["output_path"], "tipo": "model3d"})
            print(f"  ✓ {m}: {r['task_id']}")
        esperar([k for k in cargar() if k.startswith("m3d_")], vueltas=150); bajar()

    elif modo == "rig":
        d = cargar()
        if not d.get("m3d_heroe", {}).get("task_id"):
            print("falta el modelo del heroe"); return
        r = rz("submit_rig3d_generation", {
            "project_id": PROYECTO, "output_path": "assets/heroe_rig.glb",
            "source_task_id": d["m3d_heroe"]["task_id"],
            "rig_type": "biped",
            "animations": ["idle", "run", "jump"]})
        print(json.dumps(r, indent=2)[:700])
        if "task_id" in r:
            anotar("rig_heroe", {"task_id": r["task_id"], "output_path": r["output_path"], "tipo": "rig"})
            esperar(["rig_heroe"], vueltas=150); bajar(["rig_heroe"])

    elif modo == "audio":
        for k, (kind, prompt) in {**{a: b for a, b in SFX.items()},
                                  **{"bgm_" + a: ("music", b) for a, b in BGM.items()}}.items():
            clave = "snd_" + k
            if clave in cargar(): print(f"  · {clave}: ya pedido"); continue
            args = {"project_id": PROYECTO, "output_path": f"assets/{clave}.mp3",
                    "prompt": prompt, "kind": kind}
            # output_format SOLO para efectos. Con kind="music" el servidor
            # rechaza el pedido entero con un VALIDATION_ERROR que no dice cual
            # es el campo culpable — se encontro probando de a un parametro.
            if kind == "sound": args["output_format"] = "mp3"
            else: args["duration"] = 30
            r = rz("submit_audio_generation", args)
            if "task_id" not in r: print(f"  ✗ {clave}: {r}"); continue
            anotar(clave, {"task_id": r["task_id"], "output_path": r["output_path"], "tipo": "audio"})
            print(f"  ✓ {clave}: {r['task_id']}")
        esperar([k for k in cargar() if k.startswith("snd_")], vueltas=150); bajar()

    elif modo == "estado":
        d = cargar()
        listos = sum(1 for v in d.values() if v.get("estado") == "ready")
        bajados = sum(1 for v in d.values() if v.get("local"))
        print(f"{len(d)} pedidos · {listos} listos · {bajados} bajados")
        for k, v in sorted(d.items()):
            marca = "↓" if v.get("local") else ("✓" if v.get("estado") == "ready" else
                                                "✗" if v.get("estado") == "failed" else "…")
            print(f"  {marca} {k:16} {v.get('tipo','?'):8} {v.get('estado','pendiente')}"
                  + (f"  {v['error']}" if v.get("error") else ""))
    else:
        print(__doc__)


main()

#!/usr/bin/env python3
"""Genera la escena del hongo arcoiris como VIDEO y la vuelve hoja de sprites.

    python3 generar_escena.py cuadro    # 1) la imagen que abre el video
    python3 generar_escena.py video     # 2) el video, a partir de esa imagen
    python3 generar_escena.py bajar     # 3) esperar y descargar
    node pruebas/cuadros_video.mjs      # 4) sacar los fotogramas y armar la hoja

POR QUE UN VIDEO Y NO DIECISEIS DIBUJOS. Una hoja de sprites se pide con "que
la pose cambie de a poco" y el modelo la arma dibujo por dibujo: sale una
animacion, pero cada cuadro es un dibujo aparte y se nota en el temblor. Un
video se genera como una sola cosa continua, asi que los fotogramas ya vienen
encadenados. Para dos segundos y medio de escena —lo unico del juego que se
mira en vez de jugarse— eso es exactamente lo que hace falta.

LA CONTINUIDAD DEL PERSONAJE SE RESUELVE CON `source_url`, y es la parte que
importa: primero se genera UNA imagen del personaje, y el video arranca de esa
imagen como primer fotograma. Pidiendo el video de cero, el personaje sale
parecido y no igual —otro color de campera, otra bufanda— y en pantalla se ve
como si fuera otro.

Y EL PERSONAJE ES ORIGINAL. Las negaciones del prompt son las mismas que en
las hojas: sin gorra, sin bigote, sin mameluco. No es un detalle de estilo.
"""
import json, pathlib, subprocess, sys, time

AQUI = pathlib.Path(__file__).parent
RZ = AQUI.parent / "herramientas" / "rezona" / "rz.py"
PROYECTO = "EUDERiogqd"
REG = AQUI / "assets" / "escena.json"

HEROE = ("a small original cartoon creature: stocky round body, big cream dome goggle covering the "
         "upper face, long teal scarf, amber jacket, chunky dark boots, no visible mouth. "
         "NOT a human, NOT a plumber, no moustache, no cap, no overalls")

ESTILO = ("90s anime cel animation look, hand-painted backgrounds, bold clean linework, saturated "
          "colours, dramatic rim light, visible speed lines and light rays, film grain")

CUADRO = (f"{HEROE} standing and holding a huge glowing RAINBOW-striped mushroom up in both hands in "
          f"front of its chest, looking at it in awe, sparkles around it. Vertical composition, the "
          f"creature centred and filling the middle of the frame, dark starry background with "
          f"rainbow light rays radiating out from the mushroom behind it. {ESTILO}")

VIDEO = (f"The creature holds the glowing rainbow mushroom up, stares at it as it flares brighter, "
         f"then bites into it. A shockwave of rainbow light bursts out from it, the background "
         f"explodes into spinning rainbow rays, and the creature GROWS ENORMOUS, filling the frame, "
         f"with rainbow energy running over its body. Camera stays locked, vertical framing, one "
         f"continuous shot, no cuts. {ESTILO}")


def rz(nombre, args, timeout=1800):
    r = subprocess.run([sys.executable, str(RZ), "call", nombre, json.dumps(args)],
                       cwd=AQUI, capture_output=True, text=True, timeout=timeout)
    s = r.stdout.strip()
    try:
        return json.loads(s[s.index("{"):])
    except Exception:
        return {"error": (s or r.stderr)[-500:]}


def cargar():
    return json.loads(REG.read_text()) if REG.exists() else {}


def anotar(k, v):
    d = cargar(); d[k] = {**d.get(k, {}), **v}
    REG.parent.mkdir(exist_ok=True)
    REG.write_text(json.dumps(d, indent=2, ensure_ascii=False))


def pedir_cuadro():
    if "cuadro" in cargar():
        print("  · el cuadro ya esta pedido"); return
    r = rz("submit_image_generation", {
        "project_id": PROYECTO, "output_path": "assets/escena_cuadro.png",
        "prompt": CUADRO, "size": "1152x2048", "transparent": False})
    if "task_id" not in r:
        print("  ✗", r); return
    anotar("cuadro", {"task_id": r["task_id"], "output_path": r["output_path"]})
    print("  ✓ cuadro pedido")


def pedir_video():
    d = cargar()
    if "video" in d:
        print("  · el video ya esta pedido"); return
    url = d.get("cuadro", {}).get("public_url")
    if not url:
        print("  ✗ falta el public_url del cuadro: corre `bajar` primero"); return
    r = rz("submit_video_generation", {
        "project_id": PROYECTO, "output_path": "assets/escena_hongo.mp4",
        "prompt": VIDEO, "seconds": 5, "resolution": "720p", "ratio": "9:16",
        "source_url": url})
    if "task_id" not in r:
        print("  ✗", r); return
    anotar("video", {"task_id": r["task_id"], "output_path": r["output_path"]})
    print("  ✓ video pedido")


def bajar():
    d = cargar()
    for vuelta in range(150):
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
                    if it.get("error") or it.get("failure"):
                        d[k]["error"] = it.get("error") or it.get("failure")
        for k2, v2 in d.items():
            anotar(k2, v2)
        listos = sum(1 for x in d.values() if x.get("estado") == "ready")
        print(f"  vuelta {vuelta+1}: {listos}/{len(d)} listos", flush=True)
        if listos == len(d):
            break
        time.sleep(15)
    for k, x in d.items():
        if x.get("estado") != "ready" or x.get("local"):
            continue
        r = rz("fetch_generated_asset", {"project_id": PROYECTO, "output_path": x["output_path"]})
        if "absolute_path" in r:
            x["local"] = r["absolute_path"]; x["public_url"] = r["public_url"]
            print(f"  ↓ {k}: {r['bytes']//1024} KB")
        else:
            print(f"  ✗ {k}: {r}")
        anotar(k, x)


if __name__ == "__main__":
    modo = sys.argv[1] if len(sys.argv) > 1 else "estado"
    if modo == "cuadro":
        pedir_cuadro()
    elif modo == "video":
        pedir_video()
    elif modo == "bajar":
        bajar()
    else:
        for k, x in cargar().items():
            print(f"  {k}: {x.get('estado', 'pendiente')} {x.get('local', '')} {x.get('error', '')}")

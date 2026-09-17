#!/usr/bin/env python3
"""Genera el tema de un juego y lo deja listo para meterlo en el archivo único.

    python3 herramientas/audio/generar_musica.py pedir paraguas
    python3 herramientas/audio/generar_musica.py bajar paraguas
    python3 herramientas/audio/generar_musica.py preparar paraguas

POR QUE UN SOLO SCRIPT PARA LOS TRES JUEGOS. El arte de cada juego es distinto y
vive en su carpeta, pero esto es siempre lo mismo: pedir un tema, esperarlo,
recortarlo a un bucle y bajarle el peso. Tres copias de este archivo se
desincronizarían en el primer ajuste de bitrate.

LO QUE MAS IMPORTA ACA ES EL PESO. El juego se manda como UN archivo HTML, y
adentro el audio va en base64, que infla un 37%. Un mp3 estéreo de 128 kbps y 30
segundos son 470 KB → 640 KB de base64, o sea más que el juego entero. Mono, 48
kbps y 22 segundos son 130 KB → 180 KB de base64: se nota, pero el juego sigue
entrando en un mail.

Y EL BUCLE TIENE QUE CERRAR. Un tema generado termina como termina: puesto a
repetir, se escucha el corte cada treinta segundos y es lo único que se escucha.
Acá se recorta un pedazo del medio —el principio de un tema generado suele ser
una entrada lenta— y se le cruza el final con el principio, así que el punto de
repetición es una mezcla de los dos y no un salto. El tope del modelo son
treinta segundos, así que el bucle son veintidós: cortos, pero cerrados.
"""
import json, pathlib, subprocess, sys, time

RAIZ = pathlib.Path(__file__).resolve().parents[2]
RZ = RAIZ / "herramientas" / "rezona" / "rz.py"
PROYECTO = "xVuxCcKGYO"

# El tema de cada juego. Instrumental y sin voz: una voz cantando arriba de un
# juego se vuelve insoportable a la tercera partida, y estas partidas duran un
# minuto.
TEMAS = {
  "paraguas": {
    "prompt": ("Looping instrumental background music for a fast arcade falling game. Driving "
               "sixteenth-note synth arpeggio, punchy analog bass, gritty sci-fi laboratory "
               "atmosphere, light electronic percussion, slightly unhinged and playful. Steady "
               "tempo around 132 BPM. Purely instrumental, no vocals, no singing, no speech."),
    "desde": 4, "largo": 24, "kbps": 48,
  },
  "garfio": {
    "prompt": ("Looping instrumental background music for a night-time climbing game. Slow "
               "synthwave pulse, deep warm bass, wide airy pads, sparse metallic percussion, "
               "patient and a little lonely. Steady tempo around 100 BPM. Purely instrumental, "
               "no vocals, no singing, no speech."),
    "desde": 4, "largo": 24, "kbps": 48,
  },
  "espejo": {
    "prompt": ("Looping instrumental background music for a calm puzzle game. Sparse glassy "
               "bell tones, soft warm pads, a gentle low pulse, lots of space between the notes, "
               "contemplative and unhurried. No drums. Purely instrumental, no vocals, no "
               "singing, no speech."),
    "desde": 4, "largo": 25, "kbps": 40,
  },
}


def ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def rz(nombre, args, timeout=1800):
    r = subprocess.run([sys.executable, str(RZ), "call", nombre, json.dumps(args)],
                       cwd=RAIZ / "paraguas", capture_output=True, text=True, timeout=timeout)
    s = r.stdout.strip()
    try:
        return json.loads(s[s.index("{"):])
    except Exception:
        return {"error": (s or r.stderr)[-400:]}


def reg(juego):
    return RAIZ / juego / "assets" / "musica.json"


def cargar(juego):
    f = reg(juego)
    return json.loads(f.read_text()) if f.exists() else {}


def anotar(juego, v):
    d = {**cargar(juego), **v}
    reg(juego).parent.mkdir(parents=True, exist_ok=True)
    reg(juego).write_text(json.dumps(d, indent=2, ensure_ascii=False))


def pedir(juego):
    d = cargar(juego)
    if d.get("task_id"):
        print(f"  · {juego} ya pedido"); return
    r = rz("submit_audio_generation", {
        "project_id": PROYECTO, "output_path": f"assets/tema_{juego}.mp3",
        # TREINTA SEGUNDOS ES EL TOPE del modelo de música: 35 ya da error de
        # validación. Probado, no supuesto.
        "prompt": TEMAS[juego]["prompt"], "kind": "music", "duration": 30})
    if "task_id" not in r:
        print(f"  ✗ {juego}: {r}"); return
    anotar(juego, {"task_id": r["task_id"], "output_path": r["output_path"]})
    print(f"  ✓ {juego}")


def bajar(juego):
    d = cargar(juego)
    if not d.get("task_id"):
        print(f"  · {juego} no fue pedido"); return
    for vuelta in range(120):
        if d.get("estado") in ("ready", "failed"):
            break
        r = rz("check_generation_tasks", {"task_ids": [d["task_id"]], "project_id": PROYECTO})
        for it in r.get("items", []):
            d["estado"] = it["status"]
            if it.get("asset_path"):
                d["output_path"] = it["asset_path"]
        anotar(juego, d)
        if d.get("estado") in ("ready", "failed"):
            break
        print(f"  {juego}: vuelta {vuelta + 1}…", flush=True)
        time.sleep(12)
    if d.get("estado") != "ready":
        print(f"  ✗ {juego}: {d.get('estado')}"); return
    if not d.get("local"):
        r = rz("fetch_generated_asset", {"project_id": PROYECTO, "output_path": d["output_path"]})
        if "absolute_path" in r:
            d["local"] = r["absolute_path"]
            print(f"  ↓ {juego}: {r['bytes'] // 1024} KB")
        anotar(juego, d)


def preparar(juego):
    """Recortar el bucle, cruzar las puntas y bajar el peso."""
    d = cargar(juego)
    cfg = TEMAS[juego]
    origen = d.get("local")
    if not origen or not pathlib.Path(origen).exists():
        print(f"  · {juego}: falta el archivo"); return
    destino = RAIZ / juego / "assets" / "arte" / "tema.mp3"
    destino.parent.mkdir(parents=True, exist_ok=True)
    cruce = 2.0
    largo = cfg["largo"]
    # EL CRUCE SE HACE A MANO Y NO CON `acrossfade` ENTRE DOS ENTRADAS, porque
    # acrossfade pega dos cosas distintas y acá las dos son el MISMO pedazo: se
    # toma el bucle completo, se le baja el volumen al principio y se le suma
    # arriba la cola del tema, que viene bajando. El resultado es un archivo que
    # empieza igual que termina.
    filtro = (
        f"[0:a]atrim=start={cfg['desde']}:duration={largo},asetpts=N/SR/TB[cuerpo];"
        f"[cuerpo]asplit=2[a][b];"
        f"[a]atrim=start=0:duration={largo - cruce},asetpts=N/SR/TB[medio];"
        f"[b]atrim=start={largo - cruce}:duration={cruce},asetpts=N/SR/TB,"
        f"afade=t=out:st=0:d={cruce}[cola];"
        f"[medio]afade=t=in:st=0:d={cruce}[medio2];"
        f"[medio2][cola]amix=inputs=2:duration=first:dropout_transition=0,"
        f"volume=2,loudnorm=I=-16:TP=-1.5:LRA=11[fin]"
    )
    cmd = [ffmpeg(), "-y", "-i", origen, "-filter_complex", filtro, "-map", "[fin]",
           "-ac", "1", "-ar", "32000", "-b:a", f"{cfg['kbps']}k", str(destino)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"  ✗ {juego}: ffmpeg\n{r.stderr[-600:]}"); return
    kb = destino.stat().st_size / 1024
    print(f"  {juego}: {largo - cruce:.0f} s de bucle · {kb:.0f} KB · "
          f"{kb * 1.37:.0f} KB adentro del archivo único")


if __name__ == "__main__":
    modo = sys.argv[1] if len(sys.argv) > 1 else "estado"
    juegos = sys.argv[2:] or list(TEMAS)
    for j in juegos:
        if modo == "pedir": pedir(j)
        elif modo == "bajar": bajar(j)
        elif modo == "preparar": preparar(j)
        else: print(f"  {j}: {cargar(j).get('estado', 'pendiente')} {cargar(j).get('local', '')}")

#!/usr/bin/env python3
"""Las voces de Rilo y Tito: se generan, se recortan y se pegan en un atlas.

    python3 generar_voces.py pedir      # 1) mandar cada linea a generar
    python3 generar_voces.py bajar      # 2) esperar y descargar
    python3 generar_voces.py armar      # 3) recortar, afinar y armar el atlas

LAS LINEAS NO SE ESCRIBEN ACA: se leen de js/nivel.js. Copiadas a mano, alguna
se corrige en un lado y no en el otro, y a partir de ahi el personaje dice una
cosa en el cartel y otra por el parlante. Se parsean del propio codigo del
juego, asi que no pueden discrepar.

LAS DOS VOCES SALEN DE UNA. El generador da una sola voz: Rilo y Tito se
separan despues, corriendoles el tono con ffmpeg —el viejo mas grave, el pibe
mas agudo— y devolviendo la velocidad a la original. Es mas controlable que
pedir dos voces distintas y que encima queden parecidas.

EL RECORTE NO ES OPCIONAL. El generador devuelve ocho segundos para una linea
de tres: lee el texto y despues sigue con algo mas. Se corta en el primer
silencio largo, que es donde termina la lectura buena. Medido en la primera
prueba: 3,0 s de habla, 0,73 de silencio, y despues otra cosa.

Y TODO ES ORIGINAL. Son lineas escritas para este juego, dichas por una voz
sintetizada. No hay nada aca sacado de ningun lado.
"""
import json, pathlib, re, subprocess, sys, time

AQUI = pathlib.Path(__file__).parent
RZ = AQUI.parent / "herramientas" / "rezona" / "rz.py"
PROYECTO = "xVuxCcKGYO"
REG = AQUI / "assets" / "voces.json"
CRUDO = AQUI / "assets" / "voz"
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()

# El tono de cada uno, como multiplicador de la frecuencia de muestreo. Subirlo
# sube el tono Y la velocidad, asi que despues se devuelve la velocidad con
# atempo: queda el tono movido y el ritmo intacto.
TONO = {"Rilo": 0.84, "Tito": 1.15}


def lineas():
    """Sacar los dialogos de js/nivel.js, en orden y con su clave."""
    src = (AQUI / "js" / "nivel.js").read_text(encoding="utf-8")
    corte = src.index("export const FINAL")
    caps, final = src[:corte], src[corte:]
    par = re.compile(r'\["(Rilo|Tito)",\s*"((?:[^"\\]|\\.)*)"\]')
    fuera = []
    for i, bloque in enumerate(re.findall(r"dice:\s*\[(.*?)\]\s*\}", caps, re.S)):
        for j, (quien, texto) in enumerate(par.findall(bloque)):
            fuera.append((f"c{i}l{j}", quien, texto))
    for j, (quien, texto) in enumerate(par.findall(final)):
        fuera.append((f"f{j}", quien, texto))
    return fuera


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


def pedir():
    d = cargar()
    for clave, quien, texto in lineas():
        if clave in d and d[clave].get("task_id"):
            print(f"  · {clave} ya pedido"); continue
        # El servidor acepta doce generaciones en vuelo y rechaza la trece con
        # un error que dice explicitamente "transient": esperar y reintentar es
        # la respuesta correcta, no abandonar la linea.
        for intento in range(8):
            r = rz("submit_audio_generation", {
                "project_id": PROYECTO, "output_path": f"assets/voz_{clave}.mp3",
                "prompt": texto, "kind": "speech", "output_format": "mp3"})
            if "task_id" in r:
                break
            if "TOO_MANY_IN_FLIGHT" not in str(r):
                break
            espera = 20 * (intento + 1)
            print(f"    · cola llena, espero {espera}s", flush=True)
            time.sleep(espera)
        if "task_id" not in r:
            print(f"  ✗ {clave}: {r}"); continue
        anotar(clave, {"task_id": r["task_id"], "output_path": r["output_path"],
                       "quien": quien, "texto": texto})
        print(f"  ✓ {clave} {quien}: {texto[:44]}")


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
        listos = sum(1 for x in d.values() if x.get("estado") in ("ready", "failed"))
        print(f"  vuelta {vuelta + 1}: {listos}/{len(d)}", flush=True)
        if listos == len(d):
            break
        time.sleep(12)
    CRUDO.mkdir(parents=True, exist_ok=True)
    for k, x in d.items():
        if x.get("estado") != "ready" or x.get("local"):
            continue
        r = rz("fetch_generated_asset", {"project_id": PROYECTO, "output_path": x["output_path"]})
        if "absolute_path" in r:
            x["local"] = r["absolute_path"]
            print(f"  ↓ {k}: {r['bytes'] // 1024} KB")
        else:
            print(f"  ✗ {k}: {r}")
        anotar(k, x)


def ff(args):
    return subprocess.run([FF, "-y", "-loglevel", "error"] + args,
                          capture_output=True, text=True)


def fin_de_lectura(ruta, texto):
    """Dónde termina la lectura buena.

    DOS CORTES, y hacen falta los dos. El primero es el silencio: el generador
    lee la línea y después sigue con otra cosa, y entre las dos deja un hueco.
    El segundo es un TOPE POR LARGO DEL TEXTO, porque en varias líneas no deja
    ningún hueco y devuelve treinta y ocho segundos seguidos para un "Sí." de
    tres letras. Once caracteres por segundo es habla lenta: lo que pase de
    ahí no es la línea.
    """
    r = subprocess.run([FF, "-i", str(ruta), "-af",
                        "silencedetect=noise=-38dB:d=0.25", "-f", "null", "-"],
                       capture_output=True, text=True)
    fin = duracion(ruta)
    for m in re.finditer(r"silence_start: ([\d.]+)", r.stderr):
        t = float(m.group(1))
        # Un silencio en el primer medio segundo es la respiración del arranque,
        # no el final de la frase.
        if t > 0.55:
            fin = t + 0.12
            break
    return min(fin, max(1.0, len(texto) / 11))


def duracion(ruta):
    r = subprocess.run([FF, "-i", str(ruta)], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)) if m else 0.0


def armar():
    d = cargar()
    orden = [(k, q, t) for k, q, t in lineas() if d.get(k, {}).get("local")]
    if not orden:
        print("  ✗ no hay nada bajado; corré `bajar` primero"); return
    trozos, indice, t0 = [], {}, 0.0
    SILENCIO = 0.18          # separación entre clips dentro del atlas
    tmp = CRUDO / "tmp"
    tmp.mkdir(exist_ok=True)
    for k, quien, texto in orden:
        origen = pathlib.Path(d[k]["local"])
        fin = fin_de_lectura(origen, texto)
        tono = TONO[quien]
        limpio = tmp / f"{k}.wav"
        # asetrate mueve tono y velocidad juntos; atempo devuelve la velocidad.
        # loudnorm deja todos los clips al mismo volumen: sin eso hay que
        # subirle el volumen al teléfono para una línea y bajarlo para la
        # siguiente.
        # EL aresample DE ADELANTE NO ES REDUNDANTE. asetrate reinterpreta la
        # frecuencia de muestreo, así que su efecto depende de a qué frecuencia
        # venía el archivo — y el generador devuelve unos a 22050 y otros a
        # 44100. Sin normalizar antes, los de 44100 salían al DOBLE de largo.
        filtro = (f"atrim=0:{fin:.3f},aresample=22050,asetrate=22050*{tono},aresample=22050,"
                  f"atempo={1 / tono:.4f},loudnorm=I=-18:TP=-2,"
                  f"afade=t=out:st={max(0.05, fin - 0.08):.3f}:d=0.08")
        r = ff(["-i", str(origen), "-af", filtro, "-ac", "1", "-ar", "22050", str(limpio)])
        if r.returncode != 0:
            print(f"  ✗ {k}: {r.stderr[-160:]}"); continue
        largo = duracion(limpio)
        indice[k] = [round(t0, 3), round(largo, 3)]
        trozos.append(limpio)
        t0 += largo + SILENCIO
        print(f"  · {k} {quien} {largo:.2f}s ({fin:.2f}s crudos)")

    # UN SOLO ARCHIVO Y NO VEINTIDÓS. Sueltos son veintidós pedidos de red,
    # veintidós decodificaciones y veintidós bloques base64 en el archivo
    # único. Pegados, es un decode y un índice de posiciones.
    lista = tmp / "lista.txt"
    partes = []
    for t in trozos:
        partes.append(f"file '{t.name}'")
        partes.append(f"file 'silencio.wav'")
    ff(["-f", "lavfi", "-i", f"anullsrc=r=22050:cl=mono", "-t", str(SILENCIO),
        str(tmp / "silencio.wav")])
    lista.write_text("\n".join(partes))
    salida = AQUI / "assets" / "voces.mp3"
    r = ff(["-f", "concat", "-safe", "0", "-i", str(lista),
            "-ac", "1", "-ar", "22050", "-b:a", "32k", str(salida)])
    if r.returncode != 0:
        print("  ✗ concat:", r.stderr[-300:]); return
    (AQUI / "assets" / "voces_indice.json").write_text(
        json.dumps(indice, indent=1, ensure_ascii=False))
    # Y el módulo que lee el juego. Se escribe acá y no se edita a mano: si el
    # índice y el mp3 se desincronizan, cada línea suena la de al lado.
    cuerpo = ",\n".join(f"  {k}: [{v[0]}, {v[1]}]" for k, v in indice.items())
    (AQUI / "js" / "voces.js").write_text(
        "// Dónde empieza y cuánto dura cada línea dentro de assets/voces.mp3.\n"
        "//\n"
        "// UN SOLO MP3 CON LAS VEINTITRÉS LÍNEAS PEGADAS. Sueltas serían veintitrés\n"
        "// pedidos de red, veintitrés decodificaciones y —en el archivo único—\n"
        "// veintitrés bloques de base64. Así es un pedido, un decode, y reproducir una\n"
        "// línea es `start(0, desde, largo)`.\n"
        "//\n"
        "// LO ESCRIBE `python3 generar_voces.py armar`: no se edita a mano.\n"
        "export const VOCES = {\n" + cuerpo + ",\n};\n", encoding="utf-8")
    kb = salida.stat().st_size / 1024
    print(f"\n  voces.mp3: {kb:.0f} KB · {len(indice)} líneas · {t0:.1f}s")


if __name__ == "__main__":
    modo = sys.argv[1] if len(sys.argv) > 1 else "estado"
    if modo == "pedir":
        pedir()
    elif modo == "bajar":
        bajar()
    elif modo == "armar":
        armar()
    elif modo == "lineas":
        for k, q, t in lineas():
            print(f"  {k:5} {q:5} {t}")
    else:
        for k, x in cargar().items():
            print(f"  {k}: {x.get('estado', 'pendiente')} {x.get('error', '')}")

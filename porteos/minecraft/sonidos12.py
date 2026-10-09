#!/usr/bin/env python3
"""Los sonidos de la 1.2 → un solo .ogg (Opus, mono) con todos uno atrás del otro y la tabla de dónde
empieza y cuánto dura cada uno. Los .fsb (FSB5 de FMOD, uno por sonido, FADPCM o PCM) se
decodifican con el decodificador del port de Craftsman (sonidos.py, el algoritmo de vgmstream).

La 1.2 los nombra en sounds/sound_definitions.json: evento ("dig.stone", "mob.pig.say") → archivos
("sounds/dig/stone1", ...). Se guardan sólo los eventos que usa el motor: cada segundo de sonido son
~86 KB de memoria una vez decodificado (a 22 kHz).
"""
import struct
import subprocess
import tempfile
from pathlib import Path

import numpy as np

from sonidos import SEPARACION, decodificar, remuestrear

SALIDA_HZ = 48000
PREFIJOS = ("dig.", "step.", "damage.", "game.player.", "fire.", "liquid.", "jump.",
            "mob.pig.", "mob.cow.", "mob.sheep.", "mob.chicken.", "mob.zombie.", "mob.skeleton.",
            "mob.creeper.", "mob.spider.")
SUELTOS = {"random.click", "random.glass", "random.pop", "random.splash", "random.swim", "random.door_open",
           "random.door_close", "random.chestopen", "random.chestclosed", "random.fizz", "random.break",
           "random.orb", "random.levelup", "random.hurt", "random.fuse", "random.explode", "random.bow",
           "random.bowhit", "random.burp", "random.eat"}
# lo que no suena en el motor (de los bichos: montarlos, ordeñar, poner huevos, curar aldeanos, romper
# puertas)
FUERA = ("mob.cow.milk", "mob.chicken.plop", "mob.pig.boost", "mob.sheep.shear", "mob.zombie.remedy",
         "mob.zombie.unfect", "mob.zombie.wood")


def sacar(apk, salida, base):
    """apk: el Apk de empaquetar.py, base: la carpeta del paquete de recursos; deja sonidos.ogg en
    salida y devuelve {evento: [[inicio, dur], ...]}."""
    defs = apk.json(base + "sounds/sound_definitions.json")
    usados = {}
    for ev, v in defs.items():
        if not (ev.startswith(PREFIJOS) or ev in SUELTOS) or ev.startswith(FUERA) or not isinstance(v, dict):
            continue
        archivos = [s if isinstance(s, str) else s.get("name") for s in v.get("sounds", [])]
        archivos = [a for a in archivos if a and (base + a + ".fsb") in apk.nombres]
        if archivos:
            usados[ev] = archivos
    unicos = sorted({a for l in usados.values() for a in l})
    partes, lugar, t0 = [], {}, 0.0
    hueco = np.zeros(int(SEPARACION * SALIDA_HZ), np.float32)
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d)
        for a in unicos:
            x, hz = decodificar(apk.bytes(base + a + ".fsb"))
            x = remuestrear(x, hz, SALIDA_HZ, tmp)
            lugar[a] = [round(t0, 4), round(len(x) / SALIDA_HZ, 4)]
            partes += [x, hueco]
            t0 += (len(x) + len(hueco)) / SALIDA_HZ
        todo = np.concatenate(partes)
        wav = tmp / "todo.wav"
        pcm = (np.clip(todo, -1, 1) * 32767).astype("<i2")
        with open(wav, "wb") as f:
            f.write(b"RIFF" + struct.pack("<I", 36 + pcm.nbytes) + b"WAVEfmt " +
                    struct.pack("<IHHIIHH", 16, 1, 1, SALIDA_HZ, SALIDA_HZ * 2, 2, 16) +
                    b"data" + struct.pack("<I", pcm.nbytes) + pcm.tobytes())
        # opusenc respeta el "pre-skip": lo decodificado empieza justo donde empezaba el .wav, así
        # los tiempos de la tabla valen tal cual
        subprocess.run(["opusenc", "--quiet", "--bitrate", "40", "--framesize", "20", "--comp", "10",
                        str(wav), str(salida / "sonidos.ogg")], check=True)
    tabla = {ev: [lugar[a] for a in l] for ev, l in usados.items()}
    print(f"sonidos: {len(unicos)} archivos, {len(tabla)} eventos, {t0:.1f} s, {(salida / 'sonidos.ogg').stat().st_size} bytes")
    return tabla

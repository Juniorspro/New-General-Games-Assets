#!/usr/bin/env python3
"""Los sonidos de la 1.2 → .ogg (Opus, mono) con los sonidos uno atrás del otro y la tabla de dónde
empieza y cuánto dura cada uno. Los .fsb (FSB5 de FMOD, uno por sonido, FADPCM o PCM) se
decodifican con el decodificador del port de Craftsman (sonidos.py, el algoritmo de vgmstream).

La 1.2 los nombra en sounds/sound_definitions.json: evento ("dig.stone", "mob.pig.say") → archivos
("sounds/dig/stone1", ...). Se guardan sólo los eventos que usa el motor: cada segundo de sonido son
~86 KB de memoria una vez decodificado (a 22 kHz). Por eso van en paquetes: sonidos.ogg con lo de
siempre (romper, pisar, el jugador, el agua...) y uno por bicho (sonidos_zombie.ogg...), que el juego
decodifica recién cuando ese bicho aparece: todos juntos eran 640 s, más de 50 MB de memoria.
"""
import struct
import subprocess
import tempfile
from pathlib import Path

import numpy as np

from sonidos import SEPARACION, decodificar, remuestrear

SALIDA_HZ = 48000
PREFIJOS = ("dig.", "step.", "damage.", "game.player.", "fire.", "liquid.", "jump.")
SUELTOS = {"random.click", "random.glass", "random.pop", "random.splash", "random.swim", "random.door_open",
           "random.door_close", "random.chestopen", "random.chestclosed", "random.fizz", "random.break",
           "random.orb", "random.levelup", "random.hurt", "random.fuse", "random.explode", "random.bow",
           "random.bowhit", "random.burp", "random.eat", "random.drink", "mob.attack"}
# lo que no suena en el motor (de los bichos: montarlos, ordeñar, poner huevos, curar aldeanos, romper
# puertas)
FUERA = ("mob.cow.milk", "mob.chicken.plop", "mob.pig.boost", "mob.sheep.shear", "mob.zombie.remedy",
         "mob.zombie.unfect", "mob.zombie.wood")
# de cada evento, cuántas variantes como mucho y cuánto de cada una (el rugido del dragón, el
# nacimiento del wither: se cortan con un desvanecido)
MAX_VARIANTES = 4
MAX_SEG = 4.0


def _archivos(apk, base, defs, ev):
    v = defs.get(ev)
    if not isinstance(v, dict):
        return []
    archivos = [s if isinstance(s, str) else s.get("name") for s in v.get("sounds", [])]
    archivos = [a for a in archivos if a and (base + a + ".fsb") in apk.nombres]
    return archivos[:MAX_VARIANTES]


def _codificar(apk, base, usados, archivo, tmp, bitrate):
    """usados: {evento: [archivos]} → archivo .ogg y la tabla {evento: [[inicio, dur], ...]}"""
    unicos = sorted({a for l in usados.values() for a in l})
    partes, lugar, t0 = [], {}, 0.0
    hueco = np.zeros(int(SEPARACION * SALIDA_HZ), np.float32)
    for a in unicos:
        x, hz = decodificar(apk.bytes(base + a + ".fsb"))
        x = remuestrear(x, hz, SALIDA_HZ, tmp)
        n = int(MAX_SEG * SALIDA_HZ)
        if len(x) > n:
            x = x[:n].copy()
            f = int(0.15 * SALIDA_HZ)
            x[-f:] *= np.linspace(1, 0, f, dtype=np.float32)
        lugar[a] = [round(t0, 4), round(len(x) / SALIDA_HZ, 4)]
        partes += [x, hueco]
        t0 += (len(x) + len(hueco)) / SALIDA_HZ
    todo = np.concatenate(partes) if partes else np.zeros(1, np.float32)
    wav = tmp / "todo.wav"
    pcm = (np.clip(todo, -1, 1) * 32767).astype("<i2")
    with open(wav, "wb") as f:
        f.write(b"RIFF" + struct.pack("<I", 36 + pcm.nbytes) + b"WAVEfmt " +
                struct.pack("<IHHIIHH", 16, 1, 1, SALIDA_HZ, SALIDA_HZ * 2, 2, 16) +
                b"data" + struct.pack("<I", pcm.nbytes) + pcm.tobytes())
    # opusenc respeta el "pre-skip": lo decodificado empieza justo donde empezaba el .wav, así los
    # tiempos de la tabla valen tal cual
    subprocess.run(["opusenc", "--quiet", "--bitrate", str(bitrate), "--framesize", "20", "--comp", "10",
                    str(wav), str(archivo)], check=True)
    return {ev: [lugar[a] for a in l] for ev, l in usados.items()}, t0, len(unicos)


def sacar(apk, salida, base, grupos=None):
    """apk: el Apk de empaquetar.py, base: la carpeta del paquete de recursos, grupos: {bicho: eventos}
    (de sounds.json). Deja sonidos.ogg y sonidos_<bicho>.ogg en salida y devuelve
    {"base": {evento: [[inicio, dur], ...]}, "grupos": {bicho: {evento: ...}}}."""
    defs = apk.json(base + "sounds/sound_definitions.json")
    grupos = dict(grupos or {})
    comun = set(grupos.pop("_base", ()))
    usados = {}
    for ev in defs:
        if ((ev.startswith(PREFIJOS) or ev in SUELTOS or ev in comun) and not ev.startswith(FUERA)):
            l = _archivos(apk, base, defs, ev)
            if l:
                usados[ev] = l
    res = {"grupos": {}}
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d)
        res["base"], seg, n = _codificar(apk, base, usados, salida / "sonidos.ogg", tmp, 40)
        print(f"sonidos: {n} archivos, {len(usados)} eventos, {seg:.1f} s, {(salida / 'sonidos.ogg').stat().st_size} bytes")
        total, bytes_ = 0.0, 0
        # cada evento va en el paquete del primer bicho que lo usa (el juego carga los de todos los
        # eventos de un bicho cuando aparece)
        duenio = {}
        for bicho, evs in sorted(grupos.items()):
            for ev in evs:
                duenio.setdefault(ev, bicho)
        for bicho, evs in sorted(grupos.items()):
            propios = {}
            for ev in sorted(evs):
                if ev in usados or ev.startswith(FUERA) or duenio.get(ev) != bicho:
                    continue
                l = _archivos(apk, base, defs, ev)
                if l:
                    propios[ev] = l
            if not propios:
                continue
            arch = salida / f"sonidos_{bicho}.ogg"
            res["grupos"][bicho], s, _ = _codificar(apk, base, propios, arch, tmp, 32)
            total += s
            bytes_ += arch.stat().st_size
        print(f"sonidos de bichos: {len(res['grupos'])} paquetes, {total:.1f} s, {bytes_} bytes")
    return res

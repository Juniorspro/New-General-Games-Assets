#!/usr/bin/env python3
"""Los sonidos de Craftsman (FSB5 de FMOD, uno por archivo, casi todos en FADPCM) → un solo .ogg (Opus,
mono) con todos los sonidos uno atrás del otro, y la tabla de dónde empieza y cuánto dura cada uno.

Un solo archivo porque el navegador decodifica de una vez (decodeAudioData) y queda en memoria
listo para sonar sin demora; Opus porque a 40 kb/s los efectos se oyen igual y pesan ~10 veces
menos que el FADPCM original.

FADPCM: el ADPCM propio de FMOD (como el XA de PlayStation): cuadros de 0x8C bytes con 256
muestras, una cabecera de 12 (índices de coeficientes y corrimientos de a 4 bits para cada grupo
de 32 muestras, y las dos muestras anteriores) y 128 bytes de nibbles. Como cada cuadro trae su
propia historia, se decodifican todos los cuadros a la vez (numpy), muestra por muestra. El
algoritmo es el de vgmstream (fadpcm_decoder.c), que lo sacó idéntico de las DLL de FMOD.
"""
import json
import re
import struct
import subprocess
import tempfile
from pathlib import Path

import numpy as np

FRECUENCIAS = {1: 8000, 2: 11000, 3: 11025, 4: 16000, 5: 22050, 6: 24000, 7: 32000, 8: 44100, 9: 48000}
COEF = np.array([(0, 0), (60, 0), (122, 60), (115, 52), (98, 55), (0, 0), (0, 0), (0, 0)], np.int64)
SALIDA_HZ = 48000
SEPARACION = 0.05          # silencio entre sonidos (que el filtro del códec no mezcle uno con otro)

# los eventos que usa el juego (sounds.json trae más: los de los bichos van cuando haya bichos). Cada
# segundo de sonido son ~86 KB de memoria una vez decodificado (a 22 kHz): sólo lo que suena
PREFIJOS = ("dig.", "step.", "damage.", "game.player.", "fire.", "liquid.")
SUELTOS = {"random.click", "random.glass", "random.pop", "random.splash", "random.swim", "random.door_open",
           "random.door_close", "random.chestopen", "random.chestclosed", "random.fizz", "random.break",
           "random.eat", "random.burp", "random.drink", "random.orb", "random.levelup", "random.hurt"}


def fsb5(datos):
    """→ [(canales, frecuencia, cantidad de muestras, bytes de datos)] y el códec."""
    if datos[:4] != b"FSB5":
        raise ValueError("no es FSB5")
    ver, n, tam_muestras, tam_nombres, tam_datos, modo = struct.unpack_from("<IIIIII", datos, 4)
    base = 0x3C if ver == 1 else 0x40
    pos = base
    cabeceras = []
    for _ in range(n):
        h = struct.unpack_from("<Q", datos, pos)[0]
        pos += 8
        hay_mas = h & 1
        frecuencia = FRECUENCIAS.get((h >> 1) & 0xF, 44100)
        canales = 2 if (h >> 5) & 1 else 1
        desde = ((h >> 6) & 0xFFFFFFF) * 32
        muestras = (h >> 34) & 0x3FFFFFFF
        while hay_mas:
            c = struct.unpack_from("<I", datos, pos)[0]
            pos += 4
            hay_mas = c & 1
            tam = (c >> 1) & 0xFFFFFF
            tipo = (c >> 25) & 0x7F
            if tipo == 1:
                canales = datos[pos]
            elif tipo == 2:
                frecuencia = struct.unpack_from("<I", datos, pos)[0]
            pos += tam
        cabeceras.append([canales, frecuencia, muestras, desde])
    inicio = base + tam_muestras + tam_nombres
    sal = []
    for i, (canales, frecuencia, muestras, desde) in enumerate(cabeceras):
        hasta = cabeceras[i + 1][3] if i + 1 < len(cabeceras) else tam_datos
        sal.append((canales, frecuencia, muestras, datos[inicio + desde:inicio + hasta]))
    return sal, modo


def fadpcm(b, canales):
    n = len(b) // 0x8C
    a = np.frombuffer(b[:n * 0x8C], np.uint8).reshape(n, 0x8C)
    coefs = a[:, 0:4].copy().view("<u4")[:, 0].astype(np.int64)
    corr = a[:, 4:8].copy().view("<u4")[:, 0].astype(np.int64)
    h1 = a[:, 8:10].copy().view("<i2")[:, 0].astype(np.int64)
    h2 = a[:, 10:12].copy().view("<i2")[:, 0].astype(np.int64)
    palabras = a[:, 12:].copy().view("<u4").astype(np.int64)   # (n, 32)
    sal = np.empty((n, 256), np.int16)
    k = 0
    for i in range(8):
        indice = ((coefs >> (i * 4)) & 0xF) % 7
        sh = (corr >> (i * 4)) & 0xF
        c1, c2 = COEF[indice, 0], COEF[indice, 1]
        for j in range(4):
            w = palabras[:, i * 4 + j]
            for kk in range(8):
                nib = (w >> (kk * 4)) & 0xF
                nib = np.where(nib >= 8, nib - 16, nib)
                # (nib << 28) >> (22 - sh) en 32 bits = nib << (6 + sh)
                m = ((nib << (6 + sh)) - h2 * c2 + h1 * c1) >> 6
                m = np.clip(m, -32768, 32767)
                sal[:, k] = m
                k += 1
                h2, h1 = h1, m
    if canales > 1:
        # los cuadros van intercalados por canal (0x8C de cada uno)
        n -= n % canales
        sal = sal[:n].reshape(n // canales, canales, 256).transpose(0, 2, 1).reshape(-1, canales)
    else:
        sal = sal.reshape(-1, 1)
    return sal


def decodificar(datos):
    """→ (muestras float32 mono, frecuencia)"""
    lista, modo = fsb5(datos)
    canales, frecuencia, muestras, b = lista[0]
    if modo == 16:
        pcm = fadpcm(b, canales)
    elif modo == 2:
        pcm = np.frombuffer(b[:len(b) // (2 * canales) * 2 * canales], "<i2").reshape(-1, canales)
    else:
        raise ValueError(f"códec {modo} sin soporte")
    pcm = pcm[:muestras].astype(np.float32) / 32768
    return pcm.mean(axis=1), frecuencia


def remuestrear(x, desde, hasta, tmp):
    """con ffmpeg (su filtro es bueno; uno lineal ensucia los agudos de los golpes y pasos)"""
    if desde == hasta:
        return x
    crudo = tmp / "x.f32"
    crudo.write_bytes(x.astype("<f4").tobytes())
    r = subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(desde), "-ac", "1", "-i", str(crudo),
                        "-af", f"aresample={hasta}:resampler=soxr" if soxr() else f"aresample={hasta}",
                        "-f", "f32le", "-"], check=True, capture_output=True)
    return np.frombuffer(r.stdout, "<f4")


_SOXR = None


def soxr():
    global _SOXR
    if _SOXR is None:
        r = subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=8000:cl=mono", "-t", "0.01",
                            "-af", "aresample=16000:resampler=soxr", "-f", "null", "-"], capture_output=True)
        _SOXR = r.returncode == 0
    return _SOXR


def sacar(apk, salida):
    """apk: el Apk de empaquetar.py; deja sonidos.ogg en salida y devuelve {evento: [[inicio, dur], ...]}."""
    base = "assets/sounds/"
    t = apk.texto(base + "sounds.json")
    t = re.sub(r"(?m)^\s*//[^\n]*$", "", t)
    eventos = json.loads(t)
    usados = {}
    for ev, v in eventos.items():
        if not (ev.startswith(PREFIJOS) or ev in SUELTOS) or not isinstance(v, dict):
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
    print(f"sonidos: {len(unicos)} archivos, {t0:.1f} s, {(salida / 'sonidos.ogg').stat().st_size} bytes")
    return tabla

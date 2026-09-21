#!/usr/bin/env python3
"""Cama instrumental propia, a 90 BPM exactos.

Existe porque el proveedor de audio de Rezona estuvo caido tres veces seguidas
(PROVIDER_UNAVAILABLE) y un edit mudo no se entrega. Ventaja lateral: al
generarla yo, el pulso cae EXACTO donde estan los cortes, que es justo lo que
el edit tiene que demostrar. Para publicar se reemplaza por una pista de la
biblioteca de TikTok.

La estructura sigue al montaje, no al reves:
  golpes  0-9   apertura en blanco y negro -> pad solo, sin bateria, y un
                riser en los ultimos dos golpes
  golpe  10     EL GOLPE: entra el color y entra la bateria entera
  golpes 10-24  cuerpo
  golpes 24-28  remate, con doble bombo
  golpes 28-31  cola
"""
import numpy as np, subprocess, sys, imageio_ffmpeg

SR = 44100
BPM = 90.0
NEGRA = 60.0 / BPM
GOLPES = 31
DUR = GOLPES * NEGRA
DROP = 10                                  # golpe donde entra el color

n = int(DUR * SR)
t = np.arange(n) / SR
mezcla = np.zeros(n)


def poner(sonido, en):
    i = int(en * SR)
    j = min(i + len(sonido), n)
    if i < n:
        mezcla[i:j] += sonido[: j - i]


def env(dur, ataque, caida, pot=2.0):
    m = int(dur * SR)
    e = np.ones(m)
    a = max(int(ataque * SR), 1)
    e[:a] = np.linspace(0, 1, a)
    d = np.linspace(1, 0, m - a) ** pot
    e[a:] = d
    return e


def bombo(dur=0.26):
    m = int(dur * SR); x = np.arange(m) / SR
    f = 45 + 110 * np.exp(-x * 42)                    # barrido de 155 a 45 Hz
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 11)
    s += np.sin(2 * np.pi * 1800 * x) * np.exp(-x * 320) * 0.25   # el golpe seco
    return s * 0.95


def caja(dur=0.20):
    m = int(dur * SR); x = np.arange(m) / SR
    ruido = np.random.default_rng(7).standard_normal(m)
    # pasaaltos pobre: le resto una media movil (lo grave) al ruido
    k = 24
    grave = np.convolve(ruido, np.ones(k) / k, mode="same")
    s = (ruido - grave) * np.exp(-x * 26)
    s += np.sin(2 * np.pi * 190 * x) * np.exp(-x * 34) * 0.5
    return s * 0.42


def hat(dur=0.06, g=1.0):
    m = int(dur * SR); x = np.arange(m) / SR
    r = np.random.default_rng(11).standard_normal(m)
    k = 8
    s = (r - np.convolve(r, np.ones(k) / k, mode="same")) * np.exp(-x * 90)
    return s * 0.13 * g


def sub(freq, dur):
    m = int(dur * SR); x = np.arange(m) / SR
    s = np.sin(2 * np.pi * freq * x) + 0.3 * np.sin(2 * np.pi * freq * 2 * x)
    return s * env(dur, 0.012, dur, 1.4) * 0.5


def cuerdas(freqs, dur, g=1.0):
    """Sierras desafinadas y filtradas: el pad tenso."""
    m = int(dur * SR); x = np.arange(m) / SR
    s = np.zeros(m)
    for f in freqs:
        for det in (-0.16, 0.0, 0.16):
            fase = ((x * (f + det)) % 1.0)
            s += (2 * fase - 1)                      # diente de sierra
    k = 30                                            # pasabajos: media movil
    s = np.convolve(s, np.ones(k) / k, mode="same")
    return s * env(dur, 0.35, dur, 1.1) * 0.05 * g


def piano(freq, dur):
    m = int(dur * SR); x = np.arange(m) / SR
    s = (np.sin(2 * np.pi * freq * x)
         + 0.42 * np.sin(2 * np.pi * freq * 2 * x)
         + 0.18 * np.sin(2 * np.pi * freq * 3 * x))
    return s * np.exp(-x * 5.5) * 0.17


NOTA = {"A2":110.00,"C3":130.81,"D3":146.83,"E3":164.81,"F3":174.61,"G3":196.00,
        "A3":220.00,"C4":261.63,"D4":293.66,"E4":329.63,"F4":349.23,"G4":392.00,
        "A4":440.00}
# la menor: Am - F - C - G, cuatro golpes cada uno
ACORDES = [("A2",["A3","C4","E4"]), ("F3",["F3","A3","C4"]),
           ("C3",["C3","E3","G3"]), ("G3",["G3","D4","G4"])]

for b in range(GOLPES):
    en = b * NEGRA
    raiz, triada = ACORDES[(b // 4) % 4]
    # pad: siempre, mas fuerte despues del golpe
    if b % 4 == 0:
        poner(cuerdas([NOTA[x] for x in triada], NEGRA * 4,
                      g=0.8 if b < DROP else 1.5), en)
    if b < DROP:
        if b % 2 == 0:
            poner(bombo() * 0.55, en)                  # bombo suave en la apertura
        if b % 4 == 0:
            poner(piano(NOTA[triada[0]] * 2, NEGRA * 2), en)
    else:
        poner(bombo(), en)                             # bombo en cada negra
        if b % 2 == 1:
            poner(caja(), en)                          # caja en 2 y 4
        poner(hat(g=0.9), en + NEGRA / 2)
        poner(sub(NOTA[raiz] / 2, NEGRA * 0.9), en)
        if b % 4 in (0, 2):
            poner(piano(NOTA[triada[(b // 2) % 3]], NEGRA * 1.5), en)
    if DROP + 14 <= b < DROP + 18:                     # remate: doble bombo
        poner(bombo() * 0.8, en + NEGRA / 2)

# riser: los dos golpes antes del golpe
ri = int((DROP - 2) * NEGRA * SR); rn = int(2 * NEGRA * SR)
x = np.arange(rn) / SR
r = np.random.default_rng(3).standard_normal(rn)
k = 40
agudo = r - np.convolve(r, np.ones(k) / k, mode="same")
mezcla[ri:ri + rn] += agudo * (np.linspace(0, 1, rn) ** 2.2) * 0.22
mezcla[ri:ri + rn] += np.sin(2 * np.pi * np.cumsum(np.linspace(180, 900, rn)) / SR) \
                      * (np.linspace(0, 1, rn) ** 3) * 0.12
poner(bombo() * 1.2, DROP * NEGRA)                     # impacto del golpe

# cola: los ultimos tres golpes bajan
cola = int((GOLPES - 3) * NEGRA * SR)
mezcla[cola:] *= np.linspace(1, 0.05, n - cola)

pico = np.abs(mezcla).max()
mezcla = np.tanh(mezcla / pico * 1.5) * 0.89           # limitador blando
pcm = (mezcla * 32767).astype("<i2")

FF = imageio_ffmpeg.get_ffmpeg_exe()
subprocess.run([FF, "-y", "-v", "error", "-f", "s16le", "-ar", str(SR), "-ac", "1",
                "-i", "-", "-c:a", "aac", "-b:a", "192k", sys.argv[1]],
               input=pcm.tobytes(), check=True)
print(f"{sys.argv[1]}  {DUR:.3f}s  {BPM:.0f} BPM  golpe en {DROP*NEGRA:.3f}s")

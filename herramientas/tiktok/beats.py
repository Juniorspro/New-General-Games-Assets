#!/usr/bin/env python3
"""La grilla de beats REAL de una pista, para cortar encima.

    python3 beats.py pista.mp3 [segundos_max]

Por que no alcanza con el BPM: saber que un tema va a 145 BPM no dice DONDE
esta el uno. Hace falta tempo Y fase, y despues los tiempos de cada golpe.

Como se saca, y por que asi:

1. FLUJO ESPECTRAL, no energia. El pulso esta donde el espectro CAMBIA, no
   donde hay volumen. Con energia cruda un tema con bajo continuo (o sea,
   cualquier phonk) da autocorrelacion plana y BPM basura.
2. TEMPO por autocorrelacion del flujo, buscando entre 60 y 200 BPM.
3. FASE por fuerza bruta: se prueba cada desplazamiento dentro de un periodo
   y gana el que junta mas energia de ataque sobre la grilla.
4. SECCIONES por energia en ventanas de un compas: asi aparece donde entra
   la bateria (el drop), que es donde tiene que caer el golpe visual.
"""
import subprocess
import sys

import imageio_ffmpeg
import numpy as np

FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 22050
VENTANA = 1024
SALTO = 256                                   # ~86 cuadros de analisis por segundo


def cargar(v, segundos=None):
    cmd = [FF, "-v", "quiet"]
    if segundos:
        cmd += ["-t", str(segundos)]
    cmd += ["-i", v, "-f", "s16le", "-acodec", "pcm_s16le",
            "-ar", str(SR), "-ac", "1", "-"]
    r = subprocess.run(cmd, capture_output=True)
    return np.frombuffer(r.stdout, np.int16).astype(np.float32) / 32768.0


def flujo(x):
    """Flujo espectral positivo: cuanto SUBE cada banda de un cuadro al otro."""
    n = (len(x) - VENTANA) // SALTO
    w = np.hanning(VENTANA)
    esp = np.abs(np.fft.rfft(
        np.lib.stride_tricks.as_strided(
            x, (n, VENTANA), (x.strides[0] * SALTO, x.strides[0])) * w, axis=1))
    d = np.diff(esp, axis=0)
    d[d < 0] = 0                              # solo lo que sube
    f = d.sum(axis=1)
    return (f - f.mean()) / (f.std() + 1e-9), SR / SALTO


def tempo(f, fps):
    ac = np.correlate(f, f, mode="full")[len(f) - 1:]
    lo, hi = int(fps * 60 / 200), int(fps * 60 / 60)
    pico = lo + int(np.argmax(ac[lo:hi]))
    return 60.0 * fps / pico, pico / fps


def fase(f, fps, periodo):
    """El desplazamiento que junta mas ataque sobre la grilla."""
    p = periodo * fps
    mejor = (None, -1e18)
    for off in np.arange(0, p, 0.25):
        idx = np.round(np.arange(off, len(f) - 1, p)).astype(int)
        s = f[idx].sum() / len(idx)
        if s > mejor[1]:
            mejor = (off / fps, s)
    return mejor[0]


def secciones(x, periodo, compas=4):
    """Energia por compas: donde salta, entra o sale la bateria."""
    paso = int(periodo * compas * SR)
    n = len(x) // paso
    e = np.array([np.sqrt((x[i * paso:(i + 1) * paso] ** 2).mean()) for i in range(n)])
    return e, paso / SR


def analizar(v, segundos=None):
    x = cargar(v, segundos)
    f, fps = flujo(x)
    bpm, periodo = tempo(f, fps)
    off = fase(f, fps, periodo)
    golpes = np.arange(off, len(x) / SR, periodo)
    e, largo_compas = secciones(x, periodo)
    return {"bpm": bpm, "periodo": periodo, "fase": off, "golpes": golpes,
            "duracion": len(x) / SR, "energia_compas": e, "largo_compas": largo_compas}


if __name__ == "__main__":
    a = analizar(sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else None)
    print(f"{sys.argv[1]}  {a['duracion']:.2f}s")
    print(f"  BPM {a['bpm']:.2f}   negra {a['periodo']*1000:.1f} ms   "
          f"primer golpe en {a['fase']*1000:.0f} ms   {len(a['golpes'])} golpes")
    e = a["energia_compas"]; pico = e.max() or 1
    print(f"\n  energia por compas de {a['largo_compas']:.2f}s:")
    for i, v in enumerate(e):
        print(f"   {i*a['largo_compas']:6.2f}s |{'#'*int(v/pico*46):46s}| {v/pico:.2f}")

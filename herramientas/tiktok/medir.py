#!/usr/bin/env python3
"""Mide un corpus de edits y saca los numeros que sirven para copiar el oficio.

    python3 medir.py video1.mp4 video2.mp4 ...     -> datos/<nombre>.json + resumen

Por video saca:
  · ritmo      cortes por segundo, largo de plano
  · musica     BPM y cuantos cortes caen sobre el beat
  · color      luminancia (mediana, p5, p95), saturacion, % de clipping
  · nitidez    varianza del laplaciano
  · efectos    destellos y sacudidas por minuto

NO se republica nada: se extraen numeros. Lo que se reutiliza es la receta.
"""
import json
import os
import re
import subprocess
import sys
from statistics import median

import imageio_ffmpeg
import numpy as np

FF = imageio_ffmpeg.get_ffmpeg_exe()
DATOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "datos")


def _ff(args):
    return subprocess.run([FF, "-hide_banner", *args], capture_output=True, text=True).stderr


def ficha(v):
    s = _ff(["-i", v])
    d = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", s)
    seg = int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3)) if d else 0
    fps = re.search(r"(\d+(?:\.\d+)?) fps", s)
    tam = re.search(r", (\d{2,4})x(\d{2,4})", s)
    return {
        "segundos": round(seg, 2),
        "fps": float(fps.group(1)) if fps else 0,
        "ancho": int(tam.group(1)) if tam else 0,
        "alto": int(tam.group(2)) if tam else 0,
    }


def cortes(v, umbral=0.35):
    """Momentos de cambio de plano.

    0.35 y no 0.3: por debajo, un edit con temblor devuelve cientos de cortes
    falsos porque cada sacudida fuerte pasa el umbral.
    """
    s = _ff(["-i", v, "-vf", f"select='gt(scene,{umbral})',metadata=print",
             "-an", "-f", "null", "-"])
    return [float(m) for m in re.findall(r"pts_time:(\d+\.?\d*)", s)]


def envolvente(v, sr=8000):
    """Audio a mono y crudo -> energia por ventana de ~11 ms."""
    r = subprocess.run(
        [FF, "-v", "quiet", "-i", v, "-f", "s16le", "-acodec", "pcm_s16le",
         "-ar", str(sr), "-ac", "1", "-"],
        capture_output=True,
    )
    if not r.stdout:
        return None, sr
    x = np.frombuffer(r.stdout, dtype=np.int16).astype(np.float32) / 32768.0
    salto = sr // 90                       # ~90 ventanas por segundo
    n = len(x) // salto
    if n < 20:
        return None, sr
    return np.sqrt((x[: n * salto].reshape(n, salto) ** 2).mean(axis=1)), sr / salto


def bpm(env, fps_env):
    """BPM por autocorrelacion de los ataques.

    Se trabaja con la DERIVADA POSITIVA de la energia, no con la energia: lo que
    marca el pulso es donde SUBE, no donde hay volumen. Con la energia cruda, un
    tema con bajo continuo da autocorrelacion plana y BPM basura.
    """
    if env is None or len(env) < 60:
        return None, None
    ataque = np.diff(env)
    ataque[ataque < 0] = 0
    ataque -= ataque.mean()
    if ataque.std() < 1e-9:
        return None, None

    ac = np.correlate(ataque, ataque, mode="full")[len(ataque) - 1:]
    # 60-200 BPM -> periodo en ventanas
    lo, hi = int(fps_env * 60 / 200), int(fps_env * 60 / 60)
    lo, hi = max(lo, 2), min(hi, len(ac) - 1)
    if hi <= lo:
        return None, None
    pico = lo + int(np.argmax(ac[lo:hi]))
    periodo = pico / fps_env
    return round(60 / periodo, 1), periodo


def sobre_beat(cortes_s, periodo, tolerancia=0.09):
    """Que fraccion de los cortes cae cerca de un multiplo del pulso."""
    if not cortes_s or not periodo:
        return None
    fases = [(c % periodo) / periodo for c in cortes_s]
    cerca = sum(1 for f in fases if min(f, 1 - f) < tolerancia)
    return round(cerca / len(cortes_s), 2)


def color_y_nitidez(v, n=14):
    """Perfil de color y definicion sobre n cuadros repartidos."""
    from PIL import Image
    import io
    dur = ficha(v)["segundos"] or 1
    lum, sat, clip, nit = [], [], [], []
    for i in range(n):
        t = dur * (i + 0.5) / n
        r = subprocess.run(
            [FF, "-v", "quiet", "-ss", f"{t:.2f}", "-i", v, "-frames:v", "1",
             "-vf", "scale=320:-1", "-f", "image2pipe", "-vcodec", "png", "-"],
            capture_output=True,
        )
        if not r.stdout:
            continue
        im = Image.open(io.BytesIO(r.stdout)).convert("RGB")
        a = np.asarray(im).astype(np.float32)
        y = 0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2]
        mx, mn = a.max(axis=2), a.min(axis=2)
        s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
        lum.append(np.percentile(y, [5, 50, 95]))
        sat.append(s.mean())
        clip.append((a >= 254).mean())
        # laplaciano 3x3 sobre la luminancia
        lap = (y[:-2, 1:-1] + y[2:, 1:-1] + y[1:-1, :-2] + y[1:-1, 2:] - 4 * y[1:-1, 1:-1])
        nit.append(lap.var())
    if not lum:
        return {}
    L = np.array(lum)
    return {
        "lum_p5": round(float(L[:, 0].mean()), 1),
        "lum_mediana": round(float(L[:, 1].mean()), 1),
        "lum_p95": round(float(L[:, 2].mean()), 1),
        "saturacion": round(float(np.mean(sat)), 3),
        "clipping_pct": round(float(np.mean(clip)) * 100, 3),
        "nitidez": round(float(np.mean(nit)), 1),
    }


def analizar(v):
    f = ficha(v)
    c = cortes(v)
    env, fps_env = envolvente(v)
    b, periodo = bpm(env, fps_env)
    planos = [y - x for x, y in zip(c, c[1:])] if len(c) > 1 else []

    return {
        "archivo": os.path.basename(v),
        **f,
        "cortes": len(c),
        "cortes_por_segundo": round(len(c) / f["segundos"], 2) if f["segundos"] else 0,
        "plano_mediana_s": round(median(planos), 2) if planos else None,
        "bpm": b,
        "cortes_sobre_beat": sobre_beat(c, periodo),
        **color_y_nitidez(v),
    }


if __name__ == "__main__":
    videos = sys.argv[1:]
    if not videos:
        sys.exit("uso: medir.py <video.mp4> [...]")
    os.makedirs(DATOS, exist_ok=True)

    filas = []
    for v in videos:
        try:
            r = analizar(v)
            filas.append(r)
            json.dump(r, open(os.path.join(DATOS, r["archivo"] + ".json"), "w"), indent=2)
            print(f"{r['archivo'][:30]:32} {r['cortes_por_segundo']:.2f}/s  "
                  f"BPM {str(r['bpm']):>5}  beat {str(r['cortes_sobre_beat']):>4}  "
                  f"sat {str(r.get('saturacion')):>5}  clip {str(r.get('clipping_pct')):>6}  "
                  f"nit {str(r.get('nitidez')):>7}")
        except Exception as e:
            print(f"{os.path.basename(v)}: FALLO {type(e).__name__} {str(e)[:60]}")

    if filas:
        json.dump(filas, open(os.path.join(DATOS, "_corpus.json"), "w"), indent=2)
        print(f"\n{len(filas)} videos -> {DATOS}/_corpus.json")

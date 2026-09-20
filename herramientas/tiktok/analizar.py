#!/usr/bin/env python3
"""Mide la edicion de un video en vez de mirarlo.

    python3 analizar.py *.mp4

Saca, por video: duracion, cortes, largo medio de plano, destellos, y cuanto
contraste y saturacion tiene. Al final promedia todo el corpus.

POR QUE MEDIR Y NO MIRAR: mirando 100 videos uno se acuerda de los efectos
llamativos y se pierde lo que de verdad define el ritmo, que es cada cuanto
corta y cuanto dura cada plano. Eso es un numero, no una impresion.
"""
import json
import re
import subprocess
import sys
from statistics import mean, median

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()


def correr(args):
    return subprocess.run([FF, "-hide_banner", *args],
                          capture_output=True, text=True).stderr


def ficha(v):
    """Duracion, fps y tamaño."""
    s = correr(["-i", v])
    dur = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", s)
    seg = (int(dur.group(1)) * 3600 + int(dur.group(2)) * 60 + float(dur.group(3))) if dur else 0
    fps = re.search(r"(\d+(?:\.\d+)?) fps", s)
    tam = re.search(r", (\d{2,4})x(\d{2,4})", s)
    return {
        "segundos": round(seg, 2),
        "fps": float(fps.group(1)) if fps else 0,
        "ancho": int(tam.group(1)) if tam else 0,
        "alto": int(tam.group(2)) if tam else 0,
    }


def cortes(v, umbral=0.35):
    """Momentos donde cambia el plano.

    El umbral importa: por debajo de 0.3 cuenta como corte cualquier
    movimiento brusco de camara, y un edit con temblor da cientos de cortes
    falsos. 0.35 fue el que separo corte real de sacudida en las pruebas.
    """
    s = correr(["-i", v, "-vf", f"select='gt(scene,{umbral})',metadata=print",
                "-an", "-f", "null", "-"])
    return [float(m) for m in re.findall(r"pts_time:(\d+\.?\d*)", s)]


def brillo_por_cuadro(v, cada=1):
    """Brillo medio de cada cuadro, para encontrar destellos."""
    s = correr(["-i", v, "-vf", f"select='not(mod(n,{cada}))',signalstats,metadata=print",
                "-an", "-f", "null", "-"])
    return [float(m) for m in re.findall(r"lavfi\.signalstats\.YAVG=(\d+\.?\d*)", s)]


def destellos(brillos, salto=38):
    """Un destello es un salto de brillo grande de un cuadro al siguiente."""
    return sum(1 for a, b in zip(brillos, brillos[1:]) if b - a > salto)


def analizar(v):
    f = ficha(v)
    c = cortes(v)
    b = brillo_por_cuadro(v)
    planos = [b - a for a, b in zip(c, c[1:])] if len(c) > 1 else []

    return {
        "archivo": v,
        **f,
        "cortes": len(c),
        "cortes_por_segundo": round(len(c) / f["segundos"], 2) if f["segundos"] else 0,
        "plano_medio_s": round(mean(planos), 2) if planos else None,
        "plano_mediana_s": round(median(planos), 2) if planos else None,
        "plano_mas_corto_s": round(min(planos), 2) if planos else None,
        "destellos": destellos(b),
        "brillo_medio": round(mean(b), 1) if b else None,
        "vertical": f["alto"] > f["ancho"],
    }


if __name__ == "__main__":
    videos = sys.argv[1:]
    if not videos:
        sys.exit("uso: analizar.py <video.mp4> [...]")

    filas = []
    for v in videos:
        try:
            r = analizar(v)
            filas.append(r)
            print(f"{r['archivo'][:26]:28} {r['segundos']:6.1f}s  "
                  f"cortes {r['cortes']:4}  ({r['cortes_por_segundo']:.2f}/s)  "
                  f"plano medio {str(r['plano_medio_s']):>5}s  "
                  f"destellos {r['destellos']:3}")
        except Exception as e:
            print(f"{v}: FALLO {type(e).__name__} {e}")

    if filas:
        cps = [f["cortes_por_segundo"] for f in filas if f["cortes_por_segundo"]]
        med = [f["plano_medio_s"] for f in filas if f["plano_medio_s"]]
        print("\n== corpus ==")
        print(f"videos analizados      {len(filas)}")
        print(f"cortes por segundo     media {mean(cps):.2f} · mediana {median(cps):.2f}")
        print(f"plano medio            media {mean(med):.2f}s · mediana {median(med):.2f}s")
        print(f"destellos por video    media {mean([f['destellos'] for f in filas]):.1f}")
        json.dump(filas, open("analisis.json", "w"), indent=2, ensure_ascii=False)
        print("detalle en analisis.json")

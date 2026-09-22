#!/usr/bin/env python3
"""Mira un TikTok (URL o .mp4) y saca la receta de edición, medida.

    python3 estudiar_tiktok.py <url|archivo.mp4> [carpeta_salida]

Mide: duración, resolución, cortes (ffmpeg scdet) y cortes/s, tempo y beats
(librosa), cuántos cortes caen sobre un beat (±80 ms), saturación y luma
mediana, y arma una hoja de contacto (un cuadro por plano) para verlo.
Descarga con yt-dlp --impersonate chrome (sin eso TikTok devuelve JSON vacío).
"""
import json, os, subprocess, sys
import numpy as np

def sh(*a): return subprocess.run(a, capture_output=True, text=True)

def bajar(url, out):
    r = sh("yt-dlp", "--impersonate", "chrome", "-o", f"{out}/%(id)s.%(ext)s",
           "--print", "after_move:filepath", url)
    return r.stdout.strip().splitlines()[-1]

def cortes(mp4, umbral=10):
    r = sh("ffmpeg", "-i", mp4, "-vf", f"scdet=threshold={umbral},metadata=print",
           "-an", "-f", "null", "-")
    return [float(l.split("lavfi.scd.time=")[1]) for l in r.stderr.splitlines()
            if "lavfi.scd.time=" in l]

def color(mp4):
    import cv2
    cap = cv2.VideoCapture(mp4); n = int(cap.get(7)); sat, luma = [], []
    for i in np.linspace(0, n - 1, 40).astype(int):
        cap.set(1, i); ok, f = cap.read()
        if not ok: continue
        hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV)
        sat.append(hsv[..., 1].mean() / 255); luma.append(np.median(hsv[..., 2]) / 255)
    return round(float(np.mean(sat)), 3), round(float(np.median(luma)), 3)

def ritmo(mp4):
    import librosa
    y, sr = librosa.load(mp4, sr=22050, mono=True)
    if len(y) < sr: return None, []
    t, b = librosa.beat.beat_track(y=y, sr=sr)
    return round(float(np.atleast_1d(t)[0]), 1), librosa.frames_to_time(b, sr=sr).tolist()

def hoja(mp4, tiempos, png):
    tiempos = ([0.05] + [t + 0.05 for t in tiempos])[:24]
    cuadros = []
    for i, t in enumerate(tiempos):
        f = png + f".{i}.jpg"
        sh("ffmpeg", "-y", "-ss", str(t), "-i", mp4, "-frames:v", "1", "-vf", "scale=180:-2", f)
        if os.path.exists(f): cuadros.append(f)
    if cuadros:
        cols = min(8, len(cuadros))
        sh("ffmpeg", "-y", *sum([["-i", c] for c in cuadros], []), "-filter_complex",
           "".join(f"[{i}]" for i in range(len(cuadros))) +
           f"xstack=inputs={len(cuadros)}:grid={cols}x{-(-len(cuadros)//cols)}:fill=black"
           if len(cuadros) > 1 else "null", png)
        for c in cuadros: os.remove(c)

def main():
    fuente = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else "."
    os.makedirs(out, exist_ok=True)
    mp4 = fuente if os.path.exists(fuente) else bajar(fuente, out)
    p = json.loads(sh("ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams",
                      "-show_format", mp4).stdout)
    v = next(s for s in p["streams"] if s["codec_type"] == "video")
    dur = float(p["format"]["duration"]); cs = cortes(mp4)
    tempo, beats = ritmo(mp4); sat, luma = color(mp4)
    en_beat = sum(any(abs(c - b) < .08 for b in beats) for c in cs)
    planos = np.diff([0] + cs + [dur])
    rep = {"archivo": os.path.basename(mp4), "duracion_s": round(dur, 2),
           "resolucion": f'{v["width"]}x{v["height"]}', "fps": v.get("r_frame_rate"),
           "cortes": len(cs), "cortes_por_s": round(len(cs) / dur, 2),
           "plano_mediano_s": round(float(np.median(planos)), 2),
           "tempo_bpm": tempo, "cortes_sobre_beat": f"{en_beat}/{len(cs)}",
           "saturacion": sat, "luma_mediana": luma,
           "tiempos_de_corte": [round(c, 2) for c in cs]}
    hoja(mp4, cs, os.path.splitext(mp4)[0] + "-hoja.jpg")
    print(json.dumps(rep, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    main()

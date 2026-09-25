#!/usr/bin/env python3
"""
Canciones grabadas para BRILLO: de un video (los que manda quien pide, bajados
de TikTok) a un MP3 que el juego repite sin que se note el salto.

    python3 brillo/herramientas/canciones.py analizar <video>
    python3 brillo/herramientas/canciones.py hacer <tema> <video> <a> <b> [--cruce=0.15] [--golpe=s] [--dest=carpeta]

- analizar: el pulso (BPM) y los períodos en que la canción se repite, para
  elegir a y b.
- hacer: el tema es el nombre que usa el juego ('titulo' = el menú, 'colina' =
  el mundo 1, …). a es donde vuelve el bucle y b donde se termina: tienen que
  caer en el mismo lugar del compás (b = a + frases enteras). --golpe es el
  primer tiempo fuerte; si no se da, se busca solo (puede agarrar una anacrusa).

Cómo se cose el bucle (y por qué así):
- De b a b+cruce se funde lo que venía con lo que hay desde a (potencia
  constante, sin pozo de volumen).
- Después se copian 0,4 s más desde a+cruce. El juego salta a la MITAD de esa
  copia, que es igual a lo que hay en a+cruce+0,2. Así, aunque el decodificador
  de MP3 corra todo unos milisegundos (el relleno del codificador), el salto
  cae entre dos pedazos iguales y no hace clic.
- Los videos de TikTok terminan con la animación del logo, que suena: por eso b
  nunca llega al final.
- Se nivela a -16 LUFS con pico -1 dBTP y se comprime en MP3 VBR (q 5), que
  decodifican todos los navegadores. El punto de bucle va a musica/canciones.json.
"""
import json, subprocess, sys, wave
from pathlib import Path
import numpy as np

SR = 44100
AQUI = Path(__file__).resolve().parent.parent
DEST = AQUI / 'musica'
COPIA = 0.4


def leer(video):
    """el audio del video, estéreo a 44,1 kHz, en float"""
    crudo = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(video), '-vn', '-ac', '2', '-ar', str(SR), '-f', 's16le', '-'],
                           capture_output=True, check=True).stdout
    return np.frombuffer(crudo, dtype=np.int16).reshape(-1, 2).astype(np.float64) / 32768


def analizar(video):
    x = leer(video); m = x.mean(1); dur = len(m) / SR
    # el final de TikTok: dónde empieza el silencio y la animación del logo
    hop = int(0.1 * SR)
    rms = np.array([np.sqrt((m[i:i + hop] ** 2).mean()) for i in range(0, len(m) - hop, hop)])
    vivo = np.nonzero(rms > 1e-3)[0]
    print(f'dura {dur:.2f} s; suena hasta {(vivo[-1] + 1) * 0.1:.1f} s (el último segundo y medio suele ser el logo de TikTok)')
    # el pulso, por la autocorrelación de los golpes
    H, N = 256, 1024
    fr = np.lib.stride_tricks.sliding_window_view(m[:int((vivo[-1] * 0.1 - 2) * SR)], N)[::H] * np.hanning(N)
    S = np.log1p(100 * np.abs(np.fft.rfft(fr, axis=1)))
    f = np.maximum(0, np.diff(S, axis=0)).sum(1); f = np.maximum(0, f - np.convolve(f, np.ones(43) / 43, 'same'))
    fps = SR / H; ac = np.correlate(f, f, 'full')[len(f) - 1:]; lag = np.arange(len(ac)) / fps
    ok = (lag > 0.3) & (lag < 1.2); tiempo = lag[np.argmax(ac * ok)]
    print(f'pulso: {tiempo:.4f} s ({60 / tiempo:.1f} BPM; puede ser el doble)')
    # períodos de repetición, por el parecido del espectro
    H2 = int(0.05 * SR); N2 = 4096; frq = np.fft.rfftfreq(N2, 1 / SR); bordes = np.geomspace(60, 12000, 49)
    F = []
    for i in range(0, int((vivo[-1] * 0.1 - 2) * SR) - N2, H2):
        s = np.abs(np.fft.rfft(m[i:i + N2] * np.hanning(N2))) ** 2
        F.append([np.log(s[(frq >= bordes[j]) & (frq < bordes[j + 1])].sum() + 1e-9) for j in range(48)])
    F = np.array(F); F -= F.mean(1, keepdims=True); F /= np.linalg.norm(F, axis=1, keepdims=True) + 1e-9
    res = []
    for L in range(int(6 / 0.05), len(F) - int(3 / 0.05)):
        s = (F[:-L] * F[L:]).sum(1); w = int(3 / 0.05); c = np.convolve(s, np.ones(w) / w, 'valid'); j = int(c.argmax())
        res.append((c[j], L * 0.05, j * 0.05))
    res.sort(reverse=True)
    for c, L, t in res[:10]: print(f'  se repite cada {L:6.2f} s (desde {t:5.2f} s, parecido {c:.3f})')


def primer_golpe(m):
    """el primer golpe fuerte: el juego hace sonar la canción de modo que caiga
    0,4 s después de pedirla, como los temas sintetizados (y el tráiler lo pide
    0,4 s antes del compás)"""
    H, N = 64, 512
    fr = np.lib.stride_tricks.sliding_window_view(m, N)[::H] * np.hanning(N)
    S = np.log1p(50 * np.abs(np.fft.rfft(fr, axis=1)))
    f = np.concatenate([[0], np.maximum(0, np.diff(S, axis=0)).sum(1)])
    i = int(np.nonzero(f >= 0.6 * f.max())[0][0])
    return i * H / SR


def hacer(tema, video, a, b, cruce=0.15, golpe=None):
    x = leer(video)
    ia, ib, nx, nc = int(round(a * SR)), int(round(b * SR)), int(round(cruce * SR)), int(round(COPIA * SR))
    if ib + nx > len(x): raise SystemExit('b + cruce se pasa del final')
    k = np.linspace(0, 1, nx, endpoint=False)[:, None]
    funde = x[ib:ib + nx] * np.cos(k * np.pi / 2) + x[ia:ia + nx] * np.sin(k * np.pi / 2)
    y = np.concatenate([x[:ib], funde, x[ia + nx:ia + nx + nc]])
    DEST.mkdir(exist_ok=True)
    tmp = DEST / f'.{tema}.wav'
    with wave.open(str(tmp), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
    # nivelar en dos pasadas y comprimir
    med = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(tmp), '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    j = json.loads(med[med.rindex('{'):med.rindex('}') + 1])
    filtro = (f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:"
              f"measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
    mp3 = DEST / f'{tema}.mp3'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(tmp), '-af', filtro, '-ar', str(SR),
                    '-c:a', 'libmp3lame', '-q:a', '5', str(mp3)], check=True)
    tmp.unlink()
    lista = DEST / 'canciones.json'
    datos = json.loads(lista.read_text()) if lista.exists() else {}
    # 'vol' (el nivel al lado de los temas sintetizados) se mide en el juego y se conserva
    datos[tema] = {**datos.get(tema, {}), 'archivo': mp3.name, 'bucle': [round(a + cruce + COPIA / 2, 5), round(b + cruce + COPIA / 2, 5)],
                   'golpe': round(golpe if golpe is not None else primer_golpe(x[:int(3 * SR)].mean(1)), 4), 'de': Path(video).name, 'dura': round(len(y) / SR, 3)}
    lista.write_text(json.dumps(datos, indent=1, ensure_ascii=False) + '\n')
    print(f'{mp3.relative_to(AQUI.parent)}: {mp3.stat().st_size / 1024:.0f} KB, {len(y) / SR:.2f} s, bucle {datos[tema]["bucle"]}')


if __name__ == '__main__':
    arg = [s for s in sys.argv[1:] if not s.startswith('--')]
    # --dest=carpeta: otro destino (AEROPLAZA guarda las suyas en aeroplaza/musica-ajena)
    dest = next((s.split('=', 1)[1] for s in sys.argv[1:] if s.startswith('--dest=')), None)
    if dest: DEST = Path(dest).resolve()
    op = {s.split('=')[0][2:]: float(s.split('=')[1]) for s in sys.argv[1:] if s.startswith('--') and '=' in s and not s.startswith('--dest=')}
    if arg[:1] == ['analizar']: analizar(arg[1])
    elif arg[:1] == ['hacer']: hacer(arg[1], arg[2], float(arg[3]), float(arg[4]), op.get('cruce', 0.15), op.get('golpe'))
    else: print(__doc__)

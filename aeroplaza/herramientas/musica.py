"""aeroplaza/herramientas/musica.py — los temas de los reinos, con la música de Rezona.

    python3 aeroplaza/herramientas/musica.py

Rezona devuelve temas de ~10 s aunque se le pida más (`duration` da
VALIDATION_ERROR y `music_length_ms` se ignora, ver memoria/rezona.md). Un bucle
de 10 s cansa, así que por reino se piden tres tomas con el mismo pedido y acá
se encadenan:

- cada toma se lleva al mismo volumen (RMS);
- se ordenan por parecido de tonalidad (croma de 12 notas): la que más se
  aleja de la primera se descarta si pasa el umbral;
- se pegan con fundidos de igual potencia; al final se funde el principio de
  la primera y se copian 0,4 s más de ella (como brillo/herramientas/canciones.py):
  el juego salta a la mitad de esa copia, que es igual a lo que hay en X + 0,2
  (X = el largo del fundido). Así, aunque el decodificador de MP3 corra todo unos
  milisegundos, el salto cae entre dos pedazos iguales y no hace clic.

Salen aeroplaza/musica/<tema>.mp3 (96 kbps, estéreo) y musica/canciones.json,
que armar.mjs mete siempre (son originales: van también en el HTML público).
"""
import json
import subprocess
from pathlib import Path

import numpy as np

AQUI = Path(__file__).resolve().parent.parent
CRUDO = AQUI / 'crudo' / 't3'
SAL = AQUI / 'musica'
SR = 44100
COPIA = 0.4
# tema del juego → (tomas de crudo/t3, fundido en s, volumen)
TEMAS = {
    'arrecife': (['musica-aqua', 'musica-aqua-2', 'musica-aqua-3'], 1.6, 0.85),
    'aurora': (['musica-aurora', 'musica-aurora-2', 'musica-aurora-3'], 1.8, 0.85),
    'cielo': (['musica-jardin', 'musica-jardin-2', 'musica-jardin-3'], 1.2, 0.85),
    'ciudad': (['musica-tienda', 'musica-tienda-2', 'musica-tienda-3'], 0.9, 0.8),
    'casa': (['musica-casa', 'musica-casa-2', 'musica-casa-3'], 1.0, 0.8),
}


def leer(f):
    b = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(f), '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(b, dtype=np.float32).reshape(-1, 2).copy()


def croma(y):
    """la energía de cada una de las 12 notas, promediada (de 55 Hz a 2 kHz)"""
    m = y.mean(axis=1)
    n = 8192
    c = np.zeros(12)
    for i in range(0, len(m) - n, n // 2):
        e = np.abs(np.fft.rfft(m[i:i + n] * np.hanning(n))) ** 2
        f = np.fft.rfftfreq(n, 1 / SR)
        ok = (f > 55) & (f < 2000)
        nota = np.round(12 * np.log2(f[ok] / 440.0)).astype(int) % 12
        np.add.at(c, nota, e[ok])
    return c / (np.linalg.norm(c) + 1e-9)


def fundir(a, b, s):
    """a y b pegados con s segundos de fundido de igual potencia"""
    k = int(s * SR)
    t = np.linspace(0, 1, k)[:, None]
    medio = a[-k:] * np.cos(t * np.pi / 2) + b[:k] * np.sin(t * np.pi / 2)
    return np.concatenate([a[:-k], medio, b[k:]])


def main():
    SAL.mkdir(exist_ok=True)
    datos = {}
    for tema, (tomas, cruce, vol) in TEMAS.items():
        hay = [t for t in tomas if (CRUDO / f'{t}.mp3').exists()]
        if not hay:
            print(tema, ': no hay tomas')
            continue
        ys = [leer(CRUDO / f'{t}.mp3') for t in hay]
        ys = [y * (0.16 / (np.sqrt((y ** 2).mean()) + 1e-9)) for y in ys]
        cs = [croma(y) for y in ys]
        # la primera manda; las demás, de la más parecida a la menos, si se parecen
        orden = [0] + sorted(range(1, len(ys)), key=lambda i: -float(cs[0] @ cs[i]))
        elegidas = [i for i in orden if i == 0 or float(cs[0] @ cs[i]) > 0.72]
        s = ys[elegidas[0]]
        for i in elegidas[1:]:
            s = fundir(s, ys[i], cruce)
        # el cierre: el principio de la primera, fundido sobre la cola, y 0,4 s más de ella
        k, copia = int(cruce * SR), int(COPIA * SR)
        a0 = ys[elegidas[0]]
        cola = s[-k:] * np.cos(np.linspace(0, 1, k)[:, None] * np.pi / 2) + a0[:k] * np.sin(np.linspace(0, 1, k)[:, None] * np.pi / 2)
        s = np.concatenate([s[:-k], cola, a0[k:k + copia]])
        pico = np.abs(s).max()
        if pico > 0.97:
            s *= 0.97 / pico
        mp3 = SAL / f'{tema}.mp3'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-b:a', '96k', str(mp3)], input=s.astype(np.float32).tobytes(), check=True)
        dura = len(s) / SR
        datos[tema] = {'archivo': mp3.name, 'bucle': [round(cruce + COPIA / 2, 5), round(dura - COPIA / 2, 5)], 'dura': round(dura, 3), 'golpe': 0.0, 'vol': vol,
                       'de': 'Rezona (' + ', '.join(hay[i] for i in elegidas) + ')'}
        parecidos = ' '.join(f'{float(cs[0] @ cs[i]):.2f}' for i in range(len(ys)))
        print(f'{tema}: {len(elegidas)}/{len(ys)} tomas (parecido {parecidos}) · {dura:.1f} s · {mp3.stat().st_size / 1024:.0f} KB')
    (SAL / 'canciones.json').write_text(json.dumps(datos, indent=1, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    main()

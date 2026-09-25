"""
aeroplaza/trailer/sonidos.py — los efectos del tráiler, sintetizados (nada bajado):
burbujas que revientan, whoosh de las transiciones, el "ting" de vidrio del logo, el tecleo del
"Bienvenido", el error de Windows cuando Aero.exe se rompe, glitches, subidas de ruido, el golpe
grave del drop y el grito del susto (el mismo que delirio.js › grito(), hecho con numpy).

    python3 sonidos.py salida.wav DURACION < eventos.json
eventos: [{"t": segundos, "tipo": "pop" | "whoosh" | "ting" | "tecla" | "error" | "glitch" | "subida" | "golpe" | "grito" | "globo", "v": volumen, "d": duración}]
"""
import json, sys, wave
import numpy as np

SR = 48000
rng = np.random.default_rng(7)

def env(n, a=0.005, r=0.2):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / max(r, 1e-4))
    return e

def ruido(n):
    return rng.standard_normal(n)

def pasabanda(x, f, q=4.0):
    # biquad pasabanda simple (RBJ)
    w = 2 * np.pi * f / SR; al = np.sin(w) / (2 * q)
    b0, b1, b2 = al, 0, -al; a0, a1, a2 = 1 + al, -2 * np.cos(w), 1 - al
    y = np.zeros_like(x); x1 = x2 = y1 = y2 = 0.0
    for i in range(len(x)):
        v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
        x2, x1, y2, y1 = x1, x[i], y1, v; y[i] = v
    return y

def pasabajos(x, f):
    a = np.exp(-2 * np.pi * f / SR); y = np.zeros_like(x); p = 0.0
    for i in range(len(x)): p = (1 - a) * x[i] + a * p; y[i] = p
    return y

def pop(d=0.12):
    # una burbuja: seno que sube rápido de tono, con un clic de aire
    n = int(SR * d); t = np.arange(n) / SR
    f = 380 + 1400 * (1 - np.exp(-t * 60))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.035)
    s += pasabanda(ruido(n), 3000, 2) * env(n, 0.0005, 0.008) * 0.4
    return s

def globo(d=0.25):
    # el globo de chat: dos notas de vidrio
    n = int(SR * d); t = np.arange(n) / SR
    s = (np.sin(2 * np.pi * 1318.5 * t) + 0.5 * np.sin(2 * np.pi * 2637 * t)) * env(n, 0.002, 0.08)
    s[int(SR * 0.07):] += ((np.sin(2 * np.pi * 1760 * t) + 0.4 * np.sin(2 * np.pi * 3520 * t)) * env(n, 0.002, 0.1))[:n - int(SR * 0.07)]
    return s * 0.5

def filtro_variable(x, fcs, tipo='bajos', q=1.4):
    # un filtro de estado variable (Chamberlin) con la frecuencia moviéndose muestra a muestra
    y = np.zeros_like(x); lp = bp = 0.0
    for i in range(len(x)):
        f = 2 * np.sin(np.pi * min(fcs[i], SR / 6) / SR)
        hp = x[i] - lp - bp / q; bp += f * hp; lp += f * bp
        y[i] = lp if tipo == 'bajos' else bp
    return y

def whoosh(d=0.7):
    # ruido por un pasabajos que se abre y se cierra
    n = int(SR * d); u = np.arange(n) / n
    out = filtro_variable(ruido(n), 400 + 5200 * np.sin(np.pi * u) ** 2)
    return out * np.sin(np.pi * u) ** 1.5 * 0.9

def ting(d=1.6):
    # vidrio: parciales inarmónicos con decaimiento largo
    n = int(SR * d); t = np.arange(n) / SR; s = np.zeros(n)
    for f, a, r in [(2093, 1, 0.9), (4186 * 1.003, 0.5, 0.5), (6272, 0.3, 0.35), (2637, 0.6, 1.1), (8372, 0.15, 0.2)]:
        s += a * np.sin(2 * np.pi * f * t) * np.exp(-t / r)
    return s * env(n, 0.001, 10) * 0.35

def tecla(d=0.05):
    n = int(SR * d)
    return pasabanda(ruido(n), 2400 + rng.uniform(-400, 600), 3) * env(n, 0.0005, 0.01) * 0.8

def error_win(d=1.2):
    # el "error crítico" de Windows: acorde que baja (mi-do-la) con timbre de campana suave
    n = int(SR * d); t = np.arange(n) / SR; s = np.zeros(n)
    for k, (f, t0) in enumerate([(659.3, 0.0), (523.3, 0.11), (440.0, 0.22)]):
        i0 = int(SR * t0); tt = t[:n - i0]
        v = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * 2 * f * tt) + 0.15 * np.sin(2 * np.pi * 3.01 * f * tt)) * np.exp(-tt / 0.45)
        s[i0:] += v * np.minimum(1, tt / 0.004)
    return s * 0.45

def glitch(d=0.35):
    # ruido digital a saltos: cuadrados, bitcrush y cortes
    n = int(SR * d); s = np.zeros(n); i = 0
    while i < n:
        L = int(SR * rng.uniform(0.008, 0.05)); f = rng.choice([90, 180, 440, 880, 1760, 3520]) * rng.uniform(0.9, 1.1)
        tt = np.arange(min(L, n - i)) / SR
        tipo = rng.integers(3)
        seg = np.sign(np.sin(2 * np.pi * f * tt)) if tipo == 0 else np.round(ruido(len(tt)) * 3) / 3 if tipo == 1 else np.zeros(len(tt))
        s[i:i + len(tt)] = seg * rng.uniform(0.3, 1); i += L
    return s * env(n, 0.001, d * 0.8) * 0.5

def subida(d=1.4):
    # ruido por un pasabanda que sube de tono hasta cortar seco
    n = int(SR * d); u = np.arange(n) / n
    out = filtro_variable(ruido(n), 300 + 7000 * u ** 2, 'banda')
    tono = np.sin(2 * np.pi * np.cumsum(200 + 1600 * u ** 2) / SR) * 0.25
    return (out * 0.6 + tono) * u ** 2.2 * 0.9

def golpe(d=1.3):
    # el golpe grave: seno que cae de 110 a 32 Hz, saturado, con un clic
    n = int(SR * d); t = np.arange(n) / SR
    f = 32 + 78 * np.exp(-t * 9)
    s = np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * 2.2) * np.exp(-t / 0.45)
    s += pasabanda(ruido(n), 1800, 1) * env(n, 0.0005, 0.012) * 0.6
    return s * 0.95

def grito(d=0.62):
    # como delirio.js › grito(): dos sierras que suben (520 y 781 Hz) con vibrato de 28 Hz,
    # ruido por los formantes del "aaa" (850, 1250, 2900), todo saturado, y un golpe grave
    n = int(SR * d); t = np.arange(n) / SR
    vib = 38 * np.sin(2 * np.pi * 28 * t)
    s = np.zeros(n)
    for f0 in (520, 781):
        f = np.where(t < 0.12, f0 * 0.7 * (1.35 / 0.7) ** (t / 0.12), f0 * 1.35 * (1.05 / 1.35) ** ((t - 0.12) / (d - 0.12))) + vib
        fase = np.cumsum(f) / SR; s += 0.16 * 2 * (fase % 1 - 0.5)
    x = ruido(n)
    for f, q, v in [(850, 7, 0.9), (1250, 8, 0.7), (2900, 10, 0.5)]: s += pasabanda(x, f, q) * v
    g = np.where(t < 0.012, t / 0.012, np.where(t < 0.3, 1, np.exp(-(t - 0.3) / 0.09)))
    s = np.tanh(s * 5) * g * 0.9
    fb = 28 + 62 * np.exp(-t * 7); s += np.sin(2 * np.pi * np.cumsum(fb) / SR) * np.exp(-t / 0.15) * 0.8
    return s

GEN = {'pop': pop, 'whoosh': whoosh, 'ting': ting, 'tecla': tecla, 'error': error_win, 'glitch': glitch, 'subida': subida, 'golpe': golpe, 'grito': grito, 'globo': globo}

def main():
    dest, dur = sys.argv[1], float(sys.argv[2])
    eventos = json.load(sys.stdin)
    L = np.zeros((int(SR * (dur + 2)), 2))
    for e in eventos:
        fn = GEN[e['tipo']]
        s = fn(e['d']) if 'd' in e else fn()
        i0 = int(e['t'] * SR); s = s[: max(0, len(L) - i0)] * e.get('v', 1.0)
        pan = e.get('pan', rng.uniform(-0.25, 0.25))
        L[i0:i0 + len(s), 0] += s * (1 - max(0, pan)); L[i0:i0 + len(s), 1] += s * (1 + min(0, pan))
    L = L[: int(SR * dur)]
    pico = np.max(np.abs(L)) or 1
    if pico > 0.98: L *= 0.98 / pico
    with wave.open(dest, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(L, -1, 1) * 32767).astype('<i2').tobytes())

if __name__ == '__main__':
    main()

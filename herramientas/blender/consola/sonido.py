# El sonido de los 13 segundos de la JX-1, sintetizado (nada grabado ni
# copiado): ambiente, el clic del interruptor, los pixeles que vuelan, la
# campanita del logo, una melodía chiptune propia mientras Grumo juega, sus
# saltos y monedas, la puerta y el cierre. Sigue los cuadros de eventos.json.
#
#   python3 sonido.py <lcd>/eventos.json salida.wav
import json, math, sys, wave
import numpy as np

SR, DUR, FPS = 44100, 13.0, 24
EV = json.load(open(sys.argv[1]))
N = int(SR * DUR)
izq, der = np.zeros(N), np.zeros(N)
azar = np.random.default_rng(5)

def seg(f):
    return f / FPS

def poner(x, t, vol=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N: return
    x = x[: N - i] * vol
    izq[i:i + len(x)] += x * (1 - max(0, pan))
    der[i:i + len(x)] += x * (1 + min(0, pan))

def env(n, a=0.005, r=0.1):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4))
    return e * np.exp(-t / max(r, 1e-4))

def tono(f, dur, forma='pulso', ancho=0.25, a=0.004, r=0.12, f1=None):
    n = int(dur * SR); t = np.arange(n) / SR
    fr = f if f1 is None else f * (f1 / f) ** (t / dur)
    fase = np.cumsum(2 * np.pi * fr / SR)
    if forma == 'pulso': w = np.where((fase / (2 * np.pi)) % 1 < ancho, 1.0, -1.0)
    elif forma == 'tri': w = 2 * np.abs(2 * ((fase / (2 * np.pi)) % 1) - 1) - 1
    else: w = np.sin(fase)
    return w * env(n, a, r)

def suma(*xs):
    """Suma sonidos de largos distintos (rellena con silencio)."""
    out = np.zeros(max(len(x) for x in xs))
    for x in xs: out[:len(x)] += x
    return out

def ruido(dur, r=0.05, a=0.001):
    n = int(dur * SR)
    return azar.uniform(-1, 1, n) * env(n, a, r)

def pasa_bajos(x, k):
    """Un filtro de un polo: k chico = más oscuro."""
    y = np.zeros_like(x); acc = 0.0
    for i, v in enumerate(x):
        acc += k * (v - acc); y[i] = acc
    return y

def nota(n):
    return 440 * 2 ** ((n - 69) / 12)

# 0 a 2,5 s: un zumbido grave que crece y aire que sube
t = np.arange(int(2.6 * SR)) / SR
crece = np.minimum(1, t / 2.2) ** 2
zumbido = (np.sin(2 * np.pi * 55 * t) + 0.5 * np.sin(2 * np.pi * 82.4 * t) + 0.25 * np.sin(2 * np.pi * 110.3 * t)) * crece
poner(zumbido, 0.0, 0.10)
aire = pasa_bajos(azar.uniform(-1, 1, len(t)), 0.02) * crece * 3
poner(aire, 0.0, 0.25, -0.3); poner(aire[::-1] * crece, 0.05, 0.12, 0.3)
for k in range(14):   # destellitos, como los pixeles que flotan
    poner(tono(nota(84 + int(azar.integers(0, 12))), 0.25, 'seno', r=0.08), azar.uniform(0.2, 12.5), 0.025, azar.uniform(-0.8, 0.8))

# el interruptor
on = seg(EV['encendido'])
poner(suma(ruido(0.012, 0.004), 0.6 * tono(90, 0.05, 'seno', r=0.02)), on, 0.5)
poner(tono(60, 0.4, 'seno', r=0.15), on, 0.25)
# los pixeles que vuelan a armar el logo: un arpegio que sube
for k in range(16):
    poner(tono(nota(64 + k * 2), 0.06, 'pulso', 0.125, r=0.03), on + 0.15 + k * 0.1, 0.06, (-1) ** k * 0.4)
# la campanita del logo (dos notas propias, con un eco)
cam = seg(EV['campana'])
for eco, vol in ((0, 0.32), (0.18, 0.12), (0.36, 0.05)):
    poner(tono(nota(81), 0.09, 'pulso', 0.5, r=0.05), cam + eco, vol, -0.2)
    poner(tono(nota(88), 0.9, 'pulso', 0.5, r=0.35), cam + 0.09 + eco, vol, 0.2)
# la cortina hacia el juego
cortina = seg(125)
poner(pasa_bajos(ruido(0.65, 0.3, 0.2), 0.08) * 3, cortina, 0.25)

# la melodía mientras Grumo corre: 150 negras por minuto, en corcheas
juego, puerta = seg(EV['juego']), seg(EV['puerta'])
corchea = 0.2
MELODIA = [76, 79, 81, 79, 76, 74, 72, 74, 76, 79, 81, 84, 83, 81, 79, None,
           76, 79, 81, 79, 76, 74, 72, 74, 72, 74, 76, 79, 76, None, 72, None]
BAJO = [48, 48, 55, 55, 53, 53, 55, 55]
k = 0
while juego + k * corchea < puerta:
    tt = juego + k * corchea
    m = MELODIA[k % len(MELODIA)]
    if m: poner(tono(nota(m), corchea * 0.9, 'pulso', 0.25, r=0.15), tt, 0.10, 0.25)
    if k % 2 == 0: poner(tono(nota(BAJO[(k // 2) % len(BAJO)]), corchea * 1.8, 'tri', r=0.3), tt, 0.22, -0.1)
    if k % 4 == 0: poner(tono(110, 0.12, 'seno', r=0.05, f1=45), tt, 0.45)               # bombo
    if k % 4 == 2: poner(pasa_bajos(ruido(0.12, 0.06), 0.5), tt, 0.22)                   # tambor
    if k % 2 == 1: poner(ruido(0.03, 0.01), tt, 0.05, 0.4)                                # platillo
    k += 1
for s in EV['saltos']:   # el salto: un pulso que sube
    poner(tono(220, 0.16, 'pulso', 0.5, r=0.12, f1=880), seg(s), 0.14, 0.1)
    poner(tono(nota(83), 0.07, 'pulso', 0.5, r=0.05), seg(s + 10), 0.12, -0.2)          # la moneda
    poner(tono(nota(88), 0.18, 'pulso', 0.5, r=0.1), seg(s + 10) + 0.07, 0.12, -0.2)
for j, n in enumerate((84, 79, 76, 72)):   # la puerta
    poner(tono(nota(n), 0.12, 'pulso', 0.5, r=0.1), puerta + j * 0.07, 0.11)

# el final: un acorde que se abre, START y el golpe
fin = seg(EV['final'])
for n, pan in ((60, -0.4), (64, 0.0), (67, 0.4), (72, 0.0)):
    poner(tono(nota(n), 2.2, 'tri', a=0.25, r=1.2), fin, 0.07, pan)
st = seg(EV['start'])
poner(tono(nota(84), 0.08, 'pulso', 0.5, r=0.05), st, 0.2)
poner(tono(nota(91), 0.6, 'pulso', 0.5, r=0.25), st + 0.08, 0.18)
poner(tono(80, 0.7, 'seno', r=0.3, f1=38), st + 0.05, 0.6)
poner(pasa_bajos(ruido(0.8, 0.35), 0.1) * 2, st + 0.05, 0.25)

# un poco de sala (eco corto) y que no reviente
for canal in (izq, der):
    sala = np.zeros(N)
    for d, g in ((0.031, 0.25), (0.047, 0.18), (0.083, 0.12), (0.121, 0.08)):
        i = int(d * SR); sala[i:] += canal[:-i] * g
    canal += sala
mezcla = np.stack([izq, der], 1)
mezcla = np.tanh(mezcla * 1.4) / np.tanh(1.4)
cola = int(0.5 * SR); mezcla[-cola:] *= np.linspace(1, 0, cola)[:, None]
mezcla *= 0.89 / np.max(np.abs(mezcla))
with wave.open(sys.argv[2], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mezcla * 32767).astype('<i2').tobytes())
print('sonido listo', sys.argv[2], f'{DUR} s')

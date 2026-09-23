#!/usr/bin/env python3
"""Procesa el arte de RUTA 40 que sale de Rezona y lo deja listo para el juego.

    python3 ruta40/herramientas/procesar_arte.py <carpeta con los png>

Los png se bajan de https://lab.rezona.ai/game/pgcserver/pv/biJbNhtEOI/assets/<nombre>-g1.png
(la lista y los prompts están en arte.json). Escribe:
  ruta40/arte/*.webp   lo que entra al HTML
  ruta40/js/medidas.js el tamaño, el ancla y la geometría de cada cosa (en metros)

Por qué cada paso:
- los vidrios y los agujeros de las llantas salen transparentes: se tiñen, así
  el conductor se ve detrás del vidrio y por la llanta no se ve el cielo;
- el colectivo vino mirando a la izquierda: se espeja;
- las texturas de suelo no repiten sin costura: se mezclan con su copia
  corrida media vuelta (la costura queda en el centro de una y en el borde de
  la otra);
- las hojas de adornos se cortan por las columnas vacías.
"""
import json, math, sys, os
from collections import deque
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
R40 = os.path.dirname(AQUI)
OUT = os.path.join(R40, 'arte')
SRC = sys.argv[1] if len(sys.argv) > 1 else '.'
os.makedirs(OUT, exist_ok=True)
medidas = {}


def abrir(n):
    return Image.open(os.path.join(SRC, n + '.png')).convert('RGBA')


def guardar(im, nombre, q=82):
    p = os.path.join(OUT, nombre + '.webp')
    im.save(p, 'WEBP', quality=q, method=6)
    return os.path.getsize(p)


def huecos(a, umbral=128):
    """los píxeles transparentes que no tocan el borde (ventanas, agujeros)"""
    H, W = a.shape
    vacio = a < umbral
    afuera = np.zeros_like(vacio)
    q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if vacio[y, x] and not afuera[y, x]: afuera[y, x] = True; q.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if vacio[y, x] and not afuera[y, x]: afuera[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and vacio[yy, xx] and not afuera[yy, xx]:
                afuera[yy, xx] = True; q.append((yy, xx))
    return vacio & ~afuera


def teñir_huecos(im, color, reflejo=False):
    arr = np.array(im).astype(np.float32)
    h = huecos(arr[:, :, 3])
    if not h.any(): return im
    r, g, b, a = color
    base = arr.copy()
    ys, xs = np.where(h)
    k = np.ones(len(ys))
    if reflejo:  # una franja diagonal más clara, como un vidrio de verdad
        k = 1 + 0.55 * (((xs + ys * 0.8) % 160) < 38)
    # lo que había de color semitransparente se mezcla con el tinte
    al = arr[ys, xs, 3] / 255
    for c, v in enumerate((r, g, b)):
        base[ys, xs, c] = np.clip(arr[ys, xs, c] * al + v * (1 - al) * np.minimum(k, 1.35), 0, 255)
    base[ys, xs, 3] = np.clip(np.maximum(arr[ys, xs, 3], a * 255 * k), 0, 255)
    return Image.fromarray(base.astype(np.uint8))


def recortar(im, margen=2):
    bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    return im.crop((max(0, bb[0] - margen), max(0, bb[1] - margen), min(im.width, bb[2] + margen), min(im.height, bb[3] + margen))), bb


def casco(im, techo_px=None, n=10):
    """el contorno convexo del chasis, simplificado a n puntos (px del sprite)"""
    a = np.array(im.getchannel('A')) > 140
    if techo_px is not None: a[:techo_px, :] = False
    ys, xs = np.where(a)
    pts = sorted(set(zip(xs[::7].tolist(), ys[::7].tolist())) | {(xs.min(), ys[xs.argmin()]), (xs.max(), ys[xs.argmax()])})
    def cr(o, p, q): return (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0])
    lo, hi = [], []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi) >= 2 and cr(hi[-2], hi[-1], p) <= 0: hi.pop()
        hi.append(p)
    h = lo[:-1] + hi[:-1]
    # simplificar: sacar el punto que menos área aporta hasta quedar en n
    while len(h) > n:
        mejor, im_ = 1e18, 0
        for i in range(len(h)):
            o, p, q = h[i - 1], h[i], h[(i + 1) % len(h)]
            ar = abs(cr(o, p, q))
            if ar < mejor: mejor, im_ = ar, i
        h.pop(im_)
    return h


# ---------------------------------------------------------------- vehículos
# en px de la imagen original de Rezona: centro y radio de cada rueda (atrás, adelante),
# la ventana donde va la cabeza del conductor, el largo real (m) y hasta dónde choca el techo
VEH = {
    'chata':      dict(src='chata', espejo=False, ruedas=[(370, 573, 100), (1080, 573, 100)], llanta='rueda', largo=5.1, cabeza=(748, 262), techo=None),
    'escarabajo': dict(src='escarabajo', espejo=False, ruedas=[(393, 604, 92), (1050, 604, 92)], llanta='rueda', largo=3.4, cabeza=(735, 300), techo=150),
    'colectivo':  dict(src='colectivo', espejo=True, ruedas=[(376, 560, 70), (948, 560, 70)], llanta='rueda', largo=7.0, cabeza=(1225, 300), techo=None),
    'cuatro':     dict(src='cuatro', espejo=False, ruedas=[(340, 560, 145), (1105, 560, 145)], llanta='rueda4x4', largo=4.3, cabeza=(760, 210), techo=None),
    'tractor':    dict(src='tractor2', espejo=False, ruedas=[(365, 572, 190), (1060, 650, 110)], llanta='ruedaTractor', largo=3.7, cabeza=(470, 245), techo=240),
}
PPM = 150  # píxeles por metro en los sprites que entran al juego
medidas['vehiculos'] = {}
for nombre, v in VEH.items():
    im = abrir(v['src'])
    W = im.width
    ruedas, cab = v['ruedas'], v['cabeza']
    if v['espejo']:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    im = teñir_huecos(im, (150, 200, 230, 0.34), reflejo=True)
    im, bb = recortar(im)
    x0, y0 = max(0, bb[0] - 2), max(0, bb[1] - 2)
    ppm_src = (bb[2] - bb[0]) / v['largo']
    esc = PPM / ppm_src
    out = im.resize((round(im.width * esc), round(im.height * esc)), Image.LANCZOS)
    kb = guardar(out, 'auto-' + nombre, 86) // 1024
    # todo en metros, con el origen en el medio entre las ruedas a la altura de los ejes, y para arriba
    ox = (ruedas[0][0] + ruedas[1][0]) / 2
    oy = (ruedas[0][1] + ruedas[1][1]) / 2
    m = lambda px, py: (round((px - ox) / ppm_src, 3), round(-(py - oy) / ppm_src, 3))
    ctecho = None if v['techo'] is None else v['techo'] - y0
    hull = casco(im, ctecho)
    medidas['vehiculos'][nombre] = {
        'img': 'auto-' + nombre, 'w': out.width, 'h': out.height, 'ppm': PPM,
        # dónde cae el origen dentro del sprite (px del sprite final)
        'ox': round((ox - x0) * esc, 1), 'oy': round((oy - y0) * esc, 1),
        'ruedas': [dict(x=m(px, py)[0], y=m(px, py)[1], r=round(r / ppm_src, 3)) for px, py, r in ruedas],
        'llanta': v['llanta'],
        'cabeza': dict(zip(('x', 'y'), m(*cab))),
        'casco': [m(px + x0, py + y0) for px, py in hull],
        'largo': v['largo'],
    }
    print(f'auto-{nombre}: {out.width}x{out.height} {kb} KB, ruedas {medidas["vehiculos"][nombre]["ruedas"]}')

# ---------------------------------------------------------------- llantas
medidas['llantas'] = {}
for n in ('rueda', 'rueda4x4', 'ruedaTractor'):
    im = teñir_huecos(abrir(n), (38, 36, 40, 1.0))
    im, _ = recortar(im, 0)
    lado = max(im.size)
    cuad = Image.new('RGBA', (lado, lado)); cuad.alpha_composite(im, ((lado - im.width) // 2, (lado - im.height) // 2))
    out = cuad.resize((224, 224), Image.LANCZOS)
    print(n, guardar(out, 'llanta-' + n, 86) // 1024, 'KB')
    medidas['llantas'][n] = {'img': 'llanta-' + n, 'w': 224}

# ---------------------------------------------------------------- sueltos
def suelto(src, nombre, alto, q=84, extra=None):
    im, _ = recortar(abrir(src))
    esc = alto / im.height
    out = im.resize((round(im.width * esc), alto), Image.LANCZOS)
    kb = guardar(out, nombre, q) // 1024
    medidas.setdefault('sueltos', {})[nombre] = {'img': nombre, 'w': out.width, 'h': out.height, **(extra or {})}
    print(nombre, out.size, kb, 'KB')

suelto('conductor', 'conductor', 256)
suelto('bidon', 'bidon', 160)


def cortar_hoja(src, nombres, alto_max=420, q=82, tipo='props'):
    im = abrir(src)
    a = np.array(im.getchannel('A')) > 24
    col = a.sum(0)
    partes, dentro = [], False
    for x in range(len(col)):
        if col[x] > 1 and not dentro: s = x; dentro = True
        elif col[x] <= 1 and dentro:
            if x - s > 12: partes.append((s, x))
            dentro = False
    if dentro: partes.append((s, len(col)))
    # juntar pedacitos sueltos al vecino más cercano hasta que queden tantos como nombres
    while len(partes) > len(nombres):
        i = min(range(len(partes)), key=lambda k: partes[k][1] - partes[k][0])
        j = i - 1 if i == len(partes) - 1 or (i > 0 and partes[i][0] - partes[i - 1][1] < partes[i + 1][0] - partes[i][1]) else i + 1
        a_, b_ = sorted((i, j)); partes[a_] = (partes[a_][0], partes[b_][1]); partes.pop(b_)
    # si dos se tocan: partir la más ancha por la columna más vacía de su parte media
    while len(partes) < len(nombres):
        i = max(range(len(partes)), key=lambda k: partes[k][1] - partes[k][0])
        s, e = partes[i]; m0, m1 = s + (e - s) * 3 // 10, s + (e - s) * 7 // 10
        c = m0 + int(np.argmin(col[m0:m1]))
        partes[i:i + 1] = [(s, c), (c, e)]
    if len(partes) != len(nombres):
        raise SystemExit(f'{src}: salieron {len(partes)} partes y hay {len(nombres)} nombres')
    for (s, e), n in zip(partes, nombres):
        pieza, _ = recortar(im.crop((s, 0, e, im.height)))
        esc = min(1, alto_max / pieza.height, alto_max * 1.6 / pieza.width)
        out = pieza.resize((max(1, round(pieza.width * esc)), max(1, round(pieza.height * esc))), Image.LANCZOS)
        kb = guardar(out, n, q) // 1024
        medidas.setdefault(tipo, {})[n] = {'img': n, 'w': out.width, 'h': out.height}
        print(' ', n, out.size, kb, 'KB')

cortar_hoja('monedas', ['moneda5', 'moneda25', 'moneda100'], 128, 86, 'monedas')
cortar_hoja('pedales', ['pedalFreno', 'pedalGas'], 300, 86, 'pedales')
cortar_hoja('props-norte', ['cardon', 'cactus', 'llama', 'vicuna', 'capilla'])
cortar_hoja('props-salinas', ['flamenco', 'flamencoVuela', 'sal', 'bloquesSal', 'cartel'])
cortar_hoja('props-cuyo', ['alamo', 'vid', 'barril', 'algarrobo', 'roca'])
cortar_hoja('props-sur', ['oveja', 'guanaco', 'coiron', 'lenga', 'hielo'])
cortar_hoja('props-ruta', ['condor', 'piedras', 'surtidor', 'santuario', 'tranquera'])

# ---------------------------------------------------------------- fondos
TRAMOS = ['puna', 'quebrada', 'salinas', 'valles', 'cuyo', 'patagonia', 'glaciar']
medidas['fondos'] = {}
for t in TRAMOS:
    lej = abrir('lejos-' + t).convert('RGB')
    kb1 = guardar(lej, 'lejos-' + t, 74) // 1024
    med = abrir('medio-' + t)
    a = np.array(med.getchannel('A'))
    # quedarse con la franja de filas más grande (medio-patagonia trae una tira suelta abajo)
    fil = (a > 24).sum(1) > med.width * 0.02
    mejor, s, dentro = (0, 0, 0), 0, False
    for y in range(len(fil) + 1):
        v = fil[y] if y < len(fil) else False
        if v and not dentro: s = y; dentro = True
        elif not v and dentro:
            if y - s > mejor[0]: mejor = (y - s, s, y)
            dentro = False
    med = med.crop((0, mejor[1], med.width, mejor[2]))
    med, _ = recortar(med, 0)
    # el color de abajo, para rellenar debajo de la franja
    ab = np.array(med)[-6:, :, :]
    ok = ab[:, :, 3] > 200
    fondo = [int(ab[:, :, c][ok].mean()) if ok.any() else 0 for c in range(3)]
    kb2 = guardar(med, 'medio-' + t, 78) // 1024
    # el suelo: sin costura
    s_ = np.array(abrir('suelo-' + t).convert('RGB').resize((512, 512), Image.LANCZOS)).astype(np.float32)
    corr = np.roll(np.roll(s_, 256, 0), 256, 1)
    u = np.sin(np.linspace(0, math.pi, 512)) ** 1.6
    w = (u[:, None] * u[None, :])[:, :, None]
    sin_costura = s_ * w + corr * (1 - w)
    kb3 = guardar(Image.fromarray(sin_costura.astype(np.uint8)), 'suelo-' + t, 80) // 1024
    # colores de la tierra, para el borde de arriba y la tierra honda
    medidas['fondos'][t] = {'lejos': [lej.width, lej.height], 'medio': [med.width, med.height], 'bajoMedio': fondo,
                            'suelo': [int(v) for v in s_.reshape(-1, 3).mean(0)]}
    print(t, 'lejos', kb1, 'KB · medio', med.size, kb2, 'KB · suelo', kb3, 'KB')

for n, q in (('portada', 76), ('gomeria', 76)):
    print(n, guardar(abrir(n).convert('RGB'), n, q) // 1024, 'KB')

with open(os.path.join(R40, 'js', 'medidas.js'), 'w') as f:
    f.write('/* generado por herramientas/procesar_arte.py — no editar a mano */\n')
    f.write('export const MEDIDAS = ' + json.dumps(medidas, ensure_ascii=False, indent=1) + ';\n')
tot = sum(os.path.getsize(os.path.join(OUT, x)) for x in os.listdir(OUT))
print(f'total arte/: {tot // 1024} KB en {len(os.listdir(OUT))} archivos')

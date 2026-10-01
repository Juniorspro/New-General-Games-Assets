# La pantallita de la JX-1: 312 cuadros de 160x144 en cuatro tonos, uno por
# cuadro del video (13 s a 24 por segundo), y los momentos que el resto tiene
# que seguir (el 3D aprieta los botones y el sonido suena en esos cuadros).
#
#   python3 pantalla.py <carpeta>   → <carpeta>/lcd_0001.png … y eventos.json
#
# Todo es dibujo propio: el logo de JXSTUDIOS que se arma de pixeles y un
# nivel cortito de Grumo (el de nuestro juego de plastilina).
import json, math, os, random, sys
from PIL import Image

W, H, CUADROS = 160, 144, 312
# del más claro al más oscuro: el fondo es 0
TONOS = [(196, 224, 160), (121, 168, 112), (48, 92, 74), (15, 42, 38)]

EV = {
    'encendido': 60,          # el interruptor y la luz roja
    'campana': 112,           # el logo terminó de armarse
    'juego': 141,             # arranca el nivel
    'saltos': [165, 200, 236],
    'puerta': 254,            # Grumo entra por la puerta
    'final': 263,             # cartel del final
    'start': 296,             # se aprieta START
}
SALTO_DUR, SALTO_ALTO, VEL = 20, 26, 1.5

# ── letras de 5x7 ─────────────────────────────────────────────────────────
FUENTE = {
    'A': ''.join(['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#']), 'D': '####.#...##...##...##...##...#####.',
    'E': '######....#....####.#....#....#####', 'G': '.###.#...##....#.####...##...#.###.',
    'I': '.###...#....#....#....#....#...###.', 'J': '..###...#....#....#.#..#.#..#..##..',
    'M': '#...###.###.#.##.#.##...##...##...#', 'N': '#...###..##.#.##..###...##...##...#',
    'O': '.###.#...##...##...##...##...#.###.', 'P': '####.#...##...#####.#....#....#....',
    'R': '####.#...##...#####.#.#..#..#.#...#', 'S': '.#####....#.....###.....#....#####.',
    'T': '#####..#....#....#....#....#....#..', 'U': '#...##...##...##...##...##...#.###.',
    'X': '#...##...#.#.#...#...#.#.#...##...#', '0': '.###.#...##..###.#.###..##...#.###.',
    '1': '..#...##....#....#....#....#...###.', '2': '.###.#...#....#...#...#...#...#####',
    '3': '####.....#....#.###.....#....#####.', ' ': '.' * 35, '!': ''.join(['..#..'] * 5 + ['.....', '..#..']),
    'x': '.....#...#.#.#...#...#.#.#...#.....',
}

def glifo(c):
    s = FUENTE[c]
    return [(i % 5, i // 5) for i, ch in enumerate(s) if ch == '#']

def ancho_texto(t, e=1):
    return (len(t) * 6 - 1) * e

def pixeles_texto(t, x0, y0, e=1):
    """Los pixeles (con escala e) de un texto: [(x, y), …] de cada bloque."""
    out = []
    for k, c in enumerate(t):
        for (gx, gy) in glifo(c):
            out.append((x0 + (k * 6 + gx) * e, y0 + gy * e))
    return out

class Lienzo:
    def __init__(self, fondo=0):
        self.p = [[fondo] * W for _ in range(H)]
    def px(self, x, y, t):
        # floor(x + 0.5) y no round(): round() de Python redondea los .5 al par
        # y una figura que cae en medio pixel sale rayada
        x, y = math.floor(x + 0.5), math.floor(y + 0.5)
        if 0 <= x < W and 0 <= y < H: self.p[y][x] = t
    def rect(self, x, y, w, h, t):
        for yy in range(math.floor(y + 0.5), math.floor(y + h + 0.5)):
            for xx in range(math.floor(x + 0.5), math.floor(x + w + 0.5)):
                self.px(xx, yy, t)
    def texto(self, t, x, y, tono, e=1):
        for (px, py) in pixeles_texto(t, x, y, e): self.rect(px, py, e, e, tono)
    def invertir(self):
        self.p = [[3 - v for v in fila] for fila in self.p]
    def imagen(self):
        im = Image.new('RGB', (W, H))
        im.putdata([TONOS[v] for fila in self.p for v in fila])
        return im

def suave(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)

# ── el arranque: JXSTUDIOS se arma de pixeles sueltos ──────────────────────
LOGO = 'JXSTUDIOS'
LX, LY, LE = (W - ancho_texto(LOGO, 2)) // 2, 50, 2
azar = random.Random(7)
BLOQUES = [(x, y, azar.uniform(-20, W + 20), azar.choice([-14, H + 6, azar.uniform(0, H)]), azar.uniform(0, 16))
           for (x, y) in pixeles_texto(LOGO, LX, LY, LE)]

def arranque(f, c):
    t0 = EV['encendido'] + 1
    for (x, y, sx, sy, demora) in BLOQUES:
        u = suave((f - t0 - demora) / 26)
        llegó = u >= 1
        c.rect(sx + (x - sx) * u, sy + (y - sy) * u, LE, LE, 3 if llegó else 2)
    if f >= EV['campana'] + 4:
        # un brillo que cruza las letras en diagonal
        banda = (f - EV['campana'] - 4) * 9 - 20
        for (x, y) in pixeles_texto(LOGO, LX, LY, LE):
            if 0 <= (x + y * 0.5) - banda < 8: c.rect(x, y, LE, LE, 1)
    if f >= 100:
        c.texto('PRESENTA', (W - ancho_texto('PRESENTA')) // 2, 80, 2)
    if EV['campana'] <= f < EV['campana'] + 2: c.invertir()

# ── el nivel de Grumo ──────────────────────────────────────────────────────
SUELO = 124
POZOS = [(118, 134)]                       # sin piso: lo salta en el segundo salto
PINCHES = [(66, 78)]                       # los salta en el primero
BICHO = (172, 182)                         # un bichito que camina: el tercero
PUERTA = 214
MONEDAS = [(70, 92), (124, 92), (178, 92)]  # arriba de cada salto

def grumo_x(f):
    return 20 + (f - EV['juego']) * VEL

def grumo_salto(f):
    for s in EV['saltos']:
        if s <= f < s + SALTO_DUR:
            u = (f - s) / SALTO_DUR
            return 4 * SALTO_ALTO * u * (1 - u), True
    return 0.0, False

def aterrizó(f):
    return any(s + SALTO_DUR <= f < s + SALTO_DUR + 3 for s in EV['saltos'])

def grumo(c, x, y, f, mirando=1, apretado=False):
    """Un bollito de 12x10 con ojos; apretado cuando cae."""
    w, h = (14, 8) if apretado else (12, 10)
    x0, y0 = x - w / 2, y - h
    for yy in range(h):
        for xx in range(w):
            # esquinas redondeadas
            if (xx in (0, w - 1) and yy in (0, h - 1)) or (yy == 0 and xx in (1, w - 2)): continue
            borde = xx in (0, w - 1) or yy in (0, h - 1) or (yy == 1 and xx in (1, w - 2))
            c.px(x0 + xx, y0 + yy, 3 if borde else 2)
    ojo = 1 if (f // 30) % 6 else 0                    # parpadea de vez en cuando
    for ex in (w // 2 - 2, w // 2 + 2):
        c.rect(x0 + ex + mirando, y0 + 3, 1, 2 if ojo else 1, 0)
    c.px(x0 + 2, y0 + 2, 1)                            # el brillo de la plastilina

def nivel(f, c):
    gx = grumo_x(min(f, EV['puerta']))
    cam = max(0, math.floor(gx - 52 + 0.5))   # la cámara va de a pixel entero
    # cerros y nubes con paralaje
    for k in range(-1, 6):
        bx = k * 70 - (cam * 0.4) % 70
        for xx in range(60):
            alto = int(18 * math.sin(math.pi * xx / 60))
            c.rect(bx + xx, SUELO - alto, 1, alto, 1)
    for k in range(-1, 5):
        nx = k * 64 - (cam * 0.2) % 64 + 10
        c.rect(nx, 22 + (k % 2) * 10, 18, 4, 1); c.rect(nx + 4, 18 + (k % 2) * 10, 10, 4, 1)
    # el piso, con su borde y un damero abajo
    for wx in range(int(cam) - 2, int(cam) + W + 2):
        if any(a <= wx < b for a, b in POZOS): continue
        sx = wx - cam
        c.px(sx, SUELO, 3)
        for yy in range(SUELO + 1, H):
            c.px(sx, yy, 2 if (wx // 4 + yy // 4) % 2 else 3)
    for a, b in PINCHES:
        for wx in range(a, b):
            alto = 4 - abs((wx - a) % 4 - 2) * 2
            c.rect(wx - cam, SUELO - alto, 1, alto, 3)
    # el bichito va y viene
    bx = BICHO[0] + 3 * math.sin(f / 5)
    c.rect(bx - cam, SUELO - 6, 9, 6, 3); c.rect(bx - cam + 2, SUELO - 5, 2, 2, 0); c.rect(bx - cam + 5, SUELO - 5, 2, 2, 0)
    # la puerta del final
    c.rect(PUERTA - cam, SUELO - 22, 14, 22, 3); c.rect(PUERTA - cam + 2, SUELO - 20, 10, 20, 1); c.px(PUERTA - cam + 10, SUELO - 10, 3)
    # monedas: se juntan en lo más alto de cada salto
    juntadas = 0
    for k, (mx, my) in enumerate(MONEDAS):
        tomada = f >= EV['saltos'][k] + SALTO_DUR // 2
        if tomada:
            juntadas += 1
            d = f - (EV['saltos'][k] + SALTO_DUR // 2)
            if d < 8:  # chispitas
                for a in range(4):
                    ang = a * math.pi / 2 + d * 0.3
                    c.px(mx - cam + math.cos(ang) * d, my + math.sin(ang) * d, 3)
            continue
        ancho = [4, 3, 1, 3][(f // 4) % 4]  # gira
        c.rect(mx - cam - ancho // 2, my - 3, ancho, 6, 3)
    # Grumo (entra por la puerta al final)
    alto, saltando = grumo_salto(f)
    if f < EV['puerta'] + 6:
        grumo(c, gx - cam, SUELO - alto, f, 1, apretado=aterrizó(f))
    # el marcador
    c.rect(4, 4, 5, 6, 3); c.px(6, 6, 1)
    c.texto('x' + str(juntadas), 11, 4, 3)

def final(f, c):
    c.texto(LOGO, LX, 34, 3, 2)
    salto = abs(math.sin((f - EV['final']) / 6)) * 10
    grumo(c, W // 2, 92 - salto, f)
    c.rect(W // 2 - 8, 93, 16, 1, 2)                   # sombrita
    apretado = f >= EV['start']
    if apretado or ((f - EV['final']) // 8) % 3 != 2:
        c.texto('PRESS START', (W - ancho_texto('PRESS START')) // 2, 112, 3)
    if EV['start'] <= f < EV['start'] + 2: c.invertir()

def cuadro(f):
    c = Lienzo(0)
    if f <= EV['encendido']: return c
    if f < 125: arranque(f, c)
    elif f < EV['juego']:
        # cortina: columnas oscuras de izquierda a derecha y después se abre el nivel
        u = (f - 125) / (EV['juego'] - 125)
        if u < 0.5:
            arranque(124, c)
            c.rect(0, 0, W * u * 2, H, 3)
        else:
            nivel(EV['juego'], c)
            c.rect(W * (u - 0.5) * 2, 0, W, H, 3)
    elif f < EV['final']:
        nivel(f, c)
        if f >= EV['puerta'] + 4:   # se apaga hacia el final
            c.rect(0, 0, W, int(H * (f - EV['puerta'] - 4) / 5), 3)
    else:
        final(f, c)
    return c

if __name__ == '__main__':
    carpeta = sys.argv[1] if len(sys.argv) > 1 else 'lcd'
    os.makedirs(carpeta, exist_ok=True)
    for f in range(1, CUADROS + 1):
        cuadro(f).imagen().save(os.path.join(carpeta, f'lcd_{f:04d}.png'))
    json.dump(EV, open(os.path.join(carpeta, 'eventos.json'), 'w'))
    print(f'{CUADROS} cuadros en {carpeta}')

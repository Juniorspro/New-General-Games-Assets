# Le agrega a PixulBrush (Mercyssh, mercyssh.itch.io; libre para proyectos personales con crédito)
# las letras que el castellano necesita y la fuente no trae: tildes, eñe, diéresis, ¿ y ¡.
# Cada "píxel" de la fuente son 128 unidades (8 px por em): las marcas se dibujan con cuadraditos.
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
P = 128
f = TTFont("PixulBrush.ttf")
gs = f.getGlyphSet(); cmap = f.getBestCmap(); glyf = f["glyf"]; hmtx = f["hmtx"]
NUEVOS = []
def caja(pen, x, y, w=1, h=1):
    pen.moveTo((x*P, y*P)); pen.lineTo((x*P, (y+h)*P)); pen.lineTo(((x+w)*P, (y+h)*P)); pen.lineTo(((x+w)*P, y*P)); pen.closePath()
def alto(nombre):
    g = glyf[nombre]; g.recalcBounds(glyf); return g.yMax // P
def nueva(cp, base, marcas=(), voltear=False):
    nb = cmap[ord(base)]; pen = TTGlyphPen(gs)
    if voltear:
        g = glyf[nb]; g.recalcBounds(glyf); off = g.yMax + g.yMin
        gs[nb].draw(TransformPen(pen, (1, 0, 0, -1, 0, off - 2*P)))
    else: gs[nb].draw(pen)
    for m in marcas: caja(pen, *m)
    nom = "uni%04X" % cp
    glyf[nom] = pen.glyph(); hmtx[nom] = hmtx[nb]
    if nom not in NUEVOS: NUEVOS.append(nom)
    for t in f["cmap"].tables:
        if t.isUnicode(): t.cmap[cp] = nom
for base, cp in [("a", 0xE1), ("e", 0xE9), ("o", 0xF3), ("u", 0xFA), ("A", 0xC1), ("E", 0xC9), ("I", 0xCD), ("O", 0xD3), ("U", 0xDA)]:
    nb = cmap[ord(base)]; g = glyf[nb]; g.recalcBounds(glyf)
    cx = (g.xMin + g.xMax) // 2 // P; top = g.yMax // P
    nueva(cp, base, [(cx, top + 1), (cx + 1, top + 2)])            # tilde: dos píxeles en diagonal
# la í: la "i" sin su punto (el contorno de más arriba) y la tilde en su lugar; con el punto quedaba
# una "i" alta y en pantalla se leía "vibora"
from fontTools.pens.recordingPen import RecordingPen
rp = RecordingPen(); gs[cmap[ord("i")]].draw(rp)
conts, cur = [], []
for op, args in rp.value:
    cur.append((op, args))
    if op in ("closePath", "endPath"): conts.append(cur); cur = []
def ymin(c): return min(pt[1] for op, a in c for pt in a) if any(a for op, a in c) else 0
conts.sort(key=ymin)
pen = TTGlyphPen(gs)
for c in conts[:-1]:
    for op, args in c: getattr(pen, op)(*args)
tallo = [pt for c in conts[:-1] for op, a in c for pt in a]
cx = (min(x for x, y in tallo) + max(x for x, y in tallo)) // 2 // P; top = max(y for x, y in tallo) // P
caja(pen, cx, top + 1); caja(pen, cx + 1, top + 2)
glyf["uni00ED"] = pen.glyph(); hmtx["uni00ED"] = hmtx[cmap[ord("i")]]
if "uni00ED" not in NUEVOS: NUEVOS.append("uni00ED")
for t in f["cmap"].tables:
    if t.isUnicode(): t.cmap[0xED] = "uni00ED"
for base, cp in [("n", 0xF1), ("N", 0xD1)]:
    nb = cmap[ord(base)]; g = glyf[nb]; g.recalcBounds(glyf)
    x0 = g.xMin // P; top = g.yMax // P
    nueva(cp, base, [(x0, top + 1), (x0 + 1, top + 2), (x0 + 2, top + 1), (x0 + 3, top + 2)])   # la eñe: una onda
for base, cp in [("u", 0xFC), ("U", 0xDC)]:
    nb = cmap[ord(base)]; g = glyf[nb]; g.recalcBounds(glyf)
    nueva(cp, base, [(g.xMin // P, g.yMax // P + 1), (g.xMax // P - 1, g.yMax // P + 1)])
nueva(0xBF, "?", voltear=True); nueva(0xA1, "!", voltear=True)       # ¿ y ¡: los mismos, dados vuelta
# signos que faltaban y el juego usa: < > · * [ ]  (trazos de 2 px como el resto de la letra)
def suelta(cp, cajas, ancho):
    pen = TTGlyphPen(gs)
    for c in cajas: caja(pen, *c)
    nom = "uni%04X" % cp
    glyf[nom] = pen.glyph(); hmtx[nom] = (ancho * P, 0)
    if nom not in NUEVOS: NUEVOS.append(nom)
    for t in f["cmap"].tables:
        if t.isUnicode(): t.cmap[cp] = nom
suelta(ord("<"), [(3, 7, 2), (2, 6, 2), (1, 5, 2), (0, 4, 2), (1, 3, 2), (2, 2, 2), (3, 1, 2)], 6)
suelta(ord(">"), [(0, 7, 2), (1, 6, 2), (2, 5, 2), (3, 4, 2), (2, 3, 2), (1, 2, 2), (0, 1, 2)], 6)
suelta(0xB7, [(0, 3, 2, 2)], 3)
suelta(ord("*"), [(2, 5, 1, 3), (1, 6, 3, 1), (0, 7, 1, 1), (4, 7, 1, 1), (0, 5, 1, 1), (4, 5, 1, 1)], 6)
suelta(ord("["), [(0, -1, 2, 10), (2, -1, 1, 2), (2, 7, 1, 2)], 4)
suelta(ord("]"), [(1, -1, 2, 10), (0, -1, 1, 2), (0, 7, 1, 2)], 4)
orden = f.getGlyphOrder() + [n for n in NUEVOS if n not in f.getGlyphOrder()]
f.setGlyphOrder(orden); glyf.glyphOrder = orden
f.save("PixulBrush-es.ttf")
print("ok", len(f.getGlyphOrder()))

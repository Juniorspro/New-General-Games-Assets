"""Empaqueta un nivel para el motor web: mallas compactas (una por archivo, compartidas), texturas webp,
lightmaps webp y el JSON del nivel. Uso: empacar.py SM_LivingRoom web/datos"""
import sys, json, os, struct, hashlib, re, numpy as np
from PIL import Image
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
nivel, DATOS = sys.argv[1], sys.argv[2]
TEX_MAX = int(os.environ.get('TEX_MAX', '512'))
def slug(ruta):
    base = re.sub(r'[^A-Za-z0-9_]+', '_', ruta.split('/')[-1].split('.')[-1])[:40]
    return base + '-' + hashlib.md5(ruta.encode()).hexdigest()[:6]
def arch(ruta): return ruta.replace('/', '~')
os.makedirs(os.path.join(DATOS, 'm'), exist_ok=True); os.makedirs(os.path.join(DATOS, 't'), exist_ok=True); os.makedirs(os.path.join(DATOS, 'n'), exist_ok=True)
N = json.load(open(os.path.join(RAIZ, 'salida', nivel + '.json')))
MATS = json.load(open(os.path.join(RAIZ, 'salida', 'mats.json')))

def f16(a): return np.asarray(a, np.float32).astype(np.float16)
def escribir_malla(nombre, pos, nor, uv, uv2, idx, piel=None, extra=None):
    """→ (meta, bytes). pos/nor/uv numpy float32; idx uint32."""
    nv = len(pos) // 3
    partes = []; off = {}; tam = 0
    def agregar(k, arr):
        nonlocal tam
        b = arr.tobytes(); pad = (-tam) % 4
        if pad: partes.append(b'\0' * pad); tam += pad
        off[k] = tam; partes.append(b); tam += len(b)
    agregar('pos', np.asarray(pos, np.float32))
    n = np.asarray(nor, np.float32).reshape(-1, 3)
    n8 = np.zeros((nv, 4), np.int8); n8[:, :3] = np.clip(np.round(n * 127), -127, 127)
    agregar('nor', n8)
    agregar('uv', f16(uv))
    if uv2 is not None: agregar('uv2', np.clip(np.round(np.asarray(uv2, np.float32) * 65535), 0, 65535).astype(np.uint16))
    if piel is not None:
        hi, pw = piel
        agregar('hi', np.asarray(hi, np.uint8 if int(max(hi)) < 256 else np.uint16))
        agregar('pw', np.clip(np.round(np.asarray(pw, np.float32) * 255), 0, 255).astype(np.uint8))
    idx = np.asarray(idx, np.uint32)
    i32 = nv > 65535
    agregar('idx', idx if i32 else idx.astype(np.uint16))
    meta = {'nv': nv, 'ni': len(idx), 'off': off, 'i32': i32}
    if piel is not None: meta['hi16'] = bool(max(piel[0]) >= 256)
    if extra: meta.update(extra)
    return meta, b''.join(partes)

mallas = {}
def malla(ruta):
    if ruta in mallas: return mallas[ruta]
    base = os.path.join(RAIZ, 'crudo', 'mallas', arch(ruta))
    if not os.path.exists(base + '.json'): mallas[ruta] = None; return None
    m = json.load(open(base + '.json')); b = open(base + '.bin', 'rb').read()
    nv, ni = m['nv'], m['ni']; o = 0
    pos = np.frombuffer(b, np.float32, nv * 3, o); o += nv * 12
    nor = np.frombuffer(b, np.float32, nv * 3, o); o += nv * 12
    uv = np.frombuffer(b, np.float32, nv * 2, o); o += nv * 8
    uv2 = None; piel = None
    if m['tipo'] == 'static':
        if m.get('uv2'): uv2 = np.frombuffer(b, np.float32, nv * 2, o); o += nv * 8
        elif m.get('lmi', 0) == 0: uv2 = uv
        if m.get('colores'): o += nv * 4
    else:
        sk = np.frombuffer(b, np.dtype([('h', '<u2', 4), ('w', '<f4', 4)]), nv, o); o += nv * 24
        hi = sk['h'].reshape(-1); pw = sk['w'].reshape(-1)
        piel = (hi, pw)
    idx = np.frombuffer(b, np.uint32, ni, o)
    extra = {'secs': m['secs'], 'mats': m['mats'], 'tipo': m['tipo']}
    if m['tipo'] == 'skel': extra.update(huesos=m['huesos'], sockets=m['sockets'], esqueleto=m['esqueleto'])
    if uv2 is not None and (uv2.min() < -0.01 or uv2.max() > 1.01): uv2 = None  # canal no apto para lightmap
    meta, datos = escribir_malla(ruta, pos, nor, uv, uv2, idx, piel, extra)
    s = slug(ruta); open(os.path.join(DATOS, 'm', s + '.bin'), 'wb').write(datos)
    meta['archivo'] = 'm/' + s + '.bin'
    p = np.asarray(pos).reshape(-1, 3); meta['caja'] = [round(float(x), 3) for x in list(p.min(0)) + list(p.max(0))]
    mallas[ruta] = meta
    return meta

texs = {}
def textura(ruta, maxpx=TEX_MAX):
    if not ruta: return None
    if ruta in texs: return texs[ruta]
    f = os.path.join(RAIZ, 'crudo', 'tex', ruta.replace('/', '~') + '.png')
    if not os.path.exists(f): texs[ruta] = None; return None
    im = Image.open(f)
    w, h = im.size
    k = min(1.0, maxpx / max(w, h))
    if k < 1: im = im.resize((max(1, int(w * k)), max(1, int(h * k))), Image.LANCZOS)
    alfa = im.mode in ('RGBA', 'LA') and np.asarray(im.convert('RGBA'))[..., 3].min() < 250
    s = slug(ruta)
    im.convert('RGBA' if alfa else 'RGB').save(os.path.join(DATOS, 't', s + '.webp'), quality=80, method=6)
    texs[ruta] = {'f': 't/' + s + '.webp', 'alfa': bool(alfa)}
    return texs[ruta]

# mallas de los nodos
usadas = set(n['malla'] for n in N['nodos'] if n.get('malla'))
for r in sorted(usadas): malla(r)
# materiales usados (de mallas + overrides + bsp + decals)
mats_usados = set()
for r, m in mallas.items():
    if m: mats_usados.update(x for x in m['mats'] if x)
for n in N['nodos']:
    mats_usados.update(x for x in (n.get('mats') or []) if x)
    if n.get('decal'): mats_usados.add(n['decal'])
for b in N.get('bsp') or []:
    if b.get('mat'): mats_usados.add(b['mat'])
mats = {}
for r in sorted(mats_usados):
    m = MATS.get(r) or {'falta': True}
    o = {k: v for k, v in m.items() if k not in ('params', 'raiz')}
    for k in ('base', 'emisivo'):
        if m.get(k):
            t = textura(m[k]); o[k] = t['f'] if t else None
            if t and t['alfa'] and k == 'base': o['alfa_tex'] = True
    mats[r] = o
# BSP como mallas
bsp_out = []
partes_bsp = []
for i, b in enumerate(N.get('bsp') or []):
    pos = np.asarray(b['pos'], np.float32); nor = np.asarray(b['nor'], np.float32)
    meta, datos = escribir_malla('bsp', pos, nor, b['uv'], b['lm'], b['idx'], extra={'secs': [[0, len(b['idx']), 0]], 'mats': [b['mat']], 'tipo': 'static'})
    s = nivel + '-bsp%d' % i
    open(os.path.join(DATOS, 'm', s + '.bin'), 'wb').write(datos); meta['archivo'] = 'm/' + s + '.bin'
    bsp_out.append({'malla': meta, 'lmid': b['lmid']})
# lightmaps
lmj = json.load(open(os.path.join(RAIZ, 'salida', 'lm', nivel + '_lm.json')))
atlas = sorted(set(v[0] for v in lmj['lm'].values()))
for a in atlas:
    im = Image.open(os.path.join(RAIZ, 'salida', 'lm', nivel + '_' + a + '.png'))
    im.save(os.path.join(DATOS, 'n', nivel + '_' + a + '.webp'), quality=85, method=6)
lm = {g: [atlas.index(v[0])] + [round(x, 6) for x in v[1:]] for g, v in lmj['lm'].items()}
nodos = N['nodos']
out = {'nombre': nivel, 'nodos': nodos, 'actores': N['actores'], 'mallas': {k: v for k, v in mallas.items() if v}, 'mats': mats,
       'bsp': bsp_out, 'lm': lm, 'atlas': ['n/' + nivel + '_' + a + '.webp' for a in atlas], 'lmrango': lmj['rango']}
json.dump(out, open(os.path.join(DATOS, 'n', nivel + '.json'), 'w'), separators=(',', ':'), ensure_ascii=False)
def peso(d): return sum(os.path.getsize(os.path.join(d, f)) for f in os.listdir(d))
print('mallas', len(mallas), 'MB %.1f' % (peso(os.path.join(DATOS, 'm')) / 1e6), '| texturas', len(texs), 'MB %.1f' % (peso(os.path.join(DATOS, 't')) / 1e6),
      '| nivel MB %.1f' % (peso(os.path.join(DATOS, 'n')) / 1e6))

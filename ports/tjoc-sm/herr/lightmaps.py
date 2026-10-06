"""Decodifica los lightmaps HQ de UE4.16 (dos coeficientes apilados) a un atlas RGB simple.
Cada componente tiene su rectángulo (CoordinateScale/Bias) y sus rangos (ScaleVectors/AddVectors).
Salida: atlas PNG (rgb = sqrt(color/RANGO)) + JSON {lmid: [atlas, sx, sy, bx, by]}.
Uso: lightmaps.py SM_LivingRoom dir_png_lm salida_dir"""
import sys, json, os, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ue4 import Paquetes, ruta_mapa
RANGO = 4.0
P = Paquetes()
nivel, dlm, sal = sys.argv[1:4]
pkg = ruta_mapa(nivel) + '_BuiltData'
d = P.paquete(pkg) or []
reg = next((e for e in d if e['Type'] == 'MapBuildDataRegistry'), {'MeshBuildData': {}})
atlas = {}   # nombre textura → (arr float [H,W,4], salida float [H/2,W,3], cobertura)
info = {}
def cargar(nom):
    if nom not in atlas:
        f = os.path.join(dlm, (pkg + '.' + nom).replace('/', '~') + '.png')
        a = np.asarray(Image.open(f).convert('RGBA')).astype(np.float32) / 255.0
        H, W = a.shape[:2]
        atlas[nom] = (a, np.zeros((H // 2, W, 3), np.float32), np.zeros((H // 2, W), bool))
    return atlas[nom]
for gid, mb in reg['MeshBuildData'].items():
    lmap = mb.get('LightMap')
    if not lmap or not lmap.get('Textures') or not lmap['Textures'][0]: continue
    _, nom = P.nombre(lmap['Textures'][0]); nom = nom.split(':')[-1]
    a, out, cub = cargar(nom)
    H, W = a.shape[0] // 2, a.shape[1]
    sc, bi = lmap['CoordinateScale'], lmap['CoordinateBias']
    S = [np.array([v['X'], v['Y'], v['Z'], v['W']], np.float32) for v in lmap['ScaleVectors']]
    A = [np.array([v['X'], v['Y'], v['Z'], v['W']], np.float32) for v in lmap['AddVectors']]
    x0, x1 = int(round(bi['X'] * W)), int(round((bi['X'] + sc['X']) * W))
    y0, y1 = int(round(bi['Y'] * H)), int(round((bi['Y'] + sc['Y']) * H))
    x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(W, max(x1, x0 + 1)), min(H, max(y1, y0 + 1))
    L0 = a[y0:y1, x0:x1]; L1 = a[H + y0:H + y1, x0:x1]
    logL = L0[..., 3] + L1[..., 3] * (1 / 255) - (0.5 / 255)
    logL = logL * S[0][3] + A[0][3]
    uvw = L0[..., :3] ** 2 * S[0][:3] + A[0][:3]
    L = np.exp2(logL) - 0.01858136
    sh = L1[..., :3] * S[1][:3] + A[1][:3]
    dirn = A[1][3] + 0.5 * np.sqrt((sh ** 2).sum(-1))
    col = np.maximum(0, (L * dirn)[..., None] * uvw)
    out[y0:y1, x0:x1] = col; cub[y0:y1, x0:x1] = True
    info[gid] = [nom, sc['X'], sc['Y'], bi['X'], bi['Y']]
os.makedirs(sal, exist_ok=True)
for nom, (a, out, cub) in atlas.items():
    # rellenar huecos con el vecino cubierto (dilatación simple, 4 pasadas)
    o = out.copy(); c = cub.copy()
    for _ in range(4):
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            sh_o = np.roll(o, (dy, dx), (0, 1)); sh_c = np.roll(c, (dy, dx), (0, 1))
            m = ~c & sh_c; o[m] = sh_o[m]; c |= m
    v = np.sqrt(np.clip(o / RANGO, 0, 1))
    Image.fromarray((v * 255 + 0.5).astype(np.uint8)).save(os.path.join(sal, nivel + '_' + nom + '.png'))
    print(nom, out.shape, 'max', float(out.max()), 'medio', float(out[cub].mean()) if cub.any() else 0)
json.dump({'rango': RANGO, 'lm': info}, open(os.path.join(sal, nivel + '_lm.json'), 'w'))
print(len(info), 'componentes con lightmap')

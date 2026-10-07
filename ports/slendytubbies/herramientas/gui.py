"""Las imágenes que el juego dibuja a pantalla completa (GUI.DrawTexture: carteles, mapa, sustos, créditos,
ayuda, título) se vuelven a sacar a 1024 (exportar.py deja todo en 512). Correr después de exportar.py.
    python -I herr/gui.py <..._Data> web/datos"""
import UnityPy, sys, os, json, glob
DATA, SAL = sys.argv[1], sys.argv[2]
env = UnityPy.load(DATA)
F = {os.path.basename(k): f for k, f in env.files.items() if hasattr(f, 'objects')}
C = json.load(open(os.path.join(SAL, 'comun.json')))
ids = set()
def mirar(nodos):
    for n in nodos:
        for g in n.get('guiones', []):
            for k in ('yourtexture',):
                v = g.get(k)
                if isinstance(v, dict) and v.get('tex'): ids.add(v['tex'])
for f in glob.glob(os.path.join(SAL, 'escena-*.json')): mirar(json.load(open(f))['nodos'])
for pf in C['prefabs'].values(): mirar(pf['nodos'])
for k in sorted(ids):
    pre, pid = k.split('_')
    arch = 'mainData' if pre == 'm' else 'sharedassets' + pre[1:] + '.assets'
    o = F[arch].objects.get(int(pid))
    if o is None: continue
    im = o.read(check_read=False).image
    s = max(im.width, im.height)
    if s > 1024: f = 1024 / s; im = im.resize((int(im.width * f), int(im.height * f)))
    t = C['texs'][k]
    alfa = im.mode == 'RGBA' and im.getextrema()[3][0] < 250
    if not alfa: im = im.convert('RGB')
    im.save(os.path.join(SAL, t['arch']), 'WEBP', quality=82, method=6)
    t.update(w=im.width, h=im.height, alfa=alfa)
    print(k, t['nombre'], im.size)
json.dump(C, open(os.path.join(SAL, 'comun.json'), 'w'), ensure_ascii=False, separators=(',', ':'))

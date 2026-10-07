"""Arma web/datos para los niveles pedidos: niveles (nodos, actores, BSP, lightmaps), índices globales de
mallas/materiales/sonidos/animaciones/UI y los archivos comprimidos. Exporta con ue.sh lo que falte.
Uso: paquete.py SM_Bedroom SMMenu ...     (variables: TEX_MAX=512 UI_MAX=1024 AUDIO_KBPS=24)"""
import sys, os, json, re, hashlib, subprocess, glob
import numpy as np
from PIL import Image
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
from ue4 import Paquetes, ruta_mapa
import materiales as MAT
P = Paquetes()
DATOS = os.path.join(RAIZ, 'web', 'datos'); CRUDO = os.path.join(RAIZ, 'crudo')
TEX_MAX = int(os.environ.get('TEX_MAX', '512')); UI_MAX = int(os.environ.get('UI_MAX', '1024')); KBPS = int(os.environ.get('AUDIO_KBPS', '24'))
for d in ('m', 't', 'u', 's', 'a', 'n', 'f'): os.makedirs(os.path.join(DATOS, d), exist_ok=True)
UE = os.path.join(AQUI, 'ue.sh')
def ue(cmd, sal, items, ver=None):
    if not items: return []
    lst = os.path.join(CRUDO, '_lista.txt'); open(lst, 'w').write('\n'.join(items))
    env = dict(os.environ); 
    if ver: env['UEVER'] = ver
    r = subprocess.run([UE, cmd, sal, '@' + lst], capture_output=True, text=True, env=env)
    return [re.sub(r'^MAL (.*?): .*', r'\1', l) for l in (r.stdout + r.stderr).splitlines() if l.startswith('MAL ')]
def slug(ruta):
    base = re.sub(r'[^A-Za-z0-9_]+', '_', ruta.split('/')[-1].split('.')[-1])[:40]
    return base + '-' + hashlib.md5(ruta.encode()).hexdigest()[:6]
def cargar_json(f, defecto):
    try: return json.load(open(f))
    except Exception: return defecto
def guardar_json(f, o): json.dump(o, open(f, 'w'), separators=(',', ':'), ensure_ascii=False)

niveles = sys.argv[1:]
# ---------- 1) niveles ----------
for n in niveles:
    subprocess.run([UE, 'exp', os.path.join(CRUDO, 'exp'), '%s|^ModelComponent_' % ruta_mapa(n)], capture_output=True)
    subprocess.run([sys.executable, '-I', os.path.join(AQUI, 'nivel.py'), n, os.path.join(RAIZ, 'salida', n + '.json')], check=True, capture_output=True)
N = {n: json.load(open(os.path.join(RAIZ, 'salida', n + '.json'))) for n in niveles}

# ---------- 2) clases usadas (cierre como VM.precargar) ----------
CL = {}
def clase(n):
    if n not in CL: CL[n] = cargar_json(os.path.join(DATOS, 'c', n + '.json'), None)
    return CL[n]
pend = []
for n, lv in N.items():
    pend.append(n + '_C')
    pend += [a['clase'] for a in lv['actores'] if a['clase'].endswith('_C')]
    pend += [nd['animbp'].split('.')[-1] for nd in lv['nodos'] if nd.get('animbp')]  # (las AnimBP de los esqueletos)
    ws = [a for a in lv['actores'] if a['clase'] == 'WorldSettings']
    if ws and ((ws[0].get('props') or {}).get('DefaultGameMode') or {}).get('asset'): pend.append(ws[0]['props']['DefaultGameMode']['asset'].split('.')[-1])
usadas = set()
while pend:
    n = pend.pop()
    if not n or n in usadas: continue
    c = clase(n)
    if not c: continue
    usadas.add(n)
    def rec(x):
        if isinstance(x, list):
            if x and x[0] == 'cast' and isinstance(x[1], str) and x[1].endswith('_C'): pend.append(x[1])
            for v in x: rec(v)
        elif isinstance(x, dict):
            if isinstance(x.get('clase'), str): pend.append(x['clase'])
            if x.get('tipo') in ('BlueprintGeneratedClass', 'WidgetBlueprintGeneratedClass', 'AnimBlueprintGeneratedClass') and x.get('asset'): pend.append(x['asset'].split('.')[-1])
            if x.get('tipo', '').endswith('_C') and 'n' in x: pend.append(x['tipo'])
            for v in x.values(): rec(v)
    rec(c.get('funcs')); rec(c.get('cdo')); rec(c.get('plantillas')); rec(c.get('widgets')); rec(c.get('scs'))
    if c.get('super') and not c.get('super_nativo'): pend.append(c['super'])
print('clases usadas', len(usadas))

# ---------- 3) assets ----------
A = {k: set() for k in ('malla', 'mat', 'tex', 'ui', 'snd', 'anim', 'fuente', 'bs')}
def asset_ref(x, ctx=''):
    if isinstance(x, list):
        for v in x: asset_ref(v, ctx)
    elif isinstance(x, dict):
        t = x.get('tipo'); a = x.get('asset')
        if a and t:
            if t in ('StaticMesh', 'SkeletalMesh'): A['malla'].add(a)
            elif t.startswith('Material'): A['mat'].add(a)
            elif t in ('Texture2D', 'TextureRenderTarget2D'): (A['ui'] if ctx == 'ui' else A['tex']).add(a)
            elif t.startswith('Sound') and t != 'SoundAttenuation' and t != 'SoundClass' and t != 'SoundMix': A['snd'].add(a)
            elif t in ('AnimSequence', 'AnimMontage'): A['anim'].add(a)
            elif t.startswith('BlendSpace') or t.startswith('AimOffset'): A['bs'].add(a)
            elif t == 'Font': A['fuente'].add(a)
        for k, v in x.items(): asset_ref(v, 'ui' if k in ('Brush', 'WidgetStyle', 'Background', 'Normal', 'Hovered', 'Pressed', 'ResourceObject') or ctx == 'ui' else ctx)
for n in usadas:
    c = clase(n)
    asset_ref(c.get('funcs'), 'ui' if c['tipo'] == 'WidgetBlueprintGeneratedClass' else '')
    asset_ref(c.get('cdo')); asset_ref(c.get('plantillas'))
    asset_ref(c.get('widgets'), 'ui')
for n, lv in N.items():
    for nd in lv['nodos']:
        if nd.get('malla'): A['malla'].add(nd['malla'])
        for m in nd.get('mats') or []:
            if m: A['mat'].add(m)
        if nd.get('decal'): A['mat'].add(nd['decal'])
        if nd.get('sonido'): A['snd'].add(nd['sonido'])
        if nd.get('anim'): A['anim'].add(nd['anim'])
    for a in lv['actores']:
        asset_ref(a.get('props'))
        m = a.get('matinee')
        if m:
            for g in m['grupos']:
                for p in g['pistas']:
                    if p['t'] == 'snd': A['snd'].update(k[3] for k in p['k'] if k[3])
                    if p['t'] == 'anim': A['anim'].update(k[1] for k in p['k'] if k[1])
    for b in lv.get('bsp') or []:
        if b.get('mat'): A['mat'].add(b['mat'])
# secuencias (LevelSequence): de las clases (CreateLevelSequencePlayer) y de los actores del nivel
from escenas import movie_scene
SECS = cargar_json(os.path.join(DATOS, 'secuencias.json'), {})
os.makedirs(os.path.join(DATOS, 'q'), exist_ok=True)
rutas_sec = set()
def buscar_sec(x):
    if isinstance(x, list):
        for v in x: buscar_sec(v)
    elif isinstance(x, dict):
        if x.get('tipo') == 'LevelSequence' and x.get('asset'): rutas_sec.add(x['asset'])
        if 'soft' in x and isinstance(x['soft'], str): pass
        for v in x.values(): buscar_sec(v)
for n in usadas: buscar_sec(clase(n).get('funcs'))
for n, lv in N.items():
    for a in lv['actores']:
        ls = (a.get('props') or {}).get('LevelSequence')
        if isinstance(ls, dict) and ls.get('AssetPathName'):
            p = ls['AssetPathName'].replace('/Game/', 'TJoC_SM/Content/', 1); rutas_sec.add(p + '.' + p.split('/')[-1])
def ref_val_sec(v):
    if isinstance(v, dict):
        if 'ObjectPath' in v and 'ObjectName' in v:
            m = re.match(r"(\w+)'(.*)'$", v['ObjectName']); t = m.group(1) if m else None
            pk = re.sub(r'\.\d+$', '', v['ObjectPath']); nn = (m.group(2) if m else '').split(':')[-1]
            return {'asset': pk + '.' + nn, 'tipo': t} if not v['ObjectPath'].startswith('/Script') else {'nat': nn, 'tipo': t}
        return {k: ref_val_sec(x) for k, x in v.items()}
    if isinstance(v, list): return [ref_val_sec(x) for x in v]
    return v
for r in sorted(rutas_sec):
    pkg = r.split('.')[0]; d = P.paquete(pkg)
    if not d: continue
    ls = next((e for e in d if e['Type'] == 'LevelSequence'), None)
    if not ls: continue
    pr = ls.get('Properties') or {}
    mi = re.match(r'.*\.(\d+)$', (pr.get('MovieScene') or {}).get('ObjectPath', ''))
    ms = movie_scene(d, int(mi.group(1)) if mi else None, pkg, ref_val_sec)
    refs = {}
    for b in ((pr.get('BindingReferences') or {}).get('BindingIdToReferences') or []): refs[b['Key']] = [x.get('ObjectPath') for x in (b.get('Value') or {}).get('References') or []]
    for b in ((pr.get('ObjectReferences') or {}).get('Map') or []): refs.setdefault(b.get('Key'), []).append(str(b.get('Value')))
    s_ = slug(r); guardar_json(os.path.join(DATOS, 'q', s_ + '.json'), {'ms': ms, 'refs': refs}); SECS[r] = 'q/' + s_ + '.json'
    def assets_sec(x):
        if isinstance(x, list):
            for v in x: assets_sec(v)
        elif isinstance(x, dict):
            if x.get('tipo') in ('AnimSequence',) and x.get('asset'): A['anim'].add(x['asset'])
            if x.get('tipo') in ('SoundWave', 'SoundCue') and x.get('asset'): A['snd'].add(x['asset'])
            for v in x.values(): assets_sec(v)
    assets_sec(ms)
guardar_json(os.path.join(DATOS, 'secuencias.json'), SECS)
# blend spaces (los usan las AnimBP): muestras animación → valor de los ejes
BS = cargar_json(os.path.join(DATOS, 'bs.json'), {})
for r in sorted(A['bs']):
    d = P.paquete(r.split('.')[0])
    o = next((e for e in d or [] if e['Type'].startswith('BlendSpace') or e['Type'].startswith('AimOffset')), None)
    if not o: continue
    pr = o.get('Properties') or {}
    mu = []
    for sd in pr.get('SampleData') or []:
        an = ref_val_sec(sd.get('Animation'))
        if isinstance(an, dict) and an.get('asset'):
            A['anim'].add(an['asset']); v = sd.get('SampleValue') or {}
            mu.append([an['asset'], v.get('X', 0), v.get('Y', 0), sd.get('RateScale', 1)])
    BS[r] = {'tipo': o['Type'], 'muestras': mu, 'ejes': [{'min': b.get('Min', 0), 'max': b.get('Max', 100)} for b in pr.get('BlendParameters') or []] if isinstance(pr.get('BlendParameters'), list) else None}
guardar_json(os.path.join(DATOS, 'bs.json'), BS)
print('blend spaces', len(BS))
print('secuencias', len(rutas_sec))
A['malla'] = {m for m in A['malla'] if not m.startswith('Engine/Content/EditorMeshes')}
print({k: len(v) for k, v in A.items()})

# ---------- 4) mallas ----------
def arch(r): return os.path.join(CRUDO, 'mallas', r.replace('/', '~'))
falt = [m for m in sorted(A['malla']) if not os.path.exists(arch(m) + '.json')]
malas = ue('malla', os.path.join(CRUDO, 'mallas'), falt)
if malas: malas = ue('malla', os.path.join(CRUDO, 'mallas'), malas, 'GAME_UE4_18')
if malas: print('mallas sin exportar:', malas[:10])
MALLAS = cargar_json(os.path.join(DATOS, 'mallas.json'), {})
def f16(a): return np.asarray(a, np.float32).astype(np.float16)
def escribir_malla(pos, nor, uv, uv2, idx, piel=None):
    nv = len(pos) // 3; partes = []; off = {}; tam = 0
    def agregar(k, arr):
        nonlocal tam
        b = arr.tobytes(); pad = (-tam) % 4
        if pad: partes.append(b'\0' * pad); tam += pad
        off[k] = tam; partes.append(b); tam += len(b)
    agregar('pos', np.asarray(pos, np.float32))
    n = np.asarray(nor, np.float32).reshape(-1, 3); n8 = np.zeros((nv, 4), np.int8); n8[:, :3] = np.clip(np.round(n * 127), -127, 127); agregar('nor', n8)
    agregar('uv', f16(uv))
    if uv2 is not None: agregar('uv2', np.clip(np.round(np.asarray(uv2, np.float32) * 65535), 0, 65535).astype(np.uint16))
    meta = {}
    if piel is not None:
        hi, pw = piel; big = int(hi.max()) >= 256
        agregar('hi', hi.astype(np.uint16 if big else np.uint8)); agregar('pw', np.clip(np.round(pw * 255), 0, 255).astype(np.uint8)); meta['hi16'] = big
    idx = np.asarray(idx, np.uint32); i32 = nv > 65535
    agregar('idx', idx if i32 else idx.astype(np.uint16))
    meta.update(nv=nv, ni=int(len(idx)), off=off, i32=i32)
    return meta, b''.join(partes)
for r in sorted(A['malla']):
    if r in MALLAS and os.path.exists(os.path.join(DATOS, MALLAS[r]['archivo'])): continue
    if not os.path.exists(arch(r) + '.json'): continue
    m = json.load(open(arch(r) + '.json')); b = open(arch(r) + '.bin', 'rb').read()
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
        piel = (sk['h'].reshape(-1), sk['w'].reshape(-1))
    idx = np.frombuffer(b, np.uint32, ni, o)
    if uv2 is not None and (uv2.min() < -0.01 or uv2.max() > 1.01): uv2 = None
    meta, datos = escribir_malla(pos, nor, uv, uv2, idx, piel)
    meta.update(secs=m['secs'], mats=m['mats'], tipo=m['tipo'])
    if m['tipo'] == 'skel': meta.update(huesos=m['huesos'], sockets=m['sockets'], esqueleto=m['esqueleto'])
    s = slug(r); open(os.path.join(DATOS, 'm', s + '.bin'), 'wb').write(datos); meta['archivo'] = 'm/' + s + '.bin'
    p = pos.reshape(-1, 3); meta['caja'] = [round(float(x), 3) for x in list(p.min(0)) + list(p.max(0))]
    MALLAS[r] = meta
    A['mat'].update(x for x in m['mats'] if x)
# BSP de cada nivel como mallas
BSP = {}
for n, lv in N.items():
    BSP[n] = []
    for i, bb in enumerate(lv.get('bsp') or []):
        meta, datos = escribir_malla(np.asarray(bb['pos'], np.float32), np.asarray(bb['nor'], np.float32), bb['uv'], bb['lm'], bb['idx'])
        meta.update(secs=[[0, len(bb['idx']), 0]], mats=[bb['mat']], tipo='static')
        s = n + '-bsp%d' % i; open(os.path.join(DATOS, 'm', s + '.bin'), 'wb').write(datos); meta['archivo'] = 'm/' + s + '.bin'
        BSP[n].append({'malla': meta, 'lmid': bb['lmid']})
guardar_json(os.path.join(DATOS, 'mallas.json'), MALLAS)

# ---------- 5) materiales y texturas ----------
MATS = cargar_json(os.path.join(DATOS, 'mats.json'), {})
nuevos = [m for m in sorted(A['mat']) if m not in MATS]
res = {m: MAT.resolver(m) for m in nuevos}
for m, v in res.items():
    for k in ('base', 'emisivo'):
        if v.get(k): A['tex'].add(v[k])
for m, v in MATS.items():
    for k in ('baseRuta', 'emRuta'):
        if v.get(k): A['tex'].add(v[k])
def tex_png(r): return os.path.join(CRUDO, 'tex', r.replace('/', '~') + '.png')
falt = [r + '|%d' % max(TEX_MAX, UI_MAX) for r in sorted(A['tex'] | A['ui']) if not os.path.exists(tex_png(r))]
ue('tex', os.path.join(CRUDO, 'tex'), falt)
TEXS = cargar_json(os.path.join(DATOS, 'texturas.json'), {})
def textura(r, maxpx, carpeta):
    k = carpeta + ':' + r
    if k in TEXS and os.path.exists(os.path.join(DATOS, TEXS[k]['f'])): return TEXS[k]
    f = tex_png(r)
    if not os.path.exists(f): return None
    im = Image.open(f); w, h = im.size
    esc = min(1.0, maxpx / max(w, h))
    if esc < 1: im = im.resize((max(1, int(w * esc)), max(1, int(h * esc))), Image.LANCZOS)
    rgba = im.convert('RGBA'); alfa = np.asarray(rgba)[..., 3].min() < 250
    s = slug(r); dest = os.path.join(DATOS, carpeta, s + '.webp')
    (rgba if alfa else im.convert('RGB')).save(dest, quality=80 if carpeta == 't' else 88, method=6)
    TEXS[k] = {'f': carpeta + '/' + s + '.webp', 'alfa': bool(alfa), 'w': w, 'h': h}
    return TEXS[k]
for m, v in res.items():
    o = {k: x for k, x in v.items() if k not in ('params', 'raiz')}
    for k, kr in (('base', 'baseRuta'), ('emisivo', 'emRuta')):
        if v.get(k):
            t = textura(v[k], TEX_MAX, 't'); o[kr] = v[k]; o[k] = t['f'] if t else None
            if t and t['alfa'] and k == 'base': o['alfa_tex'] = True
    MATS[m] = o
guardar_json(os.path.join(DATOS, 'mats.json'), MATS)
UI = cargar_json(os.path.join(DATOS, 'ui.json'), {'tex': {}, 'fuentes': {}})
for r in sorted(A['ui'] | A['tex']):
    t = textura(r, UI_MAX if r in A['ui'] else TEX_MAX, 'u' if r in A['ui'] else 't')
    if t: UI['tex'][r] = t
# fuentes (.ufont = TTF/OTF crudo)
for r in sorted(A['fuente']):
    pkg = r.split('.')[0]; d = P.paquete(pkg) or []
    for e in d:
        if e['Type'] == 'FontFace':
            uf = pkg.rsplit('/', 1)[0] + '/' + e['Name'] + '.ufont'
            dest = os.path.join(DATOS, 'f', slug(r) + '.ttf')
            if not os.path.exists(dest):
                subprocess.run([UE, 'crudo', os.path.join(CRUDO, 'fuentes'), uf], capture_output=True)
                src = os.path.join(CRUDO, 'fuentes', uf.replace('/', '~'))
                if os.path.exists(src): open(dest, 'wb').write(open(src, 'rb').read())
            if os.path.exists(dest): UI['fuentes'][r] = 'f/' + os.path.basename(dest)
            break
guardar_json(os.path.join(DATOS, 'ui.json'), UI)
guardar_json(os.path.join(DATOS, 'texturas.json'), TEXS)

# ---------- 6) sonidos ----------
SND = cargar_json(os.path.join(DATOS, 'sonidos.json'), {})
ondas = set()
def soft(p): p = p.replace('/Game/', 'TJoC_SM/Content/', 1); return p + '.' + p.split('/')[-1]
def nodo_cue(d, ref, pkg):
    m = re.match(r'(.*)\.(\d+)$', (ref or {}).get('ObjectPath', ''))
    if not m: return None
    e = d[int(m.group(2))]; pr = e.get('Properties') or {}; t = e['Type']
    hijos = [nodo_cue(d, h, pkg) for h in pr.get('ChildNodes') or []]
    if t == 'SoundNodeWavePlayer':
        w = pr.get('SoundWaveAssetPtr') or pr.get('SoundWave')
        wp = soft(w['AssetPathName']) if isinstance(w, dict) and 'AssetPathName' in w else (P.ruta(w) if w else None)
        if wp: ondas.add(wp)
        return {'t': 'w', 'w': wp, 'loop': pr.get('bLooping', False)}
    if t == 'SoundNodeRandom': return {'t': 'rnd', 'pesos': pr.get('Weights'), 'h': hijos}
    if t == 'SoundNodeModulator': return {'t': 'mod', 'p0': pr.get('PitchMin', 0.95), 'p1': pr.get('PitchMax', 1.05), 'v0': pr.get('VolumeMin', 0.95), 'v1': pr.get('VolumeMax', 1.05), 'h': hijos}
    if t == 'SoundNodeMixer': return {'t': 'mix', 'vols': pr.get('InputVolume'), 'h': hijos}
    if t == 'SoundNodeDelay': return {'t': 'del', 'd0': pr.get('DelayMin', 0), 'd1': pr.get('DelayMax', 0), 'h': hijos}
    if t == 'SoundNodeLooping': return {'t': 'loop', 'h': hijos}
    if t == 'SoundNodeConcatenator': return {'t': 'cat', 'vols': pr.get('InputVolume'), 'h': hijos}
    return {'t': 'pasa', 'h': hijos}
def aten(ref):
    if not ref: return None
    ae = P.obj(ref) if isinstance(ref, dict) and 'ObjectPath' in ref else None
    if not ae: return None
    s = ((ae.get('Properties') or {}).get('Attenuation') or {})
    return {'radio': (s.get('AttenuationShapeExtents') or {}).get('X', 400), 'caida': s.get('FalloffDistance', 3600), 'espacial': s.get('bSpatialize', True)}
for r in sorted(A['snd']):
    if r in SND: continue
    pkg = r.split('.')[0]; d = P.paquete(pkg)
    if not d: continue
    e = next((x for x in d if x['Type'] in ('SoundCue', 'SoundWave')), None)
    if not e: continue
    pr = e.get('Properties') or {}
    if e['Type'] == 'SoundCue':
        SND[r] = {'nodo': nodo_cue(d, pr.get('FirstNode'), pkg), 'vol': pr.get('VolumeMultiplier', 0.75), 'tono': pr.get('PitchMultiplier', 1.0), 'dur': pr.get('Duration', 0)}
        at = aten(pr.get('AttenuationSettings')) if not pr.get('bOverrideAttenuation') else None
        if at: SND[r]['aten'] = at
    else: ondas.add(r)
for w in list(ondas):
    if w in SND and SND[w].get('f'): continue
    pkg = w.split('.')[0]; d = P.paquete(pkg) or []
    e = next((x for x in d if x['Type'] == 'SoundWave'), None)
    pr = (e or {}).get('Properties') or {}
    SND[w] = {'f': None, 'dur': pr.get('Duration', 0), 'loop': pr.get('bLooping', False), 'vol': pr.get('Volume', 1.0), 'tono': pr.get('Pitch', 1.0)}
    at = aten(pr.get('AttenuationSettings'))
    if at: SND[w]['aten'] = at
os.makedirs(os.path.join(CRUDO, 'snd'), exist_ok=True)
falt = [w for w in ondas if not glob.glob(os.path.join(CRUDO, 'snd', w.replace('/', '~') + '.*'))]
ue('snd', os.path.join(CRUDO, 'snd'), falt)
for w in sorted(ondas):
    if SND[w].get('f') and os.path.exists(os.path.join(DATOS, SND[w]['f'])): continue
    src = glob.glob(os.path.join(CRUDO, 'snd', w.replace('/', '~') + '.*'))
    if not src: continue
    s = slug(w); dest = os.path.join(DATOS, 's', s + '.ogg')
    largo = SND[w]['dur'] > 20
    kb = KBPS + (8 if largo else 0)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src[0], '-ac', '2' if largo else '1', '-c:a', 'libopus', '-b:a', '%dk' % kb, '-vbr', 'on', dest], check=False)
    if os.path.exists(dest): SND[w]['f'] = 's/' + s + '.ogg'
guardar_json(os.path.join(DATOS, 'sonidos.json'), SND)

# ---------- 7) animaciones ----------
ANIMS = cargar_json(os.path.join(DATOS, 'anims.json'), {})
os.makedirs(os.path.join(CRUDO, 'anims'), exist_ok=True)
falt = [a for a in sorted(A['anim']) if not os.path.exists(os.path.join(CRUDO, 'anims', a.replace('/', '~') + '.json'))]
malas = ue('anim', os.path.join(CRUDO, 'anims'), falt, 'GAME_UE4_16')
if malas: print('anims sin exportar:', malas[:8])
for r in sorted(A['anim']):
    if r in ANIMS and os.path.exists(os.path.join(DATOS, ANIMS[r]['f'])): continue
    f = os.path.join(CRUDO, 'anims', r.replace('/', '~') + '.json')
    if not os.path.exists(f): continue
    j = json.load(open(f)); partes = []; pistas = []; tam = 0
    def agregar(b):
        global tam
        partes.append(b); o = tam; tam += len(b); return o
    for hi, p in enumerate(j['pistas']):
        if not p: continue
        for tipo, dim in (('p', 3), ('r', 4), ('s', 3)):
            v = np.asarray(p[tipo], np.float32).reshape(-1, dim)
            if tipo == 's' and np.allclose(v, 1, atol=1e-4): continue
            if np.allclose(v, v[0], atol=1e-5): v = v[:1]
            if tipo == 'r':
                v = v / np.maximum(1e-8, np.linalg.norm(v, axis=1, keepdims=True))
                q = np.clip(np.round(v * 32767), -32767, 32767).astype(np.int16); esc = 1
            else:
                mx = float(np.abs(v).max()) or 1.0; esc = mx / 32767; q = np.clip(np.round(v / esc), -32767, 32767).astype(np.int16)
            pad = (-tam) % 4
            if pad: agregar(b'\0' * pad)
            o = agregar(q.tobytes()); pistas.append([hi, tipo, o, len(v), esc])
    s = slug(r); open(os.path.join(DATOS, 'a', s + '.bin'), 'wb').write(b''.join(partes))
    nots = []
    pkg = r.split('.')[0]; d = P.paquete(pkg) or []
    ae = next((x for x in d if x['Type'] in ('AnimSequence', 'AnimMontage')), None)
    for nf in ((ae or {}).get('Properties') or {}).get('Notifies') or []:
        ne = P.obj(nf.get('Notify')) if nf.get('Notify') else None
        t = nf.get('LinkValue', nf.get('DisplayTime_DEPRECATED', 0))
        if not ne:  # (un notify con nombre: la AnimBP recibe el evento AnimNotify_<nombre>)
            if nf.get('NotifyName') and nf['NotifyName'] != 'None': nots.append({'t': t, 'nombre': nf['NotifyName']})
            continue
        np_ = ne.get('Properties') or {}
        t = nf.get('LinkValue', nf.get('DisplayTime_DEPRECATED', 0))
        if ne['Type'] == 'AnimNotify_PlaySound' and np_.get('Sound'):
            sr = P.ruta(np_['Sound']); nots.append({'t': t, 'sonido': sr, 'vol': np_.get('VolumeMultiplier', 1), 'tono': np_.get('PitchMultiplier', 1)}); A['snd'].add(sr)
    ANIMS[r] = {'f': 'a/' + s + '.bin', 'fps': j['fps'], 'frames': j['frames'], 'dur': j['dur'], 'huesos': j['huesos'], 'pistas': pistas, 'notifies': nots}
guardar_json(os.path.join(DATOS, 'anims.json'), ANIMS)

# ---------- 8) niveles ----------
for n, lv in N.items():
    lmj = os.path.join(RAIZ, 'salida', 'lm', n + '_lm.json')
    bd = ruta_mapa(n) + '_BuiltData'
    bdj = os.path.join(CRUDO, 'todo', bd.replace('/', '~') + '.uasset.json')
    if os.path.exists(bdj):
        lms = [bd + '.' + e['Name'] + '|8192' for e in json.load(open(bdj)) if e['Type'] == 'LightMapTexture2D' and e['Name'].startswith('HQ_')]
        ue('tex', os.path.join(CRUDO, 'lm'), [x for x in lms if not os.path.exists(os.path.join(CRUDO, 'lm', x.split('|')[0].replace('/', '~') + '.png'))])
        subprocess.run([sys.executable, '-I', os.path.join(AQUI, 'lightmaps.py'), n, os.path.join(CRUDO, 'lm'), os.path.join(RAIZ, 'salida', 'lm')], capture_output=True)
    lm = cargar_json(lmj, {'lm': {}, 'rango': 4.0})
    atlas = sorted(set(v[0] for v in lm['lm'].values()))
    for a in atlas:
        src = os.path.join(RAIZ, 'salida', 'lm', n + '_' + a + '.png')
        if os.path.exists(src): Image.open(src).save(os.path.join(DATOS, 'n', n + '_' + a + '.webp'), quality=85, method=6)
    out = {'nombre': n, 'nodos': lv['nodos'], 'actores': lv['actores'], 'bsp': BSP[n], 'lm': {g: [atlas.index(v[0])] + [round(x, 6) for x in v[1:]] for g, v in lm['lm'].items()},
           'atlas': ['n/' + n + '_' + a + '.webp' for a in atlas], 'lmrango': lm.get('rango', 4.0), 'clases': sorted(usadas),
           'sonidos': sorted(A['snd']), 'anims': sorted(A['anim']), 'secuencias': sorted(rutas_sec)}
    guardar_json(os.path.join(DATOS, 'n', n + '.json'), out)
def peso(d): return sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(d) for f in fs) / 1e6
print('datos MB: total %.1f | mallas %.1f | tex %.1f | ui %.1f | sonido %.1f | anim %.1f | niveles %.1f | clases %.1f' % (peso(DATOS), peso(os.path.join(DATOS, 'm')), peso(os.path.join(DATOS, 't')), peso(os.path.join(DATOS, 'u')), peso(os.path.join(DATOS, 's')), peso(os.path.join(DATOS, 'a')), peso(os.path.join(DATOS, 'n')), peso(os.path.join(DATOS, 'c'))))

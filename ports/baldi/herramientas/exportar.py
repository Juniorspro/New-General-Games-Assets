# Exporta las escenas de Baldi's Basics (Unity 2018.2) a datos para three.js: una escena-N.json por nivel
# (nodos con transform o RectTransform, componentes, UI y scripts con sus campos) y un fondo común de mallas
# (mallas.bin), texturas y sprites (webp), materiales, clips (incluidos los de sprites), controladores de
# animación, audios (Opus), fuentes, prefabs y la malla de navegación (nav-N.bin, polígonos de Detour).
# Unity es de mano izquierda: z cambia de signo.
#     python -I exportar.py <BALDI_Data> <salida/datos>
import UnityPy, sys, os, json, struct, subprocess, math
from UnityPy.helpers.MeshHelper import MeshHandler
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tipos import generador
# FMOD (con el que UnityPy decodifica los FSB5) sin placa de sonido: salida «sin sonido», que no necesita dispositivo
import fmod_toolkit.fmod as _ff
def _sistema_mudo(channels, flags):
    with _ff.SYSTEM_GLOBAL_LOCK:
        k = (channels, flags)
        if k in _ff.SYSTEM_INSTANCES: return _ff.SYSTEM_INSTANCES[k]
        s = _ff.pyfmodex.System()
        s.output = _ff.pyfmodex.enums.OUTPUTTYPE.NOSOUND_NRT
        s.init(channels, flags, None)
        from threading import Lock
        _ff.SYSTEM_INSTANCES[k] = (s, Lock())
        return _ff.SYSTEM_INSTANCES[k]
_ff.get_pyfmodex_system_instance = _sistema_mudo

DATA, SAL = sys.argv[1], sys.argv[2]
os.makedirs(SAL, exist_ok=True)
CRUDO = os.path.join(SAL, '..', '..', 'crudo'); os.makedirs(CRUDO, exist_ok=True)
env = UnityPy.load(DATA)
VERSION = '2018.2.21f1'
env.typetree_generator = generador(DATA, VERSION)
FILES = {os.path.basename(k): f for k, f in env.files.items() if hasattr(f, 'objects')}
ABR = {n: ('g' if n == 'globalgamemanagers' else 'ga' if n == 'globalgamemanagers.assets' else 'r' if n.startswith('unity default') else 'e' if n.startswith('unity_builtin') else
           n.replace('sharedassets', 's').replace('.assets', '').replace('level', 'l').replace('resources', 'res')) for n in FILES}
tt = lambda o: o.read_typetree(check_read=False)

def P(v): return [round(v['x'], 5), round(v['y'], 5), round(-v['z'], 5)]
def Q(q): return [round(-q['x'], 6), round(-q['y'], 6), round(q['z'], 6), round(q['w'], 6)]
def C(c): return [round(c['r'], 4), round(c['g'], 4), round(c['b'], 4), round(c.get('a', 1), 4)]
def V2(v): return [round(v['x'], 4), round(v['y'], 4)]

main = FILES['globalgamemanagers']
build = next(tt(o) for o in main.objects.values() if o.type.name == 'BuildSettings')
NOMBRES = [os.path.splitext(os.path.basename(s))[0] for s in build['scenes']]
ARCH_ESC = [f'level{i}' for i in range(len(NOMBRES))]
tm = next(tt(o) for o in main.objects.values() if o.type.name == 'TagManager')
TAGS_BASE = {0: '', 1: 'Respawn', 2: 'Finish', 3: 'EditorOnly', 5: 'MainCamera', 6: 'Player', 7: 'GameController'}
def tag(i): return TAGS_BASE.get(i, '') if i < 20000 else (tm['tags'][i - 20000] if i - 20000 < len(tm['tags']) else f'tag{i}')
CAPAS = tm.get('layers', [])

def ref(obj, pptr):
    fid, pid = (pptr['m_FileID'], pptr['m_PathID']) if isinstance(pptr, dict) else pptr
    if pid == 0: return None
    af = obj.assets_file
    if fid == 0: return (os.path.basename(af.name), pid)
    if fid < 0 or fid - 1 >= len(af.externals): return None
    return (os.path.basename(af.externals[fid - 1].path), pid)
def objeto(r): return FILES[r[0]].objects.get(r[1]) if r and r[0] in FILES else None
def idr(r): return f'{ABR.get(r[0], r[0])}_{r[1]}'

mallas, mats, texs, sprites, clips, ctrls, audios, fuentes = {}, {}, {}, {}, {}, {}, {}, {}
BIN = bytearray()
def alinear():
    while len(BIN) % 4: BIN.append(0)

def malla(r, solo_col=False):
    k = idr(r) + ('c' if solo_col else '')
    if k in mallas: return k
    o = objeto(r)
    if o is None: mallas[k] = {'falta': True}; return k
    m = o.read(check_read=False); h = MeshHandler(m)
    try: h.process()
    except Exception as ex:
        print('malla sin leer', m.m_Name, type(ex).__name__, str(ex)[:80], flush=True)
        mallas[k] = {'falta': True, 'nombre': m.m_Name}; return k
    v, n, uv, col = h.m_Vertices or [], h.m_Normals or [], h.m_UV0 or [], h.m_Colors or []
    tris = h.get_triangles()
    e = {'nombre': m.m_Name, 'nv': len(v), 'subs': []}
    alinear(); e['pos'] = len(BIN)
    for p in v: BIN.extend(struct.pack('<3f', p[0], p[1], -p[2]))
    q8 = lambda x: max(-127, min(127, int(round(x * 127))))
    if len(n) == len(v) and v and not solo_col:
        e['nor8'] = len(BIN)
        for p in n:
            l = (p[0] ** 2 + p[1] ** 2 + p[2] ** 2) ** 0.5 or 1
            BIN.extend(struct.pack('<4b', q8(p[0] / l), q8(p[1] / l), q8(-p[2] / l), 0))
    if len(uv) == len(v) and v and not solo_col:
        e['uv16'] = len(BIN)
        for p in uv: BIN.extend(struct.pack('<2e', max(-65000, min(65000, p[0])), max(-65000, min(65000, p[1]))))
    if solo_col: col = []
    if len(col) == len(v) and v and any(c != (1, 1, 1, 1) and c != (255, 255, 255, 255) for c in col[:50]):
        e['col'] = len(BIN)
        mx = 255 if max(max(c) for c in col[:50]) > 1.01 else 1
        for c in col: BIN.extend(struct.pack('<4B', *[max(0, min(255, int(x * 255 / mx))) for x in c]))
    big = len(v) > 65535
    e['i32'] = big
    for s in tris:
        alinear(); off = len(BIN)
        for a, b, c in s: BIN.extend(struct.pack('<3I' if big else '<3H', a, c, b))
        e['subs'].append([off, len(s) * 3])
    if v:
        xs = [p[0] for p in v]; ys = [p[1] for p in v]; zs = [-p[2] for p in v]
        e['caja'] = [min(xs), min(ys), min(zs), max(xs), max(ys), max(zs)]
    mallas[k] = e
    return k

def textura(r, maximo=512):
    k = idr(r)
    if k in texs: return k
    o = objeto(r)
    if o is None: texs[k] = {'falta': True}; return k
    if o.type.name != 'Texture2D': texs[k] = {'tipo': o.type.name}; return k
    t = o.read()
    try: im = t.image
    except Exception as ex: texs[k] = {'nombre': t.m_Name, 'error': str(ex)[:80]}; return k
    if im is None or im.width == 0: texs[k] = {'nombre': t.m_Name, 'vacia': True}; return k
    d = tt(o); filtro = d.get('m_TextureSettings', {}).get('m_FilterMode', 1); envolver = d.get('m_TextureSettings', {}).get('m_WrapU', 0)
    s = max(im.width, im.height)
    if s > maximo: f = maximo / s; im = im.resize((max(1, int(im.width * f)), max(1, int(im.height * f))), 0 if filtro == 0 else 1)
    alfa = im.mode == 'RGBA' and im.getextrema()[3][0] < 250
    if not alfa: im = im.convert('RGB')
    arch = f'{k}.webp'
    sin_perdida = filtro == 0 and im.width * im.height <= 512 * 512
    im.save(os.path.join(SAL, arch), 'WEBP', quality=86, method=6, lossless=sin_perdida)
    texs[k] = {'nombre': t.m_Name, 'arch': arch, 'w': im.width, 'h': im.height, 'alfa': alfa, 'punto': filtro == 0, 'repite': envolver == 0,
               'ow': t.m_Width, 'oh': t.m_Height}
    return k

def sprite(r):
    k = idr(r)
    if k in sprites: return k
    o = objeto(r)
    if o is None: return None
    d = tt(o); rd = d['m_RD']
    tr = ref(o, rd['texture'])
    tx = textura(tr) if tr else None
    # sin empaquetar, Unity dibuja el rectángulo entero (m_Rect); textureRect es el recorte sin bordes transparentes
    tre = rd.get('textureRect') if (rd.get('settingsRaw', 0) & 1) and rd.get('textureRect') else d['m_Rect']
    sprites[k] = {'nombre': d['m_Name'], 'tex': tx, 'rect': [tre['x'], tre['y'], tre['width'], tre['height']], 'pivote': V2(d['m_Pivot']),
                  'ppu': d['m_PixelsToUnits'], 'borde': [d['m_Border'][c] for c in 'xyzw'], 'tam': [d['m_Rect']['width'], d['m_Rect']['height']]}
    return k

def pares(x):
    if isinstance(x, dict): return list(x.items())
    out = []
    for e in x:
        if isinstance(e, (list, tuple)): out.append((e[0] if not isinstance(e[0], dict) else e[0].get('name', e[0]), e[1]))
        elif isinstance(e, dict) and 'first' in e: out.append((e['first'] if not isinstance(e['first'], dict) else e['first'].get('name'), e['second']))
    return out

def material(r):
    k = idr(r)
    if k in mats: return k
    o = objeto(r)
    if o is None: mats[k] = {'falta': True, 'shader': '?', 'tex': {}, 'c': {}, 'f': {}}; return k
    d = tt(o); sh = ref(o, d['m_Shader']); shn = '?'
    so = objeto(sh) if sh else None
    if so is not None:
        try: shn = so.read().m_ParsedForm.m_Name
        except Exception:
            try: shn = so.read().m_Name
            except Exception: shn = '?'
    sp = d['m_SavedProperties']
    m = {'nombre': d['m_Name'], 'shader': shn, 'tex': {}, 'f': {}, 'c': {}}
    for n, v in pares(sp['m_TexEnvs']):
        tr = ref(o, v['m_Texture'])
        if tr: m['tex'][n] = {'t': textura(tr), 'esc': [v['m_Scale']['x'], v['m_Scale']['y']], 'off': [v['m_Offset']['x'], v['m_Offset']['y']]}
    for n, v in pares(sp['m_Floats']): m['f'][n] = round(v, 5)
    for n, v in pares(sp['m_Colors']): m['c'][n] = C(v)
    mats[k] = m
    return k

# Clips no legacy: las curvas están en m_MuscleClip (streamed, dense y constant, en ese orden de índice) y las
# ataduras en m_ClipBindingConstant. Transform usa 3 o 4 curvas por atadura; lo demás, una. Las curvas PPtr
# (sprites) guardan un índice a pptrCurveMapping. Clave streamed: [t, c0, c1, c2, c3], valor ((c0·dt+c1)·dt+c2)·dt+c3.
def curvas_musculo(o, d, tos):
    mc = d.get('m_MuscleClip'); bc = d.get('m_ClipBindingConstant')
    if not mc or not bc or not bc['genericBindings']: return []
    c = mc['m_Clip']['data']
    claves = {}
    w = c['m_StreamedClip']['data']; ns = c['m_StreamedClip']['curveCount']
    b = struct.pack(f'<{len(w)}I', *w); i = 0
    while i + 8 <= len(b):
        t, n = struct.unpack_from('<fI', b, i); i += 8
        for _ in range(n):
            ci, c0, c1, c2, c3 = struct.unpack_from('<I4f', b, i); i += 20
            claves.setdefault(ci, []).append([max(t, -1e9) if t == t else 0, c0, c1, c2, c3])
    dn = c['m_DenseClip']; nd = dn['m_CurveCount']
    for f in range(dn['m_FrameCount']):
        t = dn['m_BeginTime'] + f / dn['m_SampleRate']
        for j in range(nd):
            v = dn['m_SampleArray'][f * nd + j]
            claves.setdefault(ns + j, []).append([t, 0, 0, 0, v])
    for j, v in enumerate(c['m_ConstantClip']['data']):
        claves.setdefault(ns + nd + j, []).append([-1e9, 0, 0, 0, v])
    salida = []; ci = 0
    for bd in bc['genericBindings']:
        nc = (4 if bd['attribute'] == 2 else 3) if bd['typeID'] == 4 else 1
        ruta = tos.get(bd['path'], '') if tos else ''
        if bd['path'] and not ruta: ruta = str(bd['path'])
        ks = [claves.get(ci + j, []) for j in range(nc)]
        if bd['isPPtrCurve']:
            mapa = bc['pptrCurveMapping']; k2 = []
            for k in ks[0]:
                if k[0] > 1e8: continue
                rr = ref(o, mapa[int(k[4])]) if 0 <= int(k[4]) < len(mapa) else None
                ob = objeto(rr) if rr else None
                k2.append([round(max(k[0], 0), 4), sprite(rr) if ob is not None and ob.type.name == 'Sprite' else None])
            salida.append({'ruta': ruta, 'tipo': 'pptr', 'clase': bd['typeID'], 'attr': bd['attribute'], 'k': k2})
        else:
            salida.append({'ruta': ruta, 'tipo': 'musculo', 'clase': bd['typeID'], 'attr': bd['attribute'], 'n': nc,
                           'k': [[[round(max(x[0], -1), 4)] + [round(y, 5) for y in x[1:]] for x in kk if x[0] < 1e8] for kk in ks]})
        ci += nc
    return salida

def clip(r, tos=None):
    o = objeto(r)
    if o is None: return None
    k = idr(r)
    if k in clips: return k
    d = tt(o)
    curvas = []
    lim = lambda x: max(-1e30, min(1e30, round(x, 5)))
    for tipo, lista in (('pos', d['m_PositionCurves']), ('rot', d['m_RotationCurves']), ('esc', d['m_ScaleCurves'])):
        for c in lista:
            f = (lambda q: [q['x'], q['y'], -q['z']]) if tipo == 'pos' else (lambda q: [-q['x'], -q['y'], q['z'], q['w']]) if tipo == 'rot' else (lambda q: [q['x'], q['y'], q['z']])
            ks = [[round(kf['time'], 4)] + [lim(x) for x in f(kf['value']) + f(kf['inSlope']) + f(kf['outSlope'])] for kf in c['curve']['m_Curve']]
            curvas.append({'ruta': c['path'], 'tipo': tipo, 'k': ks})
    for c in d['m_FloatCurves']:
        ks = [[round(kf['time'], 4), lim(kf['value']), lim(kf['inSlope']), lim(kf['outSlope'])] for kf in c['curve']['m_Curve']]
        curvas.append({'ruta': c['path'], 'tipo': 'float', 'attr': c['attribute'], 'clase': c.get('classID'), 'k': ks})
    for c in d.get('m_PPtrCurves', []):
        ks = []
        for kf in c['curve']:
            rr = ref(o, kf['value'])
            ks.append([round(kf['time'], 4), sprite(rr) if rr and objeto(rr) is not None and objeto(rr).type.name == 'Sprite' else None])
        curvas.append({'ruta': c['path'], 'tipo': 'pptr', 'attr': c['attribute'], 'clase': c.get('classID'), 'k': ks})
    s = d.get('m_AnimationClipSettings') or d.get('m_MuscleClip', {}).get('m_AnimationClipSettings') if False else None
    ajustes = d.get('m_MuscleClip', {})
    bucle = bool(ajustes.get('m_LoopTime')) if isinstance(ajustes, dict) and 'm_LoopTime' in ajustes else None
    curvas += curvas_musculo(o, d, tos)
    eventos = [{'t': e['time'], 'f': e['functionName'], 's': e.get('data', ''), 'i': e.get('intParameter', 0), 'fl': e.get('floatParameter', 0)} for e in d.get('m_Events', [])]
    largo = round(ajustes['m_StopTime'], 4) if isinstance(ajustes, dict) and 'm_StopTime' in ajustes else max((c['k'][-1][0] for c in curvas if c['k'] and c['tipo'] != 'musculo'), default=0)
    clips[k] = {'nombre': d['m_Name'], 'wrap': d.get('m_WrapMode', 0), 'curvas': curvas, 'eventos': eventos, 'largo': largo, 'bucle': bucle, 'fps': d.get('m_SampleRate', 60)}
    return k

def controlador(r):
    k = idr(r)
    if k in ctrls: return k
    o = objeto(r)
    if o is None: return None
    d = tt(o)
    ctrls[k] = None
    tos = {e[0] if not isinstance(e[0], dict) else e[0]: e[1] for e in pares(d.get('m_TOS', []))}
    nombres_clip = [clip(ref(o, c), tos) for c in d['m_AnimationClips']]
    ctrl = d['m_Controller']
    params = []
    vals = ctrl.get('m_Values', {}).get('data', {}).get('m_ValueArray', [])
    for p in vals: params.append({'n': tos.get(p['m_ID'], str(p['m_ID'])), 'tipo': p['m_Type'], 'i': p['m_Index']})
    defs = ctrl.get('m_DefaultValues', {}).get('data', {})
    capas = []
    for li, sm in enumerate(ctrl['m_StateMachineArray']):
        smd = sm['data']; estados = []
        for st in smd['m_StateConstantArray']:
            sd = st['data']
            arbol = sd['m_BlendTreeConstantArray'][0]['data'] if sd['m_BlendTreeConstantArray'] else None
            clip_i = None
            if arbol and arbol['m_NodeArray']:
                clip_i = arbol['m_NodeArray'][0]['data'].get('m_ClipID')
            trans = []
            for tr in sd['m_TransitionConstantArray']:
                td = tr['data']
                trans.append({'dest': td['m_DestinationState'], 'conds': [{'modo': c['data']['m_ConditionMode'], 'p': tos.get(c['data']['m_EventID'], c['data']['m_EventID']), 'v': c['data']['m_EventThreshold']} for c in td['m_ConditionConstantArray']],
                              'salida': td.get('m_HasExitTime'), 'tsalida': td.get('m_ExitTime'), 'dur': td.get('m_TransitionDuration')})
            estados.append({'n': tos.get(sd['m_NameID'], str(sd['m_NameID'])), 'clip': nombres_clip[clip_i] if clip_i is not None and clip_i < len(nombres_clip) else None,
                            'vel': sd['m_Speed'], 'bucle': sd.get('m_Loop'), 'trans': trans})
        anys = []
        for tr in smd.get('m_AnyStateTransitionConstantArray', []):
            td = tr['data']
            anys.append({'dest': td['m_DestinationState'], 'conds': [{'modo': c['data']['m_ConditionMode'], 'p': tos.get(c['data']['m_EventID'], c['data']['m_EventID']), 'v': c['data']['m_EventThreshold']} for c in td['m_ConditionConstantArray']]})
        capas.append({'estados': estados, 'ini': smd['m_DefaultState'], 'cualquiera': anys})
    ctrls[k] = {'nombre': d['m_Name'], 'params': params, 'capas': capas}
    return k

def audio(r):
    k = idr(r)
    if k in audios: return k
    o = objeto(r)
    if o is None: return None
    a = o.read()
    try: muestras = a.samples
    except Exception as ex: audios[k] = {'nombre': a.m_Name, 'error': str(ex)[:60]}; return k
    for nombre, datos in muestras.items():
        crudo = os.path.join(CRUDO, f'{k}_' + nombre.replace(' ', '_').replace('/', '_'))
        open(crudo, 'wb').write(datos)
        res = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', crudo, '-ac', '1', '-c:a', 'libopus', '-b:a', '36k', os.path.join(SAL, k + '.ogg')])
        dur = 0
        try: dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', crudo], capture_output=True, text=True).stdout.strip() or 0)
        except Exception: pass
        audios[k] = {'nombre': a.m_Name, 'ok': res.returncode == 0, 'dur': round(dur, 3)}
        break
    return k

def fuente(r):
    k = idr(r)
    if k in fuentes: return k
    o = objeto(r)
    if o is None: return None
    d = tt(o); datos = bytes(d.get('m_FontData') or b'')
    nombres = d.get('m_FontNames') or []
    if datos:
        open(os.path.join(SAL, k + '.ttf'), 'wb').write(datos)
        fuentes[k] = {'nombre': d['m_Name'], 'arch': k + '.ttf', 'familias': nombres}
    else: fuentes[k] = {'nombre': d['m_Name'], 'familias': nombres}
    return k

# --- nodos de una jerarquía (escena o prefab)
UI_TAM = ('m_AnchorMin', 'm_AnchorMax', 'm_AnchoredPosition', 'm_SizeDelta', 'm_Pivot')
def exportar_jerarquia(archivo, raices):
    f = FILES[archivo]
    go_comp = {}
    nodos = []; idx_tf = {}; idx_go = {}
    def visitar(o, padre):
        d = tt(o)
        g = d['m_GameObject']['m_PathID']
        go = f.objects[g]; gd = tt(go)
        n = {'n': gd['m_Name'], 'p': padre, 't': P(d['m_LocalPosition']), 'r': Q(d['m_LocalRotation']), 's': [round(d['m_LocalScale'][k], 5) for k in 'xyz']}
        if o.type.name == 'RectTransform':
            n['ui'] = {'amin': V2(d['m_AnchorMin']), 'amax': V2(d['m_AnchorMax']), 'pos': V2(d['m_AnchoredPosition']), 'tam': V2(d['m_SizeDelta']), 'piv': V2(d['m_Pivot'])}
        if not gd['m_IsActive']: n['inactivo'] = 1
        tg = tag(gd.get('m_Tag', 0))
        if tg: n['tag'] = tg
        if gd.get('m_Layer'): n['capa'] = gd['m_Layer']
        i = len(nodos); nodos.append(n); idx_tf[o.path_id] = i; idx_go[g] = i
        comps = [c['component']['m_PathID'] for c in gd['m_Component']]
        go_comp[i] = comps
        for h in d['m_Children']:
            visitar(f.objects[h['m_PathID']], i)
    for o in raices: visitar(o, -1)
    comp_nodo = {}
    for i, cs in go_comp.items():
        for c in cs: comp_nodo[c] = i
    def local(co, v):
        """PPtr de un script: a otro nodo/componente de la jerarquía, o a un recurso (sprite, audio, prefab…)"""
        if isinstance(v, dict) and set(v.keys()) == {'m_FileID', 'm_PathID'}:
            fid, pid = v['m_FileID'], v['m_PathID']
            if pid == 0: return None
            if fid == 0:
                if pid in idx_go: return {'nodo': idx_go[pid]}
                if pid in comp_nodo: return {'nodo': comp_nodo[pid], 'comp': f.objects[pid].type.name, 'pid': pid}
            return recurso(co, v)
        if isinstance(v, list): return [local(co, x) for x in v]
        if isinstance(v, dict): return {kk: local(co, x) for kk, x in v.items()}
        if isinstance(v, (bytes, bytearray)): return None
        return v
    for i, cs in go_comp.items():
        n = nodos[i]
        for cp in cs:
            co = f.objects.get(cp)
            if co is None: continue
            ty = co.type.name
            if ty in ('Transform', 'RectTransform', 'CanvasRenderer'): continue
            try: cd = tt(co)
            except Exception as ex: n.setdefault('err', []).append(ty + ':' + str(ex)[:40]); continue
            en = cd.get('m_Enabled', 1)
            if ty == 'MeshFilter':
                r = ref(co, cd['m_Mesh'])
                if r: n['malla'] = malla(r)
            elif ty == 'MeshRenderer':
                n['mats'] = [material(r) if r else None for r in (ref(co, m) for m in cd['m_Materials'])]
                if not en: n['rend_off'] = 1
                if cd.get('m_StaticBatchInfo', {}).get('subMeshCount'): n['lote'] = [cd['m_StaticBatchInfo']['firstSubMesh'], cd['m_StaticBatchInfo']['subMeshCount']]
            elif ty == 'SpriteRenderer':
                r = ref(co, cd['m_Sprite'])
                n['sprite'] = {'pid': cp, 's': sprite(r) if r else None, 'color': C(cd['m_Color']), 'fx': cd.get('m_FlipX', False), 'fy': cd.get('m_FlipY', False), 'on': en,
                               'mats': [material(r) if r else None for r in (ref(co, m) for m in cd['m_Materials'])], 'orden': cd.get('m_SortingOrder', 0)}
            elif ty == 'Light':
                n['luz'] = {'pid': cp, 'tipo': cd['m_Type'], 'color': C(cd['m_Color']), 'int': round(cd['m_Intensity'], 4), 'rango': round(cd['m_Range'], 4), 'angulo': round(cd['m_SpotAngle'], 2), 'on': en}
            elif ty == 'Camera':
                n['cam'] = {'on': en, 'fov': cd['field of view'], 'cerca': cd['near clip plane'], 'lejos': cd['far clip plane'], 'fondo': C(cd['m_BackGroundColor']), 'limpiar': cd['m_ClearFlags'],
                            'prof': cd['m_Depth'], 'orto': cd.get('orthographic', False), 'ortotam': cd.get('orthographic size', 5), 'mascara': cd.get('m_CullingMask', {}).get('m_Bits', -1),
                            'rect': [cd['m_NormalizedViewPortRect'][c] for c in ('x', 'y', 'width', 'height')]}
            elif ty == 'Animator':
                r = ref(co, cd['m_Controller'])
                n['animador'] = {'pid': cp, 'ctrl': controlador(r) if r else None, 'on': en}
            elif ty == 'AudioSource':
                r = ref(co, cd['m_audioClip'])
                mezcla = cd.get('panLevelCustomCurve', {}).get('m_Curve', [])
                espacial = mezcla[0]['value'] if mezcla else 0
                n.setdefault('audios', []).append({'pid': cp, 'clip': audio(r) if r else None, 'vol': round(cd['m_Volume'], 3), 'tono': round(cd.get('m_Pitch', 1), 3), 'loop': bool(cd.get('Loop', False)),
                                                    'mute': bool(cd['Mute']), 'auto': bool(cd['m_PlayOnAwake']), 'min': round(cd['MinDistance'], 3), 'max': round(cd['MaxDistance'], 3),
                                                    'caida': cd['rolloffMode'], 'esp': round(espacial, 3), 'on': en, 'prio': cd.get('Priority', 128)})
            elif ty in ('BoxCollider', 'SphereCollider', 'CapsuleCollider', 'MeshCollider'):
                c = {'tipo': ty.replace('Collider', '').lower(), 'trig': bool(cd.get('m_IsTrigger', False)), 'on': en, 'pid': cp}
                if ty == 'BoxCollider': c.update(c_=P(cd['m_Center']), tam=[cd['m_Size'][k] for k in 'xyz'])
                if ty == 'SphereCollider': c.update(c_=P(cd['m_Center']), radio=cd['m_Radius'])
                if ty == 'CapsuleCollider': c.update(c_=P(cd['m_Center']), radio=cd['m_Radius'], alto=cd['m_Height'], dir=cd['m_Direction'])
                if ty == 'MeshCollider':
                    r = ref(co, cd['m_Mesh']); c.update(malla=malla(r, True) if r else None, convexo=bool(cd.get('m_Convex', False)))
                n.setdefault('col', []).append(c)
            elif ty == 'Rigidbody':
                n['rb'] = {'cinem': bool(cd['m_IsKinematic']), 'grav': bool(cd['m_UseGravity']), 'masa': cd['m_Mass'], 'restr': cd.get('m_Constraints', 0)}
            elif ty == 'CharacterController':
                n['cc'] = {'alto': cd['m_Height'], 'radio': cd['m_Radius'], 'centro': P(cd['m_Center']), 'paso': cd['m_StepOffset'], 'pendiente': cd['m_SlopeLimit'], 'piel': cd.get('m_SkinWidth', 0.08)}
            elif ty == 'NavMeshAgent':
                n['agente'] = {'pid': cp, 'vel': cd['m_Speed'], 'acel': cd['m_Acceleration'], 'giro': cd['m_AngularSpeed'], 'radio': cd['m_Radius'], 'alto': cd['m_Height'], 'parar': cd['m_StoppingDistance'],
                               'base': cd['m_BaseOffset'], 'frenar': bool(cd.get('m_AutoBraking', True)), 'on': en}
            elif ty == 'NavMeshObstacle':
                n['obstaculo'] = {'forma': cd['m_Shape'], 'tam': P(cd['m_Extents']), 'c_': P(cd['m_Center']), 'tallar': bool(cd.get('m_Carve', False)), 'on': en}
            elif ty == 'Canvas':
                n['lienzo'] = {'modo': cd['m_RenderMode'], 'orden': cd.get('m_SortingOrder', 0), 'pixel': bool(cd.get('m_PixelPerfect', False)), 'on': en,
                               'cam': None}
            elif ty == 'CanvasGroup':
                n['grupo'] = {'alfa': cd['m_Alpha'], 'interact': bool(cd['m_Interactable']), 'bloquea': bool(cd['m_BlocksRaycasts'])}
            elif ty == 'MonoBehaviour':
                try:
                    s = co.parse_monobehaviour_head().m_Script.deref_parse_as_object()
                    nombre = (s.m_Namespace + '.' if s.m_Namespace else '') + s.m_ClassName
                except Exception: nombre = '?'
                g2 = {'n': nombre, 'on': en, 'pid': cp}
                for kk, vv in cd.items():
                    if kk in ('m_GameObject', 'm_Script', 'm_Enabled', 'm_ObjectHideFlags', 'm_CorrespondingSourceObject', 'm_PrefabInternal', 'm_PrefabInstance', 'm_PrefabAsset'): continue
                    if kk == 'm_Name' and not vv: continue
                    g2[kk] = local(co, vv)
                n.setdefault('guiones', []).append(g2)
            else:
                n.setdefault('otros', []).append(ty)
    return nodos, idx_go

# --- recursos referidos por los scripts (y prefabs)
prefabs = {}
def recurso(co, v):
    r = ref(co, v)
    if r is None: return {'malo': [v['m_FileID'], v['m_PathID']]}
    o = objeto(r)
    if o is None: return {'falta': idr(r)}
    t = o.type.name
    if t == 'AudioClip': return {'audio': audio(r)}
    if t == 'Texture2D': return {'tex': textura(r)}
    if t == 'Sprite': return {'sprite': sprite(r)}
    if t == 'Material': return {'mat': material(r)}
    if t == 'Font': return {'fuente': fuente(r)}
    if t == 'AnimationClip': return {'clip': clip(r)}
    if t == 'MonoBehaviour':
        k = fuente_tmp(r)
        if k: return {'tmpf': k}
    if t in ('GameObject', 'Transform', 'RectTransform') or (t == 'MonoBehaviour' and r[0] not in ARCH_ESC):
        pk = prefab(r)
        if pk: return {'prefab': pk, 'comp': t if t != 'GameObject' else None}
        return {'otro': t, 'id': idr(r)}
    if t == 'MonoBehaviour':
        k = fuente_tmp(r)
        if k: return {'tmpf': k}
        return {'otro': t, 'id': idr(r)}
    return {'otro': t, 'id': idr(r)}

# Fuentes de TextMeshPro (MonoBehaviour con m_glyphInfoList): medidas, glifos [id, x, y, ancho, alto, xo, yo, avance]
# (y desde arriba del atlas) y el atlas entero si es de mapa de bits (las SDF se dibujan con una fuente parecida).
tmpf = {}
def fuente_tmp(r):
    k = idr(r)
    if k in tmpf: return k
    try: d = tt(objeto(r))
    except Exception: return None
    if 'm_glyphInfoList' not in d: return None
    fi = d['m_fontInfo']
    sdf = 'SDF' in d.get('m_Name', '') or (d.get('fontAssetType') == 1)
    atlas = None if sdf else textura(ref(objeto(r), d['atlas']), maximo=4096)
    tmpf[k] = {'nombre': d['m_Name'], 'familia': fi['Name'], 'sdf': sdf, 'atlas': atlas, 'pt': fi['PointSize'], 'escala': fi['Scale'],
               'linea': fi['LineHeight'], 'asc': fi['Ascender'], 'desc': fi['Descender'], 'base': fi['Baseline'], 'aw': fi['AtlasWidth'], 'ah': fi['AtlasHeight'],
               'subrayado': fi['Underline'], 'subgrosor': fi['UnderlineThickness'],
               'glifos': [[g['id'], g['x'], g['y'], g['width'], g['height'], g['xOffset'], g['yOffset'], g['xAdvance']] for g in d['m_glyphInfoList']]}
    return k

def prefab(r):
    o = objeto(r)
    if o is None: return None
    if o.type.name != 'GameObject':
        go = tt(o).get('m_GameObject')
        if not go or not go.get('m_PathID'): return None
        r = (r[0], go['m_PathID']); o = objeto(r)
        if o is None: return None
    k = idr(r)
    if k in prefabs: return k
    prefabs[k] = None
    gd = tt(o)
    tfp = next(c['component']['m_PathID'] for c in gd['m_Component'] if FILES[r[0]].objects[c['component']['m_PathID']].type.name in ('Transform', 'RectTransform'))
    nodos, _ = exportar_jerarquia(r[0], [FILES[r[0]].objects[tfp]])
    prefabs[k] = {'nodos': nodos}
    return k

# --- malla de navegación (Detour de Unity, versión 16): cabecera de 72 bytes (magic, versión, x, y, capa, polígonos,
# vértices, …, caja en +44), vértices (3 floats) y polígonos de 32 bytes (6 índices, 6 vecinos, flags u32, n, área).
def navegacion(r, num):
    o = objeto(r)
    if o is None: return None
    d = tt(o); polis = bytearray(); total = 0
    for t in d['m_NavMeshTiles']:
        b = bytes(t['m_MeshData'])
        if len(b) < 72: continue
        magic, ver, x, y, layer, npol, nvert = struct.unpack_from('<7i', b, 0)
        if magic != 0x444E4156: continue
        vs = [struct.unpack_from('<3f', b, 72 + 12 * j) for j in range(nvert)]
        p = 72 + 12 * nvert
        for _ in range(npol):
            vi = struct.unpack_from('<6H', b, p); nv, area = struct.unpack_from('<BB', b, p + 28)
            p += 32
            if (area >> 6) != 0 or nv < 3: continue  # (solo polígonos comunes, no enlaces)
            pts = [vs[vi[j]] for j in range(min(nv, 6)) if vi[j] < len(vs)]
            polis.extend(struct.pack('<B', len(pts)))
            for v in pts: polis.extend(struct.pack('<3f', v[0], v[1], -v[2]))
            total += 1
    open(os.path.join(SAL, f'nav-{num}.bin'), 'wb').write(bytes(polis))
    print('  navegación', num, total, 'polígonos', flush=True)
    return f'nav-{num}.bin'

def limpio(x):
    if isinstance(x, float): return None if math.isnan(x) else (1e30 if x == math.inf else -1e30 if x == -math.inf else x)
    if isinstance(x, dict): return {k: limpio(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)): return [limpio(v) for v in x]
    return x

indice = []
for num, (archivo, nombre) in enumerate(zip(ARCH_ESC, NOMBRES)):
    f = FILES[archivo]
    raices = [o for o in f.objects.values() if o.type.name in ('Transform', 'RectTransform') and tt(o)['m_Father']['m_PathID'] == 0]
    nodos, _ = exportar_jerarquia(archivo, raices)
    esc = {'nombre': nombre, 'nodos': nodos}
    for o in f.objects.values():
        if o.type.name == 'RenderSettings':
            d = tt(o); esc['render'] = {'niebla': d['m_Fog'], 'niebla_color': C(d['m_FogColor']), 'niebla_modo': d['m_FogMode'], 'niebla_dens': d['m_FogDensity'],
                                        'niebla_ini': d['m_LinearFogStart'], 'niebla_fin': d['m_LinearFogEnd'], 'ambiente': C(d['m_AmbientSkyColor']), 'ambiente_modo': d.get('m_AmbientMode', 0),
                                        'ambiente_int': d.get('m_AmbientIntensity', 1)}
            sb = ref(o, d['m_SkyboxMaterial'])
            if sb: esc['render']['cielo'] = material(sb)
        if o.type.name == 'NavMeshSettings':
            r = ref(o, tt(o)['m_NavMeshData'])
            if r: esc['nav'] = navegacion(r, num)
    json.dump(limpio(esc), open(os.path.join(SAL, f'escena-{num}.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    indice.append({'num': num, 'nombre': nombre, 'archivo': archivo, 'nodos': len(nodos)})
    print('escena', num, nombre, len(nodos), 'nodos', flush=True)

# capas que chocan entre sí (Physics: m_LayerCollisionMatrix, un bit por capa) y gravedad
fm = next((tt(o) for o in main.objects.values() if o.type.name == 'PhysicsManager'), {})
FISICA = {'matriz': fm.get('m_LayerCollisionMatrix', []), 'gravedad': P(fm['m_Gravity']) if 'm_Gravity' in fm else [0, -9.81, 0],
          'gatillos': fm.get('m_QueriesHitTriggers', 1), 'reverso': fm.get('m_QueriesHitBackfaces', 0)}
open(os.path.join(SAL, 'mallas.bin'), 'wb').write(bytes(BIN))
json.dump(limpio({'escenas': indice, 'mallas': mallas, 'mats': mats, 'texs': texs, 'sprites': sprites, 'clips': clips, 'ctrls': ctrls, 'audios': audios, 'fuentes': fuentes,
                  'prefabs': prefabs, 'capas': CAPAS, 'tmp': tmpf, 'fisica': FISICA}),
          open(os.path.join(SAL, 'comun.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('mallas', len(mallas), 'bin', round(len(BIN) / 1048576, 1), 'MB · mats', len(mats), '· texs', len(texs), '· sprites', len(sprites), '· clips', len(clips),
      '· ctrls', len(ctrls), '· audios', len(audios), '· fuentes', len(fuentes), '· prefabs', len(prefabs))
print('shaders', sorted({m['shader'] for m in mats.values()}))

# Exporta las escenas de un juego de Unity 3.5 (Pizza Delivery v0.2) a datos para three.js:
# una escena-N.json por nivel y un fondo común de mallas (mallas.bin), texturas (webp), materiales,
# animaciones, audios (Opus) y prefabs referidos por los scripts. Unity es de mano izquierda: z cambia de signo.
#     python -I exportar.py <..._Data> <salida/datos>
import UnityPy, sys, os, json, struct, subprocess
from UnityPy.helpers.MeshHelper import MeshHandler
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from campos import Esquemas

DATA, SAL = sys.argv[1], sys.argv[2]
os.makedirs(SAL, exist_ok=True)
CRUDO = os.path.join(SAL, '..', '..', 'crudo'); os.makedirs(CRUDO, exist_ok=True)
env = UnityPy.load(DATA)
FILES = {os.path.basename(k): f for k, f in env.files.items() if hasattr(f, 'objects')}
ABR = {}
for n in FILES:
    ABR[n] = ('m' if n == 'mainData' else 'r' if n.startswith('unity default') else n.replace('sharedassets', 's').replace('.assets', '').replace('level', 'l'))
M = os.path.join(DATA, 'Managed')
ESQ = Esquemas([os.path.join(M, d) for d in ('Assembly-UnityScript.dll', 'Assembly-UnityScript-firstpass.dll', 'Assembly-CSharp-firstpass.dll', 'Assembly-CSharp.dll')])
tt = lambda o: o.read_typetree()

def P(v): return [round(v['x'], 5), round(v['y'], 5), round(-v['z'], 5)]
def Q(q): return [round(-q['x'], 6), round(-q['y'], 6), round(q['z'], 6), round(q['w'], 6)]
def C(c): return [round(c['r'], 4), round(c['g'], 4), round(c['b'], 4), round(c.get('a', 1), 4)]
def rgba32(u): return [(u & 255) / 255, (u >> 8 & 255) / 255, (u >> 16 & 255) / 255, (u >> 24 & 255) / 255]

# --- escenas en el orden del build, tags y scripts
main = FILES['mainData']
build = next(tt(o) for o in main.objects.values() if o.type.name == 'BuildSettings')
NOMBRES = [os.path.splitext(os.path.basename(s))[0] for s in build['levels']]
ARCH_ESC = ['mainData'] + [f'level{i}' for i in range(len(NOMBRES) - 1)]
tm = next(tt(o) for o in main.objects.values() if o.type.name == 'TagManager')
TAGS_BASE = {0: '', 1: 'Respawn', 2: 'Finish', 3: 'EditorOnly', 5: 'MainCamera', 6: 'Player', 7: 'GameController'}
def tag(i): return TAGS_BASE.get(i, '') if i < 20000 else (tm['tags'][i - 20000] if i - 20000 < len(tm['tags']) else f'tag{i}')
SCRIPTS = {}
for n, f in FILES.items():
    for o in f.objects.values():
        if o.type.name == 'MonoScript':
            d = o.read(); SCRIPTS[(n, o.path_id)] = d.m_ClassName

def ref(obj, pptr):
    fid, pid = (pptr['m_FileID'], pptr['m_PathID']) if isinstance(pptr, dict) else pptr
    if pid == 0: return None
    af = obj.assets_file
    if fid == 0: return (os.path.basename(af.name), pid)
    if fid < 0 or fid - 1 >= len(af.externals): return None
    ext = af.externals[fid - 1]
    return (os.path.basename(ext.path), pid)
def objeto(r): return FILES[r[0]].objects.get(r[1]) if r and r[0] in FILES else None
def idr(r): return f'{ABR.get(r[0], r[0])}_{r[1]}'

mallas, mats, texs, clips, audios = {}, {}, {}, {}, {}
BIN = bytearray()
def alinear():
    while len(BIN) % 4: BIN.append(0)

def malla(r, solo_col=False):
    k = idr(r) + ('c' if solo_col else '')
    if k in mallas: return k
    o = objeto(r)
    if o is None: mallas[k] = {'falta': True}; return k
    m = o.read(); h = MeshHandler(m); h.process()
    v, n, uv, col = h.m_Vertices or [], h.m_Normals or [], h.m_UV0 or [], h.m_Colors or []
    tris = h.get_triangles()
    e = {'nombre': m.m_Name, 'nv': len(v), 'subs': []}
    alinear(); e['pos'] = len(BIN)
    for p in v: BIN.extend(struct.pack('<3f', p[0], p[1], -p[2]))
    q8 = lambda x: max(-127, min(127, int(round(x * 127))))
    if len(n) == len(v) and v and not solo_col:  # normales en 4 bytes
        e['nor8'] = len(BIN)
        for p in n:
            l = (p[0] ** 2 + p[1] ** 2 + p[2] ** 2) ** 0.5 or 1
            BIN.extend(struct.pack('<4b', q8(p[0] / l), q8(p[1] / l), q8(-p[2] / l), 0))
    if len(uv) == len(v) and v and not solo_col:  # coordenadas de textura en medio flotante
        e['uv16'] = len(BIN)
        for p in uv: BIN.extend(struct.pack('<2e', max(-65000, min(65000, p[0])), max(-65000, min(65000, p[1]))))
    if solo_col: col = []
    if len(col) == len(v) and v and any(c != (1, 1, 1, 1) and c != (255, 255, 255, 255) for c in col[:50]):
        e['col'] = len(BIN)
        mx = 255 if max(max(c) for c in col[:50]) > 1.01 else 1
        for c in col: BIN.extend(struct.pack('<4B', *[max(0, min(255, int(x * 255 / mx))) for x in c]))
    pesos, idx = h.m_BoneWeights, h.m_BoneIndices
    if pesos and idx and len(pesos) == len(v) and not solo_col:
        e['pesos8'] = len(BIN)
        for w in pesos:
            w = (list(w) + [0, 0, 0, 0])[:4]; t = sum(w) or 1
            q = [int(round(x / t * 255)) for x in w]; q[0] += 255 - sum(q)
            BIN.extend(struct.pack('<4B', *[max(0, min(255, x)) for x in q]))
        mx = max(max(i) for i in idx)
        clave = 'huesos8' if mx < 256 else 'huesos'
        e[clave] = len(BIN)
        for i in idx: BIN.extend(struct.pack('<4B' if mx < 256 else '<4H', *(list(i) + [0, 0, 0, 0])[:4]))
        bp = []
        for mtx in m.m_BindPose:
            a = [[getattr(mtx, f'e{r}{c}') for c in range(4)] for r in range(4)]
            for r in range(4):
                for c in range(4):
                    if (r == 2) != (c == 2): a[r][c] = -a[r][c]
            bp.append([round(a[r][c], 6) for c in range(4) for r in range(4)])  # columna mayor (three)
        if not solo_col: e['bind'] = bp
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

MAXTEX = {'default': 512}
def textura(r, maximo=None):
    k = idr(r)
    if k in texs: return k
    o = objeto(r)
    if o is None: texs[k] = {'falta': True}; return k
    if o.type.name != 'Texture2D': texs[k] = {'tipo': o.type.name, 'nombre': getattr(o.read(), 'm_Name', '')}; return k
    t = o.read()
    try: im = t.image
    except Exception as ex: texs[k] = {'nombre': t.m_Name, 'error': str(ex)[:80]}; return k
    if im is None or im.width == 0: texs[k] = {'nombre': t.m_Name, 'vacia': True}; return k
    mx = maximo or (1024 if any(x in t.m_Name for x in ('DIFF', 'Texture_2k', 'diffuse', 'Hero', 'pizza', 'SplatAlpha')) else 512)
    s = max(im.width, im.height)
    if s > mx: f = mx / s; im = im.resize((max(1, int(im.width * f)), max(1, int(im.height * f))))
    alfa = im.mode == 'RGBA' and im.getextrema()[3][0] < 250
    if not alfa: im = im.convert('RGB')
    arch = f'{k}.webp'
    im.save(os.path.join(SAL, arch), 'WEBP', quality=80, method=6, lossless='SplatAlpha' in t.m_Name)
    texs[k] = {'nombre': t.m_Name, 'arch': arch, 'w': im.width, 'h': im.height, 'alfa': alfa}
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
        try: shn = so.read().m_Name
        except Exception: shn = '?'
    elif sh: shn = f'{sh[0]}:{sh[1]}'
    sp = d['m_SavedProperties']
    m = {'nombre': d['m_Name'], 'shader': shn, 'tex': {}, 'f': {}, 'c': {}}
    for n, v in pares(sp['m_TexEnvs']):
        tr = ref(o, v['m_Texture'])
        if tr: m['tex'][n] = {'t': textura(tr), 'esc': [v['m_Scale']['x'], v['m_Scale']['y']], 'off': [v['m_Offset']['x'], v['m_Offset']['y']]}
    for n, v in pares(sp['m_Floats']): m['f'][n] = round(v, 5)
    for n, v in pares(sp['m_Colors']): m['c'][n] = C(v)
    mats[k] = m
    return k

def clip(r):
    o = objeto(r)
    if o is None: return None
    d = tt(o); nombre = d['m_Name']
    if nombre in clips: return nombre
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
    eventos = [{'t': e['time'], 'f': e['functionName'], 's': e.get('data', '')} for e in d.get('m_Events', [])]
    clips[nombre] = {'wrap': d.get('m_WrapMode', 0), 'curvas': curvas, 'eventos': eventos,
                     'largo': max((c['k'][-1][0] for c in curvas if c['k']), default=0)}
    return nombre

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
        res = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', crudo, '-ac', '1', '-c:a', 'libopus', '-b:a', '40k', os.path.join(SAL, k + '.ogg')])
        dur = 0
        try: dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', crudo], capture_output=True, text=True).stdout.strip() or 0)
        except Exception: pass
        audios[k] = {'nombre': a.m_Name, 'ok': res.returncode == 0, 'dur': round(dur, 2)}
        break
    return k

def video(r):
    k = idr(r)
    if k in texs: return k
    o = objeto(r)
    t = o.read()
    raw = bytes(getattr(t, 'm_MovieData', b'') or b'')
    if raw:
        crudo = os.path.join(CRUDO, k + '.ogv'); open(crudo, 'wb').write(raw)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', crudo, '-an', '-vf', 'scale=320:-2', '-c:v', 'libvpx', '-b:v', '300k', os.path.join(SAL, k + '.webm')])
    texs[k] = {'nombre': t.m_Name, 'video': k + '.webm'}
    return k

# --- nodos de una jerarquía (escena o prefab)
def exportar_jerarquia(archivo, raices):
    f = FILES[archivo]
    go_comp = {}
    nodos = []; idx_tf = {}; idx_go = {}
    def visitar(o, padre):
        d = tt(o)
        g = d['m_GameObject']['m_PathID']
        go = f.objects[g]; gd = tt(go)
        n = {'n': gd['m_Name'], 'p': padre, 't': P(d['m_LocalPosition']), 'r': Q(d['m_LocalRotation']), 's': [round(d['m_LocalScale'][k], 5) for k in 'xyz']}
        if not gd['m_IsActive']: n['inactivo'] = 1
        tg = tag(gd.get('m_Tag', 0))
        if tg: n['tag'] = tg
        if gd.get('m_Layer'): n['capa'] = gd['m_Layer']
        i = len(nodos); nodos.append(n); idx_tf[o.path_id] = i; idx_go[g] = i
        comps = [c[1]['m_PathID'] if isinstance(c, (list, tuple)) else (c.get('component') or c.get('second'))['m_PathID'] for c in gd['m_Component']]
        go_comp[i] = comps
        for h in d['m_Children']:
            visitar(f.objects[h['m_PathID']], i)
    for o in raices: visitar(o, -1)
    comp_nodo = {}
    for i, cs in go_comp.items():
        for c in cs: comp_nodo[c] = i
    def ppt_local(fid, pid):
        if pid == 0: return None
        if fid == 0:
            if pid in idx_go: return {'nodo': idx_go[pid]}
            if pid in comp_nodo: return {'nodo': comp_nodo[pid], 'comp': f.objects[pid].type.name, 'pid': pid}
            return {'local': pid}
        return {'ext': [fid, pid]}
    pendientes = []
    for i, cs in go_comp.items():
        n = nodos[i]
        for cp in cs:
            co = f.objects.get(cp)
            if co is None: continue
            ty = co.type.name
            if ty == 'Transform': continue
            try: cd = tt(co) if ty != 'MonoBehaviour' else None
            except Exception: n.setdefault('err', []).append(ty); continue
            if ty == 'MeshFilter':
                r = ref(co, cd['m_Mesh'])
                if r: n['malla'] = malla(r)
            elif ty in ('MeshRenderer', 'SkinnedMeshRenderer'):
                n['mats'] = [material(r) if r else None for r in (ref(co, m) for m in cd['m_Materials'])]
                if not cd['m_Enabled']: n['rend_off'] = 1
                if cd.get('m_SubsetIndices'): n['subset'] = list(cd['m_SubsetIndices'])
                if ty == 'SkinnedMeshRenderer':
                    r = ref(co, cd['m_Mesh'])
                    if r: n['malla'] = malla(r)
                    n['piel'] = {'huesos': [idx_tf.get(b['m_PathID'], -1) for b in cd['m_Bones']], 'raiz': idx_tf.get(cd.get('m_RootBone', {}).get('m_PathID', 0), -1)}
            elif ty == 'Light':
                n['luz'] = {'pid': cp, 'tipo': cd['m_Type'], 'color': C(cd['m_Color']), 'int': round(cd['m_Intensity'], 4), 'rango': round(cd['m_Range'], 4),
                            'angulo': round(cd['m_SpotAngle'], 2), 'on': cd['m_Enabled'], 'sombra': cd['m_Shadows']['m_Type'], 'halo': cd.get('m_DrawHalo', False)}
            elif ty == 'Camera':
                n['cam'] = {'on': cd['m_Enabled'], 'fov': cd['field of view'], 'cerca': cd['near clip plane'], 'lejos': cd['far clip plane'], 'fondo': C(cd['m_BackGroundColor']), 'limpiar': cd['m_ClearFlags'], 'prof': cd['m_Depth']}
            elif ty == 'Animation':
                cl = [clip(ref(co, c)) for c in cd['m_Animations'] if ref(co, c)]
                df = clip(ref(co, cd['m_Animation'])) if ref(co, cd['m_Animation']) else None
                n['anim'] = {'clips': [c for c in cl if c], 'auto': cd['m_PlayAutomatically'], 'def': df, 'wrap': cd['m_WrapMode'], 'on': cd['m_Enabled']}
            elif ty == 'AudioSource':
                r = ref(co, cd['m_audioClip'])
                n.setdefault('audios', []).append({'pid': cp, 'clip': audio(r) if r else None, 'vol': round(cd['m_Volume'], 3), 'tono': round(cd.get('m_Pitch', 1), 3), 'loop': cd.get('Loop', False), 'mute': cd['Mute'],
                              'auto': cd['m_PlayOnAwake'], 'min': round(cd['MinDistance'], 3), 'max': round(cd['MaxDistance'], 3), 'caida': cd['rolloffMode'], 'pan2d': round(cd.get('Pan2D', 0), 3), 'on': cd['m_Enabled']})
            elif ty == 'TextMesh':
                n['texto'] = {'t': cd['m_Text'], 'tam': cd['m_CharacterSize'], 'fuente': cd['m_FontSize'], 'ancla': cd['m_Anchor'], 'alin': cd['m_Alignment'],
                              'linea': cd['m_LineSpacing'], 'estilo': cd.get('m_FontStyle', 0), 'offz': cd.get('m_OffsetZ', 0)}
                fr = ref(co, cd['m_Font'])
                if fr and objeto(fr) is not None: n['texto']['letra'] = objeto(fr).read().m_Name
            elif ty == 'GUIText':
                n['guitexto'] = {'t': cd['m_Text'], 'ancla': cd['m_Anchor'], 'fuente': cd['m_FontSize'], 'px': [cd['m_PixelOffset']['x'], cd['m_PixelOffset']['y']]}
            elif ty == 'GUITexture':
                r = ref(co, cd['m_Texture'])
                n['guitex'] = {'tex': textura(r) if r else None, 'color': C(cd['m_Color']), 'rect': [cd['m_PixelInset'][k] for k in ('x', 'y', 'width', 'height')]}
            elif ty in ('BoxCollider', 'SphereCollider', 'CapsuleCollider', 'MeshCollider', 'TerrainCollider'):
                c = {'tipo': ty.replace('Collider', '').lower(), 'trig': cd.get('m_IsTrigger', False), 'on': cd.get('m_Enabled', True)}
                if ty == 'BoxCollider': c.update(c_=P(cd['m_Center']), tam=[cd['m_Size'][k] for k in 'xyz'])
                if ty == 'SphereCollider': c.update(c_=P(cd['m_Center']), radio=cd['m_Radius'])
                if ty == 'CapsuleCollider': c.update(c_=P(cd['m_Center']), radio=cd['m_Radius'], alto=cd['m_Height'], dir=cd['m_Direction'])
                if ty == 'MeshCollider':
                    r = ref(co, cd['m_Mesh']); c.update(malla=malla(r, True) if r else None, convexo=cd.get('m_Convex', False))
                n.setdefault('col', []).append(c)
            elif ty == 'Rigidbody':
                n['rb'] = {'cinem': cd['m_IsKinematic'], 'grav': cd['m_UseGravity'], 'masa': cd['m_Mass']}
            elif ty == 'CharacterController':
                n['cc'] = {'alto': cd['m_Height'], 'radio': cd['m_Radius'], 'centro': P(cd['m_Center']), 'paso': cd['m_StepOffset'], 'pendiente': cd['m_SlopeLimit']}
            elif ty == 'EllipsoidParticleEmitter':
                n['emisor'] = {k: (P(v) if isinstance(v, dict) and 'z' in v and k != 'm_Ellipsoid' else v) for k, v in cd.items() if k != 'm_GameObject'}
            elif ty == 'ParticleAnimator':
                n['animpart'] = {k: (rgba32(v['rgba']) if isinstance(v, dict) and 'rgba' in v else v) for k, v in cd.items() if k != 'm_GameObject'}
            elif ty == 'ParticleRenderer':
                n['rendpart'] = {'mats': [material(r) for r in (ref(co, m) for m in cd['m_Materials']) if r], 'estirar': cd['m_StretchParticles'], 'largo': cd['m_LengthScale'],
                                 'maxtam': cd['m_MaxParticleSize'], 'uv': [cd['UV Animation']['x Tile'], cd['UV Animation']['y Tile'], cd['UV Animation']['cycles']], 'on': cd['m_Enabled']}
            elif ty == 'MonoBehaviour':
                raw = co.get_raw_data()
                sfid, spid = struct.unpack_from('<ii', raw, 12)
                sr = ref(co, (sfid, spid))
                nombre = SCRIPTS.get(sr, None) if sr else None
                off = 20; ln = struct.unpack_from('<i', raw, off)[0]; off += 4 + ln; off = (off + 3) & ~3
                en = raw[8]
                if nombre is None or nombre == 'Terrain':
                    tr = ref(co, struct.unpack_from('<ii', raw, off)) if off + 8 <= len(raw) else None
                    if tr and objeto(tr) is not None and objeto(tr).type.name == 'TerrainData':
                        n['terreno'] = terreno(co, tr); continue
                    n.setdefault('guiones', []).append({'n': f'?{sr}', 'on': en}); continue
                vals, _ = ESQ.leer(nombre, raw, off, ppt_local)
                g = {'n': nombre, 'on': en, **vals}
                n.setdefault('guiones', []).append(g)
                pendientes.append((co, g))
            elif ty in ('WindZone', 'AudioListener', 'GUILayer', 'FlareLayer', 'HaloLayer', 'Halo'):
                n.setdefault('otros', []).append(ty)
            else:
                n.setdefault('otros', []).append(ty)
    return nodos, pendientes, idx_go

# --- prefabs que piden los scripts (y árboles del terreno): jerarquías fuera de la escena
prefabs = {}
def prefab(r):
    k = idr(r)
    if k in prefabs: return k
    o = objeto(r)
    if o is None: return None
    if o.type.name != 'GameObject':
        go = tt(o).get('m_GameObject')
        if not go: return None
        r = (r[0], go['m_PathID']); k = idr(r); o = objeto(r)
        if k in prefabs: return k
    prefabs[k] = None
    gd = tt(o)
    tfp = next(c[1]['m_PathID'] if isinstance(c, (list, tuple)) else (c.get('component') or c.get('second'))['m_PathID'] for c in gd['m_Component']
               if FILES[r[0]].objects[(c[1] if isinstance(c, (list, tuple)) else (c.get('component') or c.get('second')))['m_PathID']].type.name == 'Transform')
    nodos, pend, _ = exportar_jerarquia(r[0], [FILES[r[0]].objects[tfp]])
    prefabs[k] = {'nodos': nodos}
    resolver(pend, r[0])
    return k

def resolver(pendientes, archivo):
    """los PPtr externos de los scripts: recursos (audio, texturas…) o prefabs"""
    for co, g in pendientes:
        for kk, v in list(g.items()):
            g[kk] = traducir(co, v)

def traducir(co, v):
    if isinstance(v, list): return [traducir(co, x) for x in v]
    if isinstance(v, dict) and 'ext' in v:
        r = ref(co, tuple(v['ext']))
        if r is None: return {'malo': v['ext']}
        o = objeto(r)
        if o is None: return {'falta': idr(r)}
        t = o.type.name
        if t == 'AudioClip': return {'audio': audio(r)}
        if t == 'Texture2D': return {'tex': textura(r)}
        if t == 'MovieTexture': return {'video': video(r)}
        if t == 'Material': return {'mat': material(r)}
        if t in ('GameObject', 'Transform'): return {'prefab': prefab(r)}
        return {'otro': t, 'id': idr(r)}
    if isinstance(v, dict) and 'local' in v: return None
    return v

def terreno(co, r):
    o = objeto(r)
    d = tt(o); hm = d['m_Heightmap']; k = idr(r)
    w, h = hm['m_Width'], hm['m_Height']
    open(os.path.join(SAL, f'alturas-{k}.bin'), 'wb').write(struct.pack(f'<{w*h}H', *hm['m_Heights']))
    sd = d['m_SplatDatabase']
    capas = [{'tex': textura(ref(o, s['texture'])) if ref(o, s['texture']) else None, 'tile': [s['tileSize']['x'], s['tileSize']['y']], 'off': [s['tileOffset']['x'], s['tileOffset']['y']]} for s in sd['m_Splats']]
    alfas = [textura(ref(o, a), 512) for a in sd['m_AlphaTextures'] if ref(o, a)]
    dd = d['m_DetailDatabase']
    arbs = bytearray()
    for t in dd['m_TreeInstances']:
        p = t['position']
        arbs.extend(struct.pack('<5f', p['x'], p['y'], p['z'], t['widthScale'], t['heightScale']))
        arbs.extend(struct.pack('<I', t['index']))
    open(os.path.join(SAL, f'arboles-{k}.bin'), 'wb').write(bytes(arbs))
    protos = [prefab(ref(o, p['prefab'])) if ref(o, p['prefab']) else None for p in dd['m_TreePrototypes']]
    pc, ps = dd['m_PatchCount'], dd['m_PatchSamples']
    res = pc * ps; capasP = len(dd['m_DetailPrototypes'])
    den = bytearray(res * res * max(1, capasP))
    for pi, p in enumerate(dd['m_Patches']):
        no = p['numberOfObjects']
        if not no: continue
        px, py = pi % pc, pi // pc
        for li, layer in enumerate(p['layerIndices']):
            for y in range(ps):
                for x in range(ps):
                    vv = no[li * ps * ps + y * ps + x]
                    if vv: den[layer * res * res + (py * ps + y) * res + px * ps + x] = min(255, vv)
    if capasP: open(os.path.join(SAL, f'pasto-{k}.bin'), 'wb').write(bytes(den))
    detalles = []
    for pr in dd['m_DetailPrototypes']:
        tr = ref(o, pr['prototypeTexture']); mr = ref(o, pr['prototype'])
        detalles.append({'tex': textura(tr) if tr else None, 'prefab': prefab(mr) if mr else None, 'ancho': [pr['minWidth'], pr['maxWidth']], 'alto': [pr['minHeight'], pr['maxHeight']],
                         'sano': C(pr['healthyColor']), 'seco': C(pr['dryColor']), 'ruido': pr['noiseSpread'], 'modo': pr.get('renderMode', 0)})
    return {'id': k, 'res': w, 'esc': [hm['m_Scale']['x'], hm['m_Scale']['y'], hm['m_Scale']['z']], 'capas': capas, 'alfas': alfas,
            'arboles': len(dd['m_TreeInstances']), 'protos': protos, 'pasto': {'res': res, 'capas': detalles}}

def limpio(x):
    import math
    if isinstance(x, float): return None if math.isnan(x) else (1e30 if x == math.inf else -1e30 if x == -math.inf else x)
    if isinstance(x, dict): return {k: limpio(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)): return [limpio(v) for v in x]
    return x

# --- cada escena
indice = []
for num, (archivo, nombre) in enumerate(zip(ARCH_ESC, NOMBRES)):
    f = FILES[archivo]
    raices = [o for o in f.objects.values() if o.type.name == 'Transform' and tt(o)['m_Father']['m_PathID'] == 0]
    nodos, pend, _ = exportar_jerarquia(archivo, raices)
    resolver(pend, archivo)
    esc = {'nombre': nombre, 'nodos': nodos}
    for o in f.objects.values():
        if o.type.name == 'RenderSettings':
            d = tt(o); esc['render'] = {'niebla': d['m_Fog'], 'niebla_color': C(d['m_FogColor']), 'niebla_modo': d['m_FogMode'], 'niebla_dens': d['m_FogDensity'],
                                        'niebla_ini': d['m_LinearFogStart'], 'niebla_fin': d['m_LinearFogEnd'], 'ambiente': C(d['m_AmbientLight'])}
            sb = ref(o, d['m_SkyboxMaterial'])
            if sb: esc['render']['cielo'] = material(sb)
    json.dump(limpio(esc), open(os.path.join(SAL, f'escena-{num}.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    indice.append({'num': num, 'nombre': nombre, 'archivo': archivo, 'nodos': len(nodos)})
    print('escena', num, nombre, len(nodos), 'nodos', flush=True)

open(os.path.join(SAL, 'mallas.bin'), 'wb').write(bytes(BIN))
json.dump(limpio({'escenas': indice, 'mallas': mallas, 'mats': mats, 'texs': texs, 'clips': clips, 'audios': audios, 'prefabs': prefabs}),
          open(os.path.join(SAL, 'comun.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('mallas', len(mallas), 'bin', round(len(BIN) / 1048576, 1), 'MB · mats', len(mats), '· texs', len(texs), '· clips', len(clips), '· audios', len(audios), '· prefabs', len(prefabs))
print('shaders', sorted({m['shader'] for m in mats.values()}))

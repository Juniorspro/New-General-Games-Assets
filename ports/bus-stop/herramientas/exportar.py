# Exporta la escena de Bus Stop Simulator (Unity 4.5) a datos para three.js.
# Coordenadas: Unity (mano izquierda) -> three (mano derecha): z cambia de signo.
#     python -I herramientas/exportar.py "juego/Bus Stop Simulator BETA 1.0.1_Data" web/datos
import UnityPy, sys, os, json, struct, io, subprocess
from UnityPy.helpers.MeshHelper import MeshHandler
DATA, SAL = sys.argv[1], sys.argv[2]
os.makedirs(SAL, exist_ok=True)
env = UnityPy.load(DATA)
files = {os.path.basename(f.name if hasattr(f, 'name') else k): f for k, f in env.files.items()}
main = next(f for n, f in files.items() if n == 'mainData')
shared = next(f for n, f in files.items() if n == 'sharedassets0.assets')
def tt(o): return o.read_typetree()

def P(v): return [v['x'], v['y'], -v['z']]
def Q(q): return [-q['x'], -q['y'], q['z'], q['w']]
def C(c): return [round(c['r'], 4), round(c['g'], 4), round(c['b'], 4), round(c.get('a', 1), 4)]
def rgba32(u): return [(u & 255) / 255, (u >> 8 & 255) / 255, (u >> 16 & 255) / 255, (u >> 24 & 255) / 255]

# --- scripts (MonoScript en sharedassets0)
scripts = {o.path_id: o.read().m_ClassName for o in shared.objects.values() if o.type.name == 'MonoScript'}

# --- recursos referenciados: se juntan por (archivo, path_id)
def ref(obj, pptr):
    """devuelve (archivo, objeto) del PPtr o None"""
    fid, pid = pptr['m_FileID'], pptr['m_PathID']
    if pid == 0: return None
    af = obj.assets_file
    if fid == 0: tgt = af
    else:
        ext = af.externals[fid - 1]
        nombre = os.path.basename(ext.path)
        tgt = files.get(nombre)
        if tgt is None: return ('ext:' + nombre, pid)
    return (tgt, pid)

mallas, mats, texs, clips, audios = {}, {}, {}, {}, {}
bin_mallas = bytearray()

def id_de(r): 
    f, pid = r
    if isinstance(f, str): return f'{f}:{pid}'
    return ('s' if f is shared else 'm' if f is main else 'x') + str(pid)

def malla(r):
    k = id_de(r)
    if k in mallas or isinstance(r[0], str): 
        if isinstance(r[0], str): mallas.setdefault(k, {'externa': r[0], 'pid': r[1]})
        return k
    m = r[0].objects[r[1]].read()
    h = MeshHandler(m); h.process()
    v = h.m_Vertices; n = h.m_Normals; uv = h.m_UV0
    tris = h.get_triangles()
    off = len(bin_mallas)
    for p in v: bin_mallas.extend(struct.pack('<3f', p[0], p[1], -p[2]))
    noff = len(bin_mallas)
    if n:
        for p in n: bin_mallas.extend(struct.pack('<3f', p[0], p[1], -p[2]))
    uoff = len(bin_mallas)
    if uv:
        for p in uv: bin_mallas.extend(struct.pack('<2f', p[0], p[1]))
    subs = []
    big = len(v) > 65535
    while len(bin_mallas) % 4: bin_mallas.append(0)
    for s in tris:
        ioff = len(bin_mallas)
        for t in s:
            a, b, c = t
            bin_mallas.extend(struct.pack('<3I' if big else '<3H', a, c, b))
        while len(bin_mallas) % 4: bin_mallas.append(0)
        subs.append([ioff, len(s) * 3])
    xs = [p[0] for p in v]; ys = [p[1] for p in v]; zs = [-p[2] for p in v]
    mallas[k] = {'nombre': m.m_Name, 'nv': len(v), 'pos': off, 'nor': noff if n else -1, 'uv': uoff if uv else -1,
                 'i32': big, 'subs': subs, 'caja': [min(xs), min(ys), min(zs), max(xs), max(ys), max(zs)] if v else None}
    return k

def textura(r, maximo=1024):
    k = id_de(r)
    if k in texs or isinstance(r[0], str): return k
    t = r[0].objects[r[1]].read()
    try:
        im = t.image
    except Exception as e:
        texs[k] = {'nombre': t.m_Name, 'error': str(e)[:80]}; return k
    if im is None or im.width == 0: texs[k] = {'nombre': t.m_Name, 'vacia': True}; return k
    s = max(im.width, im.height)
    if s > maximo:
        f = maximo / s; im = im.resize((max(1, int(im.width * f)), max(1, int(im.height * f))))
    alfa = im.mode == 'RGBA' and im.getextrema()[3][0] < 250
    if not alfa: im = im.convert('RGB')
    arch = f'{k}.webp'
    im.save(os.path.join(SAL, arch), 'WEBP', quality=82, method=6)
    texs[k] = {'nombre': t.m_Name, 'arch': arch, 'w': im.width, 'h': im.height, 'alfa': alfa}
    return k

def pares(x):
    # m_TexEnvs / m_Floats / m_Colors: lista de pares o dict
    if isinstance(x, dict): return list(x.items())
    out = []
    for e in x:
        if isinstance(e, (list, tuple)): out.append((e[0] if not isinstance(e[0], dict) else e[0].get('name', e[0]), e[1]))
        elif isinstance(e, dict) and 'first' in e: out.append((e['first'] if not isinstance(e['first'], dict) else e['first'].get('name'), e['second']))
    return out

def material(r):
    k = id_de(r)
    if k in mats or isinstance(r[0], str): return k
    o = r[0].objects[r[1]]; d = tt(o)
    sh = ref(o, d['m_Shader']); shn = '?'
    if sh and not isinstance(sh[0], str):
        try: shn = sh[0].objects[sh[1]].read().m_Name
        except Exception: shn = f'pid{sh[1]}'
    elif sh: shn = f'{sh[0]}:{sh[1]}'
    sp = d['m_SavedProperties']
    m = {'nombre': d['m_Name'], 'shader': shn, 'tex': {}, 'f': {}, 'c': {}}
    for n, v in pares(sp['m_TexEnvs']):
        tr = ref(o, v['m_Texture'])
        if tr: m['tex'][n] = {'t': textura(tr), 'esc': [v['m_Scale']['x'], v['m_Scale']['y']], 'off': [v['m_Offset']['x'], v['m_Offset']['y']]}
    for n, v in pares(sp['m_Floats']): m['f'][n] = v
    for n, v in pares(sp['m_Colors']): m['c'][n] = C(v)
    mats[k] = m
    return k

def clip(r):
    k = id_de(r)
    o = r[0].objects[r[1]]; d = tt(o); nombre = d['m_Name']
    if nombre in clips: return nombre
    curvas = []
    for tipo, lista in (('pos', d['m_PositionCurves']), ('rot', d['m_RotationCurves']), ('esc', d['m_ScaleCurves'])):
        for c in lista:
            ks = []
            for kf in c['curve']['m_Curve']:
                v, a, b = kf['value'], kf['inSlope'], kf['outSlope']
                if tipo == 'pos': f = lambda q: [q['x'], q['y'], -q['z']]
                elif tipo == 'rot': f = lambda q: [-q['x'], -q['y'], q['z'], q['w']]
                else: f = lambda q: [q['x'], q['y'], q['z']]
                ks.append([round(kf['time'], 5)] + [max(-1e30, min(1e30, round(x, 5))) for x in f(v) + f(a) + f(b)])
            curvas.append({'ruta': c['path'], 'tipo': tipo, 'k': ks})
    clips[nombre] = {'wrap': d.get('m_WrapMode', 0), 'curvas': curvas,
                     'largo': max((c['k'][-1][0] for c in curvas if c['k']), default=0)}
    return nombre

def audio(r):
    k = id_de(r)
    if k in audios: return k
    a = r[0].objects[r[1]].read()
    for nombre, datos in a.samples.items():
        # el audio crudo (ogg o wav) fuera de datos/, y a Opus mono de 40 kb/s con ffmpeg
        crudo = os.path.join(SAL, '..', '..', 'crudo', f'{k}_' + nombre.replace(' ', '_'))
        os.makedirs(os.path.dirname(crudo), exist_ok=True)
        open(crudo, 'wb').write(datos)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', crudo, '-ac', '1', '-c:a', 'libopus', '-b:a', '40k', os.path.join(SAL, k + '.ogg')], check=True)
        audios[k] = {'nombre': a.m_Name}
        break
    return k

# --- MonoBehaviours: campos según el script (formato crudo de Unity 4.5: PPtr = 8 bytes)
CAMPOS = {
    'MouseLook': 'i:axes f:sensX f:sensY f:minX f:maxX f:minY f:maxY',
    'PlayerFPScontroller': 'f:movementSpeed f:jumpSpeed f:sprintShift f:mouseSensitivity f:upDownRange',
    'PlayerDie': 'f:maxFallHeight',
    'Mesh_PickupMesh': 'i:myKind p:textObject p:meshesText p:endCam',
    'KutteFuckerScript': 'i:myKind p:target f:attackLenght f:attackSpeed p:child',
    'CollectedMeshes': 'p:busObject',
    'EndCameraScript': 'p:camPlayer p:camEnd p:bus',
    'UIposition': 'f:depth i:xAlign i:yAlign f:xOffset f:yOffset b:isText',
}
def guion(o):
    raw = o.get_raw_data()
    gfid, gpid = struct.unpack_from('<ii', raw, 0)
    off = 12
    sfid, spid = struct.unpack_from('<ii', raw, off); off += 8
    n = struct.unpack_from('<i', raw, off)[0]; off += 4 + n; off = (off + 3) & ~3
    nombre = scripts.get(spid, f'script{spid}') if sfid else f'builtin{spid}'
    campos = {}
    for c in CAMPOS.get(nombre, '').split():
        t, nm = c.split(':')
        if off >= len(raw): break
        if t == 'i': campos[nm] = struct.unpack_from('<i', raw, off)[0]; off += 4
        elif t == 'f': campos[nm] = round(struct.unpack_from('<f', raw, off)[0], 4); off += 4
        elif t == 'b': campos[nm] = raw[off]; off += 4
        elif t == 'p': campos[nm] = ('pid', struct.unpack_from('<ii', raw, off)[1]); off += 8
    return nombre, campos

# --- escena
tf_go = {}; go_comp = {}
for o in main.objects.values():
    if o.type.name == 'GameObject':
        d = tt(o)
        comps = []
        for c in d['m_Component']:
            pp = c.get('component') if isinstance(c, dict) else c[1]
            if pp is None and isinstance(c, dict): pp = c.get('second')
            comps.append(pp['m_PathID'])
        go_comp[o.path_id] = (d['m_Name'], d['m_IsActive'], comps, d.get('m_Layer', 0), d.get('m_TagString', ''))
comp_go = {}
for g, (_, _, cs, _, _) in go_comp.items():
    for c in cs: comp_go[c] = g
nodos = []; idx_go = {}
raices = []
for o in main.objects.values():
    if o.type.name == 'Transform':
        d = tt(o)
        if d['m_Father']['m_PathID'] == 0: raices.append(o)
pendientes_p = []
def visitar(o, padre):
    d = tt(o)
    g = d['m_GameObject']['m_PathID']
    nombre, activo, comps, capa, tag = go_comp[g]
    n = {'n': nombre, 'p': padre, 't': P(d['m_LocalPosition']), 'r': Q(d['m_LocalRotation']), 's': [d['m_LocalScale'][k] for k in 'xyz']}
    if not activo: n['inactivo'] = 1
    if tag: n['tag'] = tag
    i = len(nodos); nodos.append(n); idx_go[g] = i
    for cp in comps:
        co = main.objects.get(cp)
        if co is None: continue
        ty = co.type.name
        if ty == 'Transform': continue
        try: cd = tt(co) if ty != 'MonoBehaviour' else None
        except Exception as e: n.setdefault('err', []).append(ty); continue
        if ty == 'MeshFilter':
            r = ref(co, cd['m_Mesh'])
            if r: n['malla'] = malla(r)
        elif ty == 'MeshRenderer':
            n['mats'] = [material(r) for r in (ref(co, m) for m in cd['m_Materials']) if r]
            if not cd['m_Enabled']: n['rend_off'] = 1
            n['sombras'] = [cd.get('m_CastShadows', 0), cd.get('m_ReceiveShadows', 0)]
        elif ty == 'Light':
            n['luz'] = {'tipo': cd['m_Type'], 'color': C(cd['m_Color']), 'int': round(cd['m_Intensity'], 4), 'rango': round(cd['m_Range'], 4),
                        'angulo': round(cd['m_SpotAngle'], 2), 'on': cd['m_Enabled'], 'sombra': cd['m_Shadows']['m_Type'],
                        'render': cd.get('m_RenderMode', 0)}
        elif ty == 'Camera':
            n['cam'] = {'on': cd['m_Enabled'], 'fov': cd['field of view'], 'cerca': cd['near clip plane'], 'lejos': cd['far clip plane'], 'fondo': C(cd['m_BackGroundColor'])}
        elif ty == 'Animation':
            n['anim'] = {'clips': [clip(ref(co, c)) for c in cd['m_Animations'] if ref(co, c)], 'auto': cd['m_PlayAutomatically'],
                         'def': clip(ref(co, cd['m_Animation'])) if ref(co, cd['m_Animation']) else None}
        elif ty == 'AudioSource':
            r = ref(co, cd['m_audioClip'])
            n['audio'] = {'clip': audio(r) if r else None, 'vol': cd['m_Volume'], 'loop': cd.get('Loop', cd.get('m_Loop', 0)), 'mute': cd['Mute'], 'auto': cd['m_PlayOnAwake'],
                          'min': cd['MinDistance'], 'max': cd['MaxDistance'], 'caida': cd['rolloffMode'], 'pan2d': cd.get('Pan2D', 0)}
        elif ty == 'TextMesh':
            n['texto'] = {'t': cd['m_Text'], 'tam': cd['m_CharacterSize'], 'fuente': cd['m_FontSize'], 'ancla': cd['m_Anchor'], 'alin': cd['m_Alignment'],
                          'color': rgba32(cd['m_Color']['rgba']), 'estilo': cd['m_FontStyle'], 'linea': cd['m_LineSpacing']}
        elif ty == 'GUIText':
            n['guitexto'] = {'t': cd['m_Text'], 'ancla': cd['m_Anchor'], 'fuente': cd['m_FontSize']}
        elif ty == 'MeshCollider':
            r = ref(co, cd['m_Mesh'])
            n.setdefault('col', []).append({'tipo': 'malla', 'malla': malla(r) if r else None, 'trig': cd['m_IsTrigger'], 'on': cd['m_Enabled']})
        elif ty == 'BoxCollider':
            n.setdefault('col', []).append({'tipo': 'caja', 'c': P(cd['m_Center']), 'tam': [cd['m_Size'][k] for k in 'xyz'], 'trig': cd['m_IsTrigger'], 'on': cd['m_Enabled']})
        elif ty == 'CharacterController':
            n['cc'] = {'alto': cd['m_Height'], 'radio': cd['m_Radius'], 'centro': P(cd['m_Center']), 'paso': cd['m_StepOffset'], 'pendiente': cd['m_SlopeLimit']}
        elif ty == 'MonoBehaviour':
            nm, campos = guion(co)
            if nm.startswith('builtin'):  # el Terrain de Unity 4 es un MonoBehaviour del motor
                raw = co.get_raw_data()
                n['terreno'] = 1
            else:
                for v in campos.values():
                    if isinstance(v, tuple): pendientes_p.append(v)
                n.setdefault('guiones', []).append({'n': nm, **campos})
        elif ty == 'TerrainCollider':
            n['terreno_col'] = 1
        else:
            n.setdefault('otros', []).append(ty)
    for h in d['m_Children']:
        visitar(main.objects[h['m_PathID']], i)
for o in raices: visitar(o, -1)
# PPtr de los guiones -> índice de nodo
tf_de_go = {}
for n in nodos:
    for g in n.get('guiones', []):
        for k, v in list(g.items()):
            if isinstance(v, tuple):
                pid = v[1]
                gid = pid if pid in go_comp else comp_go.get(pid)
                g[k] = idx_go.get(gid, -1) if gid else -1
                if pid in main.objects: g[k + '_tipo'] = main.objects[pid].type.name

# --- prefab del árbol (sharedassets0) y terreno
arbol = {}
for o in shared.objects.values():
    if o.type.name == 'MeshFilter': arbol['malla'] = malla(ref(o, tt(o)['m_Mesh']))
    if o.type.name == 'MeshRenderer': arbol['mats'] = [material(ref(o, m)) for m in tt(o)['m_Materials'] if ref(o, m)]
    if o.type.name == 'Transform': d = tt(o); arbol['s'] = [d['m_LocalScale'][k] for k in 'xyz']; arbol['r'] = Q(d['m_LocalRotation'])
terreno = {}
for o in shared.objects.values():
    if o.type.name != 'TerrainData': continue
    d = tt(o); hm = d['m_Heightmap']
    w, h = hm['m_Width'], hm['m_Height']
    open(os.path.join(SAL, 'alturas.bin'), 'wb').write(struct.pack(f'<{w*h}H', *hm['m_Heights']))
    sd = d['m_SplatDatabase']
    capas = [{'tex': textura(ref(o, s['texture'])), 'tile': [s['tileSize']['x'], s['tileSize']['y']]} for s in sd['m_Splats']]
    dd = d['m_DetailDatabase']
    pc, ps = dd['m_PatchCount'], dd['m_PatchSamples']
    res = pc * ps
    den = bytearray(res * res)
    for pi, p in enumerate(dd['m_Patches']):
        no = p['numberOfObjects']
        if not no: continue
        px, py = pi % pc, pi // pc
        for li, layer in enumerate(p['layerIndices']):
            for y in range(ps):
                for x in range(ps):
                    v = no[li * ps * ps + y * ps + x]
                    if v: den[(py * ps + y) * res + px * ps + x] = min(255, v)
    open(os.path.join(SAL, 'pasto.bin'), 'wb').write(bytes(den))
    pr = dd['m_DetailPrototypes'][0]
    arb = bytearray()
    for t in dd['m_TreeInstances']:
        p = t['position']
        arb.extend(struct.pack('<5f', p['x'], p['y'], p['z'], t['widthScale'], t['heightScale']))
    open(os.path.join(SAL, 'arboles.bin'), 'wb').write(bytes(arb))
    terreno = {'res': w, 'esc': [hm['m_Scale']['x'], hm['m_Scale']['y'], hm['m_Scale']['z']], 'capas': capas,
               'pasto': {'res': res, 'tex': textura(ref(o, pr['prototypeTexture'])), 'ancho': [pr['minWidth'], pr['maxWidth']], 'alto': [pr['minHeight'], pr['maxHeight']],
                         'sano': C(pr['healthyColor']), 'seco': C(pr['dryColor']), 'ruido': pr['noiseSpread']},
               'arboles': len(dd['m_TreeInstances'])}
# render settings
rs = {}
for o in main.objects.values():
    if o.type.name == 'RenderSettings':
        d = tt(o); rs = {'niebla': d['m_Fog'], 'niebla_color': C(d['m_FogColor']), 'niebla_modo': d['m_FogMode'], 'niebla_dens': d['m_FogDensity'], 'ambiente': C(d['m_AmbientLight'])}
open(os.path.join(SAL, 'mallas.bin'), 'wb').write(bytes(bin_mallas))
json.dump({'nodos': nodos, 'mallas': mallas, 'mats': mats, 'texs': texs, 'clips': clips, 'audios': audios, 'arbol': arbol, 'terreno': terreno, 'render': rs},
          open(os.path.join(SAL, 'escena.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('nodos', len(nodos), 'mallas', len(mallas), 'mats', len(mats), 'texs', len(texs), 'clips', list(clips), 'audios', len(audios), 'bin', len(bin_mallas))
print('externas', [k for k, v in mallas.items() if 'externa' in v], 'tex con error', [v['nombre'] for v in texs.values() if 'error' in v or 'vacia' in v])
print('shaders', sorted({m['shader'] for m in mats.values()}))

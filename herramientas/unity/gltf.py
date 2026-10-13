"""De objetos de Unity (leídos con UnityPy) a glTF binario (.glb), para rearmar un juego en three.js.

    from gltf import Glb, Exportador
    glb = Glb()
    ex = Exportador(glb, calidad_webp=85)
    raiz = ex.jerarquia(transform_raiz)      # nodos, mallas, pieles y materiales de un prefab o escena
    glb.escena([raiz]); glb.guardar('tom.glb')

Unity usa mano izquierda (x a la derecha, y arriba, z adelante) y glTF mano derecha: se espeja la x
(posiciones, normales, matrices) y se da vuelta el orden de los triángulos; las rotaciones pasan de
(x, y, z, w) a (x, -y, -z, w). La v de las texturas va al revés (en Unity crece hacia arriba).

Las texturas van en WebP (EXT_texture_webp, que three.js lee); con alfa si la textura la tiene.
No trae nada de ningún juego: lee lo que le pasan.
"""
import io
import json
import math
import struct

from UnityPy.helpers.MeshHelper import MeshHandler, unpack_ints

FLOAT, UBYTE, USHORT, UINT, SHORT = 5126, 5121, 5123, 5125, 5122
ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER = 34962, 34963


class Glb:
    """Un glTF binario que se va llenando: buffers, accesores, nodos, mallas, pieles, materiales."""

    def __init__(self):
        self.bin = bytearray()
        self.j = {'asset': {'version': '2.0', 'generator': 'herramientas/unity/gltf.py'}, 'buffers': [],
                  'bufferViews': [], 'accessors': [], 'nodes': [], 'meshes': [], 'materials': [],
                  'textures': [], 'images': [], 'samplers': [], 'skins': [], 'scenes': [], 'animations': []}
        self.usadas = set()

    def vista(self, datos, target=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        v = {'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': len(datos)}
        if target:
            v['target'] = target
        self.bin += datos
        self.j['bufferViews'].append(v)
        return len(self.j['bufferViews']) - 1

    def accesor(self, datos, tipo_comp, cuenta, tipo, target=None, minimo=None, maximo=None, normalizado=False):
        a = {'bufferView': self.vista(datos, target), 'componentType': tipo_comp, 'count': cuenta, 'type': tipo}
        if minimo is not None:
            a['min'], a['max'] = minimo, maximo
        if normalizado:
            a['normalized'] = True
        self.j['accessors'].append(a)
        return len(self.j['accessors']) - 1

    def floats(self, filas, tipo, target=ARRAY_BUFFER, limites=False):
        n = len(filas[0]) if filas and isinstance(filas[0], (tuple, list)) else 1
        plano = [x for f in filas for x in f] if n > 1 else list(filas)
        mn = mx = None
        if limites and filas:
            mn = [min(f[i] for f in filas) for i in range(n)] if n > 1 else [min(filas)]
            mx = [max(f[i] for f in filas) for i in range(n)] if n > 1 else [max(filas)]
        return self.accesor(struct.pack(f'<{len(plano)}f', *plano), FLOAT, len(filas), tipo, target, mn, mx)

    def imagen(self, png_o_webp, mime):
        i = len(self.j['images'])
        self.j['images'].append({'bufferView': self.vista(png_o_webp), 'mimeType': mime})
        return i

    def nodo(self, **campos):
        self.j['nodes'].append(campos)
        return len(self.j['nodes']) - 1

    def escena(self, raices):
        self.j['scenes'].append({'nodes': raices})
        self.j['scene'] = 0

    def guardar(self, ruta):
        j = {k: v for k, v in self.j.items() if v != []}
        while len(self.bin) % 4:
            self.bin.append(0)
        j['buffers'] = [{'byteLength': len(self.bin)}]
        if self.usadas:
            j['extensionsUsed'] = sorted(self.usadas)
            req = sorted(self.usadas & {'EXT_texture_webp'})
            if req:
                j['extensionsRequired'] = req
        js = json.dumps(j, separators=(',', ':')).encode()
        js += b' ' * (-len(js) % 4)
        total = 12 + 8 + len(js) + 8 + len(self.bin)
        with open(ruta, 'wb') as f:
            f.write(struct.pack('<III', 0x46546C67, 2, total))
            f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
            f.write(struct.pack('<II', len(self.bin), 0x004E4942) + bytes(self.bin))


def pesos_comprimidos(cm, n):
    """Los pesos de piel de una malla comprimida (m_CompressedMesh), como Unity: cada peso en 5 bits
    (sobre 31); un vértice termina cuando suman 31 o ya tiene tres, y entonces el cuarto es lo que
    falta. (UnityPy 1.25 pone 1 − suma en vez de (31 − suma)/31 y deja pesos negativos.)"""
    pesos = unpack_ints(cm.m_Weights)
    indices = iter(unpack_ints(cm.m_BoneIndices))
    bi = [[0, 0, 0, 0] for _ in range(n)]
    bw = [[0.0, 0.0, 0.0, 0.0] for _ in range(n)]
    v = j = suma = 0
    for w in pesos:
        if v >= n:
            break
        bw[v][j] = w / 31
        bi[v][j] = next(indices)
        j += 1
        suma += w
        if suma >= 31:
            v += 1
            j = suma = 0
        elif j == 3:
            bw[v][3] = (31 - suma) / 31
            bi[v][3] = next(indices)
            v += 1
            j = suma = 0
    return [tuple(x) for x in bi], [tuple(x) for x in bw]


# --------------------------------------------------------------------------- mano izquierda → derecha
def pos(v):
    return (-v.x, v.y, v.z)


def rot(q):
    return (q.x, -q.y, -q.z, q.w)


def matriz(m):
    """Matrix4x4f de Unity (eFC: fila F, columna C) → lista column-major de glTF, espejada en x."""
    e = [[getattr(m, f'e{f}{c}') for c in range(4)] for f in range(4)]
    s = (-1, 1, 1, 1)
    e = [[e[f][c] * s[f] * s[c] for c in range(4)] for f in range(4)]
    return [e[f][c] for c in range(4) for f in range(4)]


# --------------------------------------------------------------------------- colisionadores y partículas
def _r(x, n=4):
    return round(float(x), n)


TIPO_COLISIONADOR = {'BoxCollider': 'caja', 'SphereCollider': 'esfera', 'CapsuleCollider': 'capsula', 'MeshCollider': 'malla'}


def colisionador(tipo, c):
    """Un Collider como extras, en el espacio del nodo (x espejada): caja (centro, tam), esfera (centro,
    radio), cápsula (centro, radio, alto, eje 0/1/2 = x/y/z) o malla (la del nodo u otra)."""
    z = {'tipo': TIPO_COLISIONADOR.get(tipo, tipo)}
    if hasattr(c, 'm_Center'):
        z['centro'] = [_r(x) for x in pos(c.m_Center)]
    if hasattr(c, 'm_Size'):
        z['tam'] = [_r(c.m_Size.x), _r(c.m_Size.y), _r(c.m_Size.z)]
    for a, k in (('m_Radius', 'radio'), ('m_Height', 'alto')):
        if hasattr(c, a):
            z[k] = _r(getattr(c, a))
    if hasattr(c, 'm_Direction'):
        z['eje'] = c.m_Direction
    if getattr(c, 'm_IsTrigger', False):
        z['disparador'] = True
    if not getattr(c, 'm_Enabled', True):
        z['apagado'] = True
    return z


def _claves(curva):
    return [[_r(k['time']), _r(k['value']), _r(k['inSlope']), _r(k['outSlope'])] for k in curva['m_Curve']]


def curva_mm(c):
    """MinMaxCurve: m = 0 constante (k), 1 curva (k × c), 2 entre dos curvas (k × c0..c), 3 entre dos
    constantes (k0..k)."""
    m = c['minMaxState']
    out = {'m': m, 'k': _r(c['scalar'])}
    if m == 3:
        out['k0'] = _r(c['minScalar'])
    if m in (1, 2):
        out['c'] = _claves(c['maxCurve'])
    if m == 2:
        out['c0'] = _claves(c['minCurve'])
    return out


def _color(c):
    return [_r(c['r']), _r(c['g']), _r(c['b']), _r(c['a'])]


def gradiente(g):
    """Gradient: claves de color [t, r, g, b] y de alfa [t, a] (t de 0 a 1); modo 0 mezcla, 1 fijo."""
    return {'col': [[_r(g[f'ctime{i}'] / 65535), *_color(g[f'key{i}'])[:3]] for i in range(g['m_NumColorKeys'])],
            'alfa': [[_r(g[f'atime{i}'] / 65535), _r(g[f'key{i}']['a'])] for i in range(g['m_NumAlphaKeys'])],
            'modo': g.get('m_Mode', 0)}


def gradiente_mm(c):
    """MinMaxGradient: m = 0 color, 1 gradiente, 2 entre dos colores, 3 entre dos gradientes, 4 color
    al azar del gradiente."""
    m = c['minMaxState']
    out = {'m': m}
    if m in (0, 2):
        out['color'] = _color(c['maxColor'])
    if m == 2:
        out['color0'] = _color(c['minColor'])
    if m in (1, 3, 4):
        out['grad'] = gradiente(c['maxGradient'])
    if m == 3:
        out['grad0'] = gradiente(c['minGradient'])
    return out


def particulas(ps, pr):
    """Un ParticleSystem (y su ParticleSystemRenderer) como extras, los módulos encendidos con sus
    curvas tal cual. Los vectores de mundo (fuerza, velocidad en mundo) van con la x espejada; la
    rotación de cada partícula queda como en Unity (en mano derecha gira al revés)."""
    def mm(d, *ks):
        return {k: curva_mm(d[k]) for k in ks if k in d}
    ini = ps['InitialModule']
    out = {'dur': _r(ps['lengthInSec']), 'bucle': bool(ps['looping']), 'precalentar': bool(ps['prewarm']),
           'alEmpezar': bool(ps['playOnAwake']), 'velSim': _r(ps.get('simulationSpeed', 1)),
           'espacio': ps.get('moveWithTransform', 0), 'escala': ps.get('scalingMode', 0),
           'demora': curva_mm(ps['startDelay']),
           'ini': {**mm(ini, 'startLifetime', 'startSpeed', 'startSize', 'startRotation', 'gravityModifier'),
                   'color': gradiente_mm(ini['startColor']), 'max': ini['maxNumParticles']}}
    sh = ps['ShapeModule']
    if sh['enabled']:
        out['forma'] = {'tipo': sh['type'], 'angulo': _r(sh['angle']), 'largo': _r(sh['length']),
                        'radio': _r(sh['radius']['value'] if isinstance(sh['radius'], dict) else sh['radius']),
                        'arco': _r(sh['arc']['value'] if isinstance(sh['arc'], dict) else sh['arc']),
                        'grosor': _r(sh.get('radiusThickness', 1)),
                        'pos': [-_r(sh['m_Position']['x']), _r(sh['m_Position']['y']), _r(sh['m_Position']['z'])],
                        'rot': [_r(sh['m_Rotation'][a]) for a in 'xyz'], 'escala': [_r(sh['m_Scale'][a]) for a in 'xyz']}
    em = ps['EmissionModule']
    if em['enabled']:
        out['emision'] = {**mm(em, 'rateOverTime', 'rateOverDistance'),
                          'rafagas': [{'t': _r(b['time']), 'n': curva_mm(b['countCurve']) if 'countCurve' in b else b.get('minCount'),
                                       'ciclos': b.get('cycleCount', 1), 'cada': _r(b.get('repeatInterval', 0))}
                                      for b in em.get('m_Bursts', [])]}
    for mod, k, campos in (('SizeModule', 'tam', ('curve',)), ('RotationModule', 'rot', ('curve',)),
                           ('ForceModule', 'fuerza', ('x', 'y', 'z')), ('VelocityModule', 'vel', ('x', 'y', 'z'))):
        m = ps.get(mod)
        if m and m['enabled']:
            out[k] = mm(m, *campos)
            if k in ('fuerza', 'vel'):
                out[k]['mundo'] = bool(m.get('inWorldSpace', False))
                if out[k]['mundo'] and 'x' in out[k]:
                    out[k]['x']['k'] = -out[k]['x']['k']
                    if 'k0' in out[k]['x']:
                        out[k]['x']['k0'] = -out[k]['x']['k0']
    co = ps.get('ColorModule')
    if co and co['enabled']:
        out['colorVida'] = gradiente_mm(co['gradient'])
    uv = ps.get('UVModule')
    if uv and uv['enabled']:
        out['hoja'] = {'x': uv['tilesX'], 'y': uv['tilesY'], 'filas': uv.get('animationType', 0),
                       'cuadro': curva_mm(uv['frameOverTime']), 'inicio': curva_mm(uv['startFrame']),
                       'ciclos': uv.get('cycles', 1)}
    if pr:
        out['render'] = {'modo': pr['m_RenderMode'], 'tamMax': _r(pr['m_MaxParticleSize']),
                         'tamMin': _r(pr['m_MinParticleSize']), 'orden': pr['m_SortMode'],
                         'alinear': pr.get('m_RenderAlignment', 0)}
    return out


class Exportador:
    """Pasa jerarquías de Unity a un Glb, compartiendo mallas, materiales y texturas ya exportados."""

    def __init__(self, glb, calidad_webp=85, tam_max=1024, sin_luz=False, con_materiales=True,
                 materiales_unity=False, carpeta_tex=None, uv_unity=False):
        self.glb = glb
        self.con_materiales = con_materiales   # False: mallas sin material (el programa pone el suyo)
        # materiales_unity: cada material como extras {shader, kw, tex, st, col, flt} (la página arma
        # el shader del juego); las texturas van en carpeta_tex como WebP aparte.
        self.materiales_unity = materiales_unity
        self.carpeta_tex = carpeta_tex
        self.uv_unity = uv_unity               # True: las UV tal cual (v hacia arriba, como Unity)
        self.shaders = {}                      # nombre → (Shader de UnityPy, {keywords})
        self.archivos_tex = {}
        self.calidad = calidad_webp
        self.tam_max = tam_max
        self.sin_luz = sin_luz          # KHR_materials_unlit: el color de la textura tal cual
        self.mallas = {}                # (archivo, path_id) → índice de malla glTF
        self.mats = {}
        self.texs = {}
        self.nodo_de = {}               # (archivo, path_id del Transform) → nodo
        self.pieles = []                # (nodo de la malla, SkinnedMeshRenderer) a resolver al final
        self.avisos = []
        # extras_go(exportador, GameObject) → dict: lo propio de cada juego (sus MonoBehaviour) que va
        # en los extras del nodo
        self.extras_go = None

    @staticmethod
    def clave(obj):
        r = obj.object_reader if hasattr(obj, 'object_reader') else obj.reader
        return (r.assets_file.name, r.path_id)

    # ---------------------------------------------------------------- texturas y materiales
    def textura(self, tex):
        k = self.clave(tex)
        if k in self.texs:
            return self.texs[k]
        try:
            img = tex.image
        except Exception as e:  # formato que UnityPy no decodifica
            self.avisos.append(f'textura {tex.m_Name}: {e}')
            self.texs[k] = None
            return None
        if max(img.size) > self.tam_max:
            f = self.tam_max / max(img.size)
            img = img.resize((max(1, round(img.width * f)), max(1, round(img.height * f))))
        alfa = img.mode in ('RGBA', 'LA') and img.getchannel('A').getextrema()[0] < 250
        if not alfa:
            img = img.convert('RGB')
        b = io.BytesIO()
        img.save(b, 'WEBP', quality=self.calidad, method=4)
        g = self.glb
        if not g.j['samplers']:
            g.j['samplers'].append({'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497})
        i = g.imagen(b.getvalue(), 'image/webp')
        g.j['textures'].append({'sampler': 0, 'extensions': {'EXT_texture_webp': {'source': i}}})
        g.usadas.add('EXT_texture_webp')
        self.texs[k] = (len(g.j['textures']) - 1, alfa)
        return self.texs[k]

    def textura_archivo(self, tex):
        """Una textura como WebP aparte en carpeta_tex (una vez por textura); devuelve el nombre."""
        import os
        k = self.clave(tex)
        if k in self.archivos_tex:
            return self.archivos_tex[k]
        try:
            img = tex.image
        except Exception as e:
            self.avisos.append(f'textura {tex.m_Name}: {e}')
            self.archivos_tex[k] = None
            return None
        if max(img.size) > self.tam_max:
            f = self.tam_max / max(img.size)
            img = img.resize((max(1, round(img.width * f)), max(1, round(img.height * f))))
        if img.mode in ('RGBA', 'LA') and img.getchannel('A').getextrema()[0] >= 250:
            img = img.convert('RGB')
        elif img.mode not in ('RGB', 'RGBA'):
            img = img.convert('RGBA')
        nombre = f'{tex.m_Name}.webp'
        usados = set(self.archivos_tex.values())
        i = 1
        while nombre in usados:
            i += 1
            nombre = f'{tex.m_Name}~{i}.webp'
        b = io.BytesIO()
        img.save(b, 'WEBP', quality=self.calidad, method=4, alpha_quality=100)
        os.makedirs(self.carpeta_tex, exist_ok=True)
        with open(os.path.join(self.carpeta_tex, nombre), 'wb') as f:
            f.write(b.getvalue())
        self.archivos_tex[k] = nombre
        return nombre

    def material_unity(self, mat):
        """El material como extras para armar el shader del juego en la página."""
        sp = mat.m_SavedProperties
        kw = list(getattr(mat, 'm_ValidKeywords', None) or [])
        if isinstance(getattr(mat, 'm_ShaderKeywords', None), str):
            kw += [x for x in mat.m_ShaderKeywords.split() if x not in kw]
        ex = {'shader': None, 'kw': kw, 'tex': {}, 'st': {}, 'col': {}, 'flt': {}}
        try:
            sh = mat.m_Shader.read()
            ex['shader'] = sh.m_ParsedForm.m_Name
            self.shaders.setdefault(ex['shader'], (sh, set()))[1].add(tuple(sorted(kw)))
        except Exception:
            pass
        for n, t in sp.m_TexEnvs:
            if t.m_Texture.path_id:
                try:
                    tx = t.m_Texture.read()
                    if tx.object_reader.type.name == 'Texture2D':
                        ex['tex'][n] = self.textura_archivo(tx)
                except Exception as e:
                    self.avisos.append(f'material {mat.m_Name} {n}: {e}')
            ex['st'][n] = [round(t.m_Scale.x, 5), round(t.m_Scale.y, 5), round(t.m_Offset.x, 5), round(t.m_Offset.y, 5)]
        for n, c in sp.m_Colors:
            ex['col'][n] = [round(c.r, 5), round(c.g, 5), round(c.b, 5), round(c.a, 5)]
        for n, v in sp.m_Floats:
            ex['flt'][n] = round(v, 5)
        if getattr(mat, 'm_CustomRenderQueue', -1) >= 0:
            ex['cola'] = mat.m_CustomRenderQueue
        return ex

    def material(self, pmat):
        if not self.con_materiales:
            return None
        try:
            mat = pmat.read()
        except Exception:
            return None
        k = self.clave(mat)
        if k in self.mats:
            return self.mats[k]
        if self.materiales_unity:
            self.glb.j['materials'].append({'name': mat.m_Name, 'extras': self.material_unity(mat)})
            self.mats[k] = len(self.glb.j['materials']) - 1
            return self.mats[k]
        sp = mat.m_SavedProperties
        texs = dict((n, t) for n, t in sp.m_TexEnvs)
        colores = dict((n, c) for n, c in sp.m_Colors)
        m = {'name': mat.m_Name, 'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': 1}}
        try:
            m['extras'] = {'shader': mat.m_Shader.read().m_ParsedForm.m_Name}
        except Exception:
            pass
        for nombre in ('_MainTex', '_BaseMap', '_Albedo', '_Texture', '_Diffuse'):
            t = texs.get(nombre)
            if t is not None and t.m_Texture.path_id:
                try:
                    r = self.textura(t.m_Texture.read())
                except Exception as e:
                    self.avisos.append(f'material {mat.m_Name}: {e}')
                    r = None
                if r:
                    info = {'index': r[0]}
                    if (t.m_Scale.x, t.m_Scale.y, t.m_Offset.x, t.m_Offset.y) != (1, 1, 0, 0):
                        info['extensions'] = {'KHR_texture_transform': {
                            'scale': [t.m_Scale.x, t.m_Scale.y],
                            'offset': [t.m_Offset.x, 1 - t.m_Offset.y - t.m_Scale.y]}}
                        self.glb.usadas.add('KHR_texture_transform')
                    m['pbrMetallicRoughness']['baseColorTexture'] = info
                    if r[1]:
                        m['alphaMode'] = 'BLEND'
                break
        for nombre in ('_Color', '_BaseColor', '_TintColor'):
            c = colores.get(nombre)
            if c is not None:
                m['pbrMetallicRoughness']['baseColorFactor'] = [c.r, c.g, c.b, c.a]
                if c.a < 0.999:
                    m['alphaMode'] = 'BLEND'
                break
        if self.sin_luz:
            m['extensions'] = {'KHR_materials_unlit': {}}
            self.glb.usadas.add('KHR_materials_unlit')
        self.glb.j['materials'].append(m)
        self.mats[k] = len(self.glb.j['materials']) - 1
        return self.mats[k]

    # ---------------------------------------------------------------- mallas
    def malla(self, mesh, materiales, con_piel):
        k = (self.clave(mesh), tuple(materiales), con_piel)
        if k in self.mallas:
            return self.mallas[k]
        h = MeshHandler(mesh)
        h.process()
        if mesh.m_CompressedMesh.m_Weights.m_NumItems > 0:
            h.m_BoneIndices, h.m_BoneWeights = pesos_comprimidos(mesh.m_CompressedMesh, h.m_VertexCount)
        g = self.glb
        n = h.m_VertexCount
        attrs = {'POSITION': g.floats([(-x, y, z) for x, y, z, *_ in h.m_Vertices], 'VEC3', limites=True)}
        if h.m_Normals:
            attrs['NORMAL'] = g.floats([(-v[0], v[1], v[2]) for v in h.m_Normals], 'VEC3')
        if self.uv_unity:
            if h.m_UV0:
                attrs['TEXCOORD_0'] = g.floats([(u, v) for u, v, *_ in h.m_UV0], 'VEC2')
            if h.m_UV1:
                attrs['TEXCOORD_1'] = g.floats([(u, v) for u, v, *_ in h.m_UV1], 'VEC2')
        else:
            if h.m_UV0:
                attrs['TEXCOORD_0'] = g.floats([(u, 1 - v) for u, v, *_ in h.m_UV0], 'VEC2')
            if h.m_UV1:
                attrs['TEXCOORD_1'] = g.floats([(u, 1 - v) for u, v, *_ in h.m_UV1], 'VEC2')
        if h.m_Colors:
            attrs['COLOR_0'] = g.floats([tuple(c[:4]) for c in h.m_Colors], 'VEC4')
        if con_piel and h.m_BoneIndices and h.m_BoneWeights:
            idx, pes = [], []
            for bi, bw in zip(h.m_BoneIndices, h.m_BoneWeights):
                s = sum(bw) or 1
                idx += list(bi[:4])
                pes += [w / s for w in bw[:4]]
            grande = max(idx) > 255
            attrs['JOINTS_0'] = g.accesor(struct.pack(f'<{len(idx)}{"H" if grande else "B"}', *idx),
                                          USHORT if grande else UBYTE, n, 'VEC4', ARRAY_BUFFER)
            attrs['WEIGHTS_0'] = g.accesor(struct.pack(f'<{len(pes)}f', *pes), FLOAT, n, 'VEC4', ARRAY_BUFFER)
        prims = []
        for i, tris in enumerate(h.get_triangles()):
            base = getattr(mesh.m_SubMeshes[i], 'baseVertex', 0) or 0
            plano = [v + base for (a, b, c) in tris for v in (a, c, b)]
            if not plano:
                continue
            ind = g.accesor(struct.pack(f'<{len(plano)}{"H" if n < 65536 else "I"}', *plano),
                            USHORT if n < 65536 else UINT, len(plano), 'SCALAR', ELEMENT_ARRAY_BUFFER)
            p = {'attributes': attrs, 'indices': ind}
            mat = materiales[min(i, len(materiales) - 1)] if materiales else None
            if mat is not None:
                p['material'] = mat
            prims.append(p)
        g.j['meshes'].append({'name': mesh.m_Name, 'primitives': prims})
        con = 'JOINTS_0' in attrs           # sin pesos no hay piel (aunque el renderer sea Skinned)
        self.mallas[k] = (len(g.j['meshes']) - 1, [list(map(lambda m: matriz(m), mesh.m_BindPose))] if con else None)
        return self.mallas[k]

    # ---------------------------------------------------------------- jerarquía
    def jerarquia(self, t, solo_activos=False):
        """Un Transform y sus hijos → nodos (con sus mallas). Devuelve el índice del nodo raíz."""
        go = t.m_GameObject.read()
        if solo_activos and not go.m_IsActive:
            return None
        nodo = {'name': go.m_Name}
        if not go.m_IsActive:
            nodo['extras'] = {'activo': False}
        p, q, s = t.m_LocalPosition, t.m_LocalRotation, t.m_LocalScale
        if (p.x, p.y, p.z) != (0, 0, 0):
            nodo['translation'] = list(pos(p))
        if (q.x, q.y, q.z, q.w) != (0, 0, 0, 1):
            nodo['rotation'] = list(rot(q))
        if (s.x, s.y, s.z) != (1, 1, 1):
            nodo['scale'] = [s.x, s.y, s.z]
        if getattr(go, 'm_Layer', 0):
            nodo.setdefault('extras', {})['capa'] = go.m_Layer
        i = self.glb.nodo(**nodo)
        self.nodo_de[self.clave(t)] = i
        mesh_filtro = None
        for c in go.m_Component:
            try:
                if c.component.deref().type.name == 'MeshFilter':
                    mesh_filtro = c.component.read().m_Mesh.path_id
            except Exception:
                pass
        for c in go.m_Component:
            try:
                ref = c.component.deref()
                tipo_ref = ref.type.name
            except Exception:
                continue
            if tipo_ref == 'ParticleSystem':
                try:
                    ps = ref.read_typetree()
                    rend = next((x.component.deref() for x in go.m_Component
                                 if x.component.deref().type.name == 'ParticleSystemRenderer'), None)
                    pr = rend.read_typetree() if rend is not None else None
                    p = particulas(ps, pr)
                    if rend is not None:
                        m = rend.read().m_Materials
                        if m and m[0].path_id:
                            p['material'] = self.material_unity(m[0].read())
                    self.glb.j['nodes'][i].setdefault('extras', {})['particulas'] = p
                except Exception as e:
                    self.avisos.append(f'partículas {go.m_Name}: {e}')
                continue
            try:
                comp = c.component.read()
            except Exception:
                continue
            tipo = comp.object_reader.type.name if hasattr(comp, 'object_reader') else ''
            if tipo in TIPO_COLISIONADOR:
                z = colisionador(tipo, comp)
                if tipo == 'MeshCollider':
                    if comp.m_Mesh.path_id == mesh_filtro:
                        z['malla'] = 'nodo'
                    elif comp.m_Mesh.path_id:
                        z['malla'], _ = self.malla(comp.m_Mesh.read(), [], False)
                self.glb.j['nodes'][i].setdefault('extras', {}).setdefault('colisionadores', []).append(z)
                continue
            if tipo == 'Camera':
                r = comp.m_NormalizedViewPortRect
                c = comp.m_BackGroundColor
                self.glb.j['nodes'][i].setdefault('extras', {})['camara'] = {
                    'fov': round(comp.field_of_view, 4), 'orto': bool(comp.orthographic),
                    'tam_orto': round(comp.orthographic_size, 4), 'cerca': round(comp.near_clip_plane, 4),
                    'lejos': round(comp.far_clip_plane, 4), 'prof': comp.m_Depth, 'mascara': comp.m_CullingMask.m_Bits,
                    'limpia': comp.m_ClearFlags, 'fondo': [round(c.r, 4), round(c.g, 4), round(c.b, 4), round(c.a, 4)],
                    'rect': [r.x, r.y, r.width, r.height], 'activa': bool(getattr(comp, 'm_Enabled', True))}
                continue
            if tipo == 'SkinnedMeshRenderer' and comp.m_Mesh.path_id:
                if not getattr(comp, 'm_Enabled', True):
                    continue
                mats = [self.material(m) for m in comp.m_Materials]
                mi, bind = self.malla(comp.m_Mesh.read(), mats, True)
                self.glb.j['nodes'][i]['mesh'] = mi
                if bind and comp.m_Bones:
                    self.pieles.append((i, comp, bind[0]))
            elif tipo == 'MeshFilter' and comp.m_Mesh.path_id:
                rend = next((x for x in self._componentes(go) if x[0] == 'MeshRenderer'), None)
                if rend is None or not getattr(rend[1], 'm_Enabled', True):
                    continue
                mats = [self.material(m) for m in rend[1].m_Materials]
                mi, _ = self.malla(comp.m_Mesh.read(), mats, False)
                self.glb.j['nodes'][i]['mesh'] = mi
                self.glb.j['nodes'][i].setdefault('extras', {})['lightmap'] = [
                    getattr(rend[1], 'm_LightmapIndex', 65535), *[getattr(rend[1].m_LightmapTilingOffset, a, 0) for a in 'xyzw']] \
                    if hasattr(rend[1], 'm_LightmapTilingOffset') else None
        if self.extras_go:
            ex = self.extras_go(self, go)
            if ex:
                self.glb.j['nodes'][i].setdefault('extras', {}).update(ex)
        hijos = [x for x in (self.jerarquia(h.read(), solo_activos) for h in t.m_Children) if x is not None]
        if hijos:
            self.glb.j['nodes'][i]['children'] = hijos
        return i

    @staticmethod
    def _componentes(go):
        out = []
        for c in go.m_Component:
            try:
                comp = c.component.read()
                out.append((comp.object_reader.type.name, comp))
            except Exception:
                pass
        return out

    def resolver_pieles(self):
        """Las pieles, cuando ya están todos los nodos de sus huesos."""
        for nodo, smr, bind in self.pieles:
            juntas = []
            for b in smr.m_Bones:
                try:
                    juntas.append(self.nodo_de.get(self.clave(b.read())))
                except Exception:
                    juntas.append(None)
            if None in juntas:
                self.avisos.append(f'piel del nodo {nodo}: huesos fuera de la jerarquía')
                continue
            plano = [x for m in bind for x in m]
            ibm = self.glb.accesor(struct.pack(f'<{len(plano)}f', *plano), FLOAT, len(bind), 'MAT4')
            self.glb.j['skins'].append({'joints': juntas, 'inverseBindMatrices': ibm})
            self.glb.j['nodes'][nodo]['skin'] = len(self.glb.j['skins']) - 1


# --------------------------------------------------------------------------- animaciones legacy
def hermite(k0, k1, t, comp):
    """El valor de una curva de Unity entre dos claves (Hermite con las pendientes de cada una)."""
    dt = k1.time - k0.time
    if dt <= 0:
        return comp(k0.value)
    s = (t - k0.time) / dt
    v0, v1 = comp(k0.value), comp(k1.value)
    m0, m1 = comp(k0.outSlope), comp(k1.inSlope)
    out = []
    for a, b, ma, mb in zip(v0, v1, m0, m1):
        if math.isinf(ma) or math.isinf(mb):   # escalón
            out.append(a)
            continue
        s2, s3 = s * s, s * s * s
        out.append((2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * dt * ma + (-2 * s3 + 3 * s2) * b + (s3 - s2) * dt * mb)
    return out


def muestrear(claves, tiempos, comp):
    """Una curva de Unity en los tiempos pedidos (antes de la primera y después de la última, se queda)."""
    out, j = [], 0
    for t in tiempos:
        if t <= claves[0].time:
            out.append(list(comp(claves[0].value)))
            continue
        if t >= claves[-1].time:
            out.append(list(comp(claves[-1].value)))
            continue
        while j + 1 < len(claves) and claves[j + 1].time < t:
            j += 1
        out.append(hermite(claves[j], claves[j + 1], t, comp))
    return out


def q4(q):
    return (q.x, q.y, q.z, q.w)


def v3(v):
    return (v.x, v.y, v.z)


def clip_legacy(clip, fps=30):
    """Un AnimationClip legacy muestreado: (duración, {ruta: {'r': [...], 'p': [...], 's': [...]}}) en mano
    derecha (rotaciones normalizadas, posiciones espejadas)."""
    fin = 0.0
    for lista in (clip.m_RotationCurves, clip.m_PositionCurves, clip.m_ScaleCurves):
        for c in lista:
            if c.curve.m_Curve:
                fin = max(fin, c.curve.m_Curve[-1].time)
    n = max(1, int(round(fin * fps)) + 1)
    tiempos = [min(fin, i / fps) for i in range(n)]
    pistas = {}
    for c in clip.m_RotationCurves:
        if not c.curve.m_Curve:
            continue
        vals = []
        for x, y, z, w in muestrear(c.curve.m_Curve, tiempos, q4):
            l = math.sqrt(x * x + y * y + z * z + w * w) or 1
            vals.append((x / l, -y / l, -z / l, w / l))
        pistas.setdefault(c.path, {})['r'] = vals
    for c in clip.m_PositionCurves:
        if c.curve.m_Curve:
            pistas.setdefault(c.path, {})['p'] = [(-x, y, z) for x, y, z in muestrear(c.curve.m_Curve, tiempos, v3)]
    for c in clip.m_ScaleCurves:
        if c.curve.m_Curve:
            pistas.setdefault(c.path, {})['s'] = [tuple(v) for v in muestrear(c.curve.m_Curve, tiempos, v3)]
    return fin, tiempos, pistas

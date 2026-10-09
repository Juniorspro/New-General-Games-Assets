"""Shaders de Unity (los programas GLES3 que trae el juego compilados por HLSLcc) → GLSL que three.js
usa tal cual en un RawShaderMaterial (WebGL 2), más el estado de render de cada pasada.

    from shaders import Traductor
    tr = Traductor()
    info = tr.shader(shader_unitypy, keywords_del_material)   # {'vs', 'fs', 'estado', 'props'} o None

Qué cambia en el texto: sin `#version` (three lo agrega), sin `layout(location)` en uniforms (no
existe en GLSL ES 3.00) y sin bloques de uniforms (HLSLCC_ENABLE_UNIFORM_BUFFERS 0: quedan sueltos);
las matrices de Unity pasan a las de three (unity_ObjectToWorld = modelMatrix, unity_MatrixVP =
projectionMatrix * viewMatrix, unity_WorldToObject = inverse(modelMatrix), _WorldSpaceCameraPos =
cameraPosition). El resto de los uniforms de Unity (_Time, _ScreenParams, unity_FogParams…) quedan
con su nombre: los pone la página.

La programa que corresponde a un material sale de sus keywords: el subprograma de GLES3 con más
keywords en común con el material y menos de más; si empatan, el primero.
"""
import re
import struct

import lz4.block

GLES3 = 9          # ShaderCompilerPlatform.GLES3x en shader.platforms

# matrices de Unity (vec4[4] por columnas en HLSLcc) → las de three.js
REEMPLAZOS = {
    'hlslcc_mtx4x4unity_ObjectToWorld': 'modelMatrix',
    'hlslcc_mtx4x4unity_WorldToObject': 'inverse(modelMatrix)',
    'hlslcc_mtx4x4unity_MatrixVP': '(projectionMatrix * viewMatrix)',
    'hlslcc_mtx4x4unity_MatrixV': 'viewMatrix',
    'hlslcc_mtx4x4unity_MatrixInvV': 'inverse(viewMatrix)',
    'hlslcc_mtx4x4glstate_matrix_projection': 'projectionMatrix',
    'hlslcc_mtx4x4unity_CameraProjection': 'projectionMatrix',
    'hlslcc_mtx4x4unity_MatrixInvVP': 'inverse(projectionMatrix * viewMatrix)',
    '_WorldSpaceCameraPos': 'cameraPosition',
}
DECLARACIONES = {
    'modelMatrix': 'uniform highp mat4 modelMatrix;',
    'viewMatrix': 'uniform highp mat4 viewMatrix;',
    'projectionMatrix': 'uniform highp mat4 projectionMatrix;',
    'cameraPosition': 'uniform highp vec3 cameraPosition;',
}


def _seccion(texto, etapa):
    i = texto.find(f'#ifdef {etapa}')
    if i < 0:
        return None
    j = texto.find('#version', i)
    # hasta el #endif que cierra (el último antes del siguiente #ifdef de etapa o del final)
    k = texto.find('#ifdef FRAGMENT', j) if etapa == 'VERTEX' else len(texto)
    cuerpo = texto[j:k]
    cuerpo = cuerpo[:cuerpo.rstrip().rfind('#endif')]
    return cuerpo


def traducir(cuerpo):
    """Una etapa (desde su #version) → GLSL para RawShaderMaterial con glslVersion GLSL3."""
    lineas = cuerpo.split('\n')
    lineas = [l for l in lineas if not l.startswith('#version')]
    t = '\n'.join(lineas)
    t = t.replace('#define HLSLCC_ENABLE_UNIFORM_BUFFERS 1', '#define HLSLCC_ENABLE_UNIFORM_BUFFERS 0')
    t = t.replace('#define UNITY_SUPPORTS_UNIFORM_LOCATION 1', '#define UNITY_SUPPORTS_UNIFORM_LOCATION 0')
    usados = set()
    for viejo, nuevo in REEMPLAZOS.items():
        # la declaración (uniform … nombre[4]; o nombre;) se va; los usos se reemplazan
        t, n = re.subn(r'^[ \t]*(UNITY_UNIFORM[ \t]+|uniform[ \t]+)(\w+[ \t]+)?(highp |mediump |lowp )?\w+[ \t]+'
                       + re.escape(viejo) + r'(\[\d+\])?[ \t]*;[ \t]*$', '', t, flags=re.M)
        if re.search(r'\b' + re.escape(viejo) + r'\b', t):
            t = re.sub(r'\b' + re.escape(viejo) + r'\b', nuevo, t)
            for d in DECLARACIONES:
                if d in nuevo:
                    usados.add(d)
    cab = '\n'.join(DECLARACIONES[d] for d in sorted(usados))
    # las declaraciones van después de las precisiones (si las hay) para no chocar con ellas
    m = re.search(r'^precision .*$', t, flags=re.M)
    if m:
        ult = list(re.finditer(r'^precision .*$', t, flags=re.M))[-1]
        t = t[:ult.end()] + '\n' + cab + '\n' + t[ult.end():]
    else:
        t = cab + '\n' + t
    return t


def _entradas(crudo):
    n = struct.unpack_from('<I', crudo, 0)[0]
    return [struct.unpack_from('<III', crudo, 4 + 12 * k) for k in range(n)]


def _glsl(crudo, o, l):
    seg = crudo[o:o + l]
    j = seg.find(b'#ifdef VERTEX')
    if j < 0:
        return None
    k = seg.find(b'\x00', j)
    return seg[j:k if k > 0 else len(seg)].decode('utf-8', 'replace')


ESTADO_CULL = {0: 'ambos', 1: 'atras', 2: 'frente'}   # Cull Off/Front/Back → qué caras se ven


def _fv(p):
    try:
        return round(float(p.val), 4)
    except Exception:
        try:
            return round(float(p), 4)
        except Exception:
            return None


class Traductor:
    def __init__(self):
        self.cache = {}

    def blob(self, sh):
        k = id(sh)
        if k not in self.cache:
            plats = list(sh.platforms)
            if GLES3 not in plats:
                self.cache[k] = None
            else:
                i = plats.index(GLES3)
                v = lambda x: x[0] if isinstance(x, list) else x
                off, cl, dl = v(sh.offsets[i]), v(sh.compressedLengths[i]), v(sh.decompressedLengths[i])
                self.cache[k] = lz4.block.decompress(bytes(sh.compressedBlob)[off:off + cl], uncompressed_size=dl)
        return self.cache[k]

    def shader(self, sh, keywords=(), pasada=None):
        """El programa de cada pasada del primer SubShader para esas keywords."""
        crudo = self.blob(sh)
        if crudo is None:
            return None
        ent = _entradas(crudo)
        pf = sh.m_ParsedForm
        nombres_kw = list(pf.m_KeywordNames)
        kw = set(keywords)
        sub = pf.m_SubShaders[0]
        tags_sub = {t[0]: t[1] for t in sub.m_Tags.tags} if hasattr(sub.m_Tags, 'tags') else {}
        pasadas = []
        for pi, ps in enumerate(sub.m_Passes):
            if pasada is not None and pi != pasada:
                continue
            prog = ps.progVertex
            mejor = None
            for tier in prog.m_PlayerSubPrograms:
                for sp in tier:
                    if sp.m_BlobIndex >= len(ent):
                        continue
                    o, l, _ = ent[sp.m_BlobIndex]
                    texto = _glsl(crudo, o, l)
                    if not texto:
                        continue
                    sus = {nombres_kw[i] for i in sp.m_KeywordIndices if i < len(nombres_kw)}
                    puntos = (len(sus & kw), -len(sus - kw), -sp.m_BlobIndex)
                    if mejor is None or puntos > mejor[0]:
                        mejor = (puntos, texto, sorted(sus))
            if mejor is None:
                continue
            vs, fs = _seccion(mejor[1], 'VERTEX'), _seccion(mejor[1], 'FRAGMENT')
            if not vs or not fs:
                continue
            st = ps.m_State
            rt = st.rtBlend[0] if hasattr(st, 'rtBlend') else st.rtBlend0
            tags = {t[0]: t[1] for t in st.m_Tags.tags} if hasattr(st.m_Tags, 'tags') else {}
            tags = {**tags_sub, **tags}
            pasadas.append({
                'vs': traducir(vs), 'fs': traducir(fs), 'keywords': mejor[2],
                'estado': {
                    'blend': [_fv(rt.srcBlend), _fv(rt.destBlend), _fv(rt.srcBlendAlpha), _fv(rt.destBlendAlpha)],
                    'op': _fv(rt.blendOp), 'zwrite': _fv(st.zWrite), 'ztest': _fv(st.zTest),
                    'cull': _fv(st.culling), 'colmask': _fv(rt.colMask),
                    'ofs': [_fv(st.offsetFactor), _fv(st.offsetUnits)],
                },
                'tags': tags, 'nombre': st.m_Name,
            })
        props = {}
        for p in pf.m_PropInfo.m_Props:
            d = getattr(p, 'm_DefTexture', None)
            props[p.m_Name] = {'tipo': p.m_Type,
                               'defecto': [round(getattr(p, f'm_DefValue_{i}_'), 5) for i in range(4)],
                               'tex': getattr(d, 'm_DefaultName', None) if d else None}
        cola = tags_sub.get('QUEUE') or tags_sub.get('Queue')
        return {'nombre': pf.m_Name, 'pasadas': pasadas, 'props': props, 'cola': cola}

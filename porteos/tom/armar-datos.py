#!/usr/bin/env python3
"""My Talking Tom (Outfit7, com.outfit7.mytalkingtomfree 26.5.0.9550) → los datos de la versión web.

    python3 -I armar-datos.py TOM.apk SALIDA [--solo tom,anim]

TOM.apk tiene que ser el APK entero, con lib/arm64-v8a/libil2cpp.so (el "universal" de APKMirror;
el base de Google Play sin sus partes no alcanza): los datos del juego (catálogo, máquinas de
estado, eventos de sonido) están en MonoBehaviour de Unity sin descripción de campos, y la única
forma de leerlos es con el código (libil2cpp.so + global-metadata.dat) que dice cómo son.

Necesita UnityPy, TypeTreeGeneratorAPI, numpy, Pillow (portear.sh los instala en su entorno).
Escribe en SALIDA:

  tom/tom-s.glb, tom-m.glb, tom-l.glb   Tom bebé (TomYoung), adolescente (tomTeenLow_CRIG) y
                                        adulto (TomAdult): mallas con piel y su esqueleto, sin
                                        materiales (la página pone los shaders del juego)
  tom/pieles/*.webp                     pelajes (256×512), ropa con su alfa (RGBA), ojos y mapas
  tom/pieles.json                       cada piel del juego (tom/skins/*): shader, texturas y colores
  tom/retarget.json                     lo que el adolescente necesita para usar las animaciones
                                        del adulto (PoseRetarget, TomCharacterAnimationOffset)
  tom/anim.bin, tom/anim.json           las animaciones de Tom (clips legacy), ver animaciones()

Sin fechas ni metadatos adentro: el mismo APK da los mismos bytes.
"""
import argparse
import hashlib
import io
import json
import math
import os
import struct
import sys
import tempfile
import zipfile

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..', '..', 'herramientas', 'unity'))

SHA_PROBADO = 'c8e09283ca3d1df6'   # primeros 16 del sha256 del APK universal 26.5.0.9550 (202605002)
VERSION_UNITY = '6000.0.79f1'


# --------------------------------------------------------------------------- abrir el APK
def abrir(apk, tmp):
    """Saca del APK lo que hace falta y abre data.unity3d con el generador de typetrees."""
    import UnityPy
    from UnityPy.helpers.TypeTreeGenerator import TypeTreeGenerator
    with zipfile.ZipFile(apk) as z:
        nombres = z.namelist()
        if 'lib/arm64-v8a/libil2cpp.so' not in nombres:
            sys.exit('el APK no trae lib/arm64-v8a/libil2cpp.so: hace falta el APK entero (ver arriba)')
        for n in nombres:
            if n.startswith('assets/bin/Data/') or n == 'lib/arm64-v8a/libil2cpp.so':
                z.extract(n, tmp)
    data = os.path.join(tmp, 'assets', 'bin', 'Data')
    env = UnityPy.load(os.path.join(data, 'data.unity3d'))
    g = TypeTreeGenerator(VERSION_UNITY)
    g.load_il2cpp(open(os.path.join(tmp, 'lib', 'arm64-v8a', 'libil2cpp.so'), 'rb').read(),
                  open(os.path.join(data, 'Managed', 'Metadata', 'global-metadata.dat'), 'rb').read())
    base_get = g.get_nodes

    def get_nodes(asm, full):
        # el generador registra los ensamblados sin ".dll" (UnityPy se lo agrega), deja m_Enabled
        # sin alinear (en Unity va alineado a 4) y a los string[] los llama "string" con un Array de
        # string adentro (son vector)
        nodos = base_get(asm[:-4] if asm.endswith('.dll') else asm, full)
        for i, n in enumerate(nodos):
            if n.m_Level == 1 and n.m_Name == 'm_Enabled':
                n.m_MetaFlag |= 0x4000
            if n.m_Type == 'string' and i + 3 < len(nodos) and nodos[i + 1].m_Type == 'Array' \
                    and nodos[i + 3].m_Level == n.m_Level + 2 and nodos[i + 3].m_Type != 'char':
                n.m_Type = 'vector'
        return nodos
    g.get_nodes = get_nodes
    env.typetree_generator = g
    return env, list(env.files.values())[0]


class Datos:
    """El paquete abierto, con búsquedas por ruta de Resources y por nombre."""

    def __init__(self, env, paquete):
        self.env, self.b = env, paquete
        self.res = self.b.files['resources.assets']
        self.contenedor = {}
        for o in self.b.files['globalgamemanagers'].objects.values():
            if o.type.name == 'ResourceManager':
                for ruta, p in o.read().m_Container:
                    self.contenedor.setdefault(ruta, []).append(p)

    def recurso(self, ruta, tipo=None):
        for p in self.contenedor.get(ruta.lower(), []):
            o = p.deref()
            if tipo is None or o.type.name == tipo:
                return o
        return None

    def prefab(self, nombre, archivo='resources.assets'):
        """El Transform raíz de un prefab por nombre."""
        f = self.b.files[archivo]
        for o in f.objects.values():
            if o.type.name == 'Transform':
                t = o.read()
                if t.m_Father.path_id == 0 and t.m_GameObject.read().m_Name == nombre:
                    return t
        raise KeyError(nombre)

    def clase(self, o):
        """La clase (MonoScript) de un MonoBehaviour sin leerlo entero."""
        r = o.reader
        r.Position = o.byte_start
        r.read_int(); r.read_long(); r.read_u_byte(); r.align_stream()
        sc_f, sc_p = r.read_int(), r.read_long()
        f = o.assets_file
        try:
            ext = f.externals[sc_f - 1] if sc_f else None
            return (self.b.files[ext.name] if ext else f).objects[sc_p].read().m_ClassName
        except Exception:
            return None

    def componentes(self, go, clase):
        out = []
        for c in go.m_Component:
            o = c.component.deref()
            if o.type.name == 'MonoBehaviour' and self.clase(o) == clase:
                out.append(o.read_typetree())
        return out


def escribir(ruta, datos):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, 'wb') as f:
        f.write(datos)


def webp(im, calidad=88, sin_perdida=False):
    b = io.BytesIO()
    if sin_perdida:
        im.save(b, 'WEBP', lossless=True, quality=100, method=6, exact=False)
    else:
        im.save(b, 'WEBP', quality=calidad, method=6, alpha_quality=100, exact=False)
    return b.getvalue()


# --------------------------------------------------------------------------- Tom
MODELOS = {'s': 'TomYoung', 'm': 'tomTeenLow_CRIG', 'l': 'TomAdult'}


def tom(d, salida):
    """Los tres Tom en glb (sin materiales), las pieles y lo del adolescente."""
    from gltf import Glb, Exportador
    for k, nombre in MODELOS.items():
        glb = Glb()
        ex = Exportador(glb, con_materiales=False)
        raiz = d.prefab(nombre)
        i = ex.jerarquia(raiz)
        ex.resolver_pieles()
        glb.escena([i])
        ruta = os.path.join(salida, 'tom', f'tom-{k}.glb')
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
        glb.guardar(ruta)
        print(f'  tom-{k}.glb: {len(glb.j["nodes"])} nodos, {len(glb.j["meshes"])} mallas,'
              f' {os.path.getsize(ruta) // 1024} KB {ex.avisos[:3]}', file=sys.stderr)
    pieles(d, salida)
    retarget(d, salida)


def _textura(tex, carpeta, hechas, alfa_de=None):
    """Una textura del juego como WebP en carpeta (una sola vez por nombre). Si alfa_de es otra
    textura, su canal alfa va como alfa de esta (la ropa trae el color y el alfa en dos)."""
    nombre = tex.m_Name + ('+a' if alfa_de is not None else '')
    if nombre in hechas:
        return hechas[nombre]
    im = tex.image
    if alfa_de is not None:
        a = alfa_de.image.convert('RGBA').getchannel('A')
        if a.size != im.size:
            a = a.resize(im.size)
        im = im.convert('RGB')
        im.putalpha(a)
    elif im.mode == 'RGBA' and im.getchannel('A').getextrema()[0] == 255:
        im = im.convert('RGB')
    archivo = nombre.replace('+a', '') + '.webp'
    escribir(os.path.join(carpeta, archivo), webp(im))
    hechas[nombre] = archivo
    return archivo


def pieles(d, salida):
    """tom/skins/* (pelajes, trajes, ojos): el material del cuerpo de cada uno con sus texturas."""
    carpeta = os.path.join(salida, 'tom', 'pieles')
    hechas, out = {}, {}
    rutas = sorted(r for r in d.contenedor if r.startswith('tom/skins/') and '/materials/' not in r)
    for ruta in rutas:
        o = d.recurso(ruta)
        if o is None:
            continue
        nombre = ruta.split('/')[-1]
        if o.type.name == 'Texture2D':               # ojos
            out[nombre] = {'tipo': 'ojos', 'tex': _textura(o.read(), carpeta, hechas)}
            continue
        if o.type.name != 'GameObject':
            continue
        go = o.read()
        t = [c.component.read() for c in go.m_Component if c.component.deref().type.name == 'Transform'][0]
        piel = {'tipo': 'piel', 'partes': {}}
        for h in t.m_Children:
            hg = h.read().m_GameObject.read()
            for c in hg.m_Component:
                cc = c.component.deref()
                if cc.type.name not in ('MeshRenderer', 'SkinnedMeshRenderer'):
                    continue
                for pm in cc.read().m_Materials:
                    m = pm.read()
                    piel['partes'][hg.m_Name] = _material(m, carpeta, hechas)
        out[nombre] = piel
    escribir(os.path.join(salida, 'tom', 'pieles.json'), json.dumps(out, ensure_ascii=False, indent=1).encode())
    total = sum(os.path.getsize(os.path.join(carpeta, f)) for f in os.listdir(carpeta))
    print(f'  pieles: {len(out)} ({len(hechas)} texturas, {total // 1024} KB)', file=sys.stderr)


def _material(m, carpeta, hechas):
    sp = m.m_SavedProperties
    texs = {n: t for n, t in sp.m_TexEnvs if t.m_Texture.path_id}
    mat = {'nombre': m.m_Name, 'shader': m.m_Shader.read().m_ParsedForm.m_Name if m.m_Shader.path_id else None,
           'colores': {n: [round(c.r, 4), round(c.g, 4), round(c.b, 4), round(c.a, 4)] for n, c in sp.m_Colors},
           'floats': {n: round(v, 4) for n, v in sp.m_Floats}, 'texturas': {}, 'keywords': _keywords(m)}
    alfa = texs.pop('_MainTexClothAlpha', None)
    for n, t in texs.items():
        tx = t.m_Texture.read()
        if tx.object_reader.type.name == 'Cubemap':
            mat['texturas'][n] = {'cubo': _cubo(tx, carpeta, hechas)}
            continue
        a = alfa.m_Texture.read() if (n == '_MainTexCloth' and alfa is not None) else None
        info = {'archivo': _textura(tx, carpeta, hechas, a)}
        if (t.m_Scale.x, t.m_Scale.y, t.m_Offset.x, t.m_Offset.y) != (1, 1, 0, 0):
            info['escala'] = [t.m_Scale.x, t.m_Scale.y]
            info['corrimiento'] = [t.m_Offset.x, t.m_Offset.y]
        mat['texturas'][n] = info
    return mat


def _keywords(m):
    """Las keywords del material (DirtyTom elige con ellas de qué UV sale el pelaje y la ropa)."""
    kw = list(getattr(m, 'm_ValidKeywords', None) or [])
    viejo = getattr(m, 'm_ShaderKeywords', None)
    if isinstance(viejo, str):
        kw += [k for k in viejo.split() if k not in kw]
    return kw


def _cubo(tx, carpeta, hechas):
    """Un Cubemap como tira horizontal de 6 caras (+x −x +y −y +z −z)."""
    from PIL import Image
    if tx.m_Name in hechas:
        return hechas[tx.m_Name]
    try:
        caras = tx.images if hasattr(tx, 'images') else None
    except Exception:
        caras = None
    if not caras:
        im = tx.image                                    # UnityPy junta las 6 caras de alto
        n = im.width
        caras = [im.crop((0, i * n, n, (i + 1) * n)) for i in range(6)]
    n = caras[0].width
    tira = Image.new('RGB', (n * 6, n))
    for i, c in enumerate(caras):
        tira.paste(c.convert('RGB'), (i * n, 0))
    archivo = tx.m_Name + '.webp'
    escribir(os.path.join(carpeta, archivo), webp(tira))
    hechas[tx.m_Name] = archivo
    return archivo


def retarget(d, salida):
    """PoseRetarget y TomCharacterAnimationOffset del adolescente, y lo que cada Tom tiene en su raíz."""
    out = {}
    for k, nombre in MODELOS.items():
        t = d.prefab(nombre)
        go = t.m_GameObject.read()
        # los Transform del prefab por path_id, para nombrar las articulaciones
        nombres = {}

        def recorrer(tr, camino):
            g = tr.m_GameObject.read()
            c = camino + [g.m_Name]
            nombres[tr.object_reader.path_id] = g.m_Name
            for h in tr.m_Children:
                recorrer(h.read(), c)
        recorrer(t, [])

        def limpio(x):
            if isinstance(x, dict):
                if set(x) == {'m_FileID', 'm_PathID'}:
                    return nombres.get(x['m_PathID'], x['m_PathID'] or None)
                return {kk: limpio(v) for kk, v in x.items() if kk not in ('m_GameObject', 'm_Script', 'm_Enabled', 'm_Name')}
            if isinstance(x, list):
                return [limpio(v) for v in x]
            if isinstance(x, float):
                return round(x, 6)
            return x
        info = {}
        for clase in ('PoseRetarget', 'TomCharacterAnimationOffset', 'TomsAnimationController', 'TomModelController'):
            cs = d.componentes(go, clase)
            if cs:
                info[clase] = limpio(cs[0])
        out[k] = info
    escribir(os.path.join(salida, 'tom', 'retarget.json'), json.dumps(out, ensure_ascii=False, indent=1).encode())


# --------------------------------------------------------------------------- animaciones
FPS = 30
TOL_ROT = 0.003       # error máximo por componente del cuaternión (~0,34°)
TOL_POS = 0.03        # error máximo en posiciones (unidades del modelo: centímetros; Tom mide ~100)


def _hermite(claves, tiempos, ncomp):
    """Una curva de Unity en los tiempos pedidos, como AnimationCurve::Evaluate (Hermite con las
    pendientes de cada clave; pendiente infinita = escalón; fuera del rango se queda en el extremo)."""
    t_k = np.array([k.time for k in claves])
    def comps(v):
        return [v.x, v.y, v.z, v.w][:ncomp] if hasattr(v, 'w') and ncomp == 4 else [v.x, v.y, v.z][:ncomp]
    val = np.array([comps(k.value) for k in claves], dtype=np.float64)
    ins = np.array([comps(k.inSlope) for k in claves], dtype=np.float64)
    outs = np.array([comps(k.outSlope) for k in claves], dtype=np.float64)
    out = np.empty((len(tiempos), ncomp))
    if len(claves) == 1:
        out[:] = val[0]
        return out
    j = np.clip(np.searchsorted(t_k, tiempos, side='right') - 1, 0, len(claves) - 2)
    t0, t1 = t_k[j], t_k[j + 1]
    dt = t1 - t0
    s = np.where(dt > 0, (tiempos - t0) / np.where(dt > 0, dt, 1), 0)[:, None]
    s2, s3 = s * s, s * s * s
    m0 = outs[j] * dt[:, None]
    m1 = ins[j + 1] * dt[:, None]
    escalon = ~np.isfinite(m0) | ~np.isfinite(m1)
    m0 = np.where(escalon, 0, m0); m1 = np.where(escalon, 0, m1)
    v = (2 * s3 - 3 * s2 + 1) * val[j] + (s3 - 2 * s2 + s) * m0 + (s3 - s2) * m1 + (-2 * s3 + 3 * s2) * val[j + 1]
    v = np.where(escalon, val[j], v)
    out[:] = v
    out[tiempos <= t_k[0]] = val[0]
    out[tiempos >= t_k[-1]] = val[-1]
    return out


def _reducir(m, tol, cuat):
    """Índices de las claves que alcanzan para rehacer m (frames × comps) interpolando entre ellas
    (lineal; para cuaterniones, lineal y normalizado) con error menor a tol."""
    n = len(m)
    claves = [0]
    i = 0
    while i < n - 1:
        j = i + 1
        mejor = j
        while j < n:
            # ¿alcanza la recta i→j para todos los del medio?
            if j > i + 1:
                f = (np.arange(i + 1, j) - i) / (j - i)
                aprox = m[i] + (m[j] - m[i]) * f[:, None]
                if cuat:
                    aprox /= np.linalg.norm(aprox, axis=1, keepdims=True)
                if np.abs(aprox - m[i + 1:j]).max() > tol:
                    break
            mejor = j
            j += 1
        claves.append(mejor)
        i = mejor
    return claves


def animaciones(d, salida):
    """Los clips legacy de Tom (los de su esqueleto: 93 huesos) en un solo binario.

    anim.json: {"huesos": [nombre...], "fps": 30, "clips": {nombre: {"dur", "frames", "wrap",
    "eventos": [[t, función, texto, entero, float]...], "ofs": byte, "len": bytes}}}

    anim.bin, por clip, sus canales (little-endian):
      u16 hueso, u8 tipo (0 rotación, 1 posición, 2 escala), u8 n claves (0 = constante),
      constante: f32 × comps; si no: u16 n claves, [pos/escala: f32 mín × comps, f32 máx × comps],
      u8 salto de frame × (n − 1) (la primera clave es el frame 0), y los valores cuantizados en
      16 bits (rotación: componente × 32767; pos/escala: entre mín y máx) como diferencias con la
      clave anterior (i16, módulo 65536), clave por clave × comps.
    Todo en mano derecha (glTF): posiciones (−x, y, z), rotaciones (x, −y, −z, w). Los clips se
    muestrean a 30 cuadros como Unity (Hermite) y se guardan sólo las claves que hacen falta para
    rehacerlos interpolando con error de ~0,34° y 0,3 mm.
    """
    huesos, idx = [], {}
    cuerpo = bytearray()
    clips = {}
    stats = [0, 0]
    for pid, o in sorted(d.res.objects.items()):
        if o.type.name != 'AnimationClip':
            continue
        c = o.read()
        if len(c.m_RotationCurves) < 60:
            continue
        fin = 0.0
        for lista in (c.m_RotationCurves, c.m_PositionCurves, c.m_ScaleCurves):
            for x in lista:
                if x.curve.m_Curve:
                    fin = max(fin, x.curve.m_Curve[-1].time)
        n = max(1, int(round(fin * FPS)) + 1)
        tiempos = np.minimum(np.arange(n) / FPS, fin)
        ofs = len(cuerpo)
        canales = 0
        for tipo, lista, ncomp in ((0, c.m_RotationCurves, 4), (1, c.m_PositionCurves, 3), (2, c.m_ScaleCurves, 3)):
            for x in lista:
                k = x.curve.m_Curve
                if not k:
                    continue
                nombre = x.path.split('/')[-1]
                if nombre not in idx:
                    idx[nombre] = len(huesos)
                    huesos.append(nombre)
                m = _hermite(k, tiempos, ncomp)
                if tipo == 0:
                    m /= np.linalg.norm(m, axis=1, keepdims=True)
                    m *= np.array([1, -1, -1, 1])
                    for i in range(1, len(m)):           # mismo hemisferio que el anterior
                        if np.dot(m[i], m[i - 1]) < 0:
                            m[i] = -m[i]
                elif tipo == 1:
                    m *= np.array([-1, 1, 1])
                cuerpo += struct.pack('<HB', idx[nombre], tipo)
                canales += 1
                if np.abs(m - m[0]).max() < (1e-5 if tipo else 1e-6):
                    cuerpo += struct.pack('<B', 0) + struct.pack(f'<{ncomp}f', *m[0])
                    continue
                cl = _reducir(m, TOL_ROT if tipo == 0 else TOL_POS, tipo == 0)
                # saltos de más de 255 cuadros: claves intermedias (el salto va en un byte)
                cl2 = [cl[0]]
                for f in cl[1:]:
                    while f - cl2[-1] > 255:
                        cl2.append(cl2[-1] + 255)
                    cl2.append(f)
                cl = cl2
                stats[0] += len(cl); stats[1] += n
                cuerpo += struct.pack('<BH', 1, len(cl))
                v = m[cl]
                if tipo == 0:
                    q = np.round(v * 32767).astype(np.int64)
                else:
                    mn, mx = v.min(axis=0), v.max(axis=0)
                    rango = np.where(mx > mn, mx - mn, 1)
                    q = np.round((v - mn) / rango * 65535).astype(np.int64)
                    cuerpo += struct.pack(f'<{ncomp}f', *mn) + struct.pack(f'<{ncomp}f', *mx)
                cuerpo += bytes(np.diff(cl).astype(np.uint8))
                dq = np.diff(q, axis=0, prepend=np.zeros((1, ncomp), dtype=np.int64))
                cuerpo += (dq & 0xFFFF).astype('<u2').tobytes()
        while len(cuerpo) % 4:
            cuerpo.append(0)
        eventos = [[round(e.time, 4), e.functionName, e.data, e.intParameter, round(e.floatParameter, 4)]
                   for e in c.m_Events]
        clips[c.m_Name] = {'dur': round(fin, 4), 'frames': n, 'wrap': c.m_WrapMode, 'canales': canales,
                           'ofs': ofs, 'len': len(cuerpo) - ofs}
        if eventos:
            clips[c.m_Name]['eventos'] = eventos
    escribir(os.path.join(salida, 'tom', 'anim.bin'), bytes(cuerpo))
    escribir(os.path.join(salida, 'tom', 'anim.json'),
             json.dumps({'fps': FPS, 'huesos': huesos, 'clips': clips}, ensure_ascii=False).encode())
    print(f'  animaciones: {len(clips)} clips, {len(huesos)} huesos, {len(cuerpo) // 1024} KB'
          f' (claves {stats[0]} de {stats[1]} cuadros)', file=sys.stderr)


# --------------------------------------------------------------------------- la casa
CUARTOS = {'living': 'level3', 'cocina': 'level4', 'dormitorio': 'level6', 'bano': 'level9'}


class Salidas:
    """Un Exportador que se reusa para varios glb (las texturas, en una carpeta común, una sola vez)."""

    def __init__(self, carpeta_tex):
        from gltf import Exportador
        self.ex = Exportador(None, materiales_unity=True, carpeta_tex=carpeta_tex, uv_unity=True, calidad_webp=88)

    def glb(self, raices, ruta):
        from gltf import Glb
        g = Glb()
        ex = self.ex
        ex.glb, ex.mallas, ex.mats, ex.nodo_de, ex.pieles = g, {}, {}, {}, []
        nodos = [x for x in (ex.jerarquia(t) for t in raices) if x is not None]
        ex.resolver_pieles()
        g.escena(nodos)
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
        g.guardar(ruta)
        return g


def _raices(f):
    out = []
    for o in f.objects.values():
        if o.type.name in ('Transform', 'RectTransform'):
            t = o.read()
            if t.m_Father.path_id == 0:
                out.append(t)
    return out


def _tiene(go, tipo):
    for c in go.m_Component:
        try:
            if c.component.deref().type.name == tipo:
                return True
        except Exception:
            pass
    return False


def casa(d, salida):
    """Los cuatro cuartos (sus objetos raíz menos la interfaz) y los muebles del catálogo, en glb con
    los materiales del juego como extras; las texturas en casa/tex; los shaders traducidos en
    casa/shaders.json."""
    base = os.path.join(salida, 'casa')
    sal = Salidas(os.path.join(base, 'tex'))
    for nombre, nivel in CUARTOS.items():
        f = d.b.files[nivel]
        raices = [t for t in _raices(f) if not _tiene(t.m_GameObject.read(), 'Canvas')]
        g = sal.glb(raices, os.path.join(base, f'{nombre}.glb'))
        print(f'  {nombre}: {len(g.j["nodes"])} nodos, {len(g.j["meshes"])} mallas', file=sys.stderr)
    # muebles: los prefabs del catálogo y las texturas (paredes, pisos, azulejos, manteles)
    muebles = json.load(open(os.path.join(AQUI, 'muebles.json')))
    indice = {}
    hechos = {}
    for item, m in muebles.items():
        ruta = m.get('recurso')
        if not ruta:
            continue
        o = d.recurso(ruta)
        if o is None:
            print(f'  falta {ruta} ({item})', file=sys.stderr)
            continue
        if o.type.name == 'GameObject':
            if ruta not in hechos:
                go = o.read()
                t = [c.component.read() for c in go.m_Component if c.component.deref().type.name == 'Transform'][0]
                archivo = 'muebles/' + ruta.split('/')[-1] + '.glb'
                sal.glb([t], os.path.join(base, archivo))
                hechos[ruta] = {'glb': archivo}
            indice[item] = dict(hechos[ruta])
        elif o.type.name == 'Texture2D':
            indice[item] = {'tex': sal.ex.textura_archivo(o.read())}
        elif o.type.name == 'Material':
            indice[item] = {'material': sal.ex.material_unity(o.read())}
        indice[item]['tipo'] = m['tipo']
    escribir(os.path.join(base, 'muebles.json'), json.dumps(indice, ensure_ascii=False, indent=0).encode())
    print(f'  muebles: {len(indice)} ({len(hechos)} glb), texturas {len(sal.ex.archivos_tex)}', file=sys.stderr)
    shaders(sal.ex.shaders, os.path.join(base, 'shaders.json'))
    if sal.ex.avisos:
        print('  avisos:', sal.ex.avisos[:8], file=sys.stderr)


def shaders(usados, ruta):
    """Los shaders usados, traducidos para three.js (herramientas/unity/shaders.py), por keywords."""
    from shaders import Traductor
    tr = Traductor()
    out = {}
    for nombre, (sh, variantes) in sorted(usados.items()):
        for kw in sorted(variantes):
            info = tr.shader(sh, kw)
            if info is None:
                print(f'  sin GLES3: {nombre}', file=sys.stderr)
                continue
            out.setdefault(nombre, {'props': info['props'], 'cola': info['cola'], 'variantes': {}})
            out[nombre]['variantes'][' '.join(kw)] = info['pasadas']
    escribir(ruta, json.dumps(out, ensure_ascii=False).encode())
    print(f'  shaders: {len(out)}', file=sys.stderr)


# --------------------------------------------------------------------------- principal
PARTES = {'tom': tom, 'anim': animaciones, 'casa': casa}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('apk')
    ap.add_argument('salida')
    ap.add_argument('--solo', help='partes separadas por coma: ' + ','.join(PARTES))
    a = ap.parse_args()
    sha = hashlib.sha256(open(a.apk, 'rb').read()).hexdigest()
    if not sha.startswith(SHA_PROBADO):
        print(f'aviso: APK distinto del probado ({sha[:16]}); puede faltar o sobrar algo', file=sys.stderr)
    partes = a.solo.split(',') if a.solo else list(PARTES)
    with tempfile.TemporaryDirectory() as tmp:
        env, b = abrir(a.apk, tmp)
        d = Datos(env, b)
        for p in partes:
            print(f'{p}…', file=sys.stderr)
            PARTES[p](d, a.salida)


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
Las animaciones por defecto del R6 de Roblox, pasadas al muñeco de AEROPLAZA
(js/roblox.js). Lee los KeyframeSequence (el .rbxm binario, con LZ4, o el XML
viejo), arma cada articulación con los C0 y C1 del R6 y la lleva a los ejes del
muñeco (Roblox mira a -z; el muñeco, a +z).

    python3 aeroplaza/herramientas/roblox.py carpeta_con_los_rbxm
"""
import struct, sys, json, math


def lz4_block(src, n):
    out = bytearray(); i = 0
    while i < len(src):
        tok = src[i]; i += 1
        lit = tok >> 4
        if lit == 15:
            while True:
                b = src[i]; i += 1; lit += b
                if b != 255: break
        out += src[i:i + lit]; i += lit
        if i >= len(src): break
        off = src[i] | (src[i + 1] << 8); i += 2
        ml = tok & 15
        if ml == 15:
            while True:
                b = src[i]; i += 1; ml += b
                if b != 255: break
        ml += 4
        st = len(out) - off
        for k in range(ml): out.append(out[st + k])
    assert len(out) == n, (len(out), n)
    return bytes(out)


def deint(b, n, w=4):
    return [bytes(b[k * n + i] for k in range(w)) for i in range(n)]


def rfloat(bs):
    u = struct.unpack('>I', bs)[0]; u = ((u >> 1) | (u << 31)) & 0xffffffff
    return struct.unpack('>f', struct.pack('>I', u))[0]


def zz(u): return (u >> 1) ^ -(u & 1)


def refs(b, n):
    v = [zz(struct.unpack('>I', x)[0]) for x in deint(b, n)]
    acc = 0; out = []
    for x in v: acc += x; out.append(acc)
    return out


# las rotaciones especiales del CFrame (id -> ejes), de la especificación
ESPECIALES = {}
def _esp():
    vs = [(1, 0, 0), (0, 1, 0), (0, 0, 1), (-1, 0, 0), (0, -1, 0), (0, 0, -1)]
    ids = [0x02, 0x03, 0x05, 0x06, 0x07, 0x09, 0x0a, 0x0c, 0x0d, 0x0e, 0x10, 0x11, 0x14, 0x15, 0x17, 0x18, 0x19, 0x1b, 0x1c, 0x1e, 0x1f, 0x20, 0x22, 0x23]
    k = 0
    for a in range(6):
        for b in range(6):
            if a % 3 == b % 3: continue
            if k >= len(ids): break
            x, y = vs[a], vs[b]
            z = (x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0])
            # id = 6*a + b + 1 en la especificación
            ESPECIALES[6 * a + b + 1] = [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]]
            k += 1
_esp()


def leer(path):
    d = open(path, 'rb').read()
    assert d[:8] == b'<roblox!'
    nclases, ninst = struct.unpack('<ii', d[16:24])
    i = 32
    clases = {}; props = {}; padres = {}
    while i < len(d):
        nombre = d[i:i + 4].decode(); cl, ul = struct.unpack('<II', d[i + 4:i + 12]); i += 16
        if cl == 0: datos = d[i:i + ul]; i += ul
        else: datos = lz4_block(d[i:i + cl], ul); i += cl
        if nombre == 'END\x00': break
        if nombre == 'INST':
            cid = struct.unpack('<I', datos[:4])[0]; L = struct.unpack('<I', datos[4:8])[0]; cn = datos[8:8 + L].decode()
            j = 8 + L + 1; n = struct.unpack('<I', datos[j:j + 4])[0]; j += 4
            clases[cid] = (cn, refs(datos[j:j + 4 * n], n))
        elif nombre == 'PROP':
            cid = struct.unpack('<I', datos[:4])[0]; L = struct.unpack('<I', datos[4:8])[0]; pn = datos[8:8 + L].decode()
            j = 8 + L; t = datos[j]; j += 1
            cn, rs = clases[cid]; n = len(rs); b = datos[j:]
            vals = None
            if t == 0x01:
                vals = []; q = 0
                for _ in range(n): L2 = struct.unpack('<I', b[q:q + 4])[0]; vals.append(b[q + 4:q + 4 + L2].decode('utf8', 'replace')); q += 4 + L2
            elif t == 0x02: vals = [bool(x) for x in b[:n]]
            elif t == 0x04: vals = [rfloat(x) for x in deint(b, n)]
            elif t == 0x12: vals = [struct.unpack('>I', x)[0] for x in deint(b, n)]
            elif t == 0x10:
                q = 0; rots = []
                for _ in range(n):
                    ident = b[q]; q += 1
                    if ident == 0: rots.append(list(struct.unpack('<9f', b[q:q + 36]))); q += 36
                    else: rots.append(ESPECIALES.get(ident, [1, 0, 0, 0, 1, 0, 0, 0, 1]))
                xs = [rfloat(x) for x in deint(b[q:], n)]; q += 4 * n
                ys = [rfloat(x) for x in deint(b[q:], n)]; q += 4 * n
                zs = [rfloat(x) for x in deint(b[q:], n)]
                vals = [{'R': rots[k], 'p': [xs[k], ys[k], zs[k]]} for k in range(n)]
            if vals is not None:
                for r, v in zip(rs, vals): props.setdefault(r, {'_clase': cn})[pn] = v
            for r in rs: props.setdefault(r, {'_clase': cn})
        elif nombre == 'PRNT':
            n = struct.unpack('<I', datos[1:5])[0]
            hijos = refs(datos[5:5 + 4 * n], n); pp = refs(datos[5 + 4 * n:5 + 8 * n], n)
            for h, p in zip(hijos, pp): padres[h] = p
    return props, padres


def secuencia(path):
    props, padres = leer(path)
    hijos = {}
    for h, p in padres.items(): hijos.setdefault(p, []).append(h)
    kfs = sorted([r for r, v in props.items() if v['_clase'] == 'Keyframe'], key=lambda r: props[r].get('Time', 0))
    seq = [r for r, v in props.items() if v['_clase'] == 'KeyframeSequence']
    out = {'loop': props[seq[0]].get('Loop') if seq else None, 'claves': []}
    for k in kfs:
        poses = {}
        def bajar(r):
            for h in hijos.get(r, []):
                v = props[h]
                if v['_clase'] == 'Pose':
                    poses[v.get('Name')] = {'R': v['CFrame']['R'], 'p': v['CFrame']['p'], 'peso': v.get('Weight'), 'estilo': v.get('EasingStyle'), 'dir': v.get('EasingDirection')}
                bajar(h)
        bajar(k)
        out['claves'].append({'t': props[k].get('Time'), 'nombre': props[k].get('Name'), 'poses': poses})
    return out





def secuencia_xml(path):
    import xml.etree.ElementTree as ET
    raiz = ET.parse(path).getroot()
    def props(it):
        P = {}
        pr = it.find('Properties')
        for e in (pr if pr is not None else []):
            n = e.get('name')
            if e.tag == 'CoordinateFrame':
                v = {c.tag: float(c.text) for c in e}
                P[n] = {'R': [v['R00'], v['R01'], v['R02'], v['R10'], v['R11'], v['R12'], v['R20'], v['R21'], v['R22']], 'p': [v['X'], v['Y'], v['Z']]}
            elif e.tag in ('float', 'double'): P[n] = float(e.text)
            elif e.tag == 'bool': P[n] = e.text == 'true'
            elif e.tag == 'string': P[n] = e.text
            elif e.tag == 'token': P[n] = int(e.text)
        return P
    seq = raiz.find(".//Item[@class='KeyframeSequence']")
    out = {'loop': props(seq).get('Loop'), 'claves': []}
    kfs = [(props(k), k) for k in seq.findall("Item[@class='Keyframe']")]
    kfs.sort(key=lambda x: x[0].get('Time', 0))
    for P, k in kfs:
        poses = {}
        for po in k.iter('Item'):
            if po.get('class') != 'Pose': continue
            q = props(po); poses[q.get('Name')] = {'R': q['CFrame']['R'], 'p': q['CFrame']['p'], 'peso': q.get('Weight'), 'estilo': q.get('EasingStyle'), 'dir': q.get('EasingDirection')}
        out['claves'].append({'t': P.get('Time'), 'nombre': P.get('Name'), 'poses': poses})
    return out

import numpy as np
def M(p, R):
    m = np.eye(4); m[:3, :3] = np.array(R).reshape(3, 3); m[:3, 3] = p; return m
def cf(x, y, z, *r): return M([x, y, z], r)
J = {  # articulación: (padre, C0, C1)  — las del R6 de Roblox
 'Right Arm': ('Torso', cf(1, .5, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0), cf(-.5, .5, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0)),
 'Left Arm': ('Torso', cf(-1, .5, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0), cf(.5, .5, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0)),
 'Right Leg': ('Torso', cf(1, -1, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0), cf(.5, 1, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0)),
 'Left Leg': ('Torso', cf(-1, -1, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0), cf(-.5, 1, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0)),
 'Head': ('Torso', cf(0, 1, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0), cf(0, -.5, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0)),
 'Torso': ('HumanoidRootPart', cf(0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0), cf(0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0)),
}
P = np.diag([-1, 1, -1, 1])   # de Roblox (mira a -z) al muñeco (mira a +z)
def euler_xyz(R):  # la misma que three.js (orden XYZ)
    m13 = R[0, 2]; y = np.arcsin(np.clip(m13, -1, 1))
    if abs(m13) < 0.9999999: x = np.arctan2(-R[1, 2], R[2, 2]); z = np.arctan2(-R[0, 1], R[0, 0])
    else: x = np.arctan2(R[2, 1], R[1, 1]); z = 0
    return [x, y, z]
def pose(c, nombre):
    if nombre not in c['poses']: return np.eye(4)
    q = c['poses'][nombre]; return M(q['p'], q['R'])
def convertir(path):
    d = (secuencia_xml(path) if open(path, "rb").read(8) != b"<roblox!" else secuencia(path)); out = []
    for c in d['claves']:
        f = {'t': round(c['t'], 4)}
        for n, (pa, C0, C1) in J.items():
            L = C0 @ pose(c, n) @ np.linalg.inv(C1)          # la parte respecto de su padre
            if n != 'Torso':
                # la pieza en reposo respecto del torso (sin la pose), para quedarse solo con el giro
                L0 = C0 @ np.linalg.inv(C1)
                Rrel = L[:3, :3] @ L0[:3, :3].T
            else:
                L0 = C0 @ np.linalg.inv(C1); Rrel = L[:3, :3] @ L0[:3, :3].T
            Rn = P[:3, :3] @ Rrel @ P[:3, :3]
            f[n] = [round(float(a), 4) for a in euler_xyz(Rn)]
            if n == 'Torso': f['torso_p'] = [round(float(v), 4) for v in (P[:3, :3] @ (L[:3, 3] - L0[:3, 3]))]
        out.append(f)
    return {'loop': d['loop'], 'claves': out}


def clip(path, loop=None):
    r = convertir(path); C = r['claves']
    lp = r['loop'] if loop is None else loop
    ks = C[:-1] if lp and len(C) > 2 else C
    R = lambda v: [round(x, 3) + 0.0 for x in v]
    out = []
    for c in ks:
        ra, la, rl, ll, h, to = c['Right Arm'], c['Left Arm'], c['Right Leg'], c['Left Leg'], c['Head'], c['Torso']
        # (brazos[0] del muñeco es el derecho: está en -x, que mirando a +z es la derecha)
        out.append({'t': round(c['t'], 4), 'bl': R([ra[0], ra[1], ra[2] - 0.2]), 'br': R([la[0], la[1], la[2] + 0.2]), 'pl': R(rl), 'pr': R(ll),
                    'hx': round(h[0], 3), 'hy': round(h[1], 3), 'hz': round(h[2], 3), 'ry': round(to[1], 3), 'cx': round(to[0], 3), 'cz': round(to[2], 3), 'cy': round(c['torso_p'][1] * 0.27, 4)})
    return {'dur': round(C[-1]['t'], 4), 'loop': bool(lp), 'denso': True, 'k': out}


if __name__ == '__main__':
    # python3 herramientas/roblox.py carpeta   (con walk.rbxm, idle.rbxm, idle2.rbxm, jump.rbxm, fall.rbxm y sit.rbxm bajados de
    # https://assetdelivery.roblox.com/v1/asset/?id=…): imprime el objeto RBX de js/roblox.js
    import gzip, os
    d = sys.argv[1]
    for n in [f for f in os.listdir(d) if f.endswith('.rbxm')]:
        p = os.path.join(d, n); b = open(p, 'rb').read()
        if b[:2] == bytes([0x1f, 0x8b]): open(p, 'wb').write(gzip.decompress(b))
    C = {'rbxCamina': clip(d + '/walk.rbxm'), 'rbxQuieto': clip(d + '/idle.rbxm'), 'rbxQuieto2': clip(d + '/idle2.rbxm'), 'rbxSalta': clip(d + '/jump.rbxm', False), 'rbxCae': clip(d + '/fall.rbxm')}
    s = clip(d + '/sit.rbxm', True); C['rbxSienta'] = {'dur': 2.0, 'loop': True, 'denso': True, 'k': [s['k'][0]]}
    print(json.dumps(C, separators=(',', ':')))

# Exporta FNaF 2 (Clickteam Fusion 2.5) a web/datos: juego.json (pantallas, capas, instancias, objetos y eventos
# decodificados), img/<handle>.webp (a ESC de tamaño) y snd/<handle>.ogg (Opus).
#     python3 -I herr/exportar.py descarga/juego.exe web/datos [sin-img] [sin-snd]
import sys, os, json, struct, io, subprocess, zlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ctf
from ctf import L

ESC, CALIDAD = 0.75, 55

def expresion(d):
    """Parámetro de expresión: [comparación, [fichas]]; ficha = [tipo, num, ...datos]."""
    l = L(d); comp = l.i16(); fichas = []
    while not l.fin():
        a = l.i16(); n = l.i16()
        if a == 0 and n == 0: break
        sz = l.u16(); dat = L(l.b(sz - 6))
        f = [a, n]
        if a == -1 and n == 0: f.append(dat.i32())
        elif a == -1 and n == 3: f.append(dat.wstr())
        elif a == -1 and n == 23: f.append(dat.f64())
        elif a in (-1, 0, -2, -3, -4, -5, -6, -7) or sz == 6: f += [x for x in []]
        else:
            f += [dat.u16(), dat.i16()]
            if len(dat.d) - dat.p >= 2: f.append(dat.i16())
        if a == -1 and n == 0: pass
        fichas.append(f)
    return [comp, fichas]

def posicion(l):
    return dict(oiPadre=l.u16(), fl=l.u16(), x=l.i16(), y=l.i16(), pendiente=l.i16(), angulo=l.i16(), dir=l.i32(), tipoPadre=l.i16(), oilPadre=l.i16(), capa=l.i16())

def parametro(cod, d):
    l = L(d)
    if cod in (22, 23, 27, 45, 46, 47, 52, 53, 54, 55, 59, 62, 63): return expresion(d)
    if cod == 1: return dict(oil=l.i16(), oi=l.u16(), tipo=l.i16())
    if cod == 2: return dict(ms=l.i32(), vueltas=l.i32())
    if cod == 6: h = l.i16(); fl = l.u16(); return dict(h=h, fl=fl, nombre=l.wstr())
    if cod == 9:
        p = posicion(l); l.u16(); p['oi'] = l.u16(); return p
    if cod in (10, 14, 15, 25, 26, 29, 32, 50, 57): return [l.i16() if len(d) >= 2 else 0, d.hex()]
    if cod == 16: return posicion(l)
    if cod == 24: return list(d[:4])
    if cod == 44: return d.hex()
    return d.hex()

def evento(e):
    r = [e['tipo'], e['num'], e['oi'], e['oil'], e['fl'], e['fl2']]
    return r + [[c, parametro(c, d)] for c, d in e['params']]

def comun(p):
    """ObjectCommon (2.5 b288): offsets de animaciones, contador, extensión y textos; visible al empezar."""
    anim, mov = struct.unpack_from('<HH', p, 4); ext, cnt = struct.unpack_from('<HH', p, 12); datos = struct.unpack_from('<H', p, 36)[0]
    fl = struct.unpack_from('<I', p, 16)[0]; nfl = struct.unpack_from('<H', p, 42)[0]
    return dict(anim=anim, mov=mov, ext=ext, cnt=cnt, datos=datos, fl=fl, nfl=nfl, ident=p[46:50].decode('latin1'))

def animaciones(p, a):
    n = struct.unpack_from('<h', p, a + 2)[0]; offs = struct.unpack_from('<%dh' % n, p, a + 4); r = {}
    for k, of in enumerate(offs):
        if not of: continue
        b = a + of; dirs = struct.unpack_from('<32h', p, b); ds = {}
        for dd, df in enumerate(dirs):
            if not df: continue
            c = b + df; mn, mx, rep, back, nf = struct.unpack_from('<BBhhh', p, c)
            ds[dd] = dict(vmin=mn, vmax=mx, rep=rep, vuelve=back, cuadros=list(struct.unpack_from('<%dH' % nf, p, c + 8)))
        r[k] = ds
    return r

def movimientos(p, m):
    """Movimientos del objeto: tipo (0 quieto, 3 ocho direcciones, 4 pelota, 5 trayectoria), arranque y datos."""
    n = struct.unpack_from('<i', p, m)[0]; r = []
    for k in range(n):
        _nom, _id, dof, dsz = struct.unpack_from('<iiii', p, m + 4 + 16 * k)
        d = p[m + dof:m + dof + dsz]
        ctl, tipo, mueve, opt = struct.unpack_from('<hhBB', d, 0); dirIni = struct.unpack_from('<I', d, 8)[0]
        x = dict(t=tipo, ctl=ctl, mueve=mueve, opt=opt, dir=dirIni)
        q = d[12:]
        if tipo == 5:
            nn, vmin, vmax, bucle, repos, rev = struct.unpack_from('<hhhBBB', q, 0); o = 10; pasos = []
            for _ in range(nn):
                sig = q[o + 1]; vel, dr, dx, dy, cs, sn, lg, pausa = struct.unpack_from('<BBhhhhhh', q, o + 2)
                pasos.append(dict(v=vel, dir=dr, dx=dx, dy=dy, l=lg, pausa=pausa)); o += sig
            x.update(vmin=vmin, vmax=vmax, bucle=bucle, repos=repos, rev=rev, pasos=pasos)
        elif tipo in (3, 4): x['crudo'] = q.hex(); x['v'] = list(struct.unpack_from('<%dh' % min(8, len(q) // 2), q, 0))
        r.append(x)
    return r

def fuentes(t):
    d = dict(t).get(0x6667)
    if not d: return {}
    l = L(d); n = l.i32(); r = {}
    for _ in range(n):
        h = l.i32() - 1; _dec = l.i32(); comp = l.i32(); x = L(zlib.decompress(l.b(comp)))
        x.b(12); alto = x.i32(); _w = x.i32(); x.i32(); x.i32(); peso = x.i32(); ital = x.u8(); x.b(7)
        r[str(h)] = [alto, peso, ital, x.wstr(32)]
    return r

def objeto(o):
    tp = o['tipo']; p = o.get('props', b''); r = dict(n=o.get('nombre', ''), t=tp, tinta=o['tinta'], tp=o['param'], fl=o['flags'])
    if tp == 1:
        _sz, obst, col, w, h, img = struct.unpack_from('<IHHiiH', p, 0); r.update(w=w, h=h, img=img, obst=obst)
    elif tp == 0:
        r['crudo'] = p.hex()
    elif tp >= 2:
        c = comun(p); r['visible'] = bool(c['nfl'] & 8); r['ident'] = c['ident']; r['cfl'] = c['fl']; r['nfl'] = c['nfl']
        if c['anim']: r['anims'] = animaciones(p, c['anim'])
        movs = movimientos(p, c['mov'])
        if any(m['t'] for m in movs): r['movs'] = movs
        if tp == 7 or tp == 5 or tp == 6:
            if c['cnt']: _s, ini, mn, mx = struct.unpack_from('<hiii', p, c['cnt']); r.update(ini=ini, min=mn, max=mx)
            if c['datos']:
                q = c['datos']; sz, w, h, jug, tipo, fl2, fuente = struct.unpack_from('<iiihhhh', p, q)
                r.update(w=w, h=h, mostrar=tipo, cfl2=fl2)
                if tipo in (1, 4): n = struct.unpack_from('<h', p, q + 20)[0]; r['imgs'] = list(struct.unpack_from('<%dH' % n, p, q + 22))
                else: r['color'] = list(p[q + 20:q + 24]); r['fuente'] = fuente
        elif tp == 3:
            q = c['datos']; sz, w, h, n = struct.unpack_from('<iiii', p, q); offs = struct.unpack_from('<%di' % n, p, q + 16); ps = []
            for of in offs:
                k = L(p, q + of); fuente = k.u16(); fl3 = k.u16(); color = list(k.b(4)); ps.append(dict(fuente=fuente, fl=fl3, color=color, texto=k.wstr()))
            r.update(w=w, h=h, parrafos=ps)
        elif tp >= 32:
            q = c['ext'];
            if q: sz = struct.unpack_from('<i', p, q)[0]; r['ext'] = p[q:q + max(0, sz)].hex()
    return r

def frame(x):
    sub = dict(ctf.trozos(x)[0]); r = {}
    l = L(sub[0x3334]); r.update(w=l.i32(), h=l.i32(), fondo=list(l.b(4)), fl=l.u32())
    r['nombre'] = L(sub[0x3335]).wstr()
    l = L(sub[0x3341]); n = l.i32(); capas = []
    for _ in range(n):
        fl = l.u32(); xc = l.f32(); yc = l.f32(); l.i32(); l.i32(); capas.append(dict(fl=fl, xc=xc, yc=yc, n=l.wstr()))
    r['capas'] = capas
    l = L(sub[0x3338]); n = l.i32(); r['inst'] = []
    for _ in range(n):
        h, oi, x_, y_, tpp, hp, capa, _u = struct.unpack_from('<HHiihhhh', l.d, l.p); l.p += 20
        r['inst'].append(dict(h=h, oi=oi, x=x_, y=y_, capa=capa, padre=[tpp, hp]))
    for c, k in ((0x333B, 'fadeIn'), (0x333C, 'fadeOut')):
        if c in sub: q = L(sub[c]); q.b(8); r[k] = dict(ms=q.i32(), fl=q.i32(), color=list(q.b(4)))
    if 0x333D in sub:
        cab, gs = ctf.eventos(sub[0x333D])
        r['qual'] = cab['qual']
        r['eventos'] = [dict(fl=g['fl'], c=[evento(e) for e in g['conds']], a=[evento(e) for e in g['accs']]) for g in gs]
    return r

def main():
    exe, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    t = ctf.abrir(exe); g = dict(t)
    ah = g[0x2223]; w, h = struct.unpack_from('<hh', ah, 12); nfr, fps = struct.unpack_from('<ii', ah, len(ah) - 16)
    J = dict(app=dict(w=w, h=h, fps=fps, titulo=L(g[0x2224]).wstr()),
             handles=list(struct.unpack_from('<%dh' % (len(g[0x222B]) // 2), g[0x222B])),
             frames=[frame(x) for c, x in t if c == 0x3333],
             objetos={str(k): objeto(o) for k, o in ctf.objetos(t).items()}, fuentes=fuentes(t))
    I = ctf.imagenes(t)
    J['imgs'] = {str(k): [v['w'], v['h'], v['hx'], v['hy'], v['ax'], v['ay']] for k, v in I.items()}
    S = ctf.sonidos(t)
    J['sonidos'] = {str(k): v[0] for k, v in S.items()}
    json.dump(J, open(os.path.join(out, 'juego.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('juego.json', os.path.getsize(os.path.join(out, 'juego.json')) // 1024, 'KB')
    if 'sin-img' not in sys.argv:
        from PIL import Image
        os.makedirs(os.path.join(out, 'img'), exist_ok=True); tot = 0
        for k, v in I.items():
            a = ctf.rgba(v); im = Image.fromarray(a, 'RGBA')
            if v['w'] >= 200 or v['h'] >= 200:
                im = im.resize((max(1, round(v['w'] * ESC)), max(1, round(v['h'] * ESC))), Image.LANCZOS)
            if a[:, :, 3].min() == 255: im = im.convert('RGB')
            dest = os.path.join(out, 'img', '%d.webp' % k)
            im.save(dest, 'WEBP', quality=CALIDAD if im.width >= 150 else 90, method=6); tot += os.path.getsize(dest)
        print('imágenes', len(I), round(tot / 1048576, 1), 'MB')
    if 'sin-snd' not in sys.argv:
        os.makedirs(os.path.join(out, 'snd'), exist_ok=True); tot = 0
        for k, (n, d) in S.items():
            dest = os.path.join(out, 'snd', '%d.ogg' % k)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', '-', '-ac', '1', '-c:a', 'libopus', '-b:a', '40k', dest], input=d, check=True)
            tot += os.path.getsize(dest)
        print('sonidos', len(S), round(tot / 1048576, 1), 'MB')
main()

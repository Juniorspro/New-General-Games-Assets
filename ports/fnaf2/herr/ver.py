# Muestra los eventos de un frame de web/datos/juego.json en texto corto.   python3 herr/ver.py <frame> [desde] [hasta]
import json, sys
J = json.load(open('web/datos/juego.json'))
O = J['objetos']
def on(oi): return O.get(str(oi), {}).get('n', '?%d' % oi)
def ex(p):
    if not isinstance(p, list) or len(p) != 2 or not isinstance(p[1], list): return str(p)
    r = []
    for f in p[1]:
        a, n = f[0], f[1]
        if a == -1 and n == 0: r.append(str(f[2]))
        elif a == -1 and n == 3: r.append(repr(f[2]))
        elif a == -1 and n == 23: r.append(str(f[2]))
        elif a == -1 and n == -1: r.append('(')
        elif a == -1 and n == -2: r.append(')')
        elif a == -1 and n == -3: r.append(',')
        elif a == -1 and n == 1: r.append('Random(')
        elif a == -1 and n == 4: r.append('Str$(')
        elif a == 0: r.append({2: '+', 4: '-', 6: '*', 8: '/', 10: 'mod'}.get(n, 'op%d' % n))
        elif a >= 2 or a == -7: r.append('%s.e%d%s' % (on(f[2]), n, '[%d]' % f[4] if len(f) > 4 else ''))
        else: r.append('S%d.%d' % (a, n))
    c = ['=', '<>', '<=', '<', '>=', '>'][p[0]] if 0 <= p[0] < 6 else '?'
    return c + ' ' + ' '.join(r)
def prm(c, p):
    if c in (22, 23, 27, 45): return ex(p)
    if c == 1: return 'obj ' + on(p['oi'])
    if c == 2: return '%gs' % (p['ms'] / 1000)
    if c == 6: return 'snd ' + p['nombre']
    if c in (9, 16): return 'pos(%d,%d%s)%s' % (p['x'], p['y'], ' rel ' + on(p['oiPadre']) if p['oiPadre'] != 65535 else '', ' crear ' + on(p['oi']) if 'oi' in p else '')
    if c == 26: return 'frame#%d' % p[0]
    if c == 50: return 'alt' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[p[0]] if p[0] < 26 else 'alt%d' % p[0]
    if c in (10, 14, 15, 25, 29, 32, 57): return 'p%d:%d' % (c, p[0])
    return 'p%d:%s' % (c, str(p)[:30])
def ev(e, cond):
    t, n, oi = e[0], e[1], e[2]
    quien = on(oi) if t >= 2 or t == -7 else 'S%d' % t
    neg = '!' if cond and e[5] & 1 else ''
    return '%s%s.%s%d(%s)' % (neg, quien, 'c' if cond else 'a', n, ', '.join(prm(c, p) for c, p in e[6:]))
fr = J['frames'][int(sys.argv[1])]
print('==', fr['nombre'], fr['w'], fr['h'], 'capas', [c['n'] for c in fr['capas']], 'inst', len(fr['inst']))
a = int(sys.argv[2]) if len(sys.argv) > 2 else 0; b = int(sys.argv[3]) if len(sys.argv) > 3 else 10**6
for i, g in enumerate(fr.get('eventos', [])[a:b], a):
    print('%d: %s  =>  %s' % (i, ' & '.join(ev(e, True) for e in g['c']), '; '.join(ev(e, False) for e in g['a'])))

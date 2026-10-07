# Muestra en texto corto el código de una clase ya empaquetada (web/datos/c/X.json).
#     python3 herr/codigo.py web/datos-c2/c/BP_X_C.json [función]
import json, sys
def t(x):
    if not isinstance(x, list): return json.dumps(x, ensure_ascii=False) if not isinstance(x, str) else x
    if not x: return '[]'
    o = x[0]
    if not isinstance(o, str): return '[' + ', '.join(t(a) for a in x) + ']'
    if o in ('l', 'i', 'd'): return x[1]
    if o == 'k': return json.dumps(x[1], ensure_ascii=False).replace('"', '')[:80]
    if o == 'c': return '%s.%s' % (t(x[1]), t(x[2]))
    if o == 'f': return '%s(%s)' % (x[1].split(':')[-1], ', '.join(t(a) for a in x[2]))
    if o == 'm': return '%s.%s(%s)' % (t(x[1]), x[2], ', '.join(t(a) for a in (x[3] if len(x) > 3 else [])))
    if o == '=': return '%s = %s' % (t(x[1]), t(x[2]))
    return o + '(' + ', '.join(t(a) for a in x[1:]) + ')'
d = json.load(open(sys.argv[1]))
for n, f in d['funcs'].items():
    if len(sys.argv) > 2 and sys.argv[2] not in n: continue
    print('== ' + n)
    for i, s in enumerate(f['code']): print('  @%d %s' % (f['ofs'][i] if i < len(f['ofs']) else -1, t(s)[:230]))

# Cuenta tipos de componentes y scripts por escena (para saber qué exportar).
import UnityPy, sys, collections, os
from UnityPy.helpers.TypeTreeGenerator import TypeTreeGenerator
D = sys.argv[1]
g = TypeTreeGenerator('2018.2.21f1'); g.load_local_dll_folder(os.path.join(D, 'Managed'))
env = UnityPy.load(D); env.typetree_generator = g
FILES = {os.path.basename(k): f for k, f in env.files.items() if hasattr(f, 'objects')}
SCR = {}
for n, f in FILES.items():
    for o in f.objects.values():
        if o.type.name == 'MonoScript': d = o.read(); SCR[(n, o.path_id)] = d.m_ClassName
for i in range(7):
    f = FILES.get(f'level{i}')
    if not f: continue
    c = collections.Counter(o.type.name for o in f.objects.values()); s = collections.Counter()
    for o in f.objects.values():
        if o.type.name == 'MonoBehaviour':
            try:
                d = o.read_typetree(); sp = d['m_Script']; af = o.assets_file
                fn = os.path.basename(af.name) if sp['m_FileID'] == 0 else os.path.basename(af.externals[sp['m_FileID'] - 1].path)
                s[SCR.get((fn, sp['m_PathID']), '?')] += 1
            except Exception: s['ERR'] += 1
    print(f'level{i}', dict(c.most_common(25))); print('   scripts', dict(s.most_common(60)))

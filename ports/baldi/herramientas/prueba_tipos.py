import UnityPy, os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tipos import generador
D = sys.argv[1]
env = UnityPy.load(D); env.typetree_generator = generador(D, '2018.2.21f1')
ok = collections.Counter(); mal = collections.Counter()
for k, f in env.files.items():
    if not hasattr(f, 'objects'): continue
    for o in f.objects.values():
        if o.type.name != 'MonoBehaviour': continue
        try: o.read_typetree(check_read=True); ok[os.path.basename(k)] += 1
        except Exception as e: mal[(os.path.basename(k), type(e).__name__, str(e)[:50])] += 1
print('bien', sum(ok.values()), dict(ok)); print('mal', sum(mal.values()), mal.most_common(8))

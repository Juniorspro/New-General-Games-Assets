# Las letras (TTF/OTF de los Font) y el video de la tele (MovieTexture, Theora → WebM).
import UnityPy, sys, os, subprocess, json
DATA, SAL = sys.argv[1], sys.argv[2]
env = UnityPy.load(DATA)
C = json.load(open(os.path.join(SAL, 'comun.json')))
ABR = lambda n: 'm' if n == 'mainData' else 'r' if n.startswith('unity default') else n.replace('sharedassets', 's').replace('.assets', '').replace('level', 'l')
letras = {}
for k, f in env.files.items():
    if not hasattr(f, 'objects'): continue
    n = os.path.basename(k)
    for o in f.objects.values():
        if o.type.name == 'Font':
            d = o.read_typetree(); fd = d.get('m_FontData') or []
            if fd:
                b = bytes(fd); ext = 'otf' if b[:4] == b'OTTO' else 'ttf'
                arch = f"letra-{d['m_Name'].replace(' ', '_')}.{ext}"
                open(os.path.join(SAL, arch), 'wb').write(b); letras[d['m_Name']] = arch
        if o.type.name == 'MovieTexture':
            d = o.read_typetree(); raw = bytes(d.get('m_MovieData') or [])
            idv = f'{ABR(n)}_{o.path_id}'
            crudo = os.path.join(SAL, '..', '..', 'crudo', idv + '.ogv'); open(crudo, 'wb').write(raw)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', crudo, '-an', '-vf', 'scale=320:-2', '-c:v', 'libvpx', '-b:v', '350k', os.path.join(SAL, idv + '.webm')])
            C['texs'].setdefault(idv, {})['video'] = idv + '.webm'
            print('video', d['m_Name'], idv, len(raw))
C['letras'] = letras
json.dump(C, open(os.path.join(SAL, 'comun.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('letras', letras)

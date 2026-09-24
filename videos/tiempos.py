# Los tiempos de cada palabra de cada línea del relato, para los subtítulos tipo karaoke.
# El reconocedor (Vosk, modelo chico en español) da cuándo empieza y termina cada palabra que
# oye; como se equivoca en los nombres raros (vinal, mamboretá), las palabras del guion se
# reparten por la posición de sus letras sobre la línea de tiempo de lo reconocido.
#     python3 videos/tiempos.py <modelo-vosk> videos/medios/voz/<video>/guion.json → escribe lineas.json al lado
import sys, json, subprocess, os
from vosk import Model, KaldiRecognizer, SetLogLevel
SetLogLevel(-1)
modelo, guion = sys.argv[1], sys.argv[2]
G = json.load(open(guion))
base = os.path.dirname(guion)
m = Model(modelo)
out = []
for L in G['lineas']:
    f = os.path.join(base, L['archivo'])
    pcm = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f, '-ar', '16000', '-ac', '1', '-f', 's16le', '-'], capture_output=True).stdout
    r = KaldiRecognizer(m, 16000); r.SetWords(True)
    for i in range(0, len(pcm), 8000): r.AcceptWaveform(pcm[i:i + 8000])
    oidas = json.loads(r.FinalResult()).get('result', [])
    dur = len(pcm) / 32000
    # la línea de tiempo de lo oído, por letras
    marcas, c = [], 0
    for w in oidas:
        marcas.append((c, c + len(w['word']), w['start'], w['end'])); c += len(w['word']) + 1
    total = max(1, c - 1)
    def tiempo(frac):
        if not marcas: return frac * dur
        x = frac * total
        for (a, b, t0, t1) in marcas:
            if x <= b: return t0 + (t1 - t0) * max(0, min(1, (x - a) / max(1, b - a)))
        return marcas[-1][3]
    palabras = L['texto'].split()
    largo = sum(len(p) for p in palabras) + len(palabras) - 1
    pos, lista = 0, []
    for p in palabras:
        t0, t1 = tiempo(pos / largo), tiempo((pos + len(p)) / largo)
        lista.append({'p': p, 't0': round(t0, 3), 't1': round(max(t1, t0 + 0.08), 3)})
        pos += len(p) + 1
    out.append({**L, 'dur': round(dur, 3), 'habla': [round(marcas[0][2], 3) if marcas else 0, round(marcas[-1][3], 3) if marcas else dur], 'palabras': lista, 'oido': ' '.join(w['word'] for w in oidas)})
json.dump({**G, 'lineas': out}, open(os.path.join(base, 'lineas.json'), 'w'), ensure_ascii=False, indent=1)
print('\n'.join(f"{l['archivo']}: {l['dur']} s, habla {l['habla']}" for l in out))

# Las líneas de diálogo del juego (los subtítulos), sacadas de su Assembly-UnityScript.dll en el orden
# en que aparecen (ldstr … stsfld subtitle). El código del port las nombra por número.
#     python -I textos.py <..._Data/Managed/Assembly-UnityScript.dll> <salida/datos/textos.json>
import json, re, subprocess, sys, os
il = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'il.py')
txt = subprocess.run([sys.executable, '-I', il, sys.argv[1]], capture_output=True, text=True).stdout
lineas = []
for x in re.findall(r"ldstr ('(?:[^'\\]|\\.)*'|\"(?:[^\"\\]|\\.)*\") ; stsfld \.subtitle", txt):
    t = eval(x)
    if t and t not in lineas: lineas.append(t)
json.dump(lineas, open(sys.argv[2], 'w'), ensure_ascii=False, indent=0)
print(len(lineas), 'líneas')

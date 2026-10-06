#!/bin/bash
# Exporta y empaqueta un nivel completo: herr/nivel.sh SM_Bedroom
set -e
N=$1; T=$(cd "$(dirname "$0")/.." && pwd); cd $T
UE=herr/ue.sh; MAP=TJoC_SM/Content/FirstPersonBP/Maps
mkdir -p crudo/exp crudo/mallas crudo/tex crudo/lm salida/lm web/datos
$UE exp crudo/exp "$MAP/$N|^ModelComponent_" 2>&1 | grep -E '^MAL' || true
python3 -I herr/nivel.py $N salida/$N.json
python3 -I -c "
import json,os; o=json.load(open('salida/$N.json'))
for r in o['assets']['mallas']+o['assets']['skel']:
  if not os.path.exists('crudo/mallas/'+r.replace('/','~')+'.json'): print(r)" > crudo/$N-mallas.txt
if [ -s crudo/$N-mallas.txt ]; then
  $UE malla crudo/mallas @crudo/$N-mallas.txt 2>&1 | grep '^MAL' | sed 's/^MAL \(.*\): .*/\1/' > crudo/$N-fallan.txt || true
  [ -s crudo/$N-fallan.txt ] && UEVER=GAME_UE4_18 $UE malla crudo/mallas @crudo/$N-fallan.txt 2>&1 | grep -E '^MAL' || true
fi
python3 -I -c "
import json,glob,os
o=json.load(open('salida/$N.json')); s=set(o['assets']['mats'])
for b in o['bsp'] or []:
  if b['mat']: s.add(b['mat'])
for r in o['assets']['mallas']+o['assets']['skel']:
  f='crudo/mallas/'+r.replace('/','~')+'.json'
  if os.path.exists(f): s.update(x for x in json.load(open(f))['mats'] if x)
print('\n'.join(sorted(s)))" > crudo/$N-mats.txt
python3 -I herr/materiales.py crudo/$N-mats.txt salida/$N-mats.json
python3 -I -c "
import json,os
a=json.load(open('salida/mats.json')) if os.path.exists('salida/mats.json') else {}
a.update(json.load(open('salida/$N-mats.json'))); json.dump(a,open('salida/mats.json','w'))
s=set()
for v in a.values():
  for k in ('base','emisivo'):
    if v.get(k) and not os.path.exists('crudo/tex/'+v[k].replace('/','~')+'.png'): s.add(v[k]+'|512')
print('\n'.join(sorted(s)))" > crudo/$N-tex.txt
[ -s crudo/$N-tex.txt ] && $UE tex crudo/tex @crudo/$N-tex.txt 2>&1 | grep -E '^MAL' || true
python3 -I -c "
import json
d=json.load(open('crudo/todo/'+'$MAP/${N}_BuiltData.uasset.json'.replace('/','~')))
for e in d:
  if e['Type']=='LightMapTexture2D' and e['Name'].startswith('HQ_'): print('$MAP/${N}_BuiltData.'+e['Name']+'|8192')
" > crudo/$N-lm.txt
$UE tex crudo/lm @crudo/$N-lm.txt 2>&1 | grep -E '^MAL' || true
python3 -I herr/lightmaps.py $N crudo/lm salida/lm
python3 -I herr/empacar.py $N web/datos

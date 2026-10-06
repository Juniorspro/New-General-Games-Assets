"""MovieScene de UE 4.16 (animaciones de UMG y LevelSequence) → JSON compacto.
Cada binding: {n, guid, clase, pistas:[{t (tipo de pista), prop, secs:[{ini, fin, can:{canal: [[t,v,lleg,sal,modo]]}, extra}]}]}"""
import re

def _idx(ref, pkg):
    if not isinstance(ref, dict): return None
    m = re.match(r'(.*)\.(\d+)$', ref.get('ObjectPath', ''))
    return int(m.group(2)) if m and m.group(1) == pkg else None

def claves(c):
    return [[k.get('Time', 0), k.get('Value', 0), k.get('ArriveTangent', 0), k.get('LeaveTangent', 0), (k.get('InterpMode') or 'RCIM_Cubic')[5:]] for k in (c or {}).get('Keys') or []]

def seccion(e, ref_val):
    pr = e.get('Properties') or {}
    s = {'ini': pr.get('StartTime', 0.0), 'fin': pr.get('EndTime', 0.0), 'can': {}, 'extra': {}}
    if pr.get('bIsInfinite'): s['inf'] = True
    for k, v in pr.items():
        if isinstance(v, dict) and ('Keys' in v or 'DefaultValue' in v) and not ('ObjectPath' in v):
            s['can'][k] = {'k': claves(v), 'd': v.get('DefaultValue')}
        elif k == 'ScalarParameterNamesAndCurves':
            for x in v or []: s['can']['param:' + str(x.get('ParameterName'))] = {'k': claves(x.get('ParameterCurve')), 'd': (x.get('ParameterCurve') or {}).get('DefaultValue')}
        elif k not in ('StartTime', 'EndTime', 'bIsInfinite', 'Easing', 'RowIndex', 'OverlapPriority'):
            s['extra'][k] = ref_val(v)
    return s

def movie_scene(d, mi, pkg, ref_val):
    if mi is None: return None
    ms = d[mi]; pr = ms.get('Properties') or {}
    out = {'bindings': [], 'pistas': [], 'rango': None}
    rng = pr.get('PlaybackRange') or {}
    out['rango'] = [((rng.get('LowerBound') or {}).get('Value') or 0.0), ((rng.get('UpperBound') or {}).get('Value') or 0.0)]
    def pista(tref):
        ti = _idx(tref, pkg)
        if ti is None: return None
        t = d[ti]; tp = t.get('Properties') or {}
        P = {'t': t['Type'].replace('MovieScene', '').replace('Track', ''), 'prop': tp.get('PropertyPath') or tp.get('PropertyName'), 'secs': []}
        for k, lst in tp.items():
            if not isinstance(lst, list) or not k.endswith('Sections'): continue
            for sref in lst:
                si = _idx(sref, pkg)
                if si is not None and d[si]['Type'].endswith('Section'): P['secs'].append(seccion(d[si], ref_val))
        return P
    nombres = {}
    for p in pr.get('Possessables') or []: nombres[p.get('Guid')] = {'n': p.get('Name'), 'clase': (p.get('PossessedObjectClass') or {}).get('ObjectName'), 'padre': p.get('ParentGuid')}
    for p in pr.get('Spawnables') or []: nombres[p.get('Guid')] = {'n': p.get('Name'), 'spawn': ref_val(p.get('ObjectTemplate')), 'clase': None}
    for b in pr.get('ObjectBindings') or []:
        g = b.get('ObjectGuid'); info = nombres.get(g, {})
        out['bindings'].append({'guid': g, 'n': b.get('BindingName') or info.get('n'), 'clase': info.get('clase'), 'padre': info.get('padre'), 'spawn': info.get('spawn'),
                                'pistas': [x for x in (pista(t) for t in b.get('Tracks') or []) if x]})
    for t in pr.get('MasterTracks') or []:
        x = pista(t)
        if x: out['pistas'].append(x)
    if pr.get('CameraCutTrack'):
        x = pista(pr['CameraCutTrack'])
        if x: out['pistas'].append(x)
    return out

"""Exporta un nivel de TJOC:SM (JSON de CUE4Parse) a un JSON compacto para el motor web.
Uso: nivel.py SM_LivingRoom salida.json"""
import sys, json, re, struct, glob, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ue4 import Paquetes, vec, quat_rot, escala, color, r4, clases, ruta_mapa

MAPAS = 'TJoC_SM/Content/FirstPersonBP/Maps/'
P = Paquetes()

def exportar(nombre):
    pkg = ruta_mapa(nombre)
    d = P.paquete(pkg)
    ilvl = next(i for i, e in enumerate(d) if e['Type'] == 'Level')
    def idx(ref):
        if not ref: return None
        m = re.match(r'(.*)\.(\d+)$', ref.get('ObjectPath', ''))
        return int(m.group(2)) if m and m.group(1) == pkg else None
    def outer(e): return idx(e.get('Outer'))
    actores_i = [i for i, e in enumerate(d) if outer(e) == ilvl and e['Type'] not in ('Model', 'ModelComponent', 'Level')]
    hijos = {}
    for i, e in enumerate(d):
        o = outer(e)
        if o is not None: hijos.setdefault(o, []).append(i)
    es_escena = lambda e: 'SceneComponent' in list(clases(P.clase_nativa(e)))
    nodos, actores = [], []
    nodo_de = {}  # índice export → índice nodo
    actor_de = {}
    assets = {'mallas': set(), 'skel': set(), 'mats': set(), 'sonidos': set(), 'anims': set(), 'particulas': set(), 'clases': set()}
    for ai in actores_i:
        actor_de[ai] = len(actores)
        actores.append(None)
    def valor(v):
        """Pasa una propiedad a algo útil: referencias a actores/nodos del nivel, assets, o valor crudo."""
        if isinstance(v, dict) and 'ObjectPath' in v:
            j = idx(v)
            if j is not None:
                if j in actor_de: return {'actor': actor_de[j]}
                if j in nodo_de: return {'nodo': nodo_de[j]}
                return {'export': d[j]['Type'] + ':' + d[j]['Name']}
            t, n = P.nombre(v)
            return {'asset': P.ruta(v), 'tipo': t}
        if isinstance(v, list): return [valor(x) for x in v]
        if isinstance(v, dict): return {k: valor(x) for k, x in v.items()}
        return v
    pendientes = []
    for ai in actores_i:
        a = d[ai]
        comps = [j for j in hijos.get(ai, []) if es_escena(d[j])]
        for j in comps:
            nodo_de[j] = len(nodos); nodos.append({'i': len(nodos)})
        pendientes.append((ai, comps))
    for ai, comps in pendientes:
        a = d[ai]
        raiz = idx(P.prop(a, 'RootComponent'))
        for j in comps:
            c = d[j]; n = nodos[nodo_de[j]]; tipo = P.clase_nativa(c)
            n.update(n=c['Name'], a=actor_de[ai], tipo=tipo)
            if c['Type'] != tipo: n['clase'] = c['Type']
            par = P.prop(c, 'AttachParent')
            pj = idx(par)
            n['p'] = nodo_de.get(pj, -1) if pj is not None else -1
            sk = P.prop(c, 'AttachSocketName')
            if sk and sk != 'None': n['sk'] = sk
            n['t'] = vec(P.prop(c, 'RelativeLocation')); n['r'] = quat_rot(P.prop(c, 'RelativeRotation')); n['s'] = escala(P.prop(c, 'RelativeScale3D'))
            if not P.prop(c, 'bVisible', True): n['vis'] = False
            if P.prop(c, 'bHiddenInGame', False): n['oculto'] = True
            mob = P.prop(c, 'Mobility', clase=tipo)
            if mob: n['mov'] = mob.split('::')[-1][0]  # S/S(tationary)/M
            if mob == 'EComponentMobility::Stationary': n['mov'] = 'E'
            for k in ('bAbsoluteLocation', 'bAbsoluteRotation', 'bAbsoluteScale'):
                if P.prop(c, k, False): n.setdefault('abs', []).append(k[9])
            cl = list(clases(tipo))
            if 'StaticMeshComponent' in cl:
                m = P.prop(c, 'StaticMesh')
                if m: n['malla'] = P.ruta(m); assets['mallas'].add(n['malla'])
                om = P.prop(c, 'OverrideMaterials')
                if om: n['mats'] = [P.ruta(x) if x else None for x in om]; assets['mats'].update(x for x in n['mats'] if x)
                lod = c.get('LODData') or []
                if lod and lod[0].get('MapBuildDataId'): n['lmid'] = lod[0]['MapBuildDataId']
                if not P.prop(c, 'CastShadow', True): n['sinsombra'] = True
                if tipo == 'FoliageInstancedStaticMeshComponent' or 'Instanced' in tipo: n['instancias'] = True
            if 'SkinnedMeshComponent' in cl:
                m = P.prop(c, 'SkeletalMesh')
                if m: n['malla'] = P.ruta(m); assets['skel'].add(n['malla'])
                om = P.prop(c, 'OverrideMaterials')
                if om: n['mats'] = [P.ruta(x) if x else None for x in om]; assets['mats'].update(x for x in n['mats'] if x)
                n['modo'] = (P.prop(c, 'AnimationMode') or '').split('::')[-1]
                ad = P.prop(c, 'AnimationData') or {}
                if ad.get('AnimToPlay'): n['anim'] = P.ruta(ad['AnimToPlay']); assets['anims'].add(n['anim'])
                if 'bSavedLooping' in ad: n['loop'] = ad['bSavedLooping']
                if 'bSavedPlaying' in ad: n['tocando'] = ad['bSavedPlaying']
                if ad.get('SavedPlayRate') not in (None, 1.0): n['vel'] = ad['SavedPlayRate']
                ac = P.prop(c, 'AnimClass') or P.prop(c, 'AnimBlueprintGeneratedClass')
                if ac: n['animbp'] = P.ruta(ac)
            if 'LightComponentBase' in cl:
                n['luz'] = luz = {'tipo': tipo.replace('LightComponent', '')}
                luz['int'] = P.prop(c, 'Intensity', clase=tipo); luz['color'] = color(P.prop(c, 'LightColor', clase=tipo))
                if 'LocalLightComponent' in cl: luz['radio'] = P.prop(c, 'AttenuationRadius', clase=tipo) * 0.01
                if tipo == 'SpotLightComponent':
                    luz['in'] = P.prop(c, 'InnerConeAngle', clase=tipo); luz['out'] = P.prop(c, 'OuterConeAngle', clase=tipo)
                if not P.prop(c, 'bUseInverseSquaredFalloff', True, clase=tipo): luz['exp'] = P.prop(c, 'LightFalloffExponent', clase=tipo)
                if not P.prop(c, 'CastShadows', True, clase=tipo): luz['sinsombra'] = True
                if not P.prop(c, 'bAffectsWorld', True, clase=tipo): luz['apagada'] = True
                if P.prop(c, 'SourceRadius', 0, clase=tipo): luz['fuente'] = P.prop(c, 'SourceRadius', clase=tipo) * 0.01
                lf = P.prop(c, 'LightFunctionMaterial')
                if lf: luz['funcion'] = P.ruta(lf)
                ies = P.prop(c, 'IESTexture')
                if ies: luz['ies'] = P.ruta(ies)
            if 'AudioComponent' in cl:
                s = P.prop(c, 'Sound')
                if s: n['sonido'] = P.ruta(s); assets['sonidos'].add(n['sonido'])
                n['vol'] = P.prop(c, 'VolumeMultiplier', clase=tipo); n['tono'] = P.prop(c, 'PitchMultiplier', clase=tipo)
                n['auto'] = P.prop(c, 'bAutoActivate', clase=tipo)
                at = P.prop(c, 'AttenuationSettings')
                if at: n['aten'] = P.ruta(at)
                if P.prop(c, 'bOverrideAttenuation', False): n['atenov'] = valor(P.prop(c, 'AttenuationOverrides'))
                if P.prop(c, 'bIsUISound', False): n['ui'] = True
            if 'CameraComponent' in cl:
                n['fov'] = P.prop(c, 'FieldOfView', clase=tipo)
                if tipo == 'CineCameraComponent':
                    fb = P.prop(c, 'FilmbackSettings') or {}; lens = P.prop(c, 'CurrentFocalLength')
                    n['cine'] = {'focal': lens, 'ancho': fb.get('SensorWidth', 24.89), 'alto': fb.get('SensorHeight', 18.67)}
                pp = P.prop(c, 'PostProcessSettings')
                if pp: n['pp'] = valor(pp)
            if tipo == 'BoxComponent': n['caja'] = vec(P.prop(c, 'BoxExtent', clase=tipo))
            if tipo == 'SphereComponent': n['radio'] = P.prop(c, 'SphereRadius', clase=tipo) * 0.01
            if tipo == 'CapsuleComponent': n['capsula'] = [P.prop(c, 'CapsuleRadius', clase=tipo) * 0.01, P.prop(c, 'CapsuleHalfHeight', clase=tipo) * 0.01]
            bi = P.prop(c, 'BodyInstance') or {}
            col = {}  # tipo de objeto, perfil y modo de colisión (las trazas "por tipo de objeto" los usan)
            if bi.get('ObjectType'): col['tipo'] = bi['ObjectType']
            if bi.get('CollisionProfileName'): col['perfil'] = bi['CollisionProfileName']
            if bi.get('CollisionEnabled'): col['habil'] = bi['CollisionEnabled'].split('::')[-1]
            if col: n['col'] = col
            if 'ShapeComponent' in cl or 'BrushComponent' in cl:
                if bi.get('CollisionProfileName'): n['perfil'] = bi['CollisionProfileName']
                if bi.get('CollisionEnabled'): n['colision'] = bi['CollisionEnabled'].split('::')[-1]
                if P.prop(c, 'bGenerateOverlapEvents', True) is False: n['sinoverlap'] = True
            if tipo == 'BrushComponent':
                bs = P.prop(c, 'BrushBodySetup')
                if bs:
                    b = P.obj(bs)
                    if b: n['brush'] = valor((b.get('Properties') or {}).get('AggGeom'))
            if tipo == 'TextRenderComponent':
                tx = P.prop(c, 'Text')
                n['texto'] = (tx or {}).get('SourceString') if isinstance(tx, dict) else tx
                n['tam'] = P.prop(c, 'WorldSize', clase=tipo) * 0.01; n['color'] = color(P.prop(c, 'TextRenderColor', clase=tipo))
            if tipo == 'DecalComponent':
                m = P.prop(c, 'DecalMaterial')
                if m: n['decal'] = P.ruta(m); assets['mats'].add(n['decal'])
                n['dtam'] = vec(P.prop(c, 'DecalSize', clase=tipo))
            if tipo == 'ParticleSystemComponent':
                t = P.prop(c, 'Template')
                if t: n['part'] = P.ruta(t); assets['particulas'].add(n['part'])
                n['auto'] = P.prop(c, 'bAutoActivate', True)
            if tipo in ('BillboardComponent', 'MaterialBillboardComponent'):
                el = P.prop(c, 'Elements')
                if el: n['billboard'] = valor(el)
            if tipo == 'WidgetComponent':
                wc = P.prop(c, 'WidgetClass')
                if wc: n['widget'] = P.ruta(wc)
                n['dib'] = valor(P.prop(c, 'DrawSize'))
            if tipo == 'SpringArmComponent':
                n['brazo'] = P.prop(c, 'TargetArmLength', 300) * 0.01
            if tipo == 'SceneCaptureComponent2D':
                tt = P.prop(c, 'TextureTarget')
                if tt: n['captura'] = P.ruta(tt)
                n['fov'] = P.prop(c, 'FOVAngle', 90)
            if tipo == 'ExponentialHeightFogComponent':
                n['niebla'] = {'dens': P.prop(c, 'FogDensity', 0.02), 'caida': P.prop(c, 'FogHeightFalloff', 0.2), 'color': color(P.prop(c, 'FogInscatteringColor', {'R': 0.447, 'G': 0.638, 'B': 1.0}), True),
                               'inicio': P.prop(c, 'StartDistance', 0) * 0.01, 'max': P.prop(c, 'FogMaxOpacity', 1.0)}
            if tipo == 'PostProcessComponent':
                n['pp'] = valor(P.prop(c, 'Settings'))
                n['unbound'] = P.prop(c, 'bUnbound', True)
                n['ppOn'] = P.prop(c, 'bEnabled', True); n['peso'] = P.prop(c, 'BlendWeight', 1.0)
        # El actor
        ac = {'n': a['Name'], 'clase': a['Type']}
        nat = P.clase_nativa(a)
        if nat != a['Type']: ac['nativa'] = nat; assets['clases'].add(re.sub(r"^\w+'(.*)'$", r'\1', a.get('Class', '')))
        if raiz in nodo_de: ac['raiz'] = nodo_de[raiz]
        tags = P.prop(a, 'Tags')
        if tags: ac['tags'] = tags
        if P.prop(a, 'bHidden', False): ac['oculto'] = True
        pr = {}
        for k, v in (a.get('Properties') or {}).items():
            if k in ('RootComponent', 'Tags', 'bHidden', 'ActorLabel', 'FolderPath'): continue
            pr[k] = valor(v)
        if pr: ac['props'] = pr
        if a['Type'] == 'MatineeActor':
            ac['matinee'] = exportar_matinee(d, a, idx, actor_de)
        actores[actor_de[ai]] = ac
    # BSP
    bsp = exportar_bsp(d, pkg, ilvl)
    out = {'nombre': nombre, 'nodos': nodos, 'actores': actores, 'bsp': bsp, 'assets': {k: sorted(v) for k, v in assets.items()}}
    return r4(out)

def curva(c, conv=None):
    """FInterpCurve → [[t, v, llegada, salida, modo]] (v puede ser lista)."""
    out = []
    for p in (c or {}).get('Points') or []:
        def f(x):
            if isinstance(x, dict):
                if 'X' in x: v = [x.get('X', 0), x.get('Y', 0), x.get('Z', 0)] + ([x['W']] if 'W' in x else [])
                elif 'R' in x: v = [x.get('R', 0), x.get('G', 0), x.get('B', 0), x.get('A', 1)]
                else: v = list(x.values())
                return conv(v) if conv else v
            return x
        m = (p.get('InterpMode') or 'CIM_Linear').replace('CIM_', '')
        out.append([p.get('InVal', 0), f(p.get('OutVal')), f(p.get('ArriveTangent')), f(p.get('LeaveTangent')), m])
    return out

def exportar_matinee(d, a, idx, actor_de):
    pr = P.prop(a, 'MatineeData')
    md = d[idx(pr)] if pr and idx(pr) is not None else None
    if not md: return None
    mp = md.get('Properties') or {}
    out = {'len': mp.get('InterpLength', 5.0), 'grupos': []}
    for k in ('bLooping', 'bRewindOnPlay', 'bNoResetOnRewind', 'bRewindIfAlreadyPlaying', 'bPlayOnLevelLoad', 'bForceStartPos', 'ForceStartPosition', 'PlayRate', 'bDisableRadioFilter', 'bHidePlayer', 'bDisableMovementInput', 'bDisableLookAtInput', 'bHideHud', 'bClientSideOnly'):
        v = P.prop(a, k)
        if v is not None: out[k] = v
    out['MatineeControllerName'] = P.prop(a, 'MatineeControllerName')
    gai = {}
    for g in P.prop(a, 'GroupActorInfos') or []:
        gai[g.get('ObjectName')] = [actor_de.get(idx(x)) for x in g.get('Actors') or []]
    cm = lambda v: [v[0] * .01, v[2] * .01, v[1] * .01]
    for gref in mp.get('InterpGroups') or []:
        gi = idx(gref)
        if gi is None: continue
        g = d[gi]; gp = g.get('Properties') or {}
        G = {'n': gp.get('GroupName', g['Name']), 'obj': g['Name'], 'tipo': g['Type'], 'actores': gai.get(g['Name'], []), 'pistas': []}
        if gp.get('GroupAnimSets'): G['animsets'] = [P.ruta(x) for x in gp['GroupAnimSets']]
        for tref in gp.get('InterpTracks') or []:
            ti = idx(tref)
            if ti is None: continue
            t = d[ti]; tp = t.get('Properties') or {}; tt = t['Type']
            if tp.get('bDisableTrack'): continue
            if tt == 'InterpTrackMove':
                pt = {'t': 'mov', 'pos': curva(tp.get('PosTrack'), cm), 'eul': curva(tp.get('EulerTrack')), 'frame': tp.get('MoveFrame', 'IMF_World'), 'rotmodo': tp.get('RotMode', 'IMR_Keyframed')}
                lt = (tp.get('LookupTrack') or {}).get('Points')
                if lt: pt['lookup'] = [[x.get('Time'), x.get('GroupName')] for x in lt]
            elif tt in ('InterpTrackFloatProp', 'InterpTrackBoolProp'):
                pt = {'t': 'fprop', 'prop': tp.get('PropertyName'), 'c': curva(tp.get('FloatTrack'))}
                if tt == 'InterpTrackBoolProp': pt = {'t': 'bprop', 'prop': tp.get('PropertyName'), 'k': [[x.get('Time'), x.get('Value')] for x in tp.get('BoolTrack') or []]}
            elif tt in ('InterpTrackColorProp', 'InterpTrackLinearColorProp', 'InterpTrackVectorProp'):
                pt = {'t': 'cprop', 'prop': tp.get('PropertyName'), 'c': curva(tp.get('VectorTrack') or tp.get('LinearColorTrack'))}
            elif tt == 'InterpTrackSound':
                pt = {'t': 'snd', 'k': [[x.get('Time', 0), x.get('Volume', 1), x.get('Pitch', 1), P.ruta(x.get('Sound'))] for x in tp.get('Sounds') or []],
                      'continuo': tp.get('bContinueSoundOnMatineeEnd', False), 'sinpos': tp.get('bPlayOnReverse', False)}
            elif tt == 'InterpTrackAnimControl':
                pt = {'t': 'anim', 'slot': tp.get('SlotName'), 'k': [[x.get('StartTime', 0), P.ruta(x.get('AnimSeq')), x.get('AnimStartOffset', 0), x.get('AnimEndOffset', 0), x.get('AnimPlayRate', 1), x.get('bLooping', False), x.get('bReverse', False)] for x in tp.get('AnimSeqs') or []]}
            elif tt == 'InterpTrackEvent':
                pt = {'t': 'ev', 'k': [[x.get('Time', 0), x.get('EventName')] for x in tp.get('EventTrack') or []], 'adelante': tp.get('bFireEventsWhenForwards', True), 'atras': tp.get('bFireEventsWhenBackwards', True), 'saltar': tp.get('bFireEventsWhenJumpingForwards', False)}
            elif tt == 'InterpTrackDirector':
                pt = {'t': 'dir', 'k': [[x.get('Time', 0), x.get('TargetCamGroup'), x.get('TransitionTime', 0)] for x in tp.get('CutTrack') or []]}
            elif tt == 'InterpTrackVisibility':
                pt = {'t': 'vis', 'k': [[x.get('Time', 0), x.get('Action', 'EVTA_Show'), x.get('ActiveCondition')] for x in tp.get('VisibilityTrack') or []]}
            elif tt == 'InterpTrackToggle':
                pt = {'t': 'tog', 'k': [[x.get('Time', 0), x.get('ToggleAction', 'ETTA_On')] for x in tp.get('ToggleTrack') or []], 'activar': tp.get('bActivateSystemEachUpdate', False)}
            elif tt == 'InterpTrackFade':
                pt = {'t': 'fade', 'c': curva(tp.get('FloatTrack')), 'color': tp.get('FadeColor'), 'persistir': tp.get('bPersistFade', False)}
            elif tt in ('InterpTrackFloatMaterialParam', 'InterpTrackVectorMaterialParam'):
                pt = {'t': 'fmat' if 'Float' in tt else 'vmat', 'param': tp.get('ParamName'), 'c': curva(tp.get('FloatTrack') or tp.get('VectorTrack')),
                      'mats': [P.ruta((m or {}).get('TargetMaterial')) for m in tp.get('TargetMaterials') or []]}
            elif tt == 'InterpTrackAudioMaster':
                pt = {'t': 'audiomaster', 'c': curva(tp.get('VectorTrack'))}
            elif tt == 'InterpTrackSlomo':
                pt = {'t': 'slomo', 'c': curva(tp.get('FloatTrack'))}
            else:
                pt = {'t': tt}
            pt['n'] = tp.get('TrackTitle') or t['Name']
            G['pistas'].append(pt)
        out['grupos'].append(G)
    return out

def exportar_bsp(d, pkg, ilvl):
    """Geometría BSP del nivel (Model_0 + ModelComponents) en triángulos por elemento (material + lightmap)."""
    lvl = d[ilvl]
    mref = (lvl.get('Properties') or {}).get('Model')
    m = P.obj(mref)
    if not m or not m.get('VertexBuffer'): return None
    V = m['VertexBuffer']['Vertices']; nodes = m['Nodes']; surfs = m['Surfs']
    # Elementos: MapBuildDataId + nodos, leídos de los bytes crudos de cada ModelComponent
    exp_dir = os.path.join(os.path.dirname(P.crudo), 'exp')
    elementos = []
    for f in sorted(glob.glob(os.path.join(exp_dir, pkg.replace('/', '~') + '.*.ModelComponent_*.bin'))):
        b = open(f, 'rb').read()
        i = 0
        # Cada FModelElement: GUID(16) Component(i32) Material(i32) Nodes(TArray<u16>) ...; buscamos por la forma
        comp_idx = int(f.split('.')[-3]) + 1
        pos = 0
        while True:
            j = b.find(struct.pack('<i', comp_idx), pos)
            if j < 16: 
                if j < 0: break
                pos = j + 1; continue
            if j + 12 > len(b): break
            mat, cnt = struct.unpack_from('<ii', b, j + 4)
            if mat < 0 and 0 < cnt < 100000 and j + 12 + 2 * cnt <= len(b):
                g = b[j - 16:j]
                A, B, C, D = struct.unpack('<4I', g)
                guid = '%08X%08X%08X%08X' % (A, B, C, D)
                ns = list(struct.unpack_from('<%dH' % cnt, b, j + 12))
                elementos.append({'lmid': guid, 'nodos': ns})
                pos = j + 12 + 2 * cnt
            else:
                pos = j + 1
    out = []
    for el in elementos:
        pos, nor, uv, lm, idxs = [], [], [], [], []
        mat = None
        for ni in el['nodos']:
            if ni >= len(nodes): continue
            nd = nodes[ni]; s = surfs[nd['iSurf']]
            if mat is None and s.get('Material'): mat = P.ruta(s['Material'])
            nv = nd['NumVertices']; base = nd['iVertexIndex']
            dos = s.get('PolyFlags', 0) & 0x100  # PF_TwoSided
            for lado in ((0, 1) if dos else (0,)):
                k0 = len(pos) // 3
                for k in range(nv):
                    v = V[base + k + (nv if lado else 0)]
                    p = v['Position']; pos += [p['X'] * .01, p['Z'] * .01, p['Y'] * .01]
                    t = v['TangentZ']; nor += [t['X'], t['Z'], t['Y']]
                    uv += [v['TexCoord']['X'], v['TexCoord']['Y']]; lm += [v['ShadowTexCoord']['X'], v['ShadowTexCoord']['Y']]
                for k in range(1, nv - 1):
                    idxs += [k0, k0 + k + 1, k0 + k]
        if idxs: out.append({'mat': mat, 'lmid': el['lmid'], 'pos': r4(pos, 3), 'nor': r4(nor, 3), 'uv': r4(uv, 4), 'lm': r4(lm, 5), 'idx': idxs})
    return out

if __name__ == '__main__':
    o = exportar(sys.argv[1])
    json.dump(o, open(sys.argv[2], 'w'), separators=(',', ':'), ensure_ascii=False)
    import collections
    print(len(o['nodos']), 'nodos', len(o['actores']), 'actores', len(o['bsp'] or []), 'bsp', {k: len(v) for k, v in o['assets'].items()})
    print(collections.Counter(n.get('tipo') for n in o['nodos']).most_common(12))

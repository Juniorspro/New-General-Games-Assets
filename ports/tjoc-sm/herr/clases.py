"""Exporta clases Blueprint (incluidos widgets y los guiones de nivel) a JSON compacto para la VM de Kismet en JS.
Uso: clases.py salida_dir [paquete.json ...]   (sin paquetes: todos los de crudo/todo que tengan clases)"""
import sys, os, json, re, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ue4 import Paquetes, r4
from escenas import movie_scene
P = Paquetes()
STRUCTS = {'LatentActionInfo': ['Linkage', 'UUID', 'ExecutionFunction', 'CallbackTarget'], 'LinearColor': ['R', 'G', 'B', 'A'],
           'Vector2D': ['X', 'Y'], 'MovieSceneSequencePlaybackSettings': ['LoopCount', 'PlayRate', 'bRandomStartTime', 'StartTime', 'bRestoreState', 'InstanceData']}

def nombre_obj(o):
    """'Function'GameplayStatics:GetPlayerController'' → ('Function', 'GameplayStatics:GetPlayerController')"""
    if not isinstance(o, dict): return (None, str(o))
    m = re.match(r"(\w+)'(.*)'$", o.get('ObjectName', ''))
    return (m.group(1), m.group(2)) if m else (None, o.get('ObjectName'))

def ref_val(o):
    """Referencia a objeto como valor: clase nativa, clase BP, asset o actor del nivel."""
    if o is None: return None
    t, n = nombre_obj(o)
    p = o.get('ObjectPath', '')
    if p.startswith('/Script'):
        n2 = n.replace('Default__', '')
        return {'nat': n2.split(':')[-1] if t != 'Class' else n2, 'tipo': t}
    if ':PersistentLevel.' in n:
        return {'actor': n.split(':PersistentLevel.')[-1]}
    pk = re.sub(r'\.\d+$', '', p)
    nn = n.split(':')[-1].replace('Default__', '')
    if t in ('BlueprintGeneratedClass', 'WidgetBlueprintGeneratedClass', 'AnimBlueprintGeneratedClass') or n.endswith('_C') and t == 'Class':
        return {'clase': nn}
    return {'asset': pk + '.' + nn, 'tipo': t}

def valor(v):
    if isinstance(v, dict):
        if 'ObjectPath' in v and 'ObjectName' in v: return ref_val(v)
        if set(v.keys()) == {'AssetPathName', 'SubPathString'}: return {'soft': v['AssetPathName']}
        return {k: valor(x) for k, x in v.items() if k != 'Hex'}
    if isinstance(v, list): return [valor(x) for x in v]
    return v

def vn(v):
    if isinstance(v, dict):
        if 'Name' in v: return v['Name']
        n = nombre_obj(v)[1] or ''
        return re.split(r'[:.]', n)[-1]
    return str(v)

class Conv:
    def __init__(self, fn_nombre):
        self.fn = fn_nombre
    def e(self, x):
        if x is None: return ['k', None]
        t = x.get('Token', '')[3:]; g = x.get
        if t in ('LocalVariable', 'LocalOutVariable'): return ['l', vn(g('Variable'))]
        if t == 'InstanceVariable': return ['i', vn(g('Variable'))]
        if t == 'DefaultVariable': return ['d', vn(g('Variable'))]
        if t in ('IntConst', 'ByteConst', 'Int64Const', 'UInt64Const', 'IntConstByte', 'SkipOffsetConst', 'FloatConst'): return ['k', g('Value')]
        if t in ('StringConst', 'UnicodeStringConst'): return ['k', g('Value')]
        if t == 'NameConst': return ['k', g('Value')]
        if t == 'TextConst':
            v = g('Value') or {}
            def s(z): return z.get('Value') if isinstance(z, dict) else z
            return ['t', s(v.get('SourceString')), s(v.get('KeyString')), s(v.get('Namespace'))]
        if t == 'True': return ['k', True]
        if t == 'False': return ['k', False]
        if t == 'Self': return ['s']
        if t in ('NoObject', 'NoInterface', 'Nothing'): return ['k', None]
        if t == 'ObjectConst':
            r = ref_val(g('Value'))
            return ['o', r]
        if t == 'VectorConst': v = g('Value'); return ['k', {'X': v['X'], 'Y': v['Y'], 'Z': v['Z']}]
        if t == 'RotationConst': v = g('Value'); return ['k', {'Pitch': v['Pitch'], 'Yaw': v['Yaw'], 'Roll': v['Roll']}]
        if t == 'TransformConst':
            v = g('Value'); r, p, s = v['Rotation'], v['Translation'], v['Scale3D']
            return ['k', {'Rotation': {'X': r['X'], 'Y': r['Y'], 'Z': r['Z'], 'W': r['W']}, 'Translation': {'X': p['X'], 'Y': p['Y'], 'Z': p['Z']}, 'Scale3D': {'X': s['X'], 'Y': s['Y'], 'Z': s['Z']}}]
        if t == 'StructConst':
            _, sn = nombre_obj(g('Struct')); sn = (sn or '?').split(':')[-1]
            vals = [self.e(p) for p in g('Properties') or []]
            return ['st', sn, STRUCTS.get(sn), vals]
        if t in ('VirtualFunction', 'LocalVirtualFunction'):
            return ['v', g('Function'), [self.e(p) for p in g('Parameters') or []]]
        if t in ('FinalFunction', 'LocalFinalFunction', 'CallMath'):
            f = g('Function'); tn, n = nombre_obj(f)
            p = f.get('ObjectPath', '') if isinstance(f, dict) else ''
            args = [self.e(a) for a in g('Parameters') or []]
            if p.startswith('/Script'): return ['f', n, args]
            return ['fb', n, args]  # función de Blueprint (Clase_C:Nombre)
        if t in ('Context', 'Context_FailSilent', 'ClassContext'):
            rv = g('RValuePointer')
            return ['c', self.e(g('ObjectExpression')), self.e(g('ContextExpression')), rv.get('Name') if isinstance(rv, dict) else None]
        if t == 'InterfaceContext': return self.e(g('InterfaceValue'))
        if t == 'StructMemberContext':
            _, pn = nombre_obj(g('Property'))
            return ['m', self.e(g('StructExpression')), (pn or '?').split(':')[-1]]
        if t == 'ArrayGetByRef': return ['ag', self.e(g('ArrayVariable')), self.e(g('ArrayIndex'))]
        if t in ('DynamicCast', 'MetaCast', 'ObjToInterfaceCast', 'CrossInterfaceCast', 'InterfaceToObjCast'):
            _, cn = nombre_obj(g('InterfaceClass') or g('ClassPtr'))
            return ['cast', (cn or '?').split('.')[-1], self.e(g('Target')), t]
        if t in ('Cast', 'PrimitiveCast'): return ['cv', g('ConversionType'), self.e(g('Target'))]
        if t == 'SwitchValue':
            return ['sw', self.e(g('IndexTerm')), [[self.e(c.get('CaseIndexValueTerm')), self.e(c.get('CaseTerm'))] for c in g('Cases') or []], self.e(g('DefaultTerm'))]
        if t == 'InstanceDelegate': return ['dl', g('FunctionName')]
        if t in ('ArrayConst', 'SetConst'): return ['arr', [self.e(p) for p in g('Elements') or []]]
        if t == 'SoftObjectConst': return self.e(g('Value'))
        raise ValueError('token ' + t)
    def s(self, x):
        t = x.get('Token', '')[3:]; g = x.get
        if t in ('Let', 'LetObj', 'LetBool', 'LetWeakObjPtr', 'LetDelegate', 'LetMulticastDelegate'):
            return ['=', self.e(g('Variable')), self.e(g('Expression') or g('Assignment'))]
        if t == 'LetValueOnPersistentFrame': return ['=pf', vn(g('DestinationProperty')), self.e(g('AssignmentExpression'))]
        if t == 'Jump': return ['j', g('CodeOffset')]
        if t == 'JumpIfNot': return ['jn', g('CodeOffset'), self.e(g('BooleanExpression'))]
        if t == 'ComputedJump': return ['jc', self.e(g('CodeOffsetExpression'))]
        if t == 'PushExecutionFlow': return ['push', g('PushingAddress')]
        if t == 'PopExecutionFlow': return ['pop']
        if t == 'PopExecutionFlowIfNot': return ['popn', self.e(g('BooleanExpression'))]
        if t == 'Return': return ['ret', self.e(g('Expression'))]
        if t in ('EndOfScript', 'Tracepoint', 'WireTracepoint', 'Breakpoint', 'Nothing'): return None
        if t == 'BindDelegate': return ['bind', self.e(g('Delegate')), g('FunctionName'), self.e(g('ObjectTerm'))]
        if t == 'AddMulticastDelegate': return ['madd', self.e(g('MulticastDelegate')), self.e(g('Delegate'))]
        if t == 'RemoveMulticastDelegate': return ['mrem', self.e(g('MulticastDelegate')), self.e(g('Delegate'))]
        if t == 'ClearMulticastDelegate': return ['mclr', self.e(g('DelegateToClear'))]
        if t == 'CallMulticastDelegate': return ['mcall', self.e(g('Delegate')), [self.e(p) for p in g('Parameters') or []]]
        if t == 'SetArray': return ['seta', self.e(g('AssigningProperty')), [self.e(p) for p in g('Elements') or []]]
        return ['x', self.e(x)]

def tipo_prop(e):
    t = e['Type']
    base = {'BoolProperty': 'bool', 'IntProperty': 'int', 'FloatProperty': 'float', 'ByteProperty': 'byte', 'StrProperty': 'str', 'NameProperty': 'name',
            'TextProperty': 'text', 'ObjectProperty': 'obj', 'ClassProperty': 'class', 'WeakObjectProperty': 'obj', 'SoftObjectProperty': 'obj',
            'InterfaceProperty': 'obj', 'DelegateProperty': 'delegate', 'MulticastDelegateProperty': 'mdelegate', 'EnumProperty': 'byte',
            'Int64Property': 'int', 'UInt32Property': 'int', 'UInt16Property': 'int', 'Int8Property': 'int', 'Int16Property': 'int', 'DoubleProperty': 'float',
            'SetProperty': 'set', 'MapProperty': 'map'}.get(t)
    if t == 'StructProperty':
        _, n = nombre_obj(e.get('Struct')); return 'struct:' + (n or '?').split(':')[-1]
    if t == 'ArrayProperty':
        inner = e.get('Inner')
        if isinstance(inner, dict) and 'ObjectPath' in inner:
            ie = P.obj(inner)
            return 'arr:' + (tipo_prop(ie) if ie else '?')
        return 'arr:?'
    return base or t

def exportar_paquete(pkg_json):
    d = json.load(open(pkg_json))
    pkg = None
    salida = []
    for ci, c in enumerate(d):
        if c['Type'] not in ('BlueprintGeneratedClass', 'WidgetBlueprintGeneratedClass', 'AnimBlueprintGeneratedClass'): continue
        pkg = c.get('Package') or re.sub(r'\.\d+$', '', (c.get('Outer') or {}).get('ObjectPath', ''))
        if not pkg:
            for e in d:
                if e.get('Package'): pkg = e['Package']; break
        def idx(ref):
            if not isinstance(ref, dict): return None
            m = re.match(r'(.*)\.(\d+)$', ref.get('ObjectPath', ''))
            return int(m.group(2)) if m and m.group(1) == pkg else None
        clase = {'n': c['Name'], 'tipo': c['Type'], 'paquete': pkg}
        sup = c.get('SuperStruct')
        if sup:
            st, sn = nombre_obj(sup)
            clase['super'] = sn if sup.get('ObjectPath', '').startswith('/Script') else sn.split('.')[-1]
            clase['super_nativo'] = sup.get('ObjectPath', '').startswith('/Script')
        # variables de clase y de funciones
        por_outer = {}
        for i, e in enumerate(d):
            if e['Type'].endswith('Property') and e['Type'] != 'Property':
                o = idx(e.get('Outer'))
                por_outer.setdefault(o, []).append(i)
        def cadena(primero):
            out = []; j = idx(primero); n = 0
            while j is not None and n < 5000:
                out.append(j); j = idx(d[j].get('Next')); n += 1
            return out
        vars_ = []
        for j in por_outer.get(ci, []):
            e = d[j]
            if e['Name'] == 'UberGraphFrame': continue
            vars_.append({'n': e['Name'], 't': tipo_prop(e)})
        clase['vars'] = vars_
        # CDO
        cdo = idx(c.get('ClassDefaultObject'))
        if cdo is not None: clase['cdo'] = valor({k: v for k, v in (d[cdo].get('Properties') or {}).items() if k != 'UberGraphFrame'})
        # funciones
        funcs = {}
        for fi, f in enumerate(d):
            if f['Type'] != 'Function' or idx(f.get('Outer')) != ci: continue
            props = [d[j] for j in cadena((f.get('Children') or [None])[0])] if f.get('Children') else []
            todos = {d[j]['Name']: d[j] for j in por_outer.get(fi, [])}
            params, locales = [], []
            vistos = set()
            for e in props:
                vistos.add(e['Name'])
                fl = e.get('PropertyFlags', '')
                if 'Parm' in fl.split(' | ') or 'OutParm' in fl or 'ReturnParm' in fl:
                    params.append({'n': e['Name'], 't': tipo_prop(e), 'out': 'OutParm' in fl and 'ConstParm' not in fl, 'ret': 'ReturnParm' in fl})
                else: locales.append({'n': e['Name'], 't': tipo_prop(e)})
            for n, e in todos.items():
                if n not in vistos: locales.append({'n': n, 't': tipo_prop(e)})
            fn = {'flags': f.get('FunctionFlags', ''), 'params': params, 'locales': locales}
            bc = f.get('ScriptBytecode')
            if bc:
                cv = Conv(f['Name']); stm = []; ofs = []
                for b in bc:
                    s = cv.s(b)
                    if s is None:
                        if b.get('Token') == 'EX_EndOfScript': stm.append(['end']); ofs.append(b.get('StatementIndex', 0))
                        continue
                    stm.append(s); ofs.append(b.get('StatementIndex', 0))
                # offsets → índices
                mapa = {o: i for i, o in enumerate(ofs)}
                def fix(s):
                    if s[0] in ('j', 'jn', 'push'):
                        s[1] = mapa.get(s[1], s[1] if False else -1) if s[1] in mapa else ('?%d' % s[1])
                    return s
                fn['code'] = [fix(s) for s in stm]
                fn['ofs'] = ofs
            sup = f.get('SuperStruct')
            if sup: fn['super'] = nombre_obj(sup)[1]
            funcs[f['Name']] = fn
        clase['funcs'] = funcs
        ug = (c.get('Properties') or {}).get('UberGraphFunction')
        if ug: clase['uber'] = nombre_obj(ug)[1].split(':')[-1]
        # SCS: componentes a crear al spawnear
        scs_ref = (c.get('Properties') or {}).get('SimpleConstructionScript')
        if scs_ref is not None:
            si = idx(scs_ref); comps = []
            nodos_idx = [i for i, e in enumerate(d) if e['Type'] == 'SCS_Node' and idx(e.get('Outer')) == si]
            hijo_de = {}
            for i in nodos_idx:
                for ch in (d[i].get('Properties') or {}).get('ChildNodes') or []:
                    hijo_de[idx(ch)] = i
            for i in nodos_idx:
                pr = d[i].get('Properties') or {}
                tpl = P.obj(pr.get('ComponentTemplate'))
                _, cc = nombre_obj(pr.get('ComponentClass'))
                padre = hijo_de.get(i)
                comps.append({'n': pr.get('InternalVariableName') or (tpl or {}).get('Name', '').replace('_GEN_VARIABLE', ''), 'clase': cc,
                              'padre': (d[padre].get('Properties') or {}).get('InternalVariableName') if padre is not None else pr.get('ParentComponentOrVariableName'),
                              'socket': pr.get('AttachToName'), 'tpl': (tpl or {}).get('Name'), 'tipo': (tpl or {}).get('Type')})
            clase['scs'] = comps
        # Timelines
        tls = []
        for ref in (c.get('Properties') or {}).get('Timelines') or []:
            te = P.obj(ref)
            if te:
                pr = te.get('Properties') or {}
                def curva(ref):
                    ce = P.obj(ref) if isinstance(ref, dict) else None
                    if not ce: return None
                    cp = ce.get('Properties') or {}
                    out = {}
                    for k in ('FloatCurve', 'FloatCurves'):
                        if k in cp:
                            fc = cp[k] if isinstance(cp[k], list) else [cp[k]]
                            out = [[[x.get('Time', 0), x.get('Value', 0), x.get('ArriveTangent', 0), x.get('LeaveTangent', 0), (x.get('InterpMode') or 'RCIM_Cubic')[5:]] for x in (c or {}).get('Keys') or []] for c in fc]
                    return out
                tl = {'n': te['Name'].replace('_Template', ''), 'len': pr.get('TimelineLength', 5.0), 'loop': pr.get('bLoop', False), 'auto': pr.get('bAutoPlay', False),
                      'modo': pr.get('LengthMode', 'TL_TimelineLength'), 'guid': (pr.get('TimelineGuid') or '').replace('-', ''),
                      'f': [{'n': t.get('TrackName'), 'c': (curva(t.get('CurveFloat')) or [[]])[0]} for t in pr.get('FloatTracks') or []],
                      'v': [{'n': t.get('TrackName'), 'c': curva(t.get('CurveVector'))} for t in pr.get('VectorTracks') or []],
                      'col': [{'n': t.get('TrackName'), 'c': curva(t.get('CurveLinearColor'))} for t in pr.get('LinearColorTracks') or []],
                      'ev': [{'n': t.get('TrackName'), 'c': (curva(t.get('CurveKeys')) or [[]])[0]} for t in pr.get('EventTracks') or []]}
                tls.append(tl)
        if tls: clase['timelines'] = tls
        # Árbol de widgets
        wt = (c.get('Properties') or {}).get('WidgetTree')
        if wt is not None:
            clase['widgets'] = arbol_widgets(d, idx(wt), idx)
        # Componentes plantilla del CDO (subobjetos por defecto) y las plantillas *_GEN_VARIABLE
        tpls = {}
        for i, e in enumerate(d):
            o = idx(e.get('Outer'))
            if (o == ci and e['Name'].endswith('_GEN_VARIABLE')) or (o == cdo and cdo is not None and not e['Type'].endswith('Property')):
                tpls[e['Name']] = {'tipo': e['Type'], 'props': valor(e.get('Properties') or {}),
                                   'tpl': nombre_obj(e.get('Template'))[1] if e.get('Template') else None}
        if tpls: clase['plantillas'] = tpls
        if c['Type'] == 'WidgetBlueprintGeneratedClass':
            anims = {}
            for i, e in enumerate(d):
                if e['Type'] == 'WidgetAnimation' and idx(e.get('Outer')) == ci:
                    ap = e.get('Properties') or {}
                    ms = movie_scene(d, idx(ap.get('MovieScene')), pkg, valor)
                    if ms: anims[e['Name'].replace('_INST', '')] = {'ms': ms, 'binds': [{'w': b.get('WidgetName'), 'slot': b.get('SlotWidgetName'), 'guid': b.get('AnimationGuid'), 'raiz': b.get('bIsRootWidget')} for b in ap.get('AnimationBindings') or []]}
            if anims: clase['anims'] = anims
        enl = {}
        for e in d:
            if idx(e.get('Outer')) == ci and e['Type'].endswith('DelegateBinding'):
                for k, v in (e.get('Properties') or {}).items(): enl.setdefault(k, []).extend(valor(v))
        if enl: clase['enlaces'] = enl
        salida.append(clase)
    return salida

def arbol_widgets(d, wti, idx):
    if wti is None: return None
    raiz = (d[wti].get('Properties') or {}).get('RootWidget')
    def w(ref, prof=0):
        i = idx(ref)
        if i is None or prof > 40: return None
        e = d[i]; pr = e.get('Properties') or {}
        o = {'n': e['Name'], 'tipo': e['Type'], 'props': valor({k: v for k, v in pr.items() if k not in ('Slots', 'Slot', 'Content')})}
        sl = pr.get('Slot')
        if sl is not None:
            si = idx(sl)
            if si is not None: o['slot'] = {'tipo': d[si]['Type'], 'props': valor({k: v for k, v in (d[si].get('Properties') or {}).items() if k not in ('Parent', 'Content')})}
        hijos = []
        for s in pr.get('Slots') or []:
            si = idx(s)
            if si is None: continue
            ch = (d[si].get('Properties') or {}).get('Content')
            x = w(ch, prof + 1)
            if x: hijos.append(x)
        if hijos: o['hijos'] = hijos
        return o
    return w(raiz)

if __name__ == '__main__':
    sal = sys.argv[1]; os.makedirs(sal, exist_ok=True)
    arch = sys.argv[2:] or [f for f in glob.glob(os.path.join(P.crudo, '*.json')) if '"BlueprintGeneratedClass"' in open(f).read(200000) or 'GeneratedClass"' in open(f).read()]
    n = 0; err = 0
    for f in arch:
        try:
            for c in exportar_paquete(f):
                json.dump(r4(c, 5), open(os.path.join(sal, c['n'] + '.json'), 'w'), separators=(',', ':'), ensure_ascii=False); n += 1
        except Exception as ex:
            err += 1; print('MAL', os.path.basename(f), repr(ex)[:200])
    print(n, 'clases', err, 'errores')

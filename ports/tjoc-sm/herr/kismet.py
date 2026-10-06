"""Pasa el bytecode Kismet (JSON de CUE4Parse) a pseudo-JS legible. Uso: kismet.py paquete.json [más.json] > salida.js"""
import sys, json, re

def obj(o):
    if o is None: return 'null'
    if isinstance(o, str): return o
    n = o.get('ObjectName', '')
    m = re.match(r"(\w+)'(.*)'", n)
    if m: n = m.group(2)
    return n.replace('Default__', '').split(':')[-1].split('.')[-1] if 'Function' in o.get('ObjectName', '') else n.replace('Default__', '')

def var(v):
    if isinstance(v, dict): return v.get('Name') or obj(v)
    return str(v)

def num(x):
    if isinstance(x, float): return ('%g' % x)
    return str(x)

def e(x):
    if x is None: return '?'
    t = x.get('Token', '')[3:]
    g = x.get
    if t in ('LocalVariable', 'LocalOutVariable'): return var(g('Variable'))
    if t == 'InstanceVariable': return 'this.' + var(g('Variable'))
    if t == 'DefaultVariable': return 'default.' + var(g('Variable'))
    if t in ('IntConst', 'ByteConst', 'Int64Const', 'UInt64Const', 'SkipOffsetConst', 'IntConstByte'): return str(g('Value'))
    if t == 'FloatConst': return num(g('Value'))
    if t in ('StringConst', 'UnicodeStringConst'): return json.dumps(g('Value'), ensure_ascii=False)
    if t == 'NameConst': return "'" + str(g('Value')) + "'"
    if t == 'TextConst':
        v = g('Value') or {}
        s = v.get('SourceString')
        if isinstance(s, dict): return 'T' + e(s)
        return 'T' + json.dumps(str(v), ensure_ascii=False)
    if t == 'True': return 'true'
    if t == 'False': return 'false'
    if t == 'Self': return 'this'
    if t in ('NoObject', 'NoInterface'): return 'null'
    if t == 'Nothing': return ''
    if t == 'ObjectConst': return '@' + obj(g('Value'))
    if t == 'VectorConst': v = g('Value'); return 'V(%s,%s,%s)' % (num(v['X']), num(v['Y']), num(v['Z']))
    if t == 'RotationConst': v = g('Value'); return 'R(%s,%s,%s)' % (num(v['Pitch']), num(v['Yaw']), num(v['Roll']))
    if t == 'TransformConst':
        v = g('Value'); r, p, s = v['Rotation'], v['Translation'], v['Scale3D']
        return 'TF(V(%s,%s,%s),Q(%s,%s,%s,%s),V(%s,%s,%s))' % (num(p['X']), num(p['Y']), num(p['Z']), num(r['X']), num(r['Y']), num(r['Z']), num(r['W']), num(s['X']), num(s['Y']), num(s['Z']))
    if t == 'StructConst':
        return obj(g('Struct')).split(':')[-1] + '{' + ', '.join(e(p) for p in g('Properties') or []) + '}'
    if t in ('VirtualFunction', 'LocalVirtualFunction'):
        return var(g('Function')) + '(' + ', '.join(e(p) for p in g('Parameters') or []) + ')'
    if t in ('FinalFunction', 'LocalFinalFunction', 'CallMath'):
        f = g('Function'); n = f.get('ObjectName', '') if isinstance(f, dict) else str(f)
        m = re.match(r"\w+'(.*)'", n); n = m.group(1) if m else n
        n = n.replace(':', '.')
        return n + '(' + ', '.join(e(p) for p in g('Parameters') or []) + ')'
    if t in ('Context', 'Context_FailSilent', 'ClassContext'):
        return e(g('ObjectExpression')) + ('?.' if t == 'Context_FailSilent' else '.') + e(g('ContextExpression'))
    if t == 'InterfaceContext': return e(g('InterfaceValue'))
    if t == 'StructMemberContext':
        return e(g('StructExpression')) + '.' + obj(g('Property')).split(':')[-1]
    if t == 'ArrayGetByRef': return e(g('ArrayVariable')) + '[' + e(g('ArrayIndex')) + ']'
    if t in ('DynamicCast', 'MetaCast', 'ObjToInterfaceCast', 'CrossInterfaceCast', 'InterfaceToObjCast'):
        return 'cast<' + obj(g('InterfaceClass') or g('ClassPtr')) + '>(' + e(g('Target')) + ')'
    if t in ('Cast', 'PrimitiveCast'): return e(g('Target'))
    if t == 'SwitchValue':
        cs = ', '.join(e(c.get('CaseIndexValueTerm')) + ': ' + e(c.get('CaseTerm')) for c in g('Cases') or [])
        return 'switch(' + e(g('IndexTerm')) + ' {' + cs + '} else ' + e(g('DefaultTerm')) + ')'
    if t == 'InstanceDelegate': return "delegate('" + str(g('FunctionName')) + "')"
    if t in ('ArrayConst', 'SetConst', 'MapConst'): return '[' + ', '.join(e(p) for p in g('Elements') or g('Values') or []) + ']'
    if t == 'SoftObjectConst': return '@' + e(g('Value'))
    return '<' + t + ' ' + json.dumps(x)[:120] + '>'

def st(x):
    t = x.get('Token', '')[3:]
    g = x.get
    if t in ('Let', 'LetObj', 'LetBool', 'LetWeakObjPtr', 'LetDelegate', 'LetMulticastDelegate'):
        return e(g('Variable')) + ' = ' + e(g('Expression') or g('Assignment'))
    if t == 'LetValueOnPersistentFrame': return 'frame.' + var(g('DestinationProperty')) + ' = ' + e(g('AssignmentExpression'))
    if t == 'Jump': return 'goto @%d' % g('CodeOffset')
    if t == 'JumpIfNot': return 'if (!(%s)) goto @%d' % (e(g('BooleanExpression')), g('CodeOffset'))
    if t == 'ComputedJump': return 'goto *' + e(g('CodeOffsetExpression'))
    if t == 'PushExecutionFlow': return 'push @%d' % g('PushingAddress')
    if t == 'PopExecutionFlow': return 'pop'
    if t == 'PopExecutionFlowIfNot': return 'if (!(%s)) pop' % e(g('BooleanExpression'))
    if t == 'Return': r = e(g('Expression')); return 'return' + (' ' + r if r else '')
    if t == 'EndOfScript': return None
    if t in ('Tracepoint', 'WireTracepoint', 'Breakpoint'): return None
    if t == 'BindDelegate': return e(g('Delegate')) + " = bind(" + e(g('ObjectTerm')) + ", '" + str(g('FunctionName')) + "')"
    if t == 'AddMulticastDelegate': return e(g('MulticastDelegate')) + ' += ' + e(g('Delegate'))
    if t == 'RemoveMulticastDelegate': return e(g('MulticastDelegate')) + ' -= ' + e(g('Delegate'))
    if t == 'ClearMulticastDelegate': return e(g('DelegateToClear')) + '.clear()'
    if t == 'CallMulticastDelegate': return e(g('Delegate')) + '.broadcast(' + ', '.join(e(p) for p in g('Parameters') or []) + ')'
    if t == 'SetArray': return e(g('AssigningProperty')) + ' = [' + ', '.join(e(p) for p in g('Elements') or []) + ']'
    if t in ('SetSet', 'SetMap'): return e(g('SetProperty') or g('MapProperty')) + ' = [' + ', '.join(e(p) for p in g('Elements') or []) + ']'
    return e(x)

LIBS = [('GameplayStatics', 'GS'), ('KismetMathLibrary', 'M'), ('KismetSystemLibrary', 'SYS'), ('KismetStringLibrary', 'STR'), ('KismetTextLibrary', 'TXT'),
        ('WidgetBlueprintLibrary', 'UMG'), ('KismetArrayLibrary', 'ARR'), ('KismetInputLibrary', 'INP'), ('BlueprintMapLibrary', 'MAP'), ('KismetMaterialLibrary', 'MATL')]
def limpiar(t):
    t = re.sub(r'this\.([A-Za-z0-9_ ]+?)_ExecuteUbergraph_\w+?_RefProperty', r'$\1', t)
    for a, b in LIBS:
        t = t.replace('@' + a + '.' + a + '.', b + '.').replace('@' + a + '.', b + '.').replace(a + '.', b + '.')
    t = re.sub(r'(\w+)\{(\d+), -?\d+, \'ExecuteUbergraph_\w+\', this\}', r'⟶@\2', t)
    t = re.sub(r'LatentActionInfo⟶', '⟶', t)
    t = re.sub(r'\.this\.', '.', t)
    t = re.sub(r'CallFunc_(\w+?)_ReturnValue(\d*)', r'r\1\2', t)
    t = re.sub(r'K2Node_DynamicCast_As(\w+)', r'como\1', t)
    t = re.sub(r'K2Node_DynamicCast_bSuccess(\d*)', r'okCast\1', t)
    t = re.sub(r'K2Node_(\w+)', r'\1', t)
    t = re.sub(r'\b(?:Actor|SceneComponent|PrimitiveComponent|StaticMeshActor|StaticMeshComponent|SkeletalMeshComponent|UserWidget|AudioComponent|LightComponent|PointLightComponent|SpotLightComponent|Character|Pawn|PlayerController|Controller|MatineeActor|LevelSequencePlayer|MovieSceneSequencePlayer|MeshComponent|SkinnedMeshComponent|TimelineComponent|Widget|TextBlock|Image|CameraComponent):(\w+)\.', r'\1.', t)
    t = re.sub(r'\.(?:Actor|SceneComponent|PrimitiveComponent|StaticMeshComponent|SkeletalMeshComponent|UserWidget|AudioComponent|LightComponent|Character|Pawn|PlayerController|Controller|MatineeActor|MovieSceneSequencePlayer|MeshComponent|SkinnedMeshComponent|TimelineComponent|Widget|TextBlock|Image|LocalLightComponent|PointLightComponent|SpotLightComponent|CameraComponent|AnimInstance|ParticleSystemComponent|DecalComponent|TextRenderComponent|CharacterMovementComponent|PawnMovementComponent|MovementComponent|ShapeComponent|BoxComponent|LevelSequencePlayer)\.', '.', t)
    return t

def main():
    for ruta in sys.argv[1:]:
        d = json.load(open(ruta))
        print('// ===== ' + ruta.split('/')[-1])
        for x in d:
            if x.get('Type') == 'Function' and x.get('ScriptBytecode'):
                bc = x['ScriptBytecode']
                # Eventos que solo saltan al ubergraph
                if len(bc) <= 3 and bc[0].get('Token') == 'EX_VirtualFunction' and str(bc[0].get('Function', '')).startswith('ExecuteUbergraph'):
                    print('evento %s → @%s' % (x['Name'], e(bc[0]['Parameters'][0])))
                    continue
                if len(bc) <= 4 and any(str(b.get('Function', '')).startswith('ExecuteUbergraph') for b in bc):
                    print('evento %s: %s' % (x['Name'], limpiar(' ; '.join(filter(None, (st(b) for b in bc))))))
                    continue
                print('\nfunction %s() {  // %s' % (x['Name'], x.get('FunctionFlags', '')))
                for b in bc:
                    s = st(b)
                    if s is None: continue
                    print('  @%d: %s' % (b.get('StatementIndex', -1), limpiar(s)))
                print('}')
main()

"""Animator de Unity (Mecanim) para pantallas de UI → JSON que ui.js reproduce.

    from animui import ExportadorAnim
    an = ExportadorAnim(paquete, campos_extra)       # campos_extra: nombres de campos de scripts del juego
    nombre = an.animator(obj_animator, transform)    # registra el controlador y sus clips
    an.guardar(carpeta)                              # controladores.json y clips.json

En un build los clips de Mecanim no traen nombres: cada curva va atada por CRC32 de la ruta del objeto
(relativa al Animator) y del atributo ("m_AnchoredPosition.x", "m_Alpha"...). Las rutas se resuelven con
la jerarquía de cada Animator que usa el clip; los atributos, con una lista de nombres conocidos más los
campos de los scripts del juego.

Formato de una curva: {r: ruta, t: tipo (Transform, RectTransform, GameObject, CanvasGroup, o la clase
del script), a: atributo, s: [[t, c0, c1, c2, c3], ...]} → valor(t) = ((c0·d + c1)·d + c2)·d + c3 con d
= t − t_clave de la última clave con t_clave ≤ t. Las de sprite (PPtr) van con {sp: [[t, sprite], ...]}.
"""
import json
import os
import struct
import zlib

# Atributos de Transform en los bindings (typeID 4): cuántas curvas y qué son
TRANSFORM = {1: ('m_LocalPosition', 3), 2: ('m_LocalRotation', 4), 3: ('m_LocalScale', 3), 4: ('m_LocalEulerAngles', 3)}
TIPOS = {1: 'GameObject', 4: 'Transform', 224: 'RectTransform', 225: 'CanvasGroup', 114: 'MonoBehaviour',
         95: 'Animator', 23: 'MeshRenderer', 212: 'SpriteRenderer', 198: 'ParticleSystem', 82: 'AudioSource',
         222: 'CanvasRenderer', 223: 'Canvas', 137: 'SkinnedMeshRenderer', 108: 'Light'}

VECT = ['x', 'y', 'z', 'w']
COLOR = ['r', 'g', 'b', 'a']


def _nombres_base():
    n = ['m_IsActive', 'm_Enabled', 'm_Alpha', 'm_Interactable', 'm_BlocksRaycasts', 'm_FillAmount',
         'm_Sprite', 'm_Text', 'm_FontData.m_FontSize', 'm_FontSize', 'm_Material', 'm_RaycastTarget',
         'm_FillClockwise', 'm_FillOrigin', 'm_PreserveAspect', 'm_Value', 'm_Texture', 'm_SortingOrder',
         'm_Volume', 'm_Pitch', 'm_Mute', 'm_Size', 'm_IgnoreParentGroups', 'm_PixelsPerUnitMultiplier',
         'm_Spacing', 'm_LineSpacing', 'm_CharacterSpacing', 'm_EffectDistance', 'm_UseGraphicAlpha']
    for v in ['m_AnchoredPosition', 'm_SizeDelta', 'm_AnchorMin', 'm_AnchorMax', 'm_Pivot', 'm_LocalPosition',
              'm_LocalScale', 'm_LocalRotation', 'm_LocalEulerAngles', 'localEulerAnglesRaw',
              'm_LocalEulerAnglesHint', 'm_UVRect', 'm_EffectDistance', 'm_Padding']:
        n += [f'{v}.{c}' for c in VECT + ['width', 'height']]
    for c in ['m_Color', 'm_EffectColor', 'material._Color', 'material._TintColor', 'm_Colors.m_NormalColor']:
        n += [f'{c}.{x}' for x in COLOR]
    return n


def _f(u):
    return struct.unpack('<f', struct.pack('<I', u & 0xffffffff))[0]


def _r(x):
    return round(x, 5) if isinstance(x, float) else x


class ExportadorAnim:
    def __init__(self, paquete, campos_extra=(), sprite=None, generador=None):
        self.b = paquete
        self.sprite = sprite                 # función obj Sprite → nombre exportado (la de ExportadorUI)
        self.gen = generador                 # TypeTreeGenerator: los campos de los scripts animados
        self._scripts = {}
        self.attr = {}
        for n in list(_nombres_base()) + list(campos_extra):
            self.attr[zlib.crc32(n.encode())] = n
            for s in VECT + COLOR:
                self.attr[zlib.crc32(f'{n}.{s}'.encode())] = f'{n}.{s}'
        self.controladores = {}              # nombre → {params, capas, clips}
        self.clips = {}                      # nombre de clip → datos sin resolver + curvas
        self.rutas_clip = {}                 # nombre de clip → {crc: ruta}
        self.avisos = []
        self._objs_clip = {}

    # ------------------------------------------------------------ jerarquía
    @staticmethod
    def rutas(t, pre=''):
        """Todas las rutas relativas (como Unity: 'hijo/nieto') debajo de un Transform."""
        out = {zlib.crc32(pre.encode()): pre}
        for h in t.m_Children:
            ht = h.read()
            n = ht.m_GameObject.read().m_Name
            r = f'{pre}/{n}' if pre else n
            out.update(ExportadorAnim.rutas(ht, r))
        return out

    def _obj(self, f, pp):
        if not pp['m_PathID']:
            return None
        if pp['m_FileID']:
            f = self.b.files[f.externals[pp['m_FileID'] - 1].name]
        return f.objects.get(pp['m_PathID'])

    # ------------------------------------------------------------ Animator
    def animator(self, o, t):
        a = o.read()
        try:
            ctl_o = a.m_Controller.deref()
        except Exception:
            return None
        if ctl_o is None:
            return None
        if ctl_o.type.name == 'AnimatorOverrideController':
            d = ctl_o.read_typetree()
            base = self._obj(ctl_o.assets_file, d['m_Controller'])
            reemplazos = {}
            for par in d.get('m_Clips', []):
                o1, o2 = self._obj(ctl_o.assets_file, par['m_OriginalClip']), self._obj(ctl_o.assets_file, par['m_OverrideClip'])
                if o1 and o2:
                    reemplazos[o1.read().m_Name] = o2
            nombre = self.controlador(base) if base else None
            if nombre is None:
                return None
            nuevo = d['m_Name']
            if nuevo not in self.controladores:
                c = json.loads(json.dumps(self.controladores[nombre]))
                for i, cn in enumerate(c['clips']):
                    if cn in reemplazos:
                        c['clips'][i] = self.clip(reemplazos[cn])
                self.controladores[nuevo] = c
            ctl = nuevo
        else:
            ctl = self.controlador(ctl_o)
        if ctl is None:
            return None
        rut = self.rutas(t)
        for cn in self.controladores[ctl]['clips']:
            if cn:
                self.rutas_clip.setdefault(cn, {}).update(rut)
        return ctl

    def controlador(self, o):
        d = o.read_typetree()
        nombre = d['m_Name']
        if nombre in self.controladores:
            return nombre
        tos = {h: s for h, s in d['m_TOS']}
        nom = lambda h: tos.get(h, h)
        c = d['m_Controller']
        clips = []
        for pp in d['m_AnimationClips']:
            co = self._obj(o.assets_file, pp)
            clips.append(self.clip(co) if co else None)
        # parámetros
        params = []
        tipos = {1: 'float', 3: 'int', 4: 'bool', 9: 'trigger'}
        dv = c['m_DefaultValues']['data'] if 'data' in c['m_DefaultValues'] else c['m_DefaultValues']
        for v in (c['m_Values']['data'] if 'data' in c['m_Values'] else c['m_Values'])['m_ValueArray']:
            t = tipos.get(v['m_Type'], v['m_Type'])
            lista = {'float': 'm_FloatValues', 'int': 'm_IntValues', 'bool': 'm_BoolValues', 'trigger': 'm_BoolValues'}.get(t)
            defecto = dv[lista][v['m_Index']] if lista and v['m_Index'] < len(dv[lista]) else 0
            params.append({'n': nom(v['m_ID']), 'tipo': t, 'def': _r(float(defecto)) if t == 'float' else int(defecto)})
        capas = []
        maquinas = [m['data'] if 'data' in m else m for m in c['m_StateMachineArray']]
        for ly in c['m_LayerArray']:
            ly = ly['data'] if 'data' in ly else ly
            sm = maquinas[ly['m_StateMachineIndex']]
            estados = []
            for st in sm['m_StateConstantArray']:
                st = st['data'] if 'data' in st else st
                arboles = [bt['data'] if 'data' in bt else bt for bt in st['m_BlendTreeConstantArray']]
                motivo = None
                if arboles:
                    nodos = [nd['data'] if 'data' in nd else nd for nd in arboles[0]['m_NodeArray']]
                    if len(nodos) == 1 and nodos[0]['m_ClipID'] != 0xffffffff:
                        motivo = {'clip': nodos[0]['m_ClipID']}
                    elif nodos:
                        raiz = nodos[0]
                        motivo = {'arbol': {
                            'tipo': raiz['m_BlendType'], 'param': nom(raiz['m_BlendEventID']),
                            'hijos': [nodos[i]['m_ClipID'] for i in raiz['m_ChildIndices']],
                            'umbrales': [_r(x) for x in (raiz['m_Blend1dData']['data'] if 'data' in raiz['m_Blend1dData'] else raiz['m_Blend1dData'])['m_ChildThresholdArray']]}}
                estados.append({
                    'n': nom(st['m_NameID']), 'motivo': motivo, 'vel': _r(st['m_Speed']),
                    'velParam': nom(st['m_SpeedParamID']) if st['m_SpeedParamID'] else None,
                    'tiempoParam': nom(st.get('m_TimeParamID', 0)) if st.get('m_TimeParamID') else None,
                    'ciclo': _r(st['m_CycleOffset']), 'bucle': bool(st['m_Loop']),
                    'escribeDef': bool(st['m_WriteDefaultValues']), 'etiqueta': nom(st['m_TagID']) if st['m_TagID'] else None,
                    'trans': [self._trans(tr, nom) for tr in st['m_TransitionConstantArray']]})
            capas.append({'n': nom(ly['m_Binding']), 'peso': _r(ly['m_DefaultWeight']), 'aditiva': ly['(int&)m_LayerBlendingMode'] == 1,
                          'estados': estados, 'defecto': sm['m_DefaultState'],
                          'cualquiera': [self._trans(tr, nom) for tr in sm['m_AnyStateTransitionConstantArray']],
                          'entrada': self._selectores(sm, nom)})
        if capas:
            capas[0]['peso'] = 1.0       # la capa base siempre pesa 1
        self.controladores[nombre] = {'params': params, 'capas': capas, 'clips': clips}
        return nombre

    def _trans(self, tr, nom):
        tr = tr['data'] if 'data' in tr else tr
        conds = []
        for cd in tr['m_ConditionConstantArray']:
            cd = cd['data'] if 'data' in cd else cd
            # modos: 1 If, 2 IfNot, 3 Greater, 4 Less, 5 ExitTime, 6 Equals, 7 NotEqual
            conds.append([cd['m_ConditionMode'], nom(cd['m_EventID']) if cd['m_EventID'] else None, _r(cd['m_EventThreshold'])])
        return {'a': tr['m_DestinationState'], 'conds': conds, 'dur': _r(tr['m_TransitionDuration']),
                'ofs': _r(tr['m_TransitionOffset']), 'salida': _r(tr['m_ExitTime']), 'conSalida': bool(tr['m_HasExitTime']),
                'fija': bool(tr['m_HasFixedDuration']), 'interr': tr['m_InterruptionSource'],
                'ordenada': bool(tr['m_OrderedInterruption']), 'aSiMismo': bool(tr['m_CanTransitionToSelf'])}

    def _selectores(self, sm, nom):
        out = []
        for s in sm['m_SelectorStateConstantArray']:
            s = s['data'] if 'data' in s else s
            ts = []
            for tr in s['m_TransitionConstantArray']:
                tr = tr['data'] if 'data' in tr else tr
                conds = []
                for cd in tr['m_ConditionConstantArray']:
                    cd = cd['data'] if 'data' in cd else cd
                    conds.append([cd['m_ConditionMode'], nom(cd['m_EventID']) if cd['m_EventID'] else None, _r(cd['m_EventThreshold'])])
                ts.append({'a': tr['m_Destination'], 'conds': conds})
            out.append({'trans': ts, 'id': s.get('m_FullPathID'), 'entrada': bool(s.get('m_IsEntry'))})
        return out

    def _script(self, so):
        """Nombre de la clase de un MonoScript; de paso suma sus campos a los atributos conocidos."""
        k = (so.assets_file.name, so.path_id)
        if k in self._scripts:
            return self._scripts[k]
        try:
            ms = so.read()
        except Exception:
            self._scripts[k] = 'MonoBehaviour'
            return 'MonoBehaviour'
        self._scripts[k] = ms.m_ClassName
        if self.gen is not None:
            completo = f'{ms.m_Namespace}.{ms.m_ClassName}' if ms.m_Namespace else ms.m_ClassName
            try:
                nodos = self.gen.get_nodes(ms.m_AssemblyName, completo)
            except Exception:
                nodos = []
            pila = []
            for n in nodos:
                if n.m_Level == 0:
                    continue
                pila = pila[:n.m_Level - 1] + [n.m_Name]
                if 'Array' in pila:
                    continue
                ruta = '.'.join(pila)
                self.attr.setdefault(zlib.crc32(ruta.encode()), ruta)
        return ms.m_ClassName

    # ------------------------------------------------------------ clips
    def clip(self, o):
        cd = o.read_typetree()
        nombre = cd['m_Name']
        if nombre in self.clips and self._objs_clip.get(nombre) != (o.assets_file.name, o.path_id):
            # dos clips distintos con el mismo nombre
            i = 2
            while f'{nombre}~{i}' in self.clips and self._objs_clip.get(f'{nombre}~{i}') != (o.assets_file.name, o.path_id):
                i += 1
            nombre = f'{nombre}~{i}'
        if nombre in self.clips:
            return nombre
        self._objs_clip[nombre] = (o.assets_file.name, o.path_id)
        mc = cd['m_MuscleClip']
        cl = mc['m_Clip']['data'] if 'data' in mc['m_Clip'] else mc['m_Clip']
        st, de, co = cl['m_StreamedClip'], cl['m_DenseClip'], cl['m_ConstantClip']
        n_st = st['curveCount'] + st.get('discreteCurveCount', 0)
        n_de = de['m_CurveCount']
        curvas = {}       # índice → lista de segmentos [t, c0, c1, c2, c3]
        # streamed: cuadros (t, n, n × (índice, c0..c3))
        dat = st['data']
        i = 0
        while i < len(dat):
            t = _f(dat[i]); n = dat[i + 1]; i += 2
            for _ in range(n):
                idx = dat[i]
                c = [_f(dat[i + 1]), _f(dat[i + 2]), _f(dat[i + 3]), _f(dat[i + 4])]
                i += 5
                if t == float('inf'):
                    continue
                curvas.setdefault(idx, []).append([max(t, -1e9)] + c)
        # dense: muestras a frecuencia fija → segmentos lineales
        if n_de:
            sa, fr, sr, t0 = de['m_SampleArray'], de['m_FrameCount'], de['m_SampleRate'], de['m_BeginTime']
            for k in range(n_de):
                segs = []
                for fi in range(fr):
                    v = sa[fi * n_de + k]
                    v2 = sa[(fi + 1) * n_de + k] if fi + 1 < fr else v
                    segs.append([t0 + fi / sr, 0.0, 0.0, (v2 - v) * sr if fi + 1 < fr else 0.0, v])
                curvas[n_st + k] = segs
        for k, v in enumerate(co['data']):
            curvas[n_st + n_de + k] = [[-1e9, 0.0, 0.0, 0.0, v]]
        # bindings → qué es cada curva
        bc = cd['m_ClipBindingConstant']
        salida = []
        idx = 0
        for bnd in bc['genericBindings']:
            tid, at = bnd['typeID'], bnd['attribute']
            if bnd.get('isPPtrCurve'):
                cnt = 1
            elif tid == 4 and at in TRANSFORM:
                cnt = TRANSFORM[at][1]
            else:
                cnt = 1
            tipo = TIPOS.get(tid, tid)
            if tid == 114:
                so = self._obj(o.assets_file, bnd['script'])
                tipo = self._script(so) if so else 'MonoBehaviour'
            for k in range(cnt):
                if tid == 4 and at in TRANSFORM:
                    a = f'{TRANSFORM[at][0]}.{VECT[k]}'
                else:
                    a = self.attr.get(at, at)
                seg = curvas.get(idx + k)
                cur = {'r': bnd['path'], 't': tipo, 'a': a}
                if bnd.get('isPPtrCurve'):
                    mapa = bc['pptrCurveMapping']
                    sps = []
                    for s in seg or []:
                        j = int(round(s[4]))
                        so = self._obj(o.assets_file, mapa[j]) if 0 <= j < len(mapa) else None
                        nm = None
                        if so is not None and so.type.name == 'Sprite' and self.sprite:
                            nm = self.sprite(so)
                        elif so is not None:
                            try:
                                nm = so.read().m_Name
                            except Exception:
                                pass
                        sps.append([_r(s[0]), nm])
                    cur['sp'] = sps
                else:
                    cur['s'] = [[_r(x) for x in s] for s in (seg or [])]
                if bnd.get('isIntCurve'):
                    cur['entero'] = 1
                if bnd.get('customType'):
                    cur['custom'] = bnd['customType']
                salida.append(cur)
            idx += cnt
        ev = [{'t': _r(e['time']), 'f': e['functionName'], 's': e.get('data', ''), 'n': _r(e.get('floatParameter', 0)),
               'i': e.get('intParameter', 0)} for e in cd.get('m_Events', [])]
        self.clips[nombre] = {'dur': _r(mc['m_StopTime'] - mc['m_StartTime']), 'ini': _r(mc['m_StartTime']),
                              'bucle': bool(mc['m_LoopTime']), 'curvas': salida, 'eventos': ev}
        return nombre

    # ------------------------------------------------------------ salida
    def guardar(self, carpeta):
        os.makedirs(carpeta, exist_ok=True)
        for nombre, c in self.clips.items():
            rut = self.rutas_clip.get(nombre, {})
            for cur in c['curvas']:
                if isinstance(cur['r'], int):
                    r = rut.get(cur['r'])
                    if r is None:
                        self.avisos.append(f'clip {nombre}: ruta {cur["r"]} sin resolver')
                    cur['r'] = r if r is not None else f'#{cur["r"]}'
                if isinstance(cur['a'], int):
                    self.avisos.append(f'clip {nombre}: atributo {cur["a"]} ({cur["t"]}) sin nombre')
        with open(os.path.join(carpeta, 'controladores.json'), 'w') as f:
            json.dump(self.controladores, f, ensure_ascii=False, separators=(',', ':'))
        with open(os.path.join(carpeta, 'clips.json'), 'w') as f:
            json.dump(self.clips, f, ensure_ascii=False, separators=(',', ':'))

using System;
using System.Collections.Generic;
using Porteo;
using Porteo.Animacion;
using Porteo.Datos;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Porteo.Animacion
{
    // El AnimatorController compilado de Unity (ControllerConstant): parámetros, capas y, por
    // capa, una máquina de estados ya aplanada (las sub-máquinas quedan como selectores de
    // entrada y salida).
    internal sealed class Parametro
    {
        public string Nombre;
        public int Hash, Tipo, Indice;   // Tipo: 1 float, 3 int, 4 bool, 9 trigger
        public float Flotante; public int Entero; public bool Booleano;
    }

    internal struct Condicion
    {
        public int Modo;        // 1 If, 2 IfNot, 3 Greater, 4 Less, 6 Equals, 7 NotEqual
        public int Parametro;   // hash del nombre
        public float Umbral;
    }

    internal sealed class Transicion
    {
        public Condicion[] Condiciones;
        public int Destino;          // índice de estado; 30000+ es un selector
        public int Hash;             // m_FullPathID
        public float Duracion, Desfase, TiempoSalida;
        public bool ConSalida, DuracionFija, Ordenada, HaciaSiMismo;
        public int Interrupcion;     // 0 ninguna, 1 origen, 2 destino, 3 origen y destino, 4 destino y origen
    }

    internal sealed class Estado
    {
        public int Nombre, Ruta, RutaCompleta, Etiqueta;
        public int ParamVelocidad, ParamDesfase;
        public float Velocidad = 1, Desfase;
        public bool EscribeDefectos = true, Bucle;
        public Transicion[] Transiciones;
        public int Clip = -1;        // índice en los clips del controlador (los blend trees, por su primer clip)
        public float Duracion = 1;
    }

    internal sealed class Selector
    {
        public (int destino, Condicion[] condiciones)[] Transiciones;
        public int Ruta;
        public bool Entrada;
    }

    internal sealed class Maquina
    {
        public Estado[] Estados;
        public Transicion[] DeCualquiera;
        public Selector[] Selectores;
        public int PorDefecto;
    }

    internal sealed class Capa
    {
        public int Maquina, Sincronizada;
        public float Peso;
        public int Mezcla;     // 0 override, 1 aditiva
        public int Hash;       // m_Binding: el nombre de la capa
    }

    internal sealed class Controlador
    {
        public Capa[] Capas = Array.Empty<Capa>();
        public Maquina[] Maquinas = Array.Empty<Maquina>();
        public Parametro[] Parametros = Array.Empty<Parametro>();
        public readonly Dictionary<int, Parametro> PorHash = new Dictionary<int, Parametro>();
        public AnimationClip[] Clips = Array.Empty<AnimationClip>();
        public readonly Dictionary<uint, string> Textos = new Dictionary<uint, string>();
        // los StateMachineBehaviour de cada estado (por capa y ruta completa)
        public readonly Dictionary<(int capa, int estado), Object[]> Comportamientos = new Dictionary<(int, int), Object[]>();

        public static Controlador Leer(Mapa m, IResolutor r)
        {
            var c = new Controlador();
            var tos = m.L("m_TOS");
            if (tos != null)
                foreach (var x in tos)
                    if (x is List<object> par && par.Count == 2) c.Textos[(uint)Convert.ToInt64(par[0])] = par[1] as string ?? "";
            var clips = m.L("m_AnimationClips");
            if (clips != null)
            {
                c.Clips = new AnimationClip[clips.Count];
                for (int i = 0; i < clips.Count; i++) c.Clips[i] = clips[i] is PPtr p ? r.Resolver(p) as AnimationClip : null;
            }
            var k = m.M("m_Controller");
            if (k == null) return c;
            var capas = k.L("m_LayerArray");
            if (capas != null)
            {
                c.Capas = new Capa[capas.Count];
                for (int i = 0; i < capas.Count; i++)
                {
                    var d = Datos((Mapa)capas[i]);
                    c.Capas[i] = new Capa
                    {
                        Maquina = d.I32("m_StateMachineIndex"), Sincronizada = d.I32("m_StateMachineSynchronizedLayerIndex"),
                        Peso = d.F("m_DefaultWeight"), Mezcla = d.I32("(int&)m_LayerBlendingMode"), Hash = (int)(uint)d.I("m_Binding"),
                    };
                }
            }
            var maquinas = k.L("m_StateMachineArray");
            if (maquinas != null)
            {
                c.Maquinas = new Maquina[maquinas.Count];
                for (int i = 0; i < maquinas.Count; i++) c.Maquinas[i] = LeerMaquina(Datos((Mapa)maquinas[i]), c);
            }
            LeerParametros(k, c);
            LeerComportamientos(m, r, c);
            return c;
        }

        static Mapa Datos(Mapa m) => m.M("data") ?? m;

        static Maquina LeerMaquina(Mapa d, Controlador c)
        {
            var m = new Maquina { PorDefecto = d.I32("m_DefaultState") };
            var es = d.L("m_StateConstantArray") ?? new List<object>();
            m.Estados = new Estado[es.Count];
            for (int i = 0; i < es.Count; i++)
            {
                var s = Datos((Mapa)es[i]);
                var e = new Estado
                {
                    Nombre = (int)(uint)s.I("m_NameID"), Ruta = (int)(uint)s.I("m_PathID"), RutaCompleta = (int)(uint)s.I("m_FullPathID"),
                    Etiqueta = (int)(uint)s.I("m_TagID"), ParamVelocidad = (int)(uint)s.I("m_SpeedParamID"), ParamDesfase = (int)(uint)s.I("m_CycleOffsetParamID"),
                    Velocidad = s.F("m_Speed", 1), Desfase = s.F("m_CycleOffset"), EscribeDefectos = s.B("m_WriteDefaultValues", true), Bucle = s.B("m_Loop"),
                    Transiciones = LeerTransiciones(s.L("m_TransitionConstantArray")),
                };
                // el movimiento: el primer clip de su blend tree (los del juego son clips sueltos)
                var hojas = s.L("m_LeafInfoArray");
                var arboles = s.L("m_BlendTreeConstantArray");
                if (arboles != null && arboles.Count > 0)
                {
                    var nodos = Datos((Mapa)arboles[0]).L("m_NodeArray");
                    if (nodos != null && nodos.Count > 0)
                    {
                        var n0 = Datos((Mapa)nodos[0]);
                        int clipId = n0.I32("m_ClipID", -1);
                        e.Duracion = n0.F("m_Duration", 1);
                        // con un solo nodo, m_ClipID es el índice directo en los clips del controlador
                        if (clipId >= 0 && (uint)clipId != 0xFFFFFFFF)
                        {
                            int idx = clipId;
                            if (hojas != null && hojas.Count > 0)
                            {
                                var ids = Datos((Mapa)hojas[0]).L("m_IDArray");
                                if (ids != null && ids.Count > clipId) idx = Convert.ToInt32(ids[clipId]);
                            }
                            e.Clip = idx;
                        }
                        else if (nodos.Count > 1)
                        {
                            // un blend tree: se toma la primera hoja con clip
                            for (int j = 1; j < nodos.Count; j++)
                            {
                                var nj = Datos((Mapa)nodos[j]);
                                int cj = nj.I32("m_ClipID", -1);
                                if (cj >= 0 && (uint)cj != 0xFFFFFFFF) { e.Clip = cj; e.Duracion = nj.F("m_Duration", 1); break; }
                            }
                        }
                    }
                }
                m.Estados[i] = e;
            }
            m.DeCualquiera = LeerTransiciones(d.L("m_AnyStateTransitionConstantArray"));
            var sel = d.L("m_SelectorStateConstantArray") ?? new List<object>();
            m.Selectores = new Selector[sel.Count];
            for (int i = 0; i < sel.Count; i++)
            {
                var s = Datos((Mapa)sel[i]);
                var ts = s.L("m_TransitionConstantArray") ?? new List<object>();
                var t = new (int, Condicion[])[ts.Count];
                for (int j = 0; j < ts.Count; j++)
                {
                    var x = Datos((Mapa)ts[j]);
                    t[j] = (x.I32("m_Destination"), LeerCondiciones(x.L("m_ConditionConstantArray")));
                }
                m.Selectores[i] = new Selector { Transiciones = t, Ruta = (int)(uint)s.I("m_FullPathID"), Entrada = s.B("m_IsEntry") };
            }
            return m;
        }

        static Transicion[] LeerTransiciones(List<object> l)
        {
            if (l == null) return Array.Empty<Transicion>();
            var r = new Transicion[l.Count];
            for (int i = 0; i < l.Count; i++)
            {
                var t = Datos((Mapa)l[i]);
                r[i] = new Transicion
                {
                    Condiciones = LeerCondiciones(t.L("m_ConditionConstantArray")),
                    Destino = t.I32("m_DestinationState"), Hash = (int)(uint)t.I("m_FullPathID"),
                    Duracion = t.F("m_TransitionDuration"), Desfase = t.F("m_TransitionOffset"), TiempoSalida = t.F("m_ExitTime"),
                    ConSalida = t.B("m_HasExitTime"), DuracionFija = t.B("m_HasFixedDuration"), Ordenada = t.B("m_OrderedInterruption", true),
                    HaciaSiMismo = t.B("m_CanTransitionToSelf", true), Interrupcion = t.I32("m_InterruptionSource"),
                };
            }
            return r;
        }

        static Condicion[] LeerCondiciones(List<object> l)
        {
            if (l == null) return Array.Empty<Condicion>();
            var r = new Condicion[l.Count];
            for (int i = 0; i < l.Count; i++)
            {
                var c = Datos((Mapa)l[i]);
                r[i] = new Condicion { Modo = c.I32("m_ConditionMode"), Parametro = (int)(uint)c.I("m_EventID"), Umbral = c.F("m_EventThreshold") };
            }
            return r;
        }

        static void LeerParametros(Mapa k, Controlador c)
        {
            var vs = Datos(k.M("m_Values") ?? new Mapa(Array.Empty<string>(), Array.Empty<object>())).L("m_ValueArray");
            var def = Datos(k.M("m_DefaultValues") ?? new Mapa(Array.Empty<string>(), Array.Empty<object>()));
            if (vs == null) return;
            var fl = def.L("m_FloatValues"); var en = def.L("m_IntValues"); var bo = def.L("m_BoolValues");
            c.Parametros = new Parametro[vs.Count];
            for (int i = 0; i < vs.Count; i++)
            {
                var v = Datos((Mapa)vs[i]);
                var p = new Parametro { Hash = (int)(uint)v.I("m_ID"), Tipo = v.I32("m_Type"), Indice = v.I32("m_Index") };
                p.Nombre = c.Textos.TryGetValue((uint)p.Hash, out var n) ? n : "";
                switch (p.Tipo)
                {
                    case 1: if (fl != null && p.Indice < fl.Count) p.Flotante = Convert.ToSingle(fl[p.Indice]); break;
                    case 3: if (en != null && p.Indice < en.Count) p.Entero = Convert.ToInt32(en[p.Indice]); break;
                    default: if (bo != null && p.Indice < bo.Count) p.Booleano = bo[p.Indice] is bool b ? b : Convert.ToInt64(bo[p.Indice]) != 0; break;
                }
                c.Parametros[i] = p;
                c.PorHash[p.Hash] = p;
            }
        }

        static void LeerComportamientos(Mapa m, IResolutor r, Controlador c)
        {
            var lista = m.L("m_StateMachineBehaviours");
            var desc = m.M("m_StateMachineBehaviourVectorDescription");
            if (lista == null || lista.Count == 0 || desc == null) return;
            var objs = new Object[lista.Count];
            for (int i = 0; i < objs.Length; i++) objs[i] = lista[i] is PPtr p ? r.Resolver(p) : null;
            var indices = desc.L("m_StateMachineBehaviourIndices");
            var rangos = desc.L("m_StateMachineBehaviourRanges");
            if (indices == null || rangos == null) return;
            foreach (var x in rangos)
            {
                if (!(x is List<object> par) || par.Count != 2 || !(par[0] is Mapa clave) || !(par[1] is Mapa rango)) continue;
                int desde = rango.I32("m_StartIndex"), n = rango.I32("m_Count");
                var l = new List<Object>();
                for (int j = desde; j < desde + n && j < indices.Count; j++)
                {
                    int idx = Convert.ToInt32(indices[j]);
                    if (idx >= 0 && idx < objs.Length && objs[idx] != null) l.Add(objs[idx]);
                }
                c.Comportamientos[(clave.I32("m_LayerIndex"), (int)(uint)clave.I("m_StateID"))] = l.ToArray();
            }
        }

        public string Texto(int hash) => Textos.TryGetValue((uint)hash, out var s) ? s : "";
    }
}

namespace UnityEngine
{
    public partial class RuntimeAnimatorController : Object
    {
        internal Controlador datos;

        internal override void LeerNativo(Mapa m, IResolutor r) => datos = Controlador.Leer(m, r);

        // el controlador de verdad y los clips que lo reemplazan (AnimatorOverrideController)
        internal virtual Controlador Base => datos;
        internal virtual AnimationClip Clip(int i) => datos != null && i >= 0 && i < datos.Clips.Length ? datos.Clips[i] : null;

        public AnimationClip[] animationClips => datos?.Clips is AnimationClip[] c ? (AnimationClip[])c.Clone() : Array.Empty<AnimationClip>();
    }

    public partial class AnimatorOverrideController : RuntimeAnimatorController
    {
        internal RuntimeAnimatorController original;
        internal readonly Dictionary<AnimationClip, AnimationClip> reemplazos = new Dictionary<AnimationClip, AnimationClip>();

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            original = r.Resolver(m.P("m_Controller")) as RuntimeAnimatorController;
            var l = m.L("m_Clips");
            if (l == null) return;
            foreach (Mapa par in l)
            {
                var a = r.Resolver(par.P("m_OriginalClip")) as AnimationClip;
                var b = r.Resolver(par.P("m_OverrideClip")) as AnimationClip;
                if (a != null && b != null) reemplazos[a] = b;
            }
        }

        internal override Controlador Base => original?.Base;

        internal override AnimationClip Clip(int i)
        {
            var c = original?.Clip(i);
            return c != null && reemplazos.TryGetValue(c, out var o) ? o : c;
        }

        public RuntimeAnimatorController runtimeAnimatorController { get => original; set => original = value; }

        public AnimationClip this[AnimationClip clip]
        {
            get => clip != null && reemplazos.TryGetValue(clip, out var o) ? o : clip;
            set { if (clip == null) return; if (value == null) reemplazos.Remove(clip); else reemplazos[clip] = value; }
        }
    }
}

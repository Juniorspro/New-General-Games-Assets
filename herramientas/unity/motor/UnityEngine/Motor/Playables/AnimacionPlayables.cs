using System;
using System.Collections.Generic;
using Porteo.Animacion;
using Porteo.Playables;
using UnityEngine.Playables;
using Object = UnityEngine.Object;

// Los playables de animación (UnityEngine.Animations) y la salida que mueve un Animator. Lo que
// Unity hace en su sistema de animación lo hace acá MezcladorTimeline: junta los clips de cada
// salida con su peso (mezcladores, capas y desfases), los muestrea con el muestreador del motor y
// escribe la pose encima de la del controlador del Animator (si tiene), como una salida de peso 1.
namespace UnityEngine.Animations
{
    public struct AnimationClipPlayable : IPlayable, IEquatable<AnimationClipPlayable>
    {
        readonly PlayableHandle m_Handle;
        internal AnimationClipPlayable(PlayableHandle h) { m_Handle = h; }

        public static AnimationClipPlayable Create(PlayableGraph graph, AnimationClip clip)
        {
            var n = new Nodo(graph.G, TipoNodo.ClipAnimacion, typeof(AnimationClipPlayable), 0) { Clip = clip };
            if (clip != null) n.Duracion = clip.length;
            return new AnimationClipPlayable(new PlayableHandle(n));
        }

        public PlayableHandle GetHandle() => m_Handle;
        public static implicit operator Playable(AnimationClipPlayable playable) => new Playable(playable.GetHandle());
        public static explicit operator AnimationClipPlayable(Playable playable) => new AnimationClipPlayable(playable.GetHandle());
        public bool Equals(AnimationClipPlayable other) => GetHandle() == other.GetHandle();
        public AnimationClip GetAnimationClip() => m_Handle.m_Nodo?.Clip;
        public bool GetApplyFootIK() => false;
        public void SetApplyFootIK(bool value) { }
        public bool GetApplyPlayableIK() => false;
        public void SetApplyPlayableIK(bool value) { }
        public bool GetRemoveStartOffset() => m_Handle.m_Nodo?.QuitarDesfaseInicial ?? false;
        public void SetRemoveStartOffset(bool value) { if (m_Handle.m_Nodo != null) m_Handle.m_Nodo.QuitarDesfaseInicial = value; }
        public bool GetOverrideLoopTime() => m_Handle.m_Nodo?.BucleClipPropio ?? false;
        public void SetOverrideLoopTime(bool value) { if (m_Handle.m_Nodo != null) m_Handle.m_Nodo.BucleClipPropio = value; }
        public bool GetLoopTime() => m_Handle.m_Nodo?.BucleClip ?? false;
        public void SetLoopTime(bool value) { if (m_Handle.m_Nodo != null) m_Handle.m_Nodo.BucleClip = value; }
        [Obsolete] public float GetSampleRate() => m_Handle.m_Nodo?.Clip?.frameRate ?? 60;
        [Obsolete] public void SetSampleRate(float value) { }
    }

    public struct AnimationMixerPlayable : IPlayable, IEquatable<AnimationMixerPlayable>
    {
        readonly PlayableHandle m_Handle;
        internal AnimationMixerPlayable(PlayableHandle h) { m_Handle = h; }
        public static AnimationMixerPlayable Null => default;

        public static AnimationMixerPlayable Create(PlayableGraph graph, int inputCount = 0) =>
            new AnimationMixerPlayable(new PlayableHandle(new Nodo(graph.G, TipoNodo.MezclaAnimacion, typeof(AnimationMixerPlayable), inputCount)));
        [Obsolete] public static AnimationMixerPlayable Create(PlayableGraph graph, int inputCount, bool normalizeWeights) => Create(graph, inputCount);

        public PlayableHandle GetHandle() => m_Handle;
        public static implicit operator Playable(AnimationMixerPlayable playable) => new Playable(playable.GetHandle());
        public static explicit operator AnimationMixerPlayable(Playable playable) => new AnimationMixerPlayable(playable.GetHandle());
        public bool Equals(AnimationMixerPlayable other) => GetHandle() == other.GetHandle();
    }

    public struct AnimationLayerMixerPlayable : IPlayable, IEquatable<AnimationLayerMixerPlayable>
    {
        readonly PlayableHandle m_Handle;
        internal AnimationLayerMixerPlayable(PlayableHandle h) { m_Handle = h; }
        public static AnimationLayerMixerPlayable Null => default;

        public static AnimationLayerMixerPlayable Create(PlayableGraph graph, int inputCount = 0) => Create(graph, inputCount, true);
        public static AnimationLayerMixerPlayable Create(PlayableGraph graph, int inputCount, bool singleLayerOptimization) =>
            new AnimationLayerMixerPlayable(new PlayableHandle(new Nodo(graph.G, TipoNodo.CapasAnimacion, typeof(AnimationLayerMixerPlayable), inputCount)));

        public PlayableHandle GetHandle() => m_Handle;
        public static implicit operator Playable(AnimationLayerMixerPlayable playable) => new Playable(playable.GetHandle());
        public static explicit operator AnimationLayerMixerPlayable(Playable playable) => new AnimationLayerMixerPlayable(playable.GetHandle());
        public bool Equals(AnimationLayerMixerPlayable other) => GetHandle() == other.GetHandle();
        public bool IsLayerAdditive(uint layerIndex) { var a = m_Handle.m_Nodo?.CapasAditivas; return a != null && layerIndex < a.Length && a[layerIndex]; }
        public void SetLayerAdditive(uint layerIndex, bool value)
        {
            var n = m_Handle.N;
            if (n.CapasAditivas == null || n.CapasAditivas.Length <= layerIndex) Array.Resize(ref n.CapasAditivas, (int)layerIndex + 1);
            n.CapasAditivas[layerIndex] = value;
        }
        public void SetLayerMaskFromAvatarMask(uint layerIndex, AvatarMask mask) { }
    }

    public struct AnimationOffsetPlayable : IPlayable, IEquatable<AnimationOffsetPlayable>
    {
        readonly PlayableHandle m_Handle;
        internal AnimationOffsetPlayable(PlayableHandle h) { m_Handle = h; }
        public static AnimationOffsetPlayable Null => default;

        public static AnimationOffsetPlayable Create(PlayableGraph graph, Vector3 position, Quaternion rotation, int inputCount) =>
            new AnimationOffsetPlayable(new PlayableHandle(new Nodo(graph.G, TipoNodo.Desfase, typeof(AnimationOffsetPlayable), inputCount) { PosDesfase = position, RotDesfase = rotation }));

        public PlayableHandle GetHandle() => m_Handle;
        public static implicit operator Playable(AnimationOffsetPlayable playable) => new Playable(playable.GetHandle());
        public static explicit operator AnimationOffsetPlayable(Playable playable) => new AnimationOffsetPlayable(playable.GetHandle());
        public bool Equals(AnimationOffsetPlayable other) => GetHandle() == other.GetHandle();
        public Vector3 GetPosition() => m_Handle.m_Nodo?.PosDesfase ?? Vector3.zero;
        public void SetPosition(Vector3 value) => m_Handle.N.PosDesfase = value;
        public Quaternion GetRotation() => m_Handle.m_Nodo?.RotDesfase ?? Quaternion.identity;
        public void SetRotation(Quaternion value) => m_Handle.N.RotDesfase = value;
    }

    public struct AnimationMotionXToDeltaPlayable : IPlayable, IEquatable<AnimationMotionXToDeltaPlayable>
    {
        readonly PlayableHandle m_Handle;
        internal AnimationMotionXToDeltaPlayable(PlayableHandle h) { m_Handle = h; }
        public static AnimationMotionXToDeltaPlayable Null => default;

        public static AnimationMotionXToDeltaPlayable Create(PlayableGraph graph) =>
            new AnimationMotionXToDeltaPlayable(new PlayableHandle(new Nodo(graph.G, TipoNodo.MovimientoDelta, typeof(AnimationMotionXToDeltaPlayable), 1)));

        public PlayableHandle GetHandle() => m_Handle;
        public static implicit operator Playable(AnimationMotionXToDeltaPlayable playable) => new Playable(playable.GetHandle());
        public static explicit operator AnimationMotionXToDeltaPlayable(Playable playable) => new AnimationMotionXToDeltaPlayable(playable.GetHandle());
        public bool Equals(AnimationMotionXToDeltaPlayable other) => GetHandle() == other.GetHandle();
        public bool IsAbsoluteMotion() => true;
        public void SetAbsoluteMotion(bool value) { }
    }

    public struct AnimationRemoveScalePlayable : IPlayable, IEquatable<AnimationRemoveScalePlayable>
    {
        readonly PlayableHandle m_Handle;
        internal AnimationRemoveScalePlayable(PlayableHandle h) { m_Handle = h; }
        public static AnimationRemoveScalePlayable Null => default;

        public static AnimationRemoveScalePlayable Create(PlayableGraph graph, int inputCount) =>
            new AnimationRemoveScalePlayable(new PlayableHandle(new Nodo(graph.G, TipoNodo.SinEscala, typeof(AnimationRemoveScalePlayable), inputCount)));

        public PlayableHandle GetHandle() => m_Handle;
        public static implicit operator Playable(AnimationRemoveScalePlayable playable) => new Playable(playable.GetHandle());
        public static explicit operator AnimationRemoveScalePlayable(Playable playable) => new AnimationRemoveScalePlayable(playable.GetHandle());
        public bool Equals(AnimationRemoveScalePlayable other) => GetHandle() == other.GetHandle();
    }

    public struct AnimatorControllerPlayable : IPlayable, IEquatable<AnimatorControllerPlayable>
    {
        readonly PlayableHandle m_Handle;
        internal AnimatorControllerPlayable(PlayableHandle h) { m_Handle = h; }
        public static AnimatorControllerPlayable Null => default;

        public static AnimatorControllerPlayable Create(PlayableGraph graph, RuntimeAnimatorController controller) =>
            new AnimatorControllerPlayable(new PlayableHandle(new Nodo(graph.G, TipoNodo.ControladorAnimacion, typeof(AnimatorControllerPlayable), 0)));

        public PlayableHandle GetHandle() => m_Handle;
        public static implicit operator Playable(AnimatorControllerPlayable playable) => new Playable(playable.GetHandle());
        public static explicit operator AnimatorControllerPlayable(Playable playable) => new AnimatorControllerPlayable(playable.GetHandle());
        public bool Equals(AnimatorControllerPlayable other) => GetHandle() == other.GetHandle();
    }

    public struct AnimationPlayableOutput : IPlayableOutput
    {
        readonly PlayableOutputHandle m_Handle;
        internal AnimationPlayableOutput(PlayableOutputHandle h) { m_Handle = h; }
        public static AnimationPlayableOutput Null => default;

        public static AnimationPlayableOutput Create(PlayableGraph graph, string name, Animator target)
        {
            var s = new Salida(graph.G, typeof(AnimationPlayableOutput), name);
            var o = new AnimationPlayableOutput(new PlayableOutputHandle(s));
            o.SetTarget(target);
            return o;
        }

        public PlayableOutputHandle GetHandle() => m_Handle;
        public static implicit operator PlayableOutput(AnimationPlayableOutput output) => new PlayableOutput(output.GetHandle());
        public static explicit operator AnimationPlayableOutput(PlayableOutput output) => new AnimationPlayableOutput(output.GetHandle());
        public Animator GetTarget() => m_Handle.m_Salida?.Animador;
        public void SetTarget(Animator value)
        {
            var s = m_Handle.S;
            if (s.Animador == value) return;
            s.Mezclador?.Soltar();
            s.Mezclador = null;
            s.Animador = value;
        }
    }

    public static class AnimationPlayableBinding
    {
        public static PlayableBinding Create(string name, Object key) =>
            PlayableBinding.CreateInternal(name, key, typeof(Animator), (g, n) => AnimationPlayableOutput.Create(g, n, null));
    }

    public static class AnimationPlayableExtensions
    {
        public static void SetAnimatedProperties<U>(this U playable, AnimationClip clip) where U : struct, IPlayable { }
    }

    public enum Axis { None = 0, X = 1, Y = 2, Z = 4 }

    public interface IAnimationWindowPreview
    {
        void StartPreview();
        void StopPreview();
        void UpdatePreviewGraph(PlayableGraph graph);
        Playable BuildPreviewGraph(PlayableGraph graph, Playable inputPlayable);
    }
}

namespace Porteo.Playables
{
    using UnityEngine;
    using UnityEngine.Animations;

    // un clip con su peso y el desfase de la raíz que le toca (lo que junta el recorrido de una salida)
    internal struct Aporte
    {
        public AnimationClip Clip;
        public double Tiempo, TiempoPrevio;
        public float Peso;
        public Vector3 Pos;
        public Quaternion Rot;
        public bool QuitarInicio, Bucle, BucleFijo;
    }

    internal static class AnimacionTimeline
    {
        static readonly List<MezcladorTimeline> pendientes = new List<MezcladorTimeline>();
        static readonly List<Aporte> capa = new List<Aporte>(), debajo = new List<Aporte>();

        // durante la evaluación del grafo: qué clips y con qué peso
        internal static void Juntar(Salida s)
        {
            var an = s.Animador;
            if (an == null || an.destruido) return;
            s.Mezclador ??= new MezcladorTimeline(an);
            var l = s.Mezclador.Aportes;
            l.Clear();
            Recorrer(s.Fuente, s.Puerto, s.Peso, Vector3.zero, Quaternion.identity, l);
            if (!pendientes.Contains(s.Mezclador)) pendientes.Add(s.Mezclador);
        }

        static void Recorrer(Nodo n, int puerto, float w, Vector3 pos, Quaternion rot, List<Aporte> l)
        {
            if (n == null || n.Destruido || w <= 1e-5f) return;
            switch (n.Tipo)
            {
                case TipoNodo.ClipAnimacion:
                    if (n.Clip != null)
                        l.Add(new Aporte { Clip = n.Clip, Tiempo = n.Tiempo, TiempoPrevio = n.TiempoPrevio, Peso = w, Pos = pos, Rot = rot, QuitarInicio = n.QuitarDesfaseInicial, Bucle = n.BucleClip, BucleFijo = n.BucleClipPropio });
                    return;
                case TipoNodo.Desfase:
                    pos += rot * n.PosDesfase;
                    rot = rot * n.RotDesfase;
                    break;
                case TipoNodo.CapasAnimacion:
                {
                    // cada capa pisa a las de abajo con su peso (como Mecanim con capas de reemplazo)
                    int i0 = l.Count;
                    for (int i = 0; i < n.Entradas.Count; i++)
                    {
                        var e = n.Entradas[i];
                        float wc = n.Pesos[i];
                        if (e == null || wc <= 1e-5f) continue;
                        capa.Clear();
                        Recorrer(e, -1, 1, pos, rot, capa);
                        if (capa.Count == 0) continue;
                        bool aditiva = n.CapasAditivas != null && i < n.CapasAditivas.Length && n.CapasAditivas[i];
                        if (i > 0 && !aditiva)
                            for (int k = i0; k < l.Count; k++) { var a = l[k]; a.Peso *= 1 - wc; l[k] = a; }
                        foreach (var a0 in capa) { var a = a0; a.Peso *= (i == 0 ? 1 : wc) * w; l.Add(a); }
                    }
                    return;
                }
            }
            int solo = n.Recorrido == PlayableTraversalMode.Passthrough && puerto >= 0 && puerto < n.Entradas.Count ? puerto : -1;
            for (int i = 0; i < n.Entradas.Count; i++)
            {
                if (solo >= 0 && i != solo) continue;
                var e = n.Entradas[i];
                if (e == null) continue;
                // un desfase, un quitar escala o un delta de movimiento pasan su entrada tal cual
                float wi = n.Tipo == TipoNodo.Desfase || n.Tipo == TipoNodo.SinEscala || n.Tipo == TipoNodo.MovimientoDelta ? 1 : n.Pesos[i];
                Recorrer(e, -1, w * wi, pos, rot, l);
            }
        }

        // un director en pausa: su pose sigue puesta (si no, el controlador del Animator la pisaría)
        internal static void Repetir(Salida s)
        {
            if (s.Mezclador != null && !pendientes.Contains(s.Mezclador)) pendientes.Add(s.Mezclador);
        }

        // después de los animadores: la pose de Timeline encima
        internal static void Aplicar()
        {
            if (pendientes.Count == 0) return;
            foreach (var m in pendientes.ToArray())
            {
                try { m.Aplicar(); }
                catch (Exception e) { Debug.LogException(e); }
            }
            pendientes.Clear();
        }
    }

    // La pose que pone Timeline en un Animator: los valores que anima cada clip (con el enlazador del
    // motor), mezclados con sus pesos sobre lo que el objeto ya tenía este cuadro.
    internal sealed class MezcladorTimeline
    {
        readonly Animator an;
        readonly Transform raiz;
        readonly Enlazador enl;
        readonly Dictionary<AnimationClip, (int[] mapa, float[] muestras, float[] inicio)> porClip = new Dictionary<AnimationClip, (int[], float[], float[])>();
        internal readonly List<Aporte> Aportes = new List<Aporte>();
        float[] defecto = Array.Empty<float>(), cur = Array.Empty<float>(), acum = Array.Empty<float>();
        float[] pesoTotal = Array.Empty<float>();
        bool[] tocado = Array.Empty<bool>();
        int leidos;   // cuántos valores tienen su valor por defecto guardado
        bool soltado;

        internal MezcladorTimeline(Animator an)
        {
            this.an = an;
            raiz = an.transform;
            enl = new Enlazador(raiz);
            an.salidasPlayables++;
        }

        (int[] mapa, float[] muestras, float[] inicio) Clip(AnimationClip c)
        {
            if (porClip.TryGetValue(c, out var x)) return x;
            var m = new int[c.enlaces.Length];
            for (int k = 0; k < m.Length; k++)
            {
                var v = enl.Enlazar(c.enlaces[k], c);
                m[k] = v != null ? enl.valores.IndexOf(v) : -1;
            }
            var muestras = new float[Math.Max(1, c.NCurvas)];
            // el primer cuadro del clip: para que la raíz arranque desde el desfase (removeStartOffset)
            var inicio = new float[Math.Max(1, c.NCurvas)];
            c.Muestrear(c.TiempoClip(0), inicio);
            x = (m, muestras, inicio);
            porClip[c] = x;
            Crecer();
            return x;
        }

        void Crecer()
        {
            int tam = enl.tam, n = enl.valores.Count;
            if (defecto.Length < tam)
            {
                Array.Resize(ref defecto, tam); Array.Resize(ref cur, tam); Array.Resize(ref acum, tam);
            }
            if (pesoTotal.Length < n) { Array.Resize(ref pesoTotal, n); Array.Resize(ref tocado, n); }
            // lo que tenía el objeto antes de que Timeline lo moviera: vuelve así al terminar
            for (int i = leidos; i < n; i++) { var v = enl.valores[i]; if (v.Tipo != TipoValor.PPtr) v.Leer(defecto, v.Off); }
            leidos = n;
        }

        internal void Aplicar()
        {
            if (soltado || an == null || an.destruido) return;
            var vals = enl.valores;
            foreach (var a in Aportes) Clip(a.Clip);
            int n = vals.Count;
            Array.Clear(tocado, 0, n);
            Array.Clear(pesoTotal, 0, n);
            Array.Clear(acum, 0, enl.tam);
            foreach (var a in Aportes)
            {
                var (mapa, s, ini) = Clip(a.Clip);
                var c = a.Clip;
                float t = TiempoDe(c, a.Tiempo, a);
                c.Muestrear(t, s);
                var es = c.enlaces;
                for (int k = 0; k < es.Length; k++)
                {
                    int vi = mapa[k];
                    if (vi < 0) continue;
                    var v = vals[vi];
                    ref readonly var en = ref es[k];
                    int o = v.Off, ci = en.Curva;
                    if (ci + en.N > s.Length) continue;
                    if (!tocado[vi]) { tocado[vi] = true; if (v.Tipo != TipoValor.PPtr) v.Leer(cur, o); }
                    pesoTotal[vi] += a.Peso;
                    bool esRaiz = v.T == raiz;
                    if (v.Tipo == TipoValor.Rotacion)
                    {
                        var q = en.Atributo == 4 ? Quaternion.Euler(s[ci], s[ci + 1], s[ci + 2]) : new Quaternion(s[ci], s[ci + 1], s[ci + 2], s[ci + 3]);
                        if (esRaiz)
                        {
                            if (a.QuitarInicio)
                            {
                                var q0 = en.Atributo == 4 ? Quaternion.Euler(ini[ci], ini[ci + 1], ini[ci + 2]) : new Quaternion(ini[ci], ini[ci + 1], ini[ci + 2], ini[ci + 3]);
                                q = Quaternion.Inverse(q0) * q;
                            }
                            q = a.Rot * q;
                        }
                        SumarQ(o, q, a.Peso);
                    }
                    else if (v.Tipo == TipoValor.Posicion && esRaiz)
                    {
                        var p = new Vector3(s[ci], s[ci + 1], s[ci + 2]);
                        if (a.QuitarInicio) p = InicioInverso(c, mapa, ini, vals, vi) * (p - new Vector3(ini[ci], ini[ci + 1], ini[ci + 2]));
                        p = a.Rot * p + a.Pos;
                        acum[o] += a.Peso * p.x; acum[o + 1] += a.Peso * p.y; acum[o + 2] += a.Peso * p.z;
                    }
                    else if (v.Tipo == TipoValor.PPtr)
                    {
                        if (a.Peso >= 0.5f || v.ObjetoActual2 == null)
                        {
                            int idx = (int)Math.Round(s[ci]);
                            v.ObjetoActual2 = idx >= 0 && idx < c.objetosPPtr.Length ? c.objetosPPtr[idx] : null;
                        }
                    }
                    else for (int c2 = 0; c2 < v.Tam && c2 < en.N; c2++) acum[o + c2] += a.Peso * s[ci + c2];
                }
                Eventos(c, a);
            }
            // lo que falta para peso 1 queda con lo que el objeto ya tenía (el controlador o la escena)
            for (int i = 0; i < n; i++)
            {
                if (!tocado[i]) continue;
                var v = vals[i];
                int o = v.Off;
                float resto = Math.Max(0, 1 - pesoTotal[i]);
                switch (v.Tipo)
                {
                    case TipoValor.Rotacion:
                    {
                        if (resto > 0) SumarQ(o, new Quaternion(cur[o], cur[o + 1], cur[o + 2], cur[o + 3]), resto);
                        var q = new Quaternion(acum[o], acum[o + 1], acum[o + 2], acum[o + 3]);
                        float len = (float)Math.Sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
                        if (len < 1e-6f) break;
                        v.T.PonerLocal(1, default, new Quaternion(q.x / len, q.y / len, q.z / len, q.w / len));
                        break;
                    }
                    case TipoValor.Posicion:
                        v.T.PonerLocal(0, new Vector3(acum[o] + resto * cur[o], acum[o + 1] + resto * cur[o + 1], acum[o + 2] + resto * cur[o + 2]), default);
                        break;
                    case TipoValor.Escala:
                        v.T.PonerLocal(2, new Vector3(acum[o] + resto * cur[o], acum[o + 1] + resto * cur[o + 1], acum[o + 2] + resto * cur[o + 2]), default);
                        break;
                    case TipoValor.PPtr:
                        v.EscribirObjeto(v.ObjetoActual2);
                        break;
                    case TipoValor.Nada:
                    case TipoValor.Musculo:
                        break;
                    default:
                        for (int k = 0; k < v.Tam; k++) acum[o + k] += resto * cur[o + k];
                        v.Escribir(acum, o);
                        break;
                }
            }
            for (int i = 0; i < n; i++)
            {
                var v = vals[i];
                if (tocado[i] && v.T != null) v.T.AplicarLocal();
            }
        }

        // la rotación del primer cuadro de la raíz (para dejar la posición relativa a ella)
        static Quaternion InicioInverso(AnimationClip c, int[] mapa, float[] ini, List<Valor> vals, int viPos)
        {
            var es = c.enlaces;
            var t = vals[viPos].T;
            for (int k = 0; k < es.Length; k++)
            {
                int vi = mapa[k];
                if (vi < 0 || vals[vi].T != t || vals[vi].Tipo != TipoValor.Rotacion) continue;
                int ci = es[k].Curva;
                var q0 = es[k].Atributo == 4 ? Quaternion.Euler(ini[ci], ini[ci + 1], ini[ci + 2]) : new Quaternion(ini[ci], ini[ci + 1], ini[ci + 2], ini[ci + 3]);
                return Quaternion.Inverse(q0);
            }
            return Quaternion.identity;
        }

        static float TiempoDe(AnimationClip c, double t, in Aporte a)
        {
            float largo = c.fin - c.inicio;
            bool bucle = a.BucleFijo ? a.Bucle : c.bucle;
            float x = (float)t;
            if (largo <= 0) return c.inicio;
            if (bucle) { x %= largo; if (x < 0) x += largo; }
            else x = Math.Clamp(x, 0, largo);
            return c.inicio + x;
        }

        // los eventos del clip entre el tiempo anterior y el de ahora (si el tiempo avanzó)
        void Eventos(AnimationClip c, in Aporte a)
        {
            if (c.eventos.Length == 0 || !an.fireEvents) return;
            double desde = a.TiempoPrevio, hasta = a.Tiempo;
            if (hasta <= desde || hasta - desde > 1) return;
            foreach (var ev in c.eventos)
            {
                double t = ev.Tiempo - c.inicio;
                if (t > desde && t <= hasta) Evento.Llamar(an.gameObject, ev, null);
            }
        }

        void SumarQ(int o, Quaternion q, float w)
        {
            float d = acum[o] * q.x + acum[o + 1] * q.y + acum[o + 2] * q.z + acum[o + 3] * q.w;
            if (d < 0) w = -w;
            acum[o] += w * q.x; acum[o + 1] += w * q.y; acum[o + 2] += w * q.z; acum[o + 3] += w * q.w;
        }

        // la salida se destruyó (el director paró): todo vuelve a como estaba antes de Timeline
        internal void Soltar()
        {
            if (soltado) return;
            soltado = true;
            if (an != null) an.salidasPlayables = Math.Max(0, an.salidasPlayables - 1);
            if (an == null || an.destruido) return;
            var vals = enl.valores;
            for (int i = 0; i < leidos; i++)
            {
                var v = vals[i];
                int o = v.Off;
                switch (v.Tipo)
                {
                    case TipoValor.Posicion: if (v.T != null && !v.T.destruido) v.T.PonerLocal(0, new Vector3(defecto[o], defecto[o + 1], defecto[o + 2]), default); break;
                    case TipoValor.Escala: if (v.T != null && !v.T.destruido) v.T.PonerLocal(2, new Vector3(defecto[o], defecto[o + 1], defecto[o + 2]), default); break;
                    case TipoValor.Rotacion: if (v.T != null && !v.T.destruido) v.T.PonerLocal(1, default, new Quaternion(defecto[o], defecto[o + 1], defecto[o + 2], defecto[o + 3])); break;
                    case TipoValor.PPtr: v.EscribirObjeto(v.ObjetoDefecto); break;
                    case TipoValor.Nada: case TipoValor.Musculo: case TipoValor.Activo: break;
                    default: v.Escribir(defecto, o); break;
                }
                if (v.T != null && !v.T.destruido) v.T.AplicarLocal();
            }
        }
    }
}

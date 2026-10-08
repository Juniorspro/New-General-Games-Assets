using System;
using System.Collections;
using System.Collections.Generic;
using Porteo;
using Porteo.Animacion;
using Porteo.Datos;
using UnityEngine;
using Object = UnityEngine.Object;

namespace UnityEngine
{
    public enum PlayMode { StopSameLayer = 0, StopAll = 4 }
    public enum QueueMode { CompleteOthers = 0, PlayNow = 2 }
    public enum AnimationBlendMode { Blend = 0, Additive = 1 }
    public enum AnimationCullingType { AlwaysAnimate = 0, BasedOnRenderers = 1, BasedOnClipBounds = 2, BasedOnUserBounds = 3 }

    // La animación legacy: cada clip es un AnimationState con su tiempo, velocidad y peso; los que
    // están habilitados se mezclan por peso y escriben directo en los objetos (sin valores por
    // defecto, como en Unity).
    public sealed partial class Animation : Behaviour, IEnumerable
    {
        internal AnimationClip clipDefecto;
        internal readonly List<AnimationState> estados = new List<AnimationState>();
        internal bool autoPlay = true, fisica;
        internal WrapMode envoltura;
        internal AnimationCullingType tipoCulling;
        bool arrancada;
        Enlazador enl;
        readonly Dictionary<AnimationClip, (int[] mapa, float[] muestras)> enlaces = new Dictionary<AnimationClip, (int[], float[])>();
        float[] acum, cur, pesos;
        List<Renderer> renderers;

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            clipDefecto = r.Resolver(m.P("m_Animation")) as AnimationClip;
            var l = m.L("m_Animations");
            if (l != null)
                foreach (var x in l)
                    if (x is PPtr p && r.Resolver(p) is AnimationClip c) Agregar(c, c.name);
            autoPlay = m.B("m_PlayAutomatically", true);
            envoltura = (WrapMode)m.I32("m_WrapMode");
            fisica = m.B("m_AnimatePhysics");
            tipoCulling = (AnimationCullingType)m.I32("m_CullingType");
        }

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            base.CopiarDe(o, remap);
            var a = (Animation)o;
            clipDefecto = a.clipDefecto; autoPlay = a.autoPlay; envoltura = a.envoltura; fisica = a.fisica; tipoCulling = a.tipoCulling;
            estados.Clear();
            foreach (var e in a.estados) Agregar(e.clipInterno, e.nombre);
        }

        AnimationState Agregar(AnimationClip c, string nombre)
        {
            foreach (var e in estados) if (e.nombre == nombre) return e;
            var s = new AnimationState { anim = this, clipInterno = c, nombre = nombre };
            estados.Add(s);
            return s;
        }

        internal override void AlActivarse()
        {
            Animadores.Alta(this);
            if (!arrancada) { arrancada = true; if (autoPlay && clipDefecto != null) Play(); }
            else if (autoPlay && clipDefecto != null && !isPlaying) Play();
        }

        internal override void AlDesactivarse() => Animadores.Baja(this);
        internal override void AlDestruirse() => Animadores.Baja(this);

        WrapMode Envoltura(AnimationState s)
        {
            if (s.envolturaPropia != WrapMode.Default) return s.envolturaPropia;
            if (envoltura != WrapMode.Default) return envoltura;
            return s.clipInterno != null ? s.clipInterno.envoltura : WrapMode.Default;
        }

        bool Visible()
        {
            if (tipoCulling == AnimationCullingType.AlwaysAnimate || !Porteo.Render.Gpu.Activo) return true;
            renderers ??= new List<Renderer>(GetComponentsInChildren<Renderer>(true));
            foreach (var r in renderers) if (r != null && !r.destruido && r.isVisible) return true;
            return renderers.Count == 0;
        }

        // ── el cuadro ──
        internal void Paso(float dt)
        {
            if (estados.Count == 0) return;
            bool alguno = false;
            foreach (var s in estados.ToArray())
            {
                if (!s.habilitado) continue;
                alguno = true;
                // los fundidos de peso
                if (s.duracionFundido > 0)
                {
                    float paso = dt / s.duracionFundido;
                    s.peso = s.peso < s.pesoObjetivo ? Math.Min(s.pesoObjetivo, s.peso + paso) : Math.Max(s.pesoObjetivo, s.peso - paso);
                    if (s.peso == s.pesoObjetivo) s.duracionFundido = 0;
                }
                if (s.detenerAlApagarse && s.peso <= 0 && s.pesoObjetivo <= 0) { s.habilitado = false; s.detenerAlApagarse = false; continue; }
                float largo = s.length;
                float t0 = s.tiempo;
                s.tiempo += dt * s.velocidad;
                var wm = Envoltura(s);
                if (s.clipInterno != null && s.clipInterno.eventos.Length > 0 && s.peso > 0) Eventos(s, t0, s.tiempo, wm);
                if ((wm == WrapMode.Once || wm == WrapMode.Default) && largo > 0 && s.tiempo >= largo)
                {
                    // Once: al terminar se detiene (la pose queda en el último cuadro)
                    s.tiempoMuestra = largo;
                    s.habilitado = false;
                    s.tiempo = 0;
                    s.terminoEsteCuadro = true;
                }
            }
            // la cola: lo encolado arranca cuando terminó lo demás
            if (cola.Count > 0)
            {
                bool otros = false;
                foreach (var s in estados) if (s.habilitado && !s.terminoEsteCuadro) otros = true;
                if (!otros) { var (n, f) = cola[0]; cola.RemoveAt(0); CrossFade(n, f); }
            }
            if (!alguno && !HayTerminados()) return;
            if (Visible()) Evaluar();
            foreach (var s in estados) s.terminoEsteCuadro = false;
        }

        bool HayTerminados() { foreach (var s in estados) if (s.terminoEsteCuadro) return true; return false; }

        void Eventos(AnimationState s, float t0, float t1, WrapMode wm)
        {
            var c = s.clipInterno;
            float largo = c.length;
            if (largo <= 0 || t1 <= t0) return;
            if (wm == WrapMode.Loop || wm == WrapMode.PingPong)
            {
                double v0 = Math.Floor(t0 / largo), v1 = Math.Floor(t1 / largo);
                for (double v = v0; v <= v1 && v - v0 < 64; v++)
                {
                    float a = (float)Math.Max(t0 - v * largo, 0), b = (float)Math.Min(t1 - v * largo, largo);
                    Disparar(s, a, b, a <= 0);
                }
            }
            else Disparar(s, t0, Math.Min(t1, largo), t0 <= 0);
        }

        void Disparar(AnimationState s, float a, float b, bool desdeCero)
        {
            foreach (var ev in s.clipInterno.eventos)
            {
                float t = ev.Tiempo - s.clipInterno.inicio;
                if ((t > a || (desdeCero && t >= a)) && t <= b) Evento.Llamar(gameObject, ev, s);
            }
        }

        (int[] mapa, float[] muestras) Enlaces(AnimationClip c)
        {
            if (enlaces.TryGetValue(c, out var x)) return x;
            enl ??= new Enlazador(transform);
            var m = new int[c.enlaces.Length];
            for (int i = 0; i < m.Length; i++)
            {
                var v = enl.Enlazar(c.enlaces[i], c);
                m[i] = v != null ? enl.valores.IndexOf(v) : -1;
            }
            x = (m, new float[Math.Max(1, c.NCurvas)]);
            enlaces[c] = x;
            return x;
        }

        // la mezcla: los estados por peso (si suman menos de 1, el resto queda como está)
        void Evaluar()
        {
            foreach (var s in estados)
                if ((s.habilitado || s.terminoEsteCuadro) && s.clipInterno != null) Enlaces(s.clipInterno);
            if (enl == null) return;
            var vals = enl.valores;
            int tam = enl.tam;
            if (acum == null || acum.Length < tam) { acum = new float[tam]; cur = new float[tam]; }
            if (pesos == null || pesos.Length < vals.Count) pesos = new float[vals.Count];
            Array.Clear(acum, 0, tam);
            Array.Clear(pesos, 0, vals.Count);
            float total = 0;
            foreach (var s in estados) if ((s.habilitado || s.terminoEsteCuadro) && s.clipInterno != null) total += s.peso;
            if (total <= 0) return;
            float norma = total > 1 ? 1 / total : 1;
            foreach (var s in estados)
            {
                if (!(s.habilitado || s.terminoEsteCuadro) || s.clipInterno == null || s.peso <= 0) continue;
                var c = s.clipInterno;
                var (mapa, muestras) = Enlaces(c);
                float t = s.terminoEsteCuadro ? s.tiempoMuestra : TiempoEn(s);
                c.Muestrear(c.inicio + t, muestras);
                float w = s.peso * norma;
                for (int k = 0; k < c.enlaces.Length; k++)
                {
                    int vi = mapa[k];
                    if (vi < 0) continue;
                    var v = vals[vi];
                    ref readonly var e = ref c.enlaces[k];
                    int o = v.Off, ci = e.Curva;
                    if (ci + e.N > muestras.Length) continue;
                    if (v.Tipo == TipoValor.Rotacion)
                    {
                        var q = e.Atributo == 4 ? Quaternion.Euler(muestras[ci], muestras[ci + 1], muestras[ci + 2]) : new Quaternion(muestras[ci], muestras[ci + 1], muestras[ci + 2], muestras[ci + 3]);
                        float d = acum[o] * q.x + acum[o + 1] * q.y + acum[o + 2] * q.z + acum[o + 3] * q.w;
                        float ww = d < 0 ? -w : w;
                        acum[o] += ww * q.x; acum[o + 1] += ww * q.y; acum[o + 2] += ww * q.z; acum[o + 3] += ww * q.w;
                    }
                    else if (v.Tipo == TipoValor.PPtr)
                    {
                        int idx = (int)Math.Round(muestras[ci]);
                        if (w >= 0.5f || v.ObjetoActual2 == null) v.ObjetoActual2 = idx >= 0 && idx < c.objetosPPtr.Length ? c.objetosPPtr[idx] : null;
                    }
                    else for (int j = 0; j < v.Tam && j < e.N; j++) acum[o + j] += w * muestras[ci + j];
                    pesos[vi] += w;
                }
            }
            for (int i = 0; i < vals.Count; i++)
            {
                float w = pesos[i];
                if (w <= 0) continue;
                var v = vals[i];
                int o = v.Off;
                if (v.Tipo == TipoValor.PPtr) { v.EscribirObjeto(v.ObjetoActual2); continue; }
                // lo que no completó el peso 1 sale del valor actual
                if (w < 0.999f)
                {
                    v.Leer(cur, o);
                    if (v.Tipo == TipoValor.Rotacion)
                    {
                        var a = new Quaternion(cur[o], cur[o + 1], cur[o + 2], cur[o + 3]);
                        var b = new Quaternion(acum[o] / w, acum[o + 1] / w, acum[o + 2] / w, acum[o + 3] / w);
                        var q = Quaternion.Slerp(a, Quaternion.Normalize(b), w);
                        acum[o] = q.x; acum[o + 1] = q.y; acum[o + 2] = q.z; acum[o + 3] = q.w;
                    }
                    else for (int j = 0; j < v.Tam; j++) acum[o + j] += (1 - w) * cur[o + j];
                }
                else if (v.Tipo == TipoValor.Rotacion)
                {
                    var q = Quaternion.Normalize(new Quaternion(acum[o], acum[o + 1], acum[o + 2], acum[o + 3]));
                    acum[o] = q.x; acum[o + 1] = q.y; acum[o + 2] = q.z; acum[o + 3] = q.w;
                }
                switch (v.Tipo)
                {
                    case TipoValor.Posicion: v.T.PonerLocal(0, new Vector3(acum[o], acum[o + 1], acum[o + 2]), default); v.T.AplicarLocal(); break;
                    case TipoValor.Escala: v.T.PonerLocal(2, new Vector3(acum[o], acum[o + 1], acum[o + 2]), default); v.T.AplicarLocal(); break;
                    case TipoValor.Rotacion: v.T.PonerLocal(1, default, new Quaternion(acum[o], acum[o + 1], acum[o + 2], acum[o + 3])); v.T.AplicarLocal(); break;
                    case TipoValor.Nada: break;
                    default: v.Escribir(acum, o); break;
                }
            }
        }

        // el tiempo dentro del clip según el modo de repetición
        float TiempoEn(AnimationState s)
        {
            float largo = s.length, t = s.tiempo;
            if (largo <= 0) return 0;
            switch (Envoltura(s))
            {
                case WrapMode.Loop: t %= largo; return t < 0 ? t + largo : t;
                case WrapMode.PingPong: return Mathf.PingPong(t, largo);
                default: return Math.Clamp(t, 0, largo);
            }
        }

        // ── API de Unity ──
        public AnimationClip clip { get => clipDefecto; set => clipDefecto = value; }
        public bool playAutomatically { get => autoPlay; set => autoPlay = value; }
        public WrapMode wrapMode { get => envoltura; set => envoltura = value; }
        public bool animatePhysics { get => fisica; set => fisica = value; }
        public AnimationCullingType cullingType { get => tipoCulling; set => tipoCulling = value; }
        public Bounds localBounds { get; set; }

        public bool isPlaying { get { foreach (var s in estados) if (s.habilitado) return true; return false; } }

        public AnimationState this[string name]
        {
            get { foreach (var s in estados) if (s.nombre == name) return s; return null; }
        }

        public bool IsPlaying(string name) => this[name]?.habilitado ?? false;
        public int GetClipCount() => estados.Count;
        public AnimationClip GetClip(string name) => this[name]?.clipInterno;
        public IEnumerator GetEnumerator() => estados.ToArray().GetEnumerator();

        public void AddClip(AnimationClip clip, string newName)
        {
            if (clip == null) return;
            var s = this[newName];
            if (s != null) s.clipInterno = clip; else Agregar(clip, newName);
        }

        public void RemoveClip(AnimationClip clip) => estados.RemoveAll(s => s.clipInterno == clip);
        public void RemoveClip(string clipName) => estados.RemoveAll(s => s.nombre == clipName);

        public bool Play() => Play(PlayMode.StopSameLayer);
        public bool Play(PlayMode mode) => clipDefecto != null && Play(clipDefecto.name, mode);
        public bool Play(string animation) => Play(animation, PlayMode.StopSameLayer);

        public bool Play(string animation, PlayMode mode)
        {
            var s = this[animation];
            if (s == null)
            {
                if (clipDefecto != null && clipDefecto.name == animation) s = Agregar(clipDefecto, animation);
                else { Debug.LogWarning($"The animation state {animation} could not be played because it couldn't be found!", this); return false; }
            }
            foreach (var o in estados)
                if (o != s && (mode == PlayMode.StopAll || o.capa == s.capa)) { o.habilitado = false; o.peso = 0; o.tiempo = 0; }
            s.habilitado = true;
            s.peso = 1; s.pesoObjetivo = 1; s.duracionFundido = 0;
            // Unity sigue desde donde estaba si ya se estaba reproduciendo; si no, desde el principio
            if (!s.reproducido) s.tiempo = 0;
            s.reproducido = true;
            Animadores.Alta(this);
            return true;
        }

        public void CrossFade(string animation) => CrossFade(animation, 0.3f, PlayMode.StopSameLayer);
        public void CrossFade(string animation, float fadeLength) => CrossFade(animation, fadeLength, PlayMode.StopSameLayer);

        public void CrossFade(string animation, float fadeLength, PlayMode mode)
        {
            var s = this[animation];
            if (s == null) { Debug.LogWarning($"The animation state {animation} could not be played because it couldn't be found!", this); return; }
            if (!s.habilitado) { s.tiempo = 0; s.peso = 0; }
            s.habilitado = true;
            s.reproducido = true;
            Fundir(s, 1, fadeLength);
            foreach (var o in estados)
                if (o != s && o.habilitado && (mode == PlayMode.StopAll || o.capa == s.capa)) { Fundir(o, 0, fadeLength); o.detenerAlApagarse = true; }
        }

        static void Fundir(AnimationState s, float objetivo, float duracion)
        {
            s.pesoObjetivo = objetivo;
            s.detenerAlApagarse = false;
            if (duracion <= 0) { s.peso = objetivo; s.duracionFundido = 0; }
            else s.duracionFundido = duracion;
        }

        readonly List<(string nombre, float fundido)> cola = new List<(string, float)>();

        public AnimationState CrossFadeQueued(string animation) => CrossFadeQueued(animation, 0.3f, QueueMode.CompleteOthers, PlayMode.StopSameLayer);
        public AnimationState CrossFadeQueued(string animation, float fadeLength) => CrossFadeQueued(animation, fadeLength, QueueMode.CompleteOthers, PlayMode.StopSameLayer);
        public AnimationState CrossFadeQueued(string animation, float fadeLength, QueueMode queue) => CrossFadeQueued(animation, fadeLength, queue, PlayMode.StopSameLayer);

        public AnimationState CrossFadeQueued(string animation, float fadeLength, QueueMode queue, PlayMode mode)
        {
            var s = this[animation];
            if (s == null) return null;
            if (queue == QueueMode.PlayNow || !isPlaying) CrossFade(animation, fadeLength, mode);
            else cola.Add((animation, fadeLength));
            return s;
        }

        public AnimationState PlayQueued(string animation) => PlayQueued(animation, QueueMode.CompleteOthers, PlayMode.StopSameLayer);
        public AnimationState PlayQueued(string animation, QueueMode queue) => PlayQueued(animation, queue, PlayMode.StopSameLayer);
        public AnimationState PlayQueued(string animation, QueueMode queue, PlayMode mode) => CrossFadeQueued(animation, 0, queue, mode);

        public void Blend(string animation) => Blend(animation, 1, 0.3f);
        public void Blend(string animation, float targetWeight) => Blend(animation, targetWeight, 0.3f);

        public void Blend(string animation, float targetWeight, float fadeLength)
        {
            var s = this[animation];
            if (s == null) return;
            if (!s.habilitado) { s.habilitado = true; s.peso = 0; s.tiempo = 0; }
            Fundir(s, targetWeight, fadeLength);
        }

        public void Stop() { foreach (var s in estados) { s.habilitado = false; s.tiempo = 0; s.peso = 0; s.reproducido = false; } cola.Clear(); }
        public void Stop(string name) { var s = this[name]; if (s != null) { s.habilitado = false; s.tiempo = 0; s.reproducido = false; } }
        public void Rewind() { foreach (var s in estados) s.tiempo = 0; }
        public void Rewind(string name) { var s = this[name]; if (s != null) s.tiempo = 0; }
        public void Sample() => Evaluar();
        public void SyncLayer(int layer) { }
    }

    public sealed partial class AnimationState : TrackedReference
    {
        internal Animation anim;
        internal AnimationClip clipInterno;
        internal string nombre = "";
        internal float tiempo, velocidad = 1, peso, pesoObjetivo, duracionFundido, tiempoMuestra;
        internal bool habilitado, detenerAlApagarse, terminoEsteCuadro, reproducido;
        internal WrapMode envolturaPropia;
        internal int capa;

        public bool enabled { get => habilitado; set { habilitado = value; if (value && anim != null) Animadores.Alta(anim); } }
        public float weight { get => peso; set { peso = value; pesoObjetivo = value; duracionFundido = 0; } }
        public WrapMode wrapMode { get => envolturaPropia; set => envolturaPropia = value; }
        public float time { get => tiempo; set => tiempo = value; }
        public float normalizedTime { get => length > 0 ? tiempo / length : 0; set => tiempo = value * length; }
        public float speed { get => velocidad; set => velocidad = value; }
        public float normalizedSpeed { get => length > 0 ? velocidad / length : 0; set => velocidad = value * length; }
        public float length => clipInterno != null ? clipInterno.length : 0;
        public int layer { get => capa; set => capa = value; }
        public AnimationClip clip => clipInterno;
        public string name { get => nombre; set => nombre = value; }
        public AnimationBlendMode blendMode { get; set; }
        public void AddMixingTransform(Transform mix) { }
        public void AddMixingTransform(Transform mix, bool recursive) { }
        public void RemoveMixingTransform(Transform mix) { }
    }
}

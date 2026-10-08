using System;
using System.Collections.Generic;
using Porteo.Playables;
using UnityEngine.Playables;
using Object = UnityEngine.Object;

// Los playables de audio (UnityEngine.Audio): los clips de una pista de audio de Timeline suenan
// por el AudioSource enlazado (o en 2D si no hay) con el volumen de su peso, desde el segundo en
// que va cada uno; si el tiempo salta (una búsqueda) la voz se vuelve a ubicar.
namespace UnityEngine.Audio
{
    public struct AudioClipPlayable : IPlayable, IEquatable<AudioClipPlayable>
    {
        readonly PlayableHandle m_Handle;
        internal AudioClipPlayable(PlayableHandle h) { m_Handle = h; }

        public static AudioClipPlayable Create(PlayableGraph graph, AudioClip clip, bool looping)
        {
            var n = new Nodo(graph.G, TipoNodo.ClipAudio, typeof(AudioClipPlayable), 0) { ClipAudio = clip, BucleAudio = looping };
            if (clip != null) n.Duracion = clip.length;
            return new AudioClipPlayable(new PlayableHandle(n));
        }

        public PlayableHandle GetHandle() => m_Handle;
        public static implicit operator Playable(AudioClipPlayable playable) => new Playable(playable.GetHandle());
        public static explicit operator AudioClipPlayable(Playable playable) => new AudioClipPlayable(playable.GetHandle());
        public bool Equals(AudioClipPlayable other) => GetHandle() == other.GetHandle();
        public AudioClip GetClip() => m_Handle.m_Nodo?.ClipAudio;
        public void SetClip(AudioClip value) { var n = m_Handle.N; n.ClipAudio = value; }
        public bool GetLooped() => m_Handle.m_Nodo?.BucleAudio ?? false;
        public void SetLooped(bool value) => m_Handle.N.BucleAudio = value;
        public float GetVolume() => m_Handle.m_Nodo?.Volumen ?? 1;
        public void SetVolume(float value) => m_Handle.N.Volumen = Mathf.Clamp01(value);
        public float GetStereoPan() => m_Handle.m_Nodo?.Paneo ?? 0;
        public void SetStereoPan(float value) => m_Handle.N.Paneo = Mathf.Clamp(value, -1, 1);
        public float GetSpatialBlend() => m_Handle.m_Nodo?.Mezcla3D ?? 0;
        public void SetSpatialBlend(float value) => m_Handle.N.Mezcla3D = Mathf.Clamp01(value);
        public bool IsPlaying() => m_Handle.m_Nodo is Nodo n && n.Reproduciendo && n.G.Reproduciendo;
        public bool IsChannelPlaying() => IsPlaying();
        public double GetStartDelay() => m_Handle.m_Nodo?.DemoraAudio ?? 0;
        public double GetPauseDelay() => 0;
        public void Seek(double startTime, double startDelay) => Seek(startTime, startDelay, 0);
        public void Seek(double startTime, double startDelay, double duration)
        {
            var n = m_Handle.N;
            n.InicioAudio = startTime;
            n.DemoraAudio = startDelay;
            n.DuracionAudio = duration > 0 ? duration : double.MaxValue;
            n.PonerTiempo(startTime);
            if (duration > 0) n.Duracion = startTime + duration;
        }
    }

    public struct AudioMixerPlayable : IPlayable, IEquatable<AudioMixerPlayable>
    {
        readonly PlayableHandle m_Handle;
        internal AudioMixerPlayable(PlayableHandle h) { m_Handle = h; }

        public static AudioMixerPlayable Create(PlayableGraph graph, int inputCount = 0, bool normalizeInputVolumes = false) =>
            new AudioMixerPlayable(new PlayableHandle(new Nodo(graph.G, TipoNodo.MezclaAudio, typeof(AudioMixerPlayable), inputCount)));

        public PlayableHandle GetHandle() => m_Handle;
        public static implicit operator Playable(AudioMixerPlayable playable) => new Playable(playable.GetHandle());
        public static explicit operator AudioMixerPlayable(Playable playable) => new AudioMixerPlayable(playable.GetHandle());
        public bool Equals(AudioMixerPlayable other) => GetHandle() == other.GetHandle();
    }

    public struct AudioPlayableOutput : IPlayableOutput
    {
        readonly PlayableOutputHandle m_Handle;
        internal AudioPlayableOutput(PlayableOutputHandle h) { m_Handle = h; }
        public static AudioPlayableOutput Null => default;

        public static AudioPlayableOutput Create(PlayableGraph graph, string name, AudioSource target)
        {
            var o = new AudioPlayableOutput(new PlayableOutputHandle(new Salida(graph.G, typeof(AudioPlayableOutput), name)));
            o.SetTarget(target);
            return o;
        }

        public PlayableOutputHandle GetHandle() => m_Handle;
        public static implicit operator PlayableOutput(AudioPlayableOutput output) => new PlayableOutput(output.GetHandle());
        public static explicit operator AudioPlayableOutput(PlayableOutput output) => new AudioPlayableOutput(output.GetHandle());
        public AudioSource GetTarget() => m_Handle.m_Salida?.FuenteAudio;
        public void SetTarget(AudioSource value)
        {
            var s = m_Handle.S;
            if (s.FuenteAudio == value) return;
            foreach (var v in s.Voces.Values) v.Parar();
            s.Voces.Clear();
            s.FuenteAudio = value;
        }
        public bool GetEvaluateOnSeek() => m_Handle.m_Salida?.EvaluarAlBuscar ?? true;
        public void SetEvaluateOnSeek(bool value) => m_Handle.S.EvaluarAlBuscar = value;
    }

    public static class AudioPlayableBinding
    {
        public static PlayableBinding Create(string name, Object key) =>
            PlayableBinding.CreateInternal(name, key, typeof(AudioSource), (g, n) => AudioPlayableOutput.Create(g, n, null));
    }
}

namespace Porteo.Playables
{
    using UnityEngine;

    // una voz de un clip de audio de Timeline
    internal sealed class VozTimeline
    {
        internal Porteo.Audio.Voz V;
        internal AudioClip Clip;
        internal double Esperado;   // en qué segundo del clip debería ir según el grafo
        internal ulong Visto;

        internal void Parar() { Porteo.Audio.Sonido.Parar(V); V = null; }
    }

    internal static class AudioTimeline
    {
        static AudioSource fuente2D;
        static readonly List<(Nodo n, float w)> activos = new List<(Nodo, float)>();

        // la fuente para las pistas de audio sin AudioSource: en 2D, sin nada más (como Unity, que las
        // manda directo al oyente)
        static AudioSource Fuente2D()
        {
            if (fuente2D != null && !fuente2D.destruido) return fuente2D;
            var go = new GameObject("porteo_audio_timeline") { hideFlags = HideFlags.HideAndDontSave };
            Object.DontDestroyOnLoad(go);
            fuente2D = go.AddComponent<AudioSource>();
            fuente2D.playOnAwake = false;
            fuente2D.spatialBlend = 0;
            return fuente2D;
        }

        internal static void Aplicar(Salida s, bool reproduciendo)
        {
            activos.Clear();
            if (reproduciendo) Recorrer(s.Fuente, s.Puerto, s.Peso, activos);
            var g = s.G;
            foreach (var (n, w) in activos)
            {
                var clip = n.ClipAudio;
                if (clip == null) continue;
                var fuente = s.FuenteAudio != null && !s.FuenteAudio.destruido ? s.FuenteAudio : Fuente2D();
                double t = n.Tiempo;
                if (n.BucleAudio && clip.length > 0) { t %= clip.length; if (t < 0) t += clip.length; }
                if (!n.BucleAudio && (t < 0 || t >= clip.length)) continue;
                if (!s.Voces.TryGetValue(n, out var vt) || vt.V == null || vt.V.Fin || vt.Clip != clip)
                {
                    vt?.Parar();
                    vt = new VozTimeline { Clip = clip };
                    vt.V = Porteo.Audio.Sonido.Tocar(fuente, clip, true, w * n.Volumen, t);
                    s.Voces[n] = vt;
                }
                else
                {
                    vt.V.Escala = w * n.Volumen;
                    // si el grafo saltó (búsqueda) o la voz se corrió mucho, se vuelve a ubicar
                    double va = vt.V.Segundo(Porteo.Audio.Sonido.Ahora);
                    if (n.Busqueda || Math.Abs(va - t) > 0.25)
                    {
                        vt.Parar();
                        vt.V = Porteo.Audio.Sonido.Tocar(fuente, clip, true, w * n.Volumen, t);
                    }
                }
                vt.Esperado = t;
                vt.Visto = g.Cuadro;
            }
            // lo que dejó de estar activo se calla
            List<Nodo> fuera = null;
            foreach (var kv in s.Voces)
                if (kv.Value.Visto != g.Cuadro) { kv.Value.Parar(); (fuera ??= new List<Nodo>()).Add(kv.Key); }
            if (fuera != null) foreach (var n in fuera) s.Voces.Remove(n);
        }

        static void Recorrer(Nodo n, int puerto, float w, List<(Nodo, float)> l)
        {
            if (n == null || n.Destruido || w <= 1e-4f) return;
            if (n.Tipo == TipoNodo.ClipAudio)
            {
                if (n.Reproduciendo) l.Add((n, w));
                return;
            }
            int solo = n.Recorrido == PlayableTraversalMode.Passthrough && puerto >= 0 && puerto < n.Entradas.Count ? puerto : -1;
            for (int i = 0; i < n.Entradas.Count; i++)
            {
                if (solo >= 0 && i != solo) continue;
                var e = n.Entradas[i];
                if (e != null) Recorrer(e, -1, w * n.Pesos[i], l);
            }
        }
    }
}

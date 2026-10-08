using System;
using System.Collections.Generic;
using Porteo;
using Porteo.Datos;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Porteo.Audio
{
    // Lo que el anfitrión hace con el sonido (en el navegador, Web Audio). Sin anfitrión no suena
    // nada pero el motor lleva igual el estado (qué suena, en qué segundo va), como lo ven los scripts.
    public interface IAudio
    {
        void Cargar(int recurso, bool streaming);
        int Estado(int recurso);                                         // AudioDataLoadState
        void Tocar(int voz, int recurso, bool streaming, double desde, bool bucle, float volumen, float tono, float pan, float corte);
        void Ajustar(int voz, float volumen, float tono, float pan, float corte);   // corte: pasa bajos en Hz (0 = sin filtro)
        void Parar(int voz);
        void Pausar(int voz, bool pausa, double desde);
        int Frecuencia();
    }

    // Una voz: un clip sonando desde una fuente (el clip principal o un PlayOneShot).
    internal sealed class Voz
    {
        public int Id;
        public AudioSource Fuente;
        public AudioClip Clip;
        public bool UnTiro, Bucle, Pausada, Fin;
        public float Escala = 1;
        public double Inicio;        // en el reloj del audio: cuándo estaría en el segundo 0 del clip
        public double Posicion;      // en pausa: en qué segundo quedó
        public float Tono = 1;
        public float uVol = -1, uTono = -1, uPan = -2, uCorte = -1;

        // el segundo del clip en que va ahora
        public double Segundo(double ahora)
        {
            double p = Pausada ? Posicion : (ahora - Inicio) * Tono;
            float largo = Clip != null ? Clip.largo : 0;
            if (Bucle && largo > 0) { p %= largo; if (p < 0) p += largo; }
            return p;
        }
    }

    public static class Sonido
    {
        public static IAudio Salida;
        internal static readonly List<Voz> voces = new List<Voz>();
        static int siguiente = 1;
        static double relojBase = -1;
        static bool pausaGeneral;

        public static void Iniciar() => Mundo.AntesDeDibujar += Actualizar;

        // el reloj del audio (AudioSettings.dspTime): el tiempo real desde que arrancó. El
        // anfitrión no lo necesita: cada voz le llega con el segundo del clip desde donde empezar.
        internal static double Ahora
        {
            get
            {
                if (relojBase < 0) relojBase = Time.realtimeSinceStartup;
                return Time.realtimeSinceStartup - relojBase;
            }
        }

        internal static Voz Tocar(AudioSource f, AudioClip c, bool unTiro, float escala, double desde)
        {
            if (c == null) return null;
            var v = new Voz { Id = siguiente++, Fuente = f, Clip = c, UnTiro = unTiro, Bucle = !unTiro && f.bucle, Escala = escala, Tono = Math.Max(1e-3f, Math.Abs(f.tono)) };
            double ahora = Ahora;
            v.Inicio = ahora - desde / v.Tono;
            Calcular(v, out float vol, out float pan, out float corte);
            v.uVol = vol; v.uTono = v.Tono; v.uPan = pan; v.uCorte = corte;
            if (pausaGeneral && !f.ignorarPausa) { v.Pausada = true; v.Posicion = desde; }
            Salida?.Tocar(v.Id, c.recurso, c.Streaming, desde, v.Bucle, vol, v.Tono, pan, corte);
            if (v.Pausada) Salida?.Pausar(v.Id, true, desde);
            voces.Add(v);
            return v;
        }

        internal static void Parar(Voz v)
        {
            if (v == null || v.Fin) return;
            v.Fin = true;
            Salida?.Parar(v.Id);
            voces.Remove(v);
        }

        internal static void Pausar(Voz v, bool pausa)
        {
            if (v == null || v.Fin || v.Pausada == pausa) return;
            double ahora = Ahora;
            if (pausa) { v.Posicion = v.Segundo(ahora); v.Pausada = true; }
            else { v.Inicio = ahora - v.Posicion / v.Tono; v.Pausada = false; }
            Salida?.Pausar(v.Id, pausa, v.Posicion);
        }

        internal static bool Terminada(Voz v, double ahora)
        {
            if (v == null || v.Fin) return true;
            if (v.Bucle || v.Pausada || v.Clip == null) return false;
            return (ahora - v.Inicio) * v.Tono >= v.Clip.largo;
        }

        // AudioListener.pause: todo en pausa salvo las fuentes que lo ignoran
        internal static void PausaGeneral(bool si)
        {
            if (pausaGeneral == si) return;
            pausaGeneral = si;
            foreach (var v in voces.ToArray())
                if (v.Fuente == null || !v.Fuente.ignorarPausa) Pausar(v, si);
        }

        // ── cada cuadro: atenuación 3D, paneo, tono y filtro de cada voz; las que terminaron se van ──
        static void Actualizar()
        {
            if (voces.Count == 0) return;
            double ahora = Ahora;
            for (int i = voces.Count - 1; i >= 0; i--)
            {
                var v = voces[i];
                var f = v.Fuente;
                if (Terminada(v, ahora) || (object)f == null || f.destruido)
                {
                    if (!v.Fin) { v.Fin = true; Salida?.Parar(v.Id); }
                    voces.RemoveAt(i);
                    continue;
                }
                float tono = Math.Max(1e-3f, Math.Abs(f.tono));
                if (tono != v.Tono && !v.Pausada)
                {
                    // otro tono: la posición sigue donde estaba
                    double p = (ahora - v.Inicio) * v.Tono;
                    v.Tono = tono;
                    v.Inicio = ahora - p / tono;
                }
                Calcular(v, out float vol, out float pan, out float corte);
                if (Math.Abs(vol - v.uVol) > 1e-3f || tono != v.uTono || Math.Abs(pan - v.uPan) > 1e-3f || Math.Abs(corte - v.uCorte) > 1f)
                {
                    v.uVol = vol; v.uTono = tono; v.uPan = pan; v.uCorte = corte;
                    Salida?.Ajustar(v.Id, vol, tono, pan, corte);
                }
            }
        }

        // el oyente: el AudioListener activo (si no hay, la cámara principal)
        static Transform Oyente()
        {
            var l = AudioListener.activo;
            if ((object)l != null && !l.destruido && l.isActiveAndEnabled) return l.transform;
            var c = Camera.main;
            return c != null ? c.transform : null;
        }

        // volumen, paneo y corte del pasa bajos de una voz, con las reglas de Unity: la caída con la
        // distancia (logarítmica, lineal o la curva propia) pesada por spatialBlend
        static void Calcular(Voz v, out float vol, out float pan, out float corte)
        {
            var f = v.Fuente;
            vol = f.silencio ? 0 : f.vol * v.Escala * (f.ignorarVolumen ? 1 : AudioListener.volumenGeneral);
            pan = Mathf.Clamp(f.pan2D, -1, 1);
            corte = f.Filtro();
            float s = f.Mezcla3D();
            if (s <= 0) return;
            var o = Oyente();
            if (o == null) return;
            var d = f.transform.position - o.position;
            float dist = d.magnitude;
            float g;
            float min = Math.Max(1e-4f, f.minD), max = Math.Max(min, f.maxD);
            switch (f.caida)
            {
                case AudioRolloffMode.Linear: g = Mathf.Clamp01(1 - (dist - min) / Math.Max(1e-4f, max - min)); break;
                case AudioRolloffMode.Custom: g = f.curvaCaida != null && f.curvaCaida.length > 0 ? Mathf.Clamp01(f.curvaCaida.Evaluate(dist / max)) : 1; break;
                default: g = min / Mathf.Clamp(dist, min, max); break;
            }
            float pan3D = dist > 1e-4f ? Mathf.Clamp(Vector3.Dot(d / dist, o.right), -1, 1) : 0;
            vol *= 1 - s + s * g;
            pan = pan * (1 - s) + pan3D * s;
        }

        // al cambiar de escena las voces de objetos destruidos se cortan en el próximo cuadro;
        // esto corta todo (para reiniciar el juego)
        internal static void PararTodo()
        {
            foreach (var v in voces.ToArray()) Parar(v);
        }
    }
}

namespace UnityEngine
{
    public sealed partial class AudioClip : Object
    {
        internal int recurso = -1;
        internal float largo;
        internal int canales = 1, frecuencia = 44100, tipoCarga;
        internal bool precargar, cargaPedida;

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            largo = m.F("m_Length");
            canales = Math.Max(1, m.I32("m_Channels", 1));
            frecuencia = m.I32("m_Frequency", 44100);
            tipoCarga = m.I32("m_LoadType");
            precargar = m.B("m_PreloadAudioData");
            if (m["_datos"] is Recurso rec) recurso = rec.Id;
            if (precargar) LoadAudioData();
        }

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            base.CopiarDe(o, remap);
            var c = (AudioClip)o;
            recurso = c.recurso; largo = c.largo; canales = c.canales; frecuencia = c.frecuencia; tipoCarga = c.tipoCarga; precargar = c.precargar;
        }

        // la música larga se escucha mientras llega (Streaming); lo demás se decodifica entero
        internal bool Streaming => tipoCarga == 2;

        public float length => largo;
        public int channels => canales;
        public int frequency => frecuencia;
        public int samples => (int)Math.Round(largo * frecuencia);
        public AudioClipLoadType loadType => (AudioClipLoadType)tipoCarga;
        public bool preloadAudioData => precargar;
        public bool loadInBackground => true;
        public bool ambisonic => false;

        public AudioDataLoadState loadState
        {
            get
            {
                if (recurso < 0) return AudioDataLoadState.Failed;
                var s = Porteo.Audio.Sonido.Salida;
                if (s == null) return cargaPedida ? AudioDataLoadState.Loaded : AudioDataLoadState.Unloaded;
                return (AudioDataLoadState)s.Estado(recurso);
            }
        }

        public bool LoadAudioData()
        {
            if (recurso < 0) return false;
            cargaPedida = true;
            Porteo.Audio.Sonido.Salida?.Cargar(recurso, Streaming);
            return true;
        }

        public bool UnloadAudioData() => true;
    }

    public enum AudioClipLoadType { DecompressOnLoad = 0, CompressedInMemory = 1, Streaming = 2 }

    public sealed partial class AudioSource : AudioBehaviour
    {
        internal AudioClip clipPrincipal;
        internal float vol = 1, tono = 1, pan2D, minD = 1, maxD = 500, doppler = 1, dispersion, mezcla3D;
        internal bool bucle, silencio, alDespertar = true, ignorarPausa, ignorarVolumen, saltarEfectos, saltarEfectosOyente, saltarReverb;
        internal int prioridad = 128;
        internal AudioRolloffMode caida;
        internal AnimationCurve curvaCaida, curvaMezcla;
        internal AudioVelocityUpdateMode modoVelocidad;
        Porteo.Audio.Voz voz;
        double desdePendiente;

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            clipPrincipal = r.Resolver(m.P("m_audioClip")) as AudioClip;
            alDespertar = m.B("m_PlayOnAwake", true);
            vol = m.F("m_Volume", 1); tono = m.F("m_Pitch", 1);
            bucle = m.B("Loop"); silencio = m.B("Mute");
            prioridad = m.I32("Priority", 128);
            doppler = m.F("DopplerLevel", 1);
            minD = m.F("MinDistance", 1); maxD = m.F("MaxDistance", 500);
            pan2D = m.F("Pan2D");
            caida = (AudioRolloffMode)m.I32("rolloffMode");
            saltarEfectos = m.B("BypassEffects"); saltarEfectosOyente = m.B("BypassListenerEffects"); saltarReverb = m.B("BypassReverbZones");
            curvaCaida = Serial.Curva(m.M("rolloffCustomCurve"));
            // spatialBlend se guarda como una curva sobre la distancia; la del inspector es su primer valor
            curvaMezcla = Serial.Curva(m.M("panLevelCustomCurve"));
            mezcla3D = curvaMezcla.length > 0 ? curvaMezcla.Evaluate(0) : 0;
            var sp = Serial.Curva(m.M("spreadCustomCurve"));
            dispersion = sp.length > 0 ? sp.Evaluate(0) * 360 : 0;
        }

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            base.CopiarDe(o, remap);
            var a = (AudioSource)o;
            clipPrincipal = remap(a.clipPrincipal) as AudioClip ?? a.clipPrincipal;
            vol = a.vol; tono = a.tono; pan2D = a.pan2D; minD = a.minD; maxD = a.maxD; doppler = a.doppler; dispersion = a.dispersion; mezcla3D = a.mezcla3D;
            bucle = a.bucle; silencio = a.silencio; alDespertar = a.alDespertar; ignorarPausa = a.ignorarPausa; ignorarVolumen = a.ignorarVolumen;
            saltarEfectos = a.saltarEfectos; saltarEfectosOyente = a.saltarEfectosOyente; saltarReverb = a.saltarReverb;
            prioridad = a.prioridad; caida = a.caida; curvaCaida = a.curvaCaida; curvaMezcla = a.curvaMezcla; modoVelocidad = a.modoVelocidad;
        }

        // Unity toca el clip cada vez que la fuente se habilita con Play On Awake, y lo corta al deshabilitarse
        internal override void AlActivarse()
        {
            if (alDespertar && clipPrincipal != null) Play();
        }

        internal override void AlDesactivarse() { Porteo.Audio.Sonido.Parar(voz); voz = null; }
        internal override void AlDestruirse() { Porteo.Audio.Sonido.Parar(voz); voz = null; }

        internal float Mezcla3D() => Mathf.Clamp01(mezcla3D);

        // el pasa bajos (AudioLowPassFilter del mismo objeto, el que usa SECTR para la oclusión)
        internal float Filtro()
        {
            if (saltarEfectos || go == null) return 0;
            var f = filtro;
            if ((object)f == null || f.destruido || f.go != go)
            {
                f = filtro = go.GetComponent<AudioLowPassFilter>();
                if (f == null) return 0;
            }
            return f.isActiveAndEnabled ? f.corte : 0;
        }
        AudioLowPassFilter filtro;

        public AudioClip clip
        {
            get => clipPrincipal;
            set { if (clipPrincipal == value) return; clipPrincipal = value; }
        }

        public float volume { get => vol; set => vol = Mathf.Clamp01(value); }
        public float pitch { get => tono; set => tono = Mathf.Clamp(value, -3, 3); }
        public bool loop { get => bucle; set { bucle = value; if (voz != null && !voz.UnTiro && voz.Bucle != value) Reiniciar(); } }
        public bool mute { get => silencio; set => silencio = value; }
        public bool playOnAwake { get => alDespertar; set => alDespertar = value; }
        public bool ignoreListenerPause { get => ignorarPausa; set => ignorarPausa = value; }
        public bool ignoreListenerVolume { get => ignorarVolumen; set => ignorarVolumen = value; }
        public bool bypassEffects { get => saltarEfectos; set => saltarEfectos = value; }
        public bool bypassListenerEffects { get => saltarEfectosOyente; set => saltarEfectosOyente = value; }
        public bool bypassReverbZones { get => saltarReverb; set => saltarReverb = value; }
        public float panStereo { get => pan2D; set => pan2D = Mathf.Clamp(value, -1, 1); }
        public float spatialBlend { get => mezcla3D; set => mezcla3D = Mathf.Clamp01(value); }
        public float dopplerLevel { get => doppler; set => doppler = Mathf.Clamp(value, 0, 5); }
        public float spread { get => dispersion; set => dispersion = Mathf.Clamp(value, 0, 360); }
        public int priority { get => prioridad; set => prioridad = Math.Clamp(value, 0, 256); }
        public float minDistance { get => minD; set => minD = Math.Max(0, value); }
        public float maxDistance { get => maxD; set => maxD = Math.Max(minD, value); }
        public AudioRolloffMode rolloffMode { get => caida; set => caida = value; }
        public AudioVelocityUpdateMode velocityUpdateMode { get => modoVelocidad; set => modoVelocidad = value; }
        public bool spatialize { get; set; }
        public float reverbZoneMix { get; set; } = 1;

        public bool isPlaying
        {
            get
            {
                if (voz == null) return false;
                if (Porteo.Audio.Sonido.Terminada(voz, Porteo.Audio.Sonido.Ahora)) { Porteo.Audio.Sonido.Parar(voz); voz = null; return false; }
                return !voz.Pausada;
            }
        }

        public float time
        {
            get => voz != null && !voz.Fin ? (float)voz.Segundo(Porteo.Audio.Sonido.Ahora) : (float)desdePendiente;
            set
            {
                desdePendiente = Math.Max(0, value);
                if (voz != null && !voz.Fin) Reiniciar(desdePendiente);
            }
        }

        public int timeSamples
        {
            get => (int)(time * (clipPrincipal != null ? clipPrincipal.frecuencia : 44100));
            set => time = value / (float)(clipPrincipal != null ? clipPrincipal.frecuencia : 44100);
        }

        void Reiniciar(double? desde = null)
        {
            if (voz == null) return;
            double d = desde ?? voz.Segundo(Porteo.Audio.Sonido.Ahora);
            bool pausada = voz.Pausada;
            Porteo.Audio.Sonido.Parar(voz);
            voz = Porteo.Audio.Sonido.Tocar(this, clipPrincipal, false, 1, d);
            if (pausada) Porteo.Audio.Sonido.Pausar(voz, true);
        }

        public void Play()
        {
            if (!isActiveAndEnabled) { Debug.LogWarning("Can not play a disabled audio source", this); return; }
            if (voz != null && voz.Pausada && !voz.Fin && voz.Clip == clipPrincipal) { Porteo.Audio.Sonido.Pausar(voz, false); return; }
            Porteo.Audio.Sonido.Parar(voz);
            voz = null;
            if (clipPrincipal == null) return;
            clipPrincipal.LoadAudioData();
            voz = Porteo.Audio.Sonido.Tocar(this, clipPrincipal, false, 1, desdePendiente);
            desdePendiente = 0;
        }

        public void Play(ulong delay) => Play();
        public void PlayDelayed(float delay) => Play();
        public void Stop() { Porteo.Audio.Sonido.Parar(voz); voz = null; desdePendiente = 0; }
        public void Pause() { if (voz != null) Porteo.Audio.Sonido.Pausar(voz, true); }
        public void UnPause() { if (voz != null) Porteo.Audio.Sonido.Pausar(voz, false); }

        public void PlayOneShot(AudioClip clip) => PlayOneShot(clip, 1);

        public void PlayOneShot(AudioClip clip, float volumeScale)
        {
            if (clip == null) return;
            if (!isActiveAndEnabled) { Debug.LogWarning("Can not play a disabled audio source", this); return; }
            clip.LoadAudioData();
            Porteo.Audio.Sonido.Tocar(this, clip, true, volumeScale, 0);
        }

        // un objeto temporal con la fuente, que se destruye cuando termina (como Unity)
        public static void PlayClipAtPoint(AudioClip clip, Vector3 position) => PlayClipAtPoint(clip, position, 1);

        public static void PlayClipAtPoint(AudioClip clip, Vector3 position, float volume)
        {
            if (clip == null) return;
            var go = new GameObject("One shot audio");
            go.transform.position = position;
            var s = go.AddComponent<AudioSource>();
            s.clip = clip; s.spatialBlend = 1; s.volume = volume;
            s.Play();
            Object.Destroy(go, clip.length * (Time.timeScale < 0.01f ? 0.01f : Time.timeScale));
        }
    }

    public sealed partial class AudioListener : AudioBehaviour
    {
        internal static AudioListener activo;
        internal static float volumenGeneral = 1;
        static bool pausa;

        internal override void AlActivarse() { activo = this; }
        internal override void AlDesactivarse() { if (activo == this) activo = null; }

        public static bool pause { get => pausa; set { pausa = value; Porteo.Audio.Sonido.PausaGeneral(value); } }
        public static float volume { get => volumenGeneral; set => volumenGeneral = Mathf.Clamp01(value); }
        public AudioVelocityUpdateMode velocityUpdateMode { get; set; }
    }

    public sealed partial class AudioSettings
    {
        public static double dspTime => Porteo.Audio.Sonido.Ahora;
        public static int outputSampleRate => Porteo.Audio.Sonido.Salida?.Frecuencia() ?? 48000;
    }

    public sealed partial class AudioLowPassFilter : Behaviour
    {
        internal float corte = 5000, resonancia = 1;

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            corte = m.F("m_CutoffFrequency", 5000);
            resonancia = m.F("m_LowpassResonanceQ", 1);
        }

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            base.CopiarDe(o, remap);
            var f = (AudioLowPassFilter)o;
            corte = f.corte; resonancia = f.resonancia;
        }

        public float cutoffFrequency { get => corte; set => corte = Mathf.Clamp(value, 10, 22000); }
        public float lowpassResonanceQ { get => resonancia; set => resonancia = Mathf.Clamp(value, 1, 10); }
    }

    public sealed partial class AudioReverbZone : Behaviour
    {
        internal float minD = 10, maxD = 15;

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            minD = m.F("m_MinDistance", 10);
            maxD = m.F("m_MaxDistance", 15);
        }

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            base.CopiarDe(o, remap);
            var z = (AudioReverbZone)o;
            minD = z.minD; maxD = z.maxD;
        }

        public float minDistance { get => minD; set => minD = value; }
        public float maxDistance { get => maxD; set => maxD = value; }
    }
}

using System;
using System.Collections.Generic;
using Porteo;
using Porteo.Datos;
using Porteo.Video;
using Object = UnityEngine.Object;

namespace Porteo.Video
{
    // Lo que reproduce los videos: en el navegador, un <video> con los bytes del clip (video.js) que
    // cada cuadro se sube a la textura de destino. Sin anfitrión (la prueba en consola) el tiempo
    // corre igual, así la lógica del juego que depende del video sigue.
    public interface IVideo
    {
        void Crear(int id, int recurso);
        void Reproducir(int id, bool si);
        void Buscar(int id, double segundos);
        void Ajustar(int id, bool bucle, double velocidad, double volumen);
        double Tiempo(int id);
        int Estado(int id);            // 0 cargando, 1 listo, 2 terminó, -1 error
        bool Subir(int id, uint textura);
        void Soltar(int id);
    }

    public static class Videos
    {
        public static IVideo Salida;
        internal static readonly List<UnityEngine.Video.VideoPlayer> activos = new List<UnityEngine.Video.VideoPlayer>();
        static int siguiente = 1;
        internal static int NuevoId() => siguiente++;

        public static void Iniciar() => Mundo.AntesDeDibujar += Actualizar;

        static void Actualizar()
        {
            foreach (var v in activos.ToArray())
            {
                if (v == null || v.destruido) { activos.Remove(v); continue; }
                try { v.Cuadro(); }
                catch (Exception e) { UnityEngine.Debug.LogException(e, v); }
            }
        }
    }
}

namespace UnityEngine.Video
{
    public enum VideoRenderMode { CameraFarPlane = 0, CameraNearPlane = 1, RenderTexture = 2, MaterialOverride = 3, APIOnly = 4 }
    public enum VideoAspectRatio { NoScaling = 0, FitVertically = 1, FitHorizontally = 2, FitInside = 3, FitOutside = 4, Stretch = 5 }
    public enum VideoAudioOutputMode { None = 0, AudioSource = 1, Direct = 2, APIOnly = 3 }
    public enum VideoSource { VideoClip = 0, Url = 1 }
    public enum VideoTimeSource { AudioDSPTimeSource = 0, GameTimeSource = 1 }
    public enum VideoTimeReference { Freerun = 0, InternalTime = 1, ExternalTime = 2 }
    public enum Video3DLayout { No3D = 0, SideBySide3D = 1, OverUnder3D = 2 }
    public enum VideoTimeUpdateMode { DSPTime = 0, GameTime = 1, UnscaledGameTime = 2 }

    public sealed class VideoClip : Object
    {
        internal int recurso = -1;
        internal uint ancho, alto;
        internal double fps = 30;
        internal ulong cuadros;
        internal string rutaOriginal = "";
        internal ushort pistasAudio;

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            m_Name = m.S("m_Name") ?? m_Name;
            ancho = (uint)m.I("Width"); alto = (uint)m.I("Height");
            fps = m.F("m_FrameRate", 30);
            cuadros = (ulong)m.I("m_FrameCount");
            rutaOriginal = m.S("m_OriginalPath") ?? "";
            pistasAudio = (ushort)(m.L("m_AudioChannelCount")?.Count ?? 0);
            if (m["_datos"] is Recurso rec) recurso = rec.Id;
        }

        public string originalPath => rutaOriginal;
        public ulong frameCount => cuadros;
        public double frameRate => fps;
        public double length => fps > 0 ? cuadros / fps : 0;
        public uint width => ancho;
        public uint height => alto;
        public uint pixelAspectRatioNumerator => 1;
        public uint pixelAspectRatioDenominator => 1;
        public bool sRGB => true;
        public ushort audioTrackCount => pistasAudio;
        public ushort GetAudioChannelCount(ushort audioTrackIdx) => 2;
        public uint GetAudioSampleRate(ushort audioTrackIdx) => 48000;
        public string GetAudioLanguage(ushort audioTrackIdx) => "";
    }

    public sealed class VideoPlayer : Behaviour
    {
        VideoClip clipVideo;
        string direccion = "";
        VideoSource fuente;
        VideoRenderMode modo = VideoRenderMode.CameraFarPlane;
        RenderTexture destino;
        Camera camara;
        Renderer rendererDestino;
        string propiedadDestino = "_MainTex";
        VideoAspectRatio aspecto = VideoAspectRatio.FitHorizontally;
        VideoAudioOutputMode salidaAudio = VideoAudioOutputMode.Direct;
        float velocidad = 1;
        bool alDespertar = true, bucle, esperarPrimerCuadro = true, saltarCuadros = true;
        float[] volumenes = { 1 };
        bool[] mudos = { false };
        AudioSource[] fuentesAudio = Array.Empty<AudioSource>();
        bool desperto, reproduciendo, pausado, preparado;
        double tiempo;
        int id;          // en el anfitrión
        Texture2D texMaterial;

        public delegate void EventHandler(VideoPlayer source);
        public delegate void ErrorEventHandler(VideoPlayer source, string message);
        public delegate void FrameReadyEventHandler(VideoPlayer source, long frameIdx);
        public delegate void TimeEventHandler(VideoPlayer source, double seconds);
        public event EventHandler prepareCompleted, loopPointReached, started, frameDropped, seekCompleted, clockResyncOccurred;
        public event ErrorEventHandler errorReceived;
        public event FrameReadyEventHandler frameReady;

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            clipVideo = r.Resolver(m.P("m_VideoClip")) as VideoClip;
            direccion = m.S("m_Url") ?? "";
            fuente = (VideoSource)m.I32("m_DataSource");
            modo = (VideoRenderMode)m.I32("m_RenderMode");
            destino = r.Resolver(m.P("m_TargetTexture")) as RenderTexture;
            camara = r.Resolver(m.P("m_TargetCamera")) as Camera;
            rendererDestino = r.Resolver(m.P("m_TargetMaterialRenderer")) as Renderer;
            var pd = m.S("m_TargetMaterialProperty");
            if (!string.IsNullOrEmpty(pd) && pd != "<noninit>") propiedadDestino = pd;
            aspecto = (VideoAspectRatio)m.I32("m_AspectRatio", 2);
            salidaAudio = (VideoAudioOutputMode)m.I32("m_AudioOutputMode", 2);
            velocidad = m.F("m_PlaybackSpeed", 1);
            alDespertar = m.B("m_PlayOnAwake", true);
            bucle = m.B("m_Looping");
            esperarPrimerCuadro = m.B("m_WaitForFirstFrame", true);
            saltarCuadros = m.B("m_SkipOnDrop", true);
            var vs = m.L("m_DirectAudioVolumes");
            if (vs != null) { volumenes = new float[vs.Count]; for (int i = 0; i < vs.Count; i++) volumenes[i] = vs[i] is double d ? (float)d : vs[i] is float f ? f : 1; }
            var ms = m.L("m_DirectAudioMutes");
            if (ms != null) { mudos = new bool[ms.Count]; for (int i = 0; i < ms.Count; i++) mudos[i] = ms[i] is bool b && b; }
            var fa = m.L("m_TargetAudioSources");
            if (fa != null)
            {
                var l = new List<AudioSource>();
                foreach (var x in fa) if (x is PPtr p) l.Add(r.Resolver(p) as AudioSource);
                fuentesAudio = l.ToArray();
            }
        }

        internal override void AlActivarse()
        {
            if (!Videos.activos.Contains(this)) Videos.activos.Add(this);
            if (!desperto)
            {
                desperto = true;
                if (alDespertar) Play();
            }
        }

        internal override void AlDesactivarse()
        {
            // como Unity: desactivar el componente para el video
            Stop();
            Videos.activos.Remove(this);
        }

        internal override void AlDestruirse()
        {
            Stop();
            Videos.activos.Remove(this);
        }

        // ── propiedades ──
        public VideoSource source { get => fuente; set => fuente = value; }
        public string url { get => direccion; set => direccion = value ?? ""; }
        public VideoClip clip { get => clipVideo; set { if (clipVideo == value) return; Stop(); clipVideo = value; } }
        public VideoRenderMode renderMode { get => modo; set => modo = value; }
        public RenderTexture targetTexture { get => destino; set => destino = value; }
        public Camera targetCamera { get => camara; set => camara = value; }
        public Renderer targetMaterialRenderer { get => rendererDestino; set => rendererDestino = value; }
        public string targetMaterialProperty { get => propiedadDestino; set => propiedadDestino = value; }
        public VideoAspectRatio aspectRatio { get => aspecto; set => aspecto = value; }
        public float targetCameraAlpha { get; set; } = 1;
        public Video3DLayout targetCamera3DLayout { get; set; }
        public Texture texture => modo == VideoRenderMode.RenderTexture ? destino : texMaterial;
        public bool isPrepared => preparado;
        public bool waitForFirstFrame { get => esperarPrimerCuadro; set => esperarPrimerCuadro = value; }
        public bool playOnAwake { get => alDespertar; set => alDespertar = value; }
        public bool isPlaying => reproduciendo && !pausado;
        public bool isPaused => pausado;
        public bool canSetTime => true;
        public double time { get => tiempo; set { tiempo = Math.Max(0, value); if (id != 0) Videos.Salida?.Buscar(id, tiempo); } }
        public long frame { get => (long)(tiempo * frameRate); set => time = frameRate > 0 ? value / frameRate : 0; }
        public double clockTime => tiempo;
        public bool canStep => true;
        public bool canSetPlaybackSpeed => true;
        public float playbackSpeed { get => velocidad; set { velocidad = value; Ajustar(); } }
        public bool isLooping { get => bucle; set { bucle = value; Ajustar(); } }
        public bool canSetTimeSource => true;
        public VideoTimeSource timeSource { get; set; } = VideoTimeSource.GameTimeSource;
        public VideoTimeReference timeReference { get; set; }
        public VideoTimeUpdateMode timeUpdateMode { get; set; } = VideoTimeUpdateMode.GameTime;
        public double externalReferenceTime { get; set; }
        public bool canSetSkipOnDrop => true;
        public bool skipOnDrop { get => saltarCuadros; set => saltarCuadros = value; }
        public ulong frameCount => clipVideo?.frameCount ?? 0;
        public float frameRate => (float)(clipVideo?.frameRate ?? 30);
        public double length => clipVideo?.length ?? 0;
        public uint width => clipVideo?.width ?? 0;
        public uint height => clipVideo?.height ?? 0;
        public uint pixelAspectRatioNumerator => 1;
        public uint pixelAspectRatioDenominator => 1;
        public ushort audioTrackCount => clipVideo?.audioTrackCount ?? 0;
        public static ushort controlledAudioTrackMaxCount => 64;
        public ushort controlledAudioTrackCount { get; set; } = 1;
        public VideoAudioOutputMode audioOutputMode { get => salidaAudio; set { salidaAudio = value; Ajustar(); } }
        public bool canSetDirectAudioVolume => true;
        public bool sendFrameReadyEvents { get; set; }

        public void EnableAudioTrack(ushort trackIndex, bool enabled) { }
        public bool IsAudioTrackEnabled(ushort trackIndex) => true;
        public ushort GetAudioChannelCount(ushort trackIndex) => 2;
        public uint GetAudioSampleRate(ushort trackIndex) => 48000;
        public string GetAudioLanguageCode(ushort trackIndex) => "";
        public float GetDirectAudioVolume(ushort trackIndex) => trackIndex < volumenes.Length ? volumenes[trackIndex] : 1;
        public void SetDirectAudioVolume(ushort trackIndex, float volume)
        {
            if (trackIndex >= volumenes.Length) Array.Resize(ref volumenes, trackIndex + 1);
            volumenes[trackIndex] = Mathf.Clamp01(volume);
            Ajustar();
        }
        public bool GetDirectAudioMute(ushort trackIndex) => trackIndex < mudos.Length && mudos[trackIndex];
        public void SetDirectAudioMute(ushort trackIndex, bool mute)
        {
            if (trackIndex >= mudos.Length) Array.Resize(ref mudos, trackIndex + 1);
            mudos[trackIndex] = mute;
            Ajustar();
        }
        public AudioSource GetTargetAudioSource(ushort trackIndex) => trackIndex < fuentesAudio.Length ? fuentesAudio[trackIndex] : null;
        public void SetTargetAudioSource(ushort trackIndex, AudioSource source)
        {
            if (trackIndex >= fuentesAudio.Length) Array.Resize(ref fuentesAudio, trackIndex + 1);
            fuentesAudio[trackIndex] = source;
        }

        // ── reproducción ──
        public void Prepare()
        {
            if (preparado || clipVideo == null) return;
            if (id == 0 && Videos.Salida != null && clipVideo.recurso >= 0)
            {
                id = Videos.NuevoId();
                Videos.Salida.Crear(id, clipVideo.recurso);
                Ajustar();
            }
            if (Videos.Salida == null || id == 0) Preparado();
        }

        void Preparado()
        {
            if (preparado) return;
            preparado = true;
            prepareCompleted?.Invoke(this);
        }

        public void Play()
        {
            if (clipVideo == null) return;
            Prepare();
            reproduciendo = true;
            pausado = false;
            if (!Videos.activos.Contains(this)) Videos.activos.Add(this);
            if (id != 0) Videos.Salida?.Reproducir(id, true);
            started?.Invoke(this);
        }

        public void Pause()
        {
            if (!reproduciendo) return;
            pausado = true;
            if (id != 0) Videos.Salida?.Reproducir(id, false);
        }

        public void Stop()
        {
            reproduciendo = false;
            pausado = false;
            tiempo = 0;
            preparado = false;
            if (id != 0) { Videos.Salida?.Soltar(id); id = 0; }
        }

        public void StepForward() => time = tiempo + 1.0 / Math.Max(1, frameRate);

        void Ajustar()
        {
            if (id == 0) return;
            float vol = 0;
            if (salidaAudio == VideoAudioOutputMode.Direct) vol = GetDirectAudioMute(0) ? 0 : GetDirectAudioVolume(0);
            else if (salidaAudio == VideoAudioOutputMode.AudioSource && GetTargetAudioSource(0) is AudioSource a && a != null) vol = a.mute ? 0 : a.volume;
            Videos.Salida?.Ajustar(id, bucle, velocidad, vol * AudioListener.volume);
        }

        // cada cuadro: el tiempo, el fin (y la vuelta) y la imagen nueva al destino
        internal void Cuadro()
        {
            if (!reproduciendo || clipVideo == null) return;
            if (id != 0 && Videos.Salida != null)
            {
                int e = Videos.Salida.Estado(id);
                if (e < 0) { errorReceived?.Invoke(this, "porteo: el navegador no pudo reproducir " + clipVideo.name); reproduciendo = false; return; }
                if (e >= 1) Preparado();
                double t = Videos.Salida.Tiempo(id);
                bool vuelta = bucle && t + 0.05 < tiempo;
                tiempo = t;
                if (vuelta) loopPointReached?.Invoke(this);
                if (e == 2 && !bucle) { reproduciendo = false; loopPointReached?.Invoke(this); }
                Mostrar();
                return;
            }
            // sin anfitrión: el tiempo corre solo
            if (pausado) return;
            Preparado();
            tiempo += Time.deltaTime * velocidad;
            double largo = clipVideo.length;
            if (largo > 0 && tiempo >= largo)
            {
                loopPointReached?.Invoke(this);
                if (bucle) tiempo %= largo;
                else { tiempo = largo; reproduciendo = false; }
            }
        }

        void Mostrar()
        {
            if (!Porteo.Render.Gpu.Activo) return;
            uint tex = 0;
            switch (modo)
            {
                case VideoRenderMode.RenderTexture:
                    if (destino == null) return;
                    if (!destino.IsCreated()) destino.Create();
                    tex = destino.IdGl();
                    break;
                case VideoRenderMode.MaterialOverride:
                {
                    if (rendererDestino == null) return;
                    // sin mips: el video sube sólo el nivel 0
                    texMaterial ??= new Texture2D(2, 2, TextureFormat.RGBA32, false) { name = "porteo_video" };
                    tex = texMaterial.IdGl();
                    var bloque = new MaterialPropertyBlock();
                    rendererDestino.GetPropertyBlock(bloque);
                    bloque.SetTexture(propiedadDestino, texMaterial);
                    rendererDestino.SetPropertyBlock(bloque);
                    break;
                }
                default:
                    return;
            }
            if (tex == 0) return;
            Porteo.Render.Gpu.AtarParaSubir(Porteo.Render.Gl.TEXTURE_2D, tex);
            if (Videos.Salida.Subir(id, tex) && sendFrameReadyEvents) frameReady?.Invoke(this, frame);
        }
    }
}

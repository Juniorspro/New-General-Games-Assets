using System;
using System.Collections.Generic;
using Porteo;
using UnityEngine;
using Object = UnityEngine.Object;
using Porteo.Datos;
using Porteo.Render;

namespace UnityEngine.Rendering
{
    public enum AmbientMode { Skybox = 0, Trilight = 1, Flat = 3, Custom = 4 }
    public enum LightProbeUsage { Off = 0, BlendProbes = 1, UseProxyVolume = 2, CustomProvided = 4 }
    public enum ReflectionProbeUsage { Off = 0, BlendProbes = 1, BlendProbesAndSkybox = 2, Simple = 3 }
}

namespace UnityEngine
{
    // La pantalla es el lienzo del navegador (en píxeles del dispositivo).
    public sealed partial class Screen
    {
        public static int width => Pantalla.Ancho;
        public static int height => Pantalla.Alto;
        public static float dpi => Pantalla.Dpi;
        public static Resolution currentResolution => new Resolution { width = Pantalla.Ancho, height = Pantalla.Alto, refreshRate = 60 };
        public static Resolution[] resolutions => new[] { currentResolution };
        public static bool fullScreen { get => Pantalla.Completa; set => Pantalla.PedirCompleta?.Invoke(value); }
        public static FullScreenMode fullScreenMode { get => Pantalla.Completa ? FullScreenMode.FullScreenWindow : FullScreenMode.Windowed; set => fullScreen = value != FullScreenMode.Windowed; }
        public static void SetResolution(int width, int height, bool fullscreen) => SetResolution(width, height, fullscreen, 0);
        public static void SetResolution(int width, int height, bool fullscreen, int preferredRefreshRate) { fullScreen = fullscreen; }
        public static void SetResolution(int width, int height, FullScreenMode fullscreenMode) { fullScreenMode = fullscreenMode; }
        public static ScreenOrientation orientation { get => Pantalla.Ancho >= Pantalla.Alto ? ScreenOrientation.LandscapeLeft : ScreenOrientation.Portrait; set { } }
        public static bool autorotateToPortrait { get; set; }
        public static bool autorotateToPortraitUpsideDown { get; set; }
        public static bool autorotateToLandscapeLeft { get; set; } = true;
        public static bool autorotateToLandscapeRight { get; set; } = true;
        public static int sleepTimeout { get; set; }
        public static Rect safeArea => new Rect(0, 0, Pantalla.Ancho, Pantalla.Alto);
    }

    public partial struct Resolution
    {
        public int width { get; set; }
        public int height { get; set; }
        public int refreshRate { get; set; }
        public override string ToString() => $"{width} x {height} @ {refreshRate}Hz";
    }

    public enum ScreenOrientation { Unknown = 0, Portrait = 1, PortraitUpsideDown = 2, LandscapeLeft = 3, LandscapeRight = 4, AutoRotation = 5, Landscape = 3 }

    public sealed partial class QualitySettings : Object
    {
        static int nivel = -1;
        static List<Mapa> niveles;
        static int luces = 2, cascadas = 2, aa, vsync = 1, limiteTextura, maxLod, presupuesto = 256;
        static float distSombra = 50, sesgoLod = 1, corteCerca = 2, corte2 = 1f / 3;
        static Vector3 corte4 = new Vector3(0.0667f, 0.2f, 0.4667f);
        static ShadowQuality sombras = ShadowQuality.HardOnly;
        static ShadowProjection proyeccion = ShadowProjection.StableFit;
        static AnisotropicFiltering aniso = AnisotropicFiltering.ForceEnable;
        static BlendWeights pesos = BlendWeights.FourBones;
        static bool particulasSuaves;

        static void Iniciar()
        {
            if (nivel >= 0) return;
            nivel = 0;
            var q = Ajustes.Calidad;
            if (q == null) return;
            niveles = q.L("m_QualitySettings")?.ConvertAll(x => (Mapa)x) ?? new List<Mapa>();
            Aplicar(q.I32("m_CurrentQuality"));
        }

        static void Aplicar(int i)
        {
            if (niveles == null || niveles.Count == 0) return;
            nivel = Math.Clamp(i, 0, niveles.Count - 1);
            var s = niveles[nivel];
            luces = s.I32("pixelLightCount", 2);
            sombras = (ShadowQuality)s.I32("shadows");
            distSombra = s.F("shadowDistance", 50);
            cascadas = s.I32("shadowCascades", 1);
            proyeccion = (ShadowProjection)s.I32("shadowProjection", 1);
            corteCerca = s.F("shadowNearPlaneOffset", 2);
            corte2 = s.F("shadowCascade2Split", 1f / 3);
            corte4 = Serial.V3(s.M("shadowCascade4Split"));
            aa = s.I32("antiAliasing");
            sesgoLod = s.F("lodBias", 1);
            maxLod = s.I32("maximumLODLevel");
            limiteTextura = s.I32("textureQuality");
            aniso = (AnisotropicFiltering)s.I32("anisotropicTextures", 1);
            vsync = s.I32("vSyncCount", 1);
            pesos = (BlendWeights)s.I32("blendWeights", 4);
            particulasSuaves = s.B("softParticles");
            presupuesto = s.I32("particleRaycastBudget", 256);
        }

        public static int GetQualityLevel() { Iniciar(); return nivel; }
        public static void SetQualityLevel(int index) => SetQualityLevel(index, true);
        public static void SetQualityLevel(int index, bool applyExpensiveChanges) { Iniciar(); Aplicar(index); }
        public static void IncreaseLevel(bool applyExpensiveChanges = false) { Iniciar(); Aplicar(nivel + 1); }
        public static void DecreaseLevel(bool applyExpensiveChanges = false) { Iniciar(); Aplicar(nivel - 1); }

        public static string[] names
        {
            get
            {
                Iniciar();
                if (niveles == null) return new[] { "Default" };
                var r = new string[niveles.Count];
                for (int i = 0; i < r.Length; i++) r[i] = niveles[i].S("name") ?? "";
                return r;
            }
        }

        public static int pixelLightCount { get { Iniciar(); return luces; } set { Iniciar(); luces = value; } }
        public static ShadowQuality shadows { get { Iniciar(); return sombras; } set { Iniciar(); sombras = value; } }
        public static ShadowProjection shadowProjection { get { Iniciar(); return proyeccion; } set { Iniciar(); proyeccion = value; } }
        public static int shadowCascades { get { Iniciar(); return cascadas; } set { Iniciar(); cascadas = value; } }
        public static float shadowDistance { get { Iniciar(); return distSombra; } set { Iniciar(); distSombra = value; } }
        public static float shadowNearPlaneOffset { get { Iniciar(); return corteCerca; } set { Iniciar(); corteCerca = value; } }
        public static float shadowCascade2Split { get { Iniciar(); return corte2; } set { Iniciar(); corte2 = value; } }
        public static Vector3 shadowCascade4Split { get { Iniciar(); return corte4; } set { Iniciar(); corte4 = value; } }
        public static float lodBias { get { Iniciar(); return sesgoLod; } set { Iniciar(); sesgoLod = value; } }
        public static AnisotropicFiltering anisotropicFiltering { get { Iniciar(); return aniso; } set { Iniciar(); aniso = value; } }
        public static int masterTextureLimit { get { Iniciar(); return limiteTextura; } set { Iniciar(); limiteTextura = value; } }
        public static int maximumLODLevel { get { Iniciar(); return maxLod; } set { Iniciar(); maxLod = value; } }
        public static int particleRaycastBudget { get { Iniciar(); return presupuesto; } set { Iniciar(); presupuesto = value; } }
        public static int vSyncCount { get { Iniciar(); return vsync; } set { Iniciar(); vsync = value; } }
        public static int antiAliasing { get { Iniciar(); return aa; } set { Iniciar(); aa = value; } }
        public static BlendWeights blendWeights { get { Iniciar(); return pesos; } set { Iniciar(); pesos = value; } }
        public static bool softParticles { get { Iniciar(); return particulasSuaves; } set { Iniciar(); particulasSuaves = value; } }
        public static bool softVegetation { get; set; } = true;
        public static bool realtimeReflectionProbes { get; set; }
        public static bool billboardsFaceCameraPosition { get; set; } = true;
        public static ColorSpace activeColorSpace => ColorSpace.Gamma;
        public static ColorSpace desiredColorSpace => ColorSpace.Gamma;
        public static int maxQueuedFrames { get; set; } = 2;

        // el nivel de anisotropía efectivo de una textura según el ajuste global
        internal static float Anisotropico(int nivelTextura)
        {
            Iniciar();
            return aniso switch
            {
                AnisotropicFiltering.Disable => 1,
                AnisotropicFiltering.ForceEnable => Math.Max(nivelTextura, 9),
                _ => nivelTextura,
            };
        }
    }

    public enum ShadowQuality { Disable = 0, HardOnly = 1, All = 2 }

    public partial struct SortingLayer
    {
        public static int GetLayerValueFromID(int id) => 0;
        public static string IDToName(int id) => id == 0 ? "Default" : "";
        public static int NameToID(string name) => 0;
    }

    public sealed partial class SystemInfo
    {
        public static string operatingSystem => Plataforma.SistemaOperativo;
        public static OperatingSystemFamily operatingSystemFamily => OperatingSystemFamily.Other;
        public static int processorCount => 4;
        public static int systemMemorySize => 4096;
        public static int graphicsMemorySize => 1024;
        public static string graphicsDeviceName => "WebGL 2";
        public static string graphicsDeviceVendor => "porteo";
        public static string deviceModel => Plataforma.Modelo;
        public static string deviceName => "navegador";
        public static string deviceUniqueIdentifier => Plataforma.IdentificadorDispositivo;
        public static DeviceType deviceType => Plataforma.Movil ? DeviceType.Handheld : DeviceType.Desktop;
        public static int graphicsShaderLevel => 35;
        public static bool supportsRenderTextures => true;
        public static bool supportsImageEffects => true;
        public static bool supports3DTextures => true;
        public static bool supportsComputeShaders => false;
        public static bool supportsInstancing => true;
        public static bool supportsShadows => true;
        public static bool supportsVibration => Plataforma.Movil;
        public static bool supportsAccelerometer => Plataforma.Movil;
        public static bool supportsGyroscope => false;
        public static bool supportsLocationService => false;
        public static int maxTextureSize => Gpu.MaxTextura;
        public static int maxCubemapSize => Gpu.MaxTextura;
        public static Rendering.GraphicsDeviceType graphicsDeviceType => Rendering.GraphicsDeviceType.OpenGLES3;
        public static bool SupportsRenderTextureFormat(RenderTextureFormat format) =>
            format == RenderTextureFormat.ARGB32 || format == RenderTextureFormat.Default || format == RenderTextureFormat.Depth ||
            format == RenderTextureFormat.ARGBHalf && Gpu.ColorFloat || format == RenderTextureFormat.DefaultHDR && Gpu.ColorFloat;
        public static bool SupportsTextureFormat(TextureFormat format) => true;
    }

    public enum DeviceType { Unknown = 0, Handheld = 1, Console = 2, Desktop = 3 }
}

namespace UnityEngine.Rendering
{
    public enum GraphicsDeviceType { OpenGL2 = 0, Direct3D9 = 1, Direct3D11 = 2, Null = 4, OpenGLES2 = 8, OpenGLES3 = 11, Metal = 16, OpenGLCore = 17, Vulkan = 21 }
}

namespace Porteo
{
    public static class Pantalla
    {
        public static int Ancho = 1280, Alto = 720;
        public static float Dpi = 160;
        public static bool Completa;
        public static Action<bool> PedirCompleta;
    }

    public static partial class Plataforma
    {
        public static string SistemaOperativo = "Android OS (navegador)";
        public static string Modelo = "navegador";
        public static string IdentificadorDispositivo = "porteo";
    }
}

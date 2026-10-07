using System;
using System.Diagnostics;

namespace UnityEngine
{
    // Lo actualiza el bucle del motor una vez por cuadro (y en cada paso fijo).
    public partial class Time
    {
        internal static float t, dt, tFijo, dtFijo = 0.02f, maxDt = 0.3333333f, maxDtParticulas = 0.03f;
        internal static float tSinEscala, dtSinEscala, dtSuave, escala = 1f, tDesdeNivel, tInicioNivel;
        internal static int cuadros;
        internal static bool enPasoFijo;
        static readonly Stopwatch reloj = Stopwatch.StartNew();

        public static float time => enPasoFijo ? tFijo : t;
        public static float timeSinceLevelLoad => t - tInicioNivel;
        public static float deltaTime => enPasoFijo ? dtFijo : dt;
        public static float fixedTime => tFijo;
        public static float unscaledTime => tSinEscala;
        public static float fixedUnscaledTime => tFijo;
        public static float unscaledDeltaTime => dtSinEscala;
        public static float fixedUnscaledDeltaTime => dtFijo;
        public static float fixedDeltaTime { get => dtFijo; set => dtFijo = Math.Max(value, 0.0001f); }
        public static float maximumDeltaTime { get => maxDt; set => maxDt = value; }
        public static float maximumParticleDeltaTime { get => maxDtParticulas; set => maxDtParticulas = value; }
        public static float smoothDeltaTime => dtSuave;
        public static float timeScale { get => escala; set => escala = Math.Max(0f, value); }
        public static int frameCount => cuadros;
        public static int renderedFrameCount => cuadros;
        public static float realtimeSinceStartup => (float)reloj.Elapsed.TotalSeconds;
        public static bool inFixedTimeStep => enPasoFijo;
        public static int captureFramerate { get; set; }

        internal static double Ahora => reloj.Elapsed.TotalSeconds;
    }
}

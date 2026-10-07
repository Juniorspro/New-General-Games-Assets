using System;
using Porteo;

namespace UnityEngine
{
    public partial class Debug
    {
        public static bool isDebugBuild => false;

        static void Mostrar(LogType tipo, object mensaje, Object contexto, string pila = "")
        {
            string texto = mensaje is string s ? s : mensaje?.ToString() ?? "Null";
            if ((object)contexto != null && tipo != LogType.Log)
            {
                try { texto += " [" + contexto.name + "]"; } catch { }
            }
            var salida = Anfitrion.Consola;
            if (salida != null) salida(texto, tipo);
            else Console.WriteLine(texto);
            Application.Avisar(texto, pila, tipo);
        }

        public static void Log(object message) => Mostrar(LogType.Log, message, null);
        public static void Log(object message, Object context) => Mostrar(LogType.Log, message, context);
        public static void LogFormat(string format, params object[] args) => Mostrar(LogType.Log, string.Format(format, args), null);
        public static void LogFormat(Object context, string format, params object[] args) => Mostrar(LogType.Log, string.Format(format, args), context);
        public static void LogWarning(object message) => Mostrar(LogType.Warning, message, null);
        public static void LogWarning(object message, Object context) => Mostrar(LogType.Warning, message, context);
        public static void LogWarningFormat(string format, params object[] args) => Mostrar(LogType.Warning, string.Format(format, args), null);
        public static void LogError(object message) => Mostrar(LogType.Error, message, null);
        public static void LogError(object message, Object context) => Mostrar(LogType.Error, message, context);
        public static void LogErrorFormat(string format, params object[] args) => Mostrar(LogType.Error, string.Format(format, args), null);

        public static void LogException(Exception exception) => LogException(exception, null);

        public static void LogException(Exception exception, Object context)
        {
            if (exception == null) return;
            Mostrar(LogType.Exception, exception.GetType().FullName + ": " + exception.Message, context, exception.StackTrace ?? "");
            var salida = Anfitrion.Consola;
            if (salida != null) salida(exception.ToString(), LogType.Exception);
        }

        public static void Assert(bool condition) { if (!condition) Mostrar(LogType.Assert, "Assertion failed", null); }
        public static void Assert(bool condition, object message) { if (!condition) Mostrar(LogType.Assert, message, null); }
        public static void Assert(bool condition, string message) { if (!condition) Mostrar(LogType.Assert, message, null); }
        public static void Assert(bool condition, object message, Object context) { if (!condition) Mostrar(LogType.Assert, message, context); }

        public static void DrawLine(Vector3 start, Vector3 end) { }
        public static void DrawLine(Vector3 start, Vector3 end, Color color) { }
        public static void DrawLine(Vector3 start, Vector3 end, Color color, float duration) { }
        public static void DrawLine(Vector3 start, Vector3 end, Color color, float duration, bool depthTest) { }
        public static void DrawRay(Vector3 start, Vector3 dir) { }
        public static void DrawRay(Vector3 start, Vector3 dir, Color color) { }
        public static void DrawRay(Vector3 start, Vector3 dir, Color color, float duration) { }
        public static void DrawRay(Vector3 start, Vector3 dir, Color color, float duration, bool depthTest) { }
        public static void Break() { }
    }

    public partial class Application
    {
        static event LogCallback registro;
        static bool avisando;

        internal static void Avisar(string texto, string pila, LogType tipo)
        {
            var r = registro;
            if (r == null || avisando) return;
            avisando = true;   // si el que escucha también escribe en la consola, no volver a entrar
            try { r(texto, pila, tipo); }
            catch (Exception e) { Console.WriteLine("porteo: logMessageReceived falló: " + e); }
            finally { avisando = false; }
        }

        public static event LogCallback logMessageReceived { add => registro += value; remove => registro -= value; }
        public static event LogCallback logMessageReceivedThreaded { add => registro += value; remove => registro -= value; }

        public static bool isPlaying => true;
        public static bool isEditor => false;
        public static bool isMobilePlatform => Plataforma.Movil;
        public static bool isFocused => Plataforma.Enfocada;

        // El juego se compiló para Android: el código de plataforma ya viene elegido para esa,
        // así que se informa Android para que lo que se decide en tiempo de ejecución coincida.
        public static RuntimePlatform platform => RuntimePlatform.Android;

        public static string unityVersion => "2018.4.36f1";
        public static string version => Plataforma.VersionJuego;
        public static string productName => Plataforma.Producto;
        public static string companyName => Plataforma.Empresa;
        public static string identifier => Plataforma.Identificador;
        public static string dataPath => "/datos";
        public static string streamingAssetsPath => "/datos/StreamingAssets";
        public static string persistentDataPath => Plataforma.RutaPersistente;
        public static string temporaryCachePath => "/tmp";
        public static SystemLanguage systemLanguage => Plataforma.Idioma;
        public static NetworkReachability internetReachability => NetworkReachability.ReachableViaLocalAreaNetwork;
        public static int targetFrameRate { get => Plataforma.CuadrosObjetivo; set => Plataforma.CuadrosObjetivo = value; }
        public static bool runInBackground { get; set; }
        public static StackTraceLogType stackTraceLogType { get; set; } = StackTraceLogType.ScriptOnly;
        public static ThreadPriority backgroundLoadingPriority { get; set; } = ThreadPriority.BelowNormal;

        public static void Quit() => Plataforma.Salir?.Invoke();
        public static bool HasProLicense() => true;
        public static void OpenURL(string url) => Plataforma.AbrirUrl?.Invoke(url);
    }

    public enum NetworkReachability { NotReachable = 0, ReachableViaCarrierDataNetwork = 1, ReachableViaLocalAreaNetwork = 2 }
    public enum ThreadPriority { Low = 0, BelowNormal = 1, Normal = 2, High = 4 }
}

namespace Porteo
{
    // Lo que depende de dónde corre el juego: lo completa el anfitrión.
    public static class Plataforma
    {
        public static bool Movil;
        public static bool Enfocada = true;
        public static string VersionJuego = "1.2";
        public static string Producto = "Slime Rancher";
        public static string Empresa = "Monomi Park";
        public static string Identificador = "com.monomipark.slimerancher";
        public static string RutaPersistente = "/persistente";
        public static UnityEngine.SystemLanguage Idioma = UnityEngine.SystemLanguage.English;
        public static int CuadrosObjetivo = -1;
        public static Action Salir;
        public static Action<string> AbrirUrl;
    }
}

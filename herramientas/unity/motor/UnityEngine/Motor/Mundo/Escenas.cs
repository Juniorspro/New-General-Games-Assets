using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;
using Porteo.Datos;

namespace Porteo
{
    // Una escena cargada (o la de DontDestroyOnLoad) con sus objetos raíz en orden: el orden
    // importa porque GameObject.Find devuelve el primero que encuentra.
    public sealed class Escena
    {
        public readonly int Id;
        public readonly string Nombre, Ruta;
        public readonly int IndiceBuild;
        internal readonly List<Transform> raices = new List<Transform>();
        internal bool cargada;

        internal Escena(int id, string nombre, string ruta, int indice)
        {
            Id = id; Nombre = nombre; Ruta = ruta; IndiceBuild = indice;
        }

        public override string ToString() => $"Escena({Nombre}, {Id})";
    }

    public static class Escenas
    {
        static int siguienteId = 1;
        internal static readonly List<Escena> cargadas = new List<Escena>();
        static Escena activa;
        static Escena noDestruir;
        // las del build (indice.json): la ruta de cada una; el archivo es "level" + índice
        static string[] rutas = Array.Empty<string>();

        // Lo que se pidió con LoadScene: Unity no carga en el momento sino al empezar el cuadro siguiente.
        sealed class Pedido
        {
            public int Indice;
            public LoadSceneMode Modo;
            public AsyncOperation Op;
        }
        static readonly List<Pedido> pedidos = new List<Pedido>();

        internal static event Action<Escena, LoadSceneMode> alCargar;

        public static void Iniciar(string[] rutasBuild)
        {
            rutas = rutasBuild ?? Array.Empty<string>();
        }

        // Antes de la primera escena (o si se crean objetos fuera de toda escena) hace falta una
        // activa: Unity siempre tiene una.
        public static Escena Activa
        {
            get
            {
                if (activa == null)
                {
                    activa = new Escena(siguienteId++, "Untitled", "", -1) { cargada = true };
                    cargadas.Add(activa);
                }
                return activa;
            }
        }

        public static Escena NoDestruir => noDestruir ??= new Escena(-siguienteId++, "DontDestroyOnLoad", "", -1) { cargada = true };

        internal static void PonerActiva(Escena e) => activa = e;

        public static Escena PorId(int id)
        {
            if (activa != null && activa.Id == id) return activa;
            foreach (var e in cargadas) if (e.Id == id) return e;
            if (noDestruir != null && noDestruir.Id == id) return noDestruir;
            return null;
        }

        public static int CantidadBuild => rutas.Length;
        public static string RutaBuild(int i) => i >= 0 && i < rutas.Length ? rutas[i] : null;

        public static string NombreDeRuta(string ruta)
        {
            if (ruta == null) return "";
            int b = ruta.LastIndexOf('/') + 1;
            int p = ruta.EndsWith(".unity", StringComparison.Ordinal) ? ruta.Length - 6 : ruta.Length;
            return ruta.Substring(b, p - b);
        }

        // nombre corto, ruta completa o ruta sin "Assets/" ni ".unity", como acepta LoadScene
        public static int IndicePorNombre(string nombre)
        {
            if (string.IsNullOrEmpty(nombre)) return -1;
            for (int i = 0; i < rutas.Length; i++)
            {
                var r = rutas[i];
                if (string.Equals(r, nombre, StringComparison.OrdinalIgnoreCase)) return i;
                if (string.Equals(NombreDeRuta(r), nombre, StringComparison.OrdinalIgnoreCase)) return i;
                var sin = r.StartsWith("Assets/", StringComparison.Ordinal) ? r.Substring(7) : r;
                if (sin.EndsWith(".unity", StringComparison.Ordinal)) sin = sin.Substring(0, sin.Length - 6);
                if (string.Equals(sin, nombre, StringComparison.OrdinalIgnoreCase)) return i;
            }
            return -1;
        }

        // ── raíces ──
        public static IEnumerable<Transform> Raices()
        {
            for (int i = 0; i < cargadas.Count; i++)
            {
                var l = cargadas[i].raices;
                for (int j = 0; j < l.Count; j++) yield return l[j];
            }
            if (noDestruir != null)
                for (int j = 0; j < noDestruir.raices.Count; j++) yield return noDestruir.raices[j];
        }

        internal static void AgregarRaiz(Transform t)
        {
            var e = t.go?.escena;
            if (e != null && !e.raices.Contains(t)) e.raices.Add(t);
        }

        internal static void QuitarRaiz(Transform t)
        {
            t.go?.escena?.raices.Remove(t);
        }

        // un Transform que se quedó sin padre pasa a ser raíz de la escena de su objeto
        internal static void RaizNueva(Transform t, Transform viejoPadre) => AgregarRaiz(t);

        // el objeto y sus hijos pasan a otra escena (al colgarlo de un objeto de esa escena)
        internal static void Mover(GameObject go, Escena e)
        {
            if (go.escena == e) return;
            bool raiz = go.trans.padre == null;
            if (raiz) QuitarRaiz(go.trans);
            Marcar(go.trans, e);
            if (raiz) AgregarRaiz(go.trans);
        }

        static void Marcar(Transform t, Escena e)
        {
            t.go.escena = e;
            for (int i = 0; i < t.hijos.Count; i++) Marcar(t.hijos[i], e);
        }

        internal static int IndiceRaiz(Transform t) => t.go?.escena?.raices.IndexOf(t) ?? 0;

        internal static void MoverRaiz(Transform t, int i)
        {
            var l = t.go?.escena?.raices;
            if (l == null || !l.Remove(t)) return;
            l.Insert(Math.Clamp(i, 0, l.Count), t);
        }

        internal static void NoDestruirAlCargar(GameObject go)
        {
            if (go.trans.padre != null)
            {
                Debug.LogWarning("DontDestroyOnLoad only works for root GameObjects or components on root GameObjects.");
                return;
            }
            Mover(go, NoDestruir);
        }

        // ── cargar ──
        public static AsyncOperation Pedir(int indice, LoadSceneMode modo, bool asincronica)
        {
            if (indice < 0 || indice >= rutas.Length)
            {
                Debug.LogError($"Scene with build index {indice} couldn't be loaded because it has not been added to the build settings or the AssetBundle has not been loaded.");
                return null;
            }
            var op = new AsyncOperation();
            pedidos.Add(new Pedido { Indice = indice, Modo = modo, Op = op });
            return asincronica ? op : null;
        }

        // al principio del cuadro (donde Unity integra las cargas pendientes)
        internal static void ProcesarPedidos()
        {
            while (pedidos.Count > 0)
            {
                var p = pedidos[0];
                // una carga asincrónica con allowSceneActivation = false queda en 0.9 hasta que la dejen
                if (!p.Op.permitirActivacion) { p.Op.avance = 0.9f; return; }
                pedidos.RemoveAt(0);
                CargarAhora(p.Indice, p.Modo);
                p.Op.Terminar();
            }
        }

        public static Escena CargarAhora(int indice, LoadSceneMode modo)
        {
            var ruta = rutas[indice];
            var nueva = new Escena(siguienteId++, NombreDeRuta(ruta), ruta, indice);
            Cargador.Cronometro("escena " + nueva.Nombre, () =>
            {
                if (modo == LoadSceneMode.Single)
                {
                    // Unity descarga las escenas viejas (OnDisable, OnDestroy) antes de despertar las nuevas
                    foreach (var vieja in cargadas.ToArray()) Descargar(vieja);
                    cargadas.Clear();
                    activa = nueva;
                }
                cargadas.Add(nueva);
                Cargador.InstanciarEscena(nueva, "level" + indice);
                nueva.cargada = true;
            });
            alCargar?.Invoke(nueva, modo);
            Time.tInicioNivel = Time.t;
            return nueva;
        }

        static void Descargar(Escena e)
        {
            foreach (var r in e.raices.ToArray())
                if (r != null && !r.destruido && r.go != null) Mundo.DestruirYa(r.go);
            e.raices.Clear();
            e.cargada = false;
        }

        internal static Scene Unity(Escena e) => new Scene { m_Handle = e?.Id ?? 0 };
    }
}

namespace UnityEngine.SceneManagement
{
    public partial struct Scene
    {
        Porteo.Escena E => Porteo.Escenas.PorId(m_Handle);

        public string name => E?.Nombre;
        public string path => E?.Ruta;
        public int buildIndex => E?.IndiceBuild ?? -1;
        public bool isLoaded => E?.cargada ?? false;
        public int handle => m_Handle;
        public bool isDirty => false;
        public int rootCount => E?.raices.Count ?? 0;
        public bool IsValid() => E != null;

        public GameObject[] GetRootGameObjects()
        {
            var e = E;
            if (e == null) return Array.Empty<GameObject>();
            var r = new GameObject[e.raices.Count];
            for (int i = 0; i < r.Length; i++) r[i] = e.raices[i].go;
            return r;
        }

        public void GetRootGameObjects(System.Collections.Generic.List<GameObject> rootGameObjects)
        {
            rootGameObjects.Clear();
            var e = E;
            if (e != null) foreach (var t in e.raices) rootGameObjects.Add(t.go);
        }

        public override int GetHashCode() => m_Handle;
        public override bool Equals(object other) => other is Scene s && s.m_Handle == m_Handle;
        public static bool operator ==(Scene lhs, Scene rhs) => lhs.m_Handle == rhs.m_Handle;
        public static bool operator !=(Scene lhs, Scene rhs) => lhs.m_Handle != rhs.m_Handle;
    }

    public partial class SceneManager
    {
        static event Events.UnityAction<Scene, LoadSceneMode> cargada;

        static SceneManager()
        {
            Porteo.Escenas.alCargar += (e, m) =>
            {
                var c = cargada;
                if (c == null) return;
                foreach (Events.UnityAction<Scene, LoadSceneMode> d in c.GetInvocationList())
                    Porteo.Mensajes.Accion(() => d(Porteo.Escenas.Unity(e), m), null);
            };
        }

        public static event Events.UnityAction<Scene, LoadSceneMode> sceneLoaded
        {
            add => cargada += value;
            remove => cargada -= value;
        }

        public static int sceneCount => Porteo.Escenas.cargadas.Count;
        public static int sceneCountInBuildSettings => Porteo.Escenas.CantidadBuild;

        public static Scene GetActiveScene() => Porteo.Escenas.Unity(Porteo.Escenas.Activa);

        public static bool SetActiveScene(Scene scene)
        {
            var e = Porteo.Escenas.PorId(scene.m_Handle);
            if (e == null || !e.cargada) return false;
            Porteo.Escenas.PonerActiva(e);
            return true;
        }

        public static Scene GetSceneAt(int index) => Porteo.Escenas.Unity(Porteo.Escenas.cargadas[index]);

        public static Scene GetSceneByName(string name)
        {
            foreach (var e in Porteo.Escenas.cargadas)
                if (e.Nombre == name || e.Ruta == name) return Porteo.Escenas.Unity(e);
            return default;
        }

        public static void LoadScene(string sceneName) => LoadScene(sceneName, LoadSceneMode.Single);
        public static void LoadScene(int sceneBuildIndex) => LoadScene(sceneBuildIndex, LoadSceneMode.Single);

        public static void LoadScene(string sceneName, LoadSceneMode mode)
        {
            int i = Porteo.Escenas.IndicePorNombre(sceneName);
            if (i < 0) { Debug.LogError($"Scene '{sceneName}' couldn't be loaded because it has not been added to the build settings or the AssetBundle has not been loaded."); return; }
            Porteo.Escenas.Pedir(i, mode, false);
        }

        public static void LoadScene(int sceneBuildIndex, LoadSceneMode mode) => Porteo.Escenas.Pedir(sceneBuildIndex, mode, false);

        public static AsyncOperation LoadSceneAsync(string sceneName) => LoadSceneAsync(sceneName, LoadSceneMode.Single);

        public static AsyncOperation LoadSceneAsync(string sceneName, LoadSceneMode mode)
        {
            int i = Porteo.Escenas.IndicePorNombre(sceneName);
            if (i < 0) { Debug.LogError($"Scene '{sceneName}' couldn't be loaded because it has not been added to the build settings or the AssetBundle has not been loaded."); return null; }
            return Porteo.Escenas.Pedir(i, mode, true);
        }

        public static AsyncOperation LoadSceneAsync(int sceneBuildIndex, LoadSceneMode mode) => Porteo.Escenas.Pedir(sceneBuildIndex, mode, true);
    }
}

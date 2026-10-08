using System;
using System.Collections.Generic;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Porteo.Datos
{
    // Los ajustes del proyecto (globalgamemanagers) y los de cada escena (RenderSettings...).
    public static class Ajustes
    {
        static readonly string[] etiquetasFijas = { "Untagged", "Respawn", "Finish", "EditorOnly", "", "MainCamera", "Player", "GameController" };
        static readonly List<string> etiquetas = new List<string>();
        public static Mapa Fisica, Entrada, Calidad, Jugador, Graficos, Audio, Tiempo;
        // Resources.Load: ruta en minúsculas → objetos (puede haber varios con la misma ruta)
        static readonly Dictionary<string, List<PPtr>> recursos = new Dictionary<string, List<PPtr>>(StringComparer.OrdinalIgnoreCase);
        static Archivo gestores;

        public static void Cargar()
        {
            var g = Cargador.Archivo("globalgamemanagers");
            gestores = g;
            if (g == null) return;
            foreach (var pid in g.Paq.Orden)
            {
                var e = g.Paq.Objetos[pid];
                var m = g.Datos(pid);
                if (m == null) continue;
                switch (e.Clase)
                {
                    case 78: LeerEtiquetas(m); break;
                    case 5: Tiempo = m; LeerTiempo(m); break;
                    case 55: Fisica = m; break;
                    case 13: Entrada = m; break;
                    case 47: Calidad = m; break;
                    case 129: Jugador = m; break;
                    case 30: Graficos = m; break;
                    case 11: Audio = m; break;
                    case 147: LeerRecursos(m); break;
                    case 94: mapaShaders = m; break;
                }
            }
            // el orden de ejecución de los scripts está en sus MonoScript
            var a = Cargador.Archivo("globalgamemanagers.assets");
            if (a != null)
                foreach (var pid in a.Paq.Orden)
                {
                    if (a.Paq.Objetos[pid].Clase != 115) continue;
                    var m = a.Datos(pid);
                    int o = m?.I32("m_ExecutionOrder") ?? 0;
                    if (o != 0) Activacion.RegistrarOrden(m.S("m_AssemblyName") ?? "", m.S("m_Namespace"), m.S("m_ClassName") ?? "", o);
                }
        }

        static void LeerEtiquetas(Mapa m)
        {
            etiquetas.Clear();
            var l = m.L("tags");
            if (l != null) foreach (var x in l) etiquetas.Add(x as string ?? "");
            var capas = m.L("layers");
            if (capas != null)
                for (int i = 0; i < 32 && i < capas.Count; i++) LayerMask.nombres[i] = capas[i] as string ?? "";
        }

        static void LeerTiempo(Mapa m)
        {
            Time.dtFijo = m.F("Fixed Timestep", 0.02f);
            Time.maxDt = m.F("Maximum Allowed Timestep", 0.3333333f);
            Time.escala = m.F("m_TimeScale", 1f);
            Time.maxDtParticulas = m.F("Maximum Particle Timestep", 0.03f);
        }

        static void LeerRecursos(Mapa m)
        {
            var l = m.L("m_Container");
            if (l == null) return;
            foreach (var x in l)
            {
                if (!(x is List<object> par) || par.Count < 2 || !(par[0] is string ruta) || !(par[1] is PPtr p)) continue;
                if (!recursos.TryGetValue(ruta, out var ps)) recursos[ruta] = ps = new List<PPtr>();
                ps.Add(p);
            }
        }

        // ScriptMapper: el nombre de cada shader que el proyecto incluye (para Shader.Find)
        static Mapa mapaShaders;
        static Dictionary<string, PPtr> shaders;

        public static Shader ShaderPorNombre(string nombre)
        {
            if (shaders == null)
            {
                shaders = new Dictionary<string, PPtr>();
                var l = mapaShaders?.M("m_Shaders")?.L("m_ObjectToName");
                if (l != null)
                    foreach (var x in l)
                        if (x is List<object> par && par.Count == 2 && par[0] is PPtr p && par[1] is string n && !p.Nulo) shaders[n] = p;
            }
            return gestores != null && shaders.TryGetValue(nombre, out var q) ? gestores.Resolver(q) as Shader : null;
        }

        // Lo que el juego puede pedir en cualquier momento sin cargar una escena: lo de Resources,
        // los shaders que se buscan por nombre y los que el proyecto incluye siempre.
        public static IEnumerable<(Archivo a, long pid)> Siempre()
        {
            if (gestores == null) yield break;
            foreach (var ps in recursos.Values)
                foreach (var p in ps) if (!p.Nulo) yield return Ubicar(p);
            var l = mapaShaders?.M("m_Shaders")?.L("m_ObjectToName");
            if (l != null)
                foreach (var x in l)
                    if (x is List<object> par && par.Count == 2 && par[0] is PPtr p && !p.Nulo) yield return Ubicar(p);
            var inc = Graficos?.L("m_AlwaysIncludedShaders");
            if (inc != null)
                foreach (var x in inc)
                    if (x is PPtr p && !p.Nulo) yield return Ubicar(p);
        }

        static (Archivo, long) Ubicar(PPtr p) => (p.Archivo == 0 ? gestores : gestores.Externo(p.Archivo - 1), p.PathID);

        public static string Etiqueta(int id)
        {
            if (id >= 0 && id < etiquetasFijas.Length) return etiquetasFijas[id];
            if (id >= 20000 && id - 20000 < etiquetas.Count) return etiquetas[id - 20000];
            return "Untagged";
        }

        public static bool EtiquetaExiste(string t)
        {
            if (Array.IndexOf(etiquetasFijas, t) >= 0) return true;
            return etiquetas.Contains(t);
        }

        // los objetos de Resources con esa ruta (los PPtr del ResourceManager son relativos a globalgamemanagers)
        public static IEnumerable<Object> Recursos(string ruta)
        {
            if (gestores == null || ruta == null) yield break;
            if (!recursos.TryGetValue(ruta.Replace('\\', '/').TrimStart('/'), out var ps)) yield break;
            foreach (var p in ps)
            {
                var o = gestores.Resolver(p);
                if (o != null) yield return o;
            }
        }

        public static IEnumerable<Object> RecursosBajo(string carpeta)
        {
            if (gestores == null) yield break;
            carpeta = (carpeta ?? "").Replace('\\', '/').Trim('/');
            foreach (var kv in recursos)
            {
                if (carpeta.Length > 0 && !(kv.Key.StartsWith(carpeta + "/", StringComparison.OrdinalIgnoreCase) || string.Equals(kv.Key, carpeta, StringComparison.OrdinalIgnoreCase))) continue;
                foreach (var p in kv.Value)
                {
                    var o = gestores.Resolver(p);
                    if (o != null) yield return o;
                }
            }
        }

        // RenderSettings, LightmapSettings y demás objetos sueltos de una escena
        internal static Action<Object> alCargarAjusteDeEscena;
        internal static void DeEscena(Object o) => alCargarAjusteDeEscena?.Invoke(o);
    }
}

namespace UnityEngine
{
    public sealed partial class Resources
    {
        public static Object Load(string path) => Load(path, typeof(Object));
        public static T Load<T>(string path) where T : Object => (T)Load(path, typeof(T));

        public static Object Load(string path, Type systemTypeInstance)
        {
            foreach (var o in Porteo.Datos.Ajustes.Recursos(path))
                if (systemTypeInstance.IsInstanceOfType(o)) return o;
            // un GameObject pedido como componente: el componente de ese tipo
            if (typeof(Component).IsAssignableFrom(systemTypeInstance))
                foreach (var o in Porteo.Datos.Ajustes.Recursos(path))
                    if (o is GameObject go && go.GetComponent(systemTypeInstance) is Component c) return c;
            return null;
        }

        public static Object[] LoadAll(string path) => LoadAll(path, typeof(Object));

        public static Object[] LoadAll(string path, Type systemTypeInstance)
        {
            var l = new List<Object>();
            foreach (var o in Porteo.Datos.Ajustes.RecursosBajo(path))
                if (systemTypeInstance.IsInstanceOfType(o) && !l.Contains(o)) l.Add(o);
            var a = (Object[])Array.CreateInstance(systemTypeInstance, l.Count);
            for (int i = 0; i < l.Count; i++) a[i] = l[i];
            return a;
        }

        public static T[] LoadAll<T>(string path) where T : Object
        {
            var l = new List<T>();
            foreach (var o in Porteo.Datos.Ajustes.RecursosBajo(path))
                if (o is T t && !l.Contains(t)) l.Add(t);
            return l.ToArray();
        }

        public static Object[] FindObjectsOfTypeAll(Type type)
        {
            var l = new List<Object>();
            foreach (var o in Porteo.Registro.Todos(type)) l.Add(o);
            var a = (Object[])Array.CreateInstance(type, l.Count);
            for (int i = 0; i < l.Count; i++) a[i] = l[i];
            return a;
        }

        public static T[] FindObjectsOfTypeAll<T>() where T : Object
        {
            var l = new List<T>();
            foreach (var o in Porteo.Registro.Todos(typeof(T))) l.Add((T)o);
            return l.ToArray();
        }

        public static T GetBuiltinResource<T>(string path) where T : Object => (T)GetBuiltinResource(typeof(T), path);

        public static Object GetBuiltinResource(Type type, string path) => Porteo.Datos.Integrados.Buscar(type, path);

        public static void UnloadAsset(Object assetToUnload) { }

        public static AsyncOperation UnloadUnusedAssets()
        {
            var op = new AsyncOperation();
            op.Terminar();
            return op;
        }
    }
}

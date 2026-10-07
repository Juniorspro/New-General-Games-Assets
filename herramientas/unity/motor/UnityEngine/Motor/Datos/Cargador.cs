using System;
using System.Collections.Generic;
using System.Diagnostics;
using UnityEngine;
using Debug = UnityEngine.Debug;
using Object = UnityEngine.Object;

namespace Porteo
{
    // Lo que el motor le pide a quien lo hospeda (el navegador o una consola de pruebas).
    public static class Anfitrion
    {
        public static Func<string, byte[]> LeerPaquete;   // "level0" → el .paq
        public static Func<int, byte[]> LeerRecurso;      // id → recursos/ID.bin
        public static Action<string, LogType> Consola;
    }
}

namespace Porteo.Datos
{
    // Un archivo serializado de Unity ya exportado: sus objetos se crean cuando alguien los pide
    // (los de una escena, todos al cargarla).
    public sealed class Archivo : IResolutor
    {
        public readonly string Nombre;
        public readonly Paquete Paq;
        internal readonly Dictionary<long, Object> objetos = new Dictionary<long, Object>();
        readonly Archivo[] externos;
        internal Escena escena;   // los archivos de escena: sus GameObject van a esta

        internal Archivo(string nombre, Paquete paq)
        {
            Nombre = nombre; Paq = paq;
            externos = new Archivo[paq.Externos.Length];
        }

        Archivo Externo(int i)
        {
            if (i < 0 || i >= externos.Length) return null;
            return externos[i] ??= Cargador.Archivo(Paq.Externos[i]);
        }

        public Object Resolver(PPtr p)
        {
            if (p.Nulo) return null;
            var a = p.Archivo == 0 ? this : Externo(p.Archivo - 1);
            return a?.Objeto(p.PathID);
        }

        public Object Objeto(long pathID)
        {
            if (objetos.TryGetValue(pathID, out var o)) return o;
            if (!Paq.Objetos.TryGetValue(pathID, out var e)) { objetos[pathID] = null; return null; }
            return Cargador.Crear(this, pathID, e);
        }

        public byte[] Recurso(int id) => Cargador.Recurso(id);

        public Mapa Datos(long pathID) => Paq.Leer(pathID) as Mapa;

        public override string ToString() => Nombre;
    }

    public static class Cargador
    {
        static readonly Dictionary<string, Archivo> archivos = new Dictionary<string, Archivo>(StringComparer.OrdinalIgnoreCase);
        static readonly Queue<(Archivo a, long pid, Paquete.Entrada e, Object o)> cola = new Queue<(Archivo, long, Paquete.Entrada, Object)>();
        static readonly List<ScriptableObject> scriptablesNuevos = new List<ScriptableObject>();
        static readonly HashSet<string> avisados = new HashSet<string>();
        static int llenando;

        // nombres de Unity → nombre del .paq: "library/unity default resources" y similares
        static string Normalizar(string nombre)
        {
            int b = nombre.LastIndexOfAny(new[] { '/', '\\' });
            if (b >= 0) nombre = nombre.Substring(b + 1);
            return nombre;
        }

        public static Archivo Archivo(string nombre)
        {
            nombre = Normalizar(nombre);
            if (archivos.TryGetValue(nombre, out var a)) return a;
            byte[] datos = null;
            try { datos = Anfitrion.LeerPaquete?.Invoke(nombre); }
            catch (Exception e) { Debug.LogException(e); }
            if (datos == null)
            {
                if (avisados.Add("archivo:" + nombre)) Debug.LogWarning("porteo: falta el archivo " + nombre);
                archivos[nombre] = null;
                return null;
            }
            a = new Archivo(nombre, new Paquete(nombre, datos));
            archivos[nombre] = a;
            return a;
        }

        public static byte[] Recurso(int id)
        {
            var r = Anfitrion.LeerRecurso?.Invoke(id);
            if (r == null) throw new InvalidOperationException("porteo: falta el recurso " + id);
            return r;
        }

        // Crea el objeto vacío (para que las referencias circulares encuentren algo) y lo deja en
        // la cola: los datos se cargan al vaciarla.
        internal static Object Crear(Archivo a, long pathID, Paquete.Entrada e)
        {
            Object o = null;
            if (e.Clase == 114)
            {
                Type t = null;
                if (e.Script >= 0 && e.Script < a.Paq.Scripts.Length)
                {
                    var (ens, ns, cl) = a.Paq.Scripts[e.Script];
                    t = Tipos.Script(ens, ns, cl);
                    if (t == null && avisados.Add("script:" + ns + "." + cl)) Debug.LogWarning($"porteo: no encuentro el script {ns}.{cl} ({ens})");
                }
                if (t != null && typeof(Object).IsAssignableFrom(t) && !t.IsAbstract)
                {
                    try { o = (Object)Activator.CreateInstance(t, true); }
                    catch (Exception ex) { Debug.LogException(ex.InnerException ?? ex); }
                }
            }
            else
            {
                o = Nativos.Crear(e.Clase);
                if (o == null && avisados.Add("clase:" + e.Clase)) Debug.LogWarning($"porteo: clase nativa {e.Clase} sin implementar ({a.Nombre})");
            }
            a.objetos[pathID] = o;
            if (o == null) return null;
            o.pathID = pathID;
            o.archivo = a;
            cola.Enqueue((a, pathID, e, o));
            if (llenando == 0) Llenar();
            return o;
        }

        // vacía la cola: cada objeto lee sus datos (y puede pedir otros, que se suman a la cola)
        static void Llenar()
        {
            llenando++;
            try
            {
                while (cola.Count > 0)
                {
                    var (a, pid, e, o) = cola.Dequeue();
                    try
                    {
                        var m = a.Datos(pid);
                        if (m != null) LlenarObjeto(a, o, m);
                    }
                    catch (Exception ex)
                    {
                        Debug.LogError($"porteo: falló la carga de {o.GetType().Name} {a.Nombre}:{pid}: {ex}");
                    }
                }
            }
            finally { llenando--; }
            // Awake/OnEnable de los ScriptableObject recién cargados, con todo lo suyo ya leído
            if (llenando == 0 && scriptablesNuevos.Count > 0)
            {
                var l = scriptablesNuevos.ToArray();
                scriptablesNuevos.Clear();
                foreach (var so in l) Activacion.DespertarScriptable(so);
            }
        }

        static void LlenarObjeto(Archivo a, Object o, Mapa m)
        {
            switch (o)
            {
                case GameObject go: LeerGameObject(a, go, m); break;
                case Component c:
                {
                    c.go = a.Resolver(m.P("m_GameObject")) as GameObject;
                    if (c is Behaviour b && m.Tiene("m_Enabled")) b.habilitado = m.I("m_Enabled", 1) != 0;
                    if (c is MonoBehaviour mb) Serial.Leer(mb, m, a);
                    else c.LeerNativo(m, a);
                    break;
                }
                case ScriptableObject so:
                    so.m_Name = m.S("m_Name") ?? "";
                    Serial.Leer(so, m, a);
                    scriptablesNuevos.Add(so);
                    break;
                default:
                    o.m_Name = m.S("m_Name") ?? "";
                    o.LeerNativo(m, a);
                    break;
            }
        }

        static void LeerGameObject(Archivo a, GameObject go, Mapa m)
        {
            go.m_Name = m.S("m_Name") ?? "";
            go.capa = m.I32("m_Layer");
            go.etiqueta = Ajustes.Etiqueta(m.I32("m_Tag"));
            go.activoPropio = m.B("m_IsActive", true);
            go.escena = a.escena;
            var cs = m.L("m_Component");
            if (cs == null) return;
            foreach (var x in cs)
            {
                var p = x is Mapa mc ? mc.P("component") : default;
                if (!(a.Resolver(p) is Component c)) continue;
                c.go = go;
                if (go.componentes.Contains(c)) continue;
                if (c is Transform t) { go.trans = t; go.componentes.Insert(0, t); }
                else go.componentes.Add(c);
            }
        }

        // ── escenas ──
        internal static void InstanciarEscena(Escena e, string nombreArchivo)
        {
            var a = Archivo(nombreArchivo);
            if (a == null) { Debug.LogError("porteo: no está la escena " + nombreArchivo); return; }
            a.escena = e;
            llenando++;
            try
            {
                foreach (var pid in a.Paq.Orden) a.Objeto(pid);
            }
            finally { llenando--; }
            Llenar();

            // raíces en el orden del archivo
            var componentes = new List<Component>();
            foreach (var pid in a.Paq.Orden)
            {
                var o = a.objetos[pid];
                if (o is Transform t && t.padre == null && t.go != null && !t.destruido) e.raices.Add(t);
                if (o is Component c && c.go != null) componentes.Add(c);
                else if (o != null && !(o is GameObject)) Ajustes.DeEscena(o);
            }
            // activos en la jerarquía, de arriba hacia abajo
            foreach (var r in e.raices) Marcar(r.go, true);
            var activos = componentes.FindAll(c => c.go.activoEnJerarquia && !c.destruido);
            Activacion.DespertarComponentes(activos);
        }

        static void Marcar(GameObject go, bool padreActivo)
        {
            go.activoEnJerarquia = padreActivo && go.activoPropio;
            foreach (var h in go.trans.hijos) if (h.go != null) Marcar(h.go, go.activoEnJerarquia);
        }

        public static void Cronometro(string que, Action a)
        {
            var s = Stopwatch.StartNew();
            a();
            Anfitrion.Consola?.Invoke($"porteo: {que} en {s.ElapsedMilliseconds} ms ({Registro.Cantidad} objetos vivos)", LogType.Log);
        }
    }
}

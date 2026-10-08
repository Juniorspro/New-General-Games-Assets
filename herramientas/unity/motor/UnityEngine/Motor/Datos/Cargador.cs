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
        public static Func<int, byte[]> LeerRecurso;      // id → recursos/ID.bin (null si todavía no llegó)
        public static Action<int> PedirRecurso;           // que lo traiga (sin esperar)
        public static Func<int, bool> HayRecurso;         // si ya llegó (sin copiarlo)
        public static Action<string, LogType> Consola;

        // Cuando los datos llegan de a poco por la red (la versión para un sitio), una escena no
        // espera lo que se puede usar después de llegar (ver Alcance.Diferible): el sonido suena
        // cuando llega y las texturas se dibujan con la de por defecto hasta que llegan.
        public static bool DiferirAudio, DiferirTexturas;

        // el .paq de una escena puede llegar recién cuando se la carga (el sitio no trae de entrada
        // el del mundo: 4 MB menos antes del menú). null: están todos desde el principio
        public static Func<string, bool> PaqueteLlego;
        public static Action<string> PedirPaquete;
        public static bool HayPaquete(string nombre) => PaqueteLlego == null || PaqueteLlego(nombre);

        // como LeerRecurso, pero null si para darlo habría que descomprimirlo ahora: lo descomprime
        // otro hilo y el que lo pidió vuelve a probar en el cuadro siguiente (si no hay, LeerRecurso)
        public static Func<int, byte[]> LeerRecursoListo;

        // un recurso si ya está; si no, se pide para más adelante
        public static byte[] Recurso(int id, bool pedir)
        {
            var b = LeerRecurso?.Invoke(id);
            if (b == null && pedir) PedirRecurso?.Invoke(id);
            return b;
        }

        // lo mismo sin trabar el cuadro, para lo que puede esperar unos cuadros (las texturas: se
        // dibujan con la de por defecto hasta que están)
        public static byte[] RecursoSinTrabar(int id, bool pedir)
        {
            var b = (LeerRecursoListo ?? LeerRecurso)?.Invoke(id);
            if (b == null && pedir) PedirRecurso?.Invoke(id);
            return b;
        }

        public static bool Hay(int id) => HayRecurso == null || HayRecurso(id);
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

        internal Archivo Externo(int i)
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
        // los .paq abiertos hasta ahora (la prueba de consola: cuáles necesita cada escena)
        public static IEnumerable<string> Abiertos => archivos.Keys;
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
                    try { o = (Object)Instancias.Crear(t); }
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

    // Lo que hay que traer antes de cargar algo: los recursos de todo lo que alcanzan sus objetos
    // siguiendo los punteros. Unity, al cargar una escena, carga todo lo que la escena referencia
    // (los prefabs que tienen los scripts, sus mallas, texturas y sonidos); acá esos datos llegan
    // de a poco desde el anfitrión, así que se piden todos antes y la escena se arma cuando están.
    public static class Alcance
    {
        const int TerrainData = 156;

        // Lo que una escena puede usar después de armada, si el anfitrión lo permite: el sonido
        // (AudioClip) y las texturas (Texture2D, Cubemap, Texture3D, Texture2DArray). En el menú
        // de Slime Rancher son 9 de cada 10 bytes de lo que alcanza (el director de objetos del
        // juego apunta a todos los prefabs) y casi nada de eso se ve o se oye ahí. Los videos
        // (VideoClip) como el sonido: los bytes los busca la página recién al crear el <video>
        // (VideoPlayer.Prepare), y en Bad Parenting el del bosque (casi 1 MB) alcanzaba desde el
        // arranque y se esperaba antes del menú.
        static bool Diferible(int clase) => clase switch
        {
            28 or 89 or 117 or 187 => Anfitrion.DiferirTexturas,
            83 or 329 => Anfitrion.DiferirAudio,
            _ => false,
        };

        // sinDiferibles: sólo lo que hay que tener antes de armar (lo que se espera). Las texturas
        // de un TerrainData van igual: el juego lee sus mapas de mezcla en la CPU (GetAlphamaps).
        public static HashSet<int> Recursos(IEnumerable<(Archivo a, long pid)> raices, bool sinDiferibles = false)
        {
            var vistos = new Dictionary<Archivo, HashSet<long>>();
            var pendientes = new Stack<(Archivo, long)>();
            var ps = new List<PPtr>();
            var rs = new List<int>();
            var res = new HashSet<int>();
            // los diferibles se deciden al final: un TerrainData puede aparecer después de sus texturas
            var aplazados = sinDiferibles ? new List<(Archivo, long, int[])>() : null;
            var deTerreno = sinDiferibles ? new HashSet<(Archivo, long)>() : null;
            foreach (var r in raices) if (r.a != null) pendientes.Push(r);
            while (pendientes.Count > 0)
            {
                var (a, pid) = pendientes.Pop();
                if (!vistos.TryGetValue(a, out var v)) vistos[a] = v = new HashSet<long>();
                if (!v.Add(pid)) continue;
                // lo que ya está cargado trajo lo suyo cuando se cargó (y lo que alcanza también)
                if (a.objetos.ContainsKey(pid)) continue;
                ps.Clear(); rs.Clear();
                a.Paq.Escanear(pid, ps, rs);
                int clase = sinDiferibles && a.Paq.Objetos.TryGetValue(pid, out var e) ? e.Clase : -1;
                if (sinDiferibles && Diferible(clase)) aplazados.Add((a, pid, rs.ToArray()));
                else foreach (var id in rs) res.Add(id);
                foreach (var p in ps)
                {
                    var b = p.Archivo == 0 ? a : a.Externo(p.Archivo - 1);
                    if (b == null || !b.Paq.Tiene(p.PathID)) continue;
                    if (clase == TerrainData) deTerreno.Add((b, p.PathID));
                    pendientes.Push((b, p.PathID));
                }
            }
            if (aplazados != null)
                foreach (var (a, pid, ids) in aplazados)
                    if (deTerreno.Contains((a, pid))) foreach (var id in ids) res.Add(id);
            return res;
        }

        public static HashSet<int> DeArchivo(Archivo a, bool sinDiferibles = false)
        {
            if (a == null) return new HashSet<int>();
            var l = new List<(Archivo, long)>(a.Paq.Orden.Length);
            foreach (var pid in a.Paq.Orden) l.Add((a, pid));
            return Recursos(l, sinDiferibles);
        }
    }

    // Un pedido de recursos: se piden todos de una y se cuenta cuántos faltan.
    public sealed class Espera
    {
        readonly List<int> faltan;
        public readonly int Total;

        public Espera(IEnumerable<int> ids)
        {
            faltan = new List<int>();
            var todos = new List<int>();
            foreach (var id in ids) { todos.Add(id); if (!Anfitrion.Hay(id)) faltan.Add(id); }
            Total = faltan.Count;
            foreach (var id in faltan) Anfitrion.PedirRecurso?.Invoke(id);
            // también los que ya están: en el HTML único "estar" es tener el bloque comprimido, y
            // pedirlo lo va descomprimiendo de a poco en otros hilos antes de que se use
            foreach (var id in todos) if (Anfitrion.Hay(id)) Anfitrion.PedirRecurso?.Invoke(id);
        }

        public bool Lista
        {
            get
            {
                if (faltan.Count > 0) faltan.RemoveAll(Anfitrion.Hay);
                return faltan.Count == 0;
            }
        }

        public float Avance => Total == 0 ? 1f : (Total - faltan.Count) / (float)Total;
    }
}

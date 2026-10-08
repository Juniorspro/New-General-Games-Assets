using System;
using System.Collections;
using System.Collections.Generic;
using System.Reflection;
using UnityEngine;

namespace Porteo
{
    // El ciclo de vida de los componentes, con las reglas de Unity:
    //  · Awake una sola vez, cuando el objeto pasa a estar activo en la jerarquía (aunque el script
    //    esté deshabilitado); OnEnable cada vez que queda activo y habilitado.
    //  · Al activar un grupo de objetos (carga de escena, SetActive, Instantiate) primero se
    //    activan los componentes nativos y después los scripts, ordenados por su orden de
    //    ejecución (el del MonoScript); cada script recibe Awake y enseguida OnEnable.
    //  · Start antes del primer Update/FixedUpdate/LateUpdate de ese script, en el siguiente punto
    //    de arranque del cuadro (y sólo si sigue habilitado; si no, cuando se habilite).
    public static class Activacion
    {
        static readonly Dictionary<(string, string, string), int> ordenScripts = new Dictionary<(string, string, string), int>();
        static List<MonoBehaviour> pendientes = new List<MonoBehaviour>();
        static List<MonoBehaviour> otraLista = new List<MonoBehaviour>();

        public static void RegistrarOrden(string ensamblado, string ns, string clase, int orden)
        {
            if (ensamblado.EndsWith(".dll", StringComparison.OrdinalIgnoreCase)) ensamblado = ensamblado.Substring(0, ensamblado.Length - 4);
            ordenScripts[(ensamblado, ns ?? "", clase)] = orden;
        }

        internal static int OrdenDe(Type t)
        {
            if (ordenScripts.TryGetValue((t.Assembly.GetName().Name, t.Namespace ?? "", t.Name), out int o)) return o;
            // [DefaultExecutionOrder] (Unity lo usa cuando el MonoScript no trae orden propio)
            for (var b = t; b != null && b != typeof(MonoBehaviour); b = b.BaseType)
                foreach (var a in b.GetCustomAttributesData())
                    if (a.AttributeType == typeof(DefaultExecutionOrder) && a.ConstructorArguments.Count == 1)
                        return (int)a.ConstructorArguments[0].Value;
            return 0;
        }

        // ── activar y desactivar ──
        public static void Recalcular(GameObject go)
        {
            if ((object)go == null || go.destruido) return;
            var p = go.trans?.padre;
            bool ahora = go.activoPropio && go.escena != null && (p == null || p.go.activoEnJerarquia);
            if (ahora == go.activoEnJerarquia) return;
            if (ahora) Activar(go); else Desactivar(go);
        }

        static void Activar(GameObject go)
        {
            var objetos = new List<GameObject>();
            JuntarQueSeActivan(go, objetos);
            DespertarGrupo(objetos);
        }

        static void JuntarQueSeActivan(GameObject go, List<GameObject> l)
        {
            go.activoEnJerarquia = true;
            l.Add(go);
            var hs = go.trans.hijos;
            for (int i = 0; i < hs.Count; i++)
            {
                var h = hs[i].go;
                if (h != null && h.activoPropio && !h.activoEnJerarquia) JuntarQueSeActivan(h, l);
            }
        }

        // Objetos que acaban de quedar activos (ya marcados), en el orden de la jerarquía.
        internal static void DespertarGrupo(List<GameObject> objetos)
        {
            var cs = new List<Component>();
            foreach (var go in objetos) cs.AddRange(go.componentes);
            DespertarComponentes(cs);
        }

        // Nativos primero; scripts después por orden de ejecución (a igual orden, el de la lista).
        internal static void DespertarComponentes(List<Component> cs)
        {
            var scripts = new List<MonoBehaviour>();
            foreach (var c in cs)
            {
                if (c.destruido) continue;
                if (c is MonoBehaviour mb) scripts.Add(mb);
                else if (c.HabilitadoNativo && c.go != null && c.go.activoEnJerarquia) Nativo(c, true);
            }
            OrdenarPorEjecucion(scripts);
            foreach (var mb in scripts) Despertar(mb);
        }

        // orden estable: a igual orden de ejecución, el de carga
        internal static void OrdenarPorEjecucion(List<MonoBehaviour> l)
        {
            if (l.Count < 2) return;
            var claves = new (int orden, int i, MonoBehaviour mb)[l.Count];
            for (int i = 0; i < l.Count; i++)
            {
                var mb = l[i];
                mb.tipoScript ??= TipoScript.De(mb.GetType());
                claves[i] = (mb.tipoScript.Orden, i, mb);
            }
            Array.Sort(claves, (a, b) => a.orden != b.orden ? a.orden.CompareTo(b.orden) : a.i.CompareTo(b.i));
            for (int i = 0; i < l.Count; i++) l[i] = claves[i].mb;
        }

        static void Nativo(Component c, bool activo)
        {
            try
            {
                if (activo) c.AlActivarse(); else c.AlDesactivarse();
            }
            catch (Exception e) { Debug.LogException(e, c); }
        }

        // Awake (si no se llamó) y OnEnable (si está habilitado) de un script de un objeto activo
        public static void Despertar(MonoBehaviour mb)
        {
            if (mb.destruido || mb.go == null || !mb.go.activoEnJerarquia) return;
            var ts = mb.tipoScript ??= TipoScript.De(mb.GetType());
            if (!mb.despierto)
            {
                mb.despierto = true;
                Mensajes.Llamar(mb, ts.Awake);
                if (mb.destruido || !mb.go.activoEnJerarquia) return;
            }
            if (mb.habilitado && !mb.enLinea) Habilitar(mb);
        }

        static void Habilitar(MonoBehaviour mb)
        {
            var ts = mb.tipoScript;
            mb.enLinea = true;
            Mensajes.Llamar(mb, ts.OnEnable);
            if (!mb.enLinea || mb.destruido) return;
            if (!mb.iniciado)
            {
                if (!mb.enColaStart) { mb.enColaStart = true; pendientes.Add(mb); }
            }
            else Ciclo.Agregar(mb);
        }

        static void Deshabilitar(MonoBehaviour mb)
        {
            if (!mb.enLinea) return;
            mb.enLinea = false;
            Ciclo.Quitar(mb);
            Mensajes.Llamar(mb, mb.tipoScript.OnDisable);
        }

        // El objeto deja de estar activo (SetActive(false), cambio de padre o destrucción):
        // primero se marcan todos y después OnDisable en el orden de la jerarquía.
        internal static void Desactivar(GameObject go)
        {
            var objetos = new List<GameObject>();
            JuntarActivos(go, objetos);
            foreach (var o in objetos) o.activoEnJerarquia = false;
            foreach (var o in objetos)
            {
                var cs = o.componentes.ToArray();
                foreach (var c in cs)
                {
                    if (c.destruido) continue;
                    if (c is MonoBehaviour mb)
                    {
                        if (mb.enLinea) Deshabilitar(mb);
                        // desactivar el objeto corta sus corrutinas (deshabilitar el script no)
                        Corrutinas.PararTodas(mb);
                    }
                    else if (c.HabilitadoNativo) Nativo(c, false);
                }
            }
        }

        static void JuntarActivos(GameObject go, List<GameObject> l)
        {
            if (!go.activoEnJerarquia) return;
            l.Add(go);
            var hs = go.trans.hijos;
            for (int i = 0; i < hs.Count; i++) if (hs[i].go != null) JuntarActivos(hs[i].go, l);
        }

        // cambió enabled de un componente (Behaviour, Renderer, Collider...)
        public static void HabilitacionCambiada(Component c)
        {
            if (c.destruido || c.go == null || !c.go.activoEnJerarquia) return;
            if (c is MonoBehaviour mb)
            {
                if (mb.habilitado)
                {
                    if (!mb.despierto) Despertar(mb);
                    else if (!mb.enLinea) Habilitar(mb);
                }
                else Deshabilitar(mb);
            }
            else Nativo(c, c.HabilitadoNativo);
        }

        internal static void ComponenteNuevo(Component c)
        {
            if (c.go == null || !c.go.activoEnJerarquia) return;
            if (c is MonoBehaviour mb) Despertar(mb);
            else if (c.HabilitadoNativo) Nativo(c, true);
        }

        // un componente que se destruye solo (no todo su objeto)
        internal static void QuitarComponente(Component c)
        {
            if (c is MonoBehaviour mb)
            {
                if (mb.enLinea) Deshabilitar(mb);
                Corrutinas.PararTodas(mb);
                Invocaciones.Cancelar(mb, null);
                if (mb.despierto) Mensajes.Llamar(mb, mb.tipoScript.OnDestroy);
            }
            else
            {
                if (c.go != null && c.go.activoEnJerarquia && c.HabilitadoNativo) Nativo(c, false);
                try { c.AlDestruirse(); } catch (Exception e) { Debug.LogException(e, c); }
            }
        }

        // ── Start ──
        // Los puntos de arranque: al empezar el cuadro, después de cada paso fijo y después de
        // Update. Los que se agregan mientras se recorre la lista quedan para el punto siguiente.
        internal static void ArrancarPendientes()
        {
            if (pendientes.Count == 0) return;
            var l = pendientes;
            pendientes = otraLista;
            otraLista = l;
            for (int i = 0; i < l.Count; i++)
            {
                var mb = l[i];
                mb.enColaStart = false;
                if (mb.destruido || mb.iniciado || !mb.enLinea) continue;
                mb.iniciado = true;
                var ts = mb.tipoScript;
                if (ts.Start != null)
                {
                    if (ts.StartEsCorrutina)
                    {
                        if (Mensajes.Llamar(mb, ts.Start) is IEnumerator it && !mb.destruido && mb.go.activoEnJerarquia)
                            Corrutinas.Iniciar(mb, it, null);
                    }
                    else Mensajes.Llamar(mb, ts.Start);
                }
                if (mb.enLinea && !mb.destruido) Ciclo.Agregar(mb);
            }
            l.Clear();
        }

        // ScriptableObject.CreateInstance: Awake y OnEnable en el momento
        internal static void DespertarScriptable(ScriptableObject so)
        {
            if (so.despierto) return;
            so.despierto = true;
            var ts = TipoScript.De(so.GetType());
            Mensajes.Llamar(so, ts.Awake);
            Mensajes.Llamar(so, ts.OnEnable);
        }
    }

    // Las listas de Update, LateUpdate y FixedUpdate, ordenadas por orden de ejecución y, dentro
    // del mismo orden, por llegada. Los que entran mientras se recorre una lista esperan al
    // cuadro siguiente (como en Unity).
    public static class Ciclo
    {
        public sealed class Entrada
        {
            public readonly MonoBehaviour Mb;
            public readonly Action Accion;
            public bool Viva = true;
            public Entrada(MonoBehaviour mb, Action a) { Mb = mb; Accion = a; }
        }

        public sealed class Lista
        {
            readonly SortedList<int, List<Entrada>> porOrden = new SortedList<int, List<Entrada>>();
            List<Entrada>[] grupos = Array.Empty<List<Entrada>>();
            int muertas;
            public int Cantidad;

            public Entrada Agregar(MonoBehaviour mb, MethodInfo m, int orden)
            {
                if (!porOrden.TryGetValue(orden, out var l))
                {
                    porOrden[orden] = l = new List<Entrada>();
                    grupos = new List<Entrada>[porOrden.Count];
                    porOrden.Values.CopyTo(grupos, 0);
                }
                var e = new Entrada(mb, Delegado(mb, m));
                l.Add(e);
                Cantidad++;
                return e;
            }

            public void Quitar(Entrada e)
            {
                if (e == null || !e.Viva) return;
                e.Viva = false;
                muertas++;
                Cantidad--;
            }

            public void Correr()
            {
                var gs = grupos;
                for (int g = 0; g < gs.Length; g++)
                {
                    var l = gs[g];
                    int n = l.Count;
                    for (int i = 0; i < n; i++)
                    {
                        var e = l[i];
                        if (!e.Viva) continue;
                        try { e.Accion(); }
                        catch (Exception ex) { Debug.LogException(ex, e.Mb); }
                    }
                }
                if (muertas > 0)
                {
                    foreach (var l in gs) l.RemoveAll(x => !x.Viva);
                    muertas = 0;
                }
            }
        }

        public static readonly Lista Update = new Lista(), LateUpdate = new Lista(), FixedUpdate = new Lista();

        static Action Delegado(MonoBehaviour mb, MethodInfo m)
        {
            if (m.ReturnType == typeof(void) && m.GetParameters().Length == 0)
            {
                try
                {
                    var d = Delegate.CreateDelegate(typeof(Action), mb, m, false);
                    if (d != null) return (Action)d;
                }
                catch { }
            }
            return () => m.Invoke(mb, null);
        }

        internal static void Agregar(MonoBehaviour mb)
        {
            var ts = mb.tipoScript;
            if (ts.Update != null && mb.eUpdate == null) mb.eUpdate = Update.Agregar(mb, ts.Update, ts.Orden);
            if (ts.LateUpdate != null && mb.eLate == null) mb.eLate = LateUpdate.Agregar(mb, ts.LateUpdate, ts.Orden);
            if (ts.FixedUpdate != null && mb.eFijo == null) mb.eFijo = FixedUpdate.Agregar(mb, ts.FixedUpdate, ts.Orden);
        }

        internal static void Quitar(MonoBehaviour mb)
        {
            if (mb.eUpdate != null) { Update.Quitar(mb.eUpdate); mb.eUpdate = null; }
            if (mb.eLate != null) { LateUpdate.Quitar(mb.eLate); mb.eLate = null; }
            if (mb.eFijo != null) { FixedUpdate.Quitar(mb.eFijo); mb.eFijo = null; }
        }
    }

    // AddComponent
    public static class Componentes
    {
        public static Component Agregar(GameObject go, Type t)
        {
            if ((object)go == null || go.destruido) return null;
            if (t == null || !typeof(Component).IsAssignableFrom(t))
            {
                Debug.LogError($"AddComponent asking for invalid type {t?.FullName}");
                return null;
            }
            if (t.IsAbstract || t.IsInterface)
            {
                Debug.LogError($"Cannot add component of type '{t.Name}' because it is abstract. Add component of type that is derived from '{t.Name}' instead.");
                return null;
            }
            if (t == typeof(Transform)) return null;
            if (t == typeof(RectTransform))
            {
                if (go.trans is RectTransform) return null;
                return ConvertirARect(go);
            }
            if (Unico(t) && go.GetComponent(t) != null)
            {
                Debug.LogError($"Adding component failed. The component {t.Name} can't be added because {go.name} already contains the same component.");
                return null;
            }
            foreach (var req in Requeridos(t))
                if (req != null && go.GetComponent(req) == null) Agregar(go, req);

            Component c;
            try { c = (Component)Instancias.Crear(t); }
            catch (TargetInvocationException e) { Debug.LogException(e.InnerException ?? e); return null; }
            c.go = go;
            go.componentes.Add(c);
            Activacion.ComponenteNuevo(c);
            return c;
        }

        static readonly Dictionary<Type, Type[]> requeridos = new Dictionary<Type, Type[]>();

        // [RequireComponent] de la clase y sus bases (leído de los datos del atributo, sin construirlo)
        internal static Type[] Requeridos(Type t)
        {
            if (requeridos.TryGetValue(t, out var r)) return r;
            var l = new List<Type>();
            for (var b = t; b != null && b != typeof(Component); b = b.BaseType)
                foreach (var a in b.GetCustomAttributesData())
                    if (a.AttributeType == typeof(RequireComponent))
                        foreach (var arg in a.ConstructorArguments)
                            if (arg.Value is Type x && !l.Contains(x)) l.Add(x);
            requeridos[t] = r = l.ToArray();
            return r;
        }

        static readonly Dictionary<Type, bool> unicos = new Dictionary<Type, bool>();

        static bool Unico(Type t)
        {
            if (unicos.TryGetValue(t, out bool u)) return u;
            u = false;
            for (var b = t; b != null && !u; b = b.BaseType)
                foreach (var a in b.GetCustomAttributesData())
                    if (a.AttributeType == typeof(DisallowMultipleComponent)) { u = true; break; }
            return unicos[t] = u;
        }

        // AddComponent<RectTransform>() sobre un objeto con Transform: Unity lo reemplaza
        static RectTransform ConvertirARect(GameObject go)
        {
            var viejo = go.trans;
            var rt = new RectTransform();
            rt.posLocal = viejo.posLocal; rt.rotLocal = viejo.rotLocal; rt.escLocal = viejo.escLocal;
            rt.padre = viejo.padre;
            rt.hijos.AddRange(viejo.hijos);
            foreach (var h in rt.hijos) h.padre = rt;
            if (viejo.padre != null)
            {
                int i = viejo.padre.hijos.IndexOf(viejo);
                viejo.padre.hijos[i] = rt;
            }
            else if (go.escena != null)
            {
                int i = go.escena.raices.IndexOf(viejo);
                if (i >= 0) go.escena.raices[i] = rt;
            }
            rt.go = go;
            go.componentes[go.componentes.IndexOf(viejo)] = rt;
            go.trans = rt;
            viejo.destruido = true;
            Registro.Baja(viejo);
            rt.Ensuciar();
            return rt;
        }
    }
}

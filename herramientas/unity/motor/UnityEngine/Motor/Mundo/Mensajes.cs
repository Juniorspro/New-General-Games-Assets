using System;
using System.Collections;
using System.Collections.Generic;
using System.Reflection;
using UnityEngine;

namespace Porteo
{
    // Lo que el motor necesita saber de cada clase de script: qué mensajes de Unity implementa
    // (Unity los busca por nombre, de cualquier visibilidad, subiendo por la herencia) y su
    // orden de ejecución (el del MonoScript).
    public sealed class TipoScript
    {
        public readonly Type Tipo;
        public int Orden;
        public readonly MethodInfo Awake, Start, Update, LateUpdate, FixedUpdate, OnEnable, OnDisable, OnDestroy;
        public readonly bool StartEsCorrutina;
        readonly Dictionary<string, MethodInfo[]> porNombre = new Dictionary<string, MethodInfo[]>();

        const BindingFlags TODOS = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

        public TipoScript(Type t)
        {
            Tipo = t;
            Awake = Buscar("Awake"); Start = Buscar("Start"); Update = Buscar("Update"); LateUpdate = Buscar("LateUpdate");
            FixedUpdate = Buscar("FixedUpdate"); OnEnable = Buscar("OnEnable"); OnDisable = Buscar("OnDisable"); OnDestroy = Buscar("OnDestroy");
            StartEsCorrutina = Start != null && typeof(IEnumerator).IsAssignableFrom(Start.ReturnType);
            Orden = Activacion.OrdenDe(t);
        }

        // un mensaje sin parámetros (o el primero que haya con ese nombre)
        public MethodInfo Buscar(string nombre)
        {
            var ms = Metodos(nombre);
            foreach (var m in ms) if (m.GetParameters().Length == 0) return m;
            return null;
        }

        public MethodInfo[] Metodos(string nombre)
        {
            if (porNombre.TryGetValue(nombre, out var r)) return r;
            var l = new List<MethodInfo>();
            for (var t = Tipo; t != null && t != typeof(MonoBehaviour) && t != typeof(Behaviour) && t != typeof(object); t = t.BaseType)
            {
                foreach (var m in t.GetMethods(TODOS | BindingFlags.DeclaredOnly))
                {
                    if (m.Name != nombre || m.IsGenericMethodDefinition) continue;
                    // el de la clase más derivada tapa al de la base con la misma firma
                    bool tapado = false;
                    foreach (var x in l) if (MismaFirma(x, m)) { tapado = true; break; }
                    if (!tapado) l.Add(m);
                }
            }
            porNombre[nombre] = r = l.ToArray();
            return r;
        }

        static bool MismaFirma(MethodInfo a, MethodInfo b)
        {
            var pa = a.GetParameters(); var pb = b.GetParameters();
            if (pa.Length != pb.Length) return false;
            for (int i = 0; i < pa.Length; i++) if (pa[i].ParameterType != pb[i].ParameterType) return false;
            return true;
        }

        static readonly Dictionary<Type, TipoScript> cache = new Dictionary<Type, TipoScript>();
        public static TipoScript De(Type t)
        {
            if (!cache.TryGetValue(t, out var r)) cache[t] = r = new TipoScript(t);
            return r;
        }
    }

    public static class Tipos
    {
        static readonly Dictionary<string, Type> cache = new Dictionary<string, Type>();
        static readonly string[] ENSAMBLADOS = { "Assembly-CSharp", "UnityEngine.UI", "Assembly-UnityScript", "Logger", "Assembly-CSharp-firstpass", "UnityEngine.CoreModule" };

        public static Type Script(string ensamblado, string ns, string clase)
        {
            string nombre = string.IsNullOrEmpty(ns) ? clase : ns + "." + clase;
            string clave = ensamblado + ":" + nombre;
            if (cache.TryGetValue(clave, out var t)) return t;
            t = Type.GetType(nombre + ", " + ensamblado, false) ?? Buscar(nombre);
            cache[clave] = t;
            return t;
        }

        public static Type Buscar(string nombre)
        {
            if (cache.TryGetValue(nombre, out var t)) return t;
            foreach (var e in ENSAMBLADOS)
            {
                try { t = Type.GetType(nombre + ", " + e, false); } catch { t = null; }
                if (t != null) break;
            }
            if (t == null)
                foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                {
                    t = asm.GetType(nombre, false);
                    if (t != null) break;
                }
            cache[nombre] = t;
            return t;
        }
    }

    public static class Mensajes
    {
        // Llama a un mensaje sin parámetros; las excepciones del juego se informan y el motor sigue
        // (como Unity, que las muestra en la consola y continúa con el siguiente script).
        public static object Llamar(object destino, MethodInfo m, object[] args = null)
        {
            if (m == null) return null;
            try
            {
                return m.Invoke(destino, args);
            }
            catch (TargetInvocationException e)
            {
                Debug.LogException(e.InnerException ?? e, destino as UnityEngine.Object);
                return null;
            }
            catch (Exception e)
            {
                Debug.LogException(e, destino as UnityEngine.Object);
                return null;
            }
        }

        public static void Accion(Action a, UnityEngine.Object contexto)
        {
            try { a(); }
            catch (Exception e) { Debug.LogException(e, contexto); }
        }

        // SendMessage: a todos los MonoBehaviour del objeto (también los deshabilitados), si el
        // objeto está activo. Con valor, un método de un parámetro compatible o uno sin parámetros.
        public static void Enviar(GameObject go, string metodo, object valor, bool conValor, SendMessageOptions opciones)
        {
            if (go == null || go.destruido) return;
            bool recibido = false;
            if (go.activoEnJerarquia)
            {
                var cs = go.componentes.ToArray();
                foreach (var c in cs)
                {
                    if (!(c is MonoBehaviour mb) || mb.destruido) continue;
                    var ts = mb.tipoScript ?? TipoScript.De(mb.GetType());
                    foreach (var m in ts.Metodos(metodo))
                    {
                        var ps = m.GetParameters();
                        if (ps.Length == 0)
                        {
                            Llamar(mb, m); recibido = true; break;
                        }
                        if (ps.Length == 1 && (!conValor && !ps[0].ParameterType.IsValueType || conValor && (valor == null ? !ps[0].ParameterType.IsValueType : ps[0].ParameterType.IsInstanceOfType(valor))))
                        {
                            Llamar(mb, m, new[] { valor }); recibido = true; break;
                        }
                    }
                }
            }
            if (!recibido && opciones == SendMessageOptions.RequireReceiver)
                Debug.LogError($"SendMessage {metodo} has no receiver!", go);
        }

        public static IEnumerator LlamarCorrutina(MonoBehaviour mb, string metodo, object valor)
        {
            var ts = mb.tipoScript ?? TipoScript.De(mb.GetType());
            foreach (var m in ts.Metodos(metodo))
            {
                var ps = m.GetParameters();
                if (!typeof(IEnumerator).IsAssignableFrom(m.ReturnType)) continue;
                if (ps.Length == 0) return (IEnumerator)Llamar(mb, m);
                if (ps.Length == 1) return (IEnumerator)Llamar(mb, m, new[] { valor });
            }
            return null;
        }
    }
}

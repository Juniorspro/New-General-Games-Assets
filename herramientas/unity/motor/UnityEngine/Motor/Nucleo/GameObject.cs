using System;
using System.Collections.Generic;
using Porteo;

namespace UnityEngine
{
    public sealed partial class GameObject : Object
    {
        internal readonly List<Component> componentes = new List<Component>(4);
        internal Transform trans;
        internal int capa;
        internal string etiqueta = "Untagged";
        internal bool activoPropio = true;
        internal bool activoEnJerarquia;   // lo mantiene el motor al activar, desactivar y cambiar de padre
        internal bool estatico;
        internal Escena escena;            // null: asset (un prefab) o todavía sin escena

        // lo crea el cargador sin Transform (se lo agrega al leer sus componentes)
        internal GameObject(bool sinTransform) { }

        public GameObject() : this("New Game Object") { }

        public GameObject(string name)
        {
            m_Name = name ?? "";
            AgregarTransform(new Transform());
            escena = Escenas.Activa;
            Escenas.AgregarRaiz(trans);
            ActivacionInicial();
        }

        public GameObject(string name, params Type[] components) : this(name)
        {
            foreach (var t in components) AddComponent(t);
        }

        internal void AgregarTransform(Transform t)
        {
            trans = t;
            t.go = this;
            componentes.Insert(0, t);
        }

        // un objeto nuevo en la escena: activo si su padre (ninguno) lo es
        internal void ActivacionInicial()
        {
            activoEnJerarquia = activoPropio && escena != null && (trans.padre == null || trans.padre.go.activoEnJerarquia);
        }

        public Transform transform => trans;
        public GameObject gameObject => this;

        public int layer
        {
            get => capa;
            set
            {
                if (value < 0 || value > 31) { Debug.LogError("A game object can only be in one layer. The layer needs to be in the range [0...31]"); return; }
                if (capa == value) return;
                capa = value;
                // sus colisionadores cambian de filtro
                Porteo.Fisica.Simulacion.CapaCambiada(this);
            }
        }

        public bool activeSelf => activoPropio;
        public bool activeInHierarchy => activoEnJerarquia;
        public bool isStatic { get => estatico; set => estatico = value; }

        public string tag
        {
            get => etiqueta;
            set => etiqueta = value ?? "Untagged";
        }

        public bool CompareTag(string tag) => etiqueta == tag;

        public UnityEngine.SceneManagement.Scene scene => new UnityEngine.SceneManagement.Scene { m_Handle = escena?.Id ?? 0 };

        public void SetActive(bool value)
        {
            if (activoPropio == value) return;
            activoPropio = value;
            Activacion.Recalcular(this);
        }

        public static GameObject CreatePrimitive(PrimitiveType type)
        {
            var go = new GameObject(type.ToString());
            Primitivas.Armar(go, type);
            return go;
        }

        // ── componentes ──
        public Component AddComponent(Type componentType) => Componentes.Agregar(this, componentType);
        public T AddComponent<T>() where T : Component => (T)Componentes.Agregar(this, typeof(T));

        public Component GetComponent(Type type)
        {
            var c = componentes;
            for (int i = 0; i < c.Count; i++)
                if (type.IsInstanceOfType(c[i]) && !c[i].destruido) return c[i];
            return null;
        }

        public T GetComponent<T>()
        {
            var c = componentes;
            for (int i = 0; i < c.Count; i++)
                if (c[i] is T t && !c[i].destruido) return t;
            return default;
        }

        public Component GetComponent(string type)
        {
            var c = componentes;
            for (int i = 0; i < c.Count; i++)
                if (c[i].GetType().Name == type && !c[i].destruido) return c[i];
            return null;
        }

        public Component[] GetComponents(Type type)
        {
            var l = new List<Component>();
            foreach (var c in componentes) if (type.IsInstanceOfType(c) && !c.destruido) l.Add(c);
            var a = (Component[])Array.CreateInstance(type, l.Count);
            for (int i = 0; i < l.Count; i++) a[i] = l[i];
            return a;
        }

        public void GetComponents(Type type, List<Component> results)
        {
            results.Clear();
            foreach (var c in componentes) if (type.IsInstanceOfType(c) && !c.destruido) results.Add(c);
        }

        public T[] GetComponents<T>()
        {
            var l = new List<T>();
            foreach (var c in componentes) if (c is T t && !c.destruido) l.Add(t);
            return l.ToArray();
        }

        public void GetComponents<T>(List<T> results)
        {
            results.Clear();
            foreach (var c in componentes) if (c is T t && !c.destruido) results.Add(t);
        }

        public T GetComponentInChildren<T>() => GetComponentInChildren<T>(false);

        public T GetComponentInChildren<T>(bool includeInactive)
        {
            if (!includeInactive && !activoEnJerarquia) return default;
            var r = GetComponent<T>();
            if (r != null) return r;
            foreach (var h in trans.hijos)
            {
                r = h.go.GetComponentInChildren<T>(includeInactive);
                if (r != null) return r;
            }
            return default;
        }

        public Component GetComponentInChildren(Type type) => GetComponentInChildren(type, false);

        public Component GetComponentInChildren(Type type, bool includeInactive)
        {
            if (!includeInactive && !activoEnJerarquia) return null;
            var r = GetComponent(type);
            if (r != null) return r;
            foreach (var h in trans.hijos)
            {
                r = h.go.GetComponentInChildren(type, includeInactive);
                if (r != null) return r;
            }
            return null;
        }

        public T GetComponentInParent<T>()
        {
            for (var t = trans; t != null; t = t.padre)
            {
                if (!t.go.activoEnJerarquia) continue;
                var r = t.go.GetComponent<T>();
                if (r != null) return r;
            }
            return default;
        }

        public Component GetComponentInParent(Type type)
        {
            for (var t = trans; t != null; t = t.padre)
            {
                if (!t.go.activoEnJerarquia) continue;
                var r = t.go.GetComponent(type);
                if (r != null) return r;
            }
            return null;
        }

        public T[] GetComponentsInChildren<T>() => GetComponentsInChildren<T>(false);

        public T[] GetComponentsInChildren<T>(bool includeInactive)
        {
            var l = new List<T>();
            GetComponentsInChildren(includeInactive, l);
            return l.ToArray();
        }

        public void GetComponentsInChildren<T>(List<T> results) => GetComponentsInChildren(false, results);

        public void GetComponentsInChildren<T>(bool includeInactive, List<T> results)
        {
            results.Clear();
            Juntar(this, includeInactive, results);
        }

        static void Juntar<T>(GameObject go, bool inactivos, List<T> l)
        {
            if (!inactivos && !go.activoEnJerarquia) return;
            foreach (var c in go.componentes) if (c is T t && !c.destruido) l.Add(t);
            foreach (var h in go.trans.hijos) Juntar(h.go, inactivos, l);
        }

        public Component[] GetComponentsInChildren(Type type, bool includeInactive)
        {
            var l = new List<Component>();
            JuntarTipo(this, type, includeInactive, l);
            var a = (Component[])Array.CreateInstance(type, l.Count);
            for (int i = 0; i < l.Count; i++) a[i] = l[i];
            return a;
        }

        static void JuntarTipo(GameObject go, Type type, bool inactivos, List<Component> l)
        {
            if (!inactivos && !go.activoEnJerarquia) return;
            foreach (var c in go.componentes) if (type.IsInstanceOfType(c) && !c.destruido) l.Add(c);
            foreach (var h in go.trans.hijos) JuntarTipo(h.go, type, inactivos, l);
        }

        public T[] GetComponentsInParent<T>() => GetComponentsInParent<T>(false);

        public T[] GetComponentsInParent<T>(bool includeInactive)
        {
            var l = new List<T>();
            GetComponentsInParent(includeInactive, l);
            return l.ToArray();
        }

        public void GetComponentsInParent<T>(bool includeInactive, List<T> results)
        {
            results.Clear();
            for (var t = trans; t != null; t = t.padre)
            {
                if (!includeInactive && !t.go.activoEnJerarquia) continue;
                foreach (var c in t.go.componentes) if (c is T x && !c.destruido) results.Add(x);
            }
        }

        // ── mensajes ──
        public void SendMessage(string methodName) => Mensajes.Enviar(this, methodName, null, false, SendMessageOptions.RequireReceiver);
        public void SendMessage(string methodName, object value) => Mensajes.Enviar(this, methodName, value, true, SendMessageOptions.RequireReceiver);
        public void SendMessage(string methodName, SendMessageOptions options) => Mensajes.Enviar(this, methodName, null, false, options);
        public void SendMessage(string methodName, object value, SendMessageOptions options) => Mensajes.Enviar(this, methodName, value, true, options);

        public void SendMessageUpwards(string methodName, SendMessageOptions options)
        {
            for (var t = trans; t != null; t = t.padre) Mensajes.Enviar(t.go, methodName, null, false, SendMessageOptions.DontRequireReceiver);
        }

        public void BroadcastMessage(string methodName, object parameter, SendMessageOptions options) => Difundir(this, methodName, parameter, true, options);
        public void BroadcastMessage(string methodName, SendMessageOptions options) => Difundir(this, methodName, null, false, options);
        public void BroadcastMessage(string methodName) => Difundir(this, methodName, null, false, SendMessageOptions.RequireReceiver);

        static void Difundir(GameObject go, string m, object v, bool conValor, SendMessageOptions o)
        {
            if (!go.activoEnJerarquia) return;
            Mensajes.Enviar(go, m, v, conValor, SendMessageOptions.DontRequireReceiver);
            foreach (var h in go.trans.hijos.ToArray()) Difundir(h.go, m, v, conValor, o);
        }

        // ── buscar ──
        public static GameObject Find(string name)
        {
            if (string.IsNullOrEmpty(name)) return null;
            // "a/b/c": una ruta desde una raíz
            if (name.IndexOf('/') >= 0)
            {
                var partes = name.TrimStart('/').Split('/');
                foreach (var raiz in Escenas.Raices())
                {
                    if (!raiz.go.activoEnJerarquia || raiz.go.name != partes[0]) continue;
                    var t = partes.Length == 1 ? raiz : raiz.Find(string.Join("/", partes, 1, partes.Length - 1));
                    if (t != null && t.go.activoEnJerarquia) return t.go;
                }
                return null;
            }
            foreach (var go in Registro.ObjetosDeJuego())
                if (go.activoEnJerarquia && go.m_Name == name) return go;
            return null;
        }

        public static GameObject FindWithTag(string tag) => FindGameObjectWithTag(tag);

        public static GameObject FindGameObjectWithTag(string tag)
        {
            foreach (var go in Registro.ObjetosDeJuego())
                if (go.activoEnJerarquia && go.etiqueta == tag) return go;
            return null;
        }

        public static GameObject[] FindGameObjectsWithTag(string tag)
        {
            var l = new List<GameObject>();
            foreach (var go in Registro.ObjetosDeJuego())
                if (go.activoEnJerarquia && go.etiqueta == tag) l.Add(go);
            return l.ToArray();
        }
    }
}

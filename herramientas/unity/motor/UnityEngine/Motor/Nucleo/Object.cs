using System;
using System.Collections.Generic;
using Porteo;

namespace UnityEngine
{
    // Como en Unity, un objeto destruido sigue existiendo para C# pero compara igual a null
    // (el "null falso"): ==, != y el bool implícito miran si está vivo.
    public partial class Object
    {
        internal int instanceID;
        internal string m_Name = "";
        internal bool destruido;
        // Destroy(x) sin demora: se destruye al final del cuadro, pero desde ya no arranca (como en
        // Unity, lo destruido en su Awake no recibe Start: el GameContext repetido del mundo se
        // destruye en Awake y su Start, que espera lo que crea Awake, tiraba NullReference)
        internal bool porDestruirse;
        internal HideFlags banderas;
        // de dónde salió (lo cargado de un archivo del juego; null en lo creado en tiempo de juego)
        internal Porteo.Datos.Archivo archivo;
        internal long pathID;
        // los datos tal como vinieron, para los nativos que todavía no los interpretan del todo
        internal Porteo.Datos.Mapa crudo;

        public Object()
        {
            instanceID = Registro.Alta(this);
        }

        // ── lo que cada tipo nativo implementa ──
        internal virtual void LeerNativo(Porteo.Datos.Mapa m, Porteo.Datos.IResolutor r) { crudo = m; }
        // Instantiate: copiar los datos del original (las referencias pasan por remap)
        internal virtual void CopiarDe(Object original, Func<Object, Object> remap) { crudo = original.crudo; }
        // Instantiate de un asset (Material, Mesh...): null si el tipo no se puede clonar
        internal virtual Object ClonarAsset() => null;
        // destruido: soltar lo que tenga del lado del navegador (texturas, buffers, sonidos)
        internal virtual void AlLiberar() { }

        public string name
        {
            get => NombreObjeto();
            set => CambiarNombre(value);
        }

        internal virtual string NombreObjeto() => m_Name;
        internal virtual void CambiarNombre(string v) => m_Name = v ?? "";

        public HideFlags hideFlags { get => banderas; set => banderas = value; }

        public int GetInstanceID() => instanceID;

        public override int GetHashCode() => instanceID;

        public override bool Equals(object other)
        {
            var o = other as Object;
            if (o == null && other != null && !(other is Object)) return false;
            return CompareBaseObjects(this, o);
        }

        static bool CompareBaseObjects(Object lhs, Object rhs)
        {
            bool lhsNull = (object)lhs == null, rhsNull = (object)rhs == null;
            if (rhsNull && lhsNull) return true;
            if (rhsNull) return lhs.destruido;
            if (lhsNull) return rhs.destruido;
            return ReferenceEquals(lhs, rhs);
        }

        public static implicit operator bool(Object exists) => !CompareBaseObjects(exists, null);
        public static bool operator ==(Object x, Object y) => CompareBaseObjects(x, y);
        public static bool operator !=(Object x, Object y) => !CompareBaseObjects(x, y);

        public override string ToString() => (destruido ? "null" : name) + " (" + GetType().FullName + ")";

        // ── crear y destruir ──
        public static Object Instantiate(Object original) => Clonador.Instanciar(original, null, false, null);
        public static Object Instantiate(Object original, Transform parent) => Clonador.Instanciar(original, parent, false, null);
        public static Object Instantiate(Object original, Transform parent, bool instantiateInWorldSpace) => Clonador.Instanciar(original, parent, instantiateInWorldSpace, null);
        public static Object Instantiate(Object original, Vector3 position, Quaternion rotation) => Clonador.Instanciar(original, null, true, (position, rotation));
        public static Object Instantiate(Object original, Vector3 position, Quaternion rotation, Transform parent) => Clonador.Instanciar(original, parent, true, (position, rotation));

        public static T Instantiate<T>(T original) where T : Object => (T)Clonador.Instanciar(original, null, false, null);
        public static T Instantiate<T>(T original, Transform parent) where T : Object => (T)Clonador.Instanciar(original, parent, false, null);
        public static T Instantiate<T>(T original, Transform parent, bool worldPositionStays) where T : Object => (T)Clonador.Instanciar(original, parent, worldPositionStays, null);
        public static T Instantiate<T>(T original, Vector3 position, Quaternion rotation) where T : Object => (T)Clonador.Instanciar(original, null, true, (position, rotation));
        public static T Instantiate<T>(T original, Vector3 position, Quaternion rotation, Transform parent) where T : Object => (T)Clonador.Instanciar(original, parent, true, (position, rotation));

        public static void Destroy(Object obj) => Destroy(obj, 0f);

        public static void Destroy(Object obj, float t)
        {
            if ((object)obj == null || obj.destruido) return;
            Mundo.DestruirLuego(obj, t);
        }

        public static void DestroyImmediate(Object obj) => DestroyImmediate(obj, false);

        public static void DestroyImmediate(Object obj, bool allowDestroyingAssets)
        {
            if ((object)obj == null || obj.destruido) return;
            Mundo.DestruirYa(obj);
        }

        public static void DontDestroyOnLoad(Object target)
        {
            if ((object)target == null) return;
            GameObject go = target as GameObject ?? (target as Component)?.gameObject;
            if (go != null) Escenas.NoDestruirAlCargar(go);
        }

        // ── buscar ──
        public static Object FindObjectOfType(Type type)
        {
            foreach (var o in Registro.Vivos(type, true)) return o;
            return null;
        }

        public static Object[] FindObjectsOfType(Type type)
        {
            var l = new List<Object>();
            foreach (var o in Registro.Vivos(type, true)) l.Add(o);
            var a = (Object[])Array.CreateInstance(type, l.Count);
            for (int i = 0; i < l.Count; i++) a[i] = l[i];
            return a;
        }

        public static T FindObjectOfType<T>() where T : Object => (T)FindObjectOfType(typeof(T));

        public static T[] FindObjectsOfType<T>() where T : Object
        {
            var l = new List<T>();
            foreach (var o in Registro.Vivos(typeof(T), true)) l.Add((T)o);
            return l.ToArray();
        }
    }
}

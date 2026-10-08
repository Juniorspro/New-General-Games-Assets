using System;
using System.Collections.Generic;

namespace UnityEngine
{
    // PropertyName: un nombre convertido en número (comparar es comparar enteros). Unity usa un hash
    // del texto; acá una tabla: el mismo texto da siempre el mismo id en la misma sesión, que es lo
    // que importa (no se guarda en ningún lado).
    public struct PropertyName : IEquatable<PropertyName>
    {
        internal int id;
        static readonly Dictionary<string, int> ids = new Dictionary<string, int>();
        static readonly List<string> nombres = new List<string> { "" };

        public PropertyName(string name)
        {
            name ??= "";
            lock (ids)
            {
                if (name.Length == 0) id = 0;
                else if (!ids.TryGetValue(name, out id)) { id = nombres.Count; nombres.Add(name); ids[name] = id; }
            }
        }

        public PropertyName(PropertyName other) { id = other.id; }
        public PropertyName(int id) { this.id = id; }

        public static bool IsNullOrEmpty(PropertyName prop) => prop.id == 0;
        public bool Equals(PropertyName other) => id == other.id;
        public override bool Equals(object other) => other is PropertyName p && Equals(p);
        public override int GetHashCode() => id;
        public static bool operator ==(PropertyName lhs, PropertyName rhs) => lhs.id == rhs.id;
        public static bool operator !=(PropertyName lhs, PropertyName rhs) => lhs.id != rhs.id;
        public static implicit operator PropertyName(string name) => new PropertyName(name);
        public static implicit operator PropertyName(int id) => new PropertyName(id);
        public override string ToString()
        {
            lock (ids) return id >= 0 && id < nombres.Count ? nombres[id] : $"Unknown:{id}";
        }
    }

    // una referencia a un objeto de la escena guardada en un asset (Timeline: ControlTrack, etc.):
    // se resuelve con la tabla del director
    [Serializable]
    public struct ExposedReference<T> where T : Object
    {
        [SerializeField] public PropertyName exposedName;
        [SerializeField] public Object defaultValue;

        public T Resolve(IExposedPropertyTable resolver)
        {
            if (resolver != null)
            {
                var o = resolver.GetReferenceValue(exposedName, out bool valido);
                if (valido) return o as T;
            }
            return defaultValue as T;
        }
    }
}

namespace UnityEngine
{
    // la tabla de referencias de un director (lo que resuelve una ExposedReference)
    public interface IExposedPropertyTable
    {
        void SetReferenceValue(PropertyName id, Object value);
        Object GetReferenceValue(PropertyName id, out bool idValid);
        void ClearReferenceValue(PropertyName id);
    }
}

namespace UnityEngine
{
    // la máscara de capas de Timeline (SetLayerMaskFromAvatarMask): el motor no la usa; el resto de
    // sus miembros los pone el esqueleto de cada perfil
    public sealed partial class AvatarMask : Object { }
}

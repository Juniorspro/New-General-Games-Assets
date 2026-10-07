using System;
using System.Collections.Generic;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Porteo
{
    // Todos los objetos de Unity vivos: por ID (GetInstanceID) y por tipo exacto (para
    // FindObjectsOfType sin recorrer cientos de miles de objetos).
    public static class Registro
    {
        static int siguiente = 1;
        static readonly Dictionary<int, Object> porID = new Dictionary<int, Object>(1 << 16);
        static readonly Dictionary<Type, List<Object>> porTipo = new Dictionary<Type, List<Object>>();
        static readonly Dictionary<Type, Type[]> asignables = new Dictionary<Type, Type[]>();
        static readonly Dictionary<Object, int> indice = new Dictionary<Object, int>(1 << 16, ReferenceEqualityComparer.Instance);
        static readonly List<GameObject> objetosDeJuego = new List<GameObject>(1 << 14);
        static readonly Dictionary<GameObject, int> indiceGO = new Dictionary<GameObject, int>(1 << 14, ReferenceEqualityComparer.Instance);

        public static int Alta(Object o)
        {
            int id = siguiente++;
            porID[id] = o;
            var t = o.GetType();
            if (!porTipo.TryGetValue(t, out var l))
            {
                porTipo[t] = l = new List<Object>();
                asignables.Clear();   // apareció un tipo nuevo: las listas de asignables se rehacen
            }
            indice[o] = l.Count;
            l.Add(o);
            if (o is GameObject go)
            {
                indiceGO[go] = objetosDeJuego.Count;
                objetosDeJuego.Add(go);
            }
            return id;
        }

        public static void Baja(Object o)
        {
            porID.Remove(o.instanceID);
            if (indice.TryGetValue(o, out int i) && porTipo.TryGetValue(o.GetType(), out var l))
            {
                int ult = l.Count - 1;
                if (i != ult) { l[i] = l[ult]; indice[l[i]] = i; }
                l.RemoveAt(ult);
                indice.Remove(o);
            }
            if (o is GameObject go && indiceGO.TryGetValue(go, out int j))
            {
                int ult = objetosDeJuego.Count - 1;
                if (j != ult) { objetosDeJuego[j] = objetosDeJuego[ult]; indiceGO[objetosDeJuego[j]] = j; }
                objetosDeJuego.RemoveAt(ult);
                indiceGO.Remove(go);
            }
        }

        public static Object PorID(int id) => porID.TryGetValue(id, out var o) ? o : null;

        static Type[] Asignables(Type t)
        {
            if (!asignables.TryGetValue(t, out var r))
            {
                var l = new List<Type>();
                foreach (var k in porTipo.Keys) if (t.IsAssignableFrom(k)) l.Add(k);
                asignables[t] = r = l.ToArray();
            }
            return r;
        }

        // Los vivos de un tipo; con soloEscena, sin assets ni objetos de GameObjects inactivos
        // (lo que devuelve FindObjectsOfType).
        public static IEnumerable<Object> Vivos(Type t, bool soloEscena)
        {
            foreach (var k in Asignables(t))
            {
                var l = porTipo[k];
                for (int i = 0; i < l.Count; i++)
                {
                    var o = l[i];
                    if (o.destruido) continue;
                    if (soloEscena)
                    {
                        if (o is GameObject g) { if (!g.activoEnJerarquia) continue; }
                        else if (o is Component c) { if (c.go == null || !c.go.activoEnJerarquia) continue; }
                        else if (o.archivo != null) continue;   // un asset
                    }
                    yield return o;
                }
            }
        }

        public static IEnumerable<Object> Todos(Type t)
        {
            foreach (var k in Asignables(t))
            {
                var l = porTipo[k];
                for (int i = 0; i < l.Count; i++) if (!l[i].destruido) yield return l[i];
            }
        }

        // los GameObject que están en alguna escena
        public static IEnumerable<GameObject> ObjetosDeJuego()
        {
            for (int i = 0; i < objetosDeJuego.Count; i++)
            {
                var go = objetosDeJuego[i];
                if (!go.destruido && go.escena != null) yield return go;
            }
        }

        public static int Cantidad => porID.Count;
    }
}

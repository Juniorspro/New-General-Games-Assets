using System;
using System.Reflection;
using System.Runtime.CompilerServices;

namespace Porteo
{
    // Cómo crea Unity los objetos de los scripts: con el constructor sin parámetros si existe
    // (aunque sea privado) y, si no hay ninguno (iTween sólo tiene uno con un Hashtable), sin
    // llamar a ningún constructor.
    internal static class Instancias
    {
        internal static object Crear(Type t)
        {
            if (t.IsValueType) return Activator.CreateInstance(t);
            if (t.GetConstructor(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic, null, Type.EmptyTypes, null) == null && !t.IsAbstract)
                return RuntimeHelpers.GetUninitializedObject(t);
            return Activator.CreateInstance(t, true);
        }
    }
}

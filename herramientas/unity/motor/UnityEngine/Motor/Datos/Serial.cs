using System;
using System.Collections;
using System.Collections.Generic;
using System.Reflection;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Porteo.Datos
{
    // De dónde salen los objetos a los que apuntan los PPtr y los recursos grandes.
    public interface IResolutor
    {
        Object Resolver(PPtr p);
        byte[] Recurso(int id);
    }

    public enum Clase : byte
    {
        Bool, Entero, Real, Enum, Cadena, Objeto,
        Vector2, Vector3, Vector4, Quaternion, Color, Color32, Rect, Bounds, Matrix, Capas,
        Vector2Int, Vector3Int, RectInt, BoundsInt,
        Curva, Degradado, Margen,
        Compuesto, Arreglo, Lista, Ninguna,
    }

    public sealed class CampoSerial
    {
        public readonly FieldInfo F;
        public readonly string Nombre;
        public readonly Type Tipo;
        public readonly Clase C;
        public readonly Type Elemento;
        public readonly Clase CElemento;

        public CampoSerial(FieldInfo f, Clase c, Type elemento, Clase ce)
        {
            F = f; Nombre = string.Intern(f.Name); Tipo = f.FieldType; C = c; Elemento = elemento; CElemento = ce;
        }
    }

    // Los campos que Unity serializa de una clase (públicos o [SerializeField], de tipos que sabe
    // guardar), de la base hacia la derivada como en el typetree.
    public sealed class TipoSerial
    {
        public readonly Type Tipo;
        public readonly CampoSerial[] Campos;
        public readonly bool Receptor;   // ISerializationCallbackReceiver

        static readonly Dictionary<Type, TipoSerial> cache = new Dictionary<Type, TipoSerial>();

        TipoSerial(Type t)
        {
            Tipo = t;
            Receptor = typeof(ISerializationCallbackReceiver).IsAssignableFrom(t);
            var cadena = new List<Type>();
            for (var b = t; b != null && !Tope(b); b = b.BaseType) cadena.Add(b);
            cadena.Reverse();
            var l = new List<CampoSerial>();
            foreach (var b in cadena)
                foreach (var f in b.GetFields(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly))
                {
                    if (f.IsInitOnly || f.IsLiteral || f.IsNotSerialized) continue;
                    if (!f.IsPublic && !f.IsDefined(typeof(SerializeField), false)) continue;
                    var c = Serial.ClaseDe(f.FieldType, out var el, out var ce);
                    if (c == Clase.Ninguna) continue;
                    l.Add(new CampoSerial(f, c, el, ce));
                }
            Campos = l.ToArray();
        }

        // las clases del motor no aportan campos (los nativos se leen aparte)
        static bool Tope(Type b) =>
            b == typeof(object) || b == typeof(ValueType) || b == typeof(Object) || b == typeof(Component) ||
            b == typeof(Behaviour) || b == typeof(MonoBehaviour) || b == typeof(ScriptableObject);

        public static TipoSerial De(Type t)
        {
            if (!cache.TryGetValue(t, out var r)) cache[t] = r = new TipoSerial(t);
            return r;
        }

        public CampoSerial Buscar(string nombre)
        {
            foreach (var c in Campos) if (c.Nombre == nombre) return c;
            return null;
        }
    }

    public static class Serial
    {
        const int PROFUNDIDAD = 7;   // Unity corta ahí las clases anidadas (por si hay ciclos)

        static readonly Dictionary<Type, (Clase, Type, Clase)> clases = new Dictionary<Type, (Clase, Type, Clase)>();

        public static Clase ClaseDe(Type t, out Type elemento, out Clase claseElemento)
        {
            if (clases.TryGetValue(t, out var r)) { elemento = r.Item2; claseElemento = r.Item3; return r.Item1; }
            elemento = null; claseElemento = Clase.Ninguna;
            var c = Simple(t);
            if (c == Clase.Ninguna)
            {
                if (t.IsArray && t.GetArrayRank() == 1)
                {
                    var e = t.GetElementType();
                    var ce = Simple(e);
                    if (ce != Clase.Ninguna) { c = Clase.Arreglo; elemento = e; claseElemento = ce; }
                }
                else if (t.IsGenericType && t.GetGenericTypeDefinition() == typeof(List<>))
                {
                    var e = t.GetGenericArguments()[0];
                    var ce = Simple(e);
                    if (ce != Clase.Ninguna) { c = Clase.Lista; elemento = e; claseElemento = ce; }
                }
            }
            clases[t] = (c, elemento, claseElemento);
            return c;
        }

        // un tipo que no es colección
        static Clase Simple(Type t)
        {
            if (t == typeof(bool)) return Clase.Bool;
            if (t == typeof(float) || t == typeof(double)) return Clase.Real;
            if (t.IsPrimitive) return t == typeof(IntPtr) || t == typeof(UIntPtr) ? Clase.Ninguna : Clase.Entero;
            if (t.IsEnum) return Clase.Enum;
            if (t == typeof(string)) return Clase.Cadena;
            if (typeof(Object).IsAssignableFrom(t)) return Clase.Objeto;
            if (t == typeof(Vector2)) return Clase.Vector2;
            if (t == typeof(Vector3)) return Clase.Vector3;
            if (t == typeof(Vector4)) return Clase.Vector4;
            if (t == typeof(Quaternion)) return Clase.Quaternion;
            if (t == typeof(Color)) return Clase.Color;
            if (t == typeof(Color32)) return Clase.Color32;
            if (t == typeof(Rect)) return Clase.Rect;
            if (t == typeof(Bounds)) return Clase.Bounds;
            if (t == typeof(Matrix4x4)) return Clase.Matrix;
            if (t == typeof(LayerMask)) return Clase.Capas;
            if (t == typeof(AnimationCurve)) return Clase.Curva;
            if (t == typeof(Gradient)) return Clase.Degradado;
            if (t == typeof(RectOffset)) return Clase.Margen;
            if (t.FullName == "UnityEngine.Vector2Int") return Clase.Vector2Int;
            if (t.FullName == "UnityEngine.Vector3Int") return Clase.Vector3Int;
            if (t.FullName == "UnityEngine.RectInt") return Clase.RectInt;
            if (t.FullName == "UnityEngine.BoundsInt") return Clase.BoundsInt;
            if (t.IsArray || t.IsInterface || t.IsAbstract || t.IsPointer || t.IsByRef) return Clase.Ninguna;
            if (t.IsGenericType || t.ContainsGenericParameters) return Clase.Ninguna;
            if (typeof(Delegate).IsAssignableFrom(t)) return Clase.Ninguna;
            // [Serializable] propio del juego o de Unity (no las de la biblioteca de .NET)
            if (!t.IsDefined(typeof(SerializableAttribute), false)) return Clase.Ninguna;
            var ns = t.Namespace ?? "";
            if (ns == "System" || ns.StartsWith("System.", StringComparison.Ordinal) || ns.StartsWith("Microsoft.", StringComparison.Ordinal)) return Clase.Ninguna;
            return Clase.Compuesto;
        }

        // ── leer del árbol ──
        public static void Leer(object destino, Mapa m, IResolutor r) => Leer(destino, TipoSerial.De(destino.GetType()), m, r, 0);

        static void Leer(object destino, TipoSerial ts, Mapa m, IResolutor r, int prof)
        {
            var campos = ts.Campos;
            var claves = m.Claves;
            int pista = 0;
            for (int i = 0; i < campos.Length; i++)
            {
                var c = campos[i];
                // los campos vienen en el mismo orden que el typetree: se busca desde el último hallado
                int k = -1;
                for (int j = 0; j < claves.Length; j++)
                {
                    int x = pista + j; if (x >= claves.Length) x -= claves.Length;
                    if ((object)claves[x] == (object)c.Nombre || claves[x] == c.Nombre) { k = x; break; }
                }
                if (k < 0) continue;
                pista = k + 1;
                object v;
                try { v = Valor(m.Valores[k], c.Tipo, c.C, c.Elemento, c.CElemento, r, prof); }
                catch (Exception e)
                {
                    Debug.LogWarning($"porteo: no pude leer {ts.Tipo.Name}.{c.Nombre}: {e.Message}");
                    continue;
                }
                c.F.SetValue(destino, v);
            }
            if (ts.Receptor && destino is ISerializationCallbackReceiver rc)
            {
                try { rc.OnAfterDeserialize(); } catch (Exception e) { Debug.LogException(e); }
            }
        }

        public static object Valor(object d, Type t, Clase c, Type el, Clase ce, IResolutor r, int prof)
        {
            switch (c)
            {
                case Clase.Bool: return d switch { bool b => b, long l => l != 0, _ => false };
                case Clase.Entero: return Entero(d, t);
                case Clase.Real:
                {
                    double x = d switch { float f => f, double db => db, long l => l, bool b => b ? 1 : 0, _ => 0 };
                    return t == typeof(float) ? (object)(float)x : x;
                }
                case Clase.Enum:
                {
                    long l = d switch { long x => x, bool b => b ? 1 : 0, float f => (long)f, _ => 0 };
                    return System.Enum.ToObject(t, l);
                }
                case Clase.Cadena: return d as string ?? "";
                case Clase.Objeto:
                {
                    if (!(d is PPtr p) || p.Nulo) return null;
                    var o = r.Resolver(p);
                    return o != null && t.IsInstanceOfType(o) ? o : null;
                }
                case Clase.Vector2: { var m = (Mapa)d; return new Vector2(m.F("x"), m.F("y")); }
                case Clase.Vector3: { var m = (Mapa)d; return new Vector3(m.F("x"), m.F("y"), m.F("z")); }
                case Clase.Vector4: { var m = (Mapa)d; return new Vector4(m.F("x"), m.F("y"), m.F("z"), m.F("w")); }
                case Clase.Quaternion: { var m = (Mapa)d; return new Quaternion(m.F("x"), m.F("y"), m.F("z"), m.F("w")); }
                case Clase.Color: return Color(d as Mapa);
                case Clase.Color32:
                {
                    uint u = (uint)((Mapa)d).I("rgba");
                    return new Color32((byte)u, (byte)(u >> 8), (byte)(u >> 16), (byte)(u >> 24));
                }
                case Clase.Rect: { var m = (Mapa)d; return new Rect(m.F("x"), m.F("y"), m.F("width"), m.F("height")); }
                case Clase.Bounds:
                {
                    var m = (Mapa)d;
                    var b = new Bounds { center = V3(m.M("m_Center")), extents = V3(m.M("m_Extent")) };
                    return b;
                }
                case Clase.Matrix:
                {
                    var m = (Mapa)d; var x = new Matrix4x4();
                    for (int i = 0; i < 4; i++) for (int j = 0; j < 4; j++) x[i, j] = m.F("e" + i + j);
                    return x;
                }
                case Clase.Capas: return (LayerMask)(int)(uint)((Mapa)d).I("m_Bits");
                case Clase.Curva: return Curva(d as Mapa);
                case Clase.Degradado: return Degradado(d as Mapa);
                case Clase.Margen:
                {
                    var m = (Mapa)d;
                    return new RectOffset(m.I32("m_Left"), m.I32("m_Right"), m.I32("m_Top"), m.I32("m_Bottom"));
                }
                case Clase.Vector2Int: case Clase.Vector3Int: case Clase.RectInt: case Clase.BoundsInt:
                    return Compuesto(d as Mapa, t, r, prof);
                case Clase.Compuesto: return Compuesto(d as Mapa, t, r, prof);
                case Clase.Arreglo:
                {
                    var l = Lista(d, el, ce, r, prof);
                    var a = Array.CreateInstance(el, l.Count);
                    for (int i = 0; i < l.Count; i++) a.SetValue(l[i], i);
                    return a;
                }
                case Clase.Lista:
                {
                    var l = Lista(d, el, ce, r, prof);
                    var lista = (IList)Activator.CreateInstance(t, l.Count);
                    foreach (var x in l) lista.Add(x);
                    return lista;
                }
            }
            return null;
        }

        static object Compuesto(Mapa m, Type t, IResolutor r, int prof)
        {
            var o = Nuevo(t);
            if (o == null || m == null || prof >= PROFUNDIDAD) return o;
            Leer(o, TipoSerial.De(t), m, r, prof + 1);
            return o;
        }

        // Unity crea las clases serializables con su constructor sin parámetros (corren los inicializadores)
        public static object Nuevo(Type t)
        {
            if (t.IsValueType) return Activator.CreateInstance(t);
            try { return Activator.CreateInstance(t, true); }
            catch (MissingMethodException) { return System.Runtime.CompilerServices.RuntimeHelpers.GetUninitializedObject(t); }
            catch (TargetInvocationException e) { Debug.LogException(e.InnerException ?? e); return System.Runtime.CompilerServices.RuntimeHelpers.GetUninitializedObject(t); }
        }

        static List<object> Lista(object d, Type el, Clase ce, IResolutor r, int prof)
        {
            var res = new List<object>();
            switch (d)
            {
                case List<object> l:
                    foreach (var x in l) res.Add(Valor(x, el, ce, null, Clase.Ninguna, r, prof));
                    break;
                case Recurso rec:
                {
                    var b = r.Recurso(rec.Id);
                    int p = 1;
                    var a = Paquete.LeerArreglo(b[0], b, ref p, (b.Length - 1) / Paquete.TamanoElemento(b[0]));
                    foreach (var x in a) res.Add(Valor(Numero(x), el, ce, null, Clase.Ninguna, r, prof));
                    break;
                }
                case byte[] bs:
                    foreach (var x in bs) res.Add(Valor((long)x, el, ce, null, Clase.Ninguna, r, prof));
                    break;
                case Array a:
                    foreach (var x in a) res.Add(Valor(Numero(x), el, ce, null, Clase.Ninguna, r, prof));
                    break;
            }
            return res;
        }

        // los arreglos compactos traen el tipo más chico que alcanza: se pasa a long/double
        static object Numero(object x) => x switch
        {
            float f => f, double d => d,
            byte b => (long)b, sbyte sb => (long)sb, ushort us => (long)us, short s => (long)s,
            uint ui => (long)ui, int i => (long)i, long l => l, _ => x,
        };

        static object Entero(object d, Type t)
        {
            long l = d switch { long x => x, bool b => b ? 1 : 0, float f => (long)f, double db => (long)db, _ => 0 };
            unchecked
            {
                if (t == typeof(int)) return (int)l;
                if (t == typeof(uint)) return (uint)l;
                if (t == typeof(short)) return (short)l;
                if (t == typeof(ushort)) return (ushort)l;
                if (t == typeof(byte)) return (byte)l;
                if (t == typeof(sbyte)) return (sbyte)l;
                if (t == typeof(long)) return l;
                if (t == typeof(ulong)) return (ulong)l;
                if (t == typeof(char)) return (char)l;
            }
            return Convert.ChangeType(l, t);
        }

        public static Vector3 V3(Mapa m) => m == null ? default : new Vector3(m.F("x"), m.F("y"), m.F("z"));
        public static Vector2 V2(Mapa m) => m == null ? default : new Vector2(m.F("x"), m.F("y"));
        public static Vector4 V4(Mapa m) => m == null ? default : new Vector4(m.F("x"), m.F("y"), m.F("z"), m.F("w"));
        public static Quaternion Q(Mapa m) => m == null ? Quaternion.identity : new Quaternion(m.F("x"), m.F("y"), m.F("z"), m.F("w"));
        public static Color Color(Mapa m) => m == null ? default : new Color(m.F("r"), m.F("g"), m.F("b"), m.F("a"));

        public static AnimationCurve Curva(Mapa m)
        {
            var c = new AnimationCurve();
            if (m == null) return c;
            var l = m.L("m_Curve");
            var keys = new Keyframe[l?.Count ?? 0];
            for (int i = 0; i < keys.Length; i++)
            {
                var k = (Mapa)l[i];
                keys[i] = new Keyframe(k.F("time"), k.F("value"), k.F("inSlope"), k.F("outSlope"), k.F("inWeight", 1f / 3f), k.F("outWeight", 1f / 3f))
                {
                    tangentModeInterno = k.I32("tangentMode"),
                    weightedMode = (WeightedMode)k.I32("weightedMode"),
                };
            }
            c.keys = keys;
            c.preWrapMode = AnimationCurve.ModoDeInterno(m.I32("m_PreInfinity", 2));
            c.postWrapMode = AnimationCurve.ModoDeInterno(m.I32("m_PostInfinity", 2));
            return c;
        }

        public static Gradient Degradado(Mapa m)
        {
            var g = new Gradient();
            if (m == null) return g;
            int nc = m.I32("m_NumColorKeys"), na = m.I32("m_NumAlphaKeys");
            var cs = new GradientColorKey[nc];
            var al = new GradientAlphaKey[na];
            for (int i = 0; i < nc; i++)
            {
                var col = Color(m.M("key" + i));
                cs[i] = new GradientColorKey(col, m.I("ctime" + i) / 65535f);
            }
            for (int i = 0; i < na; i++)
            {
                var col = Color(m.M("key" + i));
                al[i] = new GradientAlphaKey(col.a, m.I("atime" + i) / 65535f);
            }
            g.SetKeys(cs, al);
            g.mode = (GradientMode)m.I32("m_Mode");
            return g;
        }

        // ── copiar (Instantiate) ──
        // Como Unity: serializa el original y lo deserializa en el clon. Los campos que no se
        // serializan quedan con lo que dejó el constructor; las referencias a objetos de la
        // jerarquía clonada pasan a sus clones.
        public static void Copiar(object origen, object destino, Func<Object, Object> remap)
        {
            var ts = TipoSerial.De(origen.GetType());
            if (ts.Receptor && origen is ISerializationCallbackReceiver ro)
            {
                try { ro.OnBeforeSerialize(); } catch (Exception e) { Debug.LogException(e); }
            }
            CopiarCampos(origen, destino, ts, remap, 0);
            if (ts.Receptor && destino is ISerializationCallbackReceiver rd)
            {
                try { rd.OnAfterDeserialize(); } catch (Exception e) { Debug.LogException(e); }
            }
        }

        static void CopiarCampos(object origen, object destino, TipoSerial ts, Func<Object, Object> remap, int prof)
        {
            foreach (var c in ts.Campos)
                c.F.SetValue(destino, CopiarValor(c.F.GetValue(origen), c.Tipo, c.C, c.Elemento, c.CElemento, remap, prof));
        }

        static object CopiarValor(object v, Type t, Clase c, Type el, Clase ce, Func<Object, Object> remap, int prof)
        {
            switch (c)
            {
                case Clase.Cadena: return v ?? "";
                case Clase.Objeto:
                {
                    var o = v as Object;
                    if ((object)o == null) return null;
                    var x = remap(o);
                    return x;
                }
                case Clase.Curva: return v is AnimationCurve ac ? new AnimationCurve(ac.keys) { preWrapMode = ac.preWrapMode, postWrapMode = ac.postWrapMode } : new AnimationCurve();
                case Clase.Degradado:
                {
                    var g = new Gradient();
                    if (v is Gradient go) { g.SetKeys(go.colorKeys, go.alphaKeys); g.mode = go.mode; }
                    return g;
                }
                case Clase.Margen: return v is RectOffset ro ? new RectOffset(ro.left, ro.right, ro.top, ro.bottom) : new RectOffset();
                case Clase.Compuesto:
                {
                    var n = Nuevo(t);
                    if (v == null || prof >= PROFUNDIDAD) return n;
                    var ts = TipoSerial.De(t);
                    if (ts.Receptor && v is ISerializationCallbackReceiver ro2) { try { ro2.OnBeforeSerialize(); } catch (Exception e) { Debug.LogException(e); } }
                    CopiarCampos(v, n, ts, remap, prof + 1);
                    if (ts.Receptor && n is ISerializationCallbackReceiver rn) { try { rn.OnAfterDeserialize(); } catch (Exception e) { Debug.LogException(e); } }
                    return n;
                }
                case Clase.Arreglo:
                {
                    var a = v as Array;
                    int n = a?.Length ?? 0;
                    var r = Array.CreateInstance(el, n);
                    for (int i = 0; i < n; i++) r.SetValue(CopiarValor(a.GetValue(i), el, ce, null, Clase.Ninguna, remap, prof), i);
                    return r;
                }
                case Clase.Lista:
                {
                    var l = v as IList;
                    int n = l?.Count ?? 0;
                    var r = (IList)Activator.CreateInstance(t, n);
                    for (int i = 0; i < n; i++) r.Add(CopiarValor(l[i], el, ce, null, Clase.Ninguna, remap, prof));
                    return r;
                }
                default:
                    // números, enums y structs de Unity: por valor
                    return v;
            }
        }
    }
}

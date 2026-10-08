using System;
using System.Collections.Generic;
using UnityEngine;

namespace Porteo.Render
{
    public enum TipoValor : byte { Nada, Numero, Vector, Matriz, Textura, Numeros, Vectores, Matrices }

    // Un valor para un uniform: número, vector, matriz (16 floats por columnas), textura o arreglos.
    public struct Valor
    {
        public TipoValor Tipo;
        public Vector4 V;
        public object O;   // float[] (matriz o arreglos) o Texture

        public static Valor Numero(float f) => new Valor { Tipo = TipoValor.Numero, V = new Vector4(f, f, f, f) };
        public static Valor Vec(Vector4 v) => new Valor { Tipo = TipoValor.Vector, V = v };
        public static Valor Tex(Texture t) => new Valor { Tipo = TipoValor.Textura, O = t };

        public static Valor Matriz(in Matrix4x4 m)
        {
            var a = new float[16];
            for (int i = 0; i < 16; i++) a[i] = m[i];
            return new Valor { Tipo = TipoValor.Matriz, O = a };
        }

        public static Valor Numeros(float[] a) => new Valor { Tipo = TipoValor.Numeros, O = (float[])a.Clone() };

        public static Valor Vectores(Vector4[] vs)
        {
            var a = new float[vs.Length * 4];
            for (int i = 0; i < vs.Length; i++) { a[i * 4] = vs[i].x; a[i * 4 + 1] = vs[i].y; a[i * 4 + 2] = vs[i].z; a[i * 4 + 3] = vs[i].w; }
            return new Valor { Tipo = TipoValor.Vectores, O = a };
        }

        public float F => V.x;
        public bool Hay => Tipo != TipoValor.Nada;
    }

    // Los nombres de propiedad de los shaders como números (Shader.PropertyToID).
    public static class Ids
    {
        static readonly Dictionary<string, int> porNombre = new Dictionary<string, int>(1024);
        static readonly List<string> nombres = new List<string>(1024);

        public static int De(string nombre)
        {
            if (nombre == null) return -1;
            if (porNombre.TryGetValue(nombre, out int i)) return i;
            i = nombres.Count;
            nombres.Add(nombre);
            porNombre[nombre] = i;
            return i;
        }

        public static string Nombre(int id) => id >= 0 && id < nombres.Count ? nombres[id] : null;
        public static int Cantidad => nombres.Count;
    }

    // Un juego de propiedades (las de un material, un MaterialPropertyBlock o las globales).
    // Cada cambio sube la versión: quien cachea lo que subió a la GPU sabe cuándo rehacerlo.
    public sealed class Tabla
    {
        readonly Dictionary<int, Valor> d = new Dictionary<int, Valor>();
        public int Version = 1;

        public int Cantidad => d.Count;
        public bool Tiene(int id) => d.ContainsKey(id);
        public bool Leer(int id, out Valor v) => d.TryGetValue(id, out v);

        public Valor this[int id] => d.TryGetValue(id, out var v) ? v : default;

        public void Poner(int id, in Valor v) { d[id] = v; Version++; }
        public bool Quitar(int id) { if (!d.Remove(id)) return false; Version++; return true; }
        public void Limpiar() { if (d.Count == 0) return; d.Clear(); Version++; }

        public void CopiarDe(Tabla o)
        {
            d.Clear();
            foreach (var kv in o.d) d[kv.Key] = kv.Value;
            Version++;
        }

        public IEnumerable<KeyValuePair<int, Valor>> Todos => d;

        // una textura y sus derivados (_ST, _TexelSize, _HDR) como en Unity
        public void PonerTextura(int id, Texture t)
        {
            Poner(id, Valor.Tex(t));
            var n = Ids.Nombre(id);
            if ((object)t != null && !t.destruido)
                Poner(Ids.De(n + "_TexelSize"), Valor.Vec(new Vector4(1f / Math.Max(1, t.width), 1f / Math.Max(1, t.height), t.width, t.height)));
            Poner(Ids.De(n + "_HDR"), Valor.Vec(new Vector4(1, 1, 0, 0)));
        }
    }
}

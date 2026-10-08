using System;
using System.Collections.Generic;
using System.Text;

namespace Porteo.Datos
{
    // Un puntero de Unity a otro objeto: archivo (0 = el mismo; si no, externos[archivo-1]) y su pathID.
    public readonly struct PPtr
    {
        public readonly int Archivo;
        public readonly long PathID;
        public PPtr(int archivo, long pathID) { Archivo = archivo; PathID = pathID; }
        public bool Nulo => PathID == 0;
        public override string ToString() => $"PPtr({Archivo}, {PathID})";
    }

    // Algo grande guardado aparte (recursos/ID.bin): datos de texturas, mallas, audio, shaders.
    public readonly struct Recurso
    {
        public readonly int Id;
        public Recurso(int id) { Id = id; }
        public override string ToString() => $"Recurso({Id})";
    }

    // Un mapa del árbol: los campos de un objeto o de un struct serializado, en el orden de Unity.
    public sealed class Mapa
    {
        public readonly string[] Claves;
        public readonly object[] Valores;

        public Mapa(string[] claves, object[] valores) { Claves = claves; Valores = valores; }

        public int Cantidad => Claves.Length;

        public bool Tiene(string k) => Indice(k) >= 0;

        public int Indice(string k)
        {
            var c = Claves;
            for (int i = 0; i < c.Length; i++)
                if ((object)c[i] == (object)k || c[i] == k) return i;
            return -1;
        }

        public object this[string k] { get { int i = Indice(k); return i < 0 ? null : Valores[i]; } }

        public Mapa M(string k) => this[k] as Mapa;
        public List<object> L(string k) => this[k] as List<object>;
        public string S(string k) => this[k] as string;
        public PPtr P(string k) => this[k] is PPtr p ? p : default;

        public long I(string k, long def = 0) => this[k] switch
        {
            long l => l,
            bool b => b ? 1 : 0,
            float f => (long)f,
            double d => (long)d,
            _ => def,
        };

        public int I32(string k, int def = 0) => (int)I(k, def);
        public bool B(string k, bool def = false) => this[k] switch { bool b => b, long l => l != 0, _ => def };

        public float F(string k, float def = 0) => this[k] switch
        {
            float f => f,
            double d => (float)d,
            long l => l,
            _ => def,
        };

        public override string ToString()
        {
            var sb = new StringBuilder("{");
            for (int i = 0; i < Claves.Length && i < 12; i++) sb.Append(i > 0 ? ", " : "").Append(Claves[i]).Append(": ").Append(Valores[i] is Mapa ? "{..}" : Valores[i]);
            return sb.Append('}').ToString();
        }
    }

    // Un archivo serializado de Unity exportado al formato del motor (ver exportar/arbol.py).
    public sealed class Paquete
    {
        public readonly string Nombre;
        public readonly string[] Externos;
        public readonly (string ensamblado, string ns, string clase)[] Scripts;
        readonly string[] claves;
        readonly byte[] datos;
        readonly int baseDatos;

        public readonly struct Entrada
        {
            public readonly int Clase;
            public readonly int Script;
            public readonly int Desde;
            public readonly int Largo;
            public Entrada(int clase, int script, int desde, int largo) { Clase = clase; Script = script; Desde = desde; Largo = largo; }
        }

        public readonly Dictionary<long, Entrada> Objetos;
        // el orden en que están en el archivo (Unity crea los objetos de una escena en ese orden)
        public readonly long[] Orden;

        public Paquete(string nombre, byte[] datos)
        {
            Nombre = nombre;
            this.datos = datos;
            if (datos.Length < 8 || datos[0] != 'P' || datos[1] != 'A' || datos[2] != 'Q' || datos[3] != '1')
                throw new FormatException("no es un .paq: " + nombre);
            int p = 8;
            claves = ListaCadenas(ref p);
            for (int i = 0; i < claves.Length; i++) claves[i] = string.Intern(claves[i]);
            Externos = ListaCadenas(ref p);
            int ns = U32(ref p);
            Scripts = new (string, string, string)[ns];
            for (int i = 0; i < ns; i++) Scripts[i] = (Cadena(ref p), Cadena(ref p), Cadena(ref p));
            int n = U32(ref p);
            Objetos = new Dictionary<long, Entrada>(n);
            Orden = new long[n];
            for (int i = 0; i < n; i++)
            {
                long pid = BitConverter.ToInt64(datos, p);
                int clase = BitConverter.ToInt32(datos, p + 8);
                int script = BitConverter.ToInt32(datos, p + 12);
                int desde = (int)BitConverter.ToUInt32(datos, p + 16);
                int largo = (int)BitConverter.ToUInt32(datos, p + 20);
                p += 24;
                Objetos[pid] = new Entrada(clase, script, desde, largo);
                Orden[i] = pid;
            }
            baseDatos = p;
        }

        public bool Tiene(long pathID) => Objetos.ContainsKey(pathID);

        public object Leer(long pathID)
        {
            if (!Objetos.TryGetValue(pathID, out var e)) return null;
            int p = baseDatos + e.Desde;
            return Valor(ref p);
        }

        // Los punteros y los recursos de un objeto, recorriendo los bytes sin armar el árbol: para
        // saber qué hay que traer antes de cargar una escena.
        public void Escanear(long pathID, List<PPtr> punteros, List<int> recursos)
        {
            if (!Objetos.TryGetValue(pathID, out var e)) return;
            int p = baseDatos + e.Desde;
            Saltar(ref p, punteros, recursos);
        }

        void Saltar(ref int p, List<PPtr> ps, List<int> rs)
        {
            byte t = datos[p++];
            switch (t)
            {
                case 0: case 1: case 2: return;
                case 3: Varint(ref p); return;
                case 4: p += 4; return;
                case 5: p += 8; return;
                case 6: case 9: { int n = (int)Varint(ref p); p += n; return; }
                case 7: { int n = (int)Varint(ref p); for (int i = 0; i < n; i++) Saltar(ref p, ps, rs); return; }
                case 8: { int n = (int)Varint(ref p); for (int i = 0; i < n; i++) { Varint(ref p); Saltar(ref p, ps, rs); } return; }
                case 10: { int a = (int)Varint(ref p); long id = Zigzag(ref p); if (id != 0) ps.Add(new PPtr(a, id)); return; }
                case 11: { byte tipo = datos[p++]; int n = (int)Varint(ref p); p += n * TamanoElemento(tipo); return; }
                case 12: rs.Add((int)Varint(ref p)); return;
                default: throw new FormatException($"{Nombre}: etiqueta {t} en {p - 1}");
            }
        }

        // ── lectura ──
        int U32(ref int p) { int v = BitConverter.ToInt32(datos, p); p += 4; return v; }

        ulong Varint(ref int p)
        {
            ulong r = 0; int s = 0;
            while (true)
            {
                byte b = datos[p++];
                r |= (ulong)(b & 0x7F) << s;
                if (b < 0x80) return r;
                s += 7;
            }
        }

        long Zigzag(ref int p)
        {
            ulong v = Varint(ref p);
            return (long)(v >> 1) ^ -(long)(v & 1);
        }

        string Cadena(ref int p)
        {
            int n = (int)Varint(ref p);
            var s = Encoding.UTF8.GetString(datos, p, n);
            p += n;
            return s;
        }

        string[] ListaCadenas(ref int p)
        {
            int n = U32(ref p);
            var r = new string[n];
            for (int i = 0; i < n; i++) r[i] = Cadena(ref p);
            return r;
        }

        object Valor(ref int p)
        {
            byte t = datos[p++];
            switch (t)
            {
                case 0: return null;
                case 1: return false;
                case 2: return true;
                case 3: return Zigzag(ref p);
                case 4: { float f = BitConverter.ToSingle(datos, p); p += 4; return f; }
                case 5: { double d = BitConverter.ToDouble(datos, p); p += 8; return d; }
                case 6: return Cadena(ref p);
                case 7:
                {
                    int n = (int)Varint(ref p);
                    var l = new List<object>(n);
                    for (int i = 0; i < n; i++) l.Add(Valor(ref p));
                    return l;
                }
                case 8:
                {
                    int n = (int)Varint(ref p);
                    var ks = new string[n];
                    var vs = new object[n];
                    for (int i = 0; i < n; i++)
                    {
                        ks[i] = claves[(int)Varint(ref p)];
                        vs[i] = Valor(ref p);
                    }
                    return new Mapa(ks, vs);
                }
                case 9:
                {
                    int n = (int)Varint(ref p);
                    var b = new byte[n];
                    Buffer.BlockCopy(datos, p, b, 0, n);
                    p += n;
                    return b;
                }
                case 10: { int a = (int)Varint(ref p); long id = Zigzag(ref p); return new PPtr(a, id); }
                case 11: return Arreglo(ref p);
                case 12: return new Recurso((int)Varint(ref p));
                default: throw new FormatException($"{Nombre}: etiqueta {t} en {p - 1}");
            }
        }

        Array Arreglo(ref int p)
        {
            byte tipo = datos[p++];
            int n = (int)Varint(ref p);
            return LeerArreglo(tipo, datos, ref p, n);
        }

        // los tipos de los arreglos de números (los mismos que arbol.py)
        public static Array LeerArreglo(byte tipo, byte[] datos, ref int p, int n)
        {
            Array a = tipo switch
            {
                0 => new byte[n],
                1 => new sbyte[n],
                2 => new ushort[n],
                3 => new short[n],
                4 => new uint[n],
                5 => new int[n],
                6 => new float[n],
                7 => new double[n],
                8 => new long[n],
                _ => throw new FormatException("arreglo de tipo " + tipo),
            };
            int bytes = n * TamanoElemento(tipo);
            Buffer.BlockCopy(datos, p, a, 0, bytes);
            p += bytes;
            return a;
        }

        public static int TamanoElemento(byte tipo) => tipo switch { 0 or 1 => 1, 2 or 3 => 2, 4 or 5 or 6 => 4, _ => 8 };

        // Un arreglo de números que el exportador mandó a recursos/ por grande: empieza con un
        // byte con su tipo (arbol.py), a diferencia de los bytes crudos (texturas, vértices).
        public static Array ArregloDeRecurso(byte[] b)
        {
            if (b == null || b.Length == 0) return Array.Empty<byte>();
            int p = 1;
            return LeerArreglo(b[0], b, ref p, (b.Length - 1) / TamanoElemento(b[0]));
        }

        // los bytes de un arreglo de bytes guardado como recurso (sin el byte del tipo)
        public static byte[] BytesDeRecurso(byte[] b)
        {
            if (b == null || b.Length == 0 || b[0] != 0) return b;
            var r = new byte[b.Length - 1];
            Buffer.BlockCopy(b, 1, r, 0, r.Length);
            return r;
        }
    }
}

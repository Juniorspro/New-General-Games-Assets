using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using Porteo;
using UnityEngine;
using Object = UnityEngine.Object;
using Porteo.Datos;
using Porteo.Render;

namespace Porteo.Render
{
    public struct CanalMalla
    {
        public byte Stream, Offset, Formato, Dim;   // Formato: VertexFormat de Unity (0 Float ... 11 SInt32)
        public byte Relleno;                        // lo que ocupa con la alineación (mayor o igual que Dim)

        public static int Tam(int formato) => formato switch { 0 => 4, 1 => 2, 2 => 1, 3 => 1, 4 => 2, 5 => 2, 6 => 1, 7 => 1, 8 => 2, 9 => 2, _ => 4 };

        public uint TipoGl => Formato switch
        {
            0 => Gl.FLOAT, 1 => Gl.HALF_FLOAT, 2 => Gl.UNSIGNED_BYTE, 3 => Gl.BYTE, 4 => Gl.UNSIGNED_SHORT, 5 => Gl.SHORT,
            6 => Gl.UNSIGNED_BYTE, 7 => Gl.BYTE, 8 => Gl.UNSIGNED_SHORT, 9 => Gl.SHORT, 10 => Gl.UNSIGNED_INT, _ => Gl.INT,
        };

        public bool Normalizado => Formato >= 2 && Formato <= 5;
        public bool Entero => Formato >= 6;
    }

    public struct Submalla
    {
        public int Primero, Cantidad, BaseVertice, Topologia;
        public Bounds Limites;
    }

    // Los PackedBitVector de las mallas comprimidas de Unity.
    public static class Empacado
    {
        public static byte[] Bytes(object o) => o switch
        {
            byte[] b => b,
            List<object> l => l.ConvertAll(x => (byte)Convert.ToInt32(x)).ToArray(),
            Array a => Conv(a),
            _ => Array.Empty<byte>(),
        };

        static byte[] Conv(Array a)
        {
            var r = new byte[a.Length];
            for (int i = 0; i < r.Length; i++) r[i] = Convert.ToByte(a.GetValue(i));
            return r;
        }

        public static float[] Floats(Mapa v, int porTrozo, int desde = 0, int trozos = -1)
        {
            int n = v.I32("m_NumItems"), bits = v.I32("m_BitSize");
            float rango = v.F("m_Range"), inicio = v.F("m_Start");
            var d = Bytes(v["m_Data"]);
            if (trozos < 0) trozos = n / Math.Max(1, porTrozo);
            var r = new float[trozos * porTrozo];
            int pos = bits * desde, idx = pos / 8; pos %= 8;
            float max = (1 << bits) - 1;
            for (int i = 0; i < r.Length; i++)
            {
                uint x = 0; int b = 0;
                while (b < bits && idx < d.Length)
                {
                    x |= (uint)((d[idx] >> pos) << b);
                    int num = Math.Min(bits - b, 8 - pos);
                    pos += num; b += num;
                    if (pos == 8) { idx++; pos = 0; }
                }
                x &= (uint)((1L << bits) - 1);
                r[i] = max > 0 ? x * rango / max + inicio : inicio;
            }
            return r;
        }

        public static int[] Ints(Mapa v)
        {
            int n = v.I32("m_NumItems"), bits = v.I32("m_BitSize");
            var d = Bytes(v["m_Data"]);
            var r = new int[n];
            int idx = 0, pos = 0;
            for (int i = 0; i < n; i++)
            {
                int b = 0, x = 0;
                while (b < bits && idx < d.Length)
                {
                    x |= (d[idx] >> pos) << b;
                    int num = Math.Min(bits - b, 8 - pos);
                    pos += num; b += num;
                    if (pos == 8) { idx++; pos = 0; }
                }
                r[i] = bits >= 32 ? x : x & ((1 << bits) - 1);
            }
            return r;
        }
    }
}

namespace UnityEngine
{
    // Una malla. Las del juego traen los vértices tal cual los guarda Unity (canales en streams
    // intercalados): eso se sube a la GPU sin tocar. Los arreglos (vertices, normals...) se
    // decodifican sólo si alguien los pide; si el juego los cambia, se vuelve a armar el buffer.
    public sealed partial class Mesh : Object
    {
        internal int nVertices;
        internal readonly CanalMalla[] canales = new CanalMalla[Canales.CANTIDAD];
        internal int[] pasoStream = new int[4], inicioStream = new int[4];
        internal byte[] crudo2;           // m_DataSize
        internal int recursoVertices = -1;
        // los índices (16 o 32 bits); los de las mallas grandes llegan aparte, como los vértices
        byte[] indicesCrudos;
        int recursoIndices = -1;
        internal byte[] indices
        {
            get
            {
                if (indicesCrudos == null && recursoIndices >= 0)
                {
                    // m_IndexBuffer es una lista de bytes: de recursos/ viene con el byte del tipo adelante
                    // (sin sacarlo, las mallas grandes, como las del batching estático, salen hechas trizas)
                    var b = Anfitrion.Recurso(recursoIndices, true);
                    indicesCrudos = b != null && (b.Length & 1) == 1 ? Paquete.BytesDeRecurso(b) : b;
                    if (indicesCrudos != null) recursoIndices = -1;
                }
                return indicesCrudos;
            }
            set { indicesCrudos = value; recursoIndices = -1; }
        }
        internal bool indices32;
        internal Submalla[] submallas = Array.Empty<Submalla>();
        internal Bounds limites;
        internal Matrix4x4[] poses = Array.Empty<Matrix4x4>();
        internal uint[] hashHuesos = Array.Empty<uint>();
        internal uint hashRaiz;
        internal bool legible = true;
        internal int version = 1;
        // geometría dinámica (partículas): cuánto de crudo2 y de indices vale (los arreglos se
        // reusan de un cuadro a otro y pueden ser más grandes)
        internal int bytesUsados = -1, indicesUsados = -1;

        // la copia en arreglos (cuando alguien la pide o la arma el juego)
        Vector3[] pos, nor; Vector4[] tan; Color32[] col; readonly Vector2[][] uvs = new Vector2[8][];
        BoneWeight[] pesos;
        bool hayArreglos, arreglosSucios;

        public Mesh() { m_Name = ""; }

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            legible = m.B("m_IsReadable", true);
            var vd = m.M("m_VertexData");
            nVertices = vd?.I32("m_VertexCount") ?? 0;
            var chs = vd?.L("m_Channels");
            if (chs != null)
                for (int i = 0; i < chs.Count && i < Canales.CANTIDAD; i++)
                {
                    var c = (Mapa)chs[i];
                    // en las mallas del batching estático la dimensión viene como 0x34: 3 componentes
                    // en media precisión ocupando 4 por la alineación (el cuarto es relleno: leído como
                    // w de la posición manda los vértices lejísimos)
                    int d = c.I32("dimension");
                    int real = d >> 4 != 0 ? d >> 4 : d & 15;
                    canales[i] = new CanalMalla { Stream = (byte)c.I32("stream"), Offset = (byte)c.I32("offset"), Formato = (byte)c.I32("format"), Dim = (byte)real, Relleno = (byte)Math.Max(real, d & 15) };
                }
            switch (vd?["m_DataSize"])
            {
                case byte[] b: crudo2 = b; break;
                case Recurso rec: recursoVertices = recursoOrigen = rec.Id; break;
            }
            CalcularStreams();
            indices32 = m.I32("m_IndexFormat") == 1;
            switch (m["m_IndexBuffer"])
            {
                case byte[] b: indices = b; break;
                case Recurso rec: recursoIndices = rec.Id; break;
                case List<object> l: indices = Empacado.Bytes(l); break;
                case Array a: indices = Empacado.Bytes(a); break;
            }
            var subs = new List<Submalla>();
            var ls = m.L("m_SubMeshes");
            if (ls != null)
                foreach (Mapa s in ls)
                {
                    var aabb = s.M("localAABB");
                    subs.Add(new Submalla
                    {
                        Primero = s.I32("firstByte") / (indices32 ? 4 : 2), Cantidad = s.I32("indexCount"), BaseVertice = s.I32("baseVertex"),
                        Topologia = s.I32("topology"),
                        Limites = new Bounds { center = Serial.V3(aabb?.M("m_Center")), extents = Serial.V3(aabb?.M("m_Extent")) },
                    });
                }
            submallas = subs.ToArray();
            var aa = m.M("m_LocalAABB");
            limites = new Bounds { center = Serial.V3(aa?.M("m_Center")), extents = Serial.V3(aa?.M("m_Extent")) };
            var bp = m.L("m_BindPose");
            if (bp != null && bp.Count > 0)
            {
                poses = new Matrix4x4[bp.Count];
                for (int i = 0; i < bp.Count; i++)
                {
                    var x = (Mapa)bp[i];
                    var mm = new Matrix4x4();
                    for (int f = 0; f < 4; f++) for (int c = 0; c < 4; c++) mm[f, c] = x.F("e" + f + c);
                    poses[i] = mm;
                }
            }
            switch (m["m_BoneNameHashes"])
            {
                case List<object> l: hashHuesos = l.ConvertAll(x => (uint)Convert.ToInt64(x)).ToArray(); break;
                case Array a: hashHuesos = new uint[a.Length]; for (int i = 0; i < a.Length; i++) hashHuesos[i] = (uint)Convert.ToInt64(a.GetValue(i)); break;
            }
            hashRaiz = (uint)m.I("m_RootBoneNameHash");
            if (nVertices == 0 && m.M("m_CompressedMesh") is Mapa cm && (cm.M("m_Vertices")?.I32("m_NumItems") ?? 0) > 0)
                Descomprimir(cm);
        }

        internal void CalcularStreams()
        {
            Array.Clear(pasoStream, 0, 4);
            for (int i = 0; i < Canales.CANTIDAD; i++)
            {
                var c = canales[i];
                if (c.Dim == 0) continue;
                int fin = c.Offset + Math.Max(c.Dim, c.Relleno) * CanalMalla.Tam(c.Formato);
                if (fin > pasoStream[c.Stream]) pasoStream[c.Stream] = fin;
            }
            int p = 0;
            for (int s = 0; s < 4; s++)
            {
                inicioStream[s] = p;
                p += pasoStream[s] * nVertices;
                p = (p + 15) & ~15;
            }
        }

        // los bytes de los vértices (los grandes vienen aparte, en un recurso)
        internal byte[] Crudo()
        {
            if (crudo2 == null && recursoVertices >= 0)
            {
                crudo2 = Anfitrion.Recurso(recursoVertices, true);
                if (crudo2 != null) recursoVertices = -1;
            }
            return crudo2;
        }

        // ── para la física ──
        // el recurso de donde salieron los vértices: si ya se soltaron (malla no legible que está
        // en la GPU), el cooking de un MeshCollider puede volver a pedirlos
        int recursoOrigen = -1;

        // las posiciones como floats (x, y, z): sólo el canal de posición, sin armar los arreglos
        // de todos los canales (son 17 mil MeshCollider)
        internal float[] PosicionesFisica()
        {
            if (hayArreglos)
            {
                if (pos == null) return null;
                var r = new float[pos.Length * 3];
                for (int i = 0; i < pos.Length; i++) { r[i * 3] = pos[i].x; r[i * 3 + 1] = pos[i].y; r[i * 3 + 2] = pos[i].z; }
                return r;
            }
            var b = Crudo() ?? (recursoOrigen >= 0 ? Anfitrion.Recurso(recursoOrigen, true) : null);
            var c = canales[Canales.POSICION];
            if (b == null || c.Dim == 0 || nVertices == 0) return null;
            var res = new float[nVertices * 3];
            int paso = pasoStream[c.Stream], tam = CanalMalla.Tam(c.Formato);
            for (int i = 0; i < nVertices; i++)
            {
                int p = inicioStream[c.Stream] + i * paso + c.Offset;
                for (int k = 0; k < 3 && k < c.Dim; k++) res[i * 3 + k] = Componente(b, p + k * tam, c.Formato);
            }
            return res;
        }

        // los triángulos de todas las submallas con su vértice base (Unity arma así el
        // MeshCollider); los que apuntan fuera de los vértices se saltean
        internal uint[] TriangulosFisica(int nv)
        {
            var ind = indices;
            if (ind == null) return null;
            int total = 0;
            foreach (var s in submallas) if (s.Topologia == 0) total += s.Cantidad - s.Cantidad % 3;
            var r = new uint[total];
            int k = 0, tamI = indices32 ? 4 : 2;
            foreach (var s in submallas)
            {
                if (s.Topologia != 0) continue;
                int n = s.Cantidad - s.Cantidad % 3;
                for (int i = 0; i < n; i += 3)
                {
                    int j = s.Primero + i;
                    if ((j + 3) * tamI > ind.Length) break;
                    long a = (indices32 ? BitConverter.ToUInt32(ind, j * 4) : BitConverter.ToUInt16(ind, j * 2)) + (long)s.BaseVertice;
                    long b = (indices32 ? BitConverter.ToUInt32(ind, j * 4 + 4) : BitConverter.ToUInt16(ind, j * 2 + 2)) + (long)s.BaseVertice;
                    long c = (indices32 ? BitConverter.ToUInt32(ind, j * 4 + 8) : BitConverter.ToUInt16(ind, j * 2 + 4)) + (long)s.BaseVertice;
                    if (a < 0 || b < 0 || c < 0 || a >= nv || b >= nv || c >= nv) continue;
                    r[k++] = (uint)a; r[k++] = (uint)b; r[k++] = (uint)c;
                }
            }
            if (k < r.Length) Array.Resize(ref r, k);
            return r;
        }

        // ── malla comprimida (PackedBitVector) a canales sin comprimir ──
        void Descomprimir(Mapa cm)
        {
            var pv = Empacado.Floats(cm.M("m_Vertices"), 3);
            int n = pv.Length / 3;
            pos = new Vector3[n];
            for (int i = 0; i < n; i++) pos[i] = new Vector3(pv[i * 3], pv[i * 3 + 1], pv[i * 3 + 2]);
            var muv = cm.M("m_UV");
            if (muv != null && muv.I32("m_NumItems") > 0)
            {
                uint info = (uint)cm.I("m_UVInfo");
                if (info != 0)
                {
                    int desde = 0;
                    for (int uv = 0; uv < 8; uv++)
                    {
                        uint bits = info >> (uv * 4) & 15;
                        if ((bits & 4) == 0) continue;
                        int dim = 1 + (int)(bits & 3);
                        var f = Empacado.Floats(muv, dim, desde, n);
                        var a = new Vector2[n];
                        for (int i = 0; i < n; i++) a[i] = new Vector2(f[i * dim], dim > 1 ? f[i * dim + 1] : 0);
                        uvs[uv] = a;
                        desde += dim * n;
                    }
                }
                else
                {
                    var f = Empacado.Floats(muv, 2, 0, n);
                    uvs[0] = new Vector2[n];
                    for (int i = 0; i < n; i++) uvs[0][i] = new Vector2(f[i * 2], f[i * 2 + 1]);
                    if (muv.I32("m_NumItems") >= n * 4)
                    {
                        var f2 = Empacado.Floats(muv, 2, n * 2, n);
                        uvs[1] = new Vector2[n];
                        for (int i = 0; i < n; i++) uvs[1][i] = new Vector2(f2[i * 2], f2[i * 2 + 1]);
                    }
                }
            }
            var mn = cm.M("m_Normals");
            if (mn != null && mn.I32("m_NumItems") > 0)
            {
                var f = Empacado.Floats(mn, 2);
                var signos = Empacado.Ints(cm.M("m_NormalSigns"));
                nor = new Vector3[f.Length / 2];
                for (int i = 0; i < nor.Length; i++)
                {
                    float x = f[i * 2], y = f[i * 2 + 1], zz = 1 - x * x - y * y, z;
                    if (zz >= 0) z = (float)Math.Sqrt(zz);
                    else { var v = new Vector3(x, y, 0).normalized; x = v.x; y = v.y; z = 0; }
                    if (i < signos.Length && signos[i] == 0) z = -z;
                    nor[i] = new Vector3(x, y, z);
                }
            }
            var mt = cm.M("m_Tangents");
            if (mt != null && mt.I32("m_NumItems") > 0)
            {
                var f = Empacado.Floats(mt, 2);
                var signos = Empacado.Ints(cm.M("m_TangentSigns"));
                tan = new Vector4[f.Length / 2];
                for (int i = 0; i < tan.Length; i++)
                {
                    float x = f[i * 2], y = f[i * 2 + 1], zz = 1 - x * x - y * y, z;
                    if (zz >= 0) z = (float)Math.Sqrt(zz);
                    else { var v = new Vector3(x, y, 0).normalized; x = v.x; y = v.y; z = 0; }
                    if (i * 2 < signos.Length && signos[i * 2] == 0) z = -z;
                    float w = i * 2 + 1 < signos.Length && signos[i * 2 + 1] > 0 ? 1f : -1f;
                    tan[i] = new Vector4(x, y, z, w);
                }
            }
            var mc = cm.M("m_FloatColors");
            if (mc != null && mc.I32("m_NumItems") > 0)
            {
                var f = Empacado.Floats(mc, 4);
                col = new Color32[f.Length / 4];
                for (int i = 0; i < col.Length; i++) col[i] = new Color(f[i * 4], f[i * 4 + 1], f[i * 4 + 2], f[i * 4 + 3]);
            }
            var tr = cm.M("m_Triangles");
            if (tr != null && tr.I32("m_NumItems") > 0)
            {
                var t = Empacado.Ints(tr);
                indices32 = n > 65535;
                indices = new byte[t.Length * (indices32 ? 4 : 2)];
                for (int i = 0; i < t.Length; i++)
                {
                    if (indices32) BitConverter.TryWriteBytes(new Span<byte>(indices, i * 4, 4), t[i]);
                    else BitConverter.TryWriteBytes(new Span<byte>(indices, i * 2, 2), (ushort)t[i]);
                }
            }
            nVertices = n;
            hayArreglos = true;
            arreglosSucios = true;
            Array.Clear(canales, 0, canales.Length);
            crudo2 = null;
        }

        // ── decodificar a arreglos ──
        void Arreglos()
        {
            if (hayArreglos) return;
            hayArreglos = true;
            var b = Crudo() ?? (recursoVertices >= 0 ? Cargador.Recurso(recursoVertices) : null);
            if (b == null || nVertices == 0) return;
            pos = Leer3(b, Canales.POSICION);
            nor = Leer3(b, Canales.NORMAL);
            tan = Leer4(b, Canales.TANGENTE);
            var c4 = Leer4(b, Canales.COLOR);
            if (c4 != null) { col = new Color32[c4.Length]; for (int i = 0; i < c4.Length; i++) col[i] = new Color(c4[i].x, c4[i].y, c4[i].z, c4[i].w); }
            for (int u = 0; u < 8; u++)
            {
                var a = Leer4(b, Canales.UV0 + u);
                if (a == null) continue;
                uvs[u] = new Vector2[a.Length];
                for (int i = 0; i < a.Length; i++) uvs[u][i] = new Vector2(a[i].x, a[i].y);
            }
            var w = Leer4(b, Canales.PESOS);
            var h = Leer4(b, Canales.HUESOS);
            if (w != null && h != null)
            {
                pesos = new BoneWeight[nVertices];
                for (int i = 0; i < nVertices; i++)
                    pesos[i] = new BoneWeight { weight0 = w[i].x, weight1 = w[i].y, weight2 = w[i].z, weight3 = w[i].w,
                        boneIndex0 = (int)h[i].x, boneIndex1 = (int)h[i].y, boneIndex2 = (int)h[i].z, boneIndex3 = (int)h[i].w };
            }
        }

        Vector3[] Leer3(byte[] b, int canal)
        {
            var a = Leer4(b, canal);
            if (a == null) return null;
            var r = new Vector3[a.Length];
            for (int i = 0; i < a.Length; i++) r[i] = a[i];
            return r;
        }

        Vector4[] Leer4(byte[] b, int canal)
        {
            var c = canales[canal];
            if (c.Dim == 0) return null;
            var r = new Vector4[nVertices];
            int paso = pasoStream[c.Stream], tam = CanalMalla.Tam(c.Formato);
            for (int i = 0; i < nVertices; i++)
            {
                int p = inicioStream[c.Stream] + i * paso + c.Offset;
                var v = new Vector4(0, 0, 0, 1);
                for (int k = 0; k < c.Dim && k < 4; k++) v[k] = Componente(b, p + k * tam, c.Formato);
                r[i] = v;
            }
            return r;
        }

        static float Componente(byte[] b, int p, int f)
        {
            if (p + CanalMalla.Tam(f) > b.Length) return 0;
            switch (f)
            {
                case 0: return BitConverter.ToSingle(b, p);
                case 1: return (float)BitConverter.ToHalf(b, p);
                case 2: return b[p] / 255f;
                case 3: return Math.Max((sbyte)b[p] / 127f, -1f);
                case 4: return BitConverter.ToUInt16(b, p) / 65535f;
                case 5: return Math.Max(BitConverter.ToInt16(b, p) / 32767f, -1f);
                case 6: return b[p];
                case 7: return (sbyte)b[p];
                case 8: return BitConverter.ToUInt16(b, p);
                case 9: return BitConverter.ToInt16(b, p);
                case 10: return BitConverter.ToUInt32(b, p);
                default: return BitConverter.ToInt32(b, p);
            }
        }

        // los arreglos cambiaron: armar de nuevo los bytes intercalados (un solo stream)
        void Rearmar()
        {
            if (!arreglosSucios) return;
            arreglosSucios = false;
            int n = pos?.Length ?? 0;
            nVertices = n;
            Array.Clear(canales, 0, canales.Length);
            int off = 0;
            void Canal(int c, int formato, int dim) { canales[c] = new CanalMalla { Stream = 0, Offset = (byte)off, Formato = (byte)formato, Dim = (byte)dim }; off += dim * CanalMalla.Tam(formato); }
            Canal(Canales.POSICION, 0, 3);
            if (nor != null && nor.Length == n) Canal(Canales.NORMAL, 0, 3);
            if (tan != null && tan.Length == n) Canal(Canales.TANGENTE, 0, 4);
            if (col != null && col.Length == n) Canal(Canales.COLOR, 2, 4);
            for (int u = 0; u < 8; u++) if (uvs[u] != null && uvs[u].Length == n) Canal(Canales.UV0 + u, 0, 2);
            if (pesos != null && pesos.Length == n) { Canal(Canales.PESOS, 0, 4); Canal(Canales.HUESOS, 11, 4); }
            int paso = off;
            var b = new byte[paso * n];
            for (int i = 0; i < n; i++)
            {
                int p = i * paso;
                Escribir(b, p + canales[Canales.POSICION].Offset, pos[i]);
                if (canales[Canales.NORMAL].Dim > 0) Escribir(b, p + canales[Canales.NORMAL].Offset, nor[i]);
                if (canales[Canales.TANGENTE].Dim > 0) Escribir(b, p + canales[Canales.TANGENTE].Offset, tan[i]);
                if (canales[Canales.COLOR].Dim > 0) { int q = p + canales[Canales.COLOR].Offset; b[q] = col[i].r; b[q + 1] = col[i].g; b[q + 2] = col[i].b; b[q + 3] = col[i].a; }
                for (int u = 0; u < 8; u++)
                    if (canales[Canales.UV0 + u].Dim > 0) { int q = p + canales[Canales.UV0 + u].Offset; Escribir(b, q, uvs[u][i].x); Escribir(b, q + 4, uvs[u][i].y); }
                if (canales[Canales.PESOS].Dim > 0)
                {
                    var w = pesos[i]; int q = p + canales[Canales.PESOS].Offset;
                    Escribir(b, q, new Vector4(w.weight0, w.weight1, w.weight2, w.weight3));
                    q = p + canales[Canales.HUESOS].Offset;
                    BitConverter.TryWriteBytes(new Span<byte>(b, q, 4), w.boneIndex0); BitConverter.TryWriteBytes(new Span<byte>(b, q + 4, 4), w.boneIndex1);
                    BitConverter.TryWriteBytes(new Span<byte>(b, q + 8, 4), w.boneIndex2); BitConverter.TryWriteBytes(new Span<byte>(b, q + 12, 4), w.boneIndex3);
                }
            }
            crudo2 = b;
            recursoVertices = -1;
            CalcularStreams();
            version++;
        }

        static void Escribir(byte[] b, int p, float f) => BitConverter.TryWriteBytes(new Span<byte>(b, p, 4), f);
        static void Escribir(byte[] b, int p, Vector3 v) { Escribir(b, p, v.x); Escribir(b, p + 4, v.y); Escribir(b, p + 8, v.z); }
        static void Escribir(byte[] b, int p, Vector4 v) { Escribir(b, p, v.x); Escribir(b, p + 4, v.y); Escribir(b, p + 8, v.z); Escribir(b, p + 12, v.w); }

        void Cambio() { Arreglos(); arreglosSucios = true; version++; }

        // ── API de Unity ──
        public int vertexCount => hayArreglos ? pos?.Length ?? 0 : nVertices;
        public int subMeshCount
        {
            get => submallas.Length;
            set
            {
                if (value == submallas.Length) return;
                var n = new Submalla[Math.Max(0, value)];
                Array.Copy(submallas, n, Math.Min(n.Length, submallas.Length));
                submallas = n; version++;
            }
        }
        public Bounds bounds { get => limites; set => limites = value; }
        public bool isReadable => legible;

        public Vector3[] vertices { get { Arreglos(); return (Vector3[])(pos ?? Array.Empty<Vector3>()).Clone(); } set { Arreglos(); pos = value == null ? null : (Vector3[])value.Clone(); arreglosSucios = true; version++; } }
        public Vector3[] normals { get { Arreglos(); return (Vector3[])(nor ?? Array.Empty<Vector3>()).Clone(); } set { Arreglos(); nor = value == null ? null : (Vector3[])value.Clone(); arreglosSucios = true; version++; } }
        public Vector4[] tangents { get { Arreglos(); return (Vector4[])(tan ?? Array.Empty<Vector4>()).Clone(); } set { Arreglos(); tan = value == null ? null : (Vector4[])value.Clone(); arreglosSucios = true; version++; } }
        public Vector2[] uv { get => Uv(0); set => PonerUv(0, value); }
        public Vector2[] uv2 { get => Uv(1); set => PonerUv(1, value); }
        public Vector2[] uv3 { get => Uv(2); set => PonerUv(2, value); }
        public Vector2[] uv4 { get => Uv(3); set => PonerUv(3, value); }
        public BoneWeight[] boneWeights { get { Arreglos(); return (BoneWeight[])(pesos ?? Array.Empty<BoneWeight>()).Clone(); } set { Arreglos(); pesos = value; arreglosSucios = true; version++; } }
        public Matrix4x4[] bindposes { get => (Matrix4x4[])poses.Clone(); set => poses = value == null ? Array.Empty<Matrix4x4>() : (Matrix4x4[])value.Clone(); }

        Vector2[] Uv(int i) { Arreglos(); return (Vector2[])(uvs[i] ?? Array.Empty<Vector2>()).Clone(); }
        void PonerUv(int i, Vector2[] v) { Arreglos(); uvs[i] = v == null ? null : (Vector2[])v.Clone(); arreglosSucios = true; version++; }

        public Color[] colors
        {
            get { Arreglos(); if (col == null) return Array.Empty<Color>(); var r = new Color[col.Length]; for (int i = 0; i < r.Length; i++) r[i] = col[i]; return r; }
            set { Arreglos(); if (value == null) col = null; else { col = new Color32[value.Length]; for (int i = 0; i < value.Length; i++) col[i] = value[i]; } arreglosSucios = true; version++; }
        }

        public Color32[] colors32 { get { Arreglos(); return (Color32[])(col ?? Array.Empty<Color32>()).Clone(); } set { Arreglos(); col = value == null ? null : (Color32[])value.Clone(); arreglosSucios = true; version++; } }

        public void SetVertices(List<Vector3> inVertices) => vertices = inVertices?.ToArray();
        public void SetNormals(List<Vector3> inNormals) => normals = inNormals?.ToArray();
        public void SetTangents(List<Vector4> inTangents) => tangents = inTangents?.ToArray();
        public void SetColors(List<Color32> inColors) => colors32 = inColors?.ToArray();
        public void SetColors(List<Color> inColors) => colors = inColors?.ToArray();
        public void SetUVs(int channel, List<Vector2> uvs) { if (channel >= 0 && channel < 8) PonerUv(channel, uvs?.ToArray()); }

        public void SetUVs(int channel, List<Vector4> uvs)
        {
            if (channel < 0 || channel >= 8) return;
            if (uvs == null) { PonerUv(channel, null); return; }
            var a = new Vector2[uvs.Count];
            for (int i = 0; i < a.Length; i++) a[i] = new Vector2(uvs[i].x, uvs[i].y);
            PonerUv(channel, a);
        }

        public void GetVertices(List<Vector3> l) { l.Clear(); Arreglos(); if (pos != null) l.AddRange(pos); }
        public void GetNormals(List<Vector3> l) { l.Clear(); Arreglos(); if (nor != null) l.AddRange(nor); }
        public void GetUVs(int channel, List<Vector2> l) { l.Clear(); Arreglos(); if (uvs[channel] != null) l.AddRange(uvs[channel]); }

        public int[] triangles
        {
            get
            {
                var l = new List<int>();
                for (int s = 0; s < submallas.Length; s++) if (submallas[s].Topologia == 0) l.AddRange(GetIndices(s));
                return l.ToArray();
            }
            set
            {
                submallas = new[] { new Submalla { Primero = 0, Cantidad = value?.Length ?? 0, Topologia = 0 } };
                PonerIndices(new List<int[]> { value ?? Array.Empty<int>() });
                RecalcularLimitesSiHace();
            }
        }

        public int[] GetTriangles(int submesh) => GetIndices(submesh);

        public int[] GetIndices(int submesh)
        {
            if (submesh < 0 || submesh >= submallas.Length || indices == null) return Array.Empty<int>();
            var s = submallas[submesh];
            var r = new int[s.Cantidad];
            for (int i = 0; i < s.Cantidad; i++)
            {
                int k = s.Primero + i;
                int v = indices32 ? BitConverter.ToInt32(indices, k * 4) : BitConverter.ToUInt16(indices, k * 2);
                r[i] = v + s.BaseVertice;
            }
            return r;
        }

        public void SetTriangles(int[] triangles, int submesh) => SetIndices(triangles, MeshTopology.Triangles, submesh);
        public void SetTriangles(List<int> triangles, int submesh) => SetIndices(triangles?.ToArray(), MeshTopology.Triangles, submesh);
        public void SetIndices(int[] indices, MeshTopology topology, int submesh) => SetIndices(indices, topology, submesh, true);

        public void SetIndices(int[] nuevos, MeshTopology topology, int submesh, bool calculateBounds)
        {
            if (submesh >= submallas.Length) subMeshCount = submesh + 1;
            var todos = new List<int[]>();
            for (int s = 0; s < submallas.Length; s++) todos.Add(s == submesh ? (nuevos ?? Array.Empty<int>()) : GetIndices(s));
            for (int s = 0; s < submallas.Length; s++) submallas[s].BaseVertice = 0;
            submallas[submesh].Topologia = (int)topology;
            PonerIndices(todos);
            if (calculateBounds) RecalcularLimitesSiHace();
        }

        void PonerIndices(List<int[]> porSubmalla)
        {
            int total = 0, max = 0;
            foreach (var a in porSubmalla) { total += a.Length; foreach (var v in a) if (v > max) max = v; }
            indices32 = max > 65535;
            indices = new byte[total * (indices32 ? 4 : 2)];
            int k = 0;
            for (int s = 0; s < porSubmalla.Count; s++)
            {
                submallas[s].Primero = k;
                submallas[s].Cantidad = porSubmalla[s].Length;
                submallas[s].BaseVertice = 0;
                foreach (var v in porSubmalla[s])
                {
                    if (indices32) BitConverter.TryWriteBytes(new Span<byte>(indices, k * 4, 4), v);
                    else BitConverter.TryWriteBytes(new Span<byte>(indices, k * 2, 2), (ushort)v);
                    k++;
                }
            }
            version++;
        }

        void RecalcularLimitesSiHace() { Arreglos(); if (pos != null && pos.Length > 0) RecalculateBounds(); }

        public void Clear() => Clear(true);

        public void Clear(bool keepVertexLayout)
        {
            pos = nor = null; tan = null; col = null; pesos = null;
            for (int i = 0; i < 8; i++) uvs[i] = null;
            hayArreglos = true; arreglosSucios = true;
            indices = null; submallas = new[] { new Submalla() };
            limites = default;
            crudo2 = null; recursoVertices = -1; nVertices = 0;
            version++;
        }

        public void RecalculateBounds()
        {
            Arreglos();
            if (pos == null || pos.Length == 0) { limites = default; return; }
            Vector3 mn = pos[0], mx = pos[0];
            foreach (var p in pos) { mn = Vector3.Min(mn, p); mx = Vector3.Max(mx, p); }
            limites = new Bounds((mn + mx) * 0.5f, mx - mn);
            for (int s = 0; s < submallas.Length; s++) submallas[s].Limites = limites;
        }

        public void RecalculateNormals()
        {
            Arreglos();
            if (pos == null) return;
            var n = new Vector3[pos.Length];
            for (int s = 0; s < submallas.Length; s++)
            {
                if (submallas[s].Topologia != 0) continue;
                var t = GetIndices(s);
                for (int i = 0; i + 2 < t.Length; i += 3)
                {
                    var a = pos[t[i]]; var b = pos[t[i + 1]]; var c = pos[t[i + 2]];
                    var f = Vector3.Cross(b - a, c - a);
                    n[t[i]] += f; n[t[i + 1]] += f; n[t[i + 2]] += f;
                }
            }
            for (int i = 0; i < n.Length; i++) n[i] = n[i].normalized;
            nor = n;
            arreglosSucios = true; version++;
        }

        public void RecalculateTangents() { }
        public void MarkDynamic() { }
        public void UploadMeshData(bool markNoLongerReadable) { if (markNoLongerReadable) legible = false; }

        public void CombineMeshes(CombineInstance[] combine) => CombineMeshes(combine, true, true);
        public void CombineMeshes(CombineInstance[] combine, bool mergeSubMeshes) => CombineMeshes(combine, mergeSubMeshes, true);

        public void CombineMeshes(CombineInstance[] combine, bool mergeSubMeshes, bool useMatrices)
        {
            var vs = new List<Vector3>(); var ns = new List<Vector3>(); var ts = new List<Vector4>(); var cs = new List<Color32>();
            var u0 = new List<Vector2>(); var u1 = new List<Vector2>();
            var tris = new List<int[]>();
            var unidos = new List<int>();
            bool hayN = true, hayT = true, hayC = true, hayU0 = true, hayU1 = true;
            foreach (var ci in combine)
            {
                var m = ci.mesh;
                if ((object)m == null) continue;
                m.Arreglos();
                int b = vs.Count;
                var mt = useMatrices ? ci.transform : Matrix4x4.identity;
                var mn = mt.inverse.transpose;
                foreach (var p in m.pos ?? Array.Empty<Vector3>()) vs.Add(mt.MultiplyPoint3x4(p));
                int n = m.pos?.Length ?? 0;
                if (m.nor != null && m.nor.Length == n) foreach (var x in m.nor) ns.Add(mn.MultiplyVector(x).normalized); else hayN = false;
                if (m.tan != null && m.tan.Length == n) foreach (var x in m.tan) { var d = mt.MultiplyVector(x).normalized; ts.Add(new Vector4(d.x, d.y, d.z, x.w)); } else hayT = false;
                if (m.col != null && m.col.Length == n) cs.AddRange(m.col); else hayC = false;
                if (m.uvs[0] != null && m.uvs[0].Length == n) u0.AddRange(m.uvs[0]); else hayU0 = false;
                if (m.uvs[1] != null && m.uvs[1].Length == n) u1.AddRange(m.uvs[1]); else hayU1 = false;
                var idx = m.GetIndices(Math.Clamp(ci.subMeshIndex, 0, Math.Max(0, m.submallas.Length - 1)));
                for (int i = 0; i < idx.Length; i++) idx[i] += b;
                if (mergeSubMeshes) unidos.AddRange(idx); else tris.Add(idx);
            }
            Clear();
            pos = vs.ToArray();
            if (hayN) nor = ns.ToArray();
            if (hayT) tan = ts.ToArray();
            if (hayC) col = cs.ToArray();
            if (hayU0) uvs[0] = u0.ToArray();
            if (hayU1) uvs[1] = u1.ToArray();
            if (mergeSubMeshes) tris = new List<int[]> { unidos.ToArray() };
            submallas = new Submalla[tris.Count];
            PonerIndices(tris);
            RecalculateBounds();
        }

        internal override Object ClonarAsset()
        {
            var m = new Mesh();
            Arreglos();
            m.pos = (Vector3[])pos?.Clone(); m.nor = (Vector3[])nor?.Clone(); m.tan = (Vector4[])tan?.Clone(); m.col = (Color32[])col?.Clone();
            for (int i = 0; i < 8; i++) m.uvs[i] = (Vector2[])uvs[i]?.Clone();
            m.pesos = (BoneWeight[])pesos?.Clone();
            m.poses = (Matrix4x4[])poses.Clone();
            m.hayArreglos = true; m.arreglosSucios = true;
            m.indices = (byte[])indices?.Clone(); m.indices32 = indices32;
            m.submallas = (Submalla[])submallas.Clone();
            m.limites = limites;
            return m;
        }

        // ── GPU ──
        internal uint vbo, ibo;
        int versionGpu = -1;
        long firmaGpu;
        readonly Dictionary<int, uint> vaos = new Dictionary<int, uint>();

        // true si se puede dibujar (los datos ya llegaron y están en la GPU)
        internal unsafe bool Lista()
        {
            if (versionGpu == version && vbo != 0) return true;
            if (hayArreglos) Rearmar();
            var b = Crudo();
            if (b == null || indices == null || nVertices == 0) return false;
            long firma = Firma();
            int nb = bytesUsados >= 0 ? bytesUsados : b.Length, ni = indicesUsados >= 0 ? indicesUsados : indices.Length;
            if (vbo != 0 && ibo != 0 && firma == firmaGpu)
            {
                // la misma disposición de canales (una malla que el juego rearma seguido, como la
                // de la UI): se pisan los datos y los VAO siguen sirviendo
                Gpu.UsarVao(0);
                Gl.BindBuffer(Gl.ARRAY_BUFFER, vbo);
                fixed (byte* p = b) Gl.BufferData(Gl.ARRAY_BUFFER, nb, p, Gl.DYNAMIC_DRAW);
                Gl.BindBuffer(Gl.ELEMENT_ARRAY_BUFFER, ibo);
                fixed (byte* p = indices) Gl.BufferData(Gl.ELEMENT_ARRAY_BUFFER, ni, p, Gl.DYNAMIC_DRAW);
                versionGpu = version;
                return true;
            }
            LiberarGpu();
            fixed (byte* p = b) vbo = Gpu.Buffer(Gl.ARRAY_BUFFER, p, nb, Gl.STATIC_DRAW);
            fixed (byte* p = indices) ibo = Gpu.Buffer(Gl.ELEMENT_ARRAY_BUFFER, p, ni, Gl.STATIC_DRAW);
            versionGpu = version;
            firmaGpu = firma;
            // si nadie lee los vértices, no hace falta guardarlos también en la CPU (salvo los que
            // no se pueden volver a pedir: un MeshCollider puede necesitarlos después)
            if (!legible && !hayArreglos && recursoOrigen >= 0) crudo2 = null;
            return true;
        }

        // lo que queda guardado en los VAO: dónde está cada canal (sólo de los streams que se usan)
        long Firma()
        {
            long h = 17;
            for (int i = 0; i < Canales.CANTIDAD; i++)
            {
                var c = canales[i];
                h = h * 31 + (c.Dim == 0 ? 0 : c.Stream | c.Offset << 8 | c.Formato << 16 | c.Dim << 24);
            }
            for (int s = 0; s < 4; s++)
                if (pasoStream[s] > 0) h = h * 31 + ((long)pasoStream[s] << 32 | (uint)inicioStream[s]);
            return h;
        }

        unsafe void LiberarGpu()
        {
            if (!Gpu.Activo) return;
            foreach (var v in vaos.Values) { uint x = v; Gl.DeleteVertexArrays(1, &x); }
            vaos.Clear();
            faltantes.Clear();
            Gpu.OlvidarVao();
            Gpu.Borrar(ref vbo);
            Gpu.Borrar(ref ibo);
        }

        internal override void AlLiberar() => LiberarGpu();

        // los atributos que el programa pide y la malla no tiene: su valor fijo (blanco el color,
        // como Unity) no es estado del VAO sino del contexto, así que va en cada dibujo
        readonly Dictionary<int, int[]> faltantes = new Dictionary<int, int[]>();

        void Faltantes(int clave)
        {
            if (!faltantes.TryGetValue(clave, out var l)) return;
            foreach (int x in l)
            {
                if (x < 0) Gpu.Generico(~x, 1, 1, 1, 1);
                else Gpu.Generico(x, 0, 0, 0, 1);
            }
        }

        // el VAO de esta malla para un programa (los atributos que pide, con los canales que hay)
        internal unsafe uint Vao(Programa p, uint vboAlternativo = 0)
        {
            int clave = p.Serie * 4 + (vboAlternativo != 0 ? 1 : 0);
            if (vboAlternativo == 0 && vaos.TryGetValue(clave, out var v)) { Faltantes(clave); return v; }
            uint vao;
            if (vboAlternativo != 0 && vaos.TryGetValue(clave, out vao)) { }
            else { Gl.GenVertexArrays(1, &vao); vaos[clave] = vao; }
            Gpu.UsarVao(vao);
            var falta = new List<int>();
            for (int c = 0; c < Canales.CANTIDAD; c++)
            {
                int loc = p.Atributos[c];
                if (loc < 0) continue;
                var ch = canales[c];
                if (ch.Dim == 0)
                {
                    Gl.DisableVertexAttribArray((uint)loc);
                    falta.Add(c == Canales.COLOR ? ~loc : loc);
                    continue;
                }
                // los canales de posición, normal y tangente salen del buffer de piel si lo hay
                bool dePiel = vboAlternativo != 0 && (c == Canales.POSICION || c == Canales.NORMAL || c == Canales.TANGENTE);
                Gl.BindBuffer(Gl.ARRAY_BUFFER, dePiel ? vboAlternativo : vbo);
                Gl.EnableVertexAttribArray((uint)loc);
                int paso = dePiel ? 40 : pasoStream[ch.Stream];
                nint desde = dePiel ? (c == Canales.POSICION ? 0 : c == Canales.NORMAL ? 12 : 24) : inicioStream[ch.Stream] + ch.Offset;
                if (ch.Entero && !dePiel) Gl.VertexAttribIPointer((uint)loc, ch.Dim, ch.TipoGl, paso, desde);
                else Gl.VertexAttribPointer((uint)loc, dePiel ? (c == Canales.TANGENTE ? 4 : 3) : ch.Dim, dePiel ? Gl.FLOAT : ch.TipoGl, (byte)(!dePiel && ch.Normalizado ? 1 : 0), paso, desde);
            }
            Gl.BindBuffer(Gl.ELEMENT_ARRAY_BUFFER, ibo);
            faltantes[clave] = falta.ToArray();
            Faltantes(clave);
            return vao;
        }

        // geometría que se arma cada cuadro en un solo stream (los canales ya puestos): se pisan los
        // arreglos sin copiarlos y en la GPU se sube sólo lo usado
        internal void PonerDinamica(byte[] vertices, int nv, int paso, byte[] idx, int ni, bool i32, Bounds limitesMundo)
        {
            crudo2 = vertices;
            recursoVertices = -1;
            nVertices = nv;
            bytesUsados = nv * paso;
            indices = idx;
            indices32 = i32;
            indicesUsados = ni * (i32 ? 4 : 2);
            limites = limitesMundo;
            CalcularStreams();
            version++;
        }

        internal uint TipoIndice => indices32 ? Gl.UNSIGNED_INT : Gl.UNSIGNED_SHORT;
        internal int TamIndice => indices32 ? 4 : 2;
    }

    public struct BoneWeight
    {
        public float weight0, weight1, weight2, weight3;
        public int boneIndex0, boneIndex1, boneIndex2, boneIndex3;
    }

    public partial struct CombineInstance
    {
        public Mesh mesh { get; set; }
        public int subMeshIndex { get; set; }
        public Matrix4x4 transform { get; set; }
        public Vector4 lightmapScaleOffset { get; set; }
        public Vector4 realtimeLightmapScaleOffset { get; set; }
    }

    public sealed partial class MeshFilter : Component
    {
        internal Mesh malla;

        internal override void LeerNativo(Mapa m, IResolutor r) => malla = r.Resolver(m.P("m_Mesh")) as Mesh;
        internal override void CopiarDe(Object o, Func<Object, Object> remap) => malla = ((MeshFilter)o).malla;

        public Mesh sharedMesh { get => malla; set { malla = value; propia = false; } }

        // como en Unity: pedir .mesh hace una copia propia (si todavía no lo es)
        public Mesh mesh
        {
            get
            {
                if ((object)malla == null) return null;
                if (malla.archivo != null || !propia) { malla = (Mesh)malla.ClonarAsset(); malla.m_Name = (malla.m_Name ?? "") + " Instance"; propia = true; }
                return malla;
            }
            set { malla = value; propia = true; }
        }
        bool propia;
    }
}

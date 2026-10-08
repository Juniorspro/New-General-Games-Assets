using System;
using System.Collections.Generic;
using Porteo;
using Porteo.Datos;

namespace UnityEngine
{
    // Los datos de un terreno: la grilla de alturas en enteros de 16 bits (0..32766 es 0..alto) y
    // las capas de textura. La física arma con la grilla el heightfield de PhysX.
    public sealed partial class TerrainData : Object
    {
        // el máximo de Unity para una altura (Heightmap::kMaxHeight): 1.0 en GetHeights
        internal const float MAXIMO = 32766f;

        internal short[] alturas = Array.Empty<short>();
        internal int resolucion;                       // la grilla es cuadrada (2^n + 1 muestras por lado)
        internal Vector3 escala = Vector3.one;         // m_Scale: lo que mide una celda en x/z y el alto total en y
        internal int resolucionAlfa = 16;
        internal Texture2D[] texturasAlfa = Array.Empty<Texture2D>();
        internal int capas;
        internal int version = 1;

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            var h = m.M("m_Heightmap");
            if (h != null)
            {
                resolucion = h.I32("m_Width");
                escala = Serial.V3(h.M("m_Scale"));
                alturas = Cortos(h["m_Heights"], r) ?? Array.Empty<short>();
            }
            var s = m.M("m_SplatDatabase");
            if (s != null)
            {
                resolucionAlfa = s.I32("m_AlphamapResolution", 16);
                var ta = s.L("m_AlphaTextures");
                if (ta != null)
                {
                    texturasAlfa = new Texture2D[ta.Count];
                    for (int i = 0; i < ta.Count; i++) texturasAlfa[i] = ta[i] is PPtr p ? r.Resolver(p) as Texture2D : null;
                }
                // Unity 2018.3+ guarda las capas como TerrainLayer; antes, como SplatPrototype
                capas = s.L("m_TerrainLayers")?.Count ?? s.L("m_Splats")?.Count ?? 0;
            }
        }

        static short[] Cortos(object o, IResolutor r)
        {
            switch (o)
            {
                case short[] a: return a;
                case ushort[] a: { var c = new short[a.Length]; Buffer.BlockCopy(a, 0, c, 0, a.Length * 2); return c; }
                case byte[] b: { var c = new short[b.Length / 2]; Buffer.BlockCopy(b, 0, c, 0, c.Length * 2); return c; }
                case Recurso rec: return Cortos(Paquete.ArregloDeRecurso(r.Recurso(rec.Id)), r);
                case List<object> l: { var c = new short[l.Count]; for (int i = 0; i < c.Length; i++) c[i] = (short)Convert.ToInt32(l[i]); return c; }
                case Array a: { var c = new short[a.Length]; for (int i = 0; i < c.Length; i++) c[i] = (short)Convert.ToInt32(a.GetValue(i)); return c; }
                default: return null;
            }
        }

        internal Vector3 tam => new Vector3(escala.x * (resolucion - 1), escala.y, escala.z * (resolucion - 1));

        // PhysX recorre las filas por x y las columnas por z; Unity guarda las filas por z
        internal short[] AlturasFisica()
        {
            int n = resolucion;
            if (n < 2 || alturas.Length < n * n) return null;
            var a = new short[n * n];
            for (int f = 0; f < n; f++)
                for (int c = 0; c < n; c++)
                    a[f * n + c] = alturas[c * n + f];
            return a;
        }

        public int heightmapWidth => resolucion;
        public int heightmapHeight => resolucion;
        public int heightmapResolution => resolucion;
        public Vector3 size => tam;
        public int alphamapWidth => resolucionAlfa;
        public int alphamapHeight => resolucionAlfa;
        public int alphamapLayers => capas;
        public SplatPrototype[] splatPrototypes
        {
            get
            {
                var r = new SplatPrototype[capas];
                for (int i = 0; i < r.Length; i++) r[i] = new SplatPrototype();
                return r;
            }
        }

        void Fuera() => throw new ArgumentException("Trying to access out-of-bounds terrain height information.");

        public float[,] GetHeights(int xBase, int yBase, int width, int height)
        {
            int n = resolucion;
            if (xBase < 0 || yBase < 0 || width < 0 || height < 0 || xBase + width > n || yBase + height > n) Fuera();
            var r = new float[height, width];
            for (int y = 0; y < height; y++)
                for (int x = 0; x < width; x++)
                    r[y, x] = alturas[(yBase + y) * n + xBase + x] / MAXIMO;
            return r;
        }

        public float GetHeight(int x, int y)
        {
            int n = resolucion;
            x = Math.Clamp(x, 0, n - 1); y = Math.Clamp(y, 0, n - 1);
            return n > 0 ? alturas[y * n + x] / MAXIMO * escala.y : 0;
        }

        // la altura en metros con interpolación bilineal (x, y normalizados en el terreno)
        public float GetInterpolatedHeight(float x, float y)
        {
            int n = resolucion;
            if (n < 2) return 0;
            float fx = Math.Clamp(x, 0, 1) * (n - 1), fy = Math.Clamp(y, 0, 1) * (n - 1);
            int x0 = Math.Min((int)fx, n - 2), y0 = Math.Min((int)fy, n - 2);
            float tx = fx - x0, ty = fy - y0;
            float a = alturas[y0 * n + x0], b = alturas[y0 * n + x0 + 1];
            float c = alturas[(y0 + 1) * n + x0], d = alturas[(y0 + 1) * n + x0 + 1];
            return ((a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty) / MAXIMO * escala.y;
        }

        public void SetHeights(int xBase, int yBase, float[,] heights)
        {
            if (heights == null) throw new NullReferenceException();
            int n = resolucion, alto = heights.GetLength(0), ancho = heights.GetLength(1);
            if (xBase < 0 || yBase < 0 || xBase + ancho > n || yBase + alto > n) Fuera();
            for (int y = 0; y < alto; y++)
                for (int x = 0; x < ancho; x++)
                    alturas[(yBase + y) * n + xBase + x] = (short)Math.Clamp(Math.Round(heights[y, x] * MAXIMO), 0, MAXIMO);
            version++;
            Porteo.Fisica.Simulacion.TerrenoCambiado(this);
        }

        // cuatro capas por textura de mezcla (RGBA), como las guarda Unity
        public float[,,] GetAlphamaps(int x, int y, int width, int height)
        {
            if (x < 0 || y < 0 || width < 0 || height < 0 || x + width > resolucionAlfa || y + height > resolucionAlfa)
                throw new ArgumentException("Invalid argument for GetAlphaMaps");
            var r = new float[height, width, capas];
            for (int k = 0; k < capas; k++)
            {
                var t = k / 4 < texturasAlfa.Length ? texturasAlfa[k / 4] : null;
                if (t == null) continue;
                for (int j = 0; j < height; j++)
                    for (int i = 0; i < width; i++)
                    {
                        var c = t.GetPixel(x + i, y + j);
                        r[j, i, k] = (k & 3) switch { 0 => c.r, 1 => c.g, 2 => c.b, _ => c.a };
                    }
            }
            return r;
        }
    }

    public sealed partial class Terrain : Behaviour
    {
        internal TerrainData datos;
        internal int indiceLuz = 0xFFFF;
        internal bool sombras = true;
        Terrain izquierda, arriba, derecha, abajo;

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            datos = r.Resolver(m.P("m_TerrainData")) as TerrainData;
            indiceLuz = m.I32("m_LightmapIndex", 0xFFFF);
            sombras = m.B("m_CastShadows", true);
        }

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            base.CopiarDe(o, remap);
            var t = (Terrain)o;
            datos = t.datos; indiceLuz = t.indiceLuz; sombras = t.sombras;
        }

        public TerrainData terrainData { get => datos; set => datos = value; }
        public int lightmapIndex { get => indiceLuz; set => indiceLuz = value; }
        public bool castShadows { get => sombras; set => sombras = value; }

        public void SetNeighbors(Terrain left, Terrain top, Terrain right, Terrain bottom)
        {
            izquierda = left; arriba = top; derecha = right; abajo = bottom;
        }

        // la altura del terreno en un punto del mundo (relativa a la posición del terreno, como en Unity)
        public float SampleHeight(Vector3 worldPosition)
        {
            if (datos == null) return 0;
            var p = worldPosition - transform.position;
            var t = datos.tam;
            return datos.GetInterpolatedHeight(t.x > 0 ? p.x / t.x : 0, t.z > 0 ? p.z / t.z : 0);
        }
    }
}

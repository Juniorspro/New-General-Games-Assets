using System;
using System.Collections.Generic;
using UnityEngine;

namespace Porteo.Render
{
    // Las luces de cada objeto, como en el forward de Unity: la direccional principal en la pasada
    // base; las más importantes (hasta pixelLightCount, contando la principal y las Important) por
    // píxel en pasadas extra; las 4 siguientes puntuales por vértice (VERTEXLIGHT_ON); el resto se
    // ignora (Unity las suma a los armónicos del objeto). La importancia es la de Unity: la caída de
    // la luz en el centro de la caja del objeto, así que en un objeto enorme (todas las paredes de
    // una casa en una malla) las luces lejos del centro quedan por vértice aunque estén al lado de
    // la cámara; y las luces que no tocan lo que ve la cámara no cuentan. Los objetos con las mismas
    // luces comparten configuración, así se pueden dibujar juntos.
    public static class LucesObjeto
    {
        public sealed class Conf
        {
            public Light Principal;
            public readonly Light[] Vertice = new Light[4];
            public int NVertice;
            public readonly Light[] Pixel = new Light[8];
            public int NPixel;

            public void Vertices(Tabla t, int idX, int idY, int idZ, int idAt, int idColor)
            {
                Vector4 x = default, y = default, z = default, at = default;
                var col = new float[8 * 4];
                for (int i = 0; i < NVertice; i++)
                {
                    var l = Vertice[i];
                    var p = l.transform.position;
                    x[i] = p.x; y[i] = p.y; z[i] = p.z;
                    at[i] = 25f / Math.Max(l.rango * l.rango, 1e-6f);
                    var c = l.colorLuz * l.intensidad;
                    col[i * 4] = c.r; col[i * 4 + 1] = c.g; col[i * 4 + 2] = c.b; col[i * 4 + 3] = 1;
                }
                // sin luces: atenuación enorme (no aportan nada)
                for (int i = NVertice; i < 4; i++) at[i] = 1e8f;
                t.Poner(idX, Valor.Vec(x)); t.Poner(idY, Valor.Vec(y)); t.Poner(idZ, Valor.Vec(z)); t.Poner(idAt, Valor.Vec(at));
                t.Poner(idColor, new Valor { Tipo = TipoValor.Vectores, O = col });
            }
        }

        static readonly List<Conf> confs = new List<Conf>();
        static readonly Dictionary<long, int> porClave = new Dictionary<long, int>();
        static readonly Light[] principales = new Light[32];
        static readonly bool[] principalHecha = new bool[32];
        static readonly List<Light> direccionales = new List<Light>();
        // las puntuales y spot en una grilla de celdas de LADO metros
        const float LADO = 24f;
        static readonly Dictionary<long, List<Light>> grilla = new Dictionary<long, List<Light>>();
        static readonly List<List<Light>> sobrantes = new List<List<Light>>();
        // todas las puntuales y spot que cuentan (para los objetos enormes, sin recorrer la grilla)
        static readonly List<Light> puntuales = new List<Light>();
        static int pixeles;

        // planos: los de la cámara (Gribb-Hartmann, normales hacia adentro); sin planos no se descarta
        // ninguna luz por estar fuera de vista
        public static void Empezar(Camera cam, Plane[] planos = null)
        {
            confs.Clear();
            porClave.Clear();
            Array.Clear(principalHecha, 0, 32);
            direccionales.Clear();
            puntuales.Clear();
            foreach (var l in grilla.Values) { l.Clear(); sobrantes.Add(l); }
            grilla.Clear();
            pixeles = QualitySettings.pixelLightCount;
            foreach (var l in Luces.activas)
            {
                if (l.destruido || l.intensidad <= 0) continue;
                if (l.tipo == LightType.Directional) { direccionales.Add(l); continue; }
                if (l.tipo != LightType.Point && l.tipo != LightType.Spot) continue;
                var p = l.transform.position;
                float r = l.rango;
                // fuera de lo que ve la cámara no ilumina nada visible, y Unity no la cuenta: si no,
                // le quita su lugar por píxel a otra en los objetos enormes
                if (planos != null && FueraDeVista(planos, p, r)) continue;
                puntuales.Add(l);
                int x0 = Celda(p.x - r), x1 = Celda(p.x + r), y0 = Celda(p.y - r), y1 = Celda(p.y + r), z0 = Celda(p.z - r), z1 = Celda(p.z + r);
                for (int x = x0; x <= x1; x++)
                    for (int y = y0; y <= y1; y++)
                        for (int z = z0; z <= z1; z++)
                        {
                            long k = Clave(x, y, z);
                            if (!grilla.TryGetValue(k, out var lista))
                            {
                                if (sobrantes.Count > 0) { lista = sobrantes[sobrantes.Count - 1]; sobrantes.RemoveAt(sobrantes.Count - 1); }
                                else lista = new List<Light>(4);
                                grilla[k] = lista;
                            }
                            lista.Add(l);
                        }
            }
        }

        static bool FueraDeVista(Plane[] planos, Vector3 p, float r)
        {
            for (int i = 0; i < planos.Length; i++)
                if (Vector3.Dot(planos[i].normal, p) + planos[i].distance < -r) return true;
            return false;
        }

        static int Celda(float v) => (int)Math.Floor(v / LADO);
        static long Clave(int x, int y, int z) => ((long)(x & 0x1FFFFF) << 42) | ((long)(y & 0x1FFFFF) << 21) | (uint)(z & 0x1FFFFF);

        public static Conf Config(int i) => i >= 0 && i < confs.Count ? confs[i] : vacia;
        static readonly Conf vacia = new Conf();

        static Light Principal(int capa)
        {
            if (!principalHecha[capa]) { principales[capa] = Luces.Principal(capa); principalHecha[capa] = true; }
            return principales[capa];
        }

        static readonly List<(Light l, float imp)> candidatas = new List<(Light, float)>(16);
        static readonly HashSet<Light> vistas = new HashSet<Light>();

        // una puntual o spot para el objeto de caja c±e: si su esfera toca la caja, con la
        // importancia de Unity (su caída en el centro de la caja; las Important primero)
        static void Considerar(Light l, int bit, Vector3 c, Vector3 e)
        {
            if ((l.mascara & bit) == 0 || !vistas.Add(l)) return;
            var p = l.transform.position;
            float r2 = Math.Max(l.rango * l.rango, 1e-6f);
            float dx = Math.Max(Math.Abs(p.x - c.x) - e.x, 0), dy = Math.Max(Math.Abs(p.y - c.y) - e.y, 0), dz = Math.Max(Math.Abs(p.z - c.z) - e.z, 0);
            if (dx * dx + dy * dy + dz * dz >= r2) return;
            float cx = p.x - c.x, cy = p.y - c.y, cz = p.z - c.z;
            float imp = l.Brillo / (1f + 25f * (cx * cx + cy * cy + cz * cz) / r2);
            if (l.modo == LightRenderMode.ForcePixel) imp += 1000;
            candidatas.Add((l, imp));
        }

        public static int Para(Renderer r, in Bounds b)
        {
            int capa = r.go.capa;
            int bit = 1 << capa;
            var principal = Principal(capa);
            candidatas.Clear();
            vistas.Clear();
            foreach (var l in direccionales)
                if (l != principal && (l.mascara & bit) != 0) candidatas.Add((l, l.Brillo + (l.modo == LightRenderMode.ForcePixel ? 1000 : 0)));
            var c = b.center; var e = b.extents;
            int x0 = Celda(c.x - e.x), x1 = Celda(c.x + e.x), y0 = Celda(c.y - e.y), y1 = Celda(c.y + e.y), z0 = Celda(c.z - e.z), z1 = Celda(c.z + e.z);
            // objetos enormes (terreno, las paredes de toda una casa): todas las luces en vez de
            // recorrer cientos de celdas. Mirar sólo la celda del centro dejaba afuera a las que
            // están lejos de él (a las paredes de Bad Parenting les llegaba sólo la de la cocina)
            if ((long)(x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 64)
                foreach (var l in puntuales) Considerar(l, bit, c, e);
            else
                for (int x = x0; x <= x1; x++)
                    for (int y = y0; y <= y1; y++)
                        for (int z = z0; z <= z1; z++)
                            if (grilla.TryGetValue(Clave(x, y, z), out var lista))
                                foreach (var l in lista) Considerar(l, bit, c, e);
            candidatas.Sort((a, b2) => b2.imp.CompareTo(a.imp));
            var conf = new Conf { Principal = principal };
            // la principal y las Important también ocupan lugar: "si con eso hay menos luces que
            // pixelLightCount, más luces van por píxel" (Unity, Forward Rendering Path Details)
            int libres = pixeles - (principal != null ? 1 : 0);
            foreach (var (l, imp) in candidatas)
                if (l.modo == LightRenderMode.ForcePixel) libres--;
            foreach (var (l, imp) in candidatas)
            {
                bool forzarPixel = l.modo == LightRenderMode.ForcePixel, forzarVertice = l.modo == LightRenderMode.ForceVertex;
                if (!forzarVertice && (forzarPixel || libres > 0) && conf.NPixel < conf.Pixel.Length)
                {
                    conf.Pixel[conf.NPixel++] = l;
                    if (!forzarPixel) libres--;
                }
                else if (l.tipo != LightType.Directional && conf.NVertice < 4) conf.Vertice[conf.NVertice++] = l;
            }
            // la misma configuración, el mismo índice (para poder dibujar juntos)
            long h = principal?.instanceID ?? 0;
            for (int i = 0; i < conf.NPixel; i++) h = h * 1000003 + conf.Pixel[i].instanceID;
            h = h * 31 + 7;
            for (int i = 0; i < conf.NVertice; i++) h = h * 1000003 + conf.Vertice[i].instanceID;
            if (porClave.TryGetValue(h, out int idx)) return idx;
            idx = confs.Count;
            confs.Add(conf);
            porClave[h] = idx;
            return idx;
        }
    }
}

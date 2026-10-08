using System;
using System.Collections.Generic;
using Porteo;
using Porteo.Datos;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Porteo.UI
{
    // El anfitrión dibuja los glifos (en el navegador, con el canvas 2D y la fuente original
    // cargada como FontFace). Las medidas salen del TTF acá, así el armado del texto es el mismo
    // con o sin anfitrión.
    public interface IFuentes
    {
        void Registrar(int fuente, byte[] ttf);
        // el glifo en un mapa de w×h bytes de cobertura (fila 0 arriba), con el origen de la línea
        // de base en (ox, oy); false si la fuente todavía no está lista
        bool Rasterizar(int fuente, int codigo, int tamPx, int estilo, int ox, int oy, int w, int h, Span<byte> salida);
    }

    // Lo que hace falta de un TrueType para medir texto: unidades por em, avances, la caja de
    // cada glifo y la tabla de caracteres.
    internal sealed class TTF
    {
        public int UnidadesEm = 1000;
        ushort[] avances = Array.Empty<ushort>();
        short[] cajas = Array.Empty<short>();     // xMin, yMin, xMax, yMax por glifo
        readonly Dictionary<int, int> mapa = new Dictionary<int, int>();

        static int U16(byte[] b, int p) => (b[p] << 8) | b[p + 1];
        static short S16(byte[] b, int p) => (short)((b[p] << 8) | b[p + 1]);
        static int U32(byte[] b, int p) => (b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3];

        internal static TTF Leer(byte[] b)
        {
            try
            {
                if (b == null || b.Length < 12) return null;
                int nt = U16(b, 4);
                var tablas = new Dictionary<string, (int off, int len)>();
                for (int i = 0; i < nt; i++)
                {
                    int p = 12 + i * 16;
                    var tag = System.Text.Encoding.ASCII.GetString(b, p, 4);
                    tablas[tag] = (U32(b, p + 8), U32(b, p + 12));
                }
                if (!tablas.TryGetValue("head", out var head) || !tablas.TryGetValue("hhea", out var hhea) ||
                    !tablas.TryGetValue("maxp", out var maxp) || !tablas.TryGetValue("hmtx", out var hmtx) || !tablas.TryGetValue("cmap", out var cmap)) return null;
                var t = new TTF { UnidadesEm = Math.Max(16, U16(b, head.off + 18)) };
                int formatoLoca = S16(b, head.off + 50);
                int nGlifos = U16(b, maxp.off + 4);
                int nMetricas = Math.Max(1, U16(b, hhea.off + 34));
                t.avances = new ushort[nGlifos];
                for (int g = 0; g < nGlifos; g++) t.avances[g] = (ushort)U16(b, hmtx.off + Math.Min(g, nMetricas - 1) * 4);
                // las cajas de los glifos (sólo en fuentes TrueType; las CFF se quedan sin caja)
                t.cajas = new short[nGlifos * 4];
                if (tablas.TryGetValue("loca", out var loca) && tablas.TryGetValue("glyf", out var glyf))
                    for (int g = 0; g < nGlifos; g++)
                    {
                        int a, z;
                        if (formatoLoca == 0) { a = U16(b, loca.off + g * 2) * 2; z = U16(b, loca.off + g * 2 + 2) * 2; }
                        else { a = U32(b, loca.off + g * 4); z = U32(b, loca.off + g * 4 + 4); }
                        if (z <= a) continue;
                        int p = glyf.off + a;
                        t.cajas[g * 4] = S16(b, p + 2); t.cajas[g * 4 + 1] = S16(b, p + 4);
                        t.cajas[g * 4 + 2] = S16(b, p + 6); t.cajas[g * 4 + 3] = S16(b, p + 8);
                    }
                t.LeerCmap(b, cmap.off);
                return t;
            }
            catch (Exception) { return null; }
        }

        // la subtabla Unicode más completa: formato 12 (todo Unicode) o 4 (el plano básico)
        void LeerCmap(byte[] b, int off)
        {
            int n = U16(b, off + 2), mejor = -1, formatoMejor = 0;
            for (int i = 0; i < n; i++)
            {
                int p = off + 4 + i * 8;
                int plat = U16(b, p), enc = U16(b, p + 2), sub = off + U32(b, p + 4);
                int formato = U16(b, sub);
                bool unicode = plat == 0 || (plat == 3 && (enc == 1 || enc == 10));
                if (!unicode || (formato != 4 && formato != 12)) continue;
                if (formato > formatoMejor) { mejor = sub; formatoMejor = formato; }
            }
            if (mejor < 0) return;
            if (formatoMejor == 12)
            {
                int grupos = U32(b, mejor + 12);
                for (int k = 0; k < grupos; k++)
                {
                    int p = mejor + 16 + k * 12;
                    int ini = U32(b, p), fin = U32(b, p + 4), g0 = U32(b, p + 8);
                    for (int c = ini; c <= fin && c - ini < 0x10000; c++) mapa[c] = g0 + (c - ini);
                }
                return;
            }
            int seg = U16(b, mejor + 6) / 2;
            int fines = mejor + 14, inicios = fines + seg * 2 + 2, deltas = inicios + seg * 2, rangos = deltas + seg * 2;
            for (int s = 0; s < seg; s++)
            {
                int fin = U16(b, fines + s * 2), ini = U16(b, inicios + s * 2);
                int delta = S16(b, deltas + s * 2), rango = U16(b, rangos + s * 2);
                for (int c = ini; c <= fin && c != 0xFFFF; c++)
                {
                    int g;
                    if (rango == 0) g = (c + delta) & 0xFFFF;
                    else
                    {
                        int p = rangos + s * 2 + rango + (c - ini) * 2;
                        g = U16(b, p);
                        if (g != 0) g = (g + delta) & 0xFFFF;
                    }
                    if (g != 0) mapa[c] = g;
                }
            }
        }

        public int Glifo(int codigo) => mapa.TryGetValue(codigo, out var g) ? g : 0;
        public bool Tiene(int codigo) => mapa.ContainsKey(codigo);
        public int Avance(int g) => g >= 0 && g < avances.Length ? avances[g] : (avances.Length > 0 ? avances[0] : UnidadesEm / 2);
        public void Caja(int g, out int x0, out int y0, out int x1, out int y1)
        {
            if (g < 0 || g * 4 + 3 >= cajas.Length) { x0 = y0 = x1 = y1 = 0; return; }
            x0 = cajas[g * 4]; y0 = cajas[g * 4 + 1]; x1 = cajas[g * 4 + 2]; y1 = cajas[g * 4 + 3];
        }
    }

    // Un glifo en el atlas de una fuente: sus medidas en píxeles (como CharacterInfo) y dónde quedó
    internal sealed class Glifo
    {
        public int Codigo, Tam, Estilo;
        public int Avance, MinX, MinY, MaxX, MaxY;   // alrededor del origen, y hacia arriba
        public int AtlasX, AtlasY;                   // la esquina de abajo a la izquierda en el atlas
        public bool Dibujado;
        public int W => MaxX - MinX;
        public int H => MaxY - MinY;
    }

    public static class Fuentes
    {
        public static IFuentes Anfitrion;
        static int siguiente = 1;
        internal static int NuevoId() => siguiente++;

        // los glifos que no se pudieron dibujar porque la fuente no había terminado de cargar
        internal static readonly HashSet<Font> pendientes = new HashSet<Font>();

        public static void Iniciar() => Mundo.AlEmpezarCuadro += Reintentar;

        static void Reintentar()
        {
            if (pendientes.Count == 0) return;
            foreach (var f in new List<Font>(pendientes)) f.ReintentarPendientes();
        }
    }
}

namespace UnityEngine
{
    public partial class Font : Object
    {
        internal byte[] ttf;
        internal Porteo.UI.TTF tabla;
        internal int tamBase = 16, idHost;
        internal float ascensoBase, descensoBase, interlineadoBase;
        internal Material materialDef;
        internal Font[] respaldos = Array.Empty<Font>();
        internal string[] nombres = Array.Empty<string>();
        internal readonly Dictionary<long, float> kerning = new Dictionary<long, float>();
        bool registrada;

        // ── atlas ──
        Texture2D atlas;
        byte[] cobertura;
        int anchoAtlas, altoAtlas, estanteX, estanteY, estanteAlto;
        bool atlasSucio;
        readonly Dictionary<(int, int, int), Porteo.UI.Glifo> glifos = new Dictionary<(int, int, int), Porteo.UI.Glifo>();
        readonly List<Porteo.UI.Glifo> sinDibujar = new List<Porteo.UI.Glifo>();

        public Font() { m_Name = ""; }
        public Font(string name) { m_Name = name ?? ""; }

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            tamBase = Math.Max(1, (int)Math.Round(m.F("m_FontSize", 16)));
            ascensoBase = m.F("m_Ascent");
            descensoBase = m.F("m_Descent");
            interlineadoBase = m.F("m_LineSpacing");
            materialDef = r.Resolver(m.P("m_DefaultMaterial")) as Material;
            switch (m["m_FontData"])
            {
                case byte[] b when b.Length > 0: ttf = b; break;
                case Recurso rec: ttf = Paquete.BytesDeRecurso(r.Recurso(rec.Id)); break;
                case List<object> l when l.Count > 0: { ttf = new byte[l.Count]; for (int i = 0; i < l.Count; i++) ttf[i] = (byte)Convert.ToInt32(l[i]); break; }
            }
            if (ttf != null && ttf.Length == 0) ttf = null;
            tabla = ttf != null ? Porteo.UI.TTF.Leer(ttf) : null;
            var kv = m.L("m_KerningValues");
            // cada par viene como [[primero, segundo], valor] (un pair de pairs de Unity)
            if (kv != null)
                foreach (var o in kv)
                {
                    if (!(o is List<object> k) || k.Count < 2 || !(k[0] is List<object> par) || par.Count < 2) continue;
                    long clave = ((long)Convert.ToInt32(par[0]) << 32) | (uint)Convert.ToInt32(par[1]);
                    kerning[clave] = Convert.ToSingle(k[1]);
                }
            var fb = m.L("m_FallbackFonts");
            if (fb != null)
            {
                var l = new List<Font>();
                foreach (var o in fb) if (o is PPtr p && r.Resolver(p) is Font f && f != this) l.Add(f);
                respaldos = l.ToArray();
            }
            var fn = m.L("m_FontNames");
            if (fn != null) { var l = new List<string>(); foreach (var o in fn) if (o is string s) l.Add(s); nombres = l.ToArray(); }
        }

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            base.CopiarDe(o, remap);
            var f = (Font)o;
            ttf = f.ttf; tabla = f.tabla; tamBase = f.tamBase; ascensoBase = f.ascensoBase; descensoBase = f.descensoBase;
            interlineadoBase = f.interlineadoBase; materialDef = f.materialDef; respaldos = f.respaldos; nombres = f.nombres;
            foreach (var kv in f.kerning) kerning[kv.Key] = kv.Value;
        }

        public static event Action<Font> textureRebuilt;

        public bool dynamic => tabla != null;
        public int fontSize => tamBase;
        public int ascent => (int)Math.Round(ascensoBase);
        public int lineHeight => (int)Math.Round(interlineadoBase);
        public string[] fontNames { get => nombres; set => nombres = value ?? Array.Empty<string>(); }
        public Material material
        {
            get { Atlas(); return materialDef; }
            set => materialDef = value;
        }

        public bool HasCharacter(char c) => tabla != null ? tabla.Tiene(c) : false;

        public static Font CreateDynamicFontFromOSFont(string fontname, int size) => null;
        public static Font CreateDynamicFontFromOSFont(string[] fontnames, int size) => null;
        public static string[] GetOSInstalledFontNames() => Array.Empty<string>();

        public void RequestCharactersInTexture(string characters) => RequestCharactersInTexture(characters, tamBase, FontStyle.Normal);
        public void RequestCharactersInTexture(string characters, int size) => RequestCharactersInTexture(characters, size, FontStyle.Normal);

        public void RequestCharactersInTexture(string characters, int size, FontStyle style)
        {
            if (string.IsNullOrEmpty(characters) || tabla == null) return;
            foreach (var c in characters) Pedir(c, size <= 0 ? tamBase : size, (int)style);
            Subir();
        }

        public bool GetCharacterInfo(char ch, out CharacterInfo info) => GetCharacterInfo(ch, out info, tamBase, FontStyle.Normal);
        public bool GetCharacterInfo(char ch, out CharacterInfo info, int size) => GetCharacterInfo(ch, out info, size, FontStyle.Normal);

        public bool GetCharacterInfo(char ch, out CharacterInfo info, int size, FontStyle style)
        {
            info = default;
            if (tabla == null) return false;
            var g = glifos.TryGetValue((ch, size <= 0 ? tamBase : size, (int)style), out var x) ? x : null;
            if (g == null) return false;
            info = Info(g);
            return true;
        }

        internal CharacterInfo Info(Porteo.UI.Glifo g)
        {
            float u0 = g.AtlasX / (float)anchoAtlas, v0 = g.AtlasY / (float)altoAtlas;
            float u1 = (g.AtlasX + g.W) / (float)anchoAtlas, v1 = (g.AtlasY + g.H) / (float)altoAtlas;
            var ci = new CharacterInfo { index = g.Codigo, size = g.Tam, style = (FontStyle)g.Estilo };
            ci.advance = g.Avance; ci.bearing = g.MinX; ci.minY = g.MinY; ci.maxY = g.MaxY; ci.glyphWidth = g.W; ci.glyphHeight = g.H;
            ci.uvBottomLeft = new Vector2(u0, v0); ci.uvBottomRight = new Vector2(u1, v0);
            ci.uvTopLeft = new Vector2(u0, v1); ci.uvTopRight = new Vector2(u1, v1);
            return ci;
        }

        // ── medidas en píxeles para un tamaño ──
        internal float Escala(int tamPx) => tabla != null ? tamPx / (float)tabla.UnidadesEm : 0;
        internal float Ascenso(int tamPx) => ascensoBase * tamPx / tamBase;
        internal float Descenso(int tamPx) => descensoBase * tamPx / tamBase;
        internal float Interlineado(int tamPx) => interlineadoBase * tamPx / tamBase;
        internal float Kerning(int a, int b, int tamPx) => kerning.Count > 0 && kerning.TryGetValue(((long)a << 32) | (uint)b, out var k) ? k * tamPx / tamBase : 0;

        // el glifo de un carácter a un tamaño (lo agrega al atlas si hace falta)
        internal Porteo.UI.Glifo Pedir(int codigo, int tamPx, int estilo)
        {
            var clave = (codigo, tamPx, estilo);
            if (glifos.TryGetValue(clave, out var g)) return g;
            float s = Escala(tamPx);
            int gi = tabla.Glifo(codigo);
            tabla.Caja(gi, out int x0, out int y0, out int x1, out int y1);
            g = new Porteo.UI.Glifo { Codigo = codigo, Tam = tamPx, Estilo = estilo, Avance = (int)Math.Round(tabla.Avance(gi) * s) };
            if (x1 > x0 && y1 > y0 && !char.IsWhiteSpace((char)Math.Min(codigo, 0xFFFF)))
            {
                // un píxel de margen: el suavizado del dibujo pasa un poco la caja; la itálica sintética
                // se inclina hacia la derecha
                int extra = (estilo & 2) != 0 ? (int)Math.Ceiling((y1 * s) * 0.25f) : 0;
                g.MinX = (int)Math.Floor(x0 * s) - 1; g.MaxX = (int)Math.Ceiling(x1 * s) + 1 + extra + ((estilo & 1) != 0 ? 1 : 0);
                g.MinY = (int)Math.Floor(y0 * s) - 1; g.MaxY = (int)Math.Ceiling(y1 * s) + 1;
                Ubicar(g);
            }
            glifos[clave] = g;
            return g;
        }

        // ── el atlas: estantes que se llenan de izquierda a derecha y de abajo hacia arriba ──
        internal Texture2D Atlas()
        {
            if (atlas != null || tabla == null) return atlas;
            anchoAtlas = altoAtlas = 256;
            cobertura = new byte[anchoAtlas * altoAtlas];
            atlas = new Texture2D(anchoAtlas, altoAtlas, TextureFormat.Alpha8, false) { m_Name = "Font Texture" };
            atlas.filterMode = FilterMode.Bilinear;
            atlas.wrapMode = TextureWrapMode.Clamp;
            estanteX = estanteY = estanteAlto = 0;
            atlasSucio = true;
            if (materialDef == null)
            {
                var sh = Shader.Find("GUI/Text Shader") ?? Shader.Find("UI/Default");
                if (sh != null) materialDef = new Material(sh) { m_Name = "Font Material" };
            }
            if (materialDef != null) materialDef.mainTexture = atlas;
            return atlas;
        }

        void Ubicar(Porteo.UI.Glifo g)
        {
            Atlas();
            int w = g.W, h = g.H;
            if (estanteX + w + 1 > anchoAtlas) { estanteY += estanteAlto + 1; estanteX = 0; estanteAlto = 0; }
            if (estanteY + h + 1 > altoAtlas || w + 1 > anchoAtlas)
            {
                // no entra: un atlas más grande con lo que haya en uso (los textos se rearman)
                Agrandar();
                if (estanteX + w + 1 > anchoAtlas) { estanteY += estanteAlto + 1; estanteX = 0; estanteAlto = 0; }
            }
            g.AtlasX = estanteX; g.AtlasY = estanteY;
            estanteX += w + 1;
            estanteAlto = Math.Max(estanteAlto, h);
            Dibujar(g);
        }

        void Agrandar()
        {
            if (anchoAtlas >= 4096) { glifos.Clear(); }
            else if (anchoAtlas <= altoAtlas) anchoAtlas *= 2; else altoAtlas *= 2;
            cobertura = new byte[anchoAtlas * altoAtlas];
            atlas.Resize(anchoAtlas, altoAtlas, TextureFormat.Alpha8, false);
            estanteX = estanteY = estanteAlto = 0;
            var viejos = new List<Porteo.UI.Glifo>(glifos.Values);
            foreach (var x in viejos)
            {
                if (x.W <= 0 || x.H <= 0) continue;
                if (estanteX + x.W + 1 > anchoAtlas) { estanteY += estanteAlto + 1; estanteX = 0; estanteAlto = 0; }
                x.AtlasX = estanteX; x.AtlasY = estanteY;
                estanteX += x.W + 1; estanteAlto = Math.Max(estanteAlto, x.H);
                x.Dibujado = false;
                Dibujar(x);
            }
            atlasSucio = true;
            reconstruido = true;
        }

        bool reconstruido;
        static byte[] temporal = new byte[64 * 64];

        void Dibujar(Porteo.UI.Glifo g)
        {
            var host = Porteo.UI.Fuentes.Anfitrion;
            if (host == null) { g.Dibujado = true; return; }
            if (!registrada) { idHost = Porteo.UI.Fuentes.NuevoId(); host.Registrar(idHost, ttf); registrada = true; }
            int w = g.W, h = g.H;
            if (temporal.Length < w * h) temporal = new byte[w * h];
            var sal = new Span<byte>(temporal, 0, w * h);
            sal.Clear();
            if (!host.Rasterizar(idHost, g.Codigo, g.Tam, g.Estilo, -g.MinX, g.MaxY, w, h, sal))
            {
                sinDibujar.Add(g);
                Porteo.UI.Fuentes.pendientes.Add(this);
                return;
            }
            // el mapa viene con la fila 0 arriba; en el atlas la fila 0 está abajo
            for (int y = 0; y < h; y++)
                Buffer.BlockCopy(temporal, y * w, cobertura, (g.AtlasY + h - 1 - y) * anchoAtlas + g.AtlasX, w);
            g.Dibujado = true;
            atlasSucio = true;
        }

        internal void ReintentarPendientes()
        {
            if (sinDibujar.Count == 0) { Porteo.UI.Fuentes.pendientes.Remove(this); return; }
            var l = new List<Porteo.UI.Glifo>(sinDibujar);
            sinDibujar.Clear();
            Porteo.UI.Fuentes.pendientes.Remove(this);
            foreach (var g in l) Dibujar(g);
            if (sinDibujar.Count == 0) { Subir(); reconstruido = true; AvisarSiCambio(); }
        }

        // la cobertura nueva a la textura (una vez por armado de texto)
        internal void Subir()
        {
            if (!atlasSucio || atlas == null) return;
            atlasSucio = false;
            // los bytes crudos se suben como textura ALPHA (como el Alpha8 de Unity); Apply los
            // pasaría a RGBA blanco y la UI, que suma blanco a las de sólo alfa, se pasaría de brillo
            atlas.LoadRawTextureData(cobertura);
        }

        // si el atlas se rehízo, los textos que usan esta fuente se vuelven a armar
        internal void AvisarSiCambio()
        {
            if (!reconstruido) return;
            reconstruido = false;
            try { textureRebuilt?.Invoke(this); }
            catch (Exception e) { Debug.LogException(e); }
        }
    }

    public partial struct CharacterInfo
    {
        public int index;
        public int size;
        public FontStyle style;
        public bool flipped;
        internal int adv, bear, minYv, maxYv, ancho, alto;
        internal Vector2 uvBL, uvBR, uvTL, uvTR;

        public int advance { get => adv; set => adv = value; }
        public int bearing { get => bear; set => bear = value; }
        public int minY { get => minYv; set => minYv = value; }
        public int maxY { get => maxYv; set => maxYv = value; }
        public int minX { get => bear; set => bear = value; }
        public int maxX { get => bear + ancho; set => ancho = value - bear; }
        public int glyphWidth { get => ancho; set => ancho = value; }
        public int glyphHeight { get => alto; set => alto = value; }
        public Vector2 uvBottomLeft { get => uvBL; set => uvBL = value; }
        public Vector2 uvBottomRight { get => uvBR; set => uvBR = value; }
        public Vector2 uvTopLeft { get => uvTL; set => uvTL = value; }
        public Vector2 uvTopRight { get => uvTR; set => uvTR = value; }
    }
}

using System;
using System.Collections.Generic;
using Porteo;
using UnityEngine;
using Object = UnityEngine.Object;
using Porteo.Datos;
using Porteo.Render;

namespace UnityEngine
{
    // Una textura vive del lado de la GPU; se sube la primera vez que alguien la dibuja (las del
    // juego, cuando llegan sus bytes). Mientras tanto se usa la de por defecto de la propiedad.
    public partial class Texture : Object
    {
        internal int ancho, alto;
        internal FilterMode filtro = FilterMode.Bilinear;
        internal TextureWrapMode envolverU, envolverV, envolverW;
        internal int aniso = 1;
        internal float sesgoMip;
        internal uint gl;            // 0: todavía no está en la GPU
        internal uint objetivoGl = Porteo.Render.Gl.TEXTURE_2D;
        internal bool parametrosSucios = true;
        internal int mips = 1;

        public virtual int width { get => ancho; set => ancho = value; }
        public virtual int height { get => alto; set => alto = value; }
        public FilterMode filterMode { get => filtro; set { filtro = value; parametrosSucios = true; } }
        public TextureWrapMode wrapMode { get => envolverU; set { envolverU = envolverV = envolverW = value; parametrosSucios = true; } }
        public TextureWrapMode wrapModeU { get => envolverU; set { envolverU = value; parametrosSucios = true; } }
        public TextureWrapMode wrapModeV { get => envolverV; set { envolverV = value; parametrosSucios = true; } }
        public TextureWrapMode wrapModeW { get => envolverW; set { envolverW = value; parametrosSucios = true; } }
        public int anisoLevel { get => aniso; set { aniso = value; parametrosSucios = true; } }
        public float mipMapBias { get => sesgoMip; set => sesgoMip = value; }
        public Vector2 texelSize => new Vector2(1f / Math.Max(1, width), 1f / Math.Max(1, height));
        public int mipmapCount => mips;

        public IntPtr GetNativeTexturePtr() => (IntPtr)gl;

        // la textura de GL para dibujar; 0 si todavía no se puede (sin datos)
        internal virtual uint IdGl() => gl;

        internal void LeerAjustes(Mapa ts)
        {
            if (ts == null) return;
            filtro = (FilterMode)ts.I32("m_FilterMode", 1);
            aniso = ts.I32("m_Aniso", 1);
            sesgoMip = ts.F("m_MipBias");
            envolverU = (TextureWrapMode)ts.I32("m_WrapU");
            envolverV = (TextureWrapMode)ts.I32("m_WrapV");
            envolverW = (TextureWrapMode)ts.I32("m_WrapW");
        }

        internal unsafe void AplicarParametros()
        {
            if (!parametrosSucios || gl == 0) return;
            parametrosSucios = false;
            uint o = objetivoGl;
            Gpu.AtarParaSubir(o, gl);
            bool punto = filtro == FilterMode.Point;
            int min = mips > 1 ? (punto ? Porteo.Render.Gl.NEAREST_MIPMAP_NEAREST : filtro == FilterMode.Trilinear ? Porteo.Render.Gl.LINEAR_MIPMAP_LINEAR : Porteo.Render.Gl.LINEAR_MIPMAP_NEAREST)
                               : (punto ? Porteo.Render.Gl.NEAREST : Porteo.Render.Gl.LINEAR);
            Porteo.Render.Gl.TexParameteri(o, Porteo.Render.Gl.TEXTURE_MIN_FILTER, min);
            Porteo.Render.Gl.TexParameteri(o, Porteo.Render.Gl.TEXTURE_MAG_FILTER, punto ? Porteo.Render.Gl.NEAREST : Porteo.Render.Gl.LINEAR);
            Porteo.Render.Gl.TexParameteri(o, Porteo.Render.Gl.TEXTURE_WRAP_S, Envolver(envolverU));
            Porteo.Render.Gl.TexParameteri(o, Porteo.Render.Gl.TEXTURE_WRAP_T, Envolver(envolverV));
            if (o != Porteo.Render.Gl.TEXTURE_2D) Porteo.Render.Gl.TexParameteri(o, Porteo.Render.Gl.TEXTURE_WRAP_R, Envolver(envolverW));
            if (Gpu.Aniso && mips > 1)
                Porteo.Render.Gl.TexParameterf(o, Porteo.Render.Gl.TEXTURE_MAX_ANISOTROPY, Math.Clamp(QualitySettings.Anisotropico(aniso), 1, 16));
        }

        static int Envolver(TextureWrapMode m) => m switch
        {
            TextureWrapMode.Clamp => Porteo.Render.Gl.CLAMP_TO_EDGE,
            TextureWrapMode.Mirror => Porteo.Render.Gl.MIRRORED_REPEAT,
            TextureWrapMode.MirrorOnce => Porteo.Render.Gl.MIRRORED_REPEAT,
            _ => Porteo.Render.Gl.REPEAT,
        };

        internal override unsafe void AlLiberar()
        {
            if (gl != 0 && Gpu.Activo)
            {
                uint t = gl;
                Gpu.TexturaBorrada(t);
                Porteo.Render.Gl.DeleteTextures(1, &t);
            }
            gl = 0;
        }
    }

    public sealed partial class Texture2D : Texture
    {
        internal TextureFormat formato = TextureFormat.RGBA32;
        internal byte[] datos;            // los bytes (del archivo o de SetPixels/Apply)
        internal int recurso = -1;        // o un recurso aparte que todavía no se leyó
        internal bool legible = true, lineal;
        internal Color32[] pixeles;       // copia en la CPU (SetPixel/GetPixels)
        bool subida, pedida;
        internal int imagenes = 1;        // 6 en los cubemaps

        public Texture2D(int width, int height) : this(width, height, TextureFormat.RGBA32, true, false) { }
        public Texture2D(int width, int height, TextureFormat textureFormat, bool mipChain) : this(width, height, textureFormat, mipChain, false) { }

        public Texture2D(int width, int height, TextureFormat textureFormat, bool mipChain, bool linear)
        {
            ancho = Math.Max(1, width); alto = Math.Max(1, height);
            formato = textureFormat;
            mips = mipChain ? Texturas.NivelesCompletos(ancho, alto) : 1;
            lineal = linear;
            envolverU = envolverV = envolverW = TextureWrapMode.Repeat;
            pixeles = new Color32[ancho * alto];
            for (int i = 0; i < pixeles.Length; i++) pixeles[i] = new Color32(205, 205, 205, 205);
        }

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            ancho = m.I32("m_Width");
            alto = m.I32("m_Height");
            formato = (TextureFormat)m.I32("m_TextureFormat");
            mips = Math.Max(1, m.I32("m_MipCount", 1));
            legible = m.B("m_IsReadable");
            imagenes = Math.Max(1, m.I32("m_ImageCount", 1));
            lineal = m.I32("m_ColorSpace", 1) == 0;
            LeerAjustes(m.M("m_TextureSettings"));
            switch (m["image data"])
            {
                case Recurso rec: recurso = rec.Id; break;
                case byte[] b: datos = b; break;
            }
        }

        public TextureFormat format => formato;
        public bool isReadable => legible;
        public override int width { get => ancho; set => throw new UnityException("Texture2D width is read-only"); }
        public override int height { get => alto; set => throw new UnityException("Texture2D height is read-only"); }

        static Texture2D blanca, negra;
        public static Texture2D whiteTexture => blanca ??= Llena(255, 255, 255, 255, "UnityWhite");
        public static Texture2D blackTexture => negra ??= Llena(0, 0, 0, 0, "UnityBlack");

        static Texture2D Llena(byte r, byte g, byte b, byte a, string nombre)
        {
            var t = new Texture2D(4, 4, TextureFormat.RGBA32, false) { m_Name = nombre };
            for (int i = 0; i < t.pixeles.Length; i++) t.pixeles[i] = new Color32(r, g, b, a);
            t.Apply();
            return t;
        }

        // los bytes del archivo: si están en un recurso aparte, se piden (y mientras tanto no hay)
        internal byte[] Bytes()
        {
            if (datos != null) return datos;
            if (recurso < 0) return null;
            var b = Anfitrion.Recurso(recurso, !pedida);
            pedida = true;
            if (b != null) { datos = b; recurso = -1; }
            return datos;
        }

        internal override uint IdGl()
        {
            if (!subida)
            {
                if (pixeles != null && datos == null && recurso < 0) Apply();   // creada en tiempo de juego
                else
                {
                    var b = Bytes();
                    if (b == null) return 0;
                    Texturas.Subir(this, b);
                    // lo que ya está en la GPU no hace falta en la CPU (salvo que el juego lo lea)
                    if (!legible) datos = null;
                }
                subida = true;
            }
            AplicarParametros();
            return gl;
        }

        // ── píxeles en la CPU ──
        Color32[] Pixeles()
        {
            if (pixeles != null) return pixeles;
            var b = datos ?? (recurso >= 0 ? Cargador.Recurso(recurso) : null);
            pixeles = b == null ? new Color32[ancho * alto] : Texturas.DecodificarNivel0(formato, ancho, alto, b);
            return pixeles;
        }

        public Color32[] GetPixels32() => (Color32[])Pixeles().Clone();
        public Color32[] GetPixels32(int miplevel) => GetPixels32();

        public Color[] GetPixels()
        {
            var p = Pixeles();
            var r = new Color[p.Length];
            for (int i = 0; i < p.Length; i++) r[i] = p[i];
            return r;
        }

        public Color[] GetPixels(int x, int y, int blockWidth, int blockHeight)
        {
            var p = Pixeles();
            var r = new Color[blockWidth * blockHeight];
            for (int j = 0; j < blockHeight; j++)
                for (int i = 0; i < blockWidth; i++)
                    r[j * blockWidth + i] = p[Math.Clamp(y + j, 0, alto - 1) * ancho + Math.Clamp(x + i, 0, ancho - 1)];
            return r;
        }

        public Color GetPixel(int x, int y)
        {
            var p = Pixeles();
            x = Envolver(x, ancho, envolverU); y = Envolver(y, alto, envolverV);
            return p[y * ancho + x];
        }

        static int Envolver(int v, int n, TextureWrapMode m)
        {
            if (m == TextureWrapMode.Clamp) return Math.Clamp(v, 0, n - 1);
            v %= n; return v < 0 ? v + n : v;
        }

        public Color GetPixelBilinear(float u, float v)
        {
            float x = u * ancho - 0.5f, y = v * alto - 0.5f;
            int x0 = (int)Math.Floor(x), y0 = (int)Math.Floor(y);
            float fx = x - x0, fy = y - y0;
            var a = GetPixel(x0, y0); var b = GetPixel(x0 + 1, y0);
            var c = GetPixel(x0, y0 + 1); var d = GetPixel(x0 + 1, y0 + 1);
            return Color.Lerp(Color.Lerp(a, b, fx), Color.Lerp(c, d, fx), fy);
        }

        public void SetPixel(int x, int y, Color color)
        {
            var p = Pixeles();
            if (x < 0 || y < 0 || x >= ancho || y >= alto) return;
            p[y * ancho + x] = color;
        }

        public void SetPixels(Color[] colors) => SetPixels(0, 0, ancho, alto, colors);
        public void SetPixels(Color[] colors, int miplevel) { if (miplevel == 0) SetPixels(colors); }

        public void SetPixels(int x, int y, int blockWidth, int blockHeight, Color[] colors)
        {
            var p = Pixeles();
            for (int j = 0; j < blockHeight; j++)
                for (int i = 0; i < blockWidth; i++)
                {
                    int px = x + i, py = y + j;
                    if (px < 0 || py < 0 || px >= ancho || py >= alto) continue;
                    p[py * ancho + px] = colors[j * blockWidth + i];
                }
        }

        public void SetPixels32(Color32[] colors)
        {
            var p = Pixeles();
            Array.Copy(colors, p, Math.Min(colors.Length, p.Length));
        }

        public void Apply() => Apply(true, false);
        public void Apply(bool updateMipmaps) => Apply(updateMipmaps, false);

        public unsafe void Apply(bool updateMipmaps, bool makeNoLongerReadable)
        {
            var p = Pixeles();
            datos = null; recurso = -1;
            subida = true;
            if (!Gpu.Activo) return;
            if (gl == 0) { uint t; Porteo.Render.Gl.GenTextures(1, &t); gl = t; parametrosSucios = true; }
            Gpu.AtarParaSubir(Porteo.Render.Gl.TEXTURE_2D, gl);
            fixed (Color32* d = p)
                Porteo.Render.Gl.TexImage2D(Porteo.Render.Gl.TEXTURE_2D, 0, Porteo.Render.Gl.RGBA8, ancho, alto, 0, Porteo.Render.Gl.RGBA, Porteo.Render.Gl.UNSIGNED_BYTE, d);
            if (mips > 1 && updateMipmaps) Porteo.Render.Gl.GenerateMipmap(Porteo.Render.Gl.TEXTURE_2D);
            parametrosSucios = true;
            if (makeNoLongerReadable) { pixeles = null; legible = false; }
        }

        public bool Resize(int width, int height)
        {
            ancho = Math.Max(1, width); alto = Math.Max(1, height);
            pixeles = new Color32[ancho * alto];
            return true;
        }

        public bool Resize(int width, int height, TextureFormat format, bool hasMipMap)
        {
            formato = format;
            mips = hasMipMap ? Texturas.NivelesCompletos(width, height) : 1;
            return Resize(width, height);
        }

        // lee del destino de dibujo activo (la pantalla o RenderTexture.active)
        public unsafe void ReadPixels(Rect source, int destX, int destY)
        {
            var p = Pixeles();
            int w = (int)source.width, h = (int)source.height;
            if (!Gpu.Activo || w <= 0 || h <= 0) return;
            var buf = new Color32[w * h];
            fixed (Color32* d = buf) Porteo.Render.Gl.ReadPixels((int)source.x, (int)source.y, w, h, Porteo.Render.Gl.RGBA, Porteo.Render.Gl.UNSIGNED_BYTE, d);
            for (int j = 0; j < h; j++)
                for (int i = 0; i < w; i++)
                {
                    int x = destX + i, y = destY + j;
                    if (x < 0 || y < 0 || x >= ancho || y >= alto) continue;
                    p[y * ancho + x] = buf[j * w + i];
                }
        }

        public void ReadPixels(Rect source, int destX, int destY, bool recalculateMipMaps) => ReadPixels(source, destX, destY);

        public byte[] GetRawTextureData() => (byte[])(Bytes() ?? Array.Empty<byte>()).Clone();

        public void LoadRawTextureData(byte[] data)
        {
            datos = (byte[])data.Clone();
            pixeles = null; subida = false;
        }

        internal override Object ClonarAsset()
        {
            var t = new Texture2D(ancho, alto, TextureFormat.RGBA32, mips > 1, lineal);
            t.SetPixels32(Pixeles());
            t.filtro = filtro; t.envolverU = envolverU; t.envolverV = envolverV; t.aniso = aniso;
            t.Apply();
            return t;
        }
    }

    public sealed partial class Cubemap : Texture
    {
        internal Texture2D caras;   // los datos de las 6 caras (cada una con sus mips) en un Texture2D

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            caras = new Texture2D(true);
            caras.LeerNativo(m, r);
            ancho = caras.ancho; alto = caras.alto; mips = caras.mips;
            filtro = caras.filtro; envolverU = caras.envolverU; envolverV = caras.envolverV; envolverW = caras.envolverW; aniso = caras.aniso;
            objetivoGl = Porteo.Render.Gl.TEXTURE_CUBE_MAP;
            Registro.Baja(caras);
        }

        bool subida;

        internal override uint IdGl()
        {
            if (!subida)
            {
                var b = caras?.Bytes();
                if (b == null) return 0;
                Texturas.SubirCubo(this, caras.formato, b);
                caras.datos = null;
                subida = true;
            }
            AplicarParametros();
            return gl;
        }

        public TextureFormat format => caras?.formato ?? TextureFormat.RGBA32;
    }
}

namespace Porteo.Render
{
    public static unsafe class Texturas
    {
        public static int NivelesCompletos(int w, int h)
        {
            int n = 1;
            while (w > 1 || h > 1) { w = Math.Max(1, w >> 1); h = Math.Max(1, h >> 1); n++; }
            return n;
        }

        // bytes de un nivel de mip en el formato de Unity
        public static int TamanoNivel(TextureFormat f, int w, int h)
        {
            switch (f)
            {
                case TextureFormat.ETC_RGB4: case TextureFormat.ETC2_RGB: case TextureFormat.ETC2_RGBA1: case TextureFormat.DXT1: case TextureFormat.EAC_R:
                    return ((w + 3) / 4) * ((h + 3) / 4) * 8;
                case TextureFormat.ETC2_RGBA8: case TextureFormat.DXT5: case TextureFormat.EAC_RG:
                    return ((w + 3) / 4) * ((h + 3) / 4) * 16;
                case TextureFormat.Alpha8: case TextureFormat.R8: return w * h;
                case TextureFormat.RGB24: return w * h * 3;
                case TextureFormat.RGBA4444: case TextureFormat.ARGB4444: case TextureFormat.RGB565: case TextureFormat.R16: case TextureFormat.RHalf: return w * h * 2;
                case TextureFormat.RGBAHalf: return w * h * 8;
                case TextureFormat.RGBAFloat: return w * h * 16;
                default: return w * h * 4;
            }
        }

        static uint GlComprimido(TextureFormat f) => f switch
        {
            TextureFormat.ETC_RGB4 => Gl.COMPRESSED_RGB8_ETC2,
            TextureFormat.ETC2_RGB => Gl.COMPRESSED_RGB8_ETC2,
            TextureFormat.ETC2_RGBA1 => Gl.COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2,
            TextureFormat.ETC2_RGBA8 => Gl.COMPRESSED_RGBA8_ETC2_EAC,
            _ => 0,
        };

        static bool EsEtc(TextureFormat f) => f == TextureFormat.ETC_RGB4 || f == TextureFormat.ETC2_RGB || f == TextureFormat.ETC2_RGBA1 || f == TextureFormat.ETC2_RGBA8;

        public static void Subir(Texture2D t, byte[] b)
        {
            if (!Gpu.Activo) return;
            uint id;
            Gl.GenTextures(1, &id);
            t.gl = id;
            t.objetivoGl = Gl.TEXTURE_2D;
            Gpu.AtarParaSubir(Gl.TEXTURE_2D, id);
            int niveles = SubirNiveles(Gl.TEXTURE_2D, t.formato, t.ancho, t.alto, t.mips, b, 0);
            t.mips = niveles;
            Gl.TexParameteri(Gl.TEXTURE_2D, Gl.TEXTURE_MAX_LEVEL, Math.Max(0, niveles - 1));
            t.parametrosSucios = true;
        }

        public static void SubirCubo(Cubemap c, TextureFormat f, byte[] b)
        {
            if (!Gpu.Activo) return;
            uint id;
            Gl.GenTextures(1, &id);
            c.gl = id;
            Gpu.AtarParaSubir(Gl.TEXTURE_CUBE_MAP, id);
            int porCara = 0;
            for (int i = 0, w = c.ancho, h = c.alto; i < c.mips; i++, w = Math.Max(1, w >> 1), h = Math.Max(1, h >> 1)) porCara += TamanoNivel(f, w, h);
            int niveles = c.mips;
            for (int cara = 0; cara < 6; cara++)
                niveles = SubirNiveles(Gl.TEXTURE_CUBE_MAP_POSITIVE_X + (uint)cara, f, c.ancho, c.alto, c.mips, b, cara * porCara);
            c.mips = niveles;
            Gl.TexParameteri(Gl.TEXTURE_CUBE_MAP, Gl.TEXTURE_MAX_LEVEL, Math.Max(0, niveles - 1));
            c.parametrosSucios = true;
        }

        // sube la cadena de mips; devuelve cuántos niveles quedaron
        static int SubirNiveles(uint objetivo, TextureFormat f, int w, int h, int mips, byte[] b, int desde)
        {
            int p = desde, subidos = 0;
            bool nativo = EsEtc(f) && Gpu.Etc;
            for (int i = 0; i < mips; i++)
            {
                int tam = TamanoNivel(f, w, h);
                if (p + tam > b.Length) break;
                fixed (byte* d = &b[p])
                {
                    if (nativo) Gl.CompressedTexImage2D(objetivo, i, GlComprimido(f), w, h, 0, tam, d);
                    else SubirSinComprimir(objetivo, i, f, w, h, d, tam);
                }
                subidos++;
                p += tam;
                if (w == 1 && h == 1) break;
                w = Math.Max(1, w >> 1); h = Math.Max(1, h >> 1);
            }
            return Math.Max(1, subidos);
        }

        static void SubirSinComprimir(uint objetivo, int nivel, TextureFormat f, int w, int h, byte* d, int tam)
        {
            switch (f)
            {
                case TextureFormat.RGBA32:
                    Gl.TexImage2D(objetivo, nivel, Gl.RGBA8, w, h, 0, Gl.RGBA, Gl.UNSIGNED_BYTE, d); return;
                case TextureFormat.RGB24:
                    Gl.TexImage2D(objetivo, nivel, Gl.RGB8, w, h, 0, Gl.RGB, Gl.UNSIGNED_BYTE, d); return;
                case TextureFormat.Alpha8:
                    Gl.TexImage2D(objetivo, nivel, (int)Gl.ALPHA, w, h, 0, Gl.ALPHA, Gl.UNSIGNED_BYTE, d); return;
                case TextureFormat.R8:
                    Gl.TexImage2D(objetivo, nivel, Gl.R8, w, h, 0, Gl.RED, Gl.UNSIGNED_BYTE, d); return;
                case TextureFormat.RGBA4444:
                    Gl.TexImage2D(objetivo, nivel, Gl.RGBA4, w, h, 0, Gl.RGBA, Gl.UNSIGNED_SHORT_4_4_4_4, d); return;
                case TextureFormat.RGB565:
                    Gl.TexImage2D(objetivo, nivel, Gl.RGB565, w, h, 0, Gl.RGB, Gl.UNSIGNED_SHORT_5_6_5, d); return;
            }
            // lo demás (ETC sin soporte, ARGB32, BGRA32, ARGB4444...) se pasa a RGBA8 en la CPU
            var px = Decodificar(f, w, h, d, tam);
            fixed (Color32* q = px) Gl.TexImage2D(objetivo, nivel, Gl.RGBA8, w, h, 0, Gl.RGBA, Gl.UNSIGNED_BYTE, q);
        }

        public static Color32[] DecodificarNivel0(TextureFormat f, int w, int h, byte[] b)
        {
            int tam = Math.Min(TamanoNivel(f, w, h), b.Length);
            fixed (byte* d = b) return Decodificar(f, w, h, d, tam);
        }

        public static Color32[] Decodificar(TextureFormat f, int w, int h, byte* d, int tam)
        {
            var r = new Color32[w * h];
            switch (f)
            {
                case TextureFormat.ETC_RGB4: case TextureFormat.ETC2_RGB:
                    Etc.Decodificar(d, w, h, r, false); break;
                case TextureFormat.ETC2_RGBA8:
                    Etc.Decodificar(d, w, h, r, true); break;
                case TextureFormat.RGBA32:
                    for (int i = 0; i < r.Length; i++) r[i] = new Color32(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]); break;
                case TextureFormat.ARGB32:
                    for (int i = 0; i < r.Length; i++) r[i] = new Color32(d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3], d[i * 4]); break;
                case TextureFormat.BGRA32:
                    for (int i = 0; i < r.Length; i++) r[i] = new Color32(d[i * 4 + 2], d[i * 4 + 1], d[i * 4], d[i * 4 + 3]); break;
                case TextureFormat.RGB24:
                    for (int i = 0; i < r.Length; i++) r[i] = new Color32(d[i * 3], d[i * 3 + 1], d[i * 3 + 2], 255); break;
                case TextureFormat.Alpha8:
                    for (int i = 0; i < r.Length; i++) r[i] = new Color32(255, 255, 255, d[i]); break;
                case TextureFormat.R8:
                    for (int i = 0; i < r.Length; i++) r[i] = new Color32(d[i], 0, 0, 255); break;
                case TextureFormat.RGBA4444:
                    for (int i = 0; i < r.Length; i++)
                    {
                        int v = d[i * 2] | d[i * 2 + 1] << 8;
                        r[i] = new Color32((byte)((v >> 12 & 15) * 17), (byte)((v >> 8 & 15) * 17), (byte)((v >> 4 & 15) * 17), (byte)((v & 15) * 17));
                    }
                    break;
                case TextureFormat.ARGB4444:
                    for (int i = 0; i < r.Length; i++)
                    {
                        int v = d[i * 2] | d[i * 2 + 1] << 8;
                        r[i] = new Color32((byte)((v >> 8 & 15) * 17), (byte)((v >> 4 & 15) * 17), (byte)((v & 15) * 17), (byte)((v >> 12 & 15) * 17));
                    }
                    break;
                case TextureFormat.RGB565:
                    for (int i = 0; i < r.Length; i++)
                    {
                        int v = d[i * 2] | d[i * 2 + 1] << 8;
                        int rr = v >> 11 & 31, gg = v >> 5 & 63, bb = v & 31;
                        r[i] = new Color32((byte)(rr << 3 | rr >> 2), (byte)(gg << 2 | gg >> 4), (byte)(bb << 3 | bb >> 2), 255);
                    }
                    break;
                default:
                    for (int i = 0; i < r.Length; i++) r[i] = new Color32(255, 0, 255, 255);
                    break;
            }
            return r;
        }
    }

    // ETC1, ETC2 (con los modos T, H y plano) y el alfa EAC de ETC2_RGBA8, según la especificación
    // de OpenGL ES 3.0 (anexo C). Bloques de 4x4, píxeles por columnas, bits en big endian.
    public static unsafe class Etc
    {
        static readonly int[,] TABLA = { { 2, 8, -2, -8 }, { 5, 17, -5, -17 }, { 9, 29, -9, -29 }, { 13, 42, -13, -42 },
            { 18, 60, -18, -60 }, { 24, 80, -24, -80 }, { 33, 106, -33, -106 }, { 47, 183, -47, -183 } };
        static readonly int[] DISTANCIA = { 3, 6, 11, 16, 23, 32, 41, 64 };
        static readonly int[,] EAC = {
            { -3, -6, -9, -15, 2, 5, 8, 14 }, { -3, -7, -10, -13, 2, 6, 9, 12 }, { -2, -5, -8, -13, 1, 4, 7, 12 }, { -2, -4, -6, -13, 1, 3, 5, 12 },
            { -3, -6, -8, -12, 2, 5, 7, 11 }, { -3, -7, -9, -11, 2, 6, 8, 10 }, { -4, -7, -8, -11, 3, 6, 7, 10 }, { -3, -5, -8, -11, 2, 4, 7, 10 },
            { -2, -6, -8, -10, 1, 5, 7, 9 }, { -2, -5, -8, -10, 1, 4, 7, 9 }, { -2, -4, -8, -10, 1, 3, 7, 9 }, { -2, -5, -7, -10, 1, 4, 6, 9 },
            { -3, -4, -7, -10, 2, 3, 6, 9 }, { -1, -2, -3, -10, 0, 1, 2, 9 }, { -4, -6, -8, -9, 3, 5, 7, 8 }, { -3, -5, -7, -9, 2, 4, 6, 8 } };

        static ulong Leer64(byte* p) =>
            (ulong)p[0] << 56 | (ulong)p[1] << 48 | (ulong)p[2] << 40 | (ulong)p[3] << 32 | (ulong)p[4] << 24 | (ulong)p[5] << 16 | (ulong)p[6] << 8 | p[7];

        static int C(int v) => v < 0 ? 0 : v > 255 ? 255 : v;
        static int E4(int c) => c << 4 | c;
        static int E5(int c) => c << 3 | c >> 2;

        public static void Decodificar(byte* d, int w, int h, Color32[] salida, bool alfa)
        {
            int bw = (w + 3) / 4, bh = (h + 3) / 4;
            var bloque = stackalloc int[16 * 4];
            for (int by = 0; by < bh; by++)
                for (int bx = 0; bx < bw; bx++)
                {
                    byte* p = d + (by * bw + bx) * (alfa ? 16 : 8);
                    if (alfa) { Bloque(Leer64(p + 8), bloque); Alfa(Leer64(p), bloque); }
                    else Bloque(Leer64(p), bloque);
                    for (int y = 0; y < 4; y++)
                    {
                        int py = by * 4 + y;
                        if (py >= h) break;
                        for (int x = 0; x < 4; x++)
                        {
                            int px = bx * 4 + x;
                            if (px >= w) break;
                            int i = (x * 4 + y) * 4;
                            salida[py * w + px] = new Color32((byte)bloque[i], (byte)bloque[i + 1], (byte)bloque[i + 2], (byte)bloque[i + 3]);
                        }
                    }
                }
        }

        // un bloque de color: 16 píxeles RGBA (alfa 255) en orden de columnas
        static void Bloque(ulong b, int* o)
        {
            uint hi = (uint)(b >> 32), idx = (uint)b;
            bool dif = (hi & 2) != 0, flip = (hi & 1) != 0;
            int r1, g1, b1, r2, g2, b2;
            if (!dif)
            {
                r1 = E4((int)(hi >> 28 & 15)); r2 = E4((int)(hi >> 24 & 15));
                g1 = E4((int)(hi >> 20 & 15)); g2 = E4((int)(hi >> 16 & 15));
                b1 = E4((int)(hi >> 12 & 15)); b2 = E4((int)(hi >> 8 & 15));
            }
            else
            {
                int rb = (int)(hi >> 27 & 31), gb = (int)(hi >> 19 & 31), bb = (int)(hi >> 11 & 31);
                int rd = ((int)(hi >> 24 & 7) << 29) >> 29, gd = ((int)(hi >> 16 & 7) << 29) >> 29, bd = ((int)(hi >> 8 & 7) << 29) >> 29;
                int r2c = rb + rd, g2c = gb + gd, b2c = bb + bd;
                if (r2c < 0 || r2c > 31) { ModoT(hi, idx, o); return; }
                if (g2c < 0 || g2c > 31) { ModoH(hi, idx, o); return; }
                if (b2c < 0 || b2c > 31) { ModoPlano(b, o); return; }
                r1 = E5(rb); g1 = E5(gb); b1 = E5(bb);
                r2 = E5(r2c); g2 = E5(g2c); b2 = E5(b2c);
            }
            int t1 = (int)(hi >> 5 & 7), t2 = (int)(hi >> 2 & 7);
            for (int x = 0; x < 4; x++)
                for (int y = 0; y < 4; y++)
                {
                    int k = x * 4 + y;
                    int s = (int)((idx >> (k + 16) & 1) << 1) | (int)(idx >> k & 1);
                    bool segundo = flip ? y >= 2 : x >= 2;
                    int m = segundo ? TABLA[t2, s] : TABLA[t1, s];
                    int* q = o + k * 4;
                    if (segundo) { q[0] = C(r2 + m); q[1] = C(g2 + m); q[2] = C(b2 + m); }
                    else { q[0] = C(r1 + m); q[1] = C(g1 + m); q[2] = C(b1 + m); }
                    q[3] = 255;
                }
        }

        static void Pintar(uint idx, int* o, int* pinturas)
        {
            for (int k = 0; k < 16; k++)
            {
                int s = ((int)(idx >> (k + 16) & 1) << 1) | (int)(idx >> k & 1);
                int* q = o + k * 4;
                q[0] = pinturas[s * 3]; q[1] = pinturas[s * 3 + 1]; q[2] = pinturas[s * 3 + 2]; q[3] = 255;
            }
        }

        static void ModoT(uint hi, uint idx, int* o)
        {
            int r1 = E4((int)((hi >> 27 & 3) << 2 | (hi >> 24 & 3))), g1 = E4((int)(hi >> 20 & 15)), b1 = E4((int)(hi >> 16 & 15));
            int r2 = E4((int)(hi >> 12 & 15)), g2 = E4((int)(hi >> 8 & 15)), b2 = E4((int)(hi >> 4 & 15));
            int d = DISTANCIA[(int)((hi >> 2 & 3) << 1 | (hi & 1))];
            var p = stackalloc int[12] { r1, g1, b1, C(r2 + d), C(g2 + d), C(b2 + d), r2, g2, b2, C(r2 - d), C(g2 - d), C(b2 - d) };
            Pintar(idx, o, p);
        }

        static void ModoH(uint hi, uint idx, int* o)
        {
            int r1c = (int)(hi >> 27 & 15), g1c = (int)((hi >> 24 & 7) << 1 | (hi >> 20 & 1)), b1c = (int)((hi >> 19 & 1) << 3 | (hi >> 15 & 7));
            int r2c = (int)(hi >> 11 & 15), g2c = (int)(hi >> 7 & 15), b2c = (int)(hi >> 3 & 15);
            int v1 = r1c << 8 | g1c << 4 | b1c, v2 = r2c << 8 | g2c << 4 | b2c;
            int di = (int)((hi >> 2 & 1) << 2 | (hi & 1) << 1) | (v1 >= v2 ? 1 : 0);
            int d = DISTANCIA[di];
            int r1 = E4(r1c), g1 = E4(g1c), b1 = E4(b1c), r2 = E4(r2c), g2 = E4(g2c), b2 = E4(b2c);
            var p = stackalloc int[12] { C(r1 + d), C(g1 + d), C(b1 + d), C(r1 - d), C(g1 - d), C(b1 - d), C(r2 + d), C(g2 + d), C(b2 + d), C(r2 - d), C(g2 - d), C(b2 - d) };
            Pintar(idx, o, p);
        }

        static void ModoPlano(ulong b, int* o)
        {
            int ro = (int)(b >> 57 & 63), go = (int)((b >> 56 & 1) << 6 | (b >> 49 & 63)), bo = (int)((b >> 48 & 1) << 5 | (b >> 43 & 3) << 3 | (b >> 39 & 7));
            int rh = (int)((b >> 34 & 31) << 1 | (b >> 32 & 1)), gh = (int)(b >> 25 & 127), bh = (int)(b >> 19 & 63);
            int rv = (int)(b >> 13 & 63), gv = (int)(b >> 6 & 127), bv = (int)(b & 63);
            ro = ro << 2 | ro >> 4; bo = bo << 2 | bo >> 4; go = go << 1 | go >> 6;
            rh = rh << 2 | rh >> 4; bh = bh << 2 | bh >> 4; gh = gh << 1 | gh >> 6;
            rv = rv << 2 | rv >> 4; bv = bv << 2 | bv >> 4; gv = gv << 1 | gv >> 6;
            for (int x = 0; x < 4; x++)
                for (int y = 0; y < 4; y++)
                {
                    int* q = o + (x * 4 + y) * 4;
                    q[0] = C((x * (rh - ro) + y * (rv - ro) + 4 * ro + 2) >> 2);
                    q[1] = C((x * (gh - go) + y * (gv - go) + 4 * go + 2) >> 2);
                    q[2] = C((x * (bh - bo) + y * (bv - bo) + 4 * bo + 2) >> 2);
                    q[3] = 255;
                }
        }

        static void Alfa(ulong a, int* o)
        {
            int base_ = (int)(a >> 56 & 255), mult = (int)(a >> 52 & 15), tabla = (int)(a >> 48 & 15);
            for (int k = 0; k < 16; k++)
            {
                int s = (int)(a >> (45 - k * 3) & 7);
                o[k * 4 + 3] = C(base_ + EAC[tabla, s] * mult);
            }
        }
    }
}

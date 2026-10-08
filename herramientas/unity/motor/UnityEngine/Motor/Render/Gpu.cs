using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using UnityEngine;

namespace Porteo.Render
{
    // El estado de WebGL 2 visto desde el motor: el contexto, las extensiones, las texturas por
    // defecto de ShaderLab, el caché de estado (para no repetir llamadas) y los programas.
    public static unsafe class Gpu
    {
        public static bool Activo;
        public static bool Etc, S3tc, Astc, Aniso, ColorFloat, FloatLineal;
        public static int MaxTextura = 4096, MaxUnidades = 16, MaxMuestras;
        public static int Ancho = 1, Alto = 1;   // el lienzo, en píxeles

        public static uint TexBlanca, TexNegra, TexGris, TexBump, TexRoja, TexGrisLineal, CuboNegro, CuboGris, Tex3DBlanca;

        public static bool Iniciar(string selector, bool antialias)
        {
            int r;
            var sel = Encoding.UTF8.GetBytes(selector + "\0");
            fixed (byte* s = sel) r = Gl.porteo_contexto(s, antialias ? 1 : 0, 0);
            if (r != 1) { Debug.LogError("porteo: no hay WebGL 2 (" + r + ")"); return false; }
            Etc = Extension("WEBGL_compressed_texture_etc");
            S3tc = Extension("WEBGL_compressed_texture_s3tc");
            Astc = Extension("WEBGL_compressed_texture_astc");
            Aniso = Extension("EXT_texture_filter_anisotropic");
            ColorFloat = Extension("EXT_color_buffer_float");
            FloatLineal = Extension("OES_texture_float_linear");
            Extension("EXT_color_buffer_half_float");
            int v;
            Gl.GetIntegerv(Gl.MAX_TEXTURE_SIZE, &v); MaxTextura = v;
            Gl.GetIntegerv(Gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS, &v); MaxUnidades = Math.Min(v, 32);
            Gl.GetIntegerv(Gl.MAX_SAMPLES, &v); MaxMuestras = v;
            Debug.Log($"porteo: {Cadena(Gl.VERSION)} | {Cadena(Gl.RENDERER)} | ETC {Etc} S3TC {S3tc} ASTC {Astc}");
            // Unity dibuja con el frente horario (sistema de mano izquierda) en OpenGL
            Gl.FrontFace(Gl.CW);
            Gl.Enable(Gl.DEPTH_TEST);
            Gl.PixelStorei(Gl.UNPACK_ALIGNMENT, 1);
            Gl.PixelStorei(Gl.PACK_ALIGNMENT, 1);
            TexBlanca = Color1x1(255, 255, 255, 255);
            TexNegra = Color1x1(0, 0, 0, 0);
            TexGris = Color1x1(128, 128, 128, 255);
            TexGrisLineal = Color1x1(188, 188, 188, 255);
            TexBump = Color1x1(128, 128, 255, 255);
            TexRoja = Color1x1(255, 0, 0, 255);
            CuboNegro = Cubo1x1(0, 0, 0, 0);
            CuboGris = Cubo1x1(128, 128, 128, 255);
            Activo = true;
            return true;
        }

        public static bool Extension(string nombre)
        {
            var b = Encoding.UTF8.GetBytes(nombre + "\0");
            fixed (byte* p = b) return Gl.porteo_extension(p) != 0;
        }

        static string Cadena(uint q)
        {
            var p = Gl.GetString(q);
            return p == null ? "" : Marshal.PtrToStringUTF8((IntPtr)p);
        }

        public static void ActualizarTamano()
        {
            int a, h;
            Gl.porteo_tamano(&a, &h);
            Ancho = Math.Max(1, a); Alto = Math.Max(1, h);
        }

        static uint Color1x1(byte r, byte g, byte b, byte a)
        {
            uint t;
            Gl.GenTextures(1, &t);
            Gl.BindTexture(Gl.TEXTURE_2D, t);
            var px = stackalloc byte[4] { r, g, b, a };
            Gl.TexImage2D(Gl.TEXTURE_2D, 0, Gl.RGBA8, 1, 1, 0, Gl.RGBA, Gl.UNSIGNED_BYTE, px);
            Gl.TexParameteri(Gl.TEXTURE_2D, Gl.TEXTURE_MIN_FILTER, Gl.NEAREST);
            Gl.TexParameteri(Gl.TEXTURE_2D, Gl.TEXTURE_MAG_FILTER, Gl.NEAREST);
            unidades[0] = 0;
            return t;
        }

        static uint Cubo1x1(byte r, byte g, byte b, byte a)
        {
            uint t;
            Gl.GenTextures(1, &t);
            Gl.BindTexture(Gl.TEXTURE_CUBE_MAP, t);
            var px = stackalloc byte[4] { r, g, b, a };
            for (uint i = 0; i < 6; i++)
                Gl.TexImage2D(Gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, Gl.RGBA8, 1, 1, 0, Gl.RGBA, Gl.UNSIGNED_BYTE, px);
            Gl.TexParameteri(Gl.TEXTURE_CUBE_MAP, Gl.TEXTURE_MIN_FILTER, Gl.LINEAR);
            Gl.TexParameteri(Gl.TEXTURE_CUBE_MAP, Gl.TEXTURE_MAG_FILTER, Gl.LINEAR);
            unidades[0] = 0;
            return t;
        }

        // la textura por defecto de una propiedad de ShaderLab ("white", "black", "bump"...)
        public static uint PorDefecto(string nombre, bool cubo)
        {
            if (cubo) return nombre == "black" ? CuboNegro : CuboGris;
            switch (nombre)
            {
                case "white": return TexBlanca;
                case "black": return TexNegra;
                case "bump": return TexBump;
                case "red": return TexRoja;
                case "linearGray": return TexGrisLineal;
                default: return TexGris;
            }
        }

        // ── caché de estado ──
        static uint programa, vao;
        static readonly uint[] unidades = new uint[32];
        static readonly uint[] objetivos = new uint[32];
        static int unidadActiva = -1;

        public static void UsarPrograma(uint p) { if (programa != p) { Gl.UseProgram(p); programa = p; } }
        public static void UsarVao(uint v) { if (vao != v) { Gl.BindVertexArray(v); vao = v; } }
        public static void OlvidarVao() { vao = uint.MaxValue; }

        public static void Textura(int unidad, uint objetivo, uint t)
        {
            if (unidades[unidad] == t && objetivos[unidad] == objetivo) return;
            if (unidadActiva != unidad) { Gl.ActiveTexture(Gl.TEXTURE0 + (uint)unidad); unidadActiva = unidad; }
            if (objetivos[unidad] != objetivo && objetivos[unidad] != 0 && unidades[unidad] != 0) Gl.BindTexture(objetivos[unidad], 0);
            Gl.BindTexture(objetivo, t);
            unidades[unidad] = t; objetivos[unidad] = objetivo;
        }

        // para crear o subir una textura sin pisar lo que quedó atado
        public static void AtarParaSubir(uint objetivo, uint t)
        {
            if (unidadActiva != 0) { Gl.ActiveTexture(Gl.TEXTURE0); unidadActiva = 0; }
            Gl.BindTexture(objetivo, t);
            unidades[0] = t; objetivos[0] = objetivo;
        }

        public static void TexturaBorrada(uint t)
        {
            for (int i = 0; i < unidades.Length; i++) if (unidades[i] == t) unidades[i] = 0;
        }

        // el estado de una pasada: profundidad, caras, mezcla, máscara de color, desplazamiento
        public struct Estado
        {
            public bool ZEscribe;
            public byte ZPrueba;      // CompareFunction de Unity: 0 desactivada, 1 Never ... 8 Always
            public byte Caras;        // 0 Off, 1 Front, 2 Back
            public byte MezclaSrc, MezclaDst, MezclaSrcA, MezclaDstA;   // BlendMode de Unity
            public byte OpColor, OpAlfa;   // BlendOp de Unity
            public byte Mascara;      // ColorWriteMask
            public float OffsetFactor, OffsetUnidades;
            public bool Stencil;
            public byte StRef, StLeer, StEscribir, StComp, StPasa, StFalla, StFallaZ;
            public bool AlfaACobertura;

            public static Estado Opaco => new Estado { ZEscribe = true, ZPrueba = 4, Caras = 2, MezclaSrc = 1, MezclaDst = 0, MezclaSrcA = 1, MezclaDstA = 0, Mascara = 15 };
        }

        static Estado actual;
        static bool hayActual, espejo, stencilSucio;

        public static void Olvidar() { hayActual = false; programa = 0; vao = uint.MaxValue; Array.Clear(unidades, 0, unidades.Length); unidadActiva = -1; }

        // Borrar el destino: glClear respeta las máscaras de escritura, así que se abren todas
        // (y la próxima pasada con stencil vuelve a poner la suya).
        public static void Limpiar(uint bits)
        {
            Aplicar(Estado.Opaco);
            if ((bits & Gl.STENCIL_BUFFER_BIT) != 0) { Gl.StencilMask(0xFF); stencilSucio = true; }
            Gl.Clear(bits);
        }

        static readonly uint[] COMPARAR = { Gl.ALWAYS, Gl.NEVER, Gl.LESS, Gl.EQUAL, Gl.LEQUAL, Gl.GREATER, Gl.NOTEQUAL, Gl.GEQUAL, Gl.ALWAYS };
        static readonly uint[] MEZCLA = { Gl.ZERO, Gl.ONE, Gl.DST_COLOR, Gl.SRC_COLOR, Gl.ONE_MINUS_DST_COLOR, Gl.SRC_ALPHA, Gl.ONE_MINUS_SRC_COLOR,
            Gl.DST_ALPHA, Gl.ONE_MINUS_DST_ALPHA, Gl.SRC_ALPHA_SATURATE, Gl.ONE_MINUS_SRC_ALPHA };
        static readonly uint[] OPERACION = { Gl.FUNC_ADD, Gl.FUNC_SUBTRACT, Gl.FUNC_REVERSE_SUBTRACT, Gl.MIN, Gl.MAX };
        static readonly uint[] STENCIL = { Gl.KEEP, Gl.ZERO, Gl.REPLACE, Gl.INCR, Gl.DECR, Gl.INVERT, Gl.INCR_WRAP, Gl.DECR_WRAP };

        // espejo: objeto con escala negativa (Unity invierte qué cara se descarta)
        public static void Aplicar(in Estado e, bool enEspejo = false)
        {
            bool todo = !hayActual;
            if (todo || e.ZEscribe != actual.ZEscribe) Gl.DepthMask((byte)(e.ZEscribe ? 1 : 0));
            if (todo || e.ZPrueba != actual.ZPrueba)
            {
                if (e.ZPrueba == 0) Gl.Disable(Gl.DEPTH_TEST);
                else
                {
                    if (!todo && actual.ZPrueba == 0) Gl.Enable(Gl.DEPTH_TEST);
                    else if (todo) Gl.Enable(Gl.DEPTH_TEST);
                    Gl.DepthFunc(COMPARAR[Math.Min((int)e.ZPrueba, 8)]);
                }
            }
            if (todo || e.Caras != actual.Caras || enEspejo != espejo)
            {
                if (e.Caras == 0) Gl.Disable(Gl.CULL_FACE);
                else
                {
                    Gl.Enable(Gl.CULL_FACE);
                    bool frente = e.Caras == 1;
                    if (enEspejo) frente = !frente;
                    Gl.CullFace(frente ? Gl.FRONT : Gl.BACK);
                }
                espejo = enEspejo;
            }
            bool mezcla = !(e.MezclaSrc == 1 && e.MezclaDst == 0 && e.MezclaSrcA == 1 && e.MezclaDstA == 0 && e.OpColor == 0 && e.OpAlfa == 0);
            bool mezclaAntes = hayActual && !(actual.MezclaSrc == 1 && actual.MezclaDst == 0 && actual.MezclaSrcA == 1 && actual.MezclaDstA == 0 && actual.OpColor == 0 && actual.OpAlfa == 0);
            if (todo || mezcla != mezclaAntes) { if (mezcla) Gl.Enable(Gl.BLEND); else Gl.Disable(Gl.BLEND); }
            if (mezcla && (todo || !mezclaAntes || e.MezclaSrc != actual.MezclaSrc || e.MezclaDst != actual.MezclaDst || e.MezclaSrcA != actual.MezclaSrcA || e.MezclaDstA != actual.MezclaDstA))
                Gl.BlendFuncSeparate(MEZCLA[Math.Min((int)e.MezclaSrc, 10)], MEZCLA[Math.Min((int)e.MezclaDst, 10)], MEZCLA[Math.Min((int)e.MezclaSrcA, 10)], MEZCLA[Math.Min((int)e.MezclaDstA, 10)]);
            if (mezcla && (todo || !mezclaAntes || e.OpColor != actual.OpColor || e.OpAlfa != actual.OpAlfa))
                Gl.BlendEquationSeparate(OPERACION[Math.Min((int)e.OpColor, 4)], OPERACION[Math.Min((int)e.OpAlfa, 4)]);
            if (todo || e.Mascara != actual.Mascara)
            {
                // ColorWriteMask de Unity: A=1, B=2, G=4, R=8
                int m = e.Mascara;
                Gl.ColorMask((byte)((m & 8) != 0 ? 1 : 0), (byte)((m & 4) != 0 ? 1 : 0), (byte)((m & 2) != 0 ? 1 : 0), (byte)((m & 1) != 0 ? 1 : 0));
            }
            if (todo || e.OffsetFactor != actual.OffsetFactor || e.OffsetUnidades != actual.OffsetUnidades)
            {
                if (e.OffsetFactor == 0 && e.OffsetUnidades == 0) Gl.Disable(Gl.POLYGON_OFFSET_FILL);
                else { Gl.Enable(Gl.POLYGON_OFFSET_FILL); Gl.PolygonOffset(e.OffsetFactor, e.OffsetUnidades); }
            }
            if (todo || e.Stencil != actual.Stencil || e.Stencil && (stencilSucio || e.StRef != actual.StRef || e.StLeer != actual.StLeer || e.StEscribir != actual.StEscribir ||
                e.StComp != actual.StComp || e.StPasa != actual.StPasa || e.StFalla != actual.StFalla || e.StFallaZ != actual.StFallaZ))
            {
                if (!e.Stencil) Gl.Disable(Gl.STENCIL_TEST);
                else
                {
                    Gl.Enable(Gl.STENCIL_TEST);
                    Gl.StencilFuncSeparate(Gl.FRONT_AND_BACK, COMPARAR[Math.Min((int)e.StComp, 8)], e.StRef, e.StLeer);
                    Gl.StencilOpSeparate(Gl.FRONT_AND_BACK, STENCIL[Math.Min((int)e.StFalla, 7)], STENCIL[Math.Min((int)e.StFallaZ, 7)], STENCIL[Math.Min((int)e.StPasa, 7)]);
                    Gl.StencilMask(e.StEscribir);
                    stencilSucio = false;
                }
            }
            if (todo || e.AlfaACobertura != actual.AlfaACobertura)
            {
                if (e.AlfaACobertura) Gl.Enable(Gl.SAMPLE_ALPHA_TO_COVERAGE); else Gl.Disable(Gl.SAMPLE_ALPHA_TO_COVERAGE);
            }
            actual = e;
            hayActual = true;
        }

        // ── buffers ──
        public static uint Buffer(uint objetivo, void* datos, int tam, uint uso)
        {
            uint b;
            Gl.GenBuffers(1, &b);
            UsarVao(0);
            Gl.BindBuffer(objetivo, b);
            Gl.BufferData(objetivo, tam, datos, uso);
            return b;
        }

        public static void Borrar(ref uint buffer)
        {
            if (buffer == 0) return;
            uint b = buffer;
            Gl.DeleteBuffers(1, &b);
            buffer = 0;
        }
    }

    // Una variable de un programa: de dónde sale su valor se decide por el nombre.
    public struct Uniforme
    {
        public int Id;          // propiedad (el nombre sin [0])
        public int Loc;
        public uint Tipo;
        public int N;           // tamaño del arreglo
        public int Unidad;      // unidad de textura (-1: no es textura)
        public uint Objetivo;   // TEXTURE_2D / CUBE_MAP / 3D
    }

    // Un programa de GL armado con el GLSL de GLES3 de Unity (un subprograma de una pasada).
    public sealed unsafe class Programa
    {
        public uint Id;
        public string Nombre;
        public Uniforme[] Uniformes;
        public readonly int[] Atributos = new int[Canales.CANTIDAD + 4];   // location por canal (-1: no lo usa); al final las 4 columnas de la matriz por instancia
        public bool Instanciado;
        public int Serie;

        // lo último que se subió (para no repetir uniforms)
        internal object ultimaFuente;
        internal int ultimaVersion = -1, versionGlobal = -1, versionObjeto = -1;
        internal object ultimoBloque; internal int versionBloque = -1;

        static int series;
        static readonly Dictionary<string, Programa> cache = new Dictionary<string, Programa>();
        static readonly HashSet<string> fallidos = new HashSet<string>();

        public static Programa De(string vs, string fs, string nombre, bool instanciar)
        {
            if (instanciar) (vs, fs) = Instancias.Reescribir(vs, fs);
            var clave = vs + "\u0001" + fs;
            if (cache.TryGetValue(clave, out var p)) return p;
            p = Compilar(vs, fs, nombre);
            if (p != null) p.Instanciado = instanciar && vs.Contains("in_O2W0");
            cache[clave] = p;
            return p;
        }

        static uint Etapa(uint tipo, string fuente, string nombre)
        {
            uint s = Gl.CreateShader(tipo);
            var bytes = Encoding.UTF8.GetBytes("#version 300 es\n" + fuente + "\0");
            fixed (byte* b = bytes)
            {
                byte* arr = b;
                Gl.ShaderSource(s, 1, &arr, null);
            }
            Gl.CompileShader(s);
            int ok;
            Gl.GetShaderiv(s, Gl.COMPILE_STATUS, &ok);
            if (ok == 0)
            {
                if (fallidos.Add(nombre + tipo)) Debug.LogWarning($"porteo: no compila {nombre} ({(tipo == Gl.VERTEX_SHADER ? "vertex" : "fragment")}): {LogShader(s)}");
                Gl.DeleteShader(s);
                return 0;
            }
            return s;
        }

        static string LogShader(uint s)
        {
            var buf = new byte[4096]; int n;
            fixed (byte* b = buf) Gl.GetShaderInfoLog(s, buf.Length, &n, b);
            return Encoding.UTF8.GetString(buf, 0, Math.Max(0, n));
        }

        static Programa Compilar(string vs, string fs, string nombre)
        {
            uint v = Etapa(Gl.VERTEX_SHADER, vs, nombre);
            uint f = v == 0 ? 0 : Etapa(Gl.FRAGMENT_SHADER, fs, nombre);
            if (v == 0 || f == 0) { if (v != 0) Gl.DeleteShader(v); return null; }
            uint p = Gl.CreateProgram();
            Gl.AttachShader(p, v);
            Gl.AttachShader(p, f);
            Gl.LinkProgram(p);
            Gl.DeleteShader(v);
            Gl.DeleteShader(f);
            int ok;
            Gl.GetProgramiv(p, Gl.LINK_STATUS, &ok);
            if (ok == 0)
            {
                var buf = new byte[4096]; int n;
                fixed (byte* b = buf) Gl.GetProgramInfoLog(p, buf.Length, &n, b);
                if (fallidos.Add(nombre + "link")) Debug.LogWarning($"porteo: no enlaza {nombre}: {Encoding.UTF8.GetString(buf, 0, Math.Max(0, n))}");
                Gl.DeleteProgram(p);
                return null;
            }
            var r = new Programa { Id = p, Nombre = nombre, Serie = ++series };
            r.Reflejar();
            return r;
        }

        void Reflejar()
        {
            int n;
            Gl.GetProgramiv(Id, Gl.ACTIVE_UNIFORMS, &n);
            var l = new List<Uniforme>(n);
            var nombre = new byte[256];
            int unidad = 0;
            Gpu.UsarPrograma(Id);
            for (uint i = 0; i < n; i++)
            {
                int largo, tam; uint tipo;
                fixed (byte* b = nombre)
                {
                    Gl.GetActiveUniform(Id, i, nombre.Length, &largo, &tam, &tipo, b);
                    var s = Encoding.UTF8.GetString(nombre, 0, largo);
                    int loc = Gl.GetUniformLocation(Id, b);
                    if (loc < 0) continue;
                    var baseN = s.EndsWith("[0]", StringComparison.Ordinal) ? s.Substring(0, s.Length - 3) : s;
                    var u = new Uniforme { Id = Ids.De(baseN), Loc = loc, Tipo = tipo, N = tam, Unidad = -1 };
                    if (tipo == Gl.SAMPLER_2D || tipo == Gl.SAMPLER_CUBE || tipo == Gl.SAMPLER_3D || tipo == Gl.SAMPLER_2D_SHADOW || tipo == Gl.SAMPLER_2D_ARRAY)
                    {
                        u.Unidad = unidad++;
                        u.Objetivo = tipo == Gl.SAMPLER_CUBE ? Gl.TEXTURE_CUBE_MAP : tipo == Gl.SAMPLER_3D ? Gl.TEXTURE_3D : Gl.TEXTURE_2D;
                        Gl.Uniform1i(loc, u.Unidad);
                    }
                    l.Add(u);
                }
            }
            Uniformes = l.ToArray();
            for (int i = 0; i < Atributos.Length; i++) Atributos[i] = -1;
            Gl.GetProgramiv(Id, Gl.ACTIVE_ATTRIBUTES, &n);
            for (uint i = 0; i < n; i++)
            {
                int largo, tam; uint tipo;
                fixed (byte* b = nombre)
                {
                    Gl.GetActiveAttrib(Id, i, nombre.Length, &largo, &tam, &tipo, b);
                    var s = Encoding.UTF8.GetString(nombre, 0, largo);
                    int loc = Gl.GetAttribLocation(Id, b);
                    int c = Canales.DeAtributo(s);
                    if (c >= 0 && loc >= 0) Atributos[c] = loc;
                }
            }
        }
    }

    // Los canales de vértice de Unity 2018 y los nombres de atributo del GLSL de hlslcc.
    public static class Canales
    {
        public const int POSICION = 0, NORMAL = 1, TANGENTE = 2, COLOR = 3, UV0 = 4, PESOS = 12, HUESOS = 13, CANTIDAD = 14;
        public const int O2W = CANTIDAD;   // las 4 columnas de la matriz por instancia: CANTIDAD..CANTIDAD+3

        public static int DeAtributo(string n)
        {
            switch (n)
            {
                case "in_POSITION0": return POSICION;
                case "in_NORMAL0": return NORMAL;
                case "in_TANGENT0": return TANGENTE;
                case "in_COLOR0": return COLOR;
                case "in_BLENDWEIGHTS0": case "in_BLENDWEIGHT0": return PESOS;
                case "in_BLENDINDICES0": return HUESOS;
                case "in_O2W0": return O2W;
                case "in_O2W1": return O2W + 1;
                case "in_O2W2": return O2W + 2;
                case "in_O2W3": return O2W + 3;
            }
            if (n.StartsWith("in_TEXCOORD", StringComparison.Ordinal) && n.Length == 12 && n[11] >= '0' && n[11] <= '7') return UV0 + (n[11] - '0');
            return -1;
        }
    }

    // Para dibujar muchas copias de una malla en una sola llamada, la matriz del objeto
    // (unity_ObjectToWorld) pasa de uniform a atributo por instancia y la inversa se calcula en el
    // shader. Si el fragment también la usa, el vertex le pasa esas columnas sin interpolar.
    public static class Instancias
    {
        static readonly Regex O2W = new Regex(@"uniform\s+(?:highp\s+)?vec4\s+hlslcc_mtx4x4unity_ObjectToWorld\[4\];", RegexOptions.Compiled);
        static readonly Regex W2O = new Regex(@"uniform\s+(?:highp\s+)?vec4\s+hlslcc_mtx4x4unity_WorldToObject\[4\];", RegexOptions.Compiled);
        static readonly Regex MAIN = new Regex(@"void\s+main\s*\(\s*\)\s*\{", RegexOptions.Compiled);

        static List<string> Columnas(string f, string nombre)
        {
            var l = new List<string>();
            foreach (Match m in Regex.Matches(f, "hlslcc_mtx4x4unity_" + nombre + @"\[([0-3])\]"))
                if (!l.Contains(m.Groups[1].Value)) l.Add(m.Groups[1].Value);
            return l;
        }

        public static (string, string) Reescribir(string vs, string fs)
        {
            if (!O2W.IsMatch(vs)) return (vs, fs);
            var fsO2W = O2W.IsMatch(fs) ? Columnas(fs, "ObjectToWorld") : new List<string>();
            var fsW2O = W2O.IsMatch(fs) ? Columnas(fs, "WorldToObject") : new List<string>();
            bool usaW2O = W2O.IsMatch(vs) || fsW2O.Count > 0;
            var decl = new StringBuilder("in highp vec4 in_O2W0;\nin highp vec4 in_O2W1;\nin highp vec4 in_O2W2;\nin highp vec4 in_O2W3;\nhighp mat4 porteo_O2W;\nhighp mat4 porteo_W2O;\n");
            var pasar = new StringBuilder();
            foreach (var c in fsO2W) { decl.Append("flat out highp vec4 porteo_fO2W").Append(c).Append(";\n"); pasar.Append("    porteo_fO2W").Append(c).Append(" = porteo_O2W[").Append(c).Append("];\n"); }
            foreach (var c in fsW2O) { decl.Append("flat out highp vec4 porteo_fW2O").Append(c).Append(";\n"); pasar.Append("    porteo_fW2O").Append(c).Append(" = porteo_W2O[").Append(c).Append("];\n"); }
            vs = W2O.Replace(vs, "");
            vs = O2W.Replace(vs, decl.ToString(), 1);
            vs = vs.Replace("hlslcc_mtx4x4unity_ObjectToWorld", "porteo_O2W").Replace("hlslcc_mtx4x4unity_WorldToObject", "porteo_W2O");
            vs = MAIN.Replace(vs, "void main()\n{\n    porteo_O2W = mat4(in_O2W0, in_O2W1, in_O2W2, in_O2W3);\n" + (usaW2O ? "    porteo_W2O = inverse(porteo_O2W);\n" : "") + pasar, 1);
            if (fsO2W.Count > 0)
            {
                var d = new StringBuilder();
                foreach (var c in fsO2W) d.Append("flat in highp vec4 porteo_fO2W").Append(c).Append(";\n");
                fs = O2W.Replace(fs, d.ToString(), 1);
                fs = Regex.Replace(fs, @"hlslcc_mtx4x4unity_ObjectToWorld\[(\d)\]", "porteo_fO2W$1");
            }
            if (fsW2O.Count > 0)
            {
                var d = new StringBuilder();
                foreach (var c in fsW2O) d.Append("flat in highp vec4 porteo_fW2O").Append(c).Append(";\n");
                fs = W2O.Replace(fs, d.ToString(), 1);
                fs = Regex.Replace(fs, @"hlslcc_mtx4x4unity_WorldToObject\[(\d)\]", "porteo_fW2O$1");
            }
            return (vs, fs);
        }
    }
}

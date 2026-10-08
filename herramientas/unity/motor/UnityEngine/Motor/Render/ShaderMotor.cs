using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using Porteo;
using UnityEngine;
using Object = UnityEngine.Object;
using Porteo.Datos;
using Porteo.Render;

namespace Porteo.Render
{
    // Un valor del estado de una pasada: fijo o tomado de una propiedad del material ([_ZWrite]).
    public struct ValorEstado
    {
        public float Val;
        public int Prop;   // -1: fijo

        public float De(Material m)
        {
            if (Prop < 0) return Val;
            // la propiedad del material; si no la tiene, la global (unity_GUIZTestMode, por ejemplo)
            if ((object)m != null && m.props.Leer(Prop, out var v) && v.Tipo == TipoValor.Numero) return v.V.x;
            if (Globales.Tabla.Leer(Prop, out v) && v.Tipo == TipoValor.Numero) return v.V.x;
            return Val;
        }
    }

    public sealed class EstadoPasada
    {
        public ValorEstado ZEscribe, ZPrueba, Caras, Src, Dst, SrcA, DstA, OpC, OpA, Mascara, OffF, OffU, AlfaCob;
        public ValorEstado StRef, StLeer, StEscribir, StComp, StPasa, StFalla, StFallaZ;
        public bool HayStencil;

        public Gpu.Estado Resolver(Material m)
        {
            var e = new Gpu.Estado
            {
                ZEscribe = ZEscribe.De(m) != 0,
                ZPrueba = (byte)ZPrueba.De(m),
                Caras = (byte)Caras.De(m),
                MezclaSrc = (byte)Src.De(m), MezclaDst = (byte)Dst.De(m), MezclaSrcA = (byte)SrcA.De(m), MezclaDstA = (byte)DstA.De(m),
                OpColor = (byte)OpC.De(m), OpAlfa = (byte)OpA.De(m),
                Mascara = (byte)Mascara.De(m),
                OffsetFactor = OffF.De(m), OffsetUnidades = OffU.De(m),
                AlfaACobertura = AlfaCob.De(m) != 0,
            };
            if (HayStencil)
            {
                e.StComp = (byte)StComp.De(m);
                e.StRef = (byte)StRef.De(m); e.StLeer = (byte)StLeer.De(m); e.StEscribir = (byte)StEscribir.De(m);
                e.StPasa = (byte)StPasa.De(m); e.StFalla = (byte)StFalla.De(m); e.StFallaZ = (byte)StFallaZ.De(m);
                // comparar siempre y no tocar nada es lo mismo que no usar stencil
                e.Stencil = !(e.StComp == 8 && e.StPasa == 0 && e.StFalla == 0 && e.StFallaZ == 0 && e.StRef == 0);
            }
            return e;
        }
    }

    public struct Variante
    {
        public int Blob;
        public string[] Kw;
        public int Tier;
    }

    public sealed class PasadaShader
    {
        public string Nombre = "", LightMode = "", UseName = "", TexturaGrab = "";
        public int Tipo;   // 0 normal, 1 UsePass, 2 GrabPass
        public EstadoPasada Estado;
        public Variante[] Vertex = Array.Empty<Variante>(), Fragment = Array.Empty<Variante>();
        public HashSet<string> Relevantes = new HashSet<string>();
        public Dictionary<string, string> Tags = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        internal readonly Dictionary<string, Programa> programas = new Dictionary<string, Programa>();

        public bool Dibujable => Tipo == 0 && Vertex.Length > 0 && Fragment.Length > 0;
    }

    public sealed class SubShader
    {
        public int Lod;
        public Dictionary<string, string> Tags = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        public PasadaShader[] Pasadas = Array.Empty<PasadaShader>();
        public bool Soportado;
    }

    public sealed class PropShader
    {
        public string Nombre;
        public int Id;
        public int Tipo;          // 0 Color, 1 Vector, 2 Float, 3 Range, 4 Texture
        public UnityEngine.Vector4 Def;
        public string TexDef;
        public int TexDim;        // 2 2D, 3 3D, 4 Cube
    }

    // Las palabras clave globales (Shader.EnableKeyword) y las que pone el motor según la luz y la niebla.
    public static class Claves
    {
        public static readonly HashSet<string> Globales = new HashSet<string>();
        public static int Version = 1;

        // las del motor, como bits (para cachear el programa elegido)
        public const int DIRECTIONAL = 1, LIGHTPROBE_SH = 2, VERTEXLIGHT_ON = 4, SHADOWS_SCREEN = 8, FOG_LINEAR = 16, FOG_EXP = 32, FOG_EXP2 = 64,
            POINT = 128, SPOT = 256, POINT_COOKIE = 512, DIRECTIONAL_COOKIE = 1024, SHADOWS_DEPTH = 2048, SHADOWS_CUBE = 4096, SHADOWS_SOFT = 8192,
            SOFTPARTICLES_ON = 16384, UNITY_HDR_ON = 32768,
            // la UI: el CanvasRenderer la prende cuando hay recorte (RectMask2D)
            UNITY_UI_CLIP_RECT = 65536;
        static readonly string[] NOMBRES = { "DIRECTIONAL", "LIGHTPROBE_SH", "VERTEXLIGHT_ON", "SHADOWS_SCREEN", "FOG_LINEAR", "FOG_EXP", "FOG_EXP2",
            "POINT", "SPOT", "POINT_COOKIE", "DIRECTIONAL_COOKIE", "SHADOWS_DEPTH", "SHADOWS_CUBE", "SHADOWS_SOFT", "SOFTPARTICLES_ON", "UNITY_HDR_ON",
            "UNITY_UI_CLIP_RECT" };

        public static void Agregar(int mascara, List<string> l)
        {
            for (int i = 0; i < NOMBRES.Length; i++) if ((mascara & (1 << i)) != 0) l.Add(NOMBRES[i]);
        }
    }
}

namespace UnityEngine
{
    public sealed partial class Shader : Object
    {
        internal PropShader[] propiedades = Array.Empty<PropShader>();
        internal SubShader[] subshaders = Array.Empty<SubShader>();
        internal string respaldo;
        internal int recursoGles = -1;
        internal byte[] glesEnLinea;
        List<(string vs, string fs)> fuentes;
        static readonly List<(string vs, string fs)> sinFuentes = new List<(string vs, string fs)>();
        int lodPropio = -1;
        internal SubShader activo;
        internal Shader respaldoShader;
        bool resuelto;

        // ── datos ──
        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            var pf = m.M("m_ParsedForm");
            if (pf == null) return;
            m_Name = pf.S("m_Name") ?? m_Name;
            respaldo = pf.S("m_FallbackName");
            var props = new List<PropShader>();
            var lp = pf.M("m_PropInfo")?.L("m_Props");
            if (lp != null)
                foreach (Mapa p in lp)
                {
                    var dt = p.M("m_DefTexture");
                    props.Add(new PropShader
                    {
                        Nombre = p.S("m_Name"), Id = Ids.De(p.S("m_Name")), Tipo = p.I32("m_Type"),
                        Def = new Vector4(p.F("m_DefValue[0]"), p.F("m_DefValue[1]"), p.F("m_DefValue[2]"), p.F("m_DefValue[3]")),
                        TexDef = dt?.S("m_DefaultName") ?? "", TexDim = dt?.I32("m_TexDim", 2) ?? 2,
                    });
                }
            propiedades = props.ToArray();
            var subs = new List<SubShader>();
            var ls = pf.L("m_SubShaders");
            if (ls != null)
                foreach (Mapa s in ls)
                {
                    var ss = new SubShader { Lod = s.I32("m_LOD") };
                    Tags(s.M("m_Tags"), ss.Tags);
                    var pasadas = new List<PasadaShader>();
                    var lpa = s.L("m_Passes");
                    if (lpa != null) foreach (Mapa p in lpa) pasadas.Add(LeerPasada(p));
                    ss.Pasadas = pasadas.ToArray();
                    ss.Soportado = pasadas.Exists(p => p.Dibujable || p.Tipo == 2);
                    subs.Add(ss);
                }
            subshaders = subs.ToArray();
            switch (m["_gles3"])
            {
                case Recurso rec: recursoGles = rec.Id; break;
                case byte[] b: glesEnLinea = b; break;
            }
        }

        static void Tags(Mapa m, Dictionary<string, string> d)
        {
            var l = m?.L("tags");
            if (l == null) return;
            foreach (var x in l)
                if (x is List<object> par && par.Count == 2 && par[0] is string k) d[k] = par[1] as string ?? "";
        }

        static ValorEstado VE(Mapa m)
        {
            if (m == null) return new ValorEstado { Val = 0, Prop = -1 };
            var n = m.S("name");
            return new ValorEstado { Val = m.F("val"), Prop = string.IsNullOrEmpty(n) || n == "<noninit>" ? -1 : Ids.De(n) };
        }

        static PasadaShader LeerPasada(Mapa p)
        {
            var pa = new PasadaShader { Tipo = p.I32("m_Type"), UseName = p.S("m_UseName") ?? "", TexturaGrab = p.S("m_TextureName") ?? "" };
            var st = p.M("m_State");
            if (st != null)
            {
                pa.Nombre = st.S("m_Name") ?? "";
                Tags(st.M("m_Tags"), pa.Tags);
                var b = st.M("rtBlend0");
                var e = new EstadoPasada
                {
                    ZEscribe = VE(st.M("zWrite")), ZPrueba = VE(st.M("zTest")), Caras = VE(st.M("culling")),
                    Src = VE(b?.M("srcBlend")), Dst = VE(b?.M("destBlend")), SrcA = VE(b?.M("srcBlendAlpha")), DstA = VE(b?.M("destBlendAlpha")),
                    OpC = VE(b?.M("blendOp")), OpA = VE(b?.M("blendOpAlpha")), Mascara = VE(b?.M("colMask")),
                    OffF = VE(st.M("offsetFactor")), OffU = VE(st.M("offsetUnits")), AlfaCob = VE(st.M("alphaToMask")),
                };
                var so = st.M("stencilOp");
                if (so != null)
                {
                    e.HayStencil = true;
                    e.StRef = VE(st.M("stencilRef")); e.StLeer = VE(st.M("stencilReadMask")); e.StEscribir = VE(st.M("stencilWriteMask"));
                    e.StComp = VE(so.M("comp")); e.StPasa = VE(so.M("pass")); e.StFalla = VE(so.M("fail")); e.StFallaZ = VE(so.M("zFail"));
                }
                pa.Estado = e;
            }
            else pa.Estado = new EstadoPasada();
            if (pa.Tags.TryGetValue("LIGHTMODE", out var lm)) pa.LightMode = lm.ToUpperInvariant();
            pa.Vertex = Variantes(p.M("progVertex"), pa.Relevantes);
            pa.Fragment = Variantes(p.M("progFragment"), pa.Relevantes);
            return pa;
        }

        // sólo los subprogramas de GLES3; las palabras clave se toman del propio programa (ver Fuentes)
        static Variante[] Variantes(Mapa prog, HashSet<string> relevantes)
        {
            var l = new List<Variante>();
            var sps = prog?.L("m_SubPrograms");
            if (sps == null) return Array.Empty<Variante>();
            foreach (Mapa sp in sps)
            {
                if (sp.I32("m_GpuProgramType") != 4) continue;
                l.Add(new Variante { Blob = sp.I32("m_BlobIndex"), Tier = sp.I32("m_ShaderHardwareTier") });
            }
            return l.ToArray();
        }

        // El GLSL de cada subprograma (se lee la primera vez que hace falta)
        List<(string vs, string fs)> Fuentes()
        {
            if (fuentes != null) return fuentes;
            byte[] b = glesEnLinea;
            // el GLSL viene en un recurso aparte: si todavía no llegó, se pide y se prueba otro cuadro
            if (b == null && recursoGles >= 0)
            {
                b = Anfitrion.Recurso(recursoGles, true);
                if (b == null) return sinFuentes;
            }
            fuentes = new List<(string, string)>();
            if (b == null) return fuentes;
            var kws = new List<string[]>();
            using (var doc = JsonDocument.Parse(b))
                foreach (var x in doc.RootElement.EnumerateArray())
                {
                    fuentes.Add((x.GetProperty("vs").GetString(), x.GetProperty("fs").GetString()));
                    var k = new List<string>();
                    foreach (var y in x.GetProperty("kw").EnumerateArray()) k.Add(y.GetString());
                    kws.Add(k.ToArray());
                }
            // las palabras clave de cada variante y las que le importan a cada pasada
            foreach (var ss in subshaders)
                foreach (var pa in ss.Pasadas)
                {
                    for (int i = 0; i < pa.Vertex.Length; i++)
                    {
                        int bl = pa.Vertex[i].Blob;
                        pa.Vertex[i].Kw = bl >= 0 && bl < kws.Count ? kws[bl] : Array.Empty<string>();
                        foreach (var k in pa.Vertex[i].Kw) pa.Relevantes.Add(k);
                    }
                    for (int i = 0; i < pa.Fragment.Length; i++)
                    {
                        int bl = pa.Fragment[i].Blob;
                        pa.Fragment[i].Kw = bl >= 0 && bl < kws.Count ? kws[bl] : Array.Empty<string>();
                        foreach (var k in pa.Fragment[i].Kw) pa.Relevantes.Add(k);
                    }
                }
            return fuentes;
        }

        // ── elegir lo que se dibuja ──
        // el primer subshader soportado dentro del LOD; si no hay, el del shader de respaldo
        internal Shader duenoActivo;

        internal SubShader Activo()
        {
            if (resuelto) return activo;
            resuelto = true;
            duenoActivo = this;
            int max = Math.Min(lodPropio >= 0 ? lodPropio : int.MaxValue, globalMaximumLODInterno);
            foreach (var ss in subshaders)
                if (ss.Soportado && ss.Lod <= max) { activo = ss; return activo; }
            foreach (var ss in subshaders)
                if (ss.Soportado) { activo = ss; return activo; }
            activo = null;
            if (!string.IsNullOrEmpty(respaldo) && respaldo != m_Name)
            {
                respaldoShader = Find(respaldo);
                if (respaldoShader != null && respaldoShader != this)
                {
                    activo = respaldoShader.Activo();
                    duenoActivo = respaldoShader.duenoActivo;
                }
            }
            return activo;
        }

        // El programa de una pasada para estas palabras clave: la variante que más coincide
        // (las que no le importan a la pasada se ignoran, como en Unity).
        internal Porteo.Render.Programa ProgramaDe(PasadaShader pa, List<string> claves, bool instanciar)
        {
            if (Activo() == null) return null;
            var dueno = duenoActivo ?? this;
            var fs = dueno.Fuentes();
            if (fs.Count == 0 || !pa.Dibujable) return null;
            var sb = new StringBuilder(instanciar ? "i" : "u");
            claves.Sort(StringComparer.Ordinal);
            foreach (var k in claves) if (pa.Relevantes.Contains(k)) sb.Append(' ').Append(k);
            var clave = sb.ToString();
            if (pa.programas.TryGetValue(clave, out var p)) return p;
            int v = Elegir(pa.Vertex, claves, pa.Relevantes), f = Elegir(pa.Fragment, claves, pa.Relevantes);
            p = null;
            if (v >= 0 && f >= 0 && pa.Vertex[v].Blob < fs.Count && pa.Fragment[f].Blob < fs.Count)
            {
                // en GLES el subprograma de vertex trae el GLSL de las dos etapas y el de fragment
                // suele venir vacío: entonces el fragment sale del mismo código que el vertex
                var frag = fs[pa.Fragment[f].Blob].fs;
                if (string.IsNullOrWhiteSpace(frag)) frag = fs[pa.Vertex[v].Blob].fs;
                p = Porteo.Render.Programa.De(fs[pa.Vertex[v].Blob].vs, frag, dueno.m_Name + "/" + pa.Nombre, instanciar);
            }
            pa.programas[clave] = p;
            return p;
        }

        static int Elegir(Variante[] vs, List<string> claves, HashSet<string> relevantes)
        {
            int mejor = -1, puntos = int.MinValue;
            for (int i = 0; i < vs.Length; i++)
            {
                var kw = vs[i].Kw ?? Array.Empty<string>();
                int coinciden = 0, sobran = 0;
                foreach (var k in kw) { if (claves.Contains(k)) coinciden++; else sobran++; }
                int faltan = 0;
                foreach (var k in claves) if (relevantes.Contains(k) && Array.IndexOf(kw, k) < 0) faltan++;
                // las que sobran son peores que las que faltan; a igualdad, la de tier 2 (GLES3 en teléfonos)
                int p = coinciden * 64 - sobran * 4096 - faltan * 64 - Math.Abs(vs[i].Tier - 1);
                if (p > puntos) { puntos = p; mejor = i; }
            }
            return mejor;
        }

        internal int Cola()
        {
            var ss = Activo();
            if (ss == null) return 2000;
            if (ss.Tags.TryGetValue("Queue", out var q)) return ColaDeTag(q);
            return 2000;
        }

        internal static int ColaDeTag(string q)
        {
            q = q.Trim();
            int i = 0;
            while (i < q.Length && char.IsLetter(q[i])) i++;
            var nombre = q.Substring(0, i);
            int b;
            switch (nombre.ToLowerInvariant())
            {
                case "background": b = 1000; break;
                case "geometry": b = 2000; break;
                case "alphatest": b = 2450; break;
                case "transparent": b = 3000; break;
                case "overlay": b = 4000; break;
                case "": return int.TryParse(q, out var n) ? n : 2000;
                default: b = 2000; break;
            }
            var resto = q.Substring(i).Replace(" ", "");
            if (resto.Length > 0 && int.TryParse(resto, out var d)) b += d;
            return b;
        }

        internal PropShader Propiedad(int id)
        {
            foreach (var p in propiedades) if (p.Id == id) return p;
            return null;
        }

        // ── API de Unity ──
        static int globalMaximumLODInterno = int.MaxValue;
        public static int globalMaximumLOD
        {
            get => globalMaximumLODInterno == int.MaxValue ? -1 : globalMaximumLODInterno;
            set { globalMaximumLODInterno = value < 0 ? int.MaxValue : value; foreach (var s in Porteo.Registro.Todos(typeof(Shader))) ((Shader)s).resuelto = false; }
        }

        public int maximumLOD
        {
            get => lodPropio;
            set { lodPropio = value; resuelto = false; }
        }

        public bool isSupported => Activo() != null;
        public int renderQueue => Cola();
        public int passCount => Activo()?.Pasadas.Length ?? 0;

        static readonly Dictionary<string, Shader> porNombre = new Dictionary<string, Shader>();

        public static Shader Find(string name)
        {
            if (name == null) return null;
            if (porNombre.TryGetValue(name, out var s) && s != null) return s;
            foreach (Shader x in Porteo.Registro.Todos(typeof(Shader)))
                if (x.m_Name == name) { porNombre[name] = x; return x; }
            // los que el proyecto registra (ScriptMapper) y los integrados
            s = Porteo.Datos.Ajustes.ShaderPorNombre(name);
            if (s != null) porNombre[name] = s;
            return s;
        }

        public static int PropertyToID(string name) => Ids.De(name);

        public static void EnableKeyword(string keyword) { if (Claves.Globales.Add(keyword)) Claves.Version++; }
        public static void DisableKeyword(string keyword) { if (Claves.Globales.Remove(keyword)) Claves.Version++; }
        public static bool IsKeywordEnabled(string keyword) => Claves.Globales.Contains(keyword);

        public static void SetGlobalFloat(string name, float value) => Globales.Tabla.Poner(Ids.De(name), Valor.Numero(value));
        public static void SetGlobalFloat(int nameID, float value) => Globales.Tabla.Poner(nameID, Valor.Numero(value));
        public static void SetGlobalInt(string name, int value) => Globales.Tabla.Poner(Ids.De(name), Valor.Numero(value));
        public static void SetGlobalInt(int nameID, int value) => Globales.Tabla.Poner(nameID, Valor.Numero(value));
        public static void SetGlobalVector(string name, Vector4 value) => Globales.Tabla.Poner(Ids.De(name), Valor.Vec(value));
        public static void SetGlobalVector(int nameID, Vector4 value) => Globales.Tabla.Poner(nameID, Valor.Vec(value));
        public static void SetGlobalColor(string name, Color value) => Globales.Tabla.Poner(Ids.De(name), Valor.Vec(value));
        public static void SetGlobalColor(int nameID, Color value) => Globales.Tabla.Poner(nameID, Valor.Vec(value));
        public static void SetGlobalTexture(string name, Texture value) => Globales.Tabla.PonerTextura(Ids.De(name), value);
        public static void SetGlobalTexture(int nameID, Texture value) => Globales.Tabla.PonerTextura(nameID, value);
        public static void SetGlobalMatrix(string name, Matrix4x4 value) => Globales.Tabla.Poner(Ids.De(name), Valor.Matriz(value));
        public static void SetGlobalMatrix(int nameID, Matrix4x4 value) => Globales.Tabla.Poner(nameID, Valor.Matriz(value));
        public static void SetGlobalFloatArray(string name, float[] values) => Globales.Tabla.Poner(Ids.De(name), Valor.Numeros(values));
        public static void SetGlobalVectorArray(string name, Vector4[] values) => Globales.Tabla.Poner(Ids.De(name), Valor.Vectores(values));

        public static float GetGlobalFloat(string name) => Globales.Tabla[Ids.De(name)].V.x;
        public static float GetGlobalFloat(int nameID) => Globales.Tabla[nameID].V.x;
        public static Vector4 GetGlobalVector(string name) => Globales.Tabla[Ids.De(name)].V;
        public static Color GetGlobalColor(string name) => Globales.Tabla[Ids.De(name)].V;
        public static Texture GetGlobalTexture(string name) => Globales.Tabla[Ids.De(name)].O as Texture;

        public static void WarmupAllShaders() { }
    }
}

namespace Porteo.Render
{
    // Las propiedades globales de los shaders (Shader.SetGlobal*) y las que pone el motor
    // (matrices de la cámara, luz, niebla, tiempo...).
    public static class Globales
    {
        public static readonly Tabla Tabla = new Tabla();
    }
}

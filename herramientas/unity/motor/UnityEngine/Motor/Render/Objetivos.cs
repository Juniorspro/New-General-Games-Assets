using System;
using System.Collections.Generic;
using Porteo;
using UnityEngine;
using Object = UnityEngine.Object;
using Porteo.Datos;
using Porteo.Render;

namespace Porteo.Render
{
    // Adónde se dibuja: la pantalla (framebuffer 0) o una RenderTexture.
    public static class Destinos
    {
        public static int Ancho = 1, Alto = 1;
        public static RenderTexture Actual;

        public static void Atar(RenderTexture rt)
        {
            if (!Gpu.Activo) return;
            if ((object)rt == null || rt.destruido)
            {
                Gl.BindFramebuffer(Gl.FRAMEBUFFER, 0);
                Ancho = Gpu.Ancho; Alto = Gpu.Alto;
                Actual = null;
                return;
            }
            Gl.BindFramebuffer(Gl.FRAMEBUFFER, rt.Fbo());
            Ancho = rt.width; Alto = rt.height;
            Actual = rt;
        }
    }

    // El cielo: una esfera (o un cubo de 6 caras para los shaders de 6 pasadas) centrada en la
    // cámara, con la profundidad llevada al fondo para que quede detrás de todo.
    public static class Cielo
    {
        static Mesh esfera, cubo;
        static readonly int ID_VP = Ids.De("hlslcc_mtx4x4unity_MatrixVP"), ID_P = Ids.De("hlslcc_mtx4x4glstate_matrix_projection");

        public static void Dibujar(Camera cam)
        {
            var mat = RenderSettings.cieloMaterial;
            var ss = mat?.sh?.Activo();
            if (ss == null) return;
            var g = Globales.Tabla;
            var vpAntes = g[ID_VP]; var pAntes = g[ID_P];
            // la misma proyección pero con z = w: todo el cielo queda en la profundidad máxima
            var P = cam.projectionMatrix;
            P.m20 = P.m30 * 0.999999f; P.m21 = P.m31 * 0.999999f; P.m22 = P.m32 * 0.999999f; P.m23 = P.m33 * 0.999999f;
            var V = cam.worldToCameraMatrix;
            g.Poner(ID_VP, Valor.Matriz(P * V));
            g.Poner(ID_P, Valor.Matriz(P));
            var o2w = Matrix4x4.TRS(cam.transform.position, Quaternion.identity, Vector3.one * Math.Max(1f, cam.lejos * 0.5f));
            if (ss.Pasadas.Length == 6)
            {
                cubo ??= Cubo();
                for (int i = 0; i < 6; i++) Dibujo.Inmediato(cubo, i, o2w, mat, ss.Pasadas[i]);
            }
            else
            {
                esfera ??= Esfera();
                foreach (var pa in ss.Pasadas) Dibujo.Inmediato(esfera, 0, o2w, mat, pa);
            }
            g.Poner(ID_VP, vpAntes);
            g.Poner(ID_P, pAntes);
        }

        static Mesh Esfera()
        {
            const int AN = 32, AL = 16;
            var v = new List<Vector3>(); var t = new List<int>();
            for (int j = 0; j <= AL; j++)
            {
                float lat = (float)Math.PI * j / AL;
                for (int i = 0; i <= AN; i++)
                {
                    float lon = 2 * (float)Math.PI * i / AN;
                    v.Add(new Vector3((float)(Math.Sin(lat) * Math.Cos(lon)), (float)Math.Cos(lat), (float)(Math.Sin(lat) * Math.Sin(lon))));
                }
            }
            for (int j = 0; j < AL; j++)
                for (int i = 0; i < AN; i++)
                {
                    int a = j * (AN + 1) + i, b = a + AN + 1;
                    t.Add(a); t.Add(a + 1); t.Add(b);
                    t.Add(b); t.Add(a + 1); t.Add(b + 1);
                }
            var m = new Mesh { m_Name = "porteo_cielo" };
            m.vertices = v.ToArray();
            m.triangles = t.ToArray();
            Registro.Baja(m);
            return m;
        }

        // las 6 caras en el orden de las pasadas de "Skybox/6 Sided": +Z, -Z, +X, -X, +Y, -Y
        static Mesh Cubo()
        {
            var v = new List<Vector3>(); var uv = new List<Vector2>();
            var m = new Mesh { m_Name = "porteo_cielo6" };
            void Cara(Vector3 c, Vector3 der, Vector3 arr)
            {
                v.Add(c - der - arr); uv.Add(new Vector2(0, 0));
                v.Add(c + der - arr); uv.Add(new Vector2(1, 0));
                v.Add(c + der + arr); uv.Add(new Vector2(1, 1));
                v.Add(c - der + arr); uv.Add(new Vector2(0, 1));
            }
            // vistas desde adentro: la derecha de la imagen según hacia dónde se mira
            Cara(Vector3.forward, Vector3.right, Vector3.up);
            Cara(Vector3.back, Vector3.left, Vector3.up);
            Cara(Vector3.left, Vector3.forward, Vector3.up);
            Cara(Vector3.right, Vector3.back, Vector3.up);
            Cara(Vector3.up, Vector3.right, Vector3.back);
            Cara(Vector3.down, Vector3.right, Vector3.forward);
            m.vertices = v.ToArray();
            m.uv = uv.ToArray();
            m.subMeshCount = 6;
            for (int i = 0; i < 6; i++) { int b = i * 4; m.SetTriangles(new[] { b, b + 1, b + 2, b, b + 2, b + 3 }, i); }
            Registro.Baja(m);
            return m;
        }
    }
}

namespace UnityEngine
{
    public partial class RenderTexture : Texture
    {
        internal int profundidad;
        internal RenderTextureFormat formatoRt = RenderTextureFormat.ARGB32;
        internal bool sinAlfa;   // copia del lienzo (que no tiene alfa): WebGL sólo copia a un formato con los mismos canales
        internal uint fbo, rbo;
        internal int aaRt = 1;
        bool creada;

        public RenderTexture(int width, int height, int depth) : this(width, height, depth, RenderTextureFormat.Default) { }

        public RenderTexture(int width, int height, int depth, RenderTextureFormat format)
        {
            ancho = Math.Max(1, width); alto = Math.Max(1, height);
            profundidad = depth;
            formatoRt = format == RenderTextureFormat.Default ? RenderTextureFormat.ARGB32 : format;
            envolverU = envolverV = TextureWrapMode.Clamp;
            m_Name = "";
        }

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            ancho = m.I32("m_Width", 256); alto = m.I32("m_Height", 256);
            profundidad = m.I32("m_DepthFormat") switch { 0 => 0, 1 => 16, _ => 24 };
            formatoRt = (RenderTextureFormat)m.I32("m_ColorFormat");
            aaRt = Math.Max(1, m.I32("m_AntiAliasing", 1));
            LeerAjustes(m.M("m_TextureSettings"));
        }

        public override int width { get => ancho; set { if (ancho != value) { Release(); ancho = value; } } }
        public override int height { get => alto; set { if (alto != value) { Release(); alto = value; } } }
        public int depth { get => profundidad; set => profundidad = value; }
        public RenderTextureFormat format { get => formatoRt; set => formatoRt = value; }
        public int antiAliasing { get => aaRt; set => aaRt = Math.Max(1, value); }
        public bool useMipMap { get; set; }
        public bool autoGenerateMips { get; set; }
        public bool isPowerOfTwo { get; set; }
        public bool sRGB => false;
        public bool enableRandomWrite { get; set; }

        static RenderTexture activa;
        public static RenderTexture active
        {
            get => activa;
            set { activa = value; Destinos.Atar(value); if (Gpu.Activo) Gl.Viewport(0, 0, Destinos.Ancho, Destinos.Alto); }
        }

        public bool IsCreated() => creada;

        public unsafe bool Create()
        {
            if (creada || !Gpu.Activo) return creada;
            // se puede crear en medio de un dibujo (un GrabPass, un temporal): el destino de ese
            // momento tiene que seguir atado después
            var previo = Destinos.Actual;
            uint t;
            Gl.GenTextures(1, &t);
            gl = t;
            Gpu.AtarParaSubir(Gl.TEXTURE_2D, t);
            bool media = formatoRt == RenderTextureFormat.ARGBHalf || formatoRt == RenderTextureFormat.DefaultHDR || formatoRt == RenderTextureFormat.RGB111110Float;
            if (media && Gpu.ColorFloat) Gl.TexImage2D(Gl.TEXTURE_2D, 0, Gl.RGBA16F, ancho, alto, 0, Gl.RGBA, Gl.HALF_FLOAT, null);
            else if (formatoRt == RenderTextureFormat.RHalf && Gpu.ColorFloat) Gl.TexImage2D(Gl.TEXTURE_2D, 0, Gl.R16F, ancho, alto, 0, Gl.RED, Gl.HALF_FLOAT, null);
            else if (sinAlfa) Gl.TexImage2D(Gl.TEXTURE_2D, 0, Gl.RGB8, ancho, alto, 0, Gl.RGB, Gl.UNSIGNED_BYTE, null);
            else Gl.TexImage2D(Gl.TEXTURE_2D, 0, Gl.RGBA8, ancho, alto, 0, Gl.RGBA, Gl.UNSIGNED_BYTE, null);
            mips = 1;
            parametrosSucios = true;
            AplicarParametros();
            uint f;
            Gl.GenFramebuffers(1, &f);
            fbo = f;
            Gl.BindFramebuffer(Gl.FRAMEBUFFER, f);
            Gl.FramebufferTexture2D(Gl.FRAMEBUFFER, Gl.COLOR_ATTACHMENT0, Gl.TEXTURE_2D, t, 0);
            if (profundidad > 0)
            {
                uint rb;
                Gl.GenRenderbuffers(1, &rb);
                rbo = rb;
                Gl.BindRenderbuffer(Gl.RENDERBUFFER, rb);
                Gl.RenderbufferStorage(Gl.RENDERBUFFER, (uint)Gl.DEPTH24_STENCIL8, ancho, alto);
                Gl.FramebufferRenderbuffer(Gl.FRAMEBUFFER, Gl.DEPTH_STENCIL_ATTACHMENT, Gl.RENDERBUFFER, rb);
            }
            creada = true;
            Gl.BindFramebuffer(Gl.FRAMEBUFFER, (object)previo != null && previo != this && previo.creada ? previo.fbo : 0);
            if ((object)previo == null || previo == this || !previo.creada) Destinos.Actual = null;
            return true;
        }

        public unsafe void Release()
        {
            if (!creada) return;
            creada = false;
            if (!Gpu.Activo) return;
            if (fbo != 0) { uint f = fbo; Gl.DeleteFramebuffers(1, &f); fbo = 0; }
            if (rbo != 0) { uint r = rbo; Gl.DeleteRenderbuffers(1, &r); rbo = 0; }
            base.AlLiberar();
        }

        internal override void AlLiberar() => Release();

        internal uint Fbo() { if (!creada) Create(); return fbo; }
        internal override uint IdGl() { if (!creada) Create(); AplicarParametros(); return gl; }

        public void DiscardContents() { }
        public void DiscardContents(bool discardColor, bool discardDepth) { }
        public void MarkRestoreExpected() { }
        public void GenerateMips() { }

        // ── temporales ──
        static readonly List<(RenderTexture rt, int cuadro)> libres = new List<(RenderTexture, int)>();

        public static RenderTexture GetTemporary(int width, int height) => GetTemporary(width, height, 0, RenderTextureFormat.Default);
        public static RenderTexture GetTemporary(int width, int height, int depthBuffer) => GetTemporary(width, height, depthBuffer, RenderTextureFormat.Default);
        public static RenderTexture GetTemporary(int width, int height, int depthBuffer, RenderTextureFormat format) => GetTemporary(width, height, depthBuffer, format, RenderTextureReadWrite.Default, 1);
        public static RenderTexture GetTemporary(int width, int height, int depthBuffer, RenderTextureFormat format, RenderTextureReadWrite readWrite) => GetTemporary(width, height, depthBuffer, format, readWrite, 1);

        public static RenderTexture GetTemporary(int width, int height, int depthBuffer, RenderTextureFormat format, RenderTextureReadWrite readWrite, int antiAliasing)
        {
            if (format == RenderTextureFormat.Default) format = RenderTextureFormat.ARGB32;
            for (int i = 0; i < libres.Count; i++)
            {
                var r = libres[i].rt;
                if (r.ancho == width && r.alto == height && r.formatoRt == format && (r.profundidad > 0) == (depthBuffer > 0))
                {
                    libres.RemoveAt(i);
                    r.filtro = FilterMode.Bilinear; r.envolverU = r.envolverV = TextureWrapMode.Clamp; r.parametrosSucios = true;
                    return r;
                }
            }
            var n = new RenderTexture(width, height, depthBuffer, format) { m_Name = "TempBuffer" };
            n.Create();
            return n;
        }

        public static void ReleaseTemporary(RenderTexture temp)
        {
            if ((object)temp == null || temp.destruido) return;
            libres.Add((temp, Time.frameCount));
            // las que llevan varios cuadros sin usarse se sueltan
            for (int i = libres.Count - 1; i >= 0; i--)
                if (libres[i].cuadro < Time.frameCount - 30) { libres[i].rt.Release(); libres.RemoveAt(i); }
        }
    }

    public partial class Graphics
    {
        static Mesh cuadrado;
        static readonly int ID_MAINTEX = Ids.De("_MainTex"), ID_VP = Ids.De("hlslcc_mtx4x4unity_MatrixVP"), ID_P = Ids.De("hlslcc_mtx4x4glstate_matrix_projection"),
            ID_V = Ids.De("hlslcc_mtx4x4unity_MatrixV");
        static Material copia;

        static Mesh Cuadrado()
        {
            if (cuadrado != null) return cuadrado;
            var m = new Mesh { m_Name = "porteo_blit" };
            m.vertices = new[] { new Vector3(0, 0, 0.1f), new Vector3(1, 0, 0.1f), new Vector3(1, 1, 0.1f), new Vector3(0, 1, 0.1f) };
            m.uv = new[] { new Vector2(0, 0), new Vector2(1, 0), new Vector2(1, 1), new Vector2(0, 1) };
            m.triangles = new[] { 0, 2, 1, 0, 3, 2 };
            Registro.Baja(m);
            return cuadrado = m;
        }

        public static void Blit(Texture source, RenderTexture dest)
        {
            copia ??= Shader.Find("Hidden/BlitCopy") is Shader s ? new Material(s) { m_Name = "porteo_blitcopy" } : null;
            if (copia == null) return;
            Blit(source, dest, copia, 0);
        }

        public static void Blit(Texture source, RenderTexture dest, Material mat) => Blit(source, dest, mat, -1);

        public static void Blit(Texture source, RenderTexture dest, Material mat, int pass)
        {
            if (!Gpu.Activo || (object)mat == null) return;
            var ss = mat.sh?.Activo();
            if (ss == null) return;
            if ((object)source != null) mat.SetTexture(ID_MAINTEX, source);
            Destinos.Atar(dest);
            Gl.Viewport(0, 0, Destinos.Ancho, Destinos.Alto);
            var g = Globales.Tabla;
            var vp = g[ID_VP]; var p = g[ID_P]; var v = g[ID_V];
            var orto = Matrix4x4.Ortho(0, 1, 0, 1, -1, 100);
            g.Poner(ID_VP, Valor.Matriz(orto));
            g.Poner(ID_P, Valor.Matriz(orto));
            g.Poner(ID_V, Valor.Matriz(Matrix4x4.identity));
            if (pass >= 0) { if (pass < ss.Pasadas.Length) Dibujo.Inmediato(Cuadrado(), 0, Matrix4x4.identity, mat, ss.Pasadas[pass]); }
            else foreach (var pa in ss.Pasadas) Dibujo.Inmediato(Cuadrado(), 0, Matrix4x4.identity, mat, pa);
            g.Poner(ID_VP, vp); g.Poner(ID_P, p); g.Poner(ID_V, v);
        }

        public static void BlitMultiTap(Texture source, RenderTexture dest, Material mat, params Vector2[] offsets)
        {
            // un pase por desplazamiento, sumando como en Unity (el material ya mezcla)
            Blit(source, dest, mat, 0);
        }

        public static void SetRenderTarget(RenderTexture rt) { RenderTexture.active = rt; }

        public static void DrawMeshNow(Mesh mesh, Matrix4x4 matrix) => DrawMeshNow(mesh, matrix, 0);

        public static void DrawMeshNow(Mesh mesh, Matrix4x4 matrix, int materialIndex)
        {
            if (Dibujo.pasadaActiva == null) return;
            Dibujo.Inmediato(mesh, materialIndex, matrix, Dibujo.pasadaActiva, Dibujo.pasadaShaderActiva);
        }

        public static void DrawMeshNow(Mesh mesh, Vector3 position, Quaternion rotation) => DrawMeshNow(mesh, Matrix4x4.TRS(position, rotation, Vector3.one));

        public static void ClearRandomWriteTargets() { }
        public static void SetRandomWriteTarget(int index, ComputeBuffer uav) { }
        public static void DrawProceduralIndirect(MeshTopology topology, ComputeBuffer bufferWithArgs, int argsOffset) { }
    }

    public enum RenderTextureReadWrite { Default = 0, Linear = 1, sRGB = 2 }
}

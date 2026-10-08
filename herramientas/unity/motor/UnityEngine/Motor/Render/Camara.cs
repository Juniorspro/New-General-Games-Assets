using System;
using System.Collections.Generic;
using Porteo;
using UnityEngine;
using Object = UnityEngine.Object;
using Porteo.Datos;
using Porteo.Render;

namespace UnityEngine
{
    public partial class Camera : Behaviour
    {
        internal CameraClearFlags borrar = CameraClearFlags.Skybox;
        internal Color fondo = new Color(0.19f, 0.3f, 0.47f, 0f);
        internal Rect rectNormal = new Rect(0, 0, 1, 1);
        internal float cerca = 0.3f, lejos = 1000f, fov = 60f, tamOrto = 5f, prof;
        internal bool orto, hdr, msaa = true, oclusion = true;
        internal int mascara = -1;
        internal RenderTexture destino;
        internal int pantallaDestino;
        internal float aspectoPropio = -1f;
        internal Matrix4x4? proyeccionPropia, vistaPropia;
        internal DepthTextureMode texProfundidad;
        internal float[] distanciasCapa;
        internal int indiceActivo = -1;

        public delegate void CameraCallback(Camera cam);
        public static CameraCallback onPreCull, onPreRender, onPostRender;

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            borrar = (CameraClearFlags)m.I32("m_ClearFlags", 1);
            fondo = Serial.Color(m.M("m_BackGroundColor"));
            var vr = m.M("m_NormalizedViewPortRect");
            if (vr != null) rectNormal = new Rect(vr.F("x"), vr.F("y"), vr.F("width", 1), vr.F("height", 1));
            cerca = m.F("near clip plane", 0.3f);
            lejos = m.F("far clip plane", 1000f);
            fov = m.F("field of view", 60f);
            orto = m.B("orthographic");
            tamOrto = m.F("orthographic size", 5f);
            prof = m.F("m_Depth");
            mascara = (int)(uint)(m.M("m_CullingMask")?.I("m_Bits", 0xFFFFFFFF) ?? 0xFFFFFFFF);
            destino = r.Resolver(m.P("m_TargetTexture")) as RenderTexture;
            pantallaDestino = m.I32("m_TargetDisplay");
            hdr = m.B("m_HDR");
            msaa = m.B("m_AllowMSAA", true);
            oclusion = m.B("m_OcclusionCulling", true);
        }

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            base.CopiarDe(o, remap);
            CopiarCampos((Camera)o);
        }

        void CopiarCampos(Camera x)
        {
            borrar = x.borrar; fondo = x.fondo; rectNormal = x.rectNormal; cerca = x.cerca; lejos = x.lejos; fov = x.fov;
            tamOrto = x.tamOrto; prof = x.prof; orto = x.orto; hdr = x.hdr; mascara = x.mascara; destino = x.destino;
            pantallaDestino = x.pantallaDestino; aspectoPropio = x.aspectoPropio; texProfundidad = x.texProfundidad; msaa = x.msaa;
        }

        internal override void AlActivarse() => Camaras.Alta(this);
        internal override void AlDesactivarse() => Camaras.Baja(this);
        internal override void AlDestruirse() => Camaras.Baja(this);

        // ── propiedades ──
        public float nearClipPlane { get => cerca; set => cerca = value; }
        public float farClipPlane { get => lejos; set => lejos = value; }
        public float fieldOfView { get => fov; set => fov = Math.Clamp(value, 1e-5f, 179f); }
        public bool orthographic { get => orto; set => orto = value; }
        public float orthographicSize { get => tamOrto; set => tamOrto = value; }
        public float depth { get => prof; set { prof = value; Camaras.ordenSucio = true; } }
        public int cullingMask { get => mascara; set => mascara = value; }
        public int eventMask { get; set; } = -1;
        public Color backgroundColor { get => fondo; set => fondo = value; }
        public CameraClearFlags clearFlags { get => borrar; set => borrar = value; }
        public DepthTextureMode depthTextureMode { get => texProfundidad; set => texProfundidad = value; }
        public bool allowHDR { get => hdr; set => hdr = value; }
        public bool allowMSAA { get => msaa; set => msaa = value; }
        public bool useOcclusionCulling { get => oclusion; set => oclusion = value; }
        public RenderTexture targetTexture { get => destino; set => destino = value; }
        public int targetDisplay { get => pantallaDestino; set => pantallaDestino = value; }
        public float[] layerCullDistances { get => distanciasCapa ?? new float[32]; set => distanciasCapa = value; }
        public bool layerCullSpherical { get; set; }
        public RenderingPath renderingPath { get; set; } = RenderingPath.UsePlayerSettings;
        public RenderingPath actualRenderingPath => RenderingPath.Forward;
        public bool stereoEnabled => false;
        public Vector3 velocity => Vector3.zero;

        public Rect rect { get => rectNormal; set => rectNormal = value; }

        internal int AnchoDestino => (object)destino != null ? destino.width : Screen.width;
        internal int AltoDestino => (object)destino != null ? destino.height : Screen.height;

        public Rect pixelRect
        {
            get
            {
                float w = AnchoDestino, h = AltoDestino;
                float x0 = Math.Clamp(rectNormal.x, 0, 1) * w, y0 = Math.Clamp(rectNormal.y, 0, 1) * h;
                float x1 = Math.Clamp(rectNormal.xMax, 0, 1) * w, y1 = Math.Clamp(rectNormal.yMax, 0, 1) * h;
                return new Rect(x0, y0, Math.Max(0, x1 - x0), Math.Max(0, y1 - y0));
            }
            set
            {
                float w = AnchoDestino, h = AltoDestino;
                rectNormal = new Rect(value.x / w, value.y / h, value.width / w, value.height / h);
            }
        }

        public int pixelWidth => Math.Max(1, (int)pixelRect.width);
        public int pixelHeight => Math.Max(1, (int)pixelRect.height);
        public int scaledPixelWidth => pixelWidth;
        public int scaledPixelHeight => pixelHeight;

        public float aspect
        {
            get => aspectoPropio > 0 ? aspectoPropio : (float)pixelWidth / pixelHeight;
            set => aspectoPropio = value;
        }

        public void ResetAspect() => aspectoPropio = -1f;

        public Matrix4x4 worldToCameraMatrix
        {
            get
            {
                if (vistaPropia.HasValue) return vistaPropia.Value;
                var t = transform;
                return Matrix4x4.Scale(new Vector3(1, 1, -1)) * Matrix4x4.TRS(t.position, t.rotation, Vector3.one).inverse;
            }
            set => vistaPropia = value;
        }

        public void ResetWorldToCameraMatrix() => vistaPropia = null;
        public Matrix4x4 cameraToWorldMatrix => worldToCameraMatrix.inverse;

        public Matrix4x4 projectionMatrix
        {
            get
            {
                if (proyeccionPropia.HasValue) return proyeccionPropia.Value;
                if (orto)
                {
                    float a = aspect;
                    return Matrix4x4.Ortho(-tamOrto * a, tamOrto * a, -tamOrto, tamOrto, cerca, lejos);
                }
                return Matrix4x4.Perspective(fov, aspect, cerca, lejos);
            }
            set => proyeccionPropia = value;
        }

        public void ResetProjectionMatrix() => proyeccionPropia = null;
        public Matrix4x4 nonJitteredProjectionMatrix { get => projectionMatrix; set { } }

        // ── cámaras ──
        public static Camera main
        {
            get
            {
                foreach (var c in Camaras.activas) if (c.go != null && c.go.etiqueta == "MainCamera") return c;
                return null;
            }
        }

        public static Camera current => Camaras.actual;
        public static Camera[] allCameras => Camaras.activas.ToArray();
        public static int allCamerasCount => Camaras.activas.Count;

        public static int GetAllCameras(Camera[] cameras)
        {
            int n = Math.Min(cameras.Length, Camaras.activas.Count);
            for (int i = 0; i < n; i++) cameras[i] = Camaras.activas[i];
            return n;
        }

        public void CopyFrom(Camera other)
        {
            if ((object)other == null) return;
            CopiarCampos(other);
            transform.SetPositionAndRotation(other.transform.position, other.transform.rotation);
        }

        // ── conversiones ──
        public Vector3 WorldToViewportPoint(Vector3 position)
        {
            var c = projectionMatrix * worldToCameraMatrix * new Vector4(position.x, position.y, position.z, 1);
            float w = c.w == 0 ? 1e-6f : c.w;
            var vista = worldToCameraMatrix.MultiplyPoint3x4(position);
            return new Vector3((c.x / w + 1) * 0.5f, (c.y / w + 1) * 0.5f, -vista.z);
        }

        public Vector3 WorldToScreenPoint(Vector3 position)
        {
            var v = WorldToViewportPoint(position);
            var r = pixelRect;
            return new Vector3(r.x + v.x * r.width, r.y + v.y * r.height, v.z);
        }

        public Vector3 ViewportToWorldPoint(Vector3 position)
        {
            // un punto a distancia z delante de la cámara
            var inv = (projectionMatrix * worldToCameraMatrix).inverse;
            float x = position.x * 2 - 1, y = position.y * 2 - 1;
            var a = inv * new Vector4(x, y, -1, 1); a /= a.w;
            var b = inv * new Vector4(x, y, 1, 1); b /= b.w;
            Vector3 pa = a, pb = b;
            var adelante = transform.forward;
            var origen = transform.position;
            if (orto)
            {
                float da = Vector3.Dot(pa - origen, adelante);
                return pa + adelante * (position.z - da);
            }
            var dir = (pb - pa).normalized;
            float cos = Vector3.Dot(dir, adelante);
            if (Math.Abs(cos) < 1e-6f) return origen;
            return origen + dir * (position.z / cos);
        }

        public Vector3 ScreenToViewportPoint(Vector3 position)
        {
            var r = pixelRect;
            return new Vector3((position.x - r.x) / Math.Max(1, r.width), (position.y - r.y) / Math.Max(1, r.height), position.z);
        }

        public Vector3 ViewportToScreenPoint(Vector3 position)
        {
            var r = pixelRect;
            return new Vector3(r.x + position.x * r.width, r.y + position.y * r.height, position.z);
        }

        public Vector3 ScreenToWorldPoint(Vector3 position) => ViewportToWorldPoint(ScreenToViewportPoint(position));

        public Ray ViewportPointToRay(Vector3 position)
        {
            var inv = (projectionMatrix * worldToCameraMatrix).inverse;
            float x = position.x * 2 - 1, y = position.y * 2 - 1;
            var a = inv * new Vector4(x, y, -1, 1); a /= a.w;
            var b = inv * new Vector4(x, y, 1, 1); b /= b.w;
            Vector3 pa = a, pb = b;
            return new Ray(pa, (pb - pa).normalized);
        }

        public Ray ScreenPointToRay(Vector3 pos) => ViewportPointToRay(ScreenToViewportPoint(pos));

        // ── dibujar ──
        public void Render() => Dibujo.Camara(this);
        public void RenderWithShader(Shader shader, string replacementTag) => Dibujo.Camara(this, shader, replacementTag);
        public void SetReplacementShader(Shader shader, string replacementTag) { reemplazo = shader; etiquetaReemplazo = replacementTag; }
        public void ResetReplacementShader() { reemplazo = null; etiquetaReemplazo = null; }
        internal Shader reemplazo; internal string etiquetaReemplazo;
    }

    public enum RenderingPath { UsePlayerSettings = -1, VertexLit = 0, Forward = 1, DeferredLighting = 2, DeferredShading = 3 }
}

namespace Porteo.Render
{
    public static class Camaras
    {
        internal static readonly List<Camera> activas = new List<Camera>();
        internal static Camera actual;
        internal static bool ordenSucio;

        internal static void Alta(Camera c)
        {
            if (activas.Contains(c)) return;
            activas.Add(c);
            ordenSucio = true;
        }

        internal static void Baja(Camera c) { activas.Remove(c); }

        // por profundidad, estable (a igual profundidad, el orden en que se activaron)
        internal static List<Camera> Ordenadas()
        {
            if (ordenSucio)
            {
                var copia = activas.ToArray();
                var claves = new (float, int)[copia.Length];
                for (int i = 0; i < copia.Length; i++) claves[i] = (copia[i].prof, i);
                Array.Sort(claves, copia);
                activas.Clear();
                activas.AddRange(copia);
                ordenSucio = false;
            }
            return activas;
        }
    }
}

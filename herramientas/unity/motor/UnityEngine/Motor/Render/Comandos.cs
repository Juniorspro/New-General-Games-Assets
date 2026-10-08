using System;
using System.Collections.Generic;
using Porteo;
using Porteo.Render;
using UnityEngine;
using UnityEngine.Rendering;
using Object = UnityEngine.Object;

// Los CommandBuffer de Unity: listas de órdenes de dibujo que se graban y se ejecutan después,
// cuando la cámara llega al evento donde las colgaron (el post-procesado de Unity, PPv2, arma las
// suyas en OnPreCull y las cuelga antes de los efectos de imagen). Las órdenes se guardan como
// acciones; los destinos se resuelven al ejecutar (CameraTarget es lo que la cámara tenga en ese
// momento y los temporales viven por nombre hasta que se sueltan o termina la cámara).
namespace UnityEngine.Rendering
{
    public enum CameraEvent
    {
        BeforeDepthTexture = 0,
        AfterDepthTexture = 1,
        BeforeDepthNormalsTexture = 2,
        AfterDepthNormalsTexture = 3,
        BeforeGBuffer = 4,
        AfterGBuffer = 5,
        BeforeLighting = 6,
        AfterLighting = 7,
        BeforeFinalPass = 8,
        AfterFinalPass = 9,
        BeforeForwardOpaque = 10,
        AfterForwardOpaque = 11,
        BeforeImageEffectsOpaque = 12,
        AfterImageEffectsOpaque = 13,
        BeforeSkybox = 14,
        AfterSkybox = 15,
        BeforeForwardAlpha = 16,
        AfterForwardAlpha = 17,
        BeforeImageEffects = 18,
        AfterImageEffects = 19,
        AfterEverything = 20,
        BeforeReflections = 21,
        AfterReflections = 22,
        BeforeHaloAndLensFlares = 23,
        AfterHaloAndLensFlares = 24,
    }

    public enum BuiltinRenderTextureType
    {
        PropertyName = -4,
        BufferPtr = -3,
        RenderTexture = -2,
        BindableTexture = -1,
        None = 0,
        CurrentActive = 1,
        CameraTarget = 2,
        Depth = 3,
        DepthNormals = 4,
        ResolvedDepth = 5,
        PrepassNormalsSpec = 7,
        PrepassLight = 8,
        PrepassLightSpec = 9,
        GBuffer0 = 10,
        GBuffer1 = 11,
        GBuffer2 = 12,
        GBuffer3 = 13,
        Reflections = 14,
        MotionVectors = 15,
        GBuffer4 = 16,
        GBuffer5 = 17,
        GBuffer6 = 18,
        GBuffer7 = 19,
    }

    public enum RenderBufferLoadAction { Load = 0, Clear = 1, DontCare = 2 }
    public enum RenderBufferStoreAction { Store = 0, Resolve = 1, StoreAndResolve = 2, DontCare = 3 }
    public enum SinglePassStereoMode { None = 0, SideBySide = 1, Instancing = 2, Multiview = 3 }
    public enum TextureDimension { Unknown = -1, None = 0, Any = 1, Tex2D = 2, Tex3D = 3, Cube = 4, Tex2DArray = 5, CubeArray = 6 }
    public enum ShadowSamplingMode { CompareDepths = 0, RawDepth = 1, None = 2 }

    public struct RenderTargetIdentifier : IEquatable<RenderTargetIdentifier>
    {
        internal BuiltinRenderTextureType m_Type;
        internal int m_NameID;
        internal int m_InstanceID;
        internal int m_MipLevel;
        internal CubemapFace m_CubeFace;
        internal int m_DepthSlice;
        internal Texture m_Textura;

        public const int AllDepthSlices = -1;

        public RenderTargetIdentifier(BuiltinRenderTextureType type) : this(type, 0, CubemapFace.Unknown, 0) { }

        public RenderTargetIdentifier(BuiltinRenderTextureType type, int mipLevel = 0, CubemapFace cubeFace = CubemapFace.Unknown, int depthSlice = 0)
        {
            m_Type = type; m_NameID = -1; m_InstanceID = 0; m_MipLevel = mipLevel; m_CubeFace = cubeFace; m_DepthSlice = depthSlice; m_Textura = null;
        }

        public RenderTargetIdentifier(string name) : this(Shader.PropertyToID(name)) { }
        public RenderTargetIdentifier(string name, int mipLevel = 0, CubemapFace cubeFace = CubemapFace.Unknown, int depthSlice = 0) : this(Shader.PropertyToID(name), mipLevel, cubeFace, depthSlice) { }
        public RenderTargetIdentifier(int nameID) : this(nameID, 0, CubemapFace.Unknown, 0) { }

        public RenderTargetIdentifier(int nameID, int mipLevel = 0, CubemapFace cubeFace = CubemapFace.Unknown, int depthSlice = 0)
        {
            m_Type = BuiltinRenderTextureType.PropertyName; m_NameID = nameID; m_InstanceID = 0;
            m_MipLevel = mipLevel; m_CubeFace = cubeFace; m_DepthSlice = depthSlice; m_Textura = null;
        }

        public RenderTargetIdentifier(RenderTargetIdentifier renderTargetIdentifier, int mipLevel, CubemapFace cubeFace = CubemapFace.Unknown, int depthSlice = 0)
        {
            this = renderTargetIdentifier;
            m_MipLevel = mipLevel; m_CubeFace = cubeFace; m_DepthSlice = depthSlice;
        }

        public RenderTargetIdentifier(Texture tex) : this(tex, 0, CubemapFace.Unknown, 0) { }

        public RenderTargetIdentifier(Texture tex, int mipLevel = 0, CubemapFace cubeFace = CubemapFace.Unknown, int depthSlice = 0)
        {
            m_Type = (object)tex == null ? BuiltinRenderTextureType.None : tex is RenderTexture ? BuiltinRenderTextureType.RenderTexture : BuiltinRenderTextureType.BindableTexture;
            m_NameID = -1; m_InstanceID = (object)tex == null ? 0 : tex.GetInstanceID();
            m_MipLevel = mipLevel; m_CubeFace = cubeFace; m_DepthSlice = depthSlice; m_Textura = tex;
        }

        public RenderTargetIdentifier(RenderBuffer buf, int mipLevel = 0, CubemapFace cubeFace = CubemapFace.Unknown, int depthSlice = 0)
            : this(buf.rt, mipLevel, cubeFace, depthSlice) { }

        public static implicit operator RenderTargetIdentifier(BuiltinRenderTextureType type) => new RenderTargetIdentifier(type);
        public static implicit operator RenderTargetIdentifier(string name) => new RenderTargetIdentifier(name);
        public static implicit operator RenderTargetIdentifier(int nameID) => new RenderTargetIdentifier(nameID);
        public static implicit operator RenderTargetIdentifier(Texture tex) => new RenderTargetIdentifier(tex);
        public static implicit operator RenderTargetIdentifier(RenderBuffer buf) => new RenderTargetIdentifier(buf);

        public bool Equals(RenderTargetIdentifier rhs) =>
            m_Type == rhs.m_Type && m_NameID == rhs.m_NameID && m_InstanceID == rhs.m_InstanceID &&
            m_MipLevel == rhs.m_MipLevel && m_CubeFace == rhs.m_CubeFace && m_DepthSlice == rhs.m_DepthSlice;
        public override bool Equals(object obj) => obj is RenderTargetIdentifier r && Equals(r);
        public override int GetHashCode() => HashCode.Combine(m_Type, m_NameID, m_InstanceID, m_MipLevel, m_CubeFace, m_DepthSlice);
        public static bool operator ==(RenderTargetIdentifier lhs, RenderTargetIdentifier rhs) => lhs.Equals(rhs);
        public static bool operator !=(RenderTargetIdentifier lhs, RenderTargetIdentifier rhs) => !lhs.Equals(rhs);
        public override string ToString() => $"Type {m_Type} NameID {m_NameID} InstanceID {m_InstanceID}";
    }

    public class CommandBuffer : IDisposable
    {
        internal readonly List<Action> ordenes = new List<Action>();

        public CommandBuffer() { name = ""; }

        public string name { get; set; }
        public int sizeInBytes => ordenes.Count * 16;

        public void Clear() => ordenes.Clear();
        public void Dispose() => ordenes.Clear();
        public void Release() => ordenes.Clear();

        // ── temporales ──
        public void GetTemporaryRT(int nameID, int width, int height, int depthBuffer, FilterMode filter, RenderTextureFormat format, RenderTextureReadWrite readWrite, int antiAliasing, bool enableRandomWrite, RenderTextureMemoryless memorylessMode, bool useDynamicScale) =>
            ordenes.Add(() => Comandos.Temporal(nameID, width, height, depthBuffer, filter, format));
        public void GetTemporaryRT(int nameID, int width, int height, int depthBuffer, FilterMode filter, RenderTextureFormat format, RenderTextureReadWrite readWrite, int antiAliasing, bool enableRandomWrite, RenderTextureMemoryless memorylessMode) =>
            GetTemporaryRT(nameID, width, height, depthBuffer, filter, format, readWrite, antiAliasing, enableRandomWrite, memorylessMode, false);
        public void GetTemporaryRT(int nameID, int width, int height, int depthBuffer, FilterMode filter, RenderTextureFormat format, RenderTextureReadWrite readWrite, int antiAliasing, bool enableRandomWrite) =>
            GetTemporaryRT(nameID, width, height, depthBuffer, filter, format, readWrite, antiAliasing, enableRandomWrite, RenderTextureMemoryless.None, false);
        public void GetTemporaryRT(int nameID, int width, int height, int depthBuffer, FilterMode filter, RenderTextureFormat format, RenderTextureReadWrite readWrite, int antiAliasing) =>
            GetTemporaryRT(nameID, width, height, depthBuffer, filter, format, readWrite, antiAliasing, false, RenderTextureMemoryless.None, false);
        public void GetTemporaryRT(int nameID, int width, int height, int depthBuffer, FilterMode filter, RenderTextureFormat format, RenderTextureReadWrite readWrite) =>
            GetTemporaryRT(nameID, width, height, depthBuffer, filter, format, readWrite, 1, false, RenderTextureMemoryless.None, false);
        public void GetTemporaryRT(int nameID, int width, int height, int depthBuffer, FilterMode filter, RenderTextureFormat format) =>
            GetTemporaryRT(nameID, width, height, depthBuffer, filter, format, RenderTextureReadWrite.Default, 1, false, RenderTextureMemoryless.None, false);
        public void GetTemporaryRT(int nameID, int width, int height, int depthBuffer, FilterMode filter) =>
            GetTemporaryRT(nameID, width, height, depthBuffer, filter, RenderTextureFormat.Default);
        public void GetTemporaryRT(int nameID, int width, int height, int depthBuffer) =>
            GetTemporaryRT(nameID, width, height, depthBuffer, FilterMode.Point, RenderTextureFormat.Default);
        public void GetTemporaryRT(int nameID, int width, int height) => GetTemporaryRT(nameID, width, height, 0, FilterMode.Point, RenderTextureFormat.Default);
        public void GetTemporaryRT(int nameID, RenderTextureDescriptor desc, FilterMode filter) =>
            ordenes.Add(() => Comandos.Temporal(nameID, desc.width, desc.height, desc.depthBufferBits, filter, desc.colorFormat));
        public void GetTemporaryRT(int nameID, RenderTextureDescriptor desc) => GetTemporaryRT(nameID, desc, FilterMode.Point);
        public void ReleaseTemporaryRT(int nameID) => ordenes.Add(() => Comandos.SoltarTemporal(nameID));

        // ── destinos ──
        public void SetRenderTarget(RenderTargetIdentifier rt) => ordenes.Add(() => Comandos.Atar(rt));
        public void SetRenderTarget(RenderTargetIdentifier rt, RenderBufferLoadAction loadAction, RenderBufferStoreAction storeAction) => SetRenderTarget(rt);
        public void SetRenderTarget(RenderTargetIdentifier rt, RenderBufferLoadAction colorLoadAction, RenderBufferStoreAction colorStoreAction, RenderBufferLoadAction depthLoadAction, RenderBufferStoreAction depthStoreAction) => SetRenderTarget(rt);
        public void SetRenderTarget(RenderTargetIdentifier rt, int mipLevel) => SetRenderTarget(rt);
        public void SetRenderTarget(RenderTargetIdentifier rt, int mipLevel, CubemapFace cubemapFace) => SetRenderTarget(rt);
        public void SetRenderTarget(RenderTargetIdentifier rt, int mipLevel, CubemapFace cubemapFace, int depthSlice) => SetRenderTarget(rt);
        public void SetRenderTarget(RenderTargetIdentifier color, RenderTargetIdentifier depth) => SetRenderTarget(color);
        public void SetRenderTarget(RenderTargetIdentifier color, RenderBufferLoadAction colorLoadAction, RenderBufferStoreAction colorStoreAction, RenderTargetIdentifier depth, RenderBufferLoadAction depthLoadAction, RenderBufferStoreAction depthStoreAction) => SetRenderTarget(color);
        public void SetRenderTarget(RenderTargetIdentifier[] colors, RenderTargetIdentifier depth) { if (colors != null && colors.Length > 0) SetRenderTarget(colors[0]); }
        public void SetViewport(Rect pixelRect) => ordenes.Add(() => Comandos.Ventana(pixelRect));
        public void ClearRenderTarget(bool clearDepth, bool clearColor, Color backgroundColor) => ClearRenderTarget(clearDepth, clearColor, backgroundColor, 1f);
        public void ClearRenderTarget(bool clearDepth, bool clearColor, Color backgroundColor, float depth) =>
            ordenes.Add(() => Comandos.Borrar(clearDepth, clearColor, backgroundColor, depth));

        // ── globales y palabras clave ──
        public void SetGlobalFloat(int nameID, float value) => ordenes.Add(() => Shader.SetGlobalFloat(nameID, value));
        public void SetGlobalFloat(string name, float value) => SetGlobalFloat(Shader.PropertyToID(name), value);
        public void SetGlobalInt(int nameID, int value) => ordenes.Add(() => Shader.SetGlobalInt(nameID, value));
        public void SetGlobalInt(string name, int value) => SetGlobalInt(Shader.PropertyToID(name), value);
        public void SetGlobalVector(int nameID, Vector4 value) => ordenes.Add(() => Shader.SetGlobalVector(nameID, value));
        public void SetGlobalVector(string name, Vector4 value) => SetGlobalVector(Shader.PropertyToID(name), value);
        public void SetGlobalColor(int nameID, Color value) => ordenes.Add(() => Shader.SetGlobalColor(nameID, value));
        public void SetGlobalColor(string name, Color value) => SetGlobalColor(Shader.PropertyToID(name), value);
        public void SetGlobalMatrix(int nameID, Matrix4x4 value) => ordenes.Add(() => Shader.SetGlobalMatrix(nameID, value));
        public void SetGlobalMatrix(string name, Matrix4x4 value) => SetGlobalMatrix(Shader.PropertyToID(name), value);
        public void SetGlobalTexture(int nameID, RenderTargetIdentifier value) => ordenes.Add(() => Shader.SetGlobalTexture(nameID, Comandos.Textura(value)));
        public void SetGlobalTexture(string name, RenderTargetIdentifier value) => SetGlobalTexture(Shader.PropertyToID(name), value);
        public void EnableShaderKeyword(string keyword) => ordenes.Add(() => Shader.EnableKeyword(keyword));
        public void DisableShaderKeyword(string keyword) => ordenes.Add(() => Shader.DisableKeyword(keyword));
        public void SetViewProjectionMatrices(Matrix4x4 view, Matrix4x4 proj) => ordenes.Add(() => Comandos.Matrices(view, proj));

        // ── dibujo ──
        public void DrawMesh(Mesh mesh, Matrix4x4 matrix, Material material, int submeshIndex, int shaderPass, MaterialPropertyBlock properties) =>
            ordenes.Add(() => Comandos.Malla(mesh, matrix, material, submeshIndex, shaderPass, properties));
        public void DrawMesh(Mesh mesh, Matrix4x4 matrix, Material material, int submeshIndex, int shaderPass) => DrawMesh(mesh, matrix, material, submeshIndex, shaderPass, null);
        public void DrawMesh(Mesh mesh, Matrix4x4 matrix, Material material, int submeshIndex) => DrawMesh(mesh, matrix, material, submeshIndex, -1, null);
        public void DrawMesh(Mesh mesh, Matrix4x4 matrix, Material material) => DrawMesh(mesh, matrix, material, 0, -1, null);
        public void DrawRenderer(Renderer renderer, Material material, int submeshIndex, int shaderPass) { }
        public void DrawRenderer(Renderer renderer, Material material, int submeshIndex) { }
        public void DrawRenderer(Renderer renderer, Material material) { }

        public void Blit(Texture source, RenderTargetIdentifier dest) => Blit((RenderTargetIdentifier)source, dest, null, -1);
        public void Blit(Texture source, RenderTargetIdentifier dest, Material mat) => Blit((RenderTargetIdentifier)source, dest, mat, -1);
        public void Blit(Texture source, RenderTargetIdentifier dest, Material mat, int pass) => Blit((RenderTargetIdentifier)source, dest, mat, pass);
        public void Blit(RenderTargetIdentifier source, RenderTargetIdentifier dest) => Blit(source, dest, null, -1);
        public void Blit(RenderTargetIdentifier source, RenderTargetIdentifier dest, Material mat) => Blit(source, dest, mat, -1);
        public void Blit(RenderTargetIdentifier source, RenderTargetIdentifier dest, Material mat, int pass) =>
            ordenes.Add(() => Comandos.Copiar(source, dest, mat, pass));
        public void CopyTexture(RenderTargetIdentifier src, RenderTargetIdentifier dst) => ordenes.Add(() => Comandos.Copiar(src, dst, null, -1));
        public void CopyTexture(RenderTargetIdentifier src, int srcElement, RenderTargetIdentifier dst, int dstElement) => CopyTexture(src, dst);
        public void CopyTexture(RenderTargetIdentifier src, int srcElement, int srcMip, RenderTargetIdentifier dst, int dstElement, int dstMip) => CopyTexture(src, dst);

        // ── sin efecto acá (sin compute ni estéreo en WebGL; las marcas son para el perfilador) ──
        public void BeginSample(string name) { }
        public void EndSample(string name) { }
        public void SetSinglePassStereo(SinglePassStereoMode mode) { }
        public void SetComputeVectorParam(ComputeShader computeShader, string name, Vector4 val) { }
        public void SetComputeFloatParam(ComputeShader computeShader, string name, float val) { }
        public void SetComputeFloatParams(ComputeShader computeShader, string name, params float[] values) { }
        public void SetComputeIntParam(ComputeShader computeShader, string name, int val) { }
        public void SetComputeTextureParam(ComputeShader computeShader, int kernelIndex, string name, RenderTargetIdentifier rt) { }
        public void SetComputeBufferParam(ComputeShader computeShader, int kernelIndex, string name, ComputeBuffer buffer) { }
        public void DispatchCompute(ComputeShader computeShader, int kernelIndex, int threadGroupsX, int threadGroupsY, int threadGroupsZ) { }
    }
}

namespace UnityEngine
{
    [Flags]
    public enum RenderTextureMemoryless { None = 0, Color = 1, Depth = 2, MSAA = 4 }
    public enum VRTextureUsage { None = 0, OneEye = 1, TwoEyes = 2, DeviceSpecific = 3 }
    public enum CubemapFace { Unknown = -1, PositiveX = 0, NegativeX = 1, PositiveY = 2, NegativeY = 3, PositiveZ = 4, NegativeZ = 5 }
    public enum CameraType { Game = 1, SceneView = 2, Preview = 4, VR = 8, Reflection = 16 }
    public enum StereoTargetEyeMask { None = 0, Left = 1, Right = 2, Both = 3 }

    public struct RenderBuffer
    {
        internal RenderTexture rt;
        internal bool profundidad;
        public IntPtr GetNativeRenderBufferPtr() => (object)rt != null ? (IntPtr)rt.fbo : IntPtr.Zero;
    }

    public struct RenderTextureDescriptor
    {
        public RenderTextureDescriptor(int width, int height) : this(width, height, RenderTextureFormat.Default, 0) { }
        public RenderTextureDescriptor(int width, int height, RenderTextureFormat colorFormat) : this(width, height, colorFormat, 0) { }
        public RenderTextureDescriptor(int width, int height, RenderTextureFormat colorFormat, int depthBufferBits) : this(width, height, colorFormat, depthBufferBits, 1) { }

        public RenderTextureDescriptor(int width, int height, RenderTextureFormat colorFormat, int depthBufferBits, int mipCount)
        {
            this = default;
            this.width = width; this.height = height; this.colorFormat = colorFormat; this.depthBufferBits = depthBufferBits;
            msaaSamples = 1; volumeDepth = 1; this.mipCount = mipCount; dimension = TextureDimension.Tex2D; autoGenerateMips = true;
            shadowSamplingMode = ShadowSamplingMode.None;
        }

        public int width { get; set; }
        public int height { get; set; }
        public int msaaSamples { get; set; }
        public int volumeDepth { get; set; }
        public int mipCount { get; set; }
        public RenderTextureFormat colorFormat { get; set; }
        public int depthBufferBits { get; set; }
        public TextureDimension dimension { get; set; }
        public ShadowSamplingMode shadowSamplingMode { get; set; }
        public VRTextureUsage vrUsage { get; set; }
        public RenderTextureMemoryless memoryless { get; set; }
        public bool sRGB { get; set; }
        public bool useMipMap { get; set; }
        public bool autoGenerateMips { get; set; }
        public bool enableRandomWrite { get; set; }
        public bool bindMS { get; set; }
        public bool useDynamicScale { get; set; }
    }

    // sin compute en WebGL 2: sólo para que carguen (y SystemInfo.supportsComputeShaders es false)
    public sealed class ComputeShader : Object
    {
        public int FindKernel(string name) => 0;
        public bool HasKernel(string name) => false;
        public void GetKernelThreadGroupSizes(int kernelIndex, out uint x, out uint y, out uint z) { x = y = z = 1; }
        public void SetFloat(string name, float val) { }
        public void SetInt(string name, int val) { }
        public void SetVector(string name, Vector4 val) { }
        public void SetTexture(int kernelIndex, string name, Texture texture) { }
        public void SetBuffer(int kernelIndex, string name, ComputeBuffer buffer) { }
        public void Dispatch(int kernelIndex, int threadGroupsX, int threadGroupsY, int threadGroupsZ) { }
        public bool IsSupported(int kernelIndex) => false;
    }

    public partial class Camera
    {
        internal Dictionary<CameraEvent, List<CommandBuffer>> comandos;

        public enum MonoOrStereoscopicEye { Left = 0, Right = 1, Mono = 2 }
        public enum StereoscopicEye { Left = 0, Right = 1 }

        public void AddCommandBuffer(CameraEvent evt, CommandBuffer buffer)
        {
            if (buffer == null) return;
            comandos ??= new Dictionary<CameraEvent, List<CommandBuffer>>();
            if (!comandos.TryGetValue(evt, out var l)) comandos[evt] = l = new List<CommandBuffer>();
            l.Add(buffer);
        }

        public void RemoveCommandBuffer(CameraEvent evt, CommandBuffer buffer)
        {
            if (comandos != null && comandos.TryGetValue(evt, out var l)) l.Remove(buffer);
        }

        public void RemoveCommandBuffers(CameraEvent evt) => comandos?.Remove(evt);
        public void RemoveAllCommandBuffers() => comandos?.Clear();

        public CommandBuffer[] GetCommandBuffers(CameraEvent evt) =>
            comandos != null && comandos.TryGetValue(evt, out var l) ? l.ToArray() : Array.Empty<CommandBuffer>();

        public int commandBufferCount
        {
            get
            {
                int n = 0;
                if (comandos != null) foreach (var l in comandos.Values) n += l.Count;
                return n;
            }
        }

        // ── lo que pregunta el post-procesado: sin estéreo ni resolución dinámica ──
        public bool allowDynamicResolution { get; set; }
        public CameraType cameraType { get; set; } = CameraType.Game;
        public bool usePhysicalProperties { get; set; }
        public bool useJitteredProjectionMatrixForTransparentRendering { get; set; } = true;
        public StereoTargetEyeMask stereoTargetEye { get; set; } = StereoTargetEyeMask.Both;
        public MonoOrStereoscopicEye stereoActiveEye => MonoOrStereoscopicEye.Mono;
        public SceneManagement.Scene scene { get; set; }

        public void Reset()
        {
            borrar = CameraClearFlags.Skybox; fondo = new Color(0.19f, 0.3f, 0.47f, 0f); rectNormal = new Rect(0, 0, 1, 1);
            cerca = 0.3f; lejos = 1000f; fov = 60f; tamOrto = 5f; orto = false; prof = 0; mascara = -1; destino = null;
            proyeccionPropia = null; vistaPropia = null; aspectoPropio = -1f;
        }

        public Vector3 WorldToScreenPoint(Vector3 position, MonoOrStereoscopicEye eye) => WorldToScreenPoint(position);
        public Vector3 WorldToViewportPoint(Vector3 position, MonoOrStereoscopicEye eye) => WorldToViewportPoint(position);
        public Vector3 ViewportToWorldPoint(Vector3 position, MonoOrStereoscopicEye eye) => ViewportToWorldPoint(position);
        public Vector3 ScreenToWorldPoint(Vector3 position, MonoOrStereoscopicEye eye) => ScreenToWorldPoint(position);
        public Ray ViewportPointToRay(Vector3 pos, MonoOrStereoscopicEye eye) => ViewportPointToRay(pos);
        public Ray ScreenPointToRay(Vector3 pos, MonoOrStereoscopicEye eye) => ScreenPointToRay(pos);
        public Matrix4x4 GetStereoNonJitteredProjectionMatrix(StereoscopicEye eye) => projectionMatrix;
        public Matrix4x4 GetStereoProjectionMatrix(StereoscopicEye eye) => projectionMatrix;
        public Matrix4x4 GetStereoViewMatrix(StereoscopicEye eye) => worldToCameraMatrix;
        public void CopyStereoDeviceProjectionMatrixToNonJittered(StereoscopicEye eye) { }
        public void SetStereoProjectionMatrix(StereoscopicEye eye, Matrix4x4 matrix) { }
        public void ResetStereoProjectionMatrices() { }
    }

    public partial class Graphics
    {
        public static void ExecuteCommandBuffer(CommandBuffer buffer)
        {
            if (buffer == null) return;
            Comandos.Ejecutar(buffer);
            if ((object)Camaras.actual == null) Comandos.SoltarTemporales();
        }
    }
}

namespace Porteo.Render
{
    internal static class Comandos
    {
        // los temporales por nombre (también quedan como textura global con ese nombre, como en Unity)
        static readonly Dictionary<int, RenderTexture> temporales = new Dictionary<int, RenderTexture>();
        // CameraTarget mientras corre una cámara: su destino de ese momento (null: el lienzo)
        internal static RenderTexture objetivoCamara;

        internal static void Ejecutar(CommandBuffer cb)
        {
            var l = cb.ordenes;
            for (int i = 0; i < l.Count; i++)
            {
                try { l[i](); }
                catch (Exception e) { Debug.LogException(e); }
            }
        }

        // los CommandBuffer de la cámara colgados en ese evento
        internal static void Evento(Camera cam, CameraEvent ev, RenderTexture objetivo)
        {
            if (cam.comandos == null || !cam.comandos.TryGetValue(ev, out var l) || l.Count == 0) return;
            var antes = objetivoCamara;
            objetivoCamara = objetivo;
            foreach (var cb in l.ToArray()) Ejecutar(cb);
            objetivoCamara = antes;
        }

        internal static bool Tiene(Camera cam, CameraEvent ev) => cam.comandos != null && cam.comandos.TryGetValue(ev, out var l) && l.Count > 0;

        internal static void Temporal(int id, int w, int h, int prof, FilterMode filtro, RenderTextureFormat formato)
        {
            // negativos: la cámara dividida (-1 entera, -2 la mitad...)
            var cam = Camaras.actual;
            int cw = cam != null ? cam.pixelWidth : Screen.width, ch = cam != null ? cam.pixelHeight : Screen.height;
            if (w < 0) w = Math.Max(1, cw / -w);
            if (h < 0) h = Math.Max(1, ch / -h);
            if (formato == RenderTextureFormat.DefaultHDR) formato = RenderTextureFormat.ARGBHalf;
            if (temporales.TryGetValue(id, out var viejo)) RenderTexture.ReleaseTemporary(viejo);
            var rt = RenderTexture.GetTemporary(Math.Max(1, w), Math.Max(1, h), prof, formato);
            rt.filterMode = filtro;
            temporales[id] = rt;
            Shader.SetGlobalTexture(id, rt);
        }

        internal static void SoltarTemporal(int id)
        {
            if (!temporales.TryGetValue(id, out var rt)) return;
            temporales.Remove(id);
            RenderTexture.ReleaseTemporary(rt);
        }

        internal static void SoltarTemporales()
        {
            foreach (var rt in temporales.Values) RenderTexture.ReleaseTemporary(rt);
            temporales.Clear();
        }

        // para leer: la textura que nombra el identificador
        internal static Texture Textura(in RenderTargetIdentifier id)
        {
            switch (id.m_Type)
            {
                case BuiltinRenderTextureType.PropertyName:
                    if (temporales.TryGetValue(id.m_NameID, out var t)) return t;
                    return Globales.Tabla[id.m_NameID].O as Texture;
                case BuiltinRenderTextureType.RenderTexture:
                case BuiltinRenderTextureType.BindableTexture:
                    return id.m_Textura;
                case BuiltinRenderTextureType.CameraTarget: return objetivoCamara;
                case BuiltinRenderTextureType.CurrentActive: return Destinos.Actual;
                default: return null;
            }
        }

        // para dibujar: false si no hay adónde (una textura que no es de dibujo)
        internal static bool Destino(in RenderTargetIdentifier id, out RenderTexture rt)
        {
            rt = null;
            switch (id.m_Type)
            {
                case BuiltinRenderTextureType.CameraTarget: rt = objetivoCamara; return true;
                case BuiltinRenderTextureType.CurrentActive: rt = Destinos.Actual; return true;
                default:
                    rt = Textura(id) as RenderTexture;
                    return (object)rt != null;
            }
        }

        internal static void Atar(RenderTargetIdentifier id)
        {
            if (!Gpu.Activo || !Destino(id, out var rt)) return;
            Destinos.Atar(rt);
            Convencion.Viewport(0, 0, Destinos.Ancho, Destinos.Alto);
        }

        internal static void Ventana(Rect r)
        {
            if (!Gpu.Activo) return;
            Convencion.Viewport((int)r.x, (int)r.y, Math.Max(1, (int)r.width), Math.Max(1, (int)r.height));
        }

        internal static void Borrar(bool profundidad, bool color, Color c, float valorProf)
        {
            if (!Gpu.Activo) return;
            uint bits = 0;
            if (color) { Gl.ClearColor(c.r, c.g, c.b, c.a); bits |= Gl.COLOR_BUFFER_BIT; }
            // el 1 de Unity es "lejos": con la profundidad al revés es 0
            if (profundidad) { Gl.ClearDepthf(Convencion.D3D ? 1 - valorProf : valorProf); Gl.ClearStencil(0); bits |= Gl.DEPTH_BUFFER_BIT | Gl.STENCIL_BUFFER_BIT; }
            if (bits != 0) Gpu.Limpiar(bits);
        }

        static readonly int ID_V = Ids.De("hlslcc_mtx4x4unity_MatrixV"), ID_VP = Ids.De("hlslcc_mtx4x4unity_MatrixVP"), ID_P = Ids.De("hlslcc_mtx4x4glstate_matrix_projection");

        internal static void Matrices(Matrix4x4 v, Matrix4x4 p)
        {
            var g = Globales.Tabla;
            g.Poner(ID_V, Valor.Matriz(v));
            p = Convencion.GpuActual(p);
            g.Poner(ID_P, Valor.Matriz(p));
            g.Poner(ID_VP, Valor.Matriz(p * v));
        }

        internal static void Malla(Mesh m, Matrix4x4 o2w, Material mat, int sub, int pasada, MaterialPropertyBlock propias)
        {
            if (!Gpu.Activo || (object)m == null || (object)mat == null) return;
            var ss = mat.sh?.Activo();
            if (ss == null) return;
            if (pasada >= 0)
            {
                if (pasada < ss.Pasadas.Length) Dibujo.InmediatoCon(m, sub, o2w, mat, ss.Pasadas[pasada], propias?.t);
            }
            else foreach (var pa in ss.Pasadas) Dibujo.InmediatoCon(m, sub, o2w, mat, pa, propias?.t);
        }

        // Blit y CopyTexture: el mismo dibujo de pantalla completa que Graphics.Blit
        internal static void Copiar(RenderTargetIdentifier fuente, RenderTargetIdentifier destino, Material mat, int pasada)
        {
            if (!Gpu.Activo || !Destino(destino, out var rt)) return;
            var tex = Textura(fuente);
            if ((object)mat == null) Graphics.Blit(tex, rt);
            else Graphics.Blit(tex, rt, mat, pasada);
        }
    }
}

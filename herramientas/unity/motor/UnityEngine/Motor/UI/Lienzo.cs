using System;
using System.Collections.Generic;
using Porteo;
using Porteo.Datos;
using Porteo.Render;
using UnityEngine;
// las UV de un UIVertex (y de las listas de VertexHelper): Vector2 hasta Unity 2019, Vector4 después
#if UNITY_2022
using UvUI = UnityEngine.Vector4;
#else
using UvUI = UnityEngine.Vector2;
#endif

namespace UnityEngine
{
    public sealed partial class Canvas : Behaviour
    {
        internal RenderMode modo;
        internal Camera camara;
        internal float distanciaPlano = 100f, escala = 1f, pixelesPorUnidad = 100f;
        internal bool pixelPerfecto, ordenPropio, pixelPerfectoPropio;
        internal int ordenCapa, capaOrdenId, pantallaDestino;
        internal AdditionalCanvasShaderChannels canales;
        internal int ordenDibujo;
        // el rect como estaba antes de manejarlo como raíz: si después lo cuelgan de otro canvas
        // vuelve (TMP_Dropdown instancia la lista suelta, activa, y recién después la mueve adentro:
        // quedaba del tamaño de la pantalla, gigante en un teléfono con muchos píxeles)
        internal bool conducido;
        internal int cuadroConducido;
        internal Vector2 pivoteAntes, anclaMinAntes, anclaMaxAntes, tamAntes;
        internal Vector3 posAntes, escalaAntes;
        internal Quaternion rotAntes;

        public delegate void WillRenderCanvases();
        static event WillRenderCanvases antesDeDibujar;
        public static event WillRenderCanvases willRenderCanvases { add => antesDeDibujar += value; remove => antesDeDibujar -= value; }
        // Unity 2021+: antes de willRenderCanvases (la UI de 2022 hace ahí el layout y las mallas)
        static event WillRenderCanvases antesDeAntes;
        public static event WillRenderCanvases preWillRenderCanvases { add => antesDeAntes += value; remove => antesDeAntes -= value; }

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            modo = (RenderMode)m.I32("m_RenderMode");
            camara = r.Resolver(m.P("m_Camera")) as Camera;
            distanciaPlano = m.F("m_PlaneDistance", 100f);
            pixelPerfecto = m.B("m_PixelPerfect");
            ordenPropio = m.B("m_OverrideSorting");
            pixelPerfectoPropio = m.B("m_OverridePixelPerfect");
            canales = (AdditionalCanvasShaderChannels)m.I32("m_AdditionalShaderChannelsFlag");
            capaOrdenId = m.I32("m_SortingLayerID");
            ordenCapa = m.I32("m_SortingOrder");
            pantallaDestino = m.I32("m_TargetDisplay");
        }

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            base.CopiarDe(o, remap);
            var x = (Canvas)o;
            modo = x.modo; camara = remap(x.camara) as Camera; distanciaPlano = x.distanciaPlano; escala = x.escala; pixelesPorUnidad = x.pixelesPorUnidad;
            pixelPerfecto = x.pixelPerfecto; ordenPropio = x.ordenPropio; pixelPerfectoPropio = x.pixelPerfectoPropio; ordenCapa = x.ordenCapa;
            capaOrdenId = x.capaOrdenId; pantallaDestino = x.pantallaDestino; canales = x.canales;
        }

        internal override void AlActivarse() { Porteo.UI.Lienzos.Alta(this); Jerarquia.Mensaje(transform, "OnCanvasHierarchyChanged"); }
        internal override void AlDesactivarse() { Porteo.UI.Lienzos.Baja(this); if (go != null && go.activoEnJerarquia) Jerarquia.Mensaje(transform, "OnCanvasHierarchyChanged"); }
        internal override void AlDestruirse() => Porteo.UI.Lienzos.Baja(this);

        public RenderMode renderMode { get => modo; set { modo = value; Porteo.UI.Lienzos.ActualizarRaiz(this); } }
        public Camera worldCamera { get => camara; set => camara = value; }
        public float planeDistance { get => distanciaPlano; set => distanciaPlano = value; }
        public float scaleFactor { get => escala; set { if (value <= 0) return; if (escala == value) return; escala = value; Porteo.UI.Lienzos.ActualizarRaiz(this); } }
        public float referencePixelsPerUnit { get => pixelesPorUnidad; set => pixelesPorUnidad = value; }
        public bool pixelPerfect { get => pixelPerfecto; set => pixelPerfecto = value; }
        public bool overrideSorting { get => ordenPropio; set => ordenPropio = value; }
        public bool overridePixelPerfect { get => pixelPerfectoPropio; set => pixelPerfectoPropio = value; }
        public int sortingOrder { get => ordenCapa; set => ordenCapa = value; }
        public int sortingLayerID { get => capaOrdenId; set => capaOrdenId = value; }
        public string sortingLayerName { get => SortingLayer.IDToName(capaOrdenId); set => capaOrdenId = SortingLayer.NameToID(value); }
        public int cachedSortingLayerValue => SortingLayer.GetLayerValueFromID(capaOrdenId);
        public int targetDisplay { get => pantallaDestino; set => pantallaDestino = value; }
        public AdditionalCanvasShaderChannels additionalShaderChannels { get => canales; set => canales = value; }
        public int renderOrder => ordenDibujo;
        public float normalizedSortingGridSize { get; set; } = 0.1f;
        public float sortingGridNormalizedSize { get; set; } = 0.1f;
        public bool isRootCanvas => Padre() == null;
        public Vector2 renderingDisplaySize => new Vector2(Screen.width, Screen.height);

        internal Canvas Padre()
        {
            for (var t = transform?.padre; t != null; t = t.padre)
            {
                var c = t.go.GetComponent<Canvas>();
                if (c != null && c.isActiveAndEnabled) return c;
            }
            return null;
        }

        public Canvas rootCanvas
        {
            get
            {
                var c = this;
                for (var p = Padre(); p != null; p = p.Padre()) c = p;
                return c;
            }
        }

        public static void ForceUpdateCanvases() => Disparar();

        internal static void Disparar()
        {
            Avisar(antesDeAntes);
            Avisar(antesDeDibujar);
        }

        static void Avisar(WillRenderCanvases d)
        {
            if (d == null) return;
            foreach (WillRenderCanvases f in d.GetInvocationList())
            {
                try { f(); }
                catch (Exception e) { Debug.LogException(e); }
            }
        }

        static Material porDefecto, etc1;
        public static Material GetDefaultCanvasMaterial() => porDefecto ??= Porteo.UI.Lienzos.MaterialDe("UI/Default");
        public static Material GetETC1SupportedCanvasMaterial() => etc1 ??= Porteo.UI.Lienzos.MaterialDe("UI/DefaultETC1") ?? GetDefaultCanvasMaterial();
        public static Material GetDefaultCanvasTextMaterial() => GetDefaultCanvasMaterial();
    }

    public sealed partial class CanvasGroup : Behaviour, ICanvasRaycastFilter
    {
        internal float alfa = 1f;
        internal bool interactuable = true, bloquea = true, ignoraPadres;

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            alfa = m.F("m_Alpha", 1f);
            interactuable = m.B("m_Interactable", true);
            bloquea = m.B("m_BlocksRaycasts", true);
            ignoraPadres = m.B("m_IgnoreParentGroups");
        }

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            base.CopiarDe(o, remap);
            var x = (CanvasGroup)o;
            alfa = x.alfa; interactuable = x.interactuable; bloquea = x.bloquea; ignoraPadres = x.ignoraPadres;
        }

        void Cambio() { if (go != null && go.activoEnJerarquia) Jerarquia.Mensaje(transform, "OnCanvasGroupChanged"); }
        internal override void AlActivarse() => Cambio();
        internal override void AlDesactivarse() => Cambio();

        public float alpha { get => alfa; set { float v = Mathf.Clamp01(value); if (v == alfa) return; alfa = v; } }
        public bool interactable { get => interactuable; set { if (interactuable == value) return; interactuable = value; Cambio(); } }
        public bool blocksRaycasts { get => bloquea; set { if (bloquea == value) return; bloquea = value; Cambio(); } }
        public bool ignoreParentGroups { get => ignoraPadres; set { if (ignoraPadres == value) return; ignoraPadres = value; Cambio(); } }
        public bool IsRaycastLocationValid(Vector2 sp, Camera eventCamera) => bloquea;
    }

    // Lo que el uGUI le pasa para dibujar: se copia la malla (el juego reusa una sola para todo),
    // el material, la textura, el color y el recorte.
    public sealed partial class CanvasRenderer : Component
    {
        internal Vector3[] pos = Array.Empty<Vector3>(), nor;
        internal Vector4[] tan;
        internal Color32[] col;
        internal Vector2[] uv0, uv1, uv2, uv3;
        internal int[] tris = Array.Empty<int>();
        internal Material[] mats = Array.Empty<Material>(), matsPop = Array.Empty<Material>();
        internal Texture textura, texAlfa;
        internal Color color = Color.white;
        internal float alfa = 1f;
        internal bool recortar, descartado, transparentesDescartados;
        internal Rect recorte;
        internal int profundidad = -1;
        internal int versionMovida = -1;

        internal override void LeerNativo(Mapa m, IResolutor r) => transparentesDescartados = m.B("m_CullTransparentMesh");

        public void SetMesh(Mesh mesh)
        {
            if ((object)mesh == null) { pos = Array.Empty<Vector3>(); tris = Array.Empty<int>(); return; }
            pos = mesh.vertices;
            var n = mesh.normals; nor = n.Length == pos.Length ? n : null;
            var t = mesh.tangents; tan = t.Length == pos.Length ? t : null;
            var c = mesh.colors32; col = c.Length == pos.Length ? c : null;
            var u = mesh.uv; uv0 = u.Length == pos.Length ? u : null;
            u = mesh.uv2; uv1 = u.Length == pos.Length ? u : null;
            u = mesh.uv3; uv2 = u.Length == pos.Length ? u : null;
            u = mesh.uv4; uv3 = u.Length == pos.Length ? u : null;
            tris = mesh.subMeshCount > 0 ? mesh.GetIndices(0) : Array.Empty<int>();
        }

        public void Clear()
        {
            pos = Array.Empty<Vector3>(); tris = Array.Empty<int>();
            nor = null; tan = null; col = null; uv0 = uv1 = uv2 = uv3 = null;
            mats = Array.Empty<Material>(); matsPop = Array.Empty<Material>();
            textura = null; texAlfa = null;
        }

        public int materialCount { get => mats.Length; set { if (value != mats.Length) Array.Resize(ref mats, Math.Max(0, value)); } }
        public int popMaterialCount { get => matsPop.Length; set { if (value != matsPop.Length) Array.Resize(ref matsPop, Math.Max(0, value)); } }
        public bool hasPopInstruction { get; set; }

        public void SetMaterial(Material material, int index)
        {
            if (index < 0) return;
            if (index >= mats.Length) Array.Resize(ref mats, index + 1);
            mats[index] = material;
        }

        public void SetMaterial(Material material, Texture texture)
        {
            materialCount = Math.Max(1, materialCount);
            SetMaterial(material, 0);
            SetTexture(texture);
        }

        public void SetPopMaterial(Material material, int index)
        {
            if (index < 0) return;
            if (index >= matsPop.Length) Array.Resize(ref matsPop, index + 1);
            matsPop[index] = material;
        }

        public Material GetMaterial() => GetMaterial(0);
        public Material GetMaterial(int index) => index >= 0 && index < mats.Length ? mats[index] : null;
        public Material GetPopMaterial(int index) => index >= 0 && index < matsPop.Length ? matsPop[index] : null;
        public void SetTexture(Texture texture) => textura = texture;
        public void SetAlphaTexture(Texture texture) => texAlfa = texture;
        public void SetColor(Color color) => this.color = color;
        public Color GetColor() => color;
        public void SetAlpha(float alpha) => alfa = alpha;
        public float GetAlpha() => alfa;

        public float GetInheritedAlpha()
        {
            float a = 1f;
            for (var t = transform; t != null; t = t.padre)
            {
                var g = t.go.GetComponent<CanvasGroup>();
                if (g != null && g.isActiveAndEnabled)
                {
                    a *= g.alfa;
                    if (g.ignoraPadres) break;
                }
                if (t.go.GetComponent<Canvas>() is Canvas c && c.isActiveAndEnabled && c.isRootCanvas) break;
            }
            return a;
        }

        public void EnableRectClipping(Rect rect) { recortar = true; recorte = rect; }
        public void DisableRectClipping() => recortar = false;
        public bool cull { get => descartado; set => descartado = value; }
        public bool cullTransparentMesh { get => transparentesDescartados; set => transparentesDescartados = value; }
        public int absoluteDepth => profundidad;
        public int relativeDepth => profundidad;
        public bool isMask { get; set; }

        public bool hasMoved
        {
            get
            {
                var t = transform;
                return t == null || t.version != versionMovida;
            }
        }

        // los ayudantes de VertexHelper y de los efectos (Outline, Shadow). Las firmas públicas van
        // con su tipo escrito (y no con el alias UvUI): así generar ve las dos versiones y no
        // escribe ninguna de más
#if UNITY_2022
        public static void SplitUIVertexStreams(List<UIVertex> verts, List<Vector3> positions, List<Color32> colors, List<Vector4> uv0S, List<Vector4> uv1S,
            List<Vector3> normals, List<Vector4> tangents, List<int> indices) =>
            Partir(verts, positions, colors, uv0S, uv1S, new List<UvUI>(), new List<UvUI>(), normals, tangents, indices);

        public static void SplitUIVertexStreams(List<UIVertex> verts, List<Vector3> positions, List<Color32> colors, List<Vector4> uv0S, List<Vector4> uv1S,
            List<Vector4> uv2S, List<Vector4> uv3S, List<Vector3> normals, List<Vector4> tangents, List<int> indices) =>
            Partir(verts, positions, colors, uv0S, uv1S, uv2S, uv3S, normals, tangents, indices);

        public static void CreateUIVertexStream(List<UIVertex> verts, List<Vector3> positions, List<Color32> colors, List<Vector4> uv0S, List<Vector4> uv1S,
            List<Vector3> normals, List<Vector4> tangents, List<int> indices) =>
            Crear(verts, positions, colors, uv0S, uv1S, null, null, normals, tangents, indices);

        public static void CreateUIVertexStream(List<UIVertex> verts, List<Vector3> positions, List<Color32> colors, List<Vector4> uv0S, List<Vector4> uv1S,
            List<Vector4> uv2S, List<Vector4> uv3S, List<Vector3> normals, List<Vector4> tangents, List<int> indices) =>
            Crear(verts, positions, colors, uv0S, uv1S, uv2S, uv3S, normals, tangents, indices);

        public static void AddUIVertexStream(List<UIVertex> verts, List<Vector3> positions, List<Color32> colors, List<Vector4> uv0S, List<Vector4> uv1S,
            List<Vector3> normals, List<Vector4> tangents) => Sumar(verts, positions, colors, uv0S, uv1S, normals, tangents);
#else
        public static void SplitUIVertexStreams(List<UIVertex> verts, List<Vector3> positions, List<Color32> colors, List<Vector2> uv0S, List<Vector2> uv1S,
            List<Vector3> normals, List<Vector4> tangents, List<int> indices) =>
            Partir(verts, positions, colors, uv0S, uv1S, new List<UvUI>(), new List<UvUI>(), normals, tangents, indices);

        public static void SplitUIVertexStreams(List<UIVertex> verts, List<Vector3> positions, List<Color32> colors, List<Vector2> uv0S, List<Vector2> uv1S,
            List<Vector2> uv2S, List<Vector2> uv3S, List<Vector3> normals, List<Vector4> tangents, List<int> indices) =>
            Partir(verts, positions, colors, uv0S, uv1S, uv2S, uv3S, normals, tangents, indices);

        public static void CreateUIVertexStream(List<UIVertex> verts, List<Vector3> positions, List<Color32> colors, List<Vector2> uv0S, List<Vector2> uv1S,
            List<Vector3> normals, List<Vector4> tangents, List<int> indices) =>
            Crear(verts, positions, colors, uv0S, uv1S, null, null, normals, tangents, indices);

        public static void CreateUIVertexStream(List<UIVertex> verts, List<Vector3> positions, List<Color32> colors, List<Vector2> uv0S, List<Vector2> uv1S,
            List<Vector2> uv2S, List<Vector2> uv3S, List<Vector3> normals, List<Vector4> tangents, List<int> indices) =>
            Crear(verts, positions, colors, uv0S, uv1S, uv2S, uv3S, normals, tangents, indices);

        public static void AddUIVertexStream(List<UIVertex> verts, List<Vector3> positions, List<Color32> colors, List<Vector2> uv0S, List<Vector2> uv1S,
            List<Vector3> normals, List<Vector4> tangents) => Sumar(verts, positions, colors, uv0S, uv1S, normals, tangents);
#endif

        static void Partir(List<UIVertex> verts, List<Vector3> positions, List<Color32> colors, List<UvUI> uv0S, List<UvUI> uv1S,
            List<UvUI> uv2S, List<UvUI> uv3S, List<Vector3> normals, List<Vector4> tangents, List<int> indices)
        {
            positions.Clear(); colors.Clear(); uv0S.Clear(); uv1S.Clear(); uv2S.Clear(); uv3S.Clear(); normals.Clear(); tangents.Clear(); indices.Clear();
            for (int i = 0; i < verts.Count; i++)
            {
                var v = verts[i];
                positions.Add(v.position); colors.Add(v.color); uv0S.Add(v.uv0); uv1S.Add(v.uv1); uv2S.Add(v.uv2); uv3S.Add(v.uv3);
                normals.Add(v.normal); tangents.Add(v.tangent);
                indices.Add(i);
            }
        }

        static void Crear(List<UIVertex> verts, List<Vector3> positions, List<Color32> colors, List<UvUI> uv0S, List<UvUI> uv1S,
            List<UvUI> uv2S, List<UvUI> uv3S, List<Vector3> normals, List<Vector4> tangents, List<int> indices)
        {
            verts.Clear();
            foreach (int i in indices)
            {
                var v = new UIVertex
                {
                    position = positions[i], color = i < colors.Count ? colors[i] : new Color32(255, 255, 255, 255),
                    uv0 = i < uv0S.Count ? uv0S[i] : default, uv1 = i < uv1S.Count ? uv1S[i] : default,
                    uv2 = uv2S != null && i < uv2S.Count ? uv2S[i] : default, uv3 = uv3S != null && i < uv3S.Count ? uv3S[i] : default,
                    normal = i < normals.Count ? normals[i] : Vector3.back, tangent = i < tangents.Count ? tangents[i] : new Vector4(1, 0, 0, -1),
                };
                verts.Add(v);
            }
        }

        static void Sumar(List<UIVertex> verts, List<Vector3> positions, List<Color32> colors, List<UvUI> uv0S, List<UvUI> uv1S,
            List<Vector3> normals, List<Vector4> tangents)
        {
            for (int i = 0; i < positions.Count; i++)
                verts.Add(new UIVertex
                {
                    position = positions[i], color = i < colors.Count ? colors[i] : new Color32(255, 255, 255, 255),
                    uv0 = i < uv0S.Count ? uv0S[i] : default, uv1 = i < uv1S.Count ? uv1S[i] : default,
                    normal = i < normals.Count ? normals[i] : Vector3.back, tangent = i < tangents.Count ? tangents[i] : new Vector4(1, 0, 0, -1),
                });
        }
    }

    public partial struct UIVertex
    {
        public Vector3 position;
        public Vector3 normal;
        public Vector4 tangent;
        public Color32 color;
#if UNITY_2022
        public Vector4 uv0;
        public Vector4 uv1;
        public Vector4 uv2;
        public Vector4 uv3;
#else
        public Vector2 uv0;
        public Vector2 uv1;
        public Vector2 uv2;
        public Vector2 uv3;
#endif
        public static UIVertex simpleVert = new UIVertex
        {
            position = Vector3.zero, normal = Vector3.back, tangent = new Vector4(1, 0, 0, -1), color = new Color32(255, 255, 255, 255),
        };
    }

    public sealed partial class RectTransformUtility
    {
        static readonly Vector3[] esquinas = new Vector3[4];

        public static Ray ScreenPointToRay(Camera cam, Vector2 screenPos)
        {
            if (cam != null) return cam.ScreenPointToRay(screenPos);
            return new Ray(new Vector3(screenPos.x, screenPos.y, -100f), Vector3.forward);
        }

        public static bool ScreenPointToWorldPointInRectangle(RectTransform rect, Vector2 screenPoint, Camera cam, out Vector3 worldPoint)
        {
            worldPoint = Vector2.zero;
            var ray = ScreenPointToRay(cam, screenPoint);
            var plano = new Plane(rect.rotation * Vector3.back, rect.position);
            if (!plano.Raycast(ray, out float d)) return false;
            worldPoint = ray.GetPoint(d);
            return true;
        }

        public static bool ScreenPointToLocalPointInRectangle(RectTransform rect, Vector2 screenPoint, Camera cam, out Vector2 localPoint)
        {
            localPoint = Vector2.zero;
            if (!ScreenPointToWorldPointInRectangle(rect, screenPoint, cam, out var w)) return false;
            localPoint = rect.InverseTransformPoint(w);
            return true;
        }

        public static bool RectangleContainsScreenPoint(RectTransform rect, Vector2 screenPoint) => RectangleContainsScreenPoint(rect, screenPoint, null);

        public static bool RectangleContainsScreenPoint(RectTransform rect, Vector2 screenPoint, Camera cam)
        {
            if (rect == null) return false;
            if (!ScreenPointToLocalPointInRectangle(rect, screenPoint, cam, out var p)) return false;
            return rect.rect.Contains(p);
        }

        // con el relleno del raycast de uGUI (x izquierda, y abajo, z derecha, w arriba; positivo achica)
        public static bool RectangleContainsScreenPoint(RectTransform rect, Vector2 screenPoint, Camera cam, Vector4 offset)
        {
            if (rect == null) return false;
            if (!ScreenPointToLocalPointInRectangle(rect, screenPoint, cam, out var p)) return false;
            var r = rect.rect;
            r.xMin += offset.x; r.yMin += offset.y; r.xMax -= offset.z; r.yMax -= offset.w;
            return r.Contains(p);
        }

        public static Vector2 WorldToScreenPoint(Camera cam, Vector3 worldPoint) => cam == null ? new Vector2(worldPoint.x, worldPoint.y) : (Vector2)cam.WorldToScreenPoint(worldPoint);

        public static Vector2 PixelAdjustPoint(Vector2 point, Transform elementTransform, Canvas canvas)
        {
            if (canvas == null || !canvas.pixelPerfect || canvas.modo == RenderMode.WorldSpace) return point;
            var w = elementTransform.TransformPoint(point);
            var c = canvas.rootCanvas.transform;
            var s = canvas.modo == RenderMode.ScreenSpaceOverlay || canvas.camara == null ? w : (Vector3)canvas.camara.WorldToScreenPoint(w);
            s.x = Mathf.Round(s.x); s.y = Mathf.Round(s.y);
            var vuelta = canvas.modo == RenderMode.ScreenSpaceOverlay || canvas.camara == null ? s : canvas.camara.ScreenToWorldPoint(s);
            return elementTransform.InverseTransformPoint(vuelta);
        }

        public static Rect PixelAdjustRect(RectTransform rectTransform, Canvas canvas)
        {
            var r = rectTransform.rect;
            if (canvas == null || !canvas.pixelPerfect || canvas.modo == RenderMode.WorldSpace) return r;
            var min = PixelAdjustPoint(r.min, rectTransform, canvas);
            var max = PixelAdjustPoint(r.max, rectTransform, canvas);
            return Rect.MinMaxRect(min.x, min.y, max.x, max.y);
        }

        public static Bounds CalculateRelativeRectTransformBounds(Transform root, Transform child)
        {
            var rts = child.GetComponentsInChildren<RectTransform>(false);
            if (rts.Length == 0) return new Bounds(Vector3.zero, Vector3.zero);
            var mn = new Vector3(float.MaxValue, float.MaxValue, float.MaxValue);
            var mx = new Vector3(float.MinValue, float.MinValue, float.MinValue);
            var aLocal = root.worldToLocalMatrix;
            foreach (var rt in rts)
            {
                rt.GetWorldCorners(esquinas);
                for (int i = 0; i < 4; i++) { var p = aLocal.MultiplyPoint3x4(esquinas[i]); mn = Vector3.Min(p, mn); mx = Vector3.Max(p, mx); }
            }
            var b = new Bounds(mn, Vector3.zero);
            b.Encapsulate(mx);
            return b;
        }

        public static Bounds CalculateRelativeRectTransformBounds(Transform trans) => CalculateRelativeRectTransformBounds(trans, trans);

        // como el de Unity: da vuelta el rect (anclas, pivote, posición) en un eje, y opcionalmente los hijos
        public static void FlipLayoutOnAxis(RectTransform rect, int axis, bool keepPositioning, bool recursive)
        {
            if (rect == null) return;
            if (recursive)
                for (int i = 0; i < rect.childCount; i++)
                    if (rect.GetChild(i) is RectTransform h) FlipLayoutOnAxis(h, axis, false, true);
            var pivot = rect.pivot; pivot[axis] = 1 - pivot[axis]; rect.pivot = pivot;
            if (keepPositioning) return;
            var pos = rect.anchoredPosition; pos[axis] = -pos[axis]; rect.anchoredPosition = pos;
            var amin = rect.anchorMin; var amax = rect.anchorMax;
            float t = amin[axis]; amin[axis] = 1 - amax[axis]; amax[axis] = 1 - t;
            rect.anchorMin = amin; rect.anchorMax = amax;
        }

        public static void FlipLayoutAxes(RectTransform rect, bool keepPositioning, bool recursive)
        {
            if (rect == null) return;
            if (recursive)
                for (int i = 0; i < rect.childCount; i++)
                    if (rect.GetChild(i) is RectTransform h) FlipLayoutAxes(h, false, true);
            rect.pivot = Cambiar(rect.pivot);
            rect.sizeDelta = Cambiar(rect.sizeDelta);
            if (keepPositioning) return;
            rect.anchoredPosition = Cambiar(rect.anchoredPosition);
            rect.anchorMin = Cambiar(rect.anchorMin);
            rect.anchorMax = Cambiar(rect.anchorMax);
        }

        static Vector2 Cambiar(Vector2 v) => new Vector2(v.y, v.x);
    }

    public partial interface ICanvasRaycastFilter
    {
        bool IsRaycastLocationValid(Vector2 sp, Camera eventCamera);
    }
}

namespace Porteo.UI
{
    // Los canvases: cada cuadro se ubica el rect de los raíz (según la pantalla o la cámara), se
    // avisa willRenderCanvases (el uGUI arma sus mallas) y se dibujan en orden: los de pantalla
    // al final, los de cámara y de mundo con su cámara.
    public static class Lienzos
    {
        internal static readonly List<Canvas> activos = new List<Canvas>();
        static readonly int ID_MAINTEX = Ids.De("_MainTex"), ID_ALPHATEX = Ids.De("_AlphaTex"), ID_CLIP = Ids.De("_ClipRect"),
            ID_SAMPLEADD = Ids.De("_TextureSampleAdd"), ID_ZTEST = Ids.De("unity_GUIZTestMode"),
            ID_VP = Ids.De("hlslcc_mtx4x4unity_MatrixVP"), ID_P = Ids.De("hlslcc_mtx4x4glstate_matrix_projection"), ID_V = Ids.De("hlslcc_mtx4x4unity_MatrixV"),
            ID_SCREEN = Ids.De("_ScreenParams");

        public static void Iniciar()
        {
            Mundo.AlEmpezarCuadro += ActualizarRaices;
            Mundo.AntesDeDibujar += () => { ActualizarRaices(); Canvas.Disparar(); };
            Dibujo.Superpuesto += DibujarSuperpuestos;
            Dibujo.EnCamara += DibujarDeCamara;
            Mundo.Dibujar += () => { if (!Gpu.Activo || Dibujo.Omitir) AsignarProfundidades(); };
        }

        // Sin dibujar (la prueba de consola, el adelanto) la profundidad de cada CanvasRenderer igual
        // se asigna, como hace Unity al armar los lotes de la UI aunque ninguna cámara dibuje: el
        // GraphicRaycaster de uGUI ignora lo que tiene profundidad -1 y, sin esto, nada se podía tocar
        static void AsignarProfundidades()
        {
            profundidad = 0;
            foreach (var c in activos)
                if (c.isActiveAndEnabled && c.isRootCanvas) SoloProfundidad(c.transform);
        }

        static void SoloProfundidad(Transform t)
        {
            var go = t.go;
            if (go == null || !go.activoEnJerarquia) return;
            var comps = go.componentes;
            for (int i = 0; i < comps.Count; i++)
                if (comps[i] is CanvasRenderer cr && !cr.destruido)
                {
                    cr.profundidad = !cr.descartado && cr.pos.Length > 0 && cr.tris.Length > 0 ? profundidad++ : -1;
                    break;
                }
            var hs = t.hijos;
            for (int i = 0; i < hs.Count; i++) SoloProfundidad(hs[i]);
        }

        internal static void Alta(Canvas c) { if (!activos.Contains(c)) activos.Add(c); ActualizarRaiz(c); }
        internal static void Baja(Canvas c) => activos.Remove(c);

        internal static Material MaterialDe(string shader)
        {
            var s = Shader.Find(shader);
            if (s == null) { Debug.LogWarning("porteo: no está el shader " + shader); return null; }
            var m = new Material(s) { m_Name = "Default UI Material" };
            Registro.Baja(m);
            return m;
        }

        // un Transform cambió de padre: un canvas que se manejó como raíz en este mismo cuadro y ahora
        // está dentro de otro recupera su rect (ver Canvas.conducido). Sólo en el mismo cuadro: uno
        // que fue raíz un rato y después se mueve se queda como estaba, como en Unity
        static readonly HashSet<Canvas> conducidos = new HashSet<Canvas>();
        static readonly List<Canvas> soltar = new List<Canvas>();

        internal static void PadreCambiado(Transform t)
        {
            if (conducidos.Count == 0) return;
            soltar.Clear();
            foreach (var c in conducidos) if (c.destruido || !c.isRootCanvas) soltar.Add(c);
            foreach (var c in soltar)
            {
                conducidos.Remove(c);
                c.conducido = false;
                if (c.destruido || c.cuadroConducido != Time.frameCount || !(c.transform is RectTransform rt)) continue;
                rt.pivot = c.pivoteAntes; rt.anchorMin = c.anclaMinAntes; rt.anchorMax = c.anclaMaxAntes; rt.sizeDelta = c.tamAntes;
                rt.localPosition = c.posAntes; rt.localScale = c.escalaAntes; rt.localRotation = c.rotAntes;
            }
        }

        static void ActualizarRaices()
        {
            foreach (var c in activos.ToArray()) if (c.isRootCanvas) ActualizarRaiz(c);
        }

        // el rect del canvas raíz: en pantalla, del tamaño de la pantalla (dividido la escala);
        // en modo cámara, además, delante de la cámara a planeDistance y del tamaño del encuadre
        internal static void ActualizarRaiz(Canvas c)
        {
            if (c.destruido || !(c.transform is RectTransform rt) || !c.isRootCanvas) return;
            float w = Screen.width, h = Screen.height, s = c.escala;
            if (c.modo == RenderMode.WorldSpace) return;
            if (!c.conducido)
            {
                c.conducido = true;
                c.cuadroConducido = Time.frameCount;
                conducidos.Add(c);
                c.pivoteAntes = rt.pivote; c.anclaMinAntes = rt.anchorMin; c.anclaMaxAntes = rt.anchorMax; c.tamAntes = rt.tamDelta;
                c.posAntes = rt.localPosition; c.escalaAntes = rt.localScale; c.rotAntes = rt.localRotation;
            }
            // el rect del canvas raíz lo maneja Unity: pivote al centro y anclas en cero. Las
            // escenas nuevas (2019+) lo guardan todo en cero, y con el pivote abajo a la izquierda
            // el contenido quedaría corrido medio canvas
            var centro = new Vector2(0.5f, 0.5f);
            if (rt.pivote != centro) rt.pivot = centro;
            if (rt.anchorMin != Vector2.zero || rt.anchorMax != Vector2.zero) { rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.zero; }
            var tam = new Vector2(w / s, h / s);
            if (c.modo == RenderMode.ScreenSpaceCamera && c.camara != null && !c.camara.destruido)
            {
                var cam = c.camara;
                var t = cam.transform;
                float d = c.distanciaPlano;
                float altoMundo = cam.orto ? cam.tamOrto * 2 : 2f * d * (float)Math.Tan(cam.fov * 0.5f * Math.PI / 180);
                var r = cam.pixelRect;
                tam = new Vector2(r.width / s, r.height / s);
                float esc = altoMundo / Math.Max(1e-4f, tam.y);
                rt.sizeDelta = tam;
                rt.localScale = new Vector3(esc, esc, esc);
                rt.SetPositionAndRotation(t.position + t.forward * d, t.rotation);
                return;
            }
            if (rt.tamDelta != tam) rt.sizeDelta = tam;
            var escala = new Vector3(s, s, s);
            if (rt.localScale != escala) rt.localScale = escala;
            if (rt.localRotation != Quaternion.identity) rt.localRotation = Quaternion.identity;
            var p = new Vector3(w * rt.pivote.x, h * rt.pivote.y, 0);
            if (rt.localPosition != p) rt.localPosition = p;
        }

        // ── dibujar ──
        // un tramo: lo que dibuja un CanvasRenderer con un material, ya pasado al espacio del canvas raíz
        struct Tramo
        {
            public Material Mat;
            public Texture Tex, TexAlfa;
            public bool Recorta;
            public Rect Recorte;
            public int Primero, Cantidad;
        }

        sealed class Lote
        {
            public Canvas Canvas;
            public int Capa, Orden, Secuencia;
            public readonly List<Tramo> Tramos = new List<Tramo>();
        }

        static readonly List<Vector3> vs = new List<Vector3>(4096), ns = new List<Vector3>(4096);
        static readonly List<Vector4> ts = new List<Vector4>(4096);
        static readonly List<Color32> cs = new List<Color32>(4096);
        static readonly List<Vector2> u0 = new List<Vector2>(4096), u1 = new List<Vector2>(4096), u2 = new List<Vector2>(4096), u3 = new List<Vector2>(4096);
        static readonly List<int> idx = new List<int>(8192);
        static readonly List<Lote> lotes = new List<Lote>();
        static readonly Stack<Lote> sobrantes = new Stack<Lote>();
        static Mesh malla;
        static int profundidad, secuencia;

        static void DibujarSuperpuestos()
        {
            var raices = new List<Canvas>();
            foreach (var c in activos)
                if (c.isActiveAndEnabled && c.isRootCanvas && (c.modo == RenderMode.ScreenSpaceOverlay || c.modo == RenderMode.ScreenSpaceCamera && (c.camara == null || c.camara.destruido)))
                    raices.Add(c);
            if (raices.Count == 0) return;
            Destinos.Atar(null);
            Convencion.Viewport(0, 0, Gpu.Ancho, Gpu.Alto);
            var g = Globales.Tabla;
            var orto = Convencion.Gpu(Matrix4x4.Ortho(0, Gpu.Ancho, 0, Gpu.Alto, -10000, 10000), false);
            g.Poner(ID_VP, Valor.Matriz(orto));
            g.Poner(ID_P, Valor.Matriz(orto));
            g.Poner(ID_V, Valor.Matriz(Matrix4x4.identity));
            g.Poner(ID_SCREEN, Valor.Vec(new Vector4(Gpu.Ancho, Gpu.Alto, 1f + 1f / Gpu.Ancho, 1f + 1f / Gpu.Alto)));
            g.Poner(ID_ZTEST, Valor.Numero(8));
            Gl.ClearDepthf(Convencion.Lejos);
            Gl.ClearStencil(0);
            Gpu.Limpiar(Gl.DEPTH_BUFFER_BIT | Gl.STENCIL_BUFFER_BIT);
            Dibujar(raices);
        }

        static void DibujarDeCamara(Camera cam)
        {
            var raices = new List<Canvas>();
            foreach (var c in activos)
            {
                if (!c.isActiveAndEnabled || !c.isRootCanvas) continue;
                if (c.modo == RenderMode.ScreenSpaceCamera && c.camara == cam) raices.Add(c);
                else if (c.modo == RenderMode.WorldSpace && (cam.mascara & (1 << c.go.capa)) != 0) raices.Add(c);
            }
            if (raices.Count == 0) return;
            Globales.Tabla.Poner(ID_ZTEST, Valor.Numero(4));
            Dibujar(raices);
        }

        static void Dibujar(List<Canvas> raices)
        {
            if (Dibujo.Apagado.Contains("sinui")) return;
            profundidad = 0;
            secuencia = 0;
            foreach (var l in lotes) { l.Tramos.Clear(); sobrantes.Push(l); }
            lotes.Clear();
            vs.Clear(); ns.Clear(); ts.Clear(); cs.Clear(); u0.Clear(); u1.Clear(); u2.Clear(); u3.Clear(); idx.Clear();
            foreach (var c in raices)
            {
                var lote = NuevoLote(c);
                var aRaiz = c.transform.worldToLocalMatrix;
                Recorrer(c.transform, c, lote, aRaiz, 1f);
            }
            if (idx.Count == 0) return;
            // los lotes por capa y orden (estable): los sub-canvas con su propio orden se intercalan
            lotes.Sort((a, b) => a.Capa != b.Capa ? a.Capa.CompareTo(b.Capa) : a.Orden != b.Orden ? a.Orden.CompareTo(b.Orden) : a.Secuencia.CompareTo(b.Secuencia));
            malla ??= Nueva();
            malla.Clear();
            malla.vertices = vs.ToArray();
            malla.normals = ns.ToArray();
            malla.tangents = ts.ToArray();
            malla.colors32 = cs.ToArray();
            malla.uv = u0.ToArray(); malla.uv2 = u1.ToArray(); malla.uv3 = u2.ToArray(); malla.uv4 = u3.ToArray();
            malla.SetIndices(idx.ToArray(), MeshTopology.Triangles, 0, false);
            if (!malla.Lista()) return;
            int orden = 0;
            foreach (var l in lotes)
            {
                l.Canvas.ordenDibujo = orden++;
                var o2w = l.Canvas.rootCanvas.transform.localToWorldMatrix;
                foreach (var t in l.Tramos) DibujarTramo(t, o2w);
            }
        }

        static Mesh Nueva() { var m = new Mesh { m_Name = "porteo_ui" }; Registro.Baja(m); return m; }

        static Lote NuevoLote(Canvas c)
        {
            var l = sobrantes.Count > 0 ? sobrantes.Pop() : new Lote();
            l.Canvas = c;
            l.Capa = SortingLayer.GetLayerValueFromID(c.capaOrdenId);
            l.Orden = c.ordenCapa;
            l.Secuencia = secuencia++;
            lotes.Add(l);
            return l;
        }

        // en orden de la jerarquía: primero el objeto, después los hijos, al final los materiales "pop" (máscaras)
        static void Recorrer(Transform t, Canvas raiz, Lote lote, in Matrix4x4 aRaiz, float alfaPadre)
        {
            var go = t.go;
            if (go == null || !go.activoEnJerarquia) return;
            float alfa = alfaPadre;
            CanvasRenderer cr = null;
            var comps = go.componentes;
            for (int i = 0; i < comps.Count; i++)
            {
                var c = comps[i];
                if (c is CanvasGroup g && g.isActiveAndEnabled) alfa = g.ignoraPadres ? g.alfa : alfa * g.alfa;
                else if (c is CanvasRenderer x && !x.destruido) cr = x;
                else if (c is Canvas cv && cv != raiz && cv.isActiveAndEnabled && cv.ordenPropio)
                    lote = NuevoLote(cv);
            }
            if (cr != null)
            {
                cr.profundidad = -1;
                if (!cr.descartado && cr.pos.Length > 0 && cr.tris.Length > 0)
                {
                    float a = alfa * cr.alfa;
                    cr.profundidad = profundidad++;
                    if (a > 0 || !cr.transparentesDescartados)
                    {
                        var m = aRaiz * t.localToWorldMatrix;
                        Agregar(cr, lote, m, a, cr.mats);
                    }
                }
                cr.versionMovida = t.version;
            }
            var hs = t.hijos;
            for (int i = 0; i < hs.Count; i++) Recorrer(hs[i], raiz, lote, aRaiz, alfa);
            if (cr != null && cr.matsPop.Length > 0 && cr.profundidad >= 0)
                Agregar(cr, lote, aRaiz * t.localToWorldMatrix, alfa * cr.alfa, cr.matsPop);
        }

        static void Agregar(CanvasRenderer cr, Lote lote, in Matrix4x4 m, float alfa, Material[] mats)
        {
            int base_ = vs.Count;
            int n = cr.pos.Length;
            var col = cr.color;
            for (int i = 0; i < n; i++)
            {
                vs.Add(m.MultiplyPoint3x4(cr.pos[i]));
                ns.Add(cr.nor != null ? m.MultiplyVector(cr.nor[i]).normalized : Vector3.back);
                ts.Add(cr.tan != null ? cr.tan[i] : new Vector4(1, 0, 0, -1));
                var c = cr.col != null ? cr.col[i] : new Color32(255, 255, 255, 255);
                cs.Add(new Color32((byte)(c.r * col.r), (byte)(c.g * col.g), (byte)(c.b * col.b), (byte)Math.Clamp(c.a * col.a * alfa, 0, 255)));
                u0.Add(cr.uv0 != null ? cr.uv0[i] : default);
                u1.Add(cr.uv1 != null ? cr.uv1[i] : default);
                u2.Add(cr.uv2 != null ? cr.uv2[i] : default);
                u3.Add(cr.uv3 != null ? cr.uv3[i] : default);
            }
            int primero = idx.Count;
            foreach (var k in cr.tris) idx.Add(base_ + k);
            foreach (var mat in mats)
            {
                if ((object)mat == null || mat.destruido) continue;
                var tr = new Tramo { Mat = mat, Tex = cr.textura, TexAlfa = cr.texAlfa, Recorta = cr.recortar, Recorte = cr.recorte, Primero = primero, Cantidad = cr.tris.Length };
                // seguido y con el mismo estado: se dibuja todo junto
                var l = lote.Tramos;
                if (l.Count > 0)
                {
                    var u = l[l.Count - 1];
                    if (u.Mat == tr.Mat && u.Tex == tr.Tex && u.TexAlfa == tr.TexAlfa && u.Recorta == tr.Recorta && (!tr.Recorta || u.Recorte == tr.Recorte) && u.Primero + u.Cantidad == primero)
                    {
                        u.Cantidad += tr.Cantidad;
                        l[l.Count - 1] = u;
                        continue;
                    }
                }
                l.Add(tr);
            }
        }

        static readonly Tabla extra = new Tabla();

        static void DibujarTramo(in Tramo t, in Matrix4x4 o2w)
        {
            var ss = t.Mat.sh?.Activo();
            if (ss == null) return;
            extra.Limpiar();
            if ((object)t.Tex != null) extra.PonerTextura(ID_MAINTEX, t.Tex);
            if ((object)t.TexAlfa != null) extra.PonerTextura(ID_ALPHATEX, t.TexAlfa);
            // las texturas de las fuentes son de sólo alfa: Unity suma blanco al color que leen
            bool soloAlfa = t.Tex is Texture2D t2 && t2.formato == TextureFormat.Alpha8;
            extra.Poner(ID_SAMPLEADD, Valor.Vec(soloAlfa ? new Vector4(1, 1, 1, 0) : Vector4.zero));
            if (t.Recorta) extra.Poner(ID_CLIP, Valor.Vec(new Vector4(t.Recorte.xMin, t.Recorte.yMin, t.Recorte.xMax, t.Recorte.yMax)));
            foreach (var pa in ss.Pasadas)
            {
                // las pasadas de sombras, de lightmaps y de luces extra no son para la UI
                switch (pa.LightMode)
                {
                    case "SHADOWCASTER": case "META": case "FORWARDADD": case "DEFERRED": case "PREPASSBASE": case "PREPASSFINAL": case "MOTIONVECTORS": continue;
                }
                if (t.Mat.pasadasApagadas != null && t.Mat.pasadasApagadas.Contains(pa.LightMode)) continue;
                Dibujo.Rango(malla, t.Primero, t.Cantidad, o2w, t.Mat, pa, extra, t.Recorta ? Claves.UNITY_UI_CLIP_RECT : 0);
            }
        }
    }
}

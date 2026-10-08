using System;
using System.Collections.Generic;
using Porteo;
using UnityEngine;
using Object = UnityEngine.Object;
using Porteo.Datos;
using Porteo.Render;

namespace UnityEngine
{
    public partial class Renderer : Component
    {
        internal bool habilitado = true;
        internal Material[] mats = Array.Empty<Material>();
        internal MaterialPropertyBlock bloque;
        internal int sombras = 1;
        internal bool recibeSombras = true;
        internal int capaOrden, orden, capaOrdenId;
        internal int lightmap = 65535;
        internal Vector4 lightmapST = new Vector4(1, 1, 0, 0);
        internal int estaticoPrimera = -1, estaticoCantidad;   // batching estático: submallas de la malla combinada
        internal Transform raizEstatica;
        internal int indiceActivo = -1;    // posición en Renders.activos
        internal LODGroup lodGrupo;
        internal int lodMascara;
        internal int cuadroVisible = -1;
        internal int reflejo = 1, sondaLuz = 1;

        internal override bool HabilitadoNativo => habilitado;
        internal override void AlActivarse() => Renders.Alta(this);
        internal override void AlDesactivarse() => Renders.Baja(this);
        internal override void AlDestruirse() => Renders.Baja(this);

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            habilitado = m.B("m_Enabled", true);
            sombras = m.I32("m_CastShadows", 1);
            recibeSombras = m.B("m_ReceiveShadows", true);
            lightmap = m.I32("m_LightmapIndex", 65535);
            var st = m.M("m_LightmapTilingOffset");
            if (st != null) lightmapST = Serial.V4(st);
            reflejo = m.I32("m_ReflectionProbeUsage", 1);
            sondaLuz = m.I32("m_LightProbeUsage", 1);
            var lm = m.L("m_Materials");
            if (lm != null)
            {
                mats = new Material[lm.Count];
                for (int i = 0; i < lm.Count; i++) mats[i] = lm[i] is PPtr p ? r.Resolver(p) as Material : null;
            }
            var sb = m.M("m_StaticBatchInfo");
            if (sb != null && sb.I32("subMeshCount") > 0)
            {
                estaticoPrimera = sb.I32("firstSubMesh");
                estaticoCantidad = sb.I32("subMeshCount");
                raizEstatica = r.Resolver(m.P("m_StaticBatchRoot")) as Transform;
            }
            capaOrdenId = m.I32("m_SortingLayerID");
            capaOrden = m.I32("m_SortingLayer");
            orden = m.I32("m_SortingOrder");
        }

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            var x = (Renderer)o;
            habilitado = x.habilitado;
            mats = (Material[])x.mats.Clone();
            sombras = x.sombras; recibeSombras = x.recibeSombras;
            lightmap = x.lightmap; lightmapST = x.lightmapST;
            capaOrden = x.capaOrden; capaOrdenId = x.capaOrdenId; orden = x.orden;
            reflejo = x.reflejo; sondaLuz = x.sondaLuz;
            if (x.bloque != null) { bloque = new MaterialPropertyBlock(); bloque.CopiarDe(x.bloque); }
            // el batching estático no pasa a las copias: Unity tampoco lo hace
        }

        public bool enabled
        {
            get => habilitado;
            set { if (habilitado == value) return; habilitado = value; Activacion.HabilitacionCambiada(this); }
        }

        public bool isVisible => cuadroVisible >= Time.frameCount - 1;
        public Rendering.ShadowCastingMode shadowCastingMode { get => (Rendering.ShadowCastingMode)sombras; set => sombras = (int)value; }
        public bool receiveShadows { get => recibeSombras; set => recibeSombras = value; }
        public int sortingLayerID { get => capaOrdenId; set => capaOrdenId = value; }
        public string sortingLayerName { get => SortingLayer.IDToName(capaOrdenId); set => capaOrdenId = SortingLayer.NameToID(value); }
        public int sortingOrder { get => orden; set => orden = value; }
        public int lightmapIndex { get => lightmap; set => lightmap = value; }
        public Vector4 lightmapScaleOffset { get => lightmapST; set => lightmapST = value; }
        public bool isPartOfStaticBatch => estaticoPrimera >= 0;
        public Matrix4x4 localToWorldMatrix => transform.localToWorldMatrix;
        public Matrix4x4 worldToLocalMatrix => transform.worldToLocalMatrix;
        public Rendering.LightProbeUsage lightProbeUsage { get => (Rendering.LightProbeUsage)sondaLuz; set => sondaLuz = (int)value; }
        public Rendering.ReflectionProbeUsage reflectionProbeUsage { get => (Rendering.ReflectionProbeUsage)reflejo; set => reflejo = (int)value; }
        public Transform probeAnchor { get; set; }
        public bool allowOcclusionWhenDynamic { get; set; } = true;

        public Material[] sharedMaterials
        {
            get => (Material[])mats.Clone();
            set => mats = value == null ? Array.Empty<Material>() : (Material[])value.Clone();
        }

        public Material sharedMaterial
        {
            get => mats.Length > 0 ? mats[0] : null;
            set { if (mats.Length == 0) mats = new Material[1]; else mats = (Material[])mats.Clone(); mats[0] = value; }
        }

        // como en Unity: pedir .material(s) crea copias propias del renderer (una sola vez)
        bool[] propios;

        public Material[] materials
        {
            get
            {
                for (int i = 0; i < mats.Length; i++) Propio(i);
                return (Material[])mats.Clone();
            }
            set { mats = value == null ? Array.Empty<Material>() : (Material[])value.Clone(); propios = null; }
        }

        public Material material
        {
            get { if (mats.Length == 0) return null; Propio(0); return mats[0]; }
            set { sharedMaterial = value; if (propios != null && propios.Length > 0) propios[0] = false; }
        }

        void Propio(int i)
        {
            if ((object)mats[i] == null) return;
            if (propios == null || propios.Length != mats.Length) propios = new bool[mats.Length];
            if (propios[i]) return;
            var c = new Material(mats[i]) { m_Name = mats[i].m_Name + " (Instance)" };
            mats[i] = c;
            propios[i] = true;
        }

        public void SetPropertyBlock(MaterialPropertyBlock properties)
        {
            if (properties == null || properties.isEmpty) { bloque = null; return; }
            bloque ??= new MaterialPropertyBlock();
            bloque.CopiarDe(properties);
        }

        public void GetPropertyBlock(MaterialPropertyBlock dest)
        {
            if (dest == null) return;
            if (bloque == null) dest.Clear(); else dest.CopiarDe(bloque);
        }

        public bool HasPropertyBlock() => bloque != null && !bloque.isEmpty;

        // ── límites en el mundo ──
        int versionLimites = -1, versionMalla = -1;
        Bounds limitesMundo;

        public Bounds bounds
        {
            get
            {
                var t = transform;
                var m = MallaParaDibujar();
                int vm = m?.version ?? 0;
                if (t == null) return default;
                if (versionLimites == t.version && versionMalla == vm && !(this is SkinnedMeshRenderer) && !LimitesCambian) return limitesMundo;
                versionLimites = t.version; versionMalla = vm;
                limitesMundo = CalcularLimites();
                return limitesMundo;
            }
        }

        internal virtual Mesh MallaParaDibujar() => null;

        // las partículas: geometría ya en el mundo, armada para cada cámara, con límites que
        // cambian cada cuadro aunque el transform no se mueva
        internal virtual bool VerticesEnMundo => false;
        internal virtual bool LimitesCambian => false;
        internal virtual bool PrepararDibujo(Camera cam) => true;

        internal virtual Bounds CalcularLimites()
        {
            var m = MallaParaDibujar();
            if ((object)m == null) return new Bounds(transform.position, Vector3.zero);
            if (estaticoPrimera >= 0)
            {
                // las submallas de la malla combinada ya están en el mundo (o relativas a su raíz)
                Bounds b = default; bool primera = true;
                for (int i = estaticoPrimera; i < estaticoPrimera + estaticoCantidad && i < m.submallas.Length; i++)
                {
                    var s = m.submallas[i].Limites;
                    if (primera) { b = s; primera = false; } else b.Encapsulate(s);
                }
                return raizEstatica != null ? Renders.Transformar(b, raizEstatica.localToWorldMatrix) : b;
            }
            return Renders.Transformar(m.limites, transform.localToWorldMatrix);
        }
    }

    public partial class MeshRenderer : Renderer
    {
        internal MeshFilter filtro;

        internal override Mesh MallaParaDibujar()
        {
            if ((object)filtro == null || filtro.destruido || filtro.go != go) filtro = go?.GetComponent<MeshFilter>();
            return filtro?.malla;
        }

        public Mesh additionalVertexStreams { get; set; }
    }

    public partial class SkinnedMeshRenderer : Renderer
    {
        internal Mesh malla;
        internal Transform[] huesos = Array.Empty<Transform>();
        internal Transform raiz;
        internal Bounds aabb;
        internal bool siempre;
        internal float[] pesosForma = Array.Empty<float>();

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            base.LeerNativo(m, r);
            malla = r.Resolver(m.P("m_Mesh")) as Mesh;
            var lb = m.L("m_Bones");
            if (lb != null)
            {
                huesos = new Transform[lb.Count];
                for (int i = 0; i < lb.Count; i++) huesos[i] = lb[i] is PPtr p ? r.Resolver(p) as Transform : null;
            }
            raiz = r.Resolver(m.P("m_RootBone")) as Transform;
            var a = m.M("m_AABB");
            aabb = new Bounds { center = Serial.V3(a?.M("m_Center")), extents = Serial.V3(a?.M("m_Extent")) };
            siempre = m.B("m_UpdateWhenOffscreen");
            var bw = m.L("m_BlendShapeWeights");
            if (bw != null) pesosForma = bw.ConvertAll(x => Convert.ToSingle(x)).ToArray();
        }

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            base.CopiarDe(o, remap);
            var x = (SkinnedMeshRenderer)o;
            malla = x.malla;
            huesos = new Transform[x.huesos.Length];
            for (int i = 0; i < huesos.Length; i++) huesos[i] = remap(x.huesos[i]) as Transform;
            raiz = remap(x.raiz) as Transform;
            aabb = x.aabb; siempre = x.siempre;
            pesosForma = (float[])x.pesosForma.Clone();
        }

        internal override Mesh MallaParaDibujar() => malla;

        public Mesh sharedMesh { get => malla; set => malla = value; }
        public Transform[] bones { get => (Transform[])huesos.Clone(); set => huesos = value ?? Array.Empty<Transform>(); }
        public Transform rootBone { get => raiz; set => raiz = value; }
        public Bounds localBounds { get => aabb; set => aabb = value; }
        public bool updateWhenOffscreen { get => siempre; set => siempre = value; }
        public SkinQuality quality { get; set; }

        public float GetBlendShapeWeight(int index) => index >= 0 && index < pesosForma.Length ? pesosForma[index] : 0f;

        public void SetBlendShapeWeight(int index, float value)
        {
            if (index < 0) return;
            if (index >= pesosForma.Length) Array.Resize(ref pesosForma, index + 1);
            pesosForma[index] = value;
        }

        // el espacio en que quedan los vértices con piel: el de la raíz (o el del renderer)
        internal Transform Espacio => raiz != null && !raiz.destruido ? raiz : transform;

        internal override Bounds CalcularLimites() => Renders.Transformar(aabb, Espacio.localToWorldMatrix);

        // ── piel en la CPU: posiciones, normales y tangentes en el espacio de la raíz ──
        internal uint vboPiel;
        float[] piel;
        int cuadroPiel = -1;
        Matrix4x4[] matrices;

        internal unsafe uint Piel()
        {
            if (cuadroPiel == Time.frameCount && vboPiel != 0) return vboPiel;
            var m = malla;
            if ((object)m == null || m.poses.Length == 0) return 0;
            var b = m.Crudo();
            if (b == null) return 0;
            int n = m.nVertices;
            var cp = m.canales[Canales.POSICION]; var cn = m.canales[Canales.NORMAL]; var ct = m.canales[Canales.TANGENTE];
            var cw = m.canales[Canales.PESOS]; var ci = m.canales[Canales.HUESOS];
            if (cp.Dim == 0 || cw.Dim == 0 || ci.Dim == 0 || cp.Formato != 0) return 0;
            int nh = m.poses.Length;
            if (matrices == null || matrices.Length != nh) matrices = new Matrix4x4[nh];
            var aRaiz = Espacio.worldToLocalMatrix;
            for (int i = 0; i < nh; i++)
            {
                var h = i < huesos.Length ? huesos[i] : null;
                matrices[i] = h != null && !h.destruido ? aRaiz * h.localToWorldMatrix * m.poses[i] : Matrix4x4.identity;
            }
            if (piel == null || piel.Length != n * 10) piel = new float[n * 10];
            fixed (byte* d = b)
            fixed (float* o = piel)
            {
                int pp = m.pasoStream[cp.Stream], ip = m.inicioStream[cp.Stream] + cp.Offset;
                int pn = m.pasoStream[cn.Stream], ino = m.inicioStream[cn.Stream] + cn.Offset;
                int pt = m.pasoStream[ct.Stream], it = m.inicioStream[ct.Stream] + ct.Offset;
                int pw = m.pasoStream[cw.Stream], iw = m.inicioStream[cw.Stream] + cw.Offset;
                int pi = m.pasoStream[ci.Stream], ii = m.inicioStream[ci.Stream] + ci.Offset;
                for (int v = 0; v < n; v++)
                {
                    float* w = (float*)(d + iw + v * pw);
                    int* h = (int*)(d + ii + v * pi);
                    float* p = (float*)(d + ip + v * pp);
                    Vector3 sp = default, sn = default, st = default;
                    float tw = 1;
                    for (int k = 0; k < 4; k++)
                    {
                        float peso = w[k];
                        if (peso <= 0) continue;
                        int hi = h[k];
                        if (hi < 0 || hi >= nh) continue;
                        ref var mm = ref matrices[hi];
                        sp += mm.MultiplyPoint3x4(new Vector3(p[0], p[1], p[2])) * peso;
                        if (cn.Dim >= 3 && cn.Formato == 0) { float* q = (float*)(d + ino + v * pn); sn += mm.MultiplyVector(new Vector3(q[0], q[1], q[2])) * peso; }
                        if (ct.Dim >= 4 && ct.Formato == 0) { float* q = (float*)(d + it + v * pt); st += mm.MultiplyVector(new Vector3(q[0], q[1], q[2])) * peso; tw = q[3]; }
                    }
                    float* s = o + v * 10;
                    s[0] = sp.x; s[1] = sp.y; s[2] = sp.z;
                    var nn = sn.normalized; s[3] = nn.x; s[4] = nn.y; s[5] = nn.z;
                    var tt = st.normalized; s[6] = tt.x; s[7] = tt.y; s[8] = tt.z; s[9] = tw;
                }
                if (vboPiel == 0) vboPiel = Gpu.Buffer(Gl.ARRAY_BUFFER, o, piel.Length * 4, Gl.DYNAMIC_DRAW);
                else { Gpu.UsarVao(0); Gl.BindBuffer(Gl.ARRAY_BUFFER, vboPiel); Gl.BufferData(Gl.ARRAY_BUFFER, piel.Length * 4, o, Gl.DYNAMIC_DRAW); }
            }
            cuadroPiel = Time.frameCount;
            return vboPiel;
        }

        internal override void AlDestruirse()
        {
            base.AlDestruirse();
            if (Gpu.Activo) Gpu.Borrar(ref vboPiel);
        }

        public void BakeMesh(Mesh mesh)
        {
            if ((object)mesh == null || (object)malla == null) return;
            var copia = (Mesh)malla.ClonarAsset();
            var vs = copia.vertices;
            var bw = malla.boneWeights;
            var aRaiz = transform.worldToLocalMatrix;
            for (int i = 0; i < vs.Length && i < bw.Length; i++)
            {
                var w = bw[i];
                Vector3 p = default;
                void Sumar(int h, float peso) { if (peso > 0 && h >= 0 && h < huesos.Length && huesos[h] != null) p += (aRaiz * huesos[h].localToWorldMatrix * malla.poses[h]).MultiplyPoint3x4(vs[i]) * peso; }
                Sumar(w.boneIndex0, w.weight0); Sumar(w.boneIndex1, w.weight1); Sumar(w.boneIndex2, w.weight2); Sumar(w.boneIndex3, w.weight3);
                vs[i] = p;
            }
            mesh.Clear();
            mesh.vertices = vs;
            mesh.normals = copia.normals;
            mesh.uv = copia.uv;
            mesh.subMeshCount = copia.subMeshCount;
            for (int s = 0; s < copia.subMeshCount; s++) mesh.SetTriangles(copia.GetIndices(s), s);
        }
    }

    public enum SkinQuality { Auto = 0, Bone1 = 1, Bone2 = 2, Bone4 = 4 }

    public partial class LODGroup : Component
    {
        internal Vector3 referencia;
        internal float tamano = 1;
        internal float[] alturas = Array.Empty<float>();
        internal Renderer[][] niveles = Array.Empty<Renderer[]>();
        internal bool habilitado = true;
        internal int forzado = -1;
        internal int seleccion = 0;    // el nivel elegido para la cámara actual (-1: ninguno)

        internal override bool HabilitadoNativo => habilitado;
        internal override void AlActivarse() => Renders.AltaLod(this);
        internal override void AlDesactivarse() => Renders.BajaLod(this);
        internal override void AlDestruirse() => Renders.BajaLod(this);

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            referencia = Serial.V3(m.M("m_LocalReferencePoint"));
            tamano = m.F("m_Size", 1);
            habilitado = m.B("m_Enabled", true);
            var l = m.L("m_LODs");
            if (l == null) return;
            alturas = new float[l.Count];
            niveles = new Renderer[l.Count][];
            for (int i = 0; i < l.Count; i++)
            {
                var x = (Mapa)l[i];
                alturas[i] = x.F("screenRelativeHeight");
                var rs = x.L("renderers");
                var lr = new List<Renderer>();
                if (rs != null) foreach (var y in rs) if (y is Mapa ym && r.Resolver(ym.P("renderer")) is Renderer rr) lr.Add(rr);
                niveles[i] = lr.ToArray();
            }
            Vincular();
        }

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            var x = (LODGroup)o;
            referencia = x.referencia; tamano = x.tamano; habilitado = x.habilitado;
            alturas = (float[])x.alturas.Clone();
            niveles = new Renderer[x.niveles.Length][];
            for (int i = 0; i < niveles.Length; i++)
            {
                niveles[i] = new Renderer[x.niveles[i].Length];
                for (int j = 0; j < niveles[i].Length; j++) niveles[i][j] = remap(x.niveles[i][j]) as Renderer;
            }
            Vincular();
        }

        // cada renderer sabe a qué grupo y en qué niveles está
        void Vincular()
        {
            for (int i = 0; i < niveles.Length && i < 31; i++)
                foreach (var rr in niveles[i])
                    if ((object)rr != null) { rr.lodGrupo = this; rr.lodMascara |= 1 << i; }
        }

        public bool enabled { get => habilitado; set { if (habilitado == value) return; habilitado = value; Activacion.HabilitacionCambiada(this); } }
        public Vector3 localReferencePoint { get => referencia; set => referencia = value; }
        public float size { get => tamano; set => tamano = value; }
        public int lodCount => niveles.Length;
        public void ForceLOD(int index) => forzado = index;
        public void RecalculateBounds() { }

        public LOD[] GetLODs()
        {
            var r = new LOD[niveles.Length];
            for (int i = 0; i < r.Length; i++) r[i] = new LOD(alturas[i], niveles[i]);
            return r;
        }

        public void SetLODs(LOD[] lods)
        {
            foreach (var n in niveles) foreach (var rr in n) if ((object)rr != null && rr.lodGrupo == this) { rr.lodGrupo = null; rr.lodMascara = 0; }
            alturas = new float[lods.Length];
            niveles = new Renderer[lods.Length][];
            for (int i = 0; i < lods.Length; i++) { alturas[i] = lods[i].screenRelativeTransitionHeight; niveles[i] = lods[i].renderers ?? Array.Empty<Renderer>(); }
            Vincular();
        }

        // el nivel para una cámara: la altura relativa en pantalla contra los umbrales (con lodBias)
        internal void Elegir(Vector3 camPos, float mitadTanFov, bool orto, float tamOrto)
        {
            if (forzado >= 0) { seleccion = forzado; return; }
            var t = transform;
            var centro = t.TransformPoint(referencia);
            var esc = t.lossyScale;
            float tam = tamano * Math.Max(Math.Abs(esc.x), Math.Max(Math.Abs(esc.y), Math.Abs(esc.z)));
            float rel = orto ? tam / (tamOrto * 2f) : tam / (2f * Math.Max(0.0001f, Vector3.Distance(camPos, centro)) * mitadTanFov);
            rel *= QualitySettings.lodBias;
            int min = QualitySettings.maximumLODLevel;
            seleccion = -1;
            for (int i = 0; i < alturas.Length; i++)
                if (rel >= alturas[i]) { seleccion = Math.Max(i, Math.Min(min, alturas.Length - 1)); break; }
        }
    }

    public partial struct LOD
    {
        public float screenRelativeTransitionHeight;
        public float fadeTransitionWidth;
        public Renderer[] renderers;

        public LOD(float screenRelativeTransitionHeight, Renderer[] renderers)
        {
            this.screenRelativeTransitionHeight = screenRelativeTransitionHeight;
            this.renderers = renderers;
            fadeTransitionWidth = 0;
        }
    }
}

namespace Porteo.Render
{
    // Los renderers y grupos LOD activos (los que se consideran al dibujar cada cámara).
    public static class Renders
    {
        internal static readonly List<Renderer> activos = new List<Renderer>(4096);
        internal static readonly List<LODGroup> lods = new List<LODGroup>(1024);

        internal static void Alta(Renderer r)
        {
            if (r.indiceActivo >= 0) return;
            r.indiceActivo = activos.Count;
            activos.Add(r);
        }

        internal static void Baja(Renderer r)
        {
            int i = r.indiceActivo;
            if (i < 0) return;
            int ult = activos.Count - 1;
            if (i != ult) { activos[i] = activos[ult]; activos[i].indiceActivo = i; }
            activos.RemoveAt(ult);
            r.indiceActivo = -1;
        }

        internal static void AltaLod(LODGroup g) { if (!lods.Contains(g)) lods.Add(g); }
        internal static void BajaLod(LODGroup g) => lods.Remove(g);

        public static Bounds Transformar(Bounds b, in Matrix4x4 m)
        {
            var c = m.MultiplyPoint3x4(b.center);
            var e = b.extents;
            var ex = new Vector3(
                Math.Abs(m.m00) * e.x + Math.Abs(m.m01) * e.y + Math.Abs(m.m02) * e.z,
                Math.Abs(m.m10) * e.x + Math.Abs(m.m11) * e.y + Math.Abs(m.m12) * e.z,
                Math.Abs(m.m20) * e.x + Math.Abs(m.m21) * e.y + Math.Abs(m.m22) * e.z);
            return new Bounds { center = c, extents = ex };
        }
    }
}

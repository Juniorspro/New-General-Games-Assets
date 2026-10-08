using System;
using System.Collections.Generic;
using Porteo;
using Porteo.Datos;
using Porteo.Fisica;
using UnityEngine;
using Object = UnityEngine.Object;

namespace UnityEngine
{
    // Un colisionador: una forma de PhysX en el actor de su Rigidbody (el más cercano hacia
    // arriba en la jerarquía) o, si no tiene, en un actor estático propio en su objeto.
    public partial class Collider : Component
    {
        internal int id = -1;            // propio (lo usa el filtro de PhysX para IgnoreCollision)
        internal int forma = -1;
        internal int actorPropio = -1;
        internal Rigidbody cuerpo;
        internal bool montado;           // activo y habilitado
        internal bool habilitadoCol = true, esTrigger;
        internal PhysicMaterial materialFisico;
        Vector3 escalaMontada;

        internal override bool HabilitadoNativo => habilitadoCol;

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            habilitadoCol = m.B("m_Enabled", true);
            esTrigger = m.B("m_IsTrigger");
            materialFisico = r.Resolver(m.P("m_Material")) as PhysicMaterial;
            LeerForma(m, r);
        }

        internal virtual void LeerForma(Mapa m, IResolutor r) { }

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            base.CopiarDe(o, remap);
            var x = (Collider)o;
            habilitadoCol = x.habilitadoCol; esTrigger = x.esTrigger; materialFisico = x.materialFisico;
            CopiarForma(x, remap);
        }

        internal virtual void CopiarForma(Collider x, Func<Object, Object> remap) { }

        // ── ciclo de vida ──
        internal override void AlActivarse()
        {
            if (id < 0) id = Simulacion.IdColisionador(this);
            montado = true;
            Simulacion.Pendiente(this);
        }

        internal override void AlDesactivarse()
        {
            montado = false;
            Simulacion.Olvidar(this);
            Desmontar();
        }

        internal override void AlDestruirse()
        {
            montado = false;
            Simulacion.Olvidar(this);
            Desmontar();
            if (id >= 0) { Simulacion.LiberarId(id); id = -1; }
        }

        internal override void AlCambiarTransform()
        {
            if (montado && forma >= 0) Simulacion.PoseSucia(this);
        }

        // el Rigidbody activo más cercano hacia arriba (Unity: el cuerpo al que pertenece)
        internal Rigidbody BuscarCuerpo()
        {
            for (var t = transform; t != null; t = t.padre)
            {
                var cs = t.go?.componentes;
                if (cs == null) continue;
                for (int i = 0; i < cs.Count; i++)
                    if (cs[i] is Rigidbody rb && !rb.destruido && rb.go.activoEnJerarquia) return rb;
            }
            return null;
        }

        // la rotación que lleva el eje de la forma de PhysX al de Unity (las cápsulas)
        internal virtual Quaternion EjeLocal => Quaternion.identity;
        internal virtual Vector3 Centro => Vector3.zero;

        // crea la forma de PhysX en el actor, con su pose local y la escala del objeto
        internal virtual unsafe int CrearForma(int actor, Vector3 pos, Quaternion rot, Vector3 escala) => -1;

        internal unsafe void Montar()
        {
            Desmontar();
            if (!montado || destruido || go == null || !go.activoEnJerarquia || !Simulacion.Activa) return;
            if (this is CharacterController cc) { cc.CrearControlador(); return; }
            var t = transform;
            var rb = BuscarCuerpo();
            if (rb != null && rb.actor < 0) rb.Crear();
            Vector3 pos; Quaternion rot;
            int actor;
            if (rb != null && rb.actor >= 0)
            {
                cuerpo = rb;
                actor = rb.actor;
                PoseEnCuerpo(out pos, out rot);
            }
            else
            {
                var p = t.position; var q = t.rotation;
                actorPropio = Px.fx_actor(0, (float*)&p, (float*)&q);
                actor = actorPropio;
                pos = Vector3.Scale(Centro, t.lossyScale);
                rot = EjeLocal;
            }
            escalaMontada = t.lossyScale;
            forma = CrearForma(actor, pos, rot, escalaMontada);
            if (forma < 0)
            {
                if (actorPropio >= 0) { Px.fx_actor_borrar(actorPropio); actorPropio = -1; }
                cuerpo = null;
                return;
            }
            Simulacion.AnotarForma(forma, this);
            if (actorPropio >= 0) Px.fx_actor_en_escena(actorPropio, 1);
            if (cuerpo != null)
            {
                cuerpo.formas.Add(this);
                Simulacion.MasaSucia(cuerpo);
                if (cuerpo.ConCcd) AplicarCapa();
            }
        }

        // la pose de la forma respecto del actor de su cuerpo (puede estar en un hijo)
        void PoseEnCuerpo(out Vector3 pos, out Quaternion rot)
        {
            var t = transform;
            if (cuerpo.go == go)
            {
                pos = Vector3.Scale(Centro, t.lossyScale);
                rot = EjeLocal;
                return;
            }
            var tb = cuerpo.transform;
            var inv = Quaternion.Inverse(tb.rotation);
            pos = inv * (t.TransformPoint(Centro) - tb.position);
            rot = inv * t.rotation * EjeLocal;
        }

        internal void Desmontar()
        {
            if (this is CharacterController cc) { cc.BorrarControlador(); return; }
            if (forma >= 0)
            {
                Simulacion.AnotarForma(forma, null);
                // borrar el actor propio suelta también su forma
                if (actorPropio < 0 && Simulacion.Activa) Px.fx_forma_borrar(forma);
                forma = -1;
            }
            if (actorPropio >= 0 && Simulacion.Activa) Px.fx_actor_borrar(actorPropio);
            actorPropio = -1;
            if (cuerpo != null)
            {
                cuerpo.formas.Remove(this);
                if (!cuerpo.destruido) Simulacion.MasaSucia(cuerpo);
                cuerpo = null;
            }
        }

        // el actor de su cuerpo se borró (con sus formas)
        internal void FormaPerdida()
        {
            if (forma >= 0) Simulacion.AnotarForma(forma, null);
            forma = -1;
            cuerpo = null;
            if (montado) Simulacion.Pendiente(this);
        }

        // el Transform cambió: mover el actor propio o la forma dentro del cuerpo
        internal unsafe void ActualizarPose()
        {
            if (this is CharacterController cc) { cc.SincronizarPosicion(); return; }
            if (!montado || forma < 0 || go == null) return;
            var t = transform;
            if ((t.lossyScale - escalaMontada).sqrMagnitude > 1e-10f) { Simulacion.Pendiente(this); return; }
            if (actorPropio >= 0)
            {
                var p = t.position; var q = t.rotation;
                Px.fx_actor_pose(actorPropio, (float*)&p, (float*)&q);
            }
            else if (cuerpo != null && cuerpo.go != go)
            {
                PoseEnCuerpo(out var pos, out var rot);
                Px.fx_forma_pose(forma, (float*)&pos, (float*)&rot);
            }
        }

        internal int Capa => go != null ? go.capa : 0;
        internal uint Mascara => Simulacion.Mascara(Capa);
        internal int Material => PhysicMaterial.Id(materialFisico ?? Simulacion.materialDefecto);

        internal void AplicarCapa()
        {
            if (forma < 0) return;
            Px.fx_forma_capa(forma, Capa, Mascara, cuerpo != null && cuerpo.ConCcd ? 1 : 0);
            Px.fx_refiltrar(forma);
        }

        // ── API de Unity ──
        public bool enabled
        {
            get => habilitadoCol;
            set
            {
                if (habilitadoCol == value) return;
                habilitadoCol = value;
                Activacion.HabilitacionCambiada(this);
            }
        }

        public bool isTrigger
        {
            get => esTrigger;
            set
            {
                if (esTrigger == value) return;
                esTrigger = value;
                if (forma >= 0) { Px.fx_forma_estado(forma, 1, value ? 1 : 0); Px.fx_refiltrar(forma); if (cuerpo != null) Simulacion.MasaSucia(cuerpo); }
            }
        }

        public PhysicMaterial sharedMaterial
        {
            get => materialFisico;
            set { materialFisico = value; if (forma >= 0) Px.fx_forma_material(forma, Material); }
        }

        public PhysicMaterial material
        {
            get
            {
                // como Unity: pedir .material lo vuelve propio
                if (materialFisico == null || materialFisico.archivo != null || !materialPropio)
                {
                    var m = materialFisico != null ? new PhysicMaterial(materialFisico) : new PhysicMaterial();
                    materialPropio = true;
                    sharedMaterial = m;
                }
                return materialFisico;
            }
            set => sharedMaterial = value;
        }
        bool materialPropio;

        public Rigidbody attachedRigidbody => montado && cuerpo != null ? cuerpo : BuscarCuerpo();

        public unsafe Bounds bounds
        {
            get
            {
                Simulacion.Sincronizar();
                if (forma < 0) return new Bounds(transform != null ? transform.position : Vector3.zero, Vector3.zero);
                float* b = stackalloc float[6];
                Px.fx_forma_limites(forma, b);
                var min = new Vector3(b[0], b[1], b[2]); var max = new Vector3(b[3], b[4], b[5]);
                return new Bounds((min + max) * 0.5f, max - min);
            }
        }

        public float contactOffset { get => Simulacion.offsetContacto; set { } }

        public unsafe bool Raycast(Ray ray, out RaycastHit hitInfo, float maxDistance)
        {
            hitInfo = default;
            Simulacion.Sincronizar();
            if (forma < 0) return false;
            var o = ray.origin; var d = ray.direction;
            GolpePx* g;
            if (Px.fx_forma_rayo(forma, (float*)&o, (float*)&d, maxDistance, &g) == 0) return false;
            hitInfo = Consultas.Golpe(g[0]);
            return true;
        }

        public unsafe Vector3 ClosestPoint(Vector3 position)
        {
            Simulacion.Sincronizar();
            if (forma < 0) return position;
            float* s = stackalloc float[3];
            Px.fx_forma_cercano(forma, position.x, position.y, position.z, s);
            return new Vector3(s[0], s[1], s[2]);
        }

        public Vector3 ClosestPointOnBounds(Vector3 position) => bounds.ClosestPoint(position);
    }

    public partial class BoxCollider : Collider
    {
        internal Vector3 centro, tam = Vector3.one;

        internal override void LeerForma(Mapa m, IResolutor r) { tam = Serial.V3(m.M("m_Size")); centro = Serial.V3(m.M("m_Center")); }
        internal override void CopiarForma(Collider x, Func<Object, Object> remap) { var b = (BoxCollider)x; tam = b.tam; centro = b.centro; }
        internal override Vector3 Centro => centro;

        internal override unsafe int CrearForma(int actor, Vector3 pos, Quaternion rot, Vector3 e)
        {
            float hx = Math.Abs(tam.x * e.x) * 0.5f, hy = Math.Abs(tam.y * e.y) * 0.5f, hz = Math.Abs(tam.z * e.z) * 0.5f;
            return Px.fx_caja(actor, id, (float*)&pos, (float*)&rot, hx, hy, hz, Material, Capa, Mascara, esTrigger ? 1 : 0, Simulacion.offsetContacto);
        }

        public Vector3 center { get => centro; set { centro = value; if (montado) Simulacion.Pendiente(this); } }
        public Vector3 size { get => tam; set { tam = value; if (montado) Simulacion.Pendiente(this); } }
    }

    public partial class SphereCollider : Collider
    {
        internal Vector3 centro;
        internal float radio = 0.5f;

        internal override void LeerForma(Mapa m, IResolutor r) { radio = m.F("m_Radius", 0.5f); centro = Serial.V3(m.M("m_Center")); }
        internal override void CopiarForma(Collider x, Func<Object, Object> remap) { var s = (SphereCollider)x; radio = s.radio; centro = s.centro; }
        internal override Vector3 Centro => centro;

        internal override unsafe int CrearForma(int actor, Vector3 pos, Quaternion rot, Vector3 e)
        {
            float r = Math.Abs(radio) * Math.Max(Math.Abs(e.x), Math.Max(Math.Abs(e.y), Math.Abs(e.z)));
            return Px.fx_esfera(actor, id, (float*)&pos, (float*)&rot, r, Material, Capa, Mascara, esTrigger ? 1 : 0, Simulacion.offsetContacto);
        }

        public Vector3 center { get => centro; set { centro = value; if (montado) Simulacion.Pendiente(this); } }
        public float radius { get => radio; set { radio = value; if (montado) Simulacion.Pendiente(this); } }
    }

    public partial class CapsuleCollider : Collider
    {
        internal Vector3 centro;
        internal float radio = 0.5f, alto = 2f;
        internal int direccion = 1;

        internal override void LeerForma(Mapa m, IResolutor r)
        {
            radio = m.F("m_Radius", 0.5f); alto = m.F("m_Height", 2f); direccion = m.I32("m_Direction", 1); centro = Serial.V3(m.M("m_Center"));
        }

        internal override void CopiarForma(Collider x, Func<Object, Object> remap)
        {
            var c = (CapsuleCollider)x;
            radio = c.radio; alto = c.alto; direccion = c.direccion; centro = c.centro;
        }

        internal override Vector3 Centro => centro;

        // la cápsula de PhysX va a lo largo de x
        internal override Quaternion EjeLocal => direccion == 1 ? Quaternion.Euler(0, 0, 90) : direccion == 2 ? Quaternion.Euler(0, -90, 0) : Quaternion.identity;

        internal override unsafe int CrearForma(int actor, Vector3 pos, Quaternion rot, Vector3 e)
        {
            float ex = Math.Abs(e.x), ey = Math.Abs(e.y), ez = Math.Abs(e.z);
            float escRadio = direccion == 0 ? Math.Max(ey, ez) : direccion == 1 ? Math.Max(ex, ez) : Math.Max(ex, ey);
            float escEje = direccion == 0 ? ex : direccion == 1 ? ey : ez;
            float r = Math.Abs(radio) * escRadio;
            float media = Math.Max(0f, Math.Abs(alto) * escEje * 0.5f - r);
            return Px.fx_capsula(actor, id, (float*)&pos, (float*)&rot, r, media, Material, Capa, Mascara, esTrigger ? 1 : 0, Simulacion.offsetContacto);
        }

        public Vector3 center { get => centro; set { centro = value; if (montado) Simulacion.Pendiente(this); } }
        public float radius { get => radio; set { radio = value; if (montado) Simulacion.Pendiente(this); } }
        public float height { get => alto; set { alto = value; if (montado) Simulacion.Pendiente(this); } }
        public int direction { get => direccion; set { direccion = value; if (montado) Simulacion.Pendiente(this); } }
    }

    public partial class MeshCollider : Collider
    {
        internal Mesh malla;
        internal bool convexo;
        internal int opciones = 14;

        internal override void LeerForma(Mapa m, IResolutor r)
        {
            malla = r.Resolver(m.P("m_Mesh")) as Mesh;
            convexo = m.B("m_Convex");
            opciones = m.I32("m_CookingOptions", 14);
        }

        internal override void CopiarForma(Collider x, Func<Object, Object> remap)
        {
            var c = (MeshCollider)x;
            malla = c.malla; convexo = c.convexo; opciones = c.opciones;
        }

        internal override unsafe int CrearForma(int actor, Vector3 pos, Quaternion rot, Vector3 e)
        {
            if (malla == null || malla.destruido) return -1;
            // una malla cóncava no puede ir en un cuerpo dinámico (Unity tampoco lo permite)
            if (!convexo && cuerpo != null && !cuerpo.cinematico)
            {
                Debug.LogError("Non-convex MeshCollider with non-kinematic Rigidbody is no longer supported since Unity 5.\nIf you want to use a non-convex mesh either make the Rigidbody kinematic or remove the Rigidbody component. Scene hierarchy path \"" + go.name + "\", Mesh asset path \"\" Mesh name \"" + malla.name + "\"");
                return -1;
            }
            if (convexo)
            {
                int c = Cocina.Convexo(malla);
                if (c < 0) return -1;
                return Px.fx_forma_convexo(actor, id, (float*)&pos, (float*)&rot, c, Math.Abs(e.x), Math.Abs(e.y), Math.Abs(e.z), Material, Capa, Mascara, esTrigger ? 1 : 0, Simulacion.offsetContacto);
            }
            int t = Cocina.Triangulos(malla, opciones);
            if (t < 0) return -1;
            return Px.fx_forma_malla(actor, id, (float*)&pos, (float*)&rot, t, e.x, e.y, e.z, Material, Capa, Mascara, esTrigger ? 1 : 0, Simulacion.offsetContacto);
        }

        public Mesh sharedMesh { get => malla; set { malla = value; if (montado) Simulacion.Pendiente(this); } }
        public bool convex { get => convexo; set { if (convexo == value) return; convexo = value; if (montado) Simulacion.Pendiente(this); } }
        public MeshColliderCookingOptions cookingOptions { get => (MeshColliderCookingOptions)opciones; set => opciones = (int)value; }
    }

    [Flags]
    public enum MeshColliderCookingOptions { None = 0, InflateConvexMesh = 1, CookForFasterSimulation = 2, EnableMeshCleaning = 4, WeldColocatedVertices = 8 }

    public sealed partial class TerrainCollider : Collider
    {
        internal TerrainData datos;

        internal override void LeerForma(Mapa m, IResolutor r) => datos = r.Resolver(m.P("m_TerrainData")) as TerrainData;
        internal override void CopiarForma(Collider x, Func<Object, Object> remap) => datos = ((TerrainCollider)x).datos;

        // la grilla de alturas: filas por x, columnas por z
        internal override unsafe int CrearForma(int actor, Vector3 pos, Quaternion rot, Vector3 e)
        {
            int h = Cocina.Alturas(datos);
            if (h < 0) return -1;
            var t = datos.tam;
            int res = datos.resolucion;
            if (res < 2) return -1;
            return Px.fx_forma_alturas(actor, id, (float*)&pos, h, t.y / 32766f, t.x / (res - 1), t.z / (res - 1), Material, Capa, Mascara, Simulacion.offsetContacto);
        }

        public TerrainData terrainData { get => datos; set { datos = value; if (montado) Simulacion.Pendiente(this); } }
    }

    // fricción y rebote de un colisionador (se crea en PhysX la primera vez que alguien lo usa)
    public partial class PhysicMaterial : Object
    {
        internal float dinamica = 0.6f, estatica = 0.6f, rebote;
        internal int combFriccion, combRebote;
        int idPx = -1;

        public PhysicMaterial() { m_Name = ""; }
        public PhysicMaterial(string name) { m_Name = name ?? ""; }

        internal PhysicMaterial(PhysicMaterial o)
        {
            m_Name = (o.m_Name ?? "") + " (Instance)";
            dinamica = o.dinamica; estatica = o.estatica; rebote = o.rebote; combFriccion = o.combFriccion; combRebote = o.combRebote;
        }

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            dinamica = m.F("dynamicFriction", 0.6f);
            estatica = m.F("staticFriction", 0.6f);
            rebote = m.F("bounciness");
            combFriccion = m.I32("frictionCombine");
            combRebote = m.I32("bounceCombine");
        }

        internal static int Id(PhysicMaterial m)
        {
            if (m == null || !Simulacion.Activa) return -1;
            if (m.idPx < 0) m.idPx = Px.fx_material(m.dinamica, m.estatica, m.rebote, m.combFriccion, m.combRebote);
            return m.idPx;
        }

        void Cambio() { if (idPx >= 0) Px.fx_material_cambiar(idPx, dinamica, estatica, rebote, combFriccion, combRebote); }

        public float dynamicFriction { get => dinamica; set { dinamica = value; Cambio(); } }
        public float staticFriction { get => estatica; set { estatica = value; Cambio(); } }
        public float bounciness { get => rebote; set { rebote = value; Cambio(); } }
        public PhysicMaterialCombine frictionCombine { get => (PhysicMaterialCombine)combFriccion; set { combFriccion = (int)value; Cambio(); } }
        public PhysicMaterialCombine bounceCombine { get => (PhysicMaterialCombine)combRebote; set { combRebote = (int)value; Cambio(); } }
    }

    public enum PhysicMaterialCombine { Average = 0, Multiply = 2, Minimum = 1, Maximum = 3 }
}

namespace Porteo.Fisica
{
    // La geometría cocinada para PhysX, una vez por malla (muchos colisionadores comparten la
    // misma). La versión de la malla entra en la clave: si el juego la rearma y vuelve a asignar
    // sharedMesh, se cocina de nuevo, como en Unity.
    public static unsafe class Cocina
    {
        static readonly Dictionary<(Mesh, int), (int version, int id)> triangulos = new Dictionary<(Mesh, int), (int, int)>();
        static readonly Dictionary<Mesh, (int version, int id)> convexos = new Dictionary<Mesh, (int, int)>();
        static readonly Dictionary<TerrainData, int> alturas = new Dictionary<TerrainData, int>();

        public static int Triangulos(Mesh m, int opciones)
        {
            if (triangulos.TryGetValue((m, opciones), out var c) && c.version == m.version) return c.id;
            var v = m.PosicionesFisica();
            var t = v != null ? m.TriangulosFisica(v.Length / 3) : null;
            // sin los datos todavía (no deberían faltar: la escena se trae entera antes de armarse)
            if (v == null || t == null) { Debug.LogWarning($"porteo: la malla de colisión {m.name} no tiene sus datos"); return -1; }
            int id = -1;
            if (v.Length >= 9 && t.Length >= 3)
                fixed (float* pv = v)
                fixed (uint* pt = t)
                    id = Px.fx_malla(pv, v.Length / 3, pt, t.Length / 3, opciones);
            if (id < 0) Debug.LogWarning($"porteo: no se pudo cocinar la malla de colisión {m.name}");
            triangulos[(m, opciones)] = (m.version, id);
            return id;
        }

        public static int Convexo(Mesh m)
        {
            if (convexos.TryGetValue(m, out var c) && c.version == m.version) return c.id;
            var v = m.PosicionesFisica();
            if (v == null) { Debug.LogWarning($"porteo: la malla de colisión {m.name} no tiene sus datos"); return -1; }
            int id = -1;
            if (v.Length >= 12)
                fixed (float* pv = v) id = Px.fx_convexo(pv, v.Length / 3);
            if (id < 0) Debug.LogWarning($"porteo: no se pudo cocinar el convexo {m.name}");
            convexos[m] = (m.version, id);
            return id;
        }

        public static int Alturas(TerrainData d)
        {
            if (d == null) return -1;
            if (alturas.TryGetValue(d, out var id)) return id;
            var a = d.AlturasFisica();
            id = -1;
            if (a != null && d.resolucion >= 2)
                fixed (short* p = a) id = Px.fx_alturas(p, d.resolucion, d.resolucion);
            alturas[d] = id;
            return id;
        }

        internal static void Olvidar(TerrainData d) => alturas.Remove(d);
    }
}

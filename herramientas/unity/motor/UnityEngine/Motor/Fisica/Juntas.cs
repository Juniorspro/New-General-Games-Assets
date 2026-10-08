using System;
using System.Collections.Generic;
using Porteo;
using Porteo.Datos;
using Porteo.Fisica;
using UnityEngine;
using Object = UnityEngine.Object;

namespace UnityEngine
{
    // Una junta entre el Rigidbody de su objeto y otro (o el mundo). En PhysX se arma con dos
    // marcos locales: el ancla con sus ejes en cada cuerpo. Si autoConfigureConnectedAnchor está
    // prendido, el marco del otro cuerpo se calcula para que la junta empiece sin tensión.
    public partial class Joint : Component
    {
        internal Rigidbody conectado;
        internal Vector3 ancla, anclaConectada, eje = Vector3.right, ejeSecundario = Vector3.up;
        internal bool autoConfigurar = true;
        internal float fuerzaRuptura = float.PositiveInfinity, torqueRuptura = float.PositiveInfinity;
        internal bool colisionConectados, rota;
        internal int idPx = -1;
        Rigidbody propio;

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            conectado = r.Resolver(m.P("m_ConnectedBody")) as Rigidbody;
            ancla = Serial.V3(m.M("m_Anchor"));
            anclaConectada = Serial.V3(m.M("m_ConnectedAnchor"));
            autoConfigurar = m.B("m_AutoConfigureConnectedAnchor", true);
            if (m.Tiene("m_Axis")) eje = Serial.V3(m.M("m_Axis"));
            if (m.Tiene("m_SecondaryAxis")) ejeSecundario = Serial.V3(m.M("m_SecondaryAxis"));
            if (m.Tiene("m_SwingAxis")) ejeSecundario = Serial.V3(m.M("m_SwingAxis"));
            fuerzaRuptura = m.F("m_BreakForce", float.PositiveInfinity);
            torqueRuptura = m.F("m_BreakTorque", float.PositiveInfinity);
            colisionConectados = m.B("m_EnableCollision");
            LeerJunta(m);
        }

        internal virtual void LeerJunta(Mapa m) { }

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            base.CopiarDe(o, remap);
            var x = (Joint)o;
            conectado = remap(x.conectado) as Rigidbody;
            ancla = x.ancla; anclaConectada = x.anclaConectada; eje = x.eje; ejeSecundario = x.ejeSecundario;
            autoConfigurar = x.autoConfigurar; fuerzaRuptura = x.fuerzaRuptura; torqueRuptura = x.torqueRuptura; colisionConectados = x.colisionConectados;
            CopiarJunta(x);
        }

        internal virtual void CopiarJunta(Joint x) { }

        internal override void AlActivarse() { Juntas.Alta(this); Simulacion.PendienteJunta(this); }
        internal override void AlDesactivarse() { Juntas.Baja(this); Borrar(); }
        internal override void AlDestruirse() { Juntas.Baja(this); Borrar(); }

        internal void Borrar()
        {
            Simulacion.OlvidarJunta(this);
            if (idPx < 0) return;
            if (Simulacion.Activa) Px.fx_junta_borrar(idPx);
            Simulacion.AnotarJunta(idPx, null);
            idPx = -1;
        }

        // cambió algo: se vuelve a armar
        internal void Rehacer()
        {
            Borrar();
            if (go != null && go.activoEnJerarquia && !destruido) Simulacion.PendienteJunta(this);
        }

        internal unsafe void Crear()
        {
            if (idPx >= 0 || destruido || go == null || !go.activoEnJerarquia || rota || !Simulacion.Activa) return;
            propio = go.GetComponent<Rigidbody>();
            if (propio == null || !propio.Listo()) return;
            if (conectado != null && (conectado.destruido || !conectado.Listo())) return;
            Marcos(out var pa, out var qa, out var pb, out var qb);
            int b = conectado != null ? conectado.actor : -1;
            idPx = CrearPx(propio.actor, pa, qa, b, pb, qb);
            if (idPx < 0) return;
            Simulacion.AnotarJunta(idPx, this);
            Px.fx_junta_ruptura(idPx, Limite(fuerzaRuptura), Limite(torqueRuptura));
        }

        static float Limite(float f) => float.IsInfinity(f) || f > 3.4e38f ? float.MaxValue : f;

        internal virtual unsafe int CrearPx(int a, Vector3 pa, Quaternion qa, int b, Vector3 pb, Quaternion qb)
            => Px.fx_junta_fija(a, (float*)&pa, (float*)&qa, b, (float*)&pb, (float*)&qb);

        // el marco de la junta: x = eje, y = eje secundario (ortogonalizado)
        internal Quaternion RotacionEjes()
        {
            var x = eje.sqrMagnitude > 1e-12f ? eje.normalized : Vector3.right;
            var y = ejeSecundario - Vector3.Dot(ejeSecundario, x) * x;
            if (y.sqrMagnitude < 1e-12f) y = Vector3.Cross(x, Mathf.Abs(x.y) < 0.9f ? Vector3.up : Vector3.forward);
            y.Normalize();
            var z = Vector3.Cross(x, y);
            return Quaternion.LookRotation(z, y);
        }

        // los marcos locales en cada actor (sin escala: el ancla se escala con el objeto)
        internal void Marcos(out Vector3 pa, out Quaternion qa, out Vector3 pb, out Quaternion qb)
        {
            var ta = transform;
            pa = Vector3.Scale(ancla, ta.lossyScale);
            qa = RotacionEjes();
            // el marco de a en el mundo
            var mundoP = ta.TransformPoint(ancla);
            var mundoQ = ta.rotation * qa;
            if (conectado != null)
            {
                var tb = conectado.transform;
                var inv = Quaternion.Inverse(tb.rotation);
                pb = autoConfigurar ? inv * (mundoP - tb.position) : Vector3.Scale(anclaConectada, tb.lossyScale);
                qb = inv * mundoQ;
            }
            else
            {
                pb = autoConfigurar ? mundoP : anclaConectada;
                qb = mundoQ;
            }
        }

        // ── API de Unity ──
        public Rigidbody connectedBody { get => conectado; set { conectado = value; Rehacer(); } }
        public Vector3 anchor { get => ancla; set { ancla = value; Rehacer(); } }
        public Vector3 connectedAnchor { get => anclaConectada; set { anclaConectada = value; Rehacer(); } }
        public Vector3 axis { get => eje; set { eje = value; Rehacer(); } }
        public bool autoConfigureConnectedAnchor { get => autoConfigurar; set { autoConfigurar = value; Rehacer(); } }
        public float breakForce { get => fuerzaRuptura; set { fuerzaRuptura = value; if (idPx >= 0) Px.fx_junta_ruptura(idPx, Limite(fuerzaRuptura), Limite(torqueRuptura)); } }
        public float breakTorque { get => torqueRuptura; set { torqueRuptura = value; if (idPx >= 0) Px.fx_junta_ruptura(idPx, Limite(fuerzaRuptura), Limite(torqueRuptura)); } }
        public bool enableCollision { get => colisionConectados; set => colisionConectados = value; }
        public bool enablePreprocessing { get; set; } = true;
        public float massScale { get; set; } = 1f;
        public float connectedMassScale { get; set; } = 1f;
        public Vector3 currentForce => Vector3.zero;
        public Vector3 currentTorque => Vector3.zero;
    }

    public partial class FixedJoint : Joint
    {
        // la fija mantiene la relación que tenían al crearla (sin ancla propia)
        internal override void LeerJunta(Mapa m) { ancla = Vector3.zero; autoConfigurar = true; eje = Vector3.right; ejeSecundario = Vector3.up; }
    }

    public partial class SpringJoint : Joint
    {
        internal float resorte = 2f, amortiguacion = 0.2f, min, max, tolerancia = 0.025f;
        float distanciaInicial;

        internal override void LeerJunta(Mapa m)
        {
            resorte = m.F("m_Spring", 2f); amortiguacion = m.F("m_Damper", 0.2f);
            min = m.F("m_MinDistance"); max = m.F("m_MaxDistance"); tolerancia = m.F("m_Tolerance", 0.025f);
        }

        internal override void CopiarJunta(Joint x)
        {
            var s = (SpringJoint)x;
            resorte = s.resorte; amortiguacion = s.amortiguacion; min = s.min; max = s.max; tolerancia = s.tolerancia;
        }

        // la distancia de reposo es la de las anclas al crearla, más [min, max]
        internal override unsafe int CrearPx(int a, Vector3 pa, Quaternion qa, int b, Vector3 pb, Quaternion qb)
        {
            float d = distanciaInicial = DistanciaInicial();
            return Px.fx_junta_resorte(a, (float*)&pa, b, (float*)&pb, resorte, amortiguacion, d + min, d + max, tolerancia);
        }

        // spring, damper, min, max y tolerancia cambian la junta armada, no la rehacen: rehecha, el ancla
        // conectada (autoConfigureConnectedAnchor) vuelve a caer sobre el cuerpo y el resorte no tira.
        // La aspiradora cambia spring en cada cuadro mientras acerca el ancla a la boca.
        void Parametros()
        {
            if (idPx >= 0) Px.fx_junta_resorte_parametros(idPx, resorte, amortiguacion, distanciaInicial + min, distanciaInicial + max, tolerancia);
        }

        // Unity mide min y max respecto del largo con que se creó la junta
        float DistanciaInicial()
        {
            if (autoConfigurar) return 0f;
            var pa = transform.TransformPoint(ancla);
            var pb = conectado != null ? conectado.transform.TransformPoint(anclaConectada) : anclaConectada;
            return (pa - pb).magnitude;
        }

        public float spring { get => resorte; set { resorte = value; Parametros(); } }
        public float damper { get => amortiguacion; set { amortiguacion = value; Parametros(); } }
        public float minDistance { get => min; set { min = value; Parametros(); } }
        public float maxDistance { get => max; set { max = value; Parametros(); } }
        public float tolerance { get => tolerancia; set { tolerancia = value; Parametros(); } }
    }

    public sealed partial class HingeJoint : Joint
    {
        internal override unsafe int CrearPx(int a, Vector3 pa, Quaternion qa, int b, Vector3 pb, Quaternion qb)
            => Px.fx_junta_bisagra(a, (float*)&pa, (float*)&qa, b, (float*)&pb, (float*)&qb);
    }

    // la de personaje (muñecos de trapo): giro alrededor del eje con límites, y balanceo en cono
    public sealed partial class CharacterJoint : Joint
    {
        internal float giroBajo = -20f, giroAlto = 70f, balanceo1 = 40f, balanceo2 = 40f;
        internal float resorteGiro, amortiguacionGiro, resorteBalanceo, amortiguacionBalanceo;

        internal override void LeerJunta(Mapa m)
        {
            giroBajo = m.M("m_LowTwistLimit")?.F("limit", -20f) ?? -20f;
            giroAlto = m.M("m_HighTwistLimit")?.F("limit", 70f) ?? 70f;
            balanceo1 = m.M("m_Swing1Limit")?.F("limit", 40f) ?? 40f;
            balanceo2 = m.M("m_Swing2Limit")?.F("limit", 40f) ?? 40f;
            resorteGiro = m.M("m_TwistLimitSpring")?.F("spring") ?? 0; amortiguacionGiro = m.M("m_TwistLimitSpring")?.F("damper") ?? 0;
            resorteBalanceo = m.M("m_SwingLimitSpring")?.F("spring") ?? 0; amortiguacionBalanceo = m.M("m_SwingLimitSpring")?.F("damper") ?? 0;
        }

        internal override void CopiarJunta(Joint x)
        {
            var c = (CharacterJoint)x;
            giroBajo = c.giroBajo; giroAlto = c.giroAlto; balanceo1 = c.balanceo1; balanceo2 = c.balanceo2;
            resorteGiro = c.resorteGiro; amortiguacionGiro = c.amortiguacionGiro; resorteBalanceo = c.resorteBalanceo; amortiguacionBalanceo = c.amortiguacionBalanceo;
        }

        internal override unsafe int CrearPx(int a, Vector3 pa, Quaternion qa, int b, Vector3 pb, Quaternion qb)
        {
            var movs = stackalloc int[6] { 0, 0, 0, 1, 1, 1 };
            int id = Px.fx_junta_d6(a, (float*)&pa, (float*)&qa, b, (float*)&pb, (float*)&qb, movs);
            const float g = Mathf.PI / 180f;
            if (id >= 0) Px.fx_junta_d6_limites(id, 0.001f, 0, 0, giroBajo * g, giroAlto * g, resorteGiro, amortiguacionGiro, balanceo1 * g, balanceo2 * g, resorteBalanceo, amortiguacionBalanceo);
            return id;
        }
    }

    // la configurable: cada eje bloqueado, limitado o libre (D6 de PhysX)
    public partial class ConfigurableJoint : Joint
    {
        internal int mx, my, mz, ax, ay, az;   // ConfigurableJointMotion
        internal float limiteLineal, giroBajo, giroAlto, limY, limZ;
        internal SoftJointLimitSpring resorteLineal, resorteX, resorteYZ;

        internal override void LeerJunta(Mapa m)
        {
            mx = m.I32("m_XMotion"); my = m.I32("m_YMotion"); mz = m.I32("m_ZMotion");
            ax = m.I32("m_AngularXMotion"); ay = m.I32("m_AngularYMotion"); az = m.I32("m_AngularZMotion");
            limiteLineal = m.M("m_LinearLimit")?.F("limit") ?? 0;
            giroBajo = m.M("m_LowAngularXLimit")?.F("limit") ?? 0;
            giroAlto = m.M("m_HighAngularXLimit")?.F("limit") ?? 0;
            limY = m.M("m_AngularYLimit")?.F("limit") ?? 0;
            limZ = m.M("m_AngularZLimit")?.F("limit") ?? 0;
            resorteLineal = Resorte(m.M("m_LinearLimitSpring"));
            resorteX = Resorte(m.M("m_AngularXLimitSpring"));
            resorteYZ = Resorte(m.M("m_AngularYZLimitSpring"));
        }

        static SoftJointLimitSpring Resorte(Mapa m) => new SoftJointLimitSpring { m_Spring = m?.F("spring") ?? 0, m_Damper = m?.F("damper") ?? 0 };

        internal override void CopiarJunta(Joint x)
        {
            var c = (ConfigurableJoint)x;
            mx = c.mx; my = c.my; mz = c.mz; ax = c.ax; ay = c.ay; az = c.az;
            limiteLineal = c.limiteLineal; giroBajo = c.giroBajo; giroAlto = c.giroAlto; limY = c.limY; limZ = c.limZ;
            resorteLineal = c.resorteLineal; resorteX = c.resorteX; resorteYZ = c.resorteYZ;
        }

        internal override unsafe int CrearPx(int a, Vector3 pa, Quaternion qa, int b, Vector3 pb, Quaternion qb)
        {
            var movs = stackalloc int[6] { mx, my, mz, ax, ay, az };
            int id = Px.fx_junta_d6(a, (float*)&pa, (float*)&qa, b, (float*)&pb, (float*)&qb, movs);
            const float g = Mathf.PI / 180f;
            if (id >= 0)
                Px.fx_junta_d6_limites(id, Math.Max(limiteLineal, 0.001f), resorteLineal.m_Spring, resorteLineal.m_Damper,
                    giroBajo * g, giroAlto * g, resorteX.m_Spring, resorteX.m_Damper, Math.Max(limY, 0.1f) * g, Math.Max(limZ, 0.1f) * g, resorteYZ.m_Spring, resorteYZ.m_Damper);
            return id;
        }

        public ConfigurableJointMotion xMotion { get => (ConfigurableJointMotion)mx; set { mx = (int)value; Rehacer(); } }
        public ConfigurableJointMotion yMotion { get => (ConfigurableJointMotion)my; set { my = (int)value; Rehacer(); } }
        public ConfigurableJointMotion zMotion { get => (ConfigurableJointMotion)mz; set { mz = (int)value; Rehacer(); } }
        public ConfigurableJointMotion angularXMotion { get => (ConfigurableJointMotion)ax; set { ax = (int)value; Rehacer(); } }
        public ConfigurableJointMotion angularYMotion { get => (ConfigurableJointMotion)ay; set { ay = (int)value; Rehacer(); } }
        public ConfigurableJointMotion angularZMotion { get => (ConfigurableJointMotion)az; set { az = (int)value; Rehacer(); } }
        public SoftJointLimitSpring linearLimitSpring { get => resorteLineal; set { resorteLineal = value; Rehacer(); } }
        public SoftJointLimitSpring angularXLimitSpring { get => resorteX; set { resorteX = value; Rehacer(); } }
        public SoftJointLimitSpring angularYZLimitSpring { get => resorteYZ; set { resorteYZ = value; Rehacer(); } }
        public Vector3 secondaryAxis { get => ejeSecundario; set { ejeSecundario = value; Rehacer(); } }
    }

    public partial struct SoftJointLimitSpring
    {
        public float spring { get => m_Spring; set => m_Spring = value; }
        public float damper { get => m_Damper; set => m_Damper = value; }
    }
}

namespace Porteo.Fisica
{
    // Qué juntas tocan a qué cuerpos: cuando un cuerpo aparece se arman las que lo esperaban;
    // cuando desaparece, las suyas se borran (PhysX no deja juntas con actores borrados).
    public static class Juntas
    {
        static readonly List<Joint> activas = new List<Joint>();

        internal static void Alta(Joint j) { if (!activas.Contains(j)) activas.Add(j); }
        internal static void Baja(Joint j) => activas.Remove(j);

        internal static void CuerpoCreado(Rigidbody rb)
        {
            foreach (var j in activas)
                if (j.idPx < 0 && !j.destruido && (j.conectado == rb || j.go == rb.go)) Simulacion.PendienteJunta(j);
        }

        internal static void CuerpoBorrado(Rigidbody rb)
        {
            foreach (var j in activas.ToArray())
                if (j.idPx >= 0 && (j.conectado == rb || j.go == rb.go)) { j.Borrar(); if (!j.destruido && j.go != null && j.go.activoEnJerarquia) Simulacion.PendienteJunta(j); }
        }
    }
}

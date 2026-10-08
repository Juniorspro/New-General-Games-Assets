using System;
using Porteo;
using Porteo.Datos;
using Porteo.Fisica;

namespace UnityEngine
{
    // El controlador de personaje: el de cápsula de PhysX (el mismo algoritmo que usa Unity).
    // La posición del controlador es el centro de la cápsula; el Transform se ubica restando el
    // centro. Move devuelve las CollisionFlags y manda OnControllerColliderHit por cada golpe.
    public partial class CharacterController : Collider
    {
        internal float alto = 2f, radio = 0.5f, pendiente = 45f, escalon = 0.3f, piel = 0.08f, distMin = 0.001f;
        internal Vector3 centro;
        internal int cc = -1;
        Vector3 velocidad;
        CollisionFlags banderas;
        bool moviendo;

        internal override void LeerForma(Mapa m, IResolutor r)
        {
            alto = m.F("m_Height", 2f); radio = m.F("m_Radius", 0.5f);
            pendiente = m.F("m_SlopeLimit", 45f); escalon = m.F("m_StepOffset", 0.3f);
            piel = m.F("m_SkinWidth", 0.08f); distMin = m.F("m_MinMoveDistance", 0.001f);
            centro = Serial.V3(m.M("m_Center"));
        }

        internal override void CopiarForma(Collider x, Func<Object, Object> remap)
        {
            var c = (CharacterController)x;
            alto = c.alto; radio = c.radio; pendiente = c.pendiente; escalon = c.escalon; piel = c.piel; distMin = c.distMin; centro = c.centro;
        }

        internal override Vector3 Centro => centro;

        // la cápsula escala con el objeto: el radio con lo horizontal y el alto con y
        float RadioEscalado { get { var e = transform.lossyScale; return radio * Math.Max(Math.Abs(e.x), Math.Abs(e.z)); } }
        float AltoEscalado => alto * Math.Abs(transform.lossyScale.y);
        Vector3 CentroMundo => transform.TransformPoint(centro);

        internal unsafe void CrearControlador()
        {
            BorrarControlador();
            var p = CentroMundo;
            cc = Px.fx_cc(id, (float*)&p, RadioEscalado, Math.Max(AltoEscalado, 2 * RadioEscalado), pendiente, escalon, piel, Capa, Mascara);
            if (cc < 0) return;
            int* ids = stackalloc int[2];
            Px.fx_cc_ids(cc, ids);
            forma = ids[1];
            Simulacion.AnotarForma(forma, this);
        }

        internal void BorrarControlador()
        {
            if (cc < 0) return;
            if (forma >= 0) Simulacion.AnotarForma(forma, null);
            if (Simulacion.Activa) Px.fx_cc_borrar(cc);
            cc = -1;
            forma = -1;
        }

        // el Transform se movió desde afuera: el controlador salta ahí
        internal void SincronizarPosicion()
        {
            if (cc < 0 || moviendo) return;
            var p = CentroMundo;
            Px.fx_cc_posicion(cc, p.x, p.y, p.z);
        }

        public unsafe CollisionFlags Move(Vector3 motion)
        {
            Simulacion.Sincronizar();
            if (cc < 0)
            {
                if (go != null && go.activoEnJerarquia && habilitadoCol && Simulacion.Activa) { Simulacion.Pendiente(this); Simulacion.Preparar(); }
                if (cc < 0) { transform.position += motion; return CollisionFlags.None; }
            }
            var t = transform;
            var antes = t.position;
            GolpeCcPx* golpes; int n;
            float dt = Math.Max(Time.deltaTime, 1e-5f);
            int f = Px.fx_cc_mover(cc, motion.x, motion.y, motion.z, distMin, dt, Mascara, &golpes, &n);
            // copiar los golpes antes de mandar mensajes (que pueden mover otro controlador)
            var copia = new GolpeCcPx[n];
            for (int i = 0; i < n; i++) copia[i] = golpes[i];
            float* p = stackalloc float[3];
            Px.fx_cc_posicion_leer(cc, p);
            var nuevoCentro = new Vector3(p[0], p[1], p[2]);
            moviendo = true;
            try { t.position = nuevoCentro - t.rotation * Vector3.Scale(centro, t.lossyScale); }
            finally { moviendo = false; }
            velocidad = (t.position - antes) / dt;
            banderas = (CollisionFlags)f;
            if (n > 0 && Simulacion.Escucha(go, "OnControllerColliderHit"))
                foreach (var g in copia)
                {
                    var col = Simulacion.PorForma(g.Colisionador);
                    if (col == null) continue;
                    var hit = new ControllerColliderHit
                    {
                        m_Controller = this, m_Collider = col,
                        m_Point = new Vector3(g.PX, g.PY, g.PZ), m_Normal = new Vector3(g.NX, g.NY, g.NZ),
                        m_MoveDirection = new Vector3(g.DX, g.DY, g.DZ), m_MoveLength = g.Largo,
                    };
                    Mensajes.Enviar(go, "OnControllerColliderHit", hit, true, SendMessageOptions.DontRequireReceiver);
                    if (destruido || cc < 0) break;
                }
            return banderas;
        }

        // como Unity: velocidad en el plano y gravedad acumulada por el propio controlador
        float caida;
        public bool SimpleMove(Vector3 speed)
        {
            float dt = Time.deltaTime;
            caida = isGrounded ? 0 : caida + Physics.gravity.y * dt;
            Move(new Vector3(speed.x, caida, speed.z) * dt);
            return isGrounded;
        }

        void Forma()
        {
            if (cc >= 0) Px.fx_cc_forma(cc, RadioEscalado, Math.Max(AltoEscalado, 2 * RadioEscalado), pendiente, escalon, piel);
        }

        public Vector3 velocity => velocidad;
        public bool isGrounded => (banderas & CollisionFlags.Below) != 0;
        public CollisionFlags collisionFlags => banderas;
        public float radius { get => radio; set { radio = value; Forma(); } }
        public float height { get => alto; set { alto = value; Forma(); } }
        public Vector3 center { get => centro; set { centro = value; SincronizarPosicion(); } }
        public float slopeLimit { get => pendiente; set { pendiente = value; Forma(); } }
        public float stepOffset { get => escalon; set { escalon = value; Forma(); } }
        public float skinWidth { get => piel; set { piel = value; Forma(); } }
        public float minMoveDistance { get => distMin; set => distMin = value; }
        public bool detectCollisions { get; set; } = true;
        public bool enableOverlapRecovery { get; set; } = true;
    }

    public partial class ControllerColliderHit
    {
        internal CharacterController m_Controller;
        internal Collider m_Collider;
        internal Vector3 m_Point, m_Normal, m_MoveDirection;
        internal float m_MoveLength;

        public CharacterController controller => m_Controller;
        public Collider collider => m_Collider;
        public Rigidbody rigidbody => m_Collider != null ? m_Collider.attachedRigidbody : null;
        public GameObject gameObject => m_Collider != null ? m_Collider.gameObject : null;
        public Transform transform => m_Collider != null ? m_Collider.transform : null;
        public Vector3 point => m_Point;
        public Vector3 normal => m_Normal;
        public Vector3 moveDirection => m_MoveDirection;
        public float moveLength => m_MoveLength;
    }
}

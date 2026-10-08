using System;
using System.Collections.Generic;
using Porteo;
using Porteo.Datos;
using Porteo.Fisica;

namespace UnityEngine
{
    // Un cuerpo rígido: un actor dinámico de PhysX con los colisionadores de su objeto y de sus
    // hijos como formas. La masa y la inercia salen de las formas (centro de masa automático).
    public partial class Rigidbody : Component
    {
        internal int actor = -1;
        internal readonly List<Collider> formas = new List<Collider>();
        internal float masa = 1f, arrastre, arrastreAngular = 0.05f, maxVelAngular = 7f;
        internal bool gravedad = true, cinematico;
        internal int interpolacion, restricciones, deteccion;
        Vector3 velPendiente, velAngPendiente;
        bool hayVelPendiente, hayVelAngPendiente;
        // interpolación: las dos últimas poses de la física
        Vector3 posPrev, posAct;
        Quaternion rotPrev = Quaternion.identity, rotAct = Quaternion.identity;
        bool hayPose;

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            masa = m.F("m_Mass", 1f);
            arrastre = m.F("m_Drag");
            arrastreAngular = m.F("m_AngularDrag", 0.05f);
            gravedad = m.B("m_UseGravity", true);
            cinematico = m.B("m_IsKinematic");
            interpolacion = m.I32("m_Interpolate");
            restricciones = m.I32("m_Constraints");
            deteccion = m.I32("m_CollisionDetection");
        }

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            base.CopiarDe(o, remap);
            var x = (Rigidbody)o;
            masa = x.masa; arrastre = x.arrastre; arrastreAngular = x.arrastreAngular; maxVelAngular = x.maxVelAngular;
            gravedad = x.gravedad; cinematico = x.cinematico; interpolacion = x.interpolacion; restricciones = x.restricciones; deteccion = x.deteccion;
        }

        internal bool ConCcd => !cinematico && (deteccion == 1 || deteccion == 2);

        // ── ciclo de vida ──
        internal override void AlActivarse()
        {
            Simulacion.PendienteCuerpo(this);
            // los colisionadores de abajo pasan a ser formas de este cuerpo
            Simulacion.Reubicar(transform);
        }

        internal override void AlDesactivarse() => Borrar();
        internal override void AlDestruirse() => Borrar();

        internal override void AlCambiarTransform()
        {
            if (actor >= 0) Simulacion.CuerpoSucio(this);
        }

        void Borrar()
        {
            Simulacion.OlvidarCuerpo(this);
            if (actor < 0) return;
            // primero las juntas (PhysX no deja juntas con actores borrados); las formas se van
            // con el actor y sus colisionadores buscan otro lugar
            Juntas.CuerpoBorrado(this);
            var fs = formas.ToArray();
            formas.Clear();
            Simulacion.AnotarActor(actor, null);
            if (Simulacion.Activa) Px.fx_actor_borrar(actor);
            actor = -1;
            foreach (var c in fs) c.FormaPerdida();
        }

        internal unsafe void Crear()
        {
            if (actor >= 0 || destruido || go == null || !go.activoEnJerarquia || !Simulacion.Activa) return;
            var t = transform;
            var p = t.position; var q = t.rotation;
            actor = Px.fx_actor(1, (float*)&p, (float*)&q);
            if (actor < 0) return;
            Simulacion.AnotarActor(actor, this);
            Px.fx_cuerpo_cinematico(actor, cinematico ? 1 : 0);
            Px.fx_cuerpo_gravedad(actor, gravedad ? 1 : 0);
            Px.fx_cuerpo_amortiguacion(actor, arrastre, arrastreAngular);
            Px.fx_cuerpo_bloqueos(actor, restricciones);
            Px.fx_cuerpo_ajustes(actor, maxVelAngular, Simulacion.umbralDormir, Simulacion.iteraciones, Simulacion.iteracionesVel);
            Px.fx_cuerpo_ccd(actor, deteccion);
            Px.fx_actor_en_escena(actor, 1);
            Simulacion.MasaSucia(this);
            Simulacion.Reubicar(t);
            posPrev = posAct = p; rotPrev = rotAct = q; hayPose = true;
            if (interpolacion != 0 && !Simulacion.interpolados.Contains(this)) Simulacion.interpolados.Add(this);
            Juntas.CuerpoCreado(this);
        }

        // lo que haga falta crear para poder usar el actor (desde la API)
        internal bool Listo()
        {
            if (actor < 0 && Simulacion.Activa && !destruido && go != null && go.activoEnJerarquia) Simulacion.Preparar();
            if (actor >= 0)
            {
                if (hayVelPendiente) { hayVelPendiente = false; Px.fx_cuerpo_velocidad(actor, velPendiente.x, velPendiente.y, velPendiente.z); }
                if (hayVelAngPendiente) { hayVelAngPendiente = false; Px.fx_cuerpo_velocidad_angular(actor, velAngPendiente.x, velAngPendiente.y, velAngPendiente.z); }
            }
            return actor >= 0;
        }

        internal void ActualizarMasa()
        {
            if (actor < 0) return;
            Px.fx_cuerpo_masa(actor, masa);
            if (hayVelPendiente || hayVelAngPendiente) Listo();
        }

        // el Transform cambió desde un script: el actor salta ahí
        internal unsafe void Teletransportar()
        {
            if (actor < 0 || go == null) return;
            var t = transform;
            var p = t.position; var q = t.rotation;
            Px.fx_actor_pose(actor, (float*)&p, (float*)&q);
            posPrev = posAct = p; rotPrev = rotAct = q; hayPose = true;
        }

        // la pose que dejó la simulación
        internal void PoseFisica(Vector3 p, Quaternion q)
        {
            posAct = p; rotAct = q; hayPose = true;
            if (interpolacion == 0) transform.SetPositionAndRotation(p, q);
        }

        internal void GuardarPrevia() { posPrev = posAct; rotPrev = rotAct; }

        internal void Interpolar(float a)
        {
            if (!hayPose || actor < 0 || go == null || cinematico) return;
            transform.SetPositionAndRotation(Vector3.Lerp(posPrev, posAct, a), Quaternion.Slerp(rotPrev, rotAct, a));
        }

        // ── propiedades ──
        public unsafe Vector3 velocity
        {
            get
            {
                if (!Listo()) return hayVelPendiente ? velPendiente : Vector3.zero;
                float* v = stackalloc float[6];
                Px.fx_cuerpo_velocidades(actor, v);
                return new Vector3(v[0], v[1], v[2]);
            }
            set
            {
                if (!Listo()) { velPendiente = value; hayVelPendiente = true; return; }
                Px.fx_cuerpo_velocidad(actor, value.x, value.y, value.z);
            }
        }

        public unsafe Vector3 angularVelocity
        {
            get
            {
                if (!Listo()) return hayVelAngPendiente ? velAngPendiente : Vector3.zero;
                float* v = stackalloc float[6];
                Px.fx_cuerpo_velocidades(actor, v);
                return new Vector3(v[3], v[4], v[5]);
            }
            set
            {
                if (!Listo()) { velAngPendiente = value; hayVelAngPendiente = true; return; }
                Px.fx_cuerpo_velocidad_angular(actor, value.x, value.y, value.z);
            }
        }

        public float drag
        {
            get => arrastre;
            set { arrastre = value; if (actor >= 0) Px.fx_cuerpo_amortiguacion(actor, arrastre, arrastreAngular); }
        }

        public float angularDrag
        {
            get => arrastreAngular;
            set { arrastreAngular = value; if (actor >= 0) Px.fx_cuerpo_amortiguacion(actor, arrastre, arrastreAngular); }
        }

        public float mass
        {
            get => masa;
            set { masa = Math.Max(value, 1e-7f); if (actor >= 0) Simulacion.MasaSucia(this); }
        }

        public bool useGravity
        {
            get => gravedad;
            set { gravedad = value; if (actor >= 0) Px.fx_cuerpo_gravedad(actor, value ? 1 : 0); }
        }

        public bool isKinematic
        {
            get => cinematico;
            set
            {
                if (cinematico == value) return;
                cinematico = value;
                if (actor < 0) return;
                Px.fx_cuerpo_cinematico(actor, value ? 1 : 0);
                Px.fx_cuerpo_ccd(actor, deteccion);
                // las mallas cóncavas sólo pueden ir en cinemáticos: vuelven a montarse
                foreach (var c in formas.ToArray()) if (c is MeshCollider mc && !mc.convexo) Simulacion.Pendiente(c);
                foreach (var c in formas) c.AplicarCapa();
            }
        }

        public bool freezeRotation
        {
            get => (restricciones & 112) == 112;
            set { constraints = (RigidbodyConstraints)(value ? restricciones | 112 : restricciones & ~112); }
        }

        public RigidbodyConstraints constraints
        {
            get => (RigidbodyConstraints)restricciones;
            set { restricciones = (int)value; if (actor >= 0) Px.fx_cuerpo_bloqueos(actor, restricciones); }
        }

        public CollisionDetectionMode collisionDetectionMode
        {
            get => (CollisionDetectionMode)deteccion;
            set
            {
                deteccion = (int)value;
                if (actor < 0) return;
                Px.fx_cuerpo_ccd(actor, deteccion);
                foreach (var c in formas) c.AplicarCapa();
            }
        }

        public RigidbodyInterpolation interpolation
        {
            get => (RigidbodyInterpolation)interpolacion;
            set
            {
                interpolacion = (int)value;
                if (actor < 0) return;
                if (interpolacion != 0) { if (!Simulacion.interpolados.Contains(this)) Simulacion.interpolados.Add(this); }
                else Simulacion.interpolados.Remove(this);
            }
        }

        public float maxAngularVelocity
        {
            get => maxVelAngular;
            set { maxVelAngular = value; if (actor >= 0) Px.fx_cuerpo_ajustes(actor, maxVelAngular, Simulacion.umbralDormir, Simulacion.iteraciones, Simulacion.iteracionesVel); }
        }

        public unsafe Vector3 position
        {
            get
            {
                if (!Listo()) return transform.position;
                float* p = stackalloc float[7];
                Px.fx_actor_pose_leer(actor, p);
                return new Vector3(p[0], p[1], p[2]);
            }
            set
            {
                if (!Listo()) { transform.position = value; return; }
                var q = rotation;
                Px.fx_actor_pose(actor, (float*)&value, (float*)&q);
                posPrev = posAct = value;
            }
        }

        public unsafe Quaternion rotation
        {
            get
            {
                if (!Listo()) return transform.rotation;
                float* p = stackalloc float[7];
                Px.fx_actor_pose_leer(actor, p);
                return new Quaternion(p[3], p[4], p[5], p[6]);
            }
            set
            {
                if (!Listo()) { transform.rotation = value; return; }
                var p = position;
                Px.fx_actor_pose(actor, (float*)&p, (float*)&value);
                rotPrev = rotAct = value;
            }
        }

        public unsafe Vector3 worldCenterOfMass
        {
            get
            {
                if (!Listo()) return transform.position;
                Simulacion.Sincronizar();
                float* c = stackalloc float[4];
                Px.fx_cuerpo_centro(actor, c);
                return new Vector3(c[0], c[1], c[2]);
            }
        }

        public Vector3 centerOfMass => transform.InverseTransformPoint(worldCenterOfMass);

        // ── movimiento ──
        public unsafe void MovePosition(Vector3 position)
        {
            if (!Listo()) { transform.position = position; return; }
            var q = rotation;
            if (cinematico) Px.fx_actor_objetivo(actor, (float*)&position, (float*)&q);
            else { Px.fx_actor_pose(actor, (float*)&position, (float*)&q); }
        }

        public unsafe void MoveRotation(Quaternion rot)
        {
            if (!Listo()) { transform.rotation = rot; return; }
            var p = position;
            if (cinematico) Px.fx_actor_objetivo(actor, (float*)&p, (float*)&rot);
            else Px.fx_actor_pose(actor, (float*)&p, (float*)&rot);
        }

        public void Sleep() { if (Listo()) Px.fx_cuerpo_dormir(actor, 1); }
        public void WakeUp() { if (Listo()) Px.fx_cuerpo_dormir(actor, 0); }
        public bool IsSleeping() => !Listo() || Px.fx_cuerpo_dormido(actor) != 0;

        public void AddForce(Vector3 force) => AddForce(force, ForceMode.Force);
        public void AddForce(float x, float y, float z) => AddForce(new Vector3(x, y, z), ForceMode.Force);
        public void AddForce(float x, float y, float z, ForceMode mode) => AddForce(new Vector3(x, y, z), mode);

        public void AddForce(Vector3 force, ForceMode mode)
        {
            if (!Listo() || !Valido(force)) return;
            Px.fx_cuerpo_fuerza(actor, force.x, force.y, force.z, (int)mode);
        }

        public void AddRelativeForce(Vector3 force) => AddForce(transform.TransformDirection(force), ForceMode.Force);
        public void AddRelativeForce(Vector3 force, ForceMode mode) => AddForce(transform.TransformDirection(force), mode);

        public void AddTorque(Vector3 torque) => AddTorque(torque, ForceMode.Force);
        public void AddTorque(float x, float y, float z) => AddTorque(new Vector3(x, y, z), ForceMode.Force);
        public void AddTorque(float x, float y, float z, ForceMode mode) => AddTorque(new Vector3(x, y, z), mode);

        public void AddTorque(Vector3 torque, ForceMode mode)
        {
            if (!Listo() || !Valido(torque)) return;
            Px.fx_cuerpo_torque(actor, torque.x, torque.y, torque.z, (int)mode);
        }

        public void AddRelativeTorque(Vector3 torque) => AddTorque(transform.TransformDirection(torque), ForceMode.Force);
        public void AddRelativeTorque(Vector3 torque, ForceMode mode) => AddTorque(transform.TransformDirection(torque), mode);

        public void AddForceAtPosition(Vector3 force, Vector3 position) => AddForceAtPosition(force, position, ForceMode.Force);

        public void AddForceAtPosition(Vector3 force, Vector3 position, ForceMode mode)
        {
            if (!Listo() || !Valido(force)) return;
            Px.fx_cuerpo_fuerza_en(actor, force.x, force.y, force.z, position.x, position.y, position.z, (int)mode);
        }

        public void AddExplosionForce(float explosionForce, Vector3 explosionPosition, float explosionRadius) => AddExplosionForce(explosionForce, explosionPosition, explosionRadius, 0f, ForceMode.Force);
        public void AddExplosionForce(float explosionForce, Vector3 explosionPosition, float explosionRadius, float upwardsModifier) => AddExplosionForce(explosionForce, explosionPosition, explosionRadius, upwardsModifier, ForceMode.Force);

        // como Unity: desde el punto de la explosión (bajado upwardsModifier) hacia el centro de
        // masa, con caída lineal hasta el radio
        public void AddExplosionForce(float explosionForce, Vector3 explosionPosition, float explosionRadius, float upwardsModifier, ForceMode mode)
        {
            if (!Listo()) return;
            var centro = worldCenterOfMass;
            var origen = explosionPosition;
            if (upwardsModifier != 0) origen.y -= upwardsModifier;
            var dir = centro - origen;
            float dist = (centro - explosionPosition).magnitude;
            if (explosionRadius > 0 && dist > explosionRadius) return;
            float caida = explosionRadius > 0 ? 1f - dist / explosionRadius : 1f;
            float m = dir.magnitude;
            var f = m > 1e-6f ? dir / m * (explosionForce * caida) : Vector3.up * (explosionForce * caida);
            AddForceAtPosition(f, centro, mode);
        }

        public Vector3 ClosestPointOnBounds(Vector3 position)
        {
            Simulacion.Sincronizar();
            Bounds? b = null;
            foreach (var c in formas)
            {
                var x = c.bounds;
                if (b == null) b = x; else { var y = b.Value; y.Encapsulate(x); b = y; }
            }
            return b?.ClosestPoint(position) ?? position;
        }

        public void ResetCenterOfMass() { if (actor >= 0) Simulacion.MasaSucia(this); }
        public void ResetInertiaTensor() { if (actor >= 0) Simulacion.MasaSucia(this); }
        public bool detectCollisions { get; set; } = true;
        public float sleepThreshold { get => Simulacion.umbralDormir; set { } }
        public int solverIterations { get => Simulacion.iteraciones; set { } }

        static bool Valido(Vector3 v) => !(float.IsNaN(v.x) || float.IsNaN(v.y) || float.IsNaN(v.z) || float.IsInfinity(v.x) || float.IsInfinity(v.y) || float.IsInfinity(v.z));
    }

    public enum RigidbodyInterpolation { None = 0, Interpolate = 1, Extrapolate = 2 }
}

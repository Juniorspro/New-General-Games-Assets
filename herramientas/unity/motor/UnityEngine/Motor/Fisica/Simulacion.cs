using System;
using System.Collections.Generic;
using System.Text;
using Porteo.Datos;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Porteo.Fisica
{
    // La física de la escena sobre PhysX, con las reglas de Unity:
    //  - cada Rigidbody es un actor dinámico; los colisionadores de su objeto y de sus hijos (sin
    //    otro Rigidbody más cerca) son formas de ese actor; los demás colisionadores son estáticos,
    //    cada uno con su actor;
    //  - antes de simular (y de cada consulta) se pasan a PhysX los Transform que cambiaron;
    //    después de simular se escriben en los Transform las poses de los cuerpos que se movieron
    //    (con interpolación si el cuerpo la pide);
    //  - los contactos y triggers que informa PhysX se mandan como OnCollision*/OnTrigger*.
    // Crear actores y formas se demora hasta que hace falta (simular, consultar o tocar un
    // cuerpo): al cargar una escena, los colisionadores se montan de una sola vez y ya sabiendo
    // qué cuerpos hay.
    public static unsafe class Simulacion
    {
        public static bool Activa;
        internal static readonly uint[] matriz = new uint[32];   // capas con las que choca cada capa
        internal static float offsetContacto = 0.01f, umbralDormir = 0.005f;
        internal static int iteraciones = 4, iteracionesVel = 1;
        internal static bool consultasVenTriggers;
        internal static PhysicMaterial materialDefecto;

        // ids propios de los colisionadores (los usa el filtro de PhysX para IgnoreCollision)
        static readonly List<Collider> colisionadores = new List<Collider>();
        static readonly Stack<int> idsLibres = new Stack<int>();
        // de PhysX al motor
        static Collider[] porForma = new Collider[4096];
        static Rigidbody[] porActor = new Rigidbody[4096];
        static Joint[] porJunta = new Joint[256];

        static readonly HashSet<Collider> pendientes = new HashSet<Collider>();
        static readonly HashSet<Rigidbody> cuerposPendientes = new HashSet<Rigidbody>();
        static readonly HashSet<Joint> juntasPendientes = new HashSet<Joint>();
        static readonly HashSet<Collider> posesSucias = new HashSet<Collider>();
        static readonly HashSet<Rigidbody> cuerposSucios = new HashSet<Rigidbody>();
        static readonly HashSet<Rigidbody> masasSucias = new HashSet<Rigidbody>();
        internal static readonly List<Rigidbody> interpolados = new List<Rigidbody>();
        internal static bool escribiendo;

        public static void Iniciar()
        {
            var m = Ajustes.Fisica;
            var g = m != null ? Serial.V3(m.M("m_Gravity")) : new Vector3(0, -9.81f, 0);
            float rebote = m?.F("m_BounceThreshold", 2f) ?? 2f;
            umbralDormir = m?.F("m_SleepThreshold", 0.005f) ?? 0.005f;
            offsetContacto = m?.F("m_DefaultContactOffset", 0.01f) ?? 0.01f;
            iteraciones = m?.I32("m_DefaultSolverIterations", 6) ?? 6;
            iteracionesVel = m?.I32("m_DefaultSolverVelocityIterations", 1) ?? 1;
            consultasVenTriggers = m?.B("m_QueriesHitTriggers", true) ?? true;
            bool pcm = (m?.I32("m_ContactsGeneration", 1) ?? 1) == 1;
            bool parche = (m?.I32("m_FrictionType", 0) ?? 0) == 0;
            var l = m?.L("m_LayerCollisionMatrix");
            for (int i = 0; i < 32; i++) matriz[i] = l != null && i < l.Count ? (uint)Convert.ToInt64(l[i]) : 0xffffffff;
            if (m != null && m.P("m_DefaultMaterial") is PPtr pm && !pm.Nulo) materialDefecto = Cargador.Archivo("globalgamemanagers")?.Resolver(pm) as PhysicMaterial;
            try
            {
                Activa = Px.fx_iniciar(g.x, g.y, g.z, rebote, pcm ? 1 : 0, parche ? 1 : 0) == 1;
                if (Activa) Px.fx_caras_traseras(m?.B("m_QueriesHitBackfaces") == true ? 1 : 0);
            }
            catch (Exception e) when (e is DllNotFoundException || e is EntryPointNotFoundException)
            {
                Activa = false;
                Debug.LogWarning("porteo: sin física (" + e.Message + ")");
            }
            gravedad = g;
            Mundo.PasoFisica += Paso;
            Mundo.PreUpdate += Interpolar;
        }

        static Vector3 gravedad;
        internal static Vector3 Gravedad
        {
            get => gravedad;
            set { gravedad = value; if (Activa) Px.fx_gravedad(value.x, value.y, value.z); }
        }

        // ── ids ──
        internal static int IdColisionador(Collider c)
        {
            int id = idsLibres.Count > 0 ? idsLibres.Pop() : colisionadores.Count;
            if (id == colisionadores.Count) colisionadores.Add(c); else colisionadores[id] = c;
            return id;
        }

        internal static void LiberarId(int id)
        {
            if (id < 0 || id >= colisionadores.Count) return;
            colisionadores[id] = null;
            idsLibres.Push(id);
        }

        internal static Collider ColisionadorPorId(int id) => id >= 0 && id < colisionadores.Count ? colisionadores[id] : null;

        internal static Collider PorForma(int f) => f >= 0 && f < porForma.Length ? porForma[f] : null;

        internal static void AnotarForma(int f, Collider c)
        {
            if (f < 0) return;
            if (f >= porForma.Length) Array.Resize(ref porForma, Math.Max(f + 1, porForma.Length * 2));
            porForma[f] = c;
        }

        internal static void AnotarActor(int a, Rigidbody rb)
        {
            if (a < 0) return;
            if (a >= porActor.Length) Array.Resize(ref porActor, Math.Max(a + 1, porActor.Length * 2));
            porActor[a] = rb;
        }

        internal static void AnotarJunta(int j, Joint junta)
        {
            if (j < 0) return;
            if (j >= porJunta.Length) Array.Resize(ref porJunta, Math.Max(j + 1, porJunta.Length * 2));
            porJunta[j] = junta;
        }

        // ── altas y bajas (se resuelven en Preparar) ──
        internal static void Pendiente(Collider c) { pendientes.Add(c); }
        internal static void PendienteCuerpo(Rigidbody rb) { cuerposPendientes.Add(rb); }
        internal static void PendienteJunta(Joint j) { juntasPendientes.Add(j); }
        internal static void Olvidar(Collider c) { pendientes.Remove(c); posesSucias.Remove(c); }
        internal static void OlvidarCuerpo(Rigidbody rb) { cuerposPendientes.Remove(rb); cuerposSucios.Remove(rb); masasSucias.Remove(rb); interpolados.Remove(rb); }
        internal static void OlvidarJunta(Joint j) => juntasPendientes.Remove(j);
        internal static void PoseSucia(Collider c) { if (!escribiendo) posesSucias.Add(c); }
        internal static void CuerpoSucio(Rigidbody rb) { if (!escribiendo) cuerposSucios.Add(rb); }
        internal static void MasaSucia(Rigidbody rb) => masasSucias.Add(rb);

        // todos los colisionadores de la jerarquía de t vuelven a ubicarse (cambió quién es su cuerpo)
        internal static void Reubicar(Transform t)
        {
            if (t?.go == null) return;
            foreach (var c in t.go.componentes) if (c is Collider col && col.montado) pendientes.Add(col);
            for (int i = 0; i < t.hijos.Count; i++) Reubicar(t.hijos[i]);
        }

        // crea lo pendiente: primero los cuerpos, después las formas, al final las juntas
        internal static void Preparar()
        {
            if (cuerposPendientes.Count > 0)
            {
                var l = new List<Rigidbody>(cuerposPendientes);
                cuerposPendientes.Clear();
                foreach (var rb in l) rb.Crear();
            }
            if (pendientes.Count > 0)
            {
                var l = new List<Collider>(pendientes);
                pendientes.Clear();
                foreach (var c in l) c.Montar();
            }
            if (juntasPendientes.Count > 0)
            {
                var l = new List<Joint>(juntasPendientes);
                juntasPendientes.Clear();
                foreach (var j in l) j.Crear();
            }
        }

        // Physics.SyncTransforms: los Transform que cambiaron pasan a PhysX
        public static void Sincronizar()
        {
            if (!Activa) return;
            Preparar();
            if (cuerposSucios.Count > 0)
            {
                foreach (var rb in cuerposSucios) rb.Teletransportar();
                cuerposSucios.Clear();
            }
            if (posesSucias.Count > 0)
            {
                var l = new List<Collider>(posesSucias);
                posesSucias.Clear();
                foreach (var c in l) c.ActualizarPose();
                Preparar();
            }
            if (masasSucias.Count > 0)
            {
                foreach (var rb in masasSucias) rb.ActualizarMasa();
                masasSucias.Clear();
            }
        }

        // ── el paso ──
        static int[] idsActivos = new int[1024];
        static float[] posesActivas = new float[1024 * 7];

        static void Paso(float dt)
        {
            if (!Activa) return;
            Sincronizar();
            foreach (var rb in interpolados) rb.GuardarPrevia();
            Px.fx_simular(dt);
            EscribirPoses();
            LeerAvisos();
            Despachar();
        }

        static void EscribirPoses()
        {
            int n;
            while (true)
            {
                fixed (int* ids = idsActivos)
                fixed (float* ps = posesActivas)
                    n = Px.fx_activos(ids, ps, idsActivos.Length);
                if (n < idsActivos.Length) break;
                idsActivos = new int[idsActivos.Length * 2];
                posesActivas = new float[idsActivos.Length * 7];
            }
            escribiendo = true;
            try
            {
                for (int i = 0; i < n; i++)
                {
                    int a = idsActivos[i];
                    var rb = a >= 0 && a < porActor.Length ? porActor[a] : null;
                    if (rb == null || rb.destruido || rb.go == null) continue;
                    int k = i * 7;
                    var p = new Vector3(posesActivas[k], posesActivas[k + 1], posesActivas[k + 2]);
                    var q = new Quaternion(posesActivas[k + 3], posesActivas[k + 4], posesActivas[k + 5], posesActivas[k + 6]);
                    rb.PoseFisica(p, q);
                }
            }
            finally { escribiendo = false; }
        }

        // los cuerpos con interpolación: el Transform va entre las dos últimas poses de la física
        static void Interpolar()
        {
            if (interpolados.Count == 0 || Time.dtFijo <= 0) return;
            float a = Mathf.Clamp01((Time.t - Time.tFijo) / Time.dtFijo);
            escribiendo = true;
            try
            {
                for (int i = 0; i < interpolados.Count; i++) interpolados[i].Interpolar(a);
            }
            finally { escribiendo = false; }
        }

        static readonly byte[] avisos = new byte[16384];

        static void LeerAvisos()
        {
            int n;
            fixed (byte* b = avisos) n = Px.fx_avisos_leer(b, avisos.Length);
            if (n <= 0) return;
            foreach (var linea in Encoding.UTF8.GetString(avisos, 0, n).Split('\n'))
                if (linea.Length > 0) Debug.LogWarning(linea);
        }

        // ── eventos ──
        struct Par : IEquatable<Par>
        {
            public int A, B;
            public bool Equals(Par o) => A == o.A && B == o.B;
            public override int GetHashCode() => A * 7919 + B;
        }

        // los pares en trigger: OnTriggerStay en cada paso mientras estén adentro
        static readonly Dictionary<Par, (Collider t, Collider o)> enTrigger = new Dictionary<Par, (Collider, Collider)>();
        static readonly List<Par> quitar = new List<Par>();
        static readonly HashSet<Par> nuevos = new HashSet<Par>();

        static void Despachar()
        {
            EventoPx* ev; PuntoPx* pts;
            int n = Px.fx_eventos(&ev, &pts);
            if (n > 0)
            {
                // copiar: los mensajes pueden simular o consultar y pisar el búfer
                var copia = new EventoPx[n];
                for (int i = 0; i < n; i++) copia[i] = ev[i];
                int np = 0;
                for (int i = 0; i < n; i++) np = Math.Max(np, copia[i].PrimerPunto + copia[i].NPuntos);
                var puntos = new PuntoPx[np];
                for (int i = 0; i < np; i++) puntos[i] = pts[i];
                nuevos.Clear();
                foreach (var e in copia)
                {
                    switch (e.Tipo)
                    {
                        case 1: case 2: case 3: Contacto(e, puntos); break;
                        case 4: TriggerEntra(e); break;
                        case 5: TriggerSale(e); break;
                        case 6: JuntaRota(e.A); break;
                    }
                }
            }
            else nuevos.Clear();
            // OnTriggerStay de los que ya estaban (los recién entrados recibieron Enter en este paso)
            if (enTrigger.Count > 0)
            {
                quitar.Clear();
                foreach (var kv in enTrigger)
                {
                    var (t, o) = kv.Value;
                    if (t == null || o == null || t.destruido || o.destruido || !t.montado || !o.montado) { quitar.Add(kv.Key); continue; }
                    if (nuevos.Contains(kv.Key)) continue;
                    MensajeTrigger(t, o, "OnTriggerStay");
                }
                foreach (var p in quitar) enTrigger.Remove(p);
            }
        }

        static void TriggerEntra(EventoPx e)
        {
            var t = PorForma(e.A); var o = PorForma(e.B);
            if (t == null || o == null) return;
            // Unity: hace falta algún Rigidbody (cinemático o no) entre los dos
            if (t.attachedRigidbody == null && o.attachedRigidbody == null && !(o is CharacterController) && !(t is CharacterController)) return;
            var par = new Par { A = t.id, B = o.id };
            enTrigger[par] = (t, o);
            nuevos.Add(par);
            MensajeTrigger(t, o, "OnTriggerEnter");
        }

        static void TriggerSale(EventoPx e)
        {
            var t = PorForma(e.A); var o = PorForma(e.B);
            if (t == null || o == null) return;
            var par = new Par { A = t.id, B = o.id };
            if (!enTrigger.Remove(par)) return;
            MensajeTrigger(t, o, "OnTriggerExit");
        }

        // a los dos objetos (y a sus cuerpos si son otros objetos)
        static void MensajeTrigger(Collider t, Collider o, string mensaje)
        {
            Enviar(t.go, mensaje, o);
            var rt = t.attachedRigidbody?.go;
            if (rt != null && rt != t.go) Enviar(rt, mensaje, o);
            Enviar(o.go, mensaje, t);
            var ro = o.attachedRigidbody?.go;
            if (ro != null && ro != o.go) Enviar(ro, mensaje, t);
        }

        static void Enviar(GameObject go, string mensaje, object arg)
        {
            if (go == null || go.destruido || !go.activoEnJerarquia || !Escucha(go, mensaje)) return;
            Mensajes.Enviar(go, mensaje, arg, true, SendMessageOptions.DontRequireReceiver);
        }

        // si algún script del objeto tiene ese mensaje (para no armar Collision sin necesidad)
        internal static bool Escucha(GameObject go, string mensaje)
        {
            var cs = go.componentes;
            for (int i = 0; i < cs.Count; i++)
                if (cs[i] is MonoBehaviour mb && !mb.destruido && (mb.tipoScript ??= TipoScript.De(mb.GetType())).Metodos(mensaje).Length > 0) return true;
            return false;
        }

        static void Contacto(EventoPx e, PuntoPx[] puntos)
        {
            var a = PorForma(e.A); var b = PorForma(e.B);
            if (a == null || b == null) return;
            var ra = a.attachedRigidbody; var rb = b.attachedRigidbody;
            // Unity: sólo si alguno tiene un Rigidbody que no es cinemático
            bool dinA = ra != null && !ra.cinematico, dinB = rb != null && !rb.cinematico;
            if (!dinA && !dinB && !(a is CharacterController) && !(b is CharacterController)) return;
            string mensaje = e.Tipo == 1 ? "OnCollisionEnter" : e.Tipo == 2 ? "OnCollisionStay" : "OnCollisionExit";
            var ga = ra != null ? ra.go : a.go;
            var gb = rb != null ? rb.go : b.go;
            bool escuchaA = ga != null && ga.activoEnJerarquia && Escucha(ga, mensaje);
            bool escuchaB = gb != null && gb.activoEnJerarquia && Escucha(gb, mensaje);
            if (!escuchaA && !escuchaB) return;
            var vel = new Vector3(e.VX, e.VY, e.VZ);
            var imp = new Vector3(e.IX, e.IY, e.IZ);
            if (escuchaA)
            {
                // para a: la normal apunta de b hacia a (como la da PhysX)
                var c = new Collision(b, rb, -vel, imp, Contactos(puntos, e, a, b, false));
                Mensajes.Enviar(ga, mensaje, c, true, SendMessageOptions.DontRequireReceiver);
            }
            if (escuchaB && gb != null && !gb.destruido)
            {
                var c = new Collision(a, ra, vel, -imp, Contactos(puntos, e, b, a, true));
                Mensajes.Enviar(gb, mensaje, c, true, SendMessageOptions.DontRequireReceiver);
            }
        }

        static ContactPoint[] Contactos(PuntoPx[] pts, EventoPx e, Collider este, Collider otro, bool invertir)
        {
            var r = new ContactPoint[e.NPuntos];
            float s = invertir ? -1 : 1;
            for (int i = 0; i < e.NPuntos; i++)
            {
                var p = pts[e.PrimerPunto + i];
                r[i] = new ContactPoint
                {
                    m_Point = new Vector3(p.PX, p.PY, p.PZ),
                    m_Normal = new Vector3(p.NX * s, p.NY * s, p.NZ * s),
                    m_ThisColliderInstanceID = este.GetInstanceID(),
                    m_OtherColliderInstanceID = otro.GetInstanceID(),
                    m_Separation = p.Separacion,
                };
            }
            return r;
        }

        static void JuntaRota(int id)
        {
            var j = id >= 0 && id < porJunta.Length ? porJunta[id] : null;
            if (j == null || j.destruido) return;
            j.rota = true;
            if (j.go != null && j.go.activoEnJerarquia) Mensajes.Enviar(j.go, "OnJointBreak", j.fuerzaRuptura, true, SendMessageOptions.DontRequireReceiver);
            // Unity destruye la junta rota
            if (!j.destruido) Object.Destroy(j);
        }

        // ── capas ──
        internal static uint Mascara(int capa) => matriz[capa & 31];

        internal static void IgnorarCapas(int a, int b, bool ignorar)
        {
            a &= 31; b &= 31;
            if (ignorar) { matriz[a] &= ~(1u << b); matriz[b] &= ~(1u << a); }
            else { matriz[a] |= 1u << b; matriz[b] |= 1u << a; }
            // las formas de esas capas vuelven a filtrar sus pares
            foreach (var c in colisionadores)
                if (c != null && c.forma >= 0 && c.go != null && (c.go.capa == a || c.go.capa == b)) c.AplicarCapa();
        }

        internal static void CapaCambiada(GameObject go)
        {
            foreach (var c in go.componentes) if (c is Collider col && col.forma >= 0) col.AplicarCapa();
        }

        // TerrainData.SetHeights: como en Unity, los TerrainCollider ven las alturas nuevas en seguida
        internal static void TerrenoCambiado(TerrainData d)
        {
            Cocina.Olvidar(d);
            foreach (var c in colisionadores)
                if (c is TerrainCollider tc && tc.datos == d && tc.montado) pendientes.Add(tc);
        }
    }
}

// ════════════════════════════════════════════════════════════════════════
// PoliceCheckpointManager: el corazón del puesto de control.
// Trae los autos a la fila, lleva la cuenta de lo que hizo el jugador con cada
// uno (papeles, tablet, alcoholímetro, baúl), aplica la resolución (dejar
// pasar, multar, detener el vehículo, arrestar) y la juzga contra la verdad.
// ════════════════════════════════════════════════════════════════════════
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Ruta11
{
    public enum EstadoControl { EsperandoVehiculo, VehiculoLlegando, Inspeccion, Saliendo, TurnoTerminado }

    [Serializable]
    public class RegistroCaso
    {
        public string patente, nombre;
        public Resolucion decision, correcta;
        public int puntos;
        public string detalle;
    }

    public class PoliceCheckpointManager : MonoBehaviour
    {
        public static PoliceCheckpointManager Instancia { get; private set; }

        [Header("Puntos de la escena")]
        public Transform puntoAparicion;       // lejos, sobre la ruta
        public Transform lineaDeParada;        // los conos
        public Transform salida;               // por donde se van
        public Transform playaSecuestro;       // donde quedan los vehículos retenidos
        public Transform puntoPatrullero;      // de donde viene el patrullero
        public ZonaDetenidos zonaDetenidos;
        public Transform jugador;
        public Alcoholimetro alcoholimetro;
        public Light sol;
        public Material materialBase;

        [Header("Turno")]
        public int vehiculosPorTurno = 12;
        public float horaInicio = 17f, horaFin = 1f + 24f;
        public float minutosRealesPorTurno = 18f;
        public int semilla = 0;                 // 0 = distinta cada vez
        public float distanciaInteraccion = 3f;

        [Header("Estado (solo lectura)")]
        public EstadoControl estado = EstadoControl.EsperandoVehiculo;
        public int reputacion = 100;
        public int procesados;
        public float hora;
        public readonly List<RegistroCaso> casos = new List<RegistroCaso>();

        // El caso que se está atendiendo.
        public VehiculoNPC VehiculoActual { get; private set; }
        public DriverAI ConductorActual { get; private set; }
        public PerfilConductor PerfilActual => ConductorActual ? ConductorActual.perfil : null;
        public bool PidioPapeles { get; private set; }
        public float? ResultadoAlcohol { get; private set; }
        public readonly List<ObjetoBaul> hallazgos = new List<ObjetoBaul>();
        public readonly RegistroPolicial registro = new RegistroPolicial();
        public DateTime Hoy { get; private set; }

        // Eventos para la UI.
        public event Action<string> AlMensaje;
        public event Action<int, int> AlCambiarReputacion;              // (total, cambio)
        public event Action<PerfilConductor> AlLlegarConductor;
        public event Action<PerfilConductor, VehiculoNPC> AlPedirPapeles;
        public event Action<List<ObjetoBaul>, bool> AlInspeccionarBaul;  // (lo que se ve, hay algo ilegal)
        public event Action<PerfilConductor, List<Falta>, int> AlEmitirMulta;
        public event Action<RegistroCaso> AlCerrarCaso;
        public event Action<List<RegistroCaso>, int> AlTerminarTurno;

        System.Random azar;
        readonly Queue<VehiculoNPC> cola = new Queue<VehiculoNPC>();
        readonly List<DriverAI> arrestadosPendientes = new List<DriverAI>();
        readonly Dictionary<DriverAI, Resolucion> decisiones = new Dictionary<DriverAI, Resolucion>();
        int generados;
        bool patrulleroEnCamino;

        void Awake() { Instancia = this; }

        void Start()
        {
            azar = new System.Random(semilla == 0 ? Environment.TickCount : semilla);
            Hoy = new DateTime(2026, 9, 26);
            hora = horaInicio;
            // Gente del sistema que no pasa por el control (para que la tablet tenga más de lo justo).
            for (int i = 0; i < 40; i++) GeneradorConductores.Generar(azar, Hoy, registro);
            StartCoroutine(TraerVehiculos());
            Avisar("Comienza el turno en el control de la Ruta 11. Parás a cada vehículo en los conos.");
        }

        void Update()
        {
            if (estado == EstadoControl.TurnoTerminado) return;
            hora += (horaFin - horaInicio) / (minutosRealesPorTurno * 60f) * Time.deltaTime;
            ActualizarLuz();
            if (hora >= horaFin && ConductorActual == null) TerminarTurno();
        }

        // Atardecer → noche: el sol baja y los autos prenden las luces.
        void ActualizarLuz()
        {
            if (sol == null) return;
            float h = hora % 24f;
            float altura = Mathf.Sin((h - 6f) / 12f * Mathf.PI); // 1 al mediodía, 0 a las 18, negativo de noche
            sol.transform.rotation = Quaternion.Euler(Mathf.Lerp(-10f, 60f, Mathf.Clamp01(altura)), 250f, 0);
            sol.intensity = Mathf.Clamp01(altura * 1.4f + 0.1f) * 1.2f;
            sol.color = Color.Lerp(new Color(1f, 0.55f, 0.35f), new Color(1f, 0.96f, 0.88f), Mathf.Clamp01(altura * 2f));
            RenderSettings.ambientIntensity = Mathf.Lerp(0.25f, 1f, Mathf.Clamp01(altura * 2f + 0.2f));
        }
        public bool EsDeNoche => (hora % 24f) >= 19.3f || (hora % 24f) < 6.5f;

        // ── la fila de autos ──
        IEnumerator TraerVehiculos()
        {
            while (estado != EstadoControl.TurnoTerminado)
            {
                if (generados < vehiculosPorTurno && cola.Count < 2 && hora < horaFin)
                {
                    var perfil = GeneradorConductores.Generar(azar, Hoy, registro);
                    var v = VehiculoNPC.Crear(perfil, materialBase);
                    v.transform.position = puntoAparicion.position;
                    v.transform.rotation = Quaternion.LookRotation(lineaDeParada.position - puntoAparicion.position);
                    v.PonerLuces(true);
                    CrearConductor(v, perfil);
                    cola.Enqueue(v); generados++;
                    AvanzarCola();
                }
                yield return new WaitForSeconds(2f + (float)azar.NextDouble() * 4f);
            }
        }
        void CrearConductor(VehiculoNPC v, PerfilConductor perfil)
        {
            var go = new GameObject("Conductor " + perfil.nombreReal);
            go.transform.SetParent(v.asientoConductor, false);
            var ai = go.AddComponent<DriverAI>();
            // Cuerpo y cabeza simples; la cara es una textura dibujada con los rasgos del perfil.
            var cuerpo = GameObject.CreatePrimitive(PrimitiveType.Capsule); cuerpo.name = "Cuerpo"; cuerpo.transform.SetParent(go.transform, false); cuerpo.transform.localScale = new Vector3(0.5f, 0.45f, 0.35f); cuerpo.transform.localPosition = new Vector3(0, 0.1f, 0);
            cuerpo.GetComponent<Renderer>().material = new Material(materialBase) { color = Color.HSVToRGB((float)azar.NextDouble(), 0.4f, 0.6f) };
            UnityEngine.Object.Destroy(cuerpo.GetComponent<Collider>());
            var cabeza = new GameObject("Cabeza").transform; cabeza.SetParent(go.transform, false); cabeza.localPosition = new Vector3(0, 0.62f, 0);
            var craneo = GameObject.CreatePrimitive(PrimitiveType.Sphere); craneo.transform.SetParent(cabeza, false); craneo.transform.localScale = Vector3.one * 0.26f;
            craneo.GetComponent<Renderer>().material = new Material(materialBase) { color = perfil.rostro.piel };
            UnityEngine.Object.Destroy(craneo.GetComponent<Collider>());
            var cara = GameObject.CreatePrimitive(PrimitiveType.Quad); cara.name = "Cara"; cara.transform.SetParent(cabeza, false); cara.transform.localPosition = new Vector3(0, 0, 0.132f); cara.transform.localScale = Vector3.one * 0.27f; cara.transform.localRotation = Quaternion.Euler(0, 180, 0);
            UnityEngine.Object.Destroy(cara.GetComponent<Collider>());
            var matCara = new Material(Shader.Find("Unlit/Transparent") ?? materialBase.shader);
            cara.GetComponent<Renderer>().material = matCara;
            ai.cuerpo = cuerpo.transform; ai.cabeza = cabeza; ai.cara = cara.GetComponent<Renderer>();
            ai.voz = go.AddComponent<AudioSource>(); ai.voz.spatialBlend = 1f; ai.voz.maxDistance = 12f;
            ai.Configurar(perfil, v, jugador, azar.Next());
            ai.AlHablar += (d, texto) => Avisar($"{NombreCorto(d.perfil.docs.dni.nombre)}: \"{texto}\"");
            // El cinturón: una banda cruzada que se ve por la ventanilla.
            var cint = GameObject.CreatePrimitive(PrimitiveType.Cube); cint.name = "Cinturon"; cint.transform.SetParent(go.transform, false); cint.transform.localPosition = new Vector3(0, 0.2f, 0.19f); cint.transform.localRotation = Quaternion.Euler(0, 0, 40); cint.transform.localScale = new Vector3(0.06f, 0.55f, 0.02f);
            cint.GetComponent<Renderer>().material = new Material(materialBase) { color = new Color(0.1f, 0.1f, 0.12f) };
            UnityEngine.Object.Destroy(cint.GetComponent<Collider>());
            v.MostrarCinturon(cint);
        }
        void AvanzarCola()
        {
            int i = 0;
            foreach (var v in cola)
            {
                if (v == null) continue;
                Vector3 atras = (puntoAparicion.position - lineaDeParada.position).normalized;
                var destino = lineaDeParada.position + atras * (i * 9f);
                if (i == 0 && ConductorActual == null)
                {
                    var veh = v;
                    estado = EstadoControl.VehiculoLlegando;
                    v.IrA(destino, () => AtenderVehiculo(veh));
                }
                else v.IrA(destino);
                i++;
            }
        }
        void AtenderVehiculo(VehiculoNPC v)
        {
            VehiculoActual = v; ConductorActual = v.GetComponentInChildren<DriverAI>();
            PidioPapeles = false; ResultadoAlcohol = null; hallazgos.Clear();
            estado = EstadoControl.Inspeccion;
            v.PonerLuces(true); // en ruta, las luces bajas van prendidas siempre: una quemada se nota de día también
            AlLlegarConductor?.Invoke(ConductorActual.perfil);
            Avisar($"Llega un {v.perfil.marcaModelo} {v.perfil.colorNombre.ToLower()}, patente {v.perfil.patente}. Acercate a la ventanilla y pedí los papeles [E].");
        }

        // ════════════════════════════════════════════════════════════════
        // Acciones del jugador
        // ════════════════════════════════════════════════════════════════
        bool Cerca(Vector3 punto) => jugador != null && Vector3.Distance(jugador.position, punto) <= distanciaInteraccion;
        bool HayCaso(bool avisar = true) { if (estado == EstadoControl.Inspeccion && ConductorActual != null) return true; if (avisar) Avisar("No hay ningún vehículo en el control."); return false; }

        // [E] Pedir papeles
        public void PedirPapeles()
        {
            if (!HayCaso()) return;
            if (!Cerca(ConductorActual.transform.position)) { Avisar("Acercate a la ventanilla del conductor."); return; }
            PidioPapeles = true;
            AlPedirPapeles?.Invoke(PerfilActual, VehiculoActual);
        }
        public string Preguntar(Pregunta q) => HayCaso() ? ConductorActual.Responder(q) : null;

        // Tablet: consultas al sistema.
        public PersonaRegistrada ConsultarPersona(string dni) => registro.BuscarPersona(dni);
        public VehiculoRegistrado ConsultarVehiculo(string patente) => registro.BuscarVehiculo(patente);

        // [B] Alcoholímetro
        public void UsarAlcoholimetro()
        {
            if (!HayCaso() || alcoholimetro == null || alcoholimetro.Midiendo) return;
            if (!Cerca(ConductorActual.transform.position)) { Avisar("Acercate al conductor para el test de alcoholemia."); return; }
            alcoholimetro.AlTerminar -= AlTerminarAlcohol; alcoholimetro.AlTerminar += AlTerminarAlcohol;
            alcoholimetro.Medir(ConductorActual);
        }
        void AlTerminarAlcohol(float r, bool positivo)
        {
            ResultadoAlcohol = r;
            Avisar(positivo ? $"POSITIVO: {r:0.00} g/l. El conductor queda DETENIDO; corresponde retener el vehículo." : $"Negativo: {r:0.00} g/l.");
        }

        // [F] Inspeccionar el baúl con la linterna
        public void InspeccionarBaul(bool linternaPrendida)
        {
            if (!HayCaso() || VehiculoActual.interiorBaul == null) return;
            if (!Cerca(VehiculoActual.PuntoBaul())) { Avisar("Andá a la parte de atrás del vehículo."); return; }
            if (!VehiculoActual.baulAbierto) { ConductorActual.Responder(Pregunta.AbrirElBaul); VehiculoActual.AbrirBaul(); return; }
            if (!linternaPrendida && EsDeNoche) { Avisar("Está oscuro: prendé la linterna."); return; }
            // Con la linterna se encuentra más fácil lo escondido.
            var vistos = VehiculoActual.Inspeccionar(azar, linternaPrendida ? 0.7f : 0.35f);
            hallazgos.Clear(); hallazgos.AddRange(vistos);
            bool ilegal = vistos.Any(o => o.ilegal);
            AlInspeccionarBaul?.Invoke(vistos, ilegal);
            if (ilegal)
            {
                var o = vistos.First(x => x.ilegal);
                Avisar($"¡Encontraste {o.nombre.ToLower()}! Arresto inmediato: esposalo [R] y llevalo a la Zona de Detenidos.");
                ConductorActual.estadoLegal = EstadoLegal.Arrestado;
            }
            else Avisar("Revisaste el baúl: " + string.Join(", ", vistos.Select(x => x.nombre.ToLower())) + ". Nada raro a la vista (podés volver a mirar).");
        }

        // ── resoluciones ──
        public void DejarPasar()
        {
            if (!HayCaso()) return;
            Cerrar(Resolucion.DejarPasar, null);
            ConductorActual.Responder(Pregunta.ADondeVa);
            Despachar(VehiculoActual, salida.position);
        }

        public void Multar(List<Falta> marcadas)
        {
            if (!HayCaso()) return;
            if (marcadas == null || marcadas.Count == 0) { Avisar("Marcá al menos una falta en la tablet."); return; }
            int monto = marcadas.Sum(Faltas.Monto);
            ConductorActual.estadoLegal = EstadoLegal.Multado;
            AlEmitirMulta?.Invoke(PerfilActual, marcadas, monto);
            Cerrar(Resolucion.Multar, marcadas);
            Despachar(VehiculoActual, salida.position);
        }

        public void DetenerVehiculo()
        {
            if (!HayCaso()) return;
            var v = VehiculoActual; var c = ConductorActual;
            Cerrar(Resolucion.DetenerVehiculo, null);
            c.Demorar(zonaDetenidos.LugarLibre());
            // Un compañero lo lleva a la playa de secuestro.
            v.IrA(playaSecuestro.position + new Vector3((float)azar.NextDouble() * 10f - 5f, 0, (float)azar.NextDouble() * 6f - 3f));
            Liberar();
        }

        // [R] Esposar
        public void Esposar()
        {
            DriverAI c = ConductorActual;
            if (c == null) { Avisar("No hay a quién esposar."); return; }
            if (!Cerca(c.transform.position) && !(VehiculoActual && Cerca(VehiculoActual.PuertaConductor()))) { Avisar("Acercate al conductor para esposarlo."); return; }
            var v = VehiculoActual;
            c.Esposar(jugador);
            decisiones[c] = Resolucion.Arrestar;
            arrestadosPendientes.Add(c);
            Avisar("Esposado. Llevalo a la Zona de Detenidos y pedí el patrullero [Q].");
            // El auto queda retenido y se libera el carril.
            v.IrA(playaSecuestro.position + new Vector3((float)azar.NextDouble() * 10f - 5f, 0, 0));
            Liberar();
        }

        // Lo llama la zona cuando entra alguien esposado.
        public void EntroAZona(DriverAI d)
        {
            if (d.modo == ModoConductor.Siguiendo) { d.QuedarseEnZona(zonaDetenidos.LugarLibre()); Avisar("El detenido quedó en la zona. Pedí el patrullero [Q]."); }
        }

        // [Q] Llamar al patrullero
        public void LlamarPatrullero()
        {
            var enZona = arrestadosPendientes.Where(d => d != null && d.modo == ModoConductor.EnZona).ToList();
            if (enZona.Count == 0) { Avisar(arrestadosPendientes.Count > 0 ? "Primero llevá al detenido a la Zona de Detenidos." : "No hay detenidos para trasladar."); return; }
            if (patrulleroEnCamino) { Avisar("El patrullero ya viene en camino."); return; }
            StartCoroutine(Patrullero(enZona));
        }
        IEnumerator Patrullero(List<DriverAI> detenidos)
        {
            patrulleroEnCamino = true;
            Avisar("Central: \"Recibido, móvil en camino al puesto\".");
            var auto = CrearPatrullero();
            auto.transform.position = puntoPatrullero.position;
            Vector3 destino = zonaDetenidos.transform.position + zonaDetenidos.transform.right * 4f;
            yield return MoverHacia(auto.transform, destino, 10f);
            foreach (var d in detenidos) { yield return d.SubirAPatrullero(auto.transform); JuzgarArresto(d); arrestadosPendientes.Remove(d); }
            yield return MoverHacia(auto.transform, puntoPatrullero.position, 12f);
            Destroy(auto);
            patrulleroEnCamino = false;
        }
        IEnumerator MoverHacia(Transform t, Vector3 destino, float vel)
        {
            while (Vector3.Distance(t.position, destino) > 0.2f)
            {
                Vector3 d = destino - t.position; d.y = 0;
                t.position += d.normalized * Mathf.Min(d.magnitude, vel * Time.deltaTime);
                if (d.sqrMagnitude > 0.01f) t.rotation = Quaternion.Slerp(t.rotation, Quaternion.LookRotation(d), Time.deltaTime * 4f);
                yield return null;
            }
        }
        GameObject CrearPatrullero()
        {
            var g = new GameObject("Patrullero");
            GameObject Caja(Vector3 p, Vector3 s, Color c) { var b = GameObject.CreatePrimitive(PrimitiveType.Cube); b.transform.SetParent(g.transform, false); b.transform.localPosition = p; b.transform.localScale = s; b.GetComponent<Renderer>().material = new Material(materialBase) { color = c }; return b; }
            Caja(new Vector3(0, 0.8f, 0), new Vector3(1.9f, 0.75f, 5.2f), Color.white);
            Caja(new Vector3(0, 1.5f, 0.6f), new Vector3(1.8f, 0.7f, 2.2f), Color.white);
            Caja(new Vector3(0, 0.95f, 0), new Vector3(1.92f, 0.12f, 5.22f), new Color(0.1f, 0.35f, 0.8f));
            var barral = Caja(new Vector3(0, 1.92f, 0.6f), new Vector3(1.2f, 0.12f, 0.3f), new Color(0.1f, 0.3f, 1f));
            var luz = new GameObject("Baliza").AddComponent<Light>(); luz.transform.SetParent(barral.transform, false); luz.color = new Color(0.2f, 0.4f, 1f); luz.range = 18; luz.intensity = 3;
            g.AddComponent<Baliza>().luz = luz;
            return g;
        }

        // ════════════════════════════════════════════════════════════════
        // Juzgar lo que hizo el jugador
        // ════════════════════════════════════════════════════════════════
        void Cerrar(Resolucion decision, List<Falta> marcadas)
        {
            var p = PerfilActual; var reales = p.FaltasReales(Hoy); var correcta = Faltas.Correcta(reales);
            int puntos; string detalle;
            if (decision == correcta)
            {
                puntos = decision == Resolucion.DejarPasar ? 25 : 50;
                detalle = "Procedimiento correcto.";
                if (decision == Resolucion.Multar)
                {
                    var leves = reales.Where(f => Faltas.GravedadDe(f) == Gravedad.Leve).ToList();
                    int bien = marcadas.Count(leves.Contains), mal = marcadas.Count(f => !leves.Contains(f));
                    puntos = 15 + bien * 15 - mal * 20;
                    detalle = mal > 0 ? "Multa con faltas que no correspondían." : bien < leves.Count ? "Te faltó anotar alguna falta." : "Multa perfecta.";
                }
            }
            else
            {
                // Lo peor es dejar pasar un delito; después, castigar a alguien en regla.
                puntos = correcta == Resolucion.Arrestar ? -80 : decision == Resolucion.DetenerVehiculo && correcta == Resolucion.DejarPasar ? -40 : -30;
                detalle = "Correspondía: " + NombreResolucion(correcta) + ". " + string.Join("; ", reales.Select(Faltas.Nombre));
            }
            SumarReputacion(puntos);
            var caso = new RegistroCaso { patente = p.patente, nombre = p.docs.dni.nombre, decision = decision, correcta = correcta, puntos = puntos, detalle = detalle };
            casos.Add(caso); procesados++;
            AlCerrarCaso?.Invoke(caso);
        }
        void JuzgarArresto(DriverAI d)
        {
            var reales = d.perfil.FaltasReales(Hoy);
            bool delito = reales.Any(f => Faltas.GravedadDe(f) == Gravedad.Delito);
            int puntos = delito ? 100 : -100; // arrestar a un inocente cuesta caro
            SumarReputacion(puntos);
            var caso = new RegistroCaso { patente = d.perfil.patente, nombre = d.perfil.docs.dni.nombre, decision = Resolucion.Arrestar, correcta = Faltas.Correcta(reales), puntos = puntos, detalle = delito ? "Arresto correcto: " + string.Join("; ", reales.Where(f => Faltas.GravedadDe(f) == Gravedad.Delito).Select(Faltas.Nombre)) : "¡Arrestaste a una persona inocente!" };
            casos.Add(caso); procesados++;
            AlCerrarCaso?.Invoke(caso);
            Avisar(caso.detalle + $" ({(puntos > 0 ? "+" : "")}{puntos})");
        }
        void SumarReputacion(int p) { reputacion += p; AlCambiarReputacion?.Invoke(reputacion, p); }

        void Despachar(VehiculoNPC v, Vector3 hacia) { v.Irse(hacia); Liberar(); }
        void Liberar()
        {
            if (cola.Count > 0 && cola.Peek() == VehiculoActual) cola.Dequeue();
            VehiculoActual = null; ConductorActual = null;
            estado = EstadoControl.EsperandoVehiculo;
            Invoke(nameof(AvanzarCola), 1.5f);
        }

        void TerminarTurno()
        {
            estado = EstadoControl.TurnoTerminado;
            foreach (var d in arrestadosPendientes) if (d != null) { SumarReputacion(-30); casos.Add(new RegistroCaso { patente = d.perfil.patente, nombre = d.perfil.docs.dni.nombre, decision = Resolucion.Arrestar, puntos = -30, detalle = "Procedimiento incompleto: no pediste el patrullero." }); }
            AlTerminarTurno?.Invoke(casos, reputacion);
        }

        public static string NombreResolucion(Resolucion r) => r == Resolucion.DejarPasar ? "dejar pasar" : r == Resolucion.Multar ? "multar" : r == Resolucion.DetenerVehiculo ? "retener el vehículo (conductor demorado)" : r == Resolucion.Arrestar ? "arrestar" : "-";
        public static string NombreCorto(string nombreDni) { var p = nombreDni.Split(','); return p.Length == 2 ? p[1].Trim().Split(' ')[0] + " " + p[0].Trim() : nombreDni; }
        void Avisar(string m) { AlMensaje?.Invoke(m); }
    }

    // La luz azul del patrullero, girando.
    public class Baliza : MonoBehaviour
    {
        public Light luz;
        void Update() { if (luz) { luz.intensity = Mathf.PingPong(Time.time * 8f, 3f); luz.color = Mathf.Repeat(Time.time, 0.6f) < 0.3f ? new Color(0.2f, 0.4f, 1f) : new Color(1f, 0.2f, 0.2f); } }
    }
}

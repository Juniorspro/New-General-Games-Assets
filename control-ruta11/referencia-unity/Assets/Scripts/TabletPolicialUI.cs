// ════════════════════════════════════════════════════════════════════════
// TabletPolicialUI: toda la interfaz, armada por código (uGUI), para que el
// proyecto ande sin prefabs. HUD, papeles, tablet del sistema, alcoholímetro,
// multa impresa, baúl, resumen del turno y controles táctiles para Android.
// ════════════════════════════════════════════════════════════════════════
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace Ruta11
{
    public class TabletPolicialUI : MonoBehaviour
    {
        public PoliceCheckpointManager gestor;
        public JugadorPolicia jugador;
        public Alcoholimetro alcoholimetro;

        // Colores de la tablet (azul policía, como las motos del puesto).
        static readonly Color Azul = new Color(0.07f, 0.29f, 0.62f), AzulOscuro = new Color(0.04f, 0.09f, 0.2f, 0.96f), Celeste = new Color(0.55f, 0.78f, 1f);
        static readonly Color Rojo = new Color(0.85f, 0.15f, 0.18f), Verde = new Color(0.15f, 0.65f, 0.3f), Papel = new Color(0.97f, 0.96f, 0.9f), Tinta = new Color(0.1f, 0.1f, 0.12f);

        Font fuente;
        Transform raiz;
        Text txtRep, txtHora, txtCasos, txtMensajes, txtAyuda;
        GameObject panelPapeles, panelTablet, panelAlcohol, panelMulta, panelBaul, panelResumen;
        readonly List<string> mensajes = new List<string>();

        void Start()
        {
            fuente = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            if (fuente == null) fuente = Resources.GetBuiltinResource<Font>("Arial.ttf");
            Construir();
            gestor.AlMensaje += Mensaje;
            gestor.AlPedirPapeles += MostrarPapeles;
            gestor.AlInspeccionarBaul += MostrarBaul;
            gestor.AlEmitirMulta += MostrarMulta;
            gestor.AlTerminarTurno += MostrarResumen;
            gestor.AlCambiarReputacion += (total, cambio) => Mensaje((cambio >= 0 ? "+" : "") + cambio + " de reputación");
            alcoholimetro.AlProgresar += ActualizarAlcohol;
            alcoholimetro.AlTerminar += (r, pos) => Invoke(nameof(CerrarAlcohol), 3f);
        }

        void Update()
        {
            txtRep.text = "REPUTACIÓN  " + gestor.reputacion;
            txtRep.color = gestor.reputacion >= 0 ? Color.white : new Color(1f, 0.5f, 0.5f);
            int h = Mathf.FloorToInt(gestor.hora % 24f), m = Mathf.FloorToInt((gestor.hora % 1f) * 60f);
            txtHora.text = $"{h:00}:{m:00}  ·  RN 11 — Pdcia. Roca";
            txtCasos.text = $"Vehículos: {gestor.procesados}/{gestor.vehiculosPorTurno}";
            txtAyuda.text = Ayuda();
            if (Input.GetKeyDown(KeyCode.Tab)) Alternar(panelTablet);
            if (Input.GetKeyDown(KeyCode.Escape)) CerrarTodo();
            jugador.UIAbierta = panelPapeles.activeSelf || panelTablet.activeSelf || panelResumen.activeSelf;
            if (jugador.UIAbierta) Cursor.lockState = CursorLockMode.None;
        }

        // Qué se puede hacer donde está parado el jugador.
        string Ayuda()
        {
            var c = gestor.ConductorActual; var v = gestor.VehiculoActual; var p = jugador.transform.position;
            if (c == null) return gestor.estado == EstadoControl.VehiculoLlegando ? "Se acerca un vehículo..." : "";
            float dConductor = Vector3.Distance(p, c.transform.position), dBaul = v ? Vector3.Distance(p, v.PuntoBaul()) : 99f;
            if (dConductor < gestor.distanciaInteraccion) return "[E] Papeles   [B] Alcoholímetro   [R] Esposar   [Tab] Tablet";
            if (dBaul < gestor.distanciaInteraccion) return v.baulAbierto ? "[F] Revisar el baúl con la linterna" : "[F] Pedir que abra el baúl";
            return "Acercate a la ventanilla del conductor";
        }

        void Mensaje(string m)
        {
            mensajes.Add(m); if (mensajes.Count > 4) mensajes.RemoveAt(0);
            txtMensajes.text = string.Join("\n", mensajes);
        }

        // ════════════════════════════════════════════════════════════════
        // Armado
        // ════════════════════════════════════════════════════════════════
        void Construir()
        {
            if (FindObjectOfType<EventSystem>() == null) { var es = new GameObject("EventSystem"); es.AddComponent<EventSystem>(); es.AddComponent<StandaloneInputModule>(); }
            var cgo = new GameObject("UI Policial"); var canvas = cgo.AddComponent<Canvas>(); canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var esc = cgo.AddComponent<CanvasScaler>(); esc.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize; esc.referenceResolution = new Vector2(1920, 1080); esc.matchWidthOrHeight = 0.5f;
            cgo.AddComponent<GraphicRaycaster>();
            raiz = cgo.transform;

            // HUD.
            var barra = Panel(raiz, "HUD", new Color(0, 0, 0, 0.45f), 0, 0.94f, 1, 1);
            txtRep = Texto(barra, "", 30, Color.white, TextAnchor.MiddleLeft, 0.01f, 0, 0.3f, 1);
            txtHora = Texto(barra, "", 28, Celeste, TextAnchor.MiddleCenter, 0.3f, 0, 0.7f, 1);
            txtCasos = Texto(barra, "", 28, Color.white, TextAnchor.MiddleRight, 0.7f, 0, 0.99f, 1);
            txtMensajes = Texto(raiz, "", 26, Color.white, TextAnchor.LowerLeft, 0.01f, 0.2f, 0.6f, 0.42f);
            txtMensajes.gameObject.AddComponent<Shadow>();
            txtAyuda = Texto(raiz, "", 30, new Color(1f, 0.92f, 0.5f), TextAnchor.MiddleCenter, 0.2f, 0.12f, 0.8f, 0.18f);
            txtAyuda.gameObject.AddComponent<Shadow>();
            var mira = Panel(raiz, "Mira", Color.white, 0.5f, 0.5f, 0.5f, 0.5f); Rect(mira).sizeDelta = new Vector2(6, 6);

            panelPapeles = ConstruirPapeles();
            panelTablet = ConstruirTablet();
            panelAlcohol = ConstruirAlcohol();
            panelMulta = Panel(raiz, "Multa", Papel, 0.36f, 0.2f, 0.64f, 0.86f); panelMulta.SetActive(false);
            panelBaul = Panel(raiz, "Baul", AzulOscuro, 0.62f, 0.45f, 0.98f, 0.9f); panelBaul.SetActive(false);
            panelResumen = Panel(raiz, "Resumen", AzulOscuro, 0.15f, 0.08f, 0.85f, 0.92f); panelResumen.SetActive(false);
            if (Application.isMobilePlatform) ConstruirTactil();
        }

        // ── Papeles: lo que se ve en persona contra lo que dicen los documentos ──
        RawImage fotoPersona, fotoDni; Text txtPersona, txtDni, txtLic, txtCed, txtSeg, txtHoy;
        GameObject ConstruirPapeles()
        {
            var p = Panel(raiz, "Papeles", AzulOscuro, 0.04f, 0.06f, 0.96f, 0.92f);
            Texto(p, "DOCUMENTACIÓN DEL CONDUCTOR", 34, Color.white, TextAnchor.MiddleLeft, 0.02f, 0.92f, 0.7f, 0.99f);
            txtHoy = Texto(p, "", 26, Celeste, TextAnchor.MiddleRight, 0.6f, 0.92f, 0.98f, 0.99f);
            var persona = Panel(p, "EnPersona", new Color(1, 1, 1, 0.06f), 0.02f, 0.18f, 0.26f, 0.9f);
            Texto(persona, "EN PERSONA", 26, Celeste, TextAnchor.UpperCenter, 0, 0.9f, 1, 0.99f);
            fotoPersona = Foto(persona, 0.12f, 0.42f, 0.88f, 0.88f);
            txtPersona = Texto(persona, "", 24, Color.white, TextAnchor.UpperLeft, 0.06f, 0.02f, 0.96f, 0.4f);
            var dni = Tarjeta(p, "DNI — REPÚBLICA ARGENTINA", 0.28f, 0.55f, 0.63f, 0.9f, new Color(0.88f, 0.93f, 0.98f));
            fotoDni = Foto(dni, 0.03f, 0.08f, 0.33f, 0.82f);
            txtDni = Texto(dni, "", 24, Tinta, TextAnchor.UpperLeft, 0.36f, 0.05f, 0.98f, 0.82f);
            txtLic = Texto(Tarjeta(p, "LICENCIA DE CONDUCIR", 0.65f, 0.55f, 0.98f, 0.9f, new Color(0.93f, 0.97f, 0.9f)), "", 24, Tinta, TextAnchor.UpperLeft, 0.04f, 0.05f, 0.96f, 0.82f);
            txtCed = Texto(Tarjeta(p, "CÉDULA VERDE (IDENTIFICACIÓN DEL VEHÍCULO)", 0.28f, 0.18f, 0.63f, 0.52f, new Color(0.82f, 0.95f, 0.84f)), "", 24, Tinta, TextAnchor.UpperLeft, 0.04f, 0.05f, 0.96f, 0.82f);
            txtSeg = Texto(Tarjeta(p, "SEGURO OBLIGATORIO", 0.65f, 0.18f, 0.98f, 0.52f, new Color(0.98f, 0.95f, 0.85f)), "", 24, Tinta, TextAnchor.UpperLeft, 0.04f, 0.05f, 0.96f, 0.82f);
            // Preguntas.
            var qs = new (string, Pregunta)[] { ("¿De dónde viene?", Pregunta.DeDondeViene), ("¿A dónde va?", Pregunta.ADondeVa), ("¿Qué lleva en el baúl?", Pregunta.QueLlevaEnElBaul), ("¿Tomó alcohol?", Pregunta.TomoAlcohol), ("Nombre completo", Pregunta.NombreCompleto) };
            for (int i = 0; i < qs.Length; i++) { var q = qs[i].Item2; Boton(p, qs[i].Item1, Azul, () => gestor.Preguntar(q), 0.02f + i * 0.13f, 0.03f, 0.14f + i * 0.13f, 0.14f); }
            Boton(p, "TABLET [Tab]", Verde, () => { panelPapeles.SetActive(false); Abrir(panelTablet); }, 0.69f, 0.03f, 0.83f, 0.14f);
            Boton(p, "CERRAR", Rojo, () => panelPapeles.SetActive(false), 0.85f, 0.03f, 0.98f, 0.14f);
            p.SetActive(false);
            return p;
        }
        void MostrarPapeles(PerfilConductor perfil, VehiculoNPC v)
        {
            var d = perfil.docs; var hoy = gestor.Hoy;
            txtHoy.text = "Hoy: " + hoy.ToString("dd/MM/yyyy");
            fotoPersona.texture = gestor.ConductorActual.cara.material.mainTexture;
            txtPersona.text = $"Vehículo: {perfil.marcaModelo}\nColor: {perfil.colorNombre}\nPatente a la vista:\n<b>{perfil.patente}</b>";
            fotoDni.texture = d.dni.Foto();
            txtDni.text = $"Apellido y nombre:\n<b>{d.dni.nombre}</b>\nDocumento: <b>{d.dni.numero}</b>\nNacimiento: {d.dni.fechaNacimiento:dd/MM/yyyy}";
            txtLic.text = d.licencia.presente ? $"Titular: <b>{d.licencia.nombre}</b>\nCategoría: <b>{d.licencia.categoria}</b>\nVence: <b>{d.licencia.fechaVencimiento:dd/MM/yyyy}</b>" : "<color=#b00>NO PRESENTA</color>";
            txtCed.text = d.cedula.presente ? $"Dominio: <b>{d.cedula.patente}</b>\nTitular: {d.cedula.titular}\nModelo: {d.cedula.marcaModelo} · {d.cedula.color}" : "<color=#b00>NO PRESENTA</color>";
            txtSeg.text = d.seguro.presente ? $"Compañía: {d.seguro.compania}\nPóliza: {d.seguro.poliza}\nVigente hasta: <b>{d.seguro.vigenciaHasta:dd/MM/yyyy}</b>" : "<color=#b00>NO PRESENTA</color>";
            campoDni.text = d.dni.numero; campoPatente.text = perfil.patente;
            Abrir(panelPapeles);
        }

        // ── Tablet del sistema policial ──
        InputField campoDni, campoPatente; RawImage fotoSistema; Text txtPersonaSis, txtVehiculoSis, bannerCaptura;
        readonly Dictionary<Falta, Toggle> casillas = new Dictionary<Falta, Toggle>();
        GameObject tabPersonas, tabVehiculos, tabMulta, tabResolver;
        GameObject ConstruirTablet()
        {
            var marco = Panel(raiz, "Tablet", new Color(0.08f, 0.08f, 0.09f, 0.98f), 0.12f, 0.08f, 0.88f, 0.92f);
            var p = Panel(marco, "Pantalla", AzulOscuro, 0.015f, 0.025f, 0.985f, 0.975f);
            var cab = Panel(p, "Cabecera", Azul, 0, 0.9f, 1, 1);
            Texto(cab, "SISTEMA POLICIAL · PUESTO RUTA NACIONAL 11", 28, Color.white, TextAnchor.MiddleLeft, 0.02f, 0, 0.8f, 1);
            Boton(cab, "✕", Rojo, () => panelTablet.SetActive(false), 0.93f, 0.1f, 0.99f, 0.9f);
            string[] tabs = { "PERSONAS", "VEHÍCULOS", "MULTA", "RESOLVER" };
            for (int i = 0; i < 4; i++) { int k = i; Boton(p, tabs[i], new Color(1, 1, 1, 0.1f), () => MostrarTab(k), 0.01f, 0.72f - i * 0.16f, 0.18f, 0.86f - i * 0.16f); }
            tabPersonas = Panel(p, "TabPersonas", new Color(0, 0, 0, 0), 0.2f, 0.02f, 0.99f, 0.88f);
            campoDni = Campo(tabPersonas, "Número de documento", 0.02f, 0.86f, 0.6f, 0.98f);
            Boton(tabPersonas, "BUSCAR", Azul, BuscarPersona, 0.62f, 0.86f, 0.8f, 0.98f);
            fotoSistema = Foto(tabPersonas, 0.02f, 0.3f, 0.3f, 0.82f);
            txtPersonaSis = Texto(tabPersonas, "Ingresá el DNI que te entregó y compará nombre y foto.", 26, Color.white, TextAnchor.UpperLeft, 0.33f, 0.3f, 0.98f, 0.82f);
            bannerCaptura = Texto(tabPersonas, "", 34, Color.white, TextAnchor.MiddleCenter, 0.02f, 0.05f, 0.98f, 0.25f);
            tabVehiculos = Panel(p, "TabVehiculos", new Color(0, 0, 0, 0), 0.2f, 0.02f, 0.99f, 0.88f);
            campoPatente = Campo(tabVehiculos, "Patente (lector automático)", 0.02f, 0.86f, 0.6f, 0.98f);
            Boton(tabVehiculos, "BUSCAR", Azul, BuscarVehiculo, 0.62f, 0.86f, 0.8f, 0.98f);
            txtVehiculoSis = Texto(tabVehiculos, "", 28, Color.white, TextAnchor.UpperLeft, 0.02f, 0.1f, 0.98f, 0.82f);
            tabMulta = Panel(p, "TabMulta", new Color(0, 0, 0, 0), 0.2f, 0.02f, 0.99f, 0.88f);
            Texto(tabMulta, "Faltas leves (se multa y sigue viaje):", 28, Celeste, TextAnchor.MiddleLeft, 0.02f, 0.88f, 0.98f, 0.98f);
            var leves = new[] { Falta.SinCinturon, Falta.LucesQuemadas, Falta.SinSeguro, Falta.LicenciaVencida };
            for (int i = 0; i < leves.Length; i++) casillas[leves[i]] = Casilla(tabMulta, Faltas.Nombre(leves[i]) + $"  (${Faltas.Monto(leves[i]):N0})", 0.04f, 0.7f - i * 0.14f, 0.96f, 0.82f - i * 0.14f);
            Boton(tabMulta, "EMITIR MULTA", new Color(0.85f, 0.55f, 0.1f), () => { gestor.Multar(casillas.Where(kv => kv.Value.isOn).Select(kv => kv.Key).ToList()); panelTablet.SetActive(false); }, 0.55f, 0.04f, 0.96f, 0.16f);
            tabResolver = Panel(p, "TabResolver", new Color(0, 0, 0, 0), 0.2f, 0.02f, 0.99f, 0.88f);
            Boton(tabResolver, "DEJAR PASAR", Verde, () => { gestor.DejarPasar(); panelTablet.SetActive(false); }, 0.03f, 0.55f, 0.48f, 0.9f);
            Boton(tabResolver, "MULTAR →", new Color(0.85f, 0.55f, 0.1f), () => MostrarTab(2), 0.52f, 0.55f, 0.97f, 0.9f);
            Boton(tabResolver, "DETENER VEHÍCULO\n(conductor demorado)", new Color(0.75f, 0.35f, 0.1f), () => { gestor.DetenerVehiculo(); panelTablet.SetActive(false); }, 0.03f, 0.12f, 0.48f, 0.47f);
            Boton(tabResolver, "ARRESTAR\n(esposar y trasladar)", Rojo, () => { panelTablet.SetActive(false); gestor.Esposar(); }, 0.52f, 0.12f, 0.97f, 0.47f);
            MostrarTab(0);
            marco.SetActive(false);
            return marco;
        }
        void MostrarTab(int k) { tabPersonas.SetActive(k == 0); tabVehiculos.SetActive(k == 1); tabMulta.SetActive(k == 2); tabResolver.SetActive(k == 3); if (k == 2) foreach (var c in casillas.Values) c.isOn = false; }
        void BuscarPersona()
        {
            var r = gestor.ConsultarPersona(campoDni.text);
            if (r == null) { fotoSistema.texture = null; txtPersonaSis.text = "<color=#f88>Sin resultados para ese documento.</color>"; bannerCaptura.text = ""; return; }
            fotoSistema.texture = r.rostro.Dibujar(128, false, true);
            txtPersonaSis.text = $"Apellido y nombre:\n<b>{r.nombre}</b>\nDNI: {r.dni}\nNacimiento: {r.nacimiento:dd/MM/yyyy}\nAntecedentes: {r.antecedentes}";
            bannerCaptura.text = r.pedidoDeCaptura ? "⚠ PEDIDO DE CAPTURA VIGENTE\n" + r.motivoCaptura : "Sin pedidos de captura";
            bannerCaptura.color = r.pedidoDeCaptura ? new Color(1f, 0.4f, 0.4f) : new Color(0.5f, 1f, 0.6f);
        }
        void BuscarVehiculo()
        {
            var r = gestor.ConsultarVehiculo(campoPatente.text);
            txtVehiculoSis.text = r == null ? "<color=#f88>Dominio no registrado.</color>" : $"Dominio: <b>{r.patente}</b>\nTitular: {r.titular}\nModelo: {r.marcaModelo}\nColor: {r.color}\n\n" + (r.pedidoDeSecuestro ? "<color=#f66><b>⚠ PEDIDO DE SECUESTRO (ROBO)</b></color>" : "<color=#8f8>Sin pedido de secuestro</color>");
        }

        // ── Alcoholímetro: la barra de 0,0 a 2,5 g/l con la marca del límite ──
        Image rellenoAlcohol; Text txtAlcohol;
        GameObject ConstruirAlcohol()
        {
            var p = Panel(raiz, "Alcoholimetro", AzulOscuro, 0.3f, 0.22f, 0.7f, 0.36f);
            Texto(p, "ALCOHOLÍMETRO", 26, Celeste, TextAnchor.MiddleLeft, 0.03f, 0.7f, 0.6f, 0.98f);
            txtAlcohol = Texto(p, "0,00 g/l", 34, Color.white, TextAnchor.MiddleRight, 0.5f, 0.66f, 0.97f, 0.98f);
            var fondo = Panel(p, "Barra", new Color(1, 1, 1, 0.15f), 0.03f, 0.15f, 0.97f, 0.55f);
            rellenoAlcohol = Panel(fondo.transform, "Relleno", Verde, 0, 0, 0, 1).GetComponent<Image>();
            var limite = Panel(fondo.transform, "Limite", Color.white, Alcoholimetro.Limite / Alcoholimetro.Maximo, -0.2f, Alcoholimetro.Limite / Alcoholimetro.Maximo, 1.2f);
            Rect(limite).sizeDelta = new Vector2(4, 0);
            p.SetActive(false);
            return p;
        }
        void ActualizarAlcohol(float valor, float avance)
        {
            panelAlcohol.SetActive(true);
            var rt = Rect(rellenoAlcohol.gameObject); rt.anchorMax = new Vector2(valor / Alcoholimetro.Maximo, 1);
            rellenoAlcohol.color = valor > Alcoholimetro.Limite ? Rojo : Verde;
            txtAlcohol.text = valor.ToString("0.00").Replace('.', ',') + " g/l" + (avance >= 1f ? (valor > Alcoholimetro.Limite ? "  POSITIVO" : "  NEGATIVO") : "");
        }
        void CerrarAlcohol() => panelAlcohol.SetActive(false);

        // ── Multa impresa ──
        void MostrarMulta(PerfilConductor p, List<Falta> faltas, int monto)
        {
            Limpiar(panelMulta.transform);
            string t = "<b>POLICÍA CAMINERA — ACTA DE INFRACCIÓN</b>\nRuta Nacional 11 · Presidencia Roca\n\n" +
                $"Conductor: {p.docs.dni.nombre}\nDNI: {p.docs.dni.numero}\nDominio: {p.patente}\n\n" + string.Join("\n", faltas.Select(f => "• " + Faltas.Nombre(f) + $"  (-{Faltas.Puntos(f)} pts)")) +
                $"\n\n<b>TOTAL: ${monto:N0}</b>\n\nFirma del agente: ____________";
            Texto(panelMulta.transform, t, 24, Tinta, TextAnchor.UpperLeft, 0.06f, 0.04f, 0.94f, 0.96f);
            Abrir(panelMulta); CancelInvoke(nameof(CerrarMulta)); Invoke(nameof(CerrarMulta), 5f);
        }
        void CerrarMulta() => panelMulta.SetActive(false);

        // ── Lo que se ve en el baúl ──
        void MostrarBaul(List<ObjetoBaul> vistos, bool ilegal)
        {
            Limpiar(panelBaul.transform);
            Texto(panelBaul.transform, "BAÚL", 28, Celeste, TextAnchor.UpperLeft, 0.05f, 0.82f, 0.95f, 0.97f);
            Texto(panelBaul.transform, string.Join("\n", vistos.Select(o => o.ilegal ? $"<color=#ff5555><b>• {o.nombre.ToUpper()}</b></color>" : "• " + o.nombre)), 26, Color.white, TextAnchor.UpperLeft, 0.05f, 0.05f, 0.95f, 0.8f);
            Abrir(panelBaul); CancelInvoke(nameof(CerrarBaul)); Invoke(nameof(CerrarBaul), 5f);
        }
        void CerrarBaul() => panelBaul.SetActive(false);

        // ── Fin del turno ──
        void MostrarResumen(List<RegistroCaso> casos, int rep)
        {
            Limpiar(panelResumen.transform);
            Texto(panelResumen.transform, "FIN DEL TURNO", 44, Color.white, TextAnchor.MiddleCenter, 0, 0.88f, 1, 0.98f);
            string lista = string.Join("\n", casos.Select(c => $"{c.patente,-10} {PoliceCheckpointManager.NombreCorto(c.nombre),-22} {PoliceCheckpointManager.NombreResolucion(c.decision),-12} {(c.puntos >= 0 ? "+" : "")}{c.puntos}   {c.detalle}"));
            Texto(panelResumen.transform, lista, 22, Color.white, TextAnchor.UpperLeft, 0.04f, 0.18f, 0.96f, 0.86f);
            string rango = rep >= 600 ? "Comisario del mes" : rep >= 300 ? "Agente ejemplar" : rep >= 0 ? "Cumplidor" : "Sumario administrativo";
            Texto(panelResumen.transform, $"Reputación final: {rep}  —  {rango}", 32, rep >= 0 ? new Color(0.6f, 1f, 0.7f) : new Color(1f, 0.5f, 0.5f), TextAnchor.MiddleCenter, 0, 0.1f, 1, 0.18f);
            Boton(panelResumen.transform, "NUEVO TURNO", Azul, () => SceneManager.LoadScene(SceneManager.GetActiveScene().buildIndex), 0.35f, 0.02f, 0.65f, 0.09f);
            Abrir(panelResumen);
        }

        // ── Controles táctiles (Android) ──
        void ConstruirTactil()
        {
            var palanca = Panel(raiz, "Palanca", new Color(1, 1, 1, 0.12f), 0.03f, 0.05f, 0.2f, 0.35f);
            palanca.AddComponent<PalancaVirtual>().alMover = v => jugador.movimientoTactil = v;
            var mirar = Panel(raiz, "ZonaMirar", new Color(0, 0, 0, 0), 0.45f, 0.2f, 1f, 0.9f);
            mirar.AddComponent<ArrastreMirada>().alArrastrar = d => jugador.miradaTactil += d;
            mirar.transform.SetAsFirstSibling();
            var acciones = new (string, UnityAction, Color)[] { ("PAPELES", jugador.PedirPapeles, Azul), ("LINTERNA", jugador.Linterna, new Color(0.8f, 0.7f, 0.2f)), ("ESPOSAS", jugador.Esposar, Rojo), ("PATRULLERO", jugador.LlamarPatrullero, new Color(0.2f, 0.3f, 0.8f)), ("ALCOHOL", jugador.Alcoholimetro, Verde), ("TABLET", () => Alternar(panelTablet), new Color(0.3f, 0.3f, 0.35f)) };
            for (int i = 0; i < acciones.Length; i++) { int col = i % 3, fila = i / 3; Boton(raiz, acciones[i].Item1, acciones[i].Item3, acciones[i].Item2, 0.7f + col * 0.1f, 0.04f + fila * 0.12f, 0.79f + col * 0.1f, 0.14f + fila * 0.12f); }
        }

        // ════════════════════════════════════════════════════════════════
        // Utilidades de uGUI
        // ════════════════════════════════════════════════════════════════
        void Abrir(GameObject p) { p.SetActive(true); p.transform.SetAsLastSibling(); }
        void Alternar(GameObject p) { if (p.activeSelf) p.SetActive(false); else Abrir(p); }
        void CerrarTodo() { foreach (var p in new[] { panelPapeles, panelTablet, panelBaul, panelMulta }) p.SetActive(false); }
        static void Limpiar(Transform t) { for (int i = t.childCount - 1; i >= 0; i--) Destroy(t.GetChild(i).gameObject); }
        static RectTransform Rect(GameObject g) => g.GetComponent<RectTransform>();
        static void Anclar(RectTransform rt, float x0, float y0, float x1, float y1) { rt.anchorMin = new Vector2(x0, y0); rt.anchorMax = new Vector2(x1, y1); rt.offsetMin = rt.offsetMax = Vector2.zero; }
        GameObject Panel(Transform padre, string nombre, Color color, float x0, float y0, float x1, float y1)
        {
            var g = new GameObject(nombre, typeof(RectTransform)); g.transform.SetParent(padre, false);
            g.AddComponent<Image>().color = color; Anclar(Rect(g), x0, y0, x1, y1); return g;
        }
        // Con un GameObject de padre devuelve el Transform (así se encadenan tarjetas y textos).
        Transform Panel(GameObject padre, string nombre, Color color, float x0, float y0, float x1, float y1) => Panel(padre.transform, nombre, color, x0, y0, x1, y1).transform;
        Transform Tarjeta(GameObject padre, string titulo, float x0, float y0, float x1, float y1, Color fondo)
        {
            var t = Panel(padre.transform, titulo, fondo, x0, y0, x1, y1).transform;
            var cab = Panel(t, "Titulo", Azul, 0, 0.84f, 1, 1).transform;
            Texto(cab, titulo, 22, Color.white, TextAnchor.MiddleCenter, 0, 0, 1, 1);
            return t;
        }
        Text Texto(Transform padre, string s, int tam, Color c, TextAnchor a, float x0, float y0, float x1, float y1)
        {
            var g = new GameObject("Texto", typeof(RectTransform)); g.transform.SetParent(padre, false);
            var t = g.AddComponent<Text>(); t.font = fuente; t.text = s; t.fontSize = tam; t.color = c; t.alignment = a; t.supportRichText = true; t.raycastTarget = false;
            t.horizontalOverflow = HorizontalWrapMode.Wrap; t.verticalOverflow = VerticalWrapMode.Truncate;
            Anclar(Rect(g), x0, y0, x1, y1); return t;
        }
        Text Texto(GameObject padre, string s, int tam, Color c, TextAnchor a, float x0, float y0, float x1, float y1) => Texto(padre.transform, s, tam, c, a, x0, y0, x1, y1);
        Button Boton(Transform padre, string s, Color fondo, UnityAction accion, float x0, float y0, float x1, float y1)
        {
            var g = Panel(padre, "Boton " + s, fondo, x0, y0, x1, y1);
            var b = g.AddComponent<Button>(); b.onClick.AddListener(accion);
            Texto(g.transform, s, 24, Color.white, TextAnchor.MiddleCenter, 0.03f, 0, 0.97f, 1);
            return b;
        }
        Button Boton(GameObject padre, string s, Color fondo, UnityAction accion, float x0, float y0, float x1, float y1) => Boton(padre.transform, s, fondo, accion, x0, y0, x1, y1);
        RawImage Foto(Transform padre, float x0, float y0, float x1, float y1)
        {
            var g = new GameObject("Foto", typeof(RectTransform)); g.transform.SetParent(padre, false);
            var r = g.AddComponent<RawImage>(); Anclar(Rect(g), x0, y0, x1, y1); return r;
        }
        RawImage Foto(GameObject padre, float x0, float y0, float x1, float y1) => Foto(padre.transform, x0, y0, x1, y1);
        InputField Campo(GameObject padre, string placeholder, float x0, float y0, float x1, float y1)
        {
            var g = Panel(padre.transform, "Campo", Color.white, x0, y0, x1, y1);
            var texto = Texto(g.transform, "", 28, Tinta, TextAnchor.MiddleLeft, 0.03f, 0, 0.97f, 1);
            var ph = Texto(g.transform, placeholder, 26, new Color(0.5f, 0.5f, 0.5f), TextAnchor.MiddleLeft, 0.03f, 0, 0.97f, 1);
            var f = g.AddComponent<InputField>(); f.textComponent = texto; f.placeholder = ph;
            return f;
        }
        Toggle Casilla(GameObject padre, string etiqueta, float x0, float y0, float x1, float y1)
        {
            var g = Panel(padre.transform, "Casilla", new Color(1, 1, 1, 0.06f), x0, y0, x1, y1);
            var caja = Panel(g.transform, "Caja", Color.white, 0.01f, 0.15f, 0.06f, 0.85f);
            var tilde = Panel(caja.transform, "Tilde", Azul, 0.18f, 0.18f, 0.82f, 0.82f);
            Texto(g.transform, etiqueta, 26, Color.white, TextAnchor.MiddleLeft, 0.08f, 0, 1, 1);
            var t = g.AddComponent<Toggle>(); t.graphic = tilde.GetComponent<Image>(); t.targetGraphic = caja.GetComponent<Image>(); t.isOn = false;
            return t;
        }
    }

    // Palanca virtual: devuelve un vector -1..1 mientras el dedo está apoyado.
    public class PalancaVirtual : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        public System.Action<Vector2> alMover;
        RectTransform rt;
        void Awake() { rt = GetComponent<RectTransform>(); }
        public void OnPointerDown(PointerEventData e) => OnDrag(e);
        public void OnDrag(PointerEventData e)
        {
            RectTransformUtility.ScreenPointToLocalPointInRectangle(rt, e.position, e.pressEventCamera, out var local);
            var v = new Vector2(local.x / (rt.rect.width * 0.5f), local.y / (rt.rect.height * 0.5f));
            alMover?.Invoke(Vector2.ClampMagnitude(v, 1f));
        }
        public void OnPointerUp(PointerEventData e) => alMover?.Invoke(Vector2.zero);
    }

    // Arrastrar el dedo en la mitad derecha para mirar.
    public class ArrastreMirada : MonoBehaviour, IDragHandler
    {
        public System.Action<Vector2> alArrastrar;
        public void OnDrag(PointerEventData e) => alArrastrar?.Invoke(e.delta);
    }
}

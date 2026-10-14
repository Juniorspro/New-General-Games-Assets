// ════════════════════════════════════════════════════════════════════════
// CONTROL POLICIAL: RUTA 11 — documentos, rostros y faltas
// Todo lo que el conductor entrega (y lo que de verdad es) vive acá.
// ════════════════════════════════════════════════════════════════════════
using System;
using System.Collections.Generic;
using UnityEngine;

namespace Ruta11
{
    // ── Los cuatro papeles que se piden en el control ──
    [Serializable]
    public class LicenciaDeConducir
    {
        public bool presente = true;
        public string numero;
        public string nombre;
        public string categoria;          // A.2.1, B.1, B.2, C.1, D.1...
        public DateTime fechaVencimiento;

        public bool Vencida(DateTime hoy) => presente && hoy.Date > fechaVencimiento.Date;
        public int DiasVencida(DateTime hoy) => presente ? Math.Max(0, (int)(hoy.Date - fechaVencimiento.Date).TotalDays) : 0;
        // La categoría tiene que servir para el vehículo (una B no maneja un camión).
        public bool Habilita(TipoVehiculo tipo)
        {
            if (!presente || string.IsNullOrEmpty(categoria)) return false;
            switch (tipo)
            {
                case TipoVehiculo.Moto: return categoria.StartsWith("A");
                case TipoVehiculo.Camion: return categoria.StartsWith("C") || categoria.StartsWith("E");
                default: return categoria.StartsWith("B") || categoria.StartsWith("C") || categoria.StartsWith("D") || categoria.StartsWith("E");
            }
        }
    }

    [Serializable]
    public class CedulaVerde
    {
        public bool presente = true;
        public string patente;
        public string titular;
        public string marcaModelo;
        public string color;
    }

    [Serializable]
    public class DNI
    {
        public string numero;              // "30.456.789"
        public string nombre;              // "GONZÁLEZ, RAMÓN ALBERTO"
        public DateTime fechaNacimiento;
        public RostroData foto;            // la cara que figura en el plástico
        [NonSerialized] public Texture2D fotoTextura;

        public Texture2D Foto(int tam = 128)
        {
            if (fotoTextura == null && foto != null) fotoTextura = foto.Dibujar(tam, false, true);
            return fotoTextura;
        }
    }

    [Serializable]
    public class Seguro
    {
        public bool presente = true;
        public string compania;
        public string poliza;
        public DateTime vigenciaHasta;
        public bool Vigente(DateTime hoy) => presente && hoy.Date <= vigenciaHasta.Date;
    }

    [Serializable]
    public class DocumentosConductor
    {
        public DNI dni;
        public LicenciaDeConducir licencia;
        public CedulaVerde cedula;
        public Seguro seguro;

        // Las comparaciones que hace el jugador en la pantalla de papeles.
        public bool PatenteCoincide(string patenteDelAuto) => cedula != null && cedula.presente && Normalizar(cedula.patente) == Normalizar(patenteDelAuto);
        public bool NombreLicenciaCoincideConDni() => licencia != null && dni != null && licencia.presente && Normalizar(licencia.nombre) == Normalizar(dni.nombre);
        public static string Normalizar(string s) => string.IsNullOrEmpty(s) ? "" : s.Replace(" ", "").Replace(".", "").ToUpperInvariant();
    }

    // ════════════════════════════════════════════════════════════════════
    // Rostro: rasgos que sirven para dibujar la cara del NPC y la foto del DNI.
    // Una identidad falsa usa una variante parecida, pero no igual.
    // ════════════════════════════════════════════════════════════════════
    [Serializable]
    public class RostroData
    {
        public Color piel, pelo, ojos;
        public int peinado;     // 0 pelado, 1 corto, 2 raya, 3 largo, 4 rulos, 5 gorra
        public int barba;       // 0 nada, 1 bigote, 2 barba corta, 3 barba larga
        public int anteojos;    // 0 no, 1 sí
        public float ancho;     // 0.8 a 1.15
        public float cejas;     // grosor
        public bool mujer;

        public static RostroData Azar(System.Random r, bool mujer)
        {
            Color[] pieles = { new Color(0.96f, 0.80f, 0.66f), new Color(0.87f, 0.68f, 0.52f), new Color(0.76f, 0.56f, 0.40f), new Color(0.58f, 0.40f, 0.28f), new Color(0.45f, 0.30f, 0.21f) };
            Color[] pelos = { new Color(0.10f, 0.08f, 0.07f), new Color(0.25f, 0.16f, 0.10f), new Color(0.45f, 0.30f, 0.16f), new Color(0.70f, 0.55f, 0.30f), new Color(0.55f, 0.55f, 0.55f), new Color(0.85f, 0.85f, 0.82f) };
            Color[] ojos = { new Color(0.25f, 0.16f, 0.10f), new Color(0.15f, 0.10f, 0.06f), new Color(0.30f, 0.45f, 0.25f), new Color(0.25f, 0.40f, 0.60f) };
            return new RostroData
            {
                mujer = mujer,
                piel = pieles[r.Next(pieles.Length)],
                pelo = pelos[r.Next(pelos.Length)],
                ojos = ojos[r.Next(ojos.Length)],
                peinado = mujer ? (r.NextDouble() < 0.7 ? 3 : 4) : r.Next(6),
                barba = mujer ? 0 : (r.NextDouble() < 0.5 ? 0 : 1 + r.Next(3)),
                anteojos = r.NextDouble() < 0.2 ? 1 : 0,
                ancho = 0.82f + (float)r.NextDouble() * 0.3f,
                cejas = 0.6f + (float)r.NextDouble() * 0.8f,
            };
        }

        // Una cara "parecida": cambia algunos rasgos según cuánto (0 = igual, 1 = otra persona).
        public RostroData Variante(System.Random r, float cuanto)
        {
            var v = (RostroData)MemberwiseClone();
            if (r.NextDouble() < cuanto) v.peinado = (peinado + 1 + r.Next(4)) % 6;
            if (!mujer && r.NextDouble() < cuanto) v.barba = (barba + 1 + r.Next(3)) % 4;
            if (r.NextDouble() < cuanto * 0.6f) v.anteojos = 1 - anteojos;
            v.ancho = Mathf.Clamp(ancho + ((float)r.NextDouble() - 0.5f) * cuanto * 0.5f, 0.8f, 1.15f);
            v.piel = Color.Lerp(piel, new Color(0.7f, 0.52f, 0.38f), cuanto * 0.5f);
            if (r.NextDouble() < cuanto * 0.5f) v.pelo = Color.Lerp(pelo, Color.gray, 0.5f);
            return v;
        }

        // 1 = la misma cara; menos de ~0.8 ya se nota que no es.
        public float SimilitudCon(RostroData o)
        {
            float s = 1f;
            if (peinado != o.peinado) s -= 0.18f;
            if (barba != o.barba) s -= 0.15f;
            if (anteojos != o.anteojos) s -= 0.08f;
            s -= Mathf.Abs(ancho - o.ancho) * 0.8f;
            s -= DistColor(piel, o.piel) * 0.6f + DistColor(pelo, o.pelo) * 0.3f;
            return Mathf.Clamp01(s);
        }
        static float DistColor(Color a, Color b) => Mathf.Abs(a.r - b.r) + Mathf.Abs(a.g - b.g) + Mathf.Abs(a.b - b.b);

        // Dibuja la cara en una textura (para la foto del DNI o para la cabeza del NPC).
        public Texture2D Dibujar(int tam, bool ojosRojos, bool esFoto)
        {
            var tex = new Texture2D(tam, tam, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
            var px = new Color[tam * tam];
            Color fondo = esFoto ? new Color(0.80f, 0.88f, 0.95f) : new Color(0, 0, 0, 0);
            float cx = tam * 0.5f, cy = tam * (esFoto ? 0.46f : 0.5f), rx = tam * 0.27f * ancho, ry = tam * 0.34f;
            Color sombraPiel = piel * 0.85f; sombraPiel.a = 1;
            for (int y = 0; y < tam; y++)
                for (int x = 0; x < tam; x++)
                {
                    float fx = x + 0.5f, fy = y + 0.5f; // y crece hacia arriba en Texture2D
                    Color c = fondo;
                    float dx = (fx - cx) / rx, dy = (fy - cy) / ry, e = dx * dx + dy * dy;
                    // Hombros en la foto carnet.
                    if (esFoto && fy < tam * 0.16f && Mathf.Abs(fx - cx) < tam * 0.42f) c = new Color(0.25f, 0.30f, 0.40f);
                    if (esFoto && fy < tam * 0.2f && fy > tam * 0.1f && Mathf.Abs(fx - cx) < tam * 0.08f) c = piel;
                    if (e <= 1f) c = Color.Lerp(piel, sombraPiel, Mathf.Clamp01((e - 0.6f) * 2f));
                    // Pelo según el peinado (la mitad de arriba de la cara).
                    float top = cy + ry * 0.55f;
                    bool enPelo = false;
                    switch (peinado)
                    {
                        case 1: enPelo = e <= 1.08f && fy > top; break;
                        case 2: enPelo = e <= 1.1f && fy > top - (fx < cx ? 0 : tam * 0.03f); break;
                        case 3: enPelo = (e <= 1.15f && fy > top) || (Mathf.Abs(dx) > 0.82f && Mathf.Abs(dx) < 1.25f && fy > cy - ry * 0.9f && fy < top + tam * 0.05f); break;
                        case 4: enPelo = e <= 1.35f && fy > top - tam * 0.02f && Mathf.PerlinNoise(fx * 0.3f, fy * 0.3f) > 0.35f; break;
                        case 5: enPelo = e <= 1.12f && fy > top + tam * 0.02f; break;
                    }
                    if (enPelo) c = peinado == 5 ? new Color(0.15f, 0.25f, 0.55f) : pelo;
                    if (peinado == 5 && fy > top - tam * 0.01f && fy < top + tam * 0.03f && fx < cx + rx * 1.5f && fx > cx - rx * 0.4f) c = new Color(0.12f, 0.2f, 0.45f);
                    // Barba y bigote.
                    if (barba == 1 && Mathf.Abs(fx - cx) < rx * 0.42f && fy > cy - ry * 0.42f && fy < cy - ry * 0.3f) c = pelo;
                    if (barba >= 2 && e <= 1f && fy < cy - ry * (barba == 3 ? 0.15f : 0.3f) && !(Mathf.Abs(fx - cx) < rx * 0.25f && fy > cy - ry * 0.55f && fy < cy - ry * 0.45f)) c = Color.Lerp(c, pelo, barba == 3 ? 0.95f : 0.7f);
                    // Ojos, cejas, nariz y boca.
                    for (int lado = -1; lado <= 1; lado += 2)
                    {
                        float ox = cx + lado * rx * 0.38f, oy = cy + ry * 0.12f;
                        float d = Mathf.Sqrt((fx - ox) * (fx - ox) + (fy - oy) * (fy - oy) * 2.2f);
                        if (d < tam * 0.045f) c = ojosRojos ? new Color(0.95f, 0.55f, 0.55f) : Color.white;
                        if (d < tam * 0.022f) c = ojos;
                        if (Mathf.Abs(fx - ox) < tam * 0.06f && Mathf.Abs(fy - (oy + tam * 0.06f)) < tam * 0.008f * cejas) c = pelo * 0.8f;
                        if (anteojos == 1 && Mathf.Abs(d - tam * 0.065f) < tam * 0.008f) c = new Color(0.1f, 0.1f, 0.1f);
                    }
                    if (anteojos == 1 && Mathf.Abs(fy - (cy + ry * 0.12f)) < tam * 0.005f && Mathf.Abs(fx - cx) < rx * 0.12f) c = new Color(0.1f, 0.1f, 0.1f);
                    if (Mathf.Abs(fx - cx) < tam * 0.015f && fy < cy + ry * 0.05f && fy > cy - ry * 0.18f) c = sombraPiel * 0.95f;
                    if (Mathf.Abs(fx - cx) < rx * 0.3f && Mathf.Abs(fy - (cy - ry * 0.36f)) < tam * 0.01f) c = new Color(0.55f, 0.25f, 0.25f);
                    if (ojosRojos && e <= 1f && Mathf.Abs(dx) > 0.35f && dy < 0 && dy > -0.3f) c = Color.Lerp(c, new Color(0.9f, 0.4f, 0.4f), 0.3f); // cachetes colorados
                    px[y * tam + x] = c;
                }
            tex.SetPixels(px);
            tex.Apply();
            return tex;
        }
    }

    // ════════════════════════════════════════════════════════════════════
    // Faltas: leves (se multa), graves (se retiene el vehículo), delitos (se arresta)
    // ════════════════════════════════════════════════════════════════════
    public enum Falta { SinCinturon, LucesQuemadas, SinSeguro, LicenciaVencida, AlcoholPositivo, LicenciaVencidaMasDeUnAnio, SinCedula, SinLicencia, PedidoDeCaptura, Drogas, Armas, IdentidadFalsa, VehiculoRobado }
    public enum Gravedad { Leve, Grave, Delito }
    public enum Resolucion { Ninguna, DejarPasar, Multar, DetenerVehiculo, Arrestar }
    public enum TipoVehiculo { Auto, Camioneta, Moto, Camion }

    public static class Faltas
    {
        public static Gravedad GravedadDe(Falta f)
        {
            switch (f)
            {
                case Falta.SinCinturon: case Falta.LucesQuemadas: case Falta.SinSeguro: case Falta.LicenciaVencida: return Gravedad.Leve;
                case Falta.AlcoholPositivo: case Falta.LicenciaVencidaMasDeUnAnio: case Falta.SinCedula: case Falta.SinLicencia: return Gravedad.Grave;
                default: return Gravedad.Delito;
            }
        }
        public static string Nombre(Falta f)
        {
            switch (f)
            {
                case Falta.SinCinturon: return "Sin cinturón de seguridad";
                case Falta.LucesQuemadas: return "Luces reglamentarias quemadas";
                case Falta.SinSeguro: return "Sin seguro obligatorio vigente";
                case Falta.LicenciaVencida: return "Licencia vencida (menos de 1 año)";
                case Falta.AlcoholPositivo: return "Alcoholemia positiva (> 0,5 g/l)";
                case Falta.LicenciaVencidaMasDeUnAnio: return "Licencia vencida hace más de 1 año";
                case Falta.SinCedula: return "Sin cédula del vehículo";
                case Falta.SinLicencia: return "Sin licencia / categoría que no habilita";
                case Falta.PedidoDeCaptura: return "Pedido de captura vigente";
                case Falta.Drogas: return "Transporte de estupefacientes";
                case Falta.Armas: return "Portación de arma sin permiso";
                case Falta.IdentidadFalsa: return "Documento de identidad adulterado";
                case Falta.VehiculoRobado: return "Vehículo con pedido de secuestro";
            }
            return f.ToString();
        }
        public static int Puntos(Falta f) => GravedadDe(f) == Gravedad.Leve ? (f == Falta.SinCinturon ? 4 : 2) : 10; // puntos de la licencia
        public static int Monto(Falta f) => f == Falta.SinCinturon ? 60000 : f == Falta.LucesQuemadas ? 35000 : f == Falta.SinSeguro ? 120000 : 45000; // en pesos, de juego

        // Qué corresponde hacer con un conjunto de faltas.
        public static Resolucion Correcta(IEnumerable<Falta> faltas)
        {
            var r = Resolucion.DejarPasar;
            foreach (var f in faltas)
            {
                var g = GravedadDe(f);
                if (g == Gravedad.Delito) return Resolucion.Arrestar;
                if (g == Gravedad.Grave) r = Resolucion.DetenerVehiculo;
                else if (r == Resolucion.DejarPasar) r = Resolucion.Multar;
            }
            return r;
        }
    }

    // ── El legajo que devuelve la tablet ──
    [Serializable]
    public class PersonaRegistrada
    {
        public string dni, nombre;
        public DateTime nacimiento;
        public RostroData rostro;
        public bool pedidoDeCaptura;
        public string motivoCaptura, antecedentes;
    }
    [Serializable]
    public class VehiculoRegistrado
    {
        public string patente, titular, marcaModelo, color;
        public bool pedidoDeSecuestro;
    }

    // Base de datos del sistema policial (la que consulta la tablet).
    public class RegistroPolicial
    {
        readonly Dictionary<string, PersonaRegistrada> personas = new Dictionary<string, PersonaRegistrada>();
        readonly Dictionary<string, VehiculoRegistrado> vehiculos = new Dictionary<string, VehiculoRegistrado>();
        public void Agregar(PersonaRegistrada p) { personas[DocumentosConductor.Normalizar(p.dni)] = p; }
        public void Agregar(VehiculoRegistrado v) { vehiculos[DocumentosConductor.Normalizar(v.patente)] = v; }
        public PersonaRegistrada BuscarPersona(string dni) { personas.TryGetValue(DocumentosConductor.Normalizar(dni), out var p); return p; }
        public VehiculoRegistrado BuscarVehiculo(string patente) { vehiculos.TryGetValue(DocumentosConductor.Normalizar(patente), out var v); return v; }
        public IEnumerable<PersonaRegistrada> Personas => personas.Values;
    }
}

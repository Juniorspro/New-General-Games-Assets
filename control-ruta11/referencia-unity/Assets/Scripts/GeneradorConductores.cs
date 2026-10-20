// ════════════════════════════════════════════════════════════════════════
// Quién viene en cada auto: la verdad (lo que el jugador tiene que descubrir)
// y los papeles que entrega (que pueden mentir).
// ════════════════════════════════════════════════════════════════════════
using System;
using System.Collections.Generic;
using UnityEngine;

namespace Ruta11
{
    [Serializable]
    public class ObjetoBaul
    {
        public string nombre;
        public bool ilegal;
        public Falta falta;          // Drogas o Armas si es ilegal
        public bool escondido;       // abajo de otra cosa: hay que mirar con la linterna
        public Color color = Color.gray;
        public Vector3 tamanio = new Vector3(0.4f, 0.3f, 0.3f);
    }

    [Serializable]
    public class PerfilConductor
    {
        // Identidad real.
        public string nombreReal, dniReal;
        public DateTime nacimiento;
        public RostroData rostro;
        // Vehículo real.
        public TipoVehiculo tipo;
        public string patente, marcaModelo, colorNombre;
        public Color colorAuto;
        // Lo que entrega.
        public DocumentosConductor docs;
        // Lo que pasa de verdad.
        public bool sinCinturon, lucesQuemadas, pedidoCaptura, identidadFalsa, vehiculoRobado, sospechoso;
        public float alcohol;                           // g/l en sangre
        public string origen, destino, cargaDeclarada;
        public List<ObjetoBaul> baul = new List<ObjetoBaul>();

        public bool LlevaDroga => baul.Exists(o => o.ilegal && o.falta == Falta.Drogas);
        public bool LlevaArma => baul.Exists(o => o.ilegal && o.falta == Falta.Armas);
        public bool Borracho => alcohol > 0.5f;

        // Todas las faltas reales (la vara con la que se evalúa al jugador).
        public List<Falta> FaltasReales(DateTime hoy)
        {
            var f = new List<Falta>();
            if (sinCinturon) f.Add(Falta.SinCinturon);
            if (lucesQuemadas) f.Add(Falta.LucesQuemadas);
            if (!docs.seguro.Vigente(hoy)) f.Add(Falta.SinSeguro);
            int dias = docs.licencia.DiasVencida(hoy);
            if (!docs.licencia.presente || !docs.licencia.Habilita(tipo)) f.Add(Falta.SinLicencia);
            else if (dias > 365) f.Add(Falta.LicenciaVencidaMasDeUnAnio);
            else if (dias > 0) f.Add(Falta.LicenciaVencida);
            if (Borracho) f.Add(Falta.AlcoholPositivo);
            if (!docs.cedula.presente) f.Add(Falta.SinCedula);
            if (pedidoCaptura) f.Add(Falta.PedidoDeCaptura);
            if (LlevaDroga) f.Add(Falta.Drogas);
            if (LlevaArma) f.Add(Falta.Armas);
            if (identidadFalsa) f.Add(Falta.IdentidadFalsa);
            if (vehiculoRobado) f.Add(Falta.VehiculoRobado);
            return f;
        }
    }

    public static class GeneradorConductores
    {
        static readonly string[] NombresH = { "RAMÓN ALBERTO", "JUAN CARLOS", "MIGUEL ÁNGEL", "SERGIO DANIEL", "WALTER HUGO", "LUIS ALBERTO", "DIEGO MARTÍN", "MARCELO FABIÁN", "CLAUDIO RAÚL", "RUBÉN DARÍO", "JOSÉ LUIS", "HÉCTOR OMAR", "CRISTIAN JAVIER", "ÁNGEL GABRIEL", "NÉSTOR RAÚL", "FACUNDO EZEQUIEL" };
        static readonly string[] NombresM = { "ANA MARÍA", "MARÍA LAURA", "SILVIA BEATRIZ", "GLADYS NOEMÍ", "NORMA BEATRIZ", "ROMINA SOLEDAD", "MARIELA ALEJANDRA", "DANIELA ESTER", "CARINA ELIZABETH", "ROCÍO BELÉN" };
        static readonly string[] Apellidos = { "GONZÁLEZ", "RODRÍGUEZ", "FERNÁNDEZ", "LÓPEZ", "BENÍTEZ", "ROMERO", "ACOSTA", "SOSA", "RAMÍREZ", "GÓMEZ", "OJEDA", "DUARTE", "AQUINO", "CARDOZO", "MAIDANA", "ZALAZAR", "ESPÍNOLA", "GIMÉNEZ", "VALLEJOS", "LEIVA", "VILLALBA", "LEDESMA", "ESCOBAR", "FRANCO", "ALEGRE", "SOTELO" };
        public static readonly string[] Lugares = { "Resistencia", "Formosa", "Clorinda", "Presidencia Roca", "Pampa del Indio", "General San Martín", "Castelli", "Sáenz Peña", "Corrientes", "Laguna Blanca", "Villa Ángela", "Reconquista", "Santa Fe", "Makallé", "La Leonesa" };
        static readonly (string modelo, TipoVehiculo tipo)[] Modelos = { ("Toyota Hilux", TipoVehiculo.Camioneta), ("Ford Ranger", TipoVehiculo.Camioneta), ("VW Amarok", TipoVehiculo.Camioneta), ("Fiat Cronos", TipoVehiculo.Auto), ("VW Gol Trend", TipoVehiculo.Auto), ("Chevrolet Corsa", TipoVehiculo.Auto), ("Renault 12", TipoVehiculo.Auto), ("Peugeot 208", TipoVehiculo.Auto), ("Ford Falcon", TipoVehiculo.Auto), ("Mercedes 1114", TipoVehiculo.Camion), ("Honda Wave 110", TipoVehiculo.Moto) };
        static readonly (string nombre, Color c)[] Colores = { ("Blanco", new Color(0.92f, 0.92f, 0.9f)), ("Gris", new Color(0.55f, 0.57f, 0.6f)), ("Negro", new Color(0.12f, 0.12f, 0.13f)), ("Rojo", new Color(0.7f, 0.12f, 0.1f)), ("Azul", new Color(0.15f, 0.3f, 0.6f)), ("Verde", new Color(0.2f, 0.45f, 0.25f)), ("Celeste", new Color(0.5f, 0.7f, 0.85f)), ("Bordó", new Color(0.4f, 0.08f, 0.12f)) };
        static readonly string[] Aseguradoras = { "La Segunda", "Sancor Seguros", "Federación Patronal", "Rivadavia Seguros", "La Caja", "Mercantil Andina" };
        static readonly string[] CargasNormales = { "Mercadería para el almacén", "Bolsos con ropa", "Herramientas de trabajo", "Verduras y frutas", "Una garrafa y el auxilio", "Nada, oficial, el auxilio nomás", "Repuestos del campo", "Cajas de la mudanza" };

        public static string NombreAzar(System.Random r, bool mujer) => Apellidos[r.Next(Apellidos.Length)] + ", " + (mujer ? NombresM : NombresH)[r.Next(mujer ? NombresM.Length : NombresH.Length)];
        public static string DniAzar(System.Random r, int anioNac) { int baseN = Mathf.Clamp((anioNac - 1940) * 780000, 5000000, 48000000) + r.Next(700000); return baseN.ToString("N0", new System.Globalization.CultureInfo("es-AR")); }
        public static string PatenteAzar(System.Random r)
        {
            const string L = "ABCDEFGHJKLMNPRSTUVWXYZ";
            char C() => L[r.Next(L.Length)];
            // Mitad patentes viejas (ABC 123) y mitad Mercosur (AB 123 CD).
            return r.NextDouble() < 0.5 ? $"{C()}{C()}{C()} {r.Next(100, 999)}" : $"A{C()} {r.Next(100, 999)} {C()}{C()}";
        }

        // 30 % de sospechosos, como pide el diseño. semilla: la partida es repetible.
        public static PerfilConductor Generar(System.Random r, DateTime hoy, RegistroPolicial reg)
        {
            bool mujer = r.NextDouble() < 0.28;
            int edad = 19 + r.Next(50);
            var p = new PerfilConductor { rostro = RostroData.Azar(r, mujer), nacimiento = hoy.AddYears(-edad).AddDays(-r.Next(365)) };
            p.nombreReal = NombreAzar(r, mujer);
            p.dniReal = DniAzar(r, p.nacimiento.Year);
            var m = Modelos[r.Next(Modelos.Length)]; var col = Colores[r.Next(Colores.Length)];
            p.tipo = m.tipo; p.marcaModelo = m.modelo; p.colorNombre = col.nombre; p.colorAuto = col.c;
            p.patente = PatenteAzar(r);
            p.origen = Lugares[r.Next(Lugares.Length)];
            do p.destino = Lugares[r.Next(Lugares.Length)]; while (p.destino == p.origen);
            p.cargaDeclarada = CargasNormales[r.Next(CargasNormales.Length)];

            // Papeles en regla, para empezar.
            string categoria = p.tipo == TipoVehiculo.Moto ? "A.2.1" : p.tipo == TipoVehiculo.Camion ? "C.1" : (r.NextDouble() < 0.7 ? "B.1" : "B.2");
            p.docs = new DocumentosConductor
            {
                dni = new DNI { numero = p.dniReal, nombre = p.nombreReal, fechaNacimiento = p.nacimiento, foto = p.rostro },
                licencia = new LicenciaDeConducir { numero = p.dniReal, nombre = p.nombreReal, categoria = categoria, fechaVencimiento = hoy.AddDays(60 + r.Next(1500)) },
                cedula = new CedulaVerde { patente = p.patente, titular = r.NextDouble() < 0.8 ? p.nombreReal : NombreAzar(r, r.NextDouble() < 0.5), marcaModelo = p.marcaModelo, color = p.colorNombre },
                seguro = new Seguro { compania = Aseguradoras[r.Next(Aseguradoras.Length)], poliza = r.Next(100000, 999999).ToString(), vigenciaHasta = hoy.AddDays(15 + r.Next(300)) },
            };

            // Faltas comunes.
            p.sinCinturon = r.NextDouble() < 0.15;
            p.lucesQuemadas = r.NextDouble() < 0.12;
            if (r.NextDouble() < 0.10) { if (r.NextDouble() < 0.5) p.docs.seguro.presente = false; else p.docs.seguro.vigenciaHasta = hoy.AddDays(-10 - r.Next(200)); }
            double lic = r.NextDouble();
            if (lic < 0.08) p.docs.licencia.fechaVencimiento = hoy.AddDays(-5 - r.Next(300));          // vencida hace menos de un año
            else if (lic < 0.13) p.docs.licencia.fechaVencimiento = hoy.AddDays(-400 - r.Next(900));   // más de un año
            if (r.NextDouble() < 0.05) p.docs.cedula.presente = false;
            p.alcohol = r.NextDouble() < 0.12 ? 0.6f + (float)r.NextDouble() * 1.8f : (r.NextDouble() < 0.2 ? (float)r.NextDouble() * 0.35f : 0f);

            // Carga normal en el baúl.
            int n = 1 + r.Next(3);
            for (int i = 0; i < n; i++) p.baul.Add(new ObjetoBaul { nombre = new[] { "Bolso", "Caja", "Rueda de auxilio", "Cajón de verdura", "Garrafa", "Caja de herramientas" }[r.Next(6)], color = new Color(0.35f + (float)r.NextDouble() * 0.4f, 0.3f, 0.25f), tamanio = new Vector3(0.35f + (float)r.NextDouble() * 0.3f, 0.25f + (float)r.NextDouble() * 0.2f, 0.3f + (float)r.NextDouble() * 0.2f) });

            // Sospechosos (30 %): algunos esconden algo; otros son nerviosos nomás (para que no sea obvio).
            p.sospechoso = r.NextDouble() < 0.30;
            if (p.sospechoso)
            {
                double q = r.NextDouble();
                if (q < 0.35) HacerIdentidadFalsa(p, r, hoy, reg);
                else if (q < 0.70)
                {
                    bool droga = r.NextDouble() < 0.7;
                    int paquetes = droga ? 2 + r.Next(5) : 1;
                    for (int i = 0; i < paquetes; i++)
                        p.baul.Add(new ObjetoBaul { nombre = droga ? "Paquete encintado" : "Arma de fuego", ilegal = true, falta = droga ? Falta.Drogas : Falta.Armas, escondido = r.NextDouble() < 0.6, color = droga ? new Color(0.75f, 0.65f, 0.35f) : new Color(0.1f, 0.1f, 0.1f), tamanio = droga ? new Vector3(0.3f, 0.12f, 0.2f) : new Vector3(0.6f, 0.08f, 0.15f) });
                    if (r.NextDouble() < 0.4) p.cargaDeclarada = "Nada, nada. Ropa nomás.";
                }
                else if (q < 0.82) p.pedidoCaptura = true;
                else if (q < 0.90)
                {
                    // Auto robado con la cédula de otro auto (la patente no coincide).
                    p.vehiculoRobado = true;
                    p.docs.cedula.patente = PatenteAzar(r);
                }
                // El resto: nervioso pero en regla.
            }

            // El sistema policial conoce a la persona y al vehículo reales.
            reg.Agregar(new PersonaRegistrada { dni = p.dniReal, nombre = p.nombreReal, nacimiento = p.nacimiento, rostro = p.rostro, pedidoDeCaptura = p.pedidoCaptura, motivoCaptura = p.pedidoCaptura ? new[] { "Robo calificado — Juzgado de Garantías de Resistencia", "Abuso de armas — Fiscalía de Sáenz Peña", "Evasión — Juzgado Federal de Formosa" }[r.Next(3)] : null, antecedentes = r.NextDouble() < 0.15 ? "Contravención de tránsito (2023)" : "Sin antecedentes" });
            reg.Agregar(new VehiculoRegistrado { patente = p.patente, titular = p.docs.cedula.titular, marcaModelo = p.marcaModelo, color = p.colorNombre, pedidoDeSecuestro = p.vehiculoRobado });
            return p;
        }

        // El DNI es de otra persona registrada (otro nombre en el sistema) y la foto se le parece, pero no es.
        static void HacerIdentidadFalsa(PerfilConductor p, System.Random r, DateTime hoy, RegistroPolicial reg)
        {
            p.identidadFalsa = true;
            bool mujer = p.rostro.mujer;
            var prestado = new PersonaRegistrada { dni = DniAzar(r, p.nacimiento.Year - 3 + r.Next(6)), nombre = NombreAzar(r, mujer), nacimiento = p.nacimiento.AddDays(r.Next(-900, 900)), rostro = RostroData.Azar(r, mujer), antecedentes = "Sin antecedentes" };
            reg.Agregar(prestado);
            string alias;
            do alias = NombreAzar(r, mujer); while (alias == prestado.nombre || alias == p.nombreReal);
            p.docs.dni = new DNI { numero = prestado.dni, nombre = alias, fechaNacimiento = prestado.nacimiento, foto = p.rostro.Variante(r, 0.4f) };
            p.docs.licencia.nombre = alias; p.docs.licencia.numero = prestado.dni;
            if (p.docs.cedula.titular == p.nombreReal) p.docs.cedula.titular = alias;
            // Muchas veces el que usa un DNI falso es porque lo buscan.
            p.pedidoCaptura = r.NextDouble() < 0.5;
        }
    }
}

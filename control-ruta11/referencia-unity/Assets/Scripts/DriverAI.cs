// ════════════════════════════════════════════════════════════════════════
// DriverAI: el conductor. Cómo se comporta (Normal, Nervioso, Borracho, Falso),
// qué contesta, cómo sopla el alcoholímetro y qué hace cuando lo esposan.
// ════════════════════════════════════════════════════════════════════════
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;

namespace Ruta11
{
    public enum EstadoConductor { Normal, Nervioso, Borracho, Falso }
    public enum EstadoLegal { Libre, Multado, Demorado, Detenido, Arrestado }
    public enum ModoConductor { EnAuto, Afuera, Esposado, Siguiendo, EnZona, EnPatrullero, Retirado }
    public enum Pregunta { DeDondeViene, ADondeVa, QueLlevaEnElBaul, TomoAlcohol, NombreCompleto, AbrirElBaul }

    public class DriverAI : MonoBehaviour
    {
        [Header("Partes (las arma el bootstrap o el prefab)")]
        public Transform cuerpo;
        public Transform cabeza;
        public Renderer cara;
        public AudioSource voz;

        [Header("Estado")]
        public EstadoConductor estado = EstadoConductor.Normal;
        public EstadoLegal estadoLegal = EstadoLegal.Libre;
        public ModoConductor modo = ModoConductor.EnAuto;
        public PerfilConductor perfil;
        public VehiculoNPC vehiculo;

        public event System.Action<DriverAI, string> AlHablar; // lo muestra la UI como subtítulo

        Transform jugador, seguirA;
        Vector3 cuerpoBase, cabezaBase, destino;
        bool yendo;
        float nervios, tiempo;
        Texture2D caraNormal, caraRoja;
        readonly Dictionary<Pregunta, int> vecesPreguntado = new Dictionary<Pregunta, int>();
        System.Random azar;

        public void Configurar(PerfilConductor p, VehiculoNPC v, Transform jugadorT, int semilla)
        {
            perfil = p; vehiculo = v; jugador = jugadorT; azar = new System.Random(semilla);
            // El estado de ánimo sale de lo que esconde.
            estado = p.identidadFalsa ? EstadoConductor.Falso : p.Borracho ? EstadoConductor.Borracho : p.sospechoso ? EstadoConductor.Nervioso : EstadoConductor.Normal;
            nervios = estado == EstadoConductor.Falso ? 0.8f : estado == EstadoConductor.Nervioso ? 0.6f : 0.05f;
            caraNormal = p.rostro.Dibujar(128, false, false);
            caraRoja = p.rostro.Dibujar(128, true, false);
            if (cara != null) cara.material.mainTexture = estado == EstadoConductor.Borracho ? caraRoja : caraNormal;
            if (cuerpo != null) cuerpoBase = cuerpo.localPosition;
            if (cabeza != null) cabezaBase = cabeza.localPosition;
        }

        void Update()
        {
            tiempo += Time.deltaTime;
            AnimarCabezaYCuerpo();
            if (modo == ModoConductor.Siguiendo && seguirA != null) SeguirAlPolicia();
            else if (yendo) Caminar(destino, 1.6f);
        }

        // ── animación procedural: temblor, mirada esquiva, balanceo del borracho ──
        void AnimarCabezaYCuerpo()
        {
            if (cabeza == null) return;
            Vector3 temblor = Vector3.zero;
            Quaternion mirar = Quaternion.identity;
            bool cerca = jugador != null && Vector3.Distance(jugador.position, cabeza.position) < 4f;
            switch (estado)
            {
                case EstadoConductor.Normal:
                    if (cerca) mirar = MirarA(jugador.position + Vector3.up * 1.6f);
                    break;
                case EstadoConductor.Nervioso:
                case EstadoConductor.Falso:
                    // Tiembla y esquiva la mirada: mira de reojo y enseguida para otro lado.
                    temblor = new Vector3(Mathf.PerlinNoise(tiempo * 18f, 0) - 0.5f, Mathf.PerlinNoise(0, tiempo * 18f) - 0.5f, 0) * 0.012f * (nervios + (cerca ? 0.5f : 0));
                    if (cerca)
                    {
                        bool deReojo = Mathf.Repeat(tiempo, 3.2f) < 0.5f;
                        mirar = deReojo ? MirarA(jugador.position + Vector3.up * 1.6f) : Quaternion.Euler(12f, 55f * Mathf.Sin(tiempo * 0.7f) + 40f, 0);
                    }
                    break;
                case EstadoConductor.Borracho:
                    // Cabeza que se va para los costados, sin mirar fijo.
                    mirar = Quaternion.Euler(Mathf.Sin(tiempo * 0.9f) * 12f, Mathf.Sin(tiempo * 0.6f) * 20f, Mathf.Sin(tiempo * 1.3f) * 9f);
                    temblor = new Vector3(Mathf.Sin(tiempo * 1.1f), 0, 0) * 0.03f;
                    break;
            }
            cabeza.localRotation = Quaternion.Slerp(cabeza.localRotation, mirar, Time.deltaTime * 6f);
            cabeza.localPosition = cabezaBase + temblor;
            if (cuerpo != null && modo != ModoConductor.EnAuto && estado == EstadoConductor.Borracho)
                cuerpo.localRotation = Quaternion.Euler(0, 0, Mathf.Sin(tiempo * 1.4f) * 6f);
        }
        Quaternion MirarA(Vector3 punto)
        {
            Vector3 dir = cabeza.parent.InverseTransformDirection(punto - cabeza.position);
            return dir.sqrMagnitude < 0.01f ? Quaternion.identity : Quaternion.LookRotation(dir);
        }

        // ── diálogo ──
        public string Responder(Pregunta q)
        {
            vecesPreguntado.TryGetValue(q, out int veces); vecesPreguntado[q] = veces + 1;
            nervios = Mathf.Clamp01(nervios + (estado == EstadoConductor.Normal ? 0.02f : 0.12f));
            string r = TextoRespuesta(q, veces);
            if (estado == EstadoConductor.Borracho) r = Arrastrar(r);
            Decir(r);
            return r;
        }

        string TextoRespuesta(Pregunta q, int veces)
        {
            var p = perfil;
            bool miente = estado == EstadoConductor.Nervioso || estado == EstadoConductor.Falso;
            string otroLugar = GeneradorConductores.Lugares[azar.Next(GeneradorConductores.Lugares.Length)];
            switch (q)
            {
                case Pregunta.DeDondeViene:
                    if (!miente) return $"Vengo de {p.origen}, oficial.";
                    // Respuestas incoherentes: cambia la historia si se le pregunta dos veces.
                    return veces == 0 ? $"Eh... de {p.origen}. Bueno, de {otroLugar} en realidad." : $"De {otroLugar}. Ya le dije, ¿no?";
                case Pregunta.ADondeVa:
                    if (!miente) return $"Voy para {p.destino}, a lo de un pariente.";
                    return veces == 0 ? $"A {p.destino}... a hacer unos trámites. O a lo de mi primo, depende." : $"Para {otroLugar}, oficial. ¿Por qué pregunta tanto?";
                case Pregunta.QueLlevaEnElBaul:
                    if (p.LlevaDroga || p.LlevaArma) return veces == 0 ? p.cargaDeclarada : "Nada, nada. ¿Tiene que revisar? Estoy apurado.";
                    return p.cargaDeclarada;
                case Pregunta.TomoAlcohol:
                    if (p.Borracho) return "No, oficial... bueno, una cervecita en el almuerzo nomás.";
                    return miente ? "¿Alcohol? No, no... nada. ¿Me va a hacer soplar?" : "No, oficial. Nada.";
                case Pregunta.NombreCompleto:
                    if (estado == EstadoConductor.Falso)
                    {
                        // Se le escapa el nombre verdadero y se corrige.
                        string real = p.nombreReal.Split(',')[1].Trim().Split(' ')[0];
                        return veces == 0 ? $"{Capitalizar(real)}... digo, {Capitalizar(p.docs.dni.nombre)}." : $"{Capitalizar(p.docs.dni.nombre)}. Está ahí en el documento.";
                    }
                    return $"{Capitalizar(p.docs.dni.nombre)}, oficial.";
                case Pregunta.AbrirElBaul:
                    if (p.LlevaDroga || p.LlevaArma) return "¿El baúl? Está trabado, oficial... bueno, dele. Ábralo.";
                    return "Sí, cómo no. Ahí se lo abro.";
            }
            return "...";
        }

        // Voz borrosa: se le traban las eses, estira las vocales y se le escapa un hipo.
        public string Arrastrar(string s)
        {
            var sb = new StringBuilder();
            foreach (char c in s)
            {
                if (c == 's' && azar.NextDouble() < 0.5) sb.Append("sh");
                else if ("aeiou".IndexOf(c) >= 0 && azar.NextDouble() < 0.18) sb.Append(c).Append(c);
                else sb.Append(c);
            }
            if (azar.NextDouble() < 0.5) sb.Append(" *hip*");
            return sb.ToString();
        }
        static string Capitalizar(string nombre)
        {
            // "GONZÁLEZ, RAMÓN" → "Ramón González"
            string[] partes = nombre.Split(',');
            string s = partes.Length == 2 ? partes[1].Trim() + " " + partes[0].Trim() : nombre;
            var sb = new StringBuilder(s.ToLowerInvariant());
            for (int i = 0; i < sb.Length; i++) if (i == 0 || sb[i - 1] == ' ') sb[i] = char.ToUpperInvariant(sb[i]);
            return sb.ToString();
        }

        void Decir(string texto)
        {
            AlHablar?.Invoke(this, texto);
            if (voz == null) return;
            // Murmullo sintetizado: sílabas cortas; el borracho, más grave y arrastrado.
            voz.pitch = estado == EstadoConductor.Borracho ? 0.75f : estado == EstadoConductor.Normal ? 1f : 1.12f;
            voz.clip = SintetizarMurmullo(texto, estado == EstadoConductor.Borracho, perfil.rostro.mujer);
            voz.Play();
        }
        static AudioClip SintetizarMurmullo(string texto, bool arrastrado, bool aguda)
        {
            int frec = 22050, silabas = Mathf.Clamp(texto.Length / 3, 3, 40);
            float durSil = arrastrado ? 0.16f : 0.09f;
            int n = (int)(frec * silabas * durSil);
            var datos = new float[n];
            var r = new System.Random(texto.GetHashCode());
            float f0 = aguda ? 210f : 125f, fase = 0;
            for (int s = 0; s < silabas; s++)
            {
                float f = f0 * (0.85f + (float)r.NextDouble() * 0.35f);
                int ini = (int)(s * durSil * frec), largo = (int)(durSil * frec * 0.8f);
                for (int i = 0; i < largo && ini + i < n; i++)
                {
                    float t = i / (float)largo, env = Mathf.Sin(t * Mathf.PI);
                    fase += 2 * Mathf.PI * (f * (arrastrado ? 1f - t * 0.25f : 1f)) / frec;
                    datos[ini + i] = (Mathf.Sin(fase) * 0.6f + Mathf.Sin(fase * 2.01f) * 0.25f + Mathf.Sin(fase * 3.03f) * 0.1f) * env * 0.35f;
                }
            }
            var clip = AudioClip.Create("murmullo", n, 1, frec, false);
            clip.SetData(datos, 0);
            return clip;
        }

        // ── alcoholímetro: el resultado real, con un poquito de ruido de medición ──
        public float Soplar()
        {
            float medido = Mathf.Clamp(perfil.alcohol + ((float)azar.NextDouble() - 0.5f) * 0.04f, 0f, 2.5f);
            Decir(perfil.Borracho ? Arrastrar("Fuuuuu... ¿ya está?") : "Fuuuuuuu.");
            if (medido > Alcoholimetro.Limite) { estadoLegal = EstadoLegal.Detenido; estado = EstadoConductor.Borracho; if (cara != null) cara.material.mainTexture = caraRoja; }
            return medido;
        }

        // ── procedimiento ──
        public void BajarDelAuto(Vector3 donde)
        {
            if (modo != ModoConductor.EnAuto) return;
            transform.SetParent(null, true);
            transform.position = donde;
            transform.rotation = Quaternion.LookRotation(Vector3.ProjectOnPlane((jugador ? jugador.position : donde + Vector3.forward) - donde, Vector3.up).normalized + Vector3.forward * 0.001f);
            modo = ModoConductor.Afuera;
            if (cuerpo != null) { cuerpo.localPosition = cuerpoBase = new Vector3(0, 0.9f, 0); }
        }
        public void Esposar(Transform policia)
        {
            if (modo == ModoConductor.EnAuto && vehiculo != null) BajarDelAuto(vehiculo.PuertaConductor());
            modo = ModoConductor.Esposado;
            estadoLegal = EstadoLegal.Arrestado;
            Decir(estado == EstadoConductor.Normal ? "¡Pero oficial, yo no hice nada!" : estado == EstadoConductor.Borracho ? Arrastrar("Eshtá bien, eshtá bien...") : "...");
            Seguir(policia);
        }
        public void Seguir(Transform policia) { seguirA = policia; modo = ModoConductor.Siguiendo; }
        void SeguirAlPolicia()
        {
            Vector3 atras = seguirA.position - seguirA.forward * 1.4f;
            if (Vector3.Distance(transform.position, atras) > 0.4f) Caminar(atras, 3.2f);
        }
        void Caminar(Vector3 hacia, float velocidad)
        {
            Vector3 d = hacia - transform.position; d.y = 0;
            if (d.magnitude < 0.15f) { yendo = false; return; }
            float v = velocidad * (estado == EstadoConductor.Borracho ? 0.7f : 1f);
            transform.position += d.normalized * Mathf.Min(d.magnitude, v * Time.deltaTime);
            transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(d.normalized), Time.deltaTime * 8f);
        }
        public void QuedarseEnZona(Vector3 lugar)
        {
            seguirA = null; destino = lugar; yendo = true; modo = ModoConductor.EnZona;
        }
        public void Demorar(Vector3 lugar) { estadoLegal = EstadoLegal.Demorado; if (modo == ModoConductor.EnAuto && vehiculo != null) BajarDelAuto(vehiculo.PuertaConductor()); QuedarseEnZona(lugar); }
        public IEnumerator SubirAPatrullero(Transform puerta)
        {
            modo = ModoConductor.EnPatrullero; seguirA = null; yendo = false;
            while (Vector3.Distance(transform.position, puerta.position) > 0.3f) { Caminar(puerta.position, 2f); yield return null; }
            transform.SetParent(puerta, true);
            gameObject.SetActive(false);
        }
        public bool Esposado => modo == ModoConductor.Esposado || modo == ModoConductor.Siguiendo || modo == ModoConductor.EnZona && estadoLegal == EstadoLegal.Arrestado;
    }
}

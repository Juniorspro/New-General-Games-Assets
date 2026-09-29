// ════════════════════════════════════════════════════════════════════════
// Ruta11Bootstrap: arma el puesto de control entero con primitivas low-poly.
// Uso: escena vacía → un GameObject vacío → agregarle este componente → Play.
// Cuando tengas los assets de la Asset Store, reemplazá cada pieza por su
// prefab (los nombres de los objetos coinciden con la lista del GDD).
// ════════════════════════════════════════════════════════════════════════
using UnityEngine;

namespace Ruta11
{
    public class Ruta11Bootstrap : MonoBehaviour
    {
        public int semilla = 0;
        public int vehiculosPorTurno = 12;
        public float minutosPorTurno = 18f;

        Material mat;
        System.Random r;

        void Awake()
        {
            r = new System.Random(1234);
            var sh = Shader.Find("Universal Render Pipeline/Lit");
            if (sh == null) sh = Shader.Find("Standard");
            mat = new Material(sh);

            // Luz y cielo.
            var solGo = new GameObject("Sol"); var sol = solGo.AddComponent<Light>(); sol.type = LightType.Directional; sol.shadows = LightShadows.Soft; sol.intensity = 1.1f;
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.55f, 0.7f, 0.95f); RenderSettings.ambientEquatorColor = new Color(0.55f, 0.6f, 0.5f); RenderSettings.ambientGroundColor = new Color(0.3f, 0.32f, 0.22f);
            RenderSettings.fog = true; RenderSettings.fogColor = new Color(0.72f, 0.82f, 0.92f); RenderSettings.fogMode = FogMode.Linear; RenderSettings.fogStartDistance = 80; RenderSettings.fogEndDistance = 380;

            ConstruirRuta();
            ConstruirPuesto();
            ConstruirMonte();

            // Puntos del recorrido: los autos vienen del sur (−Z) por el carril derecho (+X).
            var aparicion = Punto("PuntoAparicion", new Vector3(1.9f, 0, -230));
            var parada = Punto("LineaDeParada", new Vector3(1.9f, 0, -3));
            var salida = Punto("Salida", new Vector3(1.9f, 0, 320));
            var secuestro = Punto("PlayaSecuestro", new Vector3(20f, 0, 22));
            var patrullero = Punto("PuntoPatrullero", new Vector3(-1.9f, 0, 260));

            // Zona de Detenidos (rectángulo amarillo con banco).
            var zonaGo = new GameObject("ZonaDetenidos"); zonaGo.transform.position = new Vector3(13f, 0, -8f);
            var zona = zonaGo.AddComponent<ZonaDetenidos>();
            Borde(zonaGo.transform, zona.tamanio, new Color(1f, 0.82f, 0.1f));
            Caja(zonaGo.transform, "Banco", new Vector3(0, 0.25f, zona.tamanio.z / 2 - 0.4f), new Vector3(zona.tamanio.x - 0.6f, 0.5f, 0.5f), new Color(0.45f, 0.3f, 0.2f));
            Cartel(zonaGo.transform, "ZONA DE DETENIDOS", new Vector3(0, 2.2f, zona.tamanio.z / 2), new Color(1f, 0.82f, 0.1f));

            // Jugador: cámara a 1,65 m y linterna en la mano.
            var jGo = new GameObject("Policia"); jGo.transform.position = new Vector3(4.5f, 1f, -4f); jGo.transform.rotation = Quaternion.Euler(0, -90, 0);
            var cc = jGo.AddComponent<CharacterController>(); cc.height = 1.8f; cc.center = new Vector3(0, 0.9f, 0); cc.radius = 0.35f;
            var camGo = new GameObject("Camara"); camGo.transform.SetParent(jGo.transform, false); camGo.transform.localPosition = new Vector3(0, 1.65f, 0);
            var cam = camGo.AddComponent<Camera>(); cam.nearClipPlane = 0.05f; cam.farClipPlane = 600f; camGo.tag = "MainCamera"; camGo.AddComponent<AudioListener>();
            var linterna = new GameObject("Linterna").AddComponent<Light>(); linterna.transform.SetParent(camGo.transform, false); linterna.transform.localPosition = new Vector3(0.25f, -0.2f, 0.2f);
            linterna.type = LightType.Spot; linterna.spotAngle = 38; linterna.range = 18; linterna.intensity = 3.5f; linterna.color = new Color(1f, 0.97f, 0.9f);
            var alco = jGo.AddComponent<Alcoholimetro>(); alco.pitido = jGo.AddComponent<AudioSource>();
            alco.pitido.clip = Pitido();
            var jugador = jGo.AddComponent<JugadorPolicia>(); jugador.camara = cam; jugador.linterna = linterna;

            // El gestor del puesto y la interfaz.
            var g = new GameObject("PoliceCheckpointManager").AddComponent<PoliceCheckpointManager>();
            g.puntoAparicion = aparicion; g.lineaDeParada = parada; g.salida = salida; g.playaSecuestro = secuestro; g.puntoPatrullero = patrullero;
            g.zonaDetenidos = zona; g.jugador = jGo.transform; g.alcoholimetro = alco; g.sol = sol; g.materialBase = mat;
            g.semilla = semilla; g.vehiculosPorTurno = vehiculosPorTurno; g.minutosRealesPorTurno = minutosPorTurno;
            var ui = new GameObject("TabletPolicialUI").AddComponent<TabletPolicialUI>();
            ui.gestor = g; ui.jugador = jugador; ui.alcoholimetro = alco;
        }

        // ── Ruta Nacional 11: dos carriles, banquinas y líneas ──
        void ConstruirRuta()
        {
            var suelo = GameObject.CreatePrimitive(PrimitiveType.Plane); suelo.name = "Campo"; suelo.transform.localScale = new Vector3(80, 1, 80);
            suelo.GetComponent<Renderer>().material = new Material(mat) { color = new Color(0.42f, 0.55f, 0.25f) };
            Caja(null, "Banquina", new Vector3(0, 0.01f, 0), new Vector3(12f, 0.02f, 800f), new Color(0.55f, 0.45f, 0.32f));
            Caja(null, "Asfalto", new Vector3(0, 0.03f, 0), new Vector3(7.6f, 0.04f, 800f), new Color(0.22f, 0.22f, 0.24f));
            for (float z = -400; z < 400; z += 8f) Caja(null, "LineaCentral", new Vector3(0, 0.055f, z), new Vector3(0.15f, 0.01f, 4f), new Color(0.95f, 0.95f, 0.9f));
            foreach (float x in new[] { -3.65f, 3.65f }) Caja(null, "LineaBorde", new Vector3(x, 0.055f, 0), new Vector3(0.12f, 0.01f, 800f), Color.white);
            // Cebrado blanco del control (como en la foto del puesto).
            for (int i = 0; i < 6; i++) { var c = Caja(null, "Cebrado", new Vector3(1.9f, 0.056f, -6f - i * 1.4f), new Vector3(3.2f, 0.01f, 0.5f), Color.white); c.transform.rotation = Quaternion.Euler(0, 35, 0); }
            // Lomo de burro antes de los conos.
            Caja(null, "Reductor", new Vector3(1.9f, 0.06f, -14f), new Vector3(3.6f, 0.12f, 0.8f), new Color(0.95f, 0.8f, 0.15f));
            for (float z = -300; z < 300; z += 45f) { Poste(new Vector3(-6.5f, 0, z)); Luminaria(new Vector3(6.2f, 0, z + 20f), Mathf.Abs(z) < 60); }
        }

        // ── Puesto de control: garita, conos, carteles, motos y camioneta ──
        void ConstruirPuesto()
        {
            var garita = new GameObject("Garita"); garita.transform.position = new Vector3(9.5f, 0, 2f);
            Caja(garita.transform, "Contenedor", new Vector3(0, 1.35f, 0), new Vector3(2.6f, 2.7f, 6f), new Color(0.93f, 0.94f, 0.95f));
            Caja(garita.transform, "Franja", new Vector3(-1.31f, 2.55f, 0), new Vector3(0.02f, 0.2f, 6f), new Color(0.1f, 0.35f, 0.8f));
            Caja(garita.transform, "Puerta", new Vector3(-1.31f, 1.1f, 0.6f), new Vector3(0.03f, 2.1f, 1f), new Color(0.6f, 0.45f, 0.3f));
            Texto3D(garita.transform, "POLICÍA CAMINERA", new Vector3(-1.33f, 1.8f, -1.6f), Quaternion.Euler(0, -90, 0), new Color(0.05f, 0.1f, 0.3f), 0.06f);
            Texto3D(garita.transform, "CR 11", new Vector3(-1.33f, 2.2f, 2.2f), Quaternion.Euler(0, -90, 0), Color.black, 0.05f);
            // Conos a lo ancho del carril.
            for (int i = 0; i < 5; i++) Cono(new Vector3(0.3f + i * 0.8f, 0, 0.5f));
            for (int i = 0; i < 8; i++) Cono(new Vector3(0.2f, 0, -12f + i * 1.6f));
            Cartel(null, "CONTROL POLICIAL — PARE", new Vector3(5.2f, 2.4f, -22f), new Color(0.85f, 0.1f, 0.1f));
            // Motos azules estacionadas, como las del puesto real.
            for (int i = 0; i < 4; i++) Moto(new Vector3(6.3f, 0, -4f + i * 1.6f));
            // Camioneta del puesto.
            var cam = new GameObject("CamionetaPolicial"); cam.transform.position = new Vector3(13.5f, 0, 8f); cam.transform.rotation = Quaternion.Euler(0, 20, 0);
            Caja(cam.transform, "Chasis", new Vector3(0, 0.8f, 0), new Vector3(1.9f, 0.75f, 5.2f), Color.white);
            Caja(cam.transform, "Cabina", new Vector3(0, 1.5f, 0.6f), new Vector3(1.8f, 0.7f, 2.2f), Color.white);
            Caja(cam.transform, "Franja", new Vector3(0, 0.95f, 0), new Vector3(1.92f, 0.12f, 5.22f), new Color(0.1f, 0.35f, 0.8f));
            // Playa de secuestro.
            var playa = new GameObject("PlayaSecuestro"); playa.transform.position = new Vector3(20f, 0, 22f);
            Borde(playa.transform, new Vector3(16f, 1f, 12f), new Color(0.9f, 0.9f, 0.9f));
            Cartel(playa.transform, "PLAYA DE SECUESTRO", new Vector3(0, 2.2f, -6f), new Color(0.2f, 0.2f, 0.25f));
        }

        // ── Monte chaqueño: algarrobos y quebrachos low-poly a los costados ──
        void ConstruirMonte()
        {
            var monte = new GameObject("Monte");
            for (int i = 0; i < 260; i++)
            {
                float x = (float)(r.NextDouble() * 2 - 1) * 180f, z = (float)(r.NextDouble() * 2 - 1) * 380f;
                if (Mathf.Abs(x) < 9f || (x > 4f && x < 32f && z > -20f && z < 32f)) continue;
                float s = 0.8f + (float)r.NextDouble() * 0.9f;
                var t = new GameObject("Arbol"); t.transform.SetParent(monte.transform, false); t.transform.position = new Vector3(x, 0, z);
                var tronco = Caja(t.transform, "Tronco", new Vector3(0, 1.4f * s, 0), new Vector3(0.35f * s, 2.8f * s, 0.35f * s), new Color(0.35f, 0.25f, 0.18f));
                Destroy(tronco.GetComponent<Collider>());
                for (int k = 0; k < 3; k++)
                {
                    var copa = GameObject.CreatePrimitive(PrimitiveType.Sphere); copa.transform.SetParent(t.transform, false);
                    copa.transform.localPosition = new Vector3(((float)r.NextDouble() - 0.5f) * 2f * s, (3f + (float)r.NextDouble()) * s, ((float)r.NextDouble() - 0.5f) * 2f * s);
                    copa.transform.localScale = new Vector3(2.8f, 1.8f, 2.8f) * s;
                    copa.GetComponent<Renderer>().material = new Material(mat) { color = Color.Lerp(new Color(0.22f, 0.4f, 0.15f), new Color(0.4f, 0.55f, 0.2f), (float)r.NextDouble()) };
                    Destroy(copa.GetComponent<Collider>());
                }
            }
        }

        // ── piezas ──
        GameObject Caja(Transform padre, string n, Vector3 pos, Vector3 esc, Color c)
        {
            var g = GameObject.CreatePrimitive(PrimitiveType.Cube); g.name = n;
            if (padre) g.transform.SetParent(padre, false);
            g.transform.localPosition = pos; g.transform.localScale = esc;
            g.GetComponent<Renderer>().material = new Material(mat) { color = c };
            return g;
        }
        Transform Punto(string n, Vector3 p) { var t = new GameObject(n).transform; t.position = p; return t; }
        void Borde(Transform padre, Vector3 tam, Color c)
        {
            Caja(padre, "Borde", new Vector3(0, 0.06f, tam.z / 2), new Vector3(tam.x, 0.02f, 0.15f), c);
            Caja(padre, "Borde", new Vector3(0, 0.06f, -tam.z / 2), new Vector3(tam.x, 0.02f, 0.15f), c);
            Caja(padre, "Borde", new Vector3(tam.x / 2, 0.06f, 0), new Vector3(0.15f, 0.02f, tam.z), c);
            Caja(padre, "Borde", new Vector3(-tam.x / 2, 0.06f, 0), new Vector3(0.15f, 0.02f, tam.z), c);
        }
        void Cono(Vector3 p)
        {
            var c = GameObject.CreatePrimitive(PrimitiveType.Cylinder); c.name = "Cono"; c.transform.position = p + Vector3.up * 0.35f; c.transform.localScale = new Vector3(0.3f, 0.35f, 0.3f);
            c.GetComponent<Renderer>().material = new Material(mat) { color = new Color(1f, 0.45f, 0.05f) };
            Caja(c.transform, "Franja", new Vector3(0, 0.3f, 0), new Vector3(1.02f, 0.2f, 1.02f), Color.white);
        }
        void Cartel(Transform padre, string texto, Vector3 pos, Color fondo)
        {
            var g = new GameObject("Cartel " + texto); if (padre) g.transform.SetParent(padre, false); g.transform.localPosition = pos;
            Caja(g.transform, "Poste", new Vector3(0, -pos.y / 2, 0.05f), new Vector3(0.1f, pos.y, 0.1f), Color.gray);
            Caja(g.transform, "Tabla", Vector3.zero, new Vector3(3.2f, 0.7f, 0.06f), fondo);
            Texto3D(g.transform, texto, new Vector3(0, 0, -0.04f), Quaternion.identity, Color.white, 0.035f);
        }
        void Texto3D(Transform padre, string texto, Vector3 pos, Quaternion rot, Color c, float tam)
        {
            var tm = new GameObject("Texto").AddComponent<TextMesh>(); tm.transform.SetParent(padre, false); tm.transform.localPosition = pos; tm.transform.localRotation = rot;
            tm.text = texto; tm.characterSize = tam; tm.fontSize = 60; tm.anchor = TextAnchor.MiddleCenter; tm.color = c;
        }
        void Poste(Vector3 p)
        {
            Caja(null, "PosteLuz", p + Vector3.up * 5f, new Vector3(0.25f, 10f, 0.25f), new Color(0.4f, 0.35f, 0.3f));
            Caja(null, "Cruceta", p + Vector3.up * 9.3f, new Vector3(2.4f, 0.15f, 0.15f), new Color(0.4f, 0.35f, 0.3f));
        }
        void Luminaria(Vector3 p, bool conLuz)
        {
            Caja(null, "Columna", p + Vector3.up * 4.5f, new Vector3(0.18f, 9f, 0.18f), new Color(0.75f, 0.75f, 0.78f));
            Caja(null, "Brazo", p + new Vector3(-1.2f, 8.9f, 0), new Vector3(2.4f, 0.12f, 0.12f), new Color(0.75f, 0.75f, 0.78f));
            if (!conLuz) return;
            var l = new GameObject("Luz").AddComponent<Light>(); l.transform.position = p + new Vector3(-2.3f, 8.6f, 0); l.type = LightType.Point; l.range = 22f; l.intensity = 1.6f; l.color = new Color(1f, 0.85f, 0.6f);
        }
        void Moto(Vector3 p)
        {
            var m = new GameObject("MotoPolicial"); m.transform.position = p; m.transform.rotation = Quaternion.Euler(0, 90, 0);
            Caja(m.transform, "Tanque", new Vector3(0, 0.85f, 0.1f), new Vector3(0.45f, 0.4f, 1.1f), new Color(0.1f, 0.35f, 0.85f));
            Caja(m.transform, "Baul", new Vector3(0, 1.1f, -0.7f), new Vector3(0.5f, 0.35f, 0.45f), new Color(0.1f, 0.1f, 0.1f));
            Caja(m.transform, "Parabrisas", new Vector3(0, 1.3f, 0.65f), new Vector3(0.4f, 0.4f, 0.04f), new Color(0.7f, 0.8f, 0.9f));
            foreach (float z in new[] { 0.7f, -0.6f }) { var w = GameObject.CreatePrimitive(PrimitiveType.Cylinder); w.transform.SetParent(m.transform, false); w.transform.localPosition = new Vector3(0, 0.33f, z); w.transform.localRotation = Quaternion.Euler(0, 0, 90); w.transform.localScale = new Vector3(0.66f, 0.07f, 0.66f); w.GetComponent<Renderer>().material = new Material(mat) { color = Color.black }; }
        }
        static AudioClip Pitido()
        {
            int f = 22050, n = f / 3; var d = new float[n];
            for (int i = 0; i < n; i++) d[i] = Mathf.Sin(2 * Mathf.PI * 1800 * i / f) * 0.3f * (i < n - 200 ? 1 : (n - i) / 200f);
            var c = AudioClip.Create("pitido", n, 1, f, false); c.SetData(d, 0); return c;
        }
    }
}

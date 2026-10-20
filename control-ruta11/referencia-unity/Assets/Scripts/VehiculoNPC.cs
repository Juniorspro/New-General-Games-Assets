// ════════════════════════════════════════════════════════════════════════
// VehiculoNPC: el auto que llega al control. Se maneja solo por la ruta,
// frena en los conos, abre el baúl y se va (o queda secuestrado).
// Si no hay un prefab asignado, se arma con primitivas low-poly.
// ════════════════════════════════════════════════════════════════════════
using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace Ruta11
{
    public class VehiculoNPC : MonoBehaviour
    {
        public PerfilConductor perfil;
        public Transform asientoConductor, tapaBaul, interiorBaul;
        public Light[] faros;
        public Renderer[] farosMalla;
        public GameObject cinturon;
        public readonly List<GameObject> objetosBaul = new List<GameObject>();
        public bool baulAbierto;
        public float velocidad = 9f;

        Coroutine viaje;

        // ── armado con primitivas (reemplazable por un prefab de la Asset Store) ──
        public static VehiculoNPC Crear(PerfilConductor p, Material mat)
        {
            var go = new GameObject("Vehiculo " + p.patente);
            var v = go.AddComponent<VehiculoNPC>();
            v.perfil = p;
            bool moto = p.tipo == TipoVehiculo.Moto, camion = p.tipo == TipoVehiculo.Camion, camioneta = p.tipo == TipoVehiculo.Camioneta;
            float largo = moto ? 1.9f : camion ? 7.5f : camioneta ? 5.2f : 4.2f, ancho = moto ? 0.6f : camion ? 2.4f : 1.8f;
            Color pintura = p.colorAuto;
            if (moto)
            {
                Caja(go.transform, "Chasis", new Vector3(0, 0.6f, 0), new Vector3(0.3f, 0.35f, 1.5f), pintura, mat);
                Rueda(go.transform, new Vector3(0, 0.33f, 0.7f), 0.33f, 0.12f, mat); Rueda(go.transform, new Vector3(0, 0.33f, -0.7f), 0.33f, 0.12f, mat);
                v.asientoConductor = Vacio(go.transform, "Asiento", new Vector3(0, 0.55f, -0.1f));
            }
            else
            {
                Caja(go.transform, "Carroceria", new Vector3(0, 0.75f, 0), new Vector3(ancho, 0.7f, largo), pintura, mat);
                float zCabina = camion ? largo * 0.35f : camioneta ? largo * 0.12f : 0f, lCabina = camion ? 2f : camioneta ? 2.2f : 2.3f;
                Caja(go.transform, "Cabina", new Vector3(0, 1.45f, zCabina), new Vector3(ancho * 0.94f, 0.7f, lCabina), pintura, mat);
                Caja(go.transform, "Vidrios", new Vector3(0, 1.48f, zCabina), new Vector3(ancho * 0.96f, 0.5f, lCabina * 0.9f), new Color(0.15f, 0.2f, 0.25f), mat);
                float r = camion ? 0.5f : 0.36f;
                foreach (var z in new[] { largo * 0.33f, -largo * 0.33f }) foreach (var x in new[] { -ancho / 2, ancho / 2 }) Rueda(go.transform, new Vector3(x, r, z), r, 0.28f, mat);
                v.asientoConductor = Vacio(go.transform, "Asiento", new Vector3(-ancho * 0.22f, 0.95f, zCabina));
                // Baúl (o caja de la camioneta) con tapa que se abre hacia arriba.
                v.tapaBaul = Vacio(go.transform, "TapaBaul", new Vector3(0, 1.12f, -largo * 0.5f + 1.1f));
                Caja(v.tapaBaul, "Tapa", new Vector3(0, 0, -0.5f), new Vector3(ancho * 0.9f, 0.06f, 1.0f), pintura * 0.95f, mat);
                v.interiorBaul = Vacio(go.transform, "InteriorBaul", new Vector3(0, 0.95f, -largo * 0.5f + 0.6f));
            }
            // Faros: si están quemados, no prenden (se ve a la noche y con la linterna).
            var fs = new List<Light>(); var fm = new List<Renderer>();
            foreach (var x in moto ? new[] { 0f } : new[] { -ancho * 0.35f, ancho * 0.35f })
            {
                var faro = Caja(go.transform, "Faro", new Vector3(x, moto ? 0.85f : 0.8f, largo / 2 + 0.01f), new Vector3(0.28f, 0.14f, 0.04f), Color.white, mat);
                fm.Add(faro.GetComponent<Renderer>());
                var l = new GameObject("Luz").AddComponent<Light>(); l.transform.SetParent(faro.transform, false); l.type = LightType.Spot; l.range = 25; l.spotAngle = 60; l.intensity = 2.2f; l.color = new Color(1f, 0.95f, 0.85f);
                fs.Add(l);
            }
            v.faros = fs.ToArray(); v.farosMalla = fm.ToArray();
            // Patentes adelante y atrás.
            Patente(go.transform, p.patente, new Vector3(0, 0.5f, largo / 2 + 0.03f), 0);
            Patente(go.transform, p.patente, new Vector3(0, 0.5f, -largo / 2 - 0.03f), 180);
            v.PonerLuces(!p.lucesQuemadas);
            v.CargarBaul(mat);
            return v;
        }
        static GameObject Caja(Transform padre, string n, Vector3 pos, Vector3 esc, Color c, Material mat)
        {
            var g = GameObject.CreatePrimitive(PrimitiveType.Cube); g.name = n; g.transform.SetParent(padre, false); g.transform.localPosition = pos; g.transform.localScale = esc;
            var r = g.GetComponent<Renderer>(); r.material = new Material(mat) { color = c };
            return g;
        }
        static void Rueda(Transform padre, Vector3 pos, float radio, float ancho, Material mat)
        {
            var g = GameObject.CreatePrimitive(PrimitiveType.Cylinder); g.name = "Rueda"; g.transform.SetParent(padre, false); g.transform.localPosition = pos;
            g.transform.localRotation = Quaternion.Euler(0, 0, 90); g.transform.localScale = new Vector3(radio * 2, ancho / 2, radio * 2);
            g.GetComponent<Renderer>().material = new Material(mat) { color = new Color(0.08f, 0.08f, 0.08f) };
            UnityEngine.Object.Destroy(g.GetComponent<Collider>());
        }
        static Transform Vacio(Transform padre, string n, Vector3 pos) { var t = new GameObject(n).transform; t.SetParent(padre, false); t.localPosition = pos; return t; }
        static void Patente(Transform padre, string texto, Vector3 pos, float rotY)
        {
            var g = new GameObject("Patente"); g.transform.SetParent(padre, false); g.transform.localPosition = pos; g.transform.localRotation = Quaternion.Euler(0, rotY, 0);
            var fondo = GameObject.CreatePrimitive(PrimitiveType.Quad); fondo.transform.SetParent(g.transform, false); fondo.transform.localScale = new Vector3(0.5f, 0.14f, 1); fondo.transform.localRotation = Quaternion.Euler(0, 180, 0);
            UnityEngine.Object.Destroy(fondo.GetComponent<Collider>());
            var tm = new GameObject("Texto").AddComponent<TextMesh>(); tm.transform.SetParent(g.transform, false); tm.transform.localPosition = new Vector3(0, 0, 0.005f); tm.transform.localRotation = Quaternion.Euler(0, 180, 0);
            tm.text = texto; tm.characterSize = 0.018f; tm.fontSize = 80; tm.anchor = TextAnchor.MiddleCenter; tm.color = Color.black;
        }

        void CargarBaul(Material mat)
        {
            if (interiorBaul == null) return;
            int i = 0;
            foreach (var o in perfil.baul)
            {
                // Lo escondido va abajo y atrás de lo demás.
                var pos = new Vector3((i % 3 - 1) * 0.45f, o.escondido ? 0.02f : 0.12f + (i / 3) * 0.2f, o.escondido ? -0.35f : 0.1f);
                var g = Caja(interiorBaul, o.nombre, pos, o.tamanio, o.color, mat);
                g.AddComponent<ObjetoInspeccionable>().objeto = o;
                g.SetActive(!o.escondido);
                objetosBaul.Add(g); i++;
            }
        }

        public void PonerLuces(bool prendidas)
        {
            bool funcionan = !perfil.lucesQuemadas;
            foreach (var l in faros) l.enabled = prendidas && funcionan;
            foreach (var r in farosMalla) r.material.color = prendidas && funcionan ? new Color(1f, 0.97f, 0.8f) : new Color(0.25f, 0.25f, 0.25f);
        }
        public void MostrarCinturon(GameObject prefabCinturon) { cinturon = prefabCinturon; if (cinturon) cinturon.SetActive(!perfil.sinCinturon); }
        public Vector3 PuertaConductor() => transform.TransformPoint(new Vector3(-1.6f, 0f, 0.3f));
        public Vector3 PuntoBaul() => interiorBaul ? interiorBaul.position : transform.position - transform.forward * 2f;

        // ── manejo: línea recta por la ruta, frenando suave al llegar ──
        public void IrA(Vector3 destino, Action alLlegar = null)
        {
            if (viaje != null) StopCoroutine(viaje);
            viaje = StartCoroutine(Manejar(destino, alLlegar));
        }
        IEnumerator Manejar(Vector3 destino, Action alLlegar)
        {
            float v = velocidad;
            while (true)
            {
                Vector3 d = destino - transform.position; d.y = 0;
                float dist = d.magnitude;
                if (dist < 0.08f) break;
                v = Mathf.Min(velocidad, Mathf.Max(1.2f, dist * 0.9f));
                transform.position += d.normalized * Mathf.Min(dist, v * Time.deltaTime);
                transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(d.normalized), Time.deltaTime * 3f);
                yield return null;
            }
            viaje = null;
            alLlegar?.Invoke();
        }
        public void Irse(Vector3 salida) { CerrarBaul(); IrA(salida, () => Destroy(gameObject, 0.1f)); }

        public void AbrirBaul() { if (tapaBaul == null) return; baulAbierto = true; StartCoroutine(RotarTapa(-75f)); }
        public void CerrarBaul() { if (tapaBaul == null || !baulAbierto) return; baulAbierto = false; StartCoroutine(RotarTapa(0f)); }
        IEnumerator RotarTapa(float angulo)
        {
            Quaternion a = tapaBaul.localRotation, b = Quaternion.Euler(angulo, 0, 0);
            for (float t = 0; t < 1f; t += Time.deltaTime * 2f) { tapaBaul.localRotation = Quaternion.Slerp(a, b, t); yield return null; }
            tapaBaul.localRotation = b;
        }

        // Revisar con la linterna: lo escondido aparece con cierta chance por cada pasada.
        public List<ObjetoBaul> Inspeccionar(System.Random azar, float chanceEscondido)
        {
            var hallados = new List<ObjetoBaul>();
            foreach (var g in objetosBaul)
            {
                var o = g.GetComponent<ObjetoInspeccionable>().objeto;
                if (!g.activeSelf && azar.NextDouble() < chanceEscondido) g.SetActive(true);
                if (g.activeSelf) hallados.Add(o);
            }
            return hallados;
        }
    }

    public class ObjetoInspeccionable : MonoBehaviour { public ObjetoBaul objeto; }
}

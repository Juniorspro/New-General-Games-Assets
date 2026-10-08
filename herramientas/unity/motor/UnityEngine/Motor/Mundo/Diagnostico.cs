using System;
using System.Linq;
using System.Text;
using UnityEngine;

namespace Porteo
{
    // Para entender una captura sin depurador: lo que hay en la escena, en texto. Lo usan la prueba
    // de consola y la página (?diag=jerarquia:FPSCamera;cerca:6 después de que llegó la partida).
    public static class Diagnostico
    {
        public static string Correr(string comando)
        {
            var partes = comando.Split(new[] { ':' }, 2);
            var arg = partes.Length > 1 ? partes[1] : "";
            try
            {
                switch (partes[0])
                {
                    case "jerarquia": return Jerarquia(arg);
                    case "cerca": return Cerca(float.TryParse(arg, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var r) ? r : 6);
                    case "camaras": return Camaras();
                    case "disco": return Disco(arg.Length > 0 ? arg : Plataforma.RutaPersistente);
                    case "zonas": return Zonas();
                    case "objetos": return Objetos(arg);
                    case "punto": return Punto(arg);
                    case "tiempo": return $"tiempo: t={Time.time:F2} escala={Time.timeScale} cuadro={Time.frameCount} real={Time.realtimeSinceStartup:F1} cultura={System.Globalization.CultureInfo.CurrentCulture.Name}";
                    default: return "diagnóstico: no sé " + partes[0];
                }
            }
            catch (Exception e) { return "diagnóstico: " + e; }
        }

        // los archivos guardados (las partidas y la configuración del juego)
        public static string Disco(string raiz)
        {
            if (!System.IO.Directory.Exists(raiz)) return "disco: no existe " + raiz;
            var sb = new StringBuilder("disco " + raiz + ":");
            foreach (var f in System.IO.Directory.EnumerateFiles(raiz, "*", System.IO.SearchOption.AllDirectories))
            {
                var fi = new System.IO.FileInfo(f);
                sb.Append($"\n   {f} {fi.Length} B {fi.LastWriteTimeUtc:HH:mm:ss}");
            }
            return sb.ToString();
        }

        // las zonas del mundo (las raíces "zone...") con el centro y el tamaño de lo que dibujan
        public static string Zonas()
        {
            var sb = new StringBuilder("zonas:");
            foreach (var t in Resources.FindObjectsOfTypeAll<Transform>())
            {
                if (t.parent != null || !t.gameObject.scene.IsValid() || !t.name.StartsWith("zone")) continue;
                bool hay = false; Bounds b = default; int n = 0;
                var xs = new System.Collections.Generic.List<float>(); var zs = new System.Collections.Generic.List<float>(); var ys = new System.Collections.Generic.List<float>();
                foreach (var r in t.GetComponentsInChildren<Renderer>(true))
                {
                    if (!hay) { b = r.bounds; hay = true; } else b.Encapsulate(r.bounds);
                    n++;
                    // la mediana de los centros: los límites totales se los llevan el cielo y el mar
                    var c = r.bounds.center; xs.Add(c.x); ys.Add(c.y); zs.Add(c.z);
                }
                xs.Sort(); ys.Sort(); zs.Sort();
                var med = n > 0 ? new Vector3(xs[n / 2], ys[n / 2], zs[n / 2]) : Vector3.zero;
                sb.Append($"\n   {t.name} activo={t.gameObject.activeSelf} renderers={n} mediana={med} centro={b.center} tamaño={b.size}");
            }
            return sb.ToString();
        }

        // objetos:FILTRO[:COMPONENTE]: los GameObjects cuyo nombre contiene FILTRO (activos o no), con
        // su estado físico; con COMPONENTE, también los campos de ese componente (el estado de un
        // script del juego, sin depurador)
        public static string Objetos(string arg)
        {
            var partes = arg.Split(':');
            var filtro = partes[0];
            var comp = partes.Length > 1 ? partes[1] : null;
            var sb = new StringBuilder("objetos " + arg + ":");
            int n = 0;
            foreach (var go in Resources.FindObjectsOfTypeAll<GameObject>())
            {
                if (!go.scene.IsValid() || go.name.IndexOf(filtro, StringComparison.OrdinalIgnoreCase) < 0) continue;
                if (++n > 40) { sb.Append("\n   ..."); break; }
                sb.Append($"\n   {Ruta(go.transform)} activo={go.activeSelf}/{go.activeInHierarchy} en {go.transform.position}");
                var rb = go.GetComponent<Rigidbody>();
                if (rb != null)
                {
                    sb.Append($" rb(cinemático={rb.isKinematic} durmiendo={rb.IsSleeping()} vel={rb.velocity})");
                    // lo que tiene abajo (si se está cayendo: ¿hay suelo y no lo frena, o no hay?)
                    var abajo = Physics.RaycastAll(go.transform.position + Vector3.up * 0.5f, Vector3.down, 60, Physics.AllLayers, QueryTriggerInteraction.Collide);
                    System.Array.Sort(abajo, (x, y) => x.distance.CompareTo(y.distance));
                    for (int i = 0; i < abajo.Length && i < 3; i++)
                        if (abajo[i].collider.gameObject != go)
                            sb.Append($"\n      abajo {abajo[i].distance:F2} m: {Ruta(abajo[i].collider.transform)} [{abajo[i].collider.GetType().Name} capa={abajo[i].collider.gameObject.layer}{(abajo[i].collider.isTrigger ? " trigger" : "")}] (mi capa {go.layer}, chocan={!Physics.GetIgnoreLayerCollision(go.layer, abajo[i].collider.gameObject.layer)})");
                }
                foreach (var c in go.GetComponents<Collider>()) sb.Append($" {c.GetType().Name}({(c.enabled ? "sí" : "no")}{(c.isTrigger ? ",trigger" : "")})");
                if (comp == null) continue;
                foreach (var c in go.GetComponents<Component>())
                {
                    if (c == null || c.GetType().Name != comp) continue;
                    for (var t = c.GetType(); t != null && t != typeof(MonoBehaviour); t = t.BaseType)
                        foreach (var f in t.GetFields(System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.DeclaredOnly))
                        {
                            var v = f.GetValue(c);
                            var texto = v is System.Collections.ICollection col ? $"[{col.Count}]" : v?.ToString();
                            sb.Append($"\n      {f.Name}={texto}");
                        }
                }
            }
            return sb.ToString();
        }

        // punto:x,z: lo que hay en esa vertical (renderers y colisionadores, activos o no): qué suelo
        // tendría que estar y si su colisionador está en la física
        public static string Punto(string arg)
        {
            var v = arg.Split(',');
            float x = float.Parse(v[0], System.Globalization.CultureInfo.InvariantCulture);
            float z = float.Parse(v[1], System.Globalization.CultureInfo.InvariantCulture);
            var sb = new StringBuilder($"punto {x},{z}:");
            int n = 0;
            foreach (var r in Resources.FindObjectsOfTypeAll<Renderer>())
            {
                if (!r.gameObject.scene.IsValid() || r is ParticleSystemRenderer) continue;
                var b = r.bounds;
                if (x < b.min.x || x > b.max.x || z < b.min.z || z > b.max.z || b.size.x > 2000) continue;
                if (++n > 30) { sb.Append("\n   ..."); break; }
                var cols = string.Join(",", r.GetComponents<Collider>().Select(c => $"{c.GetType().Name}({(c.enabled ? "sí" : "no")})"));
                sb.Append($"\n   {Ruta(r.transform)} activo={r.gameObject.activeInHierarchy} y={b.min.y:F1}..{b.max.y:F1} [{cols}]");
            }
            foreach (var c in Resources.FindObjectsOfTypeAll<Collider>())
            {
                if (!c.gameObject.scene.IsValid() || c.GetComponent<Renderer>() != null) continue;
                var b = c.bounds;
                if (b.size == Vector3.zero || x < b.min.x || x > b.max.x || z < b.min.z || z > b.max.z || b.size.x > 2000) continue;
                if (++n > 50) { sb.Append("\n   ..."); break; }
                sb.Append($"\n   colisionador {Ruta(c.transform)} {c.GetType().Name} activo={c.gameObject.activeInHierarchy} habilitado={c.enabled} trigger={c.isTrigger} y={b.min.y:F1}..{b.max.y:F1}");
            }
            foreach (var t in Resources.FindObjectsOfTypeAll<Terrain>())
                if (t.gameObject.scene.IsValid())
                    sb.Append($"\n   terreno {Ruta(t.transform)} activo={t.gameObject.activeInHierarchy} en {t.transform.position} tamaño={t.terrainData?.size}");
            return sb.ToString();
        }

        public static string Ruta(Transform t) => t.parent == null ? t.name : Ruta(t.parent) + "/" + t.name;

        static Transform Buscar(string nombre) =>
            Resources.FindObjectsOfTypeAll<Transform>().Where(t => t.gameObject.scene.IsValid())
                .OrderByDescending(t => t.gameObject.activeInHierarchy).FirstOrDefault(t => t.name == nombre);

        public static string Jerarquia(string nombre)
        {
            var raiz = Buscar(nombre);
            if (raiz == null) return "jerarquia: no está " + nombre;
            var sb = new StringBuilder();
            void Arbol(Transform t, string sangria)
            {
                var comps = string.Join(",", t.GetComponents<Component>().Select(c => c.GetType().Name).Where(n => n != "Transform"));
                sb.Append($"\njerarquia {sangria}{t.name} activo={t.gameObject.activeSelf} local={t.localPosition} rot={t.localEulerAngles} esc={t.localScale} mundo={t.position} capa={t.gameObject.layer} [{comps}]");
                if (sangria.Length < 16) foreach (Transform h in t) Arbol(h, sangria + "  ");
            }
            Arbol(raiz, "");
            return sb.ToString();
        }

        public static string Cerca(float radio)
        {
            var cam = Camera.main;
            if (cam == null) return "cerca: no hay cámara principal";
            var sb = new StringBuilder($"cerca: cámara {cam.name} en {cam.transform.position}");
            foreach (var r in UnityEngine.Object.FindObjectsOfType<Renderer>())
            {
                if (!r.enabled) continue;
                float d = Vector3.Distance(r.bounds.center, cam.transform.position);
                if (d > radio) continue;
                var mats = string.Join(", ", r.sharedMaterials.Select(m => m == null ? "null" : $"{m.name} [{m.shader?.name}] cola={m.renderQueue}"));
                sb.Append($"\n   {r.GetType().Name} {Ruta(r.transform)} d={d:F1} límites={r.bounds.size} capa={r.gameObject.layer} :: {mats}");
            }
            return sb.ToString();
        }

        public static string Camaras()
        {
            var sb = new StringBuilder("cámaras:");
            foreach (var c in Camera.allCameras)
                sb.Append($"\n   {Ruta(c.transform)} prof={c.depth} máscara={c.cullingMask:X8} borrar={c.clearFlags} cerca={c.nearClipPlane} lejos={c.farClipPlane} fov={c.fieldOfView} destino={c.targetTexture?.name} en {c.transform.position}");
            return sb.ToString();
        }
    }
}

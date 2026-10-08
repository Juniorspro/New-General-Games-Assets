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
                    case "tiempo": return $"tiempo: t={Time.time:F2} escala={Time.timeScale} cuadro={Time.frameCount} real={Time.realtimeSinceStartup:F1} cultura={System.Globalization.CultureInfo.CurrentCulture.Name}";
                    default: return "diagnóstico: no sé " + partes[0];
                }
            }
            catch (Exception e) { return "diagnóstico: " + e; }
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

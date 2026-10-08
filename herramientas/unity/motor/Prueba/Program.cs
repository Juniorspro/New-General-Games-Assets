using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using Porteo;
using UnityEngine;

// porteo: prueba del motor en consola. DATOS es la salida de exportar/exportar.py.
var datos = args.Length > 0 ? args[0] : "/tmp/claude-0/slime/datos-motor-todo";
int escena = args.Length > 1 && int.TryParse(args[1], out var e0) ? e0 : 0;
int cuadros = args.Length > 2 ? int.Parse(args[2]) : 300;

Anfitrion.LeerPaquete = n =>
{
    var f = Path.Combine(datos, "paquetes", n + ".paq");
    return File.Exists(f) ? File.ReadAllBytes(f) : null;
};
Anfitrion.LeerRecurso = id => File.ReadAllBytes(Path.Combine(datos, "recursos", id + ".bin"));
Anfitrion.Consola = (t, tipo) => Console.WriteLine((tipo == LogType.Log ? "" : "[" + tipo + "] ") + t);

var indice = JsonDocument.Parse(File.ReadAllText(Path.Combine(datos, "indice.json")));
var escenas = indice.RootElement.GetProperty("escenas").EnumerateArray().Select(e => e.GetString()).ToArray();

// "alcance": cuánto hay que traer para cada escena y para lo que se pide en cualquier momento
if (args.Length > 1 && args[1] == "alcance")
{
    var tam = indice.RootElement.GetProperty("recursos").EnumerateArray().Select(r => r.GetProperty("bytes").GetInt64()).ToArray();
    string Mb(System.Collections.Generic.IEnumerable<int> ids) { var l = ids.ToList(); return $"{l.Count} recursos, {l.Sum(i => tam[i]) / 1e6:F1} MB"; }
    Porteo.Datos.Ajustes.Cargar();
    var r0 = Stopwatch.StartNew();
    var siempre = Porteo.Datos.Alcance.Recursos(Porteo.Datos.Ajustes.Siempre());
    Console.WriteLine($"siempre: {Mb(siempre)} ({r0.ElapsedMilliseconds} ms)");
    for (int i = 0; i < escenas.Length; i++)
    {
        r0.Restart();
        var e = Porteo.Datos.Alcance.DeArchivo(Porteo.Datos.Cargador.Archivo("level" + i));
        Console.WriteLine($"{escenas[i]}: {Mb(e)}; sin lo de siempre: {Mb(e.Except(siempre))} ({r0.ElapsedMilliseconds} ms)");
    }
    return;
}

var reloj = Stopwatch.StartNew();
Porteo.Motor.Iniciar(escenas, escena);
Console.WriteLine($"porteo: arranque en {reloj.ElapsedMilliseconds} ms");
reloj.Restart();
for (int i = 0; i < cuadros; i++) Mundo.Cuadro(1 / 60.0);
Console.WriteLine($"porteo: {cuadros} cuadros en {reloj.ElapsedMilliseconds} ms; t={Time.time:F2}; activa: {UnityEngine.SceneManagement.SceneManager.GetActiveScene().name}");
// "diag": qué ve cada cámara (los objetos que más pantalla ocupan), para entender una captura
if (args.Contains("diag"))
{
    foreach (var cam in Camera.allCameras)
    {
        var t = cam.transform;
        Console.WriteLine($"cámara {cam.name} prof={cam.depth} pos={t.position} rot={t.rotation.eulerAngles} fov={cam.fieldOfView} máscara={cam.cullingMask:X} habilitada={cam.isActiveAndEnabled}");
        var vp = cam.projectionMatrix * cam.worldToCameraMatrix;
        var lista = new System.Collections.Generic.List<(float area, string nombre)>();
        foreach (var r in UnityEngine.Object.FindObjectsOfType<Renderer>())
        {
            if (!r.enabled || !r.gameObject.activeInHierarchy || (cam.cullingMask & (1 << r.gameObject.layer)) == 0) continue;
            if (args.Contains("transparentes") && !r.sharedMaterials.Any(m => m != null && m.renderQueue > 2500)) continue;
            var b = r.bounds;
            float x0 = 1e9f, y0 = 1e9f, x1 = -1e9f, y1 = -1e9f; bool detras = false, alguno = false;
            for (int i = 0; i < 8; i++)
            {
                var p = b.center + Vector3.Scale(b.extents, new Vector3((i & 1) == 0 ? -1 : 1, (i & 2) == 0 ? -1 : 1, (i & 4) == 0 ? -1 : 1));
                var c = vp * new Vector4(p.x, p.y, p.z, 1);
                if (c.w <= 0.01f) { detras = true; continue; }
                alguno = true;
                float sx = c.x / c.w, sy = c.y / c.w;
                x0 = Math.Min(x0, sx); y0 = Math.Min(y0, sy); x1 = Math.Max(x1, sx); y1 = Math.Max(y1, sy);
            }
            if (!alguno) continue;
            if (detras) { x0 = -1; y0 = -1; x1 = 1; y1 = 1; }
            float ax = Math.Max(0, Math.Min(1, x1) - Math.Max(-1, x0)), ay = Math.Max(0, Math.Min(1, y1) - Math.Max(-1, y0));
            if (ax * ay <= 0) continue;
            var mats = string.Join(",", r.sharedMaterials.Select(m => m == null ? "null" : m.name + "/" + (m.shader != null ? m.shader.name : "?")));
            lista.Add((ax * ay / 4, $"{r.GetType().Name} {r.name} centro={b.center} tam={b.size} {(detras ? "(rodea la cámara) " : "")}[{mats}]"));
        }
        foreach (var x in lista.OrderByDescending(x => x.area).Take(25)) Console.WriteLine($"   {x.area * 100,5:F1}% {x.nombre}");
    }
}
if (args.Contains("diag"))
{
    int k = 0;
    foreach (var go in UnityEngine.Object.FindObjectsOfType<Transform>())
    {
        if (go.name != "prefab_slimeBase" || k++ > 12) continue;
        var rb = go.GetComponent<Rigidbody>();
        Console.WriteLine($"slime {go.position} activo={go.gameObject.activeInHierarchy} rb={(rb != null ? $"cin={rb.isKinematic} vel={rb.velocity} dormido={rb.IsSleeping()}" : "no")}");
    }
}
if (args.Contains("diag"))
{
    // un mapa de lo que ve la cámara principal: rayos de física por una grilla de la pantalla
    var cam = Camera.allCameras.FirstOrDefault(c => c.name == "FPSCamera") ?? Camera.main;
    var letras = new System.Collections.Generic.Dictionary<string, char>();
    const string abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (int fy = 17; fy >= 0; fy--)
    {
        var sb = new System.Text.StringBuilder();
        for (int fx = 0; fx < 64; fx++)
        {
            var ray = cam.ViewportPointToRay(new Vector3((fx + 0.5f) / 64f, (fy + 0.5f) / 18f, 0));
            if (Physics.Raycast(ray, out var hit, 5000f))
            {
                var n = hit.collider.name;
                if (!letras.TryGetValue(n, out var ch)) letras[n] = ch = abc[Math.Min(letras.Count, abc.Length - 1)];
                sb.Append(ch);
            }
            else sb.Append('.');
        }
        Console.WriteLine("mapa " + sb);
    }
    foreach (var kv in letras) Console.WriteLine($"mapa {kv.Value} = {kv.Key}");
}
if (args.Contains("diag"))
{
    int k = 0;
    foreach (var a in UnityEngine.Object.FindObjectsOfType<Animator>())
    {
        if (k++ > 8) break;
        var info = a.GetCurrentAnimatorStateInfo(0);
        Transform hueso = a.transform;
        foreach (var t in a.GetComponentsInChildren<Transform>()) if (t.name == "bone_slime" || t.name == "Spine01J") { hueso = t; break; }
        Console.WriteLine($"animador {a.name} ctrl={(a.runtimeAnimatorController != null ? a.runtimeAnimatorController.name : "-")} init={a.isInitialized} estado={info.shortNameHash} t={info.normalizedTime:F2} largo={info.length:F2} hueso {hueso.name} rot={hueso.localRotation.eulerAngles} pos={hueso.localPosition}");
    }
}
if (args.Contains("slime"))
{
    var go = UnityEngine.Object.FindObjectsOfType<Transform>().FirstOrDefault(t => t.name.StartsWith("slimePink"))?.gameObject;
    Console.WriteLine("slime-go " + (go != null ? go.name : "ninguno"));
    if (go != null)
        foreach (var r in go.GetComponentsInChildren<Renderer>(true))
        {
            Console.WriteLine($"slime-r {r.GetType().Name} {r.name} activo={r.gameObject.activeInHierarchy} hab={r.enabled}");
            foreach (var m in r.sharedMaterials)
                if (m != null) Console.WriteLine($"   mat {m.name} shader={m.shader?.name} cola={m.renderQueue} claves=[{string.Join(",", m.shaderKeywords)}]");
            var b = new MaterialPropertyBlock(); r.GetPropertyBlock(b);
            Console.WriteLine($"   bloque vacío={b.isEmpty}");
        }
}
var faltan = Porteo.Falta.Vistos.ToList();
Console.WriteLine($"porteo: {faltan.Count} miembros sin hacer usados:");
foreach (var f in faltan) Console.WriteLine("  " + f);

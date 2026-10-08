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
if (args.Contains("slime") || args.Contains("objeto"))
{
    // "objeto NOMBRE": los renderers y materiales del primer GameObject cuyo nombre empieza así
    var prefijo = args.Contains("objeto") ? args[Array.IndexOf(args, "objeto") + 1] : "slimePink";
    var go = UnityEngine.Object.FindObjectsOfType<Transform>().FirstOrDefault(t => t.name.StartsWith(prefijo))?.gameObject;
    Console.WriteLine("slime-go " + (go != null ? go.name : "ninguno"));
    var anim = go != null ? go.GetComponent<Animator>() : null;
    if (anim != null)
    {
        var info = anim.GetCurrentAnimatorStateInfo(0);
        Console.WriteLine($"animador humano={anim.isHuman} escala={anim.humanScale} raizMov={anim.applyRootMotion} estado={info.shortNameHash} t={info.normalizedTime:F2}");
        foreach (var t in go.GetComponentsInChildren<Transform>(true))
            if (new[] { "ROOTJ", "lAnkleJ", "rAnkleJ", "lBallJ", "rBallJ", "lWristJ", "rWristJ", "HeadJ", "lElbowJ" }.Contains(t.name))
                Console.WriteLine($"   hueso {t.name,-8} rel={go.transform.InverseTransformPoint(t.position)} rotLocal={t.localRotation.eulerAngles}");
    }
    if (go != null)
        foreach (var r in go.GetComponentsInChildren<Renderer>(true))
        {
            Console.WriteLine($"slime-r {r.GetType().Name} {r.name} activo={r.gameObject.activeInHierarchy} hab={r.enabled}");
            foreach (var m in r.sharedMaterials)
                if (m != null)
                {
                    Console.WriteLine($"   mat {m.name} shader={m.shader?.name} cola={m.renderQueue} claves=[{string.Join(",", m.shaderKeywords)}]");
                    foreach (var p in new[] { "_MainTex", "_BumpMap", "_EmissionMap", "_MetallicGlossMap", "_OcclusionMap", "_DetailAlbedoMap", "_DetailNormalMap", "_ParallaxMap", "_DetailMask" })
                        if (m.HasProperty(p) && m.GetTexture(p) is Texture t)
                            Console.WriteLine($"      {p} = {t.name} {t.width}x{t.height} {(t is Texture2D t2 ? t2.format.ToString() : t.GetType().Name)}");
                    foreach (var p in new[] { "_Color", "_EmissionColor", "_SpecColor" })
                        if (m.HasProperty(p)) Console.WriteLine($"      {p} = {m.GetColor(p)}");
                    foreach (var p in new[] { "_Glossiness", "_GlossMapScale", "_Metallic", "_BumpScale", "_OcclusionStrength", "_Mode", "_Cutoff", "_SmoothnessTextureChannel", "_SpecularHighlights", "_GlossyReflections" })
                        if (m.HasProperty(p)) Console.WriteLine($"      {p} = {m.GetFloat(p)}");
                }
            var b = new MaterialPropertyBlock(); r.GetPropertyBlock(b);
            Console.WriteLine($"   bloque vacío={b.isEmpty}");
            // la malla: si el orden de los triángulos coincide con las normales y si miran hacia afuera
            var mf = r.GetComponent<MeshFilter>();
            var malla = mf != null ? mf.sharedMesh : (r as SkinnedMeshRenderer)?.sharedMesh;
            if (malla != null)
            {
                var vs = malla.vertices; var ns = malla.normals; var ts = malla.triangles;
                var centro = malla.bounds.center;
                int coinciden = 0, afuera = 0, total = 0;
                for (int i = 0; i + 2 < ts.Length; i += 3)
                {
                    Vector3 a = vs[ts[i]], b2 = vs[ts[i + 1]], c = vs[ts[i + 2]];
                    var g = Vector3.Cross(b2 - a, c - a);
                    if (g.sqrMagnitude < 1e-12f) continue;
                    total++;
                    if (ns.Length == vs.Length && Vector3.Dot(g, ns[ts[i]] + ns[ts[i + 1]] + ns[ts[i + 2]]) > 0) coinciden++;
                    if (Vector3.Dot(g, (a + b2 + c) / 3 - centro) > 0) afuera++;
                }
                Console.WriteLine($"   malla {malla.name} vértices={vs.Length} triángulos={total} orden=normales {coinciden} caras afuera {afuera} escala={r.transform.lossyScale}");
            }
        }
}
if (args.Contains("textura"))
{
    var nombre = args[Array.IndexOf(args, "textura") + 1];
    var tex = Resources.FindObjectsOfTypeAll<Texture2D>().FirstOrDefault(t => t.name == nombre);
    if (tex == null) Console.WriteLine("textura: no está " + nombre);
    else
    {
        var px = tex.GetPixels32();
        int opacos = px.Count(c => c.a >= 128);
        Console.WriteLine($"textura {nombre} {tex.width}x{tex.height} formato={tex.format} opacos={opacos * 100.0 / px.Length:F1}%");
        // PPM con el alfa como gris al lado del color
        using var f = File.Create($"/tmp/claude-0/slime/anim/{nombre}.ppm");
        var cab = System.Text.Encoding.ASCII.GetBytes($"P6 {tex.width * 2} {tex.height} 255\n");
        f.Write(cab);
        for (int y = tex.height - 1; y >= 0; y--)
        {
            for (int x = 0; x < tex.width; x++) { var c = px[y * tex.width + x]; f.WriteByte(c.r); f.WriteByte(c.g); f.WriteByte(c.b); }
            for (int x = 0; x < tex.width; x++) { var c = px[y * tex.width + x]; f.WriteByte(c.a); f.WriteByte(c.a); f.WriteByte(c.a); }
        }
    }
}
var faltan = Porteo.Falta.Vistos.ToList();
Console.WriteLine($"porteo: {faltan.Count} miembros sin hacer usados:");
foreach (var f in faltan) Console.WriteLine("  " + f);

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
    var todos = new System.Collections.Generic.HashSet<int>(siempre);
    for (int i = 0; i < escenas.Length; i++)
    {
        r0.Restart();
        var e = Porteo.Datos.Alcance.DeArchivo(Porteo.Datos.Cargador.Archivo("level" + i));
        Console.WriteLine($"{escenas[i]}: {Mb(e)}; sin lo de siempre: {Mb(e.Except(siempre))} ({r0.ElapsedMilliseconds} ms)");
        todos.UnionWith(e);
    }
    // lo que ninguna escena alcanza (ni lo de siempre): candidatos a no ir en el HTML único
    var nunca = Enumerable.Range(0, tam.Length).Where(i => !todos.Contains(i)).ToList();
    Console.WriteLine($"alcanzables: {Mb(todos)}; ninguna escena: {Mb(nunca)}");
    if (Environment.GetEnvironmentVariable("NUNCA") is string fn) File.WriteAllText(fn, JsonSerializer.Serialize(nunca));
    return;
}

var reloj = Stopwatch.StartNew();
Mundo.RelojSimulado = true;
Porteo.Motor.Iniciar(escenas, escena);
Console.WriteLine($"porteo: arranque en {reloj.ElapsedMilliseconds} ms");
reloj.Restart();
// "nueva": desde el menú, una partida nueva como el botón New Game (AutoSaveDirector.LoadNewGame)
bool nueva = args.Contains("nueva");
int desdeMenu = -1; bool disparada = false; int enMundo = 0;
// "guion ARCHIVO.json": entrada simulada desde que está la partida (ver la clase Guion, al final)
var guion = args.Contains("guion") ? new Guion(File.ReadAllText(args[Array.IndexOf(args, "guion") + 1])) : null;
for (int i = 0; i < cuadros; i++)
{
    Mundo.Cuadro(1 / 60.0);
    if (!nueva) continue;
    var activa = UnityEngine.SceneManagement.SceneManager.GetActiveScene().name;
    if (!disparada && activa == "MainMenu")
    {
        if (desdeMenu < 0) desdeMenu = i;
        else if (i - desdeMenu > 120) { disparada = true; NuevaPartida(); }
    }
    if (i % 300 == 0) Console.WriteLine($"porteo: cuadro {i} t={Time.time:F1} escena={activa} ({reloj.ElapsedMilliseconds} ms)");
    // "tocar X,Y,DESDE,HASTA": un dedo apretado en (X,Y) (píxeles, origen abajo a la izquierda)
    // entre esos cuadros contados desde que está la partida (para probar botones táctiles)
    if (args.Contains("tocar") && activa == "worldGenerated")
    {
        var tq = args[Array.IndexOf(args, "tocar") + 1].Split(',').Select(float.Parse).ToArray();
        enMundo++;
        if (enMundo == (int)tq[2]) Entrada.Toque(5, 0, tq[0], tq[1]);
        else if (enMundo > tq[2] && enMundo < tq[3]) Entrada.Toque(5, 1, tq[0], tq[1]);
        else if (enMundo == (int)tq[3]) Entrada.Toque(5, 3, tq[0], tq[1]);
    }
    if (guion != null && activa == "worldGenerated")
    {
        guion.Cuadro();
        if (guion.Terminado) { Console.WriteLine($"guion: terminado en el cuadro {i}"); break; }
    }
}

static void NuevaPartida()
{
    var asm = AppDomain.CurrentDomain.GetAssemblies().First(a => a.GetName().Name == "Assembly-CSharp");
    var tGc = asm.GetType("GameContext");
    var tSing = asm.GetType("SRSingleton`1").MakeGenericType(tGc);
    var gc = tSing.GetProperty("Instance").GetValue(null);
    var asd = tGc.GetField("AutoSaveDirector")?.GetValue(gc) ?? tGc.GetProperty("AutoSaveDirector")?.GetValue(gc);
    var icono = Enum.Parse(asm.GetType("Identifiable+Id"), "PINK_SLIME");
    var modo = Enum.Parse(asm.GetType("PlayerState+GameMode"), "CLASSIC");
    Console.WriteLine("porteo: nueva partida");
    asd.GetType().GetMethod("LoadNewGame").Invoke(asd, new object[] { "Prueba", icono, modo, (Action)(() => Console.WriteLine("porteo: LoadNewGame falló")) });
}
Console.WriteLine($"porteo: {cuadros} cuadros en {reloj.ElapsedMilliseconds} ms; t={Time.time:F2}; activa: {UnityEngine.SceneManagement.SceneManager.GetActiveScene().name}");
// "textos": qué componentes de texto hay (UI.Text necesita Font/TextGenerator; TMP ya anda)
if (args.Contains("textos"))
{
    var cuenta = new System.Collections.Generic.Dictionary<string, int>();
    var ejemplos = new System.Collections.Generic.List<string>();
    foreach (var c in UnityEngine.Object.FindObjectsOfType<Component>())
    {
        var n = c.GetType().FullName;
        if (n != "UnityEngine.UI.Text" && !n.StartsWith("TMPro.")) continue;
        if (!n.StartsWith("TMPro.TextMeshPro") && n != "UnityEngine.UI.Text") continue;
        cuenta[n] = (cuenta.TryGetValue(n, out var k0) ? k0 : 0) + 1;
        if (n == "UnityEngine.UI.Text" && ejemplos.Count < 25)
        {
            var f = c.GetType().GetProperty("font")?.GetValue(c) as Font;
            var txt = c.GetType().GetProperty("text")?.GetValue(c) as string;
            var raiz = c.transform; while (raiz.parent != null) raiz = raiz.parent;
            ejemplos.Add($"{c.name} activo={c.gameObject.activeInHierarchy} fuente={f?.name} pos={c.transform.position} raíz={raiz.name} \"{(txt ?? "").Replace("\n", " ").Substring(0, Math.Min(40, (txt ?? "").Length))}\"");
        }
    }
    foreach (var kv in cuenta) Console.WriteLine($"textos {kv.Key}: {kv.Value}");
    foreach (var e in ejemplos) Console.WriteLine("   " + e);
}
// "guardar": guarda la partida como el menú de pausa (SaveGame directo, para ver si falla)
if (args.Contains("guardar"))
{
    var asm = AppDomain.CurrentDomain.GetAssemblies().First(a => a.GetName().Name == "Assembly-CSharp");
    var tGc = asm.GetType("GameContext");
    var gc = asm.GetType("SRSingleton`1").MakeGenericType(tGc).GetProperty("Instance").GetValue(null);
    var asd = tGc.GetProperty("AutoSaveDirector")?.GetValue(gc) ?? tGc.GetField("AutoSaveDirector")?.GetValue(gc);
    try { asd.GetType().GetMethod("SaveGame").Invoke(asd, null); Console.WriteLine("guardar: SaveGame terminó"); }
    catch (Exception e) { Console.WriteLine("guardar: falló " + (e.InnerException ?? e)); }
    try { asd.GetType().GetMethod("SaveProfile", new[] { typeof(bool) })?.Invoke(asd, new object[] { false }); Console.WriteLine("guardar: SaveProfile terminó"); }
    catch (Exception e) { Console.WriteLine("guardar: perfil falló " + (e.InnerException ?? e)); }
    Console.WriteLine(Porteo.Diagnostico.Correr("disco"));
}
// "--diag CMD;CMD": los diagnósticos del motor (los mismos que ?diag= en la página)
if (args.Contains("--diag"))
    foreach (var c in args[Array.IndexOf(args, "--diag") + 1].Split(';')) Console.WriteLine(Porteo.Diagnostico.Correr(c));
// "particulas": el estado de los sistemas de partículas de la escena (activos o no)
if (args.Contains("particulas"))
{
    var todos = Resources.FindObjectsOfTypeAll<ParticleSystem>().Where(s => s.gameObject.scene.IsValid()).ToList();
    var activos = todos.Where(s => s.gameObject.activeInHierarchy).ToList();
    Console.WriteLine($"particulas: {todos.Count} sistemas en escena, {activos.Count} activos, {activos.Count(s => s.isPlaying)} reproduciendo, {activos.Sum(s => s.particleCount)} partículas");
    foreach (var g in activos.GroupBy(s => (s.isPlaying, s.main.playOnAwake, s.main.loop)).OrderByDescending(g => g.Count()))
        Console.WriteLine($"   reproduciendo={g.Key.isPlaying} alDespertar={g.Key.playOnAwake} bucle={g.Key.loop}: {g.Count()} ({string.Join(", ", g.Take(8).Select(s => s.name + ":" + s.particleCount + " en " + s.transform.position))})");
    foreach (var g in todos.Where(s => !s.gameObject.activeInHierarchy).GroupBy(s => s.name).OrderByDescending(g => g.Count()).Take(15))
        Console.WriteLine($"   inactivo {g.Key}: {g.Count()}");
}
// "cerca": los renderers activos a menos de 6 m de la cámara principal (qué es cada cosa en una captura)
if (args.Contains("cerca"))
{
    var cam = Camera.main;
    Console.WriteLine($"cerca: cámara {cam?.name} en {cam?.transform.position}");
    foreach (var c in Camera.allCameras)
        Console.WriteLine($"   cámara {Ruta(c.transform)} prof={c.depth} máscara={c.cullingMask:X8} borrar={c.clearFlags} cerca={c.nearClipPlane} lejos={c.farClipPlane} fov={c.fieldOfView} destino={c.targetTexture?.name} habilitada={c.enabled}");
    foreach (var r in UnityEngine.Object.FindObjectsOfType<Renderer>())
    {
        if (cam == null || !r.enabled) continue;
        float d = Vector3.Distance(r.bounds.center, cam.transform.position);
        if (d > 6) continue;
        var mats = string.Join(", ", r.sharedMaterials.Select(m => m == null ? "null" : $"{m.name} [{m.shader?.name}] cola={m.renderQueue} tex={m.mainTexture?.name}"));
        Console.WriteLine($"   {r.GetType().Name} {Ruta(r.transform)} d={d:F1} límites={r.bounds.size} capa={r.gameObject.layer} :: {mats}");
    }
}
// "jerarquia NOMBRE": el árbol de transforms del primer objeto con ese nombre (posiciones y escalas)
if (args.Contains("jerarquia"))
{
    var nombre = args[Array.IndexOf(args, "jerarquia") + 1];
    var raiz = Resources.FindObjectsOfTypeAll<Transform>().Where(t => t.gameObject.scene.IsValid()).OrderByDescending(t => t.gameObject.activeInHierarchy).FirstOrDefault(t => t.name == nombre);
    void Arbol(Transform t, string sangria)
    {
        var comps = string.Join(",", t.GetComponents<Component>().Select(c => c.GetType().Name).Where(n => n != "Transform"));
        Console.WriteLine($"{sangria}{t.name} activo={t.gameObject.activeSelf} local={t.localPosition} rot={t.localEulerAngles} esc={t.localScale} mundo={t.position} capa={t.gameObject.layer} [{comps}]");
        if (sangria.Length < 40) foreach (Transform h in t) Arbol(h, sangria + "  ");
    }
    if (raiz == null) Console.WriteLine("jerarquia: no está " + nombre); else Arbol(raiz, "jerarquia ");
}
// "hornear NOMBRE": los vértices con piel de ese SkinnedMeshRenderer (dónde quedan en el mundo)
if (args.Contains("hornear"))
{
    var nombre = args[Array.IndexOf(args, "hornear") + 1];
    var smr = Resources.FindObjectsOfTypeAll<SkinnedMeshRenderer>().FirstOrDefault(x => x.gameObject.scene.IsValid() && x.name == nombre);
    if (smr == null) Console.WriteLine("hornear: no está " + nombre);
    else
    {
        if (!smr.gameObject.activeInHierarchy) { for (var t = smr.transform; t != null; t = t.parent) t.gameObject.SetActive(true); Mundo.Cuadro(1 / 60.0); }
        var m = new Mesh();
        smr.BakeMesh(m);
        var vs = m.vertices;
        var min = Vector3.one * float.MaxValue; var max = -min;
        foreach (var v in vs) { var w = smr.transform.TransformPoint(v); min = Vector3.Min(min, w); max = Vector3.Max(max, w); }
        Console.WriteLine($"hornear {nombre}: {vs.Length} vértices, mundo de {min} a {max}; raíz={smr.rootBone?.name} huesos={smr.bones.Length} límites={smr.bounds.center}±{smr.bounds.extents}");
        var poses = smr.sharedMesh.bindposes;
        for (int i = 0; i < smr.bones.Length && i < 8; i++)
        {
            var h = smr.bones[i];
            Console.WriteLine($"   hueso {i} {h?.name} mundo={h?.position} esc={h?.lossyScale} pose={(i < poses.Length ? poses[i].GetColumn(3).ToString() : "-")}");
        }
    }
}
// "agua": las fuentes de líquido (LiquidSource) cuyo colisionador contiene a la cámara, y si el
// juego cree que la cámara está bajo el agua
if (args.Contains("agua"))
{
    var cam = Camera.main;
    var asm = AppDomain.CurrentDomain.GetAssemblies().First(a => a.GetName().Name == "Assembly-CSharp");
    var tLiq = asm.GetType("LiquidSource");
    var p0 = cam.transform.position;
    Console.WriteLine($"agua: cámara en {p0}");
    foreach (var c in Resources.FindObjectsOfTypeAll(tLiq).Cast<Component>())
    {
        if (!c.gameObject.scene.IsValid() || !c.gameObject.activeInHierarchy) continue;
        foreach (var col in c.GetComponents<Collider>())
        {
            var cp = col.ClosestPoint(p0);
            bool adentro = (cp - p0).sqrMagnitude < 1e-6f;
            if (adentro || col.bounds.Contains(p0))
                Console.WriteLine($"   {Ruta(c.transform)} {col.GetType().Name} trigger={col.isTrigger} límites={col.bounds.center}±{col.bounds.extents} adentro={adentro}");
        }
    }
    var tSc = asm.GetType("SceneContext");
    var sc = asm.GetType("SRSingleton`1").MakeGenericType(tSc).GetProperty("Instance").GetValue(null);
    var amb = tSc.GetProperty("AmbianceDirector")?.GetValue(sc) ?? tSc.GetField("AmbianceDirector")?.GetValue(sc);
    var bf = System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Public;
    Console.WriteLine($"agua: waterCount={amb?.GetType().GetField("waterCount", bf)?.GetValue(amb)} seaCount={amb?.GetType().GetField("seaCount", bf)?.GetValue(amb)} niebla={RenderSettings.fogColor} densidad={RenderSettings.fogDensity} modo={RenderSettings.fogMode} activa={RenderSettings.fog}");
}
// "tck": los controles táctiles (TouchControlsKit) con su rectángulo en pantalla
if (args.Contains("tck"))
{
    Console.WriteLine($"tck: pantalla {Screen.width}x{Screen.height}");
    foreach (var c in Resources.FindObjectsOfTypeAll<MonoBehaviour>())
    {
        var tn = c.GetType().Name;
        if (!tn.StartsWith("TCK") || !c.gameObject.scene.IsValid()) continue;
        var id = c.GetType().GetField("identifier")?.GetValue(c);
        var rt = c.transform as RectTransform;
        var esq = new Vector3[4];
        rt?.GetWorldCorners(esq);
        var canvas = c.GetComponentInParent<Canvas>();
        Console.WriteLine($"   {tn} '{id}' activo={c.gameObject.activeInHierarchy} habilitado={c.enabled} esquinas={esq[0]}..{esq[2]} canvas={canvas?.name} modo={canvas?.renderMode} ruta={Ruta(c.transform)}");
    }
}
static string Ruta(Transform t) => t.parent == null ? t.name : Ruta(t.parent) + "/" + t.name;
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
    // también los inactivos (los efectos se prenden sólo cuando se usan)
    var go = Resources.FindObjectsOfTypeAll<Transform>().Where(t => t.gameObject.scene.IsValid()).OrderByDescending(t => t.gameObject.activeInHierarchy).FirstOrDefault(t => t.name.StartsWith(prefijo))?.gameObject;
    if (go != null && !go.activeInHierarchy) { Console.WriteLine("slime-go inactivo: se prende para mirarlo"); for (var t = go.transform; t != null; t = t.parent) t.gameObject.SetActive(true); Mundo.Cuadro(1 / 60.0); }
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

// Un guion de prueba de juego: pasos de entrada cuadro a cuadro (cada cuadro, 1/60 s de juego), para
// probar aspirar, disparar, comprar o guardar sin dibujar (la consola anda decenas de veces más
// rápido que el navegador con GL por software). Cada paso dura "cuadros" (1 si no dice) y puede
// juntar varias cosas a la vez:
//   {"cuadros":300}                     esperar
//   {"tecla":"W","cuadros":120}         una tecla (o varias: ["W","LeftShift"]) apretada esos cuadros
//   {"boton":1,"cuadros":180}           un botón del mouse (0 disparar, 1 aspirar) apretado
//   {"girar":[400,0],"cuadros":30}      el mouse se mueve eso en total (píxeles: mirar)
//   {"toque":[x,y],"cuadros":20}        un dedo apretado ahí (píxeles, abajo a la izquierda)
//   {"rueda":-1}                        la ruedita (cambiar de casillero)
//   {"control":"Vacum","cuadros":120}   un control táctil del juego apretado (Attack, Jump, Interact...)
//   {"mover":[0,1],"cuadros":180}       el joystick hacia ahí (1 = a 0.85 del radio: camina; 1.4 corre)
//   {"mirar":[300,0],"cuadros":30}      un dedo arrastrado eso en el touchpad (píxeles en total)
//   {"diag":"jugador;cerca:6"}          diagnósticos del motor en ese momento
//   {"diagfin":"jugador"}               los mismos, en el último cuadro del paso (con todo apretado)
//   {"diagcada":30,"diagde":"aspiradora"} esos diagnósticos cada tantos cuadros mientras dura el paso
//   {"log":"texto"}                     una marca en la salida
class Guion
{
    readonly JsonElement[] pasos;
    int i = -1, resta;
    float rx = 640, ry = 360, gx, gy, tx, ty;
    readonly System.Collections.Generic.List<KeyCode> teclas = new System.Collections.Generic.List<KeyCode>();
    readonly System.Collections.Generic.List<int> botones = new System.Collections.Generic.List<int>();
    bool dedo;
    string diagFin, diagDe;
    int diagCada, enPaso;
    // los dedos de los controles táctiles: (dedo, x, y) para soltarlos; el del touchpad se mueve
    readonly System.Collections.Generic.List<(int d, float x, float y)> dedos = new System.Collections.Generic.List<(int, float, float)>();
    float mx, my, px, py, gx2, gy2; bool moverPend, mirando;
    int siguienteDedo = 22;
    public bool Terminado => i >= pasos.Length;

    public Guion(string json) { pasos = JsonDocument.Parse(json).RootElement.EnumerateArray().ToArray(); }

    public void Cuadro()
    {
        if (resta > 0)
        {
            if (gx != 0 || gy != 0) { rx += gx; ry += gy; Entrada.Raton(rx, ry); }
            // el joystick: apoyado en el centro un cuadro, después corrido (una fase por cuadro)
            if (moverPend) { Entrada.Toque(20, 1, mx, my); moverPend = false; }
            if (mirando) { px += gx2; py += gy2; Entrada.Toque(21, 1, px, py); }
            if (diagCada > 0 && ++enPaso % diagCada == 0)
                foreach (var cmd in diagDe.Split(';')) Console.WriteLine($"[cuadro {enPaso} del paso] " + Porteo.Diagnostico.Correr(cmd));
            if (--resta == 0) { Fin(); Soltar(); }
            return;
        }
        if (++i >= pasos.Length) return;
        var p = pasos[i];
        resta = p.TryGetProperty("cuadros", out var c) ? c.GetInt32() : 1;
        Console.WriteLine($"guion: paso {i} t={Time.time:F1} {p.GetRawText()}");
        if (p.TryGetProperty("tecla", out var t))
            foreach (var n in t.ValueKind == JsonValueKind.Array ? t.EnumerateArray().Select(x => x.GetString()) : new[] { t.GetString() })
            {
                var k = (KeyCode)Enum.Parse(typeof(KeyCode), n, true);
                teclas.Add(k); Entrada.Tecla((int)k, true);
            }
        if (p.TryGetProperty("boton", out var b))
            foreach (var n in b.ValueKind == JsonValueKind.Array ? b.EnumerateArray().Select(x => x.GetInt32()) : new[] { b.GetInt32() })
            {
                botones.Add(n); Entrada.BotonRaton(n, true);
            }
        if (p.TryGetProperty("girar", out var g))
        {
            gx = g[0].GetSingle() / resta; gy = g[1].GetSingle() / resta;
            Entrada.Raton(rx, ry);
        }
        if (p.TryGetProperty("control", out var co))
            foreach (var n in co.ValueKind == JsonValueKind.Array ? co.EnumerateArray().Select(x => x.GetString()) : new[] { co.GetString() })
            {
                var rc = Porteo.ControlesTactiles.Rect(n);
                if (rc.Length == 0) { Console.WriteLine($"guion: el control {n} no está"); continue; }
                int dd = siguienteDedo++;
                Entrada.Toque(dd, 0, (float)rc[0], (float)rc[1]);
                dedos.Add((dd, (float)rc[0], (float)rc[1]));
            }
        if (p.TryGetProperty("mover", out var mv))
        {
            var j = Porteo.ControlesTactiles.Rect("Joystick");
            if (j.Length == 0) Console.WriteLine("guion: el joystick no está");
            else
            {
                float dx = mv[0].GetSingle(), dy = mv[1].GetSingle();
                float radio = (float)(j[4] > 0 ? j[4] : Math.Min(j[2], j[3]) * 0.3);
                Entrada.Toque(20, 0, (float)j[0], (float)j[1]);
                mx = (float)j[0] + dx * 0.85f * radio; my = (float)j[1] + dy * 0.85f * radio; moverPend = true;
                dedos.Add((20, mx, my));
            }
        }
        if (p.TryGetProperty("mirar", out var mi))
        {
            var t2 = Porteo.ControlesTactiles.Rect("Touchpad");
            if (t2.Length == 0) Console.WriteLine("guion: el touchpad no está");
            else
            {
                px = (float)t2[0]; py = (float)t2[1];
                gx2 = mi[0].GetSingle() / resta; gy2 = mi[1].GetSingle() / resta;
                Entrada.Toque(21, 0, px, py); mirando = true;
            }
        }
        if (p.TryGetProperty("toque", out var to)) { tx = to[0].GetSingle(); ty = to[1].GetSingle(); Entrada.Toque(7, 0, tx, ty); dedo = true; }
        if (p.TryGetProperty("rueda", out var r)) Entrada.Rueda(0, r.GetSingle());
        if (p.TryGetProperty("diag", out var d))
            foreach (var cmd in d.GetString().Split(';')) Console.WriteLine(Porteo.Diagnostico.Correr(cmd));
        if (p.TryGetProperty("log", out var l)) Console.WriteLine("guion: " + l.GetString());
        diagFin = p.TryGetProperty("diagfin", out var df) ? df.GetString() : null;
        diagCada = p.TryGetProperty("diagcada", out var dc) ? dc.GetInt32() : 0;
        diagDe = p.TryGetProperty("diagde", out var dd2) ? dd2.GetString() : "";
        enPaso = 0;
        if (--resta == 0) { Fin(); Soltar(); }
    }

    void Fin()
    {
        if (diagFin == null) return;
        foreach (var cmd in diagFin.Split(';')) Console.WriteLine(Porteo.Diagnostico.Correr(cmd));
        diagFin = null;
    }

    void Soltar()
    {
        foreach (var k in teclas) Entrada.Tecla((int)k, false);
        foreach (var n in botones) Entrada.BotonRaton(n, false);
        if (dedo) Entrada.Toque(7, 3, tx, ty);
        foreach (var (d, x, y) in dedos) Entrada.Toque(d, 3, x, y);
        if (mirando) Entrada.Toque(21, 3, px, py);
        teclas.Clear(); botones.Clear(); dedos.Clear(); dedo = false; mirando = moverPend = false; gx = gy = gx2 = gy2 = 0;
        if (siguienteDedo > 40) siguienteDedo = 22;
    }
}

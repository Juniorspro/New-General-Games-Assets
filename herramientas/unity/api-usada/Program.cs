using System.Text.Json;
using Mono.Cecil;
using Mono.Cecil.Cil;

// Uso: ApiUsada MANAGED salida.json [ensamblados del juego...]
// Sin lista, analiza todo lo que no sea del motor ni de la biblioteca base.
var carpeta = args[0];
var salida = args[1];
var resolver = new DefaultAssemblyResolver();
resolver.AddSearchDirectory(carpeta);
var lectura = new ReaderParameters { AssemblyResolver = resolver };

bool EsExterno(string ens) =>
    ens.StartsWith("UnityEngine") || ens is "mscorlib" or "netstandard" || ens.StartsWith("System") || ens.StartsWith("Mono.");

var propios = args.Length > 2
    ? args[2..].Select(a => Path.Combine(carpeta, a)).ToList()
    : Directory.GetFiles(carpeta, "*.dll").Where(f => !EsExterno(Path.GetFileNameWithoutExtension(f))).ToList();

// ensamblado externo -> tipo -> miembro -> veces
var usos = new SortedDictionary<string, SortedDictionary<string, SortedDictionary<string, int>>>();
var herencia = new SortedDictionary<string, int>();      // tipos externos de los que se hereda
var mensajes = new SortedDictionary<string, int>();      // métodos con nombre de mensaje de Unity
string[] MENSAJES = { "Awake", "Start", "Update", "LateUpdate", "FixedUpdate", "OnEnable", "OnDisable", "OnDestroy",
    "OnTriggerEnter", "OnTriggerStay", "OnTriggerExit", "OnCollisionEnter", "OnCollisionStay", "OnCollisionExit",
    "OnControllerColliderHit", "OnGUI", "OnRenderImage", "OnPreRender", "OnPostRender", "OnPreCull", "OnWillRenderObject",
    "OnBecameVisible", "OnBecameInvisible", "OnApplicationPause", "OnApplicationFocus", "OnApplicationQuit",
    "OnAnimatorMove", "OnAnimatorIK", "OnParticleCollision", "OnParticleTrigger", "OnJointBreak", "OnLevelWasLoaded",
    "OnTransformParentChanged", "OnTransformChildrenChanged", "OnRectTransformDimensionsChange", "OnValidate", "Reset",
    "OnMouseDown", "OnMouseUp", "OnMouseEnter", "OnMouseExit", "OnMouseOver", "OnMouseDrag", "OnAudioFilterRead",
    "OnCanvasGroupChanged", "OnDidApplyAnimationProperties", "OnBeforeTransformParentChanged", "OnServerInitialized" };

void Anotar(string ens, string tipo, string miembro)
{
    if (!usos.TryGetValue(ens, out var t)) usos[ens] = t = new();
    if (!t.TryGetValue(tipo, out var m)) t[tipo] = m = new();
    m[miembro] = m.GetValueOrDefault(miembro) + 1;
}

string Ens(TypeReference t)
{
    while (t is TypeSpecification ts) t = ts.ElementType;
    if (t.Scope is AssemblyNameReference an) return an.Name;
    if (t.Scope is ModuleDefinition md) return md.Assembly.Name.Name;
    return t.Scope?.Name ?? "?";
}

string Nombre(TypeReference t)
{
    while (t is TypeSpecification ts && t is not GenericInstanceType) t = ts.ElementType;
    if (t is GenericInstanceType g) t = g.ElementType;
    return t.FullName;
}

void Tipo(TypeReference t)
{
    if (t == null || t is GenericParameter) return;
    if (t is GenericInstanceType gi) foreach (var a in gi.GenericArguments) Tipo(a);
    while (t is TypeSpecification ts) { t = ts.ElementType; if (t is GenericInstanceType g2) foreach (var a in g2.GenericArguments) Tipo(a); }
    var e = Ens(t);
    if (EsExterno(e)) Anotar(e, Nombre(t), "(tipo)");
}

string Firma(MethodReference m)
{
    var ps = string.Join(",", m.Parameters.Select(p => p.ParameterType.FullName));
    var gen = m is GenericInstanceMethod gm ? "<" + gm.GenericArguments.Count + ">" : (m.HasGenericParameters ? "<" + m.GenericParameters.Count + ">" : "");
    return $"{m.ReturnType.FullName} {m.Name}{gen}({ps})";
}

foreach (var ruta in propios)
{
    var asm = AssemblyDefinition.ReadAssembly(ruta, lectura);
    foreach (var mod in asm.Modules)
    {
        foreach (var tipo in mod.GetTypes())
        {
            if (tipo.BaseType != null)
            {
                Tipo(tipo.BaseType);
                if (EsExterno(Ens(tipo.BaseType))) herencia[Nombre(tipo.BaseType)] = herencia.GetValueOrDefault(Nombre(tipo.BaseType)) + 1;
            }
            foreach (var i in tipo.Interfaces) Tipo(i.InterfaceType);
            foreach (var f in tipo.Fields) Tipo(f.FieldType);
            foreach (var m in tipo.Methods)
            {
                if (MENSAJES.Contains(m.Name) && !m.IsStatic) mensajes[m.Name] = mensajes.GetValueOrDefault(m.Name) + 1;
                Tipo(m.ReturnType);
                foreach (var p in m.Parameters) Tipo(p.ParameterType);
                if (!m.HasBody) continue;
                foreach (var v in m.Body.Variables) Tipo(v.VariableType);
                foreach (var ins in m.Body.Instructions)
                {
                    switch (ins.Operand)
                    {
                        case MethodReference mr:
                            Tipo(mr.DeclaringType);
                            if (EsExterno(Ens(mr.DeclaringType))) Anotar(Ens(mr.DeclaringType), Nombre(mr.DeclaringType), Firma(mr));
                            break;
                        case FieldReference fr:
                            Tipo(fr.DeclaringType);
                            if (EsExterno(Ens(fr.DeclaringType))) Anotar(Ens(fr.DeclaringType), Nombre(fr.DeclaringType), "campo " + fr.FieldType.FullName + " " + fr.Name);
                            break;
                        case TypeReference tr:
                            Tipo(tr);
                            break;
                    }
                }
            }
        }
    }
}

var resumen = usos.ToDictionary(e => e.Key, e => new { tipos = e.Value.Count, miembros = e.Value.Sum(t => t.Value.Count(m => m.Key != "(tipo)")) });
File.WriteAllText(salida, JsonSerializer.Serialize(new { analizados = propios.Select(Path.GetFileName), resumen, herencia, mensajes, usos },
    new JsonSerializerOptions { WriteIndented = true }));
foreach (var (ens, r) in resumen.OrderByDescending(x => x.Value.miembros)) Console.WriteLine($"{ens,-40} {r.tipos,5} tipos {r.miembros,6} miembros");
Console.WriteLine("herencia: " + string.Join(", ", herencia.OrderByDescending(x => x.Value).Take(25).Select(x => $"{x.Key} {x.Value}")));
Console.WriteLine("mensajes: " + string.Join(", ", mensajes.OrderByDescending(x => x.Value).Select(x => $"{x.Key} {x.Value}")));

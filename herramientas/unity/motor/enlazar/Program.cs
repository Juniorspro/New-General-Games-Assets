// porteo: ¿enlaza el IL del juego contra el motor?
//   dotnet run -c Release -- JUEGO_MANAGED MOTOR_BIN [Assembly-CSharp.dll ...]
// MOTOR_BIN tiene UnityEngine.CoreModule.dll y las fachadas. Se resuelven las referencias del
// juego (y del UnityEngine.UI del APK) a los módulos de Unity: tipos, métodos y campos.
using Mono.Cecil;

var juego = args[0];
var motor = args[1];
var nombres = args.Length > 2 ? args[2..] : new[] { "Assembly-CSharp.dll", "Assembly-UnityScript.dll", "Logger.dll", "UnityEngine.UI.dll" };

// el resolvedor busca primero en el motor (nuestros UnityEngine.*), después en el juego
// (UnityEngine.UI, Assembly-CSharp-firstpass...) y por último en la biblioteca base de .NET
var res = new DefaultAssemblyResolver();
res.AddSearchDirectory(motor);
var bcl = Path.GetDirectoryName(typeof(object).Assembly.Location);
var refs = Directory.GetDirectories(Path.Combine(Path.GetDirectoryName(Path.GetDirectoryName(Path.GetDirectoryName(bcl))), "packs", "Microsoft.NETCore.App.Ref"))
    .OrderBy(x => x).LastOrDefault();
if (refs != null) res.AddSearchDirectory(Directory.GetDirectories(Path.Combine(refs, "ref")).OrderBy(x => x).Last());
res.AddSearchDirectory(bcl);
var lect = new ReaderParameters { AssemblyResolver = res };

bool DelMotor(IMetadataScope s)
{
    var n = s is AssemblyNameReference an ? an.Name : s is ModuleDefinition md ? md.Assembly.Name.Name : s?.Name ?? "";
    return n.StartsWith("UnityEngine") && n != "UnityEngine.UI";
}

var faltan = new SortedDictionary<string, SortedSet<string>>();
void Falta(string tipo, string que)
{
    if (!faltan.TryGetValue(tipo, out var s)) faltan[tipo] = s = new SortedSet<string>();
    s.Add(que);
}

int revisados = 0;
foreach (var nombre in nombres)
{
    var ruta = Path.Combine(juego, nombre);
    if (!File.Exists(ruta)) continue;
    // el juego se lee con un resolvedor que también ve su carpeta (UnityEngine.UI del APK)
    var resJ = new DefaultAssemblyResolver();
    resJ.AddSearchDirectory(motor);
    resJ.AddSearchDirectory(juego);
    if (refs != null) resJ.AddSearchDirectory(Directory.GetDirectories(Path.Combine(refs, "ref")).OrderBy(x => x).Last());
    var asm = AssemblyDefinition.ReadAssembly(ruta, new ReaderParameters { AssemblyResolver = resJ });
    foreach (var mod in asm.Modules)
    {
        foreach (var tr in mod.GetTypeReferences())
        {
            var raiz = tr; while (raiz.DeclaringType != null) raiz = raiz.DeclaringType;
            if (!DelMotor(raiz.Scope)) continue;
            revisados++;
            TypeDefinition td = null;
            try { td = tr.Resolve(); } catch { }
            if (td == null) Falta(tr.FullName, "(el tipo)");
        }
        foreach (var mr in mod.GetMemberReferences())
        {
            var dt = mr.DeclaringType;
            while (dt is TypeSpecification ts && dt is not GenericInstanceType) dt = ts.ElementType;
            var raiz = dt is GenericInstanceType g ? g.ElementType : dt;
            while (raiz?.DeclaringType != null) raiz = raiz.DeclaringType;
            if (raiz == null || !DelMotor(raiz.Scope)) continue;
            // los métodos de los arreglos de varias dimensiones (Color[,]::Get) los da el runtime
            if (mr.DeclaringType is ArrayType) continue;
            revisados++;
            IMemberDefinition md = null;
            try { md = mr switch { MethodReference m => m.Resolve(), FieldReference f => f.Resolve(), _ => null }; } catch { }
            if (md == null) Falta((dt is GenericInstanceType gi ? gi.ElementType : dt).FullName, mr.ToString());
        }
    }
}

int total = faltan.Sum(x => x.Value.Count);
Console.WriteLine($"referencias al motor: {revisados}, sin resolver: {total}");
foreach (var (t, ms) in faltan)
{
    Console.WriteLine(t);
    foreach (var m in ms) Console.WriteLine("    " + m);
}
Environment.ExitCode = total == 0 ? 0 : 1;

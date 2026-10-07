// porteo: reparar el IL del juego para el .NET de hoy.
//   dotnet run -c Release -- JUEGO_MANAGED MOTOR_BIN SALIDA [Assembly-CSharp.dll ...]
//
// 1) El recorte de código de Unity saca los métodos que nadie llama, aunque implementen una
//    interfaz (por ejemplo IEnumerator.Reset de los iteradores). El Mono de Unity carga igual
//    esos tipos; el runtime de .NET no (TypeLoadException). Se agrega cada método que falta con
//    un cuerpo que lanza NotSupportedException, que es lo que hacían los originales.
// 2) Se resuelve cada referencia a la biblioteca de .NET contra la de .NET 10 y se lista lo
//    que no existe (para reemplazarlo en el motor o reescribir la llamada).
using Mono.Cecil;
using Mono.Cecil.Cil;

var juego = args[0];
var motor = args[1];
var salida = args[2];
var nombres = args.Length > 3 ? args[3..] : new[] { "Assembly-CSharp.dll", "Assembly-UnityScript.dll", "Logger.dll", "UnityEngine.UI.dll" };
Directory.CreateDirectory(salida);

// primero la biblioteca de .NET 10 (así mscorlib y compañía son las fachadas de hoy), después
// el motor (nuestros UnityEngine.*) y al final el juego
var res = new DefaultAssemblyResolver();
foreach (var d in res.GetSearchDirectories()) res.RemoveSearchDirectory(d);
res.AddSearchDirectory(Path.GetDirectoryName(typeof(object).Assembly.Location));
res.AddSearchDirectory(motor);
res.AddSearchDirectory(salida);
res.AddSearchDirectory(juego);
var lect = new ReaderParameters { AssemblyResolver = res, ReadSymbols = false };

int agregados = 0;
var faltan = new SortedDictionary<string, SortedSet<string>>();

foreach (var n in nombres)
{
    var asm = AssemblyDefinition.ReadAssembly(Path.Combine(juego, n), lect);
    var mod = asm.MainModule;
    int antes = agregados;
    foreach (var t in mod.GetTypes().ToList())
    {
        if (t.IsInterface) continue;
        foreach (var ii in t.Interfaces.ToList())
        {
            var itRef = ii.InterfaceType;
            TypeDefinition itDef;
            try { itDef = itRef.Resolve(); } catch { itDef = null; }
            if (itDef == null) { Anotar(faltan, "interfaz", itRef.FullName + " (en " + t.FullName + ")"); continue; }
            foreach (var im in itDef.Methods)
            {
                if (im.IsStatic || !im.IsAbstract) continue;
                if (Implementado(t, itDef, im)) continue;
                AgregarStub(mod, t, itRef, im);
                agregados++;
                Console.WriteLine($"  {n}: {t.FullName} ← {itDef.Name}.{im.Name}");
            }
        }
    }
    // referencias a otros ensamblados que no resuelven
    foreach (var mr in mod.GetMemberReferences())
    {
        if (mr.DeclaringType is ArrayType) continue;
        bool ok;
        try { ok = mr.Resolve() != null; } catch { ok = false; }
        if (!ok) Anotar(faltan, Alcance(mr.DeclaringType), mr.FullName);
    }
    foreach (var tr in mod.GetTypeReferences())
    {
        bool ok;
        try { ok = tr.Resolve() != null; } catch { ok = false; }
        if (!ok) Anotar(faltan, Alcance(tr), tr.FullName);
    }
    asm.Write(Path.Combine(salida, n));
    Console.WriteLine($"{n}: {agregados - antes} métodos agregados");
}

int total = 0;
foreach (var (a, l) in faltan)
{
    Console.WriteLine($"sin resolver en {a}: {l.Count}");
    foreach (var x in l) Console.WriteLine("  " + x);
    total += l.Count;
}
Console.WriteLine($"listo: {agregados} métodos de interfaz agregados, {total} referencias sin resolver");

static string Alcance(TypeReference t)
{
    while (t is TypeSpecification ts) t = ts.ElementType;
    while (t.DeclaringType != null) t = t.DeclaringType;
    return t.Scope?.Name ?? "?";
}

static void Anotar(SortedDictionary<string, SortedSet<string>> d, string k, string v)
{
    if (!d.TryGetValue(k, out var s)) d[k] = s = new SortedSet<string>();
    s.Add(v);
}

// Un método de interfaz está implementado si la clase o alguna base lo implementa de forma
// explícita (.override) o con un método público virtual del mismo nombre y aridad. Se compara
// sin mirar los tipos de los parámetros a propósito: así nunca se pisa una implementación que sí
// existe (si hubiera dudas, no se agrega nada).
static bool Implementado(TypeDefinition t, TypeDefinition itDef, MethodDefinition im)
{
    for (var c = t; c != null; c = Base(c))
    {
        foreach (var m in c.Methods)
        {
            foreach (var o in m.Overrides)
                if (o.Name == im.Name && o.Parameters.Count == im.Parameters.Count &&
                    o.DeclaringType.GetElementType().FullName == itDef.FullName) return true;
            if (m.Name == im.Name && m.IsVirtual && m.IsPublic && !m.IsStatic && m.Parameters.Count == im.Parameters.Count &&
                m.GenericParameters.Count == im.GenericParameters.Count) return true;
        }
    }
    return false;
}

static TypeDefinition Base(TypeDefinition t)
{
    try { return t.BaseType?.Resolve(); } catch { return null; }
}

static void AgregarStub(ModuleDefinition mod, TypeDefinition t, TypeReference itRef, MethodDefinition im)
{
    var git = itRef as GenericInstanceType;
    var nombre = Nombre(itRef) + "." + im.Name;
    var m = new MethodDefinition(nombre,
        MethodAttributes.Private | MethodAttributes.Final | MethodAttributes.Virtual | MethodAttributes.HideBySig | MethodAttributes.NewSlot,
        mod.ImportReference(Sustituir(im.ReturnType, git), t));
    foreach (var p in im.Parameters)
        m.Parameters.Add(new ParameterDefinition(p.Name, p.Attributes, mod.ImportReference(Sustituir(p.ParameterType, git), t)));
    // la referencia al método de la interfaz (sobre la instancia genérica, con la firma abierta)
    var r = new MethodReference(im.Name, im.ReturnType, itRef) { HasThis = true, ExplicitThis = im.ExplicitThis, CallingConvention = im.CallingConvention };
    foreach (var p in im.Parameters) r.Parameters.Add(new ParameterDefinition(p.ParameterType));
    m.Overrides.Add(mod.ImportReference(r));
    var exc = new TypeReference("System", "NotSupportedException", mod, mod.TypeSystem.CoreLibrary);
    var ctor = new MethodReference(".ctor", mod.TypeSystem.Void, exc) { HasThis = true };
    var il = m.Body.GetILProcessor();
    il.Emit(OpCodes.Newobj, ctor);
    il.Emit(OpCodes.Throw);
    t.Methods.Add(m);
}

static string Nombre(TypeReference t)
{
    if (t is GenericInstanceType g)
        return g.ElementType.FullName.Split('`')[0] + "<" + string.Join(",", g.GenericArguments.Select(Nombre)) + ">";
    return t.FullName;
}

// los parámetros genéricos de la interfaz (!0, !1) por los argumentos de la instancia
static TypeReference Sustituir(TypeReference t, GenericInstanceType git)
{
    if (git == null) return t;
    switch (t)
    {
        case GenericParameter gp when gp.Type == GenericParameterType.Type && gp.Position < git.GenericArguments.Count:
            return git.GenericArguments[gp.Position];
        case ArrayType at: return new ArrayType(Sustituir(at.ElementType, git), at.Rank);
        case ByReferenceType br: return new ByReferenceType(Sustituir(br.ElementType, git));
        case GenericInstanceType gi:
        {
            var n = new GenericInstanceType(gi.ElementType);
            foreach (var a in gi.GenericArguments) n.GenericArguments.Add(Sustituir(a, git));
            return n;
        }
        default: return t;
    }
}

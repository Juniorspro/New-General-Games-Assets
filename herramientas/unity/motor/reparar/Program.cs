// porteo: reparar el IL del juego para el .NET de hoy.
//   dotnet run -c Release -- JUEGO_MANAGED MOTOR_BIN SALIDA [Assembly-CSharp.dll ...]
//
// 1) El recorte de código de Unity saca los métodos que nadie llama, aunque implementen una
//    interfaz (por ejemplo IEnumerator.Reset de los iteradores). El Mono de Unity carga igual
//    esos tipos; el runtime de .NET no (TypeLoadException). Se agrega cada método que falta con
//    un cuerpo que lanza NotSupportedException, que es lo que hacían los originales.
// 2) Se resuelve cada referencia a la biblioteca de .NET contra la de .NET 10 y se lista lo
//    que no existe (para reemplazarlo en el motor o reescribir la llamada).
// 0) Antes que nada, lo que usa UI Toolkit (UnityEngine.UIElements) sale: la UI de Unity 2022
//    (uGUI) trae el puente con UI Toolkit (PanelEventHandler, PanelRaycaster y el seguimiento de
//    sus paneles en EventSystem), que sólo hace algo si el juego tiene paneles de UI Toolkit. Sus
//    jerarquías son enormes y el motor no las tiene: los tipos que dependen de eso se sacan, los
//    métodos que lo nombran en su firma también, las llamadas sueltas (RegisterEventSystem) se
//    cambian por pop y los demás cuerpos que lo usan devuelven el valor por defecto. Así el
//    esqueleto del motor (generar) ni lo ve. Los ensamblados que no se reparan se copian igual,
//    para que generar resuelva todo desde la misma carpeta.
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
string[] QUITAR = { "UnityEngine.UIElements" };

foreach (var dll in Directory.GetFiles(juego, "*.dll"))
    if (!nombres.Contains(Path.GetFileName(dll)) && !File.Exists(Path.Combine(salida, Path.GetFileName(dll))))
        File.Copy(dll, Path.Combine(salida, Path.GetFileName(dll)));

foreach (var n in nombres)
{
    var asm = AssemblyDefinition.ReadAssembly(Path.Combine(juego, n), lect);
    var mod = asm.MainModule;
    int antes = agregados;
    SinEspacios(mod, QUITAR, n);
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

// ── 0) sin UI Toolkit ──
static void SinEspacios(ModuleDefinition mod, string[] espacios, string nombre)
{
    var quitados = new HashSet<string>();
    bool Nombra(TypeReference t)
    {
        if (t == null) return false;
        switch (t)
        {
            case GenericInstanceType gi: return Nombra(gi.ElementType) || gi.GenericArguments.Any(Nombra);
            case TypeSpecification ts: return Nombra(ts.ElementType);
            case GenericParameter: return false;
        }
        var raiz = t; while (raiz.DeclaringType != null) raiz = raiz.DeclaringType;
        return espacios.Any(e => raiz.Namespace == e || raiz.Namespace.StartsWith(e + ".")) || quitados.Contains(t.FullName);
    }
    bool Firma(MethodReference m) => Nombra(m.DeclaringType) || Nombra(m.ReturnType) || m.Parameters.Any(p => Nombra(p.ParameterType));
    // tipos: los que heredan, implementan o guardan algo de ahí (y lo anidado en ellos), hasta que no cambie
    bool cambio = true;
    while (cambio)
    {
        cambio = false;
        foreach (var t in mod.GetTypes().ToList())
        {
            if (quitados.Contains(t.FullName)) continue;
            if (Nombra(t.BaseType) || t.Interfaces.Any(i => Nombra(i.InterfaceType)) || t.Fields.Any(f => !f.IsStatic && Nombra(f.FieldType)) ||
                (t.DeclaringType != null && quitados.Contains(t.DeclaringType.FullName)))
            {
                quitados.Add(t.FullName);
                cambio = true;
            }
        }
    }
    int tipos = 0, metodos = 0, cuerpos = 0, llamadas = 0;
    foreach (var t in mod.GetTypes().ToList())
    {
        if (!quitados.Contains(t.FullName)) continue;
        if (t.DeclaringType != null) t.DeclaringType.NestedTypes.Remove(t); else mod.Types.Remove(t);
        tipos++;
    }
    foreach (var t in mod.GetTypes().ToList())
    {
        foreach (var f in t.Fields.ToList()) if (Nombra(f.FieldType)) t.Fields.Remove(f);
        foreach (var p in t.Properties.ToList()) if (Nombra(p.PropertyType)) t.Properties.Remove(p);
        foreach (var e in t.Events.ToList()) if (Nombra(e.EventType)) t.Events.Remove(e);
        foreach (var m in t.Methods.ToList())
            if (Nombra(m.ReturnType) || m.Parameters.Any(p => Nombra(p.ParameterType)) || m.Overrides.Any(Firma))
            {
                t.Methods.Remove(m);
                metodos++;
            }
    }
    foreach (var t in mod.GetTypes())
        foreach (var m in t.Methods)
        {
            if (!m.HasBody) continue;
            var cuerpo = m.Body;
            bool malo = cuerpo.Variables.Any(v => Nombra(v.VariableType));
            var sueltas = new List<Instruction>();
            if (!malo)
                foreach (var ins in cuerpo.Instructions)
                {
                    bool nombra = ins.Operand switch
                    {
                        MethodReference mr => Firma(mr) || (mr is GenericInstanceMethod gm && gm.GenericArguments.Any(Nombra)),
                        FieldReference fr => Nombra(fr.DeclaringType) || Nombra(fr.FieldType),
                        TypeReference tr => Nombra(tr),
                        _ => false,
                    };
                    if (!nombra) continue;
                    // una llamada estática que no devuelve nada y no recibe nada de ahí: se saca y quedan sus argumentos por sacar de la pila
                    if (ins.OpCode == OpCodes.Call && ins.Operand is MethodReference c && !c.HasThis && c.ReturnType.FullName == "System.Void" &&
                        !c.Parameters.Any(p => Nombra(p.ParameterType)))
                        sueltas.Add(ins);
                    else { malo = true; break; }
                }
            if (malo)
            {
                PorDefecto(m);
                cuerpos++;
                continue;
            }
            var il = cuerpo.GetILProcessor();
            foreach (var ins in sueltas)
            {
                int n = ((MethodReference)ins.Operand).Parameters.Count;
                if (n == 0) { ins.OpCode = OpCodes.Nop; ins.Operand = null; }
                else
                {
                    ins.OpCode = OpCodes.Pop; ins.Operand = null;
                    for (int k = 1; k < n; k++) il.InsertAfter(ins, il.Create(OpCodes.Pop));
                }
                llamadas++;
            }
        }
    if (tipos + metodos + cuerpos + llamadas > 0)
        Console.WriteLine($"{nombre}: sin {string.Join(", ", espacios)}: {tipos} tipos y {metodos} métodos fuera, {cuerpos} cuerpos por defecto, {llamadas} llamadas sacadas");
}

// el cuerpo de un método reemplazado por "devolver el valor por defecto"
static void PorDefecto(MethodDefinition m)
{
    var cuerpo = m.Body;
    cuerpo.Instructions.Clear();
    cuerpo.ExceptionHandlers.Clear();
    cuerpo.Variables.Clear();
    var il = cuerpo.GetILProcessor();
    foreach (var p in m.Parameters)
        if (p.IsOut || (p.ParameterType is ByReferenceType && p.IsOut))
        {
            var elem = ((ByReferenceType)p.ParameterType).ElementType;
            il.Emit(OpCodes.Ldarg, p);
            il.Emit(OpCodes.Initobj, elem);
        }
    var r = m.ReturnType;
    if (r.FullName != "System.Void")
    {
        if (r.IsValueType || r is GenericParameter)
        {
            var v = new VariableDefinition(r);
            cuerpo.Variables.Add(v);
            cuerpo.InitLocals = true;
            il.Emit(OpCodes.Ldloca, v);
            il.Emit(OpCodes.Initobj, r);
            il.Emit(OpCodes.Ldloc, v);
        }
        else il.Emit(OpCodes.Ldnull);
    }
    il.Emit(OpCodes.Ret);
}

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

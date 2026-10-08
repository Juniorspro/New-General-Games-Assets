// porteo: escribe el esqueleto de la API de Unity que usa un juego.
//
//   dotnet run -c Release -- --juego MANAGED_DEL_APK --unity MANAGED_DE_UNITY/UnityEngine
//                            --propios MOTOR/UnityEngine --salida MOTOR/UnityEngine/Generado
//                            --fachadas MOTOR/Fachadas
//
// Lee el IL del juego (Assembly-CSharp y compañía, y el UnityEngine.UI del APK, que corre tal
// cual) y junta cada tipo y miembro de Unity que se usa. Le suma lo que hace falta para que el
// IL enlace igual que contra Unity: las cadenas de herencia, los virtuales que el juego
// sobrescribe, las interfaces enteras, los campos de los structs y los enums completos. De
// cada uno saca la firma exacta de las DLL de Unity 2018.4 y escribe C#: lo que ya está escrito
// a mano (en --propios) se saltea, lo demás queda como un trozo que avisa una vez que falta.
// También escribe las fachadas: un ensamblado por cada módulo de Unity que nombra el IL, con
// TypeForwardedTo al nuestro (UnityEngine.CoreModule), que tiene todo.
using System.Text;
using System.Text.RegularExpressions;
using Mono.Cecil;
using Mono.Cecil.Cil;

var opc = Opciones.Leer(args);
var gen = new Generador(opc);
gen.Correr();

sealed class Opciones
{
    public string Juego, Unity, Propios, Salida, Fachadas;
    public string[] Ensamblados = { "Assembly-CSharp", "Assembly-UnityScript", "Logger", "UnityEngine.UI" };

    public static Opciones Leer(string[] a)
    {
        var o = new Opciones();
        for (int i = 0; i < a.Length; i++)
        {
            switch (a[i])
            {
                case "--juego": o.Juego = a[++i]; break;
                case "--unity": o.Unity = a[++i]; break;
                case "--propios": o.Propios = a[++i]; break;
                case "--salida": o.Salida = a[++i]; break;
                case "--fachadas": o.Fachadas = a[++i]; break;
                case "--ensamblados": o.Ensamblados = a[++i].Split(','); break;
                default: throw new ArgumentException("opción desconocida: " + a[i]);
            }
        }
        if (o.Juego == null || o.Unity == null || o.Salida == null) throw new ArgumentException("faltan --juego, --unity o --salida");
        return o;
    }
}

sealed class Generador
{
    readonly Opciones opc;
    const string NUESTRO = "UnityEngine.CoreModule";

    // Unity completo: nombre (con / para los anidados) → definición
    readonly Dictionary<string, TypeDefinition> unity = new();
    // lo que hace falta
    readonly HashSet<TypeDefinition> tipos = new();
    readonly HashSet<IMemberDefinition> miembros = new();
    readonly Queue<TypeDefinition> pendientes = new();
    // módulo nombrado por el IL → tipos de primer nivel que se piden por él (para las fachadas)
    readonly SortedDictionary<string, SortedSet<string>> porModulo = new();
    // lo escrito a mano: tipo → miembros (clave de firma simplificada)
    readonly Dictionary<string, HashSet<string>> propios = new();
    readonly HashSet<string> tiposPropiosCompletos = new();   // enums y delegados escritos a mano
    readonly List<string> sinResolver = new();

    public Generador(Opciones o) { opc = o; }

    public void Correr()
    {
        CargarUnity();
        if (opc.Propios != null) LeerPropios();
        foreach (var nombre in opc.Ensamblados)
        {
            var ruta = Path.Combine(opc.Juego, nombre + ".dll");
            if (!File.Exists(ruta)) { Console.WriteLine("no está " + ruta); continue; }
            var res = new DefaultAssemblyResolver();
            res.AddSearchDirectory(opc.Juego);
            var asm = AssemblyDefinition.ReadAssembly(ruta, new ReaderParameters { AssemblyResolver = res });
            Recorrer(asm);
        }
        while (pendientes.Count > 0) Cerrar(pendientes.Dequeue());
        Escribir();
        if (opc.Fachadas != null) EscribirFachadas();
        Console.WriteLine($"tipos {tipos.Count}, miembros {miembros.Count}, sin resolver {sinResolver.Count}");
        foreach (var s in sinResolver.Distinct().Take(80)) Console.WriteLine("  sin resolver: " + s);
    }

    // ── Unity ────────────────────────────────────────────────────────────────
    DefaultAssemblyResolver resUnity;

    void CargarUnity()
    {
        var res = resUnity = new DefaultAssemblyResolver();
        res.AddSearchDirectory(opc.Unity);
        // la biblioteca base de Mono de Unity, para resolver las interfaces de System que implementan
        var bcl = Path.GetFullPath(Path.Combine(opc.Unity, "../../MonoBleedingEdge/lib/mono/4.7.1-api"));
        if (Directory.Exists(bcl)) res.AddSearchDirectory(bcl);
        foreach (var dll in Directory.GetFiles(opc.Unity, "UnityEngine*.dll"))
        {
            var asm = AssemblyDefinition.ReadAssembly(dll, new ReaderParameters { AssemblyResolver = res });
            foreach (var t in asm.MainModule.GetTypes())
                if (!t.Name.StartsWith("<")) unity.TryAdd(t.FullName, t);
        }
    }

    static bool EsDeUnity(IMetadataScope s)
    {
        var n = s is AssemblyNameReference an ? an.Name : s is ModuleDefinition md ? md.Assembly.Name.Name : s?.Name ?? "";
        return n.StartsWith("UnityEngine") && n != "UnityEngine.UI";
    }

    static string Modulo(IMetadataScope s) => s is AssemblyNameReference an ? an.Name : s is ModuleDefinition md ? md.Assembly.Name.Name : s?.Name ?? "";

    TypeDefinition Resolver(TypeReference r)
    {
        while (r is TypeSpecification ts && r is not GenericInstanceType) r = ts.ElementType;
        if (r is GenericInstanceType gi) r = gi.ElementType;
        if (r is GenericParameter) return null;
        var raiz = r; while (raiz.DeclaringType != null) raiz = raiz.DeclaringType;
        if (!EsDeUnity(raiz.Scope)) return null;
        if (unity.TryGetValue(r.FullName, out var d)) return d;
        sinResolver.Add("tipo " + r.FullName);
        return null;
    }

    // ── el IL del juego ──────────────────────────────────────────────────────
    void Recorrer(AssemblyDefinition asm)
    {
        foreach (var ca in asm.CustomAttributes) Atributo(ca);
        foreach (var mod in asm.Modules)
        {
            foreach (var tr in mod.GetTypeReferences()) Ref(tr);
            foreach (var mr in mod.GetMemberReferences())
            {
                if (mr is MethodReference m) Metodo(m);
                else if (mr is FieldReference f) Campo(f);
            }
            foreach (var t in mod.GetTypes())
            {
                foreach (var ca in t.CustomAttributes) Atributo(ca);
                Ref(t.BaseType);
                foreach (var i in t.Interfaces) Ref(i.InterfaceType);
                foreach (var gp in t.GenericParameters) foreach (var c in gp.Constraints) Ref(c.ConstraintType);
                foreach (var f in t.Fields) { Ref(f.FieldType); foreach (var ca in f.CustomAttributes) Atributo(ca); }
                foreach (var p in t.Properties) foreach (var ca in p.CustomAttributes) Atributo(ca);
                foreach (var m in t.Methods)
                {
                    foreach (var ca in m.CustomAttributes) Atributo(ca);
                    Ref(m.ReturnType);
                    foreach (var p in m.Parameters) { Ref(p.ParameterType); foreach (var ca in p.CustomAttributes) Atributo(ca); }
                    foreach (var gp in m.GenericParameters) foreach (var c in gp.Constraints) Ref(c.ConstraintType);
                    foreach (var o in m.Overrides) Metodo(o);
                    if (m.HasBody)
                    {
                        foreach (var v in m.Body.Variables) Ref(v.VariableType);
                        foreach (var ins in m.Body.Instructions)
                        {
                            if (ins.Operand is MethodReference mr2) Metodo(mr2);
                            else if (ins.Operand is FieldReference fr) Campo(fr);
                            else if (ins.Operand is TypeReference tr2) Ref(tr2);
                        }
                    }
                    // un virtual del juego que pisa uno de Unity: el de Unity tiene que existir
                    if (m.IsVirtual && !m.IsNewSlot) Pisado(t, m);
                }
                // si hereda de un tipo de Unity, ese tipo con todos sus virtuales
                var b = t.BaseType;
                while (b != null)
                {
                    var bd = Resolver(b);
                    if (bd != null) { Agregar(bd); Virtuales(bd); break; }
                    try { b = b.Resolve()?.BaseType; } catch { b = null; }
                }
            }
        }
    }

    void Atributo(CustomAttribute ca)
    {
        Metodo(ca.Constructor);
        foreach (var a in ca.ConstructorArguments) ArgAtributo(a);
        foreach (var p in ca.Properties)
        {
            ArgAtributo(p.Argument);
            var td = Resolver(ca.AttributeType);
            var pd = td?.Properties.FirstOrDefault(x => x.Name == p.Name);
            if (pd?.SetMethod != null) Miembro(pd.SetMethod);
        }
        foreach (var f in ca.Fields)
        {
            ArgAtributo(f.Argument);
            var td = Resolver(ca.AttributeType);
            var fd = td?.Fields.FirstOrDefault(x => x.Name == f.Name);
            if (fd != null) Miembro(fd);
        }
    }

    void ArgAtributo(CustomAttributeArgument a)
    {
        Ref(a.Type);
        if (a.Value is TypeReference t) Ref(t);
        if (a.Value is CustomAttributeArgument[] arr) foreach (var x in arr) ArgAtributo(x);
        if (a.Value is CustomAttributeArgument inner) ArgAtributo(inner);
    }

    void Ref(TypeReference r)
    {
        if (r == null) return;
        switch (r)
        {
            case GenericInstanceType gi:
                foreach (var x in gi.GenericArguments) Ref(x);
                Ref(gi.ElementType);
                return;
            case TypeSpecification ts:
                Ref(ts.ElementType);
                return;
            case GenericParameter:
                return;
        }
        var raiz = r; while (raiz.DeclaringType != null) raiz = raiz.DeclaringType;
        if (!EsDeUnity(raiz.Scope)) return;
        var mod = Modulo(raiz.Scope);
        if (!porModulo.TryGetValue(mod, out var set)) porModulo[mod] = set = new SortedSet<string>();
        set.Add(raiz.FullName);
        var d = Resolver(r);
        if (d != null) Agregar(d);
    }

    void Metodo(MethodReference r)
    {
        if (r == null) return;
        Ref(r.DeclaringType);
        if (r is GenericInstanceMethod gim) foreach (var a in gim.GenericArguments) Ref(a);
        Ref(r.ReturnType);
        foreach (var p in r.Parameters) Ref(p.ParameterType);
        var td = Resolver(r.DeclaringType);
        if (td == null) return;
        var md = BuscarMetodo(td, r);
        if (md == null) { sinResolver.Add("método " + r.FullName); return; }
        Miembro(md);
    }

    void Campo(FieldReference r)
    {
        Ref(r.DeclaringType);
        Ref(r.FieldType);
        var td = Resolver(r.DeclaringType);
        if (td == null) return;
        for (var t = td; t != null; t = t.BaseType != null ? Resolver(t.BaseType) : null)
        {
            var f = t.Fields.FirstOrDefault(x => x.Name == r.Name);
            if (f != null) { Miembro(f); return; }
        }
        sinResolver.Add("campo " + r.FullName);
    }

    MethodDefinition BuscarMetodo(TypeDefinition td, MethodReference r)
    {
        var mr = r is GenericInstanceMethod g ? g.ElementMethod : r;
        var firma = Firma(mr);
        for (var t = td; t != null; t = t.BaseType != null ? Resolver(t.BaseType) : null)
        {
            foreach (var m in t.Methods)
                if (m.Name == mr.Name && m.Parameters.Count == mr.Parameters.Count && Firma(m) == firma) return m;
        }
        // las interfaces (un método de interfaz pedido por la interfaz misma ya entró arriba)
        return null;
    }

    // firma comparable entre una referencia y una definición
    static string Firma(MethodReference m)
    {
        var sb = new StringBuilder();
        sb.Append(Norm(m.ReturnType)).Append(' ').Append(m.Name).Append('`').Append(m.GenericParameters.Count).Append('(');
        sb.Append(string.Join(",", m.Parameters.Select(p => Norm(p.ParameterType))));
        return sb.Append(')').ToString();
    }

    static string Norm(TypeReference t)
    {
        switch (t)
        {
            case GenericParameter gp: return (gp.Type == GenericParameterType.Method ? "!!" : "!") + gp.Position;
            case ByReferenceType br: return Norm(br.ElementType) + "&";
            case ArrayType at: return Norm(at.ElementType) + "[" + new string(',', at.Rank - 1) + "]";
            case PointerType pt: return Norm(pt.ElementType) + "*";
            case GenericInstanceType gi: return Norm(gi.ElementType) + "<" + string.Join(",", gi.GenericArguments.Select(Norm)) + ">";
            case RequiredModifierType rm: return Norm(rm.ElementType);
            case OptionalModifierType om: return Norm(om.ElementType);
            default: return t.FullName;
        }
    }

    void Pisado(TypeDefinition t, MethodDefinition m)
    {
        var b = t.BaseType;
        while (b != null)
        {
            var bd = Resolver(b);
            if (bd != null)
            {
                for (var u = bd; u != null; u = u.BaseType != null ? Resolver(u.BaseType) : null)
                {
                    var v = u.Methods.FirstOrDefault(x => x.Name == m.Name && x.IsVirtual && x.Parameters.Count == m.Parameters.Count);
                    if (v != null) { Miembro(v); return; }
                }
                return;
            }
            try { b = b.Resolve()?.BaseType; } catch { return; }
        }
    }

    void Virtuales(TypeDefinition td)
    {
        for (var t = td; t != null; t = t.BaseType != null ? Resolver(t.BaseType) : null)
            foreach (var m in t.Methods)
                if ((m.IsVirtual || m.IsAbstract) && !m.IsPrivate && !m.Name.Contains('.')) Miembro(m);
    }

    // ── cierre ───────────────────────────────────────────────────────────────
    void Agregar(TypeDefinition t)
    {
        if (t == null || !tipos.Add(t)) return;
        pendientes.Enqueue(t);
    }

    void Miembro(IMemberDefinition m)
    {
        if (m == null || !miembros.Add(m)) return;
        Agregar(m.DeclaringType);
        switch (m)
        {
            case MethodDefinition md:
                Ref(md.ReturnType);
                foreach (var p in md.Parameters) Ref(p.ParameterType);
                foreach (var gp in md.GenericParameters) foreach (var c in gp.Constraints) Ref(c.ConstraintType);
                // una mitad de un par de operadores pide la otra (C# no compila sin el par)
                var par = ParDe(md.Name);
                if (par != null)
                    foreach (var x in md.DeclaringType.Methods)
                        if (x.Name == par) Miembro(x);
                break;
            case FieldDefinition fd: Ref(fd.FieldType); break;
        }
    }

    static string ParDe(string op) => op switch
    {
        "op_Equality" => "op_Inequality", "op_Inequality" => "op_Equality",
        "op_LessThan" => "op_GreaterThan", "op_GreaterThan" => "op_LessThan",
        "op_LessThanOrEqual" => "op_GreaterThanOrEqual", "op_GreaterThanOrEqual" => "op_LessThanOrEqual",
        "op_True" => "op_False", "op_False" => "op_True",
        _ => null,
    };

    void Cerrar(TypeDefinition t)
    {
        if (t.DeclaringType != null) Agregar(t.DeclaringType);
        if (t.BaseType != null) Ref(t.BaseType);
        foreach (var i in t.Interfaces) Ref(i.InterfaceType);
        foreach (var gp in t.GenericParameters) foreach (var c in gp.Constraints) Ref(c.ConstraintType);
        if (t.IsEnum || t.IsValueType)
            foreach (var f in t.Fields) if (!f.IsStatic || t.IsEnum) Miembro(f);
        if (t.IsInterface)
        {
            foreach (var m in t.Methods) Miembro(m);
        }
        if (t.BaseType?.FullName == "System.MulticastDelegate")
            foreach (var m in t.Methods) Miembro(m);
        // una clase abstracta: sus abstractos tienen que estar (si no, no compila nada que la herede)
        if (t.IsAbstract && !t.IsInterface)
            foreach (var m in t.Methods) if (m.IsAbstract) Miembro(m);
        // las interfaces que implementa (de Unity o de System): enteras las de Unity, y en este
        // tipo lo que las implementa (sin eso no compila)
        if (!t.IsInterface)
            foreach (var i in t.Interfaces)
            {
                var id = Resolver(i.InterfaceType);
                if (id != null) foreach (var m in id.Methods) Miembro(m);
                TypeDefinition idef = id;
                if (idef == null) { try { idef = i.InterfaceType.Resolve(); } catch { } }
                if (idef == null) continue;
                foreach (var m in idef.Methods)
                {
                    var expl = t.Methods.FirstOrDefault(x => x.Overrides.Any(o => o.Name == m.Name && o.DeclaringType.Name == idef.Name));
                    var gi = i.InterfaceType as GenericInstanceType;
                    string Sust(TypeReference pt) => pt is GenericParameter gp && gp.Type == GenericParameterType.Type && gi != null ? Norm(gi.GenericArguments[gp.Position]) : Norm(pt);
                    var impl = expl ?? t.Methods.FirstOrDefault(x => x.Name == m.Name && x.Parameters.Count == m.Parameters.Count && !x.IsStatic && x.IsPublic
                        && x.Parameters.Select((pp, k) => Norm(pp.ParameterType) == Sust(m.Parameters[k].ParameterType)).All(b => b));
                    if (impl != null) Miembro(impl);
                }
            }
        // los abstractos de las bases que no implementa, en un tipo concreto que se usa
        if (!t.IsAbstract && !t.IsInterface)
        {
            for (var b = t.BaseType != null ? Resolver(t.BaseType) : null; b != null; b = b.BaseType != null ? Resolver(b.BaseType) : null)
                foreach (var m in b.Methods.Where(x => x.IsAbstract))
                {
                    var impl = t.Methods.FirstOrDefault(x => x.Name == m.Name && x.Parameters.Count == m.Parameters.Count);
                    if (impl != null) Miembro(impl);
                }
        }
    }

    // ── lo escrito a mano ────────────────────────────────────────────────────
    // Sin compilar: con una lectura de la sintaxis alcanza (nombres de tipos, de miembros y la
    // cantidad y el último nombre de los tipos de los parámetros).
    void LeerPropios()
    {
        foreach (var f in Directory.GetFiles(opc.Propios, "*.cs", SearchOption.AllDirectories))
        {
            if (Path.GetFullPath(f).StartsWith(Path.GetFullPath(opc.Salida))) continue;
            Sintaxis.Leer(File.ReadAllText(f), propios, tiposPropiosCompletos);
        }
    }

    // ── escritura ────────────────────────────────────────────────────────────
    void Escribir()
    {
        if (Directory.Exists(opc.Salida)) Directory.Delete(opc.Salida, true);
        Directory.CreateDirectory(opc.Salida);
        var raices = tipos.Where(t => t.DeclaringType == null).OrderBy(t => t.FullName).ToList();
        int archivos = 0;
        foreach (var t in raices)
        {
            var sb = new StringBuilder();
            sb.AppendLine("// <auto-generated> porteo: generar (esqueleto de la API de Unity que usa el juego)</auto-generated>");
            sb.AppendLine("#pragma warning disable");
            var ns = t.Namespace;
            if (ns.Length > 0) sb.AppendLine("namespace " + ns + "\n{");
            var cuerpo = new StringBuilder();
            if (!EscribirTipo(cuerpo, t, ns.Length > 0 ? 1 : 0)) continue;
            sb.Append(cuerpo);
            if (ns.Length > 0) sb.AppendLine("}");
            var dir = Path.Combine(opc.Salida, ns.Length > 0 ? ns.Replace('.', '/') : "_");
            Directory.CreateDirectory(dir);
            // UnityAction, UnityAction`1 y UnityAction`2 son tipos distintos: la aridad va en el nombre
            File.WriteAllText(Path.Combine(dir, t.Name.Replace('`', '_') + ".cs"), sb.ToString());
            archivos++;
        }
        File.WriteAllText(Path.Combine(opc.Salida, "Falta.cs"), FALTA);
        Console.WriteLine($"escritos {archivos} archivos en {opc.Salida}");
    }

    const string FALTA = @"// <auto-generated> porteo: generar</auto-generated>
namespace Porteo
{
    // Lo que el motor todavía no hace: avisa una vez por miembro y sigue con el valor por defecto.
    public static class Falta
    {
        static readonly System.Collections.Generic.HashSet<string> vistos = new System.Collections.Generic.HashSet<string>();
        public static void Llamada(string quien)
        {
            if (vistos.Add(quien)) System.Console.WriteLine(""porteo: falta "" + quien);
        }
        public static System.Collections.Generic.IEnumerable<string> Vistos => vistos;
    }
}
";

    static string Sangria(int n) => new string(' ', n * 4);

    bool EscribirTipo(StringBuilder sb, TypeDefinition t, int nivel)
    {
        var nombre = NombreTipoPropio(t);
        var s = Sangria(nivel);
        bool delegado = t.BaseType?.FullName == "System.MulticastDelegate";
        if ((t.IsEnum || delegado) && tiposPropiosCompletos.Contains(t.FullName)) return false;
        propios.TryGetValue(t.FullName, out var hechos);
        bool propio = hechos != null;

        if (t.IsEnum)
        {
            if (t.CustomAttributes.Any(a => a.AttributeType.FullName == "System.FlagsAttribute")) sb.AppendLine(s + "[System.Flags]");
            var sub = t.Fields.First(f => f.Name == "value__").FieldType;
            sb.AppendLine($"{s}{Visibilidad(t)} enum {nombre} : {NombreRef(sub)}");
            sb.AppendLine(s + "{");
            foreach (var f in t.Fields.Where(f => f.IsStatic && f.HasConstant))
                sb.AppendLine($"{s}    {Id(f.Name)} = {Literal(f.Constant, sub)},");
            sb.AppendLine(s + "}");
            return true;
        }
        if (delegado)
        {
            var inv = t.Methods.First(m => m.Name == "Invoke");
            sb.AppendLine($"{s}{Visibilidad(t)} delegate {NombreRef(inv.ReturnType)} {nombre}{ParamsGen(t, true)}({Parametros(inv)}){Restricciones(t.GenericParameters, t)};");
            return true;
        }

        var cab = new StringBuilder();
        cab.Append(s).Append(Visibilidad(t)).Append(' ');
        if (t.IsInterface) cab.Append("partial interface ");
        else if (t.IsValueType) cab.Append("partial struct ");
        else
        {
            if (t.IsAbstract && t.IsSealed) cab.Append("static ");
            else if (t.IsAbstract) cab.Append("abstract ");
            else if (t.IsSealed) cab.Append("sealed ");
            cab.Append("partial class ");
        }
        cab.Append(nombre).Append(ParamsGen(t, true));
        var bases = new List<string>();
        if (!propio)
        {
            if (t.BaseType != null && !t.IsValueType && t.BaseType.FullName != "System.Object") bases.Add(NombreRef(t.BaseType));
            foreach (var i in t.Interfaces)
            {
                var id = Resolver(i.InterfaceType);
                if (id != null && !tipos.Contains(id)) continue;
                if (id == null && i.InterfaceType.Resolve() is { } sys && !sys.IsPublic) continue;
                bases.Add(NombreRef(i.InterfaceType));
            }
        }
        if (bases.Count > 0) cab.Append(" : ").Append(string.Join(", ", bases));
        cab.Append(Restricciones(t.GenericParameters.Skip(t.DeclaringType?.GenericParameters.Count ?? 0), t));
        if (t.CustomAttributes.Any(a => a.AttributeType.FullName == "System.AttributeUsageAttribute") && !propio)
        {
            var au = t.CustomAttributes.First(a => a.AttributeType.FullName == "System.AttributeUsageAttribute");
            var extra = string.Join("", au.Properties.Select(p => $", {p.Name} = {Literal(p.Argument.Value, p.Argument.Type)}"));
            sb.AppendLine($"{s}[System.AttributeUsage((System.AttributeTargets){Convert.ToInt64(au.ConstructorArguments[0].Value)}{extra})]");
        }
        sb.AppendLine(cab.ToString());
        sb.AppendLine(s + "{");
        var dentro = new StringBuilder();
        EscribirMiembros(dentro, t, nivel + 1, hechos ?? new HashSet<string>(), propio);
        foreach (var n in tipos.Where(x => x.DeclaringType == t).OrderBy(x => x.Name))
            EscribirTipo(dentro, n, nivel + 1);
        sb.Append(dentro);
        sb.AppendLine(s + "}");
        return true;
    }

    void EscribirMiembros(StringBuilder sb, TypeDefinition t, int nivel, HashSet<string> hechos, bool propio)
    {
        var s = Sangria(nivel);
        string Q(string m) => $"{t.FullName}::{m}";
        bool estatico = t.IsAbstract && t.IsSealed;

        // campos
        foreach (var f in t.Fields.Where(f => miembros.Contains(f) && !f.Name.StartsWith("<")))
        {
            if (hechos.Contains("F:" + f.Name)) continue;
            if (f.IsLiteral)
            {
                sb.AppendLine($"{s}{VisMiembro(f.IsPublic, f.IsFamily, f.IsFamilyOrAssembly)} const {NombreRef(f.FieldType)} {Id(f.Name)} = {Literal(f.Constant, f.FieldType)};");
                continue;
            }
            var mods = (f.IsStatic ? "static " : "") + (f.IsInitOnly && f.IsStatic ? "readonly " : "");
            sb.AppendLine($"{s}{VisMiembro(f.IsPublic, f.IsFamily, f.IsFamilyOrAssembly, true)} {mods}{NombreRef(f.FieldType)} {Id(f.Name)};");
        }

        var usados = t.Methods.Where(m => miembros.Contains(m)).ToList();
        var accesores = new HashSet<MethodDefinition>();

        // propiedades e indexadores
        foreach (var p in t.Properties)
        {
            var g = p.GetMethod != null && miembros.Contains(p.GetMethod) ? p.GetMethod : null;
            var st = p.SetMethod != null && miembros.Contains(p.SetMethod) ? p.SetMethod : null;
            if (g == null && st == null) continue;
            if (p.GetMethod != null) accesores.Add(p.GetMethod);
            if (p.SetMethod != null) accesores.Add(p.SetMethod);
            var acc = g ?? st;
            if (acc.Name.Contains('.'))
            {
                // implementación explícita de interfaz: Tipo Interfaz.Nombre { get; }
                var ov = acc.Overrides.FirstOrDefault();
                if (ov == null) continue;
                var nom = ov.Name.StartsWith("get_") || ov.Name.StartsWith("set_") ? ov.Name.Substring(4) : ov.Name;
                var partesE = new List<string>();
                if (p.GetMethod != null) partesE.Add($"get {{ global::Porteo.Falta.Llamada(\"{Q(nom)}\"); return default; }}");
                if (p.SetMethod != null) partesE.Add($"set {{ global::Porteo.Falta.Llamada(\"{Q(nom)}=\"); }}");
                sb.AppendLine($"{s}{NombreRef(p.PropertyType)} {NombreRef(ov.DeclaringType)}.{nom} {{ {string.Join(" ", partesE)} }}");
                continue;
            }
            bool indexador = p.Parameters.Count > 0;
            var clave = indexador ? "I:" + p.Parameters.Count : "P:" + p.Name;
            if (hechos.Contains(clave)) continue;
            // virtual o abstracta: las dos mitades, como en Unity
            if ((acc.IsVirtual || acc.IsAbstract) && !t.IsInterface)
            {
                if (p.GetMethod != null && !p.GetMethod.IsPrivate) g = p.GetMethod;
                if (p.SetMethod != null && !p.SetMethod.IsPrivate) st = p.SetMethod;
            }
            var mods = t.IsInterface ? "" : Modificadores(acc, estatico);
            var vis = t.IsInterface ? "" : VisMetodo(acc) + " ";
            var cab = indexador
                ? $"{NombreRef(p.PropertyType)} this[{string.Join(", ", p.Parameters.Select(Param))}]"
                : $"{NombreRef(p.PropertyType)} {Id(p.Name)}";
            if (t.IsInterface || acc.IsAbstract)
            {
                sb.AppendLine($"{s}{vis}{mods}{cab} {{ {(g != null ? "get; " : "")}{(st != null ? "set; " : "")}}}");
                continue;
            }
            var partes = new List<string>();
            if (g != null) partes.Add($"{VisAccesor(g, acc)}get {{ global::Porteo.Falta.Llamada(\"{Q(p.Name)}\"); return default; }}");
            if (st != null) partes.Add($"{VisAccesor(st, acc)}set {{ global::Porteo.Falta.Llamada(\"{Q(p.Name)}=\"); }}");
            sb.AppendLine($"{s}{vis}{mods}{cab} {{ {string.Join(" ", partes)} }}");
        }

        // eventos
        foreach (var e in t.Events)
        {
            if (!(e.AddMethod != null && miembros.Contains(e.AddMethod)) && !(e.RemoveMethod != null && miembros.Contains(e.RemoveMethod))) continue;
            accesores.Add(e.AddMethod); accesores.Add(e.RemoveMethod);
            if (hechos.Contains("E:" + e.Name)) continue;
            var mods = t.IsInterface ? "" : Modificadores(e.AddMethod, estatico);
            if (t.IsInterface) { sb.AppendLine($"{s}event {NombreRef(e.EventType)} {Id(e.Name)};"); continue; }
            sb.AppendLine($"{s}public {mods}event {NombreRef(e.EventType)} {Id(e.Name)} {{ add {{ global::Porteo.Falta.Llamada(\"{Q(e.Name)}+\"); }} remove {{ }} }}");
        }

        // métodos, constructores y operadores
        foreach (var m in usados)
        {
            if (accesores.Contains(m) || m.Name == ".cctor") continue;
            if (m.Name.Contains('.') && m.Name != ".ctor")
            {
                // implementación explícita de interfaz
                var ov = m.Overrides.FirstOrDefault();
                if (ov == null || t.IsInterface || hechos.Contains(ClaveMetodo(m))) continue;
                var retE = m.ReturnType.FullName == "System.Void" ? "" : " return default;";
                sb.AppendLine($"{s}{NombreRef(m.ReturnType)} {NombreRef(ov.DeclaringType)}.{Id(ov.Name)}({Parametros(m)}) {AsignarOut(m, $"{{ global::Porteo.Falta.Llamada(\"{Q(ov.Name)}\");{retE} }}")}");
                continue;
            }
            var clave = ClaveMetodo(m);
            if (hechos.Contains(clave)) continue;
            if (m.IsConstructor)
            {
                if (m.IsStatic) continue;
                var nombreCtor = NombreTipoPropio(t);
                var baseCtor = "";
                if (!t.IsValueType && t.BaseType != null && t.BaseType.FullName != "System.Object")
                {
                    var bd = Resolver(t.BaseType);
                    if (bd != null)
                    {
                        var ctors = bd.Methods.Where(x => x.IsConstructor && !x.IsStatic && miembros.Contains(x)).OrderBy(x => x.Parameters.Count).ToList();
                        if (ctors.Count > 0 && ctors[0].Parameters.Count > 0)
                            baseCtor = " : base(" + string.Join(", ", ctors[0].Parameters.Select(p => "default(" + NombreRef(p.ParameterType) + ")")) + ")";
                    }
                }
                var cuerpoCtor = t.IsValueType ? "{ this = default; }" : $"{{ global::Porteo.Falta.Llamada(\"{Q(".ctor")}\"); }}";
                if (t.IsAbstract && !t.IsSealed && m.Parameters.Count == 0 && !m.IsPublic) cuerpoCtor = "{ }";
                sb.AppendLine($"{s}{VisMetodo(m)} {nombreCtor}({Parametros(m)}){baseCtor} {AsignarOut(m, cuerpoCtor)}");
                continue;
            }
            if (m.IsSpecialName && m.Name.StartsWith("op_"))
            {
                var sig = m.Name is "op_Implicit" or "op_Explicit"
                    ? $"public static {(m.Name == "op_Implicit" ? "implicit" : "explicit")} operator {NombreRef(m.ReturnType)}({Parametros(m)})"
                    : $"public static {NombreRef(m.ReturnType)} operator {Operador(m.Name)}({Parametros(m)})";
                sb.AppendLine($"{s}{sig} {{ global::Porteo.Falta.Llamada(\"{Q(m.Name)}\"); return default; }}");
                continue;
            }
            var firma = $"{NombreRef(m.ReturnType)} {Id(m.Name)}{ParamsGen(m)}({Parametros(m)}){Restricciones(m.GenericParameters, null)}";
            if (t.IsInterface) { sb.AppendLine($"{s}{firma};"); continue; }
            var modsM = Modificadores(m, estatico);
            if (m.IsAbstract) { sb.AppendLine($"{s}{VisMetodo(m)} {modsM}{firma};"); continue; }
            var ret = m.ReturnType.FullName == "System.Void" ? "" : " return default;";
            sb.AppendLine($"{s}{VisMetodo(m)} {modsM}{firma} {AsignarOut(m, $"{{ global::Porteo.Falta.Llamada(\"{Q(m.Name)}\");{ret} }}")}");
        }
    }

    static string AsignarOut(MethodDefinition m, string cuerpo)
    {
        var outs = m.Parameters.Where(p => p.IsOut && p.ParameterType is ByReferenceType).Select(p => Id(p.Name) + " = default;").ToList();
        if (outs.Count == 0) return cuerpo;
        return "{ " + string.Join(" ", outs) + " " + cuerpo.TrimStart('{').TrimEnd().TrimEnd('}') + " }";
    }

    public static string ClaveMetodo(MethodDefinition m)
    {
        var n = m.IsConstructor ? ".ctor" : m.Name;
        // las implementaciones explícitas de interfaz ("UnityEngine.ISerializationCallbackReceiver.OnBeforeSerialize")
        // se escriben a mano con el nombre corto
        int punto = n.LastIndexOf('.');
        if (!m.IsConstructor && punto > 0) n = n.Substring(punto + 1);
        return "M:" + n + "`" + m.GenericParameters.Count + "(" + string.Join(",", m.Parameters.Select(p => Sintaxis.Simple(NombreSimple(p.ParameterType)))) + ")";
    }

    static string NombreSimple(TypeReference t)
    {
        switch (t)
        {
            case ByReferenceType br: return NombreSimple(br.ElementType);
            case ArrayType at: return NombreSimple(at.ElementType) + "[]";
            case GenericInstanceType gi: return Regex.Replace(gi.ElementType.Name, "`\\d+", "") + "<" + string.Join(",", gi.GenericArguments.Select(NombreSimple)) + ">";
            case GenericParameter gp: return gp.Name;
            default: return Regex.Replace(t.Name, "`\\d+", "");
        }
    }

    string Modificadores(MethodDefinition m, bool tipoEstatico)
    {
        var sb = new StringBuilder();
        if (m.IsStatic) sb.Append("static ");
        if (m.IsAbstract) sb.Append("abstract ");
        else if (m.IsVirtual && !m.IsFinal && m.IsNewSlot) sb.Append("virtual ");
        else if (m.IsVirtual && !m.IsNewSlot) sb.Append(m.IsFinal ? "sealed override " : "override ");
        return sb.ToString();
    }

    static string VisMetodo(MethodDefinition m) => m.IsPublic || m.IsAssembly || m.IsFamilyOrAssembly ? "public" : m.IsFamily || m.IsFamilyAndAssembly ? "protected" : "public";
    static string VisMiembro(bool pub, bool fam, bool famOAsm, bool campo = false) => pub ? "public" : fam ? "protected" : "public";
    static string VisAccesor(MethodDefinition acc, MethodDefinition principal)
    {
        var a = VisMetodo(acc); var p = VisMetodo(principal);
        return a == p ? "" : a + " ";
    }
    static string Visibilidad(TypeDefinition t) => "public";

    static string Operador(string n) => n switch
    {
        "op_Addition" => "+", "op_Subtraction" => "-", "op_Multiply" => "*", "op_Division" => "/", "op_Modulus" => "%",
        "op_Equality" => "==", "op_Inequality" => "!=", "op_LessThan" => "<", "op_GreaterThan" => ">",
        "op_LessThanOrEqual" => "<=", "op_GreaterThanOrEqual" => ">=", "op_UnaryNegation" => "-", "op_UnaryPlus" => "+",
        "op_LogicalNot" => "!", "op_True" => "true", "op_False" => "false", "op_BitwiseAnd" => "&", "op_BitwiseOr" => "|",
        "op_ExclusiveOr" => "^", "op_OnesComplement" => "~", "op_LeftShift" => "<<", "op_RightShift" => ">>",
        "op_Increment" => "++", "op_Decrement" => "--",
        _ => throw new NotSupportedException(n),
    };

    string ParamsGen(TypeDefinition t, bool def)
    {
        var propios = t.GenericParameters.Skip(t.DeclaringType?.GenericParameters.Count ?? 0).ToList();
        return propios.Count == 0 ? "" : "<" + string.Join(", ", propios.Select(p => p.Name)) + ">";
    }

    static string ParamsGen(MethodDefinition m) => m.GenericParameters.Count == 0 ? "" : "<" + string.Join(", ", m.GenericParameters.Select(p => p.Name)) + ">";

    string Restricciones(IEnumerable<GenericParameter> gps, TypeDefinition t)
    {
        var sb = new StringBuilder();
        foreach (var gp in gps)
        {
            var cs = new List<string>();
            if (gp.HasReferenceTypeConstraint) cs.Add("class");
            if (gp.HasNotNullableValueTypeConstraint) cs.Add("struct");
            foreach (var c in gp.Constraints)
            {
                if (c.ConstraintType.FullName == "System.ValueType") continue;
                cs.Add(NombreRef(c.ConstraintType));
            }
            if (gp.HasDefaultConstructorConstraint && !gp.HasNotNullableValueTypeConstraint) cs.Add("new()");
            if (cs.Count > 0) sb.Append(" where ").Append(gp.Name).Append(" : ").Append(string.Join(", ", cs));
        }
        return sb.ToString();
    }

    string Parametros(MethodDefinition m) => string.Join(", ", m.Parameters.Select(Param));

    string Param(ParameterDefinition p)
    {
        var sb = new StringBuilder();
        if (p.CustomAttributes.Any(a => a.AttributeType.FullName == "System.ParamArrayAttribute")) sb.Append("params ");
        var tipo = p.ParameterType;
        if (tipo is ByReferenceType br)
        {
            sb.Append(p.IsOut ? "out " : p.IsIn && p.CustomAttributes.Any(a => a.AttributeType.Name == "IsReadOnlyAttribute") ? "in " : "ref ");
            tipo = br.ElementType;
        }
        sb.Append(NombreRef(tipo)).Append(' ').Append(Id(string.IsNullOrEmpty(p.Name) ? "p" + p.Index : p.Name));
        if (p.HasConstant && p.ParameterType is not ByReferenceType) sb.Append(" = ").Append(Literal(p.Constant, p.ParameterType));
        else if (p.IsOptional && !p.HasConstant && p.ParameterType is not ByReferenceType) sb.Append(" = default");
        return sb.ToString();
    }

    static readonly Dictionary<string, string> ALIAS = new()
    {
        ["System.Void"] = "void", ["System.Boolean"] = "bool", ["System.Byte"] = "byte", ["System.SByte"] = "sbyte",
        ["System.Int16"] = "short", ["System.UInt16"] = "ushort", ["System.Int32"] = "int", ["System.UInt32"] = "uint",
        ["System.Int64"] = "long", ["System.UInt64"] = "ulong", ["System.Single"] = "float", ["System.Double"] = "double",
        ["System.Char"] = "char", ["System.String"] = "string", ["System.Object"] = "object", ["System.Decimal"] = "decimal",
    };

    string NombreRef(TypeReference t)
    {
        switch (t)
        {
            case GenericParameter gp: return gp.Name;
            case ByReferenceType br: return NombreRef(br.ElementType);
            case ArrayType at: return NombreRef(at.ElementType) + "[" + new string(',', at.Rank - 1) + "]";
            case PointerType pt: return NombreRef(pt.ElementType) + "*";
            case RequiredModifierType rm: return NombreRef(rm.ElementType);
            case OptionalModifierType om: return NombreRef(om.ElementType);
            case GenericInstanceType gi:
            {
                // los argumentos se reparten entre el tipo de afuera y el anidado
                var elem = gi.ElementType;
                var args = gi.GenericArguments.ToList();
                return NombreConArgs(elem, args);
            }
        }
        if (ALIAS.TryGetValue(t.FullName, out var a)) return a;
        if (t.HasGenericParameters) return NombreConArgs(t, t.GenericParameters.Cast<TypeReference>().ToList());
        return NombreConArgs(t, new List<TypeReference>());
    }

    string NombreConArgs(TypeReference t, List<TypeReference> args)
    {
        // cadena de anidamiento de afuera hacia adentro
        var cadena = new List<TypeReference>();
        for (var x = t; x != null; x = x.DeclaringType) cadena.Insert(0, x);
        var sb = new StringBuilder("global::");
        if (!string.IsNullOrEmpty(cadena[0].Namespace)) sb.Append(cadena[0].Namespace).Append('.');
        int usados = 0;
        for (int i = 0; i < cadena.Count; i++)
        {
            var c = cadena[i];
            var m = Regex.Match(c.Name, "`(\\d+)$");
            var nombre = Regex.Replace(c.Name, "`\\d+$", "");
            if (i > 0) sb.Append('.');
            sb.Append(nombre);
            if (m.Success)
            {
                int n = int.Parse(m.Groups[1].Value);
                var mios = args.Skip(usados).Take(n).ToList();
                usados += n;
                sb.Append('<').Append(string.Join(", ", mios.Select(NombreRef))).Append('>');
            }
        }
        return sb.ToString();
    }

    static string NombreTipoPropio(TypeDefinition t) => Id(Regex.Replace(t.Name, "`\\d+$", ""));

    static readonly HashSet<string> RESERVADAS = new()
    {
        "abstract", "as", "base", "bool", "break", "byte", "case", "catch", "char", "checked", "class", "const", "continue",
        "decimal", "default", "delegate", "do", "double", "else", "enum", "event", "explicit", "extern", "false", "finally",
        "fixed", "float", "for", "foreach", "goto", "if", "implicit", "in", "int", "interface", "internal", "is", "lock", "long",
        "namespace", "new", "null", "object", "operator", "out", "override", "params", "private", "protected", "public",
        "readonly", "ref", "return", "sbyte", "sealed", "short", "sizeof", "stackalloc", "static", "string", "struct",
        "switch", "this", "throw", "true", "try", "typeof", "uint", "ulong", "unchecked", "unsafe", "ushort", "using",
        "virtual", "void", "volatile", "while",
    };

    static string Id(string n) => RESERVADAS.Contains(n) ? "@" + n : n;

    string Literal(object v, TypeReference tipo)
    {
        if (v == null) return tipo != null && tipo.IsValueType && !(tipo.FullName.StartsWith("System.")) ? "default" : "null";
        var td = tipo?.Resolve();
        if (td != null && td.IsEnum)
        {
            return $"({NombreRef(tipo)})({Convert.ToInt64(v)})";
        }
        return v switch
        {
            bool b => b ? "true" : "false",
            string s => "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"",
            char c => "'" + (c == '\'' ? "\\'" : c == '\\' ? "\\\\" : c.ToString()) + "'",
            float f => float.IsPositiveInfinity(f) ? "float.PositiveInfinity" : float.IsNegativeInfinity(f) ? "float.NegativeInfinity" : float.IsNaN(f) ? "float.NaN" : f.ToString("R", System.Globalization.CultureInfo.InvariantCulture) + "f",
            double d => double.IsPositiveInfinity(d) ? "double.PositiveInfinity" : double.IsNegativeInfinity(d) ? "double.NegativeInfinity" : double.IsNaN(d) ? "double.NaN" : d.ToString("R", System.Globalization.CultureInfo.InvariantCulture) + "d",
            uint u => u + "u",
            long l => l + "L",
            ulong ul => ul + "UL",
            _ => Convert.ToString(v, System.Globalization.CultureInfo.InvariantCulture),
        };
    }

    // ── fachadas ─────────────────────────────────────────────────────────────
    void EscribirFachadas()
    {
        Directory.CreateDirectory(opc.Fachadas);
        foreach (var (mod, set) in porModulo)
        {
            if (mod == NUESTRO) continue;
            var dir = Path.Combine(opc.Fachadas, mod);
            Directory.CreateDirectory(dir);
            var sb = new StringBuilder("// <auto-generated> porteo: generar (el IL pide estos tipos por " + mod + "; están en " + NUESTRO + ")</auto-generated>\n");
            foreach (var n in set)
            {
                if (!unity.TryGetValue(n, out var td)) continue;
                var nombre = NombreRef(td);
                if (td.HasGenericParameters) nombre = Regex.Replace(nombre, "<[^<>]*>$", m => "<" + new string(',', m.Value.Count(c => c == ',')) + ">");
                sb.AppendLine($"[assembly: System.Runtime.CompilerServices.TypeForwardedTo(typeof({nombre}))]");
            }
            File.WriteAllText(Path.Combine(dir, mod + ".cs"), sb.ToString());
            File.WriteAllText(Path.Combine(dir, mod + ".csproj"), $@"<Project Sdk=""Microsoft.NET.Sdk"">
  <!-- <auto-generated> porteo: generar. Fachada: el IL del juego pide tipos por {mod}. -->
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <AssemblyName>{mod}</AssemblyName>
    <AssemblyVersion>0.0.0.0</AssemblyVersion>
    <FileVersion>0.0.0.0</FileVersion>
    <EnableDefaultCompileItems>false</EnableDefaultCompileItems>
    <ImplicitUsings>disable</ImplicitUsings>
    <IsTrimmable>true</IsTrimmable>
  </PropertyGroup>
  <ItemGroup>
    <Compile Include=""{mod}.cs"" />
    <ProjectReference Include=""../../UnityEngine/UnityEngine.CoreModule.csproj"" />
  </ItemGroup>
</Project>
");
        }
        Console.WriteLine("fachadas: " + string.Join(", ", porModulo.Keys.Where(k => k != NUESTRO)));
    }
}

// Lectura de lo escrito a mano, sin Roslyn: tipos (con su anidamiento) y la firma simplificada de
// sus miembros, para no generar lo que ya existe.
static class Sintaxis
{
    static readonly Regex NS = new(@"\bnamespace\s+([\w.]+)\s*$", RegexOptions.Compiled);
    static readonly Regex TIPO = new(@"\b(class|struct|interface|enum)\s+(\w+)\s*(<[^>]*>)?\s*(:[^{]*)?$", RegexOptions.Compiled);
    static readonly Regex DELEGADO = new(@"\bdelegate\s+[\w.<>\[\], ?]+?\s+(\w+)\s*(<[^>(]*>)?\s*\(", RegexOptions.Compiled);

    public static void Leer(string texto, Dictionary<string, HashSet<string>> propios, HashSet<string> completos)
    {
        texto = Regex.Replace(texto, @"/\*.*?\*/", "", RegexOptions.Singleline);
        texto = Regex.Replace(texto, @"//[^\n]*", "");
        texto = Regex.Replace(texto, "@?\"(?:[^\"\\\\]|\\\\.)*\"", "\"\"");
        texto = Regex.Replace(texto, @"'(?:[^'\\]|\\.)'", "' '");
        texto = Regex.Replace(texto, @"^\s*#.*$", "", RegexOptions.Multiline);
        var pila = new List<(string clase, string nombre, int prof)>();
        int prof = 0, inicio = 0;
        for (int i = 0; i < texto.Length; i++)
        {
            char c = texto[i];
            if (c != '{' && c != '}' && c != ';') continue;
            // los atributos ([SerializeField]...) se sacan; los corchetes de arreglos (int[]) e
            // indexadores (this[int i]) no, porque van pegados a un nombre o a otro cierre
            var trozo = Regex.Replace(Regex.Replace(texto.Substring(inicio, i - inicio), @"(?<![\w>\)\?\]])\[[^\]]*\]", " "), @"\s+", " ").Trim();
            inicio = i + 1;
            bool enTipo = pila.Count > 0 && pila[^1].clase != "namespace" && prof == pila[^1].prof + 1;
            bool enNs = pila.Count == 0 || pila[^1].clase == "namespace" && prof == pila[^1].prof + 1;
            if (c == '{')
            {
                Match m;
                if ((m = NS.Match(trozo)).Success) pila.Add(("namespace", m.Groups[1].Value, prof));
                else if ((enTipo || enNs) && (m = TIPO.Match(Regex.Replace(trozo, @"\bwhere\b.*$", ""))).Success)
                {
                    pila.Add((m.Groups[1].Value, m.Groups[2].Value + Aridad(m.Groups[3].Value), prof));
                    var n = NombreActual(pila);
                    Registrar(propios, n, null);
                    if (m.Groups[1].Value == "enum") completos.Add(n);
                }
                else if (enTipo) Miembro(propios, NombreActual(pila), trozo, pila[^1].nombre);
                prof++;
            }
            else if (c == '}')
            {
                prof--;
                if (pila.Count > 0 && pila[^1].prof == prof) pila.RemoveAt(pila.Count - 1);
            }
            else // ;
            {
                var md = DELEGADO.Match(trozo);
                if (md.Success && (enTipo || enNs))
                {
                    var baseN = NombreActual(pila);
                    var n = enTipo ? baseN + "/" + md.Groups[1].Value + Aridad(md.Groups[2].Value)
                                   : (baseN.Length > 0 ? baseN + "." : "") + md.Groups[1].Value + Aridad(md.Groups[2].Value);
                    completos.Add(n); Registrar(propios, n, null);
                }
                else if (enTipo) Miembro(propios, NombreActual(pila), trozo, pila[^1].nombre);
            }
        }
    }

    static string Aridad(string gen) => string.IsNullOrWhiteSpace(gen) ? "" : "`" + (gen.Count(ch => ch == ',') + 1);

    static string NombreActual(List<(string clase, string nombre, int prof)> pila)
    {
        var ns = string.Join(".", pila.Where(p => p.clase == "namespace").Select(p => p.nombre));
        var tipos = pila.Where(p => p.clase != "namespace").Select(p => p.nombre).ToList();
        if (tipos.Count == 0) return ns;
        return (ns.Length > 0 ? ns + "." : "") + string.Join("/", tipos);
    }

    static void Registrar(Dictionary<string, HashSet<string>> propios, string tipo, string miembro)
    {
        if (!propios.TryGetValue(tipo, out var s)) propios[tipo] = s = new HashSet<string>();
        if (miembro != null) s.Add(miembro);
    }

    static readonly Regex INICIO_METODO = new(@"\b(\w+)\s*(<[^()]*>)?\s*\(", RegexOptions.Compiled);

    static void Miembro(Dictionary<string, HashSet<string>> propios, string tipo, string t, string nombreTipo)
    {
        if (t.Length == 0) return;
        var flecha = t.IndexOf("=>");
        if (flecha >= 0) t = t.Substring(0, flecha).Trim();
        Match m;
        if ((m = Regex.Match(t, @"\bevent\s+.+?\s+(\w+)\s*$")).Success) { Registrar(propios, tipo, "E:" + m.Groups[1].Value); return; }
        if ((m = Regex.Match(t, @"\bthis\s*\[(.*)\]\s*$")).Success) { Registrar(propios, tipo, "I:" + Params(m.Groups[1].Value).Count); return; }
        if ((m = Regex.Match(t, @"\b(implicit|explicit)\s+operator\s+[\w.<>\[\], ?]+?\s*\((.*)\)\s*$")).Success)
        {
            Registrar(propios, tipo, "M:" + (m.Groups[1].Value == "implicit" ? "op_Implicit" : "op_Explicit") + "`0(" + string.Join(",", Params(m.Groups[2].Value).Select(Simple)) + ")");
            return;
        }
        if ((m = Regex.Match(t, @"\boperator\s*([^\s(]+)\s*\((.*)\)\s*$")).Success)
        {
            var ps = Params(m.Groups[2].Value);
            Registrar(propios, tipo, "M:" + OpNombre(m.Groups[1].Value, ps.Count) + "`0(" + string.Join(",", ps.Select(Simple)) + ")");
            return;
        }
        var igual = PrimerIgual(t);
        var cabeza = igual >= 0 ? t.Substring(0, igual).Trim() : t;
        if ((m = INICIO_METODO.Match(cabeza)).Success)
        {
            var nombre = m.Groups[1].Value;
            if (nombre is "if" or "while" or "for" or "foreach" or "switch" or "using" or "lock" or "catch" or "return" or "new" or "typeof" or "sizeof" or "nameof" or "base" or "this") return;
            // los parámetros hasta el paréntesis que cierra (después puede venir ": this(...)" o "where")
            int a = m.Index + m.Length, prof = 1, j = a;
            for (; j < cabeza.Length && prof > 0; j++)
            {
                if (cabeza[j] == '(') prof++;
                else if (cabeza[j] == ')') prof--;
            }
            var pars = cabeza.Substring(a, Math.Max(0, j - 1 - a));
            var gen = m.Groups[2].Success ? m.Groups[2].Value.Count(ch => ch == ',') + 1 : 0;
            if (nombre == nombreTipo.Split('`')[0]) nombre = ".ctor";
            Registrar(propios, tipo, "M:" + nombre + "`" + gen + "(" + string.Join(",", Params(pars).Select(Simple)) + ")");
            return;
        }
        // campo(s) o propiedad: los nombres son los identificadores después del tipo
        if ((m = Regex.Match(cabeza, @"^[\w\s.<>\[\],?]*?[\w>\]?]\s+(\w+(\s*,\s*\w+)*)$")).Success)
            foreach (var n in m.Groups[1].Value.Split(','))
            {
                Registrar(propios, tipo, "F:" + n.Trim());
                Registrar(propios, tipo, "P:" + n.Trim());
            }
    }

    // el primer '=' de primer nivel que no es parte de ==, <=, >=, !=
    static int PrimerIgual(string t)
    {
        int prof = 0;
        for (int i = 0; i < t.Length; i++)
        {
            char c = t[i];
            if (c is '(' or '<' or '[') prof++;
            else if (c is ')' or '>' or ']') prof--;
            else if (c == '=' && prof == 0)
            {
                char a = i > 0 ? t[i - 1] : ' ', d = i + 1 < t.Length ? t[i + 1] : ' ';
                if (a is '=' or '!' or '<' or '>' || d == '=') continue;
                return i;
            }
        }
        return -1;
    }

    static string OpNombre(string op, int n) => op switch
    {
        "+" => n == 1 ? "op_UnaryPlus" : "op_Addition", "-" => n == 1 ? "op_UnaryNegation" : "op_Subtraction",
        "*" => "op_Multiply", "/" => "op_Division", "%" => "op_Modulus", "==" => "op_Equality", "!=" => "op_Inequality",
        "<" => "op_LessThan", ">" => "op_GreaterThan", "<=" => "op_LessThanOrEqual", ">=" => "op_GreaterThanOrEqual",
        "!" => "op_LogicalNot", "true" => "op_True", "false" => "op_False", "&" => "op_BitwiseAnd", "|" => "op_BitwiseOr",
        "^" => "op_ExclusiveOr", "~" => "op_OnesComplement", "<<" => "op_LeftShift", ">>" => "op_RightShift",
        "++" => "op_Increment", "--" => "op_Decrement", _ => "op_?",
    };

    // separa los parámetros por comas de primer nivel y deja sólo el tipo
    static List<string> Params(string s)
    {
        var r = new List<string>(); int prof = 0; var sb = new StringBuilder();
        foreach (var c in s)
        {
            if (c is '<' or '(' or '[') prof++;
            if (c is '>' or ')' or ']') prof--;
            if (c == ',' && prof == 0) { r.Add(sb.ToString()); sb.Clear(); } else sb.Append(c);
        }
        if (sb.ToString().Trim().Length > 0) r.Add(sb.ToString());
        return r.Select(p =>
        {
            var i0 = PrimerIgual(p); if (i0 >= 0) p = p.Substring(0, i0);
            p = p.Trim();
            p = Regex.Replace(p, @"^(this|params|ref|out|in)\s+", "");
            var i = p.LastIndexOf(' ');
            return i > 0 ? p.Substring(0, i).Trim() : p;
        }).ToList();
    }

    static readonly Dictionary<string, string> ALIAS = new()
    {
        ["bool"] = "Boolean", ["byte"] = "Byte", ["sbyte"] = "SByte", ["short"] = "Int16", ["ushort"] = "UInt16", ["int"] = "Int32",
        ["uint"] = "UInt32", ["long"] = "Int64", ["ulong"] = "UInt64", ["float"] = "Single", ["double"] = "Double", ["char"] = "Char",
        ["string"] = "String", ["object"] = "Object", ["decimal"] = "Decimal", ["void"] = "Void",
    };

    // "global::UnityEngine.Vector3[]" → "Vector3[]"; "List<int>" → "List<Int32>"
    public static string Simple(string t)
    {
        t = t.Replace("global::", "").Replace(" ", "");
        var m = Regex.Match(t, @"^([\w.]+)(<(.*)>)?((\[,*\])*)$");
        if (!m.Success) return t;
        var nombre = m.Groups[1].Value;
        var corto = nombre.Contains('.') ? nombre.Substring(nombre.LastIndexOf('.') + 1) : nombre;
        if (ALIAS.TryGetValue(corto, out var a)) corto = a;
        var gen = m.Groups[3].Success ? "<" + string.Join(",", Params2(m.Groups[3].Value).Select(Simple)) + ">" : "";
        var arr = Regex.Replace(m.Groups[4].Value, @"\[,+\]", "[]");
        return corto + gen + arr;
    }

    static List<string> Params2(string s)
    {
        var r = new List<string>(); int prof = 0; var sb = new StringBuilder();
        foreach (var c in s)
        {
            if (c is '<' or '(' or '[') prof++;
            if (c is '>' or ')' or ']') prof--;
            if (c == ',' && prof == 0) { r.Add(sb.ToString()); sb.Clear(); } else sb.Append(c);
        }
        if (sb.Length > 0) r.Add(sb.ToString());
        return r;
    }
}

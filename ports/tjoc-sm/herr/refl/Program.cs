using System.Reflection;
var asm = Assembly.Load(args[0]);
foreach (var t in asm.GetExportedTypes()) {
  if (!System.Text.RegularExpressions.Regex.IsMatch(t.FullName, args[1])) continue;
  Console.WriteLine("== " + t.FullName + " : " + t.BaseType?.Name);
  foreach (var m in t.GetMembers(BindingFlags.Public|BindingFlags.Instance|BindingFlags.Static|BindingFlags.DeclaredOnly)) {
    var s = m.ToString(); if (m is MethodBase mb) s += "  (" + string.Join(", ", mb.GetParameters().Select(p => p.Name + (p.HasDefaultValue ? "=" + p.DefaultValue : ""))) + ")"; if (s.Contains("get_")||s.Contains("set_")) continue; Console.WriteLine("   " + m.MemberType + " " + s);
  }
}

using System;
using System.Linq;
using System.Reflection;
using System.Diagnostics;

// porteo: el arranque. Por ahora, una prueba: cargar todos los tipos del juego sobre el motor.
Console.WriteLine("porteo: .NET " + Environment.Version);
var sw = Stopwatch.StartNew();
foreach (var nombre in new[] { "Assembly-CSharp", "Assembly-UnityScript", "Logger", "UnityEngine.UI" })
{
    var asm = Assembly.Load(nombre);
    Type[] tipos;
    try { tipos = asm.GetTypes(); }
    catch (ReflectionTypeLoadException e)
    {
        tipos = e.Types.Where(t => t != null).ToArray();
        foreach (var le in e.LoaderExceptions.Distinct().Take(20)) Console.WriteLine("  no carga: " + le.Message);
    }
    Console.WriteLine($"{nombre}: {tipos.Length} tipos, {tipos.Count(t => typeof(UnityEngine.MonoBehaviour).IsAssignableFrom(t))} MonoBehaviour");
}
Console.WriteLine($"({sw.ElapsedMilliseconds} ms)");

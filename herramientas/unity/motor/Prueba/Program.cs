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
var faltan = Porteo.Falta.Vistos.ToList();
Console.WriteLine($"porteo: {faltan.Count} miembros sin hacer usados:");
foreach (var f in faltan) Console.WriteLine("  " + f);

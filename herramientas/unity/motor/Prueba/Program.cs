using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using Porteo;
using UnityEngine;

// porteo: prueba del motor en consola. DATOS es la salida de exportar/exportar.py.
var datos = args.Length > 0 ? args[0] : "/tmp/claude-0/slime/datos-motor-todo";
int escena = args.Length > 1 ? int.Parse(args[1]) : 0;
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

var reloj = Stopwatch.StartNew();
Porteo.Motor.Iniciar(escenas, escena);
Console.WriteLine($"porteo: arranque en {reloj.ElapsedMilliseconds} ms");
reloj.Restart();
for (int i = 0; i < cuadros; i++) Mundo.Cuadro(1 / 60.0);
Console.WriteLine($"porteo: {cuadros} cuadros en {reloj.ElapsedMilliseconds} ms; t={Time.time:F2}; activa: {UnityEngine.SceneManagement.SceneManager.GetActiveScene().name}");
var faltan = Porteo.Falta.Vistos.ToList();
Console.WriteLine($"porteo: {faltan.Count} miembros sin hacer usados:");
foreach (var f in faltan) Console.WriteLine("  " + f);

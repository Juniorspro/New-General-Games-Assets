using System;
using System.Runtime.InteropServices.JavaScript;
using Porteo;
using UnityEngine;

// porteo: el anfitrión del navegador. main.js arranca .NET, trae los datos y llama a Iniciar;
// después, en cada requestAnimationFrame, a Cuadro. Los datos pasan de JS a C# copiando a
// memoria de .NET (MemoryView) sin pasar por cadenas ni base64.
public static partial class Programa
{
    public static void Main() => Console.WriteLine("porteo: .NET " + Environment.Version + " listo");

    [JSImport("tamanoPaquete", "porteo")] internal static partial int TamanoPaquete(string nombre);
    [JSImport("copiarPaquete", "porteo")] internal static partial void CopiarPaquete(string nombre, [JSMarshalAs<JSType.MemoryView>] Span<byte> destino);
    [JSImport("tamanoRecurso", "porteo")] internal static partial int TamanoRecurso(int id);
    [JSImport("copiarRecurso", "porteo")] internal static partial void CopiarRecurso(int id, [JSMarshalAs<JSType.MemoryView>] Span<byte> destino);
    [JSImport("pedirRecurso", "porteo")] internal static partial void PedirRecurso(int id);
    [JSImport("consola", "porteo")] internal static partial void Consola(string texto, int tipo);

    static byte[] Paquete(string n)
    {
        int t = TamanoPaquete(n);
        if (t < 0) return null;
        var b = new byte[t];
        CopiarPaquete(n, b);
        return b;
    }

    static byte[] Recurso(int id)
    {
        int t = TamanoRecurso(id);
        if (t < 0) return null;
        var b = new byte[t];
        CopiarRecurso(id, b);
        return b;
    }

    [JSExport]
    public static void Iniciar(string[] escenas, int primera, double dpi, bool movil)
    {
        Anfitrion.LeerPaquete = Paquete;
        Anfitrion.LeerRecurso = Recurso;
        Anfitrion.PedirRecurso = PedirRecurso;
        Anfitrion.HayRecurso = id => TamanoRecurso(id) >= 0;
        Anfitrion.Consola = (t, tipo) => Consola(t, (int)tipo);
        Pantalla.Dpi = (float)dpi;
        Plataforma.Movil = movil;
        if (Porteo.Render.Gpu.Iniciar("#lienzo", false)) Porteo.Render.Dibujo.Iniciar();
        try { Porteo.Motor.Iniciar(escenas, primera); }
        catch (Exception e) { Debug.LogException(e); }
    }

    [JSExport]
    public static void Cuadro(double dt)
    {
        try
        {
            Adelantando();
            Mundo.Cuadro(dt);
        }
        catch (Exception e) { Debug.LogException(e); }
    }

    // ?adelantar=N: al llegar a la escena pedida se simulan N segundos de juego sin dibujar (en
    // tandas, para no colgar la página), así una captura muestra la escena ya andando aunque el
    // navegador dibuje lento
    static double adelantar;
    static string escenaAdelantar;
    [JSExport] public static void Adelantar(double segundos, string escena) { adelantar = segundos; escenaAdelantar = escena; }

    static void Adelantando()
    {
        if (adelantar <= 0) return;
        if (UnityEngine.SceneManagement.SceneManager.GetActiveScene().name != escenaAdelantar) return;
        Porteo.Render.Dibujo.Omitir = true;
        try
        {
            for (int i = 0; i < 120 && adelantar > 0 && !Mundo.Esperando; i++)
            {
                Mundo.Cuadro(1 / 30.0);
                adelantar -= 1 / 30.0;
            }
        }
        finally { Porteo.Render.Dibujo.Omitir = false; }
        if (adelantar <= 0) Debug.Log("porteo: listo el adelanto");
    }

    // la entrada: main.js ya traduce las teclas a KeyCode y las coordenadas a píxeles del lienzo
    // con el origen abajo a la izquierda (como Input.mousePosition)
    [JSExport] public static void PerfilGpu(bool si) => Porteo.Render.Dibujo.PerfilGpu = si;
    [JSExport] public static void Apagar(string que)
    {
        if (que == "aniso") Porteo.Render.Gpu.SinAnisotropia = true;
        else Porteo.Render.Dibujo.Apagado.Add(que);
    }
    [JSExport] public static void Tecla(int codigo, bool baja) => Entrada.Tecla(codigo, baja);
    [JSExport] public static void BotonRaton(int boton, bool baja) => Entrada.BotonRaton(boton, baja);
    [JSExport] public static void Raton(double x, double y) => Entrada.Raton((float)x, (float)y);
    [JSExport] public static void Rueda(double dx, double dy) => Entrada.Rueda((float)dx, (float)dy);
    [JSExport] public static void Texto(string s) => Entrada.Texto(s);
    [JSExport] public static void Toque(int dedo, int fase, double x, double y) => Entrada.Toque(dedo, fase, (float)x, (float)y);
}

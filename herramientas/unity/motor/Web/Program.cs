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
    [JSImport("audioCargar", "porteo")] internal static partial void AudioCargar(int recurso, bool streaming);
    [JSImport("audioEstado", "porteo")] internal static partial int AudioEstado(int recurso);
    [JSImport("audioTocar", "porteo")] internal static partial void AudioTocar(int voz, int recurso, bool streaming, double desde, bool bucle, double volumen, double tono, double pan, double corte);
    [JSImport("audioAjustar", "porteo")] internal static partial void AudioAjustar(int voz, double volumen, double tono, double pan, double corte);
    [JSImport("audioParar", "porteo")] internal static partial void AudioParar(int voz);
    [JSImport("audioPausar", "porteo")] internal static partial void AudioPausar(int voz, bool pausa, double desde);
    [JSImport("audioFrecuencia", "porteo")] internal static partial int AudioFrecuencia();

    [JSImport("fuenteRegistrar", "porteo")] internal static partial void FuenteRegistrar(int fuente, [JSMarshalAs<JSType.MemoryView>] Span<byte> ttf);
    [JSImport("discoGuardar", "porteo")] internal static partial void DiscoGuardar(string ruta, [JSMarshalAs<JSType.MemoryView>] Span<byte> datos);
    [JSImport("discoBorrar", "porteo")] internal static partial void DiscoBorrar(string ruta);
    [JSImport("fuenteRasterizar", "porteo")] internal static partial bool FuenteRasterizar(int fuente, int codigo, int tamPx, int estilo, int ox, int oy, int w, int h, [JSMarshalAs<JSType.MemoryView>] Span<byte> salida);

    // los glifos de UI.Text, dibujados con el canvas 2D del navegador (fuentes.js)
    sealed class FuentesWeb : Porteo.UI.IFuentes
    {
        public void Registrar(int fuente, byte[] ttf) => FuenteRegistrar(fuente, ttf);
        public bool Rasterizar(int fuente, int codigo, int tamPx, int estilo, int ox, int oy, int w, int h, Span<byte> salida) =>
            FuenteRasterizar(fuente, codigo, tamPx, estilo, ox, oy, w, h, salida);
    }

    // el sonido del motor, con Web Audio (audio.js)
    sealed class AudioWeb : Porteo.Audio.IAudio
    {
        public void Cargar(int recurso, bool streaming) => AudioCargar(recurso, streaming);
        public int Estado(int recurso) => AudioEstado(recurso);
        public void Tocar(int voz, int recurso, bool streaming, double desde, bool bucle, float volumen, float tono, float pan, float corte) =>
            AudioTocar(voz, recurso, streaming, desde, bucle, volumen, tono, pan, corte);
        public void Ajustar(int voz, float volumen, float tono, float pan, float corte) => AudioAjustar(voz, volumen, tono, pan, corte);
        public void Parar(int voz) => AudioParar(voz);
        public void Pausar(int voz, bool pausa, double desde) => AudioPausar(voz, pausa, desde);
        public int Frecuencia() => AudioFrecuencia();
    }

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
        Porteo.Audio.Sonido.Salida = new AudioWeb();
        Porteo.UI.Fuentes.Anfitrion = new FuentesWeb();
        Pantalla.Dpi = (float)dpi;
        Plataforma.Movil = movil;
        if (Porteo.Render.Gpu.Iniciar("#lienzo", false)) Porteo.Render.Dibujo.Iniciar();
        Disco.Iniciar();
        Mundo.AlTerminarCuadro += Disco.Cuadro;
        try { Porteo.Motor.Iniciar(escenas, primera); }
        catch (Exception e) { Debug.LogException(e); }
    }

    // ── partidas guardadas ──
    // El juego guarda con System.IO en Application.persistentDataPath; en el navegador eso es un
    // disco en memoria. main.js trae lo que había en IndexedDB antes de arrancar (PonerArchivo) y
    // cada tanto se mandan los archivos que cambiaron (y los que se borraron) de vuelta.
    [JSExport]
    public static void PonerArchivo(string ruta, [JSMarshalAs<JSType.Array<JSType.Number>>] byte[] datos)
    {
        try
        {
            var dir = System.IO.Path.GetDirectoryName(ruta);
            if (!string.IsNullOrEmpty(dir)) System.IO.Directory.CreateDirectory(dir);
            System.IO.File.WriteAllBytes(ruta, datos);
            Disco.Conocido(ruta);
        }
        catch (Exception e) { Debug.LogException(e); }
    }

    [JSExport] public static void SincronizarDisco() => Disco.Sincronizar();

    static class Disco
    {
        // lo último que se mandó de cada archivo: largo y fecha de escritura
        static readonly System.Collections.Generic.Dictionary<string, (long largo, DateTime fecha)> vistos = new();
        static double ultimo;

        public static void Iniciar() => System.IO.Directory.CreateDirectory(Plataforma.RutaPersistente);

        public static void Conocido(string ruta)
        {
            var fi = new System.IO.FileInfo(ruta);
            if (fi.Exists) vistos[ruta] = (fi.Length, fi.LastWriteTimeUtc);
        }

        public static void Cuadro()
        {
            double ahora = Time.realtimeSinceStartup;
            if (ahora - ultimo < 2) return;
            ultimo = ahora;
            Sincronizar();
        }

        public static void Sincronizar()
        {
            try
            {
                var raiz = Plataforma.RutaPersistente;
                if (!System.IO.Directory.Exists(raiz)) return;
                var hay = new System.Collections.Generic.HashSet<string>();
                foreach (var f in System.IO.Directory.EnumerateFiles(raiz, "*", System.IO.SearchOption.AllDirectories))
                {
                    // los .tmp son pasos intermedios del guardado del juego (se copian y se borran)
                    if (f.EndsWith(".tmp", StringComparison.Ordinal)) continue;
                    hay.Add(f);
                    var fi = new System.IO.FileInfo(f);
                    var marca = (fi.Length, fi.LastWriteTimeUtc);
                    if (vistos.TryGetValue(f, out var v) && v == marca) continue;
                    var datos = System.IO.File.ReadAllBytes(f);
                    DiscoGuardar(f, datos);
                    vistos[f] = marca;
                }
                var borrados = new System.Collections.Generic.List<string>();
                foreach (var k in vistos.Keys) if (!hay.Contains(k)) borrados.Add(k);
                foreach (var k in borrados) { vistos.Remove(k); DiscoBorrar(k); }
            }
            catch (Exception e) { Debug.LogException(e); }
        }
    }

    [JSExport]
    public static void Cuadro(double dt)
    {
        try
        {
            Nueva();
            Adelantando();
            Mundo.Cuadro(dt);
            DiagnosticoPendiente();
        }
        catch (Exception e) { Debug.LogException(e); }
    }

    // ?adelantar=N: al llegar a la escena pedida se simulan N segundos de juego sin dibujar (en
    // tandas, para no colgar la página), así una captura muestra la escena ya andando aunque el
    // navegador dibuje lento
    static double adelantar;
    static string escenaAdelantar;
    [JSExport] public static void Adelantar(double segundos, string escena) { adelantar = segundos; escenaAdelantar = escena; }

    // ?diag=jerarquia:FPSCamera;cerca:6[&diagen=N]: diagnósticos en la consola N cuadros después
    // de terminar el adelanto (o de llegar a la escena)
    static string diagnosticos;
    static int diagnosticoEn = -1;
    [JSExport] public static void DiagnosticoLuego(string comandos, int cuadros) { diagnosticos = comandos; diagnosticoEn = cuadros; }
    [JSExport] public static string Diagnosticar(string comandos)
    {
        var sb = new System.Text.StringBuilder();
        foreach (var c in comandos.Split(';')) if (c.Length > 0) sb.Append(Diagnostico.Correr(c)).Append('\n');
        return sb.ToString();
    }

    static void DiagnosticoPendiente()
    {
        if (diagnosticos == null || adelantar > 0) return;
        if (escenaAdelantar != null && UnityEngine.SceneManagement.SceneManager.GetActiveScene().name != escenaAdelantar) return;
        if (diagnosticoEn-- > 0) return;
        Debug.Log("porteo: diagnóstico\n" + Diagnosticar(diagnosticos));
        diagnosticos = null;
    }

    // ?nueva: desde el menú, una partida nueva como el botón New Game (capturas del juego)
    static bool pedirNueva;
    static int cuadrosEnMenu;
    [JSExport] public static void NuevaPartida() => pedirNueva = true;

    static void Nueva()
    {
        if (!pedirNueva || UnityEngine.SceneManagement.SceneManager.GetActiveScene().name != "MainMenu") return;
        if (++cuadrosEnMenu < 60) return;
        pedirNueva = false;
        try
        {
            var asm = Array.Find(AppDomain.CurrentDomain.GetAssemblies(), a => a.GetName().Name == "Assembly-CSharp");
            var tGc = asm.GetType("GameContext");
            var gc = asm.GetType("SRSingleton`1").MakeGenericType(tGc).GetProperty("Instance").GetValue(null);
            var asd = tGc.GetProperty("AutoSaveDirector")?.GetValue(gc);
            var icono = Enum.Parse(asm.GetType("Identifiable+Id"), "PINK_SLIME");
            var modo = Enum.Parse(asm.GetType("PlayerState+GameMode"), "CLASSIC");
            asd.GetType().GetMethod("LoadNewGame").Invoke(asd, new object[] { "Prueba", icono, modo, null });
            Debug.Log("porteo: nueva partida");
        }
        catch (Exception e) { Debug.LogException(e); }
    }

    static void Adelantando()
    {
        if (adelantar <= 0) return;
        if (UnityEngine.SceneManagement.SceneManager.GetActiveScene().name != escenaAdelantar) return;
        Porteo.Render.Dibujo.Omitir = true;
        try
        {
            for (int i = 0; i < 120 && adelantar > 0 && !Mundo.Esperando; i++)
            {
                Mundo.AdelantarReloj(1 / 30.0);
                Mundo.Cuadro(1 / 30.0);
                adelantar -= 1 / 30.0;
            }
        }
        finally { Porteo.Render.Dibujo.Omitir = false; }
        if (adelantar <= 0) Debug.Log("porteo: listo el adelanto");
    }

    // ── teclado y mouse sobre los controles táctiles ──
    // La versión de Android sólo se maneja con los controles de TouchControlsKit (el joystick, el
    // touchpad para mirar y los botones). Para jugar en una computadora, controles.js aprieta esos
    // mismos controles con dedos virtuales: necesita saber dónde está cada uno en el lienzo.
    static readonly System.Collections.Generic.Dictionary<string, RectTransform> controles = new();
    static float ultimaBusqueda = -10;

    // [centro x, centro y, ancho, alto, radio del joystick] en píxeles del lienzo (origen abajo a la
    // izquierda); vacío si el control no está activo
    [JSExport]
    public static double[] ControlTactil(string nombre)
    {
        try
        {
            if (!controles.TryGetValue(nombre, out var rt) || rt == null)
            {
                // se buscan todos juntos (y no más de una vez cada 5 s: recorrer todos los objetos cuesta)
                if (Time.realtimeSinceStartup - ultimaBusqueda < 5) return Array.Empty<double>();
                ultimaBusqueda = Time.realtimeSinceStartup;
                foreach (var x in Resources.FindObjectsOfTypeAll<RectTransform>())
                    if (x.gameObject.scene.IsValid() && x.parent != null && x.parent.name == "VirtualController") controles[x.name] = x;
                if (!controles.TryGetValue(nombre, out rt) || rt == null) return Array.Empty<double>();
            }
            if (rt == null || !rt.gameObject.activeInHierarchy) return Array.Empty<double>();
            var esq = new Vector3[4];
            rt.GetWorldCorners(esq);
            double radio = 0;
            // el joystick satura a (diagonal del fondo / 2) * borderSize / 16 (TCKJoystick.UpdatePosition)
            foreach (var c in rt.GetComponents<MonoBehaviour>())
            {
                if (c.GetType().Name != "TCKJoystick") continue;
                var fondo = c.GetType().GetField("backgroundRT")?.GetValue(c) as RectTransform;
                var borde = c.GetType().GetField("borderSize")?.GetValue(c) is float b ? b : 5.85f;
                if (fondo != null) radio = fondo.sizeDelta.magnitude / 2 * borde / 16;
            }
            return new double[] { (esq[0].x + esq[2].x) / 2, (esq[0].y + esq[2].y) / 2, esq[2].x - esq[0].x, esq[2].y - esq[0].y, radio };
        }
        catch (Exception e) { Debug.LogException(e); return Array.Empty<double>(); }
    }

    // si se está jugando (no en un menú ni en pausa): ahí el mouse trabado mira y dispara
    [JSExport] public static bool EnJuego() => Time.timeScale > 0 && ControlTactil("Touchpad").Length > 0;

    // la entrada: main.js ya traduce las teclas a KeyCode y las coordenadas a píxeles del lienzo
    // con el origen abajo a la izquierda (como Input.mousePosition)
    [JSExport] public static void PerfilGpu(bool si) => Porteo.Render.Dibujo.PerfilGpu = si;
    [JSExport] public static void Ocultar(string nombre) => Porteo.Render.Dibujo.Ocultos.Add(nombre);
    [JSExport] public static void VolcarUniformes(string shader) => Porteo.Render.Dibujo.ShaderVolcado = shader;
    [JSExport] public static void OcultarShader(string shader) => Porteo.Render.Dibujo.ShadersOcultos.Add(shader);
    [JSExport] public static void VerFs(string shader, string expresion) { Shader.DepurarShader = shader; Shader.DepurarExpresion = expresion; }
    [JSExport] public static void VerVariantes(string shader) => Shader.DepurarVariantes = shader;
    [JSExport] public static void FijarCamara(double x, double y, double z, double yaw, double pitch)
    {
        Porteo.Render.Dibujo.CamaraForzada = true;
        Porteo.Render.Dibujo.PosForzada = new Vector3((float)x, (float)y, (float)z);
        Porteo.Render.Dibujo.AngulosForzados = new Vector3((float)pitch, (float)yaw, 0);
    }
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

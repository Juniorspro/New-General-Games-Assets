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
    [JSImport("hayRecurso", "porteo")] internal static partial bool HayRecursoJS(int id);
    [JSImport("tamanoRecurso", "porteo")] internal static partial int TamanoRecurso(int id);
    [JSImport("tamanoRecursoListo", "porteo")] internal static partial int TamanoRecursoListo(int id);
    [JSImport("hayPaquete", "porteo")] internal static partial bool HayPaqueteJS(string nombre);
    [JSImport("pedirPaquete", "porteo")] internal static partial void PedirPaqueteJS(string nombre);
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
    [JSImport("videoCrear", "porteo")] internal static partial void VideoCrear(int id, int recurso);
    [JSImport("videoReproducir", "porteo")] internal static partial void VideoReproducir(int id, bool si);
    [JSImport("videoBuscar", "porteo")] internal static partial void VideoBuscar(int id, double segundos);
    [JSImport("videoAjustar", "porteo")] internal static partial void VideoAjustar(int id, bool bucle, double velocidad, double volumen);
    [JSImport("videoTiempo", "porteo")] internal static partial double VideoTiempo(int id);
    [JSImport("videoEstado", "porteo")] internal static partial int VideoEstado(int id);
    [JSImport("videoSoltar", "porteo")] internal static partial void VideoSoltar(int id);
    [System.Runtime.InteropServices.DllImport("porteo")] static extern int porteo_video_subir(int id, uint textura);
    [JSImport("fuenteRasterizar", "porteo")] internal static partial bool FuenteRasterizar(int fuente, int codigo, int tamPx, int estilo, int ox, int oy, int w, int h, [JSMarshalAs<JSType.MemoryView>] Span<byte> salida);

    // los glifos de UI.Text, dibujados con el canvas 2D del navegador (fuentes.js)
    sealed class FuentesWeb : Porteo.UI.IFuentes
    {
        public void Registrar(int fuente, byte[] ttf) => FuenteRegistrar(fuente, ttf);
        public bool Rasterizar(int fuente, int codigo, int tamPx, int estilo, int ox, int oy, int w, int h, Span<byte> salida) =>
            FuenteRasterizar(fuente, codigo, tamPx, estilo, ox, oy, w, h, salida);
    }

    // los videos (VideoPlayer) con un <video> del navegador (video.js)
    sealed class VideoWeb : Porteo.Video.IVideo
    {
        public void Crear(int id, int recurso) => VideoCrear(id, recurso);
        public void Reproducir(int id, bool si) => VideoReproducir(id, si);
        public void Buscar(int id, double segundos) => VideoBuscar(id, segundos);
        public void Ajustar(int id, bool bucle, double velocidad, double volumen) => VideoAjustar(id, bucle, velocidad, volumen);
        public double Tiempo(int id) => VideoTiempo(id);
        public int Estado(int id) => VideoEstado(id);
        public bool Subir(int id, uint textura) => porteo_video_subir(id, textura) != 0;
        public void Soltar(int id) => VideoSoltar(id);
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

    // sin descomprimir en este hilo: -1 si todavía no está listo (ver Anfitrion.LeerRecursoListo)
    static byte[] RecursoListo(int id)
    {
        int t = TamanoRecursoListo(id);
        if (t < 0) return null;
        var b = new byte[t];
        CopiarRecurso(id, b);
        return b;
    }

    // la convención de los shaders del juego (indice.json): "d3d11" para los de PC (ver Convencion)
    [JSExport]
    public static void Convencion(string c) => Porteo.Render.Convencion.D3D = c == "d3d11";

    [JSExport]
    public static void Iniciar(string[] escenas, int primera, double dpi, bool movil)
    {
        Anfitrion.LeerPaquete = Paquete;
        Anfitrion.LeerRecurso = Recurso;
        Anfitrion.LeerRecursoListo = RecursoListo;
        Anfitrion.PedirRecurso = PedirRecurso;
        Anfitrion.PaqueteLlego = HayPaqueteJS;
        Anfitrion.PedirPaquete = PedirPaqueteJS;
        // sin traerlo: en el HTML único, traerlo es descomprimir su bloque
        Anfitrion.HayRecurso = HayRecursoJS;
        Anfitrion.Consola = (t, tipo) => Consola(t, (int)tipo);
        Porteo.Audio.Sonido.Salida = new AudioWeb();
        Porteo.UI.Fuentes.Anfitrion = new FuentesWeb();
        Porteo.Video.Videos.Salida = new VideoWeb();
        Pantalla.Dpi = (float)dpi;
        Plataforma.Movil = movil;
        if (Porteo.Render.Gpu.Iniciar("#lienzo", false)) Porteo.Render.Dibujo.Iniciar();
        Disco.Iniciar();
        Mundo.AlTerminarCuadro += Disco.Cuadro;
        try { Porteo.Motor.Iniciar(escenas, primera); }
        catch (Exception e) { Debug.LogException(e); }
    }

    // los datos llegan de a poco por la red: qué no esperan las escenas (ver Alcance.Diferible).
    // main.js lo prende antes de Iniciar y apaga las texturas cuando aparece el menú: de ahí en
    // más cada escena espera sus texturas (sin la pantalla de carga delante se verían llegar)
    [JSExport]
    public static void Diferir(bool audio, bool texturas)
    {
        Anfitrion.DiferirAudio = audio;
        Anfitrion.DiferirTexturas = texturas;
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

    // para depurar el guardado: SaveGame directo (SaveAllNow se traga las excepciones)
    [JSExport]
    public static string ProbarGuardado()
    {
        try
        {
            var asm = Array.Find(AppDomain.CurrentDomain.GetAssemblies(), a => a.GetName().Name == "Assembly-CSharp");
            var tGc = asm.GetType("GameContext");
            var gc = asm.GetType("SRSingleton`1").MakeGenericType(tGc).GetProperty("Instance").GetValue(null);
            var asd = tGc.GetProperty("AutoSaveDirector")?.GetValue(gc);
            asd.GetType().GetMethod("SaveGame").Invoke(asd, null);
            return "guardado: " + Diagnostico.Disco(Plataforma.RutaPersistente);
        }
        catch (Exception e) { return "falló: " + (e.InnerException ?? e); }
    }

    // La versión de Android guarda sola cada 5 minutos y al salir desde el menú de pausa. En el
    // navegador la pestaña se puede cerrar o dejar de lado en cualquier momento: al ocultarse se
    // guarda la partida como lo haría ese menú (AutoSaveDirector.SaveAllNow) y se manda al disco.
    [JSExport]
    public static void GuardarPartida()
    {
        try
        {
            var asm = Array.Find(AppDomain.CurrentDomain.GetAssemblies(), a => a.GetName().Name == "Assembly-CSharp");
            var niveles = asm?.GetType("Levels");
            if (niveles?.GetMethod("isSpecial", Type.EmptyTypes)?.Invoke(null, null) is bool especial && especial) return;
            // la partida de Slime Rancher (su director de guardado); en otros juegos no está y alcanza
            // con pasar el disco a IndexedDB (en Bad Parenting esto tiraba un NullReference en cada pagehide)
            var tGc = asm?.GetType("GameContext");
            var tSingleton = asm?.GetType("SRSingleton`1");
            if (tGc == null || tSingleton == null) { Disco.Sincronizar(); return; }
            var gc = tSingleton.MakeGenericType(tGc).GetProperty("Instance")?.GetValue(null);
            var asd = gc == null ? null : tGc.GetProperty("AutoSaveDirector")?.GetValue(gc);
            if (asd == null) return;
            asd.GetType().GetMethod("SaveAllNow")?.Invoke(asd, null);
            Debug.Log("porteo: partida guardada");
        }
        catch (Exception e) { Debug.LogException(e); }
        Disco.Sincronizar();
    }

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
            Ir();
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

    // ?ir=x,y,z o ?ir=nombre (un TeleportDestination del juego): al terminar el adelanto el jugador
    // aparece ahí, como lo deja un teletransportador (TeleportNetwork + TeleportDestination.OnArrive).
    // Primero el conjunto de regiones del lugar (el desierto está arriba de y=900 y el valle al sur de
    // z=-550); después, quieto ahí unos cuadros hasta que su RegionLoader despierta las regiones:
    // dormidas no tienen colisionadores, se cae, KillOnTrigger lo mata y queda la pantalla negra
    // del desmayo. Recién con suelo abajo se lo suelta.
    static Vector3? irA;
    static Vector3? irMirando;
    static string irDestino;
    static MonoBehaviour irLlegada;   // el TeleportDestination elegido (su OnArrive, como el juego)
    static int irCuadros;
    [JSExport] public static void IrA(double x, double y, double z) { irA = new Vector3((float)x, (float)y, (float)z); irMirando = null; irLlegada = null; irCuadros = 0; }
    [JSExport] public static void IrADestino(string nombre) { irDestino = nombre; irCuadros = 0; }

    static System.Reflection.Assembly juego;
    static object Llamar(object o, string metodo, params object[] args) => o.GetType().GetMethod(metodo).Invoke(o, args);
    static object Prop(object o, string nombre) => o.GetType().GetProperty(nombre).GetValue(o);

    // si algo del juego no está como se espera, se abandona el viaje (y el cuadro sigue)
    static void Ir()
    {
        try { IrPaso(); }
        catch (Exception e)
        {
            Debug.Log("porteo: no pude llevar al jugador: " + (e.InnerException ?? e));
            irA = null; irDestino = null; irLlegada = null;
        }
    }

    static void IrPaso()
    {
        if ((irA == null && irDestino == null) || adelantar > 0) return;
        if (escenaAdelantar != null && UnityEngine.SceneManagement.SceneManager.GetActiveScene().name != escenaAdelantar) return;
        juego ??= Array.Find(AppDomain.CurrentDomain.GetAssemblies(), a => a.GetName().Name == "Assembly-CSharp");
        var tSC = juego.GetType("SceneContext");
        var sc = juego.GetType("SRSingleton`1").MakeGenericType(tSC).GetProperty("Instance").GetValue(null);
        var jugador = sc == null ? null : Prop(sc, "Player") as GameObject;
        if (jugador == null) return;
        if (irDestino != null && !BuscarDestino(irDestino)) { irDestino = null; return; }
        irDestino = null;
        var lugar = irA.Value;
        var tp = jugador.GetComponent(juego.GetType("TeleportablePlayer"));
        var control = jugador.GetComponent(juego.GetType("vp_FPController"));
        void Poner(Vector3 p, Vector3? mirando)
        {
            Llamar(tp, "TeleportTo", p, mirando);
            Llamar(control, "Stop");
        }
        if (irCuadros == 0)
        {
            Llamar(Prop(sc, "RegionRegistry"), "SetCurrRegionSetForPos", lugar);
            Llamar(tp, "PreTeleport");
            Poner(lugar, irMirando);
            Llamar(tp, "PostTeleport");
        }
        // el suelo, buscado desde un poco más arriba (desde muy alto se toparía con el desierto, que
        // está encima del resto); entre lo que haya, lo más alto que no pase de la altura pedida + 40
        // (los árboles y los techos quedan arriba). En un destino, la plataforma misma: el techo de
        // una cueva puede estar a menos de 40
        var golpes = Physics.RaycastAll(lugar + Vector3.up * 250, Vector3.down, 600, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore);
        float tope = lugar.y + (irLlegada != null ? 2 : 40);
        float? suelo = null;
        foreach (var g in golpes)
            if (g.point.y <= tope && (suelo == null || g.point.y > suelo)) suelo = g.point.y;
        if (irCuadros > 0 && suelo != null)
        {
            Poner(new Vector3(lugar.x, suelo.Value + 1.5f, lugar.z), irMirando);
            Debug.Log($"porteo: jugador en {jugador.transform.position} ({golpes.Length} golpes, {irCuadros} cuadros esperando la zona)");
            irA = null;
            // como TeleportNetwork, la llegada marca su teletransportador para que no lo mande de
            // vuelta apenas lo pisa. Recién ahora: con la región dormida, OnArrive no encuentra
            // su Region (GetComponentInParent no ve lo inactivo)
            if (irLlegada != null)
                try { Llamar(irLlegada, "OnArrive"); }
                catch (Exception e) { Debug.Log("porteo: OnArrive: " + (e.InnerException ?? e).Message); }
            irLlegada = null;
            return;
        }
        if (++irCuadros > 150)
        {
            Debug.Log($"porteo: no hay suelo abajo de {lugar} ({golpes.Length} golpes); queda ahí");
            irA = null;
            return;
        }
        Poner(lugar, irMirando);
    }

    // un destino de teletransporte por su nombre (teleportDestinationName o el del objeto): parado
    // ahí y mirando para donde lo dejaría el juego. Los de las zonas dormidas también (están
    // inactivos, pero en su lugar)
    static bool BuscarDestino(string nombre)
    {
        var tDest = juego.GetType("TeleportDestination");
        var lista = new System.Text.StringBuilder();
        foreach (var d in Resources.FindObjectsOfTypeAll(tDest))
        {
            var mb = (MonoBehaviour)d;
            if (!mb.gameObject.scene.IsValid()) continue;
            var red = tDest.GetField("teleportDestinationName").GetValue(mb) as string ?? "";
            lista.Append($"\n   {red} ({Diagnostico.Ruta(mb.transform)}) en {mb.transform.position}");
            if (red.IndexOf(nombre, StringComparison.OrdinalIgnoreCase) < 0 && mb.name.IndexOf(nombre, StringComparison.OrdinalIgnoreCase) < 0) continue;
            irA = mb.transform.position;
            irMirando = mb.transform.eulerAngles;
            irLlegada = mb;
            Debug.Log($"porteo: destino {red} ({Diagnostico.Ruta(mb.transform)})");
            return true;
        }
        Debug.Log($"porteo: no hay un destino \"{nombre}\"; los que hay:{lista}");
        return false;
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

    // segundos de juego sin dibujar, ya (main.js: la primera escena mientras la pantalla de carga la
    // tapa). Aparte de Adelantar, que es para las pruebas y espera a una escena
    [JSExport]
    public static void Acelerar(double segundos)
    {
        Porteo.Render.Dibujo.Omitir = true;
        try
        {
            for (double t = 0; t < segundos && !Mundo.Esperando; t += 1 / 30.0)
            {
                Mundo.AdelantarReloj(1 / 30.0);
                Mundo.Cuadro(1 / 30.0);
            }
        }
        catch (Exception e) { Debug.LogException(e); }
        finally { Porteo.Render.Dibujo.Omitir = false; }
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

    // ── teclado y mouse sobre los controles táctiles (ver Porteo.ControlesTactiles) ──
    // [centro x, centro y, ancho, alto, radio del joystick] de un control, para controles.js
    [JSExport] public static double[] ControlTactil(string nombre) => Porteo.ControlesTactiles.Rect(nombre);
    [JSExport] public static bool EnJuego() => Porteo.ControlesTactiles.EnJuego();

    // la entrada: main.js ya traduce las teclas a KeyCode y las coordenadas a píxeles del lienzo
    // con el origen abajo a la izquierda (como Input.mousePosition)
    [JSExport] public static void PerfilGpu(bool si) => Porteo.Render.Dibujo.PerfilGpu = si;
    [JSExport] public static void Ocultar(string nombre) => Porteo.Render.Dibujo.Ocultos.Add(nombre);
    [JSExport] public static void VolcarUniformes(string shader) => Porteo.Render.Dibujo.ShaderVolcado = shader;
    [JSExport] public static void OcultarShader(string shader) => Porteo.Render.Dibujo.ShadersOcultos.Add(shader);
    [JSExport] public static void VerFs(string shader, string expresion) { Shader.DepurarShader = shader; Shader.DepurarExpresion = expresion; }
    [JSExport] public static void VerVariantes(string shader) => Shader.DepurarVariantes = shader;
    [JSExport] public static void Desarrollo(bool si) => Plataforma.Desarrollo = si;
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
    [JSExport] public static void Mirar(double dx, double dy) => Entrada.Mirar((float)dx, (float)dy);
    // el juego trabó el puntero (Cursor.lockState): se está jugando, no en un menú
    [JSExport] public static bool CursorTrabado() => Cursor.lockState == CursorLockMode.Locked && Time.timeScale > 0;
    // una preferencia del juego (PlayerPrefs) si todavía no la tiene: el idioma del teléfono la
    // primera vez (carga.json, "idioma"), sin pisar lo que se eligió después en el juego
    [JSExport] public static void PreferenciaInicial(string clave, int valor) { if (!PlayerPrefs.HasKey(clave)) PlayerPrefs.SetInt(clave, valor); }
    [JSExport] public static void Texto(string s) => Entrada.Texto(s);
    [JSExport] public static void Toque(int dedo, int fase, double x, double y) => Entrada.Toque(dedo, fase, (float)x, (float)y);
}

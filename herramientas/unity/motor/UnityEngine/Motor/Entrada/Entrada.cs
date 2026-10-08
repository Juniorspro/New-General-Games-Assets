using System;
using System.Collections.Generic;
using Porteo;
using Porteo.Datos;
using UnityEngine;

namespace Porteo
{
    // La entrada: el anfitrión manda los eventos apenas pasan (teclas, puntero, toques, rueda,
    // texto) y al empezar cada cuadro se aplican, como hace Unity: GetKeyDown/GetMouseButtonDown
    // valen durante el cuadro siguiente al evento, y cada toque tiene una sola fase por cuadro.
    public static class Entrada
    {
        enum TipoEvento : byte { Tecla, Boton, Raton, Toque, Rueda, Texto, Mirar }

        struct Evento
        {
            public TipoEvento Tipo;
            public int A, B;        // tecla/botón/dedo y si está abajo / fase
            public float X, Y;      // posición (abajo a la izquierda) o rueda
            public string Texto;
        }

        static readonly List<Evento> cola = new List<Evento>();
        internal static readonly HashSet<KeyCode> abajo = new HashSet<KeyCode>(), bajaron = new HashSet<KeyCode>(), subieron = new HashSet<KeyCode>();
        internal static Vector3 raton, ratonAntes;
        internal static Vector2 rueda;
        internal static Vector2 mirar;   // movimiento relativo del cuadro (arrastrar para mirar en el teléfono)
        internal static string texto = "";
        internal static readonly List<Touch> toques = new List<Touch>();
        static readonly Dictionary<int, (Vector2 pos, Vector2 antes, int toques, float inicio)> dedos = new Dictionary<int, (Vector2, Vector2, int, float)>();
        internal static bool hayRaton;

        // ── lo que llama el anfitrión ──
        public static void Tecla(int codigo, bool baja) => cola.Add(new Evento { Tipo = TipoEvento.Tecla, A = codigo, B = baja ? 1 : 0 });
        public static void BotonRaton(int boton, bool baja) => cola.Add(new Evento { Tipo = TipoEvento.Boton, A = boton, B = baja ? 1 : 0 });
        public static void Raton(float x, float y) => cola.Add(new Evento { Tipo = TipoEvento.Raton, X = x, Y = y });
        public static void Rueda(float dx, float dy) => cola.Add(new Evento { Tipo = TipoEvento.Rueda, X = dx, Y = dy });
        public static void Texto(string s) => cola.Add(new Evento { Tipo = TipoEvento.Texto, Texto = s });
        // un movimiento del mouse sin mover el puntero (como con el puntero trabado): llega a los ejes
        // "Mouse X/Y" y no a Input.mousePosition. Así se mira arrastrando el dedo en el teléfono
        public static void Mirar(float dx, float dy) => cola.Add(new Evento { Tipo = TipoEvento.Mirar, X = dx, Y = dy });
        // fase: 0 empieza, 1 se mueve, 3 termina, 4 se cancela. Los dedos de Unity en Android son
        // números chicos que se reusan (el más bajo libre) y TouchControlsKit lo supone: arrastra el
        // joystick o el touchpad sólo si Input.touchCount >= fingerId. El anfitrión manda sus ids (los
        // del navegador, o los dedos virtuales del teclado y de las pruebas, 20 en adelante) y acá se
        // traducen; con un 20 tal cual, el joystick nunca se movía.
        static readonly Dictionary<int, int> dedoInterno = new Dictionary<int, int>();
        public static void Toque(int dedo, int fase, float x, float y)
        {
            if (fase == 0 && !dedoInterno.ContainsKey(dedo))
            {
                int d = 0;
                while (dedoInterno.ContainsValue(d)) d++;
                dedoInterno[dedo] = d;
            }
            // un movimiento o un fin de un dedo que nunca empezó no existe para el juego
            if (!dedoInterno.TryGetValue(dedo, out var id)) return;
            if (fase == 3 || fase == 4) dedoInterno.Remove(dedo);
            cola.Add(new Evento { Tipo = TipoEvento.Toque, A = id, B = fase, X = x, Y = y });
        }

        public static void Iniciar()
        {
            Mundo.AlEmpezarCuadro += Aplicar;
        }

        static readonly List<Touch> nuevos = new List<Touch>();
        static readonly HashSet<int> conFase = new HashSet<int>();

        static void Aplicar()
        {
            bajaron.Clear(); subieron.Clear();
            ratonAntes = raton;
            rueda = Vector2.zero;
            mirar = Vector2.zero;
            texto = "";
            nuevos.Clear(); conFase.Clear();
            // los dedos que terminaron el cuadro anterior ya no están
            foreach (var t in toques) if (t.phase == TouchPhase.Ended || t.phase == TouchPhase.Canceled) dedos.Remove(t.fingerId);
            int usados = 0;
            for (; usados < cola.Count; usados++)
            {
                var e = cola[usados];
                switch (e.Tipo)
                {
                    case TipoEvento.Tecla:
                    {
                        var k = (KeyCode)e.A;
                        if (e.B != 0) { if (abajo.Add(k)) bajaron.Add(k); }
                        else if (abajo.Remove(k)) subieron.Add(k);
                        // para los campos de texto de uGUI (Event.PopEvent)
                        Event.Encolar(e.B != 0 ? EventType.KeyDown : EventType.KeyUp, k, '\0');
                        break;
                    }
                    case TipoEvento.Boton:
                    {
                        var k = KeyCode.Mouse0 + e.A;
                        if (e.B != 0) { if (abajo.Add(k)) bajaron.Add(k); }
                        else if (abajo.Remove(k)) subieron.Add(k);
                        break;
                    }
                    case TipoEvento.Raton: raton = new Vector3(e.X, e.Y, 0); hayRaton = true; break;
                    case TipoEvento.Rueda: rueda += new Vector2(e.X, e.Y); break;
                    case TipoEvento.Mirar: mirar += new Vector2(e.X, e.Y); break;
                    case TipoEvento.Texto:
                        texto += e.Texto;
                        // los caracteres de control ("\b" al borrar) ya van como su tecla
                        foreach (var c in e.Texto) if (c >= ' ' || c == '\n') Event.Encolar(EventType.KeyDown, KeyCode.None, c);
                        break;
                    case TipoEvento.Toque:
                    {
                        // un dedo cambia de fase una sola vez por cuadro: si ya tuvo, lo demás queda para el siguiente
                        if (conFase.Contains(e.A) && e.B != 1) goto fin;
                        var pos = new Vector2(e.X, e.Y);
                        if (e.B == 0)
                        {
                            int tap = 1;
                            if (dedos.TryGetValue(e.A, out var d0) && Time.realtimeSinceStartup - d0.inicio < 0.3f) tap = d0.toques + 1;
                            dedos[e.A] = (pos, pos, tap, Time.realtimeSinceStartup);
                            Marcar(e.A, TouchPhase.Began, pos, Vector2.zero, tap);
                        }
                        else if (dedos.TryGetValue(e.A, out var d))
                        {
                            var fase = e.B == 1 ? TouchPhase.Moved : (TouchPhase)e.B;
                            dedos[e.A] = (pos, d.pos, d.toques, d.inicio);
                            if (conFase.Contains(e.A))
                            {
                                // varios movimientos en el mismo cuadro: se acumula en el que ya está
                                for (int i = 0; i < nuevos.Count; i++)
                                    if (nuevos[i].fingerId == e.A) { var t = nuevos[i]; t.m_PositionDelta += pos - t.m_Position; t.m_Position = pos; nuevos[i] = t; }
                            }
                            else Marcar(e.A, fase, pos, pos - d.pos, d.toques);
                        }
                        break;
                    }
                }
            }
            fin:
            cola.RemoveRange(0, usados);
            // los dedos sin novedades este cuadro siguen ahí, quietos
            foreach (var kv in dedos)
                if (!conFase.Contains(kv.Key)) nuevos.Add(Nuevo(kv.Key, TouchPhase.Stationary, kv.Value.pos, Vector2.zero, kv.Value.toques));
            nuevos.Sort((a, b) => a.fingerId.CompareTo(b.fingerId));
            toques.Clear();
            toques.AddRange(nuevos);
            SimularRaton();
            Ejes.Actualizar();
        }

        // Input.simulateMouseWithTouches (prendido por defecto, como en Android): el primer dedo
        // que toca mueve el mouse y aprieta el botón 0 hasta que se levanta
        static int dedoRaton = -1;

        static void SimularRaton()
        {
            if (!Input.simulateMouseWithTouches) return;
            foreach (var t in toques)
            {
                if (dedoRaton < 0 && t.phase == TouchPhase.Began)
                {
                    dedoRaton = t.fingerId;
                    raton = ratonAntes = new Vector3(t.position.x, t.position.y, 0);
                    if (abajo.Add(KeyCode.Mouse0)) bajaron.Add(KeyCode.Mouse0);
                }
                else if (t.fingerId == dedoRaton)
                {
                    raton = new Vector3(t.position.x, t.position.y, 0);
                    if (t.phase == TouchPhase.Ended || t.phase == TouchPhase.Canceled)
                    {
                        if (abajo.Remove(KeyCode.Mouse0)) subieron.Add(KeyCode.Mouse0);
                        dedoRaton = -1;
                    }
                }
            }
        }

        static void Marcar(int dedo, TouchPhase fase, Vector2 pos, Vector2 delta, int tap)
        {
            conFase.Add(dedo);
            nuevos.Add(Nuevo(dedo, fase, pos, delta, tap));
        }

        static Touch Nuevo(int dedo, TouchPhase fase, Vector2 pos, Vector2 delta, int tap) => new Touch
        {
            m_FingerId = dedo, m_Position = pos, m_RawPosition = pos, m_PositionDelta = delta, m_TimeDelta = Time.unscaledDeltaTime,
            m_TapCount = tap, m_Phase = fase, m_Type = TouchType.Direct, m_Pressure = 1, m_maximumPossiblePressure = 1, m_Radius = 10,
        };

        // los nombres de tecla de Unity ("left shift", "joystick button 0", "[1]"...)
        internal static KeyCode PorNombre(string n)
        {
            if (string.IsNullOrEmpty(n)) return KeyCode.None;
            n = n.Trim().ToLowerInvariant();
            if (n.Length == 1)
            {
                char c = n[0];
                if (c >= 'a' && c <= 'z') return KeyCode.A + (c - 'a');
                if (c >= '0' && c <= '9') return KeyCode.Alpha0 + (c - '0');
                return c switch
                {
                    ' ' => KeyCode.Space, '-' => KeyCode.Minus, '=' => KeyCode.Equals, '[' => KeyCode.LeftBracket, ']' => KeyCode.RightBracket,
                    ';' => KeyCode.Semicolon, '\'' => KeyCode.Quote, ',' => KeyCode.Comma, '.' => KeyCode.Period, '/' => KeyCode.Slash,
                    '\\' => KeyCode.Backslash, '`' => KeyCode.BackQuote, _ => KeyCode.None,
                };
            }
            if (n.StartsWith("mouse ") && int.TryParse(n.Substring(6), out int mb)) return KeyCode.Mouse0 + mb;
            if (n.StartsWith("joystick button ") && int.TryParse(n.Substring(16), out int jb)) return KeyCode.JoystickButton0 + jb;
            if (n.StartsWith("joystick ") && n.Contains(" button "))
            {
                var p = n.Split(' ');
                if (p.Length == 4 && int.TryParse(p[1], out int j) && int.TryParse(p[3], out int b) && j >= 1 && j <= 8)
                    return KeyCode.Joystick1Button0 + (j - 1) * 20 + b;
            }
            if (n.Length >= 2 && n[0] == 'f' && int.TryParse(n.Substring(1), out int f) && f >= 1 && f <= 15) return KeyCode.F1 + (f - 1);
            if (n.Length == 3 && n[0] == '[' && n[2] == ']')
            {
                char c = n[1];
                if (c >= '0' && c <= '9') return KeyCode.Keypad0 + (c - '0');
                return c switch { '.' => KeyCode.KeypadPeriod, '/' => KeyCode.KeypadDivide, '*' => KeyCode.KeypadMultiply, '-' => KeyCode.KeypadMinus, '+' => KeyCode.KeypadPlus, '=' => KeyCode.KeypadEquals, _ => KeyCode.None };
            }
            return n switch
            {
                "up" => KeyCode.UpArrow, "down" => KeyCode.DownArrow, "left" => KeyCode.LeftArrow, "right" => KeyCode.RightArrow,
                "space" => KeyCode.Space, "enter" => KeyCode.KeypadEnter, "return" => KeyCode.Return, "escape" => KeyCode.Escape,
                "backspace" => KeyCode.Backspace, "tab" => KeyCode.Tab, "delete" => KeyCode.Delete, "insert" => KeyCode.Insert,
                "home" => KeyCode.Home, "end" => KeyCode.End, "page up" => KeyCode.PageUp, "page down" => KeyCode.PageDown,
                "left shift" => KeyCode.LeftShift, "right shift" => KeyCode.RightShift, "left ctrl" => KeyCode.LeftControl, "right ctrl" => KeyCode.RightControl,
                "left alt" => KeyCode.LeftAlt, "right alt" => KeyCode.RightAlt, "left cmd" => KeyCode.LeftCommand, "right cmd" => KeyCode.RightCommand,
                "caps lock" => KeyCode.CapsLock, "numlock" => KeyCode.Numlock, "pause" => KeyCode.Pause, "menu" => KeyCode.Menu,
                _ => KeyCode.None,
            };
        }
    }

    // Los ejes del InputManager del proyecto ("Horizontal", "Mouse X"...), con la suavidad de Unity.
    public static class Ejes
    {
        sealed class Eje
        {
            public string Nombre;
            public KeyCode Neg, Pos, AltNeg, AltPos;
            public float Gravedad, Muerto, Sensibilidad;
            public bool Salto, Invertir;
            public int Tipo, Numero, Joy;
            public float Valor, Crudo;
        }

        static List<Eje> ejes;
        static readonly Dictionary<string, List<Eje>> porNombre = new Dictionary<string, List<Eje>>();

        static void Cargar()
        {
            if (ejes != null) return;
            ejes = new List<Eje>();
            var l = Ajustes.Entrada?.L("m_Axes");
            if (l == null) return;
            foreach (Mapa m in l)
            {
                var e = new Eje
                {
                    Nombre = m.S("m_Name") ?? "",
                    Neg = Entrada.PorNombre(m.S("negativeButton")), Pos = Entrada.PorNombre(m.S("positiveButton")),
                    AltNeg = Entrada.PorNombre(m.S("altNegativeButton")), AltPos = Entrada.PorNombre(m.S("altPositiveButton")),
                    Gravedad = m.F("gravity"), Muerto = m.F("dead"), Sensibilidad = m.F("sensitivity", 1),
                    Salto = m.B("snap"), Invertir = m.B("invert"), Tipo = m.I32("type"), Numero = m.I32("axis"), Joy = m.I32("joyNum"),
                };
                ejes.Add(e);
                if (!porNombre.TryGetValue(e.Nombre, out var lista)) porNombre[e.Nombre] = lista = new List<Eje>();
                lista.Add(e);
            }
        }

        internal static void Actualizar()
        {
            Cargar();
            float dt = Time.unscaledDeltaTime;
            foreach (var e in ejes)
            {
                switch (e.Tipo)
                {
                    case 0:
                    {
                        float crudo = (Abajo(e.Pos) || Abajo(e.AltPos) ? 1 : 0) - (Abajo(e.Neg) || Abajo(e.AltNeg) ? 1 : 0);
                        if (e.Invertir) crudo = -crudo;
                        e.Crudo = crudo;
                        if (crudo != 0)
                        {
                            if (e.Salto && Math.Sign(e.Valor) != Math.Sign(crudo)) e.Valor = 0;
                            e.Valor = Mathf.MoveTowards(e.Valor, crudo, e.Sensibilidad * dt);
                        }
                        else e.Valor = Mathf.MoveTowards(e.Valor, 0, e.Gravedad * dt);
                        break;
                    }
                    case 1:
                    {
                        var d = (Vector2)(Entrada.raton - Entrada.ratonAntes) + Entrada.mirar;
                        float v = e.Numero == 0 ? d.x : e.Numero == 1 ? d.y : Entrada.rueda.y;
                        v *= e.Sensibilidad * (e.Numero == 2 ? 1 : 0.1f);
                        if (e.Invertir) v = -v;
                        e.Valor = e.Crudo = v;
                        break;
                    }
                    case 2:
                    {
                        float v = Mandos.Eje(e.Joy, e.Numero);
                        if (Math.Abs(v) < e.Muerto) v = 0;
                        if (e.Invertir) v = -v;
                        e.Valor = e.Crudo = v;
                        break;
                    }
                }
            }
        }

        static bool Abajo(KeyCode k) => k != KeyCode.None && Input.GetKey(k);

        internal static float Valor(string nombre, bool crudo)
        {
            Cargar();
            if (!porNombre.TryGetValue(nombre, out var l)) throw new ArgumentException($"Input Axis {nombre} is not setup.\n To change the input settings use: Edit -> Settings -> Input");
            float mejor = 0;
            foreach (var e in l) { float v = crudo ? e.Crudo : e.Valor; if (Math.Abs(v) > Math.Abs(mejor)) mejor = v; }
            return mejor;
        }

        internal static bool Boton(string nombre, int cual)
        {
            Cargar();
            if (!porNombre.TryGetValue(nombre, out var l)) throw new ArgumentException($"Input Button {nombre} is not setup.\n To change the input settings use: Edit -> Settings -> Input");
            foreach (var e in l)
            {
                if (e.Tipo != 0) continue;
                foreach (var k in new[] { e.Pos, e.AltPos })
                {
                    if (k == KeyCode.None) continue;
                    if (cual == 0 && Input.GetKey(k) || cual == 1 && Input.GetKeyDown(k) || cual == 2 && Input.GetKeyUp(k)) return true;
                }
            }
            return false;
        }
    }

    // Los mandos (Gamepad API del navegador): el anfitrión manda ejes y botones de cada uno.
    public static class Mandos
    {
        internal static readonly float[,] ejes = new float[9, 28];
        internal static readonly string[] nombres = Array.Empty<string>();
        static string[] lista = Array.Empty<string>();

        public static void Conectados(string[] n) => lista = n ?? Array.Empty<string>();
        public static void PonerEje(int mando, int eje, float v) { if (mando >= 0 && mando < 8 && eje >= 0 && eje < 28) ejes[mando + 1, eje] = v; }
        public static string[] Nombres => lista;

        // joyNum 0 = cualquiera: el de mayor valor absoluto
        internal static float Eje(int joy, int eje)
        {
            if (eje < 0 || eje >= 28) return 0;
            if (joy > 0) return joy < 9 ? ejes[joy, eje] : 0;
            float m = 0;
            for (int j = 1; j < 9; j++) if (Math.Abs(ejes[j, eje]) > Math.Abs(m)) m = ejes[j, eje];
            return m;
        }
    }
}

namespace UnityEngine
{
    public sealed partial class Input
    {
        public static Vector3 mousePosition => Entrada.raton;
        public static Vector2 mouseScrollDelta => Entrada.rueda;
        public static bool mousePresent => Entrada.hayRaton || !Plataforma.Movil;
        public static bool touchSupported => true;
        public static bool multiTouchEnabled { get; set; } = true;
        public static bool simulateMouseWithTouches { get; set; } = true;
        public static int touchCount => Entrada.toques.Count;
        public static Touch[] touches => Entrada.toques.ToArray();
        public static Touch GetTouch(int index) => Entrada.toques[index];
        public static bool anyKey => Entrada.abajo.Count > 0;
        public static bool anyKeyDown => Entrada.bajaron.Count > 0;
        public static string inputString => Entrada.texto;
        public static IMECompositionMode imeCompositionMode { get; set; }
        public static string compositionString => "";
        public static Vector2 compositionCursorPos { get; set; }
        public static Vector3 acceleration => new Vector3(0, -1, 0);
        public static DeviceOrientation deviceOrientation => DeviceOrientation.LandscapeLeft;
        public static bool backButtonLeavesApp { get; set; }
        static readonly Gyroscope giro = new Gyroscope();
        public static Gyroscope gyro => giro;

        public static bool GetKey(KeyCode key) => Entrada.abajo.Contains(key);
        public static bool GetKeyDown(KeyCode key) => Entrada.bajaron.Contains(key);
        public static bool GetKeyUp(KeyCode key) => Entrada.subieron.Contains(key);
        public static bool GetKey(string name) => GetKey(Nombre(name));
        public static bool GetKeyDown(string name) => GetKeyDown(Nombre(name));
        public static bool GetKeyUp(string name) => GetKeyUp(Nombre(name));

        static KeyCode Nombre(string n)
        {
            var k = Entrada.PorNombre(n);
            if (k == KeyCode.None) throw new ArgumentException($"Input Key named: {n} is unknown");
            return k;
        }

        public static bool GetMouseButton(int button) => GetKey(KeyCode.Mouse0 + button);
        public static bool GetMouseButtonDown(int button) => GetKeyDown(KeyCode.Mouse0 + button);
        public static bool GetMouseButtonUp(int button) => GetKeyUp(KeyCode.Mouse0 + button);

        public static float GetAxis(string axisName) => Ejes.Valor(axisName, false);
        public static float GetAxisRaw(string axisName) => Ejes.Valor(axisName, true);
        public static bool GetButton(string buttonName) => Ejes.Boton(buttonName, 0);
        public static bool GetButtonDown(string buttonName) => Ejes.Boton(buttonName, 1);
        public static bool GetButtonUp(string buttonName) => Ejes.Boton(buttonName, 2);
        public static string[] GetJoystickNames() => Mandos.Nombres;
        public static void ResetInputAxes() { Entrada.abajo.Clear(); }
    }

    public partial struct Touch
    {
        public int m_FingerId;
        public Vector2 m_Position;
        public Vector2 m_RawPosition;
        public Vector2 m_PositionDelta;
        public float m_TimeDelta;
        public int m_TapCount;
        public TouchPhase m_Phase;
        public TouchType m_Type;
        public float m_Pressure;
        public float m_maximumPossiblePressure;
        public float m_Radius;
        public float m_RadiusVariance;
        public float m_AltitudeAngle;
        public float m_AzimuthAngle;

        public int fingerId { get => m_FingerId; set => m_FingerId = value; }
        public Vector2 position { get => m_Position; set => m_Position = value; }
        public Vector2 rawPosition { get => m_RawPosition; set => m_RawPosition = value; }
        public Vector2 deltaPosition { get => m_PositionDelta; set => m_PositionDelta = value; }
        public float deltaTime { get => m_TimeDelta; set => m_TimeDelta = value; }
        public int tapCount { get => m_TapCount; set => m_TapCount = value; }
        public TouchPhase phase { get => m_Phase; set => m_Phase = value; }
        public float pressure { get => m_Pressure; set => m_Pressure = value; }
        public float maximumPossiblePressure { get => m_maximumPossiblePressure; set => m_maximumPossiblePressure = value; }
        public TouchType type { get => m_Type; set => m_Type = value; }
        public float altitudeAngle { get => m_AltitudeAngle; set => m_AltitudeAngle = value; }
        public float azimuthAngle { get => m_AzimuthAngle; set => m_AzimuthAngle = value; }
        public float radius { get => m_Radius; set => m_Radius = value; }
        public float radiusVariance { get => m_RadiusVariance; set => m_RadiusVariance = value; }
    }

    public partial class Gyroscope
    {
        internal Gyroscope() { }
        public Quaternion attitude => Quaternion.identity;
        public bool enabled { get; set; }
        public Vector3 gravity => new Vector3(0, -1, 0);
        public Vector3 rotationRate => Vector3.zero;
        public Vector3 userAcceleration => Vector3.zero;
        public float updateInterval { get; set; } = 1f / 60;
    }

    public enum DeviceOrientation { Unknown = 0, Portrait = 1, PortraitUpsideDown = 2, LandscapeLeft = 3, LandscapeRight = 4, FaceUp = 5, FaceDown = 6 }

    public partial class Display
    {
        static readonly Display principal = new Display();
        public static Display[] displays = { principal };
        public static Display main => principal;
        public int renderingWidth => Screen.width;
        public int renderingHeight => Screen.height;
        public int systemWidth => Screen.width;
        public int systemHeight => Screen.height;
        public bool active => true;
        public void Activate() { }
        public static Vector3 RelativeMouseAt(Vector3 inputMouseCoordinates) => inputMouseCoordinates;
    }

    public partial class Cursor
    {
        public static bool visible { get => Puntero.Visible; set { Puntero.Visible = value; Puntero.Cambio?.Invoke(); } }
        public static CursorLockMode lockState { get => Puntero.Bloqueo; set { Puntero.Bloqueo = value; Puntero.Cambio?.Invoke(); } }
        public static void SetCursor(Texture2D texture, Vector2 hotspot, CursorMode cursorMode) { }
    }

    public enum CursorMode { Auto = 0, ForceSoftware = 1 }
}

namespace Porteo
{
    public static class Puntero
    {
        public static bool Visible = true;
        public static UnityEngine.CursorLockMode Bloqueo;
        public static Action Cambio;
    }
}

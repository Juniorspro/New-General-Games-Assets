using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Playables;
using Object = UnityEngine.Object;

namespace Porteo.Playables
{
    // Lo que en Unity es nativo de los Playables: el grafo, sus nodos (cada playable), sus salidas
    // y la evaluación de cada cuadro. La API pública (Playables.cs) son structs que apuntan acá.
    //
    // La evaluación, como Unity: primero PrepareFrame de arriba hacia abajo desde cada salida
    // (avanzando el tiempo de lo que está en reproducción), después ProcessFrame de cada salida de
    // script con sus datos, y al final lo que aplican las salidas de animación (pose de los
    // animadores) y de audio (voces). Las notificaciones (las señales de Timeline) se entregan al
    // terminar la evaluación.
    internal enum TipoNodo { Generico, Script, ClipAnimacion, MezclaAnimacion, CapasAnimacion, Desfase, MovimientoDelta, SinEscala, ControladorAnimacion, ClipAudio, MezclaAudio }

    internal sealed class Nodo
    {
        public Grafo G;
        public TipoNodo Tipo;
        public Type TipoPlayable;                 // el struct de la API (ScriptPlayable<T>, AnimationClipPlayable...)
        public object Comportamiento;             // el IPlayableBehaviour de un ScriptPlayable
        public readonly List<Nodo> Entradas = new List<Nodo>();
        public readonly List<float> Pesos = new List<float>();
        public readonly List<Nodo> Padres = new List<Nodo>();   // a quién se conecta cada puerto de salida
        public double Tiempo, TiempoPrevio, Duracion = double.MaxValue, Velocidad = 1, Demora;
        public bool Reproduciendo = true, Hecho, PropagarTiempo;
        public DirectorWrapMode Envolver = DirectorWrapMode.Loop;
        public PlayableTraversalMode Recorrido = PlayableTraversalMode.Mix;
        public ulong CuadroTiempoPuesto = ulong.MaxValue, CuadroVisto = ulong.MaxValue, CuadroProcesado = ulong.MaxValue;
        public bool Busqueda;                     // SetTime en este cuadro: seekOccurred
        public bool Destruido;
        public int Notificado = -1;               // último estado avisado al comportamiento (0 pausa, 1 reproducción)
        // animación
        public AnimationClip Clip;
        public bool BucleClipPropio, BucleClip, QuitarDesfaseInicial = true;
        public Vector3 PosDesfase;
        public Quaternion RotDesfase = Quaternion.identity;
        public bool[] CapasAditivas;
        // audio
        public AudioClip ClipAudio;
        public bool BucleAudio;
        public float Volumen = 1, Paneo, Mezcla3D;
        public double InicioAudio, DemoraAudio, DuracionAudio = double.MaxValue;

        public Nodo(Grafo g, TipoNodo tipo, Type tipoPlayable, int entradas)
        {
            G = g; Tipo = tipo; TipoPlayable = tipoPlayable;
            for (int i = 0; i < entradas; i++) { Entradas.Add(null); Pesos.Add(0); }
            Padres.Add(null);
            g.Nodos.Add(this);
        }

        public bool Valido => !Destruido && !G.Destruido;

        public void PonerEntradas(int n)
        {
            n = Math.Max(0, n);
            while (Entradas.Count > n)
            {
                int i = Entradas.Count - 1;
                Desconectar(i);
                Entradas.RemoveAt(i); Pesos.RemoveAt(i);
            }
            while (Entradas.Count < n) { Entradas.Add(null); Pesos.Add(0); }
        }

        public void Desconectar(int entrada)
        {
            if (entrada < 0 || entrada >= Entradas.Count) return;
            var e = Entradas[entrada];
            if (e != null) { int k = e.Padres.IndexOf(this); if (k >= 0) e.Padres[k] = null; }
            Entradas[entrada] = null;
        }

        public void PonerTiempo(double t)
        {
            TiempoPrevio = Tiempo;
            Tiempo = t;
            Hecho = false;
            Busqueda = true;
            CuadroTiempoPuesto = G.Cuadro;
            if (PropagarTiempo)
                foreach (var e in Entradas) if (e != null && !e.Destruido) e.PonerTiempo(t);
        }
    }

    internal sealed class Salida
    {
        public Grafo G;
        public Type Tipo;                         // AnimationPlayableOutput, AudioPlayableOutput, ScriptPlayableOutput...
        public string Nombre;
        public Nodo Fuente;
        public int Puerto;
        public float Peso = 1;
        public Object Referencia;
        public object DatosUsuario;
        public Animator Animador;
        public AudioSource FuenteAudio;
        public bool EvaluarAlBuscar = true;
        public readonly List<INotificationReceiver> Receptores = new List<INotificationReceiver>();
        public bool Destruida;
        // lo que aplica esta salida (animación: un mezclador por animador; audio: las voces)
        internal MezcladorTimeline Mezclador;
        internal readonly Dictionary<Nodo, VozTimeline> Voces = new Dictionary<Nodo, VozTimeline>();

        public Salida(Grafo g, Type tipo, string nombre)
        {
            G = g; Tipo = tipo; Nombre = nombre;
            g.Salidas.Add(this);
        }

        public bool Valida => !Destruida && !G.Destruido;
    }

    internal sealed class Grafo
    {
        public string Nombre;
        public bool Reproduciendo, Destruido;
        public IExposedPropertyTable Resolvedor;
        public DirectorUpdateMode Modo = DirectorUpdateMode.GameTime;
        public PlayableDirector Director;         // si es el grafo de un director, él lo evalúa
        public readonly List<Nodo> Nodos = new List<Nodo>();
        public readonly List<Salida> Salidas = new List<Salida>();
        public ulong Cuadro = 1;
        readonly List<(Salida s, Playable origen, INotification n, object ctx)> avisos = new List<(Salida, Playable, INotification, object)>();
        internal static readonly List<Grafo> vivos = new List<Grafo>();
        internal int Version = 1;

        public Grafo(string nombre)
        {
            Nombre = nombre;
            vivos.Add(this);
        }

        public void Destruir()
        {
            if (Destruido) return;
            if (Reproduciendo) Detener();
            foreach (var s in Salidas.ToArray()) DestruirSalida(s);
            foreach (var n in Nodos.ToArray()) DestruirNodo(n);
            Destruido = true;
            vivos.Remove(this);
        }

        public void DestruirNodo(Nodo n)
        {
            if (n.Destruido) return;
            n.Destruido = true;
            if (n.Comportamiento is IPlayableBehaviour b)
                Llamar(() => b.OnPlayableDestroy(new Playable(new PlayableHandle(n))));
            for (int i = 0; i < n.Entradas.Count; i++) n.Desconectar(i);
            foreach (var p in n.Padres)
                if (p != null) { int k = p.Entradas.IndexOf(n); if (k >= 0) p.Entradas[k] = null; }
            Nodos.Remove(n);
        }

        public void DestruirSalida(Salida s)
        {
            if (s.Destruida) return;
            s.Destruida = true;
            s.Mezclador?.Soltar();
            s.Mezclador = null;
            foreach (var v in s.Voces.Values) v.Parar();
            s.Voces.Clear();
            Salidas.Remove(s);
        }

        public void Reproducir()
        {
            if (Reproduciendo) return;
            Reproduciendo = true;
            foreach (var n in Nodos.ToArray())
                if (n.Comportamiento is IPlayableBehaviour b) Llamar(() => b.OnGraphStart(new Playable(new PlayableHandle(n))));
        }

        public void Detener()
        {
            if (!Reproduciendo) return;
            Reproduciendo = false;
            // lo que estaba sonando o en reproducción se pausa (OnBehaviourPause) antes de OnGraphStop
            var info = Datos(0, 1, 1, null, false);
            foreach (var n in Nodos.ToArray())
            {
                if (n.Comportamiento is IPlayableBehaviour b)
                {
                    if (n.Notificado == 1) { n.Notificado = 0; var nn = n; Llamar(() => b.OnBehaviourPause(new Playable(new PlayableHandle(nn)), info)); }
                    var n2 = n;
                    Llamar(() => b.OnGraphStop(new Playable(new PlayableHandle(n2))));
                }
            }
            foreach (var s in Salidas)
            {
                foreach (var v in s.Voces.Values) v.Parar();
                s.Voces.Clear();
            }
        }

        static void Llamar(Action a)
        {
            try { a(); }
            catch (Exception e) { Debug.LogException(e); }
        }

        // ── la evaluación de un cuadro ──
        FrameData Datos(double dt, float peso, float pesoEfectivo, Salida s, bool reproduccion) => new FrameData
        {
            m_FrameID = Cuadro,
            m_DeltaTime = dt,
            m_Weight = peso,
            m_EffectiveWeight = pesoEfectivo,
            m_EffectiveSpeed = 1,
            m_EffectiveParentSpeed = 1,
            m_Flags = (reproduccion ? 0 : FrameData.Flags.Evaluate),
            m_Output = s != null ? new PlayableOutput(new PlayableOutputHandle(s)) : PlayableOutput.Null,
        };

        public void Evaluar(double dt, bool reproduccion)
        {
            if (Destruido) return;
            Cuadro++;
            // PrepareFrame: desde cada salida (y desde los nodos sin padre que no van a ninguna)
            foreach (var s in Salidas.ToArray())
            {
                if (s.Destruida || s.Fuente == null) continue;
                Preparar(s.Fuente, s.Puerto, s, dt, s.Peso, s.Peso, 1, reproduccion);
            }
            foreach (var n in Nodos.ToArray())
                if (!n.Destruido && n.CuadroVisto != Cuadro && n.Padres.TrueForAll(p => p == null))
                    Preparar(n, -1, null, dt, 1, 1, 1, reproduccion);
            // ProcessFrame de cada salida
            foreach (var s in Salidas.ToArray())
            {
                if (s.Destruida || s.Fuente == null) continue;
                Procesar(s.Fuente, s.Puerto, s, dt, s.Peso, s.Peso, reproduccion);
            }
            // lo que aplican las salidas de animación y de audio
            foreach (var s in Salidas.ToArray())
            {
                if (s.Destruida || s.Fuente == null) continue;
                if (s.Tipo == typeof(UnityEngine.Animations.AnimationPlayableOutput)) AnimacionTimeline.Juntar(s);
                else if (s.Tipo == typeof(UnityEngine.Audio.AudioPlayableOutput)) AudioTimeline.Aplicar(s, reproduccion && Reproduciendo);
            }
            foreach (var n in Nodos) n.Busqueda = false;
            Entregar();
        }

        // ¿a qué entradas baja el recorrido? Passthrough: la del puerto de la salida
        static int Desde(Nodo n, int puerto) => n.Recorrido == PlayableTraversalMode.Passthrough && puerto >= 0 && puerto < n.Entradas.Count ? puerto : -1;

        void Preparar(Nodo n, int puerto, Salida s, double dt, float peso, float pesoEfectivo, double velPadre, bool reproduccion)
        {
            if (n == null || n.Destruido) return;
            bool primeraVez = n.CuadroVisto != Cuadro;
            if (primeraVez)
            {
                n.CuadroVisto = Cuadro;
                bool corre = Reproduciendo && n.Reproduciendo, vuelta = false;
                // el tiempo avanza en lo que está en reproducción (salvo que alguien lo haya puesto este cuadro)
                if (corre && reproduccion && n.CuadroTiempoPuesto != Cuadro)
                {
                    n.TiempoPrevio = n.Tiempo;
                    n.Tiempo += dt * n.Velocidad * velPadre;
                    if (n.Duracion < double.MaxValue && n.Tiempo >= n.Duracion)
                    {
                        switch (n.Envolver)
                        {
                            // timeLooped: las señales de Timeline cuentan con eso para disparar las del
                            // final de la vuelta y rearmar las del principio
                            case DirectorWrapMode.Loop: if (n.Duracion > 0) { n.Tiempo %= n.Duracion; vuelta = true; } break;
                            case DirectorWrapMode.Hold: n.Tiempo = n.Duracion; n.Hecho = true; break;
                            default: n.Hecho = true; break;
                        }
                    }
                }
                if (n.Comportamiento is IPlayableBehaviour b)
                {
                    var p = new Playable(new PlayableHandle(n));
                    var info = Datos(dt, peso, pesoEfectivo, s, reproduccion);
                    info.m_EffectiveSpeed = (float)(n.Velocidad * velPadre);
                    if (n.Busqueda) info.m_Flags |= FrameData.Flags.SeekOccured;
                    if (corre) info.m_Flags |= FrameData.Flags.EffectivePlayStatePlaying;
                    if (vuelta) info.m_Flags |= FrameData.Flags.Loop;
                    int estado = corre ? 1 : 0;
                    if (estado != n.Notificado)
                    {
                        n.Notificado = estado;
                        if (estado == 1) Llamar(() => b.OnBehaviourPlay(p, info));
                        else Llamar(() => b.OnBehaviourPause(p, info));
                    }
                    Llamar(() => b.PrepareFrame(p, info));
                }
            }
            int solo = Desde(n, puerto);
            for (int i = 0; i < n.Entradas.Count; i++)
            {
                if (solo >= 0 && i != solo) continue;
                var e = n.Entradas[i];
                if (e == null) continue;
                float w = n.Pesos[i];
                Preparar(e, -1, s, dt, w, pesoEfectivo * w, velPadre * n.Velocidad, reproduccion);
            }
        }

        void Procesar(Nodo n, int puerto, Salida s, double dt, float peso, float pesoEfectivo, bool reproduccion)
        {
            if (n == null || n.Destruido) return;
            int solo = Desde(n, puerto);
            for (int i = 0; i < n.Entradas.Count; i++)
            {
                if (solo >= 0 && i != solo) continue;
                var e = n.Entradas[i];
                if (e == null) continue;
                float w = n.Pesos[i];
                Procesar(e, -1, s, dt, w, pesoEfectivo * w, reproduccion);
            }
            if (n.Comportamiento is IPlayableBehaviour b && s.Tipo == typeof(ScriptPlayableOutput))
            {
                var p = new Playable(new PlayableHandle(n));
                var info = Datos(dt, peso, pesoEfectivo, s, reproduccion);
                if (Reproduciendo && n.Reproduciendo) info.m_Flags |= FrameData.Flags.EffectivePlayStatePlaying;
                var datos = s.DatosUsuario;
                Llamar(() => b.ProcessFrame(p, info, datos));
            }
        }

        // ── notificaciones ──
        public void Avisar(Salida s, Playable origen, INotification n, object ctx)
        {
            avisos.Add((s, origen, n, ctx));
            if (VerAvisos) Debug.Log($"porteo: aviso {n?.GetType().Name} {(n as Object)?.name} en t={origen.GetTime():F3} ({Director?.name} t={Director?.time:F3}) a {s.Receptores.Count} receptores");
        }

        // ?diag / prueba de consola: cada señal de Timeline en la consola
        public static bool VerAvisos;

        void Entregar()
        {
            if (avisos.Count == 0) return;
            var l = avisos.ToArray();
            avisos.Clear();
            foreach (var (s, origen, n, ctx) in l)
                foreach (var r in s.Receptores.ToArray())
                {
                    if (r is Object o && (o == null || (o is Behaviour bh && !bh.isActiveAndEnabled))) continue;
                    Llamar(() => r.OnNotify(origen, n, ctx));
                }
        }

        // los grafos que no son de un director y están en reproducción se evalúan solos (GameTime)
        internal static void Actualizar()
        {
            if (vivos.Count == 0) return;
            foreach (var g in vivos.ToArray())
            {
                if (g.Destruido || !g.Reproduciendo || g.Director != null || g.Modo == DirectorUpdateMode.Manual) continue;
                double dt = g.Modo == DirectorUpdateMode.UnscaledGameTime ? Time.unscaledDeltaTime : Time.deltaTime;
                g.Evaluar(dt, true);
            }
        }
    }

    // Los directores y los grafos sueltos, cada cuadro: después de Update (DirectorUpdate de Unity)
    // se evalúan; después de los animadores, la pose de Timeline pisa la de sus controladores.
    public static class Directores
    {
        internal static readonly List<PlayableDirector> activos = new List<PlayableDirector>();

        public static void IniciarAntesDeAnimar()
        {
            Mundo.AntesDeLateUpdate += Actualizar;
        }

        public static void IniciarDespuesDeAnimar()
        {
            Mundo.AntesDeLateUpdate += AnimacionTimeline.Aplicar;
        }

        static void Actualizar()
        {
            foreach (var d in activos.ToArray())
            {
                if (d == null || d.destruido || !d.isActiveAndEnabled) continue;
                try { d.Cuadro(); }
                catch (Exception e) { Debug.LogException(e, d); }
            }
            Grafo.Actualizar();
        }
    }
}

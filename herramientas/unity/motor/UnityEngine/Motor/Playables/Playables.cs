using System;
using System.Collections.Generic;
using Porteo.Playables;
using Object = UnityEngine.Object;

// La API de Playables de Unity (UnityEngine.Playables): structs livianos que apuntan a los nodos y
// salidas del grafo de Grafo.cs, con las mismas firmas que Unity 2022 (Timeline corre tal cual
// arriba de esto).
namespace UnityEngine.Playables
{
    public enum PlayState { Paused = 0, Playing = 1, [Obsolete] Delayed = 2 }
    public enum DirectorWrapMode { Hold = 0, Loop = 1, None = 2 }
    public enum DirectorUpdateMode { DSPClock = 0, GameTime = 1, UnscaledGameTime = 2, Manual = 3 }
    public enum PlayableTraversalMode { Mix = 0, Passthrough = 1 }
    public enum DataStreamType { Animation = 0, Audio = 1, Texture = 2, None = 3 }

    public interface IPlayable { PlayableHandle GetHandle(); }
    public interface IPlayableOutput { PlayableOutputHandle GetHandle(); }

    public interface IPlayableBehaviour
    {
        void OnGraphStart(Playable playable);
        void OnGraphStop(Playable playable);
        void OnPlayableCreate(Playable playable);
        void OnPlayableDestroy(Playable playable);
        void OnBehaviourPlay(Playable playable, FrameData info);
        void OnBehaviourPause(Playable playable, FrameData info);
        void PrepareFrame(Playable playable, FrameData info);
        void ProcessFrame(Playable playable, FrameData info, object playerData);
    }

    public interface IPlayableAsset
    {
        double duration { get; }
        IEnumerable<PlayableBinding> outputs { get; }
        Playable CreatePlayable(PlayableGraph graph, GameObject owner);
    }

    public interface INotification { PropertyName id { get; } }
    public interface INotificationReceiver { void OnNotify(Playable origin, INotification notification, object context); }

    public class Notification : INotification
    {
        readonly PropertyName m_Id;
        public Notification(string name) { m_Id = new PropertyName(name); }
        public PropertyName id => m_Id;
    }

    // ── manijas ──
    public struct PlayableHandle : IEquatable<PlayableHandle>
    {
        internal readonly Nodo m_Nodo;
        internal PlayableHandle(Nodo n) { m_Nodo = n; }
        internal static readonly PlayableHandle m_Null = default;

        public static PlayableHandle Null => m_Null;
        internal bool IsValid() => m_Nodo != null && m_Nodo.Valido;
        internal Nodo N => m_Nodo != null && m_Nodo.Valido ? m_Nodo : throw new InvalidOperationException("This PlayableHandle is invalid");

        public T GetObject<T>() where T : class, IPlayableBehaviour => m_Nodo?.Comportamiento as T;
        public void SetScriptInstance(object scriptInstance)
        {
            var n = N;
            n.Comportamiento = scriptInstance;
        }
        internal object GetScriptInstance() => m_Nodo?.Comportamiento;
        internal Type GetPlayableType() => m_Nodo?.TipoPlayable;
        internal bool IsPlayableOfType<T>() => m_Nodo != null && m_Nodo.TipoPlayable == typeof(T);

        public bool Equals(PlayableHandle other) => ReferenceEquals(m_Nodo, other.m_Nodo);
        public override bool Equals(object p) => p is PlayableHandle h && Equals(h);
        public override int GetHashCode() => m_Nodo?.GetHashCode() ?? 0;
        public static bool operator ==(PlayableHandle x, PlayableHandle y) => x.Equals(y);
        public static bool operator !=(PlayableHandle x, PlayableHandle y) => !x.Equals(y);
    }

    public struct PlayableOutputHandle : IEquatable<PlayableOutputHandle>
    {
        internal readonly Salida m_Salida;
        internal PlayableOutputHandle(Salida s) { m_Salida = s; }

        public static PlayableOutputHandle Null => default;
        internal bool IsValid() => m_Salida != null && m_Salida.Valida;
        internal Salida S => m_Salida != null && m_Salida.Valida ? m_Salida : throw new InvalidOperationException("This PlayableOutput is invalid");

        public bool Equals(PlayableOutputHandle other) => ReferenceEquals(m_Salida, other.m_Salida);
        public override bool Equals(object p) => p is PlayableOutputHandle h && Equals(h);
        public override int GetHashCode() => m_Salida?.GetHashCode() ?? 0;
        public static bool operator ==(PlayableOutputHandle lhs, PlayableOutputHandle rhs) => lhs.Equals(rhs);
        public static bool operator !=(PlayableOutputHandle lhs, PlayableOutputHandle rhs) => !lhs.Equals(rhs);
    }

    // ── playables ──
    public struct Playable : IPlayable, IEquatable<Playable>
    {
        readonly PlayableHandle m_Handle;
        internal Playable(PlayableHandle handle) { m_Handle = handle; }

        public static Playable Null => default;

        public static Playable Create(PlayableGraph graph, int inputCount = 0) =>
            new Playable(new PlayableHandle(new Nodo(graph.G, TipoNodo.Generico, typeof(Playable), inputCount)));

        public PlayableHandle GetHandle() => m_Handle;
        public bool IsPlayableOfType<T>() where T : struct, IPlayable => m_Handle.IsPlayableOfType<T>();
        public Type GetPlayableType() => m_Handle.GetPlayableType();
        public bool Equals(Playable other) => m_Handle == other.m_Handle;
        public override bool Equals(object o) => o is Playable p && Equals(p);
        public override int GetHashCode() => m_Handle.GetHashCode();
    }

    public struct ScriptPlayable<T> : IPlayable, IEquatable<ScriptPlayable<T>> where T : class, IPlayableBehaviour, new()
    {
        readonly PlayableHandle m_Handle;
        internal ScriptPlayable(PlayableHandle handle) { m_Handle = handle; }

        public static ScriptPlayable<T> Null => default;

        public static ScriptPlayable<T> Create(PlayableGraph graph, int inputCount = 0) => Create(graph, null, inputCount);

        public static ScriptPlayable<T> Create(PlayableGraph graph, T template, int inputCount = 0)
        {
            var n = new Nodo(graph.G, TipoNodo.Script, typeof(ScriptPlayable<T>), inputCount);
            // como Unity: una copia de la plantilla (PlayableBehaviour es ICloneable) o uno nuevo
            T b = template == null ? new T() : template is ICloneable c ? (T)c.Clone() : template;
            n.Comportamiento = b;
            var sp = new ScriptPlayable<T>(new PlayableHandle(n));
            try { b.OnPlayableCreate(sp); }
            catch (Exception e) { Debug.LogException(e); }
            return sp;
        }

        public PlayableHandle GetHandle() => m_Handle;
        public T GetBehaviour() => m_Handle.GetObject<T>();

        public static implicit operator Playable(ScriptPlayable<T> playable) => new Playable(playable.GetHandle());
        public static explicit operator ScriptPlayable<T>(Playable playable)
        {
            if (playable.GetHandle().IsValid() && !playable.GetHandle().IsPlayableOfType<ScriptPlayable<T>>() && !(playable.GetHandle().GetScriptInstance() is T))
                throw new InvalidCastException($"Incompatible handle: Trying to assign a playable data of type `{playable.GetPlayableType()}` that is not compatible with the PlayableBehaviour of type `{typeof(T)}`.");
            return new ScriptPlayable<T>(playable.GetHandle());
        }

        public bool Equals(ScriptPlayable<T> other) => GetHandle() == other.GetHandle();
        public override bool Equals(object o) => o is ScriptPlayable<T> p && Equals(p);
        public override int GetHashCode() => m_Handle.GetHashCode();
    }

    // ── el grafo ──
    public struct PlayableGraph
    {
        readonly Grafo m_Grafo;
        internal PlayableGraph(Grafo g) { m_Grafo = g; }
        internal Grafo G => m_Grafo != null && !m_Grafo.Destruido ? m_Grafo : throw new InvalidOperationException("This PlayableGraph is invalid");

        public static PlayableGraph Create() => Create(null);
        public static PlayableGraph Create(string name) => new PlayableGraph(new Grafo(name));

        public void Destroy() => m_Grafo?.Destruir();
        public bool IsValid() => m_Grafo != null && !m_Grafo.Destruido;
        public bool IsPlaying() => IsValid() && m_Grafo.Reproduciendo;
        public bool IsDone()
        {
            if (!IsValid()) return true;
            foreach (var n in m_Grafo.Nodos) if (n.Padres.TrueForAll(p => p == null) && !n.Hecho) return false;
            return true;
        }
        public void Play() => G.Reproducir();
        public void Stop() => G.Detener();
        public void Evaluate() => Evaluate(0);
        public void Evaluate(float deltaTime) => G.Evaluar(deltaTime, deltaTime > 0);
        public DirectorUpdateMode GetTimeUpdateMode() => G.Modo;
        public void SetTimeUpdateMode(DirectorUpdateMode value) => G.Modo = value;
        public IExposedPropertyTable GetResolver() => IsValid() ? m_Grafo.Resolvedor : null;
        public void SetResolver(IExposedPropertyTable value) => G.Resolvedor = value;
        public int GetPlayableCount() => IsValid() ? m_Grafo.Nodos.Count : 0;
        public int GetRootPlayableCount()
        {
            if (!IsValid()) return 0;
            int k = 0;
            foreach (var n in m_Grafo.Nodos) if (n.Padres.TrueForAll(p => p == null)) k++;
            return k;
        }
        public Playable GetRootPlayable(int index)
        {
            if (!IsValid()) return Playable.Null;
            int k = 0;
            foreach (var n in m_Grafo.Nodos)
                if (n.Padres.TrueForAll(p => p == null) && k++ == index) return new Playable(new PlayableHandle(n));
            return Playable.Null;
        }
        public int GetOutputCount() => IsValid() ? m_Grafo.Salidas.Count : 0;
        public PlayableOutput GetOutput(int index) => IsValid() && index >= 0 && index < m_Grafo.Salidas.Count ? new PlayableOutput(new PlayableOutputHandle(m_Grafo.Salidas[index])) : PlayableOutput.Null;
        public int GetOutputCountByType<T>() where T : struct, IPlayableOutput
        {
            if (!IsValid()) return 0;
            int k = 0;
            foreach (var s in m_Grafo.Salidas) if (s.Tipo == typeof(T)) k++;
            return k;
        }
        public PlayableOutput GetOutputByType<T>(int index) where T : struct, IPlayableOutput
        {
            if (!IsValid()) return PlayableOutput.Null;
            int k = 0;
            foreach (var s in m_Grafo.Salidas) if (s.Tipo == typeof(T) && k++ == index) return new PlayableOutput(new PlayableOutputHandle(s));
            return PlayableOutput.Null;
        }
        public string GetEditorName() => IsValid() ? m_Grafo.Nombre ?? "" : "";

        public bool Connect<U, V>(U source, int sourceOutputPort, V destination, int destinationInputPort) where U : struct, IPlayable where V : struct, IPlayable
        {
            var a = source.GetHandle().m_Nodo; var b = destination.GetHandle().m_Nodo;
            if (a == null || b == null || a.Destruido || b.Destruido) return false;
            if (destinationInputPort < 0) return false;
            if (destinationInputPort >= b.Entradas.Count) b.PonerEntradas(destinationInputPort + 1);
            b.Desconectar(destinationInputPort);
            b.Entradas[destinationInputPort] = a;
            while (a.Padres.Count <= Math.Max(0, sourceOutputPort)) a.Padres.Add(null);
            a.Padres[Math.Max(0, sourceOutputPort)] = b;
            return true;
        }

        public void Disconnect<U>(U input, int inputPort) where U : struct, IPlayable => input.GetHandle().m_Nodo?.Desconectar(inputPort);
        public void DestroyPlayable<U>(U playable) where U : struct, IPlayable { var n = playable.GetHandle().m_Nodo; n?.G.DestruirNodo(n); }
        public void DestroySubgraph<U>(U playable) where U : struct, IPlayable
        {
            var n = playable.GetHandle().m_Nodo;
            if (n == null) return;
            foreach (var e in n.Entradas.ToArray()) if (e != null) DestroySubgraph(new Playable(new PlayableHandle(e)));
            n.G.DestruirNodo(n);
        }
        public void DestroyOutput<U>(U output) where U : struct, IPlayableOutput { var s = output.GetHandle().m_Salida; s?.G.DestruirSalida(s); }
        public void SynchronizeEvaluation(PlayableGraph playable) { }
        public bool IsMatchFrameRateEnabled() => false;
        public void EnableMatchFrameRate(FrameRate frameRate) { }
        public void DisableMatchFrameRate() { }
        public FrameRate GetFrameRate() => default;
    }

    public struct FrameData
    {
        internal ulong m_FrameID;
        internal double m_DeltaTime;
        internal float m_Weight, m_EffectiveWeight;
        internal double m_EffectiveParentDelay;
        internal float m_EffectiveParentSpeed, m_EffectiveSpeed;
        internal Flags m_Flags;
        internal PlayableOutput m_Output;

        [Flags]
        internal enum Flags { Evaluate = 1, SeekOccured = 2, Loop = 4, Hold = 8, EffectivePlayStateDelayed = 16, EffectivePlayStatePlaying = 32 }

        public enum EvaluationType { Evaluate = 0, Playback = 1 }

        public ulong frameId => m_FrameID;
        public float deltaTime => (float)m_DeltaTime;
        public float weight => m_Weight;
        public float effectiveWeight => m_EffectiveWeight;
        [Obsolete] public double effectiveParentDelay => m_EffectiveParentDelay;
        public float effectiveParentSpeed => m_EffectiveParentSpeed;
        public float effectiveSpeed => m_EffectiveSpeed;
        public EvaluationType evaluationType => (m_Flags & Flags.Evaluate) != 0 ? EvaluationType.Evaluate : EvaluationType.Playback;
        public bool seekOccurred => (m_Flags & Flags.SeekOccured) != 0;
        public bool timeLooped => (m_Flags & Flags.Loop) != 0;
        public bool timeHeld => (m_Flags & Flags.Hold) != 0;
        public PlayableOutput output => m_Output;
        public PlayState effectivePlayState => (m_Flags & Flags.EffectivePlayStatePlaying) != 0 ? PlayState.Playing : PlayState.Paused;
    }

    public struct FrameRate : IEquatable<FrameRate>
    {
        // como Unity: cuadros por segundo enteros, o el 1000/1001 de NTSC (negativo)
        readonly int m_Rate;
        public static readonly FrameRate k_24Fps = new FrameRate(24), k_23_976Fps = new FrameRate(24, true), k_25Fps = new FrameRate(25),
            k_30Fps = new FrameRate(30), k_29_97Fps = new FrameRate(30, true), k_50Fps = new FrameRate(50), k_60Fps = new FrameRate(60), k_59_94Fps = new FrameRate(60, true);

        public FrameRate(uint frameRate = 0, bool drop = false) { m_Rate = (drop ? -1 : 1) * (int)frameRate; }
        public bool dropFrame => m_Rate < 0;
        public double rate => dropFrame ? -m_Rate * (1000.0 / 1001.0) : m_Rate;
        public bool IsValid() => m_Rate != 0;
        public bool Equals(FrameRate other) => m_Rate == other.m_Rate;
        public override bool Equals(object obj) => obj is FrameRate f && Equals(f);
        public override int GetHashCode() => m_Rate;
        public static bool operator ==(FrameRate a, FrameRate b) => a.Equals(b);
        public static bool operator !=(FrameRate a, FrameRate b) => !a.Equals(b);
        public static FrameRate DoubleToFrameRate(double framerate)
        {
            uint r = (uint)Math.Ceiling(framerate);
            if (r <= 0) return new FrameRate(1);
            var drop = new FrameRate(r, true);
            return Math.Abs(framerate - drop.rate) < Math.Abs(framerate - r) ? drop : new FrameRate(r);
        }
        public override string ToString() => rate.ToString("F2");
    }

    public static class PlayableExtensions
    {
        static Nodo N<U>(U p) where U : struct, IPlayable => p.GetHandle().N;
        static Nodo O<U>(U p) where U : struct, IPlayable => p.GetHandle().m_Nodo;

        public static bool IsNull<U>(this U playable) where U : struct, IPlayable => O(playable) == null;
        public static bool IsValid<U>(this U playable) where U : struct, IPlayable => playable.GetHandle().IsValid();
        public static void Destroy<U>(this U playable) where U : struct, IPlayable { var n = O(playable); n?.G.DestruirNodo(n); }
        public static PlayableGraph GetGraph<U>(this U playable) where U : struct, IPlayable => new PlayableGraph(O(playable)?.G);
        [Obsolete] public static void SetPlayState<U>(this U playable, PlayState value) where U : struct, IPlayable { if (value == PlayState.Playing) Play(playable); else Pause(playable); }
        public static PlayState GetPlayState<U>(this U playable) where U : struct, IPlayable => O(playable) is Nodo n && n.Reproduciendo ? PlayState.Playing : PlayState.Paused;
        public static void Play<U>(this U playable) where U : struct, IPlayable => N(playable).Reproduciendo = true;
        public static void Pause<U>(this U playable) where U : struct, IPlayable => N(playable).Reproduciendo = false;
        public static void SetSpeed<U>(this U playable, double value) where U : struct, IPlayable => N(playable).Velocidad = value;
        public static double GetSpeed<U>(this U playable) where U : struct, IPlayable => O(playable)?.Velocidad ?? 0;
        public static void SetDuration<U>(this U playable, double value) where U : struct, IPlayable => N(playable).Duracion = value;
        public static double GetDuration<U>(this U playable) where U : struct, IPlayable => O(playable)?.Duracion ?? 0;
        public static void SetTime<U>(this U playable, double value) where U : struct, IPlayable => N(playable).PonerTiempo(value);
        public static double GetTime<U>(this U playable) where U : struct, IPlayable => O(playable)?.Tiempo ?? 0;
        public static double GetPreviousTime<U>(this U playable) where U : struct, IPlayable => O(playable)?.TiempoPrevio ?? 0;
        public static void SetDone<U>(this U playable, bool value) where U : struct, IPlayable => N(playable).Hecho = value;
        public static bool IsDone<U>(this U playable) where U : struct, IPlayable => O(playable)?.Hecho ?? true;
        public static void SetPropagateSetTime<U>(this U playable, bool value) where U : struct, IPlayable => N(playable).PropagarTiempo = value;
        public static bool GetPropagateSetTime<U>(this U playable) where U : struct, IPlayable => O(playable)?.PropagarTiempo ?? false;
        public static bool CanChangeInputs<U>(this U playable) where U : struct, IPlayable => true;
        public static bool CanSetWeights<U>(this U playable) where U : struct, IPlayable => true;
        public static bool CanDestroy<U>(this U playable) where U : struct, IPlayable => true;
        public static void SetInputCount<U>(this U playable, int value) where U : struct, IPlayable => N(playable).PonerEntradas(value);
        public static int GetInputCount<U>(this U playable) where U : struct, IPlayable => O(playable)?.Entradas.Count ?? 0;
        public static void SetOutputCount<U>(this U playable, int value) where U : struct, IPlayable
        {
            var n = N(playable);
            while (n.Padres.Count < value) n.Padres.Add(null);
            while (n.Padres.Count > Math.Max(1, value)) n.Padres.RemoveAt(n.Padres.Count - 1);
        }
        public static int GetOutputCount<U>(this U playable) where U : struct, IPlayable => O(playable)?.Padres.Count ?? 0;
        public static Playable GetInput<U>(this U playable, int inputPort) where U : struct, IPlayable
        {
            var n = O(playable);
            if (n == null || inputPort < 0 || inputPort >= n.Entradas.Count || n.Entradas[inputPort] == null) return Playable.Null;
            return new Playable(new PlayableHandle(n.Entradas[inputPort]));
        }
        public static Playable GetOutput<U>(this U playable, int outputPort) where U : struct, IPlayable
        {
            var n = O(playable);
            if (n == null || outputPort < 0 || outputPort >= n.Padres.Count || n.Padres[outputPort] == null) return Playable.Null;
            return new Playable(new PlayableHandle(n.Padres[outputPort]));
        }
        public static void SetInputWeight<U>(this U playable, int inputIndex, float weight) where U : struct, IPlayable
        {
            var n = N(playable);
            if (inputIndex >= 0 && inputIndex < n.Pesos.Count) n.Pesos[inputIndex] = weight;
        }
        public static void SetInputWeight<U, V>(this U playable, V input, float weight) where U : struct, IPlayable where V : struct, IPlayable
        {
            var n = N(playable);
            int i = n.Entradas.IndexOf(input.GetHandle().m_Nodo);
            if (i >= 0) n.Pesos[i] = weight;
        }
        public static float GetInputWeight<U>(this U playable, int inputIndex) where U : struct, IPlayable
        {
            var n = O(playable);
            return n != null && inputIndex >= 0 && inputIndex < n.Pesos.Count ? n.Pesos[inputIndex] : 0;
        }
        public static void ConnectInput<U, V>(this U playable, int inputIndex, V sourcePlayable, int sourceOutputIndex) where U : struct, IPlayable where V : struct, IPlayable =>
            ConnectInput(playable, inputIndex, sourcePlayable, sourceOutputIndex, 0);
        public static void ConnectInput<U, V>(this U playable, int inputIndex, V sourcePlayable, int sourceOutputIndex, float weight) where U : struct, IPlayable where V : struct, IPlayable
        {
            playable.GetGraph().Connect(sourcePlayable, sourceOutputIndex, playable, inputIndex);
            playable.SetInputWeight(inputIndex, weight);
        }
        public static void DisconnectInput<U>(this U playable, int inputPort) where U : struct, IPlayable => N(playable).Desconectar(inputPort);
        public static int AddInput<U, V>(this U playable, V sourcePlayable, int sourceOutputIndex, float weight = 0) where U : struct, IPlayable where V : struct, IPlayable
        {
            var n = N(playable);
            int i = n.Entradas.Count;
            n.PonerEntradas(i + 1);
            playable.ConnectInput(i, sourcePlayable, sourceOutputIndex, weight);
            return i;
        }
        public static void SetLeadTime<U>(this U playable, float value) where U : struct, IPlayable { }
        public static float GetLeadTime<U>(this U playable) where U : struct, IPlayable => 0;
        public static PlayableTraversalMode GetTraversalMode<U>(this U playable) where U : struct, IPlayable => O(playable)?.Recorrido ?? PlayableTraversalMode.Mix;
        public static void SetTraversalMode<U>(this U playable, PlayableTraversalMode mode) where U : struct, IPlayable => N(playable).Recorrido = mode;
        public static DirectorWrapMode GetTimeWrapMode<U>(this U playable) where U : struct, IPlayable => O(playable)?.Envolver ?? DirectorWrapMode.Loop;
        public static void SetTimeWrapMode<U>(this U playable, DirectorWrapMode value) where U : struct, IPlayable => N(playable).Envolver = value;
        [Obsolete] public static void SetDelay<U>(this U playable, double delay) where U : struct, IPlayable => N(playable).Demora = delay;
        [Obsolete] public static double GetDelay<U>(this U playable) where U : struct, IPlayable => O(playable)?.Demora ?? 0;
        [Obsolete] public static bool IsDelayed<U>(this U playable) where U : struct, IPlayable => false;
    }

    // ── salidas ──
    public struct PlayableOutput : IPlayableOutput, IEquatable<PlayableOutput>
    {
        readonly PlayableOutputHandle m_Handle;
        internal PlayableOutput(PlayableOutputHandle handle) { m_Handle = handle; }

        public static PlayableOutput Null => default;
        public PlayableOutputHandle GetHandle() => m_Handle;
        public bool IsPlayableOutputOfType<T>() where T : struct, IPlayableOutput => m_Handle.m_Salida != null && m_Handle.m_Salida.Tipo == typeof(T);
        public Type GetPlayableOutputType() => m_Handle.m_Salida?.Tipo;
        public bool Equals(PlayableOutput other) => GetHandle() == other.GetHandle();
        public override bool Equals(object o) => o is PlayableOutput p && Equals(p);
        public override int GetHashCode() => m_Handle.GetHashCode();
    }

    public struct ScriptPlayableOutput : IPlayableOutput
    {
        readonly PlayableOutputHandle m_Handle;
        internal ScriptPlayableOutput(PlayableOutputHandle handle) { m_Handle = handle; }

        public static ScriptPlayableOutput Create(PlayableGraph graph, string name) =>
            new ScriptPlayableOutput(new PlayableOutputHandle(new Salida(graph.G, typeof(ScriptPlayableOutput), name)));
        public static ScriptPlayableOutput Null => default;
        public PlayableOutputHandle GetHandle() => m_Handle;
        public static implicit operator PlayableOutput(ScriptPlayableOutput output) => new PlayableOutput(output.GetHandle());
        public static explicit operator ScriptPlayableOutput(PlayableOutput output) => new ScriptPlayableOutput(output.GetHandle());
    }

    public static class PlayableOutputExtensions
    {
        static Salida S<U>(U o) where U : struct, IPlayableOutput => o.GetHandle().S;
        static Salida O<U>(U o) where U : struct, IPlayableOutput => o.GetHandle().m_Salida;

        public static bool IsOutputNull<U>(this U output) where U : struct, IPlayableOutput => O(output) == null;
        public static bool IsOutputValid<U>(this U output) where U : struct, IPlayableOutput => output.GetHandle().IsValid();
        public static Object GetReferenceObject<U>(this U output) where U : struct, IPlayableOutput => O(output)?.Referencia;
        public static void SetReferenceObject<U>(this U output, Object value) where U : struct, IPlayableOutput => S(output).Referencia = value;
        public static Object GetUserData<U>(this U output) where U : struct, IPlayableOutput => O(output)?.DatosUsuario as Object;
        public static void SetUserData<U>(this U output, Object value) where U : struct, IPlayableOutput => S(output).DatosUsuario = value;
        public static Playable GetSourcePlayable<U>(this U output) where U : struct, IPlayableOutput =>
            O(output)?.Fuente is Nodo n ? new Playable(new PlayableHandle(n)) : Playable.Null;
        public static void SetSourcePlayable<U, V>(this U output, V value) where U : struct, IPlayableOutput where V : struct, IPlayable => SetSourcePlayable(output, value, 0);
        public static void SetSourcePlayable<U, V>(this U output, V value, int port) where U : struct, IPlayableOutput where V : struct, IPlayable
        {
            var s = S(output);
            s.Fuente = value.GetHandle().m_Nodo;
            s.Puerto = port;
        }
        public static int GetSourceOutputPort<U>(this U output) where U : struct, IPlayableOutput => O(output)?.Puerto ?? 0;
        public static float GetWeight<U>(this U output) where U : struct, IPlayableOutput => O(output)?.Peso ?? 0;
        public static void SetWeight<U>(this U output, float value) where U : struct, IPlayableOutput => S(output).Peso = value;
        public static void PushNotification<U>(this U output, Playable origin, INotification notification, object context = null) where U : struct, IPlayableOutput
        {
            var s = O(output);
            if (s == null || s.Destruida) return;
            s.G.Avisar(s, origin, notification, context);
        }
        public static INotificationReceiver[] GetNotificationReceivers<U>(this U output) where U : struct, IPlayableOutput => O(output)?.Receptores.ToArray() ?? Array.Empty<INotificationReceiver>();
        public static void AddNotificationReceiver<U>(this U output, INotificationReceiver receiver) where U : struct, IPlayableOutput
        {
            var s = S(output);
            if (receiver != null && !s.Receptores.Contains(receiver)) s.Receptores.Add(receiver);
        }
        public static void RemoveNotificationReceiver<U>(this U output, INotificationReceiver receiver) where U : struct, IPlayableOutput => O(output)?.Receptores.Remove(receiver);
        [Obsolete] public static void SetSourceInputPort<U>(this U output, int value) where U : struct, IPlayableOutput { }
        [Obsolete] public static int GetSourceInputPort<U>(this U output) where U : struct, IPlayableOutput => 0;
    }

    // ── enlaces de un asset con lo que mueve (pistas de Timeline) ──
    public struct PlayableBinding
    {
        internal string m_StreamName;
        internal Object m_SourceObject;
        internal Type m_SourceBindingType;
        internal CreateOutputMethod m_CreateOutputMethod;

        public static readonly PlayableBinding[] None = new PlayableBinding[0];
        public static readonly double DefaultDuration = double.PositiveInfinity;

        public delegate PlayableOutput CreateOutputMethod(PlayableGraph graph, string name);

        public string streamName { get => m_StreamName; set => m_StreamName = value; }
        public Object sourceObject { get => m_SourceObject; set => m_SourceObject = value; }
        public Type outputTargetType => m_SourceBindingType;
        [Obsolete] public Type sourceBindingType { get => m_SourceBindingType; set => m_SourceBindingType = value; }

        public PlayableOutput CreateOutput(PlayableGraph graph)
        {
            if (!graph.IsValid()) throw new ArgumentException("Trying to create a PlayableOutput with an invalid PlayableGraph");
            return m_CreateOutputMethod != null ? m_CreateOutputMethod(graph, m_StreamName) : PlayableOutput.Null;
        }

        internal static PlayableBinding CreateInternal(string name, Object sourceObject, Type sourceType, CreateOutputMethod createFunction) =>
            new PlayableBinding { m_StreamName = name, m_SourceObject = sourceObject, m_SourceBindingType = sourceType, m_CreateOutputMethod = createFunction };
    }

    public static class ScriptPlayableBinding
    {
        public static PlayableBinding Create(string name, Object key, Type type) =>
            PlayableBinding.CreateInternal(name, key, type, (g, n) => ScriptPlayableOutput.Create(g, n));
    }

    // ── assets y comportamientos ──
    [Serializable]
    public abstract class PlayableAsset : ScriptableObject, IPlayableAsset
    {
        public abstract Playable CreatePlayable(PlayableGraph graph, GameObject owner);
        public virtual double duration => PlayableBinding.DefaultDuration;
        public virtual IEnumerable<PlayableBinding> outputs => PlayableBinding.None;
    }

    [Serializable]
    public abstract class PlayableBehaviour : IPlayableBehaviour, ICloneable
    {
        public PlayableBehaviour() { }
        public virtual void OnGraphStart(Playable playable) { }
        public virtual void OnGraphStop(Playable playable) { }
        public virtual void OnPlayableCreate(Playable playable) { }
        public virtual void OnPlayableDestroy(Playable playable) { }
        [Obsolete] public virtual void OnBehaviourDelay(Playable playable, FrameData info) { }
        public virtual void OnBehaviourPlay(Playable playable, FrameData info) { }
        public virtual void OnBehaviourPause(Playable playable, FrameData info) { }
        public virtual void PrepareData(Playable playable, FrameData info) { }
        public virtual void PrepareFrame(Playable playable, FrameData info) { }
        public virtual void ProcessFrame(Playable playable, FrameData info, object playerData) { }
        public virtual object Clone() => MemberwiseClone();
    }
}

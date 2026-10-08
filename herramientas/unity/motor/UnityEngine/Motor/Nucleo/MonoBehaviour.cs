using System;
using System.Collections;
using Porteo;

namespace UnityEngine
{
    public partial class MonoBehaviour : Behaviour
    {
        internal bool despierto;     // Awake ya corrió
        internal bool iniciado;      // Start ya corrió
        internal bool enColaStart;   // está esperando su Start
        internal bool enLinea;       // OnEnable corrió y OnDisable todavía no
        internal TipoScript tipoScript;
        internal Ciclo.Entrada eUpdate, eLate, eFijo;
        internal System.Collections.Generic.List<Corrutinas.Rutina> rutinas;

        public MonoBehaviour() { }

        public bool useGUILayout { get; set; } = true;
        public bool runInEditMode { get; set; }

        // ── corrutinas ──
        public Coroutine StartCoroutine(IEnumerator routine)
        {
            if (routine == null) throw new NullReferenceException("routine is null");
            if (!PuedeCorrutinas()) return null;
            return Corrutinas.Iniciar(this, routine, null);
        }

        public Coroutine StartCoroutine(string methodName) => StartCoroutine(methodName, null);

        public Coroutine StartCoroutine(string methodName, object value)
        {
            if (!PuedeCorrutinas()) return null;
            var it = Mensajes.LlamarCorrutina(this, methodName, value);
            if (it == null) { Debug.LogError($"Coroutine '{methodName}' couldn't be started!"); return null; }
            return Corrutinas.Iniciar(this, it, methodName);
        }

        public Coroutine StartCoroutine_Auto(IEnumerator routine) => StartCoroutine(routine);

        bool PuedeCorrutinas()
        {
            if (go == null || !go.activoEnJerarquia)
            {
                Debug.LogError($"Coroutine couldn't be started because the the game object '{name}' is inactive!");
                return false;
            }
            return true;
        }

        public void StopCoroutine(IEnumerator routine) => Corrutinas.Parar(this, routine);
        public void StopCoroutine(Coroutine routine) => Corrutinas.Parar(this, routine);
        public void StopCoroutine(string methodName) => Corrutinas.Parar(this, methodName);
        public void StopAllCoroutines() => Corrutinas.PararTodas(this);

        // ── Invoke ──
        public void Invoke(string methodName, float time) => Invocaciones.Agendar(this, methodName, time, -1f);
        public void InvokeRepeating(string methodName, float time, float repeatRate)
        {
            if (repeatRate <= 0.00001f && repeatRate != 0f) throw new UnityException("Invoke repeat rate has to be larger than 0.00001F");
            Invocaciones.Agendar(this, methodName, time, repeatRate);
        }
        public void CancelInvoke() => Invocaciones.Cancelar(this, null);
        public void CancelInvoke(string methodName) => Invocaciones.Cancelar(this, methodName);
        public bool IsInvoking() => Invocaciones.Hay(this, null);
        public bool IsInvoking(string methodName) => Invocaciones.Hay(this, methodName);

        public static void print(object message) => Debug.Log(message);
    }

    public partial class ScriptableObject : Object
    {
        internal bool despierto;

        public ScriptableObject() { }

        public static ScriptableObject CreateInstance(string className)
        {
            var t = Tipos.Buscar(className);
            return t == null ? null : CreateInstance(t);
        }

        public static ScriptableObject CreateInstance(Type type)
        {
            var so = (ScriptableObject)Instancias.Crear(type);
            Activacion.DespertarScriptable(so);
            return so;
        }

        public static T CreateInstance<T>() where T : ScriptableObject => (T)CreateInstance(typeof(T));
    }

    public partial class YieldInstruction { }

    public sealed partial class Coroutine : YieldInstruction
    {
        internal readonly Corrutinas.Rutina rutina;
        internal Coroutine(Corrutinas.Rutina r) { rutina = r; }
    }

    public sealed partial class WaitForSeconds : YieldInstruction
    {
        internal float segundos;
        public WaitForSeconds(float seconds) { segundos = seconds; }
    }

    public sealed partial class WaitForEndOfFrame : YieldInstruction
    {
        public WaitForEndOfFrame() { }
    }

    public sealed partial class WaitForFixedUpdate : YieldInstruction
    {
        public WaitForFixedUpdate() { }
    }

    public abstract partial class CustomYieldInstruction : IEnumerator
    {
        public abstract bool keepWaiting { get; }
        public object Current => null;
        public bool MoveNext() => keepWaiting;
        public virtual void Reset() { }
    }

    public partial class WaitForSecondsRealtime : CustomYieldInstruction
    {
        public float waitTime { get; set; }
        float hasta = -1f;

        public WaitForSecondsRealtime(float time) { waitTime = time; }

        public override bool keepWaiting
        {
            get
            {
                if (hasta < 0f) hasta = Time.realtimeSinceStartup + waitTime;
                bool sigue = Time.realtimeSinceStartup < hasta;
                if (!sigue) hasta = -1f;
                return sigue;
            }
        }
    }

    public sealed partial class WaitUntil : CustomYieldInstruction
    {
        readonly Func<bool> p;
        public WaitUntil(Func<bool> predicate) { p = predicate; }
        public override bool keepWaiting => !p();
    }

    public sealed partial class WaitWhile : CustomYieldInstruction
    {
        readonly Func<bool> p;
        public WaitWhile(Func<bool> predicate) { p = predicate; }
        public override bool keepWaiting => p();
    }

    public partial class AsyncOperation : YieldInstruction
    {
        internal bool terminado;
        internal float avance;
        internal bool permitirActivacion = true;
        internal event Action<AsyncOperation> alTerminar;

        public bool isDone => terminado;
        public float progress => terminado ? 1f : avance;
        public bool allowSceneActivation { get => permitirActivacion; set => permitirActivacion = value; }
        public int priority { get; set; }

        public event Action<AsyncOperation> completed
        {
            add { if (terminado) value(this); else alTerminar += value; }
            remove { alTerminar -= value; }
        }

        internal void Terminar()
        {
            if (terminado) return;
            terminado = true; avance = 1f;
            alTerminar?.Invoke(this);
        }
    }
}

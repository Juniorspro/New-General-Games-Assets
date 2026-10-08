using System;
using System.Collections.Generic;
using System.Reflection;
using Object = UnityEngine.Object;

namespace UnityEngine.Events
{
    // Los UnityEvent como los de Unity: las llamadas "persistentes" (las del inspector, que vienen
    // serializadas con el objeto: destino, nombre del método y un argumento fijo opcional) se
    // resuelven por reflexión la primera vez que se invoca el evento; las de AddListener se suman
    // después. Mientras se invoca, la lista que se recorre es una copia.

    public enum PersistentListenerMode { EventDefined = 0, Void = 1, Object = 2, Int = 3, Float = 4, String = 5, Bool = 6 }

    public enum UnityEventCallState { Off = 0, EditorAndRuntime = 1, RuntimeOnly = 2 }

    [Serializable]
    internal class ArgumentCache : ISerializationCallbackReceiver
    {
        [SerializeField] Object m_ObjectArgument;
        [SerializeField] string m_ObjectArgumentAssemblyTypeName;
        [SerializeField] int m_IntArgument;
        [SerializeField] float m_FloatArgument;
        [SerializeField] string m_StringArgument;
        [SerializeField] bool m_BoolArgument;

        public Object unityObjectArgument => m_ObjectArgument;
        public string unityObjectArgumentAssemblyTypeName => m_ObjectArgumentAssemblyTypeName;
        public int intArgument => m_IntArgument;
        public float floatArgument => m_FloatArgument;
        public string stringArgument => m_StringArgument;
        public bool boolArgument => m_BoolArgument;

        public void OnBeforeSerialize() { }
        public void OnAfterDeserialize() { }
    }

    public abstract partial class BaseInvokableCall
    {
        protected BaseInvokableCall() { }

        protected BaseInvokableCall(object target, MethodInfo function)
        {
            if (function == null) throw new ArgumentNullException(nameof(function));
            if (!function.IsStatic && target == null) throw new ArgumentNullException(nameof(target));
        }

        protected static void ThrowOnInvalidArg<T>(object arg)
        {
            if (arg != null && !(arg is T))
                throw new ArgumentException($"Passed argument 'args[0]' is of the wrong type. Type:{arg.GetType()} Expected:{typeof(T)}");
        }

        // un destino de Unity destruido ya no recibe la llamada
        protected static bool AllowInvoke(Delegate @delegate)
        {
            object t = @delegate.Target;
            if (t == null) return true;
            if (t is Object o) return o != null;
            return true;
        }
    }

    class InvokableCall : BaseInvokableCall
    {
        event UnityAction Delegate;

        public InvokableCall(object target, MethodInfo theFunction) : base(target, theFunction)
        {
            Delegate += (UnityAction)System.Delegate.CreateDelegate(typeof(UnityAction), target, theFunction);
        }

        public InvokableCall(UnityAction action) { Delegate += action; }

        public override void Invoke(object[] args) { if (AllowInvoke(Delegate)) Delegate(); }
        public void Invoke() { if (AllowInvoke(Delegate)) Delegate(); }
        public override bool Find(object targetObj, MethodInfo method) => Delegate.Target == targetObj && Delegate.Method.Equals(method);
    }

    class InvokableCall<T1> : BaseInvokableCall
    {
        protected event UnityAction<T1> Delegate;

        public InvokableCall(object target, MethodInfo theFunction) : base(target, theFunction)
        {
            Delegate += (UnityAction<T1>)System.Delegate.CreateDelegate(typeof(UnityAction<T1>), target, theFunction);
        }

        public InvokableCall(UnityAction<T1> action) { Delegate += action; }

        public override void Invoke(object[] args)
        {
            if (args.Length != 1) throw new ArgumentException("Passed argument 'args' is invalid size. Expected size is 1");
            ThrowOnInvalidArg<T1>(args[0]);
            if (AllowInvoke(Delegate)) Delegate((T1)args[0]);
        }

        public virtual void Invoke(T1 args0) { if (AllowInvoke(Delegate)) Delegate(args0); }
        public override bool Find(object targetObj, MethodInfo method) => Delegate.Target == targetObj && Delegate.Method.Equals(method);
    }

    class InvokableCall<T1, T2> : BaseInvokableCall
    {
        protected event UnityAction<T1, T2> Delegate;

        public InvokableCall(object target, MethodInfo theFunction) : base(target, theFunction)
        {
            Delegate = (UnityAction<T1, T2>)System.Delegate.CreateDelegate(typeof(UnityAction<T1, T2>), target, theFunction);
        }

        public InvokableCall(UnityAction<T1, T2> action) { Delegate += action; }

        public override void Invoke(object[] args)
        {
            if (args.Length != 2) throw new ArgumentException("Passed argument 'args' is invalid size. Expected size is 2");
            ThrowOnInvalidArg<T1>(args[0]);
            ThrowOnInvalidArg<T2>(args[1]);
            if (AllowInvoke(Delegate)) Delegate((T1)args[0], (T2)args[1]);
        }

        public void Invoke(T1 args0, T2 args1) { if (AllowInvoke(Delegate)) Delegate(args0, args1); }
        public override bool Find(object targetObj, MethodInfo method) => Delegate.Target == targetObj && Delegate.Method.Equals(method);
    }

    class InvokableCall<T1, T2, T3> : BaseInvokableCall
    {
        protected event UnityAction<T1, T2, T3> Delegate;

        public InvokableCall(object target, MethodInfo theFunction) : base(target, theFunction)
        {
            Delegate = (UnityAction<T1, T2, T3>)System.Delegate.CreateDelegate(typeof(UnityAction<T1, T2, T3>), target, theFunction);
        }

        public InvokableCall(UnityAction<T1, T2, T3> action) { Delegate += action; }

        public override void Invoke(object[] args)
        {
            if (args.Length != 3) throw new ArgumentException("Passed argument 'args' is invalid size. Expected size is 3");
            ThrowOnInvalidArg<T1>(args[0]);
            ThrowOnInvalidArg<T2>(args[1]);
            ThrowOnInvalidArg<T3>(args[2]);
            if (AllowInvoke(Delegate)) Delegate((T1)args[0], (T2)args[1], (T3)args[2]);
        }

        public void Invoke(T1 args0, T2 args1, T3 args2) { if (AllowInvoke(Delegate)) Delegate(args0, args1, args2); }
        public override bool Find(object targetObj, MethodInfo method) => Delegate.Target == targetObj && Delegate.Method.Equals(method);
    }

    // una llamada persistente con su argumento fijo (el del inspector): ignora el del evento
    class CachedInvokableCall<T> : InvokableCall<T>
    {
        readonly T m_Arg1;

        public CachedInvokableCall(Object target, MethodInfo theFunction, T argument) : base(target, theFunction) { m_Arg1 = argument; }

        public override void Invoke(object[] args) => base.Invoke(m_Arg1);
        public override void Invoke(T arg0) => base.Invoke(m_Arg1);
    }

    [Serializable]
    internal class PersistentCall
    {
        [SerializeField] Object m_Target;
        [SerializeField] string m_MethodName;
        [SerializeField] PersistentListenerMode m_Mode = PersistentListenerMode.EventDefined;
        [SerializeField] ArgumentCache m_Arguments = new ArgumentCache();
        [SerializeField] UnityEventCallState m_CallState = UnityEventCallState.RuntimeOnly;

        public Object target => m_Target;
        public string methodName => m_MethodName;
        public PersistentListenerMode mode { get => m_Mode; set => m_Mode = value; }
        public ArgumentCache arguments => m_Arguments;
        public UnityEventCallState callState { get => m_CallState; set => m_CallState = value; }

        public bool IsValid() => target != null && !string.IsNullOrEmpty(methodName);

        public BaseInvokableCall GetRuntimeCall(UnityEventBase theEvent)
        {
            if (m_CallState == UnityEventCallState.Off || theEvent == null) return null;
            var method = theEvent.FindMethod(this);
            if (method == null) return null;
            switch (m_Mode)
            {
                case PersistentListenerMode.EventDefined: return theEvent.GetDelegate(target, method);
                case PersistentListenerMode.Object: return GetObjectCall(target, method, m_Arguments);
                case PersistentListenerMode.Float: return new CachedInvokableCall<float>(target, method, m_Arguments.floatArgument);
                case PersistentListenerMode.Int: return new CachedInvokableCall<int>(target, method, m_Arguments.intArgument);
                case PersistentListenerMode.String: return new CachedInvokableCall<string>(target, method, m_Arguments.stringArgument);
                case PersistentListenerMode.Bool: return new CachedInvokableCall<bool>(target, method, m_Arguments.boolArgument);
                case PersistentListenerMode.Void: return new InvokableCall(target, method);
            }
            return null;
        }

        // con un objeto de argumento: CachedInvokableCall del tipo que pide el inspector
        static BaseInvokableCall GetObjectCall(Object target, MethodInfo method, ArgumentCache arguments)
        {
            Type tipo = typeof(Object);
            if (!string.IsNullOrEmpty(arguments.unityObjectArgumentAssemblyTypeName))
                tipo = Type.GetType(arguments.unityObjectArgumentAssemblyTypeName, false) ?? Porteo.Tipos.Buscar(NombreDeTipo(arguments.unityObjectArgumentAssemblyTypeName)) ?? typeof(Object);
            var generico = typeof(CachedInvokableCall<>).MakeGenericType(tipo);
            var arg = arguments.unityObjectArgument;
            if (arg != null && !tipo.IsAssignableFrom(arg.GetType())) arg = null;
            return (BaseInvokableCall)Activator.CreateInstance(generico, target, method, arg);
        }

        // "UnityEngine.GameObject, UnityEngine" → "UnityEngine.GameObject"
        static string NombreDeTipo(string calificado)
        {
            int c = calificado.IndexOf(',');
            return c < 0 ? calificado : calificado.Substring(0, c).Trim();
        }

        public void RegisterPersistentListener(Object ttarget, string mmethodName) { m_Target = ttarget; m_MethodName = mmethodName; }
        public void UnregisterPersistentListener() { m_MethodName = string.Empty; m_Target = null; }
    }

    [Serializable]
    internal class PersistentCallGroup
    {
        [SerializeField] List<PersistentCall> m_Calls = new List<PersistentCall>();

        public int Count => m_Calls.Count;
        public PersistentCall GetListener(int index) => m_Calls[index];
        public IEnumerable<PersistentCall> GetListeners() => m_Calls;

        public void Initialize(InvokableCallList invokableList, UnityEventBase unityEventBase)
        {
            foreach (var persistentCall in m_Calls)
            {
                if (!persistentCall.IsValid()) continue;
                var call = persistentCall.GetRuntimeCall(unityEventBase);
                if (call != null) invokableList.AddPersistentInvokableCall(call);
            }
        }
    }

    internal class InvokableCallList
    {
        readonly List<BaseInvokableCall> m_PersistentCalls = new List<BaseInvokableCall>();
        readonly List<BaseInvokableCall> m_RuntimeCalls = new List<BaseInvokableCall>();
        readonly List<BaseInvokableCall> m_ExecutingCalls = new List<BaseInvokableCall>();
        bool m_NeedsUpdate = true;

        public int Count => m_PersistentCalls.Count + m_RuntimeCalls.Count;

        public void AddPersistentInvokableCall(BaseInvokableCall call) { m_PersistentCalls.Add(call); m_NeedsUpdate = true; }
        public void AddListener(BaseInvokableCall call) { m_RuntimeCalls.Add(call); m_NeedsUpdate = true; }

        public void RemoveListener(object targetObj, MethodInfo method)
        {
            var quitar = new List<BaseInvokableCall>();
            for (int i = 0; i < m_RuntimeCalls.Count; i++)
                if (m_RuntimeCalls[i].Find(targetObj, method)) quitar.Add(m_RuntimeCalls[i]);
            m_RuntimeCalls.RemoveAll(quitar.Contains);
            m_NeedsUpdate = true;
        }

        public void Clear() { m_RuntimeCalls.Clear(); m_NeedsUpdate = true; }
        public void ClearPersistent() { m_PersistentCalls.Clear(); m_NeedsUpdate = true; }

        public List<BaseInvokableCall> PrepareInvoke()
        {
            if (m_NeedsUpdate)
            {
                m_ExecutingCalls.Clear();
                m_ExecutingCalls.AddRange(m_PersistentCalls);
                m_ExecutingCalls.AddRange(m_RuntimeCalls);
                m_NeedsUpdate = false;
            }
            return m_ExecutingCalls;
        }
    }

    [Serializable]
    public abstract partial class UnityEventBase : ISerializationCallbackReceiver
    {
        InvokableCallList m_Calls;
        [SerializeField] PersistentCallGroup m_PersistentCalls;
        [SerializeField] string m_TypeName;
        bool m_CallsDirty = true;

        protected UnityEventBase()
        {
            m_Calls = new InvokableCallList();
            m_PersistentCalls = new PersistentCallGroup();
            m_TypeName = GetType().AssemblyQualifiedName;
        }

        void ISerializationCallbackReceiver.OnBeforeSerialize() => DirtyPersistentCalls();
        void ISerializationCallbackReceiver.OnAfterDeserialize()
        {
            DirtyPersistentCalls();
            m_TypeName = GetType().AssemblyQualifiedName;
        }

        protected abstract MethodInfo FindMethod_Impl(string name, object targetObj);
        public abstract BaseInvokableCall GetDelegate(object target, MethodInfo theFunction);

        internal MethodInfo FindMethod(PersistentCall call)
        {
            Type argumentType = typeof(Object);
            if (!string.IsNullOrEmpty(call.arguments.unityObjectArgumentAssemblyTypeName))
                argumentType = Type.GetType(call.arguments.unityObjectArgumentAssemblyTypeName, false) ?? typeof(Object);
            return FindMethod(call.methodName, call.target, call.mode, argumentType);
        }

        internal MethodInfo FindMethod(string name, object listener, PersistentListenerMode mode, Type argumentType)
        {
            switch (mode)
            {
                case PersistentListenerMode.EventDefined: return FindMethod_Impl(name, listener);
                case PersistentListenerMode.Void: return GetValidMethodInfo(listener, name, new Type[0]);
                case PersistentListenerMode.Float: return GetValidMethodInfo(listener, name, new[] { typeof(float) });
                case PersistentListenerMode.Int: return GetValidMethodInfo(listener, name, new[] { typeof(int) });
                case PersistentListenerMode.Bool: return GetValidMethodInfo(listener, name, new[] { typeof(bool) });
                case PersistentListenerMode.String: return GetValidMethodInfo(listener, name, new[] { typeof(string) });
                case PersistentListenerMode.Object: return GetValidMethodInfo(listener, name, new[] { argumentType ?? typeof(Object) });
                default: return null;
            }
        }

        public int GetPersistentEventCount() => m_PersistentCalls.Count;
        public Object GetPersistentTarget(int index) => m_PersistentCalls.GetListener(index)?.target;
        public string GetPersistentMethodName(int index) => m_PersistentCalls.GetListener(index)?.methodName ?? string.Empty;

        void DirtyPersistentCalls()
        {
            m_Calls.ClearPersistent();
            m_CallsDirty = true;
        }

        void RebuildPersistentCallsIfNeeded()
        {
            if (!m_CallsDirty) return;
            m_PersistentCalls.Initialize(m_Calls, this);
            m_CallsDirty = false;
        }

        public void SetPersistentListenerState(int index, UnityEventCallState state)
        {
            var listener = m_PersistentCalls.GetListener(index);
            if (listener != null) listener.callState = state;
            DirtyPersistentCalls();
        }

        protected void AddListener(object targetObj, MethodInfo method) => m_Calls.AddListener(GetDelegate(targetObj, method));
        internal void AddCall(BaseInvokableCall call) => m_Calls.AddListener(call);
        protected void RemoveListener(object targetObj, MethodInfo method) => m_Calls.RemoveListener(targetObj, method);
        public void RemoveAllListeners() => m_Calls.Clear();

        internal List<BaseInvokableCall> PrepareInvoke()
        {
            RebuildPersistentCallsIfNeeded();
            return m_Calls.PrepareInvoke();
        }

        protected void Invoke(object[] parameters)
        {
            var calls = PrepareInvoke();
            for (int i = 0; i < calls.Count; i++) calls[i].Invoke(parameters);
        }

        public override string ToString() => base.ToString() + " " + GetType().FullName;

        // el método de ese nombre con esos parámetros, subiendo por la herencia (como Unity: los
        // parámetros tienen que coincidir también en si son primitivos)
        public static MethodInfo GetValidMethodInfo(object obj, string functionName, Type[] argumentTypes)
        {
            if (obj == null || string.IsNullOrEmpty(functionName)) return null;
            for (var type = obj.GetType(); type != typeof(object) && type != null; type = type.BaseType)
            {
                var method = type.GetMethod(functionName, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static, null, argumentTypes, null);
                if (method == null) continue;
                var ps = method.GetParameters();
                bool valido = true;
                for (int i = 0; i < ps.Length && i < argumentTypes.Length; i++)
                    if (argumentTypes[i].IsPrimitive != ps[i].ParameterType.IsPrimitive) { valido = false; break; }
                if (valido) return method;
            }
            return null;
        }
    }

    [Serializable]
    public partial class UnityEvent : UnityEventBase
    {
        object[] m_InvokeArray;

        public UnityEvent() { }

        public void AddListener(UnityAction call) => AddCall(GetDelegate(call));
        public void RemoveListener(UnityAction call) => RemoveListener(call.Target, call.Method);

        protected override MethodInfo FindMethod_Impl(string name, object targetObj) => GetValidMethodInfo(targetObj, name, new Type[0]);
        public override BaseInvokableCall GetDelegate(object target, MethodInfo theFunction) => new InvokableCall(target, theFunction);
        static BaseInvokableCall GetDelegate(UnityAction action) => new InvokableCall(action);

        public void Invoke()
        {
            var calls = PrepareInvoke();
            for (int i = 0; i < calls.Count; i++)
            {
                if (calls[i] is InvokableCall c) c.Invoke();
                else
                {
                    m_InvokeArray ??= new object[0];
                    calls[i].Invoke(m_InvokeArray);
                }
            }
        }
    }

    [Serializable]
    public abstract partial class UnityEvent<T0> : UnityEventBase
    {
        object[] m_InvokeArray;

        public UnityEvent() { }

        public void AddListener(UnityAction<T0> call) => AddCall(GetDelegate(call));
        public void RemoveListener(UnityAction<T0> call) => RemoveListener(call.Target, call.Method);

        protected override MethodInfo FindMethod_Impl(string name, object targetObj) => GetValidMethodInfo(targetObj, name, new[] { typeof(T0) });
        public override BaseInvokableCall GetDelegate(object target, MethodInfo theFunction) => new InvokableCall<T0>(target, theFunction);
        static BaseInvokableCall GetDelegate(UnityAction<T0> action) => new InvokableCall<T0>(action);

        public void Invoke(T0 arg0)
        {
            var calls = PrepareInvoke();
            for (int i = 0; i < calls.Count; i++)
            {
                if (calls[i] is InvokableCall<T0> c) c.Invoke(arg0);
                else if (calls[i] is InvokableCall c0) c0.Invoke();
                else
                {
                    m_InvokeArray ??= new object[1];
                    m_InvokeArray[0] = arg0;
                    calls[i].Invoke(m_InvokeArray);
                }
            }
        }
    }

    [Serializable]
    public abstract partial class UnityEvent<T0, T1> : UnityEventBase
    {
        object[] m_InvokeArray;

        public UnityEvent() { }

        public void AddListener(UnityAction<T0, T1> call) => AddCall(GetDelegate(call));
        public void RemoveListener(UnityAction<T0, T1> call) => RemoveListener(call.Target, call.Method);

        protected override MethodInfo FindMethod_Impl(string name, object targetObj) => GetValidMethodInfo(targetObj, name, new[] { typeof(T0), typeof(T1) });
        public override BaseInvokableCall GetDelegate(object target, MethodInfo theFunction) => new InvokableCall<T0, T1>(target, theFunction);
        static BaseInvokableCall GetDelegate(UnityAction<T0, T1> action) => new InvokableCall<T0, T1>(action);

        public void Invoke(T0 arg0, T1 arg1)
        {
            var calls = PrepareInvoke();
            for (int i = 0; i < calls.Count; i++)
            {
                if (calls[i] is InvokableCall<T0, T1> c) c.Invoke(arg0, arg1);
                else if (calls[i] is InvokableCall c0) c0.Invoke();
                else
                {
                    m_InvokeArray ??= new object[2];
                    m_InvokeArray[0] = arg0; m_InvokeArray[1] = arg1;
                    calls[i].Invoke(m_InvokeArray);
                }
            }
        }
    }

    [Serializable]
    public abstract partial class UnityEvent<T0, T1, T2> : UnityEventBase
    {
        object[] m_InvokeArray;

        public UnityEvent() { }

        public void AddListener(UnityAction<T0, T1, T2> call) => AddCall(GetDelegate(call));
        public void RemoveListener(UnityAction<T0, T1, T2> call) => RemoveListener(call.Target, call.Method);

        protected override MethodInfo FindMethod_Impl(string name, object targetObj) => GetValidMethodInfo(targetObj, name, new[] { typeof(T0), typeof(T1), typeof(T2) });
        public override BaseInvokableCall GetDelegate(object target, MethodInfo theFunction) => new InvokableCall<T0, T1, T2>(target, theFunction);
        static BaseInvokableCall GetDelegate(UnityAction<T0, T1, T2> action) => new InvokableCall<T0, T1, T2>(action);

        public void Invoke(T0 arg0, T1 arg1, T2 arg2)
        {
            var calls = PrepareInvoke();
            for (int i = 0; i < calls.Count; i++)
            {
                if (calls[i] is InvokableCall<T0, T1, T2> c) c.Invoke(arg0, arg1, arg2);
                else if (calls[i] is InvokableCall c0) c0.Invoke();
                else
                {
                    m_InvokeArray ??= new object[3];
                    m_InvokeArray[0] = arg0; m_InvokeArray[1] = arg1; m_InvokeArray[2] = arg2;
                    calls[i].Invoke(m_InvokeArray);
                }
            }
        }
    }

    public delegate void UnityAction<T0, T1, T2>(T0 arg0, T1 arg1, T2 arg2);
}

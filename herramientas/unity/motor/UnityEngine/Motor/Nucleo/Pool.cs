using System;
using System.Collections.Generic;

// Los pools genéricos de Unity 2021+ (UnityEngine.Pool): la UI de Unity 2022 los usa en cada
// reconstrucción (ListPool<Component>.Get() en LayoutRebuilder, Graphic, Mask...). Con lo mismo que
// el de Unity: una pila de libres, las acciones al pedir y devolver, y el aviso si se devuelve
// dos veces lo mismo.
namespace UnityEngine.Pool
{
    public interface IObjectPool<T> where T : class
    {
        int CountInactive { get; }
        T Get();
        PooledObject<T> Get(out T v);
        void Release(T element);
        void Clear();
    }

    // lo que devuelve Get(out v): al salir del using vuelve al pool
    public struct PooledObject<T> : IDisposable where T : class
    {
        readonly T m_ToReturn;
        readonly IObjectPool<T> m_Pool;

        internal PooledObject(T value, IObjectPool<T> pool) { m_ToReturn = value; m_Pool = pool; }

        void IDisposable.Dispose() => m_Pool.Release(m_ToReturn);
    }

    public class ObjectPool<T> : IDisposable, IObjectPool<T> where T : class
    {
        internal readonly List<T> m_List;
        readonly Func<T> m_CreateFunc;
        readonly Action<T> m_ActionOnGet, m_ActionOnRelease, m_ActionOnDestroy;
        readonly int m_MaxSize;
        internal bool m_CollectionCheck;

        public int CountAll { get; private set; }
        public int CountActive => CountAll - CountInactive;
        public int CountInactive => m_List.Count;

        public ObjectPool(Func<T> createFunc, Action<T> actionOnGet = null, Action<T> actionOnRelease = null, Action<T> actionOnDestroy = null,
            bool collectionCheck = true, int defaultCapacity = 10, int maxSize = 10000)
        {
            if (createFunc == null) throw new ArgumentNullException(nameof(createFunc));
            if (maxSize <= 0) throw new ArgumentException("Max Size must be greater than 0", nameof(maxSize));
            m_List = new List<T>(defaultCapacity);
            m_CreateFunc = createFunc;
            m_MaxSize = maxSize;
            m_ActionOnGet = actionOnGet;
            m_ActionOnRelease = actionOnRelease;
            m_ActionOnDestroy = actionOnDestroy;
            m_CollectionCheck = collectionCheck;
        }

        public T Get()
        {
            T v;
            if (m_List.Count == 0)
            {
                v = m_CreateFunc();
                CountAll++;
            }
            else
            {
                int i = m_List.Count - 1;
                v = m_List[i];
                m_List.RemoveAt(i);
            }
            m_ActionOnGet?.Invoke(v);
            return v;
        }

        public PooledObject<T> Get(out T v) => new PooledObject<T>(v = Get(), this);

        public void Release(T element)
        {
            if (m_CollectionCheck && m_List.Count > 0)
                for (int i = 0; i < m_List.Count; i++)
                    if (ReferenceEquals(element, m_List[i]))
                        throw new InvalidOperationException("Trying to release an object that has already been released to the pool.");
            m_ActionOnRelease?.Invoke(element);
            if (CountInactive < m_MaxSize) m_List.Add(element);
            else m_ActionOnDestroy?.Invoke(element);
        }

        public void Clear()
        {
            if (m_ActionOnDestroy != null) foreach (var x in m_List) m_ActionOnDestroy(x);
            m_List.Clear();
            CountAll = 0;
        }

        public void Dispose() => Clear();
    }

    public class CollectionPool<TCollection, TItem> where TCollection : class, ICollection<TItem>, new()
    {
        internal static readonly ObjectPool<TCollection> s_Pool = new ObjectPool<TCollection>(() => new TCollection(), null, l => l.Clear());

        public static TCollection Get() => s_Pool.Get();
        public static PooledObject<TCollection> Get(out TCollection value) => s_Pool.Get(out value);
        public static void Release(TCollection toRelease) => s_Pool.Release(toRelease);
    }

    public class ListPool<T> : CollectionPool<List<T>, T> { }
    public class HashSetPool<T> : CollectionPool<HashSet<T>, T> { }
    public class DictionaryPool<TKey, TValue> : CollectionPool<Dictionary<TKey, TValue>, KeyValuePair<TKey, TValue>> { }

    public class GenericPool<T> where T : class, new()
    {
        internal static readonly ObjectPool<T> s_Pool = new ObjectPool<T>(() => new T());

        public static T Get() => s_Pool.Get();
        public static PooledObject<T> Get(out T value) => s_Pool.Get(out value);
        public static void Release(T toRelease) => s_Pool.Release(toRelease);
    }

    public static class UnsafeGenericPool<T> where T : class, new()
    {
        internal static readonly ObjectPool<T> s_Pool = new ObjectPool<T>(() => new T(), null, null, null, false);

        public static T Get() => s_Pool.Get();
        public static PooledObject<T> Get(out T value) => s_Pool.Get(out value);
        public static void Release(T toRelease) => s_Pool.Release(toRelease);
    }
}

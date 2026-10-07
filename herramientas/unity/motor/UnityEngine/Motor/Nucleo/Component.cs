using System;
using System.Collections.Generic;
using Porteo;

namespace UnityEngine
{
    public partial class Component : Object
    {
        internal GameObject go;

        internal override string NombreObjeto() => go != null ? go.m_Name : m_Name;
        internal override void CambiarNombre(string v) { if (go != null) go.m_Name = v ?? ""; else m_Name = v ?? ""; }

        public Transform transform => go?.trans;
        public GameObject gameObject => go;

        public string tag { get => go.tag; set => go.tag = value; }
        public bool CompareTag(string tag) => go.etiqueta == tag;

        public Component GetComponent(Type type) => go.GetComponent(type);
        public T GetComponent<T>() => go.GetComponent<T>();
        public Component GetComponent(string type) => go.GetComponent(type);
        public Component GetComponentInChildren(Type t) => go.GetComponentInChildren(t);
        public Component GetComponentInChildren(Type t, bool includeInactive) => go.GetComponentInChildren(t, includeInactive);
        public T GetComponentInChildren<T>(bool includeInactive) => go.GetComponentInChildren<T>(includeInactive);
        public T GetComponentInChildren<T>() => go.GetComponentInChildren<T>(false);
        public T[] GetComponentsInChildren<T>(bool includeInactive) => go.GetComponentsInChildren<T>(includeInactive);
        public T[] GetComponentsInChildren<T>() => go.GetComponentsInChildren<T>(false);
        public void GetComponentsInChildren<T>(List<T> results) => go.GetComponentsInChildren(false, results);
        public void GetComponentsInChildren<T>(bool includeInactive, List<T> result) => go.GetComponentsInChildren(includeInactive, result);
        public Component[] GetComponentsInChildren(Type t, bool includeInactive) => go.GetComponentsInChildren(t, includeInactive);
        public T GetComponentInParent<T>() => go.GetComponentInParent<T>();
        public Component GetComponentInParent(Type t) => go.GetComponentInParent(t);
        public T[] GetComponentsInParent<T>(bool includeInactive) => go.GetComponentsInParent<T>(includeInactive);
        public void GetComponentsInParent<T>(bool includeInactive, List<T> results) => go.GetComponentsInParent(includeInactive, results);
        public T[] GetComponentsInParent<T>() => go.GetComponentsInParent<T>(false);
        public Component[] GetComponents(Type type) => go.GetComponents(type);
        public void GetComponents(Type type, List<Component> results) => go.GetComponents(type, results);
        public void GetComponents<T>(List<T> results) => go.GetComponents(results);
        public T[] GetComponents<T>() => go.GetComponents<T>();

        public void SendMessage(string methodName) => go.SendMessage(methodName);
        public void SendMessage(string methodName, object value) => go.SendMessage(methodName, value);
        public void SendMessage(string methodName, object value, SendMessageOptions options) => go.SendMessage(methodName, value, options);
        public void SendMessage(string methodName, SendMessageOptions options) => go.SendMessage(methodName, options);
        public void SendMessageUpwards(string methodName, SendMessageOptions options) => go.SendMessageUpwards(methodName, options);
        public void BroadcastMessage(string methodName) => go.BroadcastMessage(methodName);
        public void BroadcastMessage(string methodName, object parameter, SendMessageOptions options) => go.BroadcastMessage(methodName, parameter, options);
        public void BroadcastMessage(string methodName, SendMessageOptions options) => go.BroadcastMessage(methodName, options);

        // ── lo que el motor le avisa a cada componente (los nativos lo usan) ──
        internal virtual void AlActivarse() { }      // pasó a estar activo y habilitado
        internal virtual void AlDesactivarse() { }   // dejó de estarlo
        internal virtual void AlDestruirse() { }
        internal virtual void AlCambiarTransform() { }
        // el enabled propio de los nativos que lo tienen (Behaviour, Renderer, Collider...)
        internal virtual bool HabilitadoNativo => true;
    }

    public partial class Behaviour : Component
    {
        internal bool habilitado = true;

        internal override bool HabilitadoNativo => habilitado;

        internal override void CopiarDe(Object original, Func<Object, Object> remap)
        {
            base.CopiarDe(original, remap);
            habilitado = ((Behaviour)original).habilitado;
        }

        public bool enabled
        {
            get => habilitado;
            set
            {
                if (habilitado == value) return;
                habilitado = value;
                Activacion.HabilitacionCambiada(this);
            }
        }

        public bool isActiveAndEnabled => habilitado && go != null && go.activoEnJerarquia;
    }
}

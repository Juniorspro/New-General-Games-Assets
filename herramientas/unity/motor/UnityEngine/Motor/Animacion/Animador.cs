using System;
using System.Collections.Generic;
using Porteo;
using Porteo.Animacion;
using Porteo.Datos;
using UnityEngine;
using Object = UnityEngine.Object;

namespace UnityEngine
{
    public enum AnimatorCullingMode { AlwaysAnimate = 0, CullUpdateTransforms = 1, CullCompletely = 2 }
    public enum AnimatorUpdateMode { Normal = 0, AnimatePhysics = 1, UnscaledTime = 2 }
    public enum AnimatorControllerParameterType { Float = 1, Int = 3, Bool = 4, Trigger = 9 }

    public partial class Animator : Behaviour
    {
        internal Avatar avatarDatos;
        internal RuntimeAnimatorController ctrl;
        internal AnimatorCullingMode culling;
        internal AnimatorUpdateMode actualizacion;
        internal bool raiz, mantenerEstado, aplicarRaizCambiado;
        internal Reproductor rep;
        bool fallo;
        float velocidad = 1;
        readonly float[] pesosCapa = new float[16];
        List<Renderer> renderers;

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            avatarDatos = r.Resolver(m.P("m_Avatar")) as Avatar;
            ctrl = r.Resolver(m.P("m_Controller")) as RuntimeAnimatorController;
            culling = (AnimatorCullingMode)m.I32("m_CullingMode");
            actualizacion = (AnimatorUpdateMode)m.I32("m_UpdateMode");
            raiz = m.B("m_ApplyRootMotion");
            mantenerEstado = m.B("m_KeepAnimatorControllerStateOnDisable");
        }

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            base.CopiarDe(o, remap);
            var a = (Animator)o;
            avatarDatos = a.avatarDatos; ctrl = a.ctrl; culling = a.culling; actualizacion = a.actualizacion;
            raiz = a.raiz; mantenerEstado = a.mantenerEstado; velocidad = a.velocidad;
        }

        internal override void AlActivarse() => Animadores.Alta(this);

        internal override void AlDesactivarse()
        {
            Animadores.Baja(this);
            if (rep != null && !mantenerEstado) { Mensajes.Accion(rep.Restaurar, this); rep = null; }
        }

        internal override void AlDestruirse() { Animadores.Baja(this); rep = null; }

        // el reproductor se arma la primera vez que hace falta (al actualizarse o si un script lo usa)
        internal Reproductor Rep()
        {
            if (rep != null) return rep;
            if (fallo || destruido || go == null || !go.activoEnJerarquia || !habilitado) return null;
            if (ctrl == null || ctrl.Base == null) return null;
            try { rep = new Reproductor(this, ctrl); }
            catch (Exception e) { fallo = true; Debug.LogException(e, this); }
            return rep;
        }

        internal bool Visible()
        {
            if (culling == AnimatorCullingMode.AlwaysAnimate || !Porteo.Render.Gpu.Activo) return true;
            renderers ??= new List<Renderer>(GetComponentsInChildren<Renderer>(true));
            foreach (var r in renderers) if (r != null && !r.destruido && r.isVisible) return true;
            return false;
        }

        // un cuadro del animador (Animadores lo llama antes de LateUpdate)
        internal void Paso(float dt)
        {
            var r = Rep();
            if (r == null) return;
            bool visible = Visible();
            if (!visible && culling == AnimatorCullingMode.CullCompletely) return;
            for (int l = 0; l < r.capas.Length && l < pesosCapa.Length; l++) if (l > 0 && pesosCapa[l] >= 0) r.capas[l].peso = pesosCapa[l] - 1;
            r.Paso(dt * velocidad, fireEvents);
            if (visible || culling == AnimatorCullingMode.AlwaysAnimate) r.Evaluar();
        }

        // ── API de Unity ──
        public RuntimeAnimatorController runtimeAnimatorController
        {
            get => ctrl;
            set
            {
                if (ctrl == value) return;
                if (rep != null) { Mensajes.Accion(rep.Restaurar, this); rep = null; }
                ctrl = value; fallo = false;
            }
        }

        public Avatar avatar { get => avatarDatos; set { avatarDatos = value; Rebind(); } }
        public bool isInitialized => Rep() != null;
        public bool hasBoundPlayables => false;
        public bool isHuman => false;
        public float humanScale => 1;
        public bool applyRootMotion { get => raiz; set => raiz = value; }
        public AnimatorCullingMode cullingMode { get => culling; set => culling = value; }
        public AnimatorUpdateMode updateMode { get => actualizacion; set => actualizacion = value; }
        public bool keepAnimatorControllerStateOnDisable { get => mantenerEstado; set => mantenerEstado = value; }
        public float speed { get => velocidad; set => velocidad = value; }
        public bool fireEvents { get; set; } = true;
        public bool logWarnings { get; set; } = true;
        public bool stabilizeFeet { get; set; }
        public float feetPivotActive { get; set; }
        public Vector3 deltaPosition => Vector3.zero;
        public Quaternion deltaRotation => Quaternion.identity;
        public Vector3 velocity => Vector3.zero;
        public Vector3 angularVelocity => Vector3.zero;
        public Vector3 rootPosition { get => transform.position; set => transform.position = value; }
        public Quaternion rootRotation { get => transform.rotation; set => transform.rotation = value; }
        public Vector3 bodyPosition { get => transform.position; set { } }
        public Quaternion bodyRotation { get => transform.rotation; set { } }
        public int layerCount => ctrl?.Base?.Capas.Length ?? 0;
        public int parameterCount => ctrl?.Base?.Parametros.Length ?? 0;
        public float playbackTime { get; set; }

        public AnimatorControllerParameter[] parameters
        {
            get
            {
                var ps = ctrl?.Base?.Parametros;
                if (ps == null) return Array.Empty<AnimatorControllerParameter>();
                var r = new AnimatorControllerParameter[ps.Length];
                for (int i = 0; i < ps.Length; i++)
                    r[i] = new AnimatorControllerParameter
                    {
                        m_Name = ps[i].Nombre, m_Type = (AnimatorControllerParameterType)ps[i].Tipo,
                        m_DefaultFloat = ps[i].Flotante, m_DefaultInt = ps[i].Entero, m_DefaultBool = ps[i].Booleano,
                    };
                return r;
            }
        }

        public AnimatorControllerParameter GetParameter(int index)
        {
            var ps = parameters;
            if (index < 0 || index >= ps.Length) throw new IndexOutOfRangeException("Index must be between 0 and " + ps.Length);
            return ps[index];
        }

        static int H(string s) => StringToHash(s);

        public float GetFloat(string name) => Rep()?.GetFloat(H(name)) ?? 0;
        public float GetFloat(int id) => Rep()?.GetFloat(id) ?? 0;
        public void SetFloat(string name, float value) => Rep()?.SetFloat(H(name), value);
        public void SetFloat(int id, float value) => Rep()?.SetFloat(id, value);

        // con amortiguación: se acerca al valor como el SmoothDamp de Unity
        public void SetFloat(string name, float value, float dampTime, float deltaTime) => SetFloat(H(name), value, dampTime, deltaTime);

        public void SetFloat(int id, float value, float dampTime, float deltaTime)
        {
            var r = Rep();
            if (r == null) return;
            if (dampTime <= 0) { r.SetFloat(id, value); return; }
            float actual = r.GetFloat(id);
            amortiguado.TryGetValue(id, out float vel);
            float nuevo = Mathf.SmoothDamp(actual, value, ref vel, dampTime, float.PositiveInfinity, deltaTime);
            amortiguado[id] = vel;
            r.SetFloat(id, nuevo);
        }
        readonly Dictionary<int, float> amortiguado = new Dictionary<int, float>();

        public bool GetBool(string name) => Rep()?.GetBool(H(name)) ?? false;
        public bool GetBool(int id) => Rep()?.GetBool(id) ?? false;
        public void SetBool(string name, bool value) => Rep()?.SetBool(H(name), value);
        public void SetBool(int id, bool value) => Rep()?.SetBool(id, value);
        public int GetInteger(string name) => Rep()?.GetInteger(H(name)) ?? 0;
        public int GetInteger(int id) => Rep()?.GetInteger(id) ?? 0;
        public void SetInteger(string name, int value) => Rep()?.SetInteger(H(name), value);
        public void SetInteger(int id, int value) => Rep()?.SetInteger(id, value);
        public void SetTrigger(string name) => Rep()?.SetTrigger(H(name), true);
        public void SetTrigger(int id) => Rep()?.SetTrigger(id, true);
        public void ResetTrigger(string name) => Rep()?.SetTrigger(H(name), false);
        public void ResetTrigger(int id) => Rep()?.SetTrigger(id, false);
        public bool IsParameterControlledByCurve(string name) => false;
        public bool IsParameterControlledByCurve(int id) => false;

        public AnimatorStateInfo GetCurrentAnimatorStateInfo(int layerIndex) => Rep()?.Actual(layerIndex) ?? default;
        public AnimatorStateInfo GetNextAnimatorStateInfo(int layerIndex) => Rep()?.Siguiente(layerIndex) ?? default;
        public bool IsInTransition(int layerIndex) => Rep()?.EnTransicion(layerIndex) ?? false;

        public AnimatorClipInfo[] GetCurrentAnimatorClipInfo(int layerIndex)
        {
            var r = Rep();
            var c = r?.ClipActual(layerIndex);
            return c == null ? Array.Empty<AnimatorClipInfo>() : new[] { new AnimatorClipInfo { clipInterno = c, pesoInterno = 1 } };
        }

        public void Play(string stateName, int layer = -1, float normalizedTime = float.NegativeInfinity) => Play(H(stateName), layer, normalizedTime);
        public void Play(int stateNameHash, int layer = -1, float normalizedTime = float.NegativeInfinity) => Rep()?.Tocar(stateNameHash, layer, normalizedTime);
        public void PlayInFixedTime(string stateName, int layer = -1, float fixedTime = float.NegativeInfinity) => Play(H(stateName), layer, fixedTime);
        public void PlayInFixedTime(int stateNameHash, int layer = -1, float fixedTime = float.NegativeInfinity) => Rep()?.Tocar(stateNameHash, layer, fixedTime, true);

        public void CrossFade(string stateName, float normalizedTransitionDuration, int layer = -1, float normalizedTimeOffset = float.NegativeInfinity) =>
            CrossFade(H(stateName), normalizedTransitionDuration, layer, normalizedTimeOffset);
        public void CrossFade(int stateHashName, float normalizedTransitionDuration, int layer = -1, float normalizedTimeOffset = float.NegativeInfinity) =>
            Rep()?.Fundir(stateHashName, normalizedTransitionDuration, layer, normalizedTimeOffset, false);
        public void CrossFadeInFixedTime(string stateName, float fixedTransitionDuration, int layer = -1, float fixedTimeOffset = 0f) =>
            CrossFadeInFixedTime(H(stateName), fixedTransitionDuration, layer, fixedTimeOffset);
        public void CrossFadeInFixedTime(int stateHashName, float fixedTransitionDuration, int layer = -1, float fixedTimeOffset = 0f) =>
            Rep()?.Fundir(stateHashName, fixedTransitionDuration, layer, fixedTimeOffset, true);

        public bool HasState(int layerIndex, int stateID) => Rep()?.Tiene(layerIndex, stateID) ?? false;

        public float GetLayerWeight(int layerIndex)
        {
            var r = Rep();
            if (r == null || layerIndex < 0 || layerIndex >= r.capas.Length) return 0;
            return layerIndex == 0 ? 1 : r.capas[layerIndex].peso;
        }

        public void SetLayerWeight(int layerIndex, float weight)
        {
            if (layerIndex <= 0 || layerIndex >= pesosCapa.Length) return;
            pesosCapa[layerIndex] = Mathf.Clamp01(weight) + 1;   // 0 = no tocado
            var r = Rep();
            if (r != null && layerIndex < r.capas.Length) r.capas[layerIndex].peso = Mathf.Clamp01(weight);
        }

        public string GetLayerName(int layerIndex)
        {
            var c = ctrl?.Base;
            if (c == null || layerIndex < 0 || layerIndex >= c.Capas.Length) return null;
            return c.Texto(c.Capas[layerIndex].Hash);
        }

        public int GetLayerIndex(string layerName)
        {
            var c = ctrl?.Base;
            if (c == null) return -1;
            for (int i = 0; i < c.Capas.Length; i++) if (c.Texto(c.Capas[i].Hash) == layerName) return i;
            return -1;
        }

        public void Rebind()
        {
            if (rep != null) { Mensajes.Accion(rep.Restaurar, this); rep = null; }
            fallo = false;
            renderers = null;
        }

        public void Update(float deltaTime)
        {
            var r = Rep();
            if (r == null) return;
            r.Paso(deltaTime * velocidad, fireEvents);
            r.Evaluar();
        }

        public void WriteDefaultValues() => rep?.Restaurar();
        public void ApplyBuiltinRootMotion() { }
        public void StartPlayback() { }
        public void StopPlayback() { }
        public void StartRecording(int frameCount) { }
        public void StopRecording() { }
        public void SetLookAtPosition(Vector3 lookAtPosition) { }
        public void SetLookAtWeight(float weight) { }
    }

    public partial class AnimatorControllerParameter
    {
        internal string m_Name = "";
        internal AnimatorControllerParameterType m_Type;
        internal float m_DefaultFloat;
        internal int m_DefaultInt;
        internal bool m_DefaultBool;

        public string name { get => m_Name; set => m_Name = value; }
        public int nameHash => Animator.StringToHash(m_Name);
        public AnimatorControllerParameterType type { get => m_Type; set => m_Type = value; }
        public float defaultFloat { get => m_DefaultFloat; set => m_DefaultFloat = value; }
        public int defaultInt { get => m_DefaultInt; set => m_DefaultInt = value; }
        public bool defaultBool { get => m_DefaultBool; set => m_DefaultBool = value; }
    }

    public partial struct AnimatorStateInfo
    {
        public bool IsName(string name) { int h = Animator.StringToHash(name); return h == m_FullPath || h == m_Name || h == m_Path; }
        public int fullPathHash => m_FullPath;
        public int nameHash => m_Path;
        public int shortNameHash => m_Name;
        public float normalizedTime => m_NormalizedTime;
        public float length => m_Length;
        public float speed => m_Speed;
        public float speedMultiplier => m_SpeedMultiplier;
        public int tagHash => m_Tag;
        public bool IsTag(string tag) => Animator.StringToHash(tag) == m_Tag;
        public bool loop => m_Loop != 0;
    }

    // Los scripts de los estados: Unity llama estos métodos; el juego sobreescribe los que usa.
    public abstract partial class StateMachineBehaviour : ScriptableObject
    {
        public virtual void OnStateEnter(Animator animator, AnimatorStateInfo stateInfo, int layerIndex) { }
        public virtual void OnStateUpdate(Animator animator, AnimatorStateInfo stateInfo, int layerIndex) { }
        public virtual void OnStateExit(Animator animator, AnimatorStateInfo stateInfo, int layerIndex) { }
        public virtual void OnStateMove(Animator animator, AnimatorStateInfo stateInfo, int layerIndex) { }
        public virtual void OnStateIK(Animator animator, AnimatorStateInfo stateInfo, int layerIndex) { }
        public virtual void OnStateMachineEnter(Animator animator, int stateMachinePathHash) { }
        public virtual void OnStateMachineExit(Animator animator, int stateMachinePathHash) { }
    }
}

namespace Porteo.Animacion
{
    // Los animadores activos y su cuadro: los normales antes de LateUpdate, los de física antes
    // de cada FixedUpdate (como el PlayerLoop de Unity).
    public static class Animadores
    {
        static readonly List<Animator> animadores = new List<Animator>();
        static readonly List<Animation> legados = new List<Animation>();
        static Animator[] copia = Array.Empty<Animator>();
        static Animation[] copiaL = Array.Empty<Animation>();
        static bool cambio = true, cambioL = true;

        public static void Iniciar()
        {
            Mundo.AntesDeLateUpdate += Normal;
            Mundo.AntesDeFixedUpdate += Fisica;
        }

        internal static void Alta(Animator a) { if (!animadores.Contains(a)) { animadores.Add(a); cambio = true; } }
        internal static void Baja(Animator a) { if (animadores.Remove(a)) cambio = true; }
        internal static void Alta(Animation a) { if (!legados.Contains(a)) { legados.Add(a); cambioL = true; } }
        internal static void Baja(Animation a) { if (legados.Remove(a)) cambioL = true; }

        static void Normal()
        {
            if (cambio) { copia = animadores.ToArray(); cambio = false; }
            foreach (var a in copia)
            {
                if (a.destruido || !a.isActiveAndEnabled || a.actualizacion == AnimatorUpdateMode.AnimatePhysics) continue;
                float dt = a.actualizacion == AnimatorUpdateMode.UnscaledTime ? Time.unscaledDeltaTime : Time.deltaTime;
                Mensajes.Accion(() => a.Paso(dt), a);
            }
            if (cambioL) { copiaL = legados.ToArray(); cambioL = false; }
            foreach (var l in copiaL)
            {
                if (l.destruido || !l.isActiveAndEnabled || l.fisica) continue;
                Mensajes.Accion(() => l.Paso(Time.deltaTime), l);
            }
        }

        static void Fisica()
        {
            if (cambio) { copia = animadores.ToArray(); cambio = false; }
            foreach (var a in copia)
            {
                if (a.destruido || !a.isActiveAndEnabled || a.actualizacion != AnimatorUpdateMode.AnimatePhysics) continue;
                Mensajes.Accion(() => a.Paso(Time.fixedDeltaTime), a);
            }
            if (cambioL) { copiaL = legados.ToArray(); cambioL = false; }
            foreach (var l in copiaL)
            {
                if (l.destruido || !l.isActiveAndEnabled || !l.fisica) continue;
                Mensajes.Accion(() => l.Paso(Time.fixedDeltaTime), l);
            }
        }
    }
}

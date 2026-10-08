using System;
using System.Collections;
using System.Collections.Generic;
using Porteo;

namespace UnityEngine
{
    // La posición en el mundo se calcula al pedirla y queda guardada hasta que algo de la
    // cadena de padres cambia (se marca sucio todo el subárbol, como hace Unity).
    public partial class Transform : Component, IEnumerable
    {
        internal Vector3 posLocal;
        internal Quaternion rotLocal = Quaternion.identity;
        internal Vector3 escLocal = Vector3.one;
        internal Transform padre;
        internal readonly List<Transform> hijos = new List<Transform>();

        Matrix4x4 mundo;          // local → mundo
        Quaternion rotMundo;
        bool sucio = true;
        internal bool cambio = true;   // hasChanged
        // cuántas veces cambió (lo usan los renderers y la física para saber si moverse)
        internal int version;

        internal void Ensuciar()
        {
            if (sucio && !cambio) { cambio = true; }
            sucio = true;
            cambio = true;
            version++;
            for (int i = 0; i < hijos.Count; i++) hijos[i].Ensuciar();
            AlCambiar();
        }

        // ── datos ──
        internal override void LeerNativo(Porteo.Datos.Mapa m, Porteo.Datos.IResolutor r)
        {
            posLocal = Porteo.Datos.Serial.V3(m.M("m_LocalPosition"));
            rotLocal = Porteo.Datos.Serial.Q(m.M("m_LocalRotation"));
            escLocal = Porteo.Datos.Serial.V3(m.M("m_LocalScale"));
            padre = r.Resolver(m.P("m_Father")) as Transform;
            var hs = m.L("m_Children");
            if (hs != null)
                foreach (var x in hs)
                    if (x is Porteo.Datos.PPtr p && r.Resolver(p) is Transform h && !hijos.Contains(h)) hijos.Add(h);
            sucio = true;
        }

        // el padre y los hijos los arma el clonador
        internal override void CopiarDe(Object original, Func<Object, Object> remap)
        {
            var o = (Transform)original;
            posLocal = o.posLocal; rotLocal = o.rotLocal; escLocal = o.escLocal;
            sucio = true;
        }

        // cambió el padre: un RectTransform se vuelve a ubicar respecto del rect nuevo
        internal virtual void PadreNuevo() { }

        // la posición local cambió desde afuera (RectTransform recalcula su anchoredPosition)
        internal virtual void PosLocalCambiada() { }

        // La animación escribe posición, rotación y escala por separado y las aplica de una vez:
        // un solo Ensuciar por hueso y nada si no cambió (la física y los renderers lo agradecen).
        Vector3 animPos, animEsc;
        Quaternion animRot;
        byte animPend;

        internal void PonerLocal(int que, Vector3 v, Quaternion q)
        {
            if (que == 0) { animPos = v; animPend |= 1; }
            else if (que == 1) { animRot = q; animPend |= 2; }
            else { animEsc = v; animPend |= 4; }
        }

        internal void AplicarLocal()
        {
            if (animPend == 0) return;
            bool cambio = false, pos = false;
            if ((animPend & 1) != 0 && (animPos.x != posLocal.x || animPos.y != posLocal.y || animPos.z != posLocal.z)) { posLocal = animPos; cambio = pos = true; }
            if ((animPend & 2) != 0 && (animRot.x != rotLocal.x || animRot.y != rotLocal.y || animRot.z != rotLocal.z || animRot.w != rotLocal.w)) { rotLocal = animRot; cambio = true; }
            if ((animPend & 4) != 0 && (animEsc.x != escLocal.x || animEsc.y != escLocal.y || animEsc.z != escLocal.z)) { escLocal = animEsc; cambio = true; }
            animPend = 0;
            if (pos) PosLocalCambiada();
            if (cambio) Ensuciar();
        }

        internal virtual void AlCambiar()
        {
            var cs = go?.componentes;
            if (cs == null) return;
            for (int i = 0; i < cs.Count; i++) cs[i].AlCambiarTransform();
        }

        void Calcular()
        {
            if (!sucio) return;
            var local = Matrix4x4.TRS(posLocal, rotLocal, escLocal);
            if (padre != null)
            {
                mundo = padre.localToWorldMatrix * local;
                rotMundo = padre.rotation * rotLocal;
            }
            else
            {
                mundo = local;
                rotMundo = rotLocal;
            }
            sucio = false;
        }

        public Matrix4x4 localToWorldMatrix { get { Calcular(); return mundo; } }
        public Matrix4x4 worldToLocalMatrix => Matrix4x4.Inverse(localToWorldMatrix);

        public Vector3 position
        {
            get { Calcular(); return new Vector3(mundo.m03, mundo.m13, mundo.m23); }
            set
            {
                posLocal = padre != null ? padre.InverseTransformPoint(value) : value;
                PosLocalCambiada();
                Ensuciar();
            }
        }

        public Vector3 localPosition
        {
            get => posLocal;
            set { posLocal = value; PosLocalCambiada(); Ensuciar(); }
        }

        public Quaternion rotation
        {
            get { Calcular(); return rotMundo; }
            set
            {
                rotLocal = padre != null ? Quaternion.Inverse(padre.rotation) * value : value;
                rotLocal = Quaternion.Normalize(rotLocal);
                Ensuciar();
            }
        }

        public Quaternion localRotation
        {
            get => rotLocal;
            set { rotLocal = Quaternion.Normalize(value); Ensuciar(); }
        }

        public Vector3 localScale
        {
            get => escLocal;
            set { escLocal = value; Ensuciar(); }
        }

        public Vector3 eulerAngles
        {
            get => rotation.eulerAngles;
            set => rotation = Quaternion.Euler(value);
        }

        public Vector3 localEulerAngles
        {
            get => rotLocal.eulerAngles;
            set { rotLocal = Quaternion.Euler(value); Ensuciar(); }
        }

        public Vector3 right { get => rotation * Vector3.right; set => rotation = Quaternion.FromToRotation(Vector3.right, value); }
        public Vector3 up { get => rotation * Vector3.up; set => rotation = Quaternion.FromToRotation(Vector3.up, value); }
        public Vector3 forward { get => rotation * Vector3.forward; set => rotation = Quaternion.LookRotation(value); }

        public Vector3 lossyScale
        {
            get
            {
                // la escala "con pérdida": la del mundo sin la rotación (exacta si no hay sesgo)
                Calcular();
                var inv = Matrix4x4.Rotate(Quaternion.Inverse(rotMundo)) * mundo;
                return new Vector3(inv.m00, inv.m11, inv.m22);
            }
        }

        public bool hasChanged { get => cambio; set => cambio = value; }

        public void SetPositionAndRotation(Vector3 position, Quaternion rotation)
        {
            if (padre != null)
            {
                posLocal = padre.InverseTransformPoint(position);
                rotLocal = Quaternion.Normalize(Quaternion.Inverse(padre.rotation) * rotation);
            }
            else { posLocal = position; rotLocal = Quaternion.Normalize(rotation); }
            PosLocalCambiada();
            Ensuciar();
        }

        // ── jerarquía ──
        public Transform parent
        {
            get => padre;
            set
            {
                if (this is RectTransform) Debug.LogWarning("Parent of RectTransform is being set with parent property. Consider using the SetParent method instead, with the worldPositionStays argument set to false. This will retain local orientation and scale rather than world orientation and scale, which can prevent common UI scaling issues.");
                SetParent(value, true);
            }
        }

        public Transform root
        {
            get { var t = this; while (t.padre != null) t = t.padre; return t; }
        }

        public int childCount => hijos.Count;

        public void SetParent(Transform p) => SetParent(p, true);

        public void SetParent(Transform parent, bool worldPositionStays)
        {
            if (parent == padre) return;
            if (parent != null && parent.IsChildOf(this))
            {
                Debug.LogError("Cannot set the parent of a GameObject to one of its children", this);
                return;
            }
            Vector3 pos = default, esc = default; Quaternion rot = default;
            if (worldPositionStays) { pos = position; rot = rotation; esc = lossyScale; }
            var viejo = padre;
            Jerarquia.Mensaje(this, "OnBeforeTransformParentChanged");
            if (viejo != null) viejo.hijos.Remove(this);
            else Escenas.QuitarRaiz(this);
            padre = parent;
            if (parent != null) parent.hijos.Add(this);
            else Escenas.RaizNueva(this, viejo);
            if (worldPositionStays)
            {
                if (parent != null)
                {
                    posLocal = parent.InverseTransformPoint(pos);
                    rotLocal = Quaternion.Normalize(Quaternion.Inverse(parent.rotation) * rot);
                    var pe = parent.lossyScale;
                    escLocal = new Vector3(pe.x != 0 ? esc.x / pe.x : 0, pe.y != 0 ? esc.y / pe.y : 0, pe.z != 0 ? esc.z / pe.z : 0);
                }
                else { posLocal = pos; rotLocal = rot; escLocal = esc; }
                PosLocalCambiada();   // quedó en el mismo lugar: el RectTransform recalcula sus anclas
            }
            else PadreNuevo();        // conserva lo local: el RectTransform se ubica en el rect nuevo
            // la escena es la del padre nuevo
            if (parent != null && go != null && parent.go != null && parent.go.escena != go.escena) Escenas.Mover(go, parent.go.escena);
            Ensuciar();
            Activacion.Recalcular(go);
            // sus colisionadores pueden pasar a otro Rigidbody
            Porteo.Fisica.Simulacion.Reubicar(this);
            Jerarquia.PadreCambiado(this, viejo);
        }

        public int GetSiblingIndex() => padre != null ? padre.hijos.IndexOf(this) : Escenas.IndiceRaiz(this);

        public void SetSiblingIndex(int index)
        {
            if (padre == null) { Escenas.MoverRaiz(this, index); return; }
            var l = padre.hijos;
            l.Remove(this);
            l.Insert(Math.Clamp(index, 0, l.Count), this);
            Jerarquia.HijosCambiados(padre);
        }

        public void SetAsFirstSibling() => SetSiblingIndex(0);
        public void SetAsLastSibling() => SetSiblingIndex(int.MaxValue);

        public Transform GetChild(int index)
        {
            if (index < 0 || index >= hijos.Count) throw new UnityException("Transform child out of bounds");
            return hijos[index];
        }

        public bool IsChildOf(Transform parent)
        {
            for (var t = this; t != null; t = t.padre) if (t == parent) return true;
            return false;
        }

        public void DetachChildren()
        {
            foreach (var h in hijos.ToArray()) h.SetParent(null, true);
        }

        public Transform Find(string n)
        {
            if (n == null) return null;
            var t = this;
            foreach (var parte in n.Split('/'))
            {
                if (parte.Length == 0) continue;
                if (parte == "..") { t = t.padre; if (t == null) return null; continue; }
                Transform hallado = null;
                foreach (var h in t.hijos) if (h.go.m_Name == parte) { hallado = h; break; }
                if (hallado == null) return null;
                t = hallado;
            }
            return t;
        }

        public Transform FindChild(string n) => Find(n);

        public IEnumerator GetEnumerator() => new Enumerador(this);

        sealed class Enumerador : IEnumerator
        {
            readonly Transform t; int i = -1;
            public Enumerador(Transform t) { this.t = t; }
            public object Current => t.GetChild(i);
            public bool MoveNext() => ++i < t.childCount;
            public void Reset() => i = -1;
        }

        // ── mover y girar ──
        public void Translate(Vector3 translation) => Translate(translation, Space.Self);

        public void Translate(Vector3 translation, Space relativeTo)
        {
            if (relativeTo == Space.World) position += translation;
            else position += TransformDirection(translation);
        }

        public void Translate(float x, float y, float z) => Translate(new Vector3(x, y, z), Space.Self);
        public void Translate(float x, float y, float z, Space relativeTo) => Translate(new Vector3(x, y, z), relativeTo);

        public void Translate(Vector3 translation, Transform relativeTo)
        {
            if (relativeTo != null) position += relativeTo.TransformDirection(translation);
            else position += translation;
        }

        public void Rotate(Vector3 eulers) => Rotate(eulers, Space.Self);

        public void Rotate(Vector3 eulers, Space relativeTo)
        {
            var q = Quaternion.Euler(eulers.x, eulers.y, eulers.z);
            if (relativeTo == Space.Self) localRotation = localRotation * q;
            else rotation = rotation * (Quaternion.Inverse(rotation) * q * rotation);
        }

        public void Rotate(float xAngle, float yAngle, float zAngle) => Rotate(new Vector3(xAngle, yAngle, zAngle), Space.Self);
        public void Rotate(float xAngle, float yAngle, float zAngle, Space relativeTo) => Rotate(new Vector3(xAngle, yAngle, zAngle), relativeTo);

        public void Rotate(Vector3 axis, float angle) => Rotate(axis, angle, Space.Self);

        public void Rotate(Vector3 axis, float angle, Space relativeTo)
        {
            if (relativeTo == Space.Self) RotarAlrededorLocal(TransformDirection(axis), angle * Mathf.Deg2Rad);
            else RotarAlrededorLocal(axis, angle * Mathf.Deg2Rad);
        }

        void RotarAlrededorLocal(Vector3 ejeMundo, float radianes)
        {
            var q = Quaternion.AngleAxis(radianes * Mathf.Rad2Deg, ejeMundo);
            rotation = q * rotation;
        }

        public void RotateAround(Vector3 point, Vector3 axis, float angle)
        {
            Vector3 worldPos = position;
            Quaternion q = Quaternion.AngleAxis(angle, axis);
            Vector3 dif = worldPos - point;
            dif = q * dif;
            worldPos = point + dif;
            position = worldPos;
            RotarAlrededorLocal(axis, angle * Mathf.Deg2Rad);
        }

        public void LookAt(Transform target) { if (target != null) LookAt(target.position, Vector3.up); }
        public void LookAt(Transform target, Vector3 worldUp) { if (target != null) LookAt(target.position, worldUp); }
        public void LookAt(Vector3 worldPosition) => LookAt(worldPosition, Vector3.up);

        public void LookAt(Vector3 worldPosition, Vector3 worldUp)
        {
            Vector3 forward = worldPosition - position;
            if (forward.sqrMagnitude < 1e-12f) return;
            rotation = Quaternion.LookRotation(forward, worldUp);
        }

        // ── transformar puntos ──
        public Vector3 TransformDirection(Vector3 direction) => rotation * direction;
        public Vector3 TransformDirection(float x, float y, float z) => TransformDirection(new Vector3(x, y, z));
        public Vector3 InverseTransformDirection(Vector3 direction) => Quaternion.Inverse(rotation) * direction;
        public Vector3 InverseTransformDirection(float x, float y, float z) => InverseTransformDirection(new Vector3(x, y, z));
        public Vector3 TransformVector(Vector3 vector) => localToWorldMatrix.MultiplyVector(vector);
        public Vector3 InverseTransformVector(Vector3 vector) => worldToLocalMatrix.MultiplyVector(vector);
        public Vector3 TransformPoint(Vector3 position) => localToWorldMatrix.MultiplyPoint3x4(position);
        public Vector3 TransformPoint(float x, float y, float z) => TransformPoint(new Vector3(x, y, z));

        public Vector3 InverseTransformPoint(Vector3 position)
        {
            // como Unity: deshace cada nivel (traslado, rotación, escala) desde la raíz
            Vector3 p = padre != null ? padre.InverseTransformPoint(position) : position;
            p -= posLocal;
            p = Quaternion.Inverse(rotLocal) * p;
            return new Vector3(escLocal.x != 0 ? p.x / escLocal.x : 0, escLocal.y != 0 ? p.y / escLocal.y : 0, escLocal.z != 0 ? p.z / escLocal.z : 0);
        }

        public Vector3 InverseTransformPoint(float x, float y, float z) => InverseTransformPoint(new Vector3(x, y, z));
    }
}

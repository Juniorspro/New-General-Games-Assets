using System;
using System.Collections.Generic;
using Porteo;
using Porteo.Datos;

namespace UnityEngine
{
    // El rectángulo de la UI, como en Unity: el tamaño sale del rect del padre entre las anclas más
    // sizeDelta, y la posición local del punto de pivote es la referencia de las anclas en el rect
    // del padre más anchoredPosition. Lo que se guarda son las anclas, el pivote, sizeDelta y
    // anchoredPosition; la posición local (x, y) se deriva. Cuando cambia un rect, sus hijos se
    // reubican y los que cambian de tamaño reciben OnRectTransformDimensionsChange.
    public sealed partial class RectTransform : Transform
    {
        internal Vector2 anclaMin = new Vector2(0.5f, 0.5f), anclaMax = new Vector2(0.5f, 0.5f), anclada, tamDelta = new Vector2(100, 100), pivote = new Vector2(0.5f, 0.5f);
        Rect ultimo;
        bool hayUltimo;

        public delegate void ReapplyDrivenProperties(RectTransform driven);
        public static event ReapplyDrivenProperties reapplyDrivenProperties { add { } remove { } }

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            base.LeerNativo(m, r);
            anclaMin = Serial.V2(m.M("m_AnchorMin"));
            anclaMax = Serial.V2(m.M("m_AnchorMax"));
            anclada = Serial.V2(m.M("m_AnchoredPosition"));
            tamDelta = Serial.V2(m.M("m_SizeDelta"));
            pivote = Serial.V2(m.M("m_Pivot"));
        }

        internal override void CopiarDe(Object original, Func<Object, Object> remap)
        {
            base.CopiarDe(original, remap);
            if (original is RectTransform o) { anclaMin = o.anclaMin; anclaMax = o.anclaMax; anclada = o.anclada; tamDelta = o.tamDelta; pivote = o.pivote; }
        }

        Rect RectPadre => padre is RectTransform p ? p.rect : default;

        Vector2 RefAncla
        {
            get
            {
                var r = RectPadre;
                return new Vector2(r.x + r.width * (anclaMin.x + (anclaMax.x - anclaMin.x) * pivote.x),
                                   r.y + r.height * (anclaMin.y + (anclaMax.y - anclaMin.y) * pivote.y));
            }
        }

        public Rect rect
        {
            get
            {
                var r = RectPadre;
                float w = r.width * (anclaMax.x - anclaMin.x) + tamDelta.x, h = r.height * (anclaMax.y - anclaMin.y) + tamDelta.y;
                return new Rect(-pivote.x * w, -pivote.y * h, w, h);
            }
        }

        // la posición local que corresponde a las anclas (la z no se toca)
        void Ubicar()
        {
            var a = RefAncla + anclada;
            if (posLocal.x != a.x || posLocal.y != a.y)
            {
                posLocal.x = a.x; posLocal.y = a.y;
                Ensuciar();
            }
        }

        internal override void PosLocalCambiada() => anclada = new Vector2(posLocal.x, posLocal.y) - RefAncla;
        internal override void PadreNuevo() { Ubicar(); Revisar(); }

        // después de cualquier cambio: reubicar, avisar si cambió el tamaño y seguir con los hijos
        internal void Revisar()
        {
            Ubicar();
            var r = rect;
            if (hayUltimo && r == ultimo) return;
            bool tam = !hayUltimo || r.width != ultimo.width || r.height != ultimo.height;
            ultimo = r; hayUltimo = true;
            if (tam && go != null) Mensajes.Enviar(go, "OnRectTransformDimensionsChange", null, false, SendMessageOptions.DontRequireReceiver);
            for (int i = 0; i < hijos.Count; i++) if (hijos[i] is RectTransform h) h.Revisar();
        }

        // ── propiedades ──
        public Vector2 anchorMin { get => anclaMin; set { if (anclaMin == value) return; anclaMin = value; Revisar(); } }
        public Vector2 anchorMax { get => anclaMax; set { if (anclaMax == value) return; anclaMax = value; Revisar(); } }
        public Vector2 anchoredPosition { get => anclada; set { if (anclada == value) return; anclada = value; Revisar(); } }
        public Vector2 sizeDelta { get => tamDelta; set { if (tamDelta == value) return; tamDelta = value; Revisar(); } }
        public Vector2 pivot { get => pivote; set { if (pivote == value) return; pivote = value; Revisar(); } }

        public Vector3 anchoredPosition3D
        {
            get => new Vector3(anclada.x, anclada.y, posLocal.z);
            set { anclada = new Vector2(value.x, value.y); if (posLocal.z != value.z) { posLocal.z = value.z; Ensuciar(); } Revisar(); }
        }

        public Vector2 offsetMin
        {
            get => anclada - Vector2.Scale(tamDelta, pivote);
            set
            {
                var d = value - offsetMin;
                tamDelta -= d;
                anclada += Vector2.Scale(d, Vector2.one - pivote);
                Revisar();
            }
        }

        public Vector2 offsetMax
        {
            get => anclada + Vector2.Scale(tamDelta, Vector2.one - pivote);
            set
            {
                var d = value - offsetMax;
                tamDelta += d;
                anclada += Vector2.Scale(d, pivote);
                Revisar();
            }
        }

        public Object drivenByObject { get; set; }
        public DrivenTransformProperties drivenProperties { get; set; }

        public enum Edge { Left = 0, Right = 1, Top = 2, Bottom = 3 }
        public enum Axis { Horizontal = 0, Vertical = 1 }

        public void SetInsetAndSizeFromParentEdge(Edge edge, float inset, float size)
        {
            int eje = edge == Edge.Top || edge == Edge.Bottom ? 1 : 0;
            bool fin = edge == Edge.Top || edge == Edge.Right;
            float v = fin ? 1 : 0;
            var a = anclaMin; a[eje] = v; anclaMin = a;
            a = anclaMax; a[eje] = v; anclaMax = a;
            var s = tamDelta; s[eje] = size; tamDelta = s;
            var p = anclada;
            p[eje] = fin ? -inset - size * (1 - pivote[eje]) : inset + size * pivote[eje];
            anclada = p;
            Revisar();
        }

        public void SetSizeWithCurrentAnchors(Axis axis, float size)
        {
            int i = (int)axis;
            var s = tamDelta;
            s[i] = size - RectPadre.size[i] * (anclaMax[i] - anclaMin[i]);
            sizeDelta = s;
        }

        public void GetLocalCorners(Vector3[] fourCornersArray)
        {
            if (fourCornersArray == null || fourCornersArray.Length < 4) { Debug.LogError("Calling GetLocalCorners with an array that is null or has less than 4 elements."); return; }
            var r = rect;
            fourCornersArray[0] = new Vector3(r.x, r.y, 0);
            fourCornersArray[1] = new Vector3(r.x, r.yMax, 0);
            fourCornersArray[2] = new Vector3(r.xMax, r.yMax, 0);
            fourCornersArray[3] = new Vector3(r.xMax, r.y, 0);
        }

        public void GetWorldCorners(Vector3[] fourCornersArray)
        {
            if (fourCornersArray == null || fourCornersArray.Length < 4) { Debug.LogError("Calling GetWorldCorners with an array that is null or has less than 4 elements."); return; }
            GetLocalCorners(fourCornersArray);
            var m = localToWorldMatrix;
            for (int i = 0; i < 4; i++) fourCornersArray[i] = m.MultiplyPoint(fourCornersArray[i]);
        }

        public void ForceUpdateRectTransforms() => Revisar();
    }

    public partial struct DrivenRectTransformTracker
    {
        public List<RectTransform> m_Tracked;
        public void Add(Object driver, RectTransform rectTransform, DrivenTransformProperties drivenProperties) { }
        public void Clear() { }
        public static void StopRecordingUndo() { }
        public static void StartRecordingUndo() { }
    }
}

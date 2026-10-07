using System;

namespace UnityEngine
{
    public enum WrapMode
    {
        Once = 1, Loop = 2, PingPong = 4, Default = 0, ClampForever = 8, Clamp = 1,
    }

    public enum WeightedMode
    {
        None = 0, In = 1, Out = 2, Both = 3,
    }

    public partial struct Keyframe
    {
        public float m_Time;
        public float m_Value;
        public float m_InTangent;
        public float m_OutTangent;
        public int m_TangentMode;
        public int m_WeightedMode;
        public float m_InWeight;
        public float m_OutWeight;

        public Keyframe(float time, float value) : this(time, value, 0f, 0f, 1f / 3f, 1f / 3f) { }
        public Keyframe(float time, float value, float inTangent, float outTangent) : this(time, value, inTangent, outTangent, 1f / 3f, 1f / 3f) { }

        public Keyframe(float time, float value, float inTangent, float outTangent, float inWeight, float outWeight)
        {
            m_Time = time; m_Value = value; m_InTangent = inTangent; m_OutTangent = outTangent;
            m_TangentMode = 0; m_WeightedMode = 0; m_InWeight = inWeight; m_OutWeight = outWeight;
        }

        public float time { get => m_Time; set => m_Time = value; }
        public float value { get => m_Value; set => m_Value = value; }
        public float inTangent { get => m_InTangent; set => m_InTangent = value; }
        public float outTangent { get => m_OutTangent; set => m_OutTangent = value; }
        public float inWeight { get => m_InWeight; set => m_InWeight = value; }
        public float outWeight { get => m_OutWeight; set => m_OutWeight = value; }
        public WeightedMode weightedMode { get => (WeightedMode)m_WeightedMode; set => m_WeightedMode = (int)value; }
        public int tangentMode { get => m_TangentMode; set => m_TangentMode = value; }
        internal int tangentModeInterno { get => m_TangentMode; set => m_TangentMode = value; }
    }

    // Evaluación como la de Unity: Hermite entre claves con sus tangentes (Bezier si son
    // ponderadas), tangente infinita = escalón, y los modos de repetición antes y después.
    [Serializable]
    public partial class AnimationCurve : IEquatable<AnimationCurve>
    {
        Keyframe[] k = Array.Empty<Keyframe>();
        WrapMode pre = WrapMode.ClampForever, post = WrapMode.ClampForever;

        public AnimationCurve() { }
        public AnimationCurve(params Keyframe[] keys) { this.keys = keys; }

        public Keyframe[] keys
        {
            get => (Keyframe[])k.Clone();
            set
            {
                k = value == null ? Array.Empty<Keyframe>() : (Keyframe[])value.Clone();
                Array.Sort(k, (a, b) => a.m_Time.CompareTo(b.m_Time));
            }
        }

        public Keyframe this[int index] => k[index];
        public int length => k.Length;
        public WrapMode preWrapMode { get => pre; set => pre = value; }
        public WrapMode postWrapMode { get => post; set => post = value; }

        // el modo de repetición guardado en los archivos de Unity (0 PingPong, 1 Repeat, 2 Clamp, 3 Default)
        internal static WrapMode ModoDeInterno(int m) => m switch
        {
            0 => WrapMode.PingPong,
            1 => WrapMode.Loop,
            3 => WrapMode.Default,
            _ => WrapMode.ClampForever,
        };

        public int AddKey(float time, float value) => AddKey(new Keyframe(time, value));

        public int AddKey(Keyframe key)
        {
            for (int i = 0; i < k.Length; i++) if (k[i].m_Time == key.m_Time) return -1;
            var n = new Keyframe[k.Length + 1];
            int pos = 0;
            while (pos < k.Length && k[pos].m_Time < key.m_Time) pos++;
            Array.Copy(k, 0, n, 0, pos);
            n[pos] = key;
            Array.Copy(k, pos, n, pos + 1, k.Length - pos);
            k = n;
            return pos;
        }

        public int MoveKey(int index, Keyframe key)
        {
            RemoveKey(index);
            return AddKey(key);
        }

        public void RemoveKey(int index)
        {
            if (index < 0 || index >= k.Length) throw new ArgumentException("Index out of bounds.");
            var n = new Keyframe[k.Length - 1];
            Array.Copy(k, 0, n, 0, index);
            Array.Copy(k, index + 1, n, index, k.Length - index - 1);
            k = n;
        }

        public void SmoothTangents(int index, float weight)
        {
            if (index < 0 || index >= k.Length) return;
            var key = k[index];
            float dx1 = 0, dy1 = 0, dx2 = 0, dy2 = 0;
            if (index > 0) { dx1 = key.m_Time - k[index - 1].m_Time; dy1 = key.m_Value - k[index - 1].m_Value; }
            if (index < k.Length - 1) { dx2 = k[index + 1].m_Time - key.m_Time; dy2 = k[index + 1].m_Value - key.m_Value; }
            float m1 = dx1 > 0 ? dy1 / dx1 : 0, m2 = dx2 > 0 ? dy2 / dx2 : 0;
            float m = index == 0 ? m2 : index == k.Length - 1 ? m1 : (1 - weight) * (m1 + m2) * 0.5f + weight * (m1 + m2) * 0.5f;
            key.m_InTangent = key.m_OutTangent = m;
            k[index] = key;
        }

        public static AnimationCurve Constant(float timeStart, float timeEnd, float value) =>
            Linear(timeStart, value, timeEnd, value);

        public static AnimationCurve Linear(float timeStart, float valueStart, float timeEnd, float valueEnd)
        {
            if (timeStart == timeEnd) return new AnimationCurve(new Keyframe(timeStart, valueStart));
            float t = (valueEnd - valueStart) / (timeEnd - timeStart);
            return new AnimationCurve(new Keyframe(timeStart, valueStart, 0f, t), new Keyframe(timeEnd, valueEnd, t, 0f));
        }

        public static AnimationCurve EaseInOut(float timeStart, float valueStart, float timeEnd, float valueEnd)
        {
            if (timeStart == timeEnd) return new AnimationCurve(new Keyframe(timeStart, valueStart));
            return new AnimationCurve(new Keyframe(timeStart, valueStart, 0f, 0f), new Keyframe(timeEnd, valueEnd, 0f, 0f));
        }

        public float Evaluate(float time)
        {
            var ks = k;
            int n = ks.Length;
            if (n == 0) return 0f;
            if (n == 1) return ks[0].m_Value;
            float t0 = ks[0].m_Time, t1 = ks[n - 1].m_Time, largo = t1 - t0;
            if (time < t0)
            {
                if (largo <= 0f) return ks[0].m_Value;
                if (pre == WrapMode.Loop) time = t0 + Mathf.Repeat(time - t0, largo);
                else if (pre == WrapMode.PingPong) time = t0 + Mathf.PingPong(time - t0, largo);
                else return ks[0].m_Value;
            }
            else if (time > t1)
            {
                if (largo <= 0f) return ks[n - 1].m_Value;
                if (post == WrapMode.Loop) time = t0 + Mathf.Repeat(time - t0, largo);
                else if (post == WrapMode.PingPong) time = t0 + Mathf.PingPong(time - t0, largo);
                else return ks[n - 1].m_Value;
            }
            // búsqueda binaria del tramo
            int lo = 0, hi = n - 1;
            while (hi - lo > 1)
            {
                int m = (lo + hi) >> 1;
                if (ks[m].m_Time <= time) lo = m; else hi = m;
            }
            return Tramo(time, ks[lo], ks[hi]);
        }

        static float Tramo(float time, Keyframe a, Keyframe b)
        {
            float dx = b.m_Time - a.m_Time;
            if (dx <= 0f) return a.m_Value;
            if (float.IsInfinity(a.m_OutTangent) || float.IsInfinity(b.m_InTangent)) return a.m_Value;
            float t = (time - a.m_Time) / dx;
            bool pesoA = (a.m_WeightedMode & (int)WeightedMode.Out) != 0, pesoB = (b.m_WeightedMode & (int)WeightedMode.In) != 0;
            if (pesoA || pesoB) return Bezier(t, dx, a, b, pesoA ? a.m_OutWeight : 1f / 3f, pesoB ? b.m_InWeight : 1f / 3f);
            float m0 = a.m_OutTangent * dx, m1 = b.m_InTangent * dx;
            float t2 = t * t, t3 = t2 * t;
            float h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
            return h00 * a.m_Value + h10 * m0 + h01 * b.m_Value + h11 * m1;
        }

        // tramo ponderado: Bezier cúbica con los puntos de control en x = peso; se busca el u cuya x es t
        static float Bezier(float t, float dx, Keyframe a, Keyframe b, float w1, float w2)
        {
            float y0 = a.m_Value, y1 = a.m_Value + w1 * dx * a.m_OutTangent, y2 = b.m_Value - w2 * dx * b.m_InTangent, y3 = b.m_Value;
            float x1 = w1, x2 = 1f - w2;
            float u = t;
            for (int i = 0; i < 12; i++)
            {
                float iu = 1 - u;
                float x = 3 * iu * iu * u * x1 + 3 * iu * u * u * x2 + u * u * u;
                float d = 3 * iu * iu * x1 + 6 * iu * u * (x2 - x1) + 3 * u * u * (1 - x2);
                float err = x - t;
                if (Math.Abs(err) < 1e-6f) break;
                if (Math.Abs(d) < 1e-6f) break;
                u = Math.Clamp(u - err / d, 0f, 1f);
            }
            float v = 1 - u;
            return v * v * v * y0 + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y3;
        }

        public bool Equals(AnimationCurve other)
        {
            if ((object)other == null) return false;
            if (ReferenceEquals(this, other)) return true;
            if (k.Length != other.k.Length) return false;
            for (int i = 0; i < k.Length; i++) if (!k[i].Equals(other.k[i])) return false;
            return true;
        }

        public override bool Equals(object o) => o is AnimationCurve c && Equals(c);
        public override int GetHashCode() => k.Length;
    }

    public enum GradientMode { Blend = 0, Fixed = 1 }

    public struct GradientColorKey
    {
        public Color color;
        public float time;
        public GradientColorKey(Color col, float time) { color = col; this.time = time; }
    }

    public struct GradientAlphaKey
    {
        public float alpha;
        public float time;
        public GradientAlphaKey(float alpha, float time) { this.alpha = alpha; this.time = time; }
    }

    [Serializable]
    public partial class Gradient : IEquatable<Gradient>
    {
        GradientColorKey[] colores = { new GradientColorKey(Color.white, 0f), new GradientColorKey(Color.white, 1f) };
        GradientAlphaKey[] alfas = { new GradientAlphaKey(1f, 0f), new GradientAlphaKey(1f, 1f) };

        public Gradient() { }

        public GradientColorKey[] colorKeys
        {
            get => (GradientColorKey[])colores.Clone();
            set { colores = Ordenar(value); }
        }

        public GradientAlphaKey[] alphaKeys
        {
            get => (GradientAlphaKey[])alfas.Clone();
            set { alfas = Ordenar(value); }
        }

        public GradientMode mode { get; set; }

        static GradientColorKey[] Ordenar(GradientColorKey[] v)
        {
            var r = v == null ? Array.Empty<GradientColorKey>() : (GradientColorKey[])v.Clone();
            Array.Sort(r, (a, b) => a.time.CompareTo(b.time));
            return r;
        }

        static GradientAlphaKey[] Ordenar(GradientAlphaKey[] v)
        {
            var r = v == null ? Array.Empty<GradientAlphaKey>() : (GradientAlphaKey[])v.Clone();
            Array.Sort(r, (a, b) => a.time.CompareTo(b.time));
            return r;
        }

        public void SetKeys(GradientColorKey[] colorKeys, GradientAlphaKey[] alphaKeys)
        {
            colores = Ordenar(colorKeys);
            alfas = Ordenar(alphaKeys);
        }

        public Color Evaluate(float time)
        {
            var c = Color.white;
            if (colores.Length > 0)
            {
                int i = 0;
                while (i < colores.Length && colores[i].time < time) i++;
                if (i == 0) c = colores[0].color;
                else if (i == colores.Length) c = colores[i - 1].color;
                else if (mode == GradientMode.Fixed) c = colores[i].color;
                else
                {
                    var a = colores[i - 1]; var b = colores[i];
                    float t = b.time > a.time ? (time - a.time) / (b.time - a.time) : 0f;
                    c = Color.LerpUnclamped(a.color, b.color, t);
                }
            }
            float al = 1f;
            if (alfas.Length > 0)
            {
                int i = 0;
                while (i < alfas.Length && alfas[i].time < time) i++;
                if (i == 0) al = alfas[0].alpha;
                else if (i == alfas.Length) al = alfas[i - 1].alpha;
                else if (mode == GradientMode.Fixed) al = alfas[i].alpha;
                else
                {
                    var a = alfas[i - 1]; var b = alfas[i];
                    float t = b.time > a.time ? (time - a.time) / (b.time - a.time) : 0f;
                    al = a.alpha + (b.alpha - a.alpha) * t;
                }
            }
            c.a = al;
            return c;
        }

        public bool Equals(Gradient other)
        {
            if ((object)other == null) return false;
            if (ReferenceEquals(this, other)) return true;
            if (mode != other.mode || colores.Length != other.colores.Length || alfas.Length != other.alfas.Length) return false;
            for (int i = 0; i < colores.Length; i++) if (!colores[i].Equals(other.colores[i])) return false;
            for (int i = 0; i < alfas.Length; i++) if (!alfas[i].Equals(other.alfas[i])) return false;
            return true;
        }

        public override bool Equals(object o) => o is Gradient g && Equals(g);
        public override int GetHashCode() => colores.Length * 31 + alfas.Length;
    }

    [Serializable]
    public partial class RectOffset
    {
        public int left { get; set; }
        public int right { get; set; }
        public int top { get; set; }
        public int bottom { get; set; }

        public RectOffset() { }
        public RectOffset(int left, int right, int top, int bottom) { this.left = left; this.right = right; this.top = top; this.bottom = bottom; }

        public int horizontal => left + right;
        public int vertical => top + bottom;

        public Rect Add(Rect rect) => new Rect(rect.x - left, rect.y - top, rect.width + horizontal, rect.height + vertical);
        public Rect Remove(Rect rect) => new Rect(rect.x + left, rect.y + top, rect.width - horizontal, rect.height - vertical);

        public override string ToString() => $"RectOffset (l:{left} r:{right} t:{top} b:{bottom})";
    }
}

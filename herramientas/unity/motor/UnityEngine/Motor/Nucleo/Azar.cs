using System;

namespace UnityEngine
{
    // Random con el mismo generador que Unity (xorshift128 sembrado como el de Unity): con la misma
    // semilla (InitState) da la misma secuencia, que es lo que usan los juegos para generar cosas
    // repetibles.
    public sealed partial class Random
    {
        [Serializable]
        public struct State
        {
            [SerializeField] internal int s0, s1, s2, s3;
        }

        static uint x, y, z, w;

        static Random() => Sembrar((uint)Environment.TickCount);

        static void Sembrar(uint semilla)
        {
            unchecked
            {
                x = semilla;
                y = x * 1812433253u + 1;
                z = y * 1812433253u + 1;
                w = z * 1812433253u + 1;
            }
        }

        static uint Siguiente()
        {
            unchecked
            {
                uint t = x ^ (x << 11);
                x = y; y = z; z = w;
                return w = (w ^ (w >> 19)) ^ (t ^ (t >> 8));
            }
        }

        // 23 bits divididos por 2^23-1: [0, 1] con los dos extremos
        static float Real() => (Siguiente() & 0x007FFFFF) * (1f / 8388607f);
        static float RealConSigno() => Real() * 2f - 1f;

        public static void InitState(int seed) => Sembrar(unchecked((uint)seed));

        [Obsolete("Deprecated. Use InitState() function or Random.state property instead.")]
        public static int seed { get => unchecked((int)x); set => InitState(value); }

        public static State state
        {
            get => new State { s0 = unchecked((int)x), s1 = unchecked((int)y), s2 = unchecked((int)z), s3 = unchecked((int)w) };
            set { unchecked { x = (uint)value.s0; y = (uint)value.s1; z = (uint)value.s2; w = (uint)value.s3; } }
        }

        public static float value => Real();

        // como Unity: t*min + (1-t)*max (el reparto es el mismo, el orden de la interpolación no)
        public static float Range(float min, float max)
        {
            float t = Real();
            return min * t + (1f - t) * max;
        }

        // [min, max) para enteros; si min > max, (max, min]
        public static int Range(int min, int max)
        {
            unchecked
            {
                if (min < max) return (int)(Siguiente() % (uint)(max - min)) + min;
                if (min > max) return min - (int)(Siguiente() % (uint)(min - max));
                return min;
            }
        }

        static Vector3 VectorUnitario()
        {
            float zz = RealConSigno();
            float a = Real() * 2f * Mathf.PI;
            float r = Mathf.Sqrt(1f - zz * zz);
            return new Vector3(r * Mathf.Cos(a), r * Mathf.Sin(a), zz);
        }

        public static Vector3 onUnitSphere => VectorUnitario();

        public static Vector3 insideUnitSphere
        {
            get
            {
                var v = VectorUnitario();
                return v * Mathf.Pow(Real(), 1f / 3f);
            }
        }

        public static Vector2 insideUnitCircle
        {
            get
            {
                float a = Real() * 2f * Mathf.PI;
                var v = new Vector2(Mathf.Cos(a), Mathf.Sin(a));
                return v * Mathf.Sqrt(Real());
            }
        }

        public static Quaternion rotation
        {
            get
            {
                var q = new Quaternion(RealConSigno(), RealConSigno(), RealConSigno(), RealConSigno());
                float m = Mathf.Sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
                if (m < 1e-6f) return Quaternion.identity;
                return new Quaternion(q.x / m, q.y / m, q.z / m, q.w / m);
            }
        }

        // fibración de Hopf: uniforme sobre S3
        public static Quaternion rotationUniform
        {
            get
            {
                float u0 = Real(), u1 = 2f * Mathf.PI * Real(), u2 = 2f * Mathf.PI * Real();
                float r0 = Mathf.Sqrt(1f - u0), r1 = Mathf.Sqrt(u0);
                return new Quaternion(r0 * Mathf.Sin(u1), r0 * Mathf.Cos(u1), r1 * Mathf.Sin(u2), r1 * Mathf.Cos(u2));
            }
        }

        public static Color ColorHSV() => ColorHSV(0f, 1f, 0f, 1f, 0f, 1f, 1f, 1f);
        public static Color ColorHSV(float hueMin, float hueMax) => ColorHSV(hueMin, hueMax, 0f, 1f, 0f, 1f, 1f, 1f);
        public static Color ColorHSV(float hueMin, float hueMax, float saturationMin, float saturationMax) => ColorHSV(hueMin, hueMax, saturationMin, saturationMax, 0f, 1f, 1f, 1f);
        public static Color ColorHSV(float hueMin, float hueMax, float saturationMin, float saturationMax, float valueMin, float valueMax) => ColorHSV(hueMin, hueMax, saturationMin, saturationMax, valueMin, valueMax, 1f, 1f);

        public static Color ColorHSV(float hueMin, float hueMax, float saturationMin, float saturationMax, float valueMin, float valueMax, float alphaMin, float alphaMax)
        {
            float h = Mathf.Lerp(hueMin, hueMax, value);
            float s = Mathf.Lerp(saturationMin, saturationMax, value);
            float v = Mathf.Lerp(valueMin, valueMax, value);
            var c = Color.HSVToRGB(h, s, v, true);
            c.a = Mathf.Lerp(alphaMin, alphaMax, value);
            return c;
        }
    }
}

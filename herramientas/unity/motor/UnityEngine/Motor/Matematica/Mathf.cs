using System;

namespace UnityEngine
{
    // Las mismas cuentas que Unity (UnityCsReference): redondeo bancario en Round, Lerp con t
    // recortado, Approximately con tolerancia relativa, SmoothDamp de Game Programming Gems 4.
    public partial struct Mathf
    {
        public const float PI = 3.14159274f;
        public const float Infinity = float.PositiveInfinity;
        public const float NegativeInfinity = float.NegativeInfinity;
        public const float Deg2Rad = PI * 2f / 360f;
        public const float Rad2Deg = 1f / Deg2Rad;
        public static readonly float Epsilon = float.Epsilon;

        public static int NextPowerOfTwo(int value)
        {
            if (value <= 0) return 0;
            value--;
            value |= value >> 1; value |= value >> 2; value |= value >> 4; value |= value >> 8; value |= value >> 16;
            return value + 1;
        }

        public static int ClosestPowerOfTwo(int value)
        {
            int n = NextPowerOfTwo(value), p = n >> 1;
            return value - p < n - value ? p : n;
        }

        public static bool IsPowerOfTwo(int value) => value > 0 && (value & (value - 1)) == 0;

        public static float Sin(float f) => (float)Math.Sin(f);
        public static float Cos(float f) => (float)Math.Cos(f);
        public static float Tan(float f) => (float)Math.Tan(f);
        public static float Asin(float f) => (float)Math.Asin(f);
        public static float Acos(float f) => (float)Math.Acos(f);
        public static float Atan(float f) => (float)Math.Atan(f);
        public static float Atan2(float y, float x) => (float)Math.Atan2(y, x);
        public static float Sqrt(float f) => (float)Math.Sqrt(f);
        public static float Abs(float f) => Math.Abs(f);
        public static int Abs(int value) => Math.Abs(value);

        public static float Min(float a, float b) => a < b ? a : b;
        public static int Min(int a, int b) => a < b ? a : b;
        public static float Min(params float[] values)
        {
            int n = values.Length; if (n == 0) return 0;
            float m = values[0];
            for (int i = 1; i < n; i++) if (values[i] < m) m = values[i];
            return m;
        }
        public static int Min(params int[] values)
        {
            int n = values.Length; if (n == 0) return 0;
            int m = values[0];
            for (int i = 1; i < n; i++) if (values[i] < m) m = values[i];
            return m;
        }
        public static float Max(float a, float b) => a > b ? a : b;
        public static int Max(int a, int b) => a > b ? a : b;
        public static float Max(params float[] values)
        {
            int n = values.Length; if (n == 0) return 0;
            float m = values[0];
            for (int i = 1; i < n; i++) if (values[i] > m) m = values[i];
            return m;
        }
        public static int Max(params int[] values)
        {
            int n = values.Length; if (n == 0) return 0;
            int m = values[0];
            for (int i = 1; i < n; i++) if (values[i] > m) m = values[i];
            return m;
        }

        public static float Pow(float f, float p) => (float)Math.Pow(f, p);
        public static float Exp(float power) => (float)Math.Exp(power);
        public static float Log(float f, float p) => (float)Math.Log(f, p);
        public static float Log(float f) => (float)Math.Log(f);
        public static float Log10(float f) => (float)Math.Log10(f);
        public static float Ceil(float f) => (float)Math.Ceiling(f);
        public static float Floor(float f) => (float)Math.Floor(f);
        public static float Round(float f) => (float)Math.Round(f);
        public static int CeilToInt(float f) => (int)Math.Ceiling(f);
        public static int FloorToInt(float f) => (int)Math.Floor(f);
        public static int RoundToInt(float f) => (int)Math.Round(f);
        public static float Sign(float f) => f >= 0f ? 1f : -1f;

        public static float Clamp(float value, float min, float max)
        {
            if (value < min) value = min; else if (value > max) value = max;
            return value;
        }
        public static int Clamp(int value, int min, int max)
        {
            if (value < min) value = min; else if (value > max) value = max;
            return value;
        }
        public static float Clamp01(float value) => value < 0f ? 0f : value > 1f ? 1f : value;

        public static float Lerp(float a, float b, float t) => a + (b - a) * Clamp01(t);
        public static float LerpUnclamped(float a, float b, float t) => a + (b - a) * t;

        public static float LerpAngle(float a, float b, float t)
        {
            float delta = Repeat(b - a, 360);
            if (delta > 180) delta -= 360;
            return a + delta * Clamp01(t);
        }

        public static float MoveTowards(float current, float target, float maxDelta)
        {
            if (Abs(target - current) <= maxDelta) return target;
            return current + Sign(target - current) * maxDelta;
        }

        public static float MoveTowardsAngle(float current, float target, float maxDelta)
        {
            float deltaAngle = DeltaAngle(current, target);
            if (-maxDelta < deltaAngle && deltaAngle < maxDelta) return target;
            target = current + deltaAngle;
            return MoveTowards(current, target, maxDelta);
        }

        public static float SmoothStep(float from, float to, float t)
        {
            t = Clamp01(t);
            t = -2f * t * t * t + 3f * t * t;
            return to * t + from * (1f - t);
        }

        public static bool Approximately(float a, float b) => Abs(b - a) < Max(0.000001f * Max(Abs(a), Abs(b)), Epsilon * 8);

        public static float SmoothDamp(float current, float target, ref float currentVelocity, float smoothTime) =>
            SmoothDamp(current, target, ref currentVelocity, smoothTime, Infinity, Time.deltaTime);

        public static float SmoothDamp(float current, float target, ref float currentVelocity, float smoothTime, float maxSpeed) =>
            SmoothDamp(current, target, ref currentVelocity, smoothTime, maxSpeed, Time.deltaTime);

        public static float SmoothDamp(float current, float target, ref float currentVelocity, float smoothTime, float maxSpeed, float deltaTime)
        {
            smoothTime = Max(0.0001f, smoothTime);
            float omega = 2f / smoothTime;
            float x = omega * deltaTime;
            float exp = 1f / (1f + x + 0.48f * x * x + 0.235f * x * x * x);
            float change = current - target;
            float originalTo = target;
            float maxChange = maxSpeed * smoothTime;
            change = Clamp(change, -maxChange, maxChange);
            target = current - change;
            float temp = (currentVelocity + omega * change) * deltaTime;
            currentVelocity = (currentVelocity - omega * temp) * exp;
            float output = target + (change + temp) * exp;
            if (originalTo - current > 0f == output > originalTo)
            {
                output = originalTo;
                currentVelocity = (output - originalTo) / deltaTime;
            }
            return output;
        }

        public static float SmoothDampAngle(float current, float target, ref float currentVelocity, float smoothTime) =>
            SmoothDampAngle(current, target, ref currentVelocity, smoothTime, Infinity, Time.deltaTime);

        public static float SmoothDampAngle(float current, float target, ref float currentVelocity, float smoothTime, float maxSpeed, float deltaTime)
        {
            target = current + DeltaAngle(current, target);
            return SmoothDamp(current, target, ref currentVelocity, smoothTime, maxSpeed, deltaTime);
        }

        public static float Repeat(float t, float length) => Clamp(t - Floor(t / length) * length, 0f, length);

        public static float PingPong(float t, float length)
        {
            t = Repeat(t, length * 2f);
            return length - Abs(t - length);
        }

        public static float InverseLerp(float a, float b, float value) => a != b ? Clamp01((value - a) / (b - a)) : 0f;

        public static float DeltaAngle(float current, float target)
        {
            float delta = Repeat(target - current, 360f);
            if (delta > 180f) delta -= 360f;
            return delta;
        }

        public static float Gamma(float value, float absmax, float gamma)
        {
            bool negative = value < 0f;
            float absval = Abs(value);
            if (absval > absmax) return negative ? -absval : absval;
            float result = Pow(absval / absmax, gamma) * absmax;
            return negative ? -result : result;
        }

        public static float PerlinNoise(float x, float y) => Porteo.Ruido.Perlin(x, y);

        public static float GammaToLinearSpace(float value) =>
            value <= 0.04045f ? value / 12.92f : value < 1f ? Pow((value + 0.055f) / 1.055f, 2.4f) : Pow(value, 2.2f);

        public static float LinearToGammaSpace(float value) =>
            value <= 0f ? 0f : value <= 0.0031308f ? 12.92f * value : value < 1f ? 1.055f * Pow(value, 0.4166667f) - 0.055f : Pow(value, 0.45454545f);
    }
}

namespace Porteo
{
    // Ruido de Perlin 2D como el de Unity (Ken Perlin, permutación clásica), en [0, 1].
    public static class Ruido
    {
        static readonly int[] p = new int[512];
        static Ruido()
        {
            int[] permutacion = { 151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
                190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,
                74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,
                161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,
                123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,
                221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,
                210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,
                254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180 };
            for (int i = 0; i < 256; i++) p[i] = p[256 + i] = permutacion[i];
        }
        static float Fade(float t) => t * t * t * (t * (t * 6 - 15) + 10);
        static float Lerp(float t, float a, float b) => a + t * (b - a);
        static float Grad(int hash, float x, float y)
        {
            int h = hash & 7;
            float u = h < 4 ? x : y, v = h < 4 ? y : x;
            return ((h & 1) == 0 ? u : -u) + ((h & 2) == 0 ? 2f * v : -2f * v);
        }
        public static float Perlin(float x, float y)
        {
            int X = (int)Math.Floor(x) & 255, Y = (int)Math.Floor(y) & 255;
            x -= (float)Math.Floor(x); y -= (float)Math.Floor(y);
            float u = Fade(x), v = Fade(y);
            int A = p[X] + Y, B = p[X + 1] + Y;
            float r = Lerp(v, Lerp(u, Grad(p[A], x, y), Grad(p[B], x - 1, y)), Lerp(u, Grad(p[A + 1], x, y - 1), Grad(p[B + 1], x - 1, y - 1)));
            return Math.Clamp((r + 0.69f) / 1.38f, 0f, 1f);
        }
    }
}

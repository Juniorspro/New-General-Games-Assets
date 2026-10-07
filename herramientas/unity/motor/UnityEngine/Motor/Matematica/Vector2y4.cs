using System;
using System.Globalization;

namespace UnityEngine
{
    public partial struct Vector2 : IEquatable<Vector2>, IFormattable
    {
        public const float kEpsilon = 0.00001f;
        public const float kEpsilonNormalSqrt = 1e-15f;

        public float x;
        public float y;

        public Vector2(float x, float y) { this.x = x; this.y = y; }

        public float this[int index]
        {
            get => index switch { 0 => x, 1 => y, _ => throw new IndexOutOfRangeException("Invalid Vector2 index!") };
            set
            {
                switch (index)
                {
                    case 0: x = value; break;
                    case 1: y = value; break;
                    default: throw new IndexOutOfRangeException("Invalid Vector2 index!");
                }
            }
        }

        public void Set(float newX, float newY) { x = newX; y = newY; }

        public static Vector2 zero => new Vector2(0f, 0f);
        public static Vector2 one => new Vector2(1f, 1f);
        public static Vector2 up => new Vector2(0f, 1f);
        public static Vector2 down => new Vector2(0f, -1f);
        public static Vector2 left => new Vector2(-1f, 0f);
        public static Vector2 right => new Vector2(1f, 0f);
        public static Vector2 positiveInfinity => new Vector2(float.PositiveInfinity, float.PositiveInfinity);
        public static Vector2 negativeInfinity => new Vector2(float.NegativeInfinity, float.NegativeInfinity);

        public float magnitude => (float)Math.Sqrt(x * x + y * y);
        public float sqrMagnitude => x * x + y * y;

        public Vector2 normalized
        {
            get { var v = new Vector2(x, y); v.Normalize(); return v; }
        }

        public void Normalize()
        {
            float mag = magnitude;
            if (mag > kEpsilon) this = this / mag; else this = zero;
        }

        public static Vector2 Lerp(Vector2 a, Vector2 b, float t)
        {
            t = Mathf.Clamp01(t);
            return new Vector2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        }

        public static Vector2 LerpUnclamped(Vector2 a, Vector2 b, float t) => new Vector2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);

        public static Vector2 MoveTowards(Vector2 current, Vector2 target, float maxDistanceDelta)
        {
            float tx = target.x - current.x, ty = target.y - current.y, sq = tx * tx + ty * ty;
            if (sq == 0 || (maxDistanceDelta >= 0 && sq <= maxDistanceDelta * maxDistanceDelta)) return target;
            float dist = (float)Math.Sqrt(sq);
            return new Vector2(current.x + tx / dist * maxDistanceDelta, current.y + ty / dist * maxDistanceDelta);
        }

        public static Vector2 Scale(Vector2 a, Vector2 b) => new Vector2(a.x * b.x, a.y * b.y);
        public void Scale(Vector2 scale) { x *= scale.x; y *= scale.y; }

        public static Vector2 Reflect(Vector2 inDirection, Vector2 inNormal) => -2f * Dot(inNormal, inDirection) * inNormal + inDirection;
        public static Vector2 Perpendicular(Vector2 inDirection) => new Vector2(-inDirection.y, inDirection.x);
        public static float Dot(Vector2 lhs, Vector2 rhs) => lhs.x * rhs.x + lhs.y * rhs.y;

        public static float Angle(Vector2 from, Vector2 to)
        {
            float denominator = (float)Math.Sqrt(from.sqrMagnitude * to.sqrMagnitude);
            if (denominator < kEpsilonNormalSqrt) return 0f;
            float dot = Mathf.Clamp(Dot(from, to) / denominator, -1f, 1f);
            return (float)Math.Acos(dot) * Mathf.Rad2Deg;
        }

        public static float SignedAngle(Vector2 from, Vector2 to)
        {
            float unsignedAngle = Angle(from, to);
            float sign = Math.Sign(from.x * to.y - from.y * to.x);
            return unsignedAngle * sign;
        }

        public static float Distance(Vector2 a, Vector2 b)
        {
            float dx = a.x - b.x, dy = a.y - b.y;
            return (float)Math.Sqrt(dx * dx + dy * dy);
        }

        public static Vector2 ClampMagnitude(Vector2 vector, float maxLength)
        {
            float sq = vector.sqrMagnitude;
            if (sq > maxLength * maxLength)
            {
                float mag = (float)Math.Sqrt(sq);
                return new Vector2(vector.x / mag * maxLength, vector.y / mag * maxLength);
            }
            return vector;
        }

        public static float SqrMagnitude(Vector2 a) => a.x * a.x + a.y * a.y;
        public float SqrMagnitude() => x * x + y * y;
        public static Vector2 Min(Vector2 lhs, Vector2 rhs) => new Vector2(Mathf.Min(lhs.x, rhs.x), Mathf.Min(lhs.y, rhs.y));
        public static Vector2 Max(Vector2 lhs, Vector2 rhs) => new Vector2(Mathf.Max(lhs.x, rhs.x), Mathf.Max(lhs.y, rhs.y));

        public static Vector2 SmoothDamp(Vector2 current, Vector2 target, ref Vector2 currentVelocity, float smoothTime, float maxSpeed, float deltaTime)
        {
            var c = (Vector3)current; var t = (Vector3)target; var v = (Vector3)currentVelocity;
            var r = Vector3.SmoothDamp(c, t, ref v, smoothTime, maxSpeed, deltaTime);
            currentVelocity = v;
            return r;
        }

        public static Vector2 operator +(Vector2 a, Vector2 b) => new Vector2(a.x + b.x, a.y + b.y);
        public static Vector2 operator -(Vector2 a, Vector2 b) => new Vector2(a.x - b.x, a.y - b.y);
        public static Vector2 operator *(Vector2 a, Vector2 b) => new Vector2(a.x * b.x, a.y * b.y);
        public static Vector2 operator /(Vector2 a, Vector2 b) => new Vector2(a.x / b.x, a.y / b.y);
        public static Vector2 operator -(Vector2 a) => new Vector2(-a.x, -a.y);
        public static Vector2 operator *(Vector2 a, float d) => new Vector2(a.x * d, a.y * d);
        public static Vector2 operator *(float d, Vector2 a) => new Vector2(a.x * d, a.y * d);
        public static Vector2 operator /(Vector2 a, float d) => new Vector2(a.x / d, a.y / d);

        public static bool operator ==(Vector2 lhs, Vector2 rhs)
        {
            float dx = lhs.x - rhs.x, dy = lhs.y - rhs.y;
            return dx * dx + dy * dy < kEpsilon * kEpsilon;
        }
        public static bool operator !=(Vector2 lhs, Vector2 rhs) => !(lhs == rhs);

        public static implicit operator Vector2(Vector3 v) => new Vector2(v.x, v.y);
        public static implicit operator Vector3(Vector2 v) => new Vector3(v.x, v.y, 0f);

        public bool Equals(Vector2 other) => x == other.x && y == other.y;
        public override bool Equals(object other) => other is Vector2 v && Equals(v);
        public override int GetHashCode() => x.GetHashCode() ^ (y.GetHashCode() << 2);

        public override string ToString() => string.Format(CultureInfo.InvariantCulture, "({0:F1}, {1:F1})", x, y);
        public string ToString(string format) => string.Format(CultureInfo.InvariantCulture, "({0}, {1})",
            x.ToString(format, CultureInfo.InvariantCulture), y.ToString(format, CultureInfo.InvariantCulture));
        public string ToString(string format, IFormatProvider formatProvider) => ToString(format);
    }

    public partial struct Vector4 : IEquatable<Vector4>, IFormattable
    {
        public const float kEpsilon = 0.00001f;

        public float x;
        public float y;
        public float z;
        public float w;

        public Vector4(float x, float y, float z, float w) { this.x = x; this.y = y; this.z = z; this.w = w; }
        public Vector4(float x, float y, float z) { this.x = x; this.y = y; this.z = z; w = 0f; }
        public Vector4(float x, float y) { this.x = x; this.y = y; z = 0f; w = 0f; }

        public float this[int index]
        {
            get => index switch { 0 => x, 1 => y, 2 => z, 3 => w, _ => throw new IndexOutOfRangeException("Invalid Vector4 index!") };
            set
            {
                switch (index)
                {
                    case 0: x = value; break;
                    case 1: y = value; break;
                    case 2: z = value; break;
                    case 3: w = value; break;
                    default: throw new IndexOutOfRangeException("Invalid Vector4 index!");
                }
            }
        }

        public void Set(float newX, float newY, float newZ, float newW) { x = newX; y = newY; z = newZ; w = newW; }

        public static Vector4 zero => new Vector4(0f, 0f, 0f, 0f);
        public static Vector4 one => new Vector4(1f, 1f, 1f, 1f);

        public float magnitude => (float)Math.Sqrt(Dot(this, this));
        public float sqrMagnitude => Dot(this, this);

        public Vector4 normalized => Normalize(this);

        public static Vector4 Normalize(Vector4 a)
        {
            float mag = a.magnitude;
            return mag > kEpsilon ? a / mag : zero;
        }

        public void Normalize() => this = Normalize(this);

        public static Vector4 Lerp(Vector4 a, Vector4 b, float t)
        {
            t = Mathf.Clamp01(t);
            return new Vector4(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, a.w + (b.w - a.w) * t);
        }

        public static Vector4 LerpUnclamped(Vector4 a, Vector4 b, float t) =>
            new Vector4(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, a.w + (b.w - a.w) * t);

        public static Vector4 Scale(Vector4 a, Vector4 b) => new Vector4(a.x * b.x, a.y * b.y, a.z * b.z, a.w * b.w);
        public static float Dot(Vector4 a, Vector4 b) => a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
        public static float Distance(Vector4 a, Vector4 b) => (a - b).magnitude;
        public static Vector4 Min(Vector4 l, Vector4 r) => new Vector4(Mathf.Min(l.x, r.x), Mathf.Min(l.y, r.y), Mathf.Min(l.z, r.z), Mathf.Min(l.w, r.w));
        public static Vector4 Max(Vector4 l, Vector4 r) => new Vector4(Mathf.Max(l.x, r.x), Mathf.Max(l.y, r.y), Mathf.Max(l.z, r.z), Mathf.Max(l.w, r.w));

        public static Vector4 operator +(Vector4 a, Vector4 b) => new Vector4(a.x + b.x, a.y + b.y, a.z + b.z, a.w + b.w);
        public static Vector4 operator -(Vector4 a, Vector4 b) => new Vector4(a.x - b.x, a.y - b.y, a.z - b.z, a.w - b.w);
        public static Vector4 operator -(Vector4 a) => new Vector4(-a.x, -a.y, -a.z, -a.w);
        public static Vector4 operator *(Vector4 a, float d) => new Vector4(a.x * d, a.y * d, a.z * d, a.w * d);
        public static Vector4 operator *(float d, Vector4 a) => new Vector4(a.x * d, a.y * d, a.z * d, a.w * d);
        public static Vector4 operator /(Vector4 a, float d) => new Vector4(a.x / d, a.y / d, a.z / d, a.w / d);

        public static bool operator ==(Vector4 lhs, Vector4 rhs)
        {
            float dx = lhs.x - rhs.x, dy = lhs.y - rhs.y, dz = lhs.z - rhs.z, dw = lhs.w - rhs.w;
            return dx * dx + dy * dy + dz * dz + dw * dw < kEpsilon * kEpsilon;
        }
        public static bool operator !=(Vector4 lhs, Vector4 rhs) => !(lhs == rhs);

        public static implicit operator Vector4(Vector3 v) => new Vector4(v.x, v.y, v.z, 0f);
        public static implicit operator Vector3(Vector4 v) => new Vector3(v.x, v.y, v.z);
        public static implicit operator Vector4(Vector2 v) => new Vector4(v.x, v.y, 0f, 0f);
        public static implicit operator Vector2(Vector4 v) => new Vector2(v.x, v.y);

        public bool Equals(Vector4 other) => x == other.x && y == other.y && z == other.z && w == other.w;
        public override bool Equals(object other) => other is Vector4 v && Equals(v);
        public override int GetHashCode() => x.GetHashCode() ^ (y.GetHashCode() << 2) ^ (z.GetHashCode() >> 2) ^ (w.GetHashCode() >> 1);

        public override string ToString() => string.Format(CultureInfo.InvariantCulture, "({0:F1}, {1:F1}, {2:F1}, {3:F1})", x, y, z, w);
        public string ToString(string format) => string.Format(CultureInfo.InvariantCulture, "({0}, {1}, {2}, {3})",
            x.ToString(format, CultureInfo.InvariantCulture), y.ToString(format, CultureInfo.InvariantCulture),
            z.ToString(format, CultureInfo.InvariantCulture), w.ToString(format, CultureInfo.InvariantCulture));
        public string ToString(string format, IFormatProvider formatProvider) => ToString(format);
    }
}

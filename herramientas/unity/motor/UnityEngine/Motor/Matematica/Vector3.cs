using System;
using System.Globalization;

namespace UnityEngine
{
    public partial struct Vector3 : IEquatable<Vector3>, IFormattable
    {
        public const float kEpsilon = 0.00001f;
        public const float kEpsilonNormalSqrt = 1e-15f;

        public float x;
        public float y;
        public float z;

        public Vector3(float x, float y, float z) { this.x = x; this.y = y; this.z = z; }
        public Vector3(float x, float y) { this.x = x; this.y = y; z = 0f; }

        public float this[int index]
        {
            get => index switch { 0 => x, 1 => y, 2 => z, _ => throw new IndexOutOfRangeException("Invalid Vector3 index!") };
            set
            {
                switch (index)
                {
                    case 0: x = value; break;
                    case 1: y = value; break;
                    case 2: z = value; break;
                    default: throw new IndexOutOfRangeException("Invalid Vector3 index!");
                }
            }
        }

        public void Set(float newX, float newY, float newZ) { x = newX; y = newY; z = newZ; }

        public static readonly Vector3 zeroVector = new Vector3(0f, 0f, 0f);
        public static Vector3 zero => new Vector3(0f, 0f, 0f);
        public static Vector3 one => new Vector3(1f, 1f, 1f);
        public static Vector3 forward => new Vector3(0f, 0f, 1f);
        public static Vector3 back => new Vector3(0f, 0f, -1f);
        public static Vector3 up => new Vector3(0f, 1f, 0f);
        public static Vector3 down => new Vector3(0f, -1f, 0f);
        public static Vector3 left => new Vector3(-1f, 0f, 0f);
        public static Vector3 right => new Vector3(1f, 0f, 0f);
        public static Vector3 positiveInfinity => new Vector3(float.PositiveInfinity, float.PositiveInfinity, float.PositiveInfinity);
        public static Vector3 negativeInfinity => new Vector3(float.NegativeInfinity, float.NegativeInfinity, float.NegativeInfinity);

        public float magnitude => (float)Math.Sqrt(x * x + y * y + z * z);
        public float sqrMagnitude => x * x + y * y + z * z;
        public Vector3 normalized => Normalize(this);

        public static float Magnitude(Vector3 vector) => (float)Math.Sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
        public static float SqrMagnitude(Vector3 vector) => vector.x * vector.x + vector.y * vector.y + vector.z * vector.z;

        public static Vector3 Normalize(Vector3 value)
        {
            float mag = Magnitude(value);
            if (mag > kEpsilon) return value / mag;
            return zero;
        }

        public void Normalize()
        {
            float mag = Magnitude(this);
            if (mag > kEpsilon) this = this / mag; else this = zero;
        }

        public static Vector3 Lerp(Vector3 a, Vector3 b, float t)
        {
            t = Mathf.Clamp01(t);
            return new Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
        }

        public static Vector3 LerpUnclamped(Vector3 a, Vector3 b, float t) =>
            new Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);

        public static Vector3 MoveTowards(Vector3 current, Vector3 target, float maxDistanceDelta)
        {
            float tx = target.x - current.x, ty = target.y - current.y, tz = target.z - current.z;
            float sq = tx * tx + ty * ty + tz * tz;
            if (sq == 0 || (maxDistanceDelta >= 0 && sq <= maxDistanceDelta * maxDistanceDelta)) return target;
            float dist = (float)Math.Sqrt(sq);
            return new Vector3(current.x + tx / dist * maxDistanceDelta, current.y + ty / dist * maxDistanceDelta, current.z + tz / dist * maxDistanceDelta);
        }

        // Como el Vector3.Slerp nativo: gira la dirección y mezcla el largo.
        public static Vector3 Slerp(Vector3 a, Vector3 b, float t) => SlerpUnclamped(a, b, Mathf.Clamp01(t));

        public static Vector3 SlerpUnclamped(Vector3 a, Vector3 b, float t)
        {
            float magA = a.magnitude, magB = b.magnitude;
            if (magA < kEpsilon || magB < kEpsilon) return LerpUnclamped(a, b, t);
            float mag = magA + (magB - magA) * t;
            float dot = Mathf.Clamp(Dot(a, b) / (magA * magB), -1f, 1f);
            Vector3 na = a / magA;
            if (dot > 1f - kEpsilon) return LerpUnclamped(a, b, t);
            Vector3 eje;
            float angulo;
            if (dot < -1f + kEpsilon)
            {
                eje = OrtogonalCualquiera(na);
                angulo = Mathf.PI * t;
            }
            else
            {
                eje = Normalize(Cross(a, b));
                angulo = (float)Math.Acos(dot) * t;
            }
            return Quaternion.AngleAxis(angulo * Mathf.Rad2Deg, eje) * na * mag;
        }

        internal static Vector3 OrtogonalCualquiera(Vector3 n)
        {
            // como OrthoNormalVectorFast de Unity
            const float k = 0.707106781f;
            if (Math.Abs(n.z) > k)
            {
                float a = n.y * n.y + n.z * n.z, s = 1f / (float)Math.Sqrt(a);
                return new Vector3(0f, -n.z * s, n.y * s);
            }
            else
            {
                float a = n.x * n.x + n.y * n.y, s = 1f / (float)Math.Sqrt(a);
                return new Vector3(-n.y * s, n.x * s, 0f);
            }
        }

        public static void OrthoNormalize(ref Vector3 normal, ref Vector3 tangent)
        {
            normal = Normalize(normal);
            if (normal == zero) normal = right;
            tangent -= normal * Dot(normal, tangent);
            float mag = tangent.magnitude;
            if (mag < kEpsilon) tangent = OrtogonalCualquiera(normal); else tangent /= mag;
        }

        public static void OrthoNormalize(ref Vector3 normal, ref Vector3 tangent, ref Vector3 binormal)
        {
            OrthoNormalize(ref normal, ref tangent);
            binormal -= normal * Dot(normal, binormal);
            binormal -= tangent * Dot(tangent, binormal);
            float mag = binormal.magnitude;
            binormal = mag < kEpsilon ? Cross(normal, tangent) : binormal / mag;
        }

        public static Vector3 RotateTowards(Vector3 current, Vector3 target, float maxRadiansDelta, float maxMagnitudeDelta)
        {
            float magC = current.magnitude, magT = target.magnitude;
            if (magC > kEpsilon && magT > kEpsilon)
            {
                Vector3 nc = current / magC, nt = target / magT;
                float dot = Mathf.Clamp(Dot(nc, nt), -1f, 1f);
                float angulo = (float)Math.Acos(dot);
                float mag = Mathf.MoveTowards(magC, magT, maxMagnitudeDelta);
                if (angulo <= maxRadiansDelta) return nt * mag;
                Vector3 eje = dot < -1f + kEpsilon ? OrtogonalCualquiera(nc) : Normalize(Cross(nc, nt));
                return Quaternion.AngleAxis(maxRadiansDelta * Mathf.Rad2Deg, eje) * nc * mag;
            }
            return MoveTowards(current, target, maxMagnitudeDelta);
        }

        public static Vector3 SmoothDamp(Vector3 current, Vector3 target, ref Vector3 currentVelocity, float smoothTime) =>
            SmoothDamp(current, target, ref currentVelocity, smoothTime, Mathf.Infinity, Time.deltaTime);

        public static Vector3 SmoothDamp(Vector3 current, Vector3 target, ref Vector3 currentVelocity, float smoothTime, float maxSpeed) =>
            SmoothDamp(current, target, ref currentVelocity, smoothTime, maxSpeed, Time.deltaTime);

        public static Vector3 SmoothDamp(Vector3 current, Vector3 target, ref Vector3 currentVelocity, float smoothTime, float maxSpeed, float deltaTime)
        {
            smoothTime = Mathf.Max(0.0001f, smoothTime);
            float omega = 2f / smoothTime;
            float x = omega * deltaTime;
            float exp = 1f / (1f + x + 0.48f * x * x + 0.235f * x * x * x);
            float cx = current.x - target.x, cy = current.y - target.y, cz = current.z - target.z;
            Vector3 originalTo = target;
            float maxChange = maxSpeed * smoothTime, maxChangeSq = maxChange * maxChange;
            float sqrmag = cx * cx + cy * cy + cz * cz;
            if (sqrmag > maxChangeSq)
            {
                float mag = (float)Math.Sqrt(sqrmag);
                cx = cx / mag * maxChange; cy = cy / mag * maxChange; cz = cz / mag * maxChange;
            }
            target.x = current.x - cx; target.y = current.y - cy; target.z = current.z - cz;
            float tx = (currentVelocity.x + omega * cx) * deltaTime;
            float ty = (currentVelocity.y + omega * cy) * deltaTime;
            float tz = (currentVelocity.z + omega * cz) * deltaTime;
            currentVelocity.x = (currentVelocity.x - omega * tx) * exp;
            currentVelocity.y = (currentVelocity.y - omega * ty) * exp;
            currentVelocity.z = (currentVelocity.z - omega * tz) * exp;
            float ox = target.x + (cx + tx) * exp, oy = target.y + (cy + ty) * exp, oz = target.z + (cz + tz) * exp;
            float origMinusCurrentX = originalTo.x - current.x, origMinusCurrentY = originalTo.y - current.y, origMinusCurrentZ = originalTo.z - current.z;
            float outMinusOrigX = ox - originalTo.x, outMinusOrigY = oy - originalTo.y, outMinusOrigZ = oz - originalTo.z;
            if (origMinusCurrentX * outMinusOrigX + origMinusCurrentY * outMinusOrigY + origMinusCurrentZ * outMinusOrigZ > 0)
            {
                ox = originalTo.x; oy = originalTo.y; oz = originalTo.z;
                currentVelocity.x = (ox - originalTo.x) / deltaTime;
                currentVelocity.y = (oy - originalTo.y) / deltaTime;
                currentVelocity.z = (oz - originalTo.z) / deltaTime;
            }
            return new Vector3(ox, oy, oz);
        }

        public static Vector3 Scale(Vector3 a, Vector3 b) => new Vector3(a.x * b.x, a.y * b.y, a.z * b.z);
        public void Scale(Vector3 scale) { x *= scale.x; y *= scale.y; z *= scale.z; }

        public static Vector3 Cross(Vector3 lhs, Vector3 rhs) =>
            new Vector3(lhs.y * rhs.z - lhs.z * rhs.y, lhs.z * rhs.x - lhs.x * rhs.z, lhs.x * rhs.y - lhs.y * rhs.x);

        public static Vector3 Reflect(Vector3 inDirection, Vector3 inNormal) => -2f * Dot(inNormal, inDirection) * inNormal + inDirection;

        public static float Dot(Vector3 lhs, Vector3 rhs) => lhs.x * rhs.x + lhs.y * rhs.y + lhs.z * rhs.z;

        public static Vector3 Project(Vector3 vector, Vector3 onNormal)
        {
            float sqrMag = Dot(onNormal, onNormal);
            if (sqrMag < Mathf.Epsilon) return zero;
            float dot = Dot(vector, onNormal);
            return new Vector3(onNormal.x * dot / sqrMag, onNormal.y * dot / sqrMag, onNormal.z * dot / sqrMag);
        }

        public static Vector3 ProjectOnPlane(Vector3 vector, Vector3 planeNormal) => vector - Project(vector, planeNormal);

        public static float Angle(Vector3 from, Vector3 to)
        {
            float denominator = (float)Math.Sqrt(from.sqrMagnitude * to.sqrMagnitude);
            if (denominator < kEpsilonNormalSqrt) return 0f;
            float dot = Mathf.Clamp(Dot(from, to) / denominator, -1f, 1f);
            return (float)Math.Acos(dot) * Mathf.Rad2Deg;
        }

        public static float SignedAngle(Vector3 from, Vector3 to, Vector3 axis)
        {
            float unsignedAngle = Angle(from, to);
            float cx = from.y * to.z - from.z * to.y, cy = from.z * to.x - from.x * to.z, cz = from.x * to.y - from.y * to.x;
            float sign = Math.Sign(axis.x * cx + axis.y * cy + axis.z * cz);
            return unsignedAngle * sign;
        }

        public static float Distance(Vector3 a, Vector3 b)
        {
            float dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
            return (float)Math.Sqrt(dx * dx + dy * dy + dz * dz);
        }

        public static Vector3 ClampMagnitude(Vector3 vector, float maxLength)
        {
            float sq = vector.sqrMagnitude;
            if (sq > maxLength * maxLength)
            {
                float mag = (float)Math.Sqrt(sq);
                return new Vector3(vector.x / mag * maxLength, vector.y / mag * maxLength, vector.z / mag * maxLength);
            }
            return vector;
        }

        public static Vector3 Min(Vector3 lhs, Vector3 rhs) => new Vector3(Mathf.Min(lhs.x, rhs.x), Mathf.Min(lhs.y, rhs.y), Mathf.Min(lhs.z, rhs.z));
        public static Vector3 Max(Vector3 lhs, Vector3 rhs) => new Vector3(Mathf.Max(lhs.x, rhs.x), Mathf.Max(lhs.y, rhs.y), Mathf.Max(lhs.z, rhs.z));

        public static Vector3 operator +(Vector3 a, Vector3 b) => new Vector3(a.x + b.x, a.y + b.y, a.z + b.z);
        public static Vector3 operator -(Vector3 a, Vector3 b) => new Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
        public static Vector3 operator -(Vector3 a) => new Vector3(-a.x, -a.y, -a.z);
        public static Vector3 operator *(Vector3 a, float d) => new Vector3(a.x * d, a.y * d, a.z * d);
        public static Vector3 operator *(float d, Vector3 a) => new Vector3(a.x * d, a.y * d, a.z * d);
        public static Vector3 operator /(Vector3 a, float d) => new Vector3(a.x / d, a.y / d, a.z / d);

        public static bool operator ==(Vector3 lhs, Vector3 rhs)
        {
            float dx = lhs.x - rhs.x, dy = lhs.y - rhs.y, dz = lhs.z - rhs.z;
            return dx * dx + dy * dy + dz * dz < kEpsilon * kEpsilon;
        }
        public static bool operator !=(Vector3 lhs, Vector3 rhs) => !(lhs == rhs);

        public bool Equals(Vector3 other) => x == other.x && y == other.y && z == other.z;
        public override bool Equals(object other) => other is Vector3 v && Equals(v);
        public override int GetHashCode() => x.GetHashCode() ^ (y.GetHashCode() << 2) ^ (z.GetHashCode() >> 2);

        public override string ToString() => string.Format(CultureInfo.InvariantCulture, "({0:F1}, {1:F1}, {2:F1})", x, y, z);
        public string ToString(string format) => string.Format(CultureInfo.InvariantCulture, "({0}, {1}, {2})",
            x.ToString(format, CultureInfo.InvariantCulture), y.ToString(format, CultureInfo.InvariantCulture), z.ToString(format, CultureInfo.InvariantCulture));
        public string ToString(string format, IFormatProvider formatProvider) => ToString(format);
    }
}

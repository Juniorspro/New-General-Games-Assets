using System;
using System.Globalization;

namespace UnityEngine
{
    // Los ángulos de Euler de Unity son ZXY: primero se gira en Z, después en X y al final en Y
    // (q = qY · qX · qZ). eulerAngles los saca de la matriz con ese mismo orden.
    public partial struct Quaternion : IEquatable<Quaternion>, IFormattable
    {
        public const float kEpsilon = 0.000001f;

        public float x;
        public float y;
        public float z;
        public float w;

        public Quaternion(float x, float y, float z, float w) { this.x = x; this.y = y; this.z = z; this.w = w; }

        public float this[int index]
        {
            get => index switch { 0 => x, 1 => y, 2 => z, 3 => w, _ => throw new IndexOutOfRangeException("Invalid Quaternion index!") };
            set
            {
                switch (index)
                {
                    case 0: x = value; break;
                    case 1: y = value; break;
                    case 2: z = value; break;
                    case 3: w = value; break;
                    default: throw new IndexOutOfRangeException("Invalid Quaternion index!");
                }
            }
        }

        public void Set(float newX, float newY, float newZ, float newW) { x = newX; y = newY; z = newZ; w = newW; }

        public static Quaternion identity => new Quaternion(0f, 0f, 0f, 1f);

        public static Quaternion operator *(Quaternion lhs, Quaternion rhs) => new Quaternion(
            lhs.w * rhs.x + lhs.x * rhs.w + lhs.y * rhs.z - lhs.z * rhs.y,
            lhs.w * rhs.y + lhs.y * rhs.w + lhs.z * rhs.x - lhs.x * rhs.z,
            lhs.w * rhs.z + lhs.z * rhs.w + lhs.x * rhs.y - lhs.y * rhs.x,
            lhs.w * rhs.w - lhs.x * rhs.x - lhs.y * rhs.y - lhs.z * rhs.z);

        public static Vector3 operator *(Quaternion rotation, Vector3 point)
        {
            float x = rotation.x * 2f, y = rotation.y * 2f, z = rotation.z * 2f;
            float xx = rotation.x * x, yy = rotation.y * y, zz = rotation.z * z;
            float xy = rotation.x * y, xz = rotation.x * z, yz = rotation.y * z;
            float wx = rotation.w * x, wy = rotation.w * y, wz = rotation.w * z;
            Vector3 res;
            res.x = (1f - (yy + zz)) * point.x + (xy - wz) * point.y + (xz + wy) * point.z;
            res.y = (xy + wz) * point.x + (1f - (xx + zz)) * point.y + (yz - wx) * point.z;
            res.z = (xz - wy) * point.x + (yz + wx) * point.y + (1f - (xx + yy)) * point.z;
            return res;
        }

        static bool IsEqualUsingDot(float dot) => dot > 1.0f - kEpsilon;

        public static bool operator ==(Quaternion lhs, Quaternion rhs) => IsEqualUsingDot(Dot(lhs, rhs));
        public static bool operator !=(Quaternion lhs, Quaternion rhs) => !(lhs == rhs);

        public static float Dot(Quaternion a, Quaternion b) => a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;

        public static float Angle(Quaternion a, Quaternion b)
        {
            float dot = Dot(a, b);
            return IsEqualUsingDot(dot) ? 0f : Mathf.Acos(Mathf.Min(Mathf.Abs(dot), 1f)) * 2f * Mathf.Rad2Deg;
        }

        public static Quaternion Normalize(Quaternion q)
        {
            float mag = (float)Math.Sqrt(Dot(q, q));
            if (mag < Mathf.Epsilon) return identity;
            return new Quaternion(q.x / mag, q.y / mag, q.z / mag, q.w / mag);
        }

        public void Normalize() => this = Normalize(this);
        public Quaternion normalized => Normalize(this);

        public static Quaternion Inverse(Quaternion rotation)
        {
            float n = Dot(rotation, rotation);
            if (n < Mathf.Epsilon) return identity;
            float i = 1f / n;
            return new Quaternion(-rotation.x * i, -rotation.y * i, -rotation.z * i, rotation.w * i);
        }

        public static Quaternion Lerp(Quaternion a, Quaternion b, float t) => LerpUnclamped(a, b, Mathf.Clamp01(t));

        public static Quaternion LerpUnclamped(Quaternion a, Quaternion b, float t)
        {
            Quaternion r;
            if (Dot(a, b) < 0f)
                r = new Quaternion(a.x + t * (-b.x - a.x), a.y + t * (-b.y - a.y), a.z + t * (-b.z - a.z), a.w + t * (-b.w - a.w));
            else
                r = new Quaternion(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y), a.z + t * (b.z - a.z), a.w + t * (b.w - a.w));
            return Normalize(r);
        }

        public static Quaternion Slerp(Quaternion a, Quaternion b, float t) => SlerpUnclamped(a, b, Mathf.Clamp01(t));

        public static Quaternion SlerpUnclamped(Quaternion a, Quaternion b, float t)
        {
            float dot = Dot(a, b);
            Quaternion tmp;
            if (dot < 0f) { dot = -dot; tmp = new Quaternion(-b.x, -b.y, -b.z, -b.w); }
            else tmp = b;
            if (dot < 0.95f)
            {
                float angle = (float)Math.Acos(dot);
                float sinadiv = 1f / (float)Math.Sin(angle);
                float sinat = (float)Math.Sin(angle * t);
                float sinaomt = (float)Math.Sin(angle * (1f - t));
                return new Quaternion((a.x * sinaomt + tmp.x * sinat) * sinadiv, (a.y * sinaomt + tmp.y * sinat) * sinadiv,
                    (a.z * sinaomt + tmp.z * sinat) * sinadiv, (a.w * sinaomt + tmp.w * sinat) * sinadiv);
            }
            return LerpUnclamped(a, tmp, t);
        }

        public static Quaternion RotateTowards(Quaternion from, Quaternion to, float maxDegreesDelta)
        {
            float angle = Angle(from, to);
            if (angle == 0f) return to;
            return SlerpUnclamped(from, to, Mathf.Min(1f, maxDegreesDelta / angle));
        }

        public static Quaternion AngleAxis(float angle, Vector3 axis)
        {
            float mag = axis.magnitude;
            if (mag < Vector3.kEpsilon) return identity;
            axis /= mag;
            float half = angle * Mathf.Deg2Rad * 0.5f;
            float s = (float)Math.Sin(half);
            return new Quaternion(axis.x * s, axis.y * s, axis.z * s, (float)Math.Cos(half));
        }

        public void ToAngleAxis(out float angle, out Vector3 axis)
        {
            var q = Normalize(this);
            angle = 2f * (float)Math.Acos(Mathf.Clamp(q.w, -1f, 1f));
            float s = (float)Math.Sqrt(1f - q.w * q.w);
            axis = s < 0.00001f ? Vector3.right : new Vector3(q.x / s, q.y / s, q.z / s);
            angle *= Mathf.Rad2Deg;
        }

        public static Quaternion FromToRotation(Vector3 fromDirection, Vector3 toDirection)
        {
            Vector3 from = Vector3.Normalize(fromDirection), to = Vector3.Normalize(toDirection);
            if (from == Vector3.zero || to == Vector3.zero) return identity;
            float d = Vector3.Dot(from, to);
            if (d >= 1f - kEpsilon) return identity;
            if (d <= -1f + kEpsilon)
            {
                Vector3 eje = Vector3.Cross(Vector3.right, from);
                if (eje.sqrMagnitude < 1e-6f) eje = Vector3.Cross(Vector3.up, from);
                return AngleAxis(180f, eje.normalized);
            }
            Vector3 c = Vector3.Cross(from, to);
            float s = (float)Math.Sqrt((1f + d) * 2f), invs = 1f / s;
            return Normalize(new Quaternion(c.x * invs, c.y * invs, c.z * invs, s * 0.5f));
        }

        public void SetFromToRotation(Vector3 fromDirection, Vector3 toDirection) => this = FromToRotation(fromDirection, toDirection);

        public static Quaternion LookRotation(Vector3 forward) => LookRotation(forward, Vector3.up);

        // Como LookRotationToQuaternion de Unity: arma la base (z adelante, x = arriba × z, y = z × x).
        public static Quaternion LookRotation(Vector3 forward, Vector3 upwards)
        {
            float mag = forward.magnitude;
            if (mag < Vector3.kEpsilon)
            {
                Debug.Log("Look rotation viewing vector is zero");
                return identity;
            }
            Vector3 z = forward / mag;
            Vector3 x = Vector3.Cross(upwards, z);
            float mx = x.magnitude;
            if (mx < Vector3.kEpsilon)
            {
                // arriba paralelo a adelante: Unity usa la rotación mínima desde +Z
                return FromToRotation(Vector3.forward, z);
            }
            x /= mx;
            Vector3 y = Vector3.Cross(z, x);
            return DeMatriz(x.x, y.x, z.x, x.y, y.y, z.y, x.z, y.z, z.z);
        }

        public void SetLookRotation(Vector3 view) => this = LookRotation(view);
        public void SetLookRotation(Vector3 view, Vector3 up) => this = LookRotation(view, up);

        // matriz 3x3 (filas) → cuaternión (Shoemake)
        internal static Quaternion DeMatriz(float m00, float m01, float m02, float m10, float m11, float m12, float m20, float m21, float m22)
        {
            float traza = m00 + m11 + m22;
            Quaternion q;
            if (traza > 0f)
            {
                float s = (float)Math.Sqrt(traza + 1f) * 2f;
                q = new Quaternion((m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25f * s);
            }
            else if (m00 > m11 && m00 > m22)
            {
                float s = (float)Math.Sqrt(1f + m00 - m11 - m22) * 2f;
                q = new Quaternion(0.25f * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s);
            }
            else if (m11 > m22)
            {
                float s = (float)Math.Sqrt(1f + m11 - m00 - m22) * 2f;
                q = new Quaternion((m01 + m10) / s, 0.25f * s, (m12 + m21) / s, (m02 - m20) / s);
            }
            else
            {
                float s = (float)Math.Sqrt(1f + m22 - m00 - m11) * 2f;
                q = new Quaternion((m02 + m20) / s, (m12 + m21) / s, 0.25f * s, (m10 - m01) / s);
            }
            return Normalize(q);
        }

        public static Quaternion Euler(float x, float y, float z) => DeEulerRad(new Vector3(x, y, z) * Mathf.Deg2Rad);
        public static Quaternion Euler(Vector3 euler) => DeEulerRad(euler * Mathf.Deg2Rad);

        static Quaternion DeEulerRad(Vector3 e)
        {
            float cx = (float)Math.Cos(e.x * 0.5f), sx = (float)Math.Sin(e.x * 0.5f);
            float cy = (float)Math.Cos(e.y * 0.5f), sy = (float)Math.Sin(e.y * 0.5f);
            float cz = (float)Math.Cos(e.z * 0.5f), sz = (float)Math.Sin(e.z * 0.5f);
            var qx = new Quaternion(sx, 0f, 0f, cx);
            var qy = new Quaternion(0f, sy, 0f, cy);
            var qz = new Quaternion(0f, 0f, sz, cz);
            return qy * qx * qz;
        }

        public Vector3 eulerAngles
        {
            get => HaciaEuler(this);
            set => this = Euler(value);
        }

        static Vector3 HaciaEuler(Quaternion q)
        {
            q = Normalize(q);
            // las filas de la matriz que hacen falta (vectores columna)
            float xx = q.x * q.x, yy = q.y * q.y, zz = q.z * q.z;
            float xy = q.x * q.y, xz = q.x * q.z, yz = q.y * q.z, wx = q.w * q.x, wy = q.w * q.y, wz = q.w * q.z;
            float m00 = 1f - 2f * (yy + zz), m01 = 2f * (xy - wz), m02 = 2f * (xz + wy);
            float m10 = 2f * (xy + wz), m11 = 1f - 2f * (xx + zz), m12 = 2f * (yz - wx);
            float m22 = 1f - 2f * (xx + yy);
            float rx, ry, rz;
            if (m12 < 0.999f)
            {
                if (m12 > -0.999f)
                {
                    rx = (float)Math.Asin(-m12);
                    ry = (float)Math.Atan2(m02, m22);
                    rz = (float)Math.Atan2(m10, m11);
                }
                else
                {
                    rx = Mathf.PI * 0.5f;
                    ry = (float)Math.Atan2(m01, m00);
                    rz = 0f;
                }
            }
            else
            {
                rx = -Mathf.PI * 0.5f;
                ry = (float)Math.Atan2(-m01, m00);
                rz = 0f;
            }
            return HacerPositivo(new Vector3(rx, ry, rz) * Mathf.Rad2Deg);
        }

        static Vector3 HacerPositivo(Vector3 e)
        {
            const float negativeFlip = -0.0001f * Mathf.Rad2Deg;
            const float positiveFlip = 360f + negativeFlip;
            if (e.x < negativeFlip) e.x += 360f; else if (e.x > positiveFlip) e.x -= 360f;
            if (e.y < negativeFlip) e.y += 360f; else if (e.y > positiveFlip) e.y -= 360f;
            if (e.z < negativeFlip) e.z += 360f; else if (e.z > positiveFlip) e.z -= 360f;
            return e;
        }

        public bool Equals(Quaternion other) => x.Equals(other.x) && y.Equals(other.y) && z.Equals(other.z) && w.Equals(other.w);
        public override bool Equals(object other) => other is Quaternion q && Equals(q);
        public override int GetHashCode() => x.GetHashCode() ^ (y.GetHashCode() << 2) ^ (z.GetHashCode() >> 2) ^ (w.GetHashCode() >> 1);

        public override string ToString() => string.Format(CultureInfo.InvariantCulture, "({0:F1}, {1:F1}, {2:F1}, {3:F1})", x, y, z, w);
        public string ToString(string format) => string.Format(CultureInfo.InvariantCulture, "({0}, {1}, {2}, {3})",
            x.ToString(format, CultureInfo.InvariantCulture), y.ToString(format, CultureInfo.InvariantCulture),
            z.ToString(format, CultureInfo.InvariantCulture), w.ToString(format, CultureInfo.InvariantCulture));
        public string ToString(string format, IFormatProvider formatProvider) => ToString(format);
    }
}

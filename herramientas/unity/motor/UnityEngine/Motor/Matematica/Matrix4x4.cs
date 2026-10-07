using System;
using System.Globalization;

namespace UnityEngine
{
    // mFC: F fila, C columna; en memoria va por columnas (m00, m10, m20, m30, m01...), como en Unity.
    public partial struct Matrix4x4 : IEquatable<Matrix4x4>, IFormattable
    {
        public float m00;
        public float m10;
        public float m20;
        public float m30;
        public float m01;
        public float m11;
        public float m21;
        public float m31;
        public float m02;
        public float m12;
        public float m22;
        public float m32;
        public float m03;
        public float m13;
        public float m23;
        public float m33;

        public Matrix4x4(Vector4 column0, Vector4 column1, Vector4 column2, Vector4 column3)
        {
            m00 = column0.x; m01 = column1.x; m02 = column2.x; m03 = column3.x;
            m10 = column0.y; m11 = column1.y; m12 = column2.y; m13 = column3.y;
            m20 = column0.z; m21 = column1.z; m22 = column2.z; m23 = column3.z;
            m30 = column0.w; m31 = column1.w; m32 = column2.w; m33 = column3.w;
        }

        public float this[int row, int column]
        {
            get => this[row + column * 4];
            set => this[row + column * 4] = value;
        }

        public float this[int index]
        {
            get => index switch
            {
                0 => m00, 1 => m10, 2 => m20, 3 => m30, 4 => m01, 5 => m11, 6 => m21, 7 => m31,
                8 => m02, 9 => m12, 10 => m22, 11 => m32, 12 => m03, 13 => m13, 14 => m23, 15 => m33,
                _ => throw new IndexOutOfRangeException("Invalid matrix index!"),
            };
            set
            {
                switch (index)
                {
                    case 0: m00 = value; break; case 1: m10 = value; break; case 2: m20 = value; break; case 3: m30 = value; break;
                    case 4: m01 = value; break; case 5: m11 = value; break; case 6: m21 = value; break; case 7: m31 = value; break;
                    case 8: m02 = value; break; case 9: m12 = value; break; case 10: m22 = value; break; case 11: m32 = value; break;
                    case 12: m03 = value; break; case 13: m13 = value; break; case 14: m23 = value; break; case 15: m33 = value; break;
                    default: throw new IndexOutOfRangeException("Invalid matrix index!");
                }
            }
        }

        public static Matrix4x4 zero => default;
        public static Matrix4x4 identity => new Matrix4x4 { m00 = 1f, m11 = 1f, m22 = 1f, m33 = 1f };

        public static Matrix4x4 operator *(Matrix4x4 lhs, Matrix4x4 rhs)
        {
            Matrix4x4 r;
            r.m00 = lhs.m00 * rhs.m00 + lhs.m01 * rhs.m10 + lhs.m02 * rhs.m20 + lhs.m03 * rhs.m30;
            r.m01 = lhs.m00 * rhs.m01 + lhs.m01 * rhs.m11 + lhs.m02 * rhs.m21 + lhs.m03 * rhs.m31;
            r.m02 = lhs.m00 * rhs.m02 + lhs.m01 * rhs.m12 + lhs.m02 * rhs.m22 + lhs.m03 * rhs.m32;
            r.m03 = lhs.m00 * rhs.m03 + lhs.m01 * rhs.m13 + lhs.m02 * rhs.m23 + lhs.m03 * rhs.m33;
            r.m10 = lhs.m10 * rhs.m00 + lhs.m11 * rhs.m10 + lhs.m12 * rhs.m20 + lhs.m13 * rhs.m30;
            r.m11 = lhs.m10 * rhs.m01 + lhs.m11 * rhs.m11 + lhs.m12 * rhs.m21 + lhs.m13 * rhs.m31;
            r.m12 = lhs.m10 * rhs.m02 + lhs.m11 * rhs.m12 + lhs.m12 * rhs.m22 + lhs.m13 * rhs.m32;
            r.m13 = lhs.m10 * rhs.m03 + lhs.m11 * rhs.m13 + lhs.m12 * rhs.m23 + lhs.m13 * rhs.m33;
            r.m20 = lhs.m20 * rhs.m00 + lhs.m21 * rhs.m10 + lhs.m22 * rhs.m20 + lhs.m23 * rhs.m30;
            r.m21 = lhs.m20 * rhs.m01 + lhs.m21 * rhs.m11 + lhs.m22 * rhs.m21 + lhs.m23 * rhs.m31;
            r.m22 = lhs.m20 * rhs.m02 + lhs.m21 * rhs.m12 + lhs.m22 * rhs.m22 + lhs.m23 * rhs.m32;
            r.m23 = lhs.m20 * rhs.m03 + lhs.m21 * rhs.m13 + lhs.m22 * rhs.m23 + lhs.m23 * rhs.m33;
            r.m30 = lhs.m30 * rhs.m00 + lhs.m31 * rhs.m10 + lhs.m32 * rhs.m20 + lhs.m33 * rhs.m30;
            r.m31 = lhs.m30 * rhs.m01 + lhs.m31 * rhs.m11 + lhs.m32 * rhs.m21 + lhs.m33 * rhs.m31;
            r.m32 = lhs.m30 * rhs.m02 + lhs.m31 * rhs.m12 + lhs.m32 * rhs.m22 + lhs.m33 * rhs.m32;
            r.m33 = lhs.m30 * rhs.m03 + lhs.m31 * rhs.m13 + lhs.m32 * rhs.m23 + lhs.m33 * rhs.m33;
            return r;
        }

        public static Vector4 operator *(Matrix4x4 lhs, Vector4 v) => new Vector4(
            lhs.m00 * v.x + lhs.m01 * v.y + lhs.m02 * v.z + lhs.m03 * v.w,
            lhs.m10 * v.x + lhs.m11 * v.y + lhs.m12 * v.z + lhs.m13 * v.w,
            lhs.m20 * v.x + lhs.m21 * v.y + lhs.m22 * v.z + lhs.m23 * v.w,
            lhs.m30 * v.x + lhs.m31 * v.y + lhs.m32 * v.z + lhs.m33 * v.w);

        public static bool operator ==(Matrix4x4 lhs, Matrix4x4 rhs) =>
            lhs.GetColumn(0) == rhs.GetColumn(0) && lhs.GetColumn(1) == rhs.GetColumn(1) && lhs.GetColumn(2) == rhs.GetColumn(2) && lhs.GetColumn(3) == rhs.GetColumn(3);
        public static bool operator !=(Matrix4x4 lhs, Matrix4x4 rhs) => !(lhs == rhs);

        public Vector4 GetColumn(int index) => new Vector4(this[0, index], this[1, index], this[2, index], this[3, index]);
        public Vector4 GetRow(int index) => new Vector4(this[index, 0], this[index, 1], this[index, 2], this[index, 3]);

        public void SetColumn(int index, Vector4 column)
        {
            this[0, index] = column.x; this[1, index] = column.y; this[2, index] = column.z; this[3, index] = column.w;
        }

        public void SetRow(int index, Vector4 row)
        {
            this[index, 0] = row.x; this[index, 1] = row.y; this[index, 2] = row.z; this[index, 3] = row.w;
        }

        public Vector3 MultiplyPoint(Vector3 point)
        {
            Vector3 r;
            r.x = m00 * point.x + m01 * point.y + m02 * point.z + m03;
            r.y = m10 * point.x + m11 * point.y + m12 * point.z + m13;
            r.z = m20 * point.x + m21 * point.y + m22 * point.z + m23;
            float w = m30 * point.x + m31 * point.y + m32 * point.z + m33;
            w = 1f / w;
            r.x *= w; r.y *= w; r.z *= w;
            return r;
        }

        public Vector3 MultiplyPoint3x4(Vector3 point) => new Vector3(
            m00 * point.x + m01 * point.y + m02 * point.z + m03,
            m10 * point.x + m11 * point.y + m12 * point.z + m13,
            m20 * point.x + m21 * point.y + m22 * point.z + m23);

        public Vector3 MultiplyVector(Vector3 vector) => new Vector3(
            m00 * vector.x + m01 * vector.y + m02 * vector.z,
            m10 * vector.x + m11 * vector.y + m12 * vector.z,
            m20 * vector.x + m21 * vector.y + m22 * vector.z);

        public static Matrix4x4 Translate(Vector3 v)
        {
            var m = identity; m.m03 = v.x; m.m13 = v.y; m.m23 = v.z; return m;
        }

        public static Matrix4x4 Scale(Vector3 v)
        {
            var m = default(Matrix4x4); m.m00 = v.x; m.m11 = v.y; m.m22 = v.z; m.m33 = 1f; return m;
        }

        public static Matrix4x4 Rotate(Quaternion q)
        {
            float x = q.x * 2f, y = q.y * 2f, z = q.z * 2f;
            float xx = q.x * x, yy = q.y * y, zz = q.z * z, xy = q.x * y, xz = q.x * z, yz = q.y * z;
            float wx = q.w * x, wy = q.w * y, wz = q.w * z;
            Matrix4x4 m;
            m.m00 = 1f - (yy + zz); m.m10 = xy + wz; m.m20 = xz - wy; m.m30 = 0f;
            m.m01 = xy - wz; m.m11 = 1f - (xx + zz); m.m21 = yz + wx; m.m31 = 0f;
            m.m02 = xz + wy; m.m12 = yz - wx; m.m22 = 1f - (xx + yy); m.m32 = 0f;
            m.m03 = 0f; m.m13 = 0f; m.m23 = 0f; m.m33 = 1f;
            return m;
        }

        public static Matrix4x4 TRS(Vector3 pos, Quaternion q, Vector3 s)
        {
            var m = Rotate(q);
            m.m00 *= s.x; m.m10 *= s.x; m.m20 *= s.x;
            m.m01 *= s.y; m.m11 *= s.y; m.m21 *= s.y;
            m.m02 *= s.z; m.m12 *= s.z; m.m22 *= s.z;
            m.m03 = pos.x; m.m13 = pos.y; m.m23 = pos.z;
            return m;
        }

        public void SetTRS(Vector3 pos, Quaternion q, Vector3 s) => this = TRS(pos, q, s);

        public Matrix4x4 inverse => Inverse(this);
        public Matrix4x4 transpose => Transpose(this);

        public static Matrix4x4 Transpose(Matrix4x4 m)
        {
            Matrix4x4 r;
            r.m00 = m.m00; r.m01 = m.m10; r.m02 = m.m20; r.m03 = m.m30;
            r.m10 = m.m01; r.m11 = m.m11; r.m12 = m.m21; r.m13 = m.m31;
            r.m20 = m.m02; r.m21 = m.m12; r.m22 = m.m22; r.m23 = m.m32;
            r.m30 = m.m03; r.m31 = m.m13; r.m32 = m.m23; r.m33 = m.m33;
            return r;
        }

        // inversa general por cofactores; singular: ceros (como Unity)
        public static Matrix4x4 Inverse(Matrix4x4 m)
        {
            float a00 = m.m00, a01 = m.m01, a02 = m.m02, a03 = m.m03;
            float a10 = m.m10, a11 = m.m11, a12 = m.m12, a13 = m.m13;
            float a20 = m.m20, a21 = m.m21, a22 = m.m22, a23 = m.m23;
            float a30 = m.m30, a31 = m.m31, a32 = m.m32, a33 = m.m33;
            float b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
            float b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
            float b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
            float b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
            float det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
            if (det == 0f) return zero;
            float inv = 1f / det;
            Matrix4x4 r;
            r.m00 = (a11 * b11 - a12 * b10 + a13 * b09) * inv;
            r.m01 = (-a01 * b11 + a02 * b10 - a03 * b09) * inv;
            r.m02 = (a31 * b05 - a32 * b04 + a33 * b03) * inv;
            r.m03 = (-a21 * b05 + a22 * b04 - a23 * b03) * inv;
            r.m10 = (-a10 * b11 + a12 * b08 - a13 * b07) * inv;
            r.m11 = (a00 * b11 - a02 * b08 + a03 * b07) * inv;
            r.m12 = (-a30 * b05 + a32 * b02 - a33 * b01) * inv;
            r.m13 = (a20 * b05 - a22 * b02 + a23 * b01) * inv;
            r.m20 = (a10 * b10 - a11 * b08 + a13 * b06) * inv;
            r.m21 = (-a00 * b10 + a01 * b08 - a03 * b06) * inv;
            r.m22 = (a30 * b04 - a31 * b02 + a33 * b00) * inv;
            r.m23 = (-a20 * b04 + a21 * b02 - a23 * b00) * inv;
            r.m30 = (-a10 * b09 + a11 * b07 - a12 * b06) * inv;
            r.m31 = (a00 * b09 - a01 * b07 + a02 * b06) * inv;
            r.m32 = (-a30 * b03 + a31 * b01 - a32 * b00) * inv;
            r.m33 = (a20 * b03 - a21 * b01 + a22 * b00) * inv;
            return r;
        }

        public float determinant
        {
            get
            {
                float b00 = m00 * m11 - m01 * m10, b01 = m00 * m12 - m02 * m10, b02 = m00 * m13 - m03 * m10;
                float b03 = m01 * m12 - m02 * m11, b04 = m01 * m13 - m03 * m11, b05 = m02 * m13 - m03 * m12;
                float b06 = m20 * m31 - m21 * m30, b07 = m20 * m32 - m22 * m30, b08 = m20 * m33 - m23 * m30;
                float b09 = m21 * m32 - m22 * m31, b10 = m21 * m33 - m23 * m31, b11 = m22 * m33 - m23 * m32;
                return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
            }
        }

        public bool isIdentity => this == identity;

        // proyección de OpenGL (la que usa Unity: -1..1 en z)
        public static Matrix4x4 Perspective(float fov, float aspect, float zNear, float zFar)
        {
            float f = 1f / (float)Math.Tan(fov * Mathf.Deg2Rad * 0.5f);
            var m = default(Matrix4x4);
            m.m00 = f / aspect; m.m11 = f;
            m.m22 = (zFar + zNear) / (zNear - zFar); m.m23 = 2f * zFar * zNear / (zNear - zFar);
            m.m32 = -1f;
            return m;
        }

        public static Matrix4x4 Ortho(float left, float right, float bottom, float top, float zNear, float zFar)
        {
            var m = identity;
            m.m00 = 2f / (right - left); m.m11 = 2f / (top - bottom); m.m22 = -2f / (zFar - zNear);
            m.m03 = -(right + left) / (right - left); m.m13 = -(top + bottom) / (top - bottom); m.m23 = -(zFar + zNear) / (zFar - zNear);
            return m;
        }

        public static Matrix4x4 LookAt(Vector3 from, Vector3 to, Vector3 up)
        {
            Vector3 z = Vector3.Normalize(to - from), x = Vector3.Normalize(Vector3.Cross(up, z)), y = Vector3.Cross(z, x);
            var m = identity;
            m.m00 = x.x; m.m10 = x.y; m.m20 = x.z;
            m.m01 = y.x; m.m11 = y.y; m.m21 = y.z;
            m.m02 = z.x; m.m12 = z.y; m.m22 = z.z;
            m.m03 = from.x; m.m13 = from.y; m.m23 = from.z;
            return m;
        }

        public Quaternion rotation => Quaternion.DeMatriz(m00, m01, m02, m10, m11, m12, m20, m21, m22);
        public Vector3 lossyScale => new Vector3(new Vector3(m00, m10, m20).magnitude, new Vector3(m01, m11, m21).magnitude, new Vector3(m02, m12, m22).magnitude);

        public bool Equals(Matrix4x4 other) =>
            GetColumn(0).Equals(other.GetColumn(0)) && GetColumn(1).Equals(other.GetColumn(1)) && GetColumn(2).Equals(other.GetColumn(2)) && GetColumn(3).Equals(other.GetColumn(3));
        public override bool Equals(object other) => other is Matrix4x4 m && Equals(m);
        public override int GetHashCode() => GetColumn(0).GetHashCode() ^ (GetColumn(1).GetHashCode() << 2) ^ (GetColumn(2).GetHashCode() >> 2) ^ (GetColumn(3).GetHashCode() >> 1);

        public override string ToString() => ToString("F5");
        public string ToString(string format) => string.Format(CultureInfo.InvariantCulture,
            "{0}\t{1}\t{2}\t{3}\n{4}\t{5}\t{6}\t{7}\n{8}\t{9}\t{10}\t{11}\n{12}\t{13}\t{14}\t{15}\n",
            m00.ToString(format, CultureInfo.InvariantCulture), m01.ToString(format, CultureInfo.InvariantCulture), m02.ToString(format, CultureInfo.InvariantCulture), m03.ToString(format, CultureInfo.InvariantCulture),
            m10.ToString(format, CultureInfo.InvariantCulture), m11.ToString(format, CultureInfo.InvariantCulture), m12.ToString(format, CultureInfo.InvariantCulture), m13.ToString(format, CultureInfo.InvariantCulture),
            m20.ToString(format, CultureInfo.InvariantCulture), m21.ToString(format, CultureInfo.InvariantCulture), m22.ToString(format, CultureInfo.InvariantCulture), m23.ToString(format, CultureInfo.InvariantCulture),
            m30.ToString(format, CultureInfo.InvariantCulture), m31.ToString(format, CultureInfo.InvariantCulture), m32.ToString(format, CultureInfo.InvariantCulture), m33.ToString(format, CultureInfo.InvariantCulture));
        public string ToString(string format, IFormatProvider formatProvider) => ToString(format);
    }
}

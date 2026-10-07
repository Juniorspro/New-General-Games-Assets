using System;
using System.Globalization;

namespace UnityEngine
{
    public partial struct Rect : IEquatable<Rect>
    {
        public float m_XMin;
        public float m_YMin;
        public float m_Width;
        public float m_Height;

        public Rect(float x, float y, float width, float height) { m_XMin = x; m_YMin = y; m_Width = width; m_Height = height; }
        public Rect(Vector2 position, Vector2 size) { m_XMin = position.x; m_YMin = position.y; m_Width = size.x; m_Height = size.y; }
        public Rect(Rect source) { m_XMin = source.m_XMin; m_YMin = source.m_YMin; m_Width = source.m_Width; m_Height = source.m_Height; }

        public static Rect zero => new Rect(0f, 0f, 0f, 0f);

        public static Rect MinMaxRect(float xmin, float ymin, float xmax, float ymax) => new Rect(xmin, ymin, xmax - xmin, ymax - ymin);

        public void Set(float x, float y, float width, float height) { m_XMin = x; m_YMin = y; m_Width = width; m_Height = height; }

        public float x { get => m_XMin; set => m_XMin = value; }
        public float y { get => m_YMin; set => m_YMin = value; }
        public Vector2 position { get => new Vector2(m_XMin, m_YMin); set { m_XMin = value.x; m_YMin = value.y; } }
        public Vector2 center { get => new Vector2(x + m_Width / 2f, y + m_Height / 2f); set { m_XMin = value.x - m_Width / 2f; m_YMin = value.y - m_Height / 2f; } }
        public Vector2 min { get => new Vector2(xMin, yMin); set { xMin = value.x; yMin = value.y; } }
        public Vector2 max { get => new Vector2(xMax, yMax); set { xMax = value.x; yMax = value.y; } }
        public float width { get => m_Width; set => m_Width = value; }
        public float height { get => m_Height; set => m_Height = value; }
        public Vector2 size { get => new Vector2(m_Width, m_Height); set { m_Width = value.x; m_Height = value.y; } }

        public float xMin { get => m_XMin; set { float oldxmax = xMax; m_XMin = value; m_Width = oldxmax - m_XMin; } }
        public float yMin { get => m_YMin; set { float oldymax = yMax; m_YMin = value; m_Height = oldymax - m_YMin; } }
        public float xMax { get => m_Width + m_XMin; set => m_Width = value - m_XMin; }
        public float yMax { get => m_Height + m_YMin; set => m_Height = value - m_YMin; }

        public bool Contains(Vector2 point) => point.x >= xMin && point.x < xMax && point.y >= yMin && point.y < yMax;
        public bool Contains(Vector3 point) => point.x >= xMin && point.x < xMax && point.y >= yMin && point.y < yMax;

        public bool Contains(Vector3 point, bool allowInverse)
        {
            if (!allowInverse) return Contains(point);
            bool xAxis = width < 0f && point.x <= xMin && point.x > xMax || width >= 0f && point.x >= xMin && point.x < xMax;
            bool yAxis = height < 0f && point.y <= yMin && point.y > yMax || height >= 0f && point.y >= yMin && point.y < yMax;
            return xAxis && yAxis;
        }

        static Rect OrderMinMax(Rect rect)
        {
            if (rect.xMin > rect.xMax) { float t = rect.xMin; rect.xMin = rect.xMax; rect.xMax = t; }
            if (rect.yMin > rect.yMax) { float t = rect.yMin; rect.yMin = rect.yMax; rect.yMax = t; }
            return rect;
        }

        public bool Overlaps(Rect other) => other.xMax > xMin && other.xMin < xMax && other.yMax > yMin && other.yMin < yMax;

        public bool Overlaps(Rect other, bool allowInverse)
        {
            Rect self = this;
            if (allowInverse) { self = OrderMinMax(self); other = OrderMinMax(other); }
            return self.Overlaps(other);
        }

        public static Vector2 NormalizedToPoint(Rect rectangle, Vector2 normalizedRectCoordinates) =>
            new Vector2(Mathf.Lerp(rectangle.x, rectangle.xMax, normalizedRectCoordinates.x), Mathf.Lerp(rectangle.y, rectangle.yMax, normalizedRectCoordinates.y));

        public static Vector2 PointToNormalized(Rect rectangle, Vector2 point) =>
            new Vector2(Mathf.InverseLerp(rectangle.x, rectangle.xMax, point.x), Mathf.InverseLerp(rectangle.y, rectangle.yMax, point.y));

        public static bool operator !=(Rect lhs, Rect rhs) => !(lhs == rhs);
        public static bool operator ==(Rect lhs, Rect rhs) => lhs.x == rhs.x && lhs.y == rhs.y && lhs.width == rhs.width && lhs.height == rhs.height;

        public bool Equals(Rect other) => x.Equals(other.x) && y.Equals(other.y) && width.Equals(other.width) && height.Equals(other.height);
        public override bool Equals(object other) => other is Rect r && Equals(r);
        public override int GetHashCode() => x.GetHashCode() ^ (width.GetHashCode() << 2) ^ (y.GetHashCode() >> 2) ^ (height.GetHashCode() >> 1);

        public override string ToString() => string.Format(CultureInfo.InvariantCulture, "(x:{0:F2}, y:{1:F2}, width:{2:F2}, height:{3:F2})", x, y, width, height);
    }

    public partial struct Bounds : IEquatable<Bounds>
    {
        public Vector3 m_Center;
        public Vector3 m_Extents;

        public Bounds(Vector3 center, Vector3 size) { m_Center = center; m_Extents = size * 0.5f; }

        public Vector3 center { get => m_Center; set => m_Center = value; }
        public Vector3 size { get => m_Extents * 2f; set => m_Extents = value * 0.5f; }
        public Vector3 extents { get => m_Extents; set => m_Extents = value; }
        public Vector3 min { get => center - extents; set => SetMinMax(value, max); }
        public Vector3 max { get => center + extents; set => SetMinMax(min, value); }

        public void SetMinMax(Vector3 min, Vector3 max)
        {
            extents = (max - min) * 0.5f;
            center = min + extents;
        }

        public void Encapsulate(Vector3 point) => SetMinMax(Vector3.Min(min, point), Vector3.Max(max, point));

        public void Encapsulate(Bounds bounds)
        {
            Encapsulate(bounds.center - bounds.extents);
            Encapsulate(bounds.center + bounds.extents);
        }

        public void Expand(float amount)
        {
            amount *= 0.5f;
            extents += new Vector3(amount, amount, amount);
        }

        public void Expand(Vector3 amount) => extents += amount * 0.5f;

        public bool Intersects(Bounds bounds) =>
            min.x <= bounds.max.x && max.x >= bounds.min.x && min.y <= bounds.max.y && max.y >= bounds.min.y && min.z <= bounds.max.z && max.z >= bounds.min.z;

        public bool Contains(Vector3 point)
        {
            Vector3 lo = min, hi = max;
            return point.x >= lo.x && point.x <= hi.x && point.y >= lo.y && point.y <= hi.y && point.z >= lo.z && point.z <= hi.z;
        }

        public Vector3 ClosestPoint(Vector3 point) => Vector3.Max(min, Vector3.Min(max, point));

        public float SqrDistance(Vector3 point) => (ClosestPoint(point) - point).sqrMagnitude;

        public bool IntersectRay(Ray ray) => IntersectRay(ray, out _);

        public bool IntersectRay(Ray ray, out float distance)
        {
            // método de las placas (slabs)
            float tmin = float.NegativeInfinity, tmax = float.PositiveInfinity;
            Vector3 o = ray.origin, d = ray.direction, lo = min, hi = max;
            for (int i = 0; i < 3; i++)
            {
                if (Math.Abs(d[i]) < 1e-12f)
                {
                    if (o[i] < lo[i] || o[i] > hi[i]) { distance = 0f; return false; }
                }
                else
                {
                    float inv = 1f / d[i], t1 = (lo[i] - o[i]) * inv, t2 = (hi[i] - o[i]) * inv;
                    if (t1 > t2) { float t = t1; t1 = t2; t2 = t; }
                    tmin = Math.Max(tmin, t1); tmax = Math.Min(tmax, t2);
                    if (tmin > tmax) { distance = 0f; return false; }
                }
            }
            if (tmax < 0f) { distance = 0f; return false; }
            distance = tmin >= 0f ? tmin : 0f;
            return true;
        }

        public static bool operator ==(Bounds lhs, Bounds rhs) => lhs.center == rhs.center && lhs.extents == rhs.extents;
        public static bool operator !=(Bounds lhs, Bounds rhs) => !(lhs == rhs);

        public bool Equals(Bounds other) => center.Equals(other.center) && extents.Equals(other.extents);
        public override bool Equals(object other) => other is Bounds b && Equals(b);
        public override int GetHashCode() => center.GetHashCode() ^ (extents.GetHashCode() << 2);

        public override string ToString() => string.Format(CultureInfo.InvariantCulture, "Center: {0}, Extents: {1}", m_Center, m_Extents);
    }

    public partial struct Ray
    {
        public Vector3 m_Origin;
        public Vector3 m_Direction;

        public Ray(Vector3 origin, Vector3 direction) { m_Origin = origin; m_Direction = direction.normalized; }

        public Vector3 origin { get => m_Origin; set => m_Origin = value; }
        public Vector3 direction { get => m_Direction; set => m_Direction = value.normalized; }

        public Vector3 GetPoint(float distance) => m_Origin + m_Direction * distance;

        public override string ToString() => string.Format(CultureInfo.InvariantCulture, "Origin: {0}, Dir: {1}", m_Origin, m_Direction);
    }

    public partial struct Plane
    {
        public Vector3 m_Normal;
        public float m_Distance;

        public Vector3 normal { get => m_Normal; set => m_Normal = value; }
        public float distance { get => m_Distance; set => m_Distance = value; }

        public Plane(Vector3 inNormal, Vector3 inPoint)
        {
            m_Normal = Vector3.Normalize(inNormal);
            m_Distance = -Vector3.Dot(m_Normal, inPoint);
        }

        public Plane(Vector3 inNormal, float d) { m_Normal = Vector3.Normalize(inNormal); m_Distance = d; }

        public Plane(Vector3 a, Vector3 b, Vector3 c)
        {
            m_Normal = Vector3.Normalize(Vector3.Cross(b - a, c - a));
            m_Distance = -Vector3.Dot(m_Normal, a);
        }

        public void SetNormalAndPosition(Vector3 inNormal, Vector3 inPoint)
        {
            m_Normal = Vector3.Normalize(inNormal);
            m_Distance = -Vector3.Dot(inNormal, inPoint);
        }

        public float GetDistanceToPoint(Vector3 point) => Vector3.Dot(m_Normal, point) + m_Distance;
        public bool GetSide(Vector3 point) => Vector3.Dot(m_Normal, point) + m_Distance > 0f;
        public bool SameSide(Vector3 inPt0, Vector3 inPt1) => GetDistanceToPoint(inPt0) > 0f == GetDistanceToPoint(inPt1) > 0f;
        public Vector3 ClosestPointOnPlane(Vector3 point) => point - m_Normal * GetDistanceToPoint(point);

        public bool Raycast(Ray ray, out float enter)
        {
            float vdot = Vector3.Dot(ray.direction, m_Normal);
            float ndot = -Vector3.Dot(ray.origin, m_Normal) - m_Distance;
            if (Mathf.Approximately(vdot, 0f)) { enter = 0f; return false; }
            enter = ndot / vdot;
            return enter > 0f;
        }
    }

    public partial struct LayerMask
    {
        public int m_Mask;

        public int value { get => m_Mask; set => m_Mask = value; }

        public static implicit operator int(LayerMask mask) => mask.m_Mask;
        public static implicit operator LayerMask(int intVal) { LayerMask m; m.m_Mask = intVal; return m; }

        // los nombres de las capas los carga el motor del TagManager
        internal static readonly string[] nombres = new string[32];

        public static string LayerToName(int layer) => layer >= 0 && layer < 32 ? nombres[layer] ?? "" : "";

        public static int NameToLayer(string layerName)
        {
            for (int i = 0; i < 32; i++) if (nombres[i] == layerName) return i;
            return -1;
        }

        public static int GetMask(params string[] layerNames)
        {
            if (layerNames == null) throw new ArgumentNullException(nameof(layerNames));
            int mask = 0;
            foreach (var n in layerNames)
            {
                int layer = NameToLayer(n);
                if (layer != -1) mask |= 1 << layer;
            }
            return mask;
        }
    }
}

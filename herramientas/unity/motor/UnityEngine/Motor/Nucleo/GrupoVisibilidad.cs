using System;

namespace UnityEngine
{
    // CullingGroup: esferas y bandas de distancia a un punto de referencia. Unity lo calcula al
    // dibujar; acá se calcula al preguntar (el juego lo usa para la música: tarrs y oasis cerca).
    public partial class CullingGroup : IDisposable
    {
        BoundingSphere[] esferas = Array.Empty<BoundingSphere>();
        float[] distancias = Array.Empty<float>();
        int cantidad;
        Transform referencia;
        Vector3 puntoFijo;

        public CullingGroup() { }
        public void Dispose() { esferas = Array.Empty<BoundingSphere>(); cantidad = 0; referencia = null; }

        public Camera targetCamera { get; set; }

        public void SetBoundingSpheres(BoundingSphere[] array) { esferas = array ?? Array.Empty<BoundingSphere>(); cantidad = esferas.Length; }
        public void SetBoundingSphereCount(int count) => cantidad = Math.Clamp(count, 0, esferas.Length);
        public void EraseSwapBack(int index)
        {
            if (index < 0 || index >= cantidad) return;
            esferas[index] = esferas[cantidad - 1];
            cantidad--;
        }
        public void SetBoundingDistances(float[] distances) => distancias = distances ?? Array.Empty<float>();
        public void SetDistanceReferencePoint(Transform transform) => referencia = transform;
        public void SetDistanceReferencePoint(Vector3 point) { referencia = null; puntoFijo = point; }

        Vector3 Referencia() => referencia != null ? referencia.position : puntoFijo;

        // la banda de una esfera: la primera distancia mayor que la que hay hasta su superficie
        public int GetDistance(int index)
        {
            if (index < 0 || index >= cantidad) return distancias.Length;
            var e = esferas[index];
            float d = Vector3.Distance(e.position, Referencia()) - e.radius;
            for (int k = 0; k < distancias.Length; k++) if (d < distancias[k]) return k;
            return distancias.Length;
        }

        public bool IsVisible(int index) => index >= 0 && index < cantidad;

        public int QueryIndices(int distanceIndex, int[] result, int firstIndex)
        {
            int n = 0;
            for (int i = Math.Max(0, firstIndex); i < cantidad && (result == null || n < result.Length); i++)
                if (GetDistance(i) == distanceIndex) { if (result != null) result[n] = i; n++; }
            return n;
        }

        public int QueryIndices(bool visible, int[] result, int firstIndex)
        {
            int n = 0;
            for (int i = Math.Max(0, firstIndex); i < cantidad && (result == null || n < result.Length); i++)
                if (IsVisible(i) == visible) { if (result != null) result[n] = i; n++; }
            return n;
        }

        public int QueryIndices(bool visible, int distanceIndex, int[] result, int firstIndex)
        {
            int n = 0;
            for (int i = Math.Max(0, firstIndex); i < cantidad && (result == null || n < result.Length); i++)
                if (IsVisible(i) == visible && GetDistance(i) == distanceIndex) { if (result != null) result[n] = i; n++; }
            return n;
        }
    }
}

namespace UnityEngine
{
    public partial struct BoundingSphere
    {
        public BoundingSphere(Vector3 pos, float rad) { position = pos; radius = rad; }
        public BoundingSphere(Vector4 packedSphere) { position = new Vector3(packedSphere.x, packedSphere.y, packedSphere.z); radius = packedSphere.w; }
    }
}

namespace UnityEngine.Analytics
{
    // sin servicio de analíticas en el navegador: los eventos se aceptan y no van a ningún lado
    public static partial class Analytics
    {
        public static AnalyticsResult CustomEvent(string customEventName) => AnalyticsResult.Ok;
    }
}

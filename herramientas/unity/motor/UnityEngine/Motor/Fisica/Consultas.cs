using System;
using System.Collections.Generic;
using Porteo;
using Porteo.Fisica;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Porteo.Fisica
{
    // Las consultas a la escena de PhysX con las reglas de Unity: máscara de capas, triggers según
    // QueryTriggerInteraction (o Physics.queriesHitTriggers) y, antes de consultar, los Transform
    // que cambiaron pasan a PhysX (autoSyncTransforms).
    public static unsafe class Consultas
    {
        const float MAX = 1e9f;

        internal static int Triggers(QueryTriggerInteraction q) =>
            q == QueryTriggerInteraction.Ignore ? 0 : q == QueryTriggerInteraction.Collide ? 1 : (Simulacion.consultasVenTriggers ? 1 : 0);

        static float Lejos(float d) => float.IsInfinity(d) || d > MAX ? MAX : Math.Max(d, 0f);

        internal static RaycastHit Golpe(GolpePx g)
        {
            var c = Simulacion.PorForma(g.Colisionador);
            return new RaycastHit
            {
                m_Point = new Vector3(g.PX, g.PY, g.PZ),
                m_Normal = new Vector3(g.NX, g.NY, g.NZ),
                m_Distance = g.Distancia,
                m_FaceID = (uint)Math.Max(g.Cara, 0),
                m_Collider = c != null ? c.GetInstanceID() : 0,
                col = c,
            };
        }

        static bool Primero(int n, GolpePx* g, out RaycastHit hit)
        {
            if (n <= 0) { hit = default; return false; }
            hit = Golpe(g[0]);
            return hit.col != null;
        }

        static RaycastHit[] Todos(int n, GolpePx* g, Vector3 dir, bool barrido)
        {
            var l = new List<RaycastHit>(n);
            for (int i = 0; i < n; i++)
            {
                var h = Golpe(g[i]);
                if (h.col == null) continue;
                // los que empiezan solapados: distancia 0, punto cero y normal contra el barrido (como Unity)
                if (barrido && g[i].Inicial != 0) { h.m_Distance = 0; h.m_Point = Vector3.zero; h.m_Normal = -dir.normalized; }
                l.Add(h);
            }
            return l.ToArray();
        }

        public static bool Rayo(Vector3 o, Vector3 d, float max, int mascara, QueryTriggerInteraction q, out RaycastHit hit)
        {
            hit = default;
            if (!Simulacion.Activa || d.sqrMagnitude < 1e-20f) return false;
            Simulacion.Sincronizar();
            GolpePx* g;
            int n = Px.fx_rayo((float*)&o, (float*)&d, Lejos(max), (uint)mascara, Triggers(q), 0, &g);
            return Primero(n, g, out hit);
        }

        public static RaycastHit[] RayoTodos(Vector3 o, Vector3 d, float max, int mascara, QueryTriggerInteraction q)
        {
            if (!Simulacion.Activa || d.sqrMagnitude < 1e-20f) return Array.Empty<RaycastHit>();
            Simulacion.Sincronizar();
            GolpePx* g;
            int n = Px.fx_rayo((float*)&o, (float*)&d, Lejos(max), (uint)mascara, Triggers(q), 1, &g);
            return Todos(n, g, d, false);
        }

        public static bool Esfera(Vector3 o, float r, Vector3 d, float max, int mascara, QueryTriggerInteraction q, out RaycastHit hit)
        {
            hit = default;
            if (!Simulacion.Activa || d.sqrMagnitude < 1e-20f) return false;
            Simulacion.Sincronizar();
            GolpePx* g;
            int n = Px.fx_barrido_esfera((float*)&o, r, (float*)&d, Lejos(max), (uint)mascara, Triggers(q), 0, &g);
            return Primero(n, g, out hit);
        }

        public static RaycastHit[] EsferaTodos(Vector3 o, float r, Vector3 d, float max, int mascara, QueryTriggerInteraction q)
        {
            if (!Simulacion.Activa || d.sqrMagnitude < 1e-20f) return Array.Empty<RaycastHit>();
            Simulacion.Sincronizar();
            GolpePx* g;
            int n = Px.fx_barrido_esfera((float*)&o, r, (float*)&d, Lejos(max), (uint)mascara, Triggers(q), 1, &g);
            return Todos(n, g, d, true);
        }

        public static bool Capsula(Vector3 p0, Vector3 p1, float r, Vector3 d, float max, int mascara, QueryTriggerInteraction q, out RaycastHit hit)
        {
            hit = default;
            if (!Simulacion.Activa || d.sqrMagnitude < 1e-20f) return false;
            Simulacion.Sincronizar();
            GolpePx* g;
            int n = Px.fx_barrido_capsula((float*)&p0, (float*)&p1, r, (float*)&d, Lejos(max), (uint)mascara, Triggers(q), 0, &g);
            return Primero(n, g, out hit);
        }

        public static RaycastHit[] CapsulaTodos(Vector3 p0, Vector3 p1, float r, Vector3 d, float max, int mascara, QueryTriggerInteraction q)
        {
            if (!Simulacion.Activa || d.sqrMagnitude < 1e-20f) return Array.Empty<RaycastHit>();
            Simulacion.Sincronizar();
            GolpePx* g;
            int n = Px.fx_barrido_capsula((float*)&p0, (float*)&p1, r, (float*)&d, Lejos(max), (uint)mascara, Triggers(q), 1, &g);
            return Todos(n, g, d, true);
        }

        public static bool Caja(Vector3 c, Vector3 medias, Vector3 d, Quaternion rot, float max, int mascara, QueryTriggerInteraction q, out RaycastHit hit)
        {
            hit = default;
            if (!Simulacion.Activa || d.sqrMagnitude < 1e-20f) return false;
            Simulacion.Sincronizar();
            GolpePx* g;
            int n = Px.fx_barrido_caja((float*)&c, (float*)&medias, (float*)&rot, (float*)&d, Lejos(max), (uint)mascara, Triggers(q), 0, &g);
            return Primero(n, g, out hit);
        }

        static Collider[] Colisionadores(int n, GolpePx* g)
        {
            var l = new List<Collider>(n);
            for (int i = 0; i < n; i++)
            {
                var c = Simulacion.PorForma(g[i].Colisionador);
                if (c != null && !l.Contains(c)) l.Add(c);
            }
            return l.ToArray();
        }

        public static Collider[] SolapeEsfera(Vector3 c, float r, int mascara, QueryTriggerInteraction q)
        {
            if (!Simulacion.Activa) return Array.Empty<Collider>();
            Simulacion.Sincronizar();
            GolpePx* g;
            int n = Px.fx_solape_esfera((float*)&c, r, (uint)mascara, Triggers(q), 0, &g);
            return Colisionadores(n, g);
        }

        public static bool HayEsfera(Vector3 c, float r, int mascara, QueryTriggerInteraction q)
        {
            if (!Simulacion.Activa) return false;
            Simulacion.Sincronizar();
            GolpePx* g;
            return Px.fx_solape_esfera((float*)&c, r, (uint)mascara, Triggers(q), 1, &g) > 0;
        }

        public static Collider[] SolapeCaja(Vector3 c, Vector3 medias, Quaternion rot, int mascara, QueryTriggerInteraction q)
        {
            if (!Simulacion.Activa) return Array.Empty<Collider>();
            Simulacion.Sincronizar();
            GolpePx* g;
            int n = Px.fx_solape_caja((float*)&c, (float*)&medias, (float*)&rot, (uint)mascara, Triggers(q), 0, &g);
            return Colisionadores(n, g);
        }

        public static bool HayCaja(Vector3 c, Vector3 medias, Quaternion rot, int mascara, QueryTriggerInteraction q)
        {
            if (!Simulacion.Activa) return false;
            Simulacion.Sincronizar();
            GolpePx* g;
            return Px.fx_solape_caja((float*)&c, (float*)&medias, (float*)&rot, (uint)mascara, Triggers(q), 1, &g) > 0;
        }

        public static Collider[] SolapeCapsula(Vector3 p0, Vector3 p1, float r, int mascara, QueryTriggerInteraction q)
        {
            if (!Simulacion.Activa) return Array.Empty<Collider>();
            Simulacion.Sincronizar();
            GolpePx* g;
            int n = Px.fx_solape_capsula((float*)&p0, (float*)&p1, r, (uint)mascara, Triggers(q), 0, &g);
            return Colisionadores(n, g);
        }

        public static bool HayCapsula(Vector3 p0, Vector3 p1, float r, int mascara, QueryTriggerInteraction q)
        {
            if (!Simulacion.Activa) return false;
            Simulacion.Sincronizar();
            GolpePx* g;
            return Px.fx_solape_capsula((float*)&p0, (float*)&p1, r, (uint)mascara, Triggers(q), 1, &g) > 0;
        }
    }
}

namespace UnityEngine
{
    public partial class Physics
    {
        public const int IgnoreRaycastLayer = 4, DefaultRaycastLayers = -5, AllLayers = -1;

        public static Vector3 gravity { get => Simulacion.Gravedad; set => Simulacion.Gravedad = value; }
        public static bool queriesHitTriggers { get => Simulacion.consultasVenTriggers; set => Simulacion.consultasVenTriggers = value; }
        public static bool queriesHitBackfaces { get; set; }
        public static bool autoSimulation { get; set; } = true;
        public static bool autoSyncTransforms { get; set; } = true;
        public static float bounceThreshold { get; set; } = 2f;
        public static float sleepThreshold { get => Simulacion.umbralDormir; set => Simulacion.umbralDormir = value; }
        public static float defaultContactOffset { get => Simulacion.offsetContacto; set => Simulacion.offsetContacto = value; }
        public static int defaultSolverIterations { get => Simulacion.iteraciones; set => Simulacion.iteraciones = value; }
        public static int defaultSolverVelocityIterations { get => Simulacion.iteracionesVel; set => Simulacion.iteracionesVel = value; }

        public static void SyncTransforms() => Simulacion.Sincronizar();

        public static void IgnoreCollision(Collider collider1, Collider collider2) => IgnoreCollision(collider1, collider2, true);

        public static void IgnoreCollision(Collider collider1, Collider collider2, bool ignore)
        {
            if (collider1 == null || collider2 == null || !Simulacion.Activa) return;
            if (collider1.id < 0) collider1.id = Simulacion.IdColisionador(collider1);
            if (collider2.id < 0) collider2.id = Simulacion.IdColisionador(collider2);
            Px.fx_ignorar(collider1.id, collider2.id, ignore ? 1 : 0);
            if (collider1.forma >= 0) Px.fx_refiltrar(collider1.forma);
            if (collider2.forma >= 0) Px.fx_refiltrar(collider2.forma);
        }

        public static void IgnoreLayerCollision(int layer1, int layer2) => IgnoreLayerCollision(layer1, layer2, true);
        public static void IgnoreLayerCollision(int layer1, int layer2, bool ignore) => Simulacion.IgnorarCapas(layer1, layer2, ignore);
        public static bool GetIgnoreLayerCollision(int layer1, int layer2) => (Simulacion.Mascara(layer1) & (1u << (layer2 & 31))) == 0;

        // ── rayos ──
        public static bool Raycast(Vector3 origin, Vector3 direction) => Consultas.Rayo(origin, direction, float.PositiveInfinity, DefaultRaycastLayers, QueryTriggerInteraction.UseGlobal, out _);
        public static bool Raycast(Vector3 origin, Vector3 direction, float maxDistance) => Consultas.Rayo(origin, direction, maxDistance, DefaultRaycastLayers, QueryTriggerInteraction.UseGlobal, out _);
        public static bool Raycast(Vector3 origin, Vector3 direction, float maxDistance, int layerMask) => Consultas.Rayo(origin, direction, maxDistance, layerMask, QueryTriggerInteraction.UseGlobal, out _);
        public static bool Raycast(Vector3 origin, Vector3 direction, float maxDistance, int layerMask, QueryTriggerInteraction queryTriggerInteraction) => Consultas.Rayo(origin, direction, maxDistance, layerMask, queryTriggerInteraction, out _);
        public static bool Raycast(Vector3 origin, Vector3 direction, out RaycastHit hitInfo) => Consultas.Rayo(origin, direction, float.PositiveInfinity, DefaultRaycastLayers, QueryTriggerInteraction.UseGlobal, out hitInfo);
        public static bool Raycast(Vector3 origin, Vector3 direction, out RaycastHit hitInfo, float maxDistance) => Consultas.Rayo(origin, direction, maxDistance, DefaultRaycastLayers, QueryTriggerInteraction.UseGlobal, out hitInfo);
        public static bool Raycast(Vector3 origin, Vector3 direction, out RaycastHit hitInfo, float maxDistance, int layerMask) => Consultas.Rayo(origin, direction, maxDistance, layerMask, QueryTriggerInteraction.UseGlobal, out hitInfo);
        public static bool Raycast(Vector3 origin, Vector3 direction, out RaycastHit hitInfo, float maxDistance, int layerMask, QueryTriggerInteraction queryTriggerInteraction) => Consultas.Rayo(origin, direction, maxDistance, layerMask, queryTriggerInteraction, out hitInfo);
        public static bool Raycast(Ray ray) => Consultas.Rayo(ray.origin, ray.direction, float.PositiveInfinity, DefaultRaycastLayers, QueryTriggerInteraction.UseGlobal, out _);
        public static bool Raycast(Ray ray, float maxDistance) => Consultas.Rayo(ray.origin, ray.direction, maxDistance, DefaultRaycastLayers, QueryTriggerInteraction.UseGlobal, out _);
        public static bool Raycast(Ray ray, float maxDistance, int layerMask) => Consultas.Rayo(ray.origin, ray.direction, maxDistance, layerMask, QueryTriggerInteraction.UseGlobal, out _);
        public static bool Raycast(Ray ray, out RaycastHit hitInfo) => Consultas.Rayo(ray.origin, ray.direction, float.PositiveInfinity, DefaultRaycastLayers, QueryTriggerInteraction.UseGlobal, out hitInfo);
        public static bool Raycast(Ray ray, out RaycastHit hitInfo, float maxDistance) => Consultas.Rayo(ray.origin, ray.direction, maxDistance, DefaultRaycastLayers, QueryTriggerInteraction.UseGlobal, out hitInfo);
        public static bool Raycast(Ray ray, out RaycastHit hitInfo, float maxDistance, int layerMask) => Consultas.Rayo(ray.origin, ray.direction, maxDistance, layerMask, QueryTriggerInteraction.UseGlobal, out hitInfo);
        public static bool Raycast(Ray ray, out RaycastHit hitInfo, float maxDistance, int layerMask, QueryTriggerInteraction queryTriggerInteraction) => Consultas.Rayo(ray.origin, ray.direction, maxDistance, layerMask, queryTriggerInteraction, out hitInfo);

        public static bool Linecast(Vector3 start, Vector3 end) => Linecast(start, end, out _, DefaultRaycastLayers);
        public static bool Linecast(Vector3 start, Vector3 end, int layerMask) => Linecast(start, end, out _, layerMask);
        public static bool Linecast(Vector3 start, Vector3 end, out RaycastHit hitInfo) => Linecast(start, end, out hitInfo, DefaultRaycastLayers);
        public static bool Linecast(Vector3 start, Vector3 end, out RaycastHit hitInfo, int layerMask) => Linecast(start, end, out hitInfo, layerMask, QueryTriggerInteraction.UseGlobal);

        public static bool Linecast(Vector3 start, Vector3 end, out RaycastHit hitInfo, int layerMask, QueryTriggerInteraction queryTriggerInteraction)
        {
            var d = end - start;
            return Consultas.Rayo(start, d, d.magnitude, layerMask, queryTriggerInteraction, out hitInfo);
        }

        public static RaycastHit[] RaycastAll(Ray ray) => Consultas.RayoTodos(ray.origin, ray.direction, float.PositiveInfinity, DefaultRaycastLayers, QueryTriggerInteraction.UseGlobal);
        public static RaycastHit[] RaycastAll(Ray ray, float maxDistance) => Consultas.RayoTodos(ray.origin, ray.direction, maxDistance, DefaultRaycastLayers, QueryTriggerInteraction.UseGlobal);
        public static RaycastHit[] RaycastAll(Ray ray, float maxDistance, int layerMask) => Consultas.RayoTodos(ray.origin, ray.direction, maxDistance, layerMask, QueryTriggerInteraction.UseGlobal);
        public static RaycastHit[] RaycastAll(Ray ray, float maxDistance, int layerMask, QueryTriggerInteraction queryTriggerInteraction) => Consultas.RayoTodos(ray.origin, ray.direction, maxDistance, layerMask, queryTriggerInteraction);
        public static RaycastHit[] RaycastAll(Vector3 origin, Vector3 direction, float maxDistance, int layerMask) => Consultas.RayoTodos(origin, direction, maxDistance, layerMask, QueryTriggerInteraction.UseGlobal);
        public static RaycastHit[] RaycastAll(Vector3 origin, Vector3 direction, float maxDistance, int layerMask, QueryTriggerInteraction queryTriggerInteraction) => Consultas.RayoTodos(origin, direction, maxDistance, layerMask, queryTriggerInteraction);

        public static int RaycastNonAlloc(Ray ray, RaycastHit[] results, float maxDistance, int layerMask) => Copiar(Consultas.RayoTodos(ray.origin, ray.direction, maxDistance, layerMask, QueryTriggerInteraction.UseGlobal), results);
        public static int RaycastNonAlloc(Vector3 origin, Vector3 direction, RaycastHit[] results, float maxDistance, int layerMask, QueryTriggerInteraction queryTriggerInteraction) => Copiar(Consultas.RayoTodos(origin, direction, maxDistance, layerMask, queryTriggerInteraction), results);

        static int Copiar<T>(T[] origen, T[] destino)
        {
            int n = Math.Min(origen.Length, destino?.Length ?? 0);
            Array.Copy(origen, destino, n);
            return n;
        }

        // ── barridos ──
        public static bool SphereCast(Vector3 origin, float radius, Vector3 direction, out RaycastHit hitInfo) => Consultas.Esfera(origin, radius, direction, float.PositiveInfinity, DefaultRaycastLayers, QueryTriggerInteraction.UseGlobal, out hitInfo);
        public static bool SphereCast(Vector3 origin, float radius, Vector3 direction, out RaycastHit hitInfo, float maxDistance) => Consultas.Esfera(origin, radius, direction, maxDistance, DefaultRaycastLayers, QueryTriggerInteraction.UseGlobal, out hitInfo);
        public static bool SphereCast(Vector3 origin, float radius, Vector3 direction, out RaycastHit hitInfo, float maxDistance, int layerMask) => Consultas.Esfera(origin, radius, direction, maxDistance, layerMask, QueryTriggerInteraction.UseGlobal, out hitInfo);
        public static bool SphereCast(Vector3 origin, float radius, Vector3 direction, out RaycastHit hitInfo, float maxDistance, int layerMask, QueryTriggerInteraction queryTriggerInteraction) => Consultas.Esfera(origin, radius, direction, maxDistance, layerMask, queryTriggerInteraction, out hitInfo);
        public static bool SphereCast(Ray ray, float radius) => Consultas.Esfera(ray.origin, radius, ray.direction, float.PositiveInfinity, DefaultRaycastLayers, QueryTriggerInteraction.UseGlobal, out _);
        public static bool SphereCast(Ray ray, float radius, float maxDistance) => Consultas.Esfera(ray.origin, radius, ray.direction, maxDistance, DefaultRaycastLayers, QueryTriggerInteraction.UseGlobal, out _);
        public static bool SphereCast(Ray ray, float radius, float maxDistance, int layerMask) => Consultas.Esfera(ray.origin, radius, ray.direction, maxDistance, layerMask, QueryTriggerInteraction.UseGlobal, out _);
        public static bool SphereCast(Ray ray, float radius, out RaycastHit hitInfo) => Consultas.Esfera(ray.origin, radius, ray.direction, float.PositiveInfinity, DefaultRaycastLayers, QueryTriggerInteraction.UseGlobal, out hitInfo);
        public static bool SphereCast(Ray ray, float radius, out RaycastHit hitInfo, float maxDistance) => Consultas.Esfera(ray.origin, radius, ray.direction, maxDistance, DefaultRaycastLayers, QueryTriggerInteraction.UseGlobal, out hitInfo);
        public static bool SphereCast(Ray ray, float radius, out RaycastHit hitInfo, float maxDistance, int layerMask) => Consultas.Esfera(ray.origin, radius, ray.direction, maxDistance, layerMask, QueryTriggerInteraction.UseGlobal, out hitInfo);
        public static bool SphereCast(Ray ray, float radius, out RaycastHit hitInfo, float maxDistance, int layerMask, QueryTriggerInteraction queryTriggerInteraction) => Consultas.Esfera(ray.origin, radius, ray.direction, maxDistance, layerMask, queryTriggerInteraction, out hitInfo);

        public static RaycastHit[] SphereCastAll(Vector3 origin, float radius, Vector3 direction, float maxDistance, int layerMask) => Consultas.EsferaTodos(origin, radius, direction, maxDistance, layerMask, QueryTriggerInteraction.UseGlobal);
        public static RaycastHit[] SphereCastAll(Vector3 origin, float radius, Vector3 direction, float maxDistance, int layerMask, QueryTriggerInteraction queryTriggerInteraction) => Consultas.EsferaTodos(origin, radius, direction, maxDistance, layerMask, queryTriggerInteraction);
        public static RaycastHit[] SphereCastAll(Ray ray, float radius, float maxDistance, int layerMask) => Consultas.EsferaTodos(ray.origin, radius, ray.direction, maxDistance, layerMask, QueryTriggerInteraction.UseGlobal);
        public static RaycastHit[] SphereCastAll(Ray ray, float radius, float maxDistance) => Consultas.EsferaTodos(ray.origin, radius, ray.direction, maxDistance, DefaultRaycastLayers, QueryTriggerInteraction.UseGlobal);
        public static int SphereCastNonAlloc(Vector3 origin, float radius, Vector3 direction, RaycastHit[] results, float maxDistance, int layerMask, QueryTriggerInteraction queryTriggerInteraction) => Copiar(Consultas.EsferaTodos(origin, radius, direction, maxDistance, layerMask, queryTriggerInteraction), results);

        public static bool CapsuleCast(Vector3 point1, Vector3 point2, float radius, Vector3 direction, out RaycastHit hitInfo, float maxDistance, int layerMask) => Consultas.Capsula(point1, point2, radius, direction, maxDistance, layerMask, QueryTriggerInteraction.UseGlobal, out hitInfo);
        public static bool CapsuleCast(Vector3 point1, Vector3 point2, float radius, Vector3 direction, out RaycastHit hitInfo, float maxDistance, int layerMask, QueryTriggerInteraction queryTriggerInteraction) => Consultas.Capsula(point1, point2, radius, direction, maxDistance, layerMask, queryTriggerInteraction, out hitInfo);
        public static bool CapsuleCast(Vector3 point1, Vector3 point2, float radius, Vector3 direction, float maxDistance, int layerMask) => Consultas.Capsula(point1, point2, radius, direction, maxDistance, layerMask, QueryTriggerInteraction.UseGlobal, out _);
        public static RaycastHit[] CapsuleCastAll(Vector3 point1, Vector3 point2, float radius, Vector3 direction, float maxDistance, int layerMask) => Consultas.CapsulaTodos(point1, point2, radius, direction, maxDistance, layerMask, QueryTriggerInteraction.UseGlobal);

        public static bool BoxCast(Vector3 center, Vector3 halfExtents, Vector3 direction, out RaycastHit hitInfo, Quaternion orientation, float maxDistance, int layerMask) => Consultas.Caja(center, halfExtents, direction, orientation, maxDistance, layerMask, QueryTriggerInteraction.UseGlobal, out hitInfo);

        // ── solapamientos ──
        public static Collider[] OverlapSphere(Vector3 position, float radius) => Consultas.SolapeEsfera(position, radius, AllLayers, QueryTriggerInteraction.UseGlobal);
        public static Collider[] OverlapSphere(Vector3 position, float radius, int layerMask) => Consultas.SolapeEsfera(position, radius, layerMask, QueryTriggerInteraction.UseGlobal);
        public static Collider[] OverlapSphere(Vector3 position, float radius, int layerMask, QueryTriggerInteraction queryTriggerInteraction) => Consultas.SolapeEsfera(position, radius, layerMask, queryTriggerInteraction);
        public static int OverlapSphereNonAlloc(Vector3 position, float radius, Collider[] results, int layerMask, QueryTriggerInteraction queryTriggerInteraction) => Copiar(Consultas.SolapeEsfera(position, radius, layerMask, queryTriggerInteraction), results);
        public static int OverlapSphereNonAlloc(Vector3 position, float radius, Collider[] results, int layerMask) => Copiar(Consultas.SolapeEsfera(position, radius, layerMask, QueryTriggerInteraction.UseGlobal), results);
        public static int OverlapSphereNonAlloc(Vector3 position, float radius, Collider[] results) => Copiar(Consultas.SolapeEsfera(position, radius, AllLayers, QueryTriggerInteraction.UseGlobal), results);

        public static bool CheckSphere(Vector3 position, float radius) => Consultas.HayEsfera(position, radius, DefaultRaycastLayers, QueryTriggerInteraction.UseGlobal);
        public static bool CheckSphere(Vector3 position, float radius, int layerMask) => Consultas.HayEsfera(position, radius, layerMask, QueryTriggerInteraction.UseGlobal);
        public static bool CheckSphere(Vector3 position, float radius, int layerMask, QueryTriggerInteraction queryTriggerInteraction) => Consultas.HayEsfera(position, radius, layerMask, queryTriggerInteraction);

        public static Collider[] OverlapBox(Vector3 center, Vector3 halfExtents) => Consultas.SolapeCaja(center, halfExtents, Quaternion.identity, AllLayers, QueryTriggerInteraction.UseGlobal);
        public static Collider[] OverlapBox(Vector3 center, Vector3 halfExtents, Quaternion orientation, int layerMask) => Consultas.SolapeCaja(center, halfExtents, orientation, layerMask, QueryTriggerInteraction.UseGlobal);
        public static Collider[] OverlapBox(Vector3 center, Vector3 halfExtents, Quaternion orientation, int layerMask, QueryTriggerInteraction queryTriggerInteraction) => Consultas.SolapeCaja(center, halfExtents, orientation, layerMask, queryTriggerInteraction);
        public static bool CheckBox(Vector3 center, Vector3 halfExtents, Quaternion orientation, int layerMask) => Consultas.HayCaja(center, halfExtents, orientation, layerMask, QueryTriggerInteraction.UseGlobal);

        public static Collider[] OverlapCapsule(Vector3 point0, Vector3 point1, float radius, int layerMask) => Consultas.SolapeCapsula(point0, point1, radius, layerMask, QueryTriggerInteraction.UseGlobal);
        public static bool CheckCapsule(Vector3 start, Vector3 end, float radius, int layerMask) => Consultas.HayCapsula(start, end, radius, layerMask, QueryTriggerInteraction.UseGlobal);
        public static bool CheckCapsule(Vector3 start, Vector3 end, float radius) => Consultas.HayCapsula(start, end, radius, DefaultRaycastLayers, QueryTriggerInteraction.UseGlobal);

        // ── simulación a mano ──
        public static void Simulate(float step) { }
    }

    public partial struct RaycastHit
    {
        public Vector3 m_Point;
        public Vector3 m_Normal;
        public uint m_FaceID;
        public float m_Distance;
        public Vector2 m_UV;
        public int m_Collider;
        internal Collider col;

        public Collider collider => col ?? Registro.PorID(m_Collider) as Collider;
        public Vector3 point { get => m_Point; set => m_Point = value; }
        public Vector3 normal { get => m_Normal; set => m_Normal = value; }
        public float distance { get => m_Distance; set => m_Distance = value; }
        public int triangleIndex => (int)m_FaceID;
        public Vector2 textureCoord => m_UV;
        public Vector3 barycentricCoordinate { get; set; }
        public Transform transform { get { var c = collider; if (c == null) return null; var rb = c.attachedRigidbody; return rb != null ? rb.transform : c.transform; } }
        public Rigidbody rigidbody => collider?.attachedRigidbody;
    }

    public partial struct ContactPoint
    {
        public Vector3 m_Point;
        public Vector3 m_Normal;
        public int m_ThisColliderInstanceID;
        public int m_OtherColliderInstanceID;
        public float m_Separation;

        public Vector3 point => m_Point;
        public Vector3 normal => m_Normal;
        public Collider thisCollider => Registro.PorID(m_ThisColliderInstanceID) as Collider;
        public Collider otherCollider => Registro.PorID(m_OtherColliderInstanceID) as Collider;
        public float separation => m_Separation;
    }

    // lo que recibe OnCollision*: el otro colisionador, su cuerpo y los puntos de contacto
    public partial class Collision
    {
        readonly Collider otro;
        readonly Rigidbody cuerpoOtro;
        readonly Vector3 velRelativa, impulso;
        readonly ContactPoint[] contactos;

        public Collision() { contactos = Array.Empty<ContactPoint>(); }

        internal Collision(Collider otro, Rigidbody cuerpoOtro, Vector3 velRelativa, Vector3 impulso, ContactPoint[] contactos)
        {
            this.otro = otro; this.cuerpoOtro = cuerpoOtro; this.velRelativa = velRelativa; this.impulso = impulso; this.contactos = contactos;
        }

        public Vector3 relativeVelocity => velRelativa;
        public Rigidbody rigidbody => cuerpoOtro;
        public Collider collider => otro;
        public Transform transform => cuerpoOtro != null ? cuerpoOtro.transform : otro?.transform;
        public GameObject gameObject => cuerpoOtro != null ? cuerpoOtro.gameObject : otro?.gameObject;
        public ContactPoint[] contacts => contactos;
        public int contactCount => contactos.Length;
        public ContactPoint GetContact(int index) => contactos[index];
        public Vector3 impulse => impulso;
    }
}

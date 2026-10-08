using System;
using System.Collections.Generic;
using Porteo;
using Porteo.Animacion;
using Porteo.Datos;
using UnityEngine;
using Object = UnityEngine.Object;

namespace UnityEngine
{
    // Un Avatar: para los rigs humanoides trae el esqueleto humano (los nodos desde la raíz hasta
    // cada hueso, con los ejes y límites de cada articulación), la pose T y las masas de los huesos.
    public sealed partial class Avatar : Object
    {
        internal DatosHumanos humano;
        bool valido;

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            var a = m.M("m_Avatar");
            if (a == null) return;
            valido = true;
            humano = DatosHumanos.Leer(a, r);
        }

        public bool isValid => valido;
        public bool isHuman => humano != null;
    }
}

namespace Porteo.Animacion
{
    // Los ejes de una articulación (math::Axes de Mecanim): el marco del hueso (PreQ/PostQ), el
    // signo de cada eje y los límites en radianes de cada grado de libertad.
    internal struct Eje
    {
        public Quaternion Pre, Post;
        public Vector3 Signo, Min, Max;
        public float Largo;
    }

    internal sealed class DatosHumanos
    {
        public int N;                       // nodos del esqueleto humano
        public int[] Padre, EjeDe;
        public uint[] Ids;                  // CRC-32 del camino de cada nodo debajo del Animator
        public Vector3[] T;                 // la pose T, local
        public Quaternion[] Q;
        public Eje[] Ejes;
        public int[] Hueso = new int[25];   // el nodo de cada hueso humano (Hips, piernas, columna, brazos...)
        public float[] Masa = new float[25];
        public int[] ManoI = new int[15], ManoD = new int[15];
        public Vector3 RaizT;               // el cuerpo (centro de masa y orientación) en la pose T
        public Quaternion RaizQ;
        public float Escala;                // la altura del centro de masa en la pose T
        public float GiroBrazo = 0.5f, GiroAntebrazo = 0.5f, GiroMuslo = 0.5f, GiroPierna = 0.5f;

        internal static DatosHumanos Leer(Mapa a, IResolutor r)
        {
            var h = a.M("m_Human")?.M("data");
            var sk = h?.M("m_Skeleton")?.M("data");
            var nodos = sk?.L("m_Node");
            var pose = h?.M("m_SkeletonPose")?.M("data")?.L("m_X");
            if (nodos == null || nodos.Count == 0 || pose == null || pose.Count < nodos.Count) return null;
            var d = new DatosHumanos { N = nodos.Count };
            d.Padre = new int[d.N]; d.EjeDe = new int[d.N];
            for (int i = 0; i < d.N; i++)
            {
                var nd = (Mapa)nodos[i];
                d.Padre[i] = nd.I32("m_ParentId", -1);
                d.EjeDe[i] = nd.I32("m_AxesId", -1);
            }
            var ids = Numeros(sk["m_ID"], r);
            d.Ids = new uint[d.N];
            for (int i = 0; i < d.N && i < ids.Length; i++) d.Ids[i] = (uint)ids[i];
            d.T = new Vector3[d.N]; d.Q = new Quaternion[d.N];
            for (int i = 0; i < d.N; i++)
            {
                var x = (Mapa)pose[i];
                d.T[i] = Serial.V3(x.M("t")); d.Q[i] = Serial.Q(x.M("q"));
            }
            var ejes = sk.L("m_AxesArray");
            d.Ejes = new Eje[ejes?.Count ?? 0];
            for (int i = 0; i < d.Ejes.Length; i++)
            {
                var e = (Mapa)ejes[i];
                var l = e.M("m_Limit");
                d.Ejes[i] = new Eje
                {
                    Pre = Serial.Q(e.M("m_PreQ")), Post = Serial.Q(e.M("m_PostQ")), Signo = Serial.V3(e.M("m_Sgn")),
                    Min = Serial.V3(l?.M("m_Min")), Max = Serial.V3(l?.M("m_Max")), Largo = e.F("m_Length"),
                };
            }
            var hb = Numeros(h["m_HumanBoneIndex"], r);
            var masas = h["m_HumanBoneMass"];
            for (int i = 0; i < 25; i++) d.Hueso[i] = i < hb.Length ? (int)hb[i] : -1;
            var ms = masas is List<object> lm ? lm : null;
            for (int i = 0; i < 25; i++) d.Masa[i] = ms != null && i < ms.Count ? Convert.ToSingle(ms[i]) : masas is Array am && i < am.Length ? Convert.ToSingle(am.GetValue(i)) : 0;
            ManoDe(h.M("m_LeftHand")?.M("data"), d.ManoI, r, h.B("m_HasLeftHand", true));
            ManoDe(h.M("m_RightHand")?.M("data"), d.ManoD, r, h.B("m_HasRightHand", true));
            var rx = h.M("m_RootX");
            d.RaizT = Serial.V3(rx?.M("t")); d.RaizQ = Serial.Q(rx?.M("q"));
            d.Escala = h.F("m_Scale", 1);
            d.GiroBrazo = h.F("m_ArmTwist", 0.5f); d.GiroAntebrazo = h.F("m_ForeArmTwist", 0.5f);
            d.GiroMuslo = h.F("m_UpperLegTwist", 0.5f); d.GiroPierna = h.F("m_LegTwist", 0.5f);
            if (d.Hueso[0] < 0 || d.Hueso[0] >= d.N) return null;
            return d;
        }

        static void ManoDe(Mapa m, int[] dest, IResolutor r, bool tiene)
        {
            var l = tiene && m != null ? Numeros(m["m_HandBoneIndex"], r) : Array.Empty<long>();
            for (int i = 0; i < dest.Length; i++) dest[i] = i < l.Length ? (int)l[i] : -1;
        }

        static long[] Numeros(object o, IResolutor r)
        {
            switch (o)
            {
                case Recurso rec: return Numeros(Paquete.ArregloDeRecurso(r.Recurso(rec.Id)), r);
                case List<object> l: { var v = new long[l.Count]; for (int i = 0; i < v.Length; i++) v[i] = Convert.ToInt64(l[i]); return v; }
                case Array a: { var v = new long[a.Length]; for (int i = 0; i < v.Length; i++) v[i] = Convert.ToInt64(a.GetValue(i)); return v; }
                default: return Array.Empty<long>();
            }
        }
    }

    // Cómo saca Mecanim el movimiento de la raíz de un clip humanoide: el objeto se lleva el giro
    // del cuerpo en el plano y su posición en x/z, salvo lo que el clip deja en la pose ("Bake Into Pose").
    internal struct RaizHumana
    {
        public bool Hay, HornearQ, HornearY, HornearXZ, OriginalY;
        public float DesfaseY, Nivel;
        public Vector3 InicioT;
        public Quaternion InicioQ;

        internal static RaizHumana Leer(Mapa mc)
        {
            var x = mc.M("m_StartX");
            return new RaizHumana
            {
                Hay = true,
                HornearQ = mc.B("m_LoopBlendOrientation"), HornearY = mc.B("m_LoopBlendPositionY"), HornearXZ = mc.B("m_LoopBlendPositionXZ"),
                OriginalY = mc.B("m_KeepOriginalPositionY"),
                DesfaseY = mc.F("m_OrientationOffsetY"), Nivel = mc.F("m_Level"),
                InicioT = Serial.V3(x?.M("t")), InicioQ = x != null ? Serial.Q(x.M("q")) : Quaternion.identity,
            };
        }
    }

    // La pose de un humanoide a partir de los valores de un clip (los "músculos" de Unity): cada
    // hueso gira desde sus ejes según sus grados de libertad, y el cuerpo entero se ubica para que
    // su centro de masa y su orientación queden donde dice el clip (RootT/RootQ).
    internal sealed class PoseHumana
    {
        // los atributos de los enlaces de músculo (customType 8)
        internal const int RAIZ_T = 7, RAIZ_Q = 10, CUERPO = 42, DEDOS_I = 97, DEDOS_D = 117, TOTAL = 137;

        // por hueso humano: el grado de libertad del cuerpo que mueve su eje x (giro), y (lado) y z (frente)
        static readonly int[][] DOF =
        {
            null,
            new[] { 23, 22, 21 }, new[] { 31, 30, 29 },   // piernas
            new[] { 25, -1, 24 }, new[] { 33, -1, 32 },   // rodillas
            new[] { -1, 27, 26 }, new[] { -1, 35, 34 },   // pies
            new[] { 2, 1, 0 }, new[] { 5, 4, 3 }, new[] { 8, 7, 6 },   // columna, pecho, pecho alto
            new[] { 11, 10, 9 }, new[] { 14, 13, 12 },    // cuello, cabeza
            new[] { -1, 38, 37 }, new[] { -1, 47, 46 },   // hombros
            new[] { 41, 40, 39 }, new[] { 50, 49, 48 },   // brazos
            new[] { 43, -1, 42 }, new[] { 52, -1, 51 },   // antebrazos
            new[] { -1, 45, 44 }, new[] { -1, 54, 53 },   // manos
            new[] { -1, -1, 28 }, new[] { -1, -1, 36 },   // dedos de los pies
            new[] { -1, 16, 15 }, new[] { -1, 18, 17 },   // ojos
            new[] { -1, 20, 19 },                         // mandíbula
        };

        // para el centro de masa: cada hueso cuenta en el medio entre él y este otro
        static readonly int[] HIJO = { 7, 3, 4, 5, 6, 20, 21, 8, 10, 10, 11, -1, 14, 15, 16, 17, 18, 19, -1, -1, -1, -1, -1, -1, -1 };

        readonly DatosHumanos h;
        readonly Transform raiz;
        readonly Transform[] nodos;
        readonly Vector3[] tl, tg;
        readonly Quaternion[] ql, qg;
        readonly Vector3 corr;
        readonly bool[] escribir;

        internal PoseHumana(Animator an, DatosHumanos h, Enlazador enl)
        {
            this.h = h;
            raiz = an.transform;
            int n = h.N;
            nodos = new Transform[n];
            for (int i = 0; i < n; i++) nodos[i] = enl.Camino(h.Ids[i]);
            tl = new Vector3[n]; tg = new Vector3[n]; ql = new Quaternion[n]; qg = new Quaternion[n];
            escribir = new bool[n];
            for (int b = 1; b < 25; b++) if (h.Hueso[b] >= 0 && h.Hueso[b] < n && DOF[b] != null) escribir[h.Hueso[b]] = true;
            foreach (var x in h.ManoI) if (x >= 0 && x < n) escribir[x] = true;
            foreach (var x in h.ManoD) if (x >= 0 && x < n) escribir[x] = true;
            // Unity calcula el centro de masa con una fórmula propia; la diferencia con la de acá se
            // mide en la pose T (donde el avatar trae el valor de Unity) y se corrige en el marco del cuerpo
            Array.Copy(h.T, tl, n); Array.Copy(h.Q, ql, n);
            Globales();
            var q0 = Orientacion();
            corr = Quaternion.Inverse(q0) * (h.RaizT - CentroMasa());
        }

        void Globales()
        {
            for (int i = 0; i < h.N; i++)
            {
                int p = h.Padre[i];
                if (p < 0 || p >= i) { tg[i] = tl[i]; qg[i] = ql[i]; continue; }
                tg[i] = tg[p] + qg[p] * tl[i];
                qg[i] = qg[p] * ql[i];
            }
        }

        Vector3 Pos(int hueso) { int n = h.Hueso[hueso]; return n >= 0 ? tg[n] : Vector3.zero; }

        // la orientación del cuerpo: arriba de las caderas a los hombros, a la derecha las dos líneas
        Quaternion Orientacion()
        {
            Vector3 li = Pos(1), ld = Pos(2), bi = Pos(14), bd = Pos(15);
            var arriba = ((bi + bd) - (li + ld)) * 0.5f;
            var derecha = (ld - li) + (bd - bi);
            var frente = Vector3.Cross(derecha, arriba);
            if (frente.sqrMagnitude < 1e-12f || arriba.sqrMagnitude < 1e-12f) return Quaternion.identity;
            return Quaternion.LookRotation(frente.normalized, arriba.normalized);
        }

        Vector3 CentroMasa()
        {
            var c = Vector3.zero;
            for (int b = 0; b < 25; b++)
            {
                if (h.Hueso[b] < 0 || h.Masa[b] == 0) continue;
                int hj = HIJO[b];
                if (b == 8 && h.Hueso[9] >= 0) hj = 9;   // con pecho alto, el pecho llega hasta él
                var p = Pos(b);
                c += h.Masa[b] * (hj >= 0 && h.Hueso[hj] >= 0 ? (p + Pos(hj)) * 0.5f : p);
            }
            return c;
        }

        // math::FromAxes de Mecanim: límites → ángulos → cuaternión ZY + giro → marco del hueso
        static Quaternion DesdeEjes(in Eje e, float x, float y, float z)
        {
            float ax = (x < 0 ? -x * e.Min.x : x * e.Max.x) * e.Signo.x;
            float ay = (y < 0 ? -y * e.Min.y : y * e.Max.y) * e.Signo.y;
            float az = (z < 0 ? -z * e.Min.z : z * e.Max.z) * e.Signo.z;
            float tx = MedioTan(ax), ty = MedioTan(ay), tz = MedioTan(az);
            var zy = Normal(new Quaternion(tx, ty + tx * tz, tz - tx * ty, 1));
            return Normal(e.Pre * zy * Quaternion.Inverse(e.Post));
        }

        static float MedioTan(float a) => (float)Math.Tan(0.5 * Math.Clamp(a, -Math.PI + 1e-5, Math.PI - 1e-5));

        static Quaternion Normal(Quaternion q)
        {
            float l = (float)Math.Sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
            return l < 1e-8f ? Quaternion.identity : new Quaternion(q.x / l, q.y / l, q.z / l, q.w / l);
        }

        void Hueso(int n, float x, float y, float z)
        {
            if (n < 0 || n >= h.N) return;
            int e = h.EjeDe[n];
            if (e < 0 || e >= h.Ejes.Length) return;
            ql[n] = DesdeEjes(h.Ejes[e], x, y, z);
        }

        // El hueso se queda con una parte de su giro (alrededor de su eje x) y el resto pasa al hijo,
        // del lado del padre: la orientación final del hijo no cambia, sólo cómo se tuerce la malla.
        void Repartir(int padre, int hijo, float[] v, float parte)
        {
            var d = DOF[padre];
            int np = h.Hueso[padre], nh = h.Hueso[hijo];
            if (d == null || d[0] < 0 || np < 0 || nh < 0 || parte >= 1) return;
            int e = h.EjeDe[np];
            if (e < 0 || e >= h.Ejes.Length) return;
            ref readonly var ej = ref h.Ejes[e];
            float x = v[CUERPO + d[0]];
            float th = (x < 0 ? -x * ej.Min.x : x * ej.Max.x) * ej.Signo.x;
            if (th == 0) return;
            ql[np] = DesdeEjes(ej, x * parte, d[1] >= 0 ? v[CUERPO + d[1]] : 0, d[2] >= 0 ? v[CUERPO + d[2]] : 0);
            float m = 0.5f * (1 - parte) * th;
            var giro = new Quaternion((float)Math.Sin(m), 0, 0, (float)Math.Cos(m));
            ql[nh] = Normal(ej.Post * giro * Quaternion.Inverse(ej.Post) * ql[nh]);
        }

        void Dedos(int[] mano, float[] v, int base_)
        {
            for (int f = 0; f < 5; f++)
            {
                int o = base_ + f * 4;
                Hueso(mano[f * 3], 0, v[o + 1], v[o]);       // proximal: abrir (y) y estirar (z)
                Hueso(mano[f * 3 + 1], 0, 0, v[o + 2]);
                Hueso(mano[f * 3 + 2], 0, 0, v[o + 3]);
            }
        }

        // v: los valores mezclados de los enlaces de músculo, por atributo
        internal void Aplicar(float[] v)
        {
            int n = h.N;
            Array.Copy(h.T, tl, n); Array.Copy(h.Q, ql, n);
            for (int b = 1; b < 25; b++)
            {
                var d = DOF[b];
                if (d == null || h.Hueso[b] < 0) continue;
                Hueso(h.Hueso[b], d[0] >= 0 ? v[CUERPO + d[0]] : 0, d[1] >= 0 ? v[CUERPO + d[1]] : 0, d[2] >= 0 ? v[CUERPO + d[2]] : 0);
            }
            Dedos(h.ManoI, v, DEDOS_I);
            Dedos(h.ManoD, v, DEDOS_D);
            // el giro de brazos y piernas se reparte con la articulación siguiente (Upper Arm Twist etc.);
            // primero las de abajo, porque el reparto de arriba se suma a lo que ya tiene el hijo
            Repartir(16, 18, v, h.GiroAntebrazo); Repartir(17, 19, v, h.GiroAntebrazo);
            Repartir(3, 5, v, h.GiroPierna); Repartir(4, 6, v, h.GiroPierna);
            Repartir(14, 16, v, h.GiroBrazo); Repartir(15, 17, v, h.GiroBrazo);
            Repartir(1, 3, v, h.GiroMuslo); Repartir(2, 4, v, h.GiroMuslo);
            Globales();
            // el cuerpo donde dice el clip; RootQ está tomado desde la orientación de la pose T
            var cq = Orientacion();
            var ct = CentroMasa() + cq * corr;
            var rt = new Vector3(v[RAIZ_T], v[RAIZ_T + 1], v[RAIZ_T + 2]) * h.Escala;
            var rq = Normal(new Quaternion(v[RAIZ_Q], v[RAIZ_Q + 1], v[RAIZ_Q + 2], v[RAIZ_Q + 3]));
            // la pose del esqueleto humano está en el espacio del Animator (el nodo 0 cuelga de él)
            var dq = rq * h.RaizQ * Quaternion.Inverse(cq);
            int c = h.Hueso[0];
            var ct2 = rt + dq * (tg[c] - ct);
            var cq2 = Normal(dq * qg[c]);
            // las caderas, locales a su padre de verdad (los nodos de arriba no se animan)
            var tc = nodos[c];
            if (tc != null && !tc.destruido)
            {
                Relativo(tc.parent, out var pp, out var rp, out float ep);
                var ip = Quaternion.Inverse(rp);
                tc.PonerLocal(0, ip * (ct2 - pp) / ep, default);
                tc.PonerLocal(1, default, Normal(ip * cq2));
                tc.AplicarLocal();
            }
            for (int i = 0; i < n; i++)
            {
                if (!escribir[i]) continue;
                var t = nodos[i];
                if (t == null || t.destruido) continue;
                t.PonerLocal(1, default, ql[i]);
                t.AplicarLocal();
            }
        }

        // la posición, rotación y escala (uniforme) de un Transform respecto del Animator
        void Relativo(Transform t, out Vector3 p, out Quaternion r, out float e)
        {
            p = Vector3.zero; r = Quaternion.identity; e = 1;
            for (var x = t; x != null && x != raiz; x = x.parent)
            {
                p = x.posLocal + x.rotLocal * Vector3.Scale(x.escLocal, p);
                r = x.rotLocal * r;
                e *= x.escLocal.x;
            }
            if (Math.Abs(e) < 1e-8f) e = 1;
        }

        // el cuerpo de un clip relativo a la raíz que se mueve con él (RootT/RootQ en las muestras)
        internal static void ExtraerRaiz(in RaizHumana rz, float[] s, int[] c)
        {
            if (!rz.Hay || c[0] < 0 || c[3] < 0) return;
            var t = new Vector3(s[c[0]], s[c[1]], s[c[2]]);
            var q = new Quaternion(s[c[3]], s[c[4]], s[c[5]], s[c[6]]);
            var giro = Plano(rz.HornearQ ? rz.InicioQ : q);
            var inv = Quaternion.Inverse(giro);
            var mov = new Vector3(rz.HornearXZ ? rz.InicioT.x : t.x, 0, rz.HornearXZ ? rz.InicioT.z : t.z);
            var p = inv * (t - mov);
            if (!rz.HornearY && !rz.OriginalY) p.y = rz.InicioT.y;
            p.y += rz.Nivel;
            q = inv * q;
            if (rz.DesfaseY != 0) q = Quaternion.AngleAxis(rz.DesfaseY * Mathf.Rad2Deg, Vector3.up) * q;
            s[c[0]] = p.x; s[c[1]] = p.y; s[c[2]] = p.z;
            s[c[3]] = q.x; s[c[4]] = q.y; s[c[5]] = q.z; s[c[6]] = q.w;
        }

        // el giro alrededor del eje vertical que tiene un cuaternión
        static Quaternion Plano(Quaternion q) => Normal(new Quaternion(0, q.y, 0, q.w));

        // el valor de un atributo cuando ningún clip lo anima
        internal static float Defecto(int atributo) =>
            atributo == RAIZ_T + 1 ? 1 :
            atributo == RAIZ_Q + 3 || (atributo >= 14 && atributo < CUERPO && (atributo - 14) % 7 == 6) ? 1 : 0;
    }
}

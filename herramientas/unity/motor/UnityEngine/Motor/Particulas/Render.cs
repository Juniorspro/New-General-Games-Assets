using System;
using System.Collections.Generic;
using Porteo;
using Porteo.Datos;
using Porteo.Particulas;
using Porteo.Render;
using Object = UnityEngine.Object;

namespace UnityEngine
{
    // La geometría de un sistema de partículas, armada en la CPU para cada cámara que lo ve (los
    // billboards miran a la cámara): una malla dinámica en el espacio del mundo con dos submallas,
    // las partículas (primer material) y sus estelas (el segundo). Los vértices llevan posición,
    // normal, color y uv, lo que esperan los shaders de partículas sin streams propios.
    public sealed partial class ParticleSystemRenderer : Renderer
    {
        internal int modo;             // 0 billboard, 1 estirado, 2 horizontal, 3 vertical, 4 malla
        internal int ordenModo;        // 0 ninguno, 1 distancia, 2 más viejas adelante, 3 más jóvenes adelante
        internal int alineacion;       // 0 vista, 1 mundo, 2 local, 3 mirando a la cámara, 4 velocidad
        internal float tamMinPantalla, tamMaxPantalla = 0.5f, escalaVelCamara, escalaVel, escalaLargo = 2, empuje, dirNormal = 1;
        internal Vector3 pivote;
        internal Mesh mallaParticula;

        ParticleSystem sistema;
        Mesh malla;
        byte[] vb = Array.Empty<byte>(), ib = Array.Empty<byte>();
        int[] ordenIdx = Array.Empty<int>();
        float[] ordenClave = Array.Empty<float>();
        int cuadroArmado = -1;
        Camera camArmada;

        // la malla de cada partícula (modo malla), decodificada una vez
        Mesh mallaLeida;
        Vector3[] mv, mn; Vector2[] muv; Color32[] mc; int[] mt;

        const int PASO = 36;   // posición 12, normal 12, color 4, uv 8

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            base.LeerNativo(m, r);
            modo = m.I32("m_RenderMode");
            ordenModo = m.I32("m_SortMode");
            alineacion = m.I32("m_RenderAlignment");
            tamMinPantalla = m.F("m_MinParticleSize");
            tamMaxPantalla = m.F("m_MaxParticleSize", 0.5f);
            escalaVelCamara = m.F("m_CameraVelocityScale");
            escalaVel = m.F("m_VelocityScale");
            escalaLargo = m.F("m_LengthScale", 2);
            empuje = m.F("m_SortingFudge");
            dirNormal = m.F("m_NormalDirection", 1);
            pivote = Serial.V3(m.M("m_Pivot"));
            mallaParticula = r.Resolver(m.P("m_Mesh")) as Mesh;
        }

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            base.CopiarDe(o, remap);
            var x = (ParticleSystemRenderer)o;
            modo = x.modo; ordenModo = x.ordenModo; alineacion = x.alineacion;
            tamMinPantalla = x.tamMinPantalla; tamMaxPantalla = x.tamMaxPantalla;
            escalaVelCamara = x.escalaVelCamara; escalaVel = x.escalaVel; escalaLargo = x.escalaLargo;
            empuje = x.empuje; dirNormal = x.dirNormal; pivote = x.pivote; mallaParticula = x.mallaParticula;
        }

        internal override void AlDestruirse()
        {
            base.AlDestruirse();
            if (malla != null) { malla.AlLiberar(); malla = null; }
        }

        internal ParticleSystem Sistema
        {
            get
            {
                if ((object)sistema == null || sistema.destruido || sistema.go != go) sistema = go?.GetComponent<ParticleSystem>();
                return sistema;
            }
        }

        public ParticleSystemRenderMode renderMode { get => (ParticleSystemRenderMode)modo; set => modo = (int)value; }
        public ParticleSystemSortMode sortMode { get => (ParticleSystemSortMode)ordenModo; set => ordenModo = (int)value; }
        public float lengthScale { get => escalaLargo; set => escalaLargo = value; }
        public float velocityScale { get => escalaVel; set => escalaVel = value; }
        public float cameraVelocityScale { get => escalaVelCamara; set => escalaVelCamara = value; }
        public float maxParticleSize { get => tamMaxPantalla; set => tamMaxPantalla = value; }
        public float minParticleSize { get => tamMinPantalla; set => tamMinPantalla = value; }
        public float sortingFudge { get => empuje; set => empuje = value; }
        public Vector3 pivot { get => pivote; set => pivote = value; }
        public Mesh mesh { get => mallaParticula; set => mallaParticula = value; }
        public Material trailMaterial
        {
            get => mats.Length > 1 ? mats[1] : null;
            set { if (mats.Length < 2) Array.Resize(ref mats, 2); mats[1] = value; }
        }

        // cuánto hay que agrandar los límites de las posiciones para que entre cada partícula
        internal float Expansion(float tam, float rapidez)
        {
            float e = tam * (modo == 4 ? MitadMalla() : 0.71f);
            if (modo == 1) e = Math.Max(e, tam * escalaLargo + rapidez * escalaVel);
            return e + Math.Abs(pivote.x) * tam + Math.Abs(pivote.y) * tam + Math.Abs(pivote.z) * tam;
        }

        float MitadMalla()
        {
            if ((object)mallaParticula == null) return 0.71f;
            var b = mallaParticula.bounds;
            return b.center.magnitude + b.extents.magnitude;
        }

        // ── lo que pide el dibujo ──
        internal override Mesh MallaParaDibujar()
        {
            var s = Sistema;
            if (s == null || (s.n == 0 && (s.estelas == null || s.estelas.Vacias))) return null;
            if (malla == null) { malla = new Mesh { m_Name = "Particles " + go?.name }; CanalesMalla(malla); }
            return malla;
        }

        internal override Bounds CalcularLimites() => Sistema?.limites ?? new Bounds(transform.position, Vector3.zero);
        internal override bool VerticesEnMundo => true;
        internal override bool LimitesCambian => true;
        internal override bool PrepararDibujo(Camera cam) => Armar(cam);

        static void CanalesMalla(Mesh m)
        {
            m.canales[Canales.POSICION] = new CanalMalla { Stream = 0, Offset = 0, Formato = 0, Dim = 3, Relleno = 3 };
            m.canales[Canales.NORMAL] = new CanalMalla { Stream = 0, Offset = 12, Formato = 0, Dim = 3, Relleno = 3 };
            m.canales[Canales.COLOR] = new CanalMalla { Stream = 0, Offset = 24, Formato = 2, Dim = 4, Relleno = 4 };
            m.canales[Canales.UV0] = new CanalMalla { Stream = 0, Offset = 28, Formato = 0, Dim = 2, Relleno = 2 };
            m.submallas = new Submalla[2];
        }

        void LeerMalla()
        {
            if (ReferenceEquals(mallaLeida, mallaParticula)) return;
            mallaLeida = mallaParticula;
            if ((object)mallaParticula == null) { mv = null; return; }
            mv = mallaParticula.vertices;
            mn = mallaParticula.normals;
            muv = mallaParticula.uv;
            mc = mallaParticula.colors32;
            mt = mallaParticula.triangles;
            if (mn.Length != mv.Length) mn = null;
            if (muv.Length != mv.Length) muv = null;
            if (mc.Length != mv.Length) mc = null;
        }

        // ── armar la geometría para una cámara ──
        unsafe bool Armar(Camera cam)
        {
            var s = Sistema;
            if (s == null || malla == null) return false;
            if (cuadroArmado == Time.frameCount && ReferenceEquals(camArmada, cam)) return malla.submallas[0].Cantidad + malla.submallas[1].Cantidad > 0;
            cuadroArmado = Time.frameCount; camArmada = cam;
            var a = s.aj;
            int n = s.n;
            bool mallaModo = modo == 4;
            if (mallaModo) { LeerMalla(); if (mv == null || mv.Length == 0 || mt == null || mt.Length == 0) n = 0; }
            int vPorP = mallaModo && mv != null ? mv.Length : 4, iPorP = mallaModo && mt != null ? mt.Length : 6;
            // las estelas: dos vértices por punto (más la cabeza)
            int vEst = 0, iEst = 0;
            var est = s.estelas;
            bool hayEstelas = est != null && mats.Length > 1 && (object)mats[1] != null && !est.Vacias;
            if (hayEstelas)
                foreach (var e in est.lista)
                    if (e.Usada) { int k = e.Cuenta + (e.Huerfana ? 0 : 1); if (k >= 2) { vEst += k * 2; iEst += (k - 1) * 6; } }
            int nv = n * vPorP + vEst, ni = n * iPorP + iEst;
            if (nv == 0) { malla.submallas[0].Cantidad = 0; malla.submallas[1].Cantidad = 0; return false; }
            bool i32 = nv > 65535;
            int tamI = i32 ? 4 : 2;
            if (vb.Length < nv * PASO) vb = new byte[Math.Max(nv * PASO, vb.Length * 2)];
            if (ib.Length < ni * tamI) ib = new byte[Math.Max(ni * tamI, ib.Length * 2)];

            var ct = cam.transform;
            Vector3 camPos = ct.position, camAdelante = ct.forward, camArriba = ct.up, camDerecha = ct.right;
            var tr = s.transform;
            bool mundo = s.EnMundo;
            var marco = mundo ? Matrix4x4.identity : Matrix4x4.TRS(tr.position, tr.rotation, Vector3.one);
            var rotMarco = mundo ? Quaternion.identity : tr.rotation;
            // tamaño máximo en pantalla: una fracción del alto del viewport a esa distancia
            float tanMitad = cam.orto ? 0 : (float)Math.Tan(cam.fov * 0.5f * Math.PI / 180);
            bool limitarTam = !mallaModo && tamMaxPantalla > 0 && tamMaxPantalla < 10;

            // orden de dibujo dentro del sistema
            if (ordenIdx.Length < n) { ordenIdx = new int[Math.Max(n, 16)]; ordenClave = new float[ordenIdx.Length]; }
            for (int i = 0; i < n; i++) ordenIdx[i] = i;
            if (ordenModo != 0 && n > 1)
            {
                for (int i = 0; i < n; i++)
                {
                    ref var q = ref s.p[i];
                    ordenClave[i] = ordenModo == 1 ? -((mundo ? q.Pos : marco.MultiplyPoint3x4(q.Pos)) - camPos).sqrMagnitude
                        : ordenModo == 2 ? -q.Edad : q.Edad;
                }
                Array.Sort(ordenClave, ordenIdx, 0, n);
            }

            int nv0 = 0, ni0 = 0;
            fixed (byte* vbp = vb)
            fixed (byte* ibp = ib)
            {
                byte* v = vbp;
                for (int k = 0; k < n; k++)
                {
                    ref var q = ref s.p[ordenIdx[k]];
                    var wp = mundo ? q.Pos : marco.MultiplyPoint3x4(q.Pos);
                    var tam = s.TamActual(q);
                    var col = (Color32)s.ColorActual(q);
                    uint c = (uint)(col.r | col.g << 8 | col.b << 16 | col.a << 24);
                    // el cuadro de la hoja de texturas
                    float u0 = 0, v0 = 0, du = 1, dv = 1;
                    if (a.Hoja)
                    {
                        int cuadro = s.CuadroHoja(q);
                        int cx = cuadro % a.HojaX, cy = cuadro / a.HojaX;
                        du = 1f / a.HojaX; dv = 1f / a.HojaY;
                        u0 = cx * du; v0 = 1 - (cy + 1) * dv;
                    }
                    if (limitarTam)
                    {
                        float d = Vector3.Dot(wp - camPos, camAdelante);
                        float alto = cam.orto ? cam.tamOrto * 2 : 2 * Math.Max(d, 0) * tanMitad;
                        float tope = tamMaxPantalla * alto, piso = tamMinPantalla * alto;
                        float mayor = Math.Max(tam.x, tam.y);
                        if (mayor > tope && mayor > 0) tam *= tope / mayor;
                        else if (mayor < piso && mayor > 0) tam *= piso / mayor;
                    }
                    if (mallaModo)
                    {
                        Quaternion rq = a.Rot3D ? Quaternion.Euler(q.Rot * Mathf.Rad2Deg) : Quaternion.Euler(0, 0, q.Rot.z * Mathf.Rad2Deg);
                        Quaternion al = alineacion switch
                        {
                            0 => ct.rotation,
                            2 => tr.rotation,
                            3 => Quaternion.LookRotation(wp - camPos, camArriba),
                            4 => Velocidad(q, rotMarco) is var vv && vv.sqrMagnitude > 1e-8f ? Quaternion.LookRotation(vv) : rotMarco,
                            _ => Quaternion.identity,
                        };
                        var R = al * rq;
                        var piv = Vector3.Scale(pivote, tam);
                        int baseV = nv0;
                        for (int j = 0; j < mv.Length; j++)
                        {
                            var pv = wp + R * (Vector3.Scale(mv[j], tam) + piv);
                            var nn = mn != null ? R * mn[j] : -camAdelante;
                            var uv = muv != null ? muv[j] : default;
                            uint cj = c;
                            if (mc != null)
                            {
                                var m2 = mc[j];
                                cj = (uint)(m2.r * col.r / 255 | (m2.g * col.g / 255) << 8 | (m2.b * col.b / 255) << 16 | (m2.a * col.a / 255) << 24);
                            }
                            Vertice(ref v, pv, nn, cj, u0 + uv.x * du, v0 + uv.y * dv);
                        }
                        for (int j = 0; j < mt.Length; j++) Indice(ibp, ni0++, baseV + mt[j], i32);
                        nv0 += mv.Length;
                        continue;
                    }
                    // los ejes del quad
                    Vector3 der, arr, nrm;
                    float ang = q.Rot.z;
                    switch (modo)
                    {
                        case 1:
                        {
                            // estirado: a lo largo de la velocidad (en el mundo), lo más de frente posible
                            var vel = Velocidad(q, rotMarco);
                            float rap = vel.magnitude;
                            var dir = rap > 1e-5f ? vel / rap : camArriba;
                            var aCam = camPos - wp;
                            var lado = Vector3.Cross(aCam, dir);
                            if (lado.sqrMagnitude < 1e-10f) lado = camDerecha;
                            der = lado.normalized;
                            float largo = tam.y * escalaLargo + rap * escalaVel;
                            arr = dir;
                            nrm = aCam.sqrMagnitude > 1e-10f ? aCam.normalized : -camAdelante;
                            tam = new Vector3(tam.x, largo, tam.z);
                            ang = 0;
                            break;
                        }
                        case 2:
                            der = new Vector3(1, 0, 0); arr = new Vector3(0, 0, 1); nrm = new Vector3(0, 1, 0);
                            break;
                        case 3:
                        {
                            var d = new Vector3(camDerecha.x, 0, camDerecha.z);
                            der = d.sqrMagnitude > 1e-8f ? d.normalized : new Vector3(1, 0, 0);
                            arr = new Vector3(0, 1, 0);
                            nrm = Vector3.Cross(der, arr);
                            break;
                        }
                        default:
                            switch (alineacion)
                            {
                                case 1: der = new Vector3(1, 0, 0); arr = new Vector3(0, 1, 0); nrm = new Vector3(0, 0, -1); break;
                                case 2: der = tr.right; arr = tr.up; nrm = -tr.forward; break;
                                case 3:
                                {
                                    var aCam = camPos - wp;
                                    nrm = aCam.sqrMagnitude > 1e-10f ? aCam.normalized : -camAdelante;
                                    var dd = Vector3.Cross(camArriba, nrm);
                                    der = dd.sqrMagnitude > 1e-10f ? dd.normalized : camDerecha;
                                    arr = Vector3.Cross(nrm, der);
                                    break;
                                }
                                case 4:
                                {
                                    var vel = Velocidad(q, rotMarco);
                                    arr = vel.sqrMagnitude > 1e-10f ? vel.normalized : camArriba;
                                    var dd = Vector3.Cross(arr, -camAdelante);
                                    der = dd.sqrMagnitude > 1e-10f ? dd.normalized : camDerecha;
                                    nrm = Vector3.Cross(der, arr);
                                    break;
                                }
                                default: der = camDerecha; arr = camArriba; nrm = -camAdelante; break;
                            }
                            break;
                    }
                    // la rotación positiva gira en el sentido del reloj visto de frente
                    if (ang != 0)
                    {
                        float cs = (float)Math.Cos(ang), sn = (float)Math.Sin(ang);
                        var d2 = der * cs - arr * sn;
                        arr = der * sn + arr * cs;
                        der = d2;
                    }
                    // el pivote corre el quad en unidades del tamaño (z: hacia adelante, lejos de la cámara)
                    var centro = wp + der * (pivote.x * tam.x) + arr * (pivote.y * tam.y) - nrm * (pivote.z * Math.Max(tam.x, tam.y));
                    var hx = der * (tam.x * 0.5f);
                    var hy = arr * (tam.y * 0.5f);
                    // normales: hacia la cámara, o curvas como una esfera (normalDirection < 1)
                    Vector3 n0 = nrm, n1 = nrm, n2 = nrm, n3 = nrm;
                    if (dirNormal < 0.999f)
                    {
                        float k1 = 1 - dirNormal;
                        n0 = (nrm * dirNormal + (-der - arr).normalized * k1).normalized;
                        n1 = (nrm * dirNormal + (der - arr).normalized * k1).normalized;
                        n2 = (nrm * dirNormal + (der + arr).normalized * k1).normalized;
                        n3 = (nrm * dirNormal + (-der + arr).normalized * k1).normalized;
                    }
                    int b = nv0;
                    Vertice(ref v, centro - hx - hy, n0, c, u0, v0);
                    Vertice(ref v, centro + hx - hy, n1, c, u0 + du, v0);
                    Vertice(ref v, centro + hx + hy, n2, c, u0 + du, v0 + dv);
                    Vertice(ref v, centro - hx + hy, n3, c, u0, v0 + dv);
                    nv0 += 4;
                    // en el sentido del reloj visto de frente (la cara de adelante para Unity)
                    Indice(ibp, ni0++, b, i32); Indice(ibp, ni0++, b + 2, i32); Indice(ibp, ni0++, b + 1, i32);
                    Indice(ibp, ni0++, b, i32); Indice(ibp, ni0++, b + 3, i32); Indice(ibp, ni0++, b + 2, i32);
                }
                int indicesParticulas = ni0;
                if (hayEstelas) ArmarEstelas(s, ref v, ibp, ref nv0, ref ni0, i32, camPos, marco, mundo);
                malla.submallas[0] = new Submalla { Primero = 0, Cantidad = indicesParticulas, Topologia = 0 };
                malla.submallas[1] = new Submalla { Primero = indicesParticulas, Cantidad = ni0 - indicesParticulas, Topologia = 0 };
            }
            malla.PonerDinamica(vb, nv0, PASO, ib, ni0, i32, s.limites);
            return ni0 > 0;
        }

        // la velocidad de una partícula en el mundo (la del cuadro: base más la del módulo)
        static Vector3 Velocidad(in Part q, Quaternion rotMarco) => rotMarco * (q.Vel + q.VelAnim);

        static unsafe void Vertice(ref byte* d, Vector3 p, Vector3 nrm, uint col, float u, float v)
        {
            float* f = (float*)d;
            f[0] = p.x; f[1] = p.y; f[2] = p.z;
            f[3] = nrm.x; f[4] = nrm.y; f[5] = nrm.z;
            *(uint*)(d + 24) = col;
            f[7] = u; f[8] = v;
            d += PASO;
        }

        static unsafe void Indice(byte* d, int i, int valor, bool i32)
        {
            if (i32) ((int*)d)[i] = valor;
            else ((ushort*)d)[i] = (ushort)valor;
        }

        // las estelas: una cinta por partícula de cara a la cámara, de la cabeza a la cola
        Vector3[] puntos = new Vector3[32];

        unsafe void ArmarEstelas(ParticleSystem s, ref byte* v, byte* ibp, ref int nv0, ref int ni0, bool i32, Vector3 camPos, in Matrix4x4 marco, bool mundo)
        {
            var a = s.aj;
            var es = a.Estelas;
            var est = s.estelas;
            // lo que cambia con la partícula viva: su color y su ancho
            for (int i = 0; i < s.n; i++)
            {
                ref var q = ref s.p[i];
                if (q.Estela < 0) continue;
                var e = est.lista[q.Estela];
                var tam = s.TamActual(q);
                e.Ancho = es.TamAfectaAncho ? Math.Max(tam.x, tam.y) : 1;
                var c = es.HeredaColor ? s.ColorActual(q) : Color.white;
                e.Col = c * es.ColorEnVida.Eval(q.Edad / q.Vida, ParticleSystem.Hash(q.Semilla, 32));
            }
            foreach (var e in est.lista)
            {
                if (!e.Usada) continue;
                // los puntos en el mundo: la cabeza (si la partícula vive y ya se alejó del último) y
                // después del más nuevo al más viejo
                if (puntos.Length < e.Cuenta + 1) puntos = new Vector3[(e.Cuenta + 1) * 2];
                int k = 0;
                if (!e.Huerfana && (e.Cuenta == 0 || (e.Cabeza - e.P[e.Cuenta - 1]).sqrMagnitude > 1e-8f))
                    puntos[k++] = mundo ? e.Cabeza : marco.MultiplyPoint3x4(e.Cabeza);
                for (int j = e.Cuenta - 1; j >= 0; j--) puntos[k++] = mundo ? e.P[j] : marco.MultiplyPoint3x4(e.P[j]);
                if (k < 2) continue;
                int b = nv0;
                for (int j = 0; j < k; j++)
                {
                    var w = puntos[j];
                    var dir = puntos[Math.Max(j - 1, 0)] - puntos[Math.Min(j + 1, k - 1)];
                    var aCam = camPos - w;
                    var lado = Vector3.Cross(dir, aCam);
                    lado = lado.sqrMagnitude > 1e-12f ? lado.normalized : Vector3.up;
                    float u = j / (float)(k - 1);
                    float ancho = e.Ancho * es.AnchoEnEstela.Eval(u, 0.5f) * 0.5f;
                    var col = (Color32)(e.Col * es.ColorEnEstela.Eval(u, 0.5f));
                    uint c = (uint)(col.r | col.g << 8 | col.b << 16 | col.a << 24);
                    var nrm = aCam.sqrMagnitude > 1e-12f ? aCam.normalized : Vector3.up;
                    Vertice(ref v, w + lado * ancho, nrm, c, u, 1);
                    Vertice(ref v, w - lado * ancho, nrm, c, u, 0);
                }
                for (int j = 0; j < k - 1; j++)
                {
                    int p0 = b + j * 2;
                    Indice(ibp, ni0++, p0, i32); Indice(ibp, ni0++, p0 + 1, i32); Indice(ibp, ni0++, p0 + 2, i32);
                    Indice(ibp, ni0++, p0 + 1, i32); Indice(ibp, ni0++, p0 + 3, i32); Indice(ibp, ni0++, p0 + 2, i32);
                }
                nv0 += k * 2;
            }
        }
    }

    public enum ParticleSystemRenderMode { Billboard = 0, Stretch = 1, HorizontalBillboard = 2, VerticalBillboard = 3, Mesh = 4, None = 5 }
    public enum ParticleSystemSortMode { None = 0, Distance = 1, OldestInFront = 2, YoungestInFront = 3 }
}

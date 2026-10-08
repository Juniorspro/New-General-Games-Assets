using System;
using System.Collections.Generic;
using Porteo;
using Porteo.Animacion;
using Porteo.Datos;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Porteo.Animacion
{
    // Una curva de un clip en tramos cúbicos: v = ((a x + b) x + c) x + d, con x el tiempo desde
    // el comienzo del tramo. Es lo que guarda el StreamedClip de Mecanim; las curvas legacy
    // (Hermite entre claves) se pasan a la misma forma.
    internal sealed class Curva
    {
        internal float[] T = Array.Empty<float>();
        internal float[] C = Array.Empty<float>();
        int ultimo;

        internal float Evaluar(float t)
        {
            var ts = T;
            int n = ts.Length;
            if (n == 0) return 0;
            int i = ultimo;
            if (i >= n || ts[i] > t || (i + 1 < n && ts[i + 1] <= t))
            {
                if (t < ts[0]) i = 0;
                else
                {
                    int lo = 0, hi = n - 1;
                    while (lo < hi) { int m = (lo + hi + 1) >> 1; if (ts[m] <= t) lo = m; else hi = m - 1; }
                    i = lo;
                }
                ultimo = i;
            }
            int k = i * 4;
            float a = C[k], b = C[k + 1], c = C[k + 2], d = C[k + 3];
            if (a == 0 && b == 0 && c == 0) return d;
            float x = t - ts[i];
            if (x <= 0) return d;
            return ((a * x + b) * x + c) * x + d;
        }

        // una curva legacy (claves con tangentes): Hermite por tramo; tangente infinita = escalón
        internal static Curva DeClaves(List<(float t, float v, float entra, float sale)> ks)
        {
            var c = new Curva();
            int n = ks.Count;
            c.T = new float[n];
            c.C = new float[n * 4];
            for (int i = 0; i < n; i++)
            {
                var k0 = ks[i];
                c.T[i] = k0.t;
                int j = i * 4;
                c.C[j + 3] = k0.v;
                if (i + 1 >= n) continue;
                var k1 = ks[i + 1];
                float dx = k1.t - k0.t;
                if (dx <= 0 || float.IsInfinity(k0.sale) || float.IsInfinity(k1.entra)) continue;
                float m0 = k0.sale, m1 = k1.entra, dy = k1.v - k0.v;
                c.C[j + 2] = m0;
                c.C[j + 1] = (3 * dy / dx - 2 * m0 - m1) / dx;
                c.C[j] = (m0 + m1 - 2 * dy / dx) / (dx * dx);
            }
            return c;
        }
    }

    // A qué apunta un grupo de curvas de un clip (los GenericBinding de Mecanim).
    internal struct Enlace
    {
        public uint Ruta;          // CRC-32 del camino desde el Animator ("" es él mismo)
        public uint Atributo;      // en Transform: 1 posición, 2 rotación, 3 escala, 4 euler
        public int Clase;          // classID del componente (4 Transform, 1 GameObject, 114 script...)
        public int Especial;       // customType de Unity (8 músculo, 22 material, 28 RectTransform...)
        public Object Script;      // el MonoScript (curvas de campos de scripts)
        public bool EsPPtr;
        public int Curva;          // índice de su primera curva
        public int N;              // cuántas curvas (3 o 4 en los Transform, 1 en lo demás)
        public string Nombre;      // en los clips legacy: el atributo tal cual (los de Mecanim sólo traen el hash)
    }

    internal struct EventoClip
    {
        public float Tiempo;
        public string Funcion;
        public string Texto;
        public Object Objeto;
        public float Flotante;
        public int Entero;
        public int Opciones;
    }
}

namespace UnityEngine
{
    // Un clip: las curvas en el formato de Mecanim (streamed, dense y constant, en ese orden de
    // índices) o, en los clips legacy, las curvas del editor pasadas a tramos cúbicos.
    public sealed partial class AnimationClip : Motion
    {
        internal Curva[] curvas = Array.Empty<Curva>();   // las streamed (y las legacy)
        internal float[] denso = Array.Empty<float>();
        internal int nDenso, cuadrosDenso;
        internal float inicioDenso, ritmoDenso = 30;
        internal float[] constantes = Array.Empty<float>();
        internal Enlace[] enlaces = Array.Empty<Enlace>();
        internal Object[] objetosPPtr = Array.Empty<Object>();
        internal EventoClip[] eventos = Array.Empty<EventoClip>();
        internal float inicio, fin;
        internal bool bucle, legado;
        internal float frecuencia = 60;
        internal WrapMode envoltura;
        internal Bounds limites;
        internal RaizHumana raizHumana;           // cómo se saca el movimiento de la raíz en los clips humanoides

        public AnimationClip() { m_Name = ""; }

        internal int NCurvas => curvas.Length + nDenso + constantes.Length;

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            legado = m.B("m_Legacy");
            frecuencia = m.F("m_SampleRate", 60);
            envoltura = (WrapMode)m.I32("m_WrapMode");
            var b = m.M("m_Bounds");
            limites = new Bounds { center = Serial.V3(b?.M("m_Center")), extents = Serial.V3(b?.M("m_Extent")) };
            var mc = m.M("m_MuscleClip");
            if (mc != null)
            {
                inicio = mc.F("m_StartTime");
                fin = mc.F("m_StopTime");
                bucle = mc.B("m_LoopTime");
                var d = mc.M("m_Clip")?.M("data");
                if (d != null) LeerMecanim(d, r);
                raizHumana = RaizHumana.Leer(mc);
            }
            var bc = m.M("m_ClipBindingConstant");
            if (bc != null) LeerEnlaces(bc, r);
            if (legado) LeerLegado(m, r);
            LeerEventos(m, r);
        }

        // ── Mecanim ──
        void LeerMecanim(Mapa d, IResolutor r)
        {
            var sc = d.M("m_StreamedClip");
            int nStream = sc?.I32("curveCount") ?? 0;
            if (nStream > 0) curvas = Stream(Enteros(sc["data"], r), nStream);
            var dc = d.M("m_DenseClip");
            if (dc != null && dc.I32("m_CurveCount") > 0)
            {
                nDenso = dc.I32("m_CurveCount");
                cuadrosDenso = dc.I32("m_FrameCount");
                ritmoDenso = dc.F("m_SampleRate", 30);
                inicioDenso = dc.F("m_BeginTime");
                denso = Flotantes(dc["m_SampleArray"], r);
            }
            var cc = d.M("m_ConstantClip");
            if (cc != null) constantes = Flotantes(cc["data"], r);
        }

        // El StreamedClip: cuadros (tiempo, cantidad de claves) con claves (curva, a, b, c, d).
        // El primero está en -FLT_MAX (el valor antes de empezar) y el último en +inf, vacío.
        static Curva[] Stream(uint[] datos, int n)
        {
            var tiempos = new List<float>[n];
            var coefs = new List<float>[n];
            for (int i = 0; i < n; i++) { tiempos[i] = new List<float>(); coefs[i] = new List<float>(); }
            int p = 0;
            while (p + 2 <= datos.Length)
            {
                float t = BitConverter.UInt32BitsToSingle(datos[p]);
                int claves = (int)datos[p + 1];
                p += 2;
                for (int k = 0; k < claves && p + 5 <= datos.Length; k++, p += 5)
                {
                    int c = (int)datos[p];
                    if (c < 0 || c >= n) continue;
                    float a = BitConverter.UInt32BitsToSingle(datos[p + 1]), b = BitConverter.UInt32BitsToSingle(datos[p + 2]);
                    float cc = BitConverter.UInt32BitsToSingle(datos[p + 3]), dd = BitConverter.UInt32BitsToSingle(datos[p + 4]);
                    // antes del primer cuadro real sólo vale el valor
                    if (t < -1e30f) { t = float.NegativeInfinity; a = b = cc = 0; }
                    tiempos[c].Add(t);
                    coefs[c].Add(a); coefs[c].Add(b); coefs[c].Add(cc); coefs[c].Add(dd);
                }
            }
            var r = new Curva[n];
            for (int i = 0; i < n; i++) r[i] = new Curva { T = tiempos[i].ToArray(), C = coefs[i].ToArray() };
            return r;
        }

        // las listas grandes (64 KB o más) vienen en un recurso aparte, con un byte de tipo adelante
        static uint[] Enteros(object o, IResolutor res)
        {
            switch (o)
            {
                case Recurso rec: return Enteros(Paquete.ArregloDeRecurso(res.Recurso(rec.Id)), res);
                case uint[] u: return u;
                case int[] i: { var r = new uint[i.Length]; Buffer.BlockCopy(i, 0, r, 0, i.Length * 4); return r; }
                case byte[] b: { var r = new uint[b.Length / 4]; Buffer.BlockCopy(b, 0, r, 0, r.Length * 4); return r; }
                case List<object> l: { var r = new uint[l.Count]; for (int k = 0; k < r.Length; k++) r[k] = (uint)Convert.ToInt64(l[k]); return r; }
                case Array a: { var r = new uint[a.Length]; for (int k = 0; k < r.Length; k++) r[k] = (uint)Convert.ToInt64(a.GetValue(k)); return r; }
                default: return Array.Empty<uint>();
            }
        }

        static float[] Flotantes(object o, IResolutor res)
        {
            switch (o)
            {
                case Recurso rec: return Flotantes(Paquete.ArregloDeRecurso(res.Recurso(rec.Id)), res);
                case float[] f: return f;
                case byte[] b: { var r = new float[b.Length / 4]; Buffer.BlockCopy(b, 0, r, 0, r.Length * 4); return r; }
                case List<object> l: { var r = new float[l.Count]; for (int k = 0; k < r.Length; k++) r[k] = Convert.ToSingle(l[k]); return r; }
                case Array a: { var r = new float[a.Length]; for (int k = 0; k < r.Length; k++) r[k] = Convert.ToSingle(a.GetValue(k)); return r; }
                default: return Array.Empty<float>();
            }
        }

        // los enlaces en el mismo orden que las curvas: los de Transform usan 3 o 4 seguidas
        void LeerEnlaces(Mapa bc, IResolutor r)
        {
            var l = bc.L("genericBindings");
            if (l == null || l.Count == 0) return;
            var es = new Enlace[l.Count];
            int curva = 0;
            for (int i = 0; i < l.Count; i++)
            {
                var b = (Mapa)l[i];
                var e = new Enlace
                {
                    Ruta = (uint)b.I("path"), Atributo = (uint)b.I("attribute"), Clase = b.I32("typeID"), Especial = b.I32("customType"),
                    EsPPtr = b.I("isPPtrCurve") != 0, Curva = curva, N = 1,
                };
                if (b["script"] is PPtr ps && !ps.Nulo) e.Script = r.Resolver(ps);
                if (e.Clase == 4 && e.Especial == 0) e.N = e.Atributo == 2 ? 4 : e.Atributo >= 1 && e.Atributo <= 4 ? 3 : 1;
                curva += e.N;
                es[i] = e;
            }
            enlaces = es;
            var pm = bc.L("pptrCurveMapping");
            if (pm != null)
            {
                objetosPPtr = new Object[pm.Count];
                for (int i = 0; i < pm.Count; i++) objetosPPtr[i] = pm[i] is PPtr p ? r.Resolver(p) : null;
            }
        }

        // ── legacy: las curvas del editor ──
        void LeerLegado(Mapa m, IResolutor r)
        {
            var cs = new List<Curva>();
            var es = new List<Enlace>();
            void Vector(string campo, uint atributo, int comps)
            {
                var l = m.L(campo);
                if (l == null) return;
                foreach (Mapa c in l)
                {
                    var claves = c.M("curve")?.L("m_Curve");
                    if (claves == null) continue;
                    string ruta = c.S("path") ?? "";
                    var e = new Enlace { Ruta = Crc.De(ruta), Atributo = atributo, Clase = 4, Curva = cs.Count, N = comps, Nombre = ruta };
                    string[] ejes = comps == 4 ? new[] { "x", "y", "z", "w" } : new[] { "x", "y", "z" };
                    foreach (var eje in ejes)
                    {
                        var ks = new List<(float, float, float, float)>(claves.Count);
                        foreach (Mapa k in claves)
                            ks.Add((k.F("time"), k.M("value")?.F(eje) ?? 0, k.M("inSlope")?.F(eje) ?? 0, k.M("outSlope")?.F(eje) ?? 0));
                        cs.Add(Curva.DeClaves(ks));
                    }
                    es.Add(e);
                }
            }
            Vector("m_PositionCurves", 1, 3);
            Vector("m_RotationCurves", 2, 4);
            Vector("m_ScaleCurves", 3, 3);
            Vector("m_EulerCurves", 4, 3);
            var fl = m.L("m_FloatCurves");
            if (fl != null)
                foreach (Mapa c in fl)
                {
                    var claves = c.M("curve")?.L("m_Curve");
                    if (claves == null) continue;
                    var ks = new List<(float, float, float, float)>(claves.Count);
                    foreach (Mapa k in claves) ks.Add((k.F("time"), k.F("value"), k.F("inSlope"), k.F("outSlope")));
                    string ruta = c.S("path") ?? "", atributo = c.S("attribute") ?? "";
                    int clase = c.I32("classID");
                    var e = new Enlace { Ruta = Crc.De(ruta), Clase = clase, Curva = cs.Count, N = 1, Nombre = atributo };
                    if (c["script"] is PPtr ps && !ps.Nulo) e.Script = r.Resolver(ps);
                    Legado(ref e, atributo);
                    cs.Add(Curva.DeClaves(ks));
                    es.Add(e);
                }
            var pl = m.L("m_PPtrCurves");
            if (pl != null)
            {
                var objs = new List<Object>();
                foreach (Mapa c in pl)
                {
                    var claves = c.L("curve");
                    if (claves == null) continue;
                    var ks = new List<(float, float, float, float)>(claves.Count);
                    foreach (Mapa k in claves)
                    {
                        ks.Add((k.F("time"), objs.Count, float.PositiveInfinity, float.PositiveInfinity));
                        objs.Add(k["value"] is PPtr p ? r.Resolver(p) : null);
                    }
                    string atributo = c.S("attribute") ?? "";
                    var e = new Enlace { Ruta = Crc.De(c.S("path") ?? ""), Clase = c.I32("classID"), Curva = cs.Count, N = 1, EsPPtr = true, Nombre = atributo };
                    if (c["script"] is PPtr ps && !ps.Nulo) e.Script = r.Resolver(ps);
                    Legado(ref e, atributo);
                    cs.Add(Curva.DeClaves(ks));
                    es.Add(e);
                }
                objetosPPtr = objs.ToArray();
            }
            if (es.Count == 0) return;
            curvas = cs.ToArray();
            nDenso = 0; denso = Array.Empty<float>(); constantes = Array.Empty<float>();
            enlaces = es.ToArray();
            float largo = 0;
            foreach (var c in curvas) if (c.T.Length > 0) largo = Math.Max(largo, c.T[c.T.Length - 1]);
            inicio = 0; fin = largo;
        }

        // el atributo de una curva legacy, codificado como en Mecanim: materiales con el tipo en
        // los 4 bits altos (0-3 color, 4-7 vector, 8 float), lo demás con el CRC-32 del nombre
        static void Legado(ref Enlace e, string atributo)
        {
            if (atributo.StartsWith("material."))
            {
                var prop = atributo.Substring(9);
                uint tipo = 8;
                int punto = prop.LastIndexOf('.');
                if (punto > 0)
                {
                    string comp = prop.Substring(punto + 1);
                    int idx = "rgba".IndexOf(comp, StringComparison.Ordinal);
                    if (comp.Length == 1 && idx >= 0) tipo = (uint)idx;
                    else if (comp.Length == 1 && (idx = "xyzw".IndexOf(comp, StringComparison.Ordinal)) >= 0) tipo = 4 + (uint)idx;
                    if (tipo != 8) prop = prop.Substring(0, punto);
                }
                e.Especial = 22;
                e.Atributo = (Crc.De(prop) & 0x0FFFFFFF) | (tipo << 28);
                return;
            }
            e.Atributo = Crc.De(atributo);
        }

        void LeerEventos(Mapa m, IResolutor r)
        {
            var l = m.L("m_Events");
            if (l == null || l.Count == 0) return;
            eventos = new EventoClip[l.Count];
            for (int i = 0; i < l.Count; i++)
            {
                var e = (Mapa)l[i];
                eventos[i] = new EventoClip
                {
                    Tiempo = e.F("time"), Funcion = e.S("functionName") ?? "", Texto = e.S("data") ?? "",
                    Objeto = e["objectReferenceParameter"] is PPtr p && !p.Nulo ? r.Resolver(p) : null,
                    Flotante = e.F("floatParameter"), Entero = e.I32("intParameter"), Opciones = e.I32("messageOptions"),
                };
            }
            Array.Sort(eventos, (a, b) => a.Tiempo.CompareTo(b.Tiempo));
        }

        // ── muestrear ──
        // los valores de todas las curvas en el tiempo t del clip (en segundos, ya dentro del clip)
        internal void Muestrear(float t, float[] v)
        {
            int k = 0;
            for (int i = 0; i < curvas.Length; i++) v[k++] = curvas[i].Evaluar(t);
            if (nDenso > 0)
            {
                float f = (t - inicioDenso) * ritmoDenso;
                int c0 = (int)Math.Floor(f);
                float u = f - c0;
                if (c0 < 0) { c0 = 0; u = 0; }
                if (c0 >= cuadrosDenso - 1) { c0 = Math.Max(0, cuadrosDenso - 1); u = 0; }
                int c1 = Math.Min(c0 + 1, cuadrosDenso - 1);
                int b0 = c0 * nDenso, b1 = c1 * nDenso;
                for (int i = 0; i < nDenso; i++)
                {
                    float a = b0 + i < denso.Length ? denso[b0 + i] : 0, b = b1 + i < denso.Length ? denso[b1 + i] : a;
                    v[k++] = a + (b - a) * u;
                }
            }
            for (int i = 0; i < constantes.Length; i++) v[k++] = constantes[i];
        }

        // el tiempo del clip para un tiempo de estado (en bucle o detenido al final)
        internal float TiempoClip(float t)
        {
            float largo = fin - inicio;
            if (largo <= 0) return inicio;
            if (bucle) { t %= largo; if (t < 0) t += largo; }
            else t = Math.Clamp(t, 0, largo);
            return inicio + t;
        }

        public float length => Math.Max(0, fin - inicio);
        public float frameRate { get => frecuencia; set => frecuencia = value; }
        public bool legacy { get => legado; set => legado = value; }
        public WrapMode wrapMode { get => envoltura; set => envoltura = value; }
        public Bounds localBounds { get => limites; set => limites = value; }
        public bool isLooping => bucle;
        public bool empty => enlaces.Length == 0;

        public AnimationEvent[] events
        {
            get
            {
                var r = new AnimationEvent[eventos.Length];
                for (int i = 0; i < r.Length; i++) r[i] = new AnimationEvent(eventos[i]);
                return r;
            }
        }
    }

    public sealed partial class AnimationEvent
    {
        public float time { get; set; }
        public string functionName { get; set; } = "";
        public string stringParameter { get; set; } = "";
        public float floatParameter { get; set; }
        public int intParameter { get; set; }
        public Object objectReferenceParameter { get; set; }
        public SendMessageOptions messageOptions { get; set; }
        public AnimationState animationState { get; internal set; }
        public AnimatorStateInfo animatorStateInfo { get; internal set; }
        public AnimatorClipInfo animatorClipInfo { get; internal set; }
        public bool isFiredByLegacy => animationState != null;
        public bool isFiredByAnimator => animationState == null;

        public AnimationEvent() { }

        internal AnimationEvent(in EventoClip e)
        {
            time = e.Tiempo; functionName = e.Funcion; stringParameter = e.Texto; floatParameter = e.Flotante;
            intParameter = e.Entero; objectReferenceParameter = e.Objeto; messageOptions = (SendMessageOptions)e.Opciones;
        }
    }

    public partial struct AnimatorClipInfo
    {
        internal AnimationClip clipInterno;
        internal float pesoInterno;
        public AnimationClip clip => clipInterno;
        public float weight => pesoInterno;
    }
}

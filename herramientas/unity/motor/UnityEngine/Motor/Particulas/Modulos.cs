using System;
using System.Collections.Generic;
using Porteo.Datos;
using UnityEngine;

namespace Porteo.Particulas
{
    // Una MinMaxCurve lista para evaluar rápido. Todas las curvas de un sistema se evalúan en un
    // tiempo normalizado (la edad de la partícula sobre su vida, o el tiempo del sistema sobre su
    // duración), así que se muestrean una vez en una tabla sobre [0, 1]: con miles de partículas por
    // cuadro, buscar el tramo y evaluar la Hermite de cada clave cuesta mucho más que interpolar.
    internal sealed class Curva
    {
        internal const int N = 64;
        public int Modo;          // 0 constante, 1 curva, 2 entre dos curvas, 3 entre dos constantes
        public float Max, Min;    // las constantes (Max es también el multiplicador de las curvas)
        public float[] TMax, TMin;
        public AnimationCurve CMax, CMin;

        public static readonly Curva Cero = new Curva();
        public static readonly Curva Uno = new Curva { Max = 1 };

        public static Curva Constante(float v) => new Curva { Max = v, Min = v };

        public static Curva Leer(Mapa m, float def = 0)
        {
            if (m == null) return def == 0 ? Cero : Constante(def);
            var c = new Curva { Modo = m.I32("minMaxState"), Max = m.F("scalar", def), Min = m.F("minScalar") };
            if (c.Modo == 1 || c.Modo == 2)
            {
                c.CMax = Serial.Curva(m.M("maxCurve"));
                c.TMax = Tabla(c.CMax);
                if (c.Modo == 2)
                {
                    c.CMin = Serial.Curva(m.M("minCurve"));
                    c.TMin = Tabla(c.CMin);
                }
            }
            return c;
        }

        public static Curva De(ParticleSystem.MinMaxCurve m)
        {
            var c = new Curva { Modo = (int)m.m_Mode, Max = m.m_Mode == ParticleSystemCurveMode.Constant || m.m_Mode == ParticleSystemCurveMode.TwoConstants ? m.m_ConstantMax : m.m_CurveMultiplier, Min = m.m_ConstantMin };
            if (c.Modo == 1 || c.Modo == 2) { c.CMax = m.m_CurveMax ?? new AnimationCurve(); c.TMax = Tabla(c.CMax); }
            if (c.Modo == 2) { c.CMin = m.m_CurveMin ?? new AnimationCurve(); c.TMin = Tabla(c.CMin); }
            return c;
        }

        static float[] Tabla(AnimationCurve c)
        {
            var t = new float[N];
            for (int i = 0; i < N; i++) t[i] = c.Evaluate(i / (float)(N - 1));
            return t;
        }

        static float Muestra(float[] t, float x)
        {
            if (!(x > 0)) return t[0];
            if (x >= 1) return t[N - 1];
            float f = x * (N - 1);
            int i = (int)f;
            return t[i] + (t[i + 1] - t[i]) * (f - i);
        }

        // t normalizado; r el azar propio de la partícula (o del cuadro) para los modos "entre dos"
        public float Eval(float t, float r)
        {
            switch (Modo)
            {
                case 0: return Max;
                case 1: return Max * Muestra(TMax, t);
                case 2: { float a = Muestra(TMin, t), b = Muestra(TMax, t); return Max * (a + (b - a) * r); }
                default: return Min + (Max - Min) * r;
            }
        }

        public bool EsCero => (Modo == 0 && Max == 0) || (Modo == 3 && Max == 0 && Min == 0) || ((Modo == 1 || Modo == 2) && Max == 0);
        public bool EsConstante => Modo == 0;

        // la cota del valor absoluto (para los límites del sistema)
        public float Cota()
        {
            switch (Modo)
            {
                case 0: return Math.Abs(Max);
                case 3: return Math.Max(Math.Abs(Min), Math.Abs(Max));
                default:
                {
                    float m = 0;
                    foreach (var v in TMax) m = Math.Max(m, Math.Abs(v));
                    if (TMin != null) foreach (var v in TMin) m = Math.Max(m, Math.Abs(v));
                    return m * Math.Abs(Max);
                }
            }
        }

        // de vuelta a la API (main.startSize y compañía)
        public ParticleSystem.MinMaxCurve API() => new ParticleSystem.MinMaxCurve
        {
            m_Mode = (ParticleSystemCurveMode)Modo, m_CurveMultiplier = Max, m_ConstantMax = Max, m_ConstantMin = Min, m_CurveMax = CMax, m_CurveMin = CMin,
        };
    }

    // Una MinMaxGradient: un color, dos, un gradiente, dos gradientes o un color al azar de un
    // gradiente. Los gradientes también van en tabla.
    internal sealed class Degradado
    {
        internal const int N = 64;
        public int Modo;      // 0 color, 1 gradiente, 2 dos colores, 3 dos gradientes, 4 color al azar
        public Color CMin = Color.white, CMax = Color.white;
        public Gradient GMin, GMax;
        Color[] tMin, tMax;
        bool fijoMin, fijoMax;

        public static readonly Degradado Blanco = new Degradado();

        public static Degradado Leer(Mapa m)
        {
            if (m == null) return Blanco;
            var d = new Degradado { Modo = m.I32("minMaxState"), CMin = Serial.Color(m.M("minColor")), CMax = Serial.Color(m.M("maxColor")) };
            if (d.Modo == 1 || d.Modo == 3 || d.Modo == 4) d.PonerMax(Serial.Degradado(m.M("maxGradient")));
            if (d.Modo == 3) d.PonerMin(Serial.Degradado(m.M("minGradient")));
            return d;
        }

        public static Degradado De(ParticleSystem.MinMaxGradient g)
        {
            var d = new Degradado { Modo = (int)g.m_Mode, CMin = g.m_ColorMin, CMax = g.m_ColorMax };
            if (g.m_GradientMax != null) d.PonerMax(g.m_GradientMax);
            if (g.m_GradientMin != null) d.PonerMin(g.m_GradientMin);
            return d;
        }

        void PonerMax(Gradient g) { GMax = g; tMax = Tabla(g); fijoMax = g.mode == GradientMode.Fixed; }
        void PonerMin(Gradient g) { GMin = g; tMin = Tabla(g); fijoMin = g.mode == GradientMode.Fixed; }

        static Color[] Tabla(Gradient g)
        {
            var t = new Color[N];
            for (int i = 0; i < N; i++) t[i] = g.Evaluate(i / (float)(N - 1));
            return t;
        }

        static Color Muestra(Color[] t, bool fijo, float x)
        {
            if (t == null) return Color.white;
            if (!(x > 0)) return t[0];
            if (x >= 1) return t[N - 1];
            float f = x * (N - 1);
            int i = (int)f;
            // el modo fijo cambia de golpe en cada clave: interpolar la tabla lo suavizaría
            if (fijo) return t[(int)(f + 0.5f)];
            var a = t[i]; var b = t[i + 1]; float k = f - i;
            return new Color(a.r + (b.r - a.r) * k, a.g + (b.g - a.g) * k, a.b + (b.b - a.b) * k, a.a + (b.a - a.a) * k);
        }

        public Color Eval(float t, float r)
        {
            switch (Modo)
            {
                case 0: return CMax;
                case 1: return Muestra(tMax, fijoMax, t);
                case 2: return Color.LerpUnclamped(CMin, CMax, r);
                case 3: return Color.LerpUnclamped(Muestra(tMin, fijoMin, t), Muestra(tMax, fijoMax, t), r);
                default: return Muestra(tMax, fijoMax, r);
            }
        }

        public bool EsBlanco => Modo == 0 && CMax.r == 1 && CMax.g == 1 && CMax.b == 1 && CMax.a == 1;
    }

    internal struct Rafaga
    {
        public float Tiempo, Intervalo, Probabilidad;
        public int Ciclos;
        public Curva Cantidad;
    }

    internal struct SubEmisor
    {
        public ParticleSystem Sistema;
        public int Tipo;           // 0 nacimiento, 1 colisión, 2 muerte, 3 trigger, 4 manual
        public float Probabilidad;
    }

    // De dónde y hacia dónde salen las partículas (ShapeModule).
    internal sealed class Forma
    {
        public bool Activa = true;
        public int Tipo;                 // ParticleSystemShapeType (los valores viejos: 8 cono volumen, 15 caja cáscara...)
        public float Angulo = 25, Largo = 5, Radio = 1, GrosorRadio = 1, RadioDona = 0.2f, Arco = 360;
        public Vector3 GrosorCaja;
        public bool Transformada;
        public Vector3 Pos, Esc = Vector3.one;
        public Quaternion Rot = Quaternion.identity;
        public float DirAzar, DirEsferica, PosAzar;
        public bool Alinear;

        public static Forma Leer(Mapa m)
        {
            var f = new Forma();
            if (m == null) return f;
            f.Activa = m.B("enabled", true);
            f.Tipo = m.I32("type");
            f.Angulo = m.F("angle", 25);
            f.Largo = m.F("length", 5);
            f.GrosorCaja = Serial.V3(m.M("boxThickness"));
            f.GrosorRadio = m.F("radiusThickness", 1);
            f.RadioDona = m.F("donutRadius", 0.2f);
            f.Pos = Serial.V3(m.M("m_Position"));
            var rot = Serial.V3(m.M("m_Rotation"));
            f.Rot = Quaternion.Euler(rot);
            f.Esc = m.Tiene("m_Scale") ? Serial.V3(m.M("m_Scale")) : Vector3.one;
            f.Transformada = f.Pos != Vector3.zero || rot != Vector3.zero || f.Esc != Vector3.one;
            f.DirAzar = m.F("randomDirectionAmount");
            f.DirEsferica = m.F("sphericalDirectionAmount");
            f.PosAzar = m.F("randomPositionAmount");
            f.Alinear = m.B("alignToDirection");
            f.Radio = m.M("radius")?.F("value", 1) ?? m.F("radius", 1);
            f.Arco = m.M("arc")?.F("value", 360) ?? m.F("arc", 360);
            return f;
        }
    }

    internal sealed class Colision
    {
        public bool Activa;
        public int Tipo;                 // 0 planos, 1 mundo
        public Curva Amortiguar = Curva.Cero, Rebote = Curva.Uno, PerdidaVida = Curva.Cero;
        public float MatarMin, MatarMax = 10000, EscalaRadio = 1;
        public int Mascara = -1;
        public Transform[] Planos = Array.Empty<Transform>();
    }

    internal sealed class Estelas
    {
        public bool Activa;
        public float Proporcion = 1, DistanciaMin = 0.2f;
        public Curva Vida = Curva.Uno, AnchoEnEstela = Curva.Uno;
        public int ModoTextura;          // 0 estirar, 1 repetir por segmento...
        public bool EnMundo, MuereConParticula = true, TamAfectaAncho = true, TamAfectaVida, HeredaColor = true;
        public Degradado ColorEnVida = Degradado.Blanco, ColorEnEstela = Degradado.Blanco;
    }

    // Todo lo que se configura de un sistema (lo que en Unity son los módulos). Lo comparten las
    // copias de un prefab mientras ningún script lo cambie (main.startColor, emission.enabled):
    // ahí cada sistema se queda con la suya.
    internal sealed class Configuracion
    {
        public float Duracion = 5, Velocidad = 1;
        public bool Bucle = true, Precalentar, AlDespertar = true, SinEscala;
        public Curva Demora = Curva.Cero;
        public int Espacio;               // 0 local, 1 mundo, 2 propio
        public Transform EspacioPropio;
        public int Escalado;              // 0 jerarquía, 1 local, 2 forma
        public int Descarte;              // cullingMode: 0 automático, 1 pausar y alcanzar, 2 pausar, 3 siempre
        public int SemillaFija; public bool SemillaAlAzar = true;

        // InitialModule
        public Curva Vida = Curva.Constante(5), Rapidez = Curva.Constante(5), Tam = Curva.Uno, TamY = Curva.Uno, TamZ = Curva.Uno;
        public Curva RotX = Curva.Cero, RotY = Curva.Cero, Rot = Curva.Cero, Gravedad = Curva.Cero;
        public Degradado ColorInicial = Degradado.Blanco;
        public bool Tam3D, Rot3D;
        public float GiroInverso;
        public int Maximo = 1000;

        public Forma Forma = new Forma();

        // EmissionModule
        public bool Emision = true;
        public Curva PorTiempo = Curva.Constante(10), PorDistancia = Curva.Cero;
        public Rafaga[] Rafagas = Array.Empty<Rafaga>();

        // SizeModule, RotationModule, ColorModule
        public bool TamVida, TamVidaSeparado; public Curva TamVidaX = Curva.Uno, TamVidaY = Curva.Uno, TamVidaZ = Curva.Uno;
        public bool RotVida, RotVidaSeparada; public Curva RotVidaX = Curva.Cero, RotVidaY = Curva.Cero, RotVidaZ = Curva.Cero;
        public bool ColorVida; public Degradado ColorEnVida = Degradado.Blanco;

        // UVModule
        public bool Hoja; public int HojaX = 1, HojaY = 1, HojaTipo, HojaFila; public bool HojaFilaAzar = true;
        public Curva HojaCuadro = Curva.Cero, HojaInicio = Curva.Cero; public float HojaCiclos = 1;
        public int HojaModoTiempo; public float HojaFps = 30; public Vector2 HojaRango = new Vector2(0, 1);

        // VelocityModule
        public bool VelVida, VelVidaMundo; public Curva VelX = Curva.Cero, VelY = Curva.Cero, VelZ = Curva.Cero, VelOrbX = Curva.Cero, VelOrbY = Curva.Cero, VelOrbZ = Curva.Cero, VelRadial = Curva.Cero, VelModificador = Curva.Uno;
        public bool VelOrbital;

        // InheritVelocityModule
        public bool Heredar; public int HeredarModo; public Curva HeredarCurva = Curva.Cero;

        // ForceModule
        public bool Fuerza, FuerzaMundo, FuerzaAzarPorCuadro; public Curva FuerzaX = Curva.Cero, FuerzaY = Curva.Cero, FuerzaZ = Curva.Cero;

        // ClampVelocityModule
        public bool Limite, LimiteSeparado, LimiteMundo; public Curva LimiteX = Curva.Uno, LimiteY = Curva.Uno, LimiteZ = Curva.Uno, LimiteMag = Curva.Uno, Arrastre = Curva.Cero;
        public float Amortiguar = 1; public bool ArrastrePorTam, ArrastrePorVel;

        // SizeBySpeed, RotationBySpeed, ColorBySpeed
        public bool TamVel, TamVelSeparado; public Curva TamVelX = Curva.Uno, TamVelY = Curva.Uno, TamVelZ = Curva.Uno; public Vector2 TamVelRango = new Vector2(0, 1);
        public bool RotVel, RotVelSeparada; public Curva RotVelX = Curva.Cero, RotVelY = Curva.Cero, RotVelZ = Curva.Cero; public Vector2 RotVelRango = new Vector2(0, 1);
        public bool ColorVel; public Degradado ColorEnVel = Degradado.Blanco; public Vector2 ColorVelRango = new Vector2(0, 1);

        public Colision Colision = new Colision();
        public SubEmisor[] Subs = Array.Empty<SubEmisor>();
        public Estelas Estelas = new Estelas();

        public static readonly Configuracion Defecto = new Configuracion();

        public Configuracion Clonar() => (Configuracion)MemberwiseClone();

        public static Configuracion Leer(Mapa m, IResolutor r)
        {
            var a = new Configuracion
            {
                Duracion = Math.Max(m.F("lengthInSec", 5), 0.05f),
                Velocidad = m.F("simulationSpeed", 1),
                Bucle = m.B("looping", true),
                Precalentar = m.B("prewarm"),
                AlDespertar = m.B("playOnAwake", true),
                SinEscala = m.B("useUnscaledTime"),
                Demora = Curva.Leer(m.M("startDelay")),
                Espacio = m.I32("moveWithTransform"),
                EspacioPropio = r.Resolver(m.P("moveWithCustomTransform")) as Transform,
                Escalado = m.I32("scalingMode"),
                Descarte = m.I32("cullingMode"),
                SemillaFija = m.I32("randomSeed"),
                SemillaAlAzar = m.B("autoRandomSeed", true),
            };
            var im = m.M("InitialModule");
            if (im != null)
            {
                a.Vida = Curva.Leer(im.M("startLifetime"), 5);
                a.Rapidez = Curva.Leer(im.M("startSpeed"), 5);
                a.ColorInicial = Degradado.Leer(im.M("startColor"));
                a.Tam = Curva.Leer(im.M("startSize"), 1);
                a.TamY = Curva.Leer(im.M("startSizeY"), 1);
                a.TamZ = Curva.Leer(im.M("startSizeZ"), 1);
                a.RotX = Curva.Leer(im.M("startRotationX"));
                a.RotY = Curva.Leer(im.M("startRotationY"));
                a.Rot = Curva.Leer(im.M("startRotation"));
                a.GiroInverso = im.F("randomizeRotationDirection");
                a.Maximo = Math.Max(0, im.I32("maxNumParticles", 1000));
                a.Tam3D = im.B("size3D");
                a.Rot3D = im.B("rotation3D");
                a.Gravedad = Curva.Leer(im.M("gravityModifier"));
            }
            a.Forma = Forma.Leer(m.M("ShapeModule"));
            var em = m.M("EmissionModule");
            if (em != null)
            {
                a.Emision = em.B("enabled", true);
                a.PorTiempo = Curva.Leer(em.M("rateOverTime"));
                a.PorDistancia = Curva.Leer(em.M("rateOverDistance"));
                var lb = em.L("m_Bursts");
                int nb = Math.Min(lb?.Count ?? 0, em.I32("m_BurstCount", lb?.Count ?? 0));
                if (nb > 0)
                {
                    a.Rafagas = new Rafaga[nb];
                    for (int i = 0; i < nb; i++)
                    {
                        var b = (Mapa)lb[i];
                        a.Rafagas[i] = new Rafaga
                        {
                            Tiempo = b.F("time"),
                            Cantidad = b.Tiene("countCurve") ? Curva.Leer(b.M("countCurve")) : new Curva { Modo = 3, Min = b.I32("minCount"), Max = b.I32("maxCount") },
                            Ciclos = Math.Max(1, b.I32("cycleCount", 1)),
                            Intervalo = Math.Max(0.0001f, b.F("repeatInterval", 0.01f)),
                            Probabilidad = b.F("probability", 1),
                        };
                    }
                }
            }
            var sz = m.M("SizeModule");
            if (sz != null && sz.B("enabled"))
            {
                a.TamVida = true;
                a.TamVidaSeparado = sz.B("separateAxes");
                a.TamVidaX = Curva.Leer(sz.M("curve"), 1);
                a.TamVidaY = Curva.Leer(sz.M("y"), 1);
                a.TamVidaZ = Curva.Leer(sz.M("z"), 1);
            }
            var ro = m.M("RotationModule");
            if (ro != null && ro.B("enabled"))
            {
                a.RotVida = true;
                a.RotVidaSeparada = ro.B("separateAxes");
                a.RotVidaX = Curva.Leer(ro.M("x"));
                a.RotVidaY = Curva.Leer(ro.M("y"));
                a.RotVidaZ = Curva.Leer(ro.M("curve"));
            }
            var co = m.M("ColorModule");
            if (co != null && co.B("enabled")) { a.ColorVida = true; a.ColorEnVida = Degradado.Leer(co.M("gradient")); }
            var uv = m.M("UVModule");
            if (uv != null && uv.B("enabled") && uv.I32("mode") == 0)
            {
                a.Hoja = true;
                a.HojaX = Math.Max(1, uv.I32("tilesX", 1));
                a.HojaY = Math.Max(1, uv.I32("tilesY", 1));
                a.HojaTipo = uv.I32("animationType");
                a.HojaFila = uv.I32("rowIndex");
                a.HojaFilaAzar = uv.B("randomRow", true);
                a.HojaCuadro = Curva.Leer(uv.M("frameOverTime"));
                a.HojaInicio = Curva.Leer(uv.M("startFrame"));
                a.HojaCiclos = Math.Max(uv.F("cycles", 1), 0.0001f);
                a.HojaModoTiempo = uv.I32("timeMode");
                a.HojaFps = uv.F("fps", 30);
                a.HojaRango = uv.Tiene("speedRange") ? Serial.V2(uv.M("speedRange")) : new Vector2(0, 1);
            }
            var ve = m.M("VelocityModule");
            if (ve != null && ve.B("enabled"))
            {
                a.VelVida = true;
                a.VelVidaMundo = ve.B("inWorldSpace");
                a.VelX = Curva.Leer(ve.M("x")); a.VelY = Curva.Leer(ve.M("y")); a.VelZ = Curva.Leer(ve.M("z"));
                a.VelOrbX = Curva.Leer(ve.M("orbitalX")); a.VelOrbY = Curva.Leer(ve.M("orbitalY")); a.VelOrbZ = Curva.Leer(ve.M("orbitalZ"));
                a.VelRadial = Curva.Leer(ve.M("radial"));
                a.VelModificador = Curva.Leer(ve.M("speedModifier"), 1);
                a.VelOrbital = !a.VelOrbX.EsCero || !a.VelOrbY.EsCero || !a.VelOrbZ.EsCero || !a.VelRadial.EsCero;
            }
            var iv = m.M("InheritVelocityModule");
            if (iv != null && iv.B("enabled")) { a.Heredar = true; a.HeredarModo = iv.I32("m_Mode"); a.HeredarCurva = Curva.Leer(iv.M("m_Curve")); }
            var fo = m.M("ForceModule");
            if (fo != null && fo.B("enabled"))
            {
                a.Fuerza = true;
                a.FuerzaMundo = fo.B("inWorldSpace");
                a.FuerzaAzarPorCuadro = fo.B("randomizePerFrame");
                a.FuerzaX = Curva.Leer(fo.M("x")); a.FuerzaY = Curva.Leer(fo.M("y")); a.FuerzaZ = Curva.Leer(fo.M("z"));
            }
            var cv = m.M("ClampVelocityModule");
            if (cv != null && cv.B("enabled"))
            {
                a.Limite = true;
                a.LimiteSeparado = cv.B("separateAxis");
                a.LimiteMundo = cv.B("inWorldSpace");
                a.LimiteX = Curva.Leer(cv.M("x"), 1); a.LimiteY = Curva.Leer(cv.M("y"), 1); a.LimiteZ = Curva.Leer(cv.M("z"), 1);
                a.LimiteMag = Curva.Leer(cv.M("magnitude"), 1);
                a.Amortiguar = cv.F("dampen", 1);
                a.Arrastre = Curva.Leer(cv.M("drag"));
                a.ArrastrePorTam = cv.B("multiplyDragByParticleSize", true);
                a.ArrastrePorVel = cv.B("multiplyDragByParticleVelocity", true);
            }
            var sb = m.M("SizeBySpeedModule");
            if (sb != null && sb.B("enabled"))
            {
                a.TamVel = true; a.TamVelSeparado = sb.B("separateAxes");
                a.TamVelX = Curva.Leer(sb.M("curve"), 1); a.TamVelY = Curva.Leer(sb.M("y"), 1); a.TamVelZ = Curva.Leer(sb.M("z"), 1);
                a.TamVelRango = Serial.V2(sb.M("range"));
            }
            var rb = m.M("RotationBySpeedModule");
            if (rb != null && rb.B("enabled"))
            {
                a.RotVel = true; a.RotVelSeparada = rb.B("separateAxes");
                a.RotVelX = Curva.Leer(rb.M("x")); a.RotVelY = Curva.Leer(rb.M("y")); a.RotVelZ = Curva.Leer(rb.M("curve"));
                a.RotVelRango = Serial.V2(rb.M("range"));
            }
            var cb = m.M("ColorBySpeedModule");
            if (cb != null && cb.B("enabled")) { a.ColorVel = true; a.ColorEnVel = Degradado.Leer(cb.M("gradient")); a.ColorVelRango = Serial.V2(cb.M("range")); }
            var cl = m.M("CollisionModule");
            if (cl != null && cl.B("enabled"))
            {
                var c = a.Colision = new Colision
                {
                    Activa = true,
                    Tipo = cl.I32("type"),
                    Amortiguar = Curva.Leer(cl.M("m_Dampen")),
                    Rebote = Curva.Leer(cl.M("m_Bounce"), 1),
                    PerdidaVida = Curva.Leer(cl.M("m_EnergyLossOnCollision")),
                    MatarMin = cl.F("minKillSpeed"),
                    MatarMax = cl.F("maxKillSpeed", 10000),
                    EscalaRadio = cl.F("radiusScale", 1),
                    Mascara = (int)(cl.M("collidesWith")?.I("m_Bits", -1) ?? -1),
                };
                var planos = new List<Transform>();
                for (int i = 0; i < 6; i++) if (r.Resolver(cl.P("plane" + i)) is Transform t) planos.Add(t);
                c.Planos = planos.ToArray();
            }
            var su = m.M("SubModule");
            if (su != null && su.B("enabled"))
            {
                var l = new List<SubEmisor>();
                var ls = su.L("subEmitters");
                if (ls != null)
                    foreach (var x in ls)
                    {
                        if (!(x is Mapa sm) || !(r.Resolver(sm.P("emitter")) is ParticleSystem ps)) continue;
                        ps.esSubEmisor = true;
                        l.Add(new SubEmisor { Sistema = ps, Tipo = sm.I32("type"), Probabilidad = sm.F("emitProbability", 1) });
                    }
                a.Subs = l.ToArray();
            }
            var tr = m.M("TrailModule");
            if (tr != null && tr.B("enabled") && tr.I32("mode") == 0)
            {
                a.Estelas = new Estelas
                {
                    Activa = true,
                    Proporcion = tr.F("ratio", 1),
                    Vida = Curva.Leer(tr.M("lifetime"), 1),
                    DistanciaMin = Math.Max(0.001f, tr.F("minVertexDistance", 0.2f)),
                    ModoTextura = tr.I32("textureMode"),
                    EnMundo = tr.B("worldSpace"),
                    MuereConParticula = tr.B("dieWithParticles", true),
                    TamAfectaAncho = tr.B("sizeAffectsWidth", true),
                    TamAfectaVida = tr.B("sizeAffectsLifetime"),
                    HeredaColor = tr.B("inheritParticleColor", true),
                    ColorEnVida = Degradado.Leer(tr.M("colorOverLifetime")),
                    AnchoEnEstela = Curva.Leer(tr.M("widthOverTrail"), 1),
                    ColorEnEstela = Degradado.Leer(tr.M("colorOverTrail")),
                };
            }
            return a;
        }
    }
}

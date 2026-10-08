using System;
using System.Collections.Generic;
using Porteo;
using UnityEngine;
using Object = UnityEngine.Object;
using Porteo.Datos;
using Porteo.Render;

namespace UnityEngine
{
    public partial class Light : Behaviour
    {
        internal LightType tipo = LightType.Point;
        internal Color colorLuz = Color.white;
        internal float intensidad = 1f, rango = 10f, anguloSpot = 30f, tamCookie = 10f, rebote = 1f;
        internal LightShadows sombraTipo;
        internal float sombraFuerza = 1f, sombraSesgo = 0.05f, sombraSesgoNormal = 0.4f, sombraCerca = 0.2f;
        internal Texture texCookie;
        internal LightRenderMode modo;
        internal int mascara = -1;
        internal int horneado = 4;   // LightmapBakeType: 4 Realtime, 1 Mixed, 2 Baked
        internal Flare destello;

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            tipo = (LightType)m.I32("m_Type", 2);
            colorLuz = Serial.Color(m.M("m_Color"));
            intensidad = m.F("m_Intensity", 1f);
            rango = m.F("m_Range", 10f);
            anguloSpot = m.F("m_SpotAngle", 30f);
            tamCookie = m.F("m_CookieSize", 10f);
            rebote = m.F("m_BounceIntensity", 1f);
            var s = m.M("m_Shadows");
            if (s != null)
            {
                sombraTipo = (LightShadows)s.I32("m_Type");
                sombraFuerza = s.F("m_Strength", 1f);
                sombraSesgo = s.F("m_Bias", 0.05f);
                sombraSesgoNormal = s.F("m_NormalBias", 0.4f);
                sombraCerca = s.F("m_NearPlane", 0.2f);
            }
            texCookie = r.Resolver(m.P("m_Cookie")) as Texture;
            destello = r.Resolver(m.P("m_Flare")) as Flare;
            modo = (LightRenderMode)m.I32("m_RenderMode");
            mascara = (int)(uint)(m.M("m_CullingMask")?.I("m_Bits", 0xFFFFFFFF) ?? 0xFFFFFFFF);
            horneado = m.I32("m_Lightmapping", 4);
        }

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            base.CopiarDe(o, remap);
            var x = (Light)o;
            tipo = x.tipo; colorLuz = x.colorLuz; intensidad = x.intensidad; rango = x.rango; anguloSpot = x.anguloSpot; tamCookie = x.tamCookie;
            rebote = x.rebote; sombraTipo = x.sombraTipo; sombraFuerza = x.sombraFuerza; sombraSesgo = x.sombraSesgo; sombraSesgoNormal = x.sombraSesgoNormal;
            sombraCerca = x.sombraCerca; texCookie = x.texCookie; modo = x.modo; mascara = x.mascara; horneado = x.horneado; destello = x.destello;
        }

        internal override void AlActivarse() => Luces.Alta(this);
        internal override void AlDesactivarse() => Luces.Baja(this);
        internal override void AlDestruirse() => Luces.Baja(this);

        public LightType type { get => tipo; set => tipo = value; }
        public Color color { get => colorLuz; set => colorLuz = value; }
        public float intensity { get => intensidad; set => intensidad = Math.Max(0, value); }
        public float range { get => rango; set => rango = value; }
        public float spotAngle { get => anguloSpot; set => anguloSpot = value; }
        public float cookieSize { get => tamCookie; set => tamCookie = value; }
        public float bounceIntensity { get => rebote; set => rebote = value; }
        public LightShadows shadows { get => sombraTipo; set => sombraTipo = value; }
        public float shadowStrength { get => sombraFuerza; set => sombraFuerza = value; }
        public float shadowBias { get => sombraSesgo; set => sombraSesgo = value; }
        public float shadowNormalBias { get => sombraSesgoNormal; set => sombraSesgoNormal = value; }
        public float shadowNearPlane { get => sombraCerca; set => sombraCerca = value; }
        public Texture cookie { get => texCookie; set => texCookie = value; }
        public LightRenderMode renderMode { get => modo; set => modo = value; }
        public int cullingMask { get => mascara; set => mascara = value; }
        public Flare flare { get => destello; set => destello = value; }

        public LightBakingOutput bakingOutput
        {
            get => new LightBakingOutput { isBaked = horneado != 4, lightmapBakeType = (LightmapBakeType)horneado, mixedLightingMode = MixedLightingMode.IndirectOnly };
            set => horneado = (int)value.lightmapBakeType;
        }

        // cuánto ilumina (para elegir las luces más importantes de cada objeto)
        internal float Brillo => intensidad * (colorLuz.r * 0.3f + colorLuz.g * 0.59f + colorLuz.b * 0.11f);
    }

    public enum LightRenderMode { Auto = 0, ForcePixel = 1, ForceVertex = 2 }

    public sealed partial class RenderSettings : Object
    {
        internal static bool niebla;
        internal static Color colorNiebla = new Color(0.5f, 0.5f, 0.5f, 1);
        internal static FogMode modoNiebla = FogMode.ExponentialSquared;
        internal static float densidad = 0.01f, inicioNiebla = 0, finNiebla = 300;
        internal static Color cielo = new Color(0.212f, 0.227f, 0.259f, 1), ecuador = new Color(0.114f, 0.125f, 0.133f, 1), suelo = new Color(0.047f, 0.043f, 0.035f, 1);
        internal static float intensidadAmbiente = 1f;
        internal static int modoAmbiente;   // 0 Skybox, 1 Trilight, 3 Flat
        internal static float[] sonda;      // las 27 de m_AmbientProbe
        internal static Material cieloMaterial;
        internal static Light sol;
        internal static float intensidadReflejo = 1f;
        internal static Texture reflejoPropio, reflejoGenerado;
        internal static int modoReflejo;
        internal static Texture cookieSpot;
        internal static Color especularIndirecto;
        internal static int version = 1;

        // los de la escena que se carga (o la activa): Unity los toma de la escena activa
        internal static void Leer(Mapa m, IResolutor r)
        {
            niebla = m.B("m_Fog");
            colorNiebla = Serial.Color(m.M("m_FogColor"));
            modoNiebla = (FogMode)m.I32("m_FogMode", 3);
            densidad = m.F("m_FogDensity", 0.01f);
            inicioNiebla = m.F("m_LinearFogStart");
            finNiebla = m.F("m_LinearFogEnd", 300);
            cielo = Serial.Color(m.M("m_AmbientSkyColor"));
            ecuador = Serial.Color(m.M("m_AmbientEquatorColor"));
            suelo = Serial.Color(m.M("m_AmbientGroundColor"));
            intensidadAmbiente = m.F("m_AmbientIntensity", 1f);
            modoAmbiente = m.I32("m_AmbientMode");
            cieloMaterial = r.Resolver(m.P("m_SkyboxMaterial")) as Material;
            sol = r.Resolver(m.P("m_Sun")) as Light;
            intensidadReflejo = m.F("m_ReflectionIntensity", 1f);
            modoReflejo = m.I32("m_DefaultReflectionMode");
            reflejoPropio = r.Resolver(m.P("m_CustomReflection")) as Texture;
            reflejoGenerado = r.Resolver(m.P("m_GeneratedSkyboxReflection")) as Texture;
            cookieSpot = r.Resolver(m.P("m_SpotCookie")) as Texture;
            especularIndirecto = Serial.Color(m.M("m_IndirectSpecularColor"));
            var p = m.M("m_AmbientProbe");
            if (p != null)
            {
                sonda = new float[27];
                for (int i = 0; i < 27; i++) sonda[i] = p.F($"sh[{i,2}]");
            }
            version++;
        }

        public static bool fog { get => niebla; set { niebla = value; version++; } }
        public static Color fogColor { get => colorNiebla; set { colorNiebla = value; version++; } }
        public static FogMode fogMode { get => modoNiebla; set { modoNiebla = value; version++; } }
        public static float fogDensity { get => densidad; set { densidad = value; version++; } }
        public static float fogStartDistance { get => inicioNiebla; set { inicioNiebla = value; version++; } }
        public static float fogEndDistance { get => finNiebla; set { finNiebla = value; version++; } }
        public static Color ambientLight { get => cielo; set { cielo = value; version++; } }
        public static Color ambientSkyColor { get => cielo; set { cielo = value; version++; } }
        public static Color ambientEquatorColor { get => ecuador; set { ecuador = value; version++; } }
        public static Color ambientGroundColor { get => suelo; set { suelo = value; version++; } }
        public static float ambientIntensity { get => intensidadAmbiente; set { intensidadAmbiente = value; version++; } }
        public static Rendering.AmbientMode ambientMode { get => (Rendering.AmbientMode)modoAmbiente; set { modoAmbiente = (int)value; version++; } }
        public static Material skybox { get => cieloMaterial; set { cieloMaterial = value; version++; } }
        public static Light sun { get => sol; set => sol = value; }
        public static float reflectionIntensity { get => intensidadReflejo; set { intensidadReflejo = value; version++; } }
        public static Texture customReflection { get => reflejoPropio; set { reflejoPropio = value; version++; } }
        public static Color subtractiveShadowColor { get; set; }
        public static float haloStrength { get; set; } = 1;
        public static float flareStrength { get; set; } = 1;
        public static float flareFadeSpeed { get; set; } = 3;
    }
}

namespace Porteo.Render
{
    public static class Luces
    {
        internal static readonly List<Light> activas = new List<Light>();

        internal static void Alta(Light l) { if (!activas.Contains(l)) activas.Add(l); }
        internal static void Baja(Light l) => activas.Remove(l);

        // la direccional principal: el sol de la escena si está activo, si no la más brillante
        internal static Light Principal(int capa)
        {
            var sol = RenderSettings.sol;
            if ((object)sol != null && !sol.destruido && activas.Contains(sol) && sol.tipo == LightType.Directional && (sol.mascara & (1 << capa)) != 0) return sol;
            Light mejor = null; float b = -1;
            foreach (var l in activas)
            {
                if (l.tipo != LightType.Directional || (l.mascara & (1 << capa)) == 0) continue;
                float x = l.Brillo + (l.modo == LightRenderMode.ForcePixel ? 1000 : 0);
                if (x > b) { b = x; mejor = l; }
            }
            return mejor;
        }

        // armónicos esféricos del ambiente → unity_SHAr..SHC
        public static void Ambiente(Tabla g)
        {
            Vector4 ar, ag, ab, br = default, bg = default, bb = default, c = new Vector4(0, 0, 0, 1);
            var sky = RenderSettings.cielo * RenderSettings.intensidadAmbiente;
            switch (RenderSettings.modoAmbiente)
            {
                case 0 when RenderSettings.sonda != null:
                {
                    var s = RenderSettings.sonda;
                    float Co(int canal, int k) => s[canal * 9 + k];
                    ar = new Vector4(Co(0, 3), Co(0, 1), Co(0, 2), Co(0, 0) - Co(0, 6));
                    ag = new Vector4(Co(1, 3), Co(1, 1), Co(1, 2), Co(1, 0) - Co(1, 6));
                    ab = new Vector4(Co(2, 3), Co(2, 1), Co(2, 2), Co(2, 0) - Co(2, 6));
                    br = new Vector4(Co(0, 4), Co(0, 5), Co(0, 6) * 3, Co(0, 7));
                    bg = new Vector4(Co(1, 4), Co(1, 5), Co(1, 6) * 3, Co(1, 7));
                    bb = new Vector4(Co(2, 4), Co(2, 5), Co(2, 6) * 3, Co(2, 7));
                    c = new Vector4(Co(0, 8), Co(1, 8), Co(2, 8), 1);
                    break;
                }
                case 1:
                {
                    // tres colores: arriba el cielo, al medio el ecuador, abajo el suelo
                    var e = RenderSettings.ecuador * RenderSettings.intensidadAmbiente;
                    var gr = RenderSettings.suelo * RenderSettings.intensidadAmbiente;
                    var dc = (sky + e * 2 + gr) * 0.25f;
                    var y = (sky - gr) * 0.5f;
                    ar = new Vector4(0, y.r, 0, dc.r); ag = new Vector4(0, y.g, 0, dc.g); ab = new Vector4(0, y.b, 0, dc.b);
                    break;
                }
                default:
                    ar = new Vector4(0, 0, 0, sky.r); ag = new Vector4(0, 0, 0, sky.g); ab = new Vector4(0, 0, 0, sky.b);
                    break;
            }
            g.Poner(Ids.De("unity_SHAr"), Valor.Vec(ar)); g.Poner(Ids.De("unity_SHAg"), Valor.Vec(ag)); g.Poner(Ids.De("unity_SHAb"), Valor.Vec(ab));
            g.Poner(Ids.De("unity_SHBr"), Valor.Vec(br)); g.Poner(Ids.De("unity_SHBg"), Valor.Vec(bg)); g.Poner(Ids.De("unity_SHBb"), Valor.Vec(bb));
            g.Poner(Ids.De("unity_SHC"), Valor.Vec(c));
            g.Poner(Ids.De("unity_AmbientSky"), Valor.Vec(RenderSettings.cielo));
            g.Poner(Ids.De("unity_AmbientEquator"), Valor.Vec(RenderSettings.ecuador));
            g.Poner(Ids.De("unity_AmbientGround"), Valor.Vec(RenderSettings.suelo));
            g.Poner(Ids.De("glstate_lightmodel_ambient"), Valor.Vec(sky * 0.5f));
            g.Poner(Ids.De("unity_IndirectSpecColor"), Valor.Vec(RenderSettings.especularIndirecto));
            // niebla
            float d = RenderSettings.densidad, ini = RenderSettings.inicioNiebla, fin = RenderSettings.finNiebla;
            float rango = Math.Abs(fin - ini) < 1e-4f ? 1e-4f : fin - ini;
            g.Poner(Ids.De("unity_FogColor"), Valor.Vec(RenderSettings.colorNiebla));
            g.Poner(Ids.De("unity_FogParams"), Valor.Vec(new Vector4(d / 0.8325546f, d / 0.6931472f, -1f / rango, fin / rango)));
            g.Poner(Ids.De("unity_FogStart"), Valor.Numero(ini));
            g.Poner(Ids.De("unity_FogEnd"), Valor.Numero(fin));
            g.Poner(Ids.De("unity_FogDensity"), Valor.Numero(d));
        }

        // la textura de caída de las luces puntuales y spot (la misma curva que usa Unity)
        static Texture2D atenuacion;
        internal static Texture2D Atenuacion()
        {
            if (atenuacion != null) return atenuacion;
            const int N = 256;
            var t = new Texture2D(N, 1, TextureFormat.RGBA32, false, true) { m_Name = "porteo_atenuacion", wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            for (int i = 0; i < N; i++)
            {
                float d2 = i / (float)(N - 1);
                float a = 1f / (1f + 25f * d2);
                const float corte = 0.64f;
                if (d2 >= corte) a *= d2 >= 1 ? 0 : 1 - (d2 - corte) / (1 - corte);
                byte b = (byte)Math.Clamp((int)(a * 255 + 0.5f), 0, 255);
                t.SetPixel(i, 0, new Color32(b, b, b, b));
            }
            t.Apply();
            Registro.Baja(t);
            return atenuacion = t;
        }
    }
}

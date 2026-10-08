using System;
using Porteo;
using Porteo.Datos;

namespace UnityEngine
{
    // Un sprite: un rectángulo de una textura (en píxeles) con su pivote, bordes (9-slice) y
    // escala, más la malla ajustada a la forma (m_RD) que se arma recién si alguien la pide.
    public sealed partial class Sprite : Object
    {
        internal Rect rectangulo, rectTextura;
        internal Vector2 desplazamiento, pivoteNormal, desplazamientoTextura;
        internal Vector4 borde;
        internal float pixelesPorUnidad = 100f;
        internal Texture2D tex, texAlfa;
        internal uint ajustes;
        Mapa datosMalla;
        IResolutor resolutor;
        Mesh malla;

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            rectangulo = Rectangulo(m.M("m_Rect"));
            desplazamiento = Serial.V2(m.M("m_Offset"));
            borde = Serial.V4(m.M("m_Border"));
            pixelesPorUnidad = m.F("m_PixelsToUnits", 100f);
            pivoteNormal = m.Tiene("m_Pivot") ? Serial.V2(m.M("m_Pivot")) : new Vector2(0.5f, 0.5f);
            var rd = m.M("m_RD");
            if (rd != null)
            {
                tex = r.Resolver(rd.P("texture")) as Texture2D;
                texAlfa = r.Resolver(rd.P("alphaTexture")) as Texture2D;
                rectTextura = Rectangulo(rd.M("textureRect"));
                desplazamientoTextura = Serial.V2(rd.M("textureRectOffset"));
                ajustes = (uint)rd.I("settingsRaw");
                datosMalla = rd;
                resolutor = r;
            }
        }

        static Rect Rectangulo(Mapa m) => m == null ? default : new Rect(m.F("x"), m.F("y"), m.F("width"), m.F("height"));

        public Rect rect => rectangulo;
        public Texture2D texture => tex;
        public Texture2D associatedAlphaSplitTexture => texAlfa;
        public Vector4 border => borde;
        public float pixelsPerUnit => pixelesPorUnidad;
        public Vector2 pivot => new Vector2(pivoteNormal.x * rectangulo.width, pivoteNormal.y * rectangulo.height);
        public bool packed => (ajustes & 1) != 0;
        public SpritePackingMode packingMode => (ajustes & 2) != 0 ? SpritePackingMode.Rectangle : SpritePackingMode.Tight;
        public SpritePackingRotation packingRotation => (SpritePackingRotation)((ajustes >> 2) & 15);
        public Vector2 textureRectOffset => desplazamientoTextura;

        public Rect textureRect
        {
            get
            {
                if (packed && packingMode == SpritePackingMode.Tight)
                    throw new UnityException("Sprite is not rectangle-packed. TextureRect is invalid.");
                return rectTextura;
            }
        }

        // en unidades del mundo, con el pivote en el origen (z de 0.2 como Unity)
        public Bounds bounds
        {
            get
            {
                float ppu = Math.Max(pixelesPorUnidad, 1e-5f);
                var tam = new Vector2(rectangulo.width, rectangulo.height) / ppu;
                var centro = (new Vector2(rectangulo.width * 0.5f, rectangulo.height * 0.5f) - pivot) / ppu;
                return new Bounds(new Vector3(centro.x, centro.y, 0), new Vector3(tam.x, tam.y, 0.2f));
            }
        }

        Mesh Malla()
        {
            if (malla != null || datosMalla == null) return malla;
            malla = new Mesh { m_Name = m_Name };
            Registro.Baja(malla);
            malla.LeerNativo(datosMalla, resolutor);
            return malla;
        }

        public Vector2[] vertices
        {
            get
            {
                var m = Malla();
                if (m == null) return Cuadrado(false);
                var v = m.vertices;
                var r = new Vector2[v.Length];
                for (int i = 0; i < v.Length; i++) r[i] = new Vector2(v[i].x, v[i].y);
                return r;
            }
        }

        public Vector2[] uv => Malla()?.uv ?? Cuadrado(true);

        public ushort[] triangles
        {
            get
            {
                var m = Malla();
                if (m == null) return new ushort[] { 0, 1, 2, 2, 3, 0 };
                var t = m.subMeshCount > 0 ? m.GetIndices(0) : Array.Empty<int>();
                var r = new ushort[t.Length];
                for (int i = 0; i < t.Length; i++) r[i] = (ushort)t[i];
                return r;
            }
        }

        // los sprites creados por código: el rectángulo entero
        Vector2[] Cuadrado(bool uv)
        {
            if (uv)
            {
                float w = tex != null ? tex.width : 1, h = tex != null ? tex.height : 1;
                return new[]
                {
                    new Vector2(rectTextura.xMin / w, rectTextura.yMin / h), new Vector2(rectTextura.xMin / w, rectTextura.yMax / h),
                    new Vector2(rectTextura.xMax / w, rectTextura.yMax / h), new Vector2(rectTextura.xMax / w, rectTextura.yMin / h),
                };
            }
            float ppu = Math.Max(pixelesPorUnidad, 1e-5f);
            var p = pivot;
            return new[]
            {
                new Vector2(-p.x, -p.y) / ppu, new Vector2(-p.x, rectangulo.height - p.y) / ppu,
                new Vector2(rectangulo.width - p.x, rectangulo.height - p.y) / ppu, new Vector2(rectangulo.width - p.x, -p.y) / ppu,
            };
        }

        public static Sprite Create(Texture2D texture, Rect rect, Vector2 pivot) => Create(texture, rect, pivot, 100f, 0, SpriteMeshType.Tight, Vector4.zero);
        public static Sprite Create(Texture2D texture, Rect rect, Vector2 pivot, float pixelsPerUnit) => Create(texture, rect, pivot, pixelsPerUnit, 0, SpriteMeshType.Tight, Vector4.zero);
        public static Sprite Create(Texture2D texture, Rect rect, Vector2 pivot, float pixelsPerUnit, uint extrude) => Create(texture, rect, pivot, pixelsPerUnit, extrude, SpriteMeshType.Tight, Vector4.zero);
        public static Sprite Create(Texture2D texture, Rect rect, Vector2 pivot, float pixelsPerUnit, uint extrude, SpriteMeshType meshType) => Create(texture, rect, pivot, pixelsPerUnit, extrude, meshType, Vector4.zero);

        public static Sprite Create(Texture2D texture, Rect rect, Vector2 pivot, float pixelsPerUnit, uint extrude, SpriteMeshType meshType, Vector4 border)
        {
            if (texture == null) return null;
            if (rect.xMax > texture.width || rect.yMax > texture.height || rect.x < 0 || rect.y < 0)
                throw new ArgumentException($"Could not create sprite ({rect.x}, {rect.y}, {rect.width}, {rect.height}) from a {texture.width}x{texture.height} texture.");
            return new Sprite(true)
            {
                tex = texture, rectangulo = rect, rectTextura = rect, pivoteNormal = pivot, pixelesPorUnidad = pixelsPerUnit <= 0 ? 100f : pixelsPerUnit,
                borde = border, ajustes = meshType == SpriteMeshType.FullRect ? 0u : 64u, m_Name = "",
            };
        }
    }

    public enum SpritePackingMode { Tight = 0, Rectangle = 1 }
    public enum SpritePackingRotation { None = 0, FlipHorizontal = 1, FlipVertical = 2, Rotate180 = 3, Any = 15 }
    public enum SpriteMeshType { FullRect = 0, Tight = 1 }
}

namespace UnityEngine.Sprites
{
    // Las cuentas que usa el uGUI para dibujar un sprite (las UV y el 9-slice).
    public sealed partial class DataUtility
    {
        // el rectángulo de la textura que ocupa el sprite, en UV
        public static Vector4 GetOuterUV(Sprite sprite)
        {
            var t = sprite?.tex;
            if (t == null || t.width == 0 || t.height == 0) return new Vector4(0, 0, 1, 1);
            var r = sprite.rectTextura;
            float x = 1f / t.width, y = 1f / t.height;
            return new Vector4(r.xMin * x, r.yMin * y, r.xMax * x, r.yMax * y);
        }

        // lo de adentro del 9-slice: el rectángulo de la textura menos los bordes (que se miden en
        // el rect del sprite, que puede tener recortes transparentes alrededor del de la textura)
        public static Vector4 GetInnerUV(Sprite sprite)
        {
            var t = sprite?.tex;
            if (t == null || t.width == 0 || t.height == 0) return Vector4.zero;
            var r = sprite.rectTextura;
            var o = sprite.desplazamientoTextura;
            var b = sprite.borde;
            var pad = GetPadding(sprite);
            float izq = r.xMin + Math.Max(0, b.x - pad.x), abajo = r.yMin + Math.Max(0, b.y - pad.y);
            float der = r.xMax - Math.Max(0, b.z - pad.z), arriba = r.yMax - Math.Max(0, b.w - pad.w);
            float x = 1f / t.width, y = 1f / t.height;
            return new Vector4(izq * x, abajo * y, der * x, arriba * y);
        }

        // lo que el rect de la textura deja afuera del rect del sprite: izquierda, abajo, derecha, arriba
        public static Vector4 GetPadding(Sprite sprite)
        {
            if (sprite?.tex == null) return Vector4.zero;
            var s = sprite.rectangulo;
            var r = sprite.rectTextura;
            var o = sprite.desplazamientoTextura;
            return new Vector4(o.x, o.y, s.width - (r.width + o.x), s.height - (r.height + o.y));
        }

        public static Vector2 GetMinSize(Sprite sprite)
        {
            if (sprite == null) return Vector2.zero;
            var b = sprite.borde;
            return new Vector2(b.x + b.z, b.y + b.w);
        }
    }
}

namespace UnityEngine.U2D
{
    // Los atlas que se cargan tarde (late binding): este juego no tiene, así que nadie los pide.
    public partial class SpriteAtlasManager
    {
        public static event Action<SpriteAtlas> atlasRegistered { add { } remove { } }
        public static event Action<string, Action<SpriteAtlas>> atlasRequested { add { } remove { } }
    }
}

namespace UnityEngine
{
    // El perfilador de la UI: no hay perfilador.
    public static partial class UISystemProfilerApi
    {
        public static void BeginSample(SampleType type) { }
        public static void EndSample(SampleType type) { }
        public static void AddMarker(string name, Object obj) { }
    }
}

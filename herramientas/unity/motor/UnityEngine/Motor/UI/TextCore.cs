using System;
using System.Collections.Generic;
using Porteo.UI;

// TextCore: lo que usa TextMeshPro de Unity 2022 para las fuentes. Los glifos, sus medidas y los
// ajustes entre pares vienen serializados en cada TMP_FontAsset (con los mismos nombres de campo
// que Unity, así Serial los llena); el FontEngine dibuja los glifos que faltan en los atlas
// dinámicos desde el contorno del TrueType, con el mismo campo de distancia que hace Unity.
namespace UnityEngine.TextCore
{
    // las medidas de la cara a un tamaño (en píxeles a 72 ppp: 1 punto = 1 píxel del atlas)
    [Serializable]
    public struct FaceInfo
    {
        [SerializeField] int m_FaceIndex;
        [SerializeField] string m_FamilyName;
        [SerializeField] string m_StyleName;
        [SerializeField] int m_PointSize;
        [SerializeField] float m_Scale;
        [SerializeField] int m_UnitsPerEM;
        [SerializeField] float m_LineHeight;
        [SerializeField] float m_AscentLine;
        [SerializeField] float m_CapLine;
        [SerializeField] float m_MeanLine;
        [SerializeField] float m_Baseline;
        [SerializeField] float m_DescentLine;
        [SerializeField] float m_SuperscriptOffset;
        [SerializeField] float m_SuperscriptSize;
        [SerializeField] float m_SubscriptOffset;
        [SerializeField] float m_SubscriptSize;
        [SerializeField] float m_UnderlineOffset;
        [SerializeField] float m_UnderlineThickness;
        [SerializeField] float m_StrikethroughOffset;
        [SerializeField] float m_StrikethroughThickness;
        [SerializeField] float m_TabWidth;

        public int faceIndex { get => m_FaceIndex; set => m_FaceIndex = value; }
        public string familyName { get => m_FamilyName; set => m_FamilyName = value; }
        public string styleName { get => m_StyleName; set => m_StyleName = value; }
        public int pointSize { get => m_PointSize; set => m_PointSize = value; }
        public float scale { get => m_Scale; set => m_Scale = value; }
        public int unitsPerEM { get => m_UnitsPerEM; set => m_UnitsPerEM = value; }
        public float lineHeight { get => m_LineHeight; set => m_LineHeight = value; }
        public float ascentLine { get => m_AscentLine; set => m_AscentLine = value; }
        public float capLine { get => m_CapLine; set => m_CapLine = value; }
        public float meanLine { get => m_MeanLine; set => m_MeanLine = value; }
        public float baseline { get => m_Baseline; set => m_Baseline = value; }
        public float descentLine { get => m_DescentLine; set => m_DescentLine = value; }
        public float superscriptOffset { get => m_SuperscriptOffset; set => m_SuperscriptOffset = value; }
        public float superscriptSize { get => m_SuperscriptSize; set => m_SuperscriptSize = value; }
        public float subscriptOffset { get => m_SubscriptOffset; set => m_SubscriptOffset = value; }
        public float subscriptSize { get => m_SubscriptSize; set => m_SubscriptSize = value; }
        public float underlineOffset { get => m_UnderlineOffset; set => m_UnderlineOffset = value; }
        public float underlineThickness { get => m_UnderlineThickness; set => m_UnderlineThickness = value; }
        public float strikethroughOffset { get => m_StrikethroughOffset; set => m_StrikethroughOffset = value; }
        public float strikethroughThickness { get => m_StrikethroughThickness; set => m_StrikethroughThickness = value; }
        public float tabWidth { get => m_TabWidth; set => m_TabWidth = value; }

        public bool Compare(FaceInfo other) =>
            m_FamilyName == other.m_FamilyName && m_StyleName == other.m_StyleName && m_FaceIndex == other.m_FaceIndex &&
            m_PointSize == other.m_PointSize && m_Scale == other.m_Scale && m_UnitsPerEM == other.m_UnitsPerEM &&
            m_LineHeight == other.m_LineHeight && m_AscentLine == other.m_AscentLine && m_CapLine == other.m_CapLine &&
            m_MeanLine == other.m_MeanLine && m_Baseline == other.m_Baseline && m_DescentLine == other.m_DescentLine &&
            m_SuperscriptOffset == other.m_SuperscriptOffset && m_SuperscriptSize == other.m_SuperscriptSize &&
            m_SubscriptOffset == other.m_SubscriptOffset && m_SubscriptSize == other.m_SubscriptSize &&
            m_UnderlineOffset == other.m_UnderlineOffset && m_UnderlineThickness == other.m_UnderlineThickness &&
            m_StrikethroughOffset == other.m_StrikethroughOffset && m_StrikethroughThickness == other.m_StrikethroughThickness &&
            m_TabWidth == other.m_TabWidth;
    }

    [Serializable]
    public struct GlyphMetrics : IEquatable<GlyphMetrics>
    {
        [SerializeField] float m_Width;
        [SerializeField] float m_Height;
        [SerializeField] float m_HorizontalBearingX;
        [SerializeField] float m_HorizontalBearingY;
        [SerializeField] float m_HorizontalAdvance;

        public GlyphMetrics(float width, float height, float bearingX, float bearingY, float advance)
        {
            m_Width = width; m_Height = height; m_HorizontalBearingX = bearingX; m_HorizontalBearingY = bearingY; m_HorizontalAdvance = advance;
        }

        public float width { get => m_Width; set => m_Width = value; }
        public float height { get => m_Height; set => m_Height = value; }
        public float horizontalBearingX { get => m_HorizontalBearingX; set => m_HorizontalBearingX = value; }
        public float horizontalBearingY { get => m_HorizontalBearingY; set => m_HorizontalBearingY = value; }
        public float horizontalAdvance { get => m_HorizontalAdvance; set => m_HorizontalAdvance = value; }

        public bool Equals(GlyphMetrics other) =>
            m_Width == other.m_Width && m_Height == other.m_Height && m_HorizontalBearingX == other.m_HorizontalBearingX &&
            m_HorizontalBearingY == other.m_HorizontalBearingY && m_HorizontalAdvance == other.m_HorizontalAdvance;
        public override bool Equals(object obj) => obj is GlyphMetrics m && Equals(m);
        public override int GetHashCode() => HashCode.Combine(m_Width, m_Height, m_HorizontalBearingX, m_HorizontalBearingY, m_HorizontalAdvance);
        public static bool operator ==(GlyphMetrics lhs, GlyphMetrics rhs) => lhs.Equals(rhs);
        public static bool operator !=(GlyphMetrics lhs, GlyphMetrics rhs) => !lhs.Equals(rhs);
    }

    // el lugar del glifo en el atlas, en texeles (y desde abajo, como las texturas de Unity)
    [Serializable]
    public struct GlyphRect : IEquatable<GlyphRect>
    {
        [SerializeField] int m_X;
        [SerializeField] int m_Y;
        [SerializeField] int m_Width;
        [SerializeField] int m_Height;

        static readonly GlyphRect s_ZeroGlyphRect = new GlyphRect(0, 0, 0, 0);

        public GlyphRect(int x, int y, int width, int height) { m_X = x; m_Y = y; m_Width = width; m_Height = height; }
        public GlyphRect(Rect rect) { m_X = (int)rect.x; m_Y = (int)rect.y; m_Width = (int)rect.width; m_Height = (int)rect.height; }

        public int x { get => m_X; set => m_X = value; }
        public int y { get => m_Y; set => m_Y = value; }
        public int width { get => m_Width; set => m_Width = value; }
        public int height { get => m_Height; set => m_Height = value; }
        public static GlyphRect zero => s_ZeroGlyphRect;

        public bool Equals(GlyphRect other) => m_X == other.m_X && m_Y == other.m_Y && m_Width == other.m_Width && m_Height == other.m_Height;
        public override bool Equals(object obj) => obj is GlyphRect r && Equals(r);
        public override int GetHashCode() => HashCode.Combine(m_X, m_Y, m_Width, m_Height);
        public static bool operator ==(GlyphRect lhs, GlyphRect rhs) => lhs.Equals(rhs);
        public static bool operator !=(GlyphRect lhs, GlyphRect rhs) => !lhs.Equals(rhs);
    }

    public enum GlyphClassDefinitionType
    {
        Undefined = 0,
        BaseGlyph = 1,
        LigatureGlyph = 2,
        MarkGlyph = 3,
        ComponentGlyph = 4,
    }

    [Serializable]
    public class Glyph
    {
        [SerializeField] uint m_Index;
        [SerializeField] GlyphMetrics m_Metrics;
        [SerializeField] GlyphRect m_GlyphRect;
        [SerializeField] float m_Scale;
        [SerializeField] int m_AtlasIndex;
        [SerializeField] GlyphClassDefinitionType m_ClassDefinitionType;

        public uint index { get => m_Index; set => m_Index = value; }
        public GlyphMetrics metrics { get => m_Metrics; set => m_Metrics = value; }
        public GlyphRect glyphRect { get => m_GlyphRect; set => m_GlyphRect = value; }
        public float scale { get => m_Scale; set => m_Scale = value; }
        public int atlasIndex { get => m_AtlasIndex; set => m_AtlasIndex = value; }
        public GlyphClassDefinitionType classDefinitionType { get => m_ClassDefinitionType; set => m_ClassDefinitionType = value; }

        public Glyph() { m_Scale = 1; }

        public Glyph(Glyph glyph)
        {
            m_Index = glyph.m_Index; m_Metrics = glyph.m_Metrics; m_GlyphRect = glyph.m_GlyphRect;
            m_Scale = glyph.m_Scale; m_AtlasIndex = glyph.m_AtlasIndex; m_ClassDefinitionType = glyph.m_ClassDefinitionType;
        }

        public Glyph(uint index, GlyphMetrics metrics, GlyphRect glyphRect) : this(index, metrics, glyphRect, 1, 0) { }

        public Glyph(uint index, GlyphMetrics metrics, GlyphRect glyphRect, float scale, int atlasIndex)
        {
            m_Index = index; m_Metrics = metrics; m_GlyphRect = glyphRect; m_Scale = scale; m_AtlasIndex = atlasIndex;
        }

        public bool Compare(Glyph other) =>
            other != null && m_Index == other.m_Index && m_Metrics == other.m_Metrics && m_GlyphRect == other.m_GlyphRect &&
            m_Scale == other.m_Scale && m_AtlasIndex == other.m_AtlasIndex;
    }
}

namespace UnityEngine.TextCore.LowLevel
{
    public enum FontEngineError
    {
        Success = 0,
        Invalid_File_Path = 1,
        Invalid_File_Format = 2,
        Invalid_File_Structure = 3,
        Invalid_File = 4,
        Invalid_Table = 8,
        Invalid_Glyph_Index = 16,
        Invalid_Character_Code = 17,
        Invalid_Pixel_Size = 23,
        Invalid_Library = 33,
        Invalid_Face = 35,
        Invalid_Library_or_Face = 41,
        Atlas_Generation_Cancelled = 100,
        Invalid_SharedTextureData = 101,
        OpenTypeLayoutLookup_Mismatch = 116,
    }

    [Flags]
    public enum FontFeatureLookupFlags
    {
        None = 0,
        IgnoreLigatures = 4,
        IgnoreSpacingAdjustments = 256,
    }

    [Flags]
    public enum GlyphLoadFlags
    {
        LOAD_DEFAULT = 0,
        LOAD_NO_SCALE = 1,
        LOAD_NO_HINTING = 2,
        LOAD_RENDER = 4,
        LOAD_NO_BITMAP = 8,
        LOAD_FORCE_AUTOHINT = 32,
        LOAD_MONOCHROME = 4096,
        LOAD_NO_AUTOHINT = 32768,
        LOAD_COLOR = 1048576,
        LOAD_COMPUTE_METRICS = 2097152,
        LOAD_BITMAP_METRICS_ONLY = 4194304,
    }

    public enum GlyphPackingMode
    {
        BestShortSideFit = 0,
        BestLongSideFit = 1,
        BestAreaFit = 2,
        BottomLeftRule = 3,
        ContactPointRule = 4,
    }

    public enum GlyphRenderMode
    {
        SMOOTH_HINTED = 4121,
        SMOOTH = 4117,
        COLOR_HINTED = 69656,
        COLOR = 69652,
        RASTER_HINTED = 4122,
        RASTER = 4118,
        SDF = 4134,
        SDF8 = 8230,
        SDF16 = 16422,
        SDF32 = 32806,
        SDFAA_HINTED = 4169,
        SDFAA = 4165,
    }

    [Serializable]
    public struct GlyphValueRecord : IEquatable<GlyphValueRecord>
    {
        [SerializeField] float m_XPlacement;
        [SerializeField] float m_YPlacement;
        [SerializeField] float m_XAdvance;
        [SerializeField] float m_YAdvance;

        public GlyphValueRecord(float xPlacement, float yPlacement, float xAdvance, float yAdvance)
        {
            m_XPlacement = xPlacement; m_YPlacement = yPlacement; m_XAdvance = xAdvance; m_YAdvance = yAdvance;
        }

        public float xPlacement { get => m_XPlacement; set => m_XPlacement = value; }
        public float yPlacement { get => m_YPlacement; set => m_YPlacement = value; }
        public float xAdvance { get => m_XAdvance; set => m_XAdvance = value; }
        public float yAdvance { get => m_YAdvance; set => m_YAdvance = value; }

        public static GlyphValueRecord operator +(GlyphValueRecord a, GlyphValueRecord b) =>
            new GlyphValueRecord(a.m_XPlacement + b.m_XPlacement, a.m_YPlacement + b.m_YPlacement, a.m_XAdvance + b.m_XAdvance, a.m_YAdvance + b.m_YAdvance);
        public bool Equals(GlyphValueRecord other) =>
            m_XPlacement == other.m_XPlacement && m_YPlacement == other.m_YPlacement && m_XAdvance == other.m_XAdvance && m_YAdvance == other.m_YAdvance;
        public override bool Equals(object obj) => obj is GlyphValueRecord r && Equals(r);
        public override int GetHashCode() => HashCode.Combine(m_XPlacement, m_YPlacement, m_XAdvance, m_YAdvance);
        public static bool operator ==(GlyphValueRecord lhs, GlyphValueRecord rhs) => lhs.Equals(rhs);
        public static bool operator !=(GlyphValueRecord lhs, GlyphValueRecord rhs) => !lhs.Equals(rhs);
    }

    [Serializable]
    public struct GlyphAdjustmentRecord : IEquatable<GlyphAdjustmentRecord>
    {
        [SerializeField] uint m_GlyphIndex;
        [SerializeField] GlyphValueRecord m_GlyphValueRecord;

        public GlyphAdjustmentRecord(uint glyphIndex, GlyphValueRecord glyphValueRecord) { m_GlyphIndex = glyphIndex; m_GlyphValueRecord = glyphValueRecord; }

        public uint glyphIndex { get => m_GlyphIndex; set => m_GlyphIndex = value; }
        public GlyphValueRecord glyphValueRecord { get => m_GlyphValueRecord; set => m_GlyphValueRecord = value; }

        public bool Equals(GlyphAdjustmentRecord other) => m_GlyphIndex == other.m_GlyphIndex && m_GlyphValueRecord == other.m_GlyphValueRecord;
        public override bool Equals(object obj) => obj is GlyphAdjustmentRecord r && Equals(r);
        public override int GetHashCode() => HashCode.Combine(m_GlyphIndex, m_GlyphValueRecord);
        public static bool operator ==(GlyphAdjustmentRecord lhs, GlyphAdjustmentRecord rhs) => lhs.Equals(rhs);
        public static bool operator !=(GlyphAdjustmentRecord lhs, GlyphAdjustmentRecord rhs) => !lhs.Equals(rhs);
    }

    [Serializable]
    public struct GlyphPairAdjustmentRecord : IEquatable<GlyphPairAdjustmentRecord>
    {
        [SerializeField] GlyphAdjustmentRecord m_FirstAdjustmentRecord;
        [SerializeField] GlyphAdjustmentRecord m_SecondAdjustmentRecord;
        [SerializeField] FontFeatureLookupFlags m_FeatureLookupFlags;

        public GlyphPairAdjustmentRecord(GlyphAdjustmentRecord firstAdjustmentRecord, GlyphAdjustmentRecord secondAdjustmentRecord)
        {
            m_FirstAdjustmentRecord = firstAdjustmentRecord; m_SecondAdjustmentRecord = secondAdjustmentRecord; m_FeatureLookupFlags = FontFeatureLookupFlags.None;
        }

        public GlyphAdjustmentRecord firstAdjustmentRecord { get => m_FirstAdjustmentRecord; set => m_FirstAdjustmentRecord = value; }
        public GlyphAdjustmentRecord secondAdjustmentRecord { get => m_SecondAdjustmentRecord; set => m_SecondAdjustmentRecord = value; }
        public FontFeatureLookupFlags featureLookupFlags { get => m_FeatureLookupFlags; set => m_FeatureLookupFlags = value; }

        public bool Equals(GlyphPairAdjustmentRecord other) =>
            m_FirstAdjustmentRecord == other.m_FirstAdjustmentRecord && m_SecondAdjustmentRecord == other.m_SecondAdjustmentRecord;
        public override bool Equals(object obj) => obj is GlyphPairAdjustmentRecord r && Equals(r);
        public override int GetHashCode() => HashCode.Combine(m_FirstAdjustmentRecord, m_SecondAdjustmentRecord);
        public static bool operator ==(GlyphPairAdjustmentRecord lhs, GlyphPairAdjustmentRecord rhs) => lhs.Equals(rhs);
        public static bool operator !=(GlyphPairAdjustmentRecord lhs, GlyphPairAdjustmentRecord rhs) => !lhs.Equals(rhs);
    }

    // La cara cargada es la última de LoadFontFace (como en Unity, que tiene una sola a la vez).
    // Las medidas salen de las tablas del TrueType; el dibujo, del contorno (Contornos).
    public sealed class FontEngine
    {
        FontEngine() { }

        static TTF ttf;
        static int puntos;
        static float escala;   // píxeles por unidad de la fuente
        static readonly Dictionary<byte[], TTF> leidas = new Dictionary<byte[], TTF>();

        public static FontEngineError InitializeFontEngine() => FontEngineError.Success;
        public static FontEngineError DestroyFontEngine() { ttf = null; return FontEngineError.Success; }

        public static FontEngineError LoadFontFace(Font font) => LoadFontFace(font, font != null ? font.fontSize : 0);

        public static FontEngineError LoadFontFace(Font font, int pointSize)
        {
            if (font == null) return FontEngineError.Invalid_File;
            if (font.tabla == null) return FontEngineError.Invalid_File_Format;
            return Cargar(font.tabla, pointSize);
        }

        public static FontEngineError LoadFontFace(Font font, int pointSize, int faceIndex) => LoadFontFace(font, pointSize);
        public static FontEngineError LoadFontFace(byte[] sourceFontFile) => LoadFontFace(sourceFontFile, 12);
        public static FontEngineError LoadFontFace(byte[] sourceFontFile, int pointSize) => LoadFontFace(sourceFontFile, pointSize, 0);

        public static FontEngineError LoadFontFace(byte[] sourceFontFile, int pointSize, int faceIndex)
        {
            if (sourceFontFile == null) return FontEngineError.Invalid_File;
            if (!leidas.TryGetValue(sourceFontFile, out var t)) leidas[sourceFontFile] = t = TTF.Leer(sourceFontFile);
            return t == null ? FontEngineError.Invalid_File_Format : Cargar(t, pointSize);
        }

        // no hay archivos de fuentes del sistema en el navegador
        public static FontEngineError LoadFontFace(string filePath) => FontEngineError.Invalid_File_Path;
        public static FontEngineError LoadFontFace(string filePath, int pointSize) => FontEngineError.Invalid_File_Path;
        public static FontEngineError LoadFontFace(string filePath, int pointSize, int faceIndex) => FontEngineError.Invalid_File_Path;
        public static FontEngineError LoadFontFace(string familyName, string styleName) => FontEngineError.Invalid_File_Path;
        public static FontEngineError LoadFontFace(string familyName, string styleName, int pointSize) => FontEngineError.Invalid_File_Path;

        static FontEngineError Cargar(TTF t, int pointSize)
        {
            if (pointSize <= 0) return FontEngineError.Invalid_Pixel_Size;
            ttf = t;
            puntos = pointSize;
            escala = pointSize / (float)t.UnidadesEm;
            return FontEngineError.Success;
        }

        public static FontEngineError SetFaceSize(int pointSize) => ttf == null ? FontEngineError.Invalid_Face : Cargar(ttf, pointSize);

        public static FaceInfo GetFaceInfo()
        {
            var fi = new FaceInfo();
            if (ttf == null) return fi;
            float s = escala;
            fi.familyName = ttf.Familia;
            fi.styleName = ttf.Estilo;
            fi.pointSize = puntos;
            fi.scale = 1;
            fi.unitsPerEM = ttf.UnidadesEm;
            fi.lineHeight = (ttf.Ascenso - ttf.Descenso + ttf.Separacion) * s;
            fi.ascentLine = ttf.Ascenso * s;
            fi.descentLine = ttf.Descenso * s;
            fi.baseline = 0;
            // las líneas de las mayúsculas y de la x van redondeadas (así las da Unity)
            fi.capLine = (float)Math.Round((ttf.AltoMayusculas > 0 ? ttf.AltoMayusculas : AltoDe('H')) * s);
            fi.meanLine = (float)Math.Round((ttf.AltoX > 0 ? ttf.AltoX : AltoDe('x')) * s);
            fi.superscriptOffset = fi.ascentLine;
            fi.superscriptSize = 0.5f;
            fi.subscriptOffset = fi.descentLine;
            fi.subscriptSize = 0.5f;
            fi.underlineOffset = ttf.SubrayadoPos * s;
            fi.underlineThickness = ttf.SubrayadoGrosor * s;
            fi.strikethroughOffset = fi.meanLine / 2.5f;
            fi.strikethroughThickness = fi.underlineThickness;
            fi.tabWidth = (float)Math.Round(ttf.Avance(ttf.Glifo(' ')) * s);
            return fi;
        }

        static int AltoDe(char c)
        {
            ttf.Caja(ttf.Glifo(c), out _, out _, out _, out int y1);
            return y1;
        }

        public static uint GetGlyphIndex(uint unicode) => ttf == null ? 0 : (uint)ttf.Glifo((int)unicode);

        public static bool TryGetGlyphWithUnicodeValue(uint unicode, GlyphLoadFlags flags, out Glyph glyph)
        {
            glyph = null;
            if (ttf == null) return false;
            int g = ttf.Glifo((int)unicode);
            if (g == 0 && unicode != 0) return false;
            glyph = new Glyph((uint)g, Medidas(g, (flags & GlyphLoadFlags.LOAD_NO_HINTING) == 0), GlyphRect.zero, 1, 0);
            return true;
        }

        public static bool TryGetGlyphWithIndexValue(uint glyphIndex, GlyphLoadFlags flags, out Glyph glyph)
        {
            glyph = null;
            if (ttf == null || glyphIndex >= ttf.Glifos) return false;
            glyph = new Glyph(glyphIndex, Medidas((int)glyphIndex, (flags & GlyphLoadFlags.LOAD_NO_HINTING) == 0), GlyphRect.zero, 1, 0);
            return true;
        }

        // la caja del mapa de bits del glifo en píxeles enteros (como la da FreeType); con
        // ajuste a la grilla las alturas y el avance van redondeados
        static GlyphMetrics Medidas(int g, bool ajuste)
        {
            float s = escala;
            float avance = ttf.Avance(g) * s;
            avance = ajuste ? (float)Math.Round(avance) : (float)Math.Round(avance * 64) / 64f;
            ttf.Caja(g, out int x0, out int y0, out int x1, out int y1);
            if (x1 <= x0 || y1 <= y0) return new GlyphMetrics(0, 0, 0, 0, avance);
            int px0 = (int)Math.Floor(x0 * s), px1 = (int)Math.Ceiling(x1 * s);
            int py0 = ajuste ? (int)Math.Round(y0 * s) : (int)Math.Floor(y0 * s);
            int py1 = ajuste ? (int)Math.Round(y1 * s) : (int)Math.Ceiling(y1 * s);
            if (py1 <= py0) py1 = py0 + 1;
            if (px1 <= px0) px1 = px0 + 1;
            return new GlyphMetrics(px1 - px0, py1 - py0, px0, py1, avance);
        }

        // ── el atlas ──

        public static void ResetAtlasTexture(Texture2D texture)
        {
            if (texture == null) return;
            Array.Clear(texture.BytesAlfa());
            texture.BytesCambiados();
        }

        public static bool TryAddGlyphToTexture(uint glyphIndex, int padding, GlyphPackingMode packingMode, List<GlyphRect> freeGlyphRects, List<GlyphRect> usedGlyphRects, GlyphRenderMode renderMode, Texture2D texture, out Glyph glyph)
        {
            glyph = null;
            if (ttf == null || texture == null || glyphIndex >= ttf.Glifos) return false;
            var m = Medidas((int)glyphIndex, ((int)renderMode & 0x8) != 0);
            int w = (int)m.width, h = (int)m.height;
            // sin tinta (el espacio): no ocupa lugar en el atlas
            if (w == 0 || h == 0) { glyph = new Glyph(glyphIndex, m, GlyphRect.zero, 1, 0); return true; }
            if (freeGlyphRects.Count == 0 && usedGlyphRects.Count == 0)
            {
                int menos = ((int)renderMode & 0x10) != 0 ? 0 : 1;
                freeGlyphRects.Add(new GlyphRect(0, 0, texture.width - menos, texture.height - menos));
            }
            if (!Ubicar(w + padding * 2, h + padding * 2, freeGlyphRects, usedGlyphRects, out var r)) return false;
            var rect = new GlyphRect(r.x + padding, r.y + padding, w, h);
            glyph = new Glyph(glyphIndex, m, rect, 1, 0);
            Contornos.Dibujar(ttf, (int)glyphIndex, escala, m, rect, padding, ((int)renderMode & 0x60) != 0, texture);
            return true;
        }

        public static bool TryAddGlyphsToTexture(List<uint> glyphIndexes, int padding, GlyphPackingMode packingMode, List<GlyphRect> freeGlyphRects, List<GlyphRect> usedGlyphRects, GlyphRenderMode renderMode, Texture2D texture, out Glyph[] glyphs)
        {
            glyphs = new Glyph[glyphIndexes?.Count ?? 0];
            if (glyphIndexes == null) return false;
            // los más altos primero: se empaquetan mejor
            var orden = new List<uint>(glyphIndexes);
            if (ttf != null) orden.Sort((a, b) => Medidas((int)b, true).height.CompareTo(Medidas((int)a, true).height));
            int k = 0;
            foreach (var gi in orden)
            {
                if (!TryAddGlyphToTexture(gi, padding, packingMode, freeGlyphRects, usedGlyphRects, renderMode, texture, out var g)) return false;
                glyphs[k++] = g;
            }
            return true;
        }

        // MaxRects con "lado corto mejor": el libre donde sobra menos del lado que menos sobra
        static bool Ubicar(int w, int h, List<GlyphRect> libres, List<GlyphRect> usados, out GlyphRect r)
        {
            int mejorCorto = int.MaxValue, mejorLargo = int.MaxValue, k = -1;
            for (int i = 0; i < libres.Count; i++)
            {
                var f = libres[i];
                if (f.width < w || f.height < h) continue;
                int dw = f.width - w, dh = f.height - h;
                int corto = Math.Min(dw, dh), largo = Math.Max(dw, dh);
                if (corto < mejorCorto || (corto == mejorCorto && largo < mejorLargo)) { mejorCorto = corto; mejorLargo = largo; k = i; }
            }
            if (k < 0) { r = default; return false; }
            r = new GlyphRect(libres[k].x, libres[k].y, w, h);
            int n = libres.Count;
            for (int i = 0; i < n; i++)
                if (Partir(libres[i], r, libres)) { libres.RemoveAt(i); i--; n--; }
            Podar(libres);
            usados.Add(r);
            return true;
        }

        // lo que queda libre de f fuera de u (hasta 4 rectángulos que se pisan entre sí)
        static bool Partir(GlyphRect f, GlyphRect u, List<GlyphRect> libres)
        {
            if (u.x >= f.x + f.width || u.x + u.width <= f.x || u.y >= f.y + f.height || u.y + u.height <= f.y) return false;
            if (u.y > f.y) libres.Add(new GlyphRect(f.x, f.y, f.width, u.y - f.y));
            if (u.y + u.height < f.y + f.height) libres.Add(new GlyphRect(f.x, u.y + u.height, f.width, f.y + f.height - (u.y + u.height)));
            if (u.x > f.x) libres.Add(new GlyphRect(f.x, f.y, u.x - f.x, f.height));
            if (u.x + u.width < f.x + f.width) libres.Add(new GlyphRect(u.x + u.width, f.y, f.x + f.width - (u.x + u.width), f.height));
            return true;
        }

        static void Podar(List<GlyphRect> l)
        {
            for (int i = 0; i < l.Count; i++)
                for (int j = i + 1; j < l.Count; j++)
                {
                    if (Dentro(l[i], l[j])) { l.RemoveAt(i); i--; break; }
                    if (Dentro(l[j], l[i])) { l.RemoveAt(j); j--; }
                }
        }

        static bool Dentro(GlyphRect a, GlyphRect b) => a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;

        // ── ajustes entre pares (sólo la tabla kern clásica) ──

        public static GlyphPairAdjustmentRecord[] GetGlyphPairAdjustmentTable(uint[] glyphIndexes)
        {
            var l = Pares(glyphIndexes);
            return l.ToArray();
        }

        public static GlyphPairAdjustmentRecord[] GetGlyphPairAdjustmentRecords(List<uint> glyphIndexes, out int recordCount)
        {
            var l = Pares(glyphIndexes);
            recordCount = l.Count;
            return l.ToArray();
        }

        static List<GlyphPairAdjustmentRecord> Pares(IEnumerable<uint> glifos)
        {
            var r = new List<GlyphPairAdjustmentRecord>();
            if (ttf?.Kern == null || glifos == null) return r;
            var hay = new HashSet<uint>(glifos);
            foreach (var kv in ttf.Kern)
            {
                uint a = kv.Key >> 16, b = kv.Key & 0xFFFF;
                if (!hay.Contains(a) || !hay.Contains(b)) continue;
                var v = new GlyphValueRecord(0, 0, kv.Value * escala, 0);
                r.Add(new GlyphPairAdjustmentRecord(new GlyphAdjustmentRecord(a, v), new GlyphAdjustmentRecord(b, default)));
            }
            return r;
        }
    }
}

namespace Porteo.UI
{
    using UnityEngine;
    using UnityEngine.TextCore;

    // El contorno de un glifo TrueType (cuadráticas, glifos compuestos) pasado a segmentos y, de
    // ahí, el campo de distancia con signo que espera el shader de TMP: alfa = 0.5 + d / (2·(p+1))
    // con d en texeles (positivo adentro) y p el relleno del atlas. Así lo arma Unity: medido en
    // los atlas del juego, la rampa sube 1/20 por texel con relleno 9. Sin campo de distancia
    // (los modos de mapa de bits) queda la cobertura con suavizado: d + 0.5.
    internal static class Contornos
    {
        static readonly List<float> segmentos = new List<float>();
        static float[] campo = new float[64 * 64];
        static readonly List<(float x, int dir)> cruces = new List<(float, int)>();

        internal static void Dibujar(TTF t, int g, float s, GlyphMetrics m, GlyphRect r, int relleno, bool distancia, Texture2D tex)
        {
            int W = r.width + relleno * 2, H = r.height + relleno * 2;
            // del espacio de la fuente a la grilla del glifo con su relleno (y para arriba)
            float dx = -(m.horizontalBearingX - relleno), dy = -(m.horizontalBearingY - m.height - relleno);
            segmentos.Clear();
            try { Glifo(t, g, 1, 0, 0, 1, 0, 0, s, dx, dy, 0); }
            catch (Exception) { segmentos.Clear(); }
            float alcance = distancia ? relleno + 1.5f : 1.5f;
            if (campo.Length < W * H) campo = new float[W * H];
            Distancias(W, H, alcance);
            var bytes = tex.BytesAlfa();
            int tw = tex.width, th = tex.height, ox = r.x - relleno, oy = r.y - relleno;
            float k = 1f / (2f * (relleno + 1));
            for (int j = 0; j < H; j++)
            {
                int y = oy + j;
                if (y < 0 || y >= th) continue;
                for (int i = 0; i < W; i++)
                {
                    int x = ox + i;
                    if (x < 0 || x >= tw) continue;
                    float d = campo[j * W + i];
                    float a = distancia ? 0.5f + d * k : d + 0.5f;
                    bytes[y * tw + x] = (byte)(Math.Clamp(a, 0f, 1f) * 255f + 0.5f);
                }
            }
            tex.BytesCambiados();
        }

        static int U16(byte[] b, int p) => (b[p] << 8) | b[p + 1];
        static short S16(byte[] b, int p) => (short)((b[p] << 8) | b[p + 1]);
        static float F2Dot14(byte[] b, int p) => S16(b, p) / 16384f;

        // los segmentos de un glifo con la transformación (a b; c d) + (e, f) en unidades de la fuente
        static void Glifo(TTF t, int g, float a, float b, float c, float d, float e, float f, float s, float dx, float dy, int prof)
        {
            if (t.Loca == null || g < 0 || g >= t.Glifos || prof > 8) return;
            var B = t.B;
            int p = t.Loca[g], fin = t.Loca[g + 1];
            if (fin <= p) return;
            int nc = S16(B, p);
            if (nc < 0)
            {
                // compuesto: cada parte con su desplazamiento y su escala
                int q = p + 10;
                int banderas;
                do
                {
                    banderas = U16(B, q); int gi = U16(B, q + 2); q += 4;
                    float ox, oy;
                    if ((banderas & 1) != 0) { ox = S16(B, q); oy = S16(B, q + 2); q += 4; }
                    else { ox = (sbyte)B[q]; oy = (sbyte)B[q + 1]; q += 2; }
                    if ((banderas & 2) == 0) { ox = 0; oy = 0; }   // por puntos: no se usa en la práctica
                    float ta = 1, tb = 0, tc = 0, td = 1;
                    if ((banderas & 8) != 0) { ta = td = F2Dot14(B, q); q += 2; }
                    else if ((banderas & 0x40) != 0) { ta = F2Dot14(B, q); td = F2Dot14(B, q + 2); q += 4; }
                    else if ((banderas & 0x80) != 0) { ta = F2Dot14(B, q); tb = F2Dot14(B, q + 2); tc = F2Dot14(B, q + 4); td = F2Dot14(B, q + 6); q += 8; }
                    // la parte: x' = ta·x + tc·y + ox, y' = tb·x + td·y + oy; después la de afuera
                    Glifo(t, gi,
                        a * ta + c * tb, b * ta + d * tb,
                        a * tc + c * td, b * tc + d * td,
                        a * ox + c * oy + e, b * ox + d * oy + f,
                        s, dx, dy, prof + 1);
                }
                while ((banderas & 0x20) != 0);
                return;
            }
            if (nc == 0) return;
            var finales = new int[nc];
            for (int i = 0; i < nc; i++) finales[i] = U16(B, p + 10 + i * 2);
            int np = finales[nc - 1] + 1;
            int instr = U16(B, p + 10 + nc * 2);
            int k = p + 12 + nc * 2 + instr;
            var band = new byte[np];
            for (int i = 0; i < np;)
            {
                byte fl = B[k++];
                band[i++] = fl;
                if ((fl & 8) != 0) { int rep = B[k++]; while (rep-- > 0 && i < np) band[i++] = fl; }
            }
            var xs = new float[np]; var ys = new float[np];
            int v = 0;
            for (int i = 0; i < np; i++)
            {
                byte fl = band[i];
                if ((fl & 2) != 0) { int z = B[k++]; v += (fl & 16) != 0 ? z : -z; }
                else if ((fl & 16) == 0) { v += S16(B, k); k += 2; }
                xs[i] = v;
            }
            v = 0;
            for (int i = 0; i < np; i++)
            {
                byte fl = band[i];
                if ((fl & 4) != 0) { int z = B[k++]; v += (fl & 32) != 0 ? z : -z; }
                else if ((fl & 32) == 0) { v += S16(B, k); k += 2; }
                ys[i] = v;
            }
            // a píxeles de la grilla
            for (int i = 0; i < np; i++)
            {
                float x = xs[i], y = ys[i];
                xs[i] = (a * x + c * y + e) * s + dx;
                ys[i] = (b * x + d * y + f) * s + dy;
            }
            int ini = 0;
            for (int ci = 0; ci < nc; ci++)
            {
                int ult = finales[ci];
                Contorno(xs, ys, band, ini, ult);
                ini = ult + 1;
            }
        }

        // un contorno cerrado: entre dos puntos de control seguidos va uno implícito en el medio
        static void Contorno(float[] xs, float[] ys, byte[] band, int ini, int ult)
        {
            int n = ult - ini + 1;
            if (n < 2) return;
            bool En(int i) => (band[ini + (i % n + n) % n] & 1) != 0;
            float X(int i) => xs[ini + (i % n + n) % n];
            float Y(int i) => ys[ini + (i % n + n) % n];
            // se arranca en un punto sobre la curva (o en el medio de dos de control)
            int s0 = -1;
            for (int i = 0; i < n; i++) if (En(i)) { s0 = i; break; }
            float sx, sy;
            if (s0 >= 0) { sx = X(s0); sy = Y(s0); }
            else { s0 = 0; sx = (X(0) + X(n - 1)) * 0.5f; sy = (Y(0) + Y(n - 1)) * 0.5f; }
            float cx = sx, cy = sy;
            bool hayControl = false; float qx = 0, qy = 0;
            int inicio = En(s0) ? s0 + 1 : s0;
            for (int m = 0; m < n; m++)
            {
                int i = inicio + m;
                float px = X(i), py = Y(i);
                if (En(i))
                {
                    if (hayControl) Curva(cx, cy, qx, qy, px, py); else Linea(cx, cy, px, py);
                    cx = px; cy = py; hayControl = false;
                }
                else
                {
                    if (hayControl)
                    {
                        float mx = (qx + px) * 0.5f, my = (qy + py) * 0.5f;
                        Curva(cx, cy, qx, qy, mx, my);
                        cx = mx; cy = my;
                    }
                    qx = px; qy = py; hayControl = true;
                }
            }
            if (hayControl) Curva(cx, cy, qx, qy, sx, sy); else Linea(cx, cy, sx, sy);
        }

        static void Linea(float x0, float y0, float x1, float y1)
        {
            if (x0 == x1 && y0 == y1) return;
            segmentos.Add(x0); segmentos.Add(y0); segmentos.Add(x1); segmentos.Add(y1);
        }

        // la cuadrática en tramos rectos que no se apartan más de ~0.1 píxel
        static void Curva(float x0, float y0, float qx, float qy, float x1, float y1)
        {
            float ddx = x0 - 2 * qx + x1, ddy = y0 - 2 * qy + y1;
            float dd = MathF.Sqrt(ddx * ddx + ddy * ddy);
            int n = Math.Clamp((int)MathF.Ceiling(MathF.Sqrt(dd * 2.5f)), 1, 32);
            float px = x0, py = y0;
            for (int i = 1; i <= n; i++)
            {
                float u = i / (float)n, w = 1 - u;
                float x = w * w * x0 + 2 * w * u * qx + u * u * x1;
                float y = w * w * y0 + 2 * w * u * qy + u * u * y1;
                Linea(px, py, x, y);
                px = x; py = y;
            }
        }

        // distancia al borde más cercano (hasta el alcance) y el signo por la regla de giro no nulo
        static void Distancias(int W, int H, float alcance)
        {
            int n = W * H;
            for (int i = 0; i < n; i++) campo[i] = alcance;
            int ns = segmentos.Count / 4;
            for (int sgi = 0; sgi < ns; sgi++)
            {
                float x0 = segmentos[sgi * 4], y0 = segmentos[sgi * 4 + 1], x1 = segmentos[sgi * 4 + 2], y1 = segmentos[sgi * 4 + 3];
                int i0 = Math.Max(0, (int)MathF.Floor(MathF.Min(x0, x1) - alcance)), i1 = Math.Min(W - 1, (int)MathF.Ceiling(MathF.Max(x0, x1) + alcance));
                int j0 = Math.Max(0, (int)MathF.Floor(MathF.Min(y0, y1) - alcance)), j1 = Math.Min(H - 1, (int)MathF.Ceiling(MathF.Max(y0, y1) + alcance));
                float vx = x1 - x0, vy = y1 - y0;
                float l2 = vx * vx + vy * vy;
                float inv = l2 > 0 ? 1f / l2 : 0;
                for (int j = j0; j <= j1; j++)
                {
                    float py = j + 0.5f;
                    for (int i = i0; i <= i1; i++)
                    {
                        float px = i + 0.5f;
                        float u = ((px - x0) * vx + (py - y0) * vy) * inv;
                        u = u < 0 ? 0 : u > 1 ? 1 : u;
                        float ex = x0 + u * vx - px, ey = y0 + u * vy - py;
                        float dist = MathF.Sqrt(ex * ex + ey * ey);
                        ref float c = ref campo[j * W + i];
                        if (dist < c) c = dist;
                    }
                }
            }
            // adentro: los cruces de cada fila con el contorno, de izquierda a derecha
            for (int j = 0; j < H; j++)
            {
                float yc = j + 0.5f;
                cruces.Clear();
                for (int sgi = 0; sgi < ns; sgi++)
                {
                    float y0 = segmentos[sgi * 4 + 1], y1 = segmentos[sgi * 4 + 3];
                    if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc))
                    {
                        float x0 = segmentos[sgi * 4], x1 = segmentos[sgi * 4 + 2];
                        float x = x0 + (yc - y0) * (x1 - x0) / (y1 - y0);
                        cruces.Add((x, y1 > y0 ? 1 : -1));
                    }
                }
                if (cruces.Count == 0) { for (int i = 0; i < W; i++) campo[j * W + i] = -campo[j * W + i]; continue; }
                cruces.Sort((p, q) => p.x.CompareTo(q.x));
                int giro = 0, k = 0;
                for (int i = 0; i < W; i++)
                {
                    float xc = i + 0.5f;
                    while (k < cruces.Count && cruces[k].x <= xc) { giro += cruces[k].dir; k++; }
                    if (giro == 0) campo[j * W + i] = -campo[j * W + i];
                }
            }
        }
    }
}

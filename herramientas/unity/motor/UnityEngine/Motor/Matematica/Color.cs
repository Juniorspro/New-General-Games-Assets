using System;
using System.Globalization;
using System.Runtime.InteropServices;

namespace UnityEngine
{
    public partial struct Color : IEquatable<Color>, IFormattable
    {
        public float r;
        public float g;
        public float b;
        public float a;

        public Color(float r, float g, float b, float a) { this.r = r; this.g = g; this.b = b; this.a = a; }
        public Color(float r, float g, float b) { this.r = r; this.g = g; this.b = b; a = 1f; }

        public static Color red => new Color(1f, 0f, 0f, 1f);
        public static Color green => new Color(0f, 1f, 0f, 1f);
        public static Color blue => new Color(0f, 0f, 1f, 1f);
        public static Color white => new Color(1f, 1f, 1f, 1f);
        public static Color black => new Color(0f, 0f, 0f, 1f);
        public static Color yellow => new Color(1f, 0.921568632f, 0.0156862754f, 1f);
        public static Color cyan => new Color(0f, 1f, 1f, 1f);
        public static Color magenta => new Color(1f, 0f, 1f, 1f);
        public static Color gray => new Color(0.5f, 0.5f, 0.5f, 1f);
        public static Color grey => new Color(0.5f, 0.5f, 0.5f, 1f);
        public static Color clear => new Color(0f, 0f, 0f, 0f);

        public float grayscale => 0.299f * r + 0.587f * g + 0.114f * b;
        public float maxColorComponent => Mathf.Max(Mathf.Max(r, g), b);

        public Color linear => new Color(Mathf.GammaToLinearSpace(r), Mathf.GammaToLinearSpace(g), Mathf.GammaToLinearSpace(b), a);
        public Color gamma => new Color(Mathf.LinearToGammaSpace(r), Mathf.LinearToGammaSpace(g), Mathf.LinearToGammaSpace(b), a);

        public float this[int index]
        {
            get => index switch { 0 => r, 1 => g, 2 => b, 3 => a, _ => throw new IndexOutOfRangeException("Invalid Color index(" + index + ")!") };
            set
            {
                switch (index)
                {
                    case 0: r = value; break;
                    case 1: g = value; break;
                    case 2: b = value; break;
                    case 3: a = value; break;
                    default: throw new IndexOutOfRangeException("Invalid Color index(" + index + ")!");
                }
            }
        }

        public static Color operator +(Color a, Color b) => new Color(a.r + b.r, a.g + b.g, a.b + b.b, a.a + b.a);
        public static Color operator -(Color a, Color b) => new Color(a.r - b.r, a.g - b.g, a.b - b.b, a.a - b.a);
        public static Color operator *(Color a, Color b) => new Color(a.r * b.r, a.g * b.g, a.b * b.b, a.a * b.a);
        public static Color operator *(Color a, float b) => new Color(a.r * b, a.g * b, a.b * b, a.a * b);
        public static Color operator *(float b, Color a) => new Color(a.r * b, a.g * b, a.b * b, a.a * b);
        public static Color operator /(Color a, float b) => new Color(a.r / b, a.g / b, a.b / b, a.a / b);

        public static bool operator ==(Color lhs, Color rhs) => (Vector4)lhs == (Vector4)rhs;
        public static bool operator !=(Color lhs, Color rhs) => !(lhs == rhs);

        public static Color Lerp(Color a, Color b, float t)
        {
            t = Mathf.Clamp01(t);
            return new Color(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t, a.a + (b.a - a.a) * t);
        }

        public static Color LerpUnclamped(Color a, Color b, float t) =>
            new Color(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t, a.a + (b.a - a.a) * t);

        public static implicit operator Vector4(Color c) => new Vector4(c.r, c.g, c.b, c.a);
        public static implicit operator Color(Vector4 v) => new Color(v.x, v.y, v.z, v.w);

        public static void RGBToHSV(Color rgbColor, out float H, out float S, out float V)
        {
            if (rgbColor.b > rgbColor.g && rgbColor.b > rgbColor.r) RGBToHSVHelper(4f, rgbColor.b, rgbColor.r, rgbColor.g, out H, out S, out V);
            else if (rgbColor.g > rgbColor.r) RGBToHSVHelper(2f, rgbColor.g, rgbColor.b, rgbColor.r, out H, out S, out V);
            else RGBToHSVHelper(0f, rgbColor.r, rgbColor.g, rgbColor.b, out H, out S, out V);
        }

        static void RGBToHSVHelper(float offset, float dominantcolor, float colorone, float colortwo, out float H, out float S, out float V)
        {
            V = dominantcolor;
            if (V != 0f)
            {
                float small = colorone > colortwo ? colortwo : colorone;
                float diff = V - small;
                if (diff != 0f)
                {
                    S = diff / V;
                    H = offset + (colorone - colortwo) / diff;
                }
                else { S = 0f; H = offset + (colorone - colortwo); }
                H /= 6f;
                if (H < 0f) H += 1f;
            }
            else { S = 0f; H = 0f; }
        }

        public static Color HSVToRGB(float H, float S, float V) => HSVToRGB(H, S, V, true);

        public static Color HSVToRGB(float H, float S, float V, bool hdr)
        {
            Color retval = white;
            if (S == 0f) { retval.r = V; retval.g = V; retval.b = V; }
            else if (V == 0f) { retval.r = 0f; retval.g = 0f; retval.b = 0f; }
            else
            {
                float t_S, t_V, h_to_floor;
                t_S = S; t_V = V; h_to_floor = H * 6f;
                int temp = (int)Mathf.Floor(h_to_floor);
                float t = h_to_floor - temp;
                float var_1 = t_V * (1 - t_S), var_2 = t_V * (1 - t_S * t), var_3 = t_V * (1 - t_S * (1 - t));
                switch (temp)
                {
                    case 0: retval.r = t_V; retval.g = var_3; retval.b = var_1; break;
                    case 1: retval.r = var_2; retval.g = t_V; retval.b = var_1; break;
                    case 2: retval.r = var_1; retval.g = t_V; retval.b = var_3; break;
                    case 3: retval.r = var_1; retval.g = var_2; retval.b = t_V; break;
                    case 4: retval.r = var_3; retval.g = var_1; retval.b = t_V; break;
                    case 5: retval.r = t_V; retval.g = var_1; retval.b = var_2; break;
                    case 6: retval.r = t_V; retval.g = var_3; retval.b = var_1; break;
                    case -1: retval.r = t_V; retval.g = var_1; retval.b = var_2; break;
                }
                if (!hdr) { retval.r = Mathf.Clamp(retval.r, 0f, 1f); retval.g = Mathf.Clamp(retval.g, 0f, 1f); retval.b = Mathf.Clamp(retval.b, 0f, 1f); }
            }
            return retval;
        }

        public bool Equals(Color other) => r.Equals(other.r) && g.Equals(other.g) && b.Equals(other.b) && a.Equals(other.a);
        public override bool Equals(object other) => other is Color c && Equals(c);
        public override int GetHashCode() => ((Vector4)this).GetHashCode();

        public override string ToString() => string.Format(CultureInfo.InvariantCulture, "RGBA({0:F3}, {1:F3}, {2:F3}, {3:F3})", r, g, b, a);
        public string ToString(string format) => string.Format(CultureInfo.InvariantCulture, "RGBA({0}, {1}, {2}, {3})",
            r.ToString(format, CultureInfo.InvariantCulture), g.ToString(format, CultureInfo.InvariantCulture),
            b.ToString(format, CultureInfo.InvariantCulture), a.ToString(format, CultureInfo.InvariantCulture));
        public string ToString(string format, IFormatProvider formatProvider) => ToString(format);
    }

    [StructLayout(LayoutKind.Explicit)]
    public partial struct Color32 : IFormattable
    {
        [FieldOffset(0)] public int rgba;
        [FieldOffset(0)] public byte r;
        [FieldOffset(1)] public byte g;
        [FieldOffset(2)] public byte b;
        [FieldOffset(3)] public byte a;

        public Color32(byte r, byte g, byte b, byte a) { rgba = 0; this.r = r; this.g = g; this.b = b; this.a = a; }

        public static implicit operator Color32(Color c) => new Color32(
            (byte)Mathf.Round(Mathf.Clamp01(c.r) * 255f), (byte)Mathf.Round(Mathf.Clamp01(c.g) * 255f),
            (byte)Mathf.Round(Mathf.Clamp01(c.b) * 255f), (byte)Mathf.Round(Mathf.Clamp01(c.a) * 255f));

        public static implicit operator Color(Color32 c) => new Color(c.r / 255f, c.g / 255f, c.b / 255f, c.a / 255f);

        public static Color32 Lerp(Color32 a, Color32 b, float t)
        {
            t = Mathf.Clamp01(t);
            return new Color32((byte)(a.r + (b.r - a.r) * t), (byte)(a.g + (b.g - a.g) * t), (byte)(a.b + (b.b - a.b) * t), (byte)(a.a + (b.a - a.a) * t));
        }

        public override string ToString() => string.Format(CultureInfo.InvariantCulture, "RGBA({0}, {1}, {2}, {3})", r, g, b, a);
        public string ToString(string format, IFormatProvider formatProvider) => ToString();
    }
}

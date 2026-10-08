using System;
using System.Collections.Generic;
using System.Globalization;
using Porteo.UI;

namespace UnityEngine
{
    // El TextGenerator de Unity para UI.Text: arma los cuadrados de cada glifo en píxeles (tamaño ×
    // scaleFactor), relativos al pivote del rectángulo, con el texto enriquecido (<b>, <i>,
    // <size>, <color>), los saltos de línea por ancho, la alineación y el "best fit".
    public sealed partial class TextGenerator : IDisposable
    {
        readonly List<UIVertex> vertices = new List<UIVertex>();
        readonly List<UICharInfo> caracteres = new List<UICharInfo>();
        readonly List<UILineInfo> lineas = new List<UILineInfo>();
        Rect extension;
        int visibles, tamBestFit;
        string ultimoTexto;
        TextGenerationSettings ultimos;
        bool valido;

        public TextGenerator() { }
        public TextGenerator(int initialCapacity) { }
        public void Dispose() { }
        void IDisposable.Dispose() { }

        public void Invalidate() => valido = false;
        public IList<UIVertex> verts => vertices;
        public IList<UICharInfo> characters => caracteres;
        public IList<UILineInfo> lines => lineas;
        public Rect rectExtents => extension;
        public int vertexCount => vertices.Count;
        public int characterCount => caracteres.Count;
        public int characterCountVisible => visibles;
        public int lineCount => lineas.Count;
        public int fontSizeUsedForBestFit => tamBestFit;

        public UIVertex[] GetVerticesArray() => vertices.ToArray();
        public UICharInfo[] GetCharactersArray() => caracteres.ToArray();
        public UILineInfo[] GetLinesArray() => lineas.ToArray();
        public void GetVertices(List<UIVertex> vertices) { vertices.Clear(); vertices.AddRange(this.vertices); }
        public void GetCharacters(List<UICharInfo> characters) { characters.Clear(); characters.AddRange(caracteres); }
        public void GetLines(List<UILineInfo> lines) { lines.Clear(); lines.AddRange(lineas); }

        public bool Populate(string str, TextGenerationSettings settings) => PopulateWithErrors(str, settings, null);

        public bool PopulateWithErrors(string str, TextGenerationSettings settings, GameObject context)
        {
            str ??= "";
            if (valido && str == ultimoTexto && Iguales(settings, ultimos)) return true;
            ultimoTexto = str; ultimos = settings; valido = true;
            Armar(str, settings);
            return true;
        }

        public float GetPreferredWidth(string str, TextGenerationSettings settings)
        {
            settings.horizontalOverflow = HorizontalWrapMode.Overflow;
            settings.verticalOverflow = VerticalWrapMode.Overflow;
            settings.updateBounds = true;
            Populate(str, settings);
            return extension.width;
        }

        public float GetPreferredHeight(string str, TextGenerationSettings settings)
        {
            settings.verticalOverflow = VerticalWrapMode.Overflow;
            settings.updateBounds = true;
            Populate(str, settings);
            return extension.height;
        }

        static bool Iguales(in TextGenerationSettings a, in TextGenerationSettings b) =>
            a.font == b.font && a.color == b.color && a.fontSize == b.fontSize && a.lineSpacing == b.lineSpacing && a.richText == b.richText &&
            a.scaleFactor == b.scaleFactor && a.fontStyle == b.fontStyle && a.textAnchor == b.textAnchor && a.alignByGeometry == b.alignByGeometry &&
            a.resizeTextForBestFit == b.resizeTextForBestFit && a.resizeTextMinSize == b.resizeTextMinSize && a.resizeTextMaxSize == b.resizeTextMaxSize &&
            a.verticalOverflow == b.verticalOverflow && a.horizontalOverflow == b.horizontalOverflow && a.generationExtents == b.generationExtents &&
            a.pivot == b.pivot && a.generateOutOfBounds == b.generateOutOfBounds;

        // ── el texto enriquecido: cada carácter con su tamaño, estilo y color (las etiquetas no se ven) ──
        struct Car
        {
            public int Codigo, Indice;    // el carácter y su lugar en la cadena
            public int Tam, Estilo;       // tamaño en puntos (sin escala) y FontStyle
            public Color32 Color;
            public bool Etiqueta;
        }

        static readonly List<Car> cars = new List<Car>();

        static void Analizar(string s, in TextGenerationSettings st)
        {
            cars.Clear();
            var pilaTam = new List<int>(); var pilaColor = new List<Color32>();
            int negrita = 0, italica = 0;
            int tamBase = st.fontSize > 0 ? st.fontSize : (st.font != null ? st.font.tamBase : 14);
            Color32 colorBase = st.color;
            for (int i = 0; i < s.Length; i++)
            {
                char c = s[i];
                if (st.richText && c == '<')
                {
                    int fin = s.IndexOf('>', i + 1);
                    if (fin > i && Etiqueta(s.Substring(i + 1, fin - i - 1), ref negrita, ref italica, pilaTam, pilaColor))
                    {
                        for (int k = i; k <= fin; k++) cars.Add(new Car { Codigo = s[k], Indice = k, Etiqueta = true });
                        i = fin;
                        continue;
                    }
                }
                int codigo = c;
                if (char.IsHighSurrogate(c) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1])) codigo = char.ConvertToUtf32(c, s[i + 1]);
                int estilo = (int)st.fontStyle | (negrita > 0 ? 1 : 0) | (italica > 0 ? 2 : 0);
                cars.Add(new Car
                {
                    Codigo = codigo, Indice = i, Estilo = estilo,
                    Tam = pilaTam.Count > 0 ? pilaTam[pilaTam.Count - 1] : tamBase,
                    Color = pilaColor.Count > 0 ? Mezclar(pilaColor[pilaColor.Count - 1], colorBase) : colorBase,
                });
                if (codigo > 0xFFFF) { cars.Add(new Car { Codigo = s[i + 1], Indice = i + 1, Etiqueta = true }); i++; }
            }
        }

        // el color de una etiqueta con el alfa del texto (como Unity)
        static Color32 Mezclar(Color32 etiqueta, Color32 baseC) => new Color32(etiqueta.r, etiqueta.g, etiqueta.b, (byte)(etiqueta.a * baseC.a / 255));

        static bool Etiqueta(string t, ref int negrita, ref int italica, List<int> pilaTam, List<Color32> pilaColor)
        {
            switch (t)
            {
                case "b": negrita++; return true;
                case "/b": if (negrita > 0) negrita--; return true;
                case "i": italica++; return true;
                case "/i": if (italica > 0) italica--; return true;
                case "/size": if (pilaTam.Count > 0) pilaTam.RemoveAt(pilaTam.Count - 1); return true;
                case "/color": if (pilaColor.Count > 0) pilaColor.RemoveAt(pilaColor.Count - 1); return true;
                case "/material": return true;
            }
            if (t.StartsWith("size=", StringComparison.Ordinal))
            {
                if (!int.TryParse(t.Substring(5), NumberStyles.Integer, CultureInfo.InvariantCulture, out int n)) return false;
                pilaTam.Add(Math.Max(1, n));
                return true;
            }
            if (t.StartsWith("color=", StringComparison.Ordinal))
            {
                if (!ColorDe(t.Substring(6).Trim('"', '\''), out var col)) return false;
                pilaColor.Add(col);
                return true;
            }
            if (t.StartsWith("material=", StringComparison.Ordinal) || t.StartsWith("quad", StringComparison.Ordinal)) return true;
            return false;
        }

        static readonly Dictionary<string, Color32> nombres = new Dictionary<string, Color32>
        {
            ["aqua"] = new Color32(0, 255, 255, 255), ["black"] = new Color32(0, 0, 0, 255), ["blue"] = new Color32(0, 0, 255, 255),
            ["brown"] = new Color32(165, 42, 42, 255), ["cyan"] = new Color32(0, 255, 255, 255), ["darkblue"] = new Color32(0, 0, 160, 255),
            ["fuchsia"] = new Color32(255, 0, 255, 255), ["green"] = new Color32(0, 128, 0, 255), ["grey"] = new Color32(128, 128, 128, 255),
            ["lightblue"] = new Color32(173, 216, 230, 255), ["lime"] = new Color32(0, 255, 0, 255), ["magenta"] = new Color32(255, 0, 255, 255),
            ["maroon"] = new Color32(128, 0, 0, 255), ["navy"] = new Color32(0, 0, 128, 255), ["olive"] = new Color32(128, 128, 0, 255),
            ["orange"] = new Color32(255, 165, 0, 255), ["purple"] = new Color32(128, 0, 128, 255), ["red"] = new Color32(255, 0, 0, 255),
            ["silver"] = new Color32(192, 192, 192, 255), ["teal"] = new Color32(0, 128, 128, 255), ["white"] = new Color32(255, 255, 255, 255),
            ["yellow"] = new Color32(255, 255, 0, 255),
        };

        static bool ColorDe(string v, out Color32 c)
        {
            c = default;
            if (nombres.TryGetValue(v.ToLowerInvariant(), out c)) return true;
            if (!v.StartsWith("#")) return false;
            var h = v.Substring(1);
            if (h.Length != 6 && h.Length != 8) return false;
            if (!uint.TryParse(h, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out uint x)) return false;
            c = h.Length == 6 ? new Color32((byte)(x >> 16), (byte)(x >> 8), (byte)x, 255) : new Color32((byte)(x >> 24), (byte)(x >> 16), (byte)(x >> 8), (byte)x);
            return true;
        }

        // ── armado ──
        struct Linea
        {
            public int Desde, Hasta;          // en cars, [Desde, Hasta)
            public float Ancho, Ascenso, Alto;
        }

        static readonly List<Linea> partes = new List<Linea>();

        // las líneas a un tamaño (escala: puntos → píxeles); ancho máximo en píxeles (≤0: sin cortar)
        static void Partir(Font f, float escala, float anchoMax, float factorLinea)
        {
            partes.Clear();
            int ini = 0;
            float x = 0, asc = 0, alto = 0;
            int ultimoEspacio = -1;
            float xEspacio = 0;
            int previo = -1;
            for (int i = 0; i < cars.Count; i++)
            {
                var c = cars[i];
                if (c.Etiqueta) continue;
                int px = Px(c.Tam, escala);
                asc = Math.Max(asc, f.Ascenso(px));
                alto = Math.Max(alto, f.Interlineado(px) * factorLinea);
                if (c.Codigo == '\n')
                {
                    partes.Add(new Linea { Desde = ini, Hasta = i + 1, Ancho = x, Ascenso = asc, Alto = alto });
                    ini = i + 1; x = 0; asc = 0; alto = 0; ultimoEspacio = -1; previo = -1;
                    continue;
                }
                if (c.Codigo == '\r') continue;
                var g = f.Pedir(c.Codigo, px, c.Estilo & 3);
                float k = previo >= 0 ? f.Kerning(previo, c.Codigo, px) : 0;
                float nx = x + k + g.Avance;
                bool espacio = c.Codigo == ' ' || c.Codigo == '\t';
                if (anchoMax > 0 && nx > anchoMax + 0.01f && !espacio && i > ini)
                {
                    // corta en el último espacio de la línea; si no hay, antes de este carácter
                    int corte = ultimoEspacio >= ini ? ultimoEspacio + 1 : i;
                    float anchoLinea = ultimoEspacio >= ini ? xEspacio : x;
                    partes.Add(new Linea { Desde = ini, Hasta = corte, Ancho = anchoLinea, Ascenso = asc, Alto = alto });
                    ini = corte; ultimoEspacio = -1; previo = -1;
                    // lo que pasó a la línea nueva se vuelve a medir
                    x = 0;
                    asc = f.Ascenso(px); alto = f.Interlineado(px) * factorLinea;
                    for (int j = ini; j < i; j++)
                    {
                        var cj = cars[j];
                        if (cj.Etiqueta) continue;
                        int pj = Px(cj.Tam, escala);
                        x += f.Pedir(cj.Codigo, pj, cj.Estilo & 3).Avance + (previo >= 0 ? f.Kerning(previo, cj.Codigo, pj) : 0);
                        previo = cj.Codigo;
                    }
                    nx = x + g.Avance;
                }
                if (espacio) { ultimoEspacio = i; xEspacio = x; }
                x = nx;
                previo = c.Codigo;
            }
            if (alto <= 0)
            {
                int px = Px(cars.Count > 0 ? PrimerTam() : 14, escala);
                asc = f.Ascenso(px); alto = f.Interlineado(px) * factorLinea;
            }
            partes.Add(new Linea { Desde = ini, Hasta = cars.Count, Ancho = x, Ascenso = asc, Alto = alto });
        }

        static int PrimerTam() { foreach (var c in cars) if (!c.Etiqueta) return c.Tam; return 14; }
        static int Px(int tam, float escala) => Math.Max(1, (int)Math.Round(tam * escala));

        static float AltoTotal()
        {
            float h = 0;
            foreach (var l in partes) h += l.Alto;
            return h;
        }

        void Armar(string s, TextGenerationSettings st)
        {
            vertices.Clear(); caracteres.Clear(); lineas.Clear();
            visibles = 0; extension = default;
            var f = st.font;
            if (f == null || f.tabla == null) return;
            float escala = st.scaleFactor > 0 ? st.scaleFactor : 1;
            float W = st.generationExtents.x * escala, H = st.generationExtents.y * escala;
            float factorLinea = st.lineSpacing == 0 ? 1 : st.lineSpacing;
            bool cortar = st.horizontalOverflow == HorizontalWrapMode.Wrap && W > 0;
            bool truncar = st.verticalOverflow == VerticalWrapMode.Truncate;

            // best fit: el tamaño más grande (entre el mínimo y el máximo) con el que entra todo
            if (st.resizeTextForBestFit && st.font.dynamic)
            {
                int min = Math.Max(1, st.resizeTextMinSize), max = Math.Max(min, st.resizeTextMaxSize), mejor = min;
                int lo = min, hi = max;
                while (lo <= hi)
                {
                    int mid = (lo + hi) / 2;
                    var prueba = st; prueba.fontSize = mid; prueba.resizeTextForBestFit = false;
                    Analizar(s, prueba);
                    Partir(f, escala, cortar ? W : 0, factorLinea);
                    bool entra = AltoTotal() <= H + 0.5f;
                    if (entra && !cortar) foreach (var l in partes) if (l.Ancho > W + 0.5f) { entra = false; break; }
                    if (entra) { mejor = mid; lo = mid + 1; } else hi = mid - 1;
                }
                st.fontSize = mejor;
                tamBestFit = mejor;
            }
            else tamBestFit = st.fontSize;

            Analizar(s, st);
            Partir(f, escala, cortar ? W : 0, factorLinea);

            // el rectángulo con el pivote en el origen
            float xMin = -st.pivot.x * W, yMax = (1 - st.pivot.y) * H, yMin = yMax - H;
            int fila = (int)st.textAnchor / 3, col = (int)st.textAnchor % 3;
            // las líneas que no entran enteras se descartan (VerticalWrapMode.Truncate)
            int nLineas = partes.Count;
            if (truncar && H > 0)
            {
                float acum = 0;
                for (int i = 0; i < partes.Count; i++)
                {
                    acum += partes[i].Alto;
                    if (acum > H + 0.5f) { nLineas = i; break; }
                }
            }
            float altoTexto = 0;
            for (int i = 0; i < nLineas; i++) altoTexto += partes[i].Alto;
            float arriba = fila == 0 ? yMax : fila == 1 ? yMax - (H - altoTexto) * 0.5f : yMin + altoTexto;
            arriba = (float)Math.Round(arriba);

            float x0Ext = float.MaxValue, y0Ext = float.MaxValue, x1Ext = float.MinValue, y1Ext = float.MinValue;
            var tempQuad = new UIVertex[4];
            float lineaArriba = arriba;
            int indiceCadena = 0;
            for (int li = 0; li < partes.Count; li++)
            {
                var l = partes[li];
                bool visible = li < nLineas;
                float baseY = (float)Math.Round(lineaArriba - l.Ascenso);
                float x = col == 0 ? xMin : col == 1 ? xMin + (W - l.Ancho) * 0.5f : xMin + W - l.Ancho;
                x = (float)Math.Round(x);
                if (visible) lineas.Add(new UILineInfo { startCharIdx = l.Desde < cars.Count ? cars[l.Desde].Indice : s.Length, height = (int)Math.Round(l.Alto), topY = lineaArriba, leading = 0 });
                int previo = -1;
                for (int i = l.Desde; i < l.Hasta; i++)
                {
                    var c = cars[i];
                    indiceCadena = c.Indice;
                    if (c.Etiqueta || c.Codigo == '\n' || c.Codigo == '\r')
                    {
                        if (visible) caracteres.Add(new UICharInfo { cursorPos = new Vector2(x, lineaArriba), charWidth = 0 });
                        continue;
                    }
                    int px = Px(c.Tam, escala);
                    var g = f.Pedir(c.Codigo, px, c.Estilo & 3);
                    if (previo >= 0) x += f.Kerning(previo, c.Codigo, px);
                    if (visible) caracteres.Add(new UICharInfo { cursorPos = new Vector2(x, lineaArriba), charWidth = g.Avance });
                    if (visible && g.W > 0 && g.H > 0)
                    {
                        var ci = f.Info(g);
                        float gx0 = x + g.MinX, gx1 = x + g.MaxX, gy0 = baseY + g.MinY, gy1 = baseY + g.MaxY;
                        tempQuad[0] = Vertice(gx0, gy1, ci.uvTopLeft, c.Color);
                        tempQuad[1] = Vertice(gx1, gy1, ci.uvTopRight, c.Color);
                        tempQuad[2] = Vertice(gx1, gy0, ci.uvBottomRight, c.Color);
                        tempQuad[3] = Vertice(gx0, gy0, ci.uvBottomLeft, c.Color);
                        vertices.AddRange(tempQuad);
                        visibles++;
                        x0Ext = Math.Min(x0Ext, gx0); x1Ext = Math.Max(x1Ext, gx1);
                        y0Ext = Math.Min(y0Ext, gy0); y1Ext = Math.Max(y1Ext, gy1);
                    }
                    x += g.Avance;
                    previo = c.Codigo;
                }
                if (visible)
                {
                    float derecha = x;
                    x0Ext = Math.Min(x0Ext, col == 0 ? xMin : derecha - l.Ancho); x1Ext = Math.Max(x1Ext, derecha);
                    y0Ext = Math.Min(y0Ext, lineaArriba - l.Alto); y1Ext = Math.Max(y1Ext, lineaArriba);
                }
                lineaArriba -= l.Alto;
            }
            // el final del texto también tiene lugar (el cursor de un InputField va ahí)
            caracteres.Add(new UICharInfo { cursorPos = new Vector2(xMin, lineaArriba), charWidth = 0 });
            extension = x1Ext >= x0Ext ? Rect.MinMaxRect(x0Ext, y0Ext, x1Ext, y1Ext) : new Rect(xMin, yMax, 0, 0);
            f.Subir();
            f.AvisarSiCambio();
        }

        static UIVertex Vertice(float x, float y, Vector2 uv, Color32 c) => new UIVertex
        {
            position = new Vector3(x, y, 0), normal = Vector3.back, tangent = new Vector4(1, 0, 0, -1), color = c, uv0 = uv,
        };
    }
}

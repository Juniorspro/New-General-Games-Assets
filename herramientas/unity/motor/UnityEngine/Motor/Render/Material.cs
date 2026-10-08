using System;
using System.Collections.Generic;
using Porteo;
using UnityEngine;
using Object = UnityEngine.Object;
using Porteo.Datos;
using Porteo.Render;

namespace UnityEngine
{
    // Un material: el shader, sus propiedades (las del archivo, con los valores por defecto del
    // shader para las que falten) y sus palabras clave. Cada cambio sube la versión de la tabla.
    public partial class Material : Object
    {
        internal Shader sh;
        internal readonly Tabla props = new Tabla();
        internal readonly HashSet<string> claves = new HashSet<string>();
        internal int versionClaves = 1;
        internal int colaPropia = -1;
        internal Dictionary<string, string> tagsPropios;
        internal HashSet<string> pasadasApagadas;
        internal bool instanciable;

        public Material(Shader shader)
        {
            m_Name = "";
            this.shader = shader;
        }

        public Material(Material source)
        {
            if ((object)source == null) return;
            m_Name = source.m_Name;
            CopiarTodo(source);
        }

        internal override Object ClonarAsset() => new Material(this);

        void CopiarTodo(Material o)
        {
            sh = o.sh;
            props.CopiarDe(o.props);
            claves.Clear();
            foreach (var k in o.claves) claves.Add(k);
            versionClaves++;
            colaPropia = o.colaPropia;
            tagsPropios = o.tagsPropios == null ? null : new Dictionary<string, string>(o.tagsPropios);
            pasadasApagadas = o.pasadasApagadas == null ? null : new HashSet<string>(o.pasadasApagadas);
            instanciable = o.instanciable;
        }

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            sh = r.Resolver(m.P("m_Shader")) as Shader;
            var kw = m.S("m_ShaderKeywords");
            if (!string.IsNullOrEmpty(kw))
                foreach (var k in kw.Split(' ', StringSplitOptions.RemoveEmptyEntries)) claves.Add(k);
            colaPropia = m.I32("m_CustomRenderQueue", -1);
            instanciable = m.B("m_EnableInstancingVariants");
            var tags = m.L("stringTagMap");
            if (tags != null && tags.Count > 0)
            {
                tagsPropios = new Dictionary<string, string>();
                foreach (var x in tags) if (x is List<object> par && par.Count == 2 && par[0] is string k) tagsPropios[k] = par[1] as string ?? "";
            }
            var apagadas = m.L("disabledShaderPasses");
            if (apagadas != null && apagadas.Count > 0)
            {
                pasadasApagadas = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var x in apagadas) if (x is string s) pasadasApagadas.Add(s);
            }
            PonerDefectos();
            var sp = m.M("m_SavedProperties");
            if (sp != null)
            {
                var tex = sp.L("m_TexEnvs");
                if (tex != null)
                    foreach (var x in tex)
                    {
                        if (!(x is List<object> par) || par.Count != 2 || !(par[0] is string n) || !(par[1] is Mapa te)) continue;
                        int id = Ids.De(n);
                        var t = r.Resolver(te.P("m_Texture")) as Texture;
                        if ((object)t != null) props.PonerTextura(id, t);
                        else props.Quitar(id);
                        var esc = Serial.V2(te.M("m_Scale"));
                        var des = Serial.V2(te.M("m_Offset"));
                        props.Poner(Ids.De(n + "_ST"), Valor.Vec(new Vector4(esc.x, esc.y, des.x, des.y)));
                    }
                var fl = sp.L("m_Floats");
                if (fl != null)
                    foreach (var x in fl)
                        if (x is List<object> par && par.Count == 2 && par[0] is string n)
                            props.Poner(Ids.De(n), Valor.Numero(par[1] switch { float f => f, double d => (float)d, long l => l, _ => 0f }));
                var co = sp.L("m_Colors");
                if (co != null)
                    foreach (var x in co)
                        if (x is List<object> par && par.Count == 2 && par[0] is string n && par[1] is Mapa c)
                            props.Poner(Ids.De(n), Valor.Vec(Serial.Color(c)));
            }
        }

        // los valores por defecto del shader para todo lo que declara
        void PonerDefectos()
        {
            if ((object)sh == null) return;
            foreach (var p in sh.propiedades)
            {
                if (props.Tiene(p.Id)) continue;
                switch (p.Tipo)
                {
                    case 0: case 1: props.Poner(p.Id, Valor.Vec(p.Def)); break;
                    case 2: case 3: props.Poner(p.Id, Valor.Numero(p.Def.x)); break;
                    case 4:
                        int st = Ids.De(p.Nombre + "_ST");
                        if (!props.Tiene(st)) props.Poner(st, Valor.Vec(new Vector4(1, 1, 0, 0)));
                        break;
                }
            }
        }

        // ── shader y cola ──
        public Shader shader
        {
            get => sh;
            set
            {
                if ((object)value == null) return;
                sh = value;
                PonerDefectos();
                props.Version++;
            }
        }

        public int renderQueue
        {
            get => colaPropia >= 0 ? colaPropia : ((object)sh != null ? sh.Cola() : 2000);
            set => colaPropia = value;
        }

        internal int Cola => renderQueue;

        public int passCount => (object)sh != null ? sh.passCount : 0;

        public bool enableInstancing { get => instanciable; set => instanciable = value; }
        public MaterialGlobalIlluminationFlags globalIlluminationFlags { get; set; }

        public string GetTag(string tag, bool searchFallbacks) => GetTag(tag, searchFallbacks, "");

        public string GetTag(string tag, bool searchFallbacks, string defaultValue)
        {
            if (tagsPropios != null && tagsPropios.TryGetValue(tag, out var v)) return v;
            var ss = (object)sh != null ? sh.Activo() : null;
            if (ss != null && ss.Tags.TryGetValue(tag, out v)) return v;
            return defaultValue;
        }

        public void SetOverrideTag(string tag, string val)
        {
            tagsPropios ??= new Dictionary<string, string>();
            tagsPropios[tag] = val;
        }

        public void SetShaderPassEnabled(string passName, bool enabled)
        {
            pasadasApagadas ??= new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (enabled) pasadasApagadas.Remove(passName); else pasadasApagadas.Add(passName);
        }

        public bool GetShaderPassEnabled(string passName) => pasadasApagadas == null || !pasadasApagadas.Contains(passName);

        // ── palabras clave ──
        public void EnableKeyword(string keyword) { if (claves.Add(keyword)) versionClaves++; }
        public void DisableKeyword(string keyword) { if (claves.Remove(keyword)) versionClaves++; }
        public bool IsKeywordEnabled(string keyword) => claves.Contains(keyword);

        public string[] shaderKeywords
        {
            get { var a = new string[claves.Count]; claves.CopyTo(a); return a; }
            set { claves.Clear(); if (value != null) foreach (var k in value) if (!string.IsNullOrEmpty(k)) claves.Add(k); versionClaves++; }
        }

        // ── propiedades ──
        static readonly int ID_COLOR = Ids.De("_Color"), ID_MAINTEX = Ids.De("_MainTex");

        public Color color { get => GetColor(ID_COLOR); set => SetColor(ID_COLOR, value); }
        public Texture mainTexture { get => GetTexture(ID_MAINTEX); set => SetTexture(ID_MAINTEX, value); }
        public Vector2 mainTextureOffset { get => GetTextureOffset("_MainTex"); set => SetTextureOffset("_MainTex", value); }
        public Vector2 mainTextureScale { get => GetTextureScale("_MainTex"); set => SetTextureScale("_MainTex", value); }

        public bool HasProperty(string name) => HasProperty(Ids.De(name));

        public bool HasProperty(int nameID)
        {
            if ((object)sh != null && sh.Propiedad(nameID) != null) return true;
            return props.Tiene(nameID);
        }

        public void SetFloat(string name, float value) => SetFloat(Ids.De(name), value);
        public void SetFloat(int nameID, float value) => props.Poner(nameID, Valor.Numero(value));
        public void SetInt(string name, int value) => SetFloat(Ids.De(name), value);
        public void SetInt(int nameID, int value) => SetFloat(nameID, value);
        public void SetColor(string name, Color value) => SetColor(Ids.De(name), value);
        public void SetColor(int nameID, Color value) => props.Poner(nameID, Valor.Vec(value));
        public void SetVector(string name, Vector4 value) => SetVector(Ids.De(name), value);
        public void SetVector(int nameID, Vector4 value) => props.Poner(nameID, Valor.Vec(value));
        public void SetMatrix(string name, Matrix4x4 value) => SetMatrix(Ids.De(name), value);
        public void SetMatrix(int nameID, Matrix4x4 value) => props.Poner(nameID, Valor.Matriz(value));
        public void SetTexture(string name, Texture value) => SetTexture(Ids.De(name), value);

        public void SetTexture(int nameID, Texture value)
        {
            if ((object)value == null) { props.Quitar(nameID); return; }
            props.PonerTextura(nameID, value);
            int st = Ids.De(Ids.Nombre(nameID) + "_ST");
            if (!props.Tiene(st)) props.Poner(st, Valor.Vec(new Vector4(1, 1, 0, 0)));
        }

        public void SetFloatArray(string name, float[] values) => props.Poner(Ids.De(name), Valor.Numeros(values));
        public void SetFloatArray(int nameID, float[] values) => props.Poner(nameID, Valor.Numeros(values));
        public void SetVectorArray(string name, Vector4[] values) => props.Poner(Ids.De(name), Valor.Vectores(values));
        public void SetVectorArray(int nameID, Vector4[] values) => props.Poner(nameID, Valor.Vectores(values));
        public void SetBuffer(string name, ComputeBuffer value) { }

        public float GetFloat(string name) => GetFloat(Ids.De(name));
        public float GetFloat(int nameID) => props.Leer(nameID, out var v) ? v.V.x : 0f;
        public int GetInt(string name) => (int)GetFloat(name);
        public int GetInt(int nameID) => (int)GetFloat(nameID);
        public Color GetColor(string name) => GetColor(Ids.De(name));
        public Color GetColor(int nameID) => props.Leer(nameID, out var v) ? (Color)v.V : default;
        public Vector4 GetVector(string name) => GetVector(Ids.De(name));
        public Vector4 GetVector(int nameID) => props.Leer(nameID, out var v) ? v.V : default;
        public Texture GetTexture(string name) => GetTexture(Ids.De(name));
        public Texture GetTexture(int nameID) => props.Leer(nameID, out var v) ? v.O as Texture : null;

        public Matrix4x4 GetMatrix(string name)
        {
            if (!props.Leer(Ids.De(name), out var v) || !(v.O is float[] a) || a.Length < 16) return Matrix4x4.identity;
            var m = new Matrix4x4();
            for (int i = 0; i < 16; i++) m[i] = a[i];
            return m;
        }

        public void SetTextureOffset(string name, Vector2 value)
        {
            int st = Ids.De(name + "_ST");
            var v = props.Leer(st, out var x) ? x.V : new Vector4(1, 1, 0, 0);
            props.Poner(st, Valor.Vec(new Vector4(v.x, v.y, value.x, value.y)));
        }

        public void SetTextureScale(string name, Vector2 value)
        {
            int st = Ids.De(name + "_ST");
            var v = props.Leer(st, out var x) ? x.V : new Vector4(1, 1, 0, 0);
            props.Poner(st, Valor.Vec(new Vector4(value.x, value.y, v.z, v.w)));
        }

        public Vector2 GetTextureOffset(string name) { var v = props[Ids.De(name + "_ST")]; return v.Hay ? new Vector2(v.V.z, v.V.w) : Vector2.zero; }
        public Vector2 GetTextureScale(string name) { var v = props[Ids.De(name + "_ST")]; return v.Hay ? new Vector2(v.V.x, v.V.y) : Vector2.one; }

        public void CopyPropertiesFromMaterial(Material mat)
        {
            if ((object)mat == null) return;
            props.CopiarDe(mat.props);
            claves.Clear();
            foreach (var k in mat.claves) claves.Add(k);
            versionClaves++;
        }

        public void Lerp(Material start, Material end, float t)
        {
            foreach (var kv in start.props.Todos)
            {
                if (!end.props.Leer(kv.Key, out var b)) continue;
                var a = kv.Value;
                if (a.Tipo == TipoValor.Numero && b.Tipo == TipoValor.Numero) props.Poner(kv.Key, Valor.Numero(a.V.x + (b.V.x - a.V.x) * t));
                else if (a.Tipo == TipoValor.Vector && b.Tipo == TipoValor.Vector) props.Poner(kv.Key, Valor.Vec(Vector4.Lerp(a.V, b.V, t)));
            }
        }

        // GL inmediato y Graphics.Blit: deja lista la pasada para dibujar
        public bool SetPass(int pass) => Porteo.Render.Dibujo.ActivarPasada(this, pass);

        public int FindPass(string passName)
        {
            var ss = (object)sh != null ? sh.Activo() : null;
            if (ss == null) return -1;
            for (int i = 0; i < ss.Pasadas.Length; i++) if (string.Equals(ss.Pasadas[i].Nombre, passName, StringComparison.OrdinalIgnoreCase)) return i;
            return -1;
        }
    }

    public enum MaterialGlobalIlluminationFlags { None = 0, RealtimeEmissive = 1, BakedEmissive = 2, EmissiveIsBlack = 4, AnyEmissive = 3 }

    public sealed partial class MaterialPropertyBlock
    {
        internal readonly Tabla t = new Tabla();

        public MaterialPropertyBlock() { }

        public bool isEmpty => t.Cantidad == 0;
        public void Clear() => t.Limpiar();
        public void SetFloat(string name, float value) => t.Poner(Ids.De(name), Valor.Numero(value));
        public void SetFloat(int nameID, float value) => t.Poner(nameID, Valor.Numero(value));
        public void SetInt(string name, int value) => t.Poner(Ids.De(name), Valor.Numero(value));
        public void SetColor(string name, Color value) => t.Poner(Ids.De(name), Valor.Vec(value));
        public void SetColor(int nameID, Color value) => t.Poner(nameID, Valor.Vec(value));
        public void SetVector(string name, Vector4 value) => t.Poner(Ids.De(name), Valor.Vec(value));
        public void SetVector(int nameID, Vector4 value) => t.Poner(nameID, Valor.Vec(value));
        public void SetMatrix(string name, Matrix4x4 value) => t.Poner(Ids.De(name), Valor.Matriz(value));
        public void SetTexture(string name, Texture value) => t.PonerTextura(Ids.De(name), value);
        public void SetTexture(int nameID, Texture value) => t.PonerTextura(nameID, value);
        public void SetFloatArray(string name, float[] values) => t.Poner(Ids.De(name), Valor.Numeros(values));
        public void SetVectorArray(string name, Vector4[] values) => t.Poner(Ids.De(name), Valor.Vectores(values));
        public float GetFloat(string name) => t[Ids.De(name)].V.x;
        public float GetFloat(int nameID) => t[nameID].V.x;
        public Color GetColor(string name) => t[Ids.De(name)].V;
        public Vector4 GetVector(string name) => t[Ids.De(name)].V;
        public Texture GetTexture(string name) => t[Ids.De(name)].O as Texture;

        internal void CopiarDe(MaterialPropertyBlock o) => t.CopiarDe(o.t);
    }
}

using System;
using System.Collections.Generic;
using System.Reflection;
using Porteo;
using Porteo.Datos;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Porteo.Animacion
{
    internal enum TipoValor : byte { Posicion, Rotacion, Escala, Activo, Habilitado, Material, Campo, Propiedad, PPtr, Musculo, Nada }

    // Una propiedad animada de un objeto (lo que Unity llama un "bound value"): dónde está su
    // valor en el arreglo del reproductor, cómo leerla y cómo escribirla.
    internal sealed class Valor
    {
        public TipoValor Tipo;
        public int Off, Tam = 1;
        public Transform T;
        public GameObject G;
        public Component C;
        public Renderer R;
        public int IdProp, Comp;         // material: id de la propiedad y componente (0-3 rgba, 4-7 xyzw, 8 float)
        public FieldInfo F;              // campo de script
        public int SubCampo = -1;        // componente de un Vector/Color dentro del campo
        public PropertyInfo P;           // propiedad de un componente del motor
        public Object ObjetoDefecto;     // PPtr
        public Object ObjetoActual;      // el que tiene puesto
        public Object ObjetoActual2;     // el que eligió la mezcla de este cuadro
        public int Musculo;              // humanoides: el atributo del enlace (RootT, RootQ, metas, músculos)

        public void Leer(float[] v, int o)
        {
            switch (Tipo)
            {
                case TipoValor.Posicion: { var p = T.posLocal; v[o] = p.x; v[o + 1] = p.y; v[o + 2] = p.z; break; }
                case TipoValor.Rotacion: { var q = T.rotLocal; v[o] = q.x; v[o + 1] = q.y; v[o + 2] = q.z; v[o + 3] = q.w; break; }
                case TipoValor.Escala: { var s = T.escLocal; v[o] = s.x; v[o + 1] = s.y; v[o + 2] = s.z; break; }
                case TipoValor.Activo: v[o] = G.activeSelf ? 1 : 0; break;
                case TipoValor.Habilitado: v[o] = C is Behaviour b ? (b.enabled ? 1 : 0) : C is Renderer rr ? (rr.enabled ? 1 : 0) : C is Collider cc ? (cc.enabled ? 1 : 0) : 1; break;
                case TipoValor.Material: v[o] = LeerMaterial(); break;
                case TipoValor.Campo: v[o] = LeerCampo(); break;
                case TipoValor.Propiedad: v[o] = LeerPropiedad(); break;
                case TipoValor.Musculo: v[o] = PoseHumana.Defecto(Musculo); break;
                default: v[o] = 0; break;
            }
        }

        public void Escribir(float[] v, int o)
        {
            switch (Tipo)
            {
                case TipoValor.Activo:
                {
                    bool a = v[o] > 0.5f;
                    if (G != null && !G.destruido && G.activeSelf != a) G.SetActive(a);
                    break;
                }
                case TipoValor.Habilitado:
                {
                    bool a = v[o] > 0.5f;
                    if (C is Behaviour b) { if (b.enabled != a) b.enabled = a; }
                    else if (C is Renderer rr) { if (rr.enabled != a) rr.enabled = a; }
                    else if (C is Collider cc) { if (cc.enabled != a) cc.enabled = a; }
                    break;
                }
                case TipoValor.Material: EscribirMaterial(v[o]); break;
                case TipoValor.Campo: EscribirCampo(v[o]); break;
                case TipoValor.Propiedad: EscribirPropiedad(v[o]); break;
            }
        }

        // ── materiales: en el bloque de propiedades del renderer, como hace Unity ──
        float LeerMaterial()
        {
            if (R == null || R.destruido) return 0;
            Porteo.Render.Valor x;
            if (R.bloque != null && R.bloque.t.Leer(IdProp, out x)) return Componente(x.V);
            var m = R.sharedMaterial;
            if (m != null && m.props.Leer(IdProp, out x)) return Componente(x.V);
            var pr = m?.sh?.Propiedad(IdProp);
            return pr != null ? Componente(pr.Def) : 0;
        }

        float Componente(Vector4 v) => Comp == 8 ? v.x : v[Comp & 3];

        void EscribirMaterial(float f)
        {
            if (R == null || R.destruido) return;
            R.bloque ??= new MaterialPropertyBlock();
            var t = R.bloque.t;
            if (Comp == 8)
            {
                if (t.Leer(IdProp, out var y) && y.V.x == f && y.Tipo == Porteo.Render.TipoValor.Numero) return;
                t.Poner(IdProp, Porteo.Render.Valor.Numero(f));
                return;
            }
            Vector4 v;
            if (t.Leer(IdProp, out var x)) v = x.V;
            else
            {
                var m = R.sharedMaterial;
                if (m != null && m.props.Leer(IdProp, out var mx)) v = mx.V;
                else v = m?.sh?.Propiedad(IdProp)?.Def ?? Vector4.zero;
            }
            if (v[Comp & 3] == f && t.Tiene(IdProp)) return;
            v[Comp & 3] = f;
            t.Poner(IdProp, Porteo.Render.Valor.Vec(v));
        }

        // ── campos de scripts ──
        float LeerCampo()
        {
            if (C == null || F == null) return 0;
            var o = F.GetValue(C);
            return AFlotante(o, SubCampo);
        }

        void EscribirCampo(float f)
        {
            if (C == null || C.destruido || F == null) return;
            var t = F.FieldType;
            if (SubCampo < 0)
            {
                object nuevo = t == typeof(float) ? f : t == typeof(int) ? (int)Math.Round(f) : t == typeof(bool) ? f > 0.5f : t == typeof(double) ? (double)f : (object)null;
                if (nuevo == null) return;
                if (Equals(F.GetValue(C), nuevo)) return;
                F.SetValue(C, nuevo);
                return;
            }
            var o = F.GetValue(C);
            switch (o)
            {
                case Vector2 v2: if (v2[SubCampo] == f) return; v2[SubCampo] = f; F.SetValue(C, v2); break;
                case Vector3 v3: if (v3[SubCampo] == f) return; v3[SubCampo] = f; F.SetValue(C, v3); break;
                case Vector4 v4: if (v4[SubCampo] == f) return; v4[SubCampo] = f; F.SetValue(C, v4); break;
                case Color c: if (c[SubCampo] == f) return; c[SubCampo] = f; F.SetValue(C, c); break;
                case Quaternion q: if (q[SubCampo] == f) return; q[SubCampo] = f; F.SetValue(C, q); break;
            }
            // los Graphic de la UI (del juego: UnityEngine.UI.dll) tienen que enterarse del color nuevo
            Avisar(C);
        }

        static readonly Dictionary<Type, MethodInfo> sucios = new Dictionary<Type, MethodInfo>();

        static void Avisar(Component c)
        {
            var t = c.GetType();
            if (!sucios.TryGetValue(t, out var m))
                sucios[t] = m = t.GetMethod("SetVerticesDirty", BindingFlags.Instance | BindingFlags.Public, null, Type.EmptyTypes, null);
            if (m != null) Mensajes.Llamar(c, m);
        }

        static float AFlotante(object o, int sub) => o switch
        {
            float f => f,
            int i => i,
            bool b => b ? 1 : 0,
            double d => (float)d,
            Vector2 v when sub >= 0 => v[sub],
            Vector3 v when sub >= 0 => v[sub],
            Vector4 v when sub >= 0 => v[sub],
            Color c when sub >= 0 => c[sub],
            Quaternion q when sub >= 0 => q[sub],
            _ => 0,
        };

        // ── propiedades de componentes del motor (Projector.orthographicSize, Light.intensity...) ──
        float LeerPropiedad()
        {
            if (C == null || P == null) return 0;
            try { return AFlotante(P.GetValue(C), SubCampo); } catch { return 0; }
        }

        void EscribirPropiedad(float f)
        {
            if (C == null || C.destruido || P == null || !P.CanWrite) return;
            try
            {
                var t = P.PropertyType;
                if (SubCampo < 0)
                {
                    object nuevo = t == typeof(float) ? f : t == typeof(int) ? (int)Math.Round(f) : t == typeof(bool) ? f > 0.5f : (object)null;
                    if (nuevo != null && !Equals(P.GetValue(C), nuevo)) P.SetValue(C, nuevo);
                    return;
                }
                var o = P.GetValue(C);
                switch (o)
                {
                    case Vector2 v2: if (v2[SubCampo] != f) { v2[SubCampo] = f; P.SetValue(C, v2); } break;
                    case Vector3 v3: if (v3[SubCampo] != f) { v3[SubCampo] = f; P.SetValue(C, v3); } break;
                    case Vector4 v4: if (v4[SubCampo] != f) { v4[SubCampo] = f; P.SetValue(C, v4); } break;
                    case Color c: if (c[SubCampo] != f) { c[SubCampo] = f; P.SetValue(C, c); } break;
                }
            }
            catch (Exception e) { Debug.LogException(e); }
        }

        public void EscribirObjeto(Object o)
        {
            if (ReferenceEquals(ObjetoActual, o)) return;
            ObjetoActual = o;
            if (R != null && !R.destruido && Comp >= 0)
            {
                var mats = R.sharedMaterials;
                if (Comp < mats.Length && o is Material m) { mats[Comp] = m; R.sharedMaterials = mats; }
            }
            else if (C is SpriteRenderer sr && o is Sprite s) sr.sprite = s;
            else if (C != null && o is Sprite s2) C.GetType().GetProperty("sprite")?.SetValue(C, s2);
        }
    }

    // Arma los valores de un objeto animado a partir de los enlaces de sus clips: la tabla de
    // caminos (CRC-32 del camino de cada Transform debajo del animador) y la de propiedades.
    internal sealed class Enlazador
    {
        readonly Transform raiz;
        readonly Dictionary<uint, Transform> caminos = new Dictionary<uint, Transform>();
        internal readonly List<Valor> valores = new List<Valor>();
        readonly Dictionary<(Transform, int), Valor> porTransform = new Dictionary<(Transform, int), Valor>();
        readonly Dictionary<(Object, uint, int), Valor> porAtributo = new Dictionary<(Object, uint, int), Valor>();
        internal int tam;
        internal bool humano;            // el Animator tiene un avatar humanoide: los músculos se enlazan
        static readonly HashSet<string> avisados = new HashSet<string>();

        internal Enlazador(Transform raiz)
        {
            this.raiz = raiz;
            Recorrer(raiz, "");
        }

        void Recorrer(Transform t, string camino)
        {
            uint h = Crc.De(camino);
            if (!caminos.ContainsKey(h)) caminos[h] = t;
            for (int i = 0; i < t.hijos.Count; i++)
            {
                var hj = t.hijos[i];
                Recorrer(hj, camino.Length == 0 ? hj.name : camino + "/" + hj.name);
            }
        }

        internal Transform Camino(uint h) => caminos.TryGetValue(h, out var t) ? t : null;

        Valor Nuevo(TipoValor tipo, int tam)
        {
            var v = new Valor { Tipo = tipo, Off = this.tam, Tam = tam };
            this.tam += tam;
            valores.Add(v);
            return v;
        }

        // el valor al que apunta un enlace (null si no hay nada que animar ahí)
        internal Valor Enlazar(Enlace e, AnimationClip clip)
        {
            var t = Camino(e.Ruta);
            if (t == null) return null;
            if (e.Clase == 4 && e.Especial == 0)
            {
                int tipo = e.Atributo == 1 ? 0 : e.Atributo == 3 ? 2 : 1;   // la rotación en euler va al mismo valor que la de cuaterniones
                if (porTransform.TryGetValue((t, tipo), out var v)) return v;
                v = Nuevo(tipo == 0 ? TipoValor.Posicion : tipo == 1 ? TipoValor.Rotacion : TipoValor.Escala, tipo == 1 ? 4 : 3);
                v.T = t;
                porTransform[(t, tipo)] = v;
                return v;
            }
            var go = t.gameObject;
            if (e.Clase == 1)
            {
                if (e.Atributo != ATR_ACTIVO) return Avisar(e, "GameObject");
                return Cache(go, e.Atributo, 0, () => { var v = Nuevo(TipoValor.Activo, 1); v.G = go; return v; });
            }
            // músculos, metas y cuerpo de un humanoide: los junta el reproductor y los aplica PoseHumana
            if (e.Especial == 8)
            {
                if (!humano || t != raiz || e.Atributo >= PoseHumana.TOTAL) return null;
                int atr = (int)e.Atributo;
                return Cache(raiz, e.Atributo, 2000, () => { var v = Nuevo(TipoValor.Musculo, 1); v.Musculo = atr; return v; });
            }
            if (e.Especial == 22 || (e.Especial == 21 && !e.EsPPtr))
            {
                var r = Componente(go, e.Clase) as Renderer;
                if (r == null) return null;
                if (!BuscarPropiedadMaterial(r, e.Atributo & 0x0FFFFFFF, out int id)) return Avisar(e, "material de " + r.name);
                int comp = (int)(e.Atributo >> 28);
                return Cache(r, (uint)id, comp, () => { var v = Nuevo(TipoValor.Material, 1); v.R = r; v.IdProp = id; v.Comp = comp; return v; });
            }
            if (e.EsPPtr)
            {
                var c = Componente(go, e.Clase);
                if (c == null) return null;
                return Cache(c, e.Atributo, 1000, () =>
                {
                    var v = Nuevo(TipoValor.PPtr, 1);
                    v.C = c;
                    v.Comp = -1;
                    if (c is Renderer r && e.Especial == 21)
                    {
                        // m_Materials.Array.data[i]: el atributo es el índice del material
                        v.R = r; v.Comp = (int)e.Atributo;
                        var ms = r.sharedMaterials;
                        v.ObjetoDefecto = v.Comp < ms.Length ? ms[v.Comp] : null;
                    }
                    else if (c is SpriteRenderer sr) v.ObjetoDefecto = sr.sprite;
                    v.ObjetoActual = v.ObjetoDefecto;
                    return v;
                });
            }
            if (e.Clase == 114)
            {
                var mb = Script(go, e.Script);
                if (mb == null) return null;
                if (e.Atributo == ATR_HABILITADO)
                    return Cache(mb, e.Atributo, 0, () => { var v = Nuevo(TipoValor.Habilitado, 1); v.C = mb; return v; });
                if (!CampoScript(mb.GetType(), e, out var f, out int sub)) return Avisar(e, mb.GetType().Name);
                return Cache(mb, e.Atributo, 0, () => { var v = Nuevo(TipoValor.Campo, 1); v.C = mb; v.F = f; v.SubCampo = sub; return v; });
            }
            var comp2 = Componente(go, e.Clase);
            if (comp2 == null) return null;
            if (e.Atributo == ATR_HABILITADO)
                return Cache(comp2, e.Atributo, 0, () => { var v = Nuevo(TipoValor.Habilitado, 1); v.C = comp2; return v; });
            if (comp2 is RectTransform rt && e.Especial == 28)
                return Cache(rt, e.Atributo, 0, () => PropiedadRect(rt, e.Atributo) ?? NadaValor());
            if (Propiedades.TryGetValue((e.Clase, e.Atributo), out var pp))
            {
                var pi = comp2.GetType().GetProperty(pp.prop, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
                if (pi != null) return Cache(comp2, e.Atributo, 0, () => { var v = Nuevo(TipoValor.Propiedad, 1); v.C = comp2; v.P = pi; v.SubCampo = pp.sub; return v; });
            }
            return Avisar(e, comp2.GetType().Name);
        }

        Valor NadaValor() => Nuevo(TipoValor.Nada, 1);

        Valor Cache(Object o, uint atr, int comp, Func<Valor> crear)
        {
            if (porAtributo.TryGetValue((o, atr, comp), out var v)) return v;
            v = crear();
            porAtributo[(o, atr, comp)] = v;
            return v;
        }

        Valor Avisar(in Enlace e, string donde)
        {
            if (avisados.Add($"{e.Clase}:{e.Especial}:{e.Atributo}:{donde}"))
                Debug.LogWarning($"porteo: animación sin enlazar (clase {e.Clase}, tipo {e.Especial}, atributo {e.Atributo}{(e.Nombre != null ? " " + e.Nombre : "")}) en {donde}");
            return null;
        }

        static readonly uint ATR_ACTIVO = Crc.De("m_IsActive"), ATR_HABILITADO = Crc.De("m_Enabled");

        // el componente del objeto con ese classID de Unity
        static Component Componente(GameObject go, int clase)
        {
            var cs = go.componentes;
            for (int i = 0; i < cs.Count; i++)
            {
                var c = cs[i];
                if (c == null || c.destruido) continue;
                if (ClaseDe(c) == clase) return c;
            }
            // un Renderer genérico (clase 25) vale para cualquiera
            if (clase == 25) foreach (var c in cs) if (c is Renderer) return c;
            return null;
        }

        static int ClaseDe(Component c) => c switch
        {
            RectTransform _ => 224,
            Transform _ => 4,
            SkinnedMeshRenderer _ => 137,
            MeshRenderer _ => 23,
            SpriteRenderer _ => 212,
            Light _ => 108,
            Camera _ => 20,
            Projector _ => 119,
            AudioSource _ => 82,
            ParticleSystem _ => 198,
            ParticleSystemRenderer _ => 199,
            BoxCollider _ => 65,
            SphereCollider _ => 135,
            CapsuleCollider _ => 136,
            MeshCollider _ => 64,
            Rigidbody _ => 54,
            Animator _ => 95,
            Animation _ => 111,
            Canvas _ => 223,
            CanvasGroup _ => 225,
            MonoBehaviour _ => 114,
            _ => -1,
        };

        static MonoBehaviour Script(GameObject go, Object script)
        {
            string nombre = script?.m_Name;
            foreach (var c in go.componentes)
            {
                if (!(c is MonoBehaviour mb) || mb.destruido) continue;
                if (nombre == null) return mb;
                for (var t = mb.GetType(); t != null && t != typeof(MonoBehaviour); t = t.BaseType)
                    if (t.Name == nombre) return mb;
            }
            return null;
        }

        // Los campos de scripts: Unity los guarda con un hash que no es el CRC-32 del nombre (el
        // de los demás atributos sí). Se reconocen por los que usa el juego y, si no, por el tipo:
        // un único campo float en el script.
        static readonly Dictionary<uint, string> camposConocidos = new Dictionary<uint, string>
        {
            [1703785562] = "m_Color.a", [3087801864] = "m_Color.r", [1474830669] = "m_Color.g", [2124457002] = "m_Color.b",
            [3712565611] = "speed",
        };

        static bool CampoScript(Type t, in Enlace e, out FieldInfo f, out int sub)
        {
            f = null; sub = -1;
            string nombre = e.Nombre;
            if (nombre == null) camposConocidos.TryGetValue(e.Atributo, out nombre);
            if (nombre == null)
            {
                foreach (var c in CamposAnimables(t)) if (Crc.De(c.ruta) == e.Atributo) { nombre = c.ruta; break; }
            }
            if (nombre == null)
            {
                FieldInfo unico = null; int n = 0;
                foreach (var c in CamposAnimables(t)) if (c.sub < 0 && c.f.FieldType == typeof(float)) { unico = c.f; n++; }
                if (n == 1) { f = unico; return true; }
                return false;
            }
            foreach (var c in CamposAnimables(t)) if (c.ruta == nombre) { f = c.f; sub = c.sub; return true; }
            return false;
        }

        static readonly Dictionary<Type, List<(string ruta, FieldInfo f, int sub)>> cacheCampos = new Dictionary<Type, List<(string, FieldInfo, int)>>();

        static List<(string ruta, FieldInfo f, int sub)> CamposAnimables(Type t)
        {
            if (cacheCampos.TryGetValue(t, out var l)) return l;
            l = new List<(string, FieldInfo, int)>();
            for (var b = t; b != null && b != typeof(MonoBehaviour) && b != typeof(Behaviour); b = b.BaseType)
                foreach (var f in b.GetFields(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly))
                {
                    if (!f.IsPublic && !f.IsDefined(typeof(SerializeField), false)) continue;
                    var ft = f.FieldType;
                    if (ft == typeof(float) || ft == typeof(int) || ft == typeof(bool)) l.Add((f.Name, f, -1));
                    else if (ft == typeof(Vector2)) { l.Add((f.Name + ".x", f, 0)); l.Add((f.Name + ".y", f, 1)); }
                    else if (ft == typeof(Vector3)) { l.Add((f.Name + ".x", f, 0)); l.Add((f.Name + ".y", f, 1)); l.Add((f.Name + ".z", f, 2)); }
                    else if (ft == typeof(Vector4) || ft == typeof(Quaternion)) { l.Add((f.Name + ".x", f, 0)); l.Add((f.Name + ".y", f, 1)); l.Add((f.Name + ".z", f, 2)); l.Add((f.Name + ".w", f, 3)); }
                    else if (ft == typeof(Color)) { l.Add((f.Name + ".r", f, 0)); l.Add((f.Name + ".g", f, 1)); l.Add((f.Name + ".b", f, 2)); l.Add((f.Name + ".a", f, 3)); }
                }
            cacheCampos[t] = l;
            return l;
        }

        // ── RectTransform ──
        Valor PropiedadRect(RectTransform rt, uint atr)
        {
            if (!camposRect.TryGetValue(atr, out var x)) return null;
            var v = Nuevo(TipoValor.Propiedad, 1);
            v.C = rt;
            v.P = typeof(RectTransform).GetProperty(x.prop);
            v.SubCampo = x.sub;
            return v;
        }

        static readonly Dictionary<uint, (string prop, int sub)> camposRect = Tabla(
            ("m_AnchoredPosition.x", "anchoredPosition", 0), ("m_AnchoredPosition.y", "anchoredPosition", 1),
            ("m_SizeDelta.x", "sizeDelta", 0), ("m_SizeDelta.y", "sizeDelta", 1),
            ("m_AnchorMin.x", "anchorMin", 0), ("m_AnchorMin.y", "anchorMin", 1),
            ("m_AnchorMax.x", "anchorMax", 0), ("m_AnchorMax.y", "anchorMax", 1),
            ("m_Pivot.x", "pivot", 0), ("m_Pivot.y", "pivot", 1));

        static Dictionary<uint, (string, int)> Tabla(params (string nombre, string prop, int sub)[] l)
        {
            var d = new Dictionary<uint, (string, int)>();
            foreach (var x in l) d[Crc.De(x.nombre)] = (x.prop, x.sub);
            return d;
        }

        // las propiedades de componentes del motor que se pueden animar: (classID, CRC del atributo)
        static readonly Dictionary<(int, uint), (string prop, int sub)> Propiedades = Armar(
            (119, "m_OrthographicSize", "orthographicSize", -1), (119, "m_FieldOfView", "fieldOfView", -1),
            (119, "m_NearClipPlane", "nearClipPlane", -1), (119, "m_FarClipPlane", "farClipPlane", -1),
            (108, "m_Intensity", "intensity", -1), (108, "m_Range", "range", -1), (108, "m_SpotAngle", "spotAngle", -1),
            (108, "m_Color.r", "color", 0), (108, "m_Color.g", "color", 1), (108, "m_Color.b", "color", 2), (108, "m_Color.a", "color", 3),
            (20, "field of view", "fieldOfView", -1), (20, "orthographic size", "orthographicSize", -1),
            (20, "m_BackGroundColor.r", "backgroundColor", 0), (20, "m_BackGroundColor.g", "backgroundColor", 1),
            (20, "m_BackGroundColor.b", "backgroundColor", 2), (20, "m_BackGroundColor.a", "backgroundColor", 3),
            (82, "m_Volume", "volume", -1), (82, "m_Pitch", "pitch", -1),
            (212, "m_Color.r", "color", 0), (212, "m_Color.g", "color", 1), (212, "m_Color.b", "color", 2), (212, "m_Color.a", "color", 3),
            (225, "m_Alpha", "alpha", -1), (225, "m_Interactable", "interactable", -1), (225, "m_BlocksRaycasts", "blocksRaycasts", -1),
            (65, "m_Size.x", "size", 0), (65, "m_Size.y", "size", 1), (65, "m_Size.z", "size", 2),
            (65, "m_Center.x", "center", 0), (65, "m_Center.y", "center", 1), (65, "m_Center.z", "center", 2),
            (135, "m_Radius", "radius", -1), (136, "m_Radius", "radius", -1), (136, "m_Height", "height", -1));

        static Dictionary<(int, uint), (string, int)> Armar(params (int clase, string nombre, string prop, int sub)[] l)
        {
            var d = new Dictionary<(int, uint), (string, int)>();
            foreach (var x in l) d[(x.clase, Crc.De(x.nombre))] = (x.prop, x.sub);
            return d;
        }

        // la propiedad de material con ese hash (los 28 bits bajos del CRC-32 del nombre)
        static bool BuscarPropiedadMaterial(Renderer r, uint h, out int id)
        {
            foreach (var m in r.sharedMaterials)
            {
                var sh = m?.sh;
                if (sh == null) continue;
                foreach (var p in sh.propiedades)
                    if ((Crc.De(p.Nombre) & 0x0FFFFFFF) == h) { id = p.Id; return true; }
            }
            id = 0;
            return false;
        }
    }
}

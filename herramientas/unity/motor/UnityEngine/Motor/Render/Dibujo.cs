using System;
using System.Collections.Generic;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Porteo.Render
{
    // El dibujo de cada cuadro, como el forward rendering de Unity: por cámara (en orden de
    // profundidad) se descarta lo que no se ve, se ordena por cola (opacos de adelante hacia
    // atrás por material, transparentes de atrás hacia adelante), y cada material dibuja sus
    // pasadas: ForwardBase con la luz direccional principal, las luces por vértice y el ambiente;
    // ForwardAdd una vez por cada luz por píxel extra; las demás tal cual. Lo que comparte malla,
    // material y luces se dibuja junto (instancias).
    public static unsafe class Dibujo
    {
        public static Action AntesDeCamaras;   // la UI arma sus canvases
        public static Action Superpuesto;      // la UI en modo pantalla (después de todas las cámaras)
        public static Action<Camera> EnCamara; // la UI de las cámaras (Screen Space - Camera / World Space)

        static readonly int ID_TIME = Ids.De("_Time"), ID_SINTIME = Ids.De("_SinTime"), ID_COSTIME = Ids.De("_CosTime"), ID_DT = Ids.De("unity_DeltaTime"),
            ID_V = Ids.De("hlslcc_mtx4x4unity_MatrixV"), ID_VP = Ids.De("hlslcc_mtx4x4unity_MatrixVP"), ID_P = Ids.De("hlslcc_mtx4x4glstate_matrix_projection"),
            ID_INVV = Ids.De("hlslcc_mtx4x4unity_MatrixInvV"), ID_CAMPROJ = Ids.De("hlslcc_mtx4x4unity_CameraProjection"), ID_CAMINVPROJ = Ids.De("hlslcc_mtx4x4unity_CameraInvProjection"),
            ID_CAMPOS = Ids.De("_WorldSpaceCameraPos"), ID_PROJPARAMS = Ids.De("_ProjectionParams"), ID_SCREEN = Ids.De("_ScreenParams"), ID_ZBUF = Ids.De("_ZBufferParams"),
            ID_ORTHO = Ids.De("unity_OrthoParams"),
            ID_O2W = Ids.De("hlslcc_mtx4x4unity_ObjectToWorld"), ID_W2O = Ids.De("hlslcc_mtx4x4unity_WorldToObject"), ID_LODFADE = Ids.De("unity_LODFade"),
            ID_WTP = Ids.De("unity_WorldTransformParams"), ID_4X = Ids.De("unity_4LightPosX0"), ID_4Y = Ids.De("unity_4LightPosY0"), ID_4Z = Ids.De("unity_4LightPosZ0"),
            ID_4AT = Ids.De("unity_4LightAtten0"), ID_LCOLOR = Ids.De("unity_LightColor"), ID_LPOS = Ids.De("_WorldSpaceLightPos0"), ID_LCOLOR0 = Ids.De("_LightColor0"),
            ID_W2L = Ids.De("hlslcc_mtx4x4unity_WorldToLight"), ID_LTEX0 = Ids.De("_LightTexture0"), ID_LTEXB0 = Ids.De("_LightTextureB0"),
            ID_SPECCUBE = Ids.De("unity_SpecCube0"), ID_SPECHDR = Ids.De("unity_SpecCube0_HDR"), ID_SHADOWMAP = Ids.De("_ShadowMapTexture"),
            ID_LIGHTSHADOW = Ids.De("_LightShadowData"), ID_COLORSPACEDOUBLE = Ids.De("unity_ColorSpaceDouble"), ID_COLORSPACEGREY = Ids.De("unity_ColorSpaceGrey"),
            ID_LMST = Ids.De("unity_LightmapST"), ID_SPECCUBE1 = Ids.De("unity_SpecCube1"), ID_SHADOWFADE = Ids.De("unity_ShadowFadeCenterAndType"),
            ID_COLORSPACEDIEL = Ids.De("unity_ColorSpaceDielectricSpec"), ID_COLORSPACELUM = Ids.De("unity_ColorSpaceLuminance"),
            ID_GRAB = Ids.De("_GrabTexture"), ID_PROY = Ids.De("hlslcc_mtx4x4unity_Projector"), ID_PROYCLIP = Ids.De("hlslcc_mtx4x4unity_ProjectorClip");

        static bool iniciado;
        static int versionAmbiente = -1;

        // para adelantar la simulación sin dibujar (capturas de prueba)
        public static bool Omitir;

        // Perfil de la GPU (para depurar): espera a que termine cada dibujo y suma cuánto tardó por
        // shader y malla; cada tanto informa los que más tardan.
        public static bool PerfilGpu;
        // para aislar problemas: "sin3d", "sinui", "sincielo", "sinefectos", "sinopacos", "sintransparentes"
        public static readonly HashSet<string> Apagado = new HashSet<string>();
        // los objetos con estos nombres no se dibujan (?ocultar=ocean,Clouds)
        public static readonly HashSet<string> Ocultos = new HashSet<string>();
        static readonly Dictionary<string, (double ms, int n)> perfil = new Dictionary<string, (double, int)>();
        static long perfilDesde;

        static void Medir(string que)
        {
            long t = Medidor.Ahora();
            // en Chrome glFinish no espera a la GPU: leer un píxel sí
            byte* px = stackalloc byte[4];
            Gl.ReadPixels(0, 0, 1, 1, Gl.RGBA, Gl.UNSIGNED_BYTE, px);
            double ms = (Medidor.Ahora() - t) * 1000.0 / System.Diagnostics.Stopwatch.Frequency;
            perfil.TryGetValue(que, out var x);
            perfil[que] = (x.ms + ms, x.n + 1);
        }

        static void InformarPerfil()
        {
            long ahora = Medidor.Ahora();
            if (perfilDesde == 0) perfilDesde = ahora;
            if ((ahora - perfilDesde) * 1.0 / System.Diagnostics.Stopwatch.Frequency < 5) return;
            perfilDesde = ahora;
            var l = new List<KeyValuePair<string, (double ms, int n)>>(perfil);
            l.Sort((a, b) => b.Value.ms.CompareTo(a.Value.ms));
            var sb = new System.Text.StringBuilder("porteo: GPU, lo que más tarda:");
            for (int i = 0; i < l.Count && i < 15; i++) sb.Append($"\n  {l[i].Value.ms:F0} ms en {l[i].Value.n} dibujos: {l[i].Key}");
            Anfitrion.Consola?.Invoke(sb.ToString(), LogType.Log);
            perfil.Clear();
        }

        public static void Iniciar()
        {
            if (iniciado) return;
            iniciado = true;
            Mundo.Dibujar += Cuadro;
            var g = Globales.Tabla;
            g.Poner(ID_COLORSPACEDOUBLE, Valor.Vec(new Vector4(2, 2, 2, 2)));
            g.Poner(ID_COLORSPACEGREY, Valor.Vec(new Vector4(0.5f, 0.5f, 0.5f, 0.5f)));
            g.Poner(ID_COLORSPACEDIEL, Valor.Vec(new Vector4(0.220916301f, 0.220916301f, 0.220916301f, 1f - 0.220916301f)));
            g.Poner(ID_COLORSPACELUM, Valor.Vec(new Vector4(0.22f, 0.707f, 0.071f, 0f)));
            g.Poner(ID_LIGHTSHADOW, Valor.Vec(new Vector4(0, 0, 0, 0)));
            g.Poner(ID_LMST, Valor.Vec(new Vector4(1, 1, 0, 0)));
            g.Poner(ID_SPECHDR, Valor.Vec(new Vector4(1, 1, 0, 0)));
            g.Poner(ID_SHADOWFADE, Valor.Vec(new Vector4(0, 0, 0, 0)));
        }

        // ── el cuadro ──
        static void Cuadro()
        {
            if (!Gpu.Activo || Omitir) return;
            if (PerfilGpu) { Medir("(antes del cuadro: subidas, compilación)"); InformarPerfil(); }
            Gpu.ActualizarTamano();
            Pantalla.Ancho = Gpu.Ancho; Pantalla.Alto = Gpu.Alto;
            var g = Globales.Tabla;
            float t = Time.timeSinceLevelLoad, dt = Math.Max(Time.deltaTime, 1e-4f);
            g.Poner(ID_TIME, Valor.Vec(new Vector4(t / 20f, t, t * 2f, t * 3f)));
            g.Poner(ID_SINTIME, Valor.Vec(new Vector4((float)Math.Sin(t / 8f), (float)Math.Sin(t / 4f), (float)Math.Sin(t / 2f), (float)Math.Sin(t))));
            g.Poner(ID_COSTIME, Valor.Vec(new Vector4((float)Math.Cos(t / 8f), (float)Math.Cos(t / 4f), (float)Math.Cos(t / 2f), (float)Math.Cos(t))));
            g.Poner(ID_DT, Valor.Vec(new Vector4(dt, 1f / dt, Time.smoothDeltaTime, 1f / Math.Max(Time.smoothDeltaTime, 1e-4f))));
            if (versionAmbiente != RenderSettings.version) { versionAmbiente = RenderSettings.version; Luces.Ambiente(g); }
            Mensajes.Accion(AntesDeCamaras, null);
            bool alguna = false;
            foreach (var cam in Camaras.Ordenadas().ToArray())
            {
                if (cam.destruido || !cam.isActiveAndEnabled) continue;
                Camara(cam);
                alguna |= cam.destino == null;
            }
            Gl.BindFramebuffer(Gl.FRAMEBUFFER, 0);
            Gl.Viewport(0, 0, Gpu.Ancho, Gpu.Alto);
            if (PerfilGpu) Medir("(cámaras: borrar, cielo, copias)");
            if (!alguna)
            {
                Gl.ClearColor(0, 0, 0, 1);
                Gl.ClearDepthf(1);
                Gl.ClearStencil(0);
                Gpu.Limpiar(Gl.COLOR_BUFFER_BIT | Gl.DEPTH_BUFFER_BIT | Gl.STENCIL_BUFFER_BIT);
            }
            Mensajes.Accion(Superpuesto, null);
        }

        // ── una cámara ──
        struct Item
        {
            public Renderer R;
            public Mesh M;
            public int Sub;
            public Material Mat;
            public int Cola;
            public float Dist;
            public int Orden;
            public Matrix4x4 O2W;
            public bool Espejo;
            public uint Piel;
            public int Luces;    // índice en la tabla de luces por objeto
        }

        static Item[] items = new Item[4096];
        static bool sinEstaticos, soloEstaticos;
        static int nItems;
        static readonly Plane[] planos = new Plane[6];
        static Camera camara;
        static Vector3 posCamara;

        public static void Camara(Camera cam, Shader reemplazo = null, string etiqueta = null)
        {
            if (!Gpu.Activo) return;
            camara = cam;
            Camaras.actual = cam;
            Camera.onPreCull?.Invoke(cam);
            Mensajes.Enviar(cam.go, "OnPreCull", null, false, SendMessageOptions.DontRequireReceiver);

            if (Apagado.Contains("sin3d")) { Camaras.actual = null; camara = null; return; }
            var efectos = Apagado.Contains("sinefectos") ? new List<(MonoBehaviour, System.Reflection.MethodInfo)>() : Efectos(cam);
            RenderTexture destino = cam.destino, intermedia = null;
            if (efectos.Count > 0)
            {
                intermedia = RenderTexture.GetTemporary(cam.AnchoDestino, cam.AltoDestino, 24, RenderTextureFormat.ARGB32);
                Destinos.Atar(intermedia);
            }
            else Destinos.Atar(destino);
            var r = cam.pixelRect;
            int vx = (int)r.x, vy = (int)r.y, vw = Math.Max(1, (int)r.width), vh = Math.Max(1, (int)r.height);
            Gl.Viewport(vx, vy, vw, vh);
            Borrar(cam, vx, vy, vw, vh);

            // matrices y parámetros de la cámara
            var V = cam.worldToCameraMatrix;
            var P = cam.projectionMatrix;
            var VP = P * V;
            posCamara = cam.transform.position;
            var g = Globales.Tabla;
            g.Poner(ID_V, Valor.Matriz(V));
            g.Poner(ID_VP, Valor.Matriz(VP));
            g.Poner(ID_P, Valor.Matriz(P));
            g.Poner(ID_INVV, Valor.Matriz(V.inverse));
            g.Poner(ID_CAMPROJ, Valor.Matriz(P));
            g.Poner(ID_CAMINVPROJ, Valor.Matriz(P.inverse));
            g.Poner(ID_CAMPOS, Valor.Vec(new Vector4(posCamara.x, posCamara.y, posCamara.z, 1)));
            float n = cam.cerca, f = cam.lejos;
            g.Poner(ID_PROJPARAMS, Valor.Vec(new Vector4(1, n, f, 1f / f)));
            g.Poner(ID_SCREEN, Valor.Vec(new Vector4(vw, vh, 1f + 1f / vw, 1f + 1f / vh)));
            g.Poner(ID_ZBUF, Valor.Vec(new Vector4(1 - f / n, f / n, (1 - f / n) / f, (f / n) / f)));
            g.Poner(ID_ORTHO, Valor.Vec(new Vector4(cam.tamOrto * cam.aspect, cam.tamOrto, 0, cam.orto ? 1 : 0)));
            var refl = RenderSettings.reflejoPropio ?? RenderSettings.reflejoGenerado;
            if (refl is Cubemap) g.Poner(ID_SPECCUBE, Valor.Tex(refl)); else g.Quitar(ID_SPECCUBE);

            Camera.onPreRender?.Invoke(cam);
            Mensajes.Enviar(cam.go, "OnPreRender", null, false, SendMessageOptions.DontRequireReceiver);

            Juntar(cam, VP);
            Ordenar();
            // opacos, cielo y transparentes
            int i = 0;
            while (i < nItems && items[i].Cola <= 2500) i = Apagado.Contains("sinopacos") ? i + 1 : DibujarDesde(i, 2500);
            if (cam.borrar == CameraClearFlags.Skybox && !Apagado.Contains("sincielo")) Cielo.Dibujar(cam);
            if (Proyectores.activos.Count > 0 && !Apagado.Contains("sinproyectores")) DibujarProyectores(i);
            while (i < nItems) i = Apagado.Contains("sintransparentes") ? i + 1 : DibujarDesde(i, int.MaxValue);
            Mensajes.Accion(() => EnCamara?.Invoke(cam), null);

            Camera.onPostRender?.Invoke(cam);
            Mensajes.Enviar(cam.go, "OnPostRender", null, false, SendMessageOptions.DontRequireReceiver);

            if (intermedia != null)
            {
                Encadenar(efectos, intermedia, destino);
                RenderTexture.ReleaseTemporary(intermedia);
            }
            Camaras.actual = null;
            camara = null;
        }

        static void Borrar(Camera cam, int x, int y, int w, int h)
        {
            uint bits = 0;
            switch (cam.borrar)
            {
                case CameraClearFlags.Skybox:
                case CameraClearFlags.SolidColor:
                    bits = Gl.COLOR_BUFFER_BIT | Gl.DEPTH_BUFFER_BIT | Gl.STENCIL_BUFFER_BIT;
                    var c = cam.borrar == CameraClearFlags.Skybox && RenderSettings.cieloMaterial != null ? Color.black : cam.fondo;
                    Gl.ClearColor(c.r, c.g, c.b, c.a);
                    break;
                case CameraClearFlags.Depth: bits = Gl.DEPTH_BUFFER_BIT | Gl.STENCIL_BUFFER_BIT; break;
            }
            if (bits == 0) return;
            Gl.Enable(Gl.SCISSOR_TEST);
            Gl.Scissor(x, y, w, h);
            Gl.ClearDepthf(1);
            Gl.ClearStencil(0);
            Gpu.Limpiar(bits);
            Gl.Disable(Gl.SCISSOR_TEST);
        }

        // ── qué se ve ──
        static void Juntar(Camera cam, in Matrix4x4 vp)
        {
            nItems = 0;
            sinEstaticos = Apagado.Contains("sinestaticos");
            soloEstaticos = Apagado.Contains("soloestaticos");
            Planos(vp);
            float mitadTan = (float)Math.Tan(cam.fov * 0.5f * Math.PI / 180);
            foreach (var g in Renders.lods) g.Elegir(posCamara, mitadTan, cam.orto, cam.tamOrto);
            LucesObjeto.Empezar(cam);
            var lista = Renders.activos;
            int mascara = cam.mascara;
            int cuadro = Time.frameCount;
            for (int k = 0; k < lista.Count; k++)
            {
                var r = lista[k];
                var go = r.go;
                if (go == null || (mascara & (1 << go.capa)) == 0) continue;
                if (r.lodGrupo != null && r.lodGrupo.habilitado && r.lodGrupo.indiceDibujo())
                {
                    int s = r.lodGrupo.seleccion;
                    if (s < 0 || (r.lodMascara & (1 << s)) == 0) continue;
                }
                if (r.estaticoPrimera >= 0 ? sinEstaticos : soloEstaticos) continue;
                if (Ocultos.Count > 0 && Ocultos.Contains(go.name)) continue;
                var m = r.MallaParaDibujar();
                if ((object)m == null || m.destruido) continue;
                var b = r.bounds;
                if (!Visible(b)) continue;
                if (!m.Lista()) continue;
                r.cuadroVisible = cuadro;
                Matrix4x4 o2w;
                uint piel = 0;
                if (r.estaticoPrimera >= 0) o2w = r.raizEstatica != null ? r.raizEstatica.localToWorldMatrix : Matrix4x4.identity;
                else if (r is SkinnedMeshRenderer smr && m.poses.Length > 0)
                {
                    piel = smr.Piel();
                    o2w = smr.Espacio.localToWorldMatrix;
                }
                else o2w = r.transform.localToWorldMatrix;
                bool espejo = Determinante3(o2w) < 0;
                var mats = r.mats;
                int subs = m.submallas.Length;
                float dist = (b.center - posCamara).sqrMagnitude;
                int luces = -1;
                for (int i = 0; i < mats.Length; i++)
                {
                    var mat = mats[i];
                    if ((object)mat == null || mat.destruido || (object)mat.sh == null) continue;
                    int sub = r.estaticoPrimera >= 0 ? r.estaticoPrimera + Math.Min(i, r.estaticoCantidad - 1) : Math.Min(i, subs - 1);
                    if (sub < 0 || sub >= subs) continue;
                    if (luces < 0) luces = LucesObjeto.Para(r, b);
                    if (nItems == items.Length) Array.Resize(ref items, items.Length * 2);
                    items[nItems++] = new Item { R = r, M = m, Sub = sub, Mat = mat, Cola = mat.Cola, Dist = dist, Orden = r.orden, O2W = o2w, Espejo = espejo, Piel = piel, Luces = luces };
                }
            }
        }

        static bool indiceDibujo(this LODGroup g) => g.go != null && g.go.activoEnJerarquia;

        static float Determinante3(in Matrix4x4 m) =>
            m.m00 * (m.m11 * m.m22 - m.m12 * m.m21) - m.m01 * (m.m10 * m.m22 - m.m12 * m.m20) + m.m02 * (m.m10 * m.m21 - m.m11 * m.m20);

        static void Planos(in Matrix4x4 m) => PlanosDe(m, planos);

        static void PlanosDe(in Matrix4x4 m, Plane[] planos)
        {
            // Gribb-Hartmann: izquierda, derecha, abajo, arriba, cerca, lejos
            planos[0] = Plano(m.m30 + m.m00, m.m31 + m.m01, m.m32 + m.m02, m.m33 + m.m03);
            planos[1] = Plano(m.m30 - m.m00, m.m31 - m.m01, m.m32 - m.m02, m.m33 - m.m03);
            planos[2] = Plano(m.m30 + m.m10, m.m31 + m.m11, m.m32 + m.m12, m.m33 + m.m13);
            planos[3] = Plano(m.m30 - m.m10, m.m31 - m.m11, m.m32 - m.m12, m.m33 - m.m13);
            planos[4] = Plano(m.m30 + m.m20, m.m31 + m.m21, m.m32 + m.m22, m.m33 + m.m23);
            planos[5] = Plano(m.m30 - m.m20, m.m31 - m.m21, m.m32 - m.m22, m.m33 - m.m23);
        }

        static Plane Plano(float a, float b, float c, float d)
        {
            float l = (float)Math.Sqrt(a * a + b * b + c * c);
            if (l < 1e-12f) l = 1;
            return new Plane { normal = new Vector3(a / l, b / l, c / l), distance = d / l };
        }

        static bool Visible(in Bounds b) => VisibleEn(planos, b);

        static bool VisibleEn(Plane[] planos, in Bounds b)
        {
            var c = b.center; var e = b.extents;
            for (int i = 0; i < 6; i++)
            {
                var n = planos[i].normal;
                float r = e.x * Math.Abs(n.x) + e.y * Math.Abs(n.y) + e.z * Math.Abs(n.z);
                if (Vector3.Dot(n, c) + planos[i].distance + r < 0) return false;
            }
            return true;
        }

        // opacos por material y malla (y de adelante hacia atrás); transparentes de atrás para adelante
        static readonly Comparison<Item> comparar = (a, b) =>
        {
            if (a.Cola != b.Cola) return a.Cola.CompareTo(b.Cola);
            if (a.Cola > 2500)
            {
                if (a.Orden != b.Orden) return a.Orden.CompareTo(b.Orden);
                return b.Dist.CompareTo(a.Dist);
            }
            int ma = a.Mat.GetHashCode(), mb = b.Mat.GetHashCode();
            if (ma != mb) return ma.CompareTo(mb);
            int sa = a.M.GetHashCode(), sb = b.M.GetHashCode();
            if (sa != sb) return sa.CompareTo(sb);
            if (a.Sub != b.Sub) return a.Sub.CompareTo(b.Sub);
            if (a.Luces != b.Luces) return a.Luces.CompareTo(b.Luces);
            return a.Dist.CompareTo(b.Dist);
        };

        static void Ordenar() => Array.Sort(items, 0, nItems, Comparer<Item>.Create(comparar));

        // ── dibujar ──
        static readonly List<string> claves = new List<string>(16);
        static readonly Tabla objeto = new Tabla();
        static float[] instancias = new float[16 * 256];
        static uint vboInstancias;
        static int tamVboInstancias;

        // dibuja desde i el grupo de ítems iguales (instancias); devuelve el siguiente
        static int DibujarDesde(int i, int colaMax)
        {
            ref var a = ref items[i];
            int j = i + 1;
            if (a.Piel == 0 && a.R.bloque == null)
                while (j < nItems && j - i < 256)
                {
                    ref var b = ref items[j];
                    if (b.Cola > colaMax || b.M != a.M || b.Sub != a.Sub || b.Mat != a.Mat || b.Luces != a.Luces || b.Espejo != a.Espejo || b.Piel != 0 || b.R.bloque != null) break;
                    j++;
                }
            DibujarGrupo(i, j);
            return j;
        }

        static void DibujarGrupo(int desde, int hasta)
        {
            ref var a = ref items[desde];
            var mat = a.Mat;
            var sh = mat.sh;
            var ss = sh.Activo();
            if (ss == null) return;
            var luz = LucesObjeto.Config(a.Luces);
            bool hayBase = false;
            foreach (var pa in ss.Pasadas) if (pa.LightMode == "FORWARDBASE") { hayBase = true; break; }
            foreach (var pa in ss.Pasadas)
            {
                if (pa.Tipo == 2) { Agarrar(pa); continue; }
                if (!pa.Dibujable) continue;
                if (mat.pasadasApagadas != null && mat.pasadasApagadas.Contains(pa.LightMode)) continue;
                switch (pa.LightMode)
                {
                    case "":
                    case "ALWAYS":
                        Pasada(desde, hasta, pa, 0, null, luz);
                        break;
                    case "FORWARDBASE":
                    {
                        int mascara = Claves.LIGHTPROBE_SH | Niebla();
                        if (luz.Principal != null) mascara |= Claves.DIRECTIONAL;
                        if (luz.NVertice > 0) mascara |= Claves.VERTEXLIGHT_ON;
                        Pasada(desde, hasta, pa, mascara, luz.Principal, luz);
                        break;
                    }
                    case "FORWARDADD":
                        for (int k = 0; k < luz.NPixel; k++)
                        {
                            var l = luz.Pixel[k];
                            int mascara = Niebla() | (l.tipo == LightType.Spot ? Claves.SPOT : l.tipo == LightType.Directional ? Claves.DIRECTIONAL : Claves.POINT);
                            Pasada(desde, hasta, pa, mascara, l, luz);
                        }
                        break;
                    case "VERTEX":
                        if (!hayBase) Pasada(desde, hasta, pa, Niebla(), null, luz);
                        break;
                }
            }
        }

        // ── proyectores ──
        // Cada proyector dibuja su material sobre los objetos opacos visibles que entran en su
        // volumen (salvo las capas que ignora), de a uno: cada objeto lleva sus propias matrices
        // unity_Projector y unity_ProjectorClip (las del proyector por la del objeto).
        static readonly Plane[] planosProyector = new Plane[6];
        static readonly HashSet<(Renderer, int)> proyectados = new HashSet<(Renderer, int)>();
        static bool proyectando;
        static Matrix4x4 proyTextura, proyRecorte;

        static void DibujarProyectores(int opacos)
        {
            int n = nItems;
            if (items.Length <= n) Array.Resize(ref items, items.Length * 2);
            foreach (var pr in Proyectores.activos.ToArray())
            {
                var mat = pr.mat;
                if ((object)mat == null || mat.destruido || (object)mat.sh == null || pr.go == null || (camara.mascara & (1 << pr.go.capa)) == 0) continue;
                pr.Matrices(out var volumen, out proyTextura, out proyRecorte);
                PlanosDe(volumen, planosProyector);
                proyectados.Clear();
                for (int k = 0; k < opacos; k++)
                {
                    var it = items[k];
                    var go = it.R.go;
                    if (go == null || (pr.ignorar & (1 << go.capa)) != 0) continue;
                    if (!proyectados.Add((it.R, it.Sub))) continue;
                    if (!VisibleEn(planosProyector, it.R.bounds)) continue;
                    it.Mat = mat;
                    it.Cola = mat.Cola;
                    items[n] = it;
                    proyectando = true;
                    try { DibujarGrupo(n, n + 1); }
                    finally { proyectando = false; }
                }
            }
            nItems = n;
        }

        static int Niebla()
        {
            if (!RenderSettings.niebla) return 0;
            return RenderSettings.modoNiebla switch { FogMode.Linear => Claves.FOG_LINEAR, FogMode.Exponential => Claves.FOG_EXP, _ => Claves.FOG_EXP2 };
        }

        static void Pasada(int desde, int hasta, PasadaShader pa, int mascara, Light luzPasada, LucesObjeto.Conf luz)
        {
            ref var a = ref items[desde];
            var mat = a.Mat;
            var p = ProgramaPara(mat, pa, mascara);
            if (p == null) return;
            Gpu.UsarPrograma(p.Id);
            Gpu.Aplicar(pa.Estado.Resolver(mat), a.Espejo);
            // por objeto (lo de la primera instancia vale para todas: el grupo comparte luces)
            objeto.Limpiar();
            objeto.Poner(ID_LODFADE, Valor.Vec(new Vector4(1, 1, 0, 0)));
            objeto.Poner(ID_WTP, Valor.Vec(new Vector4(0, 0, 0, a.Espejo ? -1 : 1)));
            if (!p.Instanciado)
            {
                objeto.Poner(ID_O2W, Valor.Matriz(a.O2W));
                objeto.Poner(ID_W2O, Valor.Matriz(a.O2W.inverse));
            }
            luz.Vertices(objeto, ID_4X, ID_4Y, ID_4Z, ID_4AT, ID_LCOLOR);
            if (luzPasada != null) LuzPasada(luzPasada);
            else
            {
                objeto.Poner(ID_LPOS, Valor.Vec(new Vector4(0, 0, 1, 0)));
                objeto.Poner(ID_LCOLOR0, Valor.Vec(Vector4.zero));
            }
            if (proyectando)
            {
                objeto.Poner(ID_PROY, Valor.Matriz(proyTextura * a.O2W));
                objeto.Poner(ID_PROYCLIP, Valor.Matriz(proyRecorte * a.O2W));
            }
            // el MaterialPropertyBlock del objeto no es del material del proyector
            Subir(p, mat, proyectando ? null : a.R.bloque?.t);
            uint vao = a.M.Vao(p, a.Piel);
            Gpu.UsarVao(vao);
            var sm = a.M.submallas[a.Sub];
            uint modo = sm.Topologia switch { 2 => Gl.TRIANGLES, 3 => Gl.LINES, 4 => Gl.LINE_STRIP, 5 => Gl.POINTS, _ => Gl.TRIANGLES };
            nint off = sm.Primero * a.M.TamIndice;
            if (p.Instanciado)
            {
                int n = hasta - desde;
                Instancias(desde, hasta, p);
                Gl.DrawElementsInstanced(modo, sm.Cantidad, a.M.TipoIndice, off, n);
                Medidor.Dibujos++; Medidor.Triangulos += sm.Cantidad / 3 * n;
                if (PerfilGpu) Medir($"{mat.sh.m_Name}/{pa.Nombre} {pa.LightMode} · {a.M.m_Name} x{n} ({mat.m_Name})");
            }
            else
            {
                Gl.DrawElements(modo, sm.Cantidad, a.M.TipoIndice, off);
                Medidor.Dibujos += hasta - desde; Medidor.Triangulos += sm.Cantidad / 3 * (hasta - desde);
                if (PerfilGpu) Medir($"{mat.sh.m_Name}/{pa.Nombre} {pa.LightMode} · {a.M.m_Name} ({mat.m_Name})");
                // sin instancias: el resto del grupo de a uno
                for (int i = desde + 1; i < hasta; i++)
                {
                    ref var b = ref items[i];
                    objeto.Poner(ID_O2W, Valor.Matriz(b.O2W));
                    objeto.Poner(ID_W2O, Valor.Matriz(b.O2W.inverse));
                    SubirObjeto(p);
                    Gl.DrawElements(modo, sm.Cantidad, a.M.TipoIndice, off);
                }
            }
        }

        // la luz de una pasada (la principal en ForwardBase, cada una extra en ForwardAdd)
        static void LuzPasada(Light l)
        {
            var c = l.colorLuz * l.intensidad;
            objeto.Poner(ID_LCOLOR0, Valor.Vec(new Vector4(c.r, c.g, c.b, 1)));
            var t = l.transform;
            if (l.tipo == LightType.Directional)
            {
                var d = -t.forward;
                objeto.Poner(ID_LPOS, Valor.Vec(new Vector4(d.x, d.y, d.z, 0)));
                objeto.Poner(ID_W2L, Valor.Matriz(t.worldToLocalMatrix));
                return;
            }
            var p = t.position;
            objeto.Poner(ID_LPOS, Valor.Vec(new Vector4(p.x, p.y, p.z, 1)));
            float r = Math.Max(l.rango, 1e-4f);
            Matrix4x4 w2l;
            if (l.tipo == LightType.Spot)
            {
                // proyección del spot a [0,1] (como hace Unity para muestrear la cookie)
                float tan = (float)Math.Tan(l.anguloSpot * 0.5f * Math.PI / 180);
                var esc = Matrix4x4.Scale(new Vector3(1f / r, 1f / r, 1f / r));
                var proy = new Matrix4x4();
                proy.m00 = 1f / tan; proy.m11 = 1f / tan; proy.m22 = 0; proy.m32 = 1; proy.m33 = 0;
                proy.m02 = 0.5f; proy.m12 = 0.5f;
                var centro = Matrix4x4.TRS(new Vector3(0.5f, 0.5f, 0), Quaternion.identity, new Vector3(0.5f, 0.5f, 1));
                w2l = centro * proy * esc * Matrix4x4.TRS(p, t.rotation, Vector3.one).inverse;
                var cookie = l.texCookie ?? RenderSettings.cookieSpot;
                if (cookie != null) objeto.Poner(ID_LTEX0, Valor.Tex(cookie));
                objeto.Poner(ID_LTEXB0, Valor.Tex(Luces.Atenuacion()));
            }
            else
            {
                w2l = Matrix4x4.Scale(new Vector3(1f / r, 1f / r, 1f / r)) * Matrix4x4.TRS(p, t.rotation, Vector3.one).inverse;
                objeto.Poner(ID_LTEX0, Valor.Tex(Luces.Atenuacion()));
            }
            objeto.Poner(ID_W2L, Valor.Matriz(w2l));
        }

        // las matrices de las instancias del grupo, en el buffer de instancias
        static void Instancias(int desde, int hasta, Programa p)
        {
            int n = hasta - desde;
            if (instancias.Length < n * 16) instancias = new float[n * 16];
            for (int i = 0; i < n; i++)
            {
                ref var m = ref items[desde + i].O2W;
                int k = i * 16;
                for (int c = 0; c < 16; c++) instancias[k + c] = m[c];
            }
            SubirInstancias(n, p);
        }

        // un dibujo suelto con un programa instanciado: una sola instancia
        static void InstanciaSola(in Matrix4x4 m, Programa p)
        {
            for (int c = 0; c < 16; c++) instancias[c] = m[c];
            SubirInstancias(1, p);
        }

        static void SubirInstancias(int n, Programa p)
        {
            int bytes = n * 64;
            fixed (float* d = instancias)
            {
                if (vboInstancias == 0 || tamVboInstancias < bytes)
                {
                    Gpu.Borrar(ref vboInstancias);
                    tamVboInstancias = Math.Max(bytes, 64 * 1024);
                    uint b;
                    Gl.GenBuffers(1, &b);
                    vboInstancias = b;
                    Gl.BindBuffer(Gl.ARRAY_BUFFER, b);
                    Gl.BufferData(Gl.ARRAY_BUFFER, tamVboInstancias, null, Gl.STREAM_DRAW);
                }
                Gl.BindBuffer(Gl.ARRAY_BUFFER, vboInstancias);
                Gl.BufferData(Gl.ARRAY_BUFFER, tamVboInstancias, null, Gl.STREAM_DRAW);
                Gl.BufferSubData(Gl.ARRAY_BUFFER, 0, bytes, d);
            }
            for (int c = 0; c < 4; c++)
            {
                int loc = p.Atributos[Canales.O2W + c];
                if (loc < 0) continue;
                Gl.EnableVertexAttribArray((uint)loc);
                Gl.VertexAttribPointer((uint)loc, 4, Gl.FLOAT, 0, 64, c * 16);
                Gl.VertexAttribDivisor((uint)loc, 1);
            }
        }

        // ── programas y uniforms ──
        sealed class ProgCache { public int Global, Mat; public Programa P; }
        static readonly Dictionary<(Material, PasadaShader, int), ProgCache> progs = new Dictionary<(Material, PasadaShader, int), ProgCache>();

        static Programa ProgramaPara(Material mat, PasadaShader pa, int mascara)
        {
            var clave = (mat, pa, mascara);
            if (progs.TryGetValue(clave, out var c) && c.Global == Claves.Version && c.Mat == mat.versionClaves) return c.P;
            claves.Clear();
            foreach (var k in mat.claves) claves.Add(k);
            foreach (var k in Claves.Globales) claves.Add(k);
            Claves.Agregar(mascara, claves);
            var p = mat.sh.ProgramaDe(pa, claves, true);
            // si no hay programa (el shader todavía no llegó o no compila) se vuelve a preguntar
            if (p != null) progs[clave] = new ProgCache { Global = Claves.Version, Mat = mat.versionClaves, P = p };
            return p;
        }

        static void Subir(Programa p, Material mat, Tabla bloque)
        {
            var us = p.Uniformes;
            var sh = mat.sh;
            for (int i = 0; i < us.Length; i++)
            {
                ref var u = ref us[i];
                Valor v;
                if (!objeto.Leer(u.Id, out v) && (bloque == null || !bloque.Leer(u.Id, out v)) && !mat.props.Leer(u.Id, out v) && !Globales.Tabla.Leer(u.Id, out v))
                    v = default;
                Poner(ref u, v, sh);
            }
        }

        static void SubirObjeto(Programa p)
        {
            var us = p.Uniformes;
            for (int i = 0; i < us.Length; i++)
            {
                ref var u = ref us[i];
                if (u.Id == ID_O2W || u.Id == ID_W2O) Poner(ref u, objeto[u.Id], null);
            }
        }

        static readonly float[] cero = new float[16 * 8];

        static void Poner(ref Uniforme u, in Valor v, Shader sh)
        {
            if (u.Unidad >= 0)
            {
                uint id = 0;
                if (v.O is Texture t && !t.destruido)
                {
                    bool cubo = t is Cubemap;
                    if (cubo == (u.Objetivo == Gl.TEXTURE_CUBE_MAP) && u.Objetivo != Gl.TEXTURE_3D) id = t.IdGl();
                }
                if (id == 0)
                {
                    string def = "";
                    if (sh != null) { var pr = sh.Propiedad(u.Id); if (pr != null) def = pr.TexDef; }
                    id = u.Objetivo == Gl.TEXTURE_CUBE_MAP ? Gpu.PorDefecto(def, true) : u.Objetivo == Gl.TEXTURE_3D ? 0 : Gpu.PorDefecto(def, false);
                }
                Gpu.Textura(u.Unidad, u.Objetivo, id);
                return;
            }
            switch (u.Tipo)
            {
                case Gl.FLOAT:
                    if (u.N > 1 && v.O is float[] fa) { fixed (float* x = fa) Gl.Uniform1fv(u.Loc, Math.Min(u.N, fa.Length), x); }
                    else Gl.Uniform1f(u.Loc, v.V.x);
                    break;
                case Gl.FLOAT_VEC2: { var x = v.V; Gl.Uniform2fv(u.Loc, 1, (float*)&x); break; }
                case Gl.FLOAT_VEC3: { var x = v.V; Gl.Uniform3fv(u.Loc, 1, (float*)&x); break; }
                case Gl.FLOAT_VEC4:
                    if (u.N > 1 || v.O is float[])
                    {
                        // matrices de hlslcc (vec4[4], por columnas) y arreglos de vectores
                        var a = v.O as float[];
                        if (a != null) { fixed (float* x = a) Gl.Uniform4fv(u.Loc, Math.Min(u.N, a.Length / 4), x); }
                        else if (v.Tipo == TipoValor.Vector) { var x = v.V; Gl.Uniform4fv(u.Loc, 1, (float*)&x); }
                        else fixed (float* x = cero) Gl.Uniform4fv(u.Loc, Math.Min(u.N, cero.Length / 4), x);
                    }
                    else { var x = v.V; Gl.Uniform4fv(u.Loc, 1, (float*)&x); }
                    break;
                case Gl.FLOAT_MAT4:
                    if (v.O is float[] m && m.Length >= 16) { fixed (float* x = m) Gl.UniformMatrix4fv(u.Loc, 1, 0, x); }
                    else { var id = Matrix4x4.identity; var a = new float[16]; for (int k = 0; k < 16; k++) a[k] = id[k]; fixed (float* x = a) Gl.UniformMatrix4fv(u.Loc, 1, 0, x); }
                    break;
                case Gl.INT: case Gl.BOOL: Gl.Uniform1i(u.Loc, (int)v.V.x); break;
                case Gl.INT_VEC4: { var x = stackalloc int[4] { (int)v.V.x, (int)v.V.y, (int)v.V.z, (int)v.V.w }; Gl.Uniform4iv(u.Loc, 1, x); break; }
            }
        }

        // ── GrabPass: lo dibujado hasta acá, como textura ──
        static readonly Dictionary<string, RenderTexture> grabs = new Dictionary<string, RenderTexture>();

        static void Agarrar(PasadaShader pa)
        {
            var nombre = string.IsNullOrEmpty(pa.TexturaGrab) ? "_GrabTexture" : pa.TexturaGrab;
            int w = Destinos.Ancho, h = Destinos.Alto;
            bool sinAlfa = Destinos.Actual == null;
            if (!grabs.TryGetValue(nombre, out var rt) || rt.width != w || rt.height != h || rt.sinAlfa != sinAlfa)
            {
                rt?.Release();
                rt = new RenderTexture(w, h, 0) { m_Name = nombre, sinAlfa = sinAlfa };
                rt.Create();
                grabs[nombre] = rt;
            }
            Gpu.AtarParaSubir(Gl.TEXTURE_2D, rt.IdGl());
            Gl.CopyTexSubImage2D(Gl.TEXTURE_2D, 0, 0, 0, 0, 0, w, h);
            Globales.Tabla.PonerTextura(Ids.De(nombre), rt);
        }

        // ── efectos de imagen (OnRenderImage de los scripts de la cámara) ──
        static List<(MonoBehaviour mb, System.Reflection.MethodInfo m)> Efectos(Camera cam)
        {
            var l = new List<(MonoBehaviour, System.Reflection.MethodInfo)>();
            foreach (var c in cam.go.componentes)
            {
                if (!(c is MonoBehaviour mb) || !mb.isActiveAndEnabled) continue;
                var ts = mb.tipoScript ?? TipoScript.De(mb.GetType());
                foreach (var m in ts.Metodos("OnRenderImage"))
                    if (m.GetParameters().Length == 2) { l.Add((mb, m)); break; }
            }
            return l;
        }

        static void Encadenar(List<(MonoBehaviour mb, System.Reflection.MethodInfo m)> efectos, RenderTexture fuente, RenderTexture destino)
        {
            var actual = fuente;
            for (int i = 0; i < efectos.Count; i++)
            {
                bool ultimo = i == efectos.Count - 1;
                var salida = ultimo ? destino : RenderTexture.GetTemporary(fuente.width, fuente.height, 0, RenderTextureFormat.ARGB32);
                Mensajes.Llamar(efectos[i].mb, efectos[i].m, new object[] { actual, salida });
                if (actual != fuente) RenderTexture.ReleaseTemporary(actual);
                actual = salida;
            }
            Destinos.Atar(destino);
        }

        // Material.SetPass + Graphics.DrawMeshNow / GL: dejar lista una pasada para dibujar a mano
        internal static Material pasadaActiva;
        internal static PasadaShader pasadaShaderActiva;

        public static bool ActivarPasada(Material mat, int pass)
        {
            var ss = mat?.sh?.Activo();
            if (ss == null || pass < 0 || pass >= ss.Pasadas.Length) return false;
            pasadaActiva = mat;
            pasadaShaderActiva = ss.Pasadas[pass];
            return true;
        }

        // dibuja una malla con un material y una pasada (Graphics.DrawMeshNow, Blit, GL)
        public static void Inmediato(Mesh m, int sub, in Matrix4x4 o2w, Material mat, PasadaShader pa)
        {
            if ((object)m == null || m.submallas.Length == 0) return;
            var sm = m.submallas[Math.Clamp(sub, 0, m.submallas.Length - 1)];
            Rango(m, sm.Primero, sm.Cantidad, o2w, mat, pa, null, Niebla());
        }

        // Un tramo de índices de una malla con un material y una pasada, con propiedades propias
        // del dibujo (que pisan a las del material) y palabras clave del motor: lo que usa la UI
        // para cada lote de un canvas (la textura y el recorte de sus CanvasRenderer).
        public static void Rango(Mesh m, int primero, int cantidad, in Matrix4x4 o2w, Material mat, PasadaShader pa, Tabla propias, int mascara)
        {
            if (!Gpu.Activo || cantidad <= 0 || (object)m == null || (object)mat == null || (object)mat.sh == null || pa == null || !pa.Dibujable) return;
            if (!m.Lista()) return;
            var p = ProgramaPara(mat, pa, mascara);
            if (p == null) return;
            Gpu.UsarPrograma(p.Id);
            bool espejo = Determinante3(o2w) < 0;
            Gpu.Aplicar(pa.Estado.Resolver(mat), espejo);
            objeto.Limpiar();
            objeto.Poner(ID_O2W, Valor.Matriz(o2w));
            objeto.Poner(ID_W2O, Valor.Matriz(o2w.inverse));
            objeto.Poner(ID_WTP, Valor.Vec(new Vector4(0, 0, 0, espejo ? -1 : 1)));
            objeto.Poner(ID_LODFADE, Valor.Vec(new Vector4(1, 1, 0, 0)));
            Subir(p, mat, propias);
            Gpu.UsarVao(m.Vao(p));
            nint off = (nint)primero * m.TamIndice;
            if (p.Instanciado)
            {
                InstanciaSola(o2w, p);
                Gl.DrawElementsInstanced(Gl.TRIANGLES, cantidad, m.TipoIndice, off, 1);
            }
            else Gl.DrawElements(Gl.TRIANGLES, cantidad, m.TipoIndice, off);
            Medidor.Dibujos++; Medidor.Triangulos += cantidad / 3;
            if (PerfilGpu) Medir($"{mat.sh.m_Name}/{pa.Nombre} · {m.m_Name} [{primero}+{cantidad}] ({mat.m_Name})");
        }
    }
}

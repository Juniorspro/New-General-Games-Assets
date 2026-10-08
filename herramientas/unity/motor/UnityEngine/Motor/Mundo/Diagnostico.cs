using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using UnityEngine;

namespace Porteo
{
    // Para entender una captura sin depurador: lo que hay en la escena, en texto. Lo usan la prueba
    // de consola y la página (?diag=jerarquia:FPSCamera;cerca:6 después de que llegó la partida).
    public static class Diagnostico
    {
        public static string Correr(string comando)
        {
            var partes = comando.Split(new[] { ':' }, 2);
            var arg = partes.Length > 1 ? partes[1] : "";
            try
            {
                switch (partes[0])
                {
                    case "jerarquia": return Jerarquia(arg);
                    case "cerca": return Cerca(float.TryParse(arg, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var r) ? r : 6);
                    case "camaras": return Camaras();
                    case "escena": return Escena();
                    case "disco": return Disco(arg.Length > 0 ? arg : Plataforma.RutaPersistente);
                    case "zonas": return Zonas();
                    case "objetos": return Objetos(arg);
                    case "punto": return Punto(arg);
                    case "rayo": return Rayo(arg);
                    case "rayomalla": return RayoMalla(arg);
                    case "estatico": return Estatico(arg);
                    case "jugador": return Jugador();
                    case "ui": return Ui(arg);
                    case "crear": return Crear(arg);
                    case "aspiradora": return Aspiradora();
                    case "tiempo": return $"tiempo: t={Time.time:F2} escala={Time.timeScale} cuadro={Time.frameCount} real={Time.realtimeSinceStartup:F1} cultura={System.Globalization.CultureInfo.CurrentCulture.Name}";
                    case "directores": return Directores(arg);
                    case "animadores": return Animadores(arg);
                    case "textos": return Textos();
                    case "desplegables": return Desplegables();
                    case "materiales": return Materiales(arg);
                    case "luces": return Luces(arg);
                    case "campos": return Campos(arg);
                    default: return "diagnóstico: no sé " + partes[0];
                }
            }
            catch (Exception e) { return "diagnóstico: " + e; }
        }

        // los archivos guardados (las partidas y la configuración del juego)
        public static string Disco(string raiz)
        {
            if (!System.IO.Directory.Exists(raiz)) return "disco: no existe " + raiz;
            var sb = new StringBuilder("disco " + raiz + ":");
            foreach (var f in System.IO.Directory.EnumerateFiles(raiz, "*", System.IO.SearchOption.AllDirectories))
            {
                var fi = new System.IO.FileInfo(f);
                sb.Append($"\n   {f} {fi.Length} B {fi.LastWriteTimeUtc:HH:mm:ss}");
            }
            return sb.ToString();
        }

        // las zonas del mundo (las raíces "zone...") con el centro y el tamaño de lo que dibujan
        public static string Zonas()
        {
            var sb = new StringBuilder("zonas:");
            foreach (var t in Resources.FindObjectsOfTypeAll<Transform>())
            {
                if (t.parent != null || !t.gameObject.scene.IsValid() || !t.name.StartsWith("zone")) continue;
                bool hay = false; Bounds b = default; int n = 0;
                var xs = new System.Collections.Generic.List<float>(); var zs = new System.Collections.Generic.List<float>(); var ys = new System.Collections.Generic.List<float>();
                foreach (var r in t.GetComponentsInChildren<Renderer>(true))
                {
                    if (!hay) { b = r.bounds; hay = true; } else b.Encapsulate(r.bounds);
                    n++;
                    // la mediana de los centros: los límites totales se los llevan el cielo y el mar
                    var c = r.bounds.center; xs.Add(c.x); ys.Add(c.y); zs.Add(c.z);
                }
                xs.Sort(); ys.Sort(); zs.Sort();
                var med = n > 0 ? new Vector3(xs[n / 2], ys[n / 2], zs[n / 2]) : Vector3.zero;
                sb.Append($"\n   {t.name} activo={t.gameObject.activeSelf} renderers={n} mediana={med} centro={b.center} tamaño={b.size}");
            }
            return sb.ToString();
        }

        // objetos:FILTRO[:COMPONENTE]: los GameObjects cuyo nombre contiene FILTRO (activos o no), con
        // su estado físico; con COMPONENTE, también los campos de ese componente (el estado de un
        // script del juego, sin depurador)
        public static string Objetos(string arg)
        {
            var partes = arg.Split(':');
            var filtro = partes[0];
            var comp = partes.Length > 1 ? partes[1] : null;
            var sb = new StringBuilder("objetos " + arg + ":");
            int n = 0;
            foreach (var go in Resources.FindObjectsOfTypeAll<GameObject>())
            {
                if (!go.scene.IsValid() || go.name.IndexOf(filtro, StringComparison.OrdinalIgnoreCase) < 0) continue;
                if (++n > 40) { sb.Append("\n   ..."); break; }
                sb.Append($"\n   {Ruta(go.transform)} activo={go.activeSelf}/{go.activeInHierarchy} en {go.transform.position}");
                var rb = go.GetComponent<Rigidbody>();
                if (rb != null)
                {
                    sb.Append($" rb(cinemático={rb.isKinematic} durmiendo={rb.IsSleeping()} vel={rb.velocity})");
                    // lo que tiene abajo (si se está cayendo: ¿hay suelo y no lo frena, o no hay?)
                    var abajo = Physics.RaycastAll(go.transform.position + Vector3.up * 0.5f, Vector3.down, 60, Physics.AllLayers, QueryTriggerInteraction.Collide);
                    System.Array.Sort(abajo, (x, y) => x.distance.CompareTo(y.distance));
                    for (int i = 0; i < abajo.Length && i < 3; i++)
                        if (abajo[i].collider.gameObject != go)
                            sb.Append($"\n      abajo {abajo[i].distance:F2} m: {Ruta(abajo[i].collider.transform)} [{abajo[i].collider.GetType().Name} capa={abajo[i].collider.gameObject.layer}{(abajo[i].collider.isTrigger ? " trigger" : "")}] (mi capa {go.layer}, chocan={!Physics.GetIgnoreLayerCollision(go.layer, abajo[i].collider.gameObject.layer)})");
                }
                foreach (var c in go.GetComponents<Collider>()) sb.Append($" {c.GetType().Name}({(c.enabled ? "sí" : "no")}{(c.isTrigger ? ",trigger" : "")})");
                if (comp == null) continue;
                foreach (var c in go.GetComponents<Component>())
                {
                    if (c == null || c.GetType().Name != comp) continue;
                    for (var t = c.GetType(); t != null && t != typeof(MonoBehaviour); t = t.BaseType)
                        foreach (var f in t.GetFields(System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.DeclaredOnly))
                        {
                            var v = f.GetValue(c);
                            var texto = v is System.Collections.ICollection col ? $"[{col.Count}]" : v?.ToString();
                            sb.Append($"\n      {f.Name}={texto}");
                        }
                }
            }
            return sb.ToString();
        }

        // punto:x,z: lo que hay en esa vertical (renderers y colisionadores, activos o no): qué suelo
        // tendría que estar y si su colisionador está en la física
        public static string Punto(string arg)
        {
            var v = arg.Split(',');
            float x = float.Parse(v[0], System.Globalization.CultureInfo.InvariantCulture);
            float z = float.Parse(v[1], System.Globalization.CultureInfo.InvariantCulture);
            var sb = new StringBuilder($"punto {x},{z}:");
            int n = 0;
            foreach (var r in Resources.FindObjectsOfTypeAll<Renderer>())
            {
                if (!r.gameObject.scene.IsValid() || r is ParticleSystemRenderer) continue;
                var b = r.bounds;
                if (x < b.min.x || x > b.max.x || z < b.min.z || z > b.max.z || b.size.x > 2000) continue;
                if (++n > 30) { sb.Append("\n   ..."); break; }
                var cols = string.Join(",", r.GetComponents<Collider>().Select(Colisionador));
                sb.Append($"\n   {Ruta(r.transform)} activo={r.gameObject.activeInHierarchy} y={b.min.y:F1}..{b.max.y:F1} [{cols}]");
            }
            foreach (var c in Resources.FindObjectsOfTypeAll<Collider>())
            {
                if (!c.gameObject.scene.IsValid() || c.GetComponent<Renderer>() != null) continue;
                var b = c.bounds;
                if (b.size == Vector3.zero || x < b.min.x || x > b.max.x || z < b.min.z || z > b.max.z || b.size.x > 2000) continue;
                if (++n > 50) { sb.Append("\n   ..."); break; }
                sb.Append($"\n   colisionador {Ruta(c.transform)} {c.GetType().Name} activo={c.gameObject.activeInHierarchy} habilitado={c.enabled} trigger={c.isTrigger} y={b.min.y:F1}..{b.max.y:F1}");
            }
            foreach (var t in Resources.FindObjectsOfTypeAll<Terrain>())
                if (t.gameObject.scene.IsValid())
                    sb.Append($"\n   terreno {Ruta(t.transform)} activo={t.gameObject.activeInHierarchy} en {t.transform.position} tamaño={t.terrainData?.size}");
            return sb.ToString();
        }

        // el estado de un colisionador por dentro: si está en PhysX y con qué
        static string Colisionador(Collider c)
        {
            var mc = c as MeshCollider;
            var malla = mc?.malla;
            return $"{c.GetType().Name}({(c.enabled ? "sí" : "no")} montado={c.montado} forma={c.forma}" +
                (mc != null ? $" malla={malla?.name} v={malla?.vertexCount} convexo={mc.convexo}" : "") + ")";
        }

        // rayo:x,y,z: todo lo que toca un rayo hacia abajo desde ahí (activos, triggers incluidos)
        public static string Rayo(string arg)
        {
            var v = arg.Split(',').Select(x => float.Parse(x, System.Globalization.CultureInfo.InvariantCulture)).ToArray();
            var desde = new Vector3(v[0], v[1], v[2]);
            var golpes = Physics.RaycastAll(desde, Vector3.down, 200, Physics.AllLayers, QueryTriggerInteraction.Collide);
            System.Array.Sort(golpes, (a, b) => a.distance.CompareTo(b.distance));
            var sb = new StringBuilder($"rayo desde {desde}: {golpes.Length} golpes");
            foreach (var g in golpes) sb.Append($"\n   {g.distance:F2} m: {Ruta(g.collider.transform)} [{Colisionador(g.collider)}]");
            return sb.ToString();
        }

        // rayomalla:x,y,z: el rayo hacia abajo contra los triángulos de colisión tal como los tiene el
        // motor (sin PhysX): si acá pega y en rayo: no, el problema está al armar la forma en PhysX
        public static string RayoMalla(string arg)
        {
            var v = arg.Split(',').Select(x => float.Parse(x, System.Globalization.CultureInfo.InvariantCulture)).ToArray();
            var o = new Vector3(v[0], v[1], v[2]);
            var sb = new StringBuilder($"rayomalla desde {o}:");
            foreach (var c in UnityEngine.Object.FindObjectsOfType<MeshCollider>())
            {
                var b = c.bounds;
                if (o.x < b.min.x || o.x > b.max.x || o.z < b.min.z || o.z > b.max.z || c.malla == null) continue;
                var pos = c.malla.PosicionesFisica();
                var tri = pos == null ? null : c.malla.TriangulosFisica(pos.Length / 3);
                if (tri == null) { sb.Append($"\n   {Ruta(c.transform)}: sin datos"); continue; }
                var M = c.transform.localToWorldMatrix;
                float mejor = float.PositiveInfinity; int caras = 0;
                Vector3 P(uint i) => M.MultiplyPoint3x4(new Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
                for (int t = 0; t + 2 < tri.Length; t += 3)
                {
                    Vector3 a = P(tri[t]), bb = P(tri[t + 1]), cc = P(tri[t + 2]);
                    // Möller–Trumbore con la dirección (0,-1,0), las dos caras
                    var e1 = bb - a; var e2 = cc - a; var d = Vector3.down;
                    var h = Vector3.Cross(d, e2); float det = Vector3.Dot(e1, h);
                    if (Mathf.Abs(det) < 1e-9f) continue;
                    float f = 1 / det; var s0 = o - a; float u = f * Vector3.Dot(s0, h);
                    if (u < 0 || u > 1) continue;
                    var q = Vector3.Cross(s0, e1); float w = f * Vector3.Dot(d, q);
                    if (w < 0 || u + w > 1) continue;
                    float dist = f * Vector3.Dot(e2, q);
                    if (dist < 0) continue;
                    caras++;
                    if (dist < mejor) mejor = dist;
                }
                sb.Append($"\n   {Ruta(c.transform)} ({c.malla.name}, {pos.Length / 3} v, {tri.Length / 3} tri): {caras} cruces, el primero a {mejor:F2} m");
            }
            return sb.ToString();
        }

        // estatico:Tipo.Miembro[:Generico]: el valor de un estático en cada ensamblado que tenga ese
        // tipo (dos copias de un tipo son dos singletons distintos). Con :Generico, el miembro es del
        // tipo genérico cerrado con Tipo (por ej. estatico:SystemContext.Instance:SRSingleton`1)
        public static string Estatico(string arg)
        {
            var partes = arg.Split(':');
            var punto = partes[0].LastIndexOf('.');
            string tipo = partes[0].Substring(0, punto), miembro = partes[0].Substring(punto + 1);
            var sb = new StringBuilder("estatico " + arg + ":");
            foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
            {
                Type t;
                try { t = asm.GetType(tipo); } catch { continue; }
                if (t == null) continue;
                var donde = t;
                if (partes.Length > 1)
                {
                    var g = AppDomain.CurrentDomain.GetAssemblies().Select(a => { try { return a.GetType(partes[1]); } catch { return null; } }).FirstOrDefault(x => x != null);
                    if (g == null) { sb.Append($"\n   no encuentro {partes[1]}"); continue; }
                    donde = g.MakeGenericType(t);
                }
                const System.Reflection.BindingFlags F = System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.FlattenHierarchy;
                object v;
                try
                {
                    var pr = donde.GetProperty(miembro, F);
                    v = pr != null ? pr.GetValue(null) : donde.GetField(miembro, F)?.GetValue(null);
                }
                catch (Exception e) { v = "error: " + (e.InnerException ?? e).Message; }
                var uo = v as UnityEngine.Object;
                var texto = v == null ? "null" : uo is null ? v.ToString() : $"{v.GetType().Name} \"{uo.name}\" destruido={uo.destruido} id={uo.GetInstanceID()}";
                sb.Append($"\n   {asm.GetName().Name} ({asm.GetHashCode()}): {donde.Name}.{miembro} = {texto}");
            }
            return sb.ToString();
        }

        // jugador: dónde está, la plata, salud/energía/radiación, lo que lleva en la aspiradora y la hora
        // del juego (SceneContext de Slime Rancher, por reflexión): para comprobar una prueba de juego
        // (aspirar, disparar, vender, guardar y cargar) sin depender de lo que se ve en la captura
        public static string Jugador()
        {
            var asm = AppDomain.CurrentDomain.GetAssemblies().FirstOrDefault(a => a.GetName().Name == "Assembly-CSharp");
            var tSc = asm?.GetType("SceneContext");
            if (tSc == null) return "jugador: no está el juego";
            var sc = asm.GetType("SRSingleton`1").MakeGenericType(tSc).GetProperty("Instance").GetValue(null);
            if (sc == null || (sc is UnityEngine.Object u && u == null)) return "jugador: no hay SceneContext (¿en el menú?)";
            object P(object o, string n) => o?.GetType().GetProperty(n)?.GetValue(o);
            object M(object o, string n, params object[] a) => o?.GetType().GetMethod(n, a.Select(x => x.GetType()).ToArray())?.Invoke(o, a);
            var ps = P(sc, "PlayerState");
            var sb = new StringBuilder("jugador:");
            if (P(sc, "Player") is GameObject g && g != null)
            {
                var p = g.transform.position;
                sb.Append($" en ({p.x:F1}, {p.y:F1}, {p.z:F1}) mirando {g.transform.eulerAngles.y:F0}°");
            }
            if (ps != null)
            {
                sb.Append($"\n   plata {M(ps, "GetCurrency")} | salud {M(ps, "GetCurrHealth")}/{M(ps, "GetMaxHealth")} | energía {M(ps, "GetCurrEnergy")}/{M(ps, "GetMaxEnergy")} | radiación {M(ps, "GetCurrRad")} | modo {M(ps, "GetAmmoMode")}");
                var ammo = P(ps, "Ammo");
                var n = ammo?.GetType().GetField("numSlots", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)?.GetValue(ammo) as int? ?? 0;
                sb.Append($"\n   aspiradora (elegido {M(ammo, "GetSelectedAmmoIdx")}):");
                for (int i = 0; i < n; i++)
                    sb.Append($" [{i}] {M(ammo, "GetSlotName", i)} {M(ammo, "GetSlotCount", i)}/{M(ammo, "GetSlotMaxCount", i)}");
            }
            var td = P(sc, "TimeDirector");
            if (td != null) sb.Append($"\n   día {M(td, "CurrDay")} {M(td, "CurrTimeString")} (tiempo del mundo {M(td, "WorldTime"):F0} s)");
            // lo que el juego lee de la entrada (SRInput: acciones de InControl) y si está en pausa
            var tIn = asm.GetType("SRInput");
            var inst = tIn?.GetProperty("Instance")?.GetValue(null);
            if (inst != null)
            {
                var acc = tIn.GetProperty("Actions")?.GetValue(null);
                float V(string n) => acc?.GetType().GetField(n)?.GetValue(acc) is object a ? Convert.ToSingle(a.GetType().GetProperty("Value")?.GetValue(a) ?? 0f) : float.NaN;
                sb.Append($"\n   entrada {M(inst, "GetInputMode")} | adelante {V("vertical"):F2} costado {V("horizontal"):F2} mirarX {V("lookX"):F2} mirarY {V("lookY"):F2} aspirar {V("vac"):F0} disparar {V("attack"):F0} saltar {V("jump"):F0} | escala del tiempo {Time.timeScale}");
            }
            // los controles táctiles del port de Android (TouchControlsKit): con eso se mueve y mira
            var tck = asm.GetType("TouchControlsKit.TCKInput");
            if (tck != null)
            {
                string Eje(string n) { try { return tck.GetMethod("GetAxis", new[] { typeof(string) })?.Invoke(null, new object[] { n }) is Vector2 v ? $"({v.x:F2}, {v.y:F2})" : "?"; } catch (Exception e) { return "error " + (e.InnerException ?? e).Message; } }
                string R(string n) { var r = ControlesTactiles.Rect(n); return r.Length == 0 ? "no está" : $"({r[0]:F0}, {r[1]:F0}) {r[2]:F0}x{r[3]:F0}"; }
                sb.Append($"\n   táctil: joystick {Eje("Joystick")} en {R("Joystick")} radio {(ControlesTactiles.Rect("Joystick") is var rj && rj.Length > 4 ? rj[4] : 0):F0} | touchpad {Eje("Touchpad")} en {R("Touchpad")} | pantalla {Screen.width}x{Screen.height} | toques {Input.touchCount}");
            }
            return sb.ToString();
        }

        // aspiradora: el estado de WeaponVacuum (modo, lo que está en la zona de aspirado) y, para cada
        // cosa ahí, lo que hace ConsumeVacItem: el rayo de línea de vista desde la boca y si se puede
        // capturar. Para ver dónde se corta cuando no aspira nada
        public static string Aspiradora()
        {
            const System.Reflection.BindingFlags F = System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic;
            var wv = Resources.FindObjectsOfTypeAll<MonoBehaviour>().FirstOrDefault(m => m.GetType().Name == "WeaponVacuum" && m.gameObject.activeInHierarchy);
            if (wv == null) return "aspiradora: no hay WeaponVacuum activo";
            var t = wv.GetType();
            object C(object o, string n) => o?.GetType().GetField(n, F)?.GetValue(o);
            var origen = C(wv, "vacOrigin") as GameObject;
            float maxDist = C(wv, "maxVacDist") is float md ? md : 0;
            var sb = new StringBuilder($"aspiradora: modo {C(wv, "vacMode")} | boca {origen?.transform.position} | alcance {maxDist} | sostenido {C(wv, "held")}");
            var tracker = C(wv, "tracker");
            var dentro = tracker?.GetType().GetMethod("CurrColliders")?.Invoke(tracker, null) as System.Collections.IEnumerable;
            if (dentro == null) return sb.Append(" | sin tracker").ToString();
            foreach (var o in dentro)
            {
                if (!(o is GameObject go) || go == null) continue;
                sb.Append($"\n   en la zona: {Ruta(go.transform)} en {go.transform.position}");
                var vac = go.GetComponents<MonoBehaviour>().FirstOrDefault(m => m.GetType().Name == "Vacuumable");
                if (vac == null) { sb.Append(" (no es aspirable)"); continue; }
                string M(string n) { try { return vac.GetType().GetMethod(n, Type.EmptyTypes)?.Invoke(vac, null)?.ToString() ?? "?"; } catch (Exception e) { return "error " + (e.InnerException ?? e).Message; } }
                sb.Append($" aspirable(habilitado={vac.enabled} capturable={M("canCapture")} cautivo={M("isCaptive")})");
                if (origen == null) continue;
                var desde = origen.transform.position;
                var ray = new Ray(desde, go.transform.position - desde);
                if (Physics.Raycast(ray, out var hit, maxDist, -536887557))
                    sb.Append($"\n      el rayo toca {Ruta(hit.collider.transform)} a {hit.distance:F2} m (cuerpo {(hit.rigidbody != null ? Ruta(hit.rigidbody.transform) : "ninguno")}, capa {hit.collider.gameObject.layer})");
                else sb.Append("\n      el rayo no toca nada");
            }
            return sb.ToString();
        }

        // crear:PINK_SLIME[,n[,distancia]]: n actores del juego (Identifiable.Id) delante del jugador, como
        // los crea el juego (LookupDirector.GetPrefab + SRBehaviour.InstantiateActor): para probar
        // aspirar, disparar, alimentar o vender sin ir a buscarlos. Con @Componente en vez de la
        // distancia, encima del primer objeto que lo tenga (crear:PINK_PLORT,1,@ScorePlort: en el
        // mercado)
        public static string Crear(string arg)
        {
            var p = arg.Split(',');
            var ci = System.Globalization.CultureInfo.InvariantCulture;
            int n = p.Length > 1 ? int.Parse(p[1], ci) : 1;
            string sobre = p.Length > 2 && p[2].StartsWith("@") ? p[2].Substring(1) : null;
            float dist = p.Length > 2 && sobre == null ? float.Parse(p[2], ci) : 4f;
            var asm = AppDomain.CurrentDomain.GetAssemblies().FirstOrDefault(a => a.GetName().Name == "Assembly-CSharp");
            var tId = asm?.GetType("Identifiable+Id");
            if (tId == null) return "crear: no está el juego";
            var id = Enum.Parse(tId, p[0], true);
            var tGc = asm.GetType("GameContext");
            var gc = asm.GetType("SRSingleton`1").MakeGenericType(tGc).GetProperty("Instance").GetValue(null);
            var lookup = tGc.GetProperty("LookupDirector").GetValue(gc);
            var prefab = lookup.GetType().GetMethod("GetPrefab", new[] { tId }).Invoke(lookup, new[] { id }) as GameObject;
            if (prefab == null) return "crear: no hay prefab para " + p[0];
            var cam = Camera.main;
            if (cam == null) return "crear: no hay cámara";
            var inst = asm.GetType("SRBehaviour").GetMethod("InstantiateActor", new[] { typeof(GameObject), typeof(Vector3), typeof(Quaternion), typeof(bool) });
            var sb = new StringBuilder($"crear {p[0]}:");
            var adelante = Vector3.ProjectOnPlane(cam.transform.forward, Vector3.up).normalized;
            Vector3? encima = null;
            if (sobre != null)
            {
                var mb = Resources.FindObjectsOfTypeAll<MonoBehaviour>().FirstOrDefault(m => m.GetType().Name == sobre && m.gameObject.activeInHierarchy);
                if (mb == null) return "crear: no hay ningún " + sobre + " activo";
                var col = mb.GetComponent<Collider>();
                encima = (col != null ? col.bounds.center : mb.transform.position) + Vector3.up * 0.3f;
                sb.Append($" sobre {Ruta(mb.transform)}");
            }
            for (int i = 0; i < n; i++)
            {
                var lugar = encima ?? cam.transform.position + adelante * dist + Vector3.up * (0.5f + i * 1.2f);
                if (encima.HasValue) lugar += Vector3.up * (i * 0.6f);
                var go = inst.Invoke(null, new object[] { prefab, lugar, Quaternion.identity, false }) as GameObject;
                sb.Append(go != null ? $" {go.name} en {lugar}" : " (no se creó)");
            }
            return sb.ToString();
        }

        // ui:x,y: qué tocaría un dedo en ese punto de la pantalla (el raycast del EventSystem de uGUI,
        // que es del juego: por reflexión), con qué módulo de entrada, y cómo están los controles de
        // TouchControlsKit (si el joystick se dio por tocado y con qué dedo)
        public static string Ui(string arg)
        {
            var p = arg.Split(',');
            var ci = System.Globalization.CultureInfo.InvariantCulture;
            float x = p.Length > 1 ? float.Parse(p[0], ci) : 0, y = p.Length > 1 ? float.Parse(p[1], ci) : 0;
            var asmUi = AppDomain.CurrentDomain.GetAssemblies().FirstOrDefault(a => a.GetName().Name == "UnityEngine.UI");
            var tEs = asmUi?.GetType("UnityEngine.EventSystems.EventSystem");
            var es = tEs?.GetProperty("current")?.GetValue(null);
            if (es == null) return "ui: no hay EventSystem";
            var modulo = tEs.GetProperty("currentInputModule")?.GetValue(es);
            var sb = new StringBuilder($"ui ({x}, {y}): EventSystem {((Component)es).name} módulo {modulo?.GetType().Name ?? "ninguno"} | toques {Input.touchCount} ratón {Input.mousePresent}");
            var tPed = asmUi.GetType("UnityEngine.EventSystems.PointerEventData");
            var ped = Activator.CreateInstance(tPed, es);
            tPed.GetProperty("position").SetValue(ped, new Vector2(x, y));
            var tRr = asmUi.GetType("UnityEngine.EventSystems.RaycastResult");
            var lista = Activator.CreateInstance(typeof(System.Collections.Generic.List<>).MakeGenericType(tRr));
            tEs.GetMethod("RaycastAll").Invoke(es, new[] { ped, lista });
            foreach (var r in (System.Collections.IEnumerable)lista)
                if (tRr.GetProperty("gameObject")?.GetValue(r) is GameObject go) sb.Append($"\n   toca {Ruta(go.transform)}");
            const System.Reflection.BindingFlags F = System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.FlattenHierarchy;
            foreach (var mb in Resources.FindObjectsOfTypeAll<MonoBehaviour>())
            {
                var t = mb.GetType();
                if (t.Namespace != "TouchControlsKit" || !mb.gameObject.activeInHierarchy) continue;
                object Campo(string n) { for (var tt = t; tt != null; tt = tt.BaseType) { var f = tt.GetField(n, F); if (f != null) return f.GetValue(mb); } return "?"; }
                sb.Append($"\n   {t.Name} {mb.name}: tocado={Campo("touchDown")} dedo={Campo("touchId")} habilitado={mb.enabled}");
            }
            return sb.ToString();
        }

        public static string Ruta(Transform t) => t.parent == null ? t.name : Ruta(t.parent) + "/" + t.name;

        // los Animator (los que empiezan con arg): con qué controlador, en qué clip y si los mueve una
        // Timeline. Un Animator que sigue escribiendo la pose pisa lo que el juego pone a mano
        public static string Animadores(string arg)
        {
            var sb = new StringBuilder("animadores:");
            foreach (var a in UnityEngine.Object.FindObjectsOfType<Animator>())
            {
                if (arg.Length > 0 && !a.name.StartsWith(arg)) continue;
                var clip = a.GetCurrentAnimatorClipInfo(0);
                sb.Append($"\n   {Ruta(a.transform)} habilitado={a.enabled} controlador={a.runtimeAnimatorController?.name} " +
                          $"clip={(clip.Length > 0 ? clip[0].clip?.name : "-")} raiz={a.applyRootMotion} timeline={a.hasBoundPlayables} pos={a.transform.position} rot={a.transform.eulerAngles}");
            }
            return sb.ToString();
        }

        // los textos que se ven (TextMeshPro y UI.Text, por reflexión): qué diálogo está en pantalla
        public static string Textos()
        {
            var sb = new StringBuilder("textos:");
            foreach (var c in UnityEngine.Object.FindObjectsOfType<Behaviour>())
            {
                var t = c.GetType();
                if (!c.isActiveAndEnabled || !(t.Name.Contains("TextMeshPro") || t.Name == "Text")) continue;
                var s = t.GetProperty("text")?.GetValue(c) as string;
                if (string.IsNullOrWhiteSpace(s)) continue;
                var limpio = new StringBuilder();   // sin las etiquetas de texto enriquecido
                bool enEtiqueta = false;
                foreach (var ch in s) { if (ch == '<') enEtiqueta = true; else if (ch == '>') enEtiqueta = false; else if (!enEtiqueta) limpio.Append(ch == '\n' ? ' ' : ch); }
                s = limpio.ToString();
                sb.Append($"\n   {Ruta(c.transform)}: \"{(s.Length > 70 ? s.Substring(0, 70) + "…" : s)}\"");
            }
            return sb.ToString();
        }

        // los materiales de los renderers cuya ruta contiene arg: shader, palabras clave, lightmap y
        // texturas (con su formato): para ver por qué algo sale oscuro o de otro color
        public static string Materiales(string arg)
        {
            var sb = new StringBuilder("materiales:");
            int n = 0;
            foreach (var r in UnityEngine.Object.FindObjectsOfType<Renderer>())
            {
                var ruta = Ruta(r.transform);
                if (arg.Length > 0 && !ruta.Contains(arg)) continue;
                if (++n > 30) break;
                sb.Append($"\n   {ruta} lm={r.lightmapIndex} {r.GetType().Name}");
                foreach (var m in r.sharedMaterials)
                {
                    if (m == null) continue;
                    sb.Append($"\n      {m.name} shader={m.shader?.name} claves=[{string.Join(" ", m.shaderKeywords)}]");
                    if (m.shader == null) continue;
                    foreach (var p in m.shader.propiedades)
                    {
                        if (p.Tipo == 4 && m.GetTexture(p.Nombre) is Texture t)
                            sb.Append($" {p.Nombre}={t.name}({(t as Texture2D)?.format} {t.width}x{t.height})");
                        else if (p.Tipo == 0 || p.Tipo == 1) sb.Append($" {p.Nombre}={m.GetVector(p.Nombre)}");
                        else if (p.Tipo == 2 || p.Tipo == 3) sb.Append($" {p.Nombre}={m.GetFloat(p.Nombre)}");
                    }
                }
            }
            return sb.ToString();
        }

        // las luces activas y, con un texto, las que el forward le da a cada renderer cuya ruta lo
        // contiene (la principal, las por píxel y las por vértice): para entender por qué algo sale
        // oscuro o quemado
        public static string Luces(string arg)
        {
            var sb = new StringBuilder("luces:");
            foreach (var l in Porteo.Render.Luces.activas)
                sb.Append($"\n   {Ruta(l.transform)} {l.tipo} pos={l.transform.position} rango={l.rango:G4} intensidad={l.intensidad:G4} color={l.colorLuz} modo={l.modo} sombras={l.sombraTipo} horneado={l.horneado} máscara={l.mascara:X}");
            if (arg.Length == 0) return sb.ToString();
            // la grilla de luces se arma al dibujar cada cámara; la prueba de consola no dibuja (y
            // entre cuadros rearmarla no molesta: el próximo cuadro la vuelve a armar)
            Porteo.Render.LucesObjeto.Empezar(Camera.main);
            int n = 0;
            foreach (var r in UnityEngine.Object.FindObjectsOfType<Renderer>())
            {
                var ruta = Ruta(r.transform);
                if (!ruta.Contains(arg) || ++n > 10) continue;
                var b = r.bounds;
                var c = Porteo.Render.LucesObjeto.Config(Porteo.Render.LucesObjeto.Para(r, b));
                sb.Append($"\n   {ruta} caja={b.center}±{b.extents} principal={c.Principal?.name}");
                for (int i = 0; i < c.NPixel; i++) sb.Append($"\n      píxel {c.Pixel[i].name} {c.Pixel[i].transform.position}");
                for (int i = 0; i < c.NVertice; i++) sb.Append($"\n      vértice {c.Vertice[i].name} {c.Vertice[i].transform.position}");
            }
            return sb.ToString();
        }

        // los campos de cada objeto de un tipo (por nombre, MonoBehaviour o ScriptableObject), por
        // reflexión y hasta 4 niveles: lo que un perfil de posproceso o un efecto tiene cargado
        public static string Campos(string arg)
        {
            var sb = new StringBuilder("campos:");
            foreach (var o in Resources.FindObjectsOfTypeAll<UnityEngine.Object>())
                if (o.GetType().Name == arg)
                {
                    sb.Append($"\n   {(o is Component c ? Ruta(c.transform) : o.name)}:");
                    CamposDe(o, sb, 2, 0, new HashSet<object>(ReferenceEqualityComparer.Instance));
                }
            return sb.ToString();
        }

        static void CamposDe(object o, StringBuilder sb, int sangria, int nivel, HashSet<object> vistos)
        {
            if (o == null || nivel > 4 || !vistos.Add(o)) return;
            const System.Reflection.BindingFlags F = System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic;
            for (var t = o.GetType(); t != null && t != typeof(MonoBehaviour) && t != typeof(ScriptableObject) && t != typeof(object); t = t.BaseType)
                foreach (var f in t.GetFields(F | System.Reflection.BindingFlags.DeclaredOnly))
                {
                    if (f.IsStatic || f.Name.Contains("k__BackingField") && !f.FieldType.IsValueType) continue;
                    object v;
                    try { v = f.GetValue(o); } catch { continue; }
                    sb.Append('\n').Append(' ', sangria * 3).Append(f.Name).Append(" = ");
                    switch (v)
                    {
                        case null: sb.Append("null"); break;
                        case UnityEngine.Object uo: sb.Append(uo ? $"{uo.GetType().Name} {uo.name}" : "null (destruido)"); break;
                        case string s: sb.Append('"').Append(s).Append('"'); break;
                        case System.Collections.IList l when !(v is Array a && a.Rank > 1):
                            sb.Append($"[{l.Count}]");
                            for (int i = 0; i < Math.Min(l.Count, 12); i++)
                            {
                                var e = l[i];
                                if (e == null || e.GetType().IsPrimitive || e is UnityEngine.Object || e.GetType().IsEnum) sb.Append(' ').Append(e is UnityEngine.Object eo ? eo.name : e);
                                else { sb.Append('\n').Append(' ', (sangria + 1) * 3).Append($"[{i}] {e.GetType().Name}"); CamposDe(e, sb, sangria + 2, nivel + 1, vistos); }
                            }
                            break;
                        default:
                            var tv = v.GetType();
                            if (tv.IsPrimitive || tv.IsEnum || tv.Namespace == "UnityEngine") sb.Append(v);
                            else { sb.Append(tv.Name); CamposDe(v, sb, sangria + 1, nivel + 1, vistos); }
                            break;
                    }
                }
        }

        // las listas desplegables (Dropdown y TMP_Dropdown, por reflexión): sus opciones en orden
        public static string Desplegables()
        {
            var sb = new StringBuilder("desplegables:");
            foreach (var c in Resources.FindObjectsOfTypeAll<MonoBehaviour>())
            {
                var t = c.GetType();
                if (t.Name != "TMP_Dropdown" && t.Name != "Dropdown") continue;
                sb.Append($"\n   {Ruta(c.transform)} valor={t.GetProperty("value")?.GetValue(c)}:");
                if (t.GetProperty("options")?.GetValue(c) is System.Collections.IEnumerable ops)
                {
                    int i = 0;
                    foreach (var o in ops) sb.Append($" {i++}={o.GetType().GetProperty("text")?.GetValue(o)}");
                }
            }
            return sb.ToString();
        }

        // cada señal de Timeline a la consola (la prueba de consola: "senales")
        public static bool VerSenales { get => Porteo.Playables.Grafo.VerAvisos; set => Porteo.Playables.Grafo.VerAvisos = value; }

        // las Timeline que están corriendo: dónde van (una que no avanza deja al juego esperando) y,
        // con "directores:marcas", las señales de cada pista (por reflexión: Timeline es del juego)
        public static string Directores(string arg = "")
        {
            var sb = new StringBuilder("directores:");
            foreach (var d in Porteo.Playables.Directores.activos)
            {
                sb.Append($"\n   {Ruta(d.transform)} asset={d.playableAsset?.name} estado={d.state} t={d.time:F3}/{d.duration:F3} envolver={d.extrapolationMode}");
                if (arg != "marcas" || d.playableAsset == null) continue;
                var pistas = d.playableAsset.GetType().GetMethod("GetOutputTracks")?.Invoke(d.playableAsset, null) as System.Collections.IEnumerable;
                if (pistas == null) continue;
                foreach (var p in pistas)
                {
                    var marcas = p.GetType().GetMethod("GetMarkers")?.Invoke(p, null) as System.Collections.IEnumerable;
                    if (marcas == null) continue;
                    foreach (var mk in marcas)
                    {
                        var t = mk.GetType().GetProperty("time")?.GetValue(mk);
                        sb.Append($"\n      pista {(p as UnityEngine.Object)?.name}: {mk.GetType().Name} t={t}");
                    }
                }
            }
            return sb.ToString();
        }

        static Transform Buscar(string nombre) =>
            Resources.FindObjectsOfTypeAll<Transform>().Where(t => t.gameObject.scene.IsValid())
                .OrderByDescending(t => t.gameObject.activeInHierarchy).FirstOrDefault(t => t.name == nombre);

        public static string Jerarquia(string nombre)
        {
            var raiz = Buscar(nombre);
            if (raiz == null) return "jerarquia: no está " + nombre;
            var sb = new StringBuilder();
            void Arbol(Transform t, string sangria)
            {
                var comps = string.Join(",", t.GetComponents<Component>().Select(c => c.GetType().Name).Where(n => n != "Transform"));
                sb.Append($"\njerarquia {sangria}{t.name} activo={t.gameObject.activeSelf} local={t.localPosition} rot={t.localEulerAngles} esc={t.localScale} mundo={t.position} capa={t.gameObject.layer} [{comps}]");
                if (sangria.Length < 16) foreach (Transform h in t) Arbol(h, sangria + "  ");
            }
            Arbol(raiz, "");
            return sb.ToString();
        }

        public static string Cerca(float radio)
        {
            var cam = Camera.main;
            if (cam == null) return "cerca: no hay cámara principal";
            var sb = new StringBuilder($"cerca: cámara {cam.name} en {cam.transform.position}");
            foreach (var r in UnityEngine.Object.FindObjectsOfType<Renderer>())
            {
                if (!r.enabled) continue;
                float d = Vector3.Distance(r.bounds.center, cam.transform.position);
                if (d > radio) continue;
                var mats = string.Join(", ", r.sharedMaterials.Select(m => m == null ? "null" : $"{m.name} [{m.shader?.name}] cola={m.renderQueue}"));
                sb.Append($"\n   {r.GetType().Name} {Ruta(r.transform)} d={d:F1} límites={r.bounds.size} capa={r.gameObject.layer} :: {mats}");
            }
            return sb.ToString();
        }

        // la escena activa por arriba: raíces, canvases (modo, cámara, orden) y lo que muestran las
        // RawImage y las cámaras que dibujan en texturas
        public static string Escena()
        {
            var sb = new StringBuilder("escena " + UnityEngine.SceneManagement.SceneManager.GetActiveScene().name + ":");
            foreach (var go in UnityEngine.SceneManagement.SceneManager.GetActiveScene().GetRootGameObjects())
                sb.Append($"\n   raíz {go.name} activo={go.activeInHierarchy} [{string.Join(",", go.GetComponents<Component>().Select(c => c.GetType().Name).Where(n => n != "Transform"))}]");
            foreach (var c in Resources.FindObjectsOfTypeAll<Canvas>())
            {
                if (!c.gameObject.scene.IsValid()) continue;
                var rt = c.transform as RectTransform;
                sb.Append($"\n   canvas {Ruta(c.transform)} activo={c.isActiveAndEnabled} raíz={c.isRootCanvas} modo={c.renderMode} cámara={c.worldCamera?.name} orden={c.sortingOrder} plano={c.planeDistance} tam={rt?.rect.size} escala={c.transform.lossyScale}");
            }
            foreach (var mb in Resources.FindObjectsOfTypeAll<MonoBehaviour>())
            {
                if (!mb.gameObject.scene.IsValid() || mb.GetType().Name != "RawImage") continue;
                var tex = mb.GetType().GetProperty("texture")?.GetValue(mb) as Texture;
                var rt = mb.transform as RectTransform;
                sb.Append($"\n   rawimage {Ruta(mb.transform)} activo={mb.isActiveAndEnabled} textura={tex?.name} {tex?.width}x{tex?.height} rect={rt?.rect}");
            }
            foreach (var c in Resources.FindObjectsOfTypeAll<Camera>())
            {
                if (!c.gameObject.scene.IsValid()) continue;
                var efectos = string.Join(",", c.GetComponents<MonoBehaviour>().Select(m => m.GetType().Name));
                sb.Append($"\n   cámara {Ruta(c.transform)} activa={c.isActiveAndEnabled} prof={c.depth} máscara={c.cullingMask:X8} borrar={c.clearFlags} fondo={c.backgroundColor} orto={c.orthographic} destino={c.targetTexture?.name} {c.targetTexture?.width}x{c.targetTexture?.height} rect={c.rect} [{efectos}]");
            }
            return sb.ToString();
        }

        public static string Camaras()
        {
            var sb = new StringBuilder("cámaras:");
            foreach (var c in Camera.allCameras)
                sb.Append($"\n   {Ruta(c.transform)} prof={c.depth} máscara={c.cullingMask:X8} borrar={c.clearFlags} cerca={c.nearClipPlane} lejos={c.farClipPlane} fov={c.fieldOfView} destino={c.targetTexture?.name} en {c.transform.position}");
            return sb.ToString();
        }
    }
}

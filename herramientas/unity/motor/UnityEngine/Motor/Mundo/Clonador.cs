using System;
using System.Collections.Generic;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Porteo
{
    // Instantiate como el de Unity:
    //  · Un GameObject o un componente clona toda la jerarquía de su GameObject y devuelve lo
    //    equivalente en el clon. Las referencias a objetos de esa jerarquía pasan a sus clones; las
    //    de afuera quedan iguales.
    //  · Los scripts se crean con su constructor (corren los inicializadores) y después reciben
    //    los campos serializados del original; los no serializados quedan como los dejó el constructor.
    //  · La raíz del clon arranca sin padre y con los valores locales del original (al nombre se
    //    le agrega "(Clone)"). Con padre: SetParent(padre, instantiateInWorldSpace). Con posición
    //    y rotación: esas, en el mundo.
    //  · Al final se activa: nativos primero y scripts por orden de ejecución (Awake, OnEnable).
    public static class Clonador
    {
        public static Object Instanciar(Object original, Transform padre, bool mundo, (Vector3 pos, Quaternion rot)? ubicacion)
        {
            if ((object)original == null || original.destruido) throw new ArgumentException("The Object you want to instantiate is null.");
            if (padre != null && padre.destruido) padre = null;

            if (original is GameObject || original is Component)
            {
                var goOrig = original as GameObject ?? ((Component)original).go;
                var mapa = new Dictionary<Object, Object>(ReferenceEqualityComparer.Instance);
                var orden = new List<(Object orig, Object clon)>();
                var raiz = Esqueleto(goOrig, mapa, orden);
                Func<Object, Object> remap = o => (object)o != null && mapa.TryGetValue(o, out var x) ? x : o;
                foreach (var (o, c) in orden)
                {
                    if (o is MonoBehaviour mo)
                    {
                        ((MonoBehaviour)c).habilitado = mo.habilitado;
                        try { Datos.Serial.Copiar(o, c, remap); }
                        catch (Exception e) { Debug.LogException(e, o); }
                    }
                    else if (!(o is GameObject))
                    {
                        try { c.CopiarDe(o, remap); }
                        catch (Exception e) { Debug.LogException(e, o); }
                    }
                }
                raiz.m_Name = goOrig.m_Name + "(Clone)";
                Ubicar(raiz, padre, mundo, ubicacion);
                Activar(raiz);
                var r = mapa[original];
                if (r.destruido) throw new UnityException("Instantiate failed because the clone was destroyed during creation. This can happen if DestroyImmediate is called in MonoBehaviour.Awake.");
                return r;
            }

            if (original is ScriptableObject so)
            {
                var c = (ScriptableObject)Instancias.Crear(so.GetType());
                Datos.Serial.Copiar(so, c, o => o);
                c.m_Name = so.m_Name + "(Clone)";
                Activacion.DespertarScriptable(c);
                return c;
            }

            var a = original.ClonarAsset();
            if (a == null)
            {
                Debug.LogWarning($"porteo: Instantiate de {original.GetType().Name} todavía no está hecho");
                return null;
            }
            a.m_Name = original.m_Name + "(Clone)";
            return a;
        }

        // los GameObject y componentes vacíos, con la misma estructura
        static GameObject Esqueleto(GameObject o, Dictionary<Object, Object> mapa, List<(Object, Object)> orden)
        {
            var go = new GameObject(true)
            {
                m_Name = o.m_Name, capa = o.capa, etiqueta = o.etiqueta, activoPropio = o.activoPropio, estatico = o.estatico,
            };
            mapa[o] = go;
            orden.Add((o, go));
            foreach (var c in o.componentes)
            {
                if (c.destruido) continue;
                Component n;
                if (c is Transform t)
                {
                    n = t is RectTransform ? new RectTransform() : new Transform();
                    go.trans = (Transform)n;
                }
                else
                {
                    try { n = (Component)Instancias.Crear(c.GetType()); }
                    catch (Exception e) { Debug.LogException(e.InnerException ?? e, c); continue; }
                }
                n.go = go;
                go.componentes.Add(n);
                mapa[c] = n;
                orden.Add((c, n));
            }
            if (go.trans == null) go.AgregarTransform(new Transform());
            foreach (var h in o.trans.hijos)
            {
                if (h.destruido || h.go == null) continue;
                var hc = Esqueleto(h.go, mapa, orden);
                hc.trans.padre = go.trans;
                go.trans.hijos.Add(hc.trans);
            }
            return go;
        }

        static void Ubicar(GameObject raiz, Transform padre, bool mundo, (Vector3 pos, Quaternion rot)? ubicacion)
        {
            var rt = raiz.trans;
            var escena = padre != null ? padre.go.escena : Escenas.Activa;
            Marcar(raiz, escena);
            if (padre != null)
            {
                if (mundo && ubicacion == null)
                {
                    // los valores locales del original quedan como posición en el mundo
                    Vector3 pos = rt.posLocal, esc = rt.escLocal; Quaternion rot = rt.rotLocal;
                    rt.padre = padre;
                    padre.hijos.Add(rt);
                    rt.posLocal = padre.InverseTransformPoint(pos);
                    rt.rotLocal = Quaternion.Normalize(Quaternion.Inverse(padre.rotation) * rot);
                    var pe = padre.lossyScale;
                    rt.escLocal = new Vector3(pe.x != 0 ? esc.x / pe.x : 0, pe.y != 0 ? esc.y / pe.y : 0, pe.z != 0 ? esc.z / pe.z : 0);
                }
                else
                {
                    rt.padre = padre;
                    padre.hijos.Add(rt);
                }
            }
            else Escenas.AgregarRaiz(rt);
            rt.Ensuciar();
            if (ubicacion is (Vector3 p, Quaternion q)) rt.SetPositionAndRotation(p, q);
            if (padre != null) Jerarquia.HijosCambiados(padre);
        }

        static void Marcar(GameObject go, Escena e)
        {
            go.escena = e;
            foreach (var h in go.trans.hijos) Marcar(h.go, e);
        }

        static void Activar(GameObject raiz)
        {
            var p = raiz.trans.padre;
            bool padreActivo = p == null || p.go.activoEnJerarquia;
            var activos = new List<GameObject>();
            Juntar(raiz, padreActivo, activos);
            if (activos.Count > 0) Activacion.DespertarGrupo(activos);
        }

        static void Juntar(GameObject go, bool padreActivo, List<GameObject> l)
        {
            go.activoEnJerarquia = padreActivo && go.activoPropio && go.escena != null;
            if (!go.activoEnJerarquia) return;
            l.Add(go);
            foreach (var h in go.trans.hijos) Juntar(h.go, true, l);
        }
    }
}

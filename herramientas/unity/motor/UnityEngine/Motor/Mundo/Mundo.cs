using System;
using System.Collections.Generic;
using Porteo.Datos;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Porteo
{
    // El bucle de cada cuadro, en el orden del PlayerLoop de Unity 2018.4:
    //   EarlyUpdate  entrada, cargas de escena pendientes, Start pendientes, Invoke
    //   FixedUpdate  (0..n pasos) FixedUpdate de scripts, física, WaitForFixedUpdate, Start
    //   PreUpdate    eventos del mouse sobre colisionadores
    //   Update       Update de scripts; después corrutinas (null, WaitForSeconds), Invoke, Start
    //   PreLateUpdate animación; LateUpdate de scripts
    //   PostLateUpdate canvases, partículas, audio, render, WaitForEndOfFrame
    // Los Destroy diferidos se ejecutan después de cada fase de scripts (siempre antes de dibujar).
    public static class Mundo
    {
        // lo que agregan los demás sistemas del motor
        public static Action AlEmpezarCuadro;        // entrada
        public static Action AntesDeFixedUpdate;     // animaciones en modo física
        public static Action<float> PasoFisica;      // simular un paso fijo (y mandar sus mensajes)
        public static Action TrasFixedUpdate;
        public static Action PreUpdate;              // mouse sobre colisionadores, interpolación
        public static Action AntesDeLateUpdate;      // Animator y Animation
        public static Action AntesDeDibujar;         // canvases, partículas, audio
        public static Action Dibujar;                // cámaras
        public static Action AlTerminarCuadro;       // entrada (fin de cuadro)

        static bool primerCuadro = true;

        // los datos que hacen falta antes de empezar (Resources, shaders siempre incluidos)
        internal static Espera Arranque;

        public static void Cuadro(double dtReal)
        {
            // mientras llegan los datos de una carga que en Unity bloquearía, no corre nada
            if (Arranque != null) { if (!Arranque.Lista) return; Arranque = null; }
            if (Escenas.Esperando) return;

            // ── tiempo ──
            if (dtReal < 0) dtReal = 0;
            float real = (float)dtReal;
            if (primerCuadro) { real = Time.dtFijo; primerCuadro = false; }
            Time.dtSinEscala = real;
            Time.tSinEscala += real;
            float dt = Math.Min(real, Time.maxDt) * Time.escala;
            Time.dt = dt;
            Time.t += dt;
            Time.dtSuave = Time.cuadros == 0 ? dt : Time.dtSuave + (dt - Time.dtSuave) * 0.2f;
            Time.cuadros++;

            long t0 = Medidor.Ahora();
            // ── EarlyUpdate ──
            Llamar(AlEmpezarCuadro);
            Escenas.ProcesarPedidos();
            Activacion.ArrancarPendientes();
            Invocaciones.Procesar();

            long t1 = Medidor.Ahora();
            // ── FixedUpdate ──
            if (Time.dtFijo > 0)
            {
                int pasos = 0;
                while (Time.tFijo + Time.dtFijo <= Time.t + 1e-5f && pasos < 32)
                {
                    pasos++;
                    Time.enPasoFijo = true;
                    Time.tFijo += Time.dtFijo;
                    Llamar(AntesDeFixedUpdate);
                    Ciclo.FixedUpdate.Correr();
                    ProcesarDestrucciones();
                    PasoFisica?.Invoke(Time.dtFijo);
                    Corrutinas.TrasPasoFijo();
                    Activacion.ArrancarPendientes();
                    Llamar(TrasFixedUpdate);
                    Time.enPasoFijo = false;
                }
                // si el reloj quedó muy atrás (pestaña en segundo plano), no recuperar todo de golpe
                if (Time.tFijo + Time.dtFijo <= Time.t) Time.tFijo = Time.t;
            }

            long t2 = Medidor.Ahora();
            // ── PreUpdate / Update ──
            Llamar(PreUpdate);
            Ciclo.Update.Correr();
            Corrutinas.TrasUpdate();
            Invocaciones.Procesar();
            Activacion.ArrancarPendientes();
            ProcesarDestrucciones();

            long t3 = Medidor.Ahora();
            // ── LateUpdate ──
            Llamar(AntesDeLateUpdate);
            Ciclo.LateUpdate.Correr();
            ProcesarDestrucciones();

            // ── PostLateUpdate ──
            long t4 = Medidor.Ahora();
            Llamar(AntesDeDibujar);
            long t5 = Medidor.Ahora();
            Llamar(Dibujar);
            long t6 = Medidor.Ahora();
            Corrutinas.FinDeCuadro();
            ProcesarDestrucciones();
            Llamar(AlTerminarCuadro);
            Medidor.Cuadro(t0, t1, t2, t3, t4, t5, t6, Medidor.Ahora());
        }

        static void Llamar(Action a)
        {
            if (a == null) return;
            try { a(); }
            catch (Exception e) { Debug.LogException(e); }
        }

        // ── destruir ──
        static List<(Object o, double hasta)> porDestruir = new List<(Object, double)>(), porDestruirOtra = new List<(Object, double)>();

        public static void DestruirLuego(Object o, float t)
        {
            porDestruir.Add((o, Time.time + Math.Max(0f, t)));
        }

        internal static void ProcesarDestrucciones()
        {
            if (porDestruir.Count == 0) return;
            double ahora = Time.time;
            var l = porDestruir;
            porDestruir = porDestruirOtra;
            porDestruirOtra = l;
            for (int i = 0; i < l.Count; i++)
            {
                var (o, h) = l[i];
                if (o.destruido) continue;
                if (h <= ahora) DestruirYa(o);
                else porDestruir.Add((o, h));
            }
            l.Clear();
        }

        public static void DestruirYa(Object o)
        {
            if ((object)o == null || o.destruido) return;
            switch (o)
            {
                case GameObject go: DestruirObjeto(go); break;
                case Transform t:
                    Debug.LogError($"Can't destroy Transform component of '{t.name}'. If you want to destroy the game object, please call 'Destroy' on the game object instead. Destroying the transform component is not allowed.");
                    break;
                case Component c: DestruirComponente(c); break;
                case ScriptableObject so:
                {
                    var ts = TipoScript.De(so.GetType());
                    if (so.despierto) { Mensajes.Llamar(so, ts.OnDisable); Mensajes.Llamar(so, ts.OnDestroy); }
                    Baja(so);
                    break;
                }
                default: Baja(o); break;
            }
        }

        static void Baja(Object o)
        {
            o.destruido = true;
            try { o.AlLiberar(); } catch (Exception e) { Debug.LogException(e); }
            Registro.Baja(o);
        }

        static void DestruirObjeto(GameObject go)
        {
            if (go.activoEnJerarquia) Activacion.Desactivar(go);
            if (go.destruido) return;   // lo destruyó algún OnDisable
            var t = go.trans;
            var padre = t?.padre;
            if (t != null)
            {
                if (padre != null) padre.hijos.Remove(t);
                else Escenas.QuitarRaiz(t);
            }
            var todos = new List<GameObject>();
            Juntar(go, todos);
            // OnDestroy de todos (del padre hacia los hijos) y después se marcan: durante OnDestroy
            // el resto de la jerarquía todavía existe
            foreach (var g in todos)
                foreach (var c in g.componentes.ToArray())
                    if (!c.destruido) Activacion.QuitarComponente(c);
            foreach (var g in todos)
            {
                foreach (var c in g.componentes) if (!c.destruido) Baja(c);
                if (!g.destruido) Baja(g);
            }
            if (padre != null && !padre.destruido) Jerarquia.HijosCambiados(padre);
        }

        static void Juntar(GameObject go, List<GameObject> l)
        {
            l.Add(go);
            if (go.trans == null) return;
            var hs = go.trans.hijos;
            for (int i = 0; i < hs.Count; i++) if (hs[i].go != null) Juntar(hs[i].go, l);
        }

        static void DestruirComponente(Component c)
        {
            Activacion.QuitarComponente(c);
            c.go?.componentes.Remove(c);
            if (!c.destruido) Baja(c);
        }
    }

    // Los mensajes de cambios en la jerarquía de Transforms.
    public static class Jerarquia
    {
        // a t y todos sus descendientes
        public static void Mensaje(Transform t, string mensaje)
        {
            if (t?.go == null) return;
            Mensajes.Enviar(t.go, mensaje, null, false, SendMessageOptions.DontRequireReceiver);
            var hs = t.hijos;
            for (int i = 0; i < hs.Count; i++) Mensaje(hs[i], mensaje);
        }

        public static void PadreCambiado(Transform t, Transform viejo)
        {
            Mensaje(t, "OnTransformParentChanged");
            Mensaje(t, "OnCanvasHierarchyChanged");
            if (viejo != null && !viejo.destruido) HijosCambiados(viejo);
            if (t.padre != null) HijosCambiados(t.padre);
        }

        public static void HijosCambiados(Transform p)
        {
            if (p?.go != null) Mensajes.Enviar(p.go, "OnTransformChildrenChanged", null, false, SendMessageOptions.DontRequireReceiver);
        }
    }
}

namespace Porteo
{
    // Cuánto tarda cada parte del cuadro (para saber qué optimizar): cada tantos segundos se
    // informa el promedio por cuadro de cada fase.
    public static class Medidor
    {
        public static bool Activo = true;
        public static float Cada = 5f;
        static readonly double[] suma = new double[7];
        static int cuadros;
        static long desde;
        public static int Dibujos, Triangulos;   // los suma Dibujo

        public static long Ahora() => System.Diagnostics.Stopwatch.GetTimestamp();

        internal static void Cuadro(long t0, long t1, long t2, long t3, long t4, long t5, long t6, long t7)
        {
            if (!Activo) return;
            double f = 1000.0 / System.Diagnostics.Stopwatch.Frequency;
            suma[0] += (t1 - t0) * f; suma[1] += (t2 - t1) * f; suma[2] += (t3 - t2) * f; suma[3] += (t4 - t3) * f;
            suma[4] += (t5 - t4) * f; suma[5] += (t6 - t5) * f; suma[6] += (t7 - t0) * f;
            cuadros++;
            if (desde == 0) desde = t0;
            if ((t7 - desde) * f < Cada * 1000) return;
            double n = cuadros, seg = (t7 - desde) * f / 1000;
            Anfitrion.Consola?.Invoke($"porteo: {n / seg:F1} cuadros/s | por cuadro (ms): inicio {suma[0] / n:F1}, fijo {suma[1] / n:F1}, update {suma[2] / n:F1}, late {suma[3] / n:F1}, canvas {suma[4] / n:F1}, dibujo {suma[5] / n:F1}, total {suma[6] / n:F1} | {Dibujos / n:F0} dibujos, {Triangulos / n / 1000:F0}k triángulos", UnityEngine.LogType.Log);
            Array.Clear(suma, 0, suma.Length);
            cuadros = 0; Dibujos = 0; Triangulos = 0;
            desde = t7;
        }
    }
}


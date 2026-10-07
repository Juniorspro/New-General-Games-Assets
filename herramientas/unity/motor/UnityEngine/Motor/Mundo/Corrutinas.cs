using System;
using System.Collections;
using System.Collections.Generic;
using System.Reflection;
using UnityEngine;

namespace Porteo
{
    // Corrutinas como las de Unity:
    //  · StartCoroutine corre el primer tramo en el momento.
    //  · null (o cualquier valor sin significado especial): sigue el cuadro siguiente, después de Update.
    //  · WaitForSeconds: después de Update, cuando Time.time llega (tiempo escalado).
    //  · WaitForFixedUpdate: después del paso de física; WaitForEndOfFrame: al final del cuadro.
    //  · Un Coroutine o un IEnumerator (también CustomYieldInstruction): espera a que esa termine
    //    y sigue en el mismo momento en que termina.
    //  · AsyncOperation: sigue cuando la operación termina.
    // Desactivar el objeto o destruir el script las corta; deshabilitar el script no.
    public static class Corrutinas
    {
        public sealed class Rutina
        {
            internal MonoBehaviour dueno;
            internal IEnumerator it;
            internal string nombre;        // si se arrancó por nombre (para StopCoroutine(string))
            internal Rutina esperando;     // la anidada que esta espera
            internal Rutina quienEspera;   // la que espera a esta
            internal bool terminada;
            internal Coroutine manija;
            internal double hasta;
            internal int cuadroMin;
            internal AsyncOperation op;
        }

        // las que esperan tiempo (null o WaitForSeconds), en el orden en que se programaron
        static List<Rutina> diferidas = new List<Rutina>(), diferidasOtra = new List<Rutina>();
        static List<Rutina> fijas = new List<Rutina>(), fijasOtra = new List<Rutina>();
        static List<Rutina> finales = new List<Rutina>(), finalesOtra = new List<Rutina>();
        static readonly List<Rutina> operaciones = new List<Rutina>();

        public static int Activas { get; private set; }

        public static Coroutine Iniciar(MonoBehaviour mb, IEnumerator it, string nombre)
        {
            var r = new Rutina { dueno = mb, it = it, nombre = nombre };
            r.manija = new Coroutine(r);
            (mb.rutinas ??= new List<Rutina>()).Add(r);
            Activas++;
            Avanzar(r);
            return r.manija;
        }

        static void Avanzar(Rutina r)
        {
            if (r.terminada) return;
            var mb = r.dueno;
            if (mb.destruido || mb.go == null || !mb.go.activoEnJerarquia) { Detener(r); return; }
            bool sigue;
            try { sigue = r.it.MoveNext(); }
            catch (Exception e)
            {
                Debug.LogException(e, mb);
                // como Unity: la que falló muere y la que la esperaba queda esperando
                Sacar(r);
                return;
            }
            if (r.terminada) return;   // la pararon desde adentro
            if (!sigue) { Terminar(r); return; }
            Programar(r, r.it.Current);
        }

        static void Programar(Rutina r, object y)
        {
            switch (y)
            {
                case null:
                    r.hasta = Time.time; r.cuadroMin = Time.frameCount + 1; diferidas.Add(r);
                    break;
                case WaitForSeconds w:
                    r.hasta = Time.time + w.segundos; r.cuadroMin = 0; diferidas.Add(r);
                    break;
                case WaitForFixedUpdate _:
                    fijas.Add(r);
                    break;
                case WaitForEndOfFrame _:
                    finales.Add(r);
                    break;
                case Coroutine c:
                {
                    var h = c.rutina;
                    if (h == null || h.terminada || h.quienEspera != null)
                    {
                        r.hasta = Time.time; r.cuadroMin = Time.frameCount + 1; diferidas.Add(r);
                    }
                    else { h.quienEspera = r; r.esperando = h; }
                    break;
                }
                case AsyncOperation op:
                    if (op.isDone) { r.hasta = Time.time; r.cuadroMin = Time.frameCount + 1; diferidas.Add(r); }
                    else { r.op = op; operaciones.Add(r); }
                    break;
                case IEnumerator e:
                {
                    var h = new Rutina { dueno = r.dueno, it = e, quienEspera = r };
                    h.manija = new Coroutine(h);
                    r.esperando = h;
                    r.dueno.rutinas.Add(h);
                    Activas++;
                    Avanzar(h);
                    break;
                }
                default:
                    r.hasta = Time.time; r.cuadroMin = Time.frameCount + 1; diferidas.Add(r);
                    break;
            }
        }

        static void Sacar(Rutina r)
        {
            if (r.terminada) return;
            r.terminada = true;
            Activas--;
            r.dueno.rutinas?.Remove(r);
        }

        static void Terminar(Rutina r)
        {
            Sacar(r);
            var p = r.quienEspera;
            if (p != null)
            {
                r.quienEspera = null;
                p.esperando = null;
                Avanzar(p);
            }
        }

        // parar: también la anidada que estaba esperando (la que la esperaba a ella queda colgada, como en Unity)
        static void Detener(Rutina r)
        {
            while (r != null && !r.terminada)
            {
                Sacar(r);
                var h = r.esperando;
                r.esperando = null;
                if (h != null) h.quienEspera = null;
                r = h;
            }
        }

        public static void Parar(MonoBehaviour mb, IEnumerator it)
        {
            if (it == null || mb.rutinas == null) return;
            foreach (var r in mb.rutinas.ToArray()) if (r.it == it) Detener(r);
        }

        public static void Parar(MonoBehaviour mb, Coroutine c)
        {
            if (c?.rutina == null || c.rutina.dueno != mb) return;
            Detener(c.rutina);
        }

        public static void Parar(MonoBehaviour mb, string nombre)
        {
            if (mb.rutinas == null) return;
            foreach (var r in mb.rutinas.ToArray()) if (r.nombre == nombre) Detener(r);
        }

        public static void PararTodas(MonoBehaviour mb)
        {
            if (mb.rutinas == null || mb.rutinas.Count == 0) return;
            foreach (var r in mb.rutinas.ToArray()) Detener(r);
            mb.rutinas.Clear();
        }

        // después de Update: las que esperaban un cuadro o un tiempo, y las de AsyncOperation
        internal static void TrasUpdate()
        {
            if (diferidas.Count > 0)
            {
                var l = diferidas;
                diferidas = diferidasOtra;
                diferidasOtra = l;
                double ahora = Time.time;
                int cuadro = Time.frameCount;
                for (int i = 0; i < l.Count; i++)
                {
                    var r = l[i];
                    if (r.terminada) continue;
                    if (r.hasta <= ahora && r.cuadroMin <= cuadro) Avanzar(r);
                    else diferidas.Add(r);   // todavía no: queda para más adelante
                }
                l.Clear();
            }
            if (operaciones.Count > 0)
            {
                var l = operaciones.ToArray();
                operaciones.Clear();
                foreach (var r in l)
                {
                    if (r.terminada) continue;
                    if (r.op.isDone) { r.op = null; Avanzar(r); }
                    else operaciones.Add(r);
                }
            }
        }

        internal static void TrasPasoFijo()
        {
            if (fijas.Count == 0) return;
            var l = fijas;
            fijas = fijasOtra;
            fijasOtra = l;
            for (int i = 0; i < l.Count; i++) if (!l[i].terminada) Avanzar(l[i]);
            l.Clear();
        }

        internal static void FinDeCuadro()
        {
            if (finales.Count == 0) return;
            var l = finales;
            finales = finalesOtra;
            finalesOtra = l;
            for (int i = 0; i < l.Count; i++) if (!l[i].terminada) Avanzar(l[i]);
            l.Clear();
        }
    }

    // Invoke e InvokeRepeating: llaman por nombre al método sin parámetros del script. Siguen
    // aunque el script esté deshabilitado; se cortan con CancelInvoke o al destruirlo.
    public static class Invocaciones
    {
        sealed class Invocacion
        {
            public MonoBehaviour Mb;
            public string Metodo;
            public double Hasta;
            public float Repetir;   // < 0: una sola vez
            public bool Cancelada;
        }

        static List<Invocacion> lista = new List<Invocacion>(), otra = new List<Invocacion>();

        public static void Agendar(MonoBehaviour mb, string metodo, float t, float repetir)
        {
            if (mb == null || string.IsNullOrEmpty(metodo)) return;
            lista.Add(new Invocacion { Mb = mb, Metodo = metodo, Hasta = Time.time + Math.Max(0f, t), Repetir = repetir });
        }

        // mientras se procesan, las que faltan están en «otra»: también cuentan
        public static void Cancelar(MonoBehaviour mb, string metodo)
        {
            foreach (var l in new[] { lista, otra })
                foreach (var i in l)
                    if (i.Mb == (object)mb && (metodo == null || i.Metodo == metodo)) i.Cancelada = true;
        }

        public static bool Hay(MonoBehaviour mb, string metodo)
        {
            foreach (var l in new[] { lista, otra })
                foreach (var i in l)
                    if (!i.Cancelada && i.Mb == (object)mb && (metodo == null || i.Metodo == metodo)) return true;
            return false;
        }

        internal static void Procesar()
        {
            if (lista.Count == 0) return;
            var l = lista;
            lista = otra;
            otra = l;
            double ahora = Time.time;
            for (int k = 0; k < l.Count; k++)
            {
                var i = l[k];
                if (i.Cancelada || i.Mb.destruido) continue;
                if (i.Hasta > ahora) { lista.Add(i); continue; }
                var ts = i.Mb.tipoScript ?? TipoScript.De(i.Mb.GetType());
                var m = ts.Buscar(i.Metodo);
                if (m == null)
                {
                    Debug.LogError($"Trying to Invoke method: {i.Mb.GetType().Name}.{i.Metodo} couldn't be called.");
                    continue;
                }
                if (i.Repetir > 0f)
                {
                    i.Hasta = Math.Max(i.Hasta + i.Repetir, ahora);
                    lista.Add(i);
                }
                else if (i.Repetir == 0f)
                {
                    // InvokeRepeating con 0: Unity lo trata como una sola vez
                }
                Mensajes.Llamar(i.Mb, m);
            }
            l.Clear();
        }
    }
}

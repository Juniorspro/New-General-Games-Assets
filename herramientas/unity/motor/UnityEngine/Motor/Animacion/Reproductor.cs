using System;
using System.Collections.Generic;
using Porteo;
using Porteo.Datos;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Porteo.Animacion
{
    // Lo que corre un Animator: la máquina de estados de cada capa (estados, transiciones con sus
    // condiciones y tiempos de salida, triggers) y la mezcla de los clips sobre los valores
    // enlazados, como el Mecanim de Unity 2018 para rigs genéricos.
    internal sealed class Reproductor
    {
        readonly Animator an;
        internal readonly Controlador c;
        readonly RuntimeAnimatorController rc;
        readonly AnimationClip[] clips;
        readonly Enlazador enl;

        // parámetros: valor actual por índice
        readonly float[] pf; readonly int[] pi; readonly bool[] pb;
        readonly Dictionary<int, int> indice = new Dictionary<int, int>();

        internal sealed class CapaRt
        {
            public int actual = -1, sig = -1;
            public float t, tPrev, tSig, tSigPrev;     // tiempo de estado en segundos (ya con la velocidad)
            public float progreso, duracion;          // de la transición en curso
            public Transicion trans;
            public float peso;
            public bool entro, entroSig;
        }
        internal readonly CapaRt[] capas;

        // valores enlazados
        readonly int[][] mapa;            // por clip: índice de Valor por enlace (-1 = nada)
        readonly float[][] muestras;      // por clip: los valores de sus curvas
        readonly bool[][] porCapa;        // por capa: qué valores anima alguno de sus clips
        readonly float[] defecto, res, acum, cur;
        readonly bool[] escrito;
        readonly List<Valor> vals;
        readonly int[][] curvasRaiz;      // humanoides: por clip, las curvas de RootT.xyz y RootQ.xyzw
        readonly PoseHumana pose;
        readonly float[] humanos;

        // los StateMachineBehaviour de esta instancia (Unity copia los del controlador por animador)
        readonly Dictionary<(int, int), StateMachineBehaviour[]> comps = new Dictionary<(int, int), StateMachineBehaviour[]>();

        internal Reproductor(Animator an, RuntimeAnimatorController rc)
        {
            this.an = an;
            this.rc = rc;
            c = rc.Base;
            int nc = c.Clips.Length;
            clips = new AnimationClip[nc];
            for (int i = 0; i < nc; i++) clips[i] = rc.Clip(i);
            // parámetros
            int np = c.Parametros.Length;
            pf = new float[np]; pi = new int[np]; pb = new bool[np];
            for (int i = 0; i < np; i++)
            {
                var p = c.Parametros[i];
                indice[p.Hash] = i;
                pf[i] = p.Flotante; pi[i] = p.Entero; pb[i] = p.Booleano;
            }
            capas = new CapaRt[c.Capas.Length];
            for (int i = 0; i < capas.Length; i++) capas[i] = new CapaRt { peso = i == 0 ? 1 : c.Capas[i].Peso };
            // enlazar
            var avatar = an.avatarDatos?.humano;
            enl = new Enlazador(an.transform) { humano = avatar != null };
            mapa = new int[nc][];
            muestras = new float[nc][];
            for (int i = 0; i < nc; i++)
            {
                var clip = clips[i];
                if (clip == null) { mapa[i] = Array.Empty<int>(); muestras[i] = Array.Empty<float>(); continue; }
                muestras[i] = new float[Math.Max(1, clip.NCurvas)];
                var m = new int[clip.enlaces.Length];
                for (int k = 0; k < m.Length; k++)
                {
                    var v = enl.Enlazar(clip.enlaces[k], clip);
                    m[k] = v != null ? enl.valores.IndexOf(v) : -1;
                }
                mapa[i] = m;
            }
            vals = enl.valores;
            int tam = enl.tam;
            // humanoide: la pose sale de los músculos mezclados; el cuerpo de cada clip, relativo a su raíz
            if (avatar != null && vals.Exists(x => x.Tipo == TipoValor.Musculo))
            {
                pose = new PoseHumana(an, avatar, enl);
                humanos = new float[PoseHumana.TOTAL];
                curvasRaiz = new int[nc][];
                for (int i = 0; i < nc; i++)
                {
                    var clip = clips[i];
                    if (clip == null || !clip.raizHumana.Hay) continue;
                    var cr = new int[7];
                    for (int k = 0; k < 7; k++) cr[k] = -1;
                    foreach (var en in clip.enlaces)
                        if (en.Especial == 8 && en.Atributo >= PoseHumana.RAIZ_T && en.Atributo < PoseHumana.RAIZ_T + 7) cr[en.Atributo - PoseHumana.RAIZ_T] = en.Curva;
                    curvasRaiz[i] = cr;
                }
            }
            defecto = new float[tam]; res = new float[tam]; acum = new float[tam]; cur = new float[tam];
            escrito = new bool[vals.Count];
            for (int i = 0; i < vals.Count; i++) vals[i].Leer(defecto, vals[i].Off);
            porCapa = new bool[capas.Length][];
            for (int l = 0; l < capas.Length; l++)
            {
                var b = porCapa[l] = new bool[vals.Count];
                var maq = c.Maquinas[c.Capas[l].Maquina];
                foreach (var e in maq.Estados)
                {
                    if (e.Clip < 0 || e.Clip >= nc) continue;
                    foreach (var x in mapa[e.Clip]) if (x >= 0) b[x] = true;
                }
            }
            // los comportamientos: una copia por animador
            foreach (var kv in c.Comportamientos)
            {
                var l = new List<StateMachineBehaviour>();
                foreach (var o in kv.Value)
                    if (o is StateMachineBehaviour smb)
                    {
                        var copia = Object.Instantiate(smb);
                        if (copia != null) l.Add(copia);
                    }
                comps[kv.Key] = l.ToArray();
            }
        }

        // ── parámetros ──
        internal bool Param(int hash, out int i) => indice.TryGetValue(hash, out i);
        internal float GetFloat(int h) => Param(h, out int i) ? (c.Parametros[i].Tipo == 3 ? pi[i] : pf[i]) : 0;
        internal int GetInteger(int h) => Param(h, out int i) ? (c.Parametros[i].Tipo == 1 ? (int)pf[i] : pi[i]) : 0;
        internal bool GetBool(int h) => Param(h, out int i) && pb[i];

        internal void SetFloat(int h, float v) { if (Param(h, out int i)) { pf[i] = v; pi[i] = (int)v; } else Falta(h); }
        internal void SetInteger(int h, int v) { if (Param(h, out int i)) { pi[i] = v; pf[i] = v; } else Falta(h); }
        internal void SetBool(int h, bool v) { if (Param(h, out int i)) pb[i] = v; else Falta(h); }
        internal void SetTrigger(int h, bool v) { if (Param(h, out int i)) pb[i] = v; else Falta(h); }

        static readonly HashSet<int> avisados = new HashSet<int>();
        void Falta(int h)
        {
            if (avisados.Add(h)) Debug.LogWarning($"Parameter '{h}' does not exist.", an);
        }

        bool Cumple(Condicion[] cs)
        {
            foreach (var x in cs)
            {
                if (!Param(x.Parametro, out int i)) return false;
                var p = c.Parametros[i];
                float v = p.Tipo == 1 ? pf[i] : p.Tipo == 3 ? pi[i] : (pb[i] ? 1 : 0);
                switch (x.Modo)
                {
                    case 1: if (!pb[i]) return false; break;
                    case 2: if (pb[i]) return false; break;
                    case 3: if (!(v > x.Umbral)) return false; break;
                    case 4: if (!(v < x.Umbral)) return false; break;
                    case 6: if (p.Tipo == 3 ? pi[i] != (int)x.Umbral : v != x.Umbral) return false; break;
                    case 7: if (p.Tipo == 3 ? pi[i] == (int)x.Umbral : v == x.Umbral) return false; break;
                }
            }
            return true;
        }

        // los triggers que usó una transición se apagan
        void Consumir(Condicion[] cs)
        {
            foreach (var x in cs)
                if (Param(x.Parametro, out int i) && c.Parametros[i].Tipo == 9) pb[i] = false;
        }

        // ── estados ──
        Maquina Maq(int capa) => c.Maquinas[c.Capas[capa].Maquina];

        float Largo(Estado e)
        {
            var clip = e.Clip >= 0 && e.Clip < clips.Length ? clips[e.Clip] : null;
            float l = clip != null ? clip.length : e.Duracion;
            return l > 1e-5f ? l : 1;
        }

        float Velocidad(Estado e)
        {
            float v = e.Velocidad;
            if (e.ParamVelocidad != 0 && Param(e.ParamVelocidad, out int i)) v *= c.Parametros[i].Tipo == 1 ? pf[i] : pi[i];
            return v;
        }

        // el estado al que lleva un destino (los selectores eligen con sus condiciones)
        int Resolver(Maquina m, int destino, int prof = 0)
        {
            if (destino < 30000) return destino >= 0 && destino < m.Estados.Length ? destino : m.PorDefecto;
            if (prof > 16) return m.PorDefecto;
            int s = destino - 30000;
            if (s < 0 || s >= m.Selectores.Length) return m.PorDefecto;
            foreach (var (d, conds) in m.Selectores[s].Transiciones)
                if (Cumple(conds)) { Consumir(conds); return Resolver(m, d, prof + 1); }
            // la salida de la máquina principal vuelve a la entrada
            if (!m.Selectores[s].Entrada)
                for (int k = 0; k < m.Selectores.Length; k++)
                    if (m.Selectores[k].Entrada && k != s) return Resolver(m, 30000 + k, prof + 1);
            return m.PorDefecto;
        }

        int Inicial(Maquina m)
        {
            for (int k = 0; k < m.Selectores.Length; k++)
                if (m.Selectores[k].Entrada) return Resolver(m, 30000 + k);
            return m.PorDefecto;
        }

        // ── avanzar ──
        internal void Paso(float dt, bool eventos)
        {
            for (int l = 0; l < capas.Length; l++) PasoCapa(l, dt, eventos);
        }

        void PasoCapa(int l, float dt, bool eventos)
        {
            var L = capas[l];
            var m = Maq(l);
            if (m.Estados.Length == 0) return;
            if (L.actual < 0)
            {
                L.actual = Inicial(m);
                L.t = L.tPrev = 0;
                Entrar(l, L.actual);
            }
            var e = m.Estados[L.actual];
            L.tPrev = L.t;
            L.t += dt * Velocidad(e);
            if (L.sig >= 0)
            {
                var es = m.Estados[L.sig];
                L.tSigPrev = L.tSig;
                L.tSig += dt * Velocidad(es);
                L.progreso += L.duracion > 0 ? dt / L.duracion : 1;
            }
            if (eventos)
            {
                Eventos(e, L.tPrev, L.t);
                if (L.sig >= 0) Eventos(m.Estados[L.sig], L.tSigPrev, L.tSig);
            }
            if (L.sig >= 0 && L.progreso >= 1) Completar(l);
            // transiciones: las de cualquier estado primero, después las del estado actual
            Transicion elegida = null;
            int destino = -1;
            bool interrumpe = L.sig >= 0;
            if (!interrumpe || L.trans.Interrupcion != 0)
            {
                foreach (var t in m.DeCualquiera)
                {
                    if (!Posible(t, L.t, L.tPrev, Largo(e))) continue;
                    int d = Resolver(m, t.Destino);
                    if (!t.HaciaSiMismo && (d == L.actual || d == L.sig)) continue;
                    elegida = t; destino = d; break;
                }
                if (elegida == null)
                {
                    // durante una transición: según su fuente de interrupción
                    var fuente = !interrumpe ? e : (L.trans.Interrupcion == 2 || L.trans.Interrupcion == 4 ? m.Estados[L.sig] : e);
                    float tf = !interrumpe || fuente == e ? L.t : L.tSig, tfp = !interrumpe || fuente == e ? L.tPrev : L.tSigPrev;
                    foreach (var t in fuente.Transiciones)
                    {
                        if (interrumpe && t == L.trans) break;   // sólo las de más prioridad
                        if (!Posible(t, tf, tfp, Largo(fuente))) continue;
                        elegida = t; destino = Resolver(m, t.Destino); break;
                    }
                }
            }
            if (elegida != null && destino >= 0) Empezar(l, elegida, destino);
            Actualizar(l);
        }

        bool Posible(Transicion t, float tiempo, float previo, float largo)
        {
            if (t.ConSalida)
            {
                float n0 = previo / largo, n1 = tiempo / largo, e = t.TiempoSalida;
                bool cruza;
                if (e < 1) cruza = Math.Floor(n0 - e) < Math.Floor(n1 - e) || (n0 == 0 && e == 0);
                else cruza = n0 < e && e <= n1;
                if (!cruza) return false;
            }
            else if (t.Condiciones.Length == 0) return false;
            return Cumple(t.Condiciones);
        }

        void Empezar(int l, Transicion t, int destino)
        {
            var L = capas[l];
            var m = Maq(l);
            Consumir(t.Condiciones);
            // una interrupción: lo que estaba entrando pasa a ser el origen
            if (L.sig >= 0)
            {
                if (L.trans.Interrupcion == 2 || L.trans.Interrupcion == 4) { Salir(l, L.actual); L.actual = L.sig; L.t = L.tSig; }
                else Salir(l, L.sig);
            }
            var origen = m.Estados[L.actual];
            var dest = m.Estados[destino];
            L.trans = t;
            L.sig = destino;
            L.tSig = L.tSigPrev = t.Desfase * Largo(dest);
            L.progreso = 0;
            L.duracion = t.DuracionFija ? t.Duracion : t.Duracion * Largo(origen) / Math.Max(1e-5f, Math.Abs(Velocidad(origen)));
            Entrar(l, destino);
            if (L.duracion <= 0) Completar(l);
        }

        void Completar(int l)
        {
            var L = capas[l];
            if (L.sig < 0) return;
            int viejo = L.actual;
            L.actual = L.sig; L.t = L.tSig; L.tPrev = L.tSigPrev;
            L.sig = -1; L.trans = null; L.progreso = 0;
            Salir(l, viejo);
        }

        // ── StateMachineBehaviour ──
        StateMachineBehaviour[] Comps(int l, Estado e) => comps.Count > 0 && comps.TryGetValue((l, e.RutaCompleta), out var a) ? a : null;

        void Entrar(int l, int estado)
        {
            var e = Maq(l).Estados[estado];
            var cs = Comps(l, e);
            if (cs == null) return;
            var info = Info(l, estado, false);
            foreach (var b in cs) Mensajes.Accion(() => b.OnStateEnter(an, info, l), b);
        }

        void Salir(int l, int estado)
        {
            if (estado < 0) return;
            var e = Maq(l).Estados[estado];
            var cs = Comps(l, e);
            if (cs == null) return;
            var info = Info(l, estado, false);
            foreach (var b in cs) Mensajes.Accion(() => b.OnStateExit(an, info, l), b);
        }

        void Actualizar(int l)
        {
            if (comps.Count == 0) return;
            var L = capas[l];
            var m = Maq(l);
            foreach (int s in new[] { L.actual, L.sig })
            {
                if (s < 0) continue;
                var cs = Comps(l, m.Estados[s]);
                if (cs == null) continue;
                var info = Info(l, s, s == L.sig);
                foreach (var b in cs) Mensajes.Accion(() => b.OnStateUpdate(an, info, l), b);
            }
        }

        internal AnimatorStateInfo Info(int l, int estado, bool siguiente)
        {
            var L = capas[l];
            var e = Maq(l).Estados[estado];
            float largo = Largo(e);
            float t = siguiente ? L.tSig : (estado == L.actual ? L.t : L.tSig);
            return new AnimatorStateInfo
            {
                m_Name = e.Nombre, m_Path = e.Ruta, m_FullPath = e.RutaCompleta,
                m_NormalizedTime = t / largo, m_Length = largo, m_Speed = e.Velocidad, m_SpeedMultiplier = 1,
                m_Tag = e.Etiqueta, m_Loop = e.Bucle ? 1 : 0,
            };
        }

        internal AnimatorStateInfo Actual(int l)
        {
            if (l < 0 || l >= capas.Length || capas[l].actual < 0) return default;
            return Info(l, capas[l].actual, false);
        }

        internal AnimatorStateInfo Siguiente(int l)
        {
            if (l < 0 || l >= capas.Length || capas[l].sig < 0) return default;
            return Info(l, capas[l].sig, true);
        }

        internal bool EnTransicion(int l) => l >= 0 && l < capas.Length && capas[l].sig >= 0;

        internal AnimationClip ClipActual(int l)
        {
            if (l < 0 || l >= capas.Length || capas[l].actual < 0) return null;
            int c2 = Maq(l).Estados[capas[l].actual].Clip;
            return c2 >= 0 && c2 < clips.Length ? clips[c2] : null;
        }

        internal bool Tiene(int capa, int hash)
        {
            if (capa < 0 || capa >= capas.Length) return false;
            foreach (var e in Maq(capa).Estados) if (e.Nombre == hash || e.RutaCompleta == hash || e.Ruta == hash) return true;
            return false;
        }

        (int capa, int estado) Buscar(int hash, int capa)
        {
            for (int l = 0; l < capas.Length; l++)
            {
                if (capa >= 0 && l != capa) continue;
                var m = Maq(l);
                for (int s = 0; s < m.Estados.Length; s++)
                {
                    var e = m.Estados[s];
                    if (e.Nombre == hash || e.RutaCompleta == hash || e.Ruta == hash) return (l, s);
                }
            }
            return (-1, -1);
        }

        // CrossFade: una transición armada en el momento hacia ese estado
        internal void Fundir(int hash, float duracion, int capa, float desfase, bool fija)
        {
            var (l, s) = Buscar(hash, capa);
            if (l < 0) { Debug.LogWarning("Animator.GotoState: State could not be found", an); return; }
            var L = capas[l];
            if (L.actual < 0) { L.actual = s; L.t = L.tPrev = 0; Entrar(l, s); return; }
            var largo = Largo(Maq(l).Estados[s]);
            float d = float.IsNegativeInfinity(desfase) ? 0 : (fija ? desfase / largo : desfase);
            var t = new Transicion { Condiciones = Array.Empty<Condicion>(), Destino = s, Duracion = duracion, Desfase = d, DuracionFija = fija, Interrupcion = 0, HaciaSiMismo = true };
            Empezar(l, t, s);
        }

        // Play: salta al estado (por nombre corto o ruta completa) sin transición
        internal void Tocar(int hash, int capa, float normalizado, bool fijo = false)
        {
            if (fijo && !float.IsNegativeInfinity(normalizado))
            {
                var (l0, s0) = Buscar(hash, capa);
                if (l0 >= 0) normalizado /= Largo(Maq(l0).Estados[s0]);
            }
            for (int l = 0; l < capas.Length; l++)
            {
                if (capa >= 0 && l != capa) continue;
                var m = Maq(l);
                for (int s = 0; s < m.Estados.Length; s++)
                {
                    var e = m.Estados[s];
                    if (e.Nombre != hash && e.RutaCompleta != hash && e.Ruta != hash) continue;
                    var L = capas[l];
                    int viejo = L.actual;
                    if (L.sig >= 0) { Salir(l, L.sig); L.sig = -1; L.trans = null; }
                    L.actual = s;
                    float n = float.IsNegativeInfinity(normalizado) ? (viejo == s ? L.t / Largo(e) : 0) : normalizado;
                    L.t = L.tPrev = n * Largo(e);
                    if (viejo != s) { Salir(l, viejo); Entrar(l, s); }
                    return;
                }
            }
            Debug.LogWarning($"Animator.GotoState: State could not be found", an);
        }

        // ── eventos de los clips ──
        void Eventos(Estado e, float t0, float t1)
        {
            if (e.Clip < 0 || e.Clip >= clips.Length) return;
            var clip = clips[e.Clip];
            if (clip == null || clip.eventos.Length == 0 || t1 <= t0) return;
            float largo = clip.length;
            if (largo <= 0) return;
            if (!clip.bucle)
            {
                Disparar(clip, t0, Math.Min(t1, largo), t0 <= 0);
                return;
            }
            // en bucle: cada vuelta por separado
            double v0 = Math.Floor(t0 / largo), v1 = Math.Floor(t1 / largo);
            for (double v = v0; v <= v1 && v - v0 < 64; v++)
            {
                float a = (float)Math.Max(t0 - v * largo, 0), b = (float)Math.Min(t1 - v * largo, largo);
                if (b > a) Disparar(clip, a, b, a <= 0);
            }
        }

        void Disparar(AnimationClip clip, float a, float b, bool desdeCero)
        {
            foreach (var ev in clip.eventos)
            {
                float t = ev.Tiempo - clip.inicio;
                if ((t > a || (desdeCero && t >= a)) && t <= b) Evento.Llamar(an.gameObject, ev, null);
            }
        }

        // ── mezclar y escribir ──
        internal void Evaluar()
        {
            int n = vals.Count;
            Array.Clear(escrito, 0, n);
            for (int l = 0; l < capas.Length; l++)
            {
                var L = capas[l];
                if (L.actual < 0) continue;
                float wl = l == 0 ? 1 : L.peso;
                if (wl <= 0) continue;
                var m = Maq(l);
                var tiene = porCapa[l];
                // lo que hay antes de esta capa (lo de abajo o lo que tiene el objeto)
                for (int i = 0; i < n; i++)
                {
                    if (!tiene[i]) continue;
                    var v = vals[i];
                    if (!escrito[i]) v.Leer(res, v.Off);
                    for (int k = 0; k < v.Tam; k++) { acum[v.Off + k] = 0; cur[v.Off + k] = res[v.Off + k]; }
                }
                float p = L.sig >= 0 ? Math.Clamp(L.progreso, 0, 1) : 0;
                Sumar(l, m.Estados[L.actual], L.t, 1 - p, tiene);
                if (L.sig >= 0) Sumar(l, m.Estados[L.sig], L.tSig, p, tiene);
                for (int i = 0; i < n; i++)
                {
                    if (!tiene[i]) continue;
                    var v = vals[i];
                    int o = v.Off;
                    if (v.Tipo == TipoValor.Rotacion)
                    {
                        var q = new Quaternion(acum[o], acum[o + 1], acum[o + 2], acum[o + 3]);
                        float len = (float)Math.Sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
                        if (len < 1e-6f) continue;
                        q = new Quaternion(q.x / len, q.y / len, q.z / len, q.w / len);
                        if (wl < 1) q = Quaternion.Slerp(new Quaternion(cur[o], cur[o + 1], cur[o + 2], cur[o + 3]), q, wl);
                        res[o] = q.x; res[o + 1] = q.y; res[o + 2] = q.z; res[o + 3] = q.w;
                    }
                    else
                        for (int k = 0; k < v.Tam; k++) res[o + k] = cur[o + k] + (acum[o + k] - cur[o + k]) * wl;
                    escrito[i] = true;
                }
            }
            Escribir();
        }

        // suma con peso w los valores de un estado; los que su clip no anima: el valor por defecto
        // (con Write Defaults) o el que ya tenía el objeto
        readonly bool[] cubierto = Array.Empty<bool>();
        bool[] cub;

        void Sumar(int l, Estado e, float t, float w, bool[] tiene)
        {
            if (w <= 0) return;
            int n = vals.Count;
            if (cub == null || cub.Length < n) cub = new bool[n];
            Array.Clear(cub, 0, n);
            var clip = e.Clip >= 0 && e.Clip < clips.Length ? clips[e.Clip] : null;
            if (clip != null)
            {
                var s = muestras[e.Clip];
                clip.Muestrear(clip.TiempoClip(t), s);
                if (curvasRaiz?[e.Clip] != null) PoseHumana.ExtraerRaiz(clip.raizHumana, s, curvasRaiz[e.Clip]);
                var mp = mapa[e.Clip];
                var es = clip.enlaces;
                for (int k = 0; k < es.Length; k++)
                {
                    int vi = mp[k];
                    if (vi < 0) continue;
                    var v = vals[vi];
                    ref readonly var en = ref es[k];
                    int o = v.Off, ci = en.Curva;
                    if (ci + en.N > s.Length) continue;
                    if (v.Tipo == TipoValor.Rotacion)
                    {
                        Quaternion q = en.Atributo == 4 ? Quaternion.Euler(s[ci], s[ci + 1], s[ci + 2]) : new Quaternion(s[ci], s[ci + 1], s[ci + 2], s[ci + 3]);
                        SumarQ(o, q, w);
                    }
                    else if (v.Tipo == TipoValor.PPtr)
                    {
                        // un objeto no se mezcla: gana el estado de más peso
                        if (w >= 0.5f || !cub[vi])
                        {
                            int idx = (int)Math.Round(s[ci]);
                            v.ObjetoActual2 = idx >= 0 && idx < clip.objetosPPtr.Length ? clip.objetosPPtr[idx] : null;
                        }
                    }
                    else for (int c2 = 0; c2 < v.Tam && c2 < en.N; c2++) acum[o + c2] += w * s[ci + c2];
                    cub[vi] = true;
                }
            }
            for (int i = 0; i < n; i++)
            {
                if (!tiene[i] || cub[i]) continue;
                var v = vals[i];
                var fuente = e.EscribeDefectos ? defecto : cur;
                if (v.Tipo == TipoValor.Rotacion) SumarQ(v.Off, new Quaternion(fuente[v.Off], fuente[v.Off + 1], fuente[v.Off + 2], fuente[v.Off + 3]), w);
                else if (v.Tipo == TipoValor.PPtr) { if (w >= 0.5f) v.ObjetoActual2 = e.EscribeDefectos ? v.ObjetoDefecto : v.ObjetoActual; }
                else for (int k = 0; k < v.Tam; k++) acum[v.Off + k] += w * fuente[v.Off + k];
            }
        }

        // los cuaterniones se suman en el mismo hemisferio que el acumulado (como Mecanim)
        void SumarQ(int o, Quaternion q, float w)
        {
            float d = acum[o] * q.x + acum[o + 1] * q.y + acum[o + 2] * q.z + acum[o + 3] * q.w;
            if (d < 0) w = -w;
            acum[o] += w * q.x; acum[o + 1] += w * q.y; acum[o + 2] += w * q.z; acum[o + 3] += w * q.w;
        }

        void Escribir()
        {
            int n = vals.Count;
            bool hayHumano = false;
            // los Transform de una vez (posición, rotación y escala juntas)
            for (int i = 0; i < n; i++)
            {
                if (!escrito[i]) continue;
                var v = vals[i];
                int o = v.Off;
                switch (v.Tipo)
                {
                    case TipoValor.Posicion: v.T.PonerLocal(0, new Vector3(res[o], res[o + 1], res[o + 2]), default); break;
                    case TipoValor.Escala: v.T.PonerLocal(2, new Vector3(res[o], res[o + 1], res[o + 2]), default); break;
                    case TipoValor.Rotacion: v.T.PonerLocal(1, default, new Quaternion(res[o], res[o + 1], res[o + 2], res[o + 3])); break;
                    case TipoValor.PPtr: v.EscribirObjeto(v.ObjetoActual2); break;
                    case TipoValor.Musculo: humanos[v.Musculo] = res[o]; hayHumano = true; break;
                    case TipoValor.Nada: break;
                    default: v.Escribir(res, o); break;
                }
            }
            for (int i = 0; i < n; i++)
            {
                var v = vals[i];
                if (escrito[i] && v.T != null) v.T.AplicarLocal();
            }
            if (hayHumano) pose.Aplicar(humanos);
        }

        // al deshabilitarse el animador, todo vuelve a como estaba (como Unity)
        internal void Restaurar()
        {
            for (int i = 0; i < vals.Count; i++)
            {
                var v = vals[i];
                if (v.T == null || v.T.destruido) { if (v.Tipo != TipoValor.Activo && v.Tipo != TipoValor.Nada && v.Tipo != TipoValor.PPtr) v.Escribir(defecto, v.Off); continue; }
                int o = v.Off;
                if (v.Tipo == TipoValor.Posicion) v.T.PonerLocal(0, new Vector3(defecto[o], defecto[o + 1], defecto[o + 2]), default);
                else if (v.Tipo == TipoValor.Escala) v.T.PonerLocal(2, new Vector3(defecto[o], defecto[o + 1], defecto[o + 2]), default);
                else if (v.Tipo == TipoValor.Rotacion) v.T.PonerLocal(1, default, new Quaternion(defecto[o], defecto[o + 1], defecto[o + 2], defecto[o + 3]));
                v.T.AplicarLocal();
            }
        }
    }

    // Llama la función de un evento de animación en los scripts del objeto (con el parámetro que
    // pide su firma: ninguno, float, int, string, un Object o el AnimationEvent entero).
    internal static class Evento
    {
        internal static void Llamar(GameObject go, in EventoClip e, AnimationState estado)
        {
            if (go == null || go.destruido || string.IsNullOrEmpty(e.Funcion)) return;
            bool recibido = false;
            foreach (var c in go.componentes.ToArray())
            {
                if (!(c is MonoBehaviour mb) || mb.destruido) continue;
                var ts = mb.tipoScript ?? TipoScript.De(mb.GetType());
                foreach (var m in ts.Metodos(e.Funcion))
                {
                    var ps = m.GetParameters();
                    object[] args;
                    if (ps.Length == 0) args = null;
                    else if (ps.Length == 1)
                    {
                        var t = ps[0].ParameterType;
                        if (t == typeof(float)) args = new object[] { e.Flotante };
                        else if (t == typeof(int)) args = new object[] { e.Entero };
                        else if (t.IsEnum) args = new object[] { Enum.ToObject(t, e.Entero) };
                        else if (t == typeof(string)) args = new object[] { e.Texto };
                        else if (t == typeof(AnimationEvent)) args = new object[] { new AnimationEvent(e) { animationState = estado } };
                        else if (typeof(Object).IsAssignableFrom(t)) args = new object[] { e.Objeto };
                        else continue;
                    }
                    else continue;
                    Mensajes.Llamar(mb, m, args);
                    recibido = true;
                    break;
                }
            }
            if (!recibido && e.Opciones == 0)
                Debug.LogError($"'{go.name}' AnimationEvent '{e.Funcion}' has no receiver! Are you missing a component?", go);
        }
    }
}

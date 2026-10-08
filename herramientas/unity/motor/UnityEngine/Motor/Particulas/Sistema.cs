using System;
using System.Collections.Generic;
using Porteo;
using Porteo.Datos;
using Porteo.Particulas;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Porteo.Particulas
{
    // Una partícula viva. Posición y velocidad en el espacio de la simulación: el mundo, o el marco
    // del transform del sistema (posición y rotación; la escala se aplica al emitir, según el modo).
    internal struct Part
    {
        public Vector3 Pos, Vel, VelAnim;   // VelAnim: lo del módulo de velocidad en la vida (no se acumula)
        public Vector3 Rot, VelAng;         // radianes; z es la del billboard
        public Vector3 Tam;                 // tamaño inicial
        public Color32 Col;                 // color inicial
        public float Vida, Edad;            // segundos
        public uint Semilla;
        public float Signo;                 // -1 si gira al revés (randomizeRotationDirection)
        public float AcumSub;               // emisión de los sub-emisores de nacimiento
        public int Estela;                  // la estela de la partícula (-1: ninguna)
    }

    // Los sistemas de partículas activos: se simulan después de la animación y antes de los
    // LateUpdate de los scripts, como en el PlayerLoop de Unity (ParticleSystemBeginUpdateAll).
    public static class Particulas
    {
        internal static readonly List<ParticleSystem> activos = new List<ParticleSystem>(512);
        static ParticleSystem[] copia = new ParticleSystem[64];
        static bool iniciado;

        // para medir: partículas vivas y sistemas simulados en el último cuadro
        public static int Vivas, Simulados;

        public static void Iniciar()
        {
            if (iniciado) return;
            iniciado = true;
            Mundo.AntesDeLateUpdate += Actualizar;
        }

        internal static void Alta(ParticleSystem s)
        {
            if (s.indiceActivo >= 0) return;
            s.indiceActivo = activos.Count;
            activos.Add(s);
        }

        internal static void Baja(ParticleSystem s)
        {
            int i = s.indiceActivo;
            if (i < 0) return;
            int ult = activos.Count - 1;
            if (i != ult) { activos[i] = activos[ult]; activos[i].indiceActivo = i; }
            activos.RemoveAt(ult);
            s.indiceActivo = -1;
        }

        static void Actualizar()
        {
            int n = activos.Count;
            if (copia.Length < n) copia = new ParticleSystem[n * 2];
            activos.CopyTo(copia);
            Vivas = 0; Simulados = 0;
            for (int i = 0; i < n; i++)
            {
                var s = copia[i];
                copia[i] = null;
                if (s.indiceActivo < 0 || s.destruido) continue;
                try { s.Cuadro(); }
                catch (Exception e) { Debug.LogException(e); }
                Vivas += s.n;
            }
        }
    }
}

namespace UnityEngine
{
    // Shuriken: la simulación en la CPU de cada sistema (emisión, formas, módulos sobre la vida,
    // colisiones con el mundo, sub-emisores) y su API para los scripts. La geometría la arma el
    // ParticleSystemRenderer para cada cámara.
    public sealed partial class ParticleSystem : Component
    {
        internal Configuracion aj = Configuracion.Defecto;
        bool ajPropios;
        internal bool esSubEmisor;     // lo maneja su padre: no emite por su cuenta
        internal int indiceActivo = -1;

        internal Part[] p = new Part[8];
        internal int n;
        bool reproduciendo, emitiendo, pausado;
        float tiempo;                  // dentro del ciclo actual
        float demora;                  // lo que falta de startDelay
        float acumTiempo, acumDist;
        int[] rafagasHechas = Array.Empty<int>();
        uint azar = 0x9E3779B9u;
        Vector3 posPrevia; bool hayPrevia;
        internal Vector3 velEmisor;
        internal Bounds limites;
        internal bool hayLimites;
        float atrasado;                // tiempo que no se simuló por no verse
        internal float tamMax, rapidezMax;
        internal EstelasVivas estelas;
        ParticleSystemRenderer rend;

        static uint semillas = 12345;

        internal override void LeerNativo(Mapa m, IResolutor r) => aj = Configuracion.Leer(m, r);

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            var x = (ParticleSystem)o;
            aj = x.aj; ajPropios = false;
            esSubEmisor = x.esSubEmisor;
            // los sub-emisores de un prefab son sus hijos: la copia emite con los de la copia
            if (aj.Subs.Length > 0)
            {
                var subs = (SubEmisor[])aj.Subs.Clone();
                bool cambio = false;
                for (int i = 0; i < subs.Length; i++)
                    if (remap(subs[i].Sistema) is ParticleSystem ps && ps != subs[i].Sistema) { subs[i].Sistema = ps; ps.esSubEmisor = true; cambio = true; }
                if (cambio) { aj = aj.Clonar(); aj.Subs = subs; ajPropios = true; }
            }
        }

        // los scripts cambian ajustes (main.startColor, emission.enabled): desde ahí son propios
        internal Configuracion Modificables()
        {
            if (!ajPropios) { aj = aj.Clonar(); ajPropios = true; }
            return aj;
        }

        internal override void AlActivarse()
        {
            Porteo.Particulas.Particulas.Alta(this);
            hayPrevia = false;
            if (aj.AlDespertar && !esSubEmisor) Reproducir();
        }

        // como Unity: al desactivar el objeto, el sistema se detiene y se borran sus partículas
        internal override void AlDesactivarse()
        {
            Porteo.Particulas.Particulas.Baja(this);
            Limpiar();
            reproduciendo = false; emitiendo = false; pausado = false;
        }

        internal override void AlDestruirse() => AlDesactivarse();

        internal ParticleSystemRenderer Renderer
        {
            get
            {
                if ((object)rend == null || rend.destruido || rend.go != go) rend = go?.GetComponent<ParticleSystemRenderer>();
                return rend;
            }
        }

        // ── azar ──
        float Azar()
        {
            uint x = azar;
            x ^= x << 13; x ^= x >> 17; x ^= x << 5;
            azar = x;
            return (x >> 8) * (1f / 16777216f);
        }

        // el azar propio de cada partícula para cada módulo: el mismo durante toda su vida (las
        // curvas "entre dos" siguen siempre la misma mezcla)
        internal static float Hash(uint s, uint k)
        {
            uint h = s * 0x9E3779B1u ^ k * 0x85EBCA77u;
            h ^= h >> 15; h *= 0x2C1B3C6Du; h ^= h >> 12; h *= 0x297A2D39u; h ^= h >> 15;
            return (h >> 8) * (1f / 16777216f);
        }

        Vector3 DirAzar()
        {
            float z = Azar() * 2 - 1, a = Azar() * 6.2831853f, r = (float)Math.Sqrt(Math.Max(0, 1 - z * z));
            return new Vector3(r * (float)Math.Cos(a), r * (float)Math.Sin(a), z);
        }

        // un radio al azar en una cáscara (grosor 1: todo el volumen; 0: sólo el borde), uniforme en área o volumen
        float RadioEnCascara(float r, float grosor, int dim)
        {
            grosor = Math.Clamp(grosor, 0, 1);
            if (grosor <= 0) return r;
            float adentro = r * (1 - grosor), u = Azar();
            if (dim == 3) return (float)Math.Cbrt(adentro * adentro * adentro + (r * r * r - adentro * adentro * adentro) * u);
            return (float)Math.Sqrt(adentro * adentro + (r * r - adentro * adentro) * u);
        }

        // ── el estado ──
        void Reiniciar()
        {
            tiempo = 0; acumTiempo = 0; acumDist = 0;
            if (rafagasHechas.Length != aj.Rafagas.Length) rafagasHechas = new int[aj.Rafagas.Length];
            else Array.Clear(rafagasHechas, 0, rafagasHechas.Length);
            azar = aj.SemillaAlAzar ? (semillas = semillas * 1664525u + 1013904223u) | 1 : (uint)aj.SemillaFija * 2654435761u | 1;
            demora = Math.Max(0, aj.Demora.Eval(0, Azar()));
            hayPrevia = false;
        }

        internal void Reproducir()
        {
            if (pausado) { pausado = false; if (reproduciendo) return; }
            if (reproduciendo && emitiendo) return;
            Reiniciar();
            reproduciendo = true;
            emitiendo = true;
            if (indiceActivo < 0 && go != null && go.activoEnJerarquia) Porteo.Particulas.Particulas.Alta(this);
            if (aj.Precalentar && aj.Bucle) Precalentar();
        }

        // prewarm: como si ya hubiera pasado un ciclo entero (en pasos gruesos: lo que se ve al
        // empezar es el estado estable, no el camino)
        void Precalentar()
        {
            float d = aj.Duracion;
            int pasos = Math.Clamp((int)Math.Ceiling(d * 15), 1, 60);
            float paso = d / pasos;
            demora = 0;
            for (int i = 0; i < pasos; i++) Paso(paso);
        }

        internal void Detener(ParticleSystemStopBehavior como)
        {
            emitiendo = false;
            pausado = false;
            if (como == ParticleSystemStopBehavior.StopEmittingAndClear) { Limpiar(); reproduciendo = false; }
            else if (n == 0) reproduciendo = false;
        }

        internal void Limpiar()
        {
            n = 0;
            hayLimites = false;
            estelas?.Limpiar();
        }

        void Terminar()
        {
            reproduciendo = false;
            emitiendo = false;
        }

        // ── el cuadro ──
        internal void Cuadro()
        {
            if (pausado) return;
            if (!reproduciendo && n == 0 && (estelas == null || estelas.Vacias)) return;
            float dt = (aj.SinEscala ? Time.unscaledDeltaTime : Time.deltaTime) * aj.Velocidad;
            // culling como Unity: los que se repiten (o lo piden) no se simulan mientras no se ven
            if (n > 0 && Descartable() && !Visible())
            {
                if (aj.Descarte == 1) atrasado = Math.Min(atrasado + dt, aj.Duracion + aj.Vida.Cota());
                hayPrevia = false;
                return;
            }
            if (atrasado > 0)
            {
                // pausar y alcanzar: el tiempo que no se vio, en pocos pasos
                float a = atrasado; atrasado = 0;
                while (a > 0) { float d = Math.Min(a, 0.25f); Paso(d); a -= d; }
            }
            Paso(dt);
            Porteo.Particulas.Particulas.Simulados++;
        }

        bool Descartable()
        {
            if (aj.Descarte == 3) return false;
            if (aj.Descarte == 0 && !aj.Bucle) return false;
            var r = Renderer;
            // sin renderer habilitado no hay con qué saber si se ve (un script puede dibujarlas)
            return r != null && r.habilitado;
        }

        bool Visible() => rend != null && rend.cuadroVisible >= Time.frameCount - 2;

        internal bool EnMundo => aj.Espacio == 1;

        // la escala que se aplica al emitir: Shape y Hierarchy usan la del mundo; Local sólo la propia
        Vector3 EscalaEmision()
        {
            var t = transform;
            return aj.Escalado == 1 ? t.localScale : t.lossyScale;
        }

        void Paso(float dt)
        {
            var t = transform;
            Vector3 pos = t.position;
            Quaternion rot = t.rotation;
            if (!hayPrevia) { posPrevia = pos; hayPrevia = true; }
            velEmisor = dt > 0 ? (pos - posPrevia) / dt : Vector3.zero;
            if (dt > 0)
            {
                if (estelas != null) { estelas.Reloj += dt; estelas.Vencer(); }
                Mover(dt, rot);
                if (reproduciendo && emitiendo && !esSubEmisor) Emitir(dt, pos, rot);
            }
            posPrevia = pos;
            Limites(pos, rot);
            if (reproduciendo && !emitiendo && n == 0 && (estelas == null || estelas.Vacias)) Terminar();
        }

        // ── emisión ──
        void Emitir(float dt, Vector3 pos, Quaternion rot)
        {
            var a = aj;
            if (demora > 0)
            {
                demora -= dt;
                if (demora > 0) return;
                dt = -demora; demora = 0;
            }
            float fin = a.Duracion;
            // por distancia: lo que se movió el emisor en el cuadro (repartido por el camino)
            if (a.Emision && !a.PorDistancia.EsCero)
            {
                float dist = (pos - posPrevia).magnitude;
                float tasa = a.PorDistancia.Eval(tiempo / fin, Azar());
                if (dist > 0 && tasa > 0)
                {
                    acumDist += tasa * dist;
                    int k = (int)acumDist;
                    acumDist -= k;
                    for (int i = 0; i < k; i++)
                    {
                        float f = 1 - (acumDist + (k - 1 - i)) / (tasa * dist);
                        Nacer((1 - Math.Clamp(f, 0, 1)) * dt, Math.Clamp(f, 0, 1), pos, rot, tiempo / fin);
                    }
                }
            }
            float t0 = tiempo, t1 = tiempo + dt;
            Tramo(t0, Math.Min(t1, fin), t1, dt, pos, rot);
            if (t1 < fin) { tiempo = t1; return; }
            if (!a.Bucle) { tiempo = fin; emitiendo = false; return; }
            // otro ciclo: las ráfagas vuelven a empezar
            float resto = t1 - fin;
            if (resto >= fin) resto %= fin;
            Array.Clear(rafagasHechas, 0, rafagasHechas.Length);
            Tramo(0, resto, resto, dt, pos, rot);
            tiempo = resto;
        }

        // lo que se emite entre ta y tb del ciclo; tFin es el tiempo del ciclo al final del cuadro
        // (para saber cuánto vivió ya cada partícula nueva y por dónde pasaba el emisor)
        void Tramo(float ta, float tb, float tFin, float dt, Vector3 pos, Quaternion rot)
        {
            var a = aj;
            if (!a.Emision || tb < ta) return;
            float fin = a.Duracion, ts = ta / fin;
            if (tb > ta)
            {
                float tasa = a.PorTiempo.Eval(ts, Azar());
                if (tasa > 0)
                {
                    acumTiempo += tasa * (tb - ta);
                    int k = (int)acumTiempo;
                    acumTiempo -= k;
                    for (int i = 0; i < k; i++)
                    {
                        float tEm = Math.Max(ta, tb - (acumTiempo + (k - 1 - i)) / tasa);
                        float edad = Math.Max(0, tFin - tEm);
                        Nacer(edad, 1 - Math.Min(edad / dt, 1), pos, rot, tEm / fin);
                    }
                }
            }
            var rs = a.Rafagas;
            if (rafagasHechas.Length != rs.Length) rafagasHechas = new int[rs.Length];
            for (int j = 0; j < rs.Length; j++)
            {
                ref var b = ref rs[j];
                while (rafagasHechas[j] < b.Ciclos)
                {
                    float tr = b.Tiempo + rafagasHechas[j] * b.Intervalo;
                    // la ráfaga del tiempo 0 sale en el primer cuadro (ta = tb = 0 también cuenta)
                    if (tr > tb || (tr == tb && tb > ta)) break;
                    rafagasHechas[j]++;
                    if (tr < ta) continue;
                    if (b.Probabilidad < 1 && Azar() > b.Probabilidad) continue;
                    int k = (int)(b.Cantidad.Eval(ts, Azar()) + 0.5f);
                    float edad = Math.Max(0, tFin - tr);
                    float f = 1 - Math.Min(edad / Math.Max(dt, 1e-6f), 1);
                    for (int i = 0; i < k; i++) Nacer(edad, f, pos, rot, tr / fin);
                }
            }
        }

        // una partícula nueva: edad es lo que ya vivió dentro del cuadro y f en qué parte del
        // camino del emisor nació (0 al empezar el cuadro, 1 al terminar)
        void Nacer(float edad, float f, Vector3 pos, Quaternion rot, float ts)
        {
            var a = aj;
            if (n >= a.Maximo) return;
            ts = Math.Clamp(ts, 0, 1);
            float vida = Math.Max(a.Vida.Eval(ts, Azar()), 1e-4f);
            if (edad >= vida) return;
            if (n == p.Length) Array.Resize(ref p, Math.Max(16, Math.Min(p.Length * 2, Math.Max(a.Maximo, 16))));
            ref var q = ref p[n];
            q = default;
            q.Vida = vida;
            q.Semilla = (uint)(Azar() * 16777216f) * 2654435761u ^ azar;
            q.Estela = -1;
            Muestrear(a.Forma, out var lp, out var ld);
            var esc = EscalaEmision();
            lp = Vector3.Scale(lp, esc);
            float rapidez = a.Rapidez.Eval(ts, Azar());
            Vector3 vel = ld * rapidez;
            if (a.Escalado != 2) vel = Vector3.Scale(vel, esc);
            if (EnMundo)
            {
                var ep = f >= 1 ? pos : Vector3.LerpUnclamped(posPrevia, pos, f);
                q.Pos = ep + rot * lp;
                q.Vel = rot * vel;
                if (a.Heredar && a.HeredarModo == 0) q.Vel += velEmisor * a.HeredarCurva.Eval(ts, Azar());
            }
            else { q.Pos = lp; q.Vel = vel; }
            float tam = a.Tam.Eval(ts, Azar());
            q.Tam = a.Tam3D ? new Vector3(tam, a.TamY.Eval(ts, Azar()), a.TamZ.Eval(ts, Azar())) : new Vector3(tam, tam, tam);
            if (a.Escalado != 2) q.Tam = Vector3.Scale(q.Tam, new Vector3(Math.Abs(esc.x), Math.Abs(esc.y), Math.Abs(esc.z)));
            q.Signo = a.GiroInverso > 0 && Azar() < a.GiroInverso ? -1 : 1;
            q.Rot = a.Rot3D ? new Vector3(a.RotX.Eval(ts, Azar()), a.RotY.Eval(ts, Azar()), a.Rot.Eval(ts, Azar())) : new Vector3(0, 0, a.Rot.Eval(ts, Azar()));
            q.Rot *= q.Signo;
            q.Col = a.ColorInicial.Eval(ts, Azar());
            if (edad > 0) { q.Edad = edad; q.Pos += q.Vel * edad; }
            var es = a.Estelas;
            if (es.Activa && Hash(q.Semilla, 30) < es.Proporcion)
            {
                // cada punto vive una fracción de la vida de la partícula (y su tamaño, si se pide)
                float vidaPuntos = q.Vida * es.Vida.Eval(ts, Hash(q.Semilla, 31));
                if (es.TamAfectaVida) vidaPuntos *= q.Tam.x;
                estelas ??= new EstelasVivas();
                q.Estela = estelas.Nueva(q.Pos, vidaPuntos);
            }
            n++;
        }

        // un punto de la forma y la dirección de salida, en el espacio de la forma
        void Muestrear(Forma f, out Vector3 lp, out Vector3 ld)
        {
            if (!f.Activa) { lp = default; ld = new Vector3(0, 0, 1); return; }
            float r = f.Radio;
            switch (f.Tipo)
            {
                case 0: case 1:     // esfera (1: la cáscara de las versiones viejas)
                {
                    var d = DirAzar();
                    lp = d * RadioEnCascara(r, f.Tipo == 1 ? 0 : f.GrosorRadio, 3); ld = d;
                    break;
                }
                case 2: case 3:     // hemisferio hacia +z
                {
                    var d = DirAzar();
                    if (d.z < 0) d.z = -d.z;
                    lp = d * RadioEnCascara(r, f.Tipo == 3 ? 0 : f.GrosorRadio, 3); ld = d;
                    break;
                }
                case 4: case 7: case 8: case 9:   // cono (8 y 9: desde el volumen)
                {
                    float an = Azar() * f.Arco * Mathf.Deg2Rad;
                    float rr = RadioEnCascara(1, f.Tipo == 7 || f.Tipo == 9 ? 0 : f.GrosorRadio, 2);
                    float cx = (float)Math.Cos(an) * rr, cy = (float)Math.Sin(an) * rr;
                    float ang = Math.Clamp(f.Angulo, 0, 89.99f) * Mathf.Deg2Rad;
                    float s = (float)Math.Sin(ang), c = (float)Math.Cos(ang);
                    // el borde sale inclinado el ángulo del cono; el centro, derecho
                    ld = new Vector3(cx * s, cy * s, c).normalized;
                    lp = new Vector3(cx * r, cy * r, 0);
                    if (f.Tipo == 8 || f.Tipo == 9) lp += ld * (f.Largo * Azar());
                    break;
                }
                case 5: case 15: case 16:   // caja (el tamaño es la escala de la forma)
                {
                    if (f.Tipo == 5) lp = new Vector3(Azar() - 0.5f, Azar() - 0.5f, Azar() - 0.5f);
                    else
                    {
                        // en una cara (15) o una arista (16)
                        int eje = (int)(Azar() * 3) % 3;
                        lp = new Vector3(Azar() - 0.5f, Azar() - 0.5f, Azar() - 0.5f);
                        lp[eje] = Azar() < 0.5f ? -0.5f : 0.5f;
                        if (f.Tipo == 16) { int otro = (eje + 1 + (int)(Azar() * 2)) % 3; lp[otro] = Azar() < 0.5f ? -0.5f : 0.5f; }
                    }
                    ld = new Vector3(0, 0, 1);
                    break;
                }
                case 10: case 11:   // círculo en el plano xy
                {
                    float an = Azar() * f.Arco * Mathf.Deg2Rad;
                    var d = new Vector3((float)Math.Cos(an), (float)Math.Sin(an), 0);
                    lp = d * RadioEnCascara(r, f.Tipo == 11 ? 0 : f.GrosorRadio, 2); ld = d;
                    break;
                }
                case 12:            // borde: un segmento sobre x, hacia +y
                    lp = new Vector3((Azar() * 2 - 1) * r, 0, 0); ld = new Vector3(0, 1, 0);
                    break;
                case 17:            // dona: el anillo en el plano xy y un disco de la sección
                {
                    float an = Azar() * f.Arco * Mathf.Deg2Rad;
                    var anillo = new Vector3((float)Math.Cos(an), (float)Math.Sin(an), 0);
                    float b = Azar() * 6.2831853f;
                    var sec = anillo * (float)Math.Cos(b) + new Vector3(0, 0, (float)Math.Sin(b));
                    lp = anillo * r + sec * RadioEnCascara(f.RadioDona, f.GrosorRadio, 2); ld = sec;
                    break;
                }
                default:
                    lp = default; ld = DirAzar();
                    break;
            }
            if (f.Transformada)
            {
                lp = f.Rot * Vector3.Scale(lp, f.Esc) + f.Pos;
                var d = f.Rot * Vector3.Scale(ld, f.Esc);
                if (d.sqrMagnitude > 1e-12f) ld = d.normalized;
            }
            if (f.DirAzar > 0)
            {
                var d = Vector3.LerpUnclamped(ld, DirAzar(), Math.Min(f.DirAzar, 1));
                if (d.sqrMagnitude > 1e-12f) ld = d.normalized;
            }
            if (f.DirEsferica > 0 && lp.sqrMagnitude > 1e-12f)
            {
                var d = Vector3.LerpUnclamped(ld, lp.normalized, Math.Min(f.DirEsferica, 1));
                if (d.sqrMagnitude > 1e-12f) ld = d.normalized;
            }
            if (f.PosAzar > 0) lp += DirAzar() * (Azar() * f.PosAzar);
        }

        // ── las partículas que ya estaban ──
        static readonly RaycastHit[] golpe = new RaycastHit[1];

        void Mover(float dt, Quaternion rot)
        {
            var a = aj;
            bool mundo = EnMundo;
            var inv = Quaternion.Inverse(rot);
            float ts = tiempo / a.Duracion;
            var g = Physics.gravity;
            if (!mundo) g = inv * g;
            bool gravedad = !a.Gravedad.EsCero;
            // el límite de velocidad saca una fracción de lo que sobra cada 1/30 s (así no depende
            // de cuántos cuadros por segundo haya)
            float amort = a.Limite ? 1 - (float)Math.Pow(1 - Math.Clamp(a.Amortiguar, 0, 1), dt * 30) : 0;
            float rfx = Azar(), rfy = Azar(), rfz = Azar();
            bool heredarActual = a.Heredar && a.HeredarModo == 1 && mundo;
            bool modificador = a.VelVida && !(a.VelModificador.Modo == 0 && a.VelModificador.Max == 1);
            var col = a.Colision;
            bool chocar = col.Activa && col.Tipo == 1;
            var marco = chocar && !mundo ? Matrix4x4.TRS(transform.position, rot, Vector3.one) : default;
            bool subsNacer = false, subsMorir = false, subsChocar = false;
            foreach (var s in a.Subs)
            {
                if (s.Sistema == null || s.Sistema.destruido) continue;
                if (s.Tipo == 0) subsNacer = true; else if (s.Tipo == 2) subsMorir = true; else if (s.Tipo == 1) subsChocar = true;
            }
            for (int i = 0; i < n;)
            {
                ref var q = ref p[i];
                float edadPrevia = q.Edad;
                q.Edad += dt;
                if (q.Edad >= q.Vida)
                {
                    if (subsMorir) Subs(2, q.Pos, q.Vel + q.VelAnim, 1);
                    Quitar(i);
                    continue;
                }
                float t = q.Edad / q.Vida;
                if (gravedad) q.Vel += g * (a.Gravedad.Eval(ts, Hash(q.Semilla, 17)) * dt);
                if (a.Fuerza)
                {
                    var fz = new Vector3(
                        a.FuerzaX.Eval(t, a.FuerzaAzarPorCuadro ? rfx : Hash(q.Semilla, 7)),
                        a.FuerzaY.Eval(t, a.FuerzaAzarPorCuadro ? rfy : Hash(q.Semilla, 8)),
                        a.FuerzaZ.Eval(t, a.FuerzaAzarPorCuadro ? rfz : Hash(q.Semilla, 9)));
                    if (a.FuerzaMundo != mundo) fz = mundo ? rot * fz : inv * fz;
                    q.Vel += fz * dt;
                }
                Vector3 va = default;
                if (a.VelVida)
                {
                    va = new Vector3(a.VelX.Eval(t, Hash(q.Semilla, 4)), a.VelY.Eval(t, Hash(q.Semilla, 5)), a.VelZ.Eval(t, Hash(q.Semilla, 6)));
                    if (a.VelVidaMundo != mundo) va = mundo ? rot * va : inv * va;
                }
                if (a.Limite)
                {
                    var total = q.Vel + va;
                    if (!a.LimiteSeparado)
                    {
                        float lim = a.LimiteMag.Eval(t, Hash(q.Semilla, 10)), sp = total.magnitude;
                        if (sp > lim && sp > 1e-6f) total *= (sp + (lim - sp) * amort) / sp;
                    }
                    else
                    {
                        var l = new Vector3(a.LimiteX.Eval(t, Hash(q.Semilla, 10)), a.LimiteY.Eval(t, Hash(q.Semilla, 11)), a.LimiteZ.Eval(t, Hash(q.Semilla, 12)));
                        for (int k = 0; k < 3; k++)
                        {
                            float v = total[k], lk = Math.Abs(l[k]);
                            if (Math.Abs(v) > lk) total[k] = Math.Sign(v) * (Math.Abs(v) + (lk - Math.Abs(v)) * amort);
                        }
                    }
                    if (!a.Arrastre.EsCero)
                    {
                        float d = a.Arrastre.Eval(t, Hash(q.Semilla, 13));
                        if (a.ArrastrePorTam) { float tm = Math.Max(q.Tam.x, Math.Max(q.Tam.y, q.Tam.z)) * 0.5f; d *= tm * tm * Mathf.PI; }
                        if (a.ArrastrePorVel) d *= total.magnitude;
                        total *= Math.Max(0, 1 - d * dt);
                    }
                    q.Vel = total - va;
                }
                var vel = q.Vel + va;
                if (modificador) vel *= a.VelModificador.Eval(t, Hash(q.Semilla, 21));
                if (heredarActual) vel += velEmisor * a.HeredarCurva.Eval(t, Hash(q.Semilla, 18));
                var nueva = q.Pos + vel * dt;
                if (chocar && Chocar(ref q, ref nueva, vel, va, t, mundo, marco, inv, subsChocar)) { Quitar(i); continue; }
                q.Pos = nueva;
                q.VelAnim = va;
                if (q.Estela >= 0) estelas.Mover(q.Estela, nueva, a.Estelas.DistanciaMin);
                if (a.RotVida)
                {
                    float h = Hash(q.Semilla, 2);
                    var w = a.RotVidaSeparada ? new Vector3(a.RotVidaX.Eval(t, h), a.RotVidaY.Eval(t, h), a.RotVidaZ.Eval(t, h)) : new Vector3(0, 0, a.RotVidaZ.Eval(t, h));
                    q.Rot += w * (q.Signo * dt);
                }
                if (a.RotVel)
                {
                    float h = Hash(q.Semilla, 15), k = Rango(vel.magnitude, a.RotVelRango);
                    var w = a.RotVelSeparada ? new Vector3(a.RotVelX.Eval(k, h), a.RotVelY.Eval(k, h), a.RotVelZ.Eval(k, h)) : new Vector3(0, 0, a.RotVelZ.Eval(k, h));
                    q.Rot += w * (q.Signo * dt);
                }
                if (subsNacer) SubsNacimiento(ref q, edadPrevia, dt);
                i++;
            }
        }

        void Quitar(int i)
        {
            if (p[i].Estela >= 0) estelas?.Soltar(p[i].Estela, aj.Estelas.MuereConParticula);
            n--;
            if (i != n) p[i] = p[n];
        }

        static float Rango(float v, Vector2 r) => r.y > r.x ? Math.Clamp((v - r.x) / (r.y - r.x), 0, 1) : 0;

        // colisión con el mundo: un rayo por el camino del cuadro (con el radio de la partícula)
        bool Chocar(ref Part q, ref Vector3 nueva, Vector3 vel, Vector3 va, float t, bool mundo, in Matrix4x4 marco, Quaternion inv, bool subs)
        {
            var c = aj.Colision;
            var desde = mundo ? q.Pos : marco.MultiplyPoint3x4(q.Pos);
            var hasta = mundo ? nueva : marco.MultiplyPoint3x4(nueva);
            var d = hasta - desde;
            float dist = d.magnitude;
            if (dist < 1e-5f) return false;
            float radio = Math.Max(q.Tam.x, q.Tam.y) * 0.5f * c.EscalaRadio;
            if (!Physics.Raycast(desde, d / dist, out var hit, dist + radio, c.Mascara, QueryTriggerInteraction.Ignore)) return false;
            var nrm = hit.normal;
            var vMundo = mundo ? vel : transform.rotation * vel;
            float vn = Vector3.Dot(vMundo, nrm);
            if (vn >= 0) return false;
            float rebote = c.Rebote.Eval(t, Hash(q.Semilla, 19)), amortiguar = c.Amortiguar.Eval(t, Hash(q.Semilla, 20));
            var vNueva = (vMundo - nrm * (vn * (1 + rebote))) * (1 - Math.Clamp(amortiguar, 0, 1));
            float sp = vNueva.magnitude;
            if (sp < c.MatarMin || sp > c.MatarMax) return true;
            var pMundo = hit.point + nrm * Math.Max(radio, 0.001f);
            nueva = mundo ? pMundo : marco.inverse.MultiplyPoint3x4(pMundo);
            q.Vel = (mundo ? vNueva : inv * vNueva) - va;
            float perdida = c.PerdidaVida.Eval(t, Hash(q.Semilla, 22));
            if (perdida > 0) { q.Edad += perdida * q.Vida; if (q.Edad >= q.Vida) return true; }
            if (subs) Subs(1, nueva, q.Vel, 1);
            return false;
        }

        // ── sub-emisores ──
        // muerte y colisión: lo que el sub-emisor tiene en sus ráfagas, donde pasó
        void Subs(int tipo, Vector3 posSim, Vector3 velSim, int veces)
        {
            var mundoPos = EnMundo ? posSim : transform.TransformPoint(posSim);
            foreach (var s in aj.Subs)
            {
                if (s.Tipo != tipo || s.Sistema == null || s.Sistema.destruido) continue;
                if (s.Probabilidad < 1 && Azar() > s.Probabilidad) continue;
                var h = s.Sistema;
                int k = 0;
                foreach (var b in h.aj.Rafagas) k += (int)(b.Cantidad.Eval(0, h.Azar()) + 0.5f) * b.Ciclos;
                for (int i = 0; i < k * veces; i++) h.NacerEn(mundoPos, 0);
            }
        }

        // nacimiento: cada partícula viva emite con la tasa (y las ráfagas) del sub-emisor
        void SubsNacimiento(ref Part q, float edadPrevia, float dt)
        {
            Vector3? mundoPos = null;
            foreach (var s in aj.Subs)
            {
                if (s.Tipo != 0 || s.Sistema == null || s.Sistema.destruido) continue;
                var h = s.Sistema;
                var ha = h.aj;
                int k = 0;
                if (ha.Emision)
                {
                    float tasa = ha.PorTiempo.Eval(Math.Min(q.Edad / ha.Duracion, 1), h.Azar());
                    q.AcumSub += tasa * dt;
                    k = (int)q.AcumSub;
                    q.AcumSub -= k;
                    foreach (var b in ha.Rafagas)
                        if (b.Tiempo >= edadPrevia && b.Tiempo < q.Edad) k += (int)(b.Cantidad.Eval(0, h.Azar()) + 0.5f);
                }
                if (k == 0) continue;
                mundoPos ??= EnMundo ? q.Pos : transform.TransformPoint(q.Pos);
                for (int i = 0; i < k; i++) h.NacerEn(mundoPos.Value, Azar() * dt);
            }
        }

        // una partícula de este sistema (como sub-emisor) con la forma centrada en un punto del mundo
        internal void NacerEn(Vector3 mundoPos, float edad)
        {
            if (!isActiveAndEnabledGo()) return;
            if (indiceActivo < 0) Porteo.Particulas.Particulas.Alta(this);
            if (!reproduciendo) { reproduciendo = true; emitiendo = false; }
            var t = transform;
            int antes = n;
            Nacer(edad, 1, t.position, t.rotation, 0);
            if (n == antes) return;
            ref var q = ref p[n - 1];
            // la forma da el desplazamiento; el centro es el punto donde pasó el evento
            if (EnMundo) q.Pos += mundoPos - t.position;
            else q.Pos += Quaternion.Inverse(t.rotation) * (mundoPos - t.position);
        }

        bool isActiveAndEnabledGo() => go != null && go.activoEnJerarquia;

        // ── límites (en el mundo) para descartar y ordenar ──
        void Limites(Vector3 pos, Quaternion rot)
        {
            bool conEstelas = estelas != null && !estelas.Vacias;
            if (n == 0 && !conEstelas) { hayLimites = false; limites = new Bounds(pos, Vector3.zero); return; }
            var a = aj;
            Vector3 min = n > 0 ? p[0].Pos : new Vector3(float.MaxValue, float.MaxValue, float.MaxValue), max = n > 0 ? min : -min;
            float tm = 0, vm = 0;
            for (int i = 0; i < n; i++)
            {
                ref var q = ref p[i];
                var x = q.Pos;
                if (x.x < min.x) min.x = x.x; if (x.y < min.y) min.y = x.y; if (x.z < min.z) min.z = x.z;
                if (x.x > max.x) max.x = x.x; if (x.y > max.y) max.y = x.y; if (x.z > max.z) max.z = x.z;
                float s = Math.Max(q.Tam.x, Math.Max(q.Tam.y, q.Tam.z));
                if (s > tm) tm = s;
                float v = (q.Vel + q.VelAnim).sqrMagnitude;
                if (v > vm) vm = v;
            }
            if (conEstelas)
                foreach (var e in estelas.lista)
                {
                    if (!e.Usada) continue;
                    for (int k = 0; k < e.Cuenta; k++) { min = Vector3.Min(min, e.P[k]); max = Vector3.Max(max, e.P[k]); }
                    if (e.Huerfana && e.Ancho > tm) tm = e.Ancho;
                }
            if (a.TamVida) tm *= Math.Max(a.TamVidaX.Cota(), a.TamVidaSeparado ? Math.Max(a.TamVidaY.Cota(), a.TamVidaZ.Cota()) : 0);
            if (a.TamVel) tm *= Math.Max(a.TamVelX.Cota(), a.TamVelSeparado ? Math.Max(a.TamVelY.Cota(), a.TamVelZ.Cota()) : 0);
            tamMax = tm;
            rapidezMax = (float)Math.Sqrt(vm);
            var b = new Bounds((min + max) * 0.5f, max - min);
            if (!EnMundo) b = Porteo.Render.Renders.Transformar(b, Matrix4x4.TRS(pos, rot, Vector3.one));
            float extra = Renderer?.Expansion(tm, rapidezMax) ?? tm;
            b.Expand(extra * 2);
            limites = b;
            hayLimites = true;
        }

        // ── lo que ven los scripts y el renderer de cada partícula ──
        internal Vector3 TamActual(in Part q)
        {
            var a = aj;
            var s = q.Tam;
            float t = q.Edad / q.Vida;
            if (a.TamVida)
            {
                float h = Hash(q.Semilla, 1);
                if (a.TamVidaSeparado) s = Vector3.Scale(s, new Vector3(a.TamVidaX.Eval(t, h), a.TamVidaY.Eval(t, h), a.TamVidaZ.Eval(t, h)));
                else s *= a.TamVidaX.Eval(t, h);
            }
            if (a.TamVel)
            {
                float h = Hash(q.Semilla, 14), k = Rango((q.Vel + q.VelAnim).magnitude, a.TamVelRango);
                if (a.TamVelSeparado) s = Vector3.Scale(s, new Vector3(a.TamVelX.Eval(k, h), a.TamVelY.Eval(k, h), a.TamVelZ.Eval(k, h)));
                else s *= a.TamVelX.Eval(k, h);
            }
            return s;
        }

        internal Color ColorActual(in Part q)
        {
            var a = aj;
            Color c = q.Col;
            if (a.ColorVida) c *= a.ColorEnVida.Eval(q.Edad / q.Vida, Hash(q.Semilla, 3));
            if (a.ColorVel) c *= a.ColorEnVel.Eval(Rango((q.Vel + q.VelAnim).magnitude, a.ColorVelRango), Hash(q.Semilla, 16));
            return c;
        }

        // el cuadro de la hoja de texturas: (columna, fila) del cuadro actual
        internal int CuadroHoja(in Part q)
        {
            var a = aj;
            int total = a.HojaTipo == 1 ? a.HojaX : a.HojaX * a.HojaY;
            float t = q.Edad / q.Vida;
            float x;
            if (a.HojaModoTiempo == 1) x = Rango((q.Vel + q.VelAnim).magnitude, a.HojaRango);
            else if (a.HojaModoTiempo == 2) x = q.Edad * a.HojaFps / total;
            else x = t;
            float cuadro = a.HojaCuadro.Eval(x, Hash(q.Semilla, 23)) * a.HojaCiclos;
            cuadro -= (float)Math.Floor(cuadro);
            int c = (int)(cuadro * total) + (int)(a.HojaInicio.Eval(0, Hash(q.Semilla, 24)) * total);
            c = ((c % total) + total) % total;
            if (a.HojaTipo == 1)
            {
                int fila = a.HojaFilaAzar ? (int)(Hash(q.Semilla, 25) * a.HojaY) % a.HojaY : Math.Clamp(a.HojaFila, 0, a.HojaY - 1);
                return fila * a.HojaX + c;
            }
            return c;
        }

        // ── API ──
        public bool isPlaying => reproduciendo && !pausado;
        public bool isEmitting => reproduciendo && emitiendo && !pausado;
        public bool isStopped => !reproduciendo && !pausado;
        public bool isPaused => pausado;
        public int particleCount => n;
        public float time { get => tiempo; set => tiempo = Math.Clamp(value, 0, aj.Duracion); }
        public uint randomSeed { get => (uint)aj.SemillaFija; set { var a = Modificables(); a.SemillaFija = (int)value; a.SemillaAlAzar = false; } }
        public bool useAutoRandomSeed { get => aj.SemillaAlAzar; set => Modificables().SemillaAlAzar = value; }

        public MainModule main => new MainModule { m_ParticleSystem = this };
        public EmissionModule emission => new EmissionModule { m_ParticleSystem = this };
        public TextureSheetAnimationModule textureSheetAnimation => new TextureSheetAnimationModule { m_ParticleSystem = this };

        // withChildren: también los sistemas de los hijos (activos)
        void Todos(bool hijos, Action<ParticleSystem> f)
        {
            f(this);
            if (!hijos || go == null) return;
            foreach (var h in go.GetComponentsInChildren<ParticleSystem>())
                if (h != this) f(h);
        }

        public void Play() => Play(true);
        public void Play(bool withChildren) => Todos(withChildren, s => { if (!s.esSubEmisor || s == this) s.Reproducir(); });
        public void Stop() => Stop(true, ParticleSystemStopBehavior.StopEmitting);
        public void Stop(bool withChildren) => Stop(withChildren, ParticleSystemStopBehavior.StopEmitting);
        public void Stop(bool withChildren, ParticleSystemStopBehavior stopBehavior) => Todos(withChildren, s => s.Detener(stopBehavior));
        public void Pause() => Pause(true);
        public void Pause(bool withChildren) => Todos(withChildren, s => { if (s.reproduciendo) s.pausado = true; });
        public void Clear() => Clear(true);
        public void Clear(bool withChildren) => Todos(withChildren, s => s.Limpiar());
        public bool IsAlive() => IsAlive(true);

        public bool IsAlive(bool withChildren)
        {
            bool vivo = false;
            Todos(withChildren, s => vivo |= s.n > 0 || (s.reproduciendo && s.emitiendo && !s.esSubEmisor));
            return vivo;
        }

        public void Emit(int count)
        {
            if (indiceActivo < 0 && go != null && go.activoEnJerarquia) Porteo.Particulas.Particulas.Alta(this);
            var t = transform;
            if (!hayPrevia) { posPrevia = t.position; hayPrevia = true; }
            for (int i = 0; i < count; i++) Nacer(0, 1, t.position, t.rotation, aj.Duracion > 0 ? tiempo / aj.Duracion : 0);
            if (!reproduciendo) { reproduciendo = true; emitiendo = false; }
            Limites(t.position, t.rotation);
        }

        public void Simulate(float t) => Simulate(t, true, true, true);
        public void Simulate(float t, bool withChildren) => Simulate(t, withChildren, true, true);
        public void Simulate(float t, bool withChildren, bool restart) => Simulate(t, withChildren, restart, true);

        // como Unity: avanza t segundos de golpe y deja el sistema en pausa
        public void Simulate(float t, bool withChildren, bool restart, bool fixedTimeStep)
        {
            Todos(withChildren, s =>
            {
                if (restart) { s.Limpiar(); s.reproduciendo = false; }
                if (!s.reproduciendo)
                {
                    s.Reiniciar();
                    s.reproduciendo = true;
                    s.emitiendo = !s.esSubEmisor;
                    if (s.aj.Precalentar && s.aj.Bucle) s.Precalentar();
                }
                if (s.indiceActivo < 0 && s.go != null && s.go.activoEnJerarquia) Porteo.Particulas.Particulas.Alta(s);
                float resto = t;
                while (resto > 1e-6f) { float d = Math.Min(resto, 1 / 30f); s.Paso(d); resto -= d; }
                s.pausado = true;
            });
        }

        public int GetParticles(Particle[] particles) => GetParticles(particles, particles?.Length ?? 0);

        public int GetParticles(Particle[] particles, int size)
        {
            if (particles == null) return 0;
            int k = Math.Min(Math.Min(n, size), particles.Length);
            for (int i = 0; i < k; i++)
            {
                ref var q = ref p[i];
                particles[i] = new Particle
                {
                    m_Position = q.Pos, m_Velocity = q.Vel, m_AnimatedVelocity = q.VelAnim, m_Rotation = q.Rot, m_AngularVelocity = q.VelAng,
                    m_StartSize = q.Tam, m_StartColor = q.Col, m_RandomSeed = q.Semilla, m_Lifetime = q.Vida - q.Edad, m_StartLifetime = q.Vida,
                    m_AxisOfRotation = new Vector3(0, 0, 1), m_Flags = q.Signo < 0 ? 1u : 0u,
                };
            }
            return k;
        }

        public void SetParticles(Particle[] particles) => SetParticles(particles, particles?.Length ?? 0);

        public void SetParticles(Particle[] particles, int size)
        {
            if (particles == null) return;
            int k = Math.Min(Math.Min(size, particles.Length), Math.Max(aj.Maximo, 0));
            if (p.Length < k) p = new Part[k];
            int vivas = 0;
            for (int i = 0; i < k; i++)
            {
                var x = particles[i];
                if (x.m_Lifetime <= 0) continue;
                p[vivas++] = new Part
                {
                    Pos = x.m_Position, Vel = x.m_Velocity, VelAnim = x.m_AnimatedVelocity, Rot = x.m_Rotation, VelAng = x.m_AngularVelocity,
                    Tam = x.m_StartSize, Col = x.m_StartColor, Semilla = x.m_RandomSeed, Vida = Math.Max(x.m_StartLifetime, 1e-4f),
                    Edad = Math.Max(0, x.m_StartLifetime - x.m_Lifetime), Signo = (x.m_Flags & 1) != 0 ? -1 : 1, Estela = -1,
                };
            }
            n = vivas;
            var t = transform;
            Limites(t.position, t.rotation);
        }

        // ── los tipos de la API ──
        public partial struct MainModule
        {
            public ParticleSystem m_ParticleSystem;
            ParticleSystem S => m_ParticleSystem;
            public float duration { get => S.aj.Duracion; set => S.Modificables().Duracion = Math.Max(value, 0.05f); }
            public bool loop { get => S.aj.Bucle; set => S.Modificables().Bucle = value; }
            public bool prewarm { get => S.aj.Precalentar; set => S.Modificables().Precalentar = value; }
            public bool playOnAwake { get => S.aj.AlDespertar; set => S.Modificables().AlDespertar = value; }
            public float simulationSpeed { get => S.aj.Velocidad; set => S.Modificables().Velocidad = value; }
            public bool useUnscaledTime { get => S.aj.SinEscala; set => S.Modificables().SinEscala = value; }
            public int maxParticles { get => S.aj.Maximo; set => S.Modificables().Maximo = Math.Max(0, value); }
            public ParticleSystemSimulationSpace simulationSpace { get => (ParticleSystemSimulationSpace)S.aj.Espacio; set => S.Modificables().Espacio = (int)value; }
            public MinMaxGradient startColor { get => S.aj.ColorInicial.API(); set => S.Modificables().ColorInicial = Degradado.De(value); }
            public MinMaxCurve startLifetime { get => S.aj.Vida.API(); set => S.Modificables().Vida = Curva.De(value); }
            public MinMaxCurve startSpeed { get => S.aj.Rapidez.API(); set => S.Modificables().Rapidez = Curva.De(value); }
            public MinMaxCurve startSize { get => S.aj.Tam.API(); set => S.Modificables().Tam = Curva.De(value); }
            public MinMaxCurve startRotation { get => S.aj.Rot.API(); set => S.Modificables().Rot = Curva.De(value); }
            public MinMaxCurve startDelay { get => S.aj.Demora.API(); set => S.Modificables().Demora = Curva.De(value); }
            public MinMaxCurve gravityModifier { get => S.aj.Gravedad.API(); set => S.Modificables().Gravedad = Curva.De(value); }
            public float startLifetimeMultiplier { get => S.aj.Vida.Max; set { var c = Curva.De(S.aj.Vida.API()); c.Max = value; S.Modificables().Vida = c; } }
            public float startSpeedMultiplier { get => S.aj.Rapidez.Max; set { var c = Curva.De(S.aj.Rapidez.API()); c.Max = value; S.Modificables().Rapidez = c; } }
            public float startSizeMultiplier { get => S.aj.Tam.Max; set { var c = Curva.De(S.aj.Tam.API()); c.Max = value; S.Modificables().Tam = c; } }
        }

        public partial struct EmissionModule
        {
            public ParticleSystem m_ParticleSystem;
            ParticleSystem S => m_ParticleSystem;
            public bool enabled { get => S.aj.Emision; set => S.Modificables().Emision = value; }
            public MinMaxCurve rateOverTime { get => S.aj.PorTiempo.API(); set => S.Modificables().PorTiempo = Curva.De(value); }
            public MinMaxCurve rateOverDistance { get => S.aj.PorDistancia.API(); set => S.Modificables().PorDistancia = Curva.De(value); }
            public float rateOverTimeMultiplier { get => S.aj.PorTiempo.Max; set { var c = Curva.De(S.aj.PorTiempo.API()); c.Max = value; S.Modificables().PorTiempo = c; } }
            public int burstCount => S.aj.Rafagas.Length;
        }

        public partial struct TextureSheetAnimationModule
        {
            public ParticleSystem m_ParticleSystem;
            ParticleSystem S => m_ParticleSystem;
            public bool enabled { get => S.aj.Hoja; set => S.Modificables().Hoja = value; }
            public int numTilesX { get => S.aj.HojaX; set => S.Modificables().HojaX = Math.Max(1, value); }
            public int numTilesY { get => S.aj.HojaY; set => S.Modificables().HojaY = Math.Max(1, value); }
            public MinMaxCurve frameOverTime { get => S.aj.HojaCuadro.API(); set => S.Modificables().HojaCuadro = Curva.De(value); }
            public int cycleCount { get => (int)S.aj.HojaCiclos; set => S.Modificables().HojaCiclos = Math.Max(1, value); }
        }

        public partial struct MinMaxCurve
        {
            public ParticleSystemCurveMode m_Mode;
            public float m_CurveMultiplier;
            public AnimationCurve m_CurveMin;
            public AnimationCurve m_CurveMax;
            public float m_ConstantMin;
            public float m_ConstantMax;

            public MinMaxCurve(float constant) { this = default; m_Mode = ParticleSystemCurveMode.Constant; m_ConstantMax = m_ConstantMin = constant; m_CurveMultiplier = 1; }
            public MinMaxCurve(float multiplier, AnimationCurve curve) { this = default; m_Mode = ParticleSystemCurveMode.Curve; m_CurveMultiplier = multiplier; m_CurveMax = curve; }
            public MinMaxCurve(float multiplier, AnimationCurve min, AnimationCurve max) { this = default; m_Mode = ParticleSystemCurveMode.TwoCurves; m_CurveMultiplier = multiplier; m_CurveMin = min; m_CurveMax = max; }
            public MinMaxCurve(float min, float max) { this = default; m_Mode = ParticleSystemCurveMode.TwoConstants; m_ConstantMin = min; m_ConstantMax = max; m_CurveMultiplier = 1; }

            public ParticleSystemCurveMode mode { get => m_Mode; set => m_Mode = value; }
            public float curveMultiplier { get => m_CurveMultiplier; set => m_CurveMultiplier = value; }
            public AnimationCurve curveMax { get => m_CurveMax; set => m_CurveMax = value; }
            public AnimationCurve curveMin { get => m_CurveMin; set => m_CurveMin = value; }
            public float constantMax { get => m_ConstantMax; set => m_ConstantMax = value; }
            public float constantMin { get => m_ConstantMin; set => m_ConstantMin = value; }
            public float constant { get => m_ConstantMax; set => m_ConstantMax = value; }
            public AnimationCurve curve { get => m_CurveMax; set => m_CurveMax = value; }

            public float Evaluate(float time) => Evaluate(time, 1f);

            public float Evaluate(float time, float lerpFactor)
            {
                switch (m_Mode)
                {
                    case ParticleSystemCurveMode.Constant: return m_ConstantMax;
                    case ParticleSystemCurveMode.Curve: return (m_CurveMax?.Evaluate(time) ?? 0) * m_CurveMultiplier;
                    case ParticleSystemCurveMode.TwoCurves:
                    {
                        float a = m_CurveMin?.Evaluate(time) ?? 0, b = m_CurveMax?.Evaluate(time) ?? 0;
                        return (a + (b - a) * lerpFactor) * m_CurveMultiplier;
                    }
                    default: return m_ConstantMin + (m_ConstantMax - m_ConstantMin) * lerpFactor;
                }
            }

            public static implicit operator MinMaxCurve(float constant) => new MinMaxCurve(constant);
        }

        public partial struct MinMaxGradient
        {
            public ParticleSystemGradientMode m_Mode;
            public Gradient m_GradientMin;
            public Gradient m_GradientMax;
            public Color m_ColorMin;
            public Color m_ColorMax;

            public MinMaxGradient(Color color) { this = default; m_Mode = ParticleSystemGradientMode.Color; m_ColorMin = m_ColorMax = color; }
            public MinMaxGradient(Gradient gradient) { this = default; m_Mode = ParticleSystemGradientMode.Gradient; m_GradientMax = gradient; }
            public MinMaxGradient(Color min, Color max) { this = default; m_Mode = ParticleSystemGradientMode.TwoColors; m_ColorMin = min; m_ColorMax = max; }
            public MinMaxGradient(Gradient min, Gradient max) { this = default; m_Mode = ParticleSystemGradientMode.TwoGradients; m_GradientMin = min; m_GradientMax = max; }

            public ParticleSystemGradientMode mode { get => m_Mode; set => m_Mode = value; }
            public Color color { get => m_ColorMax; set => m_ColorMax = value; }
            public Color colorMin { get => m_ColorMin; set => m_ColorMin = value; }
            public Color colorMax { get => m_ColorMax; set => m_ColorMax = value; }
            public Gradient gradient { get => m_GradientMax; set => m_GradientMax = value; }
            public Gradient gradientMin { get => m_GradientMin; set => m_GradientMin = value; }
            public Gradient gradientMax { get => m_GradientMax; set => m_GradientMax = value; }

            public Color Evaluate(float time) => Evaluate(time, 1f);

            public Color Evaluate(float time, float lerpFactor)
            {
                switch (m_Mode)
                {
                    case ParticleSystemGradientMode.Color: return m_ColorMax;
                    case ParticleSystemGradientMode.Gradient: return m_GradientMax?.Evaluate(time) ?? Color.white;
                    case ParticleSystemGradientMode.TwoColors: return Color.Lerp(m_ColorMin, m_ColorMax, lerpFactor);
                    case ParticleSystemGradientMode.TwoGradients: return Color.Lerp(m_GradientMin?.Evaluate(time) ?? Color.white, m_GradientMax?.Evaluate(time) ?? Color.white, lerpFactor);
                    default: return m_GradientMax?.Evaluate(lerpFactor) ?? Color.white;
                }
            }

            public static implicit operator MinMaxGradient(Color color) => new MinMaxGradient(color);
            public static implicit operator MinMaxGradient(Gradient gradient) => new MinMaxGradient(gradient);
        }

        public partial struct Particle
        {
            public Vector3 m_Position;
            public Vector3 m_Velocity;
            public Vector3 m_AnimatedVelocity;
            public Vector3 m_InitialVelocity;
            public Vector3 m_AxisOfRotation;
            public Vector3 m_Rotation;
            public Vector3 m_AngularVelocity;
            public Vector3 m_StartSize;
            public Color32 m_StartColor;
            public uint m_RandomSeed;
            public float m_Lifetime;
            public float m_StartLifetime;
            public float m_EmitAccumulator0;
            public float m_EmitAccumulator1;
            public uint m_Flags;

            public Vector3 position { get => m_Position; set => m_Position = value; }
            public Vector3 velocity { get => m_Velocity; set => m_Velocity = value; }
            public Vector3 animatedVelocity => m_AnimatedVelocity;
            public Vector3 totalVelocity => m_Velocity + m_AnimatedVelocity;
            public float remainingLifetime { get => m_Lifetime; set => m_Lifetime = value; }
            public float startLifetime { get => m_StartLifetime; set => m_StartLifetime = value; }
            public Color32 startColor { get => m_StartColor; set => m_StartColor = value; }
            public uint randomSeed { get => m_RandomSeed; set => m_RandomSeed = value; }
            public float startSize { get => m_StartSize.x; set => m_StartSize = new Vector3(value, value, value); }
            public Vector3 startSize3D { get => m_StartSize; set => m_StartSize = value; }
            public float rotation { get => m_Rotation.z * Mathf.Rad2Deg; set => m_Rotation = new Vector3(0, 0, value * Mathf.Deg2Rad); }
            public Vector3 rotation3D { get => m_Rotation * Mathf.Rad2Deg; set => m_Rotation = value * Mathf.Deg2Rad; }
            public float angularVelocity { get => m_AngularVelocity.z * Mathf.Rad2Deg; set => m_AngularVelocity = new Vector3(0, 0, value * Mathf.Deg2Rad); }
            public Vector3 angularVelocity3D { get => m_AngularVelocity * Mathf.Rad2Deg; set => m_AngularVelocity = value * Mathf.Deg2Rad; }
            public Vector3 axisOfRotation { get => m_AxisOfRotation; set => m_AxisOfRotation = value; }

            internal Part Interna() => new Part
            {
                Pos = m_Position, Vel = m_Velocity, VelAnim = m_AnimatedVelocity, Rot = m_Rotation, Tam = m_StartSize, Col = m_StartColor,
                Semilla = m_RandomSeed, Vida = Math.Max(m_StartLifetime, 1e-4f), Edad = Math.Clamp(m_StartLifetime - m_Lifetime, 0, Math.Max(m_StartLifetime, 1e-4f)),
                Signo = (m_Flags & 1) != 0 ? -1 : 1,
            };

            public float GetCurrentSize(ParticleSystem system) => GetCurrentSize3D(system).x;
            public Vector3 GetCurrentSize3D(ParticleSystem system) => system == null ? m_StartSize : system.TamActual(Interna());
            public Color32 GetCurrentColor(ParticleSystem system) => system == null ? m_StartColor : (Color32)system.ColorActual(Interna());
        }
    }
}

namespace Porteo.Particulas
{
    internal static class Extensiones
    {
        // de vuelta a la API (main.startColor)
        public static ParticleSystem.MinMaxGradient API(this Degradado d) => new ParticleSystem.MinMaxGradient
        {
            m_Mode = (ParticleSystemGradientMode)d.Modo, m_ColorMin = d.CMin, m_ColorMax = d.CMax, m_GradientMin = d.GMin, m_GradientMax = d.GMax,
        };
    }
}

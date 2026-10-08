using System;
using System.Collections.Generic;
using Porteo.Datos;
using Porteo.Playables;
using UnityEngine.Animations;
using UnityEngine.Audio;
using Object = UnityEngine.Object;

namespace UnityEngine.Playables
{
    // El componente que reproduce un PlayableAsset (una Timeline): arma el grafo con el asset, enlaza
    // cada salida con lo que la escena le asignó (m_SceneBindings: pista → Animator, AudioSource o
    // GameObject) y lo evalúa cada cuadro con su tiempo. Como Unity: Play arma el grafo si no está,
    // Pause lo deja quieto, Stop lo destruye (y Timeline deja los objetos como corresponde).
    public class PlayableDirector : Behaviour, IExposedPropertyTable
    {
        PlayableAsset asset;
        PlayState estadoInicial;
        DirectorWrapMode envolver = DirectorWrapMode.Hold;
        DirectorUpdateMode modo = DirectorUpdateMode.GameTime;
        double tiempoInicial, tiempo;
        readonly Dictionary<Object, Object> enlaces = new Dictionary<Object, Object>();
        readonly Dictionary<PropertyName, Object> referencias = new Dictionary<PropertyName, Object>();
        Grafo grafo;
        Nodo raiz;
        PlayState estado = PlayState.Paused;
        bool desperto;

        public event Action<PlayableDirector> played, paused, stopped;

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            asset = r.Resolver(m.P("m_PlayableAsset")) as PlayableAsset;
            estadoInicial = (PlayState)m.I32("m_InitialState");
            envolver = (DirectorWrapMode)m.I32("m_WrapMode", 0);
            modo = (DirectorUpdateMode)m.I32("m_DirectorUpdateMode", 1);
            tiempoInicial = m.F("m_InitialTime");
            var l = m.L("m_SceneBindings");
            if (l != null)
                foreach (var x in l)
                {
                    if (!(x is Mapa par)) continue;
                    var k = r.Resolver(par.P("key"));
                    if (k != null) enlaces[k] = r.Resolver(par.P("value"));
                }
            var refs = m.M("m_ExposedReferences")?.L("m_References");
            if (refs != null)
                foreach (var x in refs)
                {
                    string nombre = null; PPtr p = default;
                    if (x is Mapa mp) { nombre = mp.S("first") ?? mp.M("first")?.S("id"); p = mp.P("second"); }
                    else if (x is List<object> lp && lp.Count == 2) { nombre = lp[0] as string; if (lp[1] is PPtr pp) p = pp; }
                    if (nombre != null) referencias[new PropertyName(nombre)] = r.Resolver(p);
                }
        }

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            base.CopiarDe(o, remap);
            var x = (PlayableDirector)o;
            asset = x.asset; estadoInicial = x.estadoInicial; envolver = x.envolver; modo = x.modo; tiempoInicial = x.tiempoInicial;
            foreach (var kv in x.enlaces) enlaces[kv.Key] = remap(kv.Value);
            foreach (var kv in x.referencias) referencias[kv.Key] = remap(kv.Value);
        }

        internal override void AlActivarse()
        {
            if (!Directores.activos.Contains(this)) Directores.activos.Add(this);
            // Play On Awake: una vez, cuando el componente despierta
            if (!desperto)
            {
                desperto = true;
                tiempo = tiempoInicial;
                if (estadoInicial == PlayState.Playing && asset != null) Play();
            }
        }

        internal override void AlDesactivarse() => Directores.activos.Remove(this);

        internal override void AlDestruirse()
        {
            Directores.activos.Remove(this);
            Destruir();
        }

        // ── propiedades ──
        public PlayState state => estado;
        public DirectorWrapMode extrapolationMode
        {
            get => envolver;
            set { envolver = value; if (raiz != null && !raiz.Destruido) raiz.Envolver = value; }
        }
        public PlayableAsset playableAsset
        {
            get => asset;
            set
            {
                if (asset == value) return;
                Destruir();
                asset = value;
            }
        }
        public PlayableGraph playableGraph => new PlayableGraph(grafo != null && !grafo.Destruido ? grafo : null);
        public bool playOnAwake { get => estadoInicial == PlayState.Playing; set => estadoInicial = value ? PlayState.Playing : PlayState.Paused; }
        public DirectorUpdateMode timeUpdateMode { get => modo; set { modo = value; if (grafo != null) grafo.Modo = value; } }
        public double time
        {
            get => tiempo;
            set
            {
                tiempo = value;
                if (raiz != null && !raiz.Destruido) raiz.PonerTiempo(value);
            }
        }
        public double initialTime { get => tiempoInicial; set => tiempoInicial = value; }
        public double duration => asset != null ? asset.duration : 0;

        // ── reproducción ──
        public void Play()
        {
            if (asset == null) return;
            if (grafo == null || grafo.Destruido) Armar();
            if (grafo == null) return;
            raiz?.PonerTiempo(tiempo);
            if (raiz != null) raiz.Reproduciendo = true;
            grafo.Reproducir();
            bool antes = estado == PlayState.Playing;
            estado = PlayState.Playing;
            if (!antes) played?.Invoke(this);
        }

        public void Play(PlayableAsset asset) { playableAsset = asset; Play(); }
        public void Play(PlayableAsset asset, DirectorWrapMode mode) { playableAsset = asset; extrapolationMode = mode; Play(); }
        public void Play(FrameRate frameRate) => Play();

        public void Pause()
        {
            if (estado != PlayState.Playing) return;
            estado = PlayState.Paused;
            grafo?.Detener();
            paused?.Invoke(this);
        }

        // como Unity: sigue lo que está en pausa; un director parado (Stop) no vuelve a arrancar. En
        // Bad Parenting, con cuadros lentos dos señales caen juntas: la del diálogo pausa, la del
        // final para, y al terminar el diálogo su Resume volvía a empezar la escena entera
        public void Resume()
        {
            if (grafo == null || grafo.Destruido) return;
            if (estado == PlayState.Playing) return;
            grafo.Reproducir();
            estado = PlayState.Playing;
            played?.Invoke(this);
        }

        public void Stop()
        {
            bool habia = grafo != null && !grafo.Destruido;
            Destruir();
            tiempo = tiempoInicial;
            estado = PlayState.Paused;
            if (habia) stopped?.Invoke(this);
        }

        public void Evaluate()
        {
            if (asset == null) return;
            if (grafo == null || grafo.Destruido) Armar();
            if (grafo == null) return;
            raiz?.PonerTiempo(tiempo);
            grafo.Evaluar(0, false);
        }

        public void DeferredEvaluate() => Evaluate();
        public void RebuildGraph() { bool ib = estado == PlayState.Playing; Destruir(); Armar(); if (ib) Play(); }

        void Destruir()
        {
            if (grafo == null) return;
            var g = grafo;
            grafo = null;
            raiz = null;
            g.Destruir();
        }

        // el grafo del asset con sus salidas enlazadas a la escena
        void Armar()
        {
            var g = new Grafo(name) { Director = this, Resolvedor = this, Modo = modo };
            grafo = g;
            var pg = new PlayableGraph(g);
            Playable p;
            try { p = asset.CreatePlayable(pg, gameObject); }
            catch (Exception e)
            {
                Debug.LogException(e, this);
                Destruir();
                return;
            }
            raiz = p.GetHandle().m_Nodo;
            if (raiz != null)
            {
                double d = asset.duration;
                if (d > 0 && d < double.PositiveInfinity) raiz.Duracion = d;
                // la raíz con el modo del director (como Unity): las señales (TimeNotificationBehaviour)
                // lo copian de ella, y con el Loop de cualquier Playable la del final de una Timeline
                // que termina (None) no se disparaba nunca: en Bad Parenting el jugador quedaba sin control
                raiz.Envolver = envolver;
                raiz.PonerTiempo(tiempo);
            }
            foreach (var s in g.Salidas.ToArray()) Enlazar(s);
        }

        void Enlazar(Salida s)
        {
            if (s.Referencia == null) return;
            enlaces.TryGetValue(s.Referencia, out var o);
            var go = o as GameObject ?? (o as Component)?.gameObject;
            if (s.Tipo == typeof(AnimationPlayableOutput))
            {
                var an = o as Animator ?? go?.GetComponent<Animator>();
                if (an != null) new AnimationPlayableOutput(new PlayableOutputHandle(s)).SetTarget(an);
            }
            else if (s.Tipo == typeof(AudioPlayableOutput))
            {
                var au = o as AudioSource ?? go?.GetComponent<AudioSource>();
                if (au != null) new AudioPlayableOutput(new PlayableOutputHandle(s)).SetTarget(au);
            }
            else if (s.DatosUsuario == null) s.DatosUsuario = o;
            // las señales de una pista van a los receptores (SignalReceiver...) del objeto enlazado
            if (go != null)
                foreach (var c in go.GetComponents<Component>())
                    if (c is INotificationReceiver nr && !s.Receptores.Contains(nr)) s.Receptores.Add(nr);
        }

        // cada cuadro (Directores, después de Update)
        internal void Cuadro()
        {
            if (grafo == null || grafo.Destruido) return;
            if (estado != PlayState.Playing)
            {
                foreach (var s in grafo.Salidas) if (s.Mezclador != null) AnimacionTimeline.Repetir(s);
                return;
            }
            if (modo == DirectorUpdateMode.Manual) return;
            double dt = modo == DirectorUpdateMode.UnscaledGameTime ? Time.unscaledDeltaTime : Time.deltaTime;
            tiempo += dt;
            double d = duration;
            bool fin = false;
            if (d > 0 && d < double.PositiveInfinity && tiempo >= d)
            {
                switch (envolver)
                {
                    case DirectorWrapMode.Loop: tiempo %= d; break;
                    case DirectorWrapMode.Hold: tiempo = d; break;
                    default: tiempo = d; fin = true; break;
                }
            }
            if (raiz != null && !raiz.Destruido)
            {
                raiz.TiempoPrevio = raiz.Tiempo;
                raiz.Tiempo = tiempo;
                raiz.CuadroTiempoPuesto = grafo.Cuadro + 1;
            }
            grafo.Evaluar(dt, true);
            if (fin) Stop();
        }

        // ── enlaces ──
        public Object GetGenericBinding(Object key) => key != null && enlaces.TryGetValue(key, out var o) ? o : null;
        public void SetGenericBinding(Object key, Object value)
        {
            if (key == null) return;
            enlaces[key] = value;
            if (grafo != null)
                foreach (var s in grafo.Salidas.ToArray()) if (s.Referencia == key) Enlazar(s);
        }
        public void ClearGenericBinding(Object key) { if (key != null) enlaces.Remove(key); }

        public void SetReferenceValue(PropertyName id, Object value) => referencias[id] = value;
        public Object GetReferenceValue(PropertyName id, out bool idValid)
        {
            idValid = referencias.TryGetValue(id, out var o);
            return o;
        }
        public void ClearReferenceValue(PropertyName id) => referencias.Remove(id);
    }
}

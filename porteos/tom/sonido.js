// Los sonidos de My Talking Tom con Web Audio: cada evento (AudioEventData de Outfit7.Audio, en
// sonido/eventos.json) con sus clips, cómo los elige (en orden o al azar sin repetir), cómo los repite
// (una vez, el mismo en bucle o uno tras otro), su volumen, su tono y sus fundidos.
//
//   const s = new Sonido('datos/sonido/', await (await fetch('datos/sonido/eventos.json')).json());
//   s.desbloquear();                         // en el primer toque (los navegadores lo piden)
//   const r = s.tocar('Poke-PokeBelly.Audio');  r.parar();
//   s.tocar(s.deAnimacion('PokeBelly'));

const SECUENCIAL = 0, AZAR_SIN_REPETIR = 1;
const UNA_VEZ = 0, BUCLE_UNO = 1, BUCLE_CICLO = 2;
const SOLAPE = 1 / 30;           // StitchingOverlappingOffset: lo que se pisan dos clips seguidos

export class Sonido {
  constructor(base, tabla) {
    this.base = base;
    this.eventos = tabla.eventos;
    this.animacion = tabla.animacion || {};
    this.buffers = new Map();     // clip → Promise<AudioBuffer>
    this.estado = new Map();      // evento → {indice, bolsa}
    this.sonando = new Set();
    this.ctx = null;
    this.volumen = 1;
    this.mudo = false;
  }

  contexto() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.salida = this.ctx.createGain();
      this.salida.connect(this.ctx.destination);
      this.ponerVolumen(this.volumen);
    }
    return this.ctx;
  }

  desbloquear() {
    const c = this.contexto();
    if (c.state !== 'running') c.resume();
  }

  ponerVolumen(v) {
    this.volumen = v;
    if (this.salida) this.salida.gain.value = this.mudo ? 0 : v;
  }

  silenciar(si) { this.mudo = si; this.ponerVolumen(this.volumen); }

  deAnimacion(campo) { return this.animacion[campo] || null; }

  buffer(clip) {
    let p = this.buffers.get(clip);
    if (!p) {
      p = fetch(`${this.base}clips/${encodeURIComponent(clip)}.ogg`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status} ${clip}`))))
        .then((b) => this.contexto().decodeAudioData(b))
        .catch((e) => { console.warn('sonido', clip, e.message || e); return null; });
      this.buffers.set(clip, p);
    }
    return p;
  }

  // Precarga los clips de unos eventos (para que el primer toque no llegue tarde).
  precargar(nombres) {
    for (const n of nombres) {
      const e = this.eventos[n];
      if (e) for (const c of e.clips) if (c.clip) this.buffer(c.clip);
    }
  }

  // Qué clip toca ahora (InitClipSequential / InitClipRandomNoRepeat)
  elegir(nombre, e, est) {
    const n = e.clips.length;
    if (n <= 1) return 0;
    if (e.modo === AZAR_SIN_REPETIR) {
      // una bolsa con todos en orden al azar; al vaciarse se rellena sin repetir el último
      if (!est.bolsa || est.bolsa.length <= 1) {
        const resto = est.bolsa || [];
        const nuevos = [...Array(n).keys()].filter((i) => !resto.includes(i));
        for (let i = nuevos.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [nuevos[i], nuevos[j]] = [nuevos[j], nuevos[i]];
        }
        est.bolsa = resto.concat(nuevos);
      }
      return est.bolsa.shift();
    }
    const i = est.indice % n;
    est.indice = (i + 1) % n;
    return i;
  }

  // Toca un evento. Devuelve un objeto con parar(inmediato) y la promesa del fin.
  tocar(nombre, { vol = 1, pitch = 1, demora = 0, desde = 0, persistente = false } = {}) {
    const e = nombre && this.eventos[nombre];
    const r = { nombre, parado: false, parar: () => {}, fin: Promise.resolve() };
    if (!e || !e.clips.length) return r;
    const ctx = this.contexto();
    let est = this.estado.get(nombre);
    if (!est || !persistente) {
      // cada AudioEvent nuevo arranca la elección de cero (ResetPlaybackMode)
      est = { indice: 0, bolsa: null };
      if (persistente) this.estado.set(nombre, est);
    }
    const ganancia = ctx.createGain();
    ganancia.connect(this.salida);
    const volEv = (e.vol ?? 1) * vol;
    const [fIn, fOut] = e.fundido || [0, 0];
    let t = ctx.currentTime + demora;
    if (fIn > 0) { ganancia.gain.setValueAtTime(0, t); ganancia.gain.linearRampToValueAtTime(1, t + fIn); }
    const fuentes = [];
    let terminar;
    r.fin = new Promise((ok) => { terminar = ok; });
    const siguiente = async (primero) => {
      if (r.parado) return;
      const k = this.elegir(nombre, e, est);
      const def = e.clips[k];
      const buf = def.clip ? await this.buffer(def.clip) : null;
      if (r.parado) return;
      if (!buf) { if (e.bucle !== BUCLE_CICLO) terminar(); return; }
      const f = ctx.createBufferSource();
      f.buffer = buf;
      f.playbackRate.value = (e.pitch ?? 1) * (def.pitch ?? 1) * pitch;
      const g = ctx.createGain();
      g.gain.value = volEv * (def.vol ?? 1);
      f.connect(g); g.connect(ganancia);
      if (e.bucle === BUCLE_UNO) f.loop = true;
      const ahora = Math.max(ctx.currentTime, t);
      f.start(ahora, primero ? Math.min(desde, buf.duration) : 0);
      fuentes.push(f);
      this.sonando.add(r);
      const dur = (buf.duration - (primero ? desde : 0)) / f.playbackRate.value;
      if (e.bucle === BUCLE_CICLO) {
        // el próximo clip empieza un poco antes de que termine éste
        t = ahora + Math.max(0.01, dur - SOLAPE);
        setTimeout(() => siguiente(false), Math.max(0, (t - ctx.currentTime - 0.1) * 1000));
      } else if (e.bucle === UNA_VEZ) {
        f.onended = () => { this.sonando.delete(r); terminar(); };
      }
    };
    siguiente(true);
    r.parar = (inmediato = false) => {
      if (r.parado) return;
      r.parado = true;
      const ahora = ctx.currentTime;
      const fo = inmediato ? 0 : fOut;
      if (fo > 0) {
        ganancia.gain.cancelScheduledValues(ahora);
        ganancia.gain.setValueAtTime(ganancia.gain.value, ahora);
        ganancia.gain.linearRampToValueAtTime(0, ahora + fo);
      }
      for (const f of fuentes) { try { f.stop(ahora + fo); } catch (x) { /* ya paró */ } }
      this.sonando.delete(r);
      terminar();
    };
    return r;
  }

  pararTodo() { for (const r of [...this.sonando]) r.parar(true); }
}

// El sintetizador y el reloj. Nada de archivos: todo se fabrica al vuelo.
//
// POR QUE EL RELOJ ES EL DE AUDIO Y NO requestAnimationFrame.
// rAF late lo que tarda el cuadro, y eso se mueve: en un teléfono que baja a
// 40 cuadros, un reloj contado con rAF se corre varios milisegundos por
// segundo y a los treinta segundos la canción y las notas ya no coinciden.
// `AudioContext.currentTime` lo lleva el hardware de audio y no se mueve.
// Acá rAF sólo DIBUJA; la hora la pregunta.
//
// Y POR ESO SE PROGRAMA CON ANTICIPO. Un sonido disparado en el cuadro en que
// toca llega tarde y desparejo. Cada vuelta se agenda todo lo que entra en los
// próximos 200 ms con su hora exacta, y el audio los larga solo, al mismo
// tiempo aunque el dibujo se trabe.

const ANTICIPO = 0.2;

export class Banda {
  constructor() {
    this.AC = null;
    this.maestro = null;
    this.t0 = 0;              // currentTime en que arrancó la canción
    this.i = 0;               // por dónde va la agenda
    this.eventos = [];
    this.sonando = false;
    this.volMusica = 1;
    this.volEfectos = 1;
  }

  /** Se llama en el primer toque: ningún navegador deja sonar antes. */
  despertar() {
    if (this.AC) { if (this.AC.state === "suspended") this.AC.resume(); return true; }
    try { this.AC = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return false; }
    this.maestro = this.AC.createGain();
    this.maestro.gain.value = 0.9;
    this.maestro.connect(this.AC.destination);

    // Un eco corto y compartido para la melodía. Uno por nota serían cientos de
    // nodos por canción; con uno solo el tema respira y no cuesta nada.
    this.eco = this.AC.createDelay(1);
    this.eco.delayTime.value = 0.22;
    this.ecoVuelta = this.AC.createGain();
    this.ecoVuelta.gain.value = 0.26;
    this.ecoTono = this.AC.createBiquadFilter();
    this.ecoTono.type = "highpass"; this.ecoTono.frequency.value = 500;
    this.eco.connect(this.ecoTono); this.ecoTono.connect(this.ecoVuelta);
    this.ecoVuelta.connect(this.eco); this.eco.connect(this.maestro);
    return true;
  }

  /** El retraso real entre `currentTime` y lo que sale por el parlante. */
  latencia() {
    if (!this.AC) return 0;
    return (this.AC.outputLatency || 0) || (this.AC.baseLatency || 0);
  }

  arrancar(eventos, desfase = 0, arranqueEn = 1.2) {
    if (!this.despertar()) return false;
    this.eventos = eventos;
    this.i = 0;
    this.desfase = desfase;
    this.t0 = this.AC.currentTime + arranqueEn;   // un respiro antes del primer golpe
    this.sonando = true;
    return true;
  }

  parar() {
    this.sonando = false;
    this.eventos = [];
  }

  /** Segundos desde el comienzo de la canción, tal como se ESCUCHA. */
  tiempo() {
    if (!this.AC) return 0;
    return this.AC.currentTime - this.t0 - this.latencia() - (this.desfase || 0);
  }

  /** Se llama en cada cuadro. Agenda lo que entra en la ventana de anticipo. */
  agendar() {
    if (!this.sonando || !this.AC) return;
    const hasta = this.AC.currentTime - this.t0 + ANTICIPO;
    while (this.i < this.eventos.length && this.eventos[this.i].t <= hasta) {
      const e = this.eventos[this.i++];
      this.tocar(e, this.t0 + e.t);
    }
  }

  // ── los instrumentos ─────────────────────────────────────────────────────
  env(destino, cuando, pico, ataque, caida) {
    const g = this.AC.createGain();
    g.gain.setValueAtTime(0.0001, cuando);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pico), cuando + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, cuando + ataque + caida);
    g.connect(destino);
    return g;
  }

  ruido(segundos) {
    const n = Math.max(1, (this.AC.sampleRate * segundos) | 0);
    const b = this.AC.createBuffer(1, n, this.AC.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = this.AC.createBufferSource(); s.buffer = b;
    return s;
  }

  tocar(e, cuando) {
    const A = this.AC, v = (e.vel ?? 1) * this.volMusica;
    if (v <= 0) return;
    const f = (n) => 440 * Math.pow(2, (n - 69) / 12);

    if (e.tipo === "bombo") {
      // Un bombo es una caída de tono, no un tono: de 150 a 45 Hz en 120 ms.
      const o = A.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(150, cuando);
      o.frequency.exponentialRampToValueAtTime(45, cuando + 0.12);
      o.connect(this.env(this.maestro, cuando, 0.9 * v, 0.004, 0.16));
      o.start(cuando); o.stop(cuando + 0.3);
      return;
    }
    if (e.tipo === "redoblante") {
      const s = this.ruido(0.2);
      const bp = A.createBiquadFilter(); bp.type = "bandpass";
      bp.frequency.value = 1900; bp.Q.value = 0.8;
      s.connect(bp); bp.connect(this.env(this.maestro, cuando, 0.38 * v, 0.003, 0.13));
      s.start(cuando); s.stop(cuando + 0.25);
      const o = A.createOscillator(); o.type = "triangle"; o.frequency.value = 185;
      o.connect(this.env(this.maestro, cuando, 0.18 * v, 0.002, 0.07));
      o.start(cuando); o.stop(cuando + 0.15);
      return;
    }
    if (e.tipo === "hihat") {
      const s = this.ruido(0.06);
      const hp = A.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7800;
      s.connect(hp); hp.connect(this.env(this.maestro, cuando, 0.12 * v, 0.001, 0.035));
      s.start(cuando); s.stop(cuando + 0.08);
      return;
    }
    if (e.tipo === "bajo") {
      const o = A.createOscillator(); o.type = "sawtooth"; o.frequency.value = f(e.nota);
      const lp = A.createBiquadFilter(); lp.type = "lowpass";
      lp.frequency.setValueAtTime(900, cuando);
      lp.frequency.exponentialRampToValueAtTime(240, cuando + 0.25);
      o.connect(lp); lp.connect(this.env(this.maestro, cuando, 0.34 * v, 0.008, e.largo || 0.18));
      o.start(cuando); o.stop(cuando + (e.largo || 0.2) + 0.1);
      return;
    }
    if (e.tipo === "pad") {
      // Dos sierras apenas desafinadas: una sola suena a zumbido de aparato.
      for (const cent of [-6, 6]) {
        const o = A.createOscillator(); o.type = "sawtooth";
        o.frequency.value = f(e.nota); o.detune.value = cent;
        const lp = A.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400;
        const g = A.createGain();
        g.gain.setValueAtTime(0.0001, cuando);
        g.gain.exponentialRampToValueAtTime(0.045 * v, cuando + 0.25);
        g.gain.exponentialRampToValueAtTime(0.0001, cuando + (e.largo || 1));
        o.connect(lp); lp.connect(g); g.connect(this.maestro);
        o.start(cuando); o.stop(cuando + (e.largo || 1) + 0.1);
      }
      return;
    }
    if (e.tipo === "melodia") {
      const largo = (e.largo || 0) + 0.26;
      const o = A.createOscillator(); o.type = "square"; o.frequency.value = f(e.nota);
      const lp = A.createBiquadFilter(); lp.type = "lowpass";
      lp.frequency.setValueAtTime(4200, cuando);
      lp.frequency.exponentialRampToValueAtTime(1300, cuando + largo);
      const g = this.env(this.maestro, cuando, 0.16 * v, 0.006, largo);
      o.connect(lp); lp.connect(g);
      const env = A.createGain(); env.gain.value = 0.5; g.connect(env); env.connect(this.eco);
      o.start(cuando); o.stop(cuando + largo + 0.1);
    }
  }

  // ── los efectos del juego, que NO están en la partitura ──────────────────
  /** El clic de acertar. Corto y agudo: tiene que leerse arriba del tema. */
  acierto(fuerza = 1) {
    if (!this.AC || this.volEfectos <= 0) return;
    const t = this.AC.currentTime;
    const o = this.AC.createOscillator(); o.type = "triangle";
    o.frequency.setValueAtTime(1180 + fuerza * 480, t);
    o.frequency.exponentialRampToValueAtTime(760, t + 0.05);
    o.connect(this.env(this.maestro, t, 0.11 * this.volEfectos, 0.002, 0.055));
    o.start(t); o.stop(t + 0.12);
  }

  /** El error: ruido sordo y grave, para que moleste sin tapar la música. */
  error() {
    if (!this.AC || this.volEfectos <= 0) return;
    const t = this.AC.currentTime;
    const s = this.ruido(0.12);
    const lp = this.AC.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700;
    s.connect(lp); lp.connect(this.env(this.maestro, t, 0.16 * this.volEfectos, 0.003, 0.1));
    s.start(t); s.stop(t + 0.18);
  }
}

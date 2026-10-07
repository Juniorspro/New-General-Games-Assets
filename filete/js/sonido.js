/* ============================================================================
   El sonido, sintetizado: un tango en re menor con bandoneón (dos lengüetas
   desafinadas apenas y un filtro), marcato de piano en cuatro, contrabajo de
   pizzicato con arrastre, y una síncopa (3-3-2) cada tantos compases. Los
   efectos son de madera (poner), campanitas que suben con el combo y el
   "chan-chan" del final.
   ========================================================================== */

const Sonido = {
  ctx: null, total: null, efectos: null, musicaG: null,
  musicaSi: Guardado.leer('musica', true), efectosSi: Guardado.leer('efectos', true),
  tema: null, prox: 0, paso: 0, ruidoBuf: null,
  iniciar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4;
    this.total = this.ctx.createGain(); this.total.gain.value = 0.9;
    this.efectos = this.ctx.createGain(); this.efectos.gain.value = this.efectosSi ? 0.6 : 0;
    this.musicaG = this.ctx.createGain(); this.musicaG.gain.value = this.musicaSi ? 0.3 : 0;
    this.efectos.connect(comp); this.musicaG.connect(comp); comp.connect(this.total); this.total.connect(this.ctx.destination);
    const n = this.ctx.sampleRate;
    this.ruidoBuf = this.ctx.createBuffer(1, n, n);
    const d = this.ruidoBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    setInterval(() => this.programar(), 30);
  },
  ponerMusica(si) { this.musicaSi = si; Guardado.escribir('musica', si); if (this.musicaG) this.musicaG.gain.value = si ? 0.3 : 0; },
  ponerEfectos(si) { this.efectosSi = si; Guardado.escribir('efectos', si); if (this.efectos) this.efectos.gain.value = si ? 0.6 : 0; },
  pausar(si) { if (this.ctx) { if (si) this.ctx.suspend(); else this.ctx.resume(); } },
  hz: (m) => 440 * Math.pow(2, (m - 69) / 12),

  tono(f, dur, tipo, vol, f2, t, destino, ataque) {
    const c = this.ctx; if (!c) return;
    t = t || c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = tipo || 'square'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (ataque || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(destino || this.efectos); o.start(t); o.stop(t + dur + 0.03);
  },
  ruido(dur, vol, frec, tipoF, t, destino, q) {
    const c = this.ctx; if (!c) return;
    t = t || c.currentTime;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.ruidoBuf; f.type = tipoF || 'bandpass'; f.frequency.value = frec || 1500; if (q) f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(destino || this.efectos); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  },
  /* el bandoneón: dos serruchos casi iguales, uno cuadrado una octava abajo, filtro y fuelle */
  bando(midi, dur, vol, t, destino, brillo) {
    const c = this.ctx; if (!c) return;
    const f = this.hz(midi), g = c.createGain(), fl = c.createBiquadFilter();
    fl.type = 'lowpass'; fl.frequency.value = brillo || 1900; fl.Q.value = 2;
    for (const [tipo, mult, det, v] of [['sawtooth', 1, -6, 0.5], ['sawtooth', 1, 7, 0.5], ['square', 0.5, 0, 0.25]]) {
      const o = c.createOscillator(), og = c.createGain();
      o.type = tipo; o.frequency.value = f * mult; o.detune.value = det; og.gain.value = v;
      o.connect(og); og.connect(fl); o.start(t); o.stop(t + dur + 0.12);
    }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.025); g.gain.setValueAtTime(vol * 0.85, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
    fl.connect(g); g.connect(destino || this.efectos);
  },
  sfx(n, x) {
    if (!this.ctx || !this.efectosSi) return;
    const t = this.ctx.currentTime;
    switch (n) {
      case 'tomar': this.ruido(0.03, 0.08, 5000, 'highpass'); this.tono(900, 0.04, 'triangle', 0.05); break;
      case 'poner': this.ruido(0.05, 0.25, 1800, 'bandpass', t, null, 2); this.tono(320, 0.07, 'triangle', 0.18, 140); this.tono(110, 0.1, 'sine', 0.25, 60); break;
      case 'mal': this.tono(150, 0.14, 'square', 0.05, 120); break;
      case 'boton': this.ruido(0.02, 0.1, 4000, 'highpass'); this.tono(700, 0.04, 'square', 0.04); break;
      case 'borrar': {
        const combo = x || 1, base = 74 + Math.min(10, combo - 1) * 2;
        [0, 4, 7, 12].forEach((s, i) => this.tono(this.hz(base + s), 0.35, 'triangle', 0.07, null, t + i * 0.045));
        [62, 65, 69].forEach((m) => this.bando(m, 0.16, 0.06, t));
        this.ruido(0.25, 0.08, 6000, 'highpass');
        break;
      }
      case 'elogio': [57, 61, 64, 67].forEach((m) => this.bando(m, 0.12, 0.07, t)); [50, 53, 57, 62].forEach((m) => this.bando(m, 0.4, 0.08, t + 0.18)); break;
      case 'limpio': [50, 53, 57, 62, 65, 69, 74].forEach((m, i) => { this.bando(m, 0.9, 0.05, t + i * 0.04); this.tono(this.hz(m + 24), 0.6, 'sine', 0.04, null, t + i * 0.06); }); break;
      case 'flor': this.tono(1568, 0.25, 'sine', 0.07); this.tono(2093, 0.3, 'sine', 0.05, null, t + 0.06); break;
      case 'fin': [57, 61, 64].forEach((m) => this.bando(m, 0.12, 0.09, t)); [38, 50, 53, 57].forEach((m) => this.bando(m, 0.3, 0.1, t + 0.42)); break;
      case 'gano': [62, 66, 69, 74].forEach((m, i) => this.bando(m, 0.5, 0.06, t + i * 0.08)); [74, 78, 81, 86].forEach((m, i) => this.tono(this.hz(m), 0.4, 'sine', 0.05, null, t + 0.3 + i * 0.07)); break;
      case 'estrella': this.tono(1760 * (x || 1), 0.3, 'sine', 0.07); this.tono(2637 * (x || 1), 0.2, 'triangle', 0.03, null, t + 0.04); break;
      case 'cambio': this.ruido(0.3, 0.12, 2500, 'bandpass', t, null, 0.7); this.tono(400, 0.25, 'triangle', 0.05, 1200); break;
    }
  },

  /* ----------------------------------------------------------- el tango */
  musica(tema) {
    if (this.tema && tema && this.tema.id === tema.id) return;
    this.tema = tema; this.paso = 0;
    if (this.ctx) this.prox = this.ctx.currentTime + 0.1;
    if (tema) this.frase = armarFrase(tema.semilla);
  },
  programar() {
    const c = this.ctx; if (!c || !this.tema || c.state !== 'running') return;
    if (this.prox < c.currentTime) this.prox = c.currentTime + 0.05;
    while (this.prox < c.currentTime + 0.2) { this.tocar(this.paso, this.prox); this.prox += this.tema.corchea; this.paso++; }
  },
  tocar(p, t) {
    const tm = this.tema, d = this.musicaG, ton = tm.tonica;
    const VUELTA = [[0, 3, 7], [0, 3, 7], [7, 11, 14, 17], [7, 11, 14, 17], [0, 3, 7], [5, 8, 12], [7, 11, 14, 17], [0, 3, 7]];
    const compas = Math.floor(p / 8) % 8, cor = p % 8, ac = VUELTA[compas];
    const sincopa = compas === 3 || compas === 7;
    // el marcato en cuatro (o la síncopa 3-3-2)
    const golpes = sincopa ? [0, 3, 6] : [0, 2, 4, 6];
    if (golpes.includes(cor)) {
      const fuerte = cor === 0 || (sincopa && cor === 3) || (!sincopa && cor === 4);
      for (const s of ac) this.tono(this.hz(ton + 12 + s), 0.11, 'triangle', fuerte ? 0.07 : 0.045, null, t, d);
      this.ruido(0.03, fuerte ? 0.06 : 0.03, 3000, 'bandpass', t, d);
    }
    // el contrabajo: tónica y quinta, con arrastre antes del uno
    if (cor === 0) this.tono(this.hz(ton - 12 + ac[0]), 0.38, 'triangle', 0.32, null, t, d);
    if (cor === 4 && !sincopa) this.tono(this.hz(ton - 12 + ac[0] + 7), 0.3, 'triangle', 0.24, null, t, d);
    if (cor === 7 && compas % 2 === 1) { const sig = VUELTA[(compas + 1) % 8][0]; this.tono(this.hz(ton - 13 + sig), tm.corchea * 0.9, 'sawtooth', 0.06, this.hz(ton - 12 + sig), t, d); }
    // el bandoneón con la melodía
    if (!tm.sinMelodia) {
      const n = this.frase[(compas * 8 + cor) % this.frase.length];
      if (n) this.bando(ton + 12 + ac[n.g % ac.length] + (n.alto ? 12 : 0) + (n.paso || 0), tm.corchea * n.dur * 0.92, 0.05, t, d, tm.brillo);
    }
  },
};
/* una frase de 8 compases para el bandoneón: notas del acorde, con corcheas, negras y alguna larga */
function armarFrase(semilla) {
  const r = rngSemilla(semilla), frase = new Array(64).fill(null);
  const RITMOS = [[0, 2, 3, 4, 6], [0, 1, 2, 4], [0, 3, 6], [0, 2, 4, 5, 6, 7], [0, 4]];
  for (let c = 0; c < 8; c++) {
    const rit = RITMOS[Math.floor(r() * RITMOS.length)];
    rit.forEach((cor, i) => {
      const sig = i + 1 < rit.length ? rit[i + 1] : 8;
      frase[c * 8 + cor] = { g: Math.floor(r() * 4), dur: sig - cor, alto: r() < 0.25, paso: r() < 0.15 ? (r() < 0.5 ? -1 : 2) : 0 };
    });
  }
  return frase;
}
const TEMAS = {
  menu: { id: 'menu', tonica: 50, corchea: 0.3, semilla: 3, brillo: 1400 },
  juego: { id: 'juego', tonica: 50, corchea: 0.254, semilla: 11 },
  barrio: { id: 'barrio', tonica: 55, corchea: 0.27, semilla: 29, brillo: 1700 },
};

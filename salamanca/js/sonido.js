/* ============================================================================
   El sonido, todo sintetizado (ni un archivo de audio): los efectos con
   osciladores y ruido, y la música es una chacarera en 6/8 con guitarra de
   cuerdas pulsadas (Karplus-Strong), bombo legüero y una quena que improvisa
   sobre los acordes. Cada piso cambia de tono y de pulso; el jefe, a todo.
   ========================================================================== */

const Sonido = {
  ctx: null, total: null, efectos: null, musicaG: null,
  musicaSi: Guardado.leer('musica', true), efectosSi: Guardado.leer('efectos', true),
  cuerdas: new Map(), ruidoBuf: null,
  tema: null, prox: 0, paso: 0, reloj: null,

  iniciar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.total = this.ctx.createGain(); this.total.gain.value = 0.9;
    this.efectos = this.ctx.createGain(); this.efectos.gain.value = this.efectosSi ? 0.55 : 0;
    this.musicaG = this.ctx.createGain(); this.musicaG.gain.value = this.musicaSi ? 0.32 : 0;
    this.efectos.connect(comp); this.musicaG.connect(comp); comp.connect(this.total); this.total.connect(this.ctx.destination);
    const n = this.ctx.sampleRate;
    this.ruidoBuf = this.ctx.createBuffer(1, n, n);
    const d = this.ruidoBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.reloj = setInterval(() => this.programar(), 30);
  },
  ponerMusica(si) { this.musicaSi = si; Guardado.escribir('musica', si); if (this.musicaG) this.musicaG.gain.value = si ? 0.32 : 0; },
  ponerEfectos(si) { this.efectosSi = si; Guardado.escribir('efectos', si); if (this.efectos) this.efectos.gain.value = si ? 0.55 : 0; },
  pausar(si) { if (!this.ctx) return; if (si) this.ctx.suspend(); else this.ctx.resume(); },

  /* --------------------------------------------------------------- efectos */
  tono(f, dur, tipo, vol, f2, cuando, destino) {
    const c = this.ctx; if (!c) return;
    const t = cuando || c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = tipo || 'square'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol || 0.2, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(destino || this.efectos); o.start(t); o.stop(t + dur + 0.02);
  },
  ruido(dur, vol, filtro, tipoF, cuando, destino, q) {
    const c = this.ctx; if (!c) return;
    const t = cuando || c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.ruidoBuf;
    const f = c.createBiquadFilter(); f.type = tipoF || 'lowpass'; f.frequency.value = filtro || 2000; if (q) f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(destino || this.efectos);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },
  /* una cuerda pulsada: ruido que se repite en un lazo que se va apagando */
  cuerda(midi, vol, cuando, destino, dur) {
    const c = this.ctx; if (!c) return;
    let buf = this.cuerdas.get(midi);
    if (!buf) {
      const sr = c.sampleRate, f = 440 * Math.pow(2, (midi - 69) / 12), N = Math.max(2, Math.round(sr / f));
      const largo = Math.floor(sr * 1.4);
      buf = c.createBuffer(1, largo, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
      const amort = midi < 50 ? 0.4985 : 0.4975;
      for (let i = N; i < largo; i++) d[i] = (d[i - N] + d[i - N + 1]) * amort;
      this.cuerdas.set(midi, buf);
    }
    const s = c.createBufferSource(); s.buffer = buf;
    const g = c.createGain(), t = cuando || c.currentTime;
    g.gain.setValueAtTime(vol, t);
    if (dur) g.gain.setTargetAtTime(0.0001, t + dur, 0.05);
    s.connect(g); g.connect(destino || this.efectos); s.start(t); s.stop(t + 1.4);
  },
  sfx(n, x) {
    if (!this.ctx || !this.efectosSi) return;
    const c = this.ctx, t = c.currentTime;
    switch (n) {
      case 'tiro': this.tono(880 + Math.random() * 120, 0.07, 'square', 0.05, 1500); break;
      case 'golpe': this.ruido(0.06, 0.12, 3000, 'bandpass'); this.tono(220, 0.05, 'square', 0.05, 110); break;
      case 'critico': this.ruido(0.08, 0.16, 4000, 'bandpass'); this.tono(660, 0.08, 'square', 0.07, 1320); break;
      case 'muere': this.ruido(0.18, 0.18, 1400); this.tono(300, 0.18, 'square', 0.08, 60); break;
      case 'alma': this.tono(988 * (x || 1), 0.12, 'triangle', 0.09); this.tono(1318 * (x || 1), 0.16, 'triangle', 0.07, null, t + 0.05); break;
      case 'xp': this.tono(1400 * (x || 1), 0.04, 'sine', 0.05); break;
      case 'herido': this.ruido(0.25, 0.3, 900); this.tono(160, 0.25, 'sawtooth', 0.12, 50); break;
      case 'nivel': [0, 4, 7, 12, 16].forEach((s, i) => this.cuerda(64 + s, 0.5, t + i * 0.06)); this.tono(1046, 0.5, 'triangle', 0.06, null, t + 0.3); break;
      case 'puerta': this.ruido(0.5, 0.2, 300); [0, 7, 12].forEach((s, i) => this.tono(392 * Math.pow(2, s / 12), 0.3, 'triangle', 0.07, null, t + 0.12 + i * 0.08)); break;
      case 'balaE': this.tono(420, 0.06, 'triangle', 0.035, 300); break;
      case 'salto': this.tono(140, 0.2, 'square', 0.08, 380); break;
      case 'aterriza': this.ruido(0.35, 0.35, 260); this.tono(80, 0.3, 'sine', 0.3, 40); break;
      case 'rugido': this.ruido(0.9, 0.3, 500, 'lowpass'); this.tono(90, 0.9, 'sawtooth', 0.14, 45); break;
      case 'copla': [0, 3, 7, 12, 15, 19].forEach((s, i) => this.cuerda(57 + s, 0.7, t + i * 0.025)); this.ruido(0.6, 0.15, 6000, 'highpass'); break;
      case 'carta': this.ruido(0.05, 0.08, 5000, 'highpass'); break;
      case 'elegir': [0, 7, 12].forEach((s, i) => this.cuerda(69 + s, 0.55, t + i * 0.05)); break;
      case 'boton': this.tono(660, 0.05, 'square', 0.05, 880); break;
      case 'tele': this.tono(1200, 0.25, 'sine', 0.06, 200); break;
      case 'esquive': this.tono(1800, 0.06, 'sine', 0.05, 900); break;
      case 'explota': this.ruido(0.3, 0.25, 900); this.tono(120, 0.25, 'square', 0.08, 40); break;
      case 'rayo': this.ruido(0.12, 0.12, 6000, 'highpass'); break;
      case 'aviso': this.tono(520, 0.12, 'square', 0.05); this.tono(520, 0.12, 'square', 0.05, null, t + 0.16); break;
      case 'muerte': [0, -1, -3, -5, -7, -12].forEach((s, i) => this.cuerda(57 + s, 0.6, t + i * 0.16)); break;
      case 'victoria': [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((s, i) => this.cuerda(60 + s, 0.55, t + i * 0.1)); break;
    }
  },

  /* ---------------------------------------------------------------- música */
  /* tema: { tonica (midi), pulso (seg por corchea), jefe, menu } */
  musica(tema) {
    if (this.tema && tema && this.tema.id === tema.id) return;
    this.tema = tema; this.paso = 0;
    if (this.ctx) this.prox = this.ctx.currentTime + 0.1;
    this.frase = null;
  },
  programar() {
    const c = this.ctx; if (!c || !this.tema || c.state !== 'running') return;
    if (this.prox < c.currentTime) this.prox = c.currentTime + 0.05;
    while (this.prox < c.currentTime + 0.18) { this.tocarPaso(this.paso, this.prox); this.prox += this.tema.pulso; this.paso++; }
  },
  tocarPaso(p, t) {
    const tm = this.tema, d = this.musicaG, f = tm.tonica;
    // la vuelta: Am | Am | E7 | E7 | Am | G | C | E7 (en grados del menor)
    const VUELTA = [[0, 3, 7], [0, 3, 7], [7, 11, 14, 17], [7, 11, 14, 17], [0, 3, 7], [-2, 2, 5], [3, 7, 10], [7, 11, 14, 17]];
    const compas = Math.floor(p / 6) % 8, corch = p % 6, ac = VUELTA[compas];
    const bajo = f - 12 + ac[0];
    // guitarra: el rasguido de la chacarera (abajo fuerte, chasquido, arriba)
    if (!tm.menu) {
      if (corch === 0 || corch === 3) { ac.forEach((s, i) => this.cuerda(f + s, 0.22, t + i * 0.012, d, tm.pulso * 2.2)); this.cuerda(bajo, 0.4, t, d); }
      else if (corch === 2 || corch === 5) ac.slice(0, 3).reverse().forEach((s, i) => this.cuerda(f + 12 + s, 0.12, t + i * 0.01, d, tm.pulso));
      else this.ruido(0.03, 0.08, 3500, 'bandpass', t, d, 2);
    } else {
      // en el menú, arpegiado y tranquilo
      const n = [0, 1, 2, 1, 2, 1][corch] % ac.length;
      this.cuerda((corch === 0 ? bajo : f + ac[n] + (corch > 2 ? 12 : 0)), corch === 0 ? 0.35 : 0.18, t, d);
    }
    // bombo legüero: parche en 1 y 4, aro en el resto (en el jefe, más parche)
    if (!tm.menu) {
      const parche = corch === 0 || corch === 3 || (tm.jefe && corch === 5);
      if (parche) { this.tono(78, 0.28, 'sine', 0.55, 46, t, d); this.ruido(0.08, 0.12, 400, 'lowpass', t, d); }
      else if (corch !== 2 || tm.jefe) this.ruido(0.04, 0.1, 2500, 'bandpass', t, d, 3);
    }
    // la quena: una frase por cada dos compases, con notas del acorde y de la escala
    if (corch % 2 === 0) {
      if (!this.frase || corch === 0 && compas % 2 === 0) {
        const r = rngSemilla(f * 1000 + compas + (tm.id.length * 31));
        this.frase = Array.from({ length: 12 }, () => (r() < 0.62 ? 1 : 0));
        this.fraseR = r;
      }
      const idx = (compas % 2) * 6 + corch;
      if (this.frase[idx % 12]) {
        const escala = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15];
        const r = this.fraseR, nota = r() < 0.6 ? ac[Math.floor(r() * ac.length)] : escala[Math.floor(r() * escala.length)];
        this.quena(f + 12 + nota, tm.pulso * (r() < 0.3 ? 3.5 : 1.8), t, d);
      }
    }
  },
  quena(midi, dur, t, d) {
    const c = this.ctx, fr = 440 * Math.pow(2, (midi - 69) / 12);
    const o = c.createOscillator(), g = c.createGain(), vib = c.createOscillator(), vg = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(fr, t);
    vib.frequency.value = 5.2; vg.gain.value = fr * 0.012; vib.connect(vg); vg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.05); g.gain.setTargetAtTime(0.0001, t + dur * 0.8, 0.06);
    o.connect(g); g.connect(d); o.start(t); vib.start(t); o.stop(t + dur + 0.3); vib.stop(t + dur + 0.3);
    this.ruido(0.06, 0.02, 2500, 'bandpass', t, d);
  },
};
const TEMAS = {
  menu: { id: 'menu', tonica: 57, pulso: 0.2, menu: true },
  p0: { id: 'p0', tonica: 57, pulso: 0.15 },
  p1: { id: 'p1', tonica: 62, pulso: 0.16 },
  p2: { id: 'p2', tonica: 52, pulso: 0.135 },
  p3: { id: 'p3', tonica: 61, pulso: 0.14 },
  jefe: { id: 'jefe', tonica: 52, pulso: 0.12, jefe: true },
  fogon: { id: 'fogon', tonica: 62, pulso: 0.22, menu: true },
};

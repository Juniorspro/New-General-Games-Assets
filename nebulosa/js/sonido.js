/* ============================================================================
   El sonido: synthwave sintetizado. Bombo y palmas, platillos en corcheas,
   bajo de serrucho en semicorcheas (Lam – Fa – Do – Sol), colchón de acordes
   y un arpegio con eco. La "tensión" (lo lleno que está el frasco) abre el
   filtro y suma platillos. Los efectos: caída, choque según el tamaño,
   fusión que sube de tono con el cuerpo, supernova, rayo, sacudón y alarma.
   ========================================================================== */

const Sonido = {
  ctx: null, total: null, efectos: null, musicaG: null, filtro: null, eco: null, ruidoBuf: null,
  musicaSi: Guardado.leer('musica', true), efectosSi: Guardado.leer('efectos', true),
  tema: null, prox: 0, paso: 0, tension: 0, golpesT: 0,
  iniciar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4;
    this.total = c.createGain(); this.total.gain.value = 0.9;
    this.efectos = c.createGain(); this.efectos.gain.value = this.efectosSi ? 0.6 : 0;
    this.musicaG = c.createGain(); this.musicaG.gain.value = this.musicaSi ? 0.32 : 0;
    this.filtro = c.createBiquadFilter(); this.filtro.type = 'lowpass'; this.filtro.frequency.value = 1400; this.filtro.Q.value = 3;
    // el eco del arpegio
    this.eco = c.createDelay(1); this.eco.delayTime.value = 0.43;
    const fb = c.createGain(); fb.gain.value = 0.38; this.eco.connect(fb); fb.connect(this.eco);
    const ecoSal = c.createGain(); ecoSal.gain.value = 0.5; this.eco.connect(ecoSal); ecoSal.connect(this.musicaG);
    this.filtro.connect(this.musicaG);
    this.efectos.connect(comp); this.musicaG.connect(comp); comp.connect(this.total); this.total.connect(c.destination);
    const n = c.sampleRate;
    this.ruidoBuf = c.createBuffer(1, n, n);
    const d = this.ruidoBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    setInterval(() => this.programar(), 30);
  },
  ponerMusica(si) { this.musicaSi = si; Guardado.escribir('musica', si); if (this.musicaG) this.musicaG.gain.value = si ? 0.32 : 0; },
  ponerEfectos(si) { this.efectosSi = si; Guardado.escribir('efectos', si); if (this.efectos) this.efectos.gain.value = si ? 0.6 : 0; },
  pausar(si) { if (this.ctx) { if (si) this.ctx.suspend(); else this.ctx.resume(); } },
  hz: (m) => 440 * Math.pow(2, (m - 69) / 12),
  tono(f, dur, tipo, vol, f2, t, destino, ataque, det) {
    const c = this.ctx; if (!c) return;
    t = t || c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = tipo || 'square'; o.frequency.setValueAtTime(f, t); if (det) o.detune.value = det;
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (ataque || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(destino || this.efectos); o.start(t); o.stop(t + dur + 0.05);
  },
  ruido(dur, vol, frec, tipoF, t, destino, q, frec2) {
    const c = this.ctx; if (!c) return;
    t = t || c.currentTime;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.ruidoBuf; f.type = tipoF || 'lowpass'; f.frequency.setValueAtTime(frec || 2000, t); if (frec2) f.frequency.exponentialRampToValueAtTime(frec2, t + dur); if (q) f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(destino || this.efectos); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  },
  sfx(n, x) {
    if (!this.ctx || !this.efectosSi) return;
    const t = this.ctx.currentTime;
    switch (n) {
      case 'tirar': this.ruido(0.18, 0.08, 3000, 'bandpass', t, null, 1, 600); this.tono(700, 0.12, 'sine', 0.05, 300); break;
      case 'choque': { if (t < this.golpesT) return; this.golpesT = t + 0.05; const k = x || 0; this.tono(200 - k * 12, 0.12, 'sine', 0.12, 60); this.ruido(0.05, 0.05, 900 - k * 50); break; }
      case 'fusion': {
        const k = x || 0, base = 60 + k * 2;
        [0, 7, 12].forEach((s, i) => this.tono(this.hz(base + s), 0.22, 'sawtooth', 0.045, null, t + i * 0.03, null, 0.004, i * 5));
        this.tono(this.hz(base + 24), 0.4, 'sine', 0.06, null, t + 0.06);
        this.ruido(0.25, 0.06, 6000, 'highpass');
        if (k >= 6) { this.tono(55, 0.6, 'sine', 0.35, 30); this.ruido(0.5, 0.12, 400); }
        break;
      }
      case 'supernova': this.tono(40, 2, 'sine', 0.5, 25); this.ruido(1.8, 0.4, 8000, 'lowpass', t, null, 1, 200); [48, 55, 60, 64, 67, 72].forEach((m, i) => this.tono(this.hz(m), 1.6, 'sawtooth', 0.04, null, t + 0.1 + i * 0.05, null, 0.3, 8)); break;
      case 'rayo': this.ruido(0.3, 0.2, 7000, 'highpass'); this.tono(1800, 0.25, 'square', 0.05, 120); break;
      case 'sacudon': this.tono(50, 0.7, 'sine', 0.45, 30); this.ruido(0.7, 0.25, 300); break;
      case 'alarma': this.tono(880, 0.12, 'square', 0.045, 660); break;
      case 'boton': this.tono(1200, 0.05, 'square', 0.035, 1500); break;
      case 'descubrir': [72, 76, 79, 84, 88].forEach((m, i) => this.tono(this.hz(m), 0.3, 'triangle', 0.06, null, t + i * 0.07)); break;
      case 'fin': [64, 60, 57, 52, 45].forEach((m, i) => this.tono(this.hz(m), 0.5, 'sawtooth', 0.06, null, t + i * 0.16, null, 0.01, 6)); this.tono(41, 1.2, 'sine', 0.4, 28, t + 0.8); break;
      case 'record': [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => this.tono(this.hz(m), 0.35, 'square', 0.04, null, t + i * 0.06)); break;
      case 'tic': this.tono(1600, 0.03, 'square', 0.03); break;
    }
  },

  /* ---------------------------------------------------------- la música */
  musica(tema) {
    if (this.tema && tema && this.tema.id === tema.id) return;
    this.tema = tema; this.paso = 0;
    if (this.ctx) this.prox = this.ctx.currentTime + 0.1;
  },
  programar() {
    const c = this.ctx; if (!c || !this.tema || c.state !== 'running') return;
    this.filtro.frequency.setTargetAtTime(this.tema.calmo ? 900 : 1100 + this.tension * 4500, c.currentTime, 0.3);
    if (this.prox < c.currentTime) this.prox = c.currentTime + 0.05;
    while (this.prox < c.currentTime + 0.2) { this.tocar(this.paso, this.prox); this.prox += this.tema.semi; this.paso++; }
  },
  tocar(p, t) {
    const tm = this.tema, f = this.filtro, d = this.musicaG;
    const ACORDES = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];   // Lam Fa Do Sol
    const compas = Math.floor(p / 16) % 4, s = p % 16, ac = ACORDES[compas], raiz = ac[0] - 24;
    // bajo: octavas en semicorcheas
    if (!tm.calmo || s % 2 === 0) this.tono(this.hz(raiz + (s % 2 ? 12 : 0)), tm.semi * 0.9, 'sawtooth', 0.12, null, t, f, 0.004);
    // el colchón al empezar cada compás
    if (s === 0) for (const m of ac) { this.tono(this.hz(m), tm.semi * 16, 'sawtooth', 0.035, null, t, f, 0.4, -8); this.tono(this.hz(m), tm.semi * 16, 'sawtooth', 0.035, null, t, f, 0.4, 8); }
    if (tm.calmo) { if (s % 4 === 0) this.tono(this.hz(ac[(s / 4) % 3] + 12), tm.semi * 3, 'triangle', 0.05, null, t, this.eco); return; }
    // batería
    if (s === 0 || s === 8) { this.tono(120, 0.32, 'sine', 0.6, 40, t, d); }
    if (s === 4 || s === 12) { this.ruido(0.18, 0.25, 1800, 'bandpass', t, d, 0.8); this.tono(200, 0.1, 'triangle', 0.12, 120, t, d); }
    if (s % 2 === 0 || this.tension > 0.6) this.ruido(0.04, s % 4 === 2 ? 0.08 : 0.04, 9000, 'highpass', t, d);
    // el arpegio con eco
    if (s % 2 === 0 && (compas % 2 === 1 || this.tension > 0.3)) {
      const nota = ac[[0, 1, 2, 1, 0, 2, 1, 2][(s / 2) % 8]] + 12;
      this.tono(this.hz(nota), tm.semi * 1.6, 'square', 0.03, null, t, this.eco);
      this.tono(this.hz(nota), tm.semi * 1.6, 'square', 0.025, null, t, f);
    }
  },
};
const TEMAS = {
  menu: { id: 'menu', semi: 0.15, calmo: true },
  juego: { id: 'juego', semi: 0.144 },
  rayo: { id: 'rayo', semi: 0.125 },
};

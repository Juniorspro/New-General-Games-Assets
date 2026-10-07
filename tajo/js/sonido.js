/* ============================================================================
   El sonido: síntesis japonesa. Koto, taiko, shakuhachi. Efectos: corte,
   choque, explosión, fin. La música es un loop melódico con pentatónica.
   ========================================================================== */

const Sonido = {
  ctx: null, total: null, efectos: null, musicaG: null, filtro: null, ruidoBuf: null,
  musicaSi: Guardado.leer('musica', true), efectosSi: Guardado.leer('efectos', true),
  tema: null,
  iniciar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4;
    this.total = c.createGain(); this.total.gain.value = 0.9;
    this.efectos = c.createGain(); this.efectos.gain.value = this.efectosSi ? 0.6 : 0;
    this.musicaG = c.createGain(); this.musicaG.gain.value = this.musicaSi ? 0.28 : 0;
    this.filtro = c.createBiquadFilter(); this.filtro.type = 'lowpass'; this.filtro.frequency.value = 2000; this.filtro.Q.value = 2;
    this.filtro.connect(this.musicaG);
    this.efectos.connect(comp); this.musicaG.connect(comp); comp.connect(this.total); this.total.connect(c.destination);
    const n = c.sampleRate;
    this.ruidoBuf = c.createBuffer(1, n, n);
    const d = this.ruidoBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  },
  ponerMusica(si) { this.musicaSi = si; Guardado.escribir('musica', si); if (this.musicaG) this.musicaG.gain.value = si ? 0.28 : 0; },
  ponerEfectos(si) { this.efectosSi = si; Guardado.escribir('efectos', si); if (this.efectos) this.efectos.gain.value = si ? 0.6 : 0; },
  pausar(si) { if (this.ctx) { if (si) this.ctx.suspend(); else this.ctx.resume(); } },
  hz: (m) => 440 * Math.pow(2, (m - 69) / 12),
  tono(f, dur, tipo, vol, f2, t, destino, ataque) {
    const c = this.ctx; if (!c) return;
    t = t || c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = tipo || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (ataque || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(destino || this.efectos); o.start(t); o.stop(t + dur + 0.05);
  },
  ruido(dur, vol, frec, tipoF, t, destino) {
    const c = this.ctx; if (!c) return;
    t = t || c.currentTime;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.ruidoBuf; f.type = tipoF || 'lowpass'; f.frequency.setValueAtTime(frec || 2000, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(destino || this.efectos); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  },
  sfx(n, x) {
    if (!this.ctx || !this.efectosSi) return;
    const t = this.ctx.currentTime;
    switch (n) {
      case 'corte': this.ruido(0.15, 0.12, 4000, 'highpass', t); this.tono(400, 0.12, 'sine', 0.08, 150); break;
      case 'choque': this.tono(220, 0.08, 'sine', 0.1, 80); this.ruido(0.1, 0.06, 2000); break;
      case 'bomba': this.tono(100, 0.4, 'sine', 0.4, 50); this.ruido(0.35, 0.25, 500); break;
      case 'fin': for (const m of [60, 57, 53, 50, 48]) this.tono(this.hz(m), 0.4, 'sine', 0.08, null, t + (60 - m) * 0.08); break;
      case 'record': for (const m of [72, 76, 79, 83]) this.tono(this.hz(m), 0.25, 'sine', 0.06, null, t + (m - 72) * 0.06); break;
      case 'boton': this.tono(600, 0.05, 'square', 0.03, 900); break;
    }
  },
  musica(tema) {
    if (this.tema && tema && this.tema.id === tema.id) return;
    this.tema = tema;
    if (this.ctx && tema) this.tocarMusica();
  },
  tocarMusica() {
    const c = this.ctx; if (!c || !this.tema) return;
    const t = c.currentTime;
    const NOTAS = [60, 62, 64, 65, 67, 69, 71, 72];
    const nota = NOTAS[Math.floor(Math.random() * NOTAS.length)];
    this.tono(this.hz(nota), 0.5, 'sine', 0.08, null, t, this.filtro, 0.1);
    setTimeout(() => this.tocarMusica(), 600);
  },
};
const TEMAS = {
  menu: { id: 'menu' },
  juego: { id: 'juego' },
};

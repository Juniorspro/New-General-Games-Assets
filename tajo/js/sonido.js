/* ============================================================================
   El sonido, todo sintetizado: koto (cuerda pulsada: sierra que se apaga con
   un filtro que se cierra rápido), shakuhachi (seno con soplido y vibrato que
   entra tarde) y taiko (seno que cae de 150 a 48 Hz con golpe de ruido). La
   escala es la "in" japonesa (re, mi♭, sol, la, si♭). Cada corte toca una nota
   de la escala que sube con el combo: cortar es tocar el koto.
   La música se agenda con el reloj del audio un cuarto de segundo adelante.
   ========================================================================== */

const ESCALA_IN = [0, 1, 5, 7, 8];
const _ = null;
const TEMAS = {
  menu: { id: 'menu', bpm: 64, acordes: [0, -1, 2, 0], vk: 0.09, vb: 0.08, vt: 0, vf: 0.075,
    koto: [5, _, 7, _, 8, _, 7, 6, 5, _, _, 3, 4, _, _, _], bajo: [0, _, _, _, _, _, _, _, 2, _, _, _, _, _, _, _], tambor: [],
    flauta: [[0, 7, 6], [16, 8, 4], [24, 6, 6], [40, 7, 8], [56, 5, 6]] },
  zen: { id: 'zen', bpm: 72, acordes: [0, 2, -1, 0], vk: 0.08, vb: 0.08, vt: 0.22, vf: 0.07,
    koto: [7, _, _, 8, _, _, 5, _, 6, _, 7, _, _, 5, _, _], bajo: [0, _, _, _, _, _, _, _, -1, _, _, _, _, _, _, _], tambor: 'D.......d.......'.split(''),
    flauta: [[4, 9, 5], [20, 8, 6], [36, 10, 4], [44, 9, 3], [52, 7, 8]] },
  juego: { id: 'juego', bpm: 96, acordes: [0, 0, -2, 1], vk: 0.07, vb: 0.09, vt: 0.34, vf: 0.05,
    koto: [5, _, 8, 7, _, 7, 9, _, 5, _, 8, 10, 9, _, 7, _], bajo: [0, _, _, _, 0, _, _, _, 2, _, _, _, 0, _, 1, _], tambor: 'D..kD.k.D..kDDk.'.split(''),
    flauta: [[32, 10, 8], [48, 9, 6]] },
  tormenta: { id: 'tormenta', bpm: 124, acordes: [0, 1, -2, 0], vk: 0.065, vb: 0.09, vt: 0.36, vf: 0,
    koto: [5, 7, 8, 7, 5, 7, 9, 7, 5, 7, 8, 10, 9, 8, 7, 8], bajo: [0, _, 0, _, 2, _, 0, _, 0, _, 0, _, 1, _, 2, _], tambor: 'DkDkD.kkDkDkDDkk'.split(''), flauta: [] },
};

const Sonido = {
  ctx: null, total: null, efectos: null, musicaG: null, eco: null, ruidoBuf: null,
  musicaSi: Guardado.leer('musica', true), efectosSi: Guardado.leer('efectos', true),
  tema: null, paso: 0, prox: 0, ultZas: 0,
  iniciar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.total = c.createGain(); this.total.gain.value = 0.9;
    this.efectos = c.createGain(); this.efectos.gain.value = this.efectosSi ? 0.75 : 0;
    this.musicaG = c.createGain(); this.musicaG.gain.value = this.musicaSi ? 0.34 : 0;
    // un eco corto y oscuro, como un salón de madera: le da cuerpo al koto
    const d = c.createDelay(1), fb = c.createGain(), fl = c.createBiquadFilter();
    d.delayTime.value = 0.23; fb.gain.value = 0.32; fl.type = 'lowpass'; fl.frequency.value = 2200;
    this.eco = c.createGain(); this.eco.gain.value = 0.5;
    this.eco.connect(d); d.connect(fl); fl.connect(fb); fb.connect(d); fl.connect(comp);
    this.musicaG.connect(this.eco);
    this.efectos.connect(comp); this.musicaG.connect(comp); comp.connect(this.total); this.total.connect(c.destination);
    const n = c.sampleRate;
    this.ruidoBuf = c.createBuffer(1, n, n);
    const b = this.ruidoBuf.getChannelData(0);
    for (let i = 0; i < n; i++) b[i] = Math.random() * 2 - 1;
  },
  ponerMusica(si) { this.musicaSi = si; Guardado.escribir('musica', si); if (this.musicaG) this.musicaG.gain.setTargetAtTime(si ? 0.34 : 0, this.ctx.currentTime, 0.05); },
  ponerEfectos(si) { this.efectosSi = si; Guardado.escribir('efectos', si); if (this.efectos) this.efectos.gain.setTargetAtTime(si ? 0.75 : 0, this.ctx.currentTime, 0.05); },
  pausar(si) { if (this.ctx) { if (si) this.ctx.suspend(); else this.ctx.resume(); } },
  hz: (m) => 440 * Math.pow(2, (m - 69) / 12),
  grado(n) { const o = Math.floor(n / 5); return 62 + o * 12 + ESCALA_IN[((n % 5) + 5) % 5]; },

  /* ------------------------------------------------------------- piezas */
  env(gn, t, vol, ataque, dur) { gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol, t + ataque); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur); },
  osc(tipo, f, t, dur, dst) { const o = this.ctx.createOscillator(); o.type = tipo; o.frequency.setValueAtTime(f, t); o.connect(dst); o.start(t); o.stop(t + dur + 0.05); return o; },
  tono(f, dur, tipo, vol, f2, t, dst, ataque) {
    const c = this.ctx; if (!c) return;
    t = t || c.currentTime;
    const gn = c.createGain(); gn.connect(dst || this.efectos);
    const o = this.osc(tipo || 'sine', f, t, dur, gn);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    this.env(gn, t, vol, ataque || 0.008, dur);
  },
  ruido(dur, vol, frec, tipoF, t, dst, f2, q) {
    const c = this.ctx; if (!c) return;
    t = t || c.currentTime;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), gn = c.createGain();
    s.buffer = this.ruidoBuf; f.type = tipoF || 'lowpass'; f.Q.value = q || 0.8; f.frequency.setValueAtTime(frec, t);
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(gn); gn.connect(dst || this.efectos); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  },
  koto(f, t, vol, dur, dst) {
    const c = this.ctx, fl = c.createBiquadFilter(), gn = c.createGain();
    fl.type = 'lowpass'; fl.Q.value = 3; fl.frequency.setValueAtTime(Math.min(9000, f * 9), t); fl.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.4), t + 0.35);
    fl.connect(gn); gn.connect(dst || this.efectos);
    this.osc('sawtooth', f, t, dur, fl); this.osc('triangle', f * 2.004, t, dur * 0.6, fl);
    this.env(gn, t, vol, 0.003, dur);
    this.ruido(0.025, vol * 0.5, 2600, 'highpass', t, dst);
  },
  shaku(f, t, dur, vol, dst) {
    const c = this.ctx, gn = c.createGain(), lfo = c.createOscillator(), prof = c.createGain();
    gn.connect(dst || this.efectos);
    const o = this.osc('sine', f * 0.97, t, dur, gn), o2 = this.osc('triangle', f, t, dur, gn);
    o.frequency.linearRampToValueAtTime(f, t + 0.12);
    lfo.frequency.value = 5.2; prof.gain.setValueAtTime(0, t); prof.gain.linearRampToValueAtTime(f * 0.014, t + Math.min(0.5, dur * 0.6));
    lfo.connect(prof); prof.connect(o.frequency); prof.connect(o2.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol, t + 0.14); gn.gain.setValueAtTime(vol, t + Math.max(0.15, dur - 0.25)); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    this.ruido(Math.min(dur, 0.6), vol * 0.55, f * 2, 'bandpass', t, dst, f * 2.5, 4);
  },
  taiko(t, vol, dst, grave) {
    this.tono(grave ? 110 : 150, grave ? 0.7 : 0.42, 'sine', vol, grave ? 36 : 48, t, dst, 0.003);
    this.ruido(0.12, vol * 0.45, 420, 'lowpass', t, dst);
  },
  ka(t, vol, dst) { this.ruido(0.04, vol, 3200, 'highpass', t, dst); this.tono(1100, 0.03, 'square', vol * 0.12, 700, t, dst); },

  /* ------------------------------------------------------------ efectos */
  sfx(n, x) {
    if (!this.ctx || !this.efectosSi || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    switch (n) {
      case 'zas': if (t - this.ultZas < 0.1) return; this.ultZas = t; this.ruido(0.16, 0.05 + 0.1 * (x || 0.5), 700, 'bandpass', t, null, 2600, 1.4); break;
      case 'corte': {
        const k = x || 0;
        this.ruido(0.14, 0.28, 1300, 'bandpass', t, null, 600, 1.2);
        this.tono(440, 0.1, 'sine', 0.14, 130, t);
        this.koto(this.hz(this.grado(7 + Math.min(k, 8))), t + 0.01, 0.12, 0.9);
        break;
      }
      case 'combo': for (let i = 0; i < Math.min(8, x); i++) this.koto(this.hz(this.grado(8 + i)), t + i * 0.055, 0.1, 0.8); this.ka(t, 0.25); this.taiko(t + 0.02, 0.4); break;
      case 'mecha': for (let i = 0; i < 5; i++) this.ruido(0.03, 0.06, 5000, 'highpass', t + i * 0.05 + Math.random() * 0.02); break;
      case 'boom': this.taiko(t, 0.9, null, true); this.ruido(1.4, 0.55, 900, 'lowpass', t, null, 80); this.tono(70, 1.2, 'sine', 0.5, 28, t); break;
      case 'menos': this.taiko(t, 0.6, null, true); this.ruido(0.5, 0.3, 700, 'lowpass', t, null, 120); this.koto(this.hz(50), t + 0.05, 0.12, 0.8); break;
      case 'falla': this.koto(this.hz(this.grado(-2)), t, 0.16, 1.1); this.tono(this.hz(this.grado(-2)), 0.5, 'triangle', 0.08, this.hz(this.grado(-3)), t + 0.05); this.ka(t, 0.2); break;
      case 'poder': for (const [f, v, d] of [[1320, 0.08, 1.2], [1980, 0.05, 0.9], [2640, 0.035, 0.7], [3520, 0.02, 0.5]]) this.tono(f, d, 'sine', v, null, t); this.shaku(this.hz(this.grado(12)), t + 0.05, 0.6, 0.06); break;
      case 'hielo': for (let i = 0; i < 6; i++) this.tono(2600 - i * 260, 0.4, 'sine', 0.04, null, t + i * 0.04); break;
      case 'gong': for (const [f, v, d] of [[98, 0.22, 3], [135, 0.12, 2.6], [212, 0.08, 2.2], [287, 0.05, 1.8], [401, 0.03, 1.4]]) this.tono(f, d, 'sine', v, f * 0.985, t, null, 0.01); this.ruido(0.3, 0.12, 300, 'lowpass', t); break;
      case 'sello': this.taiko(t, 0.45); this.ruido(0.08, 0.2, 1800, 'bandpass', t); break;
      case 'boton': this.tono(880, 0.06, 'sine', 0.12, 560, t); this.ruido(0.02, 0.08, 3000, 'highpass', t); break;
      case 'lanzar': this.ruido(0.25, 0.05, 260, 'lowpass', t, null, 900); break;
      case 'tic': this.ka(t, 0.18); break;
      case 'fin': for (const [i, m] of [[0, 9], [1, 8], [2, 7], [3, 5], [4, 3]]) this.koto(this.hz(this.grado(m)), t + i * 0.16, 0.12, 1.4); this.shaku(this.hz(this.grado(5)), t + 0.85, 1.6, 0.08); break;
    }
  },

  /* ------------------------------------------------------------- música */
  musica(tema) {
    if (this.tema && tema && this.tema.id === tema.id) return;
    this.tema = tema; this.paso = 0;
    if (this.ctx) this.prox = this.ctx.currentTime + 0.12;
  },
  pasar() {
    const c = this.ctx; if (!c || !this.tema || c.state !== 'running' || !this.musicaSi) return;
    const T = this.tema, dp = 60 / T.bpm / 2;
    if (this.prox < c.currentTime - 0.2) this.prox = c.currentTime + 0.05;
    while (this.prox < c.currentTime + 0.25) { this.tocarPaso(this.paso, this.prox, dp); this.paso++; this.prox += dp; }
  },
  tocarPaso(i, t, dp) {
    const T = this.tema, k = i % 16, ac = T.acordes[Math.floor(i / 16) % T.acordes.length], M = this.musicaG;
    const m = T.koto[k]; if (m != null) this.koto(this.hz(this.grado(m + ac)), t, T.vk * (k % 4 === 0 ? 1 : 0.7), 1.3, M);
    const b = T.bajo[k]; if (b != null) this.koto(this.hz(this.grado(b + ac) - 12), t, T.vb, 1.9, M);
    const d = T.tambor[k];
    if (d === 'D') this.taiko(t, T.vt, M); else if (d === 'd') this.taiko(t, T.vt * 0.55, M); else if (d === 'k') this.ka(t, T.vt * 0.5, M);
    for (const [st, gr, du] of T.flauta) if (st === i % 64) this.shaku(this.hz(this.grado(gr + ac)), t, du * dp, T.vf, M);
  },
};

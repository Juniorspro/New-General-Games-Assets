/* ============================================================================
   El sonido, todo sintetizado: un trío de jazz de hotel (contrabajo que
   camina, piano que acompaña "a la Charleston", platillo con swing) en fa
   mayor sobre un "rhythm changes" de 8 compases, y en la multibola entra una
   trompeta con sordina. El swing: la corchea de atrás cae a 2/3 del tiempo.
   Los efectos son los de un pinball de verdad: el clac del flipper, el pop del
   hongo, la campanita del carril, el chasquido de la goma y el "wah-wah" de
   trombón cuando se pierde la bola.
   ========================================================================== */

// los acordes: bajo (midi), notas de paso del bajo y el voicing del piano
const ACORDES = {
  F6: { r: 41, t: [41, 45, 48, 50], v: [57, 60, 62, 65] }, D7: { r: 38, t: [38, 42, 45, 48], v: [54, 57, 60, 62] },
  Gm7: { r: 43, t: [43, 46, 50, 53], v: [53, 58, 62, 65] }, C7: { r: 36, t: [36, 40, 43, 46], v: [52, 58, 60, 64] },
  Am7: { r: 45, t: [45, 48, 52, 55], v: [55, 60, 64, 67] },
};
const PROGRESION = ['F6', 'F6', 'D7', 'D7', 'Gm7', 'Gm7', 'C7', 'C7', 'Am7', 'D7', 'Gm7', 'C7', 'F6', 'D7', 'Gm7', 'C7'];  // de a medio compás
// la trompeta: [corchea dentro de los 4 compases, midi, duración en corcheas]
const RIFF = [[0, 72, 2], [2, 74, 1], [3, 77, 3], [8, 76, 1], [9, 74, 1], [10, 72, 2], [14, 69, 2], [16, 70, 2], [18, 74, 1], [19, 77, 2], [22, 79, 2], [24, 77, 3], [28, 74, 1], [29, 72, 3]];
const TEMAS = {
  menu: { id: 'menu', bpm: 112, piano: 0.05, bajo: 0.16, bateria: 0.6, trompeta: 0 },
  juego: { id: 'juego', bpm: 138, piano: 0.045, bajo: 0.17, bateria: 0.75, trompeta: 0 },
  multi: { id: 'multi', bpm: 176, piano: 0.045, bajo: 0.18, bateria: 0.9, trompeta: 0.05 },
};

const Sonido = {
  ctx: null, total: null, efectos: null, musicaG: null, ruidoBuf: null,
  musicaSi: Guardado.leer('musica', true), efectosSi: Guardado.leer('efectos', true),
  tema: null, tiempo: 0, prox: 0,
  iniciar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    this.total = c.createGain(); this.total.gain.value = 0.9;
    this.efectos = c.createGain(); this.efectos.gain.value = this.efectosSi ? 0.75 : 0;
    this.musicaG = c.createGain(); this.musicaG.gain.value = this.musicaSi ? 0.34 : 0;
    // un poco de sala: eco corto y oscuro
    const d = c.createDelay(1), fb = c.createGain(), fl = c.createBiquadFilter(), env = c.createGain();
    d.delayTime.value = 0.13; fb.gain.value = 0.25; fl.type = 'lowpass'; fl.frequency.value = 2600; env.gain.value = 0.35;
    this.musicaG.connect(env); env.connect(d); d.connect(fl); fl.connect(fb); fb.connect(d); fl.connect(comp);
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

  env(gn, t, vol, ataque, dur) { gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol, t + ataque); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur); },
  osc(tipo, f, t, dur, dst) { const o = this.ctx.createOscillator(); o.type = tipo; o.frequency.setValueAtTime(f, t); o.connect(dst); o.start(t); o.stop(t + dur + 0.05); return o; },
  tono(f, dur, tipo, vol, f2, t, dst, ataque) {
    const c = this.ctx; if (!c) return;
    t = t || c.currentTime;
    const gn = c.createGain(); gn.connect(dst || this.efectos);
    const o = this.osc(tipo || 'sine', f, t, dur, gn);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    this.env(gn, t, vol, ataque || 0.005, dur);
    return o;
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
  /* ------------------------------------------------- los instrumentos */
  contrabajo(m, t, vol, dst) {
    const c = this.ctx, fl = c.createBiquadFilter(), gn = c.createGain(), f = this.hz(m);
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(260, t + 0.3); fl.connect(gn); gn.connect(dst);
    this.osc('triangle', f, t, 0.6, fl); this.osc('sine', f * 2, t, 0.3, fl);
    this.env(gn, t, vol, 0.008, 0.55);
    this.ruido(0.03, vol * 0.25, 600, 'lowpass', t, dst);
  },
  piano(notas, t, vol, dur, dst) {
    const c = this.ctx, fl = c.createBiquadFilter(), gn = c.createGain();
    fl.type = 'lowpass'; fl.frequency.value = 2800; fl.connect(gn); gn.connect(dst);
    for (const m of notas) { const f = this.hz(m); this.osc('triangle', f, t, dur, fl); this.osc('sine', f * 2.003, t, dur * 0.5, fl); }
    this.env(gn, t, vol, 0.004, dur);
  },
  platillo(t, vol, dst) { this.ruido(0.32, vol, 7000, 'highpass', t, dst); this.tono(5200, 0.12, 'square', vol * 0.04, null, t, dst); this.tono(7350, 0.1, 'square', vol * 0.03, null, t, dst); },
  charles(t, vol, dst) { this.ruido(0.05, vol, 8200, 'highpass', t, dst); },
  bombo(t, vol, dst) { this.tono(95, 0.2, 'sine', vol, 45, t, dst, 0.003); },
  escobilla(t, vol, dst) { this.ruido(0.12, vol, 2400, 'bandpass', t, dst, 1600, 0.7); },
  trompeta(m, t, dur, vol, dst) {
    const c = this.ctx, f = this.hz(m), bp = c.createBiquadFilter(), lp = c.createBiquadFilter(), gn = c.createGain(), lfo = c.createOscillator(), pr = c.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 1.4; lp.type = 'lowpass'; lp.frequency.value = 3200;
    bp.connect(lp); lp.connect(gn); gn.connect(dst);
    const o = this.osc('sawtooth', f * 0.985, t, dur, bp); o.frequency.linearRampToValueAtTime(f, t + 0.05);
    lfo.frequency.value = 5.5; pr.gain.setValueAtTime(0, t); pr.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.3, dur * 0.7));
    lfo.connect(pr); pr.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol, t + 0.04); gn.gain.setValueAtTime(vol, t + Math.max(0.05, dur - 0.08)); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  },
  /* el "wah-wah-wah-waaah" del trombón con sordina: tres notas que bajan con el filtro que abre y cierra */
  wah(t) {
    const c = this.ctx;
    [[58, 0, 0.32], [57, 0.36, 0.32], [56, 0.72, 0.32], [55, 1.08, 0.9]].forEach(([m, d, du]) => {
      const bp = c.createBiquadFilter(), gn = c.createGain(), f = this.hz(m - 12), t0 = t + d;
      bp.type = 'bandpass'; bp.Q.value = 3; bp.frequency.setValueAtTime(300, t0); bp.frequency.linearRampToValueAtTime(1100, t0 + du * 0.5); bp.frequency.linearRampToValueAtTime(350, t0 + du);
      bp.connect(gn); gn.connect(this.efectos);
      const o = this.osc('sawtooth', f, t0, du, bp);
      if (du > 0.5) { const l = c.createOscillator(), p = c.createGain(); l.frequency.value = 6; p.gain.value = f * 0.02; l.connect(p); p.connect(o.frequency); l.start(t0); l.stop(t0 + du); }
      this.env(gn, t0, 0.32, 0.03, du);
    });
  },
  /* -------------------------------------------------------- efectos */
  sfx(n, x) {
    if (!this.ctx || !this.efectosSi || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    switch (n) {
      case 'flip': this.ruido(0.05, 0.22, 2600, 'bandpass', t, null, 900, 1.2); this.tono(140, 0.07, 'sine', 0.25, 70, t); break;
      case 'baja': this.ruido(0.04, 0.08, 1400, 'bandpass', t); break;
      case 'hongo': this.tono(620, 0.12, 'sine', 0.22, 300, t); this.ruido(0.05, 0.25, 3000, 'bandpass', t); this.tono(1568 + (x || 0) * 220, 0.35, 'sine', 0.07, null, t + 0.01); break;
      case 'goma': this.ruido(0.06, 0.3, 4200, 'highpass', t); this.tono(220, 0.08, 'square', 0.06, 110, t); break;
      case 'blanco': this.tono(180, 0.1, 'square', 0.12, 90, t); this.ruido(0.08, 0.2, 900, 'lowpass', t); break;
      case 'carril': this.tono(1568, 0.4, 'sine', 0.1, null, t); this.tono(2349, 0.3, 'sine', 0.06, null, t + 0.06); break;
      case 'pared': this.tono(320, 0.04, 'sine', clamp((x || 300) / 2500, 0.02, 0.12), 200, t); break;
      case 'copa': this.tono(2637, 0.6, 'sine', 0.08, null, t); this.tono(3951, 0.5, 'sine', 0.05, null, t + 0.03); this.ruido(0.3, 0.15, 500, 'lowpass', t, null, 200); break;
      case 'expulsa': this.tono(110, 0.15, 'sine', 0.35, 50, t); this.ruido(0.08, 0.2, 1200, 'bandpass', t); break;
      case 'molinete': for (let i = 0; i < Math.min(12, x || 3); i++) this.ruido(0.015, 0.1, 5000, 'highpass', t + i * 0.035); break;
      case 'resorte': this.tono(90 + (x || 0) * 200, 0.08, 'sawtooth', 0.04, null, t); break;
      case 'lanza': this.tono(70, 0.25, 'sine', 0.4, 140, t); this.ruido(0.2, 0.2, 800, 'lowpass', t, null, 3000); this.tono(440, 0.3, 'triangle', 0.05, 220, t + 0.02); break;
      case 'cae': this.wah(t); break;
      case 'salvo': this.tono(800, 0.25, 'sine', 0.1, 1600, t); this.tono(1600, 0.3, 'sine', 0.07, null, t + 0.25); break;
      case 'jackpot': this.piano([65, 69, 72, 74, 77], t, 0.12, 1.2, this.efectos); for (const m of [65, 69, 72, 76]) this.trompeta(m, t, 0.8, 0.07, this.efectos); this.platillo(t, 0.5, this.efectos); this.bombo(t, 0.6, this.efectos); break;
      case 'mision': [72, 76, 79, 84].forEach((m, i) => this.trompeta(m, t + i * 0.1, i === 3 ? 0.7 : 0.14, 0.09, this.efectos)); this.platillo(t + 0.3, 0.4, this.efectos); break;
      case 'extra': for (let i = 0; i < 6; i++) this.tono(2093 * (i % 2 ? 1.26 : 1), 0.3, 'sine', 0.07, null, t + i * 0.08); break;
      case 'mult': for (let i = 0; i < 8; i++) this.piano([60 + i * 3], t + i * 0.03, 0.08, 0.4, this.efectos); break;
      case 'multibola': this.sfx('jackpot'); for (let i = 0; i < 3; i++) this.bombo(t + 0.4 + i * 0.12, 0.5, this.efectos); break;
      case 'boton': this.tono(1200, 0.04, 'sine', 0.1, 900, t); this.ruido(0.02, 0.06, 4000, 'highpass', t); break;
      case 'tic': this.charles(t, 0.3, this.efectos); this.tono(1800, 0.04, 'sine', 0.05, null, t); break;
      case 'record': this.sfx('mision'); this.piano([65, 69, 72, 76, 79], t + 0.5, 0.1, 1.6, this.efectos); break;
    }
  },
  /* ---------------------------------------------------------- música */
  musica(tema) {
    if (this.tema && tema && this.tema.id === tema.id) return;
    const seguir = !!this.tema;
    this.tema = tema;
    if (!seguir) { this.tiempo = 0; if (this.ctx) this.prox = this.ctx.currentTime + 0.1; }
  },
  pasar() {
    const c = this.ctx; if (!c || !this.tema || c.state !== 'running' || !this.musicaSi) return;
    const B = 60 / this.tema.bpm;
    if (this.prox < c.currentTime - 0.2) this.prox = c.currentTime + 0.05;
    while (this.prox < c.currentTime + 0.25) { this.tocarTiempo(this.tiempo, this.prox, B); this.tiempo++; this.prox += B; }
  },
  tocarTiempo(i, t, B) {
    const T = this.tema, M = this.musicaG, k = i % 4, medio = Math.floor(i / 2) % PROGRESION.length, ac = ACORDES[PROGRESION[medio]];
    const sw = B * 0.66;                         // la corchea de atrás, con swing
    // el contrabajo camina: fundamental, nota del acorde, quinta y una de paso hacia el próximo acorde
    const prox = ACORDES[PROGRESION[(Math.floor((i + 1) / 2)) % PROGRESION.length]];
    const nota = k === 0 ? ac.r : k === 3 ? prox.r + (i % 8 === 3 ? -1 : 1) : ac.t[k === 1 ? 1 + (i % 3 === 0 ? 1 : 0) : 2];
    this.contrabajo(nota, t, T.bajo, M);
    // el platillo: tin, tin-ta-tin; el charles en 2 y 4; un bombo apenas en 1 y 3
    this.platillo(t, 0.05 * T.bateria, M);
    if (k === 1 || k === 3) { this.platillo(t + sw, 0.035 * T.bateria, M); this.charles(t, 0.12 * T.bateria, M); this.escobilla(t, 0.05 * T.bateria, M); }
    if (k === 0 || k === 2) this.bombo(t, 0.12 * T.bateria, M);
    // el piano a la Charleston: en el 1 cortito y en el "y" del 2 más largo
    if (k === 0) this.piano(ac.v, t, T.piano, B * 0.5, M);
    if (k === 1) this.piano(ac.v, t + sw, T.piano * 0.9, B * 1.3, M);
    // la trompeta con sordina, solo en la multibola
    if (T.trompeta) {
      const c8 = (i % 16) * 2;
      for (const [p, m, d] of RIFF) { if (p === c8) this.trompeta(m, t, d * B * 0.5, T.trompeta, M); if (p === c8 + 1) this.trompeta(m, t + sw, d * B * 0.5, T.trompeta, M); }
    }
  },
};

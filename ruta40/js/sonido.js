/* ============================================================================
   ruta40/js/sonido.js — todo sintetizado con WebAudio, sin un solo archivo.

   El motor: dos osciladores (serrucho y cuadrada a media octava) más ruido,
   por una saturación y un filtro que se abre con el acelerador. Cada
   vehículo tiene su voz: la chata nafta pareja, el Fitito zumbón refrigerado
   por aire, el colectivo gasolero que traquetea, la 4x4 con V8 y el tractor
   con su "put-put" (el volumen late a la frecuencia de las explosiones).

   La música es una chacarera propia en mi menor, en 6/8: bombo legüero
   (parche y aro), guitarra rasgueada, charango y quena. Las cuerdas son
   Karplus-Strong precalculado (una cuerda que se apaga sola). En los menús
   va más lenta y sin bombo, como una zamba; en la ruta suena como radio.
   Con estilo '16bits' la misma canción va con ondas de consola.
   ========================================================================== */
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export const Sonido = {
  ctx: null, listo: false, vol: { musica: 0.7, motor: 0.85, efectos: 0.9 }, estilo: 'folk', radio: true,
  iniciar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(c.destination);
    this.bus = {};
    for (const b of ['musica', 'motor', 'efectos']) { this.bus[b] = c.createGain(); this.bus[b].gain.value = this.vol[b]; this.bus[b].connect(this.master); }
    /* una reverb corta de galpón, para los efectos y la música */
    this.eco = c.createConvolver(); this.eco.buffer = this.respuesta(1.4, 2.6);
    const ecoG = c.createGain(); ecoG.gain.value = 0.22; this.eco.connect(ecoG); ecoG.connect(this.master);
    this.ruidoBuf = this.ruido(2);
    this.cuerdas = {};
    this.listo = true;
  },
  ponerVol(b, v) { this.vol[b] = v; if (this.bus && this.bus[b]) this.bus[b].gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); },
  respuesta(seg, caida) {
    const c = this.ctx, n = Math.floor(c.sampleRate * seg), b = c.createBuffer(2, n, c.sampleRate);
    for (let k = 0; k < 2; k++) { const d = b.getChannelData(k); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, caida); }
    return b;
  },
  ruido(seg) {
    const c = this.ctx, n = Math.floor(c.sampleRate * seg), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  },
  fuenteRuido(loop = true) { const s = this.ctx.createBufferSource(); s.buffer = this.ruidoBuf; s.loop = loop; return s; },

  /* ------------------------------------------------------------------ el motor */
  motorEncender(voz) {
    if (!this.listo) return;
    this.motorApagar();
    const c = this.ctx, m = this.m = { voz };
    m.o1 = c.createOscillator(); m.o1.type = 'sawtooth';
    m.o2 = c.createOscillator(); m.o2.type = voz.tipo === 'aire' ? 'square' : 'square';
    m.o3 = c.createOscillator(); m.o3.type = 'sawtooth'; m.o3.detune.value = voz.tipo === 'v8' ? 14 : 7;
    const g1 = c.createGain(), g2 = c.createGain(), g3 = c.createGain();
    g1.gain.value = 0.5; g2.gain.value = voz.tipo === 'tractor' || voz.tipo === 'gasoil' ? 0.7 : 0.4; g3.gain.value = voz.tipo === 'v8' ? 0.45 : 0.2;
    m.sat = c.createWaveShaper(); const k = voz.tipo === 'v8' ? 5 : voz.tipo === 'gasoil' ? 4 : 2.5, curva = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curva[i] = Math.tanh(x * k) / Math.tanh(k); }
    m.sat.curve = curva;
    m.filtro = c.createBiquadFilter(); m.filtro.type = 'lowpass'; m.filtro.Q.value = 2.2; m.filtro.frequency.value = voz.filtro;
    /* el latido de las explosiones: una ganancia que oscila */
    m.late = c.createGain(); m.late.gain.value = 1;
    m.lfo = c.createOscillator(); m.lfo.type = voz.tipo === 'tractor' ? 'square' : 'sine';
    m.lfoG = c.createGain(); m.lfoG.gain.value = voz.tipo === 'tractor' ? 0.55 : voz.tipo === 'gasoil' ? 0.3 : voz.tipo === 'aire' ? 0.25 : 0.12;
    m.lfo.connect(m.lfoG); m.lfoG.connect(m.late.gain);
    m.salida = c.createGain(); m.salida.gain.value = 0;
    m.o1.connect(g1); m.o2.connect(g2); m.o3.connect(g3);
    g1.connect(m.sat); g2.connect(m.sat); g3.connect(m.sat);
    m.sat.connect(m.filtro); m.filtro.connect(m.late); m.late.connect(m.salida); m.salida.connect(this.bus.motor);
    /* el traqueteo del gasoil y el zumbido de admisión: ruido filtrado */
    m.rui = this.fuenteRuido(); m.ruiF = c.createBiquadFilter(); m.ruiF.type = 'bandpass'; m.ruiF.Q.value = 1.2; m.ruiF.frequency.value = 1800;
    m.ruiG = c.createGain(); m.ruiG.gain.value = 0; m.rui.connect(m.ruiF); m.ruiF.connect(m.ruiG); m.ruiG.connect(m.late);
    /* las cubiertas que patinan y el viento */
    m.pat = this.fuenteRuido(); m.patF = c.createBiquadFilter(); m.patF.type = 'bandpass'; m.patF.frequency.value = 950; m.patF.Q.value = 0.9;
    m.patG = c.createGain(); m.patG.gain.value = 0; m.pat.connect(m.patF); m.patF.connect(m.patG); m.patG.connect(this.bus.efectos);
    m.vie = this.fuenteRuido(); m.vieF = c.createBiquadFilter(); m.vieF.type = 'lowpass'; m.vieF.frequency.value = 420;
    m.vieG = c.createGain(); m.vieG.gain.value = 0; m.vie.connect(m.vieF); m.vieF.connect(m.vieG); m.vieG.connect(this.bus.efectos);
    const t = c.currentTime;
    for (const o of [m.o1, m.o2, m.o3, m.lfo, m.rui, m.pat, m.vie]) o.start(t);
    m.rpm = 0; m.carga = 0;
    this.tono(t, voz.base * 0.5, 0.22, 'sawtooth', 0.35, this.bus.motor, voz.base * 1.4); // el arranque
  },
  /* por cuadro: rpm 0..1, gas 0..1, patina (m/s), velocidad (m/s), si toca el piso y el viento del tramo */
  motor(rpm, gas, patina, vel, toca, viento, dt) {
    const m = this.m; if (!m || !this.listo) return;
    const c = this.ctx, t = c.currentTime, V = m.voz;
    m.rpm += (rpm - m.rpm) * Math.min(1, dt * 7);
    m.carga += (gas - m.carga) * Math.min(1, dt * 9);
    const f = V.base + V.sube * m.rpm + m.carga * V.base * 0.18 + Math.sin(t * 23) * 0.4;
    m.o1.frequency.setTargetAtTime(f, t, 0.03); m.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03); m.o3.frequency.setTargetAtTime(f * 1.005, t, 0.03);
    m.lfo.frequency.setTargetAtTime(V.tipo === 'tractor' ? f * 0.5 : f * 0.25, t, 0.05);
    m.filtro.frequency.setTargetAtTime(V.filtro * (0.55 + m.carga * 0.9 + m.rpm * 1.1), t, 0.05);
    m.salida.gain.setTargetAtTime(0.11 + m.carga * 0.13 + m.rpm * 0.07, t, 0.06);
    m.ruiG.gain.setTargetAtTime((V.tipo === 'gasoil' ? 0.18 : 0.05) * (0.3 + m.carga), t, 0.05);
    m.ruiF.frequency.setTargetAtTime(900 + m.rpm * 2400, t, 0.05);
    m.patG.gain.setTargetAtTime(toca ? Math.min(0.32, patina * 0.05) : 0, t, 0.04);
    m.vieG.gain.setTargetAtTime(Math.min(0.35, Math.pow(vel / 32, 2) * 0.35) + (viento ? 0.12 : 0), t, 0.2);
    m.vieF.frequency.setTargetAtTime(300 + vel * 25, t, 0.2);
  },
  motorApagar() {
    const m = this.m; if (!m) return;
    const t = this.ctx.currentTime;
    m.salida.gain.setTargetAtTime(0, t, 0.08); m.patG.gain.setTargetAtTime(0, t, 0.05); m.vieG.gain.setTargetAtTime(0, t, 0.2);
    for (const o of [m.o1, m.o2, m.o3, m.lfo, m.rui, m.pat, m.vie]) { try { o.stop(t + 0.8); } catch (_) {} }
    this.m = null;
  },

  /* ------------------------------------------------------------------ piezas sueltas */
  tono(t, f, dur, tipo = 'sine', vol = 0.3, dest = null, f2 = null, ataque = 0.005) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.bus.efectos);
    o.start(t); o.stop(t + dur + 0.05);
    return g;
  },
  soplo(t, dur, frec, q, vol, dest, tipo = 'bandpass', f2 = null) {
    const c = this.ctx, s = this.fuenteRuido(false), f = c.createBiquadFilter(), g = c.createGain();
    f.type = tipo; f.frequency.setValueAtTime(frec, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur); f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.bus.efectos);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },
  racha: 0, ultMoneda: 0,
  efecto(n, o = {}) {
    if (!this.listo) return;
    const c = this.ctx, t = c.currentTime + 0.005, E = this.bus.efectos;
    switch (n) {
      case 'moneda': {
        /* sube de tono si se juntan seguidas */
        this.racha = t - this.ultMoneda < 0.35 ? Math.min(12, this.racha + 1) : 0; this.ultMoneda = t;
        const b = 1 + this.racha * 0.03, v = o.v >= 100 ? 1.5 : o.v >= 25 ? 1.25 : 1;
        this.tono(t, 1568 * b * v, 0.12, 'square', 0.05); this.tono(t + 0.045, 2349 * b * v, 0.22, 'sine', 0.12);
        break;
      }
      case 'nafta':
        for (let i = 0; i < 3; i++) this.tono(t + i * 0.07, 320 - i * 40, 0.07, 'sine', 0.22, E, 150);
        this.tono(t + 0.24, 880, 0.3, 'triangle', 0.16); this.tono(t + 0.3, 1320, 0.35, 'sine', 0.12);
        break;
      case 'mojon':
        [880, 1109, 1319].forEach((f, i) => { this.tono(t + i * 0.09, f, 0.5, 'triangle', 0.14); this.tono(t + i * 0.09, f * 2.01, 0.3, 'sine', 0.04); });
        break;
      case 'truco': {
        this.soplo(t, 0.35, 600, 1.5, 0.25, E, 'bandpass', 2400);
        const base = o.grande ? 523 : 659;
        [0, 4, 7, 12].forEach((s, i) => this.tono(t + 0.06 + i * 0.06, base * Math.pow(2, s / 12), 0.25, 'square', 0.05));
        break;
      }
      case 'record':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tono(t + i * 0.1, f, 0.4, 'triangle', 0.16));
        break;
      case 'aterriza': {
        const k = o.fuerza || 0.5;
        this.tono(t, 110, 0.3, 'sine', 0.25 + k * 0.35, E, 42);
        this.soplo(t, 0.25, 500, 0.8, 0.12 + k * 0.25, E, 'lowpass', 120);
        if (k > 0.6) this.tono(t + 0.02, 180 + Math.random() * 60, 0.18, 'square', 0.04, E, 90);
        break;
      }
      case 'rebote': this.tono(t, 900 + Math.random() * 300, 0.08, 'triangle', 0.03 * (o.fuerza || 0.5), E, 500); break;
      case 'golpe': {
        const k = o.fuerza || 0.5;
        this.soplo(t, 0.35, 1500, 0.6, 0.2 + k * 0.4, E, 'bandpass', 300);
        [231, 377, 523].forEach((f) => this.tono(t, f * (0.9 + Math.random() * 0.2), 0.5, 'square', 0.03 + k * 0.03, E, f * 0.8));
        break;
      }
      case 'cabeza':
        this.tono(t, 320, 0.16, 'triangle', 0.5, E, 110);
        this.tono(t + 0.12, 700, 0.6, 'sine', 0.22, E, 260);
        for (let i = 0; i < 6; i++) this.tono(t + 0.25 + i * 0.07, 1400 + (i % 2) * 400, 0.08, 'sine', 0.06);
        break;
      case 'naftaBaja': for (let i = 0; i < 3; i++) this.tono(t + i * 0.22, 988, 0.12, 'square', 0.07); break;
      case 'semaforo': this.tono(t, 440, 0.22, 'square', 0.14); break;
      case 'largada': this.tono(t, 880, 0.6, 'square', 0.16); this.tono(t, 1320, 0.6, 'sine', 0.08); break;
      case 'llego': [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => this.tono(t + i * 0.12, f, 0.45, 'triangle', 0.16)); break;
      case 'perdio': [392, 370, 349, 294].forEach((f, i) => this.tono(t + i * 0.18, f, 0.35, 'triangle', 0.13)); break;
      case 'clic': this.tono(t, 520, 0.09, 'sine', 0.14); this.tono(t, 1340, 0.06, 'sine', 0.06); this.soplo(t, 0.03, 3000, 1, 0.08); break;
      case 'caja': [1175, 1568, 2093].forEach((f, i) => this.tono(t + i * 0.05, f, 0.35, 'sine', 0.12)); for (let i = 0; i < 5; i++) this.tono(t + 0.2 + i * 0.03, 2500 + Math.random() * 800, 0.05, 'square', 0.02); break;
      case 'no': this.tono(t, 180, 0.25, 'square', 0.08, E, 140); break;
      case 'papel': this.soplo(t, 0.18, 2200, 0.7, 0.12, E, 'highpass'); break;
    }
  },

  /* ------------------------------------------------------------------ la música */
  cuerda(m, brillo = 0.5, dura = 1.6) {
    /* Karplus-Strong: una línea de retardo con un promedio que la apaga (y se guarda) */
    const clave = m + ':' + brillo;
    if (this.cuerdas[clave]) return this.cuerdas[clave];
    const c = this.ctx, sr = c.sampleRate, n = Math.floor(sr * dura), b = c.createBuffer(1, n, sr), d = b.getChannelData(0);
    const P = Math.max(2, Math.round(sr / mtof(m))), lin = new Float32Array(P);
    for (let i = 0; i < P; i++) lin[i] = Math.random() * 2 - 1;
    let k = 0; const amort = 0.996 - (1 - brillo) * 0.004;
    for (let i = 0; i < n; i++) { const a = lin[k], bb = lin[(k + 1) % P]; d[i] = a * 0.6; lin[k] = (a * brillo + bb * (1 - brillo)) * amort; k = (k + 1) % P; }
    return (this.cuerdas[clave] = b);
  },
  pulsar(t, m, vol, dest, brillo = 0.5, dura = 1.6) {
    const c = this.ctx;
    if (this.estilo === '16bits') { this.tono(t, mtof(m), Math.min(0.5, dura * 0.3), m < 50 ? 'triangle' : 'square', vol * 0.25, dest); return; }
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = this.cuerda(m, brillo, dura); g.gain.value = vol;
    s.connect(g); g.connect(dest); s.start(t); s.stop(t + dura);
  },
  quena(t, m, dur, vol, dest) {
    const c = this.ctx, f = mtof(m);
    if (this.estilo === '16bits') {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'square';
      const w = c.createPeriodicWave(new Float32Array([0, 1, 0.5, 0.33, 0.25, 0.2, 0.16]), new Float32Array(7)); o.setPeriodicWave(w);
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * 0.3, t + 0.01); g.gain.setValueAtTime(vol * 0.25, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02); return;
    }
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), vib = c.createOscillator(), vg = c.createGain();
    o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f * 2;
    vib.frequency.value = 5.2; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.4, dur * 0.6));
    vib.connect(vg); vg.connect(o.frequency);
    const g2 = c.createGain(); g2.gain.value = 0.12; o2.connect(g2); g2.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.06); g.gain.setValueAtTime(vol * 0.85, t + dur * 0.75); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(g); g.connect(dest);
    /* el soplido del principio */
    this.soplo(t, 0.12, f * 2, 2, vol * 0.25, dest);
    for (const x of [o, o2, vib]) { x.start(t); x.stop(t + dur + 0.1); }
  },
  bombo(t, parche, vol, dest) {
    if (this.estilo === '16bits') { if (parche) this.tono(t, 120, 0.18, 'triangle', vol * 0.9, dest, 40); else this.soplo(t, 0.05, 6000, 0.5, vol * 0.4, dest, 'highpass'); return; }
    if (parche) { this.tono(t, 78, 0.45, 'sine', vol, dest, 44); this.soplo(t, 0.1, 180, 0.7, vol * 0.3, dest, 'lowpass'); }
    else { this.soplo(t, 0.04, 2600, 2.5, vol * 0.5, dest); this.tono(t, 820, 0.03, 'sine', vol * 0.25, dest); }
  },

  /* la chacarera: acordes por compás, la melodía como [nota MIDI o 0, corcheas] */
  CANCION: {
    acordes: ['Em', 'Em', 'B7', 'Em', 'Am', 'Em', 'B7', 'Em', 'Em', 'Em', 'B7', 'Em', 'Am', 'Em', 'B7', 'Em',
      'G', 'D', 'Am', 'Em', 'C', 'B7', 'Em', 'Em', 'G', 'D', 'Am', 'Em', 'C', 'B7', 'Em', 'Em'],
    voces: { Em: [40, 52, 55, 59, 64], B7: [47, 51, 54, 57, 63], Am: [45, 52, 57, 60, 64], G: [43, 50, 55, 59, 62], D: [38, 50, 54, 57, 62], C: [48, 52, 55, 60, 64] },
    melodia: [
      [71, 2], [76, 1], [74, 1], [71, 2], [67, 1], [69, 1], [71, 2], [64, 2], [66, 2], [69, 1], [71, 1], [75, 2], [76, 3], [71, 3],
      [72, 2], [71, 1], [69, 1], [76, 2], [71, 2], [67, 1], [69, 1], [71, 2], [69, 1], [67, 1], [66, 2], [63, 2], [64, 6],
      [71, 2], [76, 1], [74, 1], [71, 2], [67, 1], [69, 1], [71, 2], [76, 2], [78, 2], [76, 1], [75, 1], [71, 2], [76, 3], [79, 3],
      [81, 2], [79, 1], [76, 1], [72, 2], [71, 2], [67, 1], [69, 1], [71, 2], [69, 1], [67, 1], [66, 2], [63, 2], [64, 6],
      [74, 2], [71, 1], [74, 1], [79, 2], [78, 2], [76, 1], [74, 1], [69, 2], [72, 2], [76, 1], [72, 1], [69, 2], [71, 3], [67, 3],
      [76, 2], [74, 1], [72, 1], [67, 2], [66, 1], [69, 1], [71, 2], [75, 2], [76, 2], [74, 1], [71, 1], [67, 2], [64, 3], [0, 3],
      [74, 2], [71, 1], [74, 1], [79, 2], [81, 2], [79, 1], [78, 1], [74, 2], [76, 2], [79, 1], [76, 1], [72, 2], [71, 3], [79, 3],
      [76, 2], [74, 1], [72, 1], [67, 2], [66, 1], [69, 1], [71, 2], [75, 2], [76, 2], [71, 1], [67, 1], [64, 2], [64, 6],
    ],
  },
  musica(modo) {
    /* modo: 'menu' | 'ruta' | null */
    if (!this.listo) return;
    if (this.modoMusica === modo) return;
    this.modoMusica = modo;
    if (this.reloj) { clearInterval(this.reloj); this.reloj = null; }
    if (this.musBus) { const g = this.musBus; g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3); setTimeout(() => g.disconnect(), 1500); this.musBus = null; }
    if (!modo || (modo === 'ruta' && !this.radio)) return;
    const c = this.ctx, bus = this.musBus = c.createGain();
    bus.gain.value = 0; bus.gain.setTargetAtTime(modo === 'ruta' ? 0.42 : 0.9, c.currentTime, 0.6);
    /* en la ruta, como una radio: sin graves y con un poco de ruido */
    if (modo === 'ruta') { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.35; bus.connect(f); f.connect(this.bus.musica); }
    else bus.connect(this.bus.musica);
    const eco = c.createGain(); eco.gain.value = 0.35; bus.connect(eco); eco.connect(this.eco);
    const C = this.CANCION, corchea = modo === 'menu' ? 0.27 : 0.19;
    let t0 = c.currentTime + 0.15, i = 0, im = 0, tm = t0;
    const largo = C.acordes.length * 6;
    const programar = () => {
      const hasta = c.currentTime + 0.6;
      while (t0 < hasta) {
        const compas = Math.floor(i / 6) % C.acordes.length, pos = i % 6, voz = C.voces[C.acordes[compas]];
        /* la guitarra: bajo en 1 y 4, rasguido en 3 y 6, chasquido en 2 y 5 */
        if (pos === 0 || pos === 3) this.pulsar(t0, voz[0] + (pos === 3 ? 7 : 0) - (pos === 3 && voz[0] + 7 > 50 ? 12 : 0), 0.5, bus, 0.55, 1.4);
        if (pos === 2 || pos === 5) voz.slice(1).forEach((m, k) => this.pulsar(t0 + k * 0.012, m, 0.2, bus, 0.6, 0.9));
        if ((pos === 1 || pos === 4) && modo === 'ruta') this.soplo(t0, 0.03, 2400, 1.5, 0.05, bus);
        /* el charango: rasguido cortito y agudo en 2, 3, 5 y 6 (solo en la ruta) */
        if (modo === 'ruta' && pos !== 0 && pos !== 3) voz.slice(2).forEach((m, k) => this.pulsar(t0 + k * 0.008, m + 12, 0.08, bus, 0.75, 0.35));
        /* el bombo legüero: parche en 1 y 4, aro en 3, 5 y 6 */
        if (modo === 'ruta') { if (pos === 0 || pos === 3) this.bombo(t0, true, 0.5, bus); if (pos === 2 || pos === 4 || pos === 5) this.bombo(t0, false, 0.4, bus); }
        i++; t0 += corchea;
        if (i % largo === 0) i = 0;
      }
      /* la quena */
      while (tm < hasta) {
        const [m, d] = C.melodia[im % C.melodia.length];
        if (m) this.quena(tm, m + (modo === 'menu' ? 0 : 0), d * corchea * 0.95, modo === 'menu' ? 0.16 : 0.11, bus);
        tm += d * corchea; im++;
      }
    };
    programar();
    this.reloj = setInterval(programar, 120);
  },
};

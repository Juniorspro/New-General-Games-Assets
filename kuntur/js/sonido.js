/* ============================================================================
   kuntur/js/sonido.js — la música andina y los ruiditos de papel, sintetizados
   en el momento (no hay archivos de audio).
   - Charango: cuerda pulsada (Karplus-Strong) calculada una vez por nota y
     guardada; el rasgueo son las cuerdas dobles sonando casi juntas.
   - Quena: soplo (ruido filtrado) más un tono con vibrato que llega tarde.
   - Sikus: el tono con mucho más soplo y ataque de caña.
   - Bombo legüero: el golpe grave que baja y el parche de cuero.
   Cada tema es una lista de pistas que se repite; se programan unas décimas
   por adelantado con el reloj del audio para que no se atrasen nunca.
   ========================================================================== */

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const NOTA = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/* "E5" -> 76, "C#4" -> 61 */
function nm(s) { const m = /^([A-G])(#|b)?(-?\d)$/.exec(s); if (!m) return null; return 12 * (+m[3] + 1) + NOTA[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); }
/* "E5:1 D5:.5 -:.5" -> [[inicio, midi, dur]] */
function melodia(txt, desde) {
  let t = desde || 0; const r = [];
  for (const tok of txt.trim().split(/\s+/)) { const [n, d] = tok.split(':'); const dur = +d; if (n !== '-') r.push([t, nm(n), dur]); t += dur; }
  return r;
}
/* acordes para el charango: nombre -> notas (en la afinación del charango, apretadas y agudas) */
const ACORDES = {
  Am: ['A4', 'C5', 'E5', 'A5', 'E4'], C: ['G4', 'C5', 'E5', 'G5', 'C5'], G: ['G4', 'B4', 'D5', 'G5', 'D5'], Dm: ['A4', 'D5', 'F5', 'A5', 'D5'],
  E: ['G#4', 'B4', 'E5', 'G#5', 'E4'], F: ['A4', 'C5', 'F5', 'A5', 'F4'], Em: ['G4', 'B4', 'E5', 'G5', 'E4'], D: ['A4', 'D5', 'F#5', 'A5', 'D5'],
  Bm: ['B4', 'D5', 'F#5', 'B5', 'F#4'],
};

/* ---------------- los temas ---------------- */
function tema(bpm, compas, pistas, o) { return Object.assign({ bpm, compas, pistas }, o || {}); }
/* rasgueo de huayno: una corchea y dos semis por tiempo */
function rasgueo(acordes, tiempos, patron) {
  const r = [];
  acordes.forEach((a, i) => {
    for (let b = 0; b < tiempos; b++) {
      const t0 = i * tiempos + b;
      for (const [dt, v, abajo] of patron) r.push([t0 + dt, a, v, abajo]);
    }
  });
  return r;
}
const HUAYNO = [[0, 0.9, 1], [0.5, 0.55, 0], [0.75, 0.6, 1]];
const LENTO = [[0, 0.7, 1], [1, 0.45, 0]];
const ARPEGIO = [[0, 0.5, 2], [0.5, 0.4, 3], [1, 0.45, 4], [1.5, 0.4, 5]];

const TEMA = {
  /* el tema de Killa y Apu: un yaraví que después se vuelve huayno */
  titulo: tema(72, 4, {
    quena: melodia('E5:1 D5:.5 C5:.5 A4:2 C5:1 D5:.5 E5:.5 G5:1.5 E5:.5 A5:1 G5:.5 E5:.5 D5:1 C5:1 D5:1.5 C5:.5 A4:2 -:4 E5:1 G5:.5 A5:.5 C6:2 A5:1 G5:.5 E5:.5 D5:1.5 E5:.5 G5:1 E5:.5 D5:.5 C5:1 A4:1 C5:.5 D5:.5 C5:.5 A4:.5 A4:2 -:2'),
    arpegio: ['Am', 'Am', 'C', 'G', 'Am', 'G', 'Am', 'Am', 'C', 'C', 'G', 'G', 'Am', 'G', 'Am', 'Am'],
    bombo: [[0, 0.5], [2, 0.3]], largo: 64, reverb: 0.5,
  }),
  prologo: tema(56, 4, {
    quena: melodia('-:4 A4:2 C5:1 A4:1 G4:3 -:1 E4:2 G4:1 A4:1 A4:4 -:4 C5:2 D5:1 C5:1 A4:3 G4:1 E4:4 -:4'),
    largo: 40, reverb: 0.8, viento: 1, suave: true,
  }),
  colores: tema(100, 2, {
    quena: melodia('A5:.5 G5:.25 E5:.25 G5:.5 A5:.5 C6:.5 A5:.5 G5:1 E5:.5 D5:.25 C5:.25 D5:.5 E5:.5 G5:.5 E5:.5 D5:1 A5:.5 G5:.25 E5:.25 G5:.5 A5:.5 C6:.5 D6:.5 C6:1 A5:.5 G5:.5 E5:.5 D5:.25 C5:.25 A4:1 A4:1 -:8 E5:.5 E5:.25 G5:.25 A5:.5 E5:.5 D5:.5 C5:.5 D5:1 E5:.5 E5:.25 G5:.25 A5:.5 C6:.5 A5:.5 G5:.5 E5:1 C6:.5 A5:.5 G5:.5 E5:.5 D5:.5 E5:.5 C5:.5 D5:.25 C5:.25 A4:1 A4:1 -:8'),
    rasgueo: rasgueo(['Am', 'Am', 'C', 'G', 'Am', 'Am', 'C', 'G', 'Am', 'G', 'C', 'G', 'Am', 'G', 'Am', 'Am', 'Am', 'Am', 'C', 'G', 'Am', 'Am', 'C', 'G'], 2, HUAYNO),
    bombo: [[0, 0.9], [1.5, 0.5]], parche: [[1, 0.35]], largo: 48, reverb: 0.3,
  }),
  salinas: tema(66, 4, {
    sikus: melodia('D5:2 F5:1 G5:1 A5:3 -:1 G5:1 F5:1 D5:2 C5:2 -:2 D5:1 F5:1 A5:1 C6:1 A5:2 G5:2 F5:1 G5:1 F5:1 D5:1 D5:4 -:4'),
    arpegio: ['Dm', 'Dm', 'F', 'C', 'Dm', 'F', 'C', 'Dm'], largo: 32, reverb: 0.7, viento: 0.6, suave: true,
  }),
  tren: tema(126, 2, {
    quena: melodia('E5:.5 G5:.25 A5:.25 B5:.5 A5:.5 G5:.5 E5:.5 D5:.5 E5:.5 G5:.5 A5:.25 G5:.25 E5:.5 D5:.5 E5:1 -:1 B5:.5 D6:.25 B5:.25 A5:.5 G5:.5 A5:.5 B5:.5 G5:.5 E5:.5 D5:.5 E5:.25 D5:.25 B4:.5 D5:.5 E5:1 -:1 -:8'),
    rasgueo: rasgueo(['Em', 'D', 'Em', 'Em', 'G', 'D', 'Em', 'Em', 'Em', 'D', 'G', 'D', 'Em', 'D', 'Em', 'Em'], 2, HUAYNO),
    bombo: [[0, 1], [1, 0.6], [1.5, 0.4]], parche: [[0.5, 0.3], [1.75, 0.25]], largo: 32, reverb: 0.25, tren: true,
  }),
  puna: tema(58, 4, {
    quena: melodia('-:2 E5:2 G5:1 E5:1 D5:4 -:2 C5:1 D5:1 E5:2 A4:4 -:4 A5:2 G5:1 E5:1 G5:3 E5:1 D5:2 C5:1 D5:1 A4:4 -:4'),
    arpegio: ['Am', 'Am', 'G', 'G', 'C', 'C', 'Am', 'Am'], largo: 48, reverb: 0.9, suave: true,
  }),
  persecucion: tema(152, 2, {
    quena: melodia('A5:.5 A5:.25 G5:.25 E5:.5 G5:.5 A5:1 -:1 C6:.5 C6:.25 A5:.25 G5:.5 E5:.5 D5:1 -:1'),
    rasgueo: rasgueo(['Am', 'Am', 'G', 'G', 'Am', 'Am', 'E', 'E'], 2, [[0, 0.8, 1], [0.25, 0.4, 0], [0.5, 0.7, 1], [0.75, 0.4, 0]]),
    bombo: [[0, 1], [0.5, 0.6], [1, 0.9], [1.5, 0.6]], largo: 16, reverb: 0.2,
  }),
  tormenta: tema(92, 4, {
    sikus: melodia('A4:2 C5:2 B4:2 G4:2 A4:4 -:4 E5:2 D5:2 C5:2 B4:2 A4:4 -:4'),
    bombo: [[0, 1], [1.5, 0.5], [2, 0.8], [3.5, 0.5]], largo: 32, reverb: 0.6, viento: 1.2,
  }),
  cumbre: tema(80, 4, {
    quena: melodia('E5:1 D5:.5 C5:.5 A4:2 C5:1 D5:.5 E5:.5 G5:1.5 E5:.5 A5:1 G5:.5 E5:.5 D5:1 C5:1 D5:1.5 C5:.5 A4:2 E5:1 G5:.5 A5:.5 C6:2 A5:1 G5:.5 E5:.5 D5:1.5 E5:.5 G5:1 E5:.5 D5:.5 C5:1 A4:1 C5:.5 D5:.5 E5:1 A5:4 -:4'),
    rasgueo: rasgueo(['Am', 'Am', 'C', 'G', 'Am', 'G', 'Am', 'Am', 'C', 'C', 'G', 'G', 'Am', 'G', 'C', 'Am'], 4, LENTO),
    bombo: [[0, 0.9], [2, 0.6], [3.5, 0.3]], largo: 64, reverb: 0.55,
  }),
  epilogo: tema(66, 4, {
    quena: melodia('-:4 E5:1 D5:.5 C5:.5 A4:2 C5:1 D5:.5 E5:.5 G5:2 A5:1 G5:.5 E5:.5 D5:1 C5:1 A4:4 -:4'),
    arpegio: ['Am', 'C', 'G', 'Am', 'Am', 'C', 'G', 'Am'], largo: 32, reverb: 0.6, suave: true,
  }),
};
TEMA.creditos = TEMA.titulo;

/* ============================================================================ */
export const Sonido = {
  ctx: null, vMusica: 0.7, vEfectos: 0.8, actual: null, pendiente: null, ambiente: null,
  iniciar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return;
    const c = this.ctx = new A();
    this.maestro = c.createDynamicsCompressor(); this.maestro.threshold.value = -14; this.maestro.ratio.value = 3;
    this.maestro.connect(c.destination);
    this.bMusica = c.createGain(); this.bMusica.gain.value = this.vMusica * 0.55; this.bMusica.connect(this.maestro);
    this.bEfectos = c.createGain(); this.bEfectos.gain.value = this.vEfectos; this.bEfectos.connect(this.maestro);
    /* la reverb: una sala de piedra hecha con ruido que se apaga */
    const n = c.sampleRate * 2.6, ir = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
    this.rev = c.createConvolver(); this.rev.buffer = ir;
    this.revIn = c.createGain(); this.revIn.gain.value = 0.35; this.revIn.connect(this.rev); this.rev.connect(this.bMusica);
    this.revFx = c.createConvolver(); this.revFx.buffer = ir;
    this.revInFx = c.createGain(); this.revInFx.gain.value = 0.35; this.revInFx.connect(this.revFx); this.revFx.connect(this.bEfectos);
    /* en el iPhone el audio se suspende solo (una llamada, otra app): cualquier toque lo despierta */
    const despertar = () => { if (c.state !== 'running') c.resume(); };
    addEventListener('pointerdown', despertar, true); addEventListener('keydown', despertar, true);
    this.ruido = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.cuerdas = new Map();
    if (this.pendiente) { const p = this.pendiente; this.pendiente = null; this.musica(p); }
    if (this.ambPend) { const a = this.ambPend; this.ambPend = null; this.ambientar(a); }
  },
  volumenes(m, e) {
    this.vMusica = m; this.vEfectos = e;
    if (!this.ctx) return;
    this.bMusica.gain.setTargetAtTime(m * 0.55, this.ctx.currentTime, 0.1);
    this.bEfectos.gain.setTargetAtTime(e, this.ctx.currentTime, 0.1);
  },

  /* ---------------- instrumentos ---------------- */
  cuerda(midi) {
    let b = this.cuerdas.get(midi);
    if (b) return b;
    const c = this.ctx, sr = c.sampleRate, f = midiHz(midi), N = Math.max(2, Math.round(sr / f)), largo = Math.floor(sr * 1.8);
    b = c.createBuffer(1, largo, sr);
    const d = b.getChannelData(0), q = new Float32Array(N);
    for (let i = 0; i < N; i++) q[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(i / N * Math.PI));
    let j = 0, prev = 0;
    const perder = 0.4985 + Math.min(0.0012, f / 900000);
    for (let i = 0; i < largo; i++) {
      const v = q[j], nx = q[(j + 1) % N];
      const o = (v + nx) * perder;
      d[i] = v * 0.7 + (v - prev) * 0.3; prev = v;
      q[j] = o; j = (j + 1) % N;
    }
    this.cuerdas.set(midi, b);
    return b;
  },
  pulsar(t, midi, vel, dest, dur) {
    const c = this.ctx, s = c.createBufferSource(), g = c.createGain();
    s.buffer = this.cuerda(midi);
    g.gain.setValueAtTime(vel * 0.32, t);
    if (dur) g.gain.setTargetAtTime(0.0001, t + dur, 0.12);
    s.connect(g); g.connect(dest || this.bMusica); if (!dest) g.connect(this.revIn);
    s.start(t); s.stop(t + (dur ? dur + 1 : 1.8));
  },
  rasguear(t, acorde, vel, abajo, dest) {
    const notas = (ACORDES[acorde] || ACORDES.Am).map(nm);
    const orden = abajo ? notas : notas.slice().reverse();
    orden.forEach((n, i) => { this.pulsar(t + i * 0.011, n, vel * (0.75 + Math.random() * 0.3), dest); this.pulsar(t + i * 0.011 + 0.004, n + (i === 4 ? -12 : 0), vel * 0.5, dest); });
  },
  soplo(t, midi, dur, vel, tipo) {
    const c = this.ctx, f = midiHz(midi), sikus = tipo === 'sikus';
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
    o.type = 'triangle'; o2.type = 'sine';
    o.frequency.setValueAtTime(f * 0.985, t); o.frequency.linearRampToValueAtTime(f, t + 0.07);
    o2.frequency.setValueAtTime(f * 2, t);
    /* vibrato que llega tarde */
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * (sikus ? 0.004 : 0.011), t + Math.min(dur, 0.5) + 0.2);
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.detune);
    const g2 = c.createGain(); g2.gain.value = sikus ? 0.08 : 0.18;
    o.connect(g); o2.connect(g2); g2.connect(g);
    const A = sikus ? 0.03 : 0.06, v = vel * (sikus ? 0.16 : 0.2);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + A); g.gain.setTargetAtTime(v * 0.82, t + A, 0.2);
    g.gain.setTargetAtTime(0.0001, t + dur * 0.92, 0.06);
    fl.type = 'lowpass'; fl.frequency.value = f * 5; g.connect(fl);
    fl.connect(this.bMusica); fl.connect(this.revIn);
    /* el soplo */
    const r = c.createBufferSource(), rf = c.createBiquadFilter(), rg = c.createGain();
    r.buffer = this.ruido; r.loop = true;
    rf.type = 'bandpass'; rf.frequency.value = f * (sikus ? 1.5 : 2.2); rf.Q.value = sikus ? 2.5 : 6;
    rg.gain.setValueAtTime(0.0001, t); rg.gain.linearRampToValueAtTime(vel * (sikus ? 0.2 : 0.06), t + 0.02); rg.gain.setTargetAtTime(vel * (sikus ? 0.07 : 0.025), t + 0.05, 0.1); rg.gain.setTargetAtTime(0.0001, t + dur * 0.9, 0.05);
    r.connect(rf); rf.connect(rg); rg.connect(this.bMusica); rg.connect(this.revIn);
    const fin = t + dur + 0.6;
    for (const x of [o, o2, lfo]) { x.start(t); x.stop(fin); }
    r.start(t, Math.random()); r.stop(fin);
  },
  bombo(t, vel) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    g.gain.setValueAtTime(vel * 0.75, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g); g.connect(this.bMusica); g.connect(this.revIn);
    o.start(t); o.stop(t + 0.55);
    this.golpe(t, vel * 0.35, 900, 0.05, this.bMusica);
  },
  parche(t, vel) { this.golpe(t, vel * 0.5, 2400, 0.04, this.bMusica, 'highpass'); },
  golpe(t, vel, f, dur, dest, tipo) {
    const c = this.ctx, r = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    r.buffer = this.ruido; fl.type = tipo || 'bandpass'; fl.frequency.value = f; fl.Q.value = 0.8;
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    r.connect(fl); fl.connect(g); g.connect(dest || this.bEfectos);
    r.start(t, Math.random() * 1.5); r.stop(t + dur + 0.02);
  },
  tono(t, f0, f1, dur, vel, tipo, dest) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = tipo || 'sine'; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || this.bEfectos);
    o.start(t); o.stop(t + dur + 0.05);
  },
  soplido(t, f0, f1, dur, vel, q) {
    const c = this.ctx, r = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    r.buffer = this.ruido; r.loop = true; fl.type = 'bandpass'; fl.Q.value = q || 1.2;
    fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    r.connect(fl); fl.connect(g); g.connect(this.bEfectos);
    r.start(t, Math.random()); r.stop(t + dur + 0.05);
  },

  /* ---------------- la música ---------------- */
  musica(nombre) {
    if (!this.ctx) { this.pendiente = nombre; return; }
    if (this.actual && this.actual.nombre === nombre) return;
    const c = this.ctx, ahora = c.currentTime;
    if (this.actual) { const a = this.actual; a.g.gain.setTargetAtTime(0.0001, ahora, 0.6); setTimeout(() => a.g.disconnect(), 4000); a.muerto = true; }
    const T = TEMA[nombre];
    if (!T) { this.actual = null; return; }
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, ahora); g.gain.setTargetAtTime(1, ahora + 0.3, 0.8);
    g.connect(this.bMusica);
    this.revIn.gain.setTargetAtTime(T.reverb || 0.35, ahora, 0.5);
    this.actual = { nombre, T, g, t0: ahora + 0.35, prox: 0, vuelta: 0 };
  },
  pasar() {
    const A = this.actual, c = this.ctx;
    if (!A || !c || A.muerto) return;
    const T = A.T, P = T.pistas, seg = 60 / T.bpm, largo = P.largo, hasta = c.currentTime + 0.25;
    /* con la pestaña escondida no se programa nada: al volver se salta lo perdido en vez de tocarlo todo junto */
    if (A.t0 + A.prox * seg < c.currentTime - 0.1) A.prox = Math.ceil((c.currentTime - A.t0) / seg * 2) / 2;
    /* se programa en tramos de medio tiempo */
    while (A.t0 + A.prox * seg < hasta) {
      const b0 = A.prox, b1 = A.prox + 0.5, base = A.t0 + A.vuelta * largo * seg;
      const enTramo = (b) => b >= (b0 % largo) && b < (b0 % largo) + 0.5;
      const bl = b0 % largo;
      const tiempo = (b) => A.t0 + (A.prox - bl + b) * seg;
      const dest = A.g;
      if (P.quena) for (const [b, n, d] of P.quena) if (enTramo(b)) this.voz(tiempo(b), n, d * seg, 'quena', dest, T.suave ? 0.8 : 1);
      if (P.sikus) for (const [b, n, d] of P.sikus) if (enTramo(b)) this.voz(tiempo(b), n, d * seg, 'sikus', dest, 1);
      if (P.rasgueo) for (const [b, a, v, ab] of P.rasgueo) if (enTramo(b % largo)) this.rasgueoEn(tiempo(b % largo), a, v * 0.8, ab, dest);
      if (P.arpegio) {
        const porAcorde = largo / P.arpegio.length;
        for (let k = 0; k < P.arpegio.length; k++) for (const [dt, v, i] of ARPEGIO) {
          for (let rep = 0; rep < porAcorde / 2; rep++) {
            const b = k * porAcorde + rep * 2 + dt;
            if (enTramo(b)) { const notas = ACORDES[P.arpegio[k]].map(nm); this.pulsarEn(tiempo(b), notas[i % notas.length], v * (T.suave ? 0.7 : 1), dest); }
          }
        }
      }
      if (P.bombo) for (let k = 0; k < largo; k += T.compas) for (const [dt, v] of P.bombo) if (enTramo(k + dt)) this.bomboEn(tiempo(k + dt), v * 0.8, dest);
      if (P.parche) for (let k = 0; k < largo; k += T.compas) for (const [dt, v] of P.parche) if (enTramo(k + dt)) this.parcheEn(tiempo(k + dt), v, dest);
      if (P.tren) for (let k = 0; k < largo; k += 1) for (const dt of [0, 0.25]) if (enTramo(k + dt)) this.golpeEn(tiempo(k + dt), dt ? 0.08 : 0.12, 1800, 0.05, dest);
      A.prox = b1;
      if (A.prox % largo === 0) A.vuelta++;
    }
    /* el ambiente */
    const am = this.ambiente;
    if (am && am.fn) am.fn(c.currentTime);
  },
  voz(t, n, d, tipo, dest, v) { const b = this.bMusica, r = this.revIn; this.bMusica = dest; this.soplo(t, n, d, v, tipo); this.bMusica = b; },
  pulsarEn(t, n, v, dest) { const b = this.bMusica; this.bMusica = dest; this.pulsar(t, n, v); this.bMusica = b; },
  rasgueoEn(t, a, v, ab, dest) { const b = this.bMusica; this.bMusica = dest; this.rasguear(t, a, v, ab); this.bMusica = b; },
  bomboEn(t, v, dest) { const b = this.bMusica; this.bMusica = dest; this.bombo(t, v); this.bMusica = b; },
  parcheEn(t, v, dest) { const b = this.bMusica; this.bMusica = dest; this.parche(t, v); this.bMusica = b; },
  golpeEn(t, v, f, d, dest) { this.golpe(t, v, f, d, dest, 'highpass'); },

  /* ---------------- el ambiente: viento, granizo, fuego ---------------- */
  ambientar(tipo) {
    if (!this.ctx) { this.ambPend = tipo; return; }
    const c = this.ctx;
    if (this.ambiente) { const a = this.ambiente; if (a.tipo === tipo) return; if (a.g) { a.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.5); setTimeout(() => { try { a.fuente.stop(); } catch (_) {} }, 3000); } }
    if (!tipo) { this.ambiente = null; return; }
    const r = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    r.buffer = this.ruido; r.loop = true;
    fl.type = tipo === 'granizo' ? 'highpass' : 'bandpass'; fl.frequency.value = tipo === 'granizo' ? 3000 : 500; fl.Q.value = tipo === 'granizo' ? 0.4 : 0.9;
    g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.setTargetAtTime(tipo === 'granizo' ? 0.05 : tipo === 'noche' ? 0.02 : 0.05, c.currentTime, 1);
    r.connect(fl); fl.connect(g); g.connect(this.bEfectos); r.start();
    const A = this.ambiente = { tipo, fuente: r, g, fl, prox: c.currentTime };
    A.fn = (ahora) => {
      A.prox = Math.max(A.prox, ahora);
      /* el viento sube y baja solo */
      if (tipo !== 'granizo') { fl.frequency.setTargetAtTime(380 + Math.sin(ahora * 0.23) * 180 + Math.sin(ahora * 0.61) * 90, ahora, 0.5); g.gain.setTargetAtTime((tipo === 'noche' ? 0.015 : 0.04) * (1.1 + Math.sin(ahora * 0.31)), ahora, 0.6); }
      if (tipo === 'granizo') while (A.prox < ahora + 0.2) { A.prox += 0.03 + Math.random() * 0.06; this.golpe(A.prox, 0.03 + Math.random() * 0.05, 3500 + Math.random() * 2500, 0.02); }
      if (tipo === 'fuego') while (A.prox < ahora + 0.2) { A.prox += 0.05 + Math.random() * 0.3; this.golpe(A.prox, 0.05 + Math.random() * 0.08, 1500 + Math.random() * 2000, 0.015); }
    };
  },
  intensidadAmbiente(k) { if (this.ambiente && this.ambiente.g && this.ctx) this.ambiente.g.gain.setTargetAtTime(0.05 * k, this.ctx.currentTime, 0.3); },

  /* ---------------- los efectos ---------------- */
  sfx(n, o) {
    const c = this.ctx; if (!c) return;
    o = o || {};
    const t = c.currentTime + 0.005;
    switch (n) {
      case 'salto': this.soplido(t, 900, 2600, 0.12, 0.12, 2); this.tono(t, 520, 780, 0.08, 0.05, 'triangle'); break;
      case 'aleteo': this.soplido(t, 400, 1400, 0.22, 0.2, 1.4); this.soplido(t + 0.12, 380, 1200, 0.2, 0.15, 1.4); this.pio(t + 0.05, o.grande); break;
      case 'pio': this.pio(t, o.grande); break;
      case 'aterriza': this.golpe(t, Math.min(0.5, 0.1 + (o.fuerza || 5) * 0.02), 300, 0.12); this.tono(t, 110, 60, 0.12, Math.min(0.25, (o.fuerza || 5) * 0.012)); break;
      case 'paso': this.golpe(t, 0.05, o.nieve ? 1200 : o.sal ? 2600 : 1800 + Math.random() * 600, 0.035); break;
      case 'apacheta': this.golpe(t, 0.25, 1200, 0.06); this.golpe(t + 0.09, 0.18, 1500, 0.05); this.comoEfecto(() => this.rasguear(t + 0.15, 'C', 0.8, 1)); break;
      case 'copla': this.comoEfecto(() => ['A5', 'C6', 'D6', 'E6', 'G6', 'A6'].forEach((q, i) => this.pulsar(t + i * 0.07, nm(q), 0.7))); this.tono(t + 0.45, 1760, 1760, 1.2, 0.05); break;
      case 'muere': for (let i = 0; i < 7; i++) this.golpe(t + i * 0.035 + Math.random() * 0.02, 0.12, 2000 + Math.random() * 3000, 0.03); this.tono(t + 0.1, 620, 180, 0.55, 0.09, 'triangle'); break;
      case 'revive': this.tono(t, 260, 900, 0.16, 0.1, 'triangle'); this.soplido(t, 1200, 3200, 0.15, 0.1, 2); break;
      case 'puerta': this.tono(t, 140, 190, 0.5, 0.05, 'sawtooth'); this.tono(t + 0.1, 170, 120, 0.4, 0.04, 'sawtooth'); this.golpe(t + 0.45, 0.2, 400, 0.1); break;
      case 'palanca': this.golpe(t, 0.25, 2500, 0.03); this.golpe(t + 0.06, 0.15, 1400, 0.04); break;
      case 'rafaga': this.soplido(t, 300, 900, 1.4, 0.22, 0.8); break;
      case 'rugido': this.tono(t, 120, 70, 0.9, 0.18, 'sawtooth'); this.soplido(t, 300, 150, 0.9, 0.3, 0.6); break;
      case 'trueno': { const d = 0.2 + Math.random() * 0.5; this.soplido(t + d, 180, 50, 2.2, 0.45, 0.5); this.golpe(t + d, 0.35, 120, 0.4); } break;
      case 'rompe': this.golpe(t, 0.3, 4200, 0.08, null, 'highpass'); this.tono(t, 2400, 1800, 0.1, 0.05); this.golpe(t + 0.05, 0.2, 800, 0.2); break;
      case 'cruje': this.golpe(t, 0.12, 3200, 0.04, null, 'highpass'); break;
      case 'empuja': this.golpe(t, 0.07, 500, 0.12); break;
      case 'cajaCae': this.golpe(t, 0.4, 250, 0.2); this.tono(t, 90, 45, 0.25, 0.25); break;
      case 'termica': this.soplido(t, 500, 1800, 0.8, 0.12, 1); break;
      case 'planeo': this.soplido(t, 700, 1100, 0.6, 0.08, 1); break;
      case 'trepa': this.golpe(t, 0.08, 1500, 0.05); this.golpe(t + 0.12, 0.07, 1700, 0.05); break;
      case 'peldano': this.golpe(t, 0.07, 900, 0.04); break;
      case 'cuelga': this.golpe(t, 0.1, 1100, 0.05); break;
      case 'letra': this.tono(t, o.f || 900, (o.f || 900) * 0.96, 0.03, 0.018, 'square'); break;
      case 'mover': this.golpe(t, 0.06, 2600, 0.04); break;
      case 'elegir': this.golpe(t, 0.3, 500, 0.07); this.tono(t, 180, 90, 0.12, 0.2); break;
      case 'no': this.tono(t, 220, 160, 0.15, 0.08, 'triangle'); break;
      case 'hoja': this.soplido(t, 2400, 900, 0.35, 0.12, 0.8); break;
      case 'telon': this.soplido(t, 500, 1600, 1.2, 0.1, 0.5); break;
      case 'kiia': this.kiia(t); break;
      case 'puerta2': break;
    }
  },
  /* un instrumento de la música tocado como efecto: va al volumen de efectos y a su reverb */
  comoEfecto(fn) { const b = this.bMusica, r = this.revIn; this.bMusica = this.bEfectos; this.revIn = this.revInFx; try { fn(); } finally { this.bMusica = b; this.revIn = r; } },
  pio(t, grande) {
    if (grande) return this.kiia(t);
    this.tono(t, 2300, 3100, 0.07, 0.06, 'sine'); this.tono(t + 0.09, 2500, 3300, 0.06, 0.05, 'sine');
  },
  kiia(t) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(1400, t); o.frequency.linearRampToValueAtTime(1900, t + 0.12); o.frequency.exponentialRampToValueAtTime(900, t + 0.6);
    fl.type = 'bandpass'; fl.frequency.value = 2200; fl.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.04); g.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    o.connect(fl); fl.connect(g); g.connect(this.bEfectos); g.connect(this.revInFx);
    o.start(t); o.stop(t + 0.7);
  },
};

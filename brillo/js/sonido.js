/* ============================================================================
   brillo/js/sonido.js — la música y los sonidos, sintetizados (sin archivos).
   Lo que hace sonar "Frutiger Aero" (ver el README): acordes con séptima y
   novena (maj9, m9, 7sus4, 6/9) que se enlazan con pocas notas de diferencia,
   modos dórico y lidio, el balanceo de la bossa nova de los menús de las
   consolas de los 2000, y timbres de vidrio y agua: piano eléctrico FM,
   marimba, vibráfono con trémolo, campanitas, guitarra pulsada, colchones
   suaves, bajo redondo, escobillas en la batería y gotas como percusión.
   Todo con reverb larga y un filtro que le saca un poco de agudos (el tono
   "de parlante viejo" que da la nostalgia).
   Cada mundo tiene su tema, compuesto acá. El del Plano empieza gris (un
   pitido) y va sumando instrumentos a medida que vuelve el color.
   ========================================================================== */
const NOTAS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function nm(s) { const m = /^([A-G])([#b]?)(-?\d)$/.exec(s); if (!m) return 60; return 12 * (+m[3] + 1) + NOTAS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); }
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
/* 'E5:1 D5:.5 -:1' → [[tiempo, nota, duración]] */
function melodia(txt) { let t = 0; const r = []; for (const tok of txt.trim().split(/\s+/)) { const [n, d] = tok.split(':'); const dur = +d; if (n !== '-') r.push([t, nm(n), dur]); t += dur; } return r; }
/* los acordes: tónica + tipo → intervalos */
const TIPOS = { maj7: [0, 4, 7, 11], maj9: [0, 4, 7, 11, 14], 'maj7#11': [0, 4, 7, 11, 18], m7: [0, 3, 7, 10], m9: [0, 3, 7, 10, 14], m11: [0, 3, 7, 10, 14, 17], 7: [0, 4, 7, 10], 9: [0, 4, 7, 10, 14], 13: [0, 4, 10, 14, 21], '7sus4': [0, 5, 7, 10], '9sus4': [0, 5, 7, 10, 14], '6/9': [0, 4, 7, 9, 14], add9: [0, 4, 7, 14], '': [0, 4, 7], m: [0, 3, 7], sus2: [0, 2, 7] };
function acorde(nombre) {
  const m = /^([A-G][#b]?)(.*)$/.exec(nombre);
  const raiz = NOTAS[m[1][0]] + (m[1][1] === '#' ? 1 : m[1][1] === 'b' ? -1 : 0);
  return { raiz, iv: TIPOS[m[2]] || TIPOS[''] };
}
/* voces cerca de un centro (así los acordes se enlazan con poco movimiento) */
function voces(ac, centro = 62, n = 4) {
  const notas = ac.iv.slice(1, n + 1).map((i) => { let x = 48 + ac.raiz + i; while (x < centro - 6) x += 12; while (x > centro + 7) x -= 12; return x; });
  return notas.sort((a, b) => a - b);
}

/* ============================== los temas ============================== */
/* cada tema: bpm, compás, acordes [nombre, tiempos], y pistas */
const BOSSA_BAJO = [[0, 'R', 1.4], [1.5, '5', 0.5], [2, '5', 1.4], [3.5, 'R', 0.5]];
const BOSSA_COMP = [[0, 0.9], [1.5, 0.45], [2.5, 0.9], [3.5, 0.45]];
const TEMA = {
  /* "Iniciar sesión": bossa de sala de espera, en mi mayor */
  titulo: {
    bpm: 132, compas: 4, reverb: 0.45, filtro: 8500,
    acordes: [['Emaj9', 4], ['C#m9', 4], ['Amaj9', 4], ['B7sus4', 4], ['Emaj9', 4], ['G#m7', 4], ['Amaj7', 4], ['B9sus4', 4]],
    pistas: [
      { inst: 'vibra', vol: 0.55, notas: melodia('G#5:1.5 B5:.5 C#6:1 B5:1 G#5:1.5 E5:.5 -:2 C#6:1.5 D#6:.5 E6:1 C#6:1 B5:3 -:1 A5:1.5 G#5:.5 F#5:1 E5:1 G#5:1.5 B5:.5 -:2 F#5:1 G#5:1 A5:1 B5:1 C#6:2 B5:2') },
      { inst: 'ep', patron: 'comp', vol: 0.32, ritmo: BOSSA_COMP, centro: 64 },
      { inst: 'bajo', patron: 'bajo', vol: 0.62, ritmo: BOSSA_BAJO },
      { inst: 'bateria', vol: 0.5, golpes: { bombo: [[0, 0.8], [2.5, 0.5]], escobilla: [[1, 0.45], [3, 0.45]], aro: [[0, 0.3], [1.5, 0.3], [3, 0.3]], shaker: 'corcheas' } },
    ],
  },
  /* la Colina: pop soleado con marimba, en re mayor */
  colina: {
    bpm: 112, compas: 4, reverb: 0.4, filtro: 9500,
    acordes: [['Dmaj9', 4], ['Bm9', 4], ['Gmaj9', 4], ['A7sus4', 4], ['Dmaj9', 4], ['F#m7', 4], ['Gmaj7', 4], ['A9sus4', 2], ['A7sus4', 2]],
    pistas: [
      { inst: 'marimba', vol: 0.6, notas: melodia('F#5:.5 A5:.5 B5:.5 A5:.5 F#5:1 E5:1 D5:.5 E5:.5 F#5:1 -:2 B5:.5 A5:.5 F#5:.5 A5:.5 B5:1 C#6:1 D6:2 -:2 G5:.5 A5:.5 B5:1 A5:.5 G5:.5 F#5:1 E5:1 D5:1 -:1 E5:.5 F#5:.5 G5:1 F#5:.5 E5:.5 C#5:1 D5:2 -:2 F#5:.5 A5:.5 D6:1 C#6:.5 B5:.5 A5:2 F#5:.5 E5:.5 F#5:1 A5:1 C#6:2 -:2 B5:.5 A5:.5 G5:1 F#5:1 E5:1 D5:.5 E5:.5 F#5:2 A5:2 E5:4') },
      { inst: 'guitarra', patron: 'arpegio', vol: 0.3, ritmo: [[0, 0], [0.5, 2], [1, 1], [1.5, 3], [2, 0], [2.5, 2], [3, 1], [3.5, 3]], centro: 62 },
      { inst: 'ep', patron: 'pad', vol: 0.16, centro: 62 },
      { inst: 'bajo', patron: 'bajo', vol: 0.6, ritmo: [[0, 'R', 1.5], [1.5, 'R', 0.5], [2, '5', 1], [3, '8', 0.5], [3.5, '5', 0.5]] },
      { inst: 'bateria', vol: 0.5, golpes: { bombo: [[0, 0.8], [2, 0.6], [2.5, 0.35]], escobilla: [[1, 0.5], [3, 0.5]], hihat: 'corcheas', gota: [[3.75, 0.25]] } },
    ],
  },
  /* el Arrecife: ambiente de agua, en mi dórico */
  arrecife: {
    vol: 1.8, bpm: 84, compas: 4, reverb: 0.7, filtro: 5200,
    acordes: [['Em9', 8], ['A13', 8], ['Em9', 8], ['Cmaj7#11', 8]],
    pistas: [
      { inst: 'vibra', vol: 0.5, notas: melodia('B4:2 D5:1 F#5:1 E5:4 -:2 G5:1 F#5:1 D5:2 B4:2 C#5:4 -:4 B4:2 E5:1 F#5:1 G5:3 A5:1 F#5:4 -:4 G5:2 F#5:1 E5:1 D5:2 B4:2 E5:8') },
      { inst: 'campana', patron: 'arpegio', vol: 0.18, ritmo: [[0, 0], [1.5, 2], [3, 1], [4.5, 3], [6, 2]], centro: 74 },
      { inst: 'pad', patron: 'pad', vol: 0.2, centro: 60 },
      { inst: 'bajo', patron: 'bajo', vol: 0.55, ritmo: [[0, 'R', 3], [4, '5', 3]] },
      { inst: 'bateria', vol: 0.45, golpes: { gota: [[1, 0.4], [2.75, 0.3], [3.5, 0.25]], shaker: [[0.5, 0.2], [1.5, 0.2], [2.5, 0.2], [3.5, 0.2]] } },
    ],
  },
  /* Ciudad Vidrio: tecno-pop de 2000s, en fa# menor */
  ciudad: {
    bpm: 122, compas: 4, reverb: 0.35, filtro: 10000, bombeo: true,
    acordes: [['F#m7', 4], ['C#m7', 4], ['Bm7', 4], ['E6/9', 4]],
    pistas: [
      { inst: 'campana', vol: 0.42, notas: melodia('C#6:.5 E6:.5 F#6:1 E6:.5 C#6:.5 B5:1 -:1 A5:.5 B5:.5 C#6:1 E6:1 C#6:1 -:1 B5:.5 A5:.5 G#5:1 F#5:1 A5:1 B5:.5 C#6:.5 E6:2 -:2') },
      { inst: 'ep', patron: 'comp', vol: 0.26, ritmo: [[0.5, 0.4], [1.5, 0.4], [2.5, 0.4], [3.5, 0.4]], centro: 64 },
      { inst: 'pad', patron: 'pad', vol: 0.2, centro: 62 },
      { inst: 'bajo', patron: 'bajo', vol: 0.62, ritmo: [[0, 'R', 0.4], [0.5, 'R', 0.4], [1, '8', 0.4], [1.5, 'R', 0.4], [2, 'R', 0.4], [2.5, '5', 0.4], [3, '8', 0.4], [3.5, '5', 0.4]] },
      { inst: 'bateria', vol: 0.55, golpes: { bombo: [[0, 0.9], [1, 0.9], [2, 0.9], [3, 0.9]], palma: [[1, 0.4], [3, 0.4]], hihat: [[0.5, 0.5], [1.5, 0.5], [2.5, 0.5], [3.5, 0.5]] } },
    ],
  },
  /* el Cielo: new age liviano, en sol lidio */
  cielo: {
    vol: 1.35, bpm: 100, compas: 4, reverb: 0.6, filtro: 9000,
    acordes: [['Gmaj7#11', 4], ['Am7', 4], ['Gmaj9', 4], ['Dadd9', 4]],
    pistas: [
      { inst: 'flauta', vol: 0.42, notas: melodia('B5:1 C#6:1 D6:2 B5:1 A5:1 G5:2 -:2 A5:1 B5:1 E6:2 D6:2 B5:2 D6:2 -:2 C#6:1 B5:1 A5:1 G5:1 F#5:2 G5:2 A5:4') },
      { inst: 'arpa', patron: 'arpegio', vol: 0.3, ritmo: [[0, 0], [0.5, 1], [1, 2], [1.5, 3], [2, 4], [2.5, 3], [3, 2], [3.5, 1]], centro: 67 },
      { inst: 'pad', patron: 'pad', vol: 0.16, centro: 60 },
      { inst: 'bajo', patron: 'bajo', vol: 0.5, ritmo: [[0, 'R', 2], [2, '5', 2]] },
      { inst: 'bateria', vol: 0.4, golpes: { bombo: [[0, 0.5]], shaker: 'corcheas', gota: [[2.5, 0.25]] } },
    ],
  },
  /* la Aurora: canción de cuna para la noche, en si dórico */
  aurora: {
    vol: 2.0, bpm: 76, compas: 4, reverb: 0.8, filtro: 7000,
    acordes: [['Bm9', 4], ['E9', 4], ['Gmaj7', 4], ['F#m7', 4]],
    pistas: [
      { inst: 'caja', vol: 0.4, notas: melodia('F#5:1 D5:1 E5:1 C#5:1 D5:2 B4:2 G#5:1 E5:1 F#5:1 D5:1 E5:4 D5:1 B4:1 F#5:1 D5:1 G5:2 F#5:2 E5:1 C#5:1 D5:1 A4:1 B4:4') },
      { inst: 'coro', patron: 'pad', vol: 0.2, centro: 60 },
      { inst: 'bajo', patron: 'bajo', vol: 0.45, ritmo: [[0, 'R', 3.5]] },
      { inst: 'bateria', vol: 0.3, golpes: { shaker: [[1, 0.2], [3, 0.2]] } },
    ],
  },
  /* el Plano: gris. Las capas 1 a 4 se prenden a medida que vuelve el color */
  plano: {
    vol: 1.3, bpm: 90, compas: 4, reverb: 0.1, filtro: 6000, capas: true,
    acordes: [['Cmaj7', 4], ['Am9', 4], ['Fmaj9', 4], ['G7sus4', 4]],
    pistas: [
      { inst: 'pitido', vol: 0.18, notas: melodia('C5:1 -:1 C5:1 -:1 C5:1 -:1 C5:1 -:1 C5:1 -:1 C5:1 -:1 C5:1 -:1 C5:1 -:1'), capa: 0 },
      { inst: 'bajo', patron: 'bajo', vol: 0.5, ritmo: [[0, 'R', 1], [2, '5', 1]], capa: 1 },
      { inst: 'ep', patron: 'comp', vol: 0.28, ritmo: BOSSA_COMP, centro: 64, capa: 2 },
      { inst: 'vibra', vol: 0.5, notas: melodia('E5:1.5 G5:.5 B5:1 G5:1 E5:2 -:2 C5:1.5 E5:.5 G5:1 A5:1 G5:4'), capa: 3 },
      { inst: 'bateria', vol: 0.45, golpes: { bombo: [[0, 0.7], [2.5, 0.4]], escobilla: [[1, 0.4], [3, 0.4]], shaker: 'corcheas' }, capa: 4 },
    ],
  },
};
TEMA.final = { ...TEMA.titulo, bpm: 138, reverb: 0.5, pistas: [...TEMA.titulo.pistas, { inst: 'pad', patron: 'pad', vol: 0.18, centro: 62 }, { inst: 'campana', patron: 'arpegio', vol: 0.16, ritmo: [[0, 0], [1, 2], [2, 1], [3, 3]], centro: 76 }] };
TEMA.creditos = TEMA.final;
export const TEMAS = Object.keys(TEMA);
/* el modo 16 bits: las mismas canciones, tocadas con los instrumentos de las
   consolas de 16 bits (pulsos con vibrato, piano FM, bajo triangular), por un
   reductor de bits, un filtro bajo y el eco corto de la época */
const CHIP = { vibra: 'pulso', marimba: 'pulso12', campana: 'pulso12', flauta: 'pulso', caja: 'pulso12', ep: 'fm', guitarra: 'pulso12', arpa: 'pulso12', pad: 'cuerdaChip', coro: 'cuerdaChip', bajo: 'bajoChip' };

/* ============================================================================ */
export const Sonido = {
  ctx: null, vMusica: 0.7, vEfectos: 0.8, actual: null, pendiente: null, capas: 0, modo: 'aero',
  iniciar() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return;
    const c = this.ctx = new A();
    this.maestro = c.createDynamicsCompressor(); this.maestro.threshold.value = -16; this.maestro.ratio.value = 3.5; this.maestro.knee.value = 12;
    this.maestro.connect(c.destination);
    /* la música pasa por el filtro "de parlante viejo" */
    this.filtro = c.createBiquadFilter(); this.filtro.type = 'lowpass'; this.filtro.frequency.value = 9000; this.filtro.Q.value = 0.4;
    this.bMusica = c.createGain(); this.bMusica.gain.value = this.vMusica * 0.5; this.bMusica.connect(this.filtro); this.filtro.connect(this.maestro);
    this.bEfectos = c.createGain(); this.bEfectos.gain.value = this.vEfectos; this.bEfectos.connect(this.maestro);
    /* la reverb: una sala grande y clara, hecha con ruido que se apaga */
    const n = c.sampleRate * 3, ir = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < n; i++) { lp += ((Math.random() * 2 - 1) - lp) * 0.6; d[i] = lp * Math.pow(1 - i / n, 3.2); } }
    this.rev = c.createConvolver(); this.rev.buffer = ir;
    this.revIn = c.createGain(); this.revIn.gain.value = 0.4; this.revIn.connect(this.rev); this.rev.connect(this.bMusica);
    this.revFx = c.createConvolver(); this.revFx.buffer = ir;
    this.revInFx = c.createGain(); this.revInFx.gain.value = 0.3; this.revInFx.connect(this.revFx); this.revFx.connect(this.bEfectos);
    /* un eco que rebota de lado a lado (para las campanitas) */
    const dI = c.createDelay(1), dD = c.createDelay(1), fb = c.createGain(), pI = c.createStereoPanner(), pD = c.createStereoPanner();
    dI.delayTime.value = 0.36; dD.delayTime.value = 0.36; fb.gain.value = 0.32; pI.pan.value = -0.7; pD.pan.value = 0.7;
    this.eco = c.createGain(); this.eco.gain.value = 0.35;
    this.eco.connect(dI); dI.connect(pI); pI.connect(this.bMusica); dI.connect(dD); dD.connect(pD); pD.connect(this.bMusica); dD.connect(fb); fb.connect(dI);
    this.ruido = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.cuerdas = new Map(); this.ondas = new Map();
    /* la cadena del modo 16 bits: reductor de bits → filtro bajo → (eco corto) → música */
    this.chipIn = c.createGain();
    const crush = c.createWaveShaper(), curva = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) { const x = i / 1023.5 - 1; curva[i] = Math.round(x * 28) / 28; }
    crush.curve = curva; crush.oversample = 'none';
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6800; lp.Q.value = 0.5;
    this.chipIn.connect(crush); crush.connect(lp); lp.connect(this.bMusica);
    const eco = c.createDelay(1), efb = c.createGain(), elp = c.createBiquadFilter(), eIn = c.createGain();
    eco.delayTime.value = 0.19; efb.gain.value = 0.42; elp.type = 'lowpass'; elp.frequency.value = 2800; eIn.gain.value = 0.32;
    lp.connect(eIn); eIn.connect(eco); eco.connect(elp); elp.connect(efb); efb.connect(eco); elp.connect(this.bMusica);
    const despertar = () => { if (c.state !== 'running') c.resume(); };
    addEventListener('pointerdown', despertar, true); addEventListener('keydown', despertar, true);
    if (this.pendiente) { const p = this.pendiente; this.pendiente = null; this.musica(p); }
  },
  volumenes(m, e) {
    this.vMusica = m; this.vEfectos = e;
    if (!this.ctx) return;
    this.bMusica.gain.setTargetAtTime(m * 0.5, this.ctx.currentTime, 0.1);
    this.bEfectos.gain.setTargetAtTime(e, this.ctx.currentTime, 0.1);
  },
  /* abajo del agua todo suena más apagado */
  agua(si) { if (this.ctx && this.actual) this.filtro.frequency.setTargetAtTime(si ? 1400 : (this.actual.T.filtro || 9000), this.ctx.currentTime, 0.25); },

  /* ---------------- instrumentos ---------------- */
  env(g, t, a, pico, dec, sus, fin) {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pico, t + a);
    g.gain.setTargetAtTime(sus, t + a, dec); g.gain.setTargetAtTime(0.0001, fin, 0.08);
  },
  salida(dest, rev = 0.5, pan = 0) {
    const c = this.ctx, g = c.createGain(), p = c.createStereoPanner(); p.pan.value = pan;
    g.connect(p); p.connect(dest || this.bMusica);
    if (rev) { const r = c.createGain(); r.gain.value = rev; p.connect(r); r.connect(this.revIn); }
    return g;
  },
  /* piano eléctrico: FM, con el "tin" del ataque y trémolo de lado a lado */
  ep(t, n, d, v, dest) {
    const c = this.ctx, f = hz(n), car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), tin = c.createOscillator(), tg = c.createGain();
    car.frequency.value = f; mod.frequency.value = f; tin.frequency.value = f * 14;
    mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.25, t + 0.9);
    tg.gain.setValueAtTime(f * 0.8, t); tg.gain.exponentialRampToValueAtTime(1, t + 0.06);
    mod.connect(mg); mg.connect(car.frequency); tin.connect(tg); tg.connect(car.frequency);
    const g = this.salida(dest, 0.55, Math.sin(t * 2.7) * 0.4);
    this.env(g, t, 0.006, v * 0.22, 0.9, v * 0.08, t + d);
    car.connect(g);
    for (const o of [car, mod, tin]) { o.start(t); o.stop(t + d + 0.6); }
  },
  marimba(t, n, d, v, dest) {
    const c = this.ctx, f = hz(n), a = c.createOscillator(), b = c.createOscillator(), g = this.salida(dest, 0.45, (n % 7 - 3) * 0.08), gb = c.createGain();
    a.frequency.value = f; b.frequency.value = f * 4; gb.gain.value = 0.28;
    const dur = 0.35 + (84 - n) * 0.012;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.3, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    gb.gain.setValueAtTime(0.3, t); gb.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    a.connect(g); b.connect(gb); gb.connect(g);
    a.start(t); b.start(t); a.stop(t + dur + 0.05); b.stop(t + 0.1);
  },
  vibra(t, n, d, v, dest) {
    const c = this.ctx, f = hz(n), a = c.createOscillator(), b = c.createOscillator(), gb = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(), tr = c.createGain();
    a.frequency.value = f; b.frequency.value = f * 4; gb.gain.value = 0.12;
    lfo.frequency.value = 5.2; lg.gain.value = 0.3; lfo.connect(lg); lg.connect(tr.gain); tr.gain.value = 0.7;
    const g = this.salida(dest, 0.6, 0.15), dur = Math.max(1.4, d + 0.6);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.26, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    a.connect(tr); b.connect(gb); gb.connect(tr); tr.connect(g);
    for (const o of [a, b, lfo]) { o.start(t); o.stop(t + dur + 0.05); }
  },
  /* campanita de vidrio: FM inarmónica, con eco */
  campana(t, n, d, v, dest) {
    const c = this.ctx, f = hz(n), car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain();
    car.frequency.value = f; mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 1.8);
    mod.connect(mg); mg.connect(car.frequency);
    const g = this.salida(dest, 0.6, 0.3), e = this.ctx.createGain(); e.gain.value = 0.6;
    const dur = Math.max(1.6, d * 1.5);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.17, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    car.connect(g); g.connect(e); e.connect(this.eco);
    car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
  },
  /* un colchón: dos sierras apenas desafinadas + un triángulo, filtradas, que entran despacio */
  pad(t, n, d, v, dest) {
    const c = this.ctx, f = hz(n), fl = c.createBiquadFilter(), g = this.salida(dest, 0.7, (n % 5 - 2) * 0.2);
    fl.type = 'lowpass'; fl.frequency.value = 1300; fl.Q.value = 0.3; fl.connect(g);
    const os = [];
    for (const [tipo, df, k] of [['sawtooth', 1.004, 0.4], ['sawtooth', 0.996, 0.4], ['triangle', 2, 0.35]]) { const o = c.createOscillator(), og = c.createGain(); o.type = tipo; o.frequency.value = f * df; og.gain.value = k; o.connect(og); og.connect(fl); os.push(o); }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.08, t + 0.7); g.gain.setValueAtTime(v * 0.08, t + d); g.gain.linearRampToValueAtTime(0.0001, t + d + 1.2);
    for (const o of os) { o.start(t); o.stop(t + d + 1.3); }
  },
  coro(t, n, d, v, dest) {
    const c = this.ctx, f = hz(n), g = this.salida(dest, 0.8, (n % 3 - 1) * 0.3), suma = c.createGain(); suma.gain.value = 0.5;
    for (const [fr, q, k] of [[800, 6, 1], [1150, 8, 0.6], [2900, 10, 0.25]]) { const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = fr; b.Q.value = q; const bg = c.createGain(); bg.gain.value = k; suma.connect(b); b.connect(bg); bg.connect(g); }
    const os = [];
    for (const df of [1, 1.006, 0.994]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * df; const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 5 + df; vg.gain.value = f * 0.004; vib.connect(vg); vg.connect(o.frequency); o.connect(suma); os.push(o, vib); }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.22, t + 0.9); g.gain.setValueAtTime(v * 0.22, t + d); g.gain.linearRampToValueAtTime(0.0001, t + d + 1.4);
    for (const o of os) { o.start(t); o.stop(t + d + 1.5); }
  },
  caja(t, n, d, v, dest) {
    const c = this.ctx, f = hz(n), g = this.salida(dest, 0.7, 0.1);
    for (const [k, amp, dec] of [[1, 0.25, 1.2], [3, 0.08, 0.4], [5.4, 0.04, 0.2]]) { const o = c.createOscillator(), og = c.createGain(); o.frequency.value = f * k; og.gain.setValueAtTime(amp * v, t); og.gain.exponentialRampToValueAtTime(0.0005, t + dec); o.connect(og); og.connect(g); o.start(t); o.stop(t + dec + 0.05); }
    g.gain.value = 1;
    const e = c.createGain(); e.gain.value = 0.5; g.connect(e); e.connect(this.eco);
  },
  flauta(t, n, d, v, dest) {
    const c = this.ctx, f = hz(n), o = c.createOscillator(), vib = c.createOscillator(), vg = c.createGain(), g = this.salida(dest, 0.6, -0.1);
    o.type = 'sine'; o.frequency.value = f; vib.frequency.value = 5.4; vg.gain.value = f * 0.006; vib.connect(vg); vg.connect(o.frequency);
    const r = c.createBufferSource(), rf = c.createBiquadFilter(), rg = c.createGain(); r.buffer = this.ruido; rf.type = 'bandpass'; rf.frequency.value = f * 2; rf.Q.value = 2; rg.gain.value = 0.06 * v;
    r.connect(rf); rf.connect(rg); rg.connect(g);
    this.env(g, t, 0.07, v * 0.2, 0.3, v * 0.15, t + d);
    o.connect(g);
    for (const x of [o, vib, r]) { x.start(t); x.stop(t + d + 0.5); }
  },
  pitido(t, n, d, v, dest) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.value = hz(n);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.05, t + 0.005); g.gain.setValueAtTime(v * 0.05, t + Math.min(d, 0.12)); g.gain.linearRampToValueAtTime(0.0001, t + Math.min(d, 0.12) + 0.01);
    o.connect(g); g.connect(dest || this.bMusica); o.start(t); o.stop(t + 0.2);
  },
  /* guitarra y arpa: cuerda pulsada (Karplus-Strong), hecha una vez por nota */
  cuerda(n, brillo) {
    const k = n + ':' + brillo;
    let b = this.cuerdas.get(k);
    if (b) return b;
    const c = this.ctx, sr = c.sampleRate, N = Math.max(2, Math.round(sr / hz(n))), largo = Math.floor(sr * 2);
    b = c.createBuffer(1, largo, sr);
    const d = b.getChannelData(0), buf = new Float32Array(N);
    for (let i = 0; i < N; i++) buf[i] = Math.random() * 2 - 1;
    let j = 0; const a = brillo ? 0.4996 : 0.498;
    for (let i = 0; i < largo; i++) { const x = buf[j], y = buf[(j + 1) % N]; d[i] = x; buf[j] = (x + y) * a; j = (j + 1) % N; }
    this.cuerdas.set(k, b);
    return b;
  },
  guitarra(t, n, d, v, dest) { const s = this.ctx.createBufferSource(); s.buffer = this.cuerda(n, false); const g = this.salida(dest, 0.4, -0.25); g.gain.value = v * 0.3; s.connect(g); s.start(t); s.stop(t + 2); },
  arpa(t, n, d, v, dest) { const s = this.ctx.createBufferSource(); s.buffer = this.cuerda(n + 12, true); const g = this.salida(dest, 0.6, 0.25); g.gain.value = v * 0.28; s.connect(g); s.start(t); s.stop(t + 2); },
  bajo(t, n, d, v, dest) {
    const c = this.ctx, f = hz(n), o = c.createOscillator(), o2 = c.createOscillator(), fl = c.createBiquadFilter(), g = this.salida(dest, 0.12, 0);
    o.type = 'sine'; o.frequency.value = f; o2.type = 'triangle'; o2.frequency.value = f * 2; const g2 = c.createGain(); g2.gain.value = 0.25;
    fl.type = 'lowpass'; fl.frequency.value = 900;
    o.connect(fl); o2.connect(g2); g2.connect(fl); fl.connect(g);
    this.env(g, t, 0.012, v * 0.34, 0.35, v * 0.2, t + d);
    o.start(t); o2.start(t); o.stop(t + d + 0.4); o2.stop(t + d + 0.4);
  },
  /* ---------------- los instrumentos de 16 bits ---------------- */
  /* una onda de pulso (duty = cuánto de la vuelta está arriba), en serie de Fourier */
  onda(duty) {
    let w = this.ondas.get(duty);
    if (w) return w;
    const N = 48, re = new Float32Array(N), im = new Float32Array(N);
    for (let k = 1; k < N; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    w = this.ctx.createPeriodicWave(re, im);
    this.ondas.set(duty, w);
    return w;
  },
  pulso(t, n, d, v, dest, duty = 0.25) {
    const c = this.ctx, f = hz(n), o = c.createOscillator(), vib = c.createOscillator(), vg = c.createGain();
    o.setPeriodicWave(this.onda(duty)); o.frequency.value = f;
    vib.frequency.value = 5.6; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.007, t + 0.35); vib.connect(vg); vg.connect(o.frequency);
    const g = this.salida(dest, 0.25, ((n % 5) - 2) * 0.12), dur = Math.max(0.1, d);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.11, t + 0.004); g.gain.setTargetAtTime(v * 0.07, t + 0.02, 0.15); g.gain.setTargetAtTime(0.0001, t + dur, 0.05);
    o.connect(g);
    for (const x of [o, vib]) { x.start(t); x.stop(t + dur + 0.4); }
  },
  /* pulso finito y cortito: lo que en 16 bits hacía de arpa, guitarra y campanita */
  pulso12(t, n, d, v, dest) {
    const c = this.ctx, f = hz(n), o = c.createOscillator(), g = this.salida(dest, 0.3, ((n % 7) - 3) * 0.1);
    o.setPeriodicWave(this.onda(0.125)); o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.1, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.45);
    o.connect(g); o.start(t); o.stop(t + 0.5);
  },
  /* piano FM de dos operadores (el de las consolas de 16 bits) */
  fm(t, n, d, v, dest) {
    const c = this.ctx, f = hz(n), car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain();
    car.frequency.value = f; mod.frequency.value = f * 2;
    mg.gain.setValueAtTime(f * 3, t); mg.gain.exponentialRampToValueAtTime(f * 0.3, t + 0.35);
    mod.connect(mg); mg.connect(car.frequency);
    const g = this.salida(dest, 0.25, Math.sin(t * 2.7) * 0.3);
    this.env(g, t, 0.003, v * 0.2, 0.25, v * 0.07, t + d);
    car.connect(g);
    for (const o of [car, mod]) { o.start(t); o.stop(t + d + 0.4); }
  },
  /* colchón de dos pulsos cuadrados apenas desafinados */
  cuerdaChip(t, n, d, v, dest) {
    const c = this.ctx, f = hz(n), fl = c.createBiquadFilter(), g = this.salida(dest, 0.3, ((n % 5) - 2) * 0.2);
    fl.type = 'lowpass'; fl.frequency.value = 1700; fl.connect(g);
    const os = [];
    for (const df of [1.003, 0.997]) { const o = c.createOscillator(); o.setPeriodicWave(this.onda(0.5)); o.frequency.value = f * df; o.connect(fl); os.push(o); }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.05, t + 0.25); g.gain.setValueAtTime(v * 0.05, t + d); g.gain.linearRampToValueAtTime(0.0001, t + d + 0.5);
    for (const o of os) { o.start(t); o.stop(t + d + 0.6); }
  },
  bajoChip(t, n, d, v, dest) {
    const c = this.ctx, f = hz(n), o = c.createOscillator(), o2 = c.createOscillator(), g2 = c.createGain(), fl = c.createBiquadFilter(), g = this.salida(dest, 0.05, 0);
    o.type = 'triangle'; o.frequency.value = f; o2.setPeriodicWave(this.onda(0.5)); o2.frequency.value = f; g2.gain.value = 0.18;
    fl.type = 'lowpass'; fl.frequency.value = 1400;
    o.connect(fl); o2.connect(g2); g2.connect(fl); fl.connect(g);
    this.env(g, t, 0.004, v * 0.42, 0.18, v * 0.26, t + d);
    for (const x of [o, o2]) { x.start(t); x.stop(t + d + 0.3); }
  },
  /* ---------------- la batería ---------------- */
  ruidoEn(t, dur, tipo, f, q, v, dest, rev = 0.25) {
    const c = this.ctx, r = c.createBufferSource(), fl = c.createBiquadFilter(), g = this.salida(dest, rev, 0);
    r.buffer = this.ruido; fl.type = tipo; fl.frequency.value = f; fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    r.connect(fl); fl.connect(g); r.start(t, Math.random()); r.stop(t + dur + 0.02);
  },
  golpe(nombre, t, v, dest) {
    const c = this.ctx;
    switch (nombre) {
      case 'bombo': { const o = c.createOscillator(), g = this.salida(dest, 0.05, 0); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.14); g.gain.setValueAtTime(v * 0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g); o.start(t); o.stop(t + 0.32); break; }
      case 'escobilla': this.ruidoEn(t, 0.22, 'bandpass', 2600, 0.7, v * 0.2, dest, 0.3); this.ruidoEn(t, 0.05, 'highpass', 4000, 0.5, v * 0.12, dest); break;
      case 'palma': for (let i = 0; i < 3; i++) this.ruidoEn(t + i * 0.011, 0.09, 'bandpass', 1400, 1.2, v * 0.25, dest, 0.35); break;
      case 'aro': this.ruidoEn(t, 0.03, 'bandpass', 1900, 5, v * 0.5, dest, 0.2); break;
      case 'hihat': this.ruidoEn(t, 0.04, 'highpass', 7500, 0.6, v * 0.14, dest, 0.1); break;
      case 'shaker': this.ruidoEn(t, 0.07, 'bandpass', 6200, 1.2, v * 0.1, dest, 0.15); break;
      case 'gota': { const o = c.createOscillator(), g = this.salida(dest, 0.5, (Math.random() - 0.5) * 0.8); const f = 700 + Math.random() * 500; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.06); g.gain.setValueAtTime(v * 0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09); o.connect(g); o.start(t); o.stop(t + 0.1); break; }
    }
  },

  /* ---------------- la música ---------------- */
  musica(nombre) {
    if (!this.ctx) { this.pendiente = nombre; return; }
    if (this.actual && this.actual.nombre === nombre) return;
    const c = this.ctx, ahora = c.currentTime;
    if (this.actual) { const g = this.actual.g; g.gain.setTargetAtTime(0.0001, ahora, 0.6); this.actual.muerto = true; setTimeout(() => g.disconnect(), 4000); }
    const T = TEMA[nombre];
    if (!T) { this.actual = null; return; }
    const chip = this.modo === 'chip';
    const g = c.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime((T.vol || 1) * (chip ? 1.15 : 1), ahora + 0.2, 0.5); g.connect(chip ? this.chipIn : this.bMusica);
    this.revIn.gain.setTargetAtTime((T.reverb ?? 0.4) * (chip ? 0.3 : 1), ahora, 0.5);
    this.filtro.frequency.setTargetAtTime(T.filtro || 9000, ahora, 0.5);
    const largo = T.acordes.reduce((s, a) => s + a[1], 0);
    this.actual = { nombre, T, g, t0: ahora + 0.4, prox: 0, largo };
  },
  /* cambiar entre 'aero' y 'chip' (16 bits): la canción que suena vuelve a empezar con el otro sonido */
  ponerModo(m) {
    if (this.modo === m) return;
    this.modo = m;
    const A = this.actual;
    if (!A || !this.ctx) return;
    A.g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.2); A.muerto = true; setTimeout(() => A.g.disconnect(), 3000);
    this.actual = null;
    this.musica(A.nombre);
  },
  /* el Plano: cuántas capas suenan (0 a 4) */
  ponerCapas(k) { this.capas = k; },
  acordeEn(T, b) { let s = 0; for (const [nombre, dur] of T.acordes) { if (b < s + dur) return { ...acorde(nombre), desde: s, dur }; s += dur; } return { ...acorde(T.acordes[0][0]), desde: 0, dur: T.acordes[0][1] }; },
  pasar() {
    const A = this.actual, c = this.ctx;
    if (!A || !c || A.muerto) return;
    const T = A.T, seg = 60 / T.bpm, hasta = c.currentTime + 0.25;
    /* con la pestaña escondida no se programa nada: al volver se salta lo perdido */
    if (A.t0 + A.prox * seg < c.currentTime - 0.1) A.prox = Math.ceil((c.currentTime - A.t0) / seg * 2) / 2;
    while (A.t0 + A.prox * seg < hasta) {
      const b0 = A.prox % A.largo, tiempo = (b) => A.t0 + (A.prox - b0 + b) * seg;
      const enTramo = (b) => b >= b0 - 1e-6 && b < b0 + 0.5 - 1e-6;
      const ac = this.acordeEn(T, b0);
      for (const P of T.pistas) {
        if (T.capas && P.capa != null && P.capa > this.capas) continue;
        const dest = A.g, v = P.vol ?? 0.5, inst = this.modo === 'chip' ? CHIP[P.inst] || P.inst : P.inst;
        const tocar = (t, n, d, vv) => this[inst] && this[inst](t, n, d, vv, dest);
        if (P.notas) {
          const L = P.notas.length ? P.notas[P.notas.length - 1][0] + P.notas[P.notas.length - 1][2] : 1, rep = Math.ceil(A.largo / L);
          for (let k = 0; k < rep; k++) for (const [b, n, d] of P.notas) if (enTramo(b + k * L) && b + k * L < A.largo) tocar(tiempo(b + k * L), n, d * seg, v);
        } else if (P.patron === 'pad') {
          if (enTramo(ac.desde)) for (const n of voces(ac, P.centro || 60, 4)) tocar(tiempo(ac.desde), n, ac.dur * seg, v);
        } else if (P.patron === 'comp' || P.patron === 'arpegio') {
          const inicioCompas = Math.floor(b0 / T.compas) * T.compas;
          for (const [dt, x] of P.ritmo) {
            const b = inicioCompas + dt; if (!enTramo(b)) continue;
            const acb = this.acordeEn(T, b), vs = voces(acb, P.centro || 62, 4);
            if (P.patron === 'comp') for (const n of vs) tocar(tiempo(b), n, x * seg, v);
            else { const n = vs[x % vs.length] + 12 * Math.floor(x / vs.length); tocar(tiempo(b), n, seg, v); }
          }
        } else if (P.patron === 'bajo') {
          const inicioCompas = Math.floor(b0 / T.compas) * T.compas;
          for (const [dt, grado, d] of P.ritmo) {
            const b = inicioCompas + dt; if (!enTramo(b)) continue;
            const acb = this.acordeEn(T, b), raiz = 36 + acb.raiz;
            const n = grado === '5' ? raiz + 7 : grado === '8' ? raiz + 12 : grado === '3' ? raiz + acb.iv[1] : raiz;
            tocar(tiempo(b), n, d * seg, v);
          }
        } else if (P.golpes) {
          const inicioCompas = Math.floor(b0 / T.compas) * T.compas;
          for (const [g, lista] of Object.entries(P.golpes)) {
            const L = lista === 'corcheas' ? Array.from({ length: T.compas * 2 }, (_, i) => [i / 2, i % 2 ? 0.25 : 0.4]) : lista;
            for (const [dt, vv] of L) { const b = inicioCompas + dt; if (enTramo(b)) this.golpe(g, tiempo(b), vv * v, dest); }
          }
        }
      }
      /* Ciudad: el colchón "respira" con el bombo */
      if (T.bombeo && Math.abs(b0 % 1) < 1e-6) { const t = tiempo(b0), v = T.vol || 1; A.g.gain.setTargetAtTime(0.6 * v, t, 0.01); A.g.gain.setTargetAtTime(v, t + 0.05, 0.12); }
      A.prox += 0.5;
    }
  },

  /* ---------------- los efectos ---------------- */
  tono(t, f0, f1, dur, v, tipo = 'sine', dest) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(dest || this.bEfectos); const r = c.createGain(); r.gain.value = 0.3; g.connect(r); r.connect(this.revInFx);
    o.start(t); o.stop(t + dur + 0.02);
  },
  soplido(t, f0, f1, dur, v, q = 1) {
    const c = this.ctx, r = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    r.buffer = this.ruido; fl.type = 'bandpass'; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    r.connect(fl); fl.connect(g); g.connect(this.bEfectos); r.start(t, Math.random()); r.stop(t + dur + 0.02);
  },
  /* un instrumento de la música tocado como efecto (va al volumen de efectos) */
  comoEfecto(fn) { const b = this.bMusica, r = this.revIn; this.bMusica = this.bEfectos; this.revIn = this.revInFx; try { fn(); } finally { this.bMusica = b; this.revIn = r; } },
  sfx(n, o = {}) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + 0.005;
    switch (n) {
      case 'salto': this.tono(t, 520, 880, 0.12, 0.07, 'sine'); this.tono(t, 1040, 1760, 0.08, 0.025, 'triangle'); break;
      case 'aterriza': this.soplido(t, 900, 300, 0.1, 0.06, 1); break;
      case 'burbuja': this.tono(t, 300, 1200, 0.18, 0.08, 'sine'); this.tono(t + 0.08, 900, 1600, 0.1, 0.04, 'sine'); break;
      case 'pop': this.tono(t, 1400, 500, 0.06, 0.1, 'sine'); this.soplido(t, 3000, 1500, 0.05, 0.05, 2); break;
      case 'gota': { const k = o.k || 0; this.comoEfecto(() => this.campana(t, 84 + [0, 2, 4, 7, 9, 12][k % 6], 0.3, 0.7)); break; }
      case 'guino': this.comoEfecto(() => { [76, 80, 83, 88].forEach((n2, i) => this.vibra(t + i * 0.08, n2, 0.6, 0.9)); }); break;
      /* "iniciaste sesión": dos notas que suben, como las de los programas de chat (propias) */
      case 'sesion': this.comoEfecto(() => { this.marimba(t, 79, 0.3, 1); this.marimba(t + 0.12, 86, 0.4, 1); this.campana(t + 0.12, 91, 0.6, 0.5); }); break;
      case 'zumbido': for (let i = 0; i < 8; i++) this.tono(t + i * 0.03, 160 + (i % 2) * 40, 130, 0.05, 0.12, 'sawtooth'); this.soplido(t, 200, 80, 0.3, 0.15, 0.6); break;
      case 'rompe': this.tono(t, 1800, 2600, 0.08, 0.05, 'triangle'); for (let i = 0; i < 4; i++) this.tono(t + 0.04 + i * 0.05, 1200 + i * 300, 1800 + i * 400, 0.1, 0.04, 'sine'); break;
      case 'restaura': this.comoEfecto(() => [72, 76, 79, 84].forEach((n2, i) => this.marimba(t + i * 0.05, n2, 0.2, 0.8))); break;
      case 'muere': this.tono(t, 700, 180, 0.6, 0.09, 'square'); this.tono(t + 0.1, 520, 140, 0.5, 0.06, 'square'); break;
      case 'revive': this.comoEfecto(() => [67, 71, 74, 79].forEach((n2, i) => this.campana(t + i * 0.06, n2, 0.4, 0.5))); break;
      case 'hongo': this.tono(t, 180, 720, 0.25, 0.12, 'sine'); this.tono(t, 360, 1440, 0.2, 0.04, 'triangle'); break;
      case 'agua': this.soplido(t, 1800, 400, 0.25, 0.12, 0.8); this.tono(t + 0.05, 600, 1400, 0.08, 0.04); break;
      case 'brazada': this.soplido(t, 900, 500, 0.2, 0.05, 1.2); break;
      case 'entra': this.tono(t, 400, 900, 0.3, 0.07, 'sine'); break;
      case 'orbe': this.comoEfecto(() => { [64, 68, 71, 76, 80, 83, 88].forEach((n2, i) => this.vibra(t + i * 0.07, n2, 1, 0.8)); }); break;
      case 'mover': this.tono(t, 1900, 2100, 0.03, 0.014, 'sine'); break;
      case 'elegir': this.comoEfecto(() => { this.marimba(t, 76, 0.2, 0.9); this.marimba(t + 0.06, 83, 0.3, 0.8); }); break;
      case 'no': this.tono(t, 300, 200, 0.15, 0.06, 'triangle'); break;
      case 'letra': this.tono(t, o.f || 1400, (o.f || 1400) * 0.97, 0.025, 0.015, 'sine'); break;
      case 'ola': this.soplido(t, 400, 2400, 0.7, 0.08, 0.7); for (let i = 0; i < 6; i++) this.tono(t + 0.1 + i * 0.07, 500 + i * 180, 1200 + i * 200, 0.06, 0.03); break;
      case 'aviso': this.comoEfecto(() => { this.marimba(t, 84, 0.2, 0.7); this.marimba(t + 0.09, 88, 0.3, 0.7); }); break;
      case 'plano': this.tono(t, 440, 440, 0.4, 0.05, 'square'); break;
    }
  },
};

// El sonido, sintetizado con WebAudio (nada de archivos). La música es de
// película de plastilina: bajo en pizzicato, marimba, un clarinete que canta
// la melodía y escobillas; una canción por set (el taller alegre, la cocina
// en bossa, el jardín de noche con celesta de canción de cuna) y la del menú.
// Progresiones fijas con melodías escritas nota por nota: una al azar suena
// a nada (lección de `ritmo/`).
// Los efectos: el "bluip" del salto, el "plaf" al caer, el ¡splat! de la
// muerte, el obturador de la cámara, la claqueta, la mano que entra (un
// "fuush"), bloques, pinches, resortes, la puerta que rechina y sus patitas.
// El audio se crea al abrir: si el navegador deja sonar, nace andando; si
// no, arranca con el primer toque (main.js › despertar).
import { T as TI } from './intro.js';

const NOTA = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11, Bb: 10, Eb: 3 };
const midi = (n) => { const m = /^([A-G][#b]?)(\d)$/.exec(n); return 12 * (+m[2] + 1) + NOTA[m[1]]; };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const f = (n) => hz(midi(n));
const TIPOS = { M: [0, 4, 7, 12], m: [0, 3, 7, 12], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], '7': [0, 4, 7, 10], '6': [0, 4, 7, 9] };

// cada canción: acordes (uno por compás), patrones de 16 pasos y la melodía
// ("nota:largo" en semicorcheas, "_" es silencio; cuatro compases)
const CANCIONES = {
  menu: {
    bpm: 100, swing: 0.3, lead: 'clarinete', acordes: [['C3', '6'], ['A2', 'm7'], ['D3', 'm7'], ['G2', '7']],
    bajo: 'R...5...R...5.O.', marimba: '0.1.2.3.2.1.0...', bombo: 'x.......x.......', escobilla: '....x.......x...', taco: '..x.......x...x.',
    melodia: 'E5:2 G5:2 A5:4 G5:2 E5:2 C5:4 _:2 A4:2 C5:2 E5:2 G5:6 _:2 F5:2 E5:2 D5:4 A4:2 C5:2 D5:4 B4:2 D5:2 G5:4 F5:4 _:4',
  },
  taller: {
    bpm: 112, swing: 0.25, lead: 'clarinete', acordes: [['F2', 'M'], ['D2', 'm'], ['A#2', 'M'], ['C3', '7']],
    bajo: 'R..R..5.R..5..O.', marimba: '0.2.1.3.0.2.1.3.', bombo: 'x.....x...x.....', escobilla: '....x.......x...', taco: 'x.x...x.x.x...x.',
    melodia: 'C5:2 F5:2 A5:2 F5:2 G5:4 A5:4 F5:2 D5:2 A4:4 D5:2 F5:2 E5:4 D5:2 F5:2 A#5:4 A5:2 G5:2 F5:4 E5:2 G5:2 C6:4 A#5:2 G5:2 E5:4',
  },
  cocina: {
    bpm: 120, swing: 0, lead: 'clarinete', acordes: [['G2', 'M7'], ['E2', 'm7'], ['A2', 'm7'], ['D3', '7']],
    bajo: 'R..5..R.R..5..R.', marimba: '0..1..2.3..2..1.', bombo: 'x..x....x..x....', escobilla: '..x...x...x...x.', taco: 'x..x..x...x..x..',
    melodia: 'B4:3 D5:3 F#5:2 E5:4 D5:4 _:2 G5:3 E5:3 B4:4 D5:4 C5:3 E5:3 G5:2 A5:4 G5:4 F#5:3 E5:3 D5:2 A4:4 _:4',
  },
  noche: {
    bpm: 88, swing: 0, lead: 'celesta', acordes: [['E2', 'm'], ['C2', 'M'], ['G2', 'M'], ['D2', 'M']],
    bajo: 'R.......5.......', marimba: '0...1...2...1...', bombo: 'x...............', escobilla: '........x.......', taco: '................',
    melodia: 'B4:4 E5:4 G5:4 F#5:4 E5:4 C5:4 E5:4 G5:4 D5:4 B4:4 G4:4 B4:4 A4:4 D5:4 F#5:8',
  },
  final: {
    bpm: 104, swing: 0.2, lead: 'clarinete', acordes: [['C3', 'M'], ['F2', 'M'], ['G2', '7'], ['C3', 'M']],
    bajo: 'R...5...R.5.O...', marimba: '0.1.2.3.3.2.1.0.', bombo: 'x.......x.......', escobilla: '....x.......x...', taco: '..x...x...x...x.',
    melodia: 'G4:2 C5:2 E5:2 G5:6 E5:2 G5:2 A5:4 F5:4 C5:4 _:4 B4:2 D5:2 F5:2 G5:6 B4:2 D5:2 C5:8 _:8',
  },
};
// la melodía escrita → [paso, nota midi, largo]
for (const c of Object.values(CANCIONES)) {
  const notas = []; let paso = 0;
  for (const tok of c.melodia.split(' ')) { const [n, l] = tok.split(':'); if (n !== '_') notas.push([paso, midi(n), +l]); paso += +l; }
  c.notas = notas; c.largo = paso;
}

export function crearSonido(ajustes) {
  let ctx = null, maestro, busSfx, busMus, ruido;
  const s = { ajustes, errores: [] };
  let tema = null, proximo = 0, pasoN = 0, reloj = null;

  function iniciar() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    maestro = ctx.createGain(); maestro.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    maestro.connect(comp); comp.connect(ctx.destination);
    busSfx = ctx.createGain(); busSfx.connect(maestro);
    busMus = ctx.createGain(); busMus.connect(maestro);
    // un poco de sala en la música (un eco corto): suena a estudio chico
    const eco = ctx.createDelay(1), vuelta = ctx.createGain(), sal = ctx.createGain();
    eco.delayTime.value = 0.23; vuelta.gain.value = 0.2; sal.gain.value = 0.16;
    busMus.connect(eco); eco.connect(vuelta); vuelta.connect(eco); eco.connect(sal); sal.connect(maestro);
    const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    ruido = b;
    s.aplicar();
    return true;
  }

  function tono({ onda = 'sine', f0, f1 = f0, dur = 0.1, vol = 0.1, t = ctx.currentTime, ataque = 0.005, destino = busSfx, vibrato = 0 }) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = onda;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    let lfo = null;
    if (vibrato) { lfo = ctx.createOscillator(); const lg = ctx.createGain(); lfo.frequency.value = 5.5; lg.gain.value = f0 * vibrato; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.05); }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(destino);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function soplo({ dur = 0.1, vol = 0.1, tipo = 'bandpass', f0 = 1000, f1 = f0, q = 1, t = ctx.currentTime, destino = busSfx }) {
    const n = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = ruido; n.loop = true;
    fl.type = tipo; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(fl); fl.connect(g); g.connect(destino);
    n.start(t, Math.random() * 0.5); n.stop(t + dur + 0.02);
  }
  // la marimba: el seno que se apaga rápido y el golpe de madera (4 veces más agudo)
  function marimba(fr, t, vol, destino = busMus, dur = 0.5) {
    tono({ onda: 'sine', f0: fr, dur, vol, t, destino, ataque: 0.003 });
    tono({ onda: 'sine', f0: fr * 4, dur: 0.05, vol: vol * 0.35, t, destino });
    tono({ onda: 'triangle', f0: fr * 2, dur: dur * 0.3, vol: vol * 0.2, t, destino });
  }
  // el clarinete: cuadrada pasada por un filtro, con vibrato
  function clarinete(fr, t, dur, vol, destino = busMus) {
    const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(fr, t);
    lfo.frequency.value = 5.2; lg.gain.value = fr * 0.006; lfo.connect(lg); lg.connect(o.frequency);
    fl.type = 'lowpass'; fl.frequency.value = Math.min(2600, fr * 3.2); fl.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
    g.gain.setValueAtTime(vol, t + Math.max(0.05, dur - 0.08)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    o.connect(fl); fl.connect(g); g.connect(destino);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.08); lfo.stop(t + dur + 0.08);
  }
  // la celesta: campanita (el seno y sus parciales de metal)
  function celesta(fr, t, dur, vol, destino = busMus) {
    tono({ onda: 'sine', f0: fr, dur: Math.max(0.6, dur), vol, t, destino, ataque: 0.004 });
    tono({ onda: 'sine', f0: fr * 3, dur: 0.3, vol: vol * 0.25, t, destino });
    tono({ onda: 'sine', f0: fr * 4.2, dur: 0.15, vol: vol * 0.12, t, destino });
  }
  // el ruido de la plastilina: un "squish" corto (ruido filtrado que baja)
  function squish(t, vol = 1, alto = 1, destino = busSfx) {
    soplo({ dur: 0.07, vol: 0.12 * vol, tipo: 'bandpass', f0: 1400 * alto, f1: 500 * alto, q: 2.5, t, destino });
    tono({ onda: 'sine', f0: 260 * alto, f1: 150 * alto, dur: 0.06, vol: 0.06 * vol, t, destino });
  }
  // el obturador: dos clics secos (se abre y se cierra)
  function obturador(t, vol = 1, destino = busSfx) {
    soplo({ dur: 0.025, vol: 0.35 * vol, tipo: 'highpass', f0: 3000, t, destino });
    tono({ onda: 'square', f0: 1900, f1: 900, dur: 0.02, vol: 0.05 * vol, t, destino });
    soplo({ dur: 0.03, vol: 0.28 * vol, tipo: 'highpass', f0: 2500, t: t + 0.055, destino });
    tono({ onda: 'square', f0: 1500, f1: 700, dur: 0.02, vol: 0.04 * vol, t: t + 0.055, destino });
  }

  const SFX = {
    boton: () => { squish(ctx.currentTime, 0.7, 1.3); tono({ onda: 'sine', f0: 520, f1: 780, dur: 0.07, vol: 0.06 }); },
    salto: () => { const t = ctx.currentTime; tono({ onda: 'sine', f0: 280, f1: 640, dur: 0.1, vol: 0.13, t }); squish(t, 0.6, 1.4); },
    aterriza: ({ v = 8 } = {}) => { const t = ctx.currentTime, k = Math.min(1, v / 16); tono({ onda: 'sine', f0: 150, f1: 55, dur: 0.1, vol: 0.12 + k * 0.18, t }); soplo({ dur: 0.08, vol: 0.05 + k * 0.1, tipo: 'lowpass', f0: 900, t }); },
    paso: () => soplo({ dur: 0.03, vol: 0.025, tipo: 'lowpass', f0: 700 }),
    cabeza: () => { tono({ onda: 'sine', f0: 420, f1: 190, dur: 0.12, vol: 0.12 }); squish(ctx.currentTime, 0.5, 0.8); },
    resorte: () => {
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.08); o.frequency.exponentialRampToValueAtTime(260, t + 0.4);
      lfo.frequency.value = 26; lg.gain.value = 36; lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      o.connect(g); g.connect(busSfx); o.start(t); lfo.start(t); o.stop(t + 0.45); lfo.stop(t + 0.45);
    },
    // morir: el ¡splat! (y el silbido de la caída si se fue para abajo)
    muere: ({ causa = 'pinches' } = {}) => {
      const t = ctx.currentTime;
      if (causa === 'caida') { tono({ onda: 'sine', f0: 900, f1: 180, dur: 0.5, vol: 0.09, t, vibrato: 0.02 }); return; }
      soplo({ dur: 0.28, vol: 0.4, tipo: 'lowpass', f0: 3200, f1: 250, t });
      tono({ onda: 'sine', f0: 220, f1: 45, dur: 0.22, vol: 0.32, t });
      for (let k = 0; k < 3; k++) squish(t + 0.05 + k * 0.05, 0.8 - k * 0.2, 1.6 - k * 0.3);
      tono({ onda: 'triangle', f0: 480, f1: 120, dur: 0.3, vol: 0.06, t: t + 0.12 });
    },
    // la claqueta: el golpe de madera de "¡toma!"
    claqueta: () => { const t = ctx.currentTime; soplo({ dur: 0.05, vol: 0.45, tipo: 'highpass', f0: 1800, t }); tono({ onda: 'square', f0: 700, f1: 300, dur: 0.035, vol: 0.08, t }); tono({ onda: 'sine', f0: 180, f1: 90, dur: 0.06, vol: 0.18, t }); },
    corte: () => obturador(ctx.currentTime),
    mano: ({ fase } = {}) => {
      const t = ctx.currentTime;
      if (fase === 'entra') soplo({ dur: 0.35, vol: 0.16, tipo: 'bandpass', f0: 300, f1: 1400, q: 0.7, t });
      else if (fase === 'agarra') { squish(t, 1, 0.9); tono({ onda: 'sine', f0: 900, f1: 1300, dur: 0.05, vol: 0.04, t }); }
      else soplo({ dur: 0.25, vol: 0.1, tipo: 'bandpass', f0: 1200, f1: 300, q: 0.7, t });
    },
    empujon: () => { soplo({ dur: 0.12, vol: 0.2, tipo: 'bandpass', f0: 2000, f1: 600, q: 1.2 }); tono({ onda: 'sine', f0: 300, f1: 700, dur: 0.1, vol: 0.08 }); },
    cae: () => { const t = ctx.currentTime; tono({ onda: 'square', f0: 170, f1: 80, dur: 0.12, vol: 0.06, t }); soplo({ dur: 0.1, vol: 0.12, tipo: 'lowpass', f0: 1200, t }); },
    tiembla: () => { const t = ctx.currentTime; for (let k = 0; k < 4; k++) soplo({ dur: 0.03, vol: 0.05, tipo: 'bandpass', f0: 500 + k * 60, q: 3, t: t + k * 0.06 }); },
    aparece: ({ golpe } = {}) => { const t = ctx.currentTime; if (golpe) { tono({ onda: 'sine', f0: 600, f1: 300, dur: 0.1, vol: 0.12, t }); return; } soplo({ dur: 0.08, vol: 0.2, tipo: 'highpass', f0: 2600, f1: 5000, t }); tono({ onda: 'sine', f0: 350, f1: 700, dur: 0.07, vol: 0.08, t }); },
    desaparece: () => { soplo({ dur: 0.18, vol: 0.14, tipo: 'bandpass', f0: 2500, f1: 600, q: 0.8 }); },
    mueve: ({ rapido } = {}) => { const t = ctx.currentTime; soplo({ dur: rapido ? 0.1 : 0.25, vol: 0.1, tipo: 'bandpass', f0: 400, f1: 900, q: 1.5, t }); },
    cruje: () => { const t = ctx.currentTime; for (let k = 0; k < 5; k++) soplo({ dur: 0.03, vol: 0.08, tipo: 'bandpass', f0: 1800 - k * 150, q: 2, t: t + k * 0.04 }); },
    desarma: () => { const t = ctx.currentTime; soplo({ dur: 0.3, vol: 0.2, tipo: 'lowpass', f0: 2000, f1: 300, t }); for (let k = 0; k < 4; k++) squish(t + k * 0.05, 0.6, 0.8); },
    bola: () => { const t = ctx.currentTime; soplo({ dur: 0.6, vol: 0.08, tipo: 'bandpass', f0: 180, q: 1.2, t }); tono({ onda: 'sine', f0: 90, dur: 0.5, vol: 0.06, t }); },
    // la puerta: rechina (un serrucho con la nota que tiembla) o camina de puntitas
    puerta: ({ patas, salta } = {}) => {
      const t = ctx.currentTime;
      if (patas) { for (let k = 0; k < 6; k++) tono({ onda: 'sine', f0: 900 + (k % 2) * 200, dur: 0.03, vol: 0.05, t: t + k * 0.083 }); return; }
      if (salta) { squish(t, 1, 1.2); return; }
      tono({ onda: 'sawtooth', f0: 380, f1: 520, dur: 0.3, vol: 0.025, t, vibrato: 0.04 });
    },
    bonk: () => { const t = ctx.currentTime; tono({ onda: 'sine', f0: 320, f1: 120, dur: 0.25, vol: 0.22, t }); tono({ onda: 'triangle', f0: 640, f1: 240, dur: 0.18, vol: 0.05, t }); },
    luz: () => { const t = ctx.currentTime; soplo({ dur: 0.03, vol: 0.3, tipo: 'highpass', f0: 3000, t }); tono({ onda: 'sine', f0: 120, f1: 50, dur: 0.4, vol: 0.08, t: t + 0.02 }); },
    nota: () => { soplo({ dur: 0.15, vol: 0.08, tipo: 'highpass', f0: 3000, f1: 6000 }); },
    temblor: () => { const t = ctx.currentTime; tono({ onda: 'sine', f0: 60, f1: 40, dur: 0.4, vol: 0.2, t }); soplo({ dur: 0.35, vol: 0.12, tipo: 'lowpass', f0: 400, t }); },
    // ganó: la puerta, "¡toma!" y la marimba que sube
    gana: () => {
      const t = ctx.currentTime;
      tono({ onda: 'sawtooth', f0: 420, f1: 560, dur: 0.22, vol: 0.02, t, vibrato: 0.03 });
      ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, k) => marimba(f(n), t + 0.3 + k * 0.07, 0.1, busSfx, 0.6));
      for (const n of ['C4', 'E4', 'G4', 'B4']) tono({ onda: 'triangle', f0: f(n), dur: 1.1, vol: 0.03, t: t + 0.6, ataque: 0.05 });
    },
    compra: () => { const t = ctx.currentTime; marimba(f('E6'), t, 0.1, busSfx, 0.3); marimba(f('A6'), t + 0.08, 0.1, busSfx, 0.5); soplo({ dur: 0.2, vol: 0.05, f0: 6000, tipo: 'highpass', t: t + 0.08 }); },
    error: () => { tono({ onda: 'triangle', f0: 190, dur: 0.1, vol: 0.1 }); tono({ onda: 'triangle', f0: 150, dur: 0.14, vol: 0.1, t: ctx.currentTime + 0.1 }); },
    cambia: () => { squish(ctx.currentTime, 0.6, 1.6); tono({ onda: 'sine', f0: 660, f1: 990, dur: 0.08, vol: 0.05 }); },
    bolita: ({ n = 1 } = {}) => { const t = ctx.currentTime; marimba(f(['C6', 'E6', 'G6', 'C7'][Math.min(3, n - 1)]), t, 0.08, busSfx, 0.3); },
  };

  function programar() {
    if (!tema || !ctx) return;
    const c = CANCIONES[tema], d = 60 / c.bpm / 4;
    if (proximo < ctx.currentTime - 0.3) proximo = ctx.currentTime + 0.05;
    try {
      while (proximo < ctx.currentTime + 0.12) { paso(c, pasoN, proximo, d); proximo += d; pasoN++; }
    } catch (e) { s.errores.push('música ' + tema + ': ' + e.message); tema = null; }
  }
  function paso(c, n, t0, d) {
    const p = n % 16, compas = Math.floor(n / 16) % c.acordes.length;
    // swing: las corcheas de "y" llegan un poquito tarde
    const t = t0 + (p % 4 === 2 ? c.swing * d : 0);
    const [raizN, tipo] = c.acordes[compas], raiz = midi(raizN), ac = TIPOS[tipo];
    const b = c.bajo[p];
    if (b !== '.') {
      const nota = raiz + (b === 'O' ? 12 : b === '5' ? 7 : 0);
      tono({ onda: 'triangle', f0: hz(nota), dur: d * 1.8, vol: 0.2, t, destino: busMus, ataque: 0.004 });
      tono({ onda: 'sine', f0: hz(nota + 12), dur: 0.05, vol: 0.05, t, destino: busMus });
    }
    const m = c.marimba[p];
    if (m !== '.') marimba(hz(raiz + 24 + ac[+m]), t, 0.045);
    if (p === 0) for (const x of ac.slice(0, 3)) tono({ onda: 'sine', f0: hz(raiz + 12 + x), dur: d * 15, vol: 0.012, t, ataque: 0.3, destino: busMus });
    if (c.bombo[p] === 'x') tono({ onda: 'sine', f0: 110, f1: 45, dur: 0.14, vol: 0.18, t, destino: busMus });
    if (c.escobilla[p] === 'x') soplo({ dur: 0.12, vol: 0.05, tipo: 'bandpass', f0: 3200, q: 0.6, t, destino: busMus });
    if (c.taco[p] === 'x') { tono({ onda: 'sine', f0: 820, dur: 0.035, vol: 0.05, t, destino: busMus }); soplo({ dur: 0.02, vol: 0.03, tipo: 'bandpass', f0: 2500, q: 4, t, destino: busMus }); }
    // la melodía: cuatro compases que se repiten
    const pm = n % c.largo;
    for (const [ini, nota, largo] of c.notas) if (ini === pm) {
      if (c.lead === 'celesta') celesta(hz(nota), t, largo * d, 0.05);
      else clarinete(hz(nota), t, largo * d * 0.92, 0.035);
    }
  }

  s.despertar = () => {
    if (!ctx && !iniciar()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (!reloj) reloj = setInterval(programar, 25);
  };
  s.tocar = (nombre, op) => {
    if (!ctx || !ajustes.sonido || ctx.state !== 'running') return;
    if (!SFX[nombre]) { s.errores.push('no existe ' + nombre); return; }
    try { SFX[nombre](op); } catch (e) { s.errores.push(nombre + ': ' + e.message); }
  };
  s.hay = (nombre) => !!SFX[nombre];
  s.musica = (nombre) => {
    if (s.cancion === nombre) return;
    s.cancion = nombre; tema = CANCIONES[nombre] ? nombre : null; pasoN = 0;
    if (ctx) proximo = ctx.currentTime + 0.05;
  };
  s.aplicar = () => {
    if (!ctx) return;
    busSfx.gain.setTargetAtTime(ajustes.sonido ? 0.9 : 0, ctx.currentTime, 0.02);
    busMus.gain.setTargetAtTime(ajustes.musica ? 0.5 : 0, ctx.currentTime, 0.05);
  };
  s.lava = (v) => { if (ctx) maestro.gain.setTargetAtTime(v, ctx.currentTime, 0.05); };
  // La música de la intro de plastilina, con los tiempos de intro.js › T: la
  // lámpara que se prende, la plastilina que se estira (squish por cuadro y
  // una marimba que sube), el dedo que la aprieta (¡bup! y un acorde),
  // una letra por cuadro, el palillo de "presenta" y la foto (el obturador
  // y un acorde tibio).
  s.jingleJXS = () => {
    // con el audio suspendido (sin un toque) se agendaría y sonaría tarde, fuera de fase
    if (!ctx || ctx.state !== 'running' || !(ajustes.sonido || ajustes.musica)) return null;
    const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(maestro);
    const t0 = ctx.currentTime + 0.03;
    soplo({ dur: 0.03, vol: 0.3, tipo: 'highpass', f0: 3000, t: t0 + TI.luz, destino: bus });
    tono({ onda: 'sine', f0: 100, dur: 0.3, vol: 0.05, t: t0 + TI.luz, destino: bus });
    const [a, b] = TI.rollo, n = 10;
    for (let k = 0; k < n; k++) squish(t0 + a + (k * (b - a)) / n, 0.8, 0.9 + k * 0.06, bus);
    ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6'].forEach((nn, k) => marimba(f(nn), t0 + a + (k * (b - a)) / 9 + 0.02, 0.06, bus, 0.4));
    const tg = t0 + TI.aprieta;
    tono({ onda: 'sine', f0: 160, f1: 60, dur: 0.22, vol: 0.32, t: tg, destino: bus });
    squish(tg, 1.4, 0.7, bus);
    ['C5', 'E5', 'G5', 'C6'].forEach((nn, k) => marimba(f(nn), tg + 0.04 + k * 0.03, 0.07, bus, 0.8));
    for (let k = 0; k < 9; k++) { const tl = t0 + TI.letras + k * TI.cadaLetra; squish(tl, 0.7, 1.2 + (k % 3) * 0.15, bus); }
    for (let k = 0; k < 6; k++) soplo({ dur: 0.05, vol: 0.04, tipo: 'bandpass', f0: 2600 + (k % 2) * 700, q: 5, t: t0 + TI.presenta + k * 0.06, destino: bus });
    obturador(t0 + TI.flash, 1, bus);
    for (const nn of ['C4', 'E4', 'G4', 'B4', 'D5']) tono({ onda: 'triangle', f0: f(nn), dur: 1.3, vol: 0.035, t: t0 + TI.flash + 0.05, ataque: 0.06, destino: bus });
    return { cortar: () => bus.gain.setTargetAtTime(0, ctx.currentTime, 0.06) };
  };
  s.activo = () => !!ctx && ctx.state === 'running';
  return s;
}

export { CANCIONES };

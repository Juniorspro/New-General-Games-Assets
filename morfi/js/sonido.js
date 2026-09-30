// El sonido, sintetizado con WebAudio (nada de archivos): una kalimba con
// pizzicato para el menú y otra más saltarina para jugar (progresiones
// fijas: una al azar suena a nada), el tijeretazo del corte, la estrella que
// sube de nota (la segunda más aguda que la primera), el mordiscón de Morfi
// con su "ñam", el pop del globo, el soplido del abanico, el ¡boing! de la
// gomita y el papel del sobre. El audio se crea al abrir: si el navegador
// deja sonar, nace andando; si no, arranca con el primer toque (main.js ›
// despertar).
import { T as TI } from './intro.js';

const NOTA = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11, Bb: 10, Eb: 3 };
const midi = (n) => { const m = /^([A-G][#b]?)(\d)$/.exec(n); return 12 * (+m[2] + 1) + NOTA[m[1]]; };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const f = (n) => hz(midi(n));

// acordes (raíz y tipo); bajo en pizzicato, kalimba, bombo, "tic" de lápiz y shaker en 16 pasos
const CANCIONES = {
  menu: {
    bpm: 96, acordes: [['C3', 'M'], ['A2', 'm7'], ['F2', 'M7'], ['G2', 'M']],
    bajo: 'R.....5.R.....5.', kalimba: '0.2.1.3.2...1.2.', bombo: 'x.......x.......', tic: '....x.......x...', shaker: '..x...x...x...x.',
  },
  juego: {
    bpm: 108, acordes: [['F2', 'M'], ['D2', 'm'], ['A#2', 'M'], ['C3', 'M']],
    bajo: 'R..R..5.R..R..O.', kalimba: '0.1.2.3.2.1.3.2.', bombo: 'x.....x...x.....', tic: '....x.......x..x', shaker: 'x.x.x.x.x.x.x.x.',
  },
};
const TIPOS = { m: [0, 3, 7, 12], M: [0, 4, 7, 12], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11] };

export function crearSonido(ajustes) {
  let ctx = null, maestro, busSfx, busMus, ruido;
  const s = { ajustes, errores: [] };
  let tema = null, proximo = 0, pasoN = 0, reloj = null, ultimoCorte = 0;

  function iniciar() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    maestro = ctx.createGain(); maestro.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    maestro.connect(comp); comp.connect(ctx.destination);
    busSfx = ctx.createGain(); busSfx.connect(maestro);
    busMus = ctx.createGain(); busMus.connect(maestro);
    // un eco corto en la música: le da aire
    const eco = ctx.createDelay(1), vuelta = ctx.createGain(), sal = ctx.createGain();
    eco.delayTime.value = 0.31; vuelta.gain.value = 0.22; sal.gain.value = 0.2;
    busMus.connect(eco); eco.connect(vuelta); vuelta.connect(eco); eco.connect(sal); sal.connect(maestro);
    const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    ruido = b;
    s.aplicar();
    return true;
  }

  function tono({ onda = 'sine', f0, f1 = f0, dur = 0.1, vol = 0.1, t = ctx.currentTime, ataque = 0.005, destino = busSfx }) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = onda;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(destino);
    o.start(t); o.stop(t + dur + 0.02);
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
  // una tecla de kalimba: el seno que se apaga y el "tin" metálico de la lengüeta (5,4 veces más agudo)
  function kalimba(fr, t, vol, destino = busMus, dur = 0.7) {
    tono({ onda: 'sine', f0: fr, dur, vol, t, destino, ataque: 0.004 });
    tono({ onda: 'sine', f0: fr * 5.4, dur: 0.08, vol: vol * 0.3, t, destino });
    tono({ onda: 'triangle', f0: fr * 2, dur: dur * 0.35, vol: vol * 0.18, t, destino });
  }
  // la tijera: dos hojas que se cruzan (un chasquido agudo y el roce)
  function tijera(t, vol = 1, destino = busSfx) {
    soplo({ dur: 0.05, vol: 0.2 * vol, tipo: 'highpass', f0: 4200, t, destino });
    tono({ onda: 'triangle', f0: 2400, f1: 1100, dur: 0.035, vol: 0.07 * vol, t, destino });
    soplo({ dur: 0.07, vol: 0.06 * vol, f0: 2500, f1: 6000, q: 2, t: t + 0.015, destino });
  }

  const SFX = {
    boton: () => { tono({ onda: 'sine', f0: 620, f1: 980, dur: 0.07, vol: 0.08 }); soplo({ dur: 0.04, vol: 0.04, f0: 3000, tipo: 'highpass' }); },
    corte: () => {
      const t = ctx.currentTime;
      if (t - ultimoCorte < 0.04) return;     // dos hilos en el mismo tajo: un solo tijeretazo
      ultimoCorte = t; tijera(t);
    },
    // la estrella: 1, 2 y 3 suben
    estrella: ({ n = 1 } = {}) => {
      const t = ctx.currentTime, base = [f('E6'), f('G6'), f('C7')][Math.min(2, n - 1)];
      tono({ onda: 'sine', f0: base, dur: 0.18, vol: 0.1, t });
      tono({ onda: 'sine', f0: base * 1.5, dur: 0.3, vol: 0.07, t: t + 0.05 });
      tono({ onda: 'triangle', f0: base * 3, dur: 0.1, vol: 0.02, t: t + 0.05 });
      for (let k = 0; k < 3; k++) tono({ onda: 'sine', f0: base * (2 + k * 0.25), dur: 0.05, vol: 0.02, t: t + 0.1 + k * 0.04 });
    },
    // el mordiscón: el golpe de las tapas, el crujido y el "ñam ñam"
    comer: () => {
      const t = ctx.currentTime;
      tono({ onda: 'sine', f0: 190, f1: 60, dur: 0.16, vol: 0.4, t });
      soplo({ dur: 0.1, vol: 0.2, f0: 900, q: 0.8, t });
      for (const [k, d] of [[0, 0.16], [1, 0.34]]) {
        tono({ onda: 'square', f0: 330 - k * 30, f1: 220 - k * 20, dur: 0.1, vol: 0.035, t: t + d });
        tono({ onda: 'sine', f0: 660 - k * 60, f1: 440, dur: 0.1, vol: 0.05, t: t + d });
      }
    },
    gana: () => {
      const t = ctx.currentTime + 0.35;
      ['C5', 'E5', 'G5', 'C6'].forEach((n, k) => kalimba(f(n), t + k * 0.085, 0.12, busSfx, 0.8));
      for (const n of ['C4', 'E4', 'G4', 'B4']) tono({ onda: 'triangle', f0: f(n), dur: 1.3, vol: 0.035, t: t + 0.34, ataque: 0.05 });
    },
    // en la tarjeta del final, cada estrella que se pega
    pega: ({ n = 1 } = {}) => {
      const t = ctx.currentTime, base = [f('C6'), f('E6'), f('G6')][Math.min(2, n - 1)];
      tono({ onda: 'sine', f0: 180, f1: 70, dur: 0.1, vol: 0.18, t });
      tono({ onda: 'sine', f0: base, dur: 0.25, vol: 0.09, t: t + 0.02 });
      tono({ onda: 'sine', f0: base * 2, dur: 0.12, vol: 0.03, t: t + 0.06 });
    },
    pop: () => {
      soplo({ dur: 0.07, vol: 0.4, tipo: 'highpass', f0: 1500 });
      soplo({ dur: 0.25, vol: 0.12, tipo: 'lowpass', f0: 3000, f1: 400 });
      tono({ onda: 'sine', f0: 220, f1: 70, dur: 0.18, vol: 0.2 });
    },
    // el caramelo entra al globo: un "blup" que sube
    globo: () => { tono({ onda: 'sine', f0: 260, f1: 620, dur: 0.18, vol: 0.12 }); tono({ onda: 'sine', f0: 520, f1: 1240, dur: 0.12, vol: 0.03, t: ctx.currentTime + 0.03 }); },
    soplo: () => { soplo({ dur: 0.4, vol: 0.2, f0: 500, f1: 1800, q: 0.9 }); soplo({ dur: 0.25, vol: 0.06, tipo: 'highpass', f0: 5000 }); },
    sobre: () => {
      const t = ctx.currentTime;
      soplo({ dur: 0.18, vol: 0.12, tipo: 'highpass', f0: 2500, f1: 7000, t });
      tono({ onda: 'sine', f0: 900, f1: 280, dur: 0.16, vol: 0.07, t });
      tono({ onda: 'sine', f0: 300, f1: 900, dur: 0.16, vol: 0.06, t: t + 0.12 });
    },
    boing: ({ fuerza = 400 } = {}) => {
      const t = ctx.currentTime, k = Math.min(1, fuerza / 700);
      const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(420 + k * 120, t + 0.06); o.frequency.exponentialRampToValueAtTime(240, t + 0.35);
      lfo.frequency.value = 28; lg.gain.value = 30; lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14 + k * 0.08, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o.connect(g); g.connect(busSfx); o.start(t); lfo.start(t); o.stop(t + 0.42); lfo.stop(t + 0.42);
    },
    clip: () => { tono({ onda: 'square', f0: 2200, dur: 0.02, vol: 0.04 }); soplo({ dur: 0.03, vol: 0.08, tipo: 'highpass', f0: 3500 }); tono({ onda: 'sine', f0: 1300, f1: 900, dur: 0.07, vol: 0.05 }); },
    // se rompe en las chinches: un crujido de caramelo
    roto: () => {
      const t = ctx.currentTime;
      for (let k = 0; k < 4; k++) soplo({ dur: 0.05, vol: 0.18 - k * 0.03, f0: 2200 - k * 300, q: 1.5, t: t + k * 0.03 });
      tono({ onda: 'triangle', f0: 400, f1: 120, dur: 0.25, vol: 0.1, t });
    },
    // se cayó: una trompetita triste
    perdido: () => {
      const t = ctx.currentTime;
      ['G4', 'F#4', 'F4', 'E4'].forEach((n, k) => tono({ onda: 'triangle', f0: f(n), f1: f(n) * (k === 3 ? 0.94 : 1), dur: k === 3 ? 0.45 : 0.16, vol: 0.07, t: t + k * 0.17, ataque: 0.02 }));
    },
    compra: () => { const t = ctx.currentTime; kalimba(f('E6'), t, 0.1, busSfx, 0.3); kalimba(f('A6'), t + 0.08, 0.1, busSfx, 0.5); soplo({ dur: 0.2, vol: 0.05, f0: 6000, tipo: 'highpass', t: t + 0.08 }); },
    error: () => { tono({ onda: 'triangle', f0: 190, dur: 0.1, vol: 0.1 }); tono({ onda: 'triangle', f0: 150, dur: 0.14, vol: 0.1, t: ctx.currentTime + 0.1 }); },
    cambia: () => { soplo({ dur: 0.12, vol: 0.06, tipo: 'highpass', f0: 2000, f1: 5000 }); tono({ onda: 'sine', f0: 660, f1: 990, dur: 0.1, vol: 0.05 }); },
  };

  function programar() {
    if (!tema || !ctx) return;
    const c = CANCIONES[tema], d = 60 / c.bpm / 4;
    if (proximo < ctx.currentTime - 0.3) proximo = ctx.currentTime + 0.05;
    try {
      while (proximo < ctx.currentTime + 0.12) { paso(c, pasoN, proximo, d); proximo += d; pasoN++; }
    } catch (e) { s.errores.push('música ' + tema + ': ' + e.message); tema = null; }
  }
  function paso(c, n, t, d) {
    const p = n % 16, compas = Math.floor(n / 16) % c.acordes.length;
    const [raizN, tipo] = c.acordes[compas], raiz = midi(raizN), ac = TIPOS[tipo];
    const b = c.bajo[p];
    // el bajo en pizzicato: corto, con el golpe de la cuerda
    if (b !== '.') {
      const nota = raiz + (b === 'O' ? 12 : b === '5' ? 7 : 0);
      tono({ onda: 'triangle', f0: hz(nota), dur: d * 1.6, vol: 0.2, t, destino: busMus, ataque: 0.004 });
      tono({ onda: 'sine', f0: hz(nota + 12), dur: 0.05, vol: 0.05, t, destino: busMus });
    }
    const k = c.kalimba[p];
    if (k !== '.') kalimba(hz(raiz + 24 + ac[+k]), t, 0.055);
    if (p === 0) for (const x of ac.slice(0, 3)) tono({ onda: 'sine', f0: hz(raiz + 12 + x), dur: d * 15, vol: 0.014, t, ataque: 0.4, destino: busMus });
    if (c.bombo[p] === 'x') tono({ onda: 'sine', f0: 110, f1: 45, dur: 0.14, vol: 0.2, t, destino: busMus });
    if (c.tic[p] === 'x') { tono({ onda: 'square', f0: 1800, dur: 0.015, vol: 0.012, t, destino: busMus }); soplo({ dur: 0.04, vol: 0.03, f0: 2400, q: 3, t, destino: busMus }); }
    if (c.shaker[p] === 'x') soplo({ dur: 0.035, vol: 0.012, tipo: 'highpass', f0: 7000, t, destino: busMus });
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
  // La música de la intro de papel, con los tiempos de intro.js › T: el
  // papel que entra (un roce), la tijera que recorta el monograma (tijeretazos
  // y una kalimba que sube), el ¡fum! del recorte que salta con un acorde,
  // un sello por letra y la birome de "presenta"; el papel que se va, con un
  // acorde tibio.
  s.jingleJXS = () => {
    // con el audio suspendido (sin un toque) se agendaría y sonaría tarde, fuera de fase
    if (!ctx || ctx.state !== 'running' || !(ajustes.sonido || ajustes.musica)) return null;
    const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(maestro);
    const t0 = ctx.currentTime + 0.03;
    soplo({ dur: 0.35, vol: 0.12, tipo: 'bandpass', f0: 700, f1: 3000, q: 0.8, t: t0, destino: bus });
    const [a, b] = TI.traza, n = 9;
    for (let k = 0; k < n; k++) tijera(t0 + a + (k * (b - a)) / n, 0.8, bus);
    ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6'].forEach((nn, k) => kalimba(f(nn), t0 + a + (k * (b - a)) / n + 0.02, 0.06, bus, 0.45));
    const tg = t0 + TI.golpe;
    tono({ onda: 'sine', f0: 140, f1: 50, dur: 0.25, vol: 0.35, t: tg, destino: bus });
    soplo({ dur: 0.3, vol: 0.12, tipo: 'lowpass', f0: 2500, f1: 500, t: tg, destino: bus });
    ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((nn, k) => kalimba(f(nn), tg + 0.03 + k * 0.03, 0.07, bus, 0.8));
    for (let k = 0; k < 9; k++) {
      const tl = t0 + TI.letras + k * TI.cadaLetra + 0.12;
      tono({ onda: 'sine', f0: 160 + (k % 3) * 20, f1: 70, dur: 0.07, vol: 0.14, t: tl, destino: bus });
      soplo({ dur: 0.04, vol: 0.06, f0: 1400, q: 1, t: tl, destino: bus });
    }
    for (let k = 0; k < 6; k++) soplo({ dur: 0.06, vol: 0.03, f0: 3000 + (k % 2) * 800, q: 4, t: t0 + TI.presenta + k * 0.06, destino: bus });
    soplo({ dur: 0.3, vol: 0.12, tipo: 'bandpass', f0: 3000, f1: 800, q: 0.8, t: t0 + TI.fin, destino: bus });
    for (const nn of ['C4', 'E4', 'G4', 'B4', 'D5']) tono({ onda: 'triangle', f0: f(nn), dur: 1.4, vol: 0.035, t: t0 + TI.fin, ataque: 0.06, destino: bus });
    return { cortar: () => bus.gain.setTargetAtTime(0, ctx.currentTime, 0.06) };
  };
  s.activo = () => !!ctx && ctx.state === 'running';
  return s;
}

export { CANCIONES };

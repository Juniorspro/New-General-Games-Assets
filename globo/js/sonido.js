// El sonido, sintetizado con WebAudio (nada de archivos): una marimba
// tranquila para el menú y otra con más ritmo para jugar (progresiones fijas:
// una al azar suena a nada), el "toc" de madera del escudo, la moneda que
// sube de nota si se juntan seguidas, el ¡pum! del globo y la fanfarria de
// la meta. El audio se crea al abrir: si el navegador deja sonar, nace
// andando; si no, arranca con el primer toque (main.js › despertar).
import { T as TI } from './intro.js';

const NOTA = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11, Bb: 10, Eb: 3 };
const midi = (n) => { const m = /^([A-G][#b]?)(\d)$/.exec(n); return 12 * (+m[2] + 1) + NOTA[m[1]]; };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const f = (n) => hz(midi(n));

// acordes (raíz y tipo); bajo, marimba, bombo, palmas y shaker en 16 pasos
const CANCIONES = {
  menu: {
    bpm: 92, acordes: [['C3', 'M7'], ['A2', 'm7'], ['F2', 'M7'], ['G2', 'M']],
    bajo: 'R-------5-----R-', marimba: '0..2..1.3..2..1.', bombo: 'x.......x.......', palmas: '................', shaker: '..x...x...x...x.',
  },
  juego: {
    bpm: 106, acordes: [['F2', 'M'], ['D2', 'm'], ['A#2', 'M'], ['C3', 'M']],
    bajo: 'R..R..O.R..5..O.', marimba: '0.1.2.1.3.2.1.2.', bombo: 'x.....x...x.....', palmas: '....x.......x...', shaker: 'x.x.x.x.x.x.x.x.',
  },
};
const TIPOS = { m: [0, 3, 7, 12], M: [0, 4, 7, 12], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11] };

export function crearSonido(ajustes) {
  let ctx = null, maestro, busSfx, busMus, ruido;
  const s = { ajustes, errores: [] };
  let tema = null, proximo = 0, pasoN = 0, reloj = null, ultimaMoneda = -9, racha = 0, ultimoGolpe = 0;

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
    eco.delayTime.value = 0.28; vuelta.gain.value = 0.25; sal.gain.value = 0.22;
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
  // una tecla de marimba: el golpe (seno que se apaga rápido) y un armónico de madera
  function marimba(fr, t, vol, destino = busMus, dur = 0.5) {
    tono({ onda: 'sine', f0: fr, dur, vol, t, destino });
    tono({ onda: 'sine', f0: fr * 4, dur: 0.06, vol: vol * 0.25, t, destino });
  }

  const SFX = {
    boton: () => { tono({ onda: 'sine', f0: 700, f1: 1100, dur: 0.07, vol: 0.08 }); soplo({ dur: 0.03, vol: 0.03, f0: 4000, tipo: 'highpass' }); },
    // el escudo contra algo: madera, más fuerte cuanto más fuerte el golpe
    golpe: ({ vel = 300 } = {}) => {
      const t = ctx.currentTime;
      if (t - ultimoGolpe < 0.045) return;
      ultimoGolpe = t;
      const k = Math.min(1, vel / 900);
      tono({ onda: 'triangle', f0: 260 - k * 80, f1: 90, dur: 0.09 + k * 0.05, vol: 0.06 + k * 0.14 });
      soplo({ dur: 0.04, vol: 0.03 + k * 0.05, f0: 1800, q: 1.2 });
    },
    // la moneda: si vienen seguidas, cada una un tono más arriba
    moneda: () => {
      const t = ctx.currentTime;
      racha = t - ultimaMoneda < 1.1 ? Math.min(racha + 1, 12) : 0;
      ultimaMoneda = t;
      const base = 76 + [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28][racha];
      tono({ onda: 'sine', f0: hz(base), dur: 0.09, vol: 0.09 });
      tono({ onda: 'sine', f0: hz(base + 7), dur: 0.22, vol: 0.08, t: t + 0.06 });
      tono({ onda: 'triangle', f0: hz(base + 19), dur: 0.12, vol: 0.02, t: t + 0.06 });
    },
    pum: () => {
      soplo({ dur: 0.09, vol: 0.5, tipo: 'highpass', f0: 1200 });
      soplo({ dur: 0.35, vol: 0.18, tipo: 'lowpass', f0: 3000, f1: 300 });
      tono({ onda: 'sine', f0: 150, f1: 45, dur: 0.3, vol: 0.35 });
      tono({ onda: 'triangle', f0: 900, f1: 180, dur: 0.35, vol: 0.06, t: ctx.currentTime + 0.05 });
    },
    meta: () => {
      const t = ctx.currentTime;
      ['C5', 'E5', 'G5', 'C6'].forEach((n, k) => marimba(f(n), t + k * 0.09, 0.12, busSfx, 0.6));
      for (const n of ['C4', 'E4', 'G4', 'B4']) tono({ onda: 'triangle', f0: f(n), dur: 1.3, vol: 0.04, t: t + 0.36, ataque: 0.05 });
      for (let k = 0; k < 6; k++) tono({ onda: 'sine', f0: f('C7') * (1 + k * 0.12), dur: 0.1, vol: 0.025, t: t + 0.4 + k * 0.05 });
    },
    // viene algo cayendo: un soplido que baja y dos pitidos
    lluvia: () => {
      const t = ctx.currentTime;
      soplo({ dur: 0.45, vol: 0.1, f0: 3500, f1: 500, q: 1.5 });
      tono({ onda: 'square', f0: 880, dur: 0.06, vol: 0.025, t }); tono({ onda: 'square', f0: 880, dur: 0.06, vol: 0.025, t: t + 0.12 });
    },
    pendulo: () => soplo({ dur: 0.5, vol: 0.08, f0: 300, f1: 900, q: 2 }),
    compra: () => { const t = ctx.currentTime; tono({ onda: 'sine', f0: f('E6'), dur: 0.1, vol: 0.08, t }); tono({ onda: 'sine', f0: f('A6'), dur: 0.3, vol: 0.08, t: t + 0.08 }); soplo({ dur: 0.2, vol: 0.05, f0: 6000, tipo: 'highpass', t: t + 0.08 }); },
    error: () => { tono({ onda: 'triangle', f0: 190, dur: 0.1, vol: 0.1 }); tono({ onda: 'triangle', f0: 150, dur: 0.14, vol: 0.1, t: ctx.currentTime + 0.1 }); },
    cambia: () => { soplo({ dur: 0.12, vol: 0.05, f0: 1500, f1: 4000 }); tono({ onda: 'sine', f0: 660, f1: 990, dur: 0.1, vol: 0.05 }); },
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
    if (b !== '.' && b !== '-') {
      let l = 1; while (c.bajo[p + l] === '-') l++;
      const nota = raiz + (b === 'O' ? 12 : b === '5' ? 7 : 0);
      tono({ onda: 'triangle', f0: hz(nota), dur: d * l * 0.9, vol: 0.18, t, destino: busMus, ataque: 0.01 });
    }
    const m = c.marimba[p];
    if (m !== '.') marimba(hz(raiz + 24 + ac[+m]), t, 0.06);
    // el colchón del acorde al empezar cada compás
    if (p === 0) for (const k of ac.slice(0, 3)) tono({ onda: 'triangle', f0: hz(raiz + 12 + k), dur: d * 15, vol: 0.018, t, ataque: 0.3, destino: busMus });
    if (c.bombo[p] === 'x') tono({ onda: 'sine', f0: 120, f1: 45, dur: 0.15, vol: 0.22, t, destino: busMus });
    if (c.palmas[p] === 'x') { soplo({ dur: 0.08, vol: 0.05, f0: 1500, q: 0.9, t, destino: busMus }); soplo({ dur: 0.06, vol: 0.04, f0: 1500, q: 0.9, t: t + 0.012, destino: busMus }); }
    if (c.shaker[p] === 'x') soplo({ dur: 0.035, vol: 0.014, tipo: 'highpass', f0: 7000, t, destino: busMus });
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
  // La música de la intro de JXSTUDIOS, con los tiempos de intro.js › T:
  // tres soplidos (los barridos), la marimba que sube mientras el escudo
  // escribe, el silbato del globo que sube, el ¡boing! del choque con un
  // acorde brillante, un pop por letra y un acorde tibio para cerrar.
  s.jingleJXS = () => {
    // con el audio suspendido (sin un toque) se agendaría y sonaría tarde, fuera de fase
    if (!ctx || ctx.state !== 'running' || !(ajustes.sonido || ajustes.musica)) return null;
    const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(maestro);
    const t0 = ctx.currentTime + 0.03;
    [0, 0.09, 0.18].forEach((dd, k) => soplo({ dur: 0.28, vol: 0.09, f0: 600 + k * 400, f1: 4000 + k * 1500, q: 1.1, t: t0 + dd, destino: bus }));
    const escala = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6'];
    escala.forEach((n, k) => marimba(f(n), t0 + TI.traza[0] + (k * (TI.traza[1] - TI.traza[0])) / escala.length, 0.08, bus, 0.4));
    tono({ onda: 'sine', f0: 320, f1: 1150, dur: TI.golpe - TI.sube[0], vol: 0.06, t: t0 + TI.sube[0], ataque: 0.03, destino: bus });
    const tg = t0 + TI.golpe;
    tono({ onda: 'sine', f0: 130, f1: 42, dur: 0.3, vol: 0.4, t: tg, destino: bus });
    tono({ onda: 'sine', f0: 560, f1: 240, dur: 0.18, vol: 0.12, t: tg, destino: bus });
    tono({ onda: 'sine', f0: 420, f1: 300, dur: 0.22, vol: 0.08, t: tg + 0.16, destino: bus });
    ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, k) => marimba(f(n), tg + 0.03 + k * 0.025, 0.07, bus, 0.7));
    for (let k = 0; k < 9; k++) tono({ onda: 'sine', f0: 880 + k * 70, dur: 0.05, vol: 0.035, t: t0 + TI.letras + k * 0.045 + 0.08, destino: bus });
    soplo({ dur: 0.12, vol: 0.25, tipo: 'highpass', f0: 1500, t: t0 + TI.fin, destino: bus });
    for (const n of ['C4', 'E4', 'G4', 'B4', 'D5']) tono({ onda: 'triangle', f0: f(n), dur: 1.4, vol: 0.04, t: t0 + TI.fin, ataque: 0.06, destino: bus });
    return { cortar: () => bus.gain.setTargetAtTime(0, ctx.currentTime, 0.06) };
  };
  s.activo = () => !!ctx && ctx.state === 'running';
  return s;
}

export { CANCIONES };

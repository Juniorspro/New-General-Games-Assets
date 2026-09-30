// El sonido, sintetizado con WebAudio (nada de archivos): efectos suaves y
// redondos para comer, el soplido del turbo, el crujido al morir, la
// campanita al comerte a otra, y dos canciones con progresiones fijas
// (menú tranquilo, partida con ritmo). El AudioContext arranca recién con un
// toque de verdad (main.js › despertar).
const NOTA = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11, Bb: 10, Eb: 3 };
const midi = (n) => { const m = /^([A-G][#b]?)(\d)$/.exec(n); return 12 * (+m[2] + 1) + NOTA[m[1]]; };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const f = (n) => hz(midi(n));
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];

// acordes: raíz y tipo (m menor, M mayor, m7, M7); bajo y arpegio en 16 pasos
const CANCIONES = {
  menu: {
    bpm: 92, acordes: [['A2', 'm7'], ['F2', 'M7'], ['C3', 'M'], ['G2', 'M']],
    bajo: 'R-------O-----5-', arpegio: '0.2.1.3.2.1.3.2.', bombo: 'x.......x.......', caja: '................', hat: '..x...x...x...x.',
  },
  juego: {
    bpm: 112, acordes: [['D3', 'm'], ['A#2', 'M'], ['F2', 'M'], ['C3', 'M']],
    bajo: 'R.R.O.R.R.R.5.O.', arpegio: '0.1.2.3.2.1.0.2.', bombo: 'x...x...x...x...', caja: '....x.......x...', hat: '..x...x...x...x.',
  },
};
const TIPOS = { m: [0, 3, 7, 12], M: [0, 4, 7, 12], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11] };

export function crearSonido(ajustes) {
  let ctx = null, maestro, busSfx, busMus, ruido, turboGan = null, eco;
  const s = { ajustes, errores: [] };
  let tema = null, proximo = 0, pasoN = 0, reloj = null, ultimaComida = 0;

  function iniciar() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    maestro = ctx.createGain(); maestro.gain.value = 0.9;
    // un compresor suave: muchas comidas juntas no saturan
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    maestro.connect(comp); comp.connect(ctx.destination);
    busSfx = ctx.createGain(); busSfx.connect(maestro);
    busMus = ctx.createGain(); busMus.connect(maestro);
    eco = ctx.createDelay(1); eco.delayTime.value = 0.32;
    const vuelta = ctx.createGain(), sal = ctx.createGain();
    vuelta.gain.value = 0.3; sal.gain.value = 0.28;
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

  const SFX = {
    // la comida: un "pop" de burbuja, más grave cuanto más grande
    come: ({ valor = 1 } = {}) => {
      const t = ctx.currentTime;
      if (t - ultimaComida < 0.035) return;
      ultimaComida = t;
      const nota = 72 + PENTA[(Math.random() * PENTA.length) | 0] - Math.min(12, Math.log2(valor) * 4);
      tono({ onda: 'sine', f0: hz(nota), f1: hz(nota + 7), dur: 0.07, vol: 0.06 + Math.min(0.08, valor * 0.01) });
    },
    muere: () => {
      soplo({ dur: 0.5, vol: 0.3, tipo: 'lowpass', f0: 2600, f1: 180 });
      tono({ onda: 'triangle', f0: 420, f1: 60, dur: 0.6, vol: 0.18 });
      tono({ onda: 'sine', f0: 110, f1: 40, dur: 0.5, vol: 0.3 });
    },
    baja: () => ['E5', 'G#5', 'B5', 'E6'].forEach((n, k) => tono({ onda: 'triangle', f0: f(n), dur: 0.35, vol: 0.09, t: ctx.currentTime + k * 0.06 })),
    hito: () => ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, k) => tono({ onda: 'triangle', f0: f(n), dur: 0.3, vol: 0.08, t: ctx.currentTime + k * 0.07 })),
    nace: () => { soplo({ dur: 0.35, vol: 0.1, f0: 300, f1: 2400, q: 0.8 }); tono({ onda: 'sine', f0: 220, f1: 660, dur: 0.3, vol: 0.08 }); },
    boton: () => { tono({ onda: 'sine', f0: 880, dur: 0.05, vol: 0.07 }); tono({ onda: 'sine', f0: 1320, dur: 0.06, vol: 0.05, t: ctx.currentTime + 0.03 }); },
    cambia: () => { soplo({ dur: 0.12, vol: 0.06, f0: 1500, f1: 4000 }); tono({ onda: 'triangle', f0: 660, f1: 990, dur: 0.1, vol: 0.06 }); },
    error: () => { tono({ onda: 'triangle', f0: 180, dur: 0.1, vol: 0.1 }); tono({ onda: 'triangle', f0: 150, dur: 0.14, vol: 0.1, t: ctx.currentTime + 0.1 }); },
    record: () => ['C5', 'G5', 'C6', 'E6', 'G6', 'C7'].forEach((n, k) => tono({ onda: 'triangle', f0: f(n), dur: 0.4, vol: 0.08, t: ctx.currentTime + k * 0.08 })),
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
      tono({ onda: 'triangle', f0: hz(nota), dur: d * l * 0.95, vol: 0.2, t, destino: busMus, ataque: 0.01 });
    }
    const a = c.arpegio[p];
    if (a !== '.') tono({ onda: 'sine', f0: hz(raiz + 24 + ac[+a]), dur: d * 1.6, vol: 0.05, t, destino: busMus });
    // un colchón con el acorde al empezar cada compás
    if (p === 0) for (const k of ac.slice(0, 3)) tono({ onda: 'triangle', f0: hz(raiz + 12 + k), dur: d * 15, vol: 0.022, t, ataque: 0.25, destino: busMus });
    if (c.bombo[p] === 'x') tono({ onda: 'sine', f0: 130, f1: 42, dur: 0.16, vol: 0.28, t, destino: busMus });
    if (c.caja[p] === 'x') soplo({ dur: 0.12, vol: 0.06, f0: 2000, q: 0.8, t, destino: busMus });
    if (c.hat[p] === 'x') soplo({ dur: 0.03, vol: 0.02, tipo: 'highpass', f0: 8000, t, destino: busMus });
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
  // El soplido del turbo, que suena mientras dura.
  s.turbo = (encendido) => {
    if (!ctx) return;
    if (!turboGan) {
      const n = ctx.createBufferSource(), fl = ctx.createBiquadFilter();
      n.buffer = ruido; n.loop = true; fl.type = 'bandpass'; fl.frequency.value = 1400; fl.Q.value = 0.7;
      turboGan = ctx.createGain(); turboGan.gain.value = 0;
      n.connect(fl); fl.connect(turboGan); turboGan.connect(busSfx); n.start();
    }
    turboGan.gain.setTargetAtTime(encendido && ajustes.sonido ? 0.07 : 0, ctx.currentTime, 0.05);
  };
  // La música de la intro de JXSTUDIOS (intro.js › T_*): el metal que se
  // escribe (zumbidos que suben), el golpe (bombo + campana de parciales no
  // armónicos), el brillo y un acorde grande que queda.
  s.jingleJXS = () => {
    if (!ctx || !(ajustes.sonido || ajustes.musica)) return null;
    const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(maestro);
    const t0 = ctx.currentTime + 0.03, tg = t0 + 1.05;
    soplo({ dur: 0.9, vol: 0.09, f0: 200, f1: 3000, q: 0.9, t: t0 + 0.1, destino: bus });
    [0.15, 0.3, 0.45, 0.6].forEach((dd, k) => tono({ onda: 'triangle', f0: 180 + k * 60, f1: 900 + k * 180, dur: 0.35, vol: 0.05, t: t0 + dd, destino: bus }));
    tono({ onda: 'sine', f0: 100, f1: 28, dur: 1.2, vol: 0.6, t: tg, destino: bus });
    for (const [fr, v, dd] of [[440, 0.07, 1.8], [1046, 0.05, 1.4], [1712, 0.035, 1.0], [2630, 0.025, 0.7], [3880, 0.015, 0.45]]) tono({ onda: 'sine', f0: fr, dur: dd, vol: v, t: tg, destino: bus });
    soplo({ dur: 0.5, vol: 0.25, tipo: 'lowpass', f0: 5000, f1: 220, t: tg, destino: bus });
    ['A5', 'C#6', 'E6', 'A6', 'C#7', 'E7'].forEach((n, k) => tono({ onda: 'triangle', f0: f(n), dur: 0.4, vol: 0.045, t: tg + 0.3 + k * 0.045, destino: bus }));
    for (const n of ['A2', 'E3', 'C#4', 'G#4', 'B4', 'E5']) tono({ onda: 'triangle', f0: f(n), dur: 2.0, vol: 0.05, t: tg + 0.1, ataque: 0.3, destino: bus });
    return { cortar: () => bus.gain.setTargetAtTime(0, ctx.currentTime, 0.06) };
  };
  s.activo = () => !!ctx && ctx.state === 'running';
  return s;
}

export { CANCIONES };

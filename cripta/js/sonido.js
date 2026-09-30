// El sonido, todo sintetizado con WebAudio: osciladores de pulso (el timbre
// de las consolas viejas), un búfer de ruido para golpes y tambores, y nada
// de archivos.
//
// El AudioContext se crea recién con el primer toque (antes el navegador no
// deja sonar). La música es un secuenciador de pasos que agenda con el reloj
// del audio: cada 25 ms se programan las notas de los próximos 120 ms, así no
// tiembla aunque el cuadro se atrase. Cada canción tiene su progresión fija:
// una progresión al azar suena a nada (lo aprendió ritmo/, ver memoria).
const NOTA = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const midi = (n) => { const m = /^([A-G][#b]?)(\d)$/.exec(n); return 12 * (+m[2] + 1) + NOTA[m[1]]; };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const f = (n) => hz(midi(n));

// Las canciones: acordes de a un compás (raíz y si es menor), el bajo y el
// arpegio como patrones de 16 pasos, la batería y una melodía corta.
//   bajo: R raíz · O octava · 5 quinta · - sigue · . silencio
//   arpegio: 0 1 2 notas del acorde, 3 la raíz arriba
const CANCIONES = {
  portada: {
    bpm: 92, acordes: [['A2', 1], ['F2', 0], ['C3', 0], ['G2', 0]],
    bajo: 'R-----O-R-----5-', arpegio: '0.1.2.1.0.1.2.3.', arpVol: 0.045,
    bombo: 'x.......x.......', caja: '................', hat: '....x.......x...',
    melodia: [
      'E5 - - - C5 - D5 - E5 - - - . . . .',
      'F5 - - - E5 - D5 - C5 - - - . . . .',
      'G5 - - - E5 - C5 - D5 - - - E5 - - -',
      'D5 - - - B4 - - - . . . . . . . .',
    ],
  },
  mundo0: {
    bpm: 116, acordes: [['D2', 1], ['Bb1', 0], ['C2', 0], ['A1', 0]],
    bajo: 'R.R.R.O.R.R.5.O.', arpegio: '0.1.2.1.0.1.2.3.', arpVol: 0.04,
    bombo: 'x...x...x...x...', caja: '....x.......x...', hat: '..x...x...x...x.',
    melodia: [
      'D5 - F5 - A5 - - - G5 - F5 - E5 - D5 -',
      'D5 - - - F5 - D5 - Bb4 - - - C5 - D5 -',
      'E5 - G5 - E5 - C5 - D5 - E5 - C5 - - -',
      'C#5 - - - E5 - - - A4 - - - . . . .',
    ],
  },
  mundo1: {
    bpm: 124, acordes: [['E2', 1], ['A2', 0], ['C2', 0], ['D2', 0]],
    bajo: 'R..OR..OR..5R.O.', arpegio: '0.2.1.2.0.2.1.2.', arpVol: 0.04,
    bombo: 'x..x..x.x..x..x.', caja: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    melodia: [
      'B4 - E5 - F#5 - G5 - F#5 - E5 - - - B4 -',
      'C#5 - E5 - A5 - - - G5 - F#5 - E5 - - -',
      'G5 - E5 - C5 - E5 - G5 - - - A5 - G5 -',
      'F#5 - - - D5 - - - A4 - B4 - C#5 - D5 -',
    ],
  },
  mundo2: {
    bpm: 132, acordes: [['E2', 1], ['F2', 0], ['G2', 0], ['F2', 0]],
    bajo: 'R.RR.R.RR.R.O.5.', arpegio: '0.1.0.2.0.1.0.3.', arpVol: 0.035,
    bombo: 'x.x...x.x.x...x.', caja: '....x.......x...', hat: '..x...x...x...x.',
    melodia: [
      'E5 - - - F5 - E5 - D5 - E5 - - - B4 -',
      'C5 - - - A4 - C5 - F5 - E5 - C5 - - -',
      'D5 - - - B4 - D5 - G5 - F5 - D5 - - -',
      'C5 - A4 - F4 - A4 - C5 - - - B4 - - -',
    ],
  },
  torre: {
    bpm: 140, acordes: [['A2', 1], ['G2', 0], ['F2', 0], ['E2', 0]],
    bajo: 'R.O.R.O.R.O.R.O.', arpegio: '0120012001200120', arpVol: 0.03,
    bombo: 'x...x...x...x...', caja: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx',
    melodia: [
      'A5 - E5 - A5 - C6 - B5 - A5 - G5 - E5 -',
      'D5 - G5 - B5 - - - A5 - G5 - F5 - D5 -',
      'C5 - F5 - A5 - - - G5 - F5 - E5 - C5 -',
      'B4 - E5 - G#5 - - - B5 - - - E5 - - -',
    ],
  },
  tienda: {
    bpm: 104, acordes: [['C3', 0], ['A2', 1], ['F2', 0], ['G2', 0]],
    bajo: 'R...5...O...5...', arpegio: '0.1.2.1.3.2.1.2.', arpVol: 0.04,
    bombo: 'x.......x.......', caja: '....x.......x...', hat: '..x...x...x...x.',
    melodia: [
      'E5 - G5 - C6 - - - B5 - G5 - - - . .',
      'A5 - - - E5 - C5 - E5 - - - . . . .',
      'F5 - A5 - C6 - - - A5 - F5 - - - . .',
      'G5 - - - D5 - B4 - D5 - - - G4 - - -',
    ],
  },
};
const DE_MUNDO = ['mundo0', 'mundo1', 'mundo2', 'torre'];
export { CANCIONES, midi };

export function crearSonido(ajustes) {
  let ctx = null, maestro, busSfx, busMusica, ruido, pulso25, pulso12, lavaGan = null;
  const s = { ajustes, cancion: null };
  let tema = null, proximo = 0, pasoN = 0, reloj = null;

  function iniciar() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    maestro = ctx.createGain(); maestro.gain.value = 0.9; maestro.connect(ctx.destination);
    busSfx = ctx.createGain(); busSfx.connect(maestro);
    busMusica = ctx.createGain(); busMusica.connect(maestro);
    // un poco de eco en la música: le da el aire de cripta
    const eco = ctx.createDelay(1); eco.delayTime.value = 0.27;
    const vuelta = ctx.createGain(); vuelta.gain.value = 0.28;
    const salidaEco = ctx.createGain(); salidaEco.gain.value = 0.35;
    busMusica.connect(eco); eco.connect(vuelta); vuelta.connect(eco); eco.connect(salidaEco); salidaEco.connect(maestro);
    const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    ruido = b;
    pulso25 = ondaPulso(0.25); pulso12 = ondaPulso(0.125);
    s.aplicar();
    return true;
  }

  function ondaPulso(ciclo) {
    const n = 40, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * ciclo);
    return ctx.createPeriodicWave(re, im);
  }

  // ── piezas ───────────────────────────────────────────────────────────────
  function tono({ onda = 'square', f0, f1 = f0, dur = 0.1, vol = 0.1, t = ctx.currentTime, ataque = 0.004, destino = busSfx, curva = 'exp' }) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    if (typeof onda === 'string') o.type = onda; else o.setPeriodicWave(onda);
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) curva === 'exp' ? o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur) : o.frequency.linearRampToValueAtTime(f1, t + dur);
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
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(fl); fl.connect(g); g.connect(destino);
    n.start(t, Math.random() * 0.5); n.stop(t + dur + 0.02);
  }
  function notas(lista, { onda = pulso25, vol = 0.1, t = ctx.currentTime } = {}) {
    for (const [n, dur, hueco = dur] of lista) { if (n) tono({ onda, f0: typeof n === 'number' ? n : f(n), dur: dur * 1.1, vol, t }); t += hueco; }
  }

  // ── los efectos ──────────────────────────────────────────────────────────
  const SFX = {
    chispa: ({ semitono = 0 } = {}) => tono({ onda: pulso25, f0: hz(84 + semitono), dur: 0.055, vol: 0.07 }),
    moneda: () => notas([['E6', 0.05], ['A6', 0.14]], { onda: 'square', vol: 0.07 }),
    estrella: ({ n = 1 } = {}) => {
      notas([['C6', 0.045], ['E6', 0.045], ['G6', 0.045], ['C7', 0.2]].map(([x, d]) => [hz(midi(x) + (n - 1) * 2), d]), { vol: 0.09 });
      soplo({ dur: 0.35, vol: 0.05, tipo: 'highpass', f0: 6000, t: ctx.currentTime + 0.12 });
    },
    arranque: () => soplo({ dur: 0.09, vol: 0.05, f0: 1200, f1: 3200, q: 2 }),
    toc: ({ fuerte = false } = {}) => {
      tono({ onda: 'square', f0: fuerte ? 190 : 240, f1: fuerte ? 70 : 120, dur: 0.07, vol: fuerte ? 0.09 : 0.06 });
      soplo({ dur: 0.03, vol: 0.06, tipo: 'lowpass', f0: 2500 });
    },
    tope: () => tono({ onda: 'triangle', f0: 150, f1: 100, dur: 0.05, vol: 0.08 }),
    romper: () => {
      soplo({ dur: 0.32, vol: 0.2, tipo: 'lowpass', f0: 3000, f1: 250 });
      tono({ onda: 'square', f0: 95, f1: 40, dur: 0.22, vol: 0.09 });
    },
    muerte: () => {
      tono({ onda: 'square', f0: 720, f1: 70, dur: 0.5, vol: 0.1 });
      soplo({ dur: 0.35, vol: 0.18, tipo: 'lowpass', f0: 1800, f1: 200 });
      tono({ onda: 'sine', f0: 120, f1: 40, dur: 0.3, vol: 0.25 });
    },
    salida: () => {
      notas(['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'].map((x) => [x, 0.045]), { vol: 0.08 });
      tono({ onda: 'triangle', f0: 523, f1: 2093, dur: 0.45, vol: 0.05 });
    },
    portal: () => { tono({ onda: 'triangle', f0: 380, f1: 1300, dur: 0.18, vol: 0.1 }); tono({ onda: pulso12, f0: 900, f1: 240, dur: 0.2, vol: 0.05 }); },
    flecha: () => tono({ onda: 'triangle', f0: 1500, dur: 0.035, vol: 0.07 }),
    poder: () => notas([['G5', 0.05], ['B5', 0.05], ['D6', 0.05], ['G6', 0.16]], { vol: 0.08 }),
    poderFin: () => notas([['D6', 0.06], ['G5', 0.12]], { vol: 0.05 }),
    escudoRoto: () => { tono({ onda: 'triangle', f0: 2200, f1: 700, dur: 0.16, vol: 0.1 }); soplo({ dur: 0.18, vol: 0.08, tipo: 'highpass', f0: 4000 }); },
    escupe: () => soplo({ dur: 0.18, vol: 0.08, f0: 900, f1: 380, q: 1.5 }),
    boton: () => { tono({ onda: pulso25, f0: 880, dur: 0.025, vol: 0.06 }); tono({ onda: pulso25, f0: 1320, dur: 0.04, vol: 0.05, t: ctx.currentTime + 0.025 }); },
    atras: () => tono({ onda: pulso25, f0: 660, f1: 420, dur: 0.06, vol: 0.06 }),
    comprar: () => notas([['E6', 0.04], ['A6', 0.04], ['E7', 0.16]], { onda: 'square', vol: 0.07 }),
    error: () => { tono({ onda: 'square', f0: 110, dur: 0.08, vol: 0.08 }); tono({ onda: 'square', f0: 104, dur: 0.1, vol: 0.08, t: ctx.currentTime + 0.1 }); },
    ganada: ({ n = 1 } = {}) => { tono({ onda: 'triangle', f0: hz(84 + n * 4), dur: 0.3, vol: 0.1 }); tono({ onda: pulso25, f0: hz(96 + n * 4), dur: 0.12, vol: 0.04 }); },
    contar: () => tono({ onda: pulso25, f0: 1760, dur: 0.015, vol: 0.035 }),
    record: () => notas([['C5', 0.08], ['E5', 0.08], ['G5', 0.08], ['C6', 0.16], ['G5', 0.08], ['C6', 0.35]], { vol: 0.08 }),
    victoria: () => notas([['G5', 0.08], ['C6', 0.08], ['E6', 0.08], ['G6', 0.2], ['E6', 0.08], ['G6', 0.4]], { vol: 0.08 }),
    pasos: () => tono({ onda: 'triangle', f0: 300, f1: 500, dur: 0.05, vol: 0.05 }),
    abrir: () => { tono({ onda: 'triangle', f0: 200, f1: 600, dur: 0.12, vol: 0.06 }); soplo({ dur: 0.1, vol: 0.04, f0: 2000, f1: 5000 }); },
  };

  // ── la música ────────────────────────────────────────────────────────────
  function programar() {
    if (!tema || !ctx) return;
    const c = CANCIONES[tema], dPaso = 60 / c.bpm / 4;
    // si la pestaña estuvo dormida, no se recupera todo lo atrasado de golpe
    if (proximo < ctx.currentTime - 0.3) proximo = ctx.currentTime + 0.05;
    try {
      while (proximo < ctx.currentTime + 0.12) {
        tocarPaso(c, pasoN, proximo, dPaso);
        proximo += dPaso; pasoN++;
      }
    } catch (e) { s.errores.push('música ' + tema + ': ' + e.message); tema = null; }
  }
  function tocarPaso(c, n, t, dPaso) {
    const p = n % 16, compas = Math.floor(n / 16) % c.acordes.length;
    const [raizN, menor] = c.acordes[compas], raiz = midi(raizN);
    const acorde = [0, menor ? 3 : 4, 7, 12];
    const dest = busMusica;
    // bajo
    const b = c.bajo[p];
    if (b !== '.' && b !== '-') {
      let largo = 1; while (c.bajo[p + largo] === '-') largo++;
      const nota = raiz + (b === 'O' ? 12 : b === '5' ? 7 : 0);
      tono({ onda: 'triangle', f0: hz(nota), dur: dPaso * largo * 0.95, vol: 0.2, t, destino: dest, ataque: 0.006 });
      tono({ onda: pulso12, f0: hz(nota), dur: dPaso * 0.6, vol: 0.03, t, destino: dest });
    }
    // arpegio, una octava y media arriba
    const a = c.arpegio[p];
    if (a !== '.') tono({ onda: pulso25, f0: hz(raiz + 24 + acorde[+a]), dur: dPaso * 0.8, vol: c.arpVol, t, destino: dest });
    // batería
    if (c.bombo[p] === 'x') tono({ onda: 'sine', f0: 150, f1: 42, dur: 0.14, vol: 0.32, t, destino: dest });
    if (c.caja[p] === 'x') { soplo({ dur: 0.12, vol: 0.09, f0: 1900, q: 0.8, t, destino: dest }); tono({ onda: 'triangle', f0: 190, f1: 120, dur: 0.06, vol: 0.05, t, destino: dest }); }
    if (c.hat[p] === 'x') soplo({ dur: 0.03, vol: 0.025, tipo: 'highpass', f0: 7500, t, destino: dest });
    // melodía (tokens de a uno por paso, '-' la sigue)
    const fila = c.melodia[compas % c.melodia.length].split(' ');
    const m = fila[p];
    if (m && m !== '-' && m !== '.') {
      let largo = 1; while (fila[p + largo] === '-') largo++;
      tono({ onda: pulso25, f0: f(m), dur: dPaso * largo * 0.9, vol: 0.05, t, destino: dest, ataque: 0.01 });
    }
  }

  // ── lo de afuera ─────────────────────────────────────────────────────────
  s.despertar = () => {
    if (!ctx && !iniciar()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (!reloj) reloj = setInterval(programar, 25);
  };
  // Un sonido que falla no para el juego, pero se cuenta (la prueba lo mira).
  s.errores = [];
  s.tocar = (nombre, op) => {
    if (!ctx || !ajustes.sonido || ctx.state !== 'running') return;
    if (!SFX[nombre]) { s.errores.push('no existe ' + nombre); return; }
    try { SFX[nombre](op); } catch (e) { s.errores.push(nombre + ': ' + e.message); }
  };
  s.musica = (nombre) => {
    if (nombre === 'mundo') nombre = DE_MUNDO[0];
    if (s.cancion === nombre) return;
    s.cancion = nombre;
    tema = nombre && CANCIONES[nombre] ? nombre : null;
    pasoN = 0;
    if (ctx) proximo = ctx.currentTime + 0.05;
  };
  s.musicaDeMundo = (m) => s.musica(DE_MUNDO[m] || 'mundo0');
  s.aplicar = () => {
    if (!ctx) return;
    const t = ctx.currentTime;
    busSfx.gain.setTargetAtTime(ajustes.sonido ? 0.9 : 0, t, 0.02);
    busMusica.gain.setTargetAtTime(ajustes.musica ? 0.55 : 0, t, 0.05);
  };
  // El rumor de la lava: sube cuanto más cerca está (0 a 1).
  s.lava = (cerca) => {
    if (!ctx) return;
    if (!lavaGan) {
      const n = ctx.createBufferSource(), fl = ctx.createBiquadFilter();
      n.buffer = ruido; n.loop = true; fl.type = 'lowpass'; fl.frequency.value = 180;
      lavaGan = ctx.createGain(); lavaGan.gain.value = 0;
      n.connect(fl); fl.connect(lavaGan); lavaGan.connect(busSfx); n.start();
    }
    lavaGan.gain.setTargetAtTime(Math.max(0, Math.min(1, cerca)) * 0.35, ctx.currentTime, 0.2);
  };
  // La música de la intro de JXSTUDIOS, agendada entera con el reloj del
  // audio para que cada golpe caiga con su cuadro (intro.js › T_*): el
  // corte (soplido), el metal que se escribe (cuatro zumbidos), el golpe
  // (bombo grave + campana de metal: parciales que no son armónicos), el
  // brillo (arpegio), las letras (tics) y un acorde que queda sonando.
  s.jingleJXS = () => {
    if (!ctx || !(ajustes.sonido || ajustes.musica)) return null;
    const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(maestro);
    const t0 = ctx.currentTime + 0.03, tg = t0 + 0.88;
    soplo({ dur: 0.2, vol: 0.12, f0: 700, f1: 5200, q: 1.2, t: t0, destino: bus });
    [0.3, 0.38, 0.46, 0.54].forEach((d, k) => tono({ onda: pulso12, f0: 240 + k * 70, f1: 1300 + k * 240, dur: 0.16, vol: 0.045, t: t0 + d, destino: bus }));
    tono({ onda: 'sine', f0: 115, f1: 30, dur: 0.95, vol: 0.55, t: tg, destino: bus });
    for (const [fr, v, d] of [[523, 0.08, 1.3], [1247, 0.05, 1], [2011, 0.035, 0.75], [3150, 0.025, 0.5], [4430, 0.015, 0.35]]) tono({ onda: 'sine', f0: fr, dur: d, vol: v, t: tg, destino: bus });
    soplo({ dur: 0.4, vol: 0.25, tipo: 'lowpass', f0: 4200, f1: 260, t: tg, destino: bus });
    ['C6', 'E6', 'G6', 'B6', 'D7', 'G7'].forEach((n, k) => tono({ onda: 'triangle', f0: f(n), dur: 0.28, vol: 0.05, t: tg + 0.07 + k * 0.035, destino: bus }));
    for (let k = 0; k < 9; k++) tono({ onda: pulso25, f0: 1320 + (k % 3) * 110, dur: 0.022, vol: 0.04, t: t0 + 1.02 + k * 0.04, destino: bus });
    for (const n of ['C3', 'G3', 'E4', 'B4', 'D5']) tono({ onda: 'triangle', f0: f(n), dur: 1.35, vol: 0.05, t: t0 + 1.1, ataque: 0.25, destino: bus });
    return { cortar: () => bus.gain.setTargetAtTime(0, ctx.currentTime, 0.05) };
  };
  s.activo = () => !!ctx && ctx.state === 'running';
  return s;
}

export const NOMBRES_SFX = ['chispa', 'moneda', 'estrella', 'arranque', 'toc', 'tope', 'romper', 'muerte', 'salida', 'portal', 'flecha', 'poder', 'poderFin', 'escudoRoto', 'escupe', 'boton', 'atras', 'comprar', 'error', 'ganada', 'contar', 'record', 'victoria', 'pasos', 'abrir'];

/* ============================================================================
   zonda/js/musica.js — charango, quena y bombo legüero, sintetizados.
   Las canciones se escriben por compás; los arpegios salen de los acordes
   para no tipear 128 notas a mano. Ritmo de huayno en el bombo: largo-corto-corto.
   ========================================================================== */

/* un compás de 16 pasos por acorde: patron dice qué nota del acorde va en cada paso */
function arpegio(acordes, patron) {
  return acordes.map((a) => { const n = a.split(' '); return patron.map((p) => p === '.' ? '.' : p === '-' ? '-' : n[p % n.length]).join(' '); }).join(' ');
}
function bajos(raices, patron) {
  return raices.map((r) => patron.map((p) => p === 'r' ? r.split(' ')[0] : p === 'q' ? (r.split(' ')[1] || r.split(' ')[0]) : p).join(' ')).join(' ');
}
const P8 = [0, '.', 1, '.', 2, '.', 1, '.', 0, '.', 2, '.', 1, '.', 2, '.'];
const P16 = [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 2, 1, 2];
const HUAYNO = 'X . . x . . x . X . . x . . x .';

Sonido.temas = {
  menu: {
    bpm: 72, pasos: 16, compases: 8, vol: 0.9, hamaca: 0.08,
    pistas: [
      { inst: 'pulsada', vol: 0.2, brillo: 0.35, notas: arpegio(['A3 E4 C5', 'F3 C4 A4', 'C4 G4 E5', 'G3 D4 B4', 'A3 E4 C5', 'F3 C4 A4', 'E3 B3 G#4', 'E3 B3 G#4'], P8) },
      { inst: 'flauta', vol: 0.2, notas:
        'E5 - - - - - D5 - C5 - - - A4 - - - ' + 'C5 - - - D5 - - - E5 - - - - - . . ' +
        'G5 - - - E5 - D5 - E5 - - - - - . . ' + 'D5 - - - B4 - - - G4 - - - . . . . ' +
        'A4 - - - C5 - - - E5 - - - A5 - - - ' + 'G5 - - - E5 - - - C5 - - - D5 - - - ' +
        'B4 - - - - - - - G#4 - - - - - - - ' + 'E4 - - - - - - - . . . . . . . . ' },
      { inst: 'bajo', vol: 0.22, notas: bajos(['A2 E2', 'F2 C3', 'C3 G2', 'G2 D3', 'A2 E2', 'F2 C3', 'E2 B1', 'E2 B1'], ['r', '-', '-', '-', '-', '-', '-', '-', 'q', '-', '-', '-', '-', '-', '-', '-']) },
    ],
  },
  quebrada: {
    bpm: 106, pasos: 16, compases: 8, vol: 0.85, hamaca: 0.06,
    pistas: [
      { inst: 'pulsada', vol: 0.24, brillo: 0.7, notas: arpegio(['A4 C5 E5', 'G4 B4 D5', 'C5 E5 G5', 'E4 G#4 B4', 'A4 C5 E5', 'G4 B4 D5', 'F4 A4 C5', 'E4 G#4 B4'], P8) },
      { inst: 'pulsada', vol: 0.14, brillo: 0.5, notas: arpegio(['A3 E4', 'G3 D4', 'C4 G4', 'E3 B3', 'A3 E4', 'G3 D4', 'F3 C4', 'E3 B3'], ['.', '.', 0, '.', '.', 1, '.', '.', '.', '.', 0, '.', '.', 1, '.', '.']) },
      { inst: 'flauta', vol: 0.2, notas:
        'E5 - - - D5 - C5 - A4 - - - C5 - D5 - ' + 'D5 - - - B4 - D5 - G5 - - - E5 - D5 - ' +
        'E5 - G5 - E5 - D5 - C5 - - - D5 - E5 - ' + 'B4 - - - - - - - . . . . E5 - D5 - ' +
        'C5 - - - D5 - E5 - A5 - - - G5 - E5 - ' + 'D5 - - - E5 - D5 - B4 - - - G4 - A4 - ' +
        'C5 - - - A4 - C5 - F5 - - - E5 - C5 - ' + 'B4 - - - - - - - G#4 - - - B4 - - - ' },
      { inst: 'bajo', vol: 0.26, notas: bajos(['A2 E2', 'G2 D2', 'C3 G2', 'E2 B1', 'A2 E2', 'G2 D2', 'F2 C3', 'E2 B1'], ['r', '-', '-', '.', '.', '.', 'r', '.', 'q', '-', '-', '.', '.', '.', 'q', '.']) },
      { inst: 'bombo', vol: 0.5, notas: HUAYNO },
      { inst: 'platillo', vol: 0.06, notas: '. . x . . . x . . . x . . . x .' },
    ],
  },
  mina: {
    bpm: 76, pasos: 16, compases: 8, vol: 0.85,
    pistas: [
      { inst: 'pulsada', vol: 0.2, brillo: 0.25, notas: arpegio(['D3 A3 F4', 'D3 A3 F4', 'Bb2 F3 D4', 'A2 E3 C#4', 'D3 A3 F4', 'G2 D3 Bb3', 'Bb2 F3 D4', 'A2 E3 C#4'], [0, '.', '.', 1, '.', '.', 2, '.', '.', '.', 1, '.', '.', '.', '.', '.']) },
      { inst: 'bajo', vol: 0.24, notas: bajos(['D2', 'D2', 'Bb1', 'A1', 'D2', 'G1', 'Bb1', 'A1'], ['r', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '.']) },
      { inst: 'campana', vol: 0.06, notas:
        '. . . . . . . . . . . . D6 . . . ' + '. . . . . . A5 . . . . . . . . . ' + '. . . . F5 . . . . . . . . . . . ' + '. . . . . . . . E5 . . . . . . . ' +
        '. . . . . . . . . . . . D6 . . . ' + '. . A5 . . . . . . . . . . . . . ' + '. . . . . . . . F5 . . . . . . . ' + '. . . . . . C#6 . . . . . . . . . ' },
      { inst: 'flauta', vol: 0.12, notas:
        '. . . . . . . . . . . . . . . . ' + 'A4 - - - - - - - F4 - - - - - - - ' + '. . . . . . . . . . . . . . . . ' + 'E4 - - - - - - - C#4 - - - - - - - ' +
        '. . . . . . . . . . . . . . . . ' + 'D5 - - - - - - - Bb4 - - - - - - - ' + '. . . . . . . . . . . . . . . . ' + 'A4 - - - - - - - - - - - - - - - ' },
      { inst: 'bombo', vol: 0.28, notas: 'x . . . . . . . x . . x . . . .' },
    ],
  },
  glaciar: {
    bpm: 88, pasos: 16, compases: 8, vol: 0.8,
    pistas: [
      { inst: 'parche', vol: 0.1, notas: arpegio(['E4', 'C4', 'G4', 'D4', 'E4', 'C4', 'A3', 'B3'], [0, '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-']) },
      { inst: 'parche', vol: 0.08, notas: arpegio(['B4', 'G4', 'D5', 'A4', 'B4', 'G4', 'E4', 'F#4'], [0, '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-']) },
      { inst: 'pulsada', vol: 0.14, brillo: 0.85, notas: arpegio(['E5 G5 B5', 'C5 E5 G5', 'G5 B5 D6', 'D5 F#5 A5', 'E5 G5 B5', 'C5 E5 G5', 'A4 C5 E5', 'B4 D#5 F#5'], P16) },
      { inst: 'flauta', vol: 0.18, notas:
        'B5 - - - - - - - G5 - - - A5 - - - ' + 'G5 - - - E5 - - - - - - - . . . . ' + 'D6 - - - - - - - B5 - - - A5 - G5 - ' + 'F#5 - - - - - - - . . . . . . . . ' +
        'E5 - - - G5 - - - B5 - - - E6 - - - ' + 'D6 - - - B5 - - - G5 - - - . . . . ' + 'A5 - - - G5 - - - E5 - - - C5 - - - ' + 'D#5 - - - - - - - F#5 - - - - - - - ' },
      { inst: 'bajo', vol: 0.18, notas: bajos(['E2', 'C2', 'G2', 'D2', 'E2', 'C2', 'A1', 'B1'], ['r', '-', '-', '-', '-', '-', '-', '-', 'r', '-', '-', '-', '-', '-', '-', '-']) },
    ],
  },
  cumbre: {
    bpm: 124, pasos: 16, compases: 8, vol: 0.85, hamaca: 0.04,
    pistas: [
      { inst: 'pulsada', vol: 0.2, brillo: 0.8, notas: arpegio(['A4 C5 E5', 'F4 A4 C5', 'C5 E5 G5', 'G4 B4 D5', 'A4 C5 E5', 'F4 A4 C5', 'E4 G#4 B4', 'E4 G#4 B4'], P16) },
      { inst: 'flauta', vol: 0.22, notas:
        'A5 - - - G5 - E5 - D5 - E5 - - - . . ' + 'C5 - - - D5 - E5 - F5 - E5 - C5 - - - ' + 'E5 - G5 - - - E5 - D5 - - - C5 - D5 - ' + 'B4 - - - - - - - D5 - - - G5 - - - ' +
        'A5 - - - C6 - - - B5 - A5 - G5 - E5 - ' + 'F5 - - - E5 - D5 - C5 - - - A4 - C5 - ' + 'B4 - - - - - - - E5 - - - G#5 - - - ' + 'B5 - - - - - - - - - - - . . . . ' },
      { inst: 'bajo', vol: 0.28, notas: bajos(['A2 E3', 'F2 C3', 'C3 G2', 'G2 D3', 'A2 E3', 'F2 C3', 'E2 B2', 'E2 B2'], ['r', '.', 'r', '.', 'q', '.', 'r', '.', 'r', '.', 'r', '.', 'q', '.', 'q', '.']) },
      { inst: 'bombo', vol: 0.55, notas: 'X . . x . . x . X . x . X . . x' },
      { inst: 'caja', vol: 0.16, notas: '. . . . X . . . . . . . X . . x' },
      { inst: 'platillo', vol: 0.07, notas: 'x . x . x . x . x . x . x . x .' },
    ],
  },
  final: {
    bpm: 84, pasos: 16, compases: 8, vol: 0.9,
    pistas: [
      { inst: 'pulsada', vol: 0.2, brillo: 0.6, notas: arpegio(['C4 G4 E5', 'G3 D4 B4', 'A3 E4 C5', 'F3 C4 A4', 'C4 G4 E5', 'G3 D4 B4', 'F3 C4 A4', 'G3 D4 B4'], P8) },
      { inst: 'flauta', vol: 0.22, notas:
        'G5 - - - E5 - - - C5 - - - D5 - E5 - ' + 'D5 - - - B4 - - - G4 - - - . . . . ' + 'C5 - - - E5 - - - A5 - - - G5 - E5 - ' + 'F5 - - - - - - - C5 - - - . . . . ' +
        'G5 - - - C6 - - - B5 - - - G5 - - - ' + 'A5 - - - G5 - - - D5 - - - E5 - - - ' + 'F5 - - - E5 - - - D5 - - - C5 - - - ' + 'D5 - - - - - - - G5 - - - - - - - ' },
      { inst: 'campana', vol: 0.05, notas: 'C6 . . . . . . . . . . . . . . . . . . . G5 . . . . . . . . . . . E6 . . . . . . . . . . . . . . . . . . . C6 . . . . . . . . . . .' },
      { inst: 'bajo', vol: 0.22, notas: bajos(['C3', 'G2', 'A2', 'F2', 'C3', 'G2', 'F2', 'G2'], ['r', '-', '-', '-', '-', '-', '-', '-', 'r', '-', '-', '-', '-', '-', '-', '-']) },
      { inst: 'bombo', vol: 0.3, notas: 'X . . . . . . . x . . . . . . .' },
    ],
  },
};

Sonido.ambientes = {
  quebrada: { f: 520, q: 0.7, lfo: 0.07, barrido: 0.5, vol: 0.05 },
  mina: { f: 180, q: 0.6, lfo: 0.05, barrido: 0.3, vol: 0.06, filtro: 'lowpass' },
  glaciar: { f: 1300, q: 1.6, lfo: 0.09, barrido: 0.4, vol: 0.045 },
  cumbre: { f: 480, q: 0.5, lfo: 0.13, barrido: 0.7, vol: 0.12 },
  amanecer: { f: 700, q: 0.8, lfo: 0.05, barrido: 0.3, vol: 0.03 },
};

/* los efectos: cortos, y cada uno con su timbre para que se entienda sin mirar */
Sonido.recetas = {
  salto(S, t) { S.osc('square', 330, t, 0.09, 0.07, null, { f1: 560, ataque: 0.002 }); S.ruidoFiltrado(t, 0.04, 0.06, null, { f0: 2400, q: 1 }); },
  saltoPared(S, t) { S.osc('square', 300, t, 0.1, 0.07, null, { f1: 520 }); S.ruidoFiltrado(t, 0.07, 0.1, null, { f0: 1800, f1: 900, q: 1.2 }); },
  super(S, t) { S.osc('sawtooth', 220, t, 0.18, 0.07, null, { f1: 660 }); S.ruidoFiltrado(t, 0.16, 0.14, null, { f0: 3000, f1: 700, q: 0.8 }); },
  hiper(S, t) { S.recetas.super(S, t); },
  rebote(S, t) { S.osc('square', 420, t, 0.12, 0.08, null, { f1: 820 }); },
  dash(S, t) { S.ruidoFiltrado(t, 0.2, 0.26, null, { f0: 3600, f1: 500, q: 0.9, eco: true }); S.osc('square', 196, t, 0.14, 0.06, null, { f1: 98 }); },
  aterriza(S, t, o) { const k = lim((o.fuerza || 60) / 240, 0.2, 1); S.ruidoFiltrado(t, 0.07, 0.1 * k + 0.02, null, { tipo: 'lowpass', f0: 500 }); },
  agarra(S, t) { S.ruidoFiltrado(t, 0.035, 0.06, null, { tipo: 'highpass', f0: 2500 }); },
  trepaFin(S, t) { S.ruidoFiltrado(t, 0.05, 0.05, null, { f0: 1500 }); },
  muerte(S, t) {
    S.osc('square', 440, t, 0.5, 0.1, null, { f1: 50, tf: 0.45, eco: true });
    S.ruidoFiltrado(t, 0.35, 0.2, null, { f0: 1200, f1: 200, q: 0.7 });
    S.campana(880, t + 0.02, 0.4, 0.05);
  },
  aparece(S, t) { [523, 659, 784].forEach((f, i) => S.osc('sine', f, t + i * 0.045, 0.12, 0.06, null, { eco: true })); },
  resorte(S, t) { S.osc('sine', 180, t, 0.2, 0.14, null, { f1: 900, tf: 0.12 }); S.osc('triangle', 360, t + 0.02, 0.16, 0.05, null, { vib: [18, 0.05, 0.01] }); },
  cristal(S, t) { S.campana(1319, t, 0.5, 0.09); S.campana(1760, t + 0.05, 0.5, 0.06); },
  cristalVuelve(S, t) { S.campana(1175, t, 0.3, 0.03); },
  recarga(S, t) { S.osc('sine', 988, t, 0.06, 0.03); },
  cartaSigue(S, t) { S.pulsada(1047, t, 0.3, 0.12); S.pulsada(1319, t + 0.06, 0.3, 0.1); },
  carta(S, t) { [784, 988, 1175, 1568].forEach((f, i) => S.flauta(f, t + i * 0.07, 0.22, 0.09)); },
  cruje(S, t) { S.ruidoFiltrado(t, 0.1, 0.1, null, { f0: 900, q: 2 }); },
  derrumbe(S, t) { S.ruidoFiltrado(t, 0.35, 0.18, null, { tipo: 'lowpass', f0: 600, f1: 120 }); },
  vuelve(S, t) { S.ruidoFiltrado(t, 0.08, 0.05, null, { f0: 700 }); },
  romper(S, t) { S.ruidoFiltrado(t, 0.25, 0.3, null, { tipo: 'lowpass', f0: 1400, f1: 200 }); S.osc('square', 120, t, 0.12, 0.08, null, { f1: 60 }); },
  vagoneta(S, t) { S.ruidoFiltrado(t, 0.5, 0.12, null, { f0: 400, f1: 1200, q: 3 }); S.osc('square', 80, t, 0.4, 0.05, null, { f1: 140 }); },
  vagonetaFrena(S, t) { S.osc('square', 150, t, 0.1, 0.12, null, { f1: 70 }); S.ruidoFiltrado(t, 0.12, 0.18, null, { f0: 2400, q: 4 }); },
  crujeHielo(S, t) { S.ruidoFiltrado(t, 0.12, 0.07, null, { tipo: 'highpass', f0: 5000 }); },
  rompeHielo(S, t) { for (let i = 0; i < 4; i++) S.campana(1800 + Math.random() * 1600, t + i * 0.02, 0.2, 0.03); S.ruidoFiltrado(t, 0.15, 0.12, null, { tipo: 'highpass', f0: 3000 }); },
  apacheta(S, t) { S.ruidoFiltrado(t, 0.05, 0.14, null, { f0: 1300, q: 5 }); S.ruidoFiltrado(t + 0.09, 0.05, 0.1, null, { f0: 1500, q: 5 }); },
  cumbre(S, t) { ['C4', 'G4', 'C5', 'E5', 'G5'].forEach((n, i) => S.flauta(frecDe(midiDe(n)), t + i * 0.12, 1.6, 0.1)); },
  rafaga(S, t) { S.ruidoFiltrado(t, 0.9, 0.12, null, { f0: 300, f1: 900, q: 0.8 }); },
  texto(S, t, o) { S.osc('square', o.f || 620, t, 0.025, 0.03); },
  mover(S, t) { S.osc('square', 880, t, 0.03, 0.04); },
  elegir(S, t) { S.osc('square', 660, t, 0.05, 0.05); S.osc('square', 990, t + 0.05, 0.07, 0.05); },
  salida(S, t) { S.ruidoFiltrado(t, 0.3, 0.06, null, { f0: 800, f1: 2400 }); },
};

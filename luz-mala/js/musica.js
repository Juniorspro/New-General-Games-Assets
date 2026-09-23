/* ============================================================================
   luz-mala/js/musica.js — el Chaco suena a chamamé: guitarra con bordoneo
   (el bajo en el uno, el acorde en el dos y el tres) y acordeón. Adentro del
   quebracho la música se vuelve cueva: arpa grave, campanas que gotean,
   parches de fondo. Los jefes van con bajo que corre y parche encima.
   Todo en compases de 3/4 con 12 pasos (semicorcheas), salvo los jefes.
   ========================================================================== */

/* un compás por acorde: el patrón dice qué nota del acorde va en cada paso */
function arpegioLM(acordes, patron) {
  return acordes.map((a) => { const n = a.split(' '); return patron.map((p) => p === '.' ? '.' : p === '-' ? '-' : n[p % n.length]).join(' '); }).join(' ');
}
const BORDONEO = [0, '-', '-', '.', 1, '.', 2, '.', 1, '.', 2, '.'];     // bajo, y el acorde en el 2 y el 3
const ARPA12 = [0, '.', 1, '.', 2, '.', 3, '.', 2, '.', 1, '.'];
const LLANO12 = [0, '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-'];

Sonido.temas = {
  titulo: {
    bpm: 66, pasos: 12, compases: 8, vol: 0.9, hamaca: 0.05,
    pistas: [
      { inst: 'pulsada', vol: 0.16, brillo: 0.3, notas: arpegioLM(['D3 A3 D4 F4', 'Bb2 F3 Bb3 D4', 'C3 G3 C4 E4', 'A2 E3 A3 C#4', 'D3 A3 D4 F4', 'G2 D3 G3 Bb3', 'Bb2 F3 Bb3 D4', 'A2 E3 A3 C#4'], ARPA12) },
      { inst: 'flauta', vol: 0.17, notas:
        'A4 - - - - - F4 - - - E4 - ' + 'D4 - - - - - - - - - . . ' + 'E4 - - - G4 - - - C5 - - - ' + 'A4 - - - - - - - - - . . ' +
        'F4 - - - A4 - - - D5 - - - ' + 'D5 - - - C5 - Bb4 - - - A4 - ' + 'G4 - - - F4 - - - D4 - - - ' + 'E4 - - - - - - - - - - - ' },
      { inst: 'parche', vol: 0.07, notas: arpegioLM(['D3', 'Bb2', 'C3', 'A2', 'D3', 'G2', 'Bb2', 'A2'], LLANO12) },
      { inst: 'bajo', vol: 0.16, notas: arpegioLM(['D2', 'Bb1', 'C2', 'A1', 'D2', 'G1', 'Bb1', 'A1'], [0, '-', '-', '-', '-', '-', '.', '.', '.', '.', '.', '.']) },
    ],
  },
  pueblo: {
    bpm: 104, pasos: 12, compases: 8, vol: 0.85, hamaca: 0.07,
    pistas: [
      { inst: 'pulsada', vol: 0.2, brillo: 0.55, notas: arpegioLM(['G2 B3 D4', 'D2 A3 C4', 'G2 B3 D4', 'C3 C4 E4', 'G2 B3 D4', 'D2 F#3 C4', 'G2 B3 D4', 'D2 A3 D4'], BORDONEO) },
      { inst: 'parche', vol: 0.12, notas:
        'D5 - - - B4 - - - G4 - A4 - ' + 'C5 - - - - - - - A4 - - - ' + 'B4 - - - D5 - - - G5 - - - ' + 'E5 - - - - - - - C5 - - - ' +
        'D5 - - - G5 - - - F#5 - E5 - ' + 'D5 - - - C5 - - - A4 - - - ' + 'B4 - - - A4 - - - G4 - B4 - ' + 'A4 - - - - - - - . . . . ' },
      /* el acordeón va en terceras, como en el chamamé: la segunda voz, una tercera abajo en Sol */
      { inst: 'parche', vol: 0.07, notas:
        'B4 - - - G4 - - - E4 - F#4 - ' + 'A4 - - - - - - - F#4 - - - ' + 'G4 - - - B4 - - - E5 - - - ' + 'C5 - - - - - - - A4 - - - ' +
        'B4 - - - E5 - - - D5 - C5 - ' + 'B4 - - - A4 - - - F#4 - - - ' + 'G4 - - - F#4 - - - E4 - G4 - ' + 'F#4 - - - - - - - . . . . ' },
      { inst: 'bajo', vol: 0.18, notas: arpegioLM(['G2', 'D2', 'G2', 'C2', 'G2', 'D2', 'G2', 'D2'], [0, '-', '-', '.', '.', '.', '.', '.', 0, '.', '.', '.']) },
    ],
  },
  raices: {
    bpm: 70, pasos: 12, compases: 8, vol: 0.85,
    pistas: [
      { inst: 'pulsada', vol: 0.18, brillo: 0.2, notas: arpegioLM(['A2 E3 A3', 'A2 E3 A3', 'F2 C3 F3', 'E2 B2 E3', 'A2 E3 A3', 'D2 A2 D3', 'F2 C3 F3', 'E2 B2 G#3'], [0, '.', '.', 1, '.', '.', 2, '.', '.', 1, '.', '.']) },
      { inst: 'bajo', vol: 0.2, notas: arpegioLM(['A1', 'A1', 'F1', 'E1', 'A1', 'D1', 'F1', 'E1'], LLANO12) },
      { inst: 'campana', vol: 0.05, notas:
        '. . . . . . . . E6 . . . ' + '. . . . . . C6 . . . . . ' + '. . . A5 . . . . . . . . ' + '. . . . . . . . . . B5 . ' +
        '. . . . . . . . E6 . . . ' + '. . F5 . . . . . . . . . ' + '. . . . . . . . A5 . . . ' + '. . . . . G#5 . . . . . . ' },
      { inst: 'flauta', vol: 0.12, notas:
        '. . . . . . . . . . . . ' + 'E5 - - - - - C5 - - - - - ' + '. . . . . . . . . . . . ' + 'B4 - - - - - G#4 - - - - - ' +
        '. . . . . . . . . . . . ' + 'F5 - - - - - D5 - - - - - ' + '. . . . . . . . . . . . ' + 'E5 - - - - - - - - - - - ' },
    ],
  },
  tela: {
    bpm: 80, pasos: 12, compases: 8, vol: 0.8,
    pistas: [
      { inst: 'parche', vol: 0.08, notas: arpegioLM(['E3', 'F3', 'E3', 'D3', 'E3', 'F3', 'G3', 'F3'], LLANO12) },
      { inst: 'parche', vol: 0.05, notas: arpegioLM(['B3', 'C4', 'B3', 'A3', 'B3', 'C4', 'D4', 'C4'], LLANO12) },
      { inst: 'campana', vol: 0.07, notas: arpegioLM(['E5 F5 B5', 'F5 A5 C6', 'E5 G5 B5', 'D5 F5 A5', 'E5 F5 B5', 'F5 A5 C6', 'G5 B5 D6', 'F5 A5 C6'], [0, '.', '.', '.', 1, '.', '.', '.', 2, '.', '.', '.']) },
      { inst: 'flauta', vol: 0.14, notas:
        'B4 - - - - - - - C5 - B4 - ' + 'A4 - - - - - - - . . . . ' + 'G4 - - - A4 - - - B4 - - - ' + 'F4 - - - - - - - . . . . ' +
        'E5 - - - - - - - F5 - E5 - ' + 'C5 - - - - - - - . . . . ' + 'D5 - - - C5 - - - B4 - - - ' + 'F4 - - - - - E4 - - - - - ' },
      { inst: 'bajo', vol: 0.14, notas: arpegioLM(['E1', 'F1', 'E1', 'D1', 'E1', 'F1', 'G1', 'F1'], [0, '-', '-', '-', '-', '-', '-', '-', '.', '.', '.', '.']) },
    ],
  },
  hormiguero: {
    bpm: 96, pasos: 12, compases: 4, vol: 0.85,
    pistas: [
      { inst: 'bajo', vol: 0.22, notas: arpegioLM(['C2 G2 Eb2', 'C2 G2 Eb2', 'Ab1 Eb2 C2', 'G1 D2 B1'], [0, '.', 0, 1, '.', 2, 0, '.', 0, 1, '.', 2]) },
      { inst: 'pulsada', vol: 0.14, brillo: 0.4, notas: arpegioLM(['C4 Eb4 G4', 'C4 Eb4 G4', 'Ab3 C4 Eb4', 'G3 B3 D4'], ['.', '.', 0, '.', 1, '.', '.', '.', 2, '.', 1, '.']) },
      { inst: 'bombo', vol: 0.4, notas: 'X . . x . . X . x . . .' },
      { inst: 'caja', vol: 0.12, notas: '. . . . . . x . . . . x' },
      { inst: 'platillo', vol: 0.05, notas: 'x . x . x . x . x . x .' },
      { inst: 'flauta', vol: 0.1, notas:
        '. . . . . . . . . . . . ' + 'G5 - - - Eb5 - - - C5 - - - ' + '. . . . . . . . . . . . ' + 'D5 - - - B4 - - - G4 - - - ' },
    ],
  },
  jefe: {
    bpm: 138, pasos: 16, compases: 4, vol: 0.9,
    pistas: [
      { inst: 'bajo', vol: 0.26, notas: 'D2 D2 D3 D2 D2 C3 D2 D2 F2 D2 D2 C3 D2 A2 C3 D3 ' + 'Bb1 Bb1 Bb2 Bb1 Bb1 A2 Bb1 Bb1 D2 Bb1 Bb1 A2 Bb1 F2 A2 Bb2 ' + 'C2 C2 C3 C2 C2 Bb2 C2 C2 E2 C2 C2 Bb2 C2 G2 Bb2 C3 ' + 'A1 A1 A2 A1 A1 G2 A1 A1 C#2 A1 A1 G2 A1 E2 G2 A2' },
      { inst: 'bombo', vol: 0.5, notas: 'X . . . x . . . X . . . x . x .' },
      { inst: 'caja', vol: 0.2, notas: '. . . . X . . . . . . . X . . x' },
      { inst: 'platillo', vol: 0.06, notas: 'x x x x x x x x x x x x x x x x' },
      { inst: 'onda', onda: 'square', vol: 0.05, notas:
        'D4 - - - F4 - - - A4 - - - G4 - F4 - ' + 'F4 - - - D4 - - - Bb3 - - - D4 - - - ' + 'E4 - - - G4 - - - C5 - - - Bb4 - A4 - ' + 'A4 - - - - - - - C#4 - - - E4 - - - ' },
      { inst: 'parche', vol: 0.06, notas: 'D4 - - - - - - - - - - - - - - - Bb3 - - - - - - - - - - - - - - - C4 - - - - - - - - - - - - - - - A3 - - - - - - - - - - - - - - -' },
    ],
  },
  reina: {
    bpm: 146, pasos: 16, compases: 4, vol: 0.9,
    pistas: [
      { inst: 'bajo', vol: 0.26, notas: 'C#2 C#2 C#3 C#2 E2 C#2 B2 C#2 C#2 C#3 C#2 G#2 A2 G#2 E2 C#2 ' + 'A1 A1 A2 A1 C#2 A1 G#2 A1 A1 A2 A1 E2 F#2 E2 C#2 A1 ' + 'F#1 F#1 F#2 F#1 A1 F#1 E2 F#1 F#1 F#2 F#1 C#2 D2 C#2 A1 F#1 ' + 'G#1 G#1 G#2 G#1 B1 G#1 F#2 G#1 G#1 G#2 G#1 D#2 E2 D#2 B1 G#1' },
      { inst: 'bombo', vol: 0.55, notas: 'X . . x X . . . X . . x X . x .' },
      { inst: 'caja', vol: 0.22, notas: '. . . . X . . . . . . . X . . X' },
      { inst: 'platillo', vol: 0.07, notas: 'x . x x x . x x x . x x x . x x' },
      { inst: 'parche', vol: 0.09, notas: 'C#4 - - - - - - - E4 - - - - - - - A3 - - - - - - - C#4 - - - - - - - F#3 - - - - - - - A3 - - - - - - - G#3 - - - - - - - B3 - - - - - - -' },
      { inst: 'campana', vol: 0.06, notas: 'C#6 . . . . . . . . . . . . . . . ' + 'A5 . . . . . . . . . . . . . . . ' + 'F#5 . . . . . . . . . . . . . . . ' + 'G#5 . . . . . . . D#6 . . . . . . . ' },
    ],
  },
  final: {
    bpm: 92, pasos: 12, compases: 8, vol: 0.85, hamaca: 0.07,
    pistas: [
      { inst: 'pulsada', vol: 0.2, brillo: 0.6, notas: arpegioLM(['G2 B3 D4', 'E2 B3 E4', 'C3 C4 E4', 'D2 A3 D4', 'G2 B3 D4', 'E2 G3 B3', 'C3 E4 G4', 'D2 F#3 A3'], BORDONEO) },
      { inst: 'flauta', vol: 0.2, notas:
        'B4 - - - D5 - - - G5 - - - ' + 'G5 - - - F#5 - E5 - - - B4 - ' + 'C5 - - - E5 - - - G5 - - - ' + 'F#5 - - - - - - - D5 - - - ' +
        'D5 - - - G5 - - - B5 - - - ' + 'A5 - - - G5 - - - E5 - - - ' + 'E5 - - - D5 - - - C5 - B4 - ' + 'A4 - - - - - - - - - . . ' },
      { inst: 'parche', vol: 0.06, notas: arpegioLM(['G3', 'E3', 'C3', 'D3', 'G3', 'E3', 'C3', 'D3'], LLANO12) },
      { inst: 'bajo', vol: 0.16, notas: arpegioLM(['G2', 'E2', 'C2', 'D2', 'G2', 'E2', 'C2', 'D2'], [0, '-', '-', '.', '.', '.', '.', '.', 0, '.', '.', '.']) },
    ],
  },
};

/* ruido de fondo de cada zona: grillos afuera, goteo en las raíces, viento en
   la tela, el zumbido grave del hormiguero */
Sonido.ambientes = {
  pueblo: { f: 4200, q: 9, vol: 0.018, lfo: 0.6, barrido: 0.15 },
  raices: { f: 380, q: 0.7, vol: 0.05, lfo: 0.07 },
  tela: { f: 1400, q: 1.6, vol: 0.03, lfo: 0.11, barrido: 0.6 },
  hormiguero: { f: 160, filtro: 'lowpass', q: 0.8, vol: 0.07, lfo: 0.05 },
};

Sonido.recetas = {
  mover: (S, t) => S.osc('square', 660, t, 0.04, 0.05, null, { f1: 720 }),
  elegir: (S, t) => { S.osc('square', 520, t, 0.06, 0.06); S.osc('square', 780, t + 0.05, 0.09, 0.06); },
  nada: (S, t) => { S.osc('square', 180, t, 0.12, 0.08); S.osc('square', 150, t + 0.1, 0.16, 0.08); },
  texto: (S, t, o) => S.osc('square', o.f || 600, t, 0.028, 0.028),
  salto: (S, t) => { S.osc('triangle', 300, t, 0.1, 0.1, null, { f1: 520 }); S.ruidoFiltrado(t, 0.05, 0.05, null, { f0: 1800, q: 1.2 }); },
  saltoPared: (S, t) => { S.osc('triangle', 360, t, 0.1, 0.1, null, { f1: 640 }); S.ruidoFiltrado(t, 0.07, 0.1, null, { tipo: 'highpass', f0: 2000 }); },
  aterriza: (S, t, o) => S.ruidoFiltrado(t, 0.07, lim((o.fuerza || 0) / 1200, 0.03, 0.22), null, { tipo: 'lowpass', f0: 520 }),
  golpe: (S, t) => S.ruidoFiltrado(t, 0.11, 0.2, null, { tipo: 'bandpass', f0: 3200, f1: 900, q: 1.4 }),
  pega: (S, t) => { S.osc('square', 190, t, 0.06, 0.13, null, { f1: 90 }); S.ruidoFiltrado(t, 0.05, 0.18, null, { tipo: 'highpass', f0: 2600 }); },
  pegaJefe: (S, t) => { S.osc('square', 150, t, 0.08, 0.16, null, { f1: 70 }); S.ruidoFiltrado(t, 0.08, 0.22, null, { tipo: 'bandpass', f0: 1800, q: 2 }); },
  pogo: (S, t) => { S.osc('triangle', 400, t, 0.12, 0.13, null, { f1: 820 }); S.ruidoFiltrado(t, 0.04, 0.12, null, { tipo: 'highpass', f0: 3000 }); },
  pogoEspina: (S, t) => S.osc('square', 1600, t, 0.04, 0.05, null, { f1: 1200 }),
  dash: (S, t) => { S.ruidoFiltrado(t, 0.2, 0.2, null, { tipo: 'bandpass', f0: 700, f1: 3400, q: 2.2 }); S.osc('sine', 220, t, 0.16, 0.06, null, { f1: 440 }); },
  bloqueo: (S, t) => { S.osc('square', 1300, t, 0.07, 0.1, null, { f1: 950 }); S.osc('square', 1900, t, 0.05, 0.05); },
  dano: (S, t) => { S.osc('sawtooth', 240, t, 0.26, 0.2, null, { f1: 60 }); S.ruidoFiltrado(t, 0.22, 0.28, null, { tipo: 'lowpass', f0: 1400, f1: 180 }); },
  muere: (S, t) => { for (let i = 0; i < 5; i++) S.campana(880 / (1 + i * 0.25), t + i * 0.14, 1, 0.08); S.ruidoFiltrado(t, 1.4, 0.2, null, { tipo: 'lowpass', f0: 2200, f1: 90 }); },
  vuelve: (S, t) => S.osc('sine', 820, t, 0.3, 0.07, null, { f1: 300 }),
  curaEmpieza: (S, t) => S.osc('sine', 320, t, 0.9, 0.05, null, { f1: 960, ataque: 0.35 }),
  cura: (S, t) => { S.campana(1046, t, 0.9, 0.12); S.campana(1568, t + 0.07, 0.9, 0.08); },
  curaCorta: (S, t) => S.osc('sine', 520, t, 0.1, 0.05, null, { f1: 260 }),
  ambar: (S, t) => S.campana(1760 + Math.random() * 500, t, 0.22, 0.04),
  terron: (S, t, o) => { S.ruidoFiltrado(t, 0.08, 0.2, null, { tipo: 'bandpass', f0: 3200, q: 3 }); S.campana(o.fin ? 990 : 1320, t, 0.4, 0.06); },
  rompe: (S, t) => { S.ruidoFiltrado(t, 0.4, 0.35, null, { tipo: 'lowpass', f0: 1900, f1: 180 }); S.bombo(t, 0.4); },
  bala: (S, t) => S.osc('square', 320, t, 0.05, 0.05, null, { f1: 120 }),
  bichoMuere: (S, t) => { S.ruidoFiltrado(t, 0.14, 0.18, null, { f0: 1100, f1: 320 }); S.campana(1318, t + 0.02, 0.3, 0.04); },
  banco: (S, t) => { [523, 659, 784, 1046].forEach((f, i) => S.campana(f, t + i * 0.09, 1.3, 0.08)); },
  habla: (S, t) => S.osc('square', 880, t, 0.05, 0.05, null, { f1: 1100 }),
  chispaExtra: (S, t) => { [784, 988, 1175, 1568, 1976].forEach((f, i) => S.campana(f, t + i * 0.08, 1.2, 0.09)); },
  hallazgo: (S, t) => { [392, 523, 659, 784].forEach((f, i) => S.campana(f, t + i * 0.12, 1.6, 0.1)); S.osc('sine', 196, t, 1.8, 0.1, null, { ataque: 0.3 }); },
  farol: (S, t) => { [392, 494, 587, 784, 988].forEach((f, i) => S.campana(f, t + i * 0.15, 2.8, 0.11)); S.osc('sine', 98, t, 3.2, 0.14, null, { ataque: 0.6 }); },
  sombra: (S, t) => { [659, 784, 988].forEach((f, i) => S.campana(f, t + i * 0.1, 1, 0.08)); },
  compra: (S, t) => { S.campana(1318, t, 0.5, 0.1); S.campana(1760, t + 0.08, 0.6, 0.1); },
  puerta: (S, t) => { S.bombo(t, 0.6); S.ruidoFiltrado(t, 0.6, 0.3, null, { tipo: 'lowpass', f0: 420, f1: 80 }); },
  abre: (S, t) => { S.ruidoFiltrado(t, 1.0, 0.22, null, { tipo: 'lowpass', f0: 300, f1: 1200 }); S.campana(523, t + 0.4, 1.2, 0.07); },
  rugido: (S, t) => { S.ruidoFiltrado(t, 1.1, 0.34, null, { tipo: 'lowpass', f0: 650, f1: 140, q: 4 }); S.osc('sawtooth', 72, t, 1.1, 0.16, null, { f1: 44, vib: [9, 0.12, 0.1] }); },
  aviso: (S, t) => S.osc('square', 1450, t, 0.05, 0.05),
  carga: (S, t) => S.ruidoFiltrado(t, 0.6, 0.24, null, { tipo: 'lowpass', f0: 320, q: 2 }),
  choca: (S, t) => { S.bombo(t, 0.9); S.ruidoFiltrado(t, 0.5, 0.35, null, { tipo: 'lowpass', f0: 900, f1: 120 }); },
  tierra: (S, t) => { S.bombo(t, 0.7); S.ruidoFiltrado(t, 0.3, 0.24, null, { tipo: 'lowpass', f0: 700, f1: 100 }); },
  saltoJefe: (S, t) => S.osc('sawtooth', 90, t, 0.3, 0.12, null, { f1: 210 }),
  cornada: (S, t) => S.ruidoFiltrado(t, 0.16, 0.25, null, { f0: 1900, f1: 500, q: 1.5 }),
  escupe: (S, t) => S.ruidoFiltrado(t, 0.13, 0.18, null, { f0: 1100, f1: 3200, q: 4 }),
  crias: (S, t) => { for (let i = 0; i < 3; i++) S.osc('square', 2400 + i * 300, t + i * 0.05, 0.03, 0.03); },
  oleada: (S, t) => { for (let i = 0; i < 6; i++) S.ruidoFiltrado(t + i * 0.06, 0.04, 0.1, null, { tipo: 'highpass', f0: 3000 }); },
  jefeFase: (S, t) => { S.osc('sawtooth', 110, t, 0.9, 0.15, null, { f1: 55 }); S.campana(220, t, 1.6, 0.12); S.campana(233, t + 0.05, 1.6, 0.08); },
  jefeMuere: (S, t) => { S.ruidoFiltrado(t, 2.2, 0.4, null, { tipo: 'lowpass', f0: 3000, f1: 80 }); [262, 330, 392, 523].forEach((f, i) => S.campana(f, t + 0.4 + i * 0.22, 2.6, 0.11)); },
  rocaCae: (S, t) => S.ruidoFiltrado(t, 0.22, 0.2, null, { tipo: 'lowpass', f0: 620, f1: 120 }),
  zumbido: (S, t) => S.osc('sawtooth', 430, t, 0.32, 0.04, null, { vib: [38, 0.05, 0.02] }),
  grilloSalta: (S, t) => { S.osc('square', 2300, t, 0.04, 0.03, null, { f1: 3100 }); S.osc('square', 2600, t + 0.05, 0.04, 0.03); },
  hormigaCarga: (S, t) => S.ruidoFiltrado(t, 0.3, 0.12, null, { tipo: 'bandpass', f0: 600, q: 3 }),
  aranaCae: (S, t) => S.osc('sine', 1200, t, 0.2, 0.04, null, { f1: 400 }),
  gota: (S, t) => S.campana(1800 + Math.random() * 900, t, 0.5, 0.025),
};

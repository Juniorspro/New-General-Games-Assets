/* ============================================================================
   La intro de JXSTUDIOS vestida de filete: la misma coreografía que la de La
   Cripta (motor2d/intro-jxs.js), pero el monograma es de oro pintado con su
   sombra roja corrida, el fondo es laca negra con marco y perlitas, las
   esquinas brotan en volutas, el golpe hace florecer flores alrededor, JXSTUDIOS
   sale sobre una cinta celeste y la música es un golpe de bandoneón con su
   "chan-chan" de tango al final.
   ========================================================================== */

let ESQ = null;
function esquinas(t) {
  if (!ESQ || ESQ.t !== t) { const a = adornoEsquina(t); ESQ = { t, c: [a, espejar(a, true, false), espejar(a, false, true), espejar(a, true, true)] }; }
  return ESQ.c;
}
const ESTILO_FILETE = {
  negro: K,
  metal: ['#fff6c0', '#ffe27a', '#ffcf3a', '#ffb52a', '#f0961e', '#ffd560', '#e0a020', '#b06a14'],
  filo: '#ffffff', bisel: '#8a3a10', borde: '#0d0b10',
  sombra: { dx: 3, dy: 3, col: '#c8202c' },
  palabra: { col: '#fff2a8', borde: '#0d0b10' },
  presenta: '#f4e8cc',
  puntas: ['#e8323e', '#2fb04e', '#2f6ae0', '#ffc83a', '#fff8ec'],
  golpe: ['#e8323e', '#ff8a8a', '#2fb04e', '#9af07a', '#2f6ae0', '#ffc83a', '#fff8ec', '#ff5aa0'],
  destello: 'rgba(255,236,190,0.8)',
  fondo(Wf, Hf, cx, cy) {
    const c = fondoLaca(Wf, Hf), g = c.getContext('2d');
    // la lámpara sobre el cartel
    for (let r = 90; r > 0; r -= 6) { g.fillStyle = 'rgba(255,200,120,0.018)'; disco(g, cx, cy, r, 'rgba(255,200,120,0.02)'); }
    // marco de filete en el borde de la pantalla
    const m = 6;
    g.fillStyle = F.oroOsc; g.fillRect(m, m, Wf - 2 * m, 1); g.fillRect(m, Hf - m - 1, Wf - 2 * m, 1); g.fillRect(m, m, 1, Hf - 2 * m); g.fillRect(Wf - m - 1, m, 1, Hf - 2 * m);
    g.fillStyle = F.rojo; g.fillRect(m + 3, m + 3, Wf - 2 * m - 6, 1); g.fillRect(m + 3, Hf - m - 4, Wf - 2 * m - 6, 1); g.fillRect(m + 3, m + 3, 1, Hf - 2 * m - 6); g.fillRect(Wf - m - 4, m + 3, 1, Hf - 2 * m - 6);
    for (let x = m + 8; x < Wf - m - 6; x += 7) { punto(g, x, m + 1, F.oroClaro); punto(g, x, Hf - m - 2, F.oroClaro); }
    for (let y = m + 8; y < Hf - m - 6; y += 7) { punto(g, m + 1, y, F.oroClaro); punto(g, Wf - m - 2, y, F.oroClaro); }
    return c;
  },
  antes(g, t, I) {
    // las esquinas brotan girando y se asientan con rebote
    const p = clamp((t - 0.12) / 0.5, 0, 1);
    if (p > 0) {
      const tam = Math.round(52 * rebote(p)), E = esquinas(52);
      if (tam > 2) {
        g.drawImage(E[0], 2, 2, tam, tam); g.drawImage(E[1], I.W - 2 - tam, 2, tam, tam);
        g.drawImage(E[2], 2, I.H - 2 - tam, tam, tam); g.drawImage(E[3], I.W - 2 - tam, I.H - 2 - tam, tam, tam);
      }
    }
    // dos volutas que abrazan el monograma
    const q = clamp((t - 0.35) / 0.5, 0, 1);
    if (q > 0) {
      const r = 14 * rebote(q);
      if (r > 1.5) {
        voluta(g, I.cx - I.ancho * 0.62, I.cy + 4, r, 1.2, 1, [F.verde, F.verdeClaro, F.verdeOsc], 2.6, Math.PI * 0.2);
        voluta(g, I.cx + I.ancho * 0.62, I.cy + 4, r, 1.2, -1, [F.verde, F.verdeClaro, F.verdeOsc], 2.6, Math.PI * 0.8);
      }
    }
  },
  palabraFondo(g, t, I) {
    // la cinta celeste se despliega desde el centro
    const p = clamp((t - 0.98) / 0.22, 0, 1), w = Math.round(124 * rebote(p));
    if (w > 4) cinta(g, I.cx - w / 2, I.yPalabra - 5, w, 22, F.azul, F.azulOsc);
  },
  despues(g, t, I) {
    // en el golpe florecen cinco flores en arco, arriba del monograma
    if (t < 0.88) return;
    const p = clamp((t - 0.88) / 0.35, 0, 1), cols = [[F.rojo, '#ff9a9a', F.rojoOsc], [F.celeste, '#d0f4ff', F.azulOsc], ['#ffc83a', '#fff2a0', '#b07410']];
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (-0.92 + i * 0.21), rx = I.ancho * 0.66, ry = I.ancho * 0.44;
      const r = 5.5 * rebote(p);
      if (r > 1) flor(g, I.cx + Math.cos(a) * rx, I.cy + Math.sin(a) * ry, r, cols[i % 3]);
    }
  },
  jingle(ctx, bus, t0, tg, h) {
    const { tono, soplo, T } = h, hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    soplo(0.3, 0.1, 'bandpass', 400, 3000, t0);                                       // el pincel que barre
    [0.3, 0.42, 0.54, 0.66, 0.78].forEach((d) => soplo(0.06, 0.06, 'bandpass', 2500 + d * 2000, 4000, t0 + d));
    tono('sine', 110, 40, 0.8, 0.5, tg);                                               // el golpe: contrabajo
    for (const m of [50, 53, 57, 62]) { tono('sawtooth', hz(m), 0, 0.5, 0.045, tg); tono('sawtooth', hz(m) * 1.004, 0, 0.5, 0.04, tg); }
    [74, 77, 81, 86, 89].forEach((m, k) => tono('triangle', hz(m), 0, 0.3, 0.05, tg + 0.08 + k * 0.04));
    for (let k = 0; k < 9; k++) tono('square', 1200 + (k % 3) * 100, 0, 0.02, 0.025, t0 + T.T_LETRAS + k * 0.04);
    // el chan-chan
    for (const m of [57, 61, 64, 67]) tono('sawtooth', hz(m), 0, 0.13, 0.045, t0 + 1.62);
    for (const m of [38, 50, 53, 57]) tono('sawtooth', hz(m), 0, 0.3, 0.05, t0 + 1.95);
    tono('sine', 73.4, 50, 0.35, 0.4, t0 + 1.95);
  },
};

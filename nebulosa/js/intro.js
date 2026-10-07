/* ============================================================================
   La intro de JXSTUDIOS en neón: misma coreografía que la de La Cripta, pero
   el monograma es un cartel de tubos sobre una pared de ladrillos mojada. Los
   tubos se prenden de a uno con su parpadeo y zumbido, el golpe lo enciende a
   pleno, se refleja en el piso, JXSTUDIOS se prende en rosa y la música es un
   bajo que cae con un acorde de sintetizador.
   ========================================================================== */

const COL_TUBO = { J: '#ff3ec8', S: '#ff3ec8', A: '#3ef0ff', B: '#3ef0ff' };
const ORDEN_TUBOS = ['J', 'A', 'S', 'B'];
function brilloTubo(id, avance, t, golpe) {
  const k = ORDEN_TUBOS.indexOf(id), umbral = 0.12 + k * 0.2;
  if (golpe) return 1 + Math.sin(t * 9 + k) * 0.06;
  if (avance < umbral) return 0;
  const d = avance - umbral;
  if (d < 0.12) return Math.random() < 0.55 ? 0.9 : 0.1;       // parpadea al prender
  return 0.75;
}
function tubos(g, i, alfa) {
  const G = 14.5 * i.esc;
  for (const capa of [0, 1]) for (const tz of i.TRAZOS) {
    if (tz.capa !== capa) continue;
    const p = i.camino2d(tz, i.esc, i.x0, i.y0), b = brilloTubo(tz.id, i.avance, i.t, i.golpe) * alfa, col = COL_TUBO[tz.id];
    g.lineCap = 'round'; g.lineJoin = 'round';
    // el tubo apagado (siempre se ve el vidrio)
    g.globalAlpha = alfa; g.strokeStyle = 'rgba(90,70,120,0.55)'; g.lineWidth = G * 0.5; g.stroke(p);
    if (b > 0.05) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.16 * b; g.strokeStyle = col; g.lineWidth = G * 2.6; g.stroke(p);
      g.globalAlpha = 0.32 * b; g.lineWidth = G * 1.3; g.stroke(p);
      g.globalAlpha = Math.min(1, b); g.lineWidth = G * 0.55; g.stroke(p);
      g.globalAlpha = Math.min(1, b) * 0.9; g.strokeStyle = '#ffffff'; g.lineWidth = G * 0.2; g.stroke(p);
      g.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = 1;
  }
}
const ESTILO_NEON = {
  negro: '#07040f',
  chispa: 1.6,
  anchoLogo: (Wl) => Math.round(Wl * 0.66),
  puntas: ['#ffffff', '#9ff8ff', '#ff9ae8'],
  golpe: ['#3ef0ff', '#ff3ec8', '#ffffff', '#b46aff', '#ffd84a'],
  destello: 'rgba(255,90,220,0.4)',
  fondo(Wl, Hl) {
    const [c, g] = lienzoHD(Wl, Hl), r = rngSemilla(21);
    const gr = g.createLinearGradient(0, 0, 0, Hl); gr.addColorStop(0, '#0c0618'); gr.addColorStop(0.7, '#150a26'); gr.addColorStop(1, '#05030a');
    g.fillStyle = gr; g.fillRect(0, 0, Wl, Hl);
    // la pared de ladrillos
    const piso = Hl * 0.72;
    for (let y = 0, f = 0; y < piso; y += 15, f++) for (let x = (f % 2) * -18; x < Wl; x += 36) {
      const v = 18 + Math.floor(r() * 12);
      g.fillStyle = 'rgb(' + (v + 8) + ',' + Math.floor(v * 0.6) + ',' + (v + 16) + ')';
      g.fillRect(x + 1, y + 1, 34, 13);
    }
    const vi = g.createRadialGradient(Wl / 2, Hl * 0.42, 20, Wl / 2, Hl * 0.42, Hl * 0.7);
    vi.addColorStop(0, 'rgba(0,0,0,0)'); vi.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.fillStyle = vi; g.fillRect(0, 0, Wl, Hl);
    // el piso mojado
    const pi = g.createLinearGradient(0, piso, 0, Hl); pi.addColorStop(0, '#120a20'); pi.addColorStop(1, '#030206');
    g.fillStyle = pi; g.fillRect(0, piso, Wl, Hl - piso);
    g.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 40; i++) g.fillRect(r() * Wl, piso + r() * (Hl - piso), 10 + r() * 30, 1);
    return c;
  },
  logo(g, i) {
    // el reflejo en el piso mojado, después el cartel
    const piso = i.y0 + i.ancho * 0.49 + 70;
    g.save(); g.translate(0, piso * 2); g.scale(1, -1); tubos(g, i, 0.18); g.restore();
    tubos(g, i, 1);
  },
  letras(g, parte, I, t, y) {
    const tam = 26, total = medir(g, 'JXSTUDIOS', tam), x = I.cx - total / 2;
    texto(g, parte, x, y + 12, { tam, alin: 'left', col: '#ffe0f8', glow: '#ff3ec8', blur: 14 });
    texto(g, parte, x, y + 12, { tam, alin: 'left', col: '#ffffff' });
  },
  presentaTxt(g, txt, I, t, y) { texto(g, txt.toUpperCase(), I.cx, y + 40, { tam: 12, col: '#bff8ff', glow: '#3ef0ff', blur: 10, cursiva: false, peso: '700' }); },
  jingle(ctx, bus, t0, tg, h) {
    const { tono, soplo, T } = h, hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    tono('sawtooth', 60, 0, 1.8, 0.015, t0 + 0.3);                                  // el zumbido del transformador
    [0.38, 0.5, 0.62, 0.74].forEach((d) => { soplo(0.05, 0.12, 'highpass', 3000, 6000, t0 + d); tono('square', 120, 0, 0.06, 0.04, t0 + d); });
    tono('sine', 110, 38, 0.9, 0.55, tg);                                            // la caída del bajo
    for (const m of [57, 60, 64, 69]) { tono('sawtooth', hz(m), 0, 0.7, 0.03, tg); tono('sawtooth', hz(m) * 1.006, 0, 0.7, 0.03, tg); }
    soplo(0.6, 0.18, 'lowpass', 6000, 200, tg);
    for (let k = 0; k < 9; k++) tono('square', 1500 + (k % 3) * 120, 0, 0.025, 0.025, t0 + T.T_LETRAS + k * 0.04);
    for (const m of [45, 57, 64, 71, 76]) tono('triangle', hz(m), 0, 1.3, 0.045, t0 + 1.1, 0.3);
  },
};

/* ============================================================================
   La intro de JXSTUDIOS en Art Déco: misma coreografía que la de La Cripta,
   otro material. La raya de luz abre una pared de laca negra con un abanico de
   rayos de oro; el monograma se escribe en oro pulido (biselado: sombra, cuerpo
   con degradé de oro y filo de luz), en el golpe se prende un marco escalonado
   y los rayos giran. JXSTUDIOS en la letra déco, espaciada. La música: un
   glissando de piano, el platillo que sube y un acorde de big band en el golpe.
   ========================================================================== */

function fondoDeco(Wl, Hl, cx, cy) {
  const [c, f] = lienzoHD(Wl, Hl);
  const gr = f.createRadialGradient(cx, cy, 10, cx, cy, Hl * 0.8); gr.addColorStop(0, '#14261f'); gr.addColorStop(0.6, '#070b0a'); gr.addColorStop(1, '#020303');
  f.fillStyle = gr; f.fillRect(0, 0, Wl, Hl);
  abanico(f, cx, cy, 30, Hl, 0, Math.PI * 2, 72, 0.1);
  for (const r of [110, 116, 190]) { f.strokeStyle = 'rgba(232,184,80,0.18)'; f.lineWidth = 1; f.beginPath(); f.arc(cx, cy, r, 0, Math.PI * 2); f.stroke(); }
  // el marco con las esquinas escalonadas
  f.strokeStyle = 'rgba(232,184,80,0.45)'; f.lineWidth = 1.2;
  for (const m of [14, 20]) {
    f.beginPath(); f.moveTo(m + 14, m); f.lineTo(Wl - m - 14, m); f.lineTo(Wl - m - 14, m + 7); f.lineTo(Wl - m - 7, m + 7); f.lineTo(Wl - m - 7, m + 14); f.lineTo(Wl - m, m + 14);
    f.lineTo(Wl - m, Hl - m - 14); f.lineTo(Wl - m - 7, Hl - m - 14); f.lineTo(Wl - m - 7, Hl - m - 7); f.lineTo(Wl - m - 14, Hl - m - 7); f.lineTo(Wl - m - 14, Hl - m);
    f.lineTo(m + 14, Hl - m); f.lineTo(m + 14, Hl - m - 7); f.lineTo(m + 7, Hl - m - 7); f.lineTo(m + 7, Hl - m - 14); f.lineTo(m, Hl - m - 14);
    f.lineTo(m, m + 14); f.lineTo(m + 7, m + 14); f.lineTo(m + 7, m + 7); f.lineTo(m + 14, m + 7); f.closePath(); f.stroke();
  }
  return c;
}

const ESTILO_DECO = {
  negro: '#020303',
  chispa: 2,
  anchoLogo: (Wl) => Math.round(Wl * 0.64),
  puntas: [ORO_CLARO, '#ffd66a', '#ffffff'],
  golpe: [ORO_CLARO, ORO, '#ffffff', ESM_CLARO],
  destello: 'rgba(255,230,160,0.5)',
  fondo: (Wl, Hl, cx, cy) => fondoDeco(Wl, Hl, cx, cy),
  antes(g, t, I) {
    // después del golpe, los rayos giran despacio y se prende un halo
    if (t < 0.88) return;
    const k = clamp((t - 0.88) / 0.5, 0, 1);
    g.save(); g.translate(I.cx, I.cy); g.rotate((t - 0.88) * 0.25); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; g.fillStyle = 'rgba(255,214,120,' + 0.05 * k + ')'; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - 0.04) * 400, Math.sin(a - 0.04) * 400); g.lineTo(Math.cos(a + 0.04) * 400, Math.sin(a + 0.04) * 400); g.fill(); }
    g.restore();
  },
  logo(g, i) {
    const G = 14.5 * i.esc;
    for (const capa of [0, 1]) for (const tz of i.TRAZOS) {
      if (tz.capa !== capa) continue;
      const p = i.camino2d(tz, i.esc, i.x0, i.y0), l = i.largo(tz) * i.esc;
      g.save();
      if (i.avance < 1) g.setLineDash([Math.max(0.01, l * i.avance), l + 20]);
      g.lineCap = 'butt'; g.lineJoin = 'miter';
      g.strokeStyle = '#1a1204'; g.lineWidth = G + 4; g.stroke(p);
      const gr = g.createLinearGradient(0, i.y0, 0, i.y0 + 172 * i.esc);
      gr.addColorStop(0, ORO_CLARO); gr.addColorStop(0.45, '#f0c45c'); gr.addColorStop(0.5, '#9a6a18'); gr.addColorStop(0.62, '#e0a83c'); gr.addColorStop(1, '#f8dc94');
      g.strokeStyle = gr; g.lineWidth = G; g.stroke(p);
      g.save(); g.translate(-G * 0.18, -G * 0.2); g.strokeStyle = 'rgba(255,250,230,0.75)'; g.lineWidth = G * 0.14; g.stroke(p); g.restore();
      g.restore();
    }
    if (i.golpe) {
      // el marco escalonado que se prende alrededor del monograma
      const k = clamp(i.tGolpe / 0.25, 0, 1), m = 14 + (1 - salida(k)) * 30, x0 = i.x0 - m, y0 = i.y0 - m, w = i.ancho + m * 2, h = 172 * i.esc + m * 2;
      g.save(); g.globalAlpha = k; g.strokeStyle = ORO; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x0 + 10, y0); g.lineTo(x0 + w - 10, y0); g.lineTo(x0 + w - 10, y0 + 5); g.lineTo(x0 + w - 5, y0 + 5); g.lineTo(x0 + w - 5, y0 + 10); g.lineTo(x0 + w, y0 + 10);
      g.lineTo(x0 + w, y0 + h - 10); g.lineTo(x0 + w - 5, y0 + h - 10); g.lineTo(x0 + w - 5, y0 + h - 5); g.lineTo(x0 + w - 10, y0 + h - 5); g.lineTo(x0 + w - 10, y0 + h);
      g.lineTo(x0 + 10, y0 + h); g.lineTo(x0 + 10, y0 + h - 5); g.lineTo(x0 + 5, y0 + h - 5); g.lineTo(x0 + 5, y0 + h - 10); g.lineTo(x0, y0 + h - 10);
      g.lineTo(x0, y0 + 10); g.lineTo(x0 + 5, y0 + 10); g.lineTo(x0 + 5, y0 + 5); g.lineTo(x0 + 10, y0 + 5); g.closePath(); g.stroke();
      g.restore();
    }
  },
  letras(g, parte, I, t, y) {
    const tam = 22, esp = 0.12, total = anchoDeco('JXSTUDIOS', tam, esp), x = I.cx - total / 2;
    textoDeco(g, parte, x, y + 22, tam, { alin: 'left', oro: true, esp, sombra: [1.5, 2] });
  },
  presentaTxt(g, txt, I, t, y) { texto(g, txt.toUpperCase(), I.cx, y + 50, { tam: 10, col: ESM_CLARO, esp: 4 }); },
  jingle(ctx, bus, t0, tg, h) {
    const { tono, soplo, f, T } = h;
    // el platillo que sube hasta el golpe
    soplo(tg - t0, 0.08, 'highpass', 4000, 9000, t0);
    // el glissando de piano en fa
    ['F4', 'A4', 'C5', 'E5', 'F5', 'A5', 'C6', 'E6'].forEach((n, k) => tono('triangle', f(n), 0, 0.5, 0.06, t0 + 0.32 + k * 0.065, 0.003));
    // el golpe: bombo, acorde de big band (fa sexta con novena) y el platillo
    tono('sine', 110, 45, 0.5, 0.6, tg, 0.003);
    for (const n of ['F3', 'A3', 'D4', 'G4', 'C5']) tono('sawtooth', f(n), 0, 1.4, 0.035, tg + 0.01, 0.02);
    soplo(1.2, 0.18, 'highpass', 6000, 3000, tg);
    tono('sine', f('F2'), 0, 1.6, 0.18, tg);
    for (let k = 0; k < 9; k++) tono('sine', 2093 + (k % 3) * 140, 0, 0.03, 0.025, t0 + T.T_LETRAS + k * 0.04);
  },
};

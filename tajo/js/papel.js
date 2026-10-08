/* ============================================================================
   El papel de arroz, el sello rojo (hanko) y el salpicón de tinta: lo que usan
   el fondo, el título y los cortes.
   ========================================================================== */

/* el papel de arroz: tono cálido, fibras, motas y una aguada de montañas en la niebla */
function papelWashi(Wl, Hl, semilla, montes) {
  const [c, g] = lienzoHD(Wl, Hl), r = rngSemilla(semilla || 7);
  const gr = g.createLinearGradient(0, 0, 0, Hl); gr.addColorStop(0, '#f3ead6'); gr.addColorStop(1, '#e8dcc0');
  g.fillStyle = gr; g.fillRect(0, 0, Wl, Hl);
  for (let i = 0; i < 260; i++) {
    const x = r() * Wl, y = r() * Hl, l = 6 + r() * 26, a = r() * Math.PI;
    g.strokeStyle = r() < 0.5 ? 'rgba(120,96,60,0.08)' : 'rgba(255,255,255,0.22)'; g.lineWidth = 0.4 + r() * 0.6;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 6, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 6, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let i = 0; i < 180; i++) { g.fillStyle = 'rgba(90,70,40,' + (0.04 + r() * 0.08) + ')'; g.fillRect(r() * Wl, r() * Hl, 0.8, 0.8); }
  if (montes) {
    // tres capas de montes, cada una más clara y más alta (perspectiva de niebla)
    for (let k = 0; k < 3; k++) {
      const base = Hl * (0.98 - k * 0.07), alto = Hl * (0.16 + k * 0.05), tono = 0.16 - k * 0.045;
      g.beginPath(); g.moveTo(0, Hl);
      for (let x = 0; x <= Wl + 6; x += 6) g.lineTo(x, base - alto * (0.45 + 0.35 * Math.sin(x * 0.011 + k * 2.1 + semilla) + 0.2 * Math.sin(x * 0.037 + k)) );
      g.lineTo(Wl, Hl); g.closePath();
      const m = g.createLinearGradient(0, base - alto, 0, base + 30); m.addColorStop(0, 'rgba(30,24,20,' + tono + ')'); m.addColorStop(1, 'rgba(30,24,20,0)');
      g.fillStyle = m; g.fill();
    }
  }
  // un viñeteado tibio en los bordes, como papel viejo
  const v = g.createRadialGradient(Wl / 2, Hl / 2, Math.min(Wl, Hl) * 0.4, Wl / 2, Hl / 2, Math.max(Wl, Hl) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(110,80,40,0.22)');
  g.fillStyle = v; g.fillRect(0, 0, Wl, Hl);
  return c;
}

/* el sello rojo (hanko): cuadrado de bordes comidos con las letras en blanco */
function hanko(g, x, y, tam, txt, ang, alfa) {
  g.save(); g.translate(x, y); g.rotate(ang || 0); g.globalAlpha = alfa == null ? 1 : alfa;
  const r = rngSemilla(31), s = tam / 2;
  g.fillStyle = BERMELLON; g.beginPath();
  const pts = [];
  for (let i = 0; i < 4; i++) for (let k = 0; k < 6; k++) {
    const e = k / 6, d = (r() - 0.5) * tam * 0.06;
    const [ax, ay, bx, by] = [[-s, -s, s, -s], [s, -s, s, s], [s, s, -s, s], [-s, s, -s, -s]][i];
    pts.push([ax + (bx - ax) * e + (i % 2 ? d : 0), ay + (by - ay) * e + (i % 2 ? 0 : d)]);
  }
  g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(244,234,214,0.9)'; g.lineWidth = tam * 0.05; g.strokeRect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6);
  g.font = 'bold ' + Math.round(tam * (txt.length > 2 ? 0.34 : 0.5)) + 'px ' + SERIF; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#f6eedc'; g.fillText(txt, 0, tam * 0.04);
  // la tinta que no agarró: motas claras
  g.fillStyle = 'rgba(244,234,214,0.55)'; for (let i = 0; i < 14; i++) g.fillRect((r() - 0.5) * tam * 0.9, (r() - 0.5) * tam * 0.9, 1 + r() * 1.5, 1 + r());
  g.restore();
}

/* un salpicón de tinta (gota grande + gotitas en una dirección) */
function salpicon(g, x, y, tam, col, rnd, ang, alfa) {
  g.fillStyle = col; g.globalAlpha = alfa == null ? 1 : alfa;
  g.beginPath();
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2, rr = tam * (0.75 + rnd() * 0.45); i ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
  for (let i = 0; i < 9; i++) {
    const a = (ang == null ? rnd() * Math.PI * 2 : ang + (rnd() - 0.5) * 1.6), d = tam * (1.2 + rnd() * 2.2), rr = tam * (0.08 + rnd() * 0.22);
    g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rr, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}

/* ============================================================================
   El dibujo de la mesa en Art Déco: laca negra y verde esmeralda, rieles de oro
   con su filo de luz, el abanico (sunburst) detrás de los flippers, el
   zigurat escalonado arriba y las lámparas de vidrio que se prenden con brillo.
   Lo quieto se pinta una vez (pintarMesa) y lo que se mueve, cada cuadro.
   ========================================================================== */

function rieles(f, pts, ancho) {
  f.lineCap = 'round'; f.lineJoin = 'round';
  const trazar = () => { f.beginPath(); f.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) f.lineTo(p[0], p[1]); f.stroke(); };
  f.strokeStyle = '#120c03'; f.lineWidth = ancho + 3.5; trazar();
  f.strokeStyle = ORO_OSCURO; f.lineWidth = ancho + 1; trazar();
  f.strokeStyle = ORO; f.lineWidth = ancho - 0.6; trazar();
  f.save(); f.translate(-0.6, -0.7); f.strokeStyle = 'rgba(255,241,194,0.85)'; f.lineWidth = Math.max(0.8, ancho * 0.28); trazar(); f.restore();
}
function abanico(f, cx, cy, r0, r1, a0, a1, n, alfa) {
  for (let i = 0; i <= n; i++) {
    const a = lerp(a0, a1, i / n);
    f.strokeStyle = 'rgba(232,184,80,' + (i % 2 ? alfa * 0.5 : alfa) + ')'; f.lineWidth = i % 2 ? 0.6 : 1.1;
    f.beginPath(); f.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); f.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); f.stroke();
  }
}
function escalonado(f, cx, y, ancho, pasos, alto, alfa) {
  f.strokeStyle = 'rgba(232,184,80,' + alfa + ')'; f.lineWidth = 1.2;
  for (let k = 0; k < 3; k++) {
    const w = ancho - k * 18, x0 = cx - w / 2;
    f.beginPath(); f.moveTo(x0, y + k * 5);
    for (let i = 0; i < pasos; i++) { const sx = x0 + (w / 2) * (i / pasos), sy = y + k * 5 - alto * ((i + 1) / pasos); f.lineTo(sx, sy + alto / pasos); f.lineTo(sx, sy); }
    for (let i = pasos - 1; i >= 0; i--) { const sx = cx + w / 2 - (w / 2) * (i / pasos), sy = y + k * 5 - alto * ((i + 1) / pasos); f.lineTo(sx - (w / 2) / pasos, sy); f.lineTo(sx - (w / 2) / pasos, sy + alto / pasos); }
    f.lineTo(cx + w / 2, y + k * 5); f.stroke();
  }
}
function copaDibujo(f, x, y, s, col) {
  f.strokeStyle = col; f.lineWidth = 1.4; f.lineCap = 'round';
  f.beginPath(); f.moveTo(x - s, y - s * 0.55); f.quadraticCurveTo(x, y + s * 0.5, x + s, y - s * 0.55); f.closePath(); f.stroke();
  f.beginPath(); f.moveTo(x, y + s * 0.05); f.lineTo(x, y + s * 0.85); f.moveTo(x - s * 0.5, y + s * 0.9); f.lineTo(x + s * 0.5, y + s * 0.9); f.stroke();
}

function pintarMesa() {
  const [c, f] = lienzoHD(W, MESA_H);
  // la laca: verde casi negro, más claro al centro
  const fondo = f.createRadialGradient(167, 330, 30, 167, 330, 420);
  fondo.addColorStop(0, '#16302a'); fondo.addColorStop(0.55, '#0b1714'); fondo.addColorStop(1, '#040605');
  f.fillStyle = fondo; f.fillRect(0, 0, W, MESA_H);
  // el gran abanico desde abajo, las líneas finas en cruz y el zigurat arriba
  abanico(f, 167, 600, 40, 560, Math.PI * 1.04, Math.PI * 1.96, 46, 0.07);
  for (const r of [70, 96, 122]) { f.strokeStyle = 'rgba(232,184,80,0.22)'; f.lineWidth = r === 96 ? 2 : 1; f.beginPath(); f.arc(167, 600, r, Math.PI * 1.08, Math.PI * 1.92); f.stroke(); }
  escalonado(f, 190, 160, 190, 4, 24, 0.2);
  // chevrones en los costados
  f.strokeStyle = 'rgba(95,224,180,0.1)'; f.lineWidth = 1;
  for (let k = 0; k < 6; k++) { f.beginPath(); f.moveTo(60, 250 + k * 12); f.lineTo(70, 244 + k * 12); f.lineTo(80, 250 + k * 12); f.stroke(); f.beginPath(); f.moveTo(254, 380 + k * 12); f.lineTo(264, 374 + k * 12); f.lineTo(274, 380 + k * 12); f.stroke(); }
  // el nombre grande, como el arte de las mesas de verdad
  f.globalAlpha = 0.16; textoDeco(f, 'DORADO', 167, 372, 40, { oro: true, esp: 0.08 }); f.globalAlpha = 1;
  f.strokeStyle = 'rgba(232,184,80,0.18)'; f.lineWidth = 1;
  f.beginPath(); f.moveTo(80, 352); f.lineTo(254, 352); f.moveTo(80, 392); f.lineTo(254, 392); f.stroke();
  // los delantales (afuera de las gomas) y el carril del resorte: laca con filetes de oro
  for (const pol of [[[0, 380], [14, 384], [34, 396], [80, 486], [97, 528], [97, 600], [0, 600]], [[320, 384], [300, 396], [254, 486], [237, 528], [237, 600], [320, 600]]]) {
    f.beginPath(); f.moveTo(pol[0][0], pol[0][1]); for (const p of pol) f.lineTo(p[0], p[1]); f.closePath();
    const gr = f.createLinearGradient(0, 380, 0, 600); gr.addColorStop(0, '#0d0e10'); gr.addColorStop(1, '#030304'); f.fillStyle = gr; f.fill();
    f.save(); f.clip(); f.strokeStyle = 'rgba(232,184,80,0.16)'; f.lineWidth = 1;
    for (let k = -10; k < 30; k++) { f.beginPath(); f.moveTo(k * 14, 380); f.lineTo(k * 14 + 220, 600); f.stroke(); }
    f.restore();
  }
  f.fillStyle = '#060607'; f.fillRect(320, 156, 26, 448);
  for (let y = 180; y < 560; y += 22) { f.fillStyle = 'rgba(232,184,80,0.14)'; f.fillRect(326, y, 14, 2); }
  f.fillStyle = 'rgba(0,0,0,0.65)'; f.fillRect(97, 580, 140, 20);
  // la copa: aro déco con la copa de champán
  f.strokeStyle = 'rgba(232,184,80,0.55)'; f.lineWidth = 1.2; f.beginPath(); f.arc(COPA.x, COPA.y, 15, 0, Math.PI * 2); f.stroke();
  f.beginPath(); f.arc(COPA.x, COPA.y, 19, Math.PI * 0.15, Math.PI * 0.85); f.stroke();
  f.fillStyle = '#020303'; f.beginPath(); f.arc(COPA.x, COPA.y, 10, 0, Math.PI * 2); f.fill();
  texto(f, 'LA COPA', COPA.x, COPA.y + 30, { tam: 7, col: 'rgba(244,234,210,0.6)' });
  // el canal de la órbita y la reja de los blancos
  texto(f, 'ÓRBITA', 40, 346, { tam: 6.5, col: 'rgba(244,234,210,0.5)' });
  f.fillStyle = 'rgba(232,184,80,0.12)'; f.fillRect(296, 246, 22, 92);
  // las paredes de oro
  rieles(f, arcoPts(48), 3.5);
  rieles(f, [[14, 170], [14, 384], [34, 396]], 3.5);
  rieles(f, [[80, 486], [97, 528]], 3.5); rieles(f, [[254, 486], [237, 528]], 3.5);
  rieles(f, [[320, 156], [320, 600]], 3.5); rieles(f, [[320, 384], [300, 396]], 3.5); rieles(f, [[346, 170], [346, 604]], 3.5);
  rieles(f, [[46, 222], [66, 330]], 5);
  for (const x of POSTES_CARRIL.slice(0, 4)) rieles(f, [[x, 70], [x, 106]], 6);
  // las letras de los carriles (las lámparas van encima, cada cuadro)
  for (const s of MESA.sensores) if (s.id === 'carril') { f.strokeStyle = 'rgba(232,184,80,0.25)'; f.lineWidth = 1; f.beginPath(); f.moveTo(s.x, 84); f.lineTo(s.x, 110); f.stroke(); }
  // las bases de las gomas: triángulos de laca con filete
  for (const [a, b, cc] of [[[34, 396], [80, 486], [44, 470]], [[300, 396], [254, 486], [290, 470]]]) {
    f.beginPath(); f.moveTo(a[0], a[1]); f.lineTo(b[0], b[1]); f.lineTo(cc[0], cc[1]); f.closePath(); f.fillStyle = '#101113'; f.fill();
    f.strokeStyle = 'rgba(232,184,80,0.45)'; f.lineWidth = 1; f.stroke();
  }
  // etiquetas de las lámparas de abajo
  ['2', '3', '4', '5'].forEach((n, i) => texto(f, '×' + n, 137 + i * 20, 452, { tam: 6, col: 'rgba(244,234,210,0.45)', esp: 0 }));
  return c;
}

/* ------------------------------------------------- lo que se mueve */
function brillo(g, x, y, r, col, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0));
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}
const LUZ = { oro: 'rgba(255,214,120,A)', esm: 'rgba(95,224,180,A)', rubi: 'rgba(240,80,90,A)', marfil: 'rgba(255,248,230,A)' };
/* una lámpara de vidrio: apagada se ve el vidrio oscuro de color; prendida, brilla */
function lampara(g, x, y, forma, tono, prendida, tam) {
  tam = tam || 6;
  const col = { oro: ['#3a2a0c', '#ffe08a'], esm: ['#0d2c22', '#8ff5d0'], rubi: ['#3a0d12', '#ff8a94'], marfil: ['#2a2620', '#fff6dc'] }[tono];
  if (prendida) { g.globalCompositeOperation = 'lighter'; brillo(g, x, y, tam * 3.2, LUZ[tono], 0.45); g.globalCompositeOperation = 'source-over'; }
  g.beginPath();
  if (forma === 'rombo') { g.moveTo(x, y - tam); g.lineTo(x + tam * 0.7, y); g.lineTo(x, y + tam); g.lineTo(x - tam * 0.7, y); }
  else if (forma === 'flecha') { g.moveTo(x, y - tam); g.lineTo(x + tam * 0.8, y + tam * 0.4); g.lineTo(x + tam * 0.3, y + tam * 0.4); g.lineTo(x + tam * 0.3, y + tam); g.lineTo(x - tam * 0.3, y + tam); g.lineTo(x - tam * 0.3, y + tam * 0.4); g.lineTo(x - tam * 0.8, y + tam * 0.4); }
  else g.arc(x, y, tam, 0, Math.PI * 2);
  g.closePath();
  g.fillStyle = prendida ? col[1] : col[0]; g.fill();
  g.strokeStyle = prendida ? '#fff8e6' : 'rgba(232,184,80,0.5)'; g.lineWidth = 0.9; g.stroke();
}
function dibujarHongo(g, c, t) {
  const fl = c.golpe > 0 ? c.golpe / 0.18 : 0;
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.ellipse(c.x + 3, c.y + 5, c.r + 2, c.r * 0.9, 0, 0, Math.PI * 2); g.fill();
  // el aro de oro
  const ar = g.createLinearGradient(c.x, c.y - c.r, c.x, c.y + c.r); ar.addColorStop(0, ORO_CLARO); ar.addColorStop(0.5, ORO); ar.addColorStop(1, ORO_OSCURO);
  g.fillStyle = ar; g.beginPath(); g.arc(c.x, c.y, c.r, 0, Math.PI * 2); g.fill();
  // el sombrero esmeralda con el abanico déco
  const cap = g.createRadialGradient(c.x - 5, c.y - 6, 2, c.x, c.y, c.r * 0.8); cap.addColorStop(0, fl ? '#e9fff6' : '#5fe0b4'); cap.addColorStop(1, fl ? '#7ff0c8' : '#0f5c46');
  g.fillStyle = cap; g.beginPath(); g.arc(c.x, c.y, c.r * 0.74, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,241,194,0.7)'; g.lineWidth = 0.8;
  for (let i = 0; i < 7; i++) { const a = Math.PI * 1.1 + (i / 6) * Math.PI * 0.8; g.beginPath(); g.moveTo(c.x, c.y + 4); g.lineTo(c.x + Math.cos(a) * c.r * 0.66, c.y + 4 + Math.sin(a) * c.r * 0.66); g.stroke(); }
  g.fillStyle = ORO_CLARO; g.beginPath(); g.arc(c.x, c.y + 4, 2.4, 0, Math.PI * 2); g.fill();
  if (fl) { g.globalCompositeOperation = 'lighter'; brillo(g, c.x, c.y, c.r * 2.6, LUZ.esm, 0.6 * fl); g.strokeStyle = 'rgba(255,241,194,' + fl + ')'; g.lineWidth = 2; g.beginPath(); g.arc(c.x, c.y, c.r + (1 - fl) * 14, 0, Math.PI * 2); g.stroke(); g.globalCompositeOperation = 'source-over'; }
}
function dibujarBlanco(g, s, letra) {
  const y = (s.ay + s.by) / 2;
  if (s.caido) { g.fillStyle = '#2a2418'; g.fillRect(s.ax - 2, y - 11, 4, 22); return; }
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(s.ax - 1, y - 10, 7, 22);
  const gr = g.createLinearGradient(s.ax - 4, 0, s.ax + 4, 0); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(1, '#cdbf98');
  g.fillStyle = s.golpe > 0 ? '#fff' : gr; g.fillRect(s.ax - 4, y - 12, 8, 24);
  g.strokeStyle = ORO; g.lineWidth = 1; g.strokeRect(s.ax - 4, y - 12, 8, 24);
  textoDeco(g, letra, s.ax, y, 9, { col: '#5a3a0a' });
}
function dibujarFlipper(g, f) {
  const [dx, dy] = dirFlipper(f), tx = f.px + dx * f.largo, ty = f.py + dy * f.largo, nx = -dy, ny = dx, a = Math.atan2(dy, dx);
  g.beginPath();
  g.arc(f.px, f.py, f.rp, a + Math.PI / 2, a - Math.PI / 2);
  g.lineTo(tx + nx * -f.rt, ty + ny * -f.rt);
  g.arc(tx, ty, f.rt, a - Math.PI / 2, a + Math.PI / 2);
  g.closePath();
  g.save(); g.translate(2, 3); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fill(); g.restore();
  const gr = g.createLinearGradient(f.px + nx * -8, f.py + ny * -8, f.px + nx * 8, f.py + ny * 8); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(1, '#d8c79a');
  g.fillStyle = gr; g.fill();
  g.strokeStyle = '#2a1d0a'; g.lineWidth = 2.4; g.stroke();
  g.strokeStyle = ORO; g.lineWidth = 1.1; g.stroke();
  g.fillStyle = ORO; g.beginPath(); g.arc(f.px, f.py, 3, 0, Math.PI * 2); g.fill();
  g.fillStyle = ORO_OSCURO; g.fillRect(f.px - 2.2, f.py - 0.5, 4.4, 1);
}
function dibujarBola(g, b) {
  for (let i = 0; i < b.rastro.length - 1; i++) { const [x, y] = b.rastro[i]; g.fillStyle = 'rgba(255,214,120,' + (0.05 + i * 0.03) + ')'; g.beginPath(); g.arc(x, y, R_BOLA * (0.5 + i * 0.08), 0, Math.PI * 2); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(b.x + 2.5, b.y + 3.5, R_BOLA, 0, Math.PI * 2); g.fill();
  const gr = g.createRadialGradient(b.x - 3, b.y - 3.5, 0.5, b.x, b.y, R_BOLA * 1.05);
  gr.addColorStop(0, '#fffdf2'); gr.addColorStop(0.25, '#f7dc8e'); gr.addColorStop(0.65, '#b88426'); gr.addColorStop(1, '#3a2408');
  g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y, R_BOLA, 0, Math.PI * 2); g.fill();
  // el reflejo de la mesa verde abajo y el brillo arriba
  g.fillStyle = 'rgba(40,140,110,0.35)'; g.beginPath(); g.ellipse(b.x + 1, b.y + 4.2, 4.5, 1.6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(b.x - 2.6, b.y - 3, 1.5, 0, Math.PI * 2); g.fill();
}
function dibujarResorte(g, tirado, hayBola) {
  const yTope = LANZADOR.y + R_BOLA + tirado * 26;
  g.strokeStyle = '#8a8270'; g.lineWidth = 1.4; g.beginPath();
  const n = 7, alto = 600 - yTope;
  for (let i = 0; i <= n; i++) { const y = yTope + (i / n) * alto, x = LANZADOR.x + (i % 2 ? 6 : -6); i ? g.lineTo(x, y) : g.moveTo(LANZADOR.x, y); }
  g.stroke();
  const gr = g.createLinearGradient(0, yTope - 3, 0, yTope + 4); gr.addColorStop(0, ORO_CLARO); gr.addColorStop(1, ORO_OSCURO);
  g.fillStyle = gr; g.fillRect(LANZADOR.x - 9, yTope - 1, 18, 5);
  if (hayBola) { g.globalCompositeOperation = 'lighter'; brillo(g, LANZADOR.x, yTope + 12, 18, LUZ.oro, 0.25 + 0.2 * Math.sin(ahora * 6)); g.globalCompositeOperation = 'source-over'; }
}
function dibujarMolinete(g, ang) {
  const c = Math.cos(ang), w = 20 * Math.abs(c);
  g.fillStyle = c > 0 ? '#f4ead2' : '#c79a3a'; g.fillRect(37 - w, 298, w * 2, 4);
  g.strokeStyle = ORO; g.lineWidth = 1; g.beginPath(); g.moveTo(15, 300); g.lineTo(59, 300); g.stroke();
}

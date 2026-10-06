/* ============================================================================
   barro/js/moto.js — la moto y el piloto, dibujados a mano en el lienzo con
   trazo de historieta (contorno oscuro, color plano y sombra), en metros y
   en el marco de la moto (x adelante, y arriba, origen en el centro de masa).
   El piloto es un esqueleto con dos huesos por pierna y por brazo (IK): los
   pies van en los pedalines, las manos en el manubrio, y la cadera se mueve
   según se eche atrás o adelante y cuánto se comprima la suspensión.
   ========================================================================== */

const TINTA = '#17110c';
const LW = 0.032;                       // grosor del contorno (m)

export const EQUIPOS = [
  { moto: '#d8242a', moto2: '#f4f1ea', casco: '#f4f1ea', casco2: '#d8242a', remera: '#f4f1ea', remera2: '#d8242a', pantalon: '#2a2a2e', botas: '#f4f1ea', llanta: '#d8242a' },  // rojo/blanco (el del video)
  { moto: '#1f5bd8', moto2: '#f4f1ea', casco: '#1f5bd8', casco2: '#ffd23a', remera: '#1f5bd8', remera2: '#f4f1ea', pantalon: '#1c2440', botas: '#1f5bd8', llanta: '#c9ccd2' },  // azul
  { moto: '#1d1d21', moto2: '#8a8f99', casco: '#1d1d21', casco2: '#e8e8e8', remera: '#26262b', remera2: '#e8e8e8', pantalon: '#1d1d21', botas: '#1d1d21', llanta: '#1d1d21' },  // negro
  { moto: '#f4f1ea', moto2: '#1d1d21', casco: '#f4f1ea', casco2: '#30a14e', remera: '#f4f1ea', remera2: '#1d1d21', pantalon: '#f4f1ea', botas: '#1d1d21', llanta: '#f4f1ea' },  // blanco
  { moto: '#3fae3a', moto2: '#141414', casco: '#3fae3a', casco2: '#141414', remera: '#141414', remera2: '#3fae3a', pantalon: '#141414', botas: '#3fae3a', llanta: '#3fae3a' },  // verde
  { moto: '#f27a1a', moto2: '#141414', casco: '#f27a1a', casco2: '#f4f1ea', remera: '#f27a1a', remera2: '#141414', pantalon: '#2b2b2b', botas: '#f4f1ea', llanta: '#f27a1a' },  // naranja
  { moto: '#ffcf1f', moto2: '#1f3fa8', casco: '#ffcf1f', casco2: '#1f3fa8', remera: '#1f3fa8', remera2: '#ffcf1f', pantalon: '#1f3fa8', botas: '#ffcf1f', llanta: '#ffcf1f' },  // amarillo/azul
  { moto: '#8a3fd1', moto2: '#f4f1ea', casco: '#8a3fd1', casco2: '#f4f1ea', remera: '#8a3fd1', remera2: '#f4f1ea', pantalon: '#26202e', botas: '#f4f1ea', llanta: '#8a3fd1' },  // violeta
];

/* oscurecer / aclarar un color #rrggbb */
const cache = new Map();
export function tono(hex, k) {
  const clave = hex + k;
  if (cache.has(clave)) return cache.get(clave);
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (k < 0) { r *= 1 + k; g *= 1 + k; b *= 1 + k; } else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  const s = `rgb(${r | 0},${g | 0},${b | 0})`;
  cache.set(clave, s);
  return s;
}

function forma(ctx, pts, relleno, contorno = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (p.length === 4) ctx.quadraticCurveTo(p[0], p[1], p[2], p[3]);
    else ctx.lineTo(p[0], p[1]);
  }
  ctx.closePath();
  ctx.fillStyle = relleno; ctx.fill();
  if (contorno) { ctx.lineWidth = LW; ctx.strokeStyle = TINTA; ctx.stroke(); }
}
function linea(ctx, ax, ay, bx, by, ancho, color, borde = true) {
  ctx.lineCap = 'round';
  if (borde) { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineWidth = ancho + LW * 2; ctx.strokeStyle = TINTA; ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineWidth = ancho; ctx.strokeStyle = color; ctx.stroke();
}
function circulo(ctx, x, y, r, relleno, contorno = true) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (relleno) { ctx.fillStyle = relleno; ctx.fill(); }
  if (contorno) { ctx.lineWidth = LW; ctx.strokeStyle = TINTA; ctx.stroke(); }
}

/* dos huesos: dado el inicio, el fin y los largos, dónde va la articulación.
   lado: +1 o -1, hacia qué lado se dobla */
function ik(ax, ay, bx, by, l1, l2, lado) {
  let dx = bx - ax, dy = by - ay;
  let d = Math.hypot(dx, dy);
  const dmax = (l1 + l2) * 0.999;
  if (d > dmax) { dx *= dmax / d; dy *= dmax / d; d = dmax; }
  const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const base = Math.atan2(dy, dx) + a * lado;
  return [ax + Math.cos(base) * l1, ay + Math.sin(base) * l1];
}

/* ---------------- la rueda ---------------- */
function rueda(ctx, x, y, r, giro, col, delantera) {
  // goma con tacos
  circulo(ctx, x, y, r, '#1b1a19');
  ctx.save(); ctx.translate(x, y); ctx.rotate(-giro);
  ctx.fillStyle = '#2c2a28';
  for (let i = 0; i < 24; i++) {
    ctx.rotate((Math.PI * 2) / 24);
    ctx.fillRect(r - 0.045, -0.022, 0.05, 0.044);
  }
  // flanco
  ctx.beginPath(); ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2); ctx.fillStyle = '#262422'; ctx.fill();
  // llanta de color (como en el video) y rayos
  ctx.beginPath(); ctx.arc(0, 0, r * 0.76, 0, Math.PI * 2); ctx.lineWidth = 0.05; ctx.strokeStyle = col; ctx.stroke();
  ctx.lineWidth = 0.012; ctx.strokeStyle = TINTA; ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(210,214,220,0.75)'; ctx.lineWidth = 0.008;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 0.05, Math.sin(a) * 0.05); ctx.lineTo(Math.cos(a + 0.35) * r * 0.7, Math.sin(a + 0.35) * r * 0.7); ctx.stroke();
  }
  // disco de freno y maza
  if (delantera) { ctx.beginPath(); ctx.arc(0, 0, 0.12, 0, Math.PI * 2); ctx.lineWidth = 0.025; ctx.strokeStyle = '#9aa0a8'; ctx.stroke(); }
  ctx.restore();
  circulo(ctx, x, y, 0.055, '#b9bec6');
  // brillo de la goma
  ctx.beginPath(); ctx.arc(x, y, r - 0.012, Math.PI * 0.55, Math.PI * 0.95); ctx.lineWidth = 0.012; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke();
}

/* ---------------- la pose del piloto ----------------
   p: { incl -1..1 (atrás..adelante), agache 0..1, parado 0..1 (sentado..de pie) } */
function esqueleto(p) {
  const incl = p.incl || 0, ag = p.agache || 0, parado = p.parado ?? 1;
  const hip = [-0.3 + incl * 0.2 - (1 - parado) * 0.08 - ag * 0.04, 0.47 + parado * 0.19 - ag * 0.15 - Math.max(0, -incl) * 0.06];
  const torso = 0.72 + incl * 0.3 - (1 - parado) * 0.25 + ag * 0.1;   // desde la vertical (rad)
  const lt = 0.56;
  const hom = [hip[0] + Math.sin(torso) * lt, hip[1] + Math.cos(torso) * lt];
  const cab = [hom[0] + Math.sin(torso * 0.7) * 0.2 + 0.03, hom[1] + Math.cos(torso * 0.7) * 0.2];
  const pie = [-0.1, -0.06];
  const mano = [0.41, 0.68];
  const rod = ik(hip[0], hip[1], pie[0], pie[1] + 0.06, 0.46, 0.46, 1);
  const codo = ik(hom[0], hom[1], mano[0], mano[1], 0.31, 0.31, 1);
  return { hip, hom, cab, pie, mano, rod, codo, torso };
}

/* ---------------- la moto entera ----------------
   e: { rx, ry, fx, fy (centros de las ruedas en el marco de la moto), giro0, giro1,
        colores (EQUIPOS[i]), numero, pose, sinPiloto, fantasma } */
export function dibujarMoto(ctx, e) {
  const C = e.colores, r = 0.34;
  const P = esqueleto(e.pose || {});
  const lejos = (col) => tono(col, -0.35);

  // --- el brazo y la pierna de atrás (más oscuros)
  if (!e.sinPiloto) {
    linea(ctx, P.hom[0] - 0.03, P.hom[1], P.codo[0] - 0.05, P.codo[1], 0.085, lejos(C.remera));
    linea(ctx, P.codo[0] - 0.05, P.codo[1], P.mano[0] - 0.04, P.mano[1] + 0.01, 0.075, lejos(C.remera));
  }

  // --- rueda de atrás, basculante y amortiguador
  rueda(ctx, e.rx, e.ry, r, e.giro0, C.llanta, false);
  const piv = [-0.1, -0.2];
  // cadena
  ctx.lineWidth = 0.016; ctx.strokeStyle = '#3a3633';
  ctx.beginPath(); ctx.moveTo(-0.04, -0.1); ctx.lineTo(e.rx, e.ry + 0.09); ctx.moveTo(-0.04, -0.27); ctx.lineTo(e.rx, e.ry - 0.09); ctx.stroke();
  forma(ctx, [[piv[0], piv[1] + 0.05], [e.rx + 0.02, e.ry + 0.04], [e.rx + 0.02, e.ry - 0.04], [piv[0], piv[1] - 0.06]], '#a7adb5');
  const amA = [-0.26, 0.06], amB = [piv[0] + (e.rx - piv[0]) * 0.32, piv[1] + (e.ry - piv[1]) * 0.32 + 0.03];
  linea(ctx, amA[0], amA[1], amB[0], amB[1], 0.07, '#ffb21c');
  ctx.lineWidth = 0.012; ctx.strokeStyle = TINTA;
  for (let k = 1; k < 6; k++) { const t = k / 6; const x = amA[0] + (amB[0] - amA[0]) * t, y = amA[1] + (amB[1] - amA[1]) * t; ctx.beginPath(); ctx.moveTo(x - 0.04, y - 0.01); ctx.lineTo(x + 0.04, y + 0.01); ctx.stroke(); }

  // --- motor
  forma(ctx, [[-0.3, -0.02], [0.08, 0.06], [0.22, -0.1], [0.14, -0.31], [-0.18, -0.34], [-0.33, -0.2]], '#3b3d42');
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.012;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(0.0 + k * 0.035, 0.03 - k * 0.01); ctx.lineTo(0.12 + k * 0.03, -0.07 - k * 0.01); ctx.stroke(); }
  circulo(ctx, -0.08, -0.18, 0.085, '#6a6e76');
  circulo(ctx, -0.08, -0.18, 0.035, '#9aa0a8', false);
  // escape: el caño y el silenciador
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0.16, -0.02); ctx.quadraticCurveTo(0.26, -0.24, 0.0, -0.08); ctx.quadraticCurveTo(-0.3, 0.06, -0.5, 0.16);
  ctx.lineWidth = 0.075; ctx.strokeStyle = TINTA; ctx.stroke(); ctx.lineWidth = 0.05; ctx.strokeStyle = '#c4c8cf'; ctx.stroke();
  forma(ctx, [[-0.45, 0.2], [-0.92, 0.32], [-0.95, 0.22], [-0.48, 0.1]], '#d9dce1');
  forma(ctx, [[-0.92, 0.32], [-0.99, 0.31], [-1.0, 0.22], [-0.95, 0.22]], '#2b2b2f');

  // --- horquilla y rueda de adelante
  const tope = [0.47, 0.5], cabezal = [0.43, 0.38];
  rueda(ctx, e.fx, e.fy, r, e.giro1, C.llanta, true);
  const ax = e.fx - tope[0], ay = e.fy - tope[1], L = Math.hypot(ax, ay), ux = ax / L, uy = ay / L;
  const finBarra = [e.fx - ux * 0.42, e.fy - uy * 0.42];
  linea(ctx, tope[0], tope[1], finBarra[0] + ux * 0.05, finBarra[1] + uy * 0.05, 0.075, '#e0b13c');          // barras (doradas)
  linea(ctx, finBarra[0], finBarra[1], e.fx, e.fy, 0.085, '#2d2e33');                                          // botellas
  ctx.lineWidth = 0.014; ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.moveTo(tope[0] + 0.02, tope[1]); ctx.lineTo(finBarra[0] + 0.02, finBarra[1]); ctx.stroke();
  // guardabarros delantero (pegado a la botella)
  const gx = finBarra[0] + ux * 0.1, gy = finBarra[1] + uy * 0.1;
  forma(ctx, [[gx - 0.12, gy + 0.03], [gx + 0.2, gy + 0.14, gx + 0.5, gy + 0.02], [gx + 0.48, gy - 0.03], [gx + 0.18, gy + 0.06, gx - 0.12, gy - 0.04]], C.moto2);

  // --- cuadro
  linea(ctx, cabezal[0], cabezal[1], 0.2, -0.24, 0.05, '#55585f');

  // --- guardabarros de atrás (largo y levantado), tapa lateral con el número
  forma(ctx, [[-0.36, 0.36], [-0.78, 0.4, -1.16, 0.52], [-1.15, 0.45], [-0.78, 0.31, -0.46, 0.22]], C.moto);
  ctx.fillStyle = tono(C.moto, -0.3);
  ctx.beginPath(); ctx.moveTo(-0.5, 0.25); ctx.quadraticCurveTo(-0.8, 0.33, -1.12, 0.45); ctx.lineTo(-1.13, 0.47); ctx.quadraticCurveTo(-0.8, 0.37, -0.48, 0.29); ctx.closePath(); ctx.fill();
  forma(ctx, [[-0.12, 0.33], [-0.7, 0.36], [-0.62, 0.05], [-0.18, 0.02]], C.moto2);
  ctx.save(); ctx.translate(-0.4, 0.19); ctx.scale(0.01, -0.01);
  ctx.fillStyle = C.moto2 === '#141414' || C.moto2 === '#1d1d21' ? '#f4f1ea' : '#16130f';
  ctx.font = 'italic 800 24px Barlow, "Barlow Condensed", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(e.numero ?? ''), 0, 0);
  ctx.restore();

  // --- asiento: una tabla larga y recta, como en las de cross
  forma(ctx, [[0.02, 0.45], [-0.45, 0.47, -0.92, 0.43], [-0.92, 0.37], [-0.45, 0.39, 0.0, 0.36]], '#1c1c1f');
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.012;
  ctx.beginPath(); ctx.moveTo(-0.05, 0.44); ctx.quadraticCurveTo(-0.45, 0.46, -0.88, 0.42); ctx.stroke();

  // --- tanque y cachas del radiador, con la gráfica
  forma(ctx, [[0.46, 0.46], [0.18, 0.5], [-0.04, 0.44], [-0.06, 0.2], [0.06, -0.02], [0.3, -0.04], [0.5, 0.2]], C.moto);
  forma(ctx, [[0.44, 0.38], [0.24, 0.42], [0.06, 0.3], [0.1, 0.06], [0.3, 0.02], [0.47, 0.2]], C.moto2, false);
  ctx.fillStyle = C.moto;
  ctx.beginPath(); ctx.moveTo(0.12, 0.08); ctx.lineTo(0.42, 0.3); ctx.lineTo(0.38, 0.36); ctx.lineTo(0.1, 0.16); ctx.closePath(); ctx.fill();
  ctx.fillStyle = tono(C.moto, -0.35);
  ctx.beginPath(); ctx.moveTo(-0.05, 0.22); ctx.lineTo(0.06, -0.02); ctx.lineTo(0.3, -0.04); ctx.lineTo(0.28, 0.0); ctx.lineTo(0.09, 0.03); ctx.lineTo(0.0, 0.24); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.translate(0.27, 0.2); ctx.rotate(0.62); ctx.scale(0.01, -0.01);
  ctx.fillStyle = tono(C.moto, -0.55); ctx.font = 'italic 800 9px Barlow, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('BARRO', 0, 0);
  ctx.restore();
  // manubrio con el protector
  linea(ctx, 0.47, 0.53, 0.41, 0.7, 0.035, '#2a2a2e');
  forma(ctx, [[0.35, 0.72], [0.47, 0.73], [0.47, 0.67], [0.36, 0.66]], C.moto2);
  circulo(ctx, 0.47, 0.5, 0.035, '#2a2a2e');

  if (e.sinPiloto) return;

  // --- el piloto (ropa ancha de cross)
  const pant = C.pantalon, rem = C.remera;
  // muslo y canilla
  linea(ctx, P.hip[0], P.hip[1], P.rod[0], P.rod[1], 0.21, pant);
  linea(ctx, P.rod[0], P.rod[1], P.pie[0] + 0.01, P.pie[1] + 0.15, 0.16, pant);
  ctx.lineCap = 'round'; ctx.strokeStyle = tono(pant, 0.22); ctx.lineWidth = 0.035;
  ctx.beginPath(); ctx.moveTo(P.hip[0] + (P.rod[0] - P.hip[0]) * 0.2, P.hip[1] + (P.rod[1] - P.hip[1]) * 0.2 + 0.05); ctx.lineTo(P.rod[0] - 0.02, P.rod[1] + 0.06); ctx.stroke();
  circulo(ctx, P.rod[0] + 0.03, P.rod[1] + 0.01, 0.075, tono(pant, 0.3));                 // rodillera
  // bota grande con hebillas
  const b = P.pie;
  forma(ctx, [[b[0] - 0.08, b[1] + 0.33], [b[0] + 0.08, b[1] + 0.34], [b[0] + 0.09, b[1] + 0.06], [b[0] + 0.24, b[1] + 0.03], [b[0] + 0.24, b[1] - 0.04], [b[0] - 0.1, b[1] - 0.05]], C.botas);
  ctx.strokeStyle = tono(C.botas, -0.5); ctx.lineWidth = 0.016;
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(b[0] - 0.08, b[1] + 0.1 + k * 0.075); ctx.lineTo(b[0] + 0.08, b[1] + 0.12 + k * 0.075); ctx.stroke(); }
  forma(ctx, [[b[0] - 0.1, b[1] - 0.05], [b[0] + 0.24, b[1] - 0.04], [b[0] + 0.24, b[1] - 0.075], [b[0] - 0.1, b[1] - 0.085]], '#1c1c1f', false);
  // el cuerpo: remera ancha con la pechera abultada
  const t = P.torso, cx = Math.cos(t), sx = Math.sin(t);
  const h0 = P.hip, h1 = P.hom;
  const n = (k) => [cx * k, -sx * k];     // normal "adelante" del torso
  const pa = n(0.15), pb = n(0.17);
  forma(ctx, [
    [h0[0] - pa[0], h0[1] - pa[1]],
    [h1[0] - pb[0] + sx * 0.02, h1[1] - pb[1] + cx * 0.02],
    [h1[0] + sx * 0.1, h1[1] + cx * 0.1, h1[0] + pb[0] + sx * 0.02, h1[1] + pb[1] + cx * 0.02],
    [h0[0] + (h1[0] - h0[0]) * 0.45 + pb[0] * 1.3, h0[1] + (h1[1] - h0[1]) * 0.45 + pb[1] * 1.3, h0[0] + pa[0], h0[1] + pa[1]],
    [h0[0] - sx * 0.08, h0[1] - cx * 0.08, h0[0] - pa[0], h0[1] - pa[1]],
  ], rem);
  // gráfica de la remera: una franja ancha y el logo
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(h0[0] - pa[0], h0[1] - pa[1]); ctx.lineTo(h1[0] - pb[0], h1[1] - pb[1]); ctx.lineTo(h1[0] + pb[0], h1[1] + pb[1]); ctx.lineTo(h0[0] + pa[0] * 1.2, h0[1] + pa[1] * 1.2); ctx.closePath(); ctx.clip();
  ctx.fillStyle = C.remera2;
  const m0 = [h0[0] + (h1[0] - h0[0]) * 0.32, h0[1] + (h1[1] - h0[1]) * 0.32], m1 = [h0[0] + (h1[0] - h0[0]) * 0.55, h0[1] + (h1[1] - h0[1]) * 0.55];
  ctx.beginPath(); ctx.moveTo(m0[0] - pa[0] * 2, m0[1] - pa[1] * 2); ctx.lineTo(m0[0] + pa[0] * 2, m0[1] + pa[1] * 2); ctx.lineTo(m1[0] + pa[0] * 2, m1[1] + pa[1] * 2); ctx.lineTo(m1[0] - pa[0] * 2, m1[1] - pa[1] * 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.moveTo(h0[0] - pa[0], h0[1] - pa[1]); ctx.lineTo(h1[0] - pb[0], h1[1] - pb[1]); ctx.lineTo(h1[0] - pb[0] * 0.3, h1[1] - pb[1] * 0.3); ctx.lineTo(h0[0] - pa[0] * 0.3, h0[1] - pa[1] * 0.3); ctx.closePath(); ctx.fill();
  ctx.restore();
  // el brazo: hombro ancho, codo arriba, guante
  linea(ctx, P.hom[0], P.hom[1], P.codo[0], P.codo[1], 0.13, rem);
  linea(ctx, P.codo[0], P.codo[1], P.mano[0] - 0.02, P.mano[1] + 0.01, 0.11, rem);
  ctx.strokeStyle = C.remera2; ctx.lineWidth = 0.035; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(P.codo[0] + (P.mano[0] - P.codo[0]) * 0.55, P.codo[1] + (P.mano[1] - P.codo[1]) * 0.55); ctx.lineTo(P.codo[0] + (P.mano[0] - P.codo[0]) * 0.75, P.codo[1] + (P.mano[1] - P.codo[1]) * 0.75); ctx.stroke();
  circulo(ctx, P.mano[0], P.mano[1], 0.06, '#232327');
  // casco: calota, mentonera larga, visera y antiparras
  const k = P.cab;
  ctx.save(); ctx.translate(k[0], k[1]); ctx.rotate(-(t - 0.72) * 0.5 - 0.1); ctx.scale(1.12, 1.12);
  forma(ctx, [[-0.16, 0.0], [-0.16, 0.19, 0.02, 0.2], [0.17, 0.19, 0.19, 0.05], [0.29, -0.06], [0.24, -0.15], [0.07, -0.15], [-0.1, -0.12]], C.casco);
  ctx.fillStyle = C.casco2;
  ctx.beginPath(); ctx.moveTo(-0.15, 0.06); ctx.quadraticCurveTo(-0.05, 0.2, 0.06, 0.19); ctx.lineTo(0.02, 0.14); ctx.quadraticCurveTo(-0.07, 0.13, -0.13, -0.02); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0.29, -0.06); ctx.lineTo(0.24, -0.15); ctx.lineTo(0.14, -0.14); ctx.lineTo(0.2, -0.05); ctx.closePath(); ctx.fill();
  forma(ctx, [[0.04, 0.17], [0.32, 0.16], [0.31, 0.11], [0.05, 0.11]], C.casco2);                        // visera
  forma(ctx, [[0.03, 0.07], [0.21, 0.08], [0.22, -0.02], [0.04, -0.02]], '#2b2f36');                    // antiparras
  ctx.fillStyle = 'rgba(150,215,255,0.6)'; ctx.fillRect(0.07, 0.03, 0.11, 0.028);
  ctx.strokeStyle = '#2b2f36'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(0.03, 0.04); ctx.lineTo(-0.15, 0.04); ctx.stroke();
  ctx.restore();
}

/* el piloto solo, hecho un ovillo (cuando sale volando en una caída) */
export function dibujarPilotoSuelto(ctx, C, giro) {
  ctx.save(); ctx.rotate(giro);
  linea(ctx, -0.1, 0, 0.25, 0.05, 0.2, C.remera);
  linea(ctx, -0.1, 0, -0.3, -0.3, 0.14, C.pantalon);
  linea(ctx, -0.3, -0.3, -0.05, -0.45, 0.12, C.pantalon);
  linea(ctx, 0.2, 0.05, 0.3, -0.2, 0.09, C.remera2);
  ctx.translate(0.36, 0.12);
  forma(ctx, [[-0.15, 0.02], [-0.14, 0.17, 0.02, 0.18], [0.15, 0.16, 0.17, 0.04], [0.24, -0.05], [0.2, -0.12], [0.06, -0.13], [-0.08, -0.1]], C.casco);
  forma(ctx, [[0.02, 0.05], [0.18, 0.06], [0.19, -0.02], [0.03, -0.02]], '#2b2f36');
  ctx.restore();
}

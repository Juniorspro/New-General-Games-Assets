/* ============================================================================
   Los once cuerpos, del polvo estelar al agujero negro. Cada uno se pinta una
   vez en su lienzo (a la resolución real) con su textura —cráteres, bandas,
   continentes, granos— y en la partida se estampa girando, con su brillo de
   neón sumado por encima y lo que se mueve aparte (la cola del cometa, los
   anillos, el disco del agujero negro, la corona de las estrellas).
   ========================================================================== */

const CUERPOS = [
  { r: 11, glow: '#ff8af0', puntos: 1 },
  { r: 15, glow: '#7ae8ff', puntos: 3 },
  { r: 20, glow: '#d8d8ff', puntos: 6 },
  { r: 25, glow: '#ff7a4a', puntos: 10 },
  { r: 31, glow: '#4ab8ff', puntos: 15 },
  { r: 38, glow: '#ffd88a', puntos: 21 },
  { r: 46, glow: '#ffae6a', puntos: 28 },
  { r: 55, glow: '#ff4a5a', puntos: 36, estrella: true },
  { r: 64, glow: '#ffd84a', puntos: 45, estrella: true },
  { r: 74, glow: '#8ad8ff', puntos: 55, estrella: true },
  { r: 86, glow: '#b46aff', puntos: 66 },
];
const MAX = CUERPOS.length - 1;

function lienzoHD(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * S)); c.height = Math.max(1, Math.ceil(h * S)); const g = c.getContext('2d'); g.scale(S, S); return [c, g]; }
function grad(g, r, paradas, cx, cy) { const gr = g.createRadialGradient(cx || -r * 0.35, cy || -r * 0.35, r * 0.05, 0, 0, r); paradas.forEach(([p, c]) => gr.addColorStop(p, c)); return gr; }

const CACHE_CUERPO = [];
function lienzoCuerpo(k) {
  if (CACHE_CUERPO[k] && CACHE_CUERPO[k].S === S) return CACHE_CUERPO[k].c;
  const r = CUERPOS[k].r, pad = 3, [c, g] = lienzoHD(2 * r + 2 * pad, 2 * r + 2 * pad), rnd = rngSemilla(k * 97 + 5);
  g.translate(r + pad, r + pad);
  g.save(); g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.clip();
  const mancha = (x, y, rr, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill(); };
  switch (k) {
    case 0: // polvo estelar: un nudo rosa con chispas
      g.fillStyle = grad(g, r, [[0, '#ffffff'], [0.35, '#ff9af0'], [1, '#7a1a9a']]); g.fillRect(-r, -r, 2 * r, 2 * r);
      for (let i = 0; i < 9; i++) mancha(azar(-r, r) * 0.7, azar(-r, r) * 0.7, azar(0.6, 1.4), 'rgba(255,255,255,0.9)');
      break;
    case 1: // cometa: hielo
      g.fillStyle = grad(g, r, [[0, '#ffffff'], [0.4, '#a8f4ff'], [1, '#1a5a8a']]); g.fillRect(-r, -r, 2 * r, 2 * r);
      for (let i = 0; i < 6; i++) mancha((rnd() - 0.5) * r * 1.4, (rnd() - 0.5) * r * 1.4, rnd() * 3 + 1, 'rgba(20,60,110,0.35)');
      break;
    case 2: // luna: cráteres
      g.fillStyle = grad(g, r, [[0, '#ffffff'], [0.5, '#c8c8d8'], [1, '#4a4a64']]); g.fillRect(-r, -r, 2 * r, 2 * r);
      for (let i = 0; i < 9; i++) {
        const x = (rnd() - 0.5) * r * 1.6, y = (rnd() - 0.5) * r * 1.6, rr = rnd() * 3.5 + 1.2;
        mancha(x + 0.6, y + 0.6, rr, 'rgba(255,255,255,0.35)'); mancha(x, y, rr, 'rgba(60,60,90,0.45)');
      }
      break;
    case 3: // marte
      g.fillStyle = grad(g, r, [[0, '#ffd0a0'], [0.45, '#ff7a3a'], [1, '#6a1a10']]); g.fillRect(-r, -r, 2 * r, 2 * r);
      for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(120,30,10,0.35)'; g.beginPath(); g.ellipse((rnd() - 0.5) * r * 1.5, (rnd() - 0.5) * r * 1.5, rnd() * 7 + 3, rnd() * 3 + 2, rnd() * 3, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.ellipse(0, -r * 0.92, r * 0.4, r * 0.16, 0, 0, Math.PI * 2); g.fill();
      break;
    case 4: // tierra: océanos, continentes y nubes
      g.fillStyle = grad(g, r, [[0, '#9ae0ff'], [0.5, '#2a7ae8'], [1, '#0a2a6a']]); g.fillRect(-r, -r, 2 * r, 2 * r);
      for (let i = 0; i < 5; i++) { const cx = (rnd() - 0.5) * r * 1.4, cy = (rnd() - 0.5) * r * 1.4; for (let j = 0; j < 6; j++) mancha(cx + (rnd() - 0.5) * 12, cy + (rnd() - 0.5) * 9, rnd() * 5 + 3, j % 2 ? '#3ab84a' : '#2a9a3e'); }
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2.2; g.lineCap = 'round';
      for (let i = 0; i < 5; i++) { const y = (rnd() - 0.5) * r * 1.6, x = (rnd() - 0.5) * r; g.beginPath(); g.moveTo(x - 8, y); g.quadraticCurveTo(x, y - 3, x + 10, y + 1); g.stroke(); }
      break;
    case 5: // saturno (los anillos van aparte)
      for (let i = -6; i <= 6; i++) { g.fillStyle = ['#f0d8a0', '#e0b878', '#f8e8c0', '#d0a060'][(i + 8) % 4]; g.fillRect(-r, i * r / 6, 2 * r, r / 6 + 1); }
      g.fillStyle = grad(g, r, [[0, 'rgba(255,255,255,0.4)'], [0.6, 'rgba(255,255,255,0)'], [1, 'rgba(40,20,0,0.55)']]); g.fillRect(-r, -r, 2 * r, 2 * r);
      break;
    case 6: // júpiter: bandas y la mancha roja
      for (let i = -9; i <= 9; i++) { g.fillStyle = ['#f0c890', '#c87a4a', '#f8e0b8', '#a85a3a', '#e8b080'][(i + 10) % 5]; g.fillRect(-r, i * r / 9 + Math.sin(i) * 2, 2 * r, r / 9 + 2); }
      g.fillStyle = '#c84a3a'; g.beginPath(); g.ellipse(r * 0.3, r * 0.35, r * 0.24, r * 0.13, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = grad(g, r, [[0, 'rgba(255,255,255,0.35)'], [0.6, 'rgba(255,255,255,0)'], [1, 'rgba(40,10,0,0.6)']]); g.fillRect(-r, -r, 2 * r, 2 * r);
      break;
    case 7: case 8: case 9: { // estrellas: núcleo brillante y granos
      const P = { 7: ['#fff0e0', '#ff7a5a', '#a01a2a'], 8: ['#ffffff', '#ffe060', '#ff7a1a'], 9: ['#ffffff', '#c0f0ff', '#2a6ae8'] }[k];
      g.fillStyle = grad(g, r, [[0, P[0]], [0.45, P[1]], [1, P[2]]], 0, 0); g.fillRect(-r, -r, 2 * r, 2 * r);
      for (let i = 0; i < 70; i++) { const a = rnd() * 6.28, d = Math.sqrt(rnd()) * r; mancha(Math.cos(a) * d, Math.sin(a) * d, rnd() * 2 + 0.8, 'rgba(255,255,255,' + (0.08 + rnd() * 0.15) + ')'); }
      break;
    }
    case 10: // agujero negro: negro con el anillo de fotones
      g.fillStyle = '#000'; g.fillRect(-r, -r, 2 * r, 2 * r);
      g.fillStyle = grad(g, r, [[0, 'rgba(0,0,0,1)'], [0.78, 'rgba(0,0,0,1)'], [0.9, 'rgba(255,190,120,0.9)'], [1, 'rgba(180,90,255,0.5)']], 0, 0); g.fillRect(-r, -r, 2 * r, 2 * r);
      break;
  }
  g.restore();
  // el filo de neón
  g.strokeStyle = CUERPOS[k].glow; g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, r - 0.8, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, r - 2.2, Math.PI * 1.05, Math.PI * 1.55); g.stroke();
  CACHE_CUERPO[k] = { c, S };
  return c;
}
/* el brillo de neón: un degradé radial, en caché por color y tamaño */
const CACHE_BRILLO = new Map();
function brillo(col, r) {
  r = Math.max(4, Math.round(r / 4) * 4);
  const k = col + r + '|' + S;
  let c = CACHE_BRILLO.get(k);
  if (!c) {
    const [cc, g] = lienzoHD(2 * r, 2 * r);
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, col); gr.addColorStop(0.35, col.length === 7 ? col + '66' : col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.9; g.fillStyle = gr; g.fillRect(0, 0, 2 * r, 2 * r);
    c = cc; CACHE_BRILLO.set(k, c);
  }
  return [c, r];
}
function estampaBrillo(g, col, x, y, r, alfa) {
  const [c, rr] = brillo(col, r);
  g.globalAlpha = alfa == null ? 1 : alfa;
  g.drawImage(c, x - rr, y - rr, 2 * rr, 2 * rr);
  g.globalAlpha = 1;
}

/* un cuerpo en la escena; b = { tipo, x, y, r, ang, vx, vy, nace } */
function dibujarCuerpo(g, b, t, conBrillo) {
  const C = CUERPOS[b.tipo], r = b.r, c = lienzoCuerpo(b.tipo), pad = 3, rr = C.r;
  const esc = r / rr;
  if (conBrillo !== false) {
    g.globalCompositeOperation = 'lighter';
    estampaBrillo(g, C.glow, b.x, b.y, r * (C.estrella ? 2.1 + Math.sin(t * 3 + b.x) * 0.1 : 1.55), C.estrella ? 0.55 : 0.32);
    g.globalCompositeOperation = 'source-over';
  }
  // atrás: anillos de saturno, disco del agujero negro, cola del cometa
  if (b.tipo === 5) anillos(g, b, esc, true);
  if (b.tipo === 10) disco(g, b, t, true);
  if (b.tipo === 1) { const v = Math.hypot(b.vx || 0, b.vy || 0); if (v > 60) cola(g, b, v); }
  g.save(); g.translate(b.x, b.y);
  if (b.tipo !== 5) g.rotate(b.ang || 0);
  g.scale(esc, esc);
  g.drawImage(c, -rr - pad, -rr - pad, 2 * (rr + pad), 2 * (rr + pad));
  g.restore();
  if (b.tipo === 5) anillos(g, b, esc, false);
  if (b.tipo === 10) disco(g, b, t, false);
}
function anillos(g, b, esc, atras) {
  const r = CUERPOS[5].r * esc;
  g.save(); g.translate(b.x, b.y); g.rotate(-0.25);
  g.beginPath(); g.ellipse(0, 0, r * 1.75, r * 0.42, 0, atras ? Math.PI : 0, atras ? Math.PI * 2 : Math.PI);
  g.lineWidth = r * 0.22; g.strokeStyle = 'rgba(240,210,150,0.85)'; g.stroke();
  g.lineWidth = r * 0.07; g.strokeStyle = 'rgba(255,240,200,0.9)'; g.beginPath(); g.ellipse(0, 0, r * 1.55, r * 0.36, 0, atras ? Math.PI : 0, atras ? Math.PI * 2 : Math.PI); g.stroke();
  g.restore();
}
function disco(g, b, t, atras) {
  const r = b.r;
  g.save(); g.translate(b.x, b.y); g.rotate(0.35);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    g.beginPath(); g.ellipse(0, 0, r * (1.55 + i * 0.18), r * (0.36 + i * 0.05), 0, atras ? Math.PI : 0, atras ? Math.PI * 2 : Math.PI);
    g.lineWidth = r * (0.14 - i * 0.03);
    g.strokeStyle = ['rgba(255,170,90,0.75)', 'rgba(255,90,200,0.5)', 'rgba(140,90,255,0.4)'][i];
    g.setLineDash([r * 0.4, r * 0.15]); g.lineDashOffset = -t * 60 * (i + 1);
    g.stroke();
  }
  g.setLineDash([]); g.globalCompositeOperation = 'source-over';
  g.restore();
}
function cola(g, b, v) {
  const ux = -b.vx / v, uy = -b.vy / v, largo = Math.min(60, v * 0.12);
  const gr = g.createLinearGradient(b.x, b.y, b.x + ux * largo, b.y + uy * largo);
  gr.addColorStop(0, 'rgba(160,240,255,0.7)'); gr.addColorStop(1, 'rgba(160,240,255,0)');
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = gr; g.lineWidth = b.r * 1.3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x + ux * largo, b.y + uy * largo); g.stroke();
  g.globalCompositeOperation = 'source-over';
}

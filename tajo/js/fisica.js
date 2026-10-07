/* ============================================================================
   El vuelo y el filo. Las frutas salen de abajo con la velocidad justa para
   llegar a la altura que se pide (v = √(2·g·h)), así ninguna se va por arriba
   ni queda baja. El filo es el rastro del dedo: un trazo de pincel que se
   afina hacia la cola y corta solo cuando el dedo va rápido (la sensibilidad
   mueve ese umbral).
   ========================================================================== */

const GRAV = 900;

// velocidad para salir de (x0, y0), tocar el techo en yTope y caer cerca de xFin
function lanzamiento(x0, y0, yTope, xFin) {
  const subida = Math.max(40, y0 - yTope), vy = -Math.sqrt(2 * GRAV * subida);
  const tVuelo = (-vy / GRAV) * 2;
  return { vx: (xFin - x0) / tVuelo, vy };
}
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/* los filos: el color de la tinta, la veta de pincel seco y cuántas frutas cortadas
   (en total, entre todas las partidas) hacen falta para usarlo */
const FILOS = [
  { col: '#16110d', veta: 'rgba(239,229,207,0.38)', pide: 0 },
  { col: BERMELLON, veta: 'rgba(255,214,190,0.45)', pide: 150 },
  { col: '#2c7a58', veta: 'rgba(214,244,226,0.45)', pide: 400 },
  { col: '#2b3f8c', veta: 'rgba(210,222,255,0.45)', pide: 900 },
  { col: '#c4951c', veta: 'rgba(255,246,200,0.75)', pide: 1600, oro: true },
];
const filoActual = () => FILOS[clamp(DATOS.filo | 0, 0, FILOS.length - 1)];

/* el rastro del dedo: puntos con su hora; vive `vida` segundos */
function nuevoRastro() { return { pts: [], vivo: false }; }
function rastroSumar(ra, x, y, t) {
  const u = ra.pts[ra.pts.length - 1];
  if (u && Math.hypot(u.x - x, u.y - y) < 1.5) { u.t = t; return; }
  ra.pts.push({ x, y, t });
  if (ra.pts.length > 40) ra.pts.shift();
}
function rastroPodar(ra, t, vida) { while (ra.pts.length && t - ra.pts[0].t > vida) ra.pts.shift(); }

/* el trazo: polígono que engorda hacia la punta (el dedo) con dos vetas claras adentro */
function dibujarRastro(g, ra, filo, grosor, t, vida) {
  const p = ra.pts, n = p.length;
  if (n < 2) return;
  const izq = [], der = [], centro = [];
  for (let i = 0; i < n; i++) {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)];
    let nx = -(b.y - a.y), ny = b.x - a.x; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const edad = clamp((t - p[i].t) / vida, 0, 1), w = grosor * 0.5 * Math.pow(i / (n - 1), 0.7) * (1 - edad * 0.6);
    izq.push([p[i].x + nx * w, p[i].y + ny * w]); der.push([p[i].x - nx * w, p[i].y - ny * w]); centro.push([p[i].x, p[i].y, nx, ny, w]);
  }
  g.beginPath(); g.moveTo(izq[0][0], izq[0][1]);
  for (let i = 1; i < n; i++) g.lineTo(izq[i][0], izq[i][1]);
  const u = centro[n - 1];
  g.arc(u[0], u[1], Math.max(0.5, u[4]), Math.atan2(u[3], u[2]), Math.atan2(u[3], u[2]) + Math.PI, true);   // la punta redonda hacia adelante
  for (let i = n - 1; i >= 0; i--) g.lineTo(der[i][0], der[i][1]);
  g.closePath();
  if (filo.oro) { const gr = g.createLinearGradient(p[0].x, p[0].y, u[0], u[1]); gr.addColorStop(0, '#8a6410'); gr.addColorStop(1, '#f0c850'); g.fillStyle = gr; }
  else g.fillStyle = filo.col;
  g.fill();
  // la veta de pincel seco (el papel que se ve entre los pelos del pincel)
  g.strokeStyle = filo.veta; g.lineCap = 'round';
  for (const k of [0.32, -0.18]) {
    g.lineWidth = Math.max(0.6, grosor * 0.07); g.beginPath();
    for (let i = Math.floor(n * 0.25); i < n; i++) { const c = centro[i], x = c[0] + c[2] * c[4] * k, y = c[1] + c[3] * c[4] * k; if (i === Math.floor(n * 0.25)) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EL FONDO PINTADO (como en el original, que se ve dibujado y no "retro"): nada de tramado ni de
// motas sueltas. El piso son losas grandes y desparejas que no siguen la grilla de choques, cada
// una con su degradé suave y juntas oscuras blandas; los muros, ladrillos grandes con volumen y la
// profundidad que se oscurece hacia afuera; y encima, la luz: un centro más claro, sombra suave
// contra las paredes y rayos que bajan desde arriba (como en las salas del video).
// ─────────────────────────────────────────────────────────────────────────────

/** Ruido de valor suave (interpolado), en [0,1]: manchas grandes sin granito. */
function ruidoValor(semilla, celda) {
  const r = mulberry(semilla), gw = Math.ceil(SALA_W / celda) + 2, gh = Math.ceil(SALA_H / celda) + 2, v = new Float32Array(gw * gh);
  for (let i = 0; i < v.length; i++) v[i] = r();
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / celda, fy = y / celda, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = s(fx - x0), ty = s(fy - y0);
    const a = v[y0 * gw + x0], b = v[y0 * gw + x0 + 1], c = v[(y0 + 1) * gw + x0], d = v[(y0 + 1) * gw + x0 + 1];
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  };
}
/** Un color a lo largo de una rampa (0 = oscuro, 1 = claro), interpolado. */
function enRampa(rampa, t) {
  const f = lim(t, 0, 1) * (rampa.length - 1), i = Math.floor(f), j = Math.min(rampa.length - 1, i + 1), u = f - i;
  const A = rgba(rampa[i]), B = rgba(rampa[j]);
  return [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, A[2] + (B[2] - A[2]) * u];
}

function hornearFondo(capituloId, semilla) {
  const C = CAPITULOS[capituloId], r = mulberry(semilla), W = SALA_W, H = SALA_H;
  const cv = lienzoNuevo(W, H), g = cv.getContext("2d"), im = g.createImageData(W, H), d = im.data;
  const n1 = ruidoValor(semilla + 1, 46), n2 = ruidoValor(semilla + 2, 15), n3 = ruidoValor(semilla + 3, 6);
  const PISO = C.piso, MURO = C.ladrillo;

  // ── las losas: filas de alto variable, cada fila partida en losas de ancho variable (corridas) ──
  const filas = [];
  for (let y = IY0; y < IY1;) { const h = Math.min(IY1 - y, 26 + Math.floor(r() * 14)); filas.push({ y0: y, y1: y + h, cortes: [], tonos: [] }); y += h; }
  if (filas.length > 1 && filas[filas.length - 1].y1 - filas[filas.length - 1].y0 < 16) { const u = filas.pop(); filas[filas.length - 1].y1 = u.y1; }
  for (const f of filas) {
    let x = IX0 - Math.floor(r() * 30);
    while (x < IX1) { const w = 34 + Math.floor(r() * 36); f.cortes.push(x); f.tonos.push((r() - 0.5) * 0.14); x += w; }
    f.cortes.push(IX1 + 60);
  }
  const losa = (x, y) => {
    let fi = 0; while (fi < filas.length - 1 && y >= filas[fi].y1) fi++;
    const f = filas[fi]; let k = 0; while (k < f.cortes.length - 2 && x >= f.cortes[k + 1]) k++;
    return { f, k, dx0: x - Math.max(IX0, f.cortes[k]), dx1: Math.min(IX1, f.cortes[k + 1]) - 1 - x, dy0: y - f.y0, dy1: f.y1 - 1 - y };
  };

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let col;
    if (x >= IX0 && x < IX1 && y >= IY0 && y < IY1) {
      // el piso
      const L = losa(x, y), borde = Math.min(L.dx0, L.dx1, L.dy0, L.dy1);
      let t = 0.5 + (n1(x, y) - 0.5) * 0.34 + (n2(x, y) - 0.5) * 0.14 + (n3(x, y) - 0.5) * 0.05 + L.f.tonos[L.k];
      if (borde === 0) t = 0.1;                                              // la junta
      else if (borde === 1) t -= 0.12;
      else if (L.dy0 === 1 || L.dx0 === 1) t += 0.08;                        // el filo de arriba/izq, con luz
      else if (L.dy1 === 2 || L.dx1 === 2) t -= 0.05;
      col = enRampa(PISO, t);
    } else {
      // los muros: en qué pared cae (la esquina es la diagonal) y qué tan hondo
      const ax = x < IX0 ? IX0 - x : x >= IX1 ? x - IX1 + 1 : 0, ay = y < IY0 ? IY0 - y : y >= IY1 ? y - IY1 + 1 : 0;
      const lado = ay * MURO_L > ax * MURO_A ? (y < IY0 ? 0 : 2) : (x < IX0 ? 3 : 1);
      const hondo = lado === 0 ? ay / MURO_A : lado === 2 ? ay / MURO_B : ax / MURO_L;       // 0 junto al piso → 1 afuera
      // coordenadas a lo largo del muro (u) y hacia adentro (v), para los ladrillos
      const u = lado % 2 === 0 ? x : y, v = hondo * 3;
      const fila = Math.floor(v), corrido = (fila % 2) * 11, bx = (u + corrido) % 22, by = v - fila;
      let t = 0.72 - hondo * 0.62 + (n2(x, y) - 0.5) * 0.16 + (n1(x * 0.7, y) - 0.5) * 0.12;
      if (by < 0.1 || bx < 1) t = 0.08;                                       // el mortero
      else if (by < 0.22 || bx < 2) t += 0.08;                                // el filo del ladrillo
      else if (by > 0.85 || bx > 20) t -= 0.08;
      if (lado === 0) t -= 0.04; if (lado === 2) t += 0.04;                  // el de arriba, más en sombra
      // la costura de la esquina (la diagonal), oscura
      if (Math.abs(ay * MURO_L - ax * MURO_A) < 18 && ax > 0 && ay > 0) t -= 0.12;
      col = enRampa(MURO, t);
    }
    const i = (y * W + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);

  // ── manchas de humedad y de musgo: borrones blandos ──
  const borron = (x, y, rx, ry, color, a) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, rx); gr.addColorStop(0, rgbaTxt(color, a)); gr.addColorStop(0.7, rgbaTxt(color, a * 0.6)); gr.addColorStop(1, rgbaTxt(color, 0));
    g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rx, 0, TAU); g.fill(); g.restore();
  };
  g.save(); g.beginPath(); g.rect(IX0, IY0, IX1 - IX0, IY1 - IY0); g.clip();
  for (let i = 0; i < 5; i++) borron(IX0 + r() * (IX1 - IX0), IY0 + r() * (IY1 - IY0), 18 + r() * 30, 10 + r() * 16, C.oscuro, 0.35);
  for (let i = 0; i < 6; i++) { const lado = r() < 0.5; const x = lado ? (r() < 0.5 ? IX0 + 4 : IX1 - 4) : IX0 + r() * (IX1 - IX0), y = lado ? IY0 + r() * (IY1 - IY0) : (r() < 0.5 ? IY0 + 3 : IY1 - 3); borron(x, y, 10 + r() * 14, 6 + r() * 6, C.musgo[2], 0.45); }
  // la sombra contra las paredes (el piso se oscurece al llegar al muro)
  const sombraMuro = (x0, y0, x1, y1, ancho) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, "rgba(0,0,0,0.5)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; return gr; };
  sombraMuro(0, IY0, 0, IY0 + 18); g.fillRect(IX0, IY0, IX1 - IX0, 18);
  sombraMuro(IX0, 0, IX0 + 16, 0); g.fillRect(IX0, IY0, 16, IY1 - IY0);
  sombraMuro(IX1, 0, IX1 - 16, 0); g.fillRect(IX1 - 16, IY0, 16, IY1 - IY0);
  sombraMuro(0, IY1, 0, IY1 - 10); g.fillRect(IX0, IY1 - 10, IX1 - IX0, 10);
  g.restore();

  // ── la luz: rayos que bajan desde arriba y un centro más claro ──
  g.save(); g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) {
    const x = IX0 + (IX1 - IX0) * (0.2 + i * 0.3 + (r() - 0.5) * 0.12), ancho = 16 + r() * 16, caida = 60 + r() * 50;
    const gr = g.createLinearGradient(0, 0, 0, IY0 + caida); gr.addColorStop(0, "rgba(255,244,220,0.09)"); gr.addColorStop(1, "rgba(255,244,220,0)");
    g.fillStyle = gr; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + ancho, 0); g.lineTo(x + ancho * 1.6 + 26, IY0 + caida); g.lineTo(x + 26, IY0 + caida); g.closePath(); g.fill();
  }
  const cxl = W / 2, cyl = IY0 + (IY1 - IY0) * 0.45, gr = g.createRadialGradient(cxl, cyl, 0, cxl, cyl, 150);
  gr.addColorStop(0, `rgba(${C.tinte.map((v) => v * 2 + 30).join(",")},0.16)`); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.restore();
  // detalles del capítulo (raíces en el muro, telarañas en las esquinas), con trazo fino y translúcido
  g.save(); g.strokeStyle = "rgba(210,210,200,0.22)"; g.lineWidth = 1;
  for (const [x, y, sx, sy] of [[IX0, IY0, 1, 1], [IX1, IY0, -1, 1]]) {
    for (let k = 0; k < 4; k++) { const a = k / 3 * Math.PI / 2; g.beginPath(); g.moveTo(x + 0.5, y + 0.5); g.lineTo(x + sx * Math.cos(a) * 16 + 0.5, y + sy * Math.sin(a) * 16 + 0.5); g.stroke(); }
    for (const rr of [6, 11]) { g.beginPath(); g.arc(x, y, rr, sx > 0 ? 0 : Math.PI / 2, sx > 0 ? Math.PI / 2 : Math.PI); g.stroke(); }
  }
  g.restore();
  if (capituloId === "raices") {
    g.save(); g.strokeStyle = "rgba(40,24,14,0.85)";
    for (let i = 0; i < 6; i++) { let x = IX0 + r() * (IX1 - IX0), y = 2; g.lineWidth = 2 + r() * 2; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 10; y += 5 + r() * 5; g.lineTo(x, y); } g.stroke(); }
    g.restore();
  }
  return cv;
}
function rgbaTxt(col, a) { const [R, G, B] = rgba(col); return `rgba(${R},${G},${B},${a})`; }

/** La viñeta de la sala: un degradé suave (sin tramado), como la luz de una vela. */
function vineta() {
  return hornear("vineta2", () => {
    const W = SALA_W + 40, H = SALA_H + 40, c = lienzoNuevo(W, H), g = c.getContext("2d");
    g.save(); g.translate(W / 2, H / 2); g.scale(1, H / W);
    const gr = g.createRadialGradient(0, 0, W * 0.2, 0, 0, W * 0.6);
    gr.addColorStop(0, "rgba(3,2,5,0)"); gr.addColorStop(0.55, "rgba(3,2,5,0.18)"); gr.addColorStop(0.8, "rgba(3,2,5,0.5)"); gr.addColorStop(1, "rgba(3,2,5,0.8)");
    g.fillStyle = gr; g.fillRect(-W, -W, W * 2, W * 2); g.restore();
    return c;
  });
}

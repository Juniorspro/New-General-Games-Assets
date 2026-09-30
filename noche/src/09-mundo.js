// ─────────────────────────────────────────────────────────────────────────────
// EL MUNDO: un suelo sin fin armado con baldosas de 32 px horneadas (pasto con matas y flores,
// camino de tierra en vertical como el bosque de las capturas) y adornos puestos por un hash de la
// celda: la misma celda, el mismo árbol, siempre, sin guardar nada.
// Los adornos no chocan: en el original el bosque es abierto, lo que importa es la multitud.
// ─────────────────────────────────────────────────────────────────────────────

const BAL = 32;
const hashCelda = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

const SUELOS = {
  pasto: { base: ["#2c4a1c", "#34581f", "#3e6624", "#4a742a"], matas: ["#223c16", "#5a8634", "#6a9a3c"], flores: ["#e8e0c8", "#ff90c0", "#ffe070", "#a0c0ff"], tierra: ["#4a3420", "#5a4028", "#6a4c30", "#7a5a38"], fondo: "#2c4a1c" },
  tumbas: { base: ["#1c2420", "#222c26", "#28342c", "#2e3a30"], matas: ["#141a16", "#3a4a3a", "#4a5a46"], flores: ["#8a8aa0", "#6a5a7a", "#c8c8d8", "#5a7a6a"], tierra: ["#2a2622", "#322c28", "#3a342e", "#443c34"], fondo: "#1c2420" },
};
/** Una baldosa de pasto: manchas de tono, matitas y (a veces) flores. */
function baldosaSpr(suelo, v) {
  return hornear(`bal|${suelo}|${v}`, () => {
    const S = SUELOS[suelo], p = new Pix(BAL, BAL), r = mulberry(1000 + v * 77);
    for (let y = 0; y < BAL; y++) for (let x = 0; x < BAL; x++) {
      // ruido suave y periódico (sin costuras entre baldosas): suma de senos con períodos que dividen 32
      const n = Math.sin((x + v * 5) * TAU / 32) * Math.cos((y + v * 3) * TAU / 16) * 0.5 + Math.sin((x + y) * TAU / 32 + v) * 0.5;
      p.p(x, y, S.base[lim(Math.floor((n * 0.5 + 0.5) * 3.2 + r() * 0.9), 0, 3)]);
    }
    for (let i = 0; i < 9; i++) { const x = Math.floor(r() * BAL), y = Math.floor(r() * BAL); p.p(x, y, S.matas[1]); p.p(x, y - 1, S.matas[2]); p.p(x - 1, y, S.matas[0]); p.p(x + 1, y + 1, S.matas[0]); }
    if (v % 3 === 0) for (let i = 0; i < 3; i++) { const x = 2 + Math.floor(r() * 28), y = 2 + Math.floor(r() * 28), c = S.flores[Math.floor(r() * 4)]; p.p(x, y, c); p.p(x + 1, y, c); p.p(x, y + 1, c); p.p(x + 1, y + 1, S.matas[0]); }
    return p.canvas();
  });
}
/** El camino de tierra: una franja vertical con bordes mordidos y piedritas. */
function caminoSpr(suelo, v) {
  return hornear(`cam|${suelo}|${v}`, () => {
    const S = SUELOS[suelo], p = new Pix(BAL, BAL), r = mulberry(5000 + v * 31);
    for (let y = 0; y < BAL; y++) for (let x = 0; x < BAL; x++) p.p(x, y, S.tierra[lim(Math.floor(1.2 + Math.sin((y + v * 7) * TAU / 32) * 0.6 + r() * 1.8), 0, 3)]);
    for (let i = 0; i < 6; i++) { const x = Math.floor(r() * BAL), y = Math.floor(r() * BAL); p.p(x, y, S.tierra[3]); p.p(x + 1, y, S.tierra[0]); }
    return p.canvas();
  });
}
function bordeCaminoSpr(suelo, lado) {
  return hornear(`bcam|${suelo}|${lado}`, () => {
    const S = SUELOS[suelo], p = new Pix(8, BAL), r = mulberry(lado ? 71 : 17);
    for (let y = 0; y < BAL; y++) { const w = Math.round(3 + Math.sin(y * TAU / 16) * 1.6 + r() * 1.5); for (let x = 0; x < w; x++) p.p(lado ? 7 - x : x, y, S.tierra[x === w - 1 ? 0 : 1]); }
    return p.canvas();
  });
}
// ── adornos ──
function arbolSpr(v) {
  return hornear(`arbol|${v}`, () => {
    const p = new Pix(30, 40), hojas = v ? ["#10240e", "#1c3a16", "#2a5220", "#3c6a2a"] : ["#0e1e10", "#183018", "#244624", "#345e30"];
    p.caja(13, 26, 4, 12, ["#2a180c", "#4a2c16", "#6a4020"], { vertical: 0.2 });
    p.bola(15, 16, 13, 12, hojas); p.bola(9, 22, 7, 6, hojas); p.bola(21, 22, 7, 6, hojas); p.bola(15, 8, 8, 7, hojas);
    p.contorno(AUTO, true);
    return p.canvas();
  });
}
function arbustoSpr() { return hornear("arbusto", () => { const p = new Pix(16, 11), h = ["#122a10", "#1e4418", "#2e5e22", "#46803a"]; p.bola(5, 6, 5, 4, h); p.bola(11, 6, 5, 4, h); p.bola(8, 4, 5, 4, h); p.contorno(AUTO, true); return p.canvas(); }); }
function lapidaSpr(v) {
  return hornear(`lapida|${v}`, () => {
    const p = new Pix(14, 18), pi = ["#2a2c30", "#4a4e54", "#6a7078", "#8a9098"];
    if (v === 0) { p.caja(2, 4, 10, 13, pi); p.bola(7, 5, 5, 4, pi); p.rect(5, 8, 4, 1, pi[0]); p.rect(6, 7, 2, 4, pi[0]); }
    else if (v === 1) { p.caja(6, 1, 3, 16, pi); p.caja(2, 5, 11, 3, pi); }
    else { p.caja(1, 9, 12, 8, pi); p.rect(3, 12, 8, 1, pi[0]); }
    p.contorno(AUTO, true); return p.canvas();
  });
}
function arbolMuertoSpr() {
  return hornear("arbolM", () => {
    const p = new Pix(24, 34), c = "#2a2226", c2 = "#453a3e";
    p.rect(11, 12, 3, 22, c2); p.rect(11, 12, 1, 22, c);
    for (const [x0, y0, x1, y1] of [[12, 16, 4, 6], [12, 14, 20, 4], [5, 8, 2, 2], [18, 6, 22, 1], [12, 22, 6, 17], [12, 20, 18, 15]]) { p.linea(x0, y0, x1, y1, c2); p.linea(x0 + 1, y0, x1 + 1, y1, c); }
    p.contorno(AUTO, true); return p.canvas();
  });
}
/** Qué adorno hay en la celda (x, y) de 32 px: null casi siempre. */
function adornoDe(suelo, cx, cy) {
  const h = hashCelda(cx, cy, 9);
  if (Math.abs(cx) <= 1) return null;           // el camino queda libre
  if (suelo === "pasto") { if (h < 0.075) return { spr: arbolSpr(h < 0.035 ? 1 : 0), dx: 1, dy: -8 }; if (h < 0.12) return { spr: arbustoSpr(), dx: 8, dy: 12 }; }
  else { if (h < 0.06) return { spr: lapidaSpr(Math.floor(h * 50) % 3), dx: 9, dy: 8 }; if (h < 0.08) return { spr: arbolMuertoSpr(), dx: 4, dy: -4 }; }
  return null;
}
/** Dibuja el suelo visible y devuelve los adornos para ordenarlos con los personajes. */
function dibujarSuelo(suelo, camX, camY) {
  const x0 = Math.floor(camX / BAL) - 1, y0 = Math.floor(camY / BAL) - 1, x1 = Math.floor((camX + W) / BAL) + 1, y1 = Math.floor((camY + H) / BAL) + 1;
  const adornos = [];
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const X = Math.round(cx * BAL - camX), Y = Math.round(cy * BAL - camY);
    if (Math.abs(cx) <= 0) g.drawImage(caminoSpr(suelo, ((cy % 4) + 4) % 4), X, Y);
    else g.drawImage(baldosaSpr(suelo, Math.floor(hashCelda(cx, cy) * 6)), X, Y);
    if (cx === -1) g.drawImage(bordeCaminoSpr(suelo, 1), X + BAL - 8 + 4, Y);
    if (cx === 1) g.drawImage(bordeCaminoSpr(suelo, 0), X - 4, Y);
    const a = adornoDe(suelo, cx, cy);
    if (a) adornos.push({ spr: a.spr, x: cx * BAL + a.dx, y: cy * BAL + a.dy, pie: cy * BAL + a.dy + a.spr.height });
  }
  return adornos;
}
let _vineta = null;
/** La viñeta (se oscurece hacia los bordes): se hornea una vez por tamaño de pantalla. */
function vineta(fuerza) {
  if (!_vineta || _vineta.width !== W || _vineta.height !== H || _vineta.f !== fuerza) {
    _vineta = lienzoNuevo(W, H); _vineta.f = fuerza;
    const q = _vineta.getContext("2d"), gr = q.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, `rgba(4,2,10,${fuerza})`); q.fillStyle = gr; q.fillRect(0, 0, W, H);
  }
  g.drawImage(_vineta, 0, 0);
}

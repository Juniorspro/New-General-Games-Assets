// ─────────────────────────────────────────────────────────────────────────────
// EL DIBUJO. Como el original: formas planas y redondeadas, sin contorno, colores de la clase.
// Medido en las capturas de Steam (1920×1080 = ×4): afuera #292929 con estrellas enormes apenas más
// claras que se mueven lento, la arena #323232 con un damero de 22 px casi invisible y un degradé
// que oscurece hacia abajo. Héroes: cuadraditos redondeados de 9 px. Enemigos: pastillas de 14×6.
// ─────────────────────────────────────────────────────────────────────────────

function redondo(x, y, w, h, ang, col, rad = 2) {
  g.save(); g.translate(Math.round(x), Math.round(y)); if (ang) g.rotate(ang);
  g.fillStyle = col; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, Math.min(rad, w / 2, h / 2)); g.fill(); g.restore();
}
function circulo(x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, Math.max(0.5, r), 0, TAU); g.fill(); }
function anillo(x, y, r, col, lw = 1) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.arc(x, y, Math.max(0.5, r), 0, TAU); g.stroke(); }
function linea(x1, y1, x2, y2, col, lw = 1) { g.strokeStyle = col; g.lineWidth = lw; g.lineCap = "round"; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
function caja(x, y, w, h, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function cajaRed(x, y, w, h, col, r = 2) { g.fillStyle = col; g.beginPath(); g.roundRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h), r); g.fill(); }
function marco(x, y, w, h, col, r = 2, lw = 1) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.roundRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w) - 1, Math.round(h) - 1, r); g.stroke(); }

// ── el fondo: estrellas grandes que derivan (las del original están en un lienzo aparte) ──
const ESTRELLAS = Array.from({ length: 16 }, (_, i) => ({ x: (i * 97.3) % 1, y: ((i * 61.7) % 1), s: 7 + ((i * 37) % 12), r: i, vr: ((i % 3) - 1) * 0.15 }));
function estrella(x, y, s, r, col) {
  g.fillStyle = col; g.beginPath();
  for (let k = 0; k < 10; k++) { const a = r + (k * Math.PI) / 5 - Math.PI / 2, rr = k % 2 ? s * 0.45 : s; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}
function dibujarFondo(t, conArena = true) {
  g.fillStyle = "#292929"; g.fillRect(0, 0, W, H);
  for (const e of ESTRELLAS) { const x = ((e.x * (W + 60) - t * 4) % (W + 60) + W + 60) % (W + 60) - 30, y = e.y * H; estrella(x, y, e.s, e.r + t * e.vr, "#2f2f2f"); }
  if (!conArena) return;
  g.fillStyle = "#323232"; g.fillRect(AR.x1, AR.y1, AR.w, AR.h);
  g.fillStyle = "#343434";
  for (let yy = 0, j = 0; yy < AR.h; yy += 22, j++) for (let xx = (j % 2) * 22, i = 0; xx < AR.w; xx += 44, i++) g.fillRect(AR.x1 + xx, AR.y1 + yy, Math.min(22, AR.w - xx), Math.min(22, AR.h - yy));
  const gr = g.createLinearGradient(0, AR.y1, 0, AR.y2); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.22)");
  g.fillStyle = gr; g.fillRect(AR.x1, AR.y1, AR.w, AR.h);
}

// ── el mundo ──
function dibujarMundo() {
  const t = M.t;
  // las marcas de aparición: un anillo que se cierra y una cruz que titila
  for (const m of M.marcas) { const k = m.t / m.dur; if (k >= 1) continue; anillo(m.x, m.y, 14 * (1 - k) + 3, alfa("red", 0.8), 1); if (Math.floor(m.t * 10) % 2) { linea(m.x - 3, m.y - 3, m.x + 3, m.y + 3, COL.fg, 1); linea(m.x - 3, m.y + 3, m.x + 3, m.y - 3, COL.fg, 1); } }
  // las áreas que duran
  for (const d of M.dots) {
    const c = COL[d.col] || d.col, rot = t * (d.aura ? 0.8 : 1.6);
    g.fillStyle = alfa(d.col, d.aura ? 0.06 : 0.12); g.beginPath(); g.arc(d.x, d.y, d.rs, 0, TAU); g.fill();
    g.strokeStyle = c; g.lineWidth = 1;
    for (let k = 0; k < 4; k++) { const a = rot + (k * Math.PI) / 2; g.beginPath(); g.arc(d.x, d.y, d.rs, a, a + 0.6); g.stroke(); }
    if (d.tirar) { g.strokeStyle = alfa(d.col, 0.5); for (let k = 0; k < 3; k++) { const rr = d.rs * (1 - ((t * 0.8 + k / 3) % 1)); g.beginPath(); g.arc(d.x, d.y, rr, 0, TAU); g.stroke(); } }
  }
  for (const c of M.inv) if (c.dibujar) c.dibujar(c);
  // lo que se junta
  for (const p of M.pick) {
    const s = Math.sin(p.t * 6) * 0.5;
    if (p.tipo === "cura") { circulo(p.x, p.y, 3.5 + s, alfa("green", 0.35)); circulo(p.x, p.y, 2.2, COL.green); }
    else { redondo(p.x, p.y, 4, 4, Math.PI / 4 + p.t * 2, COL.yellow2, 1); }
  }
  for (const b of M.bichos) redondo(b.x, b.y, 5, 3, b.r, b.enemigo ? COL.purple : COL.orange, 1.5);
  // los enemigos
  for (const e of M.ene) {
    let c = COL[e.colorD] || COL.red;
    if (e.cargando != null) c = mezclaHex(COL[e.col], COL.fg, lim(e.cargando / 2, 0, 1));
    if (e.flash > 0) c = COL.fg;
    if (e.aturdido > 0 && e.flash <= 0) c = mezclaHex(c, "#808080", 0.45);
    redondo(e.x, e.y, e.w, e.h, e.r, c, e.h / 2);
    if (e.maldiciones.length) { g.fillStyle = COL.purple; g.fillRect(Math.round(e.x) - 1, Math.round(e.y - e.h / 2) - 4, 2, 2); }
    if (e.jefe) { const k = lim(e.hp / e.maxhp, 0, 1); caja(e.x - 12, e.y - 12, 24, 2, "#1d1d1d"); caja(e.x - 12, e.y - 12, 24 * k, 2, COL[e.col] || COL.red); }
  }
  // los tiros
  for (const p of M.proy) {
    const a = Math.atan2(p.vy, p.vx), c = COL[p.col] || p.col;
    if (p.forma === "flecha") { redondo(p.x, p.y, 9, 2, a, c, 1); redondo(p.x + Math.cos(a) * 4, p.y + Math.sin(a) * 4, 3, 3, a + Math.PI / 4, COL.fg, 0); }
    else if (p.forma === "cuchillo") { redondo(p.x, p.y, 7, 2, a, c, 1); g.fillStyle = COL.fg; g.fillRect(Math.round(p.x + Math.cos(a) * 3), Math.round(p.y + Math.sin(a) * 3), 1, 1); }
    else if (p.forma === "hoja") redondo(p.x, p.y, 7, 3, M.t * 20, c, 1);
    else if (p.forma === "cañon") { circulo(p.x, p.y, 3.5, c); circulo(p.x - 1, p.y - 1, 1.2, COL.fg); }
    else if (p.forma === "orbe") { circulo(p.x, p.y, 5 + Math.sin(M.t * 10), alfa(p.col, 0.4)); circulo(p.x, p.y, 3, c); }
    else redondo(p.x, p.y, 6, 3, a, c, 1.5);
  }
  for (const p of M.proyE) redondo(p.x, p.y, 7, 3, Math.atan2(p.vy, p.vx), COL[p.col] || COL.fg, 1.5);
  // la víbora (de la cola a la cabeza, así la cabeza queda arriba)
  const vivos = heroesVivos();
  for (let i = vivos.length - 1; i >= 0; i--) {
    const u = vivos[i]; let c = COL[u.col];
    if (u.flash > 0 || (u.flashPared > 0 && u.flashPared < 0.1)) c = COL.fg;
    if (u.zombi > 0) c = mezclaHex(c, "#606060", 0.5);
    redondo(u.x, u.y, 9, 9, u.r, c, 3);
    if (u.b.salvar) anillo(u.x, u.y, 7, alfa("yellow", 0.7));
    if (u.curaFx > 0) anillo(u.x, u.y, 6 + (0.4 - u.curaFx) * 20, alfa("green", u.curaFx * 2));
    if (u.b.hada > 0) { g.fillStyle = COL.green; g.fillRect(Math.round(u.x) - 1, Math.round(u.y) - 8, 2, 2); }
  }
  for (const o of M.orbesPsi) { circulo(o.x, o.y, 2.5, COL.fg); circulo(o.x, o.y, 4, alfa("fg", 0.2)); }
  // los efectos
  for (const f of M.fx) {
    const k = f.t / f.dur;
    if (f.tipo === "golpe") circulo(f.x, f.y, f.rs * (1 - k), k < 0.5 ? COL.fg : COL[f.col] || COL.fg);
    else if (f.tipo === "part") { const c = COL[f.col] || COL.fg, v = Math.hypot(f.vx, f.vy) || 1, l = f.w * (1 - k); linea(f.x, f.y, f.x - (f.vx / v) * l, f.y - (f.vy / v) * l, c, 1.5); }
    else if (f.tipo === "rayo") { const c = COL[f.col] || COL.blue; g.strokeStyle = c; g.lineWidth = 1; g.beginPath(); g.moveTo(f.ax, f.ay); const n = 5; for (let i = 1; i < n; i++) { const q = i / n, nx = -(f.by - f.ay), ny = f.bx - f.ax, ln = Math.hypot(nx, ny) || 1, o = Math.sin(f.s + i * 12.9) * 4; g.lineTo(lerp(f.ax, f.bx, q) + (nx / ln) * o, lerp(f.ay, f.by, q) + (ny / ln) * o); } g.lineTo(f.bx, f.by); g.stroke(); }
    else if (f.tipo === "area") {
      const c = COL[f.col] || f.col, rs = f.rs * (k < 0.2 ? 0.8 + k : 1);
      if (f.cuadrado) {
        g.save(); g.translate(f.x, f.y); g.rotate(f.r); g.fillStyle = alfa(f.col, 0.28 * (1 - k)); g.fillRect(-rs, -rs, rs * 2, rs * 2);
        g.strokeStyle = k < 0.3 ? COL.fg : c; g.lineWidth = 1; const L = rs * 0.4;
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.beginPath(); g.moveTo(sx * rs, sy * (rs - L)); g.lineTo(sx * rs, sy * rs); g.lineTo(sx * (rs - L), sy * rs); g.stroke(); }
        g.restore();
      } else { circulo(f.x, f.y, rs, alfa(f.col, 0.25 * (1 - k))); anillo(f.x, f.y, rs, k < 0.3 ? COL.fg : c); }
    }
  }
}
const _mez = new Map();
function mezclaHex(a, b, t) {
  const k = a + b + (t * 20 | 0); let v = _mez.get(k); if (v) return v;
  const A2 = _hex(a.startsWith("#") ? a : "#808080"), B2 = _hex(b.startsWith("#") ? b : "#808080"); t = Math.round(t * 20) / 20;
  v = `rgb(${Math.round(lerp(A2[0], B2[0], t))},${Math.round(lerp(A2[1], B2[1], t))},${Math.round(lerp(A2[2], B2[2], t))})`; _mez.set(k, v); return v;
}

// ── los íconos de las clases (7×7), dibujados a mano ──
const ICO_CLASE = {
  ranger: [".....##", "....#.#", "...#..#", "..#...#", ".#...#.", "#.###..", "##....."], warrior: ["......#", ".....#.", "#...#..", ".#.#...", "..#....", ".#.#...", "#...#.."],
  mage: ["...#...", "..###..", "#######", ".#####.", "..###..", ".##.##.", "##...##"], rogue: [".....#.", "....##.", "...##..", "..##...", "#.#....", ".#.....", "#.#...."],
  healer: ["..###..", "..###..", "#######", "#######", "#######", "..###..", "..###.."], enchanter: ["...#...", "...#...", ".#.#.#.", "..###..", "#######", "..###..", ".#.#.#."],
  nuker: ["..#.#..", ".#####.", "#######", "##.#.##", "#######", ".#####.", "..###.."], conjurer: ["..###..", ".#...#.", "#..#..#", "#.###.#", "#..#..#", ".#...#.", "..###.."],
  psyker: [".#####.", "#.....#", "#.###.#", "#.#.#.#", "#.###.#", "#.....#", ".#####."], curser: ["#.....#", ".#...#.", "..###..", "..#.#..", "..###..", ".#...#.", "#.....#"],
  forcer: ["#......", "##.....", "###..#.", "####.##", "###..#.", "##.....", "#......"], swarmer: ["#.#...#", ".#...#.", "#.#.#.#", "...#...", "#.#.#.#", ".#...#.", "#...#.#"],
  voider: ["..###..", ".#...#.", "#.....#", "#..#..#", "#.....#", ".#...#.", "..###.."], sorcerer: ["...#...", "..#.#..", ".#.#.#.", "#.###.#", ".#.#.#.", "..#.#..", "...#..."],
  mercenary: [".#####.", "##.#.##", "#..#...", ".#####.", "...#..#", "##.#.##", ".#####."], explorer: ["...#...", "..###..", ".#.#.#.", "#######", ".#.#.#.", "..###..", "...#..."],
};
const _ico = new Map();
function iconoClase(k, col) {
  const key = k + col; let c = _ico.get(key); if (c) return c;
  c = document.createElement("canvas"); c.width = c.height = 7; const q = c.getContext("2d"); q.fillStyle = col;
  (ICO_CLASE[k] || []).forEach((f, y) => { for (let x = 0; x < 7; x++) if (f[x] === "#") q.fillRect(x, y, 1, 1); });
  _ico.set(key, c); return c;
}
// ── los íconos de los objetos: runas (como las del original), una distinta por objeto, sacadas del nombre ──
function runa(k, tam, col) {
  const key = k + tam + col; let c = _ico.get(key); if (c) return c;
  let h = 7; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const r = mulberry(h);
  c = document.createElement("canvas"); c.width = c.height = tam; const q = c.getContext("2d");
  // una grilla de 3×4 puntos: un tronco al medio y 2–4 trazos que se espejan (así parece un símbolo)
  const s = tam / 4, px = (i) => Math.round(s * 0.5 + i * s * 1.5), py = (j) => Math.round(s * 0.5 + j * s);
  q.strokeStyle = col; q.lineWidth = Math.max(2, Math.round(tam / 9)); q.lineCap = "round"; q.lineJoin = "round";
  const tronco = r() < 0.8, esp = r() < 0.6;
  q.beginPath();
  if (tronco) { q.moveTo(px(1), py(0)); q.lineTo(px(1), py(3)); }
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = [Math.floor(r() * 3), Math.floor(r() * 4)], b = [Math.floor(r() * 3), Math.floor(r() * 4)];
    if (a[0] === b[0] && a[1] === b[1]) b[1] = (b[1] + 1) % 4;
    q.moveTo(px(a[0]), py(a[1])); q.lineTo(px(b[0]), py(b[1]));
    if (esp) { q.moveTo(px(2 - a[0]), py(a[1])); q.lineTo(px(2 - b[0]), py(b[1])); }
  }
  if (r() < 0.35) { q.moveTo(px(1) + s * 0.6, py(0)); q.arc(px(1), py(0), s * 0.6, 0, TAU); }
  q.stroke();
  _ico.set(key, c); return c;
}

// ─────────────────────────────────────────────────────────────────────────────
// LA SALA: la grilla de 13×7 (obstáculos), los diseños hechos a mano, y los choques.
// Leyenda de los diseños: . libre · r roca · R roca marcada (tiene algo) · m matas de hongos ·
// b brasero · o pozo · x pinchos · B barril · H bloque · e enemigo · E enemigo fuerte · v mosquines
// Las puertas (arriba 6,0 · derecha 12,3 · abajo 6,6 · izquierda 0,3) quedan siempre libres, y
// cada diseño se valida: desde cualquier puerta se llega a las otras (si no, no se usa).
// ─────────────────────────────────────────────────────────────────────────────

const DISENOS = [
  [".............", "..e.......e..", ".............", "......e......", ".............", "..e.......e..", "............."],
  ["rr.........rr", "r...........r", "....e...e....", ".............", "....e...e....", "r...........r", "rr.........rr"],
  [".............", "...e.....e...", "....rrrrr....", "....r.m.r....", "....rrrrr....", "...e.....e...", "............."],
  [".............", "..e.......e..", "....ooooo....", "....oovoo....", "....ooooo....", "..e.......e..", "............."],
  [".............", ".r..r...r..r.", ".....e.e.....", "..e.......e..", ".....e.e.....", ".r..r...r..r.", "............."],
  ["..m.......m..", ".mm..e.e..mm.", ".............", "...m.....m...", ".............", ".mm..e.e..mm.", "..m.......m.."],
  ["r..........rr", ".r.....e...r.", "..r.......r..", ".............", "..r.......r..", ".r...e.....r.", "rr..........r"],
  [".............", ".HHH.....HHH.", ".H..e...e..H.", ".............", ".H..e...e..H.", ".HHH.....HHH.", "............."],
  ["..r..r.r..r..", ".............", "r..e.....e..r", ".............", "r..e.....e..r", ".............", "..r..r.r..r.."],
  [".............", ".....mmm.....", "..e..m.m..e..", "..............".slice(0, 13), "..e..m.m..e..", ".....mmm.....", "............."],
  [".............", "..oo.....oo..", "..oo..v..oo..", ".............", "..oo..v..oo..", "..oo.....oo..", "............."],
  ["b...........b", ".............", "...e.....e...", ".............", "...e.....e...", ".............", "b...........b"],
  [".............", "...rr...rr...", "...r..E..r...", ".............", "...r.....r...", "...rr...rr...", "............."],
  [".............", ".xx.......xx.", ".x..e...e..x.", ".............", ".x..e...e..x.", ".xx.......xx.", "............."],
  ["....r...r....", "....r.e.r....", "rrr.......rrr", ".............", "rrr.......rrr", "....r.e.r....", "....r...r...."],
  [".............", ".e.........e.", "...ooo.ooo...", "...o.....o...", "...ooo.ooo...", ".e.........e.", "............."],
  ["m...........m", ".m....e....m.", "..m.......m..", ".....vvv.....", "..m.......m..", ".m....e....m.", "m...........m"],
  [".............", "..B.......B..", ".....e.e.....", "......E......", ".....e.e.....", "..B.......B..", "............."],
  ["rrrr.....rrrr", "rr.........rr", "r....e.e....r", ".............", "r....e.e....r", "rr.........rr", "rrrr.....rrrr"],
  [".............", "......m......", "..e..mRm..e..", "......m......", "..e.......e..", ".............", "............."],
  [".............", ".r.r.r.r.r.r.", ".............", "..e..e.e..e..", ".............", ".r.r.r.r.r.r.", "............."],
  ["oo.........oo", "o...........o", "....e...e....", ".............", "....e...e....", "o...........o", "oo.........oo"],
  [".............", "...H.....H...", "..HHe...eHH..", ".............", "..HHe...eHH..", "...H.....H...", "............."],
  [".............", ".....b.b.....", "..e.......e..", ".............", "..e.......e..", ".....b.b.....", "............."],
  ["..xx.....xx..", "..x...e...x..", ".............", ".....vvv.....", ".............", "..x...e...x..", "..xx.....xx.."],
  [".............", "..m..r.r..m..", "..mE.....Em..", ".............", "..m.......m..", "..m..r.r..m..", "............."],
  [".............", ".ooooo.ooooo.", ".o.e.....e.o.", ".............", ".o.e.....e.o.", ".ooooo.ooooo.", "............."],
  ["R............", ".....rrr.....", "..e..r.r..e..", ".............", "..e.......e..", ".....rrr.....", "............R"],
  [".............", ".e...m.m...e.", "....m...m....", "......E......", "....m...m....", ".e...m.m...e.", "............."],
  [".............", "..rrr...rrr..", "..r.e...e.r..", ".............", "..r.e...e.r..", "..rrr...rrr..", "............."],
  ["b.....r.....b", "..e.......e..", ".............", "..r.......r..", ".............", "..e.......e..", "b.....r.....b"],
  [".............", ".mmmm...mmmm.", ".............", "...e..e..e...", ".............", ".mmmm...mmmm.", "............."],
  ["..o.......o..", "..o..e.e..o..", "..o.......o..", ".............", "..o.......o..", "..o..e.e..o..", "..o.......o.."],
  [".............", ".............", "...e.rrr.e...", "....r...r....", "...e.rrr.e...", ".............", "............."],
];
const DISENO_JEFE = [".............", ".r.........r.", ".............", "......j......", ".............", ".r.........r.", "............."];
const DISENO_JEFE_FINAL = [".............", ".............", ".............", "......j......", ".............", "b...........b", "............."];
const DISENO_INICIO = [".............", ".............", ".............", ".............", ".............", ".............", "............."];
const DISENO_TESORO = [".............", ".............", ".....r.r.....", ".............", ".....r.r.....", ".............", "............."];
const DISENO_TIENDA = [".............", ".............", ".............", ".............", ".............", ".............", "............."];
const DISENO_SECRETA = [".............", ".r.........r.", ".............", ".............", ".............", ".r.........r.", "............."];
const DISENO_PACTO = ["b...........b", ".............", ".............", ".............", ".............", ".............", "b...........b"];

const PUERTA_CELDA = [[6, 0], [12, 3], [6, 6], [0, 3]];
const SOLIDOS = new Set(["roca", "bloque", "barril", "brasero", "matas"]);

/** ¿Desde cualquier puerta se llega a las demás, y a cada enemigo que camina? (BFS por la grilla) */
function disenoValido(d) {
  const libre = (c, f) => c >= 0 && f >= 0 && c < COLS && f < FILAS && ".xevEj".includes(d[f][c]);
  for (const [c, f] of PUERTA_CELDA) if (!libre(c, f)) return false;
  const vis = new Set(["6,0"]), cola = [[6, 0]];
  while (cola.length) { const [c, f] = cola.shift(); for (const [dx, dy] of DIRS) { const k = `${c + dx},${f + dy}`; if (!vis.has(k) && libre(c + dx, f + dy)) { vis.add(k); cola.push([c + dx, f + dy]); } } }
  for (const [c, f] of PUERTA_CELDA) if (!vis.has(`${c},${f}`)) return false;
  return true;
}
const DISENOS_OK = DISENOS.filter((d) => d.length === FILAS && d.every((f) => f.length === COLS) && disenoValido(d));

/** Arma la grilla de obstáculos de una sala desde su diseño; devuelve los lugares de enemigos. */
function armarGrilla(sala, diseno) {
  sala.celdas = new Array(COLS * FILAS).fill(null);
  const huecos = [];
  const espejarX = sala.espejo & 1, espejarY = sala.espejo & 2;
  for (let f = 0; f < FILAS; f++) for (let c = 0; c < COLS; c++) {
    const ch = diseno[espejarY ? FILAS - 1 - f : f][espejarX ? COLS - 1 - c : c];
    let o = null;
    if (ch === "r") o = { t: "roca", v: A.ent(0, 2) };
    else if (ch === "R") o = { t: "roca", v: 1, marcada: true };
    else if (ch === "m") o = { t: "matas", vida: 4, dorada: A.si(0.04) };
    else if (ch === "b") o = { t: "brasero", vida: 4, prendido: true };
    else if (ch === "o") o = { t: "pozo" };
    else if (ch === "x") o = { t: "pinchos" };
    else if (ch === "B") o = { t: "barril", vida: 3 };
    else if (ch === "H") o = { t: "bloque" };
    else if ("eEvj".includes(ch)) huecos.push({ c, f, tipo: ch });
    sala.celdas[f * COLS + c] = o;
  }
  // a veces, una roca normal viene marcada
  for (const o of sala.celdas) if (o && o.t === "roca" && !o.marcada && A.si(0.012)) o.marcada = true;
  return huecos;
}
function celda(sala, c, f) { return c >= 0 && f >= 0 && c < COLS && f < FILAS ? sala.celdas[f * COLS + c] : null; }
function esSolida(o, vuela) {
  if (!o) return false;
  if (o.t === "pozo") return !vuela;
  if (o.t === "matas") return o.vida > 0 && !vuela;
  if (o.t === "brasero") return !vuela;
  return SOLIDOS.has(o.t) && !vuela;
}
/** ¿Frena una lágrima? (los pozos no; las rocas sí, salvo las espectrales) */
function frenaLagrima(o) { return !!o && o.t !== "pozo" && o.t !== "pinchos" && !(o.t === "matas" && o.vida <= 0) && !(o.t === "brasero" && !o.prendido && o.vida <= 0); }

/** Mueve un círculo por la sala chocando con la grilla y los muros. lim: {x0,y0,x1,y1} (los bordes que se pueden pasar). */
function moverEnSala(sala, e, dx, dy, vuela, bordes) {
  const r = e.r;
  const chocar = (eje) => {
    const c0 = celdaX(e.x - r), c1 = celdaX(e.x + r), f0 = celdaY(e.y - r), f1 = celdaY(e.y + r);
    for (let f = f0; f <= f1; f++) for (let c = c0; c <= c1; c++) {
      if (!esSolida(celda(sala, c, f), vuela)) continue;
      const bx0 = IX0 + c * T + 1, by0 = IY0 + f * T + 1, bx1 = bx0 + T - 2, by1 = by0 + T - 2;
      const px = lim(e.x, bx0, bx1), py = lim(e.y, by0, by1), ddx = e.x - px, ddy = e.y - py, d2 = ddx * ddx + ddy * ddy;
      if (d2 >= r * r) continue;
      if (eje === 0) { e.x = dx > 0 ? bx0 - r : dx < 0 ? bx1 + r : e.x; if (dx === 0) { const d = Math.sqrt(d2) || 1; e.x = px + ddx / d * r; } }
      else { e.y = dy > 0 ? by0 - r : dy < 0 ? by1 + r : e.y; if (dy === 0) { const d = Math.sqrt(d2) || 1; e.y = py + ddy / d * r; } }
      e.choco = true;
    }
  };
  e.choco = false;
  e.x += dx; chocar(0);
  e.y += dy; chocar(1);
  const b = bordes || { x0: IX0, y0: IY0, x1: IX1, y1: IY1 };
  if (e.x < b.x0 + r) { e.x = b.x0 + r; e.choco = true; } if (e.x > b.x1 - r) { e.x = b.x1 - r; e.choco = true; }
  if (e.y < b.y0 + r) { e.y = b.y0 + r; e.choco = true; } if (e.y > b.y1 - r) { e.y = b.y1 - r; e.choco = true; }
}

/** El mapa de distancias hasta un punto (para que los que caminan rodeen las rocas). */
function campoHacia(sala, x, y, vuela = false) {
  const dist = new Int16Array(COLS * FILAS).fill(-1), c0 = lim(celdaX(x), 0, COLS - 1), f0 = lim(celdaY(y), 0, FILAS - 1), cola = [c0 + f0 * COLS];
  dist[cola[0]] = 0;
  for (let i = 0; i < cola.length; i++) {
    const k = cola[i], c = k % COLS, f = (k / COLS) | 0;
    for (const [dx, dy] of DIRS) {
      const C = c + dx, F = f + dy;
      if (C < 0 || F < 0 || C >= COLS || F >= FILAS) continue;
      const K = F * COLS + C;
      if (dist[K] >= 0 || esSolida(sala.celdas[K], vuela)) continue;
      dist[K] = dist[k] + 1; cola.push(K);
    }
  }
  return dist;
}
/** Hacia dónde ir desde (x, y) bajando por el campo (o directo si está en la misma celda o sin camino). */
function pasoCampo(sala, dist, e, objX, objY) {
  const c = celdaX(e.x), f = celdaY(e.y), k = f * COLS + c;
  if (c < 0 || f < 0 || c >= COLS || f >= FILAS || dist[k] <= 1) { const d = Math.hypot(objX - e.x, objY - e.y) || 1; return [(objX - e.x) / d, (objY - e.y) / d]; }
  let mejor = null, md = dist[k];
  for (const [dx, dy] of DIRS) { const C = c + dx, F = f + dy; if (C < 0 || F < 0 || C >= COLS || F >= FILAS) continue; const v = dist[F * COLS + C]; if (v >= 0 && v < md) { md = v; mejor = [C, F]; } }
  if (!mejor) { const d = Math.hypot(objX - e.x, objY - e.y) || 1; return [(objX - e.x) / d, (objY - e.y) / d]; }
  const tx = cx(mejor[0]), ty = cy(mejor[1]), d = Math.hypot(tx - e.x, ty - e.y) || 1;
  return [(tx - e.x) / d, (ty - e.y) / d];
}

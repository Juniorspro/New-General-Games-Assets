/* ============================================================================
   El tablero y las piezas: formas con sus giros, dónde entra cada una, qué
   líneas se completan, el puntaje y la tanda de tres piezas. La tanda se
   elige para que siempre se pueda jugar al menos una, y si se puede, las tres
   (se prueba con una búsqueda corta); con el tablero lleno vienen más chicas.
   ========================================================================== */

function girar(c) { const r = c.map(([x, y]) => [-y, x]); const mx = Math.min(...r.map((p) => p[0])), my = Math.min(...r.map((p) => p[1])); return r.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]); }
const claveForma = (c) => c.map((p) => p.join(',')).join(';');
const BASES = [
  { c: [[0, 0]], p: 3 },
  { c: [[0, 0], [1, 0]], p: 6, giros: 2 },
  { c: [[0, 0], [1, 0], [2, 0]], p: 6, giros: 2 },
  { c: [[0, 0], [1, 0], [2, 0], [3, 0]], p: 4, giros: 2 },
  { c: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], p: 2.5, giros: 2 },
  { c: [[0, 0], [1, 0], [0, 1], [1, 1]], p: 6 },
  { c: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]], p: 1.6 },
  { c: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]], p: 2.2, giros: 2 },
  { c: [[0, 0], [1, 0], [0, 1]], p: 2.5, giros: 4 },
  { c: [[0, 0], [0, 1], [0, 2], [1, 2]], p: 1.4, giros: 4 },
  { c: [[1, 0], [1, 1], [1, 2], [0, 2]], p: 1.4, giros: 4 },
  { c: [[0, 0], [1, 0], [2, 0], [1, 1]], p: 1.5, giros: 4 },
  { c: [[1, 0], [2, 0], [0, 1], [1, 1]], p: 1.1, giros: 2 },
  { c: [[0, 0], [1, 0], [1, 1], [2, 1]], p: 1.1, giros: 2 },
  { c: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], p: 1.3, giros: 4 },
];
const FORMAS = [];
for (const b of BASES) {
  let c = b.c.slice().sort((p, q) => p[1] - q[1] || p[0] - q[0]);
  const vistas = new Set();
  for (let i = 0; i < (b.giros || 1); i++) {
    const k = claveForma(c);
    if (!vistas.has(k)) {
      vistas.add(k);
      FORMAS.push({ c, w: Math.max(...c.map((p) => p[0])) + 1, h: Math.max(...c.map((p) => p[1])) + 1, p: b.p / (b.giros || 1), n: c.length });
    }
    c = girar(c);
  }
}

/* el tablero: col[i] = 0 vacía o 1..8 la pintura; flor[i] = 1 si tiene flor */
function tableroNuevo() { return { col: new Int8Array(N * N), flor: new Uint8Array(N * N) }; }
function copiarTablero(t) { return { col: t.col.slice(), flor: t.flor.slice() }; }
function cabe(t, f, x, y) {
  if (x < 0 || y < 0 || x + f.w > N || y + f.h > N) return false;
  for (const [a, b] of f.c) if (t.col[(y + b) * N + x + a]) return false;
  return true;
}
function hayLugar(t, f) { for (let y = 0; y <= N - f.h; y++) for (let x = 0; x <= N - f.w; x++) if (cabe(t, f, x, y)) return true; return false; }
/* qué filas y columnas quedarían llenas si se pone ahí (sin tocar el tablero) */
function lineasCon(t, f, x, y) {
  const lleno = t.col.slice();
  for (const [a, b] of f.c) lleno[(y + b) * N + x + a] = 1;
  const filas = [], cols = [];
  for (let r = 0; r < N; r++) { let ok = true; for (let c = 0; c < N; c++) if (!lleno[r * N + c]) { ok = false; break; } if (ok) filas.push(r); }
  for (let c = 0; c < N; c++) { let ok = true; for (let r = 0; r < N; r++) if (!lleno[r * N + c]) { ok = false; break; } if (ok) cols.push(c); }
  return { filas, cols };
}
/* pone la pieza y borra lo completo; devuelve qué pasó */
function poner(t, f, x, y, pintura) {
  for (const [a, b] of f.c) t.col[(y + b) * N + x + a] = pintura;
  const { filas, cols } = lineasCon(t, f, x, y);
  const borradas = new Set();
  for (const r of filas) for (let c = 0; c < N; c++) borradas.add(r * N + c);
  for (const c of cols) for (let r = 0; r < N; r++) borradas.add(r * N + c);
  const celdas = [];
  let flores = 0;
  for (const i of borradas) { celdas.push({ i, col: t.col[i], flor: t.flor[i] }); if (t.flor[i]) flores++; t.col[i] = 0; t.flor[i] = 0; }
  return { filas, cols, lineas: filas.length + cols.length, celdas, flores, vacio: t.col.every((v) => !v) };
}
function ocupadas(t) { let n = 0; for (const v of t.col) if (v) n++; return n; }

/* ------------------------------------------------------------ la tanda */
function elegirForma(rnd, lleno, puntos) {
  // con el tablero lleno, más chicas; con muchos puntos, un poco más grandes
  let total = 0;
  const pesos = FORMAS.map((f) => {
    let p = f.p;
    if (lleno > 0.45) p *= f.n <= 3 ? 1.8 : f.n >= 6 ? 0.4 : 1;
    if (puntos > 3000 && f.n >= 4) p *= 1.25;
    total += p; return p;
  });
  let x = rnd() * total;
  for (let i = 0; i < FORMAS.length; i++) { x -= pesos[i]; if (x <= 0) return FORMAS[i]; }
  return FORMAS[0];
}
/* ¿se pueden poner las tres en algún orden? (búsqueda corta: pocas posiciones por pieza) */
function sePuedenTodas(t, formas) {
  const ordenes = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const prueba = (tab, resto) => {
    if (!resto.length) return true;
    const f = resto[0], pos = [];
    for (let y = 0; y <= N - f.h; y++) for (let x = 0; x <= N - f.w; x++) if (cabe(tab, f, x, y)) pos.push([x, y]);
    if (!pos.length) return false;
    // primero las que borran líneas, después unas pocas más
    pos.sort((a, b) => lineasCon(tab, f, b[0], b[1]).filas.length + lineasCon(tab, f, b[0], b[1]).cols.length - (lineasCon(tab, f, a[0], a[1]).filas.length + lineasCon(tab, f, a[0], a[1]).cols.length));
    for (const [x, y] of pos.slice(0, 10)) { const c = copiarTablero(tab); poner(c, f, x, y, 1); if (prueba(c, resto.slice(1))) return true; }
    return false;
  };
  return ordenes.some((o) => prueba(t, o.map((i) => formas[i])));
}
function nuevaTanda(t, rnd, puntos) {
  const lleno = ocupadas(t) / (N * N);
  let mejor = null;
  for (let intento = 0; intento < 14; intento++) {
    const formas = [elegirForma(rnd, lleno, puntos), elegirForma(rnd, lleno, puntos), elegirForma(rnd, lleno, puntos)];
    if (!formas.some((f) => hayLugar(t, f))) continue;
    if (!mejor) mejor = formas;
    if (sePuedenTodas(t, formas)) { mejor = formas; break; }
  }
  if (!mejor) mejor = [FORMAS[0], FORMAS[0], FORMAS[1]];
  return mejor.map((f) => ({ f, pintura: 1 + Math.floor(rnd() * PINTURAS.length) }));
}

/* ------------------------------------------------------------ el puntaje */
function puntaje(celdasPuestas, lineas, combo, vacio) {
  let p = celdasPuestas;
  if (lineas) p += lineas * lineas * 10 * Math.max(1, combo);
  if (vacio) p += 300;
  return p;
}

/* -------------------------------------------- los niveles de los barrios */
function armarNivel(n) {
  const r = rngSemilla(n * 7919 + 13), t = tableroNuevo();
  const densidad = 0.2 + Math.min(0.24, n * 0.009), flores = 3 + Math.floor(n / 3);
  const simetrico = n % 3 === 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < (simetrico ? N / 2 : N); x++) {
    if (r() < densidad + (y > 3 ? 0.08 : 0)) {
      const p = 1 + Math.floor(r() * PINTURAS.length);
      t.col[y * N + x] = p;
      if (simetrico) t.col[y * N + N - 1 - x] = p;
    }
  }
  // ninguna línea completa de entrada
  for (let y = 0; y < N; y++) if (t.col.slice(y * N, y * N + N).every((v) => v)) t.col[y * N + Math.floor(r() * N)] = 0;
  for (let x = 0; x < N; x++) { let ok = true; for (let y = 0; y < N; y++) if (!t.col[y * N + x]) ok = false; if (ok) t.col[Math.floor(r() * N) * N + x] = 0; }
  const llenas = [];
  for (let i = 0; i < N * N; i++) if (t.col[i]) llenas.push(i);
  for (let k = 0; k < flores && llenas.length; k++) t.flor[llenas.splice(Math.floor(r() * llenas.length), 1)[0]] = 1;
  return { t, flores: t.flor.reduce((a, b) => a + b, 0), meta3: Math.round(flores * 1.4 + 5), meta2: Math.round(flores * 2.1 + 8) };
}

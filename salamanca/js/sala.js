/* ============================================================================
   Las salas: se arman al azar (con la semilla de la partida) a partir de unos
   dibujos simétricos —pilares, islas, un río con puentes, lagunas— y después
   se revisa que se pueda llegar a todo. Se pintan una sola vez en un lienzo;
   lo que se mueve (agua, lava, la puerta, las antorchas) va aparte.
   Celdas: 0 piso, 1 pared, 2 roca, 3 pozo, 4 puerta cerrada, 5 puerta abierta.
   ========================================================================== */

const PISO = 0, PARED = 1, ROCA = 2, POZO = 3, PUERTA = 4, ABIERTA = 5;
const PUERTA_C = [6, 7, 8];
const idx = (c, f) => f * COLS + c;

function celdaPx(mapa, x, y) {
  const c = Math.floor(x / T), f = Math.floor(y / T);
  if (c < 0 || c >= COLS || f < 0 || f >= FILAS) return PARED;
  return mapa[idx(c, f)];
}
/* qué frena a quién */
const frenaAndar = (v) => v === PARED || v === ROCA || v === POZO || v === PUERTA;
const frenaVuelo = (v) => v === PARED || v === PUERTA;
const frenaBala = (v) => v === PARED || v === ROCA || v === PUERTA;

function generarSala(rnd, tipo, bioma) {
  const m = new Uint8Array(COLS * FILAS);
  for (let f = 0; f < FILAS; f++) for (let c = 0; c < COLS; c++) {
    if (f <= 1 || f === FILAS - 1 || c === 0 || c === COLS - 1) m[idx(c, f)] = PARED;
  }
  for (const c of PUERTA_C) { m[idx(c, 0)] = PUERTA; m[idx(c, 1)] = PUERTA; }
  const pon = (c, f, v) => {
    if (c < 1 || c > 13 || f < 2 || f > 21) return;
    m[idx(c, f)] = v; m[idx(14 - c, f)] = v;          // simétrico
  };
  if (tipo === 'jefe') {
    [[3, 6], [3, 15]].forEach(([c, f]) => pon(c, f, ROCA));
  } else if (tipo === 'normal') {
    const dibujo = elegir(['pilares', 'islas', 'rio', 'lagunas', 'cruz', 'pasillos', 'islas', 'pilares'], rnd);
    if (dibujo === 'pilares') {
      const col = 2 + Math.floor(rnd() * 3), filas = [5, 9, 13, 17].filter(() => rnd() < 0.7);
      for (const f of filas) { pon(col, f, ROCA); if (rnd() < 0.4) pon(col, f + 1, ROCA); }
      if (rnd() < 0.5) pon(7, 11, ROCA);
    } else if (dibujo === 'islas') {
      for (let n = 0; n < 3 + Math.floor(rnd() * 3); n++) {
        const c = 1 + Math.floor(rnd() * 6), f = 4 + Math.floor(rnd() * 13), w = 1 + Math.floor(rnd() * 2), h = 1 + Math.floor(rnd() * 2);
        const v = rnd() < 0.3 ? POZO : ROCA;
        for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) pon(c + a, f + b, v);
      }
    } else if (dibujo === 'rio') {
      const f = 9 + Math.floor(rnd() * 3), puente = 2 + Math.floor(rnd() * 3);
      for (let c = 1; c <= 7; c++) if (Math.abs(c - puente) > 0) { pon(c, f, POZO); pon(c, f + 1, POZO); }
      if (rnd() < 0.5) { pon(4, 5, ROCA); pon(4, 16, ROCA); }
    } else if (dibujo === 'lagunas') {
      const c = 2 + Math.floor(rnd() * 3), f = 5 + Math.floor(rnd() * 4);
      for (let a = 0; a < 2; a++) for (let b = 0; b < 3; b++) pon(c + a, f + b, POZO);
      pon(c + 1, f + 7, ROCA); pon(c, f + 7, ROCA);
    } else if (dibujo === 'cruz') {
      for (let f = 8; f <= 13; f++) pon(7, f, ROCA);
      for (let c = 5; c <= 7; c++) pon(c, 10, ROCA);
      if (rnd() < 0.6) { pon(2, 5, ROCA); pon(2, 16, ROCA); }
    } else if (dibujo === 'pasillos') {
      for (let f = 6; f <= 15; f += 3) { pon(3, f, ROCA); pon(4, f, ROCA); }
    }
  }
  // lugar libre para entrar y salir
  for (let c = 5; c <= 9; c++) for (let f = 18; f <= 21; f++) m[idx(c, f)] = PISO;
  for (let c = 6; c <= 8; c++) for (let f = 2; f <= 3; f++) m[idx(c, f)] = PISO;
  // lo que no se alcanza caminando desde la entrada se vuelve roca
  const d = flujo(m, 7, 20);
  for (let f = 2; f <= 21; f++) for (let c = 1; c <= 13; c++) if (m[idx(c, f)] === PISO && d[idx(c, f)] < 0) m[idx(c, f)] = ROCA;
  if (d[idx(7, 2)] < 0) return generarSala(rnd, tipo, bioma);
  return m;
}

/* distancias caminando desde una celda (para que los bichos rodeen las rocas) */
function flujo(m, c0, f0) {
  const d = new Int16Array(COLS * FILAS).fill(-1);
  if (c0 < 0 || c0 >= COLS || f0 < 0 || f0 >= FILAS) return d;
  const cola = [idx(c0, f0)];
  d[cola[0]] = 0;
  for (let i = 0; i < cola.length; i++) {
    const k = cola[i], c = k % COLS, f = (k / COLS) | 0;
    for (const [dc, df] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nf = f + df;
      if (nc < 0 || nc >= COLS || nf < 0 || nf >= FILAS) continue;
      const nk = idx(nc, nf);
      if (d[nk] >= 0 || frenaAndar(m[nk])) continue;
      d[nk] = d[k] + 1; cola.push(nk);
    }
  }
  return d;
}

/* ------------------------------------------------------------- el dibujo */
function pintarSala(m, bioma, rnd) {
  const B = BIOMAS[bioma];
  const c = hacerLienzo(W, SALA_H), g = c.getContext('2d');
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  // el piso
  for (let f = 0; f < FILAS; f++) for (let k = 0; k < COLS; k++) {
    const x = k * T, y = f * T;
    let base = B.suelo[Math.floor(rnd() * 3)];
    if (B.tablero) base = B.suelo[(k + f) % 2 ? 1 : 2];
    g.fillStyle = base; g.fillRect(x, y, T, T);
    for (let n = 0; n < 5; n++) px(x + Math.floor(rnd() * T), y + Math.floor(rnd() * T), B.mota);
    if (rnd() < 0.18) { // una grieta
      let gx = x + 2 + Math.floor(rnd() * 8), gy = y + 2 + Math.floor(rnd() * 8);
      for (let n = 0; n < 5; n++) { px(gx, gy, B.grieta); gx += rnd() < 0.5 ? 1 : 0; gy += rnd() < 0.6 ? 1 : -1; }
    }
    if (B.tablero) { g.fillStyle = 'rgba(255,207,74,0.08)'; g.fillRect(x, y, T, 1); }
  }
  // adornos del piso
  for (let n = 0; n < 16; n++) {
    const k = 1 + Math.floor(rnd() * 13), f = 2 + Math.floor(rnd() * 20);
    if (m[idx(k, f)] !== PISO) continue;
    adorno(g, elegir(B.deco, rnd), k * T + 2 + Math.floor(rnd() * 6), f * T + 3 + Math.floor(rnd() * 6), B, rnd);
  }
  // pozos: el borde de arriba es un barranco
  for (let f = 0; f < FILAS; f++) for (let k = 0; k < COLS; k++) {
    if (m[idx(k, f)] !== POZO) continue;
    const x = k * T, y = f * T, arriba = f > 0 && m[idx(k, f - 1)] === POZO;
    g.fillStyle = B.pozo === 'lava' ? '#5a1408' : B.pozo === 'agua' ? '#0a1c2c' : '#08050a'; g.fillRect(x, y, T, T);
    if (!arriba) { g.fillStyle = B.paredOsc; g.fillRect(x, y, T, 4); g.fillStyle = B.pared; g.fillRect(x, y, T, 1); }
  }
  // las paredes
  for (let f = 0; f < FILAS; f++) for (let k = 0; k < COLS; k++) {
    const v = m[idx(k, f)];
    if (v !== PARED && v !== PUERTA) continue;
    const x = k * T, y = f * T;
    if (f === 1) { // la cara de la pared de arriba: ladrillos
      g.fillStyle = B.pared; g.fillRect(x, y, T, T);
      g.fillStyle = B.paredOsc;
      for (let r = 0; r < 3; r++) { g.fillRect(x, y + r * 4 + 3, T, 1); g.fillRect(x + ((r + k) % 2 ? 2 : 8), y + r * 4, 1, 3); }
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y + T - 2, T, 2);
    } else {
      g.fillStyle = B.tope; g.fillRect(x, y, T, T);
      g.fillStyle = B.paredOsc;
      if (k === 0) g.fillRect(x + T - 1, y, 1, T);
      if (k === COLS - 1) g.fillRect(x, y, 1, T);
      if (f === FILAS - 1) g.fillRect(x, y, T, 1);
      if (f === 0) g.fillRect(x, y + T - 1, T, 1);
    }
  }
  // sombra de la pared sobre el piso
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(T, 2 * T, W - 2 * T, 3);
  g.fillRect(T, 2 * T, 2, SALA_H - 3 * T); g.fillRect(W - T - 2, 2 * T, 2, SALA_H - 3 * T);
  // las rocas (con la cara de adelante y su sombra)
  for (let f = 0; f < FILAS; f++) for (let k = 0; k < COLS; k++) if (m[idx(k, f)] === ROCA) roca(g, k * T, f * T, B, rnd, bioma);
  return c;
}
function roca(g, x, y, B, rnd, bioma) {
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 1, y + T - 1, T, 3);
  const top = y - 3;
  for (let yy = 0; yy < T + 2; yy++) for (let xx = 0; xx < T; xx++) {
    const borde = (yy === 0 || yy === T + 1) && (xx < 2 || xx > T - 3) || (yy === 1 || yy === T) && (xx === 0 || xx === T - 1);
    if (borde) continue;
    const cara = yy > 8;
    let col = cara ? B.roca[2] : yy < 3 ? B.roca[0] : B.roca[1];
    if (!cara && rnd() < 0.12) col = B.roca[0];
    if (bioma === 2 && cara && rnd() < 0.08) col = '#ff6a20';
    if (bioma === 3 && yy === 9) col = '#ffcf4a';
    g.fillStyle = col; g.fillRect(x + xx, top + yy, 1, 1);
  }
  g.fillStyle = K;
  g.fillRect(x + 2, top, T - 4, 1); g.fillRect(x + 2, top + T + 1, T - 4, 1);
  g.fillRect(x, top + 2, 1, T - 2); g.fillRect(x + T - 1, top + 2, 1, T - 2);
  g.fillRect(x + 1, top + 1, 1, 1); g.fillRect(x + T - 2, top + 1, 1, 1); g.fillRect(x + 1, top + T, 1, 1); g.fillRect(x + T - 2, top + T, 1, 1);
}
function adorno(g, tipo, x, y, B, rnd) {
  const px = (a, b, col) => { g.fillStyle = col; g.fillRect(x + a, y + b, 1, 1); };
  if (tipo === 'raiz') { for (let i = 0; i < 6; i++) px(i, Math.round(Math.sin(i) * 1.5), '#5a3a22'); px(2, 2, '#5a3a22'); px(3, 3, '#5a3a22'); }
  else if (tipo === 'hueso') { px(0, 0, '#d8ccb0'); px(1, 1, '#e8dcc0'); px(2, 2, '#e8dcc0'); px(3, 3, '#d8ccb0'); px(0, 2, '#d8ccb0'); px(3, 1, '#d8ccb0'); }
  else if (tipo === 'piedra') { px(0, 0, B.roca[1]); px(1, 0, B.roca[0]); px(0, 1, B.roca[2]); px(1, 1, B.roca[1]); }
  else if (tipo === 'hongo') { px(1, 0, '#7af0c8'); px(0, 1, '#4ac8a0'); px(1, 1, '#7af0c8'); px(2, 1, '#4ac8a0'); px(1, 2, '#d8f0e8'); }
  else if (tipo === 'charco') { g.fillStyle = '#1a3a50'; g.fillRect(x, y, 5, 2); g.fillStyle = '#3a6a88'; g.fillRect(x + 1, y, 2, 1); }
  else if (tipo === 'ascua') { px(0, 0, '#ff8a30'); px(1, 1, '#c84020'); px(2, 0, '#ffd060'); }
  else if (tipo === 'vela') { px(1, 0, '#ffe060'); px(1, 1, '#f0e8d8'); px(1, 2, '#f0e8d8'); px(0, 3, '#c8b8a0'); px(1, 3, '#c8b8a0'); px(2, 3, '#c8b8a0'); }
  else if (tipo === 'calavera') { g.fillStyle = '#e8dcc0'; g.fillRect(x, y, 3, 2); px(0, 1, K); px(2, 1, K); px(1, 2, '#e8dcc0'); }
  else if (tipo === 'moneda') { px(0, 0, '#ffcf4a'); px(1, 0, '#c88a20'); px(0, 1, '#c88a20'); px(1, 1, '#ffcf4a'); }
}

/* lo que se mueve en la sala: agua o lava, la puerta, las antorchas */
function dibujarSalaViva(g, m, bioma, t, abierta, oy) {
  const B = BIOMAS[bioma];
  for (let f = 2; f < FILAS - 1; f++) for (let k = 1; k < COLS - 1; k++) {
    if (m[idx(k, f)] !== POZO) continue;
    const x = k * T, y = oy + f * T, arriba = m[idx(k, f - 1)] === POZO, y0 = arriba ? 0 : 4;
    if (B.pozo === 'agua' || B.pozo === 'lava') {
      const a = B.pozo === 'agua' ? ['#14304a', '#2a5a7a', '#5aa0c8'] : ['#a8300c', '#e85a18', '#ffc040'];
      g.fillStyle = a[0]; g.fillRect(x, y + y0, T, T - y0);
      for (let i = 0; i < 4; i++) {
        const fx = (Math.floor(t * 6 + i * 3 + k * 5 + f * 7) % T), fy = y0 + ((i * 3 + f) % (T - y0));
        g.fillStyle = a[1]; g.fillRect(x + fx, y + fy, 3, 1);
        if (i === 0 && Math.sin(t * 3 + k + f) > 0.6) { g.fillStyle = a[2]; g.fillRect(x + ((fx + 5) % T), y + fy, 1, 1); }
      }
    } else if (B.pozo === 'vacio') {
      if (Math.sin(t * 2 + k * 3 + f * 5) > 0.95) { g.fillStyle = '#c890ff'; g.fillRect(x + (k * 7 + f) % T, y + y0 + (f * 5) % (T - y0), 1, 1); }
    }
  }
  // la puerta
  const px = PUERTA_C[0] * T, py = oy;
  if (!abierta) {
    g.fillStyle = '#2a1a14'; g.fillRect(px + 2, py + 4, 32, 20);
    g.fillStyle = '#5a3a26'; for (let i = 0; i < 4; i++) g.fillRect(px + 4 + i * 8, py + 6, 4, 18);
    g.fillStyle = '#8a8a96'; g.fillRect(px + 2, py + 9, 32, 2); g.fillRect(px + 2, py + 18, 32, 2);
    g.fillStyle = K; g.fillRect(px + 1, py + 3, 34, 1); g.fillRect(px + 1, py + 3, 1, 21); g.fillRect(px + 34, py + 3, 1, 21);
  } else {
    g.fillStyle = '#05030a'; g.fillRect(px + 2, py + 4, 32, 20);
    g.fillStyle = K; g.fillRect(px + 1, py + 3, 34, 1); g.fillRect(px + 1, py + 3, 1, 21); g.fillRect(px + 34, py + 3, 1, 21);
    const b = Math.floor(t * 8) % 6;
    g.fillStyle = B.antorcha;
    for (let i = 0; i < 3; i++) { const yy = py + 20 - ((b + i * 2) % 6) * 3; g.fillRect(px + 17, yy, 2, 1); g.fillRect(px + 16, yy + 1, 1, 1); g.fillRect(px + 19, yy + 1, 1, 1); }
  }
  // antorchas
  for (const ax of [3 * T + 4, 11 * T + 4]) {
    const ay = oy + T + 2;
    g.fillStyle = '#4a3020'; g.fillRect(ax + 1, ay + 4, 2, 5);
    const l = Math.floor(t * 10 + ax) % 3;
    g.fillStyle = B.antorcha; g.fillRect(ax, ay + 1 - (l === 1 ? 1 : 0), 4, 3 + (l === 1 ? 1 : 0));
    g.fillStyle = '#fff6c0'; g.fillRect(ax + 1, ay + 2, 2, 2);
  }
}

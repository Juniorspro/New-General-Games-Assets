/* ============================================================================
   zonda/js/dibujo.js — cómo se ve el cerro.
   Lo fijo (el cielo, las montañas, las baldosas de cada sala) se pinta UNA
   vez con ImageData y se guarda; por cuadro solo se copian esos lienzos y se
   dibuja lo que se mueve. Crear degradés 60 veces por segundo cuesta más que
   todo el resto del juego.
   ========================================================================== */

const Vista = { ox: 0, oy: 0, cam: 0, usable: 0, t: 0 };

function hash2(x, y, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 7, 144665)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function hexRGB(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function c32(hex, a) { const [r, g, b] = hexRGB(hex); return (((a == null ? 255 : a) << 24) | (b << 16) | (g << 8) | r) >>> 0; }
function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function pixeles(c) {
  const g = c.getContext('2d'), id = g.createImageData(c.width, c.height);
  return { g, id, d: new Uint32Array(id.data.buffer), w: c.width, h: c.height };
}
const ruido1 = (x) => (Math.sin(x) * 0.5 + Math.sin(x * 2.3 + 1.7) * 0.3 + Math.sin(x * 5.1 + 0.4) * 0.2) * 0.5 + 0.5;

/* ---------------- el fondo de cada tramo ---------------- */
const cacheFondo = new Map();
function fondoDe(tema, W, H) {
  const k = tema + ':' + W + 'x' + H;
  let c = cacheFondo.get(k);
  if (c) return c;
  const T = TEMAS[tema], HH = H + 100;
  c = lienzo(W, HH);
  const P = pixeles(c), d = P.d;
  const cols = T.cielo.map((h) => c32(h));
  for (let y = 0; y < HH; y++) {
    const t = (y / HH) * (cols.length - 1), i = Math.min(cols.length - 2, Math.floor(t)), f = t - i;
    for (let x = 0; x < W; x++) d[y * W + x] = BAYER[(y & 3) * 4 + (x & 3)] / 16 < f ? cols[i + 1] : cols[i];
  }
  if (tema === 'cumbre' || tema === 'glaciar' || tema === 'amanecer') {
    const est = c32('#ffffff'), est2 = c32('#b8c0e8');
    for (let i = 0; i < W * HH / 260; i++) {
      const x = (hash2(i, 1, 9) * W) | 0, y = (hash2(i, 2, 9) * HH * 0.45) | 0;
      d[y * W + x] = hash2(i, 3, 9) < 0.3 ? est : est2;
    }
  }
  if (T.sol) {
    const sx = W * 0.72, sy = HH * (tema === 'amanecer' ? 0.5 : 0.4), sol = c32(T.sol);
    for (let y = -30; y <= 30; y++) for (let x = -30; x <= 30; x++) {
      const r = Math.hypot(x, y), px = (sx + x) | 0, py = (sy + y) | 0;
      if (px < 0 || py < 0 || px >= W || py >= HH) continue;
      if (r <= 11) d[py * W + px] = sol;
      else if (r <= 26 && BAYER[(py & 3) * 4 + (px & 3)] / 16 < (1 - (r - 11) / 15) * 0.55) d[py * W + px] = sol;
    }
  }
  /* tres cordones de montaña; en la quebrada el del medio va a franjas, como
     el cerro de siete colores; en el glaciar y la cumbre, con nieve arriba */
  const capa = (colHex, base, amp, frec, semilla, franjas, nieve) => {
    const col = c32(colHex), fr = franjas && franjas.map((h) => c32(h)), nv = nieve && c32(nieve);
    for (let x = 0; x < W; x++) {
      const top = Math.round(base - amp * ruido1(x * frec + semilla));
      for (let y = Math.max(0, top); y < HH; y++) {
        let v = col;
        if (fr) v = fr[Math.floor((y - top + ((x * 0.12) | 0)) / 5) % fr.length];
        if (nv && y - top < 2 + ((hash2(x, 5, semilla) * 4) | 0) && amp * ruido1(x * frec + semilla) > amp * 0.45) v = nv;
        d[y * W + x] = v;
      }
    }
  };
  const nieve = tema === 'glaciar' || tema === 'cumbre' || tema === 'amanecer' ? T.tapa : null;
  capa(T.lejos, HH * 0.52, 46, 0.03, 1.3, null, nieve);
  capa(T.medio, HH * 0.66, 34, 0.055, 7.1, tema === 'quebrada' ? T.franjas : null, nieve);
  capa(T.cerca, HH * 0.8, 20, 0.1, 3.7, null, null);
  P.g.putImageData(P.id, 0, 0);
  cacheFondo.set(k, c);
  return c;
}

/* ---------------- las baldosas de una sala ---------------- */
const cacheCapa = new Map();
function capaDe(m, tema) {
  const k = m.sala.id + ':' + tema;
  let c = cacheCapa.get(k);
  if (c) return c;
  const T = TEMAS[tema], W = m.w * TILE, H = m.h * TILE;
  c = lienzo(W, H);
  const P = pixeles(c), d = P.d;
  const put = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) d[y * W + x] = v; };
  const roca = c32(T.roca), osc = c32(T.rocaOsc), clara = c32(T.rocaClara), tapa = c32(T.tapa), tapaOsc = c32(T.tapaOsc);
  const lleno = (tx, ty) => tx < 0 || tx >= m.w ? true : ty < 0 || ty >= m.h ? false : m.t[ty * m.w + tx] === T_ROCA;
  const T_ROCA = 1;
  const nevada = tema === 'glaciar' || tema === 'cumbre' || tema === 'amanecer';
  if (T.oscura) {
    /* la pared del fondo de la mina: sin esto se vería el cielo por los túneles */
    const f1 = c32('#1d1618'), f2 = c32('#241c1c'), f3 = c32('#161214');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = hash2(x >> 1, y >> 1, 3);
      d[y * W + x] = n < 0.25 ? f3 : n > 0.8 ? f2 : f1;
    }
  }
  for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
    const t = m.t[ty * m.w + tx], x0 = tx * TILE, y0 = ty * TILE;
    if (t === 1) {
      const arriba = !lleno(tx, ty - 1), abajo = !lleno(tx, ty + 1), izq = !lleno(tx - 1, ty), der = !lleno(tx + 1, ty);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const n = hash2(x0 + x, y0 + y, 1);
        let v = n < 0.13 ? osc : n > 0.9 ? clara : roca;
        if (tema === 'quebrada' && ((y0 + y) % 6 === 0) && n < 0.6) v = osc;
        if (izq && x === 0) v = clara;
        if (der && x === 7) v = osc;
        if (abajo && y === 7) v = osc;
        if (arriba) {
          if (nevada) { if (y < 2 || (y < 4 && hash2(x0 + x, 0, 4) < 0.35)) v = y === 0 ? tapa : (y === 1 ? tapa : tapaOsc); }
          else if (T.oscura) { if (y === 0) v = clara; }
          else if (y === 0) v = tapa; else if (y === 1 && n < 0.6) v = tapaOsc;
        }
        d[(y0 + y) * W + x0 + x] = v;
      }
      if (arriba && !T.oscura && !nevada) for (let x = 0; x < 8; x++) if (hash2(x0 + x, y0, 6) < 0.28) { put(x0 + x, y0 - 1, tapa); if (hash2(x0 + x, y0, 7) < 0.4) put(x0 + x, y0 - 2, tapaOsc); }
    } else if (t === 3) {
      const hi = c32(T.hielo || '#8fd0f0'), ho = c32(T.hieloOsc || '#4a90c8'), hc = c32(T.hieloClaro || '#dff6ff');
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        let v = hi;
        if ((x0 + x + y0 + y) % 11 === 0 || (x0 + x + y0 + y) % 11 === 1) v = hc;
        if (!lleno3(m, tx - 1, ty) && x === 0) v = hc;
        if (!lleno3(m, tx + 1, ty) && x === 7) v = ho;
        if (!lleno3(m, tx, ty - 1) && y === 0) v = c32('#ffffff');
        d[(y0 + y) * W + x0 + x] = v;
      }
    } else if (t === 2) {
      const w1 = c32('#b07848'), w2 = c32('#8a5a34'), w3 = c32('#5a3a22'), cl = c32('#2a1c14');
      for (let x = 0; x < 8; x++) { put(x0 + x, y0, w1); put(x0 + x, y0 + 1, w2); put(x0 + x, y0 + 2, w3); }
      put(x0 + 1, y0 + 1, cl); put(x0 + 6, y0 + 1, cl);
      if (tx % 3 === 0 && !lleno(tx, ty + 1)) for (let y = 3; y < 8; y++) { put(x0 + 3, y0 + y, w3); put(x0 + 4, y0 + y, w2); }
    }
  }
  /* púas */
  const pu = nevada ? [c32('#ffffff'), c32('#9fd8f4'), c32('#4a90c8')] : [c32('#f0eee8'), c32('#a8a4b0'), c32('#56525e')];
  for (const q of m.pinches) {
    const tx = Math.floor(q.x / TILE) * TILE, ty = Math.floor(q.y / TILE) * TILE;
    for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) {
      const diente = (i % 4 === 1 || i % 4 === 2) ? 3 : (i % 4 === 0 || i % 4 === 3) ? 2 : 1;
      if (3 - j > diente) continue;
      const v = j === 0 ? pu[0] : j === 1 ? pu[1] : pu[2];
      if (q.d === 'arr') put(tx + i, ty + 5 + j, v);
      else if (q.d === 'aba') put(tx + i, ty + 2 - j, v);
      else if (q.d === 'izq') put(tx + 5 + j, ty + i, v);
      else put(tx + 2 - j, ty + i, v);
    }
  }
  P.g.putImageData(P.id, 0, 0);
  for (const a of m.adornos) adorno(P.g, a, tema);
  cacheCapa.set(k, c);
  return c;
}
function lleno3(m, tx, ty) { return tx < 0 || tx >= m.w ? true : ty < 0 || ty >= m.h ? false : m.t[ty * m.w + tx] === 3 || m.t[ty * m.w + tx] === 1; }

const ADORNOS = {
  c: [['..g.....', 'g.g.....', 'g.gg..g.', 'gggg..g.', '..gg.gg.', '..gggg..', '..gg....', '..gg....', '..gg....', '..GG....'], { g: '#5e9a44', G: '#3e6a2e' }],
  r: [['..rr..', '.rRrr.', 'rrrRrr', 'rrrrrr'], { r: '#8a7a6c', R: '#b0a090' }],
  h: [['.h..h', 'h.hh.', '.hhh.'], { h: '#c9b04a' }],
  k: [['.k.', 'kKk', 'kKk', '.k.', '.k.'], { k: '#9fdcf8', K: '#ffffff' }],
  t: [['tttttt', '..tt..', '..tt..', '..tt..', '..tt..', '..tt..', '..tt..', '..tt..', '..tt..', '..tt..', '..tt..', '..tt..', '..tT..', '..tT..', '.tttt.'], { t: '#6a4a2a', T: '#4a3218' }],
  f: [['.ff.', 'fyyf', 'fYyf', 'fyyf', '.ff.'], { f: '#3a3440', y: '#ffd070', Y: '#fff4c0' }],
};
const cacheAdorno = new Map();
function adorno(g, a, tema) {
  if (a.c === 'A') return;
  let def = ADORNOS[a.c];
  if (!def) return;
  let pal = def[1];
  if (a.c === 'h' && (tema === 'glaciar' || tema === 'cumbre')) pal = { h: '#dfe8f4' };
  const k = a.c + JSON.stringify(pal);
  let s = cacheAdorno.get(k);
  if (!s) { s = sprite(def[0], pal, { contorno: a.c === 'h' || a.c === 'k' ? null : '#1b1426' }); cacheAdorno.set(k, s); }
  dibujarSprite(g, s, a.x + 4 + ((hash2(a.x, a.y, 2) * 3) | 0) - 1, a.y + 8, hash2(a.x, a.y, 3) < 0.5 ? 1 : -1);
}

/* ---------------- lo que se mueve en la sala ---------------- */
function dibujarCosas(g, m, ox, oy, t, tema) {
  /* los rieles de las vagonetas, atrás de todo */
  for (const s of m.solidos) if (s.tipo === 'vagoneta') {
    g.fillStyle = '#5a5660';
    const x0 = ox + s.x0 + s.w / 2, y0 = oy + s.y0 + s.h / 2, x1 = ox + s.x1 + s.w / 2, y1 = oy + s.y1 + s.h / 2;
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 2));
    for (let i = 0; i <= n; i++) g.fillRect(Math.round(mezclar(x0, x1, i / n)), Math.round(mezclar(y0, y1, i / n)), 1, 1);
    g.fillStyle = '#8a8690'; g.fillRect(Math.round(x0) - 1, Math.round(y0) - 1, 3, 3); g.fillRect(Math.round(x1) - 1, Math.round(y1) - 1, 3, 3);
  }
  for (const s of m.solidos) {
    const x = Math.round(ox + s.x), y = Math.round(oy + s.y);
    if (s.tipo === 'derrumbe') {
      if (!s.activo) { g.globalAlpha = 0.25 + 0.15 * Math.sin(t * 8); marco(g, x, y, s.w, s.h, '#c8a878'); g.globalAlpha = 1; continue; }
      const dx = s.est === 'tiembla' ? Math.round(azar(-1, 1)) : 0;
      for (let i = 0; i < s.w; i += 8) tabla(g, x + i + dx, y, s.h, tema);
    } else if (s.tipo === 'rompible') {
      if (!s.activo) continue;
      g.fillStyle = '#6e4a2a'; g.fillRect(x, y, s.w, s.h);
      g.fillStyle = '#8e6238';
      for (let yy = 1; yy < s.h; yy += 4) g.fillRect(x + 1, y + yy, s.w - 2, 2);
      g.fillStyle = '#3e2814';
      const n = Math.max(s.w, s.h);
      for (let i = 0; i < n; i++) { g.fillRect(x + Math.round(i * s.w / n), y + Math.round(i * s.h / n), 1, 1); g.fillRect(x + s.w - 1 - Math.round(i * s.w / n), y + Math.round(i * s.h / n), 1, 1); }
      marco(g, x, y, s.w, s.h, '#2a1a0e');
    } else if (s.tipo === 'vagoneta') {
      g.fillStyle = '#34323c'; g.fillRect(x, y, s.w, s.h);
      g.fillStyle = '#7a5230'; g.fillRect(x + 2, y + 2, s.w - 4, Math.max(2, s.h - 6));
      g.fillStyle = '#9a9aa8'; g.fillRect(x, y, s.w, 1);
      g.fillStyle = '#56545e';
      for (let i = 3; i < s.w - 2; i += 6) g.fillRect(x + i, y + s.h - 3, 1, 1);
      g.fillStyle = s.est === 'va' ? '#ffd070' : s.est === 'pausa' ? '#ff7050' : '#6a6a78';
      g.fillRect(x + (s.w >> 1) - 1, y + (s.h >> 1) - 1, 2, 2);
      marco(g, x, y, s.w, s.h, '#141018');
    }
  }
  for (const c of m.cosas) {
    const x = Math.round(ox + c.x), y = Math.round(oy + c.y);
    switch (c.tipo) {
      case 'cristal': {
        const b = Math.round(Math.sin(t * 3 + c.x) * 1.5);
        if (c.espera > 0) { g.globalAlpha = 0.28; dibujarSprite(g, SPR.cristal[0], x + 4, y + 8 + b, 1); g.globalAlpha = 1; break; }
        halo(g, x + 4, y + 4 + b, 9, '#7ee8d2', 0.35);
        dibujarSprite(g, SPR.cristal[Math.floor(t * 6) % 4], x + 4, y + 8 + b, 1);
        break;
      }
      case 'resorte': {
        const baja = c.anim > 0 ? 2 : 0;
        g.fillStyle = '#3a3440'; g.fillRect(x, y + 2, 8, 2);
        g.fillStyle = '#c0c4d0'; for (let i = 0; i < 3 - baja / 2; i++) g.fillRect(x + 2 + (i % 2), y + 1 - i + baja, 4, 1);
        g.fillStyle = '#e8503a'; g.fillRect(x + 1, y - 2 + baja, 6, 2);
        g.fillStyle = '#ffb0a0'; g.fillRect(x + 1, y - 2 + baja, 6, 1);
        break;
      }
      case 'caramb': {
        if (c.est === 'roto') break;
        const dx = c.est === 'tiembla' ? Math.round(azar(-1, 1)) : 0;
        g.fillStyle = '#4a90c8'; g.fillRect(x + dx, y, 6, 2);
        g.fillStyle = '#8fd0f0'; g.fillRect(x + 1 + dx, y + 2, 4, 2); g.fillRect(x + 2 + dx, y + 4, 2, 2);
        g.fillStyle = '#dff6ff'; g.fillRect(x + 1 + dx, y, 2, 2); g.fillRect(x + 2 + dx, y + 6, 1, 1);
        break;
      }
      case 'carta': {
        if (c.est === 'tomada') break;
        const b = c.est === 'libre' ? Math.round(Math.sin(t * 2.5 + c.x) * 2) : 0;
        halo(g, x + 4, y + 3 + b, 8, '#fff0c8', 0.28);
        dibujarSprite(g, SPR.carta[Math.floor(t * 5) % 4], x + 4, y + 7 + b, 1);
        break;
      }
      case 'apacheta':
        dibujarSprite(g, SPR.apacheta, x + 8, y + 16, 1);
        if (c.tocada) { g.fillStyle = '#b0a090'; g.fillRect(x + 7, y + 6, 3, 2); halo(g, x + 8, y + 8, 12, '#ffe0a0', 0.2 + 0.1 * Math.sin(t * 4)); }
        break;
      case 'cumbre': {
        halo(g, x + 4, y + 10, 22, '#ffe0a0', 0.25 + 0.08 * Math.sin(t * 2));
        g.drawImage(SPR.apacheta.der, x - 8, y + 4, SPR.apacheta.w * 2, SPR.apacheta.h * 2);
        bandera(g, x + 4, y - 14, t);
        g.fillStyle = '#6a4424'; g.fillRect(x + 8, y + 14, 6, 6); g.fillStyle = '#8a5a34'; g.fillRect(x + 9, y + 14, 4, 2);
        break;
      }
    }
  }
}
function tabla(g, x, y, h, tema) {
  const osc = TEMAS[tema].oscura;
  g.fillStyle = osc ? '#7a5634' : '#9a6a44'; g.fillRect(x, y, 8, h);
  g.fillStyle = osc ? '#a07448' : '#c08a58'; g.fillRect(x, y, 8, 1);
  g.fillStyle = '#4a3020'; g.fillRect(x + 7, y, 1, h); g.fillRect(x + 3, y + 3, 1, 2);
}
function marco(g, x, y, w, h, col) {
  g.fillStyle = col;
  g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
}
/* halo de luz en trama: en pixel art un degradé suave queda borroso */
const cacheHalo = new Map();
function halo(g, x, y, r, col, fuerza) {
  const k = r + col + Math.round(fuerza * 20);
  let c = cacheHalo.get(k);
  if (!c) {
    c = lienzo(r * 2 + 1, r * 2 + 1);
    const q = c.getContext('2d');
    q.fillStyle = col;
    for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
      const d = Math.hypot(xx, yy) / r;
      if (d <= 1 && BAYER[((yy + 64) & 3) * 4 + ((xx + 64) & 3)] / 16 < (1 - d) * fuerza * 2) q.fillRect(xx + r, yy + r, 1, 1);
    }
    cacheHalo.set(k, c);
  }
  g.drawImage(c, Math.round(x - r), Math.round(y - r));
}
function bandera(g, x, y, t) {
  const cols = ['#e8403a', '#f08a3a', '#f4d24a', '#f4f4f0', '#4aa04a', '#3a78c8', '#7a4ab0'];
  g.fillStyle = '#5a4a3a'; g.fillRect(x, y, 1, 16);
  for (let i = 0; i < 7; i++) for (let j = 0; j < 9; j++) {
    const o = Math.round(Math.sin(t * 5 - j * 0.7) * 1.2);
    g.fillStyle = cols[(i + j) % 7]; g.fillRect(x + 1 + j, y + i + o, 1, 1);
  }
}

/* ---------------- Ayelén ---------------- */
const cacheSil = new Map();
function silDe(s, col) {
  const k = col; let m = cacheSil.get(s);
  if (!m) { m = new Map(); cacheSil.set(s, m); }
  let c = m.get(k);
  if (!c) { const d = silueta(s.der, col); c = { der: d, izq: espejar(d) }; m.set(k, c); }
  return c;
}
function spriteAye(p, A, t) {
  if (p.estado === 'dash') return SPR.dash;
  if (p.estado === 'trepa') return Math.abs(p.vy) > 2 ? SPR.trepa[Math.floor(p.y / 4) & 1] : SPR.pared;
  if (p.estado === 'entra') return SPR.cae;
  if (!p.enSuelo) { if (p.tPared > 0) return SPR.pared; return p.vy < 0 ? SPR.salta : SPR.cae; }
  if (p.agachada) return SPR.agacha;
  if (Math.abs(p.vx) > 12) return SPR.corre[Math.floor(A.dist / 7) % 6];
  if (A.parpadeo > 0) return SPR.parpadea;
  return SPR.quieta[Math.floor(t * 1.6) & 1];
}
function pasarAnim(A, m) {
  const p = m.p;
  A.dist += Math.abs(p.vx) * DT;
  A.sx = acercar(A.sx, 1, 0.06); A.sy = acercar(A.sy, 1, 0.06);
  if (A.parpadeo > 0) A.parpadeo--; else if (Math.random() < 0.006) A.parpadeo = 7;
  if (A.flash > 0) A.flash--;
  /* la bufanda: cada nudo sigue al anterior, un poco atrás y abajo */
  const nx = p.x + 4 - p.dir * 2, ny = p.y + 5 + (p.agachada ? 3 : 0);
  if (!A.bufanda) A.bufanda = Array.from({ length: 6 }, () => ({ x: nx, y: ny }));
  const b = A.bufanda;
  b[0].x = nx; b[0].y = ny;
  const k = p.estado === 'dash' ? 0.32 : 0.5, vx = (m.vientoX || 0) * 0.014;
  for (let i = 1; i < b.length; i++) {
    const tx = b[i - 1].x - p.dir * 1.7 + vx + Math.sin(Vista.t * 9 + i) * 0.25, ty = b[i - 1].y + 0.55;
    b[i].x += (tx - b[i].x) * k; b[i].y += (ty - b[i].y) * k;
  }
  /* la estela del dash */
  if (p.estado === 'dash' && p.rastro % 2 === 0) A.estela.push({ x: p.x + 4, y: p.y + 11, s: SPR.dash, dir: p.dir, vida: 12, col: colBufanda(m, 0) });
  for (let i = A.estela.length - 1; i >= 0; i--) if (--A.estela[i].vida <= 0) A.estela.splice(i, 1);
}
function colBufanda(m, i) {
  const p = m.p, n = p.dashes >= 2 ? 2 : p.dashes >= 1 ? 1 : 0;
  return BUFANDA[n][i & 1];
}
function dibujarAyelen(g, m, A, ox, oy, t) {
  const p = m.p;
  for (const e of A.estela) {
    const s = silDe(e.s, e.col);
    g.globalAlpha = e.vida / 12 * 0.55;
    g.drawImage(e.dir < 0 ? s.izq : s.der, Math.round(ox + e.x - (e.dir < 0 ? e.s.w - e.s.ox : e.s.ox)), Math.round(oy + e.y - e.s.oy));
    g.globalAlpha = 1;
  }
  if (p.estado === 'muerta') return;
  const b = A.bufanda;
  if (b) for (let i = b.length - 1; i >= 1; i--) {
    g.fillStyle = A.flash > 0 ? '#ffffff' : colBufanda(m, i);
    const tam = i < 4 ? 2 : 1;
    g.fillRect(Math.round(ox + b[i].x - tam / 2), Math.round(oy + b[i].y - tam / 2), tam, tam);
  }
  const s = spriteAye(p, A, t);
  const cansada = p.estado === 'trepa' && p.aguante < F.CANSADA && Math.floor(t * 10) % 2 === 0;
  dibujarSprite(g, s, ox + p.x + 4, oy + p.y + 11, p.dir, { sx: A.sx, sy: A.sy });
  if (cansada) { g.globalAlpha = 0.55; g.drawImage(p.dir < 0 ? silDe(s, '#ff3a3a').izq : silDe(s, '#ff3a3a').der, Math.round(ox + p.x + 4 - (p.dir < 0 ? s.w - s.ox : s.ox)), Math.round(oy + p.y + 11 - s.oy)); g.globalAlpha = 1; }
}

/* ---------------- el Zonda: un remolino de polvo con dos brasas ---------------- */
function dibujarZonda(g, x, y, t, tam, alfa) {
  tam = tam || 1; alfa = alfa == null ? 1 : alfa;
  g.globalAlpha = alfa;
  for (let i = 0; i < 26; i++) {
    const a = t * 3.2 + i * 0.83, r = (3 + (i % 9) * 1.4) * tam, h = (i / 26 - 0.5) * 22 * tam;
    g.fillStyle = i % 3 === 0 ? '#e8c48a' : i % 3 === 1 ? '#b08a5a' : '#f4dcaa';
    g.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + h + Math.sin(a) * r * 0.3), i % 4 === 0 ? 2 : 1, 1);
  }
  const o = Math.round(Math.sin(t * 2) * 1);
  g.fillStyle = '#ff7a2a'; g.fillRect(Math.round(x - 3 * tam), Math.round(y - 4 * tam) + o, 2, 2); g.fillRect(Math.round(x + 2 * tam), Math.round(y - 4 * tam) + o, 2, 2);
  g.fillStyle = '#fff0a0'; g.fillRect(Math.round(x - 3 * tam), Math.round(y - 4 * tam) + o, 1, 1); g.fillRect(Math.round(x + 2 * tam), Math.round(y - 4 * tam) + o, 1, 1);
  g.globalAlpha = 1;
}

/* ---------------- el clima: nubes, nieve, líneas de viento ---------------- */
const Clima = { copos: [], lineas: [], nubes: [] };
function pasarClima(tema, W, H, vx) {
  if (!Clima.nubes.length) for (let i = 0; i < 5; i++) Clima.nubes.push({ x: azar(0, W), y: azar(10, H * 0.4), v: azar(3, 8), w: azar(20, 44) });
  for (const n of Clima.nubes) { n.x += (n.v + vx * 0.05) * DT * (tema === 'cumbre' ? 5 : 1); if (n.x > W + 50) n.x = -50; if (n.x < -60) n.x = W + 40; }
  const nieva = tema === 'glaciar' || tema === 'cumbre';
  if (nieva && Clima.copos.length < (tema === 'cumbre' ? 120 : 60) && Math.random() < 0.7) Clima.copos.push({ x: azar(-20, W + 20), y: -4, v: azar(18, 40), f: Math.random() < 0.3 });
  if (tema === 'mina' && Clima.copos.length < 30 && Math.random() < 0.1) Clima.copos.push({ x: azar(0, W), y: azar(0, H), v: azar(2, 6), f: false, polvo: true });
  for (let i = Clima.copos.length - 1; i >= 0; i--) {
    const c = Clima.copos[i];
    c.y += c.v * DT * (c.polvo ? 0.3 : 1); c.x += (vx * (c.f ? 0.9 : 0.5) + Math.sin(c.y * 0.05) * 6) * DT;
    if (c.y > H + 4 || c.x < -30 || c.x > W + 30) Clima.copos.splice(i, 1);
  }
  if (Math.abs(vx) > 20 && Math.random() < Math.abs(vx) / 400) Clima.lineas.push({ x: vx > 0 ? -12 : W + 12, y: azar(0, H), l: azar(6, 16), v: vx * azar(2.2, 3.2), vida: 60 });
  for (let i = Clima.lineas.length - 1; i >= 0; i--) { const l = Clima.lineas[i]; l.x += l.v * DT; if (--l.vida <= 0) Clima.lineas.splice(i, 1); }
}
function dibujarNubes(g, tema) {
  const col = tema === 'cumbre' ? '#241e40' : tema === 'glaciar' ? '#e8f2fa' : tema === 'amanecer' ? '#f8c8a8' : '#f0a888';
  if (tema === 'mina') return;
  g.fillStyle = col;
  for (const n of Clima.nubes) {
    const x = Math.round(n.x), y = Math.round(n.y), w = Math.round(n.w);
    g.fillRect(x, y, w, 3); g.fillRect(x + 4, y - 2, w - 10, 2); g.fillRect(x + w * 0.3 | 0, y - 4, w * 0.35 | 0, 2);
  }
}
function dibujarCopos(g, frente) {
  for (const c of Clima.copos) {
    if (!!c.f !== frente) continue;
    g.fillStyle = c.polvo ? '#8a7060' : c.f ? '#ffffff' : '#c8d8f0';
    g.fillRect(Math.round(c.x), Math.round(c.y), c.f ? 2 : 1, c.f ? 2 : 1);
  }
  if (frente) { g.fillStyle = 'rgba(255,255,255,0.55)'; for (const l of Clima.lineas) g.fillRect(Math.round(l.x), Math.round(l.y), Math.round(l.l), 1); }
}

/* oscuridad de la mina: la luz de Ayelén y la de los faroles, en trama.
   Se calcula a la mitad de resolución: a bloques de 2 px queda más retro y
   cuesta la cuarta parte */
let lienzoOsc = null, pixOsc = null;
function oscuridad(g, luces, fuerza) {
  const W = Math.ceil(Pantalla.W / 2), H = Math.ceil(Pantalla.H / 2);
  if (!lienzoOsc || lienzoOsc.width !== W || lienzoOsc.height !== H) { lienzoOsc = lienzo(W, H); pixOsc = pixeles(lienzoOsc); }
  const d = pixOsc.d, negro = [c32('#07050a', 0), c32('#07050a', 90), c32('#07050a', 160), c32('#07050a', 215)];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let k = 1;
    for (const l of luces) {
      const dx = x * 2 - l.x, dy = y * 2 - l.y, r = l.r;
      if (Math.abs(dx) > r || Math.abs(dy) > r) continue;
      const q = Math.sqrt(dx * dx + dy * dy) / r;
      if (q < k) k = q;
    }
    const v = Math.min(1, k * k) * fuerza * 3 + BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5;
    d[y * W + x] = negro[lim(Math.round(v), 0, 3)];
  }
  pixOsc.g.putImageData(pixOsc.id, 0, 0);
  g.drawImage(lienzoOsc, 0, 0, W * 2, H * 2);
}

/* ---------------- un cuadro de juego ---------------- */
function ubicar(m) {
  const W = Pantalla.W, H = Pantalla.H, sw = m.w * TILE, sh = m.h * TILE;
  const mandos = document.body.classList.contains('tactil') ? Math.round(232 / Pantalla.PX) : 0;
  const usable = H - mandos;
  Vista.usable = usable;
  Vista.ox = Math.floor((W - sw) / 2);
  if (usable >= sh + 4) { Vista.cam = 0; Vista.oy = Math.max(0, Math.floor((usable - sh) / 2)); }
  else {
    const meta = lim(m.p.y + 6 - usable * 0.5, -2, sh - usable + 2);
    Vista.cam += (meta - Vista.cam) * 0.14;
    if (Math.abs(meta - Vista.cam) > 120) Vista.cam = meta;
    Vista.oy = -Math.round(Vista.cam);
  }
}
function dibujarSalaCompleta(g, J, t) {
  const m = J.mundo, W = Pantalla.W, H = Pantalla.H, tema = J.tema;
  ubicar(m);
  const ox = Vista.ox + FX.sx, oy = Vista.oy + FX.sy;
  const f = fondoDe(tema, W, H);
  g.drawImage(f, 0, -Math.min(96, 8 + J.salaIdx * 18) + Math.round(Vista.cam * 0.08));
  dibujarNubes(g, tema);
  dibujarCopos(g, false);
  if (tema === 'cumbre' && J.relampago > 0) { g.fillStyle = 'rgba(220,220,255,' + (J.relampago / 30).toFixed(2) + ')'; g.fillRect(0, 0, W, H); }
  dibujarCosas(g, m, ox, oy, t, tema);
  g.drawImage(capaDe(m, tema), ox, oy);
  /* los faroles titilan */
  if (TEMAS[tema].oscura) for (const a of m.adornos) if (a.c === 'f') halo(g, ox + a.x + 4, oy + a.y + 5, 14 + Math.round(Math.sin(t * 7 + a.x) * 1.2), '#ffcf70', 0.42);
  FX.dibujar(g, -ox, -oy, true);
  dibujarAyelen(g, m, J.anim, ox, oy, t);
  FX.dibujar(g, -ox, -oy, false);
  if (J.zonda) dibujarZonda(g, ox + J.zonda.x, oy + J.zonda.y, t, 1, J.zonda.a);
  dibujarCopos(g, true);
  if (TEMAS[tema].oscura) {
    const luces = [{ x: ox + m.p.x + 4, y: oy + m.p.y + 5, r: 64 }];
    for (const a of m.adornos) if (a.c === 'f') luces.push({ x: ox + a.x + 4, y: oy + a.y + 4, r: 46 });
    for (const c of m.cosas) if (c.tipo === 'cristal' && c.espera <= 0) luces.push({ x: ox + c.x + 4, y: oy + c.y + 4, r: 26 });
    oscuridad(g, luces, 0.34);
  }
  if (m.avisoViento) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, 0, W, H); }
  /* abajo, donde van los pulgares: la tierra sigue y se oscurece, así los mandos se leen */
  const piso = oy + m.h * TILE;
  if (document.body.classList.contains('tactil') && piso < H) {
    g.fillStyle = TEMAS[tema].rocaOsc; g.fillRect(0, piso, W, H - piso);
    g.fillStyle = TEMAS[tema].roca; g.fillRect(0, piso, W, 1);
    const bandas = [[3, 5], [9, 9], [16, 13]];
    for (let k = 0; k < 3; k++) {
      const y0 = piso + bandas[k][0], y1 = k < 2 ? piso + bandas[k + 1][0] : H;
      Trama.cubrir(g, bandas[k][1], '#07060c', 0, y0, W, y1 - y0);
    }
  }
}

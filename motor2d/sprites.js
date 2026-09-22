/* ============================================================================
   motor2d/sprites.js — los sprites son grillas de texto, una letra por color.
   Se hornean UNA vez a lienzos chicos (y su espejo) y después solo se copian:
   copiar un lienzo cuesta mucho menos que pintar píxel por píxel cada cuadro.
   ========================================================================== */

/* filas: ["..kk..", ".kook."]; paleta: { k: '#1a1020', o: '#e0a878' }; '.' es aire.
   o.contorno: color para un borde de 1 px alrededor de lo pintado, que así no
   hay que dibujarlo a mano en cada cuadro de animación */
function hornear(filas, paleta, o) {
  o = o || {};
  const h = filas.length, w = Math.max(...filas.map((f) => f.length));
  const m = o.contorno ? 1 : 0;
  const c = document.createElement('canvas');
  c.width = w + m * 2; c.height = h + m * 2;
  const g = c.getContext('2d');
  const lleno = (x, y) => y >= 0 && y < h && x >= 0 && x < filas[y].length && filas[y][x] !== '.' && filas[y][x] !== ' ' && paleta[filas[y][x]] !== undefined;
  if (o.contorno) {
    g.fillStyle = o.contorno;
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
      if (lleno(x, y)) continue;
      if (lleno(x - 1, y) || lleno(x + 1, y) || lleno(x, y - 1) || lleno(x, y + 1)) g.fillRect(x + m, y + m, 1, 1);
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < filas[y].length; x++) {
    const col = paleta[filas[y][x]];
    if (col) { g.fillStyle = col; g.fillRect(x + m, y + m, 1, 1); }
  }
  return c;
}
function espejar(c) {
  const e = document.createElement('canvas');
  e.width = c.width; e.height = c.height;
  const g = e.getContext('2d');
  g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0);
  return e;
}
/* la silueta de un sprite en un color: el destello blanco al recibir un golpe */
function silueta(c, col) {
  const e = document.createElement('canvas');
  e.width = c.width; e.height = c.height;
  const g = e.getContext('2d');
  g.drawImage(c, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
  return e;
}

/* un sprite horneado con sus dos lados y su silueta, más el punto de apoyo
   (ox, oy): dónde van los pies respecto de la esquina del lienzo */
function sprite(filas, paleta, o) {
  o = o || {};
  const der = hornear(filas, paleta, o);
  const s = { der, izq: espejar(der), w: der.width, h: der.height, ox: o.ox != null ? o.ox : der.width >> 1, oy: o.oy != null ? o.oy : der.height };
  s.blanco = silueta(der, '#ffffff'); s.blancoIzq = espejar(s.blanco);
  return s;
}
/* dibuja con el apoyo en (x, y) mirando a dir (1 derecha, -1 izquierda).
   sx/sy: estirar y aplastar, redondeado a píxel entero */
function dibujarSprite(g, s, x, y, dir, o) {
  o = o || {};
  const img = o.blanco ? (dir < 0 ? s.blancoIzq : s.blanco) : (dir < 0 ? s.izq : s.der);
  const sx = o.sx || 1, sy = o.sy || 1;
  const w = Math.max(1, Math.round(s.w * sx)), h = Math.max(1, Math.round(s.h * sy));
  const ox = dir < 0 ? s.w - s.ox : s.ox;
  const dx = Math.round(x - ox * w / s.w), dy = Math.round(y - s.oy * h / s.h);
  if (o.alfa != null) { g.globalAlpha = o.alfa; g.drawImage(img, dx, dy, w, h); g.globalAlpha = 1; }
  else g.drawImage(img, dx, dy, w, h);
}

/* animación: lista de sprites y cuadros por segundo */
function cuadroDe(anim, t) {
  return anim.cuadros[Math.floor(t * anim.fps) % anim.cuadros.length];
}

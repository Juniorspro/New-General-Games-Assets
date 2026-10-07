/* ============================================================================
   La mesa y su física. Todo en coordenadas de mesa (360 × 600, y hacia abajo).
   La bola es un círculo de radio 8 y se integra en 12 subpasos por cuadro: a la
   velocidad máxima (2300 u/s) avanza ~3 unidades por subpaso, menos que su
   radio, así no atraviesa paredes ni flippers. Las paredes son tramos con
   grosor (cápsulas); el flipper es una cápsula que gira, y el golpe usa la
   velocidad del punto del flipper donde pega (ω × r): por eso la punta tira
   más fuerte que la base, como en uno de verdad.
   ========================================================================== */

const R_BOLA = 8, GRAV = 1150, SUBPASOS = 12, V_MAX = 2300;
const ARCO = { cx: 180, cy: 170, r: 166 };
const LANZADOR = { x: 333, y: 572 };          // donde descansa la bola sobre el resorte
const COPA = { x: 84, y: 300 };
// los carriles J·A·Z·Z van corridos a la derecha: ahí caen los lanzamientos medios del resorte (medido: fuerza
// 0,40 a 0,49 cae entre x 210 y 297). El último carril no tiene poste a la derecha: ahí rebota la bola que sale del
// resorte contra el arco, y un poste la frenaba
const POSTES_CARRIL = [152, 190, 228, 266, 300];

const MESA = { segs: [], circs: [], sensores: [], flippers: [] };
function seg(ax, ay, bx, by, o) { const s = Object.assign({ ax, ay, bx, by, ancho: 2, e: 0.45, tipo: 'pared' }, o || {}); MESA.segs.push(s); return s; }
function linea(pts, o) { for (let i = 1; i < pts.length; i++) seg(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], o); }
function arcoPts(n) { const p = []; for (let i = 0; i <= n; i++) { const a = Math.PI + (i / n) * Math.PI; p.push([ARCO.cx + Math.cos(a) * ARCO.r, ARCO.cy + Math.sin(a) * ARCO.r]); } return p; }

function armarMesa() {
  MESA.segs.length = 0; MESA.circs.length = 0; MESA.sensores.length = 0;
  linea(arcoPts(48));
  linea([[14, 170], [14, 384], [34, 396]]);
  seg(34, 396, 80, 486, { tipo: 'goma', ancho: 3, lado: -1 });
  seg(80, 486, 97, 528);
  seg(320, 156, 320, 600);                                   // la pared del carril del resorte
  linea([[320, 384], [300, 396]]);
  seg(300, 396, 254, 486, { tipo: 'goma', ancho: 3, lado: 1 });
  seg(254, 486, 237, 528);
  seg(346, 170, 346, 604);
  seg(320, 604, 346, 604);
  seg(320, 157, 345, 145, { tipo: 'puerta', ancho: 1.5 });      // solo deja salir del carril
  seg(46, 222, 66, 330, { ancho: 3 });                        // el canal de la órbita, en embudo hacia abajo
  for (const x of POSTES_CARRIL.slice(0, 4)) seg(x, 70, x, 106, { ancho: 3.5, e: 0.5 });
  for (let k = 0; k < 3; k++) seg(292, 262 + 30 * k - 11, 292, 262 + 30 * k + 11, { tipo: 'blanco', k, ancho: 3, e: 0.3, caido: false });
  for (const [x, y] of [[118, 178], [216, 178], [167, 236]]) MESA.circs.push({ x, y, r: 20, tipo: 'hongo', e: 0.5, golpe: 0, i: MESA.circs.length });
  for (let k = 0; k < 4; k++) MESA.sensores.push({ id: 'carril', k, x: (POSTES_CARRIL[k] + POSTES_CARRIL[k + 1]) / 2 + (k === 3 ? 2 : 0), y: 98, r: k === 3 ? 12 : 9 });
  MESA.sensores.push({ id: 'orbIzq', x: 35, y: 280, r: 17 }, { id: 'orbDer', x: 301, y: 68, r: 18 });
  MESA.flippers.length = 0;
  for (const lado of [-1, 1]) MESA.flippers.push({ lado, px: lado < 0 ? 103 : 231, py: 532, largo: 54, rp: 7.5, rt: 4.5, ang: 0.52, reposo: 0.52, arriba: -0.42, w: 0, apretado: false });
}
const blancos = () => MESA.segs.filter((s) => s.tipo === 'blanco');

function dirFlipper(f) { return f.lado < 0 ? [Math.cos(f.ang), Math.sin(f.ang)] : [-Math.cos(f.ang), Math.sin(f.ang)]; }
function puntaFlipper(f) { const [dx, dy] = dirFlipper(f); return [f.px + dx * f.largo, f.py + dy * f.largo]; }

function nuevaBola(x, y) { return { x, y, vx: 0, vy: 0, enLanzador: false, atrapada: 0, dentro: new Set(), rastro: [], viva: true, enfriar: 0, edad: 0 }; }

/* un paso de la mesa; `ev(tipo, dato, bola)` avisa al juego de cada cosa que pasa */
function pasoMesa(bolas, dt, ev) {
  const h = dt / SUBPASOS;
  for (let s = 0; s < SUBPASOS; s++) {
    for (const f of MESA.flippers) {
      const meta = f.apretado ? f.arriba : f.reposo, vel = f.apretado ? 30 : 17, a0 = f.ang;
      f.ang = meta > a0 ? Math.min(meta, a0 + vel * h) : Math.max(meta, a0 - vel * h);
      f.w = (f.ang - a0) / h;
    }
    for (const b of bolas) {
      if (!b.viva || b.enLanzador) continue;
      if (b.atrapada > 0) continue;
      b.vy += GRAV * h;
      const v = Math.hypot(b.vx, b.vy); if (v > V_MAX) { b.vx *= V_MAX / v; b.vy *= V_MAX / v; }
      const py = b.y;
      b.x += b.vx * h; b.y += b.vy * h;
      for (const sg of MESA.segs) chocarSeg(b, sg, ev);
      for (const c of MESA.circs) chocarCirc(b, c, ev);
      for (const f of MESA.flippers) chocarFlipper(b, f);
      for (const o of bolas) if (o !== b && o.viva && !o.enLanzador && !o.atrapada) chocarBolas(b, o);
      sensores(b, ev, py);
    }
  }
  for (const b of bolas) {
    if (!b.viva) continue;
    b.edad += dt; b.enfriar = Math.max(0, b.enfriar - dt);
    b.rastro.push([b.x, b.y]); if (b.rastro.length > 6) b.rastro.shift();
    if (b.atrapada > 0) { b.atrapada -= dt; if (b.atrapada <= 0) { b.atrapada = 0; b.vx = 300; b.vy = -380; b.enfriar = 0.5; ev('expulsa', null, b); } continue; }
    // de vuelta sobre el resorte (un tiro flojo que no pasó la puerta)
    if (!b.enLanzador && b.x > 320 && b.y >= LANZADOR.y - 2 && b.vy >= 0) { b.enLanzador = true; b.x = LANZADOR.x; b.y = LANZADOR.y; b.vx = b.vy = 0; ev('vuelve', null, b); }
    if (b.y > 618 && b.x < 320) { b.viva = false; ev('cae', null, b); }
    // por las dudas: si algo la sacara de la mesa, vuelve al resorte
    if (b.x < 0 || b.x > 360 || b.y < -20) { b.x = LANZADOR.x; b.y = LANZADOR.y; b.vx = b.vy = 0; b.enLanzador = true; ev('vuelve', null, b); }
  }
}
function chocarSeg(b, s, ev) {
  if (s.caido) return;
  const dx = s.bx - s.ax, dy = s.by - s.ay, l2 = dx * dx + dy * dy;
  const t = clamp(((b.x - s.ax) * dx + (b.y - s.ay) * dy) / l2, 0, 1), qx = s.ax + dx * t, qy = s.ay + dy * t;
  let nx = b.x - qx, ny = b.y - qy; const d = Math.hypot(nx, ny), R = R_BOLA + s.ancho;
  if (d >= R || d < 1e-6) return;
  nx /= d; ny /= d;
  if (s.tipo === 'puerta' && ny > 0) return;            // desde abajo pasa
  b.x = qx + nx * R; b.y = qy + ny * R;
  const vn = b.vx * nx + b.vy * ny;
  if (vn >= 0) return;
  b.vx -= (1 + s.e) * vn * nx; b.vy -= (1 + s.e) * vn * ny;
  b.vx *= 0.998; b.vy *= 0.998;
  if (s.tipo === 'goma' && -vn > 110 && t > 0.08 && t < 0.92) { b.vx += nx * 560; b.vy += ny * 560; s.golpe = 0.15; ev('goma', s, b); }
  else if (s.tipo === 'blanco' && b.x < s.ax && -vn > 30) { s.caido = true; s.golpe = 0.2; ev('blanco', s, b); }
  else if (-vn > 260) ev('pared', -vn, b);
}
function chocarCirc(b, c, ev) {
  let nx = b.x - c.x, ny = b.y - c.y; const d = Math.hypot(nx, ny), R = R_BOLA + c.r;
  if (d >= R || d < 1e-6) return;
  nx /= d; ny /= d;
  b.x = c.x + nx * R; b.y = c.y + ny * R;
  const vn = b.vx * nx + b.vy * ny;
  if (vn >= 0) return;
  b.vx -= (1 + c.e) * vn * nx; b.vy -= (1 + c.e) * vn * ny;
  if (c.tipo === 'hongo') { b.vx += nx * 470; b.vy += ny * 470; c.golpe = 0.18; ev('hongo', c, b); }
}
function chocarFlipper(b, f) {
  const [dx, dy] = dirFlipper(f), rx = b.x - f.px, ry = b.y - f.py;
  const s = clamp(rx * dx + ry * dy, 0, f.largo), qx = f.px + dx * s, qy = f.py + dy * s;
  let nx = b.x - qx, ny = b.y - qy; const d = Math.hypot(nx, ny), R = R_BOLA + lerp(f.rp, f.rt, s / f.largo);
  if (d >= R) return;
  if (d < 1e-6) { nx = f.lado < 0 ? dy : -dy; ny = f.lado < 0 ? -dx : dx; if (ny > 0) { nx = -nx; ny = -ny; } } else { nx /= d; ny /= d; }
  b.x = qx + nx * R; b.y = qy + ny * R;
  // la velocidad del punto del flipper: s · ω · (derivada de la dirección)
  const ddx = f.lado < 0 ? -Math.sin(f.ang) : Math.sin(f.ang), ddy = Math.cos(f.ang);
  const vpx = s * f.w * ddx, vpy = s * f.w * ddy;
  const rvx = b.vx - vpx, rvy = b.vy - vpy, vn = rvx * nx + rvy * ny;
  if (vn >= 0) return;
  const e = Math.abs(f.w) > 1 ? 0.35 : 0.2;
  b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
}
function chocarBolas(a, b) {
  let nx = a.x - b.x, ny = a.y - b.y; const d = Math.hypot(nx, ny);
  if (d >= R_BOLA * 2 || d < 1e-6) return;
  nx /= d; ny /= d;
  const m = (R_BOLA * 2 - d) / 2; a.x += nx * m; a.y += ny * m; b.x -= nx * m; b.y -= ny * m;
  const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (vn >= 0) return;
  a.vx -= vn * nx; a.vy -= vn * ny; b.vx += vn * nx; b.vy += vn * ny;
}
function sensores(b, ev, py) {
  for (const s of MESA.sensores) {
    const den = Math.hypot(b.x - s.x, b.y - s.y) < s.r, k = s.id + (s.k || 0);
    if (den && !b.dentro.has(k)) { b.dentro.add(k); ev(s.id, s, b); } else if (!den && b.dentro.has(k)) b.dentro.delete(k);
  }
  // el molinete: una línea de lado a lado del canal de la órbita
  if (b.x > 14 && b.x < 60 && (py - 300) * (b.y - 300) < 0) ev('molinete', clamp(Math.round(Math.abs(b.vy) / 90), 1, 25), b);
  // la copa: si entra despacio, se la traga
  if (!b.atrapada && !b.enfriar && Math.hypot(b.x - COPA.x, b.y - COPA.y) < 9 && Math.hypot(b.vx, b.vy) < 1250) { b.atrapada = 1.1; b.x = COPA.x; b.y = COPA.y; b.vx = b.vy = 0; ev('copa', null, b); }
}

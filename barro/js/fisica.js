/* ============================================================================
   barro/js/fisica.js — la moto de motocross.
   Metros y segundos, y para ARRIBA, x para adelante. Pura y determinista (sin
   DOM ni azar): la usan el juego, los rivales y las pruebas en Node.

   La moto es un cuerpo rígido (moto + piloto) con dos ruedas en suspensión
   "de rayo": cada rueda baja por su eje (la de atrás casi vertical, la de
   adelante con la horquilla inclinada) hasta tocar el suelo, y el resorte
   empuja según cuánto se comprimió. Lo que hace que se sienta como Mad Skills:
   - el motor empuja en el contacto de la rueda de atrás, que está debajo del
     centro de masa: acelerar levanta la trompa (willy) y hay que echarse
     adelante;
   - en el aire, el piloto gira la moto echándose atrás o adelante;
   - caer con las ruedas paralelas a la bajada conserva la velocidad; caer
     plano o de punta frena (y si toca el casco o la espalda, se cae).
   ========================================================================== */

export const PASO = 1 / 240;
export const G = 13.5;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* ---------------- el suelo: alturas con paso fijo ---------------- */
export function crearSuelo(x0, dx, h) {
  return { x0, dx, h, n: h.length, x1: x0 + dx * (h.length - 1) };
}
export function altoEn(S, x) {
  const f = (x - S.x0) / S.dx;
  const i = Math.floor(f);
  if (i < 0) return S.h[0];
  if (i >= S.n - 1) return S.h[S.n - 1];
  const t = f - i;
  return S.h[i] * (1 - t) + S.h[i + 1] * t;
}
/* el ángulo del suelo (rad), promediado en ±r metros */
export function anguloEn(S, x, r = 0.4) {
  return Math.atan2(altoEn(S, x + r) - altoEn(S, x - r), 2 * r);
}

/* el punto del suelo más cercano a (px, py): distancia con signo (negativa si está
   adentro de la tierra) y la normal hacia afuera */
const CT = { d: 0, qx: 0, qy: 0, nx: 0, ny: 1 };
function contacto(S, px, py, r) {
  let i0 = Math.floor((px - r - S.x0) / S.dx) - 1;
  let i1 = Math.ceil((px + r - S.x0) / S.dx) + 1;
  i0 = clamp(i0, 0, S.n - 2); i1 = clamp(i1, 1, S.n - 1);
  let mejor = Infinity, bx = px, by = py, snx = 0, sny = 1;
  for (let i = i0; i < i1; i++) {
    const ax = S.x0 + i * S.dx, ay = S.h[i], bxx = ax + S.dx, byy = S.h[i + 1];
    const ex = bxx - ax, ey = byy - ay;
    let t = ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + ex * t, qy = ay + ey * t;
    const d2 = (px - qx) * (px - qx) + (py - qy) * (py - qy);
    if (d2 < mejor) {
      mejor = d2; bx = qx; by = qy;
      const L = Math.hypot(ex, ey); snx = -ey / L; sny = ex / L;
    }
  }
  const d = Math.sqrt(mejor);
  const adentro = py < altoEn(S, px);
  let nx = snx, ny = sny;
  if (d > 1e-5) {
    nx = (px - bx) / d; ny = (py - by) / d;
    if (adentro) { nx = -nx; ny = -ny; }
    if (ny < 0.05) { nx = snx; ny = sny; }     // nunca empuja hacia abajo
  }
  CT.d = adentro ? -d : d; CT.qx = bx; CT.qy = by; CT.nx = nx; CT.ny = ny;
  return CT;
}

/* ---------------- la ficha de la moto (por unidad de masa) ---------------- */
export const FICHA = {
  inercia: 0.34,
  r: 0.34,                                   // radio de las ruedas
  /* cada rueda: ancla (desde el centro de masa), eje (hacia abajo), recorrido */
  ruedas: [
    { ax: -0.72, ay: -0.12, dx: 0, dy: -1, lmax: 0.40, lmin: 0.08, k: 68, c: 5.6, freno: 0.45 },
    { ax: 0.587, ay: -0.105, dx: 0.438, dy: -0.899, lmax: 0.47, lmin: 0.15, k: 58, c: 5.2, freno: 0.55 },
  ],
  motor: 13,            // empuje máximo (m/s²)
  vmax: 27,             // velocidad tope (m/s)
  freno: 12,
  agarre: 1.25,
  aireGiro: 3.7,        // rad/s al que gira echándose en el aire
  aireResp: 6.5,        // qué tan rápido llega a ese giro
  sueloGiro: 7.5,       // rad/s² echándose con las ruedas en el piso
  /* los puntos que chocan: chasis (rebota), piloto y cabeza (se cae) */
  puntos: [
    { x: 0.0, y: -0.30, r: 0.10, tipo: 0 },
    { x: -1.0, y: 0.22, r: 0.07, tipo: 0 },
    { x: 1.0, y: 0.10, r: 0.07, tipo: 0 },
    { x: 0.44, y: 0.62, r: 0.09, tipo: 0 },
    { x: -0.16, y: 0.72, r: 0.16, tipo: 1 },
    { x: 0.08, y: 1.04, r: 0.17, tipo: 2 },
  ],
};

/* las mejoras del garaje: cada nivel suma un poco (0 a 5) */
export function fichaCon(mej = {}) {
  const m = (k) => mej[k] || 0;
  const F = JSON.parse(JSON.stringify(FICHA));
  F.motor *= 1 + 0.06 * m('motor');
  F.vmax *= 1 + 0.035 * m('motor');
  F.agarre *= 1 + 0.05 * m('agarre');
  F.aireGiro *= 1 + 0.04 * m('piloto');
  F.aireResp *= 1 + 0.05 * m('piloto');
  for (const R of F.ruedas) { R.c *= 1 + 0.06 * m('susp'); R.lmin *= 1 - 0.07 * m('susp'); }
  F.tolerancia = 0.06 * m('susp');          // aterrizajes más perdonados
  return F;
}

/* ---------------- crear y copiar ---------------- */
export function crearMoto(F, x, y, a = 0) {
  return {
    F, x, y, a, vx: 0, vy: 0, w: 0,
    ruedas: F.ruedas.map((R) => ({ l: R.lmax, comp: 0, enSuelo: false, giro: 0, wRot: 0, carga: 0, gira: 0, cx: 0, cy: 0, nx: 0, ny: 1 })),
    aire: 0,            // segundos en el aire (las dos ruedas)
    suelo: 0,           // segundos con alguna rueda en el piso
    caido: false,
    willy: 0,           // segundos en una rueda
    eventos: [],
    invulnerable: 0,
    aterrizaje: null,   // el último aterrizaje (para el juego)
  };
}

/* ---------------- un paso ----------------
   inp: { gas 0..1, freno 0..1, inclinar -1 (atrás) .. 1 (adelante) } */
export function pasoMoto(M, S, inp, dt = PASO) {
  const F = M.F;
  const cs = Math.cos(M.a), sn = Math.sin(M.a);
  let ax = 0, ay = -G, al = 0;                // aceleraciones (lineal y angular)
  const gas = M.caido ? 0 : clamp(inp.gas || 0, 0, 1);
  const freno = M.caido ? 0 : clamp(inp.freno || 0, 0, 1);
  const incl = M.caido ? 0 : clamp(inp.inclinar || 0, -1, 1);
  let tocando = 0;
  M.golpeTope = 0;

  /* --- las ruedas --- */
  for (let i = 0; i < 2; i++) {
    const R = F.ruedas[i], E = M.ruedas[i];
    const Px = M.x + R.ax * cs - R.ay * sn, Py = M.y + R.ax * sn + R.ay * cs;
    const Dx = R.dx * cs - R.dy * sn, Dy = R.dx * sn + R.dy * cs;
    const Cx = Px + Dx * R.lmax, Cy = Py + Dy * R.lmax;
    const ct = contacto(S, Cx, Cy, F.r + 0.5);
    if (ct.d >= F.r || M.caido) {
      // en el aire: la rueda se estira despacio (para el dibujo)
      E.l += (R.lmax - E.l) * Math.min(1, dt * 25);
      E.comp = R.lmax - E.l; E.enSuelo = false; E.carga = 0;
      E.cx = Px + Dx * E.l; E.cy = Py + Dy * E.l;
      if (i === 0) E.wRot += ((gas * F.vmax * 1.1) / F.r - E.wRot) * Math.min(1, dt * 3);
      else E.wRot *= 1 - dt * 0.6;
      E.giro += E.wRot * dt;
      continue;
    }
    const nx = ct.nx, ny = ct.ny;
    const pen = F.r - ct.d;
    const cosA = Math.max(0.35, -(Dx * nx + Dy * ny));
    let l = R.lmax - pen / cosA;
    let tope = 0;
    if (l < R.lmin) { tope = (R.lmin - l) * cosA; l = R.lmin; }
    const comp = R.lmax - l;
    const vel = E.enSuelo ? (comp - E.comp) / dt : 0;
    E.comp = comp; E.l = l; E.enSuelo = true; E.nx = nx; E.ny = ny;
    const wx = Px + Dx * l, wy = Py + Dy * l;
    E.cx = wx; E.cy = wy;
    // amortiguador: al estirarse frena más que al comprimirse (si no, rebota y despega)
    let f = R.k * comp + 3600 * comp * comp * comp + R.c * vel * (vel < 0 ? 2.6 : 1);
    f = clamp(f, 0, 600);
    E.carga = f;
    tocando++;
    // el resorte empuja por la normal, aplicado en el centro de la rueda
    const rx = wx - M.x, ry = wy - M.y;
    ax += nx * f; ay += ny * f; al += (rx * ny * f - ry * nx * f) / F.inercia;

    // tracción y freno en el contacto
    const qx = wx - nx * F.r, qy = wy - ny * F.r;
    const tx = ny, ty = -nx;                      // tangente hacia adelante
    const rqx = qx - M.x, rqy = qy - M.y;
    const vqx = M.vx - M.w * rqy, vqy = M.vy + M.w * rqx;
    const vt = vqx * tx + vqy * ty;
    let ft = 0;
    const lodo = S.lodo && S.lodo[Math.round((wx - S.x0) / S.dx)];
    const tope_mu = F.agarre * f * (lodo ? 0.72 : 1);
    if (lodo) ft -= Math.sign(vt) * Math.min(0.2 * f, Math.abs(vt) / dt * 0.3);
    if (i === 0 && gas > 0) {
      const curva = vt <= 0 ? 1 : clamp(1 - (vt / F.vmax) * (vt / F.vmax), 0, 1);
      const quiere = gas * F.motor * curva;
      ft += Math.min(quiere, tope_mu);
      E.gira = quiere > tope_mu * 1.02 ? Math.min(1, (quiere - tope_mu) / (tope_mu + 0.5) + 0.3) : 0;
    } else if (i === 0) E.gira = 0;
    if (freno > 0) {
      const fb = Math.min(freno * F.freno * R.freno * 2, tope_mu, Math.abs(vt) / dt * 0.45);
      ft -= Math.sign(vt) * fb;
    }
    ft -= Math.sign(vt) * Math.min(0.012 * f, Math.abs(vt) / dt * 0.2);   // rodadura
    // el par de la tracción se toma desde más arriba del contacto: así levanta la trompa
    // de a poco (como en Mad Skills) y no la da vuelta de golpe
    const rpx = rqx + nx * F.r * 0.35, rpy = rqy + ny * F.r * 0.35;
    ax += tx * ft; ay += ty * ft; al += (rpx * ty * ft - rpy * tx * ft) / F.inercia;
    E.wRot = vt / F.r + (i === 0 ? E.gira * 18 : 0);
    E.giro += E.wRot * dt;

    // tope de la suspensión: lo que sigue entrando se frena de golpe
    if (tope > 0) {
      const golpe = rigido(M, qx, qy, nx, ny, tope, 0.15, F.inercia);
      if (golpe > 0) M.golpeTope = Math.max(M.golpeTope || 0, golpe);
    }
  }

  /* --- echarse atrás / adelante --- */
  if (!M.caido) {
    if (tocando === 0) {
      if (Math.abs(incl) > 0.05) al += (-incl * F.aireGiro - M.w) * F.aireResp;
      else al -= M.w * 0.25;
    } else {
      al += -incl * F.sueloGiro;
      al -= M.w * 1.2;                           // el piloto amortigua
    }
  } else {
    al -= M.w * 0.4;
  }

  /* --- integrar velocidades --- */
  const v = Math.hypot(M.vx, M.vy);
  ax -= M.vx * v * 0.0011; ay -= M.vy * v * 0.0011;
  M.vx += ax * dt; M.vy += ay * dt; M.w += al * dt;

  /* --- los puntos del cuerpo --- */
  let cae = false;
  for (const p of F.puntos) {
    const qx = M.x + p.x * cs - p.y * sn, qy = M.y + p.x * sn + p.y * cs;
    const ct = contacto(S, qx, qy, p.r + 0.3);
    if (ct.d >= p.r) continue;
    const pen = p.r - ct.d;
    if (p.tipo > 0 && !M.caido && M.invulnerable <= 0) cae = true;
    rigido(M, ct.qx + ct.nx * 0.0, ct.qy, ct.nx, ct.ny, pen, M.caido ? 0.7 : 0.35, F.inercia);
  }
  if (M.caido) {
    // caída: las ruedas también son puntos duros
    for (let i = 0; i < 2; i++) {
      const E = M.ruedas[i];
      const ct = contacto(S, E.cx, E.cy, F.r + 0.3);
      if (ct.d < F.r) rigido(M, ct.qx, ct.qy, ct.nx, ct.ny, F.r - ct.d, 0.6, F.inercia, 0.25);
    }
  }

  /* --- integrar posición --- */
  M.x += M.vx * dt; M.y += M.vy * dt; M.a += M.w * dt;
  if (M.invulnerable > 0) M.invulnerable -= dt;

  /* --- aire, aterrizajes y willy --- */
  const antes = M.aire;
  if (tocando === 0) { M.aire += dt; M.suelo = 0; }
  else {
    if (antes > 0.3 && !M.caido) aterrizar(M, S, antes);
    M.aire = 0; M.suelo += dt;
  }
  const atrasSola = M.ruedas[0].enSuelo && !M.ruedas[1].enSuelo;
  M.willy = atrasSola && Math.hypot(M.vx, M.vy) > 4 ? M.willy + dt : 0;

  // dado vuelta en el piso mucho rato también es caída
  if (!M.caido && tocando > 0) {
    const rel = difAng(M.a, anguloEn(S, M.x));
    if (Math.abs(rel) > 1.75) cae = true;
    // parada de punta o de cola, sin avanzar: también es caída
    M.raro = Math.abs(rel) > 1.15 && Math.hypot(M.vx, M.vy) < 3 ? (M.raro || 0) + dt : 0;
    if (M.raro > 0.45) cae = true;
  }
  if (cae && !M.caido) {
    M.caido = true;
    M.eventos.push({ tipo: 'caida', x: M.x, y: M.y });
  }
}

/* el ángulo de a respecto de b, entre -π y π */
export function difAng(a, b) {
  let d = (a - b) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/* qué tan bien cayó: el ángulo contra la bajada y lo fuerte del golpe */
function aterrizar(M, S, tiempoAire) {
  const suelo = anguloEn(S, M.x, 0.8);
  const dif = Math.abs(difAng(M.a, suelo));
  const tol = M.F.tolerancia || 0;
  const tx = Math.cos(suelo), ty = Math.sin(suelo);
  const vn = -(M.vx * -ty + M.vy * tx);           // velocidad contra el suelo
  let calidad = 'duro';
  if (dif < 0.14 + tol && vn < 9) calidad = 'perfecto';
  else if (dif < 0.30 + tol) calidad = 'bien';
  if (calidad === 'perfecto') {
    // premio: un empujón por la bajada
    const v = M.vx * tx + M.vy * ty;
    if (v > 0) { M.vx += tx * 1.1; M.vy += ty * 1.1; }
  } else if (calidad === 'duro') {
    M.vx *= 0.82; M.vy *= 0.82;
  }
  M.aterrizaje = { calidad, dif, aire: tiempoAire, golpe: vn };
  M.eventos.push({ tipo: 'aterrizaje', calidad, aire: tiempoAire, golpe: vn, x: M.x, y: M.y });
}

/* choque rígido de un punto con el suelo: impulso normal (sin rebote) y fricción;
   devuelve el impulso normal */
function rigido(M, qx, qy, nx, ny, pen, mu, I, e = 0) {
  const rx = qx - M.x, ry = qy - M.y;
  let vqx = M.vx - M.w * ry, vqy = M.vy + M.w * rx;
  const vn = vqx * nx + vqy * ny;
  let jn = 0;
  if (vn < 0) {
    const rn = rx * ny - ry * nx;
    jn = (-(1 + e) * vn) / (1 + (rn * rn) / I);
    M.vx += jn * nx; M.vy += jn * ny; M.w += (rn * jn) / I;
    const tx = ny, ty = -nx;
    vqx = M.vx - M.w * ry; vqy = M.vy + M.w * rx;
    const vt = vqx * tx + vqy * ty;
    const rt = rx * ty - ry * tx;
    let jt = -vt / (1 + (rt * rt) / I);
    jt = clamp(jt, -mu * jn, mu * jn);
    M.vx += jt * tx; M.vy += jt * ty; M.w += (rt * jt) / I;
  }
  const corr = Math.min(pen * 0.5, 0.03);
  M.x += nx * corr; M.y += ny * corr;
  return jn;
}

/* volver a la pista después de una caída: quieta, derecha, un rato sin caerse */
export function levantar(M, S, x) {
  const a = anguloEn(S, x, 0.8);
  M.x = x; M.y = altoEn(S, x) + 0.78; M.a = a;
  M.vx = Math.cos(a) * 1.5; M.vy = Math.sin(a) * 1.5; M.w = 0;
  M.caido = false; M.aire = 0; M.suelo = 0; M.willy = 0; M.invulnerable = 1.2;
  for (let i = 0; i < 2; i++) { const E = M.ruedas[i]; E.l = M.F.ruedas[i].lmax; E.comp = 0; E.enSuelo = false; E.wRot = 0; }
}

/* dónde está cada rueda (para el dibujo y la cámara), en el mundo */
export function puntoCuerpo(M, px, py) {
  const cs = Math.cos(M.a), sn = Math.sin(M.a);
  return [M.x + px * cs - py * sn, M.y + px * sn + py * cs];
}

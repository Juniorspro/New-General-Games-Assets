/* ============================================================================
   ruta40/js/fisica.js — cómo se mueve un vehículo por la ruta.
   Metros y segundos, con y para ARRIBA. Pura y determinista: sin DOM, sin
   azar, a 240 pasos por segundo. La usan el juego y el bot que comprueba
   los tramos (en Node).

   El vehículo es un chasis rígido y dos ruedas, cada una en su propia
   suspensión (resorte y amortiguador a lo largo de un eje del chasis, y
   rígida de costado). Lo que hace que se sienta como Hill Climb:
   - el motor le da torque a la rueda, y el chasis recibe el torque contrario:
     por eso levanta la trompa al acelerar y la baja al frenar;
   - la rueda empuja por fricción en el punto de contacto, con un tope
     (μ·N): si se acelera de más, patina;
   - en el aire, acelerar lo gira para atrás y frenar, para adelante;
   - si la cabeza del conductor toca el piso, se terminó.
   Los choques se resuelven con impulsos en secuencia (varias vueltas por
   paso), que es lo que no explota con resortes duros.
   ========================================================================== */

export const PASO = 1 / 240;
export const G = 9.8;

const rot = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };
const cruz = (ax, ay, bx, by) => ax * by - ay * bx;

/* ---------------- el terreno: una polilínea con x creciente ---------------- */
/* pts: Float64Array [x0,y0,x1,y1,...] con paso fijo dx desde x0 */
export function crearSuelo(xs0, dx, alturas) {
  return { x0: xs0, dx, h: alturas, n: alturas.length };
}
export function altoEn(S, x) {
  const f = (x - S.x0) / S.dx, i = Math.floor(f);
  if (i < 0) return S.h[0];
  if (i >= S.n - 1) return S.h[S.n - 1];
  const t = f - i;
  return S.h[i] * (1 - t) + S.h[i + 1] * t;
}
/* el punto del suelo más cercano a (px, py), mirando los tramos cercanos */
function masCercano(S, px, py, radio) {
  const i0 = Math.max(0, Math.floor((px - radio - S.x0) / S.dx) - 1), i1 = Math.min(S.n - 2, Math.floor((px + radio - S.x0) / S.dx) + 1);
  let mejor = null, md = Infinity;
  for (let i = i0; i <= i1; i++) {
    const ax = S.x0 + i * S.dx, ay = S.h[i], bx = ax + S.dx, by = S.h[i + 1];
    const ex = bx - ax, ey = by - ay, L2 = ex * ex + ey * ey;
    let t = ((px - ax) * ex + (py - ay) * ey) / L2; t = Math.max(0, Math.min(1, t));
    const qx = ax + ex * t, qy = ay + ey * t, d = Math.hypot(px - qx, py - qy);
    /* ¿de qué lado está? (debajo del suelo = adentro) */
    const lado = cruz(ex, ey, px - ax, py - ay);
    const dd = lado < 0 ? -d : d;
    if (dd < md) { md = dd; mejor = { qx, qy, d: dd, ex, ey, L: Math.sqrt(L2) }; }
  }
  return mejor;
}

/* ---------------- el vehículo ---------------- */
/* def: la ficha del vehículo (ver vehiculos.js); mej: las mejoras (0 a 1 cada una):
   motor, llantas, susp, tanque, aire (cuánto se lo gira en el aire) */
export function crearAuto(def, x, y, mej = {}) {
  const k = (m) => mej[m] || 0;
  const A = {
    def,
    x, y, a: 0, vx: 0, vy: 0, w: 0,
    m: def.masa, I: def.inercia,
    motor: def.motor.torque * (1 + 0.9 * k('motor')),
    giroMax: def.motor.giro * (1 + 0.35 * k('motor')),
    agarre: def.agarre * (1 + 0.45 * k('llantas')),
    susK: def.susp.k * (1 + 0.5 * k('susp')), susC: def.susp.c * (1 + 0.6 * k('susp')),
    traccion: def.traccion || 'atras',
    aireGiro: def.aireGiro * (1 + 0.6 * k('aire')),
    tanque: def.tanque * (1 + 1.2 * k('tanque')), nafta: 0,
    ruedas: def.ruedas.map((r) => {
      const [mx, my] = rot(r.x, r.y, 0);
      return { ...r, px: x + mx, py: y + my - r.reposo, vx: 0, vy: 0, spin: 0, ang: 0, m: r.masa, I: 0.5 * r.masa * r.r * r.r, toca: false, n: [0, 1], compr: 0 };
    }),
    /* lo que pasa en el paso, para el dibujo, el sonido y el bot */
    tocaAlguna: false, aire: 0, choco: false, tirado: 0, golpe: 0, rpm: 0, patina: 0,
  };
  A.nafta = A.tanque;
  return A;
}

/* inp: { gas: 0..1, freno: 0..1 } */
export function pasoAuto(A, S, inp, dt = PASO) {
  const D = A.def;
  const gas = inp.gas || 0, freno = inp.freno || 0;
  const sinNafta = A.nafta <= 0;
  const acel = sinNafta ? 0 : gas;
  /* ---- la gravedad (y el viento de frente de la Patagonia, más fuerte en el aire) ---- */
  A.vy -= G * dt;
  if (S.viento) A.vx += S.viento * (A.tocaAlguna ? 0.6 : 1) * dt;
  for (const R of A.ruedas) R.vy -= G * dt;

  /* ---- el motor: torque en las ruedas con tracción, y el contrario en el chasis ---- */
  const sentido = acel > 0 ? 1 : freno > 0 ? -1 : 0;
  let torqueTotal = 0;
  for (let i = 0; i < A.ruedas.length; i++) {
    const R = A.ruedas[i];
    const traccion = A.traccion === 'ambas' || (A.traccion === 'atras' ? i === 0 : i === A.ruedas.length - 1);
    /* girar para la derecha es spin negativo (ver el contacto) */
    const giroMax = A.giroMax / R.r;
    if (sentido > 0 && traccion) {
      const falta = Math.max(0, 1 + R.spin / giroMax);            // cuánto le falta para el máximo hacia adelante
      const t = A.motor * acel * Math.min(1, falta * 3);
      R.spin -= t * dt / R.I; torqueTotal += t;
    } else if (sentido < 0) {
      /* freno: si va para adelante frena; parado, marcha atrás suave */
      if (R.spin < -0.5) { const t = D.motor.freno * freno; R.spin += Math.min(-R.spin, t * dt / R.I); }
      else if (traccion) { const t = A.motor * 0.55 * freno * Math.min(1, Math.max(0, 1 - R.spin / (giroMax * 0.4)) * 3); R.spin += t * dt / R.I; torqueTotal -= t; }
    }
    /* el roce propio de la rueda */
    R.spin *= 1 - 0.15 * dt;
  }
  /* el torque de reacción levanta la trompa (sentido contrario a las agujas = positivo) */
  A.w += torqueTotal * D.reaccion * dt / A.I;
  /* en el aire: acelerar gira para atrás, frenar para adelante */
  if (!A.tocaAlguna) A.w += (acel - freno) * A.aireGiro * dt;
  A.w *= 1 - 0.25 * dt;

  /* ---- suspensión: resorte y amortiguador (los topes van como restricciones, abajo) ---- */
  const [ux, uy] = rot(0, -1, A.a), [lx, ly] = rot(1, 0, A.a);
  for (const R of A.ruedas) {
    const [ox, oy] = rot(R.x, R.y, A.a);
    const dx = R.px - A.x - ox, dy = R.py - A.y - oy;
    const s = dx * ux + dy * uy;
    const rx = R.px - A.x, ry = R.py - A.y;
    const vr = (R.vx - (A.vx - A.w * ry)) * ux + (R.vy - (A.vy + A.w * rx)) * uy;
    const F = A.susK * (R.reposo - s) - A.susC * vr;
    R.compr = 1 - s / R.reposo; R.s = s;
    const fx = F * ux, fy = F * uy;
    R.vx += fx / R.m * dt; R.vy += fy / R.m * dt;
    A.vx -= fx / A.m * dt; A.vy -= fy / A.m * dt;
    A.w -= cruz(rx, ry, fx, fy) / A.I * dt;
  }

  /* ---- restricciones e impulsos, varias vueltas ----
     Por qué los topes de la suspensión son restricciones y no resortes duros: cuando el casco
     pega contra una rampa, el chasis salta y un resorte 12 veces más duro devolvía el golpe
     multiplicado (el auto salía a 80 m/s). Una restricción solo frena lo que se pasa. */
  for (const R of A.ruedas) { R.jn = 0; R.jTope = 0; R.jFondo = 0; R.toca = false; }
  let tocan = 0, patina = 0;
  /* un impulso entre la rueda y el chasis, en la dirección (dx, dy), aplicado donde está la rueda */
  const tirar = (R, dx, dy, lam, rx, ry) => {
    R.vx += lam * dx / R.m; R.vy += lam * dy / R.m;
    A.vx -= lam * dx / A.m; A.vy -= lam * dy / A.m;
    A.w -= cruz(rx, ry, dx, dy) * lam / A.I;
  };
  for (let it = 0; it < 6; it++) {
    for (const R of A.ruedas) {
      const [ox, oy] = rot(R.x, R.y, A.a);
      const dx = R.px - A.x - ox, dy = R.py - A.y - oy;
      const rx = R.px - A.x, ry = R.py - A.y;
      /* la rueda no se va de costado: velocidad relativa lateral cero, y corrige el corrimiento */
      {
        const p = dx * lx + dy * ly;
        const vrel = (R.vx - (A.vx - A.w * ry)) * lx + (R.vy - (A.vy + A.w * rx)) * ly;
        const rl = cruz(rx, ry, lx, ly), k = 1 / R.m + 1 / A.m + rl * rl / A.I;
        tirar(R, lx, ly, -(vrel + Math.max(-2, Math.min(2, 0.25 * p / dt))) / k, rx, ry);
      }
      /* los topes: ni más estirada que 1,5 veces el reposo ni más hundida que un quinto */
      {
        const s = dx * ux + dy * uy;
        const ru = cruz(rx, ry, ux, uy), k = 1 / R.m + 1 / A.m + ru * ru / A.I;
        const vr = () => (R.vx - (A.vx - A.w * ry)) * ux + (R.vy - (A.vy + A.w * rx)) * uy;
        const sMax = R.reposo * 1.5, sMin = R.reposo * 0.2;
        if (s + vr() * dt > sMax) {
          const quiero = Math.max(-2, (sMax - s) * 0.3 / dt);
          let lam = -(vr() - quiero) / k;
          const v = R.jTope; R.jTope = Math.min(0, v + lam); lam = R.jTope - v;
          tirar(R, ux, uy, lam, rx, ry);
        }
        if (s + vr() * dt < sMin) {
          const quiero = Math.min(2, (sMin - s) * 0.3 / dt);
          let lam = -(vr() - quiero) / k;
          const v = R.jFondo; R.jFondo = Math.max(0, v + lam); lam = R.jFondo - v;
          tirar(R, ux, uy, lam, rx, ry);
        }
      }
      /* el piso */
      const q = masCercano(S, R.px, R.py, R.r + 0.5);
      if (!q) continue;
      const pen = R.r - q.d;
      if (pen <= -0.01) continue;
      /* la normal: de la superficie hacia la rueda */
      let nx, ny;
      const dd = Math.abs(q.d);
      if (dd > 1e-6) { nx = (R.px - q.qx) / q.d; ny = (R.py - q.qy) / q.d; } else { nx = -q.ey / q.L; ny = q.ex / q.L; }
      if (ny < 0 && q.d > 0) { nx = -q.ey / q.L; ny = q.ex / q.L; }
      R.toca = true; R.n = [nx, ny];
      const vn = R.vx * nx + R.vy * ny;
      /* sacarla de adentro del piso, pero sin patadas: con tope */
      const bias = Math.min(2.5, Math.max(0, pen - 0.005) * 0.3 / dt);
      let jn = -(vn - bias) * R.m;
      const viejo = R.jn; R.jn = Math.max(0, viejo + jn); jn = R.jn - viejo;
      R.vx += nx * jn / R.m; R.vy += ny * jn / R.m;
      /* la fricción en el punto de contacto (r = -n·radio) */
      const tx = ny, ty = -nx;
      const cx = -nx * R.r, cy = -ny * R.r;
      const vcx = R.vx - R.spin * cy, vcy = R.vy + R.spin * cx;
      const vt = vcx * tx + vcy * ty;
      const rt = cruz(cx, cy, tx, ty);
      const kt = 1 / R.m + rt * rt / R.I;
      let jt = -vt / kt;
      const tope = A.agarre * (S.agarre || 1) * R.jn;
      if (Math.abs(jt) > tope) { patina = Math.max(patina, Math.abs(vt)); jt = Math.sign(jt) * tope; }
      R.vx += tx * jt / R.m; R.vy += ty * jt / R.m;
      R.spin += rt * jt / R.I;
    }
  }
  for (const R of A.ruedas) if (R.toca) tocan++;
  A.tocaAlguna = tocan > 0; A.patina = patina;

  /* ---- el casco del chasis y la cabeza contra el piso ---- */
  A.x += A.vx * dt; A.y += A.vy * dt; A.a += A.w * dt;
  for (const R of A.ruedas) { R.px += R.vx * dt; R.py += R.vy * dt; R.ang += R.spin * dt; }
  for (const [hx, hy] of D.casco) {
    const [ox, oy] = rot(hx, hy, A.a);
    const px = A.x + ox, py = A.y + oy;
    const q = masCercano(S, px, py, 0.8);
    if (!q || q.d >= 0) continue;
    /* la normal del tramo que toca; se saca para afuera por ahí (con tope, así una pared no lo tira lejos) */
    const nx = -q.ey / q.L, ny = q.ex / q.L;
    const pen = Math.min(0.02, -q.d * 0.5);
    A.x += nx * pen; A.y += ny * pen;
    const vpx = A.vx - A.w * oy, vpy = A.vy + A.w * ox;
    const vn = vpx * nx + vpy * ny;
    if (vn < 0) {
      const rn = cruz(ox, oy, nx, ny), kn = 1 / A.m + rn * rn / A.I;
      const jn = -(vn - Math.min(1.5, -q.d * 0.3 / dt)) / kn;
      A.vx += nx * jn / A.m; A.vy += ny * jn / A.m; A.w += rn * jn / A.I;
      const tx = ny, ty = -nx, vt = (A.vx - A.w * oy) * tx + (A.vy + A.w * ox) * ty;
      const rt = cruz(ox, oy, tx, ty), kt = 1 / A.m + rt * rt / A.I;
      let jt = -vt / kt; const tope = 0.3 * jn; if (Math.abs(jt) > tope) jt = Math.sign(jt) * tope;
      A.vx += tx * jt / A.m; A.vy += ty * jt / A.m; A.w += rt * jt / A.I;
      A.golpe = Math.max(A.golpe, -vn);
    }
  }
  {
    const c = D.cabeza, [ox, oy] = rot(c.x, c.y, A.a);
    const px = A.x + ox, py = A.y + oy;
    const q = masCercano(S, px, py, c.r + 0.3);
    if (q && q.d < c.r) A.choco = true;
  }
  /* ---- la nafta y el estado ---- */
  if (acel > 0) A.nafta -= dt * (0.55 + 0.45 * acel) * D.consumo;
  else A.nafta -= dt * 0.25 * D.consumo;
  A.nafta = Math.max(0, A.nafta);
  A.aire = A.tocaAlguna ? 0 : A.aire + dt;
  /* la velocidad del motor (0 a 1), para el sonido y las agujas */
  let sp = 0, nt = 0;
  for (let i = 0; i < A.ruedas.length; i++) { const R = A.ruedas[i]; sp = Math.max(sp, Math.abs(R.spin * R.r)); nt++; }
  A.rpm = Math.min(1, sp / A.giroMax);
  A.golpe *= 0.9;
}

/* dar vuelta: ¿el chasis quedó panza arriba (más de ~110°)? */
export function volcado(A) { const a = ((A.a % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI; return Math.abs(a) > 1.95; }

/* una copia (para el bot) */
export function copiarAuto(A) {
  return { ...A, ruedas: A.ruedas.map((R) => ({ ...R, n: R.n.slice() })) };
}

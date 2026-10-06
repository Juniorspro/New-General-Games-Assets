/* ============================================================================
   barro/js/piloto.js — los rivales manejan con la misma física que el jugador
   y los mismos tres mandos (gas, freno, echarse). En el piso buscan llegar a
   cada labio a la velocidad justa para caer en la bajada; en el aire calculan
   dónde van a caer y ponen la moto paralela a esa bajada. El nivel (0 a 1)
   cambia qué tan cerca de la velocidad ideal llegan, cuánto tardan en
   corregir y cuánto le erran al ángulo. Puro: corre en Node.
   ========================================================================== */
import { G, altoEn, anguloEn, difAng } from './fisica.js';
import { azar } from './pistas.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function crearPiloto(nivel, semilla = 1) {
  const r = azar(semilla);
  return {
    nivel,
    vel: 0.9 + 0.11 * nivel,                 // qué tan cerca de la velocidad ideal
    error: (1 - nivel) * 0.2,                 // cuánto le erra al ángulo de caída (rad)
    cada: 0.03 + (1 - nivel) * 0.09,          // cada cuánto decide (s)
    gasMax: 0.8 + 0.2 * nivel,                // los flojos no van a fondo
    r, prox: 0, sal: { gas: 1, freno: 0, inclinar: 0 }, sesgo: 0, saltoActual: null, banda: 1,
  };
}

/* el próximo salto delante de x (o el que se está volando) */
function saltoCerca(pista, x) {
  for (const s of pista.saltos) if (x < s.aterrFin && x > s.xIni) return s;
  return null;
}

export function manejar(P, M, pista, t) {
  if (t < P.prox) return P.sal;
  P.prox = t + P.cada;
  const S = pista.suelo;
  const sal = P.sal;
  const enAire = !M.ruedas[0].enSuelo && !M.ruedas[1].enSuelo;
  const v = Math.hypot(M.vx, M.vy);

  if (enAire) {
    // dónde cae el centro de masa (va ~0,72 m arriba del contacto)
    let x = M.x, y = M.y, vx = M.vx, vy = M.vy, tl = 0;
    while (tl < 3) {
      tl += 0.02; x += vx * 0.02; vy -= G * 0.02; y += vy * 0.02;
      if (vy < 0 && y - 0.72 <= altoEn(S, x)) break;
    }
    if (P.saltoActual !== x >> 3) { P.saltoActual = x >> 3; P.sesgo = (P.r() * 2 - 1) * P.error; }
    const objetivo = anguloEn(S, x, 1.0) + P.sesgo;
    const falta = difAng(objetivo, M.a);
    const wd = clamp(falta / Math.max(tl - 0.06, 0.14), -3.6, 3.6);
    sal.inclinar = clamp(-wd / M.F.aireGiro, -1, 1);
    sal.gas = 0.7; sal.freno = 0;
    return sal;
  }

  // en el piso
  const suelo = anguloEn(S, M.x, 0.6);
  const rel = difAng(M.a, suelo);
  sal.inclinar = rel > 0.32 ? 1 : rel > 0.16 ? 0.55 : rel < -0.22 ? -0.7 : 0;
  sal.gas = 1; sal.freno = 0;
  const s = saltoCerca(pista, M.x);
  if (s && M.x < s.xLabio) {
    let quiero = s.vIdeal * P.vel * P.banda;
    if (!s.mesa) quiero = clamp(quiero, s.vMin + 0.6, s.vMax - 0.6);
    // velocidad estimada al llegar al labio (el motor ayuda en la cara)
    const dh = s.yLabio - (M.y - 0.72);
    const lejos = s.xLabio - M.x;
    // la velocidad que hay que traer acá para llegar al labio a la justa: lo que se pierde
    // subiendo la cara, menos lo que empuja el motor en ella
    const empuje = M.F.motor * Math.max(0, 1 - (v / M.F.vmax) ** 2);
    const cara = Math.min(lejos, (s.yLabio - s.yBase) / Math.tan(s.ang) + 0.5);
    const vObj = Math.sqrt(Math.max(1, quiero * quiero + 2 * G * Math.max(0, dh) - 2 * empuje * Math.max(0, cara) * 0.45)) + 0.4;
    // en la cara, un poco adelante para que el labio no la pare
    if (suelo > 0.3 && lejos < 2.5) sal.inclinar = Math.max(sal.inclinar, 0.45);
    if (lejos < 20) {
      if (v > vObj + 1.2) { sal.gas = 0; sal.freno = clamp((v - vObj) / 5, 0.15, 1); }
      else if (v > vObj + 0.2) sal.gas = 0.15;
    }
  }
  sal.gas = Math.min(sal.gas, P.gasMax);
  // en las olas se va en una rueda (atrás)
  for (const z of pista.zonas) if (z.tipo === 'olas' && M.x > z.xIni - 2 && M.x < z.xFin && rel < 0.25) sal.inclinar = Math.min(sal.inclinar, -0.35);
  return sal;
}

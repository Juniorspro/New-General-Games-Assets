/* ============================================================================
   ruta40/js/piloto.js — un conductor de mentira que maneja con la misma
   física que el jugador. Lo usan los rivales de las picadas y el bot que
   comprueba los tramos.

   Mira dos cosas: en el piso, que la trompa no se levante de más (si se
   levanta, suelta o frena, que baja la trompa); en el aire, que caiga con
   el ángulo del piso donde va a caer. `P` lo hace más o menos bueno:
     tope: cuánto deja levantar la trompa (rad) · mira: cuánto anticipa en el
     aire · duda: cada cuánto se equivoca (0 = nunca), con su propia semilla.
   ========================================================================== */
import { altoEn } from './fisica.js';

export const PILOTO_BUENO = { tope: 0.5, mira: 0.3, tol: 0.1, duda: 0, gasAlAterrizar: 1 };

export function crearPiloto(P = PILOTO_BUENO, semilla = 1) {
  let a = semilla >>> 0, errorHasta = 0, errorTipo = 0, t = 0;
  const azar = () => { a = (a + 0x6d2b79f5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  return (A, S, dt) => {
    t += dt;
    const pend = (x) => Math.atan2(altoEn(S, x + 0.8) - altoEn(S, x - 0.8), 1.6);
    /* los errores: de vez en cuando suelta el gas un ratito (así los rivales no son perfectos) */
    if (P.duda && t > errorHasta && azar() < P.duda * dt) { errorHasta = t + 0.25 + azar() * 0.5; errorTipo = azar() < 0.5 ? 0 : 1; }
    const errando = t < errorHasta;
    if (A.tocaAlguna) {
      const rel = A.a - pend(A.x);
      const w = A.w;
      /* la trompa sube: primero soltar, si sigue subiendo, frenar */
      if (rel + w * 0.2 > P.tope + 0.35) return { gas: 0, freno: 1 };
      if (rel + w * 0.2 > P.tope) return { gas: 0, freno: 0 };
      /* la trompa se clava (bajada fuerte): acelerar ayuda a levantarla */
      if (errando && errorTipo === 0) return { gas: 0, freno: 0 };
      return { gas: 1, freno: 0 };
    }
    /* en el aire: el piso donde va a caer */
    const vx = Math.max(1, A.vx);
    const caer = A.x + vx * P.mira + vx * 0.25;
    const quiero = pend(caer);
    const err = (A.a + A.w * 0.22) - quiero;
    if (errando && errorTipo === 1) return { gas: 0, freno: 0 };
    if (err > P.tol) return { gas: 0, freno: 1 };
    if (err < -P.tol) return { gas: 1, freno: 0 };
    return { gas: P.gasAlAterrizar ? 0.5 : 0, freno: 0 };
  };
}

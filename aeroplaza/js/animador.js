/* ============================================================================
   aeroplaza/js/animador.js — las animaciones por poses clave del muñeco.
   El muñeco tiene brazos y piernas de una pieza (como el R6 de Roblox), así
   que cada pose son rotaciones de: la cadera (cx inclinarse, cz de costado,
   ry girar, cy subir o bajar, pz adelante, sy estirar), la cabeza (hx, hy,
   hz) y los cuatro miembros (bl, br, pl, pr: [x, y, z]). Brazo o pierna con x
   negativo va para adelante; cadera con cx positivo se inclina adelante.
   "giro" es una vuelta alrededor del centro del cuerpo (rodar): se pasa a
   cx, cy y pz, porque la cadera gira en los pies.
   Tres maneras de pasar de una pose a la otra (Opciones › Imagen):
   - 'suave': con aceleración y frenado entre poses (como las curvas Bezier).
   - 'lineal': en línea recta, a velocidad pareja (se nota cada pose).
   - 'chop': a saltos, como la animación cuadro a cuadro: cada pose se queda
     quieta y salta a la próxima con un solo intermedio, y todo va a 12
     cuadros por segundo. Marcado, con golpe.
   Caminar y correr son los del video de Roblox que mandó quien pide (abajo);
   el resto, exagerado a la misma manera: el salto con los brazos arriba, el
   aterrizaje que aplasta.
   ========================================================================== */
export const ESTILOS_ANIM = ['suave', 'lineal', 'chop'];
export const CUADROS_CHOP = 12;
const CENTRO = 0.55;   // la altura del centro del cuerpo (para rodar sobre él)

/* ------------------------------------------------------------ las poses */
const espejo = (P) => {
  /* la misma pose del otro lado (para la mitad de un paso) */
  const q = { ...P };
  const inv = (v) => v && [v[0], -v[1], -v[2]];
  if (P.bl || P.br) { q.bl = inv(P.br); q.br = inv(P.bl); }
  if (P.pl || P.pr) { q.pl = inv(P.pr); q.pr = inv(P.pl); }
  if (P.ry != null) q.ry = -P.ry; if (P.cz != null) q.cz = -P.cz; if (P.hy != null) q.hy = -P.hy; if (P.hz != null) q.hz = -P.hz;
  return q;
};
/* caminar y correr: copiados del video que mandó quien pide (25/09, "Walking and
   running animations", dos R6 de Roblox), mirado cuadro por cuadro:
   - caminar (0,8 s el ciclo): rodilla bien alta (la pierna de adelante sube
     casi a 70°) y el brazo del MISMO lado va adelante y abierto; el otro va
     atrás, abierto y para arriba. El cuerpo gira un poco hacia el brazo de
     adelante y se ladea sobre la pierna de apoyo;
   - correr (0,6 s): muy inclinado para adelante, la pierna patea hasta quedar
     horizontal, los brazos bombean abiertos y bien altos, y rebota. */
const K0 = { pr: [-1.32, 0, 0.06], pl: [0.2, 0, -0.02], br: [-0.85, 0, 0.55], bl: [0.8, 0, -1.35], ry: -0.14, cz: 0.05, cy: 0.035, cx: 0.05, hy: 0.07, hx: -0.02, sy: 1.01 };
const K1 = { pr: [-0.35, 0, 0.03], pl: [0.02, 0, -0.01], br: [-0.05, 0, 0.36], bl: [0.1, 0, -0.46], ry: 0, cz: 0, cy: -0.015, cx: 0.05, hy: 0, hx: 0, sy: 0.99 };
const C0 = { pr: [-1.65, 0, 0.1], pl: [0.7, 0, -0.06], br: [-1.9, 0, 0.6], bl: [1.05, 0, -1.35], cx: 0.5, ry: -0.3, cz: 0.1, cy: 0.09, hx: -0.38, hy: 0.12, sy: 1.05 };
const C1 = { pr: [-0.4, 0, 0.05], pl: [0.22, 0, -0.02], br: [-0.3, 0, 0.6], bl: [0.2, 0, -0.7], cx: 0.38, ry: 0, cz: 0, cy: -0.06, hx: -0.3, hy: 0, sy: 0.95 };

export const CLIPS = {
  corre: { dur: 0.6, loop: true, k: [{ t: 0, ...C0 }, { t: 0.15, ...C1 }, { t: 0.3, ...espejo(C0) }, { t: 0.45, ...espejo(C1) }] },
  camina: { dur: 0.8, loop: true, k: [{ t: 0, ...K0 }, { t: 0.2, ...K1 }, { t: 0.4, ...espejo(K0) }, { t: 0.6, ...espejo(K1) }] },
  /* el salto: se agacha con los brazos atrás, sale con los brazos arriba y una rodilla alta */
  salta: { dur: 0.42, loop: false, k: [
    { t: 0, cy: -0.1, cx: 0.25, bl: [0.9, 0, -0.35], br: [0.9, 0, 0.35], pl: [0.35, 0, 0.05], pr: [0.3, 0, -0.05], sy: 0.9, hx: 0.1 },
    { t: 0.1, cy: 0.06, cx: -0.08, bl: [-2.95, 0, -0.3], br: [-2.95, 0, 0.3], pl: [-0.95, 0, 0.08], pr: [0.45, 0, -0.05], sy: 1.1, hx: -0.3 },
    { t: 0.42, cy: 0.02, cx: 0.0, bl: [-2.6, 0, -0.7], br: [-2.6, 0, 0.7], pl: [-0.6, 0, 0.08], pr: [0.3, 0, -0.05], sy: 1.04, hx: -0.18 }] },
  /* cayendo: los brazos arriba y abiertos, que se agitan; las piernas colgando */
  cae: { dur: 0.5, loop: true, k: [
    { t: 0, bl: [-2.3, 0, -1.0], br: [-2.5, 0, 1.25], pl: [0.3, 0, 0.14], pr: [-0.25, 0, -0.1], hx: 0.2, cx: 0.05, sy: 1.02 },
    { t: 0.25, bl: [-2.55, 0, -1.25], br: [-2.25, 0, 1.0], pl: [-0.2, 0, 0.1], pr: [0.3, 0, -0.14], hx: 0.24, cx: 0.08, sy: 1.02 }] },
  /* el golpe al tocar el piso: se aplasta, brazos adelante, piernas abiertas; y se levanta */
  aterriza: { dur: 0.3, loop: false, k: [
    { t: 0, cy: -0.24, cx: 0.4, sy: 0.78, bl: [-1.0, 0, -0.75], br: [-1.0, 0, 0.75], pl: [-0.55, 0, 0.3], pr: [0.45, 0, -0.3], hx: 0.25 },
    { t: 0.3, cy: 0, cx: 0.08, sy: 1, bl: [0, 0, -0.2], br: [0, 0, 0.2], pl: [0, 0, 0], pr: [0, 0, 0], hx: 0 }] },
  /* deslizarse: tirado para atrás, la pierna de adelante estirada, una mano en el piso */
  desliza: { dur: 0.36, loop: true, k: [
    { t: 0, cx: -1.02, cy: -0.1, pz: 0.12, pl: [-0.62, 0, 0.12], pr: [0.55, 0, -0.18], bl: [0.55, 0, -1.15], br: [-1.9, 0, 0.35], hx: 0.72, hy: 0.1, cz: 0.05, sy: 0.96 },
    { t: 0.18, cx: -1.06, cy: -0.11, pz: 0.12, pl: [-0.66, 0, 0.12], pr: [0.52, 0, -0.18], bl: [0.6, 0, -1.2], br: [-1.8, 0, 0.42], hx: 0.76, hy: 0.12, cz: 0.07, sy: 0.95 }] },
  /* rodar: una vuelta entera hacia adelante sobre el centro, hecho una bolita */
  rueda: { dur: 0.56, loop: false, k: [
    { t: 0, giro: 0, cy: -0.05, pl: [-0.6, 0, 0.1], pr: [0.2, 0, -0.1], bl: [-1.4, 0, -0.35], br: [-1.4, 0, 0.35], hx: 0.4, sy: 0.9 },
    { t: 0.1, giro: 1.2, cy: -0.25, pl: [-1.9, 0, 0.08], pr: [-1.75, 0, -0.08], bl: [-1.3, 0, -0.15], br: [-1.3, 0, 0.15], hx: 0.7, sy: 0.82 },
    { t: 0.3, giro: 3.6, cy: -0.28, pl: [-1.95, 0, 0.08], pr: [-1.85, 0, -0.08], bl: [-1.25, 0, -0.1], br: [-1.25, 0, 0.1], hx: 0.7, sy: 0.8 },
    { t: 0.44, giro: 5.6, cy: -0.2, pl: [-1.2, 0, 0.08], pr: [-0.6, 0, -0.08], bl: [-0.9, 0, -0.4], br: [-0.9, 0, 0.4], hx: 0.3, sy: 0.9 },
    { t: 0.56, giro: 6.283, cy: 0, pl: [-0.2, 0, 0.04], pr: [0.3, 0, -0.04], bl: [-0.2, 0, -0.35], br: [0.3, 0, 0.35], hx: 0, sy: 1 }] },
  /* trepar un borde: los brazos arriba agarrando, empuja hacia abajo y sube las rodillas */
  trepa: { dur: 0.46, loop: false, k: [
    { t: 0, cx: 0.3, cy: 0, bl: [-2.8, 0, -0.18], br: [-2.8, 0, 0.18], pl: [-0.6, 0, 0.05], pr: [0.35, 0, -0.05], hx: -0.35, sy: 1.08 },
    { t: 0.2, cx: 0.55, cy: 0.12, bl: [-1.6, 0, -0.3], br: [-1.6, 0, 0.3], pl: [-1.5, 0, 0.1], pr: [-0.9, 0, -0.1], hx: -0.1, sy: 0.92 },
    { t: 0.34, cx: 0.45, cy: 0.1, bl: [-0.3, 0, -0.35], br: [-0.3, 0, 0.35], pl: [-1.2, 0, 0.1], pr: [0.2, 0, -0.1], hx: 0.05, sy: 0.95 },
    { t: 0.46, cx: 0.1, cy: 0, bl: [0, 0, -0.2], br: [0, 0, 0.2], pl: [0, 0, 0], pr: [0, 0, 0], hx: 0, sy: 1 }] },
  /* el rebote en la pared: patada con una pierna atrás, abierto, girado */
  pared: { dur: 0.36, loop: false, k: [
    { t: 0, cx: -0.25, cz: 0.2, ry: 0.5, bl: [-2.5, 0, -1.1], br: [-0.8, 0, 1.3], pl: [0.95, 0, 0.1], pr: [-0.7, 0, -0.1], hx: -0.25, sy: 1.06 },
    { t: 0.36, cx: 0.05, cz: 0.05, ry: 0.1, bl: [-2.4, 0, -0.8], br: [-2.2, 0, 0.9], pl: [-0.5, 0, 0.08], pr: [0.3, 0, -0.05], hx: -0.15, sy: 1.02 }] },
};

/* ------------------------------------------------------------ evaluar */
const CANALES = ['cy', 'pz', 'cx', 'cz', 'ry', 'sy', 'hx', 'hy', 'hz', 'giro'];
const MIEMBROS = ['bl', 'br', 'pl', 'pr'];
const interp = (a, b, f) => a + (b - a) * f;
/* f (0 a 1 entre dos poses) según el estilo */
export function curva(f, estilo) {
  if (estilo === 'chop') return f < 0.5 ? 0 : f < 0.85 ? 0.5 : 1;   // la pose, un intermedio, la próxima
  if (estilo === 'lineal') return f;
  return f * f * (3 - 2 * f);   // suave
}
/* R: la pose de base (se pisan solo los canales que tiene el clip). t en segundos del clip */
export function aplicarClip(R, clip, t, estilo = 'suave', peso = 1) {
  const K = clip.k, T = clip.dur;
  let u = clip.loop ? ((t % T) + T) % T : Math.max(0, Math.min(t, T));
  if (estilo === 'chop') u = Math.floor(u * CUADROS_CHOP) / CUADROS_CHOP;
  let i = K.length - 1;
  for (let j = 0; j < K.length - 1; j++) if (u < K[j + 1].t) { i = j; break; }
  const a = K[i], ultima = i === K.length - 1;
  const b = ultima ? (clip.loop ? K[0] : a) : K[i + 1];
  const tb = ultima ? (clip.loop ? T : a.t) : b.t;
  const f = tb > a.t ? curva((u - a.t) / (tb - a.t), estilo) : 0;
  const S = {};
  for (const c of CANALES) {
    const va = a[c], vb = b[c]; if (va == null && vb == null) continue;
    S[c] = va == null ? vb : vb == null ? va : interp(va, vb, f);
  }
  for (const m of MIEMBROS) {
    const va = a[m], vb = b[m]; if (!va && !vb) continue;
    S[m] = !va ? vb : !vb ? va : [0, 1, 2].map((q) => interp(va[q], vb[q], f));
  }
  /* rodar sobre el centro: la cadera gira en los pies, así que se la corre */
  if (S.giro != null) {
    const g = S.giro; S.cx = (S.cx || 0) + g; S.cy = (S.cy || 0) + CENTRO * (1 - Math.cos(g)); S.pz = (S.pz || 0) - CENTRO * Math.sin(g); delete S.giro;
  }
  /* mezcla con la base según el peso (para entrar y salir de un clip) */
  for (const [c, v] of Object.entries(S)) {
    if (Array.isArray(v)) R[c] = peso >= 1 || !R[c] ? v : [0, 1, 2].map((q) => interp(R[c][q], v[q], peso));
    else R[c] = peso >= 1 || R[c] == null ? v : interp(R[c], v, peso);
  }
  return R;
}

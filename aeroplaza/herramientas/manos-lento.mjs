// LAS MANOS EN MOVIMIENTOS LENTOS, los de todos los días (sin navegador, como pruebas/manos-celu.mjs;
// es para afinar las constantes de js/manos.js, no una prueba que pasa o no pasa):
//     node aeroplaza/herramientas/manos-lento.mjs [manos.js] [la cámara tarda (ms) = 90] [ruido en profundidad = 1] [redes = 2]
//     SUAVE=rapida|media|suave  el nivel del menú (de entrada, media)
//     SEMILLAS=1,2,3,4,5        con qué semillas (se promedia)
//     CORTO=1                   una línea con lo principal (para comparar versiones)
//     RED=vieja|nueva           lo que tarda la red: buscando siempre dos manos (hasta la vuelta 16) o una
//                               (de entrada); ESCALA=0.7 el celu contra el contenedor (manos-celu.mjs)
// Mide, contra la mano de verdad:
// - quieta: lo que se va de su lugar (deriva, mm) y lo que se mueve de un cuadro al otro (tiembla, mm:
//   lo que se ve como temblor);
// - el atraso (ms) en rampas de costado a 5, 10, 20 y 40 cm/s, para arriba a 15 y en profundidad a 10;
// - cuánto tarda en arrancar (1 cm), cuánto se pasa al frenar y el tirón p99;
// - cuánto se estira la mano (los huesos contra los de verdad, %; estiraGira: con la mano girando);
// - cuánto se atrasa girando (giro: grados de la palma) y los movimientos chiquitos (fino: 1 cm despacio;
//   paso: 6 mm rápido): cuánto del movimiento se ve 0,3 s después (%) y cuándo llega a la mitad (ms);
// - cuánto se doblan los dedos de más (dobla: los ángulos de los nudillos contra los de verdad, grados) y
//   cuánto se atrasa un dedo que se dobla (dedo, ms). RUIDO=2: el doble de temblor en cada punto;
//   GLITCH=0.05: en el 5 % de las fotos un dedo sale corrido (como cuando MediaPipe lo erra).
// (una versión vieja de manos.js se compara con: git show <commit>:aeroplaza/js/manos.js > /tmp/manos-viejo.js,
// y pasándole esa ruta, absoluta)
const lienzo = () => { const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: (o, k, v) => ((o[k] = v), true) }); return { width: 0, height: 0, getContext: () => ctx }; };
globalThis.document = { createElement: lienzo, documentElement: {} };
const { Manos } = await import(process.argv[2] ? new URL(process.argv[2], 'file://' + process.cwd() + '/').href : '../js/manos.js');
const THREE = await import('three');
const LCAM = +(process.argv[3] || 90), HONDO = +(process.argv[4] || 1), REDES = +(process.argv[5] || 2), RUIDO = +(process.env.RUIDO || 1), GLITCH = +(process.env.GLITCH || 0);
const ABIERTA = [[0, 0, 0], [-0.025, 0.025, -0.01], [-0.045, 0.045, -0.015], [-0.06, 0.063, -0.02], [-0.07, 0.082, -0.025],
  [-0.022, 0.085, 0], [-0.025, 0.125, 0], [-0.027, 0.15, 0], [-0.028, 0.172, 0], [0, 0.088, 0], [0, 0.132, 0], [0, 0.16, 0], [0, 0.185, 0],
  [0.02, 0.083, 0], [0.021, 0.122, 0], [0.022, 0.148, 0], [0.023, 0.17, 0], [0.038, 0.074, 0], [0.041, 0.1, 0], [0.043, 0.118, 0], [0.045, 0.135, 0]];
/* los tramos: [empieza, dura, velocidad (m/s)] y quieta entre medio; la velocidad sube y baja en 80 ms */
const TRAMOS = [
  { t: 3.5, d: 1.0, v: [0.05, 0, 0], n: 'costado 5 cm/s' },
  { t: 5.1, d: 1.0, v: [-0.1, 0, 0], n: 'costado 10 cm/s' },
  { t: 6.7, d: 0.75, v: [0.2, 0, 0], n: 'costado 20 cm/s' },
  { t: 8.1, d: 0.5, v: [-0.4, 0, 0], n: 'costado 40 cm/s' },
  { t: 9.2, d: 0.6, v: [0, 0.15, 0], n: 'arriba 15 cm/s' },
  { t: 10.4, d: 1.0, v: [0, 0, -0.1], n: 'lejos 10 cm/s' },
  { t: 12.0, d: 1.0, v: [0, 0, 0.1], n: 'cerca 10 cm/s' },
  /* (y la mano que gira sobre sí misma, 2,5 rad/s, ida y vuelta: ahí se ve si se estira) */
  { t: 15.6, d: 0.7, w: 2.5, n: 'gira' },
  { t: 16.6, d: 0.7, w: -2.5, n: 'gira de vuelta' },
  /* (movimientos chiquitos: 1 cm despacio y un paso de 6 mm rápido: ¿los sigue?) */
  { t: 18.2, d: 1.0, v: [0.01, 0, 0], n: 'fino 1 cm/s', fino: true },
  { t: 19.8, d: 0.18, v: [-0.06, 0, 0], n: 'paso 6 mm', fino: true },   // (con las rampas de 80 ms: 6 mm)
  /* (y el índice que se dobla y se estira, como un pellizco: 70° en 0,25 s) */
  { t: 21.0, d: 0.33, dobla: 70 / 0.25 * Math.PI / 180, n: 'dobla' },
  { t: 21.8, d: 0.33, dobla: -70 / 0.25 * Math.PI / 180, n: 'estira' },
];
const FIN = 22.8, SUAVE = 0.08;
const perfil = (tr, t) => { const a = t - tr.t; if (a <= 0 || a >= tr.d) return 0; const s = (x) => x * x * (3 - 2 * x); return Math.min(1, s(Math.min(1, a / SUAVE)), s(Math.min(1, (tr.d - a) / SUAVE))); };
const PASO = 0.0005, POS = [], ANG = [], CURVA = [];
{ let p = [0.08, -0.12, -0.37], a = 0, cu = 0; for (let t = 0; t <= FIN + 0.5; t += PASO) { POS.push(p.slice()); ANG.push(a); CURVA.push(cu); for (const tr of TRAMOS) { const k = perfil(tr, t); if (tr.v) for (let c = 0; c < 3; c++) p[c] += tr.v[c] * k * PASO; if (tr.w) a += tr.w * k * PASO; if (tr.dobla) cu += tr.dobla * k * PASO; } } }
const iPaso = (t) => Math.max(0, Math.min(POS.length - 1, Math.round(t / PASO)));
const muneca = (t) => POS[iPaso(t)];
/* (gira alrededor del centro de la palma, con el eje vertical) */
const PIV = [0, 5, 9, 13, 17].reduce((a, i) => [a[0] + ABIERTA[i][0] / 5, a[1] + ABIERTA[i][1] / 5, a[2] + ABIERTA[i][2] / 5], [0, 0, 0]);
const puntos = (t) => {
  const m = muneca(t), a = ANG[iPaso(t)], c = Math.cos(a), sn = Math.sin(a), W = new Float32Array(63), cu = CURVA[iPaso(t)];
  /* (el índice: 6, 7 y 8 giran sobre el nudillo 5, hacia la palma) */
  const forma = ABIERTA.map(([x, y, z], i) => { if (i < 6 || i > 8 || !cu) return [x, y, z]; const b = ABIERTA[5], dy = y - b[1], dz = z - b[2]; return [x, b[1] + Math.cos(cu) * dy - Math.sin(cu) * dz, b[2] + Math.sin(cu) * dy + Math.cos(cu) * dz]; });
  forma.forEach(([x, y, z], i) => { const dx = x - PIV[0], dz = z - PIV[2]; W[i * 3] = m[0] + PIV[0] + c * dx + sn * dz; W[i * 3 + 1] = m[1] + y; W[i * 3 + 2] = m[2] + PIV[2] - sn * dx + c * dz; });
  return W;
};
/* los ángulos de los dedos (en cada nudillo, entre un hueso y el siguiente), en grados */
const CADENAS = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [0, 9, 10, 11, 12], [0, 13, 14, 15, 16], [0, 17, 18, 19, 20]];
const angulos = (P) => CADENAS.flatMap((c) => c.slice(1, -1).map((b, k) => {
  const a = c[k], d = c[k + 2], u = [0, 1, 2].map((q) => P[b * 3 + q] - P[a * 3 + q]), v = [0, 1, 2].map((q) => P[d * 3 + q] - P[b * 3 + q]);
  const cs = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (Math.hypot(...u) * Math.hypot(...v) || 1);
  return Math.acos(Math.max(-1, Math.min(1, cs))) * 180 / Math.PI;
}));
/* cuánto se estira la mano dibujada: cada hueso contra el de verdad (los de los dedos y la palma) */
const HUESOS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
const LARGO = HUESOS.map(([i, j]) => Math.hypot(...[0, 1, 2].map((c) => ABIERTA[i][c] - ABIERTA[j][c])));
const estiramiento = (P) => HUESOS.map(([i, j], h) => Math.abs(Math.hypot(P[i * 3] - P[j * 3], P[i * 3 + 1] - P[j * 3 + 1], P[i * 3 + 2] - P[j * 3 + 2]) / LARGO[h] - 1));
const centro = (P) => { let x = 0, y = 0, z = 0; for (let i = 0; i < 21; i++) { x += P[i * 3]; y += P[i * 3 + 1]; z += P[i * 3 + 2]; } return [x / 21, y / 21, z / 21]; };

function correr(semilla) {
  let s = semilla * 2654435761 >>> 0;
  const azar = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(azar() + 1e-12)) * Math.cos(2 * Math.PI * azar());
  const TAN = 0.65;
  const detectar = (tc) => {
    if (azar() < 0.05) return null;
    const W = puntos(tc), P = new Float32Array(63), img = new Float32Array(63);
    const tx = gauss() * 0.002, ty = gauss() * 0.002, tz = gauss() * 0.006 * HONDO + (azar() < 0.02 ? (azar() < 0.5 ? -1 : 1) * 0.12 : 0);
    for (let i = 0; i < 21; i++) {
      /* (RUIDO: cuánto tiembla cada punto por su cuenta; las puntas de los dedos, más) */
      const rp = RUIDO * (i % 4 === 0 && i ? 1.5 : 1);
      P[i * 3] = W[i * 3] + tx + gauss() * 0.0015 * rp; P[i * 3 + 1] = W[i * 3 + 1] + ty + gauss() * 0.0015 * rp; P[i * 3 + 2] = W[i * 3 + 2] + 0.06 + tz + gauss() * 0.002 * rp;
      const z = -P[i * 3 + 2]; img[i * 3] = 0.5 + P[i * 3] / z / (2 * TAN); img[i * 3 + 1] = 0.5 - P[i * 3 + 1] / z / (2 * TAN);
    }
    /* (GLITCH: a veces MediaPipe erra un dedo en una foto: se va entero para un lado, más en la punta) */
    if (GLITCH && azar() < GLITCH) { const f = Math.floor(azar() * 5), g = [gauss() * 0.008, gauss() * 0.008, gauss() * 0.008]; for (let j = 1; j < 4; j++) { const i = [1, 5, 9, 13, 17][f] + j; for (let c = 0; c < 3; c++) P[i * 3 + c] += g[c] * j / 3; } }
    return { derecha: true, puntos: P, confianza: 0.9, img };
  };
  const manos = new Manos(); manos.activa = true; manos.fuente = 'camara'; if (process.env.SUAVE) manos.suavidad = process.env.SUAVE;
  const q0 = new THREE.Quaternion(), p0 = new THREE.Vector3(), ctx = { cabezaP: p0, cabezaQ: q0, interactivos: [], altura: () => -10, sePuede: () => true };
  const DT = 1000 / 120, CAP = 1000 / 30;
  let prox = azar() * CAP, res = [], lat = [];
  /* las redes: cada una ocupada hasta 'libre'; buscando una mano (nueva) o dos (vieja) */
  const vieja = process.env.RED === 'vieja', ESC = +(process.env.ESCALA || 0.7), R_ = Array.from({ length: REDES }, () => ({ libre: -1, antes: false }));
  const traza = [], estira = [], forma = [], estiraGira = [], giro = [], dobla = [], dedo = [];   // [t, mostrado(3), real(3), alfa]; lo que se estiran los huesos
  for (let T = 0; T < FIN * 1000; T += DT) {
    for (const r of res.filter((r) => r.llega <= T)) { manos.recibirCamara(r.lista, r.tc, r.llega, vieja ? 2 : 1); lat.push(r.llega - r.tc); }
    res = res.filter((r) => r.llega > T);
    while (prox + LCAM <= T) {
      const tc = prox; prox += CAP * (0.95 + 0.1 * azar());
      const rd = R_.find((x) => x.libre <= T);
      if (!rd) continue;
      const d = detectar(tc / 1000);
      /* (busca palmas si busca dos, o si perdió la mano) */
      const ms = ESC * ((vieja || !rd.antes ? 38 : 0) + (d ? 36 : 0)) * (0.9 + 0.2 * azar());
      rd.antes = !!d; rd.libre = T + 4 + ms;
      res.push({ lista: d ? [d] : [], tc, llega: T + 4 + ms });
    }
    const tVer = T + 25;
    manos.registrarCabeza(tVer, q0, p0, 0);
    manos.actualizar(DT / 1000, tVer, ctx);
    const M = manos.manos.find((m) => (m.alfa ?? (m.visible ? 1 : 0)) > 0.5), tS = tVer / 1000;
    traza.push([tS, M ? centro(M.p) : null, centro(puntos(tS))]);
    if (M && tS > 1 && TRAMOS.some((tr) => tr.w && tS > tr.t && tS < tr.t + tr.d + 0.3)) {
      const eje = (P) => { const x = P[15] - P[51], z = P[17] - P[53]; return Math.atan2(-z, x); }, dif = Math.abs(((eje(M.p) - eje(puntos(tS)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      giro.push(dif * 180 / Math.PI);
    }
    if (M && tS > 1) {
      const aD = angulos(M.p), aR = angulos(puntos(tS)), er = aD.map((x, k) => (x - aR[k]) ** 2);
      dobla.push(Math.sqrt(er.reduce((q, w) => q + w, 0) / er.length));
      /* (el índice doblándose: el ángulo en el nudillo 5, mostrado y de verdad) */
      if (TRAMOS.some((tr) => tr.dobla && tS > tr.t - 0.2 && tS < tr.t + tr.d + 0.4)) dedo.push([tS, aD[3], aR[3]]);
    }
    if (M && tS > 1) { const e = estiramiento(M.p); estira.push(Math.max(...e)); forma.push(e.reduce((a, b) => a + b, 0) / e.length); if (TRAMOS.some((tr) => tr.w && tS > tr.t && tS < tr.t + tr.d + 0.3)) estiraGira.push(Math.max(...e)); }
  }
  const latMedia = lat.reduce((a, b) => a + b, 0) / lat.length;
  /* medir */
  const out = { lat: latMedia };
  const p95 = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length * 0.95)] : NaN; };
  out.giro = giro.reduce((a, b) => a + b, 0) / Math.max(1, giro.length); out.giroP95 = p95(giro);
  out.dobla = dobla.reduce((a, b) => a + b, 0) / Math.max(1, dobla.length); out.doblaP95 = p95(dobla);
  /* el dedo: cuándo el mostrado llega a la mitad del doblez, contra el de verdad (ms) */
  { const tr = TRAMOS.find((x) => x.dobla > 0), a0 = dedo[0]?.[2] ?? 0, mitad = a0 + 35;
    const tR = dedo.find(([t, , r]) => t > tr.t && r > mitad)?.[0], tM = dedo.find(([t, m]) => t > tr.t && m > mitad)?.[0];
    out.dedo = tR && tM ? (tM - tR) * 1000 : NaN; }
  out.estira = p95(estira) * 100; out.forma = forma.reduce((a, b) => a + b, 0) / Math.max(1, forma.length) * 100; out.estiraGira = p95(estiraGira) * 100;
  /* quieta: 1-2 s */
  const reposo = (a, b) => {
    const q = traza.filter(([t, m]) => t > a && t < b && m).map(([, m, r]) => m.map((x, c) => x - r[c]));
    const mm = [0, 1, 2].map((c) => q.reduce((s, v) => s + v[c], 0) / q.length);
    const deriva = Math.sqrt(q.reduce((s, v) => s + v.reduce((u, x, c) => u + (x - mm[c]) ** 2, 0), 0) / q.length) * 1000;
    let t2 = 0; for (let i = 1; i < q.length; i++) t2 += (q[i][0] - q[i - 1][0]) ** 2 + (q[i][1] - q[i - 1][1]) ** 2 + (q[i][2] - q[i - 1][2]) ** 2;
    return { deriva, tiembla: Math.sqrt(t2 / Math.max(1, q.length - 1)) * 1000 };
  };
  { const a = reposo(1.5, 3.4), b = reposo(14.0, 15.4); out.quieta = (a.deriva + b.deriva) / 2; out.tiembla = (a.tiembla + b.tiembla) / 2; out.quieta2 = b.deriva; }
  for (const tr of TRAMOS) {
    if (!tr.v) continue;
    const sp = Math.hypot(...tr.v), dir = tr.v.map((x) => x / sp);
    /* atraso en la parte pareja: lo que el real va adelante, en el sentido del movimiento, sobre la velocidad */
    const par = traza.filter(([t, m]) => m && t > tr.t + 0.35 && t < tr.t + tr.d - 0.05);
    const atraso = par.reduce((a, [, m, r]) => a + (r[0] - m[0]) * dir[0] + (r[1] - m[1]) * dir[1] + (r[2] - m[2]) * dir[2], 0) / par.length / sp * 1000;
    /* arranque: cuándo se movió 1 cm lo mostrado, contra cuándo se movió 1 cm lo real */
    const i0 = traza.findIndex(([t]) => t >= tr.t - 0.02), b = traza[i0], m0 = b[1], r0 = b[2];
    const avanzo = (p, q) => (p[0] - q[0]) * dir[0] + (p[1] - q[1]) * dir[1] + (p[2] - q[2]) * dir[2];
    const tR = traza.slice(i0).find(([, , r]) => avanzo(r, r0) > 0.01)?.[0], tM = m0 ? traza.slice(i0).find(([, m]) => m && avanzo(m, m0) > 0.01)?.[0] : null;
    /* al frenar: cuánto se pasa lo mostrado de donde quedó el real */
    const fin = traza.filter(([t, m]) => m && t > tr.t + tr.d && t < tr.t + tr.d + 0.5), rf = muneca(tr.t + tr.d + 0.3), cf = centro(puntos(tr.t + tr.d + 0.3));
    const pasa = Math.max(0, ...fin.map(([, m]) => avanzo(m, cf))) * 1000;
    out[tr.n] = { atraso, arranque: tR && tM ? (tM - tR) * 1000 : NaN, pasa };
    if (tr.fino) {
      const total = sp * (tr.d - SUAVE), j = traza.findIndex(([t]) => t >= tr.t + tr.d + 0.3), fin2 = traza[j];
      const hecho = fin2?.[1] && m0 ? avanzo(fin2[1], m0) / total : NaN;
      const tMitad = m0 ? traza.slice(i0).find(([, m]) => m && avanzo(m, m0) > total / 2)?.[0] : null;
      out[tr.n].hecho = hecho * 100; out[tr.n].mitad = tMitad ? (tMitad - (tr.t + tr.d / 2)) * 1000 : NaN;
    }
  }
  /* tirón p99: la aceleración de lo mostrado contra la real */
  const tir = []; for (let i = 2; i < traza.length; i++) { const [a, b, c] = [traza[i - 2], traza[i - 1], traza[i]]; if (!a[1] || !b[1] || !c[1]) continue; tir.push(Math.hypot(...[0, 1, 2].map((k) => (c[1][k] - 2 * b[1][k] + a[1][k]) - (c[2][k] - 2 * b[2][k] + a[2][k]))) * 1000); }
  tir.sort((x, y) => x - y); out.tironP99 = tir[Math.floor(tir.length * 0.99)];
  return out;
}
const rs = (process.env.SEMILLAS ? process.env.SEMILLAS.split(",").map(Number) : [1, 2, 3]).map(correr), m = (f) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
const res = { dobla: +m((r) => r.dobla).toFixed(1), doblaP95: +m((r) => r.doblaP95).toFixed(1), dedo: +m((r) => r.dedo).toFixed(0), giro: +m((r) => r.giro).toFixed(1), giroP95: +m((r) => r.giroP95).toFixed(1), lat: +m((r) => r.lat).toFixed(0), quieta: +m((r) => r.quieta).toFixed(2), quieta2: +m((r) => r.quieta2).toFixed(2), tiembla: +m((r) => r.tiembla).toFixed(3), tironP99: +m((r) => r.tironP99).toFixed(1), estira: +m((r) => r.estira).toFixed(1), forma: +m((r) => r.forma).toFixed(1), estiraGira: +m((r) => r.estiraGira).toFixed(1) };
for (const tr of TRAMOS.filter((x) => x.v)) res[tr.n] = { atraso: +m((r) => r[tr.n].atraso).toFixed(0), arranque: +m((r) => r[tr.n].arranque).toFixed(0), pasa: +m((r) => r[tr.n].pasa).toFixed(1), ...(tr.fino ? { hecho: +m((r) => r[tr.n].hecho).toFixed(0), mitad: +m((r) => r[tr.n].mitad).toFixed(0) } : {}) };
if (process.env.CORTO) {
  const lados = ['costado 5 cm/s', 'costado 10 cm/s', 'costado 20 cm/s', 'costado 40 cm/s', 'arriba 15 cm/s'], hon = ['lejos 10 cm/s', 'cerca 10 cm/s'], F1 = res['fino 1 cm/s'], F2 = res['paso 6 mm'];
  const med = (ks, k) => ks.reduce((a, n) => a + res[n][k], 0) / ks.length;
  console.log(JSON.stringify({ dobla: res.dobla, doblaP95: res.doblaP95, dedo: res.dedo, fino: F1.hecho, finoMitad: F1.mitad, paso: F2.hecho, pasoMitad: F2.mitad, giro: res.giro, giroP95: res.giroP95, estira: res.estira, forma: res.forma, estiraGira: res.estiraGira, lat: res.lat, quieta: res.quieta, q2: res.quieta2, tiembla: res.tiembla, p99: res.tironP99, atrasoLado: +med(lados, 'atraso').toFixed(0), atraso5: res['costado 5 cm/s'].atraso, atraso10: res['costado 10 cm/s'].atraso, arranqueLado: +med(lados, 'arranque').toFixed(0), pasaLado: +med(lados, 'pasa').toFixed(1), atrasoHondo: +med(hon, 'atraso').toFixed(0), arranqueHondo: +med(hon, 'arranque').toFixed(0) }));
} else console.log(JSON.stringify(res, null, 1));

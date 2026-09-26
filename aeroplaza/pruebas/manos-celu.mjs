// LAS MANOS POR LA CÁMARA DEL CELU, simuladas (sin navegador: manos.js solo, con el reloj de mentira).
// Lo que pasa en un celu de verdad, que en el contenedor no se ve:
// - la foto llega tarde: la cámara tarda 30-150 ms en darla y la red 40-80 ms en leerla (una a la vez:
//   si está ocupada, la foto se saltea); en total 90-210 ms;
// - la red a veces no ve la mano (más si va rápido y justo después de perderla), le erra a la
//   profundidad (±12 cm, una de cada 50) y dice que es la otra mano (una de cada 8);
// - se dibuja a 120 por segundo.
// Se mide: cuadros sin mano, cuántas veces titila (se apaga y se prende), manos dobles, el tirón de
// cada cuadro (la aceleración contra la de verdad: un salto o un escalón se ve acá), el temblor
// quieta y el atraso. Con la versión anterior de manos.js (la de la vuelta 13) daba, con 150 ms de
// atraso: 13 % sin mano, 105 titileos por minuto, tirón p99 111 mm; con 210 ms, 79 % sin mano.
//     node pruebas/manos-celu.mjs
const lienzo = () => { const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: (o, k, v) => ((o[k] = v), true) }); return { width: 0, height: 0, getContext: () => ctx }; };
globalThis.document = { createElement: lienzo, documentElement: {} };
const { Manos } = await import('../js/manos.js');
const THREE = await import('three');
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };

/* la mano derecha abierta (metros, desde la muñeca); la izquierda, el espejo */
const ABIERTA = [[0, 0, 0], [-0.025, 0.025, -0.01], [-0.045, 0.045, -0.015], [-0.06, 0.063, -0.02], [-0.07, 0.082, -0.025],
  [-0.022, 0.085, 0], [-0.025, 0.125, 0], [-0.027, 0.15, 0], [-0.028, 0.172, 0], [0, 0.088, 0], [0, 0.132, 0], [0, 0.16, 0], [0, 0.185, 0],
  [0.02, 0.083, 0], [0.021, 0.122, 0], [0.022, 0.148, 0], [0.023, 0.17, 0], [0.038, 0.074, 0], [0.041, 0.1, 0], [0.043, 0.118, 0], [0.045, 0.135, 0]];

function simular({ L = 90, semilla = 1, dos = false, limpio = false }) {
  let s = semilla * 2654435761 >>> 0;
  const azar = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(azar() + 1e-12)) * Math.cos(2 * Math.PI * azar());
  /* el recorrido: quieta, de lado a lado (0,8 Hz, hasta 0,75 m/s), quieta, rápido (1,2 Hz, hasta
     1,5 m/s), quieta. Limpio: una ida y vuelta suave sin errores de la red (solo el atraso) */
  const QUIETA = [[0, 1.5], [4.0, 6], [7.6667, 9.5]];
  const muneca = (der, t) => {
    const x0 = der ? 0.1 : -0.12;
    if (limpio) return [x0 + 0.25 * Math.sin(2 * Math.PI * 0.4 * t), -0.15, -0.35];
    let x = x0;
    if (t >= 1.5 && t < 4.0) x = x0 + 0.15 * Math.sin(2 * Math.PI * 0.8 * (t - 1.5));
    else if (t >= 6 && t < 7.6667) x = x0 + 0.2 * Math.sin(2 * Math.PI * 1.2 * (t - 6));
    return [x, -0.15 + (der ? 0 : 0.02), -0.35];
  };
  const velocidad = (der, t) => { const a = muneca(der, t - 0.005), b = muneca(der, t + 0.005); return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.01; };
  const puntos = (der, t) => { const m = muneca(der, t), W = new Float32Array(63); ABIERTA.forEach(([x, y, z], i) => { W[i * 3] = m[0] + (der ? x : -x); W[i * 3 + 1] = m[1] + y; W[i * 3 + 2] = m[2] + z; }); return W; };
  const centro = (P) => { let x = 0, y = 0, z = 0; for (let i = 0; i < 21; i++) { x += P[i * 3]; y += P[i * 3 + 1]; z += P[i * 3 + 2]; } return [x / 21, y / 21, z / 21]; };
  const TAN = 0.65;
  /* lo que devuelve MediaPipe: en la cámara (6 cm adelante de los ojos), con sus errores */
  const detectar = (der, tc, perdida) => {
    if (!limpio && azar() < 0.07 + 0.06 * velocidad(der, tc) + (perdida ? 0.1 : 0)) return null;
    const W = puntos(der, tc), P = new Float32Array(63), img = new Float32Array(63);
    const tx = gauss() * 0.002, ty = gauss() * 0.002, tz = limpio ? 0 : gauss() * 0.006 + (azar() < 0.02 ? (azar() < 0.5 ? -1 : 1) * 0.12 : 0);
    const r = limpio ? 0 : 1;
    for (let i = 0; i < 21; i++) {
      P[i * 3] = W[i * 3] + tx * r + gauss() * 0.0015 * r; P[i * 3 + 1] = W[i * 3 + 1] + ty * r + gauss() * 0.0015 * r; P[i * 3 + 2] = W[i * 3 + 2] + 0.06 + tz + gauss() * 0.002 * r;
      const z = -P[i * 3 + 2]; img[i * 3] = 0.5 + P[i * 3] / z / (2 * TAN); img[i * 3 + 1] = 0.5 - P[i * 3 + 1] / z / (2 * TAN);
    }
    const bienLado = limpio || azar() > 0.12;
    return { derecha: bienLado ? der : !der, puntos: P, confianza: 0.9, img };
  };
  const manos = new Manos(); manos.activa = true; manos.fuente = 'camara';
  const q0 = new THREE.Quaternion(), p0 = new THREE.Vector3();
  const ctx = { cabezaP: p0, cabezaQ: q0, interactivos: [], altura: () => -10, sePuede: () => true };
  const DT = 1000 / 120, FIN = 9500, CAP = 1000 / 30, esperadas = dos ? 2 : 1;
  let proxCaptura = azar() * CAP, ocupado = false, resultados = [], perdida = [false, false], clarasAntes = 0, antes = null;
  const R = { cuadros: 0, sin: 0, dobles: 0, titila: 0, reaparece: 0, err: [], tiron: [], quieta: [], lat: [] };
  for (let T = 0; T < FIN; T += DT) {
    for (const r of resultados.filter((r) => r.llega <= T)) { manos.recibirCamara(r.lista, r.tc, r.llega); R.lat.push(r.llega - r.tc); ocupado = false; }
    resultados = resultados.filter((r) => r.llega > T);
    while (proxCaptura + L <= T) {
      const tc = proxCaptura; proxCaptura += CAP * (0.95 + 0.1 * azar());
      if (ocupado) continue;
      ocupado = true;
      const lista = [], dd = detectar(true, tc / 1000, perdida[1]); perdida[1] = !dd; if (dd) lista.push(dd);
      if (dos) { const di = detectar(false, tc / 1000, perdida[0]); perdida[0] = !di; if (di) lista.push(di); }
      resultados.push({ lista, tc, llega: T + 4 + 40 + 20 * azar() + (perdida[1] ? 15 : 0) });
    }
    const tVer = T + 25;
    manos.registrarCabeza(tVer, q0, p0, 0);
    manos.actualizar(DT / 1000, tVer, ctx);
    /* medir (sobre la derecha de verdad) */
    const tS = tVer / 1000, cv = centro(puntos(true, tS)), dib = manos.manos.filter((M) => M.alfa > 0.02), claras = manos.manos.filter((M) => M.alfa >= 0.5).length;
    R.cuadros++;
    if (claras < esperadas) R.sin++;
    if (dib.length > esperadas) R.dobles++;
    if (clarasAntes >= esperadas && claras < esperadas && T > 300) R.titila++;
    clarasAntes = claras;
    let mejor = null, md = 1e9, aM = 1, id = null;
    for (const M of dib) { const c = centro(M.p), d = Math.hypot(c[0] - cv[0], c[1] - cv[1], c[2] - cv[2]); if (d < md) { md = d; mejor = c; aM = M.alfa; id = M; } }
    if (mejor && antes && (antes.id !== id || antes.gen !== id.gen)) { antes = null; R.reaparece++; }
    if (mejor && T > 300) {
      if (aM >= 0.5) R.err.push(md * 1000);
      if (antes && antes.dv) {
        const dv = [0, 1, 2].map((k) => mejor[k] - antes.c[k]), dr = [0, 1, 2].map((k) => cv[k] - antes.v[k]);
        R.tiron.push(Math.hypot(...[0, 1, 2].map((k) => dv[k] - antes.dv[k] - (dr[k] - antes.dr[k]))) * 1000);
      }
      if (QUIETA.some(([a, b]) => tS > a + 0.6 && tS < b)) R.quieta.push(md * 1000);
      antes = { id, gen: id.gen, c: mejor, v: cv, dv: antes ? [0, 1, 2].map((k) => mejor[k] - antes.c[k]) : null, dr: antes ? [0, 1, 2].map((k) => cv[k] - antes.v[k]) : null };
    } else antes = null;
  }
  const pct = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * b.length))] : NaN; };
  const media = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const mq = media(R.quieta);
  return {
    lat: media(R.lat), sin: 100 * R.sin / R.cuadros, titila: R.titila / (FIN / 60000), dobles: 100 * R.dobles / R.cuadros,
    err: media(R.err), tironP99: pct(R.tiron, 0.99), tironMax: Math.max(0, ...R.tiron), quieta: Math.sqrt(media(R.quieta.map((x) => (x - mq) ** 2))),
  };
}
/* cada caso con tres semillas: el promedio (el peor para el tirón máximo) */
const caso = (op) => {
  const r = [1, 2, 3].map((semilla) => simular({ ...op, semilla })), m = (k) => r.reduce((a, x) => a + x[k], 0) / r.length;
  return { lat: m('lat'), sin: m('sin'), titila: m('titila'), dobles: m('dobles'), err: m('err'), tironP99: m('tironP99'), tironMax: Math.max(...r.map((x) => x.tironMax)), quieta: m('quieta') };
};
const f = (x, d = 1) => x.toFixed(d);
for (const dos of [false, true]) {
  for (const L of [30, 90, 150]) {
    const r = caso({ L, dos }), n = `${dos ? 'dos manos' : 'una mano'}, la foto llega a los ${f(r.lat, 0)} ms`;
    const datos = `${f(r.sin)} % sin mano · ${f(r.titila)} titileos/min · ${f(r.dobles)} % dobles · tirón p99 ${f(r.tironP99)} mm, máx ${f(r.tironMax)} · quieta ${f(r.quieta)} mm · error ${f(r.err, 0)} mm`;
    prueba(`${n}: no titila ni se duplica`, r.sin < 6 && r.titila < 15 && r.dobles === 0, datos);
    prueba(`${n}: no pega tirones y quieta no tiembla`, r.tironP99 < 20 && r.tironMax < 60 && r.quieta < (dos ? 9 : 6));
  }
}
/* el atraso, solo (sin errores de la red): lo que se ve atrás de la mano de verdad, yendo a 0,4 m/s de promedio */
{
  const r30 = caso({ L: 30, limpio: true }), r150 = caso({ L: 150, limpio: true });
  prueba('sin errores de la red, el atraso no pasa de lo que tarda la foto', r30.err < 70 && r150.err < 125 && r30.tironMax < 25, `foto a los ${f(r30.lat, 0)} ms: ${f(r30.err, 0)} mm · a los ${f(r150.lat, 0)} ms: ${f(r150.err, 0)} mm · tirón máx ${f(Math.max(r30.tironMax, r150.tironMax))} mm`);
}
/* una foto por cuadro (el juego lento, a 30): la mano quieta se queda quieta. (El resorte arrancaba
   con la velocidad de lo que se veía, que lo incluye a él: se pasaba de largo cuadro por medio y la
   mano "viajaba", sin tocar ni apretar nada) */
{
  const manos = new Manos(); manos.activa = true; manos.fuente = 'camara';
  const q0 = new THREE.Quaternion(), p0 = new THREE.Vector3(), ctx = { cabezaP: p0, cabezaQ: q0, interactivos: [], altura: () => -10, sePuede: () => true };
  const W = new Float32Array(63), img = new Float32Array(63);
  ABIERTA.forEach(([x, y, z], i) => { W[i * 3] = 0.1 + x; W[i * 3 + 1] = -0.15 + y; W[i * 3 + 2] = -0.35 + z + 0.06; });
  let viaja = 0, mov = 0, ant = null;
  for (let k = 0; k < 60; k++) {
    const T = 1000 + k * 33.3;
    manos.registrarCabeza(T, q0, p0, 0);
    manos.recibirCamara([{ derecha: true, puntos: W, confianza: 0.9, img }], T - 60, T);
    manos.actualizar(1 / 30, T + 10, ctx);
    const M = manos.manos[1];
    if (k > 5) { if (M.viaja) viaja++; if (ant) mov = Math.max(mov, Math.hypot(M.p[0] - ant[0], M.p[1] - ant[1], M.p[2] - ant[2])); }
    ant = [M.p[0], M.p[1], M.p[2]];
  }
  prueba('una foto por cuadro (el juego a 30): quieta se queda quieta', viaja === 0 && mov < 5e-4, `${viaja} cuadros "de viaje", se movió ${f(mov * 1000, 2)} mm`);
}
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);

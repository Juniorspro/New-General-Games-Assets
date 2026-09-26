// LAS MANOS POR LA CÁMARA DEL CELU, simuladas (sin navegador: manos.js solo, con el reloj de mentira).
// Lo que pasa en un celu de verdad, que en el contenedor no se ve:
// - la foto llega tarde: la cámara tarda 30-150 ms en darla y la red 40-80 ms en leerla (una a la vez:
//   si está ocupada, la foto se saltea); en total 90-210 ms;
// - la red a veces no ve la mano (más si va rápido y justo después de perderla), le erra a la
//   profundidad (±12 cm, una de cada 50) y dice que es la otra mano (una de cada 8);
// - se dibuja a 120 por segundo.
// Se mide: cuadros sin mano, cuántas veces titila (se apaga y se prende), manos dobles, el tirón de
// cada cuadro (la aceleración contra la de verdad: un salto o un escalón se ve acá), el temblor (y lo que se mueve de un cuadro al otro)
// quieta y el atraso. Con la versión anterior de manos.js (la de la vuelta 13) daba, con 150 ms de
// atraso: 13 % sin mano, 105 titileos por minuto, tirón p99 111 mm; con 210 ms, 79 % sin mano.
//     node pruebas/manos-celu.mjs
const lienzo = () => { const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: (o, k, v) => ((o[k] = v), true) }); return { width: 0, height: 0, getContext: () => ctx }; };
globalThis.document = { createElement: lienzo, documentElement: {} };
const { Manos } = await import('../js/manos.js');
const THREE = await import('three');
globalThis.window ??= {};
const { ManosCamara } = await import('../js/manos-camara.js');
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };

/* la mano derecha abierta (metros, desde la muñeca); la izquierda, el espejo */
const ABIERTA = [[0, 0, 0], [-0.025, 0.025, -0.01], [-0.045, 0.045, -0.015], [-0.06, 0.063, -0.02], [-0.07, 0.082, -0.025],
  [-0.022, 0.085, 0], [-0.025, 0.125, 0], [-0.027, 0.15, 0], [-0.028, 0.172, 0], [0, 0.088, 0], [0, 0.132, 0], [0, 0.16, 0], [0, 0.185, 0],
  [0.02, 0.083, 0], [0.021, 0.122, 0], [0.022, 0.148, 0], [0.023, 0.17, 0], [0.038, 0.074, 0], [0.041, 0.1, 0], [0.043, 0.118, 0], [0.045, 0.135, 0]];

/* red: lo que tarda MediaPipe por foto, medido en el contenedor (pruebas/manos-directo.mjs y la nota
   aeroplaza-17) y escalado a un celu (escala): buscar palmas 38 ms, los dedos de cada mano 36 ms. Busca
   palmas si sigue menos manos que las que busca (cupo), o en la primera foto después de cambiar el
   cupo. 'nueva': el cupo lo elige manos-camara.js (una mano a la vista, busca una); 'vieja': siempre
   dos (hasta la vuelta 16) */
function simular({ L = 90, semilla = 1, dos = false, limpio = false, redes = 2, suavidad = 'media', red = 'nueva', escala = 0.7, entra = 0 }) {
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
  const manos = new Manos(); manos.activa = true; manos.fuente = 'camara'; manos.suavidad = suavidad;
  const q0 = new THREE.Quaternion(), p0 = new THREE.Vector3();
  const ctx = { cabezaP: p0, cabezaQ: q0, interactivos: [], altura: () => -10, sePuede: () => true };
  const DT = 1000 / 120, FIN = 9500, CAP = 1000 / 30, esperadas = dos ? 2 : 1;
  let proxCaptura = azar() * CAP, resultados = [], perdida = [false, false], clarasAntes = 0, antes = null;
  /* las redes (con el cupo que les manda manos-camara.js) */
  const R_ = Array.from({ length: redes }, () => ({ libre: -1, cupo: 2, recien: false, siguiendo: 0 }));
  for (const r of R_) r.w = { postMessage: (m) => { if (m.tipo === 'cupo' && m.n !== r.cupo) { r.cupo = m.n; r.recien = true; } } };
  const mc = new ManosCamara(); mc.redes = R_; mc.activa = true; mc.cfg.siempreDos = red === 'vieja';
  const R = { n: 0, cuadros: 0, sin: 0, dobles: 0, titila: 0, reaparece: 0, err: [], tiron: [], quieta: [], tiembla: [], lat: [] };
  for (let T = 0; T < FIN; T += DT) {
    for (const r of resultados.filter((r) => r.llega <= T)) { manos.recibirCamara(r.lista, r.tc, r.llega, r.cupo); if (!r.primera) mc.medirRedes(r.red, r.ms, r.cupo, r.lista.length); mc.elegirCupos({ n: r.lista.length, cupo: r.cupo }, r.red, r.llega); R.lat.push(r.llega - r.tc); R.n++; }
    resultados = resultados.filter((r) => r.llega > T);
    while (proxCaptura + L <= T) {
      const tc = proxCaptura; proxCaptura += CAP * (0.95 + 0.1 * azar());
      /* (manos-camara.js: la primera red libre; la que busca la segunda mano, antes) */
      const rd = R_[mc.primero || 0]?.libre <= T ? R_[mc.primero || 0] : R_.find((x) => x.libre <= T);
      if (!rd) continue;
      let lista = [];
      const dd = detectar(true, tc / 1000, perdida[1]); perdida[1] = !dd; if (dd) lista.push(dd);
      /* (entra: la izquierda aparece recién a esa hora) */
      if (dos && tc / 1000 >= entra) { const di = detectar(false, tc / 1000, perdida[0]); perdida[0] = !di; if (di) lista.push(di); }
      /* con cupo 1 trae una sola (la que venía siguiendo) */
      if (rd.cupo === 1 && lista.length > 1) lista = [lista[rd.siguiendo % lista.length]];
      const palmas = rd.recien || lista.length < rd.cupo || (lista.length && !rd.antes);
      const ms = escala * ((palmas ? 38 : 0) + 36 * lista.length) * (0.9 + 0.2 * azar());
      resultados.push({ lista, tc, llega: T + 4 + ms, cupo: rd.cupo, red: rd, ms, primera: rd.recien });
      rd.recien = false; rd.antes = lista.length > 0; rd.libre = T + 4 + ms;
    }
    const tVer = T + 25;
    manos.registrarCabeza(tVer, q0, p0, 0);
    manos.actualizar(DT / 1000, tVer, ctx);
    /* medir (sobre la derecha de verdad) */
    const tS = tVer / 1000, cv = centro(puntos(true, tS)), dib = manos.manos.filter((M) => M.alfa > 0.02), claras = manos.manos.filter((M) => M.alfa >= 0.5).length;
    R.cuadros++;
    if (claras < esperadas && tVer >= entra * 1000) R.sin++;
    if (entra && claras >= 2 && tVer >= entra * 1000) R.vioIzq ??= tVer - entra * 1000;
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
      if (QUIETA.some(([a, b]) => tS > a + 0.6 && tS < b)) {
        R.quieta.push(md * 1000);
        /* (lo que se mueve de un cuadro al otro, quieta: el temblor que se ve) */
        if (antes && antes.id === id) R.tiembla.push(Math.hypot(mejor[0] - antes.c[0], mejor[1] - antes.c[1], mejor[2] - antes.c[2]) * 1000);
      }
      antes = { id, gen: id.gen, c: mejor, v: cv, dv: antes ? [0, 1, 2].map((k) => mejor[k] - antes.c[k]) : null, dr: antes ? [0, 1, 2].map((k) => cv[k] - antes.v[k]) : null };
    } else antes = null;
  }
  const pct = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * b.length))] : NaN; };
  const media = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const mq = media(R.quieta);
  return {
    porSeg: R.n / (FIN / 1000), lat: media(R.lat), sin: 100 * R.sin / R.cuadros, titila: R.titila / (FIN / 60000), dobles: 100 * R.dobles / R.cuadros,
    vioIzq: R.vioIzq ?? NaN, err: media(R.err), tironP99: pct(R.tiron, 0.99), tironMax: Math.max(0, ...R.tiron), quieta: Math.sqrt(media(R.quieta.map((x) => (x - mq) ** 2))), tiembla: Math.sqrt(media(R.tiembla.map((x) => x * x))),
  };
}
/* cada caso con tres semillas: el promedio (el peor para el tirón máximo) */
const caso = (op) => {
  const r = [1, 2, 3].map((semilla) => simular({ ...op, semilla })), m = (k) => r.reduce((a, x) => a + x[k], 0) / r.length;
  return { vioIzq: m('vioIzq'), porSeg: m('porSeg'), lat: m('lat'), sin: m('sin'), titila: m('titila'), dobles: m('dobles'), err: m('err'), tironP99: m('tironP99'), tironMax: Math.max(...r.map((x) => x.tironMax)), quieta: m('quieta'), tiembla: m('tiembla') };
};
const f = (x, d = 1) => x.toFixed(d);
for (const dos of [false, true]) {
  for (const L of [30, 90, 150]) {
    const r = caso({ L, dos }), n = `${dos ? 'dos manos' : 'una mano'}, la foto llega a los ${f(r.lat, 0)} ms`;
    const datos = `${f(r.porSeg)} fotos/s · ${f(r.sin)} % sin mano · ${f(r.titila)} titileos/min · ${f(r.dobles)} % dobles · tirón p99 ${f(r.tironP99)} mm, máx ${f(r.tironMax)} · quieta ${f(r.quieta)} mm · error ${f(r.err, 0)} mm`;
    prueba(`${n}: no titila ni se duplica`, r.sin < 6 && r.titila < 15 && r.dobles === 0, datos);
    prueba(`${n}: no pega tirones y quieta no tiembla`, r.tironP99 < 20 && r.tironMax < 60 && r.quieta < (dos ? 9 : 6));
  }
}
/* con una sola red (celus de menos de 6 núcleos): lo mismo, un poco peor */
{
  const r = caso({ L: 90, redes: 1 });
  prueba('con una sola red tampoco titila ni pega tirones', r.sin < 6 && r.titila < 15 && r.dobles === 0 && r.tironP99 < 20 && r.tironMax < 60 && r.quieta < 6, `${f(r.porSeg)} fotos/s · ${f(r.titila)} titileos/min · tirón p99 ${f(r.tironP99)} mm · quieta ${f(r.quieta)} mm · error ${f(r.err, 0)} mm`);
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
/* cuántas manos busca cada red (vuelta 17): con una a la vista, una. MediaPipe buscando dos busca
   palmas en cada foto por si aparece la otra; buscando una, solo sigue la que tiene */
{
  const v1 = caso({ L: 90, redes: 1, red: 'vieja' }), n1 = caso({ L: 90, redes: 1 }), v2 = caso({ L: 90, red: 'vieja' }), n2 = caso({ L: 90 });
  const vl = caso({ L: 90, limpio: true, red: 'vieja' }), nl = caso({ L: 90, limpio: true });
  prueba('con una mano, buscando una sola la foto llega antes y la mano va más pegada', n1.lat < v1.lat - 15 && n2.lat < v2.lat - 15 && n1.err < v1.err && nl.err < vl.err && n1.titila < 15,
    `una red: ${f(v1.lat, 0)} → ${f(n1.lat, 0)} ms, ${f(v1.porSeg)} → ${f(n1.porSeg)} fotos/s, error ${f(v1.err, 0)} → ${f(n1.err, 0)} mm · dos redes: ${f(v2.lat, 0)} → ${f(n2.lat, 0)} ms · sin errores de la red: ${f(vl.err, 0)} → ${f(nl.err, 0)} mm`);
  const e1 = caso({ L: 90, dos: true, entra: 3, redes: 1 }), e2 = caso({ L: 90, dos: true, entra: 3 });
  prueba('la segunda mano que entra aparece enseguida (la busca una red cada tanto)', e2.vioIzq < 900 && e1.vioIzq < 2400 && e2.titila < 15, `con dos redes a los ${f(e2.vioIzq, 0)} ms, con una a los ${f(e1.vioIzq, 0)} ms`);
}
/* los tres niveles del menú (✋ Manos): rápidas atrasa menos y tiembla más; suaves, al revés */
{
  const r = Object.fromEntries(['rapida', 'media', 'suave'].map((suavidad) => [suavidad, caso({ L: 90, suavidad })]));
  const l = Object.fromEntries(['rapida', 'media', 'suave'].map((suavidad) => [suavidad, caso({ L: 90, suavidad, limpio: true })]));
  prueba('rápidas atrasa menos y suaves tiembla menos (el medio, en el medio)', l.rapida.err <= l.media.err + 0.5 && l.media.err <= l.suave.err + 0.5 && r.suave.tiembla < r.media.tiembla && r.media.tiembla < r.rapida.tiembla && r.rapida.titila < 15 && r.rapida.tironP99 < 20,
    ['rapida', 'media', 'suave'].map((k) => `${k}: atraso ${f(l[k].err, 0)} mm, tiembla ${f(r[k].tiembla, 2)} mm por cuadro`).join(' · '));
}
/* el rayo con la cámara sale de los ojos: con la mano un poco abajo de la vista apunta al piso (y sale
   el arco para saltar); con el modelo del hombro, la mano tenía que ir muy abajo y "no bajaba" */
{
  const rayo = (grados) => {
    const manos = new Manos(); manos.activa = true; manos.fuente = 'camara';
    const q0 = new THREE.Quaternion(), p0 = new THREE.Vector3(), ctx = { cabezaP: p0, cabezaQ: q0, interactivos: [], altura: () => -1.6, sePuede: () => true };
    /* (el medio entre el nudillo del índice y la base del pulgar, a 35 cm y a tantos grados de la vista) */
    const y = -0.35 * Math.tan(THREE.MathUtils.degToRad(grados)) - 0.065, W = new Float32Array(63), img = new Float32Array(63);
    ABIERTA.forEach(([x, yy, z], i) => { W[i * 3] = 0.084 + x; W[i * 3 + 1] = y + yy; W[i * 3 + 2] = -0.35 + z + 0.06; });
    for (let k = 0; k < 45; k++) {
      const T = 1000 + k * 33.3;
      manos.registrarCabeza(T, q0, p0, 0);
      manos.recibirCamara([{ derecha: true, puntos: W, confianza: 0.9, img }], T - 60, T);
      manos.actualizar(1 / 30, T + 10, ctx);
    }
    return { y: manos.manos[1].rayoD.y, arco: !!manos.salto?.valido };
  };
  const abajo = rayo(20), poco = rayo(8), arriba = rayo(-10);
  prueba('con la cámara el rayo baja al piso con la mano apenas abajo de la vista', abajo.y < -0.6 && abajo.arco && poco.y < -0.2 && arriba.y > 0.3 && !arriba.arco,
    `20° abajo: rayo ${f(abajo.y, 2)} ${abajo.arco ? 'con arco' : 'SIN arco'} · 8° abajo: ${f(poco.y, 2)} · 10° arriba: ${f(arriba.y, 2)}`);
}
/* las dos redes: si con la segunda la primera se pone más lenta (se pelean por los núcleos) o la
   segunda es mucho más lenta, se apaga la segunda; si no, quedan las dos */
{
  globalThis.window ??= {};
  const { ManosCamara } = await import('../js/manos-camara.js');
  const probar = (sola, conA, conB) => {
    const mc = new ManosCamara(), a = {}, b = {};
    mc.redes = [a]; for (let i = 0; i < 20; i++) mc.medirRedes(a, sola);
    mc.redes = [a, b]; for (let i = 0; i < 40; i++) { mc.medirRedes(a, conA); mc.medirRedes(b, conB); }
    return !b.apagada;
  };
  const bien2 = probar(50, 55, 58), pelean = probar(50, 80, 80), lenta = probar(50, 52, 95);
  prueba('la segunda red se apaga sola si no conviene', bien2 && !pelean && !lenta, `las dos parejas: ${bien2 ? 'quedan dos' : 'se apagó'} · se pelean: ${pelean ? 'quedan dos' : 'queda una'} · la segunda lenta: ${lenta ? 'quedan dos' : 'queda una'}`);
}
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);

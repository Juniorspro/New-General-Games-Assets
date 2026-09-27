// EL OBJETO EN LA MANO COMO CONTROL (vuelta 40), sin navegador: manos inventadas (la forma de manos-lento, con cada dedo
// doblado en sus tres nudillos) que llegan como del visor (ya en el mundo) a js/manos.js:
// - abierta, puño apretado y garra: no es un control; agarrando un cilindro (una linterna, un palo): sí, a los ~0,35 s;
// - el eje del control es el del objeto (del lado del pulgar), el rayo sale de su punta y va a lo largo; girando la
//   mano, lo sigue;
// - agarrado como pistola (el índice afuera): apretar el índice es el gatillo (el pellizco del juego) y soltarlo lo suelta;
//   como linterna, bajar el pulgar hacia el índice;
// - al soltar el objeto (abrir la mano) deja de ser control; apagado en el menú de la palma, no se busca;
// - el control dibujado aparece en la mano y se va.
//     node pruebas/mando.mjs
const lienzo = () => { const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: (o, k, v) => ((o[k] = v), true) }); return { width: 0, height: 0, getContext: () => ctx }; };
globalThis.document = { createElement: lienzo, documentElement: {} };
const { Manos, medirAgarre, MANDO } = await import('../js/manos.js');
const THREE = await import('three');

let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };

/* la mano abierta (de herramientas/manos-lento.mjs): x al costado (el pulgar en −x), y hacia los dedos, z hacia la palma */
const ABIERTA = [[0, 0, 0], [-0.025, 0.025, -0.01], [-0.045, 0.045, -0.015], [-0.06, 0.063, -0.02], [-0.07, 0.082, -0.025],
  [-0.022, 0.085, 0], [-0.025, 0.125, 0], [-0.027, 0.15, 0], [-0.028, 0.172, 0], [0, 0.088, 0], [0, 0.132, 0], [0, 0.16, 0], [0, 0.185, 0],
  [0.02, 0.083, 0], [0.021, 0.122, 0], [0.022, 0.148, 0], [0.023, 0.17, 0], [0.038, 0.074, 0], [0.041, 0.1, 0], [0.043, 0.118, 0], [0.045, 0.135, 0]];
const DEDOS = [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
const largo = (a, b) => Math.hypot(...[0, 1, 2].map((c) => ABIERTA[a][c] - ABIERTA[b][c]));
/* cada dedo con sus tres nudillos doblados (grados) hacia la palma; pulgar: la punta en otro lugar (o la de siempre) */
function mano(angulos, pulgar = null) {
  const P = ABIERTA.map((p) => p.slice());
  DEDOS.forEach((d, k) => {
    const [a1, a2, a3] = angulos[k].map((x) => x * Math.PI / 180), cum = [a1, a1 + a2, a1 + a2 + a3];
    for (let j = 1; j < 4; j++) { const L = largo(d[j - 1], d[j]), p = P[d[j - 1]]; P[d[j]] = [p[0] + (ABIERTA[d[j]][0] - ABIERTA[d[j - 1]][0]), p[1] + L * Math.cos(cum[j - 1]), p[2] + L * Math.sin(cum[j - 1])]; }
  });
  if (pulgar) { const b = P[1]; for (let j = 2; j <= 4; j++) { const u = (j - 1) / 3; P[j] = [b[0] + (pulgar[0] - b[0]) * u, b[1] + (pulgar[1] - b[1]) * u, b[2] + (pulgar[2] - b[2]) * u]; } }
  return P;
}
const R = (n) => [n, n, n, n];
const POSES = {
  abierta: mano(R([0, 5, 5])), puño: mano(R([85, 105, 75])), garra: mano(R([20, 60, 30])), agarre: mano(R([50, 85, 45])),
  pistola: mano([[15, 25, 15], [50, 85, 45], [50, 85, 45], [50, 85, 45]]), gatillo: mano([[40, 80, 45], [50, 85, 45], [50, 85, 45], [50, 85, 45]]),
  pulgarAbajo: mano(R([50, 85, 45]), [-0.03, 0.106, 0.036]),
};
/* al mundo: girada (euler, rad) y corrida delante de la cabeza */
function alMundo(P, eu = [0, 0, 0]) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...eu, 'YXZ')), T = new THREE.Vector3(0.12, 1.25, -0.35), W = new Float32Array(63), v = new THREE.Vector3();
  P.forEach((p, i) => { v.set(...p).applyQuaternion(q).add(T); W[i * 3] = v.x; W[i * 3 + 1] = v.y; W[i * 3 + 2] = v.z; });
  return { W, q };
}
const ctx = { cabezaP: new THREE.Vector3(0, 1.6, 0), cabezaQ: new THREE.Quaternion(), interactivos: [], altura: () => -10, sePuede: () => true };
/* una corrida: una lista de [pose, segundos, euler] a 60 por segundo; devuelve lo de cada cuadro */
function correr(tramos, { conMando = true } = {}) {
  const M0 = new Manos(); M0.activa = true; M0.fuente = 'xr'; M0.conMando = conMando;
  let t = 0; const cuadros = [], eventos = [];
  for (const [pose, seg, eu] of tramos) {
    const { W, q } = alMundo(POSES[pose], eu);
    for (let i = 0; i < Math.round(seg * 60); i++) {
      t += 1 / 60; M0.recibirMundo(true, W, t);
      const ev = M0.actualizar(1 / 60, t * 1000, ctx); eventos.push(...ev);
      const M = M0.manos[1], S = M.mando;
      cuadros.push({ pose, t, q, activo: !!S?.activo, gat: !!S?.gat, pell: M.pellizca, eje: S?.eje.clone(), punta: S?.punta.clone(), o: M.rayoO.clone(), d: M.rayoD.clone(), dibujo: M0.mandos[1].visible, pos: M0.mandos[1].position.clone(), centro: S?.centro.clone() });
    }
  }
  return { cuadros, eventos, M0 };
}
const grados = (a, b) => a.angleTo(b) * 180 / Math.PI;
/* el eje esperado: el del cilindro (x de la mano) del lado del pulgar (−x), girado con la mano */
const ejeDe = (q) => new THREE.Vector3(-1, 0, 0).applyQuaternion(q);

/* 1) la cuenta sola */
const A = (p) => medirAgarre(Float32Array.from(p.flat()));
const ca = A(POSES.agarre), cp = A(POSES.puño), cab = A(POSES.abierta), cg = A(POSES.garra);
prueba('la cuenta: agarrando un cilindro, los cuatro dedos lo rodean; con el puño, la mano abierta o en garra, ninguno', ca.n === 4 && cp.n === 0 && cab.n === 0 && cg.n === 0, `agarre ${ca.n} · puño ${cp.n} · abierta ${cab.n} · garra ${cg.n}`);
prueba('la cuenta: el eje del objeto, del lado del pulgar', grados(new THREE.Vector3(...ca.eje), new THREE.Vector3(-1, 0, 0)) < 15, `${grados(new THREE.Vector3(...ca.eje), new THREE.Vector3(-1, 0, 0)).toFixed(1)}° del cilindro`);

/* 2) no es control: abierta, puño, garra */
for (const p of ['abierta', 'puño', 'garra']) {
  const r = correr([[p, 1.2]]);
  prueba(`con la mano ${p === 'puño' ? 'en puño apretado' : p === 'garra' ? 'en garra' : 'abierta'} no aparece el control`, r.cuadros.every((c) => !c.activo && !c.dibujo), '');
}

/* 3) agarrando: aparece a los ~0,35 s, con su eje, su rayo y su dibujo */
const r = correr([['abierta', 0.3], ['agarre', 1.2]]);
const c = r.cuadros, iA = c.findIndex((x) => x.activo), tA = iA >= 0 ? c[iA].t - 0.3 : NaN, ult = c[c.length - 1];
prueba('agarrando un objeto aparece el control (a los ~0,35 s, no enseguida) y avisa una vez', iA > 0 && tA > 0.25 && tA < 0.5 && r.eventos.filter((e) => e.tipo === 'mando').length === 1, `a los ${(tA * 1000).toFixed(0)} ms`);
prueba('el eje del control es el del objeto (del lado del pulgar)', grados(ult.eje, ejeDe(ult.q)) < 15, `${grados(ult.eje, ejeDe(ult.q)).toFixed(1)}°`);
prueba('el rayo sale de la punta del control y va a lo largo del objeto', ult.o.distanceTo(ult.punta) < 0.005 && grados(ult.d, ult.eje) < 3, `${(ult.o.distanceTo(ult.punta) * 1000).toFixed(1)} mm · ${grados(ult.d, ult.eje).toFixed(1)}°`);
prueba('el control se dibuja en la mano (en el centro del agarre)', ult.dibujo && ult.pos.distanceTo(ult.centro) < 0.002, '');
prueba('agarrar no es apretar (sin gatillo, sin pellizco)', c.every((x) => !x.pell), '');

/* 4) girando la mano, el control la sigue */
let peor = 0;
for (const eu of [[0.6, 0, 0.3], [-0.4, 1.1, 0], [0.2, -0.9, 1.2]]) { const rr = correr([['agarre', 0.8, eu]]), u = rr.cuadros[rr.cuadros.length - 1]; peor = Math.max(peor, u.activo ? grados(u.eje, ejeDe(u.q)) : 180); }
prueba('con la mano girada para cualquier lado, el eje sigue al objeto', peor < 15, `lo peor ${peor.toFixed(1)}°`);

/* 5) el gatillo: como pistola (el índice afuera), apretar el índice */
const rp = correr([['pistola', 0.8], ['gatillo', 0.3], ['pistola', 0.3], ['gatillo', 1.5]]);
const fase = (i0, n) => rp.cuadros.slice(i0, i0 + n);
const f1 = fase(0, 48), f2 = fase(48, 18), f3 = fase(66, 18), f4 = fase(84, 90);
prueba('agarrado como pistola (el índice afuera) también es un control, sin apretar', f1[f1.length - 1].activo && !f1.some((x) => x.pell), '');
prueba('apretar el índice es el gatillo (el pellizco del juego) y soltarlo lo suelta', f2.slice(3).every((x) => x.pell) && f3.slice(3).every((x) => !x.pell), `${f2.findIndex((x) => x.pell)} cuadros hasta apretar`);
prueba('sostener el gatillo lo mantiene apretado (para arrastrar)', f4.slice(3).every((x) => x.pell && x.activo), '1,5 s');

/* 6) como linterna: bajar el pulgar hacia el índice */
const rl = correr([['agarre', 0.8], ['pulgarAbajo', 0.3], ['agarre', 0.3]]);
prueba('como linterna, bajar el pulgar hacia el índice es el gatillo', rl.cuadros.slice(51, 66).every((x) => x.pell) && rl.cuadros.slice(69).every((x) => !x.pell), '');

/* 7) soltar el objeto; y apagado */
const rs = correr([['agarre', 0.8], ['abierta', 0.8]]);
const iS = rs.cuadros.findIndex((x, i) => i > 48 && !x.activo), iD = rs.cuadros.findIndex((x, i) => i > 48 && !x.dibujo);
prueba('al soltar el objeto (abrir la mano) deja de ser control y el dibujo se va', iS > 48 && (iS - 48) / 60 < 0.45 && iD > 0 && rs.cuadros[rs.cuadros.length - 1].dibujo === false, `${((iS - 48) / 60 * 1000).toFixed(0)} ms`);
const rn = correr([['agarre', 1.2]], { conMando: false });
prueba('apagado en el menú, agarrar no es un control', rn.cuadros.every((x) => !x.activo && !x.dibujo), '');
/* el botón del menú */
const Mm = new Manos(); const evm = []; Mm.apretar(7, evm);
prueba('el botón "🎮 Control" del menú de la palma lo apaga (y avisa para guardarlo)', !Mm.conMando && !Mm.menu.mando && evm.some((e) => e.tipo === 'menu' && e.accion === 'mando' && e.mando === false), JSON.stringify(evm[0]));
console.log(`(MANDO: ${JSON.stringify(MANDO)})`);
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);

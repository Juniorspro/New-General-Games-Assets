/* El CharacterController de Unity a mano: una cápsula contra los triángulos de los colliders fijos
   (en una grilla), el terreno y los colliders que se mueven o se prenden y apagan (puertas, el placard,
   el que bloquea la escalera), que se prueban en su propio espacio. Más los disparadores (isTrigger):
   avisa cuando el jugador entra. */
import * as THREE from 'three';

const CEL = 2;
export function crearFisica(S, R) {
  const v = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3();
  /* los triángulos de un collider, en el espacio del nodo */
  function trisLocal(c) {
    const out = [];
    const push = (a, b, cc) => out.push(a.x, a.y, a.z, b.x, b.y, b.z, cc.x, cc.y, cc.z);
    const caja = (cen, h) => {
      const P = [];
      for (let k = 0; k < 8; k++) P.push(new THREE.Vector3(cen[0] + (k & 1 ? h[0] : -h[0]), cen[1] + (k & 2 ? h[1] : -h[1]), cen[2] + (k & 4 ? h[2] : -h[2])));
      for (const [a, b, cc, d] of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) { push(P[a], P[b], P[cc]); push(P[a], P[cc], P[d]); }
    };
    if (c.tipo === 'box') caja(c.c_, c.tam.map((x) => x / 2));
    else if (c.tipo === 'sphere') caja(c.c_, [c.radio, c.radio, c.radio]);
    else if (c.tipo === 'capsule') { const h = [c.radio, c.radio, c.radio]; h[c.dir] = Math.max(c.radio, c.alto / 2); caja(c.c_, h); }
    else if (c.tipo === 'mesh' && c.malla) {
      const g = R.geometria(c.malla);
      if (!g) return out;
      const P = g.attributes.position, I = g.index.array;
      for (let k = 0; k < I.length; k += 3) { A.fromBufferAttribute(P, I[k]); B.fromBufferAttribute(P, I[k + 1]); Cc.fromBufferAttribute(P, I[k + 2]); push(A, B, Cc); }
    }
    return out;
  }
  /* fijos: a la grilla; los que se mueven o se apagan: aparte */
  const fijos = [], topes = [], moviles = [];
  for (const col of S.colisiones) {
    const t = trisLocal(col.c);
    if (!t.length) continue;
    if (S.tocado[col.i]) {
      const caja = new THREE.Box3();
      for (let k = 0; k < t.length; k += 3) caja.expandByPoint(v.set(t[k], t[k + 1], t[k + 2]));
      moviles.push({ ...col, T: new Float32Array(t), caja });
      continue;
    }
    if (!S.activo[col.i] || !col.on) continue;
    const mw = S.O[col.i].matrixWorld, desde = fijos.length;
    for (let k = 0; k < t.length; k += 3) { v.set(t[k], t[k + 1], t[k + 2]).applyMatrix4(mw); fijos.push(v.x, v.y, v.z); }
    let m = -Infinity; for (let k = desde + 1; k < fijos.length; k += 3) m = Math.max(m, fijos[k]);
    for (let k = desde; k < fijos.length; k += 9) topes.push(m);
  }
  const T = new Float32Array(fijos), TOPE = new Float32Array(topes);
  const grilla = new Map(), clave = (x, z) => x * 73856093 ^ z * 19349663;
  for (let t = 0; t < T.length / 9; t++) {
    const o = t * 9;
    const x0 = Math.floor(Math.min(T[o], T[o + 3], T[o + 6]) / CEL), x1 = Math.floor(Math.max(T[o], T[o + 3], T[o + 6]) / CEL);
    const z0 = Math.floor(Math.min(T[o + 2], T[o + 5], T[o + 8]) / CEL), z1 = Math.floor(Math.max(T[o + 2], T[o + 5], T[o + 8]) / CEL);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 20000) continue;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const k = clave(x, z); let l = grilla.get(k); if (!l) grilla.set(k, (l = [])); l.push(t); }
  }

  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3(), ap = new THREE.Vector3(), bp = new THREE.Vector3(), cp = new THREE.Vector3(), bc = new THREE.Vector3();
  function cercano(TT, o, p, out) {
    a.fromArray(TT, o); b.fromArray(TT, o + 3); c.fromArray(TT, o + 6);
    ab.subVectors(b, a); ac.subVectors(c, a); ap.subVectors(p, a);
    const d1 = ab.dot(ap), d2 = ac.dot(ap);
    if (d1 <= 0 && d2 <= 0) return out.copy(a);
    bp.subVectors(p, b); const d3 = ab.dot(bp), d4 = ac.dot(bp);
    if (d3 >= 0 && d4 <= d3) return out.copy(b);
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) return out.copy(a).addScaledVector(ab, d1 / (d1 - d3));
    cp.subVectors(p, c); const d5 = ab.dot(cp), d6 = ac.dot(cp);
    if (d6 >= 0 && d5 <= d6) return out.copy(c);
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) return out.copy(a).addScaledVector(ac, d2 / (d2 - d6));
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return out.copy(b).addScaledVector(bc.subVectors(c, b), (d4 - d3) / ((d4 - d3) + (d5 - d6)));
    const suma = va + vb + vc;
    if (!(Math.abs(suma) > 1e-14)) return out.copy(a); // (triángulo sin área)
    const den = 1 / suma;
    return out.copy(a).addScaledVector(ab, vb * den).addScaledVector(ac, vc * den);
  }

  const PEND = Math.cos(THREE.MathUtils.degToRad(50));
  const centro = new THREE.Vector3(), q = new THREE.Vector3(), d = new THREE.Vector3(), inv = new THREE.Matrix4(), loc = new THREE.Vector3(), escala = new THREE.Vector3();
  const vistos = new Set();
  let CAP = { radio: 0.3, alto: 1.8, centro: [0, 0, 0], paso: 0.4 };
  const alturas = () => { const r = CAP.radio, base = CAP.centro[1] - CAP.alto / 2 + r, techo = CAP.centro[1] + CAP.alto / 2 - r; return [base, (base + techo) / 2, techo]; };
  let HS = alturas();
  const pies = () => CAP.centro[1] - CAP.alto / 2;

  function empujar(TT, o, p, est, tope, h, esBase) {
    centro.set(p.x, p.y + h, p.z);
    cercano(TT, o, centro, q);
    d.subVectors(centro, q);
    const dl = d.length(), R0 = CAP.radio;
    if (dl >= R0 + 0.03 || dl < 1e-6) return false;
    d.divideScalar(dl);
    if (dl >= R0) { if (esBase && d.y > PEND) { est.suelo = true; if (est.vy < 0) est.vy = 0; } return false; }
    const em = R0 - dl;
    if (d.y > PEND) { p.y += em / d.y; est.suelo = true; if (est.vy < 0) est.vy = 0; }
    else if (esBase && tope - (p.y + pies()) < CAP.paso && tope > p.y + pies() && d.y > -0.2) { p.y = tope - pies() + 0.01; est.suelo = true; }
    else { p.x += d.x * em; p.z += d.z * em; if (d.y < -0.5 && est.vy > 0) est.vy = 0; }
    return true;
  }
  function resolver(p, est) {
    for (let it = 0; it < 3; it++) {
      let movio = false;
      vistos.clear();
      const R0 = CAP.radio;
      const x0 = Math.floor((p.x - R0) / CEL), x1 = Math.floor((p.x + R0) / CEL), z0 = Math.floor((p.z - R0) / CEL), z1 = Math.floor((p.z + R0) / CEL);
      const y0 = p.y + pies(), y1 = p.y + pies() + CAP.alto;
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        const l = grilla.get(clave(x, z));
        if (!l) continue;
        for (const t of l) {
          if (vistos.has(t)) continue;
          vistos.add(t);
          const o = t * 9;
          if (Math.max(T[o + 1], T[o + 4], T[o + 7]) < y0 || Math.min(T[o + 1], T[o + 4], T[o + 7]) > y1) continue;
          for (let k = 0; k < 3; k++) movio = empujar(T, o, p, est, TOPE[t], HS[k], k === 0) || movio;
        }
      }
      // los que se mueven: el jugador pasa al espacio del nodo
      for (const m of moviles) {
        if (!S.activo[m.i] || !m.on) continue;
        const mw = S.O[m.i].matrixWorld;
        if (Math.abs(mw.determinant()) < 1e-9) continue;
        escala.setFromMatrixScale(mw);
        inv.copy(mw).invert();
        const pl = loc.copy(p).applyMatrix4(inv);
        // (escala no uniforme: se aproxima con la media)
        const s = (Math.abs(escala.x) + Math.abs(escala.y) + Math.abs(escala.z)) / 3 || 1;
        const r0 = CAP.radio; CAP.radio = r0 / s;
        const hs0 = HS; HS = HS.map((h) => h / s);
        const margen = CAP.radio + CAP.alto / s;
        if (pl.x < m.caja.min.x - margen || pl.x > m.caja.max.x + margen || pl.y < m.caja.min.y - margen || pl.y > m.caja.max.y + margen || pl.z < m.caja.min.z - margen || pl.z > m.caja.max.z + margen) { CAP.radio = r0; HS = hs0; continue; }
        const pr = pl.clone();
        for (let o = 0; o < m.T.length; o += 9) for (let k = 0; k < 3; k++) movio = empujar(m.T, o, pr, est, -Infinity, HS[k], k === 0) || movio;
        CAP.radio = r0; HS = hs0;
        if (!pr.equals(pl)) { pr.applyMatrix4(mw); if (Number.isFinite(pr.x + pr.y + pr.z)) p.copy(pr); }
      }
      if (!movio) break;
    }
  }
  const nT = new THREE.Vector3();
  function mover(p, desp, est) {
    est.suelo = false;
    const pasos = Math.max(1, Math.ceil(Math.hypot(desp.x, desp.y, desp.z) / (CAP.radio * 0.8)));
    const altura = S.terreno?.alturaEn;
    for (let s = 0; s < pasos; s++) {
      p.x += desp.x / pasos; p.z += desp.z / pasos; p.y += desp.y / pasos;
      if (altura) {
        const ht = altura(p.x, p.z) - pies();
        if (p.y <= ht + 0.01) { p.y = ht; est.suelo = true; if (est.vy < 0) est.vy = 0; }
      }
      const px = p.x, py = p.y, pz = p.z;
      resolver(p, est);
      if (!Number.isFinite(p.x + p.y + p.z)) p.set(px, py, pz);
    }
    if (!est.suelo && est.vy <= 0 && altura) {
      const ht = altura(p.x, p.z) - pies();
      if (p.y - ht < 0.15 && p.y - ht > 0) { p.y = ht; est.suelo = true; est.vy = 0; }
    }
    void nT;
    return est;
  }

  /* disparadores: ¿el punto (o una esfera) está adentro? */
  function adentro(dsp, punto, radio = 0) {
    const o = S.O[dsp.i]; const c = dsp.c;
    inv.copy(o.matrixWorld).invert();
    loc.copy(punto).applyMatrix4(inv);
    o.matrixWorld.decompose(A, new THREE.Quaternion(), escala);
    const s = Math.max(1e-6, (Math.abs(escala.x) + Math.abs(escala.y) + Math.abs(escala.z)) / 3), r = radio / s;
    if (c.tipo === 'box') { const h = c.tam; return Math.abs(loc.x - c.c_[0]) <= h[0] / 2 + r && Math.abs(loc.y - c.c_[1]) <= h[1] / 2 + r && Math.abs(loc.z - c.c_[2]) <= h[2] / 2 + r; }
    if (c.tipo === 'sphere') return loc.distanceTo(B.fromArray(c.c_)) <= c.radio + r;
    if (c.tipo === 'capsule') { const ax = ['x', 'y', 'z'][c.dir], cc = B.fromArray(c.c_); const h = Math.max(0, c.alto / 2 - c.radio); const dd = loc.clone().sub(cc); dd[ax] = Math.max(0, Math.abs(dd[ax]) - h); return dd.length() <= c.radio + r; }
    if (c.tipo === 'mesh' && c.malla) { const m = R.C.mallas[c.malla]; const k = m?.caja; if (!k) return false; return loc.x >= k[0] - r && loc.x <= k[3] + r && loc.y >= k[1] - r && loc.y <= k[4] + r && loc.z >= k[2] - r && loc.z <= k[5] + r; }
    return false;
  }
  return {
    mover, adentro, configurar: (cap) => { CAP = { ...CAP, ...cap }; HS = alturas(); }, get cap() { return CAP; },
    triangulos: T.length / 9, moviles: moviles.length,
  };
}

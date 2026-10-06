/* El CharacterController de Unity a mano: una cápsula (radio 0,5, alto 2) contra los triángulos
   de los colliders fijos de la escena (en una grilla de 4 m), el terreno (alturas) y cajas que se
   mueven (el colectivo). Sube escalones chicos, no trepa pendientes de más de 45°. */
import * as THREE from 'three';

const CEL = 4;
export function crearFisica(S) {
  const tris = [], topes = [];
  const v = new THREE.Vector3();
  const empujar = (a, b, c) => tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  // la altura de arriba del objeto entero, para cada triángulo: sólo se sube lo que es bajo (un cordón, no un poste)
  const tope = (desde) => { let m = -Infinity; for (let k = desde + 1; k < tris.length; k += 3) m = Math.max(m, tris[k]); for (let k = desde; k < tris.length; k += 9) topes.push(m); };
  S.N.forEach((n, i) => {
    if (!S.activo[i] || S.dinamico[i] || !n.col) return;
    const mw = S.O[i].matrixWorld;
    for (const col of n.col) {
      if (col.trig || !col.on) continue;
      const desde = tris.length;
      if (col.tipo === 'caja') {
        const h = col.tam.map((x) => x / 2), c = col.c, P = [];
        for (let k = 0; k < 8; k++) P.push(new THREE.Vector3(c[0] + (k & 1 ? h[0] : -h[0]), c[1] + (k & 2 ? h[1] : -h[1]), c[2] + (k & 4 ? h[2] : -h[2])).applyMatrix4(mw));
        for (const [a, b, cc, d] of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) { empujar(P[a], P[b], P[cc]); empujar(P[a], P[cc], P[d]); }
        tope(desde);
        continue;
      }
      if (!col.malla) continue;
      const g = S.geometria(col.malla), m = S.E.mallas[col.malla], caja = m.caja;
      const tam = [caja[3] - caja[0], caja[4] - caja[1], caja[5] - caja[2]], mx = Math.max(...tam);
      const fino = tam.findIndex((t) => t < mx * 0.004);
      if (fino >= 0 && m.nv > 8) { // un plano (las calles): su rectángulo
        const P = [];
        for (let k = 0; k < 4; k++) {
          const q = [0, 0, 0], ejes = [0, 1, 2].filter((e) => e !== fino);
          q[fino] = (caja[fino] + caja[fino + 3]) / 2;
          q[ejes[0]] = k & 1 ? caja[ejes[0] + 3] : caja[ejes[0]];
          q[ejes[1]] = k & 2 ? caja[ejes[1] + 3] : caja[ejes[1]];
          P.push(new THREE.Vector3(...q).applyMatrix4(mw));
        }
        empujar(P[0], P[1], P[3]); empujar(P[0], P[3], P[2]);
        tope(desde);
        continue;
      }
      const pos = g.attributes.position, I = g.index.array;
      const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
      for (let k = 0; k < I.length; k += 3) {
        A.fromBufferAttribute(pos, I[k]).applyMatrix4(mw); B.fromBufferAttribute(pos, I[k + 1]).applyMatrix4(mw); C.fromBufferAttribute(pos, I[k + 2]).applyMatrix4(mw);
        empujar(A, B, C);
      }
      tope(desde);
    }
  });
  const T = new Float32Array(tris), TOPE = new Float32Array(topes);
  const grilla = new Map();
  const clave = (x, z) => x * 73856093 ^ z * 19349663;
  for (let t = 0; t < T.length / 9; t++) {
    const o = t * 9;
    const x0 = Math.floor(Math.min(T[o], T[o + 3], T[o + 6]) / CEL), x1 = Math.floor(Math.max(T[o], T[o + 3], T[o + 6]) / CEL);
    const z0 = Math.floor(Math.min(T[o + 2], T[o + 5], T[o + 8]) / CEL), z1 = Math.floor(Math.max(T[o + 2], T[o + 5], T[o + 8]) / CEL);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 4096) continue;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const k = clave(x, z); let l = grilla.get(k); if (!l) grilla.set(k, (l = [])); l.push(t);
    }
  }

  /* el punto del triángulo más cercano a p (Ericson, Real-Time Collision Detection) */
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3(), ap = new THREE.Vector3(), bp = new THREE.Vector3(), cp = new THREE.Vector3();
  function cercano(o, p, out) {
    a.fromArray(T, o); b.fromArray(T, o + 3); c.fromArray(T, o + 6);
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
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return out.copy(b).addScaledVector(c.clone().sub(b), (d4 - d3) / ((d4 - d3) + (d5 - d6)));
    const den = 1 / (va + vb + vc);
    return out.copy(a).addScaledVector(ab, vb * den).addScaledVector(ac, vc * den);
  }

  const R = 0.5, ALTURAS = [0.51, 1.01, 1.51], PASO_MAX = 0.56, PEND = Math.cos(THREE.MathUtils.degToRad(45));
  const obstaculos = []; // { obj, min, max } en coordenadas locales del objeto
  const centro = new THREE.Vector3(), q = new THREE.Vector3(), d = new THREE.Vector3(), loc = new THREE.Vector3(), inv = new THREE.Matrix4(), nT = new THREE.Vector3();
  const vistos = new Set();

  function resolver(p, estado) {
    for (let it = 0; it < 3; it++) {
      let movio = false;
      vistos.clear();
      const x0 = Math.floor((p.x - R) / CEL), x1 = Math.floor((p.x + R) / CEL), z0 = Math.floor((p.z - R) / CEL), z1 = Math.floor((p.z + R) / CEL);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        const l = grilla.get(clave(x, z));
        if (!l) continue;
        for (const t of l) {
          if (vistos.has(t)) continue;
          vistos.add(t);
          const o = t * 9;
          const tope = Math.max(T[o + 1], T[o + 4], T[o + 7]);
          if (tope < p.y || Math.min(T[o + 1], T[o + 4], T[o + 7]) > p.y + 2.1) continue;
          for (const h of ALTURAS) {
            centro.set(p.x, p.y + h, p.z);
            cercano(o, centro, q);
            d.subVectors(centro, q);
            const dl = d.length();
            if (dl >= R + 0.04 || dl < 1e-6) continue;
            d.divideScalar(dl);
            if (dl >= R) { if (h === ALTURAS[0] && d.y > PEND) { estado.suelo = true; if (estado.vy < 0) estado.vy = 0; } continue; } // apoyado (como el skin de Unity)
            const em = R - dl;
            if (d.y > PEND) { p.y += em / d.y; estado.suelo = true; if (estado.vy < 0) estado.vy = 0; }
            else if (h === ALTURAS[0] && TOPE[t] - p.y < PASO_MAX && TOPE[t] > p.y && d.y > -0.2) { p.y = TOPE[t] + 0.01; estado.suelo = true; }
            else { p.x += d.x * em; p.z += d.z * em; if (d.y < -0.5 && estado.vy > 0) estado.vy = 0; }
            movio = true;
          }
        }
      }
      for (const ob of obstaculos) {
        inv.copy(ob.obj.matrixWorld).invert();
        for (const h of ALTURAS) {
          loc.set(p.x, p.y + h, p.z).applyMatrix4(inv);
          q.copy(loc).clamp(ob.min, ob.max);
          if (q.equals(loc)) { // adentro: afuera por el costado más cercano
            const dx0 = loc.x - ob.min.x, dx1 = ob.max.x - loc.x, dz0 = loc.z - ob.min.z, dz1 = ob.max.z - loc.z, m = Math.min(dx0, dx1, dz0, dz1);
            if (m === dx0) q.x = ob.min.x - R; else if (m === dx1) q.x = ob.max.x + R; else if (m === dz0) q.z = ob.min.z - R; else q.z = ob.max.z + R;
            q.applyMatrix4(ob.obj.matrixWorld); loc.set(p.x, p.y + h, p.z);
            p.x += q.x - loc.x; p.z += q.z - loc.z; movio = true; continue;
          }
          q.applyMatrix4(ob.obj.matrixWorld); centro.set(p.x, p.y + h, p.z);
          d.subVectors(centro, q); const dl = d.length();
          if (dl < R && dl > 1e-6) { d.divideScalar(dl); p.x += d.x * (R - dl); p.z += d.z * (R - dl); movio = true; }
        }
      }
      if (!movio) break;
    }
  }

  /* mueve la cápsula (p = los pies) por desp; estado = { vy, suelo } */
  function mover(p, desp, estado) {
    estado.suelo = false;
    const pasos = Math.max(1, Math.ceil(Math.hypot(desp.x, desp.y, desp.z) / 0.3));
    for (let s = 0; s < pasos; s++) {
      const hAntes = S.alturaEn(p.x, p.z);
      const px = p.x, pz = p.z;
      p.x += desp.x / pasos; p.z += desp.z / pasos;
      const hDesp = S.alturaEn(p.x, p.z);
      // pendiente de más de 45° hacia arriba: no se trepa
      if (hDesp > p.y + 0.05 && hDesp > hAntes && S.normalEn(p.x, p.z, nT).y < PEND) { p.x = px; p.z = pz; }
      p.y += desp.y / pasos;
      const ht = S.alturaEn(p.x, p.z);
      if (p.y <= ht + 0.01) { p.y = ht; estado.suelo = true; if (estado.vy < 0) estado.vy = 0; }
      resolver(p, estado);
    }
    // pegado al piso al bajar (como el skin de Unity): si el piso está a menos de 15 cm, se apoya
    if (!estado.suelo && estado.vy <= 0) {
      const ht = S.alturaEn(p.x, p.z);
      if (p.y - ht < 0.15 && p.y - ht > 0) { p.y = ht; estado.suelo = true; estado.vy = 0; }
    }
    return estado;
  }
  return { mover, obstaculos, triangulos: T.length / 9 };
}

// Los Collider de Unity que gltf.py deja en extras.colisionadores, para tocar cosas con un rayo como
// Collider.Raycast: caja (centro, tam), esfera (centro, radio), cápsula (centro, radio, alto, eje) y
// malla (la del nodo). Todo en el espacio de cada nodo; la distancia que se devuelve es la de mundo.
//
//   const lista = colisionadores(THREE, raizDelCuarto);       // [{ nodo, c }]
//   const t = tocarColisionador(THREE, rayo, lista);           // { ...el de la lista, distancia, punto } | null

export function colisionadores(THREE, raiz, filtro = null) {
  const out = [];
  raiz.traverse((o) => {
    const cs = o.userData && o.userData.colisionadores;
    if (!cs) return;
    for (const c of cs) if (!c.apagado && (!filtro || filtro(o, c))) out.push({ nodo: o, c });
  });
  return out;
}

// rayo contra una caja alineada (slabs); devuelve t de entrada o null (cajas planas incluidas)
function rayoCaja(o, d, min, max) {
  let t0 = -Infinity, t1 = Infinity;
  for (let i = 0; i < 3; i++) {
    const oi = o.getComponent(i), di = d.getComponent(i), lo = min[i], hi = max[i];
    if (Math.abs(di) < 1e-12) { if (oi < lo || oi > hi) return null; continue; }
    let a = (lo - oi) / di, b = (hi - oi) / di;
    if (a > b) [a, b] = [b, a];
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return null;
  }
  if (t1 < 0) return null;
  return t0 >= 0 ? t0 : t1;
}

function rayoEsfera(o, d, c, r) {
  const ox = o.x - c[0], oy = o.y - c[1], oz = o.z - c[2];
  const a = d.dot(d), b = 2 * (ox * d.x + oy * d.y + oz * d.z), k = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - 4 * a * k;
  if (disc < 0) return null;
  const s = Math.sqrt(disc), t0 = (-b - s) / (2 * a), t1 = (-b + s) / (2 * a);
  if (t1 < 0) return null;
  return t0 >= 0 ? t0 : t1;
}

function rayoCapsula(THREE, o, d, c) {
  // segmento entre los centros de las semiesferas, sobre el eje (0 x, 1 y, 2 z)
  const r = c.radio, mitad = Math.max(0, c.alto / 2 - r), eje = [0, 0, 0];
  eje[c.eje ?? 1] = 1;
  const A = new THREE.Vector3(...c.centro).addScaledVector(new THREE.Vector3(...eje), -mitad);
  const B = new THREE.Vector3(...c.centro).addScaledVector(new THREE.Vector3(...eje), mitad);
  let mejor = null;
  // cilindro
  const ab = B.clone().sub(A), ao = o.clone().sub(A);
  const abab = ab.dot(ab), abd = ab.dot(d), abao = ab.dot(ao);
  if (abab > 1e-9) {
    const a = abab - abd * abd, b = abab * ao.dot(d) - abao * abd, k = abab * ao.dot(ao) - abao * abao - r * r * abab;
    if (Math.abs(a) > 1e-12) {
      const disc = b * b - a * k;
      if (disc >= 0) {
        const t = (-b - Math.sqrt(disc)) / a, y = abao + t * abd;
        if (t >= 0 && y > 0 && y < abab) mejor = t;
      }
    }
  }
  for (const P of [A, B]) {
    const t = rayoEsfera(o, d, [P.x, P.y, P.z], r);
    if (t !== null && (mejor === null || t < mejor)) mejor = t;
  }
  return mejor;
}

export function tocarColisionador(THREE, rayo, lista) {
  let mejor = null;
  const o = new THREE.Vector3(), d = new THREE.Vector3(), inv = new THREE.Matrix4(), p = new THREE.Vector3();
  for (const it of lista) {
    const { nodo, c } = it;
    if (!activoEnArbol(nodo)) continue;
    nodo.updateWorldMatrix(true, false);
    let t = null;
    if (c.tipo === 'malla') {
      const m = c.malla === 'nodo' ? nodo : null;
      if (m && m.isMesh) {
        const r = new THREE.Raycaster(rayo.origin, rayo.direction);
        const h = r.intersectObject(m, false)[0];
        if (h && (!mejor || h.distance < mejor.distancia)) mejor = { ...it, distancia: h.distance, punto: h.point.clone() };
      }
      continue;
    }
    inv.copy(nodo.matrixWorld).invert();
    o.copy(rayo.origin).applyMatrix4(inv);
    // la dirección en local sin normalizar: su largo pasa distancias locales a las de mundo
    const dl = rayo.direction.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(inv));
    const k = dl.length();
    d.copy(dl).divideScalar(k);
    if (c.tipo === 'caja') {
      const min = [0, 1, 2].map((i) => c.centro[i] - c.tam[i] / 2), max = [0, 1, 2].map((i) => c.centro[i] + c.tam[i] / 2);
      t = rayoCaja(o, d, min, max);
    } else if (c.tipo === 'esfera') t = rayoEsfera(o, d, c.centro, c.radio);
    else if (c.tipo === 'capsula') t = rayoCapsula(THREE, o, d, c);
    if (t === null) continue;
    const dist = t / k;
    if (!mejor || dist < mejor.distancia) {
      p.copy(rayo.origin).addScaledVector(rayo.direction, dist);
      mejor = { ...it, distancia: dist, punto: p.clone() };
    }
  }
  return mejor;
}

// como en Unity: un colisionador cuenta si su GameObject y los de arriba están activos (userData.activo)
function activoEnArbol(o) {
  for (let a = o; a; a = a.parent) if (a.userData && a.userData.activo === false) return false;
  return true;
}

// Geometría por código: cajas redondeadas (el look de juguete de plástico),
// y un armador de modelos por PIEZAS con el color horneado en cada vértice.
//
// Por qué por piezas: un modelo se dibuja fusionado (una llamada por clase de
// material en vez de una por pieza), pero guarda la lista de piezas; al
// explotar, cada pieza sale volando por su lado (escombros.js).
import * as THREE from '../vendor/three.module.min.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _c = new THREE.Color();

// ── primitivas ─────────────────────────────────────────────────────────────
// Caja redondeada: una caja de 1×1×1 con un número IMPAR de segmentos; cada
// vértice se lleva a la esquina de la caja interior (la caja menos el radio)
// más el radio en la dirección de su normal suavizada. El segmento del medio
// queda plano y une las cuatro curvas de cada cara.
const cacheRedonda = new Map();
export function cajaRedonda(w, h, d, r = 0.08, seg = 2) {
  r = Math.max(0.0001, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
  const clave = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r.toFixed(3)}|${seg}`;
  if (cacheRedonda.has(clave)) return cacheRedonda.get(clave).clone();
  const n = seg * 2 + 1;
  const g0 = new THREE.BoxGeometry(1, 1, 1, n, n, n).toNonIndexed();
  const pos = g0.attributes.position, nor = g0.attributes.normal, uv = g0.attributes.uv;
  const caja = new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r);
  const medio = 0.5 / n;
  const p = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    nn.copy(p);
    nn.x -= Math.sign(nn.x) * medio; nn.y -= Math.sign(nn.y) * medio; nn.z -= Math.sign(nn.z) * medio;
    nn.normalize();
    pos.setXYZ(i, caja.x * Math.sign(p.x) + nn.x * r, caja.y * Math.sign(p.y) + nn.y * r, caja.z * Math.sign(p.z) + nn.z * r);
    nor.setXYZ(i, nn.x, nn.y, nn.z);
    // uv por proyección de la cara: sirve para texturas de ventanas y ladrillos
    const cara = Math.floor(i / (pos.count / 6));
    const P = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const [a, b, sa, sb] = cara < 2 ? [2, 1, d, h] : cara < 4 ? [0, 2, w, d] : [0, 1, w, h];
    uv.setXY(i, P[a] / sa + 0.5, P[b] / sb + 0.5);
  }
  cacheRedonda.set(clave, g0);
  return g0.clone();
}

export const caja = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cilindro = (rArriba, rAbajo, h, seg = 16, abierto = false) => new THREE.CylinderGeometry(rArriba, rAbajo, h, seg, 1, abierto);
export const esfera = (r, ws = 18, hs = 12) => new THREE.SphereGeometry(r, ws, hs);
export const cono = (r, h, seg = 16) => new THREE.ConeGeometry(r, h, seg);
export const toro = (r, t, rs = 10, ts = 24, arco = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arco);
export const capsula = (r, largo, cs = 6, rs = 12) => new THREE.CapsuleGeometry(r, largo, cs, rs);

// Fusionar geometrías sin índice (posición, normal, uv y color si tienen).
export function fusionar(lista) {
  const geos = lista.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of geos) total += g.attributes.position.count;
  const P = new Float32Array(total * 3), N = new Float32Array(total * 3), U = new Float32Array(total * 2), C = new Float32Array(total * 3);
  let hayColor = false, o = 0;
  for (const g of geos) {
    const n = g.attributes.position.count;
    P.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) N.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) U.set(g.attributes.uv.array, o * 2);
    if (g.attributes.color) { C.set(g.attributes.color.array, o * 3); hayColor = true; }
    else C.fill(1, o * 3, (o + n) * 3);
    o += n;
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.BufferAttribute(P, 3));
  r.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  r.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  if (hayColor) r.setAttribute('color', new THREE.BufferAttribute(C, 3));
  r.computeBoundingSphere();
  r.computeBoundingBox();
  return r;
}

// Pintar una geometría entera de un color (en el espacio lineal del render).
export function pintar(g, color) {
  if (g.index) g = g.toNonIndexed();
  _c.set(color);
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = _c.r; c[i * 3 + 1] = _c.g; c[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

// Degradé vertical horneado: abajo un color, arriba otro (para el pasto, los
// troncos, las llamas).
export function degradar(g, abajo, arriba) {
  if (g.index) g = g.toNonIndexed();
  g.computeBoundingBox();
  const b = g.boundingBox, a = new THREE.Color(abajo), z = new THREE.Color(arriba);
  const n = g.attributes.position.count, c = new Float32Array(n * 3), P = g.attributes.position;
  for (let i = 0; i < n; i++) {
    const t = (P.getY(i) - b.min.y) / Math.max(1e-5, b.max.y - b.min.y);
    _c.copy(a).lerp(z, t);
    c[i * 3] = _c.r; c[i * 3 + 1] = _c.g; c[i * 3 + 2] = _c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

// ── el armador de modelos ──────────────────────────────────────────────────
// Una pieza: una geometría, un color, dónde va y qué clase de material usa.
// Clases: 'mate', 'plastico', 'metal', 'brillo' (luz propia), 'vidrio'.
export function pieza(geo, color, pos = [0, 0, 0], rot = [0, 0, 0], esc = [1, 1, 1], clase = 'plastico') {
  const g = pintar(geo.index ? geo.toNonIndexed() : geo, color);
  _m.compose(_p.set(...pos), _q.setFromEuler(_e.set(rot[0], rot[1], rot[2])), _s.set(...(Array.isArray(esc) ? esc : [esc, esc, esc])));
  g.applyMatrix4(_m);
  g.computeBoundingBox();
  return { geo: g, clase, color };
}

// Atajos: pieza con caja redondeada, con cilindro, con esfera.
export const pc = (w, h, d, r, color, pos, rot, clase) => pieza(cajaRedonda(w, h, d, r), color, pos, rot, [1, 1, 1], clase);
export const pcil = (rt, rb, h, color, pos, rot, clase, seg = 16) => pieza(cilindro(rt, rb, h, seg), color, pos, rot, [1, 1, 1], clase);
export const pesf = (r, color, pos, esc = [1, 1, 1], clase, ws = 18, hs = 12) => pieza(esfera(r, ws, hs), color, pos, [0, 0, 0], esc, clase);

// Armar: fusiona las piezas por clase de material. Devuelve un Group con los
// mallas y, en userData.piezas, las piezas sueltas (para romperlo después).
export function armar(piezas, materiales, { sombra = true, recibe = true } = {}) {
  const grupo = new THREE.Group();
  const porClase = new Map();
  for (const p of piezas) {
    if (!porClase.has(p.clase)) porClase.set(p.clase, []);
    porClase.get(p.clase).push(p.geo);
  }
  for (const [clase, geos] of porClase) {
    const m = new THREE.Mesh(fusionar(geos), materiales[clase] || materiales.plastico);
    m.castShadow = sombra && clase !== 'vidrio' && clase !== 'brillo';
    m.receiveShadow = recibe;
    m.userData.clase = clase;
    grupo.add(m);
  }
  grupo.userData.piezas = piezas;
  return grupo;
}

// Una malla sola con varias piezas de la misma clase (para lo animado: cada
// parte del avatar, cada mascota).
export function malla(piezas, material, sombra = true) {
  const m = new THREE.Mesh(fusionar(piezas.map((p) => p.geo)), material);
  m.castShadow = sombra; m.receiveShadow = true;
  return m;
}

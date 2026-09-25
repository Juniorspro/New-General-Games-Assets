// Utilidades de geometría: unir mallas, cintas de neón, prismas de roca.
//
// POR QUÉ UNIR TODO. Un teléfono se ahoga por cantidad de llamadas de dibujo,
// no por triángulos. El escenario son cientos de piezas (placas de cuerno,
// rocas, travesaños, costillas de las alas) y con un material por tipo se
// dibujan en seis llamadas. Cada vértice lleva su grupo de luz como atributo:
// el shader sabe qué lámpara lo ilumina sin que haga falta separarlos.

import * as THREE from "../vendor/three.module.min.js";

/** Une geometrías (indexadas o no) en una sola, sin índice. Sólo conserva los
 *  atributos que están en TODAS: si uno falta, se completa con `relleno`. */
export function unir(geos, relleno = {}) {
  const planas = geos.map(g => (g.index ? g.toNonIndexed() : g));
  const nombres = new Set();
  for (const g of planas) for (const n of Object.keys(g.attributes)) nombres.add(n);
  let total = 0;
  for (const g of planas) total += g.attributes.position.count;
  const salida = new THREE.BufferGeometry();
  for (const n of nombres) {
    const muestra = planas.find(g => g.attributes[n]).attributes[n];
    const k = muestra.itemSize;
    const arr = new Float32Array(total * k);
    let o = 0;
    for (const g of planas) {
      const a = g.attributes[n];
      const c = g.attributes.position.count;
      if (a) {
        for (let i = 0; i < c; i++) for (let j = 0; j < k; j++) arr[(o + i) * k + j] = a.getComponent(i, j);
      } else {
        const v = relleno[n] ?? 0;
        for (let i = 0; i < c * k; i++) arr[o * k + i] = Array.isArray(v) ? v[i % k] : v;
      }
      o += c;
    }
    salida.setAttribute(n, new THREE.BufferAttribute(arr, k));
  }
  return salida;
}

/** Le pone a toda la geometría un atributo constante (el grupo de luz, etc.). */
export function marcar(geo, nombre, valor) {
  const c = geo.attributes.position.count;
  const k = Array.isArray(valor) ? valor.length : 1;
  const arr = new Float32Array(c * k);
  for (let i = 0; i < c; i++) for (let j = 0; j < k; j++) arr[i * k + j] = Array.isArray(valor) ? valor[j] : valor;
  geo.setAttribute(nombre, new THREE.BufferAttribute(arr, k));
  return geo;
}

/** Una cinta plana que sigue una polilínea en el plano XY (z opcional).
 *  `aPerfil` va de -1 a 1 a lo ancho: el shader hace el brillo con eso.
 *  `aLargo` va de 0 a 1 a lo largo (para ondas que recorren la cinta). */
export function cinta(puntos, ancho, { grupo = 0, fuerza = 1, fase = 0 } = {}) {
  const pos = [], perfil = [], largo = [];
  const n = puntos.length;
  const acum = [0];
  for (let i = 1; i < n; i++) acum.push(acum[i - 1] + puntos[i].distanceTo(puntos[i - 1]));
  const tot = acum[n - 1] || 1;
  const normal = (i) => {
    const a = puntos[Math.max(0, i - 1)], b = puntos[Math.min(n - 1, i + 1)];
    const t = new THREE.Vector2(b.x - a.x, b.y - a.y).normalize();
    return new THREE.Vector2(-t.y, t.x);
  };
  for (let i = 0; i < n - 1; i++) {
    const p0 = puntos[i], p1 = puntos[i + 1];
    const n0 = normal(i).multiplyScalar(ancho / 2), n1 = normal(i + 1).multiplyScalar(ancho / 2);
    const v = [
      [p0.x - n0.x, p0.y - n0.y, p0.z, -1, acum[i]], [p0.x + n0.x, p0.y + n0.y, p0.z, 1, acum[i]],
      [p1.x - n1.x, p1.y - n1.y, p1.z, -1, acum[i + 1]], [p1.x + n1.x, p1.y + n1.y, p1.z, 1, acum[i + 1]],
    ];
    for (const idx of [0, 2, 1, 1, 2, 3]) {
      pos.push(v[idx][0], v[idx][1], v[idx][2]);
      perfil.push(v[idx][3]);
      largo.push(v[idx][4] / tot);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aPerfil", new THREE.Float32BufferAttribute(perfil, 1));
  g.setAttribute("aLargo", new THREE.Float32BufferAttribute(largo, 1));
  marcar(g, "aGrupo", grupo);
  marcar(g, "aFuerza", fuerza);
  marcar(g, "aFase", fase);
  return g;
}

/** Un travesaño recto de neón (cinta de dos puntos) en el plano que se pida. */
export function barra(a, b, ancho, normalPlano, opciones) {
  // Se arma en XY y se rota: más simple que generalizar la cinta a 3D.
  const dir = new THREE.Vector3().subVectors(b, a);
  const largo = dir.length();
  const g = cinta([new THREE.Vector3(0, 0, 0), new THREE.Vector3(largo, 0, 0)], ancho, opciones);
  const x = dir.clone().normalize();
  const z = normalPlano.clone().normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  const z2 = new THREE.Vector3().crossVectors(x, y);
  const m = new THREE.Matrix4().makeBasis(x, y, z2).setPosition(a);
  g.applyMatrix4(m);
  return g;
}

/** Un prisma irregular terminado en punta: las rocas y las púas. */
export function prisma(rng, { radio = 2, alto = 8, lados = 5, punta = 0.25, torcer = 0.2 } = {}) {
  const base = [], cima = [];
  const giro = rng() * Math.PI * 2;
  for (let i = 0; i < lados; i++) {
    const a = giro + (i / lados) * Math.PI * 2 + (rng() - 0.5) * 0.5;
    const r = radio * (0.7 + rng() * 0.5);
    base.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    const rp = r * punta * (0.6 + rng() * 0.8);
    cima.push(new THREE.Vector3(Math.cos(a) * rp + (rng() - 0.5) * torcer * radio, alto * (0.85 + rng() * 0.3),
      Math.sin(a) * rp + (rng() - 0.5) * torcer * radio));
  }
  const pico = new THREE.Vector3((rng() - 0.5) * radio * 0.6, alto * (1.1 + rng() * 0.35), (rng() - 0.5) * radio * 0.4);
  const pos = [];
  const tri = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < lados; i++) {
    const j = (i + 1) % lados;
    tri(base[i], cima[i], base[j]);
    tri(base[j], cima[i], cima[j]);
    tri(cima[i], pico, cima[j]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Caja orientada: centro, eje largo (tangente), eje "alto", medidas. */
export function cajaOrientada(centro, tangente, arriba, largo, alto, hondo) {
  const g = new THREE.BoxGeometry(largo, alto, hondo);
  const x = tangente.clone().normalize();
  const z = new THREE.Vector3().crossVectors(x, arriba).normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  g.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z).setPosition(centro));
  return g;
}

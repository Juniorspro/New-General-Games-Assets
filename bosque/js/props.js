// Los objetos de Higgsfield puestos en el bosque: rocas, lajas, troncos
// caídos, tocones, la cabaña y la fogata.
//
// LLEGAN NORMALIZADOS A UN CUBO DE 1 M y sin saber qué es "abajo" ni qué tan
// grandes son en la vida real. Cada uno se mide acá (su caja), se lleva al
// tamaño que tiene de verdad y se apoya: la base en el suelo y un poco
// hundida, porque una roca apoyada justo en su punto más bajo se ve pegada
// encima del pasto como una calcomanía.
import * as THREE from "three";
import { MUNDO, LUGARES, CINTAS } from "./config.js";
import { generador, suave, fbm } from "./azar.js";
import { altura, enLago, pendiente, normal } from "./terreno.js";
import { aCamino } from "./senderos.js";
import { vestirNiebla } from "./cielo.js";

/** LA GEOMETRÍA CUANTIZADA NO SE PUEDE AGRANDAR. Los GLB vienen con las
 *  posiciones en enteros de 16 bits normalizados: cada coordenada vive entre
 *  -1 y 1 y la escala real la pone el nodo. Al "hornear" la escala en los
 *  vértices, todo lo que pasa de 1 se recorta sin aviso: la cabaña de 9,5 m
 *  quedó aplastada en un cubo de 2 m y no aparecía por ningún lado. Antes de
 *  transformar, todo vuelve a coma flotante. */
export function aFlotante(g) {
  for (const [nombre, a] of Object.entries(g.attributes)) {
    if (a.array instanceof Float32Array && !a.normalized) continue;
    const n = a.count, k = a.itemSize, datos = new Float32Array(n * k);
    for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) datos[i * k + c] = a.getComponent(i, c);
    g.setAttribute(nombre, new THREE.BufferAttribute(datos, k));
  }
  return g;
}

/** La geometría de un GLB de una sola malla, con su transformación aplicada,
 *  apoyada en y=0 y centrada en x,z. `largo` es el tamaño real del lado mayor. */
function preparar(gltf, largo, girarLargoAX = false) {
  let malla = null;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => { if (o.isMesh && !malla) malla = o; });
  const g = aFlotante(malla.geometry.clone()).applyMatrix4(malla.matrixWorld);
  g.computeBoundingBox();
  let b = g.boundingBox, t = new THREE.Vector3();
  b.getSize(t);
  // el tronco caído va acostado sobre x: si su lado largo quedó en z, se gira
  if (girarLargoAX && t.z > t.x) { g.rotateY(Math.PI / 2); g.computeBoundingBox(); b = g.boundingBox; b.getSize(t); }
  const esc = largo / Math.max(t.x, t.y, t.z);
  const c = new THREE.Vector3(); b.getCenter(c);
  g.translate(-c.x, -b.min.y, -c.z);
  g.scale(esc, esc, esc);
  g.computeBoundingBox(); g.computeBoundingSphere();
  const mat = malla.material;
  // TRIPO MARCA LAS ROCAS COMO UN POCO METÁLICAS. Con el panorama como
  // reflejo, una roca con metal 0,2 brilla como una olla. En la naturaleza no
  // hay metal: se apaga, y la rugosidad nunca baja de 0,6.
  mat.metalness = 0; mat.metalnessMap = null;
  mat.roughness = Math.max(mat.roughness, 0.75);
  mat.envMapIntensity = 0.6;
  vestirNiebla(mat);
  g.computeBoundingBox();
  const tam = new THREE.Vector3(); g.boundingBox.getSize(tam);
  return { g, mat, tam };
}

export class Objetos {
  constructor(glb, bosque, colisiones) {
    const t0 = performance.now();
    this.grupo = new THREE.Group();
    this.grupo.name = "objetos";
    const rng = generador(MUNDO.SEMILLA + 300);
    const ocupados = [];
    const libre = (x, z, r) => {
      for (const o of ocupados) if (Math.hypot(o.x - x, o.z - z) < o.r + r) return false;
      let ok = true;
      bosque.cerca(x, z, r + 1.2, () => { ok = false; });
      return ok;
    };
    const ocupar = (x, z, r) => ocupados.push({ x, z, r });

    // ── los únicos ──
    const cab = preparar(glb.cabana, 9.5);
    const C = LUGARES.cabana;
    const yC = altura(C.x, C.z) - 0.25;
    this.cabana = new THREE.Mesh(cab.g, cab.mat);
    this.cabana.position.set(C.x, yC, C.z);
    this.cabana.rotation.y = C.giro;
    this.cabana.castShadow = this.cabana.receiveShadow = true;
    this.cabana.name = "cabana";
    this.grupo.add(this.cabana);
    colisiones.caja(C.x, C.z, cab.tam.x * 0.43, cab.tam.z * 0.43, -C.giro);
    ocupar(C.x, C.z, 8);

    const fog = preparar(glb.fogata, 1.75);
    const F = LUGARES.fogata;
    this.fogata = new THREE.Mesh(fog.g, fog.mat);
    this.fogata.position.set(F.x, altura(F.x, F.z) - 0.06, F.z);
    this.fogata.castShadow = this.fogata.receiveShadow = true;
    this.fogata.name = "fogata";
    this.grupo.add(this.fogata);
    colisiones.circulo(F.x, F.z, 0.75);
    ocupar(F.x, F.z, 3);

    // la laja del mirador: la piedra grande desde la que se ve el lago
    const laja = preparar(glb.laja, 1);
    const M = LUGARES.mirador;
    this.mirador = new THREE.Mesh(laja.g, laja.mat);
    const yM = Math.min(altura(M.x - 2, M.z), altura(M.x + 2, M.z), altura(M.x, M.z - 2), altura(M.x, M.z + 2));
    this.mirador.position.set(M.x + 3, yM - 0.45, M.z - 2);
    this.mirador.scale.setScalar(6.5);
    this.mirador.rotation.y = 0.7;
    this.mirador.castShadow = this.mirador.receiveShadow = true;
    this.grupo.add(this.mirador);
    ocupar(M.x + 3, M.z - 2, 4.5);

    // ── los repetidos ──
    const tipos = {
      // radio: hasta dónde se dibujan. Una roca de 2,5 m se ve desde lejos; un
      // tocón a 60 m ya es un pixel marrón que la niebla se come
      roca: { p: preparar(glb.roca, 1), cuantos: 85, esc: [0.7, 2.6], radio: 110 },
      laja: { p: preparar(glb.laja, 1), cuantos: 26, esc: [1.6, 3.8], radio: 110 },
      tronco: { p: preparar(glb.tronco, 1, true), cuantos: 46, esc: [5, 8.5], radio: 80 },
      tocon: { p: preparar(glb.tocon, 1), cuantos: 52, esc: [0.9, 1.6], radio: 60 },
    };
    this.instancias = {};
    for (const [nombre, T] of Object.entries(tipos)) {
      const lista = [];
      let intentos = 0;
      // el primer tronco caído es el de la primera cinta: tiene lugar fijo
      if (nombre === "tronco") lista.push(this.ponerTronco(CINTAS[0].x - 1.6, CINTAS[0].z + 0.4, 0.4, 6.2, T.p.tam, colisiones, ocupar));
      while (lista.length < T.cuantos && intentos++ < T.cuantos * 60) {
        const ang = rng() * Math.PI * 2, rad = Math.sqrt(rng()) * (MUNDO.RADIO_JUGABLE + 10);
        const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
        if (enLago(x, z) < (nombre === "roca" ? 0.97 : 1.12)) continue;
        if (aCamino(x, z) < 1.5) continue;
        const pend = pendiente(x, z);
        // las rocas prefieren las laderas y la orilla; los tocones y troncos el
        // bosque cerrado y plano
        const orilla = 1 - suave(1.05, 1.4, enLago(x, z));
        const quiere = nombre === "roca" || nombre === "laja"
          ? 0.12 + suave(0.12, 0.35, pend) * 0.7 + orilla * 0.5 + suave(0.55, 0.7, fbm(x * 0.03, z * 0.03, 2, 77)) * 0.3
          : (1 - suave(0.2, 0.4, pend)) * 0.6;
        if (rng() > quiere) continue;
        const e = rng.rango(T.esc[0], T.esc[1]);
        const r = e * (nombre === "tronco" ? 0.15 : 0.42);
        if (!libre(x, z, nombre === "tronco" ? e * 0.5 : r)) continue;
        if (nombre === "tronco") { lista.push(this.ponerTronco(x, z, rng() * Math.PI, e, T.p.tam, colisiones, ocupar)); continue; }
        const y = altura(x, z) - e * T.p.tam.y * (nombre === "roca" ? 0.18 : 0.25);
        const n = normal(x, z);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
        // las lajas se acuestan con la loma; las rocas solo la mitad
        if (nombre !== "laja") q.slerp(new THREE.Quaternion(), 0.5);
        q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2));
        lista.push({ p: new THREE.Vector3(x, y, z), q, s: e });
        colisiones.circulo(x, z, r * 0.9);
        ocupar(x, z, r + 0.5);
      }
      const im = new THREE.InstancedMesh(T.p.g, T.p.mat, lista.length);
      for (const it of lista) {
        it.m = new THREE.Matrix4().compose(it.p, it.q, new THREE.Vector3(it.s, it.s, it.s)).toArray(new Float32Array(16));
        it.r = it.s * 0.75;          // radio de la esfera que lo contiene
      }
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = im.receiveShadow = true;
      im.frustumCulled = false;
      im.count = 0;
      im.name = nombre;
      this.grupo.add(im);
      this.instancias[nombre] = { im, lista, tam: T.p.tam, radio: T.radio };
    }
    this.ms = performance.now() - t0;
  }

  /** LAS ROCAS SE DIBUJABAN TODAS, SIEMPRE, Y DOS VECES. Las 209 piedras,
   *  troncos y tocones del bosque sumaban 560 mil triángulos, más el doble
   *  para la sombra: 1,1 millones por cuadro para cosas que en su mayoría
   *  estaban detrás de la cámara o a 300 m en la niebla. Medido con
   *  renderer.info. Ahora entra solo lo cercano y lo que está en pantalla. */
  actualizar(cam, frustum) {
    const p = cam.position;
    for (const T of Object.values(this.instancias)) {
      const arr = T.im.instanceMatrix.array;
      let n = 0;
      for (const it of T.lista) {
        const d = Math.hypot(it.p.x - p.x, it.p.z - p.z);
        if (d > T.radio) continue;
        // cerca de la cámara entra aunque no se vea: su sombra sí puede verse
        if (d > 30) {
          _esf.center.copy(it.p); _esf.radius = it.r + d * 0.16;
          if (!frustum.intersectsSphere(_esf)) continue;
        }
        arr.set(it.m, n * 16);
        n++;
      }
      T.im.count = n;
      T.im.instanceMatrix.needsUpdate = true;
    }
  }

  /** Un tronco caído, acostado sobre la loma: se miden las dos puntas y se
   *  inclina para que apoye en las dos, no solo en el medio. */
  ponerTronco(x, z, th, largo, tam, colisiones, ocupar) {
    const dx = Math.cos(th) * largo / 2, dz = -Math.sin(th) * largo / 2;
    const h0 = altura(x - dx, z - dz), h1 = altura(x + dx, z + dz);
    const radio = tam.y * largo * 0.5;
    const y = (h0 + h1) / 2 - radio * 0.3;
    const cab = Math.atan2(h1 - h0, largo);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), th)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), cab));
    colisiones.capsula(x - dx, z - dz, x + dx, z + dz, Math.max(0.2, tam.z * largo * 0.4));
    ocupar(x, z, largo * 0.5);
    return { p: new THREE.Vector3(x, y, z), q, s: largo };
  }

  /** Lo que un rayo vertical encuentra primero: la cabaña, la laja del
   *  mirador, un tronco caído, o el suelo. Lo usan las cintas para quedar
   *  apoyadas sobre lo que haya y no enterradas en el piso de la cabaña. */
  superficie(x, z) {
    _ray.set(_o.set(x, 200, z), _abajo);
    // el tronco instanciado solo tiene cargadas las instancias visibles: para
    // el rayo se cargan todas un momento
    const T = this.instancias.tronco;
    T.lista.forEach((it, i) => T.im.instanceMatrix.array.set(it.m, i * 16));
    T.im.count = T.lista.length;
    T.im.computeBoundingSphere();
    const hits = _ray.intersectObjects([this.cabana, this.mirador, this.fogata, T.im], false);
    T.im.count = 0;
    const suelo = altura(x, z);
    return hits.length ? Math.max(suelo, hits[0].point.y) : suelo;
  }
}
const _ray = new THREE.Raycaster(), _o = new THREE.Vector3(), _abajo = new THREE.Vector3(0, -1, 0), _esf = new THREE.Sphere();

/* ============================================================================
   aeroplaza/js/detalle.js — lo que se deja de dibujar de lejos (26/09: "optimizale
   aún más… a mí me va bien, pero para otros no"). Medido con SwiftShader (el peor
   celu): en baja la plaza dibujaba 1,75 millones de triángulos en 459 llamadas, y
   casi todo era geometría lejana (los árboles de lejos solos, 267 mil). Cada
   calidad tiene su distancia (motor.js › CALIDADES.lejos) y la niebla termina
   ahí, así lo que se corta no "aparece de golpe":
   - las piezas de primer nivel del lugar (casas, hoteles, puestos…) se esconden
     enteras si quedan más lejos. No se pisa lo que el juego muestra o esconde:
     `visible` pasa a ser "lo que dice el juego Y no está cortado" (un getter);
   - las instancias quietas (pasto, flores, faroles, piedras…) se reordenan cada
     tanto y se dibujan solo las de cerca (count). Las que se mueven solas (las
     burbujas, la lluvia del runner) se detectan porque alguien más les escribe
     la matriz, y se dejan;
   - los árboles tienen su propio cerca/lejos (naturaleza.js › Arboleda) y leen
     DETALLE para no dibujar los de más allá.
   Adentro de los edificios no se corta nada (son chicos y en primera persona).
   ========================================================================== */
import * as THREE from 'three';

/* lo que leen las Arboledas y las Burbujas (lo pone Detalle según la calidad) */
/* seg y curvas: cuántos segmentos llevan las cajas redondeadas (3 en alta) y qué parte de los
   de cilindros y esferas, al ARMAR (construcciones.js): una caja con 3 son 588 triángulos, con 1
   son 108; la terminal sola tenía 67 mil */
export const DETALLE = { lejos: Infinity, cerca: Infinity, burbujas: 1, seg: 3, curvas: 1 };

const V = new THREE.Vector3(), C = new THREE.Vector3(), CAJA = new THREE.Box3(), ESF = new THREE.Sphere(), M = new THREE.Matrix4();

/* `visible` como "lo que quiere el juego" && !cortado */
function cortable(o) {
  if (o.userData._corte) return o.userData._corte;
  let vis = o.visible;
  const d = o.userData._corte = { cortado: false };
  Object.defineProperty(o, 'visible', { configurable: true, get() { return vis && !d.cortado; }, set(v) { vis = v; } });
  d.juego = () => vis;
  return d;
}

export class Detalle {
  constructor(motor) { this.motor = motor; this.reino = null; this.t = 9; this.lim = Infinity; }
  /* al entrar a un lugar: qué piezas se pueden cortar y qué instancias son quietas */
  preparar(reino) {
    this.reino = reino; this.piezas = []; this.inst = []; this.t = 9;
    if (!reino || reino.primeraPersona || reino.interior || !reino.grupo) return;
    const g = reino.grupo; g.updateMatrixWorld(true);
    for (const o of g.children) {
      if (o.userData.sinCorte || o.isLight) continue;
      CAJA.setFromObject(o); if (CAJA.isEmpty()) continue;
      CAJA.getBoundingSphere(ESF);
      /* lo enorme (el terreno, el mar, el cielo, las arboledas) no se corta entero */
      if (ESF.radius > 110) continue;
      o.getWorldPosition(V);
      this.piezas.push({ o, d: cortable(o), off: ESF.center.clone().sub(V), r: ESF.radius });
    }
    g.traverse((o) => this.registrar(o));
  }
  /* las instancias que se agregan después (instanciar.js: las copias, a los dos segundos) */
  sumar(lista) { if (this.inst && this.reino && !this.reino.primeraPersona && !this.reino.interior) for (const o of lista) this.registrar(o); this.t = 9; }
  /* una instancia quieta: se guarda entera y se dibujan las de cerca */
  registrar(o) {
    if (!o.isInstancedMesh || (o.count < 12 && !o.userData.copias) || o.userData.sinCorte || o.parent?.isArboleda) return;
    const n = o.count, pos = new Float32Array(n * 3), mat = o.instanceMatrix.array.slice(0, n * 16), col = o.instanceColor ? o.instanceColor.array.slice(0, n * 3) : null;
    o.updateMatrixWorld();
    /* (la esfera para el recorte de cámara se calcula con todas: si no, después quedaría chica) */
    o.computeBoundingSphere(); o.computeBoundingBox?.();
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < n; i++) { M.fromArray(mat, i * 16); V.setFromMatrixPosition(M).applyMatrix4(o.matrixWorld); pos.set([V.x, V.y, V.z], i * 3); x0 = Math.min(x0, V.x); x1 = Math.max(x1, V.x); z0 = Math.min(z0, V.z); z1 = Math.max(z1, V.z); }
    /* (si están todas juntas, conviene la pieza entera o nada) */
    if (Math.max(x1 - x0, z1 - z0) < 40) return;
    this.inst.push({ o, n, pos, mat, col, version: o.instanceMatrix.version, hay: n, alc: o.userData.alcance ?? Infinity });
  }
  /* cada 0,35 s: lim es la distancia de la calidad (Infinity: todo) */
  actualizar(dt, cam, Q, bajoAgua = false) {
    const lim = Q.lejos ?? Infinity;
    DETALLE.lejos = lim; DETALLE.cerca = Q.arbolCerca ?? Infinity; DETALLE.burbujas = Q.burbujas ?? 1;
    /* la niebla termina donde se corta (debajo del agua manda main.js) */
    const f = this.motor.escena.fog;
    if (f && !bajoAgua && this.reino && !this.reino.primeraPersona) { f.far = Math.min(950, lim * 1.02); f.near = Math.min(140, lim * 0.4); }
    this.t += dt; if (this.t < 0.35 && lim === this.lim) return;
    this.t = 0; this.lim = lim;
    const p = cam.position;
    for (const q of this.piezas) {
      q.o.getWorldPosition(C).add(q.off);
      q.d.cortado = Number.isFinite(lim) && C.distanceTo(p) - q.r > lim;
    }
    for (const q of this.inst) {
      const im = q.o;
      /* alguien más le escribe (se mueve sola): se deja como estaba */
      /* (y la cantidad la maneja quien le escribe: las flores tienen su propio corte a 60 m; antes se les ponía la cantidad entera) */
      if (im.instanceMatrix.version !== q.version) { this.inst.splice(this.inst.indexOf(q), 1); continue; }
      /* (cada uno puede tener su alcance: las flores no se ven más allá de 70 m aunque la calidad no corte nada) */
      const L = Math.min(lim, q.alc);
      let k = 0; const l2 = (L + 2) * (L + 2), A = im.instanceMatrix.array, CA = im.instanceColor?.array;
      for (let i = 0; i < q.n; i++) {
        const dx = q.pos[i * 3] - p.x, dz = q.pos[i * 3 + 2] - p.z;
        if (Number.isFinite(L) && dx * dx + dz * dz > l2) continue;
        if (k !== i || q.hay !== q.n) { A.set(q.mat.subarray(i * 16, i * 16 + 16), k * 16); if (CA && q.col) CA.set(q.col.subarray(i * 3, i * 3 + 3), k * 3); }
        k++;
      }
      if (k !== q.hay || k !== q.n) { im.count = k; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; q.version = im.instanceMatrix.version; }
      q.hay = k;
    }
  }
  /* para las pruebas y el medidor */
  get estado() { return { piezas: this.piezas?.length || 0, cortadas: this.piezas?.filter((q) => q.d.cortado).length || 0, inst: this.inst?.length || 0, lim: this.lim }; }
}

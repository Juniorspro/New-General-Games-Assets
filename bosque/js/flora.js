// Lo que crece abajo: helechos en la sombra, pasto en los claros y en la
// orilla, flores en el claro grande.
//
// SE SIEMBRA TODO EL MUNDO UNA VEZ Y SE DIBUJA SOLO LO CERCANO. Doce mil
// helechos existen, pero se dibujan los que caen a menos de ~45 m de la cámara
// y dentro de la pantalla, en celdas de 12 m. Sembrarlos alrededor del
// caminante a medida que anda (lo más barato) tiene un defecto que se ve: al
// volver a un lugar los helechos están en otro lado.
import * as THREE from "three";
import { MUNDO, LUGARES } from "./config.js";
import { generador, fbm, suave, mezcla } from "./azar.js";
import { altura, enLago, pendiente, REJILLA, mascara } from "./terreno.js";
import { aCamino } from "./senderos.js";
import { vestirNiebla } from "./cielo.js";
import { parchear } from "./parche.js";

class Malla {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.f = []; this.i = []; }
  v(x, y, z, nx, ny, nz, u, v, c, f) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, v); this.c.push(c, c, c); this.f.push(f);
    return this.p.length / 3 - 1;
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute("aFlex", new THREE.Float32BufferAttribute(this.f, 1));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}

/** Un helecho: frondas que salen del centro, suben y se arquean hacia afuera. */
function geoHelecho(semilla) {
  const rng = generador(semilla);
  const m = new Malla();
  const frondas = 8, seg = 4, asp = 0.58;
  for (let k = 0; k < frondas; k++) {
    const th = (k / frondas) * Math.PI * 2 + rng.rango(-0.25, 0.25);
    const L = rng.rango(0.85, 1.25);
    let x = 0, y = 0.02, h = 0;
    let cab = rng.rango(0.95, 1.2);                 // arranca empinada
    const cx = Math.cos(th), cz = Math.sin(th);
    const lx = -cz, lz = cx;                        // el ancho, de costado
    const base = m.p.length / 3;
    for (let s = 0; s <= seg; s++) {
      const t = s / seg;
      const w = L * asp * 0.5 * (t < 0.15 ? 0.6 : 1);
      const ao = mezcla(0.45, 1.05, t);
      // la normal apunta arriba y un poco hacia afuera: el helecho se ilumina
      // como una mata y no como ocho papeles sueltos
      const nx = cx * 0.35, ny = 1, nz = cz * 0.35;
      m.v(x * cx + lx * w, y, x * cz + lz * w, nx, ny, nz, 0, t, ao, t);
      m.v(x * cx - lx * w, y, x * cz - lz * w, nx, ny, nz, 1, t, ao, t);
      const paso = L / seg;
      x += Math.cos(cab) * paso; y += Math.sin(cab) * paso; h = y;
      cab -= rng.rango(0.34, 0.46);                 // y se va cayendo
    }
    for (let s = 0; s < seg; s++) {
      const a = base + s * 2;
      m.i.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }
  return m.geo();
}

/** Planos cruzados parados, para el pasto y las flores. */
function geoCruzado(planos, ancho, alto) {
  const m = new Malla();
  for (let k = 0; k < planos; k++) {
    const th = (k / planos) * Math.PI;
    const dx = Math.cos(th) * ancho / 2, dz = Math.sin(th) * ancho / 2;
    const b = m.p.length / 3;
    m.v(-dx, -0.03, -dz, 0, 1, 0, 0, 0, 0.55, 0);
    m.v(dx, -0.03, dz, 0, 1, 0, 1, 0, 0.55, 0);
    m.v(dx, alto, dz, 0, 1, 0, 1, 1, 1.05, 1);
    m.v(-dx, alto, -dz, 0, 1, 0, 0, 1, 1.05, 1);
    m.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return m.geo();
}

export const JUGADOR = { value: new THREE.Vector3(0, -99, 0) };

function materialPlanta(mapa, tamTex, VIENTO, tinte = 0xffffff) {
  const mat = new THREE.MeshStandardMaterial({
    map: mapa, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.85, color: tinte,
  });
  parchear(mat, "planta1", (sh) => {
    sh.uniforms.uT = VIENTO.uT; sh.uniforms.uViento = VIENTO.uViento; sh.uniforms.uJugador = JUGADOR;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
        uniform float uT, uViento; uniform vec3 uJugador; attribute float aFlex;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        #ifdef USE_INSTANCING
        {
          vec3 wPos = (instanceMatrix * vec4(transformed, 1.0)).xyz;
          float f2 = aFlex * aFlex;
          float fase = wPos.x * 0.37 + wPos.z * 0.29;
          vec3 dw = vec3(sin(uT * 1.7 + fase), 0.0, cos(uT * 1.3 + fase * 0.8)) * f2 * 0.07 * uViento;
          // EL PASTO SE CORRE CUANDO LO PISÁS. Medio metro alrededor del
          // caminante las puntas se apartan: un detalle chico que hace que el
          // suelo parezca de verdad y no un decorado que se atraviesa.
          vec2 d = wPos.xz - uJugador.xz;
          float cerca = 1.0 - smoothstep(0.2, 0.95, length(d));
          dw.xz += normalize(d + 1e-4) * cerca * f2 * 0.35;
          dw.y -= cerca * f2 * 0.12;
          // el corrimiento se calcula en el mundo y se lleva al espacio de la
          // planta: la instancia es giro + escala pareja, así que la inversa
          // es la transpuesta dividida por la escala al cuadrado
          mat3 im = mat3(instanceMatrix);
          transformed += transpose(im) * dw / dot(im[0], im[0]);
        }
        #endif`);
    sh.fragmentShader = sh.fragmentShader.replace("#include <alphatest_fragment>", `
      {
        vec2 dx = dFdx(vMapUv * ${tamTex.toFixed(1)}), dy = dFdy(vMapUv * ${tamTex.toFixed(1)});
        float mip = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy))));
        diffuseColor.a *= 1.0 + mip * 0.28;
      }
      #include <alphatest_fragment>`);
  });
  vestirNiebla(mat);
  return mat;
}

const CELDA = 12;

/** Un tipo de planta repartido por el mundo, dibujado por celdas cercanas. */
class Capa {
  constructor(nombre, geo, mat, instancias, radio) {
    this.radio = radio;
    this.celdas = new Map();
    for (const it of instancias) {
      const k = Math.floor(it.x / CELDA) * 1000 + Math.floor(it.z / CELDA);
      if (!this.celdas.has(k)) this.celdas.set(k, { i: Math.floor(it.x / CELDA), j: Math.floor(it.z / CELDA), l: [] });
      this.celdas.get(k).l.push(it);
    }
    for (const c of this.celdas.values()) {
      c.m = new Float32Array(c.l.length * 16);
      c.l.forEach((it, n) => {
        _m.compose(_p.set(it.x, it.y, it.z), _q.setFromAxisAngle(_y, it.giro), _s.setScalar(it.escala));
        _m.toArray(c.m, n * 16);
      });
      let ymin = 1e9, ymax = -1e9;
      for (const it of c.l) { ymin = Math.min(ymin, it.y); ymax = Math.max(ymax, it.y + 1.5); }
      c.caja = new THREE.Box3(new THREE.Vector3(c.i * CELDA, ymin, c.j * CELDA), new THREE.Vector3((c.i + 1) * CELDA, ymax, (c.j + 1) * CELDA));
    }
    // la capacidad: lo que cabe en el círculo de dibujo con la densidad más
    // alta que haya en alguna celda, con margen
    let max = 0;
    for (const c of this.celdas.values()) max = Math.max(max, c.l.length);
    const celdasEnRadio = Math.ceil(Math.PI * (radio + CELDA) ** 2 / (CELDA * CELDA));
    this.cap = Math.min(instancias.length, max * celdasEnRadio) || 1;
    this.malla = new THREE.InstancedMesh(geo, mat, this.cap);
    this.malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.malla.frustumCulled = false;
    this.malla.receiveShadow = true;
    this.malla.count = 0;
    this.malla.name = nombre;
    this.total = instancias.length;
  }
  actualizar(p, frustum) {
    const arr = this.malla.instanceMatrix.array;
    let n = 0;
    const r = this.radio;
    const i0 = Math.floor((p.x - r) / CELDA), i1 = Math.floor((p.x + r) / CELDA);
    const j0 = Math.floor((p.z - r) / CELDA), j1 = Math.floor((p.z + r) / CELDA);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const c = this.celdas.get(i * 1000 + j);
      if (!c) continue;
      const cx = (i + 0.5) * CELDA - p.x, cz = (j + 0.5) * CELDA - p.z;
      if (cx * cx + cz * cz > (r + CELDA * 0.7) ** 2) continue;
      if (!frustum.intersectsBox(c.caja)) continue;
      const cuantos = Math.min(c.l.length, this.cap - n);
      if (cuantos <= 0) break;
      arr.set(cuantos === c.l.length ? c.m : c.m.subarray(0, cuantos * 16), n * 16);
      n += cuantos;
    }
    this.malla.count = n;
    this.malla.instanceMatrix.needsUpdate = true;
  }
}
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);

export class Flora {
  constructor(tex, calidad, VIENTO) {
    const t0 = performance.now();
    const rng = generador(MUNDO.SEMILLA + 200);
    const dens = calidad.densidadFlora;
    const helechos = [], pastos = [], flores = [];
    const { N, PASO, MEDIO } = REJILLA;
    const C = LUGARES.claro;
    for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
      const x0 = -MEDIO + i * PASO, z0 = -MEDIO + j * PASO;
      if (Math.hypot(x0, z0) > MUNDO.RADIO_JUGABLE + 12) continue;
      const cx = x0 + PASO / 2, cz = z0 + PASO / 2;
      const sendero = mascara(cx, cz, 0), pasto = mascara(cx, cz, 2), sombra = mascara(cx, cz, 3);
      const dl = enLago(cx, cz);
      if (dl < 1.02) continue;
      const pend = pendiente(cx, cz);
      if (pend > 0.45) continue;
      const cam = aCamino(cx, cz);

      // HELECHOS: en la sombra de las copas, en manchones, nunca en el camino
      const manchon = suave(0.42, 0.62, fbm(cx * 0.045 + 7, cz * 0.045 - 3, 3, MUNDO.SEMILLA + 210));
      const pH = (0.12 + 0.55 * sombra) * manchon * suave(0.4, 1.6, cam) * dens;
      if (rng() < pH) {
        const x = x0 + rng() * PASO, z = z0 + rng() * PASO;
        helechos.push({ x, z, y: altura(x, z), giro: rng() * 6.283, escala: rng.rango(0.65, 1.25) * mezcla(0.9, 1.15, sombra), v: rng() < 0.5 ? 0 : 1 });
      }
      // PASTO: en el claro, en la orilla y en el borde de los senderos
      const borde = sendero > 0.02 && sendero < 0.55 ? 0.7 : 0;
      const pP = Math.min(1, pasto * 1.4 + borde * suave(0.1, 0.9, cam + 0.5) + (1 - sombra) * 0.05) * dens;
      const cuantos = pP > 0.6 ? 3 : pP > 0.25 ? 2 : 1;
      for (let q = 0; q < cuantos; q++) {
        if (rng() > pP) continue;
        const x = x0 + rng() * PASO, z = z0 + rng() * PASO;
        if (aCamino(x, z) < 0.15) continue;
        pastos.push({ x, z, y: altura(x, z), giro: rng() * 6.283, escala: rng.rango(0.6, 1.2) });
      }
      // FLORES: solo en el claro, que es la recompensa de desviarse
      const enClaro = 1 - suave(C.radio * 0.4, C.radio, Math.hypot(cx - C.x, cz - C.z));
      if (rng() < enClaro * 0.55 * dens) {
        const x = x0 + rng() * PASO, z = z0 + rng() * PASO;
        flores.push({ x, z, y: altura(x, z), giro: rng() * 6.283, escala: rng.rango(0.7, 1.25) });
      }
    }
    // dos formas de helecho; cada instancia elige una
    this.capas = [];
    const R = calidad.flora;
    const matH = materialPlanta(tex.helecho, 1024, VIENTO);
    this.capas.push(new Capa("helechos-a", geoHelecho(11), matH, helechos.filter((h) => h.v === 0), R));
    this.capas.push(new Capa("helechos-b", geoHelecho(23), matH, helechos.filter((h) => h.v === 1), R));
    // EL PASTO DE LA FOTO ES CASI PAJA: dorado, con espigas blancas. A plena
    // luz del atardecer eso sale blanco, como abanicos de papel clavados en el
    // piso. Se lo tiñe hacia el verde y se lo oscurece; la foto sigue poniendo
    // la forma de cada hoja, que es lo que no se puede inventar.
    this.capas.push(new Capa("pasto", geoCruzado(3, 0.8, 0.5), materialPlanta(tex.pasto, 512, VIENTO, 0x8c9d5e), pastos, R * 0.85));
    this.capas.push(new Capa("flores", geoCruzado(2, 0.55, 0.62), materialPlanta(tex.flores, 512, VIENTO), flores, R * 0.8));
    this.grupo = new THREE.Group();
    this.grupo.name = "flora";
    for (const c of this.capas) this.grupo.add(c.malla);
    this.cuenta = { helechos: helechos.length, pasto: pastos.length, flores: flores.length };
    this.ms = performance.now() - t0;
    this.ultimo = { x: 1e9, z: 1e9, dir: new THREE.Vector3() };
  }
  actualizar(cam, frustum, forzar = false) {
    const p = cam.position, dir = cam.getWorldDirection(_d), u = this.ultimo;
    if (!forzar && Math.hypot(p.x - u.x, p.z - u.z) < 1.0 && dir.dot(u.dir) > Math.cos(0.1)) return;
    u.x = p.x; u.z = p.z; u.dir.copy(dir);
    for (const c of this.capas) c.actualizar(p, frustum);
  }
}
const _d = new THREE.Vector3();

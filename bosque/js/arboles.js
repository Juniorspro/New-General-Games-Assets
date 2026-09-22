// Los árboles: abetos, píceas y abedules armados por código, vestidos con las
// fotos de Higgsfield.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUÉ NO SE GENERÓ EL ÁRBOL ENTERO EN 3D.
// ═══════════════════════════════════════════════════════════════════════════
// Un generador de imagen-a-3D devuelve una malla cerrada: la copa sale como un
// bloque de arcilla verde pintado con hojas. De lejos pasa; a dos metros, que
// es donde está la cámara en tercera persona, es un repollo. Los árboles de los
// juegos que se ven bien son ramas de verdad con TARJETAS de follaje encima:
// planos con la foto de una rama recortada. Acá el esqueleto lo arma el código
// (tronco que se afina, pisos de ramas que se caen con el largo) y las fotos
// ponen lo que el código no sabe dibujar: la corteza y las agujas.
//
// TRES NIVELES DE DETALLE. Un abeto cercano tiene ~1.100 triángulos; tres mil
// así son tres millones y un teléfono no los mueve. Cerca va el completo; a
// media distancia uno con la mitad de pisos y tarjetas más grandes; lejos, dos
// planos cruzados con una FOTO DEL MISMO ÁRBOL sacada al arrancar. Que sea el
// mismo árbol fotografiado es lo que evita que el bosque cambie de color de
// golpe en el radio donde se pasa de uno a otro.
import * as THREE from "three";
import { MUNDO, LUGARES } from "./config.js";
import { generador, fbm, suave, mezcla } from "./azar.js";
import { altura, enLago, pendiente, anotarSombra } from "./terreno.js";
import { aCamino } from "./senderos.js";
import { vestirNiebla } from "./cielo.js";

// ── armado de geometría ─────────────────────────────────────────────────
class Malla {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.f = []; this.i = []; }
  v(p, n, u, vv, c, f) {
    this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z);
    this.uv.push(u, vv); this.c.push(c, c * 1.0, c); this.f.push(f);
    return this.p.length / 3 - 1;
  }
  tri(a, b, c) { this.i.push(a, b, c); }
  geometria() {
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
  get triangulos() { return this.i.length / 3; }
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ARRIBA = V(0, 1, 0);

/** Tronco que se afina, con el pie ensanchado y las raíces marcadas.
 *  Arranca 0,6 m bajo el suelo: en una loma el lado de abajo quedaría en el
 *  aire si el tronco empezara justo en la altura del centro. */
function tronco(m, rng, o) {
  const { alto, r0, lados, pisos, repU, metroV, inclina, curva } = o;
  const semilla = rng() * 10;
  const base = m.p.length / 3;
  for (let s = 0; s <= pisos; s++) {
    const t = s / pisos;
    const y = -0.6 + t * (alto + 0.6);
    const yy = Math.max(0, y);
    const cx = inclina.x * yy + curva.x * Math.sin(t * 2.4) * alto * 0.01;
    const cz = inclina.z * yy + curva.z * Math.sin(t * 2.1 + 1) * alto * 0.01;
    let r = r0 * Math.pow(Math.max(0, 1 - t), 0.82) + 0.015;
    r *= 1 + 0.6 * Math.exp(-yy / 0.75);
    for (let k = 0; k <= lados; k++) {
      const a = (k / lados) * Math.PI * 2;
      const raiz = 1 + 0.3 * Math.exp(-yy / 0.45) * Math.max(0, Math.sin(a * 5 + semilla));
      const ca = Math.cos(a), sa = Math.sin(a);
      const p = V(cx + ca * r * raiz, y, cz + sa * r * raiz);
      const n = V(ca, 0.18, sa).normalize();
      // el pie del tronco más oscuro: ahí no llega la luz y la tierra lo mancha
      const ao = mezcla(0.5, 1, suave(0, 2.5, yy));
      m.v(p, n, (k / lados) * repU, y / metroV, ao, t * 0.15);
    }
  }
  const fila = lados + 1;
  for (let s = 0; s < pisos; s++) for (let k = 0; k < lados; k++) {
    const a = base + s * fila + k, b = a + 1, c = a + fila, d = c + 1;
    m.tri(a, c, b); m.tri(b, c, d);
  }
}

/** Una rama leñosa: prisma de tres caras que se afina. Solo en el detalle
 *  cercano: es lo que se ve cuando uno mira para arriba desde abajo del árbol,
 *  y sin ella las tarjetas flotan alrededor del tronco. */
function palo(m, puntos, r0) {
  const lados = 3, base = m.p.length / 3;
  for (let s = 0; s < puntos.length; s++) {
    const p = puntos[s], t = s / (puntos.length - 1);
    const sig = puntos[Math.min(s + 1, puntos.length - 1)], ant = puntos[Math.max(s - 1, 0)];
    const T = sig.clone().sub(ant).normalize();
    const lado = V().crossVectors(T, ARRIBA).normalize();
    const arriba = V().crossVectors(lado, T).normalize();
    const r = r0 * (1 - t * 0.8);
    for (let k = 0; k <= lados; k++) {
      const a = (k / lados) * Math.PI * 2;
      const n = lado.clone().multiplyScalar(Math.cos(a)).addScaledVector(arriba, Math.sin(a));
      m.v(p.clone().addScaledVector(n, r), n, k / lados, t * 0.5, 0.55, t);
    }
  }
  const fila = lados + 1;
  for (let s = 0; s < puntos.length - 1; s++) for (let k = 0; k < lados; k++) {
    const a = base + s * fila + k, b = a + 1, c = a + fila, d = c + 1;
    m.tri(a, c, b); m.tri(b, c, d);
  }
}

/** Una tarjeta de follaje entre A y B (v de la textura va de A a B). */
function tarjeta(m, A, B, lado, ancho, eje, ao0, ao1, flex0, flex1) {
  const T = B.clone().sub(A).normalize();
  let n = V().crossVectors(lado, T).normalize();
  if (n.y < 0) n.negate();
  // NORMALES HACIA AFUERA DEL ÁRBOL, NO LAS DEL PLANO. Con la normal del
  // plano cada tarjeta se prende o se apaga según cómo quedó girada y la copa
  // se ve como un montón de papelitos. Mezclándola con la dirección que sale
  // del eje del tronco, la copa se ilumina como un volumen: el lado del sol
  // claro, el otro en sombra, y el interior oscuro por el color del vértice.
  const afuera = (p) => V(p.x - eje.x, 0, p.z - eje.z).normalize().multiplyScalar(0.75).add(V(0, 0.55, 0)).normalize();
  const nA = n.clone().lerp(afuera(A), 0.62).normalize(), nB = n.clone().lerp(afuera(B), 0.62).normalize();
  const h = lado.clone().multiplyScalar(ancho / 2);
  const a = m.v(A.clone().sub(h), nA, 0, 0, ao0, flex0);
  const b = m.v(A.clone().add(h), nA, 1, 0, ao0, flex0);
  const c = m.v(B.clone().add(h), nB, 1, 1, ao1, flex1);
  const d = m.v(B.clone().sub(h), nB, 0, 1, ao1, flex1);
  m.tri(a, b, c); m.tri(a, c, d);
}

const girar = (v, eje, ang) => v.clone().applyAxisAngle(eje, ang);

/** Abeto o pícea. Devuelve el tronco (corteza) y la copa (tarjetas). */
function conifera(semilla, tipo, lod) {
  const rng = generador(semilla);
  const abeto = tipo === "abeto";
  const alto = abeto ? rng.rango(25, 31) : rng.rango(21, 26);
  const r0 = alto * rng.rango(0.016, 0.02);
  // LA COPA ARRANCA ARRIBA DE LA CÁMARA. En un bosque de verdad la pícea
  // barre el piso con las ramas; en un juego en tercera persona eso es la
  // cámara metida adentro de un árbol cada diez pasos. Por debajo de ~4 m
  // quedan solo los palitos secos, que sí son de verdad.
  const copaBase = Math.max(abeto ? 6.5 : 5.2, alto * (abeto ? rng.rango(0.24, 0.3) : rng.rango(0.17, 0.21)));
  const radioMax = alto * (abeto ? 0.19 : 0.175);
  const asp = abeto ? 0.8 : 0.59;          // ancho/alto de la foto de la rama
  const tr = new Malla(), co = new Malla();
  const inclina = V(rng.rango(-0.012, 0.012), 0, rng.rango(-0.012, 0.012));
  const curva = V(rng.rango(-1, 1), 0, rng.rango(-1, 1));
  tronco(tr, rng, { alto, r0, lados: lod === 0 ? 10 : 6, pisos: lod === 0 ? 10 : 5,
                    repU: 2, metroV: Math.PI * r0 * 2 / 2 * 1.4, inclina, curva });

  const paso = lod === 0 ? 1.0 : 1.9;
  // ramas muertas bajo la copa: palitos secos sin agujas, típicos de un
  // bosque cerrado donde abajo no llega el sol
  if (lod === 0) {
    for (let y = 2.2; y < copaBase; y += rng.rango(0.9, 1.6)) {
      const th = rng() * Math.PI * 2, L = rng.rango(0.5, 1.4);
      const o = V(inclina.x * y, y, inclina.z * y), H = V(Math.cos(th), 0, Math.sin(th));
      palo(tr, [o, o.clone().addScaledVector(H, L * 0.5).add(V(0, -0.05, 0)), o.clone().addScaledVector(H, L).add(V(0, -0.2, 0))], 0.03);
    }
  }
  for (let y = copaBase; y < alto * 0.965; y += paso * rng.rango(0.85, 1.15)) {
    const t = (y - copaBase) / (alto - copaBase);
    // el perfil de la copa: ancha abajo, en punta arriba, con la panza un
    // poco más arriba de la base (los pisos de abajo ya se están secando)
    const perfil = Math.pow(1 - t, 0.92) * (0.82 + 0.18 * suave(0, 0.18, t));
    const Lbase = radioMax * perfil + 0.3;
    const cuantas = lod === 0 ? rng.entero(4, 6) : 4;
    const giro0 = rng() * Math.PI * 2;
    const o = V(inclina.x * y, y, inclina.z * y);
    for (let k = 0; k < cuantas; k++) {
      const th = giro0 + (k / cuantas) * Math.PI * 2 + rng.rango(-0.3, 0.3);
      const L = Lbase * rng.rango(0.82, 1.14) * (lod === 0 ? 1 : 1.08);
      let cabeceo = mezcla(abeto ? -0.3 : -0.42, 0.3, t) + rng.rango(-0.08, 0.08);
      if (y + L * Math.tan(cabeceo) < 3.2) cabeceo = Math.atan((3.2 - y) / L);
      let caida = (abeto ? mezcla(0.3, 0.06, t) : mezcla(0.5, 0.12, t)) * rng.rango(0.8, 1.2);
      // la punta de la rama no baja de 3,2 m: por debajo camina el caminante y
      // pasa la cámara, y una rama colgando a la altura de los ojos es una
      // cortina verde que tapa la pantalla cada dos pasos
      const yPunta = y + L * Math.tan(cabeceo) - caida * L;
      if (yPunta < 3.2) caida = Math.max(0, (y + L * Math.tan(cabeceo) - 3.2) / L);
      const H = V(Math.cos(th), 0, Math.sin(th));
      const P = (s) => o.clone().addScaledVector(H, s * L).add(V(0, s * L * Math.tan(cabeceo) - caida * s * s * L, 0));
      if (lod === 0 && L > 0.8) palo(tr, [P(0), P(0.45), P(0.9)], Math.min(0.07, 0.025 + L * 0.012));
      // TARJETAS DEL TAMAÑO DE UNA RAMITA DE VERDAD. Una rama de abeto de 5 m
      // no es una foto de rama estirada a 5 m: son muchas ramitas de un metro
      // encimadas a lo largo del eje. Con una sola tarjeta grande cada aguja
      // salía del tamaño de un lápiz y el árbol parecía de cartón.
      const largoT = lod === 0 ? Math.min(1.35, 0.35 + L * 0.3) : Math.min(2.6, 0.5 + L * 0.55);
      const cuantasT = Math.max(1, Math.round((L * 0.95) / (largoT * 0.62)));
      const aoPiso = mezcla(0.5, 1.0, Math.pow(t, 0.7));
      for (let q = 0; q < cuantasT; q++) {
        const sc = mezcla(0.1, 0.98, cuantasT === 1 ? 0.5 : q / (cuantasT - 1));
        const ds = (largoT / L) * 0.5;
        const s0 = Math.max(0.02, sc - ds), s1 = Math.min(1.06, sc + ds);
        const A = P(s0), B = P(s1);
        const T = B.clone().sub(A).normalize();
        const lado0 = V().crossVectors(T, ARRIBA).normalize();
        const largo = A.distanceTo(B);
        const lado = girar(lado0, T, rng.rango(-0.4, 0.4));
        // hacia la punta las ramitas se abren un poco más
        const ancho = largo * asp * mezcla(0.9, 1.15, sc) * (lod === 0 ? 1 : 1.2);
        const ao0 = aoPiso * mezcla(0.5, 1, s0), ao1 = aoPiso * mezcla(0.5, 1, s1);
        tarjeta(co, A, B, lado, ancho, o, ao0, ao1, s0, s1);
        // la cruzada: más vertical, para que la rama tenga cuerpo vista de
        // costado a la altura de los ojos. En la pícea en todas, porque sus
        // ramitas cuelgan; en el abeto en una de cada dos.
        if (!abeto || q % 2 === 1 || lod > 0) {
          const lado2 = girar(lado, T, (abeto ? 1.1 : 1.0) * (rng() < 0.5 ? 1 : -1));
          tarjeta(co, A.clone().add(V(0, -0.05, 0)), B.clone().add(V(0, -0.1, 0)), lado2, ancho * 0.8, o, ao0 * 0.9, ao1 * 0.9, s0, s1);
        }
      }
    }
  }
  // la punta: dos tarjetas verticales cruzadas
  const punta = V(inclina.x * alto, alto * 0.94, inclina.z * alto);
  for (const th of [0, Math.PI / 2]) {
    tarjeta(co, punta.clone().add(V(0, -1.2, 0)), punta.clone().add(V(0, 1.4, 0)),
            V(Math.cos(th), 0, Math.sin(th)), 1.6, V(punta.x, 0, punta.z), 0.95, 1.05, 0.2, 0.5);
  }
  return { tronco: tr, copa: co, alto, r0, radio: radioMax, asp };
}

function abedul(semilla, lod) {
  const rng = generador(semilla);
  const alto = rng.rango(13, 18.5);
  const r0 = 0.012 * alto + rng.rango(0, 0.03);
  const tr = new Malla(), co = new Malla();
  const inclina = V(rng.rango(-0.03, 0.03), 0, rng.rango(-0.03, 0.03));
  const curva = V(rng.rango(-2, 2), 0, rng.rango(-2, 2));
  tronco(tr, rng, { alto, r0, lados: lod === 0 ? 8 : 5, pisos: lod === 0 ? 9 : 4,
                    repU: 1, metroV: 1.4, inclina, curva });
  const cuantas = lod === 0 ? rng.entero(17, 23) : 11;
  const eje = V(inclina.x * alto * 0.7, 0, inclina.z * alto * 0.7);
  for (let k = 0; k < cuantas; k++) {
    const t = rng.rango(0.02, 1);
    const y = alto * mezcla(0.36, 0.9, t);
    const th = rng() * Math.PI * 2;
    const L = alto * 0.24 * (1 - 0.55 * t) * rng.rango(0.75, 1.2);
    const sube = rng.rango(0.55, 0.95);            // las ramas del abedul van para arriba
    const H = V(Math.cos(th), 0, Math.sin(th));
    const o = V(inclina.x * y, y, inclina.z * y);
    const P = (s) => o.clone().addScaledVector(H, s * L * Math.cos(sube)).add(V(0, s * L * Math.sin(sube) - 0.25 * s * s * L, 0));
    if (lod === 0) palo(tr, [P(0), P(0.5), P(0.95)], 0.035 + L * 0.006);
    const hojas = lod === 0 ? 4 : 2;
    for (let h = 0; h < hojas; h++) {
      const s = mezcla(0.35, 1.0, (h + rng()) / hojas);
      const c = P(s);
      const tam = rng.rango(1.15, 1.75) * (lod === 0 ? 1 : 1.45);
      // cada racimo mira para cualquier lado, un poco hacia afuera y arriba:
      // así la copa del abedul se ve rala y se ve el cielo a través, como es
      const nrm = H.clone().multiplyScalar(0.6).add(V(rng.rango(-0.7, 0.7), rng.rango(0.2, 1.0), rng.rango(-0.7, 0.7))).normalize();
      const lado = V().crossVectors(nrm, ARRIBA).normalize();
      if (lado.lengthSq() < 0.01) lado.set(1, 0, 0);
      const T = V().crossVectors(lado, nrm).normalize();
      const A = c.clone().addScaledVector(T, -tam * 0.45), B = c.clone().addScaledVector(T, tam * 0.55);
      const ao = mezcla(0.62, 1.0, s) * mezcla(0.75, 1.05, t);
      tarjeta(co, A, B, lado, tam * 1.02, eje, ao, ao * 1.04, 0.4 + s * 0.4, 0.6 + s * 0.4);
    }
  }
  return { tronco: tr, copa: co, alto, r0, radio: alto * 0.24, asp: 1 };
}

// ── materiales ──────────────────────────────────────────────────────────
export const VIENTO = { uT: { value: 0 }, uViento: { value: 1 } };

/** El vaivén, igual para el tronco y para la copa. Si la copa se moviera y el
 *  tronco no, las ramas se despegarían del tronco en cada racha. */
const VAIVEN = `
  vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  float fase = iPos.x * 0.071 + iPos.z * 0.053;
  float racha = sin(uT * 0.9 + fase) * 0.6 + sin(uT * 2.1 + fase * 1.7) * 0.4;
  float altoRel = clamp(transformed.y / 26.0, 0.0, 1.2);
  transformed.xz += vec2(1.0, 0.6) * racha * uViento * altoRel * altoRel * 0.35;
`;
const TEMBLOR = `
  float tb = uT * 3.6 + fase * 3.0 + transformed.y * 0.7;
  transformed += vec3(sin(tb), cos(tb * 1.3) * 0.6, cos(tb * 0.9)) * aFlex * uViento * (0.045 + 0.03 * racha);
`;

function conViento(mat, conTemblor, extra) {
  const previo = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (previo) previo(sh, r);
    sh.uniforms.uT = VIENTO.uT; sh.uniforms.uViento = VIENTO.uViento;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
        uniform float uT; uniform float uViento; attribute float aFlex;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        #ifdef USE_INSTANCING
        ${VAIVEN}
        ${conTemblor ? TEMBLOR : ""}
        #endif`);
    if (extra) extra(sh);
  };
  return mat;
}

/** ALFA NÍTIDO EN TODOS LOS MIPS. Con alphaTest y mipmaps, el alfa se
 *  promedia al achicarse y de lejos casi nada pasa el umbral: el follaje se
 *  va desvaneciendo con la distancia hasta dejar el tronco pelado. Se
 *  compensa escalando el alfa según el nivel de mip que la tarjeta está
 *  usando (la corrección de Ben Golus). */
const ALFA_MIP = (tamTex) => `
  #ifdef USE_MAP
  {
    vec2 dx = dFdx(vMapUv * ${tamTex.toFixed(1)}), dy = dFdy(vMapUv * ${tamTex.toFixed(1)});
    float mip = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy))));
    diffuseColor.a *= 1.0 + mip * 0.28;
  }
  #endif
  #include <alphatest_fragment>`;

export const SOL_VISTA = { value: new THREE.Vector3(0, 0, -1) };
export const SOL_COLOR = { value: new THREE.Color(1, 0.8, 0.6) };

function materialFollaje(mapa, tamTex, brillo = 0.35) {
  const mat = new THREE.MeshStandardMaterial({
    map: mapa, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true,
    roughness: 0.82, metalness: 0,
  });
  conViento(mat, true, (sh) => {
    sh.uniforms.uContraSol = SOL_VISTA; sh.uniforms.uSolColor = SOL_COLOR;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
        uniform vec3 uContraSol; uniform vec3 uSolColor;`)
      // EL FOLLAJE QUE ROZA LA CÁMARA SE DESVANECE. Cuando la cámara queda
      // debajo de una rama, una sola tarjeta a 30 cm tapa media pantalla. Se
      // descartan sus pixeles con un tramado que depende de la distancia: se
      // ve como que la rama se abre, no como que desaparece de golpe.
      .replace("#include <alphatest_fragment>", `
        {
          float dCam = length(vViewPosition);
          float tram = fract(dot(floor(gl_FragCoord.xy), vec2(0.5, 0.25)) + fract(gl_FragCoord.y * 0.5) * 0.5);
          if (dCam < 0.7 + tram * 1.3) discard;
        }
      ` + ALFA_MIP(tamTex))
      // CONTRALUZ. Con el sol bajo detrás de una rama, las agujas se prenden:
      // la luz las atraviesa. Es lo que más dice "atardecer en el bosque" y
      // un material opaco no lo hace nunca. Se suma como luz propia, tapada
      // por el color del vértice para que el interior de la copa no brille.
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        {
          vec3 vista = normalize(-vViewPosition);
          float atras = pow(max(dot(-vista, uContraSol), 0.0), 5.0);
          totalEmissiveRadiance += diffuseColor.rgb * uSolColor * atras * ${brillo.toFixed(2)} * vColor.r;
        }`);
  });
  const prof = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: mapa, alphaTest: 0.5, side: THREE.DoubleSide });
  conViento(prof, true);
  return { mat, prof };
}

function materialCorteza(mapa, normal) {
  const mat = new THREE.MeshStandardMaterial({ map: mapa, normalMap: normal, roughness: 0.93, metalness: 0, vertexColors: true });
  conViento(mat, false);
  const prof = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  conViento(prof, false);
  return { mat, prof };
}

// ── la foto de lejos ────────────────────────────────────────────────────
function hornearLejos(renderer, v, mTronco, mCopa) {
  const W = 256, Hh = 512;
  const rt = new THREE.WebGLRenderTarget(W, Hh, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  const esc = new THREE.Scene();
  // Iluminación plana y de frente: la foto guarda el color con su oscuridad
  // interior (el color del vértice); la luz del atardecer se la pone después
  // el material, igual que al árbol de cerca.
  const basico = (m) => new THREE.MeshBasicMaterial({ map: m.map, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true });
  esc.add(new THREE.Mesh(v.geoTronco, basico(mTronco)));
  esc.add(new THREE.Mesh(v.geoCopa, basico(mCopa)));
  const ancho = v.radio * 2.3;
  const cam = new THREE.OrthographicCamera(-ancho / 2, ancho / 2, v.alto * 1.03, -0.02 * v.alto, 0.1, 200);
  cam.position.set(0, 0, 80); cam.lookAt(0, 0, 0);
  const antes = renderer.getRenderTarget(), color = renderer.getClearColor(new THREE.Color()), alfa = renderer.getClearAlpha();
  // EL FONDO VERDE Y NO NEGRO, con alfa cero. El mipmap promedia vecinos: con
  // fondo negro los bordes de la copa se oscurecen de lejos y cada árbol lejano
  // tiene un contorno de carbón.
  renderer.setClearColor(0x1d2a17, 0);
  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(esc, cam);
  renderer.setRenderTarget(antes);
  renderer.setClearColor(color, alfa);
  rt.texture.colorSpace = THREE.NoColorSpace;   // ya está en lineal
  return { tex: rt.texture, ancho, alto: v.alto * 1.05, bajo: -0.02 * v.alto };
}

function geoLejos(ancho, alto, bajo) {
  const m = new Malla();
  for (const th of [0, Math.PI / 2]) {
    const lado = V(Math.cos(th), 0, Math.sin(th)).multiplyScalar(ancho / 2);
    const n = V(0, 1, 0);
    const a = m.v(V(-lado.x, bajo, -lado.z), n, 0, 0, 1, 0), b = m.v(V(lado.x, bajo, lado.z), n, 1, 0, 1, 0);
    const c = m.v(V(lado.x, bajo + alto, lado.z), n, 1, 1, 1, 0.3), d = m.v(V(-lado.x, bajo + alto, -lado.z), n, 0, 1, 1, 0.3);
    m.tri(a, b, c); m.tri(a, c, d);
  }
  return m.geometria();
}

// ── dónde va cada árbol ─────────────────────────────────────────────────
function densidad(x, z) {
  const r = Math.hypot(x, z);
  if (r > 238) return 0;
  let d = 0.32 + 0.68 * suave(0.36, 0.6, fbm(x * 0.011 + 40, z * 0.011 - 12, 4, MUNDO.SEMILLA + 70));
  d *= suave(1.4, 4.2, aCamino(x, z));
  d *= suave(1.1, 1.32, enLago(x, z));
  const lejos = (L, r0, r1) => suave(r0, r1, Math.hypot(x - L.x, z - L.z));
  d *= lejos(LUGARES.claro, LUGARES.claro.radio * 0.7, LUGARES.claro.radio * 1.15);
  d *= lejos(LUGARES.cabana, 11, 17);
  d *= lejos(LUGARES.fogata, 7, 11);
  d *= lejos(LUGARES.muelle, 6, 10);
  d *= lejos(LUGARES.mirador, 9, 17);
  d *= lejos(LUGARES.inicio, 5, 9);
  d *= 1 - suave(0.4, 0.62, pendiente(x, z));
  // LA VISTA DEL MIRADOR. Subir al cerro para encontrarse con una pared de
  // abetos es el peor premio posible. En un abanico de ±22° desde la laja
  // hacia el lago, hasta 90 m, casi no crece nada: desde arriba se ve el agua.
  const M = LUGARES.mirador, Lg = LUGARES.lago;
  const vx = x - M.x, vz = z - M.z, dm = Math.hypot(vx, vz);
  if (dm < 90 && dm > 3) {
    const ax = Lg.x - M.x, az = Lg.z - M.z, la = Math.hypot(ax, az);
    const cos = (vx * ax + vz * az) / (dm * la);
    d *= 1 - 0.92 * suave(0.9, 0.95, cos) * (1 - suave(70, 90, dm));
  }
  return d;
}

function especieEn(x, z, rng) {
  const A = LUGARES.abedules;
  const bosqueAbedul = 1 - suave(A.radio * 0.6, A.radio * 1.3, Math.hypot(x - A.x, z - A.z));
  const dl = enLago(x, z);
  const orilla = suave(1.1, 1.25, dl) * (1 - suave(1.45, 1.9, dl));
  const pAbedul = 0.05 + 0.75 * bosqueAbedul + 0.45 * orilla;
  if (rng() < pAbedul) return "abedul";
  return fbm(x * 0.017 - 9, z * 0.017 + 4, 3, MUNDO.SEMILLA + 80) > 0.5 ? "picea" : "abeto";
}

export const ESPECIES = ["abeto", "picea", "abedul"];
export const VARIANTES = 2;

export class Bosque {
  constructor(renderer, tex, calidad) {
    this.cal = calidad;
    const t0 = performance.now();
    // --- las variantes, en sus dos niveles de detalle
    this.variantes = {};
    this.tris = {};
    for (const esp of ESPECIES) {
      this.variantes[esp] = [];
      for (let k = 0; k < VARIANTES; k++) {
        const semilla = 1000 + ESPECIES.indexOf(esp) * 100 + k * 7;
        const lods = [0, 1].map((lod) => esp === "abedul" ? abedul(semilla, lod) : conifera(semilla, esp, lod));
        this.variantes[esp].push(lods.map((l) => ({
          geoTronco: l.tronco.geometria(), geoCopa: l.copa.geometria(),
          alto: l.alto, r0: l.r0, radio: l.radio,
          tris: l.tronco.triangulos + l.copa.triangulos,
        })));
      }
      this.tris[esp] = this.variantes[esp].map((v) => v.map((l) => l.tris));
    }

    // --- materiales
    const corteza = {
      abeto: materialCorteza(tex.cortezaAbeto, tex.cortezaAbetoN),
      picea: materialCorteza(tex.cortezaAbeto, tex.cortezaAbetoN),
      abedul: materialCorteza(tex.cortezaAbedul, tex.cortezaAbedulN),
    };
    const follaje = {
      abeto: materialFollaje(tex.ramaAbeto, 1024),
      picea: materialFollaje(tex.ramaPicea, 1024),
      abedul: materialFollaje(tex.hojasAbedul, 512, 0.6),
    };
    for (const m of [...Object.values(corteza), ...Object.values(follaje)]) vestirNiebla(m.mat);

    // --- dónde
    this.arboles = this.sembrar();
    this.grilla = new Map();
    for (let i = 0; i < this.arboles.length; i++) {
      const a = this.arboles[i];
      const k = this.clave(a.x, a.z);
      if (!this.grilla.has(k)) this.grilla.set(k, []);
      this.grilla.get(k).push(i);
    }

    // --- las mallas instanciadas: una por especie, variante, nivel y parte
    this.grupo = new THREE.Group();
    this.grupo.name = "bosque";
    this.mallas = [];
    const cuenta = {};
    for (const a of this.arboles) cuenta[a.especie + a.variante] = (cuenta[a.especie + a.variante] || 0) + 1;
    this.porTipo = {};
    for (const esp of ESPECIES) {
      for (let k = 0; k < VARIANTES; k++) {
        const cap = Math.max(1, cuenta[esp + k] || 0);
        const lods = this.variantes[esp][k].map((l, lod) => {
          const tronco = new THREE.InstancedMesh(l.geoTronco, corteza[esp].mat, cap);
          const copa = new THREE.InstancedMesh(l.geoCopa, follaje[esp].mat, cap);
          tronco.customDepthMaterial = corteza[esp].prof;
          copa.customDepthMaterial = follaje[esp].prof;
          for (const im of [tronco, copa]) {
            im.frustumCulled = false; im.count = 0;
            im.castShadow = true; im.receiveShadow = true;
            im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            im.name = `${esp}${k}-lod${lod}`;
            this.grupo.add(im); this.mallas.push(im);
          }
          // los de media distancia no proyectan sombra: la caja de sombra
          // sigue al caminante y no llega hasta allá
          if (lod === 1) { tronco.castShadow = false; copa.castShadow = false; }
          return { tronco, copa };
        });
        this.porTipo[esp + k] = lods;
      }
      // la foto de lejos: una por especie, sacada de la variante 0 de medio
      const v = this.variantes[esp][0][1];
      const foto = hornearLejos(renderer, v, corteza[esp].mat, follaje[esp].mat);
      const matL = new THREE.MeshStandardMaterial({ map: foto.tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
      conViento(matL, false, (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace("#include <alphatest_fragment>", ALFA_MIP(512));
      });
      vestirNiebla(matL);
      let capL = 0;
      for (let k = 0; k < VARIANTES; k++) capL += cuenta[esp + k] || 0;
      const lejos = new THREE.InstancedMesh(geoLejos(foto.ancho, foto.alto, foto.bajo), matL, Math.max(1, capL));
      lejos.frustumCulled = false; lejos.count = 0;
      lejos.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      lejos.name = `${esp}-lejos`;
      this.grupo.add(lejos); this.mallas.push(lejos);
      this.porTipo[esp + "-lejos"] = { malla: lejos, escalaAlto: v.alto };
    }

    // la sombra de las copas sobre el suelo, para el terreno
    anotarSombra((x, z) => {
      let s = 0;
      this.cerca(x, z, 7, (a, d) => { s += Math.max(0, 1 - d / (a.radio * 0.9 + 1.5)) * (a.especie === "abedul" ? 0.35 : 0.7); });
      return Math.min(1, s);
    });

    this.ultimo = { x: 1e9, z: 1e9, dir: new THREE.Vector3() };
    this.ms = performance.now() - t0;
  }

  clave(x, z) { return Math.floor(x / 8) * 100003 + Math.floor(z / 8); }

  /** Recorre los árboles a menos de `r` metros de (x,z). */
  cerca(x, z, r, fn) {
    const i0 = Math.floor((x - r) / 8), i1 = Math.floor((x + r) / 8);
    const j0 = Math.floor((z - r) / 8), j1 = Math.floor((z + r) / 8);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const lista = this.grilla.get(i * 100003 + j);
      if (!lista) continue;
      for (const k of lista) {
        const a = this.arboles[k];
        const d = Math.hypot(a.x - x, a.z - z);
        if (d < r) fn(a, d);
      }
    }
  }

  sembrar() {
    const rng = generador(MUNDO.SEMILLA + 5);
    const CEL = 5.2;
    const lista = [];
    const ocupado = new Map();
    const k2 = (x, z) => Math.floor(x / 3) * 100003 + Math.floor(z / 3);
    const libre = (x, z, sep) => {
      const i = Math.floor(x / 3), j = Math.floor(z / 3);
      for (let a = i - 2; a <= i + 2; a++) for (let b = j - 2; b <= j + 2; b++) {
        const l = ocupado.get(a * 100003 + b);
        if (!l) continue;
        for (const o of l) if (Math.hypot(o.x - x, o.z - z) < sep) return false;
      }
      return true;
    };
    for (let x = -240; x < 240; x += CEL) {
      for (let z = -240; z < 240; z += CEL) {
        const px = x + rng() * CEL, pz = z + rng() * CEL;
        const d = densidad(px, pz);
        if (rng() > d) continue;
        const especie = especieEn(px, pz, rng);
        const variante = rng() < 0.5 ? 0 : 1;
        const escala = rng.rango(0.72, 1.18) * (especie === "abedul" ? 1 : mezcla(0.85, 1.08, d));
        const sep = especie === "abedul" ? 2.6 : 3.4 * escala;
        if (!libre(px, pz, sep)) continue;
        const v = this.variantes[especie][variante][0];
        const a = {
          x: px, z: pz, y: altura(px, pz), especie, variante, escala,
          giro: rng() * Math.PI * 2,
          alto: v.alto * escala, radio: v.radio * escala,
          // el tronco a medio metro del suelo: es lo que el caminante choca
          tronco: v.r0 * 1.25 * escala + 0.05,
          tinte: rng.rango(0.82, 1.12),
          matriz: new Float32Array(16),
        };
        const m = new THREE.Matrix4().compose(
          V(a.x, a.y - 0.05, a.z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.rango(-0.02, 0.02), a.giro, rng.rango(-0.02, 0.02))),
          V(escala, escala, escala));
        m.toArray(a.matriz);
        lista.push(a);
        const kk = k2(px, pz);
        if (!ocupado.has(kk)) ocupado.set(kk, []);
        ocupado.get(kk).push(a);
      }
    }
    return lista;
  }

  /** Reparte cada árbol en su nivel de detalle según la distancia a la
   *  cámara. Solo se rehace cuando la cámara se movió o giró de verdad:
   *  rehacerlo en cada cuadro sube a la tarjeta decenas de miles de números
   *  para dibujar lo mismo. */
  actualizar(cam, frustum, forzar = false) {
    const p = cam.position;
    const dir = cam.getWorldDirection(_dir);
    const u = this.ultimo;
    if (!forzar && Math.hypot(p.x - u.x, p.z - u.z) < 1.5 && dir.dot(u.dir) > Math.cos(0.12)) return;
    u.x = p.x; u.z = p.z; u.dir.copy(dir);

    const R0 = this.cal.arbolesCerca, R1 = this.cal.arbolesMedio;
    const SOMBRA = 30;     // cerca de la cámara todo entra, se vea o no: proyecta sombra
    const col = _col;
    for (const im of this.mallas) im.count = 0;
    let n0 = 0, n1 = 0, n2 = 0;
    for (const a of this.arboles) {
      const dx = a.x - p.x, dz = a.z - p.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > SOMBRA) {
        // LA ESFERA SE AGRANDA CON LA DISTANCIA: la lista se rehace recién
        // cuando la cámara giró 0,12 rad, así que un árbol recortado justo
        // afuera del borde de la pantalla aparecería de golpe al girar un
        // poco. Con el margen, lo que entra girando ya estaba en la lista.
        _esf.center.set(a.x, a.y + a.alto * 0.5, a.z); _esf.radius = a.alto * 0.6 + d * 0.16;
        if (!frustum.intersectsSphere(_esf)) continue;
      }
      col.setScalar(a.tinte);
      if (d < R1) {
        const lod = d < R0 ? 0 : 1;
        const par = this.porTipo[a.especie + a.variante][lod];
        for (const im of [par.tronco, par.copa]) {
          im.instanceMatrix.array.set(a.matriz, im.count * 16);
          im.setColorAt(im.count, col);
          im.count++;
        }
        lod === 0 ? n0++ : n1++;
      } else {
        const im = this.porTipo[a.especie + "-lejos"].malla;
        im.instanceMatrix.array.set(a.matriz, im.count * 16);
        im.setColorAt(im.count, col);
        im.count++;
        n2++;
      }
    }
    for (const im of this.mallas) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    this.visibles = [n0, n1, n2];
  }
}
const _dir = new THREE.Vector3(), _col = new THREE.Color(), _esf = new THREE.Sphere();

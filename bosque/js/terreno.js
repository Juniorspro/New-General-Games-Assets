// El suelo del bosque: lomas, el lago, el cerro del mirador y los senderos.
//
// ═══════════════════════════════════════════════════════════════════════════
// LA ALTURA SE CALCULA UNA VEZ Y SE GUARDA EN UNA REJILLA.
// ═══════════════════════════════════════════════════════════════════════════
// La tentación es tener una función `altura(x,z)` que evalúe el ruido y usarla
// para las dos cosas: levantar los vértices y apoyar al caminante. Está mal: la
// malla es PLANA entre vértice y vértice, así que en el medio de un cuadro lo
// que se ve queda por debajo de lo que dice la función. El caminante flota en
// las lomas y se hunde en los pozos, justo donde más se nota. Acá `altura()`
// interpola la MISMA rejilla con la que se arma la malla, triángulo por
// triángulo como la dibuja la tarjeta: se apoya sobre lo que se ve.
import * as THREE from "three";
import { MUNDO, LUGARES } from "./config.js";
import { fbm, crestas, ruido, suave, mezcla } from "./azar.js";
import { aCamino } from "./senderos.js";

const S = MUNDO.SEMILLA;
const N = MUNDO.CELDAS + 1;
const PASO = MUNDO.LADO / MUNDO.CELDAS;
const MEDIO = MUNDO.LADO / 2;

const ALT = new Float32Array(N * N);
// cuatro máscaras por vértice: sendero, musgo, pasto y sombra de copa. La
// última la llena arboles.js cuando ya sabe dónde quedó cada árbol.
const MEZ = new Float32Array(N * N * 4);

/** Máximo suave: une dos alturas sin la arista que deja Math.max. */
const smax = (a, b, k) => 0.5 * (a + b + Math.sqrt((a - b) * (a - b) + k));

/** Qué tan adentro del lago está un punto: <1 es agua. La orilla no es un
 *  círculo: el radio varía con el ángulo, y eso arma las bahías. */
export function enLago(x, z) {
  const L = LUGARES.lago;
  const dx = x - L.x, dz = z - L.z;
  const a = Math.atan2(dz, dx);
  const r = L.radio * (1 + 0.22 * (ruido(Math.cos(a) * 1.7 + 5, Math.sin(a) * 1.7 + 5, S + 3) - 0.5) * 2
                         + 0.08 * Math.sin(a * 3 + 1.2));
  return Math.sqrt(dx * dx + dz * dz) / r;
}

function alturaCruda(x, z) {
  // lomas grandes, con lomo
  let h = (fbm(x * 0.0052 + 13.1, z * 0.0052 - 7.3, 5, S) - 0.42) * 30;
  h += crestas(x * 0.0085 + 3.3, z * 0.0085 + 9.1, 3, S + 5) * 7;
  // el cerro del mirador: una loma alta con la cima un poco aplanada, donde
  // va la laja desde la que se ve el lago
  const M = LUGARES.mirador;
  const dm = Math.hypot(x - M.x, z - M.z) / M.radio;
  h += M.alto * Math.exp(-dm * dm * 1.3) * (1 - 0.15 * suave(0.0, 0.25, 0.25 - dm));

  // el piso nunca baja del agua fuera del lago: si no, cualquier pozo del
  // ruido sale como una laguna que no está en ningún lado del diseño
  h = smax(h, 1.3, 6);

  // el lago: un cuenco de 3,5 m de hondo, con la orilla bajando suave
  const d = enLago(x, z);
  const cerca = suave(1.05, 2.5, d);            // las lomas se achatan cerca del agua
  h = mezcla(1.1 + (h - 1.1) * 0.25, h, cerca);
  const cuenco = -3.6 * (1 - Math.min(1, d * d)) - 0.35;
  h = mezcla(cuenco, h, suave(0.82, 1.28, d));

  // el borde del mundo sube: el cerro que no deja ver dónde se termina todo
  const r = Math.hypot(x, z);
  if (r > 168) h += Math.pow((r - 168) / 26, 1.7) * 13;
  return h;
}

function detalle(x, z) {
  return (fbm(x * 0.06 + 1.7, z * 0.06 - 4.2, 3, S + 9) - 0.5) * 1.3
       + (ruido(x * 0.31, z * 0.31, S + 11) - 0.5) * 0.18;
}

function aplanar(h, x, z, lugar, radio, a) {
  const d = Math.hypot(x - lugar.x, z - lugar.z);
  return mezcla(a, h, suave(radio * 0.6, radio, d));
}

// ── la rejilla ──────────────────────────────────────────────────────────
const t0 = performance.now();
const hCabana = alturaCruda(LUGARES.cabana.x, LUGARES.cabana.z);
const hFogata = alturaCruda(LUGARES.fogata.x, LUGARES.fogata.z);
for (let j = 0; j < N; j++) {
  for (let i = 0; i < N; i++) {
    const x = -MEDIO + i * PASO, z = -MEDIO + j * PASO;
    const k = j * N + i;
    let h = alturaCruda(x, z);
    const cam = aCamino(x, z);
    // EL SENDERO NO LLEVA EL DETALLE. Es el suelo pisado: sin los bultos de un
    // metro que tiene el resto, y apenas hundido. Por eso se ve camino aunque
    // la textura se mezcle.
    const enCamino = 1 - suave(-0.3, 1.6, cam);
    h += detalle(x, z) * (1 - enCamino * 0.85) - enCamino * 0.07;
    h = aplanar(h, x, z, LUGARES.cabana, 13, hCabana + 0.1);
    h = aplanar(h, x, z, LUGARES.fogata, 6, hFogata);
    ALT[k] = h;

    // máscaras
    const q = k * 4;
    const borde = (ruido(x * 0.7, z * 0.7, S + 21) - 0.5) * 0.9;
    MEZ[q] = 1 - suave(-0.25, 0.75, cam + borde);
    const dl = enLago(x, z);
    const humedo = 1 - suave(1.0, 1.7, dl);
    const musgo = suave(0.5, 0.72, fbm(x * 0.021, z * 0.021, 3, S + 30)) * 0.85 + humedo * 0.4;
    MEZ[q + 1] = Math.min(1, musgo) * (1 - MEZ[q]);
    const C = LUGARES.claro;
    const claro = 1 - suave(C.radio * 0.55, C.radio * 1.1, Math.hypot(x - C.x, z - C.z));
    const orilla = suave(0.98, 1.08, dl) * (1 - suave(1.2, 1.5, dl));
    MEZ[q + 2] = Math.min(1, claro + orilla * 0.8) * (1 - MEZ[q]);
    MEZ[q + 3] = 0;
  }
}
export const MS_REJILLA = performance.now() - t0;

/** La altura del suelo, interpolada sobre el MISMO triángulo que se dibuja.
 *  Con bilineal en vez de por triángulo el error es de centímetros, pero en
 *  una loma empinada llega a 10 cm y los pies se entierran. */
export function altura(x, z) {
  const fi = (x + MEDIO) / PASO, fj = (z + MEDIO) / PASO;
  const i = Math.max(0, Math.min(N - 2, Math.floor(fi)));
  const j = Math.max(0, Math.min(N - 2, Math.floor(fj)));
  const u = Math.max(0, Math.min(1, fi - i)), v = Math.max(0, Math.min(1, fj - j));
  const a = ALT[j * N + i], b = ALT[j * N + i + 1];
  const c = ALT[(j + 1) * N + i], d = ALT[(j + 1) * N + i + 1];
  // PlaneGeometry arma los triángulos (a, c, b) y (c, d, b): la diagonal va
  // de c a b, o sea donde u + v = 1
  if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
  return d + (c - d) * (1 - u) + (b - d) * (1 - v);
}

/** La normal del suelo, por diferencias sobre la rejilla. */
export function normal(x, z, fuera = new THREE.Vector3()) {
  const e = PASO;
  return fuera.set(altura(x - e, z) - altura(x + e, z), 2 * e, altura(x, z - e) - altura(x, z + e)).normalize();
}

/** Pendiente: 0 plano, 1 vertical. */
export function pendiente(x, z) {
  return 1 - normal(x, z, _n).y;
}
const _n = new THREE.Vector3();

export function mascara(x, z, canal) {
  const i = Math.max(0, Math.min(N - 1, Math.round((x + MEDIO) / PASO)));
  const j = Math.max(0, Math.min(N - 1, Math.round((z + MEDIO) / PASO)));
  return MEZ[(j * N + i) * 4 + canal];
}

/** arboles.js anota acá cuánta copa hay encima de cada punto del suelo. */
export function anotarSombra(fn) {
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++)
      MEZ[(j * N + i) * 4 + 3] = fn(-MEDIO + i * PASO, -MEDIO + j * PASO);
}

// ── la malla y su material ──────────────────────────────────────────────
export const TEXELES_POR_METRO = 1 / 3.2;   // una baldosa de suelo mide 3,2 m

export function armaTerreno(tex) {
  const g = new THREE.PlaneGeometry(MUNDO.LADO, MUNDO.LADO, MUNDO.CELDAS, MUNDO.CELDAS);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, uv = g.attributes.uv;
  // después de rotateX(-π/2) la fila j de PlaneGeometry avanza en +z y la
  // columna i en +x: el mismo orden en que se llenó ALT. Se copia por índice.
  for (let k = 0; k < pos.count; k++) {
    pos.setY(k, ALT[k]);
    uv.setXY(k, pos.getX(k) * TEXELES_POR_METRO, -pos.getZ(k) * TEXELES_POR_METRO);
  }
  g.computeVertexNormals();
  g.setAttribute("aMezcla", new THREE.BufferAttribute(MEZ, 4));
  g.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({
    map: tex.suelo, normalMap: tex.sueloN, roughness: 0.94, metalness: 0,
    normalScale: new THREE.Vector2(1.1, 1.1),
  });
  const U = {
    tMusgo: { value: tex.musgo }, tMusgoN: { value: tex.musgoN },
    tSendero: { value: tex.sendero }, tSenderoN: { value: tex.senderoN },
    tRoca: { value: tex.roca }, tRocaN: { value: tex.rocaN },
    tRuido: { value: tex.ruido },
    uAgua: { value: MUNDO.AGUA },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
        attribute vec4 aMezcla;
        varying vec4 vMezcla;
        varying vec3 vPosW;
        varying vec3 vNormW;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vMezcla = aMezcla;
        vPosW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vNormW = normal;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
        uniform sampler2D tMusgo, tMusgoN, tSendero, tSenderoN, tRoca, tRocaN, tRuido;
        uniform float uAgua;
        varying vec4 vMezcla;
        varying vec3 vPosW;
        varying vec3 vNormW;
        float gRugo;
        float gW[4];      // pesos: musgo, pasto, sendero, roca
        // MEZCLA POR ALTURA: en vez de fundir dos texturas con un degradé
        // parejo (que da una franja borrosa, como pintura aguada), gana la que
        // "sobresale" más en cada pixel. La hojarasca se mete entre el musgo
        // por las grietas, que es lo que pasa en un bosque de verdad.
        float porAltura(float hA, float hB, float t) {
          float a = hA * (1.0 - t), b = hB * t;
          float m = max(a, b) - 0.12;
          float wa = max(a - m, 0.0), wb = max(b - m, 0.0);
          return wb / max(wa + wb, 1e-4);
        }
        float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }`)
      .replace("#include <map_fragment>", `
        vec2 uvS = vMapUv;
        // SUELO CON DOS ESCALAS: una baldosa de 3,2 m repetida mil veces se
        // ve como un empapelado desde cualquier loma. Un ruido grande mezcla
        // la baldosa con ella misma girada y a otra escala: la repetición
        // sigue estando, pero ya no forma una grilla que el ojo encuentre.
        float macro = texture2D(tRuido, vPosW.xz / 71.0).r;
        float macro2 = texture2D(tRuido, vPosW.xz / 23.0 + 0.37).r;
        vec2 uvG = mat2(0.8, -0.6, 0.6, 0.8) * uvS * 0.43 + 0.31;
        vec4 cA = texture2D(map, uvS);
        vec4 cB = texture2D(map, uvG);
        vec3 col = mix(cA.rgb, cB.rgb, smoothstep(0.35, 0.65, macro));

        vec3 cMusgo = texture2D(tMusgo, uvS * 1.3).rgb;
        vec3 cSendero = texture2D(tSendero, uvS * 1.15).rgb;
        vec3 cRoca = texture2D(tRoca, vPosW.xz / 4.5 + vec2(0.0, vPosW.y / 4.5)).rgb;
        // el pasto del claro: el mismo musgo, más amarillo y seco
        vec3 cPasto = cMusgo * vec3(1.18, 1.08, 0.62);

        float pend = 1.0 - normalize(vNormW).y;
        float wRoca = smoothstep(0.30, 0.44, pend + (macro2 - 0.5) * 0.14);
        float wMusgo = porAltura(lum(col), lum(cMusgo) * 1.1, clamp(vMezcla.y + (macro2 - 0.5) * 0.3, 0.0, 1.0));
        float wPasto = porAltura(lum(col), lum(cPasto), vMezcla.z);
        float wSendero = porAltura(lum(col) * 0.9, lum(cSendero) + 0.05, vMezcla.x);
        col = mix(col, cMusgo, wMusgo);
        col = mix(col, cPasto, wPasto);
        col = mix(col, cSendero, wSendero);
        col = mix(col, cRoca, wRoca);

        // variación de tono a escala de decenas de metros: manchones más secos
        // y más oscuros, como el piso de un bosque de verdad
        col *= mix(0.78, 1.12, macro) * mix(0.92, 1.05, macro2);
        // debajo de las copas el piso está más oscuro y más húmedo
        col *= mix(1.0, 0.62, vMezcla.w);

        // la orilla mojada: más oscura y más lisa (brilla)
        float moja = 1.0 - smoothstep(uAgua + 0.05, uAgua + 0.55, vPosW.y);
        col *= mix(1.0, 0.55, moja);
        // bajo el agua se tiñe hacia el verde barro del fondo
        float hondo = 1.0 - smoothstep(uAgua - 2.5, uAgua - 0.05, vPosW.y);
        col = mix(col, col * vec3(0.45, 0.5, 0.38), hondo);

        gW[0] = wMusgo; gW[1] = wPasto; gW[2] = wSendero; gW[3] = wRoca;
        gRugo = mix(0.95, 0.8, wSendero) ;
        gRugo = mix(gRugo, 0.72, wRoca);
        gRugo = mix(gRugo, 0.32, moja);
        diffuseColor.rgb *= col;`)
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = gRugo;")
      .replace("#include <normal_fragment_maps>", `
        vec3 nS = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
        vec3 nM = texture2D(tMusgoN, vNormalMapUv * 1.3).xyz * 2.0 - 1.0;
        vec3 nP = texture2D(tSenderoN, vNormalMapUv * 1.15).xyz * 2.0 - 1.0;
        vec3 nR = texture2D(tRocaN, vPosW.xz / 4.5 + vec2(0.0, vPosW.y / 4.5)).xyz * 2.0 - 1.0;
        vec3 mapN = nS;
        mapN = mix(mapN, nM, gW[0]);
        mapN = mix(mapN, nM * vec3(0.6, 0.6, 1.0), gW[1]);
        mapN = mix(mapN, nP, gW[2]);
        mapN = mix(mapN, nR * vec3(1.4, 1.4, 1.0), gW[3]);
        mapN.xy *= normalScale;
        normal = normalize(tbn * mapN);`);
  };
  mat.customProgramCacheKey = () => "terreno-v1";

  const malla = new THREE.Mesh(g, mat);
  malla.receiveShadow = true;
  malla.name = "terreno";
  return malla;
}

/** Textura de ruido para el shader: 256² con fbm que se repite, así el
 *  manchón grande no tiene costura cada 71 m. */
export function texturaRuido() {
  const L = 256, datos = new Uint8Array(L * L * 4);
  for (let j = 0; j < L; j++) for (let i = 0; i < L; i++) {
    // ruido periódico: se evalúa sobre un toro (dos círculos) para que el
    // borde derecho sea igual al izquierdo sin fundir nada
    const a = (i / L) * Math.PI * 2, b = (j / L) * Math.PI * 2;
    const v = fbm(Math.cos(a) * 2.2 + Math.cos(b) * 0.9 + 9, Math.sin(a) * 2.2 + Math.sin(b) * 1.3 + 9, 4, S + 50);
    const w = fbm(Math.cos(b) * 2.6 + 3, Math.sin(b) * 2.6 + Math.cos(a) * 1.1 + 3, 4, S + 60);
    const q = (j * L + i) * 4;
    datos[q] = Math.round(Math.min(1, Math.max(0, (v - 0.25) * 2)) * 255);
    datos[q + 1] = Math.round(Math.min(1, Math.max(0, (w - 0.25) * 2)) * 255);
    datos[q + 2] = datos[q]; datos[q + 3] = 255;
  }
  const t = new THREE.DataTexture(datos, L, L, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export const REJILLA = { N, PASO, MEDIO, ALT };

// Los bloques y las bombas: cómo se ven, y las mitades que vuelan al cortar.
//
// POR QUÉ LAS MITADES NO SON GEOMETRÍA NUEVA. Cortar la malla en dos con el
// procesador (triángulos partidos, tapas armadas) cuesta y falla en los bordes.
// Acá cada mitad es EL MISMO bloque con un plano de corte en su espacio
// local: el shader descarta lo que queda del otro lado. Como el plano viaja
// con la mitad (es local), no hay que actualizarlo aunque gire.
//
// Y LA TAPA SALE GRATIS. Al descartar media caja se ven por dentro las caras
// de atrás de la otra media. Si las caras de atrás se pintan de un color
// plano, el ojo lee una tapa maciza: es el truco clásico, sirve porque el
// bloque es convexo.
//
// Todos los bloques de un color (enteros y mitades) son UNA malla instanciada:
// dos llamadas de dibujo para cien bloques.

import * as THREE from "../vendor/three.module.min.js";

export const TAM = 0.5;          // lado del bloque, en metros
const CAPACIDAD = 96;

function cajaRedondeada(radio = 0.16) {
  // Los vértices no van parejos: en la cara plana alcanza con uno al medio, y
  // en el bisel se reparten por ángulo (tres pasos cada 45°). Con la grilla
  // pareja de BoxGeometry el bisel queda con una o dos filas y se ve facetado.
  const h = 0.5, lim = h - radio;
  const pasos = [Math.tan(Math.PI / 12), Math.tan(Math.PI / 6), 1].map(k => lim + radio * k);
  const eje = [-pasos[2], -pasos[1], -pasos[0], -lim, 0, lim, pasos[0], pasos[1], pasos[2]];
  const g = new THREE.BoxGeometry(1, 1, 1, 8, 8, 8);
  const p = g.attributes.position, n = g.attributes.normal;
  const v = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3();
  const mapear = (u) => eje[Math.round((u + 0.5) * 8)];
  for (let i = 0; i < p.count; i++) {
    v.set(mapear(p.getX(i)), mapear(p.getY(i)), mapear(p.getZ(i)));
    c.set(THREE.MathUtils.clamp(v.x, -lim, lim), THREE.MathUtils.clamp(v.y, -lim, lim), THREE.MathUtils.clamp(v.z, -lim, lim));
    d.subVectors(v, c);
    if (d.lengthSq() > 1e-10) {
      d.normalize();
      v.copy(c).addScaledVector(d, radio);
      n.setXYZ(i, d.x, d.y, d.z);
    }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

const VS_BLOQUE = /* glsl */`
attribute vec4 aCorte;
attribute vec4 aDatos;
varying vec3 vLocal; varying vec3 vNormalL; varying vec3 vNormal; varying vec3 vMundo;
varying vec4 vCorte; varying vec4 vDatos;
void main() {
  vLocal = position; vNormalL = normal; vCorte = aCorte; vDatos = aDatos;
  mat4 m = modelMatrix * instanceMatrix;
  vec4 w = m * vec4(position, 1.0);
  vMundo = w.xyz;
  vNormal = normalize(mat3(m) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FS_BLOQUE = /* glsl */`
uniform vec3 uColor; uniform vec3 uBorde; uniform vec3 uLuz; uniform vec3 uLuz2;
varying vec3 vLocal; varying vec3 vNormalL; varying vec3 vNormal; varying vec3 vMundo;
varying vec4 vCorte; varying vec4 vDatos;

float sdTriangulo(vec2 p, vec2 a, vec2 b, vec2 c) {
  vec2 e0 = b - a, e1 = c - b, e2 = a - c;
  vec2 v0 = p - a, v1 = p - b, v2 = p - c;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
                   vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
                   vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
// Estrella de cuatro puntas (el brillo del centro, como en el video).
float estrella(vec2 p, float s) {
  p = abs(p) / s;
  return 1.0 - smoothstep(0.85, 1.0, sqrt(p.x) + sqrt(p.y));
}

void main() {
  // El corte: lo que queda del otro lado del plano no existe.
  if (dot(vLocal, vCorte.xyz) + vCorte.w < 0.0) discard;
  // Desvanecer por tramado: sin ordenar transparencias ni romper el brillo.
  float alfa = vDatos.z;
  if (alfa < 0.999) {
    float u = fract(dot(floor(gl_FragCoord.xy), vec2(0.0671, 0.00583)) * 52.9829);
    if (u > alfa) discard;
  }
  if (!gl_FrontFacing) {
    // La tapa: un color plano algo más claro, que se lee como el interior.
    gl_FragColor = vec4(uColor * 0.5 + uBorde * 0.18, 1.0);
    return;
  }
  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vMundo);
  vec3 nl = abs(vNormalL);
  float plano = max(nl.x, max(nl.y, nl.z));
  float bisel = clamp((1.0 - plano) * 2.6, 0.0, 1.0);

  // Reflejo falso del escenario: arriba la luz del fondo, abajo casi negro.
  // Tenue a propósito: si el bloque refleja mucho se lava y la flecha blanca
  // deja de leerse (pasó: el dorado salía color crema).
  vec3 r = reflect(-v, n);
  vec3 ambiente = mix(vec3(0.01), uLuz * 0.42 + vec3(0.03), smoothstep(-0.35, 0.85, r.y));
  ambiente += uLuz2 * 0.12 * smoothstep(0.2, -0.6, r.y);
  float especular = pow(max(dot(r, normalize(vec3(-0.35, 0.75, 0.55))), 0.0), 26.0);
  float dif = 0.4 + 0.6 * max(dot(n, normalize(vec3(-0.3, 0.8, 0.6))), 0.0);

  vec2 uv = vLocal.xy / 0.5;
  float frente = step(0.9, vNormalL.z);
  float panza = 1.0 - 0.2 * dot(uv, uv) * frente;

  vec3 c = uColor * dif * panza * 0.85 + uColor * ambiente * 1.6;
  c += uBorde * bisel * (0.28 + 0.5 * ambiente.g);
  c += vec3(1.0) * especular * (0.35 + bisel * 0.8);

  // Símbolos de la cara de adelante.
  if (frente > 0.5) {
    float flecha = vDatos.x;
    float brillo = vDatos.y;
    float e = estrella(uv - vec2(0.0, flecha > 0.5 ? 0.12 : 0.0), flecha > 0.5 ? 0.3 : 0.44);
    float tri = 0.0;
    if (flecha > 0.5) {
      float d = sdTriangulo(uv, vec2(-0.56, -0.42), vec2(0.56, -0.42), vec2(0.0, -0.8));
      tri = 1.0 - smoothstep(-0.01, 0.03, d);
    }
    float s = max(e, tri);
    c = mix(c, vec3(1.0, 0.98, 0.95) * (1.5 + 1.6 * brillo), s);
  }
  // Cuando se puede cortar, el bloque se calienta apenas.
  c += uColor * vDatos.y * 0.22;
  gl_FragColor = vec4(c, 1.0);
}`;

function matBloque(color, borde) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uBorde: { value: new THREE.Color(borde) },
      uLuz: { value: new THREE.Color(0.5, 0.3, 1) },
      uLuz2: { value: new THREE.Color(0.3, 0.4, 1) },
    },
    vertexShader: VS_BLOQUE, fragmentShader: FS_BLOQUE, side: THREE.DoubleSide,
  });
}

function geoBomba() {
  const nucleo = new THREE.IcosahedronGeometry(0.2, 2);
  const partes = [nucleo];
  const dir = new THREE.Vector3();
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const pos = ico.attributes.position;
  const vistos = new Set();
  for (let i = 0; i < pos.count; i++) {
    dir.fromBufferAttribute(pos, i).normalize();
    const k = dir.toArray().map(x => x.toFixed(2)).join(",");
    if (vistos.has(k)) continue;
    vistos.add(k);
    const pua = new THREE.ConeGeometry(0.05, 0.16, 5);
    pua.translate(0, 0.25, 0);
    pua.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    partes.push(pua);
  }
  const planas = partes.map(g => g.toNonIndexed());
  let n = 0; for (const g of planas) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
  let o = 0;
  for (const g of planas) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(N, 3));
  return g;
}

function matBomba() {
  return new THREE.ShaderMaterial({
    uniforms: { uLuz: { value: new THREE.Color(0.5, 0.3, 1) } },
    vertexShader: /* glsl */`
      attribute vec4 aDatos;
      varying vec3 vN; varying vec3 vW; varying float vA;
      void main() {
        mat4 m = modelMatrix * instanceMatrix;
        vec4 w = m * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(m) * normal); vA = aDatos.z;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uLuz;
      varying vec3 vN; varying vec3 vW; varying float vA;
      void main() {
        if (vA < 0.999) { float u = fract(dot(floor(gl_FragCoord.xy), vec2(0.0671, 0.00583)) * 52.9829); if (u > vA) discard; }
        vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 2.5);
        vec3 r = reflect(-v, n);
        float esp = pow(max(dot(r, normalize(vec3(-0.3, 0.8, 0.5))), 0.0), 30.0);
        vec3 c = vec3(0.02) + uLuz * fres * 0.5 + vec3(0.9) * esp + vec3(0.25, 0.02, 0.05) * fres;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

export class Bloques {
  constructor(escena) {
    const geo = cajaRedondeada();
    this.corte = new Float32Array(CAPACIDAD * 4);
    this.datos = new Float32Array(CAPACIDAD * 4);
    this.mallas = [
      this._malla(geo.clone(), matBloque("#94712a", "#ffe39a")),       // dorado
      this._malla(geo.clone(), matBloque("#4b20c8", "#b99dff")),       // violeta
    ];
    for (const m of this.mallas) escena.add(m);
    const gb = geoBomba();
    this.bomba = new THREE.InstancedMesh(gb, matBomba(), 32);
    this.bomba.count = 0;
    this.bomba.frustumCulled = false;
    this.datosBomba = new Float32Array(32 * 4);
    gb.setAttribute("aDatos", new THREE.InstancedBufferAttribute(this.datosBomba, 4).setUsage(THREE.DynamicDrawUsage));
    escena.add(this.bomba);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3(TAM, TAM, TAM);
    this._e = new THREE.Euler();
  }

  _malla(geo, mat) {
    const m = new THREE.InstancedMesh(geo, mat, CAPACIDAD);
    geo.setAttribute("aCorte", new THREE.InstancedBufferAttribute(new Float32Array(CAPACIDAD * 4), 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aDatos", new THREE.InstancedBufferAttribute(new Float32Array(CAPACIDAD * 4), 4).setUsage(THREE.DynamicDrawUsage));
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    m.frustumCulled = false;
    return m;
  }

  /** La luz del escenario también se refleja en los bloques. */
  ponerLuz(c1, c2) {
    for (const m of this.mallas) { m.material.uniforms.uLuz.value.copy(c1); m.material.uniforms.uLuz2.value.copy(c2); }
    this.bomba.material.uniforms.uLuz.value.copy(c1);
  }

  /** Vuelca la lista del cuadro: [{color, pos, quat, corte:[x,y,z,w], flecha, brillo, alfa, escala}] */
  dibujar(items, bombas) {
    const cuenta = [0, 0];
    for (const it of items) {
      const m = this.mallas[it.color];
      const i = cuenta[it.color];
      if (i >= CAPACIDAD) continue;
      const esc = TAM * (it.escala ?? 1);
      this._s.set(esc, esc, esc);
      this._m.compose(it.pos, it.quat, this._s);
      m.setMatrixAt(i, this._m);
      const ac = m.geometry.attributes.aCorte.array, ad = m.geometry.attributes.aDatos.array;
      const k = it.corte;
      ac[i * 4] = k ? k[0] : 0; ac[i * 4 + 1] = k ? k[1] : 0; ac[i * 4 + 2] = k ? k[2] : 0; ac[i * 4 + 3] = k ? k[3] : 1;
      ad[i * 4] = it.flecha ? 1 : 0; ad[i * 4 + 1] = it.brillo || 0; ad[i * 4 + 2] = it.alfa ?? 1; ad[i * 4 + 3] = 0;
      cuenta[it.color]++;
    }
    for (let c = 0; c < 2; c++) {
      const m = this.mallas[c];
      m.count = cuenta[c];
      m.instanceMatrix.needsUpdate = true;
      m.geometry.attributes.aCorte.needsUpdate = true;
      m.geometry.attributes.aDatos.needsUpdate = true;
    }
    let nb = 0;
    for (const b of bombas) {
      if (nb >= 32) break;
      this._s.set(1, 1, 1);
      this._m.compose(b.pos, b.quat, this._s);
      this.bomba.setMatrixAt(nb, this._m);
      this.datosBomba[nb * 4 + 2] = b.alfa ?? 1;
      nb++;
    }
    this.bomba.count = nb;
    this.bomba.instanceMatrix.needsUpdate = true;
    this.bomba.geometry.attributes.aDatos.needsUpdate = true;
  }
}

// El terreno: una grilla de alturas de 1 m, modificable con la pala.
//
// UNA sola grilla sirve para la malla y para la física, y la altura se
// interpola POR TRIÁNGULO igual que la dibuja la placa: con una función de
// altura aparte, el jugador flota en las lomas y se hunde en los pozos.
import * as THREE from '../vendor/three.module.min.js';
import { fbm2, lim, suavizado } from './azar.js';
import { matTerreno } from './material.js';

export const TAM = 256;            // metros de lado (de -128 a 128)
export const MITAD = TAM / 2;
export const N = TAM + 1;          // vértices por lado
const CHUNK = 32;                  // metros por chunk
const NCH = TAM / CHUNK;
const RES_MAT = 2;                 // texels del mapa de materiales por metro
const NM = TAM * RES_MAT;

export class Terreno {
  constructor(semilla, tex) {
    this.semilla = semilla;
    this.alturas = new Float32Array(N * N);
    this.base = new Float32Array(N * N);   // lo generado: para guardar solo diferencias
    this.mat = new Uint8Array(NM * NM * 4); // R pasto, G tierra
    this.matBase = null;
    this.generar();
    this.matBase = this.mat.slice();

    this.texMat = new THREE.DataTexture(this.mat, NM, NM, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.texMat.magFilter = THREE.LinearFilter; this.texMat.minFilter = THREE.LinearFilter;
    this.texMat.needsUpdate = true;
    // Alturas para el agua (espuma de orilla y color por profundidad).
    this.hf = new Uint16Array(N * N);
    this.texAltura = new THREE.DataTexture(this.hf, N, N, THREE.RedFormat, THREE.HalfFloatType);
    this.texAltura.magFilter = THREE.LinearFilter; this.texAltura.minFilter = THREE.LinearFilter;
    this.actualizarTexAltura();

    this.material = matTerreno(this.texMat, [-MITAD, -MITAD, 1 / TAM, 1 / TAM], tex);
    this.grupo = new THREE.Group();
    this.chunks = [];
    for (let cz = 0; cz < NCH; cz++) for (let cx = 0; cx < NCH; cx++) {
      const geo = this.geoChunk(cx, cz);
      const malla = new THREE.Mesh(geo, this.material);
      malla.receiveShadow = true;
      malla.castShadow = true;
      malla.userData.terreno = true;
      this.grupo.add(malla);
      this.chunks.push(malla);
    }
    // El fondo del mar más allá de la grilla, para que no se vea el borde.
    const lecho = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), this.material);
    lecho.position.y = -9.5;
    this.grupo.add(lecho);
    this.sucios = new Set();
  }

  // ── la isla ───────────────────────────────────────────────────────────────
  alturaGenerada(x, z) {
    const s = this.semilla;
    const r = Math.hypot(x, z), th = Math.atan2(z, x);
    const costa = 80 + 16 * (fbm2(Math.cos(th) * 1.4 + 5, Math.sin(th) * 1.4 + 5, s, 3) - 0.5) * 2
      + 6 * Math.sin(3 * th + 1.3) + 3 * Math.sin(7 * th);
    const d = r - costa;                                  // negativo tierra adentro
    let h = -8.5 + 9.6 * suavizado(26, -8, d);           // del lecho a la meseta
    h += 0.9 * suavizado(-6, -26, d);                     // sube de a poco lejos de la costa
    // lomas suaves tierra adentro
    h += (fbm2(x * 0.018 + 11, z * 0.018 - 7, s + 3, 4) - 0.45) * 5.5 * suavizado(-10, -40, d);
    // el cerro de la mina
    const mx = this.cerro.x, mz = this.cerro.z;
    h += 11 * Math.exp(-((x - mx) ** 2 + (z - mz) ** 2) / (2 * 17 * 17));
    // laguna: una bahía de agua baja
    const lx = this.laguna.x, lz = this.laguna.z;
    const dl = Math.hypot(x - lx, z - lz);
    h = Math.min(h, h - 3.2 * suavizado(24, 6, dl));
    // playa: aplana la franja de la orilla
    const playa = suavizado(-14, -2, d) * suavizado(10, 0, d);
    h = h * (1 - playa * 0.55) + 0.35 * playa * 0.55;
    // arrecife y bajos en el mar: el agua turquesa necesita fondos de 1-3 m
    h += 1.4 * (fbm2(x * 0.04, z * 0.04, s + 9, 3) - 0.5) * suavizado(2, 16, d) * suavizado(40, 16, d);
    return h;
  }

  generar() {
    const s = this.semilla;
    // lugares fijos de la isla, derivados de la semilla
    const a = (s % 628) / 100;
    this.cerro = { x: Math.cos(a) * 36, z: Math.sin(a) * 36 };
    this.laguna = { x: Math.cos(a + 2.6) * 74, z: Math.sin(a + 2.6) * 74 };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const h = this.alturaGenerada(i - MITAD, j - MITAD);
      this.alturas[j * N + i] = h;
      this.base[j * N + i] = h;
    }
    // materiales: pasto donde está alto y no es playa
    for (let j = 0; j < NM; j++) for (let i = 0; i < NM; i++) {
      const x = i / RES_MAT - MITAD, z = j / RES_MAT - MITAD;
      const h = this.alturaExacta(x, z);
      const n = fbm2(x * 0.08, z * 0.08, s + 21, 3);
      let pasto = suavizado(1.05, 1.7, h + (n - 0.5) * 1.1);
      // senderos de arena que atraviesan el pasto
      const sendero = Math.abs(fbm2(x * 0.02 + 40, z * 0.02, s + 33, 2) - 0.5);
      pasto *= suavizado(0.012, 0.04, sendero);
      const k = (j * NM + i) * 4;
      this.mat[k] = Math.round(lim(pasto, 0, 1) * 255);
      this.mat[k + 1] = 0; this.mat[k + 2] = 0; this.mat[k + 3] = 255;
    }
  }

  // ── consultas ─────────────────────────────────────────────────────────────
  alturaExacta(x, z) {
    const fx = lim(x + MITAD, 0, TAM - 1e-4), fz = lim(z + MITAD, 0, TAM - 1e-4);
    const i = Math.floor(fx), j = Math.floor(fz);
    const u = fx - i, v = fz - j;
    const A = this.alturas;
    const h00 = A[j * N + i], h10 = A[j * N + i + 1], h01 = A[(j + 1) * N + i], h11 = A[(j + 1) * N + i + 1];
    // mismo corte que la malla: diagonal de (i+1, j) a (i, j+1)
    if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
    return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  }

  altura(x, z) {
    if (Math.abs(x) > MITAD || Math.abs(z) > MITAD) return -9.5;
    return this.alturaExacta(x, z);
  }

  normal(x, z, out = new THREE.Vector3()) {
    const e = 0.5;
    return out.set(this.altura(x - e, z) - this.altura(x + e, z), 2 * e, this.altura(x, z - e) - this.altura(x, z + e)).normalize();
  }

  pasto(x, z) { return this.leerMat(x, z, 0); }
  tierra(x, z) { return this.leerMat(x, z, 1); }
  leerMat(x, z, canal) {
    const i = Math.floor((x + MITAD) * RES_MAT), j = Math.floor((z + MITAD) * RES_MAT);
    if (i < 0 || j < 0 || i >= NM || j >= NM) return 0;
    return this.mat[(j * NM + i) * 4 + canal] / 255;
  }

  // ── la malla ──────────────────────────────────────────────────────────────
  geoChunk(cx, cz) {
    const n = CHUNK + 1;
    const pos = new Float32Array(n * n * 3);
    const nor = new Float32Array(n * n * 3);
    const uv = new Float32Array(n * n * 2);
    const idx = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i;
      uv[k * 2] = i / CHUNK; uv[k * 2 + 1] = j / CHUNK;
      if (i < CHUNK && j < CHUNK) {
        const a = k, b = k + 1, c = k + n, d = k + n + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.userData = { cx, cz };
    this.llenarChunk(geo);
    return geo;
  }

  llenarChunk(geo) {
    const { cx, cz } = geo.userData;
    const n = CHUNK + 1;
    const pos = geo.attributes.position.array, nor = geo.attributes.normal.array;
    const A = this.alturas;
    const H = (i, j) => A[lim(j, 0, N - 1) * N + lim(i, 0, N - 1)];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const gi = cx * CHUNK + i, gj = cz * CHUNK + j;
      const k = (j * n + i) * 3;
      pos[k] = gi - MITAD; pos[k + 1] = H(gi, gj); pos[k + 2] = gj - MITAD;
      const nx = H(gi - 1, gj) - H(gi + 1, gj), nz = H(gi, gj - 1) - H(gi, gj + 1);
      const l = Math.hypot(nx, 2, nz);
      nor[k] = nx / l; nor[k + 1] = 2 / l; nor[k + 2] = nz / l;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
  }

  actualizarTexAltura(i0 = 0, j0 = 0, i1 = N - 1, j1 = N - 1) {
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      this.hf[j * N + i] = THREE.DataUtils.toHalfFloat(this.alturas[j * N + i]);
    }
    this.texAltura.needsUpdate = true;
  }

  // ── la pala ───────────────────────────────────────────────────────────────
  /**
   * Aplica un pincel. tipo: 'subir' | 'bajar' | 'aplanar' | 'suavizar'.
   * Devuelve los metros cúbicos que cambió (+ agregados, − sacados): la piedra
   * que cuesta o que devuelve sale de acá.
   */
  pincel(x, z, radio, fuerza, tipo, alturaObjetivo = 0, limiteAgregar = Infinity) {
    const i0 = Math.max(1, Math.floor(x - radio + MITAD)), i1 = Math.min(N - 2, Math.ceil(x + radio + MITAD));
    const j0 = Math.max(1, Math.floor(z - radio + MITAD)), j1 = Math.min(N - 2, Math.ceil(z + radio + MITAD));
    const A = this.alturas;
    let volumen = 0;
    const previo = tipo === 'suavizar' ? A.slice() : null;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = i - MITAD - x, dz = j - MITAD - z;
      const d = Math.hypot(dx, dz) / radio;
      if (d >= 1) continue;
      const w = (1 - d * d) * (1 - d * d);
      const k = j * N + i;
      let nuevo = A[k];
      if (tipo === 'subir') nuevo += fuerza * w;
      else if (tipo === 'bajar') nuevo -= fuerza * w;
      else if (tipo === 'aplanar') nuevo += (alturaObjetivo - A[k]) * Math.min(1, fuerza * w * 1.5);
      else if (tipo === 'suavizar') {
        const prom = (previo[k - 1] + previo[k + 1] + previo[k - N] + previo[k + N] + previo[k] * 4) / 8;
        nuevo += (prom - A[k]) * Math.min(1, fuerza * w * 3);
      }
      nuevo = lim(nuevo, -9, 24);
      let dv = nuevo - A[k];
      if (dv > 0 && volumen + dv > limiteAgregar) dv = Math.max(0, limiteAgregar - volumen);
      A[k] += dv;
      volumen += dv;
    }
    this.marcarSucio(i0, j0, i1, j1);
    return volumen;
  }

  marcarSucio(i0, j0, i1, j1) {
    for (let cz = Math.floor((j0 - 1) / CHUNK); cz <= Math.floor((j1 + 1) / CHUNK); cz++)
      for (let cx = Math.floor((i0 - 1) / CHUNK); cx <= Math.floor((i1 + 1) / CHUNK); cx++)
        if (cx >= 0 && cz >= 0 && cx < NCH && cz < NCH) this.sucios.add(cz * NCH + cx);
    this.rangoAltura = this.rangoAltura
      ? [Math.min(this.rangoAltura[0], i0), Math.min(this.rangoAltura[1], j0), Math.max(this.rangoAltura[2], i1), Math.max(this.rangoAltura[3], j1)]
      : [i0, j0, i1, j1];
  }

  // Pintar materiales: pasto (canal 0) o tierra (canal 1) en un radio.
  pintarMat(x, z, radio, canal, valor) {
    const i0 = Math.max(0, Math.floor((x - radio + MITAD) * RES_MAT)), i1 = Math.min(NM - 1, Math.ceil((x + radio + MITAD) * RES_MAT));
    const j0 = Math.max(0, Math.floor((z - radio + MITAD) * RES_MAT)), j1 = Math.min(NM - 1, Math.ceil((z + radio + MITAD) * RES_MAT));
    let cambio = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d = Math.hypot(i / RES_MAT - MITAD - x, j / RES_MAT - MITAD - z) / radio;
      if (d >= 1) continue;
      const k = (j * NM + i) * 4 + canal;
      const v = Math.round(valor * 255);
      if (this.mat[k] !== v) { cambio += Math.abs(this.mat[k] - v) / 255; this.mat[k] = v; }
    }
    if (cambio > 0) this.texMat.needsUpdate = true;
    return cambio;
  }

  // La guadaña: donde hay pasto queda tierra; la arena no se toca. Devuelve
  // los metros cuadrados cortados.
  cortarPasto(x, z, radio) {
    const i0 = Math.max(0, Math.floor((x - radio + MITAD) * RES_MAT)), i1 = Math.min(NM - 1, Math.ceil((x + radio + MITAD) * RES_MAT));
    const j0 = Math.max(0, Math.floor((z - radio + MITAD) * RES_MAT)), j1 = Math.min(NM - 1, Math.ceil((z + radio + MITAD) * RES_MAT));
    let n = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (Math.hypot(i / RES_MAT - MITAD - x, j / RES_MAT - MITAD - z) >= radio) continue;
      const k = (j * NM + i) * 4;
      if (this.mat[k] > 127) { this.mat[k] = 0; this.mat[k + 1] = 255; n++; }
    }
    if (n) this.texMat.needsUpdate = true;
    return n / (RES_MAT * RES_MAT);
  }

  // Rehace lo que cambió. Se llama una vez por cuadro, no por pincelada.
  actualizar() {
    if (!this.sucios.size) return false;
    for (const k of this.sucios) this.llenarChunk(this.chunks[k].geometry);
    this.sucios.clear();
    if (this.rangoAltura) {
      const [i0, j0, i1, j1] = this.rangoAltura;
      this.actualizarTexAltura(Math.max(0, i0 - 1), Math.max(0, j0 - 1), Math.min(N - 1, i1 + 1), Math.min(N - 1, j1 + 1));
      this.rangoAltura = null;
    }
    return true;
  }

  // ── guardar solo lo que cambió ────────────────────────────────────────────
  diferencias() {
    const cambios = [];
    for (let k = 0; k < this.alturas.length; k++) {
      const d = Math.round((this.alturas[k] - this.base[k]) * 100);
      if (d !== 0) cambios.push(k, d);
    }
    const mats = [];
    for (let k = 0; k < this.mat.length; k += 4) {
      if (this.mat[k] !== this.matBase[k] || this.mat[k + 1] !== this.matBase[k + 1]) mats.push(k >> 2, this.mat[k], this.mat[k + 1]);
    }
    return { a: cambios, m: mats };
  }

  aplicarDiferencias(dif) {
    if (!dif) return;
    const a = dif.a || [];
    for (let i = 0; i + 1 < a.length; i += 2) {
      const k = a[i];
      if (k >= 0 && k < this.alturas.length && Number.isFinite(a[i + 1])) this.alturas[k] = this.base[k] + a[i + 1] / 100;
    }
    const m = dif.m || [];
    for (let i = 0; i + 2 < m.length; i += 3) {
      const k = m[i] * 4;
      if (k >= 0 && k < this.mat.length) { this.mat[k] = m[i + 1] & 255; this.mat[k + 1] = m[i + 2] & 255; }
    }
    for (let k = 0; k < this.chunks.length; k++) this.sucios.add(k);
    this.rangoAltura = [0, 0, N - 1, N - 1];
    this.texMat.needsUpdate = true;
    this.actualizar();
  }
}

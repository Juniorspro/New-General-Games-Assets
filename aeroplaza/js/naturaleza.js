/* ============================================================================
   aeroplaza/js/naturaleza.js — las piezas con las que se arman los reinos:
   terreno con textura (pasto y arena de Rezona), agua transparente con
   cáusticas y espuma, pasto que se mueve con el viento y se aparta cuando
   pasa el muñeco, flores, árboles redondos y brillosos, palmeras, piedras,
   burbujas tornasoladas y vidrio.
   Todo lo que se repite va instanciado: un árbol o mil cuestan una llamada.
   ========================================================================== */
import * as THREE from 'three';
import { instancias } from './modelos.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { azar } from './mundo.js';

export const TEX = {};            // las texturas de Rezona que haya (las carga main.js)
export const RELOJ = { t: 0 };     // el tiempo para los shaders (lo avanza main.js)
export const JUGADOR = new THREE.Vector3(); // dónde está el muñeco (el pasto se aparta)
const blanca = () => { const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.needsUpdate = true; return t; };

/* los shaders que dependen del tiempo leen estos uniformes compartidos */
export const UNI = { uT: { value: 0 }, uJugador: { value: JUGADOR }, uViento: { value: 1 } };

/* ------------------------------------------------------------------ terreno */
/* altura(x, z) → malla. color(x, z, h, pendiente) → [r, g, b, arena 0..1] */
export function terreno(altura, { tam = 260, seg = 220, centro = [0, 0], color }) {
  const g = new THREE.PlaneGeometry(tam, tam, seg, seg).rotateX(-Math.PI / 2);
  const p = g.attributes.position, n = p.count;
  const col = new Float32Array(n * 3), arena = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = p.getX(i) + centro[0], z = p.getZ(i) + centro[1];
    const h = altura(x, z);
    p.setXYZ(i, x, h, z);
  }
  g.computeVertexNormals();
  const nr = g.attributes.normal;
  for (let i = 0; i < n; i++) {
    const c = color(p.getX(i), p.getZ(i), p.getY(i), 1 - nr.getY(i));
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; arena[i] = c[3] || 0;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aArena', new THREE.BufferAttribute(arena, 1));
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
  const U = { uPasto: { value: TEX.pasto || blanca() }, uArena: { value: TEX.arena || blanca() }, uHayTex: { value: TEX.pasto ? 1 : 0 } };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aArena; varying float vArena; varying vec2 vMundo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvArena = aArena; vMundo = position.xz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vArena; varying vec2 vMundo; uniform sampler2D uPasto, uArena; uniform float uHayTex;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (uHayTex > 0.5) {
          /* la textura solo pone el detalle: se divide por su promedio (el último mip)
             y el color de verdad lo da el vértice. Dos escalas: se nota menos la repetición */
          vec3 tp = texture2D(uPasto, vMundo * 0.11).rgb * 0.6 + texture2D(uPasto, vMundo * 0.023 + 0.37).rgb * 0.4;
          vec3 mp = texture2D(uPasto, vec2(0.5), 12.0).rgb;
          vec3 ta = texture2D(uArena, vMundo * 0.16).rgb, ma = texture2D(uArena, vec2(0.5), 12.0).rgb;
          vec3 dp = tp / max(mp, vec3(0.04)), da = ta / max(ma, vec3(0.04));
          diffuseColor.rgb *= mix(mix(vec3(1.0), dp, 0.75), mix(vec3(1.0), da, 0.6), vArena);
        }`);
  };
  const malla = new THREE.Mesh(g, m);
  malla.receiveShadow = true;
  return malla;
}

/* --------------------------------------------------------------------- agua */
/* la profundidad se hornea en una textura (el terreno es una función), así el
   agua sabe dónde es playa, dónde va la espuma y dónde se ven las cáusticas */
export function agua(nivel, altura, { tam = 3000, rect = [-150, -150, 300], colorPlaya = '#3ff0dd', colorHondo = '#0a4fb0' } = {}) {
  const N = 256, datos = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = rect[0] + (i + 0.5) / N * rect[2], z = rect[1] + (j + 0.5) / N * rect[2];
    datos[j * N + i] = Math.max(0, Math.min(255, (nivel - altura(x, z)) * 20));
  }
  const prof = new THREE.DataTexture(datos, N, N, THREE.RedFormat, THREE.UnsignedByteType);
  prof.magFilter = THREE.LinearFilter; prof.minFilter = THREE.LinearFilter; prof.needsUpdate = true;
  const U = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uProf: { value: prof }, uRect: { value: new THREE.Vector3(...rect) }, uSol: { value: new THREE.Vector3(0, 1, 0) },
    uCenit: { value: new THREE.Color('#2a7fff') }, uHor: { value: new THREE.Color('#bfe6ff') }, uSolCol: { value: new THREE.Color('#fff4e0') },
    uPlaya: { value: new THREE.Color(colorPlaya) }, uHondo: { value: new THREE.Color(colorHondo) }, uDia: { value: 1 },
    uTexAgua: { value: TEX['motivo-agua'] || blanca() }, uHayTex: { value: TEX['motivo-agua'] ? 1 : 0 },
  }]);
  U.uT = UNI.uT;
  const m = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, fog: true,
    vertexShader: /* glsl */`
      varying vec3 vMundo;
      #include <fog_pars_vertex>
      void main() {
        vec4 mp = modelMatrix * vec4(position, 1.0); vMundo = mp.xyz;
        vec4 mvPosition = viewMatrix * mp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uProf, uTexAgua; uniform vec3 uRect, uSol, uCenit, uHor, uSolCol, uPlaya, uHondo; uniform float uT, uDia, uHayTex;
      varying vec3 vMundo;
      #include <fog_pars_fragment>
      vec2 grad(vec2 p) {
        /* cuatro trenes de olas chicas: la derivada da la normal */
        vec2 g = vec2(0.0);
        vec4 D1 = vec4(0.8, 0.6, 0.9, 1.3), D2 = vec4(-0.5, 0.86, 1.7, 1.9), D3 = vec4(0.2, -0.98, 3.1, 2.7), D4 = vec4(-0.9, -0.3, 5.3, 3.3);
        g += D1.xy * cos(dot(p, D1.xy) * D1.z + uT * D1.w) * 0.10;
        g += D2.xy * cos(dot(p, D2.xy) * D2.z + uT * D2.w) * 0.07;
        g += D3.xy * cos(dot(p, D3.xy) * D3.z + uT * D3.w) * 0.045;
        g += D4.xy * cos(dot(p, D4.xy) * D4.z + uT * D4.w) * 0.03;
        return g;
      }
      void main() {
        vec2 uvp = (vMundo.xz - uRect.xy) / uRect.z;
        float prof = (uvp.x < 0.0 || uvp.y < 0.0 || uvp.x > 1.0 || uvp.y > 1.0) ? 12.0 : texture2D(uProf, uvp).r * 12.75;
        vec2 g = grad(vMundo.xz);
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(cameraPosition - vMundo);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        vec3 R = reflect(-V, n);
        vec3 cielo = mix(uHor, uCenit, clamp(R.y * 2.5 + 0.25, 0.0, 1.0));
        float k = 1.0 - exp(-prof * 0.28);
        vec3 col = mix(uPlaya, uHondo, k) * (0.35 + 0.65 * uDia);
        /* el dibujo del agua de Rezona, suave, encima */
        if (uHayTex > 0.5) { vec3 t = texture2D(uTexAgua, vMundo.xz * 0.045 + g * 0.3 + vec2(uT * 0.01, 0.0)).rgb; col *= 0.75 + t * 0.45; }
        /* cáusticas en lo bajo: líneas claras que se mueven */
        vec2 q = vMundo.xz * 0.7;
        float c1 = abs(sin(q.x + sin(q.y * 1.3 + uT * 0.9) * 1.4 + uT * 0.4)), c2 = abs(sin(q.y * 1.1 + sin(q.x * 0.9 - uT * 0.7) * 1.3 - uT * 0.3));
        float caus = pow(1.0 - min(c1, c2), 8.0) * (1.0 - smoothstep(0.2, 3.5, prof));
        col += vec3(0.7, 1.0, 1.0) * caus * 0.55 * uDia;
        col = mix(col, cielo, fres * 0.6);
        /* el brillo del sol en las olas */
        float sp = pow(max(dot(R, uSol), 0.0), 260.0) * 7.0 + pow(max(dot(R, uSol), 0.0), 30.0) * 0.25;
        col += uSolCol * sp * smoothstep(-0.05, 0.1, uSol.y);
        /* la espuma de la orilla, que va y viene */
        float esp = smoothstep(0.45, 0.0, prof + sin(uT * 1.3 + vMundo.x * 0.35 + vMundo.z * 0.21) * 0.08);
        esp *= 0.55 + 0.45 * sin(vMundo.x * 3.1 + uT * 2.0) * sin(vMundo.z * 2.7 - uT * 1.6);
        col = mix(col, vec3(1.0), clamp(esp, 0.0, 1.0) * 0.85);
        float a = mix(0.35, 0.93, smoothstep(0.0, 3.0, prof));
        a = max(a, fres * 0.9); a = max(a, esp * 0.9);
        gl_FragColor = vec4(col, a);
        #include <fog_fragment>
      }`,
  });
  const malla = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam, 1, 1).rotateX(-Math.PI / 2), m);
  malla.position.y = nivel;
  malla.renderOrder = 2;
  malla.userData.U = U;
  return malla;
}
/* el agua copia los colores del cielo */
export function aguaSigueCielo(malla, cielo) {
  const U = malla.userData.U;
  U.uSol.value.copy(cielo.U.uSol.value);
  U.uCenit.value.copy(cielo.U.uCenit.value); U.uHor.value.copy(cielo.U.uHorizonte.value);
  U.uDia.value = Math.max(0.2, cielo.dia);
  U.uSolCol.value.copy(cielo.sol.color);
}

/* -------------------------------------------------------------------- pasto */
function mataDePasto() {
  const r = azar(5), partes = [];
  for (let b = 0; b < 5; b++) {
    const a = r() * Math.PI * 2, alto = 0.13 + r() * 0.13, ancho = 0.03 + r() * 0.015, curva = 0.04 + r() * 0.07;
    const ox = Math.cos(a) * 0.08, oz = Math.sin(a) * 0.08;
    const pos = [], col = [];
    const S = 2;
    for (let i = 0; i <= S; i++) {
      const t = i / S, w = ancho * (1 - t * 0.92), y = alto * t, d = curva * t * t;
      for (const s of [-1, 1]) {
        pos.push(ox + Math.cos(a) * d + Math.cos(a + Math.PI / 2) * w * s, y, oz + Math.sin(a) * d + Math.sin(a + Math.PI / 2) * w * s);
        const k = 0.38 + t * 0.62;
        col.push(0.2 * k + t * 0.25, 0.55 * k + t * 0.35, 0.08 * k);
      }
    }
    const idx = [];
    for (let i = 0; i < S; i++) { const q = i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    partes.push(g);
  }
  const g = mergeGeometries(partes);
  g.computeVertexNormals();
  /* las normales para arriba: el pasto se ilumina como el suelo y no parpadea */
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}
/* el viento (y el muñeco que aparta el pasto) en el shader de vértices */
export function conViento(m, fuerza = 1) {
  m.customProgramCacheKey = () => 'viento' + fuerza.toFixed(2);
  m.onBeforeCompile = (s) => {
    s.uniforms.uT = UNI.uT; s.uniforms.uJugador = UNI.uJugador; s.uniforms.uViento = UNI.uViento;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uT, uViento; uniform vec3 uJugador;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec3 base = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          #else
            vec3 base = vec3(modelMatrix[3].x, 0.0, modelMatrix[3].z);   // (sin instancias: la palmera suelta)
          #endif
          float h = max(position.y, 0.0);
          float fase = dot(base.xz, vec2(0.21, 0.17));
          vec2 v = vec2(sin(uT * 1.7 + fase) + sin(uT * 2.9 + fase * 1.7) * 0.4, cos(uT * 1.3 + fase * 0.8) * 0.5) * 0.09 * uViento * ${fuerza.toFixed(2)};
          vec2 dj = base.xz - uJugador.xz; float dd = length(dj);
          vec2 aparta = dd < 0.9 && abs(base.y - uJugador.y) < 1.0 ? dj / max(dd, 0.05) * (0.9 - dd) * 0.5 : vec2(0.0);
          transformed.xz += (v + aparta) * h * 2.2;
          transformed.y -= length(aparta) * h * 0.6;
        }`);
  };
}
/* El pasto de cerca: una grilla de matas alrededor del muñeco que se "enrolla"
   (cada mata tiene un lugar fijo en el mundo, repetido cada 2R metros), así hay
   pasto tupido donde se mira y nada lejos, donde la textura del suelo alcanza.
   La altura del terreno y dónde puede haber pasto van horneados en una textura,
   porque el shader de vértices no puede llamar a altura(x, z). */
export function pasto(altura, donde, { n = 14000, area = [-150, -150, 300], R = 26, sem = 11 } = {}) {
  const N = 256, datos = new Float32Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = area[0] + (i + 0.5) / N * area[2], z = area[1] + (j + 0.5) / N * area[2], k = (j * N + i) * 4;
    datos[k] = altura(x, z); datos[k + 1] = donde(x, z) ? 1 : 0;
  }
  const mapa = new THREE.DataTexture(datos, N, N, THREE.RGBAFormat, THREE.FloatType);
  mapa.magFilter = mapa.minFilter = THREE.NearestFilter; mapa.needsUpdate = true;
  const base = mataDePasto();
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.attributes = base.attributes;
  const r = azar(sem), inst = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { inst[i * 4] = r() * 2 * R; inst[i * 4 + 1] = r() * 2 * R; inst[i * 4 + 2] = r() * 6.2832; inst[i * 4 + 3] = 0.7 + r() * 0.8; }
  g.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 4));
  g.instanceCount = n;
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const U = { uMapa: { value: mapa }, uArea: { value: new THREE.Vector3(...area) }, uR: { value: R } };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.uniforms.uT = UNI.uT; s.uniforms.uJugador = UNI.uJugador; s.uniforms.uViento = UNI.uViento;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aInst; uniform sampler2D uMapa; uniform vec3 uArea; uniform float uR, uT, uViento; uniform vec3 uJugador;
        /* bilineal a mano: la textura es de flotantes y no todas las placas la filtran */
        vec2 mapa(vec2 p) {
          vec2 q = (p - uArea.xy) / uArea.z * 256.0 - 0.5; vec2 i = floor(q), f = fract(q);
          vec2 a = texture2D(uMapa, (i + 0.5) / 256.0).rg, b = texture2D(uMapa, (i + vec2(1.5, 0.5)) / 256.0).rg;
          vec2 c = texture2D(uMapa, (i + vec2(0.5, 1.5)) / 256.0).rg, d = texture2D(uMapa, (i + 1.5) / 256.0).rg;
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec2 base = uJugador.xz + mod(aInst.xy - uJugador.xz + uR, 2.0 * uR) - uR;
          vec2 hm = mapa(base);
          float lejos = length(base - uJugador.xz) / uR;
          float esc = aInst.w * step(0.5, hm.y) * (1.0 - smoothstep(0.7, 1.0, lejos));
          float c = cos(aInst.z), s = sin(aInst.z);
          vec3 p = vec3(transformed.x * c - transformed.z * s, transformed.y, transformed.x * s + transformed.z * c) * esc;
          float h = max(p.y, 0.0);
          float fase = dot(base, vec2(0.21, 0.17));
          vec2 v = vec2(sin(uT * 1.7 + fase) + sin(uT * 2.9 + fase * 1.7) * 0.4, cos(uT * 1.3 + fase * 0.8) * 0.5) * 0.09 * uViento;
          vec2 dj = base - uJugador.xz; float dd = length(dj);
          vec2 aparta = dd < 0.8 && abs(hm.x - uJugador.y) < 1.0 ? dj / max(dd, 0.05) * (0.8 - dd) * 0.7 : vec2(0.0);
          p.xz += (v + aparta) * h * 2.6;
          p.y -= length(aparta) * h * 0.8;
          transformed = p + vec3(base.x, hm.x - 0.02, base.y);
        }`);
  };
  const malla = new THREE.Mesh(g, m);
  malla.frustumCulled = false; malla.receiveShadow = true;
  return malla;
}

/* ------------------------------------------------------------------- flores */
export function flores(altura, donde, { n = 900, area = [-120, -120, 240], sem = 21, colores = ['#ffffff', '#ffd1ec', '#fff27a', '#b9e3ff', '#ffb0b0', '#e3c7ff'] } = {}) {
  /* la flor: una forma plana de cinco pétalos, apenas ahuecada (~40 triángulos
     en vez de 500 de cinco esferas: con 1.400 flores eran la mitad de la isla) */
  const forma = new THREE.Shape();
  for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 2, r = 0.05 + 0.055 * Math.pow(Math.abs(Math.cos(a * 2.5)), 0.7); const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i === 0) forma.moveTo(x, y); else forma.lineTo(x, y); }
  const gP = new THREE.ShapeGeometry(forma, 1).rotateX(-Math.PI / 2);
  { const p = gP.attributes.position; for (let i = 0; i < p.count; i++) { const d = Math.hypot(p.getX(i), p.getZ(i)); p.setY(i, d * d * 4); } gP.computeVertexNormals(); }
  gP.translate(0, 0.2, 0);
  const tallo = new THREE.CylinderGeometry(0.008, 0.01, 0.2, 4, 1, true); tallo.translate(0, 0.1, 0);
  const gC = new THREE.SphereGeometry(0.03, 6, 4); gC.scale(1, 0.6, 1); gC.translate(0, 0.21, 0);
  const mP = new THREE.MeshStandardMaterial({ roughness: 0.4, side: THREE.DoubleSide }), mC = new THREE.MeshStandardMaterial({ color: '#ffc21f', roughness: 0.4, emissive: '#ff9d00', emissiveIntensity: 0.15 }), mT = new THREE.MeshLambertMaterial({ color: '#3f9a2a' });
  for (const m of [mP, mC, mT]) conViento(m, 0.6);
  const iP = new THREE.InstancedMesh(gP, mP, n), iC = new THREE.InstancedMesh(gC, mC, n), iT = new THREE.InstancedMesh(tallo, mT, n);
  const r = azar(sem), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), P = new THREE.Vector3(), c = new THREE.Color();
  let k = 0, intentos = 0;
  while (k < n && intentos < n * 40) {
    intentos++;
    const x = area[0] + r() * area[2], z = area[1] + r() * area[2];
    if (!donde(x, z)) continue;
    /* en manchones: cerca de otra flor es más probable */
    const esc = 0.8 + r() * 0.9;
    M.compose(P.set(x, altura(x, z) - 0.01, z), q.setFromEuler(e.set((r() - 0.5) * 0.3, r() * 6.28, (r() - 0.5) * 0.3)), s.set(esc, esc, esc));
    iP.setMatrixAt(k, M); iC.setMatrixAt(k, M); iT.setMatrixAt(k, M);
    iP.setColorAt(k, c.set(colores[Math.floor(r() * colores.length)]));
    k++;
  }
  const g = new THREE.Group();
  for (const i of [iP, iC, iT]) { i.count = k; i.frustumCulled = false; g.add(i); }
  return g;
}

/* ---------------------------------------------------- árboles redondos (aero) */
/* el árbol y la palmera se arman en construcciones.js (copiando las referencias de Rezona) */
/* el borde que brilla (fresnel) en cualquier material estándar */
export function conBorde(m, color = '#ffffff', fuerza = 0.5, pot = 3.0) {
  const prev = m.onBeforeCompile;
  /* three reusa el programa si la "clave" es igual, y la de fábrica es el texto de
     onBeforeCompile: igual para todos los conBorde aunque cambie pot o lo de antes
     (el viento). Por eso la clave dice qué lleva */
  const clave = m.customProgramCacheKey();
  m.customProgramCacheKey = () => clave + '|borde' + pot.toFixed(1);
  m.onBeforeCompile = (s, r) => {
    if (prev) prev(s, r);
    s.uniforms.uBordeCol = { value: new THREE.Color(color) }; s.uniforms.uBorde = { value: fuerza };
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uBordeCol; uniform float uBorde;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uBordeCol * pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), ${pot.toFixed(1)}) * uBorde;`);
  };
  return m;
}
/* lugares: [[x, z, escala]]. variante: 'arbol' (el de burbujas lima) o 'arbolRosa'.
   tintes claros: multiplican el color de cada copia, para que no sean iguales */
export function arboles(altura, lugares, { variante = 'arbol', tintes = ['#ffffff', '#e4ffd8', '#fff6d0', '#d8fff0'] } = {}) {
  return instancias(variante, lugares.map(([x, z, esc = 1], i) => [x, altura(x, z) - 0.15, z, esc, i * 2.4]), { alto: 5.4, tintes }) || new THREE.Group();
}
/* lugares: [[x, z, escala, giro]]; las hojas se mueven con el viento */
export function palmeras(altura, lugares) {
  return instancias('palmera', lugares.map(([x, z, esc = 1, rot = 0]) => [x, altura(x, z) - 0.2, z, esc, rot]), { alto: 6.8 }) || new THREE.Group();
}

/* ------------------------------------------------------------------- piedras */
export function piedras(altura, lugares, color = '#b9cfe0') {
  const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, r = azar(3);
  for (let i = 0; i < p.count; i++) { const k = 0.85 + Math.sin(p.getX(i) * 3.1 + p.getZ(i) * 2.3) * 0.08 + r() * 0.04; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.62, p.getZ(i) * k); }
  g.computeVertexNormals();
  const m = conBorde(new THREE.MeshStandardMaterial({ color, roughness: 0.28 }), '#ffffff', 0.25);
  const im = new THREE.InstancedMesh(g, m, lugares.length);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), P = new THREE.Vector3();
  lugares.forEach(([x, z, esc = 1], i) => { M.compose(P.set(x, altura(x, z) + esc * 0.1, z), q.setFromEuler(e.set(0, i * 1.7, 0)), s.set(esc, esc, esc * 0.9)); im.setMatrixAt(i, M); });
  im.castShadow = true; im.receiveShadow = true;
  return im;
}

/* ------------------------------------------------------------ burbuja y vidrio */
/* la película de jabón: tornasol que cambia con el ángulo y el tiempo */
export function materialBurbuja(opacidad = 1) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uT: UNI.uT, uOp: { value: opacidad } },
    vertexShader: /* glsl */`
      varying vec3 vN, vV; varying float vF;
      void main() {
        #ifdef USE_INSTANCING
          vec4 mp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        #else
          vec4 mp = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
        #endif
        vV = normalize(cameraPosition - mp.xyz); vF = position.y;
        gl_Position = projectionMatrix * viewMatrix * mp;
      }`,
    fragmentShader: /* glsl */`
      uniform float uT, uOp; varying vec3 vN, vV; varying float vF;
      void main() {
        vec3 n = normalize(vN);
        float c = 1.0 - abs(dot(n, vV));
        float f = pow(c, 2.2);
        float fase = c * 5.0 + vF * 3.0 + uT * 0.6;
        vec3 tor = 0.55 + 0.45 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + fase));
        vec3 col = tor * f * 1.4 + vec3(1.0) * pow(c, 7.0) * 0.8;
        /* el brillo de la ventana */
        vec3 L = normalize(vec3(0.4, 0.8, 0.3));
        float spec = pow(max(dot(reflect(-vV, n), L), 0.0), 60.0);
        col += vec3(1.0) * spec * 2.5;
        gl_FragColor = vec4(col, clamp((f * 0.85 + spec + 0.04) * uOp, 0.0, 1.0));
      }`,
  });
}
/* vidrio: casi invisible de frente y con el borde claro (si no, el reflejo del
   cielo lo vuelve una niebla blanca cuando se lo mira de costado) */
export function materialVidrio(color = '#e6fbff', opacidad = 0.12) {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.04, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.05, transparent: true, opacity: opacidad, iridescence: 0.35, iridescenceIOR: 1.3, envMapIntensity: 0.7, depthWrite: false, specularIntensity: 0.5 });
  return conBorde(m, '#dff8ff', 0.18, 2.5);
}
export function brilloso(color, o = {}) {
  const { borde = 0.3, ...resto } = o;
  return conBorde(new THREE.MeshStandardMaterial({ color, roughness: 0.22, metalness: 0, ...resto }), '#ffffff', borde);
}

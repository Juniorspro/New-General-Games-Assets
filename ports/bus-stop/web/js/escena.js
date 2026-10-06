/* La escena de Bus Stop Simulator rearmada en three.js desde lo que exportó exportar.py:
   los nodos con sus mallas y materiales, el terreno, los árboles, el pasto, las luces y las teles.
   La luz imita la de Unity 4 (espacio gamma, Lambert ×2, la caída de sus luces). */
import * as THREE from 'three';

THREE.ColorManagement.enabled = false;
{ // Lambert sin 1/π y la caída de las luces de Unity 4: 1/(1+25·(d/r)²), que se apaga al llegar al rango
  const C = THREE.ShaderChunk;
  C.common = C.common.replace('return RECIPROCAL_PI * diffuseColor;', 'return diffuseColor;');
  C.lights_pars_begin = C.lights_pars_begin
    .replace('float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );',
      'float rr = cutoffDistance > 0.0 ? lightDistance / cutoffDistance : 0.0; rr *= rr; float distanceFalloff = 1.0 / ( 1.0 + 25.0 * rr );')
    .replace('distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );', 'distanceFalloff *= saturate( ( 1.0 - rr ) * 5.0 );');
}

const DINAMICOS = new Set(['Bus', 'KutteFucker Noob', 'Player', 'End Camera', 'MeshesText', 'ButtonText']);
const CELDA = 200;

export async function cargarEscena({ base, renderer, calidad, progreso = () => {} }) {
  const traer = async (f, tipo) => { const r = await fetch(base + f); if (!r.ok) throw new Error(f + ' ' + r.status); return r[tipo](); };
  const [E, BIN, ALT, PASTO, ARB] = await Promise.all([
    traer('datos/escena.json', 'json'), traer('datos/mallas.bin', 'arrayBuffer'), traer('datos/alturas.bin', 'arrayBuffer'),
    traer('datos/pasto.bin', 'arrayBuffer'), traer('datos/arboles.bin', 'arrayBuffer')]);
  progreso(0.3);
  const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const cargador = new THREE.TextureLoader();
  const T = {};
  const listaT = Object.entries(E.texs).filter(([, v]) => v.arch);
  let hechas = 0;
  await Promise.all(listaT.map(async ([k, v]) => {
    const t = await cargador.loadAsync(base + 'datos/' + v.arch);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
    T[k] = t; progreso(0.3 + 0.5 * (++hechas / listaT.length));
  }));

  /* ---- mallas */
  const G = {};
  function geometria(id) {
    if (G[id]) return G[id];
    const m = E.mallas[id];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BIN, m.pos, m.nv * 3), 3));
    if (m.nor >= 0) g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(BIN, m.nor, m.nv * 3), 3));
    if (m.uv >= 0) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(BIN, m.uv, m.nv * 2), 2));
    const total = m.subs.reduce((a, s) => a + s[1], 0);
    const I = m.i32 ? new Uint32Array(total) : new Uint16Array(total);
    let o = 0;
    m.subs.forEach(([off, n], k) => { I.set(m.i32 ? new Uint32Array(BIN, off, n) : new Uint16Array(BIN, off, n), o); g.addGroup(o, n, k); o += n; });
    g.setIndex(new THREE.BufferAttribute(I, 1));
    if (m.nor < 0) g.computeVertexNormals();
    g.computeBoundingSphere();
    return (G[id] = g);
  }

  /* ---- la luz de los faroles: un mapa visto desde arriba (x, z) que se suma a todos los materiales */
  const LM = { tex: null, rect: new THREE.Vector4(0, 0, 1, 1) };
  const uniformesMundo = { uLuzMapa: { value: null }, uLuzRect: { value: LM.rect }, uBrillo: { value: 1 } };
  function conLuzMapa(mat) {
    mat.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, uniformesMundo);
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMundo; varying float vNy;')
        .replace('#include <project_vertex>', `#include <project_vertex>
          vec4 mw0 = vec4( transformed, 1.0 );
          #ifdef USE_INSTANCING
            mw0 = instanceMatrix * mw0;
          #endif
          vMundo = ( modelMatrix * mw0 ).xyz;
          vNy = normalize( mat3( modelMatrix ) * objectNormal ).y;`);
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vMundo; varying float vNy; uniform sampler2D uLuzMapa; uniform vec4 uLuzRect; uniform float uBrillo;')
        .replace('#include <opaque_fragment>', `
          vec2 lmUv = ( vMundo.xz - uLuzRect.xy ) / uLuzRect.zw;
          float dentro = step( 0.0, lmUv.x ) * step( lmUv.x, 1.0 ) * step( 0.0, lmUv.y ) * step( lmUv.y, 1.0 );
          vec3 lm = texture2D( uLuzMapa, lmUv ).rgb * 4.0 * dentro;
          outgoingLight += diffuseColor.rgb * lm * ( 0.62 + 0.38 * vNy );
          outgoingLight *= uBrillo;
          #include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => 'luzmapa';
    return mat;
  }

  /* ---- materiales */
  const MATS = {};
  function material(id) {
    if (MATS[id]) return MATS[id];
    const m = E.mats[id];
    const c = m.c._Color || [1, 1, 1, 1];
    const tx = m.tex._MainTex;
    let map = tx && T[tx.t] ? T[tx.t] : null;
    if (map && (tx.esc[0] !== 1 || tx.esc[1] !== 1 || tx.off[0] || tx.off[1])) {
      map = map.clone(); map.repeat.set(tx.esc[0], tx.esc[1]); map.offset.set(tx.off[0], tx.off[1]); map.needsUpdate = true;
    }
    const color = new THREE.Color(c[0], c[1], c[2]);
    let mat;
    if (m.shader.startsWith('Illumin')) mat = new THREE.MeshLambertMaterial({ color, map, emissive: color, emissiveMap: map });
    else if (m.shader === 'Alpha-Diffuse') mat = new THREE.MeshLambertMaterial({ color, map, transparent: true, opacity: c[3], depthWrite: false });
    else if (m.shader === 'TreeSoftOcclusionLeaves') mat = new THREE.MeshLambertMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide });
    else if (m.shader === 'Font') mat = new THREE.MeshBasicMaterial({ visible: false });
    else mat = new THREE.MeshLambertMaterial({ color, map });
    mat.name = m.nombre;
    if (mat.isMeshLambertMaterial) conLuzMapa(mat);
    return (MATS[id] = mat);
  }

  /* ---- los nodos */
  const raiz = new THREE.Group(); raiz.name = 'escena';
  const N = E.nodos;
  const O = N.map((n) => { const o = new THREE.Object3D(); o.name = n.n; o.position.fromArray(n.t); o.quaternion.fromArray(n.r); o.scale.fromArray(n.s); o.userData.nodo = n; return o; });
  N.forEach((n, i) => (n.p >= 0 ? O[n.p] : raiz).add(O[i]));
  raiz.updateMatrixWorld(true);
  const activo = N.map(() => true), dinamico = N.map(() => false);
  N.forEach((n, i) => {
    const p = n.p;
    activo[i] = !n.inactivo && (p < 0 || activo[p]);
    dinamico[i] = DINAMICOS.has(n.n) || (p >= 0 && (dinamico[p] || N[p].n === 'Meshes'));
  });
  N.forEach((n, i) => { if (!activo[i]) O[i].visible = false; });

  // estáticos: juntados por material y por celda de 200 m (menos llamadas de dibujo, y se recortan por cámara)
  const baldes = new Map();
  const mw = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
  const malla = (i) => {
    const n = N[i];
    if (!activo[i] || !n.malla || !n.mats || n.rend_off) return;
    const g = geometria(n.malla);
    const mats = n.mats.map(material);
    if (dinamico[i] || n.texto) {
      const m = new THREE.Mesh(g, g.groups.length > 1 ? g.groups.map((gr) => mats[Math.min(gr.materialIndex, mats.length - 1)]) : mats[0]);
      if (g.groups.length > 1) g.groups.forEach((gr, k) => (gr.materialIndex = k));
      m.name = n.n + '·malla';
      O[i].add(m); O[i].userData.malla = m;
      return;
    }
    mw.copy(O[i].matrixWorld); nm.getNormalMatrix(mw);
    const al = mw.determinant() < 0;
    const P = g.attributes.position, Nn = g.attributes.normal, U = g.attributes.uv, I = g.index.array;
    const c = O[i].getWorldPosition(v);
    const cx = Math.floor(c.x / CELDA), cz = Math.floor(c.z / CELDA);
    for (const gr of g.groups) {
      const mid = n.mats[Math.min(gr.materialIndex, n.mats.length - 1)];
      if (mats[Math.min(gr.materialIndex, n.mats.length - 1)].visible === false) continue;
      const clave = `${mid}|${cx}|${cz}`;
      let b = baldes.get(clave);
      if (!b) baldes.set(clave, (b = { mid, p: [], n: [], u: [], i: [] }));
      const mapa = new Map();
      for (let k = gr.start; k < gr.start + gr.count; k += 3) {
        const tri = al ? [I[k], I[k + 2], I[k + 1]] : [I[k], I[k + 1], I[k + 2]];
        for (const vi of tri) {
          let ni = mapa.get(vi);
          if (ni === undefined) {
            ni = b.p.length / 3; mapa.set(vi, ni);
            v.fromBufferAttribute(P, vi).applyMatrix4(mw); b.p.push(v.x, v.y, v.z);
            v.fromBufferAttribute(Nn, vi).applyMatrix3(nm).normalize(); b.n.push(v.x, v.y, v.z);
            if (U) b.u.push(U.getX(vi), U.getY(vi)); else b.u.push(0, 0);
          }
          b.i.push(ni);
        }
      }
    }
  };
  N.forEach((n, i) => malla(i));
  const estaticos = new THREE.Group(); estaticos.name = 'estaticos';
  for (const b of baldes.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.u, 2));
    g.setIndex(b.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(b.i, 1) : new THREE.Uint16BufferAttribute(b.i, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, material(b.mid));
    m.matrixAutoUpdate = false;
    if (MATS[b.mid].transparent) m.renderOrder = 2;
    estaticos.add(m);
  }
  raiz.add(estaticos);
  progreso(0.85);

  /* ---- el terreno: 513×513 alturas sobre 2000×2000 m (Unity: altura = valor/32766·600) */
  const TR = E.terreno, RES = TR.res, PASO = TR.esc[0], ALTO = TR.esc[1];
  const nodoT = N.findIndex((n) => n.terreno || n.terreno_col);
  const T0 = O[nodoT].position.clone(); // (-1000, -0,1, 1000): en three el terreno va de z=1000 hacia z=-1000
  const H = new Uint16Array(ALT);
  // (el arreglo de Unity va por x: H[x·513 + z])
  const hAt = (ix, iz) => H[Math.min(RES - 1, Math.max(0, ix)) * RES + Math.min(RES - 1, Math.max(0, iz))] / 32766 * ALTO;
  function alturaEn(x, z) {
    const fx = (x - T0.x) / PASO, fz = (T0.z - z) / PASO;
    if (fx < 0 || fz < 0 || fx > RES - 1 || fz > RES - 1) return -Infinity;
    const ix = Math.floor(fx), iz = Math.floor(fz), ax = fx - ix, az = fz - iz;
    const a = hAt(ix, iz), b = hAt(ix + 1, iz), c = hAt(ix, iz + 1), d = hAt(ix + 1, iz + 1);
    return T0.y + (a * (1 - ax) + b * ax) * (1 - az) + (c * (1 - ax) + d * ax) * az;
  }
  function normalEn(x, z, out = new THREE.Vector3()) {
    const e = PASO;
    return out.set(alturaEn(x - e, z) - alturaEn(x + e, z), 2 * e, alturaEn(x, z - e) - alturaEn(x, z + e)).normalize();
  }
  const capa = TR.capas[0];
  const texPasto = T[capa.tex];
  const matTerreno = conLuzMapa(new THREE.MeshLambertMaterial({ map: texPasto }));
  matTerreno.name = 'terreno';
  const terreno = new THREE.Group(); terreno.name = 'terreno';
  const TROZO = 32;
  for (let cz = 0; cz < (RES - 1) / TROZO; cz++) for (let cx = 0; cx < (RES - 1) / TROZO; cx++) {
    const n1 = TROZO + 1, pos = new Float32Array(n1 * n1 * 3), nor = new Float32Array(n1 * n1 * 3), uv = new Float32Array(n1 * n1 * 2);
    for (let j = 0; j < n1; j++) for (let i = 0; i < n1; i++) {
      const ix = cx * TROZO + i, iz = cz * TROZO + j, k = j * n1 + i;
      const x = T0.x + ix * PASO, z = T0.z - iz * PASO;
      pos[k * 3] = x; pos[k * 3 + 1] = T0.y + hAt(ix, iz); pos[k * 3 + 2] = z;
      const nx = hAt(ix - 1, iz) - hAt(ix + 1, iz), nz = hAt(ix, iz - 1) - hAt(ix, iz + 1), l = Math.hypot(nx, 2 * PASO, nz);
      nor[k * 3] = nx / l; nor[k * 3 + 1] = 2 * PASO / l; nor[k * 3 + 2] = -nz / l;
      uv[k * 2] = (ix * PASO) / capa.tile[0]; uv[k * 2 + 1] = (iz * PASO) / capa.tile[1];
    }
    const idx = [];
    for (let j = 0; j < TROZO; j++) for (let i = 0; i < TROZO; i++) {
      const a = j * n1 + i, b = a + 1, c = a + n1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, matTerreno); m.matrixAutoUpdate = false; m.name = 'trozo';
    terreno.add(m);
  }
  raiz.add(terreno);

  /* ---- faroles: el mapa de luz (calculado acá) y el brillo de cada lamparita */
  const faroles = [], lamparitas = [];
  const q = new THREE.Quaternion();
  N.forEach((n, i) => {
    if (!n.luz || !activo[i] || dinamico[i] || !n.luz.on) return;
    const p = O[i].getWorldPosition(new THREE.Vector3());
    if (n.luz.tipo === 0) faroles.push({ p, d: new THREE.Vector3(0, 0, -1).applyQuaternion(O[i].getWorldQuaternion(q)), ...n.luz });
    else if (n.luz.tipo === 2) lamparitas.push(p);
  });
  if (faroles.length) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const f of faroles) { x0 = Math.min(x0, f.p.x - f.rango); x1 = Math.max(x1, f.p.x + f.rango); z0 = Math.min(z0, f.p.z - f.rango); z1 = Math.max(z1, f.p.z + f.rango); }
    const M = 0.5; // metros por píxel
    const W = Math.min(2048, Math.ceil((x1 - x0) / M)), Hh = Math.min(2048, Math.ceil((z1 - z0) / M));
    const sx = (x1 - x0) / W, sz = (z1 - z0) / Hh;
    const acc = new Float32Array(W * Hh * 3);
    const nn = new THREE.Vector3();
    for (const f of faroles) {
      const cosE = Math.cos(THREE.MathUtils.degToRad(f.angulo / 2));
      const i0 = Math.max(0, Math.floor((f.p.x - f.rango - x0) / sx)), i1 = Math.min(W - 1, Math.ceil((f.p.x + f.rango - x0) / sx));
      const j0 = Math.max(0, Math.floor((f.p.z - f.rango - z0) / sz)), j1 = Math.min(Hh - 1, Math.ceil((f.p.z + f.rango - z0) / sz));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = x0 + (i + 0.5) * sx, z = z0 + (j + 0.5) * sz, y = alturaEn(x, z);
        const lx = f.p.x - x, ly = f.p.y - y, lz = f.p.z - z, d = Math.hypot(lx, ly, lz);
        if (d >= f.rango || d < 1e-3) continue;
        const rr = (d / f.rango) ** 2, at = 1 / (1 + 12 * rr) * Math.min(1, Math.max(0, (1 - rr) * 5));
        const cosA = -(lx * f.d.x + ly * f.d.y + lz * f.d.z) / d;
        if (cosA <= cosE) continue;
        const cono = Math.min(1, ((cosA - cosE) / (1 - cosE)) * 1.6);
        normalEn(x, z, nn);
        const ndl = Math.max(0, (nn.x * lx + nn.y * ly + nn.z * lz) / d);
        const e = f.int * 2 * ndl * at * cono * cono, k = (j * W + i) * 3;
        acc[k] += e * f.color[0]; acc[k + 1] += e * f.color[1]; acc[k + 2] += e * f.color[2];
      }
    }
    const px = new Uint8Array(W * Hh * 4);
    for (let k = 0; k < W * Hh; k++) { for (let c = 0; c < 3; c++) px[k * 4 + c] = Math.min(255, Math.round(acc[k * 3 + c] / 4 * 255)); px[k * 4 + 3] = 255; }
    LM.tex = new THREE.DataTexture(px, W, Hh, THREE.RGBAFormat);
    LM.tex.magFilter = THREE.LinearFilter; LM.tex.minFilter = THREE.LinearFilter; LM.tex.needsUpdate = true;
    LM.rect.set(x0, z0, x1 - x0, z1 - z0);
  } else {
    LM.tex = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat); LM.tex.needsUpdate = true;
  }
  uniformesMundo.uLuzMapa.value = LM.tex;
  // el brillo de las lamparitas: puntos que suman luz (con la niebla)
  if (lamparitas.length) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const cx = cv.getContext('2d'), gr = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,235,1)'); gr.addColorStop(0.18, 'rgba(255,250,215,0.55)'); gr.addColorStop(0.5, 'rgba(255,240,190,0.12)'); gr.addColorStop(1, 'rgba(255,240,190,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
    const g = new THREE.BufferGeometry().setFromPoints(lamparitas);
    const pm = new THREE.PointsMaterial({ size: 2.6, map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
    const pts = new THREE.Points(g, pm); pts.name = 'lamparitas'; pts.renderOrder = 3;
    raiz.add(pts);
  }

  /* ---- las teles: el texto de cada una en una textura de lienzo */
  const teles = [];
  N.forEach((n, i) => {
    if (!n.texto || !activo[i]) return;
    const num = +(/TV (\d)/.exec(n.n)?.[1] || 0);
    const linea = n.texto.fuente * n.texto.tam * 0.1 * 1.32;
    // (el texto 3D de Unity 4 se dibuja encima de todo: queda adentro de la tele y se ve igual)
    const plano = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, fog: true }));
    plano.name = 'texto-tele'; plano.renderOrder = 5;
    O[i].add(plano);
    teles.push({ num, nodo: O[i], plano, linea, color: n.texto.color, ancla: n.texto.ancla, tele: O[n.p], original: n.texto.t });
  });

  /* ---- árboles: 5893 sobre el terreno; cerca con la malla y lejos con un cartel que mira a la cámara */
  const AR = new Float32Array(ARB);
  const arboles = [];
  for (let k = 0; k < AR.length; k += 5) {
    const x = T0.x + AR[k] * 2000, z = T0.z - AR[k + 2] * 2000;
    arboles.push({ x, z, y: alturaEn(x, z), w: AR[k + 3], h: AR[k + 4] });
  }
  const gArbol = geometria(E.arbol.malla);
  const matsArbol = E.arbol.mats.map(material);
  const pasto = { den: new Uint8Array(PASTO), res: TR.pasto.res, info: TR.pasto, tex: T[TR.pasto.tex] };

  // los textos de las teles traducidos (opcional; si no está, van los del original)
  const tv = await fetch(base + 'datos/tv.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  progreso(1);
  return {
    tv,
    E, raiz, O, N, activo, dinamico, alturaEn, normalEn, geometria, material, MATS, T,
    terreno, estaticos, teles, arboles, gArbol, matsArbol, pasto, uniformesMundo, conLuzMapa, LM, faroles,
    render: E.render, buscar: (nombre) => N.map((n, i) => (n.n === nombre ? i : -1)).filter((i) => i >= 0),
  };
}

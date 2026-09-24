/* ============================================================================
   nevada/js/escena.js — el bosque nevado: cielo encapotado, niebla, suelo con
   el camino y las huellas, árboles pelados con nieve en las ramas, pinos,
   pastos secos que asoman, el bosque del fondo, la nieve que cae y el entorno
   que se refleja en el auto.
   La luz es la de un día nublado: casi toda viene del cielo (hemisférica) y
   un sol velado da las sombras suaves. Lo que vende la foto es la niebla: los
   árboles se van lavando con la distancia hasta el blanco del cielo.
   ========================================================================== */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { azar, fbm, alturaSuelo, caminoX, ANCHO_CAMINO, GLSL_RUIDO } from './ruido.js';
import { textura } from './cargador.js';

export const COLOR_NIEBLA = new THREE.Color('#d3d8dd');

export async function armarEscena(renderer) {
  const escena = new THREE.Scene();
  escena.background = COLOR_NIEBLA.clone();
  escena.fog = new THREE.FogExp2(COLOR_NIEBLA, 0.022);

  const [nieve, nieveN, corteza, cortezaN, fondoBosque] = await Promise.all([
    textura('nieve.webp', { repetir: true }), textura('nieve-n.webp', { repetir: true, color: false }),
    textura('corteza.webp', { repetir: true }), textura('corteza-n.webp', { repetir: true, color: false }),
    textura('fondo-bosque.webp'),
  ]);

  /* ---------------- la luz ---------------- */
  const cielo = new THREE.HemisphereLight('#e2e8ef', '#7d858d', 0.95);
  escena.add(cielo);
  const sol = new THREE.DirectionalLight('#f4f5f8', 1.05);
  sol.position.set(-14, 22, 9);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  const sc = sol.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 70;
  sol.shadow.bias = -0.00035; sol.shadow.normalBias = 0.03; sol.shadow.radius = 5;
  escena.add(sol, sol.target);

  /* ---------------- el cielo: una cúpula con degradé, blanco lechoso ---------------- */
  const cupula = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { arriba: { value: new THREE.Color('#bfc6cd') }, horizonte: { value: COLOR_NIEBLA.clone() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 arriba, horizonte; varying vec3 vP; void main(){ float h = clamp(vP.y, 0.0, 1.0); gl_FragColor = vec4(mix(horizonte, arriba, pow(h, 0.6)), 1.0); }',
  }));
  cupula.renderOrder = -10;
  escena.add(cupula);

  /* ---------------- el bosque del fondo: la foto en un cilindro lejano ----------------
     A 125 m la niebla ya lo tapó entero, así que no lleva niebla: se pinta
     transparente sobre la cúpula, apenas una silueta de árboles en el
     horizonte, y se desvanece hacia arriba (si no, su borde corta el cielo). */
  if (fondoBosque) {
    fondoBosque.wrapS = THREE.RepeatWrapping; fondoBosque.repeat.set(5, 1);
    const R = 125, alto = (2 * Math.PI * R / 5) * (fondoBosque.image.height / fondoBosque.image.width);
    const cil = new THREE.Mesh(new THREE.CylinderGeometry(R, R, alto, 64, 1, true), new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
      uniforms: { map: { value: fondoBosque }, niebla: { value: COLOR_NIEBLA.clone() }, fuerza: { value: 0.3 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */`
        uniform sampler2D map; uniform vec3 niebla; uniform float fuerza; varying vec2 vUv;
        void main(){
          vec3 t = texture2D(map, vUv * vec2(5.0, 1.0)).rgb;
          float a = fuerza * smoothstep(0.1, 0.3, vUv.y) * (1.0 - smoothstep(0.5, 0.95, vUv.y));
          gl_FragColor = vec4(mix(niebla, t, 0.85), a);
        }`,
    }));
    cil.position.y = alto / 2 - 3.5;
    cil.renderOrder = -9;
    escena.add(cil);
  }

  /* ---------------- el suelo ---------------- */
  const suelo = armarSuelo(nieve, nieveN);
  escena.add(suelo);

  /* ---------------- los árboles ---------------- */
  const arboles = armarArboles(corteza, cortezaN);
  escena.add(arboles);

  /* ---------------- pastos secos que asoman de la nieve ---------------- */
  escena.add(armarPastos());

  /* ---------------- la nieve que cae ---------------- */
  const copos = armarCopos();
  escena.add(copos.grupo);

  /* ---------------- lo que se refleja en la pintura ---------------- */
  const entorno = armarEntorno(renderer, fondoBosque);
  escena.environment = entorno;
  escena.environmentIntensity = 0.55;

  return {
    escena, sol, cielo, suelo, arboles, copos, entorno,
    /* la sombra sigue a lo que se filma, con su caja chica para que tenga detalle */
    seguirSombra(p) { sol.target.position.copy(p); sol.position.set(p.x - 14, p.y + 22, p.z + 9); },
  };
}

/* ============================================================================ suelo */
function armarSuelo(nieve, nieveN) {
  const T = 280, N = 230;
  const g = new THREE.PlaneGeometry(T, T, N, N);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, alturaSuelo(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();

  const m = new THREE.MeshStandardMaterial({ color: '#e9edf1', map: nieve, normalMap: nieveN, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.93, metalness: 0, envMapIntensity: 0.25 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uTiempo = { value: 0 };
    m.userData.shader = s;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMundo;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMundo;\nuniform float uTiempo;\n' + GLSL_RUIDO)
      /* la textura va en coordenadas del mundo (0,3 m por repetición a un tercio
         y otra más grande encima) para que no se note que repite */
      .replace('#include <map_fragment>', /* glsl */`
        vec2 uvA = vMundo.xz * 0.33, uvB = vMundo.xz * 0.071 + 0.37;
        vec4 tA = texture2D(map, uvA), tB = texture2D(map, uvB);
        float mezcla = smoothstep(0.35, 0.65, vfbm(vMundo.xz * 0.05));
        vec4 texel = mix(tA, tB, mezcla * 0.55);
        /* el camino: la nieve pisada es más gris, con dos surcos de rueda */
        float dc = abs(vMundo.x - caminoX(vMundo.z));
        float camino = 1.0 - smoothstep(${(ANCHO_CAMINO * 0.45).toFixed(2)}, ${(ANCHO_CAMINO * 0.62).toFixed(2)}, dc + (vfbm(vMundo.xz * 0.7) - 0.5) * 0.6);
        float surco = exp(-pow((dc - 0.8) / 0.16, 2.0)) * (0.55 + 0.45 * vruido(vMundo.xz * vec2(3.0, 0.4)));
        texel.rgb = mix(texel.rgb, texel.rgb * vec3(0.8, 0.82, 0.86) + vec3(0.02), camino * 0.55);
        texel.rgb *= 1.0 - surco * camino * 0.32;
        diffuseColor *= texel;
      `)
      .replace('#include <normal_fragment_maps>', /* glsl */`
        vec3 nA = texture2D(normalMap, vMundo.xz * 0.33).xyz * 2.0 - 1.0;
        vec3 nB = texture2D(normalMap, vMundo.xz * 0.071 + 0.37).xyz * 2.0 - 1.0;
        vec3 mapN = normalize(mix(nA, nB, 0.4)); mapN.xy *= normalScale;
        normal = normalize(tbn * mapN);
      `)
      /* el brillo de la nieve: cristalitos que chispean según desde dónde se mira */
      .replace('#include <emissivemap_fragment>', /* glsl */`
        #include <emissivemap_fragment>
        vec2 celda = floor(vMundo.xz * 38.0);
        float cristal = step(0.9965, h21(celda + floor(dot(normalize(cameraPosition - vMundo), vec3(3.1, 1.7, 2.3)) * 6.0)));
        totalEmissiveRadiance += vec3(cristal) * 1.6 * smoothstep(22.0, 3.0, distance(cameraPosition, vMundo));
      `);
  };
  // sin UV propias: el shader usa las del mundo, pero three necesita el atributo para el mapa
  const s = new THREE.Mesh(g, m);
  s.receiveShadow = true;
  return s;
}

/* ============================================================================ árboles */
/* Un árbol pelado de invierno, armado de cilindros que se afinan: tronco,
   ramas y ramitas, cada una torcida un poco. La corteza va en UV a lo largo
   de cada rama. Ocho variantes y se reparten como instancias. */
function rama(geos, desde, dir, largo, radio, nivel, r, max) {
  const segs = nivel === 0 ? 7 : nivel === 1 ? 4 : 3;
  const lados = nivel === 0 ? 8 : nivel === 1 ? 5 : 3;
  const puntos = [desde.clone()];
  let d = dir.clone(), p = desde.clone();
  for (let i = 1; i <= segs; i++) {
    d.add(new THREE.Vector3((r() - 0.5) * 0.35, (r() - 0.35) * 0.18, (r() - 0.5) * 0.35)).normalize();
    p = p.clone().addScaledVector(d, largo / segs);
    puntos.push(p);
  }
  const curva = new THREE.CatmullRomCurve3(puntos);
  const tubo = new THREE.TubeGeometry(curva, segs * 2, radio, lados, false);
  // afinar hacia la punta
  const pos = tubo.attributes.position, uv = tubo.attributes.uv;
  const cen = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    curva.getPointAt(Math.min(1, u), cen);
    v.fromBufferAttribute(pos, i).sub(cen).multiplyScalar(1 - u * 0.78);
    pos.setXYZ(i, cen.x + v.x, cen.y + v.y, cen.z + v.z);
    uv.setXY(i, uv.getY(i) * Math.max(1, radio * 9), u * largo * 0.55);
  }
  tubo.computeVertexNormals();
  geos.push(tubo);
  if (nivel >= max) return;
  const hijos = nivel === 0 ? 5 + Math.floor(r() * 3) : nivel === 1 ? 3 + Math.floor(r() * 2) : 2;
  for (let k = 0; k < hijos; k++) {
    const t = nivel === 0 ? 0.42 + r() * 0.5 : 0.3 + r() * 0.6;
    const base = curva.getPointAt(t);
    const tang = curva.getTangentAt(t);
    const lado = new THREE.Vector3(Math.cos(k * 2.4 + r()), 0, Math.sin(k * 2.4 + r()));
    const nd = tang.clone().multiplyScalar(0.45).add(lado.multiplyScalar(0.9)).add(new THREE.Vector3(0, 0.35 + r() * 0.3, 0)).normalize();
    rama(geos, base, nd, largo * (nivel === 0 ? 0.42 + r() * 0.2 : 0.55 + r() * 0.2), radio * (nivel === 0 ? 0.42 : 0.5) * (1 - t * 0.5), nivel + 1, r, max);
  }
}

function geometriaArbol(semilla, max) {
  const r = azar(semilla);
  const geos = [];
  const alto = 11 + r() * 7;
  rama(geos, new THREE.Vector3(0, -0.4, 0), new THREE.Vector3((r() - 0.5) * 0.12, 1, (r() - 0.5) * 0.12).normalize(), alto, 0.24 + r() * 0.2, 0, r, max);
  const g = mergeGeometries(geos.map((x) => x.index ? x.toNonIndexed() : x), false);
  g.computeBoundingSphere();
  return g;
}

/* un pino: capas de conos verdes oscuros con la nieve arriba de cada capa */
function geometriaPino(semilla) {
  const r = azar(semilla);
  const geos = [];
  const alto = 9 + r() * 6;
  const tronco = new THREE.CylinderGeometry(0.12, 0.3, alto, 6); tronco.translate(0, alto / 2, 0);
  geos.push(tronco);
  const capas = 7;
  for (let i = 0; i < capas; i++) {
    const t = i / capas, rad = (1 - t) * (2.2 + r() * 0.6) + 0.3, h = alto * (0.25 + t * 0.72);
    const c = new THREE.ConeGeometry(rad, alto * 0.22, 9, 2);
    const p = c.attributes.position;
    for (let k = 0; k < p.count; k++) { const a = Math.atan2(p.getZ(k), p.getX(k)); const f = 1 + (Math.sin(a * 5 + i) * 0.12 + (r() - 0.5) * 0.18) * (p.getY(k) < 0 ? 1 : 0); p.setX(k, p.getX(k) * f); p.setZ(k, p.getZ(k) * f); }
    c.translate(0, h, 0);
    geos.push(c);
  }
  const g = mergeGeometries(geos.map((x) => x.index ? x.toNonIndexed() : x), false);
  // color por vértice: el tronco marrón, el follaje verde muy oscuro
  const col = new Float32Array(g.attributes.position.count * 3);
  const n0 = tronco.toNonIndexed().attributes.position.count;
  for (let i = 0; i < g.attributes.position.count; i++) {
    const c = i < n0 ? [0.25, 0.2, 0.17] : [0.07, 0.11, 0.08];
    col.set(c, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/* la nieve que se queda arriba de las ramas: lo que mira para arriba se pone
   blanco, con un ruido para que no parezca pintado */
function conNieveArriba(m, cuanto = 0.55, opts = {}) {
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vNMundo; varying vec3 vPMundo;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvNMundo = normalize(mat3(modelMatrix) * objectNormal);\n#ifdef USE_INSTANCING\nvNMundo = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);\n#endif\nvPMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#ifdef USE_INSTANCING\nvPMundo = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#endif');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vNMundo; varying vec3 vPMundo;\n' + GLSL_RUIDO)
      .replace('#include <color_fragment>', /* glsl */`
        #include <color_fragment>
        float arriba = smoothstep(${(1 - cuanto).toFixed(2)}, ${(1 - cuanto + 0.25).toFixed(2)}, vNMundo.y + (vruido(vPMundo.xz * 3.0 + vPMundo.y) - 0.5) * 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.98), arriba);
        ${opts.escarcha ? 'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.83, 0.86), 0.18);' : ''}
      `);
  };
  return m;
}

function armarArboles(corteza, cortezaN) {
  const grupo = new THREE.Group();
  const matArbol = conNieveArriba(new THREE.MeshStandardMaterial({ color: '#9a9a98', map: corteza, normalMap: cortezaN, roughness: 0.95 }), 0.62, { escarcha: true });
  const matPino = conNieveArriba(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 0.7);

  // dónde van: lejos del camino y del auto, más tupido a los costados
  const r = azar(9181);
  const lugares = [];
  const libre = (x, z) => Math.abs(x - caminoX(z)) > ANCHO_CAMINO * 0.9 + 1.2 && Math.hypot(x, z) > 7.5 && lugares.every((q) => Math.hypot(q.x - x, q.z - z) > 3.2);
  for (let i = 0; lugares.length < 230 && i < 6000; i++) {
    const x = (r() - 0.5) * 210, z = (r() - 0.5) * 210;
    if (!libre(x, z)) continue;
    lugares.push({ x, z, pino: r() < 0.16, giro: r() * Math.PI * 2, esc: 0.8 + r() * 0.45 });
  }

  /* las variantes: cerca con ramitas (nivel 3), lejos más simples (nivel 2) */
  const cerca = [0, 1, 2, 3].map((k) => geometriaArbol(101 + k * 17, 3));
  const lejos = [4, 5, 6, 7].map((k) => geometriaArbol(301 + k * 23, 2));
  const pinos = [0, 1, 2].map((k) => geometriaPino(501 + k * 7));
  const grupos = [...cerca.map((g) => ({ g, m: matArbol, l: [] })), ...lejos.map((g) => ({ g, m: matArbol, l: [] })), ...pinos.map((g) => ({ g, m: matPino, l: [] }))];
  lugares.forEach((q, i) => {
    const d = Math.hypot(q.x, q.z);
    const k = q.pino ? 8 + (i % 3) : d < 38 ? i % 4 : 4 + (i % 4);
    grupos[k].l.push(q);
  });
  const mtx = new THREE.Matrix4(), qt = new THREE.Quaternion(), e = new THREE.Vector3();
  for (const { g, m, l } of grupos) {
    if (!l.length) continue;
    const im = new THREE.InstancedMesh(g, m, l.length);
    l.forEach((q, i) => {
      qt.setFromAxisAngle(new THREE.Vector3(0, 1, 0), q.giro);
      e.set(q.esc, q.esc, q.esc);
      mtx.compose(new THREE.Vector3(q.x, alturaSuelo(q.x, q.z), q.z), qt, e);
      im.setMatrixAt(i, mtx);
    });
    im.castShadow = true; im.receiveShadow = true;
    grupo.add(im);
  }
  grupo.userData.lugares = lugares;
  return grupo;
}

/* ============================================================================ pastos */
function texturaPasto() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const r = azar(77);
  for (let i = 0; i < 26; i++) {
    const x = 20 + r() * 88, alto = 50 + r() * 70, curva = (r() - 0.5) * 40;
    g.strokeStyle = `rgba(${90 + r() * 50 | 0},${70 + r() * 35 | 0},${45 + r() * 25 | 0},1)`;
    g.lineWidth = 1 + r() * 1.6;
    g.beginPath(); g.moveTo(x, 128); g.quadraticCurveTo(x + curva * 0.3, 128 - alto * 0.6, x + curva, 128 - alto); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function armarPastos() {
  const plano = new THREE.PlaneGeometry(0.7, 0.55); plano.translate(0, 0.25, 0);
  const cruz = mergeGeometries([plano.clone(), plano.clone().rotateY(Math.PI / 2)]);
  const m = new THREE.MeshStandardMaterial({ map: texturaPasto(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 });
  const r = azar(4242), N = 1400;
  const im = new THREE.InstancedMesh(cruz, m, N);
  const mtx = new THREE.Matrix4(), qt = new THREE.Quaternion(), e = new THREE.Vector3();
  let n = 0;
  for (let i = 0; n < N && i < N * 4; i++) {
    const x = (r() - 0.5) * 90, z = (r() - 0.5) * 90;
    const dc = Math.abs(x - caminoX(z));
    if (dc < ANCHO_CAMINO * 0.55 || Math.hypot(x, z) < 3.2) continue;
    if (fbm(x * 0.2, z * 0.2) < 0.47) continue;       // en manchones, como en la foto
    qt.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28);
    const s = 0.6 + r() * 0.9; e.set(s, s * (0.7 + r() * 0.6), s);
    mtx.compose(new THREE.Vector3(x, alturaSuelo(x, z) - 0.05, z), qt, e);
    im.setMatrixAt(n++, mtx);
  }
  im.count = n;
  return im;
}

/* ============================================================================ nieve que cae */
/* Dos capas: la fina, que llena el aire hasta lejos, y copos grandes y
   desenfocados cerca de la cámara (los que en la foto parecen manchas). Las
   posiciones viven en una caja que sigue a la cámara y se envuelven con mod():
   la nevada no se termina nunca y no cuesta más que 14 mil puntos. */
function armarCopos() {
  const grupo = new THREE.Group();
  const capa = (n, caja, tam, alfa, vel, semilla, claro = 0) => {
    const r = azar(semilla);
    const p = new Float32Array(n * 3), f = new Float32Array(n);
    for (let i = 0; i < n; i++) { p[i * 3] = r() * caja; p[i * 3 + 1] = r() * caja * 0.6; p[i * 3 + 2] = r() * caja; f[i] = r(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('fase', new THREE.BufferAttribute(f, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { t: { value: 0 }, centro: { value: new THREE.Vector3() }, caja: { value: caja }, tam: { value: tam }, alfa: { value: alfa }, vel: { value: vel },
        viento: { value: new THREE.Vector2(0.6, 0.15) }, escala: { value: 1 }, colorNiebla: { value: COLOR_NIEBLA }, claro: { value: claro } },
      vertexShader: /* glsl */`
        uniform float t, caja, tam, vel, escala, claro; uniform vec3 centro; uniform vec2 viento;
        attribute float fase; varying float vA; varying float vD;
        void main(){
          vec3 p = position;
          p.y -= t * vel * (0.7 + fase * 0.6);
          p.x += t * viento.x + sin(t * 1.3 + fase * 40.0) * 0.35;
          p.z += t * viento.y + cos(t * 1.1 + fase * 23.0) * 0.35;
          vec3 alto = vec3(caja, caja * 0.6, caja);
          p = mod(p - centro + alto * 0.5, alto) - alto * 0.5 + centro;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vD = -mv.z;
          gl_PointSize = tam * escala * (0.6 + fase * 0.8) / max(0.3, vD);
          vA = smoothstep(0.25, 1.2, vD) * (1.0 - smoothstep(caja * 0.35, caja * 0.5, vD));
          /* como el bokeh de verdad: cuanto más grande el disco, más tenue (si
             no, un copo cerca de la cámara le lava la cara al tigre) */
          vA *= clamp(48.0 / gl_PointSize, 0.2, 1.0);
          gl_Position = projectionMatrix * mv;
          /* los copos grandes, en primer plano, se apartan del centro del
             cuadro, que es donde suele estar lo que se mira: lo enmarcan */
          vec2 ndc = gl_Position.xy / gl_Position.w * vec2(0.5625, 1.0);
          vA *= mix(1.0, mix(0.25, 1.0, smoothstep(0.18, 0.6, length(ndc))), claro);
        }`,
      fragmentShader: /* glsl */`
        uniform float alfa; uniform vec3 colorNiebla; varying float vA; varying float vD;
        void main(){
          vec2 c = gl_PointCoord - 0.5; float d = length(c);
          float a = smoothstep(0.5, 0.15, d) * alfa * vA;
          if (a < 0.01) discard;
          gl_FragColor = vec4(mix(vec3(1.0), colorNiebla, clamp(vD / 60.0, 0.0, 1.0)), a);
        }`,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    grupo.add(pts);
    return m;
  };
  const fina = capa(14000, 46, 38, 0.85, 1.1, 11);
  const grande = capa(420, 9, 150, 0.3, 0.7, 12, 1);
  return {
    grupo,
    paso(t, camara, escala = 1) {
      for (const m of [fina, grande]) { m.uniforms.t.value = t; m.uniforms.centro.value.copy(camara.position); m.uniforms.escala.value = escala; }
    },
  };
}

/* ============================================================================ entorno */
/* Lo que se refleja en la pintura del auto: una escena chiquita con el cielo,
   el anillo del bosque y el suelo blanco, pasada por PMREM. Es lo que hace que
   en el capó se vean los troncos como en la foto. */
function armarEntorno(renderer, fondoBosque) {
  const e = new THREE.Scene();
  e.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    // el cielo claro arriba, el horizonte gris y el suelo apenas más claro: en
    // la foto el capó refleja cielo y los costados reflejan el bosque oscuro
    fragmentShader: 'varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(vec3(0.55,0.57,0.6), vec3(0.95,0.96,0.98), pow(h, 0.7)) : mix(vec3(0.5,0.52,0.55), vec3(0.78,0.8,0.82), clamp(-h * 2.5, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0); }',
  })));
  if (fondoBosque) {
    const t = fondoBosque.clone(); t.needsUpdate = true; t.repeat.set(4, 1); t.wrapS = THREE.RepeatWrapping;
    const cil = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 16, 48, 1, true), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, color: '#8d9196' }));
    cil.position.y = 5;
    e.add(cil);
  }
  // unos troncos oscuros cerca, para que el reflejo tenga rayas como en la foto
  const r = azar(55);
  for (let i = 0; i < 60; i++) {
    const a = r() * Math.PI * 2, d = 6 + r() * 16;
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.2 + r() * 0.25, 0.35 + r() * 0.2, 30, 6), new THREE.MeshBasicMaterial({ color: r() < 0.5 ? '#1e2023' : '#34373b' }));
    tr.position.set(Math.cos(a) * d, 12, Math.sin(a) * d); e.add(tr);
  }
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(e, 0.02);
  pm.dispose();
  return rt.texture;
}

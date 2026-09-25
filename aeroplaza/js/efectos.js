/* ============================================================================
   aeroplaza/js/efectos.js — los efectos especiales (VFX), a la manera del
   "TearDrop" que mandó quien pide (25/09): energía azul que se junta en
   remolino, se aprieta en una estrella, destella, arma un orbe que gira con
   escombros volando, y se deshace en chispas dejando el piso agrietado.
   Piezas (todo aditivo, sin texturas de afuera):
   - chispas: un solo Points con 1.800 lugares (brillo con núcleo blanco,
     color y tamaño que cambian con la vida, arrastre, gravedad, remolino);
   - cintas: tiras que miran a la cámara (rayos, estelas de energía), con la
     punta blanca y la cola que se apaga;
   - orbe: esfera con borde de Fresnel y bandas de ruido que giran;
   - ondas: anillos en el piso que se abren; destellos: carteles de luz;
   - grietas: un calco en el piso (grietas que brillan y después quedan oscuras);
   - escombros: piedritas instanciadas que vuelan, rebotan y se achican.
   Y dos cosas de pantalla que se piden al motor: el destello (uDestello) y la
   sacudida de la cámara (cam.sacudida).
   Se usan en: el gesto "Poder" (lagrima), los portales (portal), las caídas
   fuertes (impacto), los goles y los triunfos (festejo).
   ========================================================================== */
import * as THREE from 'three';

const MAX = 1800;
const VS_CHISPA = /* glsl */`
  attribute float aTam; attribute vec4 aCol; varying vec4 vCol; uniform float uEscala;
  void main() { vCol = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aTam * uEscala / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`;
const FS_CHISPA = /* glsl */`
  varying vec4 vCol;
  void main() { float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; float a = pow(1.0 - d, 1.6); gl_FragColor = vec4(mix(vCol.rgb, vec3(1.0), pow(1.0 - d, 6.0)) * a * vCol.a, 1.0); }`;
const FS_CINTA = /* glsl */`
  uniform vec3 uColor; uniform float uOp; varying vec2 vUv;
  void main() { float a = smoothstep(0.0, 0.25, vUv.x) * (1.0 - smoothstep(0.0, 1.0, abs(vUv.y - 0.5) * 2.0)); float nucleo = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 4.0);
    gl_FragColor = vec4(mix(uColor, vec3(1.0), nucleo * vUv.x) * a * uOp, 1.0); }`;
const VS_UV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const VS_ORBE = /* glsl */`
  varying vec3 vN, vV, vP; uniform float uT;
  void main() { vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const FS_ORBE = /* glsl */`
  uniform float uT, uOp; uniform vec3 uColor; varying vec3 vN, vV, vP;
  float h(vec3 p) { p = fract(p * 0.3183 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float r3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h(i), h(i + vec3(1, 0, 0)), f.x), mix(h(i + vec3(0, 1, 0)), h(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(h(i + vec3(0, 0, 1)), h(i + vec3(1, 0, 1)), f.x), mix(h(i + vec3(0, 1, 1)), h(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
  void main() {
    float fr = pow(1.0 - abs(dot(vN, vV)), 2.2);
    vec3 q = normalize(vP); float a = atan(q.x, q.z) + uT * 2.2;
    float bandas = r3(vec3(a * 1.6, q.y * 5.0 - uT * 1.5, uT * 0.6)) * 0.6 + r3(vec3(a * 4.0, q.y * 11.0 + uT, 3.0)) * 0.4;
    float b = smoothstep(0.55, 0.85, bandas);
    vec3 col = uColor * (fr * 1.6 + b * 1.1) + vec3(1.0) * pow(fr, 5.0) * 1.4 + vec3(0.8, 0.9, 1.0) * b * b * 0.8;
    gl_FragColor = vec4(col * uOp, 1.0);
  }`;
const FS_ONDA = /* glsl */`
  uniform vec3 uColor; uniform float uOp; varying vec2 vUv;
  void main() { float a = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 2.0); gl_FragColor = vec4(mix(uColor, vec3(1.0), a * a) * a * uOp, 1.0); }`;

function texRadial(c0, c1) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, c0); r.addColorStop(0.2, c1); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/* la estrella de 4 puntas con destello horizontal (la del momento en que se aprieta la energía) */
function texEstrella() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.translate(128, 128);
  for (const [w, h, a] of [[128, 5, 1], [5, 128, 0.9], [60, 60, 0.5]]) { const r = g.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h)); r.addColorStop(0, `rgba(255,255,255,${a})`); r.addColorStop(0.15, `rgba(170,215,255,${a * 0.7})`); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.save(); g.scale(w / Math.max(w, h), h / Math.max(w, h)); g.beginPath(); g.arc(0, 0, Math.max(w, h), 0, 7); g.fill(); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/* las grietas: rayos que salen del centro y se ramifican (en dos capas: brillo y oscuro) */
function texGrieta(sem, brillo) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); let s = sem;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const rama = (x, y, a, largo, ancho, prof) => {
    let px = x, py = y; g.beginPath(); g.moveTo(px, py);
    const pasos = 6 + Math.floor(r() * 4);
    for (let i = 0; i < pasos; i++) { a += (r() - 0.5) * 0.7; const l = largo / pasos; px += Math.cos(a) * l; py += Math.sin(a) * l; g.lineTo(px, py); if (prof < 2 && r() < 0.28) rama(px, py, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), largo * 0.45, ancho * 0.6, prof + 1); }
    g.lineWidth = ancho; g.stroke();
  };
  g.strokeStyle = brillo ? 'rgba(150,215,255,1)' : 'rgba(10,20,40,0.9)'; if (brillo) { g.shadowColor = '#7fd0ff'; g.shadowBlur = 14; }
  const n = 9 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) rama(256, 256, i / n * Math.PI * 2 + r() * 0.4, 150 + r() * 90, brillo ? 7 : 5, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Efectos {
  constructor(escena) {
    this.g = new THREE.Group(); this.g.renderOrder = 8; escena.add(this.g);
    /* chispas */
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3); this.col = new Float32Array(MAX * 4); this.tam = new Float32Array(MAX);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aTam', new THREE.BufferAttribute(this.tam, 1).setUsage(THREE.DynamicDrawUsage));
    this.uEscala = { value: 300 };
    this.puntos = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: { uEscala: this.uEscala }, vertexShader: VS_CHISPA, fragmentShader: FS_CHISPA, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.puntos.frustumCulled = false; this.puntos.renderOrder = 9; this.g.add(this.puntos);
    this.p = []; for (let i = 0; i < MAX; i++) this.p.push({ vivo: false });
    this.libre = 0;
    this.cintas = []; this.cosas = []; this.tareas = [];
    this.texGlow = texRadial('rgba(255,255,255,1)', 'rgba(120,190,255,0.8)');
    this.texEstrella = texEstrella();
    this.texGrietas = [[texGrieta(11, true), texGrieta(11, false)], [texGrieta(97, true), texGrieta(97, false)]];
    /* las piedritas */
    this.MAXE = 80;
    this.esc = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: '#46536b', roughness: 0.6, metalness: 0.1, emissive: '#10204a', emissiveIntensity: 0.4 }), this.MAXE);
    this.esc.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.esc.count = 0; this.esc.frustumCulled = false; this.esc.castShadow = true; this.g.add(this.esc);
    this.piedras = [];
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3();
    this.t = 0; this.destello = 0; this.sacudida = 0; this.oscuro = 0; this.oscuroObj = [];   // oscuroObj: [{ hasta, v }]
  }
  /* ------------------------------------------------------------ chispas */
  chispa(o) {
    for (let k = 0; k < MAX; k++) {
      const i = (this.libre + k) % MAX, P = this.p[i];
      if (P.vivo) continue;
      this.libre = (i + 1) % MAX;
      Object.assign(P, { vivo: true, x: o.p.x, y: o.p.y, z: o.p.z, vx: o.v.x, vy: o.v.y, vz: o.v.z, t: 0, vida: o.vida, tam: o.tam, c: o.color, c2: o.color2 || o.color, arrastre: o.arrastre ?? 1.5, grav: o.grav ?? 0, remolino: o.remolino || 0, centro: o.centro || null, atrae: o.atrae || 0 });
      return P;
    }
    return null;
  }
  /* muchas a la vez, desde un punto */
  chispas(p, { n = 30, vel = 4, vida = 0.8, tam = 0.35, color = '#7fc8ff', color2 = '#ffffff', grav = 0, arrastre = 2, subir = 0, remolino = 0, esfera = true } = {}) {
    const c = new THREE.Color(color), c2 = new THREE.Color(color2);
    for (let i = 0; i < n; i++) {
      const d = esfera ? new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize() : new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      const v = d.multiplyScalar(vel * (0.35 + Math.random() * 0.65)); v.y += subir * (0.5 + Math.random());
      this.chispa({ p: p.clone(), v, vida: vida * (0.6 + Math.random() * 0.7), tam: tam * (0.5 + Math.random()), color: c, color2: c2, grav, arrastre, remolino, centro: remolino ? p.clone() : null });
    }
  }
  /* ------------------------------------------------------------ cintas y rayos */
  cinta({ color = '#6fb8ff', ancho = 0.18, puntos = 28, dur = 1, op = 1, camino }) {
    const n = puntos, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx = [];
    for (let i = 0; i < n; i++) { uv[i * 4] = i / (n - 1); uv[i * 4 + 1] = 0; uv[i * 4 + 2] = i / (n - 1); uv[i * 4 + 3] = 1; if (i < n - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(color) }, uOp: { value: op } }, vertexShader: VS_UV, fragmentShader: FS_CINTA, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 9; this.g.add(m);
    const C = { m, n, ancho, t: 0, dur, op, camino, hist: [] };
    this.cintas.push(C); return C;
  }
  /* un rayo de a (Vector3) a b, quebrado, que se rehace cada 0,05 s */
  rayo(a, b, { color = '#9fd8ff', dur = 0.35, ancho = 0.08, quiebre = 0.35 } = {}) {
    let semilla = Math.random() * 100, tRe = 0;
    return this.cinta({ color, ancho, puntos: 14, dur, op: 1.4, camino: (u, t, dt) => {
      tRe += dt; if (tRe > 0.05) { tRe = 0; semilla = Math.random() * 100; }
      const p = a.clone().lerp(b, u), k = Math.sin(u * Math.PI) * quiebre;
      p.x += Math.sin(semilla + u * 37) * k; p.y += Math.sin(semilla * 1.7 + u * 29) * k; p.z += Math.cos(semilla * 2.3 + u * 31) * k; return p;
    } });
  }
  /* ------------------------------------------------------------ cosas sueltas (destellos, ondas, orbe, grietas) */
  cosa(obj, dur, fn) { this.g.add(obj); const C = { obj, t: 0, dur, fn }; this.cosas.push(C); return C; }
  destelloEn(p, { tam = 6, dur = 0.5, color = '#bfe4ff', estrella = false } = {}) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: estrella ? this.texEstrella : this.texGlow, color, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    s.position.copy(p); s.renderOrder = 10;
    return this.cosa(s, dur, (u) => { const k = estrella ? 1 : 0.4 + u * 0.8; s.scale.setScalar(tam * k); s.material.opacity = Math.pow(1 - u, 1.5); s.material.rotation = estrella ? u * 0.4 : 0; });
  }
  onda(p, { radio = 6, dur = 0.7, color = '#6fc4ff', alto = 0.06 } = {}) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(color) }, uOp: { value: 1 } }, vertexShader: VS_UV, fragmentShader: FS_ONDA, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.position.copy(p).add(new THREE.Vector3(0, alto, 0)); m.renderOrder = 9;
    return this.cosa(m, dur, (u) => { const e = 0.2 + (1 - Math.pow(1 - u, 3)) * radio; m.scale.setScalar(e); m.material.uniforms.uOp.value = (1 - u) * 1.3; });
  }
  orbe(p, { radio = 1.8, dur = 2.2, color = '#3f7bff' } = {}) {
    const U = { uT: { value: 0 }, uOp: { value: 0 }, uColor: { value: new THREE.Color(color) } };
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS_ORBE, fragmentShader: FS_ORBE, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.copy(p); m.renderOrder = 9;
    const nucleo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texGlow, color: '#dff0ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.add(nucleo);
    return this.cosa(m, dur, (u, t) => {
      const entra = Math.min(1, u * 8), sale = u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1;
      m.scale.set(radio * (0.3 + 0.7 * entra) * (1 + Math.sin(t * 9) * 0.03), radio * 0.78 * (0.3 + 0.7 * entra), radio * (0.3 + 0.7 * entra) * (1 + Math.cos(t * 7) * 0.03));
      m.scale.multiplyScalar(0.6 + 0.4 * sale); U.uT.value = t; U.uOp.value = entra * sale;
      m.rotation.y = t * 1.3; nucleo.scale.setScalar(0.9 + Math.sin(t * 13) * 0.1); nucleo.material.opacity = 0.6 * sale;
    });
  }
  grieta(p, { radio = 3.2, dur = 6, rot = Math.random() * 6.28 } = {}) {
    const [tb, to] = this.texGrietas[Math.floor(Math.random() * 2)];
    const geo = new THREE.PlaneGeometry(radio * 2, radio * 2).rotateX(-Math.PI / 2);
    const oscuro = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: to, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    const brillo = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tb, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3 }));
    const G = new THREE.Group(); G.add(oscuro, brillo); G.position.copy(p).add(new THREE.Vector3(0, 0.03, 0)); G.rotation.y = rot;
    return this.cosa(G, dur, (u) => { const e = Math.min(1, u * dur * 8); G.scale.setScalar(0.3 + 0.7 * e); brillo.material.opacity = Math.max(0, 1 - u * 3.5) * 1.4; oscuro.material.opacity = u < 0.7 ? 0.85 : 0.85 * (1 - (u - 0.7) / 0.3); });
  }
  /* ------------------------------------------------------------ piedritas */
  escombros(p, { n = 20, fuerza = 7, piso = p.y } = {}) {
    for (let i = 0; i < n && this.piedras.length < this.MAXE; i++) {
      const a = Math.random() * 6.28, h = 0.4 + Math.random();
      this.piedras.push({ p: p.clone().add(new THREE.Vector3(Math.cos(a) * 0.4, 0.1, Math.sin(a) * 0.4)), v: new THREE.Vector3(Math.cos(a) * fuerza * (0.3 + Math.random() * 0.5), fuerza * h, Math.sin(a) * fuerza * (0.3 + Math.random() * 0.5)), r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6), w: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9), t: 0, vida: 2.4 + Math.random(), e: 0.5 + Math.random() * 1.1, piso });
    }
  }
  /* ------------------------------------------------------------ recetas */
  /* después de t segundos, fn() */
  luego(t, fn) { this.tareas.push({ t, fn }); }
  /* el TearDrop: p es el centro del orbe (a la altura del pecho, adelante del que lo tira) */
  lagrima(p, piso = p.y - 1.4) {
    const azul = '#4f8dff', celeste = '#9fd8ff';
    /* el mundo se apaga mientras se carga, vuelve con el destello y se apaga un poco con el orbe */
    this.oscuroObj.push({ desde: this.t, hasta: this.t + 1.5, v: 0.75 }, { desde: this.t + 1.75, hasta: this.t + 3.9, v: 0.35 });
    /* 1. se junta la energía: cintas en espiral que se cierran hacia el centro y chispas que caen hacia él */
    for (let k = 0; k < 9; k++) {
      const a0 = k / 9 * Math.PI * 2, r0 = 2.6 + Math.random() * 1.4, alto = (Math.random() - 0.3) * 2.4, vueltas = 1.2 + Math.random() * 0.8;
      this.cinta({ color: k % 3 ? azul : celeste, ancho: 0.1 + Math.random() * 0.1, dur: 1.25, camino: (u, t) => {
        const q = Math.min(1, t / 1.15), rr = r0 * (1 - q) * (1 - u * 0.25), a = a0 + q * vueltas * 6.28 + u * 1.3;
        return new THREE.Vector3(p.x + Math.cos(a) * rr, p.y + alto * (1 - q) + Math.sin(u * 3 + t * 8) * 0.12 * (1 - q), p.z + Math.sin(a) * rr);
      } });
    }
    for (let i = 0; i < 90; i++) this.luego(Math.random() * 1.0, () => { const d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.4, Math.random() - 0.5).normalize(); const r = 2.5 + Math.random() * 2; this.chispa({ p: p.clone().addScaledVector(d, r), v: d.clone().multiplyScalar(-r * 2.2), vida: 0.45, tam: 0.25, color: new THREE.Color(celeste), color2: new THREE.Color('#ffffff'), arrastre: 0.5 }); });
    for (let i = 0; i < 6; i++) this.luego(0.2 + i * 0.15, () => this.rayo(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.2) * 3, (Math.random() - 0.5) * 5)), p.clone(), { dur: 0.22 }));
    /* 2. se aprieta en una estrella (la línea vertical fina del video) */
    this.luego(1.15, () => { this.destelloEn(p, { tam: 5, dur: 0.45, estrella: true }); this.cinta({ color: celeste, ancho: 0.05, puntos: 6, dur: 0.45, op: 1.5, camino: (u) => new THREE.Vector3(p.x, p.y - 1.8 + u * 3.6, p.z) }); });
    /* 3. el destello: pantalla blanca, onda en el piso, grietas y la cámara que tiembla */
    this.luego(1.55, () => {
      this.destello = 0.55; this.sacudida = 0.55;
      this.destelloEn(p, { tam: 16, dur: 0.6, color: '#dff0ff' });
      const piso3 = new THREE.Vector3(p.x, piso, p.z);
      this.onda(piso3, { radio: 9, dur: 0.8 }); this.onda(piso3, { radio: 5, dur: 1.1, color: '#9fd8ff' });
      this.grieta(piso3, { radio: 3.6, dur: 7 });
      this.chispas(p, { n: 120, vel: 12, vida: 0.9, tam: 0.3, color: celeste, arrastre: 2.5 });
      this.escombros(piso3, { n: 26, fuerza: 8 });
      /* 4. el orbe con las estelas que lo rodean y piedritas que giran */
      this.orbe(p, { radio: 2.2, dur: 2.3 });
      for (let k = 0; k < 12; k++) {
        const eje = new THREE.Vector3(Math.random() - 0.5, 0.3 + Math.random(), Math.random() - 0.5).normalize(), r = 1.9 + Math.random() * 1.1, f = Math.random() * 6.28, v = 3 + Math.random() * 2.5;
        const u1 = new THREE.Vector3(1, 0, 0).cross(eje).normalize(), u2 = eje.clone().cross(u1);
        this.cinta({ color: k % 2 ? azul : '#2f5dff', ancho: 0.14 + Math.random() * 0.12, dur: 2.2, op: 0.9, camino: (u, t) => { const a = f + t * v - u * 1.6; return p.clone().addScaledVector(u1, Math.cos(a) * r).addScaledVector(u2, Math.sin(a) * r * 0.75); } });
      }
      for (let i = 0; i < 60; i++) this.luego(Math.random() * 2, () => { const d = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).normalize(); this.chispa({ p: p.clone().addScaledVector(d, 1.8), v: d.multiplyScalar(2 + Math.random() * 3), vida: 0.6, tam: 0.22, color: new THREE.Color(celeste), color2: new THREE.Color(azul), arrastre: 1, remolino: 3, centro: p.clone() }); });
    });
    /* 5. se deshace: cientos de chispitas que suben despacio, y un último anillo */
    this.luego(3.7, () => {
      this.destelloEn(p, { tam: 6, dur: 0.5 });
      this.chispas(p, { n: 260, vel: 3.5, vida: 2.4, tam: 0.14, color: '#bfe4ff', color2: '#4f8dff', arrastre: 1.2, subir: 1.2 });
      this.onda(new THREE.Vector3(p.x, piso, p.z), { radio: 4, dur: 0.9, color: '#bfe4ff' });
    });
  }
  /* los portales: un remolino chico, un destello y chispas que suben */
  portal(p) {
    this.destelloEn(p.clone().add(new THREE.Vector3(0, 1, 0)), { tam: 5, dur: 0.45 });
    this.onda(p, { radio: 3, dur: 0.6, color: '#7fe8ff' });
    this.chispas(p.clone().add(new THREE.Vector3(0, 0.8, 0)), { n: 60, vel: 3, vida: 0.9, tam: 0.22, color: '#7fe8ff', subir: 2, remolino: 4 });
    this.destello = Math.max(this.destello, 0.35);
  }
  /* caer fuerte: grietas, polvo en anillo, piedritas y la cámara que tiembla (el video de movimiento) */
  impacto(p, fuerza = 1) {
    this.grieta(p, { radio: 1.4 + fuerza * 1.2, dur: 5 });
    this.onda(p, { radio: 2 + fuerza * 2, dur: 0.5, color: '#dfe8ff' });
    this.chispas(p.clone().add(new THREE.Vector3(0, 0.1, 0)), { n: Math.round(24 + fuerza * 20), vel: 4 + fuerza * 2, vida: 0.7, tam: 0.35, color: '#e8eef8', color2: '#b8c4d8', grav: 6, arrastre: 3, esfera: false, subir: 0.6 });
    this.escombros(p, { n: Math.round(6 + fuerza * 8), fuerza: 4 + fuerza * 2 });
    this.sacudida = Math.max(this.sacudida, 0.18 + fuerza * 0.2);
  }
  /* festejo: fuegos artificiales chiquitos de colores */
  festejo(p) {
    const cols = ['#ff6fb0', '#ffd23f', '#56d05a', '#39b8f0', '#b87bff'];
    for (let i = 0; i < 5; i++) this.luego(i * 0.18, () => { const q = p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 2.5 + Math.random() * 2, (Math.random() - 0.5) * 3)); this.chispas(q, { n: 50, vel: 5, vida: 1.1, tam: 0.26, color: cols[i % 5], grav: 3, arrastre: 1.4 }); this.destelloEn(q, { tam: 3, dur: 0.3, color: cols[i % 5] }); });
  }
  /* polvo al deslizarse o correr por la pared */
  polvo(p, dir) {
    this.chispa({ p: p.clone(), v: new THREE.Vector3(-dir.x * 1.5 + (Math.random() - 0.5), 0.6 + Math.random() * 0.8, -dir.z * 1.5 + (Math.random() - 0.5)), vida: 0.55, tam: 0.45, color: new THREE.Color('#e9eef6'), color2: new THREE.Color('#aab6c8'), arrastre: 3, grav: -0.5 });
  }

  /* ------------------------------------------------------------ cada cuadro */
  actualizar(dt, cam, alto) {
    this.t += dt;
    if (alto) this.uEscala.value = alto * 0.5 / Math.tan((cam.fov * Math.PI / 180) / 2);
    for (let i = this.tareas.length - 1; i >= 0; i--) { const T = this.tareas[i]; T.t -= dt; if (T.t <= 0) { this.tareas.splice(i, 1); T.fn(); } }
    /* chispas */
    let n = 0;
    for (let i = 0; i < MAX; i++) {
      const P = this.p[i];
      if (!P.vivo) { this.col[i * 4 + 3] = 0; this.tam[i] = 0; continue; }
      P.t += dt; const u = P.t / P.vida; if (u >= 1) { P.vivo = false; this.col[i * 4 + 3] = 0; this.tam[i] = 0; continue; }
      const k = Math.exp(-P.arrastre * dt); P.vx *= k; P.vy *= k; P.vz *= k; P.vy -= P.grav * dt;
      if (P.remolino && P.centro) { const dx = P.x - P.centro.x, dz = P.z - P.centro.z; P.vx += -dz * P.remolino * dt; P.vz += dx * P.remolino * dt; }
      P.x += P.vx * dt; P.y += P.vy * dt; P.z += P.vz * dt;
      this.pos[i * 3] = P.x; this.pos[i * 3 + 1] = P.y; this.pos[i * 3 + 2] = P.z;
      this.col[i * 4] = P.c.r + (P.c2.r - P.c.r) * u; this.col[i * 4 + 1] = P.c.g + (P.c2.g - P.c.g) * u; this.col[i * 4 + 2] = P.c.b + (P.c2.b - P.c.b) * u;
      this.col[i * 4 + 3] = Math.min(1, (1 - u) * 1.6) * Math.min(1, P.t * 12);
      this.tam[i] = P.tam * (1 - u * 0.5); n++;
    }
    const G = this.puntos.geometry; G.attributes.position.needsUpdate = G.attributes.aCol.needsUpdate = G.attributes.aTam.needsUpdate = true;
    this.puntos.visible = n > 0;
    /* cintas: se rehacen mirando a la cámara */
    const cp = cam.position;
    for (let i = this.cintas.length - 1; i >= 0; i--) {
      const C = this.cintas[i]; C.t += dt; const u = C.t / C.dur;
      if (u >= 1) { this.g.remove(C.m); C.m.geometry.dispose(); C.m.material.dispose(); this.cintas.splice(i, 1); continue; }
      const pts = []; for (let j = 0; j < C.n; j++) pts.push(C.camino(j / (C.n - 1), C.t, dt));
      const pos = C.m.geometry.attributes.position.array;
      for (let j = 0; j < C.n; j++) {
        const a = pts[Math.max(0, j - 1)], b = pts[Math.min(C.n - 1, j + 1)], p = pts[j];
        const tg = this.v.subVectors(b, a).normalize(), aCam = this.s.subVectors(cp, p).normalize(), lado = tg.cross(aCam).normalize().multiplyScalar(C.ancho * (0.4 + 0.6 * j / (C.n - 1)));
        pos[j * 6] = p.x + lado.x; pos[j * 6 + 1] = p.y + lado.y; pos[j * 6 + 2] = p.z + lado.z; pos[j * 6 + 3] = p.x - lado.x; pos[j * 6 + 4] = p.y - lado.y; pos[j * 6 + 5] = p.z - lado.z;
      }
      C.m.geometry.attributes.position.needsUpdate = true;
      C.m.material.uniforms.uOp.value = C.op * Math.min(1, (1 - u) * 4) * Math.min(1, C.t * 10);
    }
    /* destellos, ondas, orbes, grietas */
    for (let i = this.cosas.length - 1; i >= 0; i--) {
      const C = this.cosas[i]; C.t += dt; const u = C.t / C.dur;
      if (u >= 1) { this.g.remove(C.obj); C.obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); this.cosas.splice(i, 1); continue; }
      C.fn(u, C.t);
    }
    /* piedritas */
    let k2 = 0;
    for (let i = this.piedras.length - 1; i >= 0; i--) {
      const P = this.piedras[i]; P.t += dt; if (P.t > P.vida) { this.piedras.splice(i, 1); continue; }
      P.v.y -= 22 * dt; P.p.addScaledVector(P.v, dt); P.r.addScaledVector(P.w, dt);
      if (P.p.y < P.piso + 0.08) { P.p.y = P.piso + 0.08; P.v.y = Math.abs(P.v.y) * 0.35; P.v.x *= 0.6; P.v.z *= 0.6; P.w.multiplyScalar(0.6); }
    }
    for (const P of this.piedras) {
      const e = P.e * Math.min(1, (P.vida - P.t) * 2);
      this.m4.compose(P.p, this.q.setFromEuler(this.e.set(P.r.x, P.r.y, P.r.z)), this.s.set(e, e, e)); this.esc.setMatrixAt(k2++, this.m4);
    }
    this.esc.count = k2; this.esc.instanceMatrix.needsUpdate = true;
    this.destello = Math.max(0, this.destello - dt * 3.2);
    let osc = 0; for (let i = this.oscuroObj.length - 1; i >= 0; i--) { const O = this.oscuroObj[i]; if (this.t > O.hasta) { this.oscuroObj.splice(i, 1); continue; } if (this.t >= O.desde) osc = Math.max(osc, O.v * Math.min(1, (this.t - O.desde) * 3)); }
    this.oscuro += (osc - this.oscuro) * Math.min(1, dt * 6);
  }
  /* borra todo (al cambiar de reino) */
  vaciar() {
    for (const C of this.cintas) { this.g.remove(C.m); C.m.geometry.dispose(); C.m.material.dispose(); }
    for (const C of this.cosas) this.g.remove(C.obj);
    this.cintas.length = 0; this.cosas.length = 0; this.tareas.length = 0; this.piedras.length = 0; this.oscuroObj.length = 0; this.oscuro = 0;
    for (const P of this.p) P.vivo = false;
  }
}

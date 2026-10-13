// Un ParticleSystem de Unity (lo que gltf.py deja en extras.particulas) simulado y dibujado en three.js:
// emisión por tiempo y ráfagas, forma (cono, esfera, círculo, caja), vida, velocidad, tamaño, rotación,
// color de inicio y a lo largo de la vida, fuerza, y partículas de frente a la cámara con el material
// del juego (el shader recibe in_POSITION0, in_TEXCOORD0, in_COLOR0 en coordenadas de mundo, como el
// ParticleSystemRenderer de Unity).
//
//   const p = new ParticulasUnity(THREE, unity, nodo, nodo.userData.particulas);
//   escena.add(p.malla);
//   p.play();  … cada cuadro: p.update(dt, camara, altoPantallaPx)
//
// Unity mira las curvas con Hermite (las pendientes de cada clave); los gradientes, lineales.

const FORMA = { esfera: 0, semiesfera: 2, cono: 4, caja: 5, conoVolumen: 8, circulo: 10 };

export function evaluarCurva(c, t) {
  // c: [[tiempo, valor, pendienteEntrada, pendienteSalida], …]
  if (!c || !c.length) return 1;
  if (t <= c[0][0]) return c[0][1];
  const u = c[c.length - 1];
  if (t >= u[0]) return u[1];
  let i = 0;
  while (i < c.length - 2 && t > c[i + 1][0]) i++;
  const [t0, v0, , m0] = c[i], [t1, v1, m1] = c[i + 1];
  const d = t1 - t0;
  if (!isFinite(m0) || !isFinite(m1)) return v0;          // pendiente infinita: escalón
  const s = (t - t0) / d, s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * v0 + (s3 - 2 * s2 + s) * d * m0 + (-2 * s3 + 3 * s2) * v1 + (s3 - s2) * d * m1;
}

// MinMaxCurve: t = tiempo normalizado (0..1); azar = 0..1 fijo por partícula
export function valorMM(mm, t = 0, azar = Math.random()) {
  if (!mm) return 0;
  switch (mm.m) {
    case 0: return mm.k;
    case 1: return mm.k * evaluarCurva(mm.c, t);
    case 2: { const a = evaluarCurva(mm.c0, t), b = evaluarCurva(mm.c, t); return mm.k * (a + (b - a) * azar); }
    case 3: return mm.k0 + (mm.k - mm.k0) * azar;
    default: return mm.k;
  }
}

function evaluarGradiente(g, t, out) {
  const col = g.col, al = g.alfa;
  const tramo = (claves, n) => {
    if (t <= claves[0][0]) return claves[0].slice(1, 1 + n);
    const u = claves[claves.length - 1];
    if (t >= u[0]) return u.slice(1, 1 + n);
    let i = 0;
    while (i < claves.length - 2 && t > claves[i + 1][0]) i++;
    const a = claves[i], b = claves[i + 1], f = g.modo === 1 ? 0 : (t - a[0]) / (b[0] - a[0]);
    const r = [];
    for (let k = 1; k <= n; k++) r.push(a[k] + (b[k] - a[k]) * f);
    return r;
  };
  const [r, gg, b] = tramo(col, 3), [a] = tramo(al, 1);
  out[0] = r; out[1] = gg; out[2] = b; out[3] = a;
  return out;
}

export function colorMM(mm, t, azar, out) {
  if (!mm) { out[0] = out[1] = out[2] = out[3] = 1; return out; }
  switch (mm.m) {
    case 0: for (let i = 0; i < 4; i++) out[i] = mm.color[i]; return out;
    case 1: return evaluarGradiente(mm.grad, t, out);
    case 2: for (let i = 0; i < 4; i++) out[i] = mm.color0[i] + (mm.color[i] - mm.color0[i]) * azar; return out;
    case 3: {
      const a = evaluarGradiente(mm.grad0, t, [0, 0, 0, 0]), b = evaluarGradiente(mm.grad, t, [0, 0, 0, 0]);
      for (let i = 0; i < 4; i++) out[i] = a[i] + (b[i] - a[i]) * azar;
      return out;
    }
    case 4: return evaluarGradiente(mm.grad, azar, out);
    default: out[0] = out[1] = out[2] = out[3] = 1; return out;
  }
}

export class ParticulasUnity {
  constructor(THREE, unity, nodo, spec) {
    this.T = THREE;
    this.nodo = nodo;
    this.s = spec;
    this.max = Math.min(spec.ini.max || 1000, 2000);
    this.vivas = [];
    this.emitiendo = false;
    this.tiempo = 0;          // del ciclo (lengthInSec)
    this.acumulado = 0;       // partículas a emitir (fracción)
    const g = this.geo = new THREE.BufferGeometry();
    const n = this.max * 4;
    this.pos = new Float32Array(n * 3);
    this.uv = new Float32Array(n * 2);
    this.col = new Float32Array(n * 4);
    const idx = new Uint32Array(this.max * 6);
    for (let i = 0; i < this.max; i++) {
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
      this.uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
    }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setAttribute('in_POSITION0', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('in_TEXCOORD0', new THREE.BufferAttribute(this.uv, 2));
    g.setAttribute('in_COLOR0', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('position', g.attributes.in_POSITION0);
    g.setDrawRange(0, 0);
    const mat = (spec.material && unity.material(spec.material)) || new THREE.MeshBasicMaterial({ transparent: true });
    this.malla = new THREE.Mesh(g, mat);
    this.malla.frustumCulled = false;
    this.malla.matrixAutoUpdate = false;    // los vértices ya van en mundo
    if (mat.userData && mat.userData.cola !== undefined) this.malla.renderOrder = mat.userData.cola;
    this.visible = true;
    // marco del emisor (sin escala: scalingMode Shape) y escala de la forma
    this._p = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._e = new THREE.Vector3();
    this._v = new THREE.Vector3(); this._d = new THREE.Vector3(); this._f = new THREE.Vector3();
    this._der = new THREE.Vector3(); this._arr = new THREE.Vector3(); this._c = [0, 0, 0, 0]; this._c2 = [0, 0, 0, 0];
  }

  // ParticleSystem.Play / Stop / Clear / IsAlive
  play() { if (!this.emitiendo) { this.emitiendo = true; this.tiempo = 0; this.acumulado = 0; this.rafagasHechas = new Set(); } }
  stop(limpiar = false) { this.emitiendo = false; if (limpiar) this.clear(); }
  clear() { this.vivas.length = 0; this.geo.setDrawRange(0, 0); }
  get vivo() { return this.emitiendo || this.vivas.length > 0; }

  marco() {
    this.nodo.updateWorldMatrix(true, false);
    this.nodo.matrixWorld.decompose(this._p, this._q, this._e);
  }

  emitir(n) {
    const s = this.s, ini = s.ini, T = this.T;
    for (let k = 0; k < n && this.vivas.length < this.max; k++) {
      const azar = Math.random();
      const vida = valorMM(ini.startLifetime, 0, Math.random());
      const p = new T.Vector3(), d = new T.Vector3(0, 0, 1);
      const f = s.forma;
      if (f) {
        const R = f.radio * (1 - Math.random() * (f.grosor ?? 1));
        if (f.tipo === FORMA.cono || f.tipo === FORMA.conoVolumen || f.tipo === FORMA.circulo) {
          const ang = Math.random() * Math.PI * 2 * Math.min(1, (f.arco ?? 360) / 360 || 1);
          const r = Math.sqrt(Math.random());
          p.set(Math.cos(ang) * r * R, Math.sin(ang) * r * R, 0);
          if (f.tipo === FORMA.circulo) d.set(Math.cos(ang), Math.sin(ang), 0);
          else {
            const a = (f.angulo * Math.PI / 180) * r;
            d.set(Math.cos(ang) * Math.sin(a), Math.sin(ang) * Math.sin(a), Math.cos(a));
          }
        } else if (f.tipo === FORMA.esfera || f.tipo === FORMA.semiesfera) {
          d.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
          if (f.tipo === FORMA.semiesfera) d.z = Math.abs(d.z);
          p.copy(d).multiplyScalar(R * Math.cbrt(Math.random()));
        } else if (f.tipo === FORMA.caja) {
          p.set((Math.random() - 0.5) * f.escala[0], (Math.random() - 0.5) * f.escala[1], (Math.random() - 0.5) * f.escala[2]);
        }
        p.add(this._v.fromArray(f.pos));
      }
      // la escala del nodo sólo cuenta para la forma (scalingMode Shape); x espejada en glTF
      p.multiply(this._e);
      const rapidez = valorMM(ini.startSpeed, 0, Math.random());
      const c = colorMM(ini.color, 0, Math.random(), [0, 0, 0, 0]);
      this.vivas.push({ edad: 0, vida, p, v: d.multiplyScalar(rapidez), tam: valorMM(ini.startSize, 0, Math.random()),
        rot: valorMM(ini.startRotation, 0, Math.random()), giro: s.rot ? valorMM(s.rot.curve, 0, Math.random()) : 0,
        color: c, azar });
    }
  }

  update(dt, cam, altoPx) {
    const s = this.s;
    if (!this.visible) { this.geo.setDrawRange(0, 0); return; }
    this.marco();
    dt *= s.velSim ?? 1;
    if (this.emitiendo) {
      this.tiempo += dt;
      if (this.tiempo > s.dur) {
        if (s.bucle) { this.tiempo -= s.dur; this.rafagasHechas = new Set(); } else this.emitiendo = false;
      }
      if (this.emitiendo && s.emision) {
        this.acumulado += valorMM(s.emision.rateOverTime, this.tiempo / s.dur) * dt;
        const n = Math.floor(this.acumulado);
        this.acumulado -= n;
        this.emitir(n);
        for (const [i, r] of s.emision.rafagas.entries()) {
          if (!this.rafagasHechas.has(i) && this.tiempo >= r.t) {
            this.rafagasHechas.add(i);
            this.emitir(Math.round(typeof r.n === 'object' ? valorMM(r.n) : r.n || 0));
          }
        }
      }
    }
    // fuerza en el espacio de la simulación (local sin escala: la de mundo se rota al marco)
    const fz = s.fuerza;
    if (fz) {
      this._f.set(valorMM(fz.x), valorMM(fz.y), valorMM(fz.z));
      if (fz.mundo) this._f.applyQuaternion(this._q.clone().invert());
    }
    const vivas = this.vivas;
    for (let i = vivas.length - 1; i >= 0; i--) {
      const q = vivas[i];
      q.edad += dt;
      if (q.edad >= q.vida) { vivas.splice(i, 1); continue; }
      if (fz) q.v.addScaledVector(this._f, dt);
      q.p.addScaledVector(q.v, dt);
      q.rot += q.giro * dt;
    }
    // las caras de frente a la cámara (en mundo)
    cam.updateMatrixWorld();
    const der = this._der.setFromMatrixColumn(cam.matrixWorld, 0).normalize();
    const arr = this._arr.setFromMatrixColumn(cam.matrixWorld, 1).normalize();
    const camPos = cam.getWorldPosition(this._d.clone());
    const tanMedio = Math.tan((cam.fov * Math.PI / 180) / 2);
    const P = this.pos, C = this.col;
    let n = 0;
    for (const q of vivas) {
      const t = q.edad / q.vida;
      let tam = q.tam * (s.tam ? valorMM(s.tam.curve, t, q.azar) : 1);
      const w = this._v.copy(q.p).applyQuaternion(this._q).add(this._p);
      // m_MaxParticleSize: fracción del alto de la pantalla
      if (s.render && s.render.tamMax) {
        const dist = w.distanceTo(camPos), maxMundo = s.render.tamMax * 2 * dist * tanMedio;
        if (tam > maxMundo) tam = maxMundo;
      }
      const h = tam / 2, cr = Math.cos(-q.rot) * h, sr = Math.sin(-q.rot) * h;
      // esquinas (−,−) (+,−) (+,+) (−,+) giradas en el plano de la pantalla
      const esq = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let k = 0; k < 4; k++) {
        const [a, b] = esq[k], x = a * cr - b * sr, y = a * sr + b * cr, o = (n * 4 + k) * 3;
        P[o] = w.x + der.x * x + arr.x * y; P[o + 1] = w.y + der.y * x + arr.y * y; P[o + 2] = w.z + der.z * x + arr.z * y;
      }
      const c = s.colorVida ? colorMM(s.colorVida, t, q.azar, this._c) : null;
      for (let k = 0; k < 4; k++) {
        const o = (n * 4 + k) * 4;
        for (let j = 0; j < 4; j++) C[o + j] = q.color[j] * (c ? c[j] : 1);
      }
      n++;
    }
    this.geo.attributes.in_POSITION0.needsUpdate = true;
    this.geo.attributes.in_COLOR0.needsUpdate = true;
    this.geo.setDrawRange(0, n * 6);
  }
}

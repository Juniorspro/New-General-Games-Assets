/* ============================================================================
   aeroplaza/js/pelotita.js — LA PELOTITA DEL VR (vuelta 43): "que los que
   están en VR sean pelotitas flotantes con manos visibles que otros pueden
   ver". Quien juega en VR con la pelotita prendida manda en su estado la
   cabeza (dónde y para dónde mira, respecto de sus pies) y los 21 puntos de
   cada mano (en cm, respecto de la cabeza, en el mundo). Los demás lo ven
   así: una bola de gelatina de su color, con ojitos que miran para donde mira
   y sus dos manos de vidrio flotando, moviéndose como las mueve.
   - Llega ~10 veces por segundo: todo se acerca a lo último con 1 − e^(−15·dt).
   - Lo que llega se revisa: 7 números para la cabeza (a menos de 3 m de los
     pies, el giro normalizado) y 63 enteros por mano (a menos de 2,5 m).
   - Sin datos de VR en 1,5 s, vuelve el muñeco.
   ========================================================================== */
import * as THREE from 'three';

/* los huesos de la mano de MediaPipe: de la muñeca a cada dedo y la palma */
const HUESOS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
const RADIO = 0.16, VIDA = 1500;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);
let geoBola = null, geoJunta = null, geoHueso = null, matMano = null, matOjo = null;
function geos() {
  if (geoBola) return;
  geoBola = new THREE.SphereGeometry(RADIO, 32, 20);
  geoJunta = new THREE.SphereGeometry(1, 10, 8);
  geoHueso = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
  matMano = new THREE.MeshStandardMaterial({ color: '#bfeaff', emissive: '#3aa8e8', emissiveIntensity: 0.35, roughness: 0.2, transparent: true, opacity: 0.8 });
  matOjo = new THREE.MeshBasicMaterial({ color: '#1b2a3a' });
}

/* revisar lo que llega (de otro jugador: no se cree nada) */
export function leerVR(vr) {
  if (!vr || typeof vr !== 'object' || !Array.isArray(vr.h) || vr.h.length !== 7 || !vr.h.every(Number.isFinite)) return null;
  const [x, y, z, qx, qy, qz, qw] = vr.h;
  if (Math.hypot(x, y, z) > 3) return null;
  const l = Math.hypot(qx, qy, qz, qw); if (l < 0.5 || l > 1.5) return null;
  const m = [null, null];
  if (Array.isArray(vr.m)) for (let k = 0; k < 2; k++) {
    const a = vr.m[k];
    if (Array.isArray(a) && a.length === 63 && a.every((v) => Number.isInteger(v) && Math.abs(v) <= 250)) m[k] = Float32Array.from(a, (v) => v / 100);
  }
  return { h: [x, y, z, qx / l, qy / l, qz / l, qw / l], m };
}
/* lo que se manda: la cabeza respecto de los pies y cada mano (21 puntos, cm, respecto de la cabeza) o 0 */
export function armarVR(cabP, cabQ, pies, manos) {
  const h = [+(cabP.x - pies.x).toFixed(2), +(cabP.y - pies.y).toFixed(2), +(cabP.z - pies.z).toFixed(2), +cabQ.x.toFixed(3), +cabQ.y.toFixed(3), +cabQ.z.toFixed(3), +cabQ.w.toFixed(3)];
  const m = manos.map((M) => {
    if (!M || !M.visible || !(M.alfa > 0.5)) return 0;
    const a = new Array(63);
    for (let i = 0; i < 21; i++) { M.punto(i, _a); a[i * 3] = clamp(Math.round((_a.x - cabP.x) * 100)); a[i * 3 + 1] = clamp(Math.round((_a.y - cabP.y) * 100)); a[i * 3 + 2] = clamp(Math.round((_a.z - cabP.z) * 100)); }
    return a;
  });
  return { h, m };
}
const clamp = (v) => Math.max(-250, Math.min(250, v));

export class Pelotita {
  constructor(escena, color = '#2f9bff', color2 = '#b8f0ff', nombre = '') {
    geos();
    this.escena = escena;
    this.grupo = new THREE.Group(); this.grupo.name = 'pelotita';
    this.cabeza = new THREE.Group(); this.grupo.add(this.cabeza);
    this.mat = new THREE.MeshStandardMaterial({ color, emissive: color2, emissiveIntensity: 0.22, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.93 });
    this.bola = new THREE.Mesh(geoBola, this.mat); this.cabeza.add(this.bola);
    /* (el brillo de la gelatina, arriba a un costado) */
    const brillo = new THREE.Mesh(geoJunta, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }));
    brillo.scale.set(0.045, 0.028, 0.02); brillo.position.set(-0.06, 0.09, -0.11); this.cabeza.add(brillo);
    /* los ojitos: dos óvalos adelante (−z es para donde mira) */
    for (const s of [-1, 1]) { const o = new THREE.Mesh(geoJunta, matOjo); o.scale.set(0.018, 0.034, 0.012); o.position.set(s * 0.05, 0.02, -RADIO * 0.93); this.cabeza.add(o); }
    /* las manos: 21 juntas y 21 huesos cada una, en una malla instanciada */
    this.manos = [0, 1].map(() => {
      const juntas = new THREE.InstancedMesh(geoJunta, matMano, 21), huesos = new THREE.InstancedMesh(geoHueso, matMano, HUESOS.length);
      juntas.frustumCulled = huesos.frustumCulled = false;
      this.grupo.add(juntas, huesos);
      return { juntas, huesos, p: new Float32Array(63), obj: null, alfa: 0 };
    });
    /* el nombre, arriba (el cartel del muñeco queda escondido con él) */
    const lc = document.createElement('canvas'); lc.width = 256; lc.height = 64; const g = lc.getContext('2d');
    g.font = '800 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 6; g.strokeStyle = 'rgba(10,40,70,0.8)'; g.strokeText(String(nombre).slice(0, 16), 128, 34); g.fillStyle = '#ffffff'; g.fillText(String(nombre).slice(0, 16), 128, 34);
    this.texNombre = new THREE.CanvasTexture(lc); this.texNombre.colorSpace = THREE.SRGBColorSpace;
    this.nombre = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texNombre, transparent: true, depthWrite: false })); this.nombre.scale.set(0.6, 0.15, 1);
    this.grupo.add(this.nombre);
    this.hObj = new THREE.Vector3(0, 1.5, 0); this.qObj = new THREE.Quaternion(); this.h = new THREE.Vector3(0, 1.5, 0); this.primera = true; this.t = 0;
    escena.add(this.grupo);
  }
  ponerColor(color, color2) { this.mat.color.set(color); this.mat.emissive.set(color2 || color); }
  /* lo último que llegó (ya revisado con leerVR) */
  poner(V) {
    this.hObj.set(V.h[0], V.h[1], V.h[2]); this.qObj.set(V.h[3], V.h[4], V.h[5], V.h[6]);
    for (let k = 0; k < 2; k++) this.manos[k].obj = V.m[k];
  }
  /* pies: dónde está el jugador (ya interpolado por remotos.js) */
  actualizar(dt, pies) {
    this.t += dt;
    const k = 1 - Math.exp(-dt * 15);
    if (this.primera) { this.h.copy(this.hObj); this.cabeza.quaternion.copy(this.qObj); this.primera = false; }
    else { this.h.lerp(this.hObj, k); this.cabeza.quaternion.slerp(this.qObj, k); }
    /* (flota: sube y baja 1,5 cm) */
    this.cabeza.position.copy(pies).add(this.h); this.cabeza.position.y += Math.sin(this.t * 2.2) * 0.015;
    const c = this.cabeza.position;
    this.nombre.position.set(c.x, c.y + RADIO + 0.14, c.z);
    for (const M of this.manos) {
      const hay = !!M.obj;
      if (hay) { if (M.alfa < 0.01) M.p.set(M.obj); else for (let i = 0; i < 63; i++) M.p[i] += (M.obj[i] - M.p[i]) * k; }
      M.alfa = hay ? Math.min(1, M.alfa + dt / 0.15) : Math.max(0, M.alfa - dt / 0.3);
      M.juntas.visible = M.huesos.visible = M.alfa > 0.01;
      if (!M.juntas.visible) continue;
      const s = 0.4 + 0.6 * M.alfa;
      for (let i = 0; i < 21; i++) {
        const r = (i === 0 ? 0.017 : [4, 8, 12, 16, 20].includes(i) ? 0.009 : 0.011) * s;
        _m.compose(_a.set(c.x + M.p[i * 3], c.y + M.p[i * 3 + 1], c.z + M.p[i * 3 + 2]), _q.identity(), _s.setScalar(r)); M.juntas.setMatrixAt(i, _m);
      }
      HUESOS.forEach(([i, j], n) => {
        _a.set(c.x + M.p[i * 3], c.y + M.p[i * 3 + 1], c.z + M.p[i * 3 + 2]); _b.set(c.x + M.p[j * 3], c.y + M.p[j * 3 + 1], c.z + M.p[j * 3 + 2]);
        const largo = Math.max(1e-4, _a.distanceTo(_b)); _c.subVectors(_b, _a).divideScalar(largo);
        _m.compose(_a.add(_b).multiplyScalar(0.5), _q.setFromUnitVectors(_Y, _c), _s.set(0.007 * s, largo, 0.007 * s)); M.huesos.setMatrixAt(n, _m);
      });
      M.juntas.instanceMatrix.needsUpdate = M.huesos.instanceMatrix.needsUpdate = true;
    }
  }
  get cabezaMundo() { return this.cabeza.position; }
  quitar() { this.grupo.removeFromParent(); this.mat.dispose(); this.texNombre.dispose(); this.nombre.material.dispose(); for (const M of this.manos) { M.juntas.dispose(); M.huesos.dispose(); } }
}
export { VIDA as VIDA_PELOTITA };

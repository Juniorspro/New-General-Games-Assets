/* ============================================================================
   aeroplaza/js/delfin.js — el delfín de Rezona (Tripo) y cómo nada.
   El modelo se normaliza a 2,6 m de largo y mirando a +z. Si no está, se usa
   uno armado acá con formas simples (así el juego anda igual).
   Un delfín suelto da vueltas y salta; montado, lo maneja el jugador: acelera
   solo, gira con el palito, salta con ⤒ y, si se lo tira para abajo, bucea.
   ========================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { brilloso } from './naturaleza.js';
import { girarHacia } from './jugador.js';

let MODELO = null;
/* giro fijo del modelo de Tripo (no respeta la orientación pedida: ver memoria/rezona.md) */
export const GIRO_DELFIN = { y: Math.PI };   // medido con pruebas/delfin.mjs: de fábrica mira a -z
export async function cargarDelfin() {
  const url = window.ARCHIVOS && window.ARCHIVOS['delfin.glb'];
  if (!url) return null;
  try {
    const b = Uint8Array.from(atob(url.slice(url.indexOf('base64,') + 7)), (c) => c.charCodeAt(0)).buffer;
    const g = await new GLTFLoader().parseAsync(b, '');
    const o = g.scene;
    const caja = new THREE.Box3().setFromObject(o), tam = caja.getSize(new THREE.Vector3()), c = caja.getCenter(new THREE.Vector3());
    /* el eje largo es el del cuerpo: se lleva a z */
    const largo = Math.max(tam.x, tam.y, tam.z);
    const envol = new THREE.Group(); o.position.sub(c); envol.add(o);
    if (tam.x === largo) o.parent.rotation.y = Math.PI / 2;
    envol.scale.setScalar(2.6 / largo);
    o.traverse((q) => { if (q.isMesh) { q.castShadow = true; if (q.material) { q.material.roughness = 0.25; q.material.envMapIntensity = 1.6; } } });
    MODELO = envol;
    return MODELO;
  } catch (e) { console.warn('delfín: no cargó el modelo', e); return null; }
}
function delfinArmado() {
  const g = new THREE.Group();
  const piel = brilloso('#5fb8ff', { roughness: 0.2, borde: 0.4 }), panza = brilloso('#eef8ff', { roughness: 0.25 });
  const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), piel); cuerpo.scale.set(0.9, 0.85, 2.6); g.add(cuerpo);
  const p2 = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 14), panza); p2.scale.set(0.8, 0.6, 2.3); p2.position.y = -0.12; g.add(p2);
  const hocico = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.3, 6, 12), piel); hocico.rotation.x = Math.PI / 2; hocico.position.set(0, -0.05, 1.35); g.add(hocico);
  const aleta = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 12), piel); aleta.scale.z = 0.35; aleta.rotation.x = -0.5; aleta.position.set(0, 0.52, -0.1); g.add(aleta);
  const cola = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 8), piel); cola.scale.set(1.8, 0.15, 0.7); cola.position.set(0, 0.05, -1.35); g.add(cola);
  for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), piel); a.scale.set(1.2, 0.15, 0.6); a.position.set(s * 0.45, -0.2, 0.35); a.rotation.z = s * 0.5; g.add(a); }
  for (const s of [-1, 1]) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: '#10223a', roughness: 0.1 })); o.position.set(s * 0.3, 0.1, 0.95); g.add(o); }
  g.traverse((q) => { if (q.isMesh) q.castShadow = true; });
  return g;
}
export function crearDelfinMalla() {
  const g = new THREE.Group();
  const m = MODELO ? MODELO.clone(true) : delfinArmado();
  m.rotation.y += GIRO_DELFIN.y;
  g.add(m);
  return g;
}

export class Delfin {
  /* centro y radio de la ronda que hace suelto; agua: altura del agua */
  constructor(grupo, centro, radio, agua = 0, fase = 0, { vuela = false, curva = null } = {}) {
    this.o = crearDelfinMalla(); grupo.add(this.o);
    this.c = centro; this.radio = radio; this.agua = agua; this.a = fase; this.vuela = vuela; this.curva = curva;
    this.p = new THREE.Vector3(); this.v = new THREE.Vector3(); this.rumbo = 0; this.vel = 0; this.salto = 0; this.jinete = null; this.t = fase * 3;
    this.bajoAgua = false;
    this.ponerEnRonda(0);
  }
  ponerEnRonda(dt) {
    this.a += dt * (5.5 / this.radio);
    const x = this.c.x + Math.cos(this.a) * this.radio, z = this.c.z + Math.sin(this.a) * this.radio;
    /* salta cada tanto: un arco fuera del agua */
    const ciclo = (this.t * 0.35) % 1, arco = ciclo < 0.18 ? Math.sin(ciclo / 0.18 * Math.PI) : 0;
    const y = this.agua - 0.25 + arco * 2.4 - (ciclo > 0.18 && ciclo < 0.5 ? Math.sin((ciclo - 0.18) / 0.32 * Math.PI) * 0.6 : 0);
    const dy = y - this.p.y;
    this.p.set(x, y, z);
    this.rumbo = Math.atan2(-Math.sin(this.a), Math.cos(this.a));
    this.o.position.copy(this.p);
    this.o.rotation.set(-Math.atan2(dy, Math.max(dt, 1e-3) * 5.5) * 0.9, this.rumbo, 0);
  }
  asiento() { return new THREE.Vector3(this.p.x, this.p.y + 0.42, this.p.z); }
  pos() { return this.p; }
  manejar(dt, E, quiere, cuanto, mundo) {
    /* montado: acelera, gira hacia donde apunta el palito (en ejes de cámara) */
    const obj = (E.corre ? 13 : 9) * Math.max(0.35, cuanto);
    this.vel += (obj - this.vel) * Math.min(1, dt * 1.5);
    if (cuanto > 0.1) this.rumbo = girarHacia(this.rumbo, Math.atan2(quiere.x, quiere.y), dt * 2.2);
    const f = new THREE.Vector3(Math.sin(this.rumbo), 0, Math.cos(this.rumbo));
    this.p.addScaledVector(f, this.vel * dt);
    const sup = this.agua - 0.08;   // el lomo afuera del agua: si no, el agua lo tapa
    if (this.salto > 0 || this.p.y > sup + 0.05) {
      this.v.y -= 22 * dt; this.p.y += this.v.y * dt;
      if (this.p.y <= sup && this.v.y < 0) { this.p.y = sup; this.v.y = 0; this.salto = 0; this.chapuzon = true; }
    } else if (E.baja) { this.p.y += (Math.max(mundo.altura(this.p.x, this.p.z) + 0.8, this.agua - 5) - this.p.y) * Math.min(1, dt * 1.5); }
    else this.p.y += (sup - this.p.y) * Math.min(1, dt * 3);
    if (E.salta && this.p.y > sup - 0.6 && this.salto === 0) { this.v.y = 11; this.salto = 1; this.p.y = sup + 0.06; this.chapuzon = true; }
    /* no se sube a la playa */
    const h = mundo.altura(this.p.x, this.p.z);
    if (h > this.agua - 0.6 && this.salto === 0) { this.p.addScaledVector(f, -this.vel * dt * 1.2); this.vel *= 0.5; }
    mundo.empujar(this.p, 0.8, 1);
    this.bajoAgua = this.p.y < this.agua - 1.2;
    this.o.position.copy(this.p);
    const incl = this.salto ? -Math.atan2(this.v.y, this.vel) * 0.7 : E.baja ? 0.25 : 0;
    this.o.rotation.set(incl, this.rumbo, -Math.sin(this.t * 3) * 0.05);
  }
  actualizar(dt) {
    this.t += dt;
    if (this.jinete) return;
    if (this.vuela && this.curva) {
      /* los delfines del cielo de la Aurora: siguen una curva que pasa por los aros */
      this.a = (this.a + dt * 0.035) % 1;
      const p = this.curva.getPointAt(this.a), q = this.curva.getPointAt((this.a + 0.004) % 1);
      this.p.copy(p); this.o.position.copy(p); this.o.lookAt(q);
      return;
    }
    this.ponerEnRonda(dt);
  }
}

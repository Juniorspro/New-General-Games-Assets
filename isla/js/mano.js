// Lo que tenés en la mano, en primera persona. Se dibuja en su propia pasada
// (con la profundidad limpia) para que nunca se meta adentro de una pared,
// pero en coordenadas del MUNDO: así lo alumbra la misma luz y le cae la
// misma sombra que al resto (bajo el techo de la choza, el pico se oscurece).
import * as THREE from '../vendor/three.module.min.js';
import { ITEMS, modeloItem } from './items.js';
import { matPixel } from './material.js';

const _q = new THREE.Quaternion(), _e = new THREE.Euler();
const suave = (t) => t * t * (3 - 2 * t);

// Dónde va cada cosa en la mano. Las herramientas se agarran del mango: el
// pivote es el puño (abajo a la derecha, fuera de cuadro) y la cabeza queda un
// poco a la derecha de la mira, así el golpe gira desde el puño como un brazo.
const POSE = {
  mano: { base: [0.38, -0.34, -0.52], rot: [0.1, 0.25, 0], esc: 1 },
  herramienta: { base: [0.5, -0.5, -0.62], rot: [-0.25, 0.35, 0.43], esc: 0.8 },
  cana: { base: [0.44, -0.46, -0.58], rot: [-0.6, 0.15, 0.4], esc: 1 },
  farol: { base: [0.36, -0.42, -0.62], rot: [0, 0.5, 0], esc: 0.68, pos: [0, -0.08, 0] },
  bloque: { base: [0.38, -0.38, -0.64], rot: [0.35, 0.7, 0], esc: 0.78, pos: [0, -0.08, 0] },
  item: { base: [0.36, -0.34, -0.6], rot: [0.3, 0.6, 0.1], esc: 0.8, pos: [0, -0.08, 0] },
};

export class Mano {
  constructor(escenaMano) {
    this.raiz = new THREE.Group();          // sigue a la cámara
    this.pivote = new THREE.Group();        // lo que se anima
    this.raiz.add(this.pivote);
    escenaMano.add(this.raiz);
    this.id = undefined;
    this.modelo = null;
    this.golpe = 0;          // progreso del golpe (0 = quieto)
    this.durGolpe = 0.45;
    this.tipo = 'mano';
    this.cambio = 1;         // 0 = bajada (cambiando de ítem), 1 = arriba
    this.pendiente = undefined;   // undefined = nada pendiente (null es 'mano vacía')
    this.impactoDado = true;
    this.punta = new THREE.Object3D();
    this.tiempo = 0;
    this.carga = 0;          // pala / caña
    this.puno = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 0.26).translate(0.02, -0.03, -0.08), matPixel('liso', { color: 0xf0b98a, texeles: 64, clave: 'piel' }));
  }

  poner(id) {
    if (id === this.id && this.pendiente === undefined) return;
    if (this.pendiente === id) return;
    this.pendiente = id;
  }

  armar(id) {
    if (this.modelo) this.pivote.remove(this.modelo);
    this.id = id;
    const it = id ? ITEMS[id] : null;
    let m;
    if (!it) { m = new THREE.Group(); m.add(this.puno); this.tipo = 'mano'; }
    else {
      m = modeloItem(id);
      this.tipo = it.herr || (it.tipo === 'bloque' ? 'bloque' : 'item');
    }
    const pose = POSE[!it ? 'mano' : it.herr === 'cana' ? 'cana' : it.herr === 'farol' ? 'farol' : it.tipo === 'herramienta' ? 'herramienta' : it.tipo === 'bloque' ? 'bloque' : 'item'];
    this.pose = pose;
    m.rotation.set(...pose.rot);
    m.scale.setScalar(pose.esc);
    if (pose.pos) m.position.set(...pose.pos);
    m.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
    this.punta.position.set(0, it && it.herr === 'cana' ? 1.35 : 0.6, 0);
    m.add(this.punta);
    this.modelo = m;
    this.pivote.add(m);
  }

  // Arranca un golpe. Devuelve false si todavía está en el anterior.
  golpear(dur) {
    if (this.golpe > 0 || this.cambio < 1) return false;
    this.durGolpe = dur; this.golpe = 0.0001; this.impactoDado = false;
    return true;
  }

  actualizar(dt, camara, jugador) {
    this.tiempo += dt;
    // cambiar de ítem: bajar, cambiar, subir
    if (this.pendiente !== undefined) {
      this.cambio = Math.max(0, this.cambio - dt * 7);
      if (this.cambio <= 0) { this.armar(this.pendiente); this.pendiente = undefined; }
    } else this.cambio = Math.min(1, this.cambio + dt * 5);
    this.raiz.position.copy(camara.position);
    this.raiz.quaternion.copy(camara.quaternion);

    let impacto = false;
    const b = (this.pose || POSE.mano).base;
    let rx = 0, ry = 0, rz = 0, px = b[0], py = b[1], pz = b[2];
    if (this.golpe > 0) {
      this.golpe += dt / this.durGolpe;
      const t = Math.min(1, this.golpe);
      if (!this.impactoDado && t >= 0.42) { this.impactoDado = true; impacto = true; }
      if (this.tipo === 'guadana') {
        // barrido horizontal
        const a = t < 0.3 ? -suave(t / 0.3) * 0.9 : -0.9 + suave(Math.min(1, (t - 0.3) / 0.35)) * 2.2 - (t > 0.65 ? suave((t - 0.65) / 0.35) * 1.3 : 0);
        ry = a; px += Math.sin(a) * -0.12;
      } else if (this.tipo === 'pala') {
        const a = Math.sin(Math.PI * t);
        pz -= a * 0.18; py -= a * 0.1; rx = -a * 0.5;
      } else if (this.tipo === 'cana') {
        const a = t < 0.35 ? suave(t / 0.35) : 1 - suave((t - 0.35) / 0.65);
        rx = t < 0.35 ? a * 0.9 : -(1 - a) * 0.4 + a * 0.9;
      } else if (this.tipo === 'mano' || this.tipo === 'item' || this.tipo === 'bloque') {
        const a = Math.sin(Math.PI * Math.min(1, t * 1.3));
        pz -= a * 0.22; px -= a * 0.08; rx = -a * 0.2;
      } else {
        // pico y hacha: levantar, bajar con fuerza, volver
        const sube = t < 0.3 ? suave(t / 0.3) : 1;
        const baja = t < 0.3 ? 0 : t < 0.48 ? suave((t - 0.3) / 0.18) : 1;
        const vuelve = t < 0.55 ? 0 : suave((t - 0.55) / 0.45);
        rx = sube * 0.95 - baja * 1.9 + vuelve * 0.95;
        py += sube * 0.06 - baja * 0.08 + vuelve * 0.02;
        rz = -baja * 0.15 * (1 - vuelve);
      }
      if (this.golpe >= 1) this.golpe = 0;
    }
    // caminar: el ítem se mece con los pasos
    const rap = Math.hypot(jugador.v.x, jugador.v.z);
    const k = Math.min(1, rap / 4) * (jugador.enPiso ? 1 : 0.3);
    px += Math.sin(jugador.bobFase) * 0.012 * k;
    py += -Math.abs(Math.cos(jugador.bobFase)) * 0.014 * k + Math.sin(this.tiempo * 1.7) * 0.004;
    py -= (1 - this.cambio) * 0.45;
    if (this.tipo === 'cana' && this.carga > 0) rx += this.carga * 0.5;
    this.pivote.position.set(px, py, pz);
    this.pivote.quaternion.setFromEuler(_e.set(rx, ry, rz));
    return impacto;
  }

  puntaMundo(out = new THREE.Vector3()) {
    this.raiz.updateMatrixWorld(true);
    return this.punta.getWorldPosition(out);
  }
}

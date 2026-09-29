// El náufrago, para la vista en tercera persona (tecla V): de bloques, como
// todo, con camisa celeste, short de playa y el ítem de la barra en la mano
// derecha. Camina moviendo piernas y brazos en contra, nada boca abajo y
// golpea con el mismo gesto de la mano de primera persona.
import * as THREE from '../vendor/three.module.min.js';
import { matPixel } from './material.js';
import { modeloItem } from './items.js';

const caja = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const liso = (color, clave) => matPixel('liso', { color, texeles: 24, clave });
const _v = new THREE.Vector3();

export class Personaje {
  constructor(escena) {
    const g = (this.grupo = new THREE.Group());
    const piel = liso(0xf0b98a, 'piel'), camisa = liso(0x3aa6d8, 'camisa'), short = liso(0xe8b42f, 'short'), pelo = liso(0x5b3413, 'pelo'), ojo = liso(0x15181f, 'ojo');
    this.cuerpo = new THREE.Group();
    g.add(this.cuerpo);
    const torso = new THREE.Mesh(caja(0.5, 0.62, 0.28, 0, 1.12, 0), camisa);
    const cadera = new THREE.Mesh(caja(0.5, 0.2, 0.3, 0, 0.74, 0), short);
    this.cuerpo.add(torso, cadera);
    this.cabeza = new THREE.Group();
    this.cabeza.add(new THREE.Mesh(caja(0.4, 0.4, 0.4, 0, 0.2, 0), piel));
    this.cabeza.add(new THREE.Mesh(caja(0.42, 0.12, 0.42, 0, 0.38, 0), pelo));
    this.cabeza.add(new THREE.Mesh(caja(0.42, 0.24, 0.08, 0, 0.26, -0.18), pelo));
    this.cabeza.add(new THREE.Mesh(caja(0.07, 0.07, 0.02, -0.09, 0.22, 0.205), ojo));
    this.cabeza.add(new THREE.Mesh(caja(0.07, 0.07, 0.02, 0.09, 0.22, 0.205), ojo));
    this.cabeza.position.set(0, 1.43, 0);
    this.cuerpo.add(this.cabeza);
    const miembro = (x, y, w, largo, mat) => {
      const p = new THREE.Group();
      p.add(new THREE.Mesh(caja(w, largo, w, 0, -largo / 2, 0), mat));
      p.position.set(x, y, 0);
      this.cuerpo.add(p);
      return p;
    };
    this.brazoI = miembro(-0.33, 1.4, 0.16, 0.6, piel);
    this.brazoD = miembro(0.33, 1.4, 0.16, 0.6, piel);
    this.piernaI = miembro(-0.12, 0.66, 0.2, 0.66, piel);
    this.piernaD = miembro(0.12, 0.66, 0.2, 0.66, piel);
    // mangas y botamangas, para que no parezca todo piel
    this.brazoI.add(new THREE.Mesh(caja(0.18, 0.2, 0.18, 0, -0.08, 0), camisa));
    this.brazoD.add(new THREE.Mesh(caja(0.18, 0.2, 0.18, 0, -0.08, 0), camisa));
    this.piernaI.add(new THREE.Mesh(caja(0.22, 0.22, 0.22, 0, -0.1, 0), short));
    this.piernaD.add(new THREE.Mesh(caja(0.22, 0.22, 0.22, 0, -0.1, 0), short));
    this.mano = new THREE.Group();
    this.mano.position.set(0, -0.58, 0.06);
    this.brazoD.add(this.mano);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.visible = false;
    escena.add(g);
    this.id = undefined;
    this.item = null;
  }

  poner(id) {
    if (id === this.id) return;
    this.id = id;
    if (this.item) this.mano.remove(this.item);
    this.item = id ? modeloItem(id) : null;
    if (this.item) { this.item.rotation.set(Math.PI / 2, 0, 0); this.item.scale.setScalar(0.9); this.mano.add(this.item); }
  }

  // golpe: 0..1 del gesto de la mano (0 = quieto)
  actualizar(dt, jugador, golpe, visible) {
    const g = this.grupo;
    g.visible = visible;
    if (!visible) return;
    g.position.copy(jugador.p);
    g.rotation.y = jugador.yaw + Math.PI;
    const rap = Math.hypot(jugador.v.x, jugador.v.z);
    const k = Math.min(1, rap / 4.4);
    const s = Math.sin(jugador.bobFase);
    if (jugador.nadando) {
      // nadar: acostado, patadas cortas y brazada
      this.cuerpo.rotation.x = -1.1;
      this.cuerpo.position.set(0, 0.9, 0.4);
      this.piernaI.rotation.x = Math.sin(performance.now() / 120) * 0.4;
      this.piernaD.rotation.x = -this.piernaI.rotation.x;
      this.brazoI.rotation.x = -2.6 + Math.sin(performance.now() / 300) * 0.9;
      this.brazoD.rotation.x = -2.6 - Math.sin(performance.now() / 300) * 0.9;
    } else {
      this.cuerpo.rotation.x = -k * 0.08;
      this.cuerpo.position.set(0, Math.abs(s) * 0.05 * k, 0);
      this.piernaI.rotation.x = s * 0.75 * k;
      this.piernaD.rotation.x = -s * 0.75 * k;
      this.brazoI.rotation.x = -s * 0.6 * k;
      this.brazoD.rotation.x = s * 0.6 * k;
      if (!jugador.enPiso) { this.piernaI.rotation.x = 0.4; this.piernaD.rotation.x = -0.25; }
    }
    // el golpe: levantar y bajar el brazo derecho
    if (golpe > 0) {
      const a = golpe < 0.35 ? golpe / 0.35 : 1 - (golpe - 0.35) / 0.65;
      this.brazoD.rotation.x = -2.2 * a - 0.3;
    }
    this.cabeza.rotation.x = -jugador.pitch * 0.5;
  }
}

// Dónde va la cámara en tercera persona: atrás y un poco arriba, sin meterse
// abajo del terreno ni atravesar lo que tenga detrás.
export function camaraTercera(J, ojos, dir, out) {
  const atras = 3.8;
  let d = atras;
  for (let k = 1; k <= 10; k++) {
    const u = (k / 10) * atras;
    _v.copy(ojos).addScaledVector(dir, -u).add({ x: 0, y: 0.35, z: 0 });
    const piso = J.fisica.suelo(_v.x, _v.z, _v.y + 1);
    if (_v.y < piso + 0.35 || (J.bajo && !J.mina.abiertoEn(_v.x, _v.z))) { d = Math.max(0.6, u - 0.4); break; }
  }
  return out.copy(ojos).addScaledVector(dir, -d).add({ x: 0, y: 0.35, z: 0 });
}

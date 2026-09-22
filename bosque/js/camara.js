// La cámara en tercera persona: por encima del hombro, se gira arrastrando.
//
// SE ACOMODA SOLA DETRÁS DEL CAMINANTE, PERO DESPACIO Y SOLO SI NO LA TOCÁS.
// Si sigue la nariz del caminante al instante, cada giro del joystick barre la
// pantalla entera y marea. Si no lo sigue nunca, en un teléfono hay que
// manejar con un pulgar y acomodar la cámara con el otro todo el tiempo. El
// punto medio: segundo y medio después del último arrastre empieza a volver,
// y vuelve más rápido cuanto más rápido vas.
//
// NO SE METE ADENTRO DE LAS COSAS. Detrás de una loma o de un tronco el lugar
// que le toca queda adentro de la tierra o de la madera, y se ve el interior
// hueco de la malla. Se prueba el camino del caminante a la cámara y se la
// acerca hasta antes del primer choque; acercarse es instantáneo y alejarse
// lento, o la cámara pega saltos cada vez que un tronco cruza por atrás.
import * as THREE from "three";
import { CAMARA as K } from "./config.js";
import { altura } from "./terreno.js";
import { limitar } from "./azar.js";

export class Camara {
  constructor(cam) {
    this.cam = cam;
    this.yaw = 0;
    this.pitch = 0.2;
    this.dist = K.DIST;
    this.sinTocar = 99;       // segundos desde el último arrastre
    this.t = 0;
    this.foco = new THREE.Vector3();
    this.sacudida = 0;
  }

  /** Dirección hacia la que mira, en el plano: la usa el joystick. */
  adelante() { return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }; }

  arrastrar(dx, dy) {
    this.yaw -= dx * K.SENS;
    this.pitch = limitar(this.pitch + dy * K.SENS * 0.75, K.PITCH_MIN, K.PITCH_MAX);
    this.sinTocar = 0;
  }

  ajustarFov(aspecto) {
    // EL CAMPO SE FIJA EN HORIZONTAL. Con el vertical fijo, en un teléfono
    // parado se ve una rodaja angosta del bosque y el caminante tapa medio
    // mundo; con el horizontal fijo, parado se ve más cielo y más suelo,
    // que es lo que uno espera al girar el teléfono.
    const h = THREE.MathUtils.degToRad(K.FOV_H);
    const v = 2 * Math.atan(Math.tan(h / 2) / aspecto);
    this.cam.fov = limitar(THREE.MathUtils.radToDeg(v), 46, 84);
    this.cam.aspect = aspecto;
    this.cam.updateProjectionMatrix();
  }

  paso(dt, caminante, bosque) {
    this.t += dt;
    this.sinTocar += dt;
    const v = caminante.vel;
    if (this.sinTocar > 1.5 && v > 0.3) {
      let d = caminante.rumbo - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      // caminando hacia la cámara no se la da vuelta: sería pelearle al jugador
      if (Math.abs(d) < 2.4) this.yaw += d * (1 - Math.exp(-dt * 0.45 * v));
      this.pitch += (0.2 - this.pitch) * (1 - Math.exp(-dt * 0.35 * v));
    }

    const p = caminante.pos;
    this.foco.set(p.x, p.y + K.ALTO_MIRA, p.z);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const rx = -fz, rz = fx;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const hombro = K.HOMBRO;

    // hasta dónde se puede alejar sin atravesar nada
    let lejos = K.DIST;
    const pasos = 12;
    for (let i = 1; i <= pasos; i++) {
      const t = (i / pasos) * K.DIST;
      const x = this.foco.x + rx * hombro * (t / K.DIST) - fx * cp * t;
      const z = this.foco.z + rz * hombro * (t / K.DIST) - fz * cp * t;
      const y = this.foco.y + sp * t;
      if (y < altura(x, z) + 0.45) { lejos = Math.max(K.DIST_MIN, t - 0.35); break; }
    }
    const cx = this.foco.x + rx * hombro - fx * cp * lejos, cz = this.foco.z + rz * hombro - fz * cp * lejos;
    bosque.cerca((this.foco.x + cx) / 2, (this.foco.z + cz) / 2, lejos * 0.6 + 2, (a) => {
      // distancia del eje del tronco al segmento foco→cámara, en el plano
      const sx = cx - this.foco.x, sz = cz - this.foco.z, l2 = sx * sx + sz * sz || 1;
      const u = limitar(((a.x - this.foco.x) * sx + (a.z - this.foco.z) * sz) / l2, 0, 1);
      const d = Math.hypot(this.foco.x + sx * u - a.x, this.foco.z + sz * u - a.z);
      if (d < a.tronco + 0.28 && u > 0.05) lejos = Math.max(K.DIST_MIN, Math.min(lejos, u * lejos - a.tronco - 0.3));
    });
    const k = lejos < this.dist ? 1 - Math.exp(-dt * 22) : 1 - Math.exp(-dt * 2.2);
    this.dist += (lejos - this.dist) * k;

    const d = this.dist;
    const h = hombro * Math.min(1, d / K.DIST);
    // LA MANO QUE SOSTIENE LA CÁMARA. Un balanceo chico y lento siempre, y
    // el golpe de cada paso al caminar: es una grabación hecha por alguien, no
    // un dron. Tiene que notarse apenas; si se nota mucho, marea.
    const resp = Math.sin(this.t * 1.3) * 0.012 + Math.sin(this.t * 0.71 + 2) * 0.008;
    const golpe = Math.abs(Math.sin(caminante.faseAnt * Math.PI * 2)) * Math.min(1, v / 4) * 0.035;
    this.cam.position.set(
      this.foco.x + rx * h - fx * cp * d,
      this.foco.y + sp * d + resp + golpe,
      this.foco.z + rz * h - fz * cp * d);
    _mira.set(this.foco.x + rx * h, this.foco.y + golpe * 0.5, this.foco.z + rz * h);
    this.cam.lookAt(_mira);
    this.cam.rotateZ(Math.sin(this.t * 0.9) * 0.006 + this.sacudida * (Math.random() - 0.5) * 0.02);
    this.sacudida *= Math.exp(-dt * 3);
    this.cam.updateMatrixWorld();
  }

  /** Vista del menú: una vuelta lenta alrededor de un punto. */
  vitrina(t, centro) {
    const a = t * 0.05 + 2.9;
    this.cam.position.set(centro.x + Math.sin(a) * 9, centro.y + 3.2, centro.z + Math.cos(a) * 9);
    _mira.set(centro.x, centro.y + 2.2, centro.z);
    this.cam.lookAt(_mira);
    this.cam.updateMatrixWorld();
  }
}
const _mira = new THREE.Vector3();

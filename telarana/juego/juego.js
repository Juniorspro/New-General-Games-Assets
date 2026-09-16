/* Telaraña — la parte de juego: física de balanceo, colisión contra cajas y
   pose procedural del personaje. El dibujo vive en index.html. */
import * as THREE from "three";

/* ---------------------------------------------------------------- física ---
   La ciudad son cajas alineadas a los ejes, así que todo se resuelve con
   cuentas: el rayo de la telaraña con el método de las rebanadas y el choque
   con la penetración mínima. Nada de rayos contra malla, que costaría cien
   veces más y daría lo mismo. */

export const G = 30;                 // gravedad de juego, no de física
const ROCE_AIRE = 0.16;
const ROCE_SUELO = 7.5;
const EMPUJE_AIRE = 26;
const EMPUJE_SUELO = 62;
const SALTO = 13.5;
const RADIO = 0.55;                  // el jugador es una cápsula gorda
const ALTO = 1.75;
export const ALCANCE = 135;
const LARGO_MIN = 7;
const RECOGER = 26;                  // m/s al acortar la cuerda
const TANGENCIAL = 15;               // el empujón que hace que balancearse rinda

export class Ciudad {
  constructor(cajas){
    this.cajas = cajas.map((c) => ({
      min: new THREE.Vector3(c.c[0]-c.s[0]/2, c.c[1]-c.s[1]/2, c.c[2]-c.s[2]/2),
      max: new THREE.Vector3(c.c[0]+c.s[0]/2, c.c[1]+c.s[1]/2, c.c[2]+c.s[2]/2),
    }));
  }

  /* rayo contra caja, método de las rebanadas: devuelve la distancia o null */
  golpe(o, d, caja, lejos){
    let t0 = 0, t1 = lejos;
    for (const eje of ["x", "y", "z"]) {
      const inv = 1 / (d[eje] || 1e-9);
      let a = (caja.min[eje] - o[eje]) * inv;
      let b = (caja.max[eje] - o[eje]) * inv;
      if (a > b) { const t = a; a = b; b = t; }
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
      if (t0 > t1) return null;
    }
    return t0 > 0.01 ? t0 : null;
  }

  /* el punto de enganche más cercano en la dirección que se mira */
  enganche(origen, dir, lejos = ALCANCE){
    let mejor = null, dm = lejos;
    for (const c of this.cajas) {
      const t = this.golpe(origen, dir, c, dm);
      if (t !== null && t < dm) { dm = t; mejor = c; }
    }
    if (!mejor) return null;
    return { punto: origen.clone().addScaledVector(dir, dm - 0.15), dist: dm };
  }

  /* ¿este punto está dentro de algún edificio? */
  dentro(p, margen = 0.35){
    for (const c of this.cajas) {
      if (p.x > c.min.x - margen && p.x < c.max.x + margen &&
          p.y > c.min.y - margen && p.y < c.max.y + margen &&
          p.z > c.min.z - margen && p.z < c.max.z + margen) return true;
    }
    return false;
  }

  /* saca al jugador de cualquier caja en la que se haya metido */
  resolver(pos, vel){
    let enSuelo = false;
    const lo = new THREE.Vector3(pos.x - RADIO, pos.y - ALTO, pos.z - RADIO);
    const hi = new THREE.Vector3(pos.x + RADIO, pos.y + 0.12, pos.z + RADIO);
    for (const c of this.cajas) {
      if (hi.x < c.min.x || lo.x > c.max.x) continue;
      if (hi.y < c.min.y || lo.y > c.max.y) continue;
      if (hi.z < c.min.z || lo.z > c.max.z) continue;
      /* penetración en cada eje; se sale por la más chica, que es lo que hace
         que uno se pare arriba de un techo en vez de atravesarlo de costado */
      const px = Math.min(hi.x - c.min.x, c.max.x - lo.x);
      const py = Math.min(hi.y - c.min.y, c.max.y - lo.y);
      const pz = Math.min(hi.z - c.min.z, c.max.z - lo.z);
      const m = Math.min(px, py, pz);
      if (m === py) {
        if (pos.y - ALTO/2 > (c.min.y + c.max.y)/2) {          // veníamos de arriba
          pos.y = c.max.y + ALTO;
          if (vel.y < 0) vel.y = 0;
          enSuelo = true;
        } else {
          pos.y = c.min.y - 0.12;
          if (vel.y > 0) vel.y = 0;
        }
      } else if (m === px) {
        pos.x += (pos.x > (c.min.x + c.max.x)/2) ? px : -px;
        vel.x = 0;
      } else {
        pos.z += (pos.z > (c.min.z + c.max.z)/2) ? pz : -pz;
        vel.z = 0;
      }
    }
    if (pos.y < ALTO) { pos.y = ALTO; if (vel.y < 0) vel.y = 0; enSuelo = true; }
    return enSuelo;
  }
}

export class Jugador {
  constructor(ciudad, arranque){
    this.ciudad = ciudad;
    this.pos = new THREE.Vector3(...arranque);
    this.vel = new THREE.Vector3();
    this.anclado = false;
    this.ancla = new THREE.Vector3();
    this.largo = 0;
    this.enSuelo = false;
    this.mirando = new THREE.Vector3(0, 0, -1);
    this.brazo = 1;                 // 1 derecho, -1 izquierdo: alterna solo
  }

  lanzar(dir){
    const ojo = this.pos.clone(); ojo.y += 0.4;
    let r = this.ciudad.enganche(ojo, dir);
    if (!r) {
      /* si el tiro derecho no pega, se abre en abanico hacia arriba: perdonar
         la puntería es lo que hace que balancearse se sienta bien */
      const eje = new THREE.Vector3(0, 1, 0);
      for (const a of [0.14, -0.14, 0.28, -0.28, 0.42, -0.42]) {
        for (const alto of [0.18, 0.36, 0]) {
          const d = dir.clone().applyAxisAngle(eje, a);
          d.y += alto; d.normalize();
          r = this.ciudad.enganche(ojo, d);
          if (r) break;
        }
        if (r) break;
      }
    }
    if (!r) return false;
    this.anclado = true;
    this.ancla.copy(r.punto);
    this.largo = Math.max(LARGO_MIN, r.dist * 0.94);
    this.brazo = -this.brazo;
    return true;
  }

  soltar(){ this.anclado = false; }

  saltar(){
    if (this.anclado) { this.soltar(); this.vel.y += 5; return true; }
    if (!this.enSuelo) return false;
    this.vel.y = SALTO;
    this.enSuelo = false;
    return true;
  }

  paso(dt, mov, recoger){
    const v = this.vel, p = this.pos;

    v.y -= G * dt;

    // empuje del jugador, en ejes de la cámara
    if (mov.lengthSq() > 0) {
      const f = this.enSuelo ? EMPUJE_SUELO : EMPUJE_AIRE;
      v.addScaledVector(mov, f * dt);
    }

    if (this.anclado) {
      if (recoger) this.largo = Math.max(LARGO_MIN, this.largo - RECOGER * dt);
      /* un empujoncito perpendicular a la cuerda mientras se cae: es el
         equivalente a estirar y encoger las piernas en una hamaca */
      const r = p.clone().sub(this.ancla);
      const tang = new THREE.Vector3().crossVectors(r, new THREE.Vector3().crossVectors(r, v));
      if (tang.lengthSq() > 1e-6 && v.y < 0) {
        v.addScaledVector(tang.normalize(), TANGENCIAL * dt);
      }
    }

    const roce = this.enSuelo ? ROCE_SUELO : ROCE_AIRE;
    v.x -= v.x * roce * dt;
    v.z -= v.z * roce * dt;
    if (this.enSuelo) v.y -= v.y * roce * dt;

    p.addScaledVector(v, dt);

    if (this.anclado) {
      const d = p.clone().sub(this.ancla);
      const l = d.length();
      if (l > this.largo) {
        d.multiplyScalar(1 / l);
        p.copy(this.ancla).addScaledVector(d, this.largo);
        const radial = v.dot(d);
        if (radial > 0) v.addScaledVector(d, -radial);   // la cuerda tira, no empuja
      }
      if (this.ancla.distanceTo(p) > ALCANCE * 1.4) this.soltar();
    }

    this.enSuelo = this.ciudad.resolver(p, v);
    if (this.enSuelo && this.anclado && this.vel.lengthSq() < 4) this.soltar();

    const h = Math.hypot(v.x, v.z);
    if (h > 0.4) this.mirando.set(v.x / h, 0, v.z / h);
    return this.enSuelo;
  }

  get rapidez(){ return this.vel.length(); }
}

/* ------------------------------------------------------- pose procedural ---
   El riggeador devuelve tres clips y nada más: caminar, quieto y saltar. Para
   colgarse de una telaraña no hay animación, así que se arma a mano encima:
   se buscan los huesos por nombre y se les suma una rotación después de que
   el mezclador escribió la pose del clip. */
export class Pose {
  constructor(raiz){
    this.h = {};
    raiz.traverse((o) => { if (o.isBone) this.h[o.name] = o; });
    this.base = {};
    for (const n of Object.keys(this.h)) this.base[n] = this.h[n].quaternion.clone();
    this.mezcla = 0;
  }
  tiene(){ return !!this.h["R_Upperarm"]; }

  /* objetivo 0..1: cuánto de pose de balanceo se aplica */
  aplicar(objetivo, dt, brazo, dirAncla, raiz){
    this.mezcla += (objetivo - this.mezcla) * Math.min(1, dt * 7);
    const m = this.mezcla;
    if (m < 0.01) return;

    const q = new THREE.Quaternion();
    const gira = (nombre, x, y, z, k = 1) => {
      const b = this.h[nombre];
      if (!b) return;
      q.setFromEuler(new THREE.Euler(x * m * k, y * m * k, z * m * k));
      b.quaternion.multiply(q);
    };
    const arriba = brazo > 0 ? "R_" : "L_";
    const otro   = brazo > 0 ? "L_" : "R_";
    // el brazo que sostiene sube y se estira
    gira(arriba + "Clavicle", 0, 0, -0.35 * brazo);
    gira(arriba + "Upperarm", -0.2, 0, -1.55 * brazo);
    gira(arriba + "Forearm", 0, 0, -0.25 * brazo);
    // el otro va atrás, buscando equilibrio
    gira(otro + "Upperarm", 0.35, 0, 0.5 * brazo);
    gira(otro + "Forearm", 0.5, 0, 0);
    // tronco arqueado y piernas recogidas
    gira("Spine01", -0.22, 0, 0);
    gira("Spine02", -0.18, 0, 0);
    gira("L_Thigh", 0.55, 0, 0);
    gira("R_Thigh", 0.32, 0, 0);
    gira("L_Calf", -0.9, 0, 0);
    gira("R_Calf", -0.5, 0, 0);
  }

  /* la mano de la que sale el hilo, en coordenadas del mundo */
  mano(brazo, destino){
    const b = this.h[(brazo > 0 ? "R_" : "L_") + "Hand"];
    if (!b) return null;
    return b.getWorldPosition(destino);
  }
}

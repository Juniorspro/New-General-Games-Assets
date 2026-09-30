// El jugador en primera persona: caminar, correr, saltar, nadar y chocar.
//
// Las constantes salen de lo que se siente bien en un juego de este tipo
// (medido en aeroplaza, ver guias/GUIA-AEROPLAZA.md § 8): aceleración con tope,
// coyote de 0,12 s, buffer de salto de 0,14 s y gravedad doble al soltar el
// salto para que un toque corto dé un salto corto.
import * as THREE from '../vendor/three.module.min.js';
import { lim } from './azar.js';

const CAMINAR = 4.4, CORRER = 7.0, NADAR = 3.0;
const SALTO = 7.4, G = 22, ACEL_PISO = 42, ACEL_AIRE = 10;
const RADIO = 0.32, ALTO = 1.75, OJOS = 1.62;
const COYOTE = 0.12, BUFFER = 0.14, ESCALON = 0.55;

export class Jugador {
  constructor(mundo) {
    this.mundo = mundo;
    this.p = new THREE.Vector3();
    this.v = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.enPiso = false; this.coyote = 0; this.buffer = 0;
    this.nadando = false; this.bajoAgua = false;
    this.bob = 0; this.bobFase = 0;
    this.vida = 100; this.hambre = 100;
    this.eventos = [];
    this.caida = 0;
    this.congelado = false;
  }

  ponerEn(v, yaw = this.yaw) {
    this.p.copy(v);
    this.p.y = this.mundo.suelo(v.x, v.z, v.y + 5) + 0.02;
    this.v.set(0, 0, 0);
    this.yaw = yaw;
  }

  direccionMirada(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  ojos(out = new THREE.Vector3()) { return out.set(this.p.x, this.p.y + OJOS + this.bob, this.p.z); }

  actualizar(dt, e, nivelAgua = 0) {
    this.eventos.length = 0;
    // mirar
    this.yaw -= e.mdx * 0.0024;
    this.pitch = lim(this.pitch - e.mdy * 0.0024, -1.5, 1.5);
    if (this.congelado) { this.v.set(0, 0, 0); return; }

    const M = this.mundo;
    const suelo = M.suelo(this.p.x, this.p.z, this.p.y);
    const profAgua = nivelAgua - suelo;
    this.nadando = profAgua > 1.25 && this.p.y < nivelAgua - 0.9;
    this.bajoAgua = this.p.y + OJOS < nivelAgua - 0.05;

    // velocidad objetivo en el plano
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const fx = e.x * cy + e.z * sy, fz = -e.x * sy + e.z * cy;
    const vel = this.nadando ? NADAR * (e.correr ? 1.4 : 1) : e.correr ? CORRER : CAMINAR;
    const enAguaBaja = profAgua > 0.35 && !this.nadando;
    const objX = fx * vel * (enAguaBaja ? 0.72 : 1), objZ = fz * vel * (enAguaBaja ? 0.72 : 1);
    const acel = this.enPiso || this.nadando ? ACEL_PISO : ACEL_AIRE;
    let dx = objX - this.v.x, dz = objZ - this.v.z;
    const d = Math.hypot(dx, dz), max = acel * dt;
    if (d > max) { dx *= max / d; dz *= max / d; }
    this.v.x += dx; this.v.z += dz;

    // salto y gravedad
    this.buffer = e.saltoRecien ? BUFFER : Math.max(0, this.buffer - dt);
    this.coyote = this.enPiso ? COYOTE : Math.max(0, this.coyote - dt);
    if (this.nadando) {
      // flotar: un resorte lleva los ojos apenas arriba del agua
      const objY = nivelAgua - OJOS + 0.25;
      this.v.y += ((objY - this.p.y) * 6 - this.v.y) * Math.min(1, dt * 4);
      if (e.salto) this.v.y = Math.max(this.v.y, 2.4);
      if (e.saltoRecien && this.p.y > nivelAgua - OJOS - 0.4) { this.v.y = SALTO * 0.8; this.eventos.push('salto'); }
    } else {
      this.v.y -= G * dt;
      if (!e.salto && this.v.y > 0) this.v.y -= G * dt;   // salto corto
      if (this.buffer > 0 && this.coyote > 0) {
        this.v.y = SALTO; this.buffer = 0; this.coyote = 0; this.enPiso = false;
        this.eventos.push('salto');
      }
    }

    // mover con subpasos: nunca más de medio radio sin chequear choques
    const pasos = lim(Math.ceil((Math.hypot(this.v.x, this.v.z) * dt) / (RADIO / 2)), 1, 8);
    for (let i = 0; i < pasos; i++) {
      this.p.x += (this.v.x * dt) / pasos;
      this.p.z += (this.v.z * dt) / pasos;
      this.empujar();
    }
    const vyAntes = this.v.y;
    this.p.y += this.v.y * dt;
    // techo (bloques)
    const techo = M.techo(this.p.x, this.p.z, this.p.y + ALTO);
    if (this.p.y + ALTO > techo && this.v.y > 0) { this.p.y = techo - ALTO; this.v.y = 0; }
    // piso: se busca desde un poco más arriba si caía rápido
    const s = M.suelo(this.p.x, this.p.z, this.p.y + Math.max(0, -this.v.y * dt) + 0.05, ESCALON);
    const estabaEnPiso = this.enPiso;
    if (this.p.y <= s + 0.001) {
      if (!estabaEnPiso && vyAntes < -4) this.eventos.push('aterriza');
      if (vyAntes < -15) { this.vida -= (-vyAntes - 15) * 6; this.eventos.push('golpe'); }
      this.p.y = s; this.v.y = Math.max(0, this.v.y); this.enPiso = true;
    } else if (estabaEnPiso && this.v.y <= 0 && this.p.y - s < 0.35) {
      this.p.y = s; this.v.y = 0; this.enPiso = true;     // bajar escalones sin volar
    } else this.enPiso = false;
    if (this.nadando) this.enPiso = false;

    // borde del mundo
    const r = Math.hypot(this.p.x, this.p.z);
    if (r > 124) { this.p.x *= 124 / r; this.p.z *= 124 / r; }

    // paso a paso: balanceo de la cabeza y sonido de pasos
    const rapidez = Math.hypot(this.v.x, this.v.z);
    if (this.enPiso && rapidez > 0.5) {
      const antes = Math.floor(this.bobFase / Math.PI);
      this.bobFase += dt * rapidez * 2.1;
      if (Math.floor(this.bobFase / Math.PI) !== antes) this.eventos.push('paso');
      this.bob = Math.abs(Math.sin(this.bobFase)) * 0.045 * Math.min(1, rapidez / 4);
    } else this.bob *= Math.max(0, 1 - dt * 10);

    // hambre: baja despacio; con hambre cero duele un poco
    this.hambre = Math.max(0, this.hambre - dt * (e.correr ? 0.09 : 0.05));
    if (this.hambre <= 0) this.vida -= dt * 0.8;
    else if (this.hambre > 40 && this.vida < 100) this.vida = Math.min(100, this.vida + dt * 0.6);
    if (this.nadando && !this.nadabaAntes) this.eventos.push('chapuzon');
    this.nadabaAntes = this.nadando;
  }

  empujar() {
    const M = this.mundo;
    for (const o of M.obstaculos(this.p.x, this.p.z, RADIO)) {
      if (this.p.y + ALTO < o.y0 || this.p.y > o.y1 - 0.3) continue;
      const dx = this.p.x - o.x, dz = this.p.z - o.z, d = Math.hypot(dx, dz), min = o.r + RADIO;
      if (d < min && d > 1e-5) { this.p.x = o.x + (dx / d) * min; this.p.z = o.z + (dz / d) * min; }
    }
    if (M.bloques) M.bloques.empujar(this.p, RADIO, ALTO, ESCALON);
  }
}

export { OJOS, RADIO, ALTO };

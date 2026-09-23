/* ============================================================================
   kuntur/js/actores.js — Killa, recortada en papel.
   Sus cuadros de pixel art (sprites.js) se imprimen una vez en hojas con
   borde blanco; cada cuadro de juego se elige el dibujo que toca según lo que
   hace, como en un juego 2D, y encima se le suma lo que en 2D no se puede:
   se da vuelta como una hoja, se estira al saltar, se aplasta al caer, se
   hamaca al correr, hace sombra con su forma y le pega la luz.
   Al apagarse se cae de espaldas, chata como un recorte que se volteó; al
   volver, se para de golpe como las figuras de un libro desplegable.
   ========================================================================== */
import * as THREE from 'three';
import { cuadrosKilla, KILLA_LIENZO } from './sprites.js';
import { textoRecorte, hojaRecortada } from './papel.js';

export const TAM_KILLA = 0.038;
const acercar = (a, b, k) => a + (b - a) * k;

let cache = null;
function texturasKilla() {
  if (cache) return cache;
  const cuadros = cuadrosKilla(), r = {};
  for (const [n, fr] of Object.entries(cuadros)) r[n] = fr.map((L) => ({ tex: textoRecorte(L, { k: 6 }), lz: L }));
  cache = r;
  return r;
}

export class KillaPapel {
  constructor(padre) {
    this.T = texturasKilla();
    const t0 = this.T.quieta[0].tex, u = t0.userData;
    this.hoja = hojaRecortada(t0, u.w * TAM_KILLA, u.h * TAM_KILLA, { oy: -u.m * TAM_KILLA, ox: ((u.w / 2) - (u.m + KILLA_LIENZO.cx)) * TAM_KILLA });
    this.pivote = new THREE.Group(); this.pivote.add(this.hoja);
    this.raiz = new THREE.Group(); this.raiz.add(this.pivote);
    padre.add(this.raiz);
    this.yaw = -0.28; this.dir = 1;
    this.sx = 1; this.sy = 1; this.fase = 0; this.tQuieta = 0; this.tParpado = 2.5; this.parpado = 0; this.tAterriza = 0;
    this.anim = 'quieta'; this.cuadro = 0; this.onda = 0;
    this.muerte = null; this.pop = 1;
  }
  poner(anim, i) {
    const fr = this.T[anim] || this.T.quieta;
    const f = fr[((i % fr.length) + fr.length) % fr.length];
    if (this.hoja.material.map !== f.tex) {
      this.hoja.material.map = f.tex; this.hoja.material.needsUpdate = true;
      this.hoja.customDepthMaterial.map = f.tex; this.hoja.customDepthMaterial.needsUpdate = true;
    }
    this.anim = anim; this.cuadro = i;
  }
  caer(causa) { this.muerte = { t: 0, causa }; }
  volver() { this.muerte = null; this.pop = 0; this.sy = 0.4; this.sx = 1.4; }

  /* p: la física; o: { t, dt, aterrizo, salto, habla } */
  actualizar(p, o) {
    const dt = Math.min(0.05, o.dt), t = o.t;
    if (o.aterrizo > 3) { this.sy = Math.max(0.7, 1 - o.aterrizo * 0.022); this.sx = 2 - this.sy; this.tAterriza = 0.12; }
    if (o.salto) { this.sy = 1.18; this.sx = 0.86; }
    this.sx = acercar(this.sx, 1, 1 - Math.pow(0.0004, dt)); this.sy = acercar(this.sy, 1, 1 - Math.pow(0.0004, dt));
    this.tAterriza -= dt;
    /* qué dibujo toca */
    const vx = p.vx, quieta = p.estado === 'normal' && p.enSuelo && Math.abs(vx) < 0.3 && !p.agachada;
    this.tQuieta = quieta ? this.tQuieta + dt : 0;
    let dir = p.dir;
    if (p.muerta) this.poner('cae_mal', 0);
    else if (p.estado === 'colgado') { dir = p.colgado.dir; this.poner('colgada', Math.floor(t * 2.5)); }
    else if (p.estado === 'trepando') { dir = p.colgado ? p.colgado.dir : p.dir; this.poner('trepa', p.trepa.t < 0.22 ? 0 : 1); }
    else if (p.estado === 'escalera') this.poner('escalera', Math.floor(p.y * 2.2));
    else if (p.estado === 'agarrado' || p.empujando) {
      const d = p.caja ? Math.sign(p.caja.x + 0.5 - p.x) : p.dir;
      dir = d;
      this.fase += Math.abs(vx) * dt;
      this.poner(Math.sign(vx) === -d && Math.abs(vx) > 0.1 ? 'tira' : 'empuja', Math.floor(this.fase / 0.22));
    } else if (p.agachada) {
      this.fase += Math.abs(vx) * dt;
      if (Math.abs(vx) > 0.2) this.poner('gatea', Math.floor(this.fase / 0.2)); else this.poner('agachada', Math.floor(t * 1.5));
    } else if (!p.enSuelo) {
      if (p.planeando) this.poner('planea', Math.floor(t * 6));
      else if (p.vy > 1.5) this.poner('sube', 0);
      else this.poner('cae', Math.floor(t * 8));
    } else if (this.tAterriza > 0) this.poner('aterriza', 0);
    else if (Math.abs(vx) > 0.3) { this.fase += Math.abs(vx) * dt; this.poner('corre', Math.floor(this.fase / 0.27)); }
    else if (o.habla) this.poner('habla', Math.floor(t * 6));
    else {
      this.tParpado -= dt;
      if (this.tParpado < 0) { this.parpado = 0.13; this.tParpado = 2 + Math.random() * 3; }
      if (this.parpado > 0) { this.parpado -= dt; this.poner('parpadea', 0); }
      else if (this.tQuieta > 3.5 && Math.sin(t * 0.6) > 0.3) this.poner('mira', 0);
      else this.poner('quieta', Math.floor(t * 3));
    }
    /* darse vuelta: la hoja da media vuelta (del otro lado se ve el dibujo al revés) */
    if (dir) this.dir = dir;
    const meta = this.dir > 0 ? -0.28 : Math.PI + 0.28;
    let d = meta - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * (1 - Math.pow(0.000001, dt));
    this.raiz.position.set(p.x, p.y, 0);
    this.pivote.rotation.y = (this.yaw + 0.28) * (Math.PI / (Math.PI + 0.56));
    /* al correr se hamaca un poquito; en el aire se inclina con la velocidad */
    this.onda += Math.abs(p.vx) * dt * 2.2;
    this.pivote.rotation.z = p.enSuelo ? Math.sin(this.onda) * 0.035 * Math.min(1, Math.abs(p.vx) / 3) : -Math.sign(p.vx) * Math.min(0.12, Math.abs(p.vy) * 0.01);
    this.pivote.rotation.x = 0;
    this.pivote.scale.set(this.sx, this.sy, 1);
    this.pivote.position.set(0, 0, 0);
    /* apagarse */
    if (this.muerte) {
      const M = this.muerte; M.t += dt;
      const k = Math.min(1, M.t / 0.35);
      if (M.causa === 'agua') { this.pivote.position.y = -M.t * 1.6; this.pivote.rotation.z = Math.sin(M.t * 9) * 0.2; }
      else if (M.causa === 'viga' || M.causa === 'tormenta') {
        const s = M.causa === 'viga' ? -1 : 1;
        this.pivote.position.set(s * M.t * 7, M.t * 5 - M.t * M.t * 9, 0);
        this.pivote.rotation.z = -s * M.t * 12; this.pivote.rotation.x = -M.t * 3;
      } else {
        /* cae de espaldas, chata, con un rebotecito */
        const e = k < 1 ? k * k : 1 + Math.sin(Math.min(1, (M.t - 0.35) / 0.25) * Math.PI) * -0.08;
        this.pivote.rotation.x = -Math.PI / 2 * Math.min(1, e);
      }
      if (M.t > 0.9) this.pivote.scale.multiplyScalar(Math.max(0.001, 1 - (M.t - 0.9) / 0.3));
    } else if (this.pop < 1) {
      /* se para de golpe: pasa un poquito de largo y vuelve */
      this.pop = Math.min(1, this.pop + dt / 0.42);
      const k = this.pop, e = 1 - Math.pow(1 - k, 3) * Math.cos(k * 7.5);
      this.pivote.rotation.x = -Math.PI / 2 * (1 - e);
    }
  }
  ver(v) { this.raiz.visible = v; }
}

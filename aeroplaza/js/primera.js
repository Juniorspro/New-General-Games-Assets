/* ============================================================================
   aeroplaza/js/primera.js — el cuerpo propio en primera persona.
   - Los brazos van "en la cámara" (como en los juegos de primera persona): dos
     brazos de gelatina con su mano redonda, del material y color del muñeco,
     que se dibujan encima de todo (así no se meten en las paredes).
   - Se mueven según lo que hace el muñeco: respiran quieto, se balancean al
     caminar, bombean al correr, se abren al saltar y al caer, uno adelante y
     otro al piso al deslizarse, se esconden al rodar, agarran el borde y
     empujan al trepar, empujan la pared al rebotar. Y dos golpes propios:
     "usar" (toca con la mano derecha) y "tirar" (lanza la burbuja).
   - Todo pasa por el mismo estilo de animación del muñeco (animador.js): en
     chop va a saltos, a 12 cuadros por segundo.
   - El resto del cuerpo lo pone el muñeco de verdad (sin cabeza ni brazos):
     mirando para abajo se ven la panza y las piernas que caminan.
   ========================================================================== */
import * as THREE from 'three';
import { materialMeeple, Meeple } from './meeple.js';
import { curva, CUADROS_CHOP } from './animador.js';

const suave = (a, b, k) => a + (b - a) * k;
/* las poses de cada brazo: [x, y, z] del hombro (adelante-abajo de la cámara) y [rx, ry, rz] */
/* (26/09: "los brazos aún quedan levantados": quieto no se ven, apenas asoman las puntas de las
   manos abajo; al caminar y correr entran de a uno bombeando; saltando se ven bajitos, nunca a
   media pantalla. Con 70° de campo, abajo de y/z = -0,7 queda fuera de cuadro) */
const POSES = {
  quieto: { d: [[0.3, -0.58, -0.04], [0.28, 0.12, -0.08]], i: [[-0.3, -0.58, -0.04], [0.28, -0.12, 0.08]] },
  arriba: { d: [[0.32, -0.54, -0.1], [0.5, 0.2, -0.35]], i: [[-0.32, -0.54, -0.1], [0.5, -0.2, 0.35]] },
  desliza: { d: [[0.22, -0.5, -0.12], [0.45, 0.1, -0.08]], i: [[-0.34, -0.6, 0.04], [-0.5, -0.25, 0.5]] },
  rueda: { d: [[0.2, -0.8, -0.1], [0.2, 0, 0]], i: [[-0.2, -0.8, -0.1], [0.2, 0, 0]] },
  agarra: { d: [[0.24, -0.3, -0.2], [1.05, 0.05, -0.1]], i: [[-0.24, -0.3, -0.2], [1.05, -0.05, 0.1]] },
  empuja: { d: [[0.24, -0.52, -0.16], [0.05, 0.05, -0.08]], i: [[-0.24, -0.52, -0.16], [0.05, -0.05, 0.08]] },
  pared: { d: [[0.3, -0.4, -0.16], [0.7, 0.5, -0.25]], i: [[-0.32, -0.46, -0.14], [0.55, -0.4, 0.3]] },
  valla: { d: [[0.22, -0.5, -0.22], [-0.1, 0.1, -0.1]], i: [[-0.22, -0.5, -0.22], [-0.1, -0.1, 0.1]] },
  corrPared: { d: [[0.34, -0.46, -0.08], [0.55, 0.7, -0.6]], i: [[-0.3, -0.56, -0.06], [0.3, -0.14, 0.1]] },
};

export class CuerpoFP {
  constructor(escena) {
    this.g = new THREE.Group(); this.g.visible = false; escena.add(this.g);
    const brazo = new THREE.CapsuleGeometry(0.046, 0.34, 6, 14); brazo.rotateX(Math.PI / 2); brazo.translate(0, 0, -0.2);
    const mano = new THREE.SphereGeometry(0.06, 18, 14); mano.scale(1, 0.85, 1.15); mano.translate(0, 0, -0.43);
    this.brazos = ['d', 'i'].map((lado) => {
      const p = new THREE.Group(); this.g.add(p);
      const b = new THREE.Mesh(brazo), m = new THREE.Mesh(mano);
      for (const q of [b, m]) { q.renderOrder = 20; q.frustumCulled = false; p.add(q); }
      return { lado, p, b, m, pos: new THREE.Vector3(), rot: new THREE.Vector3() };
    });
    this.fase = 0; this.t = 0; this.golpe = null;   // { tipo: 'usar' | 'tirar', t }
  }
  ponerApariencia(A) {
    /* el mismo material del muñeco, pero siempre adelante de todo */
    const m = materialMeeple(A).clone(); m.depthTest = false; m.depthWrite = false; m.transparent = true; m.opacity = Math.min(m.opacity ?? 1, 1);
    for (const B of this.brazos) { B.b.material = m; B.m.material = m; }
  }
  mostrar(si) { this.g.visible = si; }
  usar() { this.golpe = { tipo: 'usar', t: 0, dur: 0.32 }; }
  tirar() { this.golpe = { tipo: 'tirar', t: 0, dur: 0.36 }; }
  /* cam: la cámara (ya ubicada); yo: el jugador */
  actualizar(dt, cam, yo) {
    if (!this.g.visible) return;
    const chop = Meeple.estiloAnim === 'chop';
    this.t += dt;
    const t = chop ? Math.floor(this.t * CUADROS_CHOP) / CUADROS_CHOP : this.t;
    this.g.position.copy(cam.position); this.g.quaternion.copy(cam.quaternion);
    const e = yo.estado, vel = Math.hypot(yo.v.x, yo.v.z);
    if (e === 'camina' || e === 'corre') this.fase += dt * (e === 'corre' ? 13 : 9) * Math.min(1.4, 0.35 + vel / (e === 'corre' ? 5 : 2.6));
    const f = chop ? Math.round(this.fase / (Math.PI / 3)) * (Math.PI / 3) : this.fase;
    let P = POSES.quieto;
    if (e === 'salta' || e === 'cae' || e === 'nada') P = POSES.arriba;
    else if (e === 'desliza') P = POSES.desliza;
    else if (e === 'rueda') P = POSES.rueda;
    else if (e === 'pared') P = POSES.pared;
    else if (e === 'valla') P = POSES.valla;
    else if (e === 'subePared') P = Math.floor(this.t * 6) % 2 ? POSES.agarra : POSES.empuja;
    else if (e === 'corrPared') { P = POSES.corrPared; if ((yo.m.ladoPared || 1) < 0) P = { d: [[-P.i[0][0], P.i[0][1], P.i[0][2]], [P.i[1][0], -P.i[1][1], -P.i[1][2]]], i: [[-P.d[0][0], P.d[0][1], P.d[0][2]], [P.d[1][0], -P.d[1][1], -P.d[1][2]]] }; }
    else if (e === 'trepa') { const u = yo.mov ? yo.mov.t / yo.mov.dur : 1; P = u < 0.45 ? POSES.agarra : POSES.empuja; }
    const k = chop ? 1 : 1 - Math.exp(-dt * 16);
    for (const B of this.brazos) {
      const s = B.lado === 'd' ? 1 : -1, [p0, r0] = P[B.lado];
      const obj = new THREE.Vector3(...p0), rot = new THREE.Vector3(...r0);
      /* el vaivén: quieto respira; caminando y corriendo, cada brazo para adelante cuando el otro va atrás */
      if (e === 'camina' || e === 'corre') {
        /* el que va adelante sube y se cierra hacia el medio (entra en cuadro); el de atrás baja y sale */
        const corre = e === 'corre', q = Math.sin(f + (s > 0 ? 0 : Math.PI)), adel = Math.max(0, q);
        obj.z += q * (corre ? 0.14 : 0.08); obj.x -= s * adel * (corre ? 0.07 : 0.03);
        obj.y += adel * (corre ? 0.13 : 0.05) - Math.max(0, -q) * 0.05 + Math.abs(Math.cos(f)) * 0.015;
        rot.x += q * (corre ? 0.7 : 0.35) + (corre ? 0.25 : 0); rot.z -= s * adel * (corre ? 0.35 : 0.12);
      }
      else if (e === 'desliza' && s < 0) { obj.y += Math.sin(t * 30) * 0.004; }   // (la mano de atrás va rozando el piso) else if (e === 'quieto') { obj.y += Math.sin(t * 2.2 + s) * 0.008; rot.x += Math.sin(t * 1.1) * 0.03; }
      else if (e === 'cae') { rot.z += Math.sin(t * 9 + s) * 0.18 * s; obj.y += Math.sin(t * 11 + s) * 0.02; }
      /* los golpes de la mano derecha */
      if (this.golpe && s > 0) {
        const G = this.golpe, u = Math.min(1, G.t / G.dur), c = curva(u < 0.4 ? u / 0.4 : 1 - (u - 0.4) / 0.6, Meeple.estiloAnim);
        if (G.tipo === 'usar') { obj.z -= c * 0.18; obj.x -= c * 0.08; obj.y += c * 0.06; rot.x += c * 0.9; }
        else { obj.z += (u < 0.3 ? c * 0.06 : -c * 0.12); obj.y += c * 0.05; obj.x -= c * 0.05; rot.x += (u < 0.3 ? -0.35 * c : 0.55 * c); rot.z -= c * 0.2; }
      }
      B.pos.set(suave(B.pos.x, obj.x, k), suave(B.pos.y, obj.y, k), suave(B.pos.z, obj.z, k));
      B.rot.set(suave(B.rot.x, rot.x, k), suave(B.rot.y, rot.y, k), suave(B.rot.z, rot.z, k));
      B.p.position.copy(B.pos); B.p.rotation.set(B.rot.x, B.rot.y, B.rot.z);
    }
    if (this.golpe) { this.golpe.t += dt; if (this.golpe.t >= this.golpe.dur) this.golpe = null; }
  }
}

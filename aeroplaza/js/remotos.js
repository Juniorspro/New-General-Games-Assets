/* ============================================================================
   aeroplaza/js/remotos.js — los otros jugadores de la sala.
   Llegan ~10 veces por segundo; se dibujan acercándose a la última posición
   que mandaron (targetX/Y/Z) para que a 60 cuadros se vea suave. El que no
   manda nada en 5 s se borra.
   ========================================================================== */
import * as THREE from 'three';
import { Meeple, APARIENCIA_INICIAL } from './meeple.js';
import { girarHacia } from './jugador.js';

const OLVIDO = 5000;

export class RemotePlayer {
  constructor(escena, d) {
    this.id = d.id; this.name = String(d.name || '?').slice(0, 20);
    this.m = new Meeple(APARIENCIA_INICIAL(), this.name);
    this.m.raiz.position.set(d.x || 0, d.y || 0, d.z || 0);
    escena.add(this.m.raiz);
    this.targetX = d.x || 0; this.targetY = d.y || 0; this.targetZ = d.z || 0;
    this.rumbo = this.rumboObj = d.facingAngle || 0;
    this.hp = 100; this.estado = 'quieto'; this.vel = 0; this.esc = 1; this.av = -1;
    this.visto = performance.now();
    this.burbuja = null;
  }
  get x() { return this.m.raiz.position.x; } get y() { return this.m.raiz.position.y; } get z() { return this.m.raiz.position.z; }
  recibir(d) {
    this.visto = performance.now();
    if (Number.isFinite(d.x)) this.targetX = d.x;
    if (Number.isFinite(d.y)) this.targetY = d.y;
    if (Number.isFinite(d.z)) this.targetZ = d.z;
    if (Number.isFinite(d.facingAngle)) this.rumboObj = d.facingAngle;
    if (Number.isFinite(d.hp)) this.hp = d.hp;
    this.isMoving = !!d.isMoving;
    this.estado = typeof d.estado === 'string' ? d.estado : this.isMoving ? 'camina' : 'quieto';
    this.velRed = Number.isFinite(d.vel) ? d.vel : 0;
    this.esc = Number.isFinite(d.esc) ? Math.max(0.4, Math.min(2, d.esc)) : 1;
    /* el gesto llega como "saludar#3" (el número es para repetir el mismo): el muñeco quiere solo el nombre */
    if (d.gesto && d.gesto !== this.gesto) { const g = String(d.gesto).split('#')[0].slice(0, 20); this.m.hacerGesto(g); RemotePlayer.alGesto?.(this, g); }
    this.gesto = d.gesto || null;
    this.modo = d.modo || 'pie';
    this.mesa = typeof d.mesa === 'string' ? d.mesa.slice(0, 8) : null;   // en qué silla de qué mesa (la Zona de Juegos)
    this.voz = d.voz === 1 || d.voz === 2 ? d.voz : 0;   // en el chat de voz: 1 con micrófono, 2 escuchando
    if (d.name && d.name !== this.name) { this.name = String(d.name).slice(0, 20); this.m.ponerNombre(this.name); }
  }
  ponerApariencia(A, av) { this.m.ponerApariencia({ ...APARIENCIA_INICIAL(), ...A }); this.av = av; }
  actualizar(dt) {
    const p = this.m.raiz.position;
    /* INTERPOLAR: se acerca al blanco; si quedó muy lejos (viajó), salta */
    const dx = this.targetX - p.x, dy = this.targetY - p.y, dz = this.targetZ - p.z;
    if (dx * dx + dz * dz > 400) p.set(this.targetX, this.targetY, this.targetZ);
    else { const k = 1 - Math.exp(-dt * 12); p.x += dx * k; p.y += dy * k; p.z += dz * k; }
    this.rumbo = girarHacia(this.rumbo, this.rumboObj, dt * 12);
    this.m.raiz.rotation.y = this.rumbo;
    const s = this.m.raiz.scale.x + (this.esc - this.m.raiz.scale.x) * Math.min(1, dt * 4); this.m.raiz.scale.setScalar(s);
    this.m.animar(dt, this.estado, this.velRed || Math.hypot(dx, dz) * 10);
    if (this.burbuja) this.burbuja.visible = this.modo === 'burbuja';
  }
  quitar() { this.m.quitar(); }
}

/* el Map de remotos, con la limpieza por tiempo */
export class Remotos {
  constructor(escena) { this.escena = escena; this.m = new Map(); this.alIrse = () => {}; this.alLlegar = () => {}; }
  recibir(d) {
    let r = this.m.get(d.id);
    if (!r) { r = new RemotePlayer(this.escena, d); this.m.set(d.id, r); this.alLlegar(r); }
    r.recibir(d);
    return r;
  }
  get(id) { return this.m.get(id); }
  actualizar(dt) {
    const ahora = performance.now();
    for (const [id, r] of this.m) {
      if (ahora - r.visto > OLVIDO) { r.quitar(); this.m.delete(id); this.alIrse(r); continue; }
      r.actualizar(dt);
    }
  }
  vaciar() { for (const r of this.m.values()) r.quitar(); this.m.clear(); }
  get cuantos() { return this.m.size; }
}

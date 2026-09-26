/* ============================================================================
   aeroplaza/js/vr-xr.js — el modo VR en un visor de verdad (Meta Quest, Pico,
   la compu con visor): WebXR, immersive-vr.
   - La cabeza y los ojos los pone el visor (three dibuja los dos ojos). Se
     pide la frecuencia más alta que tenga hasta 120 (updateTargetFrameRate):
     en un Quest 3, 120 Hz de verdad.
   - El muñeco se mueve corriendo el ORIGEN del espacio del visor (un espacio
     de referencia desplazado a donde está el muñeco, girado con el rumbo):
     así la cámara queda en coordenadas del mundo, como la espera todo el
     juego, y la cabeza real se mueve adentro de ese lugar.
   - Las manos del visor (hand-tracking) llegan con sus 25 articulaciones: se
     pasan a los 21 puntos de manos.js y funciona todo igual que con la
     cámara del celu (sin filtro ni adelanto: el visor ya los da suaves y a
     tiempo). Con los controles: palanca izquierda camina, la derecha gira de
     a 45°, el gatillo usa y A/X salta.
   - La foveación fija (los bordes a menos resolución, donde el lente ya
     desenfoca) va baja: se nota poco y alivia mucho al visor a 120.
   ========================================================================== */
import * as THREE from 'three';

/* las 21 articulaciones de MediaPipe, con su nombre en WebXR (la metacarpiana del índice y compañía
   no están en MediaPipe: se saltean) */
const ARTIC = ['wrist', 'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
  'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'];
const FOVEACION = 0.3;
const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);

export class VisorXR {
  static async soportado() {
    try { return !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-vr')); } catch { return false; }
  }
  constructor() { this.sesion = null; this.hz = null; this.giroCooldown = 0; this.botones = {}; }
  get activo() { return !!this.sesion; }
  /* desde el toque del botón. alCuadro(t, frame): el bucle del juego mientras dure */
  async entrar(motor, { alCuadro, alSalir }) {
    const s = this.sesion = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'hand-tracking'] });
    const r = this.r = motor.r;
    this.motor = motor; this.alSalir = alSalir;
    r.xr.enabled = true;
    r.xr.setReferenceSpaceType('local-floor');
    r.xr.setFoveation(FOVEACION);
    /* el bucle ANTES de la sesión: si se pone después, three vuelve a prender el de la ventana y
       quedan dos bucles con dos relojes (el tiempo entre cuadros salía negativo) */
    this.cuadros = 0;
    r.setAnimationLoop((t, frame) => { if (frame) { this.frame = frame; this.cuadros++; alCuadro(t, frame); } });
    await r.xr.setSession(s);
    this.base = r.xr.getReferenceSpace();
    /* lo más rápido que dé el visor, hasta 120 */
    try {
      const f = Array.from(s.supportedFrameRates || []).filter((x) => x <= 120);
      if (f.length && s.updateTargetFrameRate) { const hz = Math.max(...f); await s.updateTargetFrameRate(hz); this.hz = hz; }
    } catch { /* se queda con la del visor */ }
    /* los materiales propios (cielo, mar…) tienen que convertir el color ellos: al visor se dibuja
       derecho, sin la cadena de efectos */
    motor.ajustarShaders();
    s.addEventListener('end', () => this.fin());
    return true;
  }
  salir() { this.sesion?.end().catch(() => this.fin()); }
  fin() {
    if (!this.sesion) return;
    this.sesion = null; this.frame = null;
    this.r.setAnimationLoop(null); this.r.xr.enabled = false;
    this.motor.medir();
    this.alSalir?.();
  }
  /* el origen del espacio del visor: en los pies del muñeco (p) y girado con el rumbo (yaw) */
  ponerOrigen(p, yaw) {
    if (!this.base || typeof XRRigidTransform === 'undefined') return;
    _q.setFromAxisAngle(Y, -yaw); _v.copy(p).negate().applyQuaternion(_q);
    const off = new XRRigidTransform({ x: _v.x, y: _v.y, z: _v.z }, { x: _q.x, y: _q.y, z: _q.z, w: _q.w });
    this.r.xr.setReferenceSpace(this.base.getOffsetReferenceSpace(off));
  }
  /* las manos del visor a manos.js (en el mundo, por el espacio desplazado) */
  leerManos(manos, tSeg) {
    const f = this.frame, ref = this.r.xr.getReferenceSpace(); if (!f || !ref || !f.getJointPose) return 0;
    let n = 0;
    for (const src of this.sesion.inputSources) {
      if (!src.hand) continue;
      const W = new Float32Array(63); let ok = true;
      for (let i = 0; i < 21; i++) {
        const j = src.hand.get(ARTIC[i]), pose = j && f.getJointPose(j, ref);
        if (!pose) { ok = false; break; }
        const p = pose.transform.position; W[i * 3] = p.x; W[i * 3 + 1] = p.y; W[i * 3 + 2] = p.z;
      }
      if (!ok) continue;
      manos.recibirMundo(src.handedness === 'right', W, tSeg); n++;
    }
    return n;
  }
  /* los controles (si no hay manos): E es lo que lee entrada.js */
  leerMandos(E, dt, girar) {
    this.giroCooldown -= dt;
    for (const src of this.sesion?.inputSources || []) {
      const g = src.gamepad; if (!g || src.hand) continue;
      const ax = g.axes.length >= 4 ? [g.axes[2], g.axes[3]] : [g.axes[0] || 0, g.axes[1] || 0];
      const zona = (v) => (Math.abs(v) < 0.18 ? 0 : v);
      if (src.handedness === 'left') { const x = zona(ax[0]), z = zona(ax[1]); if (x || z) { E.x = x; E.z = z; E.corre = Math.hypot(x, z) > 0.92; } }
      else if (src.handedness === 'right') { const x = zona(ax[0]); if (Math.abs(x) > 0.6 && this.giroCooldown <= 0) { girar(x > 0 ? -1 : 1); this.giroCooldown = 0.35; } }
      /* el gatillo usa; A/X (botón 4) salta; solo cuando se aprietan */
      const b = (i) => !!g.buttons[i]?.pressed, k = src.handedness;
      if (b(0) && !this.botones[k + 0]) E.accion = true;
      if (b(4) && !this.botones[k + 4]) { E.salta = true; E.sostiene = true; }
      if (b(4)) E.sostiene = true;
      this.botones[k + 0] = b(0); this.botones[k + 4] = b(4);
    }
  }
}

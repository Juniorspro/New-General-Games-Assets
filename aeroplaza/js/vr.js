/* ============================================================================
   aeroplaza/js/vr.js — el modo VR del celu, sin botones: primera persona y la
   cámara la mueve el giroscopio (DeviceOrientation), como un visor de cartón.
   - Con SBS: la pantalla partida en dos (un ojo cada mitad, 6,4 cm entre los
     ojos, StereoCamera de three) para ponerlo en un visor.
   - Sin SBS: una sola vista, "ventana mágica": se mira moviendo el celu.
   Sin controles en pantalla: un toque camina o frena (si hay algo para usar
   cerca, lo usa), dos toques saltan y mirar para abajo 2 s sale del modo. En
   la compu (sin giroscopio) se mira arrastrando, para probarlo.
   La orientación: la receta de siempre (el DeviceOrientationControls que tenía
   three): alfa, beta y gama a un cuaternión, girado -90° en x (la cámara mira
   por detrás del celu) y corregido por el giro de la pantalla. Si el juego está
   girado por CSS (celu parado con el giro de pantalla trabado, pantalla.js), ese
   giro cuenta como si la pantalla estuviera acostada.
   ========================================================================== */
import * as THREE from 'three';
import { t, sumar } from './textos.js';
import { Pantalla } from './pantalla.js';

sumar({
  es: { vr_titulo: 'Modo VR', vr_texto: 'Primera persona y mirás moviendo el celu. Sin botones: un toque camina o frena (o usa lo que tengas cerca), dos toques saltan y mirar para abajo un rato sale.', vr_sbs: '👓 Con visor', vr_sbs_d: 'Pantalla doble (SBS)', vr_simple: '📱 Sin visor', vr_simple_d: 'Una sola vista', vr_ayuda: 'Tocá para caminar · mirá abajo para salir', vr_salir: 'Salir', vr_sin_giro: 'Sin giroscopio: arrastrá para mirar', vr_permiso: 'Hace falta el permiso del movimiento para mirar con el celu' },
  en: { vr_titulo: 'VR mode', vr_texto: 'First person, and you look around by moving your phone. No buttons: one tap walks or stops (or uses what’s nearby), two taps jump, and looking down for a while exits.', vr_sbs: '👓 With headset', vr_sbs_d: 'Split screen (SBS)', vr_simple: '📱 No headset', vr_simple_d: 'Single view', vr_ayuda: 'Tap to walk · look down to exit', vr_salir: 'Exit', vr_sin_giro: 'No gyroscope: drag to look', vr_permiso: 'Motion permission is needed to look with the phone' },
  pt: { vr_titulo: 'Modo VR', vr_texto: 'Primeira pessoa, e você olha mexendo o celular. Sem botões: um toque anda ou para (ou usa o que estiver perto), dois toques pulam e olhar para baixo um tempo sai.', vr_sbs: '👓 Com óculos', vr_sbs_d: 'Tela dupla (SBS)', vr_simple: '📱 Sem óculos', vr_simple_d: 'Uma só vista', vr_ayuda: 'Toque para andar · olhe para baixo para sair', vr_salir: 'Sair', vr_sin_giro: 'Sem giroscópio: arraste para olhar', vr_permiso: 'Precisa da permissão de movimento para olhar com o celular' },
});

const Z = new THREE.Vector3(0, 0, 1), Q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)), _e = new THREE.Euler(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _t = new THREE.Vector2();
const SALIR_TRAS = 2;          // segundos mirando abajo
const DOBLE = 0.3;             // segundos entre dos toques para que sea doble

export class VR {
  constructor() {
    this.activo = false; this.sbs = false;
    this.giro = null;            // la última lectura del giroscopio { a, b, g } en radianes
    this.base = 0;               // el rumbo al entrar: la vista arranca para donde miraba el muñeco
    this.q = new THREE.Quaternion();
    this.estereo = new THREE.StereoCamera(); this.estereo.eyeSep = 0.064;
    this.camina = false; this.salta = false; this.usa = false;
    this.tAbajo = 0; this.arrastre = { yaw: 0, pitch: 0 };
    this._orient = (e) => { if (e.alpha == null && e.beta == null) return; this.giro = { a: THREE.MathUtils.degToRad(e.alpha || 0), b: THREE.MathUtils.degToRad(e.beta || 0), g: THREE.MathUtils.degToRad(e.gamma || 0) }; };
  }
  /* se llama desde el toque del botón (en iOS el permiso tiene que pedirse ahí) */
  async entrar(sbs, { raiz, cam, alSalir, avisar }) {
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      try { if ((await DOE.requestPermission()) !== 'granted') avisar?.(t('vr_permiso')); } catch { avisar?.(t('vr_permiso')); }
    }
    addEventListener('deviceorientation', this._orient);
    /* pantalla completa y acostada, si se deja (en los Artifacts o en iOS puede que no: el juego se gira solo) */
    try { await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }); await screen.orientation?.lock?.('landscape'); } catch { /* sigue igual */ }
    this.activo = true; this.sbs = sbs; this.alSalir = alSalir; this.cam = cam;
    this.fpAntes = cam.fp; cam.fp = true;
    this.base = cam.yaw; this.q0 = null; this.giro0 = null; this.arrastre = { yaw: 0, pitch: 0 };
    this.camina = false; this.tAbajo = 0;
    this.capa(raiz);
    return true;
  }
  salir() {
    if (!this.activo) return;
    this.activo = false; this.camina = false;
    removeEventListener('deviceorientation', this._orient);
    try { screen.orientation?.unlock?.(); if (document.fullscreenElement) document.exitFullscreen?.(); } catch { /* nada */ }
    this.cam.fp = this.fpAntes; this.cam.rollVR = 0;
    this.el?.remove(); this.el = null;
    this.alSalir?.();
  }
  /* la capa de arriba: el punto del centro (uno por ojo), la ayuda y el aro de salir; se come los toques */
  capa(raiz) {
    const ojos = this.sbs ? 2 : 1;
    const el = this.el = document.createElement('div'); el.className = 'vr-capa' + (this.sbs ? ' sbs' : '');
    el.innerHTML = Array.from({ length: ojos }, () => `<div class="vr-ojo"><i class="vr-punto"><b></b></i><span class="vr-salir">${t('vr_salir')}</span><p class="vr-ayuda">${t('vr_ayuda')}</p></div>`).join('') + (this.sbs ? '<i class="vr-medio"></i>' : '');
    raiz.appendChild(el);
    setTimeout(() => el.classList.add('sin-ayuda'), 5000);
    let ultimo = -1, espera = null, arr = null;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); arr = { x: e.clientX, y: e.clientY, t: performance.now(), movio: false }; });
    el.addEventListener('pointermove', (e) => {
      if (!arr || this.giro) return;
      /* sin giroscopio (la compu): arrastrar mira */
      const dx = e.clientX - arr.x, dy = e.clientY - arr.y; if (Math.abs(dx) + Math.abs(dy) > 4) arr.movio = true;
      this.arrastre.yaw -= dx * 0.005; this.arrastre.pitch = THREE.MathUtils.clamp(this.arrastre.pitch - dy * 0.005, -1.4, 1.4); arr.x = e.clientX; arr.y = e.clientY;
    });
    el.addEventListener('pointerup', () => {
      if (!arr) return; const fue = arr; arr = null;
      if (fue.movio || performance.now() - fue.t > 450) return;
      const ahora = performance.now() / 1000;
      if (ahora - ultimo < DOBLE) { clearTimeout(espera); espera = null; ultimo = -1; this.salta = true; return; }
      ultimo = ahora;
      espera = setTimeout(() => { espera = null; this.toque = true; }, DOBLE * 1000);
    });
  }
  /* el cuaternión de la cabeza, con el rumbo de entrada */
  orientacion() {
    if (this.giro) {
      const { a, b, g } = this.giro;
      /* el giro de la pantalla: el del sistema, más el del CSS si el juego está girado */
      let ang = (screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI / 180;
      if (Pantalla.girado) ang += Pantalla.invertido ? -Math.PI / 2 : Math.PI / 2;
      _e.set(b, a, -g, 'YXZ'); this.q.setFromEuler(_e); this.q.multiply(Q1); this.q.multiply(_q.setFromAxisAngle(Z, -ang));
      /* el primer cuadro fija para dónde es "adelante": se descuenta el rumbo del celu y se suma el del muñeco */
      if (this.q0 == null) { _v.set(0, 0, -1).applyQuaternion(this.q); this.q0 = Math.atan2(-_v.x, -_v.z); }   // (== null: un rumbo de 0 es válido)
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.base - this.q0); this.q.premultiply(_q);
    } else {
      _e.set(this.arrastre.pitch, this.base + this.arrastre.yaw, 0, 'YXZ'); this.q.setFromEuler(_e);
    }
    return this.q;
  }
  /* antes de mover al muñeco: lo que "tocó" (E es lo que leyó entrada.js) */
  entrada(E, dt, hayAlgo) {
    E.camX = 0; E.camY = 0; E.zoom = 1;
    if (this.toque) { this.toque = false; if (hayAlgo) { E.accion = true; this.camina = false; } else this.camina = !this.camina; }
    if (this.salta) { this.salta = false; E.salta = true; E.sostiene = true; this._tSalto = 0.25; }
    if (this._tSalto > 0) { this._tSalto -= dt; E.sostiene = true; }
    if (this.camina) { E.x = 0; E.z = -1; E.corre = false; }
  }
  /* después de la cámara del juego: la vista es la de la cabeza. cam.yaw y cam.pitch se
     ponen de la vista (para caminar para donde se mira y para el cuerpo de primera persona) */
  orientar(camara, cam, dt) {
    const q = this.orientacion();
    camara.quaternion.copy(q);
    _v.set(0, 0, -1).applyQuaternion(q);
    cam.yaw = Math.atan2(-_v.x, -_v.z);
    cam.pitch = THREE.MathUtils.clamp(0.3 - Math.asin(THREE.MathUtils.clamp(_v.y, -1, 1)), -0.95, 1.55);
    /* mirar abajo un rato sale (el aro del punto se va llenando) */
    this.tAbajo = _v.y < -0.9 ? this.tAbajo + dt : Math.max(0, this.tAbajo - dt * 2);
    if (this.el) { this.el.style.setProperty('--salir', Math.min(1, this.tAbajo / SALIR_TRAS)); this.el.classList.toggle('saliendo', this.tAbajo > 0.2); this.el.classList.toggle('camina', this.camina); }
    if (this.tAbajo >= SALIR_TRAS) this.salir();
  }
  /* las dos mitades: cada ojo con su cámara, derecho a la pantalla (sin la cadena de efectos: son
     dos dibujos por cuadro) */
  dibujar(motor) {
    const r = motor.r, c = motor.camara;
    r.getSize(_t); const w = _t.x, h = _t.y;
    const aspecto = c.aspect; c.aspect = (w / 2) / h; c.updateProjectionMatrix();
    c.updateMatrixWorld(); this.estereo.aspect = 1; this.estereo.update(c);
    r.setRenderTarget(null); r.setScissorTest(true);
    r.setScissor(0, 0, w / 2, h); r.setViewport(0, 0, w / 2, h); r.render(motor.escena, this.estereo.cameraL);
    r.setScissor(w / 2, 0, w / 2, h); r.setViewport(w / 2, 0, w / 2, h); r.render(motor.escena, this.estereo.cameraR);
    r.setScissorTest(false); r.setViewport(0, 0, w, h);
    c.aspect = aspecto; c.updateProjectionMatrix();
  }
}

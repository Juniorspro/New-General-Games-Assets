/* ============================================================================
   aeroplaza/js/vr.js — el modo VR del celu, sin botones: primera persona y la
   cámara la mueve el giroscopio (DeviceOrientation), como un visor de cartón.
   - Con SBS: la pantalla partida en dos (un ojo cada mitad, 6,4 cm entre los
     ojos) para ponerlo en un visor.
   - Sin SBS: una sola vista, "ventana mágica": se mira moviendo el celu.
   Sin controles en pantalla: un toque camina o frena (si hay algo para usar
   cerca, lo usa), dos toques saltan y mirar para abajo 2 s sale del modo. En
   la compu (sin giroscopio) se mira arrastrando, para probarlo.
   La orientación: la receta de siempre (el DeviceOrientationControls que tenía
   three): alfa, beta y gama a un cuaternión, girado -90° en x (la cámara mira
   por detrás del celu) y corregido por el giro de la pantalla. Si el juego está
   girado por CSS (celu parado con el giro de pantalla trabado, pantalla.js), ese
   giro cuenta como si la pantalla estuviera acostada.
   A 120 (27/09):
   - El giroscopio llega a ~60 lecturas por segundo: la pose se ADELANTA al
     momento en que se va a ver, con la velocidad de giro (devicemotion.
     rotationRate, el giróscopo crudo), como Cardboard. Así la cabeza se mueve
     a 120 aunque el sensor vaya a 60, y sin el retraso de un cuadro.
   - El dibujo (vr-dibujo.js) reproyecta el mundo a cada ojo; si el celu no
     llega, lo dibuja partido en dos cuadros. Se decide solo, mirando cada
     cuánto llegan los cuadros de verdad.
   ========================================================================== */
import * as THREE from 'three';
import { t, sumar } from './textos.js';
import { Pantalla } from './pantalla.js';
import { DibujoVR } from './vr-dibujo.js';

sumar({
  es: { vr_titulo: 'Modo VR', vr_texto: 'Primera persona y mirás moviendo el celu. Sin botones: un toque camina o frena (o usa lo que tengas cerca), dos toques saltan y mirar para abajo un rato sale.', vr_sbs: '👓 Con visor', vr_sbs_d: 'Pantalla doble (SBS)', vr_simple: '📱 Sin visor', vr_simple_d: 'Una sola vista', vr_ayuda: 'Tocá para caminar · mirá abajo para salir', vr_salir: 'Salir', vr_sin_giro: 'Sin giroscopio: arrastrá para mirar', vr_permiso: 'Hace falta el permiso del movimiento para mirar con el celu', vr_mundo: 'mundo', vr_manos: '✋ Manos con la cámara', vr_manos_d: 'Como en Meta Quest: pellizcá para usar', vr_fps: '⏱ Cuadros por segundo', vr_fps_d: 'Arriba de cada ojo', vr_xr: '🥽 Visor VR', vr_xr_d: 'Quest y otros: hasta 120 Hz, con tus manos', vr_xr_error: 'El visor no pudo arrancar' },
  en: { vr_titulo: 'VR mode', vr_texto: 'First person, and you look around by moving your phone. No buttons: one tap walks or stops (or uses what’s nearby), two taps jump, and looking down for a while exits.', vr_sbs: '👓 With headset', vr_sbs_d: 'Split screen (SBS)', vr_simple: '📱 No headset', vr_simple_d: 'Single view', vr_ayuda: 'Tap to walk · look down to exit', vr_salir: 'Exit', vr_sin_giro: 'No gyroscope: drag to look', vr_permiso: 'Motion permission is needed to look with the phone', vr_mundo: 'world', vr_manos: '✋ Hands with the camera', vr_manos_d: 'Like Meta Quest: pinch to use', vr_fps: '⏱ Frames per second', vr_fps_d: 'Above each eye', vr_xr: '🥽 VR headset', vr_xr_d: 'Quest and others: up to 120 Hz, with your hands', vr_xr_error: 'The headset couldn’t start' },
  pt: { vr_titulo: 'Modo VR', vr_texto: 'Primeira pessoa, e você olha mexendo o celular. Sem botões: um toque anda ou para (ou usa o que estiver perto), dois toques pulam e olhar para baixo um tempo sai.', vr_sbs: '👓 Com óculos', vr_sbs_d: 'Tela dupla (SBS)', vr_simple: '📱 Sem óculos', vr_simple_d: 'Uma só vista', vr_ayuda: 'Toque para andar · olhe para baixo para sair', vr_salir: 'Sair', vr_sin_giro: 'Sem giroscópio: arraste para olhar', vr_permiso: 'Precisa da permissão de movimento para olhar com o celular', vr_mundo: 'mundo', vr_manos: '✋ Mãos com a câmera', vr_manos_d: 'Como no Meta Quest: pinça para usar', vr_fps: '⏱ Quadros por segundo', vr_fps_d: 'Em cima de cada olho', vr_xr: '🥽 Óculos VR', vr_xr_d: 'Quest e outros: até 120 Hz, com suas mãos', vr_xr_error: 'Os óculos não conseguiram iniciar' },
});

const Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0), Q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
const SALIR_TRAS = 2;          // segundos mirando abajo
const DOBLE = 0.3;             // segundos entre dos toques para que sea doble
const FOV = { sbs: 80, simple: 70 };
const REFRESCOS = [60, 72, 90, 120, 144];

export class VR {
  constructor() {
    this.activo = false; this.sbs = false;
    this.giro = null;            // la última lectura del giroscopio { a, b, g } en radianes, y cuándo (tGiro)
    this.omega = null;           // la velocidad de giro del celu, en sus ejes (rad/s), y cuándo
    this.base = 0;               // el rumbo al entrar: la vista arranca para donde miraba el muñeco
    this.q = new THREE.Quaternion(); this.qDev = new THREE.Quaternion(); this.giroAntes = null;
    this.camina = false; this.salta = false; this.usa = false;
    this.tAbajo = 0; this.arrastre = { yaw: 0, pitch: 0 };
    this.dib = null; this.modo = 'completo'; this.forzar = null;
    this.ritmo = { ms: new Float32Array(90), n: 0, i: 0, refresco: 1000 / 60, mediana: 1000 / 60, tMal: 0, tBien: 0, espera: 5, intentoEn: 0, desde: 0 };
    this.fps = { n: 0, t: 0, mundo: 0, esc0: 0, valor: 0, valorMundo: 0 };
    this.verFps = false;
    /* cada lectura queda como la pose del celu (en sus ejes, qDev = euler·Q1) y cuándo llegó; la
       anterior sirve para sacar la velocidad si no hay giróscopo */
    this._orient = (e) => {
      if (e.alpha == null && e.beta == null) return;
      const k = Math.PI / 180, q = (this.giroAntes?.q || new THREE.Quaternion());
      _e.set((e.beta || 0) * k, (e.alpha || 0) * k, -(e.gamma || 0) * k, 'YXZ'); q.setFromEuler(_e).multiply(Q1);
      this.giroAntes = this.giro; this.giro = { q, t: e.timeStamp || performance.now() };
    };
    /* el giróscopo crudo: alfa gira en z, beta en x y gama en y (ejes del celu), en grados por segundo */
    this._mov = (e) => {
      const r = e.rotationRate; if (!r || (r.alpha == null && r.beta == null)) return;
      const k = Math.PI / 180;
      this.omega = { x: (r.beta || 0) * k, y: (r.gamma || 0) * k, z: (r.alpha || 0) * k, t: e.timeStamp || performance.now() };
    };
  }
  /* se llama desde el toque del botón (en iOS el permiso tiene que pedirse ahí) */
  async entrar(sbs, { raiz, cam, alSalir, avisar, xr = null }) {
    if (this.activo) return true;   // (ya adentro: una segunda capa y el "antes" de la cámara quedaban mal)
    /* con un visor de verdad (vr-xr.js) la cabeza y el dibujo son del visor: sin sensores ni capa */
    if (xr) {
      this.xr = xr; this.activo = true; this.sbs = false; this.alSalir = alSalir; this.cam = cam;
      this.fpAntes = cam.fp; cam.fp = true; cam.enVR = true; this.base = cam.yaw; this.camina = false; this.tAbajo = 0;
      return true;
    }
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      try { if ((await DOE.requestPermission()) !== 'granted') avisar?.(t('vr_permiso')); } catch { avisar?.(t('vr_permiso')); }
    }
    addEventListener('deviceorientation', this._orient);
    addEventListener('devicemotion', this._mov);
    /* pantalla completa y acostada, si se deja (en los Artifacts o en iOS puede que no: el juego se gira solo) */
    try { await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }); await screen.orientation?.lock?.('landscape'); } catch { /* sigue igual */ }
    this.activo = true; this.sbs = sbs; this.alSalir = alSalir; this.cam = cam;
    this.fpAntes = cam.fp; cam.fp = true; cam.enVR = true;
    this.base = cam.yaw; this.q0 = null; this.giro0 = null; this.arrastre = { yaw: 0, pitch: 0 };
    this.camina = false; this.tAbajo = 0;
    /* se arranca dibujando entero; el ritmo se mide de nuevo (el primer segundo compila y no cuenta) */
    const R = this.ritmo; R.n = 0; R.i = 0; R.tMal = 0; R.tBien = 0; R.espera = 5; R.intentoEn = 0; R.desde = performance.now() + 1000; R.enteroDesde = R.desde;
    this.modo = 'completo'; this.fps.t = 0; this.fps.n = 0;
    this.capa(raiz);
    return true;
  }
  salir() {
    if (!this.activo) return;
    this.activo = false; this.camina = false;
    if (this.xr) { const x = this.xr; this.xr = null; x.salir(); this.cam.fp = this.fpAntes; this.cam.enVR = false; this.alSalir?.(); return; }
    removeEventListener('deviceorientation', this._orient);
    removeEventListener('devicemotion', this._mov);
    try { screen.orientation?.unlock?.(); if (document.fullscreenElement) document.exitFullscreen?.(); } catch { /* nada */ }
    this.cam.fp = this.fpAntes; this.cam.rollVR = 0; this.cam.enVR = false;
    this.el?.remove(); this.el = null;
    /* lo del dibujo vuelve a la pantalla normal (el brillo y el tamaño) */
    if (this.dib) { this.dib.soltar(); this.motor?.medir(); }
    this.alSalir?.();
  }
  /* la capa de arriba: el punto del centro (uno por ojo), la ayuda y el aro de salir; se come los toques */
  capa(raiz) {
    const ojos = this.sbs ? 2 : 1;
    const el = this.el = document.createElement('div'); el.className = 'vr-capa' + (this.sbs ? ' sbs' : '') + (this.verFps ? ' con-fps' : '');
    el.innerHTML = Array.from({ length: ojos }, () => `<div class="vr-ojo"><i class="vr-punto"><b></b></i><span class="vr-salir">${t('vr_salir')}</span><p class="vr-ayuda">${t('vr_ayuda')}</p><span class="vr-fps"></span></div>`).join('') + (this.sbs ? '<i class="vr-medio"></i>' : '');
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
  /* el cuaternión de la cabeza, con el rumbo de entrada, adelantado al momento en que se va a ver (tVer) */
  orientacion(tVer = performance.now()) {
    if (this.giro) {
      /* el giro de la pantalla: el del sistema, más el del CSS si el juego está girado */
      let ang = (screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI / 180;
      if (Pantalla.girado) ang += Pantalla.invertido ? -Math.PI / 2 : Math.PI / 2;
      this.qDev.copy(this.giro.q);
      this.predecir(tVer);
      this.q.copy(this.qDev).multiply(_q.setFromAxisAngle(Z, -ang));
      /* el primer cuadro fija para dónde es "adelante": se descuenta el rumbo del celu y se suma el del muñeco */
      if (this.q0 == null) { _v.set(0, 0, -1).applyQuaternion(this.q); this.q0 = Math.atan2(-_v.x, -_v.z); }   // (== null: un rumbo de 0 es válido)
      _q.setFromAxisAngle(Y, this.base - this.q0); this.q.premultiply(_q);
    } else {
      _e.set(this.arrastre.pitch, this.base + this.arrastre.yaw, 0, 'YXZ'); this.q.setFromEuler(_e);
    }
    return this.q;
  }
  /* la pose del celu (qDev, en sus ejes) llevada de cuando se leyó a tVer: q·exp(ω·Δ). La velocidad
     sale del giróscopo; si no llega (algunos navegadores), de las dos últimas lecturas */
  predecir(tVer) {
    const G = this.giro, A = this.giroAntes, dt = Math.min(0.05, Math.max(0, (tVer - G.t) / 1000));
    if (dt <= 0) return;
    let w = null;
    if (this.omega && Math.abs(G.t - this.omega.t) < 150) w = _w.set(this.omega.x, this.omega.y, this.omega.z);
    else if (A && G.t - A.t > 4 && G.t - A.t < 100) {
      /* (ω de la diferencia: q_antes⁻¹·q, en ángulo y eje, sobre el tiempo entre las dos) */
      _q2.copy(A.q).invert().multiply(G.q); if (_q2.w < 0) { _q2.x *= -1; _q2.y *= -1; _q2.z *= -1; _q2.w *= -1; }
      const s = Math.sqrt(Math.max(0, 1 - _q2.w * _q2.w)), ang = 2 * Math.acos(Math.min(1, _q2.w)), k = s > 1e-6 ? ang / s / ((G.t - A.t) / 1000) : 0;
      w = _w.set(_q2.x * k, _q2.y * k, _q2.z * k);
    }
    if (!w) return;
    const m = w.length(); if (m < 1e-4) return;
    this.qDev.multiply(_q.setFromAxisAngle(w.divideScalar(m), Math.min(m, 20) * dt));
  }
  /* antes de mover al muñeco: lo que "tocó" (E es lo que leyó entrada.js) */
  entrada(E, dt, hayAlgo) {
    E.camX = 0; E.camY = 0; E.zoom = 1;
    if (this.xr) this.xr.leerMandos(E, dt, (lado) => { this.base += lado * Math.PI / 4; });
    if (this.toque) { this.toque = false; if (hayAlgo) { E.accion = true; this.camina = false; } else this.camina = !this.camina; }
    if (this.salta) { this.salta = false; E.salta = true; E.sostiene = true; this._tSalto = 0.25; }
    if (this._tSalto > 0) { this._tSalto -= dt; E.sostiene = true; }
    if (this.camina) { E.x = 0; E.z = -1; E.corre = false; }
  }
  /* después de la cámara del juego: la vista es la de la cabeza. cam.yaw y cam.pitch se
     ponen de la vista (para caminar para donde se mira y para el cuerpo de primera persona) */
  orientar(camara, cam, dt) {
    /* se adelanta un cuadro y medio: lo que tarda en verse lo que se dibuja ahora */
    const q = this.orientacion(this.tVer = performance.now() + Math.min(30, this.ritmo.refresco * 1.5));
    camara.quaternion.copy(q);
    _v.set(0, 0, -1).applyQuaternion(q);
    cam.yaw = Math.atan2(-_v.x, -_v.z);
    cam.pitch = THREE.MathUtils.clamp(0.3 - Math.asin(THREE.MathUtils.clamp(_v.y, -1, 1)), -0.95, 1.55);
    /* mirar abajo un rato sale (el aro del punto se va llenando) */
    this.tAbajo = _v.y < -0.9 ? this.tAbajo + dt : Math.max(0, this.tAbajo - dt * 2);
    if (this.el) { this.el.style.setProperty('--salir', Math.min(1, this.tAbajo / SALIR_TRAS)); this.el.classList.toggle('saliendo', this.tAbajo > 0.2); this.el.classList.toggle('camina', this.camina); }
    if (this.tAbajo >= SALIR_TRAS) this.salir();
  }
  /* en el visor: la cabeza ya la puso el visor al dibujar; de ahí salen el rumbo y la mirada */
  orientarXR(camara, cam) {
    _v.set(0, 0, -1).applyQuaternion(camara.quaternion);
    cam.yaw = Math.atan2(-_v.x, -_v.z);
    cam.pitch = THREE.MathUtils.clamp(0.3 - Math.asin(THREE.MathUtils.clamp(_v.y, -1, 1)), -0.95, 1.55);
  }
  get fov() { return this.sbs ? FOV.sbs : FOV.simple; }
  /* cuánto está girado el juego por CSS respecto de la pantalla (lo usa la cámara de las manos: el
     video llega derecho para la pantalla, no para el juego) */
  get giroCSS() { return Pantalla.girado ? (Pantalla.invertido ? -Math.PI / 2 : Math.PI / 2) : 0; }
  /* un cartelito en cada ojo por unos segundos (la interfaz normal no se ve en VR) */
  decir(texto, seg = 3.5) {
    if (!this.el) { this.alDecir?.(texto, seg); return; }
    for (const p of this.el.querySelectorAll('.vr-ayuda')) p.textContent = texto;
    this.el.classList.remove('sin-ayuda'); clearTimeout(this._tDecir);
    this._tDecir = setTimeout(() => this.el?.classList.add('sin-ayuda'), seg * 1000);
  }
  ponerFps(si) { this.verFps = si; this.el?.classList.toggle('con-fps', si); }
  /* cada cuánto llegan los cuadros (real, en s): la pantalla (el refresco) y si se llega o no.
     Dibujando entero, si los cuadros tardan un 30 % más que la pantalla durante 0,6 s, se parte;
     partido, si se llega sobrado 3 s, se prueba de nuevo entero (cada vez esperando el doble) */
  medirRitmo(real, dt) {
    const R = this.ritmo, ahora = performance.now(), ms = real * 1000;
    if (ahora < R.desde || !(ms > 2 && ms < 250)) return;
    R.ms[R.i] = ms; R.i = (R.i + 1) % R.ms.length; R.n = Math.min(R.n + 1, R.ms.length);
    if (R.n < 20) return;
    const v = Array.from(R.ms.subarray(0, R.n)).sort((x, y) => x - y);
    /* la pantalla: el cuadro más rápido que se repite (el 10 %), redondeado a las comunes */
    const hz = 1000 / v[Math.floor(v.length * 0.1)];
    R.refresco = 1000 / REFRESCOS.reduce((m, h) => (Math.abs(h - hz) < Math.abs(m - hz) ? h : m), 60);
    const ult = Array.from({ length: Math.min(30, R.n) }, (_, k) => R.ms[(R.i - 1 - k + R.ms.length) % R.ms.length]).sort((x, y) => x - y);
    R.mediana = ult[Math.floor(ult.length / 2)];
    if (this.forzar) return;
    if (this.modo === 'completo') {
      R.tMal = R.mediana > R.refresco * 1.3 ? R.tMal + dt : 0;
      if (R.tMal > 0.6) {
        /* si duró poco entero, la próxima prueba espera el doble */
        if (ahora - R.enteroDesde < 4000) R.espera = Math.min(60, R.espera * 2);
        this.modo = 'partido'; R.tMal = 0; R.tBien = 0; R.intentoEn = ahora + R.espera * 1000;
      }
    } else {
      R.tBien = R.mediana < R.refresco * 1.1 ? R.tBien + dt : 0;
      if (R.tBien > 3 && ahora > R.intentoEn) { this.modo = 'completo'; R.tBien = 0; R.enteroDesde = ahora; }
    }
  }
  /* el dibujo de cada cuadro (el de la pantalla: real es lo que pasó de verdad desde el anterior) */
  dibujar(motor, dt, real = dt, encima = null) {
    /* en el visor, three dibuja los dos ojos (a la frecuencia del visor); las sombras, como siempre */
    if (this.xr) {
      const r = motor.r, cada = motor.Q.sombraCada || 1;
      r.shadowMap.autoUpdate = cada === 1; if (cada > 1) r.shadowMap.needsUpdate = ((this._nSombra = (this._nSombra || 0) + 1) % cada) === 0;
      r.setRenderTarget(null); r.render(motor.escena, motor.camara);
      return;
    }
    if (!this.dib) this.dib = new DibujoVR(motor);
    this.motor = motor;
    this.dib.medir(this.sbs, this.fov);
    this.medirRitmo(real, dt);
    const partido = this.forzar ? this.forzar === 'partido' : this.modo === 'partido';
    const Q = motor.nombreCalidad;
    this.dib.cuadro(dt, motor.camara, { partido, encima, fino: Q === 'alta' || Q === 'media' });
    /* los cuadros por segundo (los de la cabeza y los del mundo) */
    const F = this.fps; F.n++; F.t += real;
    if (F.t >= 0.5) {
      F.valor = F.n / F.t; F.valorMundo = (this.dib.stats.escenas - F.esc0) / F.t; F.n = 0; F.t = 0; F.esc0 = this.dib.stats.escenas;
      if (this.verFps && this.el) for (const s of this.el.querySelectorAll('.vr-fps')) s.textContent = `${Math.round(F.valor)} fps · ${t('vr_mundo')} ${Math.round(F.valorMundo)}`;
    }
  }
}

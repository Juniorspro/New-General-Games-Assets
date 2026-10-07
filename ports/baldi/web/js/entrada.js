/* Entrada como la arma Rewired en Baldi: acciones Forward/Strafe (W S D A), Turn (mouse X, 0,05 por
   píxel), Interact (clic izquierdo), Item (clic derecho), ItemSelect (rueda), Item1-3, Run (Shift),
   LookBack/Jump (espacio), Pause (Escape); y el control táctil (TouchControl: StickX, StickY, LookX y
   los botones) que llenan los controles de la pantalla (ui.js). También Input de Unity (teclas sueltas,
   toques) y Cursor (bloqueo del puntero). */

const TECLAS = { Forward: [['KeyW', 1], ['KeyS', -1], ['ArrowUp', 1], ['ArrowDown', -1]], Strafe: [['KeyD', 1], ['KeyA', -1]], Turn: [['ArrowRight', 1], ['ArrowLeft', -1]] }; // (girar con flechas: extra)
const BOTONES = {
  Item1: ['Digit1'], Item2: ['Digit2'], Item3: ['Digit3'], Run: ['ShiftLeft', 'ShiftRight'], LookBack: ['Space'], Jump: ['Space'], Pause: ['Escape'],
  UICancel: ['Escape'], UISubmit: ['Enter', 'NumpadEnter'], Interact: ['KeyE'], Item: ['KeyQ'], ItemSelectLeft: [], ItemSelectRight: [],
};
// elementos del control táctil de Rewired → acciones (customControllerMaps)
export const TACTIL = { ejes: { 0: 'Strafe', 1: 'Forward', 2: 'Turn' }, botones: { 3: ['Interact', 'Jump'], 4: ['Item'], 5: ['Run'], 6: ['LookBack'], 7: ['Item1'], 8: ['Item2'], 9: ['Item3'], 10: ['Jump'], 11: ['Pause'] } };

export class Entrada {
  constructor(elem) {
    this.elem = elem;
    this.abajo = new Set(); this.recien = new Set(); this.soltadas = new Set(); this.teclasRecien = new Set();
    this.mouse = { dx: 0, rueda: 0, botones: new Set(), recien: new Set(), x: 0, y: 0 };
    this.tactil = { ejes: { 0: 0, 1: 0, 2: 0 }, botones: new Set(), antes: new Set() };
    this.ultimo = 'Keyboard'; this.toques = 0; this.usandoTactil = false;
    this.bloqueoPedido = false; this.ui = null;
    this.estadoAcc = new Map(); this.antesAcc = new Map();
    addEventListener('keydown', (e) => {
      if (e.repeat) { if (this.capturar(e)) e.preventDefault(); return; }
      this.abajo.add(e.code); this.recien.add(e.code); this.teclasRecien.add(e.key); this.ultimo = 'Keyboard'; this.usandoTactil = false;
      if (this.ui?.tecla(e)) { e.preventDefault(); return; }
      if (this.capturar(e)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.abajo.delete(e.code); this.soltadas.add(e.code); });
    addEventListener('blur', () => { this.abajo.clear(); this.mouse.botones.clear(); });
    elem.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === elem) this.mouse.dx += e.movementX;
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    });
    elem.addEventListener('mousedown', (e) => {
      if (this.bloqueoPedido && document.pointerLockElement !== elem && !this.ui?.encima(e.clientX, e.clientY)) { this.bloquear(); return; }
      if (document.pointerLockElement === elem) { this.mouse.botones.add(e.button); this.mouse.recien.add(e.button); }
      this.ultimo = 'Mouse'; this.usandoTactil = false;
    });
    addEventListener('mouseup', (e) => this.mouse.botones.delete(e.button));
    elem.addEventListener('contextmenu', (e) => e.preventDefault());
    elem.addEventListener('wheel', (e) => { if (document.pointerLockElement === elem) this.mouse.rueda += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    elem.addEventListener('touchstart', () => { this.usandoTactil = true; this.ultimo = 'Custom'; }, { passive: true });
  }
  capturar(e) { return ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code); }
  bloquear() { try { const p = this.elem.requestPointerLock?.(); if (p?.catch) p.catch(() => {}); } catch { /* sin bloqueo */ } }
  get bloqueado() { return document.pointerLockElement === this.elem; }
  // Cursor.lockState
  ponerBloqueo(si) {
    this.bloqueoPedido = si;
    if (!si && document.pointerLockElement === this.elem) document.exitPointerLock?.();
  }
  /* --- un cuadro: lo de este cuadro queda en "recien"; al final se limpia */
  calcular() {
    const acc = new Map();
    const boton = (n) => {
      if ((BOTONES[n] || []).some((k) => this.abajo.has(k))) return true;
      if (n === 'Interact' && this.mouse.botones.has(0)) return true;
      if (n === 'Item' && this.mouse.botones.has(2)) return true;
      for (const [id, lista] of Object.entries(TACTIL.botones)) if (lista.includes(n) && this.tactil.botones.has(+id)) return true;
      return false;
    };
    for (const n of new Set([...Object.keys(BOTONES), 'Interact', 'Item'])) acc.set(n, boton(n));
    this.antesAcc = this.estadoAcc; this.estadoAcc = acc;
  }
  finCuadro() {
    this.recien.clear(); this.soltadas.clear(); this.teclasRecien.clear(); this.mouse.recien.clear(); this.mouse.dx = 0; this.mouse.rueda = 0;
    this.tactil.ejes[2] = 0;
  }
  /* --- la API de Rewired (Player) */
  GetAxis(n) {
    let v = 0;
    for (const [k, s] of TECLAS[n] || []) if (this.abajo.has(k)) v += s;
    if (n === 'Turn') v = v * 1.5 + this.mouse.dx * 0.05 + this.tactil.ejes[2];
    if (n === 'Strafe') v += this.tactil.ejes[0];
    if (n === 'Forward') v += this.tactil.ejes[1];
    if (n === 'ItemSelect') v = -this.mouse.rueda;
    return n === 'Turn' ? v : Math.max(-1, Math.min(1, v));
  }
  GetButton(n) { return !!this.estadoAcc.get(n); }
  GetButtonDown(n) {
    if (n === 'Interact' && this.mouse.recien.has(0)) return true;
    if (n === 'Item' && this.mouse.recien.has(2)) return true;
    return !!this.estadoAcc.get(n) && !this.antesAcc.get(n);
  }
  GetButtonUp(n) { return !this.estadoAcc.get(n) && !!this.antesAcc.get(n); }
  GetAnyButton() { return this.abajo.size > 0 || this.mouse.botones.size > 0 || this.tactil.botones.size > 0 || this._toqueRecien; }
  GetAnyButtonDown() { return this.recien.size > 0 || this.mouse.recien.size > 0 || this._toqueRecien; }
  SetVibration(motor, nivel, dur) { if (nivel > 0 && navigator.vibrate && this.usandoTactil) { try { navigator.vibrate(Math.round(dur * 1000 * Math.min(1, nivel))); } catch { /* */ } } }
  /* --- Input de Unity */
  GetKeyDown(k) {
    if (k === 'return' || k === 'enter') return this.recien.has('Enter') || this.recien.has('NumpadEnter');
    if (typeof k === 'string' && k.length === 1) return this.teclasRecien.has(k.toLowerCase()) || this.teclasRecien.has(k.toUpperCase());
    return false;
  }
}

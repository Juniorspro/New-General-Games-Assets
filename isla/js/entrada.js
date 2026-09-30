// Teclado + mouse (con el puntero capturado) y dedos (palanca, mirar y
// botones). El resto del juego lee UNA cosa por cuadro: this.estado.
//
// Los flancos ("recién apretado") se limpian al FINAL del cuadro, después de
// que el juego los leyó: si se limpian al principio, nunca dan verdadero.
import { aApp } from './pantalla.js';

const TECLAS = {
  adelante: ['KeyW', 'ArrowUp'], atras: ['KeyS', 'ArrowDown'], izq: ['KeyA', 'ArrowLeft'], der: ['KeyD', 'ArrowRight'],
  salto: ['Space'], correr: ['ShiftLeft', 'ShiftRight'], e: ['KeyE'], inv: ['Tab', 'KeyI'], pausa: ['Escape', 'KeyP'],
  soltar: ['KeyQ'], comer: ['KeyF'], pincel: ['KeyR'], mapa: ['KeyM'], vista: ['KeyV'],
};

export class Entrada {
  constructor(lienzo) {
    this.lienzo = lienzo;
    this.abajo = new Set();
    this.recien = new Set();
    this.mira = { dx: 0, dy: 0 };
    this.botones = { izq: false, der: false };
    this.botonesRecien = { izq: false, der: false };
    this.rueda = 0;
    this.num = -1;
    this.sens = 1;
    this.capturado = false;
    this.activo = false;          // solo en juego, no en menús
    this.tactil = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.joy = { x: 0, y: 0, id: null, cx: 0, cy: 0 };
    this.dedoMira = null;
    this.tUsar = false; this.tUsarRecien = false; this.tSalto = false; this.tSaltoRecien = false;

    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (!this.abajo.has(e.code)) this.recien.add(e.code);
      this.abajo.add(e.code);
      if (/^Digit[1-9]$/.test(e.code)) this.num = +e.code.slice(5) - 1;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && this.activo) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.abajo.delete(e.code));
    // si la pestaña pierde el foco con una tecla apretada, el keyup no llega
    addEventListener('blur', () => { this.abajo.clear(); this.botones.izq = this.botones.der = false; });

    lienzo.addEventListener('mousedown', (e) => {
      if (!this.activo || this.tactil) return;
      if (!this.capturado) { this.pedirCaptura(); return; }
      if (e.button === 0) { this.botones.izq = true; this.botonesRecien.izq = true; }
      if (e.button === 2) { this.botones.der = true; this.botonesRecien.der = true; }
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.botones.izq = false; if (e.button === 2) this.botones.der = false; });
    lienzo.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!this.capturado) return;
      this.mira.dx += e.movementX * this.sens;
      this.mira.dy += e.movementY * this.sens;
    });
    addEventListener('wheel', (e) => { if (this.activo) this.rueda += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => { this.capturado = document.pointerLockElement === lienzo; });

    this.armarDedos();
  }

  pedirCaptura() {
    if (this.tactil) return;
    try { const p = this.lienzo.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* sin captura: el juego sigue */ }
  }
  soltarCaptura() { if (document.pointerLockElement) try { document.exitPointerLock(); } catch { /* nada */ } }

  armarDedos() {
    const joy = document.getElementById('joy'), perilla = document.getElementById('joyP');
    const radio = 52;
    joy.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      const r = joy.getBoundingClientRect();
      // todo en coordenadas de la app: con la pantalla girada, "arriba" es otro lado
      const [cx, cy] = aApp(r.left + r.width / 2, r.top + r.height / 2);
      this.joy.id = t.identifier; this.joy.cx = cx; this.joy.cy = cy;
      this.moverJoy(...aApp(t.clientX, t.clientY), perilla, radio);
    }, { passive: false });
    addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        const [x, y] = aApp(t.clientX, t.clientY);
        if (t.identifier === this.joy.id) this.moverJoy(x, y, perilla, radio);
        else if (this.dedoMira && t.identifier === this.dedoMira.id) {
          this.mira.dx += (x - this.dedoMira.x) * 2.2 * this.sens;
          this.mira.dy += (y - this.dedoMira.y) * 2.2 * this.sens;
          this.dedoMira.x = x; this.dedoMira.y = y;
        }
      }
    }, { passive: false });
    const fin = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) { this.joy.id = null; this.joy.x = this.joy.y = 0; perilla.style.transform = ''; }
        if (this.dedoMira && t.identifier === this.dedoMira.id) this.dedoMira = null;
      }
    };
    addEventListener('touchend', fin); addEventListener('touchcancel', fin);
    // mirar: el dedo que cae en el lienzo (no en un botón)
    this.lienzo.addEventListener('touchstart', (e) => {
      if (!this.activo) return;
      e.preventDefault();
      const t = e.changedTouches[0];
      const [x, y] = aApp(t.clientX, t.clientY);
      if (!this.dedoMira) this.dedoMira = { id: t.identifier, x, y };
    }, { passive: false });
    const boton = (id, alApretar, alSoltar) => {
      const b = document.getElementById(id);
      b.addEventListener('touchstart', (e) => { e.preventDefault(); b.classList.add('on'); alApretar(); }, { passive: false });
      b.addEventListener('touchend', (e) => { e.preventDefault(); b.classList.remove('on'); if (alSoltar) alSoltar(); }, { passive: false });
    };
    boton('tSalto', () => { this.tSalto = true; this.tSaltoRecien = true; }, () => { this.tSalto = false; });
    boton('tUsar', () => { this.tUsar = true; this.tUsarRecien = true; }, () => { this.tUsar = false; });
    boton('tPoner', () => { this.botonesRecien.der = true; });
    boton('tE', () => this.recien.add('KeyE'));
    boton('tInv', () => this.recien.add('Tab'));
  }

  moverJoy(x, y, perilla, radio) {
    let dx = x - this.joy.cx, dy = y - this.joy.cy;
    const d = Math.hypot(dx, dy);
    if (d > radio) { dx *= radio / d; dy *= radio / d; }
    perilla.style.transform = `translate(${dx}px, ${dy}px)`;
    this.joy.x = dx / radio; this.joy.y = dy / radio;
  }

  tecla(accion) { return TECLAS[accion].some((c) => this.abajo.has(c)); }
  teclaRecien(accion) { return TECLAS[accion].some((c) => this.recien.has(c)); }

  // Lo que el juego necesita este cuadro.
  leer() {
    let x = (this.tecla('der') ? 1 : 0) - (this.tecla('izq') ? 1 : 0);
    let z = (this.tecla('atras') ? 1 : 0) - (this.tecla('adelante') ? 1 : 0);
    let correr = this.tecla('correr');
    if (this.joy.id !== null) {
      const d = Math.hypot(this.joy.x, this.joy.y);
      const k = d < 0.15 ? 0 : (d - 0.15) / 0.85;
      if (d > 0) { x = (this.joy.x / d) * k; z = (this.joy.y / d) * k; }
      correr = d > 0.93;
    }
    const l = Math.hypot(x, z);
    if (l > 1) { x /= l; z /= l; }
    return {
      x, z, correr,
      salto: this.tecla('salto') || this.tSalto,
      saltoRecien: this.teclaRecien('salto') || this.tSaltoRecien,
      usar: this.botones.izq || this.tUsar,
      usarRecien: this.botonesRecien.izq || this.tUsarRecien,
      poner: this.botonesRecien.der,
      e: this.teclaRecien('e'), inv: this.teclaRecien('inv'), pausa: this.teclaRecien('pausa'),
      soltar: this.teclaRecien('soltar'), comer: this.teclaRecien('comer'), pincel: this.teclaRecien('pincel'),
      mapa: this.teclaRecien('mapa'), vista: this.teclaRecien('vista'),
      todo: this.tecla('correr'),   // Shift+Q tira la pila entera
      num: this.num, rueda: this.rueda,
      mdx: this.mira.dx, mdy: this.mira.dy,
    };
  }

  finCuadro() {
    this.recien.clear();
    this.botonesRecien.izq = this.botonesRecien.der = false;
    this.tUsarRecien = this.tSaltoRecien = false;
    this.mira.dx = this.mira.dy = 0;
    this.rueda = 0; this.num = -1;
  }
}

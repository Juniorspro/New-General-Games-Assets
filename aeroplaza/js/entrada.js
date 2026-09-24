/* ============================================================================
   aeroplaza/js/entrada.js — teclado, mouse, mando y dedos.
   Controles de dedo personalizables (pedido fijo de quien pide para todos los
   juegos): cada botón se arrastra y se agranda, se elige la transparencia, el
   tipo de palanca (fija o que aparece donde se apoya el dedo), se espeja para
   zurdos y se elige si vibra. Se guarda.
   ========================================================================== */
const TECLAS = {
  adelante: ['KeyW', 'ArrowUp'], atras: ['KeyS', 'ArrowDown'], izq: ['KeyA', 'ArrowLeft'], der: ['KeyD', 'ArrowRight'],
  salta: ['Space'], corre: ['ShiftLeft', 'ShiftRight'], accion: ['KeyE', 'Enter'], baja: ['KeyC', 'ControlLeft', 'KeyQ'],
  dispara: ['KeyF'], chat: ['KeyT'], camara: ['KeyV'],
  h1: ['Digit1'], h2: ['Digit2'], h3: ['Digit3'], h4: ['Digit4'], h5: ['Digit5'], pausa: ['Escape', 'KeyP'],
};
/* los botones en pantalla, con su lugar por defecto (en % de la pantalla, desde abajo a la derecha) */
export const BOTONES = {
  palanca: { x: 17, y: 27, tam: 1.0, izquierda: true },
  salta: { x: 13, y: 20, tam: 1.15, icono: '⤒' },
  accion: { x: 30, y: 15, tam: 0.9, icono: '✋' },
  corre: { x: 9, y: 37, tam: 0.8, icono: '»' },
  dispara: { x: 28, y: 30, tam: 0.85, icono: '◎' },
  baja: { x: 9, y: 49, tam: 0.7, icono: '⤓' },
};
export const CONTROLES_INICIALES = () => ({ botones: JSON.parse(JSON.stringify(BOTONES)), opacidad: 0.7, palanca: 'flotante', zurdo: false, vibra: true, sensibilidad: 1 });

export class Entrada {
  constructor(lienzo, capaDedos) {
    this.lienzo = lienzo; this.capa = capaDedos;
    this.abajo = new Set(); this.recien = new Set();
    this.mouse = { dx: 0, dy: 0, rueda: 0, arrastra: false };
    this.dedo = { x: 0, z: 0, corre: false, salta: false, sostiene: false, accion: false, dispara: false, baja: false };
    this.dedosCam = { dx: 0, dy: 0 }; this.pinza = 1;
    this.config = CONTROLES_INICIALES();
    this.tactil = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.bloqueado = false;       // mientras se escribe en el chat o hay un menú
    this.usaMando = false;
    addEventListener('keydown', (e) => {
      if (this.escribiendo(e)) return;
      if (!this.abajo.has(e.code)) this.recien.add(e.code);
      this.abajo.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.abajo.delete(e.code));
    addEventListener('blur', () => this.abajo.clear());
    /* la cámara con el mouse: arrastrando sobre el lienzo */
    lienzo.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') { this.mouse.arrastra = true; this.mouse.x = e.clientX; this.mouse.y = e.clientY; } });
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (document.pointerLockElement === lienzo) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; return; }
      if (!this.mouse.arrastra) return;
      this.mouse.dx += e.clientX - this.mouse.x; this.mouse.dy += e.clientY - this.mouse.y; this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    });
    addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') this.mouse.arrastra = false; });
    lienzo.addEventListener('wheel', (e) => { this.mouse.rueda += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    lienzo.addEventListener('contextmenu', (e) => e.preventDefault());
    this.armarDedos();
  }
  escribiendo(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'); }
  ponerConfig(c) { this.config = { ...CONTROLES_INICIALES(), ...c, botones: { ...CONTROLES_INICIALES().botones, ...(c?.botones || {}) } }; this.ubicarDedos(); }
  vibrar(ms = 18) { if (this.config.vibra && navigator.vibrate) try { navigator.vibrate(ms); } catch { /* sin permiso */ } }

  /* ------------------------------------------------------------ los dedos */
  armarDedos() {
    const c = this.capa; c.innerHTML = '';
    this.el = {};
    for (const [n, b] of Object.entries(BOTONES)) {
      const d = document.createElement('div');
      d.className = n === 'palanca' ? 'dedo-palanca' : 'dedo-boton';
      d.dataset.b = n;
      if (n === 'palanca') d.innerHTML = '<div class="palanca-base"></div><div class="palanca-bola"></div>';
      else d.innerHTML = `<span>${b.icono}</span>`;
      c.appendChild(d); this.el[n] = d;
    }
    /* la palanca y los botones con toques (varios dedos a la vez) */
    const toques = new Map();
    const zona = c;
    zona.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && !this.editando) return;
      const b = e.target.closest('[data-b]');
      if (this.editando) { if (b) this.empezarArrastre(e, b); return; }
      e.preventDefault();
      if (b && b.dataset.b !== 'palanca') {
        const n = b.dataset.b; toques.set(e.pointerId, { tipo: 'boton', n }); b.classList.add('apretado'); this.vibrar();
        if (n === 'salta') { this.dedo.salta = true; this.dedo.sostiene = true; }
        else if (n === 'corre') { this.dedo.corre = !this.dedo.corre; b.classList.toggle('prendido', this.dedo.corre); }
        else this.dedo[n] = true;
        return;
      }
      const w = innerWidth, h = innerHeight;
      const izquierdo = this.config.zurdo ? e.clientX > w * 0.5 : e.clientX < w * 0.5;
      if (izquierdo || (b && b.dataset.b === 'palanca')) {
        const P = this.el.palanca, r = P.getBoundingClientRect();
        let cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        if (this.config.palanca === 'flotante' && !(b && b.dataset.b === 'palanca')) { cx = e.clientX; cy = e.clientY; P.style.left = (cx - r.width / 2) + 'px'; P.style.top = (cy - r.height / 2) + 'px'; P.style.right = 'auto'; P.style.bottom = 'auto'; }
        toques.set(e.pointerId, { tipo: 'palanca', cx, cy, R: r.width * 0.42 });
        P.classList.add('activa');
        this.moverPalanca(e.clientX, e.clientY, toques.get(e.pointerId));
      } else {
        toques.set(e.pointerId, { tipo: 'camara', x: e.clientX, y: e.clientY });
      }
    }, { passive: false });
    zona.addEventListener('pointermove', (e) => {
      if (this.editando) { this.moverArrastre(e); return; }
      const t = toques.get(e.pointerId); if (!t) return;
      if (t.tipo === 'palanca') this.moverPalanca(e.clientX, e.clientY, t);
      else if (t.tipo === 'camara') {
        const k = this.config.sensibilidad;
        this.dedosCam.dx += (e.clientX - t.x) * k; this.dedosCam.dy += (e.clientY - t.y) * k; t.x = e.clientX; t.y = e.clientY;
        /* dos dedos en la cámara: pellizco para acercar */
        const cams = [...toques.values()].filter((q) => q.tipo === 'camara');
        if (cams.length === 2) { const d = Math.hypot(cams[0].x - cams[1].x, cams[0].y - cams[1].y); if (this._d0) this.pinza *= this._d0 / Math.max(20, d); this._d0 = d; } else this._d0 = 0;
      }
    });
    const fin = (e) => {
      if (this.editando) { this.terminarArrastre(); return; }
      const t = toques.get(e.pointerId); if (!t) return;
      toques.delete(e.pointerId);
      if (t.tipo === 'palanca') { this.dedo.x = 0; this.dedo.z = 0; const P = this.el.palanca; P.classList.remove('activa'); P.querySelector('.palanca-bola').style.transform = ''; if (this.config.palanca === 'flotante') this.ubicarDedos(); }
      if (t.tipo === 'boton') { this.el[t.n].classList.remove('apretado'); if (t.n === 'salta') this.dedo.sostiene = false; }
      if (t.tipo === 'camara') this._d0 = 0;
    };
    zona.addEventListener('pointerup', fin); zona.addEventListener('pointercancel', fin);
    this.ubicarDedos();
  }
  moverPalanca(x, y, t) {
    let dx = x - t.cx, dy = y - t.cy; const d = Math.hypot(dx, dy);
    if (d > t.R) { dx *= t.R / d; dy *= t.R / d; }
    this.el.palanca.querySelector('.palanca-bola').style.transform = `translate(${dx}px, ${dy}px)`;
    const m = Math.min(1, d / t.R), a = Math.atan2(dy, dx);
    /* zona muerta chica y curva suave: caminar despacio es fácil */
    const k = m < 0.12 ? 0 : Math.pow((m - 0.12) / 0.88, 1.3);
    this.dedo.x = Math.cos(a) * k; this.dedo.z = Math.sin(a) * k;
    this.dedo.palancaFuerte = m > 0.92;
  }
  ubicarDedos() {
    if (!this.el) return;
    const C = this.config, base = Math.min(innerWidth, innerHeight);
    this.capa.style.setProperty('--op', C.opacidad);
    for (const [n, d] of Object.entries(this.el)) {
      const b = C.botones[n] || BOTONES[n];
      const tam = (n === 'palanca' ? 0.36 : 0.15) * base * b.tam;
      d.style.width = d.style.height = tam + 'px';
      /* la palanca va a la izquierda y los botones a la derecha; espejado para zurdos */
      const aIzq = BOTONES[n].izquierda ? !C.zurdo : C.zurdo;
      d.style.left = d.style.right = d.style.top = 'auto';
      d.style.bottom = `calc(${b.y}% - ${tam / 2}px)`;
      if (aIzq) d.style.left = `calc(${b.x}% - ${tam / 2}px)`; else d.style.right = `calc(${b.x}% - ${tam / 2}px)`;
    }
  }
  mostrarDedos(si) { this.capa.classList.toggle('visible', !!si && this.tactil); }
  /* ---- el editor: arrastrar para mover; el tamaño lo cambia la barrita de la interfaz */
  editar(si) { this.editando = si; this.capa.classList.toggle('editando', si); if (si) this.capa.classList.add('visible'); this.elegido = null; }
  empezarArrastre(e, b) {
    this.arr = { n: b.dataset.b, x0: e.clientX, y0: e.clientY, b: { ...this.config.botones[b.dataset.b] } };
    this.elegido = b.dataset.b;
    for (const d of Object.values(this.el)) d.classList.toggle('elegido', d === b);
    this.alElegir?.(this.elegido);
  }
  moverArrastre(e) {
    if (!this.arr) return;
    const n = this.arr.n, aIzq = BOTONES[n].izquierda ? !this.config.zurdo : this.config.zurdo;
    const dx = (e.clientX - this.arr.x0) / innerWidth * 100, dy = (e.clientY - this.arr.y0) / innerHeight * 100;
    const b = this.config.botones[n];
    b.x = Math.max(4, Math.min(96, this.arr.b.x + (aIzq ? dx : -dx)));
    b.y = Math.max(4, Math.min(92, this.arr.b.y - dy));
    this.ubicarDedos();
  }
  terminarArrastre() { this.arr = null; }

  /* ------------------------------------------------------------ el cuadro */
  leer() {
    const k = (n) => TECLAS[n].some((c) => this.abajo.has(c));
    const r = (n) => TECLAS[n].some((c) => this.recien.has(c));
    const E = { x: 0, z: 0, corre: false, salta: false, sostiene: false, accion: false, baja: false, dispara: false, camX: 0, camY: 0, zoom: 1, hot: 0, chat: false, pausa: false, foto: false };
    if (!this.bloqueado) {
      E.x = (k('der') ? 1 : 0) - (k('izq') ? 1 : 0);
      E.z = (k('atras') ? 1 : 0) - (k('adelante') ? 1 : 0);
      E.corre = k('corre'); E.salta = r('salta'); E.sostiene = k('salta'); E.accion = r('accion'); E.baja = k('baja'); E.dispara = r('dispara');
      for (let i = 1; i <= 5; i++) if (r('h' + i)) E.hot = i;
      E.chat = r('chat'); E.foto = r('camara');
      /* los dedos */
      if (Math.abs(this.dedo.x) + Math.abs(this.dedo.z) > 0) { E.x = this.dedo.x; E.z = this.dedo.z; }
      E.corre = E.corre || this.dedo.corre;
      E.salta = E.salta || this.dedo.salta; E.sostiene = E.sostiene || this.dedo.sostiene;
      E.accion = E.accion || this.dedo.accion; E.dispara = E.dispara || this.dedo.dispara; E.baja = E.baja || this.dedo.baja;
    }
    E.pausa = r('pausa');
    this.dedo.salta = false; this.dedo.accion = false; this.dedo.dispara = false;
    /* la cámara */
    E.camX = this.mouse.dx * 0.005 + this.dedosCam.dx * 0.008; E.camY = this.mouse.dy * 0.004 + this.dedosCam.dy * 0.006;
    this.mouse.dx = this.mouse.dy = 0; this.dedosCam.dx = this.dedosCam.dy = 0;
    E.zoom = Math.pow(1.12, this.mouse.rueda) * this.pinza; this.mouse.rueda = 0; this.pinza = 1;
    /* el mando */
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const ax = (i) => (Math.abs(p.axes[i] || 0) > 0.16 ? p.axes[i] : 0);
      const bt = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
      const antes = this._pad || [];
      const nuevo = (i) => bt(i) && !antes[i];
      if (ax(0) || ax(1)) { E.x = ax(0); E.z = ax(1); this.usaMando = true; }
      E.camX += ax(2) * 0.05; E.camY += ax(3) * 0.035;
      if (!this.bloqueado) {
        E.salta = E.salta || nuevo(0); E.sostiene = E.sostiene || bt(0); E.accion = E.accion || nuevo(2) || nuevo(1);
        E.corre = E.corre || bt(10) || bt(5) || (p.buttons[7]?.value > 0.4); E.baja = E.baja || bt(6) || bt(4); E.dispara = E.dispara || nuevo(3);
        if (nuevo(14)) E.hot = -1; if (nuevo(15)) E.hot = -2;
      }
      E.pausa = E.pausa || nuevo(9);
      this._pad = p.buttons.map((b) => b.pressed);
      break;
    }
    this.recien.clear();
    return E;
  }
}

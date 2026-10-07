/* ============================================================================
   Los mandos: dedos (palanca flotante o fija y el botón de la copla), mouse
   y teclado. Todo se guarda a gusto del jugador: tamaño, transparencia, zurdo,
   vibración y dónde va cada cosa.
   ========================================================================== */

const CTRL_BASE = { tipo: 'flotante', tamPal: 1, tamBtn: 1, opac: 0.6, zurdo: false, vibrar: true, palX: 0.26, palY: 0.84, btnX: 0.84, btnY: 0.86 };
const CTRL = Object.assign({}, CTRL_BASE, Guardado.leer('controles', {}));
const guardarCtrl = () => Guardado.escribir('controles', CTRL);
const radioPal = () => Math.round(22 * CTRL.tamPal);
const radioBtn = () => Math.round(14 * CTRL.tamBtn);
function posPalanca() { return { x: (CTRL.zurdo ? 1 - CTRL.palX : CTRL.palX) * W, y: CTRL.palY * H }; }
function posBoton() { return { x: (CTRL.zurdo ? 1 - CTRL.btnX : CTRL.btnX) * W, y: CTRL.btnY * H }; }
function vibrar(ms) { if (CTRL.vibrar && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* */ } }

const Entrada = {
  lienzo: null,
  punteros: new Map(),
  clic: null, toque: null,
  teclas: new Set(), recien: new Set(),
  pal: { activa: false, id: null, bx: 0, by: 0, x: 0, y: 0, dx: 0, dy: 0, mag: 0 },
  modoJuego: false, alTocarJuego: null, usoTeclado: false,

  iniciar(lienzo) {
    this.lienzo = lienzo;
    const op = { passive: false };
    lienzo.addEventListener('pointerdown', (e) => { e.preventDefault(); try { lienzo.setPointerCapture(e.pointerId); } catch (x) { /* */ } this.abajo(e); }, op);
    lienzo.addEventListener('pointermove', (e) => { e.preventDefault(); this.mueve(e); }, op);
    const fin = (e) => { e.preventDefault(); this.arriba(e); };
    lienzo.addEventListener('pointerup', fin, op);
    lienzo.addEventListener('pointercancel', fin, op);
    lienzo.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.teclas.has(e.code)) this.recien.add(e.code);
      this.teclas.add(e.code); this.usoTeclado = true; Sonido.iniciar();
    });
    addEventListener('keyup', (e) => this.teclas.delete(e.code));
    addEventListener('blur', () => { this.teclas.clear(); this.soltarPalanca(); });
  },
  aLogico(e) {
    const r = this.lienzo.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  },
  abajo(e) {
    Sonido.iniciar();
    const p = this.aLogico(e);
    const pt = { x: p.x, y: p.y, x0: p.x, y0: p.y, rol: null };
    this.punteros.set(e.pointerId, pt);
    this.toque = { x: p.x, y: p.y };
    if (e.pointerType !== 'mouse') this.usoTeclado = false;
    if (!this.modoJuego) return;
    if (this.alTocarJuego && this.alTocarJuego(p)) { pt.rol = 'boton'; return; }
    if (this.pal.activa || p.y < SY) return;
    if (CTRL.tipo === 'fija') {
      const b = posPalanca();
      if (Math.hypot(p.x - b.x, p.y - b.y) > radioPal() * 2.4) return;
      this.pal.bx = b.x; this.pal.by = b.y;
    } else { this.pal.bx = p.x; this.pal.by = p.y; }
    this.pal.activa = true; this.pal.id = e.pointerId; pt.rol = 'palanca';
    this.moverPal(p);
  },
  mueve(e) {
    const pt = this.punteros.get(e.pointerId);
    if (!pt) return;
    const p = this.aLogico(e); pt.x = p.x; pt.y = p.y;
    if (pt.rol === 'palanca') this.moverPal(p);
  },
  arriba(e) {
    const pt = this.punteros.get(e.pointerId);
    if (!pt) return;
    this.punteros.delete(e.pointerId);
    if (pt.rol === 'palanca') this.soltarPalanca();
    else if (pt.rol !== 'boton') this.clic = { x: pt.x, y: pt.y, x0: pt.x0, y0: pt.y0 };
  },
  moverPal(p) {
    const P = this.pal, r = radioPal();
    let dx = p.x - P.bx, dy = p.y - P.by, d = Math.hypot(dx, dy);
    if (d > r) {
      if (CTRL.tipo === 'flotante') { P.bx += dx / d * (d - r); P.by += dy / d * (d - r); }
      dx = dx / d * r; dy = dy / d * r; d = r;
    }
    P.x = P.bx + dx; P.y = P.by + dy;
    const m = d / r;
    if (m < 0.15) { P.mag = 0; return; }
    P.dx = dx / d; P.dy = dy / d; P.mag = Math.min(1, (m - 0.15) / 0.6);
  },
  soltarPalanca() { this.pal.activa = false; this.pal.id = null; this.pal.mag = 0; },
  /* hacia dónde quiere ir: palanca o teclas */
  vector() {
    const t = this.teclas;
    let x = (t.has('KeyD') || t.has('ArrowRight') ? 1 : 0) - (t.has('KeyA') || t.has('ArrowLeft') ? 1 : 0);
    let y = (t.has('KeyS') || t.has('ArrowDown') ? 1 : 0) - (t.has('KeyW') || t.has('ArrowUp') ? 1 : 0);
    if (x || y) { const d = Math.hypot(x, y); return { x: x / d, y: y / d, mag: 1 }; }
    if (this.pal.activa && this.pal.mag > 0) return { x: this.pal.dx, y: this.pal.dy, mag: this.pal.mag };
    return { x: 0, y: 0, mag: 0 };
  },
  apretada(...codigos) { return codigos.some((c) => this.recien.has(c)); },
  finCuadro() { this.clic = null; this.toque = null; this.recien.clear(); },
  /* para los botones del menú: ¿hay un dedo apretando adentro? */
  apretando(x, y, w, h) {
    for (const p of this.punteros.values()) if (p.rol === null && p.x >= x && p.x < x + w && p.y >= y && p.y < y + h && p.x0 >= x && p.x0 < x + w && p.y0 >= y && p.y0 < y + h) return true;
    return false;
  },
  clicEn(x, y, w, h) {
    const c = this.clic;
    return !!c && c.x >= x && c.x < x + w && c.y >= y && c.y < y + h && c.x0 >= x - 4 && c.x0 < x + w + 4 && c.y0 >= y - 4 && c.y0 < y + h + 4;
  },
};

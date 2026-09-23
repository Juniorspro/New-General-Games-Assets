/* ============================================================================
   ruta40/js/controles.js — acelerar y frenar: teclado, joystick y dedos.

   Con los dedos hay dos modos: los pedales (dos imágenes que se pueden mover,
   agrandar, hacer transparentes y cambiar de lado) o las mitades de la
   pantalla (izquierda frena, derecha acelera). Todo se guarda en la partida.
   Los pedales son elementos del DOM y no del lienzo: así el navegador se
   encarga de los toques aunque #app esté girado 90°.
   ========================================================================== */
import { Pantalla } from './pantalla.js';
import { url } from './arte.js';

const TECLAS_GAS = new Set(['ArrowRight', 'KeyD', 'KeyW', 'ArrowUp']);
const TECLAS_FRENO = new Set(['ArrowLeft', 'KeyA', 'KeyS', 'ArrowDown']);

export const Controles = {
  cfg: null, teclas: { gas: false, freno: false }, dedos: { gas: new Set(), freno: new Set() }, mitad: new Map(),
  editando: false, alCambiar: null, activo: false,
  iniciar(cfg) {
    this.cfg = cfg;
    const cont = this.cont = document.getElementById('pedales');
    cont.innerHTML = '';
    this.el = {};
    for (const n of ['freno', 'gas']) {
      const d = document.createElement('div');
      d.className = 'pedal pedal-' + n;
      const im = document.createElement('img');
      im.src = url(n === 'gas' ? 'pedalGas' : 'pedalFreno'); im.alt = ''; im.draggable = false;
      const et = document.createElement('span'); et.className = 'etiqueta'; et.dataset.t = n === 'gas' ? 'c_gas' : 'c_freno';
      d.append(im, et);
      cont.append(d);
      this.el[n] = d;
      d.addEventListener('pointerdown', (e) => this.bajar(n, e));
      d.addEventListener('pointerup', (e) => this.subir(n, e));
      d.addEventListener('pointercancel', (e) => this.subir(n, e));
      d.addEventListener('lostpointercapture', (e) => this.subir(n, e));
      d.addEventListener('pointermove', (e) => this.mover(n, e));
    }
    /* las mitades: una capa que agarra toda la pantalla */
    const m = this.capa = document.createElement('div'); m.className = 'mitades';
    cont.prepend(m);
    const lado = (e) => { const q = Pantalla.aCaja(e.clientX, e.clientY), izq = q.x < Pantalla.W / 2; return (izq !== (this.cfg.lado === 'cambiado')) ? 'freno' : 'gas'; };
    m.addEventListener('pointerdown', (e) => { e.preventDefault(); try { m.setPointerCapture(e.pointerId); } catch (_) {} const n = lado(e); this.mitad.set(e.pointerId, n); this.vibrar(8); this.pintar(); });
    m.addEventListener('pointermove', (e) => { if (this.mitad.has(e.pointerId)) { this.mitad.set(e.pointerId, lado(e)); this.pintar(); } });
    const fuera = (e) => { this.mitad.delete(e.pointerId); this.pintar(); };
    m.addEventListener('pointerup', fuera); m.addEventListener('pointercancel', fuera);
    addEventListener('keydown', (e) => { if (TECLAS_GAS.has(e.code)) this.teclas.gas = true; if (TECLAS_FRENO.has(e.code)) this.teclas.freno = true; });
    addEventListener('keyup', (e) => { if (TECLAS_GAS.has(e.code)) this.teclas.gas = false; if (TECLAS_FRENO.has(e.code)) this.teclas.freno = false; });
    addEventListener('blur', () => { this.teclas.gas = this.teclas.freno = false; this.soltarTodo(); });
    Pantalla.alCambiar.push(() => this.aplicar());
    this.aplicar();
  },
  soltarTodo() { this.dedos.gas.clear(); this.dedos.freno.clear(); this.mitad.clear(); this.pintar(); },
  /* ------------------------------------------------ poner cada pedal donde dice la partida */
  aplicar() {
    const c = this.cfg; if (!c || !this.el) return;
    const H = Pantalla.H, W = Pantalla.W;
    const alto = Math.max(90, Math.min(H * 0.36, 260)) * c.tam;
    for (const n of ['freno', 'gas']) {
      const d = this.el[n], p = c.pos[n];
      const ancho = alto * (n === 'gas' ? 216 : 343) / 300;
      d.style.width = ancho + 'px'; d.style.height = alto + 'px';
      d.style.left = (p.x * W - ancho / 2) + 'px'; d.style.top = (p.y * H - alto / 2) + 'px';
      d.style.opacity = c.alfa;
    }
    this.cont.classList.toggle('modo-mitades', c.modo === 'mitades' && !this.editando);
  },
  mostrar(si) { this.activo = si; this.cont.classList.toggle('visible', si); if (!si) this.soltarTodo(); },
  /* ------------------------------------------------ apretar y soltar (o arrastrar en el editor) */
  bajar(n, e) {
    e.preventDefault();
    try { this.el[n].setPointerCapture(e.pointerId); } catch (_) {}
    if (this.editando) {
      const q = Pantalla.aCaja(e.clientX, e.clientY), p = this.cfg.pos[n];
      this.arrastre = { n, id: e.pointerId, dx: q.x - p.x * Pantalla.W, dy: q.y - p.y * Pantalla.H };
      this.el[n].classList.add('agarrado');
      return;
    }
    this.dedos[n].add(e.pointerId); this.vibrar(10); this.pintar();
  },
  subir(n, e) {
    if (this.arrastre && this.arrastre.id === e.pointerId) { this.el[this.arrastre.n].classList.remove('agarrado'); this.arrastre = null; if (this.alCambiar) this.alCambiar(); return; }
    this.dedos[n].delete(e.pointerId); this.pintar();
  },
  mover(n, e) {
    const a = this.arrastre; if (!a || a.id !== e.pointerId) return;
    const q = Pantalla.aCaja(e.clientX, e.clientY);
    this.cfg.pos[a.n] = { x: Math.max(0.04, Math.min(0.96, (q.x - a.dx) / Pantalla.W)), y: Math.max(0.1, Math.min(0.94, (q.y - a.dy) / Pantalla.H)) };
    this.aplicar();
  },
  pintar() {
    if (!this.el) return;
    const g = this.dedos.gas.size > 0 || [...this.mitad.values()].includes('gas');
    const f = this.dedos.freno.size > 0 || [...this.mitad.values()].includes('freno');
    this.el.gas.classList.toggle('apretado', g); this.el.freno.classList.toggle('apretado', f);
  },
  vibrar(ms) { if (this.cfg && this.cfg.vibrar && navigator.vibrate) try { navigator.vibrate(ms); } catch (_) {} },
  /* ------------------------------------------------ lo que se lee por cuadro */
  leer() {
    let gas = this.teclas.gas || this.dedos.gas.size > 0 ? 1 : 0, freno = this.teclas.freno || this.dedos.freno.size > 0 ? 1 : 0;
    for (const v of this.mitad.values()) { if (v === 'gas') gas = 1; else freno = 1; }
    /* el joystick: gatillos, A/B o la palanca */
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const b = (i) => (p.buttons[i] ? p.buttons[i].value || (p.buttons[i].pressed ? 1 : 0) : 0);
      gas = Math.max(gas, b(7), b(0), p.axes[0] > 0.4 ? 1 : 0, b(15));
      freno = Math.max(freno, b(6), b(1), p.axes[0] < -0.4 ? 1 : 0, b(14));
      if (b(9) && !this.pausaPad) { this.pausaPad = true; if (this.alPausa) this.alPausa(); }
      if (!b(9)) this.pausaPad = false;
    }
    return { gas, freno };
  },
  /* ------------------------------------------------ el editor */
  editar(si, alCambiar) { this.editando = si; this.alCambiar = alCambiar; this.cont.classList.toggle('editando', si); this.aplicar(); },
  cambiarLado() { const p = this.cfg.pos; [p.freno, p.gas] = [{ ...p.gas }, { ...p.freno }]; this.cfg.lado = this.cfg.lado === 'cambiado' ? 'normal' : 'cambiado'; this.aplicar(); },
};

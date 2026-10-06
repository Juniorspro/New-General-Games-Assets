/* Controles con el dedo: arrastrar = mirar (ejes MouseX/MouseY de UE), tocar = clic (si el juego muestra cursor),
   y botones para las teclas que el nivel usa. Los botones se pueden mover y agrandar; se guardan por tecla. */
import { nombreTecla, t } from './textos.js';

// Niveles con teclas de prueba del autor (X, F, Supr…): solo se muestran estas
const SOLO = { SM_Bedroom: ['SpaceBar', 'LeftMouseButton', 'Escape'] };
// Pantallas con texto abajo: el botón de seguir va al medio
const POS_NIVEL = { SM_Bedroom_Controls: { X: [0.5, 0.45] }, SM_Bedroom_DeathTips: { X: [0.5, 0.45] } };

export class Controles {
  constructor(raiz, M, ajustes, guardar) {
    this.raiz = raiz; this.M = M; this.aj = ajustes; this.guardar = guardar; this.botones = new Map(); this.editando = false;
    this.capa = document.createElement('div'); this.capa.id = 'toque'; raiz.appendChild(this.capa);
    this.barra = document.createElement('div'); this.barra.id = 'botones'; raiz.appendChild(this.barra);
    this.dedos = new Map();
    const c = this.capa;
    c.addEventListener('pointerdown', (e) => this.abajo(e));
    c.addEventListener('pointermove', (e) => this.mover(e));
    c.addEventListener('pointerup', (e) => this.arriba(e));
    c.addEventListener('pointercancel', (e) => this.arriba(e));
    addEventListener('keydown', (e) => { const k = this.teclaDe(e); if (k && !e.repeat) { this.M.audio?.iniciar(); this.M.tecla(k, true); } });
    addEventListener('keyup', (e) => { const k = this.teclaDe(e); if (k) this.M.tecla(k, false); });
    setInterval(() => this.actualizarBotones(), 400);
  }
  teclaDe(e) { return { ' ': 'SpaceBar', Escape: 'Escape', Backspace: 'BackSpace', Enter: 'Enter', Shift: 'LeftShift', Control: 'LeftControl', Tab: 'Tab' }[e.key] || (e.key.length === 1 ? e.key.toUpperCase() : null); }
  abajo(e) {
    this.M.audio?.iniciar();
    this.capa.setPointerCapture?.(e.pointerId);
    this.dedos.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), movido: 0 });
    this.M.mouse = { x: e.clientX, y: e.clientY };
  }
  mover(e) {
    const d = this.dedos.get(e.pointerId); if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; d.movido += Math.abs(dx) + Math.abs(dy);
    this.M.mouse = { x: e.clientX, y: e.clientY };
    if (this.cursor()) return;
    const k = 0.07 * (this.aj.sens ?? 1) * 1.6 * (800 / Math.max(400, innerWidth));
    this.M.ejes.MouseX = (this.M.ejes.MouseX || 0) + dx * k;
    this.M.ejes.MouseY = (this.M.ejes.MouseY || 0) - dy * k;
  }
  arriba(e) {
    const d = this.dedos.get(e.pointerId); this.dedos.delete(e.pointerId); if (!d) return;
    if (d.movido < 12 && performance.now() - d.t0 < 400 && this.cursor()) {
      const r = this.raiz.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = -((e.clientY - r.top) / r.height) * 2 + 1;
      this.M.tecla('LeftMouseButton', true); this.M.clicEnPantalla(nx, ny); setTimeout(() => this.M.tecla('LeftMouseButton', false), 60);
    }
  }
  cursor() { return !!this.M.pc?.cursor || this.M.modoEntrada === 'ui'; }
  /* Botones: las teclas que escuchan el guion del nivel, el peón y los actores con entrada */
  actualizarBotones() {
    if (!this.M.nivel || this.editando) return;
    const usadas = this.M.teclasUsadas();
    usadas.delete(undefined); usadas.delete('AnyKey');
    if (this.cursor()) usadas.delete('LeftMouseButton');
    for (const k of ['MouseX', 'MouseY', 'W', 'A', 'S', 'D']) usadas.delete(k);
    const nivel = this.M.nombreNivel, solo = SOLO[nivel];
    if (solo) for (const k of [...usadas]) if (!solo.includes(k)) usadas.delete(k);
    const clave = [...usadas].sort().join(',') + '|' + nivel + '|' + (this.aj.idioma || '');
    if (clave === this.clave) return; this.clave = clave;
    for (const [k, b] of this.botones) if (!usadas.has(k)) { b.remove(); this.botones.delete(k); }
    let i = 0;
    for (const k of usadas) {
      let b = this.botones.get(k);
      if (!b) { b = this.crearBoton(k, i); this.botones.set(k, b); }
      b.querySelector('span').textContent = nombreTecla(k, nivel);
      this.colocar(b, k, i++);
    }
  }
  crearBoton(k) {
    const b = document.createElement('button'); b.className = 'boton'; b.dataset.k = k; b.innerHTML = '<span></span>';
    const apretar = (on) => { if (this.editando) return; b.classList.toggle('apretado', on); this.M.audio?.iniciar(); this.M.tecla(k, on); };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (this.editando) return this.empezarArrastre(e, b, k); b.setPointerCapture?.(e.pointerId); apretar(true); });
    b.addEventListener('pointerup', (e) => { e.stopPropagation(); if (!this.editando) apretar(false); });
    b.addEventListener('pointercancel', () => apretar(false));
    this.barra.appendChild(b);
    return b;
  }
  posDefecto(k, i) {
    const fijas = { Escape: [0.94, 0.08], LeftMouseButton: [0.88, 0.72], SpaceBar: [0.75, 0.84], F: [0.88, 0.48], X: [0.62, 0.84], BackSpace: [0.06, 0.26] };
    return POS_NIVEL[this.M.nombreNivel]?.[k] || fijas[k] || [0.88 - (i % 3) * 0.12, 0.3 - Math.floor(i / 3) * 0.12 + 0.24];
  }
  colocar(b, k, i) {
    const p = this.aj.botones?.[k] || this.posDefecto(k, i);
    const tam = (this.aj.tamBotones ?? 1) * (p[2] ?? 1) * Math.min(innerWidth, innerHeight) * 0.13;
    b.style.left = `calc(${p[0] * 100}% - ${tam / 2}px)`; b.style.top = `calc(${p[1] * 100}% - ${tam / 2}px)`;
    b.style.width = b.style.height = tam + 'px'; b.style.fontSize = Math.max(10, tam * 0.2) + 'px';
  }
  empezarArrastre(e, b, k) {
    const r = this.raiz.getBoundingClientRect();
    const mover = (ev) => { const x = Math.min(0.98, Math.max(0.02, (ev.clientX - r.left) / r.width)), y = Math.min(0.98, Math.max(0.02, (ev.clientY - r.top) / r.height)); this.aj.botones = { ...(this.aj.botones || {}), [k]: [x, y, this.aj.botones?.[k]?.[2] ?? 1] }; this.colocar(b, k, 0); };
    const fin = () => { removeEventListener('pointermove', mover); removeEventListener('pointerup', fin); this.guardar(); };
    addEventListener('pointermove', mover); addEventListener('pointerup', fin);
  }
  editar(on) {
    this.editando = on; this.raiz.classList.toggle('editando', on);
    if (!on) { this.clave = null; this.actualizarBotones(); this.guardar(); }
  }
  restablecer() { this.aj.botones = {}; this.clave = null; this.guardar(); this.actualizarBotones(); }
  relayout() { let i = 0; for (const [k, b] of this.botones) this.colocar(b, k, i++); }
}
void t;

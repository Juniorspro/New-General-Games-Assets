/* ============================================================================
   motor2d/ui.js — capas de menú en el DOM, con los textos en pixel art y
   navegables con teclado y mando además del dedo. Un menú que solo se toca
   con el mouse es un menú que en la compu no se puede jugar con el mando.
   ========================================================================== */

const UI = {
  actual: null,
  sel: 0,
  pila: [],
  alPixelar: null,          // el juego decide cómo pintar cada capa
  alSonar: null,            // blip al moverse y al elegir
  opciones: new Map(),      // botón → { izq, der, texto }

  capa(id) { return document.getElementById(id); },
  mostrar(id, o) {
    o = o || {};
    if (this.actual && o.apilar) this.pila.push(this.actual);
    else if (!o.apilar) this.pila.length = 0;
    document.querySelectorAll('.capa.ver').forEach((c) => c.classList.remove('ver'));
    const c = this.capa(id);
    if (!c) return;
    c.classList.add('ver');
    this.actual = id;
    this.sel = o.sel || 0;
    for (const [b, op] of this.opciones) if (c.contains(b)) this.pintarOpcion(b, op);
    if (this.alPixelar) this.alPixelar(c);
    this.marcar();
  },
  volver() {
    const prev = this.pila.pop();
    if (prev) this.mostrar(prev, { apilar: false, conservarPila: true });
    return !!prev;
  },
  ocultar() {
    document.querySelectorAll('.capa.ver').forEach((c) => c.classList.remove('ver'));
    this.actual = null; this.pila.length = 0;
  },
  botones() {
    if (!this.actual) return [];
    return [...this.capa(this.actual).querySelectorAll('.boton:not([data-no]):not(.oculto)')];
  },
  marcar() {
    const bs = this.botones();
    if (!bs.length) return;
    this.sel = (this.sel + bs.length) % bs.length;
    bs.forEach((b, i) => b.classList.toggle('sel', i === this.sel && Entrada.fuente !== 'toque'));
    const b = bs[this.sel];
    if (b && Entrada.fuente !== 'toque' && b.scrollIntoView) b.scrollIntoView({ block: 'nearest' });
  },
  /* se llama en cada paso mientras hay un menú a la vista */
  navegar() {
    if (!this.actual) return;
    const E = Entrada.EDGE, bs = this.botones();
    if (!bs.length) return;
    if (E.arr) { this.sel--; this.marcar(); this.sonar('mover'); }
    if (E.aba) { this.sel++; this.marcar(); this.sonar('mover'); }
    const b = bs[lim(this.sel, 0, bs.length - 1)];
    const op = this.opciones.get(b);
    if (op && (E.izq || E.der)) { (E.izq ? op.izq : op.der)(); this.pintarOpcion(b, op); this.sonar('mover'); }
    if (E.aceptar || E.salto) { this.sonar('elegir'); b.click(); }
    if (E.volver) {
      const v = this.capa(this.actual).dataset.volver;
      if (v) { const vb = document.getElementById(v); if (vb) { this.sonar('elegir'); vb.click(); } }
    }
  },
  sonar(q) { if (this.alSonar) this.alSonar(q); },

  /* un botón que cambia un valor: tocarlo avanza, izquierda/derecha lo mueven */
  opcion(b, op) {
    this.opciones.set(b, op);
    b.addEventListener('click', () => { (op.tocar || op.der)(); this.pintarOpcion(b, op); });
    this.pintarOpcion(b, op);
  },
  pintarOpcion(b, op) {
    b.textContent = op.texto();
    delete b.dataset.pxk;
    if (this.alPixelar) this.alPixelar(b.closest('.capa') || b);
  },

  /* conectar botones: { idBoton: función } */
  conectar(mapa) {
    for (const id in mapa) {
      const b = document.getElementById(id);
      if (!b) continue;
      b.addEventListener('click', (e) => { e.preventDefault(); mapa[id](); });
      b.addEventListener('pointerenter', () => {
        if (Entrada.fuente === 'toque') return;
        const i = this.botones().indexOf(b);
        if (i >= 0 && i !== this.sel) { this.sel = i; this.marcar(); }
      });
    }
  },
};

/* barra de 10 cuadritos para los volúmenes: ▮▮▮▮▯▯ */
function barrita(v, n) {
  n = n || 10;
  const k = Math.round(lim(v, 0, 1) * n);
  return '='.repeat(k) + '-'.repeat(n - k);
}

/* kuntur/js/entrada.js — teclado, dedos y mando, todo junto en un solo estado.
   IN dice qué está apretado; EDGE, qué se apretó en este paso de juego (se
   borra al final de cada paso, así un toque cortito no se pierde). Cada dedo
   se sigue por su pointerId. */

const ACCIONES = ['izq', 'der', 'arr', 'aba', 'salto', 'accion', 'pausa', 'aceptar', 'volver'];
export const Entrada = {
  IN: {}, EDGE: {}, fuentes: new Map(), fuente: 'teclado', alUsar: null,
  pad: null, padAntes: {}, palancaXY: { x: 0, y: 0 },

  pulsar(a, id) {
    let s = this.fuentes.get(a);
    if (!s) this.fuentes.set(a, (s = new Set()));
    if (!s.size) { this.IN[a] = true; this.EDGE[a] = true; }
    s.add(id);
  },
  soltar(a, id) {
    const s = this.fuentes.get(a);
    if (!s) return;
    s.delete(id);
    if (!s.size) this.IN[a] = false;
  },
  soltarTodo() { for (const [a, s] of this.fuentes) { s.clear(); this.IN[a] = false; } },
  fin() { for (const a of ACCIONES) this.EDGE[a] = false; },
  usar(f) { if (this.fuente !== f) { this.fuente = f; if (this.alUsar) this.alUsar(f); } },

  /* lo que la física necesita */
  leer() {
    const I = this.IN, E = this.EDGE;
    return {
      x: (I.der ? 1 : 0) - (I.izq ? 1 : 0), y: (I.arr ? 1 : 0) - (I.aba ? 1 : 0),
      salto: !!I.salto, saltoE: !!E.salto, accion: !!I.accion, accionE: !!E.accion,
    };
  },

  teclado(mapa) {
    addEventListener('keydown', (e) => {
      const a = mapa[e.code];
      if (!a) return;
      e.preventDefault();
      if (e.repeat) return;
      this.usar('teclado');
      for (const x of [].concat(a)) this.pulsar(x, 'k' + e.code);
    });
    addEventListener('keyup', (e) => { const a = mapa[e.code]; if (a) for (const x of [].concat(a)) this.soltar(x, 'k' + e.code); });
    addEventListener('blur', () => this.soltarTodo());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.soltarTodo(); });
  },

  /* un botón de la pantalla */
  boton(el, accion) {
    const dedos = new Set();
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      dedos.add(e.pointerId); this.usar('toque');
      this.pulsar(accion, 'p' + e.pointerId); el.classList.add('on');
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    });
    const subir = (e) => { if (!dedos.delete(e.pointerId)) return; this.soltar(accion, 'p' + e.pointerId); if (!dedos.size) el.classList.remove('on'); };
    el.addEventListener('pointerup', subir); el.addEventListener('pointercancel', subir); el.addEventListener('lostpointercapture', subir);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  /* la palanca: aparece donde apoya el pulgar y lo sigue si se va lejos */
  palanca(zona, aro, bola, radio) {
    radio = radio || 40;
    let id = null, ox = 0, oy = 0;
    const dirs = { izq: false, der: false, arr: false, aba: false };
    const poner = (q) => { for (const a in dirs) { if (q[a] && !dirs[a]) { dirs[a] = true; this.pulsar(a, 'pal'); } else if (!q[a] && dirs[a]) { dirs[a] = false; this.soltar(a, 'pal'); } } };
    const mover = (e) => {
      const r = zona.getBoundingClientRect();
      let dx = e.clientX - r.left - ox, dy = e.clientY - r.top - oy;
      const d = Math.hypot(dx, dy);
      if (d > radio * 1.4) { const k = (d - radio * 1.4) / d; ox += dx * k; oy += dy * k; dx -= dx * k; dy -= dy * k; }
      const nx = dx / radio, ny = dy / radio;
      this.palancaXY = { x: Math.max(-1, Math.min(1, nx)), y: Math.max(-1, Math.min(1, ny)) };
      /* los costados mandan; arriba y abajo piden más recorrido para no agacharse sin querer */
      poner({ izq: nx < -0.28, der: nx > 0.28, arr: ny < -0.62, aba: ny > 0.62 });
      aro.style.transform = `translate(${ox - radio}px,${oy - radio}px)`;
      const k = Math.min(1, radio / Math.max(1, Math.hypot(dx, dy)));
      bola.style.transform = `translate(${ox + dx * k - 20}px,${oy + dy * k - 20}px)`;
    };
    zona.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (id !== null) return;
      id = e.pointerId; this.usar('toque');
      const r = zona.getBoundingClientRect();
      ox = e.clientX - r.left; oy = e.clientY - r.top;
      zona.classList.add('on');
      try { zona.setPointerCapture(id); } catch (_) {}
      mover(e);
    });
    zona.addEventListener('pointermove', (e) => { if (e.pointerId === id) mover(e); });
    const fin = (e) => { if (e.pointerId !== id) return; id = null; zona.classList.remove('on'); poner({}); this.palancaXY = { x: 0, y: 0 }; };
    zona.addEventListener('pointerup', fin); zona.addEventListener('pointercancel', fin); zona.addEventListener('lostpointercapture', fin);
  },

  /* el mando: se lee una vez por cuadro dibujado */
  mando(mapa) { this.mapaPad = mapa; },
  leerMando() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const g = pads && [...pads].find((p) => p && p.connected);
    if (!g || !this.mapaPad) return;
    const ahora = {};
    for (const [i, a] of Object.entries(this.mapaPad)) if (g.buttons[i] && g.buttons[i].pressed) ahora[a] = true;
    const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
    if (ax < -0.45) ahora.izq = true; if (ax > 0.45) ahora.der = true;
    if (ay < -0.6) ahora.arr = true; if (ay > 0.6) ahora.aba = true;
    for (const a of ACCIONES) {
      if (ahora[a] && !this.padAntes[a]) { this.usar('mando'); this.pulsar(a, 'pad'); }
      else if (!ahora[a] && this.padAntes[a]) this.soltar(a, 'pad');
    }
    this.padAntes = ahora;
  },
};

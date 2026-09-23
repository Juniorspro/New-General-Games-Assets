/* brillo/js/entrada.js — teclado, dedos y mando, todo junto en un solo estado.
   IN dice qué está apretado; EDGE, qué se apretó en este paso de juego (se
   borra al final de cada paso, así un toque cortito no se pierde). Cada dedo
   se sigue por su pointerId. En el teléfono se arranca con los dedos, y
   cualquier toque en la pantalla pasa a dedos (una tecla, a teclado). */

const ACCIONES = ['izq', 'der', 'arr', 'aba', 'salto', 'accion', 'pausa', 'aceptar', 'volver'];
/* la perilla del joystick, en radios de la base */
export const PERILLA = 0.5;
export const Entrada = {
  IN: {}, EDGE: {}, fuentes: new Map(), fuente: 'teclado', alUsar: null,
  padAntes: {}, aCaja: null, caja: null,
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
  /* lo que la física necesita (y = 1 arriba) */
  leer() {
    const I = this.IN, E = this.EDGE;
    return { x: (I.der ? 1 : 0) - (I.izq ? 1 : 0), y: (I.arr ? 1 : 0) - (I.aba ? 1 : 0), salto: !!I.salto, saltoE: !!E.salto, accion: !!I.accion, accionE: !!E.accion };
  },
  iniciar(tactil) {
    if (tactil) this.fuente = 'toque';
    addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') this.usar('toque'); }, true);
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
  /* un toquecito en la mano, si el teléfono sabe y el jugador quiere */
  vibrar: false,
  zumbar(ms) { if (this.vibrar && navigator.vibrate) try { navigator.vibrate(ms); } catch (_) {} },
  /* un botón de la pantalla */
  boton(el, accion) {
    const dedos = new Set();
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!dedos.size) this.zumbar(10);
      dedos.add(e.pointerId); this.usar('toque');
      this.pulsar(accion, 'p' + e.pointerId); el.classList.add('on');
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    });
    const subir = (e) => { if (!dedos.delete(e.pointerId)) return; this.soltar(accion, 'p' + e.pointerId); if (!dedos.size) el.classList.remove('on'); };
    el.addEventListener('pointerup', subir); el.addEventListener('pointercancel', subir); el.addEventListener('lostpointercapture', subir);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  },
  /* el joystick. cfg se lee en cada toque: { radio, modo, cx, cy } (centro de reposo en la zona).
     flotante: aparece donde apoya el dedo; fija: el centro no se mueve; cruz: flechas quietas */
  palanca(zona, aro, bola, cfg) {
    let id = null, ox = 0, oy = 0;
    const dirs = { izq: false, der: false, arr: false, aba: false };
    /* si algo soltó todo con el dedo apoyado, al moverlo vuelve a contar */
    const poner = (q) => {
      let nuevo = false;
      for (const a in dirs) {
        if (q[a] && (!dirs[a] || !this.IN[a])) { nuevo = nuevo || !dirs[a]; dirs[a] = true; this.pulsar(a, 'pal'); } else if (!q[a] && dirs[a]) { dirs[a] = false; this.soltar(a, 'pal'); }
        zona.classList.toggle('p-' + a, dirs[a]);
      }
      if (nuevo && cfg.modo === 'cruz') this.zumbar(8);
    };
    const reposo = () => {
      const r = cfg.radio, b = r * PERILLA;
      aro.style.transform = `translate(${cfg.cx - r}px,${cfg.cy - r}px)`;
      bola.style.transform = `translate(${cfg.cx - b}px,${cfg.cy - b}px)`;
    };
    reposo();
    const punto = (e) => { const q = this.aCaja ? this.aCaja(e.clientX, e.clientY) : { x: e.clientX, y: e.clientY }; const r = this.caja ? this.caja(zona) : zona.getBoundingClientRect(); return { x: q.x - r.left, y: q.y - r.top }; };
    const mover = (e) => {
      const q = punto(e), radio = cfg.radio;
      let dx = q.x - ox, dy = q.y - oy;
      const d = Math.hypot(dx, dy);
      if (cfg.modo === 'flotante' && d > radio * 1.4) { const k = (d - radio * 1.4) / d; ox += dx * k; oy += dy * k; dx -= dx * k; dy -= dy * k; }
      const nx = dx / radio, ny = dy / radio;
      const v = cfg.modo === 'cruz' ? 0.45 : 0.62;
      poner({ izq: nx < -0.28, der: nx > 0.28, arr: ny < -v, aba: ny > v });
      aro.style.transform = `translate(${ox - radio}px,${oy - radio}px)`;
      const k = Math.min(1, radio / Math.max(1, Math.hypot(dx, dy))), b = radio * PERILLA;
      bola.style.transform = `translate(${ox + dx * k - b}px,${oy + dy * k - b}px)`;
    };
    zona.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (id !== null) return;
      id = e.pointerId; this.usar('toque');
      const q = punto(e);
      if (cfg.modo === 'flotante') { ox = q.x; oy = q.y; } else { ox = cfg.cx; oy = cfg.cy; }
      zona.classList.add('on');
      try { zona.setPointerCapture(id); } catch (_) {}
      mover(e);
    });
    zona.addEventListener('pointermove', (e) => { if (e.pointerId === id) mover(e); });
    const fin = (e) => { if (e.pointerId !== id) return; id = null; zona.classList.remove('on'); poner({}); reposo(); };
    zona.addEventListener('pointerup', fin); zona.addEventListener('pointercancel', fin); zona.addEventListener('lostpointercapture', fin);
    return reposo;
  },
  /* el mando: se lee una vez por cuadro dibujado */
  mando(mapa) { this.mapaPad = mapa; },
  leerMando() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const g = pads && [...pads].find((p) => p && p.connected);
    /* se desconectó con algo apretado: se suelta todo lo del mando */
    if (!g || !this.mapaPad) { for (const a of Object.keys(this.padAntes)) this.soltar(a, 'pad'); this.padAntes = {}; return; }
    const ahora = {};
    for (const [i, a] of Object.entries(this.mapaPad)) if (g.buttons[i] && g.buttons[i].pressed) for (const x of [].concat(a)) ahora[x] = true;
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

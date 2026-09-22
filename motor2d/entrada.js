/* ============================================================================
   motor2d/entrada.js — teclado, toque y mando dan las mismas acciones.
   IN[a]   = apretada ahora          EDGE[a] = se apretó en este paso
   SOLT[a] = se soltó en este paso
   Los flancos se borran al FINAL del paso de juego (Entrada.fin()): si se
   borraran al principio, un "recién apretado" nunca llegaría a leerse.
   ========================================================================== */

const Entrada = {
  IN: Object.create(null),
  EDGE: Object.create(null),
  SOLT: Object.create(null),
  quien: Object.create(null),       // acción → quiénes la tienen apretada
  teclas: Object.create(null),      // código de tecla → acción
  mando: { 0: 'salto', 1: 'volver', 2: 'dash', 3: 'curar', 4: 'agarre', 5: 'agarre', 6: 'agarre', 7: 'agarre', 8: 'mapa', 9: 'pausa', 12: 'arr', 13: 'aba', 14: 'izq', 15: 'der' },
  fuente: 'teclado',
  alUsar: null,                     // avisa cuando cambia teclado / toque / mando

  pulsar(a, id) {
    const q = this.quien[a] || (this.quien[a] = new Set());
    if (q.has(id)) return;
    q.add(id);
    if (q.size === 1) { this.IN[a] = true; this.EDGE[a] = true; }
  },
  soltar(a, id) {
    const q = this.quien[a];
    if (!q || !q.delete(id)) return;
    if (q.size === 0) { this.IN[a] = false; this.SOLT[a] = true; }
  },
  soltarTodo() {
    for (const a in this.quien) {
      if (this.quien[a].size) { this.quien[a].clear(); this.IN[a] = false; this.SOLT[a] = true; }
    }
  },
  fin() {
    for (const a in this.EDGE) this.EDGE[a] = false;
    for (const a in this.SOLT) this.SOLT[a] = false;
  },
  usar(f) {
    if (this.fuente === f) return;
    this.fuente = f;
    if (this.alUsar) this.alUsar(f);
  },

  iniciarTeclado(mapa) {
    Object.assign(this.teclas, mapa);
    addEventListener('keydown', (e) => {
      const a = this.teclas[e.code];
      if (!a) return;
      e.preventDefault();
      if (e.repeat) return;
      this.usar('teclado');
      this.pulsar(a, 'k' + e.code);
    });
    addEventListener('keyup', (e) => {
      const a = this.teclas[e.code];
      if (a) this.soltar(a, 'k' + e.code);
    });
    /* si la ventana pierde el foco con una tecla apretada, el keyup no llega
       nunca y el personaje queda corriendo solo */
    addEventListener('blur', () => this.soltarTodo());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.soltarTodo(); });
  },

  /* un botón de pantalla. Cada dedo se sigue por su pointerId: si no, apretar
     otro botón suelta el primero */
  boton(el, accion) {
    const dedos = new Set();
    const bajar = (e) => {
      e.preventDefault();
      dedos.add(e.pointerId);
      this.usar('toque');
      this.pulsar(accion, 'p' + e.pointerId);
      el.classList.add('on');
      /* capturar puede tirar si el puntero ya se fue: va en un try y DESPUÉS
         de anotar el toque */
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    };
    const subir = (e) => {
      if (!dedos.delete(e.pointerId)) return;
      this.soltar(accion, 'p' + e.pointerId);
      if (!dedos.size) el.classList.remove('on');
    };
    el.addEventListener('pointerdown', bajar);
    el.addEventListener('pointerup', subir);
    el.addEventListener('pointercancel', subir);
    el.addEventListener('lostpointercapture', subir);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  /* palanca que aparece donde apoya el pulgar. 8 direcciones en sectores de
     45°: para apuntar un dash en diagonal hace falta que la diagonal sea tan
     ancha como las rectas */
  palanca(zona, base, perilla, o) {
    o = Object.assign({ radio: 38, muerto: 11 }, o);
    let id = null, ox = 0, oy = 0, dx = 0, dy = 0;
    const dirs = { izq: false, der: false, arr: false, aba: false };
    const poner = (nx, ny) => {
      const quiere = { izq: nx < 0, der: nx > 0, arr: ny < 0, aba: ny > 0 };
      for (const a in quiere) {
        if (quiere[a] && !dirs[a]) { dirs[a] = true; this.pulsar(a, 'pal'); }
        else if (!quiere[a] && dirs[a]) { dirs[a] = false; this.soltar(a, 'pal'); }
      }
    };
    const dibujar = () => {
      base.style.transform = `translate(${ox - o.radio}px, ${oy - o.radio}px)`;
      const d = Math.hypot(dx, dy), k = d > o.radio ? o.radio / d : 1;
      perilla.style.transform = `translate(${ox + dx * k - 18}px, ${oy + dy * k - 18}px)`;
    };
    const mover = (e) => {
      const r = zona.getBoundingClientRect();
      dx = e.clientX - r.left - ox; dy = e.clientY - r.top - oy;
      const d = Math.hypot(dx, dy);
      /* si el pulgar se va lejos, la base lo sigue: así nunca se queda sin recorrido */
      if (d > o.radio * 1.5) { const k = (d - o.radio * 1.5) / d; ox += dx * k; oy += dy * k; dx -= dx * k; dy -= dy * k; }
      if (Math.hypot(dx, dy) < o.muerto) poner(0, 0);
      else {
        const a = Math.atan2(dy, dx), c = Math.cos(a), s = Math.sin(a);
        poner(Math.abs(c) > 0.38 ? sig(c) : 0, Math.abs(s) > 0.38 ? sig(s) : 0);
      }
      dibujar();
    };
    zona.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (id !== null) return;
      id = e.pointerId;
      this.usar('toque');
      const r = zona.getBoundingClientRect();
      ox = e.clientX - r.left; oy = e.clientY - r.top; dx = dy = 0;
      zona.classList.add('on');
      try { zona.setPointerCapture(id); } catch (_) {}
      dibujar();
    });
    zona.addEventListener('pointermove', (e) => { if (e.pointerId === id) mover(e); });
    const fin = (e) => {
      if (e.pointerId !== id) return;
      id = null; poner(0, 0); zona.classList.remove('on');
    };
    zona.addEventListener('pointerup', fin);
    zona.addEventListener('pointercancel', fin);
    zona.addEventListener('lostpointercapture', fin);
    zona.addEventListener('contextmenu', (e) => e.preventDefault());
    return { soltar: () => { id = null; poner(0, 0); zona.classList.remove('on'); } };
  },

  /* el mando se lee por encuesta: una vez por cuadro, antes de simular */
  leerMando() {
    if (!navigator.getGamepads) return;
    const lista = navigator.getGamepads();
    for (const m of lista) {
      if (!m || !m.connected) continue;
      let algo = false;
      for (const i in this.mando) {
        const b = m.buttons[i];
        const a = this.mando[i], id = 'm' + m.index + ':' + i;
        if (b && b.pressed) { this.pulsar(a, id); algo = true; } else this.soltar(a, id);
      }
      const ax = m.axes[0] || 0, ay = m.axes[1] || 0, id = 'm' + m.index + ':eje';
      const d = Math.hypot(ax, ay);
      const ang = Math.atan2(ay, ax), c = Math.cos(ang), s = Math.sin(ang);
      const nx = d > 0.45 && Math.abs(c) > 0.38 ? sig(c) : 0;
      const ny = d > 0.45 && Math.abs(s) > 0.38 ? sig(s) : 0;
      if (nx < 0) { this.pulsar('izq', id); algo = true; } else this.soltar('izq', id);
      if (nx > 0) { this.pulsar('der', id); algo = true; } else this.soltar('der', id);
      if (ny < 0) { this.pulsar('arr', id); algo = true; } else this.soltar('arr', id);
      if (ny > 0) { this.pulsar('aba', id); algo = true; } else this.soltar('aba', id);
      if (algo) this.usar('mando');
    }
  },
};

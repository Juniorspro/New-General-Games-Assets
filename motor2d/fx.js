/* ============================================================================
   motor2d/fx.js — partículas, temblor, congelado y fundidos de consola.
   Todo el azar de acá es visual: usa Math.random y nunca el azar del mundo.
   ========================================================================== */

const FX = {
  part: [],
  max: 260,
  temblor: 0,
  sx: 0, sy: 0,
  temblorActivo: true,

  /* o: { col | cols, vx, vy, disp (dispersión de velocidad), g (gravedad),
          vida (cuadros), tam, arrastre, forma: 'cuadro' | 'linea', luz } */
  emitir(x, y, n, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      if (this.part.length >= this.max) this.part.shift();
      const d = o.disp == null ? 40 : o.disp;
      const vida = o.vida ? o.vida * azar(0.7, 1.3) : azar(18, 34);
      this.part.push({
        x: x + azar(-(o.rx || 0), o.rx || 0), y: y + azar(-(o.ry || 0), o.ry || 0),
        vx: (o.vx || 0) + azar(-d, d), vy: (o.vy || 0) + azar(-d, d),
        g: o.g == null ? 0 : o.g, arr: o.arrastre == null ? 0.96 : o.arrastre,
        vida, max: vida, tam: o.tam || 1, col: o.cols ? elegir(o.cols) : (o.col || '#fff'),
        forma: o.forma || 'cuadro', luz: o.luz || 0, fondo: !!o.fondo,
      });
    }
  },
  pasar() {
    const p = this.part;
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      q.vx *= q.arr; q.vy = q.vy * q.arr + q.g * DT;
      q.x += q.vx * DT; q.y += q.vy * DT;
      if (--q.vida <= 0) p.splice(i, 1);
    }
    if (this.temblor > 0) {
      this.temblor *= 0.86;
      if (this.temblor < 0.3) this.temblor = 0;
      const t = this.temblorActivo ? this.temblor : 0;
      this.sx = Math.round(azar(-t, t)); this.sy = Math.round(azar(-t, t));
    } else { this.sx = this.sy = 0; }
  },
  dibujar(g, cx, cy, fondo) {
    for (const q of this.part) {
      if (q.fondo !== !!fondo) continue;
      const x = Math.round(q.x - cx), y = Math.round(q.y - cy);
      const t = q.tam > 1 && q.vida < q.max * 0.5 ? q.tam - 1 : q.tam;
      g.fillStyle = q.col;
      if (q.forma === 'linea') {
        const l = Math.max(1, Math.min(6, Math.round(Math.hypot(q.vx, q.vy) * DT * 1.5)));
        g.fillRect(x, y, l, 1);
      } else g.fillRect(x, y, t, t);
    }
  },
  temblar(f) { if (f > this.temblor) this.temblor = f; },
  limpiar() { this.part.length = 0; this.temblor = 0; },
};

/* trama Bayer 4x4: el fundido de las consolas de 16 bits. Un patrón por nivel
   de 0 a 16, creado en el mismo contexto donde se usa */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const Trama = {
  pat: [], ctx: null, col: '',
  preparar(g, col) {
    if (this.ctx === g && this.col === col) return;
    this.ctx = g; this.col = col; this.pat = [];
    for (let n = 0; n <= 16; n++) {
      const c = document.createElement('canvas');
      c.width = c.height = 4;
      const q = c.getContext('2d');
      q.fillStyle = col;
      for (let i = 0; i < 16; i++) if (BAYER[i] < n) q.fillRect(i % 4, i >> 2, 1, 1);
      this.pat.push(g.createPattern(c, 'repeat'));
    }
  },
  /* nivel 0 (nada) a 16 (todo tapado) */
  cubrir(g, nivel, col, x, y, w, h) {
    nivel = Math.round(lim(nivel, 0, 16));
    if (nivel <= 0) return;
    this.preparar(g, col || '#07060c');
    g.fillStyle = this.pat[nivel];
    g.fillRect(x || 0, y || 0, w == null ? Pantalla.W : w, h == null ? Pantalla.H : h);
  },
};

/* fundidos entre escenas: 'trama' (Bayer) o 'circulo' (se cierra sobre un punto).
   A la mitad llama a alMedio (cambiar de sala, reaparecer) y al final a alFin */
const Transicion = {
  activa: false, t: 0, dur: 0, tipo: 'trama', cx: 0, cy: 0, col: '#07060c',
  alMedio: null, alFin: null, hecho: false,
  iniciar(tipo, cuadros, alMedio, alFin, o) {
    o = o || {};
    this.activa = true; this.t = 0; this.dur = cuadros; this.tipo = tipo;
    this.alMedio = alMedio; this.alFin = alFin; this.hecho = false;
    this.cx = o.cx != null ? o.cx : Pantalla.W / 2; this.cy = o.cy != null ? o.cy : Pantalla.H / 2;
    this.col = o.col || '#07060c';
  },
  pasar() {
    if (!this.activa) return;
    this.t++;
    if (!this.hecho && this.t >= this.dur / 2) { this.hecho = true; if (this.alMedio) this.alMedio(); }
    if (this.t >= this.dur) { this.activa = false; if (this.alFin) this.alFin(); }
  },
  /* 0 → 1 → 0 a lo largo del fundido */
  cantidad() { return this.activa ? 1 - Math.abs(this.t / this.dur * 2 - 1) : 0; },
  dibujar(g) {
    if (!this.activa) return;
    const k = this.cantidad();
    if (this.tipo === 'trama') Trama.cubrir(g, k * 16.99, this.col);
    else {
      /* el círculo se dibuja por renglones: arc() suaviza el borde y en pixel
         art tiene que quedar duro */
      const W = Pantalla.W, H = Pantalla.H;
      const rmax = Math.hypot(Math.max(this.cx, W - this.cx), Math.max(this.cy, H - this.cy)) + 2;
      const r = rmax * (1 - k);
      g.fillStyle = this.col;
      for (let y = 0; y < H; y++) {
        const dy = y + 0.5 - this.cy;
        if (Math.abs(dy) >= r) { g.fillRect(0, y, W, 1); continue; }
        const a = Math.sqrt(r * r - dy * dy), x0 = Math.round(this.cx - a), x1 = Math.round(this.cx + a);
        if (x0 > 0) g.fillRect(0, y, x0, 1);
        if (x1 < W) g.fillRect(x1, y, W - x1, 1);
      }
    }
  },
};

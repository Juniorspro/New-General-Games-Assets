/* ============================================================================
   luz-mala/js/menus.js — los menús de LUZ MALA, dibujados en el lienzo.
   Nada de botones: las opciones son palabras que se prenden, y dos
   luciérnagas vuelan a los costados de la que está elegida. Se usan con el
   dedo (tocando la palabra), con el teclado y con el mando.
   Un menú: { id, titulo, items: [{ id, texto(), valor?(), accion?(), izq?(), der?(), luces?() }],
              sel, estilo: 'lista' | 'faroles', alVolver?(), y0? }
   ========================================================================== */

const Menu = {
  actual: null, pila: [], toque: null, rects: [],
  cur: { x0: 0, x1: 0, y: 0, lista: false },
  abrir(def, o) {
    o = o || {};
    if (this.actual && o.apilar) this.pila.push(this.actual);
    else if (!o.apilar) this.pila.length = 0;
    def.sel = def.sel || 0; def.t = o.sinEntrada ? 1 : 0;
    this.actual = def; this.rects = []; this.cur.lista = false;
  },
  cerrar() { this.actual = null; this.pila.length = 0; },
  volver() {
    const p = this.pila.pop();
    if (p) { this.actual = p; p.t = 1; this.cur.lista = false; Sonido.sfx('elegir'); return true; }
    if (this.actual && this.actual.alVolver) { Sonido.sfx('elegir'); this.actual.alVolver(); return true; }
    return false;
  },
  item() { const m = this.actual; return m && m.items[lim(m.sel, 0, m.items.length - 1)]; },
  mover(d) {
    const m = this.actual, n = m.items.length;
    for (let k = 0; k < n; k++) { m.sel = (m.sel + d + n) % n; if (!m.items[m.sel].apagado) break; }
    Sonido.sfx('mover');
  },
  activar(it, lado) {
    if (!it || it.apagado) { Sonido.sfx('nada'); return; }
    if (lado < 0 && it.izq) { it.izq(); Sonido.sfx('mover'); }
    else if (lado > 0 && it.der) { it.der(); Sonido.sfx('mover'); }
    else if (it.accion) { Sonido.sfx('elegir'); it.accion(); }
    else if (it.der) { it.der(); Sonido.sfx('mover'); }
  },
  pasar() {
    const m = this.actual;
    if (!m) return;
    m.t += DT;
    /* los faroles: cuando la luz del elegido terminó de llenar todo, se sigue */
    if (m.estilo === 'faroles' && m.elegido >= 0) {
      if (m.t - m.tElegido >= 1.1 && !m.hecho) { m.hecho = true; m.alElegir(m.items[m.elegido].id); }
      return;
    }
    const E = Entrada.EDGE, horizontal = m.estilo === 'faroles';
    if (horizontal ? E.izq || E.arr : E.arr) this.mover(-1);
    if (horizontal ? E.der || E.aba : E.aba) this.mover(1);
    const it = this.item();
    if (!horizontal && (E.izq || E.der) && it && (it.izq || it.der)) this.activar(it, E.izq ? -1 : 1);
    if (E.salto || E.aceptar || E.golpe) this.activar(it, 0);
    else if (E.volver || E.dash || (E.pausa && m.pausaVuelve)) this.volver();
    /* el dedo: tocar una palabra la elige; en una opción, los costados la bajan o la suben */
    if (this.toque) {
      const { x, y } = this.toque;
      this.toque = null;
      for (const r of this.rects) {
        if (x < r.x0 || x > r.x1 || y < r.y0 || y > r.y1) continue;
        const i = m.items.indexOf(r.it);
        if (i < 0) continue;
        m.sel = i;
        const k = (x - r.x0) / Math.max(1, r.x1 - r.x0);
        this.activar(r.it, r.it.izq && r.it.der ? (k < 0.3 ? -1 : k > 0.7 ? 1 : 1) : 0);
        break;
      }
    }
  },
  dibujar(g, t) {
    const m = this.actual;
    if (!m) return;
    if (m.estilo === 'faroles') return dibujarFaroles(g, m, t);
    if (m.dibujar) return m.dibujar(g, m, t);
    dibujarLista(g, m, t);
  },
};

/* ---------------- los colores de la noche ---------------- */
const COL_MENU = { apagada: '#8f84a6', prendida: '#fff6d8', halo: '#f6ffa8', titulo: '#efe6d2', gris: '#5c536e', oro: '#ffd98a' };

/* la raya con rulos que va abajo de un título: se dibuja desde el centro */
function adornoLM(g, cx, y, ancho, k) {
  const w = Math.round(ancho / 2 * Math.min(1, k));
  g.fillStyle = 'rgba(239,230,210,0.7)';
  g.fillRect(Math.round(cx - w), y, w * 2, 1);
  g.fillStyle = COL_MENU.oro;
  g.fillRect(Math.round(cx) - 1, y - 1, 3, 3);
  if (k >= 1) for (const s of [-1, 1]) {
    const x = Math.round(cx + s * w);
    g.fillStyle = 'rgba(239,230,210,0.7)';
    g.fillRect(x - (s > 0 ? 2 : 0), y - 2, 3, 1); g.fillRect(x + (s > 0 ? 1 : -1), y - 1, 1, 1);
    g.fillRect(x - (s > 0 ? 3 : -1), y + 1, 2, 1);
  }
}
/* una luciérnaga chiquita con su brillo (el cursor de los menús) */
function luciernaga(g, x, y, t, fuerza) {
  const b = 0.6 + Math.sin(t * 7) * 0.25;
  const r = 7;
  const grd = g.createRadialGradient(x, y, 0, x, y, r);
  grd.addColorStop(0, `rgba(246,255,168,${0.55 * b * (fuerza || 1)})`); grd.addColorStop(1, 'rgba(246,255,168,0)');
  g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  g.fillStyle = '#fbffd8'; g.fillRect(Math.round(x), Math.round(y), 1, 1);
  g.fillStyle = 'rgba(246,255,168,0.8)'; g.fillRect(Math.round(x) - 1, Math.round(y), 1, 1); g.fillRect(Math.round(x) + 1, Math.round(y), 1, 1); g.fillRect(Math.round(x), Math.round(y) - 1, 1, 1);
}

/* ---------------- la lista: título, opciones y las dos luciérnagas ---------------- */
function dibujarLista(g, m, t) {
  const W = Pantalla.W, H = VistaLM.usable || Pantalla.H, cx = Math.round(m.x != null ? m.x : W / 2);
  const paso = m.paso || 15, n = m.items.length;
  let y = m.y0 != null ? Math.round(typeof m.y0 === 'function' ? m.y0() : m.y0) : Math.round(H / 2 - (n * paso) / 2 + (m.titulo ? 10 : 0));
  if (m.titulo) {
    const k = Math.min(1, m.t / 0.35);
    textoFino(g, m.titulo, cx, y - 34, { alin: 'centro', escala: 2, esp: 2, col: COL_MENU.titulo, halo: COL_MENU.halo, alfa: k });
    adornoLM(g, cx, y - 14, Math.min(W - 40, 150), Math.min(1, m.t / 0.5));
  }
  Menu.rects = [];
  const anchoOpc = Math.min(W - 36, 190);
  m.items.forEach((it, i) => {
    const ent = lim((m.t - 0.08 - i * 0.06) / 0.25, 0, 1);
    const yy = y + i * paso + Math.round((1 - ent) * 6);
    const sel = i === m.sel, txt = it.texto(), val = it.valor ? it.valor() : null;
    const col = it.apagado ? COL_MENU.gris : sel ? COL_MENU.prendida : COL_MENU.apagada;
    const o = { col, halo: sel && !it.apagado ? COL_MENU.halo : null, alfa: ent };
    let x0, x1;
    if (val == null) {
      textoFino(g, txt, cx, yy, Object.assign({ alin: 'centro' }, o));
      const w = anchoFino(txt); x0 = cx - w / 2; x1 = cx + w / 2;
    } else {
      /* opción: el nombre a la izquierda y el valor a la derecha, con flechitas si está elegida */
      x0 = cx - anchoOpc / 2; x1 = cx + anchoOpc / 2;
      textoFino(g, txt, x0, yy, Object.assign({ alin: 'izq' }, o));
      if (it.luces) {
        const v = it.luces(), n2 = 10;
        for (let k = 0; k < n2; k++) {
          const lx = x1 - (n2 - k) * 5, on = k < Math.round(v * n2);
          g.globalAlpha = ent;
          g.fillStyle = on ? (sel ? '#f6ffa8' : '#b4c878') : '#3a3048'; g.fillRect(lx, yy + 2, 3, 3);
          if (on && sel) { g.fillStyle = 'rgba(246,255,168,0.25)'; g.fillRect(lx - 1, yy + 1, 5, 5); }
          g.globalAlpha = 1;
        }
      } else textoFino(g, val, x1 - (sel ? 7 : 0), yy, Object.assign({ alin: 'der' }, o));
      if (sel && !it.luces) {
        const vw = anchoFino(val), vx = x1 - 7 - vw - 6, b = Math.round(Math.sin(t * 6));
        g.fillStyle = COL_MENU.halo;
        for (let k = 0; k < 3; k++) { g.fillRect(vx - k + b * 0, yy + 3 - k, 1, 1 + k * 2); g.fillRect(x1 - 2 + k, yy + 3 - k, 1, 1 + k * 2); }
      }
    }
    Menu.rects.push({ it, x0: x0 - 10, x1: x1 + 10, y0: yy - 4, y1: yy + paso - 4 });
    if (sel) {
      const pad = 10, cy = yy + 3;
      const c = Menu.cur;
      if (!c.lista) { c.x0 = x0 - pad; c.x1 = x1 + pad; c.y = cy; c.lista = true; }
      c.x0 += (x0 - pad - c.x0) * 0.25; c.x1 += (x1 + pad - c.x1) * 0.25; c.y += (cy - c.y) * 0.25;
    }
  });
  const c = Menu.cur;
  if (c.lista && m.t > 0.2) {
    const b = Math.sin(t * 4) * 1.5;
    luciernaga(g, c.x0 + Math.cos(t * 3) * 1, c.y + b, t);
    luciernaga(g, c.x1 - Math.cos(t * 3) * 1, c.y - b, t + 1.3);
  }
  if (m.pie) {
    const lineas = envolverFino(m.pie, Math.min(W - 30, 200));
    lineas.forEach((l, k) => textoFino(g, l, cx, y + n * paso + 10 + k * 10, { alin: 'centro', col: '#6f6684', alfa: lim(m.t - 0.4, 0, 1) }));
  }
}

/* ---------------- el idioma: tres faroles colgados; el elegido se prende ---------------- */
function menuIdiomas(alElegir) {
  return {
    id: 'idioma', estilo: 'faroles', sel: Math.max(0, IDIOMAS.findIndex(([l]) => l === Idioma.actual)),
    luz: [0, 0, 0], elegido: -1,
    items: IDIOMAS.map(([l, n]) => ({ id: l, texto: () => n, accion() { const m = Menu.actual; if (m.elegido < 0) { m.elegido = m.items.indexOf(this); m.tElegido = m.t; Sonido.sfx('farol'); } } })),
    alElegir,
  };
}
const TX_IDIOMA = { es: 'Elegí tu idioma', en: 'Choose your language', pt: 'Escolha seu idioma' };
function dibujarFaroles(g, m, t) {
  const W = Pantalla.W, H = Pantalla.H, n = m.items.length;
  const paso = Math.min(76, (W - 20) / n), x0 = W / 2 - paso * (n - 1) / 2, yTecho = Math.round(H * 0.3);
  /* la luz sube en el elegido y baja en los otros; al confirmar, se agranda y se va todo */
  m.items.forEach((it, i) => { m.luz[i] = acercar(m.luz[i], i === m.sel ? 1 : 0, Reloj.d * 2.4); });
  Menu.rects = [];
  const listo = m.elegido >= 0 ? lim((m.t - m.tElegido) / 1.1, 0, 1) : 0;
  const cur = Menu.cur;
  const meta = x0 + m.sel * paso;
  if (cur.lista !== 'faroles') { cur.x0 = meta; cur.lista = 'faroles'; }
  cur.x0 += (meta - cur.x0) * 0.12;
  m.items.forEach((it, i) => {
    const x = x0 + i * paso, k = m.luz[i];
    const bal = Math.sin(t * 1.4 + i * 1.7) * (1.5 + k * 2.5);
    const largo = Math.round(H * 0.12 + (i % 2) * 10);
    const fx = Math.round(x + bal), fy = yTecho + largo;
    /* el hilo */
    g.fillStyle = 'rgba(200,190,170,0.35)';
    for (let yy = 0; yy < largo; yy++) g.fillRect(Math.round(x + bal * yy / largo), yTecho + yy, 1, 1);
    /* el brillo (suave, no en trama) */
    if (k > 0.02) {
      const r = 26 + k * 22 + (m.elegido === i ? listo * 120 : 0);
      const grd = g.createRadialGradient(fx, fy + 6, 0, fx, fy + 6, r);
      grd.addColorStop(0, `rgba(255,214,120,${0.42 * k})`); grd.addColorStop(0.5, `rgba(255,170,70,${0.14 * k})`); grd.addColorStop(1, 'rgba(255,170,70,0)');
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = grd; g.fillRect(fx - r, fy + 6 - r, r * 2, r * 2);
      /* el estero de la portada repite la luz, estirada y temblando */
      const ry = Portada.agua ? 2 * Portada.agua - (fy + 6) : H * 2;
      if (ry < H + r) {
        g.save(); g.translate(fx + Math.sin(t * 2.4 + i) * 1.5, ry); g.scale(0.8, 0.45); g.globalAlpha = 0.55;
        g.translate(-fx, -(fy + 6)); g.fillStyle = grd; g.fillRect(fx - r, fy + 6 - r, r * 2, r * 2);
        g.restore();
      }
      g.globalCompositeOperation = 'source-over';
    }
    /* el farol: 9 x 13, vidrio que se enciende */
    const vidrio = k > 0.5 ? (Math.sin(t * 12 + i) > -0.6 ? '#ffe7a0' : '#ffd070') : k > 0.1 ? '#a8783a' : '#241c2c';
    g.fillStyle = '#1a1420'; g.fillRect(fx - 2, fy, 5, 2);
    g.fillStyle = '#6a5a40'; g.fillRect(fx - 4, fy + 2, 9, 2);
    g.fillStyle = '#3a3028'; g.fillRect(fx - 4, fy + 4, 9, 8);
    g.fillStyle = vidrio; g.fillRect(fx - 3, fy + 5, 7, 6);
    if (k > 0.5) { g.fillStyle = '#ffffff'; g.fillRect(fx, fy + 7, 1, 2); }
    g.fillStyle = '#6a5a40'; g.fillRect(fx - 4, fy + 12, 9, 2);
    g.fillStyle = '#1a1420'; g.fillRect(fx - 1, fy + 14, 3, 1);
    /* el nombre del idioma, en su idioma */
    const txt = it.texto(), sel = i === m.sel;
    textoFino(g, txt, x, fy + 24, { alin: 'centro', col: sel ? COL_MENU.prendida : COL_MENU.apagada, halo: sel ? COL_MENU.halo : null, alfa: m.elegido >= 0 && m.elegido !== i ? 1 - listo : 1 });
    Menu.rects.push({ it, x0: x - paso / 2, x1: x + paso / 2, y0: yTecho, y1: fy + 36 });
  });
  /* la luciérnaga que va de farol en farol */
  if (m.elegido < 0) luciernaga(g, cur.x0 + Math.sin(t * 2) * 6, yTecho + H * 0.12 - 8 + Math.cos(t * 3) * 3, t);
  /* la pregunta, en el idioma que se está mirando */
  const l = IDIOMAS[m.sel][0];
  textoFino(g, TX_IDIOMA[l], W / 2, Math.round(H * 0.18), { alin: 'centro', col: COL_MENU.titulo, halo: COL_MENU.halo, esp: 1, alfa: 1 - listo });
  adornoLM(g, W / 2, Math.round(H * 0.18) + 14, Math.min(W - 60, 130), 1);
  if (listo > 0) { g.fillStyle = `rgba(5,3,8,${listo})`; g.fillRect(0, 0, W, H); }
}

/* ---------------- íconos finos para los botones de la pantalla ---------------- */
const ICONOS_LM = {
  salto: ['....#....', '...###...', '..#.#.#..', '.#..#..#.', '....#....', '....#....', '....#....', '...###...', '..#...#..'],
  golpe: ['........#', '.......#.', '......#..', '.....#...', '....#....', '.#.#.....', '..#......', '.#.#.....', '#........'],
  dash: ['.##......', '#..##....', '.....##..', '.######.#', '.....##..', '#..##....', '.##......', '.........', '.........'],
  curar: ['....#....', '....#....', '.#..#..#.', '..#.#.#..', '####.####', '..#.#.#..', '.#..#..#.', '....#....', '....#....'],
  pausa: ['.........', '.##...##.', '.##...##.', '.##...##.', '.##...##.', '.##...##.', '.##...##.', '.##...##.', '.........'],
};
function iconoLM(nombre, col, S) {
  const f = ICONOS_LM[nombre], c = document.createElement('canvas');
  c.width = 13; c.height = 13;
  const g = c.getContext('2d');
  g.fillStyle = col; g.globalAlpha = 0.25;
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (f[y][x] === '#') g.fillRect(x + 1, y + 1, 3, 3);
  g.globalAlpha = 1;
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (f[y][x] === '#') g.fillRect(x + 2, y + 2, 1, 1);
  c.className = 'px'; c.style.width = (13 * S) + 'px'; c.style.height = (13 * S) + 'px';
  return c;
}

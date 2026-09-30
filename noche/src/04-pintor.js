// ─────────────────────────────────────────────────────────────────────────────
// EL PINTOR: todo el arte sale de acá, dibujado por código a escala 1 (un píxel = un píxel).
// Volúmenes sombreados con rampas cortas de una paleta limitada (luz de arriba a la izquierda,
// borde oscuro, tramado Bayer en los cambios de tono), contorno oscuro de 1 px, y los detalles
// (ojos, bocas, manchas, grietas) puestos a mano con sellos de texto. Nada de antialias.
// Cada sprite se hornea UNA vez en un canvas chico y se cachea.
// ─────────────────────────────────────────────────────────────────────────────

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.47);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
// El original se ve "dibujado", no retro: tonos planos con bordes limpios, sin tramado. El tramado
// queda apagado en los volúmenes (bola, caja); sólo lo usan, a propósito, algunas texturas.
const SIN_TRAMA = 0;
// El contorno de los dibujos: no es negro, es el mismo color del objeto bien oscuro (como el gris
// oscuro de las vasijas del original). Se pide con AUTO; las letras siguen con negro.
const AUTO = "auto";

// La paleta: pocos colores, apagados, que conversan entre sí (lo que da unidad).
const PAL = {
  tinta: "#120a0e",          // el contorno de todo (no negro puro)
  piel: ["#4a302f", "#7d5752", "#b8908a", "#dfbfb2", "#f6e4da"],
  hongo: ["#2c0b10", "#5e161b", "#962824", "#c9442f", "#e9735a"],
  crema: ["#6e6150", "#a89a82", "#d9ccb2", "#f1e8d6"],
  musgo: ["#141c12", "#243320", "#3a5130", "#58734a", "#83a068"],
  espora: ["#133034", "#2e6a6a", "#5ea8a0", "#a8e2d4", "#effff9"],
  piedra: ["#15181a", "#262c2c", "#3a4240", "#566058", "#7b8577", "#a2ab9a"],
  tierra: ["#170f0b", "#2c1d14", "#48301f", "#6b4a31", "#8f6a48", "#b58f67"],
  sangre: ["#2a0508", "#5c0c12", "#98161c", "#cf2b2b", "#f25a4a"],
  baba: ["#1b1d0a", "#3f4414", "#6b7020", "#9ea235", "#d0d06a"],
  oro: ["#3a2408", "#6e4a10", "#b07e1c", "#e0b43a", "#fbe58a"],
  hueso: ["#3b342c", "#6f6456", "#a99a86", "#d8cdb9", "#f5efe3"],
  violeta: ["#1d0f2c", "#3a1f56", "#5e3589", "#8c5cc0", "#c19ae8"],
  hielo: ["#0f2436", "#1f4d6e", "#3f82a8", "#7fbfdc", "#d2f1ff"],
  fuego: ["#3a0c04", "#8a2206", "#d65410", "#f59a26", "#ffe07a"],
  hierro: ["#0e1012", "#23272b", "#3d444a", "#5f686e", "#8d979b"],
  azul: ["#0d1530", "#1c2e62", "#2f4f9c", "#5480d4", "#9cc0f4"],
};

function lienzoNuevo(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }

class Pix {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Array(w * h).fill(null); }
  dentro(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  p(x, y, c) { x = Math.floor(x); y = Math.floor(y); if (c && this.dentro(x, y)) this.d[y * this.w + x] = c; return this; }
  g(x, y) { x = Math.floor(x); y = Math.floor(y); return this.dentro(x, y) ? this.d[y * this.w + x] : null; }
  borrar(x, y) { if (this.dentro(x, y)) this.d[y * this.w + x] = null; }
  /** Un volumen elíptico sombreado. rampa: de oscuro a claro. filtro(x, y) → false para no pintar ese píxel. */
  bola(cx, cy, rx, ry, rampa, o = {}) {
    const L = o.luz || [-0.52, -0.62, 0.58], n = rampa.length, bajar = o.bajar ?? 0.18, trama = SIN_TRAMA * (o.trama ?? 0.9);
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, r2 = nx * nx + ny * ny;
      if (r2 > 1 || (o.filtro && !o.filtro(x, y))) continue;
      const nz = Math.sqrt(1 - r2);
      // lambert con L apuntando HACIA la luz (x<0 izquierda, y<0 arriba). Medido: con el signo cambiado
      // las esferas quedaban iluminadas desde ABAJO a la derecha y las cabezas parecían dadas vuelta.
      let l = nx * L[0] + ny * L[1] + nz * L[2];
      l = l * 0.5 + 0.5 - bajar * r2 * r2;                  // el borde, más oscuro (como el original)
      // degradé continuo entre los tonos de la rampa (se ve pintado, no escalonado); o.plano: a tonos
      if (o.plano) { const i = Math.floor(l * n + bayer(x, y) * trama); this.p(x, y, rampa[lim(i + (o.corrimiento || 0), 0, n - 1)]); continue; }
      const f = lim(l * n - 0.5 + (o.corrimiento || 0), 0, n - 1), i0 = Math.floor(f), i1 = Math.min(n - 1, i0 + 1);
      this.p(x, y, i0 === i1 ? rampa[i0] : mezclarCache(rampa[i0], rampa[i1], Math.round((f - i0) * 6) / 6));
    }
    return this;
  }
  /** Un rectángulo sombreado de arriba (claro) a abajo (oscuro). */
  caja(x0, y0, w, h, rampa, o = {}) {
    const n = rampa.length;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const t = 1 - (y - y0 + 0.5) / h, u = 1 - (x - x0 + 0.5) / w;
      const l = (o.vertical ?? 0.75) * t + (1 - (o.vertical ?? 0.75)) * u;
      if (o.plano) { this.p(x, y, rampa[lim(Math.floor(l * n), 0, n - 1)]); continue; }
      const f = lim(l * n - 0.5, 0, n - 1), i0 = Math.floor(f), i1 = Math.min(n - 1, i0 + 1);
      this.p(x, y, i0 === i1 ? rampa[i0] : mezclarCache(rampa[i0], rampa[i1], Math.round((f - i0) * 6) / 6));
    }
    return this;
  }
  rect(x0, y0, w, h, c) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.p(x, y, c); return this; }
  linea(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.p(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c);
    return this;
  }
  /** Un sello de texto: cada letra es un color de la paleta (espacio o '.' = nada). */
  sello(x0, y0, filas, pal) {
    filas.forEach((f, y) => { for (let x = 0; x < f.length; x++) { const k = f[x]; if (k !== "." && k !== " " && pal[k]) this.p(x0 + x, y0 + y, pal[k]); } });
    return this;
  }
  /** Contorno por fuera de lo pintado (4 vecinos; con esquinas = 8). */
  contorno(c = PAL.tinta, esquinas = false) {
    const lleno = this.d.map((v) => v !== null), w = this.w, orig = this.d.slice();
    for (let y = 0; y < this.h; y++) for (let x = 0; x < w; x++) {
      if (lleno[y * w + x]) continue;
      const v = (dx, dy) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < w && Y < this.h && lleno[Y * w + X]; };
      const toca = v(1, 0) || v(-1, 0) || v(0, 1) || v(0, -1) || (esquinas && (v(1, 1) || v(-1, 1) || v(1, -1) || v(-1, -1)));
      if (!toca) continue;
      if (c !== AUTO) { this.d[y * w + x] = c; continue; }
      // AUTO: el promedio de los vecinos pintados, llevado casi a negro (con su tinte)
      let r = 0, g = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (v(dx, dy)) { const q = rgba(orig[(y + dy) * w + x + dx]); r += q[0]; g += q[1]; b += q[2]; n++; }
      if (!n) { r = 40; g = 30; b = 34; n = 1; }
      this.d[y * w + x] = hex(r / n * 0.3 + 10, g / n * 0.26 + 6, b / n * 0.28 + 8);
    }
    return this;
  }
  /** Oscurece los píxeles del borde de lo pintado (un "contorno interior" de color). */
  bordeInterior(mapa) {
    const lleno = this.d.map((v) => v !== null), w = this.w, cambios = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < w; x++) {
      if (!lleno[y * w + x]) continue;
      const v = (dx, dy) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < w && Y < this.h && lleno[Y * w + X]; };
      if (!v(1, 0) || !v(-1, 0) || !v(0, 1) || !v(0, -1)) { const c = this.d[y * w + x], n = mapa[c]; if (n) cambios.push([x, y, n]); }
    }
    for (const [x, y, c] of cambios) this.p(x, y, c);
    return this;
  }
  espejo() { const q = new Pix(this.w, this.h); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) q.d[y * this.w + (this.w - 1 - x)] = this.d[y * this.w + x]; return q; }
  copiar() { const q = new Pix(this.w, this.h); q.d = this.d.slice(); return q; }
  pegar(o, dx, dy) { for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) { const c = o.d[y * o.w + x]; if (c) this.p(x + dx, y + dy, c); } return this; }
  /** Tiñe todo (para el blanco del golpe, o un campeón). */
  tenido(fn) { const q = this.copiar(); q.d = q.d.map((c) => (c ? fn(c) : c)); return q; }
  canvas() {
    const c = lienzoNuevo(this.w, this.h), g = c.getContext("2d"), im = g.createImageData(this.w, this.h);
    for (let i = 0; i < this.d.length; i++) {
      const col = this.d[i];
      if (!col) continue;
      const [r, gg, b, a] = rgba(col);
      im.data[i * 4] = r; im.data[i * 4 + 1] = gg; im.data[i * 4 + 2] = b; im.data[i * 4 + 3] = a;
    }
    g.putImageData(im, 0, 0);
    return c;
  }
}

const _rgba = new Map();
function rgba(col) {
  let v = _rgba.get(col);
  if (v) return v;
  if (col[0] === "#") {
    const n = parseInt(col.slice(1, 7), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255, col.length > 7 ? parseInt(col.slice(7, 9), 16) : 255];
  } else { const m = col.match(/[\d.]+/g).map(Number); v = [m[0], m[1], m[2], Math.round((m[3] ?? 1) * 255)]; }
  _rgba.set(col, v);
  return v;
}
function hex(r, g, b) { return "#" + [r, g, b].map((x) => lim(Math.round(x), 0, 255).toString(16).padStart(2, "0")).join(""); }
const _mezclas = new Map();
function mezclarCache(a, b, t) { const k = a + b + t; let v = _mezclas.get(k); if (!v) { v = mezclar(a, b, t); _mezclas.set(k, v); } return v; }
function mezclar(a, b, t) { const A = rgba(a), B = rgba(b); return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
/** Una rampa nueva desde un color base (para campeones y ítems). */
function rampaDe(base, n = 5) { const out = []; for (let i = 0; i < n; i++) { const t = i / (n - 1); out.push(t < 0.5 ? mezclar("#0b0709", base, 0.25 + t * 1.5) : mezclar(base, "#fff6ea", (t - 0.5) * 0.9)); } return out; }

// ── la caché de sprites ──
const SPR = {};
function hornear(clave, fn) { if (!SPR[clave]) SPR[clave] = fn(); return SPR[clave]; }
/** El mismo sprite todo blanco (el destello de cuando le pegan). */
const _blancos = new WeakMap();
function blanco(c) {
  let b = _blancos.get(c);
  if (b) return b;
  b = lienzoNuevo(c.width, c.height);
  const g = b.getContext("2d"); g.drawImage(c, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = "#fff4f0"; g.fillRect(0, 0, b.width, b.height);
  _blancos.set(c, b);
  return b;
}
const _rojos = new WeakMap();
function rojizo(c) {
  let b = _rojos.get(c);
  if (b) return b;
  b = lienzoNuevo(c.width, c.height);
  const g = b.getContext("2d"); g.drawImage(c, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = "rgba(220,30,30,0.55)"; g.fillRect(0, 0, b.width, b.height);
  _rojos.set(c, b);
  return b;
}

/** La sombra en el piso: una elipse de píxeles duros, semitransparente. */
function sombra(rx, ry) {
  return hornear(`sombra${rx}x${ry}`, () => {
    const p = new Pix(rx * 2 + 1, ry * 2 + 1);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      const nx = (x + 0.5 - p.w / 2) / (rx + 0.5), ny = (y + 0.5 - p.h / 2) / (ry + 0.5), r = nx * nx + ny * ny;
      if (r <= 1) p.p(x, y, r < 0.45 ? "rgba(4,2,6,0.46)" : "rgba(4,2,6,0.30)");
    }
    return p.canvas();
  });
}

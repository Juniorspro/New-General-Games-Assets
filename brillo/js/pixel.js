/* brillo/js/pixel.js — el pintor de pixel art.
   Todo el dibujo de BRILLO sale de acá: figuras (elipses, cápsulas, polígonos)
   que se pintan píxel por píxel con una "pintura": un color fijo o una función
   que, según dónde cae el píxel adentro de la figura, elige un tono de una
   rampa. Así una esfera sale con volumen en bandas (como en el pixel art a
   mano) y con el brillo de vidrio del Frutiger Aero: la mitad de arriba más
   clara con un corte nítido, un punto de luz blanco y un reflejo abajo.
   Al final, el contorno "de color": cada borde toma el tono más oscuro de su
   propia rampa, no un negro parejo. */

/* '#rrggbb' → [r, g, b] */
export function rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function hex([r, g, b]) { return '#' + ((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1); }
export function mezclar(a, b, t) { const A = rgb(a), B = rgb(b); return hex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]); }
const empaquetar = (h, a = 255) => { const [r, g, b] = rgb(h); return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0; };

/* las rampas: de lo más oscuro a lo más claro */
export const RAMPA = {
  azul: ['#0a2566', '#113f9e', '#1a5fd0', '#2f82ee', '#55a5fb', '#8cc8ff', '#c9e7ff', '#f2fbff'],
  verde: ['#0c4a1c', '#156e22', '#1f9a2c', '#3bbd33', '#6fd845', '#a6ee6a', '#d6fba6', '#f6fff0'],
  naranja: ['#6a2a06', '#a2440a', '#d86410', '#f58a1c', '#ffae3c', '#ffcf78', '#ffe9bf', '#fff9ef'],
  rosa: ['#6e0f3e', '#a31a5e', '#d6307f', '#f2549e', '#fb82ba', '#ffb2d6', '#ffdcec', '#fff5fa'],
  amarillo: ['#6b4c00', '#a07400', '#d6a300', '#f5c400', '#ffdb2e', '#ffea73', '#fff5b8', '#fffdf0'],
  violeta: ['#2c1266', '#46209e', '#6534cf', '#8452ee', '#a67bfb', '#c7a8ff', '#e4d5ff', '#f8f4ff'],
  cian: ['#003f5c', '#006b8f', '#0097bf', '#1bbde0', '#4fd8f2', '#8ceafa', '#c8f6fd', '#f0fdff'],
  gris: ['#3a3f47', '#565c66', '#737a85', '#9098a3', '#adb4bd', '#c9ced5', '#e2e5e9', '#f6f7f8'],
  blanco: ['#7d93ad', '#9db1c8', '#bccde0', '#d5e2ef', '#e6eff7', '#f1f6fb', '#f8fbfe', '#ffffff'],
  tierra: ['#3b2413', '#5a371b', '#7a4d27', '#9a6636', '#b98249', '#d3a468', '#e8c894', '#f7ebd2'],
  arena: ['#7a5a2a', '#9c7838', '#bd984e', '#d6b46a', '#e8cc8a', '#f3e0ad', '#faefd0', '#fffaee'],
};

/* la luz viene de arriba a la izquierda y un poco de frente */
const LUZ = (() => { const l = [-0.55, -0.7, 0.55], n = Math.hypot(...l); return l.map((v) => v / n); })();

/* pinturas: reciben (u, v) en [-1, 1] adentro de la figura y devuelven un color (o null = no pintar) */
export const pintura = {
  plana: (c) => () => c,
  /* esfera en bandas: difusa + un poco de luz de abajo, cuantizada en la rampa */
  esfera(rampa, o = {}) {
    const n = rampa.length, bajo = o.bajo ?? 1, alto = o.alto ?? n - 2;
    return (u, v) => {
      const r2 = u * u + v * v; if (r2 > 1) return null;
      const z = Math.sqrt(1 - r2);
      let d = -(u * LUZ[0] + v * LUZ[1]) + z * LUZ[2];
      d = d * 0.75 + 0.25 + Math.max(0, v - 0.55) * 0.35;         // rebote de abajo
      const i = Math.max(bajo, Math.min(alto, Math.round(bajo + (alto - bajo) * Math.max(0, Math.min(1, d)))));
      return rampa[i];
    };
  },
  /* el vidrio del Aero: esfera + la gorra clara arriba con corte nítido + el punto de luz */
  aero(rampa, o = {}) {
    const base = pintura.esfera(rampa, o), n = rampa.length, corte = o.corte ?? -0.05, gorra = o.gorra ?? 0.55;
    return (u, v) => {
      const c = base(u, v); if (!c) return null;
      /* el punto de luz, arriba a la izquierda */
      const du = u + 0.42, dv = v + 0.56;
      if (du * du * 1.4 + dv * dv * 2.8 < (o.punto ?? 0.05)) return rampa[n - 1];
      /* la gorra: la mitad de arriba más clara, con el corte nítido de los botones de vidrio */
      if (v < corte && (u / 0.8) ** 2 + ((v + 0.4) / 0.52) ** 2 < 1) return mezclar(c, rampa[n - 1], gorra);
      /* el reflejo de abajo: la luz que rebota adentro del vidrio */
      if (o.rebote !== false && v > 0.5 && (u / 0.62) ** 2 + ((v - 0.78) / 0.24) ** 2 < 1) return mezclar(c, rampa[n - 2], 0.4);
      return c;
    };
  },
  /* una forma de huevo: más ancha arriba (el cuerpo) — se usa con Lienzo.huevo */
  /* degradé vertical en bandas (para cuerpos, piernas, cosas que no son esferas) */
  vertical(rampa, desde, hasta) {
    return (u, v) => rampa[Math.round(desde + (hasta - desde) * (v * 0.5 + 0.5))];
  },
};

export class Lienzo {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.p = new Uint32Array(w * h);          // el color, empaquetado (0 = vacío)
    this.hex = new Array(w * h).fill(null);   // el mismo color en '#rrggbb' (para el contorno)
    this.rampa = new Array(w * h).fill(null); // de qué rampa salió (para el contorno de color)
  }
  punto(x, y, c, rampa, a) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
    const i = y * this.w + x;
    this.p[i] = empaquetar(c, a ?? 255); this.hex[i] = c; this.rampa[i] = rampa || null;
  }
  borrar(x, y) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = y * this.w + x; this.p[i] = 0; this.hex[i] = null; this.rampa[i] = null; }
  hay(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.p[y * this.w + x] !== 0; }
  /* una elipse: pinta es un color o una función (u, v) */
  elipse(cx, cy, rx, ry, pinta, rampa) {
    const f = typeof pinta === 'function' ? pinta : () => pinta;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry;
      if (u * u + v * v > 1) continue;
      this.punto(x, y, f(u, v, x, y), rampa);
    }
  }
  /* un huevo: una elipse más ancha arriba (ancho = rx * (1 - k * v)) */
  huevo(cx, cy, rx, ry, k, pinta, rampa) {
    const f = typeof pinta === 'function' ? pinta : () => pinta;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const v = (y + 0.5 - cy) / ry; if (v * v > 1) continue;
      const r = rx * (1 - k * v);
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const u = (x + 0.5 - cx) / r;
        if (u * u + v * v > 1) continue;
        this.punto(x, y, f(u, v, x, y), rampa);
      }
    }
  }
  /* rectángulo con esquinas redondeadas (r en píxeles); u, v van de -1 a 1 en la caja */
  caja(x0, y0, x1, y1, r, pinta, rampa) {
    const f = typeof pinta === 'function' ? pinta : () => pinta;
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
      const px = x + 0.5, py = y + 0.5;
      const qx = Math.max(x0 + r - px, 0, px - (x1 - r)), qy = Math.max(y0 + r - py, 0, py - (y1 - r));
      if (qx * qx + qy * qy > r * r) continue;
      this.punto(x, y, f((px - x0) / (x1 - x0) * 2 - 1, (py - y0) / (y1 - y0) * 2 - 1, x, y), rampa);
    }
  }
  /* un trazo grueso con puntas redondas (piernas, brazos, tallos) */
  capsula(x0, y0, x1, y1, r, pinta, rampa) {
    const f = typeof pinta === 'function' ? pinta : () => pinta;
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-6;
    for (let y = Math.floor(Math.min(y0, y1) - r); y <= Math.ceil(Math.max(y0, y1) + r); y++) for (let x = Math.floor(Math.min(x0, x1) - r); x <= Math.ceil(Math.max(x0, x1) + r); x++) {
      const px = x + 0.5, py = y + 0.5;
      const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / L2));
      const ex = px - (x0 + dx * t), ey = py - (y0 + dy * t);
      if (ex * ex + ey * ey > r * r) continue;
      /* u: de un costado al otro del trazo; v: a lo largo */
      const lado = (ex * -dy + ey * dx) / Math.sqrt(L2) / r;
      this.punto(x, y, f(lado, t * 2 - 1, x, y), rampa);
    }
  }
  /* polígono (lista de [x, y]); u, v en la caja que lo contiene */
  poligono(pts, pinta, rampa) {
    const f = typeof pinta === 'function' ? pinta : () => pinta;
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const X0 = Math.min(...xs), X1 = Math.max(...xs), Y0 = Math.min(...ys), Y1 = Math.max(...ys);
    for (let y = Math.floor(Y0); y <= Math.ceil(Y1); y++) for (let x = Math.floor(X0); x <= Math.ceil(X1); x++) {
      const px = x + 0.5, py = y + 0.5;
      let dentro = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro;
      }
      if (dentro) this.punto(x, y, f((px - X0) / (X1 - X0 || 1) * 2 - 1, (py - Y0) / (Y1 - Y0 || 1) * 2 - 1, x, y), rampa);
    }
  }
  linea(x0, y0, x1, y1, c, rampa) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.punto(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c, rampa);
  }
  /* el contorno de color: los píxeles vacíos que tocan la figura toman el tono más oscuro de su rampa */
  contorno(o = {}) {
    const { w, h } = this, nuevos = [];
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
      if (this.hay(x, y)) continue;
      let vecino = -1;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const X = x + dx, Y = y + dy; if (this.hay(X, Y)) { vecino = Y * w + X; break; } }
      if (vecino < 0 || x < 0 || y < 0 || x >= w || y >= h) continue;
      const R = this.rampa[vecino];
      nuevos.push([x, y, o.color || (R ? R[o.tono ?? 0] : mezclar(this.hex[vecino], '#000000', 0.6)), R]);
    }
    for (const [x, y, c, R] of nuevos) this.punto(x, y, c, R);
    return this;
  }
  /* los bordes de adentro entre dos rampas distintas (la cabeza sobre el cuerpo): una línea oscura */
  separar(rampaDe, o = {}) {
    const { w, h } = this, marcar = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (!this.p[i] || this.rampa[i] !== rampaDe) continue;
      const abajo = (y + 1) * w + x;
      if (y + 1 < h && this.p[abajo] && this.rampa[abajo] && this.rampa[abajo] !== rampaDe) marcar.push([x, y + 1, this.rampa[abajo]]);
    }
    for (const [x, y, R] of marcar) this.punto(x, y, R[o.tono ?? 1], R);
    return this;
  }
  /* al canvas (para dibujar con drawImage); espejo = de cara a la izquierda */
  aCanvas(espejo) {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    const g = c.getContext('2d'), img = g.createImageData(this.w, this.h);
    const d = new Uint32Array(img.data.buffer);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) d[y * this.w + (espejo ? this.w - 1 - x : x)] = this.p[y * this.w + x];
    g.putImageData(img, 0, 0);
    return c;
  }
}

/* un canvas cualquiera, con el suavizado apagado (para armar fondos) */
export function lienzo2d(w, h) {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  return [c, g];
}

/* azar con semilla: el mismo mundo cada vez */
export function azar(semilla) {
  let s = (semilla >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

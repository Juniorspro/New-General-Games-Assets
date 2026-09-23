/* ============================================================================
   kuntur/js/vox.js — todo es de cubitos.
   - mallaVox(): una lista de vóxeles (x, y, z, color) hecha malla, con solo
     las caras que dan al aire y sombreado de esquina (el "AO" de los juegos de
     vóxeles: donde se juntan cubos, más oscuro).
   - inflar(): un dibujo de pixel art vuelto volumen. Cada píxel es una
     columna de cubos; cuanto más lejos del borde, más gruesa. Así un sprite 2D
     "toma vida": se ve igual de frente y tiene cuerpo de costado.
   - Lienzo: un pizarrón de píxeles para dibujar cuadros de animación con
     figuras (elipses, líneas, polígonos) sin suavizado.
   ========================================================================== */
import * as THREE from 'three';

const CARAS = [
  { n: [1, 0, 0], v: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], v: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const clave = (x, y, z) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);

/* vox: [{x,y,z,c}] con c un THREE.Color (o [r,g,b] lineales). tam: lado del cubo.
   o.caras: qué caras hacer (por defecto todas las que dan al aire);
   o.sinAtras: no hacer las caras que miran para atrás (-z) */
export function mallaVox(vox, tam, o) {
  o = o || {};
  const lleno = new Set();
  for (const v of vox) lleno.add(clave(v.x, v.y, v.z));
  const hay = (x, y, z) => lleno.has(clave(x, y, z));
  const pos = [], nor = [], col = [], idx = [];
  const ao = o.ao == null ? 0.22 : o.ao;
  for (const v of vox) {
    const r = v.c.r != null ? v.c.r : v.c[0], g = v.c.g != null ? v.c.g : v.c[1], b = v.c.b != null ? v.c.b : v.c[2];
    for (let f = 0; f < 6; f++) {
      const C = CARAS[f], [nx, ny, nz] = C.n;
      if (hay(v.x + nx, v.y + ny, v.z + nz)) continue;
      if (o.sinAtras && nz < 0) continue;
      if (o.sinAbajo && ny < 0) continue;
      const base = pos.length / 3;
      const luces = [];
      for (const [a, bb, cc] of C.v) {
        pos.push((v.x + a) * tam, (v.y + bb) * tam, (v.z + cc) * tam);
        nor.push(nx, ny, nz);
        /* sombreado de esquina: los tres vecinos que tocan este vértice, del lado de afuera */
        let oc = 0;
        if (ao > 0) {
          const na = nx ? 0 : ny ? 1 : 2, ua = na === 0 ? 1 : 0, wa = na === 2 ? 1 : 2;
          const cv = [a, bb, cc], su = cv[ua] ? 1 : -1, sw = cv[wa] ? 1 : -1;
          const o3 = [v.x + nx, v.y + ny, v.z + nz];
          const U = [0, 0, 0], Wv = [0, 0, 0]; U[ua] = su; Wv[wa] = sw;
          const s1 = hay(o3[0] + U[0], o3[1] + U[1], o3[2] + U[2]), s2 = hay(o3[0] + Wv[0], o3[1] + Wv[1], o3[2] + Wv[2]);
          const s3 = hay(o3[0] + U[0] + Wv[0], o3[1] + U[1] + Wv[1], o3[2] + U[2] + Wv[2]);
          oc = s1 && s2 ? 3 : (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s3 ? 1 : 0);
        }
        const k = 1 - oc * ao;
        luces.push(k);
        col.push(r * k, g * k, b * k);
      }
      /* la diagonal que evita la costura rara del AO */
      if (luces[0] + luces[2] < luces[1] + luces[3]) idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
      else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

/* ---------------- el pizarrón de pixel art ---------------- */
export class Lienzo {
  /* cada parte (cabeza, poncho, un brazo) va en su capa, con su grosor y su
     corrimiento en z: así el brazo tapa al poncho de frente, pero el poncho
     sigue entero por detrás */
  constructor(w, h) { this.w = w; this.h = h; this.p = new Array(w * h).fill(null); this.capas = []; this.capa(4, 0); }
  capa(g, z) { this.actual = { g, z: z || 0, m: new Map() }; this.capas.push(this.actual); return this; }
  grosor(g, z) { return this.capa(g, z); }
  /* y crece hacia arriba, como en el mundo: (0,0) es abajo a la izquierda */
  poner(x, y, c, z) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
    const i = y * this.w + x;
    this.p[i] = c;
    this.actual.m.set(i, { c, z: z == null ? this.actual.z : z });
  }
  ver(x, y) { x = Math.round(x); y = Math.round(y); return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.p[y * this.w + x]; }
  borrar(x, y) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.p[y * this.w + x] = null; }
  elipse(cx, cy, rx, ry, c, z) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / (rx + 0.35), dy = (y - cy) / (ry + 0.35);
      if (dx * dx + dy * dy <= 1) this.poner(x, y, typeof c === 'function' ? c(x, y) : c, z);
    }
  }
  rect(x0, y0, x1, y1, c, z) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.poner(x, y, typeof c === 'function' ? c(x, y) : c, z); }
  /* una línea gruesa (para piernas, brazos, trenzas) */
  linea(x0, y0, x1, y1, c, grosor, z) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2));
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
      if (grosor <= 1) this.poner(x, y, c, z);
      else for (let dy = 0; dy < grosor; dy++) for (let dx = 0; dx < grosor; dx++) this.poner(x - (grosor - 1) / 2 + dx, y - (grosor - 1) / 2 + dy, c, z);
    }
  }
  poligono(pts, c, z) {
    const ys = pts.map((p) => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) xs.push(ax + (y + 0.5 - ay) * (bx - ax) / (by - ay));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x <= Math.round(xs[k + 1]) - 1; x++) this.poner(x, y, typeof c === 'function' ? c(x, y) : c, z);
    }
  }
  /* un dibujo a mano: filas de letras, la de arriba primero */
  sello(filas, pal, x0, y0, z, espejo) {
    const h = filas.length;
    filas.forEach((f, r) => { for (let i = 0; i < f.length; i++) { const ch = f[i]; if (ch !== '.' && pal[ch]) this.poner(x0 + (espejo ? f.length - 1 - i : i), y0 + h - 1 - r, pal[ch], z); } });
  }
  /* borde: en cada parte, los píxeles que tocan afuera se oscurecen (el contorno del pixel art) */
  contorno(k) {
    for (const cp of this.capas) {
      const orig = new Map(cp.m);
      for (const [i, v] of orig) {
        const x = i % this.w, y = (i / this.w) | 0;
        const fuera = (a, b) => a < 0 || b < 0 || a >= this.w || b >= this.h || !orig.has(b * this.w + a);
        if (fuera(x + 1, y) || fuera(x - 1, y) || fuera(x, y + 1) || fuera(x, y - 1)) cp.m.set(i, { c: oscurecer(v.c, k), z: v.z });
      }
    }
    /* la vista plana: la última capa manda */
    this.p.fill(null);
    for (const cp of this.capas) for (const [i, v] of cp.m) this.p[i] = v.c;
  }
}
const cacheOsc = new Map();
export function oscurecer(hex, k) {
  const q = hex + k;
  if (cacheOsc.has(q)) return cacheOsc.get(q);
  const c = new THREE.Color(hex).multiplyScalar(k), r = '#' + c.getHexString();
  cacheOsc.set(q, r);
  return r;
}

/* el pixel art vuelto volumen. o.grueso: medio grosor máximo (en cubos);
   o.base: medio grosor en el borde. Cada píxel puede traer un corrimiento en
   z (lo de adelante, más adelante: el brazo del lado de la cámara, por ejemplo) */
export function inflar(lz, o) {
  o = o || {};
  const W = lz.w, H = lz.h;
  const todo = new Map(), cc = new Map();
  const key = (x, y, z) => ((x + 64) * 256 + (y + 64)) * 256 + (z + 128);
  for (const cp of lz.capas) {
    if (!cp.m.size) continue;
    const g0 = cp.g;
    for (const [i, v] of cp.m) {
      const x = i % W, y = (i / W) | 0;
      /* en el borde de la parte, un cubo menos adelante y atrás: queda biselado */
      const borde = !cp.m.has(i + 1) || !cp.m.has(i - 1) || !cp.m.has(i + W) || !cp.m.has(i - W);
      const g = Math.max(0.5, borde && g0 > 1 ? g0 - 1 : g0);
      let c = cc.get(v.c);
      if (!c) { c = new THREE.Color(v.c); cc.set(v.c, c); }
      const z0 = Math.round(v.z - g), z1 = Math.round(v.z + g);
      for (let z = z0; z < z1; z++) todo.set(key(x, y, z), { x: x - (o.ox || 0), y: y - (o.oy || 0), z, c });
    }
  }
  return [...todo.values()];
}

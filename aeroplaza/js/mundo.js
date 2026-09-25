/* ============================================================================
   aeroplaza/js/mundo.js — lo que el muñeco pisa y contra lo que choca.
   Sin motor de física: el suelo es una función altura(x, z) (el terreno de
   cada reino) más una lista de sólidos simples (cilindros y cajas giradas) con
   su techo caminable. Alcanza para todo lo que hay acá y cuesta nada.
   Además guarda las cosas con las que se interactúa (tecla E / botón ✋):
   carteles, NPC, la estación, las burbujas, los delfines…
   ========================================================================== */
import * as THREE from 'three';

const NADA = [];
export class Mundo {
  constructor(altura = () => 0) {
    this.altura = altura;
    this.solidos = [];
    this.interactivos = [];
    this.agua = null;            // la altura del agua, o null si no hay
    this.limite = 160;           // hasta dónde se puede ir desde el centro
    this.centro = new THREE.Vector2(0, 0);
    this.gravedad = 24;
  }
  /* c: cilindro. rebote: los hongos y flores que hacen saltar. tipo: para el sonido de los pasos */
  cilindro(x, z, r, y0, y1, o = {}) { const s = { t: 'c', x, z, r, y0, y1, ...o }; this.solidos.push(s); this._rejilla = null; return s; }
  /* b: caja girada rot radianes sobre el eje y */
  caja(x, z, hx, hz, y0, y1, rot = 0, o = {}) { const s = { t: 'b', x, z, hx, hz, y0, y1, rot, c: Math.cos(rot), s: Math.sin(rot), ...o }; this.solidos.push(s); this._rejilla = null; return s; }
  interactivo(o) { this.interactivos.push(o); return o; }
  quitar(s) { const i = this.solidos.indexOf(s); if (i >= 0) this.solidos.splice(i, 1); this._rejilla = null; }
  /* con el mundo grande hay cientos de sólidos (árboles, pilares): se guardan en
     una rejilla de 16 m y cada consulta mira solo su casilla. Cada sólido va en
     todas las casillas que toca, agrandado 1,5 m (lo más que empuja una consulta) */
  cerca(x, z) {
    if (!this._rejilla) {
      const R = this._rejilla = new Map();
      for (const s of this.solidos) {
        const e = (s.t === 'c' ? s.r : Math.hypot(s.hx, s.hz)) + 1.5;
        for (let i = Math.floor((s.x - e) / 16); i <= Math.floor((s.x + e) / 16); i++) for (let j = Math.floor((s.z - e) / 16); j <= Math.floor((s.z + e) / 16); j++) {
          const k = i * 4096 + j; let l = R.get(k); if (!l) R.set(k, (l = [])); l.push(s);
        }
      }
    }
    return this._rejilla.get(Math.floor(x / 16) * 4096 + Math.floor(z / 16)) || NADA;
  }
  /* ¿hay algo sólido en este punto? (para que la cámara no se meta adentro de las casas) */
  tapa(x, y, z) {
    for (const s of this.cerca(x, z)) if (!s.fantasma && !s.pasaCamara && (s.t === 'b' || s.r > 0.6) && y > s.y0 && y < s.y1 + 0.2 && this.dentro(s, x, z, 0.15)) return true;
    return false;
  }

  /* ¿el punto (x, z) cae dentro del sólido (agrandado r)? */
  dentro(s, x, z, r = 0) {
    if (s.t === 'c') { const dx = x - s.x, dz = z - s.z; return dx * dx + dz * dz < (s.r + r) * (s.r + r); }
    const dx = x - s.x, dz = z - s.z, lx = dx * s.c - dz * s.s, lz = dx * s.s + dz * s.c;
    return Math.abs(lx) < s.hx + r && Math.abs(lz) < s.hz + r;
  }
  /* el suelo bajo (x, z) que está por debajo de y + paso: el terreno o el techo de un sólido */
  suelo(x, z, y, paso = 0.45) {
    let h = this.altura(x, z), cual = null;
    for (const s of this.cerca(x, z)) {
      if (s.fantasma || s.y1 > y + paso || s.y1 < h) continue;
      if (this.dentro(s, x, z, s.t === 'c' ? -0.05 : -0.02)) { h = s.y1; cual = s; }
    }
    return { y: h, s: cual };
  }
  /* un techo sobre la cabeza (para no atravesar los aleros saltando) */
  techo(x, z, y, alto) {
    let h = Infinity;
    for (const s of this.cerca(x, z)) if (!s.fantasma && !s.sinTecho && s.y0 > y + 0.2 && s.y0 < y + alto + 0.3 && this.dentro(s, x, z)) h = Math.min(h, s.y0);
    return h;
  }
  /* saca un círculo de radio r (que va de y a y+alto) de adentro de los sólidos */
  empujar(p, r, alto) {
    for (const s of this.cerca(p.x, p.z)) {
      if (s.fantasma || s.y1 <= p.y + 0.46 || s.y0 >= p.y + alto) continue;
      if (s.t === 'c') {
        const dx = p.x - s.x, dz = p.z - s.z, d2 = dx * dx + dz * dz, R = s.r + r;
        if (d2 < R * R) { const d = Math.sqrt(d2) || 1e-4; p.x = s.x + dx / d * R; p.z = s.z + dz / d * R; }
      } else {
        const dx = p.x - s.x, dz = p.z - s.z;
        let lx = dx * s.c - dz * s.s, lz = dx * s.s + dz * s.c;
        const ex = s.hx + r - Math.abs(lx), ez = s.hz + r - Math.abs(lz);
        if (ex > 0 && ez > 0) {
          if (ex < ez) lx = Math.sign(lx || 1) * (s.hx + r); else lz = Math.sign(lz || 1) * (s.hz + r);
          p.x = s.x + lx * s.c + lz * s.s; p.z = s.z - lx * s.s + lz * s.c;
        }
      }
    }
    /* el borde del reino: una pared blanda */
    const dx = p.x - this.centro.x, dz = p.z - this.centro.y, d = Math.hypot(dx, dz);
    if (d > this.limite) { p.x = this.centro.x + dx / d * this.limite; p.z = this.centro.y + dz / d * this.limite; }
  }
  /* lo interactivo más cercano a p, a menos de su radio */
  cercano(p) {
    let mejor = null, md = Infinity;
    for (const o of this.interactivos) {
      if (o.activo === false) continue;
      const q = typeof o.pos === 'function' ? o.pos() : o.pos;
      const d = Math.hypot(q.x - p.x, q.z - p.z) + Math.abs((q.y ?? p.y) - p.y) * 0.5;
      if (d < (o.radio || 2.2) && d < md) { md = d; mejor = o; }
    }
    return mejor;
  }
}

/* números al azar que se repiten (la isla sale igual para todos los jugadores) */
export function azar(sem = 1) {
  let s = sem >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
/* ruido de valor 2D suave, para el terreno */
export function ruido2(sem = 7) {
  const P = new Uint8Array(512), r = azar(sem);
  for (let i = 0; i < 256; i++) P[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [P[i], P[j]] = [P[j], P[i]]; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const g = (h) => h / 255 * 2 - 1;
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = g(P[P[X] + Y]), b = g(P[P[X + 1] + Y]), c = g(P[P[X] + Y + 1]), d = g(P[P[X + 1] + Y + 1]);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
export const suaveEntre = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// El jugo: partículas de a píxel, anillos que se abren, textos que suben, la
// sacudida y el destello. Todo en coordenadas del mundo (píxeles del lienzo
// chico); el que dibuja pasa la cámara.
import { texto } from './fuente.js';

export class Efectos {
  constructor() {
    this.parts = [];
    this.anillos = [];
    this.textos = [];
    this.sacudida = 0;
    this.sx = 0; this.sy = 0;
    this.flash = null;       // { color, vida, total }
  }

  // Una lluvia de píxeles. `col` puede ser una lista (se elige al azar).
  chispazo(x, y, { n = 8, col = '#fff', vel = 40, vida = 0.45, tam = 1, grav = 0, friccion = 3.5, dx = 0, dy = 0, abanico = Math.PI * 2 } = {}) {
    const base = Math.atan2(dy, dx);
    for (let k = 0; k < n; k++) {
      const a = (dx || dy) ? base + (Math.random() - 0.5) * abanico : Math.random() * Math.PI * 2;
      const v = vel * (0.4 + Math.random() * 0.8);
      this.parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: vida * (0.6 + Math.random() * 0.6), t: 0,
        col: Array.isArray(col) ? col[(Math.random() * col.length) | 0] : col, tam, grav, friccion,
      });
    }
  }

  // Una partícula suelta con todo a mano (la estela, el polvo que sube).
  una(p) { this.parts.push({ t: 0, tam: 1, grav: 0, friccion: 0, ...p }); }

  anillo(x, y, { r0 = 1, r1 = 10, vida = 0.3, col = '#fff' } = {}) { this.anillos.push({ x, y, r0, r1, vida, t: 0, col }); }

  flotante(x, y, txt, col = '#fff', { vida = 0.8, sube = 14 } = {}) { this.textos.push({ x, y, txt, col, vida, t: 0, sube }); }

  sacudir(n) { this.sacudida = Math.max(this.sacudida, n); }

  destellar(color, vida = 0.12) { this.flash = { color, vida, total: vida }; }

  pasar(dt) {
    for (const p of this.parts) {
      p.t += dt;
      const f = Math.exp(-p.friccion * dt);
      p.vx *= f; p.vy = p.vy * f + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.t < p.vida);
    for (const a of this.anillos) a.t += dt;
    this.anillos = this.anillos.filter((a) => a.t < a.vida);
    for (const t of this.textos) t.t += dt;
    this.textos = this.textos.filter((t) => t.t < t.vida);
    // la sacudida baja ×0,86 por cuadro (a 60 Hz) y salta de a píxel entero
    this.sacudida *= Math.pow(0.86, dt * 60);
    if (this.sacudida < 0.3) this.sacudida = 0;
    const s = Math.round(this.sacudida);
    this.sx = s ? Math.round((Math.random() * 2 - 1) * s) : 0;
    this.sy = s ? Math.round((Math.random() * 2 - 1) * s) : 0;
    if (this.flash && (this.flash.vida -= dt) <= 0) this.flash = null;
  }

  // (cx, cy): dónde está la cámara (el píxel del mundo que cae en 0, 0).
  dibujar(g, cx, cy) {
    for (const p of this.parts) {
      const k = p.t / p.vida;
      if (k > 0.7 && ((p.t * 30) | 0) % 2) continue;     // parpadea antes de apagarse
      g.fillStyle = p.col;
      const tam = p.tam > 1 && k > 0.5 ? p.tam - 1 : p.tam;
      g.fillRect(Math.round(p.x - cx - tam / 2), Math.round(p.y - cy - tam / 2), tam, tam);
    }
    for (const a of this.anillos) {
      const k = a.t / a.vida, r = a.r0 + (a.r1 - a.r0) * (1 - (1 - k) * (1 - k));
      g.fillStyle = a.col;
      const pasos = Math.max(8, Math.round(r * 5));
      for (let i = 0; i < pasos; i++) {
        if (k > 0.6 && i % 2) continue;
        const ang = (i / pasos) * Math.PI * 2;
        g.fillRect(Math.round(a.x - cx + Math.cos(ang) * r), Math.round(a.y - cy + Math.sin(ang) * r), 1, 1);
      }
    }
    for (const t of this.textos) {
      const k = t.t / t.vida;
      if (k > 0.75 && ((t.t * 24) | 0) % 2) continue;
      const sube = t.sube * (1 - (1 - k) * (1 - k));
      texto(g, t.txt, t.x - cx, t.y - cy - sube, t.col, { alinear: 'centro', borde: '#05040b' });
    }
  }

  dibujarFlash(g, W, H) {
    if (!this.flash) return;
    g.globalAlpha = Math.min(1, this.flash.vida / this.flash.total) * 0.8;
    g.fillStyle = this.flash.color;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }

  vaciar() { this.parts = []; this.anillos = []; this.textos = []; this.sacudida = 0; this.flash = null; }
}

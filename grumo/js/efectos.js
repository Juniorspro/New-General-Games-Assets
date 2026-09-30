// Las partículas, también de plastilina y también a 12 cuadros: migas que
// saltan cuando Grumo se aplasta o un bloque se desarma, polvo al caer
// fuerte, estrellitas al llegar a la puerta y el "puf" de lo que aparece o
// desaparece. Se mueven solo en los cuadros del mundo (de a saltitos).
import { azar, tono, rgba } from './util.js';

export class Efectos {
  constructor() { this.cosas = []; this.r = azar(4242); this.reloj = 0; }
  // x, y en celdas
  migas(x, y, n, colores, { vel = 5, arriba = 3, tam = 0.12, vida = 0.9 } = {}) {
    const r = this.r;
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, v = vel * (0.4 + r() * 0.6);
      this.cosas.push({ tipo: 'miga', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - arriba, t: 0, vida: vida * (0.7 + r() * 0.5), color: colores[k % colores.length], tam: tam * (0.6 + r() * 0.8), giro: r() * 6 });
    }
  }
  polvo(x, y, n = 5, { ancho = 0.5 } = {}) {
    const r = this.r;
    for (let k = 0; k < n; k++) this.cosas.push({ tipo: 'polvo', x: x + (r() - 0.5) * ancho, y, vx: (r() - 0.5) * 2.4, vy: -r() * 0.8, t: 0, vida: 0.4 + r() * 0.2, tam: 0.12 + r() * 0.1 });
  }
  puf(x, y, { tam = 0.6, color = '#ffffff' } = {}) {
    const r = this.r;
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + r() * 0.3; this.cosas.push({ tipo: 'polvo', x: x + Math.cos(a) * tam * 0.3, y: y + Math.sin(a) * tam * 0.3, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, t: 0, vida: 0.35, tam: tam * 0.35, color }); }
  }
  chispas(x, y, n = 10) {
    const r = this.r;
    for (let k = 0; k < n; k++) { const a = r() * Math.PI * 2, v = 2 + r() * 3; this.cosas.push({ tipo: 'chispa', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, t: 0, vida: 0.7 + r() * 0.3, tam: 0.12 + r() * 0.08, color: ['#ffd24a', '#ffffff', '#ff9ec4'][k % 3] }); }
  }
  // avanzar: las partículas se mueven de a cuadros de 1/12 (el mundo del stop motion)
  pasar(dt) {
    this.reloj += dt;
    while (this.reloj >= 1 / 12) {
      this.reloj -= 1 / 12;
      const d = 1 / 12;
      for (const c of this.cosas) {
        c.t += d; c.x += c.vx * d; c.y += c.vy * d;
        if (c.tipo === 'miga') { c.vy += 26 * d; c.giro += 3; }
        else if (c.tipo === 'chispa') { c.vy += 6 * d; c.vx *= 0.85; }
        else { c.vx *= 0.7; c.vy *= 0.7; c.tam *= 1.12; }
      }
      this.cosas = this.cosas.filter((c) => c.t < c.vida);
    }
  }
  dibujar(g, cam) {
    const { ts } = cam;
    for (const c of this.cosas) {
      const x = cam.x + c.x * ts, y = cam.y + c.y * ts, k = 1 - c.t / c.vida;
      if (c.tipo === 'miga') {
        const r = c.tam * ts;
        g.fillStyle = rgba('#000000', 0.15); g.beginPath(); g.ellipse(x + r * 0.2, y + r * 0.3, r, r * 0.8, c.giro, 0, Math.PI * 2); g.fill();
        g.fillStyle = c.color; g.beginPath(); g.ellipse(x, y, r, r * 0.8, c.giro, 0, Math.PI * 2); g.fill();
        g.fillStyle = rgba(tono(c.color, 0.5), 0.6); g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2); g.fill();
      } else if (c.tipo === 'chispa') {
        const r = c.tam * ts * (0.5 + k * 0.5);
        g.fillStyle = c.color; g.beginPath();
        for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.35 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        g.fill();
      } else {
        g.fillStyle = rgba(c.color || '#f4eadc', 0.55 * k); g.beginPath(); g.arc(x, y, c.tam * ts, 0, Math.PI * 2); g.fill();
      }
    }
  }
}

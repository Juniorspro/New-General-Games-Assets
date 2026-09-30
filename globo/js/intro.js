// La intro de JXSTUDIOS con el estilo de Globo Libre: plana y de colores (la
// de Cripta es de píxeles y la de Víbora de metal; cada juego la suya).
// Tres barridos de color abren un fondo azul; el ESCUDO del juego escribe el
// monograma JXS en blanco, trazo por trazo; un globo sube, choca el logo desde
// abajo (el logo salta y larga papel picado) y se va volando; la palabra
// JXStudios aparece letra por letra y un círculo del color del cielo tapa todo
// para dar paso al menú. Dura menos de tres segundos y arranca sola
// (main.js); la música sale de sonido.js › jingleJXS con el mismo reloj.
import { TRAZOS, CAJA, GROSOR, camino2d, muestrear } from './logojxs.js';
import { dibujarGlobo, dibujarEscudo } from './dibujo.js';
import { clamp, salida, suave, elastico, azar } from './util.js';

export const T = { barridos: [0, 0.5], traza: [0.45, 1.3], sube: [1.28, 1.5], golpe: 1.5, letras: 1.62, presenta: 2.1, fin: 2.55, cierre: 0.4, salto: 0.3 };
const FONDO = '#2f6bff', SOMBRA = '#1c47c4', CIELO = '#9fd8ff';
const CONFETI = ['#ffd23f', '#ff5d8f', '#2ecc9a', '#ffffff', '#ff9f43'];

// el largo de cada trazo y sus puntos, para saber dónde va la punta
const MUESTRAS = TRAZOS.map((tr) => {
  const p = muestrear(tr, 2), acum = [0];
  for (let i = 1; i < p.length; i++) acum.push(acum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  return { p, acum, largo: acum[acum.length - 1] };
});
// el orden en que los escribe el escudo (A, J, S y B arriba de todo)
const ORDEN = [0, 1, 2, 3];
const TOTAL = MUESTRAS.reduce((a, m) => a + m.largo, 0);

function punta(i, avance) {
  const { p, acum, largo } = MUESTRAS[i], meta = largo * avance;
  let k = 1;
  while (k < acum.length - 1 && acum[k] < meta) k++;
  return p[k];
}

export class IntroJXS {
  constructor({ sonido, vibrar = () => {}, alTerminar }) {
    this.t = 0; this.terminado = false; this.golpeado = false;
    this.alTerminar = alTerminar; this.vibrar = vibrar;
    this.musica = sonido.jingleJXS?.() || null;
    this.papeles = []; this.pops = [];
    this.r = azar(2026);
  }
  saltear() {
    if (this.t < T.salto || this.terminado) return;
    this.musica?.cortar();
    this.t = Math.max(this.t, T.fin);
  }
  // cuánto lleva escrito cada trazo (se escriben de a uno, a velocidad pareja)
  avances() {
    const k = clamp((this.t - T.traza[0]) / (T.traza[1] - T.traza[0]), 0, 1), hecho = suave(k) * TOTAL;
    let antes = 0;
    return ORDEN.map((i) => { const l = MUESTRAS[i].largo, a = clamp((hecho - antes) / l, 0, 1); antes += l; return a; });
  }
  medidas(W, H) {
    const ancho = Math.min(W * 0.74, H * 0.9, 640), esc = ancho / CAJA.w;
    return { ancho, esc, x0: W / 2 - ancho / 2, y0: H * 0.42 - (CAJA.h * esc) / 2 };
  }
  pasar(dt, W, H) {
    this.t += dt;
    const { ancho, x0, y0, esc } = this.medidas(W, H), r = this.r;
    // lo que va dejando el escudo al escribir: burbujitas
    const av = this.avances(), i = av.findIndex((a) => a > 0 && a < 1);
    if (i >= 0 && r() < 0.8) {
      const [px, py] = punta(ORDEN[i], av[i]);
      this.pops.push({ x: x0 + px * esc, y: y0 + py * esc, t: 0, r: (2 + r() * 4) * esc * 2, color: CONFETI[(r() * CONFETI.length) | 0] });
    }
    if (!this.golpeado && this.t >= T.golpe) {
      this.golpeado = true;
      this.vibrar([25, 30, 25]);
      for (let k = 0; k < 110; k++) {
        const a = -Math.PI / 2 + (r() - 0.5) * 2.6, v = (220 + r() * 520) * (ancho / 500);
        this.papeles.push({ x: W / 2 + (r() - 0.5) * ancho * 0.5, y: y0 + CAJA.h * esc * 0.8, vx: Math.cos(a) * v, vy: Math.sin(a) * v, a: r() * 6, giro: (r() - 0.5) * 16, t: 0, vida: 1.2 + r() * 0.8, color: CONFETI[k % CONFETI.length], w: (4 + r() * 5) * (ancho / 500), redondo: r() < 0.3 });
      }
    }
    for (const p of this.papeles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 1.6; p.vy = p.vy * (1 - dt * 1.6) + 520 * (ancho / 500) * dt; p.a += p.giro * dt; }
    this.papeles = this.papeles.filter((p) => p.t < p.vida);
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < 0.5);
    if (this.t >= T.fin + T.cierre && !this.terminado) { this.terminado = true; this.alTerminar?.(); }
  }

  dibujar(g, W, H) {
    const t = this.t, { ancho, esc, x0, y0 } = this.medidas(W, H);
    g.save();
    // 1) los barridos de color, en diagonal, y el fondo azul que queda
    g.fillStyle = CIELO; g.fillRect(0, 0, W, H);
    const bandas = [['#ffd23f', 0], ['#ff5d8f', 0.09], [FONDO, 0.18]];
    for (const [col, retraso] of bandas) {
      const k = salida(clamp((t - retraso) / 0.32, 0, 1));
      if (k <= 0) continue;
      const d = Math.hypot(W, H) * 1.2;
      g.save(); g.translate(W / 2, H / 2); g.rotate(-0.5);
      g.fillStyle = col; g.fillRect(-d / 2, -d / 2, d * k, d);
      g.restore();
    }
    // círculos grandes y claros que flotan en el azul
    if (t > 0.3) {
      g.globalAlpha = clamp((t - 0.3) / 0.3, 0, 1) * 0.12; g.fillStyle = '#ffffff';
      for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(W * ((k * 0.23 + 0.1 + t * 0.02) % 1.1), H * (0.15 + ((k * 0.37) % 0.8)), Math.min(W, H) * (0.08 + (k % 3) * 0.05), 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
    }
    // 2) el monograma: se escribe en blanco con su sombra plana; salta con el golpe
    const av = this.avances();
    const golpe = t >= T.golpe ? clamp((t - T.golpe) / 0.6, 0, 1) : 0;
    const salto = golpe > 0 ? Math.sin(golpe * Math.PI) * (1 - golpe) * 0.5 : 0;
    const estira = golpe > 0 ? 1 + (1 - elastico(golpe)) * -0.12 : 1;
    g.save();
    g.translate(W / 2, y0 + CAJA.h * esc * 0.5 - salto * ancho * 0.25);
    g.scale(1 / estira, estira);
    g.translate(-W / 2, -(y0 + CAJA.h * esc * 0.5));
    for (const capa of [0, 1]) TRAZOS.forEach((tr, i) => {
      if (tr.capa !== capa || av[i] <= 0) return;
      const p = camino2d(tr, esc, x0, y0), l = MUESTRAS[i].largo * esc;
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.setLineDash(av[i] < 1 ? [Math.max(0.01, l * av[i]), l + 10] : []);
      g.save(); g.translate(3 * esc, 6 * esc); g.lineWidth = GROSOR * esc; g.strokeStyle = SOMBRA; g.stroke(p); g.restore();
      // el borde azul abre el hueco del cruce: se ve que B pasa por encima de A
      if (capa === 1) { g.lineWidth = GROSOR * esc + 7 * esc; g.strokeStyle = FONDO; g.stroke(p); }
      g.lineWidth = GROSOR * esc; g.strokeStyle = '#ffffff'; g.stroke(p);
    });
    g.setLineDash([]);
    g.restore();
    // las burbujitas y el escudo que escribe
    for (const p of this.pops) { g.globalAlpha = 1 - p.t / 0.5; g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y - p.t * 20 * esc, p.r * (1 - p.t), 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
    const i = av.findIndex((a) => a > 0 && a < 1);
    const escribe = t > T.traza[0] - 0.08 && t < T.traza[1] + 0.25;
    if (escribe) {
      const k = i >= 0 ? i : t < T.traza[0] ? 0 : 3, [px, py] = i >= 0 ? punta(k, av[k]) : punta(k, t < T.traza[0] ? 0 : 1);
      const aparece = clamp((t - (T.traza[0] - 0.08)) / 0.1, 0, 1), se_va = clamp((t - T.traza[1]) / 0.25, 0, 1);
      g.globalAlpha = aparece * (1 - se_va);
      dibujarEscudo(g, x0 + px * esc, y0 + py * esc - se_va * 40 * esc, 17 * esc * (1 + se_va * 0.5), { color: '#ffffff', relleno: 'rgba(255,255,255,0.3)' }, t * 2);
      g.globalAlpha = 1;
    }
    // 3) el globo: sube, choca el logo desde abajo y se va volando
    if (t > T.sube[0]) {
      const r = ancho * 0.075, xb = W / 2 + ancho * 0.08;
      let yb;
      if (t < T.golpe) yb = H + r * 3 - (H + r * 3 - (y0 + CAJA.h * esc + r * 1.1)) * salida((t - T.sube[0]) / (T.golpe - T.sube[0]));
      else { const k = (t - T.golpe) / 1.1; yb = y0 + CAJA.h * esc + r * 1.1 + Math.sin(Math.min(1, k * 3) * Math.PI) * r * 0.4 - k * k * H * 1.3; }
      const xx = t < T.golpe ? xb : xb + ((t - T.golpe) ** 2) * ancho * 0.5 + Math.sin(t * 7) * r * 0.1;
      const aplasta = t >= T.golpe && t < T.golpe + 0.18 ? 1 - Math.sin(((t - T.golpe) / 0.18) * Math.PI) * 0.2 : 1;
      g.save(); g.translate(xx, yb); g.scale(1 / aplasta, aplasta);
      dibujarGlobo(g, 0, 0, r, { color: '#ff4d5e' }, t, { hilo: r * 3, inclina: t > T.golpe ? 0.25 : 0 });
      g.restore();
    }
    // el papel picado
    for (const p of this.papeles) {
      g.globalAlpha = Math.min(1, (p.vida - p.t) * 3);
      g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.color;
      if (p.redondo) { g.beginPath(); g.arc(0, 0, p.w * 0.5, 0, Math.PI * 2); g.fill(); } else g.fillRect(-p.w / 2, -p.w * 0.3, p.w, p.w * 0.6);
      g.restore();
    }
    g.globalAlpha = 1;
    // 4) JXStudios, letra por letra, y "presenta"
    if (t > T.letras) {
      const px = Math.round(ancho * 0.13), txt = 'JXStudios';
      g.font = `900 ${px}px system-ui, -apple-system, "Segoe UI", Roboto, "Arial Black", sans-serif`;
      g.textBaseline = 'middle'; g.textAlign = 'left';
      const anchos = [...txt].map((ch) => g.measureText(ch).width), total = anchos.reduce((a, b) => a + b, 0);
      let x = W / 2 - total / 2;
      const y = y0 + CAJA.h * esc + ancho * 0.16;
      [...txt].forEach((ch, k) => {
        const e = elastico(clamp((t - T.letras - k * 0.045) / 0.5, 0, 1));
        if (e > 0) {
          g.save(); g.translate(x + anchos[k] / 2, y); g.scale(e, e);
          g.fillStyle = SOMBRA; g.fillText(ch, -anchos[k] / 2 + px * 0.04, px * 0.07);
          g.fillStyle = '#ffffff'; g.fillText(ch, -anchos[k] / 2, 0);
          g.restore();
        }
        x += anchos[k];
      });
      if (t > T.presenta && this.textoPresenta) {
        g.globalAlpha = clamp((t - T.presenta) / 0.25, 0, 1) * 0.85;
        g.font = `700 ${Math.round(px * 0.34)}px system-ui, sans-serif`; g.textAlign = 'center';
        g.fillStyle = '#ffffff'; g.fillText(this.textoPresenta, W / 2, y + px * 0.75);
        g.globalAlpha = 1;
      }
    }
    // 5) el cierre: un círculo del color del cielo que crece desde el logo
    if (t > T.fin) {
      const k = salida(clamp((t - T.fin) / T.cierre, 0, 1));
      g.fillStyle = CIELO; g.beginPath(); g.arc(W / 2, H * 0.42, Math.hypot(W, H) * k, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
}

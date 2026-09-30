// La intro de JXSTUDIOS con el estilo de Grumo: de plastilina y en stop
// motion (la de Cripta es de píxeles, la de Víbora de metal, la de Globo
// plana de colores, la de Morfi de papel: cada juego la suya). Todo va a 12
// cuadros por segundo, como una animación de verdad: se prende la lámpara
// del set, cuatro bolitas de plastilina se estiran en chorizos que dibujan
// el monograma JXS trazo por trazo, el dedo del animador lo aprieta (¡bup!)
// y lo deja bien plantado, JXStudios cae letra por letra, "presenta" se
// escribe con un palillo y la cámara saca la foto (flash y obturador). Dura
// menos de tres segundos y medio y arranca sola (main.js); la música sale de
// sonido.js › jingleJXS con el mismo reloj.
import { TRAZOS, CAJA, GROSOR, camino2d, muestrear } from './logojxs.js';
import { clamp, azar, hash, tono, rgba, salida } from './util.js';
import { lienzo, guardado, olvidar, pintarGrano, vineta } from './plastilina.js';
import { dibujarMano } from './mano.js';

export const T = { luz: 0.25, rollo: [0.42, 1.3], dedo: 1.34, aprieta: 1.5, letras: 1.68, cadaLetra: 1 / 12, presenta: 2.48, flash: 2.9, fin: 3.05, cierre: 0.35, salto: 0.3 };
const COLORES = { A: '#e4553f', J: '#f2c230', S: '#4f95e8', B: '#48b06f' };
const LETRAS = ['#f2c230', '#e4553f', '#4f95e8', '#48b06f'];
export const MESA = '#6b4a30';

const MUESTRAS = TRAZOS.map((tr) => {
  const p = muestrear(tr, 2), acum = [0];
  for (let i = 1; i < p.length; i++) acum.push(acum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  return { p, acum, largo: acum[acum.length - 1] };
});
const ORDEN = [1, 2, 0, 3];                 // J, S, y después las dos diagonales
const TOTAL = MUESTRAS.reduce((a, m) => a + m.largo, 0);
function punta(i, avance) {
  const { p, acum, largo } = MUESTRAS[i], meta = largo * avance;
  let k = 1;
  while (k < acum.length - 1 && acum[k] < meta) k++;
  return p[k];
}

// la mesa del animador: tablones de madera con veta (una vez por tamaño)
export function mesa(W, H) {
  return guardado(`mesa:${W}x${H}`, () => {
    olvidar('mesa:');
    const c = lienzo(W, H), g = c.getContext('2d'), r = azar(8), u = Math.min(W, H) / 400;
    g.fillStyle = MESA; g.fillRect(0, 0, W, H);
    const alto = 46 * u;
    for (let y = 0, k = 0; y < H; y += alto, k++) {
      g.fillStyle = k % 2 ? 'rgba(255,220,170,0.05)' : 'rgba(0,0,0,0.06)'; g.fillRect(0, y, W, alto);
      g.fillStyle = 'rgba(30,15,5,0.35)'; g.fillRect(0, y, W, 1.5 * u);
      g.strokeStyle = 'rgba(40,20,5,0.18)'; g.lineWidth = 1.2 * u;
      for (let v = 0; v < 4; v++) {
        const yy = y + alto * (0.2 + v * 0.2), fase = r() * 6;
        g.beginPath(); for (let x = 0; x <= W; x += 8 * u) g.lineTo(x, yy + Math.sin(x / (60 * u) + fase) * 3 * u); g.stroke();
      }
      if (r() < 0.6) { const x = r() * W; g.fillStyle = 'rgba(40,20,5,0.25)'; g.beginPath(); g.ellipse(x, y + alto * 0.5, 8 * u, 4 * u, 0, 0, Math.PI * 2); g.fill(); }
    }
    return c;
  });
}
// la luz de la lámpara sobre la mesa (lo de afuera, en penumbra)
function luzLampara(g, W, H, cx, cy, k) {
  const gr = g.createRadialGradient(cx, cy, Math.min(W, H) * 0.1, cx, cy, Math.hypot(W, H) * 0.6);
  gr.addColorStop(0, `rgba(255,230,180,${0.16 * k})`); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(10,5,0,${0.55 + (1 - k) * 0.4})`);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}

// un chorizo de plastilina a lo largo de un camino, hasta `avance`: sombra,
// el color, la luz de arriba y el brillo (cuatro pasadas del mismo trazo)
function chorizo(g, camino, largo, avance, ancho, color, temblor) {
  const dash = avance < 1 ? [Math.max(0.01, largo * avance), largo + 10] : [];
  const pasada = (lw, estilo, dx, dy) => { g.save(); g.translate(dx, dy); g.setLineDash(dash); g.lineWidth = lw; g.strokeStyle = estilo; g.stroke(camino); g.restore(); };
  g.lineCap = 'round'; g.lineJoin = 'round';
  pasada(ancho * 1.05, 'rgba(30,15,5,0.4)', ancho * 0.18, ancho * 0.32);
  pasada(ancho, tono(color, -0.35), 0, 0);
  pasada(ancho * 0.84, color, -ancho * 0.03 + temblor, -ancho * 0.05);
  pasada(ancho * 0.42, tono(color, 0.28), -ancho * 0.12, -ancho * 0.16);
  pasada(ancho * 0.12, 'rgba(255,255,255,0.55)', -ancho * 0.2, -ancho * 0.24);
}

export class IntroJXS {
  constructor({ sonido, vibrar = () => {}, alTerminar }) {
    this.t = 0; this.terminado = false; this.apreto = false;
    this.alTerminar = alTerminar; this.vibrar = vibrar;
    this.musica = sonido.jingleJXS?.() || null;
    this.migas = []; this.r = azar(2026);
    this.textoPresenta = 'presenta';
  }
  saltear() {
    if (this.t < T.salto || this.terminado) return;
    this.musica?.cortar();
    this.t = Math.max(this.t, T.fin);
  }
  avances(t) {
    const k = clamp((t - T.rollo[0]) / (T.rollo[1] - T.rollo[0]), 0, 1), hecho = k * TOTAL;
    const out = [0, 0, 0, 0];
    let antes = 0;
    for (const i of ORDEN) { const l = MUESTRAS[i].largo; out[i] = clamp((hecho - antes) / l, 0, 1); antes += l; }
    return out;
  }
  pasar(dt, W, H) {
    this.t += dt;
    const tq = Math.floor(this.t * 12) / 12;
    if (!this.apreto && tq >= T.aprieta) {
      this.apreto = true; this.vibrar([15, 20, 15]);
      const r = this.r;
      for (let k = 0; k < 26; k++) {
        const a = -Math.PI / 2 + (r() - 0.5) * 2.6, v = 120 + r() * 260;
        this.migas.push({ x: (r() - 0.5) * CAJA.w * 0.8, y: CAJA.h * (0.3 + r() * 0.4), vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, color: Object.values(COLORES)[k % 4], r: 3 + r() * 5 });
      }
    }
    if (this.t >= T.fin + T.cierre && !this.terminado) { this.terminado = true; this.alTerminar?.(); }
  }
  dibujar(g, W, H) {
    // el reloj de la animación: 12 fotos por segundo, nada entre medio
    const cuadro = Math.floor(this.t * 12), t = cuadro / 12;
    g.save();
    g.drawImage(mesa(W, H), 0, 0);
    const ancho = Math.min(W * 0.72, H * 0.9, 560), esc = ancho / CAJA.w, x0 = W / 2 - ancho / 2, y0 = H * 0.44 - (CAJA.h * esc) / 2;
    const u = ancho / 350;
    // la lámpara: apagada, un parpadeo y prendida
    const prende = t < T.luz ? 0 : t < T.luz + 1 / 12 ? 0.5 : t < T.luz + 2 / 12 ? 0.15 : 1;
    // 1) las bolitas de plastilina que se van gastando
    const av = this.avances(t);
    TRAZOS.forEach((tr, i) => {
      const queda = 1 - av[i];
      if (queda <= 0.02) return;
      const bx = x0 + ancho * (0.12 + i * 0.25), by = y0 + CAJA.h * esc + 70 * u, r = (10 + 12 * queda) * u;
      g.fillStyle = 'rgba(20,10,0,0.35)'; g.beginPath(); g.ellipse(bx + 4 * u, by + r * 0.7, r * 1.1, r * 0.4, 0, 0, Math.PI * 2); g.fill();
      const gr = g.createRadialGradient(bx - r * 0.35, by - r * 0.35, r * 0.1, bx, by, r);
      gr.addColorStop(0, tono(COLORES[tr.id], 0.35)); gr.addColorStop(1, tono(COLORES[tr.id], -0.3));
      g.fillStyle = gr; g.beginPath(); g.ellipse(bx, by, r * (1 + hash(cuadro, i) * 0.06), r * 0.9, 0, 0, Math.PI * 2); g.fill();
    });
    // 2) el monograma: los chorizos, cada uno hasta donde llegó (apretado se achata un cuadro)
    const aprieta = t >= T.aprieta && t < T.aprieta + 2 / 12;
    const cy = y0 + (CAJA.h * esc) / 2;
    g.save();
    if (aprieta) { g.translate(W / 2, cy); g.scale(1.05, 0.9); g.translate(-W / 2, -cy); }
    for (const capa of [0, 1]) TRAZOS.forEach((tr, i) => {
      if (tr.capa !== capa || av[i] <= 0) return;
      const temblor = (hash(cuadro, i + 9) - 0.5) * 1.2 * u;
      chorizo(g, camino2d(tr, esc, x0, y0), MUESTRAS[i].largo * esc, av[i], GROSOR * esc * 1.25, COLORES[tr.id], temblor);
      // la punta que se está estirando es un poco más gorda
      if (av[i] < 1) {
        const [px, py] = punta(i, av[i]);
        g.fillStyle = COLORES[tr.id]; g.beginPath(); g.arc(x0 + px * esc, y0 + py * esc, GROSOR * esc * 0.72, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(x0 + px * esc - GROSOR * esc * 0.2, y0 + py * esc - GROSOR * esc * 0.22, GROSOR * esc * 0.22, 0, Math.PI * 2); g.fill();
      }
    });
    g.restore();
    // 3) el dedo del animador baja, aprieta y se va
    if (t >= T.dedo && t < T.aprieta + 0.34) {
      const baja = t < T.aprieta ? clamp((t - T.dedo) / (T.aprieta - T.dedo), 0, 1) : 1 - clamp((t - T.aprieta - 0.1) / 0.24, 0, 1);
      const hy = -H * 0.2 + (cy - CAJA.h * esc * 0.05 + H * 0.2) * salida(baja);
      dibujarMano(g, W / 2 + ancho * 0.04, hy, ancho * 0.16, 'dedo', 0.05);
    }
    // las migas que saltaron del apretón (de a cuadros)
    for (const m of this.migas) {
      const k = clamp(t - T.aprieta, 0, 1), x = W / 2 + (m.x + m.vx * k) * u, y = cy + (m.y - CAJA.h * 0.5 + m.vy * k + 380 * k * k) * u;
      if (k > 0.7) continue;
      g.fillStyle = m.color; g.beginPath(); g.arc(x, y, m.r * u, 0, Math.PI * 2); g.fill();
    }
    // 4) JXStudios: letras de plastilina que caen una por cuadro
    if (t >= T.letras) {
      const txt = 'JXStudios', px = Math.round(ancho * 0.13), yl = y0 + CAJA.h * esc + ancho * 0.15;
      g.font = `900 ${px}px ui-rounded, "Arial Rounded MT Bold", "Nunito", system-ui, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      const anchos = [...txt].map((ch) => g.measureText(ch).width + px * 0.04), total = anchos.reduce((a, b) => a + b, 0);
      let x = W / 2 - total / 2;
      [...txt].forEach((ch, k) => {
        const fotos = Math.floor((t - T.letras) / T.cadaLetra) - k;
        const cx = x + anchos[k] / 2; x += anchos[k];
        if (fotos < 0) return;
        // cae: arriba y chica, aplastada contra la mesa, y en su lugar
        const [dy, sx, sy] = fotos === 0 ? [-px * 0.5, 0.8, 1.25] : fotos === 1 ? [0, 1.2, 0.8] : [0, 1, 1];
        const col = LETRAS[k % 4], giro = (hash(k, 3) - 0.5) * 0.14;
        g.save(); g.translate(cx, yl + dy); g.rotate(giro); g.scale(sx, sy);
        g.lineJoin = 'round';
        g.fillStyle = 'rgba(20,10,0,0.35)'; g.fillText(ch, px * 0.05, px * 0.08);
        g.strokeStyle = tono(col, -0.4); g.lineWidth = px * 0.14; g.strokeText(ch, 0, 0);
        g.fillStyle = col; g.fillText(ch, 0, 0);
        g.save(); g.beginPath(); g.rect(-px, -px, px * 2, px * 0.62); g.clip(); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillText(ch, -px * 0.02, -px * 0.03); g.restore();
        g.restore();
      });
      // 5) "presenta", rayado con un palillo en una tira de plastilina
      if (t >= T.presenta && this.textoPresenta) {
        const k = clamp((t - T.presenta) / 0.34, 0, 1), fs = Math.round(px * 0.5);
        g.font = `italic 700 ${fs}px Georgia, "Times New Roman", serif`;
        const tw = g.measureText(this.textoPresenta).width, yp = yl + px * 0.78;
        g.fillStyle = '#d9d2c3'; g.beginPath(); g.ellipse(W / 2, yp - fs * 0.3, tw * 0.62, fs * 0.72, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(W / 2 - tw * 0.1, yp - fs * 0.62, tw * 0.4, fs * 0.2, 0, 0, Math.PI * 2); g.fill();
        g.save(); g.beginPath(); g.rect(W / 2 - tw / 2 - 4, yp - fs * 1.2, (tw + 8) * k, fs * 2); g.clip();
        g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillText(this.textoPresenta, W / 2 + 1, yp - fs * 0.05 + 1);
        g.fillStyle = '#6b6152'; g.fillText(this.textoPresenta, W / 2, yp - fs * 0.05);
        g.restore();
        if (k < 1) { const tx = W / 2 - tw / 2 + tw * k; g.strokeStyle = '#e8c890'; g.lineWidth = 3 * u; g.lineCap = 'round'; g.beginPath(); g.moveTo(tx, yp - fs * 0.3); g.lineTo(tx + 26 * u, yp - fs * 1.6); g.stroke(); }
      }
    }
    luzLampara(g, W, H, W / 2, H * 0.42, prende);
    if (prende === 0) { g.fillStyle = 'rgba(5,3,0,0.92)'; g.fillRect(0, 0, W, H); }
    pintarGrano(g, W, H, cuadro, 0.8);
    g.drawImage(vineta(W, H, 0.5), 0, 0);
    // 6) la foto: un cuadro blanco y el siguiente a medias
    if (t >= T.flash && t < T.flash + 2 / 12) { g.fillStyle = `rgba(255,252,240,${t < T.flash + 1 / 12 ? 0.95 : 0.5})`; g.fillRect(0, 0, W, H); }
    // al final, la mesa se oscurece hacia el menú
    if (this.t > T.fin) { g.globalAlpha = clamp((this.t - T.fin) / T.cierre, 0, 1); g.fillStyle = MESA; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    g.restore();
  }
}

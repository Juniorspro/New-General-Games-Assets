// La intro de JXSTUDIOS con el estilo de Morfi: de papel (la de Cripta es de
// píxeles, la de Víbora de metal y la de Globo plana de colores; cada juego
// la suya). Sobre un corcho entra una hoja y la sujetan dos cintas; una
// tijera recorta el monograma JXS en papeles de colores, trazo por trazo; el
// recorte salta (se despega de la hoja) y larga papelitos; JXStudios se pega
// letra por letra como una nota de recortes de revista, "presenta" se
// escribe con birome y la hoja se va volando para dar paso al menú. Dura
// menos de tres segundos y medio y arranca sola (main.js); la música sale de
// sonido.js › jingleJXS con el mismo reloj.
import { TRAZOS, CAJA, GROSOR, camino2d, muestrear } from './logojxs.js';
import { clamp, salida, suave, elastico, salidaAtras, azar } from './util.js';
import { redondo } from './papel.js';

export const T = { entra: 0.34, traza: [0.36, 1.3], golpe: 1.36, letras: 1.5, cadaLetra: 0.07, presenta: 2.2, fin: 2.72, cierre: 0.4, salto: 0.3 };
const CORCHO = '#b7864f', CARTON = '#c99a5f', HOJA = '#f6ecd6';
const PAPELES = { A: '#e8423a', J: '#f5c542', S: '#3f7fd1', B: '#58b368' };
const CONFETI = ['#e8423a', '#f5c542', '#3f7fd1', '#58b368', '#ff93b3', '#ffffff'];
// los recortes de revista de JXStudios: fondo, letra y tipo de letra de cada uno
const RECORTES = [
  ['#1f2126', '#ffffff', 'serif'], ['#f5c542', '#1f2126', 'sans'], ['#ffffff', '#e8423a', 'serif'], ['#3f7fd1', '#ffffff', 'sans'],
  ['#f7d6e0', '#1f2126', 'serif'], ['#58b368', '#ffffff', 'sans'], ['#ffffff', '#1f2126', 'sans'], ['#e8423a', '#ffffff', 'serif'], ['#f5c542', '#3f7fd1', 'sans'],
];

const MUESTRAS = TRAZOS.map((tr) => {
  const p = muestrear(tr, 2), acum = [0];
  for (let i = 1; i < p.length; i++) acum.push(acum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  return { p, acum, largo: acum[acum.length - 1] };
});
const ORDEN = [0, 1, 2, 3];
const TOTAL = MUESTRAS.reduce((a, m) => a + m.largo, 0);
// dónde está la tijera en el trazo i (y para dónde va)
function punta(i, avance) {
  const { p, acum, largo } = MUESTRAS[i], meta = largo * avance;
  let k = 1;
  while (k < acum.length - 1 && acum[k] < meta) k++;
  return [p[k][0], p[k][1], Math.atan2(p[k][1] - p[k - 1][1], p[k][0] - p[k - 1][0])];
}

// el corcho, una vez por tamaño
let corchoC = null;
function corcho(W, H) {
  if (corchoC && corchoC.width === W && corchoC.height === H) return corchoC;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), r = azar(5), u = Math.min(W, H) / 400;
  g.fillStyle = CORCHO; g.fillRect(0, 0, W, H);
  for (let k = 0; k < (W * H) / (120 * u * u); k++) {
    g.fillStyle = r() < 0.5 ? 'rgba(90,55,20,0.25)' : 'rgba(240,200,140,0.22)';
    g.beginPath(); g.arc(r() * W, r() * H, (0.6 + r() * 1.8) * u, 0, Math.PI * 2); g.fill();
  }
  const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,20,5,0.4)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  corchoC = c;
  return c;
}

// una tijera abierta `abre` (0 a 1), con la punta en (0, 0) mirando a +x
function tijera(g, s, abre) {
  const a = 0.08 + abre * 0.32;
  for (const lado of [-1, 1]) {
    g.save(); g.rotate(lado * a);
    // la hoja de metal
    g.fillStyle = lado < 0 ? '#c9ced6' : '#e4e8ee';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-26 * s, -3.2 * s * lado); g.lineTo(-30 * s, 0); g.lineTo(-26 * s, 1.2 * s * lado); g.closePath(); g.fill();
    g.strokeStyle = '#7d8591'; g.lineWidth = 0.8 * s; g.stroke();
    // el mango de plástico (un anillo)
    g.strokeStyle = lado < 0 ? '#e8423a' : '#d23a31'; g.lineWidth = 3.4 * s;
    g.beginPath(); g.ellipse(-40 * s, 5 * s * lado, 7.5 * s, 5 * s, 0.3 * lado, 0, Math.PI * 2); g.stroke();
    g.fillStyle = lado < 0 ? '#e8423a' : '#d23a31'; redondo(g, -34 * s, -1.8 * s, 6 * s, 3.6 * s, 1.5 * s); g.fill();
    g.restore();
  }
  g.fillStyle = '#5b626d'; g.beginPath(); g.arc(-30 * s, 0, 2 * s, 0, Math.PI * 2); g.fill();
}

export class IntroJXS {
  constructor({ sonido, vibrar = () => {}, alTerminar }) {
    this.t = 0; this.terminado = false; this.golpeado = false; this.pegadas = 0;
    this.alTerminar = alTerminar; this.vibrar = vibrar;
    this.musica = sonido.jingleJXS?.() || null;
    this.papeles = []; this.virutas = [];
    this.r = azar(2026);
  }
  saltear() {
    if (this.t < T.salto || this.terminado) return;
    this.musica?.cortar();
    this.t = Math.max(this.t, T.fin);
  }
  avances() {
    const k = clamp((this.t - T.traza[0]) / (T.traza[1] - T.traza[0]), 0, 1), hecho = suave(k) * TOTAL;
    let antes = 0;
    return ORDEN.map((i) => { const l = MUESTRAS[i].largo, a = clamp((hecho - antes) / l, 0, 1); antes += l; return a; });
  }
  // la hoja: dónde está y cuánto está girada (entra de abajo, se asienta y al final se va para arriba)
  hoja(W, H) {
    const w = Math.min(W * 0.88, H * 1.05, 700), h = w * 0.74, t = this.t;
    let y = H * 0.47, ang = -0.025;
    if (t < T.entra) { const k = salidaAtras(clamp(t / T.entra, 0, 1)); y = H + h * 0.7 - (H + h * 0.7 - H * 0.47) * k; ang = 0.14 * (1 - k) - 0.025 * k; }
    if (t > T.fin) { const k = clamp((t - T.fin) / T.cierre, 0, 1) ** 2; y -= k * (H * 0.47 + h * 1.2); ang -= k * 0.35; }
    return { x: W / 2, y, w, h, ang };
  }
  medidas(W, H) {
    const hj = this.hoja(W, H), ancho = hj.w * 0.7, esc = ancho / CAJA.w;
    return { hj, ancho, esc, x0: -ancho / 2, y0: -hj.h * 0.36 };
  }
  pasar(dt, W, H) {
    this.t += dt;
    const { hj, esc, x0, y0 } = this.medidas(W, H), r = this.r;
    // lo que va largando la tijera: virutas de papel
    const av = this.avances(), i = av.findIndex((a) => a > 0 && a < 1);
    if (i >= 0 && r() < 0.7) {
      const [px, py] = punta(ORDEN[i], av[i]);
      this.virutas.push({ x: x0 + px * esc, y: y0 + py * esc, vx: (r() - 0.5) * 90 * esc, vy: -40 * esc - r() * 60 * esc, t: 0, a: r() * 6, color: PAPELES[TRAZOS[ORDEN[i]].id], w: (2 + r() * 3) * esc * 1.6 });
    }
    for (const v of this.virutas) { v.t += dt; v.x += v.vx * dt; v.y += v.vy * dt; v.vy += 400 * esc * dt; v.a += dt * 9; }
    this.virutas = this.virutas.filter((v) => v.t < 0.6);
    if (!this.golpeado && this.t >= T.golpe) {
      this.golpeado = true;
      this.vibrar([20, 30, 20]);
      for (let k = 0; k < 90; k++) {
        const a = -Math.PI / 2 + (r() - 0.5) * 3, v = (180 + r() * 480) * (hj.w / 500);
        this.papeles.push({ x: (r() - 0.5) * hj.w * 0.5, y: y0 + CAJA.h * esc * 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, a: r() * 6, giro: (r() - 0.5) * 14, t: 0, vida: 1.1 + r() * 0.9, color: CONFETI[k % CONFETI.length], w: (5 + r() * 6) * (hj.w / 500), tri: r() < 0.35 });
      }
    }
    for (const p of this.papeles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 1.8; p.vy = p.vy * (1 - dt * 1.8) + 480 * (hj.w / 500) * dt; p.a += p.giro * dt; }
    this.papeles = this.papeles.filter((p) => p.t < p.vida);
    // cada letra que se pega, un golpecito
    const pegadas = clamp(Math.floor((this.t - T.letras) / T.cadaLetra) + 1, 0, 9);
    if (pegadas > this.pegadas) { this.pegadas = pegadas; if (pegadas === 9) this.vibrar(10); }
    if (this.t >= T.fin + T.cierre && !this.terminado) { this.terminado = true; this.alTerminar?.(); }
  }

  dibujar(g, W, H) {
    const t = this.t, { hj, ancho, esc, x0, y0 } = this.medidas(W, H), u = hj.w / 500;
    g.save();
    g.drawImage(corcho(W, H), 0, 0);
    // al final el corcho se va volviendo el cartón del menú
    if (t > T.fin) { g.globalAlpha = clamp((t - T.fin) / T.cierre, 0, 1); g.fillStyle = CARTON; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    // 1) la hoja, con su sombra, y las dos cintas
    g.save();
    g.translate(hj.x, hj.y); g.rotate(hj.ang);
    g.save(); g.shadowColor = 'rgba(30,15,0,0.45)'; g.shadowBlur = 18 * u; g.shadowOffsetY = 8 * u;
    g.fillStyle = HOJA; g.fillRect(-hj.w / 2, -hj.h / 2, hj.w, hj.h); g.restore();
    // renglones muy suaves: es una hoja de verdad
    g.strokeStyle = 'rgba(120,150,190,0.16)'; g.lineWidth = 1.2 * u;
    for (let y = -hj.h / 2 + 34 * u; y < hj.h / 2; y += 26 * u) { g.beginPath(); g.moveTo(-hj.w / 2, y); g.lineTo(hj.w / 2, y); g.stroke(); }
    if (t > T.entra * 0.8) {
      g.globalAlpha = clamp((t - T.entra * 0.8) / 0.12, 0, 1);
      for (const lado of [-1, 1]) {
        g.save(); g.translate(lado * hj.w * 0.42, -hj.h / 2); g.rotate(lado * 0.5);
        g.fillStyle = 'rgba(250,240,200,0.78)'; g.fillRect(-34 * u, -11 * u, 68 * u, 22 * u);
        g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(-34 * u, -11 * u, 68 * u, 5 * u);
        g.restore();
      }
      g.globalAlpha = 1;
    }
    // 2) el monograma: primero el dibujo en lápiz (línea de puntos), después el recorte de color
    const av = this.avances();
    const golpe = t >= T.golpe ? clamp((t - T.golpe) / 0.55, 0, 1) : 0;
    const salta = golpe > 0 ? 1 + (1 - elastico(golpe)) * 0.1 + Math.sin(golpe * Math.PI) * 0.04 : 1;
    const alto = golpe > 0 ? 3 + 7 * Math.sin(Math.min(1, golpe * 1.6) * Math.PI * 0.5) : 3;
    g.save();
    const cy = y0 + (CAJA.h * esc) / 2;
    g.translate(0, cy); g.scale(salta, salta); g.translate(0, -cy);
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (t > T.entra * 0.7 && golpe < 1) {
      g.globalAlpha = clamp((t - T.entra * 0.7) / 0.15, 0, 1) * (1 - golpe) * 0.5;
      g.setLineDash([5 * esc, 5 * esc]); g.strokeStyle = '#6b6258'; g.lineWidth = 1.4 * esc;
      for (const tr of TRAZOS) g.stroke(camino2d(tr, esc, x0, y0));
      g.setLineDash([]); g.globalAlpha = 1;
    }
    for (const capa of [0, 1]) TRAZOS.forEach((tr, i) => {
      if (tr.capa !== capa || av[i] <= 0) return;
      const p = camino2d(tr, esc, x0, y0), l = MUESTRAS[i].largo * esc;
      g.setLineDash(av[i] < 1 ? [Math.max(0.01, l * av[i]), l + 10] : []);
      // la sombra (crece cuando salta), el borde blanco del recorte y el papel de color
      g.save(); g.translate(alto * 0.5 * esc, alto * esc); g.lineWidth = GROSOR * esc + 5 * esc; g.strokeStyle = 'rgba(40,20,5,0.28)'; g.stroke(p); g.restore();
      g.lineWidth = GROSOR * esc + 5 * esc; g.strokeStyle = '#ffffff'; g.stroke(p);
      g.lineWidth = GROSOR * esc; g.strokeStyle = PAPELES[tr.id]; g.stroke(p);
      // un brillo fino de papel satinado
      g.lineWidth = GROSOR * esc * 0.22; g.strokeStyle = 'rgba(255,255,255,0.28)'; g.save(); g.translate(-GROSOR * esc * 0.18, -GROSOR * esc * 0.18); g.stroke(p); g.restore();
    });
    g.setLineDash([]);
    g.restore();
    // las virutas y la tijera
    for (const v of this.virutas) { g.globalAlpha = 1 - v.t / 0.6; g.fillStyle = v.color; g.save(); g.translate(v.x, v.y); g.rotate(v.a); g.fillRect(-v.w / 2, -v.w / 4, v.w, v.w / 2); g.restore(); }
    g.globalAlpha = 1;
    const i = av.findIndex((a) => a > 0 && a < 1);
    const corta = t > T.traza[0] - 0.1 && t < T.traza[1] + 0.3;
    if (corta) {
      const k = i >= 0 ? ORDEN[i] : t < T.traza[0] ? 0 : 3;
      const [px, py, ang] = punta(k, i >= 0 ? av[k] : t < T.traza[0] ? 0.02 : 1);
      const aparece = clamp((t - (T.traza[0] - 0.1)) / 0.1, 0, 1), seVa = clamp((t - T.traza[1]) / 0.3, 0, 1);
      g.globalAlpha = aparece * (1 - seVa);
      g.save(); g.translate(x0 + px * esc + seVa * 60 * esc, y0 + py * esc - seVa * 50 * esc); g.rotate(ang + seVa * 0.8);
      g.save(); g.translate(3 * esc, 5 * esc); g.globalAlpha *= 0.3; tijeraSombra(g, esc * 1.3); g.restore();
      tijera(g, esc * 1.3, Math.abs(Math.sin(t * 38)));
      g.restore();
      g.globalAlpha = 1;
    }
    // 3) JXStudios en recortes de revista, pegados de a uno
    if (t > T.letras) {
      const txt = 'JXStudios', px = ancho * 0.125, yl = y0 + CAJA.h * esc + hj.h * 0.15;
      const anchos = [...txt].map((ch) => px * (ch === 'i' ? 0.52 : 0.84));
      const total = anchos.reduce((a, b) => a + b, 0) + px * 0.06 * (txt.length - 1);
      let x = -total / 2;
      [...txt].forEach((ch, k) => {
        const tk = t - T.letras - k * T.cadaLetra;
        if (tk <= 0) { x += anchos[k] + px * 0.06; return; }
        const [fondoC, letraC, tipo] = RECORTES[k], rr = azar(40 + k);
        const giro = (rr() - 0.5) * 0.3, tam = px * (0.92 + rr() * 0.2);
        const cae = clamp(tk / 0.11, 0, 1), e = cae < 1 ? 1.7 - 0.7 * cae * cae : 1 - Math.sin(clamp((tk - 0.11) / 0.12, 0, 1) * Math.PI) * 0.06;
        g.save(); g.translate(x + anchos[k] / 2, yl + (rr() - 0.5) * px * 0.12); g.rotate(giro); g.scale(e, e);
        g.globalAlpha = clamp(tk / 0.05, 0, 1);
        const w = anchos[k] * 1.02, h = tam * 1.18;
        g.fillStyle = 'rgba(40,20,5,0.25)'; g.fillRect(-w / 2 + 2 * u, -h / 2 + 3 * u, w, h);
        g.fillStyle = fondoC; g.beginPath();
        // el recorte con las esquinas un poco torcidas (cortado a mano)
        g.moveTo(-w / 2 + rr() * 3 * u, -h / 2); g.lineTo(w / 2, -h / 2 + rr() * 3 * u); g.lineTo(w / 2 - rr() * 3 * u, h / 2); g.lineTo(-w / 2, h / 2 - rr() * 3 * u); g.closePath(); g.fill();
        g.fillStyle = letraC; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = tipo === 'serif' ? `italic 700 ${Math.round(tam)}px Georgia, "Times New Roman", serif` : `900 ${Math.round(tam)}px system-ui, -apple-system, "Segoe UI", Roboto, "Arial Black", sans-serif`;
        g.fillText(ch, 0, tam * 0.04);
        g.restore();
        x += anchos[k] + px * 0.06;
      });
      g.globalAlpha = 1;
      // 4) "presenta", escrito con birome de izquierda a derecha
      if (t > T.presenta && this.textoPresenta) {
        const k = clamp((t - T.presenta) / 0.38, 0, 1), fs = Math.round(px * 0.62);
        g.font = `italic 400 ${fs}px "Segoe Script", "Bradley Hand", "Brush Script MT", Georgia, cursive`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        const tw = g.measureText(this.textoPresenta).width, yp = yl + px * 0.95;
        g.save(); g.beginPath(); g.rect(-tw / 2 - 4 * u, yp - fs, (tw + 8 * u) * k, fs * 2); g.clip();
        g.fillStyle = '#27408b'; g.fillText(this.textoPresenta, 0, yp);
        g.restore();
        if (k < 1) { g.fillStyle = '#1f2126'; g.save(); g.translate(-tw / 2 + tw * k, yp + fs * 0.1); g.rotate(-0.7); g.fillRect(0, -1.5 * u, 26 * u, 3 * u); g.fillStyle = '#3f7fd1'; g.fillRect(8 * u, -2.2 * u, 18 * u, 4.4 * u); g.restore(); }
      }
    }
    g.restore();
    // el papel picado, arriba de todo (sale de la hoja)
    for (const p of this.papeles) {
      g.globalAlpha = Math.min(1, (p.vida - p.t) * 3);
      g.save(); g.translate(hj.x + p.x, hj.y + p.y); g.rotate(p.a); g.scale(1, Math.abs(Math.cos(p.a * 1.3)) * 0.8 + 0.2); g.fillStyle = p.color;
      if (p.tri) { g.beginPath(); g.moveTo(0, -p.w * 0.6); g.lineTo(p.w * 0.55, p.w * 0.4); g.lineTo(-p.w * 0.55, p.w * 0.4); g.closePath(); g.fill(); }
      else g.fillRect(-p.w / 2, -p.w * 0.32, p.w, p.w * 0.64);
      g.restore();
    }
    g.globalAlpha = 1;
    g.restore();
  }
}
// la sombra de la tijera: la misma silueta, oscura
function tijeraSombra(g, s) {
  g.fillStyle = 'rgb(40,20,5)'; g.strokeStyle = 'rgb(40,20,5)';
  for (const lado of [-1, 1]) {
    g.save(); g.rotate(lado * 0.25);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-26 * s, -3.2 * s * lado); g.lineTo(-30 * s, 0); g.closePath(); g.fill();
    g.lineWidth = 3.4 * s; g.beginPath(); g.ellipse(-40 * s, 5 * s * lado, 7.5 * s, 5 * s, 0.3 * lado, 0, Math.PI * 2); g.stroke();
    g.restore();
  }
}

// El dibujo de Globo Libre: plano y de colores, como un libro para chicos.
// Cada cosa es un color lleno con su sombra en un tono más oscuro (una franja
// abajo, siempre del mismo lado del cuerpo) y un brillo claro; nada de
// degradés por cuerpo. El cielo, las nubes y las monedas se arman una vez y
// después son un `drawImage`.
//
// La cámara: `cam = { esc, ox, arriba }`. Un punto del mundo (x, y) va a la
// pantalla en (ox + x·esc, (y − arriba)·esc).
import { ANCHO } from './niveles.js';
import { R_ESCUDO, R_MONEDA } from './partida.js';
import { azar, tono, lerp } from './util.js';

// ── lo que se arma una vez ─────────────────────────────────────────────────
const cache = new Map();
function lienzo(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
function mezclar(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t)));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// el cielo: un degradé vertical de alto 256 que se estira a la pantalla; se
// rehace solo cuando cambia de verdad (el avance del nivel va en 24 escalones)
function cielo(tema, avance) {
  const k = `cielo:${tema.id}:${Math.round(avance * 24)}`;
  if (cache.has(k)) return cache.get(k);
  const t = Math.round(avance * 24) / 24;
  const abajo = mezclar(tema.cielo[0][1], tema.cielo[1][1], t), arriba = mezclar(tema.cielo[0][0], tema.cielo[1][0], t);
  const c = lienzo(1, 256), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, arriba); gr.addColorStop(1, abajo);
  g.fillStyle = gr; g.fillRect(0, 0, 1, 256);
  for (const kk of cache.keys()) if (kk.startsWith(`cielo:${tema.id}:`) && cache.size > 60) cache.delete(kk);
  cache.set(k, c);
  return c;
}

// una nube plana: círculos que se pisan, con la panza en un tono más oscuro
export function nube(tema, variante, px) {
  const k = `nube:${tema.id}:${variante}:${px}`;
  if (cache.has(k)) return cache.get(k);
  const r = azar(variante * 97 + 5), w = px * 2.2, h = px * 1.1, c = lienzo(w, h), g = c.getContext('2d');
  const bolas = [];
  for (let i = 0; i < 5; i++) bolas.push([w * (0.2 + i * 0.15) + r.entre(-4, 4), h * 0.62 - Math.sin((i / 4) * Math.PI) * h * r.entre(0.18, 0.32), px * r.entre(0.26, 0.38)]);
  g.fillStyle = tema.nubeSombra;
  for (const [x, y, rr] of bolas) { g.beginPath(); g.arc(x, y + px * 0.06, rr, 0, Math.PI * 2); g.fill(); }
  g.fillRect(w * 0.18, h * 0.62, w * 0.64, h * 0.3);
  g.fillStyle = tema.nube;
  for (const [x, y, rr] of bolas) { g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill(); }
  g.fillRect(w * 0.18, h * 0.55, w * 0.64, h * 0.3);
  cache.set(k, c);
  return c;
}

// la moneda de frente (se "gira" estirándola a lo ancho)
function monedaImg(px) {
  const k = 'moneda:' + px;
  if (cache.has(k)) return cache.get(k);
  const c = lienzo(px * 2 + 4, px * 2 + 4), g = c.getContext('2d'), m = px + 2;
  g.fillStyle = '#e0a800'; g.beginPath(); g.arc(m, m + px * 0.12, px, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(m, m, px, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffe98a'; g.beginPath(); g.arc(m, m, px * 0.66, 0, Math.PI * 2); g.fill();
  estrella(g, m, m, px * 0.42, '#f0b400');
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(m - px * 0.35, m - px * 0.4, px * 0.22, px * 0.13, -0.6, 0, Math.PI * 2); g.fill();
  cache.set(k, c);
  return c;
}

export function estrella(g, x, y, r, color, puntas = 5) {
  g.fillStyle = color; g.beginPath();
  for (let i = 0; i < puntas * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / puntas, rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
}

export function cajaRedonda(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

// los tonos de cada color, calculados una vez
const tonos = new Map();
function sombras(color) {
  let t = tonos.get(color);
  if (!t) { t = { osc: tono(color, -0.28), claro: tono(color, 0.35), linea: tono(color, -0.45) }; tonos.set(color, t); }
  return t;
}

// ── el fondo ───────────────────────────────────────────────────────────────
export function dibujarFondo(g, W, H, cam, { tema, avance = 0, t = 0, suelo = true }) {
  g.drawImage(cielo(tema, avance), 0, 0, W, H);
  const esc = cam.esc;
  // estrellas (de noche, y algunas al atardecer): fijas en el cielo, titilan
  if (tema.estrellas > 0) {
    const r = azar(77), n = Math.round(90 * tema.estrellas);
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = ((r() * 1.4 - (cam.arriba * esc * 0.05) / H) % 1.4 + 1.4) % 1.4 * H - H * 0.2, br = 0.5 + 0.5 * Math.sin(t * (1 + r() * 2) + i);
      g.globalAlpha = tema.estrellas * (0.35 + br * 0.6);
      g.fillStyle = '#ffffff';
      const s = (1 + (i % 3)) * Math.max(1, esc * 0.8);
      g.fillRect(x, y, s, s);
    }
    g.globalAlpha = 1;
  }
  // el sol (o la luna) lejos: se mueve poquito con la cámara
  const sx = W * 0.78, sy = H * 0.2 - (cam.arriba * esc * 0.02) % (H * 0.3);
  const rs = Math.min(W, H) * 0.09;
  if (tema.id === 'noche') {
    g.fillStyle = '#f4f1d0'; g.beginPath(); g.arc(sx, sy, rs, 0, Math.PI * 2); g.fill();
    g.fillStyle = tema.cielo[1][0]; g.beginPath(); g.arc(sx + rs * 0.45, sy - rs * 0.25, rs * 0.85, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = tema.id === 'dia' ? 'rgba(255,241,160,0.35)' : 'rgba(255,220,160,0.35)';
    g.beginPath(); g.arc(sx, sy, rs * 1.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = tema.id === 'dia' ? '#fff1a0' : '#ffd08a'; g.beginPath(); g.arc(sx, sy, rs, 0, Math.PI * 2); g.fill();
  }
  // dos capas de nubes que se corren más lento que el mundo (profundidad)
  for (const [capa, vel, px, n] of [[0, 0.25, 60, 5], [1, 0.55, 90, 4]]) {
    const r = azar(31 + capa * 13), alto = H * 1.6;
    for (let i = 0; i < n; i++) {
      const img = nube(tema, (i + capa * 7) % 6, Math.round(px * Math.min(1.4, esc)));
      const x = r() * (W + img.width) - img.width * 0.6 + Math.sin(t * 0.05 + i) * 12;
      const y = (((r() * alto - cam.arriba * esc * vel) % alto) + alto) % alto - img.height;
      g.globalAlpha = capa === 0 ? 0.55 : 0.85;
      g.drawImage(img, x, y);
    }
  }
  g.globalAlpha = 1;
  // el suelo de donde salió el globo (se ve al empezar el nivel)
  if (suelo) {
    const ys = (60 - cam.arriba) * esc;
    if (ys < H + 40 * esc) {
      g.fillStyle = tema.pisoSombra;
      g.beginPath(); g.moveTo(0, ys + 30 * esc);
      for (let x = 0; x <= W + 20; x += 20) g.lineTo(x, ys + 12 * esc - Math.sin(x / (80 * esc) + 1) * 10 * esc);
      g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
      g.fillStyle = tema.piso;
      g.beginPath(); g.moveTo(0, ys + 40 * esc);
      for (let x = 0; x <= W + 20; x += 20) g.lineTo(x, ys + 26 * esc - Math.sin(x / (60 * esc)) * 8 * esc);
      g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
      const r = azar(5);
      for (let i = 0; i < 14; i++) {
        const x = r() * W, y = ys + (34 + r() * 30) * esc;
        g.fillStyle = tema.flor[i % tema.flor.length];
        for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 3 * esc, y + Math.sin(a) * 3 * esc, 2.2 * esc, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(x, y, 1.8 * esc, 0, Math.PI * 2); g.fill();
      }
    }
  }
}

// ── la meta: una franja a cuadros de lado a lado, con dos banderines ──────
export function dibujarMeta(g, cam, y, texto, tema, t) {
  const esc = cam.esc, sy = (y - cam.arriba) * esc, x0 = cam.ox, x1 = cam.ox + ANCHO * esc;
  if (sy < -60 * esc || sy > 2000) return;
  const alto = 14 * esc, cuad = 14 * esc;
  for (let x = x0, i = 0; x < x1; x += cuad, i++) {
    g.fillStyle = i % 2 ? '#ffffff' : tema.tinta; g.fillRect(x, sy - alto, cuad + 0.5, alto / 2);
    g.fillStyle = i % 2 ? tema.tinta : '#ffffff'; g.fillRect(x, sy - alto / 2, cuad + 0.5, alto / 2);
  }
  for (const [px, lado] of [[x0 + 10 * esc, 1], [x1 - 10 * esc, -1]]) {
    g.fillStyle = tema.tinta; g.fillRect(px - 2 * esc, sy - 70 * esc, 4 * esc, 70 * esc);
    const ola = Math.sin(t * 5) * 4 * esc;
    g.fillStyle = tema.meta;
    g.beginPath(); g.moveTo(px, sy - 70 * esc); g.quadraticCurveTo(px + lado * 20 * esc, sy - 64 * esc + ola, px + lado * 36 * esc, sy - 60 * esc); g.lineTo(px, sy - 48 * esc); g.closePath(); g.fill();
  }
  g.font = `900 ${Math.round(22 * esc)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'bottom';
  g.fillStyle = tono(tema.tinta, 0.1); g.fillText(texto, cam.ox + (ANCHO / 2) * esc, sy - alto - 4 * esc + 2 * esc);
  g.fillStyle = '#ffffff'; g.fillText(texto, cam.ox + (ANCHO / 2) * esc, sy - alto - 4 * esc);
}

// ── los cuerpos ────────────────────────────────────────────────────────────
function cuerpo(g, b, esc, tema) {
  const color = b.color || tema.cuerpos[0], s = sombras(color), pieza = b.datos?.pieza;
  g.save();
  g.translate(b.x * esc, b.y * esc);
  g.rotate(b.a);
  if (b.forma === 'bola') {
    const r = b.hx * esc;
    if (pieza === 'clavo') {
      g.fillStyle = tema.fijo; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = tema.fijoRaya; g.beginPath(); g.arc(0, 0, r * 0.5, 0, Math.PI * 2); g.fill();
      g.restore(); return;
    }
    g.fillStyle = s.osc; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = s.linea; g.lineWidth = 1.5 * esc; g.stroke();
    g.fillStyle = color; g.beginPath(); g.arc(-r * 0.08, -r * 0.1, r * 0.86, 0, Math.PI * 2); g.fill();
    g.fillStyle = s.claro; g.beginPath(); g.ellipse(-r * 0.36, -r * 0.4, r * 0.3, r * 0.18, -0.7, 0, Math.PI * 2); g.fill();
    if (pieza === 'pendulo') { g.fillStyle = s.linea; g.beginPath(); g.arc(0, 0, r * 0.18, 0, Math.PI * 2); g.fill(); }
  } else {
    const w = b.hx * 2 * esc, h = b.hy * 2 * esc, rr = Math.min(6 * esc, h * 0.3);
    if (b.tipo === 0) {
      // lo fijo: oscuro y rayado en diagonal (se nota que no se mueve)
      g.fillStyle = tema.fijo; cajaRedonda(g, -w / 2, -h / 2, w, h, rr); g.fill();
      g.strokeStyle = tema.tinta; g.lineWidth = 2 * esc; g.stroke();
      g.save(); g.clip();
      g.strokeStyle = tema.fijoRaya; g.lineWidth = 4 * esc;
      for (let x = -w / 2 - h; x < w / 2 + h; x += 12 * esc) { g.beginPath(); g.moveTo(x, h / 2); g.lineTo(x + h, -h / 2); g.stroke(); }
      g.restore();
    } else {
      g.fillStyle = s.osc; cajaRedonda(g, -w / 2, -h / 2, w, h, rr); g.fill();
      g.strokeStyle = s.linea; g.lineWidth = 1.5 * esc; g.stroke();
      g.fillStyle = color; cajaRedonda(g, -w / 2, -h / 2, w, h - Math.min(5 * esc, h * 0.25), rr); g.fill();
      if (w > 14 * esc && h > 14 * esc) { g.fillStyle = s.claro; cajaRedonda(g, -w / 2 + 4 * esc, -h / 2 + 3 * esc, Math.min(w * 0.35, 18 * esc), 3 * esc, 1.5 * esc); g.fill(); }
      if (pieza === 'molinete' || pieza === 'aspa') {
        // el eje: un tornillo en el medio
        g.fillStyle = tema.fijo; g.beginPath(); g.arc(0, 0, 7 * esc, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, 2.5 * esc, 0, Math.PI * 2); g.fill();
        if (pieza === 'aspa') { g.fillStyle = 'rgba(255,255,255,0.35)'; for (const lado of [-1, 1]) { g.beginPath(); g.arc(lado * (w / 2 - 8 * esc), 0, 3 * esc, 0, Math.PI * 2); g.fill(); } }
      }
    }
  }
  g.restore();
}

// ── el globo y el escudo (también se usan en el menú y en la tienda) ──────
export function dibujarGlobo(g, x, y, r, piel, t, { hilo = 70, inclina = 0 } = {}) {
  const col = piel.color, s = sombras(col), ry = r * 1.16;
  // el hilo, que ondea
  g.strokeStyle = piel.hilo || 'rgba(40,40,60,0.55)'; g.lineWidth = Math.max(1, r * 0.07);
  g.beginPath(); g.moveTo(x, y + ry);
  const o = Math.sin(t * 3) * r * 0.25;
  g.bezierCurveTo(x + o, y + ry + hilo * 0.35, x - o, y + ry + hilo * 0.65, x + o * 0.5, y + ry + hilo);
  g.stroke();
  g.save(); g.translate(x, y); g.rotate(inclina);
  // el nudo
  g.fillStyle = s.osc; g.beginPath(); g.moveTo(-r * 0.16, ry + r * 0.16); g.lineTo(r * 0.16, ry + r * 0.16); g.lineTo(0, ry - r * 0.08); g.closePath(); g.fill();
  // el cuerpo: la sombra plana del lado de abajo a la derecha, después la cara
  g.fillStyle = s.osc; g.beginPath(); g.ellipse(0, 0, r, ry, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(29,36,64,0.35)'; g.lineWidth = Math.max(1, r * 0.07); g.stroke();
  g.save(); g.beginPath(); g.ellipse(0, 0, r, ry, 0, 0, Math.PI * 2); g.clip();
  g.fillStyle = col; g.beginPath(); g.ellipse(-r * 0.12, -r * 0.14, r * 0.95, ry * 0.95, 0, 0, Math.PI * 2); g.fill();
  if (piel.dibujo) piel.dibujo(g, r, ry, t);
  g.restore();
  // el brillo
  g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(-r * 0.42, -ry * 0.45, r * 0.18, ry * 0.3, 0.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(-r * 0.2, -ry * 0.78, r * 0.08, 0, Math.PI * 2); g.fill();
  g.restore();
}

export function dibujarEscudo(g, x, y, r, piel, t) {
  const col = piel.color;
  g.fillStyle = piel.relleno || 'rgba(255,255,255,0.22)'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  // el borde oscuro de afuera: sin él, el aro blanco se pierde en el cielo claro
  g.strokeStyle = 'rgba(29,36,64,0.55)'; g.lineWidth = r * 0.36; g.beginPath(); g.arc(x, y + r * 0.05, r * 0.88, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = piel.borde || 'rgba(0,0,0,0.12)'; g.lineWidth = r * 0.3; g.beginPath(); g.arc(x, y + r * 0.06, r * 0.86, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = col; g.lineWidth = r * 0.22; g.beginPath(); g.arc(x, y, r * 0.88, 0, Math.PI * 2); g.stroke();
  if (piel.dibujo) piel.dibujo(g, x, y, r, t);
  // un brillo que da vueltas: se nota que está vivo aunque esté quieto
  const a = t * 2.2;
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = r * 0.12; g.lineCap = 'round';
  g.beginPath(); g.arc(x, y, r * 0.88, a, a + 0.7); g.stroke();
  g.lineCap = 'butt';
}

// ── la partida entera ──────────────────────────────────────────────────────
export function dibujarPartida(g, W, H, p, cam, { pielGlobo, pielEscudo, tr, t }) {
  const tema = p.tema(), esc = cam.esc;
  dibujarFondo(g, W, H, cam, { tema, avance: p.progreso(), t, suelo: true });
  if (!p.infinito) dibujarMeta(g, cam, -p.largo, tr('meta'), tema, t);
  g.save();
  g.translate(cam.ox, -cam.arriba * esc);
  // las cuerdas de los péndulos, detrás de todo
  g.strokeStyle = tema.fijo; g.lineWidth = 2.5 * esc;
  for (const cu of p.mundo.cuerdas) { if (!cu.b.vivo) continue; g.beginPath(); g.moveTo(cu.x * esc, cu.y * esc); g.lineTo(cu.b.x * esc, cu.b.y * esc); g.stroke(); }
  // las monedas, que giran
  const mon = monedaImg(Math.round(R_MONEDA * esc));
  for (const m of p.monedas) {
    const sy = (m.y - cam.arriba) * esc;
    if (sy < -30 || sy > H + 30) continue;
    const ancho = Math.abs(Math.cos(m.t * 2.6)) * 0.85 + 0.15, bob = Math.sin(m.t * 3) * 2 * esc;
    g.drawImage(mon, m.x * esc - (mon.width * ancho) / 2, m.y * esc - mon.height / 2 + bob, mon.width * ancho, mon.height);
  }
  // los cuerpos que se ven
  const y0 = cam.arriba - 60, y1 = cam.arriba + H / esc + 60;
  for (const b of p.mundo.cuerpos) {
    if (b === p.escudo || !b.vivo || b.y + b.r < y0 || b.y - b.r > y1) continue;
    cuerpo(g, b, esc, tema);
  }
  // las partículas
  for (const q of p.particulas) {
    const k = 1 - q.t / q.vida;
    if (q.tipo === 'polvo') { g.globalAlpha = k * 0.8; g.fillStyle = q.color; g.beginPath(); g.arc(q.x * esc, q.y * esc, q.r * esc * (0.6 + (1 - k) * 0.8), 0, Math.PI * 2); g.fill(); }
    else if (q.tipo === 'brillo') { g.globalAlpha = k; estrella(g, q.x * esc, q.y * esc, q.r * esc * (0.5 + k), q.color, 4); }
    else {
      g.globalAlpha = Math.min(1, k * 3);
      g.save(); g.translate(q.x * esc, q.y * esc); g.rotate(q.a || 0);
      g.fillStyle = q.tipo === 'pedazo' ? pielGlobo.color : q.color;
      g.fillRect(-q.r * esc, -q.r * esc * 0.5, q.r * 2 * esc, q.r * esc);
      g.restore();
    }
  }
  g.globalAlpha = 1;
  // el globo y el escudo
  const gl = p.globo;
  if (gl.vivo) dibujarGlobo(g, gl.x * esc, gl.y * esc, gl.r * esc, pielGlobo, t, { hilo: 70 * esc, inclina: Math.cos(p.t * 0.9) * 0.08 });
  const e = p.escudo;
  if (p.estado !== 'pum' || p.tFin < 0.6) {
    g.globalAlpha = p.estado === 'pum' ? 1 - p.tFin / 0.6 : 1;
    dibujarEscudo(g, e.x * esc, e.y * esc, R_ESCUDO * esc, pielEscudo, t);
    g.globalAlpha = 1;
  }
  g.restore();
  // el aviso de lo que viene cayendo: triángulos que titilan arriba de todo
  // (por pieza: la que está a menos de 320 de asomar)
  if (p.estado === 'juego') {
    const xs = new Set();
    for (const f of p.activas) for (const c of f.caen) if (cam.arriba - (c.y + c.r) < 320) xs.add(Math.round(c.x / 45));
    if (xs.size) {
      g.globalAlpha = 0.55 + 0.45 * Math.sin(t * 14);
      for (const k of xs) aviso(g, cam.ox + k * 45 * esc, 46 * esc, 12 * esc);
      g.globalAlpha = 1;
    }
  }
}

function aviso(g, x, y, r) {
  g.fillStyle = '#ffd23f'; g.strokeStyle = '#1d2440'; g.lineWidth = r * 0.22; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 1.05, y + r * 0.8); g.lineTo(x - r * 1.05, y + r * 0.8); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#1d2440'; g.fillRect(x - r * 0.1, y - r * 0.45, r * 0.2, r * 0.7); g.fillRect(x - r * 0.1, y + r * 0.38, r * 0.2, r * 0.2);
}

/* ============================================================================
   luz-mala/js/pantallas.js — lo que no es la sala: la portada, la intro, los
   globos de diálogo, los carteles, los hallazgos, la pausa, la tienda, el
   mapa, los créditos, el final y las transiciones.
   Las transiciones de LUZ MALA no son tramas: la luz se cierra sobre Chispa
   (suave, con un borde tibio) y se vuelve a abrir en la sala nueva.
   ========================================================================== */

/* ---------------- la transición de luz ---------------- */
/* el reloj del dibujo: cuánto tiempo de juego pasó desde el último cuadro
   dibujado. Lo que se apaga o crece mientras se dibuja usa esto y no DT, así
   anda igual en una pantalla de 60 Hz que en una de 120 */
const Reloj = { d: DT, antes: null };
function marcarDibujo(t) { Reloj.d = Reloj.antes == null ? DT : lim(t - Reloj.antes, 0, 0.25); Reloj.antes = t; }

const TransLM = {
  activa: false, t: 0, dur: 0.3, fase: 0, alMedio: null, alFin: null, cx: 0, cy: 0, col: '5,3,8',
  iniciar(dur, alMedio, alFin, o) {
    o = o || {};
    Object.assign(this, { activa: true, t: 0, dur, fase: 0, alMedio, alFin, cx: o.cx != null ? o.cx : Pantalla.W / 2, cy: o.cy != null ? o.cy : Pantalla.H / 2, col: o.col || '5,3,8' });
  },
  /* solo la mitad que abre: para entrar a una pantalla */
  abrir(dur, cx, cy) { Object.assign(this, { activa: true, t: 0, dur, fase: 1, alMedio: null, alFin: null, cx, cy, col: '5,3,8' }); },
  pasar() {
    if (!this.activa) return;
    this.t += DT;
    if (this.fase === 0 && this.t >= this.dur) { this.fase = 1; this.t = 0; if (this.alMedio) this.alMedio(); }
    else if (this.fase === 1 && this.t >= this.dur) { this.activa = false; if (this.alFin) this.alFin(); }
  },
  dibujar(g) {
    if (!this.activa) return;
    const W = Pantalla.W, H = Pantalla.H;
    const k = lim(this.fase === 0 ? this.t / this.dur : 1 - this.t / this.dur, 0, 1), e = k * k * (3 - 2 * k);
    const diag = Math.hypot(Math.max(this.cx, W - this.cx), Math.max(this.cy, H - this.cy)) + 20;
    const R = (1 - e) * diag;
    if (R < 2) { g.fillStyle = `rgb(${this.col})`; g.fillRect(0, 0, W, H); return; }
    const grd = g.createRadialGradient(this.cx, this.cy, R * 0.62, this.cx, this.cy, R);
    grd.addColorStop(0, `rgba(${this.col},0)`); grd.addColorStop(0.7, `rgba(${this.col},0.85)`); grd.addColorStop(1, `rgba(${this.col},1)`);
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    /* el borde de la luz, tibio */
    if (this.col === '5,3,8') {
      g.globalCompositeOperation = 'lighter';
      const b = g.createRadialGradient(this.cx, this.cy, R * 0.5, this.cx, this.cy, R * 0.66);
      b.addColorStop(0, 'rgba(246,255,168,0)'); b.addColorStop(0.8, `rgba(246,255,168,${0.1 * e})`); b.addColorStop(1, 'rgba(246,255,168,0)');
      g.fillStyle = b; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
    }
  },
};
function velo(g, a) {
  const W = Pantalla.W, H = Pantalla.H;
  g.fillStyle = `rgba(5,3,8,${a})`; g.fillRect(0, 0, W, H);
  const grd = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  grd.addColorStop(0, 'rgba(5,3,8,0)'); grd.addColorStop(1, 'rgba(5,3,8,0.6)');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
}
/* un brillo suave (no en trama): la luz de LUZ MALA */
function brillo(g, x, y, r, rgb, a) {
  if (r <= 0 || a <= 0) return;
  const grd = g.createRadialGradient(x, y, 0, x, y, r);
  grd.addColorStop(0, `rgba(${rgb},${a})`); grd.addColorStop(0.45, `rgba(${rgb},${a * 0.35})`); grd.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
}

/* ---------------- la portada: el monte de noche y el quebracho ---------------- */
const Portada = { bichos: [], estrellas: null, arbol: null };
function prepararPortada(W, H) {
  if (Portada.estrellas && Portada.estrellas.width === W && Portada.estrellas.height === H) return;
  const c = lienzoLM(W, H), g = c.getContext('2d');
  /* cielo del Chaco: un degradé suave de violeta a casi negro */
  const cielo = g.createLinearGradient(0, 0, 0, H);
  cielo.addColorStop(0, '#0b0a1e'); cielo.addColorStop(0.55, '#171030'); cielo.addColorStop(1, '#1f1228');
  g.fillStyle = cielo; g.fillRect(0, 0, W, H);
  for (let i = 0; i < W * H / 230; i++) {
    const x = Math.floor(ruidoLM(i, 1, 81) * W), y = Math.floor(ruidoLM(i, 2, 82) * H * 0.62);
    g.fillStyle = ruidoLM(i, 3, 83) > 0.86 ? '#ffffff' : ruidoLM(i, 4, 84) > 0.5 ? '#8a88b8' : '#5a5680'; g.fillRect(x, y, 1, 1);
  }
  /* la luna, finita, con su halo */
  const alta = H > W, lx = Math.round(W * (alta ? 0.86 : 0.9)), ly = Math.round(H * (alta ? 0.05 : 0.17));
  brillo(g, lx, ly, 34, '220,210,180', 0.18);
  for (let yy = -7; yy <= 7; yy++) for (let xx = -7; xx <= 7; xx++) {
    const d1 = Math.hypot(xx, yy), d2 = Math.hypot(xx - 3, yy - 2);
    if (d1 <= 7 && d2 > 6.2) { g.fillStyle = d1 > 6 ? '#c8c0a0' : '#fff6d8'; g.fillRect(lx + xx, ly + yy, 1, 1); }
  }
  Portada.estrellas = c;
  /* el quebracho: tronco ancho, copa de ramas quebradas, en silueta */
  const a = lienzoLM(W, H), q = a.getContext('2d');
  const piso = Math.round(H * (H > W ? 0.58 : 0.76)), cx = Math.round(W * 0.5);
  q.fillStyle = '#05040a';
  const tronco = Math.round(Math.min(W, H) * 0.15), alto = Math.round(Math.min(H * 0.3, W * 0.8));
  for (let y = piso - alto; y < piso + 2; y++) {
    const k = (y - (piso - alto)) / alto, ancho = tronco * (0.8 + k * k * 0.9);
    q.fillRect(Math.round(cx - ancho / 2 + Math.sin(y * 0.05) * 2), y, Math.round(ancho), 1);
  }
  const copa = (x, y, r) => { for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy * 1.6 <= r * r && ruidoLM(Math.round(x + xx) >> 1, Math.round(y + yy) >> 1, 96) > 0.12) q.fillRect(Math.round(x + xx), Math.round(y + yy), 1, 1); };
  const rama = (x, y, ang, largo, grosor) => {
    if (largo < 4 || grosor < 1) { copa(x, y, 3 + Math.round(ruidoLM(Math.round(x), Math.round(y), 97) * 4)); return; }
    const x2 = x + Math.cos(ang) * largo, y2 = y + Math.sin(ang) * largo;
    for (let i = 0; i <= largo; i++) { const t2 = i / largo; q.fillRect(Math.round(x + (x2 - x) * t2 - grosor / 2), Math.round(y + (y2 - y) * t2), Math.max(1, Math.round(grosor)), Math.max(1, Math.round(grosor))); }
    rama(x2, y2, ang - 0.45 + ruidoLM(Math.round(x2), Math.round(y2), 84) * 0.3, largo * 0.72, grosor * 0.66);
    rama(x2, y2, ang + 0.4 + ruidoLM(Math.round(y2), Math.round(x2), 85) * 0.3, largo * 0.66, grosor * 0.62);
  };
  const tope = piso - alto, L = Math.min(W, H) * (alta ? 0.17 : 0.19);
  rama(cx, tope + 4, -Math.PI / 2 - 0.62, L, tronco * 0.42);
  rama(cx, tope + 4, -Math.PI / 2 + 0.55, L * 0.95, tronco * 0.4);
  rama(cx, tope + 2, -Math.PI / 2 - 0.1, L * 0.75, tronco * 0.32);
  rama(cx, tope + 12, -Math.PI + 0.35, L * 0.7, tronco * 0.26);
  rama(cx, tope + 12, -0.35, L * 0.7, tronco * 0.26);
  /* la orilla: pasto bajo y el ranchito con su ventana */
  for (let x = 0; x < W; x++) {
    const h = 5 + Math.round(Math.sin(x * 0.07) * 2 + Math.sin(x * 0.19) * 2 + ruidoLM(x >> 2, 0, 86) * 3);
    q.fillRect(x, piso - h, 1, h + 3);
  }
  const rx = Math.round(W * 0.14);
  q.fillStyle = '#0a0812'; q.fillRect(rx, piso - 14, 14, 11); q.fillRect(rx - 2, piso - 16, 18, 3);
  q.fillStyle = '#ffcf80'; q.fillRect(rx + 4, piso - 11, 3, 3);
  Portada.arbol = a; Portada.piso = piso; Portada.tronco = tronco; Portada.alto = alto;
  /* el estero: abajo de la orilla el agua copia todo, un poco más oscuro y azul */
  const agua = Portada.agua = piso + 3, hondo = H - agua;
  const r = lienzoLM(W, Math.max(1, hondo)), rg = r.getContext('2d');
  rg.save(); rg.scale(1, -1);
  rg.drawImage(c, 0, 1 - agua); rg.drawImage(a, 0, 1 - agua);
  rg.restore();
  const osc = rg.createLinearGradient(0, 0, 0, hondo);
  osc.addColorStop(0, 'rgba(8,10,30,0.3)'); osc.addColorStop(1, 'rgba(6,5,16,0.72)');
  rg.fillStyle = osc; rg.fillRect(0, 0, W, hondo);
  Portada.reflejo = r;
  /* la luna en el agua: rayitas que titilan */
  Portada.luna = { x: lx, y: ly };
  Portada.bichos = Array.from({ length: 24 }, (_, i) => ({ x: ruidoLM(i, 7, 88) * W, y: piso - 16 - ruidoLM(i, 8, 89) * H * 0.34, f: ruidoLM(i, 9, 90) * 6 }))
    .concat(Array.from({ length: Math.round(hondo / 14) }, (_, i) => ({ x: ruidoLM(i, 17, 98) * W, y: agua + 8 + ruidoLM(i, 18, 99) * hondo * 0.7, f: ruidoLM(i, 19, 91) * 6, bajo: true })));
  /* juncos del frente, a los costados (se hamacan con el viento) */
  Portada.juncos = Array.from({ length: 22 }, (_, i) => {
    const lado = i % 2 ? 1 : 0, x = lado ? W - 2 - ruidoLM(i, 31, 71) * W * 0.3 : 2 + ruidoLM(i, 31, 71) * W * 0.3;
    return { x, largo: Math.round(hondo * (0.18 + ruidoLM(i, 32, 72) * 0.28) * (1 - Math.abs(x - (lado ? W : 0)) / (W * 0.4))), f: ruidoLM(i, 33, 73) * 6, cabeza: ruidoLM(i, 34, 74) > 0.55 };
  }).filter((j) => j.largo > 6);
  Portada.ondas = [];
}
function dibujarPortadaLM(g, t, conTitulo) {
  const W = Pantalla.W, H = Pantalla.H;
  prepararPortada(W, H);
  const P = Portada, agua = P.agua, hondo = H - agua;
  g.drawImage(P.estrellas, 0, 0, W, agua, 0, 0, W, agua);
  for (let i = 0; i < 8; i++) if (Math.sin(t * 2 + i * 1.7) > 0.8) { g.fillStyle = '#ffffff'; g.fillRect(Math.floor(ruidoLM(i, 11, 92) * W), Math.floor(ruidoLM(i, 12, 93) * H * 0.5), 1, 1); }
  g.drawImage(P.arbol, 0, 0, W, agua, 0, 0, W, agua);
  /* el agua: cada renglón del reflejo se corre un poquito, más cuanto más cerca */
  for (let y = 0; y < hondo; y += 1) {
    const o = Math.round(Math.sin(y * 0.33 - t * 2.4) * (0.4 + y * 0.018) + Math.sin(y * 0.11 + t * 1.3) * 0.6);
    g.drawImage(P.reflejo, 0, y, W, 1, o, agua + y, W, 1);
  }
  /* la luna se rompe en rayitas sobre el agua */
  const lx = P.luna.x;
  for (let i = 0; i < 16; i++) {
    const yy = agua + 3 + i * Math.max(3, hondo / 20), on = Math.sin(t * 3 + i * 2.3);
    if (on < -0.2 || yy > H - 4) continue;
    const w = Math.round(2 + (1 - i / 16) * 6 * (0.6 + on * 0.4));
    g.fillStyle = `rgba(255,246,216,${0.12 + on * 0.1})`;
    g.fillRect(Math.round(lx - w / 2 + Math.sin(t * 1.7 + i) * 2), Math.round(yy), w, 1);
  }
  /* de vez en cuando una onda (un pez, una gota) */
  if (Math.random() < Reloj.d * 0.8) P.ondas.push({ x: ruidoLM(Math.floor(t * 10), 41, 61) * W, y: agua + 6 + ruidoLM(Math.floor(t * 10), 42, 62) * (hondo - 30), t: 0 });
  for (let i = P.ondas.length - 1; i >= 0; i--) {
    const o = P.ondas[i]; o.t += Reloj.d;
    if (o.t > 2.2) { P.ondas.splice(i, 1); continue; }
    const rr = 2 + o.t * 11, a = 0.35 * (1 - o.t / 2.2);
    g.fillStyle = `rgba(200,210,255,${a})`;
    for (let k = 0; k < 28; k++) { const an = k / 28 * Math.PI * 2; g.fillRect(Math.round(o.x + Math.cos(an) * rr), Math.round(o.y + Math.sin(an) * rr * 0.28), 1, 1); }
  }
  /* adentro del tronco, las ventanitas del pueblo titilan (y se copian en el agua) */
  const cx = W / 2, piso = P.piso;
  for (let i = 0; i < 5; i++) {
    const x = Math.round(cx - P.tronco * 0.3 + ruidoLM(i, 5, 87) * P.tronco * 0.6), y = Math.round(piso - P.alto * 0.14 - i * P.alto * 0.15);
    const on = Math.sin(t * 0.7 + i * 2.1) > -0.5;
    g.fillStyle = on ? '#e8a050' : '#5a3a1e'; g.fillRect(x, y, 2, 2);
    if (on) { brillo(g, x + 1, y + 1, 5, '255,190,110', 0.25); const ry = 2 * agua - y; if (ry < H) { g.fillStyle = 'rgba(232,160,80,0.35)'; g.fillRect(x + Math.round(Math.sin(t * 2 + i)), ry, 2, 1); } }
  }
  g.globalCompositeOperation = 'lighter';
  const espejo = (x, y, r, rgb, a) => { const ry = 2 * agua - y; if (ry > agua && ry < H) brillo(g, x + Math.sin(ry * 0.3 - t * 2.4), ry, r, rgb, a * 0.45); };
  for (const b of P.bichos) {
    const x = b.x + Math.sin(t * 0.4 + b.f) * 14, y = b.y + Math.sin(t * 0.7 + b.f * 2) * 6, on = Math.sin(t * 1.6 + b.f * 3);
    if (on < 0.1) continue;
    brillo(g, x, y, 5, '200,255,112', 0.35 * on);
    g.fillStyle = '#f6ffa8'; g.fillRect(Math.round(x), Math.round(y), 1, 1);
    if (!b.bajo) espejo(x, y, 4, '200,255,112', 0.35 * on);
  }
  /* la luz mala: va y viene, en un ocho, con estela (y el agua la repite) */
  const ly = piso - P.alto * 0.55;
  for (let i = 14; i >= 0; i--) {
    const tt = t - i * 0.045, x = cx + Math.sin(tt * 0.9) * W * 0.3, y = ly + Math.sin(tt * 1.8) * P.alto * 0.16;
    if (i === 0) { brillo(g, x, y, 22, '246,255,168', 0.5); brillo(g, x, y, 6, '255,255,255', 0.8); espejo(x, y, 18, '246,255,168', 0.5); }
    else { g.fillStyle = `rgba(246,255,168,${0.5 - i * 0.03})`; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
  }
  g.globalCompositeOperation = 'source-over';
  /* los juncos del frente, en silueta */
  for (const j of P.juncos) {
    const viento = Math.sin(t * 0.9 + j.f) * 0.08 + Math.sin(t * 2.3 + j.f * 2) * 0.02;
    for (let k = 0; k < j.largo; k++) {
      const u = k / j.largo, x = Math.round(j.x + viento * u * u * j.largo), w = u < 0.6 ? 2 : 1;
      g.fillStyle = '#020104'; g.fillRect(x, H - k, w, 1);
      g.fillStyle = '#2a2444'; g.fillRect(x + w, H - k, 1, 1);
    }
    if (j.cabeza) {
      const x = Math.round(j.x + viento * j.largo) - 1, y = H - j.largo - 6;
      g.fillStyle = '#120a0c'; g.fillRect(x, y, 3, 7);
      g.fillStyle = '#3a2a30'; g.fillRect(x + 3, y + 1, 1, 5);
      g.fillStyle = '#020104'; g.fillRect(x + 1, y - 3, 1, 3);
    }
  }
  if (conTitulo) tituloLM(g, W, H, t);
}
/* el título: la letra fina, grande, con una luz que lo recorre y a veces se corta */
function tituloLM(g, W, H, t) {
  const e = W >= 300 ? 4 : 3, y = Math.round(H * (H > W ? 0.12 : 0.1)), tit = 'LUZ MALA';
  const ancho = anchoFino(tit, 2) * e;
  const corte = Math.sin(t * 13) > 0.95 || (t % 7 > 6.7 && Math.sin(t * 40) > 0);
  g.globalCompositeOperation = 'lighter';
  brillo(g, W / 2, y + 10 * e / 3, ancho * 0.55, '160,200,70', corte ? 0.08 : 0.22);
  g.globalCompositeOperation = 'source-over';
  textoFino(g, tit, W / 2, y, { alin: 'centro', escala: e, esp: 2, col: corte ? '#8f84a6' : '#f6ffd0', halo: corte ? null : '#c8f070' });
  /* la luz que pasa por las letras */
  const barrido = ((t * 0.35) % 1.6) - 0.3;
  if (barrido > 0 && barrido < 1 && !corte) {
    const bx = W / 2 - ancho / 2 + barrido * ancho;
    g.globalCompositeOperation = 'lighter';
    const grd = g.createLinearGradient(bx - 12, 0, bx + 12, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.5, 'rgba(255,255,230,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(bx - 12, y - 4, 24, 9 * e);
    g.globalCompositeOperation = 'source-over';
  }
  const ys = y + 9 * e + 6;
  adornoLM(g, W / 2, ys, Math.min(W - 40, ancho), 1);
  textoFino(g, tr('lema1'), W / 2, ys + 8, { alin: 'centro', col: '#e8c890', halo: '#ffb050' });
  textoFino(g, tr('lema2'), W / 2, ys + 19, { alin: 'centro', col: '#e8c890', halo: '#ffb050' });
}

/* ---------------- la intro: la luz escribe y dibuja, sobre negro ----------------
   Cada frase tiene un dibujo hecho de trazos (en una grilla de 20 x 14): la
   luciérnaga lo va trazando mientras se escribe el texto y deja su luz */
const DIBUJOS_INTRO = (() => {
  const ocho = [], onda = [], circ = (cx, cy, r, n, ry) => Array.from({ length: n + 1 }, (_, k) => [cx + Math.cos(k / n * Math.PI * 2) * r, cy + Math.sin(k / n * Math.PI * 2) * (ry || r)]);
  for (let k = 0; k <= 48; k++) { const a = k / 48 * Math.PI * 2; ocho.push([10 + Math.sin(a) * 8, 7 + Math.sin(a * 2) * 3.2]); }
  for (let k = 0; k <= 30; k++) onda.push([1 + k * 0.6, 12.5 + Math.sin(k * 0.7) * 0.6]);
  const farol = (x, y) => [[[x, y - 2.2], [x, y - 1.2]], [[x - 1, y - 1.2], [x + 1, y - 1.2], [x + 1, y + 1.4], [x - 1, y + 1.4], [x - 1, y - 1.2]], [[x, y + 0.8], [x, y - 0.2]]];
  const rayos = [];
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + 0.2; rayos.push([[10 + Math.cos(a) * 4.8, 6.5 + Math.sin(a) * 4.8], [10 + Math.cos(a) * 6.8, 6.5 + Math.sin(a) * 6.8]]); }
  const tela = [];
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; tela.push([[10, 7], [10 + Math.cos(a) * 3.4, 7 + Math.sin(a) * 3.4]]); }
  return [
    /* el quebracho, con su puertita y su ventana */
    { trazos: [[[2, 14], [18, 14]], [[8, 14], [8.5, 8], [7, 5]], [[12, 14], [11.5, 8], [13, 5]], [[7, 5], [4, 3], [1.5, 3.4]], [[7, 5], [6, 2], [7, 0.4]], [[13, 5], [14, 2], [13, 0.4]], [[13, 5], [16, 3], [18.5, 3.4]], [[10, 6.2], [10, 1]],
      [[9.3, 14], [9.3, 11.6], [10.7, 11.6], [10.7, 14]], [[9.6, 9], [10.4, 9], [10.4, 9.8], [9.6, 9.8], [9.6, 9]]], luz: [[10.7, 12.8], [10, 9.4]] },
    /* los tres faroles: raíces, telaraña y corazón */
    { trazos: [onda, ...farol(4, 10.5), ...tela, circ(10, 7, 2.2, 6), ...farol(10, 7), [[16, 5.9], [13.3, 3.3], [13.3, 1.7], [14.5, 0.8], [16, 1.9], [17.5, 0.8], [18.7, 1.7], [18.7, 3.3], [16, 5.9]], ...farol(16, 3.2)], luz: [[4, 10.6], [10, 7.1], [16, 3.3]] },
    /* se apagan y queda una luz sola que va y viene, en un ocho */
    { trazos: [ocho], cabeza: true },
    /* la luz mala: redonda, con rayos */
    { trazos: [circ(10, 6.5, 3.6, 20), ...rayos], luz: [[10, 6.5]] },
    /* esa luz era yo: Chispa */
    { trazos: [circ(6.6, 6.4, 1.2, 10), circ(10.8, 7, 3, 18, 1.7), [[8.6, 5.8], [9.6, 2.6], [12.2, 2], [12, 5.4]], [[10, 5.4], [12.6, 3.4], [15.2, 3.6], [13.2, 5.8]],
      [[6, 5.3], [4.8, 3], [3.8, 2.6]], [[6.6, 5.2], [6.2, 2.8], [5.6, 2.1]], [[9, 8.4], [8.4, 10]], [[10.6, 8.7], [10.4, 10.4]], [[12.2, 8.6], [12.8, 10.2]]], luz: [[13.6, 7.2]], grande: true },
  ];
})();
const DibIntro = { i: -1, c: null, hecho: 0, listo: false, tListo: 0, viejo: null, tViejo: 0 };
function trazosIntro(d) {
  /* los trazos en segmentos seguidos; entre trazo y trazo la luciérnaga vuela sin dejar luz */
  const segs = [];
  let px = null, py = null;
  for (const tr of d.trazos) {
    tr.forEach(([x, y], k) => {
      if (px != null) segs.push({ x0: px, y0: py, x1: x, y1: y, luz: k > 0, l: Math.hypot(x - px, y - py) * (k > 0 ? 1 : 0.35) });
      px = x; py = y;
    });
  }
  d.segs = segs; d.total = segs.reduce((s, q) => s + q.l, 0);
}
function dibujarIntro(g, J, t) {
  const W = Pantalla.W, H = Pantalla.H, I = J.intro, textos = TX().intro;
  g.fillStyle = '#050308'; g.fillRect(0, 0, W, H);
  const alta = H > W;
  /* polvito que flota en la oscuridad */
  for (let i = 0; i < 26; i++) {
    const x = (ruidoLM(i, 51, 21) * W + t * (3 + ruidoLM(i, 52, 22) * 4)) % W, y = (ruidoLM(i, 53, 23) * H - t * 2 + H) % H;
    g.fillStyle = `rgba(143,132,166,${0.12 + 0.1 * Math.sin(t + i)})`; g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  const txt = textos[I.i] || '', n = Math.floor(I.n), largo = Array.from(txt).length;
  /* el dibujo de esta frase */
  const d = DIBUJOS_INTRO[I.i] || DIBUJOS_INTRO[0];
  if (!d.segs) trazosIntro(d);
  const bw = Math.min(W - 44, alta ? 150 : 130), esc = Math.min(bw / 20, (alta ? H * 0.3 : H * 0.4) / 14) * (d.grande ? 1.1 : 1);
  const dw = Math.ceil(20 * esc) + 8, dh = Math.ceil(14 * esc) + 8;
  const bx = Math.round(W / 2 - dw / 2), by = Math.round((alta ? H * 0.3 : H * 0.28) - dh / 2);
  if (DibIntro.i !== I.i) {
    if (DibIntro.c) { DibIntro.viejo = DibIntro.c; DibIntro.vx = DibIntro.x; DibIntro.vy = DibIntro.y; DibIntro.tViejo = 0; }
    DibIntro.i = I.i; DibIntro.c = lienzoLM(dw, dh); DibIntro.hecho = 0; DibIntro.listo = false; DibIntro.x = bx; DibIntro.y = by;
  }
  const dur = lim(largo / 33, 1.6, 3.2);
  const meta = I.salto ? d.total : Math.min(d.total, I.t / dur * d.total);
  /* traza lo que falta desde la última vez, de a medio píxel */
  const q = DibIntro.c.getContext('2d');
  let cabeza = null, acum = 0;
  for (const sg of d.segs) {
    const a0 = acum, a1 = acum + sg.l; acum = a1;
    if (a1 <= DibIntro.hecho) { cabeza = [sg.x1, sg.y1]; continue; }
    if (a0 >= meta) break;
    const u0 = Math.max(0, (DibIntro.hecho - a0) / (sg.l || 1)), u1 = Math.min(1, (meta - a0) / (sg.l || 1));
    const largoPx = Math.hypot(sg.x1 - sg.x0, sg.y1 - sg.y0) * esc, pasos = Math.max(1, Math.ceil(largoPx * (u1 - u0) * 2));
    for (let k = 0; k <= pasos; k++) {
      const u = u0 + (u1 - u0) * k / pasos, x = 4 + (sg.x0 + (sg.x1 - sg.x0) * u) * esc, y = 4 + (sg.y0 + (sg.y1 - sg.y0) * u) * esc;
      if (sg.luz) { q.fillStyle = 'rgba(200,255,112,0.07)'; q.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); q.fillStyle = 'rgba(246,255,168,0.85)'; q.fillRect(Math.round(x), Math.round(y), 1, 1); }
      cabeza = [sg.x0 + (sg.x1 - sg.x0) * u, sg.y0 + (sg.y1 - sg.y0) * u];
    }
  }
  DibIntro.hecho = Math.max(DibIntro.hecho, meta);
  const listo = DibIntro.hecho >= d.total - 0.001;
  if (listo && !DibIntro.listo) DibIntro.tListo = 0;
  DibIntro.listo = listo;
  if (listo) DibIntro.tListo += Reloj.d;
  /* el dibujo anterior se apaga despacio */
  if (DibIntro.viejo) {
    DibIntro.tViejo += Reloj.d;
    const a = 1 - DibIntro.tViejo / 0.7;
    if (a <= 0) DibIntro.viejo = null;
    else { g.globalAlpha = a * 0.8; g.drawImage(DibIntro.viejo, DibIntro.vx, DibIntro.vy); g.globalAlpha = 1; }
  }
  const respira = listo ? 0.82 + Math.sin(t * 2.2) * 0.18 : 1;
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = respira; g.drawImage(DibIntro.c, bx, by); g.globalAlpha = 1;
  /* los puntos que se prenden cuando el dibujo está terminado (faroles, ventana, la cola de Chispa) */
  if (listo && d.luz) d.luz.forEach(([x, y], k) => { const on = Math.min(1, DibIntro.tListo * 2.5 - k * 0.3); if (on > 0) { brillo(g, bx + 4 + x * esc, by + 4 + y * esc, 13 + (d.grande ? 8 : 0), '255,214,120', 0.7 * on * respira); g.fillStyle = '#fff6d8'; g.fillRect(Math.round(bx + 4 + x * esc), Math.round(by + 4 + y * esc), 1, 1); } });
  g.globalCompositeOperation = 'source-over';
  /* la luciérnaga que dibuja: en la punta del trazo; en el ocho se queda dando vueltas */
  if (cabeza && (!listo || d.cabeza)) {
    let [hx, hy] = cabeza;
    if (listo && d.cabeza) { const a = t * 1.3; hx = 10 + Math.sin(a) * 8; hy = 7 + Math.sin(a * 2) * 3.2; }
    luciernaga(g, bx + 4 + hx * esc, by + 4 + hy * esc, t, 1.2);
  }
  /* el texto, abajo del dibujo */
  const lineas = envolverFino(txt, Math.min(W - 28, 230));
  let cuenta = 0;
  const y0 = Math.round(by + dh + (alta ? 22 : 10));
  const ultima = I.i === textos.length - 1;
  lineas.forEach((l, k) => {
    const quedan = Math.max(0, n - cuenta), lar = Array.from(l).length;
    if (quedan > 0) textoFino(g, l, Math.round(W / 2 - anchoFino(l) / 2), y0 + k * 13, { col: ultima ? '#f6ffd0' : '#efe6d2', halo: ultima ? '#c8f070' : null, hasta: anchoHasta(l, Math.min(lar, quedan)) });
    cuenta += lar + 1;
  });
  /* los puntitos de "hay más": uno por frase, el de ahora prendido */
  const py = Math.round(Math.min(H - 16, y0 + lineas.length * 13 + 22));
  for (let k = 0; k < textos.length; k++) {
    const x = Math.round(W / 2 + (k - (textos.length - 1) / 2) * 8);
    g.fillStyle = k === I.i ? '#f6ffa8' : k < I.i ? '#6f6684' : '#2e2840'; g.fillRect(x, py, k === I.i ? 2 : 1, k === I.i ? 2 : 1);
  }
  if (n >= largo && listo) luciernaga(g, W / 2, py + 12 + Math.sin(t * 4) * 2, t, 0.6);
}

/* ---------------- los globos: el diálogo sale de quien habla ---------------- */
function dibujarGlobo(g, J, t) {
  const d = J.dialogo;
  if (!d) return;
  const W = Pantalla.W, l = d.lineas[d.i], m = J.mundo;
  const ox = -Math.round(VistaLM.x), oy = -Math.round(VistaLM.y);
  /* de quién sale: del bicho que habla, o de Chispa */
  let ax, ay;
  if (l.q === 'chispa' || !d.npc) { ax = ox + m.p.x + 4; ay = oy + m.p.y - 4; }
  else { ax = ox + d.npc.x + 8; ay = oy + d.npc.y - (d.npc.quien === 'mamboreta' ? 8 : d.npc.quien === 'canasto' ? 18 : 0); }
  const bw = Math.min(W - 12, 170), renglones = envolverFino(l.t, bw - 14);
  const bh = 20 + renglones.length * 11;
  const aparece = Math.min(1, d.t / 0.14), esc = 0.6 + aparece * 0.4;
  const bx = Math.round(lim(ax - bw / 2, 6, W - bw - 6));
  let by = Math.round(ay - bh - 10);
  if (by < 6) by = 6;
  g.save();
  g.translate(ax, by + bh); g.scale(esc, esc); g.translate(-ax, -(by + bh));
  g.globalAlpha = aparece;
  /* el globo: redondeado a mano, con la colita hacia quien habla */
  const fondo = l.q === 'chispa' ? '#1d2410' : '#1a1426', borde = l.q === 'chispa' ? '#b4e858' : '#8f84a6';
  g.fillStyle = borde;
  g.fillRect(bx + 2, by, bw - 4, bh); g.fillRect(bx, by + 2, bw, bh - 4); g.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
  g.fillStyle = fondo;
  g.fillRect(bx + 2, by + 1, bw - 4, bh - 2); g.fillRect(bx + 1, by + 2, bw - 2, bh - 4);
  const tx = lim(Math.round(ax), bx + 8, bx + bw - 9);
  for (let k = 0; k < 5; k++) { g.fillStyle = borde; g.fillRect(tx - (4 - k), by + bh + k - 1, (4 - k) * 2 + 1, 1); g.fillStyle = fondo; if (k < 3) g.fillRect(tx - (3 - k), by + bh + k - 1, (3 - k) * 2 + 1, 1); }
  textoFino(g, TX().nombres[l.q] || '', bx + 7, by + 5, { col: l.q === 'chispa' ? '#dff5a0' : '#ffd98a' });
  let quedan = Math.floor(d.n);
  renglones.forEach((ln, k) => {
    const largo = Array.from(ln).length;
    if (quedan > 0) textoFino(g, ln, bx + 7, by + 16 + k * 11, { col: '#efe6d2', hasta: anchoHasta(ln, Math.min(largo, quedan)) });
    quedan -= largo + 1;
  });
  g.restore();
  if (d.n >= Array.from(l.t).length) luciernaga(g, bx + bw - 9, by + bh - 7 + Math.sin(t * 5) * 1.5, t, 0.7);
}

/* ---------------- carteles ---------------- */
/* el nombre de la zona: aparece de a una letra, con la sala abajo, chiquita */
function dibujarZonaNombre(g, J) {
  const z = J.cartelZona;
  if (!z) return;
  const W = Pantalla.W, a = z.t < 0.5 ? z.t / 0.5 : z.t > 3.1 ? Math.max(0, 1 - (z.t - 3.1) / 0.9) : 1;
  if (a <= 0) return;
  const txt = TX().zonas[z.zona] || '', y = Math.round(VistaLM.usable * 0.26);
  const letras = Array.from(txt), n = Math.min(letras.length, Math.floor(z.t * 18));
  const w = anchoFino(txt, 2) * 2;
  textoFino(g, letras.slice(0, n).join(''), Math.round(W / 2 - w / 2), y, { escala: 2, esp: 2, col: '#efe6d2', halo: '#f6ffa8', alfa: a });
  adornoLM(g, W / 2, y + 22, Math.min(W - 30, w + 24), Math.min(1, z.t / 1.1));
  const sub = nombreSala(z.sala);
  if (sub && sub.toLowerCase() !== txt.toLowerCase()) textoFino(g, sub, W / 2, y + 30, { alin: 'centro', col: '#a89cb8', alfa: a * lim(z.t - 0.8, 0, 1) });
}
function dibujarCartelJefe(g, J) {
  const c = J.cartelJefe;
  if (!c) return;
  const W = Pantalla.W, a = c.t < 0.4 ? c.t / 0.4 : c.t > 2.6 ? Math.max(0, 1 - (c.t - 2.6) / 0.6) : 1;
  if (a <= 0) return;
  const txt = TX().jefes[c.tipo], y = Math.round(VistaLM.usable * 0.64);
  const e = anchoFino(txt.nombre, 2) * 2 < W - 24 ? 2 : 1;
  textoFino(g, txt.sub, W / 2, y, { alin: 'centro', col: '#c8bcd8', alfa: a });
  textoFino(g, txt.nombre, W / 2, y + 12, { alin: 'centro', escala: e, esp: 2, col: '#ffd0c0', halo: '#ff6a5a', alfa: a });
}
function dibujarAvisoLM(g, J) {
  const a = J.aviso;
  if (!a) return;
  const k = a.t < 0.25 ? a.t / 0.25 : a.t > 2 ? Math.max(0, 1 - (a.t - 2) / 0.5) : 1;
  if (k <= 0) return;
  const txt = a.crudo ? a.txt : tr(a.txt), W = Pantalla.W;
  envolverFino(txt, W - 30).forEach((l, i) => textoFino(g, l, W / 2, Math.round(VistaLM.usable * 0.18) + i * 11, { alin: 'centro', col: a.col || '#efe6d2', halo: '#f6ffa8', alfa: k }));
}
/* lo que se encuentra: el ícono grande, con rayos de luz que giran detrás */
function dibujarHallazgo(g, J, t) {
  const h = J.hallazgo;
  if (!h) return;
  const W = Pantalla.W, H = VistaLM.usable, [titulo, txt] = TX().hallazgos[h.q];
  const k = Math.min(1, h.t / 0.4);
  velo(g, 0.65 * k);
  const cx = W / 2, cy = Math.round(H * 0.4);
  g.save(); g.globalCompositeOperation = 'lighter'; g.translate(cx, cy); g.rotate(t * 0.35);
  for (let i = 0; i < 10; i++) {
    g.rotate(Math.PI / 5);
    const grd = g.createLinearGradient(0, 0, 0, -70);
    grd.addColorStop(0, `rgba(246,255,168,${0.22 * k})`); grd.addColorStop(1, 'rgba(246,255,168,0)');
    g.fillStyle = grd; g.beginPath(); g.moveTo(0, 0); g.lineTo(-7, -70); g.lineTo(7, -70); g.closePath(); g.fill();
  }
  g.restore();
  g.globalCompositeOperation = 'lighter'; brillo(g, cx, cy, 30, '246,255,168', 0.4 * k); g.globalCompositeOperation = 'source-over';
  const nombre = { aleteo: 'dash', resina: 'salto' }[h.q] || 'curar';
  const ic = iconoLM(nombre, '#fbffd8', 1), s = 2 + Math.round(k);
  g.drawImage(ic, Math.round(cx - 6.5 * s), Math.round(cy - 6.5 * s), 13 * s, 13 * s);
  textoFino(g, titulo, cx, cy + 30, { alin: 'centro', escala: anchoFino(titulo, 2) * 2 < W - 20 ? 2 : 1, esp: 2, col: '#f6ffd0', halo: '#c8f070', alfa: k });
  envolverFino(txt, Math.min(W - 36, 220)).forEach((l, i) => textoFino(g, l, cx, cy + 56 + i * 11, { alin: 'centro', col: '#efe6d2', alfa: lim((h.t - 0.4) / 0.4, 0, 1) }));
  if (h.t > 0.9) luciernaga(g, cx, cy + 90 + Math.sin(t * 4) * 2, t, 0.7);
}
function dibujarMuerte(g, J, t) {
  const m = J.muerte;
  if (!m) return;
  const W = Pantalla.W, H = Pantalla.H;
  /* la oscuridad entra desde los bordes y se come la luz de Chispa */
  const k = Math.min(1, m.t / 1.2);
  const cx = -Math.round(VistaLM.x) + J.mundo.p.x + 4, cy = -Math.round(VistaLM.y) + J.mundo.p.y + 6;
  const R = Math.max(1, (1 - k) * Math.max(W, H));
  const grd = g.createRadialGradient(cx, cy, R * 0.3, cx, cy, R + 1);
  grd.addColorStop(0, 'rgba(5,3,8,0)'); grd.addColorStop(1, `rgba(5,3,8,${0.4 + k * 0.6})`);
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  if (k >= 1) { g.fillStyle = 'rgba(5,3,8,0.9)'; g.fillRect(0, 0, W, H); }
  if (m.t > 1.0) {
    const a = Math.min(1, (m.t - 1.0) / 0.6), titila = Math.sin(t * 30) > 0.6 ? 0.6 : 1;
    const txt = tr('teApagaste'), e = anchoFino(txt, 2) * 2 < W - 20 ? 2 : 1;
    textoFino(g, txt, W / 2, Math.round(H * 0.4), { alin: 'centro', escala: e, esp: 2, col: '#8f84a6', alfa: a * titila });
    if (J.prog.sombra) textoFino(g, tr('tuLuz'), W / 2, Math.round(H * 0.4) + 24, { alin: 'centro', col: '#9fb8ff', alfa: a });
  }
}
/* las franjas de cine, el destello, el rojo del golpe y los orbes que vuelan a la vasija */
function dibujarCine(g, J, t) {
  const W = Pantalla.W;
  if (J.cine) {
    const c = J.cine, k = c.t < 0.4 ? c.t / 0.4 : c.t > 2 ? Math.max(0, 1 - (c.t - 2) / 0.4) : 1;
    const h = Math.round(18 * k);
    g.fillStyle = '#050308'; g.fillRect(0, 0, W, h); g.fillRect(0, VistaLM.usable - h, W, h);
  }
  if (J.flash > 0) { g.fillStyle = `rgba(255,252,236,${J.flash * 0.7})`; g.fillRect(0, 0, W, Pantalla.H); }
  if (J.golpeRojo > 0) {
    J.golpeRojo -= Reloj.d;
    const grd = g.createRadialGradient(W / 2, Pantalla.H / 2, Math.min(W, Pantalla.H) * 0.35, W / 2, Pantalla.H / 2, Math.max(W, Pantalla.H) * 0.7);
    grd.addColorStop(0, 'rgba(160,20,40,0)'); grd.addColorStop(1, `rgba(160,20,40,${Math.max(0, J.golpeRojo) * 0.7})`);
    g.fillStyle = grd; g.fillRect(0, 0, W, Pantalla.H);
  }
  g.globalCompositeOperation = 'lighter';
  for (const o of J.orbes) {
    if (o.t < 0) continue;
    brillo(g, o.x, o.y, 6, '246,255,168', 0.6);
    g.fillStyle = '#ffffff'; g.fillRect(Math.round(o.x), Math.round(o.y), 1, 1);
  }
  g.globalCompositeOperation = 'source-over';
}

/* ---------------- la pausa: el menú y lo que Chispa lleva ---------------- */
function dibujarPausa(g, m, t) {
  dibujarLista(g, m, t);
  const W = Pantalla.W, H = VistaLM.usable || Pantalla.H, p = J.mundo.p;
  const y = Math.round(H / 2 + m.items.length * 8 + 26);
  textoFino(g, tr('habilidades'), W / 2, y, { alin: 'centro', col: '#a89cb8' });
  adornoLM(g, W / 2, y + 11, 90, 1);
  const cosas = [{ ic: 'curar', on: true, n: p.vidaMax }, { ic: 'dash', on: !!Prog.habil.aleteo }, { ic: 'salto', on: !!Prog.habil.resina }];
  for (const id of ORDEN_TIENDA) cosas.push({ ic: id === 'espina' ? 'golpe' : 'curar', on: !!Prog.compras[id] });
  const paso = 20, x0 = W / 2 - (cosas.length - 1) * paso / 2;
  cosas.forEach((c, i) => {
    const x = Math.round(x0 + i * paso), yy = y + 18;
    if (c.on) { g.globalCompositeOperation = 'lighter'; brillo(g, x, yy + 6, 9, '246,255,168', 0.25); g.globalCompositeOperation = 'source-over'; }
    g.drawImage(iconoLM(c.ic, c.on ? '#f6ffd0' : '#3a3048', 1), x - 6, yy);
    if (c.n) textoFino(g, String(c.n), x + 5, yy + 9, { col: '#f6ffd0' });
  });
  textoFino(g, tr('pausaTxt', TX().zonas[J.mundo.sala.zona], p.ambar, reloj(Prog.tiempo)), W / 2, y + 40, { alin: 'centro', col: '#6f6684' });
}

/* ---------------- la tienda de Don Canasto ---------------- */
function dibujarTienda(g, m, t) {
  const W = Pantalla.W, H = VistaLM.usable || Pantalla.H, p = J.mundo.p;
  const s = SPR.npc.canasto[Math.floor(t * 1.5) % 2], cx = Math.round(W / 2), cy = Math.round(H * 0.28 + Math.sin(t * 1.1) * 2);
  g.fillStyle = 'rgba(210,200,180,0.5)'; g.fillRect(cx, 0, 1, Math.max(0, cy - 30));
  g.globalCompositeOperation = 'lighter'; brillo(g, cx, cy - 14, 40, '255,200,120', 0.18); g.globalCompositeOperation = 'source-over';
  g.save(); g.translate(cx, cy); g.scale(2, 2); dibujarSprite(g, s, 0, 0, 1); g.restore();
  textoFino(g, tr('tienda').toUpperCase(), cx, cy + 8, { alin: 'centro', esp: 2, col: '#ffd98a', halo: '#ffb050' });
  textoFino(g, tr('tenes', p.ambar), cx, cy + 20, { alin: 'centro', col: '#e8c890' });
  m.y0 = Math.round(cy + 42); m.paso = 15;
  dibujarLista(g, m, t);
  const it = m.items[m.sel];
  if (TX().tienda[it.id]) {
    const y = m.y0 + m.items.length * 15 + 8;
    envolverFino(TX().tienda[it.id][1], Math.min(W - 36, 210)).forEach((l, i) => textoFino(g, l, cx, y + i * 11, { alin: 'centro', col: '#a89cb8' }));
  }
  if (m.compra) {
    m.compra.t += Reloj.d;
    const k = m.compra.t / 0.8;
    if (k < 1) { g.globalCompositeOperation = 'lighter'; brillo(g, cx, m.y0 + ORDEN_TIENDA.indexOf(m.compra.id) * 15 + 3, 30 * (1 - k) + 6, '255,220,140', 0.6 * (1 - k)); g.globalCompositeOperation = 'source-over'; }
  }
  if (m.aviso) { m.aviso.t += Reloj.d; if (m.aviso.t < 1.4) textoFino(g, m.aviso.txt, cx, cy + 30, { alin: 'centro', col: '#ff9a8a', alfa: 1 - m.aviso.t / 1.4 }); }
}

/* ---------------- los créditos: suben despacio sobre el cielo ---------------- */
function dibujarCreditosLM(g, J, t) {
  const W = Pantalla.W, H = Pantalla.H;
  dibujarPortadaLM(g, t, false);
  velo(g, 0.55);
  const lineas = [{ t: 'LUZ MALA', titulo: true }];
  for (const c of TX().creditos) { lineas.push({ t: '' }); for (const l of envolverFino(c, Math.min(W - 30, 220))) lineas.push({ t: l }); }
  lineas.push({ t: '' }, { t: '' });
  for (const k of ['teclado', 'mando', 'toque']) { for (const l of envolverFino(tr(k), Math.min(W - 30, 220))) lineas.push({ t: l, gris: true }); lineas.push({ t: '' }); }
  const total = lineas.length * 12 + 40;
  let y = Math.round(H * 0.9 - (J.tCred * 14) % (total + H * 0.9));
  for (const l of lineas) {
    const a = lim(1 - Math.abs(y - H * 0.5) / (H * 0.45), 0, 1);
    if (l.titulo) { textoFino(g, l.t, W / 2, y, { alin: 'centro', escala: 3, esp: 2, col: '#f6ffd0', halo: '#c8f070', alfa: a }); y += 34; }
    else { if (l.t) textoFino(g, l.t, W / 2, y, { alin: 'centro', col: l.gris ? '#8f84a6' : '#efe6d2', alfa: a }); y += 12; }
  }
}

/* ---------------- el mapa: las salas vistas, dibujadas donde están ---------------- */
function dibujarMapa(g, J, t) {
  const W = Pantalla.W, H = Pantalla.H;
  const fondo = g.createLinearGradient(0, 0, 0, H);
  fondo.addColorStop(0, '#15100a'); fondo.addColorStop(1, '#0a0806');
  g.fillStyle = fondo; g.fillRect(0, 0, W, H);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const s of SALAS_LM) { x0 = Math.min(x0, s.pos[0]); y0 = Math.min(y0, s.pos[1]); x1 = Math.max(x1, s.pos[0] + s.tam[0]); y1 = Math.max(y1, s.pos[1] + s.tam[1]); }
  const mandos = VistaLM.mandos, alto = H - mandos - 50, k = Math.min((W - 16) / (x1 - x0), alto / (y1 - y0));
  const ox = Math.round((W - (x1 - x0) * k) / 2), oy = 30 + Math.round((alto - (y1 - y0) * k) / 2);
  textoFino(g, tr('elQuebracho'), W / 2, 8, { alin: 'centro', esp: 2, col: '#e8c890', halo: '#ffb050' });
  adornoLM(g, W / 2, 20, 100, 1);
  const vistas = J.prog.vistas;
  for (const s of SALAS_LM) {
    if (!vistas[s.id]) continue;
    const X = ox + (s.pos[0] - x0) * k, Y = oy + (s.pos[1] - y0) * k, Z = ZONA_ARTE[s.zona];
    for (let ty = 0; ty < s.tam[1]; ty++) for (let tx = 0; tx < s.tam[0]; tx++) {
      if (s.mapa[ty][tx] === '#') continue;
      g.fillStyle = s.id === J.mundo.sala.id ? '#e8d8b0' : Z.borde;
      g.fillRect(Math.floor(X + tx * k), Math.floor(Y + ty * k), Math.max(1, Math.ceil(k)), Math.max(1, Math.ceil(k)));
    }
    const cx = X + s.tam[0] * k / 2, cy = Y + s.tam[1] * k / 2;
    if (s.jefe && !J.prog.jefes[s.jefe]) { g.fillStyle = '#c42a3c'; g.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 3, 3); }
    for (let ty = 0; ty < s.tam[1]; ty++) { const tx = s.mapa[ty].indexOf('H'); if (tx >= 0) { g.fillStyle = '#4ad8c8'; g.fillRect(Math.round(X + tx * k) - 1, Math.round(Y + ty * k) - 1, 3, 2); } }
  }
  const s = J.mundo.sala, p = J.mundo.p;
  const px = ox + (s.pos[0] - x0 + (p.x + 4) / 8) * k, py = oy + (s.pos[1] - y0 + (p.y + 6) / 8) * k;
  g.globalCompositeOperation = 'lighter'; brillo(g, px, py, 7, '246,255,168', 0.5 + Math.sin(t * 5) * 0.2); g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#ffffff'; g.fillRect(Math.round(px), Math.round(py), 1, 1);
  const so = J.prog.sombra;
  if (so && SALA_POR_ID[so.sala]) { const ss = SALA_POR_ID[so.sala]; g.fillStyle = '#9fb8ff'; g.fillRect(Math.round(ox + (ss.pos[0] - x0 + so.x / 8) * k) - 1, Math.round(oy + (ss.pos[1] - y0 + so.y / 8) * k) - 1, 2, 2); }
  const ly = H - mandos - 16;
  textoFino(g, nombreSala(s.id) + ' · ' + TX().zonas[s.zona], W / 2, ly - 12, { alin: 'centro', col: '#efe6d2' });
  textoFino(g, tr('leyendaMapa'), W / 2, ly, { alin: 'centro', col: '#8f84a6' });
}

/* ---------------- el final ---------------- */
function dibujarFinalLM(g, J, t) {
  const W = Pantalla.W, H = Pantalla.H, F = J.final, T = TX();
  dibujarPortadaLM(g, t, false);
  const cx = W / 2, piso = Portada.piso;
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < Math.min(14, F.t * 1.5); i++) {
    const x = cx - 10 + ruidoLM(i, 21, 94) * 20, y = piso - 10 - ruidoLM(i, 22, 95) * H * 0.3;
    brillo(g, x, y, 10, '255,207,128', 0.45); g.fillStyle = '#ffe0a0'; g.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
  g.globalCompositeOperation = 'source-over';
  velo(g, 0.35);
  const dur = 4.5, i = Math.min(T.final.length - 1, Math.floor(F.t / dur));
  const k = (F.t % dur) / dur, a = F.t > T.final.length * dur ? 1 : k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1;
  if (F.t < T.final.length * dur) {
    envolverFino(T.final[i], Math.min(W - 28, 230)).forEach((l, n) => textoFino(g, l, W / 2, Math.round(H * 0.24) + n * 12, { alin: 'centro', col: i === T.final.length - 1 ? '#f6ffd0' : '#efe6d2', halo: i === T.final.length - 1 ? '#c8f070' : null, alfa: a }));
  } else {
    tituloLM(g, W, H, t);
    const y = Math.round(H * 0.44);
    textoFino(g, tr('fin'), W / 2, y, { alin: 'centro', escala: 2, esp: 3, col: '#ffd98a', halo: '#ffb050' });
    textoFino(g, tr('tiempoAmbar', reloj(J.prog.tiempo), J.mundo ? J.mundo.p.ambar : 0), W / 2, y + 26, { alin: 'centro', col: '#a89cb8' });
    if (Math.floor(t * 2) % 2) textoFino(g, tr('tocaVolver'), W / 2, y + 42, { alin: 'centro', col: '#efe6d2' });
  }
}

// La intro de JXSTUDIOS, en pixel art y rápida (dos segundos): un corte de
// luz abre la fibra de carbono, el monograma se escribe en metal con
// chispas en la punta, golpe (destello, sacudida, chispazo), una franja de
// brillo lo cruza y "JXSTUDIOS" se tipea abajo. Música y golpes van
// agendados con el reloj del audio (sonido.js › jingleJXS), así caen justo.
//
// Arranca sola, sin tocar nada (lo pidió quien pide, 30/09/2026). El
// navegador casi nunca deja sonar antes de un toque: se espera un instante
// en negro a que el audio arranque y, si arrancó, la música va en fase con
// el dibujo; si no, la intro va muda y el primer toque la saltea (ese toque
// ya prende el sonido para el resto).
import { P } from './paleta.js';
import { texto, anchoTexto } from './fuente.js';
import { monogramaPixel, puntas } from './logojxs.js';
import { salidaAtras, clamp } from './util.js';

const T_CORTE = 0.12, T_ABRE = 0.42, T_TRAZA0 = 0.3, T_TRAZA1 = 0.86, T_GOLPE = 0.88;
const T_BRILLO = [0.95, 1.35], T_LETRAS = 1.02, T_FIN = 2.1;

// La fibra de carbono de a píxel: sarga 2×2 en dos grises, con una reja de
// metal a 45° alrededor del rombo del centro (como en el logo).
function fondoCarbono(W, H, cx, cy, rombo) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sarga = ((x >> 1) + (y >> 1)) % 4 < 2;
    const luz = 1 - Math.min(1, Math.hypot(x - cx, y - cy) / Math.max(W, H));
    const v = (sarga ? 24 : 16) + Math.round(luz * 10);
    g.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
    g.fillRect(x, y, 1, 1);
  }
  // la reja: líneas a ±45° cada 22 px, afuera del rombo
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // afuera del rombo: |dx| + |dy| (con u y v la cuenta daba un cuadrado)
    if (Math.abs(x - cx) + Math.abs(y - cy) < rombo + 2) continue;
    const u = x - cx + (y - cy), v = x - cx - (y - cy);
    const eu = ((u % 22) + 22) % 22, ev = ((v % 22) + 22) % 22;
    if (eu < 2 || ev < 2) { g.fillStyle = eu === 0 || ev === 0 ? '#7a7e88' : '#44474f'; g.fillRect(x, y, 1, 1); }
  }
  // el borde del rombo, en metal
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.abs(x - cx) + Math.abs(y - cy) - rombo;
    if (d >= 0 && d < 3) { g.fillStyle = d < 1 ? '#9aa0aa' : '#4d5058'; g.fillRect(x, y, 1, 1); }
  }
  return c;
}

// El instante en negro antes de la intro: hasta 0,3 s para que el audio
// arranque (sin un toque casi nunca arranca), así la música no empieza tarde.
export class Espera {
  constructor(app, siguiente) {
    this.app = app; this.siguiente = siguiente; this.nombre = 'espera';
    this.desde = performance.now();
    app.sonido.despertar();
  }
  pasar() {
    if (this.app.sonido.activo() || performance.now() - this.desde > 300) this.app.escena = new IntroJXS(this.app, this.siguiente);
  }
  dibujar(g, W, H) { g.fillStyle = P.negro; g.fillRect(0, 0, W, H); }
}

export class IntroJXS {
  constructor(app, siguiente) {
    this.app = app; this.siguiente = siguiente; this.t = 0; this.nombre = 'intro';
    this.chispas = []; this.sacudida = 0; this.cambio = -1;
    this.golpeado = false; this.letras = 0; this.saliendo = false;
    this.musica = app.sonido.jingleJXS?.() || null;
    this.cache = { avance: -1, c: null };
  }

  armar(W, H) {
    this.cx = W >> 1; this.cy = Math.round(H * 0.42);
    this.ancho = Math.round(Math.min(W * 0.66, H * 0.9, 120));
    this.fondo = fondoCarbono(W, H, this.cx, this.cy, Math.min(W, H) * 0.44);
    this.cambio = this.app.cambio;
  }

  pasar(dt) {
    const app = this.app;
    this.t += dt;
    // un toque (después del primer instante) saltea
    if (this.t > 0.35 && !this.saliendo && app.entrada.cola.some((ev) => ev.tipo === 'bajar' || ev.tipo === 'confirmar')) {
      this.musica?.cortar();
      this.terminar();
      return;
    }
    // las chispas en la punta de cada trazo mientras se escribe
    if (this.t > T_TRAZA0 && this.t < T_TRAZA1 && this.puntas) {
      for (const [x, y] of this.puntas) for (let k = 0; k < 2; k++) {
        const a = Math.random() * Math.PI * 2, v = 20 + Math.random() * 50;
        this.chispas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, t: 0, vida: 0.25 + Math.random() * 0.2, col: Math.random() < 0.5 ? '#ffffff' : '#ffd27a' });
      }
    }
    if (!this.golpeado && this.t >= T_GOLPE) {
      this.golpeado = true;
      this.sacudida = 4;
      app.vibrar([30, 20, 40]);
      for (let k = 0; k < 70; k++) {
        const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 120;
        this.chispas.push({ x: this.cx + (Math.random() - 0.5) * this.ancho, y: this.cy + (Math.random() - 0.5) * this.ancho * 0.4, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, t: 0, vida: 0.5 + Math.random() * 0.5, col: ['#ffffff', '#ffd27a', '#c9ccd4', '#7ad7ff'][k % 4] });
      }
    }
    const letras = clamp(Math.floor((this.t - T_LETRAS) / 0.04) + 1, 0, 9);
    this.letras = letras;
    for (const c of this.chispas) { c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 120 * dt; c.vx *= 0.96; }
    this.chispas = this.chispas.filter((c) => c.t < c.vida);
    this.sacudida *= Math.pow(0.84, dt * 60);
    if (this.t >= T_FIN && !this.saliendo) this.terminar();
  }

  terminar() {
    this.saliendo = true;
    this.app.ir(this.siguiente);
  }

  dibujar(g, W, H) {
    if (this.cambio !== this.app.cambio) this.armar(W, H);
    const t = this.t, cx = this.cx, cy = this.cy;
    g.fillStyle = P.negro; g.fillRect(0, 0, W, H);
    const s = Math.round(this.sacudida), sx = s ? Math.round((Math.random() * 2 - 1) * s) : 0, sy = s ? Math.round((Math.random() * 2 - 1) * s) : 0;
    // el corte de luz y la fibra que se abre desde la raya
    if (t < T_CORTE) {
      const k = t / T_CORTE, w = Math.round(W * k);
      g.fillStyle = P.blanco; g.fillRect(Math.round(cx - w / 2), cy, w, 1);
      return;
    }
    const abre = clamp((t - T_CORTE) / (T_ABRE - T_CORTE), 0, 1), alto = Math.round((Math.max(cy, H - cy) + 4) * salidaAtras(abre));
    g.save();
    g.beginPath(); g.rect(0, cy - alto, W, alto * 2); g.clip();
    g.drawImage(this.fondo, sx, sy);
    g.restore();
    if (abre < 1) { g.fillStyle = '#d9dce3'; g.fillRect(0, cy - alto, W, 1); g.fillRect(0, cy + alto - 1, W, 1); }
    // el monograma que se escribe (se vuelve a trazar mientras avanza)
    const avance = clamp((t - T_TRAZA0) / (T_TRAZA1 - T_TRAZA0), 0, 1);
    if (avance > 0) {
      const a = Math.round(avance * 40) / 40;
      if (this.cache.avance !== a) this.cache = { avance: a, c: monogramaPixel(this.ancho, { avance: a }) };
      const m = this.cache.c;
      const x0 = Math.round(cx - m.width / 2) + sx, y0 = Math.round(cy - m.height / 2) + sy;
      // las puntas donde se está escribiendo (ahí salen las chispas)
      this.puntas = avance < 1 ? puntas(avance).map(([px, py]) => [x0 + 2 + px * m.esc, y0 + 2 + py * m.esc]) : null;
      g.drawImage(m, x0, y0);
      // el golpe: un destello de dos cuadros
      if (t >= T_GOLPE && t < T_GOLPE + 0.06) { g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(0, 0, W, H); }
      // la franja de brillo: una diagonal blanca que recorre solo el metal
      if (t > T_BRILLO[0] && t < T_BRILLO[1]) {
        const k = (t - T_BRILLO[0]) / (T_BRILLO[1] - T_BRILLO[0]), bx = Math.round(-10 + k * (m.width + 20));
        g.fillStyle = 'rgba(255,255,255,0.6)';
        for (let y = 0; y < m.height; y++) for (let dx = -2; dx <= 2; dx++) {
          const px = bx + dx - Math.round(y * 0.5);
          if (px >= 0 && px < m.width && m.mascara[y * m.width + px]) g.fillRect(x0 + px, y0 + y, 1, 1);
        }
      }
    }
    // JXSTUDIOS, tipeado de a una letra
    if (this.letras > 0) {
      const esc = W >= 200 ? 2 : 1, palabra = 'JXSTUDIOS', ancho = anchoTexto(palabra, esc);
      const x = Math.round(cx - ancho / 2), y = Math.round(cy + this.ancho * 0.29 + 4);
      texto(g, palabra.slice(0, this.letras), x + sx, y + sy, '#e4e6ec', { esc, sombra: '#3d4048' });
      if (this.letras < 9 && ((t * 20) | 0) % 2) { g.fillStyle = P.blanco; g.fillRect(x + anchoTexto(palabra.slice(0, this.letras), esc) + esc, y + 2 * esc, esc, 7 * esc); }
      if (t > T_LETRAS + 0.5) texto(g, this.app.tr('presenta'), cx, y + 12 * esc, '#8d88ad', { alinear: 'centro' });
    }
    for (const c of this.chispas) {
      if (c.t > c.vida * 0.7 && ((c.t * 30) | 0) % 2) continue;
      g.fillStyle = c.col; g.fillRect(Math.round(c.x), Math.round(c.y), 1, 1);
    }
  }
}

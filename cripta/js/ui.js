// La interfaz dibujada en el lienzo (nada de HTML: así es pixel art igual
// que el juego y la escala entera vale para todo). Botones de piedra con
// borde de neón que se hunden al tocarlos, paneles, el iris de las
// transiciones y el fondo de los menús.
import { P, MUNDOS_COLOR } from './paleta.js';
import { texto, anchoTexto } from './fuente.js';
import { salidaAtras, clamp } from './util.js';
import { patronRoca } from './nivel.js';
import * as S from './sprites.js';

// ── botones ────────────────────────────────────────────────────────────────
export class Boton {
  constructor(op) {
    Object.assign(this, {
      id: '', texto: '', icono: null, x: 0, y: 0, w: 60, h: 18, color: MUNDOS_COLOR[0].borde, accion: null,
      retraso: 0, t: 0, apretado: false, meneo: 0, desactivado: false, visible: true, esc: 1, sub: null, colorTexto: P.blanco,
    }, op);
  }
  contiene(px, py) { return this.visible && px >= this.x && px < this.x + this.w && py >= this.y - 2 && py < this.y + this.h + 3; }
  sacudir() { this.meneo = 0.35; }
  pasar(dt) { this.t += dt; if (this.meneo > 0) this.meneo -= dt; }
  // cuánto le falta para estar en su lugar (0 = llegó)
  entrada() {
    const k = clamp((this.t - this.retraso) / 0.4, 0, 1);
    return k;
  }
  dibujar(g, foco = false) {
    if (!this.visible) return;
    const k = this.entrada();
    if (k <= 0) return;
    const ox = this.meneo > 0 ? Math.round(Math.sin(this.meneo * 70) * 2) : 0;
    const oy = Math.round((1 - salidaAtras(k)) * 24);
    const hundido = this.apretado ? 2 : 0;
    const x = Math.round(this.x + ox), y = Math.round(this.y + oy), w = this.w, h = this.h;
    const col = this.desactivado ? P.grisOsc : this.color;
    // grosor de la piedra (se ve abajo cuando no está apretado)
    g.fillStyle = P.negro; g.fillRect(x - 1, y - 1 + hundido, w + 2, h + 2 + (2 - hundido));
    g.fillStyle = oscuro(col); g.fillRect(x, y + h - 1 + hundido, w, 2 - hundido + 1);
    // la cara
    const yc = y + hundido;
    g.fillStyle = col; g.fillRect(x, yc, w, h);
    g.fillStyle = this.apretado ? '#241e46' : P.fondo3; g.fillRect(x + 1, yc + 1, w - 2, h - 2);
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x + 1, yc + 1, w - 2, 1);
    // el neón titila de vez en cuando, cada botón a su ritmo
    const titila = ((this.t * 1.3 + this.x * 0.07) % 4) > 3.9;
    if (titila && !this.desactivado) { g.fillStyle = P.blanco; g.fillRect(x, yc, w, 1); }
    if (foco) {
      g.fillStyle = P.blanco;
      const f = ((this.t * 4) | 0) % 2;
      g.fillRect(x - 4 - f, yc + h / 2 - 2, 2, 5); g.fillRect(x + w + 2 + f, yc + h / 2 - 2, 2, 5);
    }
    // contenido: ícono y texto centrados
    const esc = this.esc, tw = this.texto ? anchoTexto(this.texto, esc) : 0;
    // si el ícono no entra al lado del texto, se va: el texto manda
    const conIcono = this.icono && (!this.texto || this.icono.width + 3 + tw <= w - 6);
    const iw = conIcono ? this.icono.width : 0, hueco = conIcono && this.texto ? 3 : 0;
    const total = iw + hueco + tw;
    let cx = Math.round(x + w / 2 - total / 2);
    const cy = yc + Math.round(h / 2);
    if (conIcono) { g.drawImage(this.icono, cx, Math.round(cy - this.icono.height / 2)); cx += iw + hueco; }
    if (this.texto) texto(g, this.texto, cx, cy - Math.round(4.5 * esc) - (this.sub ? 3 : 0), this.desactivado ? P.gris : this.colorTexto, { esc, sombra: P.negro });
    if (this.sub) texto(g, this.sub, x + w / 2, cy + 1, P.gris, { alinear: 'centro' });
  }
}

function oscuro(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v * 0.45).toString(16).padStart(2, '0');
  return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255);
}

// Un grupo de botones que se manejan juntos: con el dedo (se hunde al bajar,
// se activa al soltar adentro) y con el teclado (flechas y Enter).
export class Botonera {
  constructor(sonido, { teclado = true } = {}) { this.botones = []; this.foco = -1; this.sonido = sonido; this.bajado = null; this.teclado = teclado; this.antes = new Map(); }
  // Un botón que vuelve a armarse con el mismo id (después de comprar, de
  // cambiar el idioma) no repite la entrada: si no, toda la pantalla vuelve
  // a caer y por medio segundo no se puede tocar nada.
  agregar(b) {
    const nuevo = b instanceof Boton ? b : new Boton(b);
    const viejo = nuevo.id && this.antes.get(nuevo.id);
    if (viejo) nuevo.t = Math.max(nuevo.t, viejo.t);
    this.botones.push(nuevo);
    return nuevo;
  }
  vaciar() {
    this.antes = new Map(this.botones.filter((b) => b.id).map((b) => [b.id, b]));
    this.botones = []; this.bajado = null;
  }
  pasar(dt) { for (const b of this.botones) b.pasar(dt); }
  // se puede tocar cuando ya casi llegó (esperar el final de la animación se siente lento)
  listos() { return this.botones.filter((b) => b.visible && b.entrada() >= 0.6); }

  // Devuelve true si algún evento fue para un botón (así la escena no lo usa).
  manejar(entrada) {
    let usado = false;
    for (const ev of entrada.cola) {
      if (ev.tipo === 'bajar') {
        const b = this.listos().find((b) => b.contiene(ev.x, ev.y));
        if (b) { this.bajado = b; b.apretado = true; usado = true; this.foco = -1; }
      } else if (ev.tipo === 'mover' && this.bajado) {
        this.bajado.apretado = this.bajado.contiene(ev.x, ev.y);
      } else if (ev.tipo === 'soltar' && this.bajado) {
        const b = this.bajado;
        b.apretado = false; this.bajado = null; usado = true;
        if (!ev.cancelado && b.contiene(ev.x, ev.y)) this.activar(b);
      } else if (ev.tipo === 'deslizar' && ev.tecla && this.teclado) {
        const vis = this.listos();
        if (!vis.length) continue;
        const actual = vis[this.foco] ? this.foco : -1;
        this.foco = actual < 0 ? 0 : this.vecino(vis, actual, ev.dx, ev.dy);
        this.sonido?.tocar('pasos');
        usado = true;
      } else if (ev.tipo === 'confirmar' && this.teclado) {
        const vis = this.listos();
        if (vis[this.foco]) { this.activar(vis[this.foco]); usado = true; }
      }
    }
    return usado;
  }

  // El botón más cercano en la dirección de la flecha (o el siguiente de la lista).
  vecino(vis, i, dx, dy) {
    const a = vis[i], ca = [a.x + a.w / 2, a.y + a.h / 2];
    let mejor = -1, dist = Infinity;
    vis.forEach((b, j) => {
      if (j === i) return;
      const vx = b.x + b.w / 2 - ca[0], vy = b.y + b.h / 2 - ca[1];
      const adelante = vx * dx + vy * dy;
      if (adelante <= 0) return;
      const d = adelante + Math.abs(vx * dy - vy * dx) * 2;
      if (d < dist) { dist = d; mejor = j; }
    });
    return mejor >= 0 ? mejor : (i + (dx + dy > 0 ? 1 : vis.length - 1)) % vis.length;
  }

  activar(b) {
    if (b.desactivado) { b.sacudir(); this.sonido?.tocar('error'); return; }
    this.sonido?.tocar(b.sonidoAl || 'boton');
    b.accion?.(b);
  }

  dibujar(g) {
    const vis = this.listos();
    for (const b of this.botones) b.dibujar(g, vis[this.foco] === b);
  }
}

// ── paneles y adornos ──────────────────────────────────────────────────────
export function panel(g, x, y, w, h, { borde = MUNDOS_COLOR[0].borde, fondo = P.fondo2 } = {}) {
  x = Math.round(x); y = Math.round(y);
  g.fillStyle = P.negro; g.fillRect(x - 1, y - 1, w + 2, h + 3);
  g.fillStyle = borde; g.fillRect(x, y, w, h);
  g.fillStyle = fondo; g.fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x + 1, y + 1, w - 2, 1);
  // remaches en las esquinas
  g.fillStyle = borde;
  for (const [a, b] of [[3, 3], [w - 4, 3], [3, h - 4], [w - 4, h - 4]]) g.fillRect(x + a, y + b, 1, 1);
}

// Oscurecer todo con una trama (el fondo se sigue adivinando detrás).
export function velo(g, W, H, fuerza = 0.6) {
  g.fillStyle = `rgba(5,4,11,${fuerza})`;
  g.fillRect(0, 0, W, H);
}

// Un número con su ícono al lado (monedas, estrellas).
export function contador(g, icono, n, x, y, { alinear = 'izq', color = P.blanco } = {}) {
  const txt = String(n), tw = anchoTexto(txt), w = icono.width + 2 + tw;
  const x0 = Math.round(alinear === 'der' ? x - w : alinear === 'centro' ? x - w / 2 : x);
  g.drawImage(icono, x0, Math.round(y + 4.5 - icono.height / 2 + 1));
  texto(g, txt, x0 + icono.width + 2, y, color, { sombra: P.negro });
  return w;
}

// El iris de las transiciones: negro afuera de un círculo de radio r, de a
// filas (cada fila son dos rectángulos: barato y con borde de píxel).
export function iris(g, W, H, cx, cy, r) {
  g.fillStyle = P.negro;
  if (r <= 0) { g.fillRect(0, 0, W, H); return; }
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - cy;
    if (Math.abs(dy) >= r) { g.fillRect(0, y, W, 1); continue; }
    const m = Math.sqrt(r * r - dy * dy);
    const a = Math.round(cx - m), b = Math.round(cx + m);
    if (a > 0) g.fillRect(0, y, a, 1);
    if (b < W) g.fillRect(b, y, W - b, 1);
  }
}

// ── el fondo de los menús: la pared de la cripta que baja despacio, polvo
// que flota y dos antorchas. Se mece un poco con el dedo (el menú que se
// mece, llevado a 2D: capas que se corren a distinta velocidad).
export class FondoMenu {
  constructor() {
    this.t = 0; this.motas = [];
    this.mx = 0; this.my = 0;   // hacia dónde se inclina (-1 a 1)
    for (let k = 0; k < 26; k++) this.motas.push({ x: Math.random(), y: Math.random(), v: 0.01 + Math.random() * 0.03, fase: Math.random() * 6 });
  }
  pasar(dt, entrada, W, H) {
    this.t += dt;
    let ox = Math.sin(this.t * 0.5) * 0.35, oy = Math.cos(this.t * 0.37) * 0.25;
    if (entrada && entrada.x >= 0) { ox += clamp((entrada.x / W) * 2 - 1, -1, 1) * 0.65; oy += clamp((entrada.y / H) * 2 - 1, -1, 1) * 0.45; }
    this.mx += (ox - this.mx) * Math.min(1, dt * 3);
    this.my += (oy - this.my) * Math.min(1, dt * 3);
    for (const m of this.motas) { m.y -= m.v * dt; if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); } }
  }
  // corrimiento de una capa según su profundidad (0 = lejos, 1 = cerca)
  corrimiento(prof) { return [Math.round(this.mx * 6 * prof), Math.round(this.my * 4 * prof)]; }
  dibujar(g, W, H, mundo = 0) {
    const [fx, fy] = this.corrimiento(0.4);
    g.save();
    g.translate(fx, Math.round(this.t * 6) % 16 + fy);
    g.fillStyle = patronRoca(g, mundo);
    g.fillRect(-16, -32, W + 32, H + 64);
    g.restore();
    velo(g, W, H, 0.5);
    // viñeta en escalones: más oscuro en los bordes
    g.fillStyle = 'rgba(5,4,11,0.35)';
    for (let k = 0; k < 4; k++) { const m = 6 + k * 6; g.fillRect(0, 0, m, H); g.fillRect(W - m, 0, m, H); }
    const [mx, my] = this.corrimiento(1);
    for (const m of this.motas) {
      const x = Math.round(m.x * W + Math.sin(this.t + m.fase) * 3 + mx), y = Math.round(m.y * H + my);
      g.fillStyle = m.v > 0.03 ? '#3a3a60' : '#262444';
      g.fillRect(x, y, 1, 1);
    }
  }
}

// El título: CRIPTA / NEÓN como un cartel de neón colgado de dos cadenas,
// que se hamaca. Las letras titilan como tubos viejos y una luz las barre.
export function cartelTitulo(g, tr, cx, y, t, { esc = 3, colgado = true, balanceo = 0 } = {}) {
  const l1 = tr('titulo1'), l2 = tr('titulo2');
  const ang = Math.sin(t * 1.1) * 0.025 + balanceo;
  const dx = Math.round(Math.sin(ang) * 40), dy = Math.round(Math.abs(Math.sin(ang)) * 3);
  const w = Math.max(anchoTexto(l1, esc), anchoTexto(l2, esc)) + 14, h = esc * 20 + 14;
  const x = Math.round(cx - w / 2 + dx), yy = Math.round(y + dy);
  if (colgado) {
    // las cadenas, eslabón por eslabón
    g.fillStyle = '#6a6690';
    for (const px of [x + 8, x + w - 9]) {
      const topX = px - dx;
      for (let k = 0; k < yy; k += 3) { const q = k / Math.max(1, yy); g.fillRect(Math.round(topX + (px - topX) * q), k, 1, 2); }
    }
  }
  panel(g, x, yy, w, h, { borde: '#2a2250', fondo: '#0d0a1c' });
  const colA = MUNDOS_COLOR[0].borde, colB = P.portalB;
  const letra = (txt, fy, col, sombra) => {
    let px = Math.round(x + w / 2 - anchoTexto(txt, esc) / 2);
    [...txt].forEach((ch, k) => {
      // cada letra titila a su tiempo: un tubo que falla
      const falla = Math.sin(t * 13 + k * 7.1 + fy) > 0.985 || (((t * 0.7 + k * 0.31) % 7) > 6.85);
      const bob = Math.round(Math.sin(t * 2.2 + k * 0.6) * 0.8);
      const c = falla ? sombra : col;
      texto(g, ch, px, fy + bob, c, { esc, sombra: falla ? null : sombra });
      px += anchoTexto(ch, esc) + esc;
    });
  };
  letra(l1, yy + 5, colA, '#0e5a52');
  letra(l2, yy + 5 + esc * 10, colB, '#6a1a5c');
  // barrido de luz: una franja blanca que cruza cada tanto
  const barrido = ((t * 0.35) % 1.6) - 0.3;
  if (barrido > 0 && barrido < 1) {
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgba(255,255,255,0.18)';
    const bx = Math.round(x + barrido * w);
    for (let k = 1; k < h - 1; k++) {
      const px = bx - Math.round(k * 0.4);
      if (px > x && px + 3 < x + w) g.fillRect(px, yy + k, 3, 1);
    }
    g.globalCompositeOperation = 'source-over';
  }
  return { x, y: yy, w, h };
}

// Lu volando suelta (portada, mapa, tienda): alas que baten y una estela de luz.
export function luVolando(g, piel, x, y, t, { mira = 'quieto', escala = 1 } = {}) {
  const spr = S.lu(piel, mira, ((t * 14) | 0) % 2 ? 'arriba' : 'abajo', ((t * 0.4) % 3) > 2.9);
  const w = Math.round(spr.width * escala), h = Math.round(spr.height * escala);
  g.drawImage(spr, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
}

// El mundo: una arena redonda con comida, víboras y bots. Sin dibujo: lo usa
// el juego y lo usan las pruebas en Node (miles de pasos en un momento).
//
// Dos grillas de 128 unidades: la de la comida (fija, se toca al comer o al
// nacer comida) y la de los cuerpos (se rehace cada paso con una muestra
// cada tanto de cada víbora). Con eso, comer, chocar y los "ojos" de los
// bots miran solo las celdas de al lado y no todo el mundo.
import { azar, clamp } from './util.js';
import { Vibora, MASA_INICIAL } from './vibora.js';
import { PIELES, NOMBRES, colorDe } from './pieles.js';
import { pensar } from './ia.js';

const CAP_COMIDA = 9000;
const CELDA = 128;
const CAP_MUESTRAS = 12000;

export class Mundo {
  constructor({ radio = 3000, semilla = 1, bots = 18, comida = 1500, nivelBots = 1 } = {}) {
    this.r = azar(semilla);
    this.radio = radio;
    this.t = 0;
    this.viboras = [];
    this.eventos = [];
    this.proximoId = 1;
    this.cantidadBots = bots;
    this.nivelBots = nivelBots;           // 0 tranqui · 1 normal · 2 picante
    this.esperando = [];                  // bots muertos que vuelven a nacer
    // la comida, en arreglos planos (miles de bolitas: nada de objetos)
    this.fx = new Float32Array(CAP_COMIDA); this.fy = new Float32Array(CAP_COMIDA);
    this.fv = new Float32Array(CAP_COMIDA); this.fr = new Float32Array(CAP_COMIDA);
    this.fn = new Float32Array(CAP_COMIDA);                 // cuándo nació (para que aparezca creciendo)
    this.fc = new Uint16Array(CAP_COMIDA); this.fvivo = new Uint8Array(CAP_COMIDA);
    // la celda donde quedó anotada: el imán la mueve, y sacarla buscando por
    // la posición nueva dejaba la vieja anotada (se comía dos veces: la masa
    // crecía sin freno en la primera simulación)
    this.fcel = new Int32Array(CAP_COMIDA);
    this.libres = []; for (let i = CAP_COMIDA - 1; i >= 0; i--) this.libres.push(i);
    this.colores = []; this.indiceColor = new Map();
    this.nc = Math.ceil((radio * 2) / CELDA) + 2;
    this.grilla = Array.from({ length: this.nc * this.nc }, () => []);
    this.comidaMeta = comida;
    this.cantidadComida = 0;
    // la grilla de cuerpos
    this.sx = new Float32Array(CAP_MUESTRAS); this.sy = new Float32Array(CAP_MUESTRAS);
    this.sr = new Float32Array(CAP_MUESTRAS); this.sv = new Int32Array(CAP_MUESTRAS);
    this.ns = 0;
    this.celdasCuerpo = Array.from({ length: this.nc * this.nc }, () => []);
    this.usadas = [];
    for (let k = 0; k < comida; k++) this.comidaSuelta();
    for (let k = 0; k < bots; k++) this.nacerBot(true);
  }

  // ── la comida ────────────────────────────────────────────────────────────
  celdaDe(x, y) {
    const cx = clamp(Math.floor((x + this.radio) / CELDA) + 1, 0, this.nc - 1);
    const cy = clamp(Math.floor((y + this.radio) / CELDA) + 1, 0, this.nc - 1);
    return cy * this.nc + cx;
  }
  color(c) {
    let i = this.indiceColor.get(c);
    if (i === undefined) { i = this.colores.length; this.colores.push(c); this.indiceColor.set(c, i); }
    return i;
  }
  ponerComida(x, y, valor, color) {
    const i = this.libres.pop();
    if (i === undefined) return -1;
    this.fx[i] = x; this.fy[i] = y; this.fv[i] = valor;
    this.fr[i] = Math.min(15, 3.5 + Math.sqrt(valor) * 2.6);
    this.fn[i] = this.t; this.fc[i] = this.color(color); this.fvivo[i] = 1;
    const c = this.celdaDe(x, y);
    this.fcel[i] = c;
    this.grilla[c].push(i);
    this.cantidadComida++;
    return i;
  }
  sacarComida(i) {
    if (!this.fvivo[i]) return;
    this.fvivo[i] = 0;
    const c = this.grilla[this.fcel[i]], k = c.indexOf(i);
    if (k >= 0) { c[k] = c[c.length - 1]; c.pop(); }
    this.libres.push(i);
    this.cantidadComida--;
  }
  comidaSuelta() {
    const a = this.r() * Math.PI * 2, d = Math.sqrt(this.r()) * (this.radio - 40);
    const PALETA = ['#ff5e5e', '#ffb13b', '#ffe35e', '#7dff5e', '#5ef3ff', '#5e8bff', '#c45eff', '#ff5ec8'];
    this.ponerComida(Math.cos(a) * d, Math.sin(a) * d, 1 + (this.r() < 0.2 ? 1 : 0), PALETA[(this.r() * PALETA.length) | 0]);
  }

  // ── las víboras ──────────────────────────────────────────────────────────
  // Un lugar para nacer lejos de los cuerpos (probar unos cuantos al azar).
  lugarLibre() {
    let mejor = null, lejos = -1;
    for (let k = 0; k < 14; k++) {
      const a = this.r() * Math.PI * 2, d = Math.sqrt(this.r()) * this.radio * 0.8;
      const x = Math.cos(a) * d, y = Math.sin(a) * d;
      let cerca = Infinity;
      for (const v of this.viboras) if (v.viva) cerca = Math.min(cerca, Math.hypot(v.x - x, v.y - y));
      if (cerca > 500) return [x, y];
      if (cerca > lejos) { lejos = cerca; mejor = [x, y]; }
    }
    return mejor;
  }
  nacer({ nombre, piel, masa = MASA_INICIAL, bot = false }) {
    const [x, y] = this.lugarLibre();
    const v = new Vibora({ id: this.proximoId++, nombre, piel, x, y, ang: this.r() * Math.PI * 2, masa, bot });
    this.viboras.push(v);
    return v;
  }
  nacerBot(alArrancar = false) {
    // la mayoría chicas, algunas grandes: así la tabla tiene de todo
    const q = this.r(), masa = alArrancar && q < 0.25 ? 150 + this.r() * 1400 : q < 0.5 ? 30 + this.r() * 120 : MASA_INICIAL + this.r() * 20;
    const usados = new Set(this.viboras.filter((v) => v.viva).map((v) => v.nombre));
    let nombre = NOMBRES[(this.r() * NOMBRES.length) | 0];
    for (let k = 0; k < 5 && usados.has(nombre); k++) nombre = NOMBRES[(this.r() * NOMBRES.length) | 0];
    const v = this.nacer({ nombre, piel: PIELES[(this.r() * PIELES.length) | 0], masa, bot: true });
    v.ia = { proxima: this.r() * 0.1, codicia: 0.6 + this.r() * 0.8, agresion: [0.1, 0.45, 0.8][this.nivelBots] * (0.5 + this.r()), prudencia: 0.7 + this.r() * 0.6, deambula: this.r() * Math.PI * 2 };
    return v;
  }

  // ── el paso ──────────────────────────────────────────────────────────────
  pasar(dt) {
    this.t += dt;
    const soltar = (x, y, valor, color) => this.ponerComida(x + (this.r() - 0.5) * 6, y + (this.r() - 0.5) * 6, valor, color);
    this.armarCuerpos();
    for (const v of this.viboras) {
      if (!v.viva) continue;
      if (v.bot && (v.ia.proxima -= dt) <= 0) { pensar(v, this); v.ia.proxima = 0.1; }
      v.pasar(dt, soltar);
    }
    this.armarCuerpos();
    for (const v of this.viboras) if (v.viva) this.comer(v, dt);
    for (const v of this.viboras) if (v.viva) this.choques(v);
    // los bots muertos vuelven, y la comida suelta se repone de a poco
    this.esperando = this.esperando.filter((e) => { if (this.t < e.cuando) return true; this.nacerBot(); return false; });
    const vivos = this.viboras.filter((v) => v.viva && v.bot).length + this.esperando.length;
    for (let k = vivos; k < this.cantidadBots; k++) this.esperando.push({ cuando: this.t + 1 + this.r() * 3 });
    let reponer = Math.min(8, this.comidaMeta - this.cantidadComida);
    while (reponer-- > 0) this.comidaSuelta();
    // las muertas se sacan de la lista (después de avisar)
    if (this.viboras.some((v) => !v.viva)) this.viboras = this.viboras.filter((v) => v.viva);
  }

  // Una muestra cada tanto de cada cuerpo, en su celda.
  armarCuerpos() {
    for (const c of this.usadas) this.celdasCuerpo[c].length = 0;
    this.usadas.length = 0;
    let n = 0;
    for (let vi = 0; vi < this.viboras.length; vi++) {
      const v = this.viboras[vi];
      if (!v.viva) continue;
      const r = v.radio(), salto = v.saltoChoque();
      const poner = (x, y) => {
        if (n >= CAP_MUESTRAS) return;
        this.sx[n] = x; this.sy[n] = y; this.sr[n] = r; this.sv[n] = vi;
        const c = this.celdaDe(x, y), lista = this.celdasCuerpo[c];
        if (!lista.length) this.usadas.push(c);
        lista.push(n++);
      };
      poner(v.x, v.y);
      for (let k = salto; k < v.n; k += salto) { const j = v.i(k); poner(v.px[j], v.py[j]); }
    }
    this.ns = n;
  }

  // Lo que queda cerca de la cabeza viene hacia la boca (el imán) y se come.
  comer(v, dt) {
    const r = v.radio(), alcance = r * 1.6 + 28, boca = r * 0.9;
    const cx = Math.floor((v.x + this.radio) / CELDA) + 1, cy = Math.floor((v.y + this.radio) / CELDA) + 1;
    for (let j = cy - 1; j <= cy + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) {
      if (i < 0 || j < 0 || i >= this.nc || j >= this.nc) continue;
      const c = this.grilla[j * this.nc + i];
      for (let k = c.length - 1; k >= 0; k--) {
        const f = c[k];
        if (!this.fvivo[f]) continue;
        const dx = v.x - this.fx[f], dy = v.y - this.fy[f], d = Math.hypot(dx, dy);
        if (d < boca) {
          v.masa += this.fv[f];
          // los bots comen callados: el aviso es para la del jugador (sonido)
          if (!v.bot) this.eventos.push({ tipo: 'come', v, valor: this.fv[f] });
          this.sacarComida(f);
        } else if (d < alcance) {
          // se arrima (queda en su celda: en un par de cuadros se come igual)
          const paso = Math.min(d - boca * 0.5, (260 + v.velocidad()) * dt);
          this.fx[f] += (dx / d) * paso; this.fy[f] += (dy / d) * paso;
        }
      }
    }
  }

  // ¿La cabeza tocó el cuerpo de otra, o el borde?
  choques(v) {
    const vi = this.viboras.indexOf(v), r = v.radio();
    if (v.x * v.x + v.y * v.y > (this.radio - r * 0.5) ** 2) return this.morir(v, null);
    const cx = Math.floor((v.x + this.radio) / CELDA) + 1, cy = Math.floor((v.y + this.radio) / CELDA) + 1;
    for (let j = cy - 1; j <= cy + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) {
      if (i < 0 || j < 0 || i >= this.nc || j >= this.nc) continue;
      for (const s of this.celdasCuerpo[j * this.nc + i]) {
        if (this.sv[s] === vi) continue;
        const toca = r * 0.62 + this.sr[s] * 0.92;
        if ((this.sx[s] - v.x) ** 2 + (this.sy[s] - v.y) ** 2 < toca * toca) return this.morir(v, this.viboras[this.sv[s]]);
      }
    }
  }

  // Morir: el cuerpo se vuelve comida grande y brillante, de sus colores.
  morir(v, asesino) {
    if (!v.viva) return;
    v.viva = false;
    const r = v.radio(), salto = Math.max(2, Math.round((r * 1.1) / 4));
    const piezas = Math.max(1, Math.floor(v.n / salto)), valor = Math.max(1, (v.masa * 0.8) / piezas);
    for (let k = 0; k < v.n; k += salto) {
      const j = v.i(k), e = r * 0.8;
      this.ponerComida(v.px[j] + (this.r() - 0.5) * e, v.py[j] + (this.r() - 0.5) * e, valor, colorDe(v.piel, Math.floor(k / v.salto())));
    }
    if (asesino && asesino !== v) asesino.bajas++;
    this.eventos.push({ tipo: 'muere', v, asesino });
  }

  // La tabla: todas las vivas, de mayor a menor.
  tabla() { return this.viboras.filter((v) => v.viva).sort((a, b) => b.masa - a.masa); }

  // Lo que pasó desde la última vez (el juego lo usa para sonidos y carteles).
  sacarEventos() { const e = this.eventos; this.eventos = []; return e; }
}

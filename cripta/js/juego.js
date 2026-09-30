// La partida: Lu deslizándose, lo que junta, lo que la mata, la cámara y el
// jugo. Corre igual para un nivel, para la torre infinita y para la demo de
// la portada (ahí la maneja un bot).
//
// Lu se mueve de centro a centro de celda. Al llegar a cada una se aplican
// las reglas compartidas (reglas.js › seguir): portales, flechas y si lo que
// sigue es sólido. Lo que se mueve con el reloj (polillas, fuego, erizos,
// pinchos, lava) se mira cuadro a cuadro contra su posición continua.
import { T, O, esSolida, mataSiempre, seguir } from './reglas.js';
import { Pintor, CELDA, patronRoca } from './nivel.js';
import * as S from './sprites.js';
import { P, MUNDOS_COLOR } from './paleta.js';
import { Efectos } from './efectos.js';
import { acercar, clamp } from './util.js';
import { texto, anchoTexto, partir } from './fuente.js';

export const VEL = 22;              // celdas por segundo: cruza la pantalla en medio segundo
const VEL_POLILLA = 3;
const VEL_FUEGO = 7.5;
const CICLO_PINCHOS = 2.4;          // abajo 1,0 · aviso 0,2 · arriba 1,0 · aviso 0,2
const CICLO_ERIZO = 2.4;            // chico 1,4 · tiembla 0,2 · inflado 0,8
const CICLO_CABEZA = 2.2;           // la boca se abre 0,35 s antes de escupir
const BUFFER = 0.25;                // un deslizamiento hecho antes de frenar se guarda este rato
const RADIO_POLILLA = 0.68, RADIO_FUEGO = 0.58;
const PENTATONICA = [0, 2, 4, 7, 9];

export const DURACION = {
  iman: (k) => 6 + 2 * k, hielo: (k) => 4 + 1.5 * k, doble: (k) => 8 + 3 * k, escudo: (k) => 6 + 2 * k,
};
const PODER_DE_OBJ = { [O.ESCUDO]: 'escudo', [O.HIELO]: 'hielo', [O.IMAN]: 'iman', [O.DOBLE]: 'doble' };
const COLOR_PODER = { escudo: P.escudo, hielo: P.hielo, iman: P.iman, doble: P.doble };

// Fases de lo que late con el reloj de los peligros.
export function pinchosArriba(tipo, tp) {
  const f = (tp + (tipo === T.PINCHOS_B ? CICLO_PINCHOS / 2 : 0)) % CICLO_PINCHOS;
  return f >= 1.2 && f < 2.2;
}
function pinchosEstado(tipo, tp) {
  const f = (tp + (tipo === T.PINCHOS_B ? CICLO_PINCHOS / 2 : 0)) % CICLO_PINCHOS;
  return f < 1.0 ? 'abajo' : f < 1.2 || f >= 2.2 ? 'aviso' : 'arriba';
}
const desfase = (x, y, ciclo) => (((x * 7 + y * 13) % 5) / 5) * ciclo;
function erizoEstado(e, tp) {
  const f = (tp + desfase(e.x, e.y, CICLO_ERIZO) * 0.5) % CICLO_ERIZO;
  return f < 1.4 ? 'chico' : f < 1.6 ? 'tiembla' : 'grande';
}

// Una luz redonda en tres bandas (círculos de a píxel, sin degradé), para
// sumar con 'lighter': el borde escalonado es lo que la hace pixel art.
const cacheLuz = new Map();
export function luzRedonda(color, radio) {
  radio = Math.round(radio);
  const k = color + radio;
  if (cacheLuz.has(k)) return cacheLuz.get(k);
  const c = document.createElement('canvas');
  c.width = c.height = radio * 2 + 1;
  const g = c.getContext('2d');
  const n = parseInt(color.slice(1), 16), rgb = [n >> 16, (n >> 8) & 255, n & 255];
  [[1, 0.35], [0.66, 0.6], [0.36, 1]].forEach(([r, f]) => {
    g.fillStyle = `rgb(${rgb.map((v) => Math.round(v * f)).join(',')})`;
    const R = radio * r;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (Math.hypot(x - radio, y - radio) <= R) g.fillRect(x, y, 1, 1);
  });
  cacheLuz.set(k, c);
  return c;
}

// Los píxeles de un sprite, para desarmarlo en partículas al morir. Se leen
// una vez por sprite: getImageData obliga al navegador a esperar que termine
// todo lo que está dibujando (en la prueba, 15 ms trabados justo al morir).
const cachePixeles = new WeakMap();
function pixeles(c) {
  if (cachePixeles.has(c)) return cachePixeles.get(c);
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, out = [];
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const k = (y * c.width + x) * 4;
    if (d[k + 3] > 100) out.push([x, y, `rgb(${d[k]},${d[k + 1]},${d[k + 2]})`]);
  }
  cachePixeles.set(c, out);
  return out;
}

const cacheGiro = new Map();
function girado(c, cuartos) {
  if (!cuartos) return c;
  let m = cacheGiro.get(c);
  if (!m) cacheGiro.set(c, (m = []));
  return m[cuartos] || (m[cuartos] = S.girar(c, cuartos));
}
const CUARTOS_PEGADA = (dx, dy) => (dy > 0 ? 0 : dy < 0 ? 2 : dx > 0 ? 3 : 1);
const CUARTOS_DIR = (dx, dy) => (dx > 0 ? 0 : dy > 0 ? 1 : dx < 0 ? 2 : 3);   // la flecha mira a la derecha

const nulo = { tocar() {} };

export class Partida {
  constructor({ nv, modo = 'nivel', piel = 'lu', mejoras = {}, sonido = nulo, vibrar = () => {}, torre = null, tr = (k) => k, lava = null }) {
    this.nv = nv;
    this.modo = modo;
    this.piel = piel;
    this.sonido = sonido;
    this.vibrar = vibrar;
    this.torre = torre;
    this.tr = tr;
    this.pintor = new Pintor(nv, nv.mundo, (nv.id || '').length * 31 + 5);
    if (torre) this.pintor.listoDesde = () => torre.hasta;
    this.colores = MUNDOS_COLOR[nv.mundo] || MUNDOS_COLOR[0];
    this.fx = new Efectos();
    this.t = 0;                   // reloj de la partida
    this.tp = 0;                  // reloj de los peligros: el hielo lo para
    this.parada = 0;              // cuadros de hit-stop que faltan
    this.estado = 'jugando';      // jugando · muriendo · saliendo · terminado
    this.fin = null;              // { gano, causa } cuando termina
    this.buffer = null;
    this.movimientos = 0;
    this.combo = 0; this.ultimaChispa = -9;
    this.recogido = { chispas: 0, monedas: 0, estrellas: [] };
    this.dur = {};
    for (const k of Object.keys(DURACION)) this.dur[k] = DURACION[k](mejoras[k] || 0);
    this.poder = { iman: 0, hielo: 0, doble: 0, escudo: 0 };
    this.invulnerable = 0;
    this.volando = [];            // lo que el imán arrastra
    this.bolas = [];
    const { x, y } = nv.inicio;
    this.lu = {
      x, y, dx: 0, dy: 0, avance: 0, mueve: false, largo: 0,
      pegada: pegadaInicial(nv, x, y), mira: 'quieto', aplaste: 0, empujon: null, rastro: [], visible: true, giro: 0, escala: 1,
      parpadeo: 2 + Math.random() * 2,
    };
    this.alto = 0; this.altoMax = 0;       // la torre: cuánto subió (filas)
    this.lava = lava;                      // { y (px), vel (filas/s), espera (s) } o null
    this.camY = null; this.camX = 0;
    this.W = 0; this.H = 0;
    this.cartel = nv.aviso ? { clave: nv.aviso, t: 0 } : null;
    this.ultimaParada = [x, y];
  }

  medir(W, H) {
    this.W = W; this.H = H;
    if (this.camY === null) this.pasarCamara(0);
  }

  // ── entrada ──────────────────────────────────────────────────────────────
  deslizar(dx, dy) { this.buffer = { dx, dy, t: this.t }; }

  // ── el paso de simulación ────────────────────────────────────────────────
  pasar(dt) {
    this.fx.pasar(dt);
    if (this.parada > 0) { this.parada--; return; }
    this.t += dt;
    if (this.cartel) this.cartel.t += dt;
    const lu = this.lu;
    if (this.estado === 'jugando') {
      if (!lu.mueve && this.buffer) {
        if (this.t - this.buffer.t <= BUFFER) this.arrancar(this.buffer.dx, this.buffer.dy);
        this.buffer = null;
      }
      if (lu.mueve) this.avanzar(dt);
    }
    // relojes de los poderes
    for (const k of ['iman', 'hielo', 'doble', 'escudo']) if (this.poder[k] > 0) {
      this.poder[k] = Math.max(0, this.poder[k] - dt);
      if (this.poder[k] === 0) this.sonido.tocar('poderFin');
    }
    if (this.invulnerable > 0) this.invulnerable -= dt;
    const dtp = this.poder.hielo > 0 ? 0 : dt;
    this.tp += dtp;
    if (this.torre) this.pasarTorre(dt);
    this.pasarPolillas(dtp);
    this.pasarCabezas(dtp);
    this.pasarLava(dtp);
    this.pasarIman(dt);
    this.pasarPortales();
    this.pasarAmbiente(dt);
    if (this.estado === 'jugando') this.peligros();
    this.animarLu(dt);
    this.pasarCamara(dt);
    if (this.estado === 'muriendo' || this.estado === 'saliendo') {
      this.finT -= dt;
      if (this.estado === 'saliendo') this.animarSalida(dt);
      if (this.finT <= 0) this.estado = 'terminado';
    }
  }

  arrancar(dx, dy) {
    const lu = this.lu, nv = this.nv;
    const nx = lu.x + dx, ny = lu.y + dy;
    if (esSolida(nv, nx, ny)) {
      // contra la pared: un empujoncito (y la frágil se cae igual)
      if (!this.golpeFragil(nx, ny)) { lu.empujon = { dx, dy, t: 0.12 }; this.sonido.tocar('tope'); }
      return;
    }
    lu.dx = dx; lu.dy = dy; lu.avance = 0; lu.mueve = true; lu.largo = 0;
    lu.mira = dx > 0 ? 'der' : dx < 0 ? 'izq' : dy < 0 ? 'arriba' : 'abajo';
    this.movimientos++;
    this.sonido.tocar('arranque');
    // polvo del despegue, hacia atrás
    const [px, py] = this.centroLu();
    this.fx.chispazo(px - dx * 4, py - dy * 4, { n: 4, col: [this.colores.claro, P.gris], vel: 30, vida: 0.25, dx: -dx, dy: -dy, abanico: 1.6 });
  }

  avanzar(dt) {
    const lu = this.lu;
    let paso = VEL * dt;
    while (paso > 0 && lu.mueve && this.estado === 'jugando') {
      const falta = 1 - lu.avance;
      if (paso < falta) { lu.avance += paso; break; }
      paso -= falta;
      lu.x += lu.dx; lu.y += lu.dy; lu.avance = 0; lu.largo++;
      this.llegar();
      if (lu.largo > 600) this.parar();       // un bucle de flechas mal hecho no cuelga el juego
    }
  }

  llegar() {
    const lu = this.lu, nv = this.nv, i = lu.y * nv.ancho + lu.x, t = nv.tipo[i];
    this.juntar(i);
    if (mataSiempre(t)) { this.morir(t === T.LAVA ? 'lava' : t === T.ERIZO ? 'erizo' : 'pinchos'); if (this.estado !== 'jugando') return; }
    if ((t === T.PINCHOS_A || t === T.PINCHOS_B) && pinchosArriba(t, this.tp)) { this.morir('pinchos'); if (this.estado !== 'jugando') return; }
    if (t === T.SALIDA) return this.salir();
    const s = seguir(nv, lu.x, lu.y, lu.dx, lu.dy);
    if (s.portal) {
      const [ax, ay] = this.centro(lu.x, lu.y);
      lu.x = s.x; lu.y = s.y;
      const [bx, by] = this.centro(lu.x, lu.y);
      const col = this.colorPortal(i);
      this.fx.anillo(ax, ay, { r1: 9, col }); this.fx.anillo(bx, by, { r1: 9, col });
      this.fx.chispazo(bx, by, { n: 8, col: [col, P.blanco], vel: 45 });
      lu.rastro = [];
      this.sonido.tocar('portal');
    }
    if (s.flecha) {
      lu.dx = s.dx; lu.dy = s.dy;
      lu.mira = lu.dx > 0 ? 'der' : lu.dx < 0 ? 'izq' : lu.dy < 0 ? 'arriba' : 'abajo';
      this.sonido.tocar('flecha');
      const [px, py] = this.centro(lu.x, lu.y);
      this.fx.anillo(px, py, { r1: 6, col: P.chispa, vida: 0.2 });
    }
    if (s.parar) this.parar();
  }

  parar() {
    const lu = this.lu;
    lu.mueve = false; lu.avance = 0;
    const wx = lu.x + lu.dx, wy = lu.y + lu.dy;
    lu.pegada = [lu.dx, lu.dy];
    lu.aplaste = 1;
    this.ultimaParada = [lu.x, lu.y];
    this.golpeFragil(wx, wy);
    const [px, py] = this.centroLu();
    const fuerte = lu.largo >= 6;
    this.fx.chispazo(px + lu.dx * 4, py + lu.dy * 4, { n: fuerte ? 7 : 4, col: [this.colores.borde, this.colores.claro, P.blanco], vel: fuerte ? 50 : 32, vida: 0.3, dx: -lu.dx || (Math.random() - 0.5), dy: -lu.dy || (Math.random() - 0.5), abanico: 2.6 });
    if (fuerte) this.fx.sacudir(1.4);
    this.sonido.tocar('toc', { fuerte });
    this.vibrar(fuerte ? 12 : 6);
    lu.dx = 0; lu.dy = 0;
    this.combo = 0;
  }

  golpeFragil(x, y) {
    const nv = this.nv;
    if (x < 0 || y < 0 || x >= nv.ancho || y >= nv.alto) return false;
    const i = y * nv.ancho + x;
    if (nv.tipo[i] !== T.FRAGIL) return false;
    nv.tipo[i] = T.VACIO;
    this.pintor.invalidar(y);
    const [px, py] = this.centro(x, y);
    this.fx.chispazo(px, py, { n: 16, col: [this.colores.relleno, this.colores.claro, this.colores.borde, P.gris], vel: 60, vida: 0.6, grav: 160, tam: 2, friccion: 1.5 });
    this.fx.sacudir(3);
    this.parada = 3;
    this.sonido.tocar('romper');
    this.vibrar(20);
    return true;
  }

  juntar(i) {
    const nv = this.nv, o = nv.obj[i];
    if (!o) return;
    nv.obj[i] = O.NADA;
    const x = i % nv.ancho, y = (i / nv.ancho) | 0;
    this.efectoJuntar(o, ...this.centro(x, y), i);
  }

  efectoJuntar(o, px, py, i) {
    const doble = this.poder.doble > 0 ? 2 : 1;
    if (o === O.CHISPA) {
      this.recogido.chispas++;
      this.combo = this.t - this.ultimaChispa < 0.35 ? this.combo + 1 : 0;
      this.ultimaChispa = this.t;
      const k = Math.min(this.combo, 14);
      this.sonido.tocar('chispa', { semitono: 12 * Math.floor(k / 5) + PENTATONICA[k % 5] });
      this.fx.chispazo(px, py, { n: 2, col: [P.chispa, P.chispaLuz], vel: 22, vida: 0.2 });
    } else if (o === O.MONEDA) {
      this.recogido.monedas += doble;
      this.sonido.tocar('moneda');
      this.fx.anillo(px, py, { r1: 7, col: P.moneda, vida: 0.25 });
      this.fx.chispazo(px, py, { n: 6, col: [P.moneda, P.monedaLuz], vel: 40, vida: 0.35 });
      this.fx.flotante(px, py - 4, doble > 1 ? '+2' : '+1', P.moneda);
    } else if (o === O.ESTRELLA) {
      this.recogido.estrellas.push(i);
      this.sonido.tocar('estrella', { n: this.recogido.estrellas.length });
      this.fx.anillo(px, py, { r1: 14, col: P.estrella, vida: 0.4 });
      this.fx.chispazo(px, py, { n: 16, col: [P.estrella, P.blanco, P.estrellaOsc], vel: 70, vida: 0.6, tam: 2 });
      this.fx.flotante(px, py - 6, `${this.recogido.estrellas.length}/3`, P.estrella, { vida: 1 });
      this.fx.sacudir(1.5);
      this.parada = 4;
      this.vibrar(15);
    } else if (PODER_DE_OBJ[o]) {
      const k = PODER_DE_OBJ[o];
      this.poder[k] = this.dur[k];
      this.sonido.tocar('poder');
      this.fx.anillo(px, py, { r1: 16, col: COLOR_PODER[k], vida: 0.45 });
      this.fx.chispazo(px, py, { n: 14, col: [COLOR_PODER[k], P.blanco], vel: 60, vida: 0.5 });
      this.fx.flotante(px, py - 6, this.tr('poder_' + k), COLOR_PODER[k], { vida: 1.1 });
      if (k === 'hielo') this.fx.destellar(P.hielo, 0.15);
      this.vibrar(15);
    }
  }

  // ── lo que mata ──────────────────────────────────────────────────────────
  peligros() {
    const lu = this.lu, [lx, ly] = this.posLu();
    if (this.lava && (ly + 0.3) * CELDA > this.lava.y) return this.morir('lava');
    if (this.invulnerable > 0) return;
    const nv = this.nv;
    // lo que está debajo cuando está quieta (o recién llega)
    const cx = Math.round(lx), cy = Math.round(ly);
    if (cx >= 0 && cy >= 0 && cx < nv.ancho && cy < nv.alto) {
      const t = nv.tipo[cy * nv.ancho + cx];
      if (!lu.mueve && mataSiempre(t)) return this.morir(t === T.LAVA ? 'lava' : t === T.ERIZO ? 'erizo' : 'pinchos');
      if ((t === T.PINCHOS_A || t === T.PINCHOS_B) && pinchosArriba(t, this.tp)) return this.morir('pinchos');
    }
    for (const m of nv.polillas) {
      const [mx, my] = this.posPolilla(m);
      if (Math.hypot(mx - lx, my - ly) < RADIO_POLILLA) return this.morir('polilla');
    }
    for (const b of this.bolas) if (Math.hypot(b.x - lx, b.y - ly) < RADIO_FUEGO) return this.morir('fuego');
    for (const e of nv.erizos) {
      const est = erizoEstado(e, this.tp), r = est === 'grande' ? 1.45 : 0.6;
      if (Math.abs(e.x - lx) < r && Math.abs(e.y - ly) < r) return this.morir('erizo');
    }
  }

  morir(causa) {
    if (this.estado !== 'jugando') return;
    if (causa !== 'lava' && this.invulnerable > 0) return;
    if (causa !== 'lava' && this.poder.escudo > 0) {
      // el escudo se revienta y deja un ratito para salir
      this.poder.escudo = 0;
      this.invulnerable = 1.0;
      const [px, py] = this.centroLu();
      this.fx.anillo(px, py, { r1: 18, col: P.escudo, vida: 0.4 });
      this.fx.chispazo(px, py, { n: 18, col: [P.escudo, P.blanco], vel: 70, vida: 0.5 });
      this.fx.sacudir(3);
      this.parada = 5;
      this.sonido.tocar('escudoRoto');
      this.vibrar(30);
      return;
    }
    this.estado = 'muriendo';
    this.fin = { gano: false, causa };
    this.finT = 1.0;
    this.parada = 6;
    const lu = this.lu, [px, py] = this.centroLu();
    const spr = this.spriteLu();
    for (const [x, y, col] of pixeles(spr)) {
      const ox = x - spr.width / 2 + 0.5, oy = y - spr.height / 2 + 0.5;
      const a = Math.atan2(oy, ox) + (Math.random() - 0.5) * 0.8, v = 30 + Math.random() * 70;
      this.fx.una({ x: px + ox, y: py + oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, vida: 0.7 + Math.random() * 0.5, col, friccion: 2.2, grav: 40 });
    }
    this.fx.anillo(px, py, { r1: 20, col: P.rojo, vida: 0.35 });
    this.fx.destellar(P.blanco, 0.1);
    this.fx.sacudir(5);
    lu.visible = false; lu.mueve = false;
    this.sonido.tocar('muerte');
    this.vibrar([40, 30, 60]);
  }

  salir() {
    const lu = this.lu;
    lu.mueve = false;
    this.estado = 'saliendo';
    this.finT = 0.9;
    this.fin = { gano: true };
    const [px, py] = this.centroLu();
    this.fx.anillo(px, py, { r1: 16, col: P.portalA, vida: 0.4 });
    this.fx.chispazo(px, py, { n: 20, col: [P.portalA, P.portalB, P.blanco], vel: 60, vida: 0.6 });
    this.sonido.tocar('salida');
    this.vibrar(25);
  }

  animarSalida(dt) {
    const lu = this.lu;
    lu.escala = Math.max(0, lu.escala - dt * 1.8);
    lu.giro += dt * 14;
    if (lu.escala === 0) lu.visible = false;
    const [px, py] = this.centroLu();
    if (Math.random() < 0.6) {
      const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 6;
      this.fx.una({ x: px + Math.cos(a) * r, y: py + Math.sin(a) * r, vx: -Math.cos(a) * r * 3, vy: -Math.sin(a) * r * 3, vida: 0.3, col: Math.random() < 0.5 ? P.portalA : P.portalB });
    }
  }

  // ── lo que se mueve solo ─────────────────────────────────────────────────
  posPolilla(m) {
    if (m.avance === undefined) this.iniciarPolilla(m);
    return [m.cx + m.dx * m.avance, m.cy + m.dy * m.avance];
  }
  iniciarPolilla(m) {
    m.cx = m.x; m.cy = m.y; m.avance = 0;
    m.dx = m.eje === 'h' ? 1 : 0; m.dy = m.eje === 'v' ? 1 : 0;
    if (esSolida(this.nv, m.cx + m.dx, m.cy + m.dy)) { m.dx = -m.dx; m.dy = -m.dy; }
    if (esSolida(this.nv, m.cx + m.dx, m.cy + m.dy)) { m.dx = 0; m.dy = 0; }
  }
  pasarPolillas(dt) {
    for (const m of this.nv.polillas) {
      if (m.avance === undefined) this.iniciarPolilla(m);
      if (!m.dx && !m.dy) continue;
      m.avance += VEL_POLILLA * (m.vel || 1) * dt;
      while (m.avance >= 1) {
        m.avance -= 1; m.cx += m.dx; m.cy += m.dy;
        if (esSolida(this.nv, m.cx + m.dx, m.cy + m.dy)) { m.dx = -m.dx; m.dy = -m.dy; }
      }
    }
  }

  pasarCabezas(dt) {
    const nv = this.nv;
    for (const c of nv.cabezas) {
      if (c.reloj === undefined) c.reloj = desfase(c.x, c.y, CICLO_CABEZA);
      if (!dt) continue;
      const antes = c.reloj;
      c.reloj = (c.reloj + dt) % CICLO_CABEZA;
      if (c.reloj < antes) {
        // escupe: la bola nace en la celda de adelante, si hay lugar
        const bx = c.x + c.dx, by = c.y + c.dy;
        if (!esSolida(nv, bx, by)) {
          this.bolas.push({ x: bx, y: by, dx: c.dx, dy: c.dy, cx: bx, cy: by, avance: 0 });
          if (this.visible(bx, by)) { this.sonido.tocar('escupe'); this.fx.chispazo(...this.centro(bx, by), { n: 5, col: [P.fuego, P.fuegoLuz], vel: 30, vida: 0.25, dx: c.dx, dy: c.dy, abanico: 1.5 }); }
        }
      }
    }
    for (const b of this.bolas) {
      if (!dt) continue;
      b.avance += VEL_FUEGO * dt;
      while (b.avance >= 1 && !esSolida(nv, b.cx + b.dx, b.cy + b.dy)) { b.avance -= 1; b.cx += b.dx; b.cy += b.dy; }
      // se apaga cuando toca la pared de enfrente (a 0,35 de celda del centro)
      if (esSolida(nv, b.cx + b.dx, b.cy + b.dy) && b.avance >= 0.35) { b.avance = 0.35; b.muerta = true; }
      b.x = b.cx + b.dx * b.avance; b.y = b.cy + b.dy * b.avance;
      const [px, py] = this.centro(b.x, b.y);
      if (b.muerta) this.fx.chispazo(px + b.dx * 3, py + b.dy * 3, { n: 6, col: [P.fuego, P.fuegoLuz, P.piedraOsc], vel: 35, vida: 0.3 });
      else if (Math.random() < 0.5) this.fx.una({ x: px - b.dx * 3 + (Math.random() - 0.5) * 2, y: py - b.dy * 3 + (Math.random() - 0.5) * 2, vx: -b.dx * 10, vy: -b.dy * 10 - 6, vida: 0.25, col: Math.random() < 0.5 ? P.fuego : P.lava });
    }
    this.bolas = this.bolas.filter((b) => !b.muerta);
  }

  pasarPortales() {
    for (const i of this.nv.pareja.keys()) {
      if (Math.random() > 0.08) continue;
      const x = i % this.nv.ancho, y = (i / this.nv.ancho) | 0;
      if (!this.visible(x, y)) continue;
      const [px, py] = this.centro(x, y), a = Math.random() * Math.PI * 2;
      this.fx.una({ x: px + Math.cos(a) * 5, y: py + Math.sin(a) * 5, vx: -Math.cos(a) * 12, vy: -Math.sin(a) * 12, vida: 0.4, col: this.colorPortal(i) });
    }
  }

  // Lo que flota en el aire de cada mundo: polvo en las catacumbas, esporas
  // en el jardín, brasas en el horno, bichitos de luz en la torre.
  pasarAmbiente(dt) {
    if (!this.H || this.camY === null) return;
    const m = this.nv.mundo, ritmo = [2.5, 4, 6, 3][m] ?? 3;
    if (Math.random() > ritmo * dt) return;
    const x = this.camX + Math.random() * this.W, y = this.camY + Math.random() * this.H;
    const a = (Math.random() - 0.5);
    if (m === 0) this.fx.una({ x, y, vx: a * 4, vy: 2 + Math.random() * 3, vida: 3, col: Math.random() < 0.5 ? '#2c3a48' : '#3f4f5e' });
    else if (m === 1) this.fx.una({ x, y, vx: a * 6, vy: -3 - Math.random() * 5, vida: 3.2, col: Math.random() < 0.5 ? '#b04ad0' : '#ff9af0' });
    else if (m === 2) this.fx.una({ x, y: this.camY + this.H + 2, vx: a * 10, vy: -14 - Math.random() * 18, vida: 2.2, col: Math.random() < 0.6 ? P.fuego : P.lavaLuz });
    else this.fx.una({ x, y, vx: a * 8, vy: a * 6, vida: 2.5, col: '#8ff08a' });
  }

  pasarLava(dt) {
    const lv = this.lava;
    if (!lv) return;
    if (lv.espera > 0) { lv.espera -= dt; return; }
    let vel = lv.vel;
    if (this.torre) {
      // la torre acelera con el tiempo y no deja que la lava quede muy lejos
      vel = Math.min(3, lv.vel + 0.02 * this.t);
      const lejos = lv.y / CELDA - this.posLu()[1];
      if (lejos > 26) vel += (lejos - 26) * 0.25;
    }
    lv.y -= vel * CELDA * dt;
    if (dt && Math.random() < 0.3) {
      // brasas que suben de la superficie
      const x = Math.random() * this.nv.ancho * CELDA;
      this.fx.una({ x, y: lv.y - 1, vx: (Math.random() - 0.5) * 8, vy: -15 - Math.random() * 20, vida: 0.8, col: Math.random() < 0.5 ? P.lavaLuz : P.lava });
    }
  }

  pasarIman(dt) {
    const lu = this.lu, nv = this.nv;
    if (this.poder.iman > 0 && this.estado === 'jugando') {
      const [lx, ly] = this.posLu(), R = 3;
      for (let y = Math.round(ly) - R; y <= Math.round(ly) + R; y++) for (let x = Math.round(lx) - R; x <= Math.round(lx) + R; x++) {
        if (x < 0 || y < 0 || x >= nv.ancho || y >= nv.alto) continue;
        const i = y * nv.ancho + x, o = nv.obj[i];
        if ((o === O.CHISPA || o === O.MONEDA) && Math.hypot(x - lx, y - ly) <= R) {
          nv.obj[i] = O.NADA;
          const [px, py] = this.centro(x, y);
          this.volando.push({ x: px, y: py, o, v: 0 });
        }
      }
    }
    const [lx, ly] = this.centroLu();
    for (const v of this.volando) {
      v.v += 900 * dt;
      const dx = lx - v.x, dy = ly - v.y, d = Math.hypot(dx, dy);
      if (d < 4 || !lu.visible) { v.listo = true; if (lu.visible) this.efectoJuntar(v.o, lx, ly, -1); continue; }
      const paso = Math.min(d, v.v * dt);
      v.x += (dx / d) * paso; v.y += (dy / d) * paso;
    }
    this.volando = this.volando.filter((v) => !v.listo);
  }

  pasarTorre() {
    const [, ly] = this.posLu();
    // asegurar que haya torre hecha bastante más arriba de lo que se ve
    this.torre.asegurar(Math.floor((this.camY ?? ly * CELDA) / CELDA) - 48);
    const subio = this.nv.inicio.y - Math.round(ly);
    if (subio > this.altoMax) this.altoMax = subio;
    this.alto = subio;
    // lo que la lava ya tapó no vuelve: se suelta
    if (this.lava) {
      const hondo = this.lava.y / CELDA + 40;
      this.pintor.olvidarDebajo(hondo);
      this.nv.polillas = this.nv.polillas.filter((m) => m.y < hondo);
      this.nv.erizos = this.nv.erizos.filter((e) => e.y < hondo);
      this.nv.cabezas = this.nv.cabezas.filter((c) => c.y < hondo);
    }
  }

  // ── Lu: cómo se ve ───────────────────────────────────────────────────────
  animarLu(dt) {
    const lu = this.lu;
    lu.aplaste = Math.max(0, lu.aplaste - dt * 7);
    if (lu.empujon && (lu.empujon.t -= dt) <= 0) lu.empujon = null;
    if ((lu.parpadeo -= dt) < -0.12) lu.parpadeo = 2 + Math.random() * 3;
    const [px, py] = this.centroLu();
    if (lu.mueve) {
      lu.rastro.push([px, py]);
      if (lu.rastro.length > 5) lu.rastro.shift();
    } else if (lu.rastro.length) lu.rastro.shift();
    // cuando está quieta, de vez en cuando suelta una lucecita
    if (lu.visible && !lu.mueve && Math.random() < dt * 2.5) {
      this.fx.una({ x: px + (Math.random() - 0.5) * 6, y: py + 2, vx: (Math.random() - 0.5) * 6, vy: -8 - Math.random() * 6, vida: 0.7, col: S.PIELES[this.piel]?.L || P.lu });
    }
  }

  spriteLu() {
    const lu = this.lu, mueve = lu.mueve;
    const alas = mueve ? (((this.t * 16) | 0) % 2 ? 'arriba' : 'abajo') : (((this.t * 7) | 0) % 2 ? 'arriba' : 'abajo');
    const base = S.lu(this.piel, mueve ? lu.mira : 'quieto', alas, lu.parpadeo < 0);
    if (mueve || this.estado === 'saliendo') return girado(base, this.estado === 'saliendo' ? Math.floor(lu.giro) % 4 : 0);
    return girado(base, CUARTOS_PEGADA(...lu.pegada));
  }

  // ── posiciones ───────────────────────────────────────────────────────────
  posLu() { const lu = this.lu; return [lu.x + lu.dx * lu.avance, lu.y + lu.dy * lu.avance]; }
  centro(x, y) { return [x * CELDA + CELDA / 2, y * CELDA + CELDA / 2]; }
  centroLu() { const [x, y] = this.posLu(); return this.centro(x, y); }
  visible(x, y) { return this.camY === null || (y * CELDA > this.camY - 16 && y * CELDA < this.camY + this.H + 16); }
  colorPortal(i) {
    // A y B tienen cada uno su color: el de la boca de menor índice manda
    const j = this.nv.pareja.get(i);
    return this.ordenPortal(Math.min(i, j ?? i)) % 2 ? P.portalB : P.portalA;
  }
  ordenPortal(i) {
    if (!this._portales) this._portales = [...new Set([...this.nv.pareja.keys()].map((k) => Math.min(k, this.nv.pareja.get(k))))].sort((a, b) => a - b);
    return this._portales.indexOf(i);
  }

  pasarCamara(dt) {
    const nv = this.nv, H = this.H || 200, W = this.W || 140;
    const [, py] = this.centroLu();
    const altoPx = nv.alto * CELDA;
    let obj = py - H * 0.56 + (this.lu.dy || 0) * 18;
    if (altoPx <= H) obj = (altoPx - H) / 2;
    else obj = clamp(obj, this.torre ? -Infinity : 0, altoPx - H);
    this.camY = this.camY === null ? obj : acercar(this.camY, obj, 7, dt);
    this.camX = (nv.ancho * CELDA - W) / 2;
  }

  // ── dibujo ───────────────────────────────────────────────────────────────
  dibujar(g, W, H) {
    this.medir(W, H);
    const nv = this.nv, t = this.t;
    const cx = Math.round(this.camX) + this.fx.sx, cy = Math.round(this.camY) + this.fx.sy;
    // la roca de afuera, con un poco de paralaje
    g.save();
    g.translate(0, -Math.round(cy * 0.5) % 16);
    g.fillStyle = patronRoca(g, nv.mundo);
    g.fillRect(0, -16, W, H + 32);
    g.restore();
    g.fillStyle = 'rgba(5,4,11,0.55)'; g.fillRect(0, 0, W, H);

    this.dibujarMarco(g, -cx, cy, W, H);
    const visibles = this.pintor.dibujar(g, -cx, -cy, H);
    const y0 = Math.max(0, Math.floor(cy / CELDA) - 1), y1 = Math.min(nv.alto - 1, Math.ceil((cy + H) / CELDA) + 1);
    for (let y = y0; y <= y1; y++) for (let x = 0; x < nv.ancho; x++) this.dibujarCelda(g, x, y, x * CELDA - cx, y * CELDA - cy);
    // antorchas y su luz
    g.globalCompositeOperation = 'lighter';
    for (const tr of visibles) for (const a of tr.antorchas) {
      const px = a.x * CELDA - cx + (a.lado < 0 ? -2 : 5), py = a.y * CELDA - cy;
      g.drawImage(luzRedonda('#5a2a10', 14), px + 2 - 14, py + 1 - 14);
    }
    g.globalCompositeOperation = 'source-over';
    for (const tr of visibles) for (const a of tr.antorchas) {
      const px = a.x * CELDA - cx + (a.lado < 0 ? -2 : 5), py = a.y * CELDA - cy;
      g.drawImage(S.ANTORCHA[((t * 9 + a.x * 3 + a.y) | 0) % 3], px, py - 1);
    }
    this.dibujarEnemigos(g, cx, cy);
    this.dibujarLu(g, cx, cy);
    for (const v of this.volando) {
      const spr = v.o === O.MONEDA ? S.MONEDA[0] : S.CHISPA[0];
      g.drawImage(spr, Math.round(v.x - cx - spr.width / 2), Math.round(v.y - cy - spr.height / 2));
    }
    this.fx.dibujar(g, cx, cy);
    if (this.lava) this.dibujarLava(g, cx, cy, W, H);
    this.dibujarRumbo(g, cx, cy, W, H);
    if (this.poder.hielo > 0) this.dibujarEscarcha(g, W, H);
    this.fx.dibujarFlash(g, W, H);
  }

  // En una pantalla ancha sobra piedra a los costados: una columna con su
  // línea de neón pegada al laberinto y antorchas más atrás (se mueven a
  // 0,6 de la cámara: están lejos).
  dibujarMarco(g, x0, cy, W, H) {
    const x1 = x0 + this.nv.ancho * CELDA, c = this.colores;
    if (x0 < 10) return;
    g.fillStyle = c.sombra; g.fillRect(x0 - 6, 0, 6, H); g.fillRect(x1, 0, 6, H);
    g.fillStyle = c.claro; g.fillRect(x0 - 3, 0, 1, H); g.fillRect(x1 + 2, 0, 1, H);
    g.fillStyle = P.negro; g.fillRect(x0 - 7, 0, 1, H); g.fillRect(x1 + 6, 0, 1, H);
    if (x0 < 34) return;
    const par = cy * 0.6, paso = 88;
    for (let k = Math.floor(par / paso) - 1; k <= Math.ceil((par + H) / paso) + 1; k++) {
      const y = Math.round(k * paso - par), izq = k % 2 === 0;
      const x = izq ? Math.round(x0 - 22) : Math.round(x1 + 18);
      g.globalCompositeOperation = 'lighter';
      g.drawImage(luzRedonda('#3a1c0a', 14), x + 2 - 14, y - 14);
      g.globalCompositeOperation = 'source-over';
      g.drawImage(S.ANTORCHA[((this.t * 9 + k * 5) | 0) % 3], x, y - 4);
      // una cadena colgando entre antorcha y antorcha
      g.fillStyle = '#2a2640';
      const cxa = izq ? x0 - 14 : x1 + 12;
      for (let q = 0; q < 30; q += 3) g.fillRect(cxa, y + 20 + q, 1, 2);
    }
  }

  dibujarCelda(g, x, y, px, py) {
    const nv = this.nv, i = y * nv.ancho + x, tp = nv.tipo[i], o = nv.obj[i], t = this.t;
    switch (tp) {
      case T.PINCHOS: case T.PINCHOS_A: case T.PINCHOS_B: {
        // las púas salen de cada pared vecina; si no hay ninguna, de los cuatro lados y cortas
        const spr = S.PINCHOS[tp === T.PINCHOS ? 'arriba' : pinchosEstado(tp, this.tp)];
        const lados = this.ladosPuas(x, y);
        for (const c of lados.length ? lados : [0, 1, 2, 3]) g.drawImage(girado(lados.length || spr !== S.PINCHOS.arriba ? spr : S.PINCHOS.aviso, c), px, py);
        break;
      }
      case T.FLECHA_DER: case T.FLECHA_IZQ: case T.FLECHA_ARR: case T.FLECHA_ABA: {
        const [dx, dy] = { 7: [1, 0], 8: [-1, 0], 9: [0, -1], 10: [0, 1] }[tp];
        const late = ((t * 3) | 0) % 2;
        g.drawImage(girado(S.FLECHA, CUARTOS_DIR(dx, dy)), px + (late ? dx : 0), py + (late ? dy : 0));
        break;
      }
      case T.PORTAL: {
        const col = this.colorPortal(i);
        const spr = (this._gemelos ||= { [P.portalA]: S.portalGemelo(P.portalA), [P.portalB]: S.portalGemelo(P.portalB) })[col];
        g.drawImage(spr[((t * 4) | 0) % 2], px, py);
        break;
      }
      case T.SALIDA: {
        const spr = S.PORTAL[((t * 10) | 0) % 4];
        g.globalCompositeOperation = 'lighter';
        g.drawImage(luzRedonda('#1a3a6a', 12), px + 4 - 12, py + 4 - 12);
        g.globalCompositeOperation = 'source-over';
        g.drawImage(spr, px - 1, py - 1);
        break;
      }
      case T.LAVA: {
        g.fillStyle = P.lavaOsc; g.fillRect(px, py, CELDA, CELDA);
        g.fillStyle = P.lava;
        for (let k = 0; k < CELDA; k++) { const h = Math.round(1.5 + Math.sin(t * 3 + (x * CELDA + k) * 0.7)); g.fillRect(px + k, py + h, 1, CELDA - h); }
        g.fillStyle = P.lavaLuz; g.fillRect(px + ((t * 5 + x * 3) | 0) % 7, py + 4, 1, 1);
        break;
      }
      case T.CABEZA: {
        const c = this.cabezaEn(i);
        if (c) {
          const abierta = c.reloj !== undefined && c.reloj > CICLO_CABEZA - 0.35;
          const cuartos = c.dy > 0 ? 0 : c.dx < 0 ? 1 : c.dy < 0 ? 2 : 3;
          g.drawImage(girado(abierta ? S.CABEZA.abierta : S.CABEZA.cerrada, cuartos), px, py);
        }
        break;
      }
      case T.FRAGIL: g.drawImage(S.GRIETA[1], px, py); break;
    }
    if (!o) return;
    switch (o) {
      case O.CHISPA: {
        const f = ((t * 2 + x * 0.37 + y * 0.61) | 0) % 5 === 0 ? 1 : 0;
        g.drawImage(S.CHISPA[f], px + 2, py + 2);
        break;
      }
      case O.MONEDA: {
        const spr = S.MONEDA[((t * 8 + x + y) | 0) % 4];
        g.drawImage(spr, px + 4 - (spr.width >> 1), py + 1 + (((t * 2 + x) | 0) % 2));
        break;
      }
      case O.ESTRELLA: {
        const spr = S.ESTRELLA[((t * 3) | 0) % 2];
        g.globalCompositeOperation = 'lighter';
        g.drawImage(luzRedonda('#3a2e08', 9), px + 4 - 9, py + 4 - 9);
        g.globalCompositeOperation = 'source-over';
        g.drawImage(spr, px, py + Math.round(Math.sin(t * 4 + x) * 1));
        break;
      }
      default: {
        const k = PODER_DE_OBJ[o];
        if (k) g.drawImage(S.PODER[k], px - 1, py - 1 + Math.round(Math.sin(t * 5 + y)));
      }
    }
  }

  // De qué paredes salen las púas (en cuartos de giro del sprite): de las
  // que tienen enfrente un lado abierto, así apuntan hacia donde se pasa. En
  // una muesca salen solo del fondo; en un pasillo, de las dos paredes.
  ladosPuas(x, y) {
    const nv = this.nv, i = y * nv.ancho + x;
    const m = (this._puas ||= new Map());
    if (!m.has(i)) {
      const lados = [[0, 1, 0], [-1, 0, 1], [0, -1, 2], [1, 0, 3]];
      const solidas = lados.filter(([dx, dy]) => esSolida(nv, x + dx, y + dy));
      const frente = solidas.filter(([dx, dy]) => !esSolida(nv, x - dx, y - dy));
      m.set(i, (frente.length ? frente : solidas).map((l) => l[2]));
    }
    return m.get(i);
  }

  cabezaEn(i) {
    const nv = this.nv;
    if (!this._cabezas || this._cabezas.n !== nv.cabezas.length) {
      this._cabezas = new Map(nv.cabezas.map((c) => [c.y * nv.ancho + c.x, c]));
      this._cabezas.n = nv.cabezas.length;
    }
    return this._cabezas.get(i);
  }

  dibujarEnemigos(g, cx, cy) {
    const nv = this.nv, t = this.t, helado = this.poder.hielo > 0;
    for (const e of nv.erizos) {
      const px = e.x * CELDA + 4 - cx, py = e.y * CELDA + 4 - cy;
      if (py < -20 || py > this.H + 20) continue;
      const est = erizoEstado(e, this.tp);
      if (est === 'grande') g.drawImage(S.ERIZO.grande, px - 12, py - 12);
      else g.drawImage(S.ERIZO.chico, px - 4 + (est === 'tiembla' ? ((t * 40) | 0) % 2 : 0), py - 4);
    }
    for (const m of nv.polillas) {
      const [mx, my] = this.posPolilla(m);
      const px = Math.round(mx * CELDA + 4 - cx), py = Math.round(my * CELDA + 4 - cy + (helado ? 0 : Math.sin(t * 9 + m.x) * 1.2));
      if (py < -12 || py > this.H + 12) continue;
      const spr = S.POLILLA[helado ? 0 : ((t * 10 + m.x) | 0) % 2];
      g.drawImage(spr, px - 4, py - 4);
      if (helado) { g.fillStyle = 'rgba(166,246,255,0.45)'; g.fillRect(px - 5, py - 5, 10, 10); }
    }
    for (const b of this.bolas) {
      const px = Math.round(b.x * CELDA + 4 - cx), py = Math.round(b.y * CELDA + 4 - cy);
      g.globalCompositeOperation = 'lighter';
      g.drawImage(luzRedonda('#5a2008', 8), px - 8, py - 8);
      g.globalCompositeOperation = 'source-over';
      g.drawImage(S.BOLA_FUEGO[((t * 12) | 0) % 2], px - 2, py - 2);
    }
  }

  dibujarLu(g, cx, cy) {
    const lu = this.lu;
    if (!lu.visible) return;
    const [px0, py0] = this.centroLu();
    const px = px0 - cx, py = py0 - cy;
    const col = S.PIELES[this.piel]?.L || P.lu;
    // su luz: es una luciérnaga
    g.globalCompositeOperation = 'lighter';
    g.drawImage(luzRedonda(oscurecer(col), 14), Math.round(px) - 14, Math.round(py) - 14);
    g.globalCompositeOperation = 'source-over';
    const spr = this.spriteLu();
    // estela: siluetas que se apagan
    lu.rastro.forEach(([rx, ry], k) => {
      g.globalAlpha = 0.12 + 0.1 * k;
      const sil = S.silueta(spr, col);
      g.drawImage(sil, Math.round(rx - cx - sil.width / 2), Math.round(ry - cy - sil.height / 2));
    });
    g.globalAlpha = 1;
    // aplastar y estirar: largo en la dirección en que va, chato contra la pared
    let sx = 1, sy = 1;
    if (lu.mueve) { if (lu.dx) { sx = 1.35; sy = 0.78; } else { sx = 0.78; sy = 1.3; } }
    else if (lu.aplaste > 0) {
      const a = lu.aplaste * 0.45, [wx, wy] = lu.pegada;
      if (wx) { sx = 1 - a; sy = 1 + a * 0.8; } else { sy = 1 - a; sx = 1 + a * 0.8; }
    }
    sx *= lu.escala; sy *= lu.escala;
    let ex = 0, ey = 0;
    if (lu.empujon) { ex = lu.empujon.dx; ey = lu.empujon.dy; if (lu.empujon.dx) sx *= 0.8; else sy *= 0.8; }
    // pegada a la pared: los pies pisan la línea de neón (el sprite es impar
    // de alto, así que de un lado ya la pisa y del otro hay que correrlo)
    if (!lu.mueve && this.estado === 'jugando') { if (lu.pegada[0] < 0) ex -= 1; if (lu.pegada[1] < 0) ey -= 1; }
    const w = Math.max(1, Math.round(spr.width * sx)), h = Math.max(1, Math.round(spr.height * sy));
    if (this.invulnerable > 0 && ((this.t * 20) | 0) % 2) return;
    g.drawImage(spr, Math.round(px - w / 2 + ex), Math.round(py - h / 2 + ey), w, h);
    if (this.poder.escudo > 0 && (this.poder.escudo > 1.5 || ((this.t * 10) | 0) % 2)) this.dibujarBurbuja(g, px, py);
    if (this.poder.iman > 0 && ((this.t * 8) | 0) % 2) {
      g.fillStyle = P.iman;
      const r = 10 + ((this.t * 20) % 6);
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2 + this.t; g.fillRect(Math.round(px + Math.cos(a) * r), Math.round(py + Math.sin(a) * r), 1, 1); }
    }
  }

  dibujarBurbuja(g, px, py) {
    const r = 7 + Math.round(Math.sin(this.t * 6) * 0.6);
    g.fillStyle = P.escudo;
    const pasos = 36;
    for (let k = 0; k < pasos; k++) {
      const a = (k / pasos) * Math.PI * 2;
      g.fillRect(Math.round(px + Math.cos(a) * r), Math.round(py + Math.sin(a) * r), 1, 1);
    }
    g.fillStyle = P.blanco; g.fillRect(Math.round(px - r * 0.5), Math.round(py - r * 0.6), 2, 1);
  }

  dibujarLava(g, cx, cy, W, H) {
    const sup = Math.round(this.lava.y - cy);
    if (sup > H + 4) return;
    const helada = this.poder.hielo > 0, t = this.t;
    const colA = helada ? '#6b7a90' : P.lava, colB = helada ? '#3c4658' : P.lavaOsc, colC = helada ? '#dff8ff' : P.lavaLuz;
    // el resplandor de arriba, tramado
    if (!helada) {
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = '#3a0d08';
      for (let y = sup - 18; y < sup; y++) for (let x = (y & 1); x < W; x += 2) if ((sup - y) < 6 || ((x + y * 3) % 7 === 0)) g.fillRect(x, y, 1, 1);
      g.globalCompositeOperation = 'source-over';
    }
    for (let x = 0; x < W; x++) {
      const ola = helada ? 0 : Math.round(Math.sin(t * 2.2 + (x + cx) * 0.18) * 1.5 + Math.sin(t * 3.7 + (x + cx) * 0.07) * 1);
      const y = sup + ola;
      g.fillStyle = colC; g.fillRect(x, y, 1, 1);
      g.fillStyle = colA; g.fillRect(x, y + 1, 1, 4);
      g.fillStyle = colB; g.fillRect(x, y + 5, 1, H - y);
    }
    if (!helada) {
      g.fillStyle = P.lavaNegra;
      for (let k = 0; k < 6; k++) {
        const x = Math.round((k * 53 + t * 9 * (k % 2 ? 1 : -1)) % W + W) % W, y = sup + 9 + ((k * 17) % 20);
        g.fillRect(x, y, 3, 1);
      }
    }
  }

  // Si la salida está arriba, fuera de la pantalla: una flechita con los
  // colores del portal que marca para dónde queda.
  dibujarRumbo(g, cx, cy, W, H) {
    const s = this.nv.salida;
    if (!s || this.torre || this.estado !== 'jugando') return;
    const sy = s.y * CELDA + 4 - cy;
    if (sy > 18) return;
    if (((this.t * 3) | 0) % 3 === 0) return;
    const x = Math.round(s.x * CELDA + 4 - cx), y = 19 + Math.round(Math.sin(this.t * 5));
    g.fillStyle = P.negro; g.fillRect(x - 4, y - 1, 9, 6);
    g.fillStyle = ((this.t * 6) | 0) % 2 ? P.portalA : P.portalB;
    for (let k = 0; k < 3; k++) g.fillRect(x - k, y + k, 1 + 2 * k, 1);
    g.fillRect(x - 3, y + 3, 7, 1);
  }

  dibujarEscarcha(g, W, H) {
    // un marco de escarcha que titila cuando se está por acabar
    if (this.poder.hielo < 1.5 && ((this.t * 8) | 0) % 2) return;
    g.fillStyle = 'rgba(166,246,255,0.5)';
    for (let x = 0; x < W; x += 2) { const h = 2 + ((x * 7) % 5); g.fillRect(x, 0, 1, h); g.fillRect(x, H - h, 1, h); }
    for (let y = 0; y < H; y += 2) { const w = 2 + ((y * 5) % 4); g.fillRect(0, y, w, 1); g.fillRect(W - w, y, w, 1); }
  }

  // El cartel del principio (el tutorial de cada mecánica nueva).
  dibujarCartel(g, W, H, texto_) {
    if (!this.cartel || this.cartel.t > 5) return;
    const k = this.cartel.t, entra = Math.min(1, k * 4), sale = k > 4.5 ? (k - 4.5) * 2 : 0;
    const y = Math.round(H - 34 + (1 - entra) * 30 + sale * 30);
    // cada renglón escrito se vuelve a partir si no entra en la pantalla
    const lineas = texto_.split('\n').flatMap((l) => partir(l, W - 14));
    const w = Math.max(...lineas.map((l) => anchoTexto(l))) + 12, h = lineas.length * 10 + 8;
    const x = Math.round(W / 2 - w / 2);
    g.fillStyle = P.negro; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = P.fondo3; g.fillRect(x, y, w, h);
    g.fillStyle = this.colores.borde; g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1);
    lineas.forEach((l, n) => texto(g, l, W / 2, y + 3 + n * 10, P.blanco, { alinear: 'centro' }));
  }
}

function pegadaInicial(nv, x, y) {
  for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) if (esSolida(nv, x + dx, y + dy)) return [dx, dy];
  return [0, 1];
}

function oscurecer(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v * 0.28).toString(16).padStart(2, '0');
  return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255);
}

// Pinta lo quieto del laberinto (paredes y piso) en trozos de 32 filas que se
// hornean una vez y después solo se copian. Las paredes se "autoarman": cada
// cara que da al piso lleva la línea de neón (borde + luz), las esquinas de
// adentro llevan su píxel y el piso de al lado recibe el reflejo. Así el
// nivel se escribe con un solo '#' y se ve como tubos de luz.
//
// La torre infinita usa lo mismo: sus trozos se hornean a medida que se
// generan y los que quedan abajo, lejos, se tiran.
import { T } from './reglas.js';
import { MUNDOS_COLOR, P } from './paleta.js';

export const CELDA = 8;
export const FILAS_TROZO = 32;

// Un número entre 0 y 1 fijo para cada celda: el adorno no cambia al volver.
function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const pintaSolida = (t) => t === T.PARED || t === T.FRAGIL || t === T.CABEZA;

export class Pintor {
  constructor(nv, mundo, semilla = 7) {
    this.nv = nv;
    this.c = MUNDOS_COLOR[mundo] || MUNDOS_COLOR[0];
    this.mundo = mundo;
    this.semilla = semilla;
    this.trozos = new Map();
    // la fila más alta que ya existe: la torre la sube a medida que genera;
    // un nivel está entero (la fila -1 es "afuera", o sea pared)
    this.listoDesde = () => -1;
  }

  solida(x, y) {
    const nv = this.nv;
    if (x < 0 || x >= nv.ancho || y < 0 || y >= nv.alto) return true;
    return pintaSolida(nv.tipo[y * nv.ancho + x]);
  }

  // Tirar los trozos que tocan la fila y (romper una pared cambia a las vecinas).
  invalidar(y) {
    for (const k of new Set([Math.floor((y - 1) / FILAS_TROZO), Math.floor(y / FILAS_TROZO), Math.floor((y + 1) / FILAS_TROZO)])) this.trozos.delete(k);
  }

  // Tirar lo que quedó más abajo que `y` (la torre).
  olvidarDebajo(y) {
    for (const k of this.trozos.keys()) if (k * FILAS_TROZO > y) this.trozos.delete(k);
  }

  trozo(k) {
    let tr = this.trozos.get(k);
    if (tr) return tr;
    const y0 = k * FILAS_TROZO;
    if (y0 - 1 < this.listoDesde()) return null;          // la fila de arriba todavía no existe
    const filas = Math.min(FILAS_TROZO, this.nv.alto - y0);
    if (filas <= 0) return null;
    const lienzo = document.createElement('canvas');
    lienzo.width = this.nv.ancho * CELDA; lienzo.height = filas * CELDA;
    const g = lienzo.getContext('2d');
    const antorchas = [];
    for (let y = y0; y < y0 + filas; y++) for (let x = 0; x < this.nv.ancho; x++) {
      if (this.solida(x, y)) this.pared(g, x, y, y0, antorchas);
      else this.piso(g, x, y, y0);
    }
    for (let y = y0; y < y0 + filas; y++) for (let x = 0; x < this.nv.ancho; x++) if (!this.solida(x, y)) this.adornoPiso(g, x, y, y0);
    tr = { lienzo, y0, antorchas };
    this.trozos.set(k, tr);
    return tr;
  }

  piso(g, x, y, y0) {
    const px = x * CELDA, py = (y - y0) * CELDA, c = this.c;
    g.fillStyle = P.fondo; g.fillRect(px, py, CELDA, CELDA);
    // motitas de polvo: le dan fondo al negro sin ensuciarlo
    const h = hash(x, y, this.semilla);
    if (h < 0.35) { g.fillStyle = P.fondo2; g.fillRect(px + Math.floor(h * 20) % 7, py + Math.floor(h * 97) % 7, 1, 1); }
    // el reflejo del neón en el piso, del lado de cada pared vecina
    const n = this.solida(x, y - 1), s = this.solida(x, y + 1), o = this.solida(x - 1, y), e = this.solida(x + 1, y);
    g.fillStyle = c.luz;
    if (n) g.fillRect(px, py, CELDA, 1);
    if (s) g.fillRect(px, py + 7, CELDA, 1);
    if (o) g.fillRect(px, py, 1, CELDA);
    if (e) g.fillRect(px + 7, py, 1, CELDA);
    if (!n && !o && this.solida(x - 1, y - 1)) g.fillRect(px, py, 1, 1);
    if (!n && !e && this.solida(x + 1, y - 1)) g.fillRect(px + 7, py, 1, 1);
    if (!s && !o && this.solida(x - 1, y + 1)) g.fillRect(px, py + 7, 1, 1);
    if (!s && !e && this.solida(x + 1, y + 1)) g.fillRect(px + 7, py + 7, 1, 1);
  }

  pared(g, x, y, y0, antorchas) {
    const px = x * CELDA, py = (y - y0) * CELDA, c = this.c;
    const n = !this.solida(x, y - 1), s = !this.solida(x, y + 1), o = !this.solida(x - 1, y), e = !this.solida(x + 1, y);
    g.fillStyle = c.relleno; g.fillRect(px, py, CELDA, CELDA);
    this.textura(g, x, y, px, py, n || s || o || e);
    // la luz de adentro primero, el borde después: en los cruces gana el borde
    g.fillStyle = c.claro;
    if (n) g.fillRect(px, py + 1, CELDA, 1);
    if (s) g.fillRect(px, py + 6, CELDA, 1);
    if (o) g.fillRect(px + 1, py, 1, CELDA);
    if (e) g.fillRect(px + 6, py, 1, CELDA);
    g.fillStyle = c.borde;
    if (n) g.fillRect(px, py, CELDA, 1);
    if (s) g.fillRect(px, py + 7, CELDA, 1);
    if (o) g.fillRect(px, py, 1, CELDA);
    if (e) g.fillRect(px + 7, py, 1, CELDA);
    // esquinas de afuera redondeadas: el píxel del vértice se apaga
    g.fillStyle = c.claro;
    if (n && o) g.fillRect(px, py, 1, 1);
    if (n && e) g.fillRect(px + 7, py, 1, 1);
    if (s && o) g.fillRect(px, py + 7, 1, 1);
    if (s && e) g.fillRect(px + 7, py + 7, 1, 1);
    // esquinas de adentro: la línea dobla sin cortarse
    const esquina = (vacia, bx, by, ix, iy) => {
      if (!vacia) return;
      g.fillStyle = c.claro; g.fillRect(px + ix, py + by, 1, 1); g.fillRect(px + bx, py + iy, 1, 1); g.fillRect(px + ix, py + iy, 1, 1);
      g.fillStyle = c.borde; g.fillRect(px + bx, py + by, 1, 1);
    };
    esquina(!n && !e && !this.solida(x + 1, y - 1), 7, 0, 6, 1);
    esquina(!n && !o && !this.solida(x - 1, y - 1), 0, 0, 1, 1);
    esquina(!s && !e && !this.solida(x + 1, y + 1), 7, 7, 6, 6);
    esquina(!s && !o && !this.solida(x - 1, y + 1), 0, 7, 1, 6);
    // una antorcha de vez en cuando, en las caras de costado que dan a un pasillo
    if ((o || e) && !n && !s && hash(x, y, this.semilla + 3) < 0.035 && this.nv.tipo[y * this.nv.ancho + x] === T.PARED) antorchas.push({ x, y, lado: o ? -1 : 1 });
  }

  // El dibujo de adentro de la piedra, uno por mundo.
  textura(g, x, y, px, py, borde) {
    const c = this.c, h = hash(x, y, this.semilla);
    g.fillStyle = c.sombra;
    if (this.mundo === 0) {
      // catacumbas: ladrillos trabados y, muy de vez en cuando, una calavera
      g.fillRect(px, py + 3, CELDA, 1); g.fillRect(px, py + 7, CELDA, 1);
      g.fillRect(px + ((y & 1) ? 1 : 5), py, 1, 3); g.fillRect(px + ((y & 1) ? 5 : 1), py + 4, 1, 3);
      if (!borde && h < 0.05) {
        g.fillStyle = c.detalle; g.fillRect(px + 2, py + 1, 4, 3); g.fillRect(px + 3, py + 4, 2, 1);
        g.fillStyle = c.sombra; g.fillRect(px + 2, py + 2, 1, 1); g.fillRect(px + 5, py + 2, 1, 1);
      }
    } else if (this.mundo === 1) {
      // jardín de hongos: tierra blanda con esporas que brillan
      g.fillRect(px + Math.floor(h * 6), py + Math.floor(h * 31) % 6, 2, 2);
      g.fillRect(px + (Math.floor(h * 53) % 6), py + 5, 1, 1);
      if (h > 0.8) { g.fillStyle = c.detalle; g.fillRect(px + 3, py + 3, 2, 2); g.fillStyle = c.claro; g.fillRect(px + 3, py + 3, 1, 1); }
    } else if (this.mundo === 2) {
      // horno: piedra rajada con vetas de brasa
      if (h < 0.5) { g.fillRect(px + 1, py + 2, 3, 1); g.fillRect(px + 4, py + 3, 2, 1); g.fillRect(px + 6, py + 4, 1, 2); }
      else { g.fillRect(px + 2, py + 5, 3, 1); g.fillRect(px + 5, py + 1, 1, 3); }
      if (!borde && h > 0.86) { g.fillStyle = c.detalle; g.fillRect(px + 2, py + 2, 4, 1); g.fillStyle = c.claro; g.fillRect(px + 3, py + 2, 2, 1); }
    } else {
      // la torre: bloques grandes con bisel
      if (!(x & 1)) g.fillRect(px + 7, py, 1, CELDA);
      if (!(y & 1)) g.fillRect(px, py + 7, CELDA, 1);
      g.fillStyle = c.detalle;
      if (h < 0.3) g.fillRect(px + 2, py + 2, 2, 1);
    }
  }

  // Lo que crece del borde de la pared hacia el pasillo (va después, arriba del piso).
  adornoPiso(g, x, y, y0) {
    if (!this.solida(x, y + 1)) return;
    const h = hash(x, y, this.semilla + 11);
    if (h > 0.22) return;
    const px = x * CELDA, py = (y - y0) * CELDA;
    if (this.mundo === 0) {
      // un huesito tirado
      g.fillStyle = '#6f7c8a'; g.fillRect(px + 2, py + 6, 4, 1); g.fillRect(px + 1, py + 5, 1, 1); g.fillRect(px + 6, py + 5, 1, 1);
    } else if (this.mundo === 1) {
      // un hongo chiquito que brilla
      g.fillStyle = '#ff9af0'; g.fillRect(px + 2 + Math.floor(h * 12), py + 4, 3, 1); g.fillStyle = '#ffe0fb'; g.fillRect(px + 3 + Math.floor(h * 12), py + 4, 1, 1);
      g.fillStyle = '#d7b6e8'; g.fillRect(px + 3 + Math.floor(h * 12), py + 5, 1, 2);
    } else if (this.mundo === 2) {
      // brasas
      g.fillStyle = P.lavaOsc; g.fillRect(px + 1 + Math.floor(h * 20), py + 6, 2, 1);
      g.fillStyle = P.fuego; g.fillRect(px + 2 + Math.floor(h * 20), py + 6, 1, 1);
    } else {
      g.fillStyle = '#3fb94a'; g.fillRect(px + 2, py + 6, 1, 1); g.fillRect(px + 4, py + 5, 1, 2); g.fillRect(px + 6, py + 6, 1, 1);
    }
  }

  // Copia los trozos que se ven. (ox, oy) = dónde cae la celda (0, 0) en pantalla.
  dibujar(g, ox, oy, alto) {
    const k0 = Math.floor(-oy / (FILAS_TROZO * CELDA)), k1 = Math.floor((alto - oy) / (FILAS_TROZO * CELDA));
    const visibles = [];
    for (let k = k0; k <= k1; k++) {
      const tr = this.trozo(k);
      if (!tr) continue;
      g.drawImage(tr.lienzo, ox, oy + tr.y0 * CELDA);
      visibles.push(tr);
    }
    return visibles;
  }
}

// La piedra de afuera del laberinto (a los costados en pantallas anchas): el
// mismo ladrillo, apagado, como un patrón.
const patrones = new Map();
export function patronRoca(g, mundo) {
  if (patrones.has(mundo)) return patrones.get(mundo);
  const c = MUNDOS_COLOR[mundo] || MUNDOS_COLOR[0];
  const l = document.createElement('canvas');
  l.width = 16; l.height = 16;
  const q = l.getContext('2d');
  q.fillStyle = c.sombra; q.fillRect(0, 0, 16, 16);
  q.fillStyle = P.negro;
  q.fillRect(0, 7, 16, 1); q.fillRect(0, 15, 16, 1); q.fillRect(3, 0, 1, 7); q.fillRect(11, 8, 1, 7);
  q.fillStyle = c.relleno; q.fillRect(5, 3, 1, 1); q.fillRect(13, 11, 1, 1);
  const p = g.createPattern(l, 'repeat');
  patrones.set(mundo, p);
  return p;
}

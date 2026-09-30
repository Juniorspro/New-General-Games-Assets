// La física de Morfi: hilos hechos de partículas (Verlet) y un caramelo que
// cuelga de ellos.
//
// Cada partícula guarda dónde está y dónde estaba un paso antes: la
// velocidad es la diferencia (así el hilo no se "explota" como con
// velocidades explícitas). Un hilo es una fila de partículas unidas de a dos
// por un largo fijo; en cada paso se corrigen esos largos varias vueltas. La
// punta de un hilo es un alfiler (masa infinita: no se mueve, o lo mueve el
// nivel) y la otra, el caramelo, que pesa más que un pedazo de hilo.
//
// El paso es fijo (1/120 s): con el mismo corte en el mismo paso, el
// caramelo cae siempre igual, y las soluciones de los niveles se pueden
// guardar y comprobar.
export const PASO = 1 / 120;
export const GRAVEDAD = 1150;
const VUELTAS = 20;          // vueltas de corrección de largos por paso
const TRAMO = 11;            // largo de cada pedacito de hilo
const AIRE_HILO = 0.992;     // cuánto frena el aire (por paso)
// un pedacito de hilo pesa 1/IM_HILO; el caramelo, 6 (partida.js): el hilo
// es de algodón, liviano, y un globo levanta al caramelo con hilo y todo
export const IM_HILO = 12;

export class Mundo {
  constructor(cap = 1024) {
    this.cap = cap; this.n = 0;
    this.x = new Float64Array(cap); this.y = new Float64Array(cap);
    this.px = new Float64Array(cap); this.py = new Float64Array(cap);
    this.im = new Float64Array(cap);          // 1 / masa (0: fijo)
    this.ax = new Float64Array(cap); this.ay = new Float64Array(cap);   // aceleración de más (el globo)
    this.aire = new Float64Array(cap);
    this.activa = new Uint8Array(cap);
    this.hilos = [];
    this.siguienteId = 1;
    this.g = GRAVEDAD;
  }

  particula(x, y, im = IM_HILO, aire = AIRE_HILO) {
    if (this.n >= this.cap) this.crecer();
    const i = this.n++;
    this.x[i] = this.px[i] = x; this.y[i] = this.py[i] = y;
    this.im[i] = im; this.ax[i] = 0; this.ay[i] = 0; this.aire[i] = aire; this.activa[i] = 1;
    return i;
  }
  crecer() {
    const cap = this.cap * 2;
    for (const k of ['x', 'y', 'px', 'py', 'im', 'ax', 'ay', 'aire']) { const a = new Float64Array(cap); a.set(this[k]); this[k] = a; }
    const a = new Uint8Array(cap); a.set(this.activa); this.activa = a;
    this.cap = cap;
  }

  // Un hilo de `a` (el alfiler) a `b` (el caramelo), de largo `largo`. Si es
  // más largo que la distancia, nace colgando en panza (una parábola que
  // mide más o menos lo mismo que el hilo).
  hilo(a, b, largo, datos = {}) {
    const ax = this.x[a], ay = this.y[a], bx = this.x[b], by = this.y[b];
    const D = Math.hypot(bx - ax, by - ay) || 1;
    largo = Math.max(largo, 8);
    const n = Math.max(2, Math.ceil(largo / TRAMO));
    const panza = largo > D ? Math.sqrt((3 * D * (largo - D)) / 8) : 0;
    // la panza hacia abajo (del lado de la gravedad)
    let nx = -(by - ay) / D, ny = (bx - ax) / D;
    if (ny < 0) { nx = -nx; ny = -ny; }
    const p = [a];
    for (let k = 1; k < n; k++) {
      const t = k / n, s = 4 * t * (1 - t) * panza;
      p.push(this.particula(ax + (bx - ax) * t + nx * s, ay + (by - ay) * t + ny * s));
    }
    p.push(b);
    const h = { id: this.siguienteId++, p, d: largo / n, vivo: true, alfa: 1, suelto: false, cortado: false, ...datos };
    this.hilos.push(h);
    return h;
  }

  // Los hilos que todavía sostienen a la partícula `b` (el caramelo).
  sostienen(b) { return this.hilos.filter((h) => h.vivo && !h.suelto && h.p[h.p.length - 1] === b); }
  // Soltar todo lo que cuelga de `b`: los hilos se cortan del lado de `b` y
  // los pedazos sueltos se borran ya (al pasar por un sobre, el caramelo
  // aparece en otro lado y los pedazos lo tiraban para atrás).
  soltarDe(b) {
    for (const h of [...this.hilos]) {
      if (!h.vivo || h.p[h.p.length - 1] !== b) continue;
      if (h.suelto) { this.matar(h); continue; }
      const c = this.cortarEn(h, h.p.length - 2);
      if (c && c.caramelo.vivo) this.matar(c.caramelo);
    }
  }

  paso(dt = PASO) {
    const { x, y, px, py, im, ax, ay, aire, activa } = this, dt2 = dt * dt, g = this.g;
    for (let i = 0; i < this.n; i++) {
      if (!activa[i] || im[i] === 0) continue;
      const vx = (x[i] - px[i]) * aire[i], vy = (y[i] - py[i]) * aire[i];
      px[i] = x[i]; py[i] = y[i];
      x[i] += vx + ax[i] * dt2; y[i] += vy + (g + ay[i]) * dt2;
    }
    for (let v = 0; v < VUELTAS; v++) {
      for (const h of this.hilos) {
        if (!h.vivo) continue;
        const p = h.p, d = h.d, ult = p.length - 2;
        for (let k = 0; k < p.length - 1; k++) {
          // el pedazo que quedó colgando del caramelo cuelga de él como de un
          // alfiler: el caramelo lo arrastra, pero el pedazo no tira del
          // caramelo (si no, un corte lo volvía más pesado y cambiaba el vuelo)
          const a = p[k], b = p[k + 1], ia = im[a], ib = h.suelto && k === ult ? 0 : im[b], w = ia + ib;
          if (w === 0) continue;
          const dx = x[b] - x[a], dy = y[b] - y[a], L = Math.sqrt(dx * dx + dy * dy) || 1e-9;
          const f = (L - d) / (L * w);
          x[a] += dx * f * ia; y[a] += dy * f * ia;
          x[b] -= dx * f * ib; y[b] -= dy * f * ib;
        }
        // la correa: la punta no se aleja del alfiler más que el largo del
        // hilo. Con el caramelo 70 veces más pesado que un pedacito, las
        // vueltas solas dejaban que el hilo se estirara como un elástico.
        if (h.suelto) continue;
        const a = p[0], b = p[p.length - 1];
        if (im[a] !== 0 || im[b] === 0) continue;
        const dx = x[b] - x[a], dy = y[b] - y[a], L = Math.sqrt(dx * dx + dy * dy), tope = d * (p.length - 1);
        if (L > tope) { const f = (L - tope) / L; x[b] -= dx * f; y[b] -= dy * f; }
      }
    }
    // los pedazos que quedaron colgando del caramelo se borran de a poco
    for (const h of this.hilos) if (h.vivo && h.suelto && (h.alfa -= dt * 1.2) <= 0) this.matar(h);
  }

  matar(h) {
    h.vivo = false;
    // sus partículas del medio dejan de simularse (las puntas son de otros)
    for (let k = 1; k < h.p.length - 1; k++) this.activa[h.p[k]] = 0;
    if (h.suelto) this.activa[h.p[0]] = 0;
  }

  // Cortar el hilo `h` en el tramo `k` (entre p[k] y p[k+1]): queda el pedazo
  // del alfiler, colgando, y el del caramelo, que se borra en un segundo.
  cortarEn(h, k) {
    if (!h.vivo) return null;
    k = Math.max(0, Math.min(h.p.length - 2, k));
    h.vivo = false;
    const a = { ...h, id: this.siguienteId++, p: h.p.slice(0, k + 1), vivo: h.p.slice(0, k + 1).length > 1, cortado: true, suelto: false, alfa: 1 };
    const b = { ...h, id: this.siguienteId++, p: h.p.slice(k + 1), vivo: h.p.slice(k + 1).length > 1, cortado: true, suelto: true, alfa: 1 };
    // el pedazo del caramelo: su primera partícula queda libre
    if (b.p.length) { const q = b.p[0]; if (this.im[q] === 0) this.im[q] = IM_HILO; }
    this.hilos.push(a, b);
    return { original: h, pin: a, caramelo: b, x: (this.x[h.p[k]] + this.x[h.p[k + 1]]) / 2, y: (this.y[h.p[k]] + this.y[h.p[k + 1]]) / 2 };
  }

  // El dedo pasó de (x1, y1) a (x2, y2): corta todo hilo que cruce ese tramo.
  cortar(x1, y1, x2, y2) {
    const cortes = [];
    for (const h of [...this.hilos]) {
      if (!h.vivo || h.suelto) continue;
      for (let k = 0; k < h.p.length - 1; k++) {
        const a = h.p[k], b = h.p[k + 1];
        if (cruzan(x1, y1, x2, y2, this.x[a], this.y[a], this.x[b], this.y[b])) {
          const c = this.cortarEn(h, k);
          if (c) cortes.push(c);
          break;
        }
      }
    }
    return cortes;
  }

  // La velocidad de una partícula, por segundo.
  vel(i, dt = PASO) { return [(this.x[i] - this.px[i]) / dt, (this.y[i] - this.py[i]) / dt]; }
  ponerVel(i, vx, vy, dt = PASO) { this.px[i] = this.x[i] - vx * dt; this.py[i] = this.y[i] - vy * dt; }
  // mover una partícula a otro lado sin cambiarle la velocidad
  llevar(i, x, y) { const dx = x - this.x[i], dy = y - this.y[i]; this.x[i] += dx; this.y[i] += dy; this.px[i] += dx; this.py[i] += dy; }
}

// ¿Se cruzan los tramos AB y CD? Cada tramo cuenta con su punta del final y
// sin la del principio: un tajo que termina justo arriba del hilo (con el
// mouse y un hilo parado pasa seguido) corta, y el tajo siguiente, que
// arranca ahí, no lo vuelve a contar. Con los dos extremos afuera, ese tajo
// no cortaba nada.
export function cruzan(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return ((d1 > 0 && d2 <= 0) || (d1 < 0 && d2 >= 0)) && ((d3 > 0 && d4 <= 0) || (d3 < 0 && d4 >= 0));
}

// La distancia de un punto a un tramo (y el punto más cercano).
export function aTramo(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1e-9;
  let t = ((px - ax) * vx + (py - ay) * vy) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + vx * t, cy = ay + vy * t;
  return [Math.hypot(px - cx, py - cy), cx, cy, t];
}

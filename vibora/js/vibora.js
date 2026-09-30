// Una víbora: la cabeza se mueve y el cuerpo es el camino que dejó, guardado
// como puntos a PASO unidades uno del otro en un anillo (el punto nuevo entra
// por un lado y el de la cola se cae por el otro, sin mover la lista). Crecer
// es dejar de cortar la cola: el cuerpo se estira solo mientras avanza.
import { clamp, difAng } from './util.js';
import { colorDe } from './pieles.js';

export const PASO = 4;
const CAP = 1600;                 // puntos: alcanza para el largo máximo (~5600 unidades)
export const MASA_INICIAL = 10;
export const MASA_TURBO = 12;     // con menos no hay turbo

export class Vibora {
  constructor({ id, nombre, piel, x, y, ang = 0, masa = MASA_INICIAL, bot = false }) {
    Object.assign(this, { id, nombre, piel, x, y, ang, masa, bot });
    this.angObj = ang;
    this.turbo = false;
    this.viva = true;
    this.bajas = 0;
    this.t = 0;
    this.goteo = 0;               // masa gastada en turbo que todavía no cayó como comida
    this.px = new Float32Array(CAP);
    this.py = new Float32Array(CAP);
    this.cab = 0; this.n = 0;
    // el cuerpo nace estirado detrás de la cabeza
    const n = Math.ceil(this.largo() / PASO);
    for (let k = n; k >= 1; k--) this.empujar(x - Math.cos(ang) * PASO * k, y - Math.sin(ang) * PASO * k);
  }

  // Cuanto más come, más gruesa, más larga y más lenta para doblar (así una
  // chiquita siempre puede escaparse de una grande).
  radio() { return 11 + Math.min(33, Math.sqrt(this.masa) * 0.8); }
  largo() { return 60 + 3.3 * Math.pow(this.masa, 0.85); }
  velocidad() { return this.turbo ? 470 : 200; }
  giro() { return 4.6 / (1 + (this.radio() - 13) / 26); }

  // El punto k del cuerpo (0 = el más nuevo, al lado de la cabeza).
  i(k) { return (this.cab + k) % CAP; }
  empujar(x, y) {
    this.cab = (this.cab - 1 + CAP) % CAP;
    this.px[this.cab] = x; this.py[this.cab] = y;
    if (this.n < CAP) this.n++;
  }

  // `soltar(x, y, valor, color)` deja comida (la del turbo cae por la cola).
  pasar(dt, soltar) {
    this.t += dt;
    const d = difAng(this.ang, this.angObj), max = this.giro() * dt;
    this.ang += clamp(d, -max, max);
    // el ángulo queda entre -π y π (dando vueltas no crece sin fin)
    if (this.ang > Math.PI) this.ang -= Math.PI * 2; else if (this.ang < -Math.PI) this.ang += Math.PI * 2;
    if (this.turbo && this.masa <= MASA_TURBO) this.turbo = false;
    if (this.turbo) { const gasto = 4 * dt; this.masa -= gasto; this.goteo += gasto; }
    const v = this.velocidad();
    this.x += Math.cos(this.ang) * v * dt;
    this.y += Math.sin(this.ang) * v * dt;
    // puntos nuevos cada PASO, sobre la recta desde el último
    let lx = this.px[this.cab], ly = this.py[this.cab];
    let dx = this.x - lx, dy = this.y - ly, dist = Math.hypot(dx, dy);
    while (dist >= PASO) {
      lx += (dx / dist) * PASO; ly += (dy / dist) * PASO;
      this.empujar(lx, ly);
      dx = this.x - lx; dy = this.y - ly; dist = Math.hypot(dx, dy);
    }
    // la cola se acorta de a poco (si no, al gastar turbo pega un salto)
    const quiero = Math.min(CAP, Math.ceil(this.largo() / PASO));
    if (this.n > quiero) this.n = Math.max(quiero, this.n - 4);
    if (this.goteo >= 1.5 && soltar) {
      const k = this.n - 1, j = this.i(k);
      soltar(this.px[j], this.py[j], this.goteo * 0.8, colorDe(this.piel, Math.floor(k / this.salto())));
      this.goteo = 0;
    }
  }

  // Cada cuántos puntos se dibuja una bolita (se solapan: cuerpo liso).
  salto() { return Math.max(1, Math.round((this.radio() * 0.42) / PASO)); }
  // Cada cuántos puntos se prueba un choque (un poco más espaciado).
  saltoChoque() { return Math.max(1, Math.round((this.radio() * 0.7) / PASO)); }
}

// El puntaje, con las reglas del juego original:
//
//   · cada corte vale hasta 115: 70 por el impulso ANTES de entrar al bloque,
//     30 por seguir DESPUÉS de salir, y 15 por pasar por el centro;
//   · el multiplicador sube a x2 con 2 cortes, a x4 con 4 más y a x8 con 8
//     más; un error lo baja un escalón y reinicia el progreso;
//   · la energía arranca a la mitad: cada acierto suma 1 %, un bloque perdido
//     resta 15 %, un mal corte 10 % y una bomba 15 %. En cero, se pierde.

export const RANGOS = [
  { letra: "SS", desde: 0.9 }, { letra: "S", desde: 0.8 }, { letra: "A", desde: 0.65 },
  { letra: "B", desde: 0.5 }, { letra: "C", desde: 0.35 }, { letra: "D", desde: 0.2 }, { letra: "E", desde: 0 },
];

const NIVELES = [1, 2, 4, 8];
const PARA_SUBIR = [2, 4, 8];

export function puntajeMaximo(cantidad) {
  let total = 0, nivel = 0, prog = 0;
  for (let i = 0; i < cantidad; i++) {
    total += 115 * NIVELES[nivel];
    if (nivel < 3) { prog++; if (prog >= PARA_SUBIR[nivel]) { nivel++; prog = 0; } }
  }
  return total;
}

export class Puntaje {
  constructor(cantidadNotas, { sinPerder = false } = {}) {
    this.cantidad = cantidadNotas;
    this.maximo = puntajeMaximo(cantidadNotas);
    this.sinPerder = sinPerder;
    this.reiniciar();
  }

  reiniciar() {
    this.puntos = 0; this.combo = 0; this.comboMax = 0;
    this.nivel = 0; this.progreso = 0;
    this.energia = 0.5;
    this.cortes = 0; this.perdidos = 0; this.malos = 0; this.bombas = 0;
    this.sumaCortes = 0;          // para el promedio por corte
    this.maximoHasta = 0;         // el máximo posible de lo que ya pasó
    this._nivelIdeal = 0; this._progIdeal = 0;
    this.perdio = false;
    this.cortesPerfectos = 0;
  }

  get multiplicador() { return NIVELES[this.nivel]; }
  /** 0..1: cuánto falta para el siguiente escalón (el aro del multiplicador). */
  get aro() { return this.nivel >= 3 ? 1 : this.progreso / PARA_SUBIR[this.nivel]; }

  _pasoIdeal() {
    this.maximoHasta += 115 * NIVELES[this._nivelIdeal];
    if (this._nivelIdeal < 3) { this._progIdeal++; if (this._progIdeal >= PARA_SUBIR[this._nivelIdeal]) { this._nivelIdeal++; this._progIdeal = 0; } }
  }

  _bajar() {
    if (this.nivel > 0) this.nivel--;
    this.progreso = 0;
    this.combo = 0;
  }

  _energia(d) {
    this.energia = Math.max(0, Math.min(1, this.energia + d));
    if (this.energia <= 0 && !this.sinPerder) this.perdio = true;
  }

  /** Un corte bien hecho. `valor` 0..115 (ya sumadas las tres partes). */
  acierto(valor) {
    const m = this.multiplicador;
    this.puntos += Math.round(valor) * m;
    this.sumaCortes += valor;
    this.cortes++;
    if (valor >= 115) this.cortesPerfectos++;
    this.combo++;
    this.comboMax = Math.max(this.comboMax, this.combo);
    if (this.nivel < 3) { this.progreso++; if (this.progreso >= PARA_SUBIR[this.nivel]) { this.nivel++; this.progreso = 0; } }
    this._energia(0.01);
    this._pasoIdeal();
    return m;
  }

  perdido() { this.perdidos++; this._bajar(); this._energia(-0.15); this._pasoIdeal(); }
  malCorte() { this.malos++; this._bajar(); this._energia(-0.1); this._pasoIdeal(); }
  bomba() { this.bombas++; this._bajar(); this._energia(-0.15); }

  /** Porcentaje sobre el máximo posible de lo jugado hasta ahora. */
  get precision() { return this.maximoHasta ? this.puntos / this.maximoHasta : 1; }

  rango(p = this.precision) {
    for (const r of RANGOS) if (p >= r.desde - 1e-9) return r.letra;
    return "E";
  }
}

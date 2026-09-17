// La partida: un nivel, los toques y cuándo está ganado.
//
// No hay bucle de física ni cuadros: un puzzle es una MAQUINA DE ESTADOS y
// tratarlo como un juego de acción es lo que hace que los puzzles se sientan
// resbalosos. Acá pasa algo sólo cuando alguien toca algo.

import { ESPEJO, trazar, ganado } from "./haz.js";

export class Partida {
  constructor(nivel, numero) {
    this.nivel = nivel;
    this.numero = numero;
    // Copia: el nivel viene de un JSON que se comparte entre partidas, y
    // escribirle el estado adentro haría que volver a jugarlo arranque desde
    // donde lo dejaste la vez pasada — un puzzle que ya viene medio resuelto.
    this.estado = nivel.inicial.slice();
    this.toques = 0;
    this.ganado = false;
    this.recalcular();
  }

  get par() { return this.nivel.par; }
  /** Tres luces si lo hiciste en el par, dos si le erraste por poco, una si no. */
  get luces() {
    if (!this.ganado) return 0;
    if (this.toques <= this.par) return 3;
    if (this.toques <= this.par + 2) return 2;
    return 1;
  }

  celda(c, f) {
    const n = this.nivel;
    if (c < 0 || f < 0 || c >= n.ancho || f >= n.alto) return null;
    return n.celdas[f * n.ancho + c];
  }

  /**
   * Dar vuelta el espejo de una celda. Devuelve si hizo algo.
   *
   * GANADO SE CONGELA. Sin esto, después de ganar se puede seguir tocando y el
   * contador sigue subiendo: la pantalla de victoria aparece con un número
   * distinto del que se ganó, y encima la victoria se puede "desganar".
   */
  tocar(c, f) {
    if (this.ganado) return false;
    const cel = this.celda(c, f);
    if (!cel || cel.t !== ESPEJO) return false;
    this.estado[cel.i] ^= 1;
    this.toques++;
    this.recalcular();
    return true;
  }

  reiniciar() {
    this.estado = this.nivel.inicial.slice();
    this.toques = 0;
    this.ganado = false;
    this.recalcular();
  }

  recalcular() {
    const r = trazar(this.nivel, this.estado);
    this.tramos = r.tramos;
    this.prendidos = r.prendidos;
    if (!this.ganado && r.prendidos.size === this.nivel.objetivos.length) this.ganado = true;
  }

  /** Para las pruebas y la pista: ¿se gana desde acá, y en cuántos toques? */
  static resolver(nivel, estado) {
    const n = nivel.espejos.length;
    const inicio = estado.reduce((a, v, i) => a + (v << i), 0);
    const dist = new Int16Array(1 << n).fill(-1);
    dist[inicio] = 0;
    const cola = [inicio];
    for (let i = 0; i < cola.length; i++) {
      const k = cola[i];
      const est = Array.from({ length: n }, (_, b) => (k >> b) & 1);
      if (ganado(nivel, est)) return dist[k];
      for (let b = 0; b < n; b++) {
        const v = k ^ (1 << b);
        if (dist[v] === -1) { dist[v] = dist[k] + 1; cola.push(v); }
      }
    }
    return -1;
  }

  /**
   * La pista: cuál espejo tocar para acercarse.
   *
   * ES LA SOLUCION DE VERDAD, no una sugerencia. Busca la distancia a ganar
   * desde el estado de ahora y devuelve el espejo que la baja en uno. Una pista
   * que a veces te aleja es peor que no tener pista: te enseña a desconfiar de
   * la única ayuda que hay.
   */
  pista() {
    const falta = Partida.resolver(this.nivel, this.estado);
    if (falta <= 0) return null;
    for (let b = 0; b < this.estado.length; b++) {
      const prueba = this.estado.slice();
      prueba[b] ^= 1;
      if (Partida.resolver(this.nivel, prueba) === falta - 1) return this.nivel.espejos[b];
    }
    return null;
  }
}

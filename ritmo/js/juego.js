// El juez: decide si una nota salió bien, y con cuánta puntería.
//
// SIN DIBUJO NI AUDIO. Recibe la hora y los toques, devuelve estado. Así la
// prueba puede jugar una canción entera en dos milisegundos, con la puntería
// que se le pida, y comprobar que el puntaje sale lo que tiene que salir.

import { carta, CARRILES } from "./carta.js";

/* Las ventanas, en segundos. Salen de lo que un dedo puede: por debajo de 45 ms
   nadie distingue si acertó por habilidad o por suerte, y más allá de 140 ms ya
   no se siente que la nota sea esa. La de "rozó" existe para que una nota tarde
   sume algo: perder la racha por 10 ms de más es lo que hace que la gente
   abandone en la mitad. */
export const VENTANAS = { perfecto: 0.045, bien: 0.090, rozo: 0.140 };
const PUNTOS = { perfecto: 100, bien: 60, rozo: 25 };
const PESO = { perfecto: 1, bien: 0.65, rozo: 0.3, error: 0 };
/** Cuánta precisión hace falta para cada estrella. */
export const ESTRELLAS = [0.70, 0.85, 0.95];

/* LA VIDA. Se arranca a la mitad, se gana acertando y se pierde fallando.
   Existe para que la canción tenga tensión: sin ella, fallar veinte seguidas y
   fallar una se sienten igual y la barra de arriba es un adorno.
   Los números están corridos a favor del que juega: un acierto da poco, un
   error saca bastante, pero hacen falta DIECIOCHO errores seguidos desde la
   mitad para perder. Es difícil perder sin haberse dado cuenta de que iba mal. */
const VIDA = { perfecto: 0.020, bien: 0.014, rozo: 0.008, error: -0.055 };

export class Partida {
  constructor(idCancion) {
    const c = carta(idCancion);
    this.id = idCancion;
    this.tema = c.tema;
    this.notas = c.notas.map((n, i) => ({ ...n, i, juzgada: null, sostenidaHasta: 0, soltada: false }));
    this.porCarril = Array.from({ length: CARRILES }, () => []);
    for (const n of this.notas) this.porCarril[n.carril].push(n);
    this.cursor = new Array(CARRILES).fill(0);   // primera nota sin juzgar de cada carril
    this.reset();
  }

  reset() {
    this.puntos = 0;
    this.combo = 0;
    this.mejorCombo = 0;
    this.cuenta = { perfecto: 0, bien: 0, rozo: 0, error: 0 };
    this.ultimoJuicio = null;     // {clase, dt, carril, t}
    this.terminada = false;
    this.vida = 0.5;
    this.perdio = false;
    this.sostenidas = new Array(CARRILES).fill(null);
    for (const n of this.notas) { n.juzgada = null; n.sostenidaHasta = 0; n.soltada = false; }
    this.cursor.fill(0);
  }

  /** El multiplicador de racha: sube hasta el doble y ahí se queda. */
  multiplicador() { return 1 + Math.min(this.combo, 50) / 50; }

  anotar(clase) {
    this.cuenta[clase]++;
    this.vida = Math.max(0, Math.min(1, this.vida + VIDA[clase]));
    if (this.vida <= 0) this.perdio = true;
    if (clase === "error") { this.combo = 0; return; }
    this.puntos += Math.round(PUNTOS[clase] * this.multiplicador());
    this.combo++;
    if (this.combo > this.mejorCombo) this.mejorCombo = this.combo;
  }

  /** Toque en un carril. Devuelve el juicio, o null si no había nada cerca. */
  tocar(carril, t) {
    const lista = this.porCarril[carril];
    let i = this.cursor[carril];
    while (i < lista.length && lista[i].juzgada) i++;
    const n = lista[i];
    if (!n) return null;
    const dt = t - n.t;
    // ADELANTARSE MUCHO NO ES UN ERROR: el que toca antes de que la nota
    // exista simplemente no tocó nada. Castigarlo convierte los nervios en
    // una bola de nieve.
    if (dt < -VENTANAS.rozo) return null;
    if (dt > VENTANAS.rozo) return null;
    const a = Math.abs(dt);
    const clase = a <= VENTANAS.perfecto ? "perfecto" : a <= VENTANAS.bien ? "bien" : "rozo";
    n.juzgada = clase;
    this.anotar(clase);
    if (n.largo > 0) { this.sostenidas[carril] = n; n.sostenidaHasta = t; }
    this.ultimoJuicio = { clase, dt, carril, t };
    return this.ultimoJuicio;
  }

  /** Soltar el dedo de un carril. Cierra la sostenida que hubiera. */
  soltar(carril, t) {
    const n = this.sostenidas[carril];
    if (!n) return;
    n.sostenidaHasta = Math.min(t, n.t + n.largo);
    n.soltada = true;
    this.sostenidas[carril] = null;
  }

  /**
   * Corre el reloj hasta `t`. Marca como error lo que ya pasó sin tocarse y
   * paga las sostenidas que se siguen manteniendo.
   */
  avanzar(t) {
    for (let c = 0; c < CARRILES; c++) {
      const lista = this.porCarril[c];
      while (this.cursor[c] < lista.length) {
        const n = lista[this.cursor[c]];
        if (n.juzgada) { this.cursor[c]++; continue; }
        if (t - n.t > VENTANAS.rozo) { n.juzgada = "error"; this.anotar("error"); this.cursor[c]++; continue; }
        break;
      }
      const s = this.sostenidas[c];
      if (s) {
        const hasta = Math.min(t, s.t + s.largo);
        // Se paga por tiempo mantenido y no al soltar: si se paga al final, un
        // corte justo antes del borde se lleva todo lo que ya se sostuvo.
        const nuevo = Math.max(0, hasta - s.sostenidaHasta);
        if (nuevo > 0) { this.puntos += Math.round(nuevo * 40 * this.multiplicador()); s.sostenidaHasta = hasta; }
        if (hasta >= s.t + s.largo) this.sostenidas[c] = null;
      }
    }
    // Se termina por el final de la canción o por quedarse sin vida. Lo segundo
    // corta al toque: seguir tocando una canción ya perdida no es una segunda
    // oportunidad, es no dejar reintentar.
    if (this.perdio) this.terminada = true;
    if (!this.terminada && t > this.tema.duracion + 1.5 &&
        this.notas.every((n) => n.juzgada)) this.terminada = true;
  }

  juzgadas() { return this.cuenta.perfecto + this.cuenta.bien + this.cuenta.rozo + this.cuenta.error; }

  /** Precisión de 0 a 1, ponderada por qué tan bien salió cada nota. */
  precision() {
    const n = this.juzgadas();
    if (!n) return 0;
    const suma = this.cuenta.perfecto * PESO.perfecto + this.cuenta.bien * PESO.bien +
                 this.cuenta.rozo * PESO.rozo;
    return suma / n;
  }

  estrellas() {
    const p = this.precision();
    return ESTRELLAS.reduce((n, u) => n + (p >= u ? 1 : 0), 0);
  }

  /** Sin fallar ni una: es lo que se persigue cuando ya se sabe la canción. */
  limpia() { return this.cuenta.error === 0 && this.juzgadas() === this.notas.length; }
}

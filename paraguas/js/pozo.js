// El pozo: se genera para abajo, para siempre, y siempre se puede pasar.
//
// LA REGLA QUE NO SE PUEDE ROMPER. Un generador infinito tiene una forma de
// fallar que no se ve nunca en una captura: tarde o temprano pone dos huecos
// tan separados que, a la velocidad a la que venis cayendo, no llegas de uno al
// otro. El jugador no ve un error — ve que perdio, otra vez, y culpa a sus
// dedos. Por eso el hueco de cada fila se elige DENTRO de lo que se puede
// alcanzar desde el anterior, y pruebas/pozo.mjs lo verifica fila por fila
// sobre cien mil metros.
//
// Y LA SEGUNDA REGLA: una fila que pide el paraguas cerrado nunca viene pegada
// a la anterior. Cerrar tarda nueve cuadros y caer cerrado es caer al triple:
// dos filas angostas seguidas no son dificiles, son imposibles, y la
// diferencia entre esas dos cosas es todo.

import { F, mezcla } from "./mundo.js";

export const TIPOS = { VIGA: 0, PINCHOS: 1 };

// Un generador propio y sembrado. Math.random sirve para una partida suelta,
// pero no para una prueba: si el pozo cambia en cada corrida, un fallo de la
// prueba no se puede repetir y no se puede arreglar.
export function azar(semilla) {
  let s = (semilla >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const ANCHO = 360;
const BORDE = 10;                    // las paredes del pozo

/** Que tan dificil esta el pozo a esa profundidad. 0 al empezar, 1 al fondo. */
export const dureza = (y) => Math.min(1, y / 90000);

export class Pozo {
  constructor(semilla = Date.now()) {
    this.r = azar(semilla);
    this.semilla = semilla;
    this.filas = [];
    this.monedas = [];
    this.proxima = 700;              // los primeros siete metros van limpios
    this.ultimoX = ANCHO / 2;
    this.ultimoAngosto = -1e9;
    this.veniaAngosto = false;
    this.ultimoY = 340;
    this.n = 0;
    this.generarHasta(2000);
  }

  /**
   * Cuanto se puede correr de costado mientras se cae `dy`.
   *
   * EL ALCANCE DEPENDE DE A QUE VELOCIDAD SE VA A CRUZAR ESA FILA, y esa fue
   * la falla que mas caro salio. La primera version usaba siempre la velocidad
   * con el paraguas abierto —la lenta, la que da MAS tiempo por metro— y
   * parecia lo conservador. No lo es: una fila angosta obliga a cerrar, y
   * cerrado se cae al triple, asi que ahi el jugador tiene un TERCIO del
   * tiempo que el generador le habia calculado. Medido con el piloto: 57 de
   * 59 muertes eran en filas angostas, todas por huecos que no se alcanzaban.
   *
   * Y el 62% no es supersticion: la cuenta supone que ya venis a toda
   * velocidad de costado y que apuntaste perfecto, dos cosas que no pasan
   * nunca.
   */
  alcance(dy) {
    // SIEMPRE SE MIDE CON EL PARAGUAS CERRADO, sea la fila que sea, y eso es
    // una consecuencia del control y no del pozo.
    //
    // El dedo hace las dos cosas: apunta Y cierra. Entonces hay exactamente
    // dos formas de correrse de costado, y dan casi lo mismo por metro:
    //   · apretado, moviendose a 5,4 px por cuadro y cayendo a 13,5  → 0,40·dy
    //   · flotando, con toquecitos que apuntan sin llegar a cerrar; se maniobra
    //     mejor (4,0) y se cae mas lento (4,3), pero el dedo solo esta apoyado
    //     como un cuarto del tiempo                                  → 0,25·dy
    // La primera version media con el paraguas abierto SIN descontar los
    // toquecitos, y le atribuia al jugador 0,93·dy — casi cuatro veces lo que
    // puede. El piloto libre bajaba 778 m y el que usa el control de verdad,
    // 129. Midiendo con la cerrada, las dos formas de jugar entran.
    return F.VX_CERRADO * (dy / F.TERMINAL_CERRADO) * 0.62;
  }

  generarHasta(y) {
    while (this.proxima < y) this.fila();
  }

  fila() {
    const y = this.proxima;
    const d = dureza(y);
    const r = this.r;

    // El hueco se angosta con la profundidad; la separacion entre filas se
    // acorta. Las dos cosas a la vez es lo que hace que a los mil metros el
    // mismo juego pida el doble.
    // Una fila angosta —la que obliga a cerrar— solo si la anterior quedo
    // lejos. Si no, se ensancha y queda una fila comun.
    const puedeAngosto = y - this.ultimoAngosto > 900;
    const quiereAngosto = d > 0.12 && r() < 0.18 + d * 0.3;
    const angosto = puedeAngosto && quiereAngosto;

    let hueco;
    if (angosto) hueco = Math.round(mezcla(40, 27, d));
    else hueco = Math.max(Math.round(mezcla(140, 38, d * d)), F.ANCHO_ABIERTO + 12);

    // LA PISTA QUE IMPORTA ES LA QUE YA SE RECORRIO, no la que viene despues.
    //
    // La primera version calculaba el alcance con `sep`, que es la distancia a
    // la fila SIGUIENTE, y lo usaba para limitar cuanto se podia correr desde
    // la ANTERIOR: un desfasaje de uno. Mientras todas las separaciones eran
    // parecidas casi no se notaba; en cuanto una fila angosta pidio 1,7 veces
    // mas pista, la fila de despues heredaba ese presupuesto grande y se
    // colocaba donde no se llegaba. La prueba lo cazo en 621 m: habia que
    // correr 103 pixeles y se podian correr 98.
    const desdeArriba = y - this.ultimoY;

    // Se cruza rapido si esta fila obliga a cerrar, y tambien la de despues:
    // reabrir el paraguas y frenar lleva unos veinte cuadros, asi que a la
    // siguiente todavia se llega volando.
    // LAS PAREDES PUEDEN PEDIR MAS DE LO QUE EL ALCANCE DA. Un hueco ancho
    // cerca del borde no cabe pegado a la pared: su centro tiene que estar a
    // medio hueco del costado, y si el jugador venia del otro lado, esa
    // distancia puede ser mayor que lo que alcanza a correr. La primera
    // version resolvia el empate poniendo el hueco en el medio de una ventana
    // vacia — o sea, donde no se llega. Lo correcto es al reves: no mover el
    // hueco, sino DAR MAS PISTA hasta que se alcance.
    const wMin = BORDE + hueco / 2, wMax = ANCHO - BORDE - hueco / 2;
    const necesita = Math.max(0, wMin - this.ultimoX, this.ultimoX - wMax);
    let lim = this.alcance(desdeArriba);
    if (necesita > lim) {
      // No alcanza ni yendo derecho: se corre esta fila mas abajo, que es dar
      // mas pista sin mover el hueco a un lugar donde no se llega.
      const hace = Math.ceil((necesita / (F.VX_CERRADO * 0.62)) * F.TERMINAL_CERRADO) + 24;
      this.proxima = this.ultimoY + hace;
      return this.fila();
    }

    const minX = Math.max(wMin, this.ultimoX - lim);
    const maxX = Math.min(wMax, this.ultimoX + lim);
    const x = minX >= maxX ? Math.max(wMin, Math.min(wMax, this.ultimoX))
                           : minX + r() * (maxX - minX);

    const pinchos = !angosto && d > 0.06 && r() < 0.15 + d * 0.35;
    this.filas.push({
      y, x, hueco, angosto,
      tipo: pinchos ? TIPOS.PINCHOS : TIPOS.VIGA,
      n: this.n++,
    });

    // Las monedas van EN el camino, no escondidas: son la linea que dice por
    // donde conviene pasar, y de paso premian al que va justo por el medio.
    if (r() < 0.55) {
      const cuantas = 2 + Math.floor(r() * 3);
      for (let i = 0; i < cuantas; i++)
        this.monedas.push({ x, y: y - desdeArriba * 0.5 + i * 16, tomada: false });
    }

    // Y la separacion a la fila que viene: si esta es angosta necesita pista
    // para verla, cerrar el paraguas y alinearse, las tres cosas mientras se
    // cae cada vez mas rapido.
    let sep = Math.round(mezcla(330, 205, d));
    if (angosto) sep = Math.round(sep * 1.7);

    this.ultimoX = x;
    this.ultimoY = y;
    this.veniaAngosto = angosto;
    if (angosto) this.ultimoAngosto = y;
    this.proxima = y + sep;
  }

  /** Tirar lo que ya quedo muy arriba: un pozo infinito no puede acumular. */
  limpiar(y) {
    const corte = y - 900;
    while (this.filas.length && this.filas[0].y < corte) this.filas.shift();
    while (this.monedas.length && this.monedas[0].y < corte) this.monedas.shift();
  }

  /** La proxima fila por debajo de `y`. */
  siguiente(y) {
    for (const f of this.filas) if (f.y > y) return f;
    return null;
  }
}

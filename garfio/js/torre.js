// La torre: argollas para siempre, hacia arriba.
//
// UN GENERADOR INFINITO FALLA DE UNA FORMA QUE NO SE VE MIRANDO. Pone dos
// argollas tan separadas que, con el envión que se puede juntar en la anterior,
// no se llega a la siguiente — y eso en pantalla no se ve como un error, se ve
// como que no sos bueno. Por eso acá la distancia entre una argolla y la que
// sigue no sale de "lo que queda lindo": sale de SALTO_MAX, que está MEDIDO
// jugando (pruebas/salto.mjs lo vuelve a medir con la física de verdad y falla
// si alguien toca la gravedad y se olvida de esto).

import { F, ANCHO, azar, limitar } from "./mundo.js";

// Lo que se puede saltar de una argolla a la otra, en línea recta, incluyendo
// el alcance del gancho. Medido, no estimado: ver pruebas/salto.mjs.
export const SALTO_MAX = 232;

export class Torre {
  constructor(semilla) {
    this.rnd = azar(semilla ?? ((Math.random() * 1e9) | 0));
    this.argollas = [];
    this.tuercas = [];
    // La primera va fija en el medio y abajo: los primeros segundos tienen que
    // ser iguales siempre, porque son los que se usan para entender el juego.
    this.argollas.push({ x: ANCHO / 2, y: -140, oxidada: false, i: 0 });
    this.ultima = this.argollas[0];
    this.techo = -140;
  }

  /** Genera hasta que haya argollas por encima de `y` (arriba es menos y). */
  generarHasta(y) {
    while (this.techo > y) this.siguienteArgolla();
  }

  siguienteArgolla() {
    const a = this.ultima;
    const alto = Math.abs(a.y);
    const i = this.argollas.length;

    // La separación vertical sube con la altura, pero nunca pasa de lo que se
    // puede saltar: la dificultad crece pidiendo MAS PRECISION, no pidiendo
    // cosas imposibles.
    const dureza = Math.min(1, alto / 6000);
    const sep = F.SEP_MIN + this.rnd() * (F.SEP_MAX - F.SEP_MIN) * (0.55 + 0.45 * dureza);

    // EL CORRIMIENTO DE COSTADO TIENE TECHO Y PISO, y los dos importan.
    //
    // El techo sale de PITAGORAS y no de un número suelto: lo que queda del
    // salto después de gastar `sep` subiendo. Sumar un dx fijo es justo el
    // error que deja inalcanzables las argollas altas, donde `sep` ya se comió
    // casi todo el presupuesto.
    //
    // El piso es lo que aprendí mirando al robot quedarse colgado para siempre:
    // dos argollas en la misma vertical NO SE ENCADENAN. El péndulo sale por la
    // tangente, o sea de costado, y para subir derecho hay que soltar en el
    // punto más lento del arco. Un `dx` chico no es "una versión fácil" del
    // salto: es otro problema, y uno que el juego no enseña a resolver.
    const techo = Math.min(F.DX_MAX,
                           Math.sqrt(Math.max(0, SALTO_MAX * SALTO_MAX - sep * sep)) * 0.82);
    const paso = F.DX_MIN + this.rnd() * Math.max(0, techo - F.DX_MIN);
    // Y el lado se elige MIRANDO LA PARED: pegado al borde siempre se va para
    // adentro. Sorteándolo, la mitad de las veces el corrimiento se recortaba
    // contra la pared y volvía a quedar una escalera vertical.
    let lado = a.x < ANCHO * 0.34 ? 1 : a.x > ANCHO * 0.66 ? -1 : (this.rnd() < 0.5 ? -1 : 1);
    let x = limitar(a.x + paso * lado, F.BORDE, ANCHO - F.BORDE);
    if (Math.abs(x - a.x) < F.DX_MIN) x = limitar(a.x - paso * lado, F.BORDE, ANCHO - F.BORDE);

    const oxidada = alto > F.OXIDADAS_DESDE && this.rnd() < Math.min(0.34, dureza * 0.5);
    const arg = { x, y: a.y - sep, oxidada, i };
    this.argollas.push(arg);
    this.ultima = arg;
    this.techo = arg.y;

    // LAS TUERCAS VAN FUERA DE LA LINEA BUENA, a propósito. Puestas en el
    // camino no serían una decisión: serían una recompensa por jugar. Puestas
    // al costado, agarrarlas cuesta soltar más tarde de lo conveniente.
    if (this.rnd() < 0.45) {
      const t = this.rnd();
      this.tuercas.push({
        x: limitar(a.x + (arg.x - a.x) * t + (this.rnd() < 0.5 ? -54 : 54), 16, ANCHO - 16),
        y: a.y - sep * t, tomada: false,
      });
    }

  }

  /** La argolla más cerca de (x, y) que esté dentro del alcance del gancho. */
  masCerca(x, y, alcance = F.ALCANCE) {
    let mejor = null, mejorD = alcance * alcance;
    for (const a of this.argollas) {
      const d = (a.x - x) ** 2 + (a.y - y) ** 2;
      if (d <= mejorD && !a.rota) { mejorD = d; mejor = a; }
    }
    return mejor;
  }

  /** La primera argolla por encima de `y`, que es adonde hay que ir. */
  siguienteDe(y) {
    for (const a of this.argollas) if (a.y < y - 8 && !a.rota) return a;
    return null;
  }

  /** Tirar lo que quedó muy abajo: una partida larga junta miles de objetos. */
  limpiar(y) {
    const corte = y + 1400;
    if (this.argollas.length > 60) this.argollas = this.argollas.filter((a) => a.y < corte);
    if (this.tuercas.length > 60) this.tuercas = this.tuercas.filter((t) => t.y < corte);
  }
}

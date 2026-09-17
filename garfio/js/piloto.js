// Un piloto automático. Lo usan dos cosas, y por eso vive acá y no en pruebas:
// el fondo de los menús —donde se ve una trepada de verdad, borroneada— y el
// validador de la torre. Una sola definición evita que el robot pruebe una
// política y el jugador vea otra.
//
// Sabe una sola cosa, y es la misma que aprende una persona a los dos minutos:
// SOLTAR CUANDO LA TRAYECTORIA YA PASA CERCA DE LA PROXIMA ARGOLLA. No calcula
// el punto óptimo ni resuelve nada; simula hacia adelante su propio vuelo con
// la física del juego y suelta en el primer cuadro en que ese vuelo pasaría a
// tiro del gancho. Justo por ser tan tonto sirve de prueba: si él sube mil
// metros, una persona sube más.

import { F, ANCHO } from "./mundo.js";
import { PARED } from "./juego.js";

const PASOS = 150;

/**
 * ¿Pasando por (x,y) con velocidad (vx,vy) y sin soga, llego a tiro de `a`?
 *
 * Es la misma integración que `Partida.mover()` sin enganche. Que sea la misma
 * importa más que que sea rápida: si el robot predice con una física distinta
 * de la que juega, valida una torre que no existe.
 */
function llega(x, y, vx, vy, a, margen = 0.9) {
  const tope = (F.ALCANCE * margen) ** 2;
  for (let i = 0; i < PASOS; i++) {
    vy += F.GRAVEDAD;
    x += vx; y += vy;
    vx *= F.ROCE_AIRE; vy *= F.ROCE_AIRE;
    // LAS PAREDES VAN EN LA PREDICCION, y olvidarlas costaba la partida. Un
    // vuelo que rebota contra la pared pierde más de la mitad de la velocidad
    // de costado; prediciéndolo en línea recta, el robot soltaba convencido de
    // que llegaba, rebotaba, y caía al vacío con la argolla cuatrocientos
    // píxeles arriba. Predecir con una física distinta de la que se juega no es
    // "una aproximación": es validar otro juego.
    if (x - F.BICHO < PARED) { x = PARED + F.BICHO; vx = Math.abs(vx) * 0.45; }
    else if (x + F.BICHO > ANCHO - PARED) { x = ANCHO - PARED - F.BICHO; vx = -Math.abs(vx) * 0.45; }
    const v = Math.hypot(vx, vy);
    if (v > F.VEL_MAX) { vx = vx / v * F.VEL_MAX; vy = vy / v * F.VEL_MAX; }
    if ((a.x - x) ** 2 + (a.y - y) ** 2 <= tope) return true;
    // Ya cayó por debajo de la argolla y sigue bajando: no va a volver.
    if (y > a.y + 260 && vy > 0) return false;
  }
  return false;
}

export function piloto(p) {
  // SE LLEVA CUENTA DE LA ULTIMA ARGOLLA USADA, y sin eso el robot entraba en
  // un tartamudeo que costó una tarde encontrar: soltaba la argolla porque ya
  // alcanzaba la siguiente, y al cuadro siguiente —volando, todavía por debajo
  // de la que había soltado— "la próxima argolla que tengo encima" volvía a ser
  // esa misma, se reenganchaba, y vuelta a empezar. Ochenta cuadros por
  // segundo enganchando y soltando la misma argolla, subiendo cero.
  if (p.ancla) p._ultima = p.ancla.i;
  const desdeI = p._ultima === undefined ? -1 : p._ultima;
  const meta = p.torre.argollas.find((a) => a.i > desdeI && !a.rota);
  if (!meta) return { dedo: null };

  if (!p.ancla) {
    // Volando: engancharse apenas la próxima esté a tiro. Esperar "el mejor
    // momento" para enganchar no existe — el que espera, cae.
    const d = Math.hypot(meta.x - p.x, meta.y - p.y);
    if (d <= F.ALCANCE * 0.97) return { dedo: { x: meta.x, y: meta.y } };
    // Y si la de arriba está lejos, agarrarse de lo que haya. Normalmente sólo
    // valen las de MAS ADELANTE —agarrarse hacia atrás es de donde venía el
    // tartamudeo—, pero cuando ya se cayó bien por debajo de la que soltó,
    // cualquiera sirve: ahí volver atrás no es tartamudear, es salvarse, y es
    // exactamente lo que hace una persona.
    const ult = p.torre.argollas.find((a) => a.i === desdeI);
    const cayendo = ult && p.y > ult.y + 150;
    let otra = null, mejor = (F.ALCANCE * 0.97) ** 2;
    for (const a of p.torre.argollas) {
      if (a.rota || (a.i <= desdeI && !cayendo)) continue;
      const dd = (a.x - p.x) ** 2 + (a.y - p.y) ** 2;
      if (dd < mejor) { mejor = dd; otra = a; }
    }
    if (otra && otra.i <= desdeI) p._ultima = otra.i - 1;
    return { dedo: otra ? { x: otra.x, y: otra.y } : null };
  }

  const a = p.ancla;
  // Una argolla oxidada avisa: si está por romperse, soltar es mejor que que te
  // suelte ella, porque soltando por lo menos elegís la dirección.
  const porRomperse = a.oxidada && p.t - a.tocada > F.VIDA_OXIDADA - 6;
  if (llega(p.x, p.y, p.vx, p.vy, meta) || porRomperse) return { dedo: null };

  // HAMACARSE: empujar hacia donde ya se va, medido sobre la TANGENTE y no
  // sobre la velocidad horizontal. Una hamaca se agranda acompañando el
  // movimiento, no peleándolo; pero cerca de los extremos del arco la velocidad
  // horizontal casi no dice para qué lado va el péndulo —cambia de signo antes
  // que el movimiento— y empujando por ahí el robot se peleaba con su propio
  // envión y se quedaba en una amplitud fija para siempre. La tangente sí lo
  // dice, en cualquier punto del arco.
  const nx = (p.x - a.x) / (Math.hypot(p.x - a.x, p.y - a.y) || 1);
  const ny = (p.y - a.y) / (Math.hypot(p.x - a.x, p.y - a.y) || 1);
  const vt = -p.vx * ny + p.vy * nx;            // velocidad sobre la tangente
  const tx = -ny;                               // componente horizontal de la tangente
  let rumbo = Math.sign(vt * tx);
  if (!rumbo || Math.abs(vt) < 0.4) rumbo = a.x < ANCHO / 2 ? 1 : -1;
  return { dedo: { x: p.x + rumbo * 90, y: p.y } };
}

/** Trepar con el piloto hasta morir o hasta el tope. Devuelve qué pasó. */
export function trepar(Partida, semilla, tope = 20000) {
  const p = new Partida(semilla);
  for (let i = 0; i < tope; i++) {
    p.paso(piloto(p));
    if (p.estado === "muerto") break;
  }
  return { metros: p.metros, vivo: p.estado !== "muerto", tuercas: p.tuercas,
           cuadros: Math.min(tope, p.t) };
}

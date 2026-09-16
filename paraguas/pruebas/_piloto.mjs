// Un piloto automático: es la prueba de que el pozo se puede bajar.
//
// Un generador infinito falla de una forma que no se ve mirando: cada tanto
// pone dos huecos tan separados que, a la velocidad a la que venís, no llegás
// de uno al otro. El jugador no ve un error — ve que perdió otra vez. Este
// bicho sólo sabe "apuntar al próximo hueco y cerrar el paraguas si es
// angosto"; justo por ser tan tonto sirve de prueba, porque si él baja mil
// metros, una persona también.
import { F } from "../js/mundo.js";

export function piloto(p) {
  const f = p.pozo.siguiente(p.y + 12);
  if (!f) return { cerrar: false, mover: 0 };
  const falta = f.y - p.y;
  // Cerrar ANTES de llegar: el paraguas tarda nueve cuadros en cerrarse y
  // encima hay que estar ya alineado cuando se cruza.
  const cerrar = f.angosto && falta < 300;
  // CONTROL CON FRENO, no sólo "andá para allá". Apuntando derecho al hueco se
  // llega con velocidad de costado y se pasa de largo: a trece píxeles por
  // cuadro, un sobrepaso de diez es la diferencia entre pasar y chocar. Restar
  // la velocidad actual es un freno proporcional — el mismo que hace a mano
  // cualquiera que juegue dos minutos.
  const dx = f.x - p.x - p.vx * 7;
  return { cerrar, mover: Math.max(-1, Math.min(1, dx / 20)) };
}

/** Bajar con el piloto hasta morir o hasta el tope. Devuelve qué pasó. */
export function bajar(Partida, semilla, tope = 20000) {
  const p = new Partida(semilla);
  for (let i = 0; i < tope; i++) {
    p.paso(piloto(p));
    if (p.estado === "muerto") break;
  }
  return { metros: p.metros, varillas: p.varillas, vivo: p.estado !== "muerto",
           monedas: p.monedas, roces: p.roces, cuadros: Math.min(tope, p.t) };
}


/**
 * El mismo piloto, pero atado al control de verdad: UN dedo.
 *
 * El de arriba puede cerrar el paraguas y moverse por separado, así que prueba
 * la GEOMETRÍA del pozo — que los huecos se alcancen. Éste prueba otra cosa,
 * que es más difícil y más importante: que el pozo se pueda bajar con el
 * control que tiene el jugador, donde el mismo dedo hace las dos cosas. Si el
 * hueco está lejos, apoya el dedo (apunta y de paso cierra); si ya está
 * alineado, suelta (abre y planea). Es exactamente lo que hace una persona.
 */
export function pilotoDedo(p) {
  const f = p.pozo.siguiente(p.y + 12);
  if (!f) return { cerrar: false, mover: null };
  const falta = f.y - p.y;
  const dx = f.x - p.x - p.vx * 7;
  // Una fila angosta hay que cruzarla cerrada sí o sí: ahí el dedo se queda.
  if (f.angosto && falta < 320)
    return { cerrar: true, mover: Math.max(-1, Math.min(1, dx / 20)) };
  if (Math.abs(dx) < 3) { p._pulso = false; return { cerrar: false, mover: null }; }
  // TOQUECITOS. El paraguas tarda nueve cuadros en cerrarse: apoyando el dedo
  // mientras esté bien abierto y soltando antes de que se cierre, se apunta
  // con la maniobrabilidad del abierto sin pagar la velocidad del cerrado. Es
  // lo que hace una persona a los dos minutos de jugar.
  if (p._pulso && p.abierto < 0.62) p._pulso = false;
  if (!p._pulso && p.abierto > 0.9) p._pulso = true;
  if (!p._pulso) return { cerrar: false, mover: null };
  return { cerrar: true, mover: Math.max(-1, Math.min(1, dx / 20)) };
}

export function bajarConDedo(Partida, semilla, tope = 20000) {
  const p = new Partida(semilla);
  for (let i = 0; i < tope; i++) {
    p.paso(pilotoDedo(p));
    if (p.estado === "muerto") break;
  }
  return { metros: p.metros, vivo: p.estado !== "muerto", monedas: p.monedas };
}

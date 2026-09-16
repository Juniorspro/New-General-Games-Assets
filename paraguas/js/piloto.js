// Un piloto automático. Lo usan dos cosas, y por eso vive acá y no en pruebas:
// el fondo del menú —donde se ve una caída de verdad, borroneada— y el
// validador del pozo. Una sola definición evita que el robot pruebe una
// política y el jugador vea otra.
//
// Un generador infinito falla de una forma que no se ve mirando: cada tanto
// pone dos huecos tan separados que, a la velocidad a la que venís, no llegás
// de uno al otro. El jugador no ve un error — ve que perdió otra vez. Este
// bicho sólo sabe "apuntar al próximo hueco y cerrar el paraguas si es
// angosto"; justo por ser tan tonto sirve de prueba, porque si él baja mil
// metros, una persona también.
import { F } from "./mundo.js";

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
 * control que tiene el jugador, donde el mismo dedo hace las dos cosas.
 *
 * ES UNA COPIA DEL CONTROL, NO UNA APROXIMACION. Simula el dedo entero: dónde
 * está apoyado, cuántos cuadros lleva quieto y la misma fórmula que usa
 * `main.js` para convertir eso en movimiento. Si divergen, el robot prueba un
 * juego que nadie juega — y eso ya pasó una vez: mientras el robot podía
 * cerrar y moverse a la vez llegaba a 778 m, y con el control de verdad, 129.
 *
 * Con el control nuevo el gesto es: arrastrar para poner el dedo donde hay que
 * ir —y mientras se arrastra el paraguas queda ABIERTO, así que se maniobra
 * lento y con precisión— y después soltar el arrastre y dejar el dedo quieto,
 * que es lo que lo cierra y hace caer. Arrastrar para corregir vuelve a
 * abrirlo. Eso es lo que hace este bicho, cuadro por cuadro.
 */
export function pilotoDedo(p) {
  const f = p.pozo.siguiente(p.y + 12);
  if (!f) return { cerrar: false, mover: null };
  if (!p._dedo) p._dedo = { objetivo: p.x, quieto: 999 };
  const d = p._dedo;

  // Adónde poner el dedo: el hueco, adelantado por la velocidad que se trae.
  // Sin ese adelanto se llega al hueco con velocidad de costado y se pasa de
  // largo; a trece píxeles por cuadro, pasarse diez es chocar.
  const meta = Math.max(14, Math.min(346, f.x - p.vx * 3));
  // LA ZONA MUERTA DECIDE EL RITMO DEL JUEGO. Si el robot corrige cada cuadro,
  // el dedo no se queda quieto nunca y el paraguas no cierra jamás — cae lento
  // para siempre y llega abierto a la primera fila angosta, donde no entra.
  // Seis píxeles es lo que una persona deja pasar sin volver a tocar.
  //
  // Y ANTE UNA FILA ANGOSTA SE DEJA DE CORREGIR. Ahí hay que cruzar cerrado sí
  // o sí, cerrar tarda nueve cuadros y sólo cierra el dedo quieto: seguir
  // acomodándose hasta el final es llegar abierto. Se apunta una vez, se saca
  // la mano y se deja caer.
  const banda = f.angosto && f.y - p.y < 200 ? 26 : 6;
  if (Math.abs(meta - d.objetivo) > banda) { d.objetivo = meta; d.quieto = 0; }
  else d.quieto++;

  // De acá para abajo es, letra por letra, lo que hace `leerEntrada`.
  const dx = d.objetivo - p.x;
  return { cerrar: d.quieto >= F.QUIETO,
           mover: Math.abs(dx) < 3 ? 0 : Math.max(-1, Math.min(1, dx / 26)) };
}

export function bajarConDedo(Partida, semilla, tope = 20000) {
  const p = new Partida(semilla);
  for (let i = 0; i < tope; i++) {
    p.paso(pilotoDedo(p));
    if (p.estado === "muerto") break;
  }
  return { metros: p.metros, vivo: p.estado !== "muerto", monedas: p.monedas };
}

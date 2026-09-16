// El buscador de soluciones: la prueba de que los quince niveles se pueden pasar.
//
// UN NIVEL DE PUZZLE QUE NO TIENE SOLUCIÓN SE VE PERFECTO. No hay nada raro en
// la pantalla, no tira ningún error: simplemente el jugador se queda ahí para
// siempre pensando que es malo. Por eso acá no se revisa que el mapa "esté
// bien formado" — se JUEGA, con la física de verdad, hasta encontrar una
// combinación de dos disparos que llegue a la salida.
//
// LA BÚSQUEDA ES CHICA A PROPÓSITO: los dos disparos salen del punto donde
// aparecés, en cuarenta y ocho direcciones. Un jugador puede caminar primero y
// disparar desde otro lado, así que esto encuentra MENOS soluciones de las que
// hay. Eso está bien: si encuentra una, el nivel se puede pasar, que es lo que
// hay que demostrar. Lo contrario —un buscador que prueba todo— tardaría horas
// y probaría lo mismo.
import { Escenario, T } from "../js/portales.js";
import { centro, escalarCuerpos } from "../js/cuerpo.js";
import { NIVELES_P } from "../js/mapas.js";

export const ESCALA_PORTALES = 0.66;

/**
 * Las políticas con las que el buscador juega.
 *
 * SON TRES Y NO UNA porque muchos niveles no fallan por el nivel sino por el
 * piloto. "Ir siempre hacia la salida" camina derecho a las púas del nivel 2 y
 * arruina el bucle de caída del 4, donde lo que hay que hacer es justamente no
 * tocar nada. Probando las tres, un fallo significa que el nivel no se puede
 * pasar de esta forma, y no que el robot es tonto de una forma particular.
 */
export const POLITICAS = ["a la salida", "quieto", "sólo en el piso"];

export function piloto(esc, cual = 0) {
  const c = centro(esc.rilo);
  const s = esc.salida || { x: c.x, y: c.y };
  const p = esc.rilo.p.pecho;
  const vy = p.y - p.py;
  const hacia = Math.max(-1, Math.min(1, (s.x - c.x) / 40));
  if (cual === 1) return { mover: 0, bolita: vy > 5.5 };
  if (cual === 2) return { mover: Math.abs(vy) < 1.2 ? hacia : 0, bolita: vy > 5.5 };
  return { mover: hacia, bolita: vy > 5.5 };
}

/**
 * Correr un plan y decir si llega.
 *
 * El plan son dos disparos con su cuadro: `[[cuadro, x, y], [cuadro, x, y]]`.
 * Entre uno y otro tienen que pasar unos cuadros porque el arma se enfría —lo
 * mismo que le pasa al jugador— y por eso el cuadro es parte del plan y no un
 * detalle.
 */
export function correr(n, plan, tope = 900, politica = 0) {
  escalarCuerpos(ESCALA_PORTALES);
  const esc = new Escenario(n);
  let i = 0;
  for (let f = 0; f < tope; f++) {
    while (i < plan.length && plan[i][0] === f) {
      esc.enfriar = 0;
      esc.disparar(plan[i][1], plan[i][2]);
      i++;
    }
    esc.paso(piloto(esc, politica));
    if (esc.estado === "gano") return { gano: true, cuadros: f, chatarra: esc.juntada };
    if (esc.estado === "roto") return { gano: false, cuadros: f, motivo: "se desarmó" };
  }
  return { gano: false, cuadros: tope, motivo: "no llegó" };
}

/** Las colocaciones distintas que se alcanzan disparando desde el arranque. */
function tiros(n) {
  escalarCuerpos(ESCALA_PORTALES);
  const vistos = new Map();
  for (let a = 0; a < 48; a++) {
    const ang = (a / 48) * Math.PI * 2;
    const esc = new Escenario(n);
    const o = centro(esc.rilo);
    const x = o.x + Math.cos(ang) * 900, y = o.y + Math.sin(ang) * 900;
    esc.enfriar = 0;
    if (!esc.disparar(x, y)) continue;
    const p = esc.portales[0];
    if (!p) continue;
    const llave = p.celdas.map((c) => c.join(",")).sort().join("|") + "@" + p.lado;
    if (!vistos.has(llave)) vistos.set(llave, [x, y]);
  }
  return [...vistos.values()];
}

/** Buscar un plan que pase el nivel. Devuelve el primero que encuentra. */
export function buscar(n, tope = 900) {
  const puntos = tiros(n);
  let probados = 0;
  for (let pol = 0; pol < POLITICAS.length; pol++) {
    for (const a of puntos) {
      for (const b of puntos) {
        if (a[0] === b[0] && a[1] === b[1]) continue;
        probados++;
        const plan = [[0, a[0], a[1]], [10, b[0], b[1]]];
        const r = correr(n, plan, tope, pol);
        if (r.gano) return { plan, politica: pol, ...r, probados,
                             colocaciones: puntos.length };
      }
    }
  }
  return { plan: null, gano: false, probados, colocaciones: puntos.length };
}

export const NOMBRES = NIVELES_P.map((n) => n.nombre);

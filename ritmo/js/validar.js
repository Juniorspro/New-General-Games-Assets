// El validador: ninguna canción se publica sin que una máquina la haya mirado.
//
// QUE NO ALCANZA CON JUGARLA. Una carta con dos notas imposibles se siente
// "difícil" y no "rota", así que probándola a mano uno se echa la culpa. Estas
// reglas son de dedos, no de gusto, y se miden.

import { CANCIONES } from "./compositor.js";
import { armarCarta, CARRILES, MIN_MISMO, MIN_CUALQUIERA, MAX_JUNTAS } from "./carta.js";

/** Revisa una carta. Devuelve {ok, fallas:[], medidas:{}} */
export function revisar(cancion) {
  const { tema, notas, corridas } = armarCarta(cancion);
  const fallas = [];
  const di = (q) => fallas.push(q);

  if (!notas.length) di("no tiene ni una nota");

  const ultimoDe = new Array(CARRILES).fill(-Infinity);
  let peorMismo = Infinity, peorCualquiera = Infinity, maxJuntas = 1;
  for (let i = 0; i < notas.length; i++) {
    const n = notas[i];
    if (n.carril < 0 || n.carril >= CARRILES) di(`carril fuera de rango en t=${n.t}`);
    if (n.t < 0 || n.t > tema.duracion) di(`nota fuera de la canción en t=${n.t}`);
    if (n.largo < 0) di(`nota de largo negativo en t=${n.t}`);

    const hueco = n.t - ultimoDe[n.carril];
    if (hueco < peorMismo) peorMismo = hueco;
    // la sostenida ocupa su carril hasta que termina: otra nota ahí adentro no
    // se puede tocar sin soltar la que estás manteniendo
    ultimoDe[n.carril] = n.t + n.largo;

    if (i > 0) {
      const d = n.t - notas[i - 1].t;
      if (d > 1e-6 && d < peorCualquiera) peorCualquiera = d;
    }
    let juntas = 1;
    for (let j = i + 1; j < notas.length && notas[j].t - n.t < 1e-6; j++) juntas++;
    if (juntas > maxJuntas) maxJuntas = juntas;
  }

  if (peorMismo < MIN_MISMO) di(`dos notas del mismo carril a ${(peorMismo * 1000) | 0} ms (mínimo ${MIN_MISMO * 1000})`);
  if (peorCualquiera < MIN_CUALQUIERA) di(`dos notas a ${(peorCualquiera * 1000) | 0} ms (mínimo ${MIN_CUALQUIERA * 1000})`);
  if (maxJuntas > MAX_JUNTAS) di(`${maxJuntas} notas al mismo tiempo (máximo ${MAX_JUNTAS})`);

  // Que se usen los tres carriles: una canción entera en uno solo se juega con
  // un dedo apoyado y no es lo que promete la pantalla.
  const uso = new Array(CARRILES).fill(0);
  for (const n of notas) uso[n.carril]++;
  if (uso.some((u) => u === 0)) di(`hay un carril sin usar: ${uso.join("/")}`);

  const densidad = notas.length / tema.duracion;
  return {
    ok: fallas.length === 0, fallas,
    medidas: {
      notas: notas.length,
      duracion: +tema.duracion.toFixed(1),
      densidad: +densidad.toFixed(2),
      peorMismo: +(peorMismo * 1000).toFixed(0),
      peorCualquiera: +(peorCualquiera * 1000).toFixed(0),
      maxJuntas, corridas, uso: uso.join("/"),
    },
  };
}

/** Revisa las nueve. Devuelve {ok, filas:[]} */
export function revisarTodas() {
  const filas = CANCIONES.map((c) => ({ id: c.id, ...revisar(c) }));
  return { ok: filas.every((f) => f.ok), filas };
}

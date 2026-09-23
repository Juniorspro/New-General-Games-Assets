/* ============================================================================
   brillo/trailer/guion.js — el guion del tráiler: qué tomas se graban, en qué
   orden van, cómo entra cada una y qué música suena. Lo leen las tres partes:
   tomas.js (graba el juego), audio.js (hace la música) y Remotion (arma el
   video), así las tres cuentan el tiempo igual.

   La música del final va a 138 negras por minuto: un compás son 1,739 s. Del
   logo en adelante cada toma empieza justo en un compás; la transición
   (burbuja, destello) empieza en el compás y la toma de antes queda debajo
   hasta que termina.
   ========================================================================== */
export const FPS = 30;
export const COMPAS = 4 * 60 / 138;
/* cuánto dura cada entrada (s) */
export const TRANSICION = { corte: 0, blanco: 0.35, blancoCorto: 0.18, burbuja: 0.45, fundido: 0.5 };

/* las tomas: qué se graba de cada una. dur en segundos, o compases (c), o 'auto' (lo que dure la escena) */
export const ESCENAS = [
  { id: 'frio', toma: { tipo: 'paisaje', mundo: 'colina', x: -170, zoom: 2, foco: 'parejaColina' }, dur: 7.2,
    entra: 'corte', cartel: { tipo: 'narracion', partes: [['narra.colina', 0, 0.3, 3.4], ['narra.colina', 1, 3.7, 6.7]] }, desdeBlanco: true,
    musica: [{ t: 0, musica: 'titulo' }] },
  { id: 'actualizacion', toma: { tipo: 'actualizacion', zoom: 2, porIdioma: true }, dur: 'auto', max: 22,
    entra: 'fundido', cartel: { tipo: 'chat', narracion: ['narra.colina', 2, 0, 1.6] },
    musica: [{ t: 0.05, musica: null }, { t: 0.05, sfx: 'plano' }] },
  { id: 'titulo', toma: { tipo: 'paisaje', mundo: 'cielo', x: 700 }, c: 2, entra: 'blanco', compas: true,
    cartel: { tipo: 'logo' }, musica: [{ t: -0.4, musica: 'final', golpe: true }, { t: 0, sfx: 'orbe' }] },
  ...[['colina', 'S43>S114', 0, 3], ['arrecife', 'S95>S151', 10, 3], ['ciudad', 'S50>S102', 0, 3], ['cielo', 'S52>S84', 6, 3], ['aurora', 'S84>S130', 0, 2], ['plano', 'S42>S90', 0, 3]]
    .map(([m, tramo, desde, c], i) => ({ id: m, toma: { tipo: 'recorrido', mundo: m, tramo, desde, zoom: 2 }, c, entra: i ? 'burbuja' : 'blanco', compas: true, cartel: { tipo: 'mundo', mundo: m, numero: i + 1 } })),
  ...[['colina', 'S166>orbe', 7], ['arrecife', 'S151>orbe', 0], ['ciudad', 'S126>orbe', 5], ['cielo', 'S122>orbe', 58], ['aurora', 'S130>orbe', 20]]
    .map(([m, tramo, desde], i) => ({ id: 'rasgo' + i, toma: { tipo: 'recorrido', mundo: m, tramo, desde, zoom: 2 }, c: 2, entra: i === 2 || i === 3 ? 'corte' : 'burbuja', compas: true,
      cartel: { tipo: 'rasgo', i }, musica: i === 2 ? [{ t: 0, modo: 'chip' }] : i === 3 ? [{ t: 0, modo: 'aero' }] : [] })),
  { id: 'pregunta', toma: { tipo: 'recorrido', mundo: 'plano', tramo: 'S118>S150', desde: 0, zoom: 2 }, c: 2, entra: 'blanco', compas: true, cartel: { tipo: 'pregunta' } },
  { id: 'respuesta', toma: { tipo: 'recorrido', mundo: 'colina', tramo: 'S43>S114', desde: 52, zoom: 2 }, c: 2, entra: 'burbuja', compas: true, cartel: { tipo: 'respuesta' } },
  ...[['ciudad', 'inicio>S50', 0], ['arrecife', 'S44>S95', 20], ['cielo', 'S84>S122', 12], ['aurora', 'S84>S130', 4], ['colina', 'S114>S166', 40], ['ciudad', 'S102>S126', 10], ['cielo', 'S122>orbe', 62], ['plano', 'S42>S90', 20]]
    .map(([m, tramo, desde], i) => ({ id: 'rafaga' + i, toma: { tipo: 'recorrido', mundo: m, tramo, desde, zoom: 2 }, c: 0.5, entra: i % 2 ? 'corte' : 'blancoCorto', compas: true, cartel: null })),
  { id: 'cierre', toma: { tipo: 'paisaje', mundo: 'aurora', x: 400 }, c: 5, entra: 'blanco', compas: true, cartel: { tipo: 'cierre' },
    musica: [{ t: 0, sfx: 'orbe' }, { t: COMPAS * 3.2, apagar: COMPAS * 1.8 }], alNegro: 1.2 },
];

/* cuándo empieza y cuánto se ve cada escena, en cuadros.
   medidas: { [id]: segundos } para las 'auto' (las mide tomas.js).
   Cada escena se ve desde su inicio hasta el inicio de la siguiente más lo que dure la entrada
   de la siguiente (en ese rato las dos están en pantalla). */
export function tiempos(medidas = {}) {
  const f = (s) => Math.round(s * FPS);
  const out = [];
  let t = 0, grilla = null;
  for (let i = 0; i < ESCENAS.length; i++) {
    const E = ESCENAS[i];
    const largo = E.dur === 'auto' ? (medidas[E.id] ?? E.max) : E.c != null ? E.c * COMPAS : E.dur;
    /* del logo en adelante, los inicios caen en la grilla de compases */
    if (E.compas && grilla == null) grilla = t;
    const inicio = E.compas ? grilla : t;
    out.push({ ...E, i, inicioS: inicio, largoS: largo });
    t = inicio + largo;
    if (E.compas) grilla = t;
  }
  /* las entradas: la escena nueva arranca en su inicio; la de antes sigue debajo lo que dura la entrada */
  for (let i = 0; i < out.length; i++) {
    const L = TRANSICION[out[i].entra] || 0;
    out[i].entradaS = i ? L : 0;
  }
  for (let i = 0; i < out.length; i++) {
    const sig = out[i + 1];
    out[i].inicio = f(out[i].inicioS);
    out[i].visible = f(out[i].inicioS + out[i].largoS + (sig ? sig.entradaS : 0)) - out[i].inicio;   // cuadros que hay que grabar
    out[i].entrada = f(out[i].entradaS);
  }
  const ult = out[out.length - 1];
  return { escenas: out, total: ult.inicio + f(ult.largoS) };
}

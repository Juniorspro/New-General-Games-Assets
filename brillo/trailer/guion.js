/* ============================================================================
   brillo/trailer/guion.js — el guion del tráiler para TikTok (9:16, 1080×1920).
   Lo leen las tres partes: tomas.js (graba el juego), audio.js (hace la
   música) y Remotion (arma el video), así las tres cuentan el tiempo igual.

   Como en un editor de verdad hay dos listas:
   - TOMAS: lo que se graba del juego, cada una en su WebM vertical;
   - PLANOS: el montaje. Cada plano toma un pedazo de una toma (desde, en
     segundos de la toma), dura lo que dice y entra con su transición.
   Una toma puede dar varios planos (la Actualización da seis).

   La música del final va a 138 negras por minuto: un compás son 1,739 s. Los
   planos con `compas` empiezan justo en un compás; la grilla arranca de nuevo
   en el primero de cada tanda (el gancho y el logo).
   ========================================================================== */
export const FPS = 30;
export const ANCHO = 1080, ALTO = 1920;
export const COMPAS = 4 * 60 / 138;
/* el juego se ve a 6 píxeles de pantalla por píxel del juego (el lienzo del juego va a ×3 y el recorte a ×2) */
export const ESCALA = 6;
/* cuánto dura cada transición (s): mitad antes del corte y mitad después */
export const TRANSICION = { corte: 0, glitch: 0.4, blanco: 0.3, destello: 0.16, pixeles: 0.5, mosaico: 0.36 };

/* ------------------------------------------------------------ lo que se graba */
export const TOMAS = {
  colina: { tipo: 'recorrido', mundo: 'colina', tramo: 'S43>S114', desde: 0 },
  arrecife: { tipo: 'recorrido', mundo: 'arrecife', tramo: 'S95>S151', desde: 10 },
  ciudad: { tipo: 'recorrido', mundo: 'ciudad', tramo: 'S50>S102', desde: 0 },
  cielo: { tipo: 'recorrido', mundo: 'cielo', tramo: 'S52>S84', desde: 6 },
  aurora: { tipo: 'recorrido', mundo: 'aurora', tramo: 'S84>S130', desde: 0 },
  plano: { tipo: 'recorrido', mundo: 'plano', tramo: 'S42>S90', desde: 0 },
  orbe: { tipo: 'recorrido', mundo: 'colina', tramo: 'S166>orbe', desde: 7 },
  chip: { tipo: 'recorrido', mundo: 'cielo', tramo: 'S122>orbe', desde: 58 },
  idiomas: { tipo: 'recorrido', mundo: 'ciudad', tramo: 'S126>orbe', desde: 5 },
  pregunta: { tipo: 'recorrido', mundo: 'plano', tramo: 'S118>S150', desde: 0 },
  respuesta: { tipo: 'recorrido', mundo: 'colina', tramo: 'S43>S114', desde: 52 },
  subida: { tipo: 'recorrido', mundo: 'cielo', tramo: 'S84>S122', desde: 12 },
  torres: { tipo: 'recorrido', mundo: 'ciudad', tramo: 'S102>S126', desde: 10 },
  cumbre: { tipo: 'paisaje', mundo: 'cielo', x: 700 },
  noche: { tipo: 'paisaje', mundo: 'aurora', x: 400 },
  /* la actúa el director del juego; dura lo que duran las charlas. Se guarda también el chat y dónde están Nick y Mora */
  actualizacion: { tipo: 'actualizacion', porIdioma: true, max: 20 },
};

/* ------------------------------------------------------------ el montaje */
const MUNDOS = ['colina', 'arrecife', 'ciudad', 'cielo', 'aurora', 'plano'];
export const PLANOS = [
  /* el gancho: cuatro golpes de juego a tempo y "Todo brillaba." */
    { id: 'g0', toma: 'ciudad', desde: 0.4, c: 0.5, entra: 'corte', compas: true, musica: [{ t: -0.4, musica: 'final', golpe: true }], capa: { tipo: 'gancho' } },
  { id: 'g1', toma: 'arrecife', desde: 0.6, c: 0.5, entra: 'destello', compas: true },
  { id: 'g2', toma: 'cielo', desde: 0.8, c: 0.5, entra: 'destello', compas: true },
  { id: 'g3', toma: 'aurora', desde: 0.6, c: 0.5, entra: 'destello', compas: true },
  /* la historia: la Actualización, cortada en seis planos. La música se corta de golpe */
  { id: 'h1', toma: 'actualizacion', desde: 0.3, dur: 3.4, entra: 'glitch', cam: { zoom: [1, 1.12] }, cartel: { tipo: 'historia', narra: ['narra.colina', 2, 0.1, 1.7] },
    musica: [{ t: 0, corte: true }, { t: 0, sfx: 'plano' }] },
  { id: 'h2', toma: 'actualizacion', desde: 3.7, dur: 2.65, entra: 'glitch', cam: { zoom: [1.18, 1.05], sacudir: 0.6 }, cartel: { tipo: 'historia' } },
  { id: 'h3', toma: 'actualizacion', desde: 6.35, dur: 1.65, entra: 'corte', cam: { zoom: [2, 2], foco: 'mora' }, cartel: { tipo: 'historia' } },
  { id: 'h4', toma: 'actualizacion', desde: 8.0, dur: 2.35, entra: 'glitch', cam: { zoom: [1, 1.2] }, cartel: { tipo: 'historia' } },
  { id: 'h5', toma: 'actualizacion', desde: 10.35, dur: 2.85, entra: 'corte', cam: { zoom: [2, 2], foco: 'nick' }, cartel: { tipo: 'historia' } },
  { id: 'h6', toma: 'actualizacion', desde: 14.9, dur: 2.0, entra: 'mosaico', cam: { zoom: [1.1, 1.3], foco: 'nick' }, cartel: { tipo: 'historia' } },
  /* el logo, en el golpe */
  { id: 'logo', toma: 'cumbre', desde: 0.1, c: 2, entra: 'blanco', compas: true, cartel: { tipo: 'logo' }, musica: [{ t: -0.4, musica: 'final', golpe: true }, { t: 0, sfx: 'orbe' }] },
  /* los seis mundos, un compás cada uno */
  ...MUNDOS.map((m, i) => ({ id: 'm' + i, toma: m, desde: [0.3, 1.8, 1.6, 1.9, 1.7, 0.3][i], c: 1, entra: i % 2 ? 'mosaico' : 'pixeles', compas: true, cartel: { tipo: 'mundo', mundo: m, numero: i + 1 } })),
  /* lo que trae */
  { id: 'r0', toma: 'orbe', desde: 0.2, c: 1, entra: 'pixeles', compas: true, cartel: { tipo: 'rasgo', i: 0 } },
  { id: 'r1', toma: 'chip', desde: 0.2, c: 1, entra: 'mosaico', compas: true, cartel: { tipo: 'rasgo', i: 1 }, musica: [{ t: -0.4, modo: 'chip' }] },
  { id: 'r2', toma: 'idiomas', desde: 0.2, c: 1, entra: 'pixeles', compas: true, cartel: { tipo: 'rasgo', i: 2 }, musica: [{ t: -0.4, modo: 'aero' }] },
  /* PLANO pregunta y Nick contesta */
  { id: 'q', toma: 'pregunta', desde: 0.1, c: 1, entra: 'glitch', compas: true, cartel: { tipo: 'pregunta' } },
  { id: 'a', toma: 'respuesta', desde: 0.1, c: 2, entra: 'blanco', compas: true, cartel: { tipo: 'respuesta' } },
  /* la ráfaga: medio compás cada plano */
  ...[['ciudad', 3.6], ['arrecife', 3.9], ['subida', 0.2], ['aurora', 3.2], ['colina', 3.6], ['torres', 0.2], ['cielo', 3.8], ['plano', 3.4]]
    .map(([toma, desde], i) => ({ id: 'f' + i, toma, desde, c: 0.5, entra: i % 2 ? 'destello' : 'corte', compas: true })),
  /* el cierre */
  { id: 'fin', toma: 'noche', desde: 0.1, c: 4, entra: 'blanco', compas: true, cartel: { tipo: 'cierre' },
    musica: [{ t: 0, sfx: 'orbe' }, { t: COMPAS * 2.6, apagar: COMPAS * 1.4 }] },
];

/* cuándo empieza y cuánto dura cada plano, en segundos y en cuadros.
   medidas: { [toma]: segundos } para las tomas que duran lo que dura la escena (las mide tomas.js) */
export function tiempos() {
  const f = (s) => Math.round(s * FPS);
  const out = [];
  let t = 0, grilla = null;
  for (const P of PLANOS) {
    const largo = P.c != null ? P.c * COMPAS : P.dur;
    /* la grilla de compases arranca en el primer plano de cada tanda a tempo */
    if (P.compas && grilla == null) grilla = t;
    if (!P.compas) grilla = null;
    const inicio = P.compas ? grilla : t;
    out.push({ ...P, inicioS: inicio, largoS: largo });
    t = inicio + largo;
    if (P.compas) grilla = t;
  }
  for (let i = 0; i < out.length; i++) {
    const P = out[i], sig = out[i + 1];
    P.inicio = f(P.inicioS);
    P.cuadros = f(P.inicioS + P.largoS) - P.inicio;
    P.entradaS = i ? TRANSICION[P.entra] || 0 : 0;
    P.salida = sig ? sig.entra : null;
    P.salidaS = sig ? TRANSICION[sig.entra] || 0 : 0;
  }
  const ult = out[out.length - 1];
  return { planos: out, total: ult.inicio + ult.cuadros };
}

/* cuánto hay que grabar de cada toma: hasta donde la usa el plano que más lejos llega */
export function largoDeTomas() {
  const { planos } = tiempos();
  const L = {};
  for (const P of planos) L[P.toma] = Math.max(L[P.toma] || 0, P.desde + P.cuadros / FPS + 0.2);
  return L;
}

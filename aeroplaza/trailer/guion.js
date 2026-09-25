/* ============================================================================
   aeroplaza/trailer/guion.js — el tráiler de AEROPLAZA para TikTok (9:16), como
   un editor: la MÚSICA (cuatro canciones del juego, cortadas en sus golpes), las
   PARTES y los PLANOS (qué pedazo de qué toma, cuánto dura y qué dice encima).
   Las TOMAS (lo que se graba del juego, cuadro por cuadro) están en tomas.js.
   Lo leen grabar.mjs (el audio y qué tomas grabar) y Remotion (el montaje).

   Los golpes se midieron con herramientas/…/grilla (flujo espectral + peine):
   - bosque (Frutiger Aero Ahhh): 115,03 BPM, primer golpe a los 0,217 s;
   - juegos: 83,09 BPM, golpes en 0,030 + n × 0,72213 s;
   - runner (el breakcore): 174,99 BPM, golpes en 0,0857 + n × 0,34288; el drop
     es el golpe 56 (19,29 s: la energía salta de 150 a 200-250);
   - titulo (Wii Party): 62,86 BPM, primer golpe a los 0,398 s.
   ========================================================================== */
export const FPS = 30, ANCHO = 1080, ALTO = 1920;

export const CANCIONES = {
  bosque: { archivo: 'aeroplaza/musica-ajena/bosque.mp3', bpm: 115.028, golpe0: 0.2173 },
  juegos: { archivo: 'aeroplaza/musica-ajena/juegos.mp3', bpm: 83.088, golpe0: 0.0301 },
  runner: { archivo: 'aeroplaza/musica-ajena/runner.mp3', bpm: 174.99, golpe0: 0.0857 },
  titulo: { archivo: 'brillo/musica/titulo.mp3', bpm: 62.86, golpe0: 0.3977 },
};
const golpe = (c) => 60 / CANCIONES[c].bpm;

/* las cuatro partes: dónde empiezan en el tráiler (t), desde qué segundo de su canción (desde)
   y cuántos golpes duran. Cada una empieza en un golpe fuerte de su canción */
const A0 = 0, A_GOLPES = 48;                                   // bosque desde el principio: 12 compases
const B0 = CANCIONES.bosque.golpe0 + A_GOLPES * golpe('bosque');   // 25,25 s
const B_DESDE = CANCIONES.juegos.golpe0 + 44 * golpe('juegos'), B_GOLPES = 16;   // juegos desde el compás 11 (31,80 s)
const C0 = B0 + B_GOLPES * golpe('juegos');                      // 36,81 s
const C_DESDE = CANCIONES.runner.golpe0 + 48 * golpe('runner'), C_GOLPES = 40;   // 2 compases antes del drop (16,54 s)
const D0 = C0 + C_GOLPES * golpe('runner');                      // 50,52 s
export const PARTES = [
  { id: 'A', cancion: 'bosque', t: A0, desde: 0, primer: CANCIONES.bosque.golpe0, golpe: golpe('bosque'), golpes: A_GOLPES, fin: B0 },
  { id: 'B', cancion: 'juegos', t: B0, desde: B_DESDE, primer: B0, golpe: golpe('juegos'), golpes: B_GOLPES, fin: C0 },
  { id: 'C', cancion: 'runner', t: C0, desde: C_DESDE, primer: C0, golpe: golpe('runner'), golpes: C_GOLPES, fin: D0 },
  /* Wii Party: arranca antes para que su primer golpe caiga justo en D0 (el blanco) */
  { id: 'D', cancion: 'titulo', t: D0 - CANCIONES.titulo.golpe0, desde: 0, primer: D0, golpe: golpe('titulo'), golpes: 10, fin: D0 + 10 * golpe('titulo') },
];
export const DURACION = PARTES[3].fin + 1.2;   // (con la cola del final)
export const CUADROS = Math.ceil(DURACION * FPS);
/* el segundo del tráiler del golpe n de una parte */
export const enGolpe = (parte, n) => { const P = PARTES.find((q) => q.id === parte); return P.primer + n * P.golpe; };
export const aCuadro = (s) => Math.round(s * FPS);

/* ---------------------------------------------------------------- los planos
   { parte, desde, golpes } dice cuándo empieza (en golpes de su parte) y cuánto dura;
   toma y en: qué toma y desde qué cuadro de ella; txt: el cartel; tipo: cómo entra */
const P = (parte, desde, golpes, toma, en = 0, o = {}) => ({ parte, desde, golpes, toma, en, ...o });
export const PLANOS = [
  /* A · bosque: el sueño Frutiger */
  P('A', -0.42, 8.42, 'dron', 0, { cartel: 'bienvenida' }),                 // 0 → 4,39: arriba del mar, "Bienvenido a"
  P('A', 8, 8, 'dron', 132, { cartel: 'logo' }),                             // 4,39 → 8,56: baja a la plaza y el logo
  P('A', 16, 8, 'muneco', 0, { cartel: 'muneco' }),                          // la ropa cambia en cada golpe
  P('A', 24, 2, 'aqua', 0, { cartel: 'mundo', txt: 'Aqua', sub: 'andá en delfín' }),
  P('A', 26, 2, 'aurora', 0, { cartel: 'mundo', txt: 'Aurora', sub: 'siempre de noche' }),
  P('A', 28, 2, 'jardin', 0, { cartel: 'mundo', txt: 'Jardín de géiseres' }),
  P('A', 30, 2, 'ciudad', 0, { cartel: 'mundo', txt: 'Ciudad de Vidrio' }),
  P('A', 32, 2, 'hotel', 0, { cartel: 'mundo', txt: 'Hoteles por dentro' }),
  P('A', 34, 2, 'tienda', 0, { cartel: 'mundo', txt: 'Aero·Mart' }),
  P('A', 36, 2, 'hongos', 0, { cartel: 'mundo', txt: 'Bosque de Hongos' }),
  P('A', 38, 2, 'bahia', 0, { cartel: 'mundo', txt: 'Bahía del Faro' }),
  P('A', 40, 2, 'desliza', 0, { cartel: 'accion', txt: 'Deslizate' }),
  P('A', 42, 2, 'poder', 0, { cartel: 'accion', txt: 'Tirá poderes' }),
  P('A', 44, 2, 'parkour', 0, { cartel: 'accion', txt: 'Parkour' }),
  P('A', 46, 2, 'tiro', 0, { cartel: 'accion', txt: 'Reventá burbujas' }),
  /* B · juegos: la Zona de Juegos y la gente */
  P('B', 0, 4, 'portales', 0, { cartel: 'zona' }),
  P('B', 4, 1, 'damas', 0, { cartel: 'juego', txt: 'Damas' }),
  P('B', 5, 1, 'futbol', 0, { cartel: 'juego', txt: 'Fútbol' }),
  P('B', 6, 1, 'trampolin', 0, { cartel: 'juego', txt: 'Trampolines' }),
  P('B', 7, 1, 'tobogan', 0, { cartel: 'juego', txt: 'Tobogán' }),
  P('B', 8, 4, 'social', 0, { cartel: 'social' }),
  P('B', 12, 4, 'estelario', 0, { cartel: 'cielo' }),
  /* C · el breakcore: Aero.exe se rompe */
  P('C', 0, 8, 'runner', 0, { cartel: 'error' }),                           // la subida (Frutiger todavía sano)
  P('C', 8, 24, 'runner', aCuadro(8 * golpe('runner')), { cartel: 'despierta' }),   // el drop: 6 compases de golpes
  P('C', 32, 8, 'runnerFin', 0, { cartel: 'final-roto' }),
  /* D · Wii Party: todo vuelve a brillar */
  P('D', 0, 4, 'final', 0, { cartel: 'vuelve' }),
  P('D', 4, 7.3, 'cierre', 0, { cartel: 'cierre' }),
];
/* cuándo empieza y termina cada plano, en cuadros del tráiler */
export function tiempos() {
  return PLANOS.map((q, i) => {
    const t0 = enGolpe(q.parte, q.desde), t1 = enGolpe(q.parte, q.desde + q.golpes);
    return { ...q, i, c0: Math.max(0, aCuadro(t0)), c1: Math.min(CUADROS, aCuadro(t1)) };
  });
}
/* cuántos cuadros hace falta grabar de cada toma (el más largo que se usa, con margen) */
export function largoDeTomas() {
  const L = {};
  for (const q of tiempos()) L[q.toma] = Math.max(L[q.toma] || 0, Math.ceil(q.en) + (q.c1 - q.c0) + 6);
  return L;
}

/* ---------------------------------------------------------------- los sonidos (sonidos.py)
   el primer susto del runner cae a los 20,1 s de la canción (delirio.js › SUSTOS): en el tráiler,
   en la parte C, a los 20,1 − 16,543 s de empezada */
export const SUSTO_T = PARTES[2].t + (20.1 - C_DESDE);
export const TEXTO_BIENVENIDA = 'Bienvenido a';
export function eventosSonido() {
  const E = [], add = (t, tipo, o = {}) => E.push({ t: +Math.max(0, t).toFixed(4), tipo, ...o });
  for (let i = 0; i < TEXTO_BIENVENIDA.length; i++) if (TEXTO_BIENVENIDA[i] !== ' ') add(0.6 + i * 0.075, 'tecla', { v: 0.3 });
  add(enGolpe('A', 8) - 0.6, 'whoosh', { v: 0.7, d: 0.7 }); add(enGolpe('A', 8), 'ting', { v: 0.8 }); add(enGolpe('A', 8), 'golpe', { v: 0.45 });
  for (let k = 1; k < 8; k++) add(enGolpe('A', 16 + k), 'pop', { v: 0.4 });
  for (let b = 24; b <= 46; b += 2) add(enGolpe('A', b), 'pop', { v: 0.5 });
  add(enGolpe('B', 0) - 0.55, 'whoosh', { v: 0.8, d: 0.75 });
  for (let b = 4; b < 8; b++) add(enGolpe('B', b), 'pop', { v: 0.45 });
  for (const f of [6, 26, 46, 64]) add(enGolpe('B', 8) + f / FPS, 'globo', { v: 0.5 });
  add(enGolpe('B', 12), 'ting', { v: 0.45 });
  add(enGolpe('C', 0), 'error', { v: 0.9 }); add(enGolpe('C', 0), 'glitch', { v: 0.55, d: 0.4 });
  add(enGolpe('C', 8) - 1.37, 'subida', { v: 0.5, d: 1.37 }); add(enGolpe('C', 8), 'golpe', { v: 1 });
  add(SUSTO_T, 'grito', { v: 0.75 });
  for (const b of [12, 16, 20, 24, 28]) add(enGolpe('C', b), 'glitch', { v: 0.3, d: 0.18 });
  add(enGolpe('C', 32), 'glitch', { v: 0.55, d: 0.5 }); add(enGolpe('C', 32), 'golpe', { v: 0.6 });
  add(enGolpe('D', 0), 'golpe', { v: 0.85 }); add(enGolpe('D', 0), 'ting', { v: 0.9 });
  add(enGolpe('D', 4) - 0.35, 'whoosh', { v: 0.5, d: 0.6 }); add(enGolpe('D', 4) + 0.1, 'ting', { v: 0.7 });
  return E.sort((a, b) => a.t - b.t);
}

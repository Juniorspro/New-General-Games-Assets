// El compositor: de una partitura escrita a mano (canciones.js) saca, en una
// sola pasada y sin tocar audio ni pantalla,
//
//   · la agenda de sonidos (qué instrumento, cuándo, con qué nota),
//   · la letra con la hora de cada palabra,
//   · el programa de luces,
//   · y las "pistas" que usa el mapa para poner los bloques.
//
// POR QUÉ TODO DE UNA MISMA FUENTE. Un juego de ritmo armado sobre un mp3
// tiene que adivinar dónde están los golpes. Acá el bloque que cortás, la luz
// que se prende y el bombo que suena salen del MISMO renglón de la
// partitura: no puede haber desfase, ni siquiera de un milisegundo.
//
// Son funciones puras: se prueban en Node, sin navegador ni parlantes.

import { G, MODO } from "./constantes.js";

// ─────────────────────────── notas y acordes ───────────────────────────

const NOMBRES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "E4" → 64, "F#3" → 54, "Bb2" → 46. */
export function nota(s) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
  if (!m) throw new Error(`nota rara: ${s}`);
  return 12 * (Number(m[3]) + 1) + NOMBRES[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}

const TIPOS = {
  "": [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
  6: [0, 4, 7, 9], m6: [0, 3, 7, 9], 9: [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14],
  sus4: [0, 5, 7], "7sus4": [0, 5, 7, 10], add9: [0, 4, 7, 14], dim: [0, 3, 6], m7b5: [0, 3, 6, 10],
};

/** "Em7" → {raiz: 4, tonos: [0,3,7,10]} (raíz como clase de altura). */
export function acorde(s) {
  const m = /^([A-G])([#b]?)(.*)$/.exec(s);
  if (!m || !(m[3] in TIPOS)) throw new Error(`acorde raro: ${s}`);
  const raiz = (NOMBRES[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12;
  return { nombre: s, raiz, tonos: TIPOS[m[3]] };
}

/** Voces del acorde dentro de [lo, hi], eligiendo la inversión más cercana a
 *  la anterior: así los acordes "caminan" en vez de saltar (voice leading). */
function voicear(ac, lo, hi, previo, cuantas = 4) {
  const clases = ac.tonos.slice(0, cuantas).map(i => (ac.raiz + i) % 12);
  const candidatos = [];
  for (let base = lo; base < lo + 12; base++) {
    const notas = clases.map(pc => { let n = base + ((pc - base) % 12 + 12) % 12; return n; }).sort((a, b) => a - b);
    if (notas[notas.length - 1] <= hi) candidatos.push(notas);
  }
  if (!candidatos.length) return clases.map(pc => lo + ((pc - lo) % 12 + 12) % 12).sort((a, b) => a - b);
  if (!previo) return candidatos[Math.floor(candidatos.length / 2)];
  const cp = previo.reduce((a, b) => a + b, 0) / previo.length;
  let mejor = candidatos[0], dm = Infinity;
  for (const c of candidatos) {
    const d = Math.abs(c.reduce((a, b) => a + b, 0) / c.length - cp);
    if (d < dm) { dm = d; mejor = c; }
  }
  return mejor;
}

// ─────────────────────────── patrones ───────────────────────────
// 16 pasos por compás. En batería: X acento, x normal, g fantasma, o abierto.

const VEL = { X: 1, x: 0.78, g: 0.32, o: 0.7, ".": 0 };

export const BATERIAS = {
  nada: {},
  intro: { hat: "x.x.x.x.x.x.x.x.", bombo: "x..............." },
  introB: { hat: "x.x.x.x.x.x.x.x.", bombo: "x...x...x...x...", caja: "....g.......g..." },
  funk: {
    bombo: "x......x..x.....", caja: "....X.......X...", fantasma: ".......g.g....g.",
    hat: "xgxgxgxgxgxgxgxg",
  },
  funkB: {
    bombo: "x......x..x...x.", caja: "....X.......X...", fantasma: ".g.....g.g....g.",
    hat: "xgxgxgxgxgxgxgog",
  },
  sube: { bombo: "x...x...x...x...", caja: "....X.......X...", hat: "x.x.x.x.x.x.x.x." },
  redoble: { bombo: "x...x...x...x...", caja: "x.x.x.x.xxxxXXXX" },
  disco: {
    bombo: "X...x...X...x...", palmas: "....X.......X...", abierto: "..o...o...o...o.",
    hat: "x.x.x.x.x.x.x.x.",
  },
  discoB: {
    bombo: "X...x...X...x...", palmas: "....X.......X...", abierto: "..o...o...o...o.",
    hat: "xgxgxgxgxgxgxgxg", caja: "...............g",
  },
  mitad: { bombo: "x.........x.....", caja: "........X.......", hat: "x...x...x...x..." },
  mitadFin: { bombo: "x.........x.....", caja: "........X...", tambor: "............xxxx" },
  final: { bombo: "X...............", platillo: "X..............." },
  // Reggaetón: el dembow. Bombo en cada tiempo y el "tick" en el tresillo.
  dembow: { bombo: "x...x...x...x...", tick: "...x..x....x..x.", hat: "x.x.x.x.x.x.x.x." },
  dembowB: { bombo: "x...x...x...x...", tick: "...x..x....x..x.", hat: "x.x.x.x.x.xxx.x.", palmas: "............X..." },
  dembowSuave: { bombo: "x.......x.......", tick: "...x..x....x..x." },
  // House: cuatro en el piso, palmas en el 2 y el 4, abierto en el "y".
  house: { bombo: "X...x...X...x...", palmas: "....X.......X...", abierto: "..o...o...o...o.", hat: "x.xgx.xgx.xgx.xg" },
  houseB: { bombo: "X...x...X...x...", palmas: "....X.......X...", abierto: "..o...o...o...o.", hat: "x.xgx.xgx.xgx.xg", caja: "..............gg" },
  subeHouse: { bombo: "x...x...x...x...", caja: "x.x.x.x.x.x.x.x." },
  redobleHouse: { bombo: "x...x...x...x...", caja: "xxxxxxxxXXXXXXXX" },
  quieto: { hat: "x...x...x...x..." },
};

// Bajo: [paso, intervalo desde la raíz, duración en pasos, fuerza].
export const BAJOS = {
  funk: [[0, 0, 2, 1], [3, 0, 1, 0.5], [4, 12, 1, 0.85], [6, 0, 1, 0.7], [7, 10, 1, 0.6], [8, 12, 2, 0.9],
    [10, 7, 1, 0.6], [11, 10, 1, 0.6], [12, 0, 2, 0.95], [14, 12, 1, 0.7], [15, 10, 1, 0.6]],
  motor: [[0, 0, 2, 1], [2, 0, 2, 0.7], [4, 12, 2, 0.85], [6, 0, 2, 0.7], [8, 0, 2, 0.95], [10, 12, 2, 0.8],
    [12, 0, 2, 0.9], [14, 7, 2, 0.75]],
  disco: [[0, 0, 2, 1], [2, 12, 2, 0.8], [4, 0, 2, 0.9], [6, 12, 2, 0.8], [8, 0, 2, 1], [10, 12, 2, 0.8],
    [12, 0, 2, 0.9], [14, 12, 1, 0.8], [15, 10, 1, 0.7]],
  largo: [[0, 0, 15, 0.8]],
  pulso: [[0, 0, 3, 1], [8, 0, 3, 0.8]],
  // El bajo del dembow: tres más tres más dos (el tresillo).
  tresillo: [[0, 0, 3, 1], [3, 0, 3, 0.8], [6, 0, 2, 0.75], [8, 0, 3, 1], [11, 0, 3, 0.8], [14, 0, 2, 0.75]],
  // House: en el contratiempo, rodando.
  rodante: [[2, 0, 2, 1], [6, 0, 2, 1], [10, 0, 2, 1], [14, 0, 2, 1]],
  pisada: [[0, 0, 4, 1], [4, 0, 4, 0.9], [8, 0, 4, 1], [12, 0, 4, 0.9]],
};

// Pluck: X el acorde entero, un número = esa nota del acorde (arpegio).
export const PLUCKS = {
  arpegio: "0.1.2.3.2.1.0.1.",
  offbeat: "..X...X...X...X.",
  drop: "X..X..X...X..X..",
};

// Guitarra funk: X rasguido del acorde, m rasguido mudo.
export const GUITARRAS = {
  funk: "..X.mX.X.mX..X.X",
  disco: "..X...X...X...X.",
};

// ─────────────────────────── la expansión ───────────────────────────

/** "¡cor:B4:2-tá!:E5:4 que:E5:2" → sílabas con paso relativo y palabra. */
function leerFrase(texto) {
  const out = [];
  let paso = 0, palabra = 0;
  for (const tokPalabra of texto.trim().split(/\s+/)) {
    const silabas = tokPalabra.split("-");
    let esPausa = false;
    for (const s of silabas) {
      const [sil, nombre, dur] = s.split(":");
      const d = Number(dur);
      if (sil === "_") { paso += d; esPausa = true; continue; }
      out.push({ paso, dur: d, silaba: sil, midi: nota(nombre), palabra });
      paso += d;
    }
    if (!esPausa) palabra++;
  }
  return out;
}

const COLORES_LETRA = ["#ffe066", "#5ce1ff", "#6dff8e", "#ff6fb1", "#ffb347", "#ff5a5a", "#e8e0ff", "#9f7bff"];

export function componer(def) {
  const bpm = def.bpm;
  const negra = 60 / bpm;
  const paso = negra / 4;
  const audio = [], pistas = [], letra = [], luces = [], giros = [], secciones = [];
  const sonar = (t, f, ...a) => audio.push({ t, f, a });
  const pista = (t, tipo, fuerza, altura = 60, extra = {}) => pistas.push({ t, tipo, fuerza, altura, ...extra });
  const luz = (t, g, m, c = 3, f = 1) => luces.push({ t, g, m, c, f });

  let compas = 0;
  let colorLetra = 0;
  let previoPiano = null, previoGuit = null, previoBronce = null;
  const ARRANQUE = def.arranque ?? 0;      // segundos de silencio antes del primer compás
  const tDe = (c, p = 0) => ARRANQUE + (c * 16 + p) * paso;

  for (const sec of def.secciones) {
    const acordes = sec.acordes.split(/\s+/).map(acorde);
    const t0 = tDe(compas);
    const fin = tDe(compas + sec.compases);
    secciones.push({ t: t0, fin, nombre: sec.nombre, tipo: sec.tipo, intensidad: sec.intensidad ?? 0.6 });

    for (let k = 0; k < sec.compases; k++) {
      const c = compas + k;
      const ac = acordes[k % acordes.length];
      const ultimo = k === sec.compases - 1;
      const nombreBat = (ultimo && sec.bateriaFin) ? sec.bateriaFin
        : (sec.bateriaB && k % 2 === 1) ? sec.bateriaB : sec.bateria;
      const bat = BATERIAS[nombreBat] || {};
      const vol = sec.volBateria ?? 1;
      for (const inst of Object.keys(bat)) {
        const patron = bat[inst];
        for (let p = 0; p < patron.length; p++) {
          const ch = patron[p];
          const v = VEL[ch] ?? (ch === "." ? 0 : 0.7);
          if (!v) continue;
          const t = tDe(c, p);
          // En el redoble la fuerza sube hacia el final: se siente que viene algo.
          const rv = nombreBat === "redoble" && inst === "caja" ? v * (0.45 + 0.55 * p / 15) : v;
          switch (inst) {
            case "bombo": sonar(t, "bombo", rv * vol, sec.bombeo !== false); pista(t, "bombo", rv); break;
            case "caja": sonar(t, "caja", rv * vol); pista(t, "caja", rv * 0.95); break;
            case "fantasma": sonar(t, "caja", rv * 0.9 * vol); break;
            case "palmas": sonar(t, "palmas", rv * vol); pista(t, "caja", rv); break;
            case "hat": sonar(t, "hat", rv * 0.8 * vol, false); pista(t, "hat", rv * 0.25); break;
            case "abierto": sonar(t, "hat", rv * vol, true); pista(t, "hat", rv * 0.35); break;
            case "platillo": sonar(t, "platillo", rv * vol); pista(t, "platillo", 1.3); break;
            case "tambor": sonar(t, "tambor", rv * vol, (p % 4) - 1.5); pista(t, "tambor", rv * 0.8); break;
            case "tick": sonar(t, "tick", rv * vol); pista(t, "caja", rv * 0.9); break;
          }
        }
      }
      // Platillo al empezar cada frase de cuatro en las secciones con fuerza.
      if (sec.platillos && k % 4 === 0) { sonar(tDe(c), "platillo", 0.85); pista(tDe(c), "platillo", 1.2); }

      // Bajo.
      const raizBajo = 28 + ((ac.raiz - 4 + 12) % 12) + 12 * (sec.octavaBajo || 0);   // de E1 (28) a D#2
      const bajo = BAJOS[sec.bajo];
      if (bajo) {
        for (const [p, iv, d, v] of bajo) {
          const m = raizBajo + 12 + iv;       // una octava arriba: E2..
          sonar(tDe(c, p), sec.instBajo || "bajo", m, d * paso * 0.92, v * (sec.volBajo ?? 1));
          pista(tDe(c, p), "bajo", v * 0.4, m);
        }
      }

      // Guitarra funk.
      if (sec.guitarra) {
        const voces = voicear(ac, 60, 76, previoGuit, 3); previoGuit = voces;
        const patron = GUITARRAS[sec.guitarra];
        for (let p = 0; p < 16; p++) {
          const t = tDe(c, p);
          if (patron[p] === "X") { sonar(t, "guitarra", voces, 0.9, p % 2 ? 0.35 : 0.25, 0.09); }
          else if (patron[p] === "m") sonar(t, "rasguidoMudo", 0.8, 0.3);
        }
      }
      // Pluck: el acorde en arpegio o en golpes, según el patrón.
      if (sec.pluck) {
        const voces = voicear(ac, 64, 81, null, 4);
        const patron = PLUCKS[sec.pluck];
        for (let p = 0; p < 16; p++) {
          const ch = patron[p];
          if (ch === ".") continue;
          const notas = ch === "X" ? voces : [voces[(Number(ch) || 0) % voces.length]];
          sonar(tDe(c, p), "pluck", notas, ch === "X" ? 0.9 : 0.7, (p % 2 ? 0.3 : -0.3));
        }
      }
      // Piano eléctrico: el acorde en el uno y un toque sincopado.
      if (sec.piano) {
        const voces = voicear(ac, 52, 71, previoPiano, 4); previoPiano = voces;
        sonar(tDe(c, 0), "piano", voces, paso * 9, 0.8);
        sonar(tDe(c, 10), "piano", voces, paso * 5, 0.55);
      }
      // Colchón.
      if (sec.colchon) {
        const voces = voicear(ac, 55, 74, null, 4);
        sonar(tDe(c, 0), "colchon", voces, paso * 16, sec.colchon);
      }
      // Bronces en los acentos del acorde (estilo sección de vientos).
      if (sec.golpes) {
        const voces = voicear(ac, 64, 81, previoBronce, 3); previoBronce = voces;
        for (const [p, d] of sec.golpes) {
          sonar(tDe(c, p), "bronce", voces, d * paso, 0.9);
          pista(tDe(c, p), "bronce", 1.0, voces[voces.length - 1]);
        }
      }
    }

    // Riffs de bronce: melodía con el acorde de abajo.
    for (const [cDesde, nombreRiff] of sec.riffs || []) {
      const riff = def.riffs[nombreRiff];
      for (const [p, n, d] of riff) {
        const cc = compas + cDesde + Math.floor(p / 16);
        const ac = acordes[(cDesde + Math.floor(p / 16)) % acordes.length];
        const m = nota(n);
        // Debajo de la melodía, los dos tonos del acorde más cercanos.
        const debajo = [];
        for (let x = m - 1; x > m - 12 && debajo.length < 2; x--) {
          if (ac.tonos.some(iv => (ac.raiz + iv) % 12 === ((x % 12) + 12) % 12)) debajo.push(x);
        }
        const t = tDe(cc, p % 16);
        sonar(t, "bronce", [m, ...debajo], d * paso * 0.95, 1);
        pista(t, "bronce", 1.0, m);
      }
    }

    // Solista (riffs de sintetizador).
    for (const [cDesde, nombreRiff] of sec.solos || []) {
      let previa = null;
      for (const [p, n, d] of def.riffs[nombreRiff]) {
        const t = tDe(compas + cDesde, p);
        const m = nota(n);
        sonar(t, "solista", m, d * paso * 0.9, 1, previa);
        pista(t, "solista", 0.8, m);
        previa = m;
      }
    }

    // La voz.
    for (const [cDesde, pasoDesde, texto, opc = {}] of sec.voz || []) {
      const silabas = leerFrase(texto);
      const base = (compas + cDesde) * 16 + pasoDesde;
      // Agrupar por palabra para la letra en pantalla.
      const palabras = new Map();
      silabas.forEach((s, i) => {
        const t = ARRANQUE + (base + s.paso) * paso;
        const d = s.dur * paso;
        const ultima = i === silabas.length - 1 || silabas[i + 1].paso > s.paso + s.dur;
        sonar(t, "silaba", opc.coro ? "coro" : "voz", s.midi, d, s.silaba, opc.fuerza ?? 1, ultima);
        if (opc.coro) return;       // el coro no agrega pistas ni letra: ya las puso la voz principal
        pista(t, "voz", 0.85 + (s.dur >= 4 ? 0.15 : 0), s.midi, { dur: d });
        if (!palabras.has(s.palabra)) palabras.set(s.palabra, { t, fin: t + d, texto: "" });
        const w = palabras.get(s.palabra);
        w.texto += s.silaba; w.fin = t + d;
      });
      if (opc.coro) continue;
      for (const w of palabras.values()) {
        letra.push({ t: w.t, fin: w.fin, texto: w.texto.toUpperCase(), color: COLORES_LETRA[colorLetra++ % COLORES_LETRA.length] });
      }
    }
    // Efectos de transición.
    for (const [cDesde, efecto, dur] of sec.efectos || []) {
      const t = tDe(compas + cDesde);
      if (efecto === "subida") sonar(t, "subida", dur * negra * 4, 1);
      if (efecto === "impacto") { sonar(t, "impacto", 1); pista(t, "platillo", 1.4); }
      if (efecto === "inverso") sonar(t, "inverso", dur * negra * 4, 1);
    }

    programarLuces(sec, compas, tDe, audio, luz, giros, t0, fin, paso);
    compas += sec.compases;
  }

  audio.sort((a, b) => a.t - b.t);
  pistas.sort((a, b) => a.t - b.t);
  letra.sort((a, b) => a.t - b.t);
  // Cada palabra se queda en pantalla hasta que llega la siguiente (con tope):
  // así se lee aunque se cante rápido, como en el video.
  for (let i = 0; i < letra.length; i++) {
    const sig = letra[i + 1];
    const tope = letra[i].t + 1.6;
    letra[i].hasta = sig ? Math.min(sig.t, Math.max(letra[i].fin + 0.25, tope)) : letra[i].fin + 1.2;
  }
  const duracion = tDe(compas) + 2.5;
  return {
    id: def.id, titulo: def.titulo, autor: def.autor, bpm, duracion, paleta: def.paleta,
    audio, pistas, letra, luces, giros, secciones, negra, arranque: ARRANQUE,
    compases: compas, voces: def.voces || [{ nombre: "voz" }],
  };
}

// ─────────────────────────── las luces ───────────────────────────
// Cada tipo de sección tiene su "coreografía". Se arma leyendo los golpes que
// ya están en la agenda de audio de esa sección: la luz baila con lo que suena.

export function programarLuces(sec, compas, tDe, audio, luz, giros, t0, fin, paso) {
  const P = 0, S = 1, B = 2;   // principal, secundario, blanco
  const golpes = audio.filter(e => e.t >= t0 - 1e-6 && e.t < fin - 1e-6);
  const tipo = sec.tipo;
  const compasDe = (t) => Math.floor((t - t0) / (paso * 16) + 1e-6);

  // Estado de base al entrar.
  switch (tipo) {
    case "intro":
      luz(t0, G.FONDO, MODO.PRENDER, P, 0.55); luz(t0, G.PISTA, MODO.PRENDER, B, 0.5);
      luz(t0, G.VERTICAL, MODO.APAGAR); luz(t0, G.ABANICO, MODO.APAGAR);
      luz(t0, G.ALA_IZQ, MODO.PRENDER, B, 0.25); luz(t0, G.ALA_DER, MODO.PRENDER, B, 0.25);
      luz(t0, G.CUERNOS, MODO.PRENDER, P, 0.7); luz(t0, G.ROCAS, MODO.PRENDER, S, 0.45);
      giros.push({ t: t0, v: 0.05 });
      break;
    case "verso":
      luz(t0, G.FONDO, MODO.DESTELLO, P); luz(t0, G.PISTA, MODO.PRENDER, B, 0.9);
      luz(t0, G.VERTICAL, MODO.PRENDER, B, 0.5); luz(t0, G.ABANICO, MODO.APAGAR);
      luz(t0, G.ALA_IZQ, MODO.PRENDER, B, 0.8); luz(t0, G.ALA_DER, MODO.PRENDER, B, 0.8);
      luz(t0, G.CUERNOS, MODO.PRENDER, P); luz(t0, G.ROCAS, MODO.PRENDER, S, 0.9);
      giros.push({ t: t0, v: 0.12 });
      break;
    case "pre":
      luz(t0, G.FONDO, MODO.PRENDER, S, 0.9); luz(t0, G.VERTICAL, MODO.PRENDER, S, 0.8);
      luz(t0, G.ABANICO, MODO.APAGAR); luz(t0, G.ROCAS, MODO.PRENDER, S);
      giros.push({ t: t0, v: 0.25 });
      break;
    case "coro":
      luz(t0, G.FONDO, MODO.DESTELLO, B); luz(t0, G.ABANICO, MODO.DESTELLO, B);
      luz(t0, G.VERTICAL, MODO.DESTELLO, B); luz(t0, G.PISTA, MODO.DESTELLO, B);
      luz(t0, G.ALA_IZQ, MODO.DESTELLO, B); luz(t0, G.ALA_DER, MODO.DESTELLO, B);
      luz(t0, G.CUERNOS, MODO.DESTELLO, P); luz(t0, G.ROCAS, MODO.PRENDER, S);
      giros.push({ t: t0, v: 0.9 });
      break;
    case "puente":
      luz(t0, G.FONDO, MODO.DESVANECER, S); luz(t0, G.ABANICO, MODO.APAGAR);
      luz(t0, G.VERTICAL, MODO.PRENDER, S, 0.35); luz(t0, G.PISTA, MODO.PRENDER, S, 0.35);
      luz(t0, G.ALA_IZQ, MODO.DESVANECER, S); luz(t0, G.ALA_DER, MODO.DESVANECER, S);
      luz(t0, G.ROCAS, MODO.PRENDER, S, 0.35); luz(t0, G.CUERNOS, MODO.PRENDER, P, 0.6);
      giros.push({ t: t0, v: 0.04 });
      break;
    case "outro":
      luz(t0, G.FONDO, MODO.DESTELLO, P); luz(t0, G.ABANICO, MODO.DESVANECER, B);
      luz(t0, G.VERTICAL, MODO.DESVANECER, B); luz(t0, G.PISTA, MODO.PRENDER, B, 0.6);
      luz(t0 + paso * 32, G.FONDO, MODO.DESVANECER, P);
      giros.push({ t: t0, v: 0.1 });
      break;
  }

  const tApagon = sec.apagonFinal ? fin - paso * 4 - 1e-6 : Infinity;
  for (const e of golpes) {
    const t = e.t;
    if (t >= tApagon) continue;      // el apagón no lo pisa nada
    const c = compasDe(t);
    const colorCompas = Math.floor(c / 2) % 2 ? S : P;
    switch (e.f) {
      case "bombo":
        if (tipo === "coro") {
          luz(t, G.FONDO, MODO.DESTELLO, c % 4 === 3 ? B : colorCompas);
          luz(t, G.PISTA, MODO.DESTELLO, B);
        } else if (tipo === "verso") {
          luz(t, G.PISTA, MODO.DESTELLO, B, 0.9);
        } else if (tipo === "pre" || tipo === "intro") {
          luz(t, G.PISTA, MODO.DESTELLO, B, 0.7);
          if (tipo === "pre") luz(t, G.FONDO, MODO.DESTELLO, S, 0.8);
        } else if (tipo === "puente") {
          luz(t, G.PISTA, MODO.DESVANECER, S, 0.5);
        }
        break;
      case "caja": case "palmas": case "tick": {
        const lado = Math.round((t - t0) / (paso * 8)) % 2 ? G.ALA_IZQ : G.ALA_DER;
        if (tipo === "coro" || tipo === "verso") luz(t, lado, MODO.DESTELLO, tipo === "coro" ? B : 3);
        if (tipo === "coro") luz(t, G.VERTICAL, MODO.DESTELLO, colorCompas === P ? S : P);
        if (tipo === "pre") luz(t, G.VERTICAL, MODO.DESTELLO, B, 0.8 + 0.4 * (c / sec.compases));
        break;
      }
      case "bronce":
        luz(t, G.ABANICO, MODO.DESVANECER, tipo === "coro" ? B : P);
        luz(t, G.CUERNOS, MODO.DESTELLO, P);
        giros.push({ t, v: tipo === "coro" ? 1.4 : 0.6 });
        giros.push({ t: t + 0.25, v: tipo === "coro" ? 0.7 : 0.2 });
        break;
      case "silaba":
        luz(t, G.CUERNOS, MODO.DESTELLO, P, 0.9);
        break;
      case "platillo":
        luz(t, G.FONDO, MODO.DESTELLO, B);
        luz(t, G.ABANICO, MODO.DESVANECER, B);
        break;
    }
  }

  // Antes de un coro, un tiempo de apagón: el golpe de luz entra con el coro.
  if (sec.apagonFinal) {
    const ta = fin - paso * 4;
    for (let g = 0; g < 8; g++) luz(ta, g, MODO.APAGAR);
  }
}

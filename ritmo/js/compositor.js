// El compositor. Escribe la canción entera como una lista de eventos.
//
// NO TOCA AUDIO NI DOM A PROPOSITO. Todo lo que decide qué suena y cuándo vive
// acá, en funciones puras; `sonido.js` sólo sabe convertir un evento en ruido.
// Por eso la carta jugable y el validador corren en Node, sin navegador y sin
// parlantes, y las pruebas pueden revisar las nueve canciones en milisegundos.
//
// Y POR ESO NO HAY DETECCION DE GOLPES. Un juego de ritmo hecho sobre un mp3
// tiene que adivinar dónde están los tiempos, y adivina mal. Acá la melodía la
// escribe este archivo: la carta no se deduce de la música, ES la música. La
// nota que tocás y la que suena son el mismo objeto.

import { azar, entero, uno, quizas } from "./azar.js";

/** Semitono MIDI → hercios. La 4 = 69 = 440 Hz. */
export const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Menor natural. Es la escala del género y la que deja que una melodía al azar
// siga sonando a algo: en mayor, una nota de paso equivocada suena a error.
const MENOR = [0, 2, 3, 5, 7, 8, 10];

// Progresiones de cuatro acordes, en grados de la escala (0 = tónica).
// Son cuatro y no generadas: una progresión al azar suena a nada, y estas
// cuatro son las que sostienen un loop sin cansar.
const PROGRESIONES = [
  [0, 5, 2, 6],   // i  VI III VII
  [0, 3, 5, 4],   // i  iv VI  v
  [0, 6, 5, 4],   // i VII VI   v
  [0, 2, 5, 4],   // i III VI   v
];

/* Ritmos de un compás, en semicorcheas (16 casilleros).
   ESCRITOS A MANO Y NO SORTEADOS. Un ritmo al azar suena a alguien golpeando
   la mesa; estos ocho son frases, y sortear ENTRE frases sigue sonando a
   música. Están ordenados de menos a más denso: la dificultad elige hasta
   dónde de la lista puede sacar. */
const RITMOS = [
  [0, 8],
  [0, 4, 8, 12],
  [0, 6, 8, 14],
  [0, 3, 8, 11],
  [0, 4, 6, 8, 12, 14],
  [0, 2, 4, 8, 10, 12],
  [0, 3, 6, 8, 11, 14],
  [0, 2, 4, 6, 8, 10, 12, 14],
];

/* DOS COMPASES DE INTRO Y NO CUATRO. Cuatro suenan mejor y se juegan peor:
   medido, a 92 pulsos la primera nota caía a los 10,4 segundos, y eso es lo que
   hay que esperar CADA VEZ que se reintenta una canción. Dos compases siguen
   alcanzando para engancharse al pulso, que es para lo que está la intro, y
   bajan la espera a la mitad. Lo mismo el final: cuatro compases después de la
   última nota son cuatro compases mirando el resultado que no llega. */
const SECCIONES = [
  { nombre: "intro", compases: 2, melodia: false },
  { nombre: "A",     compases: 8, melodia: true },
  { nombre: "B",     compases: 8, melodia: true },
  { nombre: "A2",    compases: 8, melodia: true },
  { nombre: "fin",   compases: 2, melodia: false },
];

/** Las nueve canciones. La dificultad sube por densidad y por velocidad. */
export const CANCIONES = [
  { id: 1, semilla: 1071, bpm:  92, tonica: 57, dificultad: 0 },
  { id: 2, semilla: 2293, bpm: 100, tonica: 55, dificultad: 0 },
  { id: 3, semilla: 3517, bpm: 104, tonica: 60, dificultad: 1 },
  { id: 4, semilla: 4271, bpm: 112, tonica: 58, dificultad: 1 },
  { id: 5, semilla: 5849, bpm: 118, tonica: 53, dificultad: 2 },
  { id: 6, semilla: 6133, bpm: 124, tonica: 57, dificultad: 2 },
  { id: 7, semilla: 7607, bpm: 128, tonica: 62, dificultad: 3 },
  { id: 8, semilla: 8419, bpm: 134, tonica: 55, dificultad: 3 },
  { id: 9, semilla: 9781, bpm: 140, tonica: 59, dificultad: 4 },
];

/* Hasta qué ritmo de la lista puede sacar cada dificultad, si la B dobla, cada
   cuánto hay notas sostenidas y con qué frecuencia caen DOS a la vez.
   Las dobles aparecen recién en la 7: son el gesto de los dos pulgares, y
   ponerlas antes de que la mano entienda los tres carriles espanta. */
const PERFIL = [
  { hasta: 2, dobleB: false, sostenidas: 0.00, dobles: 0.00 },
  { hasta: 4, dobleB: false, sostenidas: 0.10, dobles: 0.00 },
  { hasta: 5, dobleB: true,  sostenidas: 0.14, dobles: 0.00 },
  { hasta: 7, dobleB: true,  sostenidas: 0.16, dobles: 0.16 },
  { hasta: 7, dobleB: true,  sostenidas: 0.18, dobles: 0.26 },
];

const grado = (tonica, g) => tonica + MENOR[((g % 7) + 7) % 7] + 12 * Math.floor(g / 7);

/**
 * Escribe una canción entera.
 * @returns {{bpm, duracion, compases, eventos:Array}} eventos ordenados por `t`
 *          en segundos, cada uno {t, tipo, nota?, largo?, vel}
 */
export function componer(cancion) {
  const { semilla, bpm, tonica, dificultad } = cancion;
  const r = azar(semilla);
  const perfil = PERFIL[dificultad];
  const porCompas = 4 * 60 / bpm;          // 4/4
  const porSlot = porCompas / 16;          // una semicorchea
  const prog = uno(r, PROGRESIONES);
  const eventos = [];
  const poner = (t, tipo, extra) => eventos.push({ t: +t.toFixed(5), tipo, vel: 1, ...extra });

  let compas = 0;
  for (const sec of SECCIONES) {
    for (let c = 0; c < sec.compases; c++, compas++) {
      const t0 = compas * porCompas;
      const acorde = prog[compas % 4];
      const raiz = grado(tonica, acorde);

      // ── batería ──────────────────────────────────────────────────────────
      // El bombo en 1 y 3 es el piso del tema; los adornos van sorteados pero
      // NUNCA en el 1, que es el que deja parado al que escucha.
      poner(t0, "bombo");
      poner(t0 + 8 * porSlot, "bombo");
      if (sec.melodia && quizas(r, .45)) poner(t0 + uno(r, [6, 11, 14]) * porSlot, "bombo", { vel: .8 });
      if (sec.nombre !== "intro") {
        poner(t0 + 4 * porSlot, "redoblante");
        poner(t0 + 12 * porSlot, "redoblante");
      }
      const pasoHat = sec.nombre === "B" ? 1 : 2;
      for (let s = 0; s < 16; s += pasoHat)
        poner(t0 + s * porSlot, "hihat", { vel: s % 4 === 0 ? .9 : .55 });

      // ── bajo ─────────────────────────────────────────────────────────────
      // Sincopado (0, 6, 8, 14) y no en negras: en negras el bajo se pega al
      // bombo y el tema deja de moverse.
      for (const s of [0, 6, 8, 14])
        poner(t0 + s * porSlot, "bajo", { nota: raiz - 24, largo: porSlot * (s === 0 ? 5 : 2) });

      // ── colchón ──────────────────────────────────────────────────────────
      for (const g of [acorde, acorde + 2, acorde + 4])
        poner(t0, "pad", { nota: grado(tonica, g), largo: porCompas * .98, vel: .5 });

      // ── melodía: lo único que se toca ────────────────────────────────────
      if (!sec.melodia) continue;
      /* `hasta` es el ULTIMO indice permitido, no la cantidad. Escrito como
         cantidad, la dificultad más alta pedía RITMOS[8] de una lista de ocho
         y devolvía `undefined`. No reventaba siempre: sólo cuando el azar
         sacaba justo ese número, así que la canción 9 andaba hasta que un
         cambio en cualquier otra parte corrió la secuencia. El clamp está para
         que agregar un perfil nuevo no vuelva a esconder lo mismo. */
      const ritmo = RITMOS[Math.min(RITMOS.length - 1, entero(r, perfil.hasta + 1))];
      // Las notas de la melodía salen del acorde de abajo más alguna de paso:
      // caminar por la escala sin mirar el acorde suena desafinado justo en el
      // tiempo fuerte, que es el que se escucha.
      const tonos = [acorde, acorde + 2, acorde + 4, acorde + 7];
      for (const s of ritmo) {
        const fuerte = s % 4 === 0;
        const g = fuerte ? uno(r, tonos) : uno(r, [...tonos, acorde + 1, acorde + 3, acorde + 5]);
        const nota = grado(tonica, g) + 12;
        const sostenida = !fuerte ? 0 : (quizas(r, perfil.sostenidas) ? porSlot * uno(r, [4, 6, 8]) : 0);
        poner(t0 + s * porSlot, "melodia", { nota, largo: sostenida, vel: fuerte ? 1 : .8 });
        /* LA DOBLE VA EN EL TIEMPO FUERTE Y A UNA SEXTA, no a una tercera.
           Una tercera cae cerca y el reparto de carriles —que es por altura—
           las manda al mismo, así que la carta las separa y se pierde el gesto.
           Una sexta se va lo bastante arriba como para caer en otro carril
           sola, que es lo que hace que se sientan dos dedos. */
        if (fuerte && sec.nombre === "B" && !sostenida && quizas(r, perfil.dobles))
          poner(t0 + s * porSlot, "melodia", { nota: grado(tonica, g + 5) + 12, vel: .85 });
      }
      if (perfil.dobleB && sec.nombre === "B" && quizas(r, .5)) {
        // una contramelodía una octava arriba, en los tiempos que quedaron libres
        for (const s of [2, 10]) if (!ritmo.includes(s))
          poner(t0 + s * porSlot, "melodia", { nota: grado(tonica, acorde + 4) + 24, vel: .75 });
      }
    }
  }

  eventos.sort((a, b) => a.t - b.t);
  const duracion = compas * porCompas;
  return { bpm, duracion, compases: compas, porCompas, eventos };
}

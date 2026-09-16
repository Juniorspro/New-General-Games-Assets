// Las voces: que estén todas y que duren lo que dura una frase.
//
// No se puede probar que una voz suene BIEN, pero sí las dos formas en que
// esto se rompe sin que nadie se entere: que falte una línea —el cartel dice
// algo y el parlante no dice nada— y que una línea dure treinta segundos,
// que es lo que devolvía el generador cuando seguía de largo después de leer.
import { readFileSync } from "fs";
import { VOCES } from "../js/voces.js";
import { CAPITULOS, FINAL } from "../js/nivel.js";

let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

// Las claves que el juego va a pedir, armadas como las arma juego.js.
const esperadas = [];
CAPITULOS.forEach((c, i) => c.dice.forEach((_, j) => esperadas.push([`c${i}l${j}`, c.dice[j]])));
FINAL.forEach((l, j) => esperadas.push([`f${j}`, l]));

const faltan = esperadas.filter(([k]) => !VOCES[k]).map(([k]) => k);
ch(`las ${esperadas.length} líneas del juego tienen voz`, faltan.length === 0, faltan.join(", "));

const sobran = Object.keys(VOCES).filter((k) => !esperadas.some(([e]) => e === k));
ch("y no hay voces de líneas que ya no existen", sobran.length === 0, sobran.join(", "));

// Largo razonable: nadie dice una frase de diez palabras en medio segundo, y
// ninguna de estas líneas dura más de cinco.
const raras = esperadas.filter(([k, [, texto]]) => {
  const d = VOCES[k]?.[1] ?? 0;
  return d < 0.5 || d > 5.5 || d > texto.length / 4 + 2.5;
}).map(([k, [, t]]) => `${k} ${VOCES[k]?.[1]}s para ${t.length} letras`);
ch("ninguna dura lo que no puede durar", raras.length === 0, raras.slice(0, 3).join(" · "));

// El atlas es UN archivo con todo adentro: el último tramo tiene que entrar.
const bytes = readFileSync(new URL("../assets/voces.mp3", import.meta.url)).length;
const fin = Math.max(...Object.values(VOCES).map(([t, d]) => t + d));
ch("el atlas existe y le entra la última línea", bytes > 10000 && fin > 0,
   `${Math.round(bytes / 1024)} KB · ${fin.toFixed(1)}s de contenido`);

// Ningún tramo puede pisar al siguiente.
const orden = Object.entries(VOCES).sort((a, b) => a[1][0] - b[1][0]);
let pisa = null;
for (let i = 1; i < orden.length; i++)
  if (orden[i][1][0] < orden[i - 1][1][0] + orden[i - 1][1][1] - 0.01)
    pisa = `${orden[i - 1][0]} → ${orden[i][0]}`;
ch("ninguna línea se pisa con la siguiente", !pisa, pisa || "");

console.log(`\n${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);

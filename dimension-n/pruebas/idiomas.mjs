// Que los tres idiomas digan lo mismo: las mismas claves y los mismos huecos.
//
// Una clave que falta en inglés no rompe nada: cae al castellano y el juego
// sigue, que es justamente por qué nadie se da cuenta. Y un "{n}" que falta en
// una traducción se ve como un número que desapareció, no como un error.
import { TEXTOS } from "../js/idioma.js";
import { CAPITULOS, FINAL } from "../js/nivel.js";
import { NIVELES_P } from "../js/mapas.js";
let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };
const es = Object.keys(TEXTOS.es);
const huecos = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
for (const cod of ["en", "pt"]) {
  const faltan = es.filter((k) => !(k in TEXTOS[cod]));
  const sobran = Object.keys(TEXTOS[cod]).filter((k) => !(k in TEXTOS.es));
  ch(`${cod}: tiene todas las claves`, !faltan.length && !sobran.length,
     faltan.length || sobran.length ? `faltan ${faltan.slice(0, 4)} · sobran ${sobran.slice(0, 4)}` : `${es.length} claves`);
  const distintos = es.filter((k) => huecos(TEXTOS.es[k]) !== huecos(TEXTOS[cod][k] || ""));
  ch(`${cod}: los mismos huecos {var}`, !distintos.length, distintos.slice(0, 4).join(", "));
}
const lineas = CAPITULOS.reduce((a, c) => a + c.dice.length, 0) + FINAL.length;
const dlg = (cod) => Object.keys(TEXTOS[cod]).filter((k) => k.startsWith("dlg.")).length;
ch("cada línea de diálogo, en los tres", dlg("es") === lineas && dlg("en") === lineas && dlg("pt") === lineas,
   `${lineas} líneas`);
ch("cada nivel de portales con nombre y pista, en los tres",
   ["es", "en", "pt"].every((c) => NIVELES_P.every((_, i) => TEXTOS[c][`niv.${i}.nombre`] && TEXTOS[c][`niv.${i}.pista`])),
   `${NIVELES_P.length} niveles`);
console.log(`\n${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);

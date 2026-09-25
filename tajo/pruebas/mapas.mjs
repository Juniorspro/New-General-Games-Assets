// Genera los mapas de todas las canciones en todas las dificultades y los
// valida. Corre en Node, sin navegador: el compositor y el mapa son puros.
import { componer } from "../js/compositor.js";
import { CANCIONES } from "../js/canciones.js";
import { generarMapa, validarMapa, DIFICULTADES } from "../js/mapa.js";
let mal = 0;
for (const def of CANCIONES) {
  const c = componer(def);
  let previa = 0;
  for (const D of DIFICULTADES) {
    const m = generarMapa(c, D.id);
    const errores = validarMapa(m, c);
    const dur = c.duracion - 3;
    const nps = m.notas.length / dur;
    const dobles = m.notas.filter((n, i, l) => l.some((o, j) => j !== i && Math.abs(o.t - n.t) < 0.01)).length / 2;
    const dirs = new Array(9).fill(0); m.notas.forEach(n => dirs[n.dir]++);
    const monot = nps > previa ? "" : "  ✗ NO SUBE";
    if (!(nps > previa)) mal++;
    previa = nps;
    console.log(`${def.titulo.padEnd(15)} ${D.nombre.padEnd(9)} ${String(m.notas.length).padStart(4)} bloques  ${nps.toFixed(2)}/s  dobles ${dobles}  bombas ${m.bombas.length}  dirs ${dirs.join(",")}  errores ${errores.length}${monot}`);
    if (errores.length) { mal++; console.log("   ", errores.slice(0, 5).join("\n    ")); }
  }
}
console.log(mal ? `✗ ${mal} problemas` : "✓ todos los mapas validan");
process.exit(mal ? 1 : 0);

// Busca una solución para cada nivel y la guarda.
//
//     node pruebas/buscar_soluciones.mjs
//
// SE GUARDA PARA QUE LA PRUEBA SEA RÁPIDA. Buscar a ciegas tarda dos minutos:
// puesto en la suite, nadie la correría. Guardada la solución, la prueba sólo
// la REPRODUCE —un segundo— y sigue valiendo lo mismo: si un cambio en la
// física rompe un nivel, el plan guardado deja de llegar y la prueba lo caza.
// Hay que volver a correr esto cuando cambian los mapas.
import { writeFileSync } from "fs";
import { buscar, POLITICAS } from "./_resolver.mjs";
import { NIVELES_P } from "../js/mapas.js";

const salida = [];
let malos = 0;
const t0 = Date.now();
for (let n = 0; n < NIVELES_P.length; n++) {
  const r = buscar(n);
  const nom = NIVELES_P[n].nombre;
  if (r.gano) {
    salida.push({ n, nombre: nom, plan: r.plan, politica: r.politica, cuadros: r.cuadros });
    console.log(`  ✓ ${String(n + 1).padStart(2)}. ${nom.padEnd(20)} [${POLITICAS[r.politica]}] ${r.cuadros} cuadros`);
  } else {
    malos++;
    console.log(`  ✗ ${String(n + 1).padStart(2)}. ${nom.padEnd(20)} sin solución (${r.colocaciones} colocaciones, ${r.probados} intentos)`);
  }
}
writeFileSync(new URL("../assets/soluciones.json", import.meta.url),
              JSON.stringify(salida, null, 1));
console.log(`\n  ${salida.length}/${NIVELES_P.length} · ${Math.round((Date.now() - t0) / 1000)}s`);
process.exit(malos ? 1 : 0);

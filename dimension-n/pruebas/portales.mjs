// El modo portales: que los quince niveles SE PUEDAN PASAR.
//
// Un nivel de puzzle sin solución se ve perfecto: no hay nada raro en la
// pantalla y no tira ningún error. El jugador se queda ahí para siempre
// creyendo que es malo. Por eso acá no se revisa que el mapa esté "bien
// formado" — se juega cada uno con la física de verdad, reproduciendo la
// solución que encontró pruebas/buscar_soluciones.mjs.
//
// REPRODUCIR Y NO BUSCAR. Buscar a ciegas tarda minuto y medio y nadie
// correría la suite; reproducir tarda un segundo y prueba lo mismo, porque si
// un cambio en la física rompe un nivel el plan guardado deja de llegar.
// Cuando se tocan los mapas hay que volver a correr el buscador.
import { readFileSync } from "fs";
import { correr, POLITICAS } from "./_resolver.mjs";
import { NIVELES_P } from "../js/mapas.js";
import { Escenario, COLS, FILAS } from "../js/portales.js";
import { escalarCuerpos } from "../js/cuerpo.js";

let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

// --- la forma de los mapas ----------------------------------------------
const malos = [];
for (const n of NIVELES_P) {
  if (n.mapa.length !== FILAS) malos.push(`${n.nombre}: ${n.mapa.length} filas`);
  for (const f of n.mapa) if (f.length !== COLS) malos.push(`${n.nombre}: fila de ${f.length}`);
  const t = n.mapa.join("");
  if ((t.match(/S/g) || []).length !== 1) malos.push(`${n.nombre}: no tiene una sola S`);
  if ((t.match(/E/g) || []).length !== 1) malos.push(`${n.nombre}: no tiene una sola E`);
  if (t.includes("D") && !t.includes("B")) malos.push(`${n.nombre}: puerta sin placa`);
}
ch(`los ${NIVELES_P.length} mapas miden ${COLS}x${FILAS} y tienen entrada y salida`,
   malos.length === 0, malos.slice(0, 3).join(" · "));

// Los costados TIENEN que ser negros: si se pudiera poner un portal en el
// borde, se sale del escenario y no hay vuelta.
let bordes = 0;
for (const n of NIVELES_P)
  for (const f of n.mapa) if (f[0] !== "X" || f[COLS - 1] !== "X") bordes++;
ch("ningún nivel deja disparar al borde de los costados", bordes === 0, `${bordes} filas`);

// Nadie aparece dentro de una pared.
escalarCuerpos(0.66);
const enPared = NIVELES_P.map((_, i) => new Escenario(i))
  .filter((e) => e.puntos.some((p) => e.solido(Math.floor(p.x / 16), Math.floor(p.y / 16))))
  .length;
ch("nadie aparece adentro de una pared", enPared === 0, `${enPared} niveles`);

// --- y que se puedan pasar ----------------------------------------------
const planes = JSON.parse(readFileSync(new URL("../assets/soluciones.json", import.meta.url)));
ch(`hay solución guardada para los ${NIVELES_P.length}`, planes.length === NIVELES_P.length,
   `${planes.length} guardadas`);

let pasan = 0;
const fallan = [];
for (const s of planes) {
  // Se le da margen sobre lo que tardó al guardarse: una física un poco
  // distinta puede llegar igual, sólo que más lento, y eso no es una falla.
  const r = correr(s.n, s.plan, Math.max(400, s.cuadros * 2 + 120), s.politica);
  if (r.gano) pasan++;
  else fallan.push(`${s.n + 1}. ${s.nombre} (${r.motivo})`);
}
ch(`los ${NIVELES_P.length} se terminan jugándolos con la física de verdad`,
   pasan === planes.length, fallan.length ? fallan.slice(0, 3).join(" · ")
                                          : `${pasan}/${planes.length}`);

// Y QUE NINGUNO SE PASE SIN DISPARAR. Un nivel de portales que se gana
// caminando no es un nivel fácil: es un nivel que no está. Se prueba con las
// tres políticas, porque "caminar hacia la salida" y "quedarse quieto y caer"
// llegan a lugares distintos.
const solos = [];
for (let n = 0; n < NIVELES_P.length; n++)
  for (let pol = 0; pol < POLITICAS.length; pol++)
    if (correr(n, [], 420, pol).gano) { solos.push(`${n + 1}. ${NIVELES_P[n].nombre}`); break; }
ch("ninguno se pasa sin disparar un portal", solos.length === 0, solos.join(", "));

console.log(`\n${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);

// El nivel: que se pueda terminar, y que ninguna fila este tapada.
//
// Lo que se prueba no es que el generador corra: es que lo que genera SE PUEDA
// PASAR. Un pozo con una fila tapada no se ve raro en una captura, se ve
// perfecto — y es imposible. Por eso la prueba juega el nivel entero con la
// fisica de verdad, la misma que corre en el telefono, y despues mide fila por
// fila que quede aire.
import { construirNivel, paredEn, CAPITULOS } from "../js/nivel.js";
import { Partida } from "../js/juego.js";
import { correr } from "./_piloto.mjs";

let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

const nv = construirNivel();

// El nivel es SIEMPRE el mismo: dos construcciones tienen que dar lo mismo.
const nv2 = construirNivel();
ch("el nivel es el mismo todas las veces",
   JSON.stringify(nv.obst) === JSON.stringify(nv2.obst), `${nv.obst.length} obstáculos`);
ch("tiene los siete capítulos", nv.caps.length === CAPITULOS.length && nv.portales.length === 7);

// El pasillo nunca se cierra.
let angosto = 1e9;
for (const m of nv.perfil) angosto = Math.min(angosto, m.der - m.izq);
ch("el pasillo nunca baja de 150 px de ancho", angosto >= 150, `mínimo ${Math.round(angosto)} px`);

// NINGUNA FILA TAPADA. Se barre el pozo cada 10 px y en cada altura se mide
// cuanto aire queda entre las paredes descontando los obstáculos sólidos.
let peor = { hueco: 1e9, y: 0 };
for (let y = 0; y < nv.alto - 60; y += 10) {
  const w = paredEn(nv.perfil, y);
  const tapado = [];
  for (const o of nv.obst) {
    if (o.t === "gel" || o.t === "aspa") continue;
    if (y < o.y - 6 || y > o.y + o.al + 6) continue;
    tapado.push([o.x, o.x + o.an]);
  }
  tapado.sort((a, b) => a[0] - b[0]);
  let x = w.izq, libre = 0;
  for (const [a, b] of tapado) { libre = Math.max(libre, Math.min(a, w.der) - x); x = Math.max(x, b); }
  libre = Math.max(libre, w.der - x);
  if (libre < peor.hueco) peor = { hueco: libre, y };
}
ch("ninguna fila queda tapada: siempre hay al menos 60 px de aire",
   peor.hueco >= 60, `el peor es ${Math.round(peor.hueco)} px a los ${Math.round(peor.y / 100)} m`);

// Se puede terminar, jugándolo con la física de verdad.
const p = new Partida(nv);
const r = correr(p);
ch("el piloto automático llega al final", r.gano,
   `${r.metros} m en ${r.cuadros} cuadros (${(r.cuadros / 60).toFixed(0)} s), ${r.muertes} muertes`);
ch("y pasa por los siete capítulos", r.capitulos.size === 7, `${r.capitulos.size}/7`);
ch("no lo termina de un tirón perfecto: hay que pelearlo",
   r.cuadros > 900, `${r.cuadros} cuadros`);
ch("ni se le hace eterno", r.cuadros < 9000, `${r.cuadros} cuadros`);
ch("los siete portales quedaron usados", nv.portales.every((q) => q.usado));

// La chatarra tiene que estar donde se pueda pasar.
const nv3 = construirNivel();
let fueraDePared = 0;
for (const c of nv3.chatarra) {
  const w = paredEn(nv3.perfil, c.y);
  if (c.x < w.izq + 6 || c.x > w.der - 6) fueraDePared++;
}
ch("ninguna chatarra quedó adentro de la pared", fueraDePared === 0,
   `${nv3.chatarra.length} pedazos`);

console.log(`\n${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);

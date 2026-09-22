// UN ROBOT QUE JUEGA PARTIDAS ENTERAS, para ver si el balance cierra.
//
// Es la prueba más importante del juego y la única que no se puede reemplazar
// mirando. Un juego de supervivencia se rompe por el balance —que el jefe sea
// imposible, que un arma no sirva nunca, que a los cinco minutos entren tantos
// bichos que el teléfono se arrastre— y nada de eso se ve en una captura.
//
// Lo que se exige: que el robot MAS TONTO que existe (huye del más cercano y
// gira) sobreviva a veces y muera a veces. Si sobrevive siempre, el juego no
// pide nada; si no sobrevive nunca, no hay nada que aprender.
import { Mundo } from "../js/mundo.js";
import { LARGO } from "../js/bichos.js";

/** Huye del bicho más cercano y gira: es lo que hace cualquiera que juega. */
function piloto(w) {
  const p = w.jugador;
  const b = w.masCercano(p.x, p.y, 400);
  let x = 0, y = 0;
  if (b) { const d = Math.hypot(b.x - p.x, b.y - p.y) || 1; x = -(b.x - p.x) / d; y = -(b.y - p.y) / d; }
  // un poco de giro para no clavarse contra el borde
  const a = Math.atan2(p.y, p.x);
  x += -Math.sin(a) * 0.7; y += Math.cos(a) * 0.7;
  // y siempre hacia adentro si está en el borde
  const dc = Math.hypot(p.x, p.y);
  if (dc > w.radioMapa * 0.85) { x -= p.x / dc; y -= p.y / dc; }
  const m = Math.hypot(x, y) || 1;
  return { x: x / m, y: y / m };
}

function jugar(semilla, elegirCon) {
  const w = new Mundo(semilla);
  const paso = 1 / 60;
  let pasos = 0, pico = 0; const ms = [];
  while (!w.terminada() && pasos < LARGO * 60 + 120) {
    if (w.pendienteMejora > 0) { w.elegir(elegirCon(w.ofertas(), w)); continue; }
    const a = performance.now();
    w.avanzar(paso, piloto(w));
    ms.push(performance.now() - a);
    pasos++;
    pico = Math.max(pico, w.bichos.length);
  }
  /* MEDIANA Y PERCENTIL 99, NO EL MAXIMO. El máximo de veinte mil cuadros
     agarra la pausa del recolector de basura y dice 51 ms para una simulación
     cuyo cuadro típico cuesta 0,2. Es el mismo número una y otra vez: el que
     manda es el que describe casi todos los cuadros, no el peor de todos. */
  ms.sort((a, b) => a - b);
  return { gano: w.gano, t: w.t, nivel: w.jugador.nivel, matados: w.matados, pico,
           mediana: ms[ms.length >> 1], p99: ms[Math.floor(ms.length * 0.99)], peor: ms[ms.length - 1],
           armas: w.jugador.armas, pasivas: w.jugador.pasivas };
}

const primera = (o) => o[0];
const alAzar = (o, w) => o[Math.floor(w.r() * o.length) % o.length];

for (const [nombre, estrategia] of [["siempre la primera", primera], ["al azar", alAzar]]) {
  let ganadas = 0, tsum = 0, picoMax = 0, med = 0, p99 = 0, peor = 0, nivSum = 0;
  const N = 12;
  for (let s = 1; s <= N; s++) {
    const r = jugar(s * 977, estrategia);
    ganadas += r.gano ? 1 : 0; tsum += r.t; picoMax = Math.max(picoMax, r.pico);
    med = Math.max(med, r.mediana); p99 = Math.max(p99, r.p99); peor = Math.max(peor, r.peor);
    nivSum += r.nivel;
  }
  console.log(`${nombre.padEnd(20)} sobrevive ${String(ganadas).padStart(2)}/${N} · dura ${(tsum/N).toFixed(0)}s de ${LARGO}` +
              ` · nivel ${(nivSum/N).toFixed(1)} · pico ${picoMax} bichos` +
              ` · cuadro: mediana ${med.toFixed(3)} ms, p99 ${p99.toFixed(2)}, peor ${peor.toFixed(1)}`);
}

/* Y lo que se comprueba, además de mirar los números: que el balance esté en la
   franja donde el juego pide algo sin ser imposible. */
let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };
const N = 12;
let ganadas = 0, medMax = 0, p99Max = 0, picoMax = 0, nivSum = 0;
for (let s = 1; s <= N; s++) {
  const r = jugar(s * 977, primera);
  ganadas += r.gano ? 1 : 0;
  medMax = Math.max(medMax, r.mediana); p99Max = Math.max(p99Max, r.p99);
  picoMax = Math.max(picoMax, r.pico); nivSum += r.nivel;
}
console.log("");
ch("el robot más tonto no gana siempre", ganadas < N, `gana ${ganadas} de ${N}`);
ch("pero gana alguna", ganadas > 0, `gana ${ganadas} de ${N}`);
ch("sube de nivel lo suficiente para que las mejoras importen", nivSum / N >= 8,
   `nivel medio ${(nivSum / N).toFixed(1)}`);
ch("el techo de bichos se respeta", picoMax <= 210, `pico ${picoMax}`);
ch("el cuadro típico de simulación es barato", medMax < 1.5, `mediana ${medMax.toFixed(3)} ms`);
ch("y el percentil 99 también", p99Max < 4, `p99 ${p99Max.toFixed(2)} ms`);
console.log(`\n  ${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);

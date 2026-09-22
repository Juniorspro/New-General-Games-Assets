// UN ROBOT QUE JUEGA PARTIDAS ENTERAS, para ver si el balance cierra.
//
// Es la prueba más importante del juego y la única que no se puede reemplazar
// mirando. Un juego de supervivencia se rompe por el balance —que el jefe sea
// imposible, que un arma no sirva nunca, que a los cinco minutos entren tantos
// bichos que el teléfono se arrastre— y nada de eso se ve en una captura.
//
// Lo que se exige: que el robot MAS TONTO que existe (huye del más cercano,
// gira, y usa el envión cuando lo tiene) sobreviva a veces y muera a veces. Si
// sobrevive siempre, el juego no pide nada; si no sobrevive nunca, no hay nada
// que aprender. Y que las CUATRO etapas sean más difíciles que la anterior.
import { Mundo } from "../js/mundo.js";
import { ETAPAS } from "../js/bichos.js";

/** Huye del más cercano y gira: es lo que hace cualquiera que juega. */
function piloto(w) {
  const p = w.jugador;
  const b = w.masCercano(p.x, p.y, 400);
  let x = 0, y = 0;
  if (b) { const d = Math.hypot(b.x - p.x, b.y - p.y) || 1; x = -(b.x - p.x) / d; y = -(b.y - p.y) / d; }
  const a = Math.atan2(p.y, p.x);
  x += -Math.sin(a) * 0.7; y += Math.cos(a) * 0.7;
  const dc = Math.hypot(p.x, p.y);
  if (dc > w.radioMapa * 0.85) { x -= p.x / dc; y -= p.y / dc; }
  const m = Math.hypot(x, y) || 1;
  // el envión cuando hay algo encima: es lo único que se aprieta en el juego
  if (b && Math.hypot(b.x - p.x, b.y - p.y) < 60) w.lanzarEnvion();
  return { x: x / m, y: y / m };
}

function jugar(semilla, etapa, elegirCon) {
  const w = new Mundo(semilla, etapa);
  const paso = 1 / 60;
  let pasos = 0, pico = 0; const ms = [];
  while (!w.terminada() && pasos < (w.largo + 30) * 60) {
    if (w.pendienteMejora > 0) { w.elegir(elegirCon(w.ofertas(), w)); continue; }
    const a = performance.now();
    w.avanzar(paso, piloto(w));
    ms.push(performance.now() - a);
    pasos++;
    pico = Math.max(pico, w.bichos.length);
  }
  /* MEDIANA Y PERCENTIL 99, NO EL MAXIMO. El máximo de veinte mil cuadros
     agarra la pausa del recolector de basura y dice 51 ms para una simulación
     cuyo cuadro típico cuesta 0,2. Manda el número que describe casi todos los
     cuadros, no el peor de todos. */
  ms.sort((a, b) => a - b);
  return { gano: w.gano, t: w.t, nivel: w.jugador.nivel, matados: w.matados, pico,
           mediana: ms[ms.length >> 1], p99: ms[Math.floor(ms.length * 0.99)],
           evos: Object.keys(w.jugador.evolucionadas).length };
}

const primera = (o) => o[0];

/* UN ROBOT QUE ELIGE BIEN, y no sólo uno que elige al azar.
   Hacen falta los dos. El que elige al azar dice si el juego perdona a alguien
   que no sabe lo que hace; éste dice si RECOMPENSA al que sí. Un juego donde
   los dos rinden igual no tiene decisiones, sólo pantallas de decisión.
   Va derecho a la evolución: sube chispa y filo hasta el máximo y recién
   después mira el resto. Si con eso no se llega a evolucionar nunca, la
   mecánica entera es decorado. */
const derecho = (o) => {
  const orden = ["evolucion", "chispa", "filo", "coraza", "botas", "pulso"];
  for (const q of orden) {
    const hay = o.find((x) => x.clase === q || x.nombre === q);
    if (hay) return hay;
  }
  return o[0];
};
let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

const N = 8;
const porEtapa = [];
for (const [nombre, estrategia] of [["al azar", primera], ["eligiendo bien", derecho]]) {
  console.log(`  ── ${nombre} ──`);
  for (const e of ETAPAS) {
    let ganadas = 0, med = 0, p99 = 0, pico = 0, niv = 0, evos = 0, dur = 0;
    for (let s = 1; s <= N; s++) {
      const r = jugar(s * 977, e.id, estrategia);
      ganadas += r.gano ? 1 : 0; med = Math.max(med, r.mediana); p99 = Math.max(p99, r.p99);
      pico = Math.max(pico, r.pico); niv += r.nivel; evos += r.evos; dur += r.t;
    }
    porEtapa.push({ e, estrategia: nombre, ganadas, med, p99, pico, niv: niv / N, evos, dur: dur / N });
    console.log(`     etapa ${e.id} ${e.nombre.padEnd(11)} gana ${ganadas}/${N} · dura ${(dur/N).toFixed(0)}s de ${e.largo}` +
                ` · nivel ${(niv/N).toFixed(1)} · evoluciones ${evos} · pico ${pico}` +
                ` · cuadro ${med.toFixed(3)}/${p99.toFixed(2)} ms`);
  }
}
const azar = porEtapa.filter((x) => x.estrategia === "al azar");
const bien = porEtapa.filter((x) => x.estrategia === "eligiendo bien");
console.log("");
const tAzar = azar.reduce((a, x) => a + x.ganadas, 0);
const tBien = bien.reduce((a, x) => a + x.ganadas, 0);
const TOT = N * ETAPAS.length;
ch("el que elige al azar no gana siempre", tAzar < TOT, `gana ${tAzar} de ${TOT}`);
ch("pero el juego lo perdona a veces", tAzar > 0, `gana ${tAzar} de ${TOT}`);
/* ELEGIR BIEN TIENE QUE PAGAR. Si las dos estrategias rinden igual, la pantalla
   de mejoras es decorado y el juego no tiene ninguna decisión adentro. */
ch("elegir bien rinde más que elegir al azar", tBien > tAzar, `${tBien} contra ${tAzar} de ${TOT}`);
ch("la etapa 1 es la más amable", azar[0].ganadas >= azar[3].ganadas,
   `${azar[0].ganadas} vs ${azar[3].ganadas} en la 4`);
ch("las cuatro etapas se pueden terminar eligiendo bien", bien.every((x) => x.ganadas > 0),
   bien.map((x) => x.ganadas).join("/"));
ch("la evolución se alcanza de verdad", bien.reduce((a, x) => a + x.evos, 0) > 0,
   `${bien.reduce((a, x) => a + x.evos, 0)} evoluciones en ${TOT} partidas eligiendo bien`);
ch("sube de nivel lo suficiente para que las mejoras importen",
   porEtapa.every((x) => x.niv >= 8), porEtapa.map((x) => x.niv.toFixed(0)).join("/"));
ch("el techo de bichos se respeta", porEtapa.every((x) => x.pico <= 215),
   `pico ${Math.max(...porEtapa.map((x) => x.pico))}`);
ch("el cuadro típico de simulación es barato", porEtapa.every((x) => x.med < 1.5),
   `mediana ${Math.max(...porEtapa.map((x) => x.med)).toFixed(3)} ms`);
ch("y el percentil 99 también", porEtapa.every((x) => x.p99 < 4),
   `p99 ${Math.max(...porEtapa.map((x) => x.p99)).toFixed(2)} ms`);
console.log(`\n  ${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);

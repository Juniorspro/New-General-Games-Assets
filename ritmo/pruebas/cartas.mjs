// LAS NUEVE CARTAS, REVISADAS POR MAQUINA. Sin navegador: son funciones puras.
import { ch, cerrar } from "./_ch.mjs";
import { CANCIONES } from "../js/compositor.js";
import { revisar } from "../js/validar.js";
import { carta } from "../js/carta.js";

let densidadPrevia = 0, peorMismo = Infinity, totalNotas = 0;
for (const c of CANCIONES) {
  const r = revisar(c);
  const m = r.medidas;
  ch(`canción ${c.id}: la carta es tocable`, r.ok,
     `${m.notas} notas · ${m.densidad}/s · mismo carril ≥${m.peorMismo} ms · uso ${m.uso}` +
     (r.fallas.length ? " · " + r.fallas.join("; ") : ""));
  // LA DIFICULTAD TIENE QUE SUBIR. Nueve canciones ordenadas por número que no
  // se ponen más difíciles no son nueve niveles, son nueve canciones sueltas.
  ch(`canción ${c.id}: más densa que la anterior`, m.densidad > densidadPrevia,
     `${densidadPrevia} → ${m.densidad} notas/s`);
  densidadPrevia = m.densidad;
  peorMismo = Math.min(peorMismo, m.peorMismo);
  totalNotas += m.notas;
}
/* LA SEMILLA TIENE QUE SER ESTABLE. Un juego de ritmo se aprende de memoria:
   si la canción 4 sale distinta en otra corrida, el récord guardado no compara
   contra nada. Se compone de cero y se exige que salga idéntica, nota por nota. */
const { armarCarta } = await import("../js/carta.js");
const denuevo = armarCarta(CANCIONES[3]).notas;
ch("la misma semilla da siempre la misma canción",
   JSON.stringify(carta(4).notas) === JSON.stringify(denuevo),
   `${denuevo.length} notas idénticas`);

// LAS ESPERAS DEL ARRANQUE. Es lo que se sufre en cada reintento.
for (const c of CANCIONES) {
  const t = carta(c.id).notas[0].t;
  ch(`canción ${c.id}: la primera nota no se hace esperar`, t < 6,
     `${t.toFixed(1)} s`);
}
console.log(`\n  ${totalNotas} notas en total · ninguna a menos de ${peorMismo} ms de otra del mismo carril`);
cerrar();

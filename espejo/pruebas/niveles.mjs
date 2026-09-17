// Los cuarenta niveles, comprobados de vuelta.
//
// El generador ya los comprobó antes de escribirlos. Esto los vuelve a
// comprobar, y no es redundante: `js/niveles.js` es un archivo que queda en el
// repositorio y se puede tocar a mano, y sobre todo `js/haz.js` —el trazador de
// rayos— se puede tocar sin querer, y ahí los cuarenta niveles cambian de
// sentido en silencio. Un nivel que se volvió imposible no tira ningún error:
// el jugador toca veinte veces, no pasa nada, y la conclusión que saca es sobre
// él, no sobre el nivel.
import { NIVELES } from "../js/niveles.js";
import { Partida } from "../js/juego.js";
import { ESPEJO, FIJO, MURO, EMISOR, OBJETIVO, trazar, ganado } from "../js/haz.js";

let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

ch("hay cuarenta niveles", NIVELES.length === 40, `${NIVELES.length}`);

const sinSolucion = [], yaGanados = [], parMal = [], sinRebote = [];
for (let i = 0; i < NIVELES.length; i++) {
  const n = NIVELES[i];
  if (ganado(n, n.inicial)) yaGanados.push(i + 1);
  const falta = Partida.resolver(n, n.inicial);
  if (falta < 0) sinSolucion.push(i + 1);
  else if (falta !== n.par) parMal.push(`${i + 1}: dice ${n.par}, es ${falta}`);
  const { tramos } = trazar(n, n.inicial);
  if (tramos.length < 4) sinRebote.push(i + 1);
}
ch("los cuarenta se ganan", sinSolucion.length === 0, sinSolucion.join(", "));
ch("ninguno viene ya ganado", yaGanados.length === 0, yaGanados.join(", "));
// EL PAR ES LA PARTE QUE MAS SE PUDRE. Es un número escrito en el archivo, y la
// distancia real depende del trazador de rayos: cualquier cambio ahí lo deja
// mintiendo, y un par mentiroso arruina justo a quien se toma el trabajo de
// buscarlo, porque busca una solución que no existe.
ch("el par de cada uno es la distancia mínima de verdad", parMal.length === 0,
   parMal.slice(0, 3).join(" · "));
ch("en todos el rayo hace algo antes de terminar", sinRebote.length === 0, sinRebote.join(", "));

// Y QUE SE PUEDAN JUGAR DE VERDAD, no sólo que exista una solución: se juegan
// los cuarenta siguiendo la pista, que es el mismo camino que le queda a una
// persona que se traba. Si la pista no lleva a ganar, la única ayuda del juego
// miente.
{
  const fallan = [];
  let toquesTotales = 0;
  for (let i = 0; i < NIVELES.length; i++) {
    const p = new Partida(NIVELES[i], i);
    for (let k = 0; k < 40 && !p.ganado; k++) {
      const e = p.pista();
      if (!e) break;
      p.tocar(e.c, e.f);
    }
    if (!p.ganado) fallan.push(i + 1);
    else if (p.toques !== p.par) fallan.push(`${i + 1}: la pista tardó ${p.toques} y el par es ${p.par}`);
    toquesTotales += p.toques;
  }
  ch("los cuarenta se ganan siguiendo la pista, y siempre en el par",
     fallan.length === 0, fallan.slice(0, 3).join(" · ") || `${toquesTotales} toques en total`);
}

// La curva: que la dificultad suba. Un juego de cuarenta niveles donde el
// treinta y ocho cuesta lo mismo que el dos no tiene cuarenta niveles: tiene
// uno repetido cuarenta veces.
{
  const peso = (n) => n.par + n.espejos.length * 0.5 + n.objetivos.length;
  const primeros = NIVELES.slice(0, 10).reduce((a, n) => a + peso(n), 0) / 10;
  const ultimos = NIVELES.slice(-10).reduce((a, n) => a + peso(n), 0) / 10;
  ch("los últimos diez son bastante más pesados que los primeros diez",
     ultimos > primeros * 1.6, `${primeros.toFixed(1)} contra ${ultimos.toFixed(1)}`);
}

// Que los tableros estén sanos: sin piezas encimadas y con los emisores contra
// el borde, que es de donde sale que el rayo cruce el tablero entero.
{
  const rotos = [];
  for (let i = 0; i < NIVELES.length; i++) {
    const n = NIVELES[i];
    if (n.celdas.length !== n.ancho * n.alto) rotos.push(`${i + 1}: celdas`);
    if (n.objetivos.length > n.emisores.length)
      // Un objetivo se COME el rayo: con más objetivos que emisores no hay
      // tablero posible, ni difícil ni fácil.
      rotos.push(`${i + 1}: ${n.objetivos.length} objetivos y ${n.emisores.length} emisores`);
    if (n.inicial.length !== n.espejos.length) rotos.push(`${i + 1}: estado inicial`);
    for (const e of n.emisores) {
      const borde = e.c === 0 || e.f === 0 || e.c === n.ancho - 1 || e.f === n.alto - 1;
      if (!borde) rotos.push(`${i + 1}: emisor en el medio`);
      if (n.celdas[e.f * n.ancho + e.c].t !== EMISOR) rotos.push(`${i + 1}: emisor encimado`);
    }
    for (const o of n.objetivos)
      if (n.celdas[o.f * n.ancho + o.c].t !== OBJETIVO) rotos.push(`${i + 1}: objetivo encimado`);
    n.espejos.forEach((e, k) => {
      const cel = n.celdas[e.f * n.ancho + e.c];
      if (cel.t !== ESPEJO || cel.i !== k) rotos.push(`${i + 1}: espejo ${k} encimado`);
    });
  }
  ch("los tableros están sanos", rotos.length === 0, rotos.slice(0, 3).join(" · "));
}

// El rayo no puede colgarse. Dos espejos enfrentados hacen un lazo cerrado, y
// cortando por cantidad de pasos el rayo se dibujaría distinto según cuántos se
// le pusieron: el corte es haber estado acá antes, y esto lo comprueba
// probando TODAS las combinaciones de espejos de los niveles chicos.
{
  let combinaciones = 0;
  for (const n of NIVELES.slice(0, 8)) {
    const c = n.espejos.length;
    for (let k = 0; k < (1 << c); k++) {
      trazar(n, Array.from({ length: c }, (_, b) => (k >> b) & 1));
      combinaciones++;
    }
  }
  ch("ninguna combinación de espejos cuelga el trazador", true, `${combinaciones} probadas`);
}

// Ganar se congela: después de ganar, seguir tocando no puede desganar el nivel
// ni seguir subiendo el contador.
{
  const p = new Partida(NIVELES[0], 0);
  const e = p.pista(); p.tocar(e.c, e.f);
  const toques = p.toques;
  for (const esp of NIVELES[0].espejos) p.tocar(esp.c, esp.f);
  ch("después de ganar, seguir tocando no cambia nada",
     p.ganado && p.toques === toques, `${toques} → ${p.toques}`);
}

// Y reiniciar tiene que dejarlo como estaba, sin arrastrar el estado de antes.
{
  const p = new Partida(NIVELES[5], 5);
  for (const esp of NIVELES[5].espejos.slice(0, 2)) p.tocar(esp.c, esp.f);
  p.reiniciar();
  ch("reiniciar lo deja igual que al principio",
     p.toques === 0 && !p.ganado && p.estado.join() === NIVELES[5].inicial.join());
}
// Y volver a jugarlo no puede arrastrar lo de la partida anterior: el nivel es
// un objeto compartido y escribirle el estado adentro sería empezar el puzzle
// medio resuelto.
{
  const a = new Partida(NIVELES[7], 7);
  a.tocar(NIVELES[7].espejos[0].c, NIVELES[7].espejos[0].f);
  const b = new Partida(NIVELES[7], 7);
  ch("volver a abrir un nivel lo arranca desde cero",
     b.estado.join() === NIVELES[7].inicial.join() && b.toques === 0);
}

console.log(`\n${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);

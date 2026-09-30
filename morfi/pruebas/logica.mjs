// Las pruebas sin navegador: la física de los hilos, los 30 niveles con sus
// soluciones guardadas, lo guardado y los textos.
//   node morfi/pruebas/logica.mjs
import { Mundo, PASO, GRAVEDAD } from '../js/cuerdas.js';
import { Partida, jugarSolucion, ANCHO, ALTO } from '../js/partida.js';
import { NIVELES, CAJAS } from '../js/niveles.js';
import { validar, base, nivelAbierto, cajaAbierta, estrellasTotal } from '../js/guardado.js';
import { MORFIS, DULCES, premio } from '../js/pieles.js';
import { PIELES_MORFI } from '../js/morfi.js';
import { TABLA, IDIOMAS } from '../js/idioma.js';

let bien = 0, mal = 0;
function ok(cond, nombre, dato = '') {
  if (cond) bien++; else { mal++; console.log(`  FALLA ${nombre}${dato ? ' — ' + dato : ''}`); }
}
const nota = (s) => console.log('  · ' + s);
// jugar una partida paso a paso con acciones [[t, ...acción]]; `cada(p)` en cada paso
function jugar(def, sol = [], tope = 8, cada = null) {
  const p = new Partida(def), acc = [...sol].sort((a, b) => a[0] - b[0]);
  let k = 0;
  while (p.estado === 'juego' && p.t < tope) {
    while (k < acc.length && acc[k][0] <= p.t + 1e-9) p.accion(acc[k++].slice(1));
    p.paso();
    cada?.(p);
  }
  return p;
}
const eventos = (p) => p.eventos.map((e) => e.tipo);

// ── la física ──────────────────────────────────────────────────────────────
{
  // colgado quieto: el hilo no se estira (la correa) y no tiembla
  const p = jugar({ caramelo: [160, 210], morfi: [160, 470], estrellas: [], hilos: [{ pin: [160, 60] }] }, [], 5);
  const L = Math.hypot(p.x - 160, p.y - 60), v = Math.hypot(...p.mundo.vel(p.c));
  ok(Math.abs(L - 150) < 0.5 && v < 1, 'colgado quieto, el hilo de 150 mide 150 y no tiembla', `mide ${L.toFixed(2)}, vel ${v.toFixed(2)}`);
}
{
  // la hamaca: el período de un péndulo de 120 desde 45° (el ideal a 45° es un 4 % más que el de ángulo chico)
  let prev = null; const cruces = [];
  jugar({ caramelo: [160 + 85, 60 + 85], morfi: [160, 470], estrellas: [], hilos: [{ pin: [160, 60], largo: 120 }] }, [], 5, (p) => { if (prev !== null && (prev - 160) * (p.x - 160) < 0) cruces.push(p.t); prev = p.x; });
  const per = ((cruces.at(-1) - cruces[0]) / (cruces.length - 1)) * 2, ideal = 2 * Math.PI * Math.sqrt(120 / GRAVEDAD) * 1.04;
  ok(Math.abs(per / ideal - 1) < 0.05, 'la hamaca tiene el período de un péndulo', `${per.toFixed(3)} s contra ${ideal.toFixed(3)} s`);
  nota(`hamaca de 120 desde 45°: período ${per.toFixed(2)} s (ideal ${ideal.toFixed(2)} s)`);
}
{
  // el globo levanta al caramelo aunque tenga un hilo atado (el hilo es liviano)
  const p = jugar({ caramelo: [230, 330], morfi: [80, 470], estrellas: [], globos: [[230, 330]], hilos: [{ pin: [80, 330] }] }, [], 4);
  ok(p.y < 230 && p.enGlobo, 'el globo levanta al caramelo con hilo y todo', `y = ${p.y.toFixed(0)}`);
  // suelto sube parejo, despacio
  let t200 = 0;
  jugar({ caramelo: [160, 420], morfi: [80, 470], estrellas: [], globos: [[160, 420]] }, [], 4, (q) => { if (!t200 && q.y < 220) t200 = q.t; });
  ok(t200 > 1.4 && t200 < 2.6, 'el globo suelto sube 200 en un par de segundos', `${t200.toFixed(2)} s`);
}
{
  // el abanico empuja al caramelo colgado para donde mira
  const def = { caramelo: [160, 200], morfi: [160, 470], estrellas: [], hilos: [{ pin: [160, 80] }], abanicos: [[60, 200, 0]] };
  const p = jugar(def, [[0.5, 'a', 0]], 0.9);
  ok(p.x > 200 && eventos(p).includes('soplo'), 'el abanico sopla al caramelo para la derecha', `x = ${p.x.toFixed(0)}`);
  const lejos = jugar({ ...def, abanicos: [[60, 200, Math.PI]] }, [[0.5, 'a', 0]], 0.9);
  ok(Math.abs(lejos.x - 160) < 1, 'el abanico que mira para el otro lado no lo mueve', `x = ${lejos.x.toFixed(1)}`);
}
{
  // el sobre: entra por uno y sale por el otro, para donde mira, sin los hilos
  let salida = null;
  const p = jugar({ caramelo: [80, 150], morfi: [160, 470], estrellas: [], hilos: [{ pin: [80, 70] }], sobres: [[[80, 260, -Math.PI / 2], [240, 200, 0]]] }, [[0.5, 'c', 0]], 2, (q) => {
    if (!salida && q.eventos.some((e) => e.tipo === 'sobre')) salida = { x: q.x, y: q.y, v: q.mundo.vel(q.c), hilos: q.mundo.sostienen(q.c).length };
  });
  ok(salida && Math.abs(salida.x - (240 + 34)) < 6 && Math.abs(salida.y - 200) < 6 && salida.v[0] >= 150 && Math.abs(salida.v[1]) < 30 && salida.hilos === 0, 'el sobre lo manda al otro sobre, para donde mira', JSON.stringify(salida));
  ok(p.estado !== 'comido', 'el sobre no se come el caramelo');
}
{
  // la gomita devuelve un poco más de lo que llega
  let antes = 0, despues = 0;
  jugar({ caramelo: [160, 150], morfi: [60, 470], estrellas: [], hilos: [{ pin: [160, 70] }], elasticos: [[100, 330, 220, 330]] }, [[0.5, 'c', 0]], 2, (q) => {
    const v = q.mundo.vel(q.c)[1];
    if (!despues && q.eventos.some((e) => e.tipo === 'boing')) despues = -v; else if (!despues) antes = v;
  });
  ok(despues > antes * 1.05, 'la gomita rebota con más de lo que llegó', `llegó a ${antes.toFixed(0)}, salió a ${despues.toFixed(0)}`);
}
{
  // las chinches lo rompen; el clip le ata un hilo; el alfiler que se mueve sigue su riel
  const roto = jugar({ caramelo: [160, 150], morfi: [60, 470], estrellas: [], hilos: [{ pin: [160, 70] }], chinches: [[100, 330, 220, 330]] }, [[0.5, 'c', 0]], 3);
  ok(roto.estado === 'roto', 'las chinches rompen el caramelo', roto.estado);
  let hilosClip = 0;
  const clip = jugar({ caramelo: [100, 150], morfi: [60, 470], estrellas: [], hilos: [{ pin: [100, 70] }], clips: [[100, 280, 60]] }, [[0.5, 'c', 0]], 2, (q) => { hilosClip = Math.max(hilosClip, q.mundo.sostienen(q.c).length); });
  ok(eventos(clip).includes('clip') && hilosClip === 1 && clip.estado === 'juego', 'el clip ata un hilo nuevo al caramelo que pasa (y lo sostiene)', `${eventos(clip)} ${clip.estado}`);
  const riel = new Partida({ caramelo: [60, 170], morfi: [160, 470], estrellas: [], hilos: [{ pin: [60, 70], mueve: { a: [60, 70], b: [260, 70], periodo: 4 } }] });
  while (riel.t < 2 - 1e-9) riel.paso();
  ok(Math.abs(riel.pines[0].x - 260) < 0.5, 'el alfiler que se mueve llega a la otra punta a medio período', `x = ${riel.pines[0].x.toFixed(2)}`);
}
{
  // Morfi abre arriba: el caramelo que sube desde abajo (en un globo) no entra
  const p = jugar({ caramelo: [160, 440], morfi: [160, 445], estrellas: [], globos: [[160, 440]] }, [], 4);
  ok(p.estado !== 'comido', 'el caramelo que sube por debajo de Morfi no se come', p.estado);
  const baja = jugar({ caramelo: [160, 200], morfi: [160, 445], estrellas: [], hilos: [{ pin: [160, 100] }] }, [[0.5, 'c', 0]], 3);
  ok(baja.estado === 'comido', 'el que cae desde arriba sí', baja.estado);
}
{
  // el pedazo de hilo que queda colgando del caramelo no lo tira: cortar más arriba o más abajo da el mismo vuelo
  const def = { caramelo: [110, 200], morfi: [160, 470], estrellas: [], hilos: [{ pin: [60, 80] }, { pin: [240, 80] }] };
  const vuelo = (k) => {
    const p = new Partida(def), pts = [];
    while (p.t < 0.6) p.paso();
    const h = p.mundo.hilos.find((x) => x.ref === 1 && x.vivo);
    p.mundo.cortarEn(h, Math.round((h.p.length - 2) * k));
    while (p.t < 1.8) { p.paso(); pts.push([p.x, p.y]); }
    return pts;
  };
  const a = vuelo(0.1), b = vuelo(0.9);
  const dif = Math.max(...a.map((q, i) => Math.hypot(q[0] - b[i][0], q[1] - b[i][1])));
  ok(dif < 0.01, 'el pedazo de hilo cortado no cambia el vuelo del caramelo', `diferencia ${dif.toExponential(2)}`);
}
{
  // lo mismo dos veces da lo mismo, bit a bit (las soluciones guardadas dependen de esto)
  const n = NIVELES.find((x) => x.id === '3-10'), a = jugarSolucion(n), b = jugarSolucion(n);
  ok(a.p.x === b.p.x && a.p.y === b.p.y && a.t === b.t, 'la física es determinista', `${a.p.x} ${b.p.x}`);
  // el tiempo real se reparte en pasos fijos y devuelve la fracción para dibujar
  const p = new Partida(n);
  const al = [0.016, 0.0083, 0.033, 0.1, 0.5].map((dt) => p.avanzar(dt));
  ok(al.every((x) => x >= 0 && x < 1), 'avanzar devuelve la fracción del paso para interpolar', JSON.stringify(al));
  ok(Math.abs(p.t - (0.016 + 0.0083 + 0.033 + 0.1 + 0.1)) < PASO + 1e-9, 'un cuadro de medio segundo se toma como de 0,1 (no salta)', p.t.toFixed(4));
}
{
  // cortar con el dedo: un tajo que cruza el hilo lo corta; uno que no, no
  const p = new Partida({ caramelo: [160, 200], morfi: [160, 470], estrellas: [], hilos: [{ pin: [160, 80] }] });
  for (let k = 0; k < 30; k++) p.paso();
  ok(p.cortar(100, 150, 120, 160) === 0 && p.mundo.sostienen(p.c).length === 1, 'un tajo que no toca el hilo no corta nada');
  ok(p.cortar(120, 140, 200, 140) === 1 && p.mundo.sostienen(p.c).length === 0, 'un tajo que cruza el hilo lo corta');
  // el tajo que termina justo sobre el hilo (y el que sigue, que arranca ahí): uno corta, una sola vez
  const r = new Partida({ caramelo: [160, 200], morfi: [160, 470], estrellas: [], hilos: [{ pin: [160, 80] }, { pin: [160, 60], largo: 150 }] });
  for (let k = 0; k < 30; k++) r.paso();
  const c1 = r.cortar(120, 140, 160, 140), c2 = r.cortar(160, 140, 200, 140);
  ok(c1 + c2 >= 1 && r.mundo.hilos.filter((h) => h.cortado && !h.suelto).length <= 2, 'el tajo que termina justo sobre un hilo lo corta', `${c1} + ${c2}`);
  // tocar: el globo revienta con un toque cerca; lejos, no
  const q = new Partida({ caramelo: [160, 300], morfi: [160, 470], estrellas: [], globos: [[160, 300]] });
  for (let k = 0; k < 10; k++) q.paso();
  ok(!q.tocar(q.x + 90, q.y) && q.enGlobo, 'un toque lejos del globo no lo revienta');
  ok(q.tocar(q.x + 20, q.y - 10) && !q.enGlobo, 'un toque en el globo lo revienta');
}
{
  // lo que tarda un paso en el nivel más cargado (cuatro hilos)
  const n = NIVELES.find((x) => x.id === '1-9');
  for (let k = 0; k < 10; k++) jugarSolucion(n);
  const t0 = performance.now(); let pasos = 0;
  for (let k = 0; k < 30; k++) pasos += jugarSolucion(n).p.pasos;
  const us = ((performance.now() - t0) / pasos) * 1000;
  ok(us < 200, 'un paso de física tarda poco', `${us.toFixed(1)} µs`);
  nota(`un paso de física en 1-9 (cuatro hilos): ${us.toFixed(1)} µs (a 120 pasos por segundo, ${((us * 120) / 1000).toFixed(2)} ms por segundo de juego)`);
}

// ── los niveles ────────────────────────────────────────────────────────────
ok(NIVELES.length === 30 && CAJAS.length === 3, 'hay 30 niveles en tres cajas');
ok(NIVELES.every((n, i) => n.id === `${Math.floor(i / 10) + 1}-${(i % 10) + 1}`), 'los niveles van de 1-1 a 3-10 en orden');
ok(CAJAS[0].estrellas === 0 && CAJAS[1].estrellas > 0 && CAJAS[2].estrellas > CAJAS[1].estrellas && CAJAS[2].estrellas <= 60, 'las cajas se abren con más estrellas cada vez (y alcanzan las de antes)');
const OBJETOS = [['clips', 'clip'], ['globos', 'globo'], ['sobres', 'sobre'], ['elasticos', 'boing'], ['abanicos', 'soplo']];
let margenes = 0, conMargen = [];
for (const n of NIVELES) {
  const r = jugarSolucion(n), sin = jugarSolucion(n, []);
  ok(r.estado === 'comido' && r.estrellas === 3, `${n.id}: la solución guardada da de comer con las tres estrellas`, `${r.estado} ${r.estrellas}★`);
  ok(sin.estado !== 'comido', `${n.id}: sin hacer nada, Morfi no come`, sin.estado);
  // cada acción hace falta: sin ella no se come con las tres
  for (let i = 0; i < n.sol.length; i++) {
    const x = jugarSolucion(n, n.sol.filter((_, j) => j !== i));
    ok(!(x.estado === 'comido' && x.estrellas === 3), `${n.id}: la acción ${i} (${JSON.stringify(n.sol[i])}) hace falta`);
  }
  // todo lo que hay en el tablero se usa
  for (const [k, e] of OBJETOS) if ((n[k] || []).length) ok(r.p.eventos.some((x) => x.tipo === e), `${n.id}: se usan los ${k}`);
  // el camino no se sale de la pantalla
  let fuera = null;
  jugar(n, n.sol, 9, (p) => { if (!fuera && (p.x < 5 || p.x > ANCHO - 5 || p.y < 10)) fuera = [Math.round(p.x), Math.round(p.y)]; });
  ok(!fuera, `${n.id}: el caramelo no se sale de la pantalla`, JSON.stringify(fuera));
  // las estrellas adentro del tablero y separadas; Morfi adentro
  ok(n.estrellas.length === 3 && n.estrellas.every(([x, y]) => x >= 20 && x <= 300 && y >= 20 && y <= 460), `${n.id}: tres estrellas adentro del tablero`, JSON.stringify(n.estrellas));
  const sep = Math.min(...n.estrellas.flatMap((a, i) => n.estrellas.slice(i + 1).map((b) => Math.hypot(a[0] - b[0], a[1] - b[1]))));
  ok(sep >= 40, `${n.id}: las estrellas no se pisan`, sep.toFixed(0));
  ok(n.morfi[0] >= 55 && n.morfi[0] <= 265 && n.morfi[1] <= 445, `${n.id}: Morfi entra en la pantalla`, JSON.stringify(n.morfi));
  // el margen: una acción un poco antes o después (±0,04 y ±0,08 s; quien juega también corre las que siguen)
  let b = 0, tot = 0;
  for (let i = 0; i < n.sol.length; i++) for (const d of [-0.08, -0.04, 0.04, 0.08]) {
    tot++;
    const sola = n.sol.map((a, j) => (j === i ? [a[0] + d, ...a.slice(1)] : a)), todas = n.sol.map((a, j) => (j >= i ? [a[0] + d, ...a.slice(1)] : a));
    const sirve = (s) => { const x = jugarSolucion(n, s); return x.estado === 'comido'; };
    if (sirve(sola) || sirve(todas)) b++;
  }
  margenes += b / tot; conMargen.push(`${n.id} ${Math.round((b / tot) * 100)}`);
  ok(b / tot >= 0.6, `${n.id}: cortar un poco antes o después también sirve`, `${Math.round((b / tot) * 100)} %`);
}
nota(`margen para comer con ±0,04 y ±0,08 s: ${Math.round((margenes / NIVELES.length) * 100)} % en promedio; los que no son 100: ${conMargen.filter((x) => !x.endsWith(' 100')).join(', ')}`);

// ── lo guardado ────────────────────────────────────────────────────────────
{
  const b = base();
  ok(b.mejor.length === 30 && b.mejor.every((e) => e === -1) && b.morfi === 'kraft' && b.dulce === 'rojo', 'lo guardado arranca vacío');
  ok(JSON.stringify(validar(null)) === JSON.stringify(b) && JSON.stringify(validar('basura')) === JSON.stringify(b), 'lo guardado roto vuelve a cero');
  const v = validar({ mejor: [3, 9, -7, 'x', 2], monedas: -5, morfis: ['jx', 'trucho'], morfi: 'jx', dulce: 'uva', dulces: ['rojo'], ayudas: ['ayudaCortar', 'otra'], ajustes: { musica: 'si', sonido: false, idioma: 'fr', calidad: 'alta' } });
  ok(JSON.stringify(v.mejor.slice(0, 6)) === '[3,3,-1,-1,2,-1]' && v.monedas === 0, 'las estrellas y las monedas se recortan a lo posible', JSON.stringify(v.mejor.slice(0, 6)));
  ok(v.morfis.join() === 'kraft,jx' && v.morfi === 'jx' && v.dulce === 'rojo', 'solo se usa lo que se tiene (y lo inventado no entra)', `${v.morfis} ${v.morfi} ${v.dulce}`);
  ok(v.ayudas.join() === 'ayudaCortar' && v.ajustes.musica === true && v.ajustes.sonido === false && v.ajustes.idioma === null && v.ajustes.calidad === 'alta', 'las ayudas y los ajustes se validan uno por uno', JSON.stringify(v.ajustes));
  const d = base();
  ok(nivelAbierto(d, 0) && !nivelAbierto(d, 1) && !cajaAbierta(d, 1), 'al principio, solo el 1-1');
  d.mejor[0] = 0;
  ok(nivelAbierto(d, 1) && !nivelAbierto(d, 2), 'ganar un nivel (aunque sea sin estrellas) abre el siguiente');
  d.mejor = d.mejor.map((_, i) => (i < 4 ? 3 : -1));
  ok(estrellasTotal(d) === 12 && cajaAbierta(d, 1) && nivelAbierto(d, 10) && !nivelAbierto(d, 11) && !cajaAbierta(d, 2), 'con 12 estrellas se abre el cuaderno (desde su primer nivel)');
  ok(premio(-1, 3) === 25 && premio(-1, 0) === 10 && premio(1, 3) === 12 && premio(3, 2) === 2, 'las monedas: la primera vez 10 y 5 por estrella; después, 5 por estrella nueva y 2', [premio(-1, 3), premio(-1, 0), premio(1, 3), premio(3, 2)].join());
  ok(MORFIS.every((m) => PIELES_MORFI[m.id]) && MORFIS[0].precio === 0 && DULCES[0].precio === 0, 'la tienda vende pieles que existen, y la primera es gratis');
  const total = 30 * premio(-1, 3) + 3 * 50, precios = [...MORFIS, ...DULCES].reduce((a, p) => a + p.precio, 0);
  nota(`las tres cajas con todas las estrellas dan ${total} monedas; la tienda entera cuesta ${precios}`);
}

// ── los textos ─────────────────────────────────────────────────────────────
{
  const faltan = Object.entries(TABLA).filter(([, f]) => f.length !== IDIOMAS.length || f.some((s) => typeof s !== 'string' || !s.trim())).map(([k]) => k);
  ok(!faltan.length, 'cada texto está en los tres idiomas', faltan.join());
  const llaves = Object.entries(TABLA).filter(([, f]) => new Set(f.map((s) => s.includes('{n}'))).size > 1).map(([k]) => k);
  ok(!llaves.length, 'el {n} está en los tres o en ninguno', llaves.join());
  const ayudas = NIVELES.map((n) => n.ayuda).filter(Boolean);
  ok(ayudas.length >= 8 && ayudas.every((k) => TABLA[k]), 'las ayudas de los niveles tienen su texto', ayudas.join());
  ok([...MORFIS.map((m) => 'morfi_' + m.id), ...DULCES.map((d) => 'caramelo_' + d.id), ...CAJAS.map((c) => 'caja_' + c.id)].every((k) => TABLA[k]), 'cada cosa de la tienda y cada caja tiene nombre');
}

console.log(`\n${mal ? 'FALLAN ' + mal : 'todo bien'}: ${bien + mal} comprobaciones, ${bien} bien`);
process.exit(mal ? 1 : 0);

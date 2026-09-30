// Las pruebas sin navegador: los 30 niveles, la torre, los textos y la música.
//   node cripta/pruebas/niveles.mjs
//
// Un nivel pasa si se gana, si se alcanzan sus 3 estrellas, todas sus monedas
// y todas sus chispas (el "todo limpio" tiene que ser posible), si no hay
// ningún lugar al que se llegue vivo y del que ya no se salga, y si ningún
// deslizamiento da vueltas para siempre.
import { NIVELES } from '../js/niveles.js';
import { leer } from '../js/reglas.js';
import { resolver } from '../js/resolver.js';
import { Torre } from '../js/infinito.js';
import { TABLA, CLAVES } from '../js/idioma.js';
import { soporta } from '../js/fuente.js';
import { CANCIONES, midi } from '../js/sonido.js';

let fallas = 0, pruebas = 0;
const ok = (cond, msj) => { pruebas++; if (!cond) { fallas++; console.log('  FALLA:', msj); } };

// ── los niveles ────────────────────────────────────────────────────────────
console.log('niveles');
const ids = new Set();
for (const [i, def] of NIVELES.entries()) {
  ok(!ids.has(def.id), `${def.id} repetido`); ids.add(def.id);
  ok(def.id === `${def.mundo + 1}-${(i % 10) + 1}`, `${def.id} fuera de orden (posición ${i})`);
  let nv;
  try { nv = leer(def); } catch (e) { ok(false, `${def.id}: ${e.message}`); continue; }
  ok(nv.ancho <= 16, `${def.id}: ${nv.ancho} de ancho (el máximo es 16)`);
  ok(new Set(def.mapa.map((f) => f.length)).size === 1, `${def.id}: filas de distinto largo`);
  ok(nv.salida, `${def.id}: no tiene salida`);
  const r = resolver(nv);
  ok(r.gana, `${def.id}: no se puede ganar`);
  ok(r.trampas.length === 0, `${def.id}: ${r.trampas.length} lugares sin salida (${r.trampas.slice(0, 3).join(' ')})`);
  ok(r.bucles === 0, `${def.id}: ${r.bucles} deslizamientos que no terminan`);
  ok(r.estrellasHay === 3 && r.estrellas === 3, `${def.id}: estrellas ${r.estrellas}/${r.estrellasHay}`);
  ok(r.monedas === r.monedasHay, `${def.id}: monedas ${r.monedas}/${r.monedasHay}`);
  ok(r.chispas === r.chispasHay, `${def.id}: chispas ${r.chispas}/${r.chispasHay}`);
  if (def.aviso) ok(TABLA[def.aviso], `${def.id}: el aviso ${def.aviso} no tiene texto`);
  console.log(`  ${def.id.padEnd(5)} ${String(nv.ancho).padStart(2)}×${String(nv.alto).padEnd(3)} mínimo ${String(r.minimo).padStart(2)} · ${r.estados} estados · ${r.chispasHay} chispas · ${r.monedasHay} monedas`);
}
ok(NIVELES.length === 30, `hay ${NIVELES.length} niveles (tienen que ser 30)`);
for (let m = 0; m < 3; m++) ok(NIVELES.filter((n) => n.mundo === m).length === 10, `el mundo ${m + 1} no tiene 10 niveles`);

// ── la torre: muchas semillas, cada una resuelta ───────────────────────────
console.log('torre');
const t0 = Date.now();
let sinSalida = 0, conTrampas = 0, atascos = 0, bucles = 0;
const SEMILLAS = 300;
for (let s = 1; s <= SEMILLAS; s++) {
  const t = new Torre({ semilla: s, ancho: 15, alto: 260, finito: true });
  t.asegurar(0);
  const r = resolver(t.nv);
  if (!r.gana || !t.terminado) sinSalida++;
  if (r.trampas.length) conTrampas++;
  if (r.bucles) bucles++;
  if (t.atascos) atascos++;
}
ok(sinSalida === 0, `torre: ${sinSalida}/${SEMILLAS} semillas sin camino hasta arriba`);
ok(conTrampas === 0, `torre: ${conTrampas}/${SEMILLAS} semillas con lugares sin salida`);
ok(bucles === 0, `torre: ${bucles} semillas con bucles`);
console.log(`  ${SEMILLAS} torres de 260 filas resueltas en ${Date.now() - t0} ms (tramos forzados en ${atascos})`);
// la infinita, como se juega: generando de a pedazos hacia arriba
{
  const t = new Torre({ semilla: 99 });
  let pedida = t.nv.alto;
  for (let y = t.nv.alto - 60; y > 200; y -= 37) { t.asegurar(y); pedida = y; }
  ok(t.hasta <= pedida, `la torre infinita se trabó en la fila ${t.hasta} (se pidió hasta la ${pedida})`);
  ok(!t.terminado, 'la torre infinita se terminó sola');
}

// ── los textos: tres idiomas y todas las letras dibujadas ─────────────────
console.log('textos');
for (const k of CLAVES) {
  const fila = TABLA[k];
  ok(fila.length === 3 && fila.every((s) => typeof s === 'string' && s.length), `texto ${k}: le falta algún idioma`);
  for (const s of fila) for (const c of s.replace(/\n/g, '').replace(/\{n\}/g, '').toUpperCase()) ok(soporta(c), `texto ${k}: la letra '${c}' no tiene dibujo`);
}
console.log(`  ${CLAVES.length} textos × 3 idiomas`);

// ── la música: 16 pasos por compás y notas que existen ────────────────────
console.log('música');
for (const [nombre, c] of Object.entries(CANCIONES)) {
  for (const p of ['bajo', 'arpegio', 'bombo', 'caja', 'hat']) ok(c[p].length === 16, `${nombre}.${p} tiene ${c[p].length} pasos`);
  for (const [raiz] of c.acordes) ok(Number.isFinite(midi(raiz)), `${nombre}: acorde ${raiz}`);
  for (const [k, compas] of c.melodia.entries()) {
    const fichas = compas.split(' ');
    ok(fichas.length === 16, `${nombre}: el compás ${k + 1} de la melodía tiene ${fichas.length} pasos`);
    for (const f of fichas) if (f !== '-' && f !== '.') ok(/^[A-G][#b]?\d$/.test(f), `${nombre}: nota rara '${f}'`);
  }
}
console.log(`  ${Object.keys(CANCIONES).length} canciones`);

console.log(fallas ? `\n${fallas} de ${pruebas} comprobaciones fallaron` : `\n${pruebas} comprobaciones, todas bien`);
process.exit(fallas ? 1 : 0);

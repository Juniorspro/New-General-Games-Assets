// Que cada mundo de BRILLO se pueda recorrer entero con la física de verdad:
// de la salida a la primera sesión, de sesión en sesión y hasta el orbe; y
// cada guiño, desde la sesión de antes. Además, lo que tiene que estar
// cerrado: sin el zumbido no se pasa la pared gris de la Colina.
//     node brillo/pruebas/recorrido.mjs [mundo] [--guardar]
// Con --guardar deja las soluciones en pruebas/recorridos/<mundo>.json (las
// usa la prueba de la partida entera).
import fs from "node:fs";
import path from "node:path";
import { NIVELES, ORDEN } from "../js/niveles.js";
import { crearMundo, paso, copiar, modoResolvedor } from "../js/fisica.js";
import { resolver, ACCIONES, K, entradaDe } from "./resolver.mjs";

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const solo = process.argv.slice(2).find((a) => !a.startsWith("--"));
const guardar = process.argv.includes("--guardar");
const carpeta = path.join(AQUI, "recorridos");
/* pistas: puntos de paso para los tramos que el resolvedor no adivina solo. Clave "mundo:tramo" */
const PISTAS = {};
/* lo que no se tiene que poder: [mundo, desde (índice de sesión o 'inicio'), meta, habilidades a sacar] */
const CERRADO = {
  colina: [{ desde: 'inicio', meta: { x: 60 * 16, y: 21 * 16 }, sin: ['zumbido'], por: 'la pared gris sin el zumbido' }],
};
let fallas = 0;
for (const id of ORDEN) {
  if (solo && id !== solo) continue;
  const N = NIVELES[id], m0 = crearMundo(N);
  const paradas = [{ x: m0.inicio.x, y: m0.inicio.y, id: null, nombre: 'inicio' }, ...m0.sesiones.map((s) => ({ ...s, nombre: s.id })), { x: m0.salida.x, y: m0.salida.y, nombre: 'orbe' }];
  const sols = {};
  /* fotos del camino principal (cada 4 acciones, paradas en el piso): de ahí salen los guiños */
  const fotos = [];
  const sacarFotos = (desde, acciones) => {
    const m = modoResolvedor(crearMundo(N, { en: desde }));
    let prev = null;
    acciones.forEach((ai, i) => {
      for (let f = 0; f < K; f++) { paso(m, entradaDe(ACCIONES[ai], f, prev)); m.eventos.length = 0; }
      prev = ACCIONES[ai];
      if (i % 4 === 0 && m.p.enSuelo && !m.p.muerto) fotos.push(copiar(m));
    });
  };
  for (let i = 0; i + 1 < paradas.length; i++) {
    const a = paradas[i], b = paradas[i + 1];
    const t0 = Date.now();
    let desde = i === 0 ? null : { x: a.x, y: a.y, id: a.id };
    let acciones = [], ok = true, expl = 0;
    const pistas = PISTAS[`${id}:${i}`] || [];
    let mundo = null;
    for (const meta of [...pistas, { x: b.x, y: b.y }]) {
      const r = resolver(N, { desde, meta, mundo, max: 400000 });
      expl += r.explorados;
      if (!r.ok) { ok = false; break; }
      acciones = acciones.concat(r.acciones); mundo = r.mundo;
    }
    const s = ((Date.now() - t0) / 1000).toFixed(1);
    if (ok) { console.log(`ok   ${id} ${a.nombre} → ${b.nombre}: ${acciones.length} acciones · ${expl} estados, ${s} s`); sols[`${a.nombre}>${b.nombre}`] = acciones; if (!pistas.length) sacarFotos(desde, acciones); }
    else { console.log(`MAL  ${id} ${a.nombre} → ${b.nombre}: no encontró camino (${expl} estados, ${s} s)`); fallas++; }
  }
  /* cada guiño, desde la parada de antes */
  for (const g of m0.guinos) {
    /* desde la foto del camino que pasa más cerca (en x) del guiño, probando varias */
    const cerca = fotos.filter((f) => Math.abs(f.p.x - g.x) < 220).sort((a, b) => Math.abs(a.p.x - g.x) - Math.abs(b.p.x - g.x)).slice(0, 4);
    const t0 = Date.now();
    let r = { ok: false, explorados: 0 }, usada = null;
    for (const f of cerca) {
      const mf = copiar(f); mf.guinos = crearMundo(N).guinos.filter((q) => q.id === g.id); mf.juntadas = new Set();
      const q = resolver(N, { mundo: mf, meta: { guino: g.id }, max: 120000 });
      r = { ok: q.ok, explorados: r.explorados + q.explorados }; usada = f;
      if (q.ok) break;
    }
    const s = ((Date.now() - t0) / 1000).toFixed(1);
    const dsd = usada ? `x=${Math.round(usada.p.x)}` : 'ninguna foto';
    if (r.ok) console.log(`ok   ${id} guiño ${g.id} desde ${dsd}: se agarra · ${r.explorados} estados, ${s} s`);
    else { console.log(`MAL  ${id} guiño ${g.id} desde ${dsd}: no se alcanza (${r.explorados} estados)`); fallas++; }
  }
  /* lo cerrado */
  for (const c of CERRADO[id] || []) {
    const habil = {}; for (const h of c.sin) habil[h] = false;
    const N2 = { ...N, da: {} };
    const r = resolver(N2, { desde: null, meta: c.meta, habil, max: 150000 });
    if (r.ok) { console.log(`MAL  ${id} se pasa ${c.por}`); fallas++; } else console.log(`ok   ${id} cerrado: ${c.por}`);
  }
  if (guardar) { fs.mkdirSync(carpeta, { recursive: true }); fs.writeFileSync(path.join(carpeta, id + '.json'), JSON.stringify(sols)); }
}
console.log(fallas ? `${fallas} cosas no andan` : 'BRILLO se recorre entero, y lo cerrado está cerrado');
process.exit(fallas ? 1 : 0);

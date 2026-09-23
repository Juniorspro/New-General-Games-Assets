// Que cada capítulo de KUNTUR se pueda recorrer entero con la física de verdad:
// de la salida a la primera apacheta, de apacheta en apacheta y hasta la
// llegada. En el tren se prueba cada tramo arrancando en varios momentos (las
// vigas no esperan) y en las persecuciones, con el puma o el viento atrás.
// Además, lo que tiene que estar cerrado: sin el aleteo no se cruza el hueco
// de las Salinas, sin el planeo no se baja a la Puna, sin Apu no abre la tranquera.
//     node kuntur/pruebas/recorrido.mjs [capítulo] [--guardar]
// Con --guardar deja las soluciones en pruebas/recorridos/<capítulo>.json (las
// usa la prueba de la partida entera, que las juega en el navegador).
import fs from "node:fs";
import path from "node:path";
import { NIVELES } from "../js/niveles.js";
import { crearMundo, pasarKilla } from "../js/fisica.js";
import { resolver } from "./resolver.mjs";

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const solo = process.argv.slice(2).find((a) => !a.startsWith("--"));
const guardar = process.argv.includes("--guardar");
const carpeta = path.join(AQUI, "recorridos");
let fallas = 0;
/* pistas: por dónde pasar en los tramos que el resolvedor no adivina solo
   (sobre todo, adónde llevar la piedra). La clave es "capítulo:tramo". */
const PISTAS = {
  'colores:1': [{ x: 40, y: 9 }, { x: 48.6, y: 9, cajaX: 49 }, { x: 49.5, y: 10, radio: 0.6 }, { x: 52, y: 14 }, { x: 60, y: 14 }],
  'colores:copla0': [{ x: 40, y: 9 }, { x: 48.6, y: 9, cajaX: 49 }, { x: 49.5, y: 10, radio: 0.6 }, { x: 52, y: 14 }, { x: 56.3, y: 14, radio: 0.4 }],
  'salinas:1': [{ x: 45, y: 5 }, { x: 70, y: 8 }, { x: 74, y: 8 }, { x: 84.6, y: 8, cajaX: 85 }, { x: 85.5, y: 9, radio: 0.6 }],
  'salinas:2': [{ x: 109, y: 13 }, { x: 111, y: 18 }, { x: 118, y: 18 }],
  'puna:2': [{ x: 64, y: 9 }, { x: 70.5, y: 10 }, { x: 79.5, y: 11 }, { x: 88.5, y: 10 }, { x: 97, y: 9 }, { x: 104, y: 9 }, { x: 108, y: 9 }],
  'puna:3': [{ x: 122, y: 12 }, { x: 126, y: 9 }, { x: 133, y: 9 }, { x: 150, y: 9 }, { x: 158, y: 12 }, { x: 172, y: 11 }, { x: 182, y: 14 }],
};
/* en el tren, arrancando justo cuando llega el túnel: primero esperarlo agachada
   (así se sobrevive; el resolvedor no ve solo que conviene esperar tanto) */
const AGACHADA_ANTES = { 'tren:0:21': 300 };
const ver = (ok, que) => { console.log((ok ? "ok   " : "MAL  ") + que); if (!ok) fallas++; };

for (const nivel of NIVELES) {
  if (solo && nivel.id !== solo) continue;
  if (nivel.id === "epilogo") continue;
  const m = crearMundo(nivel);
  const paradas = [{ x: m.inicio.x, y: m.inicio.y, id: -1, nombre: "salida" }]
    .concat(m.apachetas.map((a) => ({ x: a.x, y: a.y, id: a.id, nombre: "apacheta " + a.id })));
  const fin = m.salida ? { x: m.salida.x + 0.5, y: m.salida.y, nombre: "llegada" } : null;
  const metas = paradas.slice(1).concat(fin ? [fin] : []);
  const sal = [];
  for (let i = 0; i < metas.length; i++) {
    const desde = paradas[i], meta = metas[i];
    const fases = nivel.tren ? [0, 9.5, 21, 33] : [0];
    for (const fase of fases) {
      const t0 = Date.now();
      const subs = (PISTAS[nivel.id + ':' + i] || []).concat([{ x: meta.x, y: meta.y, radio: 1.2 }]);
      let mundo = null, r = null, acciones = [], explorados = 0;
      for (const sub of subs) {
        r = resolver(nivel, { desde, id: desde.id, mundo, meta: Object.assign({ radio: 1.2 }, sub), habil: nivel.habil, cajas: true, tocar: true, max: 250000, preparar: (mm) => { mm.tiempo = fase; for (let f = 0; f < (AGACHADA_ANTES[nivel.id + ':' + i + ':' + fase] || 0); f++) { pasarKilla(mm, { x: 0, y: f > 10 ? -1 : 0, salto: false, saltoE: false, accion: false, accionE: false }); mm.eventos.length = 0; } } });
        explorados += r.explorados;
        if (!r.ok) break;
        mundo = r.mundo; acciones = acciones.concat(r.acciones);
      }
      ver(r.ok, `${nivel.id.padEnd(8)} ${desde.nombre} → ${meta.nombre}${fases.length > 1 ? " (fase " + fase + " s)" : ""}  ${r.ok ? "en " + acciones.length * 6 + " cuadros" : "no se llega"} · ${explorados} estados, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      if (r.ok) sal.push({ desde, meta, fase, acciones });
    }
  }
  /* cada copla se puede agarrar, saliendo de la apacheta de antes */
  if (!process.argv.includes("--sin-coplas")) m.coplas.forEach((c, ci) => {
    const desde = paradas.filter((q) => q.x <= c.x + 0.01).pop();
    const t0 = Date.now();
    const subs = (PISTAS[nivel.id + ':copla' + ci] || []).concat([{ x: c.x, y: c.y - 0.5, copla: ci }]);
    let mundo = null, r = null, explorados = 0;
    for (const sub of subs) {
      r = resolver(nivel, { desde, id: desde.id, mundo, meta: Object.assign({ radio: 1.2 }, sub), habil: nivel.habil, cajas: true, tocar: true, max: 200000 });
      explorados += r.explorados;
      if (!r.ok) break;
      mundo = r.mundo;
    }
    ver(r.ok, `${nivel.id.padEnd(8)} copla ${ci + 1} (${c.x}, ${c.y}) desde ${desde.nombre}: ${r.ok ? "se agarra" : "no se llega"} · ${explorados} estados, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  });
  if (guardar) { fs.mkdirSync(carpeta, { recursive: true }); fs.writeFileSync(path.join(carpeta, nivel.id + ".json"), JSON.stringify(sal)); }
}
/* lo que tiene que estar cerrado */
const cerrado = (id, desde, meta, habil, que) => {
  const nivel = NIVELES.find((n) => n.id === id);
  if (solo && solo !== id) return;
  const n2 = Object.assign({}, nivel, { da: {} });
  const r = resolver(n2, { desde, meta, habil, cajas: true, tocar: true, max: 120000 });
  ver(!r.ok, `${id.padEnd(8)} ${que}: ${r.ok ? "¡SE PUEDE! (mal)" : "no se puede"} · ${r.explorados} estados`);
};
cerrado("salinas", { x: 88.5, y: 13 }, { x: 106, y: 13, radio: 1.5 }, {}, "sin el aleteo, el hueco de sal");
cerrado("puna", { x: 38.5, y: 12 }, { x: 56.5, y: 9, radio: 1.5 }, { aleteo: true }, "sin el planeo, la bajada");
cerrado("puna", { x: 104.5, y: 9 }, { x: 116.5, y: 9, radio: 1.5 }, { aleteo: true, planeo: true }, "sin llamar a Apu, la tranquera");
if (guardar) console.log("guardado en pruebas/recorridos/");
console.log(fallas ? `${fallas} tramo(s) mal` : "KUNTUR se recorre entero, y lo cerrado está cerrado");
process.exit(fallas ? 1 : 0);

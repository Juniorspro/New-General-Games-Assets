// La partida entera de KUNTUR, jugada en el navegador (Chromium sin pantalla):
// elige el idioma, empieza el viaje y juega cada capítulo con las soluciones
// del resolvedor (pruebas/recorridos/*.json), pasando por todas las charlas,
// las escenas y los cambios de capítulo, hasta los créditos.
//     node kuntur/herramientas/armar.mjs && node kuntur/pruebas/partida.mjs [salida-de-fotos] [capítulo]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const fotos = process.argv[2] || null, solo = process.argv[3] || null;
if (fotos) fs.mkdirSync(fotos, { recursive: true });
const ORDEN = ["prologo", "colores", "salinas", "tren", "puna", "nevado", "epilogo"];
const SOL = {};
for (const id of ORDEN) { const f = path.join(AQUI, "recorridos", id + ".json"); SOL[id] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : []; }
const RES = fs.readFileSync(path.join(AQUI, "resolver.mjs"), "utf8");
const ACC = RES.slice(RES.indexOf("export const ACCIONES = ["), RES.indexOf("];", RES.indexOf("export const ACCIONES = [")) + 2).replace("export const ", "window.");

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const pag = await nav.newPage({ viewport: { width: 480, height: 270 } });
const errores = [];
pag.on("pageerror", (e) => errores.push("pageerror: " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 4).join("\n")));
pag.on("console", (m) => { if (m.type() === "error") errores.push("console: " + m.text().slice(0, 300)); });
await pag.goto("file://" + path.resolve(AQUI, "../kuntur.html") + "?cal=baja");
await pag.waitForTimeout(1200);
await pag.keyboard.press("Enter");
await pag.waitForTimeout(3000);
await pag.evaluate(ACC);
let fallas = 0;
const ver = (ok, que) => { console.log((ok ? "ok   " : "MAL  ") + que); if (!ok) fallas++; };

/* en la página: pasos de física de a uno, atendiendo charlas y narraciones */
await pag.evaluate(() => {
  const d = window.__K; d.congelado = true;
  /* el resolvedor a veces aprieta "arriba" al lado de un vecino: acá no se charla con ellos
     (el pasito atrás para verse las caras movería a Killa del camino resuelto) */
  d.sinVecinos = true;
  /* si una escena camina a Killa (para que no quede encima de alguien), al terminar
     se la devuelve adonde estaba: así sigue el camino resuelto tal cual */
  let foto = null;
  d.alCine = (on, c) => {
    const p = c.m.p;
    if (on) foto = { p: JSON.parse(JSON.stringify(p)), tiempo: c.m.tiempo };
    else if (foto) { const f = foto; foto = null; for (const k of Object.keys(f.p)) p[k] = f.p[k]; if (p.caja) p.caja = null; c.m.tiempo = f.tiempo; }
  };
  const esperarUI = () => new Promise((r) => setTimeout(r, 0));
  window.__pasos = async (n, alPaso) => {
    for (let i = 0; i < n; i++) {
      if (d.ui.narrando) { d.ui.narrando(); await new Promise((r) => setTimeout(r, 30)); continue; }
      if (d.charlaActual && i % 3 === 0) d.Entrada.EDGE.aceptar = true;
      d.logica(1 / 60);
      if (alPaso && alPaso()) return true;
      if (i % 20 === 0) await esperarUI();
    }
    return false;
  };
  window.__esperar = async (fn, max) => { for (let i = 0; i < (max || 4000); i++) { if (fn()) return true; await window.__pasos(1); if (i % 30 === 0) await new Promise((r) => setTimeout(r, 15)); } return false; };
});

for (const id of ORDEN) {
  if (solo && id !== solo) continue;
  const t0 = Date.now();
  /* entrar al capítulo */
  await pag.evaluate(async (id) => {
    const d = window.__K;
    if (!d.cap || d.cap.id !== id) {
      if (!d.partida) d.partida = { cap: id, en: null, coplas: [], llegados: [id] };
      d.jugar(id, null);
    }
    await window.__esperar(() => d.cap && d.cap.id === id && d.estado === 'juego' && !d.cap.quieta && !d.ui.narrando && !d.charlaActual, 6000);
  }, id);
  /* los tramos, de apacheta en apacheta */
  const porTramo = {};
  for (const s of SOL[id]) { const k = s.desde.nombre + '>' + s.meta.nombre; (porTramo[k] = porTramo[k] || []).push(s); }
  const tramos = Object.values(porTramo);
  /* el epílogo no tiene tramos: caminar hasta la casa */
  if (!tramos.length) await pag.evaluate(async () => { const c = window.__K.cap; c.guion = () => ({ x: 1, y: 0, salto: false, saltoE: false, accion: false, accionE: false }); await window.__pasos(900, () => c.quieta || window.__K.charlaActual); c.guion = null; });
  for (const alts of tramos) {
    const r = await pag.evaluate(async (alts) => {
      const d = window.__K, c = d.cap;
      await window.__esperar(() => !d.charlaActual && !c.quieta, 3000);
      const s0 = alts[0], m = c.m, p = m.p;
      /* se pone justo donde arrancó el resolvedor (en la apacheta), quieta */
      Object.assign(p, { x: s0.desde.x, y: s0.desde.y, vx: 0, vy: 0, estado: 'normal', colgado: null, trepa: null, caja: null, agachada: false, h: 1.3, enSuelo: true, saltoUsado: false, planeando: false, planeoArmado: false, muerta: false });
      /* en el tren, la fase de las vigas que corresponde a una de las soluciones */
      let s = s0;
      /* el reloj del mundo (las vigas del tren, las ráfagas del viento) como lo tenía el resolvedor */
      m.tiempo = s.fase || 0;
      const A = window.ACCIONES, acc = s.acciones;
      let i = 0, f = 0, prev = null;
      c.guion = () => {
        if (i >= acc.length) return { x: 0, y: 0, salto: false, saltoE: false, accion: false, accionE: false };
        const a = A[acc[i]];
        const sigueSalto = prev && prev.salto && a.salto, sigueMano = prev && prev.accion && a.accion;
        const e = { x: a.x || 0, y: a.y || 0, salto: !!(a.salto || (a.corto && f === 0)), saltoE: !!((a.corto || (a.salto && !sigueSalto)) && f === 0), accion: !!(a.accion || (a.toca && f === 0)), accionE: !!((a.toca || (a.accion && !sigueMano)) && f === 0) };
        f++; if (f >= 6) { f = 0; prev = a; i++; }
        return e;
      };
      let muertes = 0; const antes = d.cap;
      const fin = await window.__pasos(acc.length * 6 + 2400, () => { if (m.p.muerta) muertes++; return d.cap !== antes || d.estado === 'cargando' || (i >= acc.length && Math.abs(m.p.x - s.meta.x) < 1.5 && Math.abs(m.p.y - s.meta.y) < 2.6) || m.p.muerta; });
      c.guion = null;
      return { llego: fin && !m.p.muerta, cambio: d.cap !== antes || d.estado === 'cargando', x: +m.p.x.toFixed(2), y: +m.p.y.toFixed(2), muerta: m.p.muerta, causa: m.p.causa, meta: s.meta.nombre, i, n: acc.length };
    }, alts);
    ver(r.llego || r.cambio, `${id.padEnd(8)} ${alts[0].desde.nombre} → ${r.meta}: ${r.llego || r.cambio ? 'llegó' : 'NO llegó'} (${r.x}, ${r.y})${r.muerta ? ' se apagó por ' + r.causa : ''} [${r.i}/${r.n}]`);
    if (r.cambio) break;
  }
  if (fotos) await pag.evaluate(() => window.__K.pintar()), await pag.screenshot({ path: `${fotos}/${id}.png` });
  /* seguir caminando hasta la llegada (el resolvedor para apenas entra en el radio) */
  await pag.evaluate(async () => { const d = window.__K, c = d.cap; if (!c) return; c.guion = () => ({ x: 1, y: 0, salto: false, saltoE: false, accion: false, accionE: false }); await window.__pasos(240, () => d.cap !== c || c.quieta); c.guion = null; });
  /* terminar el capítulo: esperar la escena del final y el cambio */
  const sig = ORDEN[ORDEN.indexOf(id) + 1];
  const r = await pag.evaluate(async (sig) => {
    const d = window.__K;
    const ok = await window.__esperar(() => sig ? (d.cap && d.cap.id === sig) : (d.estado === 'creditos' || d.estado === 'titulo'), 9000);
    return { ok, estado: d.estado, cap: d.cap && d.cap.id, x: d.cap && d.cap.m.p.x };
  }, sig || null);
  ver(r.ok, `${id.padEnd(8)} termina y ${sig ? 'arranca ' + sig : 'van los créditos'} (${((Date.now() - t0) / 1000).toFixed(0)} s)${r.ok ? '' : ' — quedó en ' + JSON.stringify(r)}`);
  if (!r.ok) break;
}
const coplas = await pag.evaluate(() => (window.__K.partida.coplas || []).length);
console.log("coplas juntadas en el camino:", coplas);
if (errores.length) { console.log(errores.join("\n")); fallas++; }
console.log(fallas ? `${fallas} problema(s)` : "la partida entera anda, de la granizada a los créditos");
await nav.close();
process.exit(fallas ? 1 : 0);

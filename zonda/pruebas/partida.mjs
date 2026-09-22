// Repite en el juego de verdad (el HTML armado, en Chromium) la solución que
// encontró el resolvedor para cada sala, cuadro por cuadro, y comprueba que
// Ayelén sale. Si el resolvedor y el juego no dieran lo mismo, esto lo dice.
//
//     node zonda/pruebas/partida.mjs [carpeta de capturas]
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");

const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const capturas = process.argv[2];
if (capturas) fs.mkdirSync(capturas, { recursive: true });
const sol = JSON.parse(fs.readFileSync(path.join(AQUI, "pruebas/soluciones.json"), "utf8"));
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pag = await nav.newPage({ viewport: { width: 412, height: 892 } });
const errores = [];
pag.on("pageerror", (e) => errores.push(e.message));
pag.on("console", (m) => { if (m.type() === "error") errores.push(m.text().slice(0, 200)); });
await pag.goto("file://" + path.join(AQUI, "zonda.html") + "?fijo");
await pag.waitForFunction(() => window.__Z && window.__Z.listo);

let bien = 0, mal = 0;
const salas = await pag.evaluate(() => window.__Z.CAPITULOS.map((c, ci) => c.salas.map((s, si) => ({ id: s.id, ci, si }))).flat());
for (const s of salas) {
  const r = sol[s.id];
  if (!r) { console.log(`--   ${s.id} sin solución guardada`); mal++; continue; }
  const cuadros = [];
  for (const a of r.acciones) for (let f = 0; f < r.k; f++) cuadros.push({ x: a.x, y: a.y, salto: !!a.salto, saltoE: !!(a.nuevo && f === 0), dashE: !!(a.dash && f === 0), agarre: !!a.agarre });
  const res = await pag.evaluate(({ ci, si, cuadros }) => {
    const Z = window.__Z;
    Z.empezar(ci, si, { sinDialogos: true });
    let n = 0;
    while (Z.sala().estado === "entra" && n++ < 400) Z.anda(1);
    Z.repetir(cuadros);
    let pasos = 0, mitad = null;
    while (pasos < cuadros.length + 400) {
      Z.anda(1); pasos++;
      const e = Z.sala();
      if (pasos === Math.floor(cuadros.length / 2)) mitad = true;
      if (e.muerta) return { ok: false, motivo: "murió", pasos, e };
      if (e.salio || e.cumbre) return { ok: true, pasos, e };
      if (Z.J.repeticion && Z.J.repeticion.length === 0 && pasos > cuadros.length + 60) return { ok: false, motivo: "se terminó la repetición sin salir", pasos, e };
    }
    return { ok: false, motivo: "no salió", pasos, e: Z.sala() };
  }, { ci: s.ci, si: s.si, cuadros });
  if (res.ok) { bien++; console.log(`ok   ${s.id}  ${res.pasos} pasos`); }
  else { mal++; console.log(`MAL  ${s.id}  ${res.motivo} a los ${res.pasos} pasos (x ${res.e.x}, y ${res.e.y})`); }
  if (capturas) {
    /* una captura a mitad de camino, repitiendo hasta ahí */
    await pag.evaluate(({ ci, si, cuadros }) => {
      const Z = window.__Z; Z.empezar(ci, si, { sinDialogos: true });
      let n = 0; while (Z.sala().estado === "entra" && n++ < 400) Z.anda(1);
      Z.repetir(cuadros.slice(0, Math.floor(cuadros.length * 0.55))); Z.anda(Math.floor(cuadros.length * 0.55));
    }, { ci: s.ci, si: s.si, cuadros });
    await pag.waitForTimeout(80);
    await pag.screenshot({ path: path.join(capturas, s.id + ".png") });
  }
}
console.log(`${bien} salas pasadas en el juego, ${mal} con problemas` + (errores.length ? `\nERRORES:\n${errores.join("\n")}` : " · sin errores de consola"));
await nav.close();
process.exit(mal ? 1 : 0);

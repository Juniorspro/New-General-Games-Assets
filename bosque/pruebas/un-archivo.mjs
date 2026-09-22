// El archivo único abierto con doble clic (file://): que cargue, que no pida
// nada afuera, que se pueda jugar y que no tire errores.
//
//     node pruebas/un-archivo.mjs
//
// file:// es el caso más estricto: el navegador no deja pedir ni un archivo
// de la carpeta de al lado. Si acá anda, anda en cualquier lado.
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const url = "file://" + path.join(AQUI, "bosque-en-un-archivo.html") + "?fijo";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const pag = await nav.newPage({ viewport: { width: 640, height: 360 } });
const errores = [], pedidos = [];
pag.on("pageerror", (e) => errores.push(e.message));
pag.on("console", (m) => { if (m.type() === "error") errores.push(m.text().slice(0, 200)); });
pag.on("request", (r) => { const u = r.url(); if (!u.startsWith("data:") && !u.startsWith("blob:") && u.split("?")[0] !== url.split("?")[0]) pedidos.push(u); });
let fallas = 0;
const ok = (c, q) => { console.log((c ? "  ok   " : "  MAL  ") + q); if (!c) fallas++; };
const t0 = Date.now();
await pag.goto(url);
await pag.waitForFunction(() => (window.__bosque && !document.getElementById("menu").hidden) || !document.getElementById("error").hidden, null, { timeout: 300000 });
const err = await pag.evaluate(() => document.getElementById("error").hidden ? null : document.getElementById("error").textContent);
ok(!err, "cargó hasta el menú" + (err ? ": " + err : ` en ${((Date.now() - t0) / 1000).toFixed(1)} s`));
if (!err) {
  const m = await pag.evaluate(() => ({ arboles: window.__bosque.medidas.arboles, alto: window.__bosque.medidas.altoCaminante, cintas: window.__bosque.cintas.lista.length }));
  ok(m.arboles > 3000 && m.cintas === 5 && m.alto > 1.6, `el mundo está entero (${m.arboles} árboles, ${m.cintas} cintas, caminante de ${m.alto.toFixed(2)} m)`);
  await pag.evaluate(() => document.getElementById("mJugar").click());
  await pag.keyboard.down("KeyW");
  const t = await pag.evaluate(() => window.__bosque.t);
  await pag.waitForFunction((t) => window.__bosque.t > t + 1.5, t, { timeout: 300000, polling: 200 });
  await pag.keyboard.up("KeyW");
  const v = await pag.evaluate(() => ({ z: window.__bosque.caminante.pos.z }));
  ok(v.z < 157.5, `camina (z 158 → ${v.z.toFixed(2)})`);
  await pag.screenshot({ path: path.join(AQUI, "pruebas", "un-archivo.png"), timeout: 240000 });
}
ok(pedidos.length === 0, pedidos.length ? `pidió cosas afuera: ${pedidos.slice(0, 3).join(", ")}` : "no pidió nada afuera del archivo");
ok(errores.length === 0, errores.length ? "errores: " + errores.slice(0, 3).join(" | ") : "sin errores");
console.log(fallas ? `\n${fallas} MAL` : "\ntodo bien");
await nav.close();
process.exit(fallas ? 1 : 0);

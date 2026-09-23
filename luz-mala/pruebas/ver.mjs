// Capturas de LUZ MALA como en un teléfono parado (412x892, táctil), sin
// errores de consola. Deja las capturas en la carpeta que se le pase.
//     node luz-mala/pruebas/ver.mjs <carpeta> [--compu]
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("/opt/node22/lib/node_modules/playwright");

const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const salida = process.argv[2] || "/tmp/luz-capturas";
const compu = process.argv.includes("--compu");
fs.mkdirSync(salida, { recursive: true });
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await nav.newContext(compu ? { viewport: { width: 1280, height: 720 } } : { ...devices["Pixel 7"], viewport: { width: 412, height: 892 }, deviceScaleFactor: 1 });
const pag = await ctx.newPage();
const errores = [];
pag.on("pageerror", (e) => errores.push("pageerror: " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 3).join("\n")));
pag.on("console", (m) => { if (m.type() === "error") errores.push("console: " + m.text().slice(0, 300)); });
await pag.goto("file://" + path.join(AQUI, "luz-mala.html") + "?fijo");
await pag.waitForFunction(() => window.__L && window.__L.listo, null, { timeout: 20000 });
const foto = async (n) => { await pag.waitForTimeout(150); await pag.screenshot({ path: path.join(salida, n + ".png") }); };
const anda = (n) => pag.evaluate((n) => window.__L.anda(n), n);
await pag.waitForTimeout(900); await foto("00-titulo");
const salas = [["P1", {}], ["R1", {}], ["R2", {}], ["A1", {}], ["T1", { habil: { aleteo: 1 } }], ["A2", { habil: { aleteo: 1 } }], ["H1", { habil: { aleteo: 1, resina: 1 }, estado: { viuda: 1 } }], ["H2", { habil: { aleteo: 1, resina: 1 } }], ["A3", { habil: { aleteo: 1, resina: 1 } }]];
let i = 1;
for (const [id, o] of salas) {
  await pag.evaluate(([id, o]) => window.__L.empezar(id, Object.assign({ sinCharlas: true }, o)), [id, o]);
  await anda(60);
  await foto(String(i++).padStart(2, "0") + "-" + id);
}
/* una pelea: entrar a la arena del Torito */
await pag.evaluate(() => window.__L.empezar("A1", { sinCharlas: true }));
await pag.evaluate(() => window.__L.poner(9 * 8, 15 * 8 - 4));
await anda(40); await foto("20-torito-presenta");
await anda(160); await foto("21-torito-pelea");
console.log(JSON.stringify(await pag.evaluate(() => window.__L.sala())));
console.log("medidas:", JSON.stringify(await pag.evaluate(() => window.__L.medidas())));
console.log(errores.length ? "ERRORES:\n" + errores.join("\n") : "sin errores de consola");
await nav.close();

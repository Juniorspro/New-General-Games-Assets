// Capturas de ZONDA como en un teléfono parado (412x892, táctil), sin errores
// de consola. Deja las capturas en la carpeta que se le pase.
//
//     node zonda/pruebas/ver.mjs /tmp/capturas
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("/opt/node22/lib/node_modules/playwright");

const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const salida = process.argv[2] || "/tmp/zonda-capturas";
fs.mkdirSync(salida, { recursive: true });
const url = "file://" + path.join(AQUI, "zonda.html") + "?fijo";

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await nav.newContext({ ...devices["Pixel 7"], viewport: { width: 412, height: 892 }, deviceScaleFactor: 1 });
const pag = await ctx.newPage();
const errores = [];
pag.on("pageerror", (e) => errores.push("pageerror: " + e.message));
pag.on("console", (m) => { if (m.type() === "error") errores.push("console: " + m.text().slice(0, 200)); });
await pag.goto(url);
await pag.waitForFunction(() => window.__Z && window.__Z.listo, null, { timeout: 20000 });
const foto = async (n) => { await pag.waitForTimeout(120); await pag.screenshot({ path: path.join(salida, n + ".png") }); };
const anda = (n) => pag.evaluate((n) => window.__Z.anda(n), n);

await anda(60); await foto("00-idioma");
await pag.click("#bIdioma_es"); await anda(20);
await anda(150); await foto("01-portada");
await pag.click("#bJugar"); await anda(60); await foto("02-tarjeta");
await anda(200); await foto("03-dialogo");
const salas = [[0, 0], [0, 2], [1, 0], [1, 2], [2, 1], [2, 3], [3, 0], [3, 4]];
let i = 4;
for (const [c, s] of salas) {
  await pag.evaluate(([c, s]) => window.__Z.empezar(c, s, { sinDialogos: true }), [c, s]);
  await anda(120);
  await foto(String(i++).padStart(2, "0") + "-sala-" + (c + 1) + "-" + (s + 1));
}
await pag.evaluate(() => window.__Z.entrada("pausa", true)); await anda(2); await pag.evaluate(() => window.__Z.entrada("pausa", false)); await anda(20);
await foto(String(i++).padStart(2, "0") + "-pausa");
await pag.click("#bPausaOpc"); await anda(20); await foto(String(i++).padStart(2, "0") + "-opciones");
const med = await pag.evaluate(() => window.__Z.medidas());
console.log("medidas:", JSON.stringify(med));
console.log(errores.length ? "ERRORES:\n" + errores.join("\n") : "sin errores de consola");
await nav.close();

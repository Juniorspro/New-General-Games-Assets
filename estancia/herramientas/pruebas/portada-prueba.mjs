import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errores = []; p.on("pageerror", (e) => errores.push(e.message));
await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
await p.goto("file://" + process.cwd() + "/estancia.html");
await p.waitForSelector("#menu:not([hidden])", { timeout: 180000 });
await p.waitForTimeout(3000);
let k = 0;
for (const t of [0, 10, 20, 31, 45, 63]) {
  await p.evaluate((t) => { E.juego.t = t; }, t); await p.waitForTimeout(900);
  await p.screenshot({ path: `tiras/pt-${String(k++).padStart(2, "0")}.png` });
}
console.log(errores.length ? errores.join("\n") : "sin errores");
await b.close();

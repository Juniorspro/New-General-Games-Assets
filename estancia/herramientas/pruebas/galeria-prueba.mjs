import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 800, height: 450 } });
const errores = []; p.on("pageerror", (e) => errores.push(e.message));
await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
await p.goto("file://" + process.cwd() + "/estancia.html#fijo");
await p.waitForSelector("#menu:not([hidden])", { timeout: 180000 });
await p.evaluate(() => { __juego.empezar(); __juego.congelar(true); __juego.hora(11); const J = __juego.J(); J.camara = "tercera"; __juego.ir(10, 50, 0, 0); });
let k = 0;
for (const [pos, mira] of [[[0.8, 1.6, 7], [-1.5, 0.8, 3.8]], [[-1.5, 3.2, 5.5], [-1.5, 0.7, 3.8]], [[-4.5, 1.4, 5.5], [-1.5, 0.8, 3.8]]]) {
  await p.evaluate(([pos, mira]) => { __juego.paso(1 / 30, 2); const R = E.lugares.rancho, y = E.terreno.altura(R.x, R.z); __juego.fotoDesde([R.x + pos[0], y + pos[1], R.z + pos[2]], [R.x + mira[0], y + mira[1], R.z + mira[2]]); }, [pos, mira]);
  await p.screenshot({ path: `tiras/ga-${String(k++).padStart(2, "0")}.png` });
}
console.log(errores.join("\n") || "sin errores");
await b.close();

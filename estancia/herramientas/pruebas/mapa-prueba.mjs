import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 1000, height: 560 } });
const errores = []; p.on("pageerror", (e) => errores.push(e.message));
await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
await p.goto("file://" + process.cwd() + "/estancia.html#fijo");
await p.waitForSelector("#menu:not([hidden])", { timeout: 180000 });
await p.evaluate(() => { __juego.empezar(); __juego.hora(10); const J = __juego.J(); J.camara = "tercera"; });
await p.waitForTimeout(600);
await p.keyboard.press("KeyM"); await p.waitForTimeout(1500);
await p.screenshot({ path: "tiras/ma-00.png" });
// elegir el comedero en la lista
await p.click("#mapaLista li:nth-child(3)"); await p.waitForTimeout(800);
await p.click("#mapaMas"); await p.click("#mapaMas"); await p.waitForTimeout(800);
await p.screenshot({ path: "tiras/ma-01.png" });
await p.click("#mapaCerrar"); await p.waitForTimeout(300);
await p.evaluate(() => { __juego.congelar(true); const J = __juego.J(); J.yaw = Math.PI * 0.8; __juego.paso(1 / 30, 3); __juego.foto(); });
await p.screenshot({ path: "tiras/ma-02.png" });
// el pueblo: abrir la tranquera y mirar
const r = await p.evaluate(() => { E.estancia.alternarEntrada(); const J = __juego.J(); __juego.ir(1, 380, 0, 0); J.prueba = { az: 1 }; __juego.paso(1 / 30, 30 * 8); return [J.x.toFixed(1), J.z.toFixed(1)]; });
console.log("después de caminar 8 s por la tranquera:", r);
const fotos = [[[14, 3.5, 420], [-8, 1.5, 445]], [[5, 2, 452], [-14, 2.5, 460]], [[-3, 1.8, 430], [14, 1.5, 440]]];
let k = 3;
for (const [pos, mira] of fotos) { await p.evaluate(([pos, mira]) => { __juego.paso(1 / 30, 2); const y = E.terreno.altura(0, 445); __juego.fotoDesde([pos[0], y + pos[1], pos[2]], [mira[0], y + mira[1], mira[2]]); }, [pos, mira]); await p.screenshot({ path: `tiras/ma-0${k++}.png` }); }
console.log(errores.join("\n") || "sin errores");
await b.close();

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errores = []; p.on("pageerror", (e) => errores.push(e.message));
await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
await p.goto("file://" + process.cwd() + "/estancia.html#fijo");
await p.waitForSelector("#menu:not([hidden])", { timeout: 180000 });
await p.screenshot({ path: "tiras/w-menu.png" });
await p.evaluate(() => { __juego.empezar(); __juego.congelar(true); });
const y = (x, z) => `E.terreno.altura(${x}, ${z})`;
const tomas = [
  ["rancho", 10, 3, 6, 38, [0, 1.8, 22], 10],
  ["galeria", 11, 3, 1.6, 27.5, [-1.5, 0.9, 25.5], 10],
  ["fogon-noche", 21, 16, 1.7, 40, [11, 0.6, 36], 21.5],
  ["corral", 20, 25, 3.5, -12, [45, 1, 8], 9],
  ["tranquera-corral", 22, 26, 1.8, 10, [30, 1, 8], 16],
  ["tanque", 23, -24, 2.2, 6, [-36, 1, -6], 11],
  ["alambrado", 24, 20, 1.6, 380, [0, 1, 391], 17],
  ["estero", 25, -120, 2, -130, [-165, 0, -175], 18.3],
  ["monte", 26, 150, 1.7, -140, [155, 3, -150], 12],
  ["chata", 27, -4, 1.7, 30, [-9.5, 1, 25], 15],
  ["rollos", 28, 36, 1.7, -2, [40, 0.7, -6.5], 15],
  ["noche-cielo", 29, 5, 1.7, 45, [0, 12, 0], 23],
  ["amanecer", 30, 20, 1.7, 45, [60, 5, 45], 6.3],
  ["siesta-calor", 31, 60, 1.7, 45, [120, 1, 60], 14],
];
for (const [n, , cx, cy, cz, mira, hora] of tomas) {
  await p.evaluate(([cx, cy, cz, mira, hora]) => {
    const j = __juego; j.hora(hora); const J = j.J(); J.x = cx; J.z = cz; J.camara = "primera";
    j.paso(1 / 30, 3);
    const g = E.terreno.altura(cx, cz);
    j.fotoDesde([cx, g + cy, cz], mira);
  }, [cx, cy, cz, mira, hora]);
  await p.screenshot({ path: `tiras/w-${n}.png` });
}
console.log(errores.length ? errores.join("\n") : "sin errores");
await b.close();

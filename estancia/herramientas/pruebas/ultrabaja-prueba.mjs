import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errores = [];
// 1) la misma escena en alta y en ultra baja
let p = await b.newPage({ viewport: { width: 800, height: 450 } });
p.on("pageerror", (e) => errores.push(e.message));
await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
await p.goto("file://" + process.cwd() + "/estancia.html#fijo");
await p.waitForSelector("#menu:not([hidden])", { timeout: 180000 });
await p.evaluate(() => { __juego.empezar(); __juego.congelar(true); __juego.hora(10); });
for (const [nivel, h] of [["alta", 10], ["ultrabaja", 10], ["ultrabaja", 20.5], ["alta", 20.5]]) {
  const r = await p.evaluate(([nivel, h]) => {
    E.calidad.aplicar(nivel); __juego.hora(h); __juego.paso(1 / 30, 3);
    const R = E.lugares.rancho, y = E.terreno.altura(R.x, R.z);
    __juego.fotoDesde([R.x + 9, y + 2.2, R.z + 14], [R.x - 1, y + 1.2, R.z + 2]);
    return { sombras: E.motor.renderer.shadowMap.enabled, quieto: E.flora.quieto, relleno: E.motor.relleno.intensity.toFixed(2), pasto: E.flora.pasto.count, tri: E.motor.renderer.info.render.triangles };
  }, [nivel, h]);
  await p.screenshot({ path: `tiras/ub-${nivel}-${h}.png` }); console.log(nivel, h, JSON.stringify(r));
}
await p.close();
// 2) el escaneo: en SwiftShader tiene que elegir ultra baja y dejar tocar otro nivel
p = await b.newPage({ viewport: { width: 800, height: 450 } });
p.on("pageerror", (e) => errores.push(e.message));
await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
await p.goto("file://" + process.cwd() + "/estancia.html");
await p.waitForSelector("#escaneoSeguir:not([hidden])", { timeout: 300000 });
await p.screenshot({ path: "tiras/ub-escaneo.png" });
const elegido0 = await p.evaluate(() => E.calidad.nivel);
await p.click('#escaneoNiveles li[data-n="baja"]'); await p.waitForTimeout(300);
const elegido1 = await p.evaluate(() => E.calidad.nivel);
await p.click('#escaneoNiveles li[data-n="ultrabaja"]'); await p.click("#escaneoSeguir");
await p.waitForSelector("#menu:not([hidden])", { timeout: 60000 });
console.log("escaneo eligió:", elegido0, "| tocado baja:", elegido1, "| guardado:", await p.evaluate(() => JSON.parse(localStorage.getItem("estancia-opciones")).calidad));
console.log(errores.join("\n") || "sin errores");
await b.close();

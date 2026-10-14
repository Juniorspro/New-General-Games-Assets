import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 800, height: 450 } });
const errores = []; p.on("pageerror", (e) => errores.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
await p.goto("file://" + process.cwd() + "/estancia.html#fijo");
await p.waitForSelector("#menu:not([hidden])", { timeout: 180000 });
const info = await p.evaluate(() => {
  __juego.empezar(); __juego.congelar(true); __juego.hora(9.5); E.calidad.aplicar("alta");
  const R = E.rodeo, g = R.grupos[0], J = __juego.J(); J.camara = "tercera"; J.prueba = { az: 0 };
  __juego.ir(g.x - 30, g.z - 30, Math.PI * 0.75 + Math.PI, -0.08);
  const t0 = performance.now(); for (let i = 0; i < 60; i++) R.actualizar(1 / 30, i / 30, J, 9.5); const ms = (performance.now() - t0) / 60;
  const n = (k) => R.lista.filter((a) => a.k === k).length;
  window.G0 = g;
  return { vacas: n("vaca"), toros: n("toro"), terneros: n("ternero"), grupos: R.grupos.length, msPorCuadro: ms.toFixed(2) };
});
console.log(JSON.stringify(info));
let k = 0;
const foto = async (prep, pasos, off, mira) => {
  const r = await p.evaluate(([prep, pasos, off, mira]) => {
    eval(prep); __juego.paso(1 / 30, pasos);
    const g = window.G0, y = E.terreno.altura(g.x, g.z);
    __juego.fotoDesde([g.x + off[0], y + off[1], g.z + off[2]], [g.x + mira[0], y + mira[1], g.z + mira[2]]);
    const cerca = E.rodeo.lista.filter((a) => a.cuerpo).length;
    return `modelos cerca ${cerca}, tri ${E.motor.renderer.info.render.triangles}`;
  }, [prep, pasos, off, mira]);
  await p.screenshot({ path: `tiras/ro-${String(k++).padStart(2, "0")}.png` }); console.log(r);
};
await foto("0", 30, [-70, 35, -70], [0, 0, 0]);
await foto("0", 30, [-45, 3, -45], [0, 1, 0]);
await foto("const J=__juego.J(); J.x = window.G0.x - 8; J.z = window.G0.z - 8", 40, [-14, 2.2, -14], [0, 0.8, 0]);
await foto("0", 20, [-6, 1.4, -6], [3, 0.7, 3]);
await foto("__juego.hora(14)", 200, [-40, 12, -40], [0, 0, 0]);
console.log(errores.join("\n") || "sin errores");
await b.close();

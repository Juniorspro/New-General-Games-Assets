import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 800, height: 450 } });
const errores = []; p.on("pageerror", (e) => errores.push(e.message)); p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errores.push(m.text()); });
await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
await p.goto("file://" + process.cwd() + "/estancia.html#fijo");
await p.waitForSelector("#menu:not([hidden])", { timeout: 180000 });
const info = await p.evaluate(() => {
  __juego.empezar(); __juego.congelar(true); __juego.hora(10);
  const A = __juego.A(), J = __juego.J();
  J.camara = "tercera"; J.prueba = { az: 0 };
  const X0 = 60, Z0 = 60; __juego.ir(X0, Z0 - 14, 0, 0);
  for (const v of A.vacas) { v.x += 300; }
  // una de cada raza en fila, un toro y dos terneros
  const razas = {}; for (const v of A.vacas) if (!v.toro && !v.ternero && !razas[v.tipo]) razas[v.tipo] = v;
  const fila = [...Object.values(razas), A.vacas.find((v) => v.toro), A.vacas.find((v) => v.ternero), A.vacas.filter((v) => v.ternero)[1]];
  fila.forEach((v, k) => { v.prueba = { v: 0 }; Object.assign(v, { x: X0 - 12 + k * 3, z: Z0, yaw: Math.PI / 2, px: null, pz: null }); });
  window.fila = fila;
  return { n: A.vacas.length, razas: Object.keys(razas), perros: E.perros.lista.length, pieles: A.vacas.filter((v) => v.piel).length };
});
console.log(JSON.stringify(info));
const foto = async (n, pos, mira, pasos = 3) => {
  await p.evaluate(([pos, mira, pasos]) => { __juego.paso(1 / 30, pasos); __juego.fotoDesde(pos, mira); }, [pos, mira, pasos]);
  await p.screenshot({ path: `tiras/hac-${n}.png` });
};
const h = await p.evaluate(() => E.terreno.altura(60, 60));
await foto("00", [60, h + 2.5, 47], [60, h + 0.8, 60]);
await foto("01", [52, h + 1.6, 55], [50, h + 0.8, 60]);
await foto("02", [64, h + 1.6, 55], [66, h + 0.7, 60]);
// perros: caminando detrás del jugador
await p.evaluate(() => { const J = __juego.J(); J.prueba = { az: 1 }; });
await foto("03", [58, h + 2.2, 44], [60, h + 0.5, 48], 60);
await p.evaluate(() => { const J = __juego.J(); J.prueba = { az: 0 }; E.perros.ordenar("quieto"); });
await foto("04", [58, h + 2.2, 44], [60, h + 0.5, 48], 90);
console.log(errores.slice(0, 8).join("\n") || "sin errores");
await b.close();

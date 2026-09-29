import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 800, height: 450 } });
const errores = []; p.on("pageerror", (e) => errores.push(e.message));
await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
await p.goto("file://" + process.cwd() + "/estancia.html#fijo");
await p.waitForSelector("#menu:not([hidden])", { timeout: 180000 });
await p.evaluate(() => { __juego.empezar(); __juego.congelar(true); __juego.hora(8.5); const J = __juego.J(); J.camara = "tercera"; J.prueba = { az: 0 }; __juego.ir(37, 26, Math.PI, 0); });
let k = 0;
const estado = () => p.evaluate(() => { const A = __juego.A(), K = E.comedero; const c = {}; for (const v of A.vacas) c[v.estado] = (c[v.estado] || 0) + 1; return `nivel ${K.nivel.toFixed(2)} ${JSON.stringify(c)}`; });
const foto = async (prep, pasos, pos, mira) => {
  await p.evaluate(([prep, pasos, pos, mira]) => { eval(prep); __juego.paso(1 / 30, pasos); const y = E.terreno.altura(37, 38); __juego.fotoDesde([pos[0], y + pos[1], pos[2]], [mira[0], y + mira[1], mira[2]]); }, [prep, pasos, pos, mira]);
  await p.screenshot({ path: `tiras/co-${String(k++).padStart(2, "0")}.png` }); console.log(await estado());
};
await foto("0", 3, [37, 5, 18], [37, 0.5, 38]);
await foto("0", 600, [34, 1.6, 27], [38, 0.6, 32]);
await foto("0", 5, [46, 2.2, 29], [36, 0.6, 32]);
await foto("0", 5, [30, 1.3, 30.4], [40, 0.6, 31.5]);
// cargar y llamar a la tropa: se la trae cerca y se abre la tranquera
await foto("E.comedero.alternarTranquera(); E.comedero.fijarNivel(1); for (const v of __juego.A().vacas.filter((v) => !v.engorde && !v.ternero).slice(0, 8)) { v.x = 60 + Math.random() * 10; v.z = 36 + Math.random() * 8; v.estado = 'come'; }", 1500, [52, 4, 26], [38, 0.5, 36]);
await foto("0", 5, [37, 3.5, 24], [37, 0.6, 33]);
console.log(errores.join("\n") || "sin errores");
await b.close();

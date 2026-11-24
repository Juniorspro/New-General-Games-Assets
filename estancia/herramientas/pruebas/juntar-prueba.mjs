import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 400, height: 225 } });
const errores = []; p.on("pageerror", (e) => errores.push(e.message));
await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
await p.goto("file://" + process.cwd() + "/estancia.html#fijo");
await p.waitForSelector("#menu:not([hidden])", { timeout: 180000 });
const r = await p.evaluate(() => {
  __juego.empezar(); __juego.congelar(true); __juego.hora(9);
  const J = __juego.J(), A = __juego.A(); J.prueba = { az: 0 };
  __juego.ir(70, 30, 0, 0);
  for (const d of E.perros.lista) { d.x = 71 + d.i; d.z = 32; }
  const dist = () => { const c = A.centroTropa || A.querencia; const vs = A.vacas.filter((v) => !v.salud.muerta && !v.toro && !v.ternero).map((v) => Math.hypot(v.x - J.x, v.z - J.z)); return Math.hypot(c.x - J.x, c.z - J.z).toFixed(1) + " (la más lejos " + Math.max(...vs).toFixed(0) + ")"; };
  __juego.paso(1 / 30, 30);
  const antes = dist(); const out = [];
  E.perros.ordenar("juntar");
  for (let s = 0; s < 14; s++) { __juego.paso(1 / 30, 450); out.push(`${(s + 1) * 15}s: tropa a ${dist()} m, orden ${E.perros.orden}, perros ${E.perros.lista.map((d) => Math.hypot(d.x - A.centroTropa.x, d.z - A.centroTropa.z).toFixed(0)).join("/")}`); }
  // traer
  const v = A.vacas.find((v) => !v.toro && !v.ternero && Math.hypot(v.x - J.x, v.z - J.z) > 20);
  E.perros.blanco = v; E.perros.orden = "traer";
  const d0 = Math.hypot(v.x - J.x, v.z - J.z).toFixed(0);
  __juego.paso(1 / 30, 1800);
  out.push(`traer la ${v.num}: de ${d0} m a ${Math.hypot(v.x - J.x, v.z - J.z).toFixed(0)} m, orden ${E.perros.orden}`);
  return { antes, out };
});
console.log(JSON.stringify(r, null, 1)); console.log(errores.join("\n") || "sin errores");
await b.close();

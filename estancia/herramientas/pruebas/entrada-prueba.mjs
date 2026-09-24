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
  __juego.empezar(); __juego.congelar(true);
  const J = __juego.J(), out = [];
  const caminar = (seg) => { const c = E.animales.caballo; for (let i = 0; i < seg * 30; i++) { const dx = 2.5 * Math.sin((c.z + 3) * 0.012) - c.x, dz = 3; c.yaw = Math.atan2(dx, dz); J.yaw = c.yaw + Math.PI; __juego.paso(1 / 30, 1); } };
  // a caballo por el camino, hasta el pueblo
  const c = E.animales.caballo; c.x = -2.4; c.z = 360; J.x = c.x; J.z = c.z; J.montar(); J.prueba = { az: 1 };
  caminar(6); out.push(`cerrada: z ${c.z.toFixed(1)}`);
  E.estancia.alternarEntrada(); caminar(12); out.push(`abierta: z ${c.z.toFixed(1)} (el pueblo en z 448)`);
  const pts = E.estancia.puntos.filter((q) => q.id === "almacen" || q.id === "tranqueraEntrada").map((q) => q.id);
  return out.concat(pts);
});
console.log(r.join("\n")); console.log(errores.join("\n") || "sin errores");
await b.close();

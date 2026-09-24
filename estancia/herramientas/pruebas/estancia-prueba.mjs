import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errores = [], afuera = [];
p.on("pageerror", (e) => errores.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errores.push(m.type() + ": " + m.text().slice(0, 300)); });
await p.route("**/*", (r) => { const u = r.request().url(); if (u.startsWith("file://")) return r.continue(); afuera.push(u.split("?")[0]); return r.abort(); });
const t0 = Date.now();
await p.goto("file://" + process.cwd() + "/estancia.html#fijo");
try { await p.waitForSelector("#menu:not([hidden])", { timeout: 120000 }); } catch (e) { console.log("el menú no apareció:", await p.textContent("#cargaTexto")); }
console.log(`carga: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
await p.screenshot({ path: "e-menu.png" });
await p.evaluate(() => { __juego.empezar(); });
const tomas = process.argv.slice(2).length ? JSON.parse(process.argv[2]) : [
  { n: "rancho", x: 6, z: 42, yaw: 2.9, pitch: -0.05, h: 17.6 },
  { n: "corral", x: 20, z: 12, yaw: -1.35, pitch: -0.08, h: 9.5 },
  { n: "monte", x: 130, z: -150, yaw: 0.6, pitch: 0.02, h: 18.4 },
  { n: "tropa", x: 95, z: 75, yaw: -2.2, pitch: -0.1, h: 7.2 },
];
for (const tm of tomas) {
  await p.evaluate((tm) => { const j = __juego; j.hora(tm.h); if (tm.montar && !j.J.montado) { j.A.caballo.x = tm.x; j.A.caballo.z = tm.z; j.J.montar(); } j.J.camara = tm.tercera ? "tercera" : "primera"; j.ir(tm.x, tm.z, tm.yaw, tm.pitch); j.paso(0.05, tm.pasos || 3); }, tm);
  const info = await p.evaluate(() => { __juego.foto(); return __juego.info(); });
  await p.screenshot({ path: `e-${tm.n}.png` });
  console.log(tm.n, JSON.stringify(info));
}
console.log("pedidos afuera:", [...new Set(afuera)].join(", ") || "ninguno");
console.log(errores.length ? errores.slice(0, 12).join("\n") : "sin errores");
await b.close();

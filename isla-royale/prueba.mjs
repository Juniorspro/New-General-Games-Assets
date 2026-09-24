// Prueba de Isla Royale 3D: menú, caída, cofre, construcción, pelea, tormenta y victoria,
// en PC y teléfono acostado. Corre sobre el descargable, y avanza la simulación con
// __isla.simular(seg) porque SwiftShader dibuja a 1-3 cuadros por segundo.
//   python3 herramientas/descargable/empaquetar.py isla-royale/index.html $S/isla-royale.html
//   PW=$(npm root -g)/playwright S=$S node isla-royale/prueba.mjs     (fotos en $S/tiras/)
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const S = process.env.S;
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errores = [];
for (const [w, hh, nom, tel] of [[1100, 620, "pc", false], [844, 390, "tel", true]]) {
  const p = await b.newPage({ viewport: { width: w, height: hh }, hasTouch: tel, isMobile: tel });
  p.on("pageerror", (e) => errores.push(nom + " pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("ERR_FAILED")) errores.push(nom + " " + m.text().slice(0, 300)); });
  await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto("file://" + S + "/isla-royale.html");
  await p.waitForTimeout(3500);
  await p.screenshot({ path: `${S}/tiras/${nom}-menu.png` });
  await p.click("button.jugar"); await p.waitForTimeout(1200);
  const q = (fn) => p.evaluate(fn);
  await q(() => __isla.simular(3)); await p.waitForTimeout(700);
  await p.screenshot({ path: `${S}/tiras/${nom}-cae.png` });
  await q(() => __isla.simular(9)); await p.waitForTimeout(700);
  await p.screenshot({ path: `${S}/tiras/${nom}-planea.png` });
  console.log(nom, "caída:", await q(() => { const yo = __isla.partida.jugadores[0]; return yo.estado + " a " + yo.y.toFixed(1) + " m"; }));
  await q(() => __isla.simular(12));
  console.log(nom, "aterrizaron:", await q(() => __isla.partida.jugadores.filter((j) => j.estado === "tierra").length + " de 7"));
  // Al lado de un cofre, mirando hacia un bot.
  await q(() => { const P = __isla.partida, yo = P.jugadores[0], c = P.cofres[3]; yo.x = c.x + 0.6; yo.z = c.z + 0.6; yo.y = c.y + 0.5; yo.estado = "tierra"; __isla.simular(0.5); });
  console.log(nom, "cofre:", await q(() => { const P = __isla.partida, yo = P.jugadores[0]; return `abierto ${P.cofres[3].abierto}, escudo ${yo.escudo}, vida ${yo.vida}, madera ${yo.madera}`; }));
  await q(() => { const P = __isla.partida, yo = P.jugadores[0]; yo.x += 8; yo.y = __isla.partida.jugadores[0].y + 2; __isla.entrada.muro = true; __isla.simular(0.6); yo.yaw += Math.PI / 2; __isla.entrada.rampa = true; __isla.simular(0.6); yo.yaw -= Math.PI / 2; __isla.simular(0.3); });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${S}/tiras/${nom}-construye.png` });
  console.log(nom, "construcciones:", await q(() => __isla.partida.estructuras.map((s) => s.tipo).join(",")));
  await q(() => { const P = __isla.partida, yo = P.jugadores[0], bt = P.jugadores[1]; yo.yaw += Math.PI; bt.estado = "tierra"; bt.vivo = true; bt.x = yo.x - Math.sin(yo.yaw) * 12; bt.z = yo.z - Math.cos(yo.yaw) * 12; bt.y = yo.y + 1; P.t = 30; yo.pitch = 0; __isla.simular(0.4); yo.pitch = Math.atan2(bt.y - yo.y - 0.2, 12); __isla.entrada.raton = true; __isla.simular(1.2); __isla.entrada.raton = false; });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${S}/tiras/${nom}-pelea.png` });
  console.log(nom, "pelea:", await q(() => { const P = __isla.partida; return JSON.stringify({ yo: [Math.round(P.jugadores[0].vida), Math.round(P.jugadores[0].escudo)], bot: [Math.round(P.jugadores[1].vida), Math.round(P.jugadores[1].escudo)], balas: P.jugadores[0].mun[0], feed: P.feed.map((f) => f.texto) }); }));
  await q(() => { const P = __isla.partida, yo = P.jugadores[0]; P.tormenta.x = yo.x + 70; P.tormenta.z = yo.z; P.tormenta.r = 50; yo.y += 2; yo.estado = "tierra"; __isla.simular(3.2); });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${S}/tiras/${nom}-tormenta.png` });
  console.log(nom, "tormenta:", await q(() => { const yo = __isla.partida.jugadores[0]; return `vida ${Math.round(yo.vida)} escudo ${Math.round(yo.escudo)}`; }));
  await q(() => { const P = __isla.partida; P.jugadores[0].vida = 100; P.jugadores.slice(1).forEach((j) => { j.vivo = false; j.muerte = 3; j.dejoBotin = true; }); __isla.simular(0.3); });
  await p.waitForTimeout(2600);
  await p.screenshot({ path: `${S}/tiras/${nom}-fin.png` });
  console.log(nom, "fin:", await q(() => document.querySelector(".victoria")?.textContent));
  await p.close();
}
await b.close();
console.log(errores.slice(0, 15).join("\n") || "sin errores");

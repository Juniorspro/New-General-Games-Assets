// Prueba de Isla Royale: carga, vestíbulo, autobús, caída, cofre, botín, pico, construcción,
// pelea, mira de francotirador, mapa, tormenta y victoria. Uso (pc o tel):
//   python3 herramientas/descargable/empaquetar.py isla-royale/index.html $S/isla-royale.html
//   PW=$(npm root -g)/playwright S=$S node isla-royale/prueba.mjs pc     (fotos en $S/tiras/)
// Avanza con __isla.simular(seg): SwiftShader dibuja a 1-3 cuadros por segundo.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const S = process.env.S, nom = process.argv[2] || "pc", tel = nom === "tel";
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: tel ? { width: 844, height: 390 } : { width: 1100, height: 620 }, hasTouch: tel, isMobile: tel });
const errores = [];
p.on("pageerror", (e) => errores.push("pageerror: " + e.message + " " + (e.stack || "").split("\n")[1]));
p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("ERR_FAILED")) errores.push(m.text().slice(0, 300)); });
await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
const t0 = Date.now();
await p.goto("file://" + S + "/isla-royale.html");
await p.waitForTimeout(1500);
await p.screenshot({ path: `${S}/tiras/v3-${nom}-carga.png` });
await p.waitForFunction(() => window.__isla && __isla.modo === "vestibulo", null, { timeout: 120000 }).catch(() => {});
console.log("vestíbulo en", Date.now() - t0, "ms");
await p.waitForTimeout(1500);
await p.screenshot({ path: `${S}/tiras/v3-${nom}-vestibulo.png` });
const q = (fn, a) => p.evaluate(fn, a);
await p.click("button.jugar"); await p.waitForTimeout(3500);
await p.screenshot({ path: `${S}/tiras/v3-${nom}-cargapartida.png` });
await p.waitForFunction(() => __isla.modo === "juego", null, { timeout: 60000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: `${S}/tiras/v3-${nom}-bus.png` });
await q(() => { __isla.simular(4); __isla.entrada.saltar = true; __isla.simular(3); });
await p.waitForTimeout(800); await p.screenshot({ path: `${S}/tiras/v3-${nom}-cae.png` });
console.log("caída:", await q(() => { const yo = __isla.P.jugadores[0]; return yo.estado + " " + yo.y.toFixed(0); }));
await q(() => __isla.simular(25));
console.log("en tierra:", await q(() => __isla.P.jugadores.filter((j) => j.estado === "tierra").length + "/" + __isla.P.jugadores.length));
// Al lado de un cofre en una casa.
await q(() => { const P = __isla.P, yo = P.jugadores[0], c = P.cofres.find((c) => c.tipo === "cofre"); yo.x = c.x + 1.2; yo.z = c.z + 0.2; yo.y = c.y + 0.3; yo.estado = "tierra"; yo.yaw = Math.atan2(-(c.x - yo.x), -(c.z - yo.z)); __isla.simular(0.3); __isla.entrada.usar = true; __isla.simular(1.5); });
await p.waitForTimeout(3500); await p.screenshot({ path: `${S}/tiras/v3-${nom}-cofre.png` });
console.log("cofre:", await q(() => { const P = __isla.P, yo = P.jugadores[0]; return JSON.stringify({ inv: yo.inv.map((i) => i && (i.arma || i.c || i.tipo)), mun: yo.mun, mats: yo.mats, cerca: P.botin.filter((b) => Math.hypot(b.x - yo.x, b.z - yo.z) < 4).map((b) => b.item.tipo) }); }));
// Agarrar todo lo que quedó cerca.
await q(() => { const P = __isla.P, yo = P.jugadores[0]; for (const b of P.botin.filter((b) => Math.hypot(b.x - yo.x, b.z - yo.z) < 5)) { yo.x = b.x; yo.z = b.z; __isla.simular(0.2); } });
console.log("inventario:", await q(() => { const yo = __isla.P.jugadores[0]; return JSON.stringify({ inv: yo.inv.map((i) => i && (i.arma || i.c || i.tipo) + (i.rareza != null ? "/" + i.rareza : "")), mun: yo.mun, mats: yo.mats }); }));
// Pico contra un árbol.
await q(() => { const P = __isla.P, yo = P.jugadores[0], a = __isla.isla.arboles[5]; yo.x = a.x + 1.4; yo.z = a.z; yo.y = a.y0 + 0.5; yo.sel = 0; yo.yaw = Math.PI / 2; yo.pitch = 0.1; __isla.simular(0.3); __isla.entrada.raton = true; __isla.simular(2.5); __isla.entrada.raton = false; });
console.log("madera tras picar:", await q(() => __isla.P.jugadores[0].mats.madera));
await q(() => { const P = __isla.P, yo = P.jugadores[0]; yo.x += 8; __isla.simular(0.3); yo.mats.madera = Math.max(yo.mats.madera, 60); __isla.entrada.pieza = "muro"; __isla.entrada.raton = true; __isla.simular(0.2); __isla.entrada.raton = false; yo.yaw += Math.PI / 2; __isla.entrada.pieza = "escalera"; __isla.simular(0.1); __isla.entrada.raton = true; __isla.simular(0.2); __isla.entrada.raton = false; __isla.entrada.pieza = "piso"; yo.pitch = 0; __isla.simular(0.1); __isla.entrada.raton = true; __isla.simular(0.2); __isla.entrada.raton = false; __isla.simular(0.5); });
await p.waitForTimeout(3500); await p.screenshot({ path: `${S}/tiras/v3-${nom}-construye.png` });
console.log("construcciones:", await q(() => __isla.P.estructuras.map((s) => s.tipo2).join(",")));
// Pelea: un bot enfrente, el jugador con un rifle.
await q(() => { const P = __isla.P, yo = P.jugadores[0], bt = P.jugadores[1]; yo.construyendo = false; yo.inv[1] = { tipo: "arma", arma: "rifle", rareza: 3, mun: 30 }; yo.mun.mediana = 120; yo.sel = 1; yo.yaw += Math.PI; bt.vivo = true; bt.estado = "tierra"; bt.x = yo.x - Math.sin(yo.yaw) * 14; bt.z = yo.z - Math.cos(yo.yaw) * 14; bt.y = __isla.sueloEn(bt.x, bt.z, yo.y + 3, 5); bt.escudo = 50; bt.inv[1] = { tipo: "arma", arma: "escopeta", rareza: 1, mun: 5 }; bt.mun.cartuchos = 20; __isla.simular(0.4); yo.pitch = Math.atan2(bt.y + 1.2 - (yo.y + 1.4), 14); __isla.entrada.raton = true; __isla.simular(1.5); __isla.entrada.raton = false; });
await p.waitForTimeout(3500); await p.screenshot({ path: `${S}/tiras/v3-${nom}-pelea.png` });
console.log("pelea:", await q(() => { const P = __isla.P, yo = P.jugadores[0], bt = P.jugadores[1]; return JSON.stringify({ yo: [yo.vida, yo.escudo], bot: [Math.round(bt.vida), Math.round(bt.escudo), bt.vivo], tiros: yo.tiros, aciertos: yo.aciertos.toFixed(1), feed: P.feed.map((f) => f.a + ">" + f.b) }); }));
// Francotirador y mapa.
await q(() => { const yo = __isla.P.jugadores[0]; yo.inv[2] = { tipo: "arma", arma: "francotirador", rareza: 4, mun: 1 }; yo.mun.pesada = 12; yo.sel = 2; __isla.entrada.apuntar = true; __isla.simular(0.5); });
await p.waitForTimeout(3500); await p.screenshot({ path: `${S}/tiras/v3-${nom}-mira.png` });
await q(() => { __isla.entrada.apuntar = false; __isla.alMapa(); });
await p.waitForTimeout(900); await p.screenshot({ path: `${S}/tiras/v3-${nom}-mapa.png` });
await q(() => __isla.alMapa());
// Tormenta y fin.
await q(() => { const P = __isla.P, yo = P.jugadores[0]; P.tormenta.x = yo.x + 80; P.tormenta.z = yo.z; P.tormenta.r = 40; __isla.simular(3.2); });
console.log("tormenta:", await q(() => { const yo = __isla.P.jugadores[0]; return `vida ${Math.round(yo.vida)} escudo ${Math.round(yo.escudo)}`; }));
await p.waitForTimeout(600); await p.screenshot({ path: `${S}/tiras/v3-${nom}-tormenta.png` });
await q(() => { const P = __isla.P; P.jugadores[0].vida = 100; P.jugadores.slice(1).forEach((j) => { if (j.vivo) __isla.herir(j, 999, P.jugadores[0], false, "bala"); }); __isla.simular(0.4); });
await p.waitForTimeout(3500); await p.screenshot({ path: `${S}/tiras/v3-${nom}-fin.png` });
console.log("fin:", await q(() => document.querySelector(".victoria")?.textContent + " | " + document.querySelector(".datos")?.innerText.replace(/\n/g, " ")));
await b.close();
console.log(errores.slice(0, 12).join("\n") || "sin errores");

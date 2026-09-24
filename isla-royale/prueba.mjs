// Prueba de Isla Royale: menú, partida, construcción, pelea, tormenta y victoria,
// en PC, teléfono acostado y teléfono parado. Corre sobre el descargable:
//   python3 herramientas/descargable/empaquetar.py isla-royale/index.html $S/isla-royale.html
//   PW=$(npm root -g)/playwright S=$S node isla-royale/prueba.mjs     (fotos en $S/tiras/)
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const S = process.env.S;
const b = await chromium.launch();
const errores = [];
for (const [w, h, nom, tel] of [[1200, 700, "pc", false], [844, 390, "tel", true], [390, 780, "vert", true]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: tel, isMobile: tel });
  p.on("pageerror", (e) => errores.push(nom + ": " + e.message));
  p.on("console", (m) => { if (m.type() === "error") errores.push(nom + " console: " + m.text()); });
  await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto("file://" + S + "/isla-royale.html");
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${S}/tiras/${nom}-menu.png` });
  await p.click("button.jugar");
  await p.waitForTimeout(1500);
  if (tel) {
    const disp = p.locator("button", { hasText: "Disparar" });
    const antes = await p.evaluate(() => __isla.current.jugadores[0].mun[0]);
    const bb = await disp.boundingBox(); await p.mouse.move(bb.x + 20, bb.y + 10); await p.mouse.down(); await p.waitForTimeout(500); await p.mouse.up();
    await p.locator("button", { hasText: "Construir" }).dispatchEvent("pointerdown");
    await p.waitForTimeout(200);
    console.log(nom, "disparos con el botón:", antes - await p.evaluate(() => __isla.current.jugadores[0].mun[0]), "estructuras:", await p.evaluate(() => __isla.current.mundo.estructuras.length));
  }
  if (!tel) {
    await p.mouse.move(w / 2 + 200, h / 2 - 50);
    await p.keyboard.down("KeyW"); await p.waitForTimeout(700); await p.keyboard.up("KeyW");
    await p.keyboard.press("KeyQ"); await p.waitForTimeout(200);
    await p.mouse.move(w / 2 - 200, h / 2 + 60);
    await p.keyboard.press("KeyE"); await p.waitForTimeout(200);
    await p.mouse.down(); await p.waitForTimeout(600); await p.mouse.up();
  }
  await p.screenshot({ path: `${S}/tiras/${nom}-juego.png` });
  // Acercar un bot y dejar que pelee; después tormenta.
  const info = await p.evaluate(() => { const P = __isla.current, yo = P.jugadores[0]; const bt = P.jugadores[1]; P.t = 12; bt.x = yo.x + 250; bt.y = yo.y + 40; return { estructuras: P.mundo.estructuras.length ?? Object.keys(P.mundo.estructuras).length, madera: yo.madera, balas: P.balas.length }; });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${S}/tiras/${nom}-pelea.png` });
  const info2 = await p.evaluate(() => { const P = __isla.current, yo = P.jugadores[0]; P.tormenta.t = 0.1; return { vida: yo.vida, escudo: yo.escudo, bot1: P.jugadores[1].vida + "/" + P.jugadores[1].escudo, feed: P.feed.map(f => f.texto || JSON.stringify(f)).slice(0, 3) }; });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${S}/tiras/${nom}-tormenta.png` });
  // Victoria: matar a todos los bots.
  await p.evaluate(() => { const P = __isla.current; P.jugadores.slice(1).forEach((q) => { q.vida = 0; q.escudo = 0; q.vivo = false; }); P.jugadores[0].vida = 100; });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${S}/tiras/${nom}-fin.png` });
  console.log(nom, JSON.stringify(info), JSON.stringify(info2), await p.evaluate(() => document.body.innerText.slice(0, 200).replace(/\n/g, " | ")));
  await p.close();
}
console.log(errores.join("\n") || "sin errores");
await b.close();

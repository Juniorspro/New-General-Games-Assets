import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage({ viewport: { width: 1100, height: 800 } });
const errores = [];
pg.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
pg.on("pageerror", (e) => errores.push("pageerror: " + e.message));

await pg.goto("http://127.0.0.1:8799/index.html", { waitUntil: "networkidle" });
await pg.waitForFunction(() => !!window.PIQUE, { timeout: 8000 });
console.log("cargo. PIQUE expuesto:", await pg.evaluate(() => !!window.PIQUE));
await pg.screenshot({ path: "/tmp/tiro/01-inicio.png" });

await pg.click("#btn-jugar");
await pg.waitForSelector("#p-mapa:not([hidden])");
await pg.screenshot({ path: "/tmp/tiro/02-mapa.png" });

await pg.click('[data-nivel="1-1"]');
await pg.waitForSelector("#p-juego:not([hidden])", { timeout: 20000 });
await pg.waitForTimeout(1500);
await pg.screenshot({ path: "/tmp/tiro/03-juego.png" });
console.log("HUD:", await pg.textContent("#hud-gen"));
console.log("estado:", await pg.evaluate(() => window.PIQUE.partida?.estado));
console.log("errores de consola:", errores.length ? errores : "ninguno");
await nav.close();

// Arranca el juego con el bot, deja correr unos segundos y saca capturas.
// uso: node pruebas/_juego.mjs carpeta [dificultad] [segundos]
import { chromium } from "playwright";
const carpeta = process.argv[2] || ".";
const dif = process.argv[3] || "normal";
const seg = Number(process.argv[4] || 20);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const pg = await nav.newPage({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 1, hasTouch: true });
pg.on("pageerror", e => console.log("PAGEERROR:", e.message, (e.stack || "").split("\n").slice(1, 3).join(" | ")));
pg.on("console", m => { if (m.type() === "error" || m.type() === "warning") console.log("CONSOLA:", m.type(), m.text().slice(0, 300)); });
await pg.goto("http://127.0.0.1:8811/index.html?fijo");
await pg.waitForFunction(() => window.__TAJO && window.__TAJO.listo === true, null, { timeout: 30000 });
await pg.click("#btn-tocar");
await pg.waitForTimeout(500);
if (await pg.isVisible("#aviso-seguir")) await pg.click("#aviso-seguir");
await pg.waitForTimeout(1500);
await pg.screenshot({ path: `${carpeta}/j_portada.png` });
const n = await pg.evaluate((d) => window.__TAJO.jugar(0, d, { bot: true }), dif);
console.log("bloques:", n);
const t0 = Date.now();
let k = 0;
while ((Date.now() - t0) / 1000 < seg) {
  await pg.waitForTimeout(4000);
  const e = await pg.evaluate(() => window.__TAJO.estado());
  console.log(JSON.stringify({ t: +e.t.toFixed(1), estado: e.estado, pts: e.puntos, cortes: e.cortes, perdidos: e.perdidos, malos: e.malos, en: +e.energia.toFixed(2) }));
  await pg.screenshot({ path: `${carpeta}/j_${k++}.png` });
}
const fps = await pg.evaluate(() => new Promise(r => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 2000) requestAnimationFrame(f); else r(n / ((performance.now() - t) / 1000)); }; requestAnimationFrame(f); }));
console.log("cuadros/s en este navegador (SwiftShader, no dice nada de un teléfono):", fps.toFixed(1));
await nav.close();

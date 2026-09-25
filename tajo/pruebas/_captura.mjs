// Captura rápida de la escena a 412x892 (uso: node pruebas/_captura.mjs salida.png [url])
import { chromium } from "playwright";
const salida = process.argv[2] || "captura.png";
const url = process.argv[3] || "http://127.0.0.1:8811/index.html";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const pg = await nav.newPage({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 1 });
pg.on("pageerror", e => console.log("PAGEERROR:", e.message));
pg.on("console", m => { if (m.type() === "error" || m.type() === "warning") console.log("CONSOLA:", m.type(), m.text().slice(0, 300)); });
await pg.goto(url);
await pg.waitForFunction(() => window.__listo === true, null, { timeout: 30000 });
await pg.evaluate(() => window.__dibujar(3.0));
await pg.waitForTimeout(300);
await pg.screenshot({ path: salida });
await nav.close();
console.log("ok", salida);

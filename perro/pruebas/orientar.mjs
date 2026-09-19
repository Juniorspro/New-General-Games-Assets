// Hacia donde mira el modelo. NO SE ADIVINA: los generadores de imagen a 3D
// ignoran la orientacion que se les pide, asi que se renderiza el mismo modelo
// a varios angulos y se elige mirando. Barato y definitivo.
import { chromium } from "playwright";
import { writeFileSync } from "fs";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const pg = await nav.newPage({ viewport: { width: 1200, height: 260 } });
pg.on("pageerror", e => console.log("  ERROR:", e.message.slice(0,200)));
pg.on("console", m => console.log("  " + m.text().slice(0, 200)));
await pg.goto("http://127.0.0.1:8811/pruebas/hoja.html");
await pg.waitForFunction(() => window.__listo === true, { timeout: 60000 });
writeFileSync("/tmp/claude-0/perro/hoja.png", await pg.screenshot());
console.log("  hoja escrita");
await nav.close();

import { chromium } from "playwright";
import path from "path";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--allow-file-access-from-files"] });
const pg = await nav.newPage({ viewport: { width: 1000, height: 800 } });
pg.on("pageerror", e => console.log("ERROR:", e.message));
pg.on("console", m => { if (m.type() === "error") console.log("consola:", m.text()); });
await pg.goto("file://" + path.resolve("pruebas/ver_modelos.html"));
await pg.waitForFunction(() => window.__listo === true, { timeout: 60000 });
await pg.locator("canvas").screenshot({ path: "/tmp/modelos3d.png" });
console.log("captura lista");
await nav.close();

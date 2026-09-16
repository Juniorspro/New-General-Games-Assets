import { chromium } from "playwright";
import path from "path";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const pg = await nav.newPage();
pg.on("pageerror", e => console.log("PAGEERROR:", e.message, "|", (e.stack||"").split("\n")[1]));
pg.on("console", m => { if (m.type()==="error") console.log("CONSOLA:", m.text().slice(0,200)); });
await pg.goto("file://" + path.resolve("pique3d-en-un-archivo.html"));
await pg.waitForTimeout(6000);
console.log("PIQUE3D:", await pg.evaluate(() => typeof window.PIQUE3D));
console.log("M_three:", await pg.evaluate(() => typeof window.M_three));
console.log("detalle:", await pg.evaluate(() => document.querySelector("#carga-detalle")?.textContent));
await nav.close();

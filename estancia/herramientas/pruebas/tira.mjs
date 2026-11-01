// Filma escenas cuadro a cuadro: node tira.mjs escenas.mjs [filtro]
import { createRequire } from "module";
import { pathToFileURL } from "url";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const fs = require("fs");
const { escenas } = await import(pathToFileURL(process.argv[2]).href);
const filtro = process.argv[3] ? new RegExp(process.argv[3]) : null;
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 480, height: 270 } });
const errores = [];
p.on("pageerror", (e) => errores.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error") errores.push("console: " + m.text().slice(0, 200)); });
await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
await p.goto("file://" + process.cwd() + "/estancia.html#fijo");
await p.waitForSelector("#menu:not([hidden])", { timeout: 180000 });
await p.evaluate((sinPasto) => { __juego.empezar(); __juego.congelar(true); document.body.style.visibility = "hidden"; document.getElementById("lienzo").style.visibility = "visible"; if (sinPasto) E.flora.pasto.visible = false; }, !process.env.CON_PASTO);
for (const esc of escenas) {
  if (filtro && !filtro.test(esc.n)) continue;
  // cada escena arranca de un estado limpio de lo que toca
  const info = await p.evaluate(esc.armar);
  const n = esc.cuadros || 8;
  for (let i = 0; i < n; i++) {
    const r = await p.evaluate(([cam, i, dt, pasos, cada]) => {
      const j = __juego;
      if (i > 0 || cada) j.paso(dt, pasos);
      const [pos, mira] = (0, eval)("(" + cam + ")")();
      return j.fotoDesde(pos, mira);
    }, [esc.camara.toString(), i, esc.dt || 1 / 30, esc.pasos || 2, esc.pasoInicial || 0]);
    await p.screenshot({ path: `tiras/${esc.n}-${String(i).padStart(2, "0")}.png` });
  }
  console.log(esc.n, JSON.stringify(info));
}
console.log(errores.length ? errores.slice(0, 10).join("\n") : "sin errores");
await b.close();

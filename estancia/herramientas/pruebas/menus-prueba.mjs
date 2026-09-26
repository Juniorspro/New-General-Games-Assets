import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errores = [];
for (const [w, h, nom] of [[960, 540, "pc"], [390, 800, "tel"]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: nom === "tel", isMobile: nom === "tel" });
  p.on("pageerror", (e) => errores.push(nom + ": " + e.message));
  await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
  await p.goto("file://" + process.cwd() + "/estancia.html");
  await p.waitForTimeout(400); await p.screenshot({ path: `tiras/m-${nom}-00.png` });
  await p.waitForSelector("#menu:not([hidden])", { timeout: 180000 });
  await p.waitForTimeout(700); await p.screenshot({ path: `tiras/m-${nom}-01.png` });
  await p.waitForTimeout(3000); await p.screenshot({ path: `tiras/m-${nom}-02.png` });
  if (nom === "tel") { await p.evaluate(() => __juego.empezar()); await p.waitForTimeout(500); await p.screenshot({ path: `tiras/m-${nom}-03.png` }); await p.close(); continue; }
  await p.click("#menuOpciones"); await p.waitForTimeout(700); await p.screenshot({ path: `tiras/m-${nom}-03.png` });
  await p.click("#opciones [data-volver]"); await p.click("#menuComo"); await p.waitForTimeout(700); await p.screenshot({ path: `tiras/m-${nom}-04.png` });
  await p.click("#como [data-volver]"); await p.click("#menuEmpezar"); await p.waitForTimeout(1200); await p.screenshot({ path: `tiras/m-${nom}-05.png` });
  await p.click("#parteSeguir"); await p.waitForTimeout(800);
  await p.evaluate(() => { E.juego.soltarPuntero(); E.juego.dinero += 50000; document.getElementById("pausa").hidden = false; }); await p.waitForTimeout(700); await p.screenshot({ path: `tiras/m-${nom}-06.png` });
  await p.click("#pausaOpciones"); await p.waitForTimeout(300); await p.click("#opciones [data-volver]"); await p.waitForTimeout(300);
  const vuelta = await p.evaluate(() => !document.getElementById("pausa").hidden);
  await p.click("#pausaSeguir"); await p.waitForTimeout(150); await p.screenshot({ path: `tiras/m-${nom}-07.png` });
  console.log("vuelve a pausa:", vuelta);
  await p.close();
}
console.log(errores.length ? errores.join("\n") : "sin errores");
await b.close();

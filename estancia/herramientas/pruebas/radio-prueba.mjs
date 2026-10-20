import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const b = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required", "--ignore-certificate-errors"] });
const errores = [];
for (const [w, h, nom, tel] of [[1000, 560, "pc", false], [844, 390, "tel", true]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: tel, isMobile: tel, ignoreHTTPSErrors: true });
  p.on("pageerror", (e) => errores.push(nom + ": " + e.message));
  // Todo lo local, más las emisoras y el directorio de radios.
  await p.route("**/*", (r) => { const u = r.request().url(); return u.startsWith("file://") || /magma\.edge-access|radio-browser|solumedia|radiosnethosting|streamingradio|turadioenvivo|instream|radiohdvivo|laradio\.online/.test(u) ? r.continue() : r.abort(); });
  await p.goto("file://" + process.cwd() + "/estancia.html#fijo");
  await p.waitForSelector("#menu:not([hidden])", { timeout: 180000 });
  await p.evaluate(([tel]) => { if (tel) { document.body.classList.add("tactil"); E.entrada.tactil = true; } __juego.empezar(); __juego.hora(10); const J = __juego.J(); J.camara = "tercera"; __juego.ir(2, 32, 0, -0.1); J.sed = 100; J.cansancio = 100; }, [tel]);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `tiras/hud-${nom}-0.png` });
  if (nom === "pc") {
    await p.evaluate(() => { const J = __juego.J(); J.sed = 40; E.radioFM.abrir(); });
    await p.waitForTimeout(4000);
    await p.screenshot({ path: `tiras/hud-${nom}-radio.png` });
    await p.evaluate(() => E.radioFM.sintonizar(E.radioFM.EMISORAS.find((e) => e.nombre.includes("Futuro"))));
    await p.waitForTimeout(9000);
    console.log("radio:", await p.evaluate(() => `${E.radioFM.actual.nombre} → ${E.radioFM.estado}; emisoras en el dial: ${E.radioFM.EMISORAS.length}`));
    await p.evaluate(() => E.radioFM.cerrar()); await p.waitForTimeout(1200);
    await p.screenshot({ path: `tiras/hud-${nom}-1.png` });
  }
  await p.close();
}
console.log(errores.join("\n") || "sin errores");
await b.close();

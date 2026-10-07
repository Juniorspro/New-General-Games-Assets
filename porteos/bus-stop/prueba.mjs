// Bus Stop Simulator — la lista de PORTEO.md §9, entera, contra lo que se entrega.
//
//   node porteos/bus-stop/prueba.mjs http://127.0.0.1:8811/ file:///ruta/bus-stop-simulator.html
//
// El primer argumento es la carpeta web servida por http (hace falta http para
// el service worker); el segundo, el .html de un solo archivo abierto del disco.
// Cada control se mide en el ESTADO DEL JUEGO (posición, cámara, altura,
// linterna), no en "no tiró error". Ojo: con swiftshader esto corre a ~6
// cuadros/s, por eso los toques se sostienen bastante más que en un teléfono.
const { chromium } = await import(process.env.PLAYWRIGHT || "/opt/node22/lib/node_modules/playwright/index.mjs");
const WEB = process.argv[2] || "http://127.0.0.1:8811/";
const ARCHIVO = process.argv[3];
const CAPTURAS = process.env.CAPTURAS || "/tmp";
const nav = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"],
});

let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? ok++ : mal++; console.log(`  ${c ? "✓" : "✗"} ${n}${d ? " — " + d : ""}`); };
const espera = (pg, ms) => pg.waitForTimeout(ms);

async function abrir(url, { w = 844, h = 390, ctx = null } = {}) {
  const c = ctx || await nav.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  const pg = await c.newPage();
  const errores = [], audios = [];
  pg.on("pageerror", (e) => errores.push(e.message));
  pg.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errores.push(m.text().slice(0, 160)); });
  pg.on("requestfailed", (r) => errores.push("falló " + r.url().slice(-60)));
  await pg.exposeFunction("__audio", (u, bien) => audios.push([u, bien]));
  await pg.addInitScript(() => {
    // Se cuenta lo que el juego termina de DECODIFICAR: eso es audio listo
    // para sonar, venga de la red, del service worker o del archivo único
    // (que sirve los .ogg sin pasar por el fetch de verdad).
    const d = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function () {
      const p = d.apply(this, arguments);
      p.then((b) => window.__audio(b.duration.toFixed(1) + " s", true), () => window.__audio("?", false));
      return p;
    };
  });
  const t0 = Date.now();
  await pg.goto(url);
  await pg.waitForFunction(() => window.__bus && window.__bus.listo, { timeout: 120000 });
  const cdp = await pg.context().newCDPSession(pg);
  return { pg, cdp, errores, audios, ms: Date.now() - t0, ctx: c };
}
const toque = (cdp, type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
const pantalla = (pg) => pg.evaluate(() => document.querySelector("#pantallas").innerText);
const pausado = async (pg) => /PAUSA/.test(await pantalla(pg));
const est = (pg) => pg.evaluate(() => {
  const j = window.__bus.juego, c = j.camara;
  return { p: c.position.toArray(), q: c.quaternion.toArray(), luz: j.linternaOn, modo: window.__bus.modo };
});
const centro = (pg, sel) => pg.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
// Los botones del juego son sólo dibujo (pointer-events: none): los toques los
// atiende la capa #tactil según dónde cae el dedo. Se toca como un dedo real.
async function tocar(pg, cdp, sel, ms = 150) {
  const [x, y] = await centro(pg, sel);
  await toque(cdp, "touchStart", [[x, y, 7]]); await espera(pg, ms); await toque(cdp, "touchEnd", []);
}
const distancia = (a, b) => Math.hypot(a.p[0] - b.p[0], a.p[2] - b.p[2]);

async function jugar(pg) {
  if (/ESPAÑOL/.test(await pantalla(pg))) { await pg.tap("text=ESPAÑOL"); await espera(pg, 400); }
  await pg.tap("text=JUGAR");
  await pg.waitForFunction(() => window.__bus.modo === "jugando", { timeout: 20000 });
  await espera(pg, 1500);
}
async function caminar(pg, cdp, ms, conCorrer = false) {
  const [jx, jy] = await centro(pg, "#tactil .c-joy");
  const dedos = [[jx, jy, 1]];
  if (conCorrer) dedos.push([...(await centro(pg, "#tactil .c-correr")), 2]);
  await toque(cdp, "touchStart", dedos);
  for (let i = 1; i <= 6; i++) { dedos[0] = [jx, jy - 9 * i, 1]; await toque(cdp, "touchMove", dedos); await espera(pg, 25); }
  await espera(pg, ms);
  await toque(cdp, "touchEnd", []);
  await espera(pg, 300);
}
async function controlesAdentro(pg, w, h, nombre) {
  const r = await pg.evaluate(() => [...document.querySelectorAll("#tactil .ctl")].map((e) => {
    const b = e.getBoundingClientRect(); return { n: e.className.replace("ctl ", ""), x: b.x, y: b.y, w: b.width, h: b.height };
  }));
  const fuera = r.filter((b) => b.x < 0 || b.y < 0 || b.x + b.w > w + 0.5 || b.y + b.h > h + 0.5).map((b) => b.n);
  ch(`${nombre}: los ${r.length} controles entran en la pantalla`, r.length >= 6 && !fuera.length, fuera.join(", "));
  const pisados = [];
  for (let i = 0; i < r.length; i++) for (let k = i + 1; k < r.length; k++) {
    const a = r[i], b = r[k];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) pisados.push(a.n + "/" + b.n);
  }
  ch(`${nombre}: ningún control tapa a otro`, !pisados.length, pisados.join(", "));
}

// ───────────────────────── A. teléfono acostado ─────────────────────────
console.log("\nA. teléfono acostado (844×390), carpeta web");
{
  const { pg, cdp, errores, audios, ms } = await abrir(WEB);
  ch("carga", true, `${ms} ms`);
  ch("primera vez: pide el idioma", /ESPAÑOL/.test(await pantalla(pg)));
  await jugar(pg);
  ch("idioma → menú → JUGAR sólo tocando", (await est(pg)).modo === "jugando");
  await controlesAdentro(pg, 844, 390, "acostado");

  let a = await est(pg); await caminar(pg, cdp, 1200); let b = await est(pg);
  const dCaminar = distancia(a, b);
  ch("joystick: camina", dCaminar > 0.5, `${dCaminar.toFixed(2)} m`);
  a = await est(pg); await caminar(pg, cdp, 1200, true); b = await est(pg);
  const dCorrer = distancia(a, b);
  ch("CORRER (con el joystick apretado, dos dedos): va más rápido", dCorrer > dCaminar * 1.25, `${dCorrer.toFixed(2)} m contra ${dCaminar.toFixed(2)} m`);

  const [jx, jy] = await centro(pg, "#tactil .c-joy");
  a = await est(pg);
  await toque(cdp, "touchStart", [[jx, jy - 40, 1], [470, 90, 2]]);
  for (let i = 1; i <= 8; i++) { await toque(cdp, "touchMove", [[jx, jy - 40, 1], [470 + 14 * i, 90, 2]]); await espera(pg, 30); }
  await toque(cdp, "touchEnd", []); await espera(pg, 300);
  b = await est(pg);
  const giro = Math.abs(a.q[1] - b.q[1]) + Math.abs(a.q[3] - b.q[3]);
  ch("mirar con otro dedo mientras camina: la cámara gira", giro > 0.01, `Δq ${giro.toFixed(3)}`);

  const [sx, sy] = await centro(pg, "#tactil .c-saltar");
  const y0 = (await est(pg)).p[1];
  await toque(cdp, "touchStart", [[sx, sy, 3]]); await espera(pg, 300); await toque(cdp, "touchEnd", []);
  let pico = y0; for (let i = 0; i < 25; i++) { pico = Math.max(pico, (await est(pg)).p[1]); await espera(pg, 40); }
  ch("SALTAR: sube", pico > y0 + 0.3, `${(pico - y0).toFixed(2)} m`);
  await espera(pg, 1000);

  const luz0 = (await est(pg)).luz;
  await tocar(pg, cdp, "#tactil .c-linterna"); await espera(pg, 600);
  const luz1 = (await est(pg)).luz;
  ch("LINTERNA: se apaga y se prende", luz0 !== luz1, `${luz0} → ${luz1}`);
  await tocar(pg, cdp, "#tactil .c-linterna"); await espera(pg, 600);

  await tocar(pg, cdp, "#tactil .c-pausa"); await espera(pg, 500);
  ch("botón de pausa: pausa", await pausado(pg));
  await pg.tap("text=SEGUIR"); await espera(pg, 700);
  ch("SEGUIR: vuelve al juego", !(await pausado(pg)) && (await est(pg)).modo === "jugando");

  const url0 = pg.url();
  await pg.evaluate(() => history.back()); await espera(pg, 800);
  ch("atrás de Android (en el navegador): pausa y NO se va de la página", (await pausado(pg)) && pg.url() === url0);
  await pg.tap("text=SEGUIR"); await espera(pg, 2600);

  await pg.evaluate(() => { Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await espera(pg, 500);
  ch("salir de la app (pestaña oculta): pausa", await pausado(pg));
  await pg.evaluate(() => { Object.defineProperty(document, "hidden", { value: false, configurable: true }); });

  const bien = audios.filter((x) => x[1]).length;
  ch("música y sonidos: decodificados y listos para sonar", bien >= 1 && bien === audios.length, `${bien}/${audios.length} decodificados`);
  const cuadros0 = await pg.evaluate(() => window.__bus.cuadros); await espera(pg, 3000);
  const fps = ((await pg.evaluate(() => window.__bus.cuadros)) - cuadros0) / 3;
  console.log(`    (cuadros/s con render por CPU: ${fps.toFixed(1)} — en un teléfono con GPU es otra cosa)`);
  await pg.screenshot({ path: `${CAPTURAS}/bus-acostado.png` });

  await pg.reload();
  await pg.waitForFunction(() => window.__bus && window.__bus.listo, { timeout: 120000 });
  ch("el guardado sobrevive: al volver no pide el idioma otra vez", !/ESPAÑOL/.test(await pantalla(pg)) && /JUGAR/.test(await pantalla(pg)));

  await pg.tap("text=JUGAR").catch(() => {}); await espera(pg, 1500);
  await pg.evaluate(() => history.back()); await espera(pg, 300);
  await pg.evaluate(() => history.back()); await espera(pg, 1500);
  ch("dos atrás seguidos: sale", pg.url() !== url0, pg.url().slice(0, 40));
  ch("sin errores en consola ni pedidos fallidos", !errores.length, errores.slice(0, 3).join(" | "));
  await pg.context().close();
}

// ───────────────────────── B. otras pantallas ─────────────────────────
for (const [w, h, nombre] of [[640, 360, "chico 640×360"], [1024, 600, "tablet 1024×600"], [915, 412, "alto 915×412"]]) {
  console.log(`\nB. ${nombre}`);
  const { pg, errores } = await abrir(WEB, { w, h });
  await jugar(pg);
  await controlesAdentro(pg, w, h, nombre);
  ch(`${nombre}: sin errores`, !errores.length, errores.slice(0, 2).join(" | "));
  await pg.context().close();
}

// ───────────────────────── C. teléfono parado ─────────────────────────
console.log("\nC. teléfono parado (390×844)");
{
  const { pg, errores } = await abrir(WEB, { w: 390, h: 844 });
  const g = await pg.evaluate(() => { const e = document.getElementById("porteo-girar"); return e && getComputedStyle(e).display !== "none" ? e.innerText : null; });
  ch("parado: pide girar el teléfono", !!g, JSON.stringify(g));
  await pg.screenshot({ path: `${CAPTURAS}/bus-parado.png` });
  await pg.setViewportSize({ width: 844, height: 390 }); await espera(pg, 500);
  const g2 = await pg.evaluate(() => getComputedStyle(document.getElementById("porteo-girar")).display);
  ch("acostado: el cartel se va", g2 === "none");
  await jugar(pg);
  await pg.setViewportSize({ width: 390, height: 844 }); await espera(pg, 700);
  ch("girarlo a parado en plena partida: se pausa", await pausado(pg));
  await pg.evaluate(() => { localStorage.setItem("busstop.v1", JSON.stringify({ ...JSON.parse(localStorage.getItem("busstop.v1")), idioma: "en" })); });
  await pg.setViewportSize({ width: 844, height: 390 }); await espera(pg, 300);
  await pg.setViewportSize({ width: 390, height: 844 }); await espera(pg, 300);
  const en = await pg.evaluate(() => document.getElementById("porteo-girar").innerText);
  ch("el cartel sigue el idioma del juego", /Turn your phone/.test(en), JSON.stringify(en));
  ch("sin errores", !errores.length, errores.slice(0, 2).join(" | "));
  await pg.context().close();
}

// ───────────────────────── D. sin internet (PWA) ─────────────────────────
console.log("\nD. sin internet, después de la primera visita");
{
  const ctx = await nav.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const { pg } = await abrir(WEB, { ctx });
  await pg.waitForFunction(async () => {
    const r = await navigator.serviceWorker.ready; if (!r.active) return false;
    const ks = await caches.keys(); if (!ks.length) return false;
    return (await (await caches.open(ks[0])).keys()).length >= 41;
  }, { timeout: 60000 }).catch(() => {});
  const n = await pg.evaluate(async () => { const ks = await caches.keys(); return ks.length ? (await (await caches.open(ks[0])).keys()).length : 0; });
  ch("el service worker guardó todo", n >= 41, `${n} archivos`);
  await ctx.setOffline(true);
  await pg.reload();
  const anda = await pg.waitForFunction(() => window.__bus && window.__bus.listo, { timeout: 60000 }).then(() => true, () => false);
  ch("sin red: abre igual", anda);
  if (anda) { await jugar(pg); ch("sin red: se juega", (await est(pg)).modo === "jugando"); }
  const m = await pg.evaluate(async () => { const r = await fetch("manifest.webmanifest"); return r.json(); }).catch(() => null);
  ch("manifest: pantalla completa y horizontal (instalable)", m && m.display === "fullscreen" && m.orientation === "landscape" && m.icons.length === 2);
  await ctx.close();
}

// ───────────────────────── E. un solo archivo ─────────────────────────
if (ARCHIVO) {
  console.log("\nE. un solo archivo, abierto del disco (file://)");
  const { pg, cdp, errores, audios, ms } = await abrir(ARCHIVO);
  ch("abre sin servidor", true, `${ms} ms`);
  await jugar(pg);
  const a = await est(pg); await caminar(pg, cdp, 1200); const b = await est(pg);
  ch("se juega: camina", distancia(a, b) > 0.5, `${distancia(a, b).toFixed(2)} m`);
  ch("la fuente del juego carga", await pg.evaluate(() => document.fonts.check("16px BusTipo")));
  await espera(pg, 1500);
  const bien = audios.filter((x) => x[1]).length;
  ch("música y sonidos: decodificados y listos para sonar", bien >= 1 && bien === audios.length, `${bien}/${audios.length} decodificados`);
  ch("sin errores", !errores.length, errores.slice(0, 3).join(" | "));
  await pg.screenshot({ path: `${CAPTURAS}/bus-un-archivo.png` });
  await pg.context().close();
}

await nav.close();
console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);

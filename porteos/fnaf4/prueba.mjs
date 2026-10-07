// FNaF 4 — la lista de PORTEO.md §9 contra lo que se entrega.
//
//   node porteos/fnaf4/prueba.mjs http://127.0.0.1:8821/ file:///ruta/fnaf4.html
//
// Primer argumento: la carpeta web servida por http (el service worker lo
// necesita). Segundo: el .html de un solo archivo abierto del disco.
// Los toques son dedos de verdad (CDP) y cada control se mide en el estado
// del juego: valores alterables de "follow", "flashlight", "close door", el
// contador "hour" y la pantalla en la que está.
const { chromium } = await import(process.env.PLAYWRIGHT || "/opt/node22/lib/node_modules/playwright/index.mjs");
const WEB = process.argv[2] || "http://127.0.0.1:8821/";
const ARCHIVO = process.argv[3];
const CAPTURAS = process.env.CAPTURAS || "/tmp";
const nav = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"],
});
let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? ok++ : mal++; console.log(`  ${c ? "✓" : "✗"} ${n}${d ? " — " + d : ""}`); };

async function abrir(url, { w = 844, h = 390, ctx = null } = {}) {
  const c = ctx || await nav.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  const pg = await c.newPage();
  const errores = [], avisos = [];
  let audios = 0;
  pg.on("pageerror", (e) => errores.push(e.message));
  pg.on("console", (m) => { if (m.type() === "error") errores.push(m.text().slice(0, 160)); if (m.type() === "warning") avisos.push(m.text().slice(0, 160)); });
  pg.on("requestfailed", (r) => errores.push("falló " + r.url().slice(-60)));
  await pg.exposeFunction("__audioOk", () => { audios++; });
  await pg.addInitScript(() => {
    const d = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function () { const p = d.apply(this, arguments); p.then(() => window.__audioOk(), () => {}); return p; };
  });
  const t0 = Date.now();
  await pg.goto(url);
  await pg.waitForFunction(() => window.__ct && window.__ct.listo, { timeout: 120000 });
  const cdp = await pg.context().newCDPSession(pg);
  return { pg, cdp, errores, avisos, audios: () => audios, ms: Date.now() - t0, ctx: c };
}
const toque = (cdp, type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
const aPagina = (pg, gx, gy) => pg.evaluate(([gx, gy]) => { const r = document.querySelector("#juego").getBoundingClientRect(); return [r.left + gx / 800 * r.width, r.top + gy / 480 * r.height]; }, [gx, gy]);
const centro = (pg, n) => pg.evaluate((n) => { const M = window.__ct.motor, i = M.F.inst.find((o) => o.o.n === n && !o.destruido); if (!i) return null; const c = M.caja(i); return [c[0] + c[2] / 2 - M.F.camX, c[1] + c[3] / 2 - M.F.camY]; }, n);
async function tocar(pg, cdp, n, ms = 120) { const [gx, gy] = typeof n === "string" ? await centro(pg, n) : n; const [x, y] = await aPagina(pg, gx, gy); await toque(cdp, "touchStart", [[x, y, 1]]); await pg.waitForTimeout(ms); await toque(cdp, "touchEnd", []); }
async function doble(pg, cdp, n) { await tocar(pg, cdp, n, 60); await pg.waitForTimeout(120); await tocar(pg, cdp, n, 60); }
async function mantener(pg, cdp, n) { const [gx, gy] = await centro(pg, n); const [x, y] = await aPagina(pg, gx, gy); await toque(cdp, "touchStart", [[x, y, 1]]); }
const soltar = (cdp) => toque(cdp, "touchEnd", []);
const estado = (pg) => pg.evaluate(() => { const M = window.__ct.motor, I = (n) => M.F.inst.find((o) => o.o.n === n);
  return { frame: M.F.f.nombre, camX: M.F.camX, follow: I("follow")?.alt[0], followX: Math.round(I("follow")?.x ?? -1),
    linterna: I("flashlight")?.alt[0], puerta: I("close door")?.alt[0], hora: I("hour")?.valor, alfaNG: I("New Game")?.alfa }; });
const esperarFrame = (pg, nombre, t = 60000) => pg.waitForFunction((n) => window.__ct.motor.F?.f.nombre === n && !window.__ct.motor.cargando, nombre, { timeout: t });
async function aLaNoche(pg, cdp) {
  await esperarFrame(pg, "titlescreen");
  await pg.waitForTimeout(3500);
  await tocar(pg, cdp, "New Game");
  await esperarFrame(pg, "level");
  await pg.waitForTimeout(2000);
}

// ─────────────────── A. teléfono acostado, carpeta web ───────────────────
console.log("\nA. teléfono acostado (844×390), carpeta web");
{
  const { pg, cdp, errores, avisos, audios, ms } = await abrir(WEB);
  ch("carga", true, `${ms} ms`);
  await esperarFrame(pg, "titlescreen", 30000);
  ch("la advertencia pasa sola al título", true);
  await tocar(pg, cdp, [400, 460]);
  await pg.waitForTimeout(3500);
  const e0 = await estado(pg);
  ch("el menú aparece (New Game visible)", e0.alfaNG < 128, `coeficiente ${e0.alfaNG} de 255`);
  ch("la música del título suena después del primer toque", audios() >= 1, `${audios()} audios decodificados`);
  await pg.screenshot({ path: `${CAPTURAS}/fnaf4-titulo.png` });
  await tocar(pg, cdp, "New Game");
  await esperarFrame(pg, "level");
  await pg.waitForTimeout(2000);
  let e = await estado(pg);
  ch("New Game → noche 1, 12 AM", e.frame === "level" && e.hora === 12, `hora ${e.hora}`);
  await mantener(pg, cdp, "right zone fast"); await pg.waitForTimeout(1500);
  const e2 = await estado(pg); await soltar(cdp); await pg.waitForTimeout(400);
  ch("mantener a la derecha mueve la vista", e2.camX > e.camX, `camX ${e.camX} → ${e2.camX}`);
  await tocar(pg, cdp, "run to right"); await pg.waitForTimeout(800);
  const e3 = await estado(pg);
  ch("un toque simple en la puerta no corre", e3.follow === e2.follow, `follow ${e2.follow} → ${e3.follow}`);
  await doble(pg, cdp, "run to right"); await pg.waitForTimeout(2500);
  const e4 = await estado(pg);
  ch("doble toque: corre a la puerta", e4.follow !== e3.follow, `follow ${e3.follow} → ${e4.follow}`);
  await mantener(pg, cdp, "flashlight"); await pg.waitForTimeout(700);
  const e5 = await estado(pg); await pg.screenshot({ path: `${CAPTURAS}/fnaf4-linterna.png` });
  await soltar(cdp); await pg.waitForTimeout(400); const e6 = await estado(pg);
  ch("mantener la linterna la prende; soltar la apaga", e5.linterna === 1 && e6.linterna === 0, `${e5.linterna} → ${e6.linterna}`);
  await mantener(pg, cdp, "close door"); await pg.waitForTimeout(700);
  const e7 = await estado(pg); await soltar(cdp); await pg.waitForTimeout(400); const e8 = await estado(pg);
  ch("mantener la puerta la cierra; soltar la abre", e7.puerta === 1 && e8.puerta === 0, `${e7.puerta} → ${e8.puerta}`);
  await tocar(pg, cdp, "run back"); await pg.waitForTimeout(2500);
  const e9 = await estado(pg);
  ch("'run back' vuelve al cuarto", e9.follow !== e8.follow, `follow ${e8.follow} → ${e9.follow}`);
  const r0 = await pg.evaluate(() => window.__ct.motor.eventos[367].c[0].st.r), t0 = Date.now();
  await pg.waitForTimeout(6000);
  const r1 = await pg.evaluate(() => window.__ct.motor.eventos[367].c[0].st.r), real = (Date.now() - t0) / 1000;
  ch("el reloj de la noche va a tiempo real (hora = 60 s)", Math.abs((r0 - r1) / 1000 / real - 1) < 0.08, `${((r0 - r1) / 1000 / real).toFixed(2)}×`);
  const costo = await pg.evaluate(() => { const M = window.__ct.motor, t = performance.now(); for (let k = 0; k < 120; k++) M.paso(); return (performance.now() - t) / 120; });
  ch("la lógica de un cuadro cabe holgada en 16 ms", costo < 4, `${costo.toFixed(2)} ms`);
  // perder: sin hacer nada, a 20×
  const pantallas = [];
  await pg.exposeFunction("__frame", (n) => pantallas.push(n));
  await pg.evaluate(() => { const M = window.__ct.motor, ir = M.ir.bind(M); M.ir = async (k) => { window.__frame(M.J.frames[k]?.nombre); return ir(k); }; window.__ct.acelerar = 20; });
  await pg.waitForFunction(() => window.__ct.motor.F.f.nombre !== "level", null, { timeout: 120000 }).catch(() => {});
  await pg.evaluate(() => { window.__ct.acelerar = 1; });
  // el game over del original dura 7 s ("el reloj llegó a 7000 ms → título")
  await pg.waitForFunction(() => window.__ct.motor.F.f.nombre === "titlescreen", null, { timeout: 20000 }).catch(() => {});
  ch("sin defenderse, te agarran: game over (7 s) → título", pantallas[0] === "game over" && pantallas.includes("titlescreen"), pantallas.join(" → "));
  // ganar: la hora a 6
  pantallas.length = 0;
  await pg.evaluate(() => window.__ct.motor.saltar(3));
  await esperarFrame(pg, "level");
  await pg.evaluate(() => { window.__ct.motor.F.inst.find((o) => o.o.n === "hour").valor = 6; });
  await pg.waitForTimeout(14000);
  ch("a las 6 AM: night win → Plushtrap", pantallas[1] === "night win" && pantallas.includes("intro to plushtrap"), pantallas.join(" → "));
  // las 16 pantallas
  const n = await pg.evaluate(() => window.__ct.J.frames.length);
  for (let k = 0; k < n; k++) {
    await pg.evaluate((k) => { const M = window.__ct.motor; M.pend = null; M.fundido = null; M.ir(k); }, k);
    await pg.waitForTimeout(1200);
  }
  ch(`las ${n} pantallas cargan y corren`, true);
  const sinImpl = avisos.filter((a) => a.includes("sin implementar"));
  ch("el motor no encontró nada sin implementar", !sinImpl.length, sinImpl.slice(0, 3).join(" | "));
  ch("sin errores en consola ni pedidos fallidos", !errores.length, errores.slice(0, 3).join(" | "));
  await pg.context().close();
}

// ─────────────────── B. otras pantallas y teléfono parado ───────────────────
for (const [w, h, nombre] of [[640, 360, "chico 640×360"], [915, 412, "alto 915×412"], [1024, 600, "tablet 1024×600"]]) {
  console.log(`\nB. ${nombre}`);
  const { pg, errores } = await abrir(WEB, { w, h });
  const r = await pg.evaluate(() => { const c = document.querySelector("#juego").getBoundingClientRect(); return [c.left, c.top, c.width, c.height]; });
  ch(`${nombre}: el juego entra entero, 5:3`, r[0] >= 0 && r[1] >= 0 && r[0] + r[2] <= w + 1 && r[1] + r[3] <= h + 1 && Math.abs(r[2] / r[3] - 5 / 3) < 0.02, r.map(Math.round).join(","));
  ch(`${nombre}: sin errores`, !errores.length, errores.slice(0, 2).join(" | "));
  await pg.context().close();
}
console.log("\nC. teléfono parado (390×844): el juego se gira solo");
{
  // Con el teléfono parado (o el giro automático bloqueado) el juego se gira
  // solo 90° y se juega igual: los toques van a donde cae el dedo en el vidrio.
  const { pg, cdp, errores } = await abrir(WEB, { w: 390, h: 844 });
  const info = await pg.evaluate(() => ({ iw: innerWidth, ih: innerHeight, girado: document.documentElement.classList.contains("porteo-girado"), cartel: !!document.getElementById("porteo-girar") }));
  ch("parado: el juego se gira (sin cartel)", info.girado && !info.cartel && info.iw === 844 && info.ih === 390, JSON.stringify(info));
  const dedo = (gx, gy) => pg.evaluate(([gx, gy]) => { const r = document.querySelector("#juego").getBoundingClientRect(); const lx = r.left + gx / 800 * r.width, ly = r.top + gy / 480 * r.height; const g = Porteo.girar(), [W, H] = g.fisico(); return g.sentido() > 0 ? [W - ly, lx] : [ly, H - lx]; }, [gx, gy]);
  const tocarG = async (n, ms = 120) => { const [gx, gy] = await centro(pg, n); const [x, y] = await dedo(gx, gy); await toque(cdp, "touchStart", [[x, y, 1]]); await pg.waitForTimeout(ms); await toque(cdp, "touchEnd", []); };
  const mantenerG = async (n) => { const [gx, gy] = await centro(pg, n); const [x, y] = await dedo(gx, gy); await toque(cdp, "touchStart", [[x, y, 1]]); };
  await esperarFrame(pg, "titlescreen"); await pg.waitForTimeout(3500);
  await tocarG("New Game");
  await esperarFrame(pg, "level"); await pg.waitForTimeout(2000);
  const l0 = await pg.evaluate(() => window.__ct.motor.F.loop); await pg.waitForTimeout(1000); const l1 = await pg.evaluate(() => window.__ct.motor.F.loop);
  ch("parado: New Game → la noche corre", l1 > l0, `cuadros ${l0} → ${l1}`);
  const e0 = await estado(pg);
  await mantenerG("right zone fast"); await pg.waitForTimeout(1200); const e1 = await estado(pg); await soltar(cdp);
  ch("parado: mantener a la derecha mueve la vista", e1.camX > e0.camX, `camX ${e0.camX} → ${e1.camX}`);
  await tocarG("run to right", 60); await pg.waitForTimeout(120); await tocarG("run to right", 60); await pg.waitForTimeout(2500);
  const e2 = await estado(pg);
  ch("parado: doble toque corre a la puerta", e2.follow !== e1.follow, `follow ${e1.follow} → ${e2.follow}`);
  await mantenerG("flashlight"); await pg.waitForTimeout(700); const e3 = await estado(pg);
  await pg.screenshot({ path: `${CAPTURAS}/fnaf4-parado.png` });
  await soltar(cdp); await pg.waitForTimeout(400); const e4 = await estado(pg);
  ch("parado: la linterna se prende y se apaga", e3.linterna === 1 && e4.linterna === 0, `${e3.linterna} → ${e4.linterna}`);
  await pg.setViewportSize({ width: 844, height: 390 }); await pg.waitForTimeout(600);
  const r = await pg.evaluate(() => { const c = document.querySelector("#juego").getBoundingClientRect(); return { girado: document.documentElement.classList.contains("porteo-girado"), c: [c.x, c.y, c.width, c.height].map(Math.round) }; });
  ch("acostado otra vez: se endereza", !r.girado && r.c.join() === "97,0,650,390", JSON.stringify(r));
  ch("sin errores", !errores.length, errores.slice(0, 2).join(" | "));
  await pg.context().close();
}

// ─────────────────── D. sin internet (PWA) ───────────────────
console.log("\nD. sin internet, después de la primera visita");
{
  const ctx = await nav.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const { pg } = await abrir(WEB, { ctx });
  const total = await pg.evaluate(async () => (await (await fetch("manifest.webmanifest")).json(), JSON.parse(await (await fetch("sw.js")).text().then((t) => t.match(/ARCHIVOS = (\[.*?\]);/)[1]))).length);
  await pg.waitForFunction(async (total) => {
    const r = await navigator.serviceWorker.ready; if (!r.active) return false;
    const ks = await caches.keys(); if (!ks.length) return false;
    return (await (await caches.open(ks[0])).keys()).length >= total;
  }, total, { timeout: 120000 }).catch(() => {});
  const n = await pg.evaluate(async () => { const ks = await caches.keys(); return ks.length ? (await (await caches.open(ks[0])).keys()).length : 0; });
  ch("el service worker guardó todo", n >= total, `${n} de ${total}`);
  await ctx.setOffline(true);
  await pg.reload();
  const anda = await pg.waitForFunction(() => window.__ct && window.__ct.listo, null, { timeout: 60000 }).then(() => true, () => false);
  ch("sin red: abre igual", anda);
  if (anda) { const cdp = await pg.context().newCDPSession(pg); await aLaNoche(pg, cdp); ch("sin red: se juega la noche", (await estado(pg)).frame === "level"); }
  await ctx.close();
}

// ─────────────────── E. un solo archivo ───────────────────
if (ARCHIVO) {
  console.log("\nE. un solo archivo, abierto del disco (file://)");
  const { pg, cdp, errores, audios, ms } = await abrir(ARCHIVO);
  ch("abre sin servidor", true, `${ms} ms`);
  await aLaNoche(pg, cdp);
  ch("se llega a la noche tocando", (await estado(pg)).frame === "level");
  await mantener(pg, cdp, "right zone fast"); await pg.waitForTimeout(1200); const e = await estado(pg); await soltar(cdp);
  ch("se juega: la vista se mueve con el dedo", e.camX > 100, `camX ${e.camX}`);
  ch("el sonido llega", audios() >= 2, `${audios()} audios`);
  ch("sin errores", !errores.length, errores.slice(0, 3).join(" | "));
  await pg.screenshot({ path: `${CAPTURAS}/fnaf4-un-archivo.png` });
  await pg.context().close();
}

await nav.close();
console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);

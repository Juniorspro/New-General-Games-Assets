const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, pref] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
let errores = 0;
pg.on("pageerror", (e) => { errores++; console.log("pageerror " + e.message); });
await pg.goto(url);
for (let i = 0; i < 600; i++) { if (await pg.evaluate("!!(window.prueba && window.prueba.listo)").catch(() => false)) break; await pg.waitForTimeout(100); }
await pg.waitForTimeout(1500);
for (const lado of [1, 2]) {
  await pg.evaluate((lado) => {
    const J = window.prueba.jui, pan = J.arriba(); if (!pan) return;
    const id = lado === 1 ? "button.porteo_cartel_medio" : "button.porteo_cartel_der";
    const rec = (c) => { const m = c.p.button_mappings || []; if (c.ver && m.some((b) => b && b.to_button_id === id)) return c; for (const h of c.hijos) { const r = rec(h); if (r) return r; } return null; };
    const c = rec(pan.raiz); if (c) J.apretar(c);
  }, lado);
  await pg.waitForTimeout(500);
}
await pg.evaluate(() => window.prueba.crear({ nombre: 'Comer', modo: 'supervivencia', tipo: 'plano', bichos: false, siempreDia: true, dificultad: 2 }));
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(1200);
const est = () => pg.evaluate(() => { const s = window.prueba.supervivencia(), v = window.prueba.inventario(); return 'comida ' + s.comida + ' sat ' + s.saturacion.toFixed(1) + ' barra ' + v.barra.map((c) => c ? c.id + 'x' + c.n : '-').join(','); });
await pg.evaluate(() => { const s = window.prueba.supervivencia(), v = window.prueba.inventario(); s.comida = 10; s.saturacion = 0; v.barra[0] = { id: 297, m: 0, n: 3, d: 0 }; v.barra[1] = { id: 282, m: 0, n: 1, d: 0 }; Interfaz.juego.elegido = 0; window.prueba.jugador.pitch = -0.3; });
console.log('antes: ' + await est());
const cdp = await ctx.newCDPSession(pg);
async function mantener(ms, foto) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 436, y: 150, id: 1 }] });
  for (let i = 0; i < ms / 100; i++) { await pg.waitForTimeout(100); await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 436 + (i % 2) * 0.2, y: 150, id: 1 }] }); if (foto && i === 12) await pg.screenshot({ path: foto }); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
await mantener(2300, `${pref}-comiendo.png`);
await pg.waitForTimeout(300);
console.log('tras comer pan: ' + await est());
await pg.evaluate(() => { Interfaz.juego.elegido = 1; });
await mantener(2300);
await pg.waitForTimeout(300);
console.log('tras el guiso: ' + await est());
await pg.evaluate(() => { const s = window.prueba.supervivencia(); s.comida = 20; Interfaz.juego.elegido = 0; });
await mantener(2300);
await pg.waitForTimeout(300);
console.log('lleno (no come): ' + await est());
console.log("errores de la página: " + errores);
await nav.close();

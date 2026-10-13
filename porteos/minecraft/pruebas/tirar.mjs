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
await pg.evaluate(() => window.prueba.crear({ nombre: 'Tirar', modo: 'supervivencia', tipo: 'plano', bichos: false, siempreDia: true, dificultad: 0 }));
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(1500);
await pg.evaluate(() => { window.prueba.jugador.pitch = 0.6; });
const cdp = await ctx.newCDPSession(pg);
await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 301, y: 375, id: 1 }] });
for (let i = 0; i < 12; i++) { await pg.waitForTimeout(100); await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 301 + (i % 2) * 0.2, y: 375, id: 1 }] }); }
await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
await pg.waitForTimeout(500);
console.log("barra: " + await pg.evaluate(() => JSON.stringify(window.prueba.inventario().barra.map((c) => c && c.id + 'x' + c.n))));
console.log("tirados: " + await pg.evaluate(() => JSON.stringify(window.prueba.tirados().map((e) => e.c ? e.c.id + 'x' + e.c.n + ' @' + [e.x, e.y, e.z].map((v) => v.toFixed(1)).join(',') : 'xp'))));
await pg.screenshot({ path: `${pref}-tirado.png` });
await pg.waitForTimeout(2500);
console.log("después de 2,5 s: barra " + await pg.evaluate(() => JSON.stringify(window.prueba.inventario().barra.map((c) => c && c.id + 'x' + c.n))) + " tirados " + await pg.evaluate(() => window.prueba.tirados().length));
console.log("errores de la página: " + errores);
await nav.close();
